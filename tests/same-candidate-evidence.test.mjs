import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createOrderedPowerPointCompatibilityReceipt
} from "../packages/powerpoint-macos/src/ordered-compatibility-receipt.mjs";
import * as sameCandidateEvidenceModule from
  "../packages/powerpoint-macos/src/same-candidate-evidence.mjs";
import {
  createSameCandidateEvidenceManifest,
  inspectSameCandidateEvidence,
  SameCandidateEvidenceError
} from "../packages/powerpoint-macos/src/same-candidate-evidence.mjs";
import {
  createPublicMixedOrderedCompatibilityCandidate
} from "../scripts/run-ordered-powerpoint-compatibility.mjs";
import {
  runMixedSameCandidateDeliveryCli
} from "../scripts/run-mixed-same-candidate-delivery.mjs";

const FIELD = "\u001d";
const SLIDE = "\u001e";
const TEXT = "\u001f";
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CI_KEYS = Object.freeze([
  "CI", "GITHUB_ACTIONS", "GITHUB_EVENT_NAME", "BUILD_BUILDID", "BUILDKITE"
]);

function probeLocalBridge(argv, environment) {
  const moduleUrl = new URL(
    "../scripts/run-mixed-same-candidate-delivery.mjs",
    import.meta.url
  ).href;
  const source = `
    import { runMixedSameCandidateDeliveryCli } from ${JSON.stringify(moduleUrl)};
    try {
      await runMixedSameCandidateDeliveryCli(
        ${JSON.stringify(argv)},
        ${JSON.stringify(environment)}
      );
      process.stdout.write("NO_ERROR");
    } catch (error) {
      process.stdout.write(error instanceof Error ? error.message : "NON_ERROR");
    }
  `;
  const childEnvironment = { ...process.env };
  for (const key of CI_KEYS) delete childEnvironment[key];
  const result = spawnSync(process.execPath, [
    "--input-type=module",
    "--eval",
    source
  ], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: childEnvironment,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const candidate = await createPublicMixedOrderedCompatibilityCandidate();

function transcript(expectedSlides = candidate.expectedSlides) {
  const inventory = expectedSlides.map((slide) =>
    slide.texts.map((text) => `${text}\r`).join(TEXT)).join(SLIDE);
  return ["16.111.3", "3", "3", inventory, inventory].join(FIELD) + "\n";
}

function syntheticPdf(label) {
  return Buffer.from(`%PDF-1.4\n${label}\n%%EOF\n`, "utf8");
}

function syntheticPng(width, height, label) {
  const suffix = Buffer.from(label, "utf8");
  const bytes = Buffer.alloc(33 + suffix.length);
  PNG_SIGNATURE.copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[24] = 8;
  bytes[25] = 6;
  suffix.copy(bytes, 33);
  return bytes;
}

function evidenceInputs() {
  const roundtripBytes = Buffer.from(candidate.candidateBytes);
  const beforePdfBytes = syntheticPdf("public synthetic before");
  const afterPdfBytes = syntheticPdf("public synthetic after");
  const authenticated = createOrderedPowerPointCompatibilityReceipt({
    candidateSha256: candidate.candidateSha256,
    candidateRecordSha256: candidate.candidateRecordSha256,
    evidenceRecordId: candidate.evidenceRecordId,
    expectedSlides: candidate.expectedSlides,
    transcript: transcript()
  });
  const evidence = {
    probeVersion: authenticated.probe.probeVersion,
    status: "passed",
    operation: authenticated.receipt.operation,
    application: {
      name: authenticated.probe.applicationName,
      version: authenticated.probe.applicationVersion
    },
    candidate: {
      fileName: candidate.candidateFileName,
      probeCarrierFileName: candidate.candidateFileName,
      sha256: candidate.candidateSha256,
      candidateRecordSha256: candidate.candidateRecordSha256
    },
    slides: authenticated.slides,
    output: {
      roundtripFileName: "public-synthetic-roundtrip.pptx",
      beforePdfFileName: "public-synthetic-before.pdf",
      afterPdfFileName: "public-synthetic-after.pdf",
      roundtripSha256: sha256(roundtripBytes),
      beforePdfSha256: sha256(beforePdfBytes),
      afterPdfSha256: sha256(afterPdfBytes)
    },
    receipt: authenticated.receipt
  };
  const beforePages = candidate.expectedSlides.map((slide, index) => ({
    slideId: slide.slideId,
    imageId: `public-before-${index + 1}`,
    bytes: syntheticPng(1600, 900, `${slide.slideId}-pixels`)
  }));
  const afterPages = beforePages.map((page, index) => ({
    slideId: page.slideId,
    imageId: `public-after-${index + 1}`,
    bytes: Buffer.from(page.bytes)
  }));
  return {
    candidate: {
      candidateBytes: Buffer.from(candidate.candidateBytes),
      candidateRecordBytes: Buffer.from(candidate.candidateRecordBytes),
      candidateFileName: candidate.candidateFileName
    },
    compatibility: { evidence, roundtripBytes, beforePdfBytes, afterPdfBytes },
    render: {
      rendererId: "public-synthetic-pdf-raster",
      beforePages,
      afterPages
    }
  };
}

function pixelReview(manifest, overrides = {}) {
  return {
    reviewVersion: "0.1.0",
    reviewType: "independent-pixel-review",
    manifestSha256: manifest.manifestSha256,
    renderSetId: manifest.render.renderSetId,
    reviewedImageIds: manifest.render.slides.map((slide) => slide.reviewImageId),
    reviewerMode: "independent-pixel-only",
    status: "pass",
    verdict: "pass",
    blockerCount: 0,
    majorCount: 0,
    ...overrides
  };
}

function inspectEvidence(inputs = evidenceInputs(), reviewMutator) {
  const manifest = createSameCandidateEvidenceManifest(inputs);
  const review = pixelReview(manifest);
  reviewMutator?.(review, manifest);
  return inspectSameCandidateEvidence({
    ...inputs,
    manifest,
    pixelReview: review
  });
}

function assertEvidenceError(error, pointer) {
  assert.ok(error instanceof SameCandidateEvidenceError);
  assert.equal(error.code, "SAME_CANDIDATE_EVIDENCE_INVALID");
  assert.equal(error.pointer, pointer);
  return true;
}

test("the manifest keeps the complete same-candidate pixel relation readable", () => {
  const inputs = evidenceInputs();
  const first = createSameCandidateEvidenceManifest(inputs);
  const second = createSameCandidateEvidenceManifest(inputs);
  assert.deepEqual(second, first);
  assert.equal(first.candidate.sha256, candidate.candidateSha256);
  assert.equal(first.compatibility.operation, "ordered-deck-open-save-reopen");
  assert.deepEqual(first.render.slides.map((slide) => ({
    slideId: slide.slideId,
    relation: slide.relation,
    reviewImageId: slide.reviewImageId
  })), candidate.expectedSlides.map((slide, index) => ({
    slideId: slide.slideId,
    relation: "exact-byte-equal",
    reviewImageId: `public-after-${index + 1}`
  })));
  assert.equal(Object.isFrozen(first.render.slides[0]), true);
  assert.doesNotMatch(JSON.stringify(first), /pixels|%PDF|IHDR/u);
});

test("the public inspector cannot mint delivery authority", () => {
  const facts = inspectEvidence();
  assert.equal(facts.authority, "none");
  assert.equal(facts.deliveryEligible, false);
  assert.equal(facts.evidenceType, "same-candidate-evidence-facts");
  assert.equal(facts.candidate.sha256, candidate.candidateSha256);
  assert.deepEqual(facts.slideIds,
    candidate.expectedSlides.map((slide) => slide.slideId));
  assert.equal(Object.hasOwn(facts, "evidence"), false);
  assert.equal(Object.hasOwn(facts, "authenticators"), false);
  assert.equal(Object.hasOwn(
    sameCandidateEvidenceModule,
    "createSameCandidateEvidenceSession"
  ), false);
  assert.equal(Object.isFrozen(facts), true);
});

test("manifest, PDF, pixel, and page drift cannot be mixed into one session", async (t) => {
  await t.test("stale manifest", () => {
    const inputs = evidenceInputs();
    const manifest = createSameCandidateEvidenceManifest(inputs);
    inputs.render.beforePages[0].bytes[33] ^= 1;
    inputs.render.afterPages[0].bytes[33] ^= 1;
    assert.throws(
      () => inspectSameCandidateEvidence({
        ...inputs,
        manifest,
        pixelReview: pixelReview(manifest)
      }),
      (error) => assertEvidenceError(error, "/options/manifest")
    );
  });

  await t.test("PDF binding", () => {
    const inputs = evidenceInputs();
    inputs.compatibility.beforePdfBytes = syntheticPdf("different PDF");
    assert.throws(
      () => createSameCandidateEvidenceManifest(inputs),
      (error) => assertEvidenceError(error, "/options/compatibility/evidence/output")
    );
  });

  await t.test("probe carrier binding", () => {
    const inputs = evidenceInputs();
    inputs.compatibility.evidence.candidate.probeCarrierFileName =
      "different-probe-carrier.pptx";
    assert.throws(
      () => createSameCandidateEvidenceManifest(inputs),
      (error) => assertEvidenceError(
        error,
        "/options/compatibility/evidence/candidate"
      )
    );
  });

  await t.test("pixel coverage", () => {
    assert.throws(
      () => inspectEvidence(evidenceInputs(), (review) => review.reviewedImageIds.pop()),
      (error) => assertEvidenceError(error, "/options/pixelReview/reviewedImageIds/length")
    );
  });

  await t.test("visible major", () => {
    assert.throws(
      () => inspectEvidence(evidenceInputs(), (review) => { review.majorCount = 1; }),
      (error) => assertEvidenceError(error, "/options/pixelReview")
    );
  });

  await t.test("round-trip pixels", () => {
    const inputs = evidenceInputs();
    inputs.render.afterPages[2].bytes[33] ^= 1;
    assert.throws(
      () => createSameCandidateEvidenceManifest(inputs),
      (error) => assertEvidenceError(error, "/options/render/afterPages/2")
    );
  });
});

test("accessors and unsafe backing stores fail before evidence bytes are copied", () => {
  let invoked = false;
  const accessor = evidenceInputs();
  Object.defineProperty(accessor.render.beforePages[0].bytes, "byteLength", {
    configurable: true,
    get() {
      invoked = true;
      return 1;
    }
  });
  assert.throws(
    () => createSameCandidateEvidenceManifest(accessor),
    (error) => assertEvidenceError(error, "/options/render/beforePages/0/bytes")
  );
  assert.equal(invoked, false);

  const proxied = evidenceInputs();
  proxied.compatibility.evidence = new Proxy(proxied.compatibility.evidence, {});
  assert.throws(
    () => createSameCandidateEvidenceManifest(proxied),
    (error) => assertEvidenceError(error, "/options/compatibility/evidence")
  );

  const shared = evidenceInputs();
  const sharedBacking = new SharedArrayBuffer(candidate.candidateBytes.length);
  const sharedCandidate = Buffer.from(sharedBacking);
  candidate.candidateBytes.copy(sharedCandidate);
  shared.candidate.candidateBytes = sharedCandidate;
  assert.throws(
    () => createSameCandidateEvidenceManifest(shared),
    (error) => assertEvidenceError(error, "/options/candidate/candidateBytes")
  );

  const resizableBacking = new ArrayBuffer(candidate.candidateBytes.length, {
    maxByteLength: candidate.candidateBytes.length + 1024
  });
  if (resizableBacking.resizable === true) {
    const resizable = evidenceInputs();
    const resizableCandidate = Buffer.from(resizableBacking);
    candidate.candidateBytes.copy(resizableCandidate);
    resizable.candidate.candidateBytes = resizableCandidate;
    assert.throws(
      () => createSameCandidateEvidenceManifest(resizable),
      (error) => assertEvidenceError(error, "/options/candidate/candidateBytes")
    );
  }
});

test("the local bridge reuses one evidence root and refuses CI before reading it", async () => {
  const source = await readFile(
    new URL("../scripts/run-mixed-same-candidate-delivery.mjs", import.meta.url),
    "utf8"
  );
  assert.match(source, /\.private-test-artifacts",\s*"powerpoint-ordered"/u);
  assert.match(source, /mixed-same-candidate-manifest\.local\.json/u);
  assert.match(source, /mixed-same-candidate-pixel-review\.local\.json/u);
  assert.match(source, /spawn\(pdftoppmPath/u);
  assert.match(source, /spawn\(pdfinfoPath/u);
  assert.match(source, /"-png", "-r", "120"/u);
  assert.match(source, /SAME_CANDIDATE_PDF_PAGE_COUNT_INVALID/u);
  assert.match(source, /\.raster-source-/u);
  assert.match(source, /function createLocalReceiptAuthority/u);
  assert.match(source, /O_NOFOLLOW/u);
  assert.match(source, /handle\.stat\(\{ bigint: true \}\)/u);
  assert.match(source, /readBoundedRegularFile\(/u);
  assert.match(source, /spawnError = error/u);
  assert.match(source, /shell: false/u);
  assert.match(source, /SAME_CANDIDATE_PDFTOPPM_PATH_REQUIRED/u);
  assert.doesNotMatch(source, /mkdtemp|tmpdir\(|osascript|PowerPoint" with timeout/u);
  assert.equal(
    probeLocalBridge([], {}),
    "SAME_CANDIDATE_EXPLICIT_TRUST_REQUIRED"
  );
  for (const key of CI_KEYS) {
    assert.equal(
      probeLocalBridge(["--trusted-local-run"], { [key]: "1" }),
      "SAME_CANDIDATE_CI_FORBIDDEN"
    );
  }
  assert.equal(
    probeLocalBridge(["--trusted-local-run"], {}),
    "SAME_CANDIDATE_PDFTOPPM_PATH_REQUIRED"
  );
  if (CI_KEYS.some((key) => process.env[key])) {
    await assert.rejects(
      runMixedSameCandidateDeliveryCli(["--trusted-local-run"], {}),
      /SAME_CANDIDATE_CI_FORBIDDEN/u
    );
  }
});
