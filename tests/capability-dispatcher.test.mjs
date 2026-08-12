import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  CAPABILITY_RUNTIME_VERSION,
  CapabilityRuntimeError,
  createCapabilityRuntime,
  executeCapabilityDispatch,
  prepareCapabilityDispatch
} from "../packages/core/src/capability-dispatcher.mjs";
import {
  executeProbe,
  preflightProbe,
  probeQaAssertions
} from "../fixtures/capabilities/dispatcher-contract-probe/runtime.mjs";
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
const contractSchemas = await Promise.all(manifest.schemas.map(({ path: schemaPath }) => readJson(schemaPath)));
const contractSchemaRegistry = createSchemaRegistry(contractSchemas);
for (const schema of contractSchemas) assertSupportedSchema(schema, { registry: contractSchemaRegistry });

const capabilityRegistrySchema = contractSchemaRegistry.get(
  "urn:pptx-compiler:schema:capability-registry:0.1.0"
);
const probeRegistry = await readJson("fixtures/capabilities/dispatcher-contract-probe/registry.json");
const placeholderRegistry = await readJson("fixtures/contracts/valid/capability-registry.json");
const probeInputSchema = await readJson("fixtures/capabilities/dispatcher-contract-probe/input.schema.json");
const probeOutputSchema = await readJson("fixtures/capabilities/dispatcher-contract-probe/output.schema.json");
const probeCases = await readJson("fixtures/capabilities/dispatcher-contract-probe/cases.json");
const dispatcherSource = await readFile(
  new URL("../packages/core/src/capability-dispatcher.mjs", import.meta.url),
  "utf8"
);
const probeRuntimeSource = await readFile(
  new URL("../fixtures/capabilities/dispatcher-contract-probe/runtime.mjs", import.meta.url),
  "utf8"
);

const PROBE = probeRegistry.capabilities[0];

function clone(value) {
  return structuredClone(value);
}

function validateCapabilityRegistry(value) {
  return validateJson(value, capabilityRegistrySchema, {
    rootSchema: capabilityRegistrySchema,
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

function validatorFor(schema, calls) {
  return (value) => {
    calls?.push(value);
    return validateJson(value, schema).length === 0;
  };
}

function supportDecision(status = "experimental", overrides = {}) {
  const dispositions = {
    experimental: "accept-with-warning",
    manual: "report-manual-gate",
    supported: "accept",
    unsupported: "unavailable"
  };
  return {
    supportMatrixItemId: PROBE.supportMatrixItemId,
    supportClaimsEnabled: status === "supported",
    status,
    disposition: dispositions[status],
    ...overrides
  };
}

function makeDependencies({ status = "experimental", decision, overrides = {} } = {}) {
  return {
    validateCapabilityRegistry,
    validateSchemaDocument,
    resolveCapabilitySupport() {
      return decision ?? supportDecision(status);
    },
    ...overrides
  };
}

function makeRegistration(overrides = {}) {
  const inputCalls = overrides.inputCalls;
  const outputCalls = overrides.outputCalls;
  const base = {
    capabilityId: PROBE.capabilityId,
    capabilityVersion: PROBE.capabilityVersion,
    executor: {
      executorId: PROBE.executorId,
      preflight: preflightProbe,
      execute: executeProbe
    },
    inputSchema: {
      schemaId: PROBE.inputSchemaId,
      schema: clone(probeInputSchema),
      validate: validatorFor(probeInputSchema, inputCalls)
    },
    outputSchema: {
      schemaId: PROBE.outputSchemaId,
      schema: clone(probeOutputSchema),
      validate: validatorFor(probeOutputSchema, outputCalls)
    },
    conformanceFixtures: clone(probeCases.fixtures),
    qaContract: {
      qaContractId: PROBE.qaContractId,
      assertions: [...probeQaAssertions]
    }
  };
  return {
    ...base,
    ...overrides,
    executor: overrides.executor === undefined ? base.executor : { ...base.executor, ...overrides.executor },
    inputSchema: overrides.inputSchema === undefined ? base.inputSchema : { ...base.inputSchema, ...overrides.inputSchema },
    outputSchema: overrides.outputSchema === undefined ? base.outputSchema : { ...base.outputSchema, ...overrides.outputSchema },
    qaContract: overrides.qaContract === undefined ? base.qaContract : { ...base.qaContract, ...overrides.qaContract }
  };
}

async function makeRuntime({
  capabilityRegistry = clone(probeRegistry),
  registrations,
  registration,
  dependencies
} = {}) {
  return createCapabilityRuntime({
    capabilityRegistry,
    registrations: registrations ?? [registration ?? makeRegistration()],
    dependencies: dependencies ?? makeDependencies()
  });
}

function makeInvocation(overrides = {}) {
  const base = clone(probeCases.fixtures[0].invocation);
  return {
    ...base,
    ...overrides,
    payload: overrides.payload === undefined ? base.payload : overrides.payload,
    bindings: overrides.bindings === undefined ? base.bindings : overrides.bindings
  };
}

function assertRuntimeError(error, code, pointer) {
  assert.ok(error instanceof CapabilityRuntimeError);
  assert.equal(error.code, code);
  assert.equal(error.pointer, pointer);
  assert.deepEqual(error.toJSON(), { code, pointer });
  return true;
}

function assertThrows(callback, code, pointer) {
  assert.throws(callback, (error) => assertRuntimeError(error, code, pointer));
}

async function assertRejects(promise, code, pointer) {
  await assert.rejects(promise, (error) => assertRuntimeError(error, code, pointer));
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

test("conformance-only runtime atomically admits a complete artifact registration", async () => {
  let registryCalls = 0;
  let schemaCalls = 0;
  let supportCalls = 0;
  const registryInput = clone(probeRegistry);
  const registration = makeRegistration();
  const runtime = await makeRuntime({
    capabilityRegistry: registryInput,
    registration,
    dependencies: makeDependencies({
      overrides: {
        validateCapabilityRegistry(value) {
          registryCalls += 1;
          assert.ok(Object.isFrozen(value));
          assert.ok(Object.isFrozen(value.capabilities));
          return validateCapabilityRegistry(value);
        },
        validateSchemaDocument(value) {
          schemaCalls += 1;
          assert.ok(Object.isFrozen(value));
          return validateSchemaDocument(value);
        },
        resolveCapabilitySupport(query) {
          supportCalls += 1;
          assert.ok(Object.isFrozen(query));
          return supportDecision("experimental");
        }
      }
    })
  });

  assert.deepEqual(runtime, {
    runtimeVersion: "0.1.0",
    runtimeType: "capability-runtime",
    capabilityRegistryId: "dispatcher-conformance-registry",
    registryVersion: "0.1.0",
    knownCapabilityCount: 1,
    executableCapabilityCount: 1
  });
  assert.equal(CAPABILITY_RUNTIME_VERSION, "0.1.0");
  assert.equal(registryCalls, 1);
  assert.equal(schemaCalls, 2);
  assert.equal(supportCalls, 1);
  assert.ok(Object.isFrozen(runtime));

  registryInput.capabilities[0].executorId = "urn:pptx-compiler:changed:executor:0.1.0";
  registration.executor.execute = () => ({ accepted: false });
  const plan = prepareCapabilityDispatch({ runtime, invocations: [makeInvocation()] });
  const result = await executeCapabilityDispatch({ plan });
  assert.equal(result.results[0].output.accepted, true);
});

test("async conformance never rereads caller-owned registration entries", async () => {
  const makeDefinition = (prefix) => ({
    ...clone(PROBE),
    capabilityId: `${prefix}-dispatcher-probe`,
    executorId: `urn:pptx-compiler:executor:${prefix}-dispatcher-probe:0.1.0`,
    inputSchemaId: `urn:pptx-compiler:schema:${prefix}-dispatcher-input:0.1.0`,
    outputSchemaId: `urn:pptx-compiler:schema:${prefix}-dispatcher-output:0.1.0`,
    qaContractId: `urn:pptx-compiler:qa:${prefix}-dispatcher-probe:0.1.0`,
    conformanceFixtureIds: [`${prefix}-dispatcher-fixture`]
  });
  const makeNamedRegistration = (definition, execute) => {
    const inputSchema = clone(probeInputSchema);
    const outputSchema = clone(probeOutputSchema);
    inputSchema.$id = definition.inputSchemaId;
    outputSchema.$id = definition.outputSchemaId;
    const fixture = clone(probeCases.fixtures[0]);
    fixture.fixtureId = definition.conformanceFixtureIds[0];
    fixture.invocation.invocationId = `${definition.capabilityId}-invocation`;
    fixture.invocation.capabilitySelectionId = `${definition.capabilityId}-selection`;
    fixture.invocation.capabilityId = definition.capabilityId;
    return {
      capabilityId: definition.capabilityId,
      capabilityVersion: definition.capabilityVersion,
      executor: {
        executorId: definition.executorId,
        preflight: preflightProbe,
        execute
      },
      inputSchema: {
        schemaId: definition.inputSchemaId,
        schema: inputSchema,
        validate: validatorFor(inputSchema)
      },
      outputSchema: {
        schemaId: definition.outputSchemaId,
        schema: outputSchema,
        validate: validatorFor(outputSchema)
      },
      conformanceFixtures: [fixture],
      qaContract: {
        qaContractId: definition.qaContractId,
        assertions: [...probeQaAssertions]
      }
    };
  };

  const firstDefinition = makeDefinition("alpha");
  const secondDefinition = makeDefinition("omega");
  const registry = clone(probeRegistry);
  registry.capabilities = [firstDefinition, secondDefinition];
  let firstCalls = 0;
  let secondCalls = 0;
  let releaseFirst;
  let markFirstStarted;
  const firstStarted = new Promise((resolve) => { markFirstStarted = resolve; });
  const first = makeNamedRegistration(firstDefinition, () => {
    firstCalls += 1;
    if (firstCalls !== 1) return executeProbe();
    markFirstStarted();
    return new Promise((resolve) => {
      releaseFirst = () => resolve(executeProbe());
    });
  });
  const second = makeNamedRegistration(secondDefinition, () => {
    secondCalls += 1;
    return { accepted: false, resultType: "dispatcher-conformance-probe" };
  });
  const registrations = [first, second];
  const runtimePromise = makeRuntime({ capabilityRegistry: registry, registrations });
  await firstStarted;
  registrations[1].capabilityId = firstDefinition.capabilityId;
  releaseFirst();
  await assertRejects(
    runtimePromise,
    "CAPABILITY_RUNTIME_CONFORMANCE_INVALID",
    "/registrations/1/conformanceFixtures/0"
  );
  assert.equal(firstCalls, 1);
  assert.equal(secondCalls, 1);
});

test("prepare validates the full batch before execute and results preserve source order", async () => {
  const events = [];
  const registration = makeRegistration({
    executor: {
      preflight(invocation) {
        events.push(`preflight:${invocation.invocationId}`);
        return true;
      },
      async execute(invocation) {
        events.push(`execute:${invocation.invocationId}`);
        return { accepted: true, resultType: "dispatcher-conformance-probe" };
      }
    },
    inputSchema: {
      validate(value) {
        events.push(`input:${value.value}`);
        return validateJson(value, probeInputSchema).length === 0;
      }
    },
    outputSchema: {
      validate(value) {
        events.push(`output:${value.resultType}`);
        return validateJson(value, probeOutputSchema).length === 0;
      }
    },
    qaContract: {
      assertions: [
        {
          assertionId: "batch-qa",
          assert({ invocation }) {
            events.push(`qa:${invocation.invocationId}`);
            return true;
          }
        }
      ]
    }
  });
  const runtime = await makeRuntime({ registration });
  events.length = 0;
  const first = makeInvocation({
    invocationId: "invocation-one",
    payload: { value: "first-value" }
  });
  const second = makeInvocation({
    invocationId: "invocation-two",
    payload: { value: "second-value" }
  });
  const plan = prepareCapabilityDispatch({ runtime, invocations: [first, second] });
  assert.deepEqual(events, [
    "input:first-value",
    "input:second-value",
    "preflight:invocation-one",
    "preflight:invocation-two"
  ]);
  const result = await executeCapabilityDispatch({ plan });
  assert.deepEqual(events.slice(4), [
    "execute:invocation-one",
    "output:dispatcher-conformance-probe",
    "qa:invocation-one",
    "execute:invocation-two",
    "output:dispatcher-conformance-probe",
    "qa:invocation-two"
  ]);
  assert.deepEqual(result.results.map((item) => item.invocationId), ["invocation-one", "invocation-two"]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.results));
  assert.ok(Object.isFrozen(result.results[0]));
  assert.ok(Object.isFrozen(result.results[0].output));
  assert.deepEqual(first.payload, { value: "first-value" });
});

test("an invalid later input prevents every preflight and execute call", async () => {
  let preflightCalls = 0;
  let executeCalls = 0;
  const runtime = await makeRuntime({
    registration: makeRegistration({
      executor: {
        preflight(invocation) {
          if (invocation.invocationId !== "probe-invocation-one") preflightCalls += 1;
          return true;
        },
        execute(invocation) {
          if (invocation.invocationId !== "probe-invocation-one") executeCalls += 1;
          return executeProbe();
        }
      }
    })
  });
  assertThrows(
    () => prepareCapabilityDispatch({
      runtime,
      invocations: [
        makeInvocation({ invocationId: "valid-invocation" }),
        makeInvocation({ invocationId: "invalid-invocation", payload: { value: "INVALID VALUE" } })
      ]
    }),
    "CAPABILITY_RUNTIME_INPUT_INVALID",
    "/invocations/1/payload"
  );
  assert.equal(preflightCalls, 0);
  assert.equal(executeCalls, 0);
});

test("dispatch plans are authentic, detached, and atomically one-shot", async () => {
  let release;
  const runtime = await makeRuntime({
    registration: makeRegistration({
      executor: {
        execute(invocation) {
          if (invocation.invocationId === "probe-invocation-one") return executeProbe();
          return new Promise((resolve) => {
            release = () => resolve(executeProbe());
          });
        }
      }
    })
  });
  const source = makeInvocation({ invocationId: "one-shot-invocation" });
  const plan = prepareCapabilityDispatch({ runtime, invocations: [source] });
  source.payload.value = "changed-after-prepare";
  assert.ok(Object.isFrozen(plan));
  const first = executeCapabilityDispatch({ plan });
  await assertRejects(
    executeCapabilityDispatch({ plan }),
    "CAPABILITY_RUNTIME_PLAN_CONSUMED",
    "/plan"
  );
  await assertRejects(
    executeCapabilityDispatch({ plan: { ...plan } }),
    "CAPABILITY_RUNTIME_PLAN_INVALID",
    "/plan"
  );
  release();
  const result = await first;
  assert.equal(result.results[0].output.accepted, true);
});

test("the schema-only placeholder registry remains valid metadata but unavailable at runtime", async () => {
  assert.equal(validateCapabilityRegistry(placeholderRegistry), true);
  let supportCalls = 0;
  const runtime = await makeRuntime({
    capabilityRegistry: clone(placeholderRegistry),
    registrations: [],
    dependencies: makeDependencies({
      overrides: {
        resolveCapabilitySupport() {
          supportCalls += 1;
          return supportDecision("unsupported");
        }
      }
    })
  });
  assert.equal(runtime.knownCapabilityCount, 1);
  assert.equal(runtime.executableCapabilityCount, 0);
  const candidate = makeInvocation({
    capabilityId: "source-slide-clone-fill",
    capabilityVersion: "0.1.0"
  });
  assertThrows(
    () => prepareCapabilityDispatch({ runtime, invocations: [candidate] }),
    "CAPABILITY_RUNTIME_CAPABILITY_UNAVAILABLE",
    "/invocations/0/capabilityId"
  );
  assert.equal(supportCalls, 0);
});

test("registration is rejected unless every artifact is present and exactly bound", async (t) => {
  const cases = [
    ["unknown field", (item) => { item.dynamicModulePath = "disabled"; }, "/registrations/0"],
    ["executor ID", (item) => { item.executor.executorId = `${PROBE.executorId}-changed`; }, "/registrations/0/executor/executorId"],
    ["input schema ID", (item) => { item.inputSchema.schemaId = PROBE.outputSchemaId; }, "/registrations/0/inputSchema/schemaId"],
    ["output schema ID", (item) => { item.outputSchema.schemaId = PROBE.inputSchemaId; }, "/registrations/0/outputSchema/schemaId"],
    ["QA contract ID", (item) => { item.qaContract.qaContractId = `${PROBE.qaContractId}-changed`; }, "/registrations/0/qaContract/qaContractId"],
    ["missing preflight", (item) => { delete item.executor.preflight; }, "/registrations/0/executor"],
    ["missing execute", (item) => { delete item.executor.execute; }, "/registrations/0/executor"],
    ["empty fixtures", (item) => { item.conformanceFixtures = []; }, "/registrations/0/conformanceFixtures"],
    ["fixture ID", (item) => { item.conformanceFixtures[0].fixtureId = "changed-fixture"; }, "/registrations/0/conformanceFixtures/0/fixtureId"],
    ["empty QA", (item) => { item.qaContract.assertions = []; }, "/registrations/0/qaContract/assertions"],
    ["duplicate QA", (item) => { item.qaContract.assertions = [item.qaContract.assertions[0], item.qaContract.assertions[0]]; }, "/registrations/0/qaContract/assertions/1/assertionId"],
    ["schema document ID", (item) => { item.inputSchema.schema.$id = `${PROBE.inputSchemaId}-changed`; }, "/registrations/0/inputSchema/schema"]
  ];
  for (const [name, mutate, pointer] of cases) {
    await t.test(name, async () => {
      const registration = makeRegistration();
      mutate(registration);
      await assertRejects(
        makeRuntime({ registration }),
        "CAPABILITY_RUNTIME_REGISTRATION_INVALID",
        pointer
      );
    });
  }
});

test("orphan, duplicate, and unsorted registrations fail atomically", async (t) => {
  await t.test("orphan", async () => {
    const registration = makeRegistration({ capabilityId: "unknown-probe" });
    await assertRejects(
      makeRuntime({ registration }),
      "CAPABILITY_RUNTIME_REGISTRATION_INVALID",
      "/registrations/0/capabilityId"
    );
  });
  await t.test("duplicate", async () => {
    await assertRejects(
      makeRuntime({ registrations: [makeRegistration(), makeRegistration()] }),
      "CAPABILITY_RUNTIME_REGISTRATION_INVALID",
      "/registrations/1/capabilityId"
    );
  });
  await t.test("empty declared fixture list cannot be registered", async () => {
    const registry = clone(probeRegistry);
    registry.capabilities[0].conformanceFixtureIds = [];
    const registration = makeRegistration({ conformanceFixtures: [] });
    await assertRejects(
      makeRuntime({ capabilityRegistry: registry, registration }),
      "CAPABILITY_RUNTIME_REGISTRATION_INVALID",
      "/registrations/0/conformanceFixtures"
    );
  });
});

test("support policy blocks unavailable, manual, unclaimed, and non-opted-in dispatch", async (t) => {
  const cases = [
    ["unsupported", supportDecision("unsupported"), true, "CAPABILITY_RUNTIME_CAPABILITY_UNAVAILABLE", "/invocations/0/capabilityId"],
    ["manual", supportDecision("manual"), true, "CAPABILITY_RUNTIME_MANUAL_GATE_REQUIRED", "/invocations/0/capabilityId"],
    ["experimental opt-in", supportDecision("experimental"), false, "CAPABILITY_RUNTIME_EXPERIMENTAL_OPT_IN_REQUIRED", "/invocations/0/experimentalOptIn"]
  ];
  for (const [name, decision, optIn, code, pointer] of cases) {
    await t.test(name, async () => {
      const runtime = await makeRuntime({ dependencies: makeDependencies({ decision }) });
      assertThrows(
        () => prepareCapabilityDispatch({
          runtime,
          invocations: [makeInvocation({ experimentalOptIn: optIn })]
        }),
        code,
        pointer
      );
    });
  }
  await t.test("supported while claims disabled", async () => {
    await assertRejects(
      makeRuntime({
        dependencies: makeDependencies({
          decision: supportDecision("supported", { supportClaimsEnabled: false })
        })
      }),
      "CAPABILITY_RUNTIME_SUPPORT_INVALID",
      "/registrations/0/support"
    );
  });
  await t.test("supported with claims enabled", async () => {
    const runtime = await makeRuntime({ dependencies: makeDependencies({ status: "supported" }) });
    const plan = prepareCapabilityDispatch({
      runtime,
      invocations: [makeInvocation({ experimentalOptIn: false })]
    });
    const result = await executeCapabilityDispatch({ plan });
    assert.equal(result.results[0].supportStatus, "supported");
  });
});

test("lookup, version, invocation, and binding ambiguity fail before execution", async (t) => {
  let executes = 0;
  const runtime = await makeRuntime({
    registration: makeRegistration({
      executor: {
        execute(invocation) {
          if (invocation.invocationId !== "probe-invocation-one") executes += 1;
          return executeProbe();
        }
      }
    })
  });
  const cases = [
    ["unknown capability", [makeInvocation({ capabilityId: "unknown-probe" })], "CAPABILITY_RUNTIME_UNKNOWN_CAPABILITY", "/invocations/0/capabilityId"],
    ["version mismatch", [makeInvocation({ capabilityVersion: "0.2.0" })], "CAPABILITY_RUNTIME_VERSION_MISMATCH", "/invocations/0/capabilityVersion"],
    ["duplicate invocation", [makeInvocation(), makeInvocation()], "CAPABILITY_RUNTIME_REQUEST_INVALID", "/invocations/1/invocationId"],
    ["missing binding", [makeInvocation({ bindings: [] })], "CAPABILITY_RUNTIME_BINDING_INVALID", "/invocations/0/bindings"],
    ["wrong role", [makeInvocation({ bindings: [{ ...makeInvocation().bindings[0], role: "wrong-role" }] })], "CAPABILITY_RUNTIME_BINDING_INVALID", "/invocations/0/bindings/0/role"],
    ["wrong cardinality", [makeInvocation({ bindings: [{ ...makeInvocation().bindings[0], cardinality: "many" }] })], "CAPABILITY_RUNTIME_BINDING_INVALID", "/invocations/0/bindings/0/cardinality"]
  ];
  for (const [name, invocations, code, pointer] of cases) {
    await t.test(name, () => {
      assertThrows(() => prepareCapabilityDispatch({ runtime, invocations }), code, pointer);
    });
  }
  assert.equal(executes, 0);
});

test("validator and preflight failures are synchronous, exact, and fail before execute", async (t) => {
  const cases = [
    ["input false", () => ({
      inputSchema: {
        validate: (value) => value.value === "public-synthetic-value"
      }
    }), "CAPABILITY_RUNTIME_INPUT_INVALID", "/invocations/0/payload"],
    ["input promise", () => ({
      inputSchema: {
        validate: (value) => value.value === "public-synthetic-value" ? true : Promise.resolve(true)
      }
    }), "CAPABILITY_RUNTIME_INPUT_INVALID", "/invocations/0/payload"],
    ["input throw", () => ({
      inputSchema: {
        validate(value) {
          if (value.value === "public-synthetic-value") return true;
          throw new Error("private-input");
        }
      }
    }), "CAPABILITY_RUNTIME_INPUT_INVALID", "/invocations/0/payload"],
    ["preflight false", () => ({
      executor: {
        preflight: (invocation) => invocation.invocationId === "probe-invocation-one"
      }
    }), "CAPABILITY_RUNTIME_PREFLIGHT_REJECTED", "/invocations/0"],
    ["preflight promise", () => ({
      executor: {
        preflight: (invocation) => invocation.invocationId === "probe-invocation-one"
          ? true
          : Promise.resolve(true)
      }
    }), "CAPABILITY_RUNTIME_PREFLIGHT_REJECTED", "/invocations/0"]
  ];
  for (const [name, makeOverride, code, pointer] of cases) {
    await t.test(name, async () => {
      let executeCalls = 0;
      const override = makeOverride();
      const registration = makeRegistration({
        ...override,
        executor: {
          ...override.executor,
          execute(invocation) {
            if (invocation.invocationId !== "probe-invocation-one") executeCalls += 1;
            return executeProbe();
          }
        }
      });
      const runtime = await makeRuntime({ registration });
      assertThrows(
        () => prepareCapabilityDispatch({
          runtime,
          invocations: [makeInvocation({
            invocationId: "runtime-validator-case",
            payload: { value: "runtime-valid-value" }
          })]
        }),
        code,
        pointer
      );
      assert.equal(executeCalls, 0);
    });
  }
});

test("execution, output, and QA failures are redacted and terminate the plan", async (t) => {
  const cases = [
    ["executor throw", {
      executor: {
        execute(invocation) {
          if (invocation.invocationId === "probe-invocation-one") return executeProbe();
          throw new Error("private-executor-secret");
        }
      }
    }, "CAPABILITY_RUNTIME_EXECUTION_FAILED", "/invocations/0/output"],
    ["invalid output", {
      executor: {
        execute(invocation) {
          return invocation.invocationId === "probe-invocation-one" ? executeProbe() : { accepted: false };
        }
      }
    }, "CAPABILITY_RUNTIME_OUTPUT_INVALID", "/invocations/0/output"],
    ["QA false", {
      qaContract: {
        assertions: [{
          assertionId: "conditional-qa",
          assert({ invocation }) {
            return invocation.invocationId === "probe-invocation-one";
          }
        }]
      }
    }, "CAPABILITY_RUNTIME_QA_FAILED", "/invocations/0/output/qaAssertions/0"]
  ];
  for (const [name, override, code, pointer] of cases) {
    await t.test(name, async () => {
      const runtime = await makeRuntime({ registration: makeRegistration(override) });
      const plan = prepareCapabilityDispatch({
        runtime,
        invocations: [makeInvocation({ invocationId: "runtime-failure-case" })]
      });
      await assert.rejects(executeCapabilityDispatch({ plan }), (error) => {
        assertRuntimeError(error, code, pointer);
        assert.equal(error.message.includes("private-executor-secret"), false);
        return true;
      });
      await assertRejects(
        executeCapabilityDispatch({ plan }),
        "CAPABILITY_RUNTIME_PLAN_CONSUMED",
        "/plan"
      );
    });
  }
});

test("accessors and non-JSON payload/output values fail without invoking getters", async (t) => {
  await t.test("options accessor", async () => {
    let invoked = false;
    const options = {
      registrations: [],
      dependencies: makeDependencies()
    };
    Object.defineProperty(options, "capabilityRegistry", {
      enumerable: true,
      get() {
        invoked = true;
        return probeRegistry;
      }
    });
    await assertRejects(
      createCapabilityRuntime(options),
      "CAPABILITY_RUNTIME_ARGUMENT_INVALID",
      "/capabilityRegistry"
    );
    assert.equal(invoked, false);
  });

  await t.test("payload accessor", async () => {
    const runtime = await makeRuntime();
    let invoked = false;
    const invocation = makeInvocation();
    Object.defineProperty(invocation, "payload", {
      enumerable: true,
      get() {
        invoked = true;
        return { value: "hidden" };
      }
    });
    assertThrows(
      () => prepareCapabilityDispatch({ runtime, invocations: [invocation] }),
      "CAPABILITY_RUNTIME_REQUEST_INVALID",
      "/invocations/0/payload"
    );
    assert.equal(invoked, false);
  });

  for (const [name, payload] of [
    ["cycle", (() => { const value = {}; value.self = value; return value; })()],
    ["bigint", { value: 1n }],
    ["date", { value: new Date(0) }],
    ["negative zero", { value: -0 }]
  ]) {
    await t.test(name, async () => {
      const runtime = await makeRuntime();
      assertThrows(
        () => prepareCapabilityDispatch({ runtime, invocations: [makeInvocation({ payload })] }),
        "CAPABILITY_RUNTIME_REQUEST_INVALID",
        "/invocations/0/payload"
      );
    });
  }

  await t.test("output accessor", async () => {
    let invoked = false;
    const runtime = await makeRuntime({
      registration: makeRegistration({
        executor: {
          execute(invocation) {
            if (invocation.invocationId === "probe-invocation-one") return executeProbe();
            const output = { resultType: "dispatcher-conformance-probe" };
            Object.defineProperty(output, "accepted", {
              enumerable: true,
              get() {
                invoked = true;
                return true;
              }
            });
            return output;
          }
        }
      })
    });
    const plan = prepareCapabilityDispatch({
      runtime,
      invocations: [makeInvocation({ invocationId: "accessor-output" })]
    });
    await assertRejects(
      executeCapabilityDispatch({ plan }),
      "CAPABILITY_RUNTIME_OUTPUT_INVALID",
      "/invocations/0/output"
    );
    assert.equal(invoked, false);
  });
});

test("conformance mismatch, async QA, and malformed support data prevent runtime publication", async (t) => {
  await t.test("conformance mismatch", async () => {
    const fixtures = clone(probeCases.fixtures);
    fixtures[0].expectedOutput.accepted = false;
    await assertRejects(
      makeRuntime({ registration: makeRegistration({ conformanceFixtures: fixtures }) }),
      "CAPABILITY_RUNTIME_CONFORMANCE_INVALID",
      "/registrations/0/conformanceFixtures/0"
    );
  });
  await t.test("async QA is rejected", async () => {
    await assertRejects(
      makeRuntime({
        registration: makeRegistration({
          qaContract: {
            assertions: [{ assertionId: "async-qa", assert: async () => true }]
          }
        })
      }),
      "CAPABILITY_RUNTIME_CONFORMANCE_INVALID",
      "/registrations/0/conformanceFixtures/0"
    );
  });
  await t.test("support item drift", async () => {
    await assertRejects(
      makeRuntime({
        dependencies: makeDependencies({
          decision: supportDecision("experimental", { supportMatrixItemId: "different-item" })
        })
      }),
      "CAPABILITY_RUNTIME_SUPPORT_INVALID",
      "/registrations/0/support"
    );
  });
});

test("dependency failures and callable accessors are rejected without becoming runtime authority", async (t) => {
  const dependencyCases = [
    ["registry false", { validateCapabilityRegistry: () => false }, "CAPABILITY_RUNTIME_REGISTRY_INVALID", "/capabilityRegistry"],
    ["registry promise", { validateCapabilityRegistry: () => Promise.resolve(true) }, "CAPABILITY_RUNTIME_REGISTRY_INVALID", "/capabilityRegistry"],
    ["registry throw", { validateCapabilityRegistry() { throw new Error("private-registry"); } }, "CAPABILITY_RUNTIME_REGISTRY_INVALID", "/capabilityRegistry"],
    ["schema false", { validateSchemaDocument: () => false }, "CAPABILITY_RUNTIME_REGISTRATION_INVALID", "/registrations/0/inputSchema/schema"],
    ["schema promise", { validateSchemaDocument: () => Promise.resolve(true) }, "CAPABILITY_RUNTIME_REGISTRATION_INVALID", "/registrations/0/inputSchema/schema"],
    ["support promise", { resolveCapabilitySupport: () => Promise.resolve(supportDecision()) }, "CAPABILITY_RUNTIME_SUPPORT_INVALID", "/registrations/0/support"]
  ];
  for (const [name, override, code, pointer] of dependencyCases) {
    await t.test(name, async () => {
      await assertRejects(
        makeRuntime({ dependencies: makeDependencies({ overrides: override }) }),
        code,
        pointer
      );
    });
  }

  await t.test("executor accessor", async () => {
    let invoked = false;
    const registration = makeRegistration();
    Object.defineProperty(registration.executor, "execute", {
      enumerable: true,
      get() {
        invoked = true;
        return executeProbe;
      }
    });
    await assertRejects(
      makeRuntime({ registration }),
      "CAPABILITY_RUNTIME_REGISTRATION_INVALID",
      "/registrations/0/executor/execute"
    );
    assert.equal(invoked, false);
  });

  await t.test("execute options accessor", async () => {
    let invoked = false;
    const options = {};
    Object.defineProperty(options, "plan", {
      enumerable: true,
      get() {
        invoked = true;
        return {};
      }
    });
    await assertRejects(
      executeCapabilityDispatch(options),
      "CAPABILITY_RUNTIME_ARGUMENT_INVALID",
      "/plan"
    );
    assert.equal(invoked, false);
  });
});

test("rejected Promises from sync-only callbacks are consumed and redacted", async () => {
  const rejected = (stage) => Promise.reject(new Error(`private-${stage}-secret`));
  await assertNoUnhandledRejection(async () => {
    await assertRejects(
      makeRuntime({
        dependencies: makeDependencies({
          overrides: { validateCapabilityRegistry: () => rejected("registry") }
        })
      }),
      "CAPABILITY_RUNTIME_REGISTRY_INVALID",
      "/capabilityRegistry"
    );
    await assertRejects(
      makeRuntime({
        dependencies: makeDependencies({
          overrides: { validateSchemaDocument: () => rejected("schema") }
        })
      }),
      "CAPABILITY_RUNTIME_REGISTRATION_INVALID",
      "/registrations/0/inputSchema/schema"
    );
    await assertRejects(
      makeRuntime({
        dependencies: makeDependencies({
          overrides: { resolveCapabilitySupport: () => rejected("support") }
        })
      }),
      "CAPABILITY_RUNTIME_SUPPORT_INVALID",
      "/registrations/0/support"
    );

    const inputRuntime = await makeRuntime({
      registration: makeRegistration({
        inputSchema: {
          validate(value) {
            return value.value === "public-synthetic-value" ? true : rejected("input");
          }
        }
      })
    });
    assertThrows(
      () => prepareCapabilityDispatch({
        runtime: inputRuntime,
        invocations: [makeInvocation({ payload: { value: "runtime-input" } })]
      }),
      "CAPABILITY_RUNTIME_INPUT_INVALID",
      "/invocations/0/payload"
    );

    const preflightRuntime = await makeRuntime({
      registration: makeRegistration({
        executor: {
          preflight(invocation) {
            return invocation.invocationId === "probe-invocation-one"
              ? true
              : rejected("preflight");
          }
        }
      })
    });
    assertThrows(
      () => prepareCapabilityDispatch({
        runtime: preflightRuntime,
        invocations: [makeInvocation({ invocationId: "runtime-preflight" })]
      }),
      "CAPABILITY_RUNTIME_PREFLIGHT_REJECTED",
      "/invocations/0"
    );

    const outputRuntime = await makeRuntime({
      registration: makeRegistration({
        executor: {
          execute(invocation) {
            return invocation.invocationId === "probe-invocation-one"
              ? executeProbe()
              : { accepted: true, resultType: "runtime-output" };
          }
        },
        outputSchema: {
          validate(value) {
            return value.resultType === "dispatcher-conformance-probe"
              ? true
              : rejected("output");
          }
        }
      })
    });
    await assertRejects(
      executeCapabilityDispatch({
        plan: prepareCapabilityDispatch({
          runtime: outputRuntime,
          invocations: [makeInvocation({ invocationId: "runtime-output" })]
        })
      }),
      "CAPABILITY_RUNTIME_OUTPUT_INVALID",
      "/invocations/0/output"
    );

    const qaRuntime = await makeRuntime({
      registration: makeRegistration({
        qaContract: {
          assertions: [{
            assertionId: "rejected-qa",
            assert({ invocation }) {
              return invocation.invocationId === "probe-invocation-one"
                ? true
                : rejected("qa");
            }
          }]
        }
      })
    });
    await assertRejects(
      executeCapabilityDispatch({
        plan: prepareCapabilityDispatch({
          runtime: qaRuntime,
          invocations: [makeInvocation({ invocationId: "runtime-qa" })]
        })
      }),
      "CAPABILITY_RUNTIME_QA_FAILED",
      "/invocations/0/output/qaAssertions/0"
    );
  });
});

test("payload and output resource ceilings apply before validators can accept oversized JSON", async (t) => {
  const runtime = await makeRuntime();
  let deep = "leaf";
  for (let index = 0; index < 66; index += 1) deep = { nested: deep };
  const sparse = [];
  sparse.length = 2;
  const cases = [
    ["string", { value: "a".repeat(256 * 1024 + 1) }],
    ["object key", { ["k".repeat(257)]: true }],
    ["array", { value: Array.from({ length: 4097 }, () => 1) }],
    ["depth", deep],
    ["sparse", sparse],
    ["function", { value() {} }]
  ];
  for (const [name, payload] of cases) {
    await t.test(name, () => {
      assertThrows(
        () => prepareCapabilityDispatch({ runtime, invocations: [makeInvocation({ payload })] }),
        "CAPABILITY_RUNTIME_REQUEST_INVALID",
        "/invocations/0/payload"
      );
    });
  }

  await t.test("input aggregate string total before validator", async () => {
    let inputCalls = 0;
    const boundedRuntime = await makeRuntime({
      registration: makeRegistration({
        inputSchema: {
          validate(value) {
            if (value.value !== "public-synthetic-value") inputCalls += 1;
            return true;
          }
        }
      })
    });
    const shared = "a".repeat(256 * 1024);
    assertThrows(
      () => prepareCapabilityDispatch({
        runtime: boundedRuntime,
        invocations: [makeInvocation({
          payload: { values: Array.from({ length: 4096 }, () => shared) }
        })]
      }),
      "CAPABILITY_RUNTIME_REQUEST_INVALID",
      "/invocations/0/payload"
    );
    assert.equal(inputCalls, 0);
  });

  await t.test("runtime artifact aggregate string total before conformance", async () => {
    let inputCalls = 0;
    const registration = makeRegistration({
      inputSchema: {
        validate() {
          inputCalls += 1;
          return true;
        }
      }
    });
    const shared = "a".repeat(256 * 1024);
    registration.conformanceFixtures[0].invocation.payload = {
      values: Array.from({ length: 4096 }, () => shared)
    };
    await assertRejects(
      makeRuntime({ registration }),
      "CAPABILITY_RUNTIME_REGISTRATION_INVALID",
      "/registrations/0/conformanceFixtures/0/invocation"
    );
    assert.equal(inputCalls, 0);
  });

  await t.test("output aggregate string total before validator or QA", async () => {
    let outputCalls = 0;
    let qaCalls = 0;
    const shared = "a".repeat(256 * 1024);
    const largeOutput = Object.freeze({
      values: Object.freeze(Array.from({ length: 4096 }, () => shared))
    });
    const boundedRuntime = await makeRuntime({
      registration: makeRegistration({
        executor: {
          execute(invocation) {
            return invocation.invocationId === "probe-invocation-one" ? executeProbe() : largeOutput;
          }
        },
        outputSchema: {
          validate(value) {
            if (value.resultType !== "dispatcher-conformance-probe") outputCalls += 1;
            return true;
          }
        },
        qaContract: {
          assertions: [{
            assertionId: "bounded-output",
            assert({ invocation }) {
              if (invocation.invocationId !== "probe-invocation-one") qaCalls += 1;
              return true;
            }
          }]
        }
      })
    });
    await assertRejects(
      executeCapabilityDispatch({
        plan: prepareCapabilityDispatch({
          runtime: boundedRuntime,
          invocations: [makeInvocation({ invocationId: "large-string-output" })]
        })
      }),
      "CAPABILITY_RUNTIME_OUTPUT_INVALID",
      "/invocations/0/output"
    );
    assert.equal(outputCalls, 0);
    assert.equal(qaCalls, 0);
  });

  await t.test("output aggregate includes object key bytes", async () => {
    const longKeyOutput = Object.freeze(Object.fromEntries(
      Array.from({ length: 256 }, (_, index) => [
        `k${String(index).padStart(3, "0")}${"x".repeat(252)}`,
        index
      ])
    ));
    const keyRuntime = await makeRuntime({
      registration: makeRegistration({
        executor: {
          execute(invocation) {
            return invocation.invocationId === "probe-invocation-one"
              ? executeProbe()
              : longKeyOutput;
          }
        },
        outputSchema: { validate: () => true },
        qaContract: {
          assertions: [{ assertionId: "bounded-keys", assert: () => true }]
        }
      })
    });
    const invocations = Array.from({ length: 65 }, (_, index) => makeInvocation({
      invocationId: `key-output-${String(index).padStart(2, "0")}`
    }));
    await assertRejects(
      executeCapabilityDispatch({
        plan: prepareCapabilityDispatch({ runtime: keyRuntime, invocations })
      }),
      "CAPABILITY_RUNTIME_OUTPUT_INVALID",
      "/invocations/64/output"
    );
  });

  await t.test("batch output total", async () => {
    const largeOutput = Object.freeze({
      accepted: true,
      resultType: "dispatcher-conformance-probe",
      values: Object.freeze(Array.from({ length: 4096 }, () => 1))
    });
    const largeRuntime = await makeRuntime({
      registration: makeRegistration({
        executor: {
          execute(invocation) {
            return invocation.invocationId === "probe-invocation-one" ? executeProbe() : largeOutput;
          }
        },
        outputSchema: { validate: () => true },
        qaContract: {
          assertions: [{ assertionId: "bounded-output", assert: () => true }]
        }
      })
    });
    const invocations = Array.from({ length: 50 }, (_, index) => makeInvocation({
      invocationId: `large-output-${String(index).padStart(2, "0")}`
    }));
    const plan = prepareCapabilityDispatch({ runtime: largeRuntime, invocations });
    await assertRejects(
      executeCapabilityDispatch({ plan }),
      "CAPABILITY_RUNTIME_OUTPUT_INVALID",
      "/invocations/48/output"
    );
  });
});

test("executors receive frozen invocations and returned references are detached", async (t) => {
  await t.test("mutation attempt", async () => {
    const runtime = await makeRuntime({
      registration: makeRegistration({
        executor: {
          execute(invocation) {
            if (invocation.invocationId === "probe-invocation-one") return executeProbe();
            invocation.payload.value = "mutated";
            return executeProbe();
          }
        }
      })
    });
    const plan = prepareCapabilityDispatch({
      runtime,
      invocations: [makeInvocation({ invocationId: "mutation-attempt" })]
    });
    await assertRejects(
      executeCapabilityDispatch({ plan }),
      "CAPABILITY_RUNTIME_EXECUTION_FAILED",
      "/invocations/0/output"
    );
  });

  await t.test("returned input reference", async () => {
    const runtime = await makeRuntime({
      registration: makeRegistration({
        executor: {
          execute(invocation) {
            return invocation.invocationId === "probe-invocation-one"
              ? executeProbe()
              : invocation.payload;
          }
        },
        outputSchema: { validate: () => true },
        qaContract: {
          assertions: [{ assertionId: "detached-output", assert: () => true }]
        }
      })
    });
    const source = makeInvocation({
      invocationId: "returned-reference",
      payload: { value: "detached-value" }
    });
    const plan = prepareCapabilityDispatch({ runtime, invocations: [source] });
    const result = await executeCapabilityDispatch({ plan });
    source.payload.value = "changed-source";
    assert.deepEqual(result.results[0].output, { value: "detached-value" });
    assert.ok(Object.isFrozen(result.results[0].output));
  });
});

test("core dispatcher and the conformance probe have no ambient loader or I/O dependency", () => {
  for (const forbidden of [
    /node:fs/u,
    /node:child_process/u,
    /\bfetch\s*\(/u,
    /\bprocess\.(?:cwd|env)\b/u,
    /\bimport\s*\(/u,
    /\brequire\s*\(/u,
    /\beval\s*\(/u,
    /fixtures\//u,
    /source-slide-clone-fill/u,
    /native-drawingml/u
  ]) assert.doesNotMatch(dispatcherSource, forbidden);
  for (const forbidden of [
    /node:/u,
    /\bfetch\s*\(/u,
    /\bprocess\./u,
    /pptx|potx|presentation/iu
  ]) assert.doesNotMatch(probeRuntimeSource, forbidden);
});

test("dispatcher module closes in a clean directory from an unrelated cwd", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dispatcher-closure-"));
  try {
    const modulePath = path.join(root, "capability-dispatcher.mjs");
    await copyFile(new URL("../packages/core/src/capability-dispatcher.mjs", import.meta.url), modulePath);
    const previous = process.cwd();
    try {
      process.chdir(os.tmpdir());
      const loaded = await import(`${pathToFileURL(modulePath).href}?closure=1`);
      assert.equal(loaded.CAPABILITY_RUNTIME_VERSION, "0.1.0");
    } finally {
      process.chdir(previous);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the conformance probe cannot promote any product capability claim", async () => {
  const matrix = await readJson("policy/support-matrix.json");
  assert.equal(matrix.supportClaimsEnabled, false);
  assert.equal(matrix.dimensions.capabilities.some((item) => item.status === "supported"), false);
  assert.equal(matrix.dimensions.capabilities.some((item) => item.id === PROBE.capabilityId), false);
  assert.equal(probeCases.fixturePurpose, "dispatcher-conformance-only");
});
