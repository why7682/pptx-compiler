#!/usr/bin/env node

import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALPHA_RELEASE_TAG_NAME,
  alphaReleaseRepositoryRoot,
  renderAlphaGitHubReleaseBody
} from "./lib/alpha-release.mjs";
import { ALPHA_PUBLICATION, ALPHA_REPOSITORY } from "./lib/package-plan.mjs";
import {
  auditAlphaRegistrySignatures,
  finalizeAlphaVerifiedCandidate,
  prepareAlphaRelease,
  resolveAlphaFixedPublicationRuntime,
  verifyAlphaGitHubSource,
  verifyAlphaPredecessorCore,
  verifyAlphaRegistryPackage,
  withAlphaSigstoreBundleVerifier
} from "./publish-alpha-release.mjs";

const STAGE_ROOT = ".package-stage/reviewed";
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const TOKEN = /^[!-~]{1,16384}$/u;
const EXACT_ARGUMENTS = Object.freeze([
  "--tag", ALPHA_RELEASE_TAG_NAME,
  "--stage-root", STAGE_ROOT
]);

function fail(code) {
  throw new Error(code);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validEnvironment(environment) {
  return environment !== null && typeof environment === "object" &&
    !Array.isArray(environment) && Reflect.ownKeys(environment)
      .every((key) => typeof key === "string");
}

function validToken(value) {
  return typeof value === "string" && TOKEN.test(value);
}

export function parseAlphaGitHubReleaseArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== EXACT_ARGUMENTS.length ||
      argv.some((value, index) => value !== EXACT_ARGUMENTS[index])) {
    fail("alpha-github-release-usage");
  }
  return Object.freeze({ tagName: ALPHA_RELEASE_TAG_NAME, stageRoot: STAGE_ROOT });
}

function requireDeclarationCredentials(environment) {
  const forbidden = [
    "NODE_AUTH_TOKEN",
    "NPM_TOKEN",
    "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
    "ACTIONS_ID_TOKEN_REQUEST_URL"
  ];
  if (!validEnvironment(environment) || !validToken(environment.GITHUB_TOKEN) ||
      Object.hasOwn(environment, "GH_TOKEN") ||
      forbidden.some((key) => Object.hasOwn(environment, key)) ||
      environment.GITHUB_ACTIONS !== "true" ||
      environment.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      environment.GITHUB_REF !== `refs/tags/${ALPHA_RELEASE_TAG_NAME}` ||
      environment.GITHUB_REPOSITORY !==
        `${ALPHA_REPOSITORY.owner}/${ALPHA_REPOSITORY.name}`) {
    fail("alpha-github-release-credentials");
  }
  return environment.GITHUB_TOKEN;
}

function githubHeaders(token) {
  return Object.freeze({
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "pptx-compiler-alpha-release",
    "x-github-api-version": "2022-11-28"
  });
}

async function readResponse(response, code) {
  if (response === null || typeof response !== "object" ||
      !Number.isInteger(response.status)) fail(code);
  const lengthText = response.headers?.get?.("content-length");
  if (lengthText !== null && lengthText !== undefined &&
      (!/^(?:0|[1-9][0-9]*)$/u.test(lengthText) ||
       Number(lengthText) > MAX_RESPONSE_BYTES)) fail(code);
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
      if (total > MAX_RESPONSE_BYTES) fail(code);
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total);
}

async function requestJson(fetchImpl, url, {
  method = "GET",
  token,
  body,
  allowedStatuses,
  code
}) {
  if (typeof fetchImpl !== "function" || !validToken(token) ||
      !Array.isArray(allowedStatuses)) fail(code);
  let response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: githubHeaders(token),
      ...(body === undefined ? {} : { body }),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch {
    fail(code);
  }
  if (typeof response.url === "string" && response.url !== "" &&
      response.url !== url) fail(code);
  if (!allowedStatuses.includes(response.status)) {
    await response.body?.cancel?.().catch?.(() => {});
    fail(code);
  }
  if (response.status === 404 && response.body === null) {
    return Object.freeze({ status: response.status });
  }
  const bytes = await readResponse(response, code);
  if (bytes.length === 0) return Object.freeze({ status: response.status });
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true
    }).decode(bytes));
  } catch {
    fail(code);
  }
  return Object.freeze({ status: response.status, value });
}

function releaseUrl() {
  return `https://api.github.com/repos/${ALPHA_REPOSITORY.owner}/` +
    `${ALPHA_REPOSITORY.name}/releases/tags/` +
    encodeURIComponent(ALPHA_RELEASE_TAG_NAME);
}

function createUrl() {
  return `https://api.github.com/repos/${ALPHA_REPOSITORY.owner}/` +
    `${ALPHA_REPOSITORY.name}/releases`;
}

export function alphaGitHubReleaseRequest({ prepared, body } = {}) {
  const contract = prepared?.releasePlan?.githubRelease;
  const target = prepared?.releaseTag?.headCommitOid;
  if (!isPlainRecord(contract) || typeof body !== "string" || body.length < 1 ||
      body.length > MAX_RESPONSE_BYTES || !/^[a-f0-9]{40}$/u.test(target)) {
    fail("alpha-github-release-request");
  }
  return Object.freeze({
    tag_name: ALPHA_RELEASE_TAG_NAME,
    target_commitish: target,
    name: contract.name,
    body,
    draft: false,
    prerelease: true,
    generate_release_notes: false,
    make_latest: "false"
  });
}

function exactRelease(value, expected) {
  // GitHub documents target_commitish as unused when tag_name already exists.
  // The surrounding full ref/tag-object/peel checks own target identity; this
  // response comparison owns the mutable Release projection only.
  return isPlainRecord(value) && Number.isSafeInteger(value.id) && value.id > 0 &&
    value.tag_name === expected.tag_name && value.name === expected.name &&
    value.body === expected.body && value.draft === false &&
    value.prerelease === true && value.immutable !== true &&
    Array.isArray(value.assets) && value.assets.length === 0 &&
    value.html_url === `${ALPHA_REPOSITORY.htmlUrl}/releases/tag/` +
      encodeURIComponent(ALPHA_RELEASE_TAG_NAME);
}

export async function createOrVerifyAlphaGitHubRelease({
  prepared,
  body,
  token,
  beforeCreate = async () => {},
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof beforeCreate !== "function") fail("alpha-github-release-request");
  const request = alphaGitHubReleaseRequest({ prepared, body });
  const encoded = JSON.stringify(request);
  const initial = await requestJson(fetchImpl, releaseUrl(), {
    token,
    code: "alpha-github-release-read",
    allowedStatuses: [200, 404]
  });
  let action = "present-exact";
  let observed = initial.status === 200 ? initial.value : undefined;
  if (initial.status === 404) {
    action = "created";
    await beforeCreate();
    const created = await requestJson(fetchImpl, createUrl(), {
      method: "POST",
      token,
      body: encoded,
      code: "alpha-github-release-create",
      allowedStatuses: [201, 422]
    });
    if (created.status === 201) {
      if (!exactRelease(created.value, request)) fail("alpha-github-release-mismatch");
      observed = created.value;
    } else {
      action = "race-exact";
    }
  }
  const reread = await verifyExactAlphaGitHubRelease({
    prepared,
    body,
    token,
    fetchImpl
  });
  if (observed !== undefined && !exactRelease(observed, request)) {
    fail("alpha-github-release-mismatch");
  }
  return Object.freeze({ action, releaseId: reread.releaseId, request });
}

export async function verifyExactAlphaGitHubRelease({
  prepared,
  body,
  token,
  fetchImpl = globalThis.fetch
} = {}) {
  const request = alphaGitHubReleaseRequest({ prepared, body });
  const reread = await requestJson(fetchImpl, releaseUrl(), {
    token,
    code: "alpha-github-release-reread",
    allowedStatuses: [200]
  });
  if (!exactRelease(reread.value, request)) {
    fail("alpha-github-release-mismatch");
  }
  return Object.freeze({ releaseId: reread.value.id, request });
}

export async function verifyCompleteRegistry({
  prepared,
  runtime,
  environment,
  fetchImpl,
  dependencies = {}
}) {
  const withVerifier = dependencies.withVerifier ?? withAlphaSigstoreBundleVerifier;
  const verifyPredecessor = dependencies.verifyPredecessor ??
    verifyAlphaPredecessorCore;
  const verifyPackage = dependencies.verifyPackage ?? verifyAlphaRegistryPackage;
  const auditRegistry = dependencies.auditRegistry ?? auditAlphaRegistrySignatures;
  return withVerifier({
    runtime,
    callback: (verifyProvenanceBundle) => withVerifier({
      runtime,
      tagName: prepared.releasePlan.predecessorRelease.tagName,
      callback: async (verifyPredecessorBundle) => {
        await verifyPredecessor({
          prepared,
          currentVersionPresent: true,
          fetchImpl,
          verifyPredecessorBundle,
          environment,
          runtime
        });
        const packages = [];
        for (const entry of prepared.publicationOrder) {
          const versionUrl = new URL(
            `${encodeURIComponent(entry.name)}/${encodeURIComponent(entry.version)}`,
            ALPHA_PUBLICATION.registry
          ).href;
          let metadataResponse;
          try {
            metadataResponse = await fetchImpl(versionUrl, {
              method: "GET",
              redirect: "manual",
              cache: "no-store",
              signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
            });
          } catch {
            fail("alpha-github-release-registry-version");
          }
          if (metadataResponse.status !== 200) {
            fail("alpha-github-release-registry-version");
          }
          const metadataBytes = await readResponse(
            metadataResponse,
            "alpha-github-release-registry-version"
          );
          let metadata;
          try {
            metadata = JSON.parse(metadataBytes.toString("utf8"));
          } catch {
            fail("alpha-github-release-registry-version");
          }
          packages.push(await verifyPackage({
            entry,
            reviewedBytes: prepared.tarballBytes.get(entry.packageId),
            metadata,
            headCommitOid: prepared.releaseTag.headCommitOid,
            repositoryOwnerId: prepared.repositoryOwnerId,
            verifyProvenanceBundle,
            fetchImpl
          }));
        }
        await auditRegistry({
          publicationOrder: prepared.publicationOrder,
          environment,
          runtime
        });
        return Object.freeze(packages);
      }
    })
  });
}

export async function runAlphaGitHubRelease({
  argv,
  environment = process.env,
  root = alphaReleaseRepositoryRoot(),
  dependencies = {}
} = {}) {
  const options = parseAlphaGitHubReleaseArguments(argv);
  const token = requireDeclarationCredentials(environment);
  const prepare = dependencies.prepareRelease ?? prepareAlphaRelease;
  const preparedBase = await prepare({
    root,
    environment,
    tagName: options.tagName,
    stageRelative: options.stageRoot
  });
  const verifySource = dependencies.verifySource ?? verifyAlphaGitHubSource;
  const fetchImpl = dependencies.fetch ?? globalThis.fetch;
  const source = await verifySource({
    headCommitOid: preparedBase.releaseTag.headCommitOid,
    tagObjectOid: preparedBase.releaseTag.tagObjectOid,
    token,
    githubReleaseState: "ignore",
    fetchImpl
  });
  const prepared = Object.freeze({
    ...preparedBase,
    repositoryOwnerId: source.repositoryOwnerId
  });
  (dependencies.finalizeCandidate ?? finalizeAlphaVerifiedCandidate)(prepared, source);
  const noteBytes = prepared.lockedInputBytes.get(
    prepared.releasePlan.githubRelease.bodySource
  );
  const renderBody = dependencies.renderBody ?? renderAlphaGitHubReleaseBody;
  const body = renderBody({
    releasePlan: prepared.releasePlan,
    packagePlan: prepared.packagePlan,
    releaseLock: prepared.releaseLock,
    predecessorReleaseLock: prepared.predecessorReleaseLock,
    inputBytes: prepared.lockedInputBytes,
    releaseNoteBytes: noteBytes,
    targetCommitOid: prepared.releaseTag.headCommitOid
  });
  const runtime = await (dependencies.resolveRuntime ??
    resolveAlphaFixedPublicationRuntime)();
  const verifyRegistry = dependencies.verifyRegistry ?? ((input) =>
    verifyCompleteRegistry({
      ...input,
      dependencies: dependencies.registryVerification
    }));
  const before = await verifyRegistry({
    prepared,
    runtime,
    environment,
    fetchImpl
  });
  const sameSource = (left, right) => [
    "repositoryId",
    "repositoryOwnerId",
    "commitOid",
    "tagObjectOid",
    "mainTipCommitOid"
  ].every((key) => left[key] === right[key]);
  const verifySameSource = async () => {
    const current = await verifySource({
      headCommitOid: prepared.releaseTag.headCommitOid,
      tagObjectOid: prepared.releaseTag.tagObjectOid,
      token,
      githubReleaseState: "ignore",
      fetchImpl
    });
    if (!sameSource(current, source)) fail("alpha-github-release-source-moved");
    return current;
  };
  await verifySameSource();
  const declare = dependencies.declareRelease ?? createOrVerifyAlphaGitHubRelease;
  const declared = await declare({
    prepared,
    body,
    token,
    beforeCreate: verifySameSource,
    fetchImpl
  });
  await verifySameSource();
  const after = await verifyRegistry({ prepared, runtime, environment, fetchImpl });
  if (createHash("sha256").update(JSON.stringify(before)).digest("hex") !==
      createHash("sha256").update(JSON.stringify(after)).digest("hex")) {
    fail("alpha-github-release-registry-moved");
  }
  const verifyDeclaredRelease = dependencies.verifyDeclaredRelease ??
    verifyExactAlphaGitHubRelease;
  const finalRelease = await verifyDeclaredRelease({
    prepared,
    body,
    token,
    fetchImpl
  });
  if (finalRelease.releaseId !== declared.releaseId) {
    fail("alpha-github-release-moved");
  }
  return Object.freeze({
    schemaVersion: 1,
    operation: "alpha-github-release",
    ok: true,
    tagName: ALPHA_RELEASE_TAG_NAME,
    releaseId: declared.releaseId,
    action: declared.action,
    packageCount: after.length,
    githubReleasePresent: true,
    githubReleaseCreated: declared.action === "created"
  });
}

function publicFailure(error) {
  const code = typeof error?.message === "string" &&
    /^alpha-github-release-[a-z0-9-]+$/u.test(error.message)
    ? error.message
    : "alpha-github-release-failed";
  return Object.freeze({
    schemaVersion: 1,
    gate: "alpha-github-release",
    ok: false,
    findings: Object.freeze([Object.freeze({ code, pointer: "" })])
  });
}

const isMain = process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const result = await runAlphaGitHubRelease({ argv: process.argv.slice(2) });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(publicFailure(error))}\n`);
    process.exitCode = error?.message === "alpha-github-release-usage" ? 2 : 1;
  }
}
