import path from "node:path";

import { createCandidateBuildRecord } from "./candidate-build-record.mjs";
import {
  NATIVE_PRESENTATION_CANDIDATE_VERSION,
  NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES,
  NATIVE_PRESENTATION_PUBLICATION_VERSION,
  NativePresentationPublicationError,
  failNativePresentationPublication,
  persistAuthenticatedCandidatePair
} from "./candidate-pair-publication.mjs";
import { authenticateNativeCardArrowAssemblyArtifact } from
  "./native-card-arrow-assembly.mjs";

export {
  NATIVE_PRESENTATION_CANDIDATE_VERSION,
  NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES,
  NATIVE_PRESENTATION_PUBLICATION_VERSION,
  NativePresentationPublicationError
} from "./candidate-pair-publication.mjs";

const ERROR_CODES = NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES;
const fail = failNativePresentationPublication;

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

function validateDestination(value) {
  if (typeof value !== "string" || !path.isAbsolute(value) ||
      path.normalize(value) !== value || !value.toLowerCase().endsWith(".pptx") ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/destination");
  }
  return value;
}

function authenticateNativeCardArtifact(artifact) {
  const fields = exactRecord(artifact, ["archiveBytes", "report"], "/artifact");
  const captured = Object.freeze({
    archiveBytes: fields.archiveBytes,
    report: fields.report
  });
  let authenticated;
  try {
    authenticated = authenticateNativeCardArrowAssemblyArtifact(captured);
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report");
  }
  const authority = authenticated.authority;
  if (authority.artifactType !== "native-card-arrow-assembled-pptx" ||
      authority.verificationProfile !== "target-specific-native-card-arrow-output" ||
      authority.publicationEligible !== false ||
      authority.authenticatedPublicationProfile !== "direct-native-artifact-only") {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report");
  }
  return Object.freeze({
    archiveBytes: authenticated.archiveBytes,
    report: fields.report,
    sourceArtifactType: authority.artifactType,
    sourceVerificationProfile: authority.verificationProfile
  });
}

function createNativeCardRecord(authenticated, candidateFileName) {
  const report = authenticated.report;
  if (report?.layoutIr?.inputProfile !== "bounded-slot-placement") {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report/layoutIr/inputProfile");
  }
  try {
    return createCandidateBuildRecord({
      candidateBytes: authenticated.archiveBytes,
      candidateFileName,
      sourceArtifactType: authenticated.sourceArtifactType,
      sourceVerificationProfile: authenticated.sourceVerificationProfile,
      baseArtifactSha256: report.baseOutputSha256,
      slideId: report.outputSlideId,
      slidePart: report.slidePart,
      layoutIr: report.layoutIr,
      composedSlidePlan: report.composedSlidePlan,
      diff: report.diff,
      capabilityEvidence: Object.freeze({
        evidenceType: "native-card-arrow",
        allocatedShapeIds: report.allocatedShapeIds
      })
    });
  } catch (error) {
    if (error instanceof NativePresentationPublicationError) throw error;
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report");
  }
}

export function createAuthenticatedNativeCardCandidateSnapshot(options) {
  const fields = exactRecord(options, ["artifact", "candidateFileName"], "/options");
  if (typeof fields.candidateFileName !== "string" ||
      path.basename(fields.candidateFileName) !== fields.candidateFileName ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,239}[.][Pp][Pp][Tt][Xx]$/u.test(
        fields.candidateFileName
      )) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/candidateFileName");
  }
  const authenticated = authenticateNativeCardArtifact(fields.artifact);
  const encoded = createNativeCardRecord(authenticated, fields.candidateFileName);
  return Object.freeze({
    candidateBytes: encoded.candidateBytes,
    record: encoded.record,
    recordBytes: encoded.recordBytes,
    recordSha256: encoded.recordSha256,
    sourceArtifactType: authenticated.sourceArtifactType,
    sourceVerificationProfile: authenticated.sourceVerificationProfile,
    verificationProfile: "authenticated-native-candidate-artifact"
  });
}

/**
 * Authenticate and publish the exact native-card candidate pair used by the
 * installed public-synthetic CLI through the shared record-first/logical-marker
 * writer. No OMML or ordered-deck authority is imported through this entry
 * point.
 */
export async function writeAuthenticatedNativeCardCandidateBundle(
  options,
  operationOverrides
) {
  const fields = exactRecord(options, ["artifact", "destinationPath"], "/options");
  const destinationPath = validateDestination(fields.destinationPath);
  const snapshot = createAuthenticatedNativeCardCandidateSnapshot({
    artifact: fields.artifact,
    candidateFileName: path.basename(destinationPath)
  });
  return persistAuthenticatedCandidatePair({
    candidateBytes: snapshot.candidateBytes,
    destinationPath,
    recordBytes: snapshot.recordBytes,
    recordSha256: snapshot.recordSha256,
    sourceArtifactType: snapshot.sourceArtifactType,
    sourceVerificationProfile: snapshot.sourceVerificationProfile,
    verificationProfile: snapshot.verificationProfile
  }, operationOverrides);
}
