#!/usr/bin/env node

import process from "node:process";
import path from "node:path";
import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { buildAlphaPackageStage } from "./lib/package-stage.mjs";

export async function runAlphaPackageBuild({ argv = [] } = {}) {
  if (!Array.isArray(argv) || argv.length !== 0) {
    return Object.freeze({
      exitCode: 2,
      report: Object.freeze({
        schemaVersion: 1,
        ok: false,
        error: Object.freeze({ code: "PACKAGE_BUILD_USAGE" })
      })
    });
  }
  try {
    const evidence = await buildAlphaPackageStage();
    return Object.freeze({
      exitCode: 0,
      report: Object.freeze({ schemaVersion: 1, ok: true, evidence })
    });
  } catch (error) {
    const code = typeof error?.code === "string" ? error.code : "package-stage-failed";
    return Object.freeze({
      exitCode: 1,
      report: Object.freeze({
        schemaVersion: 1,
        ok: false,
        error: Object.freeze({ code })
      })
    });
  }
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
  const result = await runAlphaPackageBuild({ argv: process.argv.slice(2) });
  process.stdout.write(`${JSON.stringify(result.report)}\n`);
  process.exitCode = result.exitCode;
}
