import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createCandidateBuildRecord,
  createOrderedCandidateBuildRecord,
  verifyCandidateBuildRecord
} from "../packages/core/src/candidate-build-record.mjs";
import {
  createCapabilityRuntime,
  prepareCapabilityDispatch
} from "../packages/core/src/capability-dispatcher.mjs";
import { assembleCloneFillPresentation } from
  "../packages/core/src/create-only-assembly.mjs";
import { createDeterministicZip } from
  "../packages/core/src/deterministic-zip.mjs";
import {
  assembleNativeCardArrowFromSlot
} from "../packages/core/src/native-card-arrow-assembly.mjs";
import {
  createNativeCardArrowSlotPlacement,
  NATIVE_CARD_ARROW_PLACEMENT_VERSION
} from "../packages/core/src/native-card-arrow-placement.mjs";
import { createProjectContext } from "../packages/core/src/project-context.mjs";
import {
  RECEIPT_BOUND_FINAL_DELIVERY_VERSION,
  ReceiptBoundFinalDeliveryError,
  prepareReceiptBoundFinalDelivery,
  publishReceiptBoundFinalDelivery
} from "../packages/core/src/receipt-bound-final-delivery.mjs";
import { parseSecureZip } from "../packages/core/src/secure-zip.mjs";
import { resolveSlideLayoutIr } from "../packages/core/src/slide-layout-ir.mjs";
import { executeSourceSlideCloneFill } from
  "../plugins/clone-fill/src/source-slide-clone-fill.mjs";
import {
  executeNativeCardArrow,
  nativeCardArrowQaAssertions,
  preflightNativeCardArrow
} from "../plugins/native-card-arrow/src/native-card-arrow.mjs";
import { buildSyntheticFixtures } from "../scripts/generate-synthetic-fixtures.mjs";
import {
  assertSupportedSchema,
  createSchemaRegistry,
  validateJson
} from "../scripts/lib/json-schema.mjs";

const readJson = async (relativePath) => JSON.parse(await readFile(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8"
));

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const manifest = await readJson("schemas/contracts/manifest.json");
const schemas = await Promise.all(manifest.schemas.map(({ path: schemaPath }) =>
  readJson(schemaPath)));
const schemaRegistry = createSchemaRegistry(schemas);
for (const schema of schemas) assertSupportedSchema(schema, { registry: schemaRegistry });

function schemaValidator(name) {
  const schema = schemaRegistry.get(`urn:pptx-compiler:schema:${name}:0.1.0`);
  return (value) => validateJson(value, schema, {
    rootSchema: schema,
    registry: schemaRegistry
  }).length === 0;
}

const validateProjectConfig = schemaValidator("project-config");
const registryDocument = await readJson("fixtures/capabilities/native-card-arrow/registry.json");
const cases = await readJson("fixtures/capabilities/native-card-arrow/cases.json");
const nativeDeck = await readJson("fixtures/capabilities/native-card-arrow/deck-spec.json");
const projectOverlay = await readJson("fixtures/capabilities/native-card-arrow/project-overlay.json");
const inputSchema = await readJson("plugins/native-card-arrow/schemas/input.schema.json");
const outputSchema = await readJson("plugins/native-card-arrow/schemas/output.schema.json");
const templateIndex = deepFreeze(await readJson(
  "fixtures/inspection/expected-potx-template-index.json"
));
const fixtureBuild = await buildSyntheticFixtures();
const sourceArchive = fixtureBuild.archives.find((archive) => archive.variant === "potx");
const capability = registryDocument.capabilities[0];

function makeRegistration() {
  return {
    capabilityId: capability.capabilityId,
    capabilityVersion: capability.capabilityVersion,
    executor: {
      executorId: capability.executorId,
      preflight: preflightNativeCardArrow,
      execute: executeNativeCardArrow
    },
    inputSchema: {
      schemaId: capability.inputSchemaId,
      schema: clone(inputSchema),
      validate(value) {
        return validateJson(value, inputSchema).length === 0;
      }
    },
    outputSchema: {
      schemaId: capability.outputSchemaId,
      schema: clone(outputSchema),
      validate(value) {
        return validateJson(value, outputSchema).length === 0;
      }
    },
    conformanceFixtures: clone(cases.fixtures),
    qaContract: {
      qaContractId: capability.qaContractId,
      assertions: [...nativeCardArrowQaAssertions]
    }
  };
}

const runtime = await createCapabilityRuntime({
  capabilityRegistry: clone(registryDocument),
  registrations: [makeRegistration()],
  dependencies: {
    validateCapabilityRegistry() { return true; },
    validateSchemaDocument(value) {
      try {
        assertSupportedSchema(value);
        return true;
      } catch {
        return false;
      }
    },
    resolveCapabilitySupport() {
      return {
        supportMatrixItemId: "native-drawingml",
        supportClaimsEnabled: false,
        status: "experimental",
        disposition: "accept-with-warning"
      };
    }
  }
});

function cloneFillPlan() {
  return deepFreeze(executeSourceSlideCloneFill({
    invocationId: "clone-fill-base-slide",
    payload: {
      body: ["Repository-owned text-only OOXML"],
      title: "Synthetic Fixture"
    },
    bindings: [
      {
        role: "body",
        shapeBindingId: "body-binding",
        containerKind: "slide",
        containerKey: "slide-1",
        shapeKey: "shape-2",
        expectedKind: "text-box",
        cardinality: "exactly-one"
      },
      {
        role: "title",
        shapeBindingId: "title-binding",
        containerKind: "slide",
        containerKey: "slide-1",
        shapeKey: "shape-1",
        expectedKind: "text-box",
        cardinality: "exactly-one"
      }
    ]
  }));
}

const baseArtifact = assembleCloneFillPresentation({
  sourceArchiveBytes: sourceArchive.bytes,
  templateIndex,
  plan: cloneFillPlan()
});

function placementRequest() {
  return {
    placementVersion: NATIVE_CARD_ARROW_PLACEMENT_VERSION,
    outputSlideId: "native-card-arrow-output-one",
    slotRef: "slide-content-tail",
    placementIntent: "slot-aligned-fixed",
    preferredSize: {
      cx: nativeDeck.slides[0].payload.geometry.cx,
      cy: nativeDeck.slides[0].payload.geometry.cy
    }
  };
}

function invocation(geometry) {
  return {
    invocationId: "native-card-arrow-output-one",
    capabilitySelectionId: "native-card-arrow-selection",
    capabilityId: "native-card-arrow",
    capabilityVersion: "0.1.0",
    experimentalOptIn: true,
    payload: {
      geometry: clone(geometry),
      label: nativeDeck.slides[0].payload.label,
      style: clone(nativeDeck.slides[0].payload.style)
    },
    bindings: [{
      role: "anchor",
      shapeBindingId: "card-arrow-anchor-binding",
      containerKind: "slide",
      containerKey: "slide-1",
      shapeKey: "shape-2",
      expectedKind: "text-box",
      cardinality: "exactly-one"
    }]
  };
}

const request = placementRequest();
const placement = createNativeCardArrowSlotPlacement({ baseArtifact, request });
const nativeArtifact = await assembleNativeCardArrowFromSlot({
  baseArtifact,
  placementRequest: request,
  dispatchPlan: prepareCapabilityDispatch({
    runtime,
    invocations: [invocation(placement.resolvedGeometry)]
  })
});
const candidate = createCandidateBuildRecord({
  candidateBytes: nativeArtifact.archiveBytes,
  candidateFileName: "native-candidate.pptx",
  sourceArtifactType: nativeArtifact.report.artifactType,
  sourceVerificationProfile: nativeArtifact.report.verificationProfile,
  baseArtifactSha256: nativeArtifact.report.baseOutputSha256,
  slideId: nativeArtifact.report.outputSlideId,
  slidePart: nativeArtifact.report.slidePart,
  layoutIr: nativeArtifact.report.layoutIr,
  composedSlidePlan: nativeArtifact.report.composedSlidePlan,
  diff: nativeArtifact.report.diff,
  capabilityEvidence: {
    evidenceType: "native-card-arrow",
    allocatedShapeIds: nativeArtifact.report.allocatedShapeIds
  }
});

function rewrapAsNativeCandidate(candidateBytes, {
  layoutIr = nativeArtifact.report.layoutIr,
  composedSlidePlan = nativeArtifact.report.composedSlidePlan
} = {}) {
  return createCandidateBuildRecord({
    candidateBytes,
    candidateFileName: "native-candidate.pptx",
    sourceArtifactType: nativeArtifact.report.artifactType,
    sourceVerificationProfile: nativeArtifact.report.verificationProfile,
    baseArtifactSha256: nativeArtifact.report.baseOutputSha256,
    slideId: nativeArtifact.report.outputSlideId,
    slidePart: nativeArtifact.report.slidePart,
    layoutIr,
    composedSlidePlan,
    diff: nativeArtifact.report.diff,
    capabilityEvidence: {
      evidenceType: "native-card-arrow",
      allocatedShapeIds: nativeArtifact.report.allocatedShapeIds
    }
  });
}

function templateProfile() {
  return {
    schemaVersion: "0.1.0",
    contractType: "template-profile",
    templateProfileId: templateIndex.templateProfileId,
    templateIndexId: templateIndex.templateIndexId,
    templateFormat: "potx",
    templateSha256: templateIndex.templateSha256,
    slideSizeEmu: clone(templateIndex.slideSizeEmu),
    layoutBindings: [{ layoutKey: "layout-1", semanticRole: "content" }]
  };
}

function projectConfig() {
  return {
    schemaVersion: "0.1.0",
    contractType: "project-config",
    projectId: "native-card-arrow-project",
    template: {
      sourcePath: "workspace/template.potx",
      profileId: templateIndex.templateProfileId,
      profilePath: "workspace/template-profile.json",
      indexId: templateIndex.templateIndexId,
      indexPath: "workspace/template-index.json"
    },
    capabilityRegistry: {
      registryId: registryDocument.capabilityRegistryId,
      registryVersion: registryDocument.registryVersion,
      path: "workspace/capability-registry.json"
    },
    projectOverlay: {
      overlayId: projectOverlay.projectOverlayId,
      path: "workspace/project-overlay.json"
    },
    paths: {
      assetRoot: "workspace/assets",
      stagingRoot: "workspace/staging",
      outputRoot: "workspace/output"
    },
    policies: {
      experimentalCapabilities: "require-explicit-opt-in",
      unknownFeatures: "reject",
      ambiguousBindings: "reject",
      sourceMutation: "reject"
    }
  };
}

const evidenceTokens = Object.freeze({
  mechanical: Object.freeze({ token: "mechanical" }),
  render: Object.freeze({ token: "render" }),
  pixelReview: Object.freeze({ token: "pixel-review" }),
  compatibility: Object.freeze({ token: "compatibility" })
});

function evidenceResult(kind, expected) {
  const common = {
    receiptVersion: "0.1.0",
    candidateSha256: expected.candidateSha256,
    candidateRecordSha256: expected.candidateRecordSha256
  };
  if (kind === "mechanical") {
    return {
      ...common,
      receiptType: "mechanical",
      slideId: expected.slideId,
      status: "pass"
    };
  }
  if (kind === "render") {
    return {
      ...common,
      receiptType: "render",
      renderSetId: "native-candidate-render",
      slideIds: [expected.slideId],
      status: "pass"
    };
  }
  if (kind === "pixelReview") {
    return {
      ...common,
      receiptType: "pixel-review",
      renderSetId: expected.renderSetId,
      reviewerMode: "independent-pixel-only",
      status: "pass",
      verdict: "pass",
      blockerCount: 0,
      majorCount: 0
    };
  }
  return {
    ...common,
    receiptType: "compatibility",
    supportMatrixItemId: "macos-powerpoint-automation",
    evidenceRecordId: "urn:pptx-compiler:compatibility:native-card-arrow-local-001",
    status: "passed"
  };
}

function deliveryDependencies(overrides = {}) {
  const authenticate = (kind) => (receipt, expected) => {
    if (receipt !== evidenceTokens[kind]) throw new Error("unauthenticated-receipt");
    const result = evidenceResult(kind, expected);
    return overrides[kind] ? overrides[kind](result, expected) : result;
  };
  return {
    authenticateCompatibilityReceipt: authenticate("compatibility"),
    authenticateMechanicalReceipt: authenticate("mechanical"),
    authenticatePixelReviewReceipt: authenticate("pixelReview"),
    authenticateRenderReceipt: authenticate("render"),
    validateBuildArtifact: schemaValidator("build-artifact"),
    validateCapabilityRegistry: schemaValidator("capability-registry"),
    validateDeckSpec: schemaValidator("deck-spec"),
    validateProjectOverlay: schemaValidator("project-overlay"),
    validateQaReport: schemaValidator("qa-report"),
    validateTemplateIndex: schemaValidator("template-index"),
    validateTemplateProfile: schemaValidator("template-profile")
  };
}

function deliveryDeck() {
  const deck = clone(nativeDeck);
  deck.slides = [deck.slides[0]];
  deck.slides[0].payload.geometry = clone(placement.resolvedGeometry);
  return deck;
}

async function createCase({ dependencyOverrides, bundleMutator, candidateOverride } = {}) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "final-delivery-")));
  await mkdir(path.join(root, "workspace", "output"), { recursive: true });
  const config = projectConfig();
  const context = createProjectContext({
    projectRoot: root,
    projectConfig: config,
    dependencies: { validateProjectConfig }
  });
  const projectBundle = {
    projectContext: context,
    templateProfile: templateProfile(),
    templateIndex: clone(templateIndex),
    capabilityRegistry: clone(registryDocument),
    projectOverlay: clone(projectOverlay),
    deckSpec: deliveryDeck(),
    sourceTemplateBytes: Buffer.from(sourceArchive.bytes)
  };
  if (bundleMutator) bundleMutator(projectBundle);
  const candidateInput = candidateOverride ?? {
    candidateBytes: Buffer.from(candidate.candidateBytes),
    candidateRecordBytes: Buffer.from(candidate.recordBytes),
    candidateFileName: "native-candidate.pptx"
  };
  const options = {
    candidate: candidateInput,
    projectBundle,
    evidence: {
      mechanicalReceipt: evidenceTokens.mechanical,
      renderReceipt: evidenceTokens.render,
      pixelReviewReceipt: evidenceTokens.pixelReview,
      compatibilityReceipt: evidenceTokens.compatibility
    },
    output: {
      buildId: "native-build",
      qaReportId: "native-qa",
      publishPath: "workspace/output/native-build/native-candidate.pptx"
    },
    dependencies: deliveryDependencies(dependencyOverrides)
  };
  return { root, options };
}

function assertDeliveryError(error, code, pointer) {
  assert.ok(error instanceof ReceiptBoundFinalDeliveryError);
  assert.equal(error.code, code);
  assert.equal(error.pointer, pointer);
  return true;
}

function sourceToFinalChangedParts() {
  const sourceParts = parseSecureZip(sourceArchive.bytes);
  const finalParts = parseSecureZip(candidate.candidateBytes);
  return [...sourceParts.keys()]
    .filter((partName) => !sourceParts.get(partName).equals(finalParts.get(partName)))
    .sort();
}

test("receipt-bound delivery publishes the exact reviewed candidate with BuildArtifact last", async () => {
  const { root, options } = await createCase();
  try {
    const plan = prepareReceiptBoundFinalDelivery(options);
    assert.deepEqual(plan, {
      deliveryVersion: RECEIPT_BOUND_FINAL_DELIVERY_VERSION,
      planType: "receipt-bound-final-delivery-plan"
    });
    const result = await publishReceiptBoundFinalDelivery({ plan });
    assert.deepEqual(result, {
      deliveryVersion: "0.1.0",
      artifactType: "published-pptx",
      verificationProfile: "receipt-bound-native-card-arrow-delivery",
      publishPath: "workspace/output/native-build/native-candidate.pptx",
      sha256: digest(candidate.candidateBytes),
      byteLength: candidate.candidateBytes.length,
      qaReportId: "native-qa",
      buildId: "native-build",
      files: [
        "native-candidate.candidate.json",
        "native-candidate.qa.json",
        "native-candidate.pptx",
        "native-candidate.build.json"
      ]
    });
    const directory = path.join(root, "workspace", "output", "native-build");
    assert.deepEqual(await readdir(directory), result.files.toSorted());
    const [recordBytes, candidateBytes, qaReport, buildArtifact] = await Promise.all([
      readFile(path.join(directory, "native-candidate.candidate.json")),
      readFile(path.join(directory, "native-candidate.pptx")),
      readJsonFile(path.join(directory, "native-candidate.qa.json")),
      readJsonFile(path.join(directory, "native-candidate.build.json"))
    ]);
    assert.ok(recordBytes.equals(candidate.recordBytes));
    assert.ok(candidateBytes.equals(candidate.candidateBytes));
    assert.equal(qaReport.decision, "pass");
    assert.deepEqual(qaReport.checks.map(({ checkId }) => checkId), [
      "candidate-record-replay",
      "mechanical-constraints",
      "package-source-diff",
      "pixel-review",
      "powerpoint-compatibility",
      "render-complete"
    ]);
    assert.deepEqual(qaReport.manualGates, [{
      manualGateId: "powerpoint-compatibility-gate",
      supportMatrixItemId: "macos-powerpoint-automation",
      scopeKind: "build",
      scopeId: "native-build",
      status: "passed",
      evidenceRecordId: "urn:pptx-compiler:compatibility:native-card-arrow-local-001"
    }]);
    assert.deepEqual(buildArtifact.changedParts, sourceToFinalChangedParts());
    assert.equal(buildArtifact.output.sha256, digest(candidateBytes));
    assert.equal(buildArtifact.qaReportId, qaReport.qaReportId);
    assert.deepEqual(buildArtifact.slides, [{
      slideId: "native-card-arrow-output-one",
      capabilityId: "native-card-arrow",
      capabilityVersion: "0.1.0"
    }]);
    assert.deepEqual(verifyCandidateBuildRecord({
      candidateBytes,
      recordBytes,
      candidateFileName: "native-candidate.pptx"
    }).record, candidate.record);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("candidate, semantic-contract, and evidence drift all fail before publication", async (t) => {
  await t.test("candidate bytes", async () => {
    const changed = Buffer.from(candidate.candidateBytes);
    changed[changed.length - 1] ^= 1;
    const { root, options } = await createCase({
      candidateOverride: {
        candidateBytes: changed,
        candidateRecordBytes: Buffer.from(candidate.recordBytes),
        candidateFileName: "native-candidate.pptx"
      }
    });
    try {
      assert.throws(
        () => prepareReceiptBoundFinalDelivery(options),
        (error) => assertDeliveryError(error, "FINAL_DELIVERY_CANDIDATE_INVALID", "/options/candidate")
      );
      assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("template identity", async () => {
    const { root, options } = await createCase({
      bundleMutator(bundle) {
        bundle.templateProfile.templateSha256 = "a".repeat(64);
      }
    });
    try {
      assert.throws(
        () => prepareReceiptBoundFinalDelivery(options),
        (error) => error instanceof ReceiptBoundFinalDeliveryError &&
          ["FINAL_DELIVERY_SOURCE_MISMATCH", "FINAL_DELIVERY_CONTRACT_INVALID"].includes(error.code)
      );
      assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("render candidate binding", async () => {
    const { root, options } = await createCase({
      dependencyOverrides: {
        render(result) {
          return { ...result, candidateSha256: "b".repeat(64) };
        }
      }
    });
    try {
      assert.throws(
        () => prepareReceiptBoundFinalDelivery(options),
        (error) => assertDeliveryError(error, "FINAL_DELIVERY_EVIDENCE_INVALID", "/evidence/render")
      );
      assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("DeckSpec content, overlay binding, and actual native OOXML are one projection", async (t) => {
  await t.test("DeckSpec label cannot drift from the candidate", async () => {
    const { root, options } = await createCase({
      bundleMutator(bundle) {
        bundle.deckSpec.slides[0].payload.label = "A different valid decision";
      }
    });
    try {
      assert.throws(
        () => prepareReceiptBoundFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_CANDIDATE_INVALID",
          "/options/candidate/projection"
        )
      );
      assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("overlay anchor cannot be rebound to another valid text box", async () => {
    const { root, options } = await createCase({
      bundleMutator(bundle) {
        bundle.projectOverlay.shapeBindings[0].shapeKey = "shape-1";
      }
    });
    try {
      assert.throws(
        () => prepareReceiptBoundFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_CANDIDATE_INVALID",
          "/options/candidate/projection"
        )
      );
      assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("template index geometry cannot drift from parsed source facts", async () => {
    const { root, options } = await createCase({
      bundleMutator(bundle) {
        bundle.templateIndex.slides[0].shapes[1].geometry.x += 1;
      }
    });
    try {
      assert.throws(
        () => prepareReceiptBoundFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_SOURCE_MISMATCH",
          "/templateIndex"
        )
      );
      assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("a replay-valid record cannot rewrite source constraints", async () => {
    const falseLayoutIr = clone(nativeArtifact.report.layoutIr);
    falseLayoutIr.nodes[0].requestedBox.x += 1;
    const falsePlan = resolveSlideLayoutIr(falseLayoutIr);
    const expectedNative = nativeArtifact.report.composedSlidePlan.nodes.find((node) =>
      node.sourceKind === "native-component");
    const falseNative = falsePlan.nodes.find((node) => node.sourceKind === "native-component");
    assert.deepEqual(falseNative.box, expectedNative.box);
    const falseRecord = rewrapAsNativeCandidate(candidate.candidateBytes, {
      layoutIr: falseLayoutIr,
      composedSlidePlan: falsePlan
    });
    const { root, options } = await createCase({
      candidateOverride: {
        candidateBytes: Buffer.from(falseRecord.candidateBytes),
        candidateRecordBytes: Buffer.from(falseRecord.recordBytes),
        candidateFileName: "native-candidate.pptx"
      }
    });
    try {
      assert.throws(
        () => prepareReceiptBoundFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_CANDIDATE_INVALID",
          "/candidateRecord/slide/layoutIr"
        )
      );
      assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("a replay-valid record cannot relabel a PPTX with no native group", async () => {
    const masquerade = rewrapAsNativeCandidate(baseArtifact.archiveBytes);
    const { root, options } = await createCase({
      candidateOverride: {
        candidateBytes: Buffer.from(masquerade.candidateBytes),
        candidateRecordBytes: Buffer.from(masquerade.recordBytes),
        candidateFileName: "native-candidate.pptx"
      }
    });
    try {
      assert.throws(
        () => prepareReceiptBoundFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_CANDIDATE_INVALID",
          "/options/candidate/projection"
        )
      );
      assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("a replay-valid record cannot hide a collateral package mutation", async () => {
  const parts = parseSecureZip(candidate.candidateBytes);
  const themePart = "ppt/theme/theme1.xml";
  const changedTheme = Buffer.from(parts.get(themePart).toString("utf8").replace(
    "Synthetic Neutral",
    "Synthetic Altered"
  ));
  assert.notDeepEqual(changedTheme, parts.get(themePart));
  parts.set(themePart, changedTheme);
  const changedCandidateBytes = createDeterministicZip(parts);
  const changedCandidate = rewrapAsNativeCandidate(changedCandidateBytes);
  const { root, options } = await createCase({
    candidateOverride: {
      candidateBytes: Buffer.from(changedCandidate.candidateBytes),
      candidateRecordBytes: Buffer.from(changedCandidate.recordBytes),
      candidateFileName: "native-candidate.pptx"
    }
  });
  try {
    assert.throws(
      () => prepareReceiptBoundFinalDelivery(options),
      (error) => assertDeliveryError(
        error,
        "FINAL_DELIVERY_CANDIDATE_INVALID",
        "/options/candidate/projection"
      )
    );
    assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("project JSON resource budgets reject during traversal", async (t) => {
  await t.test("per-object key budget", async () => {
    const { root, options } = await createCase({
      bundleMutator(bundle) {
        bundle.deckSpec.slides[0].payload = Object.fromEntries(
          Array.from({ length: 4_097 }, (_, index) => [`field${index}`, index])
        );
      }
    });
    try {
      assert.throws(
        () => prepareReceiptBoundFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_CONTRACT_INVALID",
          "/options/projectBundle/deckSpec/slides/0/payload"
        )
      );
      assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("escaped JSON byte budget", async () => {
    const { root, options } = await createCase({
      bundleMutator(bundle) {
        bundle.deckSpec.slides[0].payload.label = "\u0000".repeat(350_000);
      }
    });
    try {
      assert.throws(
        () => prepareReceiptBoundFinalDelivery(options),
        (error) => error instanceof ReceiptBoundFinalDeliveryError &&
          error.code === "FINAL_DELIVERY_CONTRACT_INVALID" &&
          error.pointer.startsWith("/options/projectBundle/deckSpec/slides/0/payload/label")
      );
      assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("unassessable pixels and missing compatibility cannot mint BuildArtifact", async (t) => {
  for (const [name, dependencyOverrides, pointer] of [
    ["pixel verdict", {
      pixelReview(result) {
        return { ...result, status: "revise", verdict: "revise", majorCount: 1 };
      }
    }, "/evidence/pixelReview"],
    ["compatibility gate", {
      compatibility(result) {
        return { ...result, status: "unavailable" };
      }
    }, "/evidence/compatibility"]
  ]) {
    await t.test(name, async () => {
      const { root, options } = await createCase({ dependencyOverrides });
      try {
        assert.throws(
          () => prepareReceiptBoundFinalDelivery(options),
          (error) => assertDeliveryError(error, "FINAL_DELIVERY_EVIDENCE_INVALID", pointer)
        );
        assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }
});

function orderedRecord() {
  const orderedDiff = {
    addedParts: ["ppt/slides/_rels/slide2.xml.rels", "ppt/slides/slide2.xml"],
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
  return createOrderedCandidateBuildRecord({
    candidateBytes: candidate.candidateBytes,
    candidateFileName: "native-candidate.pptx",
    baseArtifactSha256: "b".repeat(64),
    orderedDeck: {
      assemblyVersion: "0.1.0",
      slides: [
        {
          slideId: "plain-slide",
          order: 1,
          slidePart: "ppt/slides/slide1.xml",
          relationshipsPartPath: "ppt/slides/_rels/slide1.xml.rels",
          presentationSlideId: 256,
          relationshipId: "rId4",
          sourceArtifactSha256: "b".repeat(64),
          sourceBuild: { buildType: "clone-fill-source", artifactType: "assembled-pptx" }
        },
        {
          slideId: "plain-slide-two",
          order: 2,
          slidePart: "ppt/slides/slide2.xml",
          relationshipsPartPath: "ppt/slides/_rels/slide2.xml.rels",
          presentationSlideId: 257,
          relationshipId: "rId5",
          sourceArtifactSha256: "c".repeat(64),
          sourceBuild: { buildType: "clone-fill-source", artifactType: "assembled-pptx" }
        }
      ],
      diff: orderedDiff
    }
  });
}

test("the minimal final boundary rejects ordered candidates before filesystem I/O", async () => {
  const ordered = orderedRecord();
  const { root, options } = await createCase({
    candidateOverride: {
      candidateBytes: Buffer.from(ordered.candidateBytes),
      candidateRecordBytes: Buffer.from(ordered.recordBytes),
      candidateFileName: "native-candidate.pptx"
    }
  });
  try {
    assert.throws(
      () => prepareReceiptBoundFinalDelivery(options),
      (error) => assertDeliveryError(error, "FINAL_DELIVERY_CANDIDATE_INVALID", "/candidateRecord")
    );
    assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("publication is create-only and prepared plans are one-shot", async () => {
  const { root, options } = await createCase();
  try {
    const plan = prepareReceiptBoundFinalDelivery(options);
    const deliveryDirectory = path.join(root, "workspace", "output", "native-build");
    await mkdir(deliveryDirectory);
    await writeFile(path.join(deliveryDirectory, "owner.txt"), "existing", "utf8");
    await assert.rejects(
      publishReceiptBoundFinalDelivery({ plan }),
      (error) => assertDeliveryError(error, "FINAL_DELIVERY_OUTPUT_EXISTS", "/deliveryDirectory")
    );
    assert.deepEqual(await readdir(deliveryDirectory), ["owner.txt"]);
    assert.equal((await lstat(path.join(deliveryDirectory, "owner.txt"))).isFile(), true);
    await assert.rejects(
      publishReceiptBoundFinalDelivery({ plan }),
      (error) => assertDeliveryError(error, "FINAL_DELIVERY_ARGUMENT_INVALID", "/options/plan")
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cancellation after publication starts removes the reserved delivery directory", async () => {
  const { root, options } = await createCase();
  try {
    const plan = prepareReceiptBoundFinalDelivery(options);
    const controller = new AbortController();
    const publication = publishReceiptBoundFinalDelivery({
      plan,
      signal: controller.signal
    });
    controller.abort();
    await assert.rejects(publication, (error) => {
      assertDeliveryError(error, "FINAL_DELIVERY_ABORTED", "/options/signal");
      assert.equal(error.rollbackStatus, "complete");
      assert.equal(error.commitState, "not-committed");
      return true;
    });
    assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a failure immediately after the BuildArtifact link is commit-uncertain", async () => {
  const { root, options } = await createCase();
  try {
    const plan = prepareReceiptBoundFinalDelivery(options);
    const controller = new AbortController();
    let abortedReads = 0;
    const signal = new Proxy(controller.signal, {
      get(target, property) {
        if (property === "aborted") {
          abortedReads += 1;
          return abortedReads >= 10;
        }
        return Reflect.get(target, property, target);
      }
    });
    await assert.rejects(
      publishReceiptBoundFinalDelivery({ plan, signal }),
      (error) => {
        assertDeliveryError(
          error,
          "FINAL_DELIVERY_COMMIT_UNCERTAIN",
          "/deliveryDirectory"
        );
        assert.equal(error.commitState, "uncertain");
        assert.equal(error.rollbackStatus, "not-attempted");
        return true;
      }
    );
    assert.equal(abortedReads, 10);
    const directory = path.join(root, "workspace", "output", "native-build");
    for (const fileName of [
      "native-candidate.candidate.json",
      "native-candidate.qa.json",
      "native-candidate.pptx",
      "native-candidate.build.json"
    ]) {
      assert.equal((await lstat(path.join(directory, fileName))).isFile(), true);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("prepare snapshots SharedArrayBuffer-backed bytes and caller-owned contracts", async () => {
  const candidateShared = Buffer.from(new SharedArrayBuffer(candidate.candidateBytes.length));
  const recordShared = Buffer.from(new SharedArrayBuffer(candidate.recordBytes.length));
  candidate.candidateBytes.copy(candidateShared);
  candidate.recordBytes.copy(recordShared);
  const { root, options } = await createCase({
    candidateOverride: {
      candidateBytes: candidateShared,
      candidateRecordBytes: recordShared,
      candidateFileName: "native-candidate.pptx"
    }
  });
  try {
    const plan = prepareReceiptBoundFinalDelivery(options);
    candidateShared.fill(0);
    recordShared.fill(0);
    options.projectBundle.sourceTemplateBytes.fill(0);
    options.projectBundle.deckSpec.slides[0].slideId = "caller-mutation";
    await publishReceiptBoundFinalDelivery({ plan });
    const directory = path.join(root, "workspace", "output", "native-build");
    const [publishedCandidate, publishedRecord, buildArtifact] = await Promise.all([
      readFile(path.join(directory, "native-candidate.pptx")),
      readFile(path.join(directory, "native-candidate.candidate.json")),
      readJsonFile(path.join(directory, "native-candidate.build.json"))
    ]);
    assert.ok(publishedCandidate.equals(candidate.candidateBytes));
    assert.ok(publishedRecord.equals(candidate.recordBytes));
    assert.equal(buildArtifact.slides[0].slideId, "native-card-arrow-output-one");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
