import { createAlphaPackageManifest } from "./package-tarball.mjs";
import {
  ALPHA_PUBLICATION,
  ALPHA_RELEASE_GUARD,
  ALPHA_REPOSITORY,
  flattenPackageFiles
} from "./package-plan.mjs";
import { EXPECTED_PUBLIC_SCRIPTS } from "./public-workflows.mjs";

export const ALPHA_SBOM_PATH = "sbom.alpha.cdx.json";
export const APPROVED_COPYRIGHT_HOLDER = "Elliot Wu";
export const TYPESCRIPT_TOOL_VERSION = "6.0.2";
export const TYPECHECK_CONFIG_PATH = "tsconfig.public.json";
export const TYPECHECK_CONSUMER_PATH = "tests/types/alpha-public-api.ts";
export const CANONICAL_ALPHA_TYPECHECK_CONSUMER = `import {
  executeCli,
  type CliExecutionOptions,
  type CliExecutionResult
} from "pptx-compiler";
import {
  assessNativeCardCandidate,
  createProjectContext,
  type ProjectConfig,
  writeAuthenticatedNativeCardCandidateBundle
} from "pptx-compiler-core";
import {
  createCapabilityRuntime,
  parseStrictXml,
  validateJson
} from "pptx-compiler-core/extension-api";
import { CORE_PACKAGE_ASSETS } from "pptx-compiler-core/package-assets";
import {
  createNativeCardArrowRegistration,
  executeNativeCardArrow,
  type NativeCardArrowInvocation
} from "pptx-compiler-native-card-arrow";
import { NATIVE_CARD_ARROW_PACKAGE_ASSETS } from
  "pptx-compiler-native-card-arrow/package-assets";
import {
  createInstalledPublicSyntheticProject,
  PUBLIC_SYNTHETIC_PRESET,
  type PublicSyntheticProjectResult
} from "pptx-compiler-public-synthetic";
import { PUBLIC_SYNTHETIC_PACKAGE_ASSETS } from
  "pptx-compiler-public-synthetic/package-assets";

declare const invocation: Readonly<NativeCardArrowInvocation>;
declare const projectConfig: Readonly<ProjectConfig>;

const cliOptions: CliExecutionOptions = { argv: ["--json", "inspect"] };
const cliResult: Promise<Readonly<CliExecutionResult>> = executeCli(cliOptions);
const projectContext = createProjectContext({
  projectRoot: "/synthetic-absolute-root",
  projectConfig,
  dependencies: { validateProjectConfig: () => true }
});
const componentPlan = executeNativeCardArrow(invocation);
const syntheticResult: Promise<Readonly<PublicSyntheticProjectResult>> =
  createInstalledPublicSyntheticProject({
    projectRoot: "/synthetic-absolute-root",
    preset: PUBLIC_SYNTHETIC_PRESET,
    dependencies: {
      validateCapabilityRegistry: () => true,
      validateDeckSpec: () => true,
      validateProjectConfig: () => true,
      validateProjectOverlay: () => true,
      validateTemplateProfile: () => true
    }
  });

void cliResult;
void projectContext;
void componentPlan;
void syntheticResult;
void assessNativeCardCandidate;
void writeAuthenticatedNativeCardCandidateBundle;
void createCapabilityRuntime;
void parseStrictXml;
void validateJson;
void createNativeCardArrowRegistration;
void CORE_PACKAGE_ASSETS;
void NATIVE_CARD_ARROW_PACKAGE_ASSETS;
void PUBLIC_SYNTHETIC_PACKAGE_ASSETS;
`;
export const TYPESCRIPT_TOOLCHAIN = Object.freeze({
  version: TYPESCRIPT_TOOL_VERSION,
  resolved: `https://registry.npmjs.org/typescript/-/typescript-${TYPESCRIPT_TOOL_VERSION}.tgz`,
  integrity: "sha512-bGdAIrZ0wiGDo5l8c++HWtbaNCWTS4UTv7RaTH/ThVIgjkveJt83m74bBHMJkuCbslY8ixgLBVZJIOiQlQTjfQ==",
  license: "Apache-2.0",
  bin: Object.freeze({ tsc: "bin/tsc", tsserver: "bin/tsserver" }),
  engines: Object.freeze({ node: ">=14.17" })
});

const CANONICAL_COPYRIGHT_LINE = [
  "Copyright",
  "(c)",
  "2026",
  APPROVED_COPYRIGHT_HOLDER
].join(" ");

export const CANONICAL_MIT_LICENSE = `MIT License

${CANONICAL_COPYRIGHT_LINE}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function finding(code, pointer) {
  return Object.freeze({ code, pointer });
}

function exactKeys(value, expected) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort(compareText).join("\0") ===
      [...expected].sort(compareText).join("\0");
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function publicSpecifier(packageName, subpath) {
  return subpath === "." ? packageName : `${packageName}/${subpath.slice(2)}`;
}

function createExpectedRootImports(plan) {
  const packages = new Map(plan.packages.map((item) => [item.name, item]));
  const cli = plan.packages.find((item) => item.packageId === "cli");
  if (cli === undefined) throw new Error("alpha-root-imports");
  const names = [...packages.keys()].sort((left, right) => right.length - left.length);
  const entries = [];
  for (const [alias, request] of Object.entries(cli.imports).sort(([left], [right]) =>
    compareText(left, right))) {
    const packageName = names.find((name) => request === name || request.startsWith(`${name}/`));
    if (packageName === undefined) throw new Error("alpha-root-imports");
    const item = packages.get(packageName);
    const subpath = request === packageName
      ? "."
      : `./${request.slice(packageName.length + 1)}`;
    const exported = item.exports[subpath];
    const mapped = flattenPackageFiles(item).find((entry) =>
      `./${entry.target}` === exported?.import);
    if (mapped === undefined || mapped.role !== "runtime") {
      throw new Error("alpha-root-imports");
    }
    entries.push([alias, `./${mapped.source}`]);
  }
  return Object.freeze(Object.fromEntries(entries));
}

function createExpectedRootPackage(plan) {
  return Object.freeze({
    name: "pptx-compiler-workspace",
    version: "0.0.0-private",
    private: true,
    license: "MIT",
    type: "module",
    engines: Object.freeze({ node: plan.engines.node }),
    devDependencies: Object.freeze({ typescript: TYPESCRIPT_TOOL_VERSION }),
    imports: createExpectedRootImports(plan),
    scripts: EXPECTED_PUBLIC_SCRIPTS
  });
}

function canonicalPackageLockValue(packageLock) {
  const root = packageLock?.packages?.[""];
  const compiler = packageLock?.packages?.["node_modules/typescript"];
  return {
    name: packageLock?.name,
    version: packageLock?.version,
    lockfileVersion: packageLock?.lockfileVersion,
    requires: packageLock?.requires,
    packages: {
      "": {
        name: root?.name,
        version: root?.version,
        license: root?.license,
        devDependencies: root?.devDependencies,
        engines: root?.engines
      },
      "node_modules/typescript": {
        version: compiler?.version,
        resolved: compiler?.resolved,
        integrity: compiler?.integrity,
        dev: compiler?.dev,
        license: compiler?.license,
        bin: compiler?.bin,
        engines: compiler?.engines
      }
    }
  };
}

function createTypecheckPaths(plan) {
  const entries = [];
  for (const item of plan.packages) {
    const files = flattenPackageFiles(item);
    const byTarget = new Map(files.map((entry) => [`./${entry.target}`, entry]));
    for (const [subpath, target] of Object.entries(item.exports)) {
      const mapped = byTarget.get(target.types);
      if (mapped === undefined || mapped.role !== "types") {
        throw new Error("alpha-typecheck-target");
      }
      entries.push([
        publicSpecifier(item.name, subpath),
        Object.freeze([`./${mapped.source}`])
      ]);
    }
  }
  entries.sort(([left], [right]) => compareText(left, right));
  if (new Set(entries.map(([specifier]) => specifier)).size !== entries.length) {
    throw new Error("alpha-typecheck-specifier");
  }
  return Object.freeze(Object.fromEntries(entries));
}

export function createExpectedTypecheckConfig(plan) {
  return Object.freeze({
    compilerOptions: Object.freeze({
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      noEmit: true,
      skipLibCheck: false,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      verbatimModuleSyntax: true,
      forceConsistentCasingInFileNames: true,
      rootDirs: Object.freeze(["packages/core/types", "types"]),
      paths: createTypecheckPaths(plan)
    }),
    include: Object.freeze([TYPECHECK_CONSUMER_PATH])
  });
}

function consumerSpecifiers(text) {
  if (typeof text !== "string" || text.length < 1 || text.charCodeAt(0) === 0xfeff ||
      text.includes("\0") || text.includes("\r") || /[\t ]+$/mu.test(text) ||
      !text.endsWith("\n")) {
    throw new Error("alpha-typecheck-consumer");
  }
  const specifiers = [];
  let remainder = text;
  while (remainder.startsWith("import ")) {
    const end = remainder.indexOf(";\n");
    if (end < 0) throw new Error("alpha-typecheck-consumer");
    const statement = remainder.slice(0, end + 2);
    const match = /^import[\s\S]+?\sfrom\s+"([^"\r\n]+)";\n$/u.exec(statement);
    if (match === null) throw new Error("alpha-typecheck-consumer");
    specifiers.push(match[1]);
    remainder = remainder.slice(end + 2);
  }
  if (/^\s*import\b/mu.test(remainder) || /\b(?:import|require)\s*\(/u.test(remainder)) {
    throw new Error("alpha-typecheck-consumer");
  }
  return specifiers;
}

export function validateTypecheckContract({ plan, config, configText, consumerText }) {
  try {
    const expectedConfig = createExpectedTypecheckConfig(plan);
    const expectedSpecifiers = Object.keys(expectedConfig.compilerOptions.paths)
      .sort(compareText);
    const actualSpecifiers = consumerSpecifiers(consumerText).sort(compareText);
    return consumerText === CANONICAL_ALPHA_TYPECHECK_CONSUMER &&
      configText === canonicalJson(config) && sameJson(config, expectedConfig) &&
      actualSpecifiers.length === expectedSpecifiers.length &&
      actualSpecifiers.every((value, index) => value === expectedSpecifiers[index]);
  } catch {
    return false;
  }
}

function packageRef(item, plan) {
  return `pkg:npm/${item.name}@${plan.packageVersion}`;
}

export function createAlphaCycloneDx(plan) {
  if (!sameJson(plan?.repository, ALPHA_REPOSITORY) ||
      !sameJson(plan?.releaseGuard, ALPHA_RELEASE_GUARD) ||
      !sameJson(plan?.publication, ALPHA_PUBLICATION)) {
    throw new Error("alpha-sbom-repository-binding");
  }
  const rootRef = `urn:pptx-compiler:alpha-package-set:${plan.packageVersion}`;
  const byId = new Map(plan.packages.map((item) => [item.packageId, item]));
  const repositoryReferences = Object.freeze([Object.freeze({
    type: "vcs",
    url: `${plan.repository.htmlUrl}.git`
  })]);
  const components = plan.packages.map((item) => Object.freeze({
    type: item.packageId === "cli" ? "application" : "library",
    "bom-ref": packageRef(item, plan),
    name: item.name,
    version: plan.packageVersion,
    licenses: Object.freeze([Object.freeze({ license: Object.freeze({ id: plan.license }) })]),
    purl: packageRef(item, plan),
    properties: Object.freeze([Object.freeze({
      name: "pptx-compiler:package-id",
      value: item.packageId
    })])
  })).sort((left, right) => compareText(left["bom-ref"], right["bom-ref"]));
  const dependencies = [
    Object.freeze({
      ref: rootRef,
      dependsOn: Object.freeze(components.map((item) => item["bom-ref"]).sort(compareText))
    }),
    ...plan.packages.map((item) => Object.freeze({
      ref: packageRef(item, plan),
      dependsOn: Object.freeze(item.dependencies.map(({ packageId }) => {
        const dependency = byId.get(packageId);
        if (dependency === undefined) throw new Error("alpha-sbom-dependency");
        return packageRef(dependency, plan);
      }).sort(compareText))
    })).sort((left, right) => compareText(left.ref, right.ref))
  ];
  return Object.freeze({
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: Object.freeze({
      component: Object.freeze({
        type: "application",
        "bom-ref": rootRef,
        name: "pptx-compiler-alpha-package-set",
        version: plan.packageVersion,
        licenses: Object.freeze([Object.freeze({ license: Object.freeze({ id: plan.license }) })]),
        externalReferences: repositoryReferences,
        properties: Object.freeze([Object.freeze({
          name: "pptx-compiler:repository-id",
          value: plan.repository.repositoryId
        })])
      })
    }),
    components: Object.freeze(components),
    dependencies: Object.freeze(dependencies)
  });
}

function licenseRecordMatches(record, source) {
  if (record === undefined || record.privateInformationReview?.status !== "passed" ||
      record.independentReview?.status === "pending") {
    return false;
  }
  const cleanup = record.projectConstantCleanup?.status;
  if (cleanup !== "passed" && !(source === "LICENSE" && cleanup === "not-applicable")) {
    return false;
  }
  return source === "LICENSE"
    ? record.license?.rightsBasis === "standard-mit-license-text"
    : record.license?.spdxExpression === "MIT";
}

export function validateAlphaReleaseMetadata({
  rootPackage,
  rootPackageText,
  packageLock,
  packageLockText,
  plan,
  packagePlanFindings,
  forbiddenPolicy,
  provenance,
  licenseText,
  readmeText,
  sbomText,
  typecheckConfig,
  typecheckConfigText,
  typecheckConsumerText
}) {
  const findings = [];
  let expectedRootPackage;
  try {
    expectedRootPackage = createExpectedRootPackage(plan);
  } catch {
    expectedRootPackage = null;
  }
  if (expectedRootPackage === null || !sameJson(rootPackage, expectedRootPackage) ||
      rootPackageText !== canonicalJson(expectedRootPackage)) {
    findings.push(finding("release-root-package", "/package.json"));
  }
  if (!Array.isArray(packagePlanFindings) || packagePlanFindings.length !== 0) {
    findings.push(finding("release-package-plan", "/packaging/alpha-package-plan.json"));
  }
  if (rootPackage?.license !== "MIT" || plan?.license !== "MIT") {
    findings.push(finding("release-license-id", "/license"));
  }
  const lockRoot = packageLock?.packages?.[""];
  const compiler = packageLock?.packages?.["node_modules/typescript"];
  const expectedDevelopmentDependencies = { typescript: TYPESCRIPT_TOOL_VERSION };
  const lockValid = exactKeys(rootPackage?.devDependencies, ["typescript"]) &&
    sameJson(rootPackage.devDependencies, expectedDevelopmentDependencies) &&
    exactKeys(packageLock, ["name", "version", "lockfileVersion", "requires", "packages"]) &&
    packageLockText === canonicalJson(canonicalPackageLockValue(packageLock)) &&
    packageLock?.name === rootPackage?.name && packageLock?.version === rootPackage?.version &&
    packageLock?.requires === true &&
    packageLock?.lockfileVersion === 3 &&
    exactKeys(packageLock?.packages, ["", "node_modules/typescript"]) &&
    exactKeys(lockRoot, ["name", "version", "license", "devDependencies", "engines"]) &&
    lockRoot?.name === rootPackage?.name && lockRoot?.version === rootPackage?.version &&
    lockRoot?.license === rootPackage?.license &&
    sameJson(lockRoot?.devDependencies, expectedDevelopmentDependencies) &&
    exactKeys(rootPackage?.engines, ["node"]) && sameJson(rootPackage.engines, plan?.engines) &&
    sameJson(lockRoot?.engines, rootPackage.engines) &&
    exactKeys(compiler, ["version", "resolved", "integrity", "dev", "license", "bin", "engines"]) &&
    compiler?.version === TYPESCRIPT_TOOLCHAIN.version && compiler?.dev === true &&
    compiler?.license === TYPESCRIPT_TOOLCHAIN.license &&
    compiler?.resolved === TYPESCRIPT_TOOLCHAIN.resolved &&
    compiler?.integrity === TYPESCRIPT_TOOLCHAIN.integrity &&
    sameJson(compiler?.bin, TYPESCRIPT_TOOLCHAIN.bin) &&
    sameJson(compiler?.engines, TYPESCRIPT_TOOLCHAIN.engines);
  if (!lockValid) {
    findings.push(finding("release-development-toolchain", "/package-lock.json"));
  }
  if (!Array.isArray(forbiddenPolicy?.approvedPublicIdentities) ||
      forbiddenPolicy.approvedPublicIdentities.length !== 1 ||
      forbiddenPolicy.approvedPublicIdentities[0] !== APPROVED_COPYRIGHT_HOLDER) {
    findings.push(finding("release-license-holder", "/approvedPublicIdentities"));
  }
  if (licenseText !== CANONICAL_MIT_LICENSE) {
    findings.push(finding("release-license-text", "/LICENSE"));
  }
  if (typeof readmeText !== "string" ||
      !readmeText.includes("## License\n\nMIT. See [LICENSE](LICENSE).\n")) {
    findings.push(finding("release-readme-license", "/README.md"));
  }
  const records = new Map(Array.isArray(provenance?.records)
    ? provenance.records.map((record) => [record.path, record])
    : []);
  if (!Array.isArray(plan?.packages)) {
    findings.push(finding("release-package-plan", "/packages"));
  } else {
    for (const item of plan.packages) {
      const files = flattenPackageFiles(item);
      const notices = files.filter((entry) => entry.role === "notice");
      if (notices.length !== 1 || notices[0].source !== "LICENSE" ||
          notices[0].target !== "LICENSE") {
        findings.push(finding("release-package-notice", `/packages/${item.packageId}/files`));
      }
      for (const { source } of files) {
        if (!licenseRecordMatches(records.get(source), source)) {
          findings.push(finding("release-source-license", `/sources/${source}`));
        }
      }
      let manifest;
      try {
        manifest = createAlphaPackageManifest(plan, item);
      } catch {
        findings.push(finding("release-leaf-manifest", `/packages/${item.packageId}`));
        continue;
      }
      if (manifest.license !== "MIT" || !manifest.files.includes("LICENSE")) {
        findings.push(finding("release-leaf-manifest", `/packages/${item.packageId}`));
      }
    }
  }
  let expectedSbom;
  try {
    expectedSbom = canonicalJson(createAlphaCycloneDx(plan));
  } catch {
    findings.push(finding("release-sbom-graph", `/${ALPHA_SBOM_PATH}`));
  }
  if (expectedSbom !== undefined && sbomText !== expectedSbom) {
    findings.push(finding("release-sbom-drift", `/${ALPHA_SBOM_PATH}`));
  }
  if (!validateTypecheckContract({
    plan,
    config: typecheckConfig,
    configText: typecheckConfigText,
    consumerText: typecheckConsumerText
  })) {
    findings.push(finding("release-typecheck-contract", `/${TYPECHECK_CONFIG_PATH}`));
  }
  return Object.freeze(findings);
}
