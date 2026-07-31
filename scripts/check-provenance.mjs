#!/usr/bin/env node

import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertSupportedSchema, validateJson } from "./lib/json-schema.mjs";

const REPORT_SCHEMA_VERSION = 1;
const RECORD_SCHEMA_VERSION = 1;
const EXPECTED_SCHEMA_ID = "urn:pptx-pipeline:schema:provenance-record:1";
const DEFAULT_SCHEMA_PATH = "schemas/provenance-record.schema.json";
const DEFAULT_RECORDS_PATH = "provenance/records.json";
const MAX_CONTROL_FILE_BYTES = 1024 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true });

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalPath(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return false;
  }
  if (candidate !== candidate.normalize("NFC") || candidate.includes("\\") || candidate.includes("\0")) {
    return false;
  }
  if (candidate.startsWith("/") || /^[A-Za-z]:/.test(candidate) || candidate.startsWith("//")) {
    return false;
  }
  const parts = candidate.split("/");
  return !parts.some((part) => part === "" || part === "." || part === "..") &&
    path.posix.normalize(candidate) === candidate;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function runGit(root, args, { encoding = "utf8", maxBuffer = 16 * 1024 * 1024 } = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding,
    maxBuffer,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed`);
  }
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
  if (start !== buffer.length) {
    throw new Error("Git returned a malformed NUL-delimited result");
  }
  return values;
}

function decodePath(buffer) {
  try {
    return decoder.decode(buffer);
  } catch {
    throw new Error("Git returned a non-UTF-8 path");
  }
}

function listIndexEntries(root) {
  const output = runGit(root, ["ls-files", "--stage", "-z"], { encoding: null });
  return splitNull(output).map((entry) => {
    const separator = entry.indexOf(9);
    if (separator < 0) throw new Error("Git returned a malformed index entry");
    const metadata = entry.subarray(0, separator).toString("ascii").split(" ");
    if (metadata.length !== 3 || !/^[0-7]{6}$/.test(metadata[0]) ||
        !/^[0-9a-f]{40,64}$/.test(metadata[1]) || !/^[0-3]$/.test(metadata[2])) {
      throw new Error("Git returned an unsupported index entry");
    }
    return {
      mode: metadata[0],
      oid: metadata[1],
      stage: Number(metadata[2]),
      path: decodePath(entry.subarray(separator + 1))
    };
  });
}

function listWorkingPaths(root) {
  const output = runGit(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: null });
  return splitNull(output).map(decodePath).sort(compareText);
}

function readIndexBlob(root, entries, relativePath) {
  const matches = entries.filter((entry) => entry.stage === 0 && entry.path === relativePath);
  if (matches.length !== 1 || !matches[0].mode.startsWith("100")) {
    throw new Error("control file is missing from the index or is not a regular file");
  }
  const size = Number(runGit(root, ["cat-file", "-s", matches[0].oid]).trim());
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_CONTROL_FILE_BYTES) {
    throw new Error("control file has an invalid size");
  }
  return runGit(root, ["cat-file", "blob", matches[0].oid], {
    encoding: null,
    maxBuffer: MAX_CONTROL_FILE_BYTES + 1
  });
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function readWorkingControlFile(root, relativePath) {
  const absolutePath = path.resolve(root, ...relativePath.split("/"));
  if (!isContained(root, absolutePath)) {
    throw new Error("control-file path escapes the repository");
  }
  const metadata = await lstat(absolutePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_CONTROL_FILE_BYTES) {
    throw new Error("control file is not a safe regular file");
  }
  const rootReal = await realpath(root);
  const fileReal = await realpath(absolutePath);
  if (!isContained(rootReal, fileReal) || fileReal !== absolutePath) {
    throw new Error("control file resolves through a link or outside the repository");
  }
  const handle = await open(absolutePath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const openedMetadata = await handle.stat();
    if (!openedMetadata.isFile() || openedMetadata.dev !== metadata.dev || openedMetadata.ino !== metadata.ino) {
      throw new Error("control file changed during inspection");
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function parseJson(content, label) {
  try {
    return JSON.parse(decoder.decode(content));
  } catch {
    throw new Error(`${label} is not valid UTF-8 JSON`);
  }
}


function finding(filePath, ruleId, location) {
  const result = { path: filePath, ruleId, severity: "error" };
  if (location !== undefined) result.location = location;
  return result;
}

function sortFindings(findings) {
  return findings.sort((left, right) =>
    compareText(left.path, right.path) ||
    compareText(left.ruleId, right.ruleId) ||
    compareText(left.location?.jsonPointer ?? "", right.location?.jsonPointer ?? "")
  );
}

function report(mode, filesScanned, findings) {
  const sorted = sortFindings(findings);
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    gate: "provenance",
    mode,
    ok: sorted.length === 0,
    filesScanned,
    findings: sorted
  };
}

function normalizeControlPath(root, candidate) {
  const absolute = path.resolve(root, candidate);
  if (!isContained(root, absolute)) throw new Error("control-file path must stay inside the repository root");
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  if (!canonicalPath(relative)) throw new Error("control-file path must be canonical and repository-relative");
  return relative;
}

function semanticFindings(recordsDocument, admittedPaths, recordsPath) {
  const findings = [];
  const records = recordsDocument.records;
  const seen = new Set();
  let previousPath;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const pointer = `/records/${index}`;
    if (!isPlainObject(record) || !canonicalPath(record.path)) {
      findings.push(finding(recordsPath, "non-canonical-provenance-path", { jsonPointer: `${pointer}/path` }));
      continue;
    }
    if (seen.has(record.path)) {
      findings.push(finding(recordsPath, "duplicate-provenance-path", { jsonPointer: `${pointer}/path` }));
    }
    if (previousPath !== undefined && compareText(previousPath, record.path) >= 0) {
      findings.push(finding(recordsPath, "unsorted-provenance-records", { jsonPointer: `${pointer}/path` }));
    }
    seen.add(record.path);
    previousPath = record.path;
    if (!admittedPaths.has(record.path)) {
      findings.push(finding(recordsPath, "orphan-provenance-record", { jsonPointer: `${pointer}/path` }));
    }
    for (const field of ["privateInformationReview", "projectConstantCleanup", "publicConformance", "independentReview"]) {
      if (record[field]?.status === "pending") {
        findings.push(finding(recordsPath, "pending-provenance-status", { jsonPointer: `${pointer}/${field}/status` }));
      }
    }
  }
  for (const admittedPath of [...admittedPaths].sort(compareText)) {
    if (!seen.has(admittedPath)) {
      findings.push(finding(admittedPath, "missing-provenance-record"));
    }
  }
  return findings;
}

export async function checkProvenance({
  root = process.cwd(),
  mode = "index",
  schemaPath = DEFAULT_SCHEMA_PATH,
  recordsPath = DEFAULT_RECORDS_PATH
} = {}) {
  if (mode !== "index" && mode !== "working-tree") {
    return report(String(mode), 0, [finding("<configuration>", "unsupported-scan-mode")]);
  }
  let repositoryRoot;
  try {
    repositoryRoot = await realpath(path.resolve(root));
    const discoveredRoot = await realpath(path.resolve(
      runGit(repositoryRoot, ["rev-parse", "--show-toplevel"]).trim()
    ));
    if (discoveredRoot !== repositoryRoot) throw new Error("root must be the Git repository root");
    const gitDirectory = await realpath(path.resolve(
      runGit(repositoryRoot, ["rev-parse", "--absolute-git-dir"]).trim()
    ));
    if (!isContained(repositoryRoot, gitDirectory)) {
      throw new Error("Git directory must stay inside the repository root");
    }
    const relativeSchema = normalizeControlPath(repositoryRoot, schemaPath);
    const relativeRecords = normalizeControlPath(repositoryRoot, recordsPath);
    const indexEntries = listIndexEntries(repositoryRoot);
    let admittedPaths;
    let schemaContent;
    let recordsContent;
    if (mode === "index") {
      if (indexEntries.some((entry) => entry.stage !== 0)) throw new Error("unmerged index entries are unsupported");
      admittedPaths = new Set(indexEntries.map((entry) => entry.path));
      schemaContent = readIndexBlob(repositoryRoot, indexEntries, relativeSchema);
      recordsContent = readIndexBlob(repositoryRoot, indexEntries, relativeRecords);
    } else {
      admittedPaths = new Set(listWorkingPaths(repositoryRoot));
      schemaContent = await readWorkingControlFile(repositoryRoot, relativeSchema);
      recordsContent = await readWorkingControlFile(repositoryRoot, relativeRecords);
    }
    const schema = parseJson(schemaContent, "provenance schema");
    const recordsDocument = parseJson(recordsContent, "provenance records");
    assertSupportedSchema(schema, { expectedId: EXPECTED_SCHEMA_ID });
    const schemaErrors = validateJson(recordsDocument, schema)
      .sort((left, right) => compareText(left.pointer, right.pointer) || compareText(left.keyword, right.keyword));
    const findings = schemaErrors.map((error) =>
      finding(relativeRecords, "provenance-schema-validation", { jsonPointer: error.pointer || "/" })
    );
    if (recordsDocument.schemaVersion !== RECORD_SCHEMA_VERSION) {
      findings.push(finding(relativeRecords, "unsupported-provenance-schema-version", { jsonPointer: "/schemaVersion" }));
    }
    if (isPlainObject(recordsDocument) && Array.isArray(recordsDocument.records)) {
      findings.push(...semanticFindings(recordsDocument, admittedPaths, relativeRecords));
    }
    return report(mode, admittedPaths.size, findings);
  } catch {
    return report(mode, 0, [finding("<configuration>", "provenance-configuration-error")]);
  }
}

function formatHuman(result) {
  if (result.ok) {
    return `PASS ${result.gate} (${result.mode}): ${result.filesScanned} file(s) covered`;
  }
  const lines = [`FAIL ${result.gate} (${result.mode}): ${result.findings.length} finding(s)`];
  for (const item of result.findings) {
    const location = item.location?.jsonPointer ? `:${item.location.jsonPointer}` : "";
    lines.push(`${item.path}${location}: ${item.severity} ${item.ruleId}`);
  }
  return lines.join("\n");
}

function parseArguments(argv) {
  const options = {
    root: process.cwd(),
    mode: "index",
    schemaPath: DEFAULT_SCHEMA_PATH,
    recordsPath: DEFAULT_RECORDS_PATH,
    json: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      options.json = true;
    } else if (argument === "--working-tree") {
      options.mode = "working-tree";
    } else if (["--mode", "--root", "--schema", "--records"].includes(argument)) {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === "--mode") options.mode = value;
      if (argument === "--root") options.root = value;
      if (argument === "--schema") options.schemaPath = value;
      if (argument === "--records") options.recordsPath = value;
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
    const invalid = report("index", 0, [finding("<configuration>", "invalid-command-line")]);
    process.stdout.write(`${formatHuman(invalid)}\n`);
    process.exitCode = 2;
    return;
  }
  const result = await checkProvenance(options);
  process.stdout.write(options.json ? `${JSON.stringify(result)}\n` : `${formatHuman(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
