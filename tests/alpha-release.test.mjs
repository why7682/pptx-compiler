import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import {
  ALPHA_FIXED_BUILDER,
  ALPHA_RELEASE_LOCK_PATH,
  ALPHA_RELEASE_PLAN_PATH,
  ALPHA_RELEASE_TAG_MESSAGE,
  ALPHA_RELEASE_TAG_NAME,
  ALPHA_VERIFICATION_BUILDER,
  canonicalAlphaReleaseLockText,
  canonicalAlphaReleasePlanText,
  compareAlphaRegistryTarball,
  createAlphaReleaseLock,
  decideAlphaPublicationRecovery,
  deriveAlphaPublicationOrder,
  generateAlphaReleaseLockFile,
  inspectAlphaReleaseCandidateSnapshot,
  inspectAlphaReleaseTag,
  loadAlphaReleasePlan,
  parseAlphaReleaseLockBytes,
  parseAlphaReleasePlanBytes,
  renderAlphaGitHubReleaseBody,
  validateAlphaReleaseCandidate,
  validateAlphaReleaseLock,
  validateAlphaReleasePlan,
  validateAlphaReviewedTarballs
} from "../scripts/lib/alpha-release.mjs";
import {
  canonicalAlphaPackagePlanText,
  flattenPackageFiles,
  loadAlphaPackagePlan
} from "../scripts/lib/package-plan.mjs";
import { projectAlphaPackageFiles } from "../scripts/lib/package-tarball.mjs";
import { compileForbiddenMaterialPolicy } from "../scripts/check-forbidden-materials.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const releasePlan = await loadAlphaReleasePlan({ root: repositoryRoot });
const packagePlan = await loadAlphaPackagePlan({ root: repositoryRoot });
const releasePlanBytes = await readFile(new URL(
  "../packaging/alpha-release-plan.json",
  import.meta.url
));
const forbiddenPolicyBytes = await readFile(new URL(
  "../policy/forbidden-materials.json",
  import.meta.url
));
const approvedFixtureIdentity = JSON.parse(forbiddenPolicyBytes)
  .approvedPublicIdentities[0];
const forbiddenPolicy = compileForbiddenMaterialPolicy(JSON.parse(forbiddenPolicyBytes));

function hash(algorithm, bytes) {
  return createHash(algorithm).update(bytes).digest("hex");
}

function packagePlanBytes() {
  return Buffer.from(canonicalAlphaPackagePlanText(packagePlan));
}

function lockedInputs() {
  return new Map(releasePlan.lockedInputs.map((inputPath) => [
    inputPath,
    inputPath === releasePlan.packagePlanPath
      ? packagePlanBytes()
      : Buffer.from(`reviewed:${inputPath}\n`)
  ]));
}

function projectedSourceBytes() {
  const inputs = lockedInputs();
  return new Map(packagePlan.packages.flatMap((item) =>
    flattenPackageFiles(item).map((entry) => [
      entry.source,
      inputs.get(entry.source) ?? Buffer.from(`tracked source:${entry.source}\n`)
    ])));
}

function projectedFilesById(sourceBytes = projectedSourceBytes()) {
  return new Map(packagePlan.packages.map((item) => [
    item.packageId,
    projectAlphaPackageFiles({ plan: packagePlan, item, sourceBytes })
  ]));
}

function projectedSourceModes() {
  return new Map(packagePlan.packages.flatMap((item) =>
    flattenPackageFiles(item).map((entry) => [
      entry.source,
      entry.role === "bin" ? "100755" : "100644"
    ])));
}

function reviewedTarballs({ compressionLevel = 9, contentSuffix = "" } = {}) {
  const tarHeader = (archivePath, content, mode) => {
    const header = Buffer.alloc(512);
    const writeText = (offset, length, value) =>
      Buffer.from(value, "ascii").copy(header, offset, 0, length);
    const writeOctal = (offset, length, value) =>
      writeText(offset, length, `${value.toString(8).padStart(length - 2, "0")} \0`);
    writeText(0, 100, archivePath);
    writeOctal(100, 8, mode);
    writeOctal(124, 12, content.length);
    writeOctal(136, 12, 499_162_500);
    header.fill(0x20, 148, 156);
    writeText(156, 1, "0");
    writeText(257, 6, "ustar\0");
    writeText(263, 2, "00");
    writeOctal(329, 8, 0);
    writeOctal(337, 8, 0);
    writeOctal(148, 8, header.reduce((sum, byte) => sum + byte, 0));
    return header;
  };
  const projected = projectedFilesById();
  return new Map(deriveAlphaPublicationOrder(packagePlan).map((entry) => {
    const files = [...projected.get(entry.packageId)]
      .sort(([left], [right]) => {
        const extension = (value) => path.posix.extname(value).toLowerCase();
        const basename = (value) => path.posix.basename(value).toLowerCase();
        return extension(left).localeCompare(extension(right), "en") ||
          basename(left).localeCompare(basename(right), "en") ||
          left.localeCompare(right, "en");
      });
    const tarMembers = files.flatMap(([target, expected], index) => {
      const content = index === 0 && contentSuffix !== ""
        ? Buffer.concat([expected.bytes, Buffer.from(contentSuffix)])
        : expected.bytes;
      const padding = Buffer.alloc(Math.ceil(content.length / 512) * 512 - content.length);
      return [tarHeader(`package/${target}`, content, expected.mode), content, padding];
    });
    const tar = Buffer.concat([...tarMembers, Buffer.alloc(1024)]);
    const compressed = gzipSync(tar, { level: compressionLevel, mtime: 0 });
    compressed[8] = 0x02;
    compressed[9] = 0xff;
    return [entry.packageId, compressed];
  }));
}

function packageEvidence(builder, tarballs = reviewedTarballs()) {
  const projected = projectedFilesById();
  return {
    schemaVersion: 2,
    evidenceType: "alpha-package-stage",
    planId: packagePlan.planId,
    packagePlanSha256: hash("sha256", packagePlanBytes()),
    packageVersion: packagePlan.packageVersion,
    runtime: { ...builder },
    packages: packagePlan.packages.map((item) => {
      const bytes = tarballs.get(item.packageId);
      const files = [...projected.get(item.packageId)].map(([target, expected]) => ({
        path: target,
        size: expected.bytes.length,
        mode: expected.mode
      })).sort((left, right) => left.path.localeCompare(right.path));
      return {
        packageId: item.packageId,
        name: item.name,
        tarball: deriveAlphaPublicationOrder(packagePlan)
          .find((entry) => entry.packageId === item.packageId).tarball,
        sha256: hash("sha256", bytes),
        compressedBytes: bytes.length,
        unpackedBytes: files.reduce((sum, file) => sum + file.size, 0),
        fileCount: files.length,
        files
      };
    }),
    install: {
      startedEmpty: true,
      offline: true,
      lifecycleScripts: "disabled",
      packageCount: packagePlan.packages.length
    },
    smoke: {
      startedFromUnrelatedCwd: true,
      commands: ["init", "inspect", "validate", "render", "qa"].map((command) => ({
        command,
        exitCode: 0,
        ok: true
      })),
      qaDecision: "blocked",
      buildArtifactPresent: false,
      deliveryFiles: [
        "public-synthetic-native-card-deck.candidate.json",
        "public-synthetic-native-card-deck.pptx",
        "public-synthetic-native-card-deck.qa.json"
      ]
    }
  };
}

function evidenceBytes(builder, tarballs = reviewedTarballs()) {
  return Buffer.from(`${JSON.stringify(packageEvidence(builder, tarballs), null, 2)}\n`);
}

function reviewedSource(builder, tarballs = reviewedTarballs()) {
  return {
    evidenceBytes: evidenceBytes(builder, tarballs),
    tarballBytes: tarballs
  };
}

function releaseLock() {
  const tarballs = reviewedTarballs();
  return createAlphaReleaseLock({
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs(),
    verification: reviewedSource(ALPHA_VERIFICATION_BUILDER, tarballs),
    fixed: reviewedSource(ALPHA_FIXED_BUILDER, tarballs),
    expectedFilesById: projectedFilesById(),
    sourceModes: projectedSourceModes(),
    forbiddenPolicy
  });
}

function candidate(lock = releaseLock()) {
  return {
    schemaVersion: 1,
    candidateType: "clean-exact-tag",
    tagName: ALPHA_RELEASE_TAG_NAME,
    tagObjectType: "annotated-tag",
    tagObjectOid: "a".repeat(40),
    tagTargetCommitOid: "b".repeat(40),
    headCommitOid: "b".repeat(40),
    tagTargetTreeOid: "c".repeat(40),
    headTreeOid: "c".repeat(40),
    targetCommitVerified: true,
    worktreeClean: true,
    shallowRepository: false,
    replaceRefs: false,
    grafts: false,
    alternates: false,
    releasePlanSha256: hash(
      "sha256",
      Buffer.from(canonicalAlphaReleasePlanText(releasePlan))
    ),
    packagePlanSha256: hash("sha256", packagePlanBytes()),
    releaseLockSha256: hash(
      "sha256",
      Buffer.from(canonicalAlphaReleaseLockText(lock))
    )
  };
}

function codes(findings) {
  return new Set(findings.map((finding) => finding.code));
}

async function writeReviewedStage(stageRoot, builder, tarballs = reviewedTarballs()) {
  const evidence = packageEvidence(builder, tarballs);
  await mkdir(path.join(stageRoot, "tarballs"), { recursive: true });
  await writeFile(
    path.join(stageRoot, "package-evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`
  );
  for (const entry of deriveAlphaPublicationOrder(packagePlan)) {
    await writeFile(
      path.join(stageRoot, "tarballs", entry.tarball),
      tarballs.get(entry.packageId)
    );
  }
  await writeFile(path.join(stageRoot, ".complete.json"), `${JSON.stringify({
    schemaVersion: 2,
    owner: "pptx-pipeline-alpha-package-stage",
    planId: packagePlan.planId,
    packagePlanSha256: hash("sha256", packagePlanBytes()),
    packageVersion: packagePlan.packageVersion,
    state: "reviewed",
    evidence
  }, null, 2)}\n`);
}

async function createLockGenerationFixture(t) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "pptx-alpha-release-lock."));
  t.after(async () => rm(temporary, { recursive: true, force: true }));
  const resolvedTemporary = await realpath(temporary);
  const root = path.join(resolvedTemporary, "repository");
  await mkdir(path.join(root, "packaging"), { recursive: true });
  await writeFile(
    path.join(root, ...ALPHA_RELEASE_PLAN_PATH.split("/")),
    canonicalAlphaReleasePlanText(releasePlan)
  );
  const inputs = lockedInputs();
  for (const inputPath of releasePlan.lockedInputs) {
    const absolute = path.join(root, ...inputPath.split("/"));
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, inputs.get(inputPath));
  }
  for (const [source, bytes] of projectedSourceBytes()) {
    const absolute = path.join(root, ...source.split("/"));
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);
    const role = packagePlan.packages.flatMap((item) => flattenPackageFiles(item))
      .find((entry) => entry.source === source)?.role;
    if (role === "bin") await chmod(absolute, 0o755);
  }
  await mkdir(path.join(root, "policy"), { recursive: true });
  await writeFile(path.join(root, "policy", "forbidden-materials.json"), forbiddenPolicyBytes);
  const cleanEnvironment = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => !key.toUpperCase().startsWith("GIT_")));
  const git = (...arguments_) => {
    const result = spawnSync("git", arguments_, {
      cwd: root,
      env: cleanEnvironment,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    assert.equal(result.status, 0, result.stderr);
  };
  git("init", "--quiet");
  git("config", "user.name", "Public Test");
  git("config", "user.email", ["public-test", "@", "example.invalid"].join(""));
  git("add", ".");
  git("commit", "--quiet", "-m", "public lock fixture");
  const verificationStage = path.join(resolvedTemporary, "verification-reviewed");
  const fixedStage = path.join(resolvedTemporary, "fixed-reviewed");
  await writeReviewedStage(verificationStage, ALPHA_VERIFICATION_BUILDER);
  await writeReviewedStage(fixedStage, ALPHA_FIXED_BUILDER);
  return { root, verificationStage, fixedStage, environment: cleanEnvironment };
}

async function createTagInspectionFixture(t, {
  trackedLock = true,
  ambientEnvironment = process.env
} = {}) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "pptx-alpha-release-tag."));
  t.after(async () => rm(temporary, { recursive: true, force: true }));
  const root = await realpath(temporary);
  const cleanEnvironment = Object.fromEntries(Object.entries(ambientEnvironment)
    .filter(([key]) => !key.toUpperCase().startsWith("GIT_") && key !== "GITHUB_SHA"));
  const run = (arguments_, { input } = {}) => {
    const result = spawnSync("git", arguments_, {
      cwd: root,
      env: cleanEnvironment,
      input,
      encoding: "utf8",
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"]
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const git = (...arguments_) => run(arguments_);
  git("init", "--quiet");
  git("config", "user.name", approvedFixtureIdentity);
  git("config", "user.email", ["approved-release", "@", "example.invalid"].join(""));
  await mkdir(path.join(root, "packaging"), { recursive: true });
  await writeFile(
    path.join(root, ...ALPHA_RELEASE_PLAN_PATH.split("/")),
    canonicalAlphaReleasePlanText(releasePlan)
  );
  for (const [relativePath, bytes] of lockedInputs()) {
    const absolutePath = path.join(root, ...relativePath.split("/"));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);
  }
  for (const [source, bytes] of projectedSourceBytes()) {
    const absolutePath = path.join(root, ...source.split("/"));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);
    const role = packagePlan.packages.flatMap((item) => flattenPackageFiles(item))
      .find((entry) => entry.source === source)?.role;
    if (role === "bin") await chmod(absolutePath, 0o755);
  }
  const policyPath = path.join(root, "policy", "forbidden-materials.json");
  await mkdir(path.dirname(policyPath), { recursive: true });
  await writeFile(policyPath, forbiddenPolicyBytes);
  if (trackedLock) {
    const lockPath = path.join(root, ...ALPHA_RELEASE_LOCK_PATH.split("/"));
    await mkdir(path.dirname(lockPath), { recursive: true });
    await writeFile(lockPath, canonicalAlphaReleaseLockText(releaseLock()));
  }
  git("add", ".");
  git("commit", "--quiet", "-m", "reviewed release candidate");
  git(
    "tag",
    "--annotate",
    ALPHA_RELEASE_TAG_NAME,
    "--message",
    ALPHA_RELEASE_TAG_MESSAGE
  );
  const commitOid = git("rev-parse", "HEAD^{commit}");
  const taggerEmail = git("log", "-1", "--format=%ae");
  const rawTag = ({
    taggerName = approvedFixtureIdentity,
    taggerAddress = taggerEmail,
    message = ALPHA_RELEASE_TAG_MESSAGE,
    extraHeader = ""
  } = {}) => Buffer.from(
    `object ${commitOid}\n` +
    "type commit\n" +
    `tag ${ALPHA_RELEASE_TAG_NAME}\n` +
    `tagger ${taggerName} <${taggerAddress}> 1700000000 +0000\n` +
    extraHeader +
    `\n${message}\n`
  );
  const installRawTag = (bytes) => {
    const objectId = run([
      "hash-object", "--literally", "-t", "tag", "-w", "--stdin"
    ], { input: bytes });
    git("update-ref", `refs/tags/${ALPHA_RELEASE_TAG_NAME}`, objectId);
    return objectId;
  };
  return {
    root,
    environment: cleanEnvironment,
    git,
    rawTag,
    installRawTag
  };
}

test("the release plan references the package plan as the sole npm authority", () => {
  assert.deepEqual(validateAlphaReleasePlan(releasePlan, { packagePlan }), []);
  assert.equal(releasePlan.releaseLockPath, ALPHA_RELEASE_LOCK_PATH);
  assert.equal(Object.hasOwn(releasePlan, "registry"), false);
  assert.equal(Object.hasOwn(releasePlan, "distTag"), false);
  assert.deepEqual(releasePlan.builders, {
    fixed: ALPHA_FIXED_BUILDER,
    verification: ALPHA_VERIFICATION_BUILDER,
    digestEquality: "exact-tar-payload-bytes"
  });
  assert.deepEqual(releasePlan.recovery, {
    absent: "publish-reviewed-tarball",
    exact: "continue",
    mismatch: "hard-stop",
    unpublish: false
  });
  assert.deepEqual(releasePlan.githubRelease, {
    order: "last",
    requiresCompleteRegistryVerification: true,
    name: "pptx-compiler 0.1.0-alpha.1",
    bodySource: "docs/releases/0.1.0-alpha.1.md",
    bodyProjection: "locked-note-plus-release-identity-v1",
    target: "source-tag-target",
    draft: false,
    prerelease: true,
    makeLatest: "false",
    generateReleaseNotes: false,
    assets: "none",
    idempotency: "create-or-exact"
  });
  assert.deepEqual(releasePlan.sourceTag, {
    name: ALPHA_RELEASE_TAG_NAME,
    type: "annotated",
    targetPolicy: "exact-clean-verified-commit",
    message: ALPHA_RELEASE_TAG_MESSAGE
  });
});

test("the release plan has one canonical JSON representation", () => {
  assert.deepEqual(parseAlphaReleasePlanBytes(releasePlanBytes), releasePlan);
  const text = releasePlanBytes.toString("utf8");
  assert.throws(() => parseAlphaReleasePlanBytes(Buffer.from(text.replace(
    '  "schemaVersion": 2,\n  "planId":',
    '  "planId": "shadow",\n  "schemaVersion": 2,\n  "planId":'
  ))), /alpha-release-plan-canonical/u);
});

test("publication order is derived from dependencies and keeps the CLI last", () => {
  assert.deepEqual(
    deriveAlphaPublicationOrder(packagePlan).map((entry) => entry.packageId),
    ["core", "native-card-arrow", "public-synthetic", "cli"]
  );

  const missing = structuredClone(packagePlan);
  missing.packages.find((entry) => entry.packageId === "cli")
    .dependencies[0].packageId = "missing";
  assert.throws(() => deriveAlphaPublicationOrder(missing), /alpha-release-package-graph/u);

  const cycle = structuredClone(packagePlan);
  cycle.packages.find((entry) => entry.packageId === "core").dependencies = [{
    packageId: "cli",
    version: cycle.packageVersion
  }];
  assert.throws(() => deriveAlphaPublicationOrder(cycle), /alpha-release-package-cycle/u);

  const earlyCli = structuredClone(packagePlan);
  earlyCli.packages.find((entry) => entry.packageId === "cli").dependencies = [];
  earlyCli.packages.find((entry) => entry.packageId === "public-synthetic").dependencies = [{
    packageId: "cli",
    version: earlyCli.packageVersion
  }];
  assert.throws(() => deriveAlphaPublicationOrder(earlyCli), /alpha-release-cli-not-last/u);
});

test("the GitHub Release body is a deterministic projection of locked facts", () => {
  const inputs = lockedInputs();
  const note = Buffer.from("# Locked alpha note\n\nLifecycle neutral.\n");
  inputs.set(releasePlan.githubRelease.bodySource, note);
  const tarballs = reviewedTarballs();
  const lock = createAlphaReleaseLock({
    releasePlan,
    packagePlan,
    inputBytes: inputs,
    verification: reviewedSource(ALPHA_VERIFICATION_BUILDER, tarballs),
    fixed: reviewedSource(ALPHA_FIXED_BUILDER, tarballs),
    expectedFilesById: projectedFilesById(),
    sourceModes: projectedSourceModes(),
    forbiddenPolicy
  });
  const targetCommitOid = "d".repeat(40);
  const body = renderAlphaGitHubReleaseBody({
    releasePlan,
    packagePlan,
    releaseLock: lock,
    inputBytes: inputs,
    releaseNoteBytes: note,
    targetCommitOid
  });
  assert.equal(body.startsWith(note.toString("utf8")), true);
  assert.match(body, /## Release identity/u);
  assert.match(body, new RegExp("Target commit: `" + targetCommitOid + "`", "u"));
  assert.equal((body.match(/^  - `pptx-compiler[^`]*@0[.]1[.]0-alpha[.]1`:/gmu) ?? [])
    .length, 4);
  assert.match(body, /does not broaden the support matrix/u);

  assert.throws(() => renderAlphaGitHubReleaseBody({
    releasePlan,
    packagePlan,
    releaseLock: lock,
    inputBytes: inputs,
    releaseNoteBytes: Buffer.from("drift\n"),
    targetCommitOid
  }), /alpha-release-github-body-lock/u);
  assert.throws(() => renderAlphaGitHubReleaseBody({
    releasePlan,
    packagePlan,
    releaseLock: lock,
    inputBytes: inputs,
    releaseNoteBytes: note,
    targetCommitOid: "not-a-commit"
  }), /alpha-release-github-body-input/u);
});

test("plan validation rejects duplicated or unauthorized npm policy", () => {
  const duplicated = structuredClone(releasePlan);
  duplicated.registry = "https://registry.npmjs.org/";
  assert(codes(validateAlphaReleasePlan(duplicated, { packagePlan }))
    .has("release-plan-shape"));

  const unauthorized = structuredClone(packagePlan);
  unauthorized.releaseGuard = { state: "blocked", reason: "not-authorized" };
  assert(codes(validateAlphaReleasePlan(releasePlan, { packagePlan: unauthorized }))
    .has("release-plan-authorization"));

  const drifted = structuredClone(packagePlan);
  drifted.publication.registry = "https://example.invalid/";
  assert(codes(validateAlphaReleasePlan(releasePlan, { packagePlan: drifted }))
    .has("release-plan-publication"));
});

test("the tracked lock binds six inputs, both envelopes, and one dual-builder tar payload", () => {
  const lock = releaseLock();
  const bytes = Buffer.from(canonicalAlphaReleaseLockText(lock));
  assert.match(lock.packageSourceProjectionSha256, /^[a-f0-9]{64}$/u);
  assert.equal(
    lock.packageSourceProjectionSha256,
    "3996c2499e49d8da640b2dff95a70e4d61e72102b67c3c6e934dc425d5dabff3"
  );
  assert.deepEqual(parseAlphaReleaseLockBytes(bytes), lock);
  assert.deepEqual(validateAlphaReleaseLock(lock, {
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs()
  }), []);
  assert.deepEqual(lock.builderResults.map((entry) => [
    entry.nodeVersion,
    entry.npmVersion,
    entry.evidenceSha256,
    entry.evidenceBytes
  ]), [
    [
      ALPHA_VERIFICATION_BUILDER.nodeVersion,
      ALPHA_VERIFICATION_BUILDER.npmVersion,
      hash("sha256", evidenceBytes(ALPHA_VERIFICATION_BUILDER)),
      evidenceBytes(ALPHA_VERIFICATION_BUILDER).length
    ],
    [
      ALPHA_FIXED_BUILDER.nodeVersion,
      ALPHA_FIXED_BUILDER.npmVersion,
      hash("sha256", evidenceBytes(ALPHA_FIXED_BUILDER)),
      evidenceBytes(ALPHA_FIXED_BUILDER).length
    ]
  ]);

  const builderDrift = structuredClone(lock);
  builderDrift.builderResults[1].packages[0].tarSha256 = "d".repeat(64);
  assert(codes(validateAlphaReleaseLock(builderDrift, {
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs()
  })).has("release-lock-builder-drift"));

  const missingProjection = structuredClone(lock);
  delete missingProjection.packageSourceProjectionSha256;
  assert(codes(validateAlphaReleaseLock(missingProjection, {
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs()
  })).has("release-lock-shape"));

  const malformedProjection = structuredClone(lock);
  malformedProjection.packageSourceProjectionSha256 = "not-a-sha256";
  assert(codes(validateAlphaReleaseLock(malformedProjection, {
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs()
  })).has("release-lock-package-source-projection"));

  const changedInputs = lockedInputs();
  changedInputs.set("CHANGELOG.md", Buffer.from("changed\n"));
  assert(codes(validateAlphaReleaseLock(lock, {
    releasePlan,
    packagePlan,
    inputBytes: changedInputs
  })).has("release-lock-input-digest"));
});

test("lock creation rejects runtime and tar-payload drift but admits distinct gzip envelopes", () => {
  const tarballs = reviewedTarballs();
  const incompleteSourceModes = projectedSourceModes();
  incompleteSourceModes.delete(incompleteSourceModes.keys().next().value);
  assert.throws(() => createAlphaReleaseLock({
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs(),
    verification: reviewedSource(ALPHA_VERIFICATION_BUILDER, tarballs),
    fixed: reviewedSource(ALPHA_FIXED_BUILDER, tarballs),
    expectedFilesById: projectedFilesById(),
    sourceModes: incompleteSourceModes,
    forbiddenPolicy
  }), /alpha-release-lock-source-projection/u);

  const extraSourceModes = projectedSourceModes();
  extraSourceModes.set("not/a/package-source.mjs", "100644");
  assert.throws(() => createAlphaReleaseLock({
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs(),
    verification: reviewedSource(ALPHA_VERIFICATION_BUILDER, tarballs),
    fixed: reviewedSource(ALPHA_FIXED_BUILDER, tarballs),
    expectedFilesById: projectedFilesById(),
    sourceModes: extraSourceModes,
    forbiddenPolicy
  }), /alpha-release-lock-source-projection/u);

  const wrongSourceModes = projectedSourceModes();
  const binSource = packagePlan.packages.flatMap((item) => flattenPackageFiles(item))
    .find((entry) => entry.role === "bin").source;
  wrongSourceModes.set(binSource, "100644");
  assert.throws(() => createAlphaReleaseLock({
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs(),
    verification: reviewedSource(ALPHA_VERIFICATION_BUILDER, tarballs),
    fixed: reviewedSource(ALPHA_FIXED_BUILDER, tarballs),
    expectedFilesById: projectedFilesById(),
    sourceModes: wrongSourceModes,
    forbiddenPolicy
  }), /alpha-release-lock-source-projection/u);

  const wrongRuntime = reviewedSource(ALPHA_VERIFICATION_BUILDER, tarballs);
  assert.throws(() => createAlphaReleaseLock({
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs(),
    verification: wrongRuntime,
    fixed: wrongRuntime,
    expectedFilesById: projectedFilesById(),
    sourceModes: projectedSourceModes(),
    forbiddenPolicy
  }), /alpha-release-evidence-contract/u);

  const differentFixedBytes = new Map(tarballs);
  differentFixedBytes.set("core", Buffer.from("same metadata cannot bless different bytes\n"));
  assert.throws(() => createAlphaReleaseLock({
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs(),
    verification: reviewedSource(ALPHA_VERIFICATION_BUILDER, tarballs),
    fixed: {
      evidenceBytes: evidenceBytes(ALPHA_FIXED_BUILDER, tarballs),
      tarballBytes: differentFixedBytes
    },
    expectedFilesById: projectedFilesById(),
    sourceModes: projectedSourceModes(),
    forbiddenPolicy
  }), /alpha-release-builder-tarball/u);

  const alternateEnvelope = reviewedTarballs({ compressionLevel: 8 });
  const envelopeLock = createAlphaReleaseLock({
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs(),
    verification: reviewedSource(ALPHA_VERIFICATION_BUILDER, tarballs),
    fixed: reviewedSource(ALPHA_FIXED_BUILDER, alternateEnvelope),
    expectedFilesById: projectedFilesById(),
    sourceModes: projectedSourceModes(),
    forbiddenPolicy
  });
  assert.notEqual(
    envelopeLock.builderResults[0].packages[0].sha256,
    envelopeLock.builderResults[1].packages[0].sha256
  );
  assert.equal(
    envelopeLock.builderResults[0].packages[0].tarSha256,
    envelopeLock.builderResults[1].packages[0].tarSha256
  );

  const changedPayload = reviewedTarballs({ contentSuffix: "-changed" });
  assert.throws(() => createAlphaReleaseLock({
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs(),
    verification: reviewedSource(ALPHA_VERIFICATION_BUILDER, tarballs),
    fixed: reviewedSource(ALPHA_FIXED_BUILDER, changedPayload),
    expectedFilesById: projectedFilesById(),
    sourceModes: projectedSourceModes(),
    forbiddenPolicy
  }), /tar-entry-content/u);

  const changedInputs = lockedInputs();
  changedInputs.set("docs/KNOWN_LIMITATIONS.md", Buffer.from("changed\n"));
  const lock = createAlphaReleaseLock({
    releasePlan,
    packagePlan,
    inputBytes: changedInputs,
    verification: reviewedSource(ALPHA_VERIFICATION_BUILDER, tarballs),
    fixed: reviewedSource(ALPHA_FIXED_BUILDER, tarballs),
    expectedFilesById: projectedFilesById(),
    sourceModes: projectedSourceModes(),
    forbiddenPolicy
  });
  assert(codes(validateAlphaReleaseLock(lock, {
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs()
  })).has("release-lock-input-digest"));
});

test("the fixed-builder reviewed evidence binds the retained tarball bytes", () => {
  const lock = releaseLock();
  const tarballs = reviewedTarballs();
  const fixedEvidence = packageEvidence(ALPHA_FIXED_BUILDER, tarballs);
  assert.deepEqual(validateAlphaReviewedTarballs({
    releaseLock: lock,
    packagePlan,
    packageEvidence: fixedEvidence,
    tarballBytes: tarballs
  }), []);

  const changed = new Map(tarballs);
  changed.set("core", Buffer.from("changed reviewed bytes\n"));
  assert(codes(validateAlphaReviewedTarballs({
    releaseLock: lock,
    packagePlan,
    packageEvidence: fixedEvidence,
    tarballBytes: changed
  })).has("release-reviewed-tarball"));

  const wrongRuntime = structuredClone(fixedEvidence);
  wrongRuntime.runtime = ALPHA_VERIFICATION_BUILDER;
  assert(codes(validateAlphaReviewedTarballs({
    releaseLock: lock,
    packagePlan,
    packageEvidence: wrongRuntime,
    tarballBytes: tarballs
  })).has("release-reviewed-evidence"));
});

test("a release candidate must be one clean exact annotated tag", () => {
  const lock = releaseLock();
  const valid = candidate(lock);
  assert.deepEqual(validateAlphaReleaseCandidate(valid, {
    releasePlan,
    packagePlan,
    releaseLock: lock
  }), []);

  const dirty = structuredClone(valid);
  dirty.worktreeClean = false;
  assert(codes(validateAlphaReleaseCandidate(dirty, {
    releasePlan,
    packagePlan,
    releaseLock: lock
  })).has("release-candidate-repository"));

  const retargeted = structuredClone(valid);
  retargeted.headCommitOid = "e".repeat(40);
  assert(codes(validateAlphaReleaseCandidate(retargeted, {
    releasePlan,
    packagePlan,
    releaseLock: lock
  })).has("release-candidate-target"));

  const unverified = structuredClone(valid);
  unverified.targetCommitVerified = false;
  assert(codes(validateAlphaReleaseCandidate(unverified, {
    releasePlan,
    packagePlan,
    releaseLock: lock
  })).has("release-candidate-repository"));
});

test("registry equality compares downloaded bytes rather than metadata", () => {
  const reviewed = Buffer.from("exact reviewed tgz bytes");
  const exact = compareAlphaRegistryTarball({
    reviewedTarball: reviewed,
    downloadedTarball: Buffer.from(reviewed)
  });
  assert.equal(exact.equal, true);
  assert.equal(exact.reviewed.sha256, exact.downloaded.sha256);

  const mismatch = compareAlphaRegistryTarball({
    reviewedTarball: reviewed,
    downloadedTarball: Buffer.from("different bytes")
  });
  assert.equal(mismatch.equal, false);
});

test("partial publication recovery is idempotent and mismatch stops permanently", () => {
  const reviewed = Buffer.from("reviewed tgz");
  assert.deepEqual(decideAlphaPublicationRecovery({
    registryState: "absent",
    reviewedTarball: reviewed
  }), { action: "publish-reviewed-tarball", mayContinue: true });

  const present = decideAlphaPublicationRecovery({
    registryState: "present",
    reviewedTarball: reviewed,
    downloadedTarball: Buffer.from(reviewed)
  });
  assert.equal(present.action, "continue");
  assert.equal(present.mayContinue, true);

  const mismatch = decideAlphaPublicationRecovery({
    registryState: "present",
    reviewedTarball: reviewed,
    downloadedTarball: Buffer.from("foreign tgz")
  });
  assert.equal(mismatch.action, "hard-stop");
  assert.equal(mismatch.mayContinue, false);
  assert.equal(mismatch.reason, "registry-tarball-mismatch");
  assert.equal(Object.hasOwn(mismatch, "unpublish"), false);
});

test("release-lock generation writes once from two complete external reviewed stages", async (t) => {
  const fixture = await createLockGenerationFixture(t);
  const ignoredLockPath = path.join(
    fixture.root,
    ...ALPHA_RELEASE_LOCK_PATH.split("/")
  );
  await mkdir(path.dirname(ignoredLockPath), { recursive: true });
  await writeFile(
    path.join(fixture.root, ".git", "info", "exclude"),
    `${ALPHA_RELEASE_LOCK_PATH}\n`
  );
  await writeFile(ignoredLockPath, "ignored lock cannot authorize release\n");
  await assert.rejects(
    () => generateAlphaReleaseLockFile(fixture),
    /alpha-release-lock-exists/u
  );
  await rm(ignoredLockPath);
  const dirtyPath = path.join(fixture.root, "untracked.txt");
  await writeFile(dirtyPath, "dirty\n");
  await assert.rejects(
    () => generateAlphaReleaseLockFile(fixture),
    /alpha-release-lock-workspace/u
  );
  await rm(dirtyPath);
  if (process.platform === "win32") {
    await assert.rejects(
      () => generateAlphaReleaseLockFile(fixture),
      /alpha-release-lock-directory-sync/u
    );
    return;
  }
  const forgedTarballs = reviewedTarballs({ contentSuffix: "-forged" });
  await writeReviewedStage(
    fixture.verificationStage,
    ALPHA_VERIFICATION_BUILDER,
    forgedTarballs
  );
  await assert.rejects(
    () => generateAlphaReleaseLockFile(fixture),
    /tar-entry-content/u
  );
  await writeReviewedStage(
    fixture.verificationStage,
    ALPHA_VERIFICATION_BUILDER
  );
  const generated = await generateAlphaReleaseLockFile(fixture);
  assert.deepEqual(validateAlphaReleaseLock(generated, {
    releasePlan,
    packagePlan,
    inputBytes: lockedInputs()
  }), []);
  const outputPath = path.join(fixture.root, ...ALPHA_RELEASE_LOCK_PATH.split("/"));
  const firstBytes = await readFile(outputPath);
  assert.deepEqual(parseAlphaReleaseLockBytes(firstBytes), generated);
  await assert.rejects(
    () => generateAlphaReleaseLockFile(fixture),
    /alpha-release-lock-exists/u
  );
  assert.deepEqual(await readFile(outputPath), firstBytes);
});

test("release tag inspection rejects dirty, redirected, and lightweight states", async (t) => {
  const fixture = await createTagInspectionFixture(t, {
    ambientEnvironment: { ...process.env, GITHUB_SHA: "f".repeat(40) }
  });

  const processEnvironmentLike = Object.assign(Object.create({}), fixture.environment);
  const inspected = await inspectAlphaReleaseTag({
    root: fixture.root,
    environment: processEnvironmentLike
  });
  assert.equal(inspected.tagTargetCommitOid, inspected.headCommitOid);
  assert.equal(inspected.tagTargetTreeOid, inspected.headTreeOid);
  assert.equal(
    inspected.tagObjectOid,
    fixture.git("show-ref", "--verify", "--hash", `refs/tags/${ALPHA_RELEASE_TAG_NAME}`)
  );
  const snapshot = await inspectAlphaReleaseCandidateSnapshot({
    root: fixture.root,
    environment: fixture.environment
  });
  assert.deepEqual(snapshot.releasePlan, releasePlan);
  assert.deepEqual(snapshot.packagePlan, packagePlan);
  assert.deepEqual(snapshot.releaseLock, releaseLock());
  assert.equal(snapshot.inputBytes.size, releasePlan.lockedInputs.length);

  await assert.rejects(() => inspectAlphaReleaseTag({
    root: fixture.root,
    environment: {
      ...fixture.environment,
      GIT_DIR: path.join(fixture.root, ".git")
    }
  }), /alpha-release-git-environment/u);
  await assert.rejects(() => inspectAlphaReleaseTag({
    root: fixture.root,
    environment: { ...fixture.environment, GITHUB_SHA: "f".repeat(40) }
  }), /alpha-release-tag-target/u);

  await writeFile(path.join(fixture.root, "dirty.txt"), "dirty\n");
  await assert.rejects(() => inspectAlphaReleaseTag({
    root: fixture.root,
    environment: fixture.environment
  }), /alpha-release-worktree-dirty/u);
  await rm(path.join(fixture.root, "dirty.txt"));

  fixture.git("tag", "--delete", ALPHA_RELEASE_TAG_NAME);
  fixture.git("tag", ALPHA_RELEASE_TAG_NAME);
  await assert.rejects(() => inspectAlphaReleaseTag({
    root: fixture.root,
    environment: fixture.environment
  }), /alpha-release-tag-not-annotated/u);
});

test("release tag inspection rejects mapped source drift after the lock was frozen", async (t) => {
  const fixture = await createTagInspectionFixture(t);
  fixture.git("tag", "--delete", ALPHA_RELEASE_TAG_NAME);
  const [source, bytes] = projectedSourceBytes().entries().next().value;
  await writeFile(
    path.join(fixture.root, ...source.split("/")),
    Buffer.concat([bytes, Buffer.from("tagged source drift\n")])
  );
  fixture.git("add", "--", source);
  fixture.git("commit", "--quiet", "-m", "mutate mapped package source");
  fixture.git(
    "tag",
    "--annotate",
    ALPHA_RELEASE_TAG_NAME,
    "--message",
    ALPHA_RELEASE_TAG_MESSAGE
  );

  await assert.rejects(() => inspectAlphaReleaseCandidateSnapshot({
    root: fixture.root,
    environment: fixture.environment
  }), /alpha-release-tag-source-projection/u);
});

test("release tag inspection rejects a mapped source Git-mode drift", async (t) => {
  const fixture = await createTagInspectionFixture(t);
  fixture.git("tag", "--delete", ALPHA_RELEASE_TAG_NAME);
  const binSource = packagePlan.packages.flatMap((item) => flattenPackageFiles(item))
    .find((entry) => entry.role === "bin").source;
  fixture.git("update-index", "--chmod=-x", "--", binSource);
  fixture.git("commit", "--quiet", "-m", "mutate mapped package source mode");
  await chmod(path.join(fixture.root, ...binSource.split("/")), 0o644);
  fixture.git(
    "tag",
    "--annotate",
    ALPHA_RELEASE_TAG_NAME,
    "--message",
    ALPHA_RELEASE_TAG_MESSAGE
  );

  await assert.rejects(() => inspectAlphaReleaseCandidateSnapshot({
    root: fixture.root,
    environment: fixture.environment
  }), /alpha-release-tree-file/u);
});

test("release tag inspection rejects arbitrary taggers, messages, and headers", async (t) => {
  const fixture = await createTagInspectionFixture(t);

  fixture.installRawTag(fixture.rawTag({ taggerName: "Unapproved Test" }));
  await assert.rejects(() => inspectAlphaReleaseTag({
    root: fixture.root,
    environment: fixture.environment
  }), /alpha-release-tag-identity/u);

  fixture.installRawTag(fixture.rawTag({ message: "arbitrary release message" }));
  await assert.rejects(() => inspectAlphaReleaseTag({
    root: fixture.root,
    environment: fixture.environment
  }), /alpha-release-tag-object/u);

  fixture.installRawTag(fixture.rawTag({ extraHeader: "extra unreviewed\n" }));
  await assert.rejects(() => inspectAlphaReleaseTag({
    root: fixture.root,
    environment: fixture.environment
  }), /alpha-release-tag-object/u);

  fixture.installRawTag(fixture.rawTag({ extraHeader: " gpgsig stray\n" }));
  await assert.rejects(() => inspectAlphaReleaseTag({
    root: fixture.root,
    environment: fixture.environment
  }), /alpha-release-tag-object/u);

  fixture.installRawTag(fixture.rawTag({
    message: ["secret", "_token=", "abcdefghijkl"].join("")
  }));
  await assert.rejects(() => inspectAlphaReleaseTag({
    root: fixture.root,
    environment: fixture.environment
  }), /alpha-release-tag-object/u);
});

test("an ignored untracked lock cannot impersonate the lock in the tag tree", async (t) => {
  const fixture = await createTagInspectionFixture(t, { trackedLock: false });
  await writeFile(
    path.join(fixture.root, ".git", "info", "exclude"),
    `${ALPHA_RELEASE_LOCK_PATH}\n`
  );
  const ignoredLockPath = path.join(
    fixture.root,
    ...ALPHA_RELEASE_LOCK_PATH.split("/")
  );
  await mkdir(path.dirname(ignoredLockPath), { recursive: true });
  await writeFile(ignoredLockPath, canonicalAlphaReleaseLockText(releaseLock()));
  assert.equal(
    fixture.git("status", "--porcelain=v1", "--untracked-files=all"),
    ""
  );
  await assert.rejects(() => inspectAlphaReleaseTag({
    root: fixture.root,
    environment: fixture.environment
  }), /alpha-release-tree-file/u);
});

test("Git config isolation uses Git's portable null path rather than a platform device name", async () => {
  const source = await readFile(new URL(
    "../scripts/lib/alpha-release.mjs",
    import.meta.url
  ), "utf8");
  assert.match(source, /const nullDevice = "\/dev\/null";/u);
  assert.doesNotMatch(source, /nullDevice\s*=.*\bNUL\b/u);
});

test("the preparation CLI rejects every argument shape except the exact release mode", () => {
  const script = fileURLToPath(new URL(
    "../scripts/check-alpha-release-preparation.mjs",
    import.meta.url
  ));
  for (const arguments_ of [
    [],
    ["--mode", "release-tag"],
    [
      "--mode", "release-tag", "--tag", ALPHA_RELEASE_TAG_NAME,
      "--stage-root", ".package-stage/reviewed", "--extra"
    ],
    [
      "--tag", ALPHA_RELEASE_TAG_NAME, "--mode", "release-tag",
      "--stage-root", ".package-stage/reviewed"
    ]
  ]) {
    const result = spawnSync(process.execPath, [script, ...arguments_], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    assert.equal(result.status, 2, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      schemaVersion: 1,
      gate: "alpha-release-preparation",
      ok: false,
      findings: [{ code: "release-preparation-usage", pointer: "" }]
    });
  }
});

test("the release-lock CLI accepts only two absolute stage arguments in fixed order", () => {
  const script = fileURLToPath(new URL(
    "../scripts/generate-alpha-release-lock.mjs",
    import.meta.url
  ));
  for (const arguments_ of [
    [],
    ["--verification-stage", "/tmp/verification"],
    [
      "--fixed-stage", "/tmp/fixed",
      "--verification-stage", "/tmp/verification"
    ],
    [
      "--verification-stage", "relative/verification",
      "--fixed-stage", "/tmp/fixed"
    ],
    [
      "--verification-stage", "/tmp/verification",
      "--fixed-stage", "relative/fixed"
    ],
    [
      "--verification-stage", "/tmp/verification",
      "--fixed-stage", "/tmp/fixed",
      "--extra"
    ]
  ]) {
    const result = spawnSync(process.execPath, [script, ...arguments_], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    assert.equal(result.status, 2, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      schemaVersion: 1,
      gate: "alpha-release-lock-generation",
      ok: false,
      findings: [{ code: "release-lock-generation-usage", pointer: "" }]
    });
  }
});
