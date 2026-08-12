import { isDeepStrictEqual } from "node:util";

export const ORDERED_POWERPOINT_COMPATIBILITY_PROBE_VERSION = "0.1.0";

const FIELD_SEPARATOR = "\u001d";
const SLIDE_SEPARATOR = "\u001e";
const TEXT_SEPARATOR = "\u001f";
const SHA256 = /^[0-9a-f]{64}$/u;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CONTRACT_REFERENCE = /^urn:[a-z0-9][a-z0-9:._-]{0,255}$/u;
const POWERPOINT_VERSION = /^[0-9]+(?:\.[0-9]+){1,3}$/u;

export class OrderedPowerPointCompatibilityError extends Error {
  constructor(pointer) {
    super(`ORDERED_POWERPOINT_COMPATIBILITY_INVALID at ${pointer}`);
    this.name = "OrderedPowerPointCompatibilityError";
    this.code = "ORDERED_POWERPOINT_COMPATIBILITY_INVALID";
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}
function fail(pointer) {
  throw new OrderedPowerPointCompatibilityError(pointer);
}

function exactRecord(value, keys, pointer) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(pointer);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(pointer);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length ||
      actual.some((key) => typeof key !== "string" || !keys.includes(key))) {
    fail(pointer);
  }
  const fields = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(`${pointer}/${key}`);
    }
    fields[key] = descriptor.value;
  }
  return fields;
}

function exactArray(value, pointer, minimum, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail(pointer);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length < minimum || length > maximum ||
      Reflect.ownKeys(descriptors).length !== length + 1) {
    fail(pointer);
  }
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(`${pointer}/${index}`);
    }
    result.push(descriptor.value);
  }
  return result;
}

function semanticId(value, pointer) {
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) fail(pointer);
  return value;
}

function expectedText(value, pointer) {
  if (typeof value !== "string" || value.length < 1 || value.length > 1024 ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    fail(pointer);
  }
  return value;
}

function snapshotExpectedSlides(value) {
  return exactArray(value, "/expectedSlides", 2, 11).map((entry, slideIndex) => {
    const pointer = `/expectedSlides/${slideIndex}`;
    const fields = exactRecord(entry, ["slideId", "texts"], pointer);
    return Object.freeze({
      slideId: semanticId(fields.slideId, `${pointer}/slideId`),
      texts: Object.freeze(exactArray(fields.texts, `${pointer}/texts`, 1, 32)
        .map((text, textIndex) => expectedText(text, `${pointer}/texts/${textIndex}`)))
    });
  });
}

function normalizePowerPointText(value, pointer) {
  if (typeof value !== "string" || value.length > 2048) fail(pointer);
  let normalized = value;
  if (normalized.endsWith("\r")) normalized = normalized.slice(0, -1);
  if (normalized.length < 1 || /[\u0000-\u0009\u000b-\u001f\u007f]/u.test(normalized) ||
      normalized.includes("\n") || normalized.includes("\r")) {
    fail(pointer);
  }
  return normalized;
}

function parseCount(value, pointer) {
  if (!/^[1-9][0-9]?$/u.test(value)) fail(pointer);
  const count = Number(value);
  if (count < 2 || count > 11) fail(pointer);
  return count;
}

function parseInventory(value, slideCount, pointer) {
  const slides = value.split(SLIDE_SEPARATOR);
  if (slides.length !== slideCount) fail(pointer);
  return Object.freeze(slides.map((slide, slideIndex) => {
    const texts = slide.split(TEXT_SEPARATOR);
    if (texts.length < 1 || texts.length > 32) fail(`${pointer}/${slideIndex}`);
    return Object.freeze(texts.map((text, textIndex) =>
      normalizePowerPointText(text, `${pointer}/${slideIndex}/${textIndex}`)));
  }));
}

export function parseOrderedPowerPointProbeTranscript(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 64 * 1024) {
    fail("/transcript");
  }
  const transcript = value.endsWith("\n") ? value.slice(0, -1) : value;
  const fields = transcript.split(FIELD_SEPARATOR);
  if (fields.length !== 5) fail("/transcript");
  const applicationVersion = fields[0];
  if (!POWERPOINT_VERSION.test(applicationVersion)) fail("/transcript/applicationVersion");
  const sourceSlideCount = parseCount(fields[1], "/transcript/sourceSlideCount");
  const reopenedSlideCount = parseCount(fields[2], "/transcript/reopenedSlideCount");
  return Object.freeze({
    probeVersion: ORDERED_POWERPOINT_COMPATIBILITY_PROBE_VERSION,
    applicationName: "Microsoft PowerPoint",
    applicationVersion,
    sourceSlideCount,
    reopenedSlideCount,
    sourceTexts: parseInventory(fields[3], sourceSlideCount, "/transcript/sourceTexts"),
    reopenedTexts: parseInventory(fields[4], reopenedSlideCount, "/transcript/reopenedTexts")
  });
}

export function createOrderedPowerPointCompatibilityReceipt(options) {
  const fields = exactRecord(options, [
    "candidateSha256",
    "candidateRecordSha256",
    "evidenceRecordId",
    "expectedSlides",
    "transcript"
  ], "/options");
  if (typeof fields.candidateSha256 !== "string" || !SHA256.test(fields.candidateSha256)) {
    fail("/options/candidateSha256");
  }
  if (typeof fields.candidateRecordSha256 !== "string" ||
      !SHA256.test(fields.candidateRecordSha256)) {
    fail("/options/candidateRecordSha256");
  }
  if (typeof fields.evidenceRecordId !== "string" ||
      !CONTRACT_REFERENCE.test(fields.evidenceRecordId)) {
    fail("/options/evidenceRecordId");
  }
  const expectedSlides = snapshotExpectedSlides(fields.expectedSlides);
  const probe = parseOrderedPowerPointProbeTranscript(fields.transcript);
  const expectedTexts = expectedSlides.map((slide) => slide.texts);
  if (probe.sourceSlideCount !== expectedSlides.length ||
      probe.reopenedSlideCount !== expectedSlides.length ||
      !isDeepStrictEqual(probe.sourceTexts, expectedTexts) ||
      !isDeepStrictEqual(probe.reopenedTexts, expectedTexts)) {
    fail("/transcript/semanticProjection");
  }
  return Object.freeze({
    probe,
    receipt: Object.freeze({
      receiptVersion: "0.1.0",
      receiptType: "compatibility",
      candidateSha256: fields.candidateSha256,
      candidateRecordSha256: fields.candidateRecordSha256,
      supportMatrixItemId: "macos-powerpoint-automation",
      evidenceRecordId: fields.evidenceRecordId,
      operation: "ordered-deck-open-save-reopen",
      status: "passed"
    }),
    slides: Object.freeze(expectedSlides.map((slide, index) => Object.freeze({
      slideId: slide.slideId,
      sourceTexts: probe.sourceTexts[index],
      reopenedTexts: probe.reopenedTexts[index]
    })))
  });
}
