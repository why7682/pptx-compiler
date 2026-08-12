import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { formulaTransplantQaAssertions, preflightFormulaTransplant } from
  "../../packages/adapter-pandoc-omml/src/formula-transplant.mjs";
import { createOrderedCandidateBuildRecord } from
  "../../packages/core/src/candidate-build-record.mjs";
import {
  createCapabilityRuntime,
  executeCapabilityDispatch
} from "../../packages/core/src/capability-dispatcher.mjs";
import {
  assembleCloneFillPresentation,
  assembleSourcePreservingPresentation
} from "../../packages/core/src/create-only-assembly.mjs";
import { createDeterministicZip } from
  "../../packages/core/src/deterministic-zip.mjs";
import { assembleNativeCardArrowFromSlot } from
  "../../packages/core/src/native-card-arrow-assembly.mjs";
import {
  createNativeCardArrowSlotPlacement,
  NATIVE_CARD_ARROW_PLACEMENT_VERSION
} from "../../packages/core/src/native-card-arrow-placement.mjs";
import { assembleNativeOmmlFormulaFromSource } from
  "../../packages/core/src/native-omml-formula-assembly.mjs";
import {
  assembleOrderedSlideDeck,
  authenticateOrderedSlideAssemblyArtifact
} from "../../packages/core/src/ordered-slide-assembly.mjs";
import { prepareResolvedDeckDispatch } from
  "../../packages/core/src/project-dispatch-resolver.mjs";
import { parseSecureZip } from "../../packages/core/src/secure-zip.mjs";
import {
  executeSourceSlideCloneFill,
  preflightSourceSlideCloneFill,
  sourceSlideCloneFillQaAssertions
} from "../../plugins/clone-fill/src/source-slide-clone-fill.mjs";
import {
  executeNativeCardArrow,
  nativeCardArrowQaAssertions,
  preflightNativeCardArrow
} from "../../plugins/native-card-arrow/src/native-card-arrow.mjs";
import { buildSyntheticFixtures } from "../../scripts/generate-synthetic-fixtures.mjs";
import { assertSupportedSchema, validateJson } from
  "../../scripts/lib/json-schema.mjs";

const readJson = async (relativePath) => JSON.parse(await readFile(
  new URL(`../../${relativePath}`, import.meta.url),
  "utf8"
));

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (ArrayBuffer.isView(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function replaceOnce(source, before, after) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error("MIXED_ORDERED_SYNTHETIC_SOURCE_MISMATCH");
  }
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

const [
  baseTemplateIndex,
  cloneRegistry,
  cloneCases,
  cloneInputSchema,
  cloneOutputSchema,
  formulaRegistry,
  formulaCases,
  formulaInputSchema,
  formulaOutputSchema,
  nativeRegistry,
  nativeCases,
  nativeInputSchema,
  nativeOutputSchema
] = await Promise.all([
  readJson("fixtures/inspection/expected-potx-template-index.json"),
  readJson("fixtures/capabilities/source-slide-clone-fill/registry.json"),
  readJson("fixtures/capabilities/source-slide-clone-fill/cases.json"),
  readJson("plugins/clone-fill/schemas/input.schema.json"),
  readJson("plugins/clone-fill/schemas/output.schema.json"),
  readJson("fixtures/capabilities/formula-transplant/registry.json"),
  readJson("fixtures/capabilities/formula-transplant/cases.json"),
  readJson("packages/adapter-pandoc-omml/schemas/input.schema.json"),
  readJson("packages/adapter-pandoc-omml/schemas/output.schema.json"),
  readJson("fixtures/capabilities/native-card-arrow/registry.json"),
  readJson("fixtures/capabilities/native-card-arrow/cases.json"),
  readJson("plugins/native-card-arrow/schemas/input.schema.json"),
  readJson("plugins/native-card-arrow/schemas/output.schema.json")
]);

const capabilities = Object.freeze([
  clone(formulaRegistry.capabilities[0]),
  clone(nativeRegistry.capabilities[0]),
  clone(cloneRegistry.capabilities[0])
]);

function makeStorySource(baseBytes) {
  const parts = new Map([...parseSecureZip(baseBytes)]
    .map(([partPath, bytes]) => [partPath, Buffer.from(bytes)]));
  const slidePart = "ppt/slides/slide1.xml";
  let slideXml = parts.get(slidePart).toString("utf8");
  slideXml = replaceOnce(
    slideXml,
    "<a:t>Synthetic Fixture</a:t>",
    "<a:t>A safe pilot needs three independent checks</a:t>"
  );
  slideXml = replaceOnce(
    slideXml,
    "<a:t>Repository-owned text-only OOXML</a:t>",
    "<a:t>Structure, editability, and visible stability</a:t>"
  );
  slideXml = replaceOnce(slideXml, 'lang="en-US" sz="2800" b="1"',
    'lang="en-US" sz="4000" b="1"');
  slideXml = replaceOnce(slideXml, 'lang="en-US" sz="1600"',
    'lang="en-US" sz="2200"');
  slideXml = replaceOnce(
    slideXml,
    '<a:off x="1371600" y="2971800"/>\n            <a:ext cx="9448800" cy="914400"/>',
    '<a:off x="1371600" y="2514600"/>\n            <a:ext cx="9448800" cy="1600200"/>'
  );
  parts.set(slidePart, Buffer.from(slideXml, "utf8"));
  return createDeterministicZip(parts);
}

function makeOverlay(templateIndex) {
  return {
    schemaVersion: "0.1.0",
    contractType: "project-overlay",
    projectOverlayId: "mixed-ordered-overlay",
    projectId: "mixed-ordered-project",
    templateProfileId: templateIndex.templateProfileId,
    templateIndexId: templateIndex.templateIndexId,
    templateSha256: templateIndex.templateSha256,
    capabilityRegistryId: "mixed-ordered-registry",
    registryVersion: "0.1.0",
    capabilitySelections: [
      {
        capabilitySelectionId: "mixed-clone-selection",
        capabilityId: "source-slide-clone-fill",
        capabilityVersion: "0.1.0",
        experimentalOptIn: true,
        bindings: [
          { role: "body", shapeBindingId: "body-binding" },
          { role: "title", shapeBindingId: "title-binding" }
        ]
      },
      {
        capabilitySelectionId: "mixed-formula-selection",
        capabilityId: "formula-transplant",
        capabilityVersion: "0.1.0",
        experimentalOptIn: true,
        bindings: [{ role: "formula-target", shapeBindingId: "body-binding" }]
      },
      {
        capabilitySelectionId: "mixed-native-selection",
        capabilityId: "native-card-arrow",
        capabilityVersion: "0.1.0",
        experimentalOptIn: true,
        bindings: [{ role: "anchor", shapeBindingId: "body-binding" }]
      }
    ],
    shapeBindings: [
      {
        shapeBindingId: "body-binding",
        containerKind: "slide",
        containerKey: "slide-1",
        shapeKey: "shape-2",
        expectedKind: "text-box",
        cardinality: "exactly-one"
      },
      {
        shapeBindingId: "title-binding",
        containerKind: "slide",
        containerKey: "slide-1",
        shapeKey: "shape-1",
        expectedKind: "text-box",
        cardinality: "exactly-one"
      }
    ]
  };
}

function formulaOutput(invocation) {
  const output = clone(formulaCases.fixtures[0].expectedOutput);
  const binding = invocation.bindings[0];
  output.outputSlideId = invocation.invocationId;
  output.clone.sourceSlideKey = binding.containerKey;
  output.replace.targetBindingId = binding.shapeBindingId;
  output.replace.targetShapeKey = binding.shapeKey;
  output.replace.expectedKind = binding.expectedKind;
  if (invocation.payload.latex === "\\frac{3}{3}") {
    output.formula.unboundOmmlFragment = output.formula.unboundOmmlFragment
      .replace("<m:t>a</m:t>", "<m:t>3</m:t>")
      .replace("<m:t>b</m:t>", "<m:t>3</m:t>");
  } else if (invocation.payload.latex !== "\\frac{a}{b}") {
    throw new TypeError("unsupported-public-synthetic-formula");
  }
  return output;
}

function schemaArtifact(capability, schema, kind) {
  const schemaId = kind === "input" ? capability.inputSchemaId : capability.outputSchemaId;
  return {
    schemaId,
    schema: clone(schema),
    validate(value) {
      return validateJson(value, schema).length === 0;
    }
  };
}

function registration(capability, fixtureSet, inputSchema, outputSchema, executor, qaAssertions) {
  return {
    capabilityId: capability.capabilityId,
    capabilityVersion: capability.capabilityVersion,
    executor,
    inputSchema: schemaArtifact(capability, inputSchema, "input"),
    outputSchema: schemaArtifact(capability, outputSchema, "output"),
    conformanceFixtures: clone(fixtureSet.fixtures),
    qaContract: {
      qaContractId: capability.qaContractId,
      assertions: [...qaAssertions]
    }
  };
}

export async function createPublicMixedOrderedDocuments() {
  const fixtureBuild = await buildSyntheticFixtures();
  const baseArchive = fixtureBuild.archives.find((archive) => archive.variant === "potx");
  if (baseArchive === undefined) throw new Error("MIXED_ORDERED_SOURCE_UNAVAILABLE");
  const sourceTemplateBytes = makeStorySource(baseArchive.bytes);
  const mutableTemplateIndex = clone(baseTemplateIndex);
  mutableTemplateIndex.templateSha256 = sha256(sourceTemplateBytes);
  const contentShape = mutableTemplateIndex.slides[0].shapes.find((shape) =>
    shape.shapeKey === "shape-2");
  if (contentShape === undefined) throw new Error("MIXED_ORDERED_CONTENT_SHAPE_UNAVAILABLE");
  contentShape.geometry.y = 2_514_600;
  contentShape.geometry.cy = 1_600_200;
  const templateIndex = deepFreeze(mutableTemplateIndex);
  const capabilityRegistry = {
    schemaVersion: "0.1.0",
    contractType: "capability-registry",
    capabilityRegistryId: "mixed-ordered-registry",
    registryVersion: "0.1.0",
    capabilities: clone(capabilities)
  };
  const projectOverlay = makeOverlay(templateIndex);
  const nativeBase = assembleSourcePreservingPresentation({
    sourceArchiveBytes: sourceTemplateBytes,
    templateIndex,
    outputSlideId: "mixed-resolution"
  });
  const placementRequest = {
    placementVersion: NATIVE_CARD_ARROW_PLACEMENT_VERSION,
    outputSlideId: "mixed-resolution",
    slotRef: "slide-content-tail",
    placementIntent: "slot-aligned-fixed",
    preferredSize: { cx: 8229600, cy: 1371600 }
  };
  const placement = createNativeCardArrowSlotPlacement({
    baseArtifact: nativeBase,
    request: placementRequest
  });
  const deckSpec = {
    schemaVersion: "0.1.0",
    contractType: "deck-spec",
    deckId: "mixed-ordered-deck",
    projectId: "mixed-ordered-project",
    templateProfileId: templateIndex.templateProfileId,
    projectOverlayId: projectOverlay.projectOverlayId,
    slides: [
      {
        slideId: "mixed-setup",
        capabilitySelectionId: "mixed-clone-selection",
        payload: {
          body: ["Structure, editability, and visible stability"],
          title: "One decision, three inspectable signals"
        }
      },
      {
        slideId: "mixed-evidence",
        capabilitySelectionId: "mixed-formula-selection",
        payload: { displayMode: "display", latex: "\\frac{3}{3}" }
      },
      {
        slideId: "mixed-resolution",
        capabilitySelectionId: "mixed-native-selection",
        payload: {
          geometry: clone(placement.resolvedGeometry),
          label: "Approve a limited pilot now",
          style: {
            arrowFill: "0F766E",
            cardFill: "CCFBF1",
            fontSizeHundredthPoints: 1800,
            lineColor: "115E59",
            textColor: "134E4A"
          }
        }
      }
    ]
  };
  return deepFreeze({
    sourceTemplateBytes: Buffer.from(sourceTemplateBytes),
    templateIndex,
    templateProfile: {
      schemaVersion: "0.1.0",
      contractType: "template-profile",
      templateProfileId: templateIndex.templateProfileId,
      templateIndexId: templateIndex.templateIndexId,
      templateFormat: "potx",
      templateSha256: templateIndex.templateSha256,
      slideSizeEmu: clone(templateIndex.slideSizeEmu),
      layoutBindings: [{ layoutKey: "layout-1", semanticRole: "content" }]
    },
    capabilityRegistry,
    projectOverlay,
    deckSpec,
    placementRequest
  });
}

export async function createPublicMixedOrderedRuntime(
  documents,
  { onExecute, onPreflight } = {}
) {
  const [formulaCapability, nativeCapability, cloneCapability] =
    documents.capabilityRegistry.capabilities;
  const wrap = (capabilityId, execute) => (invocation) => {
    onExecute?.(capabilityId, invocation.invocationId);
    return execute(invocation);
  };
  const wrapPreflight = (capabilityId, preflight) => (invocation) => {
    onPreflight?.(capabilityId, invocation.invocationId);
    return preflight(invocation);
  };
  return createCapabilityRuntime({
    capabilityRegistry: clone(documents.capabilityRegistry),
    registrations: [
      registration(
        formulaCapability,
        formulaCases,
        formulaInputSchema,
        formulaOutputSchema,
        {
          executorId: formulaCapability.executorId,
          preflight: wrapPreflight(formulaCapability.capabilityId,
            preflightFormulaTransplant),
          execute: wrap(formulaCapability.capabilityId, formulaOutput)
        },
        formulaTransplantQaAssertions
      ),
      registration(
        nativeCapability,
        nativeCases,
        nativeInputSchema,
        nativeOutputSchema,
        {
          executorId: nativeCapability.executorId,
          preflight: wrapPreflight(nativeCapability.capabilityId,
            preflightNativeCardArrow),
          execute: wrap(nativeCapability.capabilityId, executeNativeCardArrow)
        },
        nativeCardArrowQaAssertions
      ),
      registration(
        cloneCapability,
        cloneCases,
        cloneInputSchema,
        cloneOutputSchema,
        {
          executorId: cloneCapability.executorId,
          preflight: wrapPreflight(cloneCapability.capabilityId,
            preflightSourceSlideCloneFill),
          execute: wrap(cloneCapability.capabilityId, executeSourceSlideCloneFill)
        },
        sourceSlideCloneFillQaAssertions
      )
    ],
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
      resolveCapabilitySupport(definition) {
        return {
          supportMatrixItemId: definition.supportMatrixItemId,
          supportClaimsEnabled: false,
          status: "experimental",
          disposition: "accept-with-warning"
        };
      }
    }
  });
}

export function mixedOrderedResolverDependencies(validators) {
  return {
    validateCapabilityRegistry: validators.validateCapabilityRegistry,
    validateDeckSpec: validators.validateDeckSpec,
    validateProjectOverlay: validators.validateProjectOverlay,
    validateTemplateIndex: validators.validateTemplateIndex
  };
}

export async function createPublicMixedOrderedCandidate({
  documents,
  runtime,
  resolverDependencies,
  candidateFileName = "mixed-ordered-candidate.pptx"
}) {
  const dispatchPlans = documents.deckSpec.slides.map((slide) =>
    prepareResolvedDeckDispatch({
      runtime,
      capabilityRegistry: clone(documents.capabilityRegistry),
      projectOverlay: clone(documents.projectOverlay),
      templateIndex: clone(documents.templateIndex),
      deckSpec: { ...clone(documents.deckSpec), slides: [clone(slide)] },
      dependencies: resolverDependencies
    }));
  const cloneDispatch = await executeCapabilityDispatch({ plan: dispatchPlans[0] });
  const cloneArtifact = assembleCloneFillPresentation({
    sourceArchiveBytes: documents.sourceTemplateBytes,
    templateIndex: documents.templateIndex,
    plan: cloneDispatch.results[0].output
  });
  const formulaArtifact = await assembleNativeOmmlFormulaFromSource({
    sourceArchiveBytes: documents.sourceTemplateBytes,
    templateIndex: documents.templateIndex,
    dispatchPlan: dispatchPlans[1]
  });
  const nativeBase = assembleSourcePreservingPresentation({
    sourceArchiveBytes: documents.sourceTemplateBytes,
    templateIndex: documents.templateIndex,
    outputSlideId: documents.deckSpec.slides[2].slideId
  });
  const nativeArtifact = await assembleNativeCardArrowFromSlot({
    baseArtifact: nativeBase,
    placementRequest: documents.placementRequest,
    dispatchPlan: dispatchPlans[2]
  });
  const orderedArtifact = assembleOrderedSlideDeck({
    slides: [cloneArtifact, formulaArtifact, nativeArtifact].map((artifact) => ({
      archiveBytes: artifact.archiveBytes,
      report: artifact.report
    }))
  });
  const authenticated = authenticateOrderedSlideAssemblyArtifact({
    archiveBytes: orderedArtifact.archiveBytes,
    report: orderedArtifact.report
  });
  const candidate = createOrderedCandidateBuildRecord({
    candidateBytes: orderedArtifact.archiveBytes,
    candidateFileName,
    baseArtifactSha256: authenticated.candidateRecordFacts.baseArtifactSha256,
    orderedDeck: {
      assemblyVersion: authenticated.candidateRecordFacts.assemblyVersion,
      slides: authenticated.candidateRecordFacts.slides,
      diff: authenticated.candidateRecordFacts.diff
    }
  });
  return Object.freeze({
    candidateBytes: Buffer.from(candidate.candidateBytes),
    candidateRecordBytes: Buffer.from(candidate.recordBytes),
    candidateFileName,
    record: candidate.record,
    orderedArtifact,
    sourceArtifacts: Object.freeze([
      cloneArtifact,
      formulaArtifact,
      nativeArtifact
    ])
  });
}

export function createMixedOrderedProjectConfig() {
  return {
    schemaVersion: "0.1.0",
    contractType: "project-config",
    projectId: "mixed-ordered-project",
    template: {
      sourcePath: "workspace/template.potx",
      profileId: "synthetic-template-profile",
      profilePath: "workspace/template-profile.json",
      indexId: "synthetic-template-index",
      indexPath: "workspace/template-index.json"
    },
    capabilityRegistry: {
      registryId: "mixed-ordered-registry",
      registryVersion: "0.1.0",
      path: "workspace/capability-registry.json"
    },
    projectOverlay: {
      overlayId: "mixed-ordered-overlay",
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
