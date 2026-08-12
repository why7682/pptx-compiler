#!/usr/bin/env node

import { constants as fsConstants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_RELEASE_ENTRY_PATHS,
  renderPublicWorkflows,
  validatePublicWorkflowSet
} from "./lib/public-workflows.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function sameStat(left, right) {
  return left.dev === right.dev && left.ino === right.ino &&
    left.mode === right.mode && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

async function strictDirectory(directory) {
  const [metadata, canonical] = await Promise.all([
    lstat(directory),
    realpath(directory)
  ]);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || canonical !== directory) {
    throw new Error("workflow-directory-invalid");
  }
}

async function readRegularText(filePath, maximumBytes) {
  let handle;
  try {
    const [metadata, canonical] = await Promise.all([
      lstat(filePath, { bigint: true }),
      realpath(filePath)
    ]);
    if (!metadata.isFile() || metadata.isSymbolicLink() || canonical !== filePath ||
        metadata.size < 1n || metadata.size > BigInt(maximumBytes)) {
      throw new Error("workflow-file-invalid");
    }
    handle = await open(filePath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const before = await handle.stat({ bigint: true });
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (!sameStat(metadata, before) || !sameStat(before, after) ||
        before.size !== BigInt(bytes.length)) {
      throw new Error("workflow-file-changed");
    }
    return decoder.decode(bytes);
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function readWorkflowFiles(root) {
  const files = new Map();
  const githubDirectory = path.join(root, ".github");
  const directory = path.join(githubDirectory, "workflows");
  await strictDirectory(githubDirectory);
  await strictDirectory(directory);
  for (const name of await readdir(directory)) {
    const relativePath = `.github/workflows/${name}`;
    const absolutePath = path.join(directory, name);
    const metadata = await lstat(absolutePath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 64 * 1024) {
      files.set(relativePath, undefined);
      continue;
    }
    files.set(relativePath, await readRegularText(absolutePath, 64 * 1024));
  }
  return files;
}

async function readReleaseEntryFiles(root) {
  const files = new Map();
  for (const relativePath of REQUIRED_RELEASE_ENTRY_PATHS) {
    try {
      files.set(
        relativePath,
        await readRegularText(path.join(root, ...relativePath.split("/")), 128 * 1024)
      );
    } catch {
      files.set(relativePath, undefined);
    }
  }
  return files;
}

export async function checkPublicWorkflows(root = repositoryRoot) {
  const canonicalRoot = await realpath(path.resolve(root));
  const [files, packageDocument, releaseEntries] = await Promise.all([
    readWorkflowFiles(canonicalRoot),
    readRegularText(path.join(canonicalRoot, "package.json"), 1024 * 1024).then(JSON.parse),
    readReleaseEntryFiles(canonicalRoot)
  ]);
  return validatePublicWorkflowSet(files, packageDocument.scripts, releaseEntries);
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
    const findings = await checkPublicWorkflows();
    if (findings.length !== 0) {
      process.stdout.write(`${JSON.stringify({
        schemaVersion: 1,
        gate: "public-workflows",
        ok: false,
        findings
      })}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(
        `PASS public-workflows: ${renderPublicWorkflows().size} canonical workflow(s) checked\n`
      );
    }
  } catch {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      gate: "public-workflows",
      ok: false,
      findings: [{ code: "workflow-unreadable", pointer: "" }]
    })}\n`);
    process.exitCode = 1;
  }
}
