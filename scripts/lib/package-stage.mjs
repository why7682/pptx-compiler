import { constants as fsConstants } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  link,
  mkdir,
  open,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rmdir,
  unlink
} from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  compileForbiddenMaterialPolicy
} from "../check-forbidden-materials.mjs";
import {
  ALPHA_PACKAGE_PLAN_PATH,
  canonicalAlphaPackagePlanText,
  flattenPackageFiles,
  parseAlphaPackagePlanBytes,
  validateAlphaPackagePlan
} from "./package-plan.mjs";
import {
  ALPHA_TARBALL_LIMITS,
  alphaPackageManifestBytes,
  alphaTarballFilename,
  crossCheckNpmPackRecord,
  inspectAlphaTarball,
  parseNpmPackOutput
} from "./package-tarball.mjs";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const STAGE_OWNER_FILE = ".owner.json";
const STAGE_ACTIVE_FILE = ".active.json";
const STAGE_COMPLETE_FILE = ".complete.json";
const STAGE_OWNER = "pptx-pipeline-alpha-package-stage";
const STAGE_CLAIM_PREFIX = ".claim-";
const STAGE_CLAIM_SUFFIX = ".json";
const STAGE_OWNER_CANDIDATE_PREFIX = ".owner-candidate-";
const PROCESS_OUTPUT_BYTES = 1024 * 1024;
const PROCESS_TIMEOUT_MS = 120_000;
const SOURCE_BYTES = 1024 * 1024;
const PROCESS_INSTANCE_ID = randomUUID();
const PROCESS_START_EPOCH_MS = Math.round(performance.timeOrigin);
const heldStageClaims = new Set();
const SMOKE_PROJECT_FILES = Object.freeze([
  "data/capability-registry.json",
  "data/deck-spec.json",
  "data/project-overlay.json",
  "data/template-profile.json",
  "deliveries/public-synthetic-native-card-deck.candidate.json",
  "deliveries/public-synthetic-native-card-deck.pptx",
  "deliveries/public-synthetic-native-card-deck.qa.json",
  "input/template.potx",
  "pptx-compiler.project.json",
  "records/template-index.json"
]);

export class AlphaPackageStageError extends Error {
  constructor(code) {
    super(code);
    this.name = "AlphaPackageStageError";
    this.code = code;
  }
}

function fail(code) {
  throw new AlphaPackageStageError(code);
}

function canonicalJson(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function packagePlanSha256(plan) {
  return createHash("sha256")
    .update(canonicalAlphaPackagePlanText(plan))
    .digest("hex");
}

function runtimeMajor(version = process.versions.node) {
  const match = /^(\d+)[.]/u.exec(version);
  const major = match === null ? NaN : Number(match[1]);
  if (major !== 22 && major !== 24) fail("package-runtime-unsupported");
  return major;
}

function sameStat(left, right) {
  return left.dev === right.dev && left.ino === right.ino &&
    left.size === right.size && left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

async function stableReadFile(filePath, maximumBytes, {
  missingIsNull = false,
  withMetadata = false
} = {}) {
  let handle;
  try {
    const noFollow = fsConstants.O_NOFOLLOW ?? 0;
    handle = await open(filePath, fsConstants.O_RDONLY | noFollow);
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size < 1n || before.size > BigInt(maximumBytes)) {
      fail("package-source-file");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (!sameStat(before, after) || bytes.length !== Number(before.size)) {
      fail("package-source-changed");
    }
    if (!withMetadata) return bytes;
    return Object.freeze({
      bytes,
      mode: Number(before.mode)
    });
  } catch (error) {
    if (missingIsNull && error?.code === "ENOENT" && handle === undefined) {
      return null;
    }
    if (error instanceof AlphaPackageStageError) throw error;
    fail("package-source-read");
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function writeCreateOnly(filePath, bytes, mode) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o755 });
  let handle;
  try {
    handle = await open(filePath, fsConstants.O_WRONLY | fsConstants.O_CREAT |
      fsConstants.O_EXCL, mode);
    await handle.writeFile(bytes);
    await handle.chmod(mode);
    await handle.sync();
  } catch {
    fail("package-stage-write");
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function regularDirectory(candidate, code) {
  try {
    const metadata = await lstat(candidate);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail(code);
  } catch (error) {
    if (error instanceof AlphaPackageStageError) throw error;
    fail(code);
  }
}

function stageClaimFilename(value) {
  return /^[.]claim-[1-9][0-9]*-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}[.]json$/u
    .test(value);
}

function stageOwnerCandidateFilename(value) {
  return /^[.]owner-candidate-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}[.]json$/u
    .test(value);
}

function knownStageRootEntry(value) {
  const fixed = new Set([
    STAGE_OWNER_FILE,
    STAGE_ACTIVE_FILE,
    "work",
    "reviewed",
    "previous",
    "failed",
    "npm"
  ]);
  return fixed.has(value) || stageClaimFilename(value) ||
    stageOwnerCandidateFilename(value);
}

async function removeEmptyUnknownDirectories(directory, allowed, code) {
  let changed = false;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (allowed(entry.name)) continue;
    const candidate = path.join(directory, entry.name);
    if (!entry.isDirectory() || entry.isSymbolicLink() ||
        (await readdir(candidate)).length !== 0) {
      fail(code);
    }
    await rmdir(candidate).catch(() => fail(code));
    changed = true;
  }
  if (changed) await syncDirectory(directory);
}

async function sanitizeStageRoot(stageRoot) {
  await removeEmptyUnknownDirectories(
    stageRoot,
    knownStageRootEntry,
    "package-stage-unexpected-entry"
  );
}

async function assertKnownStageRootEntries(stageRoot) {
  const entries = await readdir(stageRoot, { withFileTypes: true });
  if (entries.some((entry) => !knownStageRootEntry(entry.name))) {
    fail("package-stage-unexpected-entry");
  }
}

async function syncDirectory(directory) {
  if (process.platform === "win32") return;
  let handle;
  try {
    handle = await open(directory, fsConstants.O_RDONLY);
    await handle.sync();
  } catch {
    fail("package-stage-sync");
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function syncRegularFile(filePath) {
  let handle;
  try {
    handle = await open(filePath, alphaRegularFileSyncFlags());
    const metadata = await handle.stat();
    if (!metadata.isFile()) fail("package-stage-sync");
    await handle.sync();
  } catch (error) {
    if (error instanceof AlphaPackageStageError) throw error;
    fail("package-stage-sync");
  } finally {
    await handle?.close().catch(() => {});
  }
}

export function alphaRegularFileSyncFlags({ platform = process.platform } = {}) {
  return platform === "win32"
    ? fsConstants.O_RDWR
    : fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
}

async function cleanupOwnerCandidates(stageRoot, plan) {
  const expected = ownerBytes(plan);
  for (const entry of await readdir(stageRoot, { withFileTypes: true })) {
    if (!stageOwnerCandidateFilename(entry.name)) continue;
    if (!entry.isFile() || entry.isSymbolicLink()) fail("package-stage-owner");
    const candidatePath = path.join(stageRoot, entry.name);
    const bytes = await readRegularMarker(candidatePath, 1024, "package-stage-owner");
    if (bytes === null || !bytes.equals(expected)) fail("package-stage-owner");
    await unlink(candidatePath)
      .catch(() => fail("package-stage-owner"));
  }
  await syncDirectory(stageRoot);
}

async function createAtomicOwner(stageRoot, plan) {
  const ownerPath = path.join(stageRoot, STAGE_OWNER_FILE);
  const candidatePath = path.join(
    stageRoot,
    `${STAGE_OWNER_CANDIDATE_PREFIX}${randomUUID()}.json`
  );
  const expected = ownerBytes(plan);
  await writeCreateOnly(candidatePath, expected, 0o600);
  try {
    await link(candidatePath, ownerPath);
  } catch (error) {
    if (error?.code !== "EEXIST") {
      await unlink(candidatePath).catch(() => {});
      fail("package-stage-owner");
    }
    const existing = await readRegularMarker(ownerPath, 1024, "package-stage-owner");
    if (existing === null || !existing.equals(expected)) {
      await unlink(candidatePath).catch(() => {});
      fail("package-stage-owner");
    }
  }
  await unlink(candidatePath).catch(() => fail("package-stage-owner"));
  await syncDirectory(stageRoot);
}

function ownerBytes(plan) {
  return canonicalJson({
    schemaVersion: 1,
    owner: STAGE_OWNER,
    planId: plan.planId
  });
}

function createClaim() {
  return Object.freeze({
    schemaVersion: 1,
    owner: STAGE_OWNER,
    instanceId: PROCESS_INSTANCE_ID,
    pid: process.pid,
    processStartEpochMs: PROCESS_START_EPOCH_MS
  });
}

function claimBytes(claim) {
  return canonicalJson(claim);
}

function completionBytes(plan, evidence) {
  const fingerprint = packagePlanSha256(plan);
  if (evidence.packagePlanSha256 !== fingerprint) fail("package-evidence-plan");
  return canonicalJson({
    schemaVersion: 2,
    owner: STAGE_OWNER,
    planId: plan.planId,
    packagePlanSha256: fingerprint,
    packageVersion: plan.packageVersion,
    state: "reviewed",
    evidence
  });
}

function parseClaim(bytes) {
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("package-stage-claim");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join("\n") !==
        "instanceId\nowner\npid\nprocessStartEpochMs\nschemaVersion" ||
      value.schemaVersion !== 1 || value.owner !== STAGE_OWNER ||
      typeof value.instanceId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u
        .test(value.instanceId) ||
      !Number.isSafeInteger(value.pid) || value.pid < 1 ||
      !Number.isSafeInteger(value.processStartEpochMs)) {
    fail("package-stage-claim");
  }
  return Object.freeze(value);
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    fail("package-stage-claim");
  }
}

function claimIsLive(claim) {
  if (claim.pid === process.pid &&
      claim.processStartEpochMs !== PROCESS_START_EPOCH_MS) {
    return false;
  }
  return processIsAlive(claim.pid);
}

async function readRegularMarker(markerPath, maximumBytes, code) {
  const metadata = await lstat(markerPath).catch((error) => {
    if (error?.code === "ENOENT") return null;
    fail(code);
  });
  if (metadata === null) return null;
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 1 ||
      metadata.size > maximumBytes) {
    fail(code);
  }
  try {
    return await stableReadFile(markerPath, maximumBytes, {
      missingIsNull: true
    });
  } catch {
    fail(code);
  }
}

async function cleanupProcessClaims(stageRoot) {
  for (const entry of await readdir(stageRoot, { withFileTypes: true })) {
    const match = /^[.]claim-([1-9][0-9]*)-([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})[.]json$/u
      .exec(entry.name);
    if (match === null) continue;
    if (!entry.isFile() || entry.isSymbolicLink()) fail("package-stage-claim");
    const markerPath = path.join(stageRoot, entry.name);
    const encodedPid = Number(match[1]);
    if (!Number.isSafeInteger(encodedPid)) {
      fail("package-stage-claim");
    }
    const ownCandidate = encodedPid === process.pid &&
      match[2] === PROCESS_INSTANCE_ID;
    const processAlive = processIsAlive(encodedPid);
    if (!ownCandidate && processAlive) {
      fail("package-stage-active");
    }
    if (!processAlive) {
      await unlink(markerPath).catch((error) => {
        if (error?.code !== "ENOENT") fail("package-stage-claim");
      });
      continue;
    }
    const markerBytes = await readRegularMarker(
      markerPath,
      2048,
      "package-stage-claim"
    );
    if (markerBytes === null) fail("package-stage-claim");
    const claim = parseClaim(markerBytes);
    if (claim.pid !== encodedPid || claim.instanceId !== match[2]) {
      fail("package-stage-claim");
    }
    await unlink(markerPath).catch(() => fail("package-stage-claim"));
  }
}

async function acquireStageClaim(stageRoot) {
  if (heldStageClaims.has(stageRoot)) fail("package-stage-active");
  heldStageClaims.add(stageRoot);
  try {
    await cleanupProcessClaims(stageRoot);
    const activePath = path.join(stageRoot, STAGE_ACTIVE_FILE);
    const activeBytes = await readRegularMarker(activePath, 1024, "package-stage-claim");
    if (activeBytes !== null) {
      const activeClaim = parseClaim(activeBytes);
      const ownAbandonedClaim = activeClaim.pid === process.pid &&
        activeClaim.instanceId === PROCESS_INSTANCE_ID;
      if (!ownAbandonedClaim && claimIsLive(activeClaim)) fail("package-stage-active");
      await unlink(activePath).catch(() => fail("package-stage-claim"));
    }

    const claim = createClaim();
    const markerBytes = claimBytes(claim);
    const candidatePath = path.join(
      stageRoot,
      `${STAGE_CLAIM_PREFIX}${claim.pid}-${claim.instanceId}` +
        STAGE_CLAIM_SUFFIX
    );
    await writeCreateOnly(candidatePath, markerBytes, 0o600);
    try {
      await link(candidatePath, activePath);
    } catch (error) {
      await unlink(candidatePath).catch(() => {});
      if (error?.code === "EEXIST") fail("package-stage-active");
      fail("package-stage-claim");
    }
    await unlink(candidatePath).catch(() => fail("package-stage-claim"));
    await syncDirectory(stageRoot);
    return Object.freeze({ activePath, markerBytes });
  } catch (error) {
    heldStageClaims.delete(stageRoot);
    throw error;
  }
}

async function releaseStageClaim(stageRoot, claim) {
  try {
    const actual = await readRegularMarker(claim.activePath, 2048, "package-stage-claim");
    if (actual === null || !actual.equals(claim.markerBytes)) {
      fail("package-stage-claim");
    }
    await unlink(claim.activePath);
    await syncDirectory(stageRoot);
  } catch (error) {
    if (error instanceof AlphaPackageStageError) throw error;
    fail("package-stage-claim");
  } finally {
    heldStageClaims.delete(stageRoot);
  }
}

export async function ensureOwnedStageRoot(root, plan) {
  const stageRoot = path.join(root, plan.stagingRoot);
  let created = false;
  try {
    await mkdir(stageRoot, { mode: 0o700 });
    created = true;
  } catch (error) {
    if (error?.code !== "EEXIST") fail("package-stage-root");
  }
  if (created) {
    await createAtomicOwner(stageRoot, plan);
    await syncDirectory(root);
  } else {
    await regularDirectory(stageRoot, "package-stage-root");
    const resolved = await realpath(stageRoot).catch(() => null);
    if (resolved !== stageRoot) fail("package-stage-root");
    const markerPath = path.join(stageRoot, STAGE_OWNER_FILE);
    const markerStat = await lstat(markerPath).catch(() => null);
    if (markerStat === null) {
      const entries = await readdir(stageRoot);
      if (entries.length !== 0) fail("package-stage-owner");
      await createAtomicOwner(stageRoot, plan);
    } else {
      if (!markerStat.isFile() || markerStat.isSymbolicLink()) {
        fail("package-stage-owner");
      }
      const actual = await readRegularMarker(markerPath, 1024, "package-stage-owner");
      if (actual === null || !actual.equals(ownerBytes(plan))) {
        fail("package-stage-owner");
      }
    }
  }
  return stageRoot;
}

async function exists(candidate) {
  try {
    await lstat(candidate);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    fail("package-stage-entry");
  }
}

function treeSpecification({
  directories = [],
  files = [],
  symlinks = [],
  optionalFiles = []
} = {}) {
  const required = new Map();
  const optional = new Map();
  function addParents(value) {
    const segments = value.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      const parent = segments.slice(0, index).join("/");
      if (!required.has(parent)) required.set(parent, "directory");
    }
  }
  function add(target, value, kind) {
    addParents(value);
    if (required.has(value) || optional.has(value)) fail("package-stage-tree-spec");
    target.set(value, kind);
  }
  for (const value of directories) add(required, value, "directory");
  for (const value of files) add(required, value, "file");
  for (const value of symlinks) add(required, value, "symlink");
  for (const value of optionalFiles) add(optional, value, "file");
  return Object.freeze({ required, optional });
}

async function treeEntries(root, code) {
  const output = new Map();
  async function visit(directory, relative) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        output.set(child, "directory");
        await visit(candidate, child);
      } else if (entry.isFile() && !entry.isSymbolicLink()) {
        output.set(child, "file");
      } else if (entry.isSymbolicLink()) {
        output.set(child, "symlink");
      } else {
        fail(code);
      }
    }
  }
  await regularDirectory(root, code);
  await visit(root, "");
  return output;
}

async function removeExactTree(root, specification, {
  allowMissing = false,
  code = "package-stage-unexpected-entry"
} = {}) {
  if (!(await exists(root))) {
    if (allowMissing) return;
    fail(code);
  }
  const actual = await treeEntries(root, code);
  for (const [relative, kind] of actual) {
    const expected = specification.required.get(relative) ??
      specification.optional.get(relative);
    if (expected !== kind) fail(code);
  }
  if (!allowMissing) {
    for (const [relative, kind] of specification.required) {
      if (actual.get(relative) !== kind) fail(code);
    }
  }
  const leaves = [...actual]
    .filter(([, kind]) => kind !== "directory")
    .map(([relative]) => relative)
    .sort();
  for (const relative of leaves) {
    const candidate = path.join(root, ...relative.split("/"));
    const metadata = await lstat(candidate).catch(() => null);
    const expected = actual.get(relative);
    const matches = metadata !== null && (expected === "file"
      ? metadata.isFile() && !metadata.isSymbolicLink()
      : metadata.isSymbolicLink());
    if (!matches) fail(code);
    await unlink(candidate).catch(() => fail(code));
  }
  const directories = [...actual]
    .filter(([, kind]) => kind === "directory")
    .map(([relative]) => relative)
    .sort((left, right) => right.split("/").length - left.split("/").length ||
      right.localeCompare(left));
  for (const relative of directories) {
    const candidate = path.join(root, ...relative.split("/"));
    await regularDirectory(candidate, code);
    await rmdir(candidate).catch(() => fail(code));
  }
  await rmdir(root).catch(() => fail(code));
  await syncDirectory(path.dirname(root));
}

function exactKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join("\n") === [...keys].sort().join("\n");
}

function expectedEvidenceFiles(item) {
  return [
    Object.freeze({ path: "package.json", mode: 0o644 }),
    ...flattenPackageFiles(item).map((entry) => Object.freeze({
      path: entry.target,
      mode: entry.role === "bin" ? 0o755 : 0o644
    }))
  ].sort((left, right) => left.path.localeCompare(right.path));
}

function completionEvidenceMatchesPlan(evidence, plan) {
  if (!exactKeys(evidence, [
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
      evidence.planId !== plan.planId ||
      evidence.packagePlanSha256 !== packagePlanSha256(plan) ||
      evidence.packageVersion !== plan.packageVersion ||
      !Array.isArray(evidence.packages) ||
      evidence.packages.length !== plan.packages.length ||
      !exactKeys(evidence.runtime, ["nodeVersion", "npmVersion"]) ||
      !/^(?:22|24)[.][0-9]+[.][0-9]+$/u.test(evidence.runtime.nodeVersion) ||
      !/^(?:10|11)[.][0-9]+[.][0-9]+$/u.test(evidence.runtime.npmVersion) ||
      !exactKeys(evidence.install, [
        "startedEmpty", "offline", "lifecycleScripts", "packageCount"
      ]) || evidence.install.startedEmpty !== true || evidence.install.offline !== true ||
      evidence.install.lifecycleScripts !== "disabled" ||
      evidence.install.packageCount !== plan.packages.length ||
      !exactKeys(evidence.smoke, [
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
        !exactKeys(entry, ["command", "exitCode", "ok"]) ||
        entry.command !== ["init", "inspect", "validate", "render", "qa"][index] ||
        entry.exitCode !== 0 || entry.ok !== true) ||
      !Array.isArray(evidence.smoke.deliveryFiles) ||
      evidence.smoke.deliveryFiles.join("\n") !==
        "public-synthetic-native-card-deck.candidate.json\n" +
        "public-synthetic-native-card-deck.pptx\n" +
        "public-synthetic-native-card-deck.qa.json") {
    return false;
  }
  return evidence.packages.every((entry, index) => {
    const item = plan.packages[index];
    const expectedFiles = expectedEvidenceFiles(item);
    return exactKeys(entry, [
      "packageId",
      "name",
      "tarball",
      "sha256",
      "compressedBytes",
      "unpackedBytes",
      "fileCount",
      "files"
    ]) && entry.packageId === item.packageId && entry.name === item.name &&
      entry.tarball === alphaTarballFilename(plan, item) &&
      /^[a-f0-9]{64}$/u.test(entry.sha256) &&
      Number.isSafeInteger(entry.compressedBytes) && entry.compressedBytes > 0 &&
      entry.compressedBytes <= ALPHA_TARBALL_LIMITS.compressedBytes &&
      Number.isSafeInteger(entry.unpackedBytes) && entry.unpackedBytes > 0 &&
      entry.unpackedBytes <= ALPHA_TARBALL_LIMITS.unpackedBytes &&
      Number.isSafeInteger(entry.fileCount) && entry.fileCount > 0 &&
      entry.fileCount <= ALPHA_TARBALL_LIMITS.files &&
      Array.isArray(entry.files) && entry.files.length === entry.fileCount &&
      entry.files.length === expectedFiles.length &&
      entry.files.every((file, fileIndex) =>
        exactKeys(file, ["path", "size", "mode"]) &&
        file.path === expectedFiles[fileIndex].path &&
        Number.isSafeInteger(file.size) && file.size > 0 &&
        file.size <= ALPHA_TARBALL_LIMITS.fileBytes &&
        file.mode === expectedFiles[fileIndex].mode) &&
      entry.files.reduce((sum, file) => sum + file.size, 0) === entry.unpackedBytes;
  });
}

async function exactDirectoryEntries(directory, expectedNames) {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries.map((entry) => entry.name).sort();
  return names.length === expectedNames.length &&
    names.every((name, index) => name === expectedNames[index]);
}

async function inspectReviewedCandidate(reviewed, plan) {
  if (!(await exists(reviewed))) return Object.freeze({ kind: "missing" });
  try {
    await regularDirectory(reviewed, "package-stage-entry");
    const rootEntries = await readdir(reviewed, { withFileTypes: true });
    if (rootEntries.length === 0) return Object.freeze({ kind: "empty" });
    const allowedRoot = new Set([
      STAGE_COMPLETE_FILE,
      "package-evidence.json",
      "tarballs"
    ]);
    if (rootEntries.some((entry) => !allowedRoot.has(entry.name))) {
      return Object.freeze({ kind: "foreign" });
    }
    const markerEntry = rootEntries.find((entry) => entry.name === STAGE_COMPLETE_FILE);
    if (markerEntry === undefined || !markerEntry.isFile() ||
        markerEntry.isSymbolicLink()) {
      return Object.freeze({ kind: "foreign" });
    }
    const markerBytes = await readRegularMarker(
      path.join(reviewed, STAGE_COMPLETE_FILE),
      SOURCE_BYTES,
      "package-stage-completion"
    );
    if (markerBytes === null) return Object.freeze({ kind: "foreign" });
    const marker = parseControlJson(markerBytes, "package-stage-completion");
    if (!exactKeys(marker, [
      "schemaVersion",
      "owner",
      "planId",
      "packagePlanSha256",
      "packageVersion",
      "state",
      "evidence"
    ]) || marker.schemaVersion !== 2 || marker.owner !== STAGE_OWNER ||
        marker.planId !== plan.planId ||
        marker.packagePlanSha256 !== packagePlanSha256(plan) ||
        marker.packageVersion !== plan.packageVersion || marker.state !== "reviewed" ||
        !completionEvidenceMatchesPlan(marker.evidence, plan) ||
        !markerBytes.equals(completionBytes(plan, marker.evidence))) {
      return Object.freeze({ kind: "foreign" });
    }
    const evidence = marker.evidence;
    const expectedEvidenceBytes = canonicalJson(evidence);
    const evidenceEntry = rootEntries.find((entry) =>
      entry.name === "package-evidence.json");
    if (evidenceEntry !== undefined) {
      if (!evidenceEntry.isFile() || evidenceEntry.isSymbolicLink()) {
        return Object.freeze({ kind: "foreign" });
      }
      const evidenceBytes = await stableReadFile(
        path.join(reviewed, "package-evidence.json"),
        SOURCE_BYTES
      );
      if (!evidenceBytes.equals(expectedEvidenceBytes)) {
        return Object.freeze({ kind: "foreign" });
      }
    }
    const tarballRoot = path.join(reviewed, "tarballs");
    const expectedTarballs = evidence.packages.map((entry) => entry.tarball).sort();
    const tarballEntry = rootEntries.find((entry) => entry.name === "tarballs");
    let actualTarballs = [];
    if (tarballEntry !== undefined) {
      if (!tarballEntry.isDirectory() || tarballEntry.isSymbolicLink()) {
        return Object.freeze({ kind: "foreign" });
      }
      const tarEntries = await readdir(tarballRoot, { withFileTypes: true });
      const expectedNames = new Set(expectedTarballs);
      if (tarEntries.some((entry) => !expectedNames.has(entry.name) ||
          !entry.isFile() || entry.isSymbolicLink())) {
        return Object.freeze({ kind: "foreign" });
      }
      actualTarballs = tarEntries.map((entry) => entry.name).sort();
      for (const name of actualTarballs) {
        const entry = evidence.packages.find((item) => item.tarball === name);
        const bytes = await stableReadFile(
          path.join(tarballRoot, name),
          ALPHA_TARBALL_LIMITS.compressedBytes
        );
        if (bytes.length !== entry.compressedBytes ||
            createHash("sha256").update(bytes).digest("hex") !== entry.sha256) {
          return Object.freeze({ kind: "foreign" });
        }
      }
    }
    const complete = evidenceEntry !== undefined && tarballEntry !== undefined &&
      rootEntries.length === 3 && actualTarballs.length === expectedTarballs.length &&
      actualTarballs.every((name, index) => name === expectedTarballs[index]);
    return Object.freeze({
      kind: complete ? "complete" : "authenticated-partial",
      evidence,
      markerBytes,
      expectedEvidenceBytes
    });
  } catch {
    return Object.freeze({ kind: "foreign" });
  }
}

export async function reviewedStageComplete(reviewed, plan) {
  return (await inspectReviewedCandidate(reviewed, plan)).kind === "complete";
}

async function sanitizeReviewedCandidate(candidate, plan) {
  if (!(await exists(candidate))) return;
  await regularDirectory(candidate, "package-stage-entry");
  const rootNames = new Set([
    STAGE_COMPLETE_FILE,
    "package-evidence.json",
    "tarballs"
  ]);
  await removeEmptyUnknownDirectories(
    candidate,
    (name) => rootNames.has(name),
    "package-stage-unexpected-entry"
  );
  const tarballRoot = path.join(candidate, "tarballs");
  if (!(await exists(tarballRoot))) return;
  await regularDirectory(tarballRoot, "package-stage-entry");
  const tarballNames = new Set(plan.packages.map((item) =>
    alphaTarballFilename(plan, item)));
  await removeEmptyUnknownDirectories(
    tarballRoot,
    (name) => tarballNames.has(name),
    "package-stage-unexpected-entry"
  );
}

async function removeAuthenticatedReviewedCandidate(candidate, plan) {
  const inspected = await inspectReviewedCandidate(candidate, plan);
  if (inspected.kind !== "complete" &&
      inspected.kind !== "authenticated-partial") {
    fail("package-stage-recovery");
  }
  const tarballRoot = path.join(candidate, "tarballs");
  if (await exists(tarballRoot)) {
    const entries = await readdir(tarballRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || entry.isSymbolicLink()) fail("package-stage-recovery");
      const evidence = inspected.evidence.packages.find((item) =>
        item.tarball === entry.name);
      if (evidence === undefined) fail("package-stage-recovery");
      const tarballPath = path.join(tarballRoot, entry.name);
      const bytes = await stableReadFile(
        tarballPath,
        ALPHA_TARBALL_LIMITS.compressedBytes
      );
      if (bytes.length !== evidence.compressedBytes ||
          createHash("sha256").update(bytes).digest("hex") !== evidence.sha256) {
        fail("package-stage-recovery");
      }
      await unlink(tarballPath).catch(() => fail("package-stage-recovery"));
    }
    await syncDirectory(tarballRoot);
    await rmdir(tarballRoot).catch(() => fail("package-stage-recovery"));
    await syncDirectory(candidate);
  }
  const evidencePath = path.join(candidate, "package-evidence.json");
  if (await exists(evidencePath)) {
    const bytes = await stableReadFile(evidencePath, SOURCE_BYTES);
    if (!bytes.equals(inspected.expectedEvidenceBytes)) {
      fail("package-stage-recovery");
    }
    await unlink(evidencePath).catch(() => fail("package-stage-recovery"));
    await syncDirectory(candidate);
  }
  const markerPath = path.join(candidate, STAGE_COMPLETE_FILE);
  const markerBytes = await readRegularMarker(
    markerPath,
    SOURCE_BYTES,
    "package-stage-recovery"
  );
  if (markerBytes === null || !markerBytes.equals(inspected.markerBytes) ||
      !(await exactDirectoryEntries(candidate, [STAGE_COMPLETE_FILE]))) {
    fail("package-stage-recovery");
  }
  await unlink(markerPath).catch(() => fail("package-stage-recovery"));
  await rmdir(candidate).catch(() => fail("package-stage-recovery"));
  await syncDirectory(path.dirname(candidate));
}

async function quarantineDirectory(candidate, failed) {
  if (!(await exists(candidate))) return;
  if (await exists(failed)) fail("package-stage-recovery");
  await regularDirectory(candidate, "package-stage-entry");
  await rename(candidate, failed).catch(() => fail("package-stage-entry"));
  await syncDirectory(path.dirname(failed));
}

async function recoverStage(stageRoot, plan) {
  const reviewed = path.join(stageRoot, "reviewed");
  const previous = path.join(stageRoot, "previous");
  const failed = path.join(stageRoot, "failed");
  const work = path.join(stageRoot, "work");
  await sanitizeReviewedCandidate(reviewed, plan);
  await sanitizeReviewedCandidate(previous, plan);
  if (await exists(failed)) await regularDirectory(failed, "package-stage-recovery");
  let reviewedState = await inspectReviewedCandidate(reviewed, plan);
  const previousState = await inspectReviewedCandidate(previous, plan);
  if (await exists(previous)) {
    if (reviewedState.kind === "complete") {
      if (previousState.kind === "complete" ||
          previousState.kind === "authenticated-partial") {
        await removeAuthenticatedReviewedCandidate(previous, plan);
      } else if (previousState.kind === "empty") {
        await rmdir(previous).catch(() => fail("package-stage-recovery"));
        await syncDirectory(stageRoot);
      } else {
        fail("package-stage-recovery");
      }
    } else {
      if (previousState.kind !== "complete") fail("package-stage-recovery");
      if (reviewedState.kind === "empty") {
        await rmdir(reviewed).catch(() => fail("package-stage-recovery"));
      } else if (reviewedState.kind === "authenticated-partial") {
        await removeAuthenticatedReviewedCandidate(reviewed, plan);
      } else if (reviewedState.kind === "foreign") {
        await quarantineDirectory(reviewed, failed);
      } else if (reviewedState.kind !== "missing") {
        fail("package-stage-recovery");
      }
      await rename(previous, reviewed).catch(() => fail("package-stage-entry"));
      await syncDirectory(stageRoot);
      if (!(await reviewedStageComplete(reviewed, plan))) {
        fail("package-stage-recovery");
      }
      reviewedState = Object.freeze({ kind: "complete" });
    }
  } else if (reviewedState.kind === "empty") {
    await rmdir(reviewed).catch(() => fail("package-stage-recovery"));
    await syncDirectory(stageRoot);
  } else if (reviewedState.kind === "authenticated-partial") {
    await removeAuthenticatedReviewedCandidate(reviewed, plan);
  } else if (reviewedState.kind === "foreign") {
    await quarantineDirectory(reviewed, failed);
  }
  if (await exists(work)) await quarantineDirectory(work, failed);
  try {
    await mkdir(work, { mode: 0o700 });
    await syncDirectory(stageRoot);
  } catch {
    fail("package-stage-active");
  }
  return Object.freeze({
    stageRoot,
    work,
    reviewed,
    previous,
    failed
  });
}

async function publishReviewedStage(paths, plan, evidence, verifyReviewed) {
  if (await exists(paths.previous)) fail("package-stage-recovery");
  const hadReviewed = await exists(paths.reviewed);
  if (hadReviewed) {
    await sanitizeReviewedCandidate(paths.reviewed, plan);
    if (!(await reviewedStageComplete(paths.reviewed, plan))) {
      fail("package-stage-recovery");
    }
    await rename(paths.reviewed, paths.previous);
    await syncDirectory(paths.stageRoot);
    if (!(await reviewedStageComplete(paths.previous, plan))) {
      await rename(paths.previous, paths.reviewed).catch(() => {});
      await syncDirectory(paths.stageRoot).catch(() => {});
      fail("package-stage-recovery");
    }
  }
  try {
    await rename(paths.work, paths.reviewed);
    await syncDirectory(paths.stageRoot);
  } catch {
    if (hadReviewed && await exists(paths.previous) && !(await exists(paths.reviewed))) {
      await rename(paths.previous, paths.reviewed).catch(() => {});
      await syncDirectory(paths.stageRoot).catch(() => {});
    }
    fail("package-stage-publish");
  }
  try {
    await verifyReviewed();
    await syncDirectory(path.join(paths.reviewed, "tarballs"));
    await syncDirectory(paths.reviewed);
    await verifyReviewed();
    await writeCreateOnly(
      path.join(paths.reviewed, STAGE_COMPLETE_FILE),
      completionBytes(plan, evidence),
      0o600
    );
    await syncDirectory(paths.reviewed);
    if (!(await reviewedStageComplete(paths.reviewed, plan))) {
      fail("package-stage-completion");
    }
  } catch (error) {
    const preserve = await exists(paths.failed) ? paths.work : paths.failed;
    if (await exists(paths.reviewed) && !(await exists(preserve))) {
      await rename(paths.reviewed, preserve).catch(() => {});
    }
    await syncDirectory(paths.stageRoot).catch(() => {});
    if (hadReviewed && await exists(paths.previous) && !(await exists(paths.reviewed))) {
      await rename(paths.previous, paths.reviewed).catch(() => {});
      await syncDirectory(paths.stageRoot).catch(() => {});
    }
    throw error;
  }
  if (hadReviewed) {
    await removeAuthenticatedReviewedCandidate(paths.previous, plan);
  }
}

async function materializePackages({ root, work, plan }) {
  const sourceSnapshots = new Map();
  const packages = new Map();
  for (const item of plan.packages) {
    const packageRoot = path.join(work, "packages", item.packageId);
    await mkdir(packageRoot, { recursive: true, mode: 0o755 });
    const expectedFiles = new Map();
    const manifestBytes = alphaPackageManifestBytes(plan, item);
    expectedFiles.set("package.json", Object.freeze({
      bytes: manifestBytes,
      mode: 0o644,
      role: "manifest"
    }));
    await writeCreateOnly(path.join(packageRoot, "package.json"), manifestBytes, 0o644);
    for (const entry of flattenPackageFiles(item)) {
      let snapshot = sourceSnapshots.get(entry.source);
      if (snapshot === undefined) {
        snapshot = await stableReadFile(
          path.join(root, ...entry.source.split("/")),
          SOURCE_BYTES,
          { withMetadata: true }
        );
        sourceSnapshots.set(entry.source, snapshot);
      }
      const bytes = snapshot.bytes;
      const mode = entry.role === "bin" ? 0o755 : 0o644;
      await writeCreateOnly(
        path.join(packageRoot, ...entry.target.split("/")),
        bytes,
        mode
      );
      expectedFiles.set(entry.target, Object.freeze({ bytes, mode, role: entry.role }));
    }
    packages.set(item.packageId, Object.freeze({ item, packageRoot, expectedFiles }));
  }
  return Object.freeze({ packages, sourceSnapshots });
}

async function verifySourcesUnchanged(root, snapshots) {
  for (const [source, expected] of snapshots) {
    const actual = await stableReadFile(
      path.join(root, ...source.split("/")),
      SOURCE_BYTES,
      { withMetadata: true }
    );
    if (!actual.bytes.equals(expected.bytes) || actual.mode !== expected.mode) {
      fail("package-source-changed");
    }
  }
}

async function resolveNpmCli(nodeExecutable) {
  const nodePath = await realpath(nodeExecutable).catch(() => null);
  if (nodePath === null || !path.isAbsolute(nodePath)) fail("npm-cli-missing");
  const nodeRoot = path.resolve(path.dirname(nodePath), "..");
  const candidates = process.platform === "win32"
    ? [
        path.join(path.dirname(nodePath), "node_modules", "npm", "bin", "npm-cli.js"),
        path.join(nodeRoot, "node_modules", "npm", "bin", "npm-cli.js")
      ]
    : [
        path.join(path.dirname(nodePath), "npm"),
        path.join(nodeRoot, "lib", "node_modules", "npm", "bin", "npm-cli.js")
      ];
  for (const candidate of candidates) {
    const resolved = await realpath(candidate).catch(() => null);
    if (resolved === null || !resolved.startsWith(`${nodeRoot}${path.sep}`)) continue;
    const metadata = await lstat(resolved).catch(() => null);
    if (metadata?.isFile() && !metadata.isSymbolicLink()) return resolved;
  }
  fail("npm-cli-missing");
}

function platformEnvironment(nodeExecutable) {
  const systemPath = process.platform === "win32"
    ? (process.env.SystemRoot ? path.join(process.env.SystemRoot, "System32") : "")
    : "/usr/bin:/bin";
  const output = {
    PATH: [path.dirname(nodeExecutable), systemPath].filter(Boolean).join(path.delimiter),
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    CI: "true"
  };
  for (const key of ["SystemRoot", "ComSpec", "PATHEXT"]) {
    if (process.platform === "win32" && process.env[key]) output[key] = process.env[key];
  }
  return output;
}

async function npmEnvironment(stageRoot, nodeExecutable, cacheName) {
  const npmRoot = path.join(stageRoot, "npm");
  const cache = path.join(npmRoot, cacheName);
  const temporary = path.join(npmRoot, "tmp");
  const userConfig = path.join(npmRoot, "user-config");
  const globalConfig = path.join(npmRoot, "global-config");
  for (const directory of [npmRoot, cache, temporary]) {
    try {
      await mkdir(directory, { mode: 0o700 });
    } catch (error) {
      if (error?.code !== "EEXIST") fail("package-stage-npm-root");
    }
    await regularDirectory(directory, "package-stage-npm-root");
  }
  const allowed = new Set([
    "pack-cache",
    "install-cache",
    "tmp",
    "user-config",
    "global-config"
  ]);
  await removeEmptyUnknownDirectories(
    npmRoot,
    (name) => allowed.has(name),
    "package-stage-npm-root"
  );
  for (const configPath of [userConfig, globalConfig]) {
    if (!(await exists(configPath))) {
      await writeCreateOnly(configPath, Buffer.from(""), 0o600);
    }
    const metadata = await lstat(configPath).catch(() => null);
    if (metadata === null || !metadata.isFile() || metadata.isSymbolicLink() ||
        metadata.size !== 0 || (await readFile(configPath)).length !== 0) {
      fail("package-stage-npm-root");
    }
  }
  return {
    ...platformEnvironment(nodeExecutable),
    TMPDIR: temporary,
    TMP: temporary,
    TEMP: temporary,
    npm_config_cache: cache,
    npm_config_userconfig: userConfig,
    npm_config_globalconfig: globalConfig,
    npm_config_offline: "true",
    npm_config_ignore_scripts: "true",
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false",
    npm_config_progress: "false",
    npm_config_color: "false",
    npm_config_logs_max: "0",
    npm_config_registry: "https://registry.invalid"
  };
}

function runProcess(executable, args, { cwd, env, timeout = PROCESS_TIMEOUT_MS }) {
  const result = spawnSync(executable, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
    maxBuffer: PROCESS_OUTPUT_BYTES,
    windowsHide: true
  });
  if (result.error || result.signal !== null || result.status !== 0 ||
      typeof result.stdout !== "string" || typeof result.stderr !== "string" ||
      Buffer.byteLength(result.stdout) > PROCESS_OUTPUT_BYTES ||
      Buffer.byteLength(result.stderr) > PROCESS_OUTPUT_BYTES) {
    fail("package-process-failed");
  }
  return Object.freeze({ stdout: result.stdout, stderr: result.stderr });
}

async function packPackages({
  stageRoot,
  work,
  plan,
  materialized,
  nodeExecutable,
  npmCli
}) {
  const tarballRoot = path.join(work, "tarballs");
  await mkdir(tarballRoot, { mode: 0o755 });
  const env = await npmEnvironment(stageRoot, nodeExecutable, "pack-cache");
  const output = [];
  for (const item of plan.packages) {
    const staged = materialized.packages.get(item.packageId);
    const result = runProcess(nodeExecutable, [
      npmCli,
      "pack",
      staged.packageRoot,
      "--json",
      "--ignore-scripts",
      "--offline",
      "--pack-destination", tarballRoot,
      "--loglevel", "error"
    ], { cwd: work, env });
    const record = parseNpmPackOutput(result.stdout);
    const filename = alphaTarballFilename(plan, item);
    const tarballPath = path.join(tarballRoot, filename);
    const tarballBytes = await stableReadFile(tarballPath, 5 * 1024 * 1024);
    const inspection = inspectAlphaTarball({
      tarballBytes,
      expectedFiles: staged.expectedFiles,
      forbiddenPolicy: materialized.forbiddenPolicy
    });
    crossCheckNpmPackRecord({ record, plan, item, inspection, tarballBytes });
    await syncRegularFile(tarballPath);
    const persistedBytes = await stableReadFile(tarballPath, 5 * 1024 * 1024);
    if (!persistedBytes.equals(tarballBytes)) fail("package-tarball-changed");
    output.push(Object.freeze({
      item,
      filename,
      tarballPath,
      tarballBytes,
      inspection
    }));
  }
  await syncDirectory(tarballRoot);
  await syncDirectory(work);
  return Object.freeze(output);
}

export async function verifyAlphaTarballSnapshots(packed, tarballRoot) {
  if (!Array.isArray(packed) || packed.length === 0 ||
      typeof tarballRoot !== "string" || !path.isAbsolute(tarballRoot)) {
    fail("package-tarball-snapshot");
  }
  for (const entry of packed) {
    if (typeof entry?.filename !== "string" ||
        !/^[a-z0-9][a-z0-9._-]*[.]tgz$/u.test(entry.filename) ||
        !Buffer.isBuffer(entry.tarballBytes)) {
      fail("package-tarball-snapshot");
    }
    const actual = await stableReadFile(
      path.join(tarballRoot, entry.filename),
      5 * 1024 * 1024
    );
    if (!actual.equals(entry.tarballBytes)) fail("package-tarball-changed");
  }
}

async function persistAlphaTarballSnapshots(packed, tarballRoot) {
  for (const entry of packed) {
    await syncRegularFile(path.join(tarballRoot, entry.filename));
  }
  await syncDirectory(tarballRoot);
  await verifyAlphaTarballSnapshots(packed, tarballRoot);
}

async function collectRegularFiles(root) {
  const output = [];
  async function visit(relative = "") {
    const directory = relative === "" ? root : path.join(root, ...relative.split("/"));
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) output.push(child);
      else fail("installed-package-entry");
    }
  }
  await visit();
  return output.sort();
}

function assertExactInventory(actual, expected, code) {
  if (!Array.isArray(actual) || actual.some((entry) => typeof entry !== "string")) {
    fail(code);
  }
  const sorted = [...actual].sort();
  if (sorted.length !== expected.length ||
      sorted.some((entry, index) => entry !== expected[index])) {
    fail(code);
  }
}

export function assertAlphaInstalledBinNames(names, {
  platform = process.platform
} = {}) {
  const expected = platform === "win32"
    ? ["pptx-compiler", "pptx-compiler.cmd", "pptx-compiler.ps1"]
    : ["pptx-compiler"];
  assertExactInventory(names, expected, "installed-bin-inventory");
  return true;
}

export function assertAlphaSmokeProjectFiles(files) {
  assertExactInventory(files, SMOKE_PROJECT_FILES, "installed-project-inventory");
  return true;
}

async function verifyInstalledPackages({ installRoot, plan, materialized }) {
  const nodeModules = path.join(installRoot, "node_modules");
  await regularDirectory(nodeModules, "installed-node-modules");
  const topLevel = await readdir(nodeModules, { withFileTypes: true });
  const allowed = new Set([".bin", ".package-lock.json", ...plan.packages.map((item) => item.name)]);
  if (topLevel.some((entry) => !allowed.has(entry.name))) fail("installed-package-extra");
  for (const item of plan.packages) {
    const packageRoot = path.join(nodeModules, item.name);
    await regularDirectory(packageRoot, "installed-package-missing");
    const actualPaths = await collectRegularFiles(packageRoot);
    const staged = materialized.packages.get(item.packageId);
    const expectedPaths = [...staged.expectedFiles.keys()].sort();
    if (actualPaths.length !== expectedPaths.length ||
        actualPaths.some((entry, index) => entry !== expectedPaths[index])) {
      fail("installed-package-allowlist");
    }
    for (const [target, expected] of staged.expectedFiles) {
      const actual = await stableReadFile(
        path.join(packageRoot, ...target.split("/")),
        Math.max(SOURCE_BYTES, expected.bytes.length),
        { withMetadata: true }
      );
      if (!actual.bytes.equals(expected.bytes) ||
          (process.platform !== "win32" && (actual.mode & 0o777) !== expected.mode)) {
        fail("installed-package-content");
      }
    }
  }
  const installedBin = path.join(nodeModules, "pptx-compiler", "pptx-compiler.mjs");
  const binRoot = path.join(nodeModules, ".bin");
  await regularDirectory(binRoot, "installed-bin-link");
  const binEntries = await readdir(binRoot, { withFileTypes: true });
  assertAlphaInstalledBinNames(binEntries.map((entry) => entry.name));
  if (process.platform !== "win32") {
    const shim = path.join(binRoot, "pptx-compiler");
    const metadata = await lstat(shim).catch(() => null);
    if (metadata === null || !metadata.isSymbolicLink()) fail("installed-bin-link");
    const link = await readlink(shim);
    if (path.resolve(path.dirname(shim), link) !== installedBin ||
        await realpath(shim).catch(() => null) !== installedBin) {
      fail("installed-bin-link");
    }
  } else if (binEntries.some((entry) => !entry.isFile() || entry.isSymbolicLink())) {
    fail("installed-bin-link");
  }
  return installedBin;
}

function parseCliEnvelope(result, command) {
  if (result.stderr !== "" || !result.stdout.endsWith("\n") ||
      result.stdout.slice(0, -1).includes("\n")) {
    fail("installed-cli-output");
  }
  let envelope;
  try {
    envelope = JSON.parse(result.stdout);
  } catch {
    fail("installed-cli-output");
  }
  if (envelope?.protocolVersion !== "0.1.0" || envelope.command !== command ||
      envelope.ok !== true || envelope.error !== undefined ||
      envelope.result === undefined) {
    fail("installed-cli-output");
  }
  return envelope;
}

async function projectFileList(root) {
  const output = [];
  async function visit(relative = "") {
    const directory = relative === "" ? root : path.join(root, ...relative.split("/"));
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) output.push(child);
      else fail("installed-smoke-entry");
    }
  }
  await visit();
  return output.sort();
}

async function runInstalledSpine({ work, installRoot, installedBin, nodeExecutable }) {
  const smokeRoot = path.join(work, "smoke");
  const cwd = path.join(smokeRoot, "cwd");
  const projectRoot = path.join(smokeRoot, "project");
  await mkdir(cwd, { recursive: true, mode: 0o755 });
  const configPath = path.join(projectRoot, "pptx-compiler.project.json");
  const deckPath = path.join(projectRoot, "data", "deck-spec.json");
  const steps = [
    ["init", ["init", "--project-root", projectRoot,
      "--preset", "public-synthetic-native-card", "--json"]],
    ["inspect", ["inspect", "--project-root", projectRoot,
      "--config", configPath, "--json"]],
    ["validate", ["validate", "project", "--project-root", projectRoot,
      "--config", configPath, "--deck", deckPath, "--json"]],
    ["render", ["render", "--project-root", projectRoot,
      "--config", configPath, "--deck", deckPath, "--json"]],
    ["qa", ["qa", "--project-root", projectRoot,
      "--config", configPath, "--deck", deckPath, "--json"]]
  ];
  const env = platformEnvironment(nodeExecutable);
  const commands = [];
  let qa;
  for (const [command, args] of steps) {
    const result = runProcess(nodeExecutable, [installedBin, ...args], { cwd, env });
    const envelope = parseCliEnvelope(result, command);
    commands.push(Object.freeze({ command, exitCode: 0, ok: true }));
    if (command === "qa") qa = envelope.result;
  }
  if (qa?.contractType !== "qa-report" || qa.decision !== "blocked") {
    fail("installed-qa-boundary");
  }
  const files = await projectFileList(projectRoot);
  assertAlphaSmokeProjectFiles(files);
  const deliveries = (await readdir(path.join(projectRoot, "deliveries"))).sort();
  if (JSON.stringify(deliveries) !== JSON.stringify([
    "public-synthetic-native-card-deck.candidate.json",
    "public-synthetic-native-card-deck.pptx",
    "public-synthetic-native-card-deck.qa.json"
  ])) {
    fail("installed-deliveries");
  }
  return Object.freeze({
    startedFromUnrelatedCwd: !cwd.startsWith(`${installRoot}${path.sep}`),
    commands: Object.freeze(commands),
    qaDecision: qa.decision,
    buildArtifactPresent: false,
    deliveryFiles: Object.freeze(deliveries)
  });
}

async function installAndSmoke({
  stageRoot,
  work,
  plan,
  materialized,
  packed,
  nodeExecutable,
  npmCli
}) {
  const installRoot = path.join(work, "install");
  await mkdir(installRoot, { mode: 0o755 });
  if ((await readdir(installRoot)).length !== 0) fail("install-root-not-empty");
  const installManifest = canonicalJson({
    name: "pptx-compiler-alpha-install-smoke",
    version: "0.0.0",
    private: true
  });
  await writeCreateOnly(path.join(installRoot, "package.json"), installManifest, 0o644);
  const env = await npmEnvironment(stageRoot, nodeExecutable, "install-cache");
  runProcess(nodeExecutable, [
    npmCli,
    "install",
    "--no-save",
    "--package-lock=false",
    "--ignore-scripts",
    "--offline",
    "--audit=false",
    "--fund=false",
    "--install-strategy=hoisted",
    ...packed.map((entry) => entry.tarballPath)
  ], { cwd: installRoot, env });
  const actualManifest = await readFile(path.join(installRoot, "package.json"));
  if (!actualManifest.equals(installManifest) || await exists(path.join(installRoot, "package-lock.json"))) {
    fail("install-root-mutated");
  }
  const installedBin = await verifyInstalledPackages({ installRoot, plan, materialized });
  return runInstalledSpine({ work, installRoot, installedBin, nodeExecutable });
}

function materializedTreeSpecification(materialized) {
  const directories = [];
  const files = [];
  for (const [packageId, staged] of materialized.packages) {
    directories.push(packageId);
    for (const target of staged.expectedFiles.keys()) {
      files.push(`${packageId}/${target}`);
    }
  }
  return treeSpecification({ directories, files });
}

function installedTreeSpecification(plan, materialized) {
  const directories = ["node_modules", "node_modules/.bin"];
  const files = ["package.json"];
  for (const item of plan.packages) {
    const packageRoot = `node_modules/${item.name}`;
    directories.push(packageRoot);
    for (const target of materialized.packages.get(item.packageId).expectedFiles.keys()) {
      files.push(`${packageRoot}/${target}`);
    }
  }
  const binRoot = "node_modules/.bin";
  const binNames = process.platform === "win32"
    ? ["pptx-compiler", "pptx-compiler.cmd", "pptx-compiler.ps1"]
    : [];
  return treeSpecification({
    directories,
    files: [...files, ...binNames.map((name) => `${binRoot}/${name}`)],
    symlinks: process.platform === "win32" ? [] : [`${binRoot}/pptx-compiler`],
    optionalFiles: ["node_modules/.package-lock.json"]
  });
}

function smokeTreeSpecification() {
  return treeSpecification({
    directories: [
      "cwd",
      "project",
      "project/assets",
      "project/staging"
    ],
    files: SMOKE_PROJECT_FILES.map((value) => `project/${value}`)
  });
}

async function pruneReviewedPayload(work, plan, materialized) {
  await removeExactTree(
    path.join(work, "install"),
    installedTreeSpecification(plan, materialized)
  );
  await removeExactTree(
    path.join(work, "packages"),
    materializedTreeSpecification(materialized)
  );
  await removeExactTree(path.join(work, "smoke"), smokeTreeSpecification());
  await removeEmptyUnknownDirectories(
    work,
    (name) => name === "tarballs",
    "package-stage-unexpected-entry"
  );
  if (!(await exactDirectoryEntries(work, ["tarballs"]))) {
    fail("package-stage-unexpected-entry");
  }
  await syncDirectory(work);
}

function parseControlJson(bytes, code) {
  try {
    return JSON.parse(new TextDecoder("utf-8", {
      fatal: true
    }).decode(bytes));
  } catch {
    fail(code);
  }
}

async function loadControlInputs(root) {
  const [planBytes, policyBytes, ignoreBytes] = await Promise.all([
    stableReadFile(path.join(root, ALPHA_PACKAGE_PLAN_PATH), SOURCE_BYTES),
    stableReadFile(path.join(root, "policy", "forbidden-materials.json"), SOURCE_BYTES),
    stableReadFile(path.join(root, ".gitignore"), SOURCE_BYTES)
  ]);
  let plan;
  try {
    plan = parseAlphaPackagePlanBytes(planBytes);
  } catch {
    fail("package-plan-read");
  }
  let forbiddenPolicy;
  try {
    forbiddenPolicy = compileForbiddenMaterialPolicy(
      parseControlJson(policyBytes, "package-policy-invalid")
    );
  } catch (error) {
    if (error instanceof AlphaPackageStageError) throw error;
    fail("package-policy-invalid");
  }
  return Object.freeze({
    plan,
    planBytes,
    policyBytes,
    ignoreBytes,
    forbiddenPolicy
  });
}

export async function verifyAlphaControlSnapshots({
  root,
  planBytes,
  policyBytes,
  ignoreBytes
}) {
  if (typeof root !== "string" || !path.isAbsolute(root) ||
      !Buffer.isBuffer(planBytes) || !Buffer.isBuffer(policyBytes) ||
      !Buffer.isBuffer(ignoreBytes)) {
    fail("package-control-snapshot");
  }
  const [actualPlan, actualPolicy, actualIgnore] = await Promise.all([
    stableReadFile(path.join(root, ALPHA_PACKAGE_PLAN_PATH), SOURCE_BYTES),
    stableReadFile(path.join(root, "policy", "forbidden-materials.json"), SOURCE_BYTES),
    stableReadFile(path.join(root, ".gitignore"), SOURCE_BYTES)
  ]);
  if (!actualPlan.equals(planBytes) || !actualPolicy.equals(policyBytes) ||
      !actualIgnore.equals(ignoreBytes)) {
    fail("package-control-changed");
  }
}

function evidenceRecord({ plan, packed, smoke, npmVersion }) {
  return Object.freeze({
    schemaVersion: 2,
    evidenceType: "alpha-package-stage",
    planId: plan.planId,
    packagePlanSha256: packagePlanSha256(plan),
    packageVersion: plan.packageVersion,
    runtime: Object.freeze({
      nodeVersion: process.versions.node,
      npmVersion
    }),
    packages: Object.freeze(packed.map(({ item, filename, inspection }) => Object.freeze({
      packageId: item.packageId,
      name: item.name,
      tarball: filename,
      sha256: inspection.sha256,
      compressedBytes: inspection.compressedBytes,
      unpackedBytes: inspection.unpackedBytes,
      fileCount: inspection.fileCount,
      files: inspection.files
    }))),
    install: Object.freeze({
      startedEmpty: true,
      offline: true,
      lifecycleScripts: "disabled",
      packageCount: plan.packages.length
    }),
    smoke
  });
}

export async function buildAlphaPackageStage({
  root = repositoryRoot,
  nodeExecutable = process.execPath
} = {}) {
  runtimeMajor();
  const [resolvedNode, currentNode] = await Promise.all([
    realpath(nodeExecutable).catch(() => null),
    realpath(process.execPath).catch(() => null)
  ]);
  if (resolvedNode === null || resolvedNode !== currentNode) {
    fail("package-node-executable");
  }
  const resolvedRoot = await realpath(root).catch(() => null);
  if (resolvedRoot === null || resolvedRoot !== path.resolve(root)) fail("package-root");
  const controls = await loadControlInputs(resolvedRoot).catch((error) => {
    if (error instanceof AlphaPackageStageError) throw error;
    fail("package-plan-read");
  });
  const plan = controls.plan;
  const findings = await validateAlphaPackagePlan(plan, { root: resolvedRoot });
  if (findings.length !== 0) fail("package-plan-invalid");
  const stageRoot = await ensureOwnedStageRoot(resolvedRoot, plan);
  const stageClaim = await acquireStageClaim(stageRoot);
  try {
    await cleanupOwnerCandidates(stageRoot, plan);
    await sanitizeStageRoot(stageRoot);
    await assertKnownStageRootEntries(stageRoot);
    const paths = await recoverStage(stageRoot, plan);
    try {
      const materializedBase = await materializePackages({
        root: resolvedRoot,
        work: paths.work,
        plan
      });
      const materialized = Object.freeze({
        ...materializedBase,
        forbiddenPolicy: controls.forbiddenPolicy
      });
      const snapshotFindings = await validateAlphaPackagePlan(plan, {
        root: resolvedRoot,
        sourceSnapshots: materialized.sourceSnapshots,
        ignoreBytes: controls.ignoreBytes
      });
      if (snapshotFindings.length !== 0) fail("package-plan-snapshot-invalid");
      const npmCli = await resolveNpmCli(resolvedNode);
      const npmVersion = runProcess(resolvedNode, [npmCli, "--version"], {
        cwd: paths.work,
        env: platformEnvironment(resolvedNode)
      }).stdout.trim();
      if (!/^(?:10|11)[.][0-9]+[.][0-9]+$/u.test(npmVersion)) {
        fail("npm-version-unsupported");
      }
      const packed = await packPackages({
        stageRoot: paths.stageRoot,
        work: paths.work,
        plan,
        materialized,
        nodeExecutable: resolvedNode,
        npmCli
      });
      await verifyAlphaControlSnapshots({ root: resolvedRoot, ...controls });
      await verifySourcesUnchanged(resolvedRoot, materialized.sourceSnapshots);
      const smoke = await installAndSmoke({
        stageRoot: paths.stageRoot,
        work: paths.work,
        plan,
        materialized,
        packed,
        nodeExecutable: resolvedNode,
        npmCli
      });
      await verifyAlphaTarballSnapshots(packed, path.join(paths.work, "tarballs"));
      await verifyAlphaControlSnapshots({ root: resolvedRoot, ...controls });
      await verifySourcesUnchanged(resolvedRoot, materialized.sourceSnapshots);
      await pruneReviewedPayload(paths.work, plan, materialized);
      const evidence = evidenceRecord({ plan, packed, smoke, npmVersion });
      const evidenceBytes = canonicalJson(evidence);
      await writeCreateOnly(path.join(paths.work, "package-evidence.json"), evidenceBytes, 0o644);
      await persistAlphaTarballSnapshots(packed, path.join(paths.work, "tarballs"));
      await syncDirectory(paths.work);
      await verifyAlphaControlSnapshots({ root: resolvedRoot, ...controls });
      await publishReviewedStage(paths, plan, evidence, async () => {
        await sanitizeReviewedCandidate(paths.reviewed, plan);
        if (!(await exactDirectoryEntries(paths.reviewed, [
          "package-evidence.json",
          "tarballs"
        ])) ||
            !(await exactDirectoryEntries(
          path.join(paths.reviewed, "tarballs"),
          packed.map((entry) => entry.filename).sort()
        ))) {
          fail("package-stage-unexpected-entry");
        }
        await persistAlphaTarballSnapshots(packed, path.join(paths.reviewed, "tarballs"));
        await verifyAlphaControlSnapshots({ root: resolvedRoot, ...controls });
        await verifySourcesUnchanged(resolvedRoot, materialized.sourceSnapshots);
        const publishedEvidence = await stableReadFile(
          path.join(paths.reviewed, "package-evidence.json"),
          SOURCE_BYTES
        );
        if (!publishedEvidence.equals(evidenceBytes)) fail("package-evidence-changed");
      });
      await sanitizeStageRoot(stageRoot);
      await assertKnownStageRootEntries(stageRoot);
      return evidence;
    } catch (error) {
      if (await exists(paths.work).catch(() => false)) {
        await quarantineDirectory(paths.work, paths.failed).catch(() => {});
      }
      if (error instanceof AlphaPackageStageError || error?.name === "AlphaTarballError") {
        throw error;
      }
      fail("package-stage-failed");
    }
  } finally {
    await releaseStageClaim(stageRoot, stageClaim);
  }
}

export function packageStageRepositoryRoot() {
  return repositoryRoot;
}
