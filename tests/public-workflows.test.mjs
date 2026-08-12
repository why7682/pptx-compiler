import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkPublicWorkflows } from "../scripts/check-public-workflows.mjs";
import {
  inspectPublicWorkflowText,
  PUBLIC_WORKFLOW_PINS,
  renderPublicWorkflows,
  REQUIRED_PUBLIC_SCRIPTS,
  validatePublicWorkflowSet
} from "../scripts/lib/public-workflows.mjs";

const packageDocument = JSON.parse(await readFile(
  new URL("../package.json", import.meta.url),
  "utf8"
));
const actualFiles = new Map(await Promise.all(
  [...renderPublicWorkflows().keys()].map(async (relativePath) => [
    relativePath,
    await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8")
  ])
));

function mutate(relativePath, mutateText) {
  const files = new Map(actualFiles);
  files.set(relativePath, mutateText(files.get(relativePath)));
  return files;
}

test("the two public workflows are canonical, least-privilege, and fully pinned", () => {
  assert.deepEqual(validatePublicWorkflowSet(actualFiles, packageDocument.scripts), []);
  assert.deepEqual(Object.keys(PUBLIC_WORKFLOW_PINS), [
    "checkout",
    "setupNode",
    "codeql",
    "dependencyReview"
  ]);
  assert.equal(Object.values(PUBLIC_WORKFLOW_PINS).every(({ sha }) =>
    /^[0-9a-f]{40}$/u.test(sha)), true);
  assert.equal(REQUIRED_PUBLIC_SCRIPTS.every((name) =>
    typeof packageDocument.scripts[name] === "string"), true);
});

test("the executable gate enumerates the actual workflow directory", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pptx-public-workflows."));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, ".github", "workflows");
  await mkdir(directory, { recursive: true });
  for (const [relativePath, text] of renderPublicWorkflows()) {
    await writeFile(path.join(root, ...relativePath.split("/")), text);
  }
  await writeFile(path.join(root, "package.json"), JSON.stringify({
    scripts: packageDocument.scripts
  }));
  assert.deepEqual(await checkPublicWorkflows(root), []);

  await writeFile(path.join(directory, "release.yml"), "name: Release\n");
  assert.equal((await checkPublicWorkflows(root))
    .some(({ code }) => code === "workflow-inventory"), true);
});

test("the executable gate rejects a redirected workflow directory", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pptx-public-workflow-root."));
  const external = await mkdtemp(path.join(os.tmpdir(), "pptx-public-workflow-external."));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  });
  await mkdir(path.join(root, ".github"));
  for (const [relativePath, text] of renderPublicWorkflows()) {
    await writeFile(path.join(external, path.basename(relativePath)), text);
  }
  await writeFile(path.join(root, "package.json"), JSON.stringify({
    scripts: packageDocument.scripts
  }));
  const { symlink } = await import("node:fs/promises");
  await symlink(
    external,
    path.join(root, ".github", "workflows"),
    process.platform === "win32" ? "junction" : "dir"
  );
  await assert.rejects(checkPublicWorkflows(root), /workflow-directory-invalid/u);
});

test("the workflow checker still executes through a file alias", {
  skip: process.platform === "win32"
}, async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pptx-public-workflow-alias."));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const alias = path.join(directory, "workflow-check.mjs");
  const { symlink } = await import("node:fs/promises");
  await symlink(
    fileURLToPath(new URL("../scripts/check-public-workflows.mjs", import.meta.url)),
    alias
  );
  const result = spawnSync(process.execPath, [alias], {
    cwd: directory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^PASS public-workflows:/u);
});

test("workflow mutations fail closed without a general YAML parser", async (t) => {
  await t.test("floating action", () => {
    const files = mutate(".github/workflows/ci.yml", (text) =>
      text.replace(/actions\/checkout@[0-9a-f]{40}/u, "actions/checkout@v7"));
    const codes = new Set(validatePublicWorkflowSet(files, packageDocument.scripts)
      .map(({ code }) => code));
    assert.equal(codes.has("workflow-action-pin"), true);
    assert.equal(codes.has("workflow-byte-drift"), true);
  });

  await t.test("dangerous trigger", () => {
    const text = actualFiles.get(".github/workflows/ci.yml")
      .replace("  pull_request:\n", "  pull_request_target:\n");
    assert.equal(inspectPublicWorkflowText(".github/workflows/ci.yml", text)
      .some(({ code }) => code === "workflow-dangerous-trigger"), true);
  });

  await t.test("credential persistence", () => {
    const text = actualFiles.get(".github/workflows/ci.yml")
      .replace("persist-credentials: false", "persist-credentials: true");
    assert.equal(inspectPublicWorkflowText(".github/workflows/ci.yml", text)
      .some(({ code }) => code === "workflow-checkout-credentials"), true);
  });

  await t.test("secret and publication command", () => {
    const text = `${actualFiles.get(".github/workflows/ci.yml")}` +
      "      - run: npm publish\n        env:\n          TOKEN: ${{ secrets.NPM_TOKEN }}\n";
    const codes = new Set(inspectPublicWorkflowText(".github/workflows/ci.yml", text)
      .map(({ code }) => code));
    assert.equal(codes.has("workflow-secret"), true);
    assert.equal(codes.has("workflow-publication"), true);
    assert.equal(codes.has("workflow-command"), true);
  });

  await t.test("missing platform and timeout", () => {
    const text = actualFiles.get(".github/workflows/ci.yml")
      .replace("windows-2025, ", "")
      .replace("    timeout-minutes: 45\n", "");
    const codes = new Set(inspectPublicWorkflowText(".github/workflows/ci.yml", text)
      .map(({ code }) => code));
    assert.equal(codes.has("workflow-portable-matrix"), true);
    assert.equal(codes.has("workflow-timeout"), true);
  });

  await t.test("floating runner", () => {
    const text = actualFiles.get(".github/workflows/security.yml")
      .replace("ubuntu-24.04", "ubuntu-latest");
    assert.equal(inspectPublicWorkflowText(".github/workflows/security.yml", text)
      .some(({ code }) => code === "workflow-floating-runner"), true);
  });

  await t.test("extra workflow and missing script", () => {
    const files = new Map(actualFiles);
    files.set(".github/workflows/release.yml", "name: Release\n");
    const scripts = { ...packageDocument.scripts };
    delete scripts.typecheck;
    const codes = new Set(validatePublicWorkflowSet(files, scripts).map(({ code }) => code));
    assert.equal(codes.has("workflow-inventory"), true);
    assert.equal(codes.has("workflow-package-script"), true);
  });

  await t.test("gate script replaced by a no-op", () => {
    const scripts = { ...packageDocument.scripts, typecheck: "node -e 0" };
    assert.equal(validatePublicWorkflowSet(actualFiles, scripts)
      .some(({ code }) => code === "workflow-package-script"), true);
  });

  await t.test("npm lifecycle shadows are rejected before installation", () => {
    const scripts = {
      ...packageDocument.scripts,
      pretypecheck: "node -e 0"
    };
    assert.equal(validatePublicWorkflowSet(actualFiles, scripts)
      .some(({ code, pointer }) => code === "workflow-package-script" &&
        pointer === "/scripts/pretypecheck"), true);
  });

  await t.test("nested documented scripts cannot drift outside the CI subset", () => {
    const scripts = {
      ...packageDocument.scripts,
      "check:public-tree": "node -e 0"
    };
    assert.equal(validatePublicWorkflowSet(actualFiles, scripts)
      .some(({ code, pointer }) => code === "workflow-package-script" &&
        pointer === "/scripts/check:public-tree"), true);
  });
});
