import assert from "node:assert/strict";
import {
  lstat,
  mkdtemp,
  readFile,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyCandidateBuildRecord } from
  "../packages/core/src/candidate-build-record.mjs";
import {
  createOrderedPowerPointCompatibilityReceipt,
  OrderedPowerPointCompatibilityError,
  parseOrderedPowerPointProbeTranscript
} from "../packages/powerpoint-macos/src/ordered-compatibility-receipt.mjs";
import {
  createPublicMixedOrderedCompatibilityCandidate,
  createPublicOrderedCompatibilityCandidate,
  runOrderedPowerPointCompatibilityCli,
  writeStablePowerPointProbeCarrier
} from "../scripts/run-ordered-powerpoint-compatibility.mjs";

const FIELD = "\u001d";
const SLIDE = "\u001e";
const TEXT = "\u001f";
const expectedSlides = [
  {
    slideId: "ordered-compatibility-one",
    texts: ["First ordered takeaway", "First bounded evidence statement"]
  },
  {
    slideId: "ordered-compatibility-two",
    texts: ["Second ordered takeaway", "Second bounded evidence statement"]
  }
];

function inventory(slides = expectedSlides) {
  return slides.map((slide) => slide.texts.map((value) => `${value}\r`).join(TEXT)).join(SLIDE);
}

function transcript(overrides = {}) {
  return [
    overrides.version ?? "16.111.3",
    overrides.sourceCount ?? "2",
    overrides.reopenedCount ?? "2",
    overrides.sourceTexts ?? inventory(),
    overrides.reopenedTexts ?? inventory()
  ].join(FIELD) + "\n";
}

function createReceipt(overrides = {}) {
  return createOrderedPowerPointCompatibilityReceipt({
    candidateSha256: "a".repeat(64),
    candidateRecordSha256: "b".repeat(64),
    evidenceRecordId: "urn:pptx-compiler:compatibility:ordered-clone-fill-local-001",
    expectedSlides,
    transcript: transcript(),
    ...overrides
  });
}

function assertProbeError(error, pointer) {
  assert.ok(error instanceof OrderedPowerPointCompatibilityError);
  assert.equal(error.code, "ORDERED_POWERPOINT_COMPATIBILITY_INVALID");
  assert.equal(error.pointer, pointer);
  return true;
}

test("the fixed public ordered compatibility candidate is authentic and deterministic", async () => {
  const [first, second] = await Promise.all([
    createPublicOrderedCompatibilityCandidate(),
    createPublicOrderedCompatibilityCandidate()
  ]);
  assert.deepEqual(second, first);
  const verified = verifyCandidateBuildRecord({
    candidateBytes: first.candidateBytes,
    recordBytes: first.candidateRecordBytes,
    candidateFileName: first.candidateFileName
  });
  assert.deepEqual(verified.record.deck.slides.map((slide) => slide.slideId),
    expectedSlides.map((slide) => slide.slideId));
  assert.deepEqual(first.expectedSlides, expectedSlides);
});

test("the fixed mixed candidate keeps all three typed source-build roles", async () => {
  const [first, second] = await Promise.all([
    createPublicMixedOrderedCompatibilityCandidate(),
    createPublicMixedOrderedCompatibilityCandidate()
  ]);
  assert.deepEqual(second, first);
  const verified = verifyCandidateBuildRecord({
    candidateBytes: first.candidateBytes,
    recordBytes: first.candidateRecordBytes,
    candidateFileName: first.candidateFileName
  });
  assert.deepEqual(verified.record.deck.slides.map((slide) =>
    slide.sourceBuild.buildType), [
    "clone-fill-source",
    "native-omml-formula-source",
    "native-card-arrow-source"
  ]);
  assert.deepEqual(first.expectedSlides.map((slide) => slide.slideId), [
    "mixed-setup",
    "mixed-evidence",
    "mixed-resolution"
  ]);
});

test("the PowerPoint probe carrier reuses one file identity while replacing exact bytes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pptx-probe-carrier-"));
  const carrierPath = path.join(root, "ordered-compatibility-source.pptx");
  try {
    const firstBytes = Buffer.from("first public synthetic candidate", "utf8");
    const secondBytes = Buffer.from("second public synthetic candidate with a new length", "utf8");
    assert.equal(await writeStablePowerPointProbeCarrier(carrierPath, firstBytes), "created");
    const created = await lstat(carrierPath);
    assert.equal(await writeStablePowerPointProbeCarrier(carrierPath, firstBytes), "reused");
    assert.equal(await writeStablePowerPointProbeCarrier(carrierPath, secondBytes),
      "updated-in-place");
    const updated = await lstat(carrierPath);
    assert.equal(updated.dev, created.dev);
    assert.equal(updated.ino, created.ino);
    assert.ok((await readFile(carrierPath)).equals(secondBytes));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("PowerPoint transcript preserves readable slide order and text before and after save", () => {
  const result = createReceipt();
  assert.equal(result.probe.applicationVersion, "16.111.3");
  assert.deepEqual(result.slides, expectedSlides.map((slide) => ({
    slideId: slide.slideId,
    sourceTexts: slide.texts,
    reopenedTexts: slide.texts
  })));
  assert.deepEqual(result.receipt, {
    receiptVersion: "0.1.0",
    receiptType: "compatibility",
    candidateSha256: "a".repeat(64),
    candidateRecordSha256: "b".repeat(64),
    supportMatrixItemId: "macos-powerpoint-automation",
    evidenceRecordId: "urn:pptx-compiler:compatibility:ordered-clone-fill-local-001",
    operation: "ordered-deck-open-save-reopen",
    status: "passed"
  });
});

test("semantic drift, slide loss, and malformed transcripts fail closed", async (t) => {
  await t.test("reopened text", () => {
    const changed = structuredClone(expectedSlides);
    changed[1].texts[0] = "Changed after save";
    assert.throws(
      () => createReceipt({ transcript: transcript({ reopenedTexts: inventory(changed) }) }),
      (error) => assertProbeError(error, "/transcript/semanticProjection")
    );
  });
  await t.test("slide count", () => {
    assert.throws(
      () => createReceipt({ transcript: transcript({ reopenedCount: "1" }) }),
      (error) => assertProbeError(error, "/transcript/reopenedSlideCount")
    );
  });
  await t.test("extra field", () => {
    assert.throws(
      () => parseOrderedPowerPointProbeTranscript(`${transcript().trimEnd()}${FIELD}extra`),
      (error) => assertProbeError(error, "/transcript")
    );
  });
});

test("the manual runner is static, stable-rooted, shell-free, and CI-guarded", async () => {
  const source = await readFile(
    new URL("../scripts/run-ordered-powerpoint-compatibility.mjs", import.meta.url),
    "utf8"
  );
  const appleScript = await readFile(
    new URL("../scripts/validate-ordered-powerpoint.applescript", import.meta.url),
    "utf8"
  );
  assert.match(source, /\.private-test-artifacts",\s*"powerpoint-ordered"/u);
  assert.match(source, /spawn\("\/usr\/bin\/osascript"/u);
  assert.match(source, /shell: false/u);
  assert.match(source, /trusted-local-run/u);
  assert.match(source, /GITHUB_ACTIONS/u);
  assert.match(appleScript, /expected absolute POSIX file arguments/u);
  assert.match(appleScript, /applicationWasRunning/u);
  assert.match(appleScript, /path of startupPresentation/u);
  assert.match(appleScript, /PowerPoint must have no user presentations open/u);
  assert.match(appleScript, /PowerPoint presentation set changed during probe/u);
  assert.match(appleScript, /if errorNumber is -9074 then return ""/u);
  assert.doesNotMatch(source, /mkdtemp|tmpdir\(|rm\(/u);
  assert.doesNotMatch(appleScript, /do shell script|run VB macro|System Events/u);
});

test("the manual runner rejects missing trust and every CI environment before probing", async () => {
  const runProbe = () => {
    throw new Error("probe must not run");
  };
  await assert.rejects(
    runOrderedPowerPointCompatibilityCli([], {}, { runProbe }),
    /ORDERED_COMPATIBILITY_EXPLICIT_TRUST_REQUIRED/u
  );
  for (const key of ["CI", "GITHUB_ACTIONS", "GITHUB_EVENT_NAME", "BUILD_BUILDID", "BUILDKITE"]) {
    await assert.rejects(
      runOrderedPowerPointCompatibilityCli(["--trusted-local-run"], { [key]: "1" }, { runProbe }),
      /ORDERED_COMPATIBILITY_CI_FORBIDDEN/u
    );
  }
});
