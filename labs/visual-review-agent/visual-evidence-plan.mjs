import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

export const VISUAL_EVIDENCE_PLAN_VERSION = "0.1.0";

const MAX_IMAGES = 64;
const MAX_COMPARISONS = 256;
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 64 * 1024 * 1024;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
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

export class VisualEvidencePlanError extends TypeError {
  constructor(pointer) {
    super(`VISUAL_EVIDENCE_PLAN_INVALID at ${pointer}`);
    this.name = "VisualEvidencePlanError";
    this.code = "VISUAL_EVIDENCE_PLAN_INVALID";
    this.pointer = pointer;
  }
}

function fail(pointer) {
  throw new VisualEvidencePlanError(pointer);
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function closedRecord(value, pointer, keys) {
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
    if (error instanceof VisualEvidencePlanError) throw error;
    fail(pointer);
  }
  if (prototype !== Object.prototype && prototype !== null) fail(pointer);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length ||
      actual.some((key) => typeof key !== "string" || !keys.includes(key))) {
    fail(pointer);
  }
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) ||
        descriptor.enumerable !== true) {
      fail(`${pointer}/${key}`);
    }
    result[key] = descriptor.value;
  }
  return result;
}

function arrayValues(value, pointer, minimum, maximum) {
  let descriptors;
  try {
    if (!Array.isArray(value) || utilTypes.isProxy(value) ||
        Object.getPrototypeOf(value) !== Array.prototype) {
      fail(pointer);
    }
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    if (error instanceof VisualEvidencePlanError) throw error;
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
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) fail(pointer);
  return value;
}

function snapshotImageBytes(value, pointer, remainingTotalBytes) {
  try {
    if (utilTypes.isProxy(value)) fail(pointer);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Buffer.prototype && prototype !== Uint8Array.prototype) fail(pointer);
    if (!utilTypes.isUint8Array(value) ||
        ["buffer", "byteLength", "byteOffset", "length"].some((key) => HAS_OWN(value, key))) {
      fail(pointer);
    }

    const buffer = REFLECT_APPLY(TYPED_ARRAY_BUFFER_GETTER, value, []);
    const byteLength = REFLECT_APPLY(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    const byteOffset = REFLECT_APPLY(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
    if (utilTypes.isSharedArrayBuffer(buffer) || !utilTypes.isArrayBuffer(buffer) ||
        HAS_OWN(buffer, "byteLength") || HAS_OWN(buffer, "resizable")) {
      fail(pointer);
    }
    const bufferByteLength = REFLECT_APPLY(ARRAY_BUFFER_BYTE_LENGTH_GETTER, buffer, []);
    const resizable = ARRAY_BUFFER_RESIZABLE_GETTER === undefined
      ? false
      : REFLECT_APPLY(ARRAY_BUFFER_RESIZABLE_GETTER, buffer, []);
    if (resizable === true ||
        !Number.isSafeInteger(byteLength) || byteLength < 1 || byteLength > MAX_IMAGE_BYTES ||
        !Number.isSafeInteger(byteOffset) || byteOffset < 0 ||
        !Number.isSafeInteger(bufferByteLength) ||
        byteOffset + byteLength > bufferByteLength) {
      fail(pointer);
    }
    if (byteLength > remainingTotalBytes) fail("/options/images");

    const copyView = new Uint8ArrayConstructor(buffer, byteOffset, byteLength);
    const bytes = BUFFER_FROM(copyView);
    if (bytes.byteLength !== byteLength) fail(pointer);
    return bytes;
  } catch (error) {
    if (error instanceof VisualEvidencePlanError) throw error;
    fail(pointer);
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function freezePlan(plan) {
  for (const image of plan.images) Object.freeze(image);
  for (const comparison of plan.comparisons) {
    Object.freeze(comparison.reviewImageIds);
    Object.freeze(comparison);
  }
  Object.freeze(plan.images);
  Object.freeze(plan.comparisons);
  Object.freeze(plan.reviewImageIds);
  return Object.freeze(plan);
}

/**
 * Compute exact image relationships before model review. Byte-identical images
 * share one canonical representative; different members both remain visible.
 * SHA-256 binds the snapshots, while Buffer.equals decides equality.
 */
export function prepareVisualEvidencePlan(options) {
  const fields = closedRecord(options, "/options", ["images", "comparisons"]);
  const rawImages = arrayValues(fields.images, "/options/images", 1, MAX_IMAGES);
  const rawComparisons = arrayValues(
    fields.comparisons,
    "/options/comparisons",
    1,
    MAX_COMPARISONS
  );

  let totalBytes = 0;
  const admittedImages = rawImages.map((entry, index) => {
    const pointer = `/options/images/${index}`;
    const image = closedRecord(entry, pointer, ["imageId", "bytes"]);
    const imageId = semanticId(image.imageId, `${pointer}/imageId`);
    const bytes = snapshotImageBytes(
      image.bytes,
      `${pointer}/bytes`,
      MAX_TOTAL_IMAGE_BYTES - totalBytes
    );
    totalBytes += bytes.byteLength;
    return { imageId, bytes, byteLength: bytes.byteLength };
  });
  admittedImages.sort((left, right) => compareCodeUnits(left.imageId, right.imageId));
  for (let index = 1; index < admittedImages.length; index += 1) {
    if (admittedImages[index - 1].imageId === admittedImages[index].imageId) {
      fail("/options/images");
    }
  }

  const snapshots = new Map(admittedImages.map((image) => {
    return [image.imageId, Object.freeze({
      imageId: image.imageId,
      bytes: image.bytes,
      byteLength: image.byteLength,
      sha256: sha256(image.bytes)
    })];
  }));
  const representativesByDigest = new Map();
  const representativeByImageId = new Map();
  for (const snapshot of snapshots.values()) {
    const candidates = representativesByDigest.get(snapshot.sha256) ?? [];
    const matching = candidates.find((candidate) =>
      candidate.byteLength === snapshot.byteLength &&
      REFLECT_APPLY(BUFFER_EQUALS, candidate.bytes, [snapshot.bytes]));
    const representative = matching ?? snapshot;
    if (matching === undefined) {
      candidates.push(snapshot);
      representativesByDigest.set(snapshot.sha256, candidates);
    }
    representativeByImageId.set(snapshot.imageId, representative.imageId);
  }

  const comparisonIds = new Set();
  const pairKeys = new Set();
  const referencedImageIds = new Set();
  const comparisons = rawComparisons.map((entry, index) => {
    const pointer = `/options/comparisons/${index}`;
    const comparison = closedRecord(entry, pointer, [
      "comparisonId", "leftImageId", "rightImageId"
    ]);
    const comparisonId = semanticId(comparison.comparisonId, `${pointer}/comparisonId`);
    const leftImageId = semanticId(comparison.leftImageId, `${pointer}/leftImageId`);
    const rightImageId = semanticId(comparison.rightImageId, `${pointer}/rightImageId`);
    const left = snapshots.get(leftImageId);
    const right = snapshots.get(rightImageId);
    if (comparisonIds.has(comparisonId)) fail("/options/comparisons");
    comparisonIds.add(comparisonId);
    if (left === undefined) fail(`${pointer}/leftImageId`);
    if (right === undefined || rightImageId === leftImageId) fail(`${pointer}/rightImageId`);
    const pairKey = [leftImageId, rightImageId].sort(compareCodeUnits).join("\u0000");
    if (pairKeys.has(pairKey)) fail("/options/comparisons");
    pairKeys.add(pairKey);
    referencedImageIds.add(leftImageId);
    referencedImageIds.add(rightImageId);
    const equal = left.byteLength === right.byteLength &&
      REFLECT_APPLY(BUFFER_EQUALS, left.bytes, [right.bytes]);
    const leftRepresentative = representativeByImageId.get(leftImageId);
    const rightRepresentative = representativeByImageId.get(rightImageId);
    return {
      comparisonId,
      leftImageId,
      rightImageId,
      relation: equal ? "exact-byte-equal" : "different",
      reviewImageIds: equal
        ? [leftRepresentative]
        : [leftRepresentative, rightRepresentative]
    };
  }).sort((left, right) => compareCodeUnits(left.comparisonId, right.comparisonId));

  if (referencedImageIds.size !== snapshots.size) fail("/options/images");
  const reviewImageIds = [...new Set(comparisons.flatMap((item) => item.reviewImageIds))]
    .sort(compareCodeUnits);
  const images = [...snapshots.values()].map(({ imageId, byteLength, sha256: imageSha256 }) => ({
    imageId,
    byteLength,
    sha256: imageSha256,
    representativeImageId: representativeByImageId.get(imageId)
  }));
  return freezePlan({
    planVersion: VISUAL_EVIDENCE_PLAN_VERSION,
    planType: "visual-evidence-dedup-plan",
    images,
    comparisons,
    reviewImageIds
  });
}
