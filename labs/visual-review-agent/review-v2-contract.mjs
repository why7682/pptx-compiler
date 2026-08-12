import { createHash } from "node:crypto";

import { aggregateVisualReviewRuns } from "./review-contract.mjs";

export const VISUAL_REVIEW_V2_CONTRACT_VERSION = "0.2.0";
export const VISUAL_REVIEW_EVIDENCE_SCOPE = "simulated-review-only";

export const DELIVERY_REVIEW_DEFAULTS = Object.freeze({
  "live-room": Object.freeze({
    artifactAfterlife: "live-only",
    readingDistance: "room",
    messageRecognitionSeconds: 5,
    densityPolicy: "single-scan"
  }),
  "leave-behind": Object.freeze({
    artifactAfterlife: "leave-behind",
    readingDistance: "personal",
    messageRecognitionSeconds: null,
    densityPolicy: "self-guided"
  }),
  hybrid: Object.freeze({
    artifactAfterlife: "both",
    readingDistance: "mixed",
    messageRecognitionSeconds: 5,
    densityPolicy: "layered"
  })
});

const SAFE_TEXT = /^(?=.*\S)(?!.*\p{Cf})(?!.*\p{Noncharacter_Code_Point})(?!.*[\uD800-\uDFFF])[^\u0000-\u001F\u007F-\u009F\u2028\u2029]+$/u;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const DELIVERY_MODES = new Set(Object.keys(DELIVERY_REVIEW_DEFAULTS));
const DENSITIES = new Set(["anchor", "normal", "deep-reading"]);
const INPUT_STATUSES = new Set(["ok", "degraded", "unusable"]);
const SLIDE_STATUSES = new Set(["assessable", "unable-to-judge"]);
const SLOT_STATUSES = new Set(["identified", "unclear", "not-visible"]);
const DIMENSION_STATUSES = new Set(["fit", "concern", "unable-to-judge"]);
const SEVERITIES = new Set(["blocker", "major", "minor"]);
const INSTANCE_STATUSES = new Set(["matched", "missing", "incomplete", "incorrect", "uncertain"]);
const UNASSESSED_PROPERTIES = new Set([
  "accessibility-metadata",
  "animation",
  "font-embedding",
  "native-editability",
  "ooxml-correctness",
  "speaker-notes"
]);
const WHOLE_DECK_DIMENSIONS = Object.freeze([
  "subject-conditionality",
  "decorative-semantic-fit",
  "signature-coherence",
  "motif-coherence",
  "silhouette-rhythm",
  "density-rhythm",
  "opening-payoff",
  "closing-payoff",
  "delivery-fitness"
]);
const ROOT_CAUSES_BY_DIMENSION = Object.freeze({
  "subject-conditionality": Object.freeze(["interchangeable-visual-language"]),
  "decorative-semantic-fit": Object.freeze(["decoration-without-semantic-function"]),
  "signature-coherence": Object.freeze(["signature-disconnected-from-subject"]),
  "motif-coherence": Object.freeze(["motif-role-drift"]),
  "silhouette-rhythm": Object.freeze([
    "accidental-silhouette-repetition", "random-silhouette-variation"
  ]),
  "density-rhythm": Object.freeze(["flat-density-rhythm"]),
  "opening-payoff": Object.freeze(["missing-opening-job"]),
  "closing-payoff": Object.freeze(["missing-closing-payoff"]),
  "delivery-fitness": Object.freeze(["delivery-density-mismatch"])
});
const WHOLE_ROOT_CAUSES = new Set(Object.values(ROOT_CAUSES_BY_DIMENSION).flat());
const WHOLE_MAJOR_FLOOR_ROOT_CAUSES = new Set(WHOLE_ROOT_CAUSES);
const PIVOT_ROOT_CAUSES = new Set([
  "decoration-without-semantic-function",
  "interchangeable-visual-language",
  "motif-role-drift",
  "signature-disconnected-from-subject"
]);
const REPLAN_ROOT_CAUSES = new Set([
  "accidental-silhouette-repetition",
  "delivery-density-mismatch",
  "flat-density-rhythm",
  "incomplete-evidence",
  "missing-closing-payoff",
  "missing-evidence",
  "missing-opening-job",
  "random-silhouette-variation",
  "repeated-layout-silhouette",
  "unclear-primary-message"
]);
const REFINEMENT_ROOT_CAUSES = new Set([
  "alignment-grid-break",
  "clipped-content",
  "distorted-or-low-resolution-image",
  "inconsistent-spacing",
  "insufficient-whitespace",
  "occluded-content",
  "text-too-small",
  "weak-contrast"
]);
const REVIEWED_OUTCOME_KEY_SHA256S = new Set([
  "54c297e933fdfa839ec7723285a07124f40af5ef21fce28a2b2f936b4f1d1406"
]);
const REVIEWED_ATOMIC_MANIFEST_SHA256S = new Set([
  "58cb222e34a16f0b842015b916e1bee34dc627298c7edd95df434f99bbb19921"
]);
const REVIEWED_EVIDENCE_MANIFEST_SHA256S = new Set([
  "0138410544edd44e2818e16a52371e4fd51682e17cfe4d93b775e105ceeeb487"
]);
const SESSION_TOKENS = new WeakMap();
const SESSION_STATES = new WeakMap();
const BLIND_TOKENS = new WeakMap();
const RECONCILIATION_TOKENS = new WeakMap();
const WHOLE_EVIDENCE_TOKENS = new WeakMap();
const WHOLE_REVIEW_TOKENS = new WeakMap();
const WHOLE_DECK_TOKENS = new WeakMap();
const MAX_SLIDES = 256;
const MAX_TEXT = 2_048;

export class VisualReviewV2Error extends TypeError {
  constructor(pointer) {
    super(`VISUAL_REVIEW_V2_INVALID at ${pointer}`);
    this.name = "VisualReviewV2Error";
    this.code = "VISUAL_REVIEW_V2_INVALID";
    this.pointer = pointer;
  }
}

function fail(pointer) {
  throw new VisualReviewV2Error(pointer);
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function closedRecord(value, pointer, expectedKeys) {
  if (value === null || typeof value !== "object") fail(pointer);
  let isArray;
  let prototype;
  let descriptors;
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(pointer);
  }
  if (isArray || prototype !== Object.prototype && prototype !== null) fail(pointer);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string") || keys.length !== expectedKeys.length) {
    fail(pointer);
  }
  const fields = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(`${pointer}/${key}`);
    }
    fields[key] = descriptor.value;
  }
  return fields;
}

function arrayValues(value, pointer, minimum, maximum = minimum) {
  let isArray;
  let prototype;
  let descriptors;
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(pointer);
  }
  if (!isArray || prototype !== Array.prototype) fail(pointer);
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length < minimum || length > maximum ||
      Reflect.ownKeys(descriptors).length !== length + 1) {
    fail(`${pointer}/length`);
  }
  return Array.from({ length }, (_, index) => {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(`${pointer}/${index}`);
    }
    return descriptor.value;
  });
}

function semanticId(value, pointer) {
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) fail(pointer);
  return value;
}

function digest(value, pointer) {
  if (typeof value !== "string" || !SHA256.test(value)) fail(pointer);
  return value;
}

function safeText(value, pointer, maximum = MAX_TEXT) {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum * 2) fail(pointer);
  let count = 0;
  for (const ignored of value) {
    void ignored;
    count += 1;
    if (count > maximum) fail(pointer);
  }
  if (value.trim() !== value || !SAFE_TEXT.test(value)) fail(pointer);
  return value;
}

function enumValue(value, allowed, pointer) {
  if (typeof value !== "string" || !allowed.has(value)) fail(pointer);
  return value;
}

function integer(value, pointer, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(pointer);
  return value;
}

function numberValue(value, pointer, minimum, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value) || Object.is(value, -0) ||
      value < minimum || value > maximum) {
    fail(pointer);
  }
  return value;
}

function booleanValue(value, pointer) {
  if (typeof value !== "boolean") fail(pointer);
  return value;
}

function stringArray(value, pointer, { minimum = 0, maximum = 16, semantic = false } = {}) {
  return arrayValues(value, pointer, minimum, maximum).map((entry, index) => semantic
    ? semanticId(entry, `${pointer}/${index}`)
    : safeText(entry, `${pointer}/${index}`));
}

function region(value, pointer) {
  if (value === null) return null;
  const output = arrayValues(value, pointer, 4, 4)
    .map((entry, index) => numberValue(entry, `${pointer}/${index}`, 0, 1));
  if (output[0] + output[2] > 1 || output[1] + output[3] > 1) fail(pointer);
  return output;
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort(compareCodeUnits)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256Json(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function opaqueToken(registry, authority) {
  const token = Object.freeze(Object.create(null));
  registry.set(token, Object.freeze(authority));
  return token;
}

export function classifyVisualRepair(rootCause) {
  if (PIVOT_ROOT_CAUSES.has(rootCause)) return "pivot";
  if (REPLAN_ROOT_CAUSES.has(rootCause)) return "replan";
  if (REFINEMENT_ROOT_CAUSES.has(rootCause)) return "refine";
  fail("/rootCause");
}

function parseDeliveryProfile(value, pointer = "/deliveryProfile") {
  const fields = closedRecord(value, pointer, [
    "artifactAfterlife", "deliveryMode", "densityPolicy", "messageRecognitionSeconds",
    "profileSha256", "profileType", "profileVersion", "readingDistance", "slides"
  ]);
  if (fields.profileVersion !== VISUAL_REVIEW_V2_CONTRACT_VERSION ||
      fields.profileType !== "delivery-review-profile") {
    fail(pointer);
  }
  const deliveryMode = enumValue(fields.deliveryMode, DELIVERY_MODES, `${pointer}/deliveryMode`);
  const defaults = DELIVERY_REVIEW_DEFAULTS[deliveryMode];
  if (fields.artifactAfterlife !== defaults.artifactAfterlife ||
      fields.readingDistance !== defaults.readingDistance ||
      fields.messageRecognitionSeconds !== defaults.messageRecognitionSeconds ||
      fields.densityPolicy !== defaults.densityPolicy) {
    fail(pointer);
  }
  const slides = arrayValues(fields.slides, `${pointer}/slides`, 1, MAX_SLIDES).map((slide, index) => {
    const slidePointer = `${pointer}/slides/${index}`;
    const slideFields = closedRecord(slide, slidePointer, [
      "messageSlide", "plannedDensity", "slideId"
    ]);
    return {
      slideId: semanticId(slideFields.slideId, `${slidePointer}/slideId`),
      plannedDensity: enumValue(slideFields.plannedDensity, DENSITIES, `${slidePointer}/plannedDensity`),
      messageSlide: booleanValue(slideFields.messageSlide, `${slidePointer}/messageSlide`)
    };
  });
  if (new Set(slides.map((slide) => slide.slideId)).size !== slides.length ||
      deliveryMode === "live-room" && slides.some((slide) => slide.plannedDensity === "deep-reading")) {
    fail(`${pointer}/slides`);
  }
  const core = {
    profileVersion: fields.profileVersion,
    profileType: fields.profileType,
    deliveryMode,
    artifactAfterlife: fields.artifactAfterlife,
    readingDistance: fields.readingDistance,
    messageRecognitionSeconds: fields.messageRecognitionSeconds,
    densityPolicy: fields.densityPolicy,
    slides
  };
  if (sha256Json(core) !== digest(fields.profileSha256, `${pointer}/profileSha256`)) {
    fail(`${pointer}/profileSha256`);
  }
  return deepFreeze({ ...core, profileSha256: fields.profileSha256 });
}

export function createDeliveryReviewProfile(options) {
  const fields = closedRecord(options, "/options", ["deliveryMode", "slides"]);
  const deliveryMode = enumValue(fields.deliveryMode, DELIVERY_MODES, "/options/deliveryMode");
  const defaults = DELIVERY_REVIEW_DEFAULTS[deliveryMode];
  const slides = arrayValues(fields.slides, "/options/slides", 1, MAX_SLIDES).map((slide, index) => {
    const pointer = `/options/slides/${index}`;
    const slideFields = closedRecord(slide, pointer, ["messageSlide", "plannedDensity", "slideId"]);
    return {
      slideId: semanticId(slideFields.slideId, `${pointer}/slideId`),
      plannedDensity: enumValue(slideFields.plannedDensity, DENSITIES, `${pointer}/plannedDensity`),
      messageSlide: booleanValue(slideFields.messageSlide, `${pointer}/messageSlide`)
    };
  });
  const core = {
    profileVersion: VISUAL_REVIEW_V2_CONTRACT_VERSION,
    profileType: "delivery-review-profile",
    deliveryMode,
    artifactAfterlife: defaults.artifactAfterlife,
    readingDistance: defaults.readingDistance,
    messageRecognitionSeconds: defaults.messageRecognitionSeconds,
    densityPolicy: defaults.densityPolicy,
    slides
  };
  return parseDeliveryProfile({ ...core, profileSha256: sha256Json(core) });
}

function parseInputQuality(value, pointer) {
  const fields = closedRecord(value, pointer, ["notes", "status"]);
  return {
    status: enumValue(fields.status, INPUT_STATUSES, `${pointer}/status`),
    notes: stringArray(fields.notes, `${pointer}/notes`, { maximum: 16 })
  };
}

function parseUnassessed(value, pointer) {
  const items = stringArray(value, pointer, { maximum: 6 });
  items.forEach((item, index) => enumValue(item, UNASSESSED_PROPERTIES, `${pointer}/${index}`));
  if (new Set(items).size !== items.length) fail(pointer);
  return items;
}

function parseSlideIdentity(value, pointer, { summary = false } = {}) {
  const expected = summary
    ? ["assessmentStatus", "slideId", "slideNumber", "visibleSummary"]
    : ["slideId", "slideNumber"];
  const fields = closedRecord(value, pointer, expected);
  const parsed = {
    slideId: semanticId(fields.slideId, `${pointer}/slideId`),
    slideNumber: integer(fields.slideNumber, `${pointer}/slideNumber`, 1, MAX_SLIDES)
  };
  if (summary) {
    parsed.assessmentStatus = enumValue(
      fields.assessmentStatus,
      SLIDE_STATUSES,
      `${pointer}/assessmentStatus`
    );
    parsed.visibleSummary = safeText(fields.visibleSummary, `${pointer}/visibleSummary`);
  }
  return parsed;
}

function parseObservation(value, pointer) {
  const fields = closedRecord(value, pointer, ["evidence", "evidenceSource", "region", "slideId"]);
  return {
    slideId: semanticId(fields.slideId, `${pointer}/slideId`),
    region: region(fields.region, `${pointer}/region`),
    evidenceSource: enumValue(
      fields.evidenceSource,
      new Set(["crop", "full-slide"]),
      `${pointer}/evidenceSource`
    ),
    evidence: safeText(fields.evidence, `${pointer}/evidence`)
  };
}

function parseOutcomeSlot(value, pointer) {
  const fields = closedRecord(value, pointer, ["observations", "status", "text"]);
  const status = enumValue(fields.status, SLOT_STATUSES, `${pointer}/status`);
  const text = fields.text === null ? null : safeText(fields.text, `${pointer}/text`);
  const observations = arrayValues(fields.observations, `${pointer}/observations`, 0, 16)
    .map((observation, index) => parseObservation(observation, `${pointer}/observations/${index}`));
  if (status === "identified" && (text === null || observations.length === 0) ||
      status !== "identified" && text !== null) {
    fail(pointer);
  }
  return { status, text, observations };
}

function validateBlindReport(value, pointer) {
  const fields = closedRecord(value, pointer, [
    "contractType", "deliveryProfileSha256", "disclosurePhase", "evidenceScope",
    "inputQuality", "lane", "orderedSlides", "reconstruction", "renderSetSha256",
    "reviewContextSha256", "reviewId", "reviewRun", "schemaVersion", "unassessedProperties"
  ]);
  if (fields.schemaVersion !== VISUAL_REVIEW_V2_CONTRACT_VERSION ||
      fields.contractType !== "blind-outcome-report" || fields.lane !== "blind-outcome" ||
      fields.disclosurePhase !== "blind" || fields.evidenceScope !== VISUAL_REVIEW_EVIDENCE_SCOPE) {
    fail(pointer);
  }
  const reconstruction = closedRecord(fields.reconstruction, `${pointer}/reconstruction`, [
    "argumentEvidenceChain", "argumentEvidenceObservations", "requestedAction", "takeaway",
    "uncertaintyBoundary"
  ]);
  return deepFreeze({
    schemaVersion: fields.schemaVersion,
    contractType: fields.contractType,
    lane: fields.lane,
    disclosurePhase: fields.disclosurePhase,
    evidenceScope: fields.evidenceScope,
    reviewId: semanticId(fields.reviewId, `${pointer}/reviewId`),
    reviewRun: integer(fields.reviewRun, `${pointer}/reviewRun`, 1, 3),
    reviewContextSha256: digest(fields.reviewContextSha256, `${pointer}/reviewContextSha256`),
    renderSetSha256: digest(fields.renderSetSha256, `${pointer}/renderSetSha256`),
    deliveryProfileSha256: digest(fields.deliveryProfileSha256, `${pointer}/deliveryProfileSha256`),
    inputQuality: parseInputQuality(fields.inputQuality, `${pointer}/inputQuality`),
    orderedSlides: arrayValues(fields.orderedSlides, `${pointer}/orderedSlides`, 1, MAX_SLIDES)
      .map((slide, index) => parseSlideIdentity(slide, `${pointer}/orderedSlides/${index}`, {
        summary: true
      })),
    reconstruction: {
      takeaway: parseOutcomeSlot(reconstruction.takeaway, `${pointer}/reconstruction/takeaway`),
      requestedAction: parseOutcomeSlot(
        reconstruction.requestedAction,
        `${pointer}/reconstruction/requestedAction`
      ),
      uncertaintyBoundary: parseOutcomeSlot(
        reconstruction.uncertaintyBoundary,
        `${pointer}/reconstruction/uncertaintyBoundary`
      ),
      argumentEvidenceChain: stringArray(
        reconstruction.argumentEvidenceChain,
        `${pointer}/reconstruction/argumentEvidenceChain`,
        { maximum: 16 }
      ),
      argumentEvidenceObservations: arrayValues(
        reconstruction.argumentEvidenceObservations,
        `${pointer}/reconstruction/argumentEvidenceObservations`,
        0,
        16
      ).map((observation, index) => parseObservation(
        observation,
        `${pointer}/reconstruction/argumentEvidenceObservations/${index}`
      ))
    },
    unassessedProperties: parseUnassessed(
      fields.unassessedProperties,
      `${pointer}/unassessedProperties`
    )
  });
}

function validateWholeFinding(value, pointer, slideIds) {
  const fields = closedRecord(value, pointer, [
    "affectedSlideIds", "confidence", "dimension", "evidence", "impact", "recommendation",
    "region", "rootCause", "severity"
  ]);
  const dimension = enumValue(
    fields.dimension,
    new Set(WHOLE_DECK_DIMENSIONS),
    `${pointer}/dimension`
  );
  const rootCause = enumValue(
    fields.rootCause,
    WHOLE_ROOT_CAUSES,
    `${pointer}/rootCause`
  );
  if (!ROOT_CAUSES_BY_DIMENSION[dimension].includes(rootCause)) fail(`${pointer}/rootCause`);
  const affectedSlideIds = stringArray(fields.affectedSlideIds, `${pointer}/affectedSlideIds`, {
    minimum: 1,
    maximum: MAX_SLIDES,
    semantic: true
  });
  if (new Set(affectedSlideIds).size !== affectedSlideIds.length ||
      affectedSlideIds.some((slideId) => !slideIds.has(slideId))) {
    fail(`${pointer}/affectedSlideIds`);
  }
  const reportedSeverity = enumValue(fields.severity, SEVERITIES, `${pointer}/severity`);
  return {
    dimension,
    affectedSlideIds,
    region: region(fields.region, `${pointer}/region`),
    rootCause,
    severity: reportedSeverity === "minor" && WHOLE_MAJOR_FLOOR_ROOT_CAUSES.has(rootCause)
      ? "major"
      : reportedSeverity,
    evidence: safeText(fields.evidence, `${pointer}/evidence`),
    impact: safeText(fields.impact, `${pointer}/impact`),
    recommendation: safeText(fields.recommendation, `${pointer}/recommendation`),
    confidence: numberValue(fields.confidence, `${pointer}/confidence`, 0, 1)
  };
}

function validateWholeDeckReport(value, pointer) {
  const fields = closedRecord(value, pointer, [
    "contactSheetSha256", "contactSheetSummary", "contractType", "deliveryProfileSha256",
    "dimensionAssessments", "disclosurePhase", "evidenceScope", "findings", "inputQuality",
    "labelBlind", "lane", "orderedSlides", "reviewContextSha256", "reviewId", "reviewRun",
    "schemaVersion", "unassessedProperties"
  ]);
  if (fields.schemaVersion !== VISUAL_REVIEW_V2_CONTRACT_VERSION ||
      fields.contractType !== "whole-deck-review-report" || fields.lane !== "whole-deck" ||
      fields.disclosurePhase !== "label-blind" || fields.evidenceScope !==
        VISUAL_REVIEW_EVIDENCE_SCOPE || fields.labelBlind !== true) {
    fail(pointer);
  }
  const orderedSlides = arrayValues(fields.orderedSlides, `${pointer}/orderedSlides`, 1, MAX_SLIDES)
    .map((slide, index) => parseSlideIdentity(slide, `${pointer}/orderedSlides/${index}`));
  const slideIds = new Set(orderedSlides.map((slide) => slide.slideId));
  if (slideIds.size !== orderedSlides.length) fail(`${pointer}/orderedSlides`);
  const assessments = arrayValues(
    fields.dimensionAssessments,
    `${pointer}/dimensionAssessments`,
    WHOLE_DECK_DIMENSIONS.length,
    WHOLE_DECK_DIMENSIONS.length
  ).map((assessment, index) => {
    const assessmentPointer = `${pointer}/dimensionAssessments/${index}`;
    const assessmentFields = closedRecord(assessment, assessmentPointer, [
      "confidence", "dimension", "evidence", "status"
    ]);
    if (assessmentFields.dimension !== WHOLE_DECK_DIMENSIONS[index]) {
      fail(`${assessmentPointer}/dimension`);
    }
    return {
      dimension: assessmentFields.dimension,
      status: enumValue(assessmentFields.status, DIMENSION_STATUSES, `${assessmentPointer}/status`),
      evidence: safeText(assessmentFields.evidence, `${assessmentPointer}/evidence`),
      confidence: numberValue(
        assessmentFields.confidence,
        `${assessmentPointer}/confidence`,
        0,
        1
      )
    };
  });
  const findings = arrayValues(fields.findings, `${pointer}/findings`, 0, 64)
    .map((finding, index) => validateWholeFinding(
      finding,
      `${pointer}/findings/${index}`,
      slideIds
    ));
  for (const assessment of assessments) {
    const matching = findings.filter((finding) => finding.dimension === assessment.dimension);
    if (assessment.status === "concern" && matching.length === 0 ||
        assessment.status !== "concern" && matching.length !== 0) {
      fail(`${pointer}/dimensionAssessments/${WHOLE_DECK_DIMENSIONS.indexOf(assessment.dimension)}`);
    }
  }
  return deepFreeze({
    schemaVersion: fields.schemaVersion,
    contractType: fields.contractType,
    lane: fields.lane,
    disclosurePhase: fields.disclosurePhase,
    evidenceScope: fields.evidenceScope,
    labelBlind: true,
    reviewId: semanticId(fields.reviewId, `${pointer}/reviewId`),
    reviewRun: integer(fields.reviewRun, `${pointer}/reviewRun`, 1, 3),
    reviewContextSha256: digest(fields.reviewContextSha256, `${pointer}/reviewContextSha256`),
    deliveryProfileSha256: digest(fields.deliveryProfileSha256, `${pointer}/deliveryProfileSha256`),
    contactSheetSha256: digest(fields.contactSheetSha256, `${pointer}/contactSheetSha256`),
    inputQuality: parseInputQuality(fields.inputQuality, `${pointer}/inputQuality`),
    orderedSlides,
    contactSheetSummary: safeText(fields.contactSheetSummary, `${pointer}/contactSheetSummary`),
    dimensionAssessments: assessments,
    findings,
    unassessedProperties: parseUnassessed(
      fields.unassessedProperties,
      `${pointer}/unassessedProperties`
    )
  });
}

function sameSlideIdentity(left, right) {
  return left.slideId === right.slideId && left.slideNumber === right.slideNumber;
}

function assertSlideSequence(slides, pointer) {
  if (new Set(slides.map((slide) => slide.slideId)).size !== slides.length) fail(pointer);
  for (let index = 0; index < slides.length; index += 1) {
    if (slides[index].slideNumber !== index + 1) fail(`${pointer}/${index}/slideNumber`);
  }
}

function parsePreparedRequiredItemSources(value, slideIds, pointer) {
  const entries = arrayValues(value, pointer, 1, 32);
  const byId = new Map();
  for (let index = 0; index < entries.length; index += 1) {
    const entryPointer = `${pointer}/${index}`;
    const fields = closedRecord(entries[index], entryPointer, [
      "cropSha256", "itemId", "slideId", "sourceRenderSha256"
    ]);
    const itemId = semanticId(fields.itemId, `${entryPointer}/itemId`);
    if (byId.has(itemId)) fail(`${entryPointer}/itemId`);
    const parsed = {
      itemId,
      slideId: semanticId(fields.slideId, `${entryPointer}/slideId`),
      sourceRenderSha256: digest(fields.sourceRenderSha256, `${entryPointer}/sourceRenderSha256`),
      cropSha256: digest(fields.cropSha256, `${entryPointer}/cropSha256`)
    };
    if (!slideIds.has(parsed.slideId)) fail(`${entryPointer}/slideId`);
    byId.set(itemId, parsed);
  }
  return [...byId.values()];
}

function parsePreparedWholeDeckCropSources(value, slideIds, pointer) {
  const entries = arrayValues(value, pointer, 1, 32);
  const byId = new Map();
  const cropDigests = new Set();
  for (let index = 0; index < entries.length; index += 1) {
    const entryPointer = `${pointer}/${index}`;
    const fields = closedRecord(entries[index], entryPointer, [
      "cropEvidenceId", "cropSha256", "region", "slideId", "sourceRenderSha256"
    ]);
    const cropEvidenceId = semanticId(fields.cropEvidenceId, `${entryPointer}/cropEvidenceId`);
    const parsedRegion = region(fields.region, `${entryPointer}/region`);
    if (byId.has(cropEvidenceId) || parsedRegion === null) {
      fail(`${entryPointer}/cropEvidenceId`);
    }
    const parsed = {
      cropEvidenceId,
      slideId: semanticId(fields.slideId, `${entryPointer}/slideId`),
      region: parsedRegion,
      sourceRenderSha256: digest(
        fields.sourceRenderSha256,
        `${entryPointer}/sourceRenderSha256`
      ),
      cropSha256: digest(fields.cropSha256, `${entryPointer}/cropSha256`)
    };
    if (!slideIds.has(parsed.slideId) || cropDigests.has(parsed.cropSha256)) {
      fail(entryPointer);
    }
    cropDigests.add(parsed.cropSha256);
    byId.set(cropEvidenceId, parsed);
  }
  return [...byId.values()];
}

function parseReviewedEvidenceManifest(value, deliveryProfile) {
  const fields = closedRecord(value, "/options/reviewedEvidenceManifest", [
    "approvalStatus", "assemblyReceiptSha256", "authorityClass", "contactSheetSha256",
    "deliveryProfileSha256", "evidenceScope", "manifestType", "manifestVersion",
    "rawInputSha256", "renderSetSha256", "requiredItemSources", "reviewContextSha256",
    "wholeDeckCropSources"
  ]);
  if (fields.manifestVersion !== "0.1.0" ||
      fields.manifestType !== "reviewed-visual-evidence-manifest" ||
      fields.approvalStatus !== "approved" ||
      fields.authorityClass !== "repository-reviewed-synthetic-evidence" ||
      fields.evidenceScope !== VISUAL_REVIEW_EVIDENCE_SCOPE) {
    fail("/options/reviewedEvidenceManifest");
  }
  const requiredItemSources = parsePreparedRequiredItemSources(
    fields.requiredItemSources,
    new Set(deliveryProfile.slides.map((slide) => slide.slideId)),
    "/options/reviewedEvidenceManifest/requiredItemSources"
  );
  const wholeDeckCropSources = parsePreparedWholeDeckCropSources(
    fields.wholeDeckCropSources,
    new Set(deliveryProfile.slides.map((slide) => slide.slideId)),
    "/options/reviewedEvidenceManifest/wholeDeckCropSources"
  );
  const parsed = {
    manifestVersion: fields.manifestVersion,
    manifestType: fields.manifestType,
    approvalStatus: fields.approvalStatus,
    authorityClass: fields.authorityClass,
    evidenceScope: fields.evidenceScope,
    rawInputSha256: digest(
      fields.rawInputSha256,
      "/options/reviewedEvidenceManifest/rawInputSha256"
    ),
    assemblyReceiptSha256: digest(
      fields.assemblyReceiptSha256,
      "/options/reviewedEvidenceManifest/assemblyReceiptSha256"
    ),
    reviewContextSha256: digest(
      fields.reviewContextSha256,
      "/options/reviewedEvidenceManifest/reviewContextSha256"
    ),
    renderSetSha256: digest(
      fields.renderSetSha256,
      "/options/reviewedEvidenceManifest/renderSetSha256"
    ),
    contactSheetSha256: digest(
      fields.contactSheetSha256,
      "/options/reviewedEvidenceManifest/contactSheetSha256"
    ),
    deliveryProfileSha256: digest(
      fields.deliveryProfileSha256,
      "/options/reviewedEvidenceManifest/deliveryProfileSha256"
    ),
    requiredItemSources,
    wholeDeckCropSources
  };
  const reviewedEvidenceManifestSha256 = sha256Json(parsed);
  if (parsed.deliveryProfileSha256 !== deliveryProfile.profileSha256 ||
      !REVIEWED_EVIDENCE_MANIFEST_SHA256S.has(reviewedEvidenceManifestSha256)) {
    fail("/options/reviewedEvidenceManifest");
  }
  return deepFreeze({ ...parsed, reviewedEvidenceManifestSha256 });
}

/**
 * Pre-bind all render/contact-sheet/source/crop evidence before blind reports
 * can be frozen. Required-item identities remain private in the opaque token.
 */
export function createVisualReviewSession(options) {
  const fields = closedRecord(options, "/options", ["deliveryProfile", "reviewedEvidenceManifest"]);
  const deliveryProfile = parseDeliveryProfile(fields.deliveryProfile);
  const manifest = parseReviewedEvidenceManifest(fields.reviewedEvidenceManifest, deliveryProfile);
  const core = {
    sessionVersion: VISUAL_REVIEW_V2_CONTRACT_VERSION,
    sessionType: "visual-review-session",
    state: "prepared",
    evidenceScope: VISUAL_REVIEW_EVIDENCE_SCOPE,
    reviewedEvidenceManifestSha256: manifest.reviewedEvidenceManifestSha256,
    reviewContextSha256: manifest.reviewContextSha256,
    renderSetSha256: manifest.renderSetSha256,
    contactSheetSha256: manifest.contactSheetSha256,
    deliveryProfile,
    deliveryProfileSha256: deliveryProfile.profileSha256,
    rawInputSha256: manifest.rawInputSha256,
    assemblyReceiptSha256: manifest.assemblyReceiptSha256,
    requiredItemSourceSetSha256: sha256Json(manifest.requiredItemSources),
    wholeDeckCropSourceSetSha256: sha256Json(manifest.wholeDeckCropSources)
  };
  const reviewSession = deepFreeze({ ...core, reviewSessionSha256: sha256Json(core) });
  const sessionIdentity = Object.freeze(Object.create(null));
  SESSION_STATES.set(sessionIdentity, {
    blindStage: "prepared",
    wholeDeckStage: "prepared",
    revealed: false
  });
  const reviewSessionToken = opaqueToken(SESSION_TOKENS, {
    requiredItemSources: manifest.requiredItemSources,
    reviewSession,
    sessionIdentity
  });
  const wholeDeckEvidenceToken = opaqueToken(WHOLE_EVIDENCE_TOKENS, {
    reviewSession,
    sessionIdentity,
    wholeDeckCropSources: manifest.wholeDeckCropSources
  });
  return Object.freeze({ reviewSession, reviewSessionToken, wholeDeckEvidenceToken });
}

function consumePreparedReviewSession(value) {
  const fields = closedRecord(value, "/options", ["reviewSession", "reviewSessionToken"]);
  const authority = SESSION_TOKENS.get(fields.reviewSessionToken);
  if (authority === undefined || authority.reviewSession !== fields.reviewSession) {
    fail("/options/reviewSessionToken");
  }
  const state = SESSION_STATES.get(authority.sessionIdentity);
  if (state === undefined || state.blindStage !== "prepared" || state.revealed) {
    fail("/options/reviewSessionToken");
  }
  SESSION_TOKENS.delete(fields.reviewSessionToken);
  state.blindStage = "consumed";
  return { ...authority, state };
}

/**
 * Validate and freeze exactly three blind runs before any expected outcome is
 * available to the caller. The returned token authenticates the frozen object;
 * serializing or cloning the batch never recreates that authority.
 */
export function freezeBlindOutcomeRuns(reports, options) {
  // Consume the prepared authority before touching caller-owned reports. A
  // failed first freeze therefore cannot be retried after any later reveal,
  // and one session can never mint a target-aware second blind batch.
  const parsedOptions = consumePreparedReviewSession(options);
  const session = parsedOptions.reviewSession;
  const reportValues = arrayValues(reports, "/reports", 3, 3);
  const validated = reportValues.map((report, index) =>
    validateBlindReport(report, `/reports/${index}`));
  const first = validated[0];
  for (let index = 0; index < validated.length; index += 1) {
    const report = validated[index];
    assertSlideSequence(report.orderedSlides, `/reports/${index}/orderedSlides`);
    if (report.reviewRun !== index + 1 || report.reviewId !== first.reviewId ||
        report.reviewContextSha256 !== session.reviewContextSha256 ||
        report.renderSetSha256 !== session.renderSetSha256 ||
        report.deliveryProfileSha256 !== session.deliveryProfileSha256 ||
        report.orderedSlides.length !== first.orderedSlides.length ||
        report.orderedSlides.length !== session.deliveryProfile.slides.length) {
      fail(`/reports/${index}`);
    }
    for (let slideIndex = 0; slideIndex < report.orderedSlides.length; slideIndex += 1) {
      const slide = report.orderedSlides[slideIndex];
      const expected = first.orderedSlides[slideIndex];
      const profileSlide = session.deliveryProfile.slides[slideIndex];
      if (!sameSlideIdentity(slide, expected) || slide.slideId !== profileSlide.slideId) {
        fail(`/reports/${index}/orderedSlides/${slideIndex}`);
      }
    }
    const slideStatusById = new Map(report.orderedSlides.map((slide) => [
      slide.slideId,
      slide.assessmentStatus
    ]));
    if (report.inputQuality.status === "ok" &&
        !report.orderedSlides.some((slide) => slide.assessmentStatus === "assessable")) {
      fail(`/reports/${index}/inputQuality/status`);
    }
    const slots = [
      report.reconstruction.takeaway,
      report.reconstruction.requestedAction,
      report.reconstruction.uncertaintyBoundary
    ];
    const observations = [
      ...slots.flatMap((slot) => slot.observations),
      ...report.reconstruction.argumentEvidenceObservations
    ];
    if (observations.some((observation) =>
      slideStatusById.get(observation.slideId) !== "assessable") ||
      (report.reconstruction.argumentEvidenceChain.length > 0) !==
        (report.reconstruction.argumentEvidenceObservations.length > 0)) {
      fail(`/reports/${index}/reconstruction`);
    }
  }
  const core = {
    batchVersion: VISUAL_REVIEW_V2_CONTRACT_VERSION,
    batchType: "blind-outcome-batch",
    state: "blind-frozen",
    evidenceScope: VISUAL_REVIEW_EVIDENCE_SCOPE,
    reviewSessionSha256: session.reviewSessionSha256,
    reviewId: first.reviewId,
    reviewContextSha256: session.reviewContextSha256,
    renderSetSha256: session.renderSetSha256,
    contactSheetSha256: session.contactSheetSha256,
    deliveryProfile: session.deliveryProfile,
    deliveryProfileSha256: session.deliveryProfileSha256,
    rawInputSha256: session.rawInputSha256,
    assemblyReceiptSha256: session.assemblyReceiptSha256,
    requiredItemSourceSetSha256: session.requiredItemSourceSetSha256,
    reports: validated
  };
  const blindBatch = deepFreeze({ ...core, blindBatchSha256: sha256Json(core) });
  parsedOptions.state.blindStage = "frozen";
  const blindToken = opaqueToken(BLIND_TOKENS, {
    blindBatch,
    requiredItemSources: parsedOptions.requiredItemSources,
    sessionIdentity: parsedOptions.sessionIdentity
  });
  return Object.freeze({ blindBatch, blindToken });
}

function parseHiddenOutcomeKey(value, expectedRawInputSha256) {
  const fields = closedRecord(value, "/hiddenOutcomeKey", [
    "approval", "expectedOutcome", "keyType", "keyVersion", "rawInputSha256"
  ]);
  if (fields.keyVersion !== "0.1.0" || fields.keyType !== "blind-outcome-key") {
    fail("/hiddenOutcomeKey");
  }
  const outcome = closedRecord(fields.expectedOutcome, "/hiddenOutcomeKey/expectedOutcome", [
    "boundaryItemId", "requestedActionItemId", "requiredEvidenceIds", "takeawayItemId"
  ]);
  const approval = closedRecord(fields.approval, "/hiddenOutcomeKey/approval", [
    "approvalId", "approvalStatus", "reviewerClass"
  ]);
  const parsed = {
    keyVersion: fields.keyVersion,
    keyType: fields.keyType,
    rawInputSha256: digest(fields.rawInputSha256, "/hiddenOutcomeKey/rawInputSha256"),
    expectedOutcome: {
      takeawayItemId: semanticId(
        outcome.takeawayItemId,
        "/hiddenOutcomeKey/expectedOutcome/takeawayItemId"
      ),
      requestedActionItemId: semanticId(
        outcome.requestedActionItemId,
        "/hiddenOutcomeKey/expectedOutcome/requestedActionItemId"
      ),
      boundaryItemId: semanticId(
        outcome.boundaryItemId,
        "/hiddenOutcomeKey/expectedOutcome/boundaryItemId"
      ),
      requiredEvidenceIds: stringArray(
        outcome.requiredEvidenceIds,
        "/hiddenOutcomeKey/expectedOutcome/requiredEvidenceIds",
        { minimum: 1, maximum: 16, semantic: true }
      )
    },
    approval: {
      approvalStatus: safeText(approval.approvalStatus, "/hiddenOutcomeKey/approval/approvalStatus"),
      reviewerClass: safeText(approval.reviewerClass, "/hiddenOutcomeKey/approval/reviewerClass"),
      approvalId: semanticId(approval.approvalId, "/hiddenOutcomeKey/approval/approvalId")
    }
  };
  const allIds = [
    parsed.expectedOutcome.takeawayItemId,
    parsed.expectedOutcome.requestedActionItemId,
    parsed.expectedOutcome.boundaryItemId,
    ...parsed.expectedOutcome.requiredEvidenceIds
  ];
  const keySha256 = sha256Json(parsed);
  if (parsed.rawInputSha256 !== expectedRawInputSha256 ||
      parsed.approval.approvalStatus !== "approved" ||
      new Set(allIds).size !== allIds.length ||
      !REVIEWED_OUTCOME_KEY_SHA256S.has(keySha256)) {
    fail("/hiddenOutcomeKey");
  }
  return deepFreeze({ ...parsed, hiddenOutcomeKeySha256: keySha256 });
}

function parseAtomicOutcomeManifest(value, authority, hiddenKey) {
  const fields = closedRecord(value, "/atomicOutcomeManifest", [
    "assemblyReceiptSha256", "items", "manifestType", "manifestVersion",
    "planningReceiptSha256", "rawInputSha256"
  ]);
  if (fields.manifestVersion !== "0.1.0" ||
      fields.manifestType !== "atomic-outcome-manifest") {
    fail("/atomicOutcomeManifest");
  }
  const items = arrayValues(fields.items, "/atomicOutcomeManifest/items", 1, 32)
    .map((item, index) => {
      const pointer = `/atomicOutcomeManifest/items/${index}`;
      const itemFields = closedRecord(item, pointer, ["expectedMeaning", "itemId", "itemKind"]);
      return {
        itemId: semanticId(itemFields.itemId, `${pointer}/itemId`),
        itemKind: enumValue(
          itemFields.itemKind,
          new Set(["takeaway", "requested-action", "uncertainty-boundary", "evidence"]),
          `${pointer}/itemKind`
        ),
        expectedMeaning: safeText(itemFields.expectedMeaning, `${pointer}/expectedMeaning`)
      };
    });
  const parsed = {
    manifestVersion: fields.manifestVersion,
    manifestType: fields.manifestType,
    rawInputSha256: digest(fields.rawInputSha256, "/atomicOutcomeManifest/rawInputSha256"),
    planningReceiptSha256: digest(
      fields.planningReceiptSha256,
      "/atomicOutcomeManifest/planningReceiptSha256"
    ),
    assemblyReceiptSha256: digest(
      fields.assemblyReceiptSha256,
      "/atomicOutcomeManifest/assemblyReceiptSha256"
    ),
    items
  };
  const manifestSha256 = sha256Json(parsed);
  const expectedItems = [
    [hiddenKey.expectedOutcome.takeawayItemId, "takeaway"],
    [hiddenKey.expectedOutcome.requestedActionItemId, "requested-action"],
    [hiddenKey.expectedOutcome.boundaryItemId, "uncertainty-boundary"],
    ...hiddenKey.expectedOutcome.requiredEvidenceIds.map((itemId) => [itemId, "evidence"])
  ];
  if (parsed.rawInputSha256 !== authority.blindBatch.rawInputSha256 ||
      parsed.assemblyReceiptSha256 !== authority.blindBatch.assemblyReceiptSha256 ||
      !REVIEWED_ATOMIC_MANIFEST_SHA256S.has(manifestSha256) ||
      items.length !== expectedItems.length) {
    fail("/atomicOutcomeManifest");
  }
  for (let index = 0; index < expectedItems.length; index += 1) {
    if (items[index].itemId !== expectedItems[index][0] ||
        items[index].itemKind !== expectedItems[index][1]) {
      fail(`/atomicOutcomeManifest/items/${index}`);
    }
  }
  return deepFreeze({ ...parsed, atomicOutcomeManifestSha256: manifestSha256 });
}

function bindRequiredItemSources(entries, items) {
  if (entries.length !== items.length) fail("/blindToken/requiredItemSources");
  const byId = new Map(entries.map((entry) => [entry.itemId, entry]));
  for (const item of items) if (!byId.has(item.itemId)) fail("/blindToken/requiredItemSources");
  return items.map((item) => byId.get(item.itemId));
}

/** Reveal the fixed P1 outcome only after an authentic blind batch exists. */
export function prepareInstanceReviewReveal(options) {
  const fields = closedRecord(options, "/options", [
    "atomicOutcomeManifest", "blindBatch", "blindToken", "hiddenOutcomeKey"
  ]);
  const blindAuthority = BLIND_TOKENS.get(fields.blindToken);
  if (blindAuthority === undefined || blindAuthority.blindBatch !== fields.blindBatch) {
    fail("/options/blindToken");
  }
  const state = SESSION_STATES.get(blindAuthority.sessionIdentity);
  if (state === undefined || state.blindStage !== "frozen" ||
      state.wholeDeckStage !== "frozen" || state.revealed) {
    fail("/options/blindToken");
  }
  BLIND_TOKENS.delete(fields.blindToken);
  state.revealed = true;
  const hiddenKey = parseHiddenOutcomeKey(
    fields.hiddenOutcomeKey,
    blindAuthority.blindBatch.rawInputSha256
  );
  const manifest = parseAtomicOutcomeManifest(
    fields.atomicOutcomeManifest,
    blindAuthority,
    hiddenKey
  );
  const requiredItemSources = bindRequiredItemSources(
    blindAuthority.requiredItemSources,
    manifest.items
  );
  const core = {
    contextVersion: VISUAL_REVIEW_V2_CONTRACT_VERSION,
    contextType: "instance-review-context",
    state: "revealed",
    evidenceScope: VISUAL_REVIEW_EVIDENCE_SCOPE,
    reviewId: blindAuthority.blindBatch.reviewId,
    reviewSessionSha256: blindAuthority.blindBatch.reviewSessionSha256,
    reviewContextSha256: blindAuthority.blindBatch.reviewContextSha256,
    renderSetSha256: blindAuthority.blindBatch.renderSetSha256,
    contactSheetSha256: blindAuthority.blindBatch.contactSheetSha256,
    deliveryProfileSha256: blindAuthority.blindBatch.deliveryProfileSha256,
    rawInputSha256: blindAuthority.blindBatch.rawInputSha256,
    planningReceiptSha256: manifest.planningReceiptSha256,
    assemblyReceiptSha256: blindAuthority.blindBatch.assemblyReceiptSha256,
    blindBatchSha256: blindAuthority.blindBatch.blindBatchSha256,
    requiredItemSourceSetSha256: blindAuthority.blindBatch.requiredItemSourceSetSha256,
    hiddenOutcomeKeySha256: hiddenKey.hiddenOutcomeKeySha256,
    atomicOutcomeManifestSha256: manifest.atomicOutcomeManifestSha256,
    items: manifest.items,
    requiredItemSources,
    blindReconstructions: blindAuthority.blindBatch.reports.map((report) => ({
      reviewRun: report.reviewRun,
      reconstruction: report.reconstruction
    }))
  };
  const instanceContext = deepFreeze({ ...core, instanceContextSha256: sha256Json(core) });
  const reconciliationToken = opaqueToken(RECONCILIATION_TOKENS, {
    blindBatch: blindAuthority.blindBatch,
    instanceContext,
    sessionIdentity: blindAuthority.sessionIdentity
  });
  return Object.freeze({ instanceContext, reconciliationToken });
}

function validateInstanceReport(value, pointer, authority) {
  const fields = closedRecord(value, pointer, [
    "atomicOutcomeManifestSha256", "blindBatchSha256", "contractType",
    "deliveryProfileSha256", "disclosurePhase", "evidenceScope",
    "hiddenOutcomeKeySha256", "instanceContextSha256", "itemAssessments", "lane",
    "reviewContextSha256", "reviewId", "reviewRun", "schemaVersion", "unassessedProperties"
  ]);
  const context = authority.instanceContext;
  if (fields.schemaVersion !== VISUAL_REVIEW_V2_CONTRACT_VERSION ||
      fields.contractType !== "instance-review-report" || fields.lane !== "instance" ||
      fields.disclosurePhase !== "revealed" ||
      fields.evidenceScope !== VISUAL_REVIEW_EVIDENCE_SCOPE) {
    fail(pointer);
  }
  const reviewRun = integer(fields.reviewRun, `${pointer}/reviewRun`, 1, 3);
  const blindReport = authority.blindBatch.reports[reviewRun - 1];
  const assessments = arrayValues(
    fields.itemAssessments,
    `${pointer}/itemAssessments`,
    context.items.length,
    context.items.length
  ).map((assessment, index) => {
    const assessmentPointer = `${pointer}/itemAssessments/${index}`;
    const assessmentFields = closedRecord(assessment, assessmentPointer, [
      "blindEvidenceRefs", "confidence", "diagnosis", "itemId", "itemKind",
      "recommendation", "status", "visibleEvidence"
    ]);
    const expected = context.items[index];
    const status = enumValue(
      assessmentFields.status,
      INSTANCE_STATUSES,
      `${assessmentPointer}/status`
    );
    const blindEvidenceRefs = stringArray(
      assessmentFields.blindEvidenceRefs,
      `${assessmentPointer}/blindEvidenceRefs`,
      { minimum: status === "matched" ? 1 : 0, maximum: 16 }
    );
    const slotByKind = {
      takeaway: "takeaway",
      "requested-action": "requested-action",
      "uncertainty-boundary": "uncertainty-boundary",
      evidence: "argument-evidence-chain"
    };
    const expectedBlindRef = `run-${reviewRun}:${slotByKind[expected.itemKind]}`;
    if (new Set(blindEvidenceRefs).size !== blindEvidenceRefs.length ||
        blindEvidenceRefs.some((reference) => reference !== expectedBlindRef)) {
      fail(`${assessmentPointer}/blindEvidenceRefs`);
    }
    const blindSlotVisible = expected.itemKind === "takeaway"
      ? blindReport.reconstruction.takeaway.status === "identified"
      : expected.itemKind === "requested-action"
        ? blindReport.reconstruction.requestedAction.status === "identified"
        : expected.itemKind === "uncertainty-boundary"
          ? blindReport.reconstruction.uncertaintyBoundary.status === "identified"
          : blindReport.reconstruction.argumentEvidenceChain.length > 0 &&
            blindReport.reconstruction.argumentEvidenceObservations.length > 0;
    if (status === "matched" &&
        (blindReport.inputQuality.status === "unusable" || !blindSlotVisible)) {
      fail(`${assessmentPointer}/status`);
    }
    const visibleEvidence = stringArray(
      assessmentFields.visibleEvidence,
      `${assessmentPointer}/visibleEvidence`,
      { minimum: 1, maximum: 16 }
    );
    if (assessmentFields.itemId !== expected.itemId ||
        assessmentFields.itemKind !== expected.itemKind) {
      fail(assessmentPointer);
    }
    return {
      itemId: expected.itemId,
      itemKind: expected.itemKind,
      status,
      blindEvidenceRefs,
      visibleEvidence,
      diagnosis: safeText(assessmentFields.diagnosis, `${assessmentPointer}/diagnosis`),
      recommendation: safeText(
        assessmentFields.recommendation,
        `${assessmentPointer}/recommendation`
      ),
      confidence: numberValue(
        assessmentFields.confidence,
        `${assessmentPointer}/confidence`,
        0,
        1
      )
    };
  });
  const parsed = {
    schemaVersion: fields.schemaVersion,
    contractType: fields.contractType,
    lane: fields.lane,
    disclosurePhase: fields.disclosurePhase,
    evidenceScope: fields.evidenceScope,
    reviewId: semanticId(fields.reviewId, `${pointer}/reviewId`),
    reviewRun,
    reviewContextSha256: digest(fields.reviewContextSha256, `${pointer}/reviewContextSha256`),
    deliveryProfileSha256: digest(
      fields.deliveryProfileSha256,
      `${pointer}/deliveryProfileSha256`
    ),
    instanceContextSha256: digest(
      fields.instanceContextSha256,
      `${pointer}/instanceContextSha256`
    ),
    blindBatchSha256: digest(fields.blindBatchSha256, `${pointer}/blindBatchSha256`),
    hiddenOutcomeKeySha256: digest(
      fields.hiddenOutcomeKeySha256,
      `${pointer}/hiddenOutcomeKeySha256`
    ),
    atomicOutcomeManifestSha256: digest(
      fields.atomicOutcomeManifestSha256,
      `${pointer}/atomicOutcomeManifestSha256`
    ),
    itemAssessments: assessments,
    unassessedProperties: parseUnassessed(
      fields.unassessedProperties,
      `${pointer}/unassessedProperties`
    )
  };
  if (parsed.reviewId !== context.reviewId ||
      parsed.reviewContextSha256 !== context.reviewContextSha256 ||
      parsed.deliveryProfileSha256 !== context.deliveryProfileSha256 ||
      parsed.instanceContextSha256 !== context.instanceContextSha256 ||
      parsed.blindBatchSha256 !== context.blindBatchSha256 ||
      parsed.hiddenOutcomeKeySha256 !== context.hiddenOutcomeKeySha256 ||
      parsed.atomicOutcomeManifestSha256 !== context.atomicOutcomeManifestSha256) {
    fail(pointer);
  }
  return deepFreeze(parsed);
}

function validateInstanceRuns(value, authority) {
  const values = arrayValues(value, "/instanceReports", 3, 3);
  const reports = values.map((report, index) =>
    validateInstanceReport(report, `/instanceReports/${index}`, authority));
  for (let index = 0; index < reports.length; index += 1) {
    if (reports[index].reviewRun !== index + 1 || reports[index].reviewId !== reports[0].reviewId) {
      fail(`/instanceReports/${index}`);
    }
  }
  return reports;
}

function deriveRequiredItemIssues(reports, context) {
  const issues = [];
  const summaries = context.items.map((item, itemIndex) => {
    const statuses = reports.map((report) => ({
      reviewRun: report.reviewRun,
      status: report.itemAssessments[itemIndex].status
    }));
    if (statuses.some((entry) => entry.status !== "matched")) issues.push(item.itemId);
    return { itemId: item.itemId, itemKind: item.itemKind, statuses };
  });
  issues.sort(compareCodeUnits);
  const idByItem = new Map(issues.map((itemId, index) => [itemId, `required-item-${index + 1}`]));
  return { summaries, idByItem };
}

function validateRequiredItemReconciliations(value, authority, idByItem) {
  const records = arrayValues(value, "/requiredItemReconciliations", 0, authority.instanceContext.items.length);
  const sources = new Map(authority.instanceContext.requiredItemSources
    .map((source) => [source.itemId, source]));
  const expectedById = new Map([...idByItem].map(([itemId, reconciliationId]) => [
    reconciliationId,
    itemId
  ]));
  const byId = new Map();
  for (let index = 0; index < records.length; index += 1) {
    const pointer = `/requiredItemReconciliations/${index}`;
    const fields = closedRecord(records[index], pointer, [
      "blindBatchSha256", "confidence", "cropSha256", "evidence", "evidenceSource",
      "followUpReviewId", "instanceContextSha256", "itemId", "reconciliationId",
      "resolution", "sourceRenderSha256"
    ]);
    const reconciliationId = semanticId(fields.reconciliationId, `${pointer}/reconciliationId`);
    const itemId = semanticId(fields.itemId, `${pointer}/itemId`);
    if (byId.has(reconciliationId) || expectedById.get(reconciliationId) !== itemId) {
      fail(`${pointer}/reconciliationId`);
    }
    const source = sources.get(itemId);
    const parsed = {
      reconciliationId,
      itemId,
      instanceContextSha256: digest(
        fields.instanceContextSha256,
        `${pointer}/instanceContextSha256`
      ),
      blindBatchSha256: digest(fields.blindBatchSha256, `${pointer}/blindBatchSha256`),
      followUpReviewId: semanticId(fields.followUpReviewId, `${pointer}/followUpReviewId`),
      sourceRenderSha256: digest(
        fields.sourceRenderSha256,
        `${pointer}/sourceRenderSha256`
      ),
      cropSha256: digest(fields.cropSha256, `${pointer}/cropSha256`),
      evidenceSource: fields.evidenceSource,
      resolution: enumValue(
        fields.resolution,
        new Set(["confirmed-failure", "dismissed-failure", "unable-to-resolve"]),
        `${pointer}/resolution`
      ),
      evidence: safeText(fields.evidence, `${pointer}/evidence`),
      confidence: numberValue(fields.confidence, `${pointer}/confidence`, 0, 1)
    };
    if (parsed.instanceContextSha256 !== authority.instanceContext.instanceContextSha256 ||
        parsed.blindBatchSha256 !== authority.instanceContext.blindBatchSha256 ||
        parsed.evidenceSource !== "crop" || source === undefined ||
        parsed.sourceRenderSha256 !== source.sourceRenderSha256 ||
        parsed.cropSha256 !== source.cropSha256) {
      fail(pointer);
    }
    byId.set(reconciliationId, deepFreeze(parsed));
  }
  return byId;
}

function highestRequiredStatus(statuses) {
  if (statuses.includes("incorrect")) return "incorrect";
  if (statuses.includes("missing")) return "missing";
  if (statuses.includes("incomplete")) return "incomplete";
  if (statuses.includes("uncertain")) return "uncertain";
  return "matched";
}

function consumeWholeDeckEvidence(value) {
  const fields = closedRecord(value, "/options", ["reviewSession", "wholeDeckEvidenceToken"]);
  const authority = WHOLE_EVIDENCE_TOKENS.get(fields.wholeDeckEvidenceToken);
  if (authority === undefined || authority.reviewSession !== fields.reviewSession) {
    fail("/options/wholeDeckEvidenceToken");
  }
  const state = SESSION_STATES.get(authority.sessionIdentity);
  if (state === undefined || state.wholeDeckStage !== "prepared" || state.revealed) {
    fail("/options/wholeDeckEvidenceToken");
  }
  WHOLE_EVIDENCE_TOKENS.delete(fields.wholeDeckEvidenceToken);
  state.wholeDeckStage = "consumed";
  return {
    reviewSession: authority.reviewSession,
    sessionIdentity: authority.sessionIdentity,
    state,
    wholeDeckCropSources: authority.wholeDeckCropSources,
  };
}

function projectWholeReport(report) {
  const unable = report.inputQuality.status === "unusable" ||
    report.dimensionAssessments.some((assessment) => assessment.status === "unable-to-judge");
  return {
    schemaVersion: "0.1.0",
    contractType: "visual-review-report",
    reviewId: report.reviewId,
    reviewContextSha256: report.reviewContextSha256,
    reviewRun: report.reviewRun,
    reviewMode: "absolute",
    inputQuality: report.inputQuality,
    goalAssessment: {
      status: unable ? "unable-to-judge" : "met",
      evidence: unable ? ["At least one whole-deck property could not be judged."] : []
    },
    slides: report.orderedSlides.map((slide) => ({
      slideId: slide.slideId,
      slideNumber: slide.slideNumber,
      assessmentStatus: report.inputQuality.status === "unusable"
        ? "unable-to-judge"
        : "assessable",
      visibleSummary: report.contactSheetSummary,
      findings: []
    })),
    deckFindings: report.findings.map((finding, index) => ({
      findingId: `whole-${report.reviewRun}-${index + 1}`,
      criterion: finding.dimension,
      rootCause: finding.rootCause,
      severity: finding.severity,
      region: finding.region,
      evidenceSource: "full-slide",
      evidence: finding.evidence,
      impact: finding.impact,
      recommendation: finding.recommendation,
      confidence: finding.confidence
    })),
    unassessedProperties: report.unassessedProperties
  };
}

function consensusDimension(reports, dimensionIndex) {
  const assessments = reports.map((report) => ({
    reviewRun: report.reviewRun,
    ...report.dimensionAssessments[dimensionIndex]
  }));
  const counts = new Map();
  for (const assessment of assessments) {
    const runs = counts.get(assessment.status) ?? [];
    runs.push(assessment.reviewRun);
    counts.set(assessment.status, runs);
  }
  const consensus = [...counts]
    .filter(([, runs]) => runs.length >= 2)
    .sort(([left], [right]) => compareCodeUnits(left, right))[0];
  const status = consensus?.[0] ?? "unable-to-judge";
  const reportingRuns = consensus?.[1] ?? assessments.map((assessment) => assessment.reviewRun);
  const supporting = assessments.filter((assessment) => reportingRuns.includes(assessment.reviewRun));
  return deepFreeze({
    dimension: WHOLE_DECK_DIMENSIONS[dimensionIndex],
    status,
    reportingRuns,
    evidence: [...new Set(supporting.map((assessment) => assessment.evidence))],
    confidence: Math.min(...supporting.map((assessment) => assessment.confidence))
  });
}

function wholeRegionsAreSimilar(left, right) {
  if (left === null || right === null) return left === null && right === null;
  const leftArea = left[2] * left[3];
  const rightArea = right[2] * right[3];
  const intersectionWidth = Math.max(
    0,
    Math.min(left[0] + left[2], right[0] + right[2]) - Math.max(left[0], right[0])
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(left[1] + left[3], right[1] + right[3]) - Math.max(left[1], right[1])
  );
  const intersection = intersectionWidth * intersectionHeight;
  const union = leftArea + rightArea - intersection;
  return union === 0
    ? JSON.stringify(left) === JSON.stringify(right)
    : intersection / union >= 0.4;
}

function enrichWholeFinding(entry, reports, blockerFollowUps, reviewedBlockerCrops) {
  const supportingRunsBySlide = new Map();
  for (const run of entry.reportingRuns) {
    const report = reports[run - 1];
    const slidesInRun = new Set();
    for (const finding of report.findings) {
      if (finding.dimension === entry.finding.criterion &&
          finding.rootCause === entry.finding.rootCause &&
          wholeRegionsAreSimilar(finding.region, entry.finding.region)) {
        finding.affectedSlideIds.forEach((slideId) => slidesInRun.add(slideId));
      }
    }
    for (const slideId of slidesInRun) {
      const supportingRuns = supportingRunsBySlide.get(slideId) ?? new Set();
      supportingRuns.add(run);
      supportingRunsBySlide.set(slideId, supportingRuns);
    }
  }
  const requiredRunCount = Math.min(2, entry.reportingRuns.length);
  let affectedSlideIds = [...supportingRunsBySlide]
    .filter(([, supportingRuns]) => supportingRuns.size >= requiredRunCount)
    .map(([slideId]) => slideId)
    .sort(compareCodeUnits);
  if (entry.finding.severity === "blocker") {
    const matchingFollowUps = blockerFollowUps.filter((followUp) =>
      followUp.criterion === entry.finding.criterion &&
      followUp.rootCause === entry.finding.rootCause &&
      wholeRegionsAreSimilar(followUp.region, entry.finding.region));
    if (matchingFollowUps.length !== 1) fail("/options/blockerFollowUps");
    const source = reviewedBlockerCrops.get(matchingFollowUps[0].blockerId);
    if (source === undefined) fail("/options/blockerFollowUps");
    affectedSlideIds = [source.slideId];
  }
  return deepFreeze({
    dimension: entry.finding.criterion,
    affectedSlideIds,
    region: entry.finding.region,
    rootCause: entry.finding.rootCause,
    severity: entry.finding.severity,
    evidence: entry.finding.evidence,
    impact: entry.finding.impact,
    recommendation: entry.finding.recommendation,
    confidence: entry.finding.confidence,
    reportingRuns: entry.reportingRuns,
    repairLevel: classifyVisualRepair(entry.finding.rootCause)
  });
}

function deriveReviewedBlockerCrops(provisionalAggregate, reports, cropSources) {
  const bindings = new Map();
  for (const followUp of provisionalAggregate.blockerFollowUps) {
    const affectedSlideIds = new Set();
    for (const run of followUp.reportingRuns) {
      const report = reports[run - 1];
      for (const finding of report.findings) {
        if (finding.severity === "blocker" &&
            finding.dimension === followUp.criterion &&
            finding.rootCause === followUp.rootCause &&
            wholeRegionsAreSimilar(finding.region, followUp.region)) {
          finding.affectedSlideIds.forEach((slideId) => affectedSlideIds.add(slideId));
        }
      }
    }
    const matches = cropSources.filter((source) =>
      affectedSlideIds.has(source.slideId) &&
      wholeRegionsAreSimilar(source.region, followUp.region));
    if (matches.length !== 1) fail("/reports");
    bindings.set(followUp.blockerId, matches[0]);
  }
  return bindings;
}

/**
 * Freeze the label-blind whole-deck reports before outcome reveal. Any blocker
 * request is bound here to the repository-reviewed crop registry; the caller
 * never supplies an expected crop digest.
 */
export function freezeWholeDeckReviewRuns(reports, options) {
  const parsedOptions = consumeWholeDeckEvidence(options);
  const session = parsedOptions.reviewSession;
  const reportValues = arrayValues(reports, "/reports", 3, 3);
  const validated = reportValues.map((report, index) =>
    validateWholeDeckReport(report, `/reports/${index}`));
  const first = validated[0];
  for (let index = 0; index < validated.length; index += 1) {
    const report = validated[index];
    assertSlideSequence(report.orderedSlides, `/reports/${index}/orderedSlides`);
    if (report.reviewRun !== index + 1 || report.reviewId !== first.reviewId ||
        report.reviewContextSha256 !== session.reviewContextSha256 ||
        report.deliveryProfileSha256 !== session.deliveryProfileSha256 ||
        report.contactSheetSha256 !== session.contactSheetSha256 ||
        report.orderedSlides.length !== first.orderedSlides.length ||
        report.orderedSlides.length !== session.deliveryProfile.slides.length) {
      fail(`/reports/${index}`);
    }
    for (let slideIndex = 0; slideIndex < report.orderedSlides.length; slideIndex += 1) {
      const slide = report.orderedSlides[slideIndex];
      if (!sameSlideIdentity(slide, first.orderedSlides[slideIndex]) ||
          slide.slideId !== session.deliveryProfile.slides[slideIndex].slideId) {
        fail(`/reports/${index}/orderedSlides/${slideIndex}`);
      }
    }
  }

  let provisionalAggregate;
  try {
    provisionalAggregate = aggregateVisualReviewRuns(validated.map(projectWholeReport), {
      expectedReviewContextSha256: session.reviewContextSha256,
      expectedBlockerCrops: [],
      blockerFollowUps: []
    });
  } catch {
    fail("/reports");
  }
  const reviewedBlockerCrops = deriveReviewedBlockerCrops(
    provisionalAggregate,
    validated,
    parsedOptions.wholeDeckCropSources
  );
  const blockerRequests = provisionalAggregate.blockerFollowUps.map((followUp) => {
    const source = reviewedBlockerCrops.get(followUp.blockerId);
    if (source === undefined) fail("/reports");
    return deepFreeze({
      blockerId: followUp.blockerId,
      criterion: followUp.criterion,
      rootCause: followUp.rootCause,
      region: followUp.region,
      reportingRuns: followUp.reportingRuns,
      cropEvidenceId: source.cropEvidenceId,
      sourceRenderSha256: source.sourceRenderSha256,
      expectedCropSha256: source.cropSha256
    });
  });
  const core = {
    batchVersion: VISUAL_REVIEW_V2_CONTRACT_VERSION,
    batchType: "whole-deck-review-batch",
    state: "label-blind-frozen",
    evidenceScope: VISUAL_REVIEW_EVIDENCE_SCOPE,
    reviewSessionSha256: session.reviewSessionSha256,
    reviewId: first.reviewId,
    reviewContextSha256: session.reviewContextSha256,
    deliveryProfileSha256: session.deliveryProfileSha256,
    contactSheetSha256: session.contactSheetSha256,
    wholeDeckCropSourceSetSha256: session.wholeDeckCropSourceSetSha256,
    reports: validated,
    blockerRequests
  };
  const wholeDeckBatch = deepFreeze({ ...core, wholeDeckBatchSha256: sha256Json(core) });
  parsedOptions.state.wholeDeckStage = "frozen";
  const wholeDeckReviewToken = opaqueToken(WHOLE_REVIEW_TOKENS, {
    wholeDeckBatch,
    reviewedBlockerCrops,
    reviewSession: session,
    sessionIdentity: parsedOptions.sessionIdentity
  });
  return Object.freeze({ wholeDeckBatch, wholeDeckReviewToken });
}

function buildWholeDeckAggregate(authority, blockerFollowUps) {
  const session = authority.reviewSession;
  const validated = authority.wholeDeckBatch.reports;
  const reviewedBlockerCrops = authority.reviewedBlockerCrops;
  const first = validated[0];
  let legacyAggregate;
  try {
    legacyAggregate = aggregateVisualReviewRuns(validated.map(projectWholeReport), {
      expectedReviewContextSha256: session.reviewContextSha256,
      expectedBlockerCrops: [...reviewedBlockerCrops].map(([blockerId, source]) => ({
        blockerId,
        cropSha256: source.cropSha256
      })),
      blockerFollowUps
    });
  } catch {
    fail("/options/blockerFollowUps");
  }
  const findings = legacyAggregate.findings
    .map((entry) => enrichWholeFinding(
      entry,
      validated,
      legacyAggregate.blockerFollowUps,
      reviewedBlockerCrops
    ))
    .filter((finding) => finding.severity === "blocker" || finding.affectedSlideIds.length > 0);
  const dimensionAssessments = WHOLE_DECK_DIMENSIONS.map((_, index) => {
    const consensus = consensusDimension(validated, index);
    const confirmed = findings.filter((finding) => finding.dimension === consensus.dimension);
    if (confirmed.length === 0 || consensus.status === "concern") return consensus;
    return deepFreeze({
      ...consensus,
      status: "concern",
      reportingRuns: [...new Set(confirmed.flatMap((finding) => finding.reportingRuns))]
        .sort((left, right) => left - right),
      evidence: [...new Set(confirmed.map((finding) => finding.evidence))],
      confidence: Math.min(...confirmed.map((finding) => finding.confidence))
    });
  });
  const status = legacyAggregate.status;
  const hasDismissedBlocker = legacyAggregate.blockerFollowUps
    .some((followUp) => followUp.status === "dismissed");
  const unlocalizedConcernDimensions = dimensionAssessments
    .filter((assessment) => assessment.status === "concern" &&
      !findings.some((finding) => finding.dimension === assessment.dimension))
    .map((assessment) => assessment.dimension);
  let verdict = legacyAggregate.verdict;
  if (status === "follow-up-required") {
    verdict = null;
  } else if (legacyAggregate.verdict === "fail") {
    verdict = "fail";
  } else if (dimensionAssessments.some((assessment) =>
    assessment.status === "unable-to-judge") || unlocalizedConcernDimensions.length > 0) {
    verdict = "unable-to-judge";
  } else if (hasDismissedBlocker ||
      legacyAggregate.verdict === "pass" &&
      dimensionAssessments.some((assessment) => assessment.status === "concern")) {
    verdict = "revise";
  }
  const core = {
    aggregationVersion: VISUAL_REVIEW_V2_CONTRACT_VERSION,
    aggregateType: "whole-deck-review-aggregate",
    status,
    evidenceScope: VISUAL_REVIEW_EVIDENCE_SCOPE,
    reviewId: first.reviewId,
    reviewSessionSha256: session.reviewSessionSha256,
    wholeDeckBatchSha256: authority.wholeDeckBatch.wholeDeckBatchSha256,
    reviewContextSha256: session.reviewContextSha256,
    deliveryProfileSha256: session.deliveryProfileSha256,
    contactSheetSha256: session.contactSheetSha256,
    wholeDeckCropSourceSetSha256: session.wholeDeckCropSourceSetSha256,
    verdict,
    dimensionAssessments,
    unlocalizedConcernDimensions,
    findings,
    blockerFollowUps: legacyAggregate.blockerFollowUps.map((followUp) => {
      const source = reviewedBlockerCrops.get(followUp.blockerId);
      if (source === undefined) fail("/options/blockerFollowUps");
      return deepFreeze({
        ...followUp,
        cropEvidenceId: source.cropEvidenceId,
        sourceRenderSha256: source.sourceRenderSha256,
        expectedCropSha256: source.cropSha256
      });
    }),
    unassessedProperties: [...new Set(validated.flatMap((report) =>
      report.unassessedProperties))].sort(compareCodeUnits)
  };
  const wholeDeckAggregate = deepFreeze({
    ...core,
    wholeDeckAggregateSha256: sha256Json(core)
  });
  const wholeDeckToken = opaqueToken(WHOLE_DECK_TOKENS, {
    wholeDeckAggregate,
    sessionIdentity: authority.sessionIdentity
  });
  return Object.freeze({ wholeDeckAggregate, wholeDeckToken });
}

/** Finalize only an authentic frozen whole-deck batch, optionally with crop follow-up. */
export function finalizeWholeDeckReviewRuns(options) {
  const fields = closedRecord(options, "/options", [
    "blockerFollowUps", "wholeDeckBatch", "wholeDeckReviewToken"
  ]);
  const authority = WHOLE_REVIEW_TOKENS.get(fields.wholeDeckReviewToken);
  if (authority === undefined || authority.wholeDeckBatch !== fields.wholeDeckBatch) {
    fail("/options/wholeDeckReviewToken");
  }
  const result = buildWholeDeckAggregate(authority, fields.blockerFollowUps);
  if (result.wholeDeckAggregate.status === "final") {
    WHOLE_REVIEW_TOKENS.delete(fields.wholeDeckReviewToken);
  }
  return result;
}

function requiredItemResult(reports, authority, reconciliations) {
  const { summaries, idByItem } = deriveRequiredItemIssues(reports, authority.instanceContext);
  const sources = new Map(authority.instanceContext.requiredItemSources
    .map((source) => [source.itemId, source]));
  let pending = false;
  let unable = false;
  let failed = false;
  let revise = false;
  const blindInputs = authority.blindBatch.reports.map((report) => report.inputQuality.status);
  const blindUnusable = blindInputs.filter((status) => status === "unusable").length >= 2;
  const blindDegraded = blindInputs.filter((status) => status !== "ok").length >= 2;
  unable = blindUnusable;
  revise = !blindUnusable && blindDegraded;
  const repairs = [];
  const assessments = summaries.map((summary) => {
    const observedStatuses = summary.statuses.map((entry) => entry.status);
    const observedStatus = highestRequiredStatus(observedStatuses);
    const reconciliationId = idByItem.get(summary.itemId) ?? null;
    const reconciliation = reconciliationId === null
      ? null
      : reconciliations.get(reconciliationId) ?? null;
    const source = sources.get(summary.itemId);
    let aggregateStatus = "matched";
    let repairLevel = null;
    if (reconciliationId !== null && reconciliation === null) {
      aggregateStatus = "reconciliation-required";
      pending = true;
    } else if (reconciliation !== null) {
      aggregateStatus = reconciliation.resolution;
      if (reconciliation.resolution === "unable-to-resolve") {
        unable = true;
      } else if (reconciliation.resolution === "confirmed-failure") {
        if (observedStatus === "missing" || observedStatus === "incorrect") failed = true;
        else if (observedStatus === "incomplete") revise = true;
        else unable = true;
        repairLevel = observedStatus === "incorrect" ? "pivot" : "replan";
        repairs.push(deepFreeze({
          scope: "required-item",
          itemId: summary.itemId,
          rootCause: observedStatus === "incorrect"
            ? "incorrect-central-claim"
            : observedStatus === "missing"
              ? "missing-evidence"
              : observedStatus === "incomplete"
                ? "incomplete-evidence"
                : "unclear-primary-message",
          repairLevel
        }));
      } else if (reconciliation.resolution === "dismissed-failure") {
        // A caller-supplied simulated follow-up may clear the asserted failure,
        // but it is not independent authority for a clean pass. Only three
        // initially matched runs can produce a required-item pass in 0.2.0.
        revise = true;
      }
    }
    return deepFreeze({
      itemId: summary.itemId,
      itemKind: summary.itemKind,
      observedStatus,
      statuses: summary.statuses,
      reconciliationId,
      aggregateStatus,
      repairLevel,
      sourceRenderSha256: reconciliationId === null ? null : source.sourceRenderSha256,
      cropSha256: reconciliationId === null ? null : source.cropSha256,
      followUpReviewId: reconciliation?.followUpReviewId ?? null,
      evidence: reconciliation?.evidence ?? null,
      confidence: reconciliation?.confidence ?? null
    });
  });
  return deepFreeze({
    status: pending ? "follow-up-required" : "final",
    verdict: pending ? null : failed ? "fail" : unable ? "unable-to-judge" : revise ? "revise" : "pass",
    blindInputStatus: blindUnusable ? "unusable" : blindDegraded ? "degraded" : "ok",
    assessments,
    repairs
  });
}

function combineVerdicts(required, whole) {
  if (required.status === "follow-up-required" || whole.status === "follow-up-required") {
    return { status: "follow-up-required", verdict: null };
  }
  if (required.verdict === "fail" || whole.verdict === "fail") {
    return { status: "final", verdict: "fail" };
  }
  if (required.verdict === "unable-to-judge" || whole.verdict === "unable-to-judge") {
    return { status: "final", verdict: "unable-to-judge" };
  }
  if (required.verdict === "revise" || whole.verdict === "revise") {
    return { status: "final", verdict: "revise" };
  }
  return { status: "final", verdict: "pass" };
}

/**
 * Reconcile every required-item disagreement and combine it with the
 * independently label-blind whole-deck lane. This is simulated review
 * evidence; it never claims observed audience comprehension.
 */
export function finalizeVisualReviewV2(options) {
  const fields = closedRecord(options, "/options", [
    "instanceReports", "reconciliationToken", "requiredItemReconciliations",
    "wholeDeckAggregate", "wholeDeckToken"
  ]);
  const reconciliationAuthority = RECONCILIATION_TOKENS.get(fields.reconciliationToken);
  if (reconciliationAuthority === undefined) fail("/options/reconciliationToken");
  const wholeAuthority = WHOLE_DECK_TOKENS.get(fields.wholeDeckToken);
  if (wholeAuthority === undefined ||
      wholeAuthority.wholeDeckAggregate !== fields.wholeDeckAggregate ||
      wholeAuthority.sessionIdentity !== reconciliationAuthority.sessionIdentity) {
    fail("/options/wholeDeckToken");
  }
  const context = reconciliationAuthority.instanceContext;
  const whole = wholeAuthority.wholeDeckAggregate;
  if (context.reviewId !== whole.reviewId ||
      context.reviewSessionSha256 !== whole.reviewSessionSha256 ||
      context.reviewContextSha256 !== whole.reviewContextSha256 ||
      context.deliveryProfileSha256 !== whole.deliveryProfileSha256 ||
      context.contactSheetSha256 !== whole.contactSheetSha256) {
    fail("/options/wholeDeckAggregate");
  }
  const reports = validateInstanceRuns(fields.instanceReports, reconciliationAuthority);
  const issueState = deriveRequiredItemIssues(reports, context);
  const reconciliations = validateRequiredItemReconciliations(
    fields.requiredItemReconciliations,
    reconciliationAuthority,
    issueState.idByItem
  );
  const requiredItemStatus = requiredItemResult(
    reports,
    reconciliationAuthority,
    reconciliations
  );
  const combined = combineVerdicts(requiredItemStatus, whole);
  const wholeDeckStatus = deepFreeze({
    status: whole.status,
    verdict: whole.verdict,
    dimensionAssessments: whole.dimensionAssessments,
    unlocalizedConcernDimensions: whole.unlocalizedConcernDimensions,
    findings: whole.findings,
    blockerFollowUps: whole.blockerFollowUps
  });
  const repairs = [
    ...requiredItemStatus.repairs,
    ...whole.findings.map((finding) => deepFreeze({
      scope: "whole-deck",
      dimension: finding.dimension,
      rootCause: finding.rootCause,
      repairLevel: finding.repairLevel,
      affectedSlideIds: finding.affectedSlideIds
    }))
  ];
  const unassessedProperties = [...new Set([
    ...whole.unassessedProperties,
    ...reports.flatMap((report) => report.unassessedProperties)
  ])].sort(compareCodeUnits);
  const core = {
    reviewVersion: VISUAL_REVIEW_V2_CONTRACT_VERSION,
    reviewType: "visual-review-final",
    status: combined.status,
    evidenceScope: VISUAL_REVIEW_EVIDENCE_SCOPE,
    reviewId: context.reviewId,
    reviewSessionSha256: context.reviewSessionSha256,
    reviewContextSha256: context.reviewContextSha256,
    renderSetSha256: context.renderSetSha256,
    contactSheetSha256: context.contactSheetSha256,
    deliveryProfileSha256: context.deliveryProfileSha256,
    assemblyReceiptSha256: context.assemblyReceiptSha256,
    requiredItemSourceSetSha256: context.requiredItemSourceSetSha256,
    wholeDeckCropSourceSetSha256: whole.wholeDeckCropSourceSetSha256,
    blindBatchSha256: context.blindBatchSha256,
    instanceContextSha256: context.instanceContextSha256,
    wholeDeckAggregateSha256: whole.wholeDeckAggregateSha256,
    verdict: combined.verdict,
    requiredItemStatus,
    wholeDeckStatus,
    repairs,
    unassessedProperties
  };
  return deepFreeze({ ...core, finalReviewSha256: sha256Json(core) });
}
