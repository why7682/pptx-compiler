import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { CANDIDATE_BUILD_RECORD_MAX_BYTES } from
  "../packages/core/src/candidate-build-record.mjs";
import { SECURE_ZIP_LIMITS } from "../packages/core/src/secure-zip.mjs";
import { inspectFormulaContentEditTransition } from
  "../packages/powerpoint-macos/src/formula-content-edit-evidence.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const evidenceRoot = path.join(
  repositoryRoot,
  ".private-test-artifacts",
  "powerpoint-ordered"
);
const deliveryRoot = path.join(
  evidenceRoot,
  "workspace",
  "output",
  "mixed-same-candidate-delivery"
);
const fixedPaths = Object.freeze({
  candidate: path.join(deliveryRoot, "ordered-compatibility-source.pptx"),
  candidateRecord: path.join(
    deliveryRoot,
    "ordered-compatibility-source.candidate.json"
  ),
  editedDerivative: path.join(
    evidenceRoot,
    "omml-human-edit-2-over-3-reopened.pptx"
  ),
  evidence: path.join(
    evidenceRoot,
    "omml-human-formula-content-edit-evidence.local.json"
  )
});
const directoryPaths = Object.freeze([
  evidenceRoot,
  path.join(evidenceRoot, "workspace"),
  path.join(evidenceRoot, "workspace", "output"),
  deliveryRoot
]);
export const FIXED_FORMULA_EDIT_ARTIFACT_SHA256 = Object.freeze({
  candidate: "ccbffcb1a37d05c533ab92005da308c9b42b8e5cae0a95f66191d0e2d51a2802",
  candidateRecord: "5a88c576cd37f04b6740b19ee70a2f68a0344166cd3d752dac3882f4611d15c1",
  editedDerivative: "2592ad9da5ec294107ea7b34a56b87f8c2071667843cd14d91df28dad89d28d3"
});
const FIXED_FORMULA_RELATION_SHA256 = Object.freeze({
  formulaSourceArtifact:
    "7747108c39d81de46018a1deac977487aa96c84424936c24c45d7ffaa394cf0f",
  beforeFormulaSlide:
    "b64831ac51be88fb0f69c59c8916d0bbc0c792a6078870d5d1be1a7e291d5df8",
  afterFormulaSlide:
    "8fcca2319f56088c5f951b48d7e6593417279542cabd66bb7073dd5bfc8dceb5"
});
const MAX_LOCAL_JSON_BYTES = 512 * 1024;
const VERSION = /^[0-9]+(?:\.[0-9]+){1,3}$/u;
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;
const CI_KEYS = Object.freeze([
  "CI", "GITHUB_ACTIONS", "GITHUB_EVENT_NAME", "BUILD_BUILDID", "BUILDKITE"
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertFixedFormulaEditArtifactIdentity(value) {
  const actual = Object.freeze({
    candidate: sha256(value.candidateBytes),
    candidateRecord: sha256(value.candidateRecordBytes),
    editedDerivative: sha256(value.editedBytes)
  });
  if (Object.keys(FIXED_FORMULA_EDIT_ARTIFACT_SHA256).some((key) =>
    actual[key] !== FIXED_FORMULA_EDIT_ARTIFACT_SHA256[key])) {
    throw new Error("FORMULA_EDIT_FIXED_ARTIFACT_DRIFT");
  }
  return actual;
}

function assertManualAttestation(values, environment) {
  if (values["trusted-local-run"] !== true ||
      values["operator-attested"] !== true ||
      values["no-repair-attested"] !== true) {
    throw new Error("FORMULA_EDIT_OPERATOR_ATTESTATION_REQUIRED");
  }
  if (CI_KEYS.some((key) => environment[key] || process.env[key])) {
    throw new Error("FORMULA_EDIT_CI_FORBIDDEN");
  }
  for (const key of ["application-version", "operating-system-version"]) {
    if (typeof values[key] !== "string" || !VERSION.test(values[key])) {
      throw new Error("FORMULA_EDIT_ATTESTATION_INVALID");
    }
  }
  const observedOn = values["observed-on"];
  const instant = typeof observedOn === "string" && DATE.test(observedOn)
    ? new Date(`${observedOn}T00:00:00.000Z`)
    : new Date(Number.NaN);
  if (Number.isNaN(instant.valueOf()) ||
      instant.toISOString().slice(0, 10) !== observedOn) {
    throw new Error("FORMULA_EDIT_ATTESTATION_INVALID");
  }
}

async function captureDirectoryChain() {
  const result = [];
  for (const directoryPath of directoryPaths) {
    const [metadata, canonical] = await Promise.all([
      lstat(directoryPath, { bigint: true }),
      realpath(directoryPath)
    ]);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() ||
        canonical !== directoryPath) {
      throw new Error("FORMULA_EDIT_DIRECTORY_CHAIN_INVALID");
    }
    result.push(Object.freeze({
      path: directoryPath,
      dev: metadata.dev,
      ino: metadata.ino
    }));
  }
  return Object.freeze(result);
}

async function assertDirectoryChain(chain) {
  for (const expected of chain) {
    const [metadata, canonical] = await Promise.all([
      lstat(expected.path, { bigint: true }),
      realpath(expected.path)
    ]);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() ||
        canonical !== expected.path || metadata.dev !== expected.dev ||
        metadata.ino !== expected.ino) {
      throw new Error("FORMULA_EDIT_DIRECTORY_CHAIN_CHANGED");
    }
  }
}

function readOnlyNoFollowFlags() {
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) {
    throw new Error("FORMULA_EDIT_NOFOLLOW_UNAVAILABLE");
  }
  return fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW;
}

async function readBounded(filePath, maximum, errorCode) {
  let handle;
  try {
    handle = await open(filePath, readOnlyNoFollowFlags());
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size < 1n || before.size > BigInt(maximum) ||
        before.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(errorCode);
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(
        bytes,
        offset,
        bytes.length - offset,
        offset
      );
      if (bytesRead < 1) throw new Error(errorCode);
      offset += bytesRead;
    }
    const extra = Buffer.allocUnsafe(1);
    const end = await handle.read(extra, 0, 1, bytes.length);
    const after = await handle.stat({ bigint: true });
    if (end.bytesRead !== 0 || before.dev !== after.dev || before.ino !== after.ino ||
        before.size !== after.size || before.mtimeNs !== after.mtimeNs ||
        before.ctimeNs !== after.ctimeNs) {
      throw new Error(errorCode);
    }
    return bytes;
  } catch (error) {
    if (error?.message === "FORMULA_EDIT_NOFOLLOW_UNAVAILABLE") throw error;
    throw new Error(errorCode);
  } finally {
    await handle?.close();
  }
}

function assertFixedTransition(inspection) {
  const before = inspection.machineObservation.before.fraction;
  const after = inspection.machineObservation.after.fraction;
  const artifacts = inspection.artifacts;
  if (before.numerator !== "3" || before.denominator !== "3" ||
      after.numerator !== "2" || after.denominator !== "3" ||
      inspection.machineObservation.slideId !== "mixed-evidence" ||
      artifacts.formulaSourceArtifactSha256 !==
        FIXED_FORMULA_RELATION_SHA256.formulaSourceArtifact ||
      artifacts.beforeFormulaSlideSha256 !==
        FIXED_FORMULA_RELATION_SHA256.beforeFormulaSlide ||
      artifacts.afterFormulaSlideSha256 !==
        FIXED_FORMULA_RELATION_SHA256.afterFormulaSlide) {
    throw new Error("FORMULA_EDIT_FIXED_RELATION_DRIFT");
  }
}

async function writeExactOrReuse(value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await writeFile(fixedPaths.evidence, bytes, { flag: "wx", mode: 0o600 });
    return "created";
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  const existing = await readBounded(
    fixedPaths.evidence,
    MAX_LOCAL_JSON_BYTES,
    "FORMULA_EDIT_EVIDENCE_DRIFT"
  );
  if (!existing.equals(bytes)) throw new Error("FORMULA_EDIT_EVIDENCE_DRIFT");
  return "reused";
}

export async function recordOmmlFormulaContentEditCli(
  argv = process.argv.slice(2),
  environment = process.env
) {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: false,
    strict: true,
    options: {
      "trusted-local-run": { type: "boolean" },
      "operator-attested": { type: "boolean" },
      "no-repair-attested": { type: "boolean" },
      "application-version": { type: "string" },
      "operating-system-version": { type: "string" },
      "observed-on": { type: "string" }
    }
  });
  assertManualAttestation(parsed.values, environment);
  const directoryChain = await captureDirectoryChain();
  const [candidateBytes, candidateRecordBytes, editedBytes] = await Promise.all([
    readBounded(fixedPaths.candidate, SECURE_ZIP_LIMITS.maxArchiveBytes,
      "FORMULA_EDIT_CANDIDATE_INVALID"),
    readBounded(fixedPaths.candidateRecord, CANDIDATE_BUILD_RECORD_MAX_BYTES,
      "FORMULA_EDIT_CANDIDATE_RECORD_INVALID"),
    readBounded(fixedPaths.editedDerivative, SECURE_ZIP_LIMITS.maxArchiveBytes,
      "FORMULA_EDIT_DERIVATIVE_INVALID")
  ]);
  await assertDirectoryChain(directoryChain);
  assertFixedFormulaEditArtifactIdentity({
    candidateBytes,
    candidateRecordBytes,
    editedBytes
  });
  const inspection = inspectFormulaContentEditTransition({
    candidateBytes,
    candidateRecordBytes,
    editedBytes
  });
  assertFixedTransition(inspection);
  const record = {
    recordVersion: "0.1.0",
    recordType: "human-formula-content-edit-evidence",
    evidenceRecordId:
      "urn:pptx-compiler:compatibility:omml-human-formula-edit-local-001",
    gateId: "COMPAT-OMML-001",
    gateScope: "feature-level",
    evidenceLevel: "manual-trusted",
    status: "passed",
    operation: "formula-content-edit-save-reopen",
    authority: "none",
    deliveryEligible: false,
    supportClaimsEnabled: false,
    fixtureScope: "fixed-public-synthetic-mixed-ordered",
    machineObservation: inspection.machineObservation,
    operatorAttestation: {
      attestationType: "explicit-local-operator-statement",
      operatorType: "trusted-local-human",
      applicationName: "Microsoft PowerPoint",
      applicationVersion: parsed.values["application-version"],
      operatingSystemName: "macOS",
      operatingSystemVersion: parsed.values["operating-system-version"],
      observedOn: parsed.values["observed-on"],
      openedWithoutRepair: true,
      saved: true,
      closed: true,
      reopenedWithoutRepair: true,
      displayedAfterReopen: "2/3",
      editableAfterReopen: true
    },
    artifacts: {
      candidateFileName: "ordered-compatibility-source.pptx",
      editedDerivativeFileName: "omml-human-edit-2-over-3-reopened.pptx",
      ...inspection.artifacts
    },
    rawArtifacts: "ignored-local",
    limitations: [
      "one-exact-fixed-public-synthetic-mixed-candidate",
      "not-a-direct-single-slide-candidate-receipt",
      "not-ordered-final-delivery-authority",
      "not-real-pandoc-compatibility",
      "not-arbitrary-template-support",
      "not-support-promotion"
    ]
  };
  const disposition = await writeExactOrReuse(record);
  await assertDirectoryChain(directoryChain);
  return Object.freeze({
    status: record.status,
    gateId: record.gateId,
    gateScope: record.gateScope,
    authority: record.authority,
    deliveryEligible: record.deliveryEligible,
    disposition,
    evidenceFileName: path.basename(fixedPaths.evidence)
  });
}

if (process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await recordOmmlFormulaContentEditCli();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
