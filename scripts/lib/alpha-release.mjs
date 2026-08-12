import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath
} from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import {
  ALPHA_PACKAGE_PLAN_PATH,
  ALPHA_REPOSITORY,
  canonicalAlphaPackagePlanText,
  flattenPackageFiles,
  parseAlphaPackagePlanBytes
} from "./package-plan.mjs";
import { reviewedStageComplete } from "./package-stage.mjs";
import {
  ALPHA_TARBALL_LIMITS,
  alphaTarballFilename,
  inspectAlphaTarPayload,
  projectAlphaPackageFiles
} from "./package-tarball.mjs";
import {
  compileForbiddenMaterialPolicy,
  inspectForbiddenMaterialContent
} from "../check-forbidden-materials.mjs";

export const ALPHA_RELEASE_PLAN_VERSION = 2;
export const ALPHA_RELEASE_PLAN_PATH = "packaging/alpha-release-plan.json";
export const ALPHA_RELEASE_LOCK_PATH =
  "packaging/releases/0.1.0-alpha.1.lock.json";
export const ALPHA_RELEASE_TAG_NAME = "v0.1.0-alpha.1";
export const ALPHA_RELEASE_TAG_MESSAGE = "pptx-compiler 0.1.0-alpha.1";
export const ALPHA_FIXED_BUILDER = Object.freeze({
  nodeVersion: "24.19.0",
  npmVersion: "11.17.0"
});
export const ALPHA_VERIFICATION_BUILDER = Object.freeze({
  nodeVersion: "22.23.2",
  npmVersion: "10.9.8"
});

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const MAX_CONTROL_BYTES = 5 * 1024 * 1024;
const MAX_EVIDENCE_BYTES = 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/u;
const SHA512 = /^[a-f0-9]{128}$/u;
const GIT_OID = /^[a-f0-9]{40}$/u;
const FORBIDDEN_POLICY_PATH = "policy/forbidden-materials.json";
const MAX_RELEASE_HISTORY_COMMITS = 64;
const LOCKED_INPUTS = Object.freeze([
  "CHANGELOG.md",
  "docs/KNOWN_LIMITATIONS.md",
  "docs/releases/0.1.0-alpha.1.md",
  ALPHA_PACKAGE_PLAN_PATH,
  "policy/support-matrix.json",
  "sbom.alpha.cdx.json"
]);
const TOP_KEYS = Object.freeze([
  "schemaVersion",
  "planId",
  "releaseVersion",
  "packagePlanPath",
  "publicationSource",
  "authorizationSource",
  "releaseLockPath",
  "sourceTag",
  "builders",
  "lockedInputs",
  "recovery",
  "githubRelease"
]);
const LOCK_KEYS = Object.freeze([
  "schemaVersion",
  "lockType",
  "releaseVersion",
  "releasePlanSha256",
  "packagePlanSha256",
  "packageSourceProjectionSha256",
  "inputs",
  "builderResults"
]);
const BUILDER_RESULT_KEYS = Object.freeze([
  "nodeVersion",
  "npmVersion",
  "evidenceSha256",
  "evidenceBytes",
  "packages"
]);
const CANDIDATE_KEYS = Object.freeze([
  "schemaVersion",
  "candidateType",
  "tagName",
  "tagObjectType",
  "tagObjectOid",
  "tagTargetCommitOid",
  "headCommitOid",
  "tagTargetTreeOid",
  "headTreeOid",
  "targetCommitVerified",
  "worktreeClean",
  "shallowRepository",
  "replaceRefs",
  "grafts",
  "alternates",
  "releasePlanSha256",
  "packagePlanSha256",
  "releaseLockSha256"
]);

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactRecord(value, keys) {
  if (!isPlainRecord(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  const expected = new Set(keys);
  return ownKeys.length === keys.length && ownKeys.every((key) => {
    if (typeof key !== "string" || !expected.has(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
  });
}

function add(findings, code, pointer) {
  findings.push(Object.freeze({ code, pointer }));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha512(bytes) {
  return createHash("sha512").update(bytes).digest("hex");
}

function cleanGitEnvironment(environment) {
  if (environment === null || typeof environment !== "object" ||
      Array.isArray(environment) || Reflect.ownKeys(environment)
        .some((key) => typeof key !== "string") || Object.keys(environment)
    .some((key) => key.toUpperCase().startsWith("GIT_"))) {
    throw new Error("alpha-release-git-environment");
  }
  // Git for Windows accepts the Git path spelling here. Node's platform device
  // spelling (NUL) is not a safe Git config-file value for this boundary.
  const nullDevice = "/dev/null";
  return {
    ...environment,
    GIT_CONFIG: nullDevice,
    GIT_CONFIG_GLOBAL: nullDevice,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: nullDevice,
    GIT_NO_LAZY_FETCH: "1",
    GIT_TERMINAL_PROMPT: "0"
  };
}

function runGit(root, arguments_, environment, { maximumBytes = 1024 * 1024 } = {}) {
  const result = spawnSync("git", arguments_, {
    cwd: root,
    env: environment,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
    maxBuffer: maximumBytes,
    windowsHide: true
  });
  if (result.error !== undefined || result.signal !== null || result.status !== 0 ||
      typeof result.stdout !== "string" || typeof result.stderr !== "string" ||
      Buffer.byteLength(result.stdout) > maximumBytes ||
      Buffer.byteLength(result.stderr) > maximumBytes) {
    throw new Error("alpha-release-git-command");
  }
  return result.stdout;
}

function runGitBytes(root, arguments_, environment, {
  maximumBytes = 1024 * 1024
} = {}) {
  const result = spawnSync("git", arguments_, {
    cwd: root,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
    maxBuffer: maximumBytes,
    windowsHide: true
  });
  if (result.error !== undefined || result.signal !== null || result.status !== 0 ||
      !Buffer.isBuffer(result.stdout) || !Buffer.isBuffer(result.stderr) ||
      result.stdout.length > maximumBytes || result.stderr.length > maximumBytes) {
    throw new Error("alpha-release-git-command");
  }
  return result.stdout;
}

function canonicalGitTreePath(value) {
  return typeof value === "string" && value.length > 0 &&
    /^[A-Za-z0-9._/\[\]-]+$/u.test(value) && !value.startsWith("/") &&
    !value.includes("\\") && !value.split("/")
      .some((part) => part === "" || part === "." || part === "..") &&
    path.posix.normalize(value) === value;
}

function readGitTreeBlob(root, treeOid, relativePath, environment, {
  maximumBytes = MAX_CONTROL_BYTES,
  allowedModes = Object.freeze(["100644"])
} = {}) {
  if (!GIT_OID.test(treeOid) || !canonicalGitTreePath(relativePath) ||
      !Array.isArray(allowedModes) || allowedModes.length < 1 ||
      allowedModes.some((mode) => !["100644", "100755"].includes(mode))) {
    throw new Error("alpha-release-tree-file-input");
  }
  const listing = runGitBytes(root, [
    "--no-replace-objects", "ls-tree", "-z", treeOid, "--", relativePath
  ], environment, { maximumBytes: 4096 });
  const match = /^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/u.exec(
    listing.toString("utf8")
  );
  if (match === null || !allowedModes.includes(match[1]) || match[3] !== relativePath) {
    throw new Error("alpha-release-tree-file");
  }
  const bytes = runGitBytes(root, [
    "--no-replace-objects", "cat-file", "blob", match[2]
  ], environment, { maximumBytes });
  if (bytes.length < 1 || bytes.length > maximumBytes) {
    throw new Error("alpha-release-tree-file");
  }
  const objectHeader = Buffer.from(`blob ${bytes.length}\0`);
  const objectOid = createHash("sha1").update(objectHeader).update(bytes).digest("hex");
  if (objectOid !== match[2]) throw new Error("alpha-release-tree-object");
  return Object.freeze({
    bytes,
    mode: match[1]
  });
}

function readGitTreeFile(root, treeOid, relativePath, environment, options) {
  return readGitTreeBlob(
    root,
    treeOid,
    relativePath,
    environment,
    options
  ).bytes;
}

async function pathExists(value) {
  try {
    await lstat(value);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function byteValue(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array && value.byteLength === value.buffer.byteLength) {
    return Buffer.from(value.buffer.slice(0));
  }
  return null;
}

function canonicalReleasePlanValue(plan) {
  if (!isPlainRecord(plan)) return plan;
  return {
    schemaVersion: plan.schemaVersion,
    planId: plan.planId,
    releaseVersion: plan.releaseVersion,
    packagePlanPath: plan.packagePlanPath,
    publicationSource: plan.publicationSource,
    authorizationSource: plan.authorizationSource,
    releaseLockPath: plan.releaseLockPath,
    sourceTag: isPlainRecord(plan.sourceTag) ? {
      name: plan.sourceTag.name,
      type: plan.sourceTag.type,
      targetPolicy: plan.sourceTag.targetPolicy,
      message: plan.sourceTag.message
    } : plan.sourceTag,
    builders: isPlainRecord(plan.builders) ? {
      fixed: isPlainRecord(plan.builders.fixed) ? {
        nodeVersion: plan.builders.fixed.nodeVersion,
        npmVersion: plan.builders.fixed.npmVersion
      } : plan.builders.fixed,
      verification: isPlainRecord(plan.builders.verification) ? {
        nodeVersion: plan.builders.verification.nodeVersion,
        npmVersion: plan.builders.verification.npmVersion
      } : plan.builders.verification,
      digestEquality: plan.builders.digestEquality
    } : plan.builders,
    lockedInputs: plan.lockedInputs,
    recovery: isPlainRecord(plan.recovery) ? {
      absent: plan.recovery.absent,
      exact: plan.recovery.exact,
      mismatch: plan.recovery.mismatch,
      unpublish: plan.recovery.unpublish
    } : plan.recovery,
    githubRelease: isPlainRecord(plan.githubRelease) ? {
      order: plan.githubRelease.order,
      requiresCompleteRegistryVerification:
        plan.githubRelease.requiresCompleteRegistryVerification,
      name: plan.githubRelease.name,
      bodySource: plan.githubRelease.bodySource,
      bodyProjection: plan.githubRelease.bodyProjection,
      target: plan.githubRelease.target,
      draft: plan.githubRelease.draft,
      prerelease: plan.githubRelease.prerelease,
      makeLatest: plan.githubRelease.makeLatest,
      generateReleaseNotes: plan.githubRelease.generateReleaseNotes,
      assets: plan.githubRelease.assets,
      idempotency: plan.githubRelease.idempotency
    } : plan.githubRelease
  };
}

export function canonicalAlphaReleasePlanText(plan) {
  return `${JSON.stringify(canonicalReleasePlanValue(plan), null, 2)}\n`;
}

export function parseAlphaReleasePlanBytes(bytes) {
  const source = byteValue(bytes);
  if (source === null || source.length < 1 || source.length > MAX_CONTROL_BYTES) {
    throw new Error("alpha-release-plan-bytes");
  }
  let text;
  let plan;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(source);
    plan = JSON.parse(text);
  } catch {
    throw new Error("alpha-release-plan-json");
  }
  if (text !== canonicalAlphaReleasePlanText(plan)) {
    throw new Error("alpha-release-plan-canonical");
  }
  return plan;
}

export async function loadAlphaReleasePlan({ root = repositoryRoot } = {}) {
  return parseAlphaReleasePlanBytes(
    await readFile(path.join(root, ALPHA_RELEASE_PLAN_PATH))
  );
}

export function validateAlphaReleasePlan(plan, { packagePlan } = {}) {
  const findings = [];
  if (!exactRecord(plan, TOP_KEYS)) {
    add(findings, "release-plan-shape", "");
    return Object.freeze(findings);
  }
  if (plan.schemaVersion !== ALPHA_RELEASE_PLAN_VERSION ||
      plan.planId !== "pptx-compiler-alpha-release-plan") {
    add(findings, "release-plan-identity", "/planId");
  }
  if (!isPlainRecord(packagePlan) || plan.releaseVersion !== packagePlan.packageVersion ||
      plan.releaseVersion !== "0.1.0-alpha.1") {
    add(findings, "release-plan-version", "/releaseVersion");
  }
  if (plan.packagePlanPath !== ALPHA_PACKAGE_PLAN_PATH ||
      plan.publicationSource !== `${ALPHA_PACKAGE_PLAN_PATH}#/publication` ||
      plan.authorizationSource !== `${ALPHA_PACKAGE_PLAN_PATH}#/releaseGuard`) {
    add(findings, "release-plan-package-authority", "/packagePlanPath");
  }
  if (plan.releaseLockPath !== ALPHA_RELEASE_LOCK_PATH) {
    add(findings, "release-plan-lock-path", "/releaseLockPath");
  }
  if (!exactRecord(plan.sourceTag, ["name", "type", "targetPolicy", "message"]) ||
      plan.sourceTag.name !== ALPHA_RELEASE_TAG_NAME ||
      plan.sourceTag.type !== "annotated" ||
      plan.sourceTag.targetPolicy !== "exact-clean-verified-commit" ||
      plan.sourceTag.message !== ALPHA_RELEASE_TAG_MESSAGE) {
    add(findings, "release-plan-tag", "/sourceTag");
  }
  if (!exactRecord(plan.builders, ["fixed", "verification", "digestEquality"]) ||
      !isDeepStrictEqual(plan.builders.fixed, ALPHA_FIXED_BUILDER) ||
      !isDeepStrictEqual(plan.builders.verification, ALPHA_VERIFICATION_BUILDER) ||
      plan.builders.digestEquality !== "exact-tar-payload-bytes") {
    add(findings, "release-plan-builders", "/builders");
  }
  if (!Array.isArray(plan.lockedInputs) ||
      !isDeepStrictEqual(plan.lockedInputs, LOCKED_INPUTS)) {
    add(findings, "release-plan-inputs", "/lockedInputs");
  }
  if (!exactRecord(plan.recovery, ["absent", "exact", "mismatch", "unpublish"]) ||
      plan.recovery.absent !== "publish-reviewed-tarball" ||
      plan.recovery.exact !== "continue" ||
      plan.recovery.mismatch !== "hard-stop" || plan.recovery.unpublish !== false) {
    add(findings, "release-plan-recovery", "/recovery");
  }
  if (!exactRecord(plan.githubRelease, [
    "order",
    "requiresCompleteRegistryVerification",
    "name",
    "bodySource",
    "bodyProjection",
    "target",
    "draft",
    "prerelease",
    "makeLatest",
    "generateReleaseNotes",
    "assets",
    "idempotency"
  ]) || plan.githubRelease.order !== "last" ||
      plan.githubRelease.requiresCompleteRegistryVerification !== true ||
      plan.githubRelease.name !== ALPHA_RELEASE_TAG_MESSAGE ||
      plan.githubRelease.bodySource !== "docs/releases/0.1.0-alpha.1.md" ||
      !plan.lockedInputs.includes(plan.githubRelease.bodySource) ||
      plan.githubRelease.bodyProjection !==
        "locked-note-plus-release-identity-v1" ||
      plan.githubRelease.target !== "source-tag-target" ||
      plan.githubRelease.draft !== false ||
      plan.githubRelease.prerelease !== true ||
      plan.githubRelease.makeLatest !== "false" ||
      plan.githubRelease.generateReleaseNotes !== false ||
      plan.githubRelease.assets !== "none" ||
      plan.githubRelease.idempotency !== "create-or-exact") {
    add(findings, "release-plan-github-release", "/githubRelease");
  }
  if (!isPlainRecord(packagePlan?.repository) ||
      !isDeepStrictEqual(packagePlan.repository, ALPHA_REPOSITORY)) {
    add(findings, "release-plan-repository", "/packagePlanPath");
  }
  if (!isDeepStrictEqual(packagePlan?.releaseGuard, {
    state: "authorized",
    decisionId: "D-048"
  })) {
    add(findings, "release-plan-authorization", "/authorizationSource");
  }
  if (!isDeepStrictEqual(packagePlan?.publication, {
    registry: "https://registry.npmjs.org/",
    tag: "alpha",
    access: "public",
    provenance: true
  })) {
    add(findings, "release-plan-publication", "/publicationSource");
  }
  return Object.freeze(findings);
}

export function deriveAlphaPublicationOrder(packagePlan) {
  if (!isPlainRecord(packagePlan) || !Array.isArray(packagePlan.packages) ||
      packagePlan.packages.length === 0) {
    throw new Error("alpha-release-package-graph");
  }
  const byId = new Map();
  for (const item of packagePlan.packages) {
    if (!isPlainRecord(item) || typeof item.packageId !== "string" ||
        typeof item.name !== "string" || !Array.isArray(item.dependencies) ||
        byId.has(item.packageId)) {
      throw new Error("alpha-release-package-graph");
    }
    byId.set(item.packageId, item);
  }
  const remaining = new Map([...byId].map(([packageId, item]) => [
    packageId,
    new Set(item.dependencies.map((dependency) => {
      if (!isPlainRecord(dependency) || !byId.has(dependency.packageId) ||
          dependency.packageId === packageId ||
          dependency.version !== packagePlan.packageVersion) {
        throw new Error("alpha-release-package-graph");
      }
      return dependency.packageId;
    }))
  ]));
  const emitted = new Set();
  const order = [];
  while (order.length < byId.size) {
    const ready = [...remaining]
      .filter(([packageId, dependencies]) =>
        !emitted.has(packageId) && [...dependencies].every((id) => emitted.has(id)))
      .map(([packageId]) => packageId)
      .sort();
    if (ready.length === 0) throw new Error("alpha-release-package-cycle");
    const next = ready[0];
    emitted.add(next);
    order.push(byId.get(next));
  }
  if (order.at(-1)?.packageId !== "cli" || order.at(-1)?.name !== "pptx-compiler") {
    throw new Error("alpha-release-cli-not-last");
  }
  return Object.freeze(order.map((item) => Object.freeze({
    packageId: item.packageId,
    name: item.name,
    version: packagePlan.packageVersion,
    tarball: alphaTarballFilename(packagePlan, item)
  })));
}

function canonicalLockValue(lock) {
  if (!isPlainRecord(lock)) return lock;
  return {
    schemaVersion: lock.schemaVersion,
    lockType: lock.lockType,
    releaseVersion: lock.releaseVersion,
    releasePlanSha256: lock.releasePlanSha256,
    packagePlanSha256: lock.packagePlanSha256,
    packageSourceProjectionSha256: lock.packageSourceProjectionSha256,
    inputs: Array.isArray(lock.inputs) ? lock.inputs.map((entry) => isPlainRecord(entry) ? {
      path: entry.path,
      sha256: entry.sha256
    } : entry) : lock.inputs,
    builderResults: Array.isArray(lock.builderResults)
      ? lock.builderResults.map((result) => isPlainRecord(result) ? {
        nodeVersion: result.nodeVersion,
        npmVersion: result.npmVersion,
        evidenceSha256: result.evidenceSha256,
        evidenceBytes: result.evidenceBytes,
        packages: Array.isArray(result.packages)
          ? result.packages.map((entry) => isPlainRecord(entry) ? {
            packageId: entry.packageId,
            name: entry.name,
            tarball: entry.tarball,
            sha256: entry.sha256,
            sha512: entry.sha512,
            compressedBytes: entry.compressedBytes,
            tarSha256: entry.tarSha256,
            tarBytes: entry.tarBytes
          } : entry)
          : result.packages
      } : result)
      : lock.builderResults
  };
}

export function canonicalAlphaReleaseLockText(lock) {
  return `${JSON.stringify(canonicalLockValue(lock), null, 2)}\n`;
}

export function parseAlphaReleaseLockBytes(bytes) {
  const source = byteValue(bytes);
  if (source === null || source.length < 1 || source.length > MAX_CONTROL_BYTES) {
    throw new Error("alpha-release-lock-bytes");
  }
  let text;
  let lock;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(source);
    lock = JSON.parse(text);
  } catch {
    throw new Error("alpha-release-lock-json");
  }
  if (text !== canonicalAlphaReleaseLockText(lock)) {
    throw new Error("alpha-release-lock-canonical");
  }
  return lock;
}

export async function loadAlphaReleaseLock({ root = repositoryRoot } = {}) {
  return parseAlphaReleaseLockBytes(
    await readFile(path.join(root, ALPHA_RELEASE_LOCK_PATH))
  );
}

function expectedEvidenceFiles(item) {
  // Preserve the existing package-stage schema-2 evidence order exactly. The
  // new release-lock source projection below owns its own code-unit ordering.
  return [
    Object.freeze({ path: "package.json", mode: 0o644 }),
    ...flattenPackageFiles(item).map((entry) => Object.freeze({
      path: entry.target,
      mode: entry.role === "bin" ? 0o755 : 0o644
    }))
  ].sort((left, right) => left.path.localeCompare(right.path));
}

function parseCanonicalPackageEvidence(bytes) {
  const source = byteValue(bytes);
  if (source === null || source.length < 1 || source.length > MAX_EVIDENCE_BYTES) {
    throw new Error("alpha-release-evidence-bytes");
  }
  let text;
  let evidence;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(source);
    evidence = JSON.parse(text);
  } catch {
    throw new Error("alpha-release-evidence-json");
  }
  if (text !== `${JSON.stringify(evidence, null, 2)}\n`) {
    throw new Error("alpha-release-evidence-canonical");
  }
  return Object.freeze({ evidence, bytes: source });
}

function assertCompletePackageEvidence(evidence, {
  packagePlan,
  expectedBuilder
}) {
  const packagePlanDigest = sha256(Buffer.from(canonicalAlphaPackagePlanText(packagePlan)));
  if (!exactRecord(evidence, [
    "schemaVersion",
    "evidenceType",
    "planId",
    "packagePlanSha256",
    "packageVersion",
    "runtime",
    "packages",
    "install",
    "smoke"
  ]) || evidence.schemaVersion !== 2 ||
      evidence.evidenceType !== "alpha-package-stage" ||
      evidence.planId !== packagePlan.planId ||
      evidence.packagePlanSha256 !== packagePlanDigest ||
      evidence.packageVersion !== packagePlan.packageVersion ||
      !exactRecord(evidence.runtime, ["nodeVersion", "npmVersion"]) ||
      !isDeepStrictEqual(evidence.runtime, expectedBuilder) ||
      !Array.isArray(evidence.packages) ||
      evidence.packages.length !== packagePlan.packages.length ||
      !exactRecord(evidence.install, [
        "startedEmpty", "offline", "lifecycleScripts", "packageCount"
      ]) || evidence.install.startedEmpty !== true || evidence.install.offline !== true ||
      evidence.install.lifecycleScripts !== "disabled" ||
      evidence.install.packageCount !== packagePlan.packages.length ||
      !exactRecord(evidence.smoke, [
        "startedFromUnrelatedCwd",
        "commands",
        "qaDecision",
        "buildArtifactPresent",
        "deliveryFiles"
      ]) || evidence.smoke.startedFromUnrelatedCwd !== true ||
      evidence.smoke.qaDecision !== "blocked" ||
      evidence.smoke.buildArtifactPresent !== false ||
      !Array.isArray(evidence.smoke.commands) ||
      evidence.smoke.commands.length !== 5 ||
      evidence.smoke.commands.some((entry, index) =>
        !exactRecord(entry, ["command", "exitCode", "ok"]) ||
        entry.command !== ["init", "inspect", "validate", "render", "qa"][index] ||
        entry.exitCode !== 0 || entry.ok !== true) ||
      !Array.isArray(evidence.smoke.deliveryFiles) ||
      evidence.smoke.deliveryFiles.join("\n") !==
        "public-synthetic-native-card-deck.candidate.json\n" +
        "public-synthetic-native-card-deck.pptx\n" +
        "public-synthetic-native-card-deck.qa.json") {
    throw new Error("alpha-release-evidence-contract");
  }

  for (let index = 0; index < evidence.packages.length; index += 1) {
    const entry = evidence.packages[index];
    const item = packagePlan.packages[index];
    const expectedFiles = expectedEvidenceFiles(item);
    if (!exactRecord(entry, [
      "packageId",
      "name",
      "tarball",
      "sha256",
      "compressedBytes",
      "unpackedBytes",
      "fileCount",
      "files"
    ]) || entry.packageId !== item.packageId || entry.name !== item.name ||
        entry.tarball !== alphaTarballFilename(packagePlan, item) ||
        !SHA256.test(entry.sha256) ||
        !Number.isSafeInteger(entry.compressedBytes) || entry.compressedBytes < 1 ||
        entry.compressedBytes > ALPHA_TARBALL_LIMITS.compressedBytes ||
        !Number.isSafeInteger(entry.unpackedBytes) || entry.unpackedBytes < 1 ||
        entry.unpackedBytes > ALPHA_TARBALL_LIMITS.unpackedBytes ||
        !Number.isSafeInteger(entry.fileCount) || entry.fileCount < 1 ||
        entry.fileCount > ALPHA_TARBALL_LIMITS.files ||
        !Array.isArray(entry.files) || entry.files.length !== entry.fileCount ||
        entry.files.length !== expectedFiles.length ||
        entry.files.some((file, fileIndex) =>
          !exactRecord(file, ["path", "size", "mode"]) ||
          file.path !== expectedFiles[fileIndex].path ||
          !Number.isSafeInteger(file.size) || file.size < 1 ||
          file.size > ALPHA_TARBALL_LIMITS.fileBytes ||
          file.mode !== expectedFiles[fileIndex].mode) ||
        entry.files.reduce((sum, file) => sum + file.size, 0) !== entry.unpackedBytes) {
      throw new Error("alpha-release-evidence-package");
    }
  }
}

function builderResultFromReviewedSource({
  source,
  packagePlan,
  expectedBuilder,
  publicationOrder,
  expectedFilesById,
  forbiddenPolicy
}) {
  if (!exactRecord(source, ["evidenceBytes", "tarballBytes"]) ||
      !(source.tarballBytes instanceof Map)) {
    throw new Error("alpha-release-builder-source");
  }
  const parsed = parseCanonicalPackageEvidence(source.evidenceBytes);
  assertCompletePackageEvidence(parsed.evidence, { packagePlan, expectedBuilder });
  const expectedIds = new Set(publicationOrder.map((entry) => entry.packageId));
  if (source.tarballBytes.size !== expectedIds.size ||
      [...source.tarballBytes.keys()].some((key) => !expectedIds.has(key))) {
    throw new Error("alpha-release-builder-tarball-set");
  }
  const evidenceById = new Map(parsed.evidence.packages.map((entry) => [
    entry.packageId,
    entry
  ]));
  const retainedBytes = new Map();
  const retainedTarPayloads = new Map();
  const packages = publicationOrder.map((expected) => {
    const evidenceEntry = evidenceById.get(expected.packageId);
    const actualBytes = byteValue(source.tarballBytes.get(expected.packageId));
    if (!isPlainRecord(evidenceEntry) || actualBytes === null || actualBytes.length < 1 ||
        actualBytes.length > ALPHA_TARBALL_LIMITS.compressedBytes ||
        evidenceEntry.name !== expected.name ||
        evidenceEntry.tarball !== expected.tarball ||
        evidenceEntry.compressedBytes !== actualBytes.length ||
        evidenceEntry.sha256 !== sha256(actualBytes)) {
      throw new Error("alpha-release-builder-tarball");
    }
    const inspection = inspectAlphaTarPayload({
      tarballBytes: actualBytes,
      expectedFiles: expectedFilesById.get(expected.packageId),
      forbiddenPolicy
    });
    if (inspection.sha256 !== evidenceEntry.sha256 ||
        inspection.compressedBytes !== evidenceEntry.compressedBytes ||
        inspection.unpackedBytes !== evidenceEntry.unpackedBytes ||
        inspection.fileCount !== evidenceEntry.fileCount ||
        !isDeepStrictEqual(inspection.files, evidenceEntry.files)) {
      throw new Error("alpha-release-builder-tarball-projection");
    }
    const tarPayload = inspection.tarPayloadBytes;
    retainedBytes.set(expected.packageId, actualBytes);
    retainedTarPayloads.set(expected.packageId, tarPayload);
    return Object.freeze({
      packageId: expected.packageId,
      name: expected.name,
      tarball: expected.tarball,
      sha256: evidenceEntry.sha256,
      sha512: sha512(actualBytes),
      compressedBytes: actualBytes.length,
      tarSha256: sha256(tarPayload),
      tarBytes: tarPayload.length
    });
  });
  return Object.freeze({
    result: Object.freeze({
      nodeVersion: expectedBuilder.nodeVersion,
      npmVersion: expectedBuilder.npmVersion,
      evidenceSha256: sha256(parsed.bytes),
      evidenceBytes: parsed.bytes.length,
      packages: Object.freeze(packages)
    }),
    retainedBytes,
    retainedTarPayloads
  });
}

function expectedAlphaPackageFiles({
  packagePlan,
  publicationOrder,
  sourceBytes
}) {
  if (!(sourceBytes instanceof Map)) {
    throw new Error("alpha-release-lock-source-projection");
  }
  const itemsById = new Map(packagePlan.packages.map((item) => [
    item.packageId,
    item
  ]));
  return new Map(publicationOrder.map(({ packageId }) => {
    const item = itemsById.get(packageId);
    if (item === undefined) throw new Error("alpha-release-lock-source-projection");
    return [packageId, projectAlphaPackageFiles({ plan: packagePlan, item, sourceBytes })];
  }));
}

function compareCanonicalPath(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function alphaPackageSourceProjectionSha256({
  packagePlan,
  publicationOrder,
  expectedFilesById,
  sourceModes
}) {
  if (!(expectedFilesById instanceof Map) ||
      expectedFilesById.size !== publicationOrder.length ||
      !(sourceModes instanceof Map)) {
    throw new Error("alpha-release-lock-source-projection");
  }
  const itemsById = new Map(packagePlan.packages.map((item) => [
    item.packageId,
    item
  ]));
  const expectedSourcePaths = new Set(packagePlan.packages.flatMap((item) =>
    flattenPackageFiles(item).map((entry) => entry.source)));
  if (sourceModes.size !== expectedSourcePaths.size ||
      [...sourceModes.keys()].some((source) => !expectedSourcePaths.has(source))) {
    throw new Error("alpha-release-lock-source-projection");
  }
  const packages = publicationOrder.map(({ packageId }) => {
    const item = itemsById.get(packageId);
    const files = expectedFilesById.get(packageId);
    if (item === undefined || !(files instanceof Map)) {
      throw new Error("alpha-release-lock-source-projection");
    }
    const mappings = flattenPackageFiles(item);
    const mappingsByTarget = new Map(mappings.map((entry) => [entry.target, entry]));
    if (mappingsByTarget.size !== mappings.length || files.size !== mappings.length + 1 ||
        !files.has("package.json") ||
        mappings.some(({ target }) => !files.has(target))) {
      throw new Error("alpha-release-lock-source-projection");
    }
    const projectedFiles = [...files].sort(([left], [right]) =>
      compareCanonicalPath(left, right)).map(([target, projected]) => {
      const mapping = mappingsByTarget.get(target);
      const isManifest = target === "package.json";
      const expectedRole = isManifest ? "manifest" : mapping?.role;
      const expectedMode = expectedRole === "bin" ? 0o755 : 0o644;
      const sourceMode = isManifest ? null : sourceModes.get(mapping?.source);
      const bytes = isPlainRecord(projected) ? byteValue(projected.bytes) : null;
      if ((!isManifest && mapping === undefined) || bytes === null || bytes.length < 1 ||
          bytes.length > ALPHA_TARBALL_LIMITS.fileBytes ||
          projected.mode !== expectedMode || projected.role !== expectedRole ||
          (!isManifest && sourceMode !== (expectedMode === 0o755 ? "100755" : "100644"))) {
        throw new Error("alpha-release-lock-source-projection");
      }
      return Object.freeze({
        source: isManifest ? null : mapping.source,
        target,
        role: expectedRole,
        sourceMode,
        packageMode: expectedMode === 0o755 ? "100755" : "100644",
        bytes: bytes.length,
        sha256: sha256(bytes)
      });
    });
    return Object.freeze({ packageId, files: Object.freeze(projectedFiles) });
  });
  const projection = Object.freeze({
    schemaVersion: 1,
    projectionType: "alpha-package-source-projection",
    packages: Object.freeze(packages)
  });
  return sha256(Buffer.from(`${JSON.stringify(projection, null, 2)}\n`));
}

function readAlphaPackageSourcesFromGitTree({
  root,
  treeOid,
  packagePlan,
  environment
}) {
  const sourceBytes = new Map();
  const sourceModes = new Map();
  for (const item of packagePlan.packages) {
    for (const entry of flattenPackageFiles(item)) {
      const expectedMode = entry.role === "bin" ? "100755" : "100644";
      if (sourceModes.has(entry.source)) {
        if (sourceModes.get(entry.source) !== expectedMode) {
          throw new Error("alpha-release-package-source-mode");
        }
        continue;
      }
      const source = readGitTreeBlob(
        root,
        treeOid,
        entry.source,
        environment,
        {
          maximumBytes: ALPHA_TARBALL_LIMITS.fileBytes,
          allowedModes: [expectedMode]
        }
      );
      sourceBytes.set(entry.source, source.bytes);
      sourceModes.set(entry.source, source.mode);
    }
  }
  return Object.freeze({ sourceBytes, sourceModes });
}

export function createAlphaReleaseLock({
  releasePlan,
  packagePlan,
  inputBytes,
  verification,
  fixed,
  expectedFilesById,
  sourceModes,
  forbiddenPolicy
} = {}) {
  if (validateAlphaReleasePlan(releasePlan, { packagePlan }).length !== 0 ||
      !(inputBytes instanceof Map) ||
      inputBytes.size !== releasePlan.lockedInputs.length ||
      [...inputBytes.keys()].some((key) => !releasePlan.lockedInputs.includes(key))) {
    throw new Error("alpha-release-lock-input");
  }
  const frozenInputs = releasePlan.lockedInputs.map((inputPath) => {
    const bytes = byteValue(inputBytes.get(inputPath));
    if (bytes === null || bytes.length < 1 || bytes.length > MAX_CONTROL_BYTES) {
      throw new Error("alpha-release-lock-input");
    }
    return Object.freeze({ path: inputPath, sha256: sha256(bytes) });
  });
  const packagePlanInput = byteValue(inputBytes.get(ALPHA_PACKAGE_PLAN_PATH));
  let parsedPackagePlan;
  try {
    parsedPackagePlan = parseAlphaPackagePlanBytes(packagePlanInput);
  } catch {
    throw new Error("alpha-release-lock-package-plan");
  }
  if (!isDeepStrictEqual(parsedPackagePlan, packagePlan)) {
    throw new Error("alpha-release-lock-package-plan");
  }

  const publicationOrder = deriveAlphaPublicationOrder(packagePlan);
  if (!(expectedFilesById instanceof Map) ||
      expectedFilesById.size !== publicationOrder.length ||
      publicationOrder.some(({ packageId }) => !expectedFilesById.has(packageId)) ||
      !isPlainRecord(forbiddenPolicy)) {
    throw new Error("alpha-release-lock-source-projection");
  }
  const packageSourceProjectionSha256 = alphaPackageSourceProjectionSha256({
    packagePlan,
    publicationOrder,
    expectedFilesById,
    sourceModes
  });
  const verificationSource = builderResultFromReviewedSource({
    source: verification,
    packagePlan,
    expectedBuilder: ALPHA_VERIFICATION_BUILDER,
    publicationOrder,
    expectedFilesById,
    forbiddenPolicy
  });
  const fixedSource = builderResultFromReviewedSource({
    source: fixed,
    packagePlan,
    expectedBuilder: ALPHA_FIXED_BUILDER,
    publicationOrder,
    expectedFilesById,
    forbiddenPolicy
  });
  for (const expected of publicationOrder) {
    if (!verificationSource.retainedTarPayloads.get(expected.packageId)
      .equals(fixedSource.retainedTarPayloads.get(expected.packageId))) {
      throw new Error("alpha-release-builder-tar-drift");
    }
  }

  const lock = Object.freeze({
    schemaVersion: 2,
    lockType: "alpha-release",
    releaseVersion: releasePlan.releaseVersion,
    releasePlanSha256: sha256(Buffer.from(canonicalAlphaReleasePlanText(releasePlan))),
    packagePlanSha256: sha256(Buffer.from(canonicalAlphaPackagePlanText(packagePlan))),
    packageSourceProjectionSha256,
    inputs: Object.freeze(frozenInputs),
    builderResults: Object.freeze([
      verificationSource.result,
      fixedSource.result
    ])
  });
  const findings = validateAlphaReleaseLock(lock, {
    releasePlan,
    packagePlan,
    inputBytes
  });
  if (findings.length !== 0) throw new Error("alpha-release-lock-invalid");
  return lock;
}

export function validateAlphaReleaseLock(lock, {
  releasePlan,
  packagePlan,
  inputBytes
} = {}) {
  const findings = [];
  if (!exactRecord(lock, LOCK_KEYS)) {
    add(findings, "release-lock-shape", "");
    return Object.freeze(findings);
  }
  const releasePlanDigest = sha256(Buffer.from(canonicalAlphaReleasePlanText(releasePlan)));
  const packagePlanDigest = sha256(Buffer.from(canonicalAlphaPackagePlanText(packagePlan)));
  if (lock.schemaVersion !== 2 || lock.lockType !== "alpha-release" ||
      lock.releaseVersion !== releasePlan?.releaseVersion) {
    add(findings, "release-lock-identity", "/lockType");
  }
  if (lock.releasePlanSha256 !== releasePlanDigest) {
    add(findings, "release-lock-plan-digest", "/releasePlanSha256");
  }
  if (lock.packagePlanSha256 !== packagePlanDigest) {
    add(findings, "release-lock-package-plan-digest", "/packagePlanSha256");
  }
  if (!SHA256.test(lock.packageSourceProjectionSha256)) {
    add(findings, "release-lock-package-source-projection", "/packageSourceProjectionSha256");
  }
  const exactInputMap = inputBytes instanceof Map &&
    inputBytes.size === releasePlan?.lockedInputs?.length &&
    [...inputBytes.keys()].every((key) => releasePlan.lockedInputs.includes(key));
  if (!Array.isArray(lock.inputs) || lock.inputs.length !== releasePlan?.lockedInputs?.length ||
      !exactInputMap) {
    add(findings, "release-lock-inputs", "/inputs");
  } else {
    for (let index = 0; index < lock.inputs.length; index += 1) {
      const entry = lock.inputs[index];
      const expectedPath = releasePlan.lockedInputs[index];
      const bytes = inputBytes instanceof Map ? byteValue(inputBytes.get(expectedPath)) : null;
      if (!exactRecord(entry, ["path", "sha256"]) || entry.path !== expectedPath ||
          !SHA256.test(entry.sha256)) {
        add(findings, "release-lock-input", `/inputs/${index}`);
      } else if (bytes === null || entry.sha256 !== sha256(bytes)) {
        add(findings, "release-lock-input-digest", `/inputs/${index}/sha256`);
      }
      if (entry?.path === ALPHA_PACKAGE_PLAN_PATH &&
          entry?.sha256 !== packagePlanDigest) {
        add(findings, "release-lock-package-input", `/inputs/${index}/sha256`);
      }
    }
  }

  let order;
  try {
    order = deriveAlphaPublicationOrder(packagePlan);
  } catch {
    add(findings, "release-lock-package-graph", "/builderResults");
    return Object.freeze(findings);
  }
  const expectedBuilders = [ALPHA_VERIFICATION_BUILDER, ALPHA_FIXED_BUILDER];
  if (!Array.isArray(lock.builderResults) ||
      lock.builderResults.length !== expectedBuilders.length) {
    add(findings, "release-lock-builders", "/builderResults");
    return Object.freeze(findings);
  }
  const acceptedResults = [];
  for (let builderIndex = 0; builderIndex < lock.builderResults.length; builderIndex += 1) {
    const result = lock.builderResults[builderIndex];
    const expectedBuilder = expectedBuilders[builderIndex];
    if (!exactRecord(result, BUILDER_RESULT_KEYS) ||
        result.nodeVersion !== expectedBuilder.nodeVersion ||
        result.npmVersion !== expectedBuilder.npmVersion ||
        !SHA256.test(result.evidenceSha256) ||
        !Number.isSafeInteger(result.evidenceBytes) || result.evidenceBytes < 1 ||
        result.evidenceBytes > MAX_EVIDENCE_BYTES ||
        !Array.isArray(result.packages) || result.packages.length !== order.length) {
      add(findings, "release-lock-builder", `/builderResults/${builderIndex}`);
      continue;
    }
    let complete = true;
    for (let packageIndex = 0; packageIndex < result.packages.length; packageIndex += 1) {
      const entry = result.packages[packageIndex];
      const expected = order[packageIndex];
      if (!exactRecord(entry, [
        "packageId", "name", "tarball", "sha256", "sha512", "compressedBytes",
        "tarSha256", "tarBytes"
      ]) || entry.packageId !== expected.packageId || entry.name !== expected.name ||
          entry.tarball !== expected.tarball || !SHA256.test(entry.sha256) ||
          !SHA512.test(entry.sha512) || !Number.isSafeInteger(entry.compressedBytes) ||
          entry.compressedBytes < 1 || entry.compressedBytes > 5 * 1024 * 1024 ||
          !SHA256.test(entry.tarSha256) || !Number.isSafeInteger(entry.tarBytes) ||
          entry.tarBytes < 1024 || entry.tarBytes > ALPHA_TARBALL_LIMITS.tarStreamBytes) {
        add(findings, "release-lock-package", `/builderResults/${builderIndex}/packages/${packageIndex}`);
        complete = false;
      }
    }
    if (complete) acceptedResults.push(result);
  }
  if (acceptedResults.length === 2) {
    for (let index = 0; index < order.length; index += 1) {
      const verification = acceptedResults[0].packages[index];
      const fixed = acceptedResults[1].packages[index];
      if (verification.tarSha256 !== fixed.tarSha256 ||
          verification.tarBytes !== fixed.tarBytes) {
        add(findings, "release-lock-builder-drift", `/builderResults/1/packages/${index}`);
      }
    }
  }
  return Object.freeze(findings);
}

export function validateAlphaReleaseCandidate(candidate, {
  releasePlan,
  packagePlan,
  releaseLock
} = {}) {
  const findings = [];
  if (!exactRecord(candidate, CANDIDATE_KEYS)) {
    add(findings, "release-candidate-shape", "");
    return Object.freeze(findings);
  }
  if (candidate.schemaVersion !== 1 ||
      candidate.candidateType !== "clean-exact-tag" ||
      candidate.tagName !== releasePlan?.sourceTag?.name ||
      candidate.tagObjectType !== "annotated-tag") {
    add(findings, "release-candidate-tag", "/tagName");
  }
  for (const key of [
    "tagObjectOid", "tagTargetCommitOid", "headCommitOid",
    "tagTargetTreeOid", "headTreeOid"
  ]) {
    if (!GIT_OID.test(candidate[key])) add(findings, "release-candidate-oid", `/${key}`);
  }
  if (candidate.tagTargetCommitOid !== candidate.headCommitOid ||
      candidate.tagTargetTreeOid !== candidate.headTreeOid) {
    add(findings, "release-candidate-target", "/tagTargetCommitOid");
  }
  if (candidate.targetCommitVerified !== true || candidate.worktreeClean !== true ||
      candidate.shallowRepository !== false || candidate.replaceRefs !== false ||
      candidate.grafts !== false || candidate.alternates !== false) {
    add(findings, "release-candidate-repository", "/worktreeClean");
  }
  const expected = {
    releasePlanSha256: sha256(Buffer.from(canonicalAlphaReleasePlanText(releasePlan))),
    packagePlanSha256: sha256(Buffer.from(canonicalAlphaPackagePlanText(packagePlan))),
    releaseLockSha256: sha256(Buffer.from(canonicalAlphaReleaseLockText(releaseLock)))
  };
  for (const [key, value] of Object.entries(expected)) {
    if (candidate[key] !== value) add(findings, "release-candidate-digest", `/${key}`);
  }
  return Object.freeze(findings);
}

function parseGitIdentityValue(value) {
  const match = /^(.*) <([^<>\s]+)> ([0-9]{1,12}) ([+-][0-9]{4})$/u.exec(value);
  if (match === null || match[1].length < 1 || match[1] !== match[1].trim() ||
      match[1] !== match[1].normalize("NFC") ||
      /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}<>]/u.test(match[1]) ||
      !Number.isSafeInteger(Number(match[3])) || Number(match[3]) < 1) {
    throw new Error("alpha-release-git-identity");
  }
  const timezoneHours = Number(match[4].slice(1, 3));
  const timezoneMinutes = Number(match[4].slice(3, 5));
  if (timezoneHours > 14 || timezoneMinutes > 59 ||
      (timezoneHours === 14 && timezoneMinutes !== 0)) {
    throw new Error("alpha-release-git-identity");
  }
  return Object.freeze({
    name: match[1],
    email: match[2],
    timestamp: match[3],
    timezone: match[4]
  });
}

function reviewedGitIdentityPairs(root, targetCommitOid, approvedNames, environment) {
  const commits = runGit(root, [
    "--no-replace-objects", "rev-list", `--max-count=${MAX_RELEASE_HISTORY_COMMITS + 1}`,
    targetCommitOid
  ], environment).trim().split("\n").filter((entry) => entry !== "");
  if (commits.length < 1 || commits.length > MAX_RELEASE_HISTORY_COMMITS ||
      commits.some((entry) => !GIT_OID.test(entry))) {
    throw new Error("alpha-release-identity-history");
  }
  const acceptedNames = new Set(approvedNames);
  const pairs = new Set();
  for (const commit of commits) {
    const raw = runGitBytes(root, [
      "--no-replace-objects", "cat-file", "commit", commit
    ], environment, { maximumBytes: MAX_CONTROL_BYTES });
    const separator = raw.indexOf(Buffer.from("\n\n"));
    if (separator < 1 || raw.includes(0)) {
      throw new Error("alpha-release-identity-history");
    }
    let header;
    try {
      header = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
        .decode(raw.subarray(0, separator));
    } catch {
      throw new Error("alpha-release-identity-history");
    }
    for (const kind of ["author", "committer"]) {
      const prefix = `${kind} `;
      const values = header.split("\n")
        .filter((line) => line.startsWith(prefix))
        .map((line) => line.slice(prefix.length));
      if (values.length !== 1) throw new Error("alpha-release-identity-history");
      const identity = parseGitIdentityValue(values[0]);
      if (acceptedNames.has(identity.name)) {
        pairs.add(`${identity.name}\0${identity.email}`);
      }
    }
  }
  if (pairs.size < 1) throw new Error("alpha-release-identity-history");
  return pairs;
}

function strictAlphaTagObject({
  raw,
  tagObjectOid,
  tagTargetCommitOid,
  tagName,
  releasePlan,
  policy,
  identityPairs
}) {
  if (!Buffer.isBuffer(raw) || raw.length < 1 || raw.length > 64 * 1024 ||
      createHash("sha1").update(Buffer.from(`tag ${raw.length}\0`)).update(raw)
        .digest("hex") !== tagObjectOid) {
    throw new Error("alpha-release-tag-object");
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw);
  } catch {
    throw new Error("alpha-release-tag-object");
  }
  if (text !== text.normalize("NFC") ||
      /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\p{Cf}\p{Zl}\p{Zp}]/u.test(text)) {
    throw new Error("alpha-release-tag-object");
  }
  const separator = text.indexOf("\n\n");
  if (separator < 1 || text.indexOf("\n\n", separator + 2) !== -1) {
    throw new Error("alpha-release-tag-object");
  }
  const headers = text.slice(0, separator).split("\n");
  const message = text.slice(separator + 2);
  if (headers.length !== 4 ||
      headers[0] !== `object ${tagTargetCommitOid}` ||
      headers[1] !== "type commit" || headers[2] !== `tag ${tagName}` ||
      message !== `${releasePlan.sourceTag.message}\n`) {
    throw new Error("alpha-release-tag-object");
  }
  if (!headers[3].startsWith("tagger ")) throw new Error("alpha-release-tag-object");
  const tagger = parseGitIdentityValue(headers[3].slice("tagger ".length));
  if (!policy.approvedPublicIdentities.includes(tagger.name) ||
      !identityPairs.has(`${tagger.name}\0${tagger.email}`)) {
    throw new Error("alpha-release-tag-identity");
  }
  if (inspectForbiddenMaterialContent(
    "release/tag-message.txt",
    Buffer.from(message),
    policy
  ).length !== 0) {
    throw new Error("alpha-release-tag-forbidden-material");
  }
}

async function workingFilesEqualTree(root, treeFiles) {
  for (const [relativePath, expected] of treeFiles) {
    const actual = await stableReadAlphaFile(
      path.join(root, ...relativePath.split("/")),
      Math.max(MAX_CONTROL_BYTES, expected.length)
    );
    if (!actual.equals(expected)) throw new Error("alpha-release-working-tree-drift");
  }
}

export async function inspectAlphaReleaseCandidateSnapshot({
  root = repositoryRoot,
  tagName = ALPHA_RELEASE_TAG_NAME,
  environment = process.env
} = {}) {
  if (typeof root !== "string" || !path.isAbsolute(root) ||
      tagName !== ALPHA_RELEASE_TAG_NAME) {
    throw new Error("alpha-release-tag-input");
  }
  const gitEnvironment = cleanGitEnvironment(environment);
  const resolvedRoot = await realpath(root);
  if (resolvedRoot !== path.resolve(root)) throw new Error("alpha-release-repository-root");
  const expectedGitDirectory = path.join(resolvedRoot, ".git");
  const gitMetadata = await lstat(expectedGitDirectory);
  if (!gitMetadata.isDirectory() || gitMetadata.isSymbolicLink() ||
      await realpath(expectedGitDirectory) !== expectedGitDirectory ||
      await pathExists(path.join(expectedGitDirectory, "commondir"))) {
    throw new Error("alpha-release-repository-indirection");
  }
  const discoveredRoot = await realpath(path.resolve(runGit(resolvedRoot, [
    "--no-replace-objects", "rev-parse", "--show-toplevel"
  ], gitEnvironment).trim()));
  const discoveredGitDirectory = await realpath(path.resolve(runGit(resolvedRoot, [
    "--no-replace-objects", "rev-parse", "--absolute-git-dir"
  ], gitEnvironment).trim()));
  const commonDirectory = await realpath(path.resolve(resolvedRoot, runGit(resolvedRoot, [
    "--no-replace-objects", "rev-parse", "--git-common-dir"
  ], gitEnvironment).trim()));
  if (discoveredRoot !== resolvedRoot || discoveredGitDirectory !== expectedGitDirectory ||
      commonDirectory !== expectedGitDirectory) {
    throw new Error("alpha-release-repository-indirection");
  }
  if (await pathExists(path.join(expectedGitDirectory, "info", "grafts")) ||
      await pathExists(path.join(expectedGitDirectory, "objects", "info", "alternates"))) {
    throw new Error("alpha-release-git-object-override");
  }
  const replaceRefs = runGit(resolvedRoot, [
    "--no-replace-objects", "for-each-ref", "--format=%(refname)", "refs/replace"
  ], gitEnvironment).trim();
  if (replaceRefs !== "") throw new Error("alpha-release-replace-ref");
  const shallow = runGit(resolvedRoot, [
    "--no-replace-objects", "rev-parse", "--is-shallow-repository"
  ], gitEnvironment).trim();
  if (shallow !== "false") throw new Error("alpha-release-shallow-repository");
  const status = runGit(resolvedRoot, [
    "--no-replace-objects", "status", "--porcelain=v1", "--untracked-files=all"
  ], gitEnvironment);
  if (status !== "") throw new Error("alpha-release-worktree-dirty");

  const reference = `refs/tags/${tagName}`;
  const tagObjectOid = runGit(resolvedRoot, [
    "--no-replace-objects", "show-ref", "--verify", "--hash", reference
  ], gitEnvironment).trim();
  if (!GIT_OID.test(tagObjectOid) || runGit(resolvedRoot, [
    "--no-replace-objects", "cat-file", "-t", tagObjectOid
  ], gitEnvironment).trim() !== "tag") {
    throw new Error("alpha-release-tag-not-annotated");
  }
  const tagBody = runGitBytes(resolvedRoot, [
    "--no-replace-objects", "cat-file", "tag", tagObjectOid
  ], gitEnvironment, { maximumBytes: 64 * 1024 });
  const tagTargetCommitOid = runGit(resolvedRoot, [
    "--no-replace-objects", "rev-parse", "--verify", `${reference}^{commit}`
  ], gitEnvironment).trim();
  const headCommitOid = runGit(resolvedRoot, [
    "--no-replace-objects", "rev-parse", "--verify", "HEAD^{commit}"
  ], gitEnvironment).trim();
  const tagTargetTreeOid = runGit(resolvedRoot, [
    "--no-replace-objects", "rev-parse", "--verify", `${reference}^{tree}`
  ], gitEnvironment).trim();
  const headTreeOid = runGit(resolvedRoot, [
    "--no-replace-objects", "rev-parse", "--verify", "HEAD^{tree}"
  ], gitEnvironment).trim();
  if (![tagTargetCommitOid, headCommitOid, tagTargetTreeOid, headTreeOid]
    .every((value) => GIT_OID.test(value)) ||
      tagTargetCommitOid !== headCommitOid || tagTargetTreeOid !== headTreeOid ||
      (Object.hasOwn(environment, "GITHUB_SHA") &&
        environment.GITHUB_SHA !== headCommitOid)) {
    throw new Error("alpha-release-tag-target");
  }

  const releasePlanBytes = readGitTreeFile(
    resolvedRoot,
    tagTargetTreeOid,
    ALPHA_RELEASE_PLAN_PATH,
    gitEnvironment
  );
  const releasePlan = parseAlphaReleasePlanBytes(releasePlanBytes);
  const packagePlanBytes = readGitTreeFile(
    resolvedRoot,
    tagTargetTreeOid,
    releasePlan.packagePlanPath,
    gitEnvironment
  );
  const packagePlan = parseAlphaPackagePlanBytes(packagePlanBytes);
  if (validateAlphaReleasePlan(releasePlan, { packagePlan }).length !== 0) {
    throw new Error("alpha-release-tag-plan");
  }
  const policyBytes = readGitTreeFile(
    resolvedRoot,
    tagTargetTreeOid,
    FORBIDDEN_POLICY_PATH,
    gitEnvironment,
    { maximumBytes: 1024 * 1024 }
  );
  let policy;
  try {
    policy = compileForbiddenMaterialPolicy(JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(policyBytes)
    ));
  } catch {
    throw new Error("alpha-release-tag-policy");
  }
  strictAlphaTagObject({
    raw: tagBody,
    tagObjectOid,
    tagTargetCommitOid,
    tagName,
    releasePlan,
    policy,
    identityPairs: reviewedGitIdentityPairs(
      resolvedRoot,
      tagTargetCommitOid,
      policy.approvedPublicIdentities,
      gitEnvironment
    )
  });

  const releaseLockBytes = readGitTreeFile(
    resolvedRoot,
    tagTargetTreeOid,
    releasePlan.releaseLockPath,
    gitEnvironment
  );
  const releaseLock = parseAlphaReleaseLockBytes(releaseLockBytes);
  const inputBytes = new Map(releasePlan.lockedInputs.map((relativePath) => [
    relativePath,
    relativePath === releasePlan.packagePlanPath
      ? packagePlanBytes
      : readGitTreeFile(
        resolvedRoot,
        tagTargetTreeOid,
        relativePath,
        gitEnvironment
      )
  ]));
  if (validateAlphaReleaseLock(releaseLock, {
    releasePlan,
    packagePlan,
    inputBytes
  }).length !== 0) {
    throw new Error("alpha-release-tag-lock");
  }
  const { sourceBytes, sourceModes } = readAlphaPackageSourcesFromGitTree({
    root: resolvedRoot,
    treeOid: tagTargetTreeOid,
    packagePlan,
    environment: gitEnvironment
  });
  const publicationOrder = deriveAlphaPublicationOrder(packagePlan);
  const expectedFilesById = expectedAlphaPackageFiles({
    packagePlan,
    publicationOrder,
    sourceBytes
  });
  if (releaseLock.packageSourceProjectionSha256 !==
      alphaPackageSourceProjectionSha256({
        packagePlan,
        publicationOrder,
        expectedFilesById,
        sourceModes
      })) {
    throw new Error("alpha-release-tag-source-projection");
  }
  const workingFiles = new Map([
    [ALPHA_RELEASE_PLAN_PATH, releasePlanBytes],
    [releasePlan.releaseLockPath, releaseLockBytes],
    ...inputBytes,
    ...sourceBytes
  ]);
  await workingFilesEqualTree(resolvedRoot, workingFiles);

  const finalStatus = runGit(resolvedRoot, [
    "--no-replace-objects", "status", "--porcelain=v1", "--untracked-files=all"
  ], gitEnvironment);
  const finalTagObjectOid = runGit(resolvedRoot, [
    "--no-replace-objects", "show-ref", "--verify", "--hash", reference
  ], gitEnvironment).trim();
  const finalHeadCommitOid = runGit(resolvedRoot, [
    "--no-replace-objects", "rev-parse", "--verify", "HEAD^{commit}"
  ], gitEnvironment).trim();
  if (finalStatus !== "" || finalTagObjectOid !== tagObjectOid ||
      finalHeadCommitOid !== headCommitOid) {
    throw new Error("alpha-release-repository-changed");
  }
  await workingFilesEqualTree(resolvedRoot, workingFiles);

  const releaseTag = Object.freeze({
    tagName,
    tagObjectType: "annotated-tag",
    tagObjectOid,
    tagTargetCommitOid,
    headCommitOid,
    tagTargetTreeOid,
    headTreeOid,
    worktreeClean: true,
    shallowRepository: false,
    replaceRefs: false,
    grafts: false,
    alternates: false
  });
  return Object.freeze({
    releaseTag,
    releasePlan,
    packagePlan,
    releaseLock,
    inputBytes
  });
}

export async function inspectAlphaReleaseTag(options = {}) {
  return (await inspectAlphaReleaseCandidateSnapshot(options)).releaseTag;
}

export function validateAlphaReviewedTarballs({
  releaseLock,
  packagePlan,
  packageEvidence,
  tarballBytes
} = {}) {
  const findings = [];
  let publicationOrder;
  try {
    publicationOrder = deriveAlphaPublicationOrder(packagePlan);
  } catch {
    add(findings, "release-reviewed-package-graph", "");
    return Object.freeze(findings);
  }
  const fixed = Array.isArray(releaseLock?.builderResults)
    ? releaseLock.builderResults.find((entry) =>
      entry?.nodeVersion === ALPHA_FIXED_BUILDER.nodeVersion &&
      entry?.npmVersion === ALPHA_FIXED_BUILDER.npmVersion)
    : undefined;
  const canonicalEvidence = isPlainRecord(packageEvidence)
    ? Buffer.from(`${JSON.stringify(packageEvidence, null, 2)}\n`)
    : null;
  if (!isPlainRecord(packageEvidence) || packageEvidence.schemaVersion !== 2 ||
      packageEvidence.evidenceType !== "alpha-package-stage" ||
      !isDeepStrictEqual(packageEvidence.runtime, ALPHA_FIXED_BUILDER) ||
      !Array.isArray(packageEvidence.packages) ||
      !isPlainRecord(fixed) || !Array.isArray(fixed.packages) ||
      canonicalEvidence === null || fixed.evidenceBytes !== canonicalEvidence.length ||
      fixed.evidenceSha256 !== sha256(canonicalEvidence) ||
      !(tarballBytes instanceof Map)) {
    add(findings, "release-reviewed-evidence", "");
    return Object.freeze(findings);
  }
  const evidenceById = new Map(packageEvidence.packages.map((entry) => [entry?.packageId, entry]));
  const lockById = new Map(fixed.packages.map((entry) => [entry?.packageId, entry]));
  if (evidenceById.size !== publicationOrder.length ||
      lockById.size !== publicationOrder.length || tarballBytes.size !== publicationOrder.length) {
    add(findings, "release-reviewed-package-set", "/packages");
    return Object.freeze(findings);
  }
  for (const expected of publicationOrder) {
    const evidence = evidenceById.get(expected.packageId);
    const locked = lockById.get(expected.packageId);
    const bytes = byteValue(tarballBytes.get(expected.packageId));
    if (!isPlainRecord(evidence) || !isPlainRecord(locked) || bytes === null ||
        bytes.length < 1 || bytes.length > 5 * 1024 * 1024 ||
        evidence.name !== expected.name || evidence.tarball !== expected.tarball ||
        locked.name !== expected.name || locked.tarball !== expected.tarball ||
        evidence.sha256 !== locked.sha256 ||
        evidence.compressedBytes !== locked.compressedBytes ||
        bytes.length !== locked.compressedBytes || sha256(bytes) !== locked.sha256 ||
        sha512(bytes) !== locked.sha512) {
      add(findings, "release-reviewed-tarball", `/packages/${expected.packageId}`);
    }
  }
  return Object.freeze(findings);
}

export function renderAlphaGitHubReleaseBody({
  releasePlan,
  packagePlan,
  releaseLock,
  inputBytes,
  releaseNoteBytes,
  targetCommitOid
} = {}) {
  const note = byteValue(releaseNoteBytes);
  if (validateAlphaReleasePlan(releasePlan, { packagePlan }).length !== 0 ||
      validateAlphaReleaseLock(releaseLock, {
        releasePlan,
        packagePlan,
        inputBytes
      }).length !== 0 ||
      note === null || note.length < 1 || note.length > MAX_CONTROL_BYTES ||
      !GIT_OID.test(targetCommitOid) ||
      releasePlan.githubRelease.bodySource !==
        "docs/releases/0.1.0-alpha.1.md" ||
      releasePlan.githubRelease.bodyProjection !==
        "locked-note-plus-release-identity-v1") {
    throw new Error("alpha-release-github-body-input");
  }
  let noteText;
  try {
    noteText = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
      .decode(note);
  } catch {
    throw new Error("alpha-release-github-body-note");
  }
  if (!noteText.endsWith("\n") || noteText.includes("\0")) {
    throw new Error("alpha-release-github-body-note");
  }
  const noteInput = Array.isArray(releaseLock?.inputs)
    ? releaseLock.inputs.find(({ path: inputPath }) =>
      inputPath === releasePlan.githubRelease.bodySource)
    : undefined;
  const planDigest = sha256(Buffer.from(canonicalAlphaReleasePlanText(releasePlan)));
  const packagePlanDigest = sha256(
    Buffer.from(canonicalAlphaPackagePlanText(packagePlan))
  );
  const lockBytes = Buffer.from(canonicalAlphaReleaseLockText(releaseLock));
  if (!isPlainRecord(noteInput) || noteInput.sha256 !== sha256(note) ||
      releaseLock?.schemaVersion !== 2 ||
      releaseLock?.lockType !== "alpha-release" ||
      releaseLock?.releaseVersion !== releasePlan.releaseVersion ||
      releaseLock?.releasePlanSha256 !== planDigest ||
      releaseLock?.packagePlanSha256 !== packagePlanDigest) {
    throw new Error("alpha-release-github-body-lock");
  }
  const order = deriveAlphaPublicationOrder(packagePlan);
  const fixed = Array.isArray(releaseLock.builderResults)
    ? releaseLock.builderResults.find((entry) =>
      entry?.nodeVersion === ALPHA_FIXED_BUILDER.nodeVersion &&
      entry?.npmVersion === ALPHA_FIXED_BUILDER.npmVersion)
    : undefined;
  if (!isPlainRecord(fixed) || !Array.isArray(fixed.packages) ||
      fixed.packages.length !== order.length) {
    throw new Error("alpha-release-github-body-lock");
  }
  const lockedPackages = new Map(fixed.packages.map((entry) => [entry?.packageId, entry]));
  if (lockedPackages.size !== order.length) {
    throw new Error("alpha-release-github-body-lock");
  }
  const packageLines = order.map((expected) => {
    const locked = lockedPackages.get(expected.packageId);
    if (!exactRecord(locked, [
      "packageId", "name", "tarball", "sha256", "sha512", "compressedBytes",
      "tarSha256", "tarBytes"
    ]) || locked.packageId !== expected.packageId ||
        locked.name !== expected.name || locked.tarball !== expected.tarball ||
        !SHA256.test(locked.sha256) || !SHA512.test(locked.sha512) ||
        !Number.isSafeInteger(locked.compressedBytes) ||
        locked.compressedBytes < 1 || locked.compressedBytes > 5 * 1024 * 1024) {
      throw new Error("alpha-release-github-body-lock");
    }
    return `- \`${locked.name}@${releasePlan.releaseVersion}\`: ` +
      `\`sha256:${locked.sha256}\`, \`sha512:${locked.sha512}\`, ` +
      `\`bytes:${locked.compressedBytes}\``;
  });
  return `${noteText}\n---\n\n## Release identity\n\n` +
    "This declaration projects only facts bound by the annotated tag and " +
    "tracked release lock; it does not broaden the support matrix.\n\n" +
    `- Tag: \`${releasePlan.sourceTag.name}\`\n` +
    `- Target commit: \`${targetCommitOid}\`\n` +
    `- Release lock: \`${releasePlan.releaseLockPath}\` ` +
    `(\`sha256:${sha256(lockBytes)}\`)\n` +
    "- Packages:\n" + packageLines.map((line) => `  ${line}`).join("\n") + "\n";
}

export function compareAlphaRegistryTarball({ reviewedTarball, downloadedTarball } = {}) {
  const reviewed = byteValue(reviewedTarball);
  const downloaded = byteValue(downloadedTarball);
  if (reviewed === null || downloaded === null || reviewed.length < 1 ||
      reviewed.length > 5 * 1024 * 1024 || downloaded.length < 1 ||
      downloaded.length > 5 * 1024 * 1024) {
    throw new Error("alpha-release-registry-tarball");
  }
  return Object.freeze({
    equal: reviewed.equals(downloaded),
    reviewed: Object.freeze({
      compressedBytes: reviewed.length,
      sha256: sha256(reviewed),
      sha512: sha512(reviewed)
    }),
    downloaded: Object.freeze({
      compressedBytes: downloaded.length,
      sha256: sha256(downloaded),
      sha512: sha512(downloaded)
    })
  });
}

export function decideAlphaPublicationRecovery({
  registryState,
  reviewedTarball,
  downloadedTarball
} = {}) {
  const reviewed = byteValue(reviewedTarball);
  if (reviewed === null || reviewed.length < 1 || reviewed.length > 5 * 1024 * 1024) {
    throw new Error("alpha-release-reviewed-tarball");
  }
  if (registryState === "absent") {
    if (downloadedTarball !== undefined) throw new Error("alpha-release-registry-state");
    return Object.freeze({ action: "publish-reviewed-tarball", mayContinue: true });
  }
  if (registryState !== "present") throw new Error("alpha-release-registry-state");
  const comparison = compareAlphaRegistryTarball({ reviewedTarball: reviewed, downloadedTarball });
  return comparison.equal
    ? Object.freeze({ action: "continue", mayContinue: true, comparison })
    : Object.freeze({
      action: "hard-stop",
      mayContinue: false,
      reason: "registry-tarball-mismatch",
      comparison
    });
}

function sameFileStat(left, right) {
  return left.dev === right.dev && left.ino === right.ino &&
    left.size === right.size && left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

async function stableReadAlphaFile(absolutePath, maximumBytes = MAX_CONTROL_BYTES) {
  let handle;
  try {
    handle = await open(
      absolutePath,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)
    );
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size < 1n || before.size > BigInt(maximumBytes)) {
      throw new Error("alpha-release-stable-read");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (!sameFileStat(before, after) || bytes.length !== Number(before.size)) {
      throw new Error("alpha-release-stable-read");
    }
    return bytes;
  } catch (error) {
    if (error?.message === "alpha-release-stable-read") throw error;
    throw new Error("alpha-release-stable-read");
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function assertCanonicalDirectory(absolutePath, code) {
  try {
    const metadata = await lstat(absolutePath);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() ||
        await realpath(absolutePath) !== path.resolve(absolutePath)) {
      throw new Error(code);
    }
  } catch (error) {
    if (error?.message === code) throw error;
    throw new Error(code);
  }
}

function assertCleanLockWorkspace(root, environment) {
  const status = runGit(root, [
    "--no-replace-objects", "status", "--porcelain=v1", "--untracked-files=all"
  ], environment);
  const trackedLock = runGit(root, [
    "--no-replace-objects", "ls-files", "--stage", "--", ALPHA_RELEASE_LOCK_PATH
  ], environment);
  if (status !== "" || trackedLock !== "") {
    throw new Error("alpha-release-lock-workspace");
  }
}

async function readReviewedStageSnapshot(stageRoot, packagePlan) {
  await assertCanonicalDirectory(stageRoot, "alpha-release-stage-directory");
  if (!(await reviewedStageComplete(stageRoot, packagePlan))) {
    throw new Error("alpha-release-stage-incomplete");
  }
  const readSnapshot = async () => {
    const markerBytes = await stableReadAlphaFile(
      path.join(stageRoot, ".complete.json")
    );
    const evidenceBytes = await stableReadAlphaFile(
      path.join(stageRoot, "package-evidence.json"),
      MAX_EVIDENCE_BYTES
    );
    const tarballBytes = new Map(await Promise.all(
      deriveAlphaPublicationOrder(packagePlan).map(async (entry) => [
        entry.packageId,
        await stableReadAlphaFile(
          path.join(stageRoot, "tarballs", entry.tarball),
          ALPHA_TARBALL_LIMITS.compressedBytes
        )
      ])
    ));
    return Object.freeze({ markerBytes, evidenceBytes, tarballBytes });
  };
  const first = await readSnapshot();
  if (!(await reviewedStageComplete(stageRoot, packagePlan))) {
    throw new Error("alpha-release-stage-changed");
  }
  const second = await readSnapshot();
  if (!first.markerBytes.equals(second.markerBytes) ||
      !first.evidenceBytes.equals(second.evidenceBytes) ||
      [...first.tarballBytes].some(([packageId, bytes]) =>
        !bytes.equals(second.tarballBytes.get(packageId)))) {
    throw new Error("alpha-release-stage-changed");
  }
  return Object.freeze({
    evidenceBytes: first.evidenceBytes,
    tarballBytes: first.tarballBytes
  });
}

async function syncAlphaDirectory(directory) {
  if (process.platform === "win32") {
    throw new Error("alpha-release-lock-directory-sync");
  }
  let handle;
  try {
    handle = await open(directory, fsConstants.O_RDONLY);
    await handle.sync();
  } catch {
    throw new Error("alpha-release-lock-directory-sync");
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function writeAlphaReleaseLockCreateOnly({
  root,
  lock,
  releasePlan,
  packagePlan,
  inputBytes
}) {
  const packagingDirectory = path.join(root, "packaging");
  const releaseDirectory = path.join(packagingDirectory, "releases");
  const outputPath = path.join(root, ...ALPHA_RELEASE_LOCK_PATH.split("/"));
  await assertCanonicalDirectory(packagingDirectory, "alpha-release-lock-parent");
  if (await pathExists(outputPath)) throw new Error("alpha-release-lock-exists");
  if (await pathExists(releaseDirectory)) {
    await assertCanonicalDirectory(releaseDirectory, "alpha-release-lock-directory");
    if ((await readdir(releaseDirectory)).length !== 0) {
      throw new Error("alpha-release-lock-directory-not-empty");
    }
  } else {
    try {
      await mkdir(releaseDirectory, { mode: 0o755 });
    } catch {
      throw new Error("alpha-release-lock-directory-create");
    }
    await assertCanonicalDirectory(releaseDirectory, "alpha-release-lock-directory");
    await syncAlphaDirectory(packagingDirectory);
  }
  if (await pathExists(outputPath) || (await readdir(releaseDirectory)).length !== 0) {
    throw new Error("alpha-release-lock-output-state");
  }

  const bytes = Buffer.from(canonicalAlphaReleaseLockText(lock));
  let handle;
  try {
    handle = await open(
      outputPath,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL |
        (fsConstants.O_NOFOLLOW ?? 0),
      0o644
    );
    await handle.writeFile(bytes);
    await handle.chmod(0o644);
    await handle.sync();
  } catch {
    throw new Error("alpha-release-lock-write");
  } finally {
    await handle?.close().catch(() => {});
  }
  await syncAlphaDirectory(releaseDirectory);
  const persisted = await stableReadAlphaFile(outputPath);
  if (!persisted.equals(bytes)) throw new Error("alpha-release-lock-persisted-bytes");
  const parsed = parseAlphaReleaseLockBytes(persisted);
  if (!isDeepStrictEqual(parsed, lock) || validateAlphaReleaseLock(parsed, {
    releasePlan,
    packagePlan,
    inputBytes
  }).length !== 0) {
    throw new Error("alpha-release-lock-persisted-invalid");
  }
  return parsed;
}

export async function generateAlphaReleaseLockFile({
  root = repositoryRoot,
  verificationStage,
  fixedStage,
  environment = process.env
} = {}) {
  if (typeof root !== "string" || !path.isAbsolute(root) ||
      typeof verificationStage !== "string" || !path.isAbsolute(verificationStage) ||
      typeof fixedStage !== "string" || !path.isAbsolute(fixedStage)) {
    throw new Error("alpha-release-lock-generation-input");
  }
  const resolvedRoot = await realpath(root).catch(() => null);
  if (resolvedRoot === null || resolvedRoot !== path.resolve(root)) {
    throw new Error("alpha-release-lock-generation-root");
  }
  await assertCanonicalDirectory(path.join(root, ".git"), "alpha-release-lock-git-directory");
  const gitEnvironment = cleanGitEnvironment(environment);
  const discoveredRoot = await realpath(path.resolve(runGit(root, [
    "--no-replace-objects", "rev-parse", "--show-toplevel"
  ], gitEnvironment).trim())).catch(() => null);
  if (discoveredRoot !== resolvedRoot) throw new Error("alpha-release-lock-generation-root");
  if (path.resolve(verificationStage) === path.resolve(fixedStage) ||
      await realpath(verificationStage).catch(() => null) ===
        await realpath(fixedStage).catch(() => null)) {
    throw new Error("alpha-release-lock-stage-alias");
  }
  const outputPath = path.join(root, ...ALPHA_RELEASE_LOCK_PATH.split("/"));
  if (await pathExists(outputPath)) throw new Error("alpha-release-lock-exists");
  assertCleanLockWorkspace(root, gitEnvironment);

  const headCommitOid = runGit(root, [
    "--no-replace-objects", "rev-parse", "--verify", "HEAD^{commit}"
  ], gitEnvironment).trim();
  const headTreeOid = runGit(root, [
    "--no-replace-objects", "rev-parse", "--verify", "HEAD^{tree}"
  ], gitEnvironment).trim();
  if (!GIT_OID.test(headCommitOid) || !GIT_OID.test(headTreeOid)) {
    throw new Error("alpha-release-lock-head");
  }
  const releasePlanBytes = readGitTreeFile(
    root,
    headTreeOid,
    ALPHA_RELEASE_PLAN_PATH,
    gitEnvironment
  );
  const releasePlan = parseAlphaReleasePlanBytes(releasePlanBytes);
  const inputBytes = new Map(releasePlan.lockedInputs.map((entry) => [
    entry,
    readGitTreeFile(root, headTreeOid, entry, gitEnvironment)
  ]));
  const packagePlan = parseAlphaPackagePlanBytes(inputBytes.get(ALPHA_PACKAGE_PLAN_PATH));
  if (validateAlphaReleasePlan(releasePlan, { packagePlan }).length !== 0) {
    throw new Error("alpha-release-lock-plan-invalid");
  }
  const { sourceBytes, sourceModes } = readAlphaPackageSourcesFromGitTree({
    root,
    treeOid: headTreeOid,
    packagePlan,
    environment: gitEnvironment
  });
  const expectedFilesById = expectedAlphaPackageFiles({
    packagePlan,
    publicationOrder: deriveAlphaPublicationOrder(packagePlan),
    sourceBytes
  });
  const forbiddenPolicy = compileForbiddenMaterialPolicy(JSON.parse(
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      readGitTreeFile(
        root,
        headTreeOid,
        FORBIDDEN_POLICY_PATH,
        gitEnvironment,
        { maximumBytes: 1024 * 1024 }
      )
    )
  ));
  const headControlFiles = new Map([
    [ALPHA_RELEASE_PLAN_PATH, releasePlanBytes],
    ...inputBytes,
    ...sourceBytes
  ]);
  await workingFilesEqualTree(root, headControlFiles);
  const [verification, fixed] = await Promise.all([
    readReviewedStageSnapshot(path.resolve(verificationStage), packagePlan),
    readReviewedStageSnapshot(path.resolve(fixedStage), packagePlan)
  ]);
  const lock = createAlphaReleaseLock({
    releasePlan,
    packagePlan,
    inputBytes,
    verification,
    fixed,
    expectedFilesById,
    sourceModes,
    forbiddenPolicy
  });

  const [verificationReread, fixedReread] = await Promise.all([
    readReviewedStageSnapshot(path.resolve(verificationStage), packagePlan),
    readReviewedStageSnapshot(path.resolve(fixedStage), packagePlan)
  ]);
  const sameReviewedSource = (left, right) =>
    left.evidenceBytes.equals(right.evidenceBytes) &&
    [...left.tarballBytes].every(([packageId, bytes]) =>
      bytes.equals(right.tarballBytes.get(packageId)));
  if (!sameReviewedSource(verification, verificationReread) ||
      !sameReviewedSource(fixed, fixedReread)) {
    throw new Error("alpha-release-stage-changed");
  }

  const rereadHeadCommitOid = runGit(root, [
    "--no-replace-objects", "rev-parse", "--verify", "HEAD^{commit}"
  ], gitEnvironment).trim();
  const rereadHeadTreeOid = runGit(root, [
    "--no-replace-objects", "rev-parse", "--verify", "HEAD^{tree}"
  ], gitEnvironment).trim();
  if (rereadHeadCommitOid !== headCommitOid || rereadHeadTreeOid !== headTreeOid) {
    throw new Error("alpha-release-lock-input-changed");
  }
  await workingFilesEqualTree(root, headControlFiles);
  if (!(await reviewedStageComplete(path.resolve(verificationStage), packagePlan)) ||
      !(await reviewedStageComplete(path.resolve(fixedStage), packagePlan))) {
    throw new Error("alpha-release-stage-changed");
  }
  if (await pathExists(outputPath)) throw new Error("alpha-release-lock-exists");
  assertCleanLockWorkspace(root, gitEnvironment);
  return writeAlphaReleaseLockCreateOnly({
    root,
    lock,
    releasePlan,
    packagePlan,
    inputBytes
  });
}

export function alphaReleaseRepositoryRoot() {
  return repositoryRoot;
}
