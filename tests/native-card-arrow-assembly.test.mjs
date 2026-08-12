import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, open, readFile, realpath, readdir, rm, symlink, writeFile } from "node:fs/promises";
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
  allocateNativeCardArrowShapeIds,
  assembleNativeCardArrowFromSlot,
  assembleNativeCardArrowOnCloneFill,
  authenticateNativeCardArrowAssemblyArtifact,
  NATIVE_CARD_ARROW_ASSEMBLY_VERSION,
  NativeCardArrowAssemblyError
} from "../packages/core/src/native-card-arrow-assembly.mjs";
import {
  createNativeCardArrowSlotPlacement,
  NATIVE_CARD_ARROW_PLACEMENT_VERSION,
  NativeCardArrowPlacementError
} from "../packages/core/src/native-card-arrow-placement.mjs";
import {
  NATIVE_PRESENTATION_CANDIDATE_VERSION,
  NATIVE_PRESENTATION_PUBLICATION_VERSION,
  NativePresentationPublicationError,
  publishAuthenticatedNativePresentation,
  writeAuthenticatedNativeCandidate,
  writeAuthenticatedNativeCandidateBundle,
  writeAuthenticatedOrderedCandidateBundle
} from "../packages/core/src/native-presentation-publication.mjs";
import {
  CandidateBuildRecordError,
  verifyCandidateBuildRecord
} from "../packages/core/src/candidate-build-record.mjs";
import { createAuthenticatedNativeCardCandidateSnapshot } from
  "../packages/core/src/native-card-candidate-publication.mjs";
import {
  assessNativeCardCandidate,
  NATIVE_CARD_CANDIDATE_QA_MAX_PPTX_BYTES,
  NativeCardCandidateQaError
} from "../packages/core/src/native-card-candidate-qa.mjs";
import {
  assembleOrderedSlideDeck,
  authenticateOrderedSlideAssemblyArtifact,
  OrderedSlideAssemblyError
} from "../packages/core/src/ordered-slide-assembly.mjs";
import { buildSecureTemplatePackageView } from "../packages/core/src/ooxml-package-view.mjs";
import { parseSecureZip } from "../packages/core/src/secure-zip.mjs";
import { resolveSlideLayoutIr } from "../packages/core/src/slide-layout-ir.mjs";
import {
  parseStrictXml,
  STRICT_XML_LIMITS
} from "../packages/core/src/strict-xml.mjs";
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
  validateJson
} from "../scripts/lib/json-schema.mjs";

const readJson = async (relativePath) => JSON.parse(await readFile(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8"
));

const registry = await readJson("fixtures/capabilities/native-card-arrow/registry.json");
const cases = await readJson("fixtures/capabilities/native-card-arrow/cases.json");
const nativeDeck = await readJson("fixtures/capabilities/native-card-arrow/deck-spec.json");
const inputSchema = await readJson("plugins/native-card-arrow/schemas/input.schema.json");
const outputSchema = await readJson("plugins/native-card-arrow/schemas/output.schema.json");
const templateIndex = deepFreeze(await readJson(
  "fixtures/inspection/expected-potx-template-index.json"
));

async function syncTestDirectory(directory) {
  if (process.platform === "win32") return;
  const handle = await open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
const fixtureBuild = await buildSyntheticFixtures();
const sourceArchive = fixtureBuild.archives.find((archive) => archive.variant === "potx");
const definition = registry.capabilities[0];
const coreSource = await readFile(
  new URL("../packages/core/src/native-card-arrow-assembly.mjs", import.meta.url),
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

function makeRegistration(execute = executeNativeCardArrow) {
  return {
    capabilityId: definition.capabilityId,
    capabilityVersion: definition.capabilityVersion,
    executor: {
      executorId: definition.executorId,
      preflight: preflightNativeCardArrow,
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
      assertions: [...nativeCardArrowQaAssertions]
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
          supportMatrixItemId: "native-drawingml",
          supportClaimsEnabled: false,
          status: "experimental",
          disposition: "accept-with-warning"
        };
      }
    }
  });
}

function invocation({
  invocationId = "native-card-arrow-output-one",
  containerKey = "slide-1",
  shapeKey = "shape-2",
  geometry = { ...nativeDeck.slides[1].payload.geometry, y: 4_000_000 },
  label = nativeDeck.slides[0].payload.label,
  style = nativeDeck.slides[0].payload.style
} = {}) {
  return {
    invocationId,
    capabilitySelectionId: "native-card-arrow-selection",
    capabilityId: "native-card-arrow",
    capabilityVersion: "0.1.0",
    experimentalOptIn: true,
    payload: {
      geometry: clone(geometry),
      label,
      style: clone(style)
    },
    bindings: [{
      role: "anchor",
      shapeBindingId: "card-arrow-anchor-binding",
      containerKind: "slide",
      containerKey,
      shapeKey,
      expectedKind: "text-box",
      cardinality: "exactly-one"
    }]
  };
}

function placementRequest({
  outputSlideId = "native-card-arrow-output-one",
  preferredSize = nativeDeck.slides[0].payload.geometry
} = {}) {
  return {
    placementVersion: NATIVE_CARD_ARROW_PLACEMENT_VERSION,
    outputSlideId,
    slotRef: "slide-content-tail",
    placementIntent: "slot-aligned-fixed",
    preferredSize: {
      cx: preferredSize.cx,
      cy: preferredSize.cy
    }
  };
}

function makeDispatchPlan(runtime, invocationOverrides) {
  return prepareCapabilityDispatch({
    runtime,
    invocations: [invocation(invocationOverrides)]
  });
}

function makeCloneFillPlan(outputSlideId = "clone-fill-base-slide") {
  return deepFreeze(executeSourceSlideCloneFill({
    invocationId: outputSlideId,
    payload: {
      body: ["Edit/save and accessibility checks remain"],
      title: "Controls ready: 87%"
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

function assertNativeError(error, code, pointer) {
  assert.ok(error instanceof NativeCardArrowAssemblyError);
  assert.equal(error.code, code);
  assert.equal(error.pointer, pointer);
  assert.deepEqual(error.toJSON(), { code, pointer });
  return true;
}

function assertOrderedError(error, code, pointer) {
  assert.ok(error instanceof OrderedSlideAssemblyError);
  assert.equal(error.code, code);
  assert.equal(error.pointer, pointer);
  return true;
}

function assertPublicationError(error, code, pointer) {
  assert.ok(error instanceof NativePresentationPublicationError);
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

function directShapeId(shape) {
  const cNvPr = collectNodes(shape).find((node) =>
    node.namespaceURI === "http://schemas.openxmlformats.org/presentationml/2006/main" &&
    node.localName === "cNvPr");
  return cNvPr === undefined ? undefined : Number(attribute(cNvPr, "", "id"));
}

test("M2-005C rebuilds one dispatched typed native group with exact package diff", async () => {
  assert.equal(NATIVE_CARD_ARROW_ASSEMBLY_VERSION, "0.2.0");
  const baseBefore = Buffer.from(baseArtifact.archiveBytes);
  const result = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });

  assert.ok(baseArtifact.archiveBytes.equals(baseBefore));
  assert.equal(result.report.artifactType, "native-card-arrow-assembled-pptx");
  assert.equal(result.report.verificationProfile, "target-specific-native-card-arrow-output");
  assert.equal(result.report.publicationEligible, false);
  assert.equal(result.report.outputSlideId, "native-card-arrow-output-one");
  assert.equal(result.report.baseOutputSha256, digest(baseArtifact.archiveBytes));
  assert.equal(result.report.outputSha256, digest(result.archiveBytes));
  assert.equal(result.report.slidePart, "ppt/slides/slide1.xml");
  assert.equal(result.report.layoutIr.layoutIrType, "slide-layout-ir");
  assert.equal(result.report.layoutIr.inputProfile, "fixed-absolute-bridge");
  assert.equal(result.report.composedSlidePlan.planType, "composed-slide-plan");
  assert.equal(result.report.composedSlidePlan.constraintReceipt.status, "pass");
  assert.equal(
    result.report.composedSlidePlan.constraintReceipt.occupancyChecks
      .every((check) => check.status === "clear"),
    true
  );
  assert.deepEqual(result.report.allocatedShapeIds, [4, 5, 6]);
  assert.deepEqual(result.report.diff, {
    addedParts: [],
    removedParts: [],
    modifiedParts: ["ppt/slides/slide1.xml"],
    allowedChanges: [{
      partPath: "ppt/slides/slide1.xml",
      reason: "native-card-arrow-insertion"
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
  const slide = parseStrictXml(outputParts.get("ppt/slides/slide1.xml")).root;
  const nodes = collectNodes(slide);
  const cNvPrIds = nodes
    .filter((node) => node.localName === "cNvPr")
    .map((node) => Number(attribute(node, "", "id")));
  assert.deepEqual(cNvPrIds, [1, 2, 3, 4, 5, 6]);
  const spTree = nodes.find((node) => node.localName === "spTree");
  assert.deepEqual(spTree.children.slice(2).map(directShapeId), [2, 3, 4]);
  const group = spTree.children[4];
  assert.equal(group.localName, "grpSp");
  assert.deepEqual(
    collectNodes(group)
      .filter((node) => node.localName === "prstGeom")
      .map((node) => attribute(node, "", "prst")),
    ["roundRect", "rightArrow"]
  );
  assert.deepEqual(
    collectNodes(group)
      .filter((node) => node.localName === "t")
      .map((node) => node.text),
    ["Public synthetic decision"]
  );
  assert.equal(
    collectNodes(group).some((node) => [...node.attributes.values()]
      .some((value) => value.namespaceURI ===
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships")),
    false
  );

  assert.throws(
    () => buildSecureTemplatePackageView({
      sourceLocation: path.resolve("/native-target-specific-output.pptx"),
      archiveBytes: result.archiveBytes
    }),
    (error) => error?.code === "OOXML_UNHANDLED_FEATURE"
  );
  await assert.rejects(
    publishCreateOnlyPresentation({
      archiveBytes: result.archiveBytes,
      destinationPath: path.resolve("/not-created-native-output.pptx")
    }),
    (error) => error?.code === "ASSEMBLY_OUTPUT_INVALID"
  );
});

test("native application rejects a component that occupies existing slide content", async () => {
  await assert.rejects(
    assembleNativeCardArrowOnCloneFill({
      baseArtifact,
      dispatchPlan: makeDispatchPlan(runtime, {
        geometry: nativeDeck.slides[0].payload.geometry
      })
    }),
    (error) => assertNativeError(
      error,
      "NATIVE_CARD_ARROW_ASSEMBLY_OCCUPANCY_CONFLICT",
      "/output/component/geometry"
    )
  );
});

test("product placement compiles slot intent, persists its constraints, and assembles exact geometry", async () => {
  const request = placementRequest();
  const placement = createNativeCardArrowSlotPlacement({ baseArtifact, request });
  assert.equal(placement.placementType, "native-card-arrow-slot-placement");
  assert.equal(placement.layoutIr.inputProfile, "bounded-slot-placement");
  assert.deepEqual(placement.slotDerivation.contentEnvelope, {
    x: 914400,
    y: 1285875,
    cx: 10363200,
    cy: 2600325
  });
  assert.deepEqual(placement.resolvedGeometry, {
    x: 1981200,
    y: 4000500,
    cx: 8229600,
    cy: 1828800
  });
  assert.deepEqual(
    resolveSlideLayoutIr(JSON.parse(JSON.stringify(placement.layoutIr))),
    placement.composedSlidePlan
  );

  const result = await assembleNativeCardArrowFromSlot({
    baseArtifact,
    placementRequest: request,
    dispatchPlan: makeDispatchPlan(runtime, { geometry: placement.resolvedGeometry })
  });
  assert.equal(result.report.placementRecord.request.slotRef, "slide-content-tail");
  assert.equal(result.report.layoutIr.inputProfile, "bounded-slot-placement");
  assert.equal(result.report.composedSlidePlan.planDigest, placement.composedSlidePlan.planDigest);
  assert.deepEqual(
    result.report.composedSlidePlan.constraintReceipt.slotChecks,
    [{
      nodeId: "native-card-arrow-output-one",
      slotId: "slide-content-tail",
      status: "pass"
    }]
  );
});

test("product slot placement fails closed on geometry drift and impossible capacity", async () => {
  const request = placementRequest();
  const placement = createNativeCardArrowSlotPlacement({ baseArtifact, request });
  await assert.rejects(
    assembleNativeCardArrowFromSlot({
      baseArtifact,
      placementRequest: request,
      dispatchPlan: makeDispatchPlan(runtime, {
        geometry: { ...placement.resolvedGeometry, x: placement.resolvedGeometry.x + 1 }
      })
    }),
    (error) => assertNativeError(
      error,
      "NATIVE_CARD_ARROW_ASSEMBLY_DISPATCH_INVALID",
      "/output/component/geometry"
    )
  );

  assert.throws(
    () => createNativeCardArrowSlotPlacement({
      baseArtifact,
      request: placementRequest({ preferredSize: { cx: 11_000_000, cy: 2_000_000 } })
    }),
    (error) => error instanceof NativeCardArrowPlacementError &&
      error.code === "NATIVE_CARD_ARROW_PLACEMENT_CONSTRAINT_INVALID" &&
      error.pointer === "/request/preferredSize"
  );
});

test("native application is byte deterministic while each dispatch plan stays one-shot", async () => {
  const firstPlan = makeDispatchPlan(runtime);
  const first = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: firstPlan
  });
  const second = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  assert.ok(first.archiveBytes.equals(second.archiveBytes));
  assert.deepEqual(first.report, second.report);

  await assert.rejects(
    assembleNativeCardArrowOnCloneFill({ baseArtifact, dispatchPlan: firstPlan }),
    (error) => error instanceof CapabilityRuntimeError &&
      error.code === "CAPABILITY_RUNTIME_PLAN_CONSUMED" && error.pointer === "/plan"
  );
});

test("native artifact authority binds report identity and returns detached verification snapshots", async () => {
  const nativeArtifact = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const authenticated = authenticateNativeCardArrowAssemblyArtifact(nativeArtifact);
  assert.equal(authenticated.authority.artifactType, "native-card-arrow-assembled-pptx");
  assert.equal(authenticated.authority.publicationEligible, false);
  assert.equal(
    authenticated.authority.authenticatedPublicationProfile,
    "direct-native-artifact-only"
  );
  assert.ok(authenticated.archiveBytes.equals(nativeArtifact.archiveBytes));
  assert.ok(authenticated.baseArchiveBytes.equals(baseArtifact.archiveBytes));
  authenticated.archiveBytes.fill(0);
  authenticated.baseArchiveBytes.fill(0);
  const repeated = authenticateNativeCardArrowAssemblyArtifact(nativeArtifact);
  assert.ok(repeated.archiveBytes.equals(nativeArtifact.archiveBytes));
  assert.ok(repeated.baseArchiveBytes.equals(baseArtifact.archiveBytes));

  const sharedStorage = new SharedArrayBuffer(nativeArtifact.archiveBytes.length);
  const sharedBytes = Buffer.from(sharedStorage);
  nativeArtifact.archiveBytes.copy(sharedBytes);
  const sharedAuthenticated = authenticateNativeCardArrowAssemblyArtifact({
    archiveBytes: sharedBytes,
    report: nativeArtifact.report
  });
  assert.equal(
    digest(sharedAuthenticated.archiveBytes),
    sharedAuthenticated.authority.outputSha256
  );
  sharedBytes.fill(0);
  assert.equal(
    digest(sharedAuthenticated.archiveBytes),
    sharedAuthenticated.authority.outputSha256
  );

  assert.throws(
    () => authenticateNativeCardArrowAssemblyArtifact({
      archiveBytes: nativeArtifact.archiveBytes,
      report: structuredClone(nativeArtifact.report)
    }),
    (error) => assertNativeError(
      error,
      "NATIVE_CARD_ARROW_ASSEMBLY_ARGUMENT_INVALID",
      "/artifact/report"
    )
  );
  assert.throws(
    () => authenticateNativeCardArrowAssemblyArtifact({
      archiveBytes: baseArtifact.archiveBytes,
      report: nativeArtifact.report
    }),
    (error) => assertNativeError(
      error,
      "NATIVE_CARD_ARROW_ASSEMBLY_SOURCE_MISMATCH",
      "/artifact/archiveBytes"
    )
  );
});

test("the authenticated native publisher snapshots before I/O and stays create-only", async () => {
  assert.equal(NATIVE_PRESENTATION_PUBLICATION_VERSION, "0.1.0");
  const nativeArtifact = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const directory = await realpath(await mkdtemp(
    path.join(os.tmpdir(), "native-presentation-publication-")
  ));
  const destinationPath = path.join(directory, "native-output.pptx");
  const callerBytes = Buffer.from(nativeArtifact.archiveBytes);
  try {
    const publicationPromise = publishAuthenticatedNativePresentation({
      artifact: { archiveBytes: callerBytes, report: nativeArtifact.report },
      destinationPath
    });
    callerBytes.fill(0);
    const publication = await publicationPromise;
    assert.deepEqual(publication, {
      publicationVersion: "0.1.0",
      artifactType: "published-pptx",
      verificationProfile: "authenticated-native-presentation-artifact",
      sourceArtifactType: "native-card-arrow-assembled-pptx",
      sourceVerificationProfile: "target-specific-native-card-arrow-output",
      bytes: nativeArtifact.archiveBytes.length,
      sha256: digest(nativeArtifact.archiveBytes)
    });
    assert.ok((await readFile(destinationPath)).equals(nativeArtifact.archiveBytes));
    assert.deepEqual(await readdir(directory), ["native-output.pptx"]);

    await assert.rejects(
      publishAuthenticatedNativePresentation({
        artifact: nativeArtifact,
        destinationPath
      }),
      (error) => assertPublicationError(
        error,
        "NATIVE_PRESENTATION_PUBLICATION_OUTPUT_EXISTS",
        "/destination"
      )
    );
    assert.ok((await readFile(destinationPath)).equals(nativeArtifact.archiveBytes));
    assert.deepEqual(await readdir(directory), ["native-output.pptx"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the explicit writer labels structural output as a non-deliverable candidate", async () => {
  assert.equal(NATIVE_PRESENTATION_CANDIDATE_VERSION, "0.1.0");
  const nativeArtifact = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const directory = await realpath(await mkdtemp(
    path.join(os.tmpdir(), "native-presentation-candidate-")
  ));
  const destinationPath = path.join(directory, "native-candidate.pptx");
  try {
    const candidate = await writeAuthenticatedNativeCandidate({
      artifact: nativeArtifact,
      destinationPath
    });
    assert.deepEqual(candidate, {
      candidateVersion: "0.1.0",
      artifactType: "candidate-pptx",
      verificationProfile: "authenticated-native-candidate-artifact",
      deliveryEligible: false,
      sourceArtifactType: "native-card-arrow-assembled-pptx",
      sourceVerificationProfile: "target-specific-native-card-arrow-output",
      bytes: nativeArtifact.archiveBytes.length,
      sha256: digest(nativeArtifact.archiveBytes)
    });
    assert.ok((await readFile(destinationPath)).equals(nativeArtifact.archiveBytes));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("candidate bundle persists and replays semantic-slot constraints beside exact PPTX bytes", async () => {
  const request = placementRequest();
  const placement = createNativeCardArrowSlotPlacement({ baseArtifact, request });
  const nativeArtifact = await assembleNativeCardArrowFromSlot({
    baseArtifact,
    placementRequest: request,
    dispatchPlan: makeDispatchPlan(runtime, { geometry: placement.resolvedGeometry })
  });
  const directory = await realpath(await mkdtemp(
    path.join(os.tmpdir(), "native-presentation-bundle-")
  ));
  const destinationPath = path.join(directory, "native-candidate.pptx");
  const recordPath = path.join(directory, "native-candidate.candidate.json");
  try {
    const result = await writeAuthenticatedNativeCandidateBundle({
      artifact: nativeArtifact,
      destinationPath
    });
    const [candidateBytes, recordBytes] = await Promise.all([
      readFile(destinationPath),
      readFile(recordPath)
    ]);
    const verified = verifyCandidateBuildRecord({
      candidateBytes,
      recordBytes,
      candidateFileName: "native-candidate.pptx"
    });
    assert.equal(result.deliveryEligible, false);
    assert.deepEqual(result.buildRecord, {
      schemaVersion: "0.1.0",
      contractType: "candidate-build-record",
      fileName: "native-candidate.candidate.json",
      bytes: recordBytes.length,
      sha256: digest(recordBytes)
    });
    assert.equal(verified.record.output.sha256, digest(candidateBytes));
    assert.equal(verified.record.output.byteLength, candidateBytes.length);
    assert.equal(verified.record.slide.layoutIr.inputProfile, "bounded-slot-placement");
    assert.deepEqual(
      resolveSlideLayoutIr(verified.record.slide.layoutIr),
      verified.record.slide.composedSlidePlan
    );
    assert.deepEqual(verified.record.slide.capabilityEvidence, {
      evidenceType: "native-card-arrow",
      allocatedShapeIds: nativeArtifact.report.allocatedShapeIds
    });
    assert.equal(recordBytes.includes(Buffer.from(directory)), false);

    const tampered = structuredClone(verified.record);
    tampered.slide.composedSlidePlan.nodes.at(-1).box.x += 1;
    await assert.rejects(
      Promise.resolve().then(() => verifyCandidateBuildRecord({
        candidateBytes,
        recordBytes: Buffer.from(`${JSON.stringify(tampered, null, 2)}\n`),
        candidateFileName: "native-candidate.pptx"
      })),
      (error) => error instanceof CandidateBuildRecordError &&
        error.code === "CANDIDATE_BUILD_RECORD_REPLAY_MISMATCH" &&
        error.pointer === "/slide/composedSlidePlan"
    );

    const wrongCapability = structuredClone(verified.record);
    wrongCapability.slide.layoutIr.slots[0].allowedSourceRef = "native-omml-formula";
    wrongCapability.slide.layoutIr.placementRequests[0].sourceRef = "native-omml-formula";
    wrongCapability.slide.layoutIr.nodes.find((node) =>
      node.sourceKind === "native-component").sourceRef = "native-omml-formula";
    wrongCapability.slide.composedSlidePlan = resolveSlideLayoutIr(
      wrongCapability.slide.layoutIr
    );
    assert.throws(
      () => verifyCandidateBuildRecord({
        candidateBytes,
        recordBytes: Buffer.from(`${JSON.stringify(wrongCapability, null, 2)}\n`),
        candidateFileName: "native-candidate.pptx"
      }),
      (error) => error instanceof CandidateBuildRecordError &&
        error.code === "CANDIDATE_BUILD_RECORD_REPLAY_MISMATCH" &&
        error.pointer === "/slide/layoutIr/placementRequests/0/sourceRef"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("candidate QA is a pure exact projection with a fail-closed contract boundary", async () => {
  const request = placementRequest();
  const placement = createNativeCardArrowSlotPlacement({ baseArtifact, request });
  const artifact = await assembleNativeCardArrowFromSlot({
    baseArtifact,
    placementRequest: request,
    dispatchPlan: makeDispatchPlan(runtime, { geometry: placement.resolvedGeometry })
  });
  const snapshot = createAuthenticatedNativeCardCandidateSnapshot({
    artifact,
    candidateFileName: "native-candidate.pptx"
  });
  const options = {
    actualCandidateBytes: snapshot.candidateBytes,
    actualRecordBytes: snapshot.recordBytes,
    artifact,
    candidateFileName: "native-candidate.pptx",
    identity: {
      buildId: "native-candidate-build",
      capabilityRegistryId: "native-card-arrow-registry",
      deckId: "native-card-arrow-deck",
      projectId: "native-card-arrow-project",
      projectOverlayId: "native-card-arrow-overlay",
      qaContractId: definition.qaContractId,
      qaReportId: "native-candidate-qa",
      registryVersion: registry.registryVersion,
      templateIndexId: templateIndex.templateIndexId,
      templateProfileId: templateIndex.templateProfileId,
      templateSha256: templateIndex.templateSha256
    },
    validateQaReport(value) {
      assert.equal(Object.isFrozen(value), true);
      assert.equal(Reflect.set(value, "decision", "pass"), false);
      return true;
    }
  };
  const report = assessNativeCardCandidate(options);
  assert.equal(report.decision, "blocked");
  assert.deepEqual(report.checks.map(({ checkId, outcome }) => [checkId, outcome]), [
    ["candidate-record-replay", "pass"],
    ["mechanical-constraints", "pass"],
    ["package-source-diff", "pass"],
    ["pixel-review", "unavailable"],
    ["powerpoint-compatibility", "unavailable"],
    ["render-complete", "unavailable"]
  ]);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.checks), true);
  assert.equal(Object.isFrozen(report.manualGates), true);

  for (const validateQaReport of [
    () => false,
    () => { throw new Error("validator-private-detail"); }
  ]) {
    assert.throws(
      () => assessNativeCardCandidate({ ...options, validateQaReport }),
      (error) => error instanceof NativeCardCandidateQaError &&
        error.code === "NATIVE_CARD_CANDIDATE_QA_CONTRACT_INVALID" &&
        error.pointer === "/qaReport" &&
        error.message.includes("validator-private-detail") === false
    );
  }

  const changedCandidate = Buffer.from(snapshot.candidateBytes);
  changedCandidate[changedCandidate.length - 1] ^= 1;
  assert.throws(
    () => assessNativeCardCandidate({
      ...options,
      actualCandidateBytes: changedCandidate
    }),
    (error) => error instanceof NativeCardCandidateQaError &&
      error.code === "NATIVE_CARD_CANDIDATE_QA_CANDIDATE_INVALID" &&
      error.pointer === "/candidateBytes"
  );
  assert.throws(
    () => assessNativeCardCandidate({ ...options, evidence: [] }),
    (error) => error instanceof NativeCardCandidateQaError &&
      error.code === "NATIVE_CARD_CANDIDATE_QA_ARGUMENT_INVALID" &&
      error.pointer === "/options"
  );

  const disguisedOversized = Buffer.alloc(
    NATIVE_CARD_CANDIDATE_QA_MAX_PPTX_BYTES + 1
  );
  Object.defineProperty(disguisedOversized, "byteLength", { value: 1 });
  assert.throws(
    () => assessNativeCardCandidate({
      ...options,
      actualCandidateBytes: disguisedOversized
    }),
    (error) => error instanceof NativeCardCandidateQaError &&
      error.code === "NATIVE_CARD_CANDIDATE_QA_CANDIDATE_INVALID" &&
      error.pointer === "/candidateBytes"
  );

  const rejected = Promise.reject(new Error("validator-private-rejection"));
  assert.throws(
    () => assessNativeCardCandidate({
      ...options,
      validateQaReport: () => rejected
    }),
    (error) => error instanceof NativeCardCandidateQaError &&
      error.code === "NATIVE_CARD_CANDIDATE_QA_CONTRACT_INVALID" &&
      error.pointer === "/qaReport"
  );
  await new Promise((resolve) => setImmediate(resolve));
});

test("candidate bundle reports not-committed, rollback-incomplete, and commit-uncertain states", async (t) => {
  const request = placementRequest();
  const placement = createNativeCardArrowSlotPlacement({ baseArtifact, request });
  const artifact = await assembleNativeCardArrowFromSlot({
    baseArtifact,
    placementRequest: request,
    dispatchPlan: makeDispatchPlan(runtime, { geometry: placement.resolvedGeometry })
  });

  await t.test("record barrier failure rolls back completely", async () => {
    const directory = await realpath(await mkdtemp(
      path.join(os.tmpdir(), "native-candidate-not-committed-")
    ));
    let calls = 0;
    try {
      await assert.rejects(
        writeAuthenticatedNativeCandidateBundle(
          { artifact, destinationPath: path.join(directory, "candidate.pptx") },
          {
            async syncDirectory(target) {
              calls += 1;
              if (calls === 1) throw new Error("record-barrier");
              await syncTestDirectory(target);
            }
          }
        ),
        (error) => assertPublicationError(
          error,
          "NATIVE_PRESENTATION_PUBLICATION_NOT_COMMITTED",
          "/recordDestination"
        )
      );
      assert.equal(calls, 2);
      assert.deepEqual(await readdir(directory), []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  await t.test("failed rollback barrier is explicit", async () => {
    const directory = await realpath(await mkdtemp(
      path.join(os.tmpdir(), "native-candidate-rollback-incomplete-")
    ));
    let calls = 0;
    try {
      await assert.rejects(
        writeAuthenticatedNativeCandidateBundle(
          { artifact, destinationPath: path.join(directory, "candidate.pptx") },
          {
            async syncDirectory() {
              calls += 1;
              throw new Error("barrier-unavailable");
            }
          }
        ),
        (error) => assertPublicationError(
          error,
          "NATIVE_PRESENTATION_PUBLICATION_ROLLBACK_INCOMPLETE",
          "/recordDestination"
        )
      );
      assert.equal(calls, 2);
      assert.deepEqual(await readdir(directory), []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  await t.test("post-candidate barrier failure retains the reconciliation pair", async () => {
    const directory = await realpath(await mkdtemp(
      path.join(os.tmpdir(), "native-candidate-commit-uncertain-")
    ));
    const destinationPath = path.join(directory, "candidate.pptx");
    const recordPath = path.join(directory, "candidate.candidate.json");
    let calls = 0;
    try {
      await assert.rejects(
        writeAuthenticatedNativeCandidateBundle(
          { artifact, destinationPath },
          {
            async syncDirectory(target) {
              calls += 1;
              if (calls === 2) throw new Error("candidate-barrier");
              await syncTestDirectory(target);
            }
          }
        ),
        (error) => assertPublicationError(
          error,
          "NATIVE_PRESENTATION_PUBLICATION_COMMIT_UNCERTAIN",
          "/destination"
        )
      );
      assert.equal(calls, 2);
      assert.deepEqual((await readdir(directory)).sort(), [
        "candidate.candidate.json",
        "candidate.pptx"
      ]);
      verifyCandidateBuildRecord({
        candidateBytes: await readFile(destinationPath),
        recordBytes: await readFile(recordPath),
        candidateFileName: "candidate.pptx"
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

test("candidate bundle snapshots one artifact pair before authentication", async () => {
  const firstRequest = placementRequest();
  const firstPlacement = createNativeCardArrowSlotPlacement({
    baseArtifact,
    request: firstRequest
  });
  const firstArtifact = await assembleNativeCardArrowFromSlot({
    baseArtifact,
    placementRequest: firstRequest,
    dispatchPlan: makeDispatchPlan(runtime, { geometry: firstPlacement.resolvedGeometry })
  });
  const secondRequest = placementRequest({
    outputSlideId: "native-card-arrow-output-two",
    preferredSize: {
      cx: nativeDeck.slides[0].payload.geometry.cx - 914400,
      cy: nativeDeck.slides[0].payload.geometry.cy
    }
  });
  const secondPlacement = createNativeCardArrowSlotPlacement({
    baseArtifact,
    request: secondRequest
  });
  const secondArtifact = await assembleNativeCardArrowFromSlot({
    baseArtifact,
    placementRequest: secondRequest,
    dispatchPlan: makeDispatchPlan(runtime, {
      invocationId: "native-card-arrow-output-two",
      geometry: secondPlacement.resolvedGeometry
    })
  });
  let descriptorPass = 0;
  const crossPair = new Proxy({}, {
    getPrototypeOf() {
      return Object.prototype;
    },
    ownKeys() {
      descriptorPass += 1;
      return ["archiveBytes", "report"];
    },
    getOwnPropertyDescriptor(_target, key) {
      const value = descriptorPass === 1
        ? (key === "archiveBytes" ? firstArtifact.archiveBytes : secondArtifact.report)
        : firstArtifact[key];
      return { configurable: true, enumerable: true, writable: false, value };
    }
  });
  const directory = await realpath(await mkdtemp(
    path.join(os.tmpdir(), "native-presentation-bundle-proxy-")
  ));
  const destinationPath = path.join(directory, "candidate.pptx");
  try {
    await assert.rejects(
      writeAuthenticatedNativeCandidateBundle({ artifact: crossPair, destinationPath }),
      (error) => assertPublicationError(
        error,
        "NATIVE_PRESENTATION_PUBLICATION_SOURCE_MISMATCH",
        "/artifact/report"
      )
    );
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("candidate bundle rejects incomplete layout bridges and never overwrites either pair member", async () => {
  const rawArtifact = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const request = placementRequest();
  const placement = createNativeCardArrowSlotPlacement({ baseArtifact, request });
  const semanticArtifact = await assembleNativeCardArrowFromSlot({
    baseArtifact,
    placementRequest: request,
    dispatchPlan: makeDispatchPlan(runtime, {
      geometry: placement.resolvedGeometry
    })
  });
  const directory = await realpath(await mkdtemp(
    path.join(os.tmpdir(), "native-presentation-bundle-closed-")
  ));
  const destinationPath = path.join(directory, "candidate.pptx");
  const recordPath = path.join(directory, "candidate.candidate.json");
  try {
    await assert.rejects(
      writeAuthenticatedNativeCandidateBundle({ artifact: rawArtifact, destinationPath }),
      (error) => assertPublicationError(
        error,
        "NATIVE_PRESENTATION_PUBLICATION_SOURCE_MISMATCH",
        "/artifact/report/layoutIr/inputProfile"
      )
    );
    assert.deepEqual(await readdir(directory), []);

    await writeFile(recordPath, "existing-record", { flag: "wx" });
    await assert.rejects(
      writeAuthenticatedNativeCandidateBundle({ artifact: semanticArtifact, destinationPath }),
      (error) => assertPublicationError(
        error,
        "NATIVE_PRESENTATION_PUBLICATION_OUTPUT_EXISTS",
        "/recordDestination"
      )
    );
    assert.deepEqual(await readdir(directory), ["candidate.candidate.json"]);
    assert.equal(await readFile(recordPath, "utf8"), "existing-record");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("candidate-name race rolls back the already-published record before returning failure", async () => {
  const request = placementRequest();
  const placement = createNativeCardArrowSlotPlacement({ baseArtifact, request });
  const artifact = await assembleNativeCardArrowFromSlot({
    baseArtifact,
    placementRequest: request,
    dispatchPlan: makeDispatchPlan(runtime, { geometry: placement.resolvedGeometry })
  });
  const directory = await realpath(await mkdtemp(
    path.join(os.tmpdir(), "native-presentation-bundle-race-")
  ));
  const destinationPath = path.join(directory, "candidate.pptx");
  const recordPath = path.join(directory, "candidate.candidate.json");
  try {
    const writing = writeAuthenticatedNativeCandidateBundle({ artifact, destinationPath });
    const racing = (async () => {
      for (let attempt = 0; attempt < 1_000; attempt += 1) {
        const names = await readdir(directory);
        if (names.some((name) => name.startsWith(".pptx-pipeline-candidate-stage-"))) {
          await writeFile(destinationPath, "racing-writer", { flag: "wx" });
          return;
        }
        await new Promise((resolve) => setImmediate(resolve));
      }
      assert.fail("candidate staging file was not observed");
    })();
    const rejected = assert.rejects(
      writing,
      (error) => assertPublicationError(
        error,
        "NATIVE_PRESENTATION_PUBLICATION_OUTPUT_EXISTS",
        "/destination"
      )
    );
    await racing;
    await rejected;
    assert.equal(await readFile(destinationPath, "utf8"), "racing-writer");
    await assert.rejects(readFile(recordPath), (error) => error?.code === "ENOENT");
    assert.deepEqual(await readdir(directory), ["candidate.pptx"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("ordered assembly admits exact native artifacts through a verification shadow", async () => {
  const firstNative = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const lastNative = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime, {
      invocationId: "native-card-arrow-output-two"
    })
  });
  const secondPlain = assembleCloneFillPresentation({
    sourceArchiveBytes: sourceArchive.bytes,
    templateIndex,
    plan: makeCloneFillPlan("clone-fill-base-two")
  });
  const ordered = assembleOrderedSlideDeck({
    slides: [firstNative, baseArtifact, lastNative]
  });
  assert.equal(ordered.report.verificationProfile, "authenticated-native-ordered-output");
  assert.equal(ordered.report.genericPublicationEligible, false);
  assert.equal(ordered.report.containsTargetSpecificNative, true);
  assert.deepEqual(
    ordered.report.slides.map((slide) => slide.outputSlideId),
    [
      "native-card-arrow-output-one",
      "clone-fill-base-slide",
      "native-card-arrow-output-two"
    ]
  );
  const orderedParts = parseSecureZip(ordered.archiveBytes);
  assert.ok(orderedParts.get("ppt/slides/slide1.xml").equals(
    parseSecureZip(firstNative.archiveBytes).get("ppt/slides/slide1.xml")
  ));
  assert.ok(orderedParts.get("ppt/slides/slide2.xml").equals(
    parseSecureZip(baseArtifact.archiveBytes).get("ppt/slides/slide1.xml")
  ));
  assert.ok(orderedParts.get("ppt/slides/slide3.xml").equals(
    parseSecureZip(lastNative.archiveBytes).get("ppt/slides/slide1.xml")
  ));
  assert.throws(
    () => buildSecureTemplatePackageView({
      sourceLocation: path.resolve("/native-ordered-output.pptx"),
      archiveBytes: ordered.archiveBytes
    }),
    (error) => error?.code === "OOXML_UNHANDLED_FEATURE"
  );

  const middleNative = assembleOrderedSlideDeck({
    slides: [baseArtifact, firstNative, secondPlain]
  });
  assert.equal(middleNative.report.containsTargetSpecificNative, true);
  const allNative = assembleOrderedSlideDeck({ slides: [firstNative, lastNative] });
  assert.equal(allNative.report.containsTargetSpecificNative, true);
  const authenticated = authenticateOrderedSlideAssemblyArtifact(ordered);
  assert.ok(authenticated.archiveBytes.equals(ordered.archiveBytes));
  assert.equal(
    authenticated.authority.authenticatedPublicationProfile,
    "native-containing-ordered-artifact-only"
  );
  const sharedOrderedStorage = new SharedArrayBuffer(ordered.archiveBytes.length);
  const sharedOrderedBytes = Buffer.from(sharedOrderedStorage);
  ordered.archiveBytes.copy(sharedOrderedBytes);
  const sharedOrdered = authenticateOrderedSlideAssemblyArtifact({
    archiveBytes: sharedOrderedBytes,
    report: ordered.report
  });
  sharedOrderedBytes.fill(0);
  assert.equal(digest(sharedOrdered.archiveBytes), ordered.report.outputSha256);

  const repeatedFirst = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const repeatedLast = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime, {
      invocationId: "native-card-arrow-output-two"
    })
  });
  const repeated = assembleOrderedSlideDeck({
    slides: [repeatedFirst, baseArtifact, repeatedLast]
  });
  assert.ok(repeated.archiveBytes.equals(ordered.archiveBytes));
  assert.deepEqual(repeated.report, ordered.report);
});

test("native ordered candidate bundle keeps every semantic placement replayable", async () => {
  const request = placementRequest();
  const placement = createNativeCardArrowSlotPlacement({ baseArtifact, request });
  const nativeArtifact = await assembleNativeCardArrowFromSlot({
    baseArtifact,
    placementRequest: request,
    dispatchPlan: makeDispatchPlan(runtime, { geometry: placement.resolvedGeometry })
  });
  const ordered = assembleOrderedSlideDeck({ slides: [baseArtifact, nativeArtifact] });
  const rawNative = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime, {
      invocationId: "native-card-arrow-output-two"
    })
  });
  const rawOrdered = assembleOrderedSlideDeck({ slides: [baseArtifact, rawNative] });
  const directory = await realpath(await mkdtemp(
    path.join(os.tmpdir(), "native-ordered-candidate-")
  ));
  const destinationPath = path.join(directory, "ordered.pptx");
  const recordPath = path.join(directory, "ordered.candidate.json");
  try {
    const result = await writeAuthenticatedOrderedCandidateBundle({
      artifact: ordered,
      destinationPath
    });
    const [candidateBytes, recordBytes] = await Promise.all([
      readFile(destinationPath),
      readFile(recordPath)
    ]);
    const verified = verifyCandidateBuildRecord({
      candidateBytes,
      recordBytes,
      candidateFileName: "ordered.pptx"
    });
    assert.equal(result.verificationProfile, "authenticated-ordered-candidate-artifact");
    assert.equal(result.sourceVerificationProfile, "authenticated-native-ordered-output");
    assert.equal(
      verified.record.deck.slides.filter((slide) =>
        slide.sourceBuild.buildType === "native-card-arrow-source").length,
      1
    );
    assert.deepEqual(
      verified.record.deck.slides.map((slide) => slide.sourceArtifactSha256),
      ordered.report.slides.map((slide) => slide.sourceArtifactSha256)
    );
    const nativeSource = verified.record.deck.slides[1].sourceBuild;
    assert.equal(nativeSource.buildType, "native-card-arrow-source");
    assert.deepEqual(resolveSlideLayoutIr(nativeSource.layoutIr), nativeSource.composedSlidePlan);
    assert.deepEqual(nativeSource.capabilityEvidence, {
      evidenceType: "native-card-arrow",
      allocatedShapeIds: nativeArtifact.report.allocatedShapeIds
    });

    await assert.rejects(
      writeAuthenticatedOrderedCandidateBundle({
        artifact: rawOrdered,
        destinationPath: path.join(directory, "raw.pptx")
      }),
      (error) => assertPublicationError(
        error,
        "NATIVE_PRESENTATION_PUBLICATION_SOURCE_MISMATCH",
        "/artifact/report"
      )
    );
    assert.deepEqual(await readdir(directory), [
      "ordered.candidate.json",
      "ordered.pptx"
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("authenticated publication accepts native ordered output while generic paths stay closed", async () => {
  const nativeArtifact = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const ordered = assembleOrderedSlideDeck({ slides: [baseArtifact, nativeArtifact] });
  const directory = await realpath(await mkdtemp(
    path.join(os.tmpdir(), "native-ordered-publication-")
  ));
  const authenticatedDestination = path.join(directory, "authenticated.pptx");
  const genericDestination = path.join(directory, "generic.pptx");
  try {
    const publication = await publishAuthenticatedNativePresentation({
      artifact: ordered,
      destinationPath: authenticatedDestination
    });
    assert.equal(publication.sourceArtifactType, "ordered-assembled-pptx");
    assert.equal(publication.sourceVerificationProfile, "authenticated-native-ordered-output");
    assert.ok((await readFile(authenticatedDestination)).equals(ordered.archiveBytes));

    await assert.rejects(
      publishCreateOnlyPresentation({
        archiveBytes: ordered.archiveBytes,
        destinationPath: genericDestination
      }),
      (error) => error?.code === "ASSEMBLY_OUTPUT_INVALID"
    );
    assert.deepEqual(await readdir(directory), ["authenticated.pptx"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("native ordering and publication reject forged authority and closed-input violations", async (t) => {
  const nativeArtifact = await assembleNativeCardArrowOnCloneFill({
    baseArtifact,
    dispatchPlan: makeDispatchPlan(runtime)
  });
  const secondPlain = assembleCloneFillPresentation({
    sourceArchiveBytes: sourceArchive.bytes,
    templateIndex,
    plan: makeCloneFillPlan("clone-fill-base-two")
  });
  const cloneOnlyOrdered = assembleOrderedSlideDeck({
    slides: [baseArtifact, secondPlain]
  });
  assert.equal(cloneOnlyOrdered.report.genericPublicationEligible, true);
  assert.equal(cloneOnlyOrdered.report.containsTargetSpecificNative, false);

  await t.test("copied native report cannot enter ordered assembly", () => {
    assert.throws(
      () => assembleOrderedSlideDeck({
        slides: [
          { archiveBytes: nativeArtifact.archiveBytes, report: structuredClone(nativeArtifact.report) },
          baseArtifact
        ]
      }),
      (error) => assertOrderedError(
        error,
        "ORDERED_SLIDE_ASSEMBLY_SOURCE_MISMATCH",
        "/slides/0/report"
      )
    );
  });
  await t.test("tampered native bytes cannot enter ordered assembly", () => {
    const tampered = Buffer.from(nativeArtifact.archiveBytes);
    tampered[tampered.length - 1] ^= 1;
    assert.throws(
      () => assembleOrderedSlideDeck({
        slides: [{ archiveBytes: tampered, report: nativeArtifact.report }, baseArtifact]
      }),
      (error) => assertOrderedError(
        error,
        "ORDERED_SLIDE_ASSEMBLY_SOURCE_MISMATCH",
        "/slides/0/report"
      )
    );
  });
  await t.test("duplicate semantic slide IDs still fail atomically", async () => {
    const duplicate = await assembleNativeCardArrowOnCloneFill({
      baseArtifact,
      dispatchPlan: makeDispatchPlan(runtime)
    });
    assert.throws(
      () => assembleOrderedSlideDeck({ slides: [nativeArtifact, duplicate] }),
      (error) => assertOrderedError(
        error,
        "ORDERED_SLIDE_ASSEMBLY_SOURCE_MISMATCH",
        "/slides/report/outputSlideId"
      )
    );
  });
  await t.test("caller labels cannot authorize publication", async () => {
    const forgedReport = Object.freeze({
      ...nativeArtifact.report,
      publicationEligible: true
    });
    await assert.rejects(
      publishAuthenticatedNativePresentation({
        artifact: { archiveBytes: nativeArtifact.archiveBytes, report: forgedReport },
        destinationPath: path.resolve("/forged-native-output.pptx")
      }),
      (error) => assertPublicationError(
        error,
        "NATIVE_PRESENTATION_PUBLICATION_SOURCE_MISMATCH",
        "/artifact/report"
      )
    );
  });
  await t.test("clone-only ordered output is not admitted by the native bridge", async () => {
    await assert.rejects(
      publishAuthenticatedNativePresentation({
        artifact: cloneOnlyOrdered,
        destinationPath: path.resolve("/clone-only-native-bridge.pptx")
      }),
      (error) => assertPublicationError(
        error,
        "NATIVE_PRESENTATION_PUBLICATION_SOURCE_MISMATCH",
        "/artifact/report"
      )
    );
  });
  await t.test("extra and accessor options fail closed", async () => {
    await assert.rejects(
      publishAuthenticatedNativePresentation({
        artifact: nativeArtifact,
        destinationPath: path.resolve("/extra-native-option.pptx"),
        overwrite: false
      }),
      (error) => assertPublicationError(
        error,
        "NATIVE_PRESENTATION_PUBLICATION_ARGUMENT_INVALID",
        "/options"
      )
    );
    const options = { artifact: nativeArtifact };
    Object.defineProperty(options, "destinationPath", {
      enumerable: true,
      get() {
        throw new Error("must-not-run");
      }
    });
    await assert.rejects(
      publishAuthenticatedNativePresentation(options),
      (error) => assertPublicationError(
        error,
        "NATIVE_PRESENTATION_PUBLICATION_ARGUMENT_INVALID",
        "/options/destinationPath"
      )
    );
  });
  await t.test("a symbolic-link parent is never a publication authority", async () => {
    const root = await realpath(await mkdtemp(
      path.join(os.tmpdir(), "native-publication-symlink-")
    ));
    const linkedParent = path.join(root, "linked-parent");
    try {
      await symlink(root, linkedParent);
      await assert.rejects(
        publishAuthenticatedNativePresentation({
          artifact: nativeArtifact,
          destinationPath: path.join(linkedParent, "output.pptx")
        }),
        (error) => assertPublicationError(
          error,
          "NATIVE_PRESENTATION_PUBLICATION_OUTPUT_WRITE_FAILED",
          "/destination"
        )
      );
      assert.deepEqual((await readdir(root)).sort(), ["linked-parent"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("native application authenticates the exact M2-005A report and archive pairing", async (t) => {
  await t.test("forged report", async () => {
    await assert.rejects(
      assembleNativeCardArrowOnCloneFill({
        baseArtifact: {
          archiveBytes: baseArtifact.archiveBytes,
          report: structuredClone(baseArtifact.report)
        },
        dispatchPlan: makeDispatchPlan(runtime)
      }),
      (error) => assertNativeError(
        error,
        "NATIVE_CARD_ARROW_ASSEMBLY_SOURCE_MISMATCH",
        "/baseArtifact"
      )
    );
  });

  await t.test("tampered archive", async () => {
    const changed = Buffer.from(baseArtifact.archiveBytes);
    changed[changed.length - 1] ^= 1;
    await assert.rejects(
      assembleNativeCardArrowOnCloneFill({
        baseArtifact: { archiveBytes: changed, report: baseArtifact.report },
        dispatchPlan: makeDispatchPlan(runtime)
      }),
      (error) => assertNativeError(
        error,
        "NATIVE_CARD_ARROW_ASSEMBLY_SOURCE_MISMATCH",
        "/baseArtifact"
      )
    );
  });
});

test("source slide, anchor, and actual canvas bounds are revalidated after dispatch", async (t) => {
  await t.test("wrong source slide", async () => {
    await assert.rejects(
      assembleNativeCardArrowOnCloneFill({
        baseArtifact,
        dispatchPlan: makeDispatchPlan(runtime, { containerKey: "other-slide" })
      }),
      (error) => assertNativeError(
        error,
        "NATIVE_CARD_ARROW_ASSEMBLY_TARGET_INVALID",
        "/output/clone/sourceSlideKey"
      )
    );
  });

  await t.test("missing direct anchor", async () => {
    await assert.rejects(
      assembleNativeCardArrowOnCloneFill({
        baseArtifact,
        dispatchPlan: makeDispatchPlan(runtime, { shapeKey: "missing-shape" })
      }),
      (error) => assertNativeError(
        error,
        "NATIVE_CARD_ARROW_ASSEMBLY_TARGET_INVALID",
        "/output/insert/anchorShapeKey"
      )
    );
  });

  await t.test("component exceeds the real slide", async () => {
    await assert.rejects(
      assembleNativeCardArrowOnCloneFill({
        baseArtifact,
        dispatchPlan: makeDispatchPlan(runtime, {
          geometry: { x: 12_000_000, y: 0, cx: 914_400, cy: 457_200 }
        })
      }),
      (error) => assertNativeError(
        error,
        "NATIVE_CARD_ARROW_ASSEMBLY_TARGET_INVALID",
        "/output/component/geometry"
      )
    );
  });
});

test("schema and QA drift fails before a package can be returned", async () => {
  const driftingRuntime = await makeRuntime((nativeInvocation) => {
    const output = executeNativeCardArrow(nativeInvocation);
    if (nativeInvocation.invocationId === "native-card-arrow-output-one") {
      output.component.label = "Dispatcher drift";
    }
    return output;
  });
  const baseBefore = Buffer.from(baseArtifact.archiveBytes);
  await assert.rejects(
    assembleNativeCardArrowOnCloneFill({
      baseArtifact,
      dispatchPlan: makeDispatchPlan(driftingRuntime)
    }),
    (error) => error instanceof CapabilityRuntimeError &&
      error.code === "CAPABILITY_RUNTIME_QA_FAILED"
  );
  assert.ok(baseArtifact.archiveBytes.equals(baseBefore));
});

function minimalSlideWithIds(idAttributes) {
  const nodes = idAttributes.map((attributes, index) => index === 0
    ? `<p:nvGrpSpPr><p:cNvPr${attributes}/></p:nvGrpSpPr>`
    : `<p:grpSp><p:nvGrpSpPr><p:cNvPr${attributes}/></p:nvGrpSpPr></p:grpSp>`
  ).join("");
  return Buffer.from(
    `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
      `<p:cSld><p:spTree>${nodes}</p:spTree></p:cSld></p:sld>`,
    "utf8"
  );
}

test("ID allocation scans root and nested groups and chooses three smallest free UInt32 IDs", () => {
  assert.deepEqual(
    allocateNativeCardArrowShapeIds(minimalSlideWithIds([
      ' id="1" name="root"',
      ' id="2" name="nested-one"',
      ' id="4" name="nested-two"'
    ])),
    [3, 5, 6]
  );
  assert.deepEqual(
    allocateNativeCardArrowShapeIds(minimalSlideWithIds([
      ' id="4294967293" name="near-max"',
      ' id="4294967294" name="nearer-max"',
      ' id="4294967295" name="max"'
    ])),
    [1, 2, 3]
  );
});

test("ID allocation rejects duplicate and non-canonical object IDs", async (t) => {
  const cases = [
    ["duplicate", [' id="1"', ' id="1"']],
    ["missing", [' id="1"', ""]],
    ["zero", [' id="1"', ' id="0"']],
    ["negative", [' id="1"', ' id="-1"']],
    ["leading zero", [' id="1"', ' id="01"']],
    ["above UInt32", [' id="1"', ' id="4294967296"']]
  ];
  for (const [name, ids] of cases) {
    await t.test(name, () => {
      assert.throws(
        () => allocateNativeCardArrowShapeIds(minimalSlideWithIds(ids)),
        (error) => assertNativeError(
          error,
          "NATIVE_CARD_ARROW_ASSEMBLY_TARGET_INVALID",
          "/slide/spTree/objectIds"
        )
      );
    });
  }
  assert.throws(
    () => allocateNativeCardArrowShapeIds(Buffer.alloc(STRICT_XML_LIMITS.maxPartBytes + 1)),
    (error) => assertNativeError(
      error,
      "NATIVE_CARD_ARROW_ASSEMBLY_TARGET_INVALID",
      "/slide"
    )
  );
});

test("assembly inputs fail closed for copies, extra fields, accessors, and proxies", async (t) => {
  await t.test("detached dispatch-plan copy", async () => {
    await assert.rejects(
      assembleNativeCardArrowOnCloneFill({
        baseArtifact,
        dispatchPlan: { ...makeDispatchPlan(runtime) }
      }),
      (error) => assertNativeError(
        error,
        "NATIVE_CARD_ARROW_ASSEMBLY_ARGUMENT_INVALID",
        "/dispatchPlan"
      )
    );
  });
  await t.test("extra option", async () => {
    await assert.rejects(
      assembleNativeCardArrowOnCloneFill({
        baseArtifact,
        dispatchPlan: makeDispatchPlan(runtime),
        repair: true
      }),
      (error) => assertNativeError(
        error,
        "NATIVE_CARD_ARROW_ASSEMBLY_ARGUMENT_INVALID",
        "/options"
      )
    );
  });
  await t.test("accessor option", async () => {
    const options = { baseArtifact };
    Object.defineProperty(options, "dispatchPlan", {
      enumerable: true,
      get() {
        throw new Error("must-not-run");
      }
    });
    await assert.rejects(
      assembleNativeCardArrowOnCloneFill(options),
      (error) => assertNativeError(
        error,
        "NATIVE_CARD_ARROW_ASSEMBLY_ARGUMENT_INVALID",
        "/options/dispatchPlan"
      )
    );
  });
  await t.test("proxy dispatch plan", async () => {
    const proxy = new Proxy(makeDispatchPlan(runtime), {
      getPrototypeOf() {
        throw new Error("must-not-escape");
      }
    });
    await assert.rejects(
      assembleNativeCardArrowOnCloneFill({ baseArtifact, dispatchPlan: proxy }),
      (error) => assertNativeError(
        error,
        "NATIVE_CARD_ARROW_ASSEMBLY_ARGUMENT_INVALID",
        "/dispatchPlan"
      )
    );
  });
});

test("core applicator uses typed data only and keeps plugin, labs, and fragment runtime out", () => {
  assert.doesNotMatch(coreSource, /from\s+["'][^"']*(?:plugins|labs)\//u);
  assert.equal(coreSource.match(/unboundDrawingmlFragment/gu)?.length, 1);
  assert.doesNotMatch(
    coreSource,
    /dataValue\(component,\s*["']unboundDrawingmlFragment["']\)/u
  );
  assert.doesNotMatch(coreSource, /replace(?:All)?\([^\n]*unboundDrawingmlFragment/u);
  assert.doesNotMatch(coreSource, /parseStrictXml\([^\n]*unboundDrawingmlFragment/u);
});
