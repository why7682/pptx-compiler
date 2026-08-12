#!/usr/bin/env node

import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  lstat,
  mkdtemp,
  open,
  realpath,
  rmdir,
  rm,
  unlink,
  writeFile
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import {
  ALPHA_FIXED_BUILDER,
  ALPHA_RELEASE_TAG_NAME,
  alphaReleaseRepositoryRoot,
  canonicalAlphaReleaseLockText,
  canonicalAlphaReleasePlanText,
  deriveAlphaPublicationOrder,
  inspectAlphaReleaseCandidateSnapshot,
  validateAlphaReleaseCandidate,
  validateAlphaReleaseLock,
  validateAlphaReleasePlan,
  validateAlphaReviewedTarballs
} from "./lib/alpha-release.mjs";
import {
  ALPHA_PUBLICATION,
  ALPHA_REPOSITORY,
  canonicalAlphaPackagePlanText,
  validateAlphaPackagePlan
} from "./lib/package-plan.mjs";
import { reviewedStageComplete } from "./lib/package-stage.mjs";
import { compileForbiddenMaterialPolicy } from "./check-forbidden-materials.mjs";

const MAX_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const NPM_TIMEOUT_MS = 5 * 60_000;
const SHA1 = /^[a-f0-9]{40}$/u;
const GIT_OID = /^[a-f0-9]{40}$/u;
const TOKEN = /^[!-~]{1,16384}$/u;
const SLSA_V1 = "https://slsa.dev/provenance/v1";
const SIGSTORE_BUNDLE = "application/vnd.dev.sigstore.bundle.v0.3+json";
const SIGSTORE_VERSION = "4.1.1";
const SIGSTORE_CERTIFICATE_ISSUER = "https://token.actions.githubusercontent.com";
const SIGSTORE_CERTIFICATE_IDENTITY =
  `${ALPHA_REPOSITORY.htmlUrl}/.github/workflows/alpha-release.yml@` +
  `refs/tags/${ALPHA_RELEASE_TAG_NAME}`;
const SIGSTORE_CERTIFICATE_IDENTITY_PATTERN =
  `^${SIGSTORE_CERTIFICATE_IDENTITY.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`;
const MAX_SIGSTORE_CERTIFICATE_BYTES = 64 * 1024;
const MAX_SIGSTORE_SIGNATURE_BYTES = 64 * 1024;
const STAGE_ROOT = ".package-stage/reviewed";
const GITHUB_API_ROOT = "https://api.github.com/";
const GITHUB_WORKFLOWS = Object.freeze([
  Object.freeze({ id: "ci.yml", path: ".github/workflows/ci.yml" }),
  Object.freeze({ id: "security.yml", path: ".github/workflows/security.yml" })
]);
const EXPECTED_ORDER = Object.freeze([
  "core",
  "native-card-arrow",
  "public-synthetic",
  "cli"
]);
const EXACT_ARGUMENTS = Object.freeze({
  "verify-source": Object.freeze([
    "--mode", "verify-source", "--tag", ALPHA_RELEASE_TAG_NAME,
    "--stage-root", STAGE_ROOT
  ]),
  publish: Object.freeze([
    "--mode", "publish", "--tag", ALPHA_RELEASE_TAG_NAME,
    "--stage-root", STAGE_ROOT
  ])
});

function fail(code) {
  throw new Error(code);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasClosedOwnKeys(value, required, optional = []) {
  if (!isPlainRecord(value)) return false;
  const keys = Reflect.ownKeys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => typeof key === "string" && allowed.has(key));
}

function own(environment, key) {
  return Object.prototype.hasOwnProperty.call(environment, key);
}

function validToken(value) {
  return typeof value === "string" && TOKEN.test(value);
}

function validEnvironment(environment) {
  return environment !== null && typeof environment === "object" &&
    !Array.isArray(environment) && Reflect.ownKeys(environment)
      .every((key) => typeof key === "string");
}

function canonicalPositiveInteger(value) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/u.test(value)) return false;
  const number = Number(value);
  return Number.isSafeInteger(number) && String(number) === value;
}

function hash(algorithm, bytes, encoding = "hex") {
  return createHash(algorithm).update(bytes).digest(encoding);
}

function sameStat(left, right) {
  return left.dev === right.dev && left.ino === right.ino &&
    left.size === right.size && left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

async function stableRead(absolutePath, maximumBytes = MAX_BYTES) {
  let handle;
  try {
    handle = await open(
      absolutePath,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)
    );
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size < 1n ||
        before.size > BigInt(maximumBytes)) {
      fail("alpha-publication-input-file");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (!sameStat(before, after) || bytes.length !== Number(before.size)) {
      fail("alpha-publication-input-changed");
    }
    return bytes;
  } finally {
    await handle?.close();
  }
}

function parseJson(bytes, code) {
  try {
    return JSON.parse(new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true
    }).decode(bytes));
  } catch {
    fail(code);
  }
}

function isCanonicalBase64(value, maximumBytes) {
  if (typeof value !== "string" || value.length < 4 ||
      value.length > maximumBytes * 2 || value.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u
        .test(value)) {
    return false;
  }
  const bytes = Buffer.from(value, "base64");
  return bytes.length > 0 && bytes.length <= maximumBytes &&
    bytes.toString("base64") === value;
}

export function parseAlphaPublicationArguments(argv) {
  if (!Array.isArray(argv)) fail("alpha-publication-usage");
  for (const [mode, expected] of Object.entries(EXACT_ARGUMENTS)) {
    if (argv.length === expected.length &&
        argv.every((value, index) => value === expected[index])) {
      return Object.freeze({ mode, tagName: ALPHA_RELEASE_TAG_NAME, stageRoot: STAGE_ROOT });
    }
  }
  fail("alpha-publication-usage");
}

function requireModeCredentials(mode, environment) {
  if (!validEnvironment(environment)) {
    fail("alpha-publication-credentials");
  }
  if (mode === "verify-source") {
    if (!validToken(environment.GITHUB_TOKEN) || own(environment, "NODE_AUTH_TOKEN")) {
      fail("alpha-publication-source-credentials");
    }
    return environment.GITHUB_TOKEN;
  }
  if (!validToken(environment.NODE_AUTH_TOKEN) ||
      own(environment, "GITHUB_TOKEN") || own(environment, "GH_TOKEN")) {
    fail("alpha-publication-npm-credentials");
  }
  return environment.NODE_AUTH_TOKEN;
}

function rejectPublishSourceCredentials(environment) {
  if (!validEnvironment(environment) ||
      own(environment, "GITHUB_TOKEN") || own(environment, "GH_TOKEN")) {
    fail("alpha-publication-npm-credentials");
  }
}

function withoutPublicationCredentials(environment) {
  return Object.fromEntries(Object.entries(environment).filter(([key]) =>
    !["GITHUB_TOKEN", "GH_TOKEN", "NODE_AUTH_TOKEN", "NPM_TOKEN"].includes(key)));
}

async function readResponse(response, maximumBytes, code) {
  if (response === null || typeof response !== "object" ||
      !Number.isInteger(response.status)) {
    fail(code);
  }
  const lengthText = response.headers?.get?.("content-length");
  if (lengthText !== null && lengthText !== undefined) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(lengthText) || Number(lengthText) > maximumBytes) {
      fail(code);
    }
  }
  if (response.body === null || typeof response.body?.getReader !== "function") {
    fail(code);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) fail(code);
      total += value.byteLength;
      if (total > maximumBytes) fail(code);
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total);
}

function assertExactHttpsUrl(value, expected, code) {
  let actual;
  try {
    actual = new URL(value);
  } catch {
    fail(code);
  }
  const expectedUrl = new URL(expected);
  if (actual.href !== expectedUrl.href || actual.protocol !== "https:" ||
      actual.username !== "" || actual.password !== "" || actual.port !== "" ||
      actual.hash !== "") {
    fail(code);
  }
  return actual.href;
}

async function exactFetch(fetchImpl, url, {
  headers = {},
  maximumBytes = MAX_BYTES,
  code,
  allowedStatuses = [200],
  binary = false
} = {}) {
  assertExactHttpsUrl(url, url, code);
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch {
    fail(code);
  }
  if (typeof response.url === "string" && response.url !== "" && response.url !== url) {
    fail(code);
  }
  if (!allowedStatuses.includes(response.status)) {
    await response.body?.cancel?.().catch?.(() => {});
    fail(code);
  }
  if (response.status !== 200) {
    await response.body?.cancel?.().catch?.(() => {});
    return Object.freeze({ status: response.status });
  }
  if (binary) {
    const encoding = response.headers?.get?.("content-encoding");
    if (encoding !== null && encoding !== undefined && encoding !== "identity") fail(code);
  }
  const bytes = await readResponse(response, maximumBytes, code);
  return Object.freeze({ status: response.status, bytes });
}

async function getJson(fetchImpl, url, { headers, code, allowedStatuses } = {}) {
  const result = await exactFetch(fetchImpl, url, {
    headers,
    code,
    allowedStatuses
  });
  if (result.status !== 200) return result;
  return Object.freeze({
    status: 200,
    value: parseJson(result.bytes, code)
  });
}

function githubHeaders(token) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "pptx-compiler-alpha-release",
    "x-github-api-version": "2022-11-28"
  };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return Object.freeze(headers);
}

async function verifyWorkflowRun(
  fetchImpl,
  headers,
  workflow,
  headCommitOid,
  { branch, headBranch } = {}
) {
  const workflowUrl = new URL(
    `repos/${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}/actions/workflows/${workflow.id}/runs`,
    GITHUB_API_ROOT
  );
  workflowUrl.search = new URLSearchParams([
    ["branch", branch],
    ["event", "push"],
    ["status", "completed"],
    ["per_page", "10"],
    ["page", "1"]
  ]).toString();
  const result = await getJson(fetchImpl, workflowUrl.href, {
    headers,
    code: "alpha-publication-github-workflow"
  });
  const runs = result.value?.workflow_runs;
  if (!isPlainRecord(result.value) ||
      !Number.isSafeInteger(result.value.total_count) || result.value.total_count < 1 ||
      !Array.isArray(runs) || runs.length < 1 || runs.length > 10) {
    fail("alpha-publication-github-workflow");
  }
  const accepted = runs.find((run) => isPlainRecord(run) &&
    Number.isSafeInteger(run.id) && run.id > 0 && run.path === workflow.path &&
    run.event === "push" && run.status === "completed" &&
    run.conclusion === "success" && run.head_sha === headCommitOid &&
    run.head_branch === headBranch &&
    String(run.repository?.id) === ALPHA_REPOSITORY.repositoryId &&
    run.repository?.full_name === `${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}`);
  if (accepted === undefined) fail("alpha-publication-github-workflow");
  return Object.freeze({ path: workflow.path, runId: accepted.id });
}

async function verifyTagWorkflowRuns(fetchImpl, headers, headCommitOid) {
  return Promise.all(GITHUB_WORKFLOWS.map((workflow) => verifyWorkflowRun(
    fetchImpl,
    headers,
    workflow,
    headCommitOid,
    { branch: ALPHA_RELEASE_TAG_NAME, headBranch: ALPHA_RELEASE_TAG_NAME }
  )));
}

async function verifyMainHistoryWorkflowRun(fetchImpl, headers, mainTipCommitOid) {
  return verifyWorkflowRun(
    fetchImpl,
    headers,
    GITHUB_WORKFLOWS[0],
    mainTipCommitOid,
    { branch: "main", headBranch: "main" }
  );
}

async function verifyGitHubReleaseAbsent(fetchImpl, headers) {
  const url = new URL(
    `repos/${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}/releases/tags/` +
      encodeURIComponent(ALPHA_RELEASE_TAG_NAME),
    GITHUB_API_ROOT
  ).href;
  const result = await getJson(fetchImpl, url, {
    headers,
    code: "alpha-publication-github-release-order",
    allowedStatuses: [404]
  });
  if (result.status !== 404) fail("alpha-publication-github-release-order");
}

async function verifyTagTargetRelationToMain(
  fetchImpl,
  headers,
  headCommitOid
) {
  const mainReferenceUrl = new URL(
    `repos/${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}/git/ref/heads/main`,
    GITHUB_API_ROOT
  ).href;
  const mainReferenceResult = await getJson(fetchImpl, mainReferenceUrl, {
    headers,
    code: "alpha-publication-github-main-ref"
  });
  const mainReference = mainReferenceResult.value;
  if (!isPlainRecord(mainReference) || mainReference.ref !== "refs/heads/main" ||
      !isPlainRecord(mainReference.object) ||
      mainReference.object.type !== "commit" ||
      !GIT_OID.test(mainReference.object.sha)) {
    fail("alpha-publication-github-main-ref");
  }

  const mainTipCommitOid = mainReference.object.sha;
  if (mainTipCommitOid === headCommitOid) {
    fail("alpha-publication-github-main-ancestry");
  }

  const compareSpec = [headCommitOid, mainTipCommitOid]
    .map((oid) => encodeURIComponent(oid))
    .join("...");
  const compareUrl = new URL(
    `repos/${encodeURIComponent(ALPHA_REPOSITORY.owner)}/` +
      `${encodeURIComponent(ALPHA_REPOSITORY.name)}/compare/${compareSpec}`,
    GITHUB_API_ROOT
  );
  compareUrl.search = new URLSearchParams([
    ["per_page", "1"],
    ["page", "1"]
  ]).toString();
  const compareResult = await getJson(fetchImpl, compareUrl.href, {
    headers,
    code: "alpha-publication-github-main-ancestry"
  });
  const compare = compareResult.value;
  const commits = compare?.commits;
  const files = compare?.files;
  const aheadBy = compare?.ahead_by;
  const totalCommits = compare?.total_commits;
  if (!isPlainRecord(compare) || compare.status !== "ahead" ||
      !Number.isSafeInteger(aheadBy) || aheadBy < 1 ||
      aheadBy !== 1 || compare.behind_by !== 0 ||
      !Number.isSafeInteger(totalCommits) || totalCommits !== 1 ||
      !isPlainRecord(compare.merge_base_commit) ||
      compare.merge_base_commit.sha !== headCommitOid ||
      !Array.isArray(commits) || commits.length !== 1 ||
      commits.some((commit) => !isPlainRecord(commit) ||
        !GIT_OID.test(commit.sha) || commit.sha === headCommitOid ||
        !Array.isArray(commit.parents) || commit.parents.length !== 1 ||
        commit.parents[0]?.sha !== headCommitOid) ||
      new Set(commits.map((commit) => commit.sha)).size !== commits.length ||
      commits.at(-1)?.sha !== mainTipCommitOid ||
      !Array.isArray(files) || files.length !== 1 ||
      !isPlainRecord(files[0]) ||
      files[0].filename !== "policy/forbidden-materials.json" ||
      files[0].status !== "modified") {
    fail("alpha-publication-github-main-ancestry");
  }
  return Object.freeze({
    mainTipCommitOid,
    tagTargetRelationToMain: "ancestor"
  });
}

function decodeGitHubContent(value, code) {
  if (!isPlainRecord(value) || value.type !== "file" || value.encoding !== "base64" ||
      typeof value.content !== "string" || value.content.length < 4 ||
      value.content.length > MAX_BYTES * 2 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u
        .test(value.content.replaceAll("\n", ""))) {
    fail(code);
  }
  const canonical = value.content.replaceAll("\n", "");
  const bytes = Buffer.from(canonical, "base64");
  if (bytes.length < 1 || bytes.length > MAX_BYTES || bytes.toString("base64") !== canonical) {
    fail(code);
  }
  return bytes;
}

async function readHistoryPolicyAtCommit(fetchImpl, headers, commitOid) {
  const url = new URL(
    `repos/${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}/contents/` +
      `policy/forbidden-materials.json?ref=${encodeURIComponent(commitOid)}`,
    GITHUB_API_ROOT
  ).href;
  const result = await getJson(fetchImpl, url, {
    headers,
    code: "alpha-publication-github-history-attestation"
  });
  const content = result.value;
  const bytes = decodeGitHubContent(
    content,
    "alpha-publication-github-history-attestation"
  );
  if (content.name !== "forbidden-materials.json" ||
      content.path !== "policy/forbidden-materials.json" ||
      !GIT_OID.test(content.sha) || content.size !== bytes.length) {
    fail("alpha-publication-github-history-attestation");
  }
  let rawPolicy;
  let policy;
  try {
    rawPolicy = JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
        .decode(bytes)
    );
    policy = compileForbiddenMaterialPolicy(rawPolicy);
  } catch (error) {
    if (error?.message === "alpha-publication-github-history-attestation") throw error;
    fail("alpha-publication-github-history-attestation");
  }
  return Object.freeze({ rawPolicy, policy });
}

async function verifyMainHistoryAttestation(fetchImpl, headers, mainTipCommitOid, headCommitOid) {
  const [head, main] = await Promise.all([
    readHistoryPolicyAtCommit(fetchImpl, headers, headCommitOid),
    readHistoryPolicyAtCommit(fetchImpl, headers, mainTipCommitOid)
  ]);
  const headGrants = head.policy.approvedGitHubVerifiedMergeCommitObjects;
  const mainGrants = main.policy.approvedGitHubVerifiedMergeCommitObjects;
  const expectedMainGrants = [...headGrants, headCommitOid].sort();
  const {
    approvedGitHubVerifiedMergeCommitObjects: ignoredHeadGrants,
    ...headRemainder
  } = head.rawPolicy;
  const {
    approvedGitHubVerifiedMergeCommitObjects: ignoredMainGrants,
    ...mainRemainder
  } = main.rawPolicy;
  if (headGrants.includes(headCommitOid) ||
      !isDeepStrictEqual(mainGrants, expectedMainGrants) ||
      !isDeepStrictEqual(mainRemainder, headRemainder)) {
    fail("alpha-publication-github-history-attestation");
  }
}

async function verifyStableGitHubRefs(
  fetchImpl,
  headers,
  { mainTipCommitOid, tagObjectOid }
) {
  const [mainResult, tagResult] = await Promise.all([
    getJson(fetchImpl, new URL(
      `repos/${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}/git/ref/heads/main`,
      GITHUB_API_ROOT
    ).href, { headers, code: "alpha-publication-github-main-moved" }),
    getJson(fetchImpl, new URL(
      `repos/${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}/git/ref/tags/${ALPHA_RELEASE_TAG_NAME}`,
      GITHUB_API_ROOT
    ).href, { headers, code: "alpha-publication-github-tag-moved" })
  ]);
  if (mainResult.value?.ref !== "refs/heads/main" ||
      mainResult.value?.object?.type !== "commit" ||
      mainResult.value?.object?.sha !== mainTipCommitOid) {
    fail("alpha-publication-github-main-moved");
  }
  if (tagResult.value?.ref !== `refs/tags/${ALPHA_RELEASE_TAG_NAME}` ||
      tagResult.value?.object?.type !== "tag" ||
      tagResult.value?.object?.sha !== tagObjectOid) {
    fail("alpha-publication-github-tag-moved");
  }
}

export async function verifyAlphaGitHubSource({
  headCommitOid,
  tagObjectOid,
  token,
  githubReleaseState = "absent",
  fetchImpl = globalThis.fetch
} = {}) {
  if (!GIT_OID.test(headCommitOid) || !GIT_OID.test(tagObjectOid) ||
      (token !== undefined && !validToken(token)) ||
      !["absent", "ignore"].includes(githubReleaseState) ||
      (githubReleaseState === "ignore" && !validToken(token)) ||
      typeof fetchImpl !== "function") {
    fail("alpha-publication-github-input");
  }
  const headers = githubHeaders(token);
  const repositoryUrl = new URL(
    `repos/${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}`,
    GITHUB_API_ROOT
  ).href;
  const repositoryResult = await getJson(fetchImpl, repositoryUrl, {
    headers,
    code: "alpha-publication-github-repository"
  });
  const repository = repositoryResult.value;
  if (!isPlainRecord(repository) || String(repository.id) !== ALPHA_REPOSITORY.repositoryId ||
      repository.full_name !== `${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}` ||
      repository.default_branch !== "main" || repository.private !== false ||
      !isPlainRecord(repository.owner) ||
      !Number.isSafeInteger(repository.owner.id) || repository.owner.id < 1) {
    fail("alpha-publication-github-repository");
  }
  const repositoryOwnerId = String(repository.owner.id);

  const mainRelation = await verifyTagTargetRelationToMain(
    fetchImpl,
    headers,
    headCommitOid
  );
  await verifyMainHistoryAttestation(
    fetchImpl,
    headers,
    mainRelation.mainTipCommitOid,
    headCommitOid
  );

  const tagReferenceUrl = new URL(
    `repos/${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}/git/ref/tags/${ALPHA_RELEASE_TAG_NAME}`,
    GITHUB_API_ROOT
  ).href;
  const tagReferenceResult = await getJson(fetchImpl, tagReferenceUrl, {
    headers,
    code: "alpha-publication-github-tag-ref"
  });
  const tagReference = tagReferenceResult.value;
  if (!isPlainRecord(tagReference) ||
      tagReference.ref !== `refs/tags/${ALPHA_RELEASE_TAG_NAME}` ||
      !isPlainRecord(tagReference.object) ||
      tagReference.object.type !== "tag" ||
      tagReference.object.sha !== tagObjectOid) {
    fail("alpha-publication-github-tag-ref");
  }

  const tagObjectUrl = new URL(
    `repos/${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}/git/tags/${tagObjectOid}`,
    GITHUB_API_ROOT
  ).href;
  const tagObjectResult = await getJson(fetchImpl, tagObjectUrl, {
    headers,
    code: "alpha-publication-github-tag-object"
  });
  const tagObject = tagObjectResult.value;
  if (!isPlainRecord(tagObject) || tagObject.sha !== tagObjectOid ||
      tagObject.tag !== ALPHA_RELEASE_TAG_NAME ||
      !isPlainRecord(tagObject.object) || tagObject.object.type !== "commit" ||
      tagObject.object.sha !== headCommitOid) {
    fail("alpha-publication-github-tag-object");
  }

  const commitUrl = new URL(
    `repos/${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}/commits/${headCommitOid}`,
    GITHUB_API_ROOT
  ).href;
  const commitResult = await getJson(fetchImpl, commitUrl, {
    headers,
    code: "alpha-publication-github-commit"
  });
  const commit = commitResult.value;
  const verification = commit?.commit?.verification;
  if (!isPlainRecord(commit) || commit.sha !== headCommitOid ||
      !isPlainRecord(commit.commit) || !isPlainRecord(verification) ||
      verification.verified !== true || verification.reason !== "valid") {
    fail("alpha-publication-github-commit");
  }
  const releaseOrderCheck = githubReleaseState === "absent"
    ? verifyGitHubReleaseAbsent(fetchImpl, headers)
    : Promise.resolve();
  const [workflowRuns, mainHistoryWorkflowRun] = await Promise.all([
    verifyTagWorkflowRuns(fetchImpl, headers, headCommitOid),
    verifyMainHistoryWorkflowRun(fetchImpl, headers, mainRelation.mainTipCommitOid),
    releaseOrderCheck
  ]);
  await verifyStableGitHubRefs(fetchImpl, headers, {
    mainTipCommitOid: mainRelation.mainTipCommitOid,
    tagObjectOid
  });
  return Object.freeze({
    repositoryId: ALPHA_REPOSITORY.repositoryId,
    repositoryOwnerId,
    repository: `${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}`,
    defaultBranch: "main",
    ...mainRelation,
    commitOid: headCommitOid,
    tagObjectOid,
    verified: true,
    verificationReason: "valid",
    workflowRuns: Object.freeze(workflowRuns),
    mainHistoryWorkflowRun
  });
}

export async function verifyMutableAlphaGitHubSource({
  expected,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!isPlainRecord(expected) ||
      expected.repositoryId !== ALPHA_REPOSITORY.repositoryId ||
      !canonicalPositiveInteger(expected.repositoryOwnerId) ||
      expected.repository !== `${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}` ||
      expected.defaultBranch !== "main" ||
      !GIT_OID.test(expected.mainTipCommitOid) ||
      !GIT_OID.test(expected.commitOid) || !GIT_OID.test(expected.tagObjectOid) ||
      expected.tagTargetRelationToMain !== "ancestor" ||
      typeof fetchImpl !== "function") {
    fail("alpha-publication-github-input");
  }
  const headers = githubHeaders();
  const repositoryResult = await getJson(fetchImpl, new URL(
    `repos/${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}`,
    GITHUB_API_ROOT
  ).href, { headers, code: "alpha-publication-github-repository-moved" });
  const repository = repositoryResult.value;
  if (!isPlainRecord(repository) || String(repository.id) !== expected.repositoryId ||
      repository.full_name !== expected.repository ||
      repository.default_branch !== expected.defaultBranch ||
      repository.private !== false || !isPlainRecord(repository.owner) ||
      String(repository.owner.id) !== expected.repositoryOwnerId) {
    fail("alpha-publication-github-repository-moved");
  }
  await verifyStableGitHubRefs(fetchImpl, headers, {
    mainTipCommitOid: expected.mainTipCommitOid,
    tagObjectOid: expected.tagObjectOid
  });
  const [workflowRuns, mainHistoryWorkflowRun] = await Promise.all([
    verifyTagWorkflowRuns(fetchImpl, headers, expected.commitOid),
    verifyMainHistoryWorkflowRun(fetchImpl, headers, expected.mainTipCommitOid),
    verifyGitHubReleaseAbsent(fetchImpl, headers)
  ]);
  return Object.freeze({
    ...expected,
    workflowRuns: Object.freeze(workflowRuns),
    mainHistoryWorkflowRun
  });
}

export function validateAlphaNpmProvenanceEnvironment({
  environment,
  headCommitOid,
  repositoryOwnerId
} = {}) {
  if (!validEnvironment(environment) || !GIT_OID.test(headCommitOid) ||
      !canonicalPositiveInteger(repositoryOwnerId)) {
    fail("alpha-publication-provenance-environment");
  }
  const expected = {
    CI: "true",
    GITHUB_ACTIONS: "true",
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_REPOSITORY: `${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}`,
    GITHUB_REPOSITORY_ID: ALPHA_REPOSITORY.repositoryId,
    GITHUB_REPOSITORY_OWNER_ID: repositoryOwnerId,
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: `refs/tags/${ALPHA_RELEASE_TAG_NAME}`,
    GITHUB_SHA: headCommitOid,
    GITHUB_WORKFLOW_REF:
      `${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}/` +
      `.github/workflows/alpha-release.yml@refs/tags/${ALPHA_RELEASE_TAG_NAME}`,
    RUNNER_ENVIRONMENT: "github-hosted"
  };
  if (Object.entries(expected).some(([key, value]) => environment[key] !== value) ||
      !canonicalPositiveInteger(environment.GITHUB_RUN_ID) ||
      !canonicalPositiveInteger(environment.GITHUB_RUN_ATTEMPT) ||
      !validToken(environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN)) {
    fail("alpha-publication-provenance-environment");
  }
  let oidcUrl;
  try {
    oidcUrl = new URL(environment.ACTIONS_ID_TOKEN_REQUEST_URL);
  } catch {
    fail("alpha-publication-provenance-environment");
  }
  if (oidcUrl.protocol !== "https:" ||
      oidcUrl.hostname !== "pipelines.actions.githubusercontent.com" ||
      oidcUrl.username !== "" || oidcUrl.password !== "" || oidcUrl.port !== "" ||
      oidcUrl.hash !== "" || oidcUrl.pathname === "/" || oidcUrl.pathname === "") {
    fail("alpha-publication-provenance-environment");
  }
  return Object.freeze({
    repositoryOwnerId,
    runId: environment.GITHUB_RUN_ID,
    runAttempt: environment.GITHUB_RUN_ATTEMPT
  });
}

export async function prepareAlphaRelease({
  root,
  environment,
  tagName,
  stageRelative
}) {
  const resolvedRoot = await realpath(root);
  if (resolvedRoot !== path.resolve(root) || !GIT_OID.test(environment.GITHUB_SHA)) {
    fail("alpha-publication-local-candidate");
  }
  const candidateSnapshot = await inspectAlphaReleaseCandidateSnapshot({
    root: resolvedRoot,
    tagName,
    environment: withoutPublicationCredentials(environment)
  });
  const {
    releasePlan,
    packagePlan,
    releaseLock,
    releaseTag,
    inputBytes: lockedInputs
  } = candidateSnapshot;
  const findings = [
    ...(await validateAlphaPackagePlan(packagePlan, { root: resolvedRoot })),
    ...validateAlphaReleasePlan(releasePlan, { packagePlan }),
    ...validateAlphaReleaseLock(releaseLock, {
      releasePlan,
      packagePlan,
      inputBytes: lockedInputs
    })
  ];
  if (findings.length !== 0) fail("alpha-publication-local-contract");

  const reviewed = path.join(resolvedRoot, ...stageRelative.split("/"));
  if (await realpath(reviewed) !== reviewed ||
      !(await reviewedStageComplete(reviewed, packagePlan))) {
    fail("alpha-publication-reviewed-stage");
  }
  const publicationOrder = deriveAlphaPublicationOrder(packagePlan);
  if (publicationOrder.some((entry, index) => entry.packageId !== EXPECTED_ORDER[index])) {
    fail("alpha-publication-order");
  }
  const [packageEvidenceBytes, tarballEntries] = await Promise.all([
    stableRead(path.join(reviewed, "package-evidence.json")),
    Promise.all(publicationOrder.map(async (entry) => [
      entry.packageId,
      await stableRead(path.join(reviewed, "tarballs", entry.tarball))
    ]))
  ]);
  const packageEvidence = parseJson(
    packageEvidenceBytes,
    "alpha-publication-package-evidence"
  );
  const tarballBytes = new Map(tarballEntries.map(([packageId, bytes]) => [
    packageId,
    bytes
  ]));
  if (validateAlphaReviewedTarballs({
    releaseLock,
    packagePlan,
    packageEvidence,
    tarballBytes
  }).length !== 0) {
    fail("alpha-publication-reviewed-tarball");
  }
  return Object.freeze({
    root: resolvedRoot,
    releasePlan,
    packagePlan,
    releaseLock,
    releaseTag,
    lockedInputBytes: new Map([...lockedInputs].map(([key, bytes]) => [
      key,
      Buffer.from(bytes)
    ])),
    publicationOrder,
    tarballBytes
  });
}

export function finalizeAlphaVerifiedCandidate(prepared) {
  const candidate = {
    schemaVersion: 1,
    candidateType: "clean-exact-tag",
    ...prepared.releaseTag,
    targetCommitVerified: true,
    releasePlanSha256: hash(
      "sha256",
      Buffer.from(canonicalAlphaReleasePlanText(prepared.releasePlan))
    ),
    packagePlanSha256: hash(
      "sha256",
      Buffer.from(canonicalAlphaPackagePlanText(prepared.packagePlan))
    ),
    releaseLockSha256: hash(
      "sha256",
      Buffer.from(canonicalAlphaReleaseLockText(prepared.releaseLock))
    )
  };
  if (validateAlphaReleaseCandidate(candidate, {
    releasePlan: prepared.releasePlan,
    packagePlan: prepared.packagePlan,
    releaseLock: prepared.releaseLock
  }).length !== 0) {
    fail("alpha-publication-source-candidate");
  }
}

function registryVersionUrl(entry) {
  return new URL(
    `${encodeURIComponent(entry.name)}/${encodeURIComponent(entry.version)}`,
    ALPHA_PUBLICATION.registry
  ).href;
}

function registryPackageUrl(entry) {
  return new URL(encodeURIComponent(entry.name), ALPHA_PUBLICATION.registry).href;
}

function registryTarballUrl(entry) {
  return new URL(`${entry.name}/-/${entry.tarball}`, ALPHA_PUBLICATION.registry).href;
}

function registryAttestationsUrl(entry) {
  return new URL(
    `-/npm/v1/attestations/${entry.name}@${entry.version}`,
    ALPHA_PUBLICATION.registry
  ).href;
}

function assertRegistryMetadata(metadata, entry, reviewedBytes) {
  const expectedIntegrity = `sha512-${hash("sha512", reviewedBytes, "base64")}`;
  const expectedShasum = hash("sha1", reviewedBytes);
  const expectedTarball = registryTarballUrl(entry);
  const expectedAttestations = registryAttestationsUrl(entry);
  const dist = metadata?.dist;
  if (!isPlainRecord(metadata) || metadata.name !== entry.name ||
      metadata.version !== entry.version || !isPlainRecord(dist) ||
      dist.integrity !== expectedIntegrity || dist.shasum !== expectedShasum ||
      !SHA1.test(dist.shasum) ||
      assertExactHttpsUrl(dist.tarball, expectedTarball,
        "alpha-publication-registry-tarball-url") !== expectedTarball ||
      !Array.isArray(dist.signatures) || dist.signatures.length === 0 ||
      dist.signatures.some((signature) => !isPlainRecord(signature) ||
        typeof signature.sig !== "string" || signature.sig.length === 0 ||
        typeof signature.keyid !== "string" || signature.keyid.length === 0) ||
      !isPlainRecord(dist.attestations) ||
      assertExactHttpsUrl(dist.attestations.url, expectedAttestations,
        "alpha-publication-registry-attestations-url") !== expectedAttestations ||
      !isPlainRecord(dist.attestations.provenance) ||
      dist.attestations.provenance.predicateType !== SLSA_V1) {
    fail("alpha-publication-registry-metadata");
  }
  return Object.freeze({ expectedTarball, expectedAttestations });
}

function decodeDssePayload(value) {
  if (typeof value !== "string" || value.length < 4 || value.length > MAX_BYTES * 2 ||
      value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) {
    fail("alpha-publication-registry-attestations");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value || bytes.length < 1 || bytes.length > MAX_BYTES) {
    fail("alpha-publication-registry-attestations");
  }
  return parseJson(bytes, "alpha-publication-registry-attestations");
}

function assertKeylessSigstoreProvenanceBundle(bundle) {
  const envelope = bundle?.dsseEnvelope;
  const verificationMaterial = bundle?.verificationMaterial;
  const signatures = envelope?.signatures;
  const signingMaterialFields = [
    "certificate",
    "publicKey",
    "x509CertificateChain"
  ].filter((field) => own(verificationMaterial ?? {}, field));
  const certificate = verificationMaterial?.certificate;
  if (!hasClosedOwnKeys(bundle, [
    "mediaType",
    "verificationMaterial",
    "dsseEnvelope"
  ]) || bundle.mediaType !== SIGSTORE_BUNDLE ||
      !hasClosedOwnKeys(envelope, ["payloadType", "payload", "signatures"]) ||
      envelope.payloadType !== "application/vnd.in-toto+json" ||
      !Array.isArray(signatures) || signatures.length !== 1 ||
      !hasClosedOwnKeys(signatures[0], ["sig"], ["keyid"]) ||
      !isCanonicalBase64(signatures[0].sig, MAX_SIGSTORE_SIGNATURE_BYTES) ||
      (own(signatures[0], "keyid") && signatures[0].keyid !== "") ||
      !hasClosedOwnKeys(verificationMaterial, [
        "certificate",
        "tlogEntries",
        "timestampVerificationData"
      ]) ||
      signingMaterialFields.length !== 1 ||
      signingMaterialFields[0] !== "certificate" ||
      !isPlainRecord(certificate) ||
      Reflect.ownKeys(certificate).length !== 1 ||
      !isCanonicalBase64(
        certificate.rawBytes,
        MAX_SIGSTORE_CERTIFICATE_BYTES
      ) ||
      !Array.isArray(verificationMaterial.tlogEntries) ||
      verificationMaterial.tlogEntries.length !== 1) {
    fail("alpha-publication-registry-attestations");
  }
  return envelope;
}

async function verifyAttestations(
  fetchImpl,
  entry,
  expectedUrl,
  reviewedBytes,
  headCommitOid,
  repositoryOwnerId,
  expectedProvenanceInvocation,
  verifyProvenanceBundle
) {
  const result = await getJson(fetchImpl, expectedUrl, {
    code: "alpha-publication-registry-attestations"
  });
  const attestations = result.value?.attestations;
  const provenances = Array.isArray(attestations)
    ? attestations.filter((attestation) =>
      isPlainRecord(attestation) && attestation.predicateType === SLSA_V1)
    : [];
  if (provenances.length !== 1 || !GIT_OID.test(headCommitOid) ||
      typeof verifyProvenanceBundle !== "function") {
    fail("alpha-publication-registry-attestations");
  }
  const provenance = provenances[0];
  const envelope = assertKeylessSigstoreProvenanceBundle(provenance.bundle);
  let cryptographicallyVerified;
  try {
    cryptographicallyVerified = await verifyProvenanceBundle(provenance.bundle);
  } catch {
    fail("alpha-publication-registry-attestations");
  }
  if (cryptographicallyVerified !== true) {
    fail("alpha-publication-registry-attestations");
  }
  const statement = decodeDssePayload(envelope.payload);
  const subject = statement?.subject;
  const buildDefinition = statement?.predicate?.buildDefinition;
  const workflow = buildDefinition?.externalParameters?.workflow;
  const github = buildDefinition?.internalParameters?.github;
  const dependencies = buildDefinition?.resolvedDependencies;
  const invocationId = statement?.predicate?.runDetails?.metadata?.invocationId;
  const invocationPrefix = `${ALPHA_REPOSITORY.htmlUrl}/actions/runs/`;
  const invocationMatch = typeof invocationId === "string" &&
    invocationId.startsWith(invocationPrefix)
    ? /^([1-9][0-9]*)\/attempts\/([1-9][0-9]*)$/u.exec(
      invocationId.slice(invocationPrefix.length)
    )
    : null;
  if (!isPlainRecord(statement) || statement._type !== "https://in-toto.io/Statement/v1" ||
      statement.predicateType !== SLSA_V1 || !Array.isArray(subject) ||
      subject.length !== 1 || subject[0]?.name !== `pkg:npm/${entry.name}@${entry.version}` ||
      subject[0]?.digest?.sha512 !== hash("sha512", reviewedBytes) ||
      buildDefinition?.buildType !==
        "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1" ||
      workflow?.ref !== `refs/tags/${ALPHA_RELEASE_TAG_NAME}` ||
      workflow?.repository !== ALPHA_REPOSITORY.htmlUrl ||
      workflow?.path !== ".github/workflows/alpha-release.yml" ||
      github?.event_name !== "workflow_dispatch" ||
      String(github?.repository_id) !== ALPHA_REPOSITORY.repositoryId ||
      String(github?.repository_owner_id) !== repositoryOwnerId ||
      !Array.isArray(dependencies) || dependencies.length !== 1 ||
      dependencies[0]?.uri !==
        `git+${ALPHA_REPOSITORY.htmlUrl}@refs/tags/${ALPHA_RELEASE_TAG_NAME}` ||
      !isPlainRecord(dependencies[0]?.digest) ||
      Reflect.ownKeys(dependencies[0].digest).length !== 1 ||
      dependencies[0].digest.gitCommit !== headCommitOid ||
      statement?.predicate?.runDetails?.builder?.id !==
        "https://github.com/actions/runner/github-hosted" ||
      invocationMatch === null ||
      !canonicalPositiveInteger(invocationMatch[1]) ||
      !canonicalPositiveInteger(invocationMatch[2]) ||
      (expectedProvenanceInvocation !== undefined &&
        (expectedProvenanceInvocation.runId !== invocationMatch[1] ||
          expectedProvenanceInvocation.runAttempt !== invocationMatch[2]))) {
    fail("alpha-publication-registry-attestations");
  }
  return Object.freeze({ runId: invocationMatch[1], runAttempt: invocationMatch[2] });
}

async function verifyDistTags(fetchImpl, entry) {
  const result = await getJson(fetchImpl, registryPackageUrl(entry), {
    code: "alpha-publication-registry-packument"
  });
  const tags = result.value?.["dist-tags"];
  if (!isPlainRecord(result.value) || result.value.name !== entry.name ||
      !isPlainRecord(tags) || tags.alpha !== entry.version ||
      Object.hasOwn(tags, "latest")) {
    fail("alpha-publication-registry-dist-tags");
  }
}

async function lookupRegistryVersion(fetchImpl, entry) {
  const result = await getJson(fetchImpl, registryVersionUrl(entry), {
    code: "alpha-publication-registry-version",
    allowedStatuses: [200, 404]
  });
  return result.status === 404
    ? Object.freeze({ state: "absent" })
    : Object.freeze({ state: "present", metadata: result.value });
}

async function preflightAbsentRegistryPackage(fetchImpl, entry) {
  const result = await getJson(fetchImpl, registryPackageUrl(entry), {
    code: "alpha-publication-registry-preflight",
    allowedStatuses: [200, 404]
  });
  if (result.status === 404) return;
  const tags = result.value?.["dist-tags"];
  if (!isPlainRecord(result.value) || result.value.name !== entry.name ||
      !isPlainRecord(tags) || Object.hasOwn(tags, "latest") ||
      Object.hasOwn(tags, ALPHA_PUBLICATION.tag)) {
    fail("alpha-publication-registry-preflight");
  }
}

export async function verifyAlphaRegistryPackage({
  entry,
  reviewedBytes,
  metadata,
  headCommitOid,
  repositoryOwnerId,
  expectedProvenanceInvocation,
  verifyProvenanceBundle,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!isPlainRecord(entry) || !Buffer.isBuffer(reviewedBytes) ||
      reviewedBytes.length < 1 || reviewedBytes.length > MAX_BYTES ||
      typeof fetchImpl !== "function" ||
      !canonicalPositiveInteger(repositoryOwnerId) ||
      typeof verifyProvenanceBundle !== "function" ||
      (expectedProvenanceInvocation !== undefined &&
        (!isPlainRecord(expectedProvenanceInvocation) ||
          !canonicalPositiveInteger(expectedProvenanceInvocation.runId) ||
          !canonicalPositiveInteger(expectedProvenanceInvocation.runAttempt)))) {
    fail("alpha-publication-registry-input");
  }
  const { expectedTarball, expectedAttestations } = assertRegistryMetadata(
    metadata,
    entry,
    reviewedBytes
  );
  const downloaded = await exactFetch(fetchImpl, expectedTarball, {
    code: "alpha-publication-registry-tarball",
    binary: true,
    headers: { accept: "application/octet-stream", "accept-encoding": "identity" }
  });
  if (!reviewedBytes.equals(downloaded.bytes)) {
    fail("alpha-publication-registry-tarball-mismatch");
  }
  const provenanceInvocation = await verifyAttestations(
    fetchImpl,
    entry,
    expectedAttestations,
    reviewedBytes,
    headCommitOid,
    repositoryOwnerId,
    expectedProvenanceInvocation,
    verifyProvenanceBundle
  );
  await verifyDistTags(fetchImpl, entry);
  return Object.freeze({
    packageId: entry.packageId,
    name: entry.name,
    version: entry.version,
    sha256: hash("sha256", reviewedBytes),
    sha512: hash("sha512", reviewedBytes),
    compressedBytes: reviewedBytes.length,
    provenance: SLSA_V1,
    provenanceInvocation,
    distTag: "alpha"
  });
}

export function createAlphaNpmPublishEnvironment(environment) {
  const retained = new Set([
    "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
    "ACTIONS_ID_TOKEN_REQUEST_URL",
    "CI",
    "GITHUB_ACTIONS",
    "GITHUB_EVENT_NAME",
    "GITHUB_REF",
    "GITHUB_REPOSITORY",
    "GITHUB_REPOSITORY_ID",
    "GITHUB_REPOSITORY_OWNER_ID",
    "GITHUB_RUN_ATTEMPT",
    "GITHUB_RUN_ID",
    "GITHUB_SERVER_URL",
    "GITHUB_SHA",
    "GITHUB_WORKFLOW_REF",
    "HOME",
    "NPM_CONFIG_USERCONFIG",
    "PATH",
    "RUNNER_ENVIRONMENT",
    "RUNNER_TEMP",
    "TMP",
    "TMPDIR",
    "TEMP"
  ]);
  const result = Object.fromEntries(Object.entries(environment)
    .filter(([key]) => retained.has(key)));
  return {
    ...result,
    NODE_AUTH_TOKEN: environment.NODE_AUTH_TOKEN,
    NPM_CONFIG_ACCESS: ALPHA_PUBLICATION.access,
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_IGNORE_SCRIPTS: "true",
    NPM_CONFIG_LOGLEVEL: "error",
    NPM_CONFIG_PROVENANCE: "true",
    NPM_CONFIG_REGISTRY: ALPHA_PUBLICATION.registry,
    NPM_CONFIG_TAG: ALPHA_PUBLICATION.tag,
    NPM_CONFIG_UPDATE_NOTIFIER: "false"
  };
}

async function resolveFixedNpmCli() {
  if (process.versions.node !== ALPHA_FIXED_BUILDER.nodeVersion) {
    fail("alpha-publication-node-version");
  }
  const candidates = process.platform === "win32"
    ? [path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js")]
    : [path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js")];
  for (const candidate of candidates) {
    try {
      const resolved = await realpath(candidate);
      const metadata = await lstat(resolved);
      if (resolved === candidate && metadata.isFile() && !metadata.isSymbolicLink()) {
        return resolved;
      }
    } catch {
      // Keep the fixed candidate set closed.
    }
  }
  fail("alpha-publication-npm-cli");
}

export async function resolveAlphaFixedPublicationRuntime() {
  const npmCli = await resolveFixedNpmCli();
  const result = spawnSync(process.execPath, [npmCli, "--version"], {
    env: {},
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true
  });
  if (result.error !== undefined || result.signal !== null || result.status !== 0 ||
      result.stdout.trim() !== ALPHA_FIXED_BUILDER.npmVersion) {
    fail("alpha-publication-npm-version");
  }
  return Object.freeze({
    npmCli,
    nodeVersion: ALPHA_FIXED_BUILDER.nodeVersion,
    npmVersion: ALPHA_FIXED_BUILDER.npmVersion
  });
}

export async function createAlphaSigstoreBundleVerifier({
  runtime,
  cachePath
} = {}) {
  if (!isPlainRecord(runtime) || typeof runtime.npmCli !== "string" ||
      !path.isAbsolute(runtime.npmCli) ||
      runtime.nodeVersion !== ALPHA_FIXED_BUILDER.nodeVersion ||
      runtime.npmVersion !== ALPHA_FIXED_BUILDER.npmVersion ||
      typeof cachePath !== "string" || !path.isAbsolute(cachePath)) {
    fail("alpha-publication-sigstore-runtime");
  }
  const npmRoot = path.resolve(path.dirname(runtime.npmCli), "..");
  const expectedModulePath = path.join(
    npmRoot,
    "node_modules",
    "sigstore",
    "dist",
    "index.js"
  );
  const expectedPackagePath = path.join(
    npmRoot,
    "node_modules",
    "sigstore",
    "package.json"
  );
  try {
    const admittedPaths = [
      runtime.npmCli,
      expectedModulePath,
      expectedPackagePath
    ];
    for (const admittedPath of admittedPaths) {
      const [canonical, metadata] = await Promise.all([
        realpath(admittedPath),
        lstat(admittedPath)
      ]);
      if (canonical !== admittedPath || !metadata.isFile() ||
          metadata.isSymbolicLink()) {
        fail("alpha-publication-sigstore-runtime");
      }
    }
    const [canonicalCache, cacheMetadata] = await Promise.all([
      realpath(cachePath),
      lstat(cachePath)
    ]);
    if (canonicalCache !== cachePath || !cacheMetadata.isDirectory() ||
        cacheMetadata.isSymbolicLink() ||
        (process.platform !== "win32" && (cacheMetadata.mode & 0o777) !== 0o700)) {
      fail("alpha-publication-sigstore-cache");
    }
    const packageManifest = parseJson(
      await stableRead(expectedPackagePath, 64 * 1024),
      "alpha-publication-sigstore-runtime"
    );
    if (!isPlainRecord(packageManifest) || packageManifest.name !== "sigstore" ||
        packageManifest.version !== SIGSTORE_VERSION ||
        packageManifest.main !== "dist/index.js") {
      fail("alpha-publication-sigstore-runtime");
    }
    const npmRequire = createRequire(runtime.npmCli);
    if (npmRequire.resolve("sigstore") !== expectedModulePath ||
        npmRequire.resolve("sigstore/package.json") !== expectedPackagePath) {
      fail("alpha-publication-sigstore-runtime");
    }
    const sigstore = npmRequire(expectedModulePath);
    if (!isPlainRecord(sigstore) || typeof sigstore.createVerifier !== "function") {
      fail("alpha-publication-sigstore-runtime");
    }
    const verifier = await sigstore.createVerifier({
      certificateIdentityURI: SIGSTORE_CERTIFICATE_IDENTITY_PATTERN,
      certificateIssuer: SIGSTORE_CERTIFICATE_ISSUER,
      ctLogThreshold: 1,
      tlogThreshold: 1,
      tufCachePath: cachePath,
      tufForceCache: true,
      timeout: REQUEST_TIMEOUT_MS,
      retry: { retries: 2 }
    });
    if (!isPlainRecord(verifier) || typeof verifier.verify !== "function") {
      fail("alpha-publication-sigstore-runtime");
    }
    return async (bundle) => {
      let signer;
      try {
        signer = await verifier.verify(bundle);
      } catch {
        fail("alpha-publication-registry-attestations");
      }
      const identity = signer?.identity;
      if (!isPlainRecord(identity) ||
          identity.subjectAlternativeName !== SIGSTORE_CERTIFICATE_IDENTITY ||
          !isPlainRecord(identity.extensions) ||
          identity.extensions.issuer !== SIGSTORE_CERTIFICATE_ISSUER) {
        fail("alpha-publication-registry-attestations");
      }
      return true;
    };
  } catch (error) {
    if (error?.message === "alpha-publication-registry-attestations" ||
        error?.message === "alpha-publication-sigstore-cache" ||
        error?.message === "alpha-publication-sigstore-runtime") {
      throw error;
    }
    fail("alpha-publication-sigstore-runtime");
  }
}

export async function withAlphaSigstoreBundleVerifier({ runtime, callback }) {
  if (typeof callback !== "function") fail("alpha-publication-sigstore-runtime");
  const temporaryRoot = await realpath(os.tmpdir());
  const cachePath = await mkdtemp(path.join(
    temporaryRoot,
    "pptx-compiler-alpha-sigstore."
  ));
  try {
    await chmod(cachePath, 0o700);
    const verifyProvenanceBundle = await createAlphaSigstoreBundleVerifier({
      runtime,
      cachePath
    });
    return await callback(verifyProvenanceBundle);
  } finally {
    await rm(cachePath, { recursive: true, force: true });
  }
}

function runNpmCommand(arguments_, { cwd, environment, code }) {
  const result = spawnSync(process.execPath, arguments_, {
    cwd,
    env: environment,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: NPM_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
    windowsHide: true
  });
  if (result.error !== undefined || result.signal !== null || result.status !== 0) {
    fail(code);
  }
}

export async function withMaterializedAlphaTarball({
  entry,
  reviewedBytes,
  callback
} = {}) {
  if (!isPlainRecord(entry) || typeof entry.tarball !== "string" ||
      path.basename(entry.tarball) !== entry.tarball ||
      !Buffer.isBuffer(reviewedBytes) || reviewedBytes.length < 1 ||
      reviewedBytes.length > MAX_BYTES || typeof callback !== "function") {
    fail("alpha-publication-materialization-input");
  }
  const temporaryRoot = await realpath(os.tmpdir());
  const directory = await mkdtemp(path.join(
    temporaryRoot,
    "pptx-compiler-alpha-publish."
  ));
  const tarballPath = path.join(directory, entry.tarball);
  let tarballCreated = false;
  try {
    await chmod(directory, 0o700);
    const directoryMetadata = await lstat(directory);
    if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink() ||
        await realpath(directory) !== directory ||
        (process.platform !== "win32" && (directoryMetadata.mode & 0o777) !== 0o700)) {
      fail("alpha-publication-materialization-directory");
    }
    let handle;
    try {
      handle = await open(
        tarballPath,
        fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL |
          (fsConstants.O_NOFOLLOW ?? 0),
        0o400
      );
      tarballCreated = true;
      await handle.writeFile(reviewedBytes);
      await handle.chmod(0o444);
      await handle.sync();
    } catch (error) {
      if (error?.message?.startsWith?.("alpha-publication-")) throw error;
      fail("alpha-publication-materialization-write");
    } finally {
      await handle?.close().catch(() => {});
    }
    const metadata = await lstat(tarballPath);
    const materialized = await stableRead(tarballPath);
    if (!metadata.isFile() || metadata.isSymbolicLink() ||
        (process.platform !== "win32" && (metadata.mode & 0o777) !== 0o444) ||
        !materialized.equals(reviewedBytes)) {
      fail("alpha-publication-materialization-bytes");
    }
    const result = await callback(tarballPath);
    if (!(await stableRead(tarballPath)).equals(reviewedBytes)) {
      fail("alpha-publication-materialization-changed");
    }
    return result;
  } finally {
    if (tarballCreated) await unlink(tarballPath).catch(() => {});
    await rmdir(directory).catch(() => {});
  }
}

async function publishWithFixedNpm({ root, entry, reviewedBytes, environment, runtime }) {
  return withMaterializedAlphaTarball({
    entry,
    reviewedBytes,
    callback: async (tarballPath) => {
      runNpmCommand([
        runtime.npmCli,
        "publish",
        tarballPath,
        "--tag",
        ALPHA_PUBLICATION.tag,
        "--access",
        ALPHA_PUBLICATION.access,
        "--provenance",
        "--registry",
        ALPHA_PUBLICATION.registry,
        "--ignore-scripts",
        "--json"
      ], {
        cwd: root,
        environment: createAlphaNpmPublishEnvironment(environment),
        code: "alpha-publication-npm-publish"
      });
    }
  });
}

function readOnlyNpmEnvironment(environment, auditRoot) {
  const retained = new Set([
    "CI", "HOME", "PATH", "RUNNER_TEMP", "SYSTEMROOT", "TEMP", "TMP", "TMPDIR"
  ]);
  return {
    ...Object.fromEntries(Object.entries(environment).filter(([key]) => retained.has(key))),
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_CACHE: path.join(auditRoot, "cache"),
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_IGNORE_SCRIPTS: "true",
    NPM_CONFIG_LOGLEVEL: "error",
    NPM_CONFIG_REGISTRY: ALPHA_PUBLICATION.registry,
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    NPM_CONFIG_USERCONFIG: path.join(auditRoot, ".npmrc")
  };
}

export async function auditAlphaRegistrySignatures({
  publicationOrder,
  environment,
  runtime
}) {
  if (!Array.isArray(publicationOrder) || publicationOrder.length < 1 ||
      publicationOrder.length > EXPECTED_ORDER.length ||
      publicationOrder.some((entry, index) => !isPlainRecord(entry) ||
        entry.packageId !== EXPECTED_ORDER[index] ||
        typeof entry.name !== "string" || typeof entry.version !== "string") ||
      typeof runtime?.npmCli !== "string") {
    fail("alpha-publication-signature-audit");
  }
  const auditRoot = await mkdtemp(path.join(os.tmpdir(), "pptx-compiler-alpha-audit."));
  try {
    const dependencies = Object.fromEntries(publicationOrder.map((entry) => [
      entry.name,
      entry.version
    ]));
    await Promise.all([
      writeFile(path.join(auditRoot, "package.json"), `${JSON.stringify({
        name: "pptx-compiler-alpha-signature-audit",
        version: "0.0.0",
        private: true,
        dependencies
      }, null, 2)}\n`, { flag: "wx", mode: 0o600 }),
      writeFile(path.join(auditRoot, ".npmrc"),
        `registry=${ALPHA_PUBLICATION.registry}\nignore-scripts=true\n`,
        { flag: "wx", mode: 0o600 })
    ]);
    const cleanEnvironment = readOnlyNpmEnvironment(environment, auditRoot);
    runNpmCommand([
      runtime.npmCli,
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--registry",
      ALPHA_PUBLICATION.registry
    ], {
      cwd: auditRoot,
      environment: cleanEnvironment,
      code: "alpha-publication-signature-install"
    });
    runNpmCommand([
      runtime.npmCli,
      "audit",
      "signatures",
      "--registry",
      ALPHA_PUBLICATION.registry
    ], {
      cwd: auditRoot,
      environment: cleanEnvironment,
      code: "alpha-publication-signature-audit"
    });
  } finally {
    await rm(auditRoot, { recursive: true, force: true });
  }
  return true;
}

export async function executeAlphaRegistryPublication({
  prepared,
  environment,
  fetchImpl = globalThis.fetch,
  publishTarball = publishWithFixedNpm,
  auditRegistry = auditAlphaRegistrySignatures,
  beforePublish = async () => {},
  verifyProvenanceBundle = undefined,
  runtime = undefined
} = {}) {
  if (!isPlainRecord(prepared) || !Array.isArray(prepared.publicationOrder) ||
      !(prepared.tarballBytes instanceof Map) ||
      !canonicalPositiveInteger(prepared.repositoryOwnerId) ||
      !canonicalPositiveInteger(prepared.provenanceRunId) ||
      !canonicalPositiveInteger(prepared.provenanceRunAttempt) ||
      typeof fetchImpl !== "function" || typeof publishTarball !== "function" ||
      typeof auditRegistry !== "function" || typeof beforePublish !== "function") {
    fail("alpha-publication-state");
  }
  if (verifyProvenanceBundle === undefined) {
    return withAlphaSigstoreBundleVerifier({
      runtime,
      callback: (verifier) => executeAlphaRegistryPublication({
        prepared,
        environment,
        fetchImpl,
        publishTarball,
        auditRegistry,
        beforePublish,
        verifyProvenanceBundle: verifier,
        runtime
      })
    });
  }
  if (typeof verifyProvenanceBundle !== "function") {
    fail("alpha-publication-state");
  }
  if (prepared.publicationOrder.some((entry, index) =>
    entry.packageId !== EXPECTED_ORDER[index])) {
    fail("alpha-publication-order");
  }

  // Read and validate the complete registry state before the first irreversible
  // write. A recoverable prior attempt can only have published an exact prefix
  // of the dependency order; a later package without its predecessor is
  // foreign state, not a recovery case.
  const admissions = [];
  let absentSeen = false;
  for (const entry of prepared.publicationOrder) {
    const reviewedBytes = prepared.tarballBytes.get(entry.packageId);
    if (!Buffer.isBuffer(reviewedBytes)) fail("alpha-publication-state");
    const state = await lookupRegistryVersion(fetchImpl, entry);
    if (state.state === "absent") {
      absentSeen = true;
      await preflightAbsentRegistryPackage(fetchImpl, entry);
      admissions.push(Object.freeze({ state: "absent" }));
      continue;
    }
    if (absentSeen) fail("alpha-publication-recovery-order");
    await verifyAlphaRegistryPackage({
      entry,
      reviewedBytes,
      metadata: state.metadata,
      headCommitOid: prepared.releaseTag?.headCommitOid,
      repositoryOwnerId: prepared.repositoryOwnerId,
      verifyProvenanceBundle,
      fetchImpl
    });
    admissions.push(Object.freeze({ state: "present" }));
  }
  const admittedPrefixLength = admissions.findIndex(({ state }) => state === "absent");
  const presentPrefixLength = admittedPrefixLength === -1
    ? admissions.length
    : admittedPrefixLength;
  if (presentPrefixLength > 0) {
    await auditRegistry({
      publicationOrder: prepared.publicationOrder.slice(0, presentPrefixLength),
      environment,
      runtime
    });
  }

  const actions = [];
  for (let index = 0; index < prepared.publicationOrder.length; index += 1) {
    const entry = prepared.publicationOrder[index];
    const reviewedBytes = prepared.tarballBytes.get(entry.packageId);
    if (!Buffer.isBuffer(reviewedBytes)) {
      fail("alpha-publication-state");
    }
    const initial = await lookupRegistryVersion(fetchImpl, entry);
    if (admissions[index].state === "present" && initial.state !== "present") {
      fail("alpha-publication-registry-moved");
    }
    let action = "present-equal";
    let metadata = initial.metadata;
    if (initial.state === "absent") {
      await beforePublish(entry);
      const immediate = await lookupRegistryVersion(fetchImpl, entry);
      if (immediate.state === "present") {
        metadata = immediate.metadata;
      } else {
        await preflightAbsentRegistryPackage(fetchImpl, entry);
        await publishTarball({
          root: prepared.root,
          entry,
          reviewedBytes,
          environment,
          runtime
        });
        action = "published";
        const reread = await lookupRegistryVersion(fetchImpl, entry);
        if (reread.state !== "present") fail("alpha-publication-registry-after-publish");
        metadata = reread.metadata;
      }
    }
    const verified = await verifyAlphaRegistryPackage({
      entry,
      reviewedBytes,
      metadata,
      headCommitOid: prepared.releaseTag?.headCommitOid,
      repositoryOwnerId: prepared.repositoryOwnerId,
      expectedProvenanceInvocation: action === "published"
        ? {
            runId: prepared.provenanceRunId,
            runAttempt: prepared.provenanceRunAttempt
          }
        : undefined,
      verifyProvenanceBundle,
      fetchImpl
    });
    actions.push(Object.freeze({ ...verified, action }));
    if (action === "published" || admissions[index].state === "absent") {
      await auditRegistry({
        publicationOrder: prepared.publicationOrder.slice(0, index + 1),
        environment,
        runtime
      });
    }
  }

  const finalVerification = [];
  const publishedPackageIds = new Set(actions
    .filter((entry) => entry.action === "published")
    .map((entry) => entry.packageId));
  for (const entry of prepared.publicationOrder) {
    const state = await lookupRegistryVersion(fetchImpl, entry);
    if (state.state !== "present") fail("alpha-publication-final-reread");
    finalVerification.push(await verifyAlphaRegistryPackage({
      entry,
      reviewedBytes: prepared.tarballBytes.get(entry.packageId),
      metadata: state.metadata,
      headCommitOid: prepared.releaseTag?.headCommitOid,
      repositoryOwnerId: prepared.repositoryOwnerId,
      expectedProvenanceInvocation: publishedPackageIds.has(entry.packageId)
        ? {
            runId: prepared.provenanceRunId,
            runAttempt: prepared.provenanceRunAttempt
          }
        : undefined,
      verifyProvenanceBundle,
      fetchImpl
    }));
  }
  await auditRegistry({
    publicationOrder: prepared.publicationOrder,
    environment,
    runtime
  });
  return Object.freeze({
    schemaVersion: 1,
    operation: "alpha-npm-publication",
    ok: true,
    releaseVersion: prepared.packagePlan?.packageVersion ??
      prepared.publicationOrder[0]?.version,
    tagName: ALPHA_RELEASE_TAG_NAME,
    packages: Object.freeze(actions),
    finalRegistryVerification: Object.freeze(finalVerification),
    githubReleaseCreated: false
  });
}

export async function runAlphaPublication({
  argv,
  environment = process.env,
  root = alphaReleaseRepositoryRoot(),
  dependencies = {}
} = {}) {
  const options = parseAlphaPublicationArguments(argv);
  const sourceToken = options.mode === "verify-source"
    ? requireModeCredentials(options.mode, environment)
    : (rejectPublishSourceCredentials(environment), undefined);
  const prepare = dependencies.prepareRelease ?? prepareAlphaRelease;
  const prepared = await prepare({
    root,
    environment,
    tagName: options.tagName,
    stageRelative: options.stageRoot
  });
  if (options.mode === "verify-source") {
    const verifySource = dependencies.verifySource ?? verifyAlphaGitHubSource;
    const verified = await verifySource({
      headCommitOid: prepared.releaseTag.headCommitOid,
      tagObjectOid: prepared.releaseTag.tagObjectOid,
      token: sourceToken,
      fetchImpl: dependencies.fetch ?? globalThis.fetch
    });
    const finalizeCandidate = dependencies.finalizeCandidate ??
      finalizeAlphaVerifiedCandidate;
    await finalizeCandidate(prepared, verified);
    return Object.freeze({
      schemaVersion: 1,
      operation: "alpha-source-verification",
      ok: true,
      tagName: options.tagName,
      repositoryId: verified.repositoryId,
      commitOid: verified.commitOid,
      mainTipCommitOid: verified.mainTipCommitOid,
      tagTargetRelationToMain: verified.tagTargetRelationToMain,
      verified: true,
      verificationReason: "valid",
      workflowRuns: verified.workflowRuns
    });
  }

  const verifySource = dependencies.verifySource ?? verifyAlphaGitHubSource;
  const verified = await verifySource({
    headCommitOid: prepared.releaseTag.headCommitOid,
    tagObjectOid: prepared.releaseTag.tagObjectOid,
    fetchImpl: dependencies.fetch ?? globalThis.fetch
  });
  const finalizeCandidate = dependencies.finalizeCandidate ??
    finalizeAlphaVerifiedCandidate;
  await finalizeCandidate(prepared, verified);
  const provenanceEnvironment = validateAlphaNpmProvenanceEnvironment({
    environment,
    headCommitOid: prepared.releaseTag.headCommitOid,
    repositoryOwnerId: verified.repositoryOwnerId
  });
  requireModeCredentials("publish", environment);

  const assertRuntime = dependencies.assertRuntime ?? resolveAlphaFixedPublicationRuntime;
  const runtime = await assertRuntime();
  const executePublication = dependencies.executePublication ?? executeAlphaRegistryPublication;
  const fetchImpl = dependencies.fetch ?? globalThis.fetch;
  const assertSameSource = (actual, expected) => {
    const stableKeys = [
      "repositoryId",
      "repositoryOwnerId",
      "repository",
      "defaultBranch",
      "mainTipCommitOid",
      "tagTargetRelationToMain",
      "commitOid",
      "tagObjectOid",
      "verified",
      "verificationReason"
    ];
    if (stableKeys.some((key) => actual[key] !== expected[key])) {
      fail("alpha-publication-github-source-moved");
    }
  };
  const result = await executePublication({
    prepared: Object.freeze({
      ...prepared,
      repositoryOwnerId: verified.repositoryOwnerId,
      provenanceRunId: provenanceEnvironment.runId,
      provenanceRunAttempt: provenanceEnvironment.runAttempt
    }),
    environment,
    fetchImpl,
    publishTarball: dependencies.publishTarball ?? publishWithFixedNpm,
    auditRegistry: dependencies.auditRegistry ?? auditAlphaRegistrySignatures,
    beforePublish: async () => {
      const verifyMutableSource = dependencies.verifyMutableSource ??
        verifyMutableAlphaGitHubSource;
      const current = await verifyMutableSource({ expected: verified, fetchImpl });
      assertSameSource(current, verified);
    },
    runtime
  });
  const verifyMutableSource = dependencies.verifyMutableSource ??
    verifyMutableAlphaGitHubSource;
  const finalVerified = await verifyMutableSource({ expected: verified, fetchImpl });
  assertSameSource(finalVerified, verified);
  return result;
}

function publicFailure(error) {
  const code = typeof error?.message === "string" &&
    /^alpha-publication-[a-z0-9-]+$/u.test(error.message)
    ? error.message
    : "alpha-publication-failed";
  return Object.freeze({
    schemaVersion: 1,
    gate: "alpha-release-publication",
    ok: false,
    findings: Object.freeze([Object.freeze({ code, pointer: "" })])
  });
}

const isMain = process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const result = await runAlphaPublication({ argv: process.argv.slice(2) });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(publicFailure(error))}\n`);
    process.exitCode = error?.message === "alpha-publication-usage" ? 2 : 1;
  }
}
