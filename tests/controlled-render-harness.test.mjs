import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  consumeControlledComparisonRenderBatch,
  prepareControlledComparisonMatrix
} from "../labs/design-planning/controlled-comparison.mjs";
import {
  ControlledRenderHarnessError,
  createControlledRenderTestRunner,
  renderControlledComparisonBatch
} from "../labs/design-planning/controlled-render-harness.mjs";
import { buildSyntheticFixtures } from "../scripts/generate-synthetic-fixtures.mjs";

const fixtureRoot = new URL("../fixtures/", import.meta.url);
const suiteRoot = await mkdtemp(path.join(tmpdir(), "pptx-p3-render-harness."));

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

function makeRenderBatch(seedByte = 7) {
  const matrix = prepareControlledComparisonMatrix({
    approvedPlanningAcceptance: structuredClone(fixtureInputs.approvedPlanningAcceptance),
    baseSourceArchiveBytes: Buffer.from(baseArchive.bytes),
    baseTemplateIndex: structuredClone(fixtureInputs.baseTemplateIndex),
    evidenceInventory: structuredClone(fixtureInputs.evidenceInventory),
    planningAcceptance: structuredClone(fixtureInputs.planningAcceptance),
    randomizationSeed: Buffer.alloc(32, seedByte),
    rawBrief: structuredClone(fixtureInputs.rawBrief),
    templateProfile: structuredClone(fixtureInputs.templateProfile)
  });
  return consumeControlledComparisonRenderBatch({
    candidates: matrix.candidates,
    matrixReceipt: matrix.matrixReceipt,
    matrixToken: matrix.matrixToken
  });
}

function fakePng(width, height) {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  Buffer.from("IHDR", "ascii").copy(bytes, 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function fakeFingerprint() {
  return {
    montageExecutableSha256: "1".repeat(64),
    montageIdentity: "synthetic-montage",
    montageProbeSha256: "2".repeat(64),
    rendererExecutableSha256: "3".repeat(64),
    rendererIdentity: "synthetic-renderer",
    rendererProbeSha256: "4".repeat(64)
  };
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256Json(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function makeFakeRunner(calls = { probes: 0, renders: 0, montages: 0 }) {
  return createControlledRenderTestRunner({
    async probe() {
      calls.probes += 1;
      return fakeFingerprint();
    },
    async render({ inputPath, outputDirectory }) {
      calls.renders += 1;
      await writeFile(path.join(outputDirectory, `${path.basename(inputPath)}.png`),
        fakePng(1600, 900));
    },
    async montage({ outputPath }) {
      calls.montages += 1;
      await writeFile(outputPath, fakePng(2496, 499));
    }
  });
}

function assertHarnessError(error, pointer) {
  assert.ok(error instanceof ControlledRenderHarnessError);
  assert.equal(error.code, "CONTROLLED_RENDER_HARNESS_INVALID");
  assert.equal(error.pointer, pointer);
  return true;
}

test("the stable harness renders all 18 slides and six contact sheets as one batch", async () => {
  const outputRoot = path.join(suiteRoot, "complete");
  const calls = { probes: 0, renders: 0, montages: 0 };
  const renderBatch = makeRenderBatch();
  const result = await renderControlledComparisonBatch({
    outputRoot,
    renderBatch,
    runner: makeFakeRunner(calls)
  });
  assert.equal(result.status, "created");
  assert.equal(calls.probes, 1);
  assert.equal(calls.renders, 18);
  assert.equal(calls.montages, 6);
  assert.equal(result.manifest.runnerClass, "test-double");
  assert.equal(result.manifest.candidateRenders.length, 6);
  assert.ok(result.manifest.candidateRenders.every((candidate) =>
    candidate.slides.length === 3 && candidate.slides.every((slide) =>
      slide.width === 1600 && slide.height === 900)));
  assert.ok((await readFile(path.join(outputRoot, "render-manifest.json"))).length > 0);

  const reuseCalls = { probes: 0, renders: 0, montages: 0 };
  const reused = await renderControlledComparisonBatch({
    outputRoot,
    renderBatch,
    runner: makeFakeRunner(reuseCalls)
  });
  assert.equal(reused.status, "reused");
  assert.deepEqual(reuseCalls, { probes: 0, renders: 0, montages: 0 });
  assert.equal(reused.manifest.manifestSha256, result.manifest.manifestSha256);
});

test("a partial directory is preserved and rejected instead of selectively repaired", async () => {
  const outputRoot = path.join(suiteRoot, "partial");
  await mkdir(outputRoot);
  await writeFile(path.join(outputRoot, "stray.txt"), "partial");
  await assert.rejects(
    renderControlledComparisonBatch({
      outputRoot,
      renderBatch: makeRenderBatch(8),
      runner: makeFakeRunner()
    }),
    (error) => assertHarnessError(error, "/outputRoot/incomplete")
  );
  assert.equal(await readFile(path.join(outputRoot, "stray.txt"), "utf8"), "partial");
});

test("a missing renderer output leaves no authoritative manifest", async () => {
  const outputRoot = path.join(suiteRoot, "missing-output");
  const brokenRunner = createControlledRenderTestRunner({
    async probe() {
      return fakeFingerprint();
    },
    async render() {},
    async montage() {
      assert.fail("montage must not run after a missing slide render");
    }
  });
  await assert.rejects(
    renderControlledComparisonBatch({
      outputRoot,
      renderBatch: makeRenderBatch(9),
      runner: brokenRunner
    }),
    (error) => assertHarnessError(error, "/output/candidates/0/slides/0/render")
  );
  await assert.rejects(readFile(path.join(outputRoot, "render-manifest.json")));
  await assert.rejects(
    renderControlledComparisonBatch({
      outputRoot,
      renderBatch: makeRenderBatch(9),
      runner: makeFakeRunner()
    }),
    (error) => assertHarnessError(error, "/outputRoot/incomplete")
  );
});

test("a renderer sidecar prevents first-run manifest publication", async () => {
  const outputRoot = path.join(suiteRoot, "renderer-sidecar");
  const sidecarRunner = createControlledRenderTestRunner({
    async probe() {
      return fakeFingerprint();
    },
    async render({ inputPath, outputDirectory }) {
      await writeFile(path.join(outputDirectory, `${path.basename(inputPath)}.png`),
        fakePng(1600, 900));
      await writeFile(path.join(outputDirectory, "renderer-sidecar.txt"), "unexpected");
    },
    async montage({ outputPath }) {
      await writeFile(outputPath, fakePng(2496, 499));
    }
  });
  await assert.rejects(
    renderControlledComparisonBatch({
      outputRoot,
      renderBatch: makeRenderBatch(13),
      runner: sidecarRunner
    }),
    (error) => assertHarnessError(error, "/manifest/inventory")
  );
  await assert.rejects(readFile(path.join(outputRoot, "render-manifest.json")));
  assert.equal(await readFile(
    path.join(outputRoot, "renders", "blind-01", "renderer-sidecar.txt"),
    "utf8"
  ), "unexpected");
});

test("tampering with a completed artifact invalidates stable reuse", async () => {
  const outputRoot = path.join(suiteRoot, "tamper");
  const renderBatch = makeRenderBatch(10);
  const result = await renderControlledComparisonBatch({
    outputRoot,
    renderBatch,
    runner: makeFakeRunner()
  });
  const target = result.manifest.candidateRenders[0].slides[0].outputPath;
  await writeFile(path.join(outputRoot, target), fakePng(1600, 901));
  await assert.rejects(
    renderControlledComparisonBatch({
      outputRoot,
      renderBatch,
      runner: makeFakeRunner()
    }),
    (error) => error instanceof ControlledRenderHarnessError &&
      error.pointer.startsWith("/manifest/artifacts/")
  );
});

test("a completed run with an extra artifact is not reusable", async () => {
  const outputRoot = path.join(suiteRoot, "extra-artifact");
  const renderBatch = makeRenderBatch(11);
  await renderControlledComparisonBatch({
    outputRoot,
    renderBatch,
    runner: makeFakeRunner()
  });
  await writeFile(path.join(outputRoot, "unbound-review-note.txt"), "not authoritative");
  await assert.rejects(
    renderControlledComparisonBatch({
      outputRoot,
      renderBatch,
      runner: makeFakeRunner()
    }),
    (error) => assertHarnessError(error, "/manifest/inventory")
  );
});

test("a self-consistent manifest cannot swap candidates away from its authentic batch", async () => {
  const outputRoot = path.join(suiteRoot, "candidate-swap");
  const renderBatch = makeRenderBatch(12);
  await renderControlledComparisonBatch({
    outputRoot,
    renderBatch,
    runner: makeFakeRunner()
  });
  const manifestPath = path.join(outputRoot, "render-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  [manifest.candidateRenders[0], manifest.candidateRenders[1]] =
    [manifest.candidateRenders[1], manifest.candidateRenders[0]];
  const { manifestSha256: ignored, ...core } = manifest;
  void ignored;
  manifest.manifestSha256 = sha256Json(core);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await assert.rejects(
    renderControlledComparisonBatch({
      outputRoot,
      renderBatch,
      runner: makeFakeRunner()
    }),
    (error) => assertHarnessError(error, "/manifest/candidateRenders/0")
  );
});

test("the local runner source pins shell-free commands and no random temp directory", async () => {
  const source = await readFile(
    new URL("../labs/design-planning/controlled-render-harness.mjs", import.meta.url),
    "utf8"
  );
  assert.match(source, /shell: false/u);
  assert.match(source, /"-t", "-s", "1600", "-o"/u);
  assert.doesNotMatch(source, /mkdtemp|PowerPoint|osascript|randomUUID/u);
});
