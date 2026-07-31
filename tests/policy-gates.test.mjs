import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const forbiddenScript = path.join(projectRoot, "scripts", "check-forbidden-materials.mjs");
const provenanceScript = path.join(projectRoot, "scripts", "check-provenance.mjs");
const policySource = await readFile(path.join(projectRoot, "policy", "forbidden-materials.json"), "utf8");
const schemaSource = await readFile(path.join(projectRoot, "schemas", "provenance-record.schema.json"), "utf8");
const policy = JSON.parse(policySource);

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

async function temporaryRepository(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pptx-policy-gates-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  git(root, "init", "-q");
  git(root, "config", "user.name", "Synthetic Test");
  git(root, "config", "user.email", ["synthetic", "@", "example.invalid"].join(""));
  return root;
}

async function writeRelative(root, relativePath, content, options) {
  const destination = path.join(root, ...relativePath.split("/"));
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content, options);
}

function runGate(script, root, mode = "index") {
  const result = spawnSync(process.execPath, [script, "--root", root, "--mode", mode, "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  return { status: result.status, stdout: result.stdout, report: JSON.parse(result.stdout) };
}

function assertRejected(result, ruleId) {
  assert.notEqual(result.status, 0);
  assert.equal(result.report.ok, false);
  assert.ok(result.report.findings.some((item) => item.ruleId === ruleId),
    `expected ${ruleId}, got ${result.stdout}`);
}

async function initializeForbiddenRepository(t) {
  const root = await temporaryRepository(t);
  await writeRelative(root, "policy/forbidden-materials.json", policySource);
  await writeRelative(root, "safe.txt", "repository-owned synthetic text\n");
  git(root, "add", "-A");
  return root;
}

function provenanceRecord(relativePath) {
  return {
    path: relativePath,
    kind: "new-clean-room",
    origin: "repository-owned synthetic test fixture",
    copyrightHolderOrSourceAuthority: "synthetic test authority",
    license: { spdxExpression: "MIT" },
    reviewedOn: "2026-07-30",
    thirdPartyDependencies: [],
    privateInformationReview: { status: "passed", notes: "Synthetic text only." },
    projectConstantCleanup: { status: "passed", notes: "No project constants." },
    publicConformance: { status: "not-applicable", notes: "Policy test input only." },
    independentReview: { status: "passed", notes: "Reviewed by the test harness." },
    notes: "Generated solely inside a temporary test repository."
  };
}

function sortedRecords(paths) {
  return paths.sort().map(provenanceRecord);
}

async function writeRecords(root, document) {
  await writeRelative(root, "provenance/records.json", `${JSON.stringify(document, null, 2)}\n`);
}

async function initializeProvenanceRepository(t) {
  const root = await temporaryRepository(t);
  await writeRelative(root, "schemas/provenance-record.schema.json", schemaSource);
  await writeRelative(root, "safe.txt", "repository-owned synthetic text\n");
  const paths = ["provenance/records.json", "safe.txt", "schemas/provenance-record.schema.json"];
  const document = { schemaVersion: 1, records: sortedRecords(paths) };
  await writeRecords(root, document);
  git(root, "add", "-A");
  return { root, document };
}

test("forbidden-material gate passes and emits byte-stable JSON", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const first = runGate(forbiddenScript, root);
  const second = runGate(forbiddenScript, root);
  assert.equal(first.status, 0);
  assert.equal(first.report.ok, true);
  assert.equal(first.stdout, second.stdout);
});

test("mutation: forbidden presentation extension is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  await writeRelative(root, "synthetic-fixture.pptx", "text only\n");
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "forbidden-presentation-extension");
});

test("mutation: disguised ZIP magic is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const content = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("synthetic")]);
  await writeRelative(root, "renamed-as-text.txt", content);
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "forbidden-zip-magic");
});

test("mutation: absolute local path in text is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const syntheticPath = ["/", "Users", "/", "synthetic-user", "/", "fixture.txt"].join("");
  await writeRelative(root, "path.txt", `${syntheticPath}\n`);
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "absolute-local-user-path");
});

test("mutation: Windows forward-slash user path is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const syntheticPath = ["C:", "/", "Users", "/", "synthetic-user", "/", "fixture.txt"].join("");
  await writeRelative(root, "path.txt", `${syntheticPath}\n`);
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "absolute-local-user-path");
});

test("mutation: generic Windows drive-absolute path is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const syntheticPath = ["D:", "\\", "workspace", "\\", "fixture.txt"].join("");
  await writeRelative(root, "path.txt", `${syntheticPath}\n`);
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "absolute-local-user-path");
});

test("mutation: local file URI is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const syntheticPath = ["file:", "//", "/", "Users", "/", "synthetic-user", "/", "fixture.txt"].join("");
  await writeRelative(root, "path.txt", `${syntheticPath}\n`);
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "absolute-local-user-path");
});

test("mutation: private-key marker is rejected without diagnostic disclosure", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const marker = ["-----BEGIN", " PRIVATE", " KEY-----"].join("");
  await writeRelative(root, "marker.txt", `${marker}\nsynthetic-only\n`);
  git(root, "add", "-A");
  const result = runGate(forbiddenScript, root);
  assertRejected(result, "private-key-marker");
  assert.equal(result.stdout.includes(marker), false);
  assert.deepEqual(Object.keys(result.report.findings.find((item) => item.ruleId === "private-key-marker")),
    ["path", "ruleId", "severity", "location"]);
});

test("mutation: symlink is rejected without following it", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const blob = git(root, "hash-object", "-w", "safe.txt");
  git(root, "update-index", "--add", "--cacheinfo", `120000,${blob},linked.txt`);
  assertRejected(runGate(forbiddenScript, root), "forbidden-symlink");
});

test("mutation: working-tree policy symlink is rejected before target reading", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const outside = await mkdtemp(path.join(os.tmpdir(), "pptx-policy-outside-"));
  t.after(async () => rm(outside, { recursive: true, force: true }));
  const policyPath = path.join(root, "policy", "forbidden-materials.json");
  await rm(policyPath);
  await writeFile(path.join(outside, "synthetic-policy.json"), policySource);
  try {
    await symlink(path.join(outside, "synthetic-policy.json"), policyPath);
  } catch (error) {
    if (process.platform === "win32" && ["EPERM", "EACCES"].includes(error.code)) {
      t.skip("creating symlinks is not permitted on this Windows host");
      return;
    }
    throw error;
  }
  assertRejected(runGate(forbiddenScript, root, "working-tree"), "policy-configuration-error");
});

test("mutation: oversized file is rejected before content reading", async (t) => {
  const root = await initializeForbiddenRepository(t);
  await writeRelative(root, "oversized.txt", Buffer.alloc(policy.maxFileBytes + 1, 0x61));
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "oversized-file");
});

test("mutation: generated-output directory is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  await writeRelative(root, "build/report.txt", "synthetic output\n");
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "forbidden-generated-output-directory");
});

test("mutation: private-output directory is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  await writeRelative(root, "private-output/report.txt", "synthetic output\n");
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "forbidden-private-output-directory");
});

test("mutation: private manifest is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  await writeRelative(root, "private-manifest.json", "{}\n");
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "private-manifest-file");
});

test("mutation: arbitrary local environment file is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  await writeRelative(root, ".env.synthetic", "EMPTY=\n");
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "local-environment-path");
});

test("mutation: disguised executable magic is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const content = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.from("synthetic")]);
  await writeRelative(root, "renamed-program.txt", content);
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "forbidden-executable-magic");
});

test("mutation: unapproved executable bit is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  await writeRelative(root, "tool.mjs", "export {};\n");
  await chmod(path.join(root, "tool.mjs"), 0o755);
  git(root, "add", "-A");
  git(root, "update-index", "--chmod=+x", "tool.mjs");
  assertRejected(runGate(forbiddenScript, root), "unapproved-executable-bit");
});

test("mutation: untracked working-tree executable bit is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  if (process.platform === "win32") {
    t.skip("POSIX executable permission bits do not apply on Windows");
    return;
  }
  await writeRelative(root, "untracked-tool", "synthetic text\n");
  await chmod(path.join(root, "untracked-tool"), 0o755);
  assertRejected(runGate(forbiddenScript, root, "working-tree"), "unapproved-executable-bit");
});

test("mutation: gitlink is rejected as a submodule", async (t) => {
  const root = await initializeForbiddenRepository(t);
  git(root, "commit", "-qm", "synthetic baseline");
  const commit = git(root, "rev-parse", "HEAD");
  git(root, "update-index", "--add", "--cacheinfo", `160000,${commit},vendor/linked`);
  assertRejected(runGate(forbiddenScript, root), "forbidden-submodule");
});

test("mutation: unapproved copyright identity is rejected", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const notice = ["Copyright ", "(c) ", "2026 Synthetic Person"].join("");
  await writeRelative(root, "notice.txt", `${notice}\n`);
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "unapproved-copyright-identity");
});

test("mutation: working-tree mode scans an untracked forbidden file", async (t) => {
  const root = await initializeForbiddenRepository(t);
  await writeRelative(root, "untracked.pdf", "synthetic text\n");
  assertRejected(runGate(forbiddenScript, root, "working-tree"), "forbidden-document-binary-extension");
});

test("mutation: malformed policy fails closed", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const mutated = { ...policy, schemaVersion: 999 };
  await writeRelative(root, "policy/forbidden-materials.json", `${JSON.stringify(mutated)}\n`);
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "policy-configuration-error");
});

test("provenance gate passes and emits byte-stable JSON", async (t) => {
  const { root } = await initializeProvenanceRepository(t);
  const first = runGate(provenanceScript, root);
  const second = runGate(provenanceScript, root);
  assert.equal(first.status, 0);
  assert.equal(first.report.ok, true);
  assert.equal(first.stdout, second.stdout);
});

test("mutation: provenance schema authority identifier is fixed", async (t) => {
  const { root } = await initializeProvenanceRepository(t);
  const mutatedSchema = JSON.parse(schemaSource);
  mutatedSchema.$id = "urn:pptx-pipeline:schema:synthetic-other:1";
  await writeRelative(root, "schemas/provenance-record.schema.json", `${JSON.stringify(mutatedSchema, null, 2)}\n`);
  git(root, "add", "-A");
  assertRejected(runGate(provenanceScript, root), "provenance-configuration-error");
});

test("mutation: missing provenance record is rejected", async (t) => {
  const { root } = await initializeProvenanceRepository(t);
  await writeRelative(root, "missing.txt", "synthetic\n");
  git(root, "add", "-A");
  assertRejected(runGate(provenanceScript, root), "missing-provenance-record");
});

test("mutation: orphan provenance record is rejected", async (t) => {
  const { root, document } = await initializeProvenanceRepository(t);
  document.records.push(provenanceRecord("untracked-orphan.txt"));
  document.records.sort((left, right) => left.path.localeCompare(right.path));
  await writeRecords(root, document);
  git(root, "add", "-A");
  assertRejected(runGate(provenanceScript, root), "orphan-provenance-record");
});

test("mutation: duplicate provenance path is rejected", async (t) => {
  const { root, document } = await initializeProvenanceRepository(t);
  document.records.push(provenanceRecord("safe.txt"));
  document.records.sort((left, right) => left.path.localeCompare(right.path));
  await writeRecords(root, document);
  git(root, "add", "-A");
  assertRejected(runGate(provenanceScript, root), "duplicate-provenance-path");
});

test("mutation: traversing provenance path is rejected without echoing it", async (t) => {
  const { root, document } = await initializeProvenanceRepository(t);
  const traversing = ["..", "/", "outside.txt"].join("");
  document.records[0].path = traversing;
  await writeRecords(root, document);
  git(root, "add", "-A");
  const result = runGate(provenanceScript, root);
  assertRejected(result, "non-canonical-provenance-path");
  assert.equal(result.stdout.includes(traversing), false);
});

test("mutation: invalid SPDX expression is rejected", async (t) => {
  const { root, document } = await initializeProvenanceRepository(t);
  document.records[0].license.spdxExpression = "UNKNOWN-LICENSE";
  await writeRecords(root, document);
  git(root, "add", "-A");
  assertRejected(runGate(provenanceScript, root), "provenance-schema-validation");
});

test("mutation: invalid explicit rights basis is rejected", async (t) => {
  const { root, document } = await initializeProvenanceRepository(t);
  document.records[0].license = { rightsBasis: "unreviewed" };
  await writeRecords(root, document);
  git(root, "add", "-A");
  assertRejected(runGate(provenanceScript, root), "provenance-schema-validation");
});

test("mutation: invalid review status is rejected", async (t) => {
  const { root, document } = await initializeProvenanceRepository(t);
  document.records[0].privateInformationReview.status = "unknown";
  await writeRecords(root, document);
  git(root, "add", "-A");
  assertRejected(runGate(provenanceScript, root), "provenance-schema-validation");
});

test("mutation: pending review status is rejected", async (t) => {
  const { root, document } = await initializeProvenanceRepository(t);
  document.records[0].independentReview.status = "pending";
  await writeRecords(root, document);
  git(root, "add", "-A");
  assertRejected(runGate(provenanceScript, root), "pending-provenance-status");
});

test("mutation: unknown record schema version is rejected", async (t) => {
  const { root, document } = await initializeProvenanceRepository(t);
  document.schemaVersion = 2;
  await writeRecords(root, document);
  git(root, "add", "-A");
  assertRejected(runGate(provenanceScript, root), "unsupported-provenance-schema-version");
});

test("mutation: nondeterministic provenance ordering is rejected stably", async (t) => {
  const { root, document } = await initializeProvenanceRepository(t);
  document.records.reverse();
  await writeRecords(root, document);
  git(root, "add", "-A");
  const first = runGate(provenanceScript, root);
  const second = runGate(provenanceScript, root);
  assertRejected(first, "unsorted-provenance-records");
  assert.equal(first.stdout, second.stdout);
});
