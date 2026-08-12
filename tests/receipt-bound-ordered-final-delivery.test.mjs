import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createOrderedCandidateBuildRecord } from
  "../packages/core/src/candidate-build-record.mjs";
import {
  createCapabilityRuntime,
  executeCapabilityDispatch
} from "../packages/core/src/capability-dispatcher.mjs";
import { assembleCloneFillPresentation } from
  "../packages/core/src/create-only-assembly.mjs";
import {
  assembleOrderedSlideDeck,
  authenticateOrderedSlideAssemblyArtifact
} from "../packages/core/src/ordered-slide-assembly.mjs";
import { prepareResolvedDeckDispatch } from
  "../packages/core/src/project-dispatch-resolver.mjs";
import { createProjectContext } from "../packages/core/src/project-context.mjs";
import {
  ReceiptBoundFinalDeliveryError,
  prepareReceiptBoundCloneFillOrderedFinalDelivery,
  publishReceiptBoundFinalDelivery
} from "../packages/core/src/receipt-bound-final-delivery.mjs";
import { resolveSlideLayoutIr } from "../packages/core/src/slide-layout-ir.mjs";
import {
  executeSourceSlideCloneFill,
  preflightSourceSlideCloneFill,
  sourceSlideCloneFillQaAssertions
} from "../plugins/clone-fill/src/source-slide-clone-fill.mjs";
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
const registryDocument = await readJson(
  "fixtures/capabilities/source-slide-clone-fill/registry.json"
);
const cases = await readJson("fixtures/capabilities/source-slide-clone-fill/cases.json");
const deckFixture = await readJson(
  "fixtures/capabilities/source-slide-clone-fill/deck-spec.json"
);
const projectOverlay = await readJson(
  "fixtures/capabilities/source-slide-clone-fill/project-overlay.json"
);
const inputSchema = await readJson("plugins/clone-fill/schemas/input.schema.json");
const outputSchema = await readJson("plugins/clone-fill/schemas/output.schema.json");
const templateIndex = deepFreeze(await readJson(
  "fixtures/inspection/expected-potx-template-index.json"
));
const directCandidateFixture = await readJson(
  "fixtures/contracts/valid/candidate-build-record.json"
);
const fixtureBuild = await buildSyntheticFixtures();
const sourceArchive = fixtureBuild.archives.find((archive) => archive.variant === "potx");
const capability = registryDocument.capabilities[0];

function deliveryDeck() {
  const deck = clone(deckFixture);
  deck.deckId = "ordered-clone-fill-deck";
  deck.slides[0].payload.body = ["First bounded evidence statement"];
  deck.slides[0].payload.title = "First ordered takeaway";
  deck.slides[1].payload.body = ["Second bounded evidence statement"];
  deck.slides[1].payload.title = "Second ordered takeaway";
  return deck;
}

function deliveryDeckWithSlideCount(slideCount) {
  const deck = deliveryDeck();
  const seed = deck.slides[0];
  deck.slides = Array.from({ length: slideCount }, (_, index) => ({
    slideId: `ordered-output-${index + 1}`,
    capabilitySelectionId: seed.capabilitySelectionId,
    payload: {
      body: [`Bounded evidence statement ${index + 1}`],
      title: `Ordered takeaway ${index + 1}`
    }
  }));
  return deck;
}

function makeRegistration(onExecute) {
  return {
    capabilityId: capability.capabilityId,
    capabilityVersion: capability.capabilityVersion,
    executor: {
      executorId: capability.executorId,
      preflight: preflightSourceSlideCloneFill,
      execute(invocation) {
        onExecute?.();
        return executeSourceSlideCloneFill(invocation);
      }
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
      assertions: [...sourceSlideCloneFillQaAssertions]
    }
  };
}

async function makeRuntime(onExecute) {
  return createCapabilityRuntime({
    capabilityRegistry: clone(registryDocument),
    registrations: [makeRegistration(onExecute)],
    dependencies: {
      validateCapabilityRegistry: schemaValidator("capability-registry"),
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
          supportMatrixItemId: "source-slide-clone-fill",
          supportClaimsEnabled: false,
          status: "experimental",
          disposition: "accept-with-warning"
        };
      }
    }
  });
}

const resolverDependencies = Object.freeze({
  validateCapabilityRegistry: schemaValidator("capability-registry"),
  validateDeckSpec: schemaValidator("deck-spec"),
  validateProjectOverlay: schemaValidator("project-overlay"),
  validateTemplateIndex: schemaValidator("template-index")
});

async function buildCandidate(deck = deliveryDeck()) {
  const runtime = await makeRuntime();
  const dispatchPlan = prepareResolvedDeckDispatch({
    runtime,
    capabilityRegistry: clone(registryDocument),
    projectOverlay: clone(projectOverlay),
    templateIndex: clone(templateIndex),
    deckSpec: clone(deck),
    dependencies: resolverDependencies
  });
  const dispatched = await executeCapabilityDispatch({ plan: dispatchPlan });
  const slides = dispatched.results.map((entry) => assembleCloneFillPresentation({
    sourceArchiveBytes: sourceArchive.bytes,
    templateIndex,
    plan: entry.output
  }));
  const ordered = assembleOrderedSlideDeck({
    slides: slides.map((slide) => ({
      archiveBytes: slide.archiveBytes,
      report: slide.report
    }))
  });
  const authenticated = authenticateOrderedSlideAssemblyArtifact({
    archiveBytes: ordered.archiveBytes,
    report: ordered.report
  });
  const record = createOrderedCandidateBuildRecord({
    candidateBytes: ordered.archiveBytes,
    candidateFileName: "ordered-candidate.pptx",
    baseArtifactSha256: authenticated.candidateRecordFacts.baseArtifactSha256,
    orderedDeck: {
      assemblyVersion: authenticated.candidateRecordFacts.assemblyVersion,
      slides: authenticated.candidateRecordFacts.slides,
      diff: authenticated.candidateRecordFacts.diff
    }
  });
  return Object.freeze({
    candidateBytes: Buffer.from(record.candidateBytes),
    candidateRecordBytes: Buffer.from(record.recordBytes),
    candidateFileName: "ordered-candidate.pptx",
    record: record.record
  });
}

const reviewedCandidate = await buildCandidate();

function nativeMarkedCandidate() {
  const deck = clone(reviewedCandidate.record.deck);
  const layoutIr = clone(directCandidateFixture.slide.layoutIr);
  layoutIr.slideId = deck.slides[1].slideId;
  deck.slides[1].sourceBuild = {
    buildType: "native-card-arrow-source",
    artifactType: directCandidateFixture.sourceArtifactType,
    verificationProfile: directCandidateFixture.sourceVerificationProfile,
    baseArtifactSha256: directCandidateFixture.baseArtifactSha256,
    sourceSlidePart: directCandidateFixture.slide.slidePart,
    layoutIr,
    composedSlidePlan: resolveSlideLayoutIr(layoutIr),
    diff: clone(directCandidateFixture.slide.diff),
    capabilityEvidence: clone(directCandidateFixture.slide.capabilityEvidence)
  };
  const record = createOrderedCandidateBuildRecord({
    candidateBytes: reviewedCandidate.candidateBytes,
    candidateFileName: reviewedCandidate.candidateFileName,
    baseArtifactSha256: reviewedCandidate.record.baseArtifactSha256,
    orderedDeck: deck
  });
  return {
    candidateBytes: Buffer.from(record.candidateBytes),
    candidateRecordBytes: Buffer.from(record.recordBytes),
    candidateFileName: reviewedCandidate.candidateFileName
  };
}

function orderedChangeReason(partName) {
  if (partName === "[Content_Types].xml") return "ordered-slide-content-types";
  if (partName === "ppt/_rels/presentation.xml.rels") {
    return "ordered-slide-relationships";
  }
  if (partName === "ppt/presentation.xml") return "ordered-slide-owner-list";
  if (partName.includes("/_rels/slide")) return "normalized-slide-layout-relationship";
  return "cloned-slide-content";
}

function syntheticOrderedCandidate(deck) {
  const addedParts = [];
  for (let index = 1; index < deck.slides.length; index += 1) {
    addedParts.push(
      `ppt/slides/slide${index + 1}.xml`,
      `ppt/slides/_rels/slide${index + 1}.xml.rels`
    );
  }
  addedParts.sort();
  const modifiedParts = [
    "[Content_Types].xml",
    "ppt/_rels/presentation.xml.rels",
    "ppt/presentation.xml"
  ].sort();
  const changedParts = [...addedParts, ...modifiedParts].sort();
  const slides = deck.slides.map((slide, index) => ({
    slideId: slide.slideId,
    order: index + 1,
    slidePart: `ppt/slides/slide${index + 1}.xml`,
    relationshipsPartPath: `ppt/slides/_rels/slide${index + 1}.xml.rels`,
    presentationSlideId: 256 + index,
    relationshipId: `rId${4 + index}`,
    sourceArtifactSha256: digest(Buffer.from(`ordered-source-${index + 1}`, "utf8")),
    sourceBuild: {
      buildType: "clone-fill-source",
      artifactType: "assembled-pptx"
    }
  }));
  const record = createOrderedCandidateBuildRecord({
    candidateBytes: reviewedCandidate.candidateBytes,
    candidateFileName: reviewedCandidate.candidateFileName,
    baseArtifactSha256: slides[0].sourceArtifactSha256,
    orderedDeck: {
      assemblyVersion: "0.1.0",
      slides,
      diff: {
        addedParts,
        removedParts: [],
        modifiedParts,
        allowedChanges: changedParts.map((partName) => ({
          partPath: partName,
          reason: orderedChangeReason(partName)
        })),
        collateralChanges: []
      }
    }
  });
  return {
    candidateBytes: Buffer.from(record.candidateBytes),
    candidateRecordBytes: Buffer.from(record.recordBytes),
    candidateFileName: reviewedCandidate.candidateFileName
  };
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
    projectId: "clone-fill-project",
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
  mechanical: Object.freeze({ token: "ordered-mechanical" }),
  render: Object.freeze({ token: "ordered-render" }),
  pixelReview: Object.freeze({ token: "ordered-pixel-review" }),
  compatibility: Object.freeze({ token: "ordered-compatibility" })
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
      slideIds: [...expected.slideIds],
      status: "pass"
    };
  }
  if (kind === "render") {
    return {
      ...common,
      receiptType: "render",
      renderSetId: "ordered-candidate-render",
      slideIds: [...expected.slideIds],
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
    evidenceRecordId: "urn:pptx-compiler:compatibility:ordered-clone-fill-local-001",
    operation: expected.operation,
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

async function createCase({
  mutateBundle,
  dependencyOverrides,
  candidate,
  deck = deliveryDeck(),
  runtime
} = {}) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "ordered-final-")));
  await mkdir(path.join(root, "workspace", "output"), { recursive: true });
  const context = createProjectContext({
    projectRoot: root,
    projectConfig: projectConfig(),
    dependencies: { validateProjectConfig }
  });
  const projectBundle = {
    projectContext: context,
    templateProfile: templateProfile(),
    templateIndex: clone(templateIndex),
    capabilityRegistry: clone(registryDocument),
    projectOverlay: clone(projectOverlay),
    deckSpec: clone(deck),
    sourceTemplateBytes: Buffer.from(sourceArchive.bytes)
  };
  if (mutateBundle) mutateBundle(projectBundle);
  return {
    root,
    options: {
      candidate: candidate ?? {
        candidateBytes: Buffer.from(reviewedCandidate.candidateBytes),
        candidateRecordBytes: Buffer.from(reviewedCandidate.candidateRecordBytes),
        candidateFileName: reviewedCandidate.candidateFileName
      },
      projectBundle,
      evidence: {
        mechanicalReceipt: evidenceTokens.mechanical,
        renderReceipt: evidenceTokens.render,
        pixelReviewReceipt: evidenceTokens.pixelReview,
        compatibilityReceipt: evidenceTokens.compatibility
      },
      output: {
        buildId: "ordered-build",
        qaReportId: "ordered-qa",
        publishPath: "workspace/output/ordered-build/ordered-candidate.pptx"
      },
      dependencies: deliveryDependencies(dependencyOverrides),
      runtime: runtime ?? await makeRuntime()
    }
  };
}

function assertDeliveryError(error, code, pointer) {
  assert.ok(error instanceof ReceiptBoundFinalDeliveryError);
  assert.equal(error.code, code);
  assert.equal(error.pointer, pointer);
  return true;
}

test("clone/fill ordered final delivery regenerates the complete readable batch", async () => {
  const { root, options } = await createCase();
  try {
    const plan = await prepareReceiptBoundCloneFillOrderedFinalDelivery(options);
    const published = await publishReceiptBoundFinalDelivery({ plan });
    assert.equal(published.verificationProfile, "receipt-bound-clone-fill-ordered-delivery");
    assert.equal(published.sha256, digest(reviewedCandidate.candidateBytes));
    const directory = path.join(root, "workspace", "output", "ordered-build");
    const [candidateBytes, buildArtifact, qaReport] = await Promise.all([
      readFile(path.join(directory, "ordered-candidate.pptx")),
      readJsonFile(path.join(directory, "ordered-candidate.build.json")),
      readJsonFile(path.join(directory, "ordered-candidate.qa.json"))
    ]);
    assert.deepEqual(candidateBytes, reviewedCandidate.candidateBytes);
    assert.deepEqual(buildArtifact.slides.map((slide) => slide.slideId), [
      "clone-output-one",
      "clone-output-two"
    ]);
    assert.deepEqual(buildArtifact.slides.map((slide) => slide.capabilityId), [
      "source-slide-clone-fill",
      "source-slide-clone-fill"
    ]);
    assert.equal(buildArtifact.changedParts.includes("ppt/slides/slide1.xml"), true);
    assert.equal(buildArtifact.changedParts.includes("ppt/slides/slide2.xml"), true);
    assert.equal(qaReport.decision, "pass");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the executable ordered boundary admits eleven slides", async () => {
  const deck = deliveryDeckWithSlideCount(11);
  const candidate = await buildCandidate(deck);
  const { root, options } = await createCase({
    candidate: {
      candidateBytes: candidate.candidateBytes,
      candidateRecordBytes: candidate.candidateRecordBytes,
      candidateFileName: candidate.candidateFileName
    },
    deck
  });
  try {
    const plan = await prepareReceiptBoundCloneFillOrderedFinalDelivery(options);
    const published = await publishReceiptBoundFinalDelivery({ plan });
    const buildArtifact = await readJsonFile(path.join(
      root,
      "workspace",
      "output",
      "ordered-build",
      "ordered-candidate.build.json"
    ));
    assert.equal(published.verificationProfile, "receipt-bound-clone-fill-ordered-delivery");
    assert.equal(buildArtifact.slides.length, 11);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("twelve slides fail before product dispatch or ordered assembly", async () => {
  const deck = deliveryDeckWithSlideCount(12);
  let executeCalls = 0;
  const runtime = await makeRuntime(() => { executeCalls += 1; });
  executeCalls = 0;
  const { root, options } = await createCase({
    candidate: syntheticOrderedCandidate(deck),
    deck,
    runtime
  });
  try {
    await assert.rejects(
      prepareReceiptBoundCloneFillOrderedFinalDelivery(options),
      (error) => assertDeliveryError(
        error,
        "FINAL_DELIVERY_CANDIDATE_INVALID",
        "/candidateRecord"
      )
    );
    assert.equal(executeCalls, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("ordered final delivery rejects DeckSpec content and order drift", async (t) => {
  await t.test("content", async () => {
    const { root, options } = await createCase({
      mutateBundle(bundle) {
        bundle.deckSpec.slides[1].payload.title = "Unreviewed ordered takeaway";
      }
    });
    try {
      await assert.rejects(
        prepareReceiptBoundCloneFillOrderedFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_CANDIDATE_INVALID",
          "/options/candidate/projection/archiveBytes"
        )
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  await t.test("order", async () => {
    const { root, options } = await createCase({
      mutateBundle(bundle) {
        bundle.deckSpec.slides.reverse();
      }
    });
    try {
      await assert.rejects(
        prepareReceiptBoundCloneFillOrderedFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_SOURCE_MISMATCH",
          "/deckSpec/slides/0/slideId"
        )
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("clone/fill ordered delivery rejects target-specific native source-build authority", async () => {
  const { root, options } = await createCase({ candidate: nativeMarkedCandidate() });
  try {
    await assert.rejects(
      prepareReceiptBoundCloneFillOrderedFinalDelivery(options),
      (error) => assertDeliveryError(
        error,
        "FINAL_DELIVERY_CANDIDATE_INVALID",
        "/candidateRecord/deck/slides/1/sourceBuild"
      )
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ordered receipts must cover every slide and the ordered compatibility operation", async (t) => {
  await t.test("mechanical coverage", async () => {
    const { root, options } = await createCase({
      dependencyOverrides: {
        mechanical(result) {
          result.slideIds.pop();
          return result;
        }
      }
    });
    try {
      await assert.rejects(
        prepareReceiptBoundCloneFillOrderedFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_EVIDENCE_INVALID",
          "/evidence/mechanical"
        )
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  await t.test("compatibility purpose", async () => {
    const { root, options } = await createCase({
      dependencyOverrides: {
        compatibility(result) {
          result.operation = "shape-name-edit-save-reopen";
          return result;
        }
      }
    });
    try {
      await assert.rejects(
        prepareReceiptBoundCloneFillOrderedFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_EVIDENCE_INVALID",
          "/evidence/compatibility"
        )
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("ordered preparation snapshots readable contracts before batch execution", async () => {
  const { root, options } = await createCase();
  try {
    const preparing = prepareReceiptBoundCloneFillOrderedFinalDelivery(options);
    options.projectBundle.deckSpec.slides[0].payload.title = "Late caller mutation";
    options.candidate.candidateBytes.fill(0);
    const plan = await preparing;
    const published = await publishReceiptBoundFinalDelivery({ plan });
    assert.equal(published.sha256, digest(reviewedCandidate.candidateBytes));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
