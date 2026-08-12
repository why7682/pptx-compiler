import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  assertCapabilityRuntimeRegistry,
  CapabilityRuntimeError,
  createCapabilityRuntime,
  executeCapabilityDispatch
} from "../packages/core/src/capability-dispatcher.mjs";
import {
  prepareResolvedDeckDispatch,
  PROJECT_DISPATCH_RESOLVER_VERSION,
  ProjectDispatchResolutionError
} from "../packages/core/src/project-dispatch-resolver.mjs";
import { parseStrictXml } from "../packages/core/src/strict-xml.mjs";
import {
  executeNativeCardArrow,
  nativeCardArrowQaAssertions,
  preflightNativeCardArrow
} from "../plugins/native-card-arrow/src/native-card-arrow.mjs";
import {
  assertSupportedSchema,
  createSchemaRegistry,
  validateJson
} from "../scripts/lib/json-schema.mjs";

const DRAWINGML_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/main";
const PRESENTATIONML_NAMESPACE =
  "http://schemas.openxmlformats.org/presentationml/2006/main";
const RELATIONSHIP_NAMESPACE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
const encoder = new TextEncoder();

const readJson = async (relativePath) => JSON.parse(await readFile(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8"
));

const manifest = await readJson("schemas/contracts/manifest.json");
const contractSchemas = await Promise.all(
  manifest.schemas.map(({ path: schemaPath }) => readJson(schemaPath))
);
const contractSchemaRegistry = createSchemaRegistry(contractSchemas);
for (const schema of contractSchemas) {
  assertSupportedSchema(schema, { registry: contractSchemaRegistry });
}

const registry = await readJson("fixtures/capabilities/native-card-arrow/registry.json");
const projectOverlay = await readJson(
  "fixtures/capabilities/native-card-arrow/project-overlay.json"
);
const deckSpec = await readJson("fixtures/capabilities/native-card-arrow/deck-spec.json");
const cases = await readJson("fixtures/capabilities/native-card-arrow/cases.json");
const templateIndex = await readJson("fixtures/inspection/expected-potx-template-index.json");
const inputSchema = await readJson("plugins/native-card-arrow/schemas/input.schema.json");
const outputSchema = await readJson("plugins/native-card-arrow/schemas/output.schema.json");
const supportMatrix = await readJson("policy/support-matrix.json");
const resolverSource = await readFile(
  new URL("../packages/core/src/project-dispatch-resolver.mjs", import.meta.url),
  "utf8"
);
const dispatcherSource = await readFile(
  new URL("../packages/core/src/capability-dispatcher.mjs", import.meta.url),
  "utf8"
);
const executorSource = await readFile(
  new URL("../plugins/native-card-arrow/src/native-card-arrow.mjs", import.meta.url),
  "utf8"
);

assertSupportedSchema(inputSchema);
assertSupportedSchema(outputSchema);

const definition = registry.capabilities[0];
const capabilityRow = supportMatrix.dimensions.capabilities.find(
  (item) => item.id === definition.supportMatrixItemId
);
const schemasByType = new Map([
  ["capability-registry", contractSchemaRegistry.get(
    "urn:pptx-compiler:schema:capability-registry:0.1.0"
  )],
  ["project-overlay", contractSchemaRegistry.get(
    "urn:pptx-compiler:schema:project-overlay:0.1.0"
  )],
  ["template-index", contractSchemaRegistry.get(
    "urn:pptx-compiler:schema:template-index:0.1.0"
  )],
  ["deck-spec", contractSchemaRegistry.get(
    "urn:pptx-compiler:schema:deck-spec:0.1.0"
  )]
]);

function clone(value) {
  return structuredClone(value);
}

function validateContract(type, value) {
  const schema = schemasByType.get(type);
  return validateJson(value, schema, {
    rootSchema: schema,
    registry: contractSchemaRegistry
  }).length === 0;
}

function validateSchemaDocument(value) {
  try {
    assertSupportedSchema(value);
    return true;
  } catch {
    return false;
  }
}

function makeResolverDependencies() {
  return {
    validateCapabilityRegistry: (value) => validateContract("capability-registry", value),
    validateDeckSpec: (value) => validateContract("deck-spec", value),
    validateProjectOverlay: (value) => validateContract("project-overlay", value),
    validateTemplateIndex: (value) => validateContract("template-index", value)
  };
}

function experimentalDecision() {
  return {
    supportMatrixItemId: definition.supportMatrixItemId,
    supportClaimsEnabled: false,
    status: "experimental",
    disposition: "accept-with-warning"
  };
}

function normativeDecision() {
  return {
    supportMatrixItemId: definition.supportMatrixItemId,
    supportClaimsEnabled: supportMatrix.supportClaimsEnabled,
    status: capabilityRow.status,
    disposition: capabilityRow.disposition
  };
}

function makeRegistration({ preflight, execute, assertions } = {}) {
  return {
    capabilityId: definition.capabilityId,
    capabilityVersion: definition.capabilityVersion,
    executor: {
      executorId: definition.executorId,
      preflight: preflight ?? preflightNativeCardArrow,
      execute: execute ?? executeNativeCardArrow
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
      assertions: [...(assertions ?? nativeCardArrowQaAssertions)]
    }
  };
}

async function makeRuntime({
  registration = makeRegistration(),
  decision = normativeDecision()
} = {}) {
  return createCapabilityRuntime({
    capabilityRegistry: clone(registry),
    registrations: [registration],
    dependencies: {
      validateCapabilityRegistry(value) {
        return validateContract("capability-registry", value);
      },
      validateSchemaDocument,
      resolveCapabilitySupport() {
        return decision;
      }
    }
  });
}

function bundle(overrides = {}) {
  return {
    capabilityRegistry: clone(overrides.capabilityRegistry ?? registry),
    projectOverlay: clone(overrides.projectOverlay ?? projectOverlay),
    templateIndex: clone(overrides.templateIndex ?? templateIndex),
    deckSpec: clone(overrides.deckSpec ?? deckSpec)
  };
}

function prepare(runtime, documents) {
  return prepareResolvedDeckDispatch({
    runtime,
    capabilityRegistry: documents.capabilityRegistry,
    projectOverlay: documents.projectOverlay,
    templateIndex: documents.templateIndex,
    deckSpec: documents.deckSpec,
    dependencies: makeResolverDependencies()
  });
}

function resolvedInvocation(slide, overlay = projectOverlay) {
  const selection = overlay.capabilitySelections.find(
    (candidate) => candidate.capabilitySelectionId === slide.capabilitySelectionId
  );
  const bindingById = new Map(overlay.shapeBindings.map((binding) => [
    binding.shapeBindingId,
    binding
  ]));
  return {
    invocationId: slide.slideId,
    capabilitySelectionId: selection.capabilitySelectionId,
    capabilityId: selection.capabilityId,
    capabilityVersion: selection.capabilityVersion,
    experimentalOptIn: selection.experimentalOptIn,
    payload: clone(slide.payload),
    bindings: selection.bindings.map(({ role, shapeBindingId }) => ({
      role,
      ...clone(bindingById.get(shapeBindingId))
    }))
  };
}

function assertRuntimeError(error, code, pointer) {
  assert.ok(error instanceof CapabilityRuntimeError);
  assert.equal(error.code, code);
  if (pointer !== undefined) assert.equal(error.pointer, pointer);
  assert.deepEqual(error.toJSON(), { code: error.code, pointer: error.pointer });
  return true;
}

function assertResolutionError(error, code, pointer) {
  assert.ok(error instanceof ProjectDispatchResolutionError);
  if (code !== undefined) assert.equal(error.code, code);
  if (pointer !== undefined) assert.equal(error.pointer, pointer);
  assert.deepEqual(error.toJSON(), { code: error.code, pointer: error.pointer });
  return true;
}

function collectNodes(root) {
  const nodes = [];
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    nodes.push(node);
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push(node.children[index]);
    }
  }
  return nodes;
}

function nodesNamed(nodes, namespaceURI, localName) {
  return nodes.filter((node) =>
    node.namespaceURI === namespaceURI && node.localName === localName
  );
}

function attribute(node, localName, namespaceURI = "") {
  return node.attributes.get(`${namespaceURI}\u0000${localName}`)?.value;
}

function allQaAssertionsPass(invocation, output) {
  return nativeCardArrowQaAssertions.every(
    (assertion) => assertion.assert({ invocation, output }) === true
  );
}

test("public native component artifacts are exact, schema-valid, and self-conforming", () => {
  assert.equal(PROJECT_DISPATCH_RESOLVER_VERSION, "0.1.0");
  assert.equal(validateContract("capability-registry", registry), true);
  assert.equal(validateContract("project-overlay", projectOverlay), true);
  assert.equal(validateContract("template-index", templateIndex), true);
  assert.equal(validateContract("deck-spec", deckSpec), true);
  assert.deepEqual(definition.requiredBindingRoles, ["anchor"]);
  assert.deepEqual(
    cases.fixtures.map((fixture) => fixture.fixtureId),
    definition.conformanceFixtureIds
  );
  assert.deepEqual(
    nativeCardArrowQaAssertions.map((assertion) => assertion.assertionId),
    [
      "anchor-binding-contract",
      "component-data-contract",
      "native-shape-structure-contract",
      "rendered-fragment-contract"
    ]
  );

  for (const fixture of cases.fixtures) {
    assert.equal(validateJson(fixture.invocation.payload, inputSchema).length, 0);
    assert.equal(validateJson(fixture.expectedOutput, outputSchema).length, 0);
    assert.equal(preflightNativeCardArrow(fixture.invocation), true);
    const output = executeNativeCardArrow(fixture.invocation);
    assert.deepEqual(output, fixture.expectedOutput);
    assert.equal(output.component.insertable, false);
    assert.equal(output.component.artifactKind, "unbound-drawingml-conformance-fragment");
    assert.equal(output.component.idScope, "component-local");
    assert.deepEqual(output.component.localShapeIds, [1, 2, 3]);
    assert.equal(allQaAssertionsPass(fixture.invocation, output), true);
  }
});

test("the conformance fragment is exactly one native group with two native shapes", () => {
  for (const fixture of cases.fixtures) {
    const fragment = fixture.expectedOutput.component.unboundDrawingmlFragment;
    const parsed = parseStrictXml(encoder.encode(fragment));
    const nodes = collectNodes(parsed.root);
    assert.equal(parsed.root.namespaceURI, PRESENTATIONML_NAMESPACE);
    assert.equal(parsed.root.localName, "grpSp");
    assert.deepEqual(parsed.counts, { elements: 54, attributes: 40 });
    assert.deepEqual(
      [...parsed.namespaceUris].sort(),
      [DRAWINGML_NAMESPACE, PRESENTATIONML_NAMESPACE, XML_NAMESPACE].sort()
    );

    const shapes = nodesNamed(nodes, PRESENTATIONML_NAMESPACE, "sp");
    const nonVisual = nodesNamed(nodes, PRESENTATIONML_NAMESPACE, "cNvPr");
    const geometries = nodesNamed(nodes, DRAWINGML_NAMESPACE, "prstGeom");
    const text = nodesNamed(nodes, DRAWINGML_NAMESPACE, "t");
    const paragraphs = nodesNamed(nodes, DRAWINGML_NAMESPACE, "p");
    const runs = nodesNamed(nodes, DRAWINGML_NAMESPACE, "r");
    const nonVisualShapeProperties = nodesNamed(
      nodes,
      PRESENTATIONML_NAMESPACE,
      "cNvSpPr"
    );
    assert.equal(shapes.length, 2);
    assert.equal(paragraphs.length, 1);
    assert.equal(runs.length, 1);
    assert.equal(nonVisualShapeProperties.length, 2);
    assert.equal(nonVisualShapeProperties.every(
      (node) => node.attributes.size === 0 && node.children.length === 0
    ), true);
    assert.deepEqual(nonVisual.map((node) => attribute(node, "id")), ["1", "2", "3"]);
    assert.deepEqual(
      geometries.map((node) => attribute(node, "prst")),
      ["roundRect", "rightArrow"]
    );
    assert.deepEqual(text.map((node) => node.text), [fixture.invocation.payload.label]);
    assert.deepEqual(
      text.map((node) => attribute(node, "space", XML_NAMESPACE)),
      ["preserve"]
    );

    for (const forbiddenName of [
      "pic",
      "graphicFrame",
      "cxnSp",
      "blip",
      "custGeom",
      "extLst",
      "hlinkClick",
      "gradFill",
      "schemeClr",
      "effectLst"
    ]) {
      assert.equal(nodes.some((node) => node.localName === forbiddenName), false);
    }
    assert.equal(parsed.namespaceUris.has(RELATIONSHIP_NAMESPACE), false);
    assert.equal(
      nodes.some((node) => [...node.attributes.values()].some(
        (entry) => entry.namespaceURI === RELATIONSHIP_NAMESPACE
      )),
      false
    );
  }
});

test("normative experimental policy resolves through the shared dispatcher with opt-in and order", async () => {
  assert.ok(capabilityRow);
  assert.equal(supportMatrix.supportClaimsEnabled, false);
  assert.equal(capabilityRow.status, "experimental");
  assert.equal(capabilityRow.disposition, "accept-with-warning");

  const runtime = await makeRuntime();
  const documents = bundle();
  const plan = prepare(runtime, documents);
  assert.deepEqual(plan, {
    planVersion: "0.1.0",
    planType: "capability-dispatch-plan",
    invocationCount: 2
  });
  assert.ok(Object.isFrozen(plan));

  documents.deckSpec.slides[0].payload.label = "caller-mutation";
  documents.projectOverlay.shapeBindings[0].shapeKey = "caller-mutation";
  documents.templateIndex.slides[0].shapes.reverse();
  const result = await executeCapabilityDispatch({ plan });
  assert.deepEqual(
    result.results.map((entry) => entry.invocationId),
    deckSpec.slides.map((slide) => slide.slideId)
  );
  assert.deepEqual(
    result.results.map((entry) => entry.output),
    deckSpec.slides.map((slide) => executeNativeCardArrow(resolvedInvocation(slide)))
  );
  assert.deepEqual(
    result.results.map((entry) => entry.supportStatus),
    ["experimental", "experimental"]
  );
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.results[0].output.component.style));
});

test("experimental product dispatch requires explicit opt-in before product preflight", async () => {
  let preflightCalls = 0;
  let executeCalls = 0;
  const runtime = await makeRuntime({
    decision: experimentalDecision(),
    registration: makeRegistration({
      preflight(invocation) {
        preflightCalls += 1;
        return preflightNativeCardArrow(invocation);
      },
      execute(invocation) {
        executeCalls += 1;
        return executeNativeCardArrow(invocation);
      }
    })
  });
  assert.deepEqual(
    { preflightCalls, executeCalls },
    { preflightCalls: cases.fixtures.length, executeCalls: cases.fixtures.length }
  );
  preflightCalls = 0;
  executeCalls = 0;
  const documents = bundle();
  documents.projectOverlay.capabilitySelections[0].experimentalOptIn = false;
  assert.throws(
    () => prepare(runtime, documents),
    (error) => assertRuntimeError(
      error,
      "CAPABILITY_RUNTIME_EXPERIMENTAL_OPT_IN_REQUIRED",
      "/invocations/0/experimentalOptIn"
    )
  );
  assert.deepEqual({ preflightCalls, executeCalls }, { preflightCalls: 0, executeCalls: 0 });
});

test("runtime registry binding compares exact captured content without invoking accessors", async () => {
  const runtime = await makeRuntime({ decision: experimentalDecision() });
  assert.equal(assertCapabilityRuntimeRegistry({
    runtime,
    capabilityRegistry: clone(registry)
  }), true);

  const drifted = clone(registry);
  drifted.capabilities[0].executorId =
    "urn:pptx-compiler:capability:executor:native-card-arrow-drift:0.1.0";
  assert.throws(
    () => prepare(runtime, bundle({ capabilityRegistry: drifted })),
    (error) => assertRuntimeError(
      error,
      "CAPABILITY_RUNTIME_REGISTRY_MISMATCH",
      "/capabilityRegistry"
    )
  );

  let getterCalls = 0;
  const hostile = clone(registry);
  Object.defineProperty(hostile.capabilities[0], "executorId", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return definition.executorId;
    }
  });
  assert.throws(
    () => assertCapabilityRuntimeRegistry({ runtime, capabilityRegistry: hostile }),
    (error) => assertRuntimeError(
      error,
      "CAPABILITY_RUNTIME_REGISTRY_INVALID",
      "/capabilityRegistry"
    )
  );
  assert.equal(getterCalls, 0);
});

test("cross-document identity and semantic binding drift fail closed", async (t) => {
  const runtime = await makeRuntime({ decision: experimentalDecision() });
  const identityMutations = [
    ["overlay profile", (d) => { d.projectOverlay.templateProfileId = "drift-profile"; }, "/projectOverlay/templateProfileId"],
    ["overlay index", (d) => { d.projectOverlay.templateIndexId = "drift-index"; }, "/projectOverlay/templateIndexId"],
    ["overlay digest", (d) => { d.projectOverlay.templateSha256 = "0".repeat(64); }, "/projectOverlay/templateSha256"],
    ["deck project", (d) => { d.deckSpec.projectId = "drift-project"; }, "/deckSpec/projectId"],
    ["deck overlay", (d) => { d.deckSpec.projectOverlayId = "drift-overlay"; }, "/deckSpec/projectOverlayId"]
  ];
  for (const [name, mutate, pointer] of identityMutations) {
    await t.test(name, () => {
      const documents = bundle();
      mutate(documents);
      assert.throws(
        () => prepare(runtime, documents),
        (error) => assertResolutionError(
          error,
          "PROJECT_DISPATCH_RESOLUTION_IDENTITY_MISMATCH",
          pointer
        )
      );
    });
  }

  const bindingMutations = [
    ["missing selection", (d) => {
      d.deckSpec.slides[1].capabilitySelectionId = "missing-selection";
    }],
    ["missing assignment", (d) => {
      d.projectOverlay.capabilitySelections[0].bindings.length = 0;
    }],
    ["missing binding", (d) => {
      d.projectOverlay.capabilitySelections[0].bindings[0].shapeBindingId = "missing-binding";
    }],
    ["missing container", (d) => {
      d.projectOverlay.shapeBindings[0].containerKey = "missing-slide";
    }],
    ["missing shape", (d) => {
      d.projectOverlay.shapeBindings[0].shapeKey = "missing-shape";
    }],
    ["kind mismatch", (d) => {
      d.projectOverlay.shapeBindings[0].expectedKind = "picture";
    }]
  ];
  for (const [name, mutate] of bindingMutations) {
    await t.test(name, () => {
      const documents = bundle();
      mutate(documents);
      assert.throws(
        () => prepare(runtime, documents),
        (error) => {
          assert.ok(error instanceof ProjectDispatchResolutionError);
          assert.deepEqual(error.toJSON(), { code: error.code, pointer: error.pointer });
          assert.doesNotMatch(error.message, /Public synthetic decision|f9875cbaf15b/u);
          return true;
        }
      );
    });
  }

  await t.test("layout target reaches capability preflight and is rejected", () => {
    const documents = bundle();
    documents.templateIndex.layouts[0].shapes = [clone(
      documents.templateIndex.slides[0].shapes[1]
    )];
    documents.projectOverlay.shapeBindings[0].containerKind = "layout";
    documents.projectOverlay.shapeBindings[0].containerKey = "layout-1";
    assert.throws(
      () => prepare(runtime, documents),
      (error) => assertRuntimeError(
        error,
        "CAPABILITY_RUNTIME_PREFLIGHT_REJECTED",
        "/invocations/0"
      )
    );
  });
});

test("semantic anchor keys and component data are independent of source IDs, order, and geometry", async () => {
  const runtime = await makeRuntime({ decision: experimentalDecision() });
  const documents = bundle();
  const indexedSlide = documents.templateIndex.slides[0];
  const anchorShape = indexedSlide.shapes.find((shape) => shape.shapeKey === "shape-2");
  indexedSlide.slideKey = "renamed-source-slide";
  anchorShape.shapeKey = "renamed-anchor-shape";
  anchorShape.sourceId = 902;
  anchorShape.geometry.x = 17;
  indexedSlide.shapes.reverse();
  documents.projectOverlay.shapeBindings[0].containerKey = "renamed-source-slide";
  documents.projectOverlay.shapeBindings[0].shapeKey = "renamed-anchor-shape";

  const result = await executeCapabilityDispatch({ plan: prepare(runtime, documents) });
  const first = result.results[0].output;
  assert.equal(first.clone.sourceSlideKey, "renamed-source-slide");
  assert.equal(first.insert.anchorShapeKey, "renamed-anchor-shape");
  assert.deepEqual(first.component.geometry, deckSpec.slides[0].payload.geometry);
  assert.deepEqual(first.component.style, deckSpec.slides[0].payload.style);
  assert.equal(first.component.label, deckSpec.slides[0].payload.label);
});

test("a bad later slide prevents every product preflight and execution call", async () => {
  let preflightCalls = 0;
  let executeCalls = 0;
  const runtime = await makeRuntime({
    decision: experimentalDecision(),
    registration: makeRegistration({
      preflight(invocation) {
        preflightCalls += 1;
        return preflightNativeCardArrow(invocation);
      },
      execute(invocation) {
        executeCalls += 1;
        return executeNativeCardArrow(invocation);
      }
    })
  });
  preflightCalls = 0;
  executeCalls = 0;

  const invalidSelection = bundle();
  invalidSelection.deckSpec.slides[1].capabilitySelectionId = "missing-selection";
  assert.throws(() => prepare(runtime, invalidSelection), ProjectDispatchResolutionError);
  assert.deepEqual({ preflightCalls, executeCalls }, { preflightCalls: 0, executeCalls: 0 });

  const invalidPayload = bundle();
  invalidPayload.deckSpec.slides[1].payload.label = "";
  assert.throws(
    () => prepare(runtime, invalidPayload),
    (error) => assertRuntimeError(
      error,
      "CAPABILITY_RUNTIME_INPUT_INVALID",
      "/invocations/1/payload"
    )
  );
  assert.deepEqual({ preflightCalls, executeCalls }, { preflightCalls: 0, executeCalls: 0 });
});

test("payload geometry, style, safe text, Unicode, and UTF-8 limits fail closed", async (t) => {
  const baseline = clone(cases.fixtures[0].invocation);
  const invalidPayloads = [
    ["missing fields", {}],
    ["extra field", { ...clone(baseline.payload), extra: true }],
    ["negative x", { ...clone(baseline.payload), geometry: { ...baseline.payload.geometry, x: -1 } }],
    ["short width", { ...clone(baseline.payload), geometry: { ...baseline.payload.geometry, cx: 914399 } }],
    ["fractional height", { ...clone(baseline.payload), geometry: { ...baseline.payload.geometry, cy: 1200000.5 } }],
    ["lowercase color", { ...clone(baseline.payload), style: { ...baseline.payload.style, cardFill: "e0e7ff" } }],
    ["prefixed color", { ...clone(baseline.payload), style: { ...baseline.payload.style, arrowFill: "#2563EB" } }],
    ["small font", { ...clone(baseline.payload), style: { ...baseline.payload.style, fontSizeHundredthPoints: 799 } }],
    ["blank label", { ...clone(baseline.payload), label: " " }],
    ["control label", { ...clone(baseline.payload), label: "line\nbreak" }],
    ["format character", { ...clone(baseline.payload), label: "hidden\u2066text" }],
    ["unpaired surrogate", { ...clone(baseline.payload), label: "\ud800" }],
    ["BMP noncharacter", { ...clone(baseline.payload), label: "\ufffe" }],
    ["astral noncharacter", { ...clone(baseline.payload), label: "\u{1fffe}" }],
    ["too many code points", { ...clone(baseline.payload), label: "x".repeat(257) }],
    ["too many UTF-8 bytes", { ...clone(baseline.payload), label: "😀".repeat(257) }]
  ];
  for (const [name, payload] of invalidPayloads) {
    await t.test(name, () => {
      const invocation = clone(baseline);
      invocation.payload = payload;
      assert.notEqual(validateJson(payload, inputSchema).length, 0);
      assert.equal(preflightNativeCardArrow(invocation), false);
    });
  }

  for (const [name, geometry] of [
    ["horizontal sum overflow", { x: 99_500_000, y: 0, cx: 914_400, cy: 457_200 }],
    ["vertical sum overflow", { x: 0, y: 99_600_000, cx: 914_400, cy: 457_200 }]
  ]) {
    await t.test(name, () => {
      const invocation = clone(baseline);
      invocation.payload.geometry = geometry;
      assert.equal(validateJson(invocation.payload, inputSchema).length, 0);
      assert.equal(preflightNativeCardArrow(invocation), false);
    });
  }

  for (const label of ["😀", "\u{10fffd}", " R&D <Ready> \"quoted\" 😀 "]) {
    const invocation = clone(baseline);
    invocation.payload.label = label;
    assert.equal(validateJson(invocation.payload, inputSchema).length, 0);
    assert.equal(preflightNativeCardArrow(invocation), true);
    const output = executeNativeCardArrow(invocation);
    assert.equal(validateJson(output, outputSchema).length, 0);
    assert.equal(allQaAssertionsPass(invocation, output), true);
    const parsed = parseStrictXml(encoder.encode(output.component.unboundDrawingmlFragment));
    const text = nodesNamed(collectNodes(parsed.root), DRAWINGML_NAMESPACE, "t");
    assert.deepEqual(text.map((node) => node.text), [label]);
  }

  const boundaryInvocation = clone(baseline);
  boundaryInvocation.payload.label = "😀".repeat(256);
  assert.equal(encoder.encode(boundaryInvocation.payload.label).byteLength, 1024);
  assert.equal(validateJson(boundaryInvocation.payload, inputSchema).length, 0);
  assert.equal(preflightNativeCardArrow(boundaryInvocation), true);
  assert.equal(executorSource.indexOf("value.length > MAX_LABEL_BYTES") !== -1, true);
  assert.ok(
    executorSource.indexOf("encoder.encode(value)") >
      executorSource.indexOf("value.length > MAX_LABEL_BYTES")
  );

  const escaped = executeNativeCardArrow(cases.fixtures[1].invocation)
    .component.unboundDrawingmlFragment;
  assert.match(escaped, /R&amp;D &lt;Ready&gt;/u);
  assert.doesNotMatch(escaped, /R&D <Ready>/u);
});

test("output schema and QA reject insertion, ID-scope, shape-tree, and vocabulary drift", async (t) => {
  const fixture = cases.fixtures[0];
  const baseline = executeNativeCardArrow(fixture.invocation);
  const schemaMutations = [
    ["insertable true", (output) => { output.component.insertable = true; }],
    ["package-global ID scope", (output) => { output.component.idScope = "package-global"; }],
    ["duplicate component-local IDs", (output) => { output.component.localShapeIds = [1, 2, 2]; }],
    ["non-group root", (output) => {
      output.component.unboundDrawingmlFragment =
        `<p:sp xmlns:p="${PRESENTATIONML_NAMESPACE}"/>`;
    }],
    ["unknown component field", (output) => { output.component.extra = true; }]
  ];
  for (const [name, mutate] of schemaMutations) {
    await t.test(name, () => {
      const output = clone(baseline);
      mutate(output);
      assert.notEqual(validateJson(output, outputSchema).length, 0);
    });
  }

  const fragmentMutations = [
    ["permuted component-local IDs", (output) => {
      output.component.localShapeIds = [3, 2, 1];
    }],
    ["presentation namespace drift", (output) => {
      output.component.unboundDrawingmlFragment = output.component.unboundDrawingmlFragment
        .replace(PRESENTATIONML_NAMESPACE, "urn:example:presentationml-drift");
    }],
    ["relationship-bearing node", (output) => {
      output.component.unboundDrawingmlFragment = output.component.unboundDrawingmlFragment
        .replace(">", ` xmlns:r="${RELATIONSHIP_NAMESPACE}">`)
        .replace("</p:grpSp>", "<a:hlinkClick r:id=\"rId1\"/></p:grpSp>");
    }],
    ["raster picture", (output) => {
      output.component.unboundDrawingmlFragment = output.component.unboundDrawingmlFragment
        .replace("</p:grpSp>", "<p:pic/></p:grpSp>");
    }],
    ["third native shape", (output) => {
      output.component.unboundDrawingmlFragment = output.component.unboundDrawingmlFragment
        .replace("</p:grpSp>", "<p:sp/></p:grpSp>");
    }],
    ["custom geometry", (output) => {
      output.component.unboundDrawingmlFragment = output.component.unboundDrawingmlFragment
        .replace(
          "<a:prstGeom prst=\"roundRect\"><a:avLst/></a:prstGeom>",
          "<a:custGeom><a:avLst/></a:custGeom>"
        );
    }],
    ["preset geometry drift", (output) => {
      output.component.unboundDrawingmlFragment = output.component.unboundDrawingmlFragment
        .replace("prst=\"rightArrow\"", "prst=\"leftArrow\"");
    }],
    ["extension list", (output) => {
      output.component.unboundDrawingmlFragment = output.component.unboundDrawingmlFragment
        .replace("</p:grpSp>", "<p:extLst/></p:grpSp>");
    }]
  ];
  for (const [name, mutate] of fragmentMutations) {
    await t.test(name, () => {
      const output = clone(baseline);
      mutate(output);
      assert.equal(validateJson(output, outputSchema).length, 0);
      assert.equal(allQaAssertionsPass(fixture.invocation, output), false);
    });
  }

  await t.test("dispatcher rejects schema-invalid product output before QA", async () => {
    const runtime = await makeRuntime({
      decision: experimentalDecision(),
      registration: makeRegistration({
        execute(invocation) {
          const output = executeNativeCardArrow(invocation);
          if (invocation.invocationId === deckSpec.slides[0].slideId) {
            output.component.insertable = true;
          }
          return output;
        }
      })
    });
    await assert.rejects(
      executeCapabilityDispatch({ plan: prepare(runtime, bundle()) }),
      (error) => assertRuntimeError(
        error,
        "CAPABILITY_RUNTIME_OUTPUT_INVALID",
        "/invocations/0/output"
      )
    );
  });

  await t.test("dispatcher rejects schema-valid component-local ID drift in QA", async () => {
    const runtime = await makeRuntime({
      decision: experimentalDecision(),
      registration: makeRegistration({
        execute(invocation) {
          const output = executeNativeCardArrow(invocation);
          if (invocation.invocationId === deckSpec.slides[0].slideId) {
            output.component.localShapeIds = [3, 2, 1];
          }
          return output;
        }
      })
    });
    await assert.rejects(
      executeCapabilityDispatch({ plan: prepare(runtime, bundle()) }),
      (error) => assertRuntimeError(
        error,
        "CAPABILITY_RUNTIME_QA_FAILED",
        "/invocations/0/output/qaAssertions/2"
      )
    );
  });
});

test("native rendering is byte-deterministic and detached from caller mutation", () => {
  for (const fixture of cases.fixtures) {
    const invocation = clone(fixture.invocation);
    const first = executeNativeCardArrow(invocation);
    const firstBytes = encoder.encode(JSON.stringify(first));
    invocation.payload.geometry.x += 1;
    invocation.payload.style.cardFill = "FFFFFF";
    const second = executeNativeCardArrow(fixture.invocation);
    assert.deepEqual(first, fixture.expectedOutput);
    assert.deepEqual(second, fixture.expectedOutput);
    assert.deepEqual(firstBytes, encoder.encode(JSON.stringify(second)));
  }
});

test("resolver and native executor are fixture-neutral, no-I/O modules with clean-directory closure", async () => {
  const fixtureSpecificStrings = [
    ...templateIndex.layouts.map((layout) => layout.layoutKey),
    ...templateIndex.slides.map((slide) => slide.slideKey),
    ...templateIndex.slides.flatMap((slide) => slide.shapes.map((shape) => shape.shapeKey)),
    ...templateIndex.masters.map((master) => master.partPath),
    ...templateIndex.layouts.map((layout) => layout.partPath),
    ...templateIndex.slides.map((slide) => slide.partPath),
    ...deckSpec.slides.map((slide) => slide.payload.label),
    ...cases.fixtures.map((fixture) => fixture.invocation.payload.label)
  ];
  for (const value of fixtureSpecificStrings) {
    assert.equal(executorSource.includes(value), false, `executor contains fixture value ${value}`);
    assert.equal(resolverSource.includes(value), false, `resolver contains fixture value ${value}`);
  }
  for (const source of [dispatcherSource, resolverSource, executorSource]) {
    for (const forbidden of [
      "node:fs",
      "node:http",
      "node:https",
      "node:child_process",
      "process.env",
      "process.cwd",
      "fetch(",
      "import(",
      "require(",
      "eval(",
      "Function("
    ]) {
      assert.equal(source.includes(forbidden), false, `source contains ${forbidden}`);
    }
  }

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "native-card-arrow-closure-"));
  try {
    const coreDirectory = path.join(temporaryRoot, "packages", "core", "src");
    const pluginDirectory = path.join(
      temporaryRoot,
      "plugins",
      "native-card-arrow",
      "src"
    );
    await mkdir(coreDirectory, { recursive: true });
    await mkdir(pluginDirectory, { recursive: true });
    await Promise.all([
      writeFile(path.join(temporaryRoot, "package.json"), `${JSON.stringify({
        type: "module",
        imports: {
          "#pptx-compiler/extension-api": "./packages/core/src/extension-api.mjs"
        }
      })}\n`),
      copyFile(
        new URL("../packages/core/src/capability-dispatcher.mjs", import.meta.url),
        path.join(coreDirectory, "capability-dispatcher.mjs")
      ),
      copyFile(
        new URL("../packages/core/src/extension-api.mjs", import.meta.url),
        path.join(coreDirectory, "extension-api.mjs")
      ),
      copyFile(
        new URL("../packages/core/src/json-schema.mjs", import.meta.url),
        path.join(coreDirectory, "json-schema.mjs")
      ),
      copyFile(
        new URL("../packages/core/src/project-dispatch-resolver.mjs", import.meta.url),
        path.join(coreDirectory, "project-dispatch-resolver.mjs")
      ),
      copyFile(
        new URL("../packages/core/src/strict-xml.mjs", import.meta.url),
        path.join(coreDirectory, "strict-xml.mjs")
      ),
      copyFile(
        new URL("../plugins/native-card-arrow/src/native-card-arrow.mjs", import.meta.url),
        path.join(pluginDirectory, "native-card-arrow.mjs")
      )
    ]);
    const importedDispatcher = await import(pathToFileURL(
      path.join(coreDirectory, "capability-dispatcher.mjs")
    ));
    const importedResolver = await import(pathToFileURL(
      path.join(coreDirectory, "project-dispatch-resolver.mjs")
    ));
    const importedPlugin = await import(pathToFileURL(
      path.join(pluginDirectory, "native-card-arrow.mjs")
    ));
    assert.equal(typeof importedDispatcher.createCapabilityRuntime, "function");
    assert.equal(typeof importedResolver.prepareResolvedDeckDispatch, "function");
    assert.equal(typeof importedPlugin.executeNativeCardArrow, "function");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
