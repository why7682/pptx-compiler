import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CANDIDATE_BUILD_RECORD_MAX_BYTES,
  CandidateBuildRecordError,
  candidateBuildRecordFileName,
  createCandidateBuildRecord,
  createOrderedCandidateBuildRecord,
  verifyCandidateBuildRecord
} from "../packages/core/src/candidate-build-record.mjs";
import { SECURE_ZIP_LIMITS } from "../packages/core/src/secure-zip.mjs";
import { resolveSlideLayoutIr } from "../packages/core/src/slide-layout-ir.mjs";
import {
  createSchemaRegistry,
  validateJson
} from "../scripts/lib/json-schema.mjs";

const readJson = async (relativePath) => JSON.parse(await readFile(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8"
));

const fixture = await readJson("fixtures/contracts/valid/candidate-build-record.json");
const manifest = await readJson("schemas/contracts/manifest.json");
const schemas = await Promise.all(manifest.schemas.map(({ path }) => readJson(path)));
const registry = createSchemaRegistry(schemas);
const schema = registry.get("urn:pptx-compiler:schema:candidate-build-record:0.1.0");
const candidateBytes = Buffer.from("x");

function createFromFixture(bytes = candidateBytes) {
  return createCandidateBuildRecord({
    candidateBytes: bytes,
    candidateFileName: fixture.output.fileName,
    sourceArtifactType: fixture.sourceArtifactType,
    sourceVerificationProfile: fixture.sourceVerificationProfile,
    baseArtifactSha256: fixture.baseArtifactSha256,
    slideId: fixture.slide.slideId,
    slidePart: fixture.slide.slidePart,
    layoutIr: fixture.slide.layoutIr,
    composedSlidePlan: fixture.slide.composedSlidePlan,
    diff: fixture.slide.diff,
    capabilityEvidence: fixture.slide.capabilityEvidence
  });
}

function assertRecordError(error, code, pointer) {
  assert.ok(error instanceof CandidateBuildRecordError);
  assert.equal(error.code, code);
  assert.equal(error.pointer, pointer);
  return true;
}

function orderedDiff() {
  return {
    addedParts: [
      "ppt/slides/_rels/slide2.xml.rels",
      "ppt/slides/slide2.xml"
    ],
    removedParts: [],
    modifiedParts: [
      "[Content_Types].xml",
      "ppt/_rels/presentation.xml.rels",
      "ppt/presentation.xml",
      "ppt/slides/_rels/slide1.xml.rels"
    ],
    allowedChanges: [
      { partPath: "[Content_Types].xml", reason: "ordered-slide-content-types" },
      { partPath: "ppt/_rels/presentation.xml.rels", reason: "ordered-slide-relationships" },
      { partPath: "ppt/presentation.xml", reason: "ordered-slide-owner-list" },
      {
        partPath: "ppt/slides/_rels/slide1.xml.rels",
        reason: "normalized-slide-layout-relationship"
      },
      {
        partPath: "ppt/slides/_rels/slide2.xml.rels",
        reason: "normalized-slide-layout-relationship"
      },
      { partPath: "ppt/slides/slide2.xml", reason: "cloned-slide-content" }
    ],
    collateralChanges: []
  };
}

function orderedSlides(native = true) {
  return [
    {
      slideId: "plain-slide",
      order: 1,
      slidePart: "ppt/slides/slide1.xml",
      relationshipsPartPath: "ppt/slides/_rels/slide1.xml.rels",
      presentationSlideId: 256,
      relationshipId: "rId4",
      sourceArtifactSha256: "b".repeat(64),
      sourceBuild: {
        buildType: "clone-fill-source",
        artifactType: "assembled-pptx"
      }
    },
    {
      slideId: fixture.slide.slideId,
      order: 2,
      slidePart: "ppt/slides/slide2.xml",
      relationshipsPartPath: "ppt/slides/_rels/slide2.xml.rels",
      presentationSlideId: 257,
      relationshipId: "rId5",
      sourceArtifactSha256: "c".repeat(64),
      sourceBuild: native
        ? {
            buildType: "native-card-arrow-source",
            artifactType: fixture.sourceArtifactType,
            verificationProfile: fixture.sourceVerificationProfile,
            baseArtifactSha256: fixture.baseArtifactSha256,
            sourceSlidePart: fixture.slide.slidePart,
            layoutIr: fixture.slide.layoutIr,
            composedSlidePlan: fixture.slide.composedSlidePlan,
            diff: fixture.slide.diff,
            capabilityEvidence: fixture.slide.capabilityEvidence
          }
        : {
            buildType: "clone-fill-source",
            artifactType: "assembled-pptx"
          }
    }
  ];
}

function createOrdered(native = true) {
  return createOrderedCandidateBuildRecord({
    candidateBytes: Buffer.from("ordered"),
    candidateFileName: "ordered.pptx",
    baseArtifactSha256: "b".repeat(64),
    orderedDeck: {
      assemblyVersion: "0.1.0",
      slides: orderedSlides(native),
      diff: orderedDiff()
    }
  });
}

function orderedOmmlSlides() {
  const slides = orderedSlides(false);
  const layoutIr = structuredClone(fixture.slide.layoutIr);
  layoutIr.slots[0].allowedSourceRef = "native-omml-formula";
  layoutIr.placementRequests[0].sourceRef = "native-omml-formula";
  const formulaLayoutNode = layoutIr.nodes.find((node) =>
    node.sourceKind === "native-component");
  formulaLayoutNode.sourceRef = "native-omml-formula";
  const composedSlidePlan = resolveSlideLayoutIr(layoutIr);
  const formulaNode = composedSlidePlan.nodes.find((node) =>
    node.sourceKind === "native-component");
  slides[1].sourceBuild = {
    buildType: "native-omml-formula-source",
    artifactType: "native-omml-formula-assembled-pptx",
    verificationProfile: "target-specific-native-omml-formula-output",
    baseArtifactSha256: fixture.baseArtifactSha256,
    sourceSlidePart: fixture.slide.slidePart,
    layoutIr,
    composedSlidePlan,
    diff: {
      addedParts: [],
      removedParts: [],
      modifiedParts: [fixture.slide.slidePart],
      allowedChanges: [{
        partPath: fixture.slide.slidePart,
        reason: "native-omml-formula-replacement"
      }],
      collateralChanges: []
    },
    capabilityEvidence: {
      evidenceType: "native-omml-formula",
      formulaDigest: "d".repeat(64),
      formulaTarget: {
        targetShapeKey: "shape-2",
        sourceId: 3,
        geometry: structuredClone(formulaNode.box),
        structureProfile: "powerpoint-office-2010-text-math",
        fontSizeHundredthPoints: 4800,
        typeface: "Cambria Math",
        capacity: { maxElements: 64, maxRuns: 16, maxTextBytes: 256 },
        observed: { elements: 8, runs: 2, textBytes: 2 },
        status: "pass"
      }
    }
  };
  return slides;
}

function createOrderedOmml() {
  return createOrderedCandidateBuildRecord({
    candidateBytes: Buffer.from("ordered"),
    candidateFileName: "ordered.pptx",
    baseArtifactSha256: "b".repeat(64),
    orderedDeck: {
      assemblyVersion: "0.1.0",
      slides: orderedOmmlSlides(),
      diff: orderedDiff()
    }
  });
}

test("canonical candidate record output satisfies its public schema and re-verifies", () => {
  const created = createFromFixture();
  assert.deepEqual(validateJson(created.record, schema, { rootSchema: schema, registry }), []);
  const verified = verifyCandidateBuildRecord({
    candidateBytes,
    recordBytes: created.recordBytes,
    candidateFileName: "candidate.pptx"
  });
  assert.deepEqual(verified.record, created.record);
  assert.equal(created.recordBytes.at(-1), 0x0a);
  assert.equal(created.recordBytes.includes(Buffer.from("/Users/")), false);
});

test("candidate sidecar basename remains ASCII and within a 255-byte component", () => {
  const longestCandidate = `${"a".repeat(240)}.pptx`;
  assert.equal(longestCandidate.length, 245);
  assert.equal(candidateBuildRecordFileName(longestCandidate).length, 255);
  assert.throws(
    () => candidateBuildRecordFileName("K.pptx"),
    (error) => assertRecordError(
      error,
      "CANDIDATE_BUILD_RECORD_INVALID",
      "/candidateFileName"
    )
  );
  assert.throws(
    () => candidateBuildRecordFileName(`${"a".repeat(241)}.pptx`),
    (error) => assertRecordError(
      error,
      "CANDIDATE_BUILD_RECORD_INVALID",
      "/candidateFileName"
    )
  );
});

test("ordered records preserve deck order and every native slide replay", () => {
  const native = createOrdered(true);
  const generic = createOrdered(false);
  for (const created of [native, generic]) {
    assert.deepEqual(validateJson(created.record, schema, { rootSchema: schema, registry }), []);
    assert.deepEqual(verifyCandidateBuildRecord({
      candidateBytes: Buffer.from("ordered"),
      recordBytes: created.recordBytes,
      candidateFileName: "ordered.pptx"
    }).record, created.record);
  }
  assert.equal(Object.hasOwn(native.record, "sourceVerificationProfile"), false);
  assert.equal(Object.hasOwn(native.record.deck, "containsTargetSpecificNative"), false);
  assert.equal(Object.hasOwn(native.record.deck, "nativeSlideCount"), false);
  assert.equal(Object.hasOwn(generic.record.deck, "nativeSlideCount"), false);

  const sourceBuildDrift = structuredClone(native.record);
  sourceBuildDrift.deck.slides[1].sourceBuild.buildType = "clone-fill-source";
  assert.notDeepEqual(
    validateJson(sourceBuildDrift, schema, { rootSchema: schema, registry }),
    []
  );
  assert.throws(
    () => verifyCandidateBuildRecord({
      candidateBytes: Buffer.from("ordered"),
      recordBytes: Buffer.from(`${JSON.stringify(sourceBuildDrift, null, 2)}\n`),
      candidateFileName: "ordered.pptx"
    }),
    (error) => assertRecordError(
      error,
      "CANDIDATE_BUILD_RECORD_INVALID",
      "/deck/slides/1/sourceBuild"
    )
  );

  const orderDrift = structuredClone(native.record);
  orderDrift.deck.slides[1].order = 1;
  assert.throws(
    () => verifyCandidateBuildRecord({
      candidateBytes: Buffer.from("ordered"),
      recordBytes: Buffer.from(`${JSON.stringify(orderDrift, null, 2)}\n`),
      candidateFileName: "ordered.pptx"
    }),
    (error) => assertRecordError(
      error,
      "CANDIDATE_BUILD_RECORD_INVALID",
      "/deck/slides/1/order"
    )
  );

  const planDrift = structuredClone(native.record);
  planDrift.deck.slides[1].sourceBuild.composedSlidePlan.nodes.at(-1).box.x += 1;
  assert.throws(
    () => verifyCandidateBuildRecord({
      candidateBytes: Buffer.from("ordered"),
      recordBytes: Buffer.from(`${JSON.stringify(planDrift, null, 2)}\n`),
      candidateFileName: "ordered.pptx"
    }),
    (error) => assertRecordError(
      error,
      "CANDIDATE_BUILD_RECORD_REPLAY_MISMATCH",
      "/deck/slides/1/sourceBuild/composedSlidePlan"
    )
  );
});

test("ordered records preserve typed OMML layout and formula evidence", () => {
  const created = createOrderedOmml();
  assert.deepEqual(validateJson(created.record, schema, { rootSchema: schema, registry }), []);
  const verified = verifyCandidateBuildRecord({
    candidateBytes: Buffer.from("ordered"),
    recordBytes: created.recordBytes,
    candidateFileName: "ordered.pptx"
  });
  const source = verified.record.deck.slides[1].sourceBuild;
  assert.equal(source.buildType, "native-omml-formula-source");
  assert.equal(source.capabilityEvidence.evidenceType, "native-omml-formula");
  assert.deepEqual(resolveSlideLayoutIr(source.layoutIr), source.composedSlidePlan);

  const evidenceDrift = structuredClone(created.record);
  evidenceDrift.deck.slides[1].sourceBuild.capabilityEvidence.formulaTarget.geometry.x += 1;
  assert.throws(
    () => verifyCandidateBuildRecord({
      candidateBytes: Buffer.from("ordered"),
      recordBytes: Buffer.from(`${JSON.stringify(evidenceDrift, null, 2)}\n`),
      candidateFileName: "ordered.pptx"
    }),
    (error) => assertRecordError(
      error,
      "CANDIDATE_BUILD_RECORD_REPLAY_MISMATCH",
      "/deck/slides/1/sourceBuild/capabilityEvidence/formulaTarget/geometry"
    )
  );
});

test("candidate and record byte ceilings reject before Buffer.from copies the oversized input", () => {
  const valid = createFromFixture();
  const oversizedCandidate = Buffer.alloc(SECURE_ZIP_LIMITS.maxArchiveBytes + 1);
  const oversizedRecord = Buffer.alloc(CANDIDATE_BUILD_RECORD_MAX_BYTES + 1);
  const originalFrom = Buffer.from;
  const copied = new Set();
  Buffer.from = function intercepted(value, ...args) {
    if (value === oversizedCandidate) copied.add("candidate");
    if (value === oversizedRecord) copied.add("record");
    return originalFrom.call(Buffer, value, ...args);
  };
  try {
    assert.throws(
      () => verifyCandidateBuildRecord({
        candidateBytes: oversizedCandidate,
        recordBytes: valid.recordBytes,
        candidateFileName: "candidate.pptx"
      }),
      (error) => assertRecordError(
        error,
        "CANDIDATE_BUILD_RECORD_ARGUMENT_INVALID",
        "/options/candidateBytes"
      )
    );
    assert.throws(
      () => verifyCandidateBuildRecord({
        candidateBytes,
        recordBytes: oversizedRecord,
        candidateFileName: "candidate.pptx"
      }),
      (error) => assertRecordError(
        error,
        "CANDIDATE_BUILD_RECORD_ARGUMENT_INVALID",
        "/options/recordBytes"
      )
    );
    assert.throws(
      () => createFromFixture(oversizedCandidate),
      (error) => assertRecordError(
        error,
        "CANDIDATE_BUILD_RECORD_ARGUMENT_INVALID",
        "/options/candidateBytes"
      )
    );
  } finally {
    Buffer.from = originalFrom;
  }
  assert.deepEqual([...copied], []);
});
