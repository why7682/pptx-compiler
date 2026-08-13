import { lstat, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { builtinModules } from "node:module";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

export const ALPHA_PACKAGE_PLAN_VERSION = 4;
export const ALPHA_PACKAGE_PLAN_PATH = "packaging/alpha-package-plan.json";
export const ALPHA_REPOSITORY = Object.freeze({
  provider: "github",
  repositoryId: "1330979133",
  owner: "why7682",
  name: "pptx-compiler",
  htmlUrl: "https://github.com/why7682/pptx-compiler"
});
export const ALPHA_RELEASE_GUARD = Object.freeze({
  state: "authorized",
  decisionId: "D-050"
});
export const ALPHA_PUBLICATION = Object.freeze({
  registry: "https://registry.npmjs.org/",
  tag: "alpha",
  access: "public",
  provenance: true
});

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const MAX_PACKAGE_FILE_BYTES = 1024 * 1024;
const MAX_PACKAGE_FILES = 300;
const TOP_KEYS = Object.freeze([
  "schemaVersion",
  "planId",
  "packageVersion",
  "license",
  "moduleType",
  "engines",
  "stagingRoot",
  "namePolicy",
  "repository",
  "releaseGuard",
  "publication",
  "packages"
]);
const PACKAGE_KEYS = Object.freeze([
  "packageId",
  "name",
  "description",
  "repositoryDirectory",
  "dependencies",
  "exports",
  "imports",
  "types",
  "bin",
  "files"
]);
const FILE_SET_KEYS = Object.freeze(["sourceRoot", "targetRoot", "role", "paths"]);
const DEPENDENCY_KEYS = Object.freeze(["packageId", "version"]);
const EXPORT_KEYS = Object.freeze(["types", "import"]);
const FILE_ROLES = new Set([
  "bin",
  "documentation",
  "fixture",
  "notice",
  "policy",
  "runtime",
  "schema",
  "types"
]);
const FORBIDDEN_SOURCE = /(?:^|\/)(?:labs|tests|packages\/adapter-pandoc-omml|packages\/powerpoint-macos|plugins\/clone-fill)(?:\/|$)|(?:^|\/)(?:native-omml-formula-assembly|native-presentation-publication|ordered-slide-assembly|receipt-bound-final-delivery)[.]mjs$/u;
const PACKAGE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const PACKAGE_NAME = /^[a-z0-9][a-z0-9._-]*$/u;
const IMPORT_SPECIFIER = /^#pptx-compiler\/[a-z][a-z0-9-]*$/u;
const NODE_BUILTINS = new Set(builtinModules.map((name) =>
  name.startsWith("node:") ? name : `node:${name}`));
const MODULE_DEPENDENCY_PARSER = `import { readFileSync } from "node:fs";
import { SourceTextModule } from "node:vm";
const module = new SourceTextModule(readFileSync(0, "utf8"));
process.stdout.write(JSON.stringify(module.dependencySpecifiers));
`;
const moduleDependencyCache = new Map();
const PACKAGE_PROFILES = Object.freeze({
  cli: Object.freeze({
    name: "pptx-compiler",
    description: "Candidate-alpha CLI for deterministic template-grounded PPTX assembly and honest blocked QA.",
    repositoryDirectory: "packages/cli",
    dependencyIds: Object.freeze(["core", "native-card-arrow", "public-synthetic"]),
    exports: Object.freeze({
      ".": Object.freeze({
        types: "./types/index.d.ts",
        import: "./src/index.mjs"
      })
    }),
    imports: Object.freeze({
      "#pptx-compiler/core": "pptx-compiler-core",
      "#pptx-compiler/core-assets": "pptx-compiler-core/package-assets",
      "#pptx-compiler/extension-api": "pptx-compiler-core/extension-api",
      "#pptx-compiler/native-card-arrow": "pptx-compiler-native-card-arrow",
      "#pptx-compiler/native-card-arrow-assets":
        "pptx-compiler-native-card-arrow/package-assets",
      "#pptx-compiler/public-synthetic": "pptx-compiler-public-synthetic",
      "#pptx-compiler/public-synthetic-assets":
        "pptx-compiler-public-synthetic/package-assets"
    }),
    types: "./types/index.d.ts",
    bin: Object.freeze({ "pptx-compiler": "pptx-compiler.mjs" }),
    requiredTargets: Object.freeze(["pptx-compiler.mjs"])
  }),
  core: Object.freeze({
    name: "pptx-compiler-core",
    description: "Dependency-free candidate-alpha runtime, contracts, support policy, and secure PPTX primitives.",
    repositoryDirectory: "packages/core",
    dependencyIds: Object.freeze([]),
    exports: Object.freeze({
      ".": Object.freeze({
        types: "./types/candidate-alpha.d.ts",
        import: "./src/candidate-alpha.mjs"
      }),
      "./extension-api": Object.freeze({
        types: "./types/extension-api.d.ts",
        import: "./src/extension-api.mjs"
      }),
      "./package-assets": Object.freeze({
        types: "./types/package-assets.d.ts",
        import: "./src/package-assets.mjs"
      })
    }),
    imports: Object.freeze({}),
    types: "./types/candidate-alpha.d.ts",
    bin: Object.freeze({}),
    requiredTargets: Object.freeze([
      "assets/fixtures/contracts/valid/build-artifact.json",
      "assets/fixtures/contracts/valid/candidate-build-record.json",
      "assets/fixtures/contracts/valid/capability-registry.json",
      "assets/fixtures/contracts/valid/deck-spec.json",
      "assets/fixtures/contracts/valid/project-config.json",
      "assets/fixtures/contracts/valid/project-overlay.json",
      "assets/fixtures/contracts/valid/qa-report.json",
      "assets/fixtures/contracts/valid/template-index.json",
      "assets/fixtures/contracts/valid/template-profile.json",
      "assets/policy/support-matrix.json",
      "assets/schemas/contracts/build-artifact.schema.json",
      "assets/schemas/contracts/candidate-build-record.schema.json",
      "assets/schemas/contracts/capability-registry.schema.json",
      "assets/schemas/contracts/deck-spec.schema.json",
      "assets/schemas/contracts/manifest.json",
      "assets/schemas/contracts/project-config.schema.json",
      "assets/schemas/contracts/project-overlay.schema.json",
      "assets/schemas/contracts/qa-report.schema.json",
      "assets/schemas/contracts/shared.schema.json",
      "assets/schemas/contracts/template-index.schema.json",
      "assets/schemas/contracts/template-profile.schema.json",
      "assets/schemas/support-matrix.schema.json",
      "types/contracts.d.ts"
    ])
  }),
  "native-card-arrow": Object.freeze({
    name: "pptx-compiler-native-card-arrow",
    description: "Exact native DrawingML card-arrow capability for PPTX Compiler candidate alpha.",
    repositoryDirectory: "plugins/native-card-arrow",
    dependencyIds: Object.freeze(["core"]),
    exports: Object.freeze({
      ".": Object.freeze({
        types: "./types/index.d.ts",
        import: "./src/index.mjs"
      }),
      "./package-assets": Object.freeze({
        types: "./types/package-assets.d.ts",
        import: "./src/package-assets.mjs"
      })
    }),
    imports: Object.freeze({
      "#pptx-compiler/extension-api": "pptx-compiler-core/extension-api"
    }),
    types: "./types/index.d.ts",
    bin: Object.freeze({}),
    requiredTargets: Object.freeze([
      "assets/fixtures/cases.json",
      "assets/schemas/input.schema.json",
      "assets/schemas/output.schema.json"
    ])
  }),
  "public-synthetic": Object.freeze({
    name: "pptx-compiler-public-synthetic",
    description: "Repository-owned synthetic template and project preset for public PPTX Compiler conformance.",
    repositoryDirectory: "packages/public-synthetic",
    dependencyIds: Object.freeze([]),
    exports: Object.freeze({
      ".": Object.freeze({
        types: "./types/index.d.ts",
        import: "./src/index.mjs"
      }),
      "./package-assets": Object.freeze({
        types: "./types/package-assets.d.ts",
        import: "./src/package-assets.mjs"
      })
    }),
    imports: Object.freeze({}),
    types: "./types/index.d.ts",
    bin: Object.freeze({}),
    requiredTargets: Object.freeze([
      "assets/fixtures/inspection/expected-potx-template-index.json",
      "assets/fixtures/source-parts/minimal/fixture.json",
      "assets/fixtures/source-parts/minimal/parts/[Content_Types].xml",
      "assets/fixtures/source-parts/minimal/parts/_rels/.rels",
      "assets/fixtures/source-parts/minimal/parts/ppt/_rels/presentation.xml.rels",
      "assets/fixtures/source-parts/minimal/parts/ppt/presProps.xml",
      "assets/fixtures/source-parts/minimal/parts/ppt/presentation.xml",
      "assets/fixtures/source-parts/minimal/parts/ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      "assets/fixtures/source-parts/minimal/parts/ppt/slideLayouts/slideLayout1.xml",
      "assets/fixtures/source-parts/minimal/parts/ppt/slideMasters/_rels/slideMaster1.xml.rels",
      "assets/fixtures/source-parts/minimal/parts/ppt/slideMasters/slideMaster1.xml",
      "assets/fixtures/source-parts/minimal/parts/ppt/slides/_rels/slide1.xml.rels",
      "assets/fixtures/source-parts/minimal/parts/ppt/slides/slide1.xml",
      "assets/fixtures/source-parts/minimal/parts/ppt/theme/theme1.xml"
    ])
  })
});

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactRecord(value, keys) {
  if (!isPlainRecord(value)) return false;
  const expected = new Set(keys);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !expected.has(key))) {
    return false;
  }
  return ownKeys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
  });
}

function add(findings, code, pointer) {
  findings.push(Object.freeze({ code, pointer }));
}

function canonicalRelative(value, { allowDot = false } = {}) {
  if (allowDot && value === ".") return true;
  if (typeof value !== "string" || value.length === 0 || value.length > 512 ||
      value.includes("\\") || path.posix.isAbsolute(value) ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    return false;
  }
  const segments = value.split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..") &&
    path.posix.normalize(value) === value;
}

function joinRelative(root, child) {
  return root === "." ? child : `${root}/${child}`;
}

function sortedUnique(values) {
  return values.length === new Set(values).size &&
    values.every((value, index) => index === 0 || values[index - 1] < value);
}

function parseStaticModuleSpecifiers(source) {
  if (moduleDependencyCache.has(source)) return moduleDependencyCache.get(source);
  const parsed = spawnSync(process.execPath, [
    "--no-warnings",
    "--experimental-vm-modules",
    "--input-type=module",
    "--eval",
    MODULE_DEPENDENCY_PARSER
  ], {
    input: source,
    encoding: "utf8",
    env: {},
    windowsHide: true,
    timeout: 10_000,
    maxBuffer: MAX_PACKAGE_FILE_BYTES
  });
  let specifiers = null;
  if (parsed.error === undefined && parsed.signal === null && parsed.status === 0 &&
      parsed.stderr === "") {
    try {
      const value = JSON.parse(parsed.stdout);
      if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
        specifiers = Object.freeze([...new Set(value)].sort());
      }
    } catch {
      specifiers = null;
    }
  }
  if (moduleDependencyCache.size < 1024) moduleDependencyCache.set(source, specifiers);
  return specifiers;
}

function identifierCharacter(value) {
  return typeof value === "string" && /^[A-Za-z0-9_$]$/u.test(value);
}

function skipJavaScriptTrivia(source, start) {
  let offset = start;
  while (offset < source.length) {
    if (/\s/u.test(source[offset])) {
      offset += 1;
      continue;
    }
    if (source.startsWith("/*", offset)) {
      const end = source.indexOf("*/", offset + 2);
      if (end === -1) return source.length;
      offset = end + 2;
      continue;
    }
    if (source.startsWith("//", offset)) {
      let end = offset + 2;
      while (end < source.length &&
          source[end] !== "\n" && source[end] !== "\r" &&
          source[end] !== "\u2028" && source[end] !== "\u2029") {
        end += 1;
      }
      if (end === source.length) return source.length;
      offset = end + 1;
      continue;
    }
    break;
  }
  return offset;
}

function hasTriviaSeparatedCall(source, identifier) {
  let offset = 0;
  while (offset < source.length) {
    const found = source.indexOf(identifier, offset);
    if (found === -1) return false;
    const before = found === 0 ? "" : source[found - 1];
    const after = source[found + identifier.length] ?? "";
    if (!identifierCharacter(before) && !identifierCharacter(after) &&
        source[skipJavaScriptTrivia(source, found + identifier.length)] === "(") {
      return true;
    }
    offset = found + identifier.length;
  }
  return false;
}

function hazardScanSource(source) {
  return source
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/gu, (match, digits) => {
      const value = Number.parseInt(digits, 16);
      return value <= 0x10ffff ? String.fromCodePoint(value) : match;
    })
    .replace(/\\u([0-9a-fA-F]{4})/gu, (match, digits) =>
      String.fromCodePoint(Number.parseInt(digits, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/gu, (match, digits) =>
      String.fromCodePoint(Number.parseInt(digits, 16)));
}

export function analyzePackageModuleSource(source) {
  if (typeof source !== "string") {
    return Object.freeze({
      specifiers: Object.freeze([]),
      invalidNodeSpecifiers: Object.freeze([]),
      hasDynamicImport: true,
      hasCommonJsLoader: true,
      hasRuntimeCodeGeneration: true,
      moduleParseFailed: true
    });
  }
  if (Buffer.byteLength(source) > MAX_PACKAGE_FILE_BYTES) {
    return analyzePackageModuleSource(null);
  }
  const dynamicCount = [...source.matchAll(/\bimport\s*\(/gu)].length;
  const literalDynamicCount = [...source.matchAll(
    /\bimport\s*\(\s*["'][^"']+["']\s*\)/gu
  )].length;
  const parsedSpecifiers = parseStaticModuleSpecifiers(source);
  const specifiers = parsedSpecifiers ?? [];
  const hazardSource = hazardScanSource(source);
  return Object.freeze({
    specifiers: Object.freeze(specifiers),
    invalidNodeSpecifiers: Object.freeze(specifiers.filter((specifier) =>
      specifier.startsWith("node:") && !NODE_BUILTINS.has(specifier))),
    hasDynamicImport: dynamicCount !== 0 || literalDynamicCount !== 0 ||
      hasTriviaSeparatedCall(source, "import"),
    hasCommonJsLoader: /\bcreateRequire\b/u.test(hazardSource) ||
      hasTriviaSeparatedCall(hazardSource, "require") ||
      /\bgetBuiltinModule\b/u.test(hazardSource) ||
      specifiers.includes("node:module"),
    hasRuntimeCodeGeneration: /\b(?:eval|Function)\b/u.test(hazardSource),
    moduleParseFailed: parsedSpecifiers === null
  });
}

function dependencyTarget(value, packagesByName) {
  for (const candidate of [...packagesByName.keys()].sort((left, right) => right.length - left.length)) {
    if (value === candidate) return { packageName: candidate, subpath: "." };
    if (value.startsWith(`${candidate}/`)) {
      return { packageName: candidate, subpath: `./${value.slice(candidate.length + 1)}` };
    }
  }
  return null;
}

function validateDependencyGraph(packages, packagesById, findings) {
  const visiting = new Set();
  const visited = new Set();
  function visit(packageId) {
    if (visited.has(packageId)) return;
    if (visiting.has(packageId)) {
      add(findings, "package-dependency-cycle", `/packages/${packageId}/dependencies`);
      return;
    }
    visiting.add(packageId);
    const item = packagesById.get(packageId);
    for (const dependency of item?.dependencies ?? []) visit(dependency.packageId);
    visiting.delete(packageId);
    visited.add(packageId);
  }
  for (const item of packages) visit(item.packageId);
}

export function flattenPackageFiles(item) {
  const output = [];
  for (const fileSet of item.files) {
    for (const relativePath of fileSet.paths) {
      output.push(Object.freeze({
        source: joinRelative(fileSet.sourceRoot, relativePath),
        target: joinRelative(fileSet.targetRoot, relativePath),
        role: fileSet.role
      }));
    }
  }
  return Object.freeze(output);
}

function sortedObject(value, project = (item) => item) {
  if (!isPlainRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [
    key,
    project(value[key])
  ]));
}

function canonicalPackagePlanValue(plan) {
  if (!isPlainRecord(plan)) return plan;
  return {
    schemaVersion: plan.schemaVersion,
    planId: plan.planId,
    packageVersion: plan.packageVersion,
    license: plan.license,
    moduleType: plan.moduleType,
    engines: isPlainRecord(plan.engines) ? { node: plan.engines.node } : plan.engines,
    stagingRoot: plan.stagingRoot,
    namePolicy: isPlainRecord(plan.namePolicy) ? {
      style: plan.namePolicy.style,
      registry: plan.namePolicy.registry,
      checkedOn: plan.namePolicy.checkedOn,
      result: plan.namePolicy.result,
      names: plan.namePolicy.names
    } : plan.namePolicy,
    repository: isPlainRecord(plan.repository) ? {
      provider: plan.repository.provider,
      repositoryId: plan.repository.repositoryId,
      owner: plan.repository.owner,
      name: plan.repository.name,
      htmlUrl: plan.repository.htmlUrl
    } : plan.repository,
    releaseGuard: isPlainRecord(plan.releaseGuard) ? {
      state: plan.releaseGuard.state,
      decisionId: plan.releaseGuard.decisionId
    } : plan.releaseGuard,
    publication: isPlainRecord(plan.publication) ? {
      registry: plan.publication.registry,
      tag: plan.publication.tag,
      access: plan.publication.access,
      provenance: plan.publication.provenance
    } : plan.publication,
    packages: Array.isArray(plan.packages) ? plan.packages.map((item) => {
      if (!isPlainRecord(item)) return item;
      return {
        packageId: item.packageId,
        name: item.name,
        description: item.description,
        repositoryDirectory: item.repositoryDirectory,
        dependencies: Array.isArray(item.dependencies)
          ? item.dependencies.map((dependency) => isPlainRecord(dependency) ? {
            packageId: dependency.packageId,
            version: dependency.version
          } : dependency)
          : item.dependencies,
        exports: sortedObject(item.exports, (target) => isPlainRecord(target) ? {
          types: target.types,
          import: target.import
        } : target),
        imports: sortedObject(item.imports),
        types: item.types,
        bin: sortedObject(item.bin),
        files: Array.isArray(item.files) ? item.files.map((fileSet) =>
          isPlainRecord(fileSet) ? {
            sourceRoot: fileSet.sourceRoot,
            targetRoot: fileSet.targetRoot,
            role: fileSet.role,
            paths: fileSet.paths
          } : fileSet) : item.files
      };
    }) : plan.packages
  };
}

export function canonicalAlphaPackagePlanText(plan) {
  return `${JSON.stringify(canonicalPackagePlanValue(plan), null, 2)}\n`;
}

export function parseAlphaPackagePlanBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > MAX_PACKAGE_FILE_BYTES) {
    throw new Error("alpha-package-plan-bytes");
  }
  let text;
  let plan;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    plan = JSON.parse(text);
  } catch {
    throw new Error("alpha-package-plan-json");
  }
  if (text !== canonicalAlphaPackagePlanText(plan)) {
    throw new Error("alpha-package-plan-canonical");
  }
  return plan;
}

export async function loadAlphaPackagePlan({ root = repositoryRoot } = {}) {
  return parseAlphaPackagePlanBytes(
    await readFile(path.join(root, ALPHA_PACKAGE_PLAN_PATH))
  );
}

export async function validateAlphaPackagePlan(plan, {
  root = repositoryRoot,
  sourceSnapshots,
  ignoreBytes
} = {}) {
  const findings = [];
  const usesSnapshots = sourceSnapshots !== undefined || ignoreBytes !== undefined;
  if (usesSnapshots && (!(sourceSnapshots instanceof Map) || !Buffer.isBuffer(ignoreBytes))) {
    return Object.freeze([Object.freeze({
      code: "package-plan-snapshot",
      pointer: ""
    })]);
  }
  if (!exactRecord(plan, TOP_KEYS)) {
    return Object.freeze([Object.freeze({ code: "package-plan-shape", pointer: "" })]);
  }
  if (plan.schemaVersion !== ALPHA_PACKAGE_PLAN_VERSION ||
      plan.planId !== "pptx-pipeline-alpha-package-plan" ||
      plan.packageVersion !== "0.1.0-alpha.3" || plan.license !== "MIT" ||
      plan.moduleType !== "module" || plan.stagingRoot !== ".package-stage") {
    add(findings, "package-plan-identity", "/");
  }
  if (!exactRecord(plan.engines, ["node"]) ||
      plan.engines.node !== "^22.0.0 || ^24.0.0") {
    add(findings, "package-plan-runtime", "/engines/node");
  }
  if (!exactRecord(plan.namePolicy, ["style", "registry", "checkedOn", "result", "names"]) ||
      plan.namePolicy.style !== "unscoped" ||
      plan.namePolicy.registry !== "https://registry.npmjs.org" ||
      !/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/u.test(plan.namePolicy.checkedOn) ||
      plan.namePolicy.checkedOn !== "2026-08-14" ||
      plan.namePolicy.result !== "core-present-three-names-e404" ||
      !Array.isArray(plan.namePolicy.names) || !sortedUnique(plan.namePolicy.names)) {
    add(findings, "package-name-policy", "/namePolicy");
  }
  if (!exactRecord(plan.repository, [
    "provider",
    "repositoryId",
    "owner",
    "name",
    "htmlUrl"
  ]) || !isDeepStrictEqual(plan.repository, ALPHA_REPOSITORY)) {
    add(findings, "package-repository-binding", "/repository");
  }
  if (!exactRecord(plan.releaseGuard, ["state", "decisionId"]) ||
      !isDeepStrictEqual(plan.releaseGuard, ALPHA_RELEASE_GUARD)) {
    add(findings, "package-release-guard", "/releaseGuard");
  }
  if (!exactRecord(plan.publication, ["registry", "tag", "access", "provenance"]) ||
      !isDeepStrictEqual(plan.publication, ALPHA_PUBLICATION)) {
    add(findings, "package-publication", "/publication");
  }
  if (!Array.isArray(plan.packages) || plan.packages.length !== 4) {
    add(findings, "package-set", "/packages");
    return Object.freeze(findings);
  }

  const packagesById = new Map();
  const packagesByName = new Map();
  let packageStructuresValid = true;
  for (let index = 0; index < plan.packages.length; index += 1) {
    const item = plan.packages[index];
    const pointer = `/packages/${index}`;
    if (!exactRecord(item, PACKAGE_KEYS)) {
      add(findings, "package-shape", pointer);
      packageStructuresValid = false;
      continue;
    }
    if (typeof item.packageId !== "string" || !PACKAGE_ID.test(item.packageId) ||
        packagesById.has(item.packageId)) {
      add(findings, "package-id", `${pointer}/packageId`);
    } else {
      packagesById.set(item.packageId, item);
    }
    if (typeof item.name !== "string" || !PACKAGE_NAME.test(item.name) ||
        item.name.includes("/") || packagesByName.has(item.name)) {
      add(findings, "package-name", `${pointer}/name`);
    } else {
      packagesByName.set(item.name, item);
    }
    if (typeof item.description !== "string" || item.description.length < 20 ||
        item.description.length > 180) {
      add(findings, "package-description", `${pointer}/description`);
    }
    if (!canonicalRelative(item.repositoryDirectory)) {
      add(findings, "package-repository-directory", `${pointer}/repositoryDirectory`);
    }
    if (!Array.isArray(item.dependencies) ||
        !item.dependencies.every((entry) => exactRecord(entry, DEPENDENCY_KEYS))) {
      add(findings, "package-dependencies", `${pointer}/dependencies`);
      packageStructuresValid = false;
    } else {
      const ids = item.dependencies.map((entry) => entry.packageId);
      if (!sortedUnique(ids)) add(findings, "package-dependency-order", `${pointer}/dependencies`);
      for (let dependencyIndex = 0; dependencyIndex < item.dependencies.length; dependencyIndex += 1) {
        const dependency = item.dependencies[dependencyIndex];
        if (dependency.packageId === item.packageId ||
            dependency.version !== plan.packageVersion) {
          add(findings, "package-dependency", `${pointer}/dependencies/${dependencyIndex}`);
        }
      }
    }
    if (!isPlainRecord(item.exports) || Object.keys(item.exports).length === 0) {
      add(findings, "package-exports", `${pointer}/exports`);
      packageStructuresValid = false;
    }
    if (!isPlainRecord(item.imports)) {
      add(findings, "package-imports", `${pointer}/imports`);
      packageStructuresValid = false;
    }
    if (typeof item.types !== "string" || !item.types.startsWith("./")) {
      add(findings, "package-types", `${pointer}/types`);
    }
    if (!isPlainRecord(item.bin)) {
      add(findings, "package-bin", `${pointer}/bin`);
      packageStructuresValid = false;
    }
    if (!Array.isArray(item.files) || item.files.length === 0) {
      add(findings, "package-files", `${pointer}/files`);
      packageStructuresValid = false;
    }
  }

  if (!packageStructuresValid) return Object.freeze(findings);

  const packageIds = plan.packages.map((item) => item?.packageId);
  const expectedPackageIds = Object.keys(PACKAGE_PROFILES).sort();
  if (!sortedUnique(packageIds) || !isDeepStrictEqual(packageIds, expectedPackageIds)) {
    add(findings, "package-profile-set", "/packages");
  }
  const plannedNames = [...packagesByName.keys()].sort();
  const policyNames = isPlainRecord(plan.namePolicy) && Array.isArray(plan.namePolicy.names)
    ? plan.namePolicy.names
    : [];
  if (plannedNames.length !== policyNames.length ||
      plannedNames.some((name, index) => name !== policyNames[index])) {
    add(findings, "package-name-set", "/namePolicy/names");
  }
  for (const item of plan.packages) {
    for (let index = 0; index < (item.dependencies ?? []).length; index += 1) {
      if (!packagesById.has(item.dependencies[index].packageId)) {
        add(findings, "package-dependency-missing", `/packages/${item.packageId}/dependencies/${index}`);
      }
    }
  }
  validateDependencyGraph(plan.packages, packagesById, findings);

  for (const item of plan.packages) {
    const profile = PACKAGE_PROFILES[item.packageId];
    if (profile === undefined) continue;
    if (item.name !== profile.name ||
        item.description !== profile.description ||
        item.repositoryDirectory !== profile.repositoryDirectory ||
        !isDeepStrictEqual(
          item.dependencies.map((dependency) => dependency.packageId),
          profile.dependencyIds
        ) ||
        !isDeepStrictEqual(item.exports, profile.exports) ||
        !isDeepStrictEqual(item.imports, profile.imports) ||
        item.types !== profile.types ||
        !isDeepStrictEqual(item.bin, profile.bin)) {
      add(findings, "package-profile", `/packages/${item.packageId}`);
    }
  }

  const runtimeSources = new Map();
  const packageFiles = new Map();
  for (const item of plan.packages) {
    if (!exactRecord(item, PACKAGE_KEYS) || !Array.isArray(item.files)) continue;
    const flattened = [];
    const targets = new Set();
    for (let setIndex = 0; setIndex < item.files.length; setIndex += 1) {
      const fileSet = item.files[setIndex];
      const pointer = `/packages/${item.packageId}/files/${setIndex}`;
      if (!exactRecord(fileSet, FILE_SET_KEYS) ||
          !canonicalRelative(fileSet.sourceRoot, { allowDot: true }) ||
          !canonicalRelative(fileSet.targetRoot, { allowDot: true }) ||
          !FILE_ROLES.has(fileSet.role) || !Array.isArray(fileSet.paths) ||
          fileSet.paths.length === 0 || !sortedUnique(fileSet.paths) ||
          fileSet.paths.some((entry) => !canonicalRelative(entry))) {
        add(findings, "package-file-set", pointer);
        continue;
      }
      for (const relativePath of fileSet.paths) {
        const source = joinRelative(fileSet.sourceRoot, relativePath);
        const target = joinRelative(fileSet.targetRoot, relativePath);
        if (FORBIDDEN_SOURCE.test(source)) add(findings, "package-forbidden-source", `${pointer}/paths`);
        if (["runtime", "bin"].includes(fileSet.role) !== source.endsWith(".mjs")) {
          add(findings, "package-executable-module-role", `${pointer}/paths`);
        }
        const foldedTarget = target.toLocaleLowerCase("en-US");
        if (targets.has(foldedTarget)) add(findings, "package-target-alias", `${pointer}/paths`);
        targets.add(foldedTarget);
        const entry = { source, target, role: fileSet.role };
        flattened.push(entry);
        if (source.endsWith(".mjs")) {
          const owners = runtimeSources.get(source) ?? [];
          owners.push(item.packageId);
          runtimeSources.set(source, owners);
        }
        if (usesSnapshots) {
          const snapshot = sourceSnapshots.get(source);
          if (!isPlainRecord(snapshot) || !Buffer.isBuffer(snapshot.bytes) ||
              !Number.isSafeInteger(snapshot.mode) || snapshot.bytes.length < 1 ||
              snapshot.bytes.length > MAX_PACKAGE_FILE_BYTES) {
            add(findings, "package-source-file", `${pointer}/paths`);
          }
        } else {
          try {
            const metadata = await lstat(path.join(root, ...source.split("/")));
            if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 1 ||
                metadata.size > MAX_PACKAGE_FILE_BYTES) {
              add(findings, "package-source-file", `${pointer}/paths`);
            }
          } catch {
            add(findings, "package-source-missing", `${pointer}/paths`);
          }
        }
      }
    }
    if (flattened.length + 1 > MAX_PACKAGE_FILES) {
      add(findings, "package-file-count", `/packages/${item.packageId}/files`);
    }
    packageFiles.set(item.packageId, flattened);
    const profile = PACKAGE_PROFILES[item.packageId];
    const targetSet = new Set(flattened.map((entry) => entry.target));
    const packageTargets = new Map(flattened.map((entry) => [entry.target, entry]));
    if (profile !== undefined &&
        profile.requiredTargets.some((target) => !targetSet.has(target))) {
      add(findings, "package-required-target", `/packages/${item.packageId}/files`);
    }
    const mappedTargets = new Map(flattened.map((entry) => [`./${entry.target}`, entry]));
    if (!mappedTargets.has(item.types) || mappedTargets.get(item.types).role !== "types") {
      add(findings, "package-types-unmapped", `/packages/${item.packageId}/types`);
    }
    for (const [subpath, target] of Object.entries(item.exports ?? {})) {
      if ((subpath !== "." && !/^\.[/][a-z][a-z0-9-]*$/u.test(subpath)) ||
          !exactRecord(target, EXPORT_KEYS) ||
          !mappedTargets.has(target.import) || mappedTargets.get(target.import).role !== "runtime" ||
          !mappedTargets.has(target.types) || mappedTargets.get(target.types).role !== "types") {
        add(findings, "package-export-target", `/packages/${item.packageId}/exports/${subpath}`);
      }
    }
    for (const [name, target] of Object.entries(item.bin ?? {})) {
      if (name !== "pptx-compiler" || !canonicalRelative(target) ||
          !packageTargets.has(target) || packageTargets.get(target).role !== "bin") {
        add(findings, "package-bin-target", `/packages/${item.packageId}/bin/${name}`);
      }
    }
    if (item.packageId !== "cli" && Object.keys(item.bin ?? {}).length !== 0) {
      add(findings, "package-bin-owner", `/packages/${item.packageId}/bin`);
    }
    const readme = mappedTargets.get("./README.md");
    if (!mappedTargets.has("./LICENSE") || readme === undefined) {
      add(findings, "package-notice-missing", `/packages/${item.packageId}/files`);
    } else if (readme.role !== "documentation" ||
        readme.source !== `${item.repositoryDirectory}/README.md`) {
      add(findings, "package-readme-source", `/packages/${item.packageId}/files`);
    }
  }

  for (const [source, owners] of runtimeSources) {
    if (owners.length !== 1) add(findings, "package-runtime-duplicate", `/sources/${source}`);
  }

  for (const item of plan.packages) {
    if (!isPlainRecord(item.imports)) continue;
    const dependencyIds = new Set((item.dependencies ?? []).map((entry) => entry.packageId));
    for (const [specifier, target] of Object.entries(item.imports)) {
      const resolved = typeof target === "string" ? dependencyTarget(target, packagesByName) : null;
      const targetItem = resolved ? packagesByName.get(resolved.packageName) : null;
      if (!IMPORT_SPECIFIER.test(specifier) || resolved === null || targetItem === undefined ||
          !dependencyIds.has(targetItem.packageId) ||
          !Object.hasOwn(targetItem.exports, resolved.subpath)) {
        add(findings, "package-import-map", `/packages/${item.packageId}/imports/${specifier}`);
      }
    }
  }

  for (const item of plan.packages) {
    const files = packageFiles.get(item.packageId) ?? [];
    const ownModuleTargets = new Set(files.filter((entry) => entry.source.endsWith(".mjs"))
      .map((entry) => entry.target));
    for (const entry of files.filter((candidate) => candidate.source.endsWith(".mjs"))) {
      let source;
      try {
        source = usesSnapshots
          ? new TextDecoder("utf-8", { fatal: true })
            .decode(sourceSnapshots.get(entry.source)?.bytes)
          : await readFile(path.join(root, ...entry.source.split("/")), "utf8");
      } catch {
        add(findings, "package-source-file", `/sources/${entry.source}`);
        continue;
      }
      const analysis = analyzePackageModuleSource(source);
      if (analysis.hasDynamicImport) {
        add(findings, "package-dynamic-import", `/sources/${entry.source}`);
      }
      if (analysis.hasCommonJsLoader) {
        add(findings, "package-commonjs-loader", `/sources/${entry.source}`);
      }
      if (analysis.hasRuntimeCodeGeneration) {
        add(findings, "package-code-generation", `/sources/${entry.source}`);
      }
      if (analysis.moduleParseFailed) {
        add(findings, "package-module-syntax", `/sources/${entry.source}`);
      }
      if (analysis.invalidNodeSpecifiers.length !== 0) {
        add(findings, "package-node-builtin", `/sources/${entry.source}`);
      }
      for (const specifier of analysis.specifiers) {
        if (specifier.startsWith("node:")) continue;
        if (specifier.startsWith("#")) {
          if (!Object.hasOwn(item.imports, specifier)) {
            add(findings, "package-import-undeclared", `/sources/${entry.source}`);
          }
          continue;
        }
        if (!specifier.startsWith(".")) {
          add(findings, "package-bare-import", `/sources/${entry.source}`);
          continue;
        }
        const resolvedTarget = path.posix.normalize(path.posix.join(
          path.posix.dirname(entry.target),
          specifier
        ));
        if (!ownModuleTargets.has(resolvedTarget)) {
          add(findings, "package-runtime-import-target", `/sources/${entry.source}`);
        }
      }
    }
  }

  try {
    const ignore = usesSnapshots
      ? new TextDecoder("utf-8", { fatal: true }).decode(ignoreBytes)
      : await readFile(path.join(root, ".gitignore"), "utf8");
    if (!ignore.split(/\r?\n/u).includes(`${plan.stagingRoot}/`)) {
      add(findings, "package-staging-not-ignored", "/stagingRoot");
    }
  } catch {
    add(findings, "package-staging-not-ignored", "/stagingRoot");
  }
  return Object.freeze(findings);
}

export function packagePlanRepositoryRoot() {
  return repositoryRoot;
}
