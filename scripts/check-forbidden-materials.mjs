#!/usr/bin/env node

import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPORT_SCHEMA_VERSION = 1;
const POLICY_SCHEMA_VERSION = 1;
const DEFAULT_POLICY_PATH = "policy/forbidden-materials.json";
const decoder = new TextDecoder("utf-8", { fatal: true });

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function assertOnlyKeys(object, allowed, label) {
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} contains unsupported field ${JSON.stringify(key)}`);
    }
  }
}

function assertStringArray(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) ||
      value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? "an" : "a non-empty"} array of non-empty strings`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`${label} contains duplicates`);
  }
}

function compileFragments(rule, label, captureRequired = false) {
  if (!isPlainObject(rule)) {
    throw new Error(`${label} must be an object`);
  }
  assertOnlyKeys(rule, new Set(["id", "patternFragments", "flags", "exceptPaths"]), label);
  if (typeof rule.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rule.id)) {
    throw new Error(`${label}.id is invalid`);
  }
  assertStringArray(rule.patternFragments, `${label}.patternFragments`);
  if (typeof rule.flags !== "string" || /[^dgimsuvy]/.test(rule.flags)) {
    throw new Error(`${label}.flags is invalid`);
  }
  if (rule.exceptPaths !== undefined) {
    assertStringArray(rule.exceptPaths, `${label}.exceptPaths`, { allowEmpty: true });
    if (rule.exceptPaths.some((item) => !canonicalPath(item))) {
      throw new Error(`${label}.exceptPaths contains a non-canonical path`);
    }
  }
  const flags = rule.flags.includes("g") ? rule.flags : `${rule.flags}g`;
  let expression;
  try {
    expression = new RegExp(rule.patternFragments.join(""), flags);
  } catch {
    throw new Error(`${label} does not compile`);
  }
  if (expression.test("")) {
    throw new Error(`${label} must not match an empty string`);
  }
  expression.lastIndex = 0;
  if (captureRequired && !rule.patternFragments.join("").includes("(")) {
    throw new Error(`${label} must include an identity capture`);
  }
  return { ...rule, expression, exceptPaths: rule.exceptPaths ?? [] };
}

function validatePolicy(policy) {
  if (!isPlainObject(policy)) {
    throw new Error("policy must be an object");
  }
  assertOnlyKeys(policy, new Set([
    "schemaVersion",
    "maxFileBytes",
    "approvedExecutablePaths",
    "approvedPublicIdentities",
    "copyrightIdentityRule",
    "forbiddenExtensions",
    "forbiddenBasenames",
    "forbiddenPathSegments",
    "pathRules",
    "magicRules",
    "textRules"
  ]), "policy");
  if (policy.schemaVersion !== POLICY_SCHEMA_VERSION) {
    throw new Error("policy schemaVersion is unsupported");
  }
  if (!Number.isSafeInteger(policy.maxFileBytes) || policy.maxFileBytes < 1) {
    throw new Error("policy.maxFileBytes must be a positive safe integer");
  }
  assertStringArray(policy.approvedExecutablePaths, "policy.approvedExecutablePaths", { allowEmpty: true });
  if (policy.approvedExecutablePaths.some((item) => !canonicalPath(item))) {
    throw new Error("policy.approvedExecutablePaths contains a non-canonical path");
  }
  assertStringArray(policy.approvedPublicIdentities, "policy.approvedPublicIdentities");

  const ids = new Set();
  const claimId = (id, label) => {
    if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) {
      throw new Error(`${label}.id is invalid or duplicated`);
    }
    ids.add(id);
  };

  const validateGroupedRules = (rules, collectionName, valueKey, valueValidator = () => true) => {
    if (!Array.isArray(rules) || rules.length === 0) {
      throw new Error(`policy.${collectionName} must be a non-empty array`);
    }
    return rules.map((rule, index) => {
      const label = `policy.${collectionName}[${index}]`;
      if (!isPlainObject(rule)) {
        throw new Error(`${label} must be an object`);
      }
      assertOnlyKeys(rule, new Set(["id", valueKey]), label);
      claimId(rule.id, label);
      assertStringArray(rule[valueKey], `${label}.${valueKey}`);
      if (rule[valueKey].some((value) => !valueValidator(value))) {
        throw new Error(`${label}.${valueKey} contains an invalid value`);
      }
      return rule;
    });
  };

  const forbiddenExtensions = validateGroupedRules(
    policy.forbiddenExtensions,
    "forbiddenExtensions",
    "extensions",
    (value) => /^\.[a-z0-9]+$/.test(value)
  );
  const forbiddenBasenames = validateGroupedRules(
    policy.forbiddenBasenames,
    "forbiddenBasenames",
    "names",
    (value) => !value.includes("/") && !value.includes("\\")
  );
  const forbiddenPathSegments = validateGroupedRules(
    policy.forbiddenPathSegments,
    "forbiddenPathSegments",
    "segments",
    (value) => value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\")
  );

  if (!Array.isArray(policy.pathRules) || policy.pathRules.length === 0) {
    throw new Error("policy.pathRules must be a non-empty array");
  }
  const pathRules = policy.pathRules.map((rule, index) => {
    const compiled = compileFragments(rule, `policy.pathRules[${index}]`);
    claimId(compiled.id, `policy.pathRules[${index}]`);
    return compiled;
  });

  if (!Array.isArray(policy.magicRules) || policy.magicRules.length === 0) {
    throw new Error("policy.magicRules must be a non-empty array");
  }
  const magicRules = policy.magicRules.map((rule, index) => {
    const label = `policy.magicRules[${index}]`;
    if (!isPlainObject(rule)) {
      throw new Error(`${label} must be an object`);
    }
    assertOnlyKeys(rule, new Set(["id", "hexPrefixes"]), label);
    claimId(rule.id, label);
    assertStringArray(rule.hexPrefixes, `${label}.hexPrefixes`);
    if (rule.hexPrefixes.some((value) => value.length % 2 !== 0 || !/^[0-9a-f]+$/.test(value))) {
      throw new Error(`${label}.hexPrefixes contains invalid lowercase hexadecimal`);
    }
    return { ...rule, prefixes: rule.hexPrefixes.map((value) => Buffer.from(value, "hex")) };
  });

  if (!Array.isArray(policy.textRules) || policy.textRules.length === 0) {
    throw new Error("policy.textRules must be a non-empty array");
  }
  const textRules = policy.textRules.map((rule, index) => {
    const compiled = compileFragments(rule, `policy.textRules[${index}]`);
    claimId(compiled.id, `policy.textRules[${index}]`);
    return compiled;
  });
  const copyrightIdentityRule = compileFragments(policy.copyrightIdentityRule, "policy.copyrightIdentityRule", true);
  claimId(copyrightIdentityRule.id, "policy.copyrightIdentityRule");

  return {
    ...policy,
    forbiddenExtensions,
    forbiddenBasenames,
    forbiddenPathSegments,
    pathRules,
    magicRules,
    textRules,
    copyrightIdentityRule
  };
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

function decodePath(buffer) {
  try {
    return decoder.decode(buffer);
  } catch {
    throw new Error("Git returned a non-UTF-8 path");
  }
}

function splitNull(buffer) {
  const values = [];
  let start = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0) {
      if (index > start) {
        values.push(buffer.subarray(start, index));
      }
      start = index + 1;
    }
  }
  if (start !== buffer.length) {
    throw new Error("Git returned a malformed NUL-delimited result");
  }
  return values;
}

function listIndexEntries(root) {
  const output = runGit(root, ["ls-files", "--stage", "-z"], { encoding: null });
  return splitNull(output).map((entry) => {
    const separator = entry.indexOf(9);
    if (separator < 0) {
      throw new Error("Git returned a malformed index entry");
    }
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

function readIndexBlob(root, entry, maxBytes) {
  const sizeText = runGit(root, ["cat-file", "-s", entry.oid]).trim();
  const size = Number(sizeText);
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error("Git returned an invalid blob size");
  }
  if (size > maxBytes) {
    return { size, content: null };
  }
  const content = runGit(root, ["cat-file", "blob", entry.oid], {
    encoding: null,
    maxBuffer: maxBytes + 1
  });
  return { size, content };
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function readWorkingFile(root, relativePath, maxBytes) {
  const absolutePath = path.resolve(root, ...relativePath.split("/"));
  if (!isContained(root, absolutePath)) {
    throw new Error("working-tree path escapes the repository");
  }
  const metadata = await lstat(absolutePath);
  if (metadata.isSymbolicLink()) {
    return { kind: "symlink", size: metadata.size, content: null };
  }
  if (!metadata.isFile()) {
    return { kind: "non-file", size: metadata.size, content: null };
  }
  const rootReal = await realpath(root);
  const fileReal = await realpath(absolutePath);
  if (!isContained(rootReal, fileReal) || fileReal !== absolutePath) {
    return { kind: "symlink", size: metadata.size, content: null };
  }
  if (metadata.size > maxBytes) {
    return { kind: "file", size: metadata.size, content: null };
  }
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  const handle = await open(absolutePath, fsConstants.O_RDONLY | noFollow);
  try {
    const openedMetadata = await handle.stat();
    if (!openedMetadata.isFile() || openedMetadata.dev !== metadata.dev || openedMetadata.ino !== metadata.ino) {
      throw new Error("working-tree file changed during inspection");
    }
    return {
      kind: "file",
      size: openedMetadata.size,
      fileMode: openedMetadata.mode,
      content: await handle.readFile()
    };
  } finally {
    await handle.close();
  }
}

function lineAndColumn(text, offset) {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function finding(filePath, ruleId, location) {
  const result = { path: filePath, ruleId, severity: "error" };
  if (location !== undefined) {
    result.location = location;
  }
  return result;
}

function inspectPath(filePath, mode, policy) {
  const findings = [];
  if (!canonicalPath(filePath)) {
    findings.push(finding(filePath, "non-canonical-repository-path"));
    return findings;
  }
  const lowerPath = filePath.toLowerCase();
  const basename = path.posix.basename(lowerPath);
  const segments = lowerPath.split("/");
  for (const rule of policy.forbiddenExtensions) {
    if (rule.extensions.some((extension) => lowerPath.endsWith(extension))) {
      findings.push(finding(filePath, rule.id));
    }
  }
  for (const rule of policy.forbiddenBasenames) {
    if (rule.names.some((name) => basename === name.toLowerCase())) {
      findings.push(finding(filePath, rule.id));
    }
  }
  for (const rule of policy.forbiddenPathSegments) {
    if (rule.segments.some((segment) => segments.includes(segment.toLowerCase()))) {
      findings.push(finding(filePath, rule.id));
    }
  }
  for (const rule of policy.pathRules) {
    rule.expression.lastIndex = 0;
    if (!rule.exceptPaths.includes(filePath) && rule.expression.test(filePath)) {
      findings.push(finding(filePath, rule.id));
    }
  }
  if (mode === "100755" && !policy.approvedExecutablePaths.includes(filePath)) {
    findings.push(finding(filePath, "unapproved-executable-bit"));
  }
  if (mode === "120000") {
    findings.push(finding(filePath, "forbidden-symlink"));
  }
  if (mode === "160000") {
    findings.push(finding(filePath, "forbidden-submodule"));
  }
  return findings;
}

function inspectContent(filePath, content, policy) {
  const findings = [];
  for (const rule of policy.magicRules) {
    if (rule.prefixes.some((prefix) => content.length >= prefix.length && content.subarray(0, prefix.length).equals(prefix))) {
      findings.push(finding(filePath, rule.id, { offset: 0 }));
    }
  }
  if (content.includes(0)) {
    findings.push(finding(filePath, "forbidden-binary-content"));
    return findings;
  }
  let text;
  try {
    text = decoder.decode(content);
  } catch {
    findings.push(finding(filePath, "non-utf8-content"));
    return findings;
  }
  for (const rule of policy.textRules) {
    rule.expression.lastIndex = 0;
    for (const match of text.matchAll(rule.expression)) {
      findings.push(finding(filePath, rule.id, lineAndColumn(text, match.index)));
    }
  }
  const identityRule = policy.copyrightIdentityRule;
  identityRule.expression.lastIndex = 0;
  for (const match of text.matchAll(identityRule.expression)) {
    const identity = match[1]?.trim();
    if (!identity || !policy.approvedPublicIdentities.includes(identity)) {
      findings.push(finding(filePath, identityRule.id, lineAndColumn(text, match.index)));
    }
  }
  return findings;
}

function sortFindings(findings) {
  return findings.sort((left, right) =>
    compareText(left.path, right.path) ||
    compareText(left.ruleId, right.ruleId) ||
    ((left.location?.line ?? 0) - (right.location?.line ?? 0)) ||
    ((left.location?.column ?? left.location?.offset ?? 0) -
      (right.location?.column ?? right.location?.offset ?? 0))
  );
}

function report(mode, filesScanned, findings) {
  const sorted = sortFindings(findings);
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    gate: "forbidden-materials",
    mode,
    ok: sorted.length === 0,
    filesScanned,
    findings: sorted
  };
}

async function resolvePolicy(root, policyPath, mode, indexEntries) {
  const absolutePolicy = path.resolve(root, policyPath);
  if (!isContained(root, absolutePolicy)) {
    throw new Error("policy path must stay inside the repository root");
  }
  const relativePolicy = path.relative(root, absolutePolicy).split(path.sep).join("/");
  if (!canonicalPath(relativePolicy)) {
    throw new Error("policy path must be canonical and repository-relative");
  }
  let content;
  if (mode === "index") {
    const matches = indexEntries.filter((entry) => entry.path === relativePolicy && entry.stage === 0);
    if (matches.length !== 1 || !matches[0].mode.startsWith("100")) {
      throw new Error("policy file is missing from the index or is not a regular file");
    }
    const loaded = readIndexBlob(root, matches[0], 1024 * 1024);
    if (loaded.content === null) {
      throw new Error("policy file is oversized");
    }
    content = loaded.content;
  } else {
    const loaded = await readWorkingFile(root, relativePolicy, 1024 * 1024);
    if (loaded.kind !== "file" || loaded.content === null) {
      throw new Error("policy file is not a safe regular file");
    }
    content = loaded.content;
  }
  let parsed;
  try {
    parsed = JSON.parse(decoder.decode(content));
  } catch {
    throw new Error("policy file is not valid UTF-8 JSON");
  }
  return validatePolicy(parsed);
}

export async function scanForbiddenMaterials({
  root = process.cwd(),
  mode = "index",
  policyPath = DEFAULT_POLICY_PATH
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
    if (discoveredRoot !== repositoryRoot) {
      throw new Error("root must be the Git repository root");
    }
    const gitDirectory = await realpath(path.resolve(
      runGit(repositoryRoot, ["rev-parse", "--absolute-git-dir"]).trim()
    ));
    if (!isContained(repositoryRoot, gitDirectory)) {
      throw new Error("Git directory must stay inside the repository root");
    }
    const indexEntries = listIndexEntries(repositoryRoot);
    const policy = await resolvePolicy(repositoryRoot, policyPath, mode, indexEntries);
    const findings = [];
    let filesScanned = 0;

    if (mode === "index") {
      for (const entry of indexEntries.sort((left, right) => compareText(left.path, right.path) || left.stage - right.stage)) {
        if (entry.stage !== 0) {
          findings.push(finding(entry.path, "unmerged-index-entry"));
          continue;
        }
        filesScanned += 1;
        findings.push(...inspectPath(entry.path, entry.mode, policy));
        if (entry.mode === "120000") {
          continue;
        }
        if (entry.mode === "160000") {
          continue;
        }
        if (!entry.mode.startsWith("100")) {
          findings.push(finding(entry.path, "unsupported-index-entry"));
          continue;
        }
        const loaded = readIndexBlob(repositoryRoot, entry, policy.maxFileBytes);
        if (loaded.size > policy.maxFileBytes) {
          findings.push(finding(entry.path, "oversized-file"));
          continue;
        }
        findings.push(...inspectContent(entry.path, loaded.content, policy));
      }
      return report(mode, filesScanned, findings);
    }

    const indexModes = new Map(indexEntries.filter((entry) => entry.stage === 0).map((entry) => [entry.path, entry.mode]));
    for (const filePath of listWorkingPaths(repositoryRoot)) {
      filesScanned += 1;
      const indexMode = indexModes.get(filePath);
      findings.push(...inspectPath(filePath, indexMode, policy));
      if (indexMode === "120000" || indexMode === "160000") {
        continue;
      }
      let loaded;
      try {
        loaded = await readWorkingFile(repositoryRoot, filePath, policy.maxFileBytes);
      } catch {
        findings.push(finding(filePath, "unreadable-working-tree-entry"));
        continue;
      }
      if (loaded.kind === "symlink") {
        findings.push(finding(filePath, "forbidden-symlink"));
        continue;
      }
      if (loaded.kind !== "file") {
        findings.push(finding(filePath, "unsupported-working-tree-entry"));
        continue;
      }
      if (loaded.size > policy.maxFileBytes) {
        findings.push(finding(filePath, "oversized-file"));
        continue;
      }
      if ((loaded.fileMode & 0o111) !== 0 && !policy.approvedExecutablePaths.includes(filePath)) {
        findings.push(finding(filePath, "unapproved-executable-bit"));
      }
      findings.push(...inspectContent(filePath, loaded.content, policy));
    }
    return report(mode, filesScanned, findings);
  } catch {
    return report(mode, 0, [finding("<configuration>", "policy-configuration-error")]);
  }
}

function formatHuman(result) {
  if (result.ok) {
    return `PASS ${result.gate} (${result.mode}): ${result.filesScanned} file(s) scanned`;
  }
  const lines = [`FAIL ${result.gate} (${result.mode}): ${result.findings.length} finding(s)`];
  for (const item of result.findings) {
    let location = "";
    if (item.location?.line !== undefined) {
      location = `:${item.location.line}:${item.location.column}`;
    } else if (item.location?.offset !== undefined) {
      location = `:offset-${item.location.offset}`;
    }
    lines.push(`${item.path}${location}: ${item.severity} ${item.ruleId}`);
  }
  return lines.join("\n");
}

function parseArguments(argv) {
  const options = { root: process.cwd(), mode: "index", policyPath: DEFAULT_POLICY_PATH, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      options.json = true;
    } else if (argument === "--working-tree") {
      options.mode = "working-tree";
    } else if (argument === "--mode" || argument === "--root" || argument === "--policy") {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error(`${argument} requires a value`);
      }
      index += 1;
      if (argument === "--mode") options.mode = value;
      if (argument === "--root") options.root = value;
      if (argument === "--policy") options.policyPath = value;
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
  const result = await scanForbiddenMaterials(options);
  process.stdout.write(options.json ? `${JSON.stringify(result)}\n` : `${formatHuman(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
