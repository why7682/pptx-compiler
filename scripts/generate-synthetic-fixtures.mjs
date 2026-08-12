import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

export * from "../packages/public-synthetic/src/fixtures.mjs";

import { generateSyntheticFixtures } from
  "../packages/public-synthetic/src/fixtures.mjs";

async function runCli() {
  const { values } = parseArgs({
    options: {
      "output-dir": { type: "string", default: "fixtures/generated" }
    },
    strict: true,
    allowPositionals: false
  });
  const report = await generateSyntheticFixtures({ outputDir: values["output-dir"] });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runCli().catch((error) => {
    const message = error instanceof Error ? error.message : "unknown error";
    process.stderr.write(`fixture generation failed: ${message}\n`);
    process.exitCode = 1;
  });
}
