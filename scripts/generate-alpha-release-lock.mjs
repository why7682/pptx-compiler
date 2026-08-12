#!/usr/bin/env node

import path from "node:path";

import {
  ALPHA_RELEASE_LOCK_PATH,
  alphaReleaseRepositoryRoot,
  generateAlphaReleaseLockFile
} from "./lib/alpha-release.mjs";

function emitFailure(code, exitCode = 1) {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    gate: "alpha-release-lock-generation",
    ok: false,
    findings: [{ code, pointer: "" }]
  })}\n`);
  process.exitCode = exitCode;
}

function parseArguments(argv) {
  if (argv.length !== 4 || argv[0] !== "--verification-stage" ||
      argv[2] !== "--fixed-stage" || !path.isAbsolute(argv[1]) ||
      !path.isAbsolute(argv[3])) {
    throw new Error("release-lock-generation-usage");
  }
  return Object.freeze({
    verificationStage: argv[1],
    fixedStage: argv[3]
  });
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch {
  emitFailure("release-lock-generation-usage", 2);
}

if (options !== undefined) {
  try {
    const lock = await generateAlphaReleaseLockFile({
      root: alphaReleaseRepositoryRoot(),
      verificationStage: options.verificationStage,
      fixedStage: options.fixedStage,
      environment: process.env
    });
    process.stdout.write(
      `PASS alpha-release-lock-generation: ${lock.builderResults[0].packages.length} package(s), ` +
      `${lock.builderResults.length} builder(s), ${lock.inputs.length} locked input(s); ` +
      `${ALPHA_RELEASE_LOCK_PATH}\n`
    );
  } catch {
    emitFailure("release-lock-generation-failed");
  }
}
