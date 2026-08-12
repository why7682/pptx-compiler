import {
  assertSupportedSchema,
  validateJson
} from "#pptx-compiler/extension-api";
import {
  executeNativeCardArrow,
  nativeCardArrowQaAssertions,
  preflightNativeCardArrow
} from "./native-card-arrow.mjs";

const IDENTITY = Object.freeze({
  capabilityId: "native-card-arrow",
  capabilityVersion: "0.1.0",
  executorId: "urn:pptx-compiler:capability:executor:native-card-arrow:0.1.0",
  inputSchemaId: "urn:pptx-compiler:capability:schema:native-card-arrow-input:0.1.0",
  outputSchemaId: "urn:pptx-compiler:capability:schema:native-card-arrow-output:0.1.0",
  qaContractId: "urn:pptx-compiler:capability:qa:native-card-arrow:0.1.0",
  fixturePurpose: "native-card-arrow-public-conformance",
  fixtureIds: Object.freeze(["native-card-arrow-basic", "native-card-arrow-escaping"])
});

export class NativeCardArrowRegistrationError extends Error {
  constructor(pointer = "/registration") {
    super("NATIVE_CARD_ARROW_REGISTRATION_INVALID");
    this.name = "NativeCardArrowRegistrationError";
    this.code = "NATIVE_CARD_ARROW_REGISTRATION_INVALID";
    this.pointer = pointer;
  }
}

function fail(pointer) {
  throw new NativeCardArrowRegistrationError(pointer);
}

function exactRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const allowed = new Set(keys);
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length ||
      actual.some((key) => typeof key !== "string" || !allowed.has(key))) {
    return false;
  }
  return actual.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
  });
}

function snapshot(value, pointer) {
  try {
    return structuredClone(value);
  } catch {
    fail(pointer);
  }
}

function freeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function schema(value, expectedId, pointer) {
  const captured = freeze(snapshot(value, pointer));
  if (captured?.$id !== expectedId) fail(`${pointer}/$id`);
  try {
    assertSupportedSchema(captured);
  } catch {
    fail(pointer);
  }
  return captured;
}

function conformanceCases(value) {
  const captured = freeze(snapshot(value, "/cases"));
  if (!exactRecord(captured, [
    "schemaVersion",
    "fixturePurpose",
    "capabilityId",
    "capabilityVersion",
    "fixtures"
  ]) || captured.schemaVersion !== 1 || captured.fixturePurpose !== IDENTITY.fixturePurpose ||
      captured.capabilityId !== IDENTITY.capabilityId ||
      captured.capabilityVersion !== IDENTITY.capabilityVersion ||
      !Array.isArray(captured.fixtures) || captured.fixtures.length !== IDENTITY.fixtureIds.length) {
    fail("/cases");
  }
  for (let index = 0; index < IDENTITY.fixtureIds.length; index += 1) {
    if (captured.fixtures[index]?.fixtureId !== IDENTITY.fixtureIds[index]) {
      fail(`/cases/fixtures/${index}/fixtureId`);
    }
  }
  return captured.fixtures;
}

export function createNativeCardArrowRegistration({
  inputSchema,
  outputSchema,
  cases
} = {}) {
  const capturedInput = schema(inputSchema, IDENTITY.inputSchemaId, "/inputSchema");
  const capturedOutput = schema(outputSchema, IDENTITY.outputSchemaId, "/outputSchema");
  const fixtures = conformanceCases(cases);
  return Object.freeze({
    capabilityId: IDENTITY.capabilityId,
    capabilityVersion: IDENTITY.capabilityVersion,
    executor: Object.freeze({
      executorId: IDENTITY.executorId,
      preflight: preflightNativeCardArrow,
      execute: executeNativeCardArrow
    }),
    inputSchema: Object.freeze({
      schemaId: IDENTITY.inputSchemaId,
      schema: capturedInput,
      validate(value) {
        return validateJson(value, capturedInput).length === 0;
      }
    }),
    outputSchema: Object.freeze({
      schemaId: IDENTITY.outputSchemaId,
      schema: capturedOutput,
      validate(value) {
        return validateJson(value, capturedOutput).length === 0;
      }
    }),
    conformanceFixtures: fixtures,
    qaContract: Object.freeze({
      qaContractId: IDENTITY.qaContractId,
      assertions: nativeCardArrowQaAssertions
    })
  });
}
