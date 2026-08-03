#!/usr/bin/env node

import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertSupportedSchema, validateJson } from "./lib/json-schema.mjs";

const REPORT_SCHEMA_VERSION = 1;
const EXPECTED_SCHEMA_ID = "urn:pptx-pipeline:schema:support-matrix:1";
const MATRIX_PATH = "policy/support-matrix.json";
const SCHEMA_PATH = "schemas/support-matrix.schema.json";
const MAX_CONTROL_FILE_BYTES = 1024 * 1024;
const DIMENSIONS = ["inputs", "ooxmlFeatures", "capabilities", "platforms", "evidenceLevels"];
const REQUIRED_CATCH_ALLS = {
  inputs: "unknown-input",
  ooxmlFeatures: "unknown-ooxml-feature",
  platforms: "unsupported-runtime-or-platform",
  evidenceLevels: "unavailable-evidence"
};
const CAPABILITY_EVIDENCE = new Set([
  "metadata",
  "executor",
  "input-schema",
  "output-schema",
  "conformance-fixture",
  "qa-assertions"
]);
const decoder = new TextDecoder("utf-8", { fatal: true });

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalPath(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate !== candidate.normalize("NFC")) {
    return false;
  }
  if (candidate.includes("\\") || candidate.includes("\0") || candidate.startsWith("/") ||
      candidate.startsWith("//") || /^[A-Za-z]:/.test(candidate)) {
    return false;
  }
  const parts = candidate.split("/");
  return !parts.some((part) => part === "" || part === "." || part === "..") &&
    path.posix.normalize(candidate) === candidate;
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function runGit(root, args, { encoding = "utf8", maxBuffer = 16 * 1024 * 1024 } = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding,
    maxBuffer,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed`);
  return result.stdout;
}

function splitNull(buffer) {
  const values = [];
  let start = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0) {
      if (index > start) values.push(buffer.subarray(start, index));
      start = index + 1;
    }
  }
  if (start !== buffer.length) throw new Error("Git returned malformed path data");
  return values;
}

function decode(buffer) {
  try {
    return decoder.decode(buffer);
  } catch {
    throw new Error("control data is not valid UTF-8");
  }
}

function listAdmittedPaths(root, mode) {
  const args = mode === "index"
    ? ["ls-files", "--cached", "-z"]
    : ["ls-files", "--cached", "--others", "--exclude-standard", "-z"];
  const output = runGit(root, args, { encoding: null });
  return new Set(splitNull(output).map((entry) => decode(entry)));
}

function readIndexControl(root, relativePath) {
  if (!canonicalPath(relativePath)) throw new Error("control path is invalid");
  const entry = runGit(root, ["ls-files", "--stage", "--", relativePath]).trim();
  const match = /^(100644|100755) ([0-9a-f]{40,64}) 0\t/.exec(entry);
  if (!match) throw new Error("control file is missing from the index or not a regular stage-zero file");
  const size = Number(runGit(root, ["cat-file", "-s", match[2]]).trim());
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_CONTROL_FILE_BYTES) {
    throw new Error("control file has an invalid size");
  }
  return runGit(root, ["cat-file", "blob", match[2]], {
    encoding: null,
    maxBuffer: MAX_CONTROL_FILE_BYTES + 1
  });
}

async function readWorkingControl(root, relativePath) {
  if (!canonicalPath(relativePath)) throw new Error("control path is invalid");
  const absolutePath = path.resolve(root, ...relativePath.split("/"));
  if (!isContained(root, absolutePath)) throw new Error("control path escapes the repository");
  const metadata = await lstat(absolutePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_CONTROL_FILE_BYTES) {
    throw new Error("control file is not a safe regular file");
  }
  const fileReal = await realpath(absolutePath);
  if (!isContained(root, fileReal) || fileReal !== absolutePath) {
    throw new Error("control file resolves through a link or outside the repository");
  }
  const handle = await open(absolutePath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== metadata.dev || opened.ino !== metadata.ino) {
      throw new Error("control file changed during inspection");
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function parseJson(content) {
  try {
    return JSON.parse(decode(content));
  } catch {
    throw new Error("control file is not valid UTF-8 JSON");
  }
}

function finding(ruleId, jsonPointer = "/") {
  return {
    path: MATRIX_PATH,
    ruleId,
    severity: "error",
    location: { jsonPointer }
  };
}

function sortFindings(findings) {
  return findings.sort((left, right) =>
    compareText(left.path, right.path) ||
    compareText(left.ruleId, right.ruleId) ||
    compareText(left.location?.jsonPointer ?? "", right.location?.jsonPointer ?? "")
  );
}

export function validateSupportMatrix(document, schema, { admittedPaths } = {}) {
  const findings = [];
  try {
    assertSupportedSchema(schema, { expectedId: EXPECTED_SCHEMA_ID });
  } catch {
    return [finding("support-matrix-schema-configuration")];
  }
  for (const error of validateJson(document, schema)) {
    findings.push(finding("support-matrix-schema-validation", error.pointer || "/"));
  }
  if (!isPlainObject(document) || !isPlainObject(document.dimensions)) {
    return sortFindings(findings);
  }

  const allIds = new Map();
  for (const dimension of DIMENSIONS) {
    const items = document.dimensions[dimension];
    if (!Array.isArray(items)) continue;
    let previousId;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const pointer = `/dimensions/${dimension}/${index}`;
      if (!isPlainObject(item) || typeof item.id !== "string") continue;
      if (previousId !== undefined && compareText(previousId, item.id) >= 0) {
        findings.push(finding("unsorted-support-matrix-ids", `${pointer}/id`));
      }
      previousId = item.id;
      if (allIds.has(item.id)) {
        findings.push(finding("duplicate-support-matrix-id", `${pointer}/id`));
      } else {
        allIds.set(item.id, { dimension, index });
      }

      const level = item.evidence?.level;
      const artifacts = Array.isArray(item.evidence?.artifacts) ? item.evidence.artifacts : [];
      if (document.supportClaimsEnabled === false && item.status === "supported") {
        findings.push(finding("support-claim-disabled", `${pointer}/status`));
      }
      if (item.status === "supported") {
        if (item.disposition !== "accept" || level !== "automated-public") {
          findings.push(finding("invalid-supported-disposition", pointer));
        }
        if (dimension === "capabilities") {
          const types = new Set(artifacts.map((artifact) => artifact?.type));
          for (const requiredType of CAPABILITY_EVIDENCE) {
            if (!types.has(requiredType)) {
              findings.push(finding("missing-supported-capability-evidence", `${pointer}/evidence/artifacts`));
            }
          }
        }
      }
      if (item.status === "experimental" && item.disposition !== "accept-with-warning") {
        findings.push(finding("invalid-experimental-disposition", `${pointer}/disposition`));
      }
      if (dimension === "capabilities" && item.status === "experimental") {
        if (level !== "automated-public") {
          findings.push(finding("invalid-experimental-capability-evidence", `${pointer}/evidence`));
        }
        const types = new Set(artifacts.map((artifact) => artifact?.type));
        for (const requiredType of CAPABILITY_EVIDENCE) {
          if (!types.has(requiredType)) {
            findings.push(finding(
              "missing-experimental-capability-evidence",
              `${pointer}/evidence/artifacts`
            ));
          }
        }
      }
      if (item.status === "manual" &&
          (item.disposition !== "report-manual-gate" || !["manual-trusted", "private-compatibility"].includes(level))) {
        findings.push(finding("invalid-manual-evidence", pointer));
      }
      if (item.status === "unsupported" && !["reject", "unavailable"].includes(item.disposition)) {
        findings.push(finding("invalid-unsupported-disposition", `${pointer}/disposition`));
      }
      if (level === "none" && artifacts.length !== 0) {
        findings.push(finding("evidence-none-has-artifacts", `${pointer}/evidence/artifacts`));
      }
      if (["automated-public", "manual-trusted", "private-compatibility"].includes(level) && artifacts.length === 0) {
        findings.push(finding("evidence-level-missing-artifact", `${pointer}/evidence/artifacts`));
      }
      for (let artifactIndex = 0; artifactIndex < artifacts.length; artifactIndex += 1) {
        const artifactPath = artifacts[artifactIndex]?.path;
        const artifactPointer = `${pointer}/evidence/artifacts/${artifactIndex}/path`;
        if (!canonicalPath(artifactPath)) {
          findings.push(finding("non-canonical-evidence-artifact", artifactPointer));
        } else if (admittedPaths instanceof Set && !admittedPaths.has(artifactPath)) {
          findings.push(finding("missing-evidence-artifact", artifactPointer));
        }
      }
    }
  }
  for (const [dimension, requiredId] of Object.entries(REQUIRED_CATCH_ALLS)) {
    const catchAll = Array.isArray(document.dimensions[dimension])
      ? document.dimensions[dimension].find((item) => item?.id === requiredId)
      : undefined;
    if (!catchAll) {
      findings.push(finding("missing-support-matrix-catch-all", `/dimensions/${dimension}`));
    } else if (catchAll.status !== "unsupported" || catchAll.disposition !== "reject") {
      findings.push(finding("invalid-support-matrix-catch-all", `/dimensions/${dimension}`));
    }
  }
  if (document.productStage === "pre-alpha-contract-only" && document.supportClaimsEnabled !== false) {
    findings.push(finding("pre-alpha-support-claims-enabled", "/supportClaimsEnabled"));
  }
  return sortFindings(findings);
}

function report(mode, itemCount, findings) {
  const sorted = sortFindings(findings);
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    gate: "support-matrix",
    mode,
    ok: sorted.length === 0,
    itemsChecked: itemCount,
    findings: sorted
  };
}

export async function checkSupportMatrix({ root = process.cwd(), mode = "index" } = {}) {
  if (!new Set(["index", "working-tree"]).has(mode)) {
    return report(String(mode), 0, [finding("unsupported-scan-mode")]);
  }
  try {
    const repositoryRoot = await realpath(path.resolve(root));
    const discoveredRoot = await realpath(path.resolve(
      runGit(repositoryRoot, ["rev-parse", "--show-toplevel"]).trim()
    ));
    if (repositoryRoot !== discoveredRoot) throw new Error("root must be the repository root");
    const gitDirectory = await realpath(path.resolve(
      runGit(repositoryRoot, ["rev-parse", "--absolute-git-dir"]).trim()
    ));
    if (!isContained(repositoryRoot, gitDirectory)) throw new Error("Git directory escapes the repository");

    const load = mode === "index"
      ? (relativePath) => readIndexControl(repositoryRoot, relativePath)
      : (relativePath) => readWorkingControl(repositoryRoot, relativePath);
    const [matrixContent, schemaContent] = await Promise.all([load(MATRIX_PATH), load(SCHEMA_PATH)]);
    const document = parseJson(matrixContent);
    const schema = parseJson(schemaContent);
    const admittedPaths = listAdmittedPaths(repositoryRoot, mode);
    const findings = validateSupportMatrix(document, schema, { admittedPaths });
    const itemCount = isPlainObject(document?.dimensions)
      ? DIMENSIONS.reduce((count, dimension) => count + (Array.isArray(document.dimensions[dimension])
        ? document.dimensions[dimension].length : 0), 0)
      : 0;
    return report(mode, itemCount, findings);
  } catch {
    return report(mode, 0, [finding("support-matrix-configuration-error")]);
  }
}

function formatHuman(result) {
  if (result.ok) {
    return `PASS ${result.gate} (${result.mode}): ${result.itemsChecked} item(s) checked`;
  }
  const lines = [`FAIL ${result.gate} (${result.mode}): ${result.findings.length} finding(s)`];
  for (const item of result.findings) {
    lines.push(`${item.path}:${item.location.jsonPointer}: ${item.severity} ${item.ruleId}`);
  }
  return lines.join("\n");
}

function parseArguments(argv) {
  const options = { root: process.cwd(), mode: "index", json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      options.json = true;
    } else if (argument === "--working-tree") {
      options.mode = "working-tree";
    } else if (argument === "--mode" || argument === "--root") {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === "--mode") options.mode = value;
      if (argument === "--root") options.root = value;
    } else {
      throw new Error(`unknown argument ${argument}`);
    }
  }
  return options;
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch {
    const invalid = report("index", 0, [finding("invalid-command-line")]);
    process.stdout.write(`${formatHuman(invalid)}\n`);
    process.exitCode = 2;
    return;
  }
  const result = await checkSupportMatrix(options);
  process.stdout.write(options.json ? `${JSON.stringify(result)}\n` : `${formatHuman(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
