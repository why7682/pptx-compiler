import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadAlphaPackagePlan,
  validateAlphaPackagePlan
} from "../scripts/lib/package-plan.mjs";
import {
  ALPHA_SBOM_PATH,
  CANONICAL_MIT_LICENSE,
  TYPECHECK_CONFIG_PATH,
  TYPECHECK_CONSUMER_PATH,
  canonicalJson,
  createAlphaCycloneDx,
  validateAlphaReleaseMetadata
} from "../scripts/lib/release-metadata.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const json = async (relativePath) => JSON.parse(await readFile(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8"
));
const packageLockText = await readFile(new URL("../package-lock.json", import.meta.url), "utf8");
const rootPackageText = await readFile(new URL("../package.json", import.meta.url), "utf8");
const typecheckConfigText = await readFile(
  new URL(`../${TYPECHECK_CONFIG_PATH}`, import.meta.url),
  "utf8"
);
const typecheckConsumerText = await readFile(
  new URL(`../${TYPECHECK_CONSUMER_PATH}`, import.meta.url),
  "utf8"
);
const plan = await loadAlphaPackagePlan({ root });
const inputs = {
  rootPackage: JSON.parse(rootPackageText),
  rootPackageText,
  packageLock: JSON.parse(packageLockText),
  packageLockText,
  plan,
  packagePlanFindings: await validateAlphaPackagePlan(plan, { root }),
  forbiddenPolicy: await json("policy/forbidden-materials.json"),
  provenance: await json("provenance/records.json"),
  licenseText: await readFile(new URL("../LICENSE", import.meta.url), "utf8"),
  readmeText: await readFile(new URL("../README.md", import.meta.url), "utf8"),
  sbomText: await readFile(new URL(`../${ALPHA_SBOM_PATH}`, import.meta.url), "utf8"),
  typecheckConfig: JSON.parse(typecheckConfigText),
  typecheckConfigText,
  typecheckConsumerText
};

function cloneInputs() {
  return {
    ...inputs,
    rootPackage: structuredClone(inputs.rootPackage),
    packageLock: structuredClone(inputs.packageLock),
    plan: structuredClone(inputs.plan),
    packagePlanFindings: structuredClone(inputs.packagePlanFindings),
    forbiddenPolicy: structuredClone(inputs.forbiddenPolicy),
    provenance: structuredClone(inputs.provenance),
    typecheckConfig: structuredClone(inputs.typecheckConfig)
  };
}

function findingCodes(value) {
  return new Set(validateAlphaReleaseMetadata(value).map(({ code }) => code));
}

test("the alpha license and CycloneDX graph are exact readable plan projections", () => {
  assert.deepEqual(validateAlphaReleaseMetadata(inputs), []);
  assert.equal(inputs.licenseText, CANONICAL_MIT_LICENSE);
  const sbom = createAlphaCycloneDx(inputs.plan);
  assert.equal(inputs.sbomText, canonicalJson(sbom));
  assert.equal(sbom.components.length, 4);
  assert.equal(sbom.dependencies.length, 5);
  assert.deepEqual(sbom.metadata.component.externalReferences, [{
    type: "vcs",
    url: "https://github.com/why7682/pptx-compiler.git"
  }]);
  assert.deepEqual(sbom.metadata.component.properties, [
    { name: "pptx-compiler:repository-id", value: "1330979133" }
  ]);
  for (const component of sbom.components) {
    assert.equal(Object.hasOwn(component, "externalReferences"), false);
    assert.equal(component.properties.length, 1);
  }
  assert.equal(JSON.stringify(sbom).includes("sha256"), false);
  assert.equal(JSON.stringify(sbom).includes("timestamp"), false);
});

test("release metadata mutations fail closed", async (t) => {
  await t.test("workspace root cannot become publishable", () => {
    const value = cloneInputs();
    value.rootPackage.private = false;
    assert.equal(findingCodes(value).has("release-root-package"), true);
  });

  await t.test("workspace root cannot gain a second install graph", () => {
    const value = cloneInputs();
    value.rootPackage.dependencies = { unreviewed: "1.0.0" };
    assert.equal(findingCodes(value).has("release-root-package"), true);
  });

  await t.test("workspace imports cannot redirect tests away from shipped modules", () => {
    const value = cloneInputs();
    value.rootPackage.imports["#pptx-compiler/core"] =
      "./tests/helpers/unreviewed.mjs";
    value.rootPackageText = canonicalJson(value.rootPackage);
    assert.equal(findingCodes(value).has("release-root-package"), true);
  });

  await t.test("documented root scripts are one closed map", () => {
    const value = cloneInputs();
    value.rootPackage.scripts["check:public-tree"] = "node -e 0";
    value.rootPackageText = canonicalJson(value.rootPackage);
    assert.equal(findingCodes(value).has("release-root-package"), true);
  });

  await t.test("duplicate root keys cannot hide a conflicting identity", () => {
    const value = cloneInputs();
    value.rootPackageText = value.rootPackageText.replace(
      '  "private": true,\n',
      '  "private": false,\n  "private": true,\n'
    );
    assert.equal(findingCodes(value).has("release-root-package"), true);
  });

  await t.test("root license drift", () => {
    const value = cloneInputs();
    value.rootPackage.license = "Apache-2.0";
    assert.equal(findingCodes(value).has("release-license-id"), true);
  });

  await t.test("development toolchain drift", () => {
    const value = cloneInputs();
    value.packageLock.packages["node_modules/typescript"].version = "7.0.2";
    assert.equal(findingCodes(value).has("release-development-toolchain"), true);
  });

  await t.test("extra development dependency", () => {
    const value = cloneInputs();
    value.rootPackage.devDependencies.unreviewed = "1.0.0";
    assert.equal(findingCodes(value).has("release-development-toolchain"), true);
  });

  await t.test("noncanonical lock representation", () => {
    const value = cloneInputs();
    value.packageLockText = value.packageLockText.replace("{\n", "{ \n");
    assert.equal(findingCodes(value).has("release-development-toolchain"), true);
  });

  await t.test("reordered lock keys are not a second canonical form", () => {
    const value = cloneInputs();
    value.packageLock = {
      version: value.packageLock.version,
      name: value.packageLock.name,
      lockfileVersion: value.packageLock.lockfileVersion,
      requires: value.packageLock.requires,
      packages: value.packageLock.packages
    };
    value.packageLockText = canonicalJson(value.packageLock);
    assert.equal(findingCodes(value).has("release-development-toolchain"), true);
  });

  await t.test("toolchain entry gains an unreviewed field", () => {
    const value = cloneInputs();
    value.packageLock.packages["node_modules/typescript"].hasInstallScript = true;
    value.packageLockText = canonicalJson(value.packageLock);
    assert.equal(findingCodes(value).has("release-development-toolchain"), true);
  });

  await t.test("license text drift", () => {
    const value = cloneInputs();
    value.licenseText = value.licenseText.replace("Permission", "Permission changed");
    assert.equal(findingCodes(value).has("release-license-text"), true);
  });

  await t.test("package notice drift", () => {
    const value = cloneInputs();
    const notice = value.plan.packages[0].files.find(({ role }) => role === "notice");
    notice.role = "documentation";
    assert.equal(findingCodes(value).has("release-package-notice"), true);
  });

  await t.test("source provenance drift", () => {
    const value = cloneInputs();
    const record = value.provenance.records.find(({ path }) =>
      path === "packages/cli/src/index.mjs");
    record.independentReview.status = "pending";
    assert.equal(findingCodes(value).has("release-source-license"), true);
  });

  await t.test("additional approved public identity", () => {
    const value = cloneInputs();
    value.forbiddenPolicy.approvedPublicIdentities.push("Unreviewed Identity");
    assert.equal(findingCodes(value).has("release-license-holder"), true);
  });

  await t.test("typecheck path drift", () => {
    const value = cloneInputs();
    value.typecheckConfig.compilerOptions.paths["pptx-compiler"] = ["./types/missing.d.ts"];
    value.typecheckConfigText = canonicalJson(value.typecheckConfig);
    assert.equal(findingCodes(value).has("release-typecheck-contract"), true);
  });

  await t.test("typecheck consumer misses a public specifier", () => {
    const value = cloneInputs();
    value.typecheckConsumerText = value.typecheckConsumerText.replace(
      'from "pptx-compiler";',
      'from "pptx-compiler-missing";'
    );
    assert.equal(findingCodes(value).has("release-typecheck-contract"), true);
  });

  await t.test("typecheck consumer cannot erase representative API checks", () => {
    const value = cloneInputs();
    value.typecheckConsumerText = Object.keys(
      value.typecheckConfig.compilerOptions.paths
    ).map((specifier) => `import {} from "${specifier}";`).join("\n") + "\n";
    assert.equal(findingCodes(value).has("release-typecheck-contract"), true);
  });

  await t.test("invalid package plan cannot receive release approval", () => {
    const value = cloneInputs();
    value.packagePlanFindings = [{ code: "package-plan-identity", pointer: "/" }];
    assert.equal(findingCodes(value).has("release-package-plan"), true);
  });

  await t.test("repository identity drift cannot reuse stale plan findings", () => {
    const value = cloneInputs();
    value.plan.repository.repositoryId = "1330979134";
    const codes = findingCodes(value);
    assert.equal(codes.has("release-leaf-manifest"), true);
    assert.equal(codes.has("release-sbom-graph"), true);
  });

  await t.test("SBOM relationship drift", () => {
    const value = cloneInputs();
    const sbom = JSON.parse(value.sbomText);
    sbom.dependencies[0].dependsOn.pop();
    value.sbomText = canonicalJson(sbom);
    assert.equal(findingCodes(value).has("release-sbom-drift"), true);
  });

  await t.test("SBOM repository URL drift", () => {
    const value = cloneInputs();
    const sbom = JSON.parse(value.sbomText);
    sbom.metadata.component.externalReferences[0].url =
      "https://github.com/why7682/not-pptx-compiler.git";
    value.sbomText = canonicalJson(sbom);
    assert.equal(findingCodes(value).has("release-sbom-drift"), true);
  });

  await t.test("SBOM repository ID drift", () => {
    const value = cloneInputs();
    const sbom = JSON.parse(value.sbomText);
    sbom.metadata.component.properties[0].value = "1330979134";
    value.sbomText = canonicalJson(sbom);
    assert.equal(findingCodes(value).has("release-sbom-drift"), true);
  });
});

test("the release checker still executes through a file alias", {
  skip: process.platform === "win32"
}, async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pptx-release-metadata-alias."));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const alias = path.join(directory, "release-check.mjs");
  await symlink(
    fileURLToPath(new URL("../scripts/check-release-metadata.mjs", import.meta.url)),
    alias
  );
  const result = spawnSync(process.execPath, [alias], {
    cwd: directory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^PASS release-metadata:/u);
});
