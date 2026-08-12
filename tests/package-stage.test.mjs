import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  rename,
  rmdir,
  rm,
  symlink,
  unlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { gzipSync } from "node:zlib";

import {
  compileForbiddenMaterialPolicy
} from "../scripts/check-forbidden-materials.mjs";
import { runAlphaPackageBuild } from "../scripts/build-alpha-packages.mjs";
import {
  canonicalAlphaPackagePlanText,
  flattenPackageFiles,
  loadAlphaPackagePlan,
  validateAlphaPackagePlan
} from "../scripts/lib/package-plan.mjs";
import {
  alphaRegularFileSyncFlags,
  assertAlphaInstalledBinNames,
  assertAlphaSmokeProjectFiles,
  buildAlphaPackageStage,
  ensureOwnedStageRoot,
  reviewedStageComplete,
  verifyAlphaControlSnapshots,
  verifyAlphaTarballSnapshots
} from "../scripts/lib/package-stage.mjs";
import {
  ALPHA_TARBALL_LIMITS,
  alphaPackageManifestBytes,
  createAlphaPackageManifest,
  inspectAlphaTarball,
  parseNpmPackOutput
} from "../scripts/lib/package-tarball.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const plan = await loadAlphaPackagePlan({ root: repositoryRoot });
const packagePlanSha256 = createHash("sha256")
  .update(canonicalAlphaPackagePlanText(plan))
  .digest("hex");
const policy = compileForbiddenMaterialPolicy(JSON.parse(await readFile(
  path.join(repositoryRoot, "policy", "forbidden-materials.json"),
  "utf8"
)));
const firstEvidence = await buildAlphaPackageStage();
const reviewedRoot = path.join(repositoryRoot, plan.stagingRoot, "reviewed");

function createStageWorker() {
  const source = `
    import { parentPort, workerData } from "node:worker_threads";
    const { buildAlphaPackageStage } = await import(workerData.moduleUrl);
    parentPort.postMessage({ status: "ready" });
    await new Promise((resolve) => parentPort.once("message", resolve));
    try {
      const evidence = await buildAlphaPackageStage();
      parentPort.postMessage({
        status: "fulfilled",
        packages: evidence.packages.map((item) => [item.packageId, item.sha256])
      });
    } catch (error) {
      parentPort.postMessage({ status: "rejected", code: error?.code ?? null });
    }
  `;
  const worker = new Worker(
    new URL(`data:text/javascript,${encodeURIComponent(source)}`),
    {
      workerData: {
        moduleUrl: new URL("../scripts/lib/package-stage.mjs", import.meta.url).href
      }
    }
  );
  let readyResolve;
  let readyReject;
  let resultResolve;
  let resultReject;
  let readySettled = false;
  let resultSettled = false;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const result = new Promise((resolve, reject) => {
    resultResolve = resolve;
    resultReject = reject;
  });
  worker.on("message", (message) => {
    if (message?.status === "ready") {
      readySettled = true;
      readyResolve();
    } else {
      resultSettled = true;
      resultResolve(message);
    }
  });
  worker.once("error", (error) => {
    readyReject(error);
    resultReject(error);
  });
  worker.once("exit", (code) => {
    if (code !== 0 || !resultSettled) {
      const error = new Error(`package-stage-worker-${code}`);
      if (!readySettled) readyReject(error);
      resultReject(error);
    }
  });
  return Object.freeze({
    ready,
    result,
    start() {
      worker.postMessage("go");
    }
  });
}

function packageById(packageId) {
  return plan.packages.find((item) => item.packageId === packageId);
}

function assertCode(expected, callback) {
  assert.throws(callback, (error) => error?.code === expected);
}

function writeTarText(buffer, offset, length, value) {
  const bytes = Buffer.from(value, "ascii");
  assert.ok(bytes.length <= length);
  bytes.copy(buffer, offset);
}

function writeTarOctal(buffer, offset, length, value) {
  const text = value.toString(8).padStart(length - 2, "0");
  writeTarText(buffer, offset, length, `${text} \0`);
}

function tarHeader({ archivePath, bytes, mode = 0o644, type = "0" }) {
  const header = Buffer.alloc(512);
  writeTarText(header, 0, 100, archivePath);
  writeTarOctal(header, 100, 8, mode);
  writeTarOctal(header, 124, 12, bytes.length);
  writeTarOctal(header, 136, 12, 499_162_500);
  header.fill(0x20, 148, 156);
  writeTarText(header, 156, 1, type);
  writeTarText(header, 257, 6, "ustar\0");
  writeTarText(header, 263, 2, "00");
  writeTarOctal(header, 329, 8, 0);
  writeTarOctal(header, 337, 8, 0);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeTarOctal(header, 148, 8, checksum);
  return header;
}

function syntheticTar(entries) {
  const chunks = [];
  for (const entry of entries) {
    const bytes = Buffer.from(entry.bytes);
    chunks.push(tarHeader({ ...entry, bytes }), bytes);
    const padding = Math.ceil(bytes.length / 512) * 512 - bytes.length;
    if (padding !== 0) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

function canonicalGzip(bytes) {
  const output = gzipSync(bytes, { level: 9 });
  output[9] = 0xff;
  return output;
}

function packed(entries) {
  return canonicalGzip(syntheticTar(entries));
}

function mutateFirstHeader(entries, mutate) {
  const tar = syntheticTar(entries);
  mutate(tar.subarray(0, 512));
  tar.fill(0x20, 148, 156);
  writeTarOctal(tar, 148, 8, tar.subarray(0, 512)
    .reduce((sum, byte) => sum + byte, 0));
  return canonicalGzip(tar);
}

function expected(entries) {
  return new Map(entries.map((entry) => [
    entry.archivePath.slice("package/".length),
    {
      bytes: Buffer.from(entry.bytes),
      mode: entry.mode ?? 0o644,
      role: entry.role ?? "runtime"
    }
  ]));
}

async function reviewedExpectedFiles(item) {
  const output = new Map([[
    "package.json",
    {
      bytes: alphaPackageManifestBytes(plan, item),
      mode: 0o644,
      role: "manifest"
    }
  ]]);
  for (const entry of flattenPackageFiles(item)) {
    output.set(entry.target, {
      bytes: await readFile(path.join(repositoryRoot, ...entry.source.split("/"))),
      mode: entry.role === "bin" ? 0o755 : 0o644,
      role: entry.role
    });
  }
  return output;
}

test("the fixed stage packs and installs the complete alpha spine", async () => {
  assert.equal(firstEvidence.schemaVersion, 2);
  assert.equal(firstEvidence.evidenceType, "alpha-package-stage");
  assert.equal(firstEvidence.planId, plan.planId);
  assert.equal(firstEvidence.packagePlanSha256, packagePlanSha256);
  assert.match(firstEvidence.runtime.nodeVersion, /^(?:22|24)[.]/u);
  assert.match(firstEvidence.runtime.npmVersion, /^(?:10|11)[.]/u);
  assert.deepEqual(firstEvidence.packages.map((item) => [
    item.packageId,
    item.fileCount
  ]), [
    ["cli", 11],
    ["core", 50],
    ["native-card-arrow", 12],
    ["public-synthetic", 23]
  ]);
  for (const item of firstEvidence.packages) {
    assert.ok(item.compressedBytes <= ALPHA_TARBALL_LIMITS.compressedBytes);
    assert.ok(item.unpackedBytes <= ALPHA_TARBALL_LIMITS.unpackedBytes);
    assert.ok(item.fileCount <= ALPHA_TARBALL_LIMITS.files);
    assert.match(item.sha256, /^[a-f0-9]{64}$/u);
  }
  assert.deepEqual(firstEvidence.smoke.commands.map((item) => item.command), [
    "init", "inspect", "validate", "render", "qa"
  ]);
  assert.deepEqual(firstEvidence.smoke.commands, [
    { command: "init", exitCode: 0, ok: true },
    { command: "inspect", exitCode: 0, ok: true },
    { command: "validate", exitCode: 0, ok: true },
    { command: "render", exitCode: 0, ok: true },
    { command: "qa", exitCode: 0, ok: true }
  ]);
  assert.equal(firstEvidence.smoke.startedFromUnrelatedCwd, true);
  assert.equal(firstEvidence.smoke.qaDecision, "blocked");
  assert.equal(firstEvidence.smoke.buildArtifactPresent, false);
  assert.deepEqual(firstEvidence.smoke.deliveryFiles, [
    "public-synthetic-native-card-deck.candidate.json",
    "public-synthetic-native-card-deck.pptx",
    "public-synthetic-native-card-deck.qa.json"
  ]);
  assert.deepEqual((await readdir(path.dirname(reviewedRoot))).sort(), [
    ".owner.json",
    "npm",
    "reviewed"
  ]);
  assert.deepEqual((await readdir(reviewedRoot)).sort(), [
    ".complete.json",
    "package-evidence.json",
    "tarballs"
  ]);
  const evidenceBytes = Buffer.from(`${JSON.stringify(firstEvidence, null, 2)}\n`);
  assert.deepEqual(await readFile(path.join(reviewedRoot, "package-evidence.json")), evidenceBytes);
  const completion = JSON.parse(await readFile(
    path.join(reviewedRoot, ".complete.json"),
    "utf8"
  ));
  assert.deepEqual(completion, {
    schemaVersion: 2,
    owner: "pptx-pipeline-alpha-package-stage",
    planId: plan.planId,
    packagePlanSha256,
    packageVersion: plan.packageVersion,
    state: "reviewed",
    evidence: firstEvidence
  });
});

test("completion evidence binds the complete canonical package plan", async (t) => {
  const changed = structuredClone(plan);
  changed.repository.repositoryId = "1330979134";
  assert.equal(await reviewedStageComplete(reviewedRoot, changed), false);

  const mutationRoot = await mkdtemp(path.join(os.tmpdir(), "pptx-stage-proof."));
  t.after(async () => rm(mutationRoot, { recursive: true, force: true }));
  for (const [name, mutate] of [
    ["legacy-v1", ({ evidence, completion }) => {
      evidence.schemaVersion = 1;
      completion.schemaVersion = 1;
    }],
    ["missing-plan-fingerprint", ({ evidence, completion }) => {
      delete evidence.packagePlanSha256;
      delete completion.packagePlanSha256;
    }],
    ["changed-plan-fingerprint", ({ evidence, completion }) => {
      evidence.packagePlanSha256 = "0".repeat(64);
      completion.packagePlanSha256 = "0".repeat(64);
    }]
  ]) {
    const candidateRoot = path.join(mutationRoot, name);
    await cp(reviewedRoot, candidateRoot, { recursive: true, errorOnExist: true });
    const evidencePath = path.join(candidateRoot, "package-evidence.json");
    const completionPath = path.join(candidateRoot, ".complete.json");
    const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
    const completion = JSON.parse(await readFile(completionPath, "utf8"));
    mutate({ evidence, completion });
    completion.evidence = evidence;
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    await writeFile(completionPath, `${JSON.stringify(completion, null, 2)}\n`);
    assert.equal(await reviewedStageComplete(candidateRoot, plan), false, name);
  }
});

test("repository-bound leaf manifests project the authorized public alpha channel", async () => {
  for (const item of plan.packages) {
    const manifest = createAlphaPackageManifest(plan, item);
    assert.equal(Object.hasOwn(manifest, "private"), false);
    if (item.packageId === "cli") {
      assert.deepEqual(manifest.bin, { "pptx-compiler": "pptx-compiler.mjs" });
    }
    assert.deepEqual(manifest.repository, {
      type: "git",
      url: "git+https://github.com/why7682/pptx-compiler.git",
      directory: item.repositoryDirectory
    });
    assert.deepEqual(manifest.publishConfig, {
      registry: "https://registry.npmjs.org/",
      tag: "alpha",
      access: "public",
      provenance: true
    });
    assert.equal(Object.hasOwn(manifest, "scripts"), false);
    assert.equal(manifest.version, plan.packageVersion);
    for (const version of Object.values(manifest.dependencies)) {
      assert.equal(version, plan.packageVersion);
      assert.doesNotMatch(version, /^(?:file|https?|git):/u);
    }
  }
  assert.ok(packageById("public-synthetic"));
  assert.ok(createAlphaPackageManifest(plan, packageById("public-synthetic")).files
    .includes("assets/fixtures/source-parts/minimal/parts/[[]Content_Types].xml"));
});

test("real tarballs are independently readable against exact planned bytes", async () => {
  for (const item of plan.packages) {
    const evidence = firstEvidence.packages.find((candidate) =>
      candidate.packageId === item.packageId);
    const tarballBytes = await readFile(path.join(reviewedRoot, "tarballs", evidence.tarball));
    const inspection = inspectAlphaTarball({
      tarballBytes,
      expectedFiles: await reviewedExpectedFiles(item),
      forbiddenPolicy: policy
    });
    assert.equal(inspection.sha256, evidence.sha256);
    assert.equal(inspection.fileCount, flattenPackageFiles(item).length + 1);
  }
});

test("an interrupted fixed stage restores the last complete review and rebuilds", async (t) => {
  const stageRoot = path.dirname(reviewedRoot);
  const previousRoot = path.join(stageRoot, "previous");
  const workRoot = path.join(stageRoot, "work");
  const failedRoot = path.join(stageRoot, "failed");
  let ownsPartial = false;
  t.after(async () => {
    if (!ownsPartial) return;
    assert.equal(await reviewedStageComplete(reviewedRoot, plan), true);
    const entries = await readdir(failedRoot, { withFileTypes: true });
    assert.deepEqual(entries.map((entry) => [entry.name, entry.isFile()]), [
      ["partial", true]
    ]);
    assert.equal(await readFile(path.join(failedRoot, "partial"), "utf8"),
      "interrupted\n");
    await unlink(path.join(failedRoot, "partial"));
    await rmdir(failedRoot);
  });
  await rename(reviewedRoot, previousRoot);
  await cp(previousRoot, reviewedRoot, { recursive: true, errorOnExist: true });
  assert.equal(await reviewedStageComplete(reviewedRoot, plan), true);
  await unlink(path.join(
    reviewedRoot,
    "tarballs",
    firstEvidence.packages[0].tarball
  ));
  assert.equal(await reviewedStageComplete(reviewedRoot, plan), false);
  await mkdir(workRoot);
  await writeFile(path.join(workRoot, "partial"), "interrupted\n");
  ownsPartial = true;
  const workers = [createStageWorker(), createStageWorker()];
  await Promise.all(workers.map((worker) => worker.ready));
  for (const worker of workers) worker.start();
  const attempts = await Promise.all(workers.map((worker) => worker.result));
  const fulfilled = attempts.filter((entry) => entry.status === "fulfilled");
  const rejected = attempts.filter((entry) => entry.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].code, "package-stage-active");
  const secondPackages = fulfilled[0].packages;
  assert.deepEqual(
    secondPackages,
    firstEvidence.packages.map((item) => [item.packageId, item.sha256])
  );
  assert.deepEqual((await readdir(path.dirname(reviewedRoot))).sort(), [
    ".owner.json",
    "failed",
    "npm",
    "reviewed"
  ]);
  assert.equal(
    await readFile(path.join(path.dirname(reviewedRoot), "failed", "partial"), "utf8"),
    "interrupted\n"
  );
  assert.deepEqual((await readdir(reviewedRoot)).sort(), [
    ".complete.json",
    "package-evidence.json",
    "tarballs"
  ]);
});

test("a complete review survives partial previous cleanup and a dead partial claim", async (t) => {
  const stageRoot = path.dirname(reviewedRoot);
  const previousRoot = path.join(stageRoot, "previous");
  const emptyDebris = path.join(stageRoot, "reviewed 2");
  const reviewedDebris = path.join(reviewedRoot, "package-evidence 2");
  const tarballDebris = path.join(reviewedRoot, "tarballs", "tarballs 2");
  const exited = spawnSync(process.execPath, ["-e", ""], {
    stdio: "ignore",
    windowsHide: true
  });
  assert.equal(exited.status, 0);
  assert.ok(Number.isSafeInteger(exited.pid) && exited.pid > 0);
  const deadClaim = path.join(
    stageRoot,
    `.claim-${exited.pid}-00000000-0000-4000-8000-000000000000.json`
  );
  const liveClaim = path.join(
    stageRoot,
    `.claim-${process.pid}-11111111-1111-4111-8111-111111111111.json`
  );
  let ownsLiveClaim = false;
  t.after(async () => {
    if (!ownsLiveClaim) return;
    const metadata = await lstat(liveClaim);
    assert.equal(metadata.isFile(), true);
    assert.equal(metadata.isSymbolicLink(), false);
    assert.equal(metadata.size, 0);
    await unlink(liveClaim);
  });
  await writeFile(liveClaim, Buffer.alloc(0), { flag: "wx", mode: 0o600 });
  ownsLiveClaim = true;
  await assert.rejects(
    buildAlphaPackageStage(),
    (error) => error?.code === "package-stage-active"
  );
  const liveClaimMetadata = await lstat(liveClaim);
  assert.equal(liveClaimMetadata.isFile(), true);
  assert.equal(liveClaimMetadata.size, 0);
  await unlink(liveClaim);
  ownsLiveClaim = false;
  await cp(reviewedRoot, previousRoot, { recursive: true, errorOnExist: true });
  await unlink(path.join(
    previousRoot,
    "tarballs",
    firstEvidence.packages[0].tarball
  ));
  await unlink(path.join(previousRoot, "package-evidence.json"));
  await writeFile(deadClaim, Buffer.alloc(0));
  await mkdir(emptyDebris);
  await mkdir(reviewedDebris);
  await mkdir(tarballDebris);
  const rebuilt = await buildAlphaPackageStage();
  assert.deepEqual(
    rebuilt.packages.map((item) => [item.packageId, item.sha256]),
    firstEvidence.packages.map((item) => [item.packageId, item.sha256])
  );
  await assert.rejects(lstat(deadClaim), (error) => error?.code === "ENOENT");
  await assert.rejects(lstat(emptyDebris), (error) => error?.code === "ENOENT");
  await assert.rejects(lstat(reviewedDebris), (error) => error?.code === "ENOENT");
  await assert.rejects(lstat(tarballDebris), (error) => error?.code === "ENOENT");
  assert.deepEqual((await readdir(stageRoot)).sort(), [
    ".owner.json",
    "npm",
    "reviewed"
  ]);
});

test("a pre-marker interruption quarantines the new candidate and restores last-good", async () => {
  const stageRoot = path.dirname(reviewedRoot);
  const previousRoot = path.join(stageRoot, "previous");
  const failedRoot = path.join(stageRoot, "failed");
  await rename(reviewedRoot, previousRoot);
  await cp(previousRoot, reviewedRoot, { recursive: true, errorOnExist: true });
  await unlink(path.join(reviewedRoot, ".complete.json"));

  const rebuilt = await buildAlphaPackageStage();
  assert.deepEqual(
    rebuilt.packages.map((item) => [item.packageId, item.sha256]),
    firstEvidence.packages.map((item) => [item.packageId, item.sha256])
  );
  assert.equal(await reviewedStageComplete(reviewedRoot, plan), true);
  assert.deepEqual((await readdir(failedRoot)).sort(), [
    "package-evidence.json",
    "tarballs"
  ]);
  assert.deepEqual(
    (await readdir(path.join(failedRoot, "tarballs"))).sort(),
    firstEvidence.packages.map((item) => item.tarball).sort()
  );

  for (const item of firstEvidence.packages) {
    await unlink(path.join(failedRoot, "tarballs", item.tarball));
  }
  await rmdir(path.join(failedRoot, "tarballs"));
  await unlink(path.join(failedRoot, "package-evidence.json"));
  await rmdir(failedRoot);
});

test("an unowned stage never deletes an owner candidate before adoption", async () => {
  const mutationRoot = path.join(path.dirname(reviewedRoot), "owner-mutation-root");
  const mutationPlan = Object.freeze({ ...plan, stagingRoot: ".isolated-stage" });
  const stageRoot = path.join(mutationRoot, mutationPlan.stagingRoot);
  const candidate = path.join(
    stageRoot,
    ".owner-candidate-00000000-0000-4000-8000-000000000000.json"
  );
  const candidateBytes = Buffer.from(`${JSON.stringify({
    schemaVersion: 1,
    owner: "pptx-pipeline-alpha-package-stage",
    planId: plan.planId
  }, null, 2)}\n`);
  await mkdir(stageRoot, { recursive: true });
  await writeFile(candidate, candidateBytes);
  try {
    await assert.rejects(
      ensureOwnedStageRoot(mutationRoot, mutationPlan),
      (error) => error?.code === "package-stage-owner"
    );
    assert.deepEqual(await readFile(candidate), candidateBytes);
    await assert.rejects(
      lstat(path.join(stageRoot, ".owner.json")),
      (error) => error?.code === "ENOENT"
    );
  } finally {
    await unlink(candidate).catch(() => {});
    await rmdir(stageRoot).catch(() => {});
    await rmdir(mutationRoot).catch(() => {});
  }
});

test("recovery preserves every unproved previous entry and type", async () => {
  const stageRoot = path.dirname(reviewedRoot);
  const previousRoot = path.join(stageRoot, "previous");
  const foreignDirectory = path.join(previousRoot, "foreign-directory");
  const foreignPayload = path.join(foreignDirectory, "payload");
  const foreignFile = path.join(previousRoot, "foreign-file");
  const foreignLink = path.join(previousRoot, "foreign-link");
  const selectedTarball = path.join(
    previousRoot,
    "tarballs",
    firstEvidence.packages[0].tarball
  );
  const markerPath = path.join(previousRoot, ".complete.json");
  await cp(reviewedRoot, previousRoot, { recursive: true, errorOnExist: true });
  await mkdir(foreignDirectory);
  await writeFile(foreignPayload, "foreign payload\n");
  await writeFile(foreignFile, "foreign file\n");
  if (process.platform !== "win32") {
    await symlink("foreign-directory/payload", foreignLink);
  }
  await assert.rejects(
    buildAlphaPackageStage(),
    (error) => error?.code === "package-stage-unexpected-entry"
  );
  assert.equal(await readFile(foreignPayload, "utf8"), "foreign payload\n");
  assert.equal(await readFile(foreignFile, "utf8"), "foreign file\n");
  if (process.platform !== "win32") {
    assert.equal(await readlink(foreignLink), "foreign-directory/payload");
    await unlink(foreignLink);
  }
  await unlink(foreignFile);
  await unlink(foreignPayload);
  await rmdir(foreignDirectory);

  const tarballBytes = await readFile(selectedTarball);
  await unlink(selectedTarball);
  await mkdir(selectedTarball);
  await assert.rejects(
    buildAlphaPackageStage(),
    (error) => error?.code === "package-stage-recovery"
  );
  assert.equal((await lstat(selectedTarball)).isDirectory(), true);
  await rmdir(selectedTarball);
  await writeFile(selectedTarball, tarballBytes);

  const markerBytes = await readFile(markerPath);
  await unlink(markerPath);
  await assert.rejects(
    buildAlphaPackageStage(),
    (error) => error?.code === "package-stage-recovery"
  );
  assert.equal(
    await readFile(path.join(previousRoot, "package-evidence.json"), "utf8"),
    await readFile(path.join(reviewedRoot, "package-evidence.json"), "utf8")
  );
  assert.deepEqual(await readFile(selectedTarball), tarballBytes);
  await writeFile(markerPath, markerBytes);

  const rebuilt = await buildAlphaPackageStage();
  assert.deepEqual(
    rebuilt.packages.map((item) => [item.packageId, item.sha256]),
    firstEvidence.packages.map((item) => [item.packageId, item.sha256])
  );
  await assert.rejects(lstat(previousRoot), (error) => error?.code === "ENOENT");
});

test("an occupied quarantine is preserved and never cleared for a new attempt", async () => {
  const stageRoot = path.dirname(reviewedRoot);
  const failedRoot = path.join(stageRoot, "failed");
  const failedPayload = path.join(failedRoot, "preserved");
  const workRoot = path.join(stageRoot, "work");
  const workPayload = path.join(workRoot, "interrupted");
  await mkdir(failedRoot);
  await writeFile(failedPayload, "preserved failure\n");
  await mkdir(workRoot);
  await writeFile(workPayload, "interrupted work\n");
  await assert.rejects(
    buildAlphaPackageStage(),
    (error) => error?.code === "package-stage-recovery"
  );
  assert.equal(await readFile(failedPayload, "utf8"), "preserved failure\n");
  assert.equal(await readFile(workPayload, "utf8"), "interrupted work\n");
  await unlink(workPayload);
  await rmdir(workRoot);

  const rebuilt = await buildAlphaPackageStage();
  assert.deepEqual(
    rebuilt.packages.map((item) => [item.packageId, item.sha256]),
    firstEvidence.packages.map((item) => [item.packageId, item.sha256])
  );
  assert.equal(await readFile(failedPayload, "utf8"), "preserved failure\n");
  await unlink(failedPayload);
  await rmdir(failedRoot);
});

test("the product stage implementation has no recursive deletion primitive", async () => {
  const source = await readFile(
    path.join(repositoryRoot, "scripts", "lib", "package-stage.mjs"),
    "utf8"
  );
  assert.doesNotMatch(source, /\brm\s*\(/u);
  const start = source.indexOf("async function removeAuthenticatedReviewedCandidate");
  const end = source.indexOf("async function quarantineDirectory", start);
  assert.ok(start >= 0 && end > start);
  const removal = source.slice(start, end);
  const tarballUnlink = removal.indexOf("await unlink(tarballPath)");
  const tarballSync = removal.indexOf("await syncDirectory(tarballRoot)", tarballUnlink);
  const tarballRmdir = removal.indexOf("await rmdir(tarballRoot)", tarballSync);
  const candidateSyncAfterTarballs = removal.indexOf(
    "await syncDirectory(candidate)",
    tarballRmdir
  );
  const evidenceUnlink = removal.indexOf("await unlink(evidencePath)");
  const candidateSyncAfterEvidence = removal.indexOf(
    "await syncDirectory(candidate)",
    evidenceUnlink
  );
  const markerUnlink = removal.indexOf("await unlink(markerPath)");
  assert.ok(tarballUnlink >= 0 && tarballUnlink < tarballSync);
  assert.ok(tarballSync < tarballRmdir && tarballRmdir < candidateSyncAfterTarballs);
  assert.ok(evidenceUnlink >= 0 && evidenceUnlink < candidateSyncAfterEvidence);
  assert.ok(candidateSyncAfterEvidence < markerUnlink);
});

test("readable plan and policy bytes remain retained control inputs", async () => {
  const mutationRoot = path.join(path.dirname(reviewedRoot), "control-mutation");
  const planPath = path.join(mutationRoot, "packaging", "alpha-package-plan.json");
  const policyPath = path.join(mutationRoot, "policy", "forbidden-materials.json");
  const ignorePath = path.join(mutationRoot, ".gitignore");
  const planBytes = await readFile(path.join(repositoryRoot, "packaging", "alpha-package-plan.json"));
  const policyBytes = await readFile(path.join(repositoryRoot, "policy", "forbidden-materials.json"));
  const ignoreBytes = await readFile(path.join(repositoryRoot, ".gitignore"));
  await rm(mutationRoot, { recursive: true, force: true });
  await mkdir(path.dirname(planPath), { recursive: true });
  await mkdir(path.dirname(policyPath), { recursive: true });
  try {
    await writeFile(planPath, planBytes);
    await writeFile(policyPath, policyBytes);
    await writeFile(ignorePath, ignoreBytes);
    await verifyAlphaControlSnapshots({
      root: mutationRoot,
      planBytes,
      policyBytes,
      ignoreBytes
    });

    const changedPlan = JSON.parse(planBytes.toString("utf8"));
    changedPlan.namePolicy.checkedOn = "2026-08-12";
    await writeFile(planPath, `${JSON.stringify(changedPlan, null, 2)}\n`);
    await assert.rejects(
      verifyAlphaControlSnapshots({ root: mutationRoot, planBytes, policyBytes, ignoreBytes }),
      (error) => error?.code === "package-control-changed"
    );

    await writeFile(planPath, planBytes);
    await writeFile(policyPath, Buffer.concat([policyBytes, Buffer.from("\n")]));
    await assert.rejects(
      verifyAlphaControlSnapshots({ root: mutationRoot, planBytes, policyBytes, ignoreBytes }),
      (error) => error?.code === "package-control-changed"
    );

    await writeFile(policyPath, policyBytes);
    await writeFile(ignorePath, Buffer.concat([ignoreBytes, Buffer.from("\n")]));
    await assert.rejects(
      verifyAlphaControlSnapshots({ root: mutationRoot, planBytes, policyBytes, ignoreBytes }),
      (error) => error?.code === "package-control-changed"
    );
  } finally {
    await rm(mutationRoot, { recursive: true, force: true });
  }
});

test("package semantics are revalidated from the exact materialized source snapshot", async () => {
  const snapshots = new Map();
  for (const item of plan.packages) {
    for (const entry of flattenPackageFiles(item)) {
      if (snapshots.has(entry.source)) continue;
      const sourcePath = path.join(repositoryRoot, ...entry.source.split("/"));
      snapshots.set(entry.source, {
        bytes: await readFile(sourcePath),
        mode: (await lstat(sourcePath)).mode
      });
    }
  }
  const changed = new Map(snapshots);
  changed.set("packages/cli/src/index.mjs", {
    ...changed.get("packages/cli/src/index.mjs"),
    bytes: Buffer.from("const moduleName = './cli.mjs';\nimport(moduleName);\n")
  });
  const findings = await validateAlphaPackagePlan(plan, {
    root: repositoryRoot,
    sourceSnapshots: changed,
    ignoreBytes: await readFile(path.join(repositoryRoot, ".gitignore"))
  });
  assert.ok(findings.some((finding) => finding.code === "package-dynamic-import" &&
    finding.pointer === "/sources/packages/cli/src/index.mjs"));
});

test("a tarball replacement after inspection fails the retained-byte check", async () => {
  const mutationRoot = path.join(repositoryRoot, plan.stagingRoot, "snapshot-mutation");
  const selected = firstEvidence.packages[0];
  const original = await readFile(path.join(reviewedRoot, "tarballs", selected.tarball));
  await rm(mutationRoot, { recursive: true, force: true });
  await mkdir(mutationRoot);
  try {
    await writeFile(path.join(mutationRoot, selected.tarball), Buffer.concat([
      original,
      Buffer.from([0])
    ]));
    await assert.rejects(
      verifyAlphaTarballSnapshots([{
        filename: selected.tarball,
        tarballBytes: original
      }], mutationRoot),
      (error) => error?.code === "package-tarball-changed"
    );
  } finally {
    await rm(mutationRoot, { recursive: true, force: true });
  }
});

test("fixed stage rejects unknown root entries without guessing ownership", async () => {
  const unexpected = path.join(path.dirname(reviewedRoot), "unexpected-entry");
  const payload = path.join(unexpected, "payload");
  await mkdir(unexpected);
  await writeFile(payload, "not owned\n");
  try {
    await assert.rejects(
      buildAlphaPackageStage(),
      (error) => error?.code === "package-stage-unexpected-entry"
    );
  } finally {
    await unlink(payload);
    await rmdir(unexpected);
  }
});

test("installed bin and smoke project inventories reject missing or extra files", () => {
  assert.equal(assertAlphaInstalledBinNames(["pptx-compiler"], {
    platform: "darwin"
  }), true);
  assert.equal(assertAlphaInstalledBinNames([
    "pptx-compiler",
    "pptx-compiler.cmd",
    "pptx-compiler.ps1"
  ], { platform: "win32" }), true);
  assertCode("installed-bin-inventory", () => assertAlphaInstalledBinNames([
    "pptx-compiler",
    "unexpected"
  ], { platform: "linux" }));
  assertCode("installed-bin-inventory", () => assertAlphaInstalledBinNames([], {
    platform: "linux"
  }));

  const projectFiles = [
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
  ];
  assert.equal(assertAlphaSmokeProjectFiles(projectFiles), true);
  assertCode("installed-project-inventory", () => assertAlphaSmokeProjectFiles([
    ...projectFiles,
    "unexpected.json"
  ]));
  assertCode("installed-project-inventory", () => assertAlphaSmokeProjectFiles(
    projectFiles.slice(1)
  ));
});

test("Windows flushes owned tarball files without claiming a directory barrier", () => {
  const windowsFlags = alphaRegularFileSyncFlags({ platform: "win32" });
  const posixFlags = alphaRegularFileSyncFlags({ platform: "linux" });
  assert.notEqual(windowsFlags & 2, 0);
  assert.equal(posixFlags & 2, 0);
});

test("package-plan reserves one tar member for the generated manifest", async () => {
  const mutated = structuredClone(plan);
  const cli = mutated.packages.find((item) => item.packageId === "cli");
  cli.files = [{
    sourceRoot: "packages/cli",
    targetRoot: ".",
    role: "runtime",
    paths: Array.from({ length: 300 }, (_, index) =>
      `src/synthetic-${String(index).padStart(3, "0")}.mjs`)
  }];
  const findings = await validateAlphaPackagePlan(mutated, { root: repositoryRoot });
  assert.ok(findings.some((finding) => finding.code === "package-file-count"));
});

test("strict tar parsing rejects structure, allowlist, and executable drift", () => {
  const safe = [{
    archivePath: "package/safe.txt",
    bytes: Buffer.from("synthetic text\n"),
    mode: 0o644,
    role: "runtime"
  }];
  assertCode("tar-allowlist", () => inspectAlphaTarball({
    tarballBytes: packed([{ ...safe[0], archivePath: "package/extra.txt" }]),
    expectedFiles: expected(safe),
    forbiddenPolicy: policy
  }));
  assertCode("tar-path", () => inspectAlphaTarball({
    tarballBytes: packed([{ ...safe[0], archivePath: "package/../escape.txt" }]),
    expectedFiles: expected(safe),
    forbiddenPolicy: policy
  }));
  assertCode("tar-entry-type", () => inspectAlphaTarball({
    tarballBytes: packed([{ ...safe[0], type: "2" }]),
    expectedFiles: expected(safe),
    forbiddenPolicy: policy
  }));

  const brokenChecksum = syntheticTar(safe);
  brokenChecksum[0] ^= 1;
  assertCode("tar-checksum", () => inspectAlphaTarball({
    tarballBytes: canonicalGzip(brokenChecksum),
    expectedFiles: expected(safe),
    forbiddenPolicy: policy
  }));

  const executable = [{ ...safe[0], mode: 0o755, role: "runtime" }];
  assertCode("tar-executable-boundary", () => inspectAlphaTarball({
    tarballBytes: packed(executable),
    expectedFiles: expected(executable),
    forbiddenPolicy: policy
  }));
  assertCode("tar-mode", () => inspectAlphaTarball({
    tarballBytes: packed([{ ...safe[0], mode: 0o4755 }]),
    expectedFiles: expected(safe),
    forbiddenPolicy: policy
  }));

  const secondMember = gzipSync(Buffer.alloc(512));
  const hiddenName = Buffer.from(["/", "Users/", "synthetic/secret"].join(""));
  const namedSecondMember = Buffer.concat([
    secondMember.subarray(0, 3),
    Buffer.from([secondMember[3] | 0x08]),
    secondMember.subarray(4, 10),
    hiddenName,
    Buffer.from([0]),
    secondMember.subarray(10)
  ]);
  assertCode("tar-gzip-envelope", () => inspectAlphaTarball({
    tarballBytes: Buffer.concat([packed(safe), namedSecondMember]),
    expectedFiles: expected(safe),
    forbiddenPolicy: policy
  }));
});

test("strict npm tar metadata rejects hidden or drifting header bytes", () => {
  const safe = [{
    archivePath: "package/safe.txt",
    bytes: Buffer.from("synthetic text\n"),
    mode: 0o644,
    role: "runtime"
  }];
  const inspect = (tarballBytes) => inspectAlphaTarball({
    tarballBytes,
    expectedFiles: expected(safe),
    forbiddenPolicy: policy
  });

  const hiddenOwner = Buffer.from([0, 0x50, 0x52, 0x49, 0x56, 0x41, 0x54, 0x45]);
  assertCode("tar-owner-id", () => inspect(mutateFirstHeader(safe, (header) => {
    hiddenOwner.copy(header, 108);
  })));
  assertCode("tar-mtime", () => inspect(mutateFirstHeader(safe, (header) => {
    writeTarOctal(header, 136, 12, 0);
  })));
  assertCode("tar-device", () => inspect(mutateFirstHeader(safe, (header) => {
    hiddenOwner.copy(header, 329);
  })));
  assertCode("tar-header-padding", () => inspect(mutateFirstHeader(safe, (header) => {
    header[500] = 1;
  })));

  const wrongOs = packed(safe);
  wrongOs[9] = 0x03;
  assertCode("tar-gzip-header", () => inspect(wrongOs));
  const wrongCompressionFlag = packed(safe);
  wrongCompressionFlag[8] = 0;
  assertCode("tar-gzip-header", () => inspect(wrongCompressionFlag));

  assertCode("tar-entry-type", () => inspect(mutateFirstHeader(safe, (header) => {
    header[156] = 0;
  })));
  const hiddenChecksumSuffix = syntheticTar(safe);
  hiddenChecksumSuffix[154] = 0;
  hiddenChecksumSuffix[155] = 0x58;
  assertCode("tar-checksum", () => inspect(canonicalGzip(hiddenChecksumSuffix)));

  const alternateDeflate = gzipSync(syntheticTar(safe), { level: 8 });
  alternateDeflate[8] = 0x02;
  alternateDeflate[9] = 0xff;
  assertCode("tar-gzip-canonical", () => inspect(alternateDeflate));
});

test("strict npm tar order and trailer have one canonical representation", () => {
  const entries = [
    {
      archivePath: "package/b.txt",
      bytes: Buffer.from("b\n"),
      mode: 0o644,
      role: "runtime"
    },
    {
      archivePath: "package/a.txt",
      bytes: Buffer.from("a\n"),
      mode: 0o644,
      role: "runtime"
    }
  ];
  assertCode("tar-order", () => inspectAlphaTarball({
    tarballBytes: packed(entries),
    expectedFiles: expected(entries),
    forbiddenPolicy: policy
  }));

  const canonical = syntheticTar([entries[1], entries[0]]);
  assertCode("tar-trailer", () => inspectAlphaTarball({
    tarballBytes: canonicalGzip(Buffer.concat([canonical, Buffer.alloc(512)])),
    expectedFiles: expected(entries),
    forbiddenPolicy: policy
  }));
});

test("tarball limits reject oversized compressed, member, aggregate, and count inputs", () => {
  const dummy = new Map([["safe.txt", {
    bytes: Buffer.from("x"), mode: 0o644, role: "runtime"
  }]]);
  assertCode("tar-compressed-size", () => inspectAlphaTarball({
    tarballBytes: Buffer.alloc(ALPHA_TARBALL_LIMITS.compressedBytes + 1),
    expectedFiles: dummy,
    forbiddenPolicy: policy
  }));
  const namedGzip = packed([{
    archivePath: "package/safe.txt",
    bytes: Buffer.from("x"),
    mode: 0o644
  }]);
  namedGzip[3] = 0x08;
  assertCode("tar-gzip-header", () => inspectAlphaTarball({
    tarballBytes: namedGzip,
    expectedFiles: dummy,
    forbiddenPolicy: policy
  }));

  const oversizedFile = [{
    archivePath: "package/large.txt",
    bytes: Buffer.alloc(ALPHA_TARBALL_LIMITS.fileBytes + 1),
    mode: 0o644
  }];
  assertCode("tar-file-size", () => inspectAlphaTarball({
    tarballBytes: packed(oversizedFile),
    expectedFiles: dummy,
    forbiddenPolicy: policy
  }));

  const aggregate = Array.from({ length: 21 }, (_, index) => ({
    archivePath: `package/chunk-${String(index).padStart(2, "0")}.txt`,
    bytes: Buffer.alloc(1024 * 1024),
    mode: 0o644
  }));
  assertCode("tar-unpacked-size", () => inspectAlphaTarball({
    tarballBytes: packed(aggregate),
    expectedFiles: dummy,
    forbiddenPolicy: policy
  }));

  const many = Array.from({ length: 301 }, (_, index) => ({
    archivePath: `package/item-${String(index).padStart(3, "0")}.txt`,
    bytes: Buffer.alloc(0),
    mode: 0o644
  }));
  assertCode("tar-file-count", () => inspectAlphaTarball({
    tarballBytes: packed(many),
    expectedFiles: dummy,
    forbiddenPolicy: policy
  }));
});

test("packed members reuse forbidden magic and text policy", () => {
  for (const bytes of [
    Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("synthetic")]),
    Buffer.from(["-----BEGIN", " PRIVATE", " KEY-----\nsynthetic\n"].join(""))
  ]) {
    const entries = [{
      archivePath: "package/safe.txt",
      bytes,
      mode: 0o644,
      role: "runtime"
    }];
    assertCode("tar-forbidden-material", () => inspectAlphaTarball({
      tarballBytes: packed(entries),
      expectedFiles: expected(entries),
      forbiddenPolicy: policy
    }));
  }
});

test("npm output and public wrapper failures stay closed and redacted", async () => {
  assertCode("npm-pack-output", () => parseNpmPackOutput("not-json"));
  await assert.rejects(
    buildAlphaPackageStage({ nodeExecutable: fileURLToPath(import.meta.url) }),
    (error) => error?.code === "package-node-executable"
  );
  const usage = await runAlphaPackageBuild({ argv: ["--arbitrary-root"] });
  assert.deepEqual(usage, {
    exitCode: 2,
    report: {
      schemaVersion: 1,
      ok: false,
      error: { code: "PACKAGE_BUILD_USAGE" }
    }
  });
});
