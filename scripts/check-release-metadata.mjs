#!/usr/bin/env node

import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadAlphaPackagePlan } from "./lib/package-plan.mjs";
import { validateAlphaPackagePlan } from "./lib/package-plan.mjs";
import {
  ALPHA_SBOM_PATH,
  TYPECHECK_CONFIG_PATH,
  TYPECHECK_CONSUMER_PATH,
  validateAlphaReleaseMetadata
} from "./lib/release-metadata.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

async function json(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, ...relativePath.split("/")), "utf8"));
}

export async function checkReleaseMetadata(root = repositoryRoot) {
  const [rootPackageText, packageLockText, plan, forbiddenPolicy, provenance,
    licenseText, readmeText, sbomText, typecheckConfigText, typecheckConsumerText] =
    await Promise.all([
      readFile(path.join(root, "package.json"), "utf8"),
      readFile(path.join(root, "package-lock.json"), "utf8"),
      loadAlphaPackagePlan({ root }),
      json(root, "policy/forbidden-materials.json"),
      json(root, "provenance/records.json"),
      readFile(path.join(root, "LICENSE"), "utf8"),
      readFile(path.join(root, "README.md"), "utf8"),
      readFile(path.join(root, ALPHA_SBOM_PATH), "utf8"),
      readFile(path.join(root, TYPECHECK_CONFIG_PATH), "utf8"),
      readFile(path.join(root, ...TYPECHECK_CONSUMER_PATH.split("/")), "utf8")
    ]);
  const rootPackage = JSON.parse(rootPackageText);
  const packageLock = JSON.parse(packageLockText);
  const typecheckConfig = JSON.parse(typecheckConfigText);
  const packagePlanFindings = await validateAlphaPackagePlan(plan, { root });
  return validateAlphaReleaseMetadata({
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
  });
}

async function invokedDirectly() {
  if (process.argv[1] === undefined) return false;
  try {
    const [invoked, modulePath] = await Promise.all([
      realpath(path.resolve(process.argv[1])),
      realpath(fileURLToPath(import.meta.url))
    ]);
    return invoked === modulePath;
  } catch {
    return false;
  }
}

if (await invokedDirectly()) {
  try {
    const findings = await checkReleaseMetadata();
    if (findings.length !== 0) {
      process.stdout.write(`${JSON.stringify({
        schemaVersion: 1,
        gate: "release-metadata",
        ok: false,
        findings
      })}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write("PASS release-metadata: 4-package MIT/static-ESM SBOM projection checked\n");
    }
  } catch {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      gate: "release-metadata",
      ok: false,
      findings: [{ code: "release-metadata-unreadable", pointer: "" }]
    })}\n`);
    process.exitCode = 1;
  }
}
