import { isDeepStrictEqual } from "node:util";

export const CAPABILITY_RUNTIME_VERSION = "0.1.0";

const CAPABILITY_REGISTRY_TYPE = "capability-registry";
const RUNTIME_TYPE = "capability-runtime";
const PLAN_TYPE = "capability-dispatch-plan";
const RESULT_TYPE = "capability-dispatch-result";
const JSON_SCHEMA_META = "https://json-schema.org/draft/2020-12/schema";

const MAX_CAPABILITIES = 1024;
const MAX_INVOCATIONS = 4096;
const MAX_BINDINGS = 64;
const MAX_FIXTURES = 256;
const MAX_QA_ASSERTIONS = 64;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_ARRAY_ITEMS = 4096;
const MAX_JSON_OBJECT_PROPERTIES = 256;
const MAX_JSON_NODES = 50_000;
const MAX_BATCH_JSON_NODES = 200_000;
const MAX_JSON_STRING_BYTES = 256 * 1024;
const MAX_BATCH_STRING_BYTES = 4 * 1024 * 1024;

const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SEMANTIC_VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const CONTRACT_REFERENCE = /^urn:pptx-pipeline:[a-z0-9][a-z0-9:.-]*$/u;
const SHAPE_KINDS = new Set([
  "auto-shape",
  "graphic-frame",
  "group",
  "picture",
  "placeholder",
  "text-box"
]);

const ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "CAPABILITY_RUNTIME_ARGUMENT_INVALID",
  BINDING_INVALID: "CAPABILITY_RUNTIME_BINDING_INVALID",
  CAPABILITY_UNAVAILABLE: "CAPABILITY_RUNTIME_CAPABILITY_UNAVAILABLE",
  CONFORMANCE_INVALID: "CAPABILITY_RUNTIME_CONFORMANCE_INVALID",
  DEPENDENCY_INVALID: "CAPABILITY_RUNTIME_DEPENDENCY_INVALID",
  EXECUTION_FAILED: "CAPABILITY_RUNTIME_EXECUTION_FAILED",
  INPUT_INVALID: "CAPABILITY_RUNTIME_INPUT_INVALID",
  MANUAL_GATE_REQUIRED: "CAPABILITY_RUNTIME_MANUAL_GATE_REQUIRED",
  OUTPUT_INVALID: "CAPABILITY_RUNTIME_OUTPUT_INVALID",
  PLAN_CONSUMED: "CAPABILITY_RUNTIME_PLAN_CONSUMED",
  PLAN_INVALID: "CAPABILITY_RUNTIME_PLAN_INVALID",
  PREFLIGHT_REJECTED: "CAPABILITY_RUNTIME_PREFLIGHT_REJECTED",
  QA_FAILED: "CAPABILITY_RUNTIME_QA_FAILED",
  REGISTRATION_INVALID: "CAPABILITY_RUNTIME_REGISTRATION_INVALID",
  REGISTRY_INVALID: "CAPABILITY_RUNTIME_REGISTRY_INVALID",
  REQUEST_INVALID: "CAPABILITY_RUNTIME_REQUEST_INVALID",
  SUPPORT_INVALID: "CAPABILITY_RUNTIME_SUPPORT_INVALID",
  UNKNOWN_CAPABILITY: "CAPABILITY_RUNTIME_UNKNOWN_CAPABILITY",
  VERSION_MISMATCH: "CAPABILITY_RUNTIME_VERSION_MISMATCH",
  EXPERIMENTAL_OPT_IN_REQUIRED: "CAPABILITY_RUNTIME_EXPERIMENTAL_OPT_IN_REQUIRED"
});

const RUNTIME_STATE = new WeakMap();
const PLAN_STATE = new WeakMap();
const encoder = new TextEncoder();

export class CapabilityRuntimeError extends Error {
  constructor(code, pointer = "") {
    super(pointer.length === 0 ? code : `${code} at ${pointer}`);
    this.name = "CapabilityRuntimeError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer = "") {
  throw new CapabilityRuntimeError(code, pointer);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dataProperty(record, key) {
  return Object.getOwnPropertyDescriptor(record, key)?.value;
}

function assertExactRecord(value, keys, pointer, code) {
  if (!isPlainRecord(value)) fail(code, pointer);
  const allowed = new Set(keys);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !allowed.has(key))) {
    fail(code, pointer);
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail(code, `${pointer}/${key}`);
    }
  }
}

function assertDenseArray(value, pointer, code, maximum) {
  if (!Array.isArray(value)) fail(code, pointer);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximum) {
    fail(code, pointer);
  }
  const expected = new Set([
    "length",
    ...Array.from({ length: lengthDescriptor.value }, (_, index) => String(index))
  ]);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expected.size ||
      keys.some((key) => typeof key !== "string" || !expected.has(key))) {
    fail(code, pointer);
  }
  for (let index = 0; index < lengthDescriptor.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail(code, `${pointer}/${index}`);
    }
  }
  return lengthDescriptor.value;
}

function cloneJsonValue(value, state, depth = 0) {
  if (depth > MAX_JSON_DEPTH) throw new TypeError("json-depth");
  state.nodes += 1;
  if (state.nodes > MAX_JSON_NODES) throw new TypeError("json-nodes");
  if (state.aggregateTotals !== undefined) {
    state.aggregateTotals.nodes += 1;
    if (state.aggregateTotals.nodes > MAX_BATCH_JSON_NODES) {
      throw new TypeError("json-aggregate-nodes");
    }
  }

  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    const bytes = encoder.encode(value).byteLength;
    if (bytes > MAX_JSON_STRING_BYTES) throw new TypeError("json-string");
    state.stringBytes += bytes;
    if (state.stringBytes > MAX_BATCH_STRING_BYTES) {
      throw new TypeError("json-string-total");
    }
    if (state.aggregateTotals !== undefined) {
      state.aggregateTotals.stringBytes += bytes;
      if (state.aggregateTotals.stringBytes > MAX_BATCH_STRING_BYTES) {
        throw new TypeError("json-aggregate-string-total");
      }
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError("json-number");
    return value;
  }
  if (typeof value !== "object" || state.seen.has(value)) throw new TypeError("json-value");

  state.seen.add(value);
  try {
    if (Array.isArray(value)) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      if (!lengthDescriptor || !("value" in lengthDescriptor) ||
          !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 ||
          lengthDescriptor.value > MAX_JSON_ARRAY_ITEMS) {
        throw new TypeError("json-array");
      }
      const expected = new Set([
        "length",
        ...Array.from({ length: lengthDescriptor.value }, (_, index) => String(index))
      ]);
      const keys = Reflect.ownKeys(value);
      if (keys.length !== expected.size ||
          keys.some((key) => typeof key !== "string" || !expected.has(key))) {
        throw new TypeError("json-array");
      }
      const clone = [];
      for (let index = 0; index < lengthDescriptor.value; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
          throw new TypeError("json-array");
        }
        clone.push(cloneJsonValue(descriptor.value, state, depth + 1));
      }
      return clone;
    }

    if (!isPlainRecord(value)) throw new TypeError("json-object");
    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_JSON_OBJECT_PROPERTIES ||
        keys.some((key) => typeof key !== "string")) {
      throw new TypeError("json-object");
    }
    const clone = {};
    for (const key of [...keys].sort(compareText)) {
      const keyBytes = encoder.encode(key).byteLength;
      if (keyBytes > 256) throw new TypeError("json-object");
      state.stringBytes += keyBytes;
      if (state.stringBytes > MAX_BATCH_STRING_BYTES) {
        throw new TypeError("json-string-total");
      }
      if (state.aggregateTotals !== undefined) {
        state.aggregateTotals.stringBytes += keyBytes;
        if (state.aggregateTotals.stringBytes > MAX_BATCH_STRING_BYTES) {
          throw new TypeError("json-aggregate-string-total");
        }
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
        throw new TypeError("json-object");
      }
      Object.defineProperty(clone, key, {
        configurable: true,
        enumerable: true,
        value: cloneJsonValue(descriptor.value, state, depth + 1),
        writable: true
      });
    }
    return clone;
  } finally {
    state.seen.delete(value);
  }
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function snapshotJson(value, pointer, code, aggregateTotals) {
  const state = { nodes: 0, stringBytes: 0, seen: new WeakSet(), aggregateTotals };
  try {
    return {
      value: deepFreeze(cloneJsonValue(value, state)),
      nodes: state.nodes,
      stringBytes: state.stringBytes
    };
  } catch {
    fail(code, pointer);
  }
}

function assertAggregateTotals(totals, pointer, code) {
  if (totals.nodes > MAX_BATCH_JSON_NODES || totals.stringBytes > MAX_BATCH_STRING_BYTES) {
    fail(code, pointer);
  }
}

function assertSemanticId(value, pointer, code) {
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) fail(code, pointer);
}

function assertSemanticVersion(value, pointer, code) {
  if (typeof value !== "string" || value.length > 32 || !SEMANTIC_VERSION.test(value)) fail(code, pointer);
}

function assertContractReference(value, pointer, code) {
  if (typeof value !== "string" || value.length > 256 || !CONTRACT_REFERENCE.test(value)) fail(code, pointer);
}

function assertSortedUniqueStrings(values, pointer, code, maximum, validator) {
  const length = assertDenseArray(values, pointer, code, maximum);
  let previous;
  for (let index = 0; index < length; index += 1) {
    const value = dataProperty(values, String(index));
    validator(value, `${pointer}/${index}`, code);
    if (previous !== undefined && compareText(previous, value) >= 0) fail(code, `${pointer}/${index}`);
    previous = value;
  }
}

function captureDependencies(value) {
  assertExactRecord(
    value,
    ["resolveCapabilitySupport", "validateCapabilityRegistry", "validateSchemaDocument"],
    "/dependencies",
    ERROR_CODES.DEPENDENCY_INVALID
  );
  const resolveCapabilitySupport = dataProperty(value, "resolveCapabilitySupport");
  const validateCapabilityRegistry = dataProperty(value, "validateCapabilityRegistry");
  const validateSchemaDocument = dataProperty(value, "validateSchemaDocument");
  if (typeof resolveCapabilitySupport !== "function") {
    fail(ERROR_CODES.DEPENDENCY_INVALID, "/dependencies/resolveCapabilitySupport");
  }
  if (typeof validateCapabilityRegistry !== "function") {
    fail(ERROR_CODES.DEPENDENCY_INVALID, "/dependencies/validateCapabilityRegistry");
  }
  if (typeof validateSchemaDocument !== "function") {
    fail(ERROR_CODES.DEPENDENCY_INVALID, "/dependencies/validateSchemaDocument");
  }
  return Object.freeze({ resolveCapabilitySupport, validateCapabilityRegistry, validateSchemaDocument });
}

function callExactTrue(callback, argument, code, pointer) {
  let result;
  try {
    result = callback(argument);
  } catch {
    fail(code, pointer);
  }
  if (result !== true) {
    consumePromiseRejection(result);
    fail(code, pointer);
  }
}

function consumePromiseRejection(value) {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") return false;
  try {
    Promise.prototype.then.call(value, undefined, () => {});
    return true;
  } catch {
    return false;
  }
}

function snapshotRegistry(candidate, validateCapabilityRegistry, artifactTotals) {
  const registry = snapshotJson(
    candidate,
    "/capabilityRegistry",
    ERROR_CODES.REGISTRY_INVALID,
    artifactTotals
  ).value;
  callExactTrue(
    validateCapabilityRegistry,
    registry,
    ERROR_CODES.REGISTRY_INVALID,
    "/capabilityRegistry"
  );
  if (registry.schemaVersion !== CAPABILITY_RUNTIME_VERSION ||
      registry.contractType !== CAPABILITY_REGISTRY_TYPE) {
    fail(ERROR_CODES.REGISTRY_INVALID, "/capabilityRegistry");
  }
  assertSemanticId(
    registry.capabilityRegistryId,
    "/capabilityRegistry/capabilityRegistryId",
    ERROR_CODES.REGISTRY_INVALID
  );
  assertSemanticVersion(
    registry.registryVersion,
    "/capabilityRegistry/registryVersion",
    ERROR_CODES.REGISTRY_INVALID
  );
  const count = assertDenseArray(
    registry.capabilities,
    "/capabilityRegistry/capabilities",
    ERROR_CODES.REGISTRY_INVALID,
    MAX_CAPABILITIES
  );
  if (count === 0) fail(ERROR_CODES.REGISTRY_INVALID, "/capabilityRegistry/capabilities");

  let previousId;
  const definitions = new Map();
  for (let index = 0; index < count; index += 1) {
    const definition = registry.capabilities[index];
    const pointer = `/capabilityRegistry/capabilities/${index}`;
    assertExactRecord(definition, [
      "capabilityId",
      "capabilityVersion",
      "supportMatrixItemId",
      "executorId",
      "inputSchemaId",
      "outputSchemaId",
      "qaContractId",
      "requiredBindingRoles",
      "conformanceFixtureIds"
    ], pointer, ERROR_CODES.REGISTRY_INVALID);
    assertSemanticId(definition.capabilityId, `${pointer}/capabilityId`, ERROR_CODES.REGISTRY_INVALID);
    assertSemanticVersion(definition.capabilityVersion, `${pointer}/capabilityVersion`, ERROR_CODES.REGISTRY_INVALID);
    assertSemanticId(definition.supportMatrixItemId, `${pointer}/supportMatrixItemId`, ERROR_CODES.REGISTRY_INVALID);
    for (const field of ["executorId", "inputSchemaId", "outputSchemaId", "qaContractId"]) {
      assertContractReference(definition[field], `${pointer}/${field}`, ERROR_CODES.REGISTRY_INVALID);
    }
    assertSortedUniqueStrings(
      definition.requiredBindingRoles,
      `${pointer}/requiredBindingRoles`,
      ERROR_CODES.REGISTRY_INVALID,
      MAX_BINDINGS,
      assertSemanticId
    );
    if (definition.requiredBindingRoles.length === 0) {
      fail(ERROR_CODES.REGISTRY_INVALID, `${pointer}/requiredBindingRoles`);
    }
    assertSortedUniqueStrings(
      definition.conformanceFixtureIds,
      `${pointer}/conformanceFixtureIds`,
      ERROR_CODES.REGISTRY_INVALID,
      MAX_FIXTURES,
      assertSemanticId
    );
    if (previousId !== undefined && compareText(previousId, definition.capabilityId) >= 0) {
      fail(ERROR_CODES.REGISTRY_INVALID, `${pointer}/capabilityId`);
    }
    previousId = definition.capabilityId;
    definitions.set(definition.capabilityId, definition);
  }
  return { registry, definitions };
}

function captureSchemaHandle(candidate, expectedId, pointer, dependencies, artifactTotals) {
  assertExactRecord(candidate, ["schemaId", "schema", "validate"], pointer, ERROR_CODES.REGISTRATION_INVALID);
  const schemaId = dataProperty(candidate, "schemaId");
  const validate = dataProperty(candidate, "validate");
  if (schemaId !== expectedId) fail(ERROR_CODES.REGISTRATION_INVALID, `${pointer}/schemaId`);
  if (typeof validate !== "function") fail(ERROR_CODES.REGISTRATION_INVALID, `${pointer}/validate`);
  const schemaSnapshot = snapshotJson(
    dataProperty(candidate, "schema"),
    `${pointer}/schema`,
    ERROR_CODES.REGISTRATION_INVALID,
    artifactTotals
  );
  const schema = schemaSnapshot.value;
  if (schema.$schema !== JSON_SCHEMA_META || schema.$id !== expectedId) {
    fail(ERROR_CODES.REGISTRATION_INVALID, `${pointer}/schema`);
  }
  callExactTrue(
    dependencies.validateSchemaDocument,
    schema,
    ERROR_CODES.REGISTRATION_INVALID,
    `${pointer}/schema`
  );
  return Object.freeze({ schemaId, schema, validate });
}

function captureExecutor(candidate, expectedId, pointer) {
  assertExactRecord(candidate, ["executorId", "preflight", "execute"], pointer, ERROR_CODES.REGISTRATION_INVALID);
  const executorId = dataProperty(candidate, "executorId");
  const preflight = dataProperty(candidate, "preflight");
  const execute = dataProperty(candidate, "execute");
  if (executorId !== expectedId) fail(ERROR_CODES.REGISTRATION_INVALID, `${pointer}/executorId`);
  if (typeof preflight !== "function") fail(ERROR_CODES.REGISTRATION_INVALID, `${pointer}/preflight`);
  if (typeof execute !== "function") fail(ERROR_CODES.REGISTRATION_INVALID, `${pointer}/execute`);
  return Object.freeze({ executorId, preflight, execute });
}

function captureQaContract(candidate, expectedId, pointer) {
  assertExactRecord(candidate, ["qaContractId", "assertions"], pointer, ERROR_CODES.REGISTRATION_INVALID);
  const qaContractId = dataProperty(candidate, "qaContractId");
  if (qaContractId !== expectedId) fail(ERROR_CODES.REGISTRATION_INVALID, `${pointer}/qaContractId`);
  const assertions = dataProperty(candidate, "assertions");
  const count = assertDenseArray(
    assertions,
    `${pointer}/assertions`,
    ERROR_CODES.REGISTRATION_INVALID,
    MAX_QA_ASSERTIONS
  );
  if (count === 0) fail(ERROR_CODES.REGISTRATION_INVALID, `${pointer}/assertions`);
  const captured = [];
  let previousId;
  for (let index = 0; index < count; index += 1) {
    const assertionPointer = `${pointer}/assertions/${index}`;
    const assertion = dataProperty(assertions, String(index));
    assertExactRecord(assertion, ["assertionId", "assert"], assertionPointer, ERROR_CODES.REGISTRATION_INVALID);
    const assertionId = dataProperty(assertion, "assertionId");
    const assert = dataProperty(assertion, "assert");
    assertSemanticId(assertionId, `${assertionPointer}/assertionId`, ERROR_CODES.REGISTRATION_INVALID);
    if (previousId !== undefined && compareText(previousId, assertionId) >= 0) {
      fail(ERROR_CODES.REGISTRATION_INVALID, `${assertionPointer}/assertionId`);
    }
    if (typeof assert !== "function") fail(ERROR_CODES.REGISTRATION_INVALID, `${assertionPointer}/assert`);
    previousId = assertionId;
    captured.push(Object.freeze({ assertionId, assert }));
  }
  return Object.freeze({ qaContractId, assertions: Object.freeze(captured) });
}

function snapshotBindings(candidate, requiredRoles, pointer, code, totals) {
  const count = assertDenseArray(candidate, pointer, code, MAX_BINDINGS);
  if (count !== requiredRoles.length) fail(code, pointer);
  totals.nodes += 1;
  const bindings = [];
  const bindingIds = new Set();
  const targets = new Set();
  let previousRole;
  for (let index = 0; index < count; index += 1) {
    const itemPointer = `${pointer}/${index}`;
    const source = dataProperty(candidate, String(index));
    assertExactRecord(source, [
      "role",
      "shapeBindingId",
      "containerKind",
      "containerKey",
      "shapeKey",
      "expectedKind",
      "cardinality"
    ], itemPointer, code);
    const binding = {
      role: dataProperty(source, "role"),
      shapeBindingId: dataProperty(source, "shapeBindingId"),
      containerKind: dataProperty(source, "containerKind"),
      containerKey: dataProperty(source, "containerKey"),
      shapeKey: dataProperty(source, "shapeKey"),
      expectedKind: dataProperty(source, "expectedKind"),
      cardinality: dataProperty(source, "cardinality")
    };
    assertSemanticId(binding.role, `${itemPointer}/role`, code);
    assertSemanticId(binding.shapeBindingId, `${itemPointer}/shapeBindingId`, code);
    assertSemanticId(binding.containerKey, `${itemPointer}/containerKey`, code);
    assertSemanticId(binding.shapeKey, `${itemPointer}/shapeKey`, code);
    if (!["layout", "slide"].includes(binding.containerKind)) fail(code, `${itemPointer}/containerKind`);
    if (!SHAPE_KINDS.has(binding.expectedKind)) fail(code, `${itemPointer}/expectedKind`);
    if (binding.cardinality !== "exactly-one") fail(code, `${itemPointer}/cardinality`);
    if (previousRole !== undefined && compareText(previousRole, binding.role) >= 0) {
      fail(code, `${itemPointer}/role`);
    }
    if (binding.role !== requiredRoles[index]) fail(code, `${itemPointer}/role`);
    if (bindingIds.has(binding.shapeBindingId)) fail(code, `${itemPointer}/shapeBindingId`);
    const target = `${binding.containerKind}\0${binding.containerKey}\0${binding.shapeKey}`;
    if (targets.has(target)) fail(code, `${itemPointer}/shapeKey`);
    totals.nodes += 8;
    totals.stringBytes += [
      binding.role,
      binding.shapeBindingId,
      binding.containerKind,
      binding.containerKey,
      binding.shapeKey,
      binding.expectedKind,
      binding.cardinality
    ].reduce((total, value) => total + encoder.encode(value).byteLength, 0);
    assertAggregateTotals(totals, itemPointer, code);
    previousRole = binding.role;
    bindingIds.add(binding.shapeBindingId);
    targets.add(target);
    bindings.push(Object.freeze(binding));
  }
  return Object.freeze(bindings);
}

function snapshotInvocation(candidate, definition, pointer, batchTotals) {
  assertExactRecord(candidate, [
    "invocationId",
    "capabilitySelectionId",
    "capabilityId",
    "capabilityVersion",
    "experimentalOptIn",
    "payload",
    "bindings"
  ], pointer, ERROR_CODES.REQUEST_INVALID);
  const invocationId = dataProperty(candidate, "invocationId");
  const capabilitySelectionId = dataProperty(candidate, "capabilitySelectionId");
  const capabilityId = dataProperty(candidate, "capabilityId");
  const capabilityVersion = dataProperty(candidate, "capabilityVersion");
  const experimentalOptIn = dataProperty(candidate, "experimentalOptIn");
  assertSemanticId(invocationId, `${pointer}/invocationId`, ERROR_CODES.REQUEST_INVALID);
  assertSemanticId(capabilitySelectionId, `${pointer}/capabilitySelectionId`, ERROR_CODES.REQUEST_INVALID);
  assertSemanticId(capabilityId, `${pointer}/capabilityId`, ERROR_CODES.REQUEST_INVALID);
  assertSemanticVersion(capabilityVersion, `${pointer}/capabilityVersion`, ERROR_CODES.REQUEST_INVALID);
  if (typeof experimentalOptIn !== "boolean") {
    fail(ERROR_CODES.REQUEST_INVALID, `${pointer}/experimentalOptIn`);
  }
  if (capabilityId !== definition.capabilityId) {
    fail(ERROR_CODES.REQUEST_INVALID, `${pointer}/capabilityId`);
  }
  if (capabilityVersion !== definition.capabilityVersion) {
    fail(ERROR_CODES.VERSION_MISMATCH, `${pointer}/capabilityVersion`);
  }
  batchTotals.nodes += 6;
  batchTotals.stringBytes += [
    invocationId,
    capabilitySelectionId,
    capabilityId,
    capabilityVersion
  ].reduce((total, value) => total + encoder.encode(value).byteLength, 0);
  assertAggregateTotals(batchTotals, pointer, ERROR_CODES.REQUEST_INVALID);
  const payloadSnapshot = snapshotJson(
    dataProperty(candidate, "payload"),
    `${pointer}/payload`,
    ERROR_CODES.REQUEST_INVALID,
    batchTotals
  );
  const bindings = snapshotBindings(
    dataProperty(candidate, "bindings"),
    definition.requiredBindingRoles,
    `${pointer}/bindings`,
    ERROR_CODES.BINDING_INVALID,
    batchTotals
  );
  return deepFreeze({
    invocationId,
    capabilitySelectionId,
    capabilityId,
    capabilityVersion,
    experimentalOptIn,
    payload: payloadSnapshot.value,
    bindings
  });
}

function captureFixtures(candidate, definition, pointer, artifactTotals) {
  const count = assertDenseArray(candidate, pointer, ERROR_CODES.REGISTRATION_INVALID, MAX_FIXTURES);
  if (count === 0 || count !== definition.conformanceFixtureIds.length) {
    fail(ERROR_CODES.REGISTRATION_INVALID, pointer);
  }
  const captured = [];
  let previousId;
  for (let index = 0; index < count; index += 1) {
    const fixturePointer = `${pointer}/${index}`;
    const fixture = dataProperty(candidate, String(index));
    assertExactRecord(
      fixture,
      ["fixtureId", "invocation", "expectedOutput"],
      fixturePointer,
      ERROR_CODES.REGISTRATION_INVALID
    );
    const fixtureId = dataProperty(fixture, "fixtureId");
    assertSemanticId(fixtureId, `${fixturePointer}/fixtureId`, ERROR_CODES.REGISTRATION_INVALID);
    if (previousId !== undefined && compareText(previousId, fixtureId) >= 0) {
      fail(ERROR_CODES.REGISTRATION_INVALID, `${fixturePointer}/fixtureId`);
    }
    if (fixtureId !== definition.conformanceFixtureIds[index]) {
      fail(ERROR_CODES.REGISTRATION_INVALID, `${fixturePointer}/fixtureId`);
    }
    let invocation;
    try {
      invocation = snapshotInvocation(
        dataProperty(fixture, "invocation"),
        definition,
        `${fixturePointer}/invocation`,
        artifactTotals
      );
    } catch {
      fail(ERROR_CODES.REGISTRATION_INVALID, `${fixturePointer}/invocation`);
    }
    const expectedOutputSnapshot = snapshotJson(
      dataProperty(fixture, "expectedOutput"),
      `${fixturePointer}/expectedOutput`,
      ERROR_CODES.REGISTRATION_INVALID,
      artifactTotals
    );
    const expectedOutput = expectedOutputSnapshot.value;
    previousId = fixtureId;
    captured.push(deepFreeze({ fixtureId, invocation, expectedOutput }));
  }
  return Object.freeze(captured);
}

function captureRegistration(candidate, definition, pointer, dependencies, artifactTotals) {
  assertExactRecord(candidate, [
    "capabilityId",
    "capabilityVersion",
    "executor",
    "inputSchema",
    "outputSchema",
    "conformanceFixtures",
    "qaContract"
  ], pointer, ERROR_CODES.REGISTRATION_INVALID);
  const capabilityId = dataProperty(candidate, "capabilityId");
  const capabilityVersion = dataProperty(candidate, "capabilityVersion");
  if (capabilityId !== definition.capabilityId) {
    fail(ERROR_CODES.REGISTRATION_INVALID, `${pointer}/capabilityId`);
  }
  if (capabilityVersion !== definition.capabilityVersion) {
    fail(ERROR_CODES.REGISTRATION_INVALID, `${pointer}/capabilityVersion`);
  }
  const executor = captureExecutor(dataProperty(candidate, "executor"), definition.executorId, `${pointer}/executor`);
  const inputSchema = captureSchemaHandle(
    dataProperty(candidate, "inputSchema"),
    definition.inputSchemaId,
    `${pointer}/inputSchema`,
    dependencies,
    artifactTotals
  );
  const outputSchema = captureSchemaHandle(
    dataProperty(candidate, "outputSchema"),
    definition.outputSchemaId,
    `${pointer}/outputSchema`,
    dependencies,
    artifactTotals
  );
  const qaContract = captureQaContract(
    dataProperty(candidate, "qaContract"),
    definition.qaContractId,
    `${pointer}/qaContract`
  );
  const conformanceFixtures = captureFixtures(
    dataProperty(candidate, "conformanceFixtures"),
    definition,
    `${pointer}/conformanceFixtures`,
    artifactTotals
  );
  return Object.freeze({
    definition,
    executor,
    inputSchema,
    outputSchema,
    qaContract,
    conformanceFixtures
  });
}

function captureSupportDecision(candidate, expectedItemId, pointer, artifactTotals) {
  const decision = snapshotJson(
    candidate,
    pointer,
    ERROR_CODES.SUPPORT_INVALID,
    artifactTotals
  ).value;
  assertExactRecord(decision, [
    "supportMatrixItemId",
    "supportClaimsEnabled",
    "status",
    "disposition"
  ], pointer, ERROR_CODES.SUPPORT_INVALID);
  if (decision.supportMatrixItemId !== expectedItemId ||
      typeof decision.supportClaimsEnabled !== "boolean") {
    fail(ERROR_CODES.SUPPORT_INVALID, pointer);
  }
  const allowed = {
    experimental: "accept-with-warning",
    manual: "report-manual-gate",
    supported: "accept"
  };
  if (decision.status === "unsupported") {
    if (!["reject", "unavailable"].includes(decision.disposition)) {
      fail(ERROR_CODES.SUPPORT_INVALID, pointer);
    }
  } else if (allowed[decision.status] !== decision.disposition) {
    fail(ERROR_CODES.SUPPORT_INVALID, pointer);
  }
  if (decision.status === "supported" && decision.supportClaimsEnabled !== true) {
    fail(ERROR_CODES.SUPPORT_INVALID, pointer);
  }
  return decision;
}

function resolveSupport(definition, resolver, pointer, artifactTotals) {
  const query = Object.freeze({ supportMatrixItemId: definition.supportMatrixItemId });
  let candidate;
  try {
    candidate = resolver(query);
  } catch {
    fail(ERROR_CODES.SUPPORT_INVALID, pointer);
  }
  if (consumePromiseRejection(candidate)) fail(ERROR_CODES.SUPPORT_INVALID, pointer);
  return captureSupportDecision(
    candidate,
    definition.supportMatrixItemId,
    pointer,
    artifactTotals
  );
}

function validateInput(registration, invocation, pointer) {
  callExactTrue(
    registration.inputSchema.validate,
    invocation.payload,
    ERROR_CODES.INPUT_INVALID,
    `${pointer}/payload`
  );
}

function preflight(registration, invocation, pointer) {
  callExactTrue(
    registration.executor.preflight,
    invocation,
    ERROR_CODES.PREFLIGHT_REJECTED,
    pointer
  );
}

function validateOutput(registration, output, pointer) {
  callExactTrue(
    registration.outputSchema.validate,
    output,
    ERROR_CODES.OUTPUT_INVALID,
    pointer
  );
}

async function runQa(registration, invocation, output, pointer) {
  const subject = deepFreeze({ invocation, output });
  for (let index = 0; index < registration.qaContract.assertions.length; index += 1) {
    const assertion = registration.qaContract.assertions[index];
    let result;
    try {
      result = assertion.assert(subject);
    } catch {
      fail(ERROR_CODES.QA_FAILED, `${pointer}/${index}`);
    }
    if (result !== true) {
      consumePromiseRejection(result);
      fail(ERROR_CODES.QA_FAILED, `${pointer}/${index}`);
    }
  }
}

async function executeInvocation(registration, invocation, pointer, outputTotals) {
  let candidate;
  try {
    candidate = await registration.executor.execute(invocation);
  } catch {
    fail(ERROR_CODES.EXECUTION_FAILED, pointer);
  }
  const output = snapshotJson(
    candidate,
    pointer,
    ERROR_CODES.OUTPUT_INVALID,
    outputTotals
  ).value;
  validateOutput(registration, output, pointer);
  await runQa(registration, invocation, output, `${pointer}/qaAssertions`);
  return output;
}

async function verifyConformance(registration, registrationIndex, outputTotals) {
  for (let index = 0; index < registration.conformanceFixtures.length; index += 1) {
    const fixture = registration.conformanceFixtures[index];
    const pointer = `/registrations/${registrationIndex}/conformanceFixtures/${index}`;
    try {
      validateInput(registration, fixture.invocation, `${pointer}/invocation`);
      preflight(registration, fixture.invocation, `${pointer}/invocation`);
      validateOutput(registration, fixture.expectedOutput, `${pointer}/expectedOutput`);
      const output = await executeInvocation(
        registration,
        fixture.invocation,
        `${pointer}/actualOutput`,
        outputTotals
      );
      if (!isDeepStrictEqual(output, fixture.expectedOutput)) {
        fail(ERROR_CODES.CONFORMANCE_INVALID, pointer);
      }
    } catch {
      fail(ERROR_CODES.CONFORMANCE_INVALID, pointer);
    }
  }
}

function assertDispatchAllowed(decision, invocation, pointer) {
  if (decision.status === "unsupported") {
    fail(ERROR_CODES.CAPABILITY_UNAVAILABLE, `${pointer}/capabilityId`);
  }
  if (decision.status === "manual") {
    fail(ERROR_CODES.MANUAL_GATE_REQUIRED, `${pointer}/capabilityId`);
  }
  if (decision.status === "experimental" && invocation.experimentalOptIn !== true) {
    fail(ERROR_CODES.EXPERIMENTAL_OPT_IN_REQUIRED, `${pointer}/experimentalOptIn`);
  }
}

/**
 * Atomically bind declarative CapabilityRegistry metadata to a closed set of
 * trusted in-process artifact registrations. Registry strings are never loaded
 * as module paths. Complete registration is necessary for dispatchability but
 * does not itself establish a public support claim.
 */
export async function createCapabilityRuntime(options) {
  assertExactRecord(
    options,
    ["capabilityRegistry", "registrations", "dependencies"],
    "",
    ERROR_CODES.ARGUMENT_INVALID
  );
  const dependencies = captureDependencies(dataProperty(options, "dependencies"));
  const artifactTotals = { nodes: 0, stringBytes: 0 };
  const { registry, definitions } = snapshotRegistry(
    dataProperty(options, "capabilityRegistry"),
    dependencies.validateCapabilityRegistry,
    artifactTotals
  );
  const registrations = dataProperty(options, "registrations");
  const registrationCount = assertDenseArray(
    registrations,
    "/registrations",
    ERROR_CODES.REGISTRATION_INVALID,
    MAX_CAPABILITIES
  );
  const executable = new Map();
  const support = new Map();
  const capturedRegistrations = [];
  let previousId;
  for (let index = 0; index < registrationCount; index += 1) {
    const candidate = dataProperty(registrations, String(index));
    if (!isPlainRecord(candidate)) fail(ERROR_CODES.REGISTRATION_INVALID, `/registrations/${index}`);
    const capabilityId = dataProperty(candidate, "capabilityId");
    assertSemanticId(capabilityId, `/registrations/${index}/capabilityId`, ERROR_CODES.REGISTRATION_INVALID);
    if (previousId !== undefined && compareText(previousId, capabilityId) >= 0) {
      fail(ERROR_CODES.REGISTRATION_INVALID, `/registrations/${index}/capabilityId`);
    }
    const definition = definitions.get(capabilityId);
    if (!definition) fail(ERROR_CODES.REGISTRATION_INVALID, `/registrations/${index}/capabilityId`);
    if (definition.conformanceFixtureIds.length === 0) {
      fail(ERROR_CODES.REGISTRATION_INVALID, `/registrations/${index}/conformanceFixtures`);
    }
    const registration = captureRegistration(
      candidate,
      definition,
      `/registrations/${index}`,
      dependencies,
      artifactTotals
    );
    const decision = resolveSupport(
      definition,
      dependencies.resolveCapabilitySupport,
      `/registrations/${index}/support`,
      artifactTotals
    );
    executable.set(capabilityId, registration);
    support.set(capabilityId, decision);
    capturedRegistrations.push(Object.freeze({ index, registration }));
    previousId = capabilityId;
  }

  const conformanceOutputTotals = { nodes: 0, stringBytes: 0 };
  for (const captured of capturedRegistrations) {
    await verifyConformance(
      captured.registration,
      captured.index,
      conformanceOutputTotals
    );
  }

  const admittedExecutables = new Map();
  for (const [capabilityId, registration] of executable) {
    admittedExecutables.set(capabilityId, Object.freeze({
      definition: registration.definition,
      executor: registration.executor,
      inputSchema: Object.freeze({
        schemaId: registration.inputSchema.schemaId,
        validate: registration.inputSchema.validate
      }),
      outputSchema: Object.freeze({
        schemaId: registration.outputSchema.schemaId,
        validate: registration.outputSchema.validate
      }),
      qaContract: registration.qaContract
    }));
  }

  const facade = deepFreeze({
    runtimeVersion: CAPABILITY_RUNTIME_VERSION,
    runtimeType: RUNTIME_TYPE,
    capabilityRegistryId: registry.capabilityRegistryId,
    registryVersion: registry.registryVersion,
    knownCapabilityCount: definitions.size,
    executableCapabilityCount: executable.size
  });
  RUNTIME_STATE.set(facade, Object.freeze({
    registry,
    definitions,
    executable: admittedExecutables,
    support
  }));
  return facade;
}

/**
 * Validate and preflight the complete invocation batch before returning an
 * opaque one-shot plan. No executor execute function is called here.
 */
export function prepareCapabilityDispatch(options) {
  assertExactRecord(options, ["runtime", "invocations"], "", ERROR_CODES.ARGUMENT_INVALID);
  const runtime = dataProperty(options, "runtime");
  const state = RUNTIME_STATE.get(runtime);
  if (!state) fail(ERROR_CODES.ARGUMENT_INVALID, "/runtime");
  const candidates = dataProperty(options, "invocations");
  const count = assertDenseArray(candidates, "/invocations", ERROR_CODES.REQUEST_INVALID, MAX_INVOCATIONS);
  if (count === 0) fail(ERROR_CODES.REQUEST_INVALID, "/invocations");

  const entries = [];
  const invocationIds = new Set();
  const totals = { nodes: 0, stringBytes: 0 };
  for (let index = 0; index < count; index += 1) {
    const pointer = `/invocations/${index}`;
    const candidate = dataProperty(candidates, String(index));
    if (!isPlainRecord(candidate)) fail(ERROR_CODES.REQUEST_INVALID, pointer);
    const capabilityId = dataProperty(candidate, "capabilityId");
    assertSemanticId(capabilityId, `${pointer}/capabilityId`, ERROR_CODES.REQUEST_INVALID);
    const definition = state.definitions.get(capabilityId);
    if (!definition) fail(ERROR_CODES.UNKNOWN_CAPABILITY, `${pointer}/capabilityId`);
    const candidateVersion = dataProperty(candidate, "capabilityVersion");
    if (candidateVersion !== definition.capabilityVersion) {
      fail(ERROR_CODES.VERSION_MISMATCH, `${pointer}/capabilityVersion`);
    }
    const registration = state.executable.get(capabilityId);
    if (!registration) fail(ERROR_CODES.CAPABILITY_UNAVAILABLE, `${pointer}/capabilityId`);
    const invocation = snapshotInvocation(candidate, definition, pointer, totals);
    if (invocationIds.has(invocation.invocationId)) {
      fail(ERROR_CODES.REQUEST_INVALID, `${pointer}/invocationId`);
    }
    invocationIds.add(invocation.invocationId);
    const decision = state.support.get(capabilityId);
    assertDispatchAllowed(decision, invocation, pointer);
    validateInput(registration, invocation, pointer);
    entries.push(Object.freeze({ invocation, registration, decision }));
  }

  for (let index = 0; index < entries.length; index += 1) {
    preflight(entries[index].registration, entries[index].invocation, `/invocations/${index}`);
  }

  const plan = deepFreeze({
    planVersion: CAPABILITY_RUNTIME_VERSION,
    planType: PLAN_TYPE,
    invocationCount: entries.length
  });
  PLAN_STATE.set(plan, { consumed: false, entries: Object.freeze(entries) });
  return plan;
}

/**
 * Execute an authenticated plan once, in source invocation order. The plan is
 * marked consumed before the first await so replay and concurrent execution
 * fail closed. Staging rollback/publication remain M2-005 responsibilities.
 */
export async function executeCapabilityDispatch(options) {
  assertExactRecord(options, ["plan"], "", ERROR_CODES.ARGUMENT_INVALID);
  const plan = dataProperty(options, "plan");
  const state = PLAN_STATE.get(plan);
  if (!state) fail(ERROR_CODES.PLAN_INVALID, "/plan");
  if (state.consumed) fail(ERROR_CODES.PLAN_CONSUMED, "/plan");
  state.consumed = true;
  const entries = state.entries;
  state.entries = undefined;

  const results = [];
  const outputTotals = { nodes: 0, stringBytes: 0 };
  for (let index = 0; index < entries.length; index += 1) {
    const { invocation, registration, decision } = entries[index];
    const output = await executeInvocation(
      registration,
      invocation,
      `/invocations/${index}/output`,
      outputTotals
    );
    results.push(deepFreeze({
      dispatchVersion: CAPABILITY_RUNTIME_VERSION,
      dispatchType: RESULT_TYPE,
      invocationId: invocation.invocationId,
      capabilitySelectionId: invocation.capabilitySelectionId,
      capabilityId: invocation.capabilityId,
      capabilityVersion: invocation.capabilityVersion,
      supportMatrixItemId: registration.definition.supportMatrixItemId,
      supportStatus: decision.status,
      executorId: registration.executor.executorId,
      qaContractId: registration.qaContract.qaContractId,
      qaAssertionIds: Object.freeze(
        registration.qaContract.assertions.map((assertion) => assertion.assertionId)
      ),
      output
    }));
  }
  return deepFreeze({
    dispatchVersion: CAPABILITY_RUNTIME_VERSION,
    dispatchType: RESULT_TYPE,
    results
  });
}
