import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";

import {
  createCandidateBuildRecord,
  createOrderedCandidateBuildRecord
} from "./candidate-build-record.mjs";
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
import { authenticateNativeOmmlFormulaAssemblyArtifact } from
  "./native-omml-formula-assembly.mjs";
import { authenticateOrderedSlideAssemblyArtifact } from
  "./ordered-slide-assembly.mjs";
import { SECURE_ZIP_LIMITS } from "./secure-zip.mjs";

export {
  NATIVE_PRESENTATION_CANDIDATE_VERSION,
  NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES,
  NATIVE_PRESENTATION_PUBLICATION_VERSION,
  NativePresentationPublicationError
} from "./candidate-pair-publication.mjs";

const ERROR_CODES = NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES;
const fail = failNativePresentationPublication;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

function authenticateArtifact(artifact, { allowGenericOrdered = false } = {}) {
  const artifactFields = exactRecord(artifact, ["archiveBytes", "report"], "/artifact");
  const capturedArtifact = Object.freeze({
    archiveBytes: artifactFields.archiveBytes,
    report: artifactFields.report
  });
  try {
    const authenticated = authenticateNativeCardArrowAssemblyArtifact(capturedArtifact);
    if (authenticated.authority.artifactType !== "native-card-arrow-assembled-pptx" ||
        authenticated.authority.verificationProfile !==
          "target-specific-native-card-arrow-output" ||
        authenticated.authority.publicationEligible !== false ||
        authenticated.authority.authenticatedPublicationProfile !==
          "direct-native-artifact-only") {
      fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report");
    }
    return {
      archiveBytes: authenticated.archiveBytes,
      sourceArtifactType: authenticated.authority.artifactType,
      sourceVerificationProfile: authenticated.authority.verificationProfile,
      report: artifactFields.report
    };
  } catch (error) {
    if (error instanceof NativePresentationPublicationError) throw error;
  }
  try {
    const authenticated = authenticateNativeOmmlFormulaAssemblyArtifact(capturedArtifact);
    if (authenticated.authority.artifactType !== "native-omml-formula-assembled-pptx" ||
        authenticated.authority.verificationProfile !==
          "target-specific-native-omml-formula-output" ||
        authenticated.authority.publicationEligible !== false ||
        authenticated.authority.authenticatedPublicationProfile !==
          "direct-native-omml-artifact-only") {
      fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report");
    }
    return {
      archiveBytes: authenticated.archiveBytes,
      sourceArtifactType: authenticated.authority.artifactType,
      sourceVerificationProfile: authenticated.authority.verificationProfile,
      report: artifactFields.report
    };
  } catch (error) {
    if (error instanceof NativePresentationPublicationError) throw error;
  }
  try {
    const authenticated = authenticateOrderedSlideAssemblyArtifact(capturedArtifact);
    const nativeOrdered =
      authenticated.authority.verificationProfile === "authenticated-native-ordered-output" &&
      authenticated.authority.genericPublicationEligible === false &&
      authenticated.authority.containsTargetSpecificNative === true &&
      authenticated.authority.authenticatedPublicationProfile ===
        "native-containing-ordered-artifact-only";
    const genericOrdered = allowGenericOrdered &&
      authenticated.authority.verificationProfile === "secure-generic-ordered-output" &&
      authenticated.authority.genericPublicationEligible === true &&
      authenticated.authority.containsTargetSpecificNative === false &&
      authenticated.authority.authenticatedPublicationProfile === null;
    if (authenticated.authority.artifactType !== "ordered-assembled-pptx" ||
        (!nativeOrdered && !genericOrdered)) {
      fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report");
    }
    return {
      archiveBytes: authenticated.archiveBytes,
      sourceArtifactType: authenticated.authority.artifactType,
      sourceVerificationProfile: authenticated.authority.verificationProfile,
      report: artifactFields.report,
      candidateRecordFacts: authenticated.candidateRecordFacts
    };
  } catch (error) {
    if (error instanceof NativePresentationPublicationError) throw error;
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report");
  }
}

function validateDestination(value) {
  if (typeof value !== "string" || !path.isAbsolute(value) ||
      path.normalize(value) !== value || !value.toLowerCase().endsWith(".pptx") ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/destination");
  }
  return value;
}

async function destinationExists(destination, pointer = "/destination") {
  try {
    await lstat(destination);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, pointer);
  }
}

async function unlinkIfOwned(stagePath, destination) {
  let stageMetadata;
  let destinationMetadata;
  try {
    destinationMetadata = await lstat(destination);
  } catch (error) {
    if (error?.code === "ENOENT") return "absent";
    return "failed";
  }
  try {
    stageMetadata = await lstat(stagePath);
  } catch {
    return "failed";
  }
  if (stageMetadata.dev !== destinationMetadata.dev ||
      stageMetadata.ino !== destinationMetadata.ino) {
    return "not-owned";
  }
  try {
    await unlink(destination);
    return "removed";
  } catch (error) {
    if (error?.code === "ENOENT") return "absent";
    return "failed";
  }
}

async function writeAuthenticatedNativeArtifact(options) {
  const fields = exactRecord(options, ["artifact", "destinationPath"], "/options");
  const authenticated = authenticateArtifact(fields.artifact);
  const destination = validateDestination(fields.destinationPath);
  const snapshot = authenticated.archiveBytes;
  if (snapshot.length < 1 || snapshot.length > SECURE_ZIP_LIMITS.maxArchiveBytes) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/archiveBytes");
  }

  const parent = path.dirname(destination);
  let parentMetadata;
  let canonicalParent;
  try {
    [parentMetadata, canonicalParent] = await Promise.all([lstat(parent), realpath(parent)]);
  } catch {
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/destination");
  }
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink() ||
      canonicalParent !== parent) {
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/destination");
  }
  if (await destinationExists(destination)) {
    fail(ERROR_CODES.OUTPUT_EXISTS, "/destination");
  }

  const stagePath = path.join(
    parent,
    `.pptx-pipeline-native-stage-${process.pid}-${randomUUID()}`
  );
  let handle;
  let linked = false;
  try {
    handle = await open(
      stagePath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY |
        (fsConstants.O_NOFOLLOW ?? 0),
      0o600
    );
    await handle.writeFile(snapshot);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(stagePath, destination);
    linked = true;
    const [stageMetadata, destinationMetadata] = await Promise.all([
      lstat(stagePath),
      lstat(destination)
    ]);
    if (!stageMetadata.isFile() || destinationMetadata.isSymbolicLink() ||
        stageMetadata.dev !== destinationMetadata.dev ||
        stageMetadata.ino !== destinationMetadata.ino) {
      fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/destination");
    }
    await unlink(stagePath);
  } catch (error) {
    if (handle) {
      try { await handle.close(); } catch { /* best-effort close */ }
    }
    if (linked) await unlinkIfOwned(stagePath, destination);
    try { await unlink(stagePath); } catch { /* best-effort staging cleanup */ }
    if (error instanceof NativePresentationPublicationError) throw error;
    if (error?.code === "EEXIST") fail(ERROR_CODES.OUTPUT_EXISTS, "/destination");
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/destination");
  }

  return Object.freeze({
    sourceArtifactType: authenticated.sourceArtifactType,
    sourceVerificationProfile: authenticated.sourceVerificationProfile,
    bytes: snapshot.length,
    sha256: sha256(snapshot)
  });
}

function directCandidateRecord(authenticated, candidateFileName) {
  const report = authenticated.report;
  if (report?.layoutIr?.inputProfile !== "bounded-slot-placement") {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report/layoutIr/inputProfile");
  }
  let capabilityEvidence;
  if (authenticated.sourceArtifactType === "native-card-arrow-assembled-pptx") {
    capabilityEvidence = Object.freeze({
      evidenceType: "native-card-arrow",
      allocatedShapeIds: report.allocatedShapeIds
    });
  } else if (authenticated.sourceArtifactType === "native-omml-formula-assembled-pptx") {
    capabilityEvidence = Object.freeze({
      evidenceType: "native-omml-formula",
      formulaDigest: report.formulaDigest,
      formulaTarget: report.formulaTarget
    });
  } else {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report/artifactType");
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
      capabilityEvidence
    });
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report");
  }
}

function orderedCandidateRecord(authenticated, candidateFileName) {
  if (authenticated.sourceArtifactType !== "ordered-assembled-pptx" ||
      authenticated.candidateRecordFacts === undefined) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report");
  }
  const facts = authenticated.candidateRecordFacts;
  try {
    return createOrderedCandidateBuildRecord({
      candidateBytes: authenticated.archiveBytes,
      candidateFileName,
      baseArtifactSha256: facts.baseArtifactSha256,
      orderedDeck: {
        assemblyVersion: facts.assemblyVersion,
        slides: facts.slides,
        diff: facts.diff
      }
    });
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report");
  }
}

/**
 * Persist an authenticated direct semantic-slot candidate and its replayable
 * build record as one create-only pair. Successful rollback removes both owned
 * destinations; if candidate removal or its directory barrier cannot be
 * confirmed, the record is deliberately retained to avoid an orphan candidate.
 */
export async function writeAuthenticatedNativeCandidateBundle(options, operationOverrides) {
  const fields = exactRecord(options, ["artifact", "destinationPath"], "/options");
  const authenticated = authenticateArtifact(fields.artifact);
  const destination = validateDestination(fields.destinationPath);
  const encoded = directCandidateRecord(authenticated, path.basename(destination));
  return persistAuthenticatedCandidatePair({
    candidateBytes: encoded.candidateBytes,
    destinationPath: destination,
    recordBytes: encoded.recordBytes,
    recordSha256: encoded.recordSha256,
    sourceArtifactType: authenticated.sourceArtifactType,
    sourceVerificationProfile: authenticated.sourceVerificationProfile,
    verificationProfile: "authenticated-native-candidate-artifact"
  }, operationOverrides);
}

/**
 * Persist one complete authenticated ordered deck and its per-slide replay
 * record. Generic clone/fill inputs remain digest-bound; every native slide
 * must have a bounded semantic-slot IR and exact composed-plan replay.
 */
export async function writeAuthenticatedOrderedCandidateBundle(options, operationOverrides) {
  const fields = exactRecord(options, ["artifact", "destinationPath"], "/options");
  const authenticated = authenticateArtifact(fields.artifact, { allowGenericOrdered: true });
  if (authenticated.sourceArtifactType !== "ordered-assembled-pptx") {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/report");
  }
  const destination = validateDestination(fields.destinationPath);
  const encoded = orderedCandidateRecord(authenticated, path.basename(destination));
  return persistAuthenticatedCandidatePair({
    candidateBytes: encoded.candidateBytes,
    destinationPath: destination,
    recordBytes: encoded.recordBytes,
    recordSha256: encoded.recordSha256,
    sourceArtifactType: authenticated.sourceArtifactType,
    sourceVerificationProfile: authenticated.sourceVerificationProfile,
    verificationProfile: "authenticated-ordered-candidate-artifact"
  }, operationOverrides);
}

/**
 * Create-only writer for a structurally authenticated candidate. This function
 * deliberately grants no delivery authority: render, mechanical, visual, and
 * compatibility evidence must be bound by a later delivery orchestrator.
 */
export async function writeAuthenticatedNativeCandidate(options) {
  const written = await writeAuthenticatedNativeArtifact(options);
  return Object.freeze({
    candidateVersion: NATIVE_PRESENTATION_CANDIDATE_VERSION,
    artifactType: "candidate-pptx",
    verificationProfile: "authenticated-native-candidate-artifact",
    deliveryEligible: false,
    ...written
  });
}

/**
 * Compatibility alias retained for existing 0.x callers. Despite the legacy
 * name and response fields, this writes only a candidate and is not a delivery
 * approval boundary.
 */
export async function publishAuthenticatedNativePresentation(options) {
  const written = await writeAuthenticatedNativeArtifact(options);
  return Object.freeze({
    publicationVersion: NATIVE_PRESENTATION_PUBLICATION_VERSION,
    artifactType: "published-pptx",
    verificationProfile: "authenticated-native-presentation-artifact",
    ...written
  });
}
