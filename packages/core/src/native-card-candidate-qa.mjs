import {
  CANDIDATE_BUILD_RECORD_MAX_BYTES,
  verifyCandidateBuildRecord
} from "./candidate-build-record.mjs";
import { createAuthenticatedNativeCardCandidateSnapshot } from
  "./native-card-candidate-publication.mjs";
import { SECURE_ZIP_LIMITS } from "./secure-zip.mjs";

export const NATIVE_CARD_CANDIDATE_QA_VERSION = "0.1.0";
export const NATIVE_CARD_CANDIDATE_QA_MAX_PPTX_BYTES =
  SECURE_ZIP_LIMITS.maxArchiveBytes;

const ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "NATIVE_CARD_CANDIDATE_QA_ARGUMENT_INVALID",
  CANDIDATE_INVALID: "NATIVE_CARD_CANDIDATE_QA_CANDIDATE_INVALID",
  CONTRACT_INVALID: "NATIVE_CARD_CANDIDATE_QA_CONTRACT_INVALID"
});
const typedArrayByteLength = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength"
).get;

export class NativeCardCandidateQaError extends Error {
  constructor(code, pointer) {
    super(`${code} at ${pointer}`);
    this.name = "NativeCardCandidateQaError";
    this.code = code;
    this.pointer = pointer;
  }
}

function fail(code, pointer) {
  throw new NativeCardCandidateQaError(code, pointer);
}

function exactRecord(value, expectedKeys, pointer) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  let prototype;
  let descriptors;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  if ((prototype !== Object.prototype && prototype !== null) ||
      Reflect.ownKeys(descriptors).length !== expectedKeys.length ||
      Reflect.ownKeys(descriptors).some((key) =>
        typeof key !== "string" || !expectedKeys.includes(key))) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  const fields = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) ||
        descriptor.enumerable !== true) {
      fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/${key}`);
    }
    fields[key] = descriptor.value;
  }
  return fields;
}

function snapshotBuffer(value, maximumBytes, pointer) {
  if (!Buffer.isBuffer(value)) fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  let byteLength;
  let snapshot;
  try {
    byteLength = Reflect.apply(typedArrayByteLength, value, []);
    if (!Number.isSafeInteger(byteLength) || byteLength < 1 || byteLength > maximumBytes) {
      fail(ERROR_CODES.CANDIDATE_INVALID, pointer);
    }
    snapshot = Buffer.from(value);
  } catch (error) {
    if (error instanceof NativeCardCandidateQaError) throw error;
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  if (snapshot.length !== byteLength) fail(ERROR_CODES.CANDIDATE_INVALID, pointer);
  return snapshot;
}

function consumePromiseRejection(value) {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") {
    return false;
  }
  try {
    Promise.prototype.then.call(value, undefined, () => {});
    return true;
  } catch {
    return false;
  }
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function createReport(identity) {
  const check = (checkId, outcome, manualGateIds = []) => ({
    checkId,
    qaContractId: identity.qaContractId,
    scopeKind: "build",
    scopeId: identity.buildId,
    outcome,
    manualGateIds,
    diagnosticIds: []
  });
  return {
    schemaVersion: NATIVE_CARD_CANDIDATE_QA_VERSION,
    contractType: "qa-report",
    qaReportId: identity.qaReportId,
    buildId: identity.buildId,
    projectId: identity.projectId,
    deckId: identity.deckId,
    templateProfileId: identity.templateProfileId,
    templateIndexId: identity.templateIndexId,
    capabilityRegistryId: identity.capabilityRegistryId,
    registryVersion: identity.registryVersion,
    projectOverlayId: identity.projectOverlayId,
    templateSha256: identity.templateSha256,
    decision: "blocked",
    checks: [
      check("candidate-record-replay", "pass"),
      check("mechanical-constraints", "pass"),
      check("package-source-diff", "pass"),
      check("pixel-review", "unavailable", ["pixel-review-gate"]),
      check("powerpoint-compatibility", "unavailable", ["powerpoint-compatibility-gate"]),
      check("render-complete", "unavailable", ["render-complete-gate"])
    ],
    manualGates: [
      {
        manualGateId: "pixel-review-gate",
        supportMatrixItemId: "manual-trusted-runtime",
        scopeKind: "build",
        scopeId: identity.buildId,
        status: "unavailable"
      },
      {
        manualGateId: "powerpoint-compatibility-gate",
        supportMatrixItemId: "macos-powerpoint-automation",
        scopeKind: "build",
        scopeId: identity.buildId,
        status: "unavailable"
      },
      {
        manualGateId: "render-complete-gate",
        supportMatrixItemId: "manual-trusted-runtime",
        scopeKind: "build",
        scopeId: identity.buildId,
        status: "unavailable"
      }
    ],
    diagnostics: []
  };
}

/**
 * Reconstruct the exact expected public-synthetic candidate, bind the readable
 * CandidateBuildRecord to both current source constraints and on-disk bytes,
 * then report missing external visual/compatibility evidence honestly.
 */
export function assessNativeCardCandidate(options) {
  const fields = exactRecord(options, [
    "actualCandidateBytes",
    "actualRecordBytes",
    "artifact",
    "candidateFileName",
    "identity",
    "validateQaReport"
  ], "/options");
  if (typeof fields.validateQaReport !== "function") {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/options/validateQaReport");
  }
  const identity = exactRecord(fields.identity, [
    "buildId",
    "capabilityRegistryId",
    "deckId",
    "projectId",
    "projectOverlayId",
    "qaContractId",
    "qaReportId",
    "registryVersion",
    "templateIndexId",
    "templateProfileId",
    "templateSha256"
  ], "/options/identity");
  const actualCandidateBytes = snapshotBuffer(
    fields.actualCandidateBytes,
    NATIVE_CARD_CANDIDATE_QA_MAX_PPTX_BYTES,
    "/candidateBytes"
  );
  const actualRecordBytes = snapshotBuffer(
    fields.actualRecordBytes,
    CANDIDATE_BUILD_RECORD_MAX_BYTES,
    "/candidateRecord"
  );
  let expected;
  try {
    expected = createAuthenticatedNativeCardCandidateSnapshot({
      artifact: fields.artifact,
      candidateFileName: fields.candidateFileName
    });
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/artifact");
  }
  if (!actualCandidateBytes.equals(expected.candidateBytes)) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/candidateBytes");
  }
  if (!actualRecordBytes.equals(expected.recordBytes)) {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/candidateRecord");
  }
  try {
    verifyCandidateBuildRecord({
      candidateBytes: actualCandidateBytes,
      recordBytes: actualRecordBytes,
      candidateFileName: fields.candidateFileName
    });
  } catch {
    fail(ERROR_CODES.CANDIDATE_INVALID, "/candidateRecord");
  }
  const report = deepFreeze(createReport(identity));
  let valid;
  try {
    valid = fields.validateQaReport(report);
  } catch {
    fail(ERROR_CODES.CONTRACT_INVALID, "/qaReport");
  }
  if (valid !== true) {
    consumePromiseRejection(valid);
    fail(ERROR_CODES.CONTRACT_INVALID, "/qaReport");
  }
  return report;
}
