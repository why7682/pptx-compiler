import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createDeterministicZip } from
  "../packages/core/src/deterministic-zip.mjs";
import { parseSecureZip } from "../packages/core/src/secure-zip.mjs";
import {
  FormulaContentEditInspectionError,
  inspectFormulaContentEditTransition
} from "../packages/powerpoint-macos/src/formula-content-edit-evidence.mjs";
import {
  assertFixedFormulaEditArtifactIdentity,
  FIXED_FORMULA_EDIT_ARTIFACT_SHA256,
  recordOmmlFormulaContentEditCli
} from "../scripts/record-omml-formula-content-edit.mjs";
import {
  createPublicMixedOrderedCandidate,
  createPublicMixedOrderedDocuments,
  createPublicMixedOrderedRuntime
} from "./helpers/public-mixed-ordered-candidate.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function mutateArchive(bytes, mutate) {
  const parts = new Map([...parseSecureZip(bytes)]
    .map(([partPath, partBytes]) => [partPath, Buffer.from(partBytes)]));
  mutate(parts);
  return createDeterministicZip(parts);
}

function editNumerator(bytes) {
  return mutateArchive(bytes, (parts) => {
    const slidePart = "ppt/slides/slide2.xml";
    const source = parts.get(slidePart).toString("utf8");
    const marker = "<m:t>3</m:t>";
    const first = source.indexOf(marker);
    const second = source.indexOf(marker, first + marker.length);
    if (first < 0 || second < 0) throw new Error("FORMULA_EDIT_TEST_SOURCE_MISMATCH");
    parts.set(slidePart, Buffer.from(
      `${source.slice(0, first)}<m:t>2</m:t>${source.slice(first + marker.length)}`,
      "utf8"
    ));
  });
}

async function buildCandidate(documents) {
  const sourceDocuments = documents ?? await createPublicMixedOrderedDocuments();
  const runtime = await createPublicMixedOrderedRuntime(sourceDocuments);
  const accept = () => true;
  return createPublicMixedOrderedCandidate({
    documents: sourceDocuments,
    runtime,
    candidateFileName: "ordered-compatibility-source.pptx",
    resolverDependencies: {
      validateCapabilityRegistry: accept,
      validateDeckSpec: accept,
      validateProjectOverlay: accept,
      validateTemplateIndex: accept
    }
  });
}

const candidate = await buildCandidate();
const editedBytes = editNumerator(candidate.candidateBytes);

function inspect(overrides = {}) {
  return inspectFormulaContentEditTransition({
    candidateBytes: Buffer.from(candidate.candidateBytes),
    candidateRecordBytes: Buffer.from(candidate.candidateRecordBytes),
    editedBytes: Buffer.from(editedBytes),
    ...overrides
  });
}

function assertInspectionError(error, pointer) {
  assert.ok(error instanceof FormulaContentEditInspectionError);
  assert.equal(error.code, "FORMULA_CONTENT_EDIT_INSPECTION_INVALID");
  assert.equal(error.pointer, pointer);
  return true;
}

test("the public boundary reports machine facts and has no gate verdict", () => {
  const result = inspect();
  assert.equal(result.authority, "none");
  assert.equal(result.deliveryEligible, false);
  assert.equal(result.supportClaimsEnabled, false);
  for (const forbidden of [
    "status", "gateId", "gateScope", "evidenceLevel", "operation",
    "operatorAttestation", "evidenceRecordId"
  ]) {
    assert.equal(Object.hasOwn(result, forbidden), false);
  }
  assert.deepEqual(result.machineObservation.before.fraction, {
    numerator: "3",
    denominator: "3"
  });
  assert.deepEqual(result.machineObservation.after.fraction, {
    numerator: "2",
    denominator: "3"
  });
  assert.equal(
    result.machineObservation.after.observedTopology.closedGrammarValidated,
    false
  );
  assert.equal(Object.hasOwn(
    result.machineObservation.after.observedTopology,
    "nativeOmmlPreserved"
  ), false);
  assert.ok(result.limitations.includes("not-a-human-attestation"));
  assert.ok(result.limitations.includes("not-a-whole-package-safety-assessment"));
  assert.ok(Object.isFrozen(result.machineObservation.after));
});

test("the fixed recorder identity rejects self-consistent alternates and package tampering",
  async (t) => {
    assert.equal(
      sha256(candidate.candidateBytes),
      FIXED_FORMULA_EDIT_ARTIFACT_SHA256.candidate
    );
    assert.equal(
      sha256(candidate.candidateRecordBytes),
      FIXED_FORMULA_EDIT_ARTIFACT_SHA256.candidateRecord
    );

    await t.test("synthetic edited archive is not the observed PowerPoint derivative", () => {
      assert.notEqual(
        sha256(editedBytes),
        FIXED_FORMULA_EDIT_ARTIFACT_SHA256.editedDerivative
      );
      assert.throws(
        () => assertFixedFormulaEditArtifactIdentity({
          candidateBytes: candidate.candidateBytes,
          candidateRecordBytes: candidate.candidateRecordBytes,
          editedBytes
        }),
        /FORMULA_EDIT_FIXED_ARTIFACT_DRIFT/u
      );
    });

    await t.test("alternate candidate and record", async () => {
      const documents = await createPublicMixedOrderedDocuments();
      const deckSpec = structuredClone(documents.deckSpec);
      deckSpec.slides[0].payload.title = "A different self-consistent candidate";
      const alternate = await buildCandidate({ ...documents, deckSpec });
      const alternateEdited = editNumerator(alternate.candidateBytes);
      const observation = inspectFormulaContentEditTransition({
        candidateBytes: alternate.candidateBytes,
        candidateRecordBytes: alternate.candidateRecordBytes,
        editedBytes: alternateEdited
      });
      assert.equal(Object.hasOwn(observation, "status"), false);
      assert.throws(
        () => assertFixedFormulaEditArtifactIdentity({
          candidateBytes: alternate.candidateBytes,
          candidateRecordBytes: alternate.candidateRecordBytes,
          editedBytes: alternateEdited
        }),
        /FORMULA_EDIT_FIXED_ARTIFACT_DRIFT/u
      );
    });

    await t.test("unrelated slide mutation and unknown binary part", () => {
      const tampered = mutateArchive(editedBytes, (parts) => {
        const slide = parts.get("ppt/slides/slide1.xml").toString("utf8");
        parts.set("ppt/slides/slide1.xml", Buffer.from(slide.replace(
          "One decision, three inspectable signals",
          "Tampered unrelated slide content"
        )));
        parts.set("ppt/vbaProject.bin", Buffer.from("synthetic macro marker"));
      });
      const observation = inspect({ editedBytes: tampered });
      assert.equal(Object.hasOwn(observation, "status"), false);
      assert.equal(observation.artifacts.editedDerivativeSha256, sha256(tampered));
      assert.throws(
        () => assertFixedFormulaEditArtifactIdentity({
          candidateBytes: candidate.candidateBytes,
          candidateRecordBytes: candidate.candidateRecordBytes,
          editedBytes: tampered
        }),
        /FORMULA_EDIT_FIXED_ARTIFACT_DRIFT/u
      );
    });
  });

test("observed topology is not mislabeled as a closed OMML grammar", () => {
  const withUnknownMath = mutateArchive(editedBytes, (parts) => {
    const slidePart = "ppt/slides/slide2.xml";
    const source = parts.get(slidePart).toString("utf8");
    parts.set(slidePart, Buffer.from(source.replace(
      "<m:num><m:r>",
      "<m:num><m:bogus/><m:r>"
    )));
  });
  const result = inspect({ editedBytes: withUnknownMath });
  assert.equal(
    result.machineObservation.after.observedTopology.closedGrammarValidated,
    false
  );
  assert.equal(Object.hasOwn(
    result.machineObservation.after.observedTopology,
    "nativeOmmlPreserved"
  ), false);
});

test("candidate drift, slide loss, Proxy, and shared buffers fail closed", async (t) => {
  await t.test("candidate record drift", () => {
    const record = JSON.parse(candidate.candidateRecordBytes.toString("utf8"));
    record.deck.slides[1].slideId = "different-slide";
    assert.throws(
      () => inspect({ candidateRecordBytes: Buffer.from(`${JSON.stringify(record)}\n`) }),
      (error) => assertInspectionError(error, "/options/candidate")
    );
  });

  await t.test("slide loss", () => {
    const missingSlide = mutateArchive(editedBytes, (parts) => {
      parts.delete("ppt/slides/slide3.xml");
    });
    assert.throws(
      () => inspect({ editedBytes: missingSlide }),
      (error) => assertInspectionError(error, "/options/editedBytes/slideSet")
    );
  });

  await t.test("Proxy buffer", () => {
    assert.throws(
      () => inspect({ editedBytes: new Proxy(Buffer.from(editedBytes), {}) }),
      (error) => assertInspectionError(error, "/options/editedBytes")
    );
  });

  await t.test("shared backing", () => {
    const shared = new SharedArrayBuffer(editedBytes.length);
    new Uint8Array(shared).set(editedBytes);
    assert.throws(
      () => inspect({ editedBytes: Buffer.from(shared) }),
      (error) => assertInspectionError(error, "/options/editedBytes")
    );
  });
});

test("the local recorder is fixed-rooted, directory-bound, and operator-gated", async () => {
  const source = await readFile(
    new URL("../scripts/record-omml-formula-content-edit.mjs", import.meta.url),
    "utf8"
  );
  assert.match(source, /FIXED_FORMULA_EDIT_ARTIFACT_SHA256/u);
  assert.match(source, /operator-attested/u);
  assert.match(source, /no-repair-attested/u);
  assert.match(source, /captureDirectoryChain/u);
  assert.match(source, /assertDirectoryChain/u);
  assert.match(source, /O_NOFOLLOW/u);
  assert.match(source, /operatorAttestation/u);
  assert.doesNotMatch(source, /spawn\(|execFile\(|osascript|publishReceipt/u);

  await assert.rejects(
    recordOmmlFormulaContentEditCli([], {}),
    /FORMULA_EDIT_OPERATOR_ATTESTATION_REQUIRED/u
  );
  const confirmed = [
    "--trusted-local-run",
    "--operator-attested",
    "--no-repair-attested",
    "--application-version=16.111.3",
    "--operating-system-version=26.5.1",
    "--observed-on=2026-08-11"
  ];
  for (const key of [
    "CI", "GITHUB_ACTIONS", "GITHUB_EVENT_NAME", "BUILD_BUILDID", "BUILDKITE"
  ]) {
    await assert.rejects(
      recordOmmlFormulaContentEditCli(confirmed, { [key]: "1" }),
      /FORMULA_EDIT_CI_FORBIDDEN/u
    );
  }
});
