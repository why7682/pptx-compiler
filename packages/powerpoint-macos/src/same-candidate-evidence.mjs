import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  CANDIDATE_BUILD_RECORD_MAX_BYTES,
  verifyCandidateBuildRecord
} from "../../core/src/candidate-build-record.mjs";
import { parseSecureZip, SECURE_ZIP_LIMITS } from "../../core/src/secure-zip.mjs";

export const SAME_CANDIDATE_EVIDENCE_VERSION = "0.1.0";

const MAX_PDF_BYTES = 64 * 1024 * 1024;
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 64 * 1024 * 1024;
const MAX_TEXTS_PER_SLIDE = 32;
const MAX_TEXT_BYTES = 8 * 1024;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const CONTRACT_REFERENCE = /^urn:[a-z0-9][a-z0-9:._-]{0,255}$/u;
const POWERPOINT_VERSION = /^[0-9]+(?:\.[0-9]+){1,3}$/u;
const SAFE_FILE_NAME = /^[A-Za-z0-9._-]{1,255}$/u;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer"
).get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength"
).get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset"
).get;
const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength"
).get;
const ARRAY_BUFFER_RESIZABLE_GETTER = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "resizable"
)?.get;
const BUFFER_FROM = Buffer.from.bind(Buffer);
const BUFFER_EQUALS = Buffer.prototype.equals;
const HAS_OWN = Object.hasOwn;
const REFLECT_APPLY = Reflect.apply;
const Uint8ArrayConstructor = Uint8Array;

export class SameCandidateEvidenceError extends TypeError {
  constructor(pointer) {
    super(`SAME_CANDIDATE_EVIDENCE_INVALID at ${pointer}`);
    this.name = "SameCandidateEvidenceError";
    this.code = "SAME_CANDIDATE_EVIDENCE_INVALID";
    this.pointer = pointer;
  }
}

function fail(pointer) {
  throw new SameCandidateEvidenceError(pointer);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactRecord(value, keys, pointer) {
  let prototype;
  let descriptors;
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value) ||
        utilTypes.isProxy(value)) {
      fail(pointer);
    }
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    if (error instanceof SameCandidateEvidenceError) throw error;
    fail(pointer);
  }
  if (prototype !== Object.prototype && prototype !== null) fail(pointer);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length ||
      actual.some((key) => typeof key !== "string" || !keys.includes(key))) {
    fail(pointer);
  }
  const fields = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) ||
        descriptor.enumerable !== true) {
      fail(`${pointer}/${key}`);
    }
    fields[key] = descriptor.value;
  }
  return fields;
}

function exactArray(value, pointer, minimum, maximum) {
  let descriptors;
  try {
    if (!Array.isArray(value) || utilTypes.isProxy(value) ||
        Object.getPrototypeOf(value) !== Array.prototype) {
      fail(pointer);
    }
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    if (error instanceof SameCandidateEvidenceError) throw error;
    fail(pointer);
  }
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length < minimum || length > maximum ||
      Reflect.ownKeys(descriptors).length !== length + 1) {
    fail(`${pointer}/length`);
  }
  return Array.from({ length }, (_, index) => {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) ||
        descriptor.enumerable !== true) {
      fail(`${pointer}/${index}`);
    }
    return descriptor.value;
  });
}

function semanticId(value, pointer) {
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) {
    fail(pointer);
  }
  return value;
}

function digest(value, pointer) {
  if (typeof value !== "string" || !SHA256.test(value)) fail(pointer);
  return value;
}

function fileName(value, pointer, extension) {
  if (typeof value !== "string" || !SAFE_FILE_NAME.test(value) ||
      !value.toLowerCase().endsWith(extension)) {
    fail(pointer);
  }
  return value;
}

function snapshotBuffer(value, pointer, maximum) {
  try {
    if (utilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Buffer.prototype ||
        !Buffer.isBuffer(value) ||
        ["buffer", "byteLength", "byteOffset", "length"].some((key) => HAS_OWN(value, key))) {
      fail(pointer);
    }
    const backing = REFLECT_APPLY(TYPED_ARRAY_BUFFER_GETTER, value, []);
    const byteLength = REFLECT_APPLY(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    const byteOffset = REFLECT_APPLY(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
    if (utilTypes.isSharedArrayBuffer(backing) || !utilTypes.isArrayBuffer(backing) ||
        HAS_OWN(backing, "byteLength") || HAS_OWN(backing, "resizable")) {
      fail(pointer);
    }
    const backingByteLength = REFLECT_APPLY(ARRAY_BUFFER_BYTE_LENGTH_GETTER, backing, []);
    const resizable = ARRAY_BUFFER_RESIZABLE_GETTER === undefined
      ? false
      : REFLECT_APPLY(ARRAY_BUFFER_RESIZABLE_GETTER, backing, []);
    if (resizable === true || !Number.isSafeInteger(byteLength) || byteLength < 1 ||
        byteLength > maximum || !Number.isSafeInteger(byteOffset) || byteOffset < 0 ||
        !Number.isSafeInteger(backingByteLength) ||
        byteOffset + byteLength > backingByteLength) {
      fail(pointer);
    }
    const snapshot = BUFFER_FROM(
      new Uint8ArrayConstructor(backing, byteOffset, byteLength)
    );
    if (snapshot.byteLength !== byteLength) fail(pointer);
    return snapshot;
  } catch (error) {
    if (error instanceof SameCandidateEvidenceError) throw error;
    fail(pointer);
  }
}

function freezeTree(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freezeTree(child, seen);
  return Object.freeze(value);
}

function sameJsonValue(left, right) {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" ||
      typeof right !== "object") return false;
  const leftArray = Array.isArray(left);
  if (leftArray !== Array.isArray(right)) return false;
  if (leftArray) {
    return left.length === right.length &&
      left.every((entry, index) => sameJsonValue(entry, right[index]));
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) =>
    HAS_OWN(right, key) && sameJsonValue(left[key], right[key]));
}

function snapshotJson(value, pointer, state = { nodes: 0, bytes: 0 }, depth = 0) {
  state.nodes += 1;
  if (state.nodes > 2_048 || depth > 24) fail(pointer);
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(pointer);
    return value;
  }
  if (typeof value === "string") {
    state.bytes += Buffer.byteLength(value, "utf8");
    if (state.bytes > 512 * 1024) fail(pointer);
    return value;
  }
  if (typeof value !== "object" || utilTypes.isProxy(value)) fail(pointer);
  if (Array.isArray(value)) {
    const values = exactArray(value, pointer, 0, 512);
    return values.map((entry, index) => snapshotJson(
      entry,
      `${pointer}/${index}`,
      state,
      depth + 1
    ));
  }
  let keys;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) fail(pointer);
    keys = Reflect.ownKeys(value);
  } catch (error) {
    if (error instanceof SameCandidateEvidenceError) throw error;
    fail(pointer);
  }
  if (keys.length > 128 || keys.some((key) => typeof key !== "string")) fail(pointer);
  const fields = exactRecord(value, keys, pointer);
  const output = Object.create(null);
  for (const key of keys) {
    state.bytes += Buffer.byteLength(key, "utf8");
    if (state.bytes > 512 * 1024) fail(pointer);
    output[key] = snapshotJson(fields[key], `${pointer}/${key}`, state, depth + 1);
  }
  return output;
}

function canonicalDigest(value) {
  return sha256(Buffer.from(JSON.stringify(value), "utf8"));
}

function textArray(value, pointer) {
  return Object.freeze(exactArray(value, pointer, 1, MAX_TEXTS_PER_SLIDE)
    .map((entry, index) => {
      if (typeof entry !== "string" || entry.length < 1 ||
          Buffer.byteLength(entry, "utf8") > MAX_TEXT_BYTES ||
          /[\u0000-\u0009\u000b-\u001f\u007f]/u.test(entry)) {
        fail(`${pointer}/${index}`);
      }
      return entry;
    }));
}

function validatePdf(bytes, pointer) {
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-" ||
      !bytes.subarray(Math.max(0, bytes.length - 1024)).includes(Buffer.from("%%EOF"))) {
    fail(pointer);
  }
}

function pngFacts(bytes, pointer) {
  if (bytes.length < 33 ||
      !REFLECT_APPLY(BUFFER_EQUALS, bytes.subarray(0, 8), [PNG_SIGNATURE]) ||
      bytes.readUInt32BE(8) !== 13 || bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    fail(pointer);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1200 || width > 20_000 || height < 1 || height > 20_000 ||
      width / height < 1.70 || width / height > 1.80) {
    fail(`${pointer}/dimensions`);
  }
  return Object.freeze({ width, height });
}

function captureCandidate(value) {
  const fields = exactRecord(value, [
    "candidateBytes", "candidateRecordBytes", "candidateFileName"
  ], "/options/candidate");
  const candidateFileName = fileName(
    fields.candidateFileName,
    "/options/candidate/candidateFileName",
    ".pptx"
  );
  const candidateBytes = snapshotBuffer(
    fields.candidateBytes,
    "/options/candidate/candidateBytes",
    SECURE_ZIP_LIMITS.maxArchiveBytes
  );
  const candidateRecordBytes = snapshotBuffer(
    fields.candidateRecordBytes,
    "/options/candidate/candidateRecordBytes",
    CANDIDATE_BUILD_RECORD_MAX_BYTES
  );
  let verified;
  try {
    verified = verifyCandidateBuildRecord({
      candidateBytes,
      recordBytes: candidateRecordBytes,
      candidateFileName
    });
  } catch {
    fail("/options/candidate");
  }
  const slides = verified.record.deck?.slides;
  if (verified.record.verificationProfile !== "authenticated-ordered-candidate-artifact" ||
      verified.record.sourceArtifactType !== "ordered-assembled-pptx" ||
      !Array.isArray(slides) || slides.length < 2 || slides.length > 11) {
    fail("/options/candidate/candidateRecordBytes");
  }
  const slideIds = Object.freeze(slides.map((slide, index) =>
    semanticId(slide.slideId, `/options/candidate/slides/${index}/slideId`)));
  if (new Set(slideIds).size !== slideIds.length) fail("/options/candidate/slides");
  return Object.freeze({
    candidateBytes,
    candidateRecordBytes,
    candidateFileName,
    candidateSha256: verified.candidateSha256,
    candidateRecordSha256: verified.recordSha256,
    slideIds
  });
}

function captureCompatibility(value, candidate) {
  const fields = exactRecord(value, [
    "evidence", "roundtripBytes", "beforePdfBytes", "afterPdfBytes"
  ], "/options/compatibility");
  const roundtripBytes = snapshotBuffer(
    fields.roundtripBytes,
    "/options/compatibility/roundtripBytes",
    SECURE_ZIP_LIMITS.maxArchiveBytes
  );
  const beforePdfBytes = snapshotBuffer(
    fields.beforePdfBytes,
    "/options/compatibility/beforePdfBytes",
    MAX_PDF_BYTES
  );
  const afterPdfBytes = snapshotBuffer(
    fields.afterPdfBytes,
    "/options/compatibility/afterPdfBytes",
    MAX_PDF_BYTES
  );
  try {
    parseSecureZip(roundtripBytes);
  } catch {
    fail("/options/compatibility/roundtripBytes");
  }
  validatePdf(beforePdfBytes, "/options/compatibility/beforePdfBytes");
  validatePdf(afterPdfBytes, "/options/compatibility/afterPdfBytes");

  const evidence = exactRecord(fields.evidence, [
    "probeVersion", "status", "operation", "application", "candidate",
    "slides", "output", "receipt"
  ], "/options/compatibility/evidence");
  const application = exactRecord(evidence.application, ["name", "version"],
    "/options/compatibility/evidence/application");
  if (evidence.probeVersion !== "0.1.0" || evidence.status !== "passed" ||
      evidence.operation !== "ordered-deck-open-save-reopen" ||
      application.name !== "Microsoft PowerPoint" ||
      typeof application.version !== "string" || !POWERPOINT_VERSION.test(application.version)) {
    fail("/options/compatibility/evidence");
  }
  const candidateFacts = exactRecord(evidence.candidate, [
    "fileName", "probeCarrierFileName", "sha256", "candidateRecordSha256"
  ], "/options/compatibility/evidence/candidate");
  fileName(candidateFacts.fileName, "/options/compatibility/evidence/candidate/fileName", ".pptx");
  fileName(candidateFacts.probeCarrierFileName,
    "/options/compatibility/evidence/candidate/probeCarrierFileName", ".pptx");
  if (candidateFacts.fileName !== candidate.candidateFileName ||
      candidateFacts.probeCarrierFileName !== candidate.candidateFileName ||
      candidateFacts.sha256 !== candidate.candidateSha256 ||
      candidateFacts.candidateRecordSha256 !== candidate.candidateRecordSha256) {
    fail("/options/compatibility/evidence/candidate");
  }
  const slideEntries = exactArray(
    evidence.slides,
    "/options/compatibility/evidence/slides",
    candidate.slideIds.length,
    candidate.slideIds.length
  ).map((entry, index) => {
    const pointer = `/options/compatibility/evidence/slides/${index}`;
    const slide = exactRecord(entry, ["slideId", "sourceTexts", "reopenedTexts"], pointer);
    const sourceTexts = textArray(slide.sourceTexts, `${pointer}/sourceTexts`);
    const reopenedTexts = textArray(slide.reopenedTexts, `${pointer}/reopenedTexts`);
    if (slide.slideId !== candidate.slideIds[index] ||
        !sameJsonValue(sourceTexts, reopenedTexts)) {
      fail(pointer);
    }
    return Object.freeze({ slideId: slide.slideId, sourceTexts, reopenedTexts });
  });
  const output = exactRecord(evidence.output, [
    "roundtripFileName", "beforePdfFileName", "afterPdfFileName",
    "roundtripSha256", "beforePdfSha256", "afterPdfSha256"
  ], "/options/compatibility/evidence/output");
  fileName(output.roundtripFileName,
    "/options/compatibility/evidence/output/roundtripFileName", ".pptx");
  fileName(output.beforePdfFileName,
    "/options/compatibility/evidence/output/beforePdfFileName", ".pdf");
  fileName(output.afterPdfFileName,
    "/options/compatibility/evidence/output/afterPdfFileName", ".pdf");
  if (digest(output.roundtripSha256,
    "/options/compatibility/evidence/output/roundtripSha256") !== sha256(roundtripBytes) ||
      digest(output.beforePdfSha256,
        "/options/compatibility/evidence/output/beforePdfSha256") !== sha256(beforePdfBytes) ||
      digest(output.afterPdfSha256,
        "/options/compatibility/evidence/output/afterPdfSha256") !== sha256(afterPdfBytes)) {
    fail("/options/compatibility/evidence/output");
  }
  const receipt = exactRecord(evidence.receipt, [
    "receiptVersion", "receiptType", "candidateSha256", "candidateRecordSha256",
    "supportMatrixItemId", "evidenceRecordId", "operation", "status"
  ], "/options/compatibility/evidence/receipt");
  if (receipt.receiptVersion !== "0.1.0" || receipt.receiptType !== "compatibility" ||
      receipt.candidateSha256 !== candidate.candidateSha256 ||
      receipt.candidateRecordSha256 !== candidate.candidateRecordSha256 ||
      receipt.supportMatrixItemId !== "macos-powerpoint-automation" ||
      typeof receipt.evidenceRecordId !== "string" ||
      !CONTRACT_REFERENCE.test(receipt.evidenceRecordId) ||
      receipt.operation !== evidence.operation || receipt.status !== "passed") {
    fail("/options/compatibility/evidence/receipt");
  }
  return Object.freeze({
    application: Object.freeze({ name: application.name, version: application.version }),
    slideEntries: Object.freeze(slideEntries),
    output: Object.freeze({
      roundtripSha256: output.roundtripSha256,
      beforePdfSha256: output.beforePdfSha256,
      afterPdfSha256: output.afterPdfSha256
    }),
    receipt: freezeTree({ ...receipt })
  });
}

function capturePageSet(value, pointer, candidate, totalState) {
  return Object.freeze(exactArray(value, pointer, candidate.slideIds.length,
    candidate.slideIds.length).map((entry, index) => {
    const pagePointer = `${pointer}/${index}`;
    const fields = exactRecord(entry, ["slideId", "imageId", "bytes"], pagePointer);
    if (fields.slideId !== candidate.slideIds[index]) fail(`${pagePointer}/slideId`);
    const imageId = semanticId(fields.imageId, `${pagePointer}/imageId`);
    const remaining = MAX_TOTAL_IMAGE_BYTES - totalState.bytes;
    if (remaining < 1) fail("/options/render");
    const bytes = snapshotBuffer(
      fields.bytes,
      `${pagePointer}/bytes`,
      Math.min(MAX_IMAGE_BYTES, remaining)
    );
    totalState.bytes += bytes.byteLength;
    const dimensions = pngFacts(bytes, `${pagePointer}/bytes`);
    return Object.freeze({
      slideId: fields.slideId,
      imageId,
      bytes,
      width: dimensions.width,
      height: dimensions.height,
      byteLength: bytes.byteLength,
      sha256: sha256(bytes)
    });
  }));
}

function captureRender(value, candidate) {
  const fields = exactRecord(value, ["rendererId", "beforePages", "afterPages"],
    "/options/render");
  const rendererId = semanticId(fields.rendererId, "/options/render/rendererId");
  const totalState = { bytes: 0 };
  const beforePages = capturePageSet(
    fields.beforePages,
    "/options/render/beforePages",
    candidate,
    totalState
  );
  const afterPages = capturePageSet(
    fields.afterPages,
    "/options/render/afterPages",
    candidate,
    totalState
  );
  const allImageIds = [...beforePages, ...afterPages].map((page) => page.imageId);
  if (new Set(allImageIds).size !== allImageIds.length) fail("/options/render");
  const slides = Object.freeze(candidate.slideIds.map((slideId, index) => {
    const before = beforePages[index];
    const after = afterPages[index];
    if (before.width !== after.width || before.height !== after.height ||
        before.byteLength !== after.byteLength ||
        !REFLECT_APPLY(BUFFER_EQUALS, before.bytes, [after.bytes])) {
      fail(`/options/render/afterPages/${index}`);
    }
    const reviewImageId = [before.imageId, after.imageId].sort(compareCodeUnits)[0];
    return Object.freeze({
      slideId,
      beforeImage: Object.freeze({
        imageId: before.imageId,
        width: before.width,
        height: before.height,
        byteLength: before.byteLength,
        sha256: before.sha256
      }),
      afterImage: Object.freeze({
        imageId: after.imageId,
        width: after.width,
        height: after.height,
        byteLength: after.byteLength,
        sha256: after.sha256
      }),
      relation: "exact-byte-equal",
      reviewImageId
    });
  }));
  return Object.freeze({ rendererId, slides });
}

function buildManifest(candidate, compatibility, render) {
  const renderSetFacts = {
    candidateSha256: candidate.candidateSha256,
    candidateRecordSha256: candidate.candidateRecordSha256,
    beforePdfSha256: compatibility.output.beforePdfSha256,
    afterPdfSha256: compatibility.output.afterPdfSha256,
    rendererId: render.rendererId,
    slides: render.slides
  };
  const renderSetId = `render-${canonicalDigest(renderSetFacts)}`;
  const base = {
    manifestVersion: SAME_CANDIDATE_EVIDENCE_VERSION,
    manifestType: "same-candidate-evidence-manifest",
    candidate: {
      fileName: candidate.candidateFileName,
      sha256: candidate.candidateSha256,
      candidateRecordSha256: candidate.candidateRecordSha256
    },
    compatibility: {
      evidenceRecordId: compatibility.receipt.evidenceRecordId,
      operation: compatibility.receipt.operation,
      applicationName: compatibility.application.name,
      applicationVersion: compatibility.application.version,
      roundtripSha256: compatibility.output.roundtripSha256,
      beforePdfSha256: compatibility.output.beforePdfSha256,
      afterPdfSha256: compatibility.output.afterPdfSha256
    },
    render: {
      rendererId: render.rendererId,
      renderSetId,
      slides: render.slides
    }
  };
  return freezeTree({ ...base, manifestSha256: canonicalDigest(base) });
}

function captureInputs(options) {
  const fields = exactRecord(options, ["candidate", "compatibility", "render"], "/options");
  const candidate = captureCandidate(fields.candidate);
  const compatibility = captureCompatibility(fields.compatibility, candidate);
  const render = captureRender(fields.render, candidate);
  return Object.freeze({ candidate, compatibility, render });
}

export function createSameCandidateEvidenceManifest(options) {
  const captured = captureInputs(options);
  return buildManifest(captured.candidate, captured.compatibility, captured.render);
}

function capturePixelReview(value, manifest) {
  const fields = exactRecord(value, [
    "reviewVersion", "reviewType", "manifestSha256", "renderSetId",
    "reviewedImageIds", "reviewerMode", "status", "verdict", "blockerCount",
    "majorCount"
  ], "/options/pixelReview");
  const expectedImageIds = manifest.render.slides.map((slide) => slide.reviewImageId);
  const reviewedImageIds = exactArray(
    fields.reviewedImageIds,
    "/options/pixelReview/reviewedImageIds",
    expectedImageIds.length,
    expectedImageIds.length
  ).map((imageId, index) => semanticId(
    imageId,
    `/options/pixelReview/reviewedImageIds/${index}`
  ));
  if (fields.reviewVersion !== "0.1.0" ||
      fields.reviewType !== "independent-pixel-review" ||
      fields.manifestSha256 !== manifest.manifestSha256 ||
      fields.renderSetId !== manifest.render.renderSetId ||
      !sameJsonValue(reviewedImageIds, expectedImageIds) ||
      fields.reviewerMode !== "independent-pixel-only" || fields.status !== "pass" ||
      fields.verdict !== "pass" || fields.blockerCount !== 0 || fields.majorCount !== 0) {
    fail("/options/pixelReview");
  }
  return Object.freeze({ reviewedImageIds: Object.freeze(reviewedImageIds) });
}

/**
 * Recompute and inspect one complete evidence relation. This is deliberately a
 * non-authorizing data boundary: it returns no receipt token, authenticator, or
 * publication capability. Only the fixed trusted-local bridge may translate a
 * successful inspection into its private, same-process receipt authority.
 */
export function inspectSameCandidateEvidence(options) {
  const fields = exactRecord(options, [
    "candidate", "compatibility", "render", "manifest", "pixelReview"
  ], "/options");
  const captured = captureInputs({
    candidate: fields.candidate,
    compatibility: fields.compatibility,
    render: fields.render
  });
  const expectedManifest = buildManifest(
    captured.candidate,
    captured.compatibility,
    captured.render
  );
  const suppliedManifest = snapshotJson(fields.manifest, "/options/manifest");
  if (!sameJsonValue(suppliedManifest, expectedManifest)) fail("/options/manifest");
  const pixelReview = capturePixelReview(fields.pixelReview, expectedManifest);
  return freezeTree({
    evidenceVersion: SAME_CANDIDATE_EVIDENCE_VERSION,
    evidenceType: "same-candidate-evidence-facts",
    authority: "none",
    deliveryEligible: false,
    candidate: {
      fileName: captured.candidate.candidateFileName,
      sha256: captured.candidate.candidateSha256,
      candidateRecordSha256: captured.candidate.candidateRecordSha256
    },
    slideIds: [...captured.candidate.slideIds],
    compatibilityReceipt: { ...captured.compatibility.receipt },
    renderSetId: expectedManifest.render.renderSetId,
    reviewedImageIds: [...pixelReview.reviewedImageIds],
    manifest: expectedManifest
  });
}
