import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  GIT_NULL_DEVICE,
  parseFsckMessageKeys
} from "../scripts/check-forbidden-materials.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const forbiddenScript = path.join(projectRoot, "scripts", "check-forbidden-materials.mjs");
const provenanceScript = path.join(projectRoot, "scripts", "check-provenance.mjs");
const policySource = await readFile(path.join(projectRoot, "policy", "forbidden-materials.json"), "utf8");
const schemaSource = await readFile(path.join(projectRoot, "schemas", "provenance-record.schema.json"), "utf8");
const policy = JSON.parse(policySource);

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function gitWithInput(root, args, input, { encoding = "utf8" } = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding,
    input,
    stdio: ["pipe", "pipe", "pipe"]
  });
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

function runGate(script, root, mode = "index", { environment = process.env } = {}) {
  const result = spawnSync(process.execPath, [script, "--root", root, "--mode", mode, "--json"], {
    cwd: root,
    encoding: "utf8",
    env: environment,
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

async function initializeHistoryRepository(t) {
  const root = await initializeForbiddenRepository(t);
  git(root, "symbolic-ref", "HEAD", "refs/heads/main");
  git(root, "commit", "-qm", "synthetic baseline");
  return root;
}

function appendRawTreeCommit(root, { mode, name, oid }) {
  const base = git(root, "rev-parse", "HEAD");
  const baseTree = git(root, "rev-parse", `${base}^{tree}`);
  const baseTreeBytes = gitWithInput(root, ["cat-file", "tree", baseTree], undefined, {
    encoding: null
  });
  const objectId = oid ?? gitWithInput(
    root,
    ["hash-object", "-t", "blob", "--stdin", "-w"],
    "repository-owned synthetic text\n"
  ).trim();
  const extraEntry = Buffer.concat([
    Buffer.isBuffer(mode) ? Buffer.concat([mode, Buffer.from(" ")]) : Buffer.from(`${mode} `),
    Buffer.from(name),
    Buffer.from([0]),
    Buffer.from(objectId, "hex")
  ]);
  const tree = gitWithInput(
    root,
    ["hash-object", "-t", "tree", "--stdin", "-w", "--literally"],
    Buffer.concat([baseTreeBytes, extraEntry])
  ).trim();
  const baseCommit = gitWithInput(root, ["cat-file", "commit", base], undefined).split("\n");
  const author = baseCommit.find((line) => line.startsWith("author "));
  const committer = baseCommit.find((line) => line.startsWith("committer "));
  assert.ok(author);
  assert.ok(committer);
  const commit = gitWithInput(
    root,
    ["hash-object", "-t", "commit", "--stdin", "-w"],
    `tree ${tree}\nparent ${base}\n${author}\n${committer}\n\nsynthetic raw tree\n`
  ).trim();
  git(root, "update-ref", "refs/heads/main", commit, base);
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

test("mutation: npm shrinkwrap cannot override the reviewed lock", async (t) => {
  const root = await initializeForbiddenRepository(t);
  await writeRelative(root, "npm-shrinkwrap.json", "{}\n");
  git(root, "add", "-A");
  assertRejected(runGate(forbiddenScript, root), "unreviewed-package-manager-control");
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

test("the one declared CLI bin may carry the executable bit", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const approvedPath = "packages/cli/pptx-compiler.mjs";
  await writeRelative(root, approvedPath, "#!/usr/bin/env node\n");
  await chmod(path.join(root, ...approvedPath.split("/")), 0o755);
  git(root, "add", "-A");
  git(root, "update-index", "--chmod=+x", approvedPath);
  const result = runGate(forbiddenScript, root);
  assert.equal(result.status, 0);
  assert.equal(result.report.ok, true);
});

test("mutation: the declared CLI bin must retain its Git executable bit", async (t) => {
  const root = await initializeForbiddenRepository(t);
  const approvedPath = "packages/cli/pptx-compiler.mjs";
  await writeRelative(root, approvedPath, "#!/usr/bin/env node\n");
  git(root, "add", "-A");
  git(root, "update-index", "--chmod=-x", approvedPath);
  assertRejected(runGate(forbiddenScript, root), "approved-executable-bit-missing");
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

test("content rules cannot claim path exceptions", async (t) => {
  await t.test("an email rule cannot exempt SECURITY.md", async (t) => {
    const root = await initializeForbiddenRepository(t);
    const mutated = structuredClone(policy);
    mutated.textRules.find((rule) => rule.id === "unapproved-email-address").exceptPaths =
      ["SECURITY.md"];
    await writeRelative(
      root,
      "policy/forbidden-materials.json",
      `${JSON.stringify(mutated, null, 2)}\n`
    );
    git(root, "add", "-A");
    assertRejected(runGate(forbiddenScript, root), "policy-configuration-error");
  });

  await t.test("another text rule cannot declare even an empty exception field", async (t) => {
    const root = await initializeForbiddenRepository(t);
    const mutated = structuredClone(policy);
    mutated.textRules.find((rule) => rule.id === "private-key-marker").exceptPaths = [];
    await writeRelative(
      root,
      "policy/forbidden-materials.json",
      `${JSON.stringify(mutated, null, 2)}\n`
    );
    git(root, "add", "-A");
    assertRejected(runGate(forbiddenScript, root), "policy-configuration-error");
  });

  await t.test("the copyright identity rule cannot claim a path exception", async (t) => {
    const root = await initializeForbiddenRepository(t);
    const mutated = structuredClone(policy);
    mutated.copyrightIdentityRule.exceptPaths = ["SECURITY.md"];
    await writeRelative(
      root,
      "policy/forbidden-materials.json",
      `${JSON.stringify(mutated, null, 2)}\n`
    );
    git(root, "add", "-A");
    assertRejected(runGate(forbiddenScript, root), "policy-configuration-error");
  });
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

test("historical executable grants are exact and history-only", async (t) => {
  const root = await initializeHistoryRepository(t);
  const oldPath = "packages/cli/bin/pptx-compiler.mjs";
  const newPath = "packages/cli/pptx-compiler.mjs";
  const bytes = "#!/usr/bin/env node\nexport {};\n";
  await writeRelative(root, oldPath, bytes);
  git(root, "add", oldPath);
  git(root, "update-index", "--chmod=+x", oldPath);
  git(root, "commit", "-qm", "synthetic old executable path");
  const objectId = git(root, "rev-parse", `HEAD:${oldPath}`);

  await rm(path.join(root, ...oldPath.split("/")));
  await writeRelative(root, newPath, bytes);
  git(root, "add", "-A");
  const migrated = structuredClone(policy);
  migrated.approvedHistoricalExecutableObjects = [{ path: oldPath, objectId }];
  await writeRelative(
    root,
    "policy/forbidden-materials.json",
    `${JSON.stringify(migrated, null, 2)}\n`
  );
  git(root, "add", "-A");
  git(root, "update-index", "--chmod=+x", newPath);
  git(root, "commit", "-qm", "synthetic executable path migration");

  const history = runGate(forbiddenScript, root, "history");
  assert.equal(history.status, 0, history.stdout);

  await rm(path.join(root, ...newPath.split("/")));
  await writeRelative(root, oldPath, bytes);
  git(root, "add", "-A");
  git(root, "update-index", "--chmod=+x", oldPath);
  assertRejected(runGate(forbiddenScript, root), "unapproved-executable-bit");
  assertRejected(runGate(forbiddenScript, root, "working-tree"), "unapproved-executable-bit");
  git(root, "commit", "-qm", "synthetic current-path replay");
  assertRejected(runGate(forbiddenScript, root, "history"), "unapproved-executable-bit");
});

test("historical executable grants reject drift and malformed policy", async (t) => {
  const oldPath = "packages/cli/bin/pptx-compiler.mjs";
  const exactObjectId = policy.approvedHistoricalExecutableObjects[0].objectId;

  await t.test("the same historical path with different bytes is rejected", async (t) => {
    const root = await initializeHistoryRepository(t);
    await writeRelative(root, oldPath, "#!/usr/bin/env node\nexport const drift = true;\n");
    git(root, "add", oldPath);
    git(root, "update-index", "--chmod=+x", oldPath);
    git(root, "commit", "-qm", "synthetic executable drift");
    await rm(path.join(root, ...oldPath.split("/")));
    git(root, "add", "-A");
    git(root, "commit", "-qm", "remove synthetic executable drift");
    assertRejected(runGate(forbiddenScript, root, "history"), "unapproved-executable-bit");
  });

  await t.test("the same historical object at another path is rejected", async (t) => {
    const root = await initializeHistoryRepository(t);
    const alternatePath = "historical-executable-object";
    await writeRelative(root, alternatePath, "#!/usr/bin/env node\nexport {};\n");
    git(root, "add", alternatePath);
    git(root, "update-index", "--chmod=+x", alternatePath);
    const objectId = git(root, "rev-parse", `:${alternatePath}`);
    git(root, "commit", "-qm", "synthetic alternate historical path");
    const mutated = structuredClone(policy);
    mutated.approvedHistoricalExecutableObjects = [{ path: oldPath, objectId }];
    await writeRelative(
      root,
      "policy/forbidden-materials.json",
      `${JSON.stringify(mutated, null, 2)}\n`
    );
    await rm(path.join(root, alternatePath));
    git(root, "add", "-A");
    git(root, "commit", "-qm", "synthetic historical path drift");
    const history = runGate(forbiddenScript, root, "history");
    assert.notEqual(history.status, 0, history.stdout);
    assertRejected(history, "unapproved-executable-bit");
  });

  await t.test("an executable grant does not bypass content rules", async (t) => {
    const root = await initializeHistoryRepository(t);
    const content = ["/", "Users", "/", "synthetic-history", "/", "secret.txt\n"].join("");
    await writeRelative(root, oldPath, content);
    git(root, "add", oldPath);
    git(root, "update-index", "--chmod=+x", oldPath);
    git(root, "commit", "-qm", "synthetic historical content rule");
    const objectId = git(root, "rev-parse", `HEAD:${oldPath}`);
    const mutated = structuredClone(policy);
    mutated.approvedHistoricalExecutableObjects = [{ path: oldPath, objectId }];
    await writeRelative(
      root,
      "policy/forbidden-materials.json",
      `${JSON.stringify(mutated, null, 2)}\n`
    );
    await rm(path.join(root, ...oldPath.split("/")));
    git(root, "add", "-A");
    git(root, "commit", "-qm", "synthetic exact grant");
    assertRejected(runGate(forbiddenScript, root, "history"), "absolute-local-user-path");
  });

  for (const [name, mutate] of [
    ["unknown fields", (document) => {
      document.approvedHistoricalExecutableObjects[0].extra = true;
    }],
    ["invalid object IDs", (document) => {
      document.approvedHistoricalExecutableObjects[0].objectId = "not-an-object-id";
    }],
    ["null object IDs", (document) => {
      document.approvedHistoricalExecutableObjects[0].objectId = "0".repeat(40);
    }],
    ["duplicates", (document) => {
      document.approvedHistoricalExecutableObjects.push(
        structuredClone(document.approvedHistoricalExecutableObjects[0])
      );
    }],
    ["unsorted entries", (document) => {
      document.approvedHistoricalExecutableObjects = [
        { path: "z-old.mjs", objectId: exactObjectId },
        { path: "a-old.mjs", objectId: exactObjectId }
      ];
    }],
    ["current-path overlap", (document) => {
      document.approvedHistoricalExecutableObjects[0].path =
        document.approvedExecutablePaths[0];
    }]
  ]) {
    await t.test(name, async (t) => {
      const root = await initializeForbiddenRepository(t);
      const mutated = structuredClone(policy);
      mutate(mutated);
      await writeRelative(
        root,
        "policy/forbidden-materials.json",
        `${JSON.stringify(mutated, null, 2)}\n`
      );
      git(root, "add", "-A");
      assertRejected(runGate(forbiddenScript, root), "policy-configuration-error");
    });
  }
});

test("public-history gate passes and emits byte-stable JSON", async (t) => {
  const root = await initializeHistoryRepository(t);
  const scannerSource = await readFile(forbiddenScript, "utf8");
  assert.equal(scannerSource.includes('"rev-list"'), false);
  assert.equal(scannerSource.includes('"cat-file", "commit"'), true);
  assert.equal(GIT_NULL_DEVICE, "/dev/null");
  const fsckVariables = "fsck.badDate\nfsck.skipList\nfsck.zeroPaddedDate\nfsck.badDate\n";
  assert.deepEqual(
    parseFsckMessageKeys(fsckVariables),
    ["fsck.badDate", "fsck.zeroPaddedDate"]
  );
  assert.deepEqual(
    parseFsckMessageKeys(fsckVariables.replaceAll("\n", "\r\n")),
    ["fsck.badDate", "fsck.zeroPaddedDate"]
  );
  assert.throws(() => parseFsckMessageKeys("fsck.badDate\rfsck.zeroPaddedDate\n"));
  const first = runGate(forbiddenScript, root, "history");
  const second = runGate(forbiddenScript, root, "history");
  assert.equal(first.status, 0);
  assert.equal(first.report.ok, true);
  assert.equal(first.report.history.ref, "refs/heads/main");
  assert.equal(first.report.history.commitsScanned, 1);
  assert.equal(first.report.history.identityOccurrences, 2);
  assert.equal(first.report.history.leafEntriesScanned, first.report.filesScanned);
  assert.equal(first.stdout, second.stdout);
});

test("mutation: deleted forbidden history remains rejected by the tip policy", async (t) => {
  const root = await initializeHistoryRepository(t);
  await writeRelative(root, "removed-before-push.pptx", "synthetic text only\n");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "synthetic forbidden history");
  await rm(path.join(root, "removed-before-push.pptx"));
  git(root, "add", "-A");
  git(root, "commit", "-qm", "remove synthetic history input");

  const weakened = structuredClone(policy);
  for (const rule of weakened.forbiddenExtensions) {
    rule.extensions = rule.extensions.filter((extension) => extension !== ".pptx");
  }
  await writeRelative(
    root,
    "policy/forbidden-materials.json",
    `${JSON.stringify(weakened, null, 2)}\n`
  );
  git(root, "add", "policy/forbidden-materials.json");
  const current = runGate(forbiddenScript, root);
  assert.equal(current.status, 0);
  assert.equal(current.report.ok, true);
  assertRejected(runGate(forbiddenScript, root, "history"), "forbidden-presentation-extension");
});

test("mutation: history repository selection cannot be redirected", async (t) => {
  const root = await initializeHistoryRepository(t);
  await writeRelative(root, "forbidden-in-real-main.pptx", "synthetic text only\n");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "synthetic real-main mutation");
  assertRejected(runGate(forbiddenScript, root, "history"), "forbidden-presentation-extension");

  const rogueWork = await mkdtemp(path.join(os.tmpdir(), "pptx-policy-rogue-work-"));
  t.after(async () => rm(rogueWork, { recursive: true, force: true }));
  const rogueGit = path.join(root, ".git", "rogue");
  execFileSync("git", ["init", "-q", "--separate-git-dir", rogueGit, rogueWork]);
  git(rogueWork, "config", "user.name", "Synthetic Test");
  git(rogueWork, "config", "user.email", ["synthetic", "@", "example.invalid"].join(""));
  git(rogueWork, "symbolic-ref", "HEAD", "refs/heads/main");
  await writeRelative(rogueWork, "policy/forbidden-materials.json", policySource);
  await writeRelative(rogueWork, "safe.txt", "repository-owned synthetic text\n");
  git(rogueWork, "add", "-A");
  git(rogueWork, "commit", "-qm", "synthetic rogue baseline");
  const redirected = runGate(forbiddenScript, root, "history", {
    environment: {
      ...process.env,
      GIT_DIR: rogueGit,
      GIT_WORK_TREE: root
    }
  });
  assertRejected(redirected, "history-git-environment-override");
  const caseVariant = runGate(forbiddenScript, root, "history", {
    environment: {
      ...process.env,
      git_dir: rogueGit,
      Git_Work_Tree: root
    }
  });
  assertRejected(caseVariant, "history-git-environment-override");

  const directRoot = await initializeHistoryRepository(t);
  await writeRelative(directRoot, ".git/commondir", ".\n");
  assertRejected(
    runGate(forbiddenScript, directRoot, "history"),
    "history-repository-indirection"
  );
});

test("mutation: history tree grammar is closed and non-disclosing", async (t) => {
  const controlRoot = await initializeHistoryRepository(t);
  const privateLeaf = ["z-sensitive", "\n", "leaf.pptx"].join("");
  appendRawTreeCommit(controlRoot, { mode: "100644", name: privateLeaf });
  const controlResult = runGate(forbiddenScript, controlRoot, "history");
  assertRejected(controlResult, "non-canonical-repository-path");
  assert.equal(controlResult.stdout.includes("z-sensitive"), false);

  const bomRoot = await initializeHistoryRepository(t);
  appendRawTreeCommit(bomRoot, { mode: "100644", name: "\uFEFFz-bom.txt" });
  assertRejected(runGate(forbiddenScript, bomRoot, "history"), "non-canonical-repository-path");

  const oddModeRoot = await initializeHistoryRepository(t);
  appendRawTreeCommit(oddModeRoot, { mode: "100664", name: "z-odd-mode.txt" });
  assertRejected(runGate(forbiddenScript, oddModeRoot, "history"), "policy-configuration-error");

  const highBitModeRoot = await initializeHistoryRepository(t);
  appendRawTreeCommit(highBitModeRoot, {
    mode: Buffer.from([0xb1, 0x30, 0x30, 0x36, 0x34, 0x34]),
    name: "z-high-bit-mode.txt"
  });
  assertRejected(runGate(forbiddenScript, highBitModeRoot, "history"), "policy-configuration-error");

  const paddedModeRoot = await initializeHistoryRepository(t);
  appendRawTreeCommit(paddedModeRoot, { mode: "0100644", name: "z-padded-mode.txt" });
  assertRejected(runGate(forbiddenScript, paddedModeRoot, "history"), "policy-configuration-error");

  const localConfigRoot = await initializeHistoryRepository(t);
  appendRawTreeCommit(localConfigRoot, { mode: "100644", name: "a-unsorted-local.txt" });
  git(localConfigRoot, "config", "fsck.treeNotSorted", "ignore");
  assertRejected(
    runGate(forbiddenScript, localConfigRoot, "history"),
    "policy-configuration-error"
  );

  const dotGitRoot = await initializeHistoryRepository(t);
  const dotGitBlob = gitWithInput(
    dotGitRoot,
    ["hash-object", "-t", "blob", "--stdin", "-w"],
    "synthetic\n"
  ).trim();
  const dotGitChild = gitWithInput(
    dotGitRoot,
    ["mktree"],
    `100644 blob ${dotGitBlob}\tx.txt\n`
  ).trim();
  const dotGitTree = gitWithInput(
    dotGitRoot,
    ["mktree"],
    `040000 tree ${dotGitChild}\t.git\n`
  ).trim();
  appendRawTreeCommit(dotGitRoot, {
    mode: "40000",
    name: "z-container",
    oid: dotGitTree
  });
  git(dotGitRoot, "config", "fsck.hasDotgit", "ignore");
  assertRejected(runGate(forbiddenScript, dotGitRoot, "history"), "policy-configuration-error");

  const fsckOnlyRoot = await initializeHistoryRepository(t);
  const fsckBase = git(fsckOnlyRoot, "rev-parse", "HEAD");
  const fsckCommit = gitWithInput(fsckOnlyRoot, ["cat-file", "commit", fsckBase], undefined)
    .split("\n");
  const fsckTree = fsckCommit.find((line) => line.startsWith("tree "));
  const fsckAuthor = fsckCommit.find((line) => line.startsWith("author "));
  const fsckCommitter = fsckCommit.find((line) => line.startsWith("committer "));
  assert.ok(fsckTree);
  assert.ok(fsckAuthor);
  assert.ok(fsckCommitter);
  const paddedAuthor = fsckAuthor.replace(/ ([1-9][0-9]*) ([+-][0-9]{4})$/, " 0$1 $2");
  assert.notEqual(paddedAuthor, fsckAuthor);
  const paddedCommit = gitWithInput(
    fsckOnlyRoot,
    ["hash-object", "-t", "commit", "--stdin", "-w", "--literally"],
    `${fsckTree}\nparent ${fsckBase}\n${paddedAuthor}\n${fsckCommitter}\n\n` +
      "synthetic zero-padded date\n"
  ).trim();
  git(fsckOnlyRoot, "update-ref", "refs/heads/main", paddedCommit, fsckBase);
  git(fsckOnlyRoot, "config", "fsck.zeroPaddedDate", "ignore");
  assertRejected(
    runGate(forbiddenScript, fsckOnlyRoot, "history"),
    "policy-configuration-error"
  );

  const globalConfigRoot = await initializeHistoryRepository(t);
  appendRawTreeCommit(globalConfigRoot, { mode: "100644", name: "a-unsorted-global.txt" });
  const syntheticHome = await mkdtemp(path.join(os.tmpdir(), "pptx-policy-git-home-"));
  t.after(async () => rm(syntheticHome, { recursive: true, force: true }));
  await writeFile(
    path.join(syntheticHome, ".gitconfig"),
    "[fsck]\n\ttreeNotSorted = ignore\n"
  );
  assertRejected(
    runGate(forbiddenScript, globalConfigRoot, "history", {
      environment: { ...process.env, HOME: syntheticHome, XDG_CONFIG_HOME: syntheticHome }
    }),
    "policy-configuration-error"
  );
});

test("mutation: forbidden commit message is rejected without disclosure", async (t) => {
  const root = await initializeHistoryRepository(t);
  const privatePath = ["/", "Users", "/", "synthetic-history", "/", "secret.txt"].join("");
  git(root, "commit", "--allow-empty", "-qm", privatePath);
  const result = runGate(forbiddenScript, root, "history");
  assertRejected(result, "absolute-local-user-path");
  assert.equal(result.stdout.includes(privatePath), false);
});

test("mutation: historical Git identity must match the repository-local identity", async (t) => {
  const root = await initializeHistoryRepository(t);
  git(root, "config", "user.name", "Alternate Synthetic Test");
  git(root, "commit", "--allow-empty", "-qm", "synthetic identity mutation");
  git(root, "config", "user.name", "Synthetic Test");
  const result = runGate(forbiddenScript, root, "history");
  assertRejected(result, "unexpected-history-author-identity");
  assertRejected(result, "unexpected-history-committer-identity");
  assert.equal(result.stdout.includes("Alternate Synthetic Test"), false);
  assert.equal(result.stdout.includes(["synthetic", "@", "example.invalid"].join("")), false);
});

test("mutation: deleted historical symlink remains rejected", async (t) => {
  const root = await initializeHistoryRepository(t);
  await writeRelative(root, "synthetic-link-target.txt", "safe-target\n");
  const blob = git(root, "hash-object", "-w", "synthetic-link-target.txt");
  await rm(path.join(root, "synthetic-link-target.txt"));
  git(root, "update-index", "--add", "--cacheinfo", `120000,${blob},historical-link`);
  git(root, "commit", "-qm", "synthetic historical symlink");
  git(root, "rm", "--cached", "-q", "historical-link");
  git(root, "commit", "-qm", "remove synthetic historical symlink");
  assertRejected(runGate(forbiddenScript, root, "history"), "forbidden-symlink");
});

test("mutation: deleted oversized historical blob remains rejected", async (t) => {
  const root = await initializeHistoryRepository(t);
  await writeRelative(root, "oversized-history.txt", Buffer.alloc(policy.maxFileBytes + 1, 0x61));
  git(root, "add", "oversized-history.txt");
  git(root, "commit", "-qm", "synthetic oversized history");
  await rm(path.join(root, "oversized-history.txt"));
  git(root, "add", "-A");
  git(root, "commit", "-qm", "remove synthetic oversized history");
  assertRejected(runGate(forbiddenScript, root, "history"), "oversized-file");
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
  mutatedSchema.$id = "urn:pptx-compiler:schema:synthetic-other:1";
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
