import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
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
import {
  executeSourceSlideCloneFill,
  preflightSourceSlideCloneFill,
  sourceSlideCloneFillQaAssertions
} from "../plugins/clone-fill/src/source-slide-clone-fill.mjs";
import {
  assertSupportedSchema,
  createSchemaRegistry,
  validateJson
} from "../scripts/lib/json-schema.mjs";

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

const registry = await readJson("fixtures/capabilities/source-slide-clone-fill/registry.json");
const projectOverlay = await readJson(
  "fixtures/capabilities/source-slide-clone-fill/project-overlay.json"
);
const deckSpec = await readJson("fixtures/capabilities/source-slide-clone-fill/deck-spec.json");
const templateIndex = await readJson("fixtures/inspection/expected-potx-template-index.json");
const cases = await readJson("fixtures/capabilities/source-slide-clone-fill/cases.json");
const inputSchema = await readJson("plugins/clone-fill/schemas/input.schema.json");
const outputSchema = await readJson("plugins/clone-fill/schemas/output.schema.json");
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
  new URL("../plugins/clone-fill/src/source-slide-clone-fill.mjs", import.meta.url),
  "utf8"
);

assertSupportedSchema(inputSchema);
assertSupportedSchema(outputSchema);

const definition = registry.capabilities[0];
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

function makeResolverDependencies(overrides = {}) {
  return {
    validateCapabilityRegistry: (value) => validateContract("capability-registry", value),
    validateDeckSpec: (value) => validateContract("deck-spec", value),
    validateProjectOverlay: (value) => validateContract("project-overlay", value),
    validateTemplateIndex: (value) => validateContract("template-index", value),
    ...overrides
  };
}

function supportDecision(status) {
  const dispositions = {
    experimental: "accept-with-warning",
    manual: "report-manual-gate",
    supported: "accept",
    unsupported: "unavailable"
  };
  return {
    supportMatrixItemId: definition.supportMatrixItemId,
    supportClaimsEnabled: status === "supported",
    status,
    disposition: dispositions[status]
  };
}

function makeRegistration({ preflight, execute } = {}) {
  return {
    capabilityId: definition.capabilityId,
    capabilityVersion: definition.capabilityVersion,
    executor: {
      executorId: definition.executorId,
      preflight: preflight ?? preflightSourceSlideCloneFill,
      execute: execute ?? executeSourceSlideCloneFill
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
      assertions: [...sourceSlideCloneFillQaAssertions]
    }
  };
}

async function makeRuntime(status = "experimental", registration = makeRegistration(), registryValue = registry) {
  return createCapabilityRuntime({
    capabilityRegistry: clone(registryValue),
    registrations: [registration],
    dependencies: {
      validateCapabilityRegistry(value) {
        return validateContract("capability-registry", value);
      },
      validateSchemaDocument,
      resolveCapabilitySupport() {
        return supportDecision(status);
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

function prepare(runtime, documents, dependencies = makeResolverDependencies()) {
  return prepareResolvedDeckDispatch({
    runtime,
    capabilityRegistry: documents.capabilityRegistry,
    projectOverlay: documents.projectOverlay,
    templateIndex: documents.templateIndex,
    deckSpec: documents.deckSpec,
    dependencies
  });
}

function assertResolutionError(error, code, pointer) {
  assert.ok(error instanceof ProjectDispatchResolutionError);
  assert.equal(error.code, code);
  if (pointer !== undefined) assert.equal(error.pointer, pointer);
  assert.deepEqual(error.toJSON(), { code: error.code, pointer: error.pointer });
  return true;
}

function assertRuntimeError(error, code, pointer) {
  assert.ok(error instanceof CapabilityRuntimeError);
  assert.equal(error.code, code);
  if (pointer !== undefined) assert.equal(error.pointer, pointer);
  assert.deepEqual(error.toJSON(), { code: error.code, pointer: error.pointer });
  return true;
}

async function assertNoUnhandledRejection(callback) {
  const observed = [];
  const listener = (reason) => observed.push(reason);
  process.on("unhandledRejection", listener);
  try {
    await callback();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(observed, []);
  } finally {
    process.off("unhandledRejection", listener);
  }
}

function expectedPlan(slide) {
  const bindingById = new Map(projectOverlay.shapeBindings.map((binding) => [
    binding.shapeBindingId,
    binding
  ]));
  const selection = projectOverlay.capabilitySelections.find(
    (candidate) => candidate.capabilitySelectionId === slide.capabilitySelectionId
  );
  const body = bindingById.get(selection.bindings[0].shapeBindingId);
  const title = bindingById.get(selection.bindings[1].shapeBindingId);
  return {
    planVersion: "0.1.0",
    planType: "source-slide-clone-fill-plan",
    outputSlideId: slide.slideId,
    clone: {
      operationId: "clone-source-slide",
      operationType: "clone-slide",
      sourceContainerKind: "slide",
      sourceSlideKey: body.containerKey
    },
    fills: [
      {
        operationId: "fill-body",
        operationType: "replace-cloned-shape-text",
        role: "body",
        shapeBindingId: body.shapeBindingId,
        sourceShapeKey: body.shapeKey,
        expectedKind: body.expectedKind,
        paragraphs: [...slide.payload.body]
      },
      {
        operationId: "fill-title",
        operationType: "replace-cloned-shape-text",
        role: "title",
        shapeBindingId: title.shapeBindingId,
        sourceShapeKey: title.shapeKey,
        expectedKind: title.expectedKind,
        paragraphs: [slide.payload.title]
      }
    ]
  };
}

test("public capability artifacts are exact, schema-valid, and self-conforming", () => {
  assert.equal(PROJECT_DISPATCH_RESOLVER_VERSION, "0.1.0");
  assert.equal(validateContract("capability-registry", registry), true);
  assert.equal(validateContract("project-overlay", projectOverlay), true);
  assert.equal(validateContract("template-index", templateIndex), true);
  assert.equal(validateContract("deck-spec", deckSpec), true);
  assert.deepEqual(
    cases.fixtures.map((fixture) => fixture.fixtureId),
    definition.conformanceFixtureIds
  );
  for (const fixture of cases.fixtures) {
    assert.equal(validateJson(fixture.invocation.payload, inputSchema).length, 0);
    assert.equal(validateJson(fixture.expectedOutput, outputSchema).length, 0);
    assert.equal(preflightSourceSlideCloneFill(fixture.invocation), true);
    const output = executeSourceSlideCloneFill(fixture.invocation);
    assert.deepEqual(output, fixture.expectedOutput);
    for (const assertion of sourceSlideCloneFillQaAssertions) {
      assert.equal(assertion.assert({ invocation: fixture.invocation, output }), true);
    }
  }
});

test("test-only experimental authorization resolves, dispatches, and preserves deck order", async () => {
  const runtime = await makeRuntime("experimental");
  const documents = bundle();
  const plan = prepare(runtime, documents);
  assert.deepEqual(plan, {
    planVersion: "0.1.0",
    planType: "capability-dispatch-plan",
    invocationCount: 2
  });
  assert.ok(Object.isFrozen(plan));

  documents.deckSpec.slides[0].payload.title = "caller mutation";
  documents.projectOverlay.shapeBindings[0].shapeKey = "caller-mutation";
  documents.templateIndex.slides[0].shapes.reverse();
  const result = await executeCapabilityDispatch({ plan });
  assert.deepEqual(
    result.results.map((entry) => entry.output),
    deckSpec.slides.map(expectedPlan)
  );
  assert.deepEqual(result.results.map((entry) => entry.invocationId), [
    "clone-output-one",
    "clone-output-two"
  ]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.results[0].output.fills[0].paragraphs));
});

test("normative unsupported policy admits conformance but blocks every product dispatch", async () => {
  const capabilityRow = supportMatrix.dimensions.capabilities.find(
    (item) => item.id === "source-slide-clone-fill"
  );
  assert.equal(supportMatrix.supportClaimsEnabled, false);
  assert.equal(capabilityRow.status, "unsupported");
  assert.equal(capabilityRow.disposition, "unavailable");

  let preflightCalls = 0;
  let executeCalls = 0;
  const runtime = await makeRuntime("unsupported", makeRegistration({
    preflight(invocation) {
      preflightCalls += 1;
      return preflightSourceSlideCloneFill(invocation);
    },
    execute(invocation) {
      executeCalls += 1;
      return executeSourceSlideCloneFill(invocation);
    }
  }));
  assert.equal(runtime.executableCapabilityCount, 1);
  assert.equal(preflightCalls, cases.fixtures.length);
  assert.equal(executeCalls, cases.fixtures.length);
  const before = { preflightCalls, executeCalls };
  assert.throws(
    () => prepare(runtime, bundle()),
    (error) => assertRuntimeError(
      error,
      "CAPABILITY_RUNTIME_CAPABILITY_UNAVAILABLE",
      "/invocations/0/capabilityId"
    )
  );
  assert.deepEqual({ preflightCalls, executeCalls }, before);
});

test("runtime registry binding compares exact captured content, not only ID and version", async () => {
  const runtime = await makeRuntime("experimental");
  assert.equal(assertCapabilityRuntimeRegistry({
    runtime,
    capabilityRegistry: clone(registry)
  }), true);

  const drifted = clone(registry);
  drifted.capabilities[0].executorId =
    "urn:pptx-compiler:capability:executor:source-slide-clone-fill-drift:0.1.0";
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

test("semantic keys are data-driven and independent of shape order, geometry, and source IDs", async () => {
  const runtime = await makeRuntime("experimental");
  const documents = bundle();
  const indexedSlide = documents.templateIndex.slides[0];
  indexedSlide.slideKey = "renamed-source-slide";
  indexedSlide.shapes[0].shapeKey = "renamed-title-shape";
  indexedSlide.shapes[0].sourceId = 901;
  indexedSlide.shapes[0].geometry.x = 111;
  indexedSlide.shapes[1].shapeKey = "renamed-body-shape";
  indexedSlide.shapes[1].sourceId = 902;
  indexedSlide.shapes[1].geometry.x = 222;
  indexedSlide.shapes.reverse();
  documents.projectOverlay.shapeBindings[0].containerKey = "renamed-source-slide";
  documents.projectOverlay.shapeBindings[0].shapeKey = "renamed-body-shape";
  documents.projectOverlay.shapeBindings[1].containerKey = "renamed-source-slide";
  documents.projectOverlay.shapeBindings[1].shapeKey = "renamed-title-shape";

  const result = await executeCapabilityDispatch({ plan: prepare(runtime, documents) });
  assert.equal(result.results[0].output.clone.sourceSlideKey, "renamed-source-slide");
  assert.deepEqual(
    result.results[0].output.fills.map((fill) => fill.sourceShapeKey),
    ["renamed-body-shape", "renamed-title-shape"]
  );
});

test("project-level selections may be unused while one selection is reused by multiple slides", async () => {
  const runtime = await makeRuntime("experimental");
  const documents = bundle();
  const extraSlide = clone(documents.templateIndex.slides[0]);
  extraSlide.slideKey = "unused-source-slide";
  extraSlide.sourceId = 301;
  extraSlide.partPath = "ppt/slides/slide2.xml";
  extraSlide.shapes[0].shapeKey = "unused-title-shape";
  extraSlide.shapes[0].sourceId = 4;
  extraSlide.shapes[1].shapeKey = "unused-body-shape";
  extraSlide.shapes[1].sourceId = 5;
  documents.templateIndex.slides.push(extraSlide);
  documents.projectOverlay.capabilitySelections.push({
    capabilitySelectionId: "unused-selection",
    capabilityId: "source-slide-clone-fill",
    capabilityVersion: "0.1.0",
    experimentalOptIn: true,
    bindings: [
      { role: "body", shapeBindingId: "unused-body-binding" },
      { role: "title", shapeBindingId: "unused-title-binding" }
    ]
  });
  documents.projectOverlay.shapeBindings.push(
    {
      shapeBindingId: "unused-body-binding",
      containerKind: "slide",
      containerKey: "unused-source-slide",
      shapeKey: "unused-body-shape",
      expectedKind: "text-box",
      cardinality: "exactly-one"
    },
    {
      shapeBindingId: "unused-title-binding",
      containerKind: "slide",
      containerKey: "unused-source-slide",
      shapeKey: "unused-title-shape",
      expectedKind: "text-box",
      cardinality: "exactly-one"
    }
  );
  const result = await executeCapabilityDispatch({ plan: prepare(runtime, documents) });
  assert.equal(result.results.length, 2);
  assert.deepEqual(
    result.results.map((entry) => entry.output.outputSlideId),
    deckSpec.slides.map((slide) => slide.slideId)
  );
});

test("separate selections may reuse one semantic binding without sharing one invocation role", async () => {
  const runtime = await makeRuntime("experimental");
  const documents = bundle();
  const secondSelection = clone(documents.projectOverlay.capabilitySelections[0]);
  secondSelection.capabilitySelectionId = "clone-fill-selection-two";
  documents.projectOverlay.capabilitySelections.push(secondSelection);
  documents.deckSpec.slides[1].capabilitySelectionId = secondSelection.capabilitySelectionId;

  const result = await executeCapabilityDispatch({ plan: prepare(runtime, documents) });
  assert.equal(result.results.length, 2);
  assert.deepEqual(
    result.results.map((entry) => entry.output.outputSlideId),
    documents.deckSpec.slides.map((slide) => slide.slideId)
  );
  assert.deepEqual(
    result.results.map((entry) => entry.output.fills.map((fill) => fill.sourceShapeKey)),
    [
      ["shape-2", "shape-1"],
      ["shape-2", "shape-1"]
    ]
  );
});

test("cross-document identity drift fails with stable redacted pointers", async (t) => {
  const runtime = await makeRuntime("experimental");
  const mutations = [
    ["overlay profile", (d) => { d.projectOverlay.templateProfileId = "drift-profile"; }, "/projectOverlay/templateProfileId"],
    ["overlay index", (d) => { d.projectOverlay.templateIndexId = "drift-index"; }, "/projectOverlay/templateIndexId"],
    ["overlay digest", (d) => { d.projectOverlay.templateSha256 = "0".repeat(64); }, "/projectOverlay/templateSha256"],
    ["overlay registry", (d) => { d.projectOverlay.capabilityRegistryId = "drift-registry"; }, "/projectOverlay/capabilityRegistryId"],
    ["overlay registry version", (d) => { d.projectOverlay.registryVersion = "0.1.1"; }, "/projectOverlay/registryVersion"],
    ["deck project", (d) => { d.deckSpec.projectId = "drift-project"; }, "/deckSpec/projectId"],
    ["deck profile", (d) => { d.deckSpec.templateProfileId = "drift-profile"; }, "/deckSpec/templateProfileId"],
    ["deck overlay", (d) => { d.deckSpec.projectOverlayId = "drift-overlay"; }, "/deckSpec/projectOverlayId"]
  ];
  for (const [name, mutate, pointer] of mutations) {
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
});

test("missing, duplicate, ambiguous, and mismatched semantic references fail closed", async (t) => {
  const runtime = await makeRuntime("experimental");
  const mutations = [
    ["unknown capability", (d) => { d.projectOverlay.capabilitySelections[0].capabilityId = "unknown-capability"; }],
    ["capability version drift", (d) => { d.projectOverlay.capabilitySelections[0].capabilityVersion = "0.1.1"; }],
    ["unknown deck selection", (d) => { d.deckSpec.slides[1].capabilitySelectionId = "unknown-selection"; }],
    ["duplicate deck slide ID", (d) => { d.deckSpec.slides[1].slideId = d.deckSpec.slides[0].slideId; }],
    ["missing shape binding", (d) => { d.projectOverlay.capabilitySelections[0].bindings[0].shapeBindingId = "missing-binding"; }],
    ["reused shape binding", (d) => { d.projectOverlay.capabilitySelections[0].bindings[1].shapeBindingId = "body-binding"; }],
    ["missing role", (d) => { d.projectOverlay.capabilitySelections[0].bindings.pop(); }],
    ["unsorted roles", (d) => { d.projectOverlay.capabilitySelections[0].bindings.reverse(); }],
    ["missing container", (d) => { d.projectOverlay.shapeBindings[0].containerKey = "missing-slide"; }],
    ["wrong container namespace", (d) => {
      d.projectOverlay.shapeBindings[0].containerKind = "layout";
      d.projectOverlay.shapeBindings[0].containerKey = "slide-1";
    }],
    ["missing shape", (d) => { d.projectOverlay.shapeBindings[0].shapeKey = "missing-shape"; }],
    ["kind mismatch", (d) => { d.projectOverlay.shapeBindings[0].expectedKind = "picture"; }],
    ["duplicate target", (d) => { d.projectOverlay.shapeBindings[0].shapeKey = "shape-1"; }],
    ["duplicate indexed shape key", (d) => { d.templateIndex.slides[0].shapes[1].shapeKey = "shape-1"; }],
    ["duplicate indexed shape source ID", (d) => { d.templateIndex.slides[0].shapes[1].sourceId = 2; }],
    ["duplicate indexed slide key", (d) => { d.templateIndex.slides.push(clone(d.templateIndex.slides[0])); }],
    ["case-alias part path", (d) => {
      const extra = clone(d.templateIndex.slides[0]);
      extra.slideKey = "slide-case-alias";
      extra.sourceId = 301;
      extra.partPath = "PPT/slides/slide1.xml";
      d.templateIndex.slides.push(extra);
    }]
  ];
  for (const [name, mutate] of mutations) {
    await t.test(name, () => {
      const documents = bundle();
      mutate(documents);
      assert.throws(
        () => prepare(runtime, documents),
        (error) => {
          assert.ok(error instanceof ProjectDispatchResolutionError);
          assert.deepEqual(error.toJSON(), { code: error.code, pointer: error.pointer });
          assert.doesNotMatch(error.message, /f9875c|Public synthetic|Generic title/u);
          return true;
        }
      );
    });
  }
});

test("capability-specific binding constraints reject layout, cross-slide, and duplicate targets", async (t) => {
  const runtime = await makeRuntime("experimental");
  await t.test("bindings from different source slides", () => {
    const documents = bundle();
    const extra = clone(documents.templateIndex.slides[0]);
    extra.slideKey = "second-source-slide";
    extra.sourceId = 301;
    extra.partPath = "ppt/slides/slide2.xml";
    extra.shapes[0].shapeKey = "second-title-shape";
    extra.shapes[0].sourceId = 4;
    extra.shapes[1].shapeKey = "second-body-shape";
    extra.shapes[1].sourceId = 5;
    documents.templateIndex.slides.push(extra);
    documents.projectOverlay.shapeBindings[1].containerKey = "second-source-slide";
    documents.projectOverlay.shapeBindings[1].shapeKey = "second-title-shape";
    assert.throws(
      () => prepare(runtime, documents),
      (error) => assertRuntimeError(
        error,
        "CAPABILITY_RUNTIME_PREFLIGHT_REJECTED",
        "/invocations/0"
      )
    );
  });
  await t.test("layout binding", () => {
    const documents = bundle();
    documents.templateIndex.layouts[0].shapes = [clone(documents.templateIndex.slides[0].shapes[0])];
    documents.projectOverlay.shapeBindings[1].containerKind = "layout";
    documents.projectOverlay.shapeBindings[1].containerKey = "layout-1";
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

test("a bad later slide prevents every product preflight and execute call", async () => {
  let preflightCalls = 0;
  let executeCalls = 0;
  const runtime = await makeRuntime("experimental", makeRegistration({
    preflight(invocation) {
      preflightCalls += 1;
      return preflightSourceSlideCloneFill(invocation);
    },
    execute(invocation) {
      executeCalls += 1;
      return executeSourceSlideCloneFill(invocation);
    }
  }));
  preflightCalls = 0;
  executeCalls = 0;

  const invalidSelection = bundle();
  invalidSelection.deckSpec.slides[1].capabilitySelectionId = "missing-selection";
  assert.throws(() => prepare(runtime, invalidSelection), ProjectDispatchResolutionError);
  assert.deepEqual({ preflightCalls, executeCalls }, { preflightCalls: 0, executeCalls: 0 });

  const invalidPayload = bundle();
  invalidPayload.deckSpec.slides[1].payload.title = "";
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

test("all documents are snapshotted before validators can mutate caller data", async () => {
  const runtime = await makeRuntime("experimental");
  const documents = bundle();
  const base = makeResolverDependencies();
  const dependencies = makeResolverDependencies({
    validateCapabilityRegistry(value) {
      documents.projectOverlay.shapeBindings[0].shapeKey = "mutated-shape";
      documents.templateIndex.slides.length = 0;
      documents.deckSpec.slides[0].payload.title = "mutated-title";
      return base.validateCapabilityRegistry(value);
    }
  });
  const result = await executeCapabilityDispatch({ plan: prepare(runtime, documents, dependencies) });
  assert.deepEqual(result.results[0].output, expectedPlan(deckSpec.slides[0]));
});

test("descriptor attacks and oversized later documents fail before callbacks or getters", async () => {
  const runtime = await makeRuntime("experimental");
  let getterCalls = 0;
  const accessorDocuments = bundle();
  Object.defineProperty(accessorDocuments.deckSpec.slides[1].payload, "title", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "hidden title";
    }
  });
  assert.throws(
    () => prepare(runtime, accessorDocuments),
    (error) => assertResolutionError(
      error,
      "PROJECT_DISPATCH_RESOLUTION_DOCUMENT_INVALID",
      "/deckSpec"
    )
  );
  assert.equal(getterCalls, 0);

  let validatorCalls = 0;
  const oversized = bundle();
  oversized.deckSpec.slides[1].payload.title = "x".repeat(256 * 1024 + 1);
  const count = (callback) => (value) => {
    validatorCalls += 1;
    return callback(value);
  };
  const base = makeResolverDependencies();
  const dependencies = {
    validateCapabilityRegistry: count(base.validateCapabilityRegistry),
    validateDeckSpec: count(base.validateDeckSpec),
    validateProjectOverlay: count(base.validateProjectOverlay),
    validateTemplateIndex: count(base.validateTemplateIndex)
  };
  assert.throws(() => prepare(runtime, oversized, dependencies), ProjectDispatchResolutionError);
  assert.equal(validatorCalls, 0);

  const oversizedKey = bundle();
  oversizedKey.deckSpec.slides[1].payload["k".repeat(257)] = true;
  assert.throws(() => prepare(runtime, oversizedKey, dependencies), ProjectDispatchResolutionError);
  assert.equal(validatorCalls, 0);
});

test("snapshotters apply code-unit fast rejects before bounded UTF-8 encoding", () => {
  for (const source of [dispatcherSource, resolverSource]) {
    const stringGuard = source.indexOf("if (value.length > MAX_JSON_STRING_BYTES)");
    const stringEncoding = source.indexOf("encoder.encode(value)", stringGuard);
    const keyGuard = source.indexOf("if (key.length > MAX_JSON_OBJECT_KEY_BYTES)");
    const keyEncoding = source.indexOf("encoder.encode(key)", keyGuard);
    assert.notEqual(stringGuard, -1);
    assert.ok(stringEncoding > stringGuard);
    assert.notEqual(keyGuard, -1);
    assert.ok(keyEncoding > keyGuard);
  }
});

test("sync-only rejected validator Promises are consumed and redacted", async () => {
  const runtime = await makeRuntime("experimental");
  const secret = "private-validator-reason";
  await assertNoUnhandledRejection(async () => {
    assert.throws(
      () => prepare(runtime, bundle(), makeResolverDependencies({
        validateDeckSpec() {
          return Promise.reject(new Error(secret));
        }
      })),
      (error) => {
        assertResolutionError(
          error,
          "PROJECT_DISPATCH_RESOLUTION_DOCUMENT_INVALID",
          "/deckSpec"
        );
        assert.doesNotMatch(error.message, new RegExp(secret, "u"));
        return true;
      }
    );
  });
});

test("payload schema and UTF-8 preflight limits reject unsafe or ambiguous text", async (t) => {
  const invalidPayloads = [
    {},
    { body: ["Body"], title: "Title", extra: true },
    { body: [], title: "Title" },
    { body: [" "], title: "Title" },
    { body: ["line\nbreak"], title: "Title" },
    { body: ["Body"], title: " " },
    { body: ["Body"], title: "\u200b" },
    { body: ["Body"], title: "\u2066Hidden" },
    { body: ["Body"], title: "\ud800" },
    { body: ["Body"], title: "\ufffe" },
    { body: ["Body"], title: "\u{1fffe}" },
    { body: ["Body"], title: "x".repeat(257) }
  ];
  for (let index = 0; index < invalidPayloads.length; index += 1) {
    await t.test(`schema rejection ${index + 1}`, () => {
      assert.notEqual(validateJson(invalidPayloads[index], inputSchema).length, 0);
    });
  }
  const invocation = clone(cases.fixtures[0].invocation);
  invocation.payload.body = Array.from({ length: 16 }, () => "x".repeat(2048));
  invocation.payload.title = "T";
  assert.equal(validateJson(invocation.payload, inputSchema).length, 0);
  assert.equal(preflightSourceSlideCloneFill(invocation), false);

  for (const unsafeText of ["\u200b", "\u2066Hidden", "\ud800", "\ufffe", "\u{1fffe}"]) {
    const unsafeInvocation = clone(cases.fixtures[0].invocation);
    unsafeInvocation.payload.title = unsafeText;
    assert.equal(preflightSourceSlideCloneFill(unsafeInvocation), false);
    const unsafeOutput = executeSourceSlideCloneFill(unsafeInvocation);
    assert.notEqual(validateJson(unsafeOutput, outputSchema).length, 0);
  }
  for (const safeAstralText of ["😀", "\u{10fffd}"]) {
    const safeInvocation = clone(cases.fixtures[0].invocation);
    safeInvocation.payload.title = safeAstralText;
    assert.equal(validateJson(safeInvocation.payload, inputSchema).length, 0);
    assert.equal(preflightSourceSlideCloneFill(safeInvocation), true);
    assert.equal(
      validateJson(executeSourceSlideCloneFill(safeInvocation), outputSchema).length,
      0
    );
  }
});

test("QA assertions reject operation, binding, source, and text drift independently", () => {
  const fixture = cases.fixtures[0];
  const baseline = executeSourceSlideCloneFill(fixture.invocation);
  const mutations = [
    (output) => { output.fills[0].sourceShapeKey = "drifted-shape"; },
    (output) => { output.clone.sourceSlideKey = "drifted-slide"; },
    (output) => { output.fills.reverse(); },
    (output) => { output.fills[0].paragraphs[0] = "Drifted text"; }
  ];
  for (const mutate of mutations) {
    const output = clone(baseline);
    mutate(output);
    assert.equal(
      sourceSlideCloneFillQaAssertions.every((assertion) =>
        assertion.assert({ invocation: fixture.invocation, output }) === true),
      false
    );
  }
});

test("resolver and executor are fixture-neutral, no-I/O modules with clean-directory closure", async () => {
  const fixtureSpecificStrings = [
    ...templateIndex.layouts.map((layout) => layout.layoutKey),
    ...templateIndex.slides.map((slide) => slide.slideKey),
    ...templateIndex.slides.flatMap((slide) => slide.shapes.map((shape) => shape.shapeKey)),
    ...templateIndex.masters.map((master) => master.partPath),
    ...templateIndex.layouts.map((layout) => layout.partPath),
    ...templateIndex.slides.map((slide) => slide.partPath),
    deckSpec.slides[0].payload.title,
    cases.fixtures[0].invocation.payload.title
  ];
  for (const value of fixtureSpecificStrings) {
    assert.equal(executorSource.includes(value), false, `executor contains fixture value ${value}`);
    assert.equal(resolverSource.includes(value), false, `resolver contains fixture value ${value}`);
  }
  for (const source of [resolverSource, executorSource]) {
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

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "clone-fill-closure-"));
  try {
    const coreDirectory = path.join(temporaryRoot, "packages", "core", "src");
    const pluginDirectory = path.join(temporaryRoot, "plugins", "clone-fill", "src");
    await mkdir(coreDirectory, { recursive: true });
    await mkdir(pluginDirectory, { recursive: true });
    await Promise.all([
      copyFile(
        new URL("../packages/core/src/capability-dispatcher.mjs", import.meta.url),
        path.join(coreDirectory, "capability-dispatcher.mjs")
      ),
      copyFile(
        new URL("../packages/core/src/project-dispatch-resolver.mjs", import.meta.url),
        path.join(coreDirectory, "project-dispatch-resolver.mjs")
      ),
      copyFile(
        new URL("../plugins/clone-fill/src/source-slide-clone-fill.mjs", import.meta.url),
        path.join(pluginDirectory, "source-slide-clone-fill.mjs")
      )
    ]);
    const importedResolver = await import(pathToFileURL(
      path.join(coreDirectory, "project-dispatch-resolver.mjs")
    ));
    const importedPlugin = await import(pathToFileURL(
      path.join(pluginDirectory, "source-slide-clone-fill.mjs")
    ));
    assert.equal(typeof importedResolver.prepareResolvedDeckDispatch, "function");
    assert.equal(typeof importedPlugin.executeSourceSlideCloneFill, "function");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
