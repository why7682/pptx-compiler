import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  link,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rmdir,
  unlink
} from "node:fs/promises";
import path from "node:path";

import {
  CANDIDATE_BUILD_RECORD_MAX_BYTES,
  candidateBuildRecordFileName,
  verifyCandidateBuildRecord
} from "./candidate-build-record.mjs";
import { executeCapabilityDispatch } from "./capability-dispatcher.mjs";
import {
  assembleCloneFillPresentation,
  assembleSourcePreservingPresentation,
  verifyCreateOnlyTemplateIndexAgainstSourceView
} from "./create-only-assembly.mjs";
import {
  assembleNativeCardArrowFromSlot,
  verifyNativeCardArrowCandidateProjection
} from
  "./native-card-arrow-assembly.mjs";
import { assembleNativeOmmlFormulaFromSource } from
  "./native-omml-formula-assembly.mjs";
import {
  deriveNativeCardArrowSlotPlacementFromFacts,
  NATIVE_CARD_ARROW_PLACEMENT_VERSION
} from "./native-card-arrow-placement.mjs";
import { buildSecureTemplatePackageView } from "./ooxml-package-view.mjs";
import {
  assembleOrderedSlideDeck,
  authenticateOrderedSlideAssemblyArtifact
} from "./ordered-slide-assembly.mjs";
import { prepareResolvedDeckDispatch } from "./project-dispatch-resolver.mjs";
import { createProjectContext } from "./project-context.mjs";
import { parseSecureZip, SECURE_ZIP_LIMITS } from "./secure-zip.mjs";

export const RECEIPT_BOUND_FINAL_DELIVERY_VERSION = "0.1.0";

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_JSON_NODES = 50_000;
const MAX_JSON_KEYS = 50_000;
const MAX_JSON_COLLECTION_ITEMS = 4_096;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_STRING_BYTES = 1024 * 1024;
const MIN_ORDERED_SLIDES = 2;
const MAX_ORDERED_SLIDES = 11;
const MIXED_ORDERED_MEMBER_PROFILES = Object.freeze([
  Object.freeze({
    capabilityId: "source-slide-clone-fill",
    capabilityVersion: "0.1.0",
    buildType: "clone-fill-source",
    artifactType: "assembled-pptx",
    requiredBindingRoles: Object.freeze(["body", "title"])
  }),
  Object.freeze({
    capabilityId: "formula-transplant",
    capabilityVersion: "0.1.0",
    buildType: "native-omml-formula-source",
    artifactType: "native-omml-formula-assembled-pptx",
    verificationProfile: "target-specific-native-omml-formula-output",
    evidenceType: "native-omml-formula",
    requiredBindingRoles: Object.freeze(["formula-target"])
  }),
  Object.freeze({
    capabilityId: "native-card-arrow",
    capabilityVersion: "0.1.0",
    buildType: "native-card-arrow-source",
    artifactType: "native-card-arrow-assembled-pptx",
    verificationProfile: "target-specific-native-card-arrow-output",
    evidenceType: "native-card-arrow",
    requiredBindingRoles: Object.freeze(["anchor"])
  })
]);
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const RELATIVE_PPTX_PATH =
  /^(?!.*(?:^|\/)\.{1,2}(?:\/|$))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\.[Pp][Pp][Tt][Xx]$/u;
const CONTRACT_REFERENCE = /^urn:pptx-compiler:[a-z0-9][a-z0-9:.-]*$/u;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength"
).get;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const preparedPlans = new WeakMap();
const consumedPlans = new WeakSet();

const ERROR_CODES = Object.freeze({
  ABORTED: "FINAL_DELIVERY_ABORTED",
  ARGUMENT_INVALID: "FINAL_DELIVERY_ARGUMENT_INVALID",
  CANDIDATE_INVALID: "FINAL_DELIVERY_CANDIDATE_INVALID",
  COMMIT_UNCERTAIN: "FINAL_DELIVERY_COMMIT_UNCERTAIN",
  CONTRACT_INVALID: "FINAL_DELIVERY_CONTRACT_INVALID",
  EVIDENCE_INVALID: "FINAL_DELIVERY_EVIDENCE_INVALID",
  OUTPUT_EXISTS: "FINAL_DELIVERY_OUTPUT_EXISTS",
  OUTPUT_WRITE_FAILED: "FINAL_DELIVERY_OUTPUT_WRITE_FAILED",
  ROLLBACK_INCOMPLETE: "FINAL_DELIVERY_ROLLBACK_INCOMPLETE",
  SOURCE_MISMATCH: "FINAL_DELIVERY_SOURCE_MISMATCH"
});

export class ReceiptBoundFinalDeliveryError extends Error {
  constructor(code, pointer, { commitState = "not-committed", rollbackStatus } = {}) {
    super(`${code} at ${pointer}`);
    this.name = "ReceiptBoundFinalDeliveryError";
    this.code = code;
    this.pointer = pointer;
    this.commitState = commitState;
    if (rollbackStatus !== undefined) this.rollbackStatus = rollbackStatus;
  }

  toJSON() {
    const result = {
      code: this.code,
      pointer: this.pointer,
      commitState: this.commitState
    };
    if (this.rollbackStatus !== undefined) result.rollbackStatus = this.rollbackStatus;
    return result;
  }
}

function fail(code, pointer, details) {
  throw new ReceiptBoundFinalDeliveryError(code, pointer, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

function exactRecord(value, expectedKeys, pointer, code = ERROR_CODES.ARGUMENT_INVALID) {
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

function snapshotBuffer(value, pointer, maximum) {
  if (!Buffer.isBuffer(value)) fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  let byteLength;
  try {
    byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(value);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  if (byteLength < 1 || byteLength > maximum) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  let snapshot;
  try {
    snapshot = Buffer.from(value);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  if (snapshot.length !== byteLength) fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  return snapshot;
}

function chargeJsonBytes(state, byteLength, pointer) {
  state.jsonBytes += byteLength;
  if (!Number.isSafeInteger(state.jsonBytes) || state.jsonBytes > MAX_JSON_BYTES) {
    fail(ERROR_CODES.CONTRACT_INVALID, pointer);
  }
}

function jsonStringByteLength(value, pointer) {
  const rawBytes = Buffer.byteLength(value, "utf8");
  if (rawBytes > MAX_JSON_STRING_BYTES) fail(ERROR_CODES.CONTRACT_INVALID, pointer);
  let bytes = 2;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22 || code === 0x5c) {
      bytes += 2;
    } else if (code <= 0x1f) {
      bytes += 6;
    } else if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length &&
        value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4;
      index += 1;
    } else if (code >= 0xd800 && code <= 0xdfff) {
      bytes += 6;
    } else {
      bytes += 3;
    }
    if (bytes > MAX_JSON_BYTES) fail(ERROR_CODES.CONTRACT_INVALID, pointer);
  }
  return bytes;
}

function snapshotJson(
  value,
  pointer,
  state = { nodes: 0, keys: 0, jsonBytes: 0 },
  depth = 0
) {
  state.nodes += 1;
  if (state.nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) {
    fail(ERROR_CODES.CONTRACT_INVALID, pointer);
  }
  if (value === null) {
    chargeJsonBytes(state, 4, pointer);
    return value;
  }
  if (typeof value === "boolean") {
    chargeJsonBytes(state, value ? 4 : 5, pointer);
    return value;
  }
  if (typeof value === "string") {
    chargeJsonBytes(state, jsonStringByteLength(value, pointer), pointer);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(ERROR_CODES.CONTRACT_INVALID, pointer);
    chargeJsonBytes(state, JSON.stringify(value).length, pointer);
    return value;
  }
  if (typeof value !== "object") fail(ERROR_CODES.CONTRACT_INVALID, pointer);

  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(ERROR_CODES.CONTRACT_INVALID, pointer);
  }
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) fail(ERROR_CODES.CONTRACT_INVALID, pointer);
    let lengthDescriptor;
    try {
      lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    } catch {
      fail(ERROR_CODES.CONTRACT_INVALID, pointer);
    }
    const length = lengthDescriptor?.value;
    if (!Number.isSafeInteger(length) || length < 0 ||
        length > MAX_JSON_COLLECTION_ITEMS || keys.length !== length + 1) {
      fail(ERROR_CODES.CONTRACT_INVALID, pointer);
    }
    state.keys += length;
    if (state.keys > MAX_JSON_KEYS) fail(ERROR_CODES.CONTRACT_INVALID, pointer);
    chargeJsonBytes(state, 2 + Math.max(0, length - 1), pointer);
    const output = [];
    for (let index = 0; index < length; index += 1) {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        fail(ERROR_CODES.CONTRACT_INVALID, `${pointer}/${index}`);
      }
      if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
        fail(ERROR_CODES.CONTRACT_INVALID, `${pointer}/${index}`);
      }
      output.push(snapshotJson(descriptor.value, `${pointer}/${index}`, state, depth + 1));
    }
    return output;
  }
  if (prototype !== Object.prototype && prototype !== null) {
    fail(ERROR_CODES.CONTRACT_INVALID, pointer);
  }
  if (keys.length > MAX_JSON_COLLECTION_ITEMS) fail(ERROR_CODES.CONTRACT_INVALID, pointer);
  state.keys += keys.length;
  if (state.keys > MAX_JSON_KEYS) fail(ERROR_CODES.CONTRACT_INVALID, pointer);
  chargeJsonBytes(state, 2 + Math.max(0, keys.length - 1) + keys.length, pointer);
  const output = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(ERROR_CODES.CONTRACT_INVALID, pointer);
    }
    if (typeof key !== "string" || descriptor === undefined ||
        !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(ERROR_CODES.CONTRACT_INVALID, pointer);
    }
    chargeJsonBytes(state, jsonStringByteLength(key, pointer), pointer);
    output[key] = snapshotJson(descriptor.value, `${pointer}/${key}`, state, depth + 1);
  }
  return output;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function snapshotDocument(value, pointer) {
  const state = { nodes: 0, keys: 0, jsonBytes: 0 };
  const snapshot = snapshotJson(value, pointer, state);
  let bytes;
  try {
    bytes = encoder.encode(JSON.stringify(snapshot));
  } catch {
    fail(ERROR_CODES.CONTRACT_INVALID, pointer);
  }
  if (bytes.byteLength > MAX_JSON_BYTES) fail(ERROR_CODES.CONTRACT_INVALID, pointer);
  return deepFreeze(snapshot);
}

function semanticId(value, pointer, code = ERROR_CODES.CONTRACT_INVALID) {
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) {
    fail(code, pointer);
  }
  return value;
}

function validateWith(validator, value, pointer) {
  let result;
  try {
    result = validator(value);
  } catch {
    fail(ERROR_CODES.CONTRACT_INVALID, pointer);
  }
  if (result !== true) fail(ERROR_CODES.CONTRACT_INVALID, pointer);
}

function captureDependencies(value) {
  const names = [
    "authenticateCompatibilityReceipt",
    "authenticateMechanicalReceipt",
    "authenticatePixelReviewReceipt",
    "authenticateRenderReceipt",
    "validateBuildArtifact",
    "validateCapabilityRegistry",
    "validateDeckSpec",
    "validateProjectOverlay",
    "validateQaReport",
    "validateTemplateIndex",
    "validateTemplateProfile"
  ];
  const fields = exactRecord(value, names, "/options/dependencies");
  for (const name of names) {
    if (typeof fields[name] !== "function") {
      fail(ERROR_CODES.ARGUMENT_INVALID, `/options/dependencies/${name}`);
    }
  }
  return Object.freeze(fields);
}

function captureProjectContext(value) {
  const fields = exactRecord(value, [
    "contextVersion",
    "contextType",
    "projectRoot",
    "projectConfig",
    "locations",
    "dependencies"
  ], "/options/projectBundle/projectContext", ERROR_CODES.CONTRACT_INVALID);
  if (fields.contextVersion !== "0.1.0" || fields.contextType !== "project-context") {
    fail(ERROR_CODES.CONTRACT_INVALID, "/options/projectBundle/projectContext");
  }
  try {
    return createProjectContext({
      projectRoot: fields.projectRoot,
      projectConfig: fields.projectConfig,
      dependencies: fields.dependencies
    });
  } catch {
    fail(ERROR_CODES.CONTRACT_INVALID, "/options/projectBundle/projectContext");
  }
}

function same(left, right, pointer) {
  if (left !== right) fail(ERROR_CODES.SOURCE_MISMATCH, pointer);
}

function sameJsonValue(left, right) {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" ||
      typeof right !== "object") return false;
  const leftArray = Array.isArray(left);
  if (leftArray !== Array.isArray(right)) return false;
  if (leftArray) {
    return left.length === right.length &&
      left.every((value, index) => sameJsonValue(value, right[index]));
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) =>
    Object.hasOwn(right, key) && sameJsonValue(left[key], right[key]));
}

function captureProjectBundle(value, dependencies) {
  const fields = exactRecord(value, [
    "projectContext",
    "templateProfile",
    "templateIndex",
    "capabilityRegistry",
    "projectOverlay",
    "deckSpec",
    "sourceTemplateBytes"
  ], "/options/projectBundle");
  const projectContext = captureProjectContext(fields.projectContext);
  const templateProfile = snapshotDocument(
    fields.templateProfile,
    "/options/projectBundle/templateProfile"
  );
  const templateIndex = snapshotDocument(
    fields.templateIndex,
    "/options/projectBundle/templateIndex"
  );
  const capabilityRegistry = snapshotDocument(
    fields.capabilityRegistry,
    "/options/projectBundle/capabilityRegistry"
  );
  const projectOverlay = snapshotDocument(
    fields.projectOverlay,
    "/options/projectBundle/projectOverlay"
  );
  const deckSpec = snapshotDocument(fields.deckSpec, "/options/projectBundle/deckSpec");
  const sourceTemplateBytes = snapshotBuffer(
    fields.sourceTemplateBytes,
    "/options/projectBundle/sourceTemplateBytes",
    SECURE_ZIP_LIMITS.maxArchiveBytes
  );

  validateWith(dependencies.validateTemplateProfile, templateProfile, "/templateProfile");
  validateWith(dependencies.validateTemplateIndex, templateIndex, "/templateIndex");
  validateWith(dependencies.validateCapabilityRegistry, capabilityRegistry, "/capabilityRegistry");
  validateWith(dependencies.validateProjectOverlay, projectOverlay, "/projectOverlay");
  validateWith(dependencies.validateDeckSpec, deckSpec, "/deckSpec");

  return Object.freeze({
    projectContext,
    templateProfile,
    templateIndex,
    capabilityRegistry,
    projectOverlay,
    deckSpec,
    sourceTemplateBytes
  });
}

function authenticateReceipt(authenticator, receipt, expected, pointer) {
  let result;
  try {
    result = authenticator(receipt, expected);
  } catch {
    fail(ERROR_CODES.EVIDENCE_INVALID, pointer);
  }
  return snapshotDocument(result, pointer);
}

function expectedReceiptSlideIds(expected) {
  return Array.isArray(expected.slideIds) ? expected.slideIds : [expected.slideId];
}

function validateMechanicalReceipt(receipt, expected) {
  const ordered = Array.isArray(expected.slideIds);
  const fields = exactRecord(receipt, [
    "receiptVersion",
    "receiptType",
    "candidateSha256",
    "candidateRecordSha256",
    ordered ? "slideIds" : "slideId",
    "status"
  ], "/evidence/mechanical", ERROR_CODES.EVIDENCE_INVALID);
  if (fields.receiptVersion !== "0.1.0" || fields.receiptType !== "mechanical" ||
      fields.candidateSha256 !== expected.candidateSha256 ||
      fields.candidateRecordSha256 !== expected.candidateRecordSha256 ||
      fields.status !== "pass" || (ordered
        ? !sameJsonValue(fields.slideIds, expected.slideIds)
        : fields.slideId !== expected.slideId)) {
    fail(ERROR_CODES.EVIDENCE_INVALID, "/evidence/mechanical");
  }
}

function validateRenderReceipt(receipt, expected) {
  const fields = exactRecord(receipt, [
    "receiptVersion",
    "receiptType",
    "candidateSha256",
    "candidateRecordSha256",
    "renderSetId",
    "slideIds",
    "status"
  ], "/evidence/render", ERROR_CODES.EVIDENCE_INVALID);
  semanticId(fields.renderSetId, "/evidence/render/renderSetId", ERROR_CODES.EVIDENCE_INVALID);
  if (fields.receiptVersion !== "0.1.0" || fields.receiptType !== "render" ||
      fields.candidateSha256 !== expected.candidateSha256 ||
      fields.candidateRecordSha256 !== expected.candidateRecordSha256 ||
      fields.status !== "pass" || !Array.isArray(fields.slideIds) ||
      !sameJsonValue(fields.slideIds, expectedReceiptSlideIds(expected))) {
    fail(ERROR_CODES.EVIDENCE_INVALID, "/evidence/render");
  }
}

function validatePixelReviewReceipt(receipt, expected, renderSetId) {
  const fields = exactRecord(receipt, [
    "receiptVersion",
    "receiptType",
    "candidateSha256",
    "candidateRecordSha256",
    "renderSetId",
    "reviewerMode",
    "status",
    "verdict",
    "blockerCount",
    "majorCount"
  ], "/evidence/pixelReview", ERROR_CODES.EVIDENCE_INVALID);
  if (fields.receiptVersion !== "0.1.0" || fields.receiptType !== "pixel-review" ||
      fields.candidateSha256 !== expected.candidateSha256 ||
      fields.candidateRecordSha256 !== expected.candidateRecordSha256 ||
      fields.renderSetId !== renderSetId || fields.reviewerMode !== "independent-pixel-only" ||
      fields.status !== "pass" || fields.verdict !== "pass" ||
      fields.blockerCount !== 0 || fields.majorCount !== 0) {
    fail(ERROR_CODES.EVIDENCE_INVALID, "/evidence/pixelReview");
  }
}

function validateNativeCardCompatibilityReceipt(receipt, expected) {
  const fields = exactRecord(receipt, [
    "receiptVersion",
    "receiptType",
    "candidateSha256",
    "candidateRecordSha256",
    "supportMatrixItemId",
    "evidenceRecordId",
    "status"
  ], "/evidence/compatibility", ERROR_CODES.EVIDENCE_INVALID);
  if (fields.receiptVersion !== "0.1.0" || fields.receiptType !== "compatibility" ||
      fields.candidateSha256 !== expected.candidateSha256 ||
      fields.candidateRecordSha256 !== expected.candidateRecordSha256 ||
      fields.supportMatrixItemId !== "macos-powerpoint-automation" ||
      fields.status !== "passed" || typeof fields.evidenceRecordId !== "string" ||
      fields.evidenceRecordId.length > 256 || !CONTRACT_REFERENCE.test(fields.evidenceRecordId)) {
    fail(ERROR_CODES.EVIDENCE_INVALID, "/evidence/compatibility");
  }
}

function validateOmmlCompatibilityReceipt(receipt, expected) {
  const fields = exactRecord(receipt, [
    "receiptVersion",
    "receiptType",
    "candidateSha256",
    "candidateRecordSha256",
    "supportMatrixItemId",
    "evidenceRecordId",
    "operation",
    "status"
  ], "/evidence/compatibility", ERROR_CODES.EVIDENCE_INVALID);
  if (fields.receiptVersion !== "0.1.0" || fields.receiptType !== "compatibility" ||
      fields.candidateSha256 !== expected.candidateSha256 ||
      fields.candidateRecordSha256 !== expected.candidateRecordSha256 ||
      fields.supportMatrixItemId !== "macos-powerpoint-automation" ||
      fields.operation !== "formula-content-edit-save-reopen" ||
      fields.status !== "passed" || typeof fields.evidenceRecordId !== "string" ||
      fields.evidenceRecordId.length > 256 || !CONTRACT_REFERENCE.test(fields.evidenceRecordId)) {
    fail(ERROR_CODES.EVIDENCE_INVALID, "/evidence/compatibility");
  }
}

function validateCloneFillOrderedCompatibilityReceipt(receipt, expected) {
  const fields = exactRecord(receipt, [
    "receiptVersion",
    "receiptType",
    "candidateSha256",
    "candidateRecordSha256",
    "supportMatrixItemId",
    "evidenceRecordId",
    "operation",
    "status"
  ], "/evidence/compatibility", ERROR_CODES.EVIDENCE_INVALID);
  if (fields.receiptVersion !== "0.1.0" || fields.receiptType !== "compatibility" ||
      fields.candidateSha256 !== expected.candidateSha256 ||
      fields.candidateRecordSha256 !== expected.candidateRecordSha256 ||
      fields.supportMatrixItemId !== "macos-powerpoint-automation" ||
      fields.operation !== "ordered-deck-open-save-reopen" ||
      fields.status !== "passed" || typeof fields.evidenceRecordId !== "string" ||
      fields.evidenceRecordId.length > 256 || !CONTRACT_REFERENCE.test(fields.evidenceRecordId)) {
    fail(ERROR_CODES.EVIDENCE_INVALID, "/evidence/compatibility");
  }
}

function validateProjectSource(bundle) {
  const {
    projectContext,
    templateProfile: profile,
    templateIndex: index,
    capabilityRegistry: registry,
    projectOverlay: overlay,
    deckSpec: deck,
    sourceTemplateBytes
  } = bundle;
  const config = projectContext.projectConfig;

  same(config.projectId, deck.projectId, "/deckSpec/projectId");
  same(config.projectId, overlay.projectId, "/projectOverlay/projectId");
  same(config.template.profileId, profile.templateProfileId, "/templateProfile/templateProfileId");
  same(config.template.indexId, index.templateIndexId, "/templateIndex/templateIndexId");
  same(config.capabilityRegistry.registryId, registry.capabilityRegistryId,
    "/capabilityRegistry/capabilityRegistryId");
  same(config.capabilityRegistry.registryVersion, registry.registryVersion,
    "/capabilityRegistry/registryVersion");
  same(config.projectOverlay.overlayId, overlay.projectOverlayId,
    "/projectOverlay/projectOverlayId");
  same(profile.templateProfileId, index.templateProfileId, "/templateIndex/templateProfileId");
  same(profile.templateIndexId, index.templateIndexId, "/templateProfile/templateIndexId");
  same(profile.templateSha256, index.templateSha256, "/templateIndex/templateSha256");
  same(profile.templateSha256, overlay.templateSha256, "/projectOverlay/templateSha256");
  same(profile.templateProfileId, overlay.templateProfileId, "/projectOverlay/templateProfileId");
  same(index.templateIndexId, overlay.templateIndexId, "/projectOverlay/templateIndexId");
  same(registry.capabilityRegistryId, overlay.capabilityRegistryId,
    "/projectOverlay/capabilityRegistryId");
  same(registry.registryVersion, overlay.registryVersion, "/projectOverlay/registryVersion");
  same(deck.templateProfileId, profile.templateProfileId, "/deckSpec/templateProfileId");
  same(deck.projectOverlayId, overlay.projectOverlayId, "/deckSpec/projectOverlayId");
  same(sha256(sourceTemplateBytes), profile.templateSha256, "/sourceTemplateBytes");

  let sourceView;
  try {
    sourceView = buildSecureTemplatePackageView({
      sourceLocation: projectContext.locations.templateSource,
      archiveBytes: sourceTemplateBytes
    });
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/sourceTemplateBytes");
  }
  same(sourceView.templateFormat, profile.templateFormat, "/templateProfile/templateFormat");
  same(sourceView.archiveSha256, profile.templateSha256, "/templateProfile/templateSha256");
  same(sourceView.presentation.partPath, index.presentationPart, "/templateIndex/presentationPart");
  same(sourceView.presentation.slideSizeEmu.cx, index.slideSizeEmu.cx, "/templateIndex/slideSizeEmu/cx");
  same(sourceView.presentation.slideSizeEmu.cy, index.slideSizeEmu.cy, "/templateIndex/slideSizeEmu/cy");
  try {
    verifyCreateOnlyTemplateIndexAgainstSourceView(
      index,
      sourceView,
      sha256(sourceTemplateBytes)
    );
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/templateIndex");
  }

  return Object.freeze({ profile, index, registry, overlay, deck, sourceView });
}

function validateNativeCardSourceAndContracts(bundle, verifiedRecord) {
  const { index, registry, overlay, deck } = validateProjectSource(bundle);

  if (verifiedRecord.verificationProfile !== "authenticated-native-candidate-artifact" ||
      verifiedRecord.sourceArtifactType !== "native-card-arrow-assembled-pptx" ||
      verifiedRecord.sourceVerificationProfile !== "target-specific-native-card-arrow-output" ||
      verifiedRecord.slide?.capabilityEvidence?.evidenceType !== "native-card-arrow" ||
      deck.slides?.length !== 1 || overlay.capabilitySelections?.length !== 1 ||
      registry.capabilities?.length !== 1) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/candidateRecord");
  }
  const slide = deck.slides[0];
  const selection = overlay.capabilitySelections[0];
  const capability = registry.capabilities[0];
  same(slide.slideId, verifiedRecord.slide.slideId, "/deckSpec/slides/0/slideId");
  same(slide.capabilitySelectionId, selection.capabilitySelectionId,
    "/deckSpec/slides/0/capabilitySelectionId");
  if (selection.capabilityId !== "native-card-arrow" ||
      selection.capabilityVersion !== "0.1.0" || selection.experimentalOptIn !== true ||
      capability.capabilityId !== selection.capabilityId ||
      capability.capabilityVersion !== selection.capabilityVersion) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/projectOverlay/capabilitySelections/0");
  }
  if (index.slides?.length !== 1 || selection.bindings?.length !== 1 ||
      overlay.shapeBindings?.length !== 1 || capability.requiredBindingRoles?.length !== 1 ||
      capability.requiredBindingRoles[0] !== "anchor") {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/projectOverlay/capabilitySelections/0/bindings");
  }
  const bindingAssignment = selection.bindings[0];
  const shapeBinding = overlay.shapeBindings[0];
  if (bindingAssignment.role !== "anchor" ||
      bindingAssignment.shapeBindingId !== shapeBinding.shapeBindingId ||
      shapeBinding.containerKind !== "slide" || shapeBinding.expectedKind !== "text-box" ||
      shapeBinding.cardinality !== "exactly-one") {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/projectOverlay/shapeBindings/0");
  }
  const indexedSlide = index.slides[0];
  same(indexedSlide.partPath, verifiedRecord.slide.slidePart, "/templateIndex/slides/0/partPath");
  same(shapeBinding.containerKey, indexedSlide.slideKey, "/projectOverlay/shapeBindings/0/containerKey");
  const anchorMatches = indexedSlide.shapes.filter((shape) =>
    shape.shapeKey === shapeBinding.shapeKey && shape.kind === shapeBinding.expectedKind);
  if (anchorMatches.length !== 1) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/projectOverlay/shapeBindings/0/shapeKey");
  }
  const payload = exactRecord(
    slide.payload,
    ["geometry", "label", "style"],
    "/deckSpec/slides/0/payload",
    ERROR_CODES.SOURCE_MISMATCH
  );
  const payloadGeometry = exactRecord(
    payload.geometry,
    ["x", "y", "cx", "cy"],
    "/deckSpec/slides/0/payload/geometry",
    ERROR_CODES.SOURCE_MISMATCH
  );
  const componentGeometry = Object.freeze({
    x: payloadGeometry.x,
    y: payloadGeometry.y,
    cx: payloadGeometry.cx,
    cy: payloadGeometry.cy
  });
  let expectedPlacement;
  try {
    expectedPlacement = deriveNativeCardArrowSlotPlacementFromFacts({
      sourceShapes: indexedSlide.shapes.map((shape) => ({
        shapeKey: shape.shapeKey,
        geometry: {
          x: shape.geometry.x,
          y: shape.geometry.y,
          cx: shape.geometry.cx,
          cy: shape.geometry.cy
        }
      })),
      slideSizeEmu: {
        cx: index.slideSizeEmu.cx,
        cy: index.slideSizeEmu.cy
      },
      request: {
        placementVersion: NATIVE_CARD_ARROW_PLACEMENT_VERSION,
        outputSlideId: slide.slideId,
        slotRef: "slide-content-tail",
        placementIntent: "slot-aligned-fixed",
        preferredSize: {
          cx: componentGeometry.cx,
          cy: componentGeometry.cy
        }
      }
    });
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/deckSpec/slides/0/payload/geometry");
  }
  if (!sameJsonValue(expectedPlacement.resolvedGeometry, componentGeometry)) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/deckSpec/slides/0/payload/geometry");
  }
  if (!sameJsonValue(expectedPlacement.layoutIr, verifiedRecord.slide.layoutIr)) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/candidateRecord/slide/layoutIr");
  }
  if (!sameJsonValue(
    expectedPlacement.composedSlidePlan,
    verifiedRecord.slide.composedSlidePlan
  )) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/candidateRecord/slide/composedSlidePlan");
  }
  return Object.freeze({
    slide,
    selection,
    capability,
    anchorSourceId: anchorMatches[0].sourceId,
    component: Object.freeze({
      geometry: componentGeometry,
      label: payload.label,
      style: payload.style
    })
  });
}

function validateOmmlSourceAndContracts(bundle, verifiedRecord) {
  const { index, registry, overlay, deck } = validateProjectSource(bundle);
  if (verifiedRecord.verificationProfile !== "authenticated-native-candidate-artifact" ||
      verifiedRecord.sourceArtifactType !== "native-omml-formula-assembled-pptx" ||
      verifiedRecord.sourceVerificationProfile !==
        "target-specific-native-omml-formula-output" ||
      verifiedRecord.slide?.capabilityEvidence?.evidenceType !== "native-omml-formula" ||
      deck.slides?.length !== 1 || overlay.capabilitySelections?.length !== 1 ||
      registry.capabilities?.length !== 1 || index.slides?.length !== 1) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/candidateRecord");
  }
  const slide = deck.slides[0];
  const selection = overlay.capabilitySelections[0];
  const capability = registry.capabilities[0];
  same(slide.slideId, verifiedRecord.slide.slideId, "/deckSpec/slides/0/slideId");
  same(slide.capabilitySelectionId, selection.capabilitySelectionId,
    "/deckSpec/slides/0/capabilitySelectionId");
  if (selection.capabilityId !== "formula-transplant" ||
      selection.capabilityVersion !== "0.1.0" || selection.experimentalOptIn !== true ||
      capability.capabilityId !== selection.capabilityId ||
      capability.capabilityVersion !== selection.capabilityVersion ||
      selection.bindings?.length !== 1 || overlay.shapeBindings?.length !== 1 ||
      capability.requiredBindingRoles?.length !== 1 ||
      capability.requiredBindingRoles[0] !== "formula-target") {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/projectOverlay/capabilitySelections/0");
  }
  const bindingAssignment = selection.bindings[0];
  const shapeBinding = overlay.shapeBindings[0];
  const indexedSlide = index.slides[0];
  if (bindingAssignment.role !== "formula-target" ||
      bindingAssignment.shapeBindingId !== shapeBinding.shapeBindingId ||
      shapeBinding.containerKind !== "slide" || shapeBinding.expectedKind !== "text-box" ||
      shapeBinding.cardinality !== "exactly-one" ||
      shapeBinding.containerKey !== indexedSlide.slideKey) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/projectOverlay/shapeBindings/0");
  }
  same(indexedSlide.partPath, verifiedRecord.slide.slidePart,
    "/templateIndex/slides/0/partPath");
  const targetMatches = indexedSlide.shapes.filter((shape) =>
    shape.shapeKey === shapeBinding.shapeKey && shape.kind === shapeBinding.expectedKind);
  if (targetMatches.length !== 1) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/projectOverlay/shapeBindings/0/shapeKey");
  }
  const payload = exactRecord(
    slide.payload,
    ["displayMode", "latex"],
    "/deckSpec/slides/0/payload",
    ERROR_CODES.SOURCE_MISMATCH
  );
  if (payload.displayMode !== "display" || typeof payload.latex !== "string" ||
      payload.latex.length < 1) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/deckSpec/slides/0/payload");
  }
  const target = targetMatches[0];
  const formulaTarget = verifiedRecord.slide.capabilityEvidence.formulaTarget;
  if (formulaTarget.targetShapeKey !== target.shapeKey ||
      formulaTarget.sourceId !== target.sourceId ||
      !sameJsonValue(formulaTarget.geometry, target.geometry)) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/candidateRecord/slide/capabilityEvidence/formulaTarget");
  }
  return Object.freeze({ slide, selection, capability, target });
}

function validateCloneFillOrderedSourceAndContracts(bundle, verifiedRecord) {
  const { index, registry, overlay, deck } = validateProjectSource(bundle);
  const recordSlides = verifiedRecord.deck?.slides;
  if (verifiedRecord.verificationProfile !== "authenticated-ordered-candidate-artifact" ||
      verifiedRecord.sourceArtifactType !== "ordered-assembled-pptx" ||
      !Array.isArray(recordSlides) || !Array.isArray(deck.slides) ||
      deck.slides.length < MIN_ORDERED_SLIDES || deck.slides.length > MAX_ORDERED_SLIDES ||
      recordSlides.length !== deck.slides.length || registry.capabilities?.length !== 1 ||
      overlay.capabilitySelections?.length !== 1 || overlay.shapeBindings?.length !== 2 ||
      index.slides?.length !== 1) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/candidateRecord");
  }
  const capability = registry.capabilities[0];
  const selection = overlay.capabilitySelections[0];
  if (capability.capabilityId !== "source-slide-clone-fill" ||
      capability.capabilityVersion !== "0.1.0" ||
      !sameJsonValue(capability.requiredBindingRoles, ["body", "title"]) ||
      selection.capabilityId !== capability.capabilityId ||
      selection.capabilityVersion !== capability.capabilityVersion ||
      selection.experimentalOptIn !== true || selection.bindings?.length !== 2) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/projectOverlay/capabilitySelections/0");
  }
  const bindingById = new Map(overlay.shapeBindings.map((binding) => [
    binding.shapeBindingId,
    binding
  ]));
  const indexedSlide = index.slides[0];
  for (const role of ["body", "title"]) {
    const assignments = selection.bindings.filter((binding) => binding.role === role);
    const binding = assignments.length === 1
      ? bindingById.get(assignments[0].shapeBindingId)
      : undefined;
    const matches = binding === undefined ? [] : indexedSlide.shapes.filter((shape) =>
      shape.shapeKey === binding.shapeKey && shape.kind === binding.expectedKind);
    if (binding === undefined || binding.containerKind !== "slide" ||
        binding.containerKey !== indexedSlide.slideKey || binding.expectedKind !== "text-box" ||
        binding.cardinality !== "exactly-one" || matches.length !== 1) {
      fail(ERROR_CODES.CANDIDATE_INVALID, `/projectOverlay/capabilitySelections/0/bindings/${role}`);
    }
  }
  for (let indexValue = 0; indexValue < deck.slides.length; indexValue += 1) {
    const slide = deck.slides[indexValue];
    const recorded = recordSlides[indexValue];
    same(slide.slideId, recorded.slideId, `/deckSpec/slides/${indexValue}/slideId`);
    same(
      slide.capabilitySelectionId,
      selection.capabilitySelectionId,
      `/deckSpec/slides/${indexValue}/capabilitySelectionId`
    );
    if (recorded.sourceBuild?.buildType !== "clone-fill-source" ||
        recorded.sourceBuild?.artifactType !== "assembled-pptx") {
      fail(ERROR_CODES.CANDIDATE_INVALID, `/candidateRecord/deck/slides/${indexValue}/sourceBuild`);
    }
  }
  return Object.freeze({ capability, slides: deck.slides });
}

function validateMixedOrderedSourceAndContracts(bundle, verifiedRecord) {
  const { index, registry, overlay, deck } = validateProjectSource(bundle);
  const recordSlides = verifiedRecord.deck?.slides;
  if (verifiedRecord.verificationProfile !== "authenticated-ordered-candidate-artifact" ||
      verifiedRecord.sourceArtifactType !== "ordered-assembled-pptx" ||
      !Array.isArray(recordSlides) || !Array.isArray(deck.slides) ||
      deck.slides.length !== MIXED_ORDERED_MEMBER_PROFILES.length ||
      recordSlides.length !== deck.slides.length || index.slides?.length !== 1 ||
      registry.capabilities?.length !== MIXED_ORDERED_MEMBER_PROFILES.length ||
      overlay.capabilitySelections?.length !== MIXED_ORDERED_MEMBER_PROFILES.length ||
      overlay.shapeBindings?.length !== 2) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/candidateRecord");
  }
  const capabilityById = new Map(registry.capabilities.map((capability) => [
    capability.capabilityId,
    capability
  ]));
  const selectionById = new Map(overlay.capabilitySelections.map((selection) => [
    selection.capabilitySelectionId,
    selection
  ]));
  const bindingById = new Map(overlay.shapeBindings.map((binding) => [
    binding.shapeBindingId,
    binding
  ]));
  const indexedSlide = index.slides[0];
  const members = [];
  let sharedBodyBindingId;

  for (let memberIndex = 0; memberIndex < MIXED_ORDERED_MEMBER_PROFILES.length;
    memberIndex += 1) {
    const pointer = `/deckSpec/slides/${memberIndex}`;
    const profile = MIXED_ORDERED_MEMBER_PROFILES[memberIndex];
    const slide = deck.slides[memberIndex];
    const recorded = recordSlides[memberIndex];
    const selection = selectionById.get(slide.capabilitySelectionId);
    const capability = capabilityById.get(profile.capabilityId);
    same(slide.slideId, recorded.slideId, `${pointer}/slideId`);
    if (selection === undefined || capability === undefined ||
        selection.capabilityId !== profile.capabilityId ||
        selection.capabilityVersion !== profile.capabilityVersion ||
        selection.experimentalOptIn !== true ||
        capability.capabilityVersion !== profile.capabilityVersion ||
        !sameJsonValue(capability.requiredBindingRoles, profile.requiredBindingRoles) ||
        !Array.isArray(selection.bindings) ||
        selection.bindings.length !== profile.requiredBindingRoles.length) {
      fail(ERROR_CODES.CANDIDATE_INVALID, `${pointer}/capabilitySelectionId`);
    }
    const resolvedBindings = new Map();
    for (let roleIndex = 0; roleIndex < profile.requiredBindingRoles.length;
      roleIndex += 1) {
      const role = profile.requiredBindingRoles[roleIndex];
      const assignment = selection.bindings[roleIndex];
      const binding = assignment?.role === role
        ? bindingById.get(assignment.shapeBindingId)
        : undefined;
      const matches = binding === undefined ? [] : indexedSlide.shapes.filter((shape) =>
        shape.shapeKey === binding.shapeKey && shape.kind === binding.expectedKind);
      if (binding === undefined || binding.containerKind !== "slide" ||
          binding.containerKey !== indexedSlide.slideKey ||
          binding.expectedKind !== "text-box" || binding.cardinality !== "exactly-one" ||
          matches.length !== 1) {
        fail(ERROR_CODES.CANDIDATE_INVALID,
          `/projectOverlay/capabilitySelections/${memberIndex}/bindings/${roleIndex}`);
      }
      resolvedBindings.set(role, Object.freeze({ binding, shape: matches[0] }));
    }
    if (memberIndex === 0) {
      const body = resolvedBindings.get("body");
      const title = resolvedBindings.get("title");
      if (body.binding.shapeBindingId === title.binding.shapeBindingId) {
        fail(ERROR_CODES.CANDIDATE_INVALID,
          "/projectOverlay/capabilitySelections/0/bindings");
      }
      sharedBodyBindingId = body.binding.shapeBindingId;
    } else if ([...resolvedBindings.values()][0].binding.shapeBindingId !==
      sharedBodyBindingId) {
      fail(ERROR_CODES.CANDIDATE_INVALID,
        `/projectOverlay/capabilitySelections/${memberIndex}/bindings/0`);
    }
    const sourceBuild = recorded.sourceBuild;
    if (sourceBuild?.buildType !== profile.buildType ||
        sourceBuild?.artifactType !== profile.artifactType ||
        (profile.verificationProfile !== undefined &&
          sourceBuild.verificationProfile !== profile.verificationProfile) ||
        (profile.evidenceType !== undefined &&
          sourceBuild.capabilityEvidence?.evidenceType !== profile.evidenceType)) {
      fail(ERROR_CODES.CANDIDATE_INVALID,
        `/candidateRecord/deck/slides/${memberIndex}/sourceBuild`);
    }
    if (memberIndex > 0 && sourceBuild.sourceSlidePart !== indexedSlide.partPath) {
      fail(ERROR_CODES.CANDIDATE_INVALID,
        `/candidateRecord/deck/slides/${memberIndex}/sourceBuild/sourceSlidePart`);
    }

    let placementRequest;
    if (profile.capabilityId === "formula-transplant") {
      const target = resolvedBindings.get("formula-target").shape;
      const formulaTarget = sourceBuild.capabilityEvidence.formulaTarget;
      if (formulaTarget.targetShapeKey !== target.shapeKey ||
          formulaTarget.sourceId !== target.sourceId ||
          !sameJsonValue(formulaTarget.geometry, target.geometry)) {
        fail(ERROR_CODES.CANDIDATE_INVALID,
          `/candidateRecord/deck/slides/${memberIndex}/sourceBuild/capabilityEvidence/formulaTarget`);
      }
    } else if (profile.capabilityId === "native-card-arrow") {
      const payload = exactRecord(
        slide.payload,
        ["geometry", "label", "style"],
        `${pointer}/payload`,
        ERROR_CODES.SOURCE_MISMATCH
      );
      const geometry = exactRecord(
        payload.geometry,
        ["x", "y", "cx", "cy"],
        `${pointer}/payload/geometry`,
        ERROR_CODES.SOURCE_MISMATCH
      );
      placementRequest = Object.freeze({
        placementVersion: NATIVE_CARD_ARROW_PLACEMENT_VERSION,
        outputSlideId: slide.slideId,
        slotRef: "slide-content-tail",
        placementIntent: "slot-aligned-fixed",
        preferredSize: Object.freeze({ cx: geometry.cx, cy: geometry.cy })
      });
      let expectedPlacement;
      try {
        expectedPlacement = deriveNativeCardArrowSlotPlacementFromFacts({
          sourceShapes: indexedSlide.shapes.map((shape) => ({
            shapeKey: shape.shapeKey,
            geometry: {
              x: shape.geometry.x,
              y: shape.geometry.y,
              cx: shape.geometry.cx,
              cy: shape.geometry.cy
            }
          })),
          slideSizeEmu: {
            cx: index.slideSizeEmu.cx,
            cy: index.slideSizeEmu.cy
          },
          request: placementRequest
        });
      } catch {
        fail(ERROR_CODES.SOURCE_MISMATCH, `${pointer}/payload/geometry`);
      }
      if (!sameJsonValue(expectedPlacement.resolvedGeometry, geometry)) {
        fail(ERROR_CODES.SOURCE_MISMATCH, `${pointer}/payload/geometry`);
      }
      if (!sameJsonValue(expectedPlacement.layoutIr, sourceBuild.layoutIr) ||
          !sameJsonValue(expectedPlacement.composedSlidePlan,
            sourceBuild.composedSlidePlan)) {
        fail(ERROR_CODES.CANDIDATE_INVALID,
          `/candidateRecord/deck/slides/${memberIndex}/sourceBuild/layoutIr`);
      }
    }
    members.push(Object.freeze({
      profile,
      slide,
      capability,
      placementRequest
    }));
  }
  return Object.freeze({
    members: Object.freeze(members),
    slides: deck.slides
  });
}

function captureOutput(value, projectContext, candidateFileName) {
  const fields = exactRecord(
    value,
    ["buildId", "qaReportId", "publishPath"],
    "/options/output"
  );
  const buildId = semanticId(fields.buildId, "/options/output/buildId");
  const qaReportId = semanticId(fields.qaReportId, "/options/output/qaReportId");
  const publishPath = fields.publishPath;
  if (typeof publishPath !== "string" || publishPath.length > 512 ||
      !RELATIVE_PPTX_PATH.test(publishPath) || path.posix.normalize(publishPath) !== publishPath) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/options/output/publishPath");
  }
  const outputRoot = projectContext.projectConfig.paths.outputRoot;
  const expectedDirectory = `${outputRoot}/${buildId}`;
  if (path.posix.dirname(publishPath) !== expectedDirectory ||
      path.posix.basename(publishPath) !== candidateFileName) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/options/output/publishPath");
  }
  return Object.freeze({
    buildId,
    qaReportId,
    publishPath,
    finalDirectory: path.join(projectContext.locations.outputRoot, buildId)
  });
}

function canonicalBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createQaReport({
  bundle,
  output,
  capability,
  slideCapabilities,
  evidenceRecordId,
  compatibilityCheckId = "powerpoint-compatibility"
}) {
  const config = bundle.projectContext.projectConfig;
  const profile = bundle.templateProfile;
  const index = bundle.templateIndex;
  const registry = bundle.capabilityRegistry;
  const overlay = bundle.projectOverlay;
  const capabilities = slideCapabilities ?? [capability];
  const qaContractId = capabilities[0].qaContractId;
  const check = (checkId, manualGateIds = [], contractId = qaContractId) => ({
    checkId,
    qaContractId: contractId,
    scopeKind: "build",
    scopeId: output.buildId,
    outcome: "pass",
    manualGateIds,
    diagnosticIds: []
  });
  const checks = [
    check("candidate-record-replay"),
    ...capabilities.slice(1).map((memberCapability) => check(
      `capability-${memberCapability.capabilityId}-qa`,
      [],
      memberCapability.qaContractId
    )),
    check("mechanical-constraints"),
    check("package-source-diff"),
    check("pixel-review"),
    check(compatibilityCheckId, ["powerpoint-compatibility-gate"]),
    check("render-complete")
  ].sort((left, right) => left.checkId < right.checkId ? -1 :
    left.checkId > right.checkId ? 1 : 0);
  return {
    schemaVersion: "0.1.0",
    contractType: "qa-report",
    qaReportId: output.qaReportId,
    buildId: output.buildId,
    projectId: config.projectId,
    deckId: bundle.deckSpec.deckId,
    templateProfileId: profile.templateProfileId,
    templateIndexId: index.templateIndexId,
    capabilityRegistryId: registry.capabilityRegistryId,
    registryVersion: registry.registryVersion,
    projectOverlayId: overlay.projectOverlayId,
    templateSha256: profile.templateSha256,
    decision: "pass",
    checks,
    manualGates: [{
      manualGateId: "powerpoint-compatibility-gate",
      supportMatrixItemId: "macos-powerpoint-automation",
      scopeKind: "build",
      scopeId: output.buildId,
      status: "passed",
      evidenceRecordId
    }],
    diagnostics: []
  };
}

function createBuildArtifact({
  bundle,
  output,
  capability,
  slideCapabilities,
  candidateBytes,
  changed,
  slides = bundle.deckSpec.slides
}) {
  const config = bundle.projectContext.projectConfig;
  const profile = bundle.templateProfile;
  const index = bundle.templateIndex;
  const registry = bundle.capabilityRegistry;
  const overlay = bundle.projectOverlay;
  return {
    schemaVersion: "0.1.0",
    contractType: "build-artifact",
    buildId: output.buildId,
    projectId: config.projectId,
    deckId: bundle.deckSpec.deckId,
    templateProfileId: profile.templateProfileId,
    templateIndexId: index.templateIndexId,
    capabilityRegistryId: registry.capabilityRegistryId,
    registryVersion: registry.registryVersion,
    projectOverlayId: overlay.projectOverlayId,
    templateSha256: profile.templateSha256,
    slides: slides.map((slide, index) => ({
      slideId: slide.slideId,
      capabilityId: (slideCapabilities?.[index] ?? capability).capabilityId,
      capabilityVersion: (slideCapabilities?.[index] ?? capability).capabilityVersion
    })),
    changedParts: [...changed],
    qaReportId: output.qaReportId,
    output: {
      format: "pptx",
      publishPath: output.publishPath,
      sha256: sha256(candidateBytes),
      byteLength: candidateBytes.length
    }
  };
}

function captureCandidate(value) {
  const fields = exactRecord(value, [
    "candidateBytes",
    "candidateRecordBytes",
    "candidateFileName"
  ], "/options/candidate");
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
      candidateFileName: fields.candidateFileName
    });
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate");
  }
  const record = snapshotDocument(verified.record, "/candidateRecord");
  return Object.freeze({
    candidateBytes,
    candidateRecordBytes,
    verified,
    record,
    candidateFileName: record.output.fileName
  });
}

function captureEvidence(value) {
  const fields = exactRecord(value, [
    "mechanicalReceipt",
    "renderReceipt",
    "pixelReviewReceipt",
    "compatibilityReceipt"
  ], "/options/evidence");
  return Object.freeze(fields);
}

function sourceToCandidateChangedParts(sourceBytes, candidateBytes, slidePart) {
  let sourceParts;
  let candidateParts;
  try {
    sourceParts = parseSecureZip(sourceBytes);
    candidateParts = parseSecureZip(candidateBytes);
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection");
  }
  const sourcePaths = [...sourceParts.keys()].sort();
  const candidatePaths = [...candidateParts.keys()].sort();
  if (!sameJsonValue(sourcePaths, candidatePaths)) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/parts");
  }
  const changed = sourcePaths.filter((partName) =>
    !Buffer.from(sourceParts.get(partName)).equals(candidateParts.get(partName)));
  const allowed = new Set(["[Content_Types].xml", slidePart]);
  if (!changed.includes(slidePart) || changed.some((partName) => !allowed.has(partName))) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/changedParts");
  }
  return Object.freeze(changed);
}

function verifyOmmlCandidateProjection(candidate, artifact, sourceTemplateBytes) {
  if (!artifact.archiveBytes.equals(candidate.candidateBytes)) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/archiveBytes");
  }
  const report = artifact.report;
  const record = candidate.record;
  const comparisons = [
    [report.baseOutputSha256, record.baseArtifactSha256, "baseArtifactSha256"],
    [report.outputSlideId, record.slide.slideId, "slide/slideId"],
    [report.slidePart, record.slide.slidePart, "slide/slidePart"],
    [report.layoutIr, record.slide.layoutIr, "slide/layoutIr"],
    [report.composedSlidePlan, record.slide.composedSlidePlan, "slide/composedSlidePlan"],
    [report.diff, record.slide.diff, "slide/diff"],
    [
      report.formulaDigest,
      record.slide.capabilityEvidence.formulaDigest,
      "slide/capabilityEvidence/formulaDigest"
    ],
    [
      report.formulaTarget,
      record.slide.capabilityEvidence.formulaTarget,
      "slide/capabilityEvidence/formulaTarget"
    ]
  ];
  const mismatch = comparisons.find(([actual, expected]) => !sameJsonValue(actual, expected));
  if (mismatch !== undefined) {
    fail(ERROR_CODES.CANDIDATE_INVALID, `/candidateRecord/${mismatch[2]}`);
  }
  return sourceToCandidateChangedParts(
    sourceTemplateBytes,
    candidate.candidateBytes,
    record.slide.slidePart
  );
}

function orderedSourceToCandidateChangedParts(sourceBytes, candidateBytes, slideCount) {
  let sourceParts;
  let candidateParts;
  try {
    sourceParts = parseSecureZip(sourceBytes);
    candidateParts = parseSecureZip(candidateBytes);
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection");
  }
  const sourcePaths = [...sourceParts.keys()].sort();
  const candidatePaths = [...candidateParts.keys()].sort();
  const removed = sourcePaths.filter((partName) => !candidateParts.has(partName));
  const added = candidatePaths.filter((partName) => !sourceParts.has(partName));
  const expectedAdded = [];
  for (let index = 1; index < slideCount; index += 1) {
    expectedAdded.push(
      `ppt/slides/slide${index + 1}.xml`,
      `ppt/slides/_rels/slide${index + 1}.xml.rels`
    );
  }
  expectedAdded.sort();
  if (removed.length !== 0 || !sameJsonValue(added, expectedAdded)) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/parts");
  }
  const modified = sourcePaths.filter((partName) => candidateParts.has(partName) &&
    !Buffer.from(sourceParts.get(partName)).equals(candidateParts.get(partName)));
  const requiredModified = new Set([
    "[Content_Types].xml",
    "ppt/_rels/presentation.xml.rels",
    "ppt/presentation.xml",
    "ppt/slides/slide1.xml"
  ]);
  const allowedModified = new Set([
    ...requiredModified,
    "ppt/slides/_rels/slide1.xml.rels"
  ]);
  if ([...requiredModified].some((partName) => !modified.includes(partName)) ||
      modified.some((partName) => !allowedModified.has(partName))) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/changedParts");
  }
  return Object.freeze([...added, ...modified].sort());
}

function verifyCloneFillOrderedCandidateProjection(
  candidate,
  artifact,
  sourceTemplateBytes
) {
  let authenticated;
  try {
    authenticated = authenticateOrderedSlideAssemblyArtifact({
      archiveBytes: artifact.archiveBytes,
      report: artifact.report
    });
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/assembly");
  }
  if (authenticated.authority.verificationProfile !== "secure-generic-ordered-output" ||
      authenticated.authority.genericPublicationEligible !== true ||
      authenticated.authority.containsTargetSpecificNative !== false ||
      !authenticated.archiveBytes.equals(candidate.candidateBytes)) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/archiveBytes");
  }
  const facts = authenticated.candidateRecordFacts;
  if (facts.baseArtifactSha256 !== candidate.record.baseArtifactSha256 ||
      !sameJsonValue({
        assemblyVersion: facts.assemblyVersion,
        slides: facts.slides,
        diff: facts.diff
      }, candidate.record.deck)) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/candidateRecord/deck");
  }
  return orderedSourceToCandidateChangedParts(
    sourceTemplateBytes,
    candidate.candidateBytes,
    candidate.record.deck.slides.length
  );
}

function verifyMixedOrderedCandidateProjection(candidate, artifact, sourceTemplateBytes) {
  let authenticated;
  try {
    authenticated = authenticateOrderedSlideAssemblyArtifact({
      archiveBytes: artifact.archiveBytes,
      report: artifact.report
    });
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/assembly");
  }
  if (authenticated.authority.verificationProfile !==
        "authenticated-native-ordered-output" ||
      authenticated.authority.genericPublicationEligible !== false ||
      authenticated.authority.containsTargetSpecificNative !== true ||
      !authenticated.archiveBytes.equals(candidate.candidateBytes)) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/archiveBytes");
  }
  const facts = authenticated.candidateRecordFacts;
  if (facts.baseArtifactSha256 !== candidate.record.baseArtifactSha256 ||
      !sameJsonValue({
        assemblyVersion: facts.assemblyVersion,
        slides: facts.slides,
        diff: facts.diff
      }, candidate.record.deck)) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/candidateRecord/deck");
  }
  return orderedSourceToCandidateChangedParts(
    sourceTemplateBytes,
    candidate.candidateBytes,
    candidate.record.deck.slides.length
  );
}

function createPreparedDeliveryPlan({
  candidate,
  bundle,
  evidence,
  output,
  dependencies,
  capability,
  slideCapabilities,
  changed,
  compatibilityValidator,
  compatibilityCheckId,
  compatibilityOperation,
  deliveryVerificationProfile,
  slides = bundle.deckSpec.slides
}) {
  const evidenceFields = captureEvidence(evidence);
  const slideIds = slides.map((slide) => slide.slideId);
  const expected = deepFreeze({
    candidateSha256: candidate.verified.candidateSha256,
    candidateRecordSha256: candidate.verified.recordSha256,
    candidateFileName: candidate.candidateFileName,
    ...(slideIds.length === 1 ? { slideId: slideIds[0] } : { slideIds })
  });
  const mechanical = authenticateReceipt(
    dependencies.authenticateMechanicalReceipt,
    evidenceFields.mechanicalReceipt,
    expected,
    "/evidence/mechanical"
  );
  validateMechanicalReceipt(mechanical, expected);
  const render = authenticateReceipt(
    dependencies.authenticateRenderReceipt,
    evidenceFields.renderReceipt,
    expected,
    "/evidence/render"
  );
  validateRenderReceipt(render, expected);
  const pixelExpected = deepFreeze({ ...expected, renderSetId: render.renderSetId });
  const pixelReview = authenticateReceipt(
    dependencies.authenticatePixelReviewReceipt,
    evidenceFields.pixelReviewReceipt,
    pixelExpected,
    "/evidence/pixelReview"
  );
  validatePixelReviewReceipt(pixelReview, expected, render.renderSetId);
  const compatibilityExpected = compatibilityOperation === undefined
    ? expected
    : deepFreeze({ ...expected, operation: compatibilityOperation });
  const compatibility = authenticateReceipt(
    dependencies.authenticateCompatibilityReceipt,
    evidenceFields.compatibilityReceipt,
    compatibilityExpected,
    "/evidence/compatibility"
  );
  compatibilityValidator(compatibility, compatibilityExpected);

  const qaReport = deepFreeze(createQaReport({
    bundle,
    output,
    capability,
    slideCapabilities,
    evidenceRecordId: compatibility.evidenceRecordId,
    compatibilityCheckId
  }));
  const buildArtifact = deepFreeze(createBuildArtifact({
    bundle,
    output,
    capability,
    slideCapabilities,
    candidateBytes: candidate.candidateBytes,
    changed,
    slides
  }));
  validateWith(dependencies.validateQaReport, qaReport, "/qaReport");
  validateWith(dependencies.validateBuildArtifact, buildArtifact, "/buildArtifact");

  const stem = candidate.candidateFileName.slice(0, -5);
  const fileNames = Object.freeze({
    candidateRecord: candidateBuildRecordFileName(candidate.candidateFileName),
    candidate: candidate.candidateFileName,
    qaReport: `${stem}.qa.json`,
    buildArtifact: `${stem}.build.json`
  });
  const plan = Object.freeze({
    deliveryVersion: RECEIPT_BOUND_FINAL_DELIVERY_VERSION,
    planType: "receipt-bound-final-delivery-plan"
  });
  preparedPlans.set(plan, Object.freeze({
    outputRoot: bundle.projectContext.locations.outputRoot,
    finalDirectory: output.finalDirectory,
    publishPath: output.publishPath,
    candidateBytes: candidate.candidateBytes,
    candidateRecordBytes: candidate.candidateRecordBytes,
    qaReport,
    qaReportBytes: canonicalBytes(qaReport),
    buildArtifact,
    buildArtifactBytes: canonicalBytes(buildArtifact),
    deliveryVerificationProfile,
    fileNames
  }));
  return plan;
}

/**
 * Freeze all readable planning/build facts and authenticate every external
 * receipt before publication starts. The returned object is deliberately
 * opaque and single-use; callers cannot replace a checked object after this
 * synchronous boundary.
 */
export function prepareReceiptBoundFinalDelivery(options) {
  const fields = exactRecord(options, [
    "candidate",
    "projectBundle",
    "evidence",
    "output",
    "dependencies"
  ], "/options");
  const dependencies = captureDependencies(fields.dependencies);
  const candidate = captureCandidate(fields.candidate);
  const bundle = captureProjectBundle(fields.projectBundle, dependencies);
  const contractFacts = validateNativeCardSourceAndContracts(bundle, candidate.record);
  const output = captureOutput(
    fields.output,
    bundle.projectContext,
    candidate.candidateFileName
  );
  let projection;
  try {
    projection = verifyNativeCardArrowCandidateProjection({
      sourceTemplateBytes: bundle.sourceTemplateBytes,
      candidateBytes: candidate.candidateBytes,
      slidePart: candidate.record.slide.slidePart,
      slideSizeEmu: bundle.templateIndex.slideSizeEmu,
      anchorSourceId: contractFacts.anchorSourceId,
      allocatedShapeIds: candidate.record.slide.capabilityEvidence.allocatedShapeIds,
      baseArtifactSha256: candidate.record.baseArtifactSha256,
      component: contractFacts.component
    });
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection");
  }
  return createPreparedDeliveryPlan({
    candidate,
    bundle,
    evidence: fields.evidence,
    output,
    dependencies,
    capability: contractFacts.capability,
    changed: projection.changedParts,
    compatibilityValidator: validateNativeCardCompatibilityReceipt,
    compatibilityCheckId: "powerpoint-compatibility",
    deliveryVerificationProfile: "receipt-bound-native-card-arrow-delivery"
  });
}

/**
 * Rebuild one source-preserving typed-OMML candidate from the exact readable
 * project documents before accepting any receipt. The runtime plan is created
 * synchronously, so caller-owned contracts cannot drift across the async
 * capability execution boundary.
 */
export async function prepareReceiptBoundOmmlFinalDelivery(options) {
  const fields = exactRecord(options, [
    "candidate",
    "projectBundle",
    "evidence",
    "output",
    "dependencies",
    "runtime"
  ], "/options");
  const dependencies = captureDependencies(fields.dependencies);
  const candidate = captureCandidate(fields.candidate);
  const bundle = captureProjectBundle(fields.projectBundle, dependencies);
  const contractFacts = validateOmmlSourceAndContracts(bundle, candidate.record);
  const evidence = captureEvidence(fields.evidence);
  const output = captureOutput(
    fields.output,
    bundle.projectContext,
    candidate.candidateFileName
  );
  let dispatchPlan;
  try {
    dispatchPlan = prepareResolvedDeckDispatch({
      runtime: fields.runtime,
      capabilityRegistry: bundle.capabilityRegistry,
      projectOverlay: bundle.projectOverlay,
      templateIndex: bundle.templateIndex,
      deckSpec: bundle.deckSpec,
      dependencies: {
        validateCapabilityRegistry: dependencies.validateCapabilityRegistry,
        validateDeckSpec: dependencies.validateDeckSpec,
        validateProjectOverlay: dependencies.validateProjectOverlay,
        validateTemplateIndex: dependencies.validateTemplateIndex
      }
    });
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/dispatch");
  }

  let artifact;
  try {
    artifact = await assembleNativeOmmlFormulaFromSource({
      sourceArchiveBytes: bundle.sourceTemplateBytes,
      templateIndex: bundle.templateIndex,
      dispatchPlan
    });
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/assembly");
  }
  const changed = verifyOmmlCandidateProjection(
    candidate,
    artifact,
    bundle.sourceTemplateBytes
  );
  return createPreparedDeliveryPlan({
    candidate,
    bundle,
    evidence,
    output,
    dependencies,
    capability: contractFacts.capability,
    changed,
    compatibilityValidator: validateOmmlCompatibilityReceipt,
    compatibilityCheckId: "formula-content-editability",
    compatibilityOperation: "formula-content-edit-save-reopen",
    deliveryVerificationProfile: "receipt-bound-native-omml-formula-delivery"
  });
}

/**
 * Regenerate one 2–11 slide clone/fill deck from a single admitted template and
 * the exact readable batch DeckSpec, then require the existing ordered
 * assembler and candidate record to converge on the reviewed bytes. Native and
 * OMML ordered members remain outside this deliberately narrow boundary.
 */
export async function prepareReceiptBoundCloneFillOrderedFinalDelivery(options) {
  const fields = exactRecord(options, [
    "candidate",
    "projectBundle",
    "evidence",
    "output",
    "dependencies",
    "runtime"
  ], "/options");
  const dependencies = captureDependencies(fields.dependencies);
  const candidate = captureCandidate(fields.candidate);
  const bundle = captureProjectBundle(fields.projectBundle, dependencies);
  const contractFacts = validateCloneFillOrderedSourceAndContracts(
    bundle,
    candidate.record
  );
  const evidence = captureEvidence(fields.evidence);
  const output = captureOutput(
    fields.output,
    bundle.projectContext,
    candidate.candidateFileName
  );
  let dispatchPlan;
  try {
    dispatchPlan = prepareResolvedDeckDispatch({
      runtime: fields.runtime,
      capabilityRegistry: bundle.capabilityRegistry,
      projectOverlay: bundle.projectOverlay,
      templateIndex: bundle.templateIndex,
      deckSpec: bundle.deckSpec,
      dependencies: {
        validateCapabilityRegistry: dependencies.validateCapabilityRegistry,
        validateDeckSpec: dependencies.validateDeckSpec,
        validateProjectOverlay: dependencies.validateProjectOverlay,
        validateTemplateIndex: dependencies.validateTemplateIndex
      }
    });
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/dispatch");
  }

  let dispatchResult;
  try {
    dispatchResult = await executeCapabilityDispatch({ plan: dispatchPlan });
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/dispatch");
  }
  if (!Array.isArray(dispatchResult?.results) ||
      dispatchResult.results.length !== contractFacts.slides.length) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/dispatch");
  }

  let oneSlideArtifacts;
  let orderedArtifact;
  try {
    oneSlideArtifacts = dispatchResult.results.map((entry, index) => {
      if (entry.output?.outputSlideId !== contractFacts.slides[index].slideId) {
        fail(ERROR_CODES.CANDIDATE_INVALID, `/options/candidate/projection/slides/${index}`);
      }
      return assembleCloneFillPresentation({
        sourceArchiveBytes: bundle.sourceTemplateBytes,
        templateIndex: bundle.templateIndex,
        plan: entry.output
      });
    });
    orderedArtifact = assembleOrderedSlideDeck({
      slides: oneSlideArtifacts.map((artifact) => ({
        archiveBytes: artifact.archiveBytes,
        report: artifact.report
      }))
    });
  } catch (error) {
    if (error instanceof ReceiptBoundFinalDeliveryError) throw error;
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/assembly");
  }
  const changed = verifyCloneFillOrderedCandidateProjection(
    candidate,
    orderedArtifact,
    bundle.sourceTemplateBytes
  );
  return createPreparedDeliveryPlan({
    candidate,
    bundle,
    evidence,
    output,
    dependencies,
    capability: contractFacts.capability,
    changed,
    compatibilityValidator: validateCloneFillOrderedCompatibilityReceipt,
    compatibilityCheckId: "ordered-powerpoint-compatibility",
    compatibilityOperation: "ordered-deck-open-save-reopen",
    deliveryVerificationProfile: "receipt-bound-clone-fill-ordered-delivery",
    slides: contractFacts.slides
  });
}

/**
 * Regenerate the fixed three-page mixed story from one readable project tuple:
 * clone/fill setup, typed-OMML evidence, then a native card-arrow decision.
 * Every one-slide plan preflights before any executor runs; the existing typed
 * applicators, ordered assembler, candidate record, receipts, and publisher are
 * reused without introducing a second deck builder or semantic sidecar.
 */
export async function prepareReceiptBoundMixedOrderedFinalDelivery(options) {
  const fields = exactRecord(options, [
    "candidate",
    "projectBundle",
    "evidence",
    "output",
    "dependencies",
    "runtime"
  ], "/options");
  const dependencies = captureDependencies(fields.dependencies);
  const candidate = captureCandidate(fields.candidate);
  const bundle = captureProjectBundle(fields.projectBundle, dependencies);
  const contractFacts = validateMixedOrderedSourceAndContracts(
    bundle,
    candidate.record
  );
  const evidence = captureEvidence(fields.evidence);
  const output = captureOutput(
    fields.output,
    bundle.projectContext,
    candidate.candidateFileName
  );

  let dispatchPlans;
  try {
    dispatchPlans = contractFacts.members.map((member) => prepareResolvedDeckDispatch({
      runtime: fields.runtime,
      capabilityRegistry: bundle.capabilityRegistry,
      projectOverlay: bundle.projectOverlay,
      templateIndex: bundle.templateIndex,
      deckSpec: deepFreeze({
        ...bundle.deckSpec,
        slides: [member.slide]
      }),
      dependencies: {
        validateCapabilityRegistry: dependencies.validateCapabilityRegistry,
        validateDeckSpec: dependencies.validateDeckSpec,
        validateProjectOverlay: dependencies.validateProjectOverlay,
        validateTemplateIndex: dependencies.validateTemplateIndex
      }
    }));
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/dispatch");
  }

  const oneSlideArtifacts = [];
  try {
    for (let index = 0; index < contractFacts.members.length; index += 1) {
      const member = contractFacts.members[index];
      const dispatchPlan = dispatchPlans[index];
      let artifact;
      if (member.profile.capabilityId === "source-slide-clone-fill") {
        const dispatched = await executeCapabilityDispatch({ plan: dispatchPlan });
        if (!Array.isArray(dispatched?.results) || dispatched.results.length !== 1 ||
            dispatched.results[0].output?.outputSlideId !== member.slide.slideId) {
          fail(ERROR_CODES.CANDIDATE_INVALID,
            `/options/candidate/projection/slides/${index}`);
        }
        artifact = assembleCloneFillPresentation({
          sourceArchiveBytes: bundle.sourceTemplateBytes,
          templateIndex: bundle.templateIndex,
          plan: dispatched.results[0].output
        });
      } else if (member.profile.capabilityId === "formula-transplant") {
        artifact = await assembleNativeOmmlFormulaFromSource({
          sourceArchiveBytes: bundle.sourceTemplateBytes,
          templateIndex: bundle.templateIndex,
          dispatchPlan
        });
      } else {
        const baseArtifact = assembleSourcePreservingPresentation({
          sourceArchiveBytes: bundle.sourceTemplateBytes,
          templateIndex: bundle.templateIndex,
          outputSlideId: member.slide.slideId
        });
        artifact = await assembleNativeCardArrowFromSlot({
          baseArtifact,
          placementRequest: member.placementRequest,
          dispatchPlan
        });
      }
      oneSlideArtifacts.push(artifact);
    }
  } catch (error) {
    if (error instanceof ReceiptBoundFinalDeliveryError) throw error;
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/assembly");
  }

  let orderedArtifact;
  try {
    orderedArtifact = assembleOrderedSlideDeck({
      slides: oneSlideArtifacts.map((artifact) => ({
        archiveBytes: artifact.archiveBytes,
        report: artifact.report
      }))
    });
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/options/candidate/projection/assembly");
  }
  const changed = verifyMixedOrderedCandidateProjection(
    candidate,
    orderedArtifact,
    bundle.sourceTemplateBytes
  );
  const slideCapabilities = contractFacts.members.map((member) => member.capability);
  return createPreparedDeliveryPlan({
    candidate,
    bundle,
    evidence,
    output,
    dependencies,
    capability: slideCapabilities[0],
    slideCapabilities,
    changed,
    compatibilityValidator: validateCloneFillOrderedCompatibilityReceipt,
    compatibilityCheckId: "ordered-powerpoint-compatibility",
    compatibilityOperation: "ordered-deck-open-save-reopen",
    deliveryVerificationProfile: "receipt-bound-mixed-ordered-delivery",
    slides: contractFacts.slides
  });
}

async function syncDirectory(directory, pointer) {
  if (process.platform === "win32") return;
  let handle;
  try {
    handle = await open(
      directory,
      fsConstants.O_RDONLY | (fsConstants.O_DIRECTORY ?? 0) |
        (fsConstants.O_NOFOLLOW ?? 0)
    );
    await handle.sync();
    await handle.close();
  } catch {
    if (handle) {
      try { await handle.close(); } catch { /* best-effort close */ }
    }
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, pointer);
  }
}

async function writeStage(stagePath, bytes, pointer) {
  let handle;
  try {
    handle = await open(
      stagePath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY |
        (fsConstants.O_NOFOLLOW ?? 0),
      0o600
    );
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    const metadata = await lstat(stagePath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size !== bytes.length) {
      fail(ERROR_CODES.OUTPUT_WRITE_FAILED, pointer);
    }
    return metadata;
  } catch (error) {
    if (handle) {
      try { await handle.close(); } catch { /* best-effort close */ }
    }
    if (error instanceof ReceiptBoundFinalDeliveryError) throw error;
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, pointer);
  }
}

async function linkOwned(stagePath, destination, metadata, pointer, onLinked) {
  try {
    await link(stagePath, destination);
    // The destination becomes externally visible when link(2) succeeds. Record
    // that state synchronously before any fallible verification await so a
    // visible BuildArtifact can never be reported as "not committed".
    onLinked();
    const destinationMetadata = await lstat(destination);
    if (!destinationMetadata.isFile() || destinationMetadata.isSymbolicLink() ||
        destinationMetadata.dev !== metadata.dev || destinationMetadata.ino !== metadata.ino) {
      fail(ERROR_CODES.OUTPUT_WRITE_FAILED, pointer);
    }
  } catch (error) {
    if (error instanceof ReceiptBoundFinalDeliveryError) throw error;
    if (error?.code === "EEXIST") fail(ERROR_CODES.OUTPUT_EXISTS, pointer);
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, pointer);
  }
}

async function unlinkOwned(filePath, metadata) {
  try {
    const current = await lstat(filePath);
    if (current.dev !== metadata.dev || current.ino !== metadata.ino) return false;
    await unlink(filePath);
    return true;
  } catch (error) {
    return error?.code === "ENOENT";
  }
}

async function rollbackDirectory(state) {
  let complete = true;
  for (const entry of [...state.publicEntries].reverse()) {
    complete = await unlinkOwned(entry.path, entry.metadata) && complete;
  }
  for (const entry of [...state.stageEntries].reverse()) {
    complete = await unlinkOwned(entry.path, entry.metadata) && complete;
  }
  try {
    await syncDirectory(state.finalDirectory, "/deliveryDirectory");
  } catch {
    complete = false;
  }
  try {
    await rmdir(state.finalDirectory);
  } catch {
    complete = false;
  }
  try {
    await syncDirectory(state.outputRoot, "/outputRoot");
  } catch {
    complete = false;
  }
  return complete;
}

function sameBytes(left, right) {
  return left.length === right.length && left.equals(right);
}

async function verifyPublishedInputs(state) {
  const recordPath = path.join(state.finalDirectory, state.fileNames.candidateRecord);
  const candidatePath = path.join(state.finalDirectory, state.fileNames.candidate);
  const qaPath = path.join(state.finalDirectory, state.fileNames.qaReport);
  let recordBytes;
  let candidateBytes;
  let qaBytes;
  try {
    [recordBytes, candidateBytes, qaBytes] = await Promise.all([
      readFile(recordPath),
      readFile(candidatePath),
      readFile(qaPath)
    ]);
  } catch {
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/deliveryDirectory");
  }
  if (!sameBytes(recordBytes, state.candidateRecordBytes) ||
      !sameBytes(candidateBytes, state.candidateBytes) ||
      !sameBytes(qaBytes, state.qaReportBytes)) {
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/deliveryDirectory");
  }
  try {
    verifyCandidateBuildRecord({
      candidateBytes,
      recordBytes,
      candidateFileName: state.fileNames.candidate
    });
  } catch {
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/deliveryDirectory");
  }
}

async function assertSafeOutputRoot(state) {
  let metadata;
  let canonical;
  try {
    [metadata, canonical] = await Promise.all([
      lstat(state.outputRoot),
      realpath(state.outputRoot)
    ]);
  } catch {
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/outputRoot");
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || canonical !== state.outputRoot ||
      path.dirname(state.finalDirectory) !== state.outputRoot) {
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/outputRoot");
  }
}

function capturePublicationOptions(options) {
  let fields;
  try {
    fields = exactRecord(options, ["plan"], "/options");
    return { plan: fields.plan, signal: undefined };
  } catch (error) {
    if (!(error instanceof ReceiptBoundFinalDeliveryError)) throw error;
  }
  fields = exactRecord(options, ["plan", "signal"], "/options");
  if (!(fields.signal instanceof AbortSignal)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/options/signal");
  }
  return { plan: fields.plan, signal: fields.signal };
}

function assertNotAborted(signal) {
  if (signal?.aborted === true) fail(ERROR_CODES.ABORTED, "/options/signal");
}

/**
 * Publish a complete delivery directory without ever exposing BuildArtifact
 * before its candidate record, QA report, and exact PPTX are file-flushed and
 * visible. The BuildArtifact link is the logical commit marker; POSIX also
 * requests containing-directory fsync barriers. A post-commit barrier
 * failure is reported as uncertain and is never "rolled back" destructively.
 */
export async function publishReceiptBoundFinalDelivery(options) {
  const fields = capturePublicationOptions(options);
  const state = preparedPlans.get(fields.plan);
  if (state === undefined || consumedPlans.has(fields.plan)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/options/plan");
  }
  consumedPlans.add(fields.plan);
  preparedPlans.delete(fields.plan);
  await assertSafeOutputRoot(state);

  try {
    await mkdir(state.finalDirectory, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") fail(ERROR_CODES.OUTPUT_EXISTS, "/deliveryDirectory");
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/deliveryDirectory");
  }
  const publication = {
    outputRoot: state.outputRoot,
    finalDirectory: state.finalDirectory,
    stageEntries: [],
    publicEntries: [],
    committed: false
  };
  const token = `${process.pid}-${randomUUID()}`;
  const entries = [
    ["candidateRecord", state.candidateRecordBytes],
    ["qaReport", state.qaReportBytes],
    ["candidate", state.candidateBytes],
    ["buildArtifact", state.buildArtifactBytes]
  ];

  try {
    assertNotAborted(fields.signal);
    for (const [name, bytes] of entries) {
      const stagePath = path.join(state.finalDirectory, `.stage-${token}-${name}`);
      const metadata = await writeStage(stagePath, bytes, `/${name}`);
      publication.stageEntries.push({ path: stagePath, metadata });
      assertNotAborted(fields.signal);
    }
    for (const [name] of entries.slice(0, 3)) {
      const stage = publication.stageEntries.find((entry) => entry.path.endsWith(`-${name}`));
      const destination = path.join(state.finalDirectory, state.fileNames[name]);
      await linkOwned(stage.path, destination, stage.metadata, `/${name}`, () => {
        publication.publicEntries.push({ path: destination, metadata: stage.metadata });
      });
      await syncDirectory(state.finalDirectory, `/${name}`);
      assertNotAborted(fields.signal);
    }
    await verifyPublishedInputs(state);
    assertNotAborted(fields.signal);
    const buildStage = publication.stageEntries.at(-1);
    const buildDestination = path.join(state.finalDirectory, state.fileNames.buildArtifact);
    const stagedBuildBytes = await readFile(buildStage.path);
    if (!sameBytes(stagedBuildBytes, state.buildArtifactBytes)) {
      fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/buildArtifact");
    }
    await linkOwned(
      buildStage.path,
      buildDestination,
      buildStage.metadata,
      "/buildArtifact",
      () => {
        publication.publicEntries.push({ path: buildDestination, metadata: buildStage.metadata });
        publication.committed = true;
        assertNotAborted(fields.signal);
      }
    );
    for (const stage of publication.stageEntries) {
      if (!await unlinkOwned(stage.path, stage.metadata)) {
        fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/deliveryDirectory/staging");
      }
    }
    await syncDirectory(state.finalDirectory, "/deliveryDirectory");
    await syncDirectory(state.outputRoot, "/outputRoot");
  } catch (error) {
    if (publication.committed) {
      fail(ERROR_CODES.COMMIT_UNCERTAIN, "/deliveryDirectory", {
        commitState: "uncertain",
        rollbackStatus: "not-attempted"
      });
    }
    const rolledBack = await rollbackDirectory(publication);
    if (!rolledBack) {
      fail(ERROR_CODES.ROLLBACK_INCOMPLETE, "/deliveryDirectory", {
        rollbackStatus: "incomplete"
      });
    }
    if (error instanceof ReceiptBoundFinalDeliveryError) {
      if (error.rollbackStatus === undefined) error.rollbackStatus = "complete";
      throw error;
    }
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/deliveryDirectory", {
      rollbackStatus: "complete"
    });
  }

  return Object.freeze({
    deliveryVersion: RECEIPT_BOUND_FINAL_DELIVERY_VERSION,
    artifactType: "published-pptx",
    verificationProfile: state.deliveryVerificationProfile,
    publishPath: state.publishPath,
    sha256: state.buildArtifact.output.sha256,
    byteLength: state.buildArtifact.output.byteLength,
    qaReportId: state.qaReport.qaReportId,
    buildId: state.buildArtifact.buildId,
    files: Object.freeze([
      state.fileNames.candidateRecord,
      state.fileNames.qaReport,
      state.fileNames.candidate,
      state.fileNames.buildArtifact
    ])
  });
}
