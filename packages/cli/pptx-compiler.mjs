#!/usr/bin/env node

import { executeCli } from "./src/index.mjs";

const result = await executeCli({ argv: process.argv.slice(2) });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
