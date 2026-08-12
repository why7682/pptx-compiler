import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  CANDIDATE_BUILD_RECORD_MAX_BYTES,
  candidateBuildRecordFileName,
  verifyCandidateBuildRecord
} from "./candidate-build-record.mjs";
import { SECURE_ZIP_LIMITS } from "./secure-zip.mjs";

export const NATIVE_PRESENTATION_PUBLICATION_VERSION = "0.1.0";
export const NATIVE_PRESENTATION_CANDIDATE_VERSION = "0.1.0";

export const NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "NATIVE_PRESENTATION_PUBLICATION_ARGUMENT_INVALID",
  COMMIT_UNCERTAIN: "NATIVE_PRESENTATION_PUBLICATION_COMMIT_UNCERTAIN",
  NOT_COMMITTED: "NATIVE_PRESENTATION_PUBLICATION_NOT_COMMITTED",
  OUTPUT_EXISTS: "NATIVE_PRESENTATION_PUBLICATION_OUTPUT_EXISTS",
  OUTPUT_WRITE_FAILED: "NATIVE_PRESENTATION_PUBLICATION_OUTPUT_WRITE_FAILED",
  ROLLBACK_INCOMPLETE: "NATIVE_PRESENTATION_PUBLICATION_ROLLBACK_INCOMPLETE",
  SOURCE_MISMATCH: "NATIVE_PRESENTATION_PUBLICATION_SOURCE_MISMATCH"
});

export class NativePresentationPublicationError extends Error {
  constructor(code, pointer) {
    super(`${code} at ${pointer}`);
    this.name = "NativePresentationPublicationError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

export function failNativePresentationPublication(code, pointer) {
  throw new NativePresentationPublicationError(code, pointer);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactRecord(value, expectedKeys, pointer) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.ARGUMENT_INVALID,
      pointer
    );
  }
  let prototype;
  let descriptors;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.ARGUMENT_INVALID,
      pointer
    );
  }
  if ((prototype !== Object.prototype && prototype !== null) ||
      Reflect.ownKeys(descriptors).length !== expectedKeys.length ||
      Reflect.ownKeys(descriptors).some((key) =>
        typeof key !== "string" || !expectedKeys.includes(key))) {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.ARGUMENT_INVALID,
      pointer
    );
  }
  const fields = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) ||
        descriptor.enumerable !== true) {
      failNativePresentationPublication(
        NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.ARGUMENT_INVALID,
        `${pointer}/${key}`
      );
    }
    fields[key] = descriptor.value;
  }
  return fields;
}

function snapshotBuffer(value, maximum, pointer) {
  if (!Buffer.isBuffer(value)) {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.ARGUMENT_INVALID,
      pointer
    );
  }
  let snapshot;
  try {
    if (value.byteLength < 1 || value.byteLength > maximum) {
      failNativePresentationPublication(
        NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.SOURCE_MISMATCH,
        pointer
      );
    }
    snapshot = Buffer.from(value);
  } catch (error) {
    if (error instanceof NativePresentationPublicationError) throw error;
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.ARGUMENT_INVALID,
      pointer
    );
  }
  return snapshot;
}

function validateDestination(value) {
  if (typeof value !== "string" || !path.isAbsolute(value) ||
      path.normalize(value) !== value || !value.toLowerCase().endsWith(".pptx") ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.ARGUMENT_INVALID,
      "/destination"
    );
  }
  return value;
}

function boundedMetadataString(value, pointer) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.ARGUMENT_INVALID,
      pointer
    );
  }
  return value;
}

function captureBundle(options) {
  const fields = exactRecord(options, [
    "candidateBytes",
    "destinationPath",
    "recordBytes",
    "recordSha256",
    "sourceArtifactType",
    "sourceVerificationProfile",
    "verificationProfile"
  ], "/options");
  const destination = validateDestination(fields.destinationPath);
  const candidateBytes = snapshotBuffer(
    fields.candidateBytes,
    SECURE_ZIP_LIMITS.maxArchiveBytes,
    "/artifact/archiveBytes"
  );
  const recordBytes = snapshotBuffer(
    fields.recordBytes,
    CANDIDATE_BUILD_RECORD_MAX_BYTES,
    "/artifact/recordBytes"
  );
  const sourceArtifactType = boundedMetadataString(
    fields.sourceArtifactType,
    "/artifact/sourceArtifactType"
  );
  const sourceVerificationProfile = boundedMetadataString(
    fields.sourceVerificationProfile,
    "/artifact/sourceVerificationProfile"
  );
  const verificationProfile = boundedMetadataString(
    fields.verificationProfile,
    "/artifact/verificationProfile"
  );
  let verified;
  try {
    verified = verifyCandidateBuildRecord({
      candidateBytes,
      recordBytes,
      candidateFileName: path.basename(destination)
    });
  } catch {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.SOURCE_MISMATCH,
      "/artifact/recordBytes"
    );
  }
  const actualRecordSha256 = sha256(recordBytes);
  if (fields.recordSha256 !== actualRecordSha256 ||
      verified.record.output.sha256 !== sha256(candidateBytes) ||
      !isDeepStrictEqual(verified.record.output.fileName, path.basename(destination))) {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.SOURCE_MISMATCH,
      "/artifact/recordBytes"
    );
  }
  return Object.freeze({
    candidateBytes,
    destination,
    record: verified.record,
    recordBytes,
    recordSha256: actualRecordSha256,
    sourceArtifactType,
    sourceVerificationProfile,
    verificationProfile
  });
}

async function destinationExists(destination, pointer = "/destination") {
  try {
    await lstat(destination);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.OUTPUT_WRITE_FAILED,
      pointer
    );
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
    return error?.code === "ENOENT" ? "absent" : "failed";
  }
}

async function writeStage(stagePath, bytes) {
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
  } catch (error) {
    if (handle) {
      try { await handle.close(); } catch { /* best-effort close */ }
    }
    throw error;
  }
}

async function verifyOwnedLink(stagePath, destination, pointer) {
  let stageMetadata;
  let destinationMetadata;
  try {
    [stageMetadata, destinationMetadata] = await Promise.all([
      lstat(stagePath),
      lstat(destination)
    ]);
  } catch {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.OUTPUT_WRITE_FAILED,
      pointer
    );
  }
  if (!stageMetadata.isFile() || destinationMetadata.isSymbolicLink() ||
      stageMetadata.dev !== destinationMetadata.dev ||
      stageMetadata.ino !== destinationMetadata.ino) {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.OUTPUT_WRITE_FAILED,
      pointer
    );
  }
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
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.OUTPUT_WRITE_FAILED,
      pointer
    );
  }
}

function captureOperations(value) {
  if (value === undefined) return Object.freeze({ syncDirectory });
  const fields = exactRecord(value, ["syncDirectory"], "/operations");
  if (typeof fields.syncDirectory !== "function") {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.ARGUMENT_INVALID,
      "/operations/syncDirectory"
    );
  }
  return Object.freeze({ syncDirectory: fields.syncDirectory });
}

async function unlinkStage(stagePath) {
  try {
    await unlink(stagePath);
    return true;
  } catch (error) {
    return error?.code === "ENOENT";
  }
}

async function rollbackBeforeMarker({
  operations,
  parent,
  recordLinked,
  recordStage,
  recordDestination,
  candidateStage
}) {
  let complete = true;
  if (recordLinked) {
    const removal = await unlinkIfOwned(recordStage, recordDestination);
    complete = removal === "removed" || removal === "absent";
    if (complete) {
      try {
        await operations.syncDirectory(parent, "/recordDestination");
      } catch {
        complete = false;
      }
    }
  }
  const [recordStageRemoved, candidateStageRemoved] = await Promise.all([
    unlinkStage(recordStage),
    unlinkStage(candidateStage)
  ]);
  return complete && recordStageRemoved && candidateStageRemoved;
}

/**
 * Publish an already-authenticated canonical candidate/record pair without any
 * knowledge of the artifact grammar that produced it. Both payload files are
 * flushed before linking. The record link is visible first and the candidate
 * link is the logical commit marker; POSIX additionally enforces that order
 * by requesting parent-directory fsync barriers.
 */
export async function persistAuthenticatedCandidatePair(options, operationOverrides) {
  const captured = captureBundle(options);
  const operations = captureOperations(operationOverrides);
  const destination = captured.destination;
  const parent = path.dirname(destination);
  const candidateFileName = path.basename(destination);
  const recordFileName = candidateBuildRecordFileName(candidateFileName);
  const recordDestination = path.join(parent, recordFileName);
  let parentMetadata;
  let canonicalParent;
  try {
    [parentMetadata, canonicalParent] = await Promise.all([lstat(parent), realpath(parent)]);
  } catch {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.OUTPUT_WRITE_FAILED,
      "/destination"
    );
  }
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink() ||
      canonicalParent !== parent || path.dirname(recordDestination) !== parent) {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.OUTPUT_WRITE_FAILED,
      "/destination"
    );
  }
  const [candidateExists, recordExists] = await Promise.all([
    destinationExists(destination),
    destinationExists(recordDestination, "/recordDestination")
  ]);
  if (candidateExists) {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.OUTPUT_EXISTS,
      "/destination"
    );
  }
  if (recordExists) {
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.OUTPUT_EXISTS,
      "/recordDestination"
    );
  }

  const token = `${process.pid}-${randomUUID()}`;
  const candidateStage = path.join(parent, `.pptx-pipeline-candidate-stage-${token}`);
  const recordStage = path.join(parent, `.pptx-pipeline-record-stage-${token}`);
  let candidateLinked = false;
  let recordLinked = false;
  let failurePointer = "/destination";
  try {
    await writeStage(candidateStage, captured.candidateBytes);
    failurePointer = "/recordDestination";
    await writeStage(recordStage, captured.recordBytes);
    await link(recordStage, recordDestination);
    recordLinked = true;
    await operations.syncDirectory(parent, "/recordDestination");
    failurePointer = "/destination";
    await link(candidateStage, destination);
    candidateLinked = true;
    await operations.syncDirectory(parent, "/destination");
    await verifyOwnedLink(candidateStage, destination, "/destination");
    failurePointer = "/recordDestination";
    await verifyOwnedLink(recordStage, recordDestination, "/recordDestination");
  } catch (error) {
    if (candidateLinked) {
      await unlinkStage(recordStage);
      await unlinkStage(candidateStage);
      failNativePresentationPublication(
        NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.COMMIT_UNCERTAIN,
        failurePointer
      );
    }
    const rolledBack = await rollbackBeforeMarker({
      operations,
      parent,
      recordLinked,
      recordStage,
      recordDestination,
      candidateStage
    });
    if (!rolledBack) {
      failNativePresentationPublication(
        NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.ROLLBACK_INCOMPLETE,
        failurePointer
      );
    }
    if (error?.code === "EEXIST") {
      failNativePresentationPublication(
        NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.OUTPUT_EXISTS,
        failurePointer
      );
    }
    failNativePresentationPublication(
      NATIVE_PRESENTATION_PUBLICATION_ERROR_CODES.NOT_COMMITTED,
      failurePointer
    );
  }
  try { await unlink(recordStage); } catch { /* hidden staging cleanup is best-effort */ }
  try { await unlink(candidateStage); } catch { /* hidden staging cleanup is best-effort */ }

  return Object.freeze({
    candidateVersion: NATIVE_PRESENTATION_CANDIDATE_VERSION,
    artifactType: "candidate-pptx",
    verificationProfile: captured.verificationProfile,
    deliveryEligible: false,
    sourceArtifactType: captured.sourceArtifactType,
    sourceVerificationProfile: captured.sourceVerificationProfile,
    bytes: captured.candidateBytes.length,
    sha256: sha256(captured.candidateBytes),
    buildRecord: Object.freeze({
      schemaVersion: captured.record.schemaVersion,
      contractType: captured.record.contractType,
      fileName: recordFileName,
      bytes: captured.recordBytes.length,
      sha256: captured.recordSha256
    })
  });
}
