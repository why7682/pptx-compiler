import { createHash } from "node:crypto";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { SECURE_ZIP_LIMITS } from "./secure-zip.mjs";
import { resolveSlideLayoutIr, SlideLayoutIrError } from "./slide-layout-ir.mjs";

export const CANDIDATE_BUILD_RECORD_VERSION = "0.1.0";
export const CANDIDATE_BUILD_RECORD_MAX_BYTES = 256 * 1024;

const decoder = new TextDecoder("utf-8", { fatal: true });
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength"
).get;
const SHA256 = /^[0-9a-f]{64}$/u;
const CANDIDATE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,239}\.[Pp][Pp][Tt][Xx]$/u;
const SLIDE_PART = /^ppt\/slides\/slide[1-9][0-9]*\.xml$/u;
const SLIDE_RELS_PART = /^ppt\/slides\/_rels\/slide[1-9][0-9]*\.xml\.rels$/u;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const RELATIONSHIP_ID = /^rId[1-9][0-9]*$/u;
const ORDERED_ASSEMBLY_VERSION = "0.1.0";
const MIN_ORDERED_SLIDES = 2;
const MAX_ORDERED_SLIDES = 16;

const SOURCE_PROFILES = Object.freeze({
  "native-card-arrow-assembled-pptx": Object.freeze({
    verificationProfile: "target-specific-native-card-arrow-output",
    evidenceType: "native-card-arrow",
    diffReason: "native-card-arrow-insertion",
    sourceRef: "native-card-arrow",
    orderedBuildType: "native-card-arrow-source"
  }),
  "native-omml-formula-assembled-pptx": Object.freeze({
    verificationProfile: "target-specific-native-omml-formula-output",
    evidenceType: "native-omml-formula",
    diffReason: "native-omml-formula-replacement",
    sourceRef: "native-omml-formula",
    orderedBuildType: "native-omml-formula-source"
  })
});
const ORDERED_SOURCE_PROFILES = Object.freeze(Object.fromEntries(
  Object.entries(SOURCE_PROFILES).map(([artifactType, profile]) => [
    profile.orderedBuildType,
    Object.freeze({ artifactType, ...profile })
  ])
));

const ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "CANDIDATE_BUILD_RECORD_ARGUMENT_INVALID",
  ARTIFACT_MISMATCH: "CANDIDATE_BUILD_RECORD_ARTIFACT_MISMATCH",
  RECORD_INVALID: "CANDIDATE_BUILD_RECORD_INVALID",
  REPLAY_MISMATCH: "CANDIDATE_BUILD_RECORD_REPLAY_MISMATCH"
});

export class CandidateBuildRecordError extends Error {
  constructor(code, pointer) {
    super(`${code} at ${pointer}`);
    this.name = "CandidateBuildRecordError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer) {
  throw new CandidateBuildRecordError(code, pointer);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function snapshotBuffer(value, pointer, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Buffer.isBuffer(value)) fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  let byteLength;
  let snapshot;
  try {
    byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(value);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  if (byteLength < 1 || byteLength > maximum) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  try {
    snapshot = Buffer.from(value);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  if (snapshot.length !== byteLength) fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  return snapshot;
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function exactRecord(value, expectedKeys, pointer, code = ERROR_CODES.RECORD_INVALID) {
  if (!isPlainRecord(value)) fail(code, pointer);
  let descriptors;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(code, pointer);
  }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))) {
    fail(code, pointer);
  }
  const fields = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(code, `${pointer}/${key}`);
    }
    fields[key] = descriptor.value;
  }
  return fields;
}

function exactArray(value, pointer, minimum, maximum, code = ERROR_CODES.RECORD_INVALID) {
  let isArray;
  let prototype;
  let descriptors;
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(code, pointer);
  }
  const length = descriptors.length?.value;
  if (!isArray || prototype !== Array.prototype || !Number.isSafeInteger(length) ||
      length < minimum || length > maximum ||
      Reflect.ownKeys(descriptors).length !== length + 1) {
    fail(code, pointer);
  }
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(code, `${pointer}/${index}`);
    }
    result.push(descriptor.value);
  }
  return result;
}

function integer(value, minimum, maximum, pointer) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(ERROR_CODES.RECORD_INVALID, pointer);
  }
  return value;
}

function exactString(value, expected, pointer) {
  if (value !== expected) fail(ERROR_CODES.RECORD_INVALID, pointer);
  return value;
}

function sha(value, pointer) {
  if (typeof value !== "string" || !SHA256.test(value)) {
    fail(ERROR_CODES.RECORD_INVALID, pointer);
  }
  return value;
}

function candidateFileName(value, pointer) {
  if (typeof value !== "string" || !CANDIDATE_FILE_NAME.test(value) ||
      path.basename(value) !== value || value === "." || value === "..") {
    fail(ERROR_CODES.RECORD_INVALID, pointer);
  }
  return value;
}

function slidePart(value, pointer) {
  if (typeof value !== "string" || value.length > 64 || !SLIDE_PART.test(value)) {
    fail(ERROR_CODES.RECORD_INVALID, pointer);
  }
  return value;
}

function slideRelationshipsPart(value, pointer) {
  if (typeof value !== "string" || value.length > 80 || !SLIDE_RELS_PART.test(value)) {
    fail(ERROR_CODES.RECORD_INVALID, pointer);
  }
  return value;
}

function semanticId(value, pointer) {
  if (typeof value !== "string" || value.length < 1 || value.length > 96 ||
      !SEMANTIC_ID.test(value)) {
    fail(ERROR_CODES.RECORD_INVALID, pointer);
  }
  return value;
}

function relationshipId(value, pointer) {
  if (typeof value !== "string" || value.length > 16 || !RELATIONSHIP_ID.test(value)) {
    fail(ERROR_CODES.RECORD_INVALID, pointer);
  }
  return value;
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJsonValue(value, pointer = "") {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail(ERROR_CODES.RECORD_INVALID, pointer || "/");
    return value;
  }
  if (Array.isArray(value)) {
    return exactArray(value, pointer || "/", 0, 32_640)
      .map((item, index) => canonicalJsonValue(item, `${pointer}/${index}`));
  }
  if (!isPlainRecord(value)) fail(ERROR_CODES.RECORD_INVALID, pointer || "/");
  let descriptors;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(ERROR_CODES.RECORD_INVALID, pointer || "/");
  }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) {
    fail(ERROR_CODES.RECORD_INVALID, pointer || "/");
  }
  const result = {};
  for (const key of [...keys].sort()) {
    const descriptor = descriptors[key];
    if (!("value" in descriptor) || descriptor.enumerable !== true ||
        descriptor.value === undefined) {
      fail(ERROR_CODES.RECORD_INVALID, `${pointer}/${key}`);
    }
    result[key] = canonicalJsonValue(descriptor.value, `${pointer}/${key}`);
  }
  return result;
}

function freezeJson(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function canonicalRecordBytes(record) {
  const canonical = canonicalJsonValue(record);
  const source = `${JSON.stringify(canonical, null, 2)}\n`;
  if (source.length > CANDIDATE_BUILD_RECORD_MAX_BYTES ||
      Buffer.byteLength(source, "utf8") > CANDIDATE_BUILD_RECORD_MAX_BYTES) {
    fail(ERROR_CODES.RECORD_INVALID, "/");
  }
  const bytes = Buffer.from(source, "utf8");
  return { canonical: freezeJson(canonical), bytes };
}

function validateDiff(value, slidePartValue, sourceProfile, pointer = "/slide/diff") {
  const fields = exactRecord(value, [
    "addedParts",
    "removedParts",
    "modifiedParts",
    "allowedChanges",
    "collateralChanges"
  ], pointer);
  for (const key of ["addedParts", "removedParts", "collateralChanges"]) {
    if (exactArray(fields[key], `${pointer}/${key}`, 0, 0).length !== 0) {
      fail(ERROR_CODES.RECORD_INVALID, `${pointer}/${key}`);
    }
  }
  const modified = exactArray(fields.modifiedParts, `${pointer}/modifiedParts`, 1, 1);
  exactString(modified[0], slidePartValue, `${pointer}/modifiedParts/0`);
  const changes = exactArray(fields.allowedChanges, `${pointer}/allowedChanges`, 1, 1);
  const change = exactRecord(
    changes[0],
    ["partPath", "reason"],
    `${pointer}/allowedChanges/0`
  );
  exactString(change.partPath, slidePartValue, `${pointer}/allowedChanges/0/partPath`);
  exactString(
    change.reason,
    sourceProfile.diffReason,
    `${pointer}/allowedChanges/0/reason`
  );
}

function validateBox(value, pointer) {
  const fields = exactRecord(value, ["x", "y", "cx", "cy"], pointer);
  return {
    x: integer(fields.x, 0, 100_000_000, `${pointer}/x`),
    y: integer(fields.y, 0, 100_000_000, `${pointer}/y`),
    cx: integer(fields.cx, 1, 100_000_000, `${pointer}/cx`),
    cy: integer(fields.cy, 1, 100_000_000, `${pointer}/cy`)
  };
}

function validateNativeCardEvidence(value, pointer = "/slide/capabilityEvidence") {
  const fields = exactRecord(
    value,
    ["evidenceType", "allocatedShapeIds"],
    pointer
  );
  exactString(fields.evidenceType, "native-card-arrow", `${pointer}/evidenceType`);
  const ids = exactArray(
    fields.allocatedShapeIds,
    `${pointer}/allocatedShapeIds`,
    3,
    3
  );
  const seen = new Set();
  for (let index = 0; index < ids.length; index += 1) {
    integer(ids[index], 1, 4_294_967_295, `${pointer}/allocatedShapeIds/${index}`);
    if (seen.has(ids[index])) {
      fail(ERROR_CODES.RECORD_INVALID, `${pointer}/allocatedShapeIds/${index}`);
    }
    seen.add(ids[index]);
  }
}

function validateFormulaEvidence(
  value,
  composedSlidePlan,
  pointer = "/slide/capabilityEvidence"
) {
  const fields = exactRecord(
    value,
    ["evidenceType", "formulaDigest", "formulaTarget"],
    pointer
  );
  exactString(fields.evidenceType, "native-omml-formula", `${pointer}/evidenceType`);
  sha(fields.formulaDigest, `${pointer}/formulaDigest`);
  const target = exactRecord(fields.formulaTarget, [
    "targetShapeKey",
    "sourceId",
    "geometry",
    "structureProfile",
    "fontSizeHundredthPoints",
    "typeface",
    "capacity",
    "observed",
    "status"
  ], `${pointer}/formulaTarget`);
  if (typeof target.targetShapeKey !== "string" || target.targetShapeKey.length < 1 ||
      target.targetShapeKey.length > 96 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(target.targetShapeKey)) {
    fail(ERROR_CODES.RECORD_INVALID, `${pointer}/formulaTarget/targetShapeKey`);
  }
  integer(target.sourceId, 1, 4_294_967_295, `${pointer}/formulaTarget/sourceId`);
  const geometry = validateBox(
    target.geometry,
    `${pointer}/formulaTarget/geometry`
  );
  exactString(
    target.structureProfile,
    "powerpoint-office-2010-text-math",
    `${pointer}/formulaTarget/structureProfile`
  );
  integer(
    target.fontSizeHundredthPoints,
    4_800,
    4_800,
    `${pointer}/formulaTarget/fontSizeHundredthPoints`
  );
  exactString(target.typeface, "Cambria Math", `${pointer}/formulaTarget/typeface`);
  exactString(target.status, "pass", `${pointer}/formulaTarget/status`);
  const capacity = exactRecord(
    target.capacity,
    ["maxElements", "maxRuns", "maxTextBytes"],
    `${pointer}/formulaTarget/capacity`
  );
  integer(capacity.maxElements, 64, 64, `${pointer}/formulaTarget/capacity/maxElements`);
  integer(capacity.maxRuns, 16, 16, `${pointer}/formulaTarget/capacity/maxRuns`);
  integer(capacity.maxTextBytes, 256, 256, `${pointer}/formulaTarget/capacity/maxTextBytes`);
  const observed = exactRecord(
    target.observed,
    ["elements", "runs", "textBytes"],
    `${pointer}/formulaTarget/observed`
  );
  integer(observed.elements, 1, 64, `${pointer}/formulaTarget/observed/elements`);
  integer(observed.runs, 1, 16, `${pointer}/formulaTarget/observed/runs`);
  integer(observed.textBytes, 1, 256, `${pointer}/formulaTarget/observed/textBytes`);
  const formulaNode = composedSlidePlan.nodes.find((node) =>
    node.sourceKind === "native-component" && node.sourceRef === "native-omml-formula");
  if (formulaNode === undefined || !isDeepStrictEqual(formulaNode.box, geometry)) {
    fail(ERROR_CODES.REPLAY_MISMATCH, `${pointer}/formulaTarget/geometry`);
  }
}

function validateDirectRecord(record, candidateSnapshot, expectedCandidateFileName) {
  const fields = exactRecord(record, [
    "schemaVersion",
    "contractType",
    "candidateVersion",
    "artifactType",
    "verificationProfile",
    "deliveryEligible",
    "sourceArtifactType",
    "sourceVerificationProfile",
    "baseArtifactSha256",
    "output",
    "slide"
  ], "/");
  exactString(fields.schemaVersion, CANDIDATE_BUILD_RECORD_VERSION, "/schemaVersion");
  exactString(fields.contractType, "candidate-build-record", "/contractType");
  exactString(fields.candidateVersion, CANDIDATE_BUILD_RECORD_VERSION, "/candidateVersion");
  exactString(fields.artifactType, "candidate-pptx", "/artifactType");
  exactString(
    fields.verificationProfile,
    "authenticated-native-candidate-artifact",
    "/verificationProfile"
  );
  if (fields.deliveryEligible !== false) fail(ERROR_CODES.RECORD_INVALID, "/deliveryEligible");
  const sourceProfile = SOURCE_PROFILES[fields.sourceArtifactType];
  if (sourceProfile === undefined) fail(ERROR_CODES.RECORD_INVALID, "/sourceArtifactType");
  exactString(
    fields.sourceVerificationProfile,
    sourceProfile.verificationProfile,
    "/sourceVerificationProfile"
  );
  sha(fields.baseArtifactSha256, "/baseArtifactSha256");

  const output = exactRecord(fields.output, ["fileName", "sha256", "byteLength"], "/output");
  const fileName = candidateFileName(output.fileName, "/output/fileName");
  if (fileName !== expectedCandidateFileName) {
    fail(ERROR_CODES.ARTIFACT_MISMATCH, "/output/fileName");
  }
  if (sha(output.sha256, "/output/sha256") !== sha256(candidateSnapshot)) {
    fail(ERROR_CODES.ARTIFACT_MISMATCH, "/output/sha256");
  }
  if (integer(output.byteLength, 1, Number.MAX_SAFE_INTEGER, "/output/byteLength") !==
      candidateSnapshot.length) {
    fail(ERROR_CODES.ARTIFACT_MISMATCH, "/output/byteLength");
  }

  const slide = exactRecord(fields.slide, [
    "slideId",
    "slidePart",
    "layoutIr",
    "composedSlidePlan",
    "diff",
    "capabilityEvidence"
  ], "/slide");
  const part = slidePart(slide.slidePart, "/slide/slidePart");
  let replayed;
  try {
    if (slide.layoutIr?.inputProfile !== "bounded-slot-placement") {
      fail(ERROR_CODES.RECORD_INVALID, "/slide/layoutIr/inputProfile");
    }
    replayed = resolveSlideLayoutIr(slide.layoutIr);
  } catch (error) {
    if (error instanceof CandidateBuildRecordError) throw error;
    if (error instanceof SlideLayoutIrError) {
      fail(ERROR_CODES.REPLAY_MISMATCH, "/slide/layoutIr");
    }
    throw error;
  }
  if (!isDeepStrictEqual(replayed, slide.composedSlidePlan)) {
    fail(ERROR_CODES.REPLAY_MISMATCH, "/slide/composedSlidePlan");
  }
  if (slide.slideId !== replayed.slideId) {
    fail(ERROR_CODES.REPLAY_MISMATCH, "/slide/slideId");
  }
  const nativeNodes = replayed.nodes.filter((node) => node.sourceKind === "native-component");
  const placement = slide.layoutIr.placementRequests[0];
  const slot = slide.layoutIr.slots[0];
  if (nativeNodes.length !== 1 || nativeNodes[0].sourceRef !== sourceProfile.sourceRef ||
      nativeNodes[0].nodeId !== placement.nodeId ||
      placement.sourceKind !== "native-component" ||
      placement.sourceRef !== sourceProfile.sourceRef ||
      slot.allowedSourceKind !== "native-component" ||
      slot.allowedSourceRef !== sourceProfile.sourceRef) {
    fail(ERROR_CODES.REPLAY_MISMATCH, "/slide/layoutIr/placementRequests/0/sourceRef");
  }
  validateDiff(slide.diff, part, sourceProfile);
  const evidenceFields = exactRecord(
    slide.capabilityEvidence,
    Object.keys(slide.capabilityEvidence ?? {}),
    "/slide/capabilityEvidence"
  );
  if (evidenceFields.evidenceType !== sourceProfile.evidenceType) {
    fail(ERROR_CODES.RECORD_INVALID, "/slide/capabilityEvidence/evidenceType");
  }
  if (sourceProfile.evidenceType === "native-card-arrow") {
    validateNativeCardEvidence(slide.capabilityEvidence);
  } else {
    validateFormulaEvidence(slide.capabilityEvidence, replayed);
  }
  return record;
}

function recordDiscriminator(record) {
  if (!isPlainRecord(record)) fail(ERROR_CODES.RECORD_INVALID, "/");
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, "sourceArtifactType");
  } catch {
    fail(ERROR_CODES.RECORD_INVALID, "/sourceArtifactType");
  }
  if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true ||
      typeof descriptor.value !== "string") {
    fail(ERROR_CODES.RECORD_INVALID, "/sourceArtifactType");
  }
  return descriptor.value;
}

function validateOrderedNativeSource(value, slideIdValue, pointer, sourceProfile) {
  const fields = exactRecord(value, [
    "buildType",
    "artifactType",
    "verificationProfile",
    "baseArtifactSha256",
    "sourceSlidePart",
    "layoutIr",
    "composedSlidePlan",
    "diff",
    "capabilityEvidence"
  ], pointer);
  exactString(fields.buildType, sourceProfile.orderedBuildType, `${pointer}/buildType`);
  exactString(
    fields.artifactType,
    sourceProfile.artifactType,
    `${pointer}/artifactType`
  );
  exactString(
    fields.verificationProfile,
    sourceProfile.verificationProfile,
    `${pointer}/verificationProfile`
  );
  sha(fields.baseArtifactSha256, `${pointer}/baseArtifactSha256`);
  const sourceSlidePart = slidePart(fields.sourceSlidePart, `${pointer}/sourceSlidePart`);
  let replayed;
  try {
    if (fields.layoutIr?.inputProfile !== "bounded-slot-placement") {
      fail(ERROR_CODES.RECORD_INVALID, `${pointer}/layoutIr/inputProfile`);
    }
    replayed = resolveSlideLayoutIr(fields.layoutIr);
  } catch (error) {
    if (error instanceof CandidateBuildRecordError) throw error;
    if (error instanceof SlideLayoutIrError) {
      fail(ERROR_CODES.REPLAY_MISMATCH, `${pointer}/layoutIr`);
    }
    throw error;
  }
  if (!isDeepStrictEqual(replayed, fields.composedSlidePlan)) {
    fail(ERROR_CODES.REPLAY_MISMATCH, `${pointer}/composedSlidePlan`);
  }
  if (replayed.slideId !== slideIdValue) {
    fail(ERROR_CODES.REPLAY_MISMATCH, `${pointer}/layoutIr/slideId`);
  }
  const placement = fields.layoutIr.placementRequests[0];
  const slot = fields.layoutIr.slots[0];
  const nativeNodes = replayed.nodes.filter((node) => node.sourceKind === "native-component");
  if (nativeNodes.length !== 1 || nativeNodes[0].sourceRef !== sourceProfile.sourceRef ||
      nativeNodes[0].nodeId !== placement.nodeId ||
      placement.sourceKind !== "native-component" ||
      placement.sourceRef !== sourceProfile.sourceRef ||
      slot.allowedSourceKind !== "native-component" ||
      slot.allowedSourceRef !== sourceProfile.sourceRef) {
    fail(ERROR_CODES.REPLAY_MISMATCH, `${pointer}/layoutIr/placementRequests/0/sourceRef`);
  }
  validateDiff(fields.diff, sourceSlidePart, sourceProfile, `${pointer}/diff`);
  const evidencePointer = `${pointer}/capabilityEvidence`;
  if (sourceProfile.evidenceType === "native-card-arrow") {
    validateNativeCardEvidence(fields.capabilityEvidence, evidencePointer);
  } else {
    validateFormulaEvidence(fields.capabilityEvidence, replayed, evidencePointer);
  }
  return sourceProfile.orderedBuildType;
}

function validateOrderedSource(value, slideIdValue, pointer) {
  if (!isPlainRecord(value)) fail(ERROR_CODES.RECORD_INVALID, pointer);
  let buildType;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, "buildType");
    if (descriptor === undefined || !("value" in descriptor) ||
        descriptor.enumerable !== true) {
      fail(ERROR_CODES.RECORD_INVALID, `${pointer}/buildType`);
    }
    buildType = descriptor.value;
  } catch (error) {
    if (error instanceof CandidateBuildRecordError) throw error;
    fail(ERROR_CODES.RECORD_INVALID, `${pointer}/buildType`);
  }
  if (buildType === "clone-fill-source") {
    const fields = exactRecord(value, ["buildType", "artifactType"], pointer);
    exactString(fields.buildType, "clone-fill-source", `${pointer}/buildType`);
    exactString(fields.artifactType, "assembled-pptx", `${pointer}/artifactType`);
    return buildType;
  }
  const sourceProfile = ORDERED_SOURCE_PROFILES[buildType];
  if (sourceProfile !== undefined) {
    return validateOrderedNativeSource(value, slideIdValue, pointer, sourceProfile);
  }
  fail(ERROR_CODES.RECORD_INVALID, `${pointer}/buildType`);
}

function exactOrderedArray(value, expected, pointer) {
  const actual = exactArray(value, pointer, expected.length, expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    exactString(actual[index], expected[index], `${pointer}/${index}`);
  }
  return actual;
}

function orderedChangeReason(partPathValue) {
  if (partPathValue === "[Content_Types].xml") return "ordered-slide-content-types";
  if (partPathValue === "ppt/_rels/presentation.xml.rels") {
    return "ordered-slide-relationships";
  }
  if (partPathValue === "ppt/presentation.xml") return "ordered-slide-owner-list";
  if (SLIDE_RELS_PART.test(partPathValue)) return "normalized-slide-layout-relationship";
  if (SLIDE_PART.test(partPathValue)) return "cloned-slide-content";
  return null;
}

function validateOrderedDiff(value, slideCount) {
  const pointer = "/deck/diff";
  const fields = exactRecord(value, [
    "addedParts",
    "removedParts",
    "modifiedParts",
    "allowedChanges",
    "collateralChanges"
  ], pointer);
  exactArray(fields.removedParts, `${pointer}/removedParts`, 0, 0);
  exactArray(fields.collateralChanges, `${pointer}/collateralChanges`, 0, 0);
  const expectedAdded = [];
  for (let index = 1; index < slideCount; index += 1) {
    expectedAdded.push(
      `ppt/slides/slide${index + 1}.xml`,
      `ppt/slides/_rels/slide${index + 1}.xml.rels`
    );
  }
  expectedAdded.sort(compareCodeUnits);
  exactOrderedArray(fields.addedParts, expectedAdded, `${pointer}/addedParts`);

  const requiredModified = [
    "[Content_Types].xml",
    "ppt/_rels/presentation.xml.rels",
    "ppt/presentation.xml"
  ].sort(compareCodeUnits);
  const withNormalizedFirstRelationship = [
    ...requiredModified,
    "ppt/slides/_rels/slide1.xml.rels"
  ].sort(compareCodeUnits);
  const modified = exactArray(fields.modifiedParts, `${pointer}/modifiedParts`, 3, 4);
  const expectedModified = modified.length === 3
    ? requiredModified
    : withNormalizedFirstRelationship;
  exactOrderedArray(modified, expectedModified, `${pointer}/modifiedParts`);

  const changed = [...expectedAdded, ...expectedModified].sort(compareCodeUnits);
  const allowed = exactArray(
    fields.allowedChanges,
    `${pointer}/allowedChanges`,
    changed.length,
    changed.length
  );
  for (let index = 0; index < changed.length; index += 1) {
    const changePointer = `${pointer}/allowedChanges/${index}`;
    const change = exactRecord(allowed[index], ["partPath", "reason"], changePointer);
    exactString(change.partPath, changed[index], `${changePointer}/partPath`);
    exactString(
      change.reason,
      orderedChangeReason(changed[index]),
      `${changePointer}/reason`
    );
  }
}

function validateOrderedRecord(record, candidateSnapshot, expectedCandidateFileName) {
  const fields = exactRecord(record, [
    "schemaVersion",
    "contractType",
    "candidateVersion",
    "artifactType",
    "verificationProfile",
    "deliveryEligible",
    "sourceArtifactType",
    "baseArtifactSha256",
    "output",
    "deck"
  ], "/");
  exactString(fields.schemaVersion, CANDIDATE_BUILD_RECORD_VERSION, "/schemaVersion");
  exactString(fields.contractType, "candidate-build-record", "/contractType");
  exactString(fields.candidateVersion, CANDIDATE_BUILD_RECORD_VERSION, "/candidateVersion");
  exactString(fields.artifactType, "candidate-pptx", "/artifactType");
  exactString(
    fields.verificationProfile,
    "authenticated-ordered-candidate-artifact",
    "/verificationProfile"
  );
  if (fields.deliveryEligible !== false) fail(ERROR_CODES.RECORD_INVALID, "/deliveryEligible");
  exactString(fields.sourceArtifactType, "ordered-assembled-pptx", "/sourceArtifactType");
  sha(fields.baseArtifactSha256, "/baseArtifactSha256");

  const output = exactRecord(fields.output, ["fileName", "sha256", "byteLength"], "/output");
  const fileName = candidateFileName(output.fileName, "/output/fileName");
  if (fileName !== expectedCandidateFileName) {
    fail(ERROR_CODES.ARTIFACT_MISMATCH, "/output/fileName");
  }
  if (sha(output.sha256, "/output/sha256") !== sha256(candidateSnapshot)) {
    fail(ERROR_CODES.ARTIFACT_MISMATCH, "/output/sha256");
  }
  if (integer(output.byteLength, 1, Number.MAX_SAFE_INTEGER, "/output/byteLength") !==
      candidateSnapshot.length) {
    fail(ERROR_CODES.ARTIFACT_MISMATCH, "/output/byteLength");
  }

  const deck = exactRecord(fields.deck, [
    "assemblyVersion",
    "slides",
    "diff"
  ], "/deck");
  exactString(deck.assemblyVersion, ORDERED_ASSEMBLY_VERSION, "/deck/assemblyVersion");
  const slides = exactArray(
    deck.slides,
    "/deck/slides",
    MIN_ORDERED_SLIDES,
    MAX_ORDERED_SLIDES
  );
  const slideIds = new Set();
  for (let index = 0; index < slides.length; index += 1) {
    const pointer = `/deck/slides/${index}`;
    const slide = exactRecord(slides[index], [
      "slideId",
      "order",
      "slidePart",
      "relationshipsPartPath",
      "presentationSlideId",
      "relationshipId",
      "sourceArtifactSha256",
      "sourceBuild"
    ], pointer);
    const slideIdValue = semanticId(slide.slideId, `${pointer}/slideId`);
    if (slideIds.has(slideIdValue)) fail(ERROR_CODES.RECORD_INVALID, `${pointer}/slideId`);
    slideIds.add(slideIdValue);
    integer(slide.order, index + 1, index + 1, `${pointer}/order`);
    exactString(
      slidePart(slide.slidePart, `${pointer}/slidePart`),
      `ppt/slides/slide${index + 1}.xml`,
      `${pointer}/slidePart`
    );
    exactString(
      slideRelationshipsPart(slide.relationshipsPartPath, `${pointer}/relationshipsPartPath`),
      `ppt/slides/_rels/slide${index + 1}.xml.rels`,
      `${pointer}/relationshipsPartPath`
    );
    integer(
      slide.presentationSlideId,
      256 + index,
      256 + index,
      `${pointer}/presentationSlideId`
    );
    exactString(
      relationshipId(slide.relationshipId, `${pointer}/relationshipId`),
      `rId${4 + index}`,
      `${pointer}/relationshipId`
    );
    sha(slide.sourceArtifactSha256, `${pointer}/sourceArtifactSha256`);
    validateOrderedSource(slide.sourceBuild, slideIdValue, `${pointer}/sourceBuild`);
  }
  if (fields.baseArtifactSha256 !== slides[0].sourceArtifactSha256) {
    fail(ERROR_CODES.REPLAY_MISMATCH, "/baseArtifactSha256");
  }
  validateOrderedDiff(deck.diff, slides.length);
  return record;
}

function validateRecord(record, candidateSnapshot, expectedCandidateFileName) {
  return recordDiscriminator(record) === "ordered-assembled-pptx"
    ? validateOrderedRecord(record, candidateSnapshot, expectedCandidateFileName)
    : validateDirectRecord(record, candidateSnapshot, expectedCandidateFileName);
}

function constructionOptions(value) {
  return exactRecord(value, [
    "candidateBytes",
    "candidateFileName",
    "sourceArtifactType",
    "sourceVerificationProfile",
    "baseArtifactSha256",
    "slideId",
    "slidePart",
    "layoutIr",
    "composedSlidePlan",
    "diff",
    "capabilityEvidence"
  ], "/options", ERROR_CODES.ARGUMENT_INVALID);
}

/**
 * Serialize already-authenticated assembly facts into a detached, canonical
 * candidate record. Authentication belongs to the caller; this function owns
 * closed structure, replay validation, and deterministic JSON bytes.
 */
export function createCandidateBuildRecord(value) {
  const fields = constructionOptions(value);
  const candidateSnapshot = snapshotBuffer(
    fields.candidateBytes,
    "/options/candidateBytes",
    SECURE_ZIP_LIMITS.maxArchiveBytes
  );
  const fileName = candidateFileName(fields.candidateFileName, "/options/candidateFileName");
  const record = {
    schemaVersion: CANDIDATE_BUILD_RECORD_VERSION,
    contractType: "candidate-build-record",
    candidateVersion: CANDIDATE_BUILD_RECORD_VERSION,
    artifactType: "candidate-pptx",
    verificationProfile: "authenticated-native-candidate-artifact",
    deliveryEligible: false,
    sourceArtifactType: fields.sourceArtifactType,
    sourceVerificationProfile: fields.sourceVerificationProfile,
    baseArtifactSha256: fields.baseArtifactSha256,
    output: {
      fileName,
      sha256: sha256(candidateSnapshot),
      byteLength: candidateSnapshot.length
    },
    slide: {
      slideId: fields.slideId,
      slidePart: fields.slidePart,
      layoutIr: fields.layoutIr,
      composedSlidePlan: fields.composedSlidePlan,
      diff: fields.diff,
      capabilityEvidence: fields.capabilityEvidence
    }
  };
  validateRecord(record, candidateSnapshot, fileName);
  const serialized = canonicalRecordBytes(record);
  validateRecord(serialized.canonical, candidateSnapshot, fileName);
  return Object.freeze({
    record: serialized.canonical,
    recordBytes: serialized.bytes,
    recordSha256: sha256(serialized.bytes),
    candidateBytes: candidateSnapshot
  });
}

function orderedConstructionOptions(value) {
  return exactRecord(value, [
    "candidateBytes",
    "candidateFileName",
    "baseArtifactSha256",
    "orderedDeck"
  ], "/options", ERROR_CODES.ARGUMENT_INVALID);
}

/**
 * Serialize one authenticated complete ordered-deck candidate. Plain clone/fill
 * slides remain digest-bound sources; every native slide must carry its full
 * bounded-slot IR and exact replayed plan.
 */
export function createOrderedCandidateBuildRecord(value) {
  const fields = orderedConstructionOptions(value);
  const candidateSnapshot = snapshotBuffer(
    fields.candidateBytes,
    "/options/candidateBytes",
    SECURE_ZIP_LIMITS.maxArchiveBytes
  );
  const fileName = candidateFileName(fields.candidateFileName, "/options/candidateFileName");
  const record = {
    schemaVersion: CANDIDATE_BUILD_RECORD_VERSION,
    contractType: "candidate-build-record",
    candidateVersion: CANDIDATE_BUILD_RECORD_VERSION,
    artifactType: "candidate-pptx",
    verificationProfile: "authenticated-ordered-candidate-artifact",
    deliveryEligible: false,
    sourceArtifactType: "ordered-assembled-pptx",
    baseArtifactSha256: fields.baseArtifactSha256,
    output: {
      fileName,
      sha256: sha256(candidateSnapshot),
      byteLength: candidateSnapshot.length
    },
    deck: fields.orderedDeck
  };
  validateRecord(record, candidateSnapshot, fileName);
  const serialized = canonicalRecordBytes(record);
  validateRecord(serialized.canonical, candidateSnapshot, fileName);
  return Object.freeze({
    record: serialized.canonical,
    recordBytes: serialized.bytes,
    recordSha256: sha256(serialized.bytes),
    candidateBytes: candidateSnapshot
  });
}

/** Verify canonical record bytes, replay the layout, and bind them to PPTX bytes. */
export function verifyCandidateBuildRecord(value) {
  const fields = exactRecord(
    value,
    ["candidateBytes", "recordBytes", "candidateFileName"],
    "/options",
    ERROR_CODES.ARGUMENT_INVALID
  );
  const candidateSnapshot = snapshotBuffer(
    fields.candidateBytes,
    "/options/candidateBytes",
    SECURE_ZIP_LIMITS.maxArchiveBytes
  );
  const recordSnapshot = snapshotBuffer(
    fields.recordBytes,
    "/options/recordBytes",
    CANDIDATE_BUILD_RECORD_MAX_BYTES
  );
  const fileName = candidateFileName(fields.candidateFileName, "/options/candidateFileName");
  let record;
  try {
    const source = decoder.decode(recordSnapshot);
    if (source.startsWith("\uFEFF")) fail(ERROR_CODES.RECORD_INVALID, "/");
    record = JSON.parse(source);
  } catch (error) {
    if (error instanceof CandidateBuildRecordError) throw error;
    fail(ERROR_CODES.RECORD_INVALID, "/");
  }
  validateRecord(record, candidateSnapshot, fileName);
  const serialized = canonicalRecordBytes(record);
  if (!recordSnapshot.equals(serialized.bytes)) {
    fail(ERROR_CODES.RECORD_INVALID, "/");
  }
  return Object.freeze({
    record: serialized.canonical,
    candidateSha256: sha256(candidateSnapshot),
    recordSha256: sha256(recordSnapshot)
  });
}

export function candidateBuildRecordFileName(value) {
  const fileName = candidateFileName(value, "/candidateFileName");
  return `${fileName.slice(0, -5)}.candidate.json`;
}
