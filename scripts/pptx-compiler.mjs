#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import { executeCli } from "../packages/cli/src/cli.mjs";

const contractRoot = fileURLToPath(new URL("..", import.meta.url));
const result = await executeCli({
  argv: process.argv.slice(2),
  contractRoot
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
