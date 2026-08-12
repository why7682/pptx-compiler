#!/usr/bin/env node

import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { devNull } from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPORT_SCHEMA_VERSION = 1;
const POLICY_SCHEMA_VERSION = 1;
const DEFAULT_POLICY_PATH = "policy/forbidden-materials.json";
const PUBLIC_HISTORY_REF = "refs/heads/main";
const MAX_HISTORY_COMMITS = 64;
const MAX_HISTORY_TREE_ENTRIES = 4096;
const MAX_HISTORY_BYTES = 64 * 1024 * 1024;
const MAX_HISTORY_POLICY_BYTES = 1024 * 1024;
const HISTORY_GIT_ENVIRONMENT_OVERRIDES = new Set([
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_CONFIG",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_NOSYSTEM",
  "GIT_CONFIG_PARAMETERS",
  "GIT_CONFIG_SYSTEM",
  "GIT_DIR",
  "GIT_GRAFT_FILE",
  "GIT_INDEX_FILE",
  "GIT_NAMESPACE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_REPLACE_REF_BASE",
  "GIT_SHALLOW_FILE",
  "GIT_WORK_TREE"
]);
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

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
  if (candidate !== candidate.normalize("NFC") || candidate.includes("\\") ||
      /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(candidate)) {
    return false;
  }
  if (candidate.startsWith("/") || /^[A-Za-z]:/.test(candidate) || candidate.startsWith("//")) {
    return false;
  }
  const parts = candidate.split("/");
  return !parts.some((part) => part === "" || part === "." || part === "..") &&
    !parts.some((part) => part.toLowerCase() === ".git") &&
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

function compileFragments(rule, label, {
  allowExceptPaths = false,
  captureRequired = false
} = {}) {
  if (!isPlainObject(rule)) {
    throw new Error(`${label} must be an object`);
  }
  const allowedKeys = new Set(["id", "patternFragments", "flags"]);
  if (allowExceptPaths) allowedKeys.add("exceptPaths");
  assertOnlyKeys(rule, allowedKeys, label);
  if (typeof rule.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rule.id)) {
    throw new Error(`${label}.id is invalid`);
  }
  assertStringArray(rule.patternFragments, `${label}.patternFragments`);
  if (typeof rule.flags !== "string" || /[^dgimsuvy]/.test(rule.flags)) {
    throw new Error(`${label}.flags is invalid`);
  }
  if (allowExceptPaths && rule.exceptPaths !== undefined) {
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
  return { ...rule, expression, exceptPaths: allowExceptPaths ? rule.exceptPaths ?? [] : [] };
}

export function compileForbiddenMaterialPolicy(policy) {
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
    const compiled = compileFragments(rule, `policy.pathRules[${index}]`, {
      allowExceptPaths: true
    });
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
  const copyrightIdentityRule = compileFragments(
    policy.copyrightIdentityRule,
    "policy.copyrightIdentityRule",
    { captureRequired: true }
  );
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

function runGit(root, args, {
  encoding = "utf8",
  maxBuffer = 16 * 1024 * 1024,
  environment = process.env,
  requireQuiet = false
} = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding,
    env: environment,
    maxBuffer,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0 ||
      (requireQuiet && (result.stdout.length !== 0 || result.stderr.length !== 0))) {
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

function historyObjectId(value) {
  return typeof value === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value);
}

function historyTreeSortKey(name, mode) {
  return Buffer.concat([name, Buffer.from([mode === "40000" ? 0x2f : 0x00])]);
}

function readHistoryTreeEntries(root, tree, environment, cache) {
  if (cache.has(tree)) return cache.get(tree);
  const objectIdBytes = tree.length / 2;
  if (objectIdBytes !== 20 && objectIdBytes !== 32) {
    throw new Error("Git returned an unsupported tree object identifier");
  }
  const raw = runGit(root, ["--no-replace-objects", "cat-file", "tree", tree], {
    encoding: null,
    environment
  });
  const entries = [];
  let offset = 0;
  let previousName;
  let previousSortKey;
  while (offset < raw.length) {
    const space = raw.indexOf(0x20, offset);
    const terminator = space < 0 ? -1 : raw.indexOf(0x00, space + 1);
    if (space <= offset || terminator <= space + 1 ||
        terminator + 1 + objectIdBytes > raw.length) {
      throw new Error("Git returned a malformed raw tree entry");
    }
    const modeBytes = raw.subarray(offset, space);
    const mode = modeBytes.toString("ascii");
    if (!["40000", "100644", "100755", "120000", "160000"].includes(mode) ||
        !modeBytes.equals(Buffer.from(mode, "ascii"))) {
      throw new Error("Git returned a noncanonical raw tree mode");
    }
    const nameBytes = raw.subarray(space + 1, terminator);
    if (nameBytes.includes(0x2f)) {
      throw new Error("Git returned a traversing raw tree name");
    }
    const sortKey = historyTreeSortKey(nameBytes, mode);
    if ((previousName !== undefined && nameBytes.equals(previousName)) ||
        (previousSortKey !== undefined && Buffer.compare(previousSortKey, sortKey) >= 0)) {
      throw new Error("Git returned a noncanonical raw tree order");
    }
    const oidStart = terminator + 1;
    const oidEnd = oidStart + objectIdBytes;
    const oid = raw.subarray(oidStart, oidEnd).toString("hex");
    if (/^0+$/.test(oid)) {
      throw new Error("Git returned a null raw tree object identifier");
    }
    entries.push({
      mode,
      type: mode === "40000" ? "tree" : mode === "160000" ? "commit" : "blob",
      oid,
      path: decodePath(nameBytes)
    });
    previousName = nameBytes;
    previousSortKey = sortKey;
    offset = oidEnd;
  }
  cache.set(tree, entries);
  return entries;
}

function resolveHistoryTreePath(root, tree, relativePath, environment, cache) {
  const segments = relativePath.split("/");
  let currentTree = tree;
  for (let index = 0; index < segments.length; index += 1) {
    const matches = readHistoryTreeEntries(root, currentTree, environment, cache)
      .filter((entry) => entry.path === segments[index]);
    if (matches.length !== 1) return undefined;
    const match = matches[0];
    if (index === segments.length - 1) return match;
    if (match.type !== "tree") return undefined;
    currentTree = match.oid;
  }
  return undefined;
}

function readHistoryBlob(root, oid, maxBytes, environment) {
  const sizeText = runGit(root, ["--no-replace-objects", "cat-file", "-s", oid], {
    environment
  }).trim();
  const size = Number(sizeText);
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error("Git returned an invalid history blob size");
  }
  if (size > maxBytes) return { size, content: null };
  return {
    size,
    content: runGit(root, ["--no-replace-objects", "cat-file", "blob", oid], {
      encoding: null,
      environment,
      maxBuffer: maxBytes + 1
    })
  };
}

function readLocalIdentity(root, environment) {
  const readOne = (key) => {
    const values = splitNull(runGit(root, [
      "config", "--local", "--no-includes", "--null", "--get-all", key
    ], {
      encoding: null,
      environment
    })).map((value) => decoder.decode(value));
    if (values.length !== 1 || values[0].length === 0 ||
        values[0].includes("\n") || values[0].includes("\0")) {
      throw new Error(`repository-local ${key} must have one safe value`);
    }
    return values[0];
  };
  return { name: readOne("user.name"), email: readOne("user.email") };
}

function resolveHistoryPolicy(root, policyPath, tip, environment, treeCache) {
  const absolutePolicy = path.resolve(root, policyPath);
  if (!isContained(root, absolutePolicy)) {
    throw new Error("policy path must stay inside the repository root");
  }
  const relativePolicy = path.relative(root, absolutePolicy).split(path.sep).join("/");
  if (!canonicalPath(relativePolicy)) {
    throw new Error("policy path must be canonical and repository-relative");
  }
  const tipTree = runGit(root, [
    "--no-replace-objects", "rev-parse", "--verify", `${tip}^{tree}`
  ], { environment }).trim();
  if (!historyObjectId(tipTree)) throw new Error("main does not resolve to one tree");
  const match = resolveHistoryTreePath(
    root,
    tipTree,
    relativePolicy,
    environment,
    treeCache
  );
  if (match === undefined || match.type !== "blob" || match.mode !== "100644") {
    throw new Error("history policy is missing or not a regular file");
  }
  const loaded = readHistoryBlob(root, match.oid, MAX_HISTORY_POLICY_BYTES, environment);
  if (loaded.content === null) throw new Error("history policy is oversized");
  let parsed;
  try {
    parsed = JSON.parse(decoder.decode(loaded.content));
  } catch {
    throw new Error("history policy is not valid UTF-8 JSON");
  }
  return compileForbiddenMaterialPolicy(parsed);
}

function parseHistoryCommit(root, commit, identity, policy, environment) {
  const commitPath = `history/commits/${commit}.txt`;
  const raw = runGit(root, ["--no-replace-objects", "cat-file", "commit", commit], {
    encoding: null,
    environment,
    maxBuffer: policy.maxFileBytes + 64 * 1024
  });
  const separator = raw.indexOf(Buffer.from("\n\n"));
  if (separator < 0) {
    return {
      findings: [finding(commitPath, "malformed-history-commit")],
      identityOccurrences: 0,
      parents: [],
      tree: undefined
    };
  }
  let headerText;
  try {
    headerText = decoder.decode(raw.subarray(0, separator));
  } catch {
    return {
      findings: [finding(commitPath, "non-utf8-history-header")],
      identityOccurrences: 0,
      parents: [],
      tree: undefined
    };
  }
  const headers = new Map();
  const findings = [];
  for (const line of headerText.split("\n")) {
    const splitAt = line.indexOf(" ");
    if (splitAt < 1 || line.startsWith(" ")) {
      findings.push(finding(commitPath, "unsupported-history-commit-header"));
      continue;
    }
    const key = line.slice(0, splitAt);
    if (!["tree", "parent", "author", "committer"].includes(key)) {
      findings.push(finding(commitPath, "unsupported-history-commit-header"));
      continue;
    }
    const values = headers.get(key) ?? [];
    values.push(line.slice(splitAt + 1));
    headers.set(key, values);
  }
  if (headers.get("tree")?.length !== 1 ||
      headers.get("author")?.length !== 1 || headers.get("committer")?.length !== 1 ||
      (headers.get("parent") ?? []).some((value) => !historyObjectId(value)) ||
      !historyObjectId(headers.get("tree")?.[0])) {
    findings.push(finding(commitPath, "malformed-history-commit-header"));
  }
  let identityOccurrences = 0;
  for (const kind of ["author", "committer"]) {
    const value = headers.get(kind)?.[0];
    const match = typeof value === "string"
      ? /^(.*) <([^<>]+)> [0-9]+ [+-][0-9]{4}$/.exec(value)
      : null;
    identityOccurrences += 1;
    if (match === null || match[1] !== identity.name || match[2] !== identity.email) {
      findings.push(finding(commitPath, `unexpected-history-${kind}-identity`));
    }
  }
  const message = raw.subarray(separator + 2);
  if (message.length > policy.maxFileBytes) {
    findings.push(finding(commitPath, "oversized-history-commit-message"));
  } else {
    findings.push(...inspectForbiddenMaterialContent(
      `history/commit-messages/${commit}.txt`,
      message,
      policy
    ));
  }
  const parentValues = headers.get("parent") ?? [];
  const treeValue = headers.get("tree")?.[0];
  return {
    findings,
    identityOccurrences,
    parents: parentValues.filter(historyObjectId),
    tree: historyObjectId(treeValue) ? treeValue : undefined
  };
}

async function historyOverrideExists(candidate) {
  try {
    await lstat(candidate);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function baseHistoryGitEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_"))
  );
}

function cleanHistoryGitEnvironment() {
  return {
    ...baseHistoryGitEnvironment(),
    GIT_CONFIG: devNull,
    GIT_CONFIG_GLOBAL: devNull,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: devNull,
    GIT_NO_LAZY_FETCH: "1",
    GIT_TERMINAL_PROMPT: "0"
  };
}

function historyIdentityGitEnvironment() {
  return {
    ...baseHistoryGitEnvironment(),
    GIT_CONFIG_GLOBAL: devNull,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: devNull
  };
}

function historyGitEnvironmentIsUnsafe(key) {
  const normalized = key.toUpperCase();
  return HISTORY_GIT_ENVIRONMENT_OVERRIDES.has(normalized) ||
    /^GIT_CONFIG_(?:KEY|VALUE)_[0-9]+$/.test(normalized);
}

function strictFsckArguments(root, tip, environment) {
  const variables = runGit(root, ["--no-pager", "help", "--config"], {
    environment
  }).split("\n").filter((value) => value.length > 0);
  const messageKeys = [...new Set(variables.filter((value) =>
    /^fsck\.[A-Za-z][A-Za-z0-9]*$/.test(value) && value !== "fsck.skipList"
  ))].sort(compareText);
  if (messageKeys.length === 0) {
    throw new Error("Git did not disclose its fsck message configuration");
  }
  return [
    ...messageKeys.flatMap((key) => ["-c", `${key}=error`]),
    "-c", `fsck.skipList=${devNull}`,
    "--no-replace-objects",
    "fsck", "--strict", "--no-dangling", tip
  ];
}

async function historyRepositoryIsDirect(root, gitDirectory, environment) {
  const expectedGitDirectory = path.join(root, ".git");
  const metadata = await lstat(expectedGitDirectory);
  if (!metadata.isDirectory() || await realpath(expectedGitDirectory) !== expectedGitDirectory ||
      gitDirectory !== expectedGitDirectory ||
      await historyOverrideExists(path.join(expectedGitDirectory, "commondir"))) {
    return false;
  }
  const commonText = runGit(root, ["rev-parse", "--git-common-dir"], { environment }).trim();
  if (commonText.length === 0 || commonText.includes("\n") || commonText.includes("\0")) {
    return false;
  }
  const commonDirectory = await realpath(path.resolve(root, commonText));
  return commonDirectory === gitDirectory;
}

async function historyRepositoryControlFindings(root, gitDirectory, environment) {
  const findings = [];
  if (await historyOverrideExists(path.join(gitDirectory, "info", "grafts")) ||
      await historyOverrideExists(path.join(gitDirectory, "objects", "info", "alternates"))) {
    findings.push(finding("<history>", "history-git-object-override"));
  }
  const replaceRefs = runGit(root, ["for-each-ref", "--format=%(refname)", "refs/replace"], {
    environment
  }).trim();
  if (replaceRefs.length > 0) findings.push(finding("<history>", "history-replace-ref"));
  const shallow = runGit(root, ["rev-parse", "--is-shallow-repository"], { environment }).trim();
  if (shallow !== "false") findings.push(finding("<history>", "history-shallow-repository"));
  return findings;
}

async function scanForbiddenHistory(
  root,
  gitDirectory,
  policyPath,
  environment,
  identityEnvironment
) {
  const findings = await historyRepositoryControlFindings(root, gitDirectory, environment);

  const tip = runGit(root, [
    "--no-replace-objects", "rev-parse", "--verify", `${PUBLIC_HISTORY_REF}^{commit}`
  ], { environment }).trim();
  if (!historyObjectId(tip)) throw new Error("main does not resolve to one commit");
  const treeCache = new Map();
  const policy = resolveHistoryPolicy(root, policyPath, tip, environment, treeCache);
  const identity = readLocalIdentity(root, identityEnvironment);
  const pendingCommits = [tip];
  const scheduledCommits = new Set(pendingCommits);
  const commits = [];
  while (pendingCommits.length > 0) {
    const commit = pendingCommits.shift();
    if (commits.length >= MAX_HISTORY_COMMITS) {
      findings.push(finding("<history>", "history-commit-limit"));
      break;
    }
    const parsed = parseHistoryCommit(root, commit, identity, policy, environment);
    commits.push({ oid: commit, parsed });
    for (const parent of parsed.parents) {
      if (!scheduledCommits.has(parent)) {
        scheduledCommits.add(parent);
        pendingCommits.push(parent);
      }
    }
  }

  const scannedEntries = new Set();
  const scannedLeaves = new Set();
  let historyBytes = 0;
  let identityOccurrences = 0;
  let stoppedForLimit = false;
  for (const commit of commits) {
    findings.push(...commit.parsed.findings);
    identityOccurrences += commit.parsed.identityOccurrences;
    if (commit.parsed.tree === undefined) continue;
    const pendingTrees = [{ oid: commit.parsed.tree, prefix: "" }];
    while (pendingTrees.length > 0 && !stoppedForLimit) {
      const current = pendingTrees.shift();
      for (const entry of readHistoryTreeEntries(
        root,
        current.oid,
        environment,
        treeCache
      )) {
        const fullPath = current.prefix === "" ? entry.path : `${current.prefix}/${entry.path}`;
        const entryKey = `${fullPath}\0${entry.mode}\0${entry.type}\0${entry.oid}`;
        if (scannedEntries.has(entryKey)) continue;
        if (scannedEntries.size >= MAX_HISTORY_TREE_ENTRIES) {
          findings.push(finding("<history>", "history-tree-entry-limit"));
          stoppedForLimit = true;
          break;
        }
        scannedEntries.add(entryKey);
        findings.push(...inspectForbiddenMaterialPath(fullPath, entry.mode, policy));
        if (!canonicalPath(fullPath)) continue;
        if (entry.type === "tree") {
          pendingTrees.push({ oid: entry.oid, prefix: fullPath });
          continue;
        }
        scannedLeaves.add(entryKey);
        if (entry.type !== "blob" || entry.mode === "120000") continue;
        const loaded = readHistoryBlob(root, entry.oid, policy.maxFileBytes, environment);
        if (loaded.content === null) {
          findings.push(finding(fullPath, "oversized-file"));
          continue;
        }
        historyBytes += loaded.size;
        if (historyBytes > MAX_HISTORY_BYTES) {
          findings.push(finding("<history>", "history-byte-limit"));
          stoppedForLimit = true;
          break;
        }
        findings.push(...inspectForbiddenMaterialContent(fullPath, loaded.content, policy));
      }
    }
    if (stoppedForLimit) break;
  }

  runGit(root, strictFsckArguments(root, tip, environment), {
    environment,
    requireQuiet: true
  });
  if (!await historyRepositoryIsDirect(root, gitDirectory, environment)) {
    findings.push(finding("<history>", "history-repository-indirection"));
  }
  const finalControlFindings = await historyRepositoryControlFindings(
    root,
    gitDirectory,
    environment
  );
  for (const finalFinding of finalControlFindings) {
    if (!findings.some((item) =>
      item.path === finalFinding.path && item.ruleId === finalFinding.ruleId)) {
      findings.push(finalFinding);
    }
  }
  const finalTip = runGit(root, [
    "--no-replace-objects", "rev-parse", "--verify", `${PUBLIC_HISTORY_REF}^{commit}`
  ], { environment }).trim();
  const finalIdentity = readLocalIdentity(root, identityEnvironment);
  if (finalTip !== tip) findings.push(finding("<history>", "history-main-ref-changed"));
  if (finalIdentity.name !== identity.name || finalIdentity.email !== identity.email) {
    findings.push(finding("<history>", "history-local-identity-changed"));
  }
  return report("history", scannedLeaves.size, findings, {
    ref: PUBLIC_HISTORY_REF,
    tip,
    commitsScanned: commits.length,
    leafEntriesScanned: scannedLeaves.size,
    bytesScanned: historyBytes,
    identityOccurrences
  });
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

export function inspectForbiddenMaterialPath(filePath, mode, policy) {
  const findings = [];
  if (!canonicalPath(filePath)) {
    findings.push(finding("<non-canonical-path>", "non-canonical-repository-path"));
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
  if (mode !== undefined && policy.approvedExecutablePaths.includes(filePath) &&
      mode !== "100755") {
    findings.push(finding(filePath, "approved-executable-bit-missing"));
  }
  if (mode === "120000") {
    findings.push(finding(filePath, "forbidden-symlink"));
  }
  if (mode === "160000") {
    findings.push(finding(filePath, "forbidden-submodule"));
  }
  return findings;
}

export function inspectForbiddenMaterialContent(filePath, content, policy) {
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

function report(mode, filesScanned, findings, history) {
  const sorted = sortFindings(findings);
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    gate: "forbidden-materials",
    mode,
    ok: sorted.length === 0,
    filesScanned,
    ...(history === undefined ? {} : { history }),
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
  return compileForbiddenMaterialPolicy(parsed);
}

export async function scanForbiddenMaterials({
  root = process.cwd(),
  mode = "index",
  policyPath = DEFAULT_POLICY_PATH
} = {}) {
  if (mode !== "index" && mode !== "working-tree" && mode !== "history") {
    return report(String(mode), 0, [finding("<configuration>", "unsupported-scan-mode")]);
  }
  if (mode === "history" && Object.keys(process.env).some(historyGitEnvironmentIsUnsafe)) {
    return report(mode, 0, [finding("<history>", "history-git-environment-override")]);
  }
  let repositoryRoot;
  try {
    const historyEnvironment = mode === "history" ? cleanHistoryGitEnvironment() : undefined;
    const identityEnvironment = mode === "history" ? historyIdentityGitEnvironment() : undefined;
    repositoryRoot = await realpath(path.resolve(root));
    const discoveredRoot = await realpath(path.resolve(
      runGit(repositoryRoot, ["rev-parse", "--show-toplevel"], {
        environment: historyEnvironment
      }).trim()
    ));
    if (discoveredRoot !== repositoryRoot) {
      throw new Error("root must be the Git repository root");
    }
    const gitDirectory = await realpath(path.resolve(
      runGit(repositoryRoot, ["rev-parse", "--absolute-git-dir"], {
        environment: historyEnvironment
      }).trim()
    ));
    if (!isContained(repositoryRoot, gitDirectory)) {
      throw new Error("Git directory must stay inside the repository root");
    }
    if (mode === "history") {
      if (!await historyRepositoryIsDirect(repositoryRoot, gitDirectory, historyEnvironment)) {
        return report(mode, 0, [finding("<history>", "history-repository-indirection")]);
      }
      return await scanForbiddenHistory(
        repositoryRoot,
        gitDirectory,
        policyPath,
        historyEnvironment,
        identityEnvironment
      );
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
        findings.push(...inspectForbiddenMaterialPath(entry.path, entry.mode, policy));
        if (!canonicalPath(entry.path)) continue;
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
        findings.push(...inspectForbiddenMaterialContent(entry.path, loaded.content, policy));
      }
      return report(mode, filesScanned, findings);
    }

    const indexModes = new Map(indexEntries.filter((entry) => entry.stage === 0).map((entry) => [entry.path, entry.mode]));
    for (const filePath of listWorkingPaths(repositoryRoot)) {
      filesScanned += 1;
      const indexMode = indexModes.get(filePath);
      findings.push(...inspectForbiddenMaterialPath(filePath, indexMode, policy));
      if (!canonicalPath(filePath)) continue;
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
      findings.push(...inspectForbiddenMaterialContent(filePath, loaded.content, policy));
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
