import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstat, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CORE_PACKAGE_ASSETS } from "../packages/core/src/package-assets.mjs";
import { PUBLIC_SYNTHETIC_PACKAGE_ASSETS } from
  "../packages/public-synthetic/src/package-assets.mjs";
import { NATIVE_CARD_ARROW_PACKAGE_ASSETS } from
  "../plugins/native-card-arrow/src/package-assets.mjs";
import {
  analyzePackageModuleSource,
  flattenPackageFiles,
  loadAlphaPackagePlan,
  parseAlphaPackagePlanBytes,
  validateAlphaPackagePlan
} from "../scripts/lib/package-plan.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const plan = await loadAlphaPackagePlan({ root: repositoryRoot });
const planBytes = await readFile(path.join(
  repositoryRoot,
  "packaging",
  "alpha-package-plan.json"
));
const ignoreBytes = await readFile(path.join(repositoryRoot, ".gitignore"));
const sourceSnapshots = new Map(await Promise.all(
  [...new Set(plan.packages.flatMap((item) => flattenPackageFiles(item)
    .map(({ source }) => source)))].map(async (source) => {
    const absolutePath = path.join(repositoryRoot, ...source.split("/"));
    const [bytes, metadata] = await Promise.all([
      readFile(absolutePath),
      lstat(absolutePath)
    ]);
    return [source, { bytes, mode: metadata.mode }];
  })
));
const packageReadmeSources = Object.freeze({
  cli: "packages/cli/README.md",
  core: "packages/core/README.md",
  "native-card-arrow": "plugins/native-card-arrow/README.md",
  "public-synthetic": "packages/public-synthetic/README.md"
});
const packageReadmeSections = Object.freeze([
  "## Purpose and boundary",
  "## Fact ownership and dependency flow",
  "## Executable contract",
  "## Evidence",
  "## Limitations",
  "## Next authorized action",
  "## License"
]);

function orderedSections(text, sections) {
  let cursor = -1;
  for (const section of sections) {
    const next = text.indexOf(`${section}\n`);
    if (next <= cursor) return false;
    cursor = next;
  }
  return true;
}

function clonePlan() {
  return structuredClone(plan);
}

function packageById(value, packageId) {
  return value.packages.find((item) => item.packageId === packageId);
}

async function findingCodes(value) {
  return new Set((await validateAlphaPackagePlan(value, { root: repositoryRoot }))
    .map((finding) => finding.code));
}

test("the alpha package plan closes one guarded four-package graph", async () => {
  assert.deepEqual(await validateAlphaPackagePlan(plan, { root: repositoryRoot }), []);
  assert.deepEqual(plan.packages.map(({ packageId, name }) => [packageId, name]), [
    ["cli", "pptx-compiler"],
    ["core", "pptx-compiler-core"],
    ["native-card-arrow", "pptx-compiler-native-card-arrow"],
    ["public-synthetic", "pptx-compiler-public-synthetic"]
  ]);
  assert.deepEqual(plan.repository, {
    provider: "github",
    repositoryId: "1330979133",
    owner: "why7682",
    name: "pptx-compiler",
    htmlUrl: "https://github.com/why7682/pptx-compiler"
  });
  assert.deepEqual(plan.releaseGuard, {
    state: "authorized",
    decisionId: "D-050"
  });
  assert.deepEqual(plan.publication, {
    registry: "https://registry.npmjs.org/",
    tag: "alpha",
    access: "public",
    provenance: true
  });
  assert.deepEqual(packageById(plan, "cli").bin, {
    "pptx-compiler": "pptx-compiler.mjs"
  });
  assert.equal(plan.namePolicy.result, "core-present-three-names-e404");
  assert.equal(plan.stagingRoot, ".package-stage");

  const graph = Object.fromEntries(plan.packages.map((item) => [
    item.packageId,
    item.dependencies.map(({ packageId }) => packageId)
  ]));
  assert.deepEqual(graph, {
    cli: ["core", "native-card-arrow", "public-synthetic"],
    core: [],
    "native-card-arrow": ["core"],
    "public-synthetic": []
  });
  assert.deepEqual(Object.fromEntries(plan.packages.map((item) => [
    item.packageId,
    flattenPackageFiles(item).find(({ target }) => target === "README.md")?.source
  ])), packageReadmeSources);
});

test("each package README is constructive, absolute-linked, and capability-scoped", () => {
  for (const item of plan.packages) {
    const source = packageReadmeSources[item.packageId];
    const text = sourceSnapshots.get(source).bytes.toString("utf8");
    assert.equal(text.startsWith(`# ${item.name}\n\n`), true, source);
    assert.equal(orderedSections(text, packageReadmeSections), true, source);
    const links = [...text.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)].map((match) => match[1]);
    assert.equal(links.length > 0, true, source);
    assert.equal(links.every((target) =>
      target.startsWith("https://github.com/why7682/pptx-compiler")), true, source);
    assert.match(text, /publication is permitted only through/iu, source);
    assert.match(text,
      /publication status is owned by the official-registry byte[\s\S]*tracked release lock[\s\S]*npm provenance/iu,
      source);
    assert.match(text, /this README never asserts[\s\S]*current lifecycle state/iu, source);
    assert.match(text, /supportClaimsEnabled: false/u, source);
    assert.doesNotMatch(text, /not yet been published|has not yet been published|not a published npm release/iu, source);
  }
  assert.match(sourceSnapshots.get(packageReadmeSources.cli).bytes.toString("utf8"),
    /pptx-compiler-native-card-arrow --> pptx-compiler-core/u);
  assert.match(sourceSnapshots.get(packageReadmeSources["native-card-arrow"]).bytes.toString("utf8"),
    /unbound plan with `insertable: false`[\s\S]*Core validates[\s\S]*remaps target-local identifiers/u);
  assert.match(sourceSnapshots.get(packageReadmeSources["public-synthetic"]).bytes.toString("utf8"),
    /imports no other alpha package/u);
});

test("the readable package plan has one canonical JSON representation", () => {
  assert.deepEqual(parseAlphaPackagePlanBytes(planBytes), plan);
  const text = planBytes.toString("utf8");
  const duplicate = text.replace(
    '  "packageVersion": "0.1.0-alpha.3",\n',
    '  "packageVersion": "9.9.9",\n  "packageVersion": "0.1.0-alpha.3",\n'
  );
  assert.throws(
    () => parseAlphaPackagePlanBytes(Buffer.from(duplicate)),
    /alpha-package-plan-canonical/u
  );
  const reordered = text.replace(
    '  "schemaVersion": 4,\n  "planId": "pptx-pipeline-alpha-package-plan",\n',
    '  "planId": "pptx-pipeline-alpha-package-plan",\n  "schemaVersion": 4,\n'
  );
  assert.throws(
    () => parseAlphaPackagePlanBytes(Buffer.from(reordered)),
    /alpha-package-plan-canonical/u
  );
});

test("the package builder cannot silently skip execution through a file alias", {
  skip: process.platform === "win32"
}, async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pptx-package-build-alias."));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const alias = path.join(directory, "package-build.mjs");
  await symlink(
    fileURLToPath(new URL("../scripts/build-alpha-packages.mjs", import.meta.url)),
    alias
  );
  const result = spawnSync(process.execPath, [alias, "--unexpected"], {
    cwd: directory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    schemaVersion: 1,
    ok: false,
    error: { code: "PACKAGE_BUILD_USAGE" }
  });
});

test("positive file mappings exclude every non-alpha implementation boundary", () => {
  const files = plan.packages.flatMap((item) => flattenPackageFiles(item)
    .map((entry) => `${item.packageId}:${entry.source}->${entry.target}`));
  assert.equal(files.length, new Set(files).size);
  assert.doesNotMatch(files.join("\n"), /(?:^|\/)(?:labs|tests|packages\/adapter-pandoc-omml|packages\/powerpoint-macos|plugins\/clone-fill)(?:\/|$)/u);
  assert.doesNotMatch(files.join("\n"), /(?:native-omml|native-presentation-publication|ordered-slide-assembly|receipt-bound-final-delivery)/u);
  assert.match(files.join("\n"), /core:packages\/core\/src\/candidate-alpha[.]mjs/u);
  assert.match(files.join("\n"), /cli:packages\/cli\/pptx-compiler[.]mjs->pptx-compiler[.]mjs/u);
});

test("package asset descriptors are frozen projections of staged targets", () => {
  for (const descriptor of [
    CORE_PACKAGE_ASSETS,
    PUBLIC_SYNTHETIC_PACKAGE_ASSETS,
    NATIVE_CARD_ARROW_PACKAGE_ASSETS
  ]) {
    assert.equal(Object.isFrozen(descriptor), true);
    assert.equal(path.isAbsolute(descriptor.packageRoot), true);
    assert.equal(path.isAbsolute(descriptor.assetRoot), true);
  }
  assert.equal(
    path.relative(CORE_PACKAGE_ASSETS.packageRoot, CORE_PACKAGE_ASSETS.supportMatrixPath)
      .split(path.sep).join("/"),
    "assets/policy/support-matrix.json"
  );
  assert.equal(
    path.relative(
      PUBLIC_SYNTHETIC_PACKAGE_ASSETS.packageRoot,
      PUBLIC_SYNTHETIC_PACKAGE_ASSETS.fixtureSourceRoot
    ).split(path.sep).join("/"),
    "assets/fixtures/source-parts/minimal"
  );
  assert.equal(
    path.relative(
      NATIVE_CARD_ARROW_PACKAGE_ASSETS.packageRoot,
      NATIVE_CARD_ARROW_PACKAGE_ASSETS.conformanceCasesPath
    ).split(path.sep).join("/"),
    "assets/fixtures/cases.json"
  );
});

test("facades expose only the installed alpha dependency surface", async () => {
  const [core, extension, plugin, preset] = await Promise.all([
    import("#pptx-compiler/core"),
    import("#pptx-compiler/extension-api"),
    import("#pptx-compiler/native-card-arrow"),
    import("#pptx-compiler/public-synthetic")
  ]);
  assert.deepEqual(Object.keys(extension).sort(), [
    "CapabilityRuntimeError",
    "StrictXmlError",
    "assertSupportedSchema",
    "createCapabilityRuntime",
    "createSchemaRegistry",
    "parseStrictXml",
    "validateJson"
  ]);
  assert.equal(typeof core.assessNativeCardCandidate, "function");
  assert.equal(typeof core.writeAuthenticatedNativeCardCandidateBundle, "function");
  assert.equal(Object.hasOwn(core, "assembleNativeOmmlFormulaFromSource"), false);
  assert.equal(Object.hasOwn(core, "prepareReceiptBoundFinalDelivery"), false);
  assert.deepEqual(Object.keys(plugin).sort(), [
    "NativeCardArrowRegistrationError",
    "createNativeCardArrowRegistration",
    "executeNativeCardArrow",
    "nativeCardArrowQaAssertions",
    "preflightNativeCardArrow"
  ]);
  assert.equal(typeof preset.createPublicSyntheticProject, "function");
  assert.equal(typeof preset.createInstalledPublicSyntheticProject, "function");
  assert.equal(
    preset.createInstalledPublicSyntheticProject,
    preset.createPublicSyntheticProject
  );
  assert.match(
    await readFile(path.join(repositoryRoot, "packages/core/types/candidate-alpha.d.ts"), "utf8"),
    /^export type \* from "[.]\/contracts[.]d[.]ts";/u
  );
});

test("module import analysis parses static ESM and rejects reviewed direct hazards", () => {
  const dynamic = analyzePackageModuleSource(
    "const dependency = 'missing-package'; await import(dependency);"
  );
  assert.equal(dynamic.hasDynamicImport, true);
  assert.equal(dynamic.hasCommonJsLoader, false);

  for (const source of [
    "await import/*gap*/(dependency);",
    "await import// gap\n(dependency);",
    "await import// gap\r(dependency);",
    "await import// gap\u2028(dependency);",
    "await import// gap\u2029(dependency);"
  ]) {
    assert.equal(analyzePackageModuleSource(source).hasDynamicImport, true);
  }

  const commonJs = analyzePackageModuleSource(
    "const load = createRequire(import.meta.url); load('missing-package');"
  );
  assert.equal(commonJs.hasCommonJsLoader, true);
  for (const source of [
    "require/*gap*/('missing-package');",
    "require// gap\n('missing-package');",
    "require// gap\r('missing-package');",
    "require// gap\u2028('missing-package');",
    "require// gap\u2029('missing-package');"
  ]) {
    assert.equal(analyzePackageModuleSource(source).hasCommonJsLoader, true);
  }

  assert.equal(analyzePackageModuleSource(
    'process.getBuiltinModule("module")._load("missing-package");'
  ).hasCommonJsLoader, true);
  assert.equal(analyzePackageModuleSource(
    'import Module from "node:module"; Module._load("missing-package");'
  ).hasCommonJsLoader, true);
  assert.equal(analyzePackageModuleSource(
    'Function("return import(\\"missing-package\\")")();'
  ).hasRuntimeCodeGeneration, true);

  const fakeBuiltin = analyzePackageModuleSource(
    "import value from 'node:not-a-real-builtin';"
  );
  assert.deepEqual(fakeBuiltin.invalidNodeSpecifiers, ["node:not-a-real-builtin"]);

  const literal = analyzePackageModuleSource(
    "const value = await import('node:fs/promises');"
  );
  assert.equal(literal.hasDynamicImport, true);
  assert.deepEqual(literal.invalidNodeSpecifiers, []);

  for (const source of [
    'import{version}from"typescript";',
    'import*as value from/*gap*/"typescript";',
    'import/*gap*/"typescript";',
    'export{version}from"typescript";',
    'export*from"typescript";'
  ]) {
    assert.deepEqual(analyzePackageModuleSource(source).specifiers, ["typescript"]);
  }
  assert.equal(analyzePackageModuleSource(
    'process.g\\u0065tBuiltinModule("module");'
  ).hasCommonJsLoader, true);
});

test("package-plan mutations fail closed", async (t) => {
  await t.test("the shipped CLI bin cannot hide a runtime dependency", async () => {
    const binSource = "packages/cli/pptx-compiler.mjs";
    for (const [source, expected] of [
      ['await import("left-pad");\n', "package-dynamic-import"],
      ['import "left-pad";\n', "package-bare-import"]
    ]) {
      const changed = new Map(sourceSnapshots);
      changed.set(binSource, {
        ...changed.get(binSource),
        bytes: Buffer.from(source)
      });
      const codes = new Set((await validateAlphaPackagePlan(plan, {
        root: repositoryRoot,
        sourceSnapshots: changed,
        ignoreBytes
      })).map(({ code }) => code));
      assert.equal(codes.has(expected), true);
    }
  });

  await t.test("the direct getBuiltinModule form fails in every shipped module role", async () => {
    const binSource = "packages/cli/pptx-compiler.mjs";
    const changed = new Map(sourceSnapshots);
    changed.set(binSource, {
      ...changed.get(binSource),
      bytes: Buffer.from(
        'process.getBuiltinModule("module")._load("left-pad");\n'
      )
    });
    const codes = new Set((await validateAlphaPackagePlan(plan, {
      root: repositoryRoot,
      sourceSnapshots: changed,
      ignoreBytes
    })).map(({ code }) => code));
    assert.equal(codes.has("package-commonjs-loader"), true);
  });

  await t.test("reviewed direct loader and code-generation forms are rejected", async () => {
    const binSource = "packages/cli/pptx-compiler.mjs";
    for (const bytes of [
      Buffer.from('import Module from "node:module"; Module._load("left-pad");\n'),
      Buffer.from('Function("return import(\\"left-pad\\")")();\n')
    ]) {
      const changed = new Map(sourceSnapshots);
      changed.set(binSource, { ...changed.get(binSource), bytes });
      const codes = new Set((await validateAlphaPackagePlan(plan, {
        root: repositoryRoot,
        sourceSnapshots: changed,
        ignoreBytes
      })).map(({ code }) => code));
      assert.equal(
        codes.has("package-commonjs-loader") || codes.has("package-code-generation"),
        true
      );
    }
  });

  await t.test("executable helpers cannot hide behind an unanalyzed extension", async () => {
    const value = clonePlan();
    const runtime = packageById(value, "core").files.find((entry) =>
      entry.sourceRoot === "packages/core" && entry.role === "runtime");
    runtime.paths.push("src/hidden.js");
    runtime.paths.sort();
    const changed = new Map(sourceSnapshots);
    changed.set("packages/core/src/hidden.js", {
      bytes: Buffer.from('import Module from "node:module"; Module._load("left-pad");\n'),
      mode: 0o100644
    });
    const candidate = changed.get("packages/core/src/candidate-alpha.mjs");
    changed.set("packages/core/src/candidate-alpha.mjs", {
      ...candidate,
      bytes: Buffer.concat([
        Buffer.from('import "./hidden.js";\n'),
        candidate.bytes
      ])
    });
    const codes = new Set((await validateAlphaPackagePlan(value, {
      root: repositoryRoot,
      sourceSnapshots: changed,
      ignoreBytes
    })).map(({ code }) => code));
    assert.equal(codes.has("package-executable-module-role"), true);
    assert.equal(codes.has("package-runtime-import-target"), true);
  });

  await t.test("relative imports resolve in the staged target graph", async () => {
    const value = clonePlan();
    const cli = packageById(value, "cli");
    const runtime = cli.files.find((entry) => entry.role === "runtime" &&
      entry.paths.includes("src/project-io.mjs"));
    runtime.paths = runtime.paths.filter((entry) => entry !== "src/project-io.mjs");
    cli.files.push({
      sourceRoot: "packages/cli",
      targetRoot: "relocated",
      role: "runtime",
      paths: ["src/project-io.mjs"]
    });
    const codes = await findingCodes(value);
    assert.equal(codes.has("package-runtime-import-target"), true);
  });


  await t.test("forbidden implementation", async () => {
    const value = clonePlan();
    const runtime = packageById(value, "core").files.find((entry) =>
      entry.sourceRoot === "packages/core" && entry.role === "runtime");
    runtime.paths.push("src/native-omml-formula-assembly.mjs");
    runtime.paths.sort();
    assert.equal((await findingCodes(value)).has("package-forbidden-source"), true);
  });

  await t.test("missing dependency", async () => {
    const value = clonePlan();
    packageById(value, "cli").dependencies.shift();
    assert.equal((await findingCodes(value)).has("package-import-map"), true);
  });

  await t.test("unmapped export", async () => {
    const value = clonePlan();
    packageById(value, "core").exports["."].import = "./src/not-present.mjs";
    assert.equal((await findingCodes(value)).has("package-export-target"), true);
  });

  await t.test("unmapped types", async () => {
    const value = clonePlan();
    packageById(value, "cli").types = "./types/not-present.d.ts";
    assert.equal((await findingCodes(value)).has("package-types-unmapped"), true);
  });

  await t.test("bin remapped away from its exact target", async () => {
    const value = clonePlan();
    const cli = packageById(value, "cli");
    const bin = cli.files.find((entry) => entry.role === "bin");
    bin.paths = ["types/index.d.ts"];
    const codes = await findingCodes(value);
    assert.equal(codes.has("package-bin-target"), true);
    assert.equal(codes.has("package-required-target"), true);
  });

  await t.test("target alias", async () => {
    const value = clonePlan();
    const cli = packageById(value, "cli");
    cli.files.push({
      sourceRoot: ".",
      targetRoot: ".",
      role: "documentation",
      paths: ["readme.md"]
    });
    assert.equal((await findingCodes(value)).has("package-target-alias"), true);
  });

  await t.test("a leaf package cannot inherit the workspace README", async () => {
    const value = clonePlan();
    const documentation = packageById(value, "core").files
      .find((entry) => entry.role === "documentation");
    documentation.sourceRoot = ".";
    assert.equal((await findingCodes(value)).has("package-readme-source"), true);
  });

  await t.test("repository binding fields cannot drift independently", async (repositoryTest) => {
    for (const [label, key, value] of [
      ["provider", "provider", "example"],
      ["repository id", "repositoryId", "1330979134"],
      ["owner", "owner", "someone-else"],
      ["name", "name", "not-pptx-compiler"],
      ["HTML URL", "htmlUrl", "https://example.invalid/why7682/pptx-compiler"]
    ]) {
      await repositoryTest.test(label, async () => {
        const valuePlan = clonePlan();
        valuePlan.repository[key] = value;
        assert.equal(
          (await findingCodes(valuePlan)).has("package-repository-binding"),
          true
        );
      });
    }
  });

  await t.test("the recorded decision is the only npm authorization", async () => {
    const value = clonePlan();
    value.releaseGuard.decisionId = "D-999";
    assert.equal((await findingCodes(value)).has("package-release-guard"), true);
  });

  await t.test("publication facts cannot drift", async (publicationTest) => {
    for (const [label, key, changed] of [
      ["registry", "registry", "https://example.invalid/"],
      ["tag", "tag", "latest"],
      ["access", "access", "restricted"],
      ["provenance", "provenance", false]
    ]) {
      await publicationTest.test(label, async () => {
        const value = clonePlan();
        value.publication[key] = changed;
        assert.equal((await findingCodes(value)).has("package-publication"), true);
      });
    }
  });

  await t.test("repository directories cannot be reassigned between packages", async () => {
    const value = clonePlan();
    const cli = packageById(value, "cli");
    const core = packageById(value, "core");
    [cli.repositoryDirectory, core.repositoryDirectory] = [
      core.repositoryDirectory,
      cli.repositoryDirectory
    ];
    assert.equal((await findingCodes(value)).has("package-profile"), true);
  });

  await t.test("scoped name drift", async () => {
    const value = clonePlan();
    packageById(value, "core").name = "@example/pptx-compiler-core";
    assert.equal((await findingCodes(value)).has("package-name"), true);
  });

  await t.test("removing the CLI bin violates the fixed package profile", async () => {
    const value = clonePlan();
    const cli = packageById(value, "cli");
    cli.bin = {};
    cli.files = cli.files.filter((entry) => entry.role !== "bin");
    const codes = await findingCodes(value);
    assert.equal(codes.has("package-profile"), true);
    assert.equal(codes.has("package-required-target"), true);
  });

  await t.test("removing package-owned assets violates the fixed package profile", async () => {
    const value = clonePlan();
    for (const item of value.packages) {
      item.files = item.files.filter((entry) =>
        !["fixture", "policy", "schema"].includes(entry.role));
    }
    assert.equal((await findingCodes(value)).has("package-required-target"), true);
  });

  await t.test("a synchronized package rename still violates the fixed profile", async () => {
    const value = clonePlan();
    packageById(value, "core").name = "renamed-pptx-compiler-core";
    value.namePolicy.names = value.namePolicy.names.map((name) =>
      name === "pptx-compiler-core" ? "renamed-pptx-compiler-core" : name).sort();
    for (const item of value.packages) {
      for (const key of Object.keys(item.imports)) {
        item.imports[key] = item.imports[key].replace(
          "pptx-compiler-core",
          "renamed-pptx-compiler-core"
        );
      }
    }
    assert.equal((await findingCodes(value)).has("package-profile"), true);
  });

  await t.test("an unused extra dependency violates the fixed graph", async () => {
    const value = clonePlan();
    const plugin = packageById(value, "native-card-arrow");
    plugin.dependencies.push({
      packageId: "public-synthetic",
      version: value.packageVersion
    });
    plugin.dependencies.sort((left, right) => left.packageId.localeCompare(right.packageId));
    assert.equal((await findingCodes(value)).has("package-profile"), true);
  });

  await t.test("malformed package shape returns findings instead of throwing", async () => {
    const missingPackage = clonePlan();
    missingPackage.packages[0] = null;
    assert.equal((await findingCodes(missingPackage)).has("package-shape"), true);

    const malformedDependency = clonePlan();
    packageById(malformedDependency, "cli").dependencies[0] = null;
    assert.equal(
      (await findingCodes(malformedDependency)).has("package-dependencies"),
      true
    );
  });
});
