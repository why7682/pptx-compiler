import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CapabilityRuntimeError,
  createCapabilityRuntime,
  prepareCapabilityDispatch
} from "../packages/core/src/capability-dispatcher.mjs";
import {
  assembleCloneFillPresentation,
  publishCreateOnlyPresentation
} from "../packages/core/src/create-only-assembly.mjs";
import {
  assembleNativeOmmlFormulaFromSource,
  assembleNativeOmmlFormulaOnCloneFill,
  authenticateNativeOmmlFormulaAssemblyArtifact,
  NATIVE_OMML_FORMULA_ASSEMBLY_VERSION,
  NativeOmmlFormulaAssemblyError
} from "../packages/core/src/native-omml-formula-assembly.mjs";
import { assembleOrderedSlideDeck } from
  "../packages/core/src/ordered-slide-assembly.mjs";
import {
  writeAuthenticatedNativeCandidate,
  writeAuthenticatedNativeCandidateBundle,
  writeAuthenticatedOrderedCandidateBundle
} from "../packages/core/src/native-presentation-publication.mjs";
import {
  CandidateBuildRecordError,
  verifyCandidateBuildRecord
} from "../packages/core/src/candidate-build-record.mjs";
import { buildSecureTemplatePackageView } from
  "../packages/core/src/ooxml-package-view.mjs";
import { parseSecureZip } from "../packages/core/src/secure-zip.mjs";
import { resolveSlideLayoutIr } from "../packages/core/src/slide-layout-ir.mjs";
import { parseStrictXml } from "../packages/core/src/strict-xml.mjs";
import {
  formulaTransplantQaAssertions,
  preflightFormulaTransplant
} from "../packages/adapter-pandoc-omml/src/formula-transplant.mjs";
import { executeSourceSlideCloneFill } from
  "../plugins/clone-fill/src/source-slide-clone-fill.mjs";
import { buildSyntheticFixtures } from "../scripts/generate-synthetic-fixtures.mjs";
import {
  assertSupportedSchema,
  validateJson
} from "../scripts/lib/json-schema.mjs";

const NS = Object.freeze({
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  a14: "http://schemas.microsoft.com/office/drawing/2010/main",
  m: "http://schemas.openxmlformats.org/officeDocument/2006/math",
  mc: "http://schemas.openxmlformats.org/markup-compatibility/2006",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main"
});

const readJson = async (relativePath) => JSON.parse(await readFile(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8"
));

const registry = await readJson("fixtures/capabilities/formula-transplant/registry.json");
const cases = await readJson("fixtures/capabilities/formula-transplant/cases.json");
const inputSchema = await readJson("packages/adapter-pandoc-omml/schemas/input.schema.json");
const outputSchema = await readJson("packages/adapter-pandoc-omml/schemas/output.schema.json");
const templateIndex = deepFreeze(await readJson(
  "fixtures/inspection/expected-potx-template-index.json"
));
const definition = registry.capabilities[0];
const expectedOutput = cases.fixtures[0].expectedOutput;
const fixtureBuild = await buildSyntheticFixtures();
const sourceArchive = fixtureBuild.archives.find((archive) => archive.variant === "potx");
const coreSource = await readFile(
  new URL("../packages/core/src/native-omml-formula-assembly.mjs", import.meta.url),
  "utf8"
);

assertSupportedSchema(inputSchema);
assertSupportedSchema(outputSchema);

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

function staticFormulaOutput(invocation) {
  const output = clone(expectedOutput);
  const binding = invocation.bindings[0];
  output.outputSlideId = invocation.invocationId;
  output.clone.sourceSlideKey = binding.containerKey;
  output.replace.targetBindingId = binding.shapeBindingId;
  output.replace.targetShapeKey = binding.shapeKey;
  output.replace.expectedKind = binding.expectedKind;
  return output;
}

function makeRegistration(execute = staticFormulaOutput) {
  return {
    capabilityId: definition.capabilityId,
    capabilityVersion: definition.capabilityVersion,
    executor: {
      executorId: definition.executorId,
      preflight: preflightFormulaTransplant,
      execute
    },
    inputSchema: {
      schemaId: definition.inputSchemaId,
      schema: clone(inputSchema),
      validate(value) {
        return validateJson(value, inputSchema).length === 0;
      }
    },
    outputSchema: {
      schemaId: definition.outputSchemaId,
      schema: clone(outputSchema),
      validate(value) {
        return validateJson(value, outputSchema).length === 0;
      }
    },
    conformanceFixtures: clone(cases.fixtures),
    qaContract: {
      qaContractId: definition.qaContractId,
      assertions: [...formulaTransplantQaAssertions]
    }
  };
}

async function makeRuntime(execute) {
  return createCapabilityRuntime({
    capabilityRegistry: clone(registry),
    registrations: [makeRegistration(execute)],
    dependencies: {
      validateCapabilityRegistry() {
        return true;
      },
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

function invocation({
  invocationId = "formula-output-one",
  shapeKey = "shape-2",
  latex = "\\frac{a}{b}"
} = {}) {
  return {
    invocationId,
    capabilitySelectionId: "formula-transplant-selection",
    capabilityId: "formula-transplant",
    capabilityVersion: "0.1.0",
    experimentalOptIn: true,
    payload: { displayMode: "display", latex },
    bindings: [{
      role: "formula-target",
      shapeBindingId: "formula-target-binding",
      containerKind: "slide",
      containerKey: "slide-1",
      shapeKey,
      expectedKind: "text-box",
      cardinality: "exactly-one"
    }]
  };
}

function makeDispatchPlan(runtime, overrides) {
  return prepareCapabilityDispatch({
    runtime,
    invocations: [invocation(overrides)]
  });
}

function makeCloneFillPlan(outputSlideId = "formula-base-slide") {
  return deepFreeze(executeSourceSlideCloneFill({
    invocationId: outputSlideId,
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
  }));
}

const baseArtifact = assembleCloneFillPresentation({
  sourceArchiveBytes: sourceArchive.bytes,
  templateIndex,
  plan: makeCloneFillPlan()
});
const runtime = await makeRuntime();

function assertFormulaError(error, code, pointer) {
  assert.ok(error instanceof NativeOmmlFormulaAssemblyError);
  assert.equal(error.code, code);
  assert.equal(error.pointer, pointer);
  assert.deepEqual(error.toJSON(), { code, pointer });
  return true;
}

function collectNodes(root) {
  const output = [];
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    output.push(node);
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push(node.children[index]);
    }
  }
  return output;
}

function attribute(node, namespaceURI, localName) {
  return node.attributes.get(`${namespaceURI}\u0000${localName}`)?.value;
}

test("typed OMML replacement persists constraints and changes only its target slide", async () => {
  assert.equal(NATIVE_OMML_FORMULA_ASSEMBLY_VERSION, "0.1.0");
  const baseBefore = Buffer.from(baseArtifact.archiveBytes);
  const result = await assembleNativeOmmlFormulaOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });

  assert.ok(baseArtifact.archiveBytes.equals(baseBefore));
  assert.equal(result.report.artifactType, "native-omml-formula-assembled-pptx");
  assert.equal(
    result.report.verificationProfile,
    "target-specific-native-omml-formula-output"
  );
  assert.equal(result.report.publicationEligible, false);
  assert.equal(result.report.outputSlideId, "formula-output-one");
  assert.equal(result.report.baseOutputSha256, digest(baseArtifact.archiveBytes));
  assert.equal(result.report.outputSha256, digest(result.archiveBytes));
  assert.equal(result.report.formulaDigest, digest(Buffer.from(
    expectedOutput.formula.unboundOmmlFragment,
    "utf8"
  )));
  assert.deepEqual(result.report.formulaTarget.geometry, {
    x: 1371600,
    y: 2971800,
    cx: 9448800,
    cy: 914400
  });
  assert.deepEqual(result.report.formulaTarget.capacity, {
    maxElements: 64,
    maxRuns: 16,
    maxTextBytes: 256
  });
  assert.equal(result.report.formulaTarget.status, "pass");
  assert.equal(result.report.layoutIr.inputProfile, "bounded-slot-placement");
  assert.deepEqual(result.report.layoutIr.slots, [{
    slotId: "formula-target-binding",
    parentNodeId: "slide-canvas",
    outerBox: { x: 1371600, y: 2971800, cx: 9448800, cy: 914400 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    contentBox: { x: 1371600, y: 2971800, cx: 9448800, cy: 914400 },
    alignX: "center",
    alignY: "center",
    allowedSourceKind: "native-component",
    allowedSourceRef: "native-omml-formula",
    overflowPolicy: "reject",
    capacity: { minChildren: 1, maxChildren: 1 }
  }]);
  assert.deepEqual(result.report.layoutIr.placementRequests, [{
    nodeId: "formula-output-one",
    sourceKind: "native-component",
    sourceRef: "native-omml-formula",
    role: "content",
    slotRef: "formula-target-binding",
    size: { cx: 9448800, cy: 914400 },
    paintOutsetEmu: 0,
    zOrder: 1,
    placementIntent: "slot-aligned-fixed"
  }]);
  assert.equal(result.report.composedSlidePlan.constraintReceipt.status, "pass");
  assert.deepEqual(
    resolveSlideLayoutIr(JSON.parse(JSON.stringify(result.report.layoutIr))),
    result.report.composedSlidePlan
  );
  assert.deepEqual(result.report.diff, {
    addedParts: [],
    removedParts: [],
    modifiedParts: ["ppt/slides/slide1.xml"],
    allowedChanges: [{
      partPath: "ppt/slides/slide1.xml",
      reason: "native-omml-formula-replacement"
    }],
    collateralChanges: []
  });

  const baseParts = parseSecureZip(baseArtifact.archiveBytes);
  const outputParts = parseSecureZip(result.archiveBytes);
  for (const [partPath, bytes] of baseParts) {
    if (partPath !== "ppt/slides/slide1.xml") {
      assert.ok(Buffer.from(bytes).equals(outputParts.get(partPath)), `${partPath} changed`);
    }
  }
});

test("source-preserving OMML assembly keeps unchanged authored template content", async () => {
  const sourceBefore = Buffer.from(sourceArchive.bytes);
  const first = await assembleNativeOmmlFormulaFromSource({
    sourceArchiveBytes: sourceArchive.bytes,
    templateIndex,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const second = await assembleNativeOmmlFormulaFromSource({
    sourceArchiveBytes: sourceArchive.bytes,
    templateIndex,
    dispatchPlan: makeDispatchPlan(runtime)
  });

  assert.ok(sourceArchive.bytes.equals(sourceBefore));
  assert.ok(first.archiveBytes.equals(second.archiveBytes));
  assert.deepEqual(first.report, second.report);
  const sourceParts = parseSecureZip(sourceArchive.bytes);
  const outputParts = parseSecureZip(first.archiveBytes);
  assert.deepEqual([...sourceParts.keys()].sort(), [...outputParts.keys()].sort());
  assert.deepEqual([...sourceParts.keys()].filter((partName) =>
    !Buffer.from(sourceParts.get(partName)).equals(outputParts.get(partName))).sort(), [
    "[Content_Types].xml",
    "ppt/slides/slide1.xml"
  ]);

  const root = parseStrictXml(outputParts.get("ppt/slides/slide1.xml")).root;
  const text = collectNodes(root)
    .filter((node) => node.namespaceURI === NS.a && node.localName === "t")
    .map((node) => node.text);
  assert.ok(text.includes("Synthetic Fixture"));
  assert.equal(text.includes("Typed OMML remains native"), false);
  assert.deepEqual(collectNodes(root)
    .filter((node) => node.namespaceURI === NS.m && node.localName === "t")
    .map((node) => node.text), ["a", "b"]);
});

test("serialized slide contains one typed a14 math choice with editable fallback", async () => {
  const result = await assembleNativeOmmlFormulaOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const slideBytes = parseSecureZip(result.archiveBytes).get("ppt/slides/slide1.xml");
  const slideXml = Buffer.from(slideBytes).toString("utf8");
  const root = parseStrictXml(slideBytes).root;
  const nodes = collectNodes(root);
  const mathZones = nodes.filter((node) => node.namespaceURI === NS.a14 &&
    node.localName === "m");
  const formulas = nodes.filter((node) => node.namespaceURI === NS.m &&
    node.localName === "oMath");
  const formulaRuns = nodes.filter((node) => node.namespaceURI === NS.m &&
    node.localName === "r");
  const mathParagraphs = nodes.filter((node) => node.namespaceURI === NS.m &&
    node.localName === "oMathPara");
  const alternates = nodes.filter((node) => node.namespaceURI === NS.mc &&
    node.localName === "AlternateContent");
  const choices = nodes.filter((node) => node.namespaceURI === NS.mc &&
    node.localName === "Choice");
  const fallbacks = nodes.filter((node) => node.namespaceURI === NS.mc &&
    node.localName === "Fallback");
  const choiceNodes = collectNodes(choices[0]);
  const fallbackNodes = collectNodes(fallbacks[0]);

  assert.equal(root.attributes.size, 0);
  assert.equal(mathZones.length, 1);
  assert.equal(formulas.length, 1);
  assert.equal(mathParagraphs.length, 1);
  assert.equal(mathZones[0].children.length, 1);
  assert.equal(mathZones[0].children[0], mathParagraphs[0]);
  assert.equal(mathParagraphs[0].children.length, 2);
  assert.equal(mathParagraphs[0].children[1], formulas[0]);
  assert.equal(alternates.length, 1);
  assert.deepEqual(alternates[0].children, [choices[0], fallbacks[0]]);
  assert.equal(attribute(choices[0], "", "Requires"), "a14");
  assert.equal(formulaRuns.length, 2);
  assert.equal(formulaRuns.every((run) => run.children[0].namespaceURI === NS.a &&
    run.children[0].localName === "rPr"), true);
  assert.equal(choiceNodes.filter((node) => node.namespaceURI === NS.p &&
    node.localName === "cNvSpPr").every((node) =>
    attribute(node, "", "txBox") === undefined), true);
  assert.equal(fallbackNodes.filter((node) => node.namespaceURI === NS.p &&
    node.localName === "cNvSpPr").every((node) =>
    attribute(node, "", "txBox") === "1"), true);
  assert.equal(choiceNodes.filter((node) => node.namespaceURI === NS.a &&
    node.localName === "rPr").every((node) => attribute(node, "", "sz") === "4800"), true);
  assert.equal(fallbackNodes.filter((node) => node.namespaceURI === NS.a &&
    (node.localName === "rPr" || node.localName === "endParaRPr")).every((node) =>
    attribute(node, "", "sz") === "4800"), true);
  assert.equal(nodes.some((node) => node.namespaceURI === NS.a &&
    node.localName === "latin" && attribute(node, "", "typeface") === "Cambria Math"), true);
  assert.deepEqual(nodes.filter((node) => node.namespaceURI === NS.m &&
    node.localName === "t").map((node) => node.text), ["a", "b"]);
  assert.equal(nodes.some((node) => node.namespaceURI === NS.p &&
    node.localName === "pic"), false);
  assert.equal(nodes.some((node) => node.namespaceURI === NS.a &&
    node.localName === "blip"), false);
  assert.deepEqual(fallbackNodes
    .filter((node) => node.namespaceURI === NS.a && node.localName === "t")
    .map((node) => node.text), ["(a) / (b)"]);
  assert.equal(fallbackNodes.some((node) =>
    node.namespaceURI === NS.m || node.namespaceURI === NS.a14), false);
  assert.match(slideXml, /<mc:AlternateContent xmlns:mc=/u);
  assert.match(slideXml, /<mc:Choice xmlns:a14=.* Requires="a14">/u);
  assert.match(slideXml, /<m:oMathPara xmlns:m=/u);
  assert.equal(slideXml.includes(expectedOutput.formula.unboundOmmlFragment), false);
});

test("formula application is byte deterministic while dispatch plans remain one-shot", async () => {
  const firstPlan = makeDispatchPlan(runtime);
  const first = await assembleNativeOmmlFormulaOnCloneFill({
    baseArtifact,
    dispatchPlan: firstPlan
  });
  const second = await assembleNativeOmmlFormulaOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  assert.ok(first.archiveBytes.equals(second.archiveBytes));
  assert.deepEqual(first.report, second.report);

  await assert.rejects(
    assembleNativeOmmlFormulaOnCloneFill({ baseArtifact, dispatchPlan: firstPlan }),
    (error) => error instanceof CapabilityRuntimeError &&
      error.code === "CAPABILITY_RUNTIME_PLAN_CONSUMED" && error.pointer === "/plan"
  );
});

test("semantic formula target mismatch fails closed", async () => {
  await assert.rejects(
    assembleNativeOmmlFormulaOnCloneFill({
      baseArtifact,
      dispatchPlan: makeDispatchPlan(runtime, { shapeKey: "shape-9" })
    }),
    (error) => assertFormulaError(
      error,
      "NATIVE_OMML_FORMULA_ASSEMBLY_TARGET_INVALID",
      "/output/replace/targetShapeKey"
    )
  );
});

test("dispatcher schema and QA reject formula drift before typed application", async () => {
  const driftRuntime = await makeRuntime((request) => {
    const output = staticFormulaOutput(request);
    if (request.invocationId === "formula-drift-output") {
      output.formula.insertable = true;
    }
    return output;
  });
  await assert.rejects(
    assembleNativeOmmlFormulaOnCloneFill({
      baseArtifact,
      dispatchPlan: makeDispatchPlan(driftRuntime, {
        invocationId: "formula-drift-output",
        latex: "a+b"
      })
    }),
    (error) => error instanceof CapabilityRuntimeError &&
      error.code === "CAPABILITY_RUNTIME_OUTPUT_INVALID"
  );
});

test("formula target capacity is stricter than the general adapter contract", async () => {
  const oversizedFragment = `<m:oMath xmlns:m="${NS.m}">` +
    Array.from({ length: 17 }, (_, index) => `<m:r><m:t>${index}</m:t></m:r>`).join("") +
    "</m:oMath>";
  const capacityRuntime = await makeRuntime((request) => {
    const output = staticFormulaOutput(request);
    if (request.invocationId === "formula-capacity-output") {
      output.formula.unboundOmmlFragment = oversizedFragment;
    }
    return output;
  });
  await assert.rejects(
    assembleNativeOmmlFormulaOnCloneFill({
      baseArtifact,
      dispatchPlan: makeDispatchPlan(capacityRuntime, {
        invocationId: "formula-capacity-output",
        latex: "a+b"
      })
    }),
    (error) => assertFormulaError(
      error,
      "NATIVE_OMML_FORMULA_ASSEMBLY_TARGET_INVALID",
      "/output/formula/capacity"
    )
  );
});

test("formula artifact authority binds report identity and detached byte snapshots", async () => {
  const artifact = await assembleNativeOmmlFormulaOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const authenticated = authenticateNativeOmmlFormulaAssemblyArtifact(artifact);
  assert.equal(authenticated.authority.artifactType, "native-omml-formula-assembled-pptx");
  assert.equal(
    authenticated.authority.authenticatedPublicationProfile,
    "direct-native-omml-artifact-only"
  );
  assert.ok(authenticated.archiveBytes.equals(artifact.archiveBytes));
  authenticated.archiveBytes.fill(0);
  const repeated = authenticateNativeOmmlFormulaAssemblyArtifact(artifact);
  assert.ok(repeated.archiveBytes.equals(artifact.archiveBytes));

  assert.throws(
    () => authenticateNativeOmmlFormulaAssemblyArtifact({
      archiveBytes: artifact.archiveBytes,
      report: structuredClone(artifact.report)
    }),
    (error) => assertFormulaError(
      error,
      "NATIVE_OMML_FORMULA_ASSEMBLY_ARGUMENT_INVALID",
      "/artifact/report"
    )
  );
  assert.throws(
    () => authenticateNativeOmmlFormulaAssemblyArtifact({
      archiveBytes: baseArtifact.archiveBytes,
      report: artifact.report
    }),
    (error) => assertFormulaError(
      error,
      "NATIVE_OMML_FORMULA_ASSEMBLY_SOURCE_MISMATCH",
      "/artifact/archiveBytes"
    )
  );
});

test("base artifact authentication copies before hashing shared-memory bytes", async () => {
  const sharedStorage = new SharedArrayBuffer(baseArtifact.archiveBytes.length);
  const sharedBytes = Buffer.from(sharedStorage);
  baseArtifact.archiveBytes.copy(sharedBytes);
  const sharedBase = { archiveBytes: sharedBytes, report: baseArtifact.report };
  const originalFrom = Buffer.from;
  let intercepted = false;
  Buffer.from = function patchedBufferFrom(value, ...rest) {
    if (!intercepted && value === sharedBytes) {
      intercepted = true;
      sharedBytes[0] ^= 0xff;
    }
    return Reflect.apply(originalFrom, Buffer, [value, ...rest]);
  };
  try {
    await assert.rejects(
      assembleNativeOmmlFormulaOnCloneFill({
        baseArtifact: sharedBase,
        dispatchPlan: makeDispatchPlan(runtime)
      }),
      (error) => assertFormulaError(
        error,
        "NATIVE_OMML_FORMULA_ASSEMBLY_SOURCE_MISMATCH",
        "/baseArtifact"
      )
    );
    assert.equal(intercepted, true);
  } finally {
    Buffer.from = originalFrom;
  }
});

test("candidate writer accepts exact OMML artifacts without granting delivery authority", async () => {
  const artifact = await assembleNativeOmmlFormulaOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "omml-candidate-")));
  const destinationPath = path.join(directory, "formula-candidate.pptx");
  try {
    const candidate = await writeAuthenticatedNativeCandidate({ artifact, destinationPath });
    assert.deepEqual(candidate, {
      candidateVersion: "0.1.0",
      artifactType: "candidate-pptx",
      verificationProfile: "authenticated-native-candidate-artifact",
      deliveryEligible: false,
      sourceArtifactType: "native-omml-formula-assembled-pptx",
      sourceVerificationProfile: "target-specific-native-omml-formula-output",
      bytes: artifact.archiveBytes.length,
      sha256: digest(artifact.archiveBytes)
    });
    assert.ok((await readFile(destinationPath)).equals(artifact.archiveBytes));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("OMML candidate bundle preserves formula target constraints and binds exact bytes", async () => {
  const artifact = await assembleNativeOmmlFormulaOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const firstDirectory = await realpath(await mkdtemp(path.join(os.tmpdir(), "omml-bundle-a-")));
  const secondDirectory = await realpath(await mkdtemp(path.join(os.tmpdir(), "omml-bundle-b-")));
  const firstDestination = path.join(firstDirectory, "formula-candidate.pptx");
  const secondDestination = path.join(secondDirectory, "formula-candidate.pptx");
  const firstRecord = path.join(firstDirectory, "formula-candidate.candidate.json");
  const secondRecord = path.join(secondDirectory, "formula-candidate.candidate.json");
  try {
    const firstResult = await writeAuthenticatedNativeCandidateBundle({
      artifact,
      destinationPath: firstDestination
    });
    const secondResult = await writeAuthenticatedNativeCandidateBundle({
      artifact,
      destinationPath: secondDestination
    });
    const [candidateBytes, firstRecordBytes, secondRecordBytes] = await Promise.all([
      readFile(firstDestination),
      readFile(firstRecord),
      readFile(secondRecord)
    ]);
    assert.ok(firstRecordBytes.equals(secondRecordBytes));
    assert.deepEqual(firstResult, secondResult);
    const verified = verifyCandidateBuildRecord({
      candidateBytes,
      recordBytes: firstRecordBytes,
      candidateFileName: "formula-candidate.pptx"
    });
    assert.equal(verified.record.sourceArtifactType, "native-omml-formula-assembled-pptx");
    assert.equal(
      verified.record.slide.capabilityEvidence.formulaDigest,
      artifact.report.formulaDigest
    );
    assert.deepEqual(
      verified.record.slide.capabilityEvidence.formulaTarget,
      artifact.report.formulaTarget
    );
    assert.deepEqual(
      resolveSlideLayoutIr(verified.record.slide.layoutIr),
      verified.record.slide.composedSlidePlan
    );

    const tamperedCandidate = Buffer.from(candidateBytes);
    tamperedCandidate[tamperedCandidate.length - 1] ^= 1;
    assert.throws(
      () => verifyCandidateBuildRecord({
        candidateBytes: tamperedCandidate,
        recordBytes: firstRecordBytes,
        candidateFileName: "formula-candidate.pptx"
      }),
      (error) => error instanceof CandidateBuildRecordError &&
        error.code === "CANDIDATE_BUILD_RECORD_ARTIFACT_MISMATCH" &&
        error.pointer === "/output/sha256"
    );
  } finally {
    await Promise.all([
      rm(firstDirectory, { recursive: true, force: true }),
      rm(secondDirectory, { recursive: true, force: true })
    ]);
  }
});

test("ordered assembly and candidate records preserve exact typed OMML slides", async () => {
  const artifact = await assembleNativeOmmlFormulaOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const ordered = assembleOrderedSlideDeck({ slides: [baseArtifact, artifact] });
  const formulaFirst = assembleOrderedSlideDeck({ slides: [artifact, baseArtifact] });
  const repeatedFormulaFirst = assembleOrderedSlideDeck({ slides: [artifact, baseArtifact] });
  assert.ok(repeatedFormulaFirst.archiveBytes.equals(formulaFirst.archiveBytes));
  assert.deepEqual(repeatedFormulaFirst.report, formulaFirst.report);
  assert.equal(ordered.report.verificationProfile, "authenticated-native-ordered-output");
  assert.equal(ordered.report.containsTargetSpecificNative, true);
  assert.equal(ordered.report.genericPublicationEligible, false);
  assert.deepEqual(
    formulaFirst.report.slides.map((slide) => slide.outputSlideId),
    [artifact.report.outputSlideId, baseArtifact.report.outputSlideId]
  );

  const baseParts = parseSecureZip(baseArtifact.archiveBytes);
  const formulaParts = parseSecureZip(artifact.archiveBytes);
  const orderedParts = parseSecureZip(ordered.archiveBytes);
  assert.ok(orderedParts.get("ppt/slides/slide1.xml").equals(
    baseParts.get("ppt/slides/slide1.xml")
  ));
  assert.ok(orderedParts.get("ppt/slides/slide2.xml").equals(
    formulaParts.get("ppt/slides/slide1.xml")
  ));

  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "omml-ordered-")));
  const destinationPath = path.join(directory, "formula-ordered.pptx");
  const recordPath = path.join(directory, "formula-ordered.candidate.json");
  try {
    const result = await writeAuthenticatedOrderedCandidateBundle({
      artifact: formulaFirst,
      destinationPath
    });
    const [candidateBytes, recordBytes] = await Promise.all([
      readFile(destinationPath),
      readFile(recordPath)
    ]);
    const verified = verifyCandidateBuildRecord({
      candidateBytes,
      recordBytes,
      candidateFileName: "formula-ordered.pptx"
    });
    assert.equal(result.verificationProfile, "authenticated-ordered-candidate-artifact");
    assert.equal(result.sourceVerificationProfile, "authenticated-native-ordered-output");
    assert.equal(
      verified.record.baseArtifactSha256,
      digest(artifact.archiveBytes)
    );
    const formulaSource = verified.record.deck.slides[0].sourceBuild;
    assert.equal(formulaSource.buildType, "native-omml-formula-source");
    assert.equal(formulaSource.artifactType, artifact.report.artifactType);
    assert.equal(formulaSource.verificationProfile, artifact.report.verificationProfile);
    assert.equal(formulaSource.baseArtifactSha256, artifact.report.baseOutputSha256);
    assert.equal(formulaSource.sourceSlidePart, artifact.report.slidePart);
    assert.deepEqual(formulaSource.layoutIr, artifact.report.layoutIr);
    assert.deepEqual(formulaSource.composedSlidePlan, artifact.report.composedSlidePlan);
    assert.deepEqual(formulaSource.diff, artifact.report.diff);
    assert.deepEqual(formulaSource.capabilityEvidence, {
      evidenceType: "native-omml-formula",
      formulaDigest: artifact.report.formulaDigest,
      formulaTarget: artifact.report.formulaTarget
    });
    assert.equal(Object.hasOwn(verified.record.deck, "nativeSlideCount"), false);
    assert.equal(Object.hasOwn(verified.record.deck, "sourceProfile"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("ordered assembly rejects copied typed OMML report authority", async () => {
  const artifact = await assembleNativeOmmlFormulaOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  assert.throws(
    () => assembleOrderedSlideDeck({
      slides: [baseArtifact, {
        archiveBytes: artifact.archiveBytes,
        report: { ...artifact.report }
      }]
    }),
    (error) => error?.code === "ORDERED_SLIDE_ASSEMBLY_SOURCE_MISMATCH" &&
      error.pointer === "/slides/1/report"
  );
});

test("generic package and publication paths remain fail-closed for OMML extensions", async () => {
  const artifact = await assembleNativeOmmlFormulaOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  assert.throws(
    () => buildSecureTemplatePackageView({
      sourceLocation: path.resolve("/target-specific-omml-output.pptx"),
      archiveBytes: artifact.archiveBytes
    }),
    (error) => error?.code === "OOXML_UNHANDLED_FEATURE"
  );
  await assert.rejects(
    publishCreateOnlyPresentation({
      archiveBytes: artifact.archiveBytes,
      destinationPath: path.resolve("/not-created-omml-output.pptx")
    }),
    (error) => error?.code === "ASSEMBLY_OUTPUT_INVALID"
  );
});

test("core OMML applicator stays adapter-isolated and never concatenates an XML exemplar", () => {
  assert.doesNotMatch(coreSource, /adapter-pandoc-omml|node:child_process/u);
  assert.doesNotMatch(coreSource, /<m:oMath/u);
  assert.doesNotMatch(coreSource, /p:pic|a:blip|base64|data:image/u);
  assert.match(coreSource, /parseTypedOmml\(component\.fragment\)/u);
  assert.match(coreSource, /makeElement\(NS\.a14, "m"/u);
});
