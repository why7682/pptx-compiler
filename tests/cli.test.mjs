import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CLI_EXIT_CODES,
  executeCliWithResources
} from "../packages/cli/src/cli.mjs";
import { verifyCandidateBuildRecord } from
  "../packages/core/src/candidate-build-record.mjs";
import {
  CliProjectIoError,
  writeContainedJsonCreateOnly
} from "../packages/cli/src/project-io.mjs";
import { loadCliContractRuntime } from "../packages/cli/src/contract-runtime.mjs";
import {
  createCliStaticHost,
  CliStaticHostError,
  resolveCliRuntimeSupportItemId
} from "../packages/cli/src/static-host.mjs";
import * as coreJsonSchema from "../packages/core/src/json-schema.mjs";
import * as publicSyntheticFixtures from "../packages/public-synthetic/src/fixtures.mjs";
import {
  createPublicSyntheticProject,
  PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE,
  PUBLIC_SYNTHETIC_PRESET,
  PublicSyntheticProjectError
} from "../packages/public-synthetic/src/project.mjs";
import * as scriptSyntheticFixtures from "../scripts/generate-synthetic-fixtures.mjs";
import * as scriptJsonSchema from "../scripts/lib/json-schema.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const cliPath = path.join(repositoryRoot, "scripts", "pptx-compiler.mjs");
const splitRepositoryResources = Object.freeze({
  contractRoot: repositoryRoot,
  fixtureSourceRoot: path.join(repositoryRoot, "fixtures", "source-parts", "minimal"),
  staticHostArtifactPaths: Object.freeze({
    conformanceCasesPath: path.join(
      repositoryRoot,
      "fixtures",
      "capabilities",
      "native-card-arrow",
      "cases.json"
    ),
    expectedTemplateIndexPath: path.join(
      repositoryRoot,
      "fixtures",
      "inspection",
      "expected-potx-template-index.json"
    ),
    inputSchemaPath: path.join(
      repositoryRoot,
      "plugins",
      "native-card-arrow",
      "schemas",
      "input.schema.json"
    ),
    outputSchemaPath: path.join(
      repositoryRoot,
      "plugins",
      "native-card-arrow",
      "schemas",
      "output.schema.json"
    ),
    supportMatrixPath: path.join(repositoryRoot, "policy", "support-matrix.json"),
    supportMatrixSchemaPath: path.join(
      repositoryRoot,
      "schemas",
      "support-matrix.schema.json"
    )
  })
});
const [builtFixtures, bootstrapContracts] = await Promise.all([
  scriptSyntheticFixtures.buildSyntheticFixtures(),
  loadCliContractRuntime({ contractRoot: repositoryRoot })
]);
const potx = builtFixtures.archives.find((entry) => entry.variant === "potx");
const nativeRegistry = JSON.parse(await readFile(
  path.join(repositoryRoot, "fixtures", "capabilities", "native-card-arrow", "registry.json"),
  "utf8"
));

function bootstrapDependencies() {
  return {
    validateCapabilityRegistry: bootstrapContracts.validateCapabilityRegistry,
    validateDeckSpec: bootstrapContracts.validateDeckSpec,
    validateProjectConfig: bootstrapContracts.validateProjectConfig,
    validateProjectOverlay: bootstrapContracts.validateProjectOverlay,
    validateTemplateProfile: bootstrapContracts.validateTemplateProfile
  };
}

async function collectProductionImportClosure(entryRelativePath) {
  const rootManifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
  const importMap = rootManifest.imports;
  const pending = [path.join(repositoryRoot, entryRelativePath)];
  const visited = new Map();
  while (pending.length > 0) {
    const absolutePath = pending.pop();
    if (visited.has(absolutePath)) continue;
    const source = await readFile(absolutePath, "utf8");
    visited.set(absolutePath, source);
    const specifiers = new Set();
    for (const expression of [
      /\b(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/gu,
      /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu
    ]) {
      for (const match of source.matchAll(expression)) specifiers.add(match[1]);
    }
    for (const specifier of specifiers) {
      let dependencyPath;
      if (specifier.startsWith(".")) {
        dependencyPath = path.resolve(path.dirname(absolutePath), specifier);
      } else if (specifier.startsWith("#")) {
        const target = importMap?.[specifier];
        assert.equal(typeof target, "string", true, `unmapped production import: ${specifier}`);
        assert.equal(target.startsWith("./"), true, `non-local test import target: ${specifier}`);
        dependencyPath = path.resolve(repositoryRoot, target);
      } else {
        continue;
      }
      const relativePath = path.relative(repositoryRoot, dependencyPath);
      assert.equal(
        relativePath.startsWith("..") || path.isAbsolute(relativePath),
        false,
        `production dependency escapes repository: ${specifier}`
      );
      pending.push(dependencyPath);
    }
  }
  return visited;
}

async function syncTestDirectory(directory) {
  if (process.platform === "win32") return;
  const handle = await open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function projectConfig() {
  return {
    schemaVersion: "0.1.0",
    contractType: "project-config",
    projectId: "cli-synthetic-project",
    template: {
      sourcePath: "input/template.potx",
      profileId: "cli-synthetic-profile",
      profilePath: "data/template-profile.json",
      indexId: "cli-synthetic-index",
      indexPath: "records/template-index.json"
    },
    capabilityRegistry: {
      registryId: "cli-synthetic-registry",
      registryVersion: "0.1.0",
      path: "data/capability-registry.json"
    },
    projectOverlay: {
      overlayId: "cli-synthetic-overlay",
      path: "data/project-overlay.json"
    },
    paths: {
      assetRoot: "assets",
      stagingRoot: "staging",
      outputRoot: "deliveries"
    },
    policies: {
      experimentalCapabilities: "require-explicit-opt-in",
      unknownFeatures: "reject",
      ambiguousBindings: "reject",
      sourceMutation: "reject"
    }
  };
}

async function makeProject(label, { sourceBytes = potx.bytes } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), `pptx-cli-${label}.`));
  await Promise.all([
    mkdir(path.join(root, "input")),
    mkdir(path.join(root, "records")),
    mkdir(path.join(root, "data")),
    mkdir(path.join(root, "assets")),
    mkdir(path.join(root, "staging")),
    mkdir(path.join(root, "deliveries"))
  ]);
  const configPath = path.join(root, "data", "project-config.json");
  const outputPath = path.join(root, "records", "template-index.json");
  await Promise.all([
    writeFile(path.join(root, "input", "template.potx"), sourceBytes),
    writeFile(configPath, `${JSON.stringify(projectConfig(), null, 2)}\n`)
  ]);
  return { root, configPath, outputPath };
}

function runCli(args, { cwd = tmpdir() } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function inspectArgs(project) {
  return [
    "inspect",
    "--project-root", project.root,
    "--config", project.configPath,
    "--json"
  ];
}

function renderArgs(project) {
  return [
    "render",
    "--project-root", project.root,
    "--config", project.configPath,
    "--deck", project.deckPath,
    "--json"
  ];
}

function qaArgs(project, { json = true, extra = [] } = {}) {
  return [
    "qa",
    "--project-root", project.root,
    "--config", project.configPath,
    "--deck", project.deckPath,
    ...extra,
    ...(json ? ["--json"] : [])
  ];
}

async function makeInitializedProject(label) {
  const parent = await mkdtemp(path.join(tmpdir(), `pptx-cli-init-${label}.`));
  const root = path.join(parent, "project");
  const result = await runCli([
    "init",
    "--project-root", root,
    "--preset", "public-synthetic-native-card",
    "--json"
  ]);
  return {
    parent,
    root,
    result,
    configPath: path.join(root, "pptx-compiler.project.json"),
    outputPath: path.join(root, "records", "template-index.json"),
    deckPath: path.join(root, "data", "deck-spec.json")
  };
}

async function projectFiles(root) {
  const output = [];
  async function visit(relative = "") {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    for (const entry of entries) {
      const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(child);
      else output.push(child);
    }
  }
  await visit();
  return output.sort();
}

async function projectSnapshot(root) {
  return new Map(await Promise.all((await projectFiles(root)).map(async (relativePath) => [
    relativePath,
    await readFile(path.join(root, relativePath))
  ])));
}

function assertSingleJsonLine(result) {
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.endsWith("\n"), true);
  assert.equal(result.stdout.slice(0, -1).includes("\n"), false);
  return JSON.parse(result.stdout);
}

async function makeStaticInstallation() {
  const root = await mkdtemp(path.join(tmpdir(), "pptx-cli-static-host."));
  const artifacts = [
    "fixtures/capabilities/native-card-arrow/cases.json",
    "fixtures/inspection/expected-potx-template-index.json",
    "plugins/native-card-arrow/schemas/input.schema.json",
    "plugins/native-card-arrow/schemas/output.schema.json",
    "schemas/support-matrix.schema.json"
  ];
  for (const relativePath of artifacts) {
    const destination = path.join(root, ...relativePath.split("/"));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(path.join(repositoryRoot, relativePath)));
  }
  await mkdir(path.join(root, "policy"), { recursive: true });
  return root;
}

test("the schema engine moved into core without breaking the old script import", () => {
  assert.equal(coreJsonSchema.validateJson, scriptJsonSchema.validateJson);
  assert.equal(coreJsonSchema.createSchemaRegistry, scriptJsonSchema.createSchemaRegistry);
  assert.equal(
    scriptSyntheticFixtures.buildSyntheticFixtures,
    publicSyntheticFixtures.buildSyntheticFixtures
  );
  assert.equal(
    scriptSyntheticFixtures.generateSyntheticFixtures,
    publicSyntheticFixtures.generateSyntheticFixtures
  );
  assert.deepEqual(CLI_EXIT_CODES, { success: 0, failure: 1, usage: 2 });
});

test("static host authorizes exactly the frozen candidate closure and supported runtime", async () => {
  const root = await makeStaticInstallation();
  const matrixPath = path.join(root, "policy", "support-matrix.json");
  const matrix = JSON.parse(await readFile(
    path.join(repositoryRoot, "policy", "support-matrix.json"),
    "utf8"
  ));
  const createHost = () => createCliStaticHost({
    installationRoot: root,
    capabilityRegistry: nativeRegistry,
    validateCapabilityRegistry: bootstrapContracts.validateCapabilityRegistry,
    validateTemplateIndex: bootstrapContracts.validateTemplateIndex
  });
  try {
    for (const supportItemId of
      PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE.supportItemIds) {
      for (const mutation of ["missing", "unsupported", "wrong-disposition"]) {
        const changed = structuredClone(matrix);
        for (const items of Object.values(changed.dimensions)) {
          const index = items.findIndex((item) => item.id === supportItemId);
          if (index === -1) continue;
          if (mutation === "missing") items.splice(index, 1);
          if (mutation === "unsupported") {
            items[index].status = "unsupported";
            items[index].disposition = "unavailable";
          }
          if (mutation === "wrong-disposition") {
            items[index].disposition = "unavailable";
          }
        }
        await writeFile(matrixPath, `${JSON.stringify(changed)}\n`);
        await assert.rejects(
          createHost(),
          (error) => error instanceof CliStaticHostError &&
            error.pointer === "/supportProfile/supportItemIds"
        );
      }
    }

    const runtimeItemId = resolveCliRuntimeSupportItemId({
      platform: process.platform,
      nodeVersion: process.versions.node
    });
    for (const [itemId, pointer] of [
      [runtimeItemId, "/runtime"],
      [PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE.evidenceItemId,
        "/supportProfile/evidenceItemId"]
    ]) {
      const changed = structuredClone(matrix);
      const row = Object.values(changed.dimensions).flat().find((item) => item.id === itemId);
      row.status = "unsupported";
      row.disposition = "unavailable";
      await writeFile(matrixPath, `${JSON.stringify(changed)}\n`);
      await assert.rejects(
        createHost(),
        (error) => error instanceof CliStaticHostError && error.pointer === pointer
      );
    }

    for (const itemId of
      PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE.qaManualGateItemIds) {
      const changed = structuredClone(matrix);
      const row = Object.values(changed.dimensions).flat().find((item) => item.id === itemId);
      row.status = "unsupported";
      row.disposition = "unavailable";
      await writeFile(matrixPath, `${JSON.stringify(changed)}\n`);
      await assert.rejects(
        createHost(),
        (error) => error instanceof CliStaticHostError &&
          error.pointer === "/supportProfile/qaManualGateItemIds"
      );
    }

    await writeFile(matrixPath, `${JSON.stringify(matrix)}\n`);
    const host = await createHost();
    assert.equal(host.candidateProfile.profileId,
      PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE.profileId);
    assert.equal(host.candidateProfile.runtimeSupportItemId, runtimeItemId);
    assert.deepEqual(
      host.candidateProfile.supportItemIds,
      [...PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE.supportItemIds, runtimeItemId].sort()
    );
    assert.deepEqual(
      host.candidateProfile.qaManualGateItemIds,
      PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE.qaManualGateItemIds
    );
    assert.equal(host.candidateProfile.expectedTemplateIndex.templateIndexId,
      "public-synthetic-template-index");
    assert.equal(host.candidateProfile.expectedTemplateIndex.templateProfileId,
      "public-synthetic-template-profile");
    assert.equal(Object.isFrozen(host.candidateProfile.expectedTemplateIndex), true);
    assert.equal(Object.isFrozen(host.candidateProfile.expectedTemplateIndex.slides), true);
    for (const nodeVersion of ["21.7.3", "23.7.0", "25.1.0", "26.7.0"]) {
      assert.throws(
        () => resolveCliRuntimeSupportItemId({ platform: "darwin", nodeVersion }),
        (error) => error instanceof CliStaticHostError && error.pointer === "/runtime"
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("render composition imports only production native-card authorities", async () => {
  const closure = await collectProductionImportClosure("packages/cli/src/cli.mjs");
  const relativePaths = [...closure.keys()].map((absolutePath) =>
    path.relative(repositoryRoot, absolutePath).split(path.sep).join("/"));
  assert.ok(relativePaths.includes(
    "packages/core/src/native-card-candidate-publication.mjs"
  ));
  assert.ok(relativePaths.includes("packages/core/src/native-card-candidate-qa.mjs"));
  assert.ok(relativePaths.includes("packages/core/src/candidate-pair-publication.mjs"));
  assert.equal(relativePaths.includes(
    "packages/core/src/native-presentation-publication.mjs"
  ), false);
  assert.doesNotMatch(relativePaths.join("\n"), /(?:^|\/)tests\//mu);
  assert.doesNotMatch(relativePaths.join("\n"), /(?:^|\/)labs\//mu);
  assert.doesNotMatch(
    relativePaths.join("\n"),
    /(?:clone-fill|native-omml|ordered-slide-assembly|formula-transplant|receipt-bound-final-delivery|powerpoint-macos)/u
  );
  assert.doesNotMatch([...closure.values()].join("\n"), /(?:PowerPoint|osascript)/u);
});

test("the explicit split-resource host executes the complete candidate-alpha spine", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "pptx-cli-split-resources."));
  const projectRoot = path.join(parent, "project");
  const configPath = path.join(projectRoot, "pptx-compiler.project.json");
  const deckPath = path.join(projectRoot, "data", "deck-spec.json");
  const execute = (argv) => executeCliWithResources({
    argv,
    resources: splitRepositoryResources
  });
  try {
    const initialized = await execute([
      "init",
      "--project-root", projectRoot,
      "--preset", "public-synthetic-native-card",
      "--json"
    ]);
    assert.equal(initialized.exitCode, 0);
    assert.equal(assertSingleJsonLine(initialized).result.created, true);

    const inspected = await execute([
      "inspect",
      "--project-root", projectRoot,
      "--config", configPath,
      "--json"
    ]);
    assert.equal(inspected.exitCode, 0);

    const validated = await execute([
      "validate", "project",
      "--project-root", projectRoot,
      "--config", configPath,
      "--deck", deckPath,
      "--json"
    ]);
    assert.equal(validated.exitCode, 0);
    assert.equal(assertSingleJsonLine(validated).result.renderEligibility, "not-granted");

    const rendered = await execute([
      "render",
      "--project-root", projectRoot,
      "--config", configPath,
      "--deck", deckPath,
      "--json"
    ]);
    assert.equal(rendered.exitCode, 0);
    assert.equal(assertSingleJsonLine(rendered).result.deliveryEligible, false);

    const assessed = await execute([
      "qa",
      "--project-root", projectRoot,
      "--config", configPath,
      "--deck", deckPath,
      "--json"
    ]);
    assert.equal(assessed.exitCode, 0);
    assert.equal(assertSingleJsonLine(assessed).result.decision, "blocked");
    assert.deepEqual(await readdir(path.join(projectRoot, "deliveries")), [
      "public-synthetic-native-card-deck.candidate.json",
      "public-synthetic-native-card-deck.pptx",
      "public-synthetic-native-card-deck.qa.json"
    ]);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("the split-resource host rejects ambiguous or accessor-bearing resource records", async () => {
  for (const resources of [
    { ...splitRepositoryResources, unexpectedRoot: repositoryRoot },
    {
      ...splitRepositoryResources,
      staticHostArtifactPaths: Object.defineProperty(
        { ...splitRepositoryResources.staticHostArtifactPaths },
        "supportMatrixPath",
        { enumerable: true, get: () => path.join(repositoryRoot, "policy", "support-matrix.json") }
      )
    }
  ]) {
    const result = await executeCliWithResources({
      argv: ["doctor", "--json"],
      resources
    });
    assert.equal(result.exitCode, 1);
    assert.deepEqual(assertSingleJsonLine(result), {
      protocolVersion: "0.1.0",
      command: null,
      ok: false,
      error: { code: "CLI_HOST_INVALID", pointer: "" }
    });
  }
});

test("init creates one deterministic schema-valid public-synthetic project", async () => {
  const [left, right] = await Promise.all([
    makeInitializedProject("left"),
    makeInitializedProject("right")
  ]);
  assert.equal(left.result.code, 0);
  assert.equal(right.result.code, 0);
  assert.equal(left.result.stdout, right.result.stdout);
  assert.deepEqual(assertSingleJsonLine(left.result), {
    protocolVersion: "0.1.0",
    command: "init",
    ok: true,
    result: {
      preset: "public-synthetic-native-card",
      projectVersion: "0.1.0",
      created: true,
      files: [
        "data/capability-registry.json",
        "data/deck-spec.json",
        "data/project-overlay.json",
        "data/template-profile.json",
        "input/template.potx",
        "pptx-compiler.project.json"
      ]
    }
  });
  assert.deepEqual(await projectFiles(left.root), [
    "data/capability-registry.json",
    "data/deck-spec.json",
    "data/project-overlay.json",
    "data/template-profile.json",
    "input/template.potx",
    "pptx-compiler.project.json"
  ]);
  for (const relativePath of await projectFiles(left.root)) {
    assert.deepEqual(
      await readFile(path.join(left.root, relativePath)),
      await readFile(path.join(right.root, relativePath))
    );
  }
});

test("init is create-only and an unavailable preset creates no root", async () => {
  const project = await makeInitializedProject("conflict");
  const before = new Map(await Promise.all((await projectFiles(project.root)).map(async (relativePath) => [
    relativePath,
    await readFile(path.join(project.root, relativePath))
  ])));
  const conflict = await runCli([
    "init",
    "--project-root", project.root,
    "--preset", "public-synthetic-native-card",
    "--json"
  ]);
  assert.equal(conflict.code, 1);
  assert.deepEqual(assertSingleJsonLine(conflict).error, {
    code: "PUBLIC_SYNTHETIC_PROJECT_CONFLICT",
    pointer: "/projectRoot"
  });
  for (const [relativePath, bytes] of before) {
    assert.deepEqual(await readFile(path.join(project.root, relativePath)), bytes);
  }

  const unavailableRoot = path.join(project.parent, "unavailable");
  const unavailable = await runCli([
    "init",
    "--project-root", unavailableRoot,
    "--preset", "private-preset-name",
    "--json"
  ]);
  assert.equal(unavailable.code, 1);
  assert.deepEqual(assertSingleJsonLine(unavailable).error, {
    code: "PUBLIC_SYNTHETIC_PROJECT_PRESET_UNAVAILABLE",
    pointer: "/preset"
  });
  await assert.rejects(readdir(unavailableRoot));
});

test("init rolls back a pre-marker failure and reports not committed", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "pptx-cli-init-rollback."));
  const root = path.join(parent, "project");
  let failed = false;
  await assert.rejects(
    createPublicSyntheticProject(
      {
        projectRoot: root,
        preset: PUBLIC_SYNTHETIC_PRESET,
        dependencies: bootstrapDependencies()
      },
      {
        async syncDirectory(directory) {
          if (!failed) {
            failed = true;
            throw new Error("private pre-marker failure");
          }
          await syncTestDirectory(directory);
        }
      }
    ),
    (error) => {
      assert.equal(error instanceof PublicSyntheticProjectError, true);
      assert.equal(error.code, "PUBLIC_SYNTHETIC_PROJECT_NOT_COMMITTED");
      assert.equal(error.pointer, "/projectRoot");
      assert.equal(error.message.includes("private pre-marker failure"), false);
      return true;
    }
  );
  assert.equal(failed, true);
  await assert.rejects(readdir(root));
});

test("init preserves an incomplete rollback for explicit reconciliation", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "pptx-cli-init-incomplete."));
  const root = path.join(parent, "project");
  let failed = false;
  await assert.rejects(
    createPublicSyntheticProject(
      {
        projectRoot: root,
        preset: PUBLIC_SYNTHETIC_PRESET,
        dependencies: bootstrapDependencies()
      },
      {
        async syncDirectory(directory) {
          if (!failed) {
            failed = true;
            await writeFile(path.join(root, "unexpected-entry"), "reconcile\n");
            throw new Error("private rollback conflict");
          }
          await syncTestDirectory(directory);
        }
      }
    ),
    (error) => {
      assert.equal(error instanceof PublicSyntheticProjectError, true);
      assert.equal(error.code, "PUBLIC_SYNTHETIC_PROJECT_ROLLBACK_INCOMPLETE");
      assert.equal(error.pointer, "/projectRoot");
      return true;
    }
  );
  assert.equal(await readFile(path.join(root, "unexpected-entry"), "utf8"), "reconcile\n");
  await rm(root, { recursive: true, force: true });
});

test("init reports commit uncertainty once the ProjectConfig marker is visible", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "pptx-cli-init-uncertain."));
  const root = path.join(parent, "project");
  await assert.rejects(
    createPublicSyntheticProject(
      {
        projectRoot: root,
        preset: PUBLIC_SYNTHETIC_PRESET,
        dependencies: bootstrapDependencies()
      },
      {
        async syncFile(handle, filePath) {
          if (path.basename(filePath) === "pptx-compiler.project.json") {
            throw new Error("private marker sync failure");
          }
          await handle.sync();
        }
      }
    ),
    (error) => {
      assert.equal(error instanceof PublicSyntheticProjectError, true);
      assert.equal(error.code, "PUBLIC_SYNTHETIC_PROJECT_COMMIT_UNCERTAIN");
      assert.equal(error.pointer, "/projectRoot");
      assert.equal(error.message.includes("private marker sync failure"), false);
      return true;
    }
  );
  assert.deepEqual(await projectFiles(root), [
    "data/capability-registry.json",
    "data/deck-spec.json",
    "data/project-overlay.json",
    "data/template-profile.json",
    "input/template.potx",
    "pptx-compiler.project.json"
  ]);
  await rm(root, { recursive: true, force: true });
});

test("inspect is deterministic across project roots and working directories", async () => {
  const left = await makeProject("deterministic-left");
  const right = await makeProject("deterministic-right");
  const [leftRun, rightRun] = await Promise.all([
    runCli(inspectArgs(left), { cwd: left.root }),
    runCli(inspectArgs(right), { cwd: repositoryRoot })
  ]);
  assert.equal(leftRun.code, 0);
  assert.equal(rightRun.code, 0);
  assert.equal(leftRun.signal, null);
  assert.equal(leftRun.stdout, rightRun.stdout);

  const envelope = assertSingleJsonLine(leftRun);
  assert.deepEqual(Object.keys(envelope), ["protocolVersion", "command", "ok", "result"]);
  assert.equal(envelope.protocolVersion, "0.1.0");
  assert.equal(envelope.command, "inspect");
  assert.equal(envelope.ok, true);
  assert.equal(envelope.result.contractType, "template-index");
  assert.equal(envelope.result.templateIndexId, "cli-synthetic-index");
  assert.deepEqual(JSON.parse(await readFile(left.outputPath, "utf8")), envelope.result);
  assert.deepEqual(await readdir(path.dirname(left.outputPath)), ["template-index.json"]);
  for (const secret of [left.root, right.root, left.configPath, right.configPath]) {
    assert.equal(leftRun.stdout.includes(secret), false);
    assert.equal(rightRun.stdout.includes(secret), false);
  }
});

test("inspect is create-only and preserves the first exact output", async () => {
  const project = await makeProject("create-only");
  const first = await runCli(inspectArgs(project));
  assert.equal(first.code, 0);
  const before = await readFile(project.outputPath);
  const second = await runCli(inspectArgs(project));
  assert.equal(second.code, 1);
  const envelope = assertSingleJsonLine(second);
  assert.equal(envelope.command, "inspect");
  assert.equal(envelope.ok, false);
  assert.deepEqual(envelope.error, { code: "CLI_OUTPUT_CONFLICT", pointer: "/output" });
  assert.deepEqual(await readFile(project.outputPath), before);
  assert.deepEqual(await readdir(path.dirname(project.outputPath)), ["template-index.json"]);
});

test("validate consumes the written contract without creating another artifact", async () => {
  const project = await makeProject("validate");
  assert.equal((await runCli(inspectArgs(project))).code, 0);
  const before = await readdir(path.dirname(project.outputPath));
  const result = await runCli([
    "validate",
    "document",
    "--project-root", project.root,
    "--input", project.outputPath,
    "--contract", "template-index",
    "--json"
  ]);
  assert.equal(result.code, 0);
  assert.deepEqual(assertSingleJsonLine(result), {
    protocolVersion: "0.1.0",
    command: "validate",
    ok: true,
    result: {
      scope: "document",
      contractType: "template-index",
      schemaVersion: "0.1.0",
      valid: true
    }
  });
  assert.deepEqual(await readdir(path.dirname(project.outputPath)), before);
});

test("schema errors expose only a stable code and JSON pointer", async () => {
  const project = await makeProject("schema-error");
  const invalidPath = path.join(project.root, "data", "invalid.json");
  const privateKey = `${project.root}\nprivate-canary`;
  await writeFile(invalidPath, JSON.stringify({
    ...projectConfig(),
    [privateKey]: "private-value"
  }));
  const result = await runCli([
    "validate",
    "document",
    "--project-root", project.root,
    "--input", invalidPath,
    "--contract", "project-config",
    "--json"
  ]);
  assert.equal(result.code, 1);
  assert.deepEqual(assertSingleJsonLine(result), {
    protocolVersion: "0.1.0",
    command: "validate",
    ok: false,
    error: { code: "CLI_INPUT_INVALID", pointer: "/input" }
  });
  assert.equal(result.stdout.includes(project.root), false);
  assert.equal(result.stdout.includes("private-canary"), false);
});

test("validate rejects malformed UTF-8 instead of repairing it before Schema validation", async () => {
  const project = await makeProject("invalid-utf8");
  const inputPath = path.join(project.root, "data", "deck-spec.json");
  const bytes = Buffer.from(await readFile(
    path.join(repositoryRoot, "fixtures", "contracts", "valid", "deck-spec.json")
  ));
  const marker = Buffer.from("Synthetic title", "utf8");
  const markerOffset = bytes.indexOf(marker);
  assert.notEqual(markerOffset, -1);
  bytes[markerOffset] = 0xff;
  assert.equal(JSON.parse(bytes.toString("utf8")).contractType, "deck-spec");
  await writeFile(inputPath, bytes);

  const result = await runCli([
    "validate",
    "document",
    "--project-root", project.root,
    "--input", inputPath,
    "--contract", "deck-spec",
    "--json"
  ]);
  assert.equal(result.code, 1);
  assert.deepEqual(assertSingleJsonLine(result), {
    protocolVersion: "0.1.0",
    command: "validate",
    ok: false,
    error: { code: "CLI_INPUT_INVALID", pointer: "/input" }
  });
});

test("archive failures never disclose the root, filename, or untrusted bytes", async () => {
  const canary = "private-xml-canary";
  const project = await makeProject("archive-redaction", {
    sourceBytes: Buffer.from(`<private>${canary}</private>`, "utf8")
  });
  const result = await runCli(inspectArgs(project));
  assert.equal(result.code, 1);
  const envelope = assertSingleJsonLine(result);
  assert.equal(envelope.command, "inspect");
  assert.equal(envelope.ok, false);
  assert.equal(typeof envelope.error.code, "string");
  for (const secret of [project.root, project.configPath, "template.potx", canary]) {
    assert.equal(result.stdout.includes(secret), false);
    assert.equal(result.stderr.includes(secret), false);
  }
  assert.deepEqual(await readdir(path.dirname(project.outputPath)), []);
});

test("argument grammar and deferred commands fail closed with stable process codes", async () => {
  const privateOption = "--/Users/private-project\nsecret";
  const usage = await runCli(["inspect", "--json", privateOption, "secret"]);
  assert.equal(usage.code, 2);
  assert.deepEqual(assertSingleJsonLine(usage), {
    protocolVersion: "0.1.0",
    command: "inspect",
    ok: false,
    error: { code: "CLI_USAGE", pointer: "/arguments/options" }
  });
  assert.equal(usage.stdout.includes("private-project"), false);
  assert.equal(usage.stdout.slice(0, -1).includes("\n"), false);

  const missingMode = await runCli(["validate", "--json"]);
  assert.equal(missingMode.code, 2);
  assert.deepEqual(assertSingleJsonLine(missingMode), {
    protocolVersion: "0.1.0",
    command: "validate",
    ok: false,
    error: { code: "CLI_USAGE", pointer: "/arguments/mode" }
  });

  const deferred = await runCli(["doctor", "--json"]);
  assert.equal(deferred.code, 1);
  assert.deepEqual(assertSingleJsonLine(deferred), {
    protocolVersion: "0.1.0",
    command: "doctor",
    ok: false,
    error: { code: "CLI_COMMAND_UNAVAILABLE", pointer: "/commands/doctor" }
  });

  const human = await runCli(["unknown-command"]);
  assert.equal(human.code, 2);
  assert.equal(human.stdout, "");
  assert.equal(human.stderr, "CLI_USAGE at /arguments/command\n");
});

test("inspect has no duplicate output authority", async () => {
  const project = await makeProject("output-authority");
  const other = path.join(project.root, "records", "other.json");
  const result = await runCli([...inspectArgs(project), "--output", other]);
  assert.equal(result.code, 2);
  assert.deepEqual(assertSingleJsonLine(result).error, {
    code: "CLI_USAGE",
    pointer: "/arguments/options"
  });
  assert.deepEqual(await readdir(path.dirname(project.outputPath)), []);

  assert.equal((await runCli(inspectArgs(project))).code, 0);
  assert.deepEqual(await readdir(path.dirname(project.outputPath)), ["template-index.json"]);
  await assert.rejects(readFile(other));
});

test("whole-project validation runs registration conformance but no project invocation or output", async () => {
  const project = await makeInitializedProject("project-preflight");
  assert.equal(project.result.code, 0);
  assert.equal((await runCli(inspectArgs(project))).code, 0);
  const before = await projectSnapshot(project.root);

  const result = await runCli([
    "validate",
    "project",
    "--project-root", project.root,
    "--config", project.configPath,
    "--deck", project.deckPath,
    "--json"
  ]);
  assert.equal(result.code, 0);
  assert.deepEqual(assertSingleJsonLine(result), {
    protocolVersion: "0.1.0",
    command: "validate",
    ok: true,
    result: {
      scope: "project",
      schemaVersion: "0.1.0",
      valid: true,
      registrationConformanceExecution: "passed",
      projectDispatchPreflight: "passed",
      invocationCount: 1,
      projectInvocationExecution: "not-run",
      renderEligibility: "not-granted"
    }
  });
  assert.deepEqual(await projectSnapshot(project.root), before);
  assert.deepEqual(await readdir(path.join(project.root, "staging")), []);
  assert.deepEqual(await readdir(path.join(project.root, "deliveries")), []);
});

test("whole-project validation re-inspects the source and rejects a stale TemplateIndex", async () => {
  const project = await makeInitializedProject("stale-index");
  assert.equal((await runCli(inspectArgs(project))).code, 0);
  const index = JSON.parse(await readFile(project.outputPath, "utf8"));
  index.observedFeatureIds = [...index.observedFeatureIds, "notes-comments"].sort();
  await writeFile(project.outputPath, `${JSON.stringify(index, null, 2)}\n`);

  const result = await runCli([
    "validate", "project",
    "--project-root", project.root,
    "--config", project.configPath,
    "--deck", project.deckPath,
    "--json"
  ]);
  assert.equal(result.code, 1);
  assert.deepEqual(assertSingleJsonLine(result).error, {
    code: "CLI_PROJECT_STALE",
    pointer: "/templateIndex"
  });
});

test("whole-project validation rejects schema-valid identity drift", async () => {
  const project = await makeInitializedProject("identity-drift");
  assert.equal((await runCli(inspectArgs(project))).code, 0);
  const profilePath = path.join(project.root, "data", "template-profile.json");
  const profile = JSON.parse(await readFile(profilePath, "utf8"));
  profile.templateIndexId = "other-template-index";
  await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`);

  const result = await runCli([
    "validate", "project",
    "--project-root", project.root,
    "--config", project.configPath,
    "--deck", project.deckPath,
    "--json"
  ]);
  assert.equal(result.code, 1);
  assert.deepEqual(assertSingleJsonLine(result).error, {
    code: "PROJECT_DISPATCH_RESOLUTION_IDENTITY_MISMATCH",
    pointer: "/templateProfile/templateIndexId"
  });
});

test("whole-project validation cannot bypass normative experimental opt-in", async () => {
  const project = await makeInitializedProject("support-policy");
  assert.equal((await runCli(inspectArgs(project))).code, 0);
  const overlayPath = path.join(project.root, "data", "project-overlay.json");
  const overlay = JSON.parse(await readFile(overlayPath, "utf8"));
  overlay.capabilitySelections[0].experimentalOptIn = false;
  await writeFile(overlayPath, `${JSON.stringify(overlay, null, 2)}\n`);

  const result = await runCli([
    "validate", "project",
    "--project-root", project.root,
    "--config", project.configPath,
    "--deck", project.deckPath,
    "--json"
  ]);
  assert.equal(result.code, 1);
  assert.deepEqual(assertSingleJsonLine(result).error, {
    code: "CAPABILITY_RUNTIME_EXPERIMENTAL_OPT_IN_REQUIRED",
    pointer: "/invocations/0/experimentalOptIn"
  });
});

test("render creates one exact experimental candidate and replayable record", async () => {
  const project = await makeInitializedProject("candidate-render");
  assert.equal(project.result.code, 0);
  assert.equal((await runCli(inspectArgs(project))).code, 0);
  const sourcePath = path.join(project.root, "input", "template.potx");
  const sourceBefore = await readFile(sourcePath);

  const rendered = await runCli(renderArgs(project));
  assert.equal(rendered.code, 0);
  const envelope = assertSingleJsonLine(rendered);
  assert.equal(envelope.command, "render");
  assert.equal(envelope.ok, true);
  assert.equal(envelope.result.scope, "candidate");
  assert.equal(envelope.result.supportProfileId,
    "public-synthetic-native-card-candidate");
  assert.equal(envelope.result.supportStatus, "experimental");
  assert.equal(envelope.result.supportClaimsEnabled, false);
  assert.equal(envelope.result.registrationConformanceExecution, "passed");
  assert.equal(envelope.result.projectDispatchPreflight, "passed");
  assert.equal(envelope.result.invocationCount, 1);
  assert.equal(envelope.result.projectInvocationExecution, "executed");
  assert.equal(envelope.result.artifactType, "candidate-pptx");
  assert.equal(envelope.result.deliveryEligible, false);
  assert.equal(envelope.result.fileName, "public-synthetic-native-card-deck.pptx");
  assert.equal(envelope.result.buildRecord.fileName,
    "public-synthetic-native-card-deck.candidate.json");

  const outputRoot = path.join(project.root, "deliveries");
  const candidatePath = path.join(outputRoot, envelope.result.fileName);
  const recordPath = path.join(outputRoot, envelope.result.buildRecord.fileName);
  const [candidateBytes, recordBytes] = await Promise.all([
    readFile(candidatePath),
    readFile(recordPath)
  ]);
  const verified = verifyCandidateBuildRecord({
    candidateBytes,
    recordBytes,
    candidateFileName: envelope.result.fileName
  });
  assert.equal(verified.record.output.sha256, envelope.result.sha256);
  assert.equal(verified.record.output.byteLength, envelope.result.bytes);
  assert.equal(verified.record.slide.layoutIr.inputProfile, "bounded-slot-placement");
  assert.equal(verified.record.slide.composedSlidePlan.constraintReceipt.status, "pass");
  assert.deepEqual(
    verified.record.slide.composedSlidePlan.constraintReceipt.occupancyChecks
      .map((entry) => entry.status),
    ["clear", "clear", "clear"]
  );
  assert.deepEqual(await readdir(outputRoot), [
    "public-synthetic-native-card-deck.candidate.json",
    "public-synthetic-native-card-deck.pptx"
  ]);
  assert.deepEqual(await readdir(path.join(project.root, "staging")), []);
  assert.deepEqual(await readFile(sourcePath), sourceBefore);
  assert.equal((await projectFiles(project.root)).some((name) =>
    name.endsWith("qa-report.json") || name.endsWith("build-artifact.json")), false);
});

test("render candidate and record bytes are deterministic across project roots", async () => {
  const [left, right] = await Promise.all([
    makeInitializedProject("candidate-deterministic-left"),
    makeInitializedProject("candidate-deterministic-right")
  ]);
  await Promise.all([runCli(inspectArgs(left)), runCli(inspectArgs(right))]);
  const [leftResult, rightResult] = await Promise.all([
    runCli(renderArgs(left)),
    runCli(renderArgs(right))
  ]);
  assert.equal(leftResult.code, 0);
  assert.equal(rightResult.code, 0);
  const fileNames = [
    "public-synthetic-native-card-deck.candidate.json",
    "public-synthetic-native-card-deck.pptx"
  ];
  for (const fileName of fileNames) {
    assert.deepEqual(
      await readFile(path.join(left.root, "deliveries", fileName)),
      await readFile(path.join(right.root, "deliveries", fileName))
    );
  }
});

test("qa records exact internal passes and honest unavailable external evidence", async () => {
  const project = await makeInitializedProject("candidate-qa");
  assert.equal(project.result.code, 0);
  assert.equal((await runCli(inspectArgs(project))).code, 0);
  assert.equal((await runCli(renderArgs(project))).code, 0);

  const assessed = await runCli(qaArgs(project));
  assert.equal(assessed.code, 0);
  const envelope = assertSingleJsonLine(assessed);
  assert.equal(envelope.command, "qa");
  assert.equal(envelope.ok, true);
  assert.equal(envelope.result.contractType, "qa-report");
  assert.equal(envelope.result.qaReportId,
    "public-synthetic-native-card-deck-qa");
  assert.equal(envelope.result.buildId,
    "public-synthetic-native-card-deck-candidate-build");
  assert.equal(envelope.result.decision, "blocked");

  const outputRoot = path.join(project.root, "deliveries");
  const report = JSON.parse(await readFile(
    path.join(outputRoot, "public-synthetic-native-card-deck.qa.json"),
    "utf8"
  ));
  assert.deepEqual(envelope.result, report);
  assert.equal(bootstrapContracts.validateQaReport(report), true);
  assert.equal(report.contractType, "qa-report");
  assert.equal(report.decision, "blocked");
  const templateProfile = JSON.parse(await readFile(
    path.join(project.root, "data", "template-profile.json"),
    "utf8"
  ));
  assert.equal(report.templateSha256, templateProfile.templateSha256);
  assert.deepEqual(report.checks.map(({ checkId, outcome, manualGateIds }) => ({
    checkId,
    outcome,
    manualGateIds
  })), [
    { checkId: "candidate-record-replay", outcome: "pass", manualGateIds: [] },
    { checkId: "mechanical-constraints", outcome: "pass", manualGateIds: [] },
    { checkId: "package-source-diff", outcome: "pass", manualGateIds: [] },
    {
      checkId: "pixel-review",
      outcome: "unavailable",
      manualGateIds: ["pixel-review-gate"]
    },
    {
      checkId: "powerpoint-compatibility",
      outcome: "unavailable",
      manualGateIds: ["powerpoint-compatibility-gate"]
    },
    {
      checkId: "render-complete",
      outcome: "unavailable",
      manualGateIds: ["render-complete-gate"]
    }
  ]);
  assert.deepEqual(report.manualGates.map((gate) => ({
    manualGateId: gate.manualGateId,
    supportMatrixItemId: gate.supportMatrixItemId,
    status: gate.status
  })), [
    {
      manualGateId: "pixel-review-gate",
      supportMatrixItemId: "manual-trusted-runtime",
      status: "unavailable"
    },
    {
      manualGateId: "powerpoint-compatibility-gate",
      supportMatrixItemId: "macos-powerpoint-automation",
      status: "unavailable"
    },
    {
      manualGateId: "render-complete-gate",
      supportMatrixItemId: "manual-trusted-runtime",
      status: "unavailable"
    }
  ]);
  assert.deepEqual(report.diagnostics, []);
  assert.deepEqual(await readdir(outputRoot), [
    "public-synthetic-native-card-deck.candidate.json",
    "public-synthetic-native-card-deck.pptx",
    "public-synthetic-native-card-deck.qa.json"
  ]);
  assert.equal((await projectFiles(project.root)).some((fileName) =>
    fileName.endsWith(".build.json") || fileName.includes("build-artifact")), false);
});

test("qa is deterministic and ignores uninstalled local evidence", async () => {
  const [left, right] = await Promise.all([
    makeInitializedProject("qa-deterministic-left"),
    makeInitializedProject("qa-deterministic-right")
  ]);
  await Promise.all([runCli(inspectArgs(left)), runCli(inspectArgs(right))]);
  await Promise.all([runCli(renderArgs(left)), runCli(renderArgs(right))]);
  await Promise.all([
    writeFile(
      path.join(left.root, "assets", "pixel-review.json"),
      '{"decision":"pass","reviewer":"ignored-local-evidence"}\n'
    ),
    writeFile(
      path.join(left.root, "staging", "powerpoint-compatibility.txt"),
      "pass: ignored local PowerPoint evidence\n"
    )
  ]);

  const [leftResult, rightResult] = await Promise.all([
    runCli(qaArgs(left)),
    runCli(qaArgs(right))
  ]);
  assert.equal(leftResult.code, 0);
  assert.equal(rightResult.code, 0);
  assert.equal(assertSingleJsonLine(leftResult).result.decision, "blocked");
  assert.equal(assertSingleJsonLine(rightResult).result.decision, "blocked");
  assert.deepEqual(
    await readFile(path.join(
      left.root,
      "deliveries",
      "public-synthetic-native-card-deck.qa.json"
    )),
    await readFile(path.join(
      right.root,
      "deliveries",
      "public-synthetic-native-card-deck.qa.json"
    ))
  );
});

test("qa is create-only and preserves its first report", async () => {
  const project = await makeInitializedProject("qa-create-only");
  assert.equal((await runCli(inspectArgs(project))).code, 0);
  assert.equal((await runCli(renderArgs(project))).code, 0);
  assert.equal((await runCli(qaArgs(project))).code, 0);
  const reportPath = path.join(
    project.root,
    "deliveries",
    "public-synthetic-native-card-deck.qa.json"
  );
  const before = await readFile(reportPath);

  const repeated = await runCli(qaArgs(project));
  assert.equal(repeated.code, 1);
  assert.deepEqual(assertSingleJsonLine(repeated).error, {
    code: "CLI_OUTPUT_CONFLICT",
    pointer: "/output"
  });
  assert.deepEqual(await readFile(reportPath), before);
});

test("qa distinguishes missing candidate and missing record without writing a report", async () => {
  const project = await makeInitializedProject("qa-missing-pair");
  assert.equal((await runCli(inspectArgs(project))).code, 0);

  const missingCandidate = await runCli(qaArgs(project));
  assert.equal(missingCandidate.code, 1);
  assert.deepEqual(assertSingleJsonLine(missingCandidate).error, {
    code: "CLI_INPUT_UNAVAILABLE",
    pointer: "/candidate"
  });

  assert.equal((await runCli(renderArgs(project))).code, 0);
  await rm(path.join(
    project.root,
    "deliveries",
    "public-synthetic-native-card-deck.candidate.json"
  ));
  const missingRecord = await runCli(qaArgs(project));
  assert.equal(missingRecord.code, 1);
  assert.deepEqual(assertSingleJsonLine(missingRecord).error, {
    code: "CLI_INPUT_UNAVAILABLE",
    pointer: "/candidateRecord"
  });
  assert.equal((await projectFiles(project.root)).some((fileName) =>
    fileName.endsWith(".qa.json")), false);
});

test("qa rejects candidate and record tampering without writing a report", async () => {
  for (const [label, fileName, pointer, mutate] of [
    [
      "candidate",
      "public-synthetic-native-card-deck.pptx",
      "/candidateBytes",
      (bytes) => {
        const changed = Buffer.from(bytes);
        changed[changed.length - 1] ^= 1;
        return changed;
      }
    ],
    [
      "record",
      "public-synthetic-native-card-deck.candidate.json",
      "/candidateRecord",
      (bytes) => Buffer.concat([bytes, Buffer.from(" ", "utf8")])
    ]
  ]) {
    const project = await makeInitializedProject(`qa-tamper-${label}`);
    assert.equal((await runCli(inspectArgs(project))).code, 0);
    assert.equal((await runCli(renderArgs(project))).code, 0);
    const targetPath = path.join(project.root, "deliveries", fileName);
    await writeFile(targetPath, mutate(await readFile(targetPath)));

    const result = await runCli(qaArgs(project));
    assert.equal(result.code, 1);
    assert.deepEqual(assertSingleJsonLine(result).error, {
      code: "NATIVE_CARD_CANDIDATE_QA_CANDIDATE_INVALID",
      pointer
    });
    assert.equal((await projectFiles(project.root)).some((name) =>
      name.endsWith(".qa.json")), false);
  }

  const linked = await makeInitializedProject("qa-candidate-symlink");
  assert.equal((await runCli(inspectArgs(linked))).code, 0);
  assert.equal((await runCli(renderArgs(linked))).code, 0);
  const linkedCandidate = path.join(
    linked.root,
    "deliveries",
    "public-synthetic-native-card-deck.pptx"
  );
  await rm(linkedCandidate);
  await symlink(path.join(linked.root, "input", "template.potx"), linkedCandidate);
  const symlinkResult = await runCli(qaArgs(linked));
  assert.equal(symlinkResult.code, 1);
  assert.deepEqual(assertSingleJsonLine(symlinkResult).error, {
    code: "CLI_INPUT_INVALID",
    pointer: "/candidate"
  });
  assert.equal((await projectFiles(linked.root)).some((name) =>
    name.endsWith(".qa.json")), false);
});

test("qa re-derives current intent and rejects a stale candidate", async () => {
  const project = await makeInitializedProject("qa-stale-intent");
  assert.equal((await runCli(inspectArgs(project))).code, 0);
  assert.equal((await runCli(renderArgs(project))).code, 0);
  const deck = JSON.parse(await readFile(project.deckPath, "utf8"));
  deck.slides[0].payload.label = "Changed but schema-valid public synthetic decision";
  await writeFile(project.deckPath, `${JSON.stringify(deck, null, 2)}\n`);

  const result = await runCli(qaArgs(project));
  assert.equal(result.code, 1);
  assert.deepEqual(assertSingleJsonLine(result).error, {
    code: "NATIVE_CARD_CANDIDATE_QA_CANDIDATE_INVALID",
    pointer: "/candidateBytes"
  });
  assert.equal((await projectFiles(project.root)).some((fileName) =>
    fileName.endsWith(".qa.json")), false);
});

test("qa rejects oversized candidates and unauthorized evidence arguments", async () => {
  const project = await makeInitializedProject("qa-input-boundary");
  assert.equal((await runCli(inspectArgs(project))).code, 0);
  assert.equal((await runCli(renderArgs(project))).code, 0);
  const outputRoot = path.join(project.root, "deliveries");
  const candidatePath = path.join(
    outputRoot,
    "public-synthetic-native-card-deck.pptx"
  );
  await writeFile(candidatePath, Buffer.alloc((1024 * 1024) + 1, 0x41));

  const oversized = await runCli(qaArgs(project));
  assert.equal(oversized.code, 1);
  assert.deepEqual(assertSingleJsonLine(oversized).error, {
    code: "CLI_INPUT_INVALID",
    pointer: "/candidate"
  });
  for (const option of ["--evidence", "--output", "--pixel-review"]) {
    const unauthorized = await runCli(qaArgs(project, {
      extra: [option, path.join(project.root, "assets", "ignored")]
    }));
    assert.equal(unauthorized.code, 2);
    assert.deepEqual(assertSingleJsonLine(unauthorized).error, {
      code: "CLI_USAGE",
      pointer: "/arguments/options"
    });
  }
  assert.equal((await readdir(outputRoot)).some((fileName) =>
    fileName.endsWith(".qa.json")), false);
});

test("qa human output reports the blocked decision exactly", async () => {
  const project = await makeInitializedProject("qa-human-output");
  assert.equal((await runCli(inspectArgs(project))).code, 0);
  assert.equal((await runCli(renderArgs(project))).code, 0);
  const assessed = await runCli(qaArgs(project, { json: false }));
  assert.equal(assessed.code, 0);
  assert.equal(assessed.stdout, "qa: blocked\n");
  assert.equal(assessed.stderr, "");
});

test("render rejects stale absolute geometry before invocation or output", async () => {
  const project = await makeInitializedProject("candidate-geometry-drift");
  assert.equal((await runCli(inspectArgs(project))).code, 0);
  const deck = JSON.parse(await readFile(project.deckPath, "utf8"));
  deck.slides[0].payload.geometry.x = 914400;
  deck.slides[0].payload.geometry.y = 2971800;
  await writeFile(project.deckPath, `${JSON.stringify(deck, null, 2)}\n`);

  const rendered = await runCli(renderArgs(project));
  assert.equal(rendered.code, 1);
  assert.deepEqual(assertSingleJsonLine(rendered).error, {
    code: "CLI_CANDIDATE_LAYOUT_MISMATCH",
    pointer: "/deckSpec/slides/0/payload/geometry"
  });
  assert.deepEqual(await readdir(path.join(project.root, "deliveries")), []);
  assert.deepEqual(await readdir(path.join(project.root, "staging")), []);
});

test("render is create-only and preserves the first candidate pair", async () => {
  const project = await makeInitializedProject("candidate-create-only");
  assert.equal((await runCli(inspectArgs(project))).code, 0);
  assert.equal((await runCli(renderArgs(project))).code, 0);
  const outputRoot = path.join(project.root, "deliveries");
  const before = await projectSnapshot(outputRoot);

  const repeated = await runCli(renderArgs(project));
  assert.equal(repeated.code, 1);
  assert.deepEqual(assertSingleJsonLine(repeated).error, {
    code: "NATIVE_PRESENTATION_PUBLICATION_OUTPUT_EXISTS",
    pointer: "/destination"
  });
  const after = await projectSnapshot(outputRoot);
  assert.deepEqual([...after.keys()], [...before.keys()]);
  for (const [name, bytes] of before) assert.deepEqual(after.get(name), bytes);
});

test("a post-link sync failure reports commit uncertainty and preserves reconciliation state", async () => {
  const project = await makeProject("commit-uncertain");
  const outputPath = path.join(project.root, "records", "uncertain.json");
  let syncCalls = 0;
  await assert.rejects(
    writeContainedJsonCreateOnly(
      { projectRoot: project.root, filePath: outputPath, value: { state: "linked" } },
      {
        async syncDirectory() {
          syncCalls += 1;
          if (syncCalls === 1) throw new Error("private post-link failure");
        }
      }
    ),
    (error) => {
      assert.equal(error instanceof CliProjectIoError, true);
      assert.equal(error.code, "CLI_OUTPUT_COMMIT_UNCERTAIN");
      assert.equal(error.pointer, "/output");
      assert.equal(error.message.includes("private post-link failure"), false);
      return true;
    }
  );
  assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), { state: "linked" });
  assert.deepEqual(
    (await readdir(path.dirname(outputPath))).sort(),
    ["uncertain.json"]
  );
  assert.equal(syncCalls, 2);
});
