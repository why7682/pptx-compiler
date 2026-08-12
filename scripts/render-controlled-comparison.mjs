import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import {
  consumeControlledComparisonRenderBatch,
  prepareControlledComparisonMatrix
} from "../labs/design-planning/controlled-comparison.mjs";
import {
  createLocalControlledRenderRunner,
  renderControlledComparisonBatch
} from "../labs/design-planning/controlled-render-harness.mjs";
import { buildSyntheticFixtures } from "./generate-synthetic-fixtures.mjs";

const repositoryRoot = new URL("../", import.meta.url);

async function loadJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, repositoryRoot), "utf8"));
}

function requiredOption(value, name) {
  if (typeof value !== "string" || value.length < 1) {
    throw new TypeError(`missing required option --${name}`);
  }
  return value;
}

export async function runControlledComparisonRenderCli(argv = process.argv.slice(2)) {
  const parsed = parseArgs({
    args: argv,
    strict: true,
    options: {
      montage: { type: "string" },
      "output-root": { type: "string" },
      renderer: { type: "string" },
      "seed-hex": { type: "string" }
    }
  });
  const seedHex = requiredOption(parsed.values["seed-hex"], "seed-hex");
  if (!/^[a-f0-9]{64}$/u.test(seedHex)) {
    throw new TypeError("--seed-hex must contain exactly 64 lowercase hexadecimal characters");
  }
  const outputRoot = path.resolve(requiredOption(parsed.values["output-root"], "output-root"));
  const rendererExecutablePath = path.resolve(
    requiredOption(parsed.values.renderer, "renderer")
  );
  const montageExecutablePath = path.resolve(
    requiredOption(parsed.values.montage, "montage")
  );

  const fixtureBuild = await buildSyntheticFixtures();
  const baseArchive = fixtureBuild.archives.find((archive) => archive.variant === "potx");
  if (baseArchive === undefined) throw new Error("repository synthetic POTX fixture is unavailable");
  const matrix = prepareControlledComparisonMatrix({
    approvedPlanningAcceptance: await loadJson(
      "fixtures/design-planning/planning-approval.json"
    ),
    baseSourceArchiveBytes: baseArchive.bytes,
    baseTemplateIndex: await loadJson(
      "fixtures/inspection/expected-potx-template-index.json"
    ),
    evidenceInventory: await loadJson(
      "fixtures/design-planning/evidence-inventory.json"
    ),
    planningAcceptance: await loadJson(
      "fixtures/design-planning/planning-acceptance.json"
    ),
    randomizationSeed: Buffer.from(seedHex, "hex"),
    rawBrief: await loadJson("fixtures/design-planning/raw-defense-brief.json"),
    templateProfile: await loadJson("fixtures/design-planning/template-profile.json")
  });
  const renderBatch = consumeControlledComparisonRenderBatch({
    candidates: matrix.candidates,
    matrixReceipt: matrix.matrixReceipt,
    matrixToken: matrix.matrixToken
  });
  const runner = await createLocalControlledRenderRunner({
    montageExecutablePath,
    rendererExecutablePath
  });
  const rendered = await renderControlledComparisonBatch({
    outputRoot,
    renderBatch,
    runner
  });
  return Object.freeze({
    status: rendered.status,
    evidenceScope: matrix.evidenceScope,
    outputRoot,
    matrixReceiptSha256: matrix.matrixReceipt.matrixReceiptSha256,
    seedCommitmentSha256: matrix.matrixReceipt.seedCommitmentSha256,
    renderManifestSha256: rendered.manifest.manifestSha256,
    renderSetSha256: rendered.manifest.renderSetSha256,
    contactSheetSetSha256: rendered.manifest.contactSheetSetSha256,
    candidates: matrix.candidates.map((candidate) => ({
      blindLabel: candidate.blindLabel,
      archiveSha256: candidate.archiveSha256
    })),
    reviewOrders: matrix.reviewOrders
  });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runControlledComparisonRenderCli();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
