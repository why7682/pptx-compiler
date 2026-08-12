import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createCandidateBuildRecord,
  verifyCandidateBuildRecord
} from "../packages/core/src/candidate-build-record.mjs";
import { createCapabilityRuntime } from
  "../packages/core/src/capability-dispatcher.mjs";
import { assembleCloneFillPresentation } from
  "../packages/core/src/create-only-assembly.mjs";
import {
  assembleNativeOmmlFormulaFromSource,
  assembleNativeOmmlFormulaOnCloneFill
} from "../packages/core/src/native-omml-formula-assembly.mjs";
import { createProjectContext } from "../packages/core/src/project-context.mjs";
import { prepareResolvedDeckDispatch } from
  "../packages/core/src/project-dispatch-resolver.mjs";
import {
  prepareReceiptBoundOmmlFinalDelivery,
  publishReceiptBoundFinalDelivery,
  ReceiptBoundFinalDeliveryError
} from "../packages/core/src/receipt-bound-final-delivery.mjs";
import { parseSecureZip } from "../packages/core/src/secure-zip.mjs";
import {
  formulaTransplantQaAssertions,
  preflightFormulaTransplant
} from "../packages/adapter-pandoc-omml/src/formula-transplant.mjs";
import { executeSourceSlideCloneFill } from
  "../plugins/clone-fill/src/source-slide-clone-fill.mjs";
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
const registryDocument = await readJson("fixtures/capabilities/formula-transplant/registry.json");
const formulaCases = await readJson("fixtures/capabilities/formula-transplant/cases.json");
const formulaDeck = await readJson("fixtures/capabilities/formula-transplant/deck-spec.json");
const projectOverlay = await readJson(
  "fixtures/capabilities/formula-transplant/project-overlay.json"
);
const inputSchema = await readJson(
  "packages/adapter-pandoc-omml/schemas/input.schema.json"
);
const outputSchema = await readJson(
  "packages/adapter-pandoc-omml/schemas/output.schema.json"
);
const templateIndex = deepFreeze(await readJson(
  "fixtures/inspection/expected-potx-template-index.json"
));
const fixtureBuild = await buildSyntheticFixtures();
const sourceArchive = fixtureBuild.archives.find((archive) => archive.variant === "potx");
const capability = registryDocument.capabilities[0];
const expectedOutput = formulaCases.fixtures[0].expectedOutput;

function formulaOutput(invocation) {
  const output = clone(expectedOutput);
  const binding = invocation.bindings[0];
  output.outputSlideId = invocation.invocationId;
  output.clone.sourceSlideKey = binding.containerKey;
  output.replace.targetBindingId = binding.shapeBindingId;
  output.replace.targetShapeKey = binding.shapeKey;
  output.replace.expectedKind = binding.expectedKind;
  if (invocation.payload.latex === "\\frac{x}{b}") {
    output.formula.unboundOmmlFragment =
      output.formula.unboundOmmlFragment.replace("<m:t>a</m:t>", "<m:t>x</m:t>");
  } else if (invocation.payload.latex !== "\\frac{a}{b}") {
    throw new TypeError("unsupported-test-formula");
  }
  return output;
}

function makeRegistration() {
  return {
    capabilityId: capability.capabilityId,
    capabilityVersion: capability.capabilityVersion,
    executor: {
      executorId: capability.executorId,
      preflight: preflightFormulaTransplant,
      execute: formulaOutput
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
    conformanceFixtures: clone(formulaCases.fixtures),
    qaContract: {
      qaContractId: capability.qaContractId,
      assertions: [...formulaTransplantQaAssertions]
    }
  };
}

async function makeRuntime() {
  return createCapabilityRuntime({
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
          supportMatrixItemId: "formula-transplant",
          supportClaimsEnabled: false,
          status: "experimental",
          disposition: "accept-with-warning"
        };
      }
    }
  });
}

function resolverPlan(runtime, deck = formulaDeck) {
  return prepareResolvedDeckDispatch({
    runtime,
    capabilityRegistry: clone(registryDocument),
    projectOverlay: clone(projectOverlay),
    templateIndex: clone(templateIndex),
    deckSpec: clone(deck),
    dependencies: {
      validateCapabilityRegistry: schemaValidator("capability-registry"),
      validateDeckSpec: schemaValidator("deck-spec"),
      validateProjectOverlay: schemaValidator("project-overlay"),
      validateTemplateIndex: schemaValidator("template-index")
    }
  });
}

function candidateFromArtifact(artifact) {
  return createCandidateBuildRecord({
    candidateBytes: artifact.archiveBytes,
    candidateFileName: "formula-candidate.pptx",
    sourceArtifactType: artifact.report.artifactType,
    sourceVerificationProfile: artifact.report.verificationProfile,
    baseArtifactSha256: artifact.report.baseOutputSha256,
    slideId: artifact.report.outputSlideId,
    slidePart: artifact.report.slidePart,
    layoutIr: artifact.report.layoutIr,
    composedSlidePlan: artifact.report.composedSlidePlan,
    diff: artifact.report.diff,
    capabilityEvidence: {
      evidenceType: "native-omml-formula",
      formulaDigest: artifact.report.formulaDigest,
      formulaTarget: artifact.report.formulaTarget
    }
  });
}

const candidateRuntime = await makeRuntime();
const sourceArtifact = await assembleNativeOmmlFormulaFromSource({
  sourceArchiveBytes: sourceArchive.bytes,
  templateIndex,
  dispatchPlan: resolverPlan(candidateRuntime)
});
const sourceCandidate = candidateFromArtifact(sourceArtifact);

const cloneFillBase = assembleCloneFillPresentation({
  sourceArchiveBytes: sourceArchive.bytes,
  templateIndex,
  plan: deepFreeze(executeSourceSlideCloneFill({
    invocationId: "formula-clone-fill-base",
    payload: {
      body: ["Typed formula target"],
      title: "Typed OMML remains native"
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
  }))
});
const legacyRuntime = await makeRuntime();
const cloneFilledArtifact = await assembleNativeOmmlFormulaOnCloneFill({
  baseArtifact: cloneFillBase,
  dispatchPlan: resolverPlan(legacyRuntime)
});
const cloneFilledCandidate = candidateFromArtifact(cloneFilledArtifact);

const noOpCloneFillBase = assembleCloneFillPresentation({
  sourceArchiveBytes: sourceArchive.bytes,
  templateIndex,
  plan: deepFreeze(executeSourceSlideCloneFill({
    invocationId: "formula-no-op-clone-fill-base",
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
  }))
});
const noOpRuntime = await makeRuntime();
const noOpCloneFilledArtifact = await assembleNativeOmmlFormulaOnCloneFill({
  baseArtifact: noOpCloneFillBase,
  dispatchPlan: resolverPlan(noOpRuntime)
});
const noOpCloneFilledCandidate = candidateFromArtifact(noOpCloneFilledArtifact);

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
    projectId: "formula-transplant-project",
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
    return { ...common, receiptType: "mechanical", slideId: expected.slideId, status: "pass" };
  }
  if (kind === "render") {
    return {
      ...common,
      receiptType: "render",
      renderSetId: "formula-candidate-render",
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
    evidenceRecordId: "urn:pptx-compiler:compatibility:omml-local-001",
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

async function createCase({ candidate = sourceCandidate, mutateBundle, dependencyOverrides } = {}) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "omml-final-delivery-")));
  await mkdir(path.join(root, "workspace", "output"), { recursive: true });
  const config = projectConfig();
  const projectBundle = {
    projectContext: createProjectContext({
      projectRoot: root,
      projectConfig: config,
      dependencies: { validateProjectConfig }
    }),
    templateProfile: templateProfile(),
    templateIndex: clone(templateIndex),
    capabilityRegistry: clone(registryDocument),
    projectOverlay: clone(projectOverlay),
    deckSpec: clone(formulaDeck),
    sourceTemplateBytes: Buffer.from(sourceArchive.bytes)
  };
  if (mutateBundle) mutateBundle(projectBundle);
  return {
    root,
    options: {
      candidate: {
        candidateBytes: Buffer.from(candidate.candidateBytes),
        candidateRecordBytes: Buffer.from(candidate.recordBytes),
        candidateFileName: "formula-candidate.pptx"
      },
      projectBundle,
      evidence: {
        mechanicalReceipt: evidenceTokens.mechanical,
        renderReceipt: evidenceTokens.render,
        pixelReviewReceipt: evidenceTokens.pixelReview,
        compatibilityReceipt: evidenceTokens.compatibility
      },
      output: {
        buildId: "formula-build",
        qaReportId: "formula-qa",
        publishPath: "workspace/output/formula-build/formula-candidate.pptx"
      },
      dependencies: deliveryDependencies(dependencyOverrides),
      runtime: await makeRuntime()
    }
  };
}

function assertDeliveryError(error, code, pointer) {
  assert.ok(error instanceof ReceiptBoundFinalDeliveryError);
  assert.equal(error.code, code);
  assert.equal(error.pointer, pointer);
  return true;
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("OMML final delivery replays readable authority and publishes the reviewed bytes", async () => {
  const { root, options } = await createCase();
  try {
    const plan = await prepareReceiptBoundOmmlFinalDelivery(options);
    const result = await publishReceiptBoundFinalDelivery({ plan });
    assert.equal(result.verificationProfile, "receipt-bound-native-omml-formula-delivery");
    assert.equal(result.sha256, digest(sourceCandidate.candidateBytes));
    const directory = path.join(root, "workspace", "output", "formula-build");
    const [candidateBytes, recordBytes, qaReport, buildArtifact] = await Promise.all([
      readFile(path.join(directory, "formula-candidate.pptx")),
      readFile(path.join(directory, "formula-candidate.candidate.json")),
      readJsonFile(path.join(directory, "formula-candidate.qa.json")),
      readJsonFile(path.join(directory, "formula-candidate.build.json"))
    ]);
    assert.ok(candidateBytes.equals(sourceCandidate.candidateBytes));
    assert.deepEqual(verifyCandidateBuildRecord({
      candidateBytes,
      recordBytes,
      candidateFileName: "formula-candidate.pptx"
    }).record, sourceCandidate.record);
    assert.deepEqual(buildArtifact.changedParts, [
      "[Content_Types].xml",
      "ppt/slides/slide1.xml"
    ]);
    assert.deepEqual(buildArtifact.slides, [{
      slideId: "formula-output-one",
      capabilityId: "formula-transplant",
      capabilityVersion: "0.1.0"
    }]);
    assert.ok(qaReport.checks.some(({ checkId }) =>
      checkId === "formula-content-editability"));
    const slideXml = parseSecureZip(candidateBytes)
      .get("ppt/slides/slide1.xml").toString("utf8");
    assert.equal(slideXml.includes("Synthetic Fixture"), true);
    assert.equal(slideXml.includes("Typed OMML remains native"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("OMML final delivery rejects semantic and inherited-content drift", async (t) => {
  await t.test("DeckSpec LaTeX drift", async () => {
    const { root, options } = await createCase({
      mutateBundle(bundle) {
        bundle.deckSpec.slides[0].payload.latex = "\\frac{x}{b}";
      }
    });
    try {
      await assert.rejects(
        prepareReceiptBoundOmmlFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_CANDIDATE_INVALID",
          "/options/candidate/projection/archiveBytes"
        )
      );
      assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("legacy clone/fill content", async () => {
    const { root, options } = await createCase({ candidate: cloneFilledCandidate });
    try {
      await assert.rejects(
        prepareReceiptBoundOmmlFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_CANDIDATE_INVALID",
          "/options/candidate/projection/archiveBytes"
        )
      );
      assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("equivalent readable facts converge regardless of the compatibility call path", async () => {
  assert.ok(noOpCloneFilledArtifact.archiveBytes.equals(sourceArtifact.archiveBytes));
  assert.deepEqual(noOpCloneFilledArtifact.report, sourceArtifact.report);
  const { root, options } = await createCase({ candidate: noOpCloneFilledCandidate });
  try {
    const plan = await prepareReceiptBoundOmmlFinalDelivery(options);
    const result = await publishReceiptBoundFinalDelivery({ plan });
    assert.equal(result.verificationProfile, "receipt-bound-native-omml-formula-delivery");
    assert.equal(result.sha256, digest(sourceCandidate.candidateBytes));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("shape-name compatibility evidence cannot authorize editable OMML", async () => {
  const { root, options } = await createCase({
    dependencyOverrides: {
      compatibility(result) {
        return { ...result, operation: "shape-name-edit-save-reopen" };
      }
    }
  });
  try {
    await assert.rejects(
      prepareReceiptBoundOmmlFinalDelivery(options),
      (error) => assertDeliveryError(
        error,
        "FINAL_DELIVERY_EVIDENCE_INVALID",
        "/evidence/compatibility"
      )
    );
    assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
