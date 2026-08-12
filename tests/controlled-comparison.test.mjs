import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CONTROLLED_COMPARISON_VERSION,
  ControlledComparisonError,
  captureAuthenticatedControlledRenderBatch,
  consumeControlledComparisonRenderBatch,
  prepareControlledComparisonMatrix
} from "../labs/design-planning/controlled-comparison.mjs";
import { parseSecureZip } from "../packages/core/src/secure-zip.mjs";
import { parseStrictXml } from "../packages/core/src/strict-xml.mjs";
import { buildSyntheticFixtures } from "../scripts/generate-synthetic-fixtures.mjs";

const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const fixtureRoot = new URL("../fixtures/", import.meta.url);

async function loadJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, fixtureRoot), "utf8"));
}

const fixtureBuild = await buildSyntheticFixtures();
const baseArchive = fixtureBuild.archives.find((archive) => archive.variant === "potx");
const fixtureInputs = Object.freeze({
  approvedPlanningAcceptance: await loadJson("design-planning/planning-approval.json"),
  baseTemplateIndex: await loadJson("inspection/expected-potx-template-index.json"),
  evidenceInventory: await loadJson("design-planning/evidence-inventory.json"),
  planningAcceptance: await loadJson("design-planning/planning-acceptance.json"),
  rawBrief: await loadJson("design-planning/raw-defense-brief.json"),
  templateProfile: await loadJson("design-planning/template-profile.json")
});

function matrixInputs(overrides = {}) {
  return {
    approvedPlanningAcceptance: structuredClone(fixtureInputs.approvedPlanningAcceptance),
    baseSourceArchiveBytes: Buffer.from(baseArchive.bytes),
    baseTemplateIndex: structuredClone(fixtureInputs.baseTemplateIndex),
    evidenceInventory: structuredClone(fixtureInputs.evidenceInventory),
    planningAcceptance: structuredClone(fixtureInputs.planningAcceptance),
    randomizationSeed: Buffer.alloc(32, 7),
    rawBrief: structuredClone(fixtureInputs.rawBrief),
    templateProfile: structuredClone(fixtureInputs.templateProfile),
    ...overrides
  };
}

function assertControlledError(error, pointer) {
  assert.ok(error instanceof ControlledComparisonError);
  assert.equal(error.code, "CONTROLLED_COMPARISON_INVALID");
  assert.equal(error.pointer, pointer);
  return true;
}

function collectNodes(root, namespaceURI, localName) {
  const result = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node.namespaceURI === namespaceURI && node.localName === localName) result.push(node);
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push(node.children[index]);
    }
  }
  return result;
}

function slideTexts(archiveBytes) {
  const parts = parseSecureZip(archiveBytes);
  return collectNodes(parseStrictXml(parts.get("ppt/slides/slide1.xml")).root, NS_A, "t")
    .map((node) => node.text);
}

function blindArchiveText(archiveBytes) {
  return [...parseSecureZip(archiveBytes)]
    .map(([partPath, bytes]) => `${partPath}\n${Buffer.from(bytes).toString("utf8")}`)
    .join("\n")
    .toLowerCase();
}

test("one P1 snapshot yields a deterministic opaque 2 x 3 matrix and twelve delivery cells", () => {
  const first = prepareControlledComparisonMatrix(matrixInputs());
  const second = prepareControlledComparisonMatrix(matrixInputs());

  assert.equal(first.matrixVersion, CONTROLLED_COMPARISON_VERSION);
  assert.equal(first.evidenceScope, "simulated-review-only");
  assert.equal(first.candidates.length, 6);
  assert.equal(first.reviewCells.length, 12);
  assert.equal(first.reviewOrders.length, 6);
  assert.equal(first.matrixReceipt.armCount, 6);
  assert.equal(first.matrixReceipt.reviewCellCount, 12);
  assert.equal(
    first.matrixReceipt.rawInputSha256,
    "5f5e93f00196a0afd856e8a6974c7c7c171b2910ae506c2e6389951dcd5ee381"
  );
  assert.equal(first.matrixReceipt.matrixReceiptSha256, second.matrixReceipt.matrixReceiptSha256);
  assert.deepEqual(
    first.candidates.map((candidate) => [candidate.blindLabel, candidate.archiveSha256]),
    second.candidates.map((candidate) => [candidate.blindLabel, candidate.archiveSha256])
  );
  assert.deepEqual(first.candidates.map((candidate) => candidate.blindLabel), [
    "blind-01", "blind-02", "blind-03", "blind-04", "blind-05", "blind-06"
  ]);
  assert.equal(new Set(first.candidates.map((candidate) => candidate.archiveSha256)).size, 6);
  assert.equal(Object.keys(first.matrixToken).length, 0);
  assert.ok(Object.isFrozen(first.matrixToken));
  assert.ok(Object.isFrozen(first.matrixReceipt));

  const labels = first.candidates.map((candidate) => candidate.blindLabel).sort();
  for (const order of first.reviewOrders) {
    assert.deepEqual([...order.blindLabels].sort(), labels);
  }
  assert.equal(new Set(first.reviewOrders.map((order) => order.blindLabels.join("|"))).size, 6);
});

test("narrative pairs change only slide order and visual triplets keep all visible wording fixed", () => {
  const result = prepareControlledComparisonMatrix(matrixInputs());
  const byLabel = new Map(result.candidates.map((candidate) => [candidate.blindLabel, candidate]));

  assert.equal(result.contrastReceipt.narrativePairs.length, 3);
  for (const pair of result.contrastReceipt.narrativePairs) {
    const [left, right] = pair.blindLabels.map((label) => byLabel.get(label));
    const leftHashes = left.slides.map((slide) => slide.archiveSha256);
    const rightHashes = right.slides.map((slide) => slide.archiveSha256);
    assert.deepEqual([...leftHashes].sort(), [...rightHashes].sort());
    assert.notDeepEqual(leftHashes, rightHashes);
    assert.equal(leftHashes[0], rightHashes[0]);
    assert.equal(leftHashes[1], rightHashes[2]);
    assert.equal(leftHashes[2], rightHashes[1]);
    assert.notEqual(left.archiveSha256, right.archiveSha256);
  }

  assert.equal(result.contrastReceipt.visualTriplets.length, 2);
  for (const triplet of result.contrastReceipt.visualTriplets) {
    const candidates = triplet.blindLabels.map((label) => byLabel.get(label));
    for (let slideIndex = 0; slideIndex < 3; slideIndex += 1) {
      const visibleText = candidates.map((candidate) =>
        slideTexts(candidate.slides[slideIndex].archiveBytes));
      assert.equal(visibleText[0].length, 3);
      assert.deepEqual(visibleText[1], visibleText[0]);
      assert.deepEqual(visibleText[2], visibleText[0]);
      assert.equal(new Set(candidates.map((candidate) =>
        candidate.slides[slideIndex].archiveSha256)).size, 3);
    }
  }
});

test("blind files and public metadata do not disclose treatment names or the P1 strategy id", () => {
  const result = prepareControlledComparisonMatrix(matrixInputs());
  const forbidden = [
    "causal",
    "proof-led-decision",
    "restrained-generic",
    "subject-grounded",
    "topic-decorated",
    "permuted-order"
  ];
  const publicMetadata = JSON.stringify({
    matrixReceipt: result.matrixReceipt,
    contrastReceipt: result.contrastReceipt,
    reviewOrders: result.reviewOrders,
    reviewCells: result.reviewCells
  }).toLowerCase();
  for (const token of forbidden) assert.doesNotMatch(publicMetadata, new RegExp(token, "u"));
  for (const candidate of result.candidates) {
    const archiveText = blindArchiveText(candidate.archiveBytes);
    for (const token of forbidden) assert.doesNotMatch(archiveText, new RegExp(token, "u"));
  }
});

test("delivery is an evaluation context over byte-identical candidates", () => {
  const result = prepareControlledComparisonMatrix(matrixInputs());
  for (const candidate of result.candidates) {
    const cells = result.reviewCells.filter((cell) => cell.blindLabel === candidate.blindLabel);
    assert.equal(cells.length, 2);
    assert.deepEqual(cells.map((cell) => cell.deliveryProfile.deliveryMode).sort(), [
      "leave-behind", "live-room"
    ]);
    assert.ok(cells.every((cell) => cell.archiveSha256 === candidate.archiveSha256));
    assert.notEqual(cells[0].deliveryProfile.profileSha256, cells[1].deliveryProfile.profileSha256);
    assert.deepEqual(
      cells[0].deliveryProfile.slides,
      cells[1].deliveryProfile.slides
    );
  }
});

test("rerandomizing changes labels and review order without rebuilding any deck", () => {
  const first = prepareControlledComparisonMatrix(matrixInputs());
  const second = prepareControlledComparisonMatrix(matrixInputs({
    randomizationSeed: Buffer.alloc(32, 9)
  }));
  assert.deepEqual(
    first.candidates.map((candidate) => candidate.archiveSha256).sort(),
    second.candidates.map((candidate) => candidate.archiveSha256).sort()
  );
  assert.notDeepEqual(
    first.candidates.map((candidate) => candidate.archiveSha256),
    second.candidates.map((candidate) => candidate.archiveSha256)
  );
  assert.notEqual(first.matrixReceipt.seedCommitmentSha256, second.matrixReceipt.seedCommitmentSha256);
  assert.notEqual(first.matrixReceipt.matrixReceiptSha256, second.matrixReceipt.matrixReceiptSha256);
});

test("the all-arm render handoff is authentic, mutation-bound, and one shot", () => {
  const matrix = prepareControlledComparisonMatrix(matrixInputs());
  const renderBatch = consumeControlledComparisonRenderBatch({
    candidates: matrix.candidates,
    matrixReceipt: matrix.matrixReceipt,
    matrixToken: matrix.matrixToken
  });
  const captured = captureAuthenticatedControlledRenderBatch(renderBatch);
  assert.equal(captured.candidates.length, 6);
  assert.equal(
    captured.renderBatchReceipt.matrixReceiptSha256,
    matrix.matrixReceipt.matrixReceiptSha256
  );
  assert.throws(
    () => consumeControlledComparisonRenderBatch({
      candidates: matrix.candidates,
      matrixReceipt: matrix.matrixReceipt,
      matrixToken: matrix.matrixToken
    }),
    (error) => assertControlledError(error, "/options/matrixToken")
  );
  assert.throws(
    () => captureAuthenticatedControlledRenderBatch({ ...renderBatch }),
    (error) => assertControlledError(error, "/renderBatch")
  );
});

test("mutated candidate bytes cannot cross the render boundary", () => {
  const matrix = prepareControlledComparisonMatrix(matrixInputs());
  matrix.candidates[0].archiveBytes[0] ^= 0xff;
  assert.throws(
    () => consumeControlledComparisonRenderBatch({
      candidates: matrix.candidates,
      matrixReceipt: matrix.matrixReceipt,
      matrixToken: matrix.matrixToken
    }),
    (error) => assertControlledError(error, "/options/candidates/0")
  );
});

test("arm injection, invalid seed, stale planning authority, and source corruption fail closed", () => {
  assert.throws(
    () => prepareControlledComparisonMatrix({ ...matrixInputs(), arms: [] }),
    (error) => assertControlledError(error, "/options")
  );
  assert.throws(
    () => prepareControlledComparisonMatrix(matrixInputs({ randomizationSeed: Buffer.alloc(31) })),
    (error) => assertControlledError(error, "/options/randomizationSeed")
  );

  const staleAcceptance = structuredClone(fixtureInputs.planningAcceptance);
  staleAcceptance.rawInputSha256 = "0".repeat(64);
  assert.throws(
    () => prepareControlledComparisonMatrix(matrixInputs({ planningAcceptance: staleAcceptance })),
    (error) => assertControlledError(error, "/planningSelection")
  );

  const corrupt = Buffer.from(baseArchive.bytes);
  corrupt[corrupt.length - 1] ^= 0xff;
  assert.throws(
    () => prepareControlledComparisonMatrix(matrixInputs({ baseSourceArchiveBytes: corrupt })),
    (error) => assertControlledError(error, "/options/baseSourceArchiveBytes")
  );
});

test("the comparison remains a one-way lab dependency", async () => {
  const coreFiles = [
    "../packages/core/src/create-only-assembly.mjs",
    "../packages/core/src/ordered-slide-assembly.mjs"
  ];
  for (const relativePath of coreFiles) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.doesNotMatch(source, /controlled-comparison|labs\//u);
  }
});
