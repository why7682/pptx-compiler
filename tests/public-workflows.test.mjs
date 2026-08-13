import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkPublicWorkflows } from "../scripts/check-public-workflows.mjs";
import {
  ALPHA_GITHUB_RELEASE_COMMAND,
  ALPHA_RELEASE_ENVIRONMENT,
  ALPHA_RELEASE_PREPARATION_COMMAND,
  ALPHA_RELEASE_PUBLISH_COMMAND,
  ALPHA_RELEASE_RUNTIME_COMMAND,
  ALPHA_RELEASE_SOURCE_VERIFICATION_COMMAND,
  ALPHA_RELEASE_TAG,
  inspectPublicWorkflowText,
  PUBLIC_IDENTITY_ANCHOR_COMMIT,
  PUBLIC_MAIN_HISTORY_COMMAND,
  PUBLIC_MAIN_HISTORY_CONDITION,
  PUBLIC_MAIN_IDENTITY_COMMAND,
  PUBLIC_WORKFLOW_PINS,
  renderPublicWorkflows,
  REQUIRED_RELEASE_ENTRY_PATHS,
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
const actualReleaseEntries = new Map(await Promise.all(
  REQUIRED_RELEASE_ENTRY_PATHS.map(async (relativePath) => [
    relativePath,
    await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8")
      .catch(() => undefined)
  ])
));

function mutate(relativePath, mutateText) {
  const files = new Map(actualFiles);
  files.set(relativePath, mutateText(files.get(relativePath)));
  return files;
}

test("ordinary CI/security and the isolated alpha release workflow are canonical", () => {
  assert.deepEqual(validatePublicWorkflowSet(
    actualFiles,
    packageDocument.scripts,
    actualReleaseEntries
  ), []);
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
  assert.equal(ALPHA_RELEASE_TAG, "v0.1.0-alpha.2");
  assert.equal(ALPHA_RELEASE_ENVIRONMENT, "npm-release");
  assert.equal(ALPHA_RELEASE_PREPARATION_COMMAND,
    "node scripts/check-alpha-release-preparation.mjs --mode release-tag --tag v0.1.0-alpha.2 --stage-root .package-stage/reviewed");
  assert.equal(ALPHA_RELEASE_SOURCE_VERIFICATION_COMMAND,
    "node scripts/publish-alpha-release.mjs --mode verify-source --tag v0.1.0-alpha.2 --stage-root .package-stage/reviewed");
  assert.equal(ALPHA_RELEASE_PUBLISH_COMMAND,
    "node scripts/publish-alpha-release.mjs --mode publish --tag v0.1.0-alpha.2 --stage-root .package-stage/reviewed");
  assert.equal(ALPHA_GITHUB_RELEASE_COMMAND,
    "node scripts/create-alpha-github-release.mjs --tag v0.1.0-alpha.2 --stage-root .package-stage/reviewed");
  assert.equal(ALPHA_RELEASE_RUNTIME_COMMAND,
    "test \"$(node --version)\" = \"v24.19.0\" && test \"$(npm --version)\" = \"11.17.0\"");
  assert.equal(PUBLIC_MAIN_HISTORY_CONDITION,
    "github.event_name == 'push' && github.ref == 'refs/heads/main'");
  assert.equal(PUBLIC_IDENTITY_ANCHOR_COMMIT,
    "16ff7331195842c6a427db1a855862bc0f007786");
  assert.equal(PUBLIC_MAIN_IDENTITY_COMMAND,
    "git config --local user.name \"$(git --no-replace-objects show -s --format=%an 16ff7331195842c6a427db1a855862bc0f007786)\" && git config --local user.email \"$(git --no-replace-objects show -s --format=%ae 16ff7331195842c6a427db1a855862bc0f007786)\"");
  assert.equal(PUBLIC_MAIN_HISTORY_COMMAND,
    "node scripts/check-forbidden-materials.mjs --mode history");
  const ci = actualFiles.get(".github/workflows/ci.yml");
  assert.equal((ci.match(/^\s*if:\s*github[.]event_name == 'push' && github[.]ref == 'refs\/heads\/main'\s*$/gmu) ?? []).length, 2);
  assert.equal((ci.match(/^\s*run:\s*git config --local user[.]name .* user[.]email .*$/gmu) ?? []).length, 1);
  assert.equal((ci.match(/^\s*run:\s*node scripts\/check-forbidden-materials[.]mjs --mode history\s*$/gmu) ?? []).length, 1);
  assert.match(ci, /uses: actions\/checkout@[0-9a-f]{40} # v7[.]0[.]1\n        with:\n          fetch-depth: 0\n          persist-credentials: false/u);
});

test("the executable gate enumerates the actual workflow directory", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pptx-public-workflows."));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, ".github", "workflows");
  await mkdir(directory, { recursive: true });
  for (const [relativePath, text] of renderPublicWorkflows()) {
    await writeFile(path.join(root, ...relativePath.split("/")), text);
  }
  await mkdir(path.join(root, "scripts"), { recursive: true });
  for (const relativePath of REQUIRED_RELEASE_ENTRY_PATHS) {
    await writeFile(
      path.join(root, ...relativePath.split("/")),
      "#!/usr/bin/env node\n"
    );
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
    const codes = new Set(validatePublicWorkflowSet(
      files,
      packageDocument.scripts,
      actualReleaseEntries
    )
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

  await t.test("accepted-main history scan cannot be deleted", () => {
    const original = actualFiles.get(".github/workflows/ci.yml");
    const text = original.replace(
      "      - name: Scan the complete accepted-main history\n" +
      `        if: ${PUBLIC_MAIN_HISTORY_CONDITION}\n` +
      `        run: ${PUBLIC_MAIN_HISTORY_COMMAND}\n`,
      ""
    );
    const codes = new Set(inspectPublicWorkflowText(
      ".github/workflows/ci.yml",
      text
    ).map(({ code }) => code));
    assert.equal(codes.has("workflow-main-history-scope"), true);
    assert.equal(codes.has("workflow-command"), true);
  });

  await t.test("accepted-main history scan cannot lose its identity anchor", () => {
    const original = actualFiles.get(".github/workflows/ci.yml");
    const identityStep =
      "      - name: Restore the approved public Git identity from immutable history\n" +
      `        if: ${PUBLIC_MAIN_HISTORY_CONDITION}\n` +
      `        run: ${PUBLIC_MAIN_IDENTITY_COMMAND}\n`;
    const deletedCodes = new Set(inspectPublicWorkflowText(
      ".github/workflows/ci.yml",
      original.replace(identityStep, "")
    ).map(({ code }) => code));
    assert.equal(deletedCodes.has("workflow-main-history-scope"), true);
    assert.equal(deletedCodes.has("workflow-command"), true);

    for (const replacement of [
      PUBLIC_MAIN_IDENTITY_COMMAND.replaceAll(PUBLIC_IDENTITY_ANCHOR_COMMIT, "HEAD"),
      "git config --local user.name \"${{ github.actor }}\" && git config --local user.email \"${{ github.actor }}@users.noreply.github.com\"",
      PUBLIC_MAIN_IDENTITY_COMMAND.replaceAll(
        PUBLIC_IDENTITY_ANCHOR_COMMIT,
        "0000000000000000000000000000000000000000"
      )
    ]) {
      const codes = new Set(inspectPublicWorkflowText(
        ".github/workflows/ci.yml",
        original.replace(PUBLIC_MAIN_IDENTITY_COMMAND, replacement)
      ).map(({ code }) => code));
      assert.equal(codes.has("workflow-main-history-scope"), true);
      assert.equal(codes.has("workflow-command"), true);
    }
  });

  await t.test("accepted-main history scan cannot run on a broader event", () => {
    const original = actualFiles.get(".github/workflows/ci.yml");
    for (const condition of [
      "github.event_name == 'push'",
      "github.event_name == 'pull_request'",
      "github.ref_type == 'tag'"
    ]) {
      const text = original.replaceAll(
        `if: ${PUBLIC_MAIN_HISTORY_CONDITION}`,
        `if: ${condition}`
      );
      assert.equal(inspectPublicWorkflowText(
        ".github/workflows/ci.yml",
        text
      ).some(({ code }) => code === "workflow-main-history-scope"), true);
    }
  });

  await t.test("accepted-main history scan requires a complete checkout", () => {
    const text = actualFiles.get(".github/workflows/ci.yml")
      .replace("          fetch-depth: 0\n", "          fetch-depth: 1\n");
    assert.equal(inspectPublicWorkflowText(
      ".github/workflows/ci.yml",
      text
    ).some(({ code }) => code === "workflow-main-history-scope"), true);
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
    const codes = new Set(validatePublicWorkflowSet(
      files,
      scripts,
      actualReleaseEntries
    ).map(({ code }) => code));
    assert.equal(codes.has("workflow-inventory"), true);
    assert.equal(codes.has("workflow-package-script"), true);
  });

  await t.test("gate script replaced by a no-op", () => {
    const scripts = { ...packageDocument.scripts, typecheck: "node -e 0" };
    assert.equal(validatePublicWorkflowSet(actualFiles, scripts, actualReleaseEntries)
      .some(({ code }) => code === "workflow-package-script"), true);
  });

  await t.test("npm lifecycle shadows are rejected before installation", () => {
    const scripts = {
      ...packageDocument.scripts,
      pretypecheck: "node -e 0"
    };
    assert.equal(validatePublicWorkflowSet(actualFiles, scripts, actualReleaseEntries)
      .some(({ code, pointer }) => code === "workflow-package-script" &&
        pointer === "/scripts/pretypecheck"), true);
  });

  await t.test("nested documented scripts cannot drift outside the CI subset", () => {
    const scripts = {
      ...packageDocument.scripts,
      "check:public-tree": "node -e 0"
    };
    assert.equal(validatePublicWorkflowSet(actualFiles, scripts, actualReleaseEntries)
      .some(({ code, pointer }) => code === "workflow-package-script" &&
        pointer === "/scripts/check:public-tree"), true);
  });

  await t.test("ordinary workflows remain credential-free while release is isolated", () => {
    for (const relativePath of [
      ".github/workflows/ci.yml",
      ".github/workflows/security.yml"
    ]) {
      const text = actualFiles.get(relativePath);
      assert.doesNotMatch(text, /(?:secrets[.]|\benvironment\s*:|\bid-token\s*:\s*write|npm\s+publish)/u);
    }
    const release = actualFiles.get(".github/workflows/alpha-release.yml");
    assert.equal((release.match(/\$\{\{ secrets[.]NPM_TOKEN \}\}/gu) ?? []).length, 1);
    assert.equal((release.match(/\$\{\{ github[.]token \}\}/gu) ?? []).length, 2);
    assert.match(release, /^\s*environment:\s*npm-release\s*$/mu);
    assert.equal((release.match(/^\s*id-token:\s*write\s*$/gmu) ?? []).length, 1);
    assert.equal((release.match(/^\s*contents:\s*write\s*$/gmu) ?? []).length, 1);
    assert.match(release, /declare:\n    name: Declare the exact GitHub prerelease last\n    needs: publish/u);
    assert.match(release, new RegExp(`run: ${ALPHA_GITHUB_RELEASE_COMMAND.replaceAll(".", "[.]")}`, "u"));
    assert.doesNotMatch(release, /\bgh\s+release\b/u);
  });

  await t.test("release rejects a branch ref, automatic trigger, or broader target", () => {
    const original = actualFiles.get(".github/workflows/alpha-release.yml");
    const triggerMutation = original.replace("  workflow_dispatch:\n", "  push:\n");
    const triggerCodes = new Set(inspectPublicWorkflowText(
      ".github/workflows/alpha-release.yml",
      triggerMutation
    ).map(({ code }) => code));
    assert.equal(triggerCodes.has("workflow-dangerous-trigger"), true);
    assert.equal(triggerCodes.has("workflow-release-trigger"), true);

    const refMutation = original.replace(
      "ref: ${{ github.sha }}",
      "ref: refs/heads/main"
    );
    assert.equal(inspectPublicWorkflowText(
      ".github/workflows/alpha-release.yml",
      refMutation
    ).some(({ code }) => code === "workflow-release-scope"), true);

    const runtimeMutation = original.replace(
      "test \"$(npm --version)\" = \"11.17.0\"",
      "test \"$(npm --version)\" = \"11\""
    );
    const runtimeCodes = new Set(inspectPublicWorkflowText(
      ".github/workflows/alpha-release.yml",
      runtimeMutation
    ).map(({ code }) => code));
    assert.equal(runtimeCodes.has("workflow-release-scope"), true);
    assert.equal(runtimeCodes.has("workflow-command"), true);

    const authorityMutation = original.replace(
      "    environment: npm-release\n    permissions:\n      actions: read\n      contents: read\n      id-token: write\n",
      "    environment: npm-release\n    permissions:\n      contents: read\n      id-token: write\n"
    ).replace(
      "permissions:\n  contents: read\n",
      "permissions:\n  contents: read\n  id-token: write\n"
    );
    assert.equal(inspectPublicWorkflowText(
      ".github/workflows/alpha-release.yml",
      authorityMutation
    ).some(({ code }) => code === "workflow-release-scope"), true);

    const secretMutation = original.replace(
      "      - name: Require the exact manual tag ref\n",
      "      - name: Leak publish authority into admission\n" +
      "        env:\n" +
      "          TOKEN: ${{ secrets.NPM_TOKEN }}\n" +
      "        run: test -n \"$TOKEN\"\n" +
      "      - name: Require the exact manual tag ref\n"
    );
    assert.equal(inspectPublicWorkflowText(
      ".github/workflows/alpha-release.yml",
      secretMutation
    ).some(({ code }) => code === "workflow-release-scope"), true);

    const sourceTokenMutation = original.replace(
      "          GITHUB_TOKEN: ${{ github.token }}",
      "          GITHUB_TOKEN: ${{ secrets.NPM_TOKEN }}"
    );
    assert.equal(inspectPublicWorkflowText(
      ".github/workflows/alpha-release.yml",
      sourceTokenMutation
    ).some(({ code }) => code === "workflow-release-scope"), true);

    const releaseMutation = `${original}      - run: gh release create v0.1.0-alpha.2\n`;
    assert.equal(inspectPublicWorkflowText(
      ".github/workflows/alpha-release.yml",
      releaseMutation
    ).some(({ code }) => code === "workflow-github-release"), true);
  });

  await t.test("release entry points are required rather than assumed", () => {
    const missing = new Map(actualReleaseEntries);
    missing.set("scripts/publish-alpha-release.mjs", undefined);
    assert.equal(validatePublicWorkflowSet(
      actualFiles,
      packageDocument.scripts,
      missing
    ).some(({ code, pointer }) => code === "workflow-release-entry" &&
      pointer === "scripts/publish-alpha-release.mjs"), true);
    const missingDeclaration = new Map(actualReleaseEntries);
    missingDeclaration.set("scripts/create-alpha-github-release.mjs", undefined);
    assert.equal(validatePublicWorkflowSet(
      actualFiles,
      packageDocument.scripts,
      missingDeclaration
    ).some(({ code, pointer }) => code === "workflow-release-entry" &&
      pointer === "scripts/create-alpha-github-release.mjs"), true);
  });
});
