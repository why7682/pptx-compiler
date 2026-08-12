#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectModuleFile, splitNullPaths } from "./lib/source-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

function listModules(root) {
  const result = spawnSync("git", [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    "*.mjs"
  ], {
    cwd: root,
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.error !== undefined || result.signal !== null || result.status !== 0 ||
      !Buffer.isBuffer(result.stdout) || !Buffer.isBuffer(result.stderr) ||
      result.stderr.length !== 0) {
    throw new Error("source-git-list");
  }
  return [...splitNullPaths(result.stdout)].sort();
}

export async function checkSourcePolicy(root = repositoryRoot) {
  const modules = listModules(root);
  const findings = [];
  for (const relativePath of modules) {
    findings.push(...await inspectModuleFile({ root, relativePath }));
  }
  return Object.freeze({ modules: Object.freeze(modules), findings: Object.freeze(findings) });
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
    const result = await checkSourcePolicy();
    if (result.findings.length !== 0) {
      process.stdout.write(`${JSON.stringify({
        schemaVersion: 1,
        gate: "source-policy",
        ok: false,
        findings: result.findings
      })}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(`PASS source-policy: ${result.modules.length} module source(s) checked\n`);
    }
  } catch {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      gate: "source-policy",
      ok: false,
      findings: [{ code: "source-policy-unavailable", pointer: "" }]
    })}\n`);
    process.exitCode = 1;
  }
}
