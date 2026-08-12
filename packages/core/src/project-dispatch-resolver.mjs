import {
  assertCapabilityRuntimeRegistry,
  prepareCapabilityDispatch
} from "./capability-dispatcher.mjs";

export const PROJECT_DISPATCH_RESOLVER_VERSION = "0.1.0";

const CONTRACT_TYPES = Object.freeze({
  capabilityRegistry: "capability-registry",
  deckSpec: "deck-spec",
  projectConfig: "project-config",
  projectOverlay: "project-overlay",
  templateIndex: "template-index",
  templateProfile: "template-profile"
});

const MAX_CAPABILITIES = 1024;
const MAX_SELECTIONS = 1024;
const MAX_BINDINGS = 8192;
const MAX_BINDING_ROLES = 64;
const MAX_MASTERS = 256;
const MAX_LAYOUTS = 2048;
const MAX_LAYOUT_BINDINGS = 256;
const MAX_SLIDES = 4096;
const MAX_SHAPES = 8192;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_ARRAY_ITEMS = 8192;
const MAX_JSON_OBJECT_PROPERTIES = 256;
const MAX_DOCUMENT_JSON_NODES = 50_000;
const MAX_BATCH_JSON_NODES = 200_000;
const MAX_JSON_STRING_BYTES = 256 * 1024;
const MAX_JSON_OBJECT_KEY_BYTES = 256;
const MAX_BATCH_STRING_BYTES = 4 * 1024 * 1024;

const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SEMANTIC_VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const CONTRACT_REFERENCE = /^urn:pptx-compiler:[a-z0-9][a-z0-9:.-]*$/u;
const PACKAGE_PART_PATH = /^(?!.*(?:^|\/)\.{1,2}(?:\/|$))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const SHAPE_KINDS = new Set([
  "auto-shape",
  "graphic-frame",
  "group",
  "picture",
  "placeholder",
  "text-box"
]);

const ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "PROJECT_DISPATCH_RESOLUTION_ARGUMENT_INVALID",
  BINDING_INVALID: "PROJECT_DISPATCH_RESOLUTION_BINDING_INVALID",
  DEPENDENCY_INVALID: "PROJECT_DISPATCH_RESOLUTION_DEPENDENCY_INVALID",
  DOCUMENT_INVALID: "PROJECT_DISPATCH_RESOLUTION_DOCUMENT_INVALID",
  IDENTITY_MISMATCH: "PROJECT_DISPATCH_RESOLUTION_IDENTITY_MISMATCH",
  REGISTRY_INVALID: "PROJECT_DISPATCH_RESOLUTION_REGISTRY_INVALID",
  SELECTION_INVALID: "PROJECT_DISPATCH_RESOLUTION_SELECTION_INVALID",
  TARGET_INVALID: "PROJECT_DISPATCH_RESOLUTION_TARGET_INVALID"
});

const encoder = new TextEncoder();

export class ProjectDispatchResolutionError extends Error {
  constructor(code, pointer = "") {
    super(pointer.length === 0 ? code : `${code} at ${pointer}`);
    this.name = "ProjectDispatchResolutionError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer = "") {
  throw new ProjectDispatchResolutionError(code, pointer);
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

function assertShapeRecord(value, pointer, code) {
  if (!isPlainRecord(value)) fail(code, pointer);
  const keys = Reflect.ownKeys(value);
  const allowed = new Set(["shapeKey", "sourceId", "kind", "geometry", "placeholder"]);
  if (![4, 5].includes(keys.length) ||
      keys.some((key) => typeof key !== "string" || !allowed.has(key)) ||
      !["shapeKey", "sourceId", "kind", "geometry"].every((key) => keys.includes(key))) {
    fail(code, pointer);
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail(code, `${pointer}/${String(key)}`);
    }
  }
}

function assertDenseArray(value, pointer, code, maximum, { nonempty = false } = {}) {
  if (!Array.isArray(value)) fail(code, pointer);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximum || (nonempty && lengthDescriptor.value === 0)) {
    fail(code, pointer);
  }
  const expected = new Set([
    "length",
    ...Array.from({ length: lengthDescriptor.value }, (_, index) => String(index))
  ]);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== expected.size ||
      ownKeys.some((key) => typeof key !== "string" || !expected.has(key))) {
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
  state.totals.nodes += 1;
  if (state.nodes > MAX_DOCUMENT_JSON_NODES || state.totals.nodes > MAX_BATCH_JSON_NODES) {
    throw new TypeError("json-nodes");
  }

  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length > MAX_JSON_STRING_BYTES) throw new TypeError("json-string");
    const bytes = encoder.encode(value).byteLength;
    if (bytes > MAX_JSON_STRING_BYTES) throw new TypeError("json-string");
    state.stringBytes += bytes;
    state.totals.stringBytes += bytes;
    if (state.stringBytes > MAX_BATCH_STRING_BYTES ||
        state.totals.stringBytes > MAX_BATCH_STRING_BYTES) {
      throw new TypeError("json-string-total");
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
      if (key.length > MAX_JSON_OBJECT_KEY_BYTES) throw new TypeError("json-object-key");
      const keyBytes = encoder.encode(key).byteLength;
      if (keyBytes > MAX_JSON_OBJECT_KEY_BYTES) throw new TypeError("json-object-key");
      state.stringBytes += keyBytes;
      state.totals.stringBytes += keyBytes;
      if (state.stringBytes > MAX_BATCH_STRING_BYTES ||
          state.totals.stringBytes > MAX_BATCH_STRING_BYTES) {
        throw new TypeError("json-string-total");
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

function snapshotDocument(value, pointer, totals) {
  try {
    return deepFreeze(cloneJsonValue(value, {
      nodes: 0,
      seen: new WeakSet(),
      stringBytes: 0,
      totals
    }));
  } catch {
    fail(ERROR_CODES.DOCUMENT_INVALID, pointer);
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

function callExactTrue(callback, value, pointer) {
  let result;
  try {
    result = callback(value);
  } catch {
    fail(ERROR_CODES.DOCUMENT_INVALID, pointer);
  }
  if (result !== true) {
    consumePromiseRejection(result);
    fail(ERROR_CODES.DOCUMENT_INVALID, pointer);
  }
}

function captureDependencies(value) {
  assertExactRecord(value, [
    "validateCapabilityRegistry",
    "validateDeckSpec",
    "validateProjectOverlay",
    "validateTemplateIndex"
  ], "/dependencies", ERROR_CODES.DEPENDENCY_INVALID);
  const captured = {};
  for (const key of [
    "validateCapabilityRegistry",
    "validateDeckSpec",
    "validateProjectOverlay",
    "validateTemplateIndex"
  ]) {
    const callback = dataProperty(value, key);
    if (typeof callback !== "function") {
      fail(ERROR_CODES.DEPENDENCY_INVALID, `/dependencies/${key}`);
    }
    captured[key] = callback;
  }
  return Object.freeze(captured);
}

function captureProjectDependencies(value) {
  assertExactRecord(value, [
    "validateCapabilityRegistry",
    "validateDeckSpec",
    "validateProjectConfig",
    "validateProjectOverlay",
    "validateTemplateIndex",
    "validateTemplateProfile"
  ], "/dependencies", ERROR_CODES.DEPENDENCY_INVALID);
  const captured = {};
  for (const key of [
    "validateCapabilityRegistry",
    "validateDeckSpec",
    "validateProjectConfig",
    "validateProjectOverlay",
    "validateTemplateIndex",
    "validateTemplateProfile"
  ]) {
    const callback = dataProperty(value, key);
    if (typeof callback !== "function") {
      fail(ERROR_CODES.DEPENDENCY_INVALID, `/dependencies/${key}`);
    }
    captured[key] = callback;
  }
  return Object.freeze(captured);
}

function assertSemanticId(value, pointer, code) {
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) {
    fail(code, pointer);
  }
}

function assertSemanticVersion(value, pointer, code) {
  if (typeof value !== "string" || value.length > 32 || !SEMANTIC_VERSION.test(value)) {
    fail(code, pointer);
  }
}

function assertContractReference(value, pointer, code) {
  if (typeof value !== "string" || value.length > 256 || !CONTRACT_REFERENCE.test(value)) {
    fail(code, pointer);
  }
}

function assertPackagePartPath(value, pointer, code) {
  if (typeof value !== "string" || value.length > 512 || !PACKAGE_PART_PATH.test(value)) {
    fail(code, pointer);
  }
}

function assertContractIdentity(document, type, pointer) {
  if (document.schemaVersion !== PROJECT_DISPATCH_RESOLVER_VERSION ||
      document.contractType !== type) {
    fail(ERROR_CODES.DOCUMENT_INVALID, pointer);
  }
}

function assertSortedUniqueStrings(values, pointer, code, maximum, validator = assertSemanticId) {
  const count = assertDenseArray(values, pointer, code, maximum);
  let previous;
  for (let index = 0; index < count; index += 1) {
    const value = dataProperty(values, String(index));
    validator(value, `${pointer}/${index}`, code);
    if (previous !== undefined && compareText(previous, value) >= 0) {
      fail(code, `${pointer}/${index}`);
    }
    previous = value;
  }
}

function parseRegistry(registry) {
  assertExactRecord(registry, [
    "schemaVersion",
    "contractType",
    "capabilityRegistryId",
    "registryVersion",
    "capabilities"
  ], "/capabilityRegistry", ERROR_CODES.REGISTRY_INVALID);
  assertContractIdentity(registry, CONTRACT_TYPES.capabilityRegistry, "/capabilityRegistry");
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
    MAX_CAPABILITIES,
    { nonempty: true }
  );
  const definitions = new Map();
  let previousId;
  for (let index = 0; index < count; index += 1) {
    const pointer = `/capabilityRegistry/capabilities/${index}`;
    const definition = registry.capabilities[index];
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
    assertSemanticVersion(
      definition.capabilityVersion,
      `${pointer}/capabilityVersion`,
      ERROR_CODES.REGISTRY_INVALID
    );
    assertSemanticId(
      definition.supportMatrixItemId,
      `${pointer}/supportMatrixItemId`,
      ERROR_CODES.REGISTRY_INVALID
    );
    for (const field of ["executorId", "inputSchemaId", "outputSchemaId", "qaContractId"]) {
      assertContractReference(definition[field], `${pointer}/${field}`, ERROR_CODES.REGISTRY_INVALID);
    }
    assertSortedUniqueStrings(
      definition.requiredBindingRoles,
      `${pointer}/requiredBindingRoles`,
      ERROR_CODES.REGISTRY_INVALID,
      MAX_BINDING_ROLES
    );
    if (definition.requiredBindingRoles.length === 0) {
      fail(ERROR_CODES.REGISTRY_INVALID, `${pointer}/requiredBindingRoles`);
    }
    assertSortedUniqueStrings(
      definition.conformanceFixtureIds,
      `${pointer}/conformanceFixtureIds`,
      ERROR_CODES.REGISTRY_INVALID,
      256
    );
    if (previousId !== undefined && compareText(previousId, definition.capabilityId) >= 0) {
      fail(ERROR_CODES.REGISTRY_INVALID, `${pointer}/capabilityId`);
    }
    previousId = definition.capabilityId;
    definitions.set(definition.capabilityId, definition);
  }
  return definitions;
}

function assertUniqueValue(seen, value, pointer, code) {
  if (seen.has(value)) fail(code, pointer);
  seen.add(value);
}

function parseShapes(shapes, pointer) {
  const count = assertDenseArray(shapes, pointer, ERROR_CODES.TARGET_INVALID, MAX_SHAPES);
  const byKey = new Map();
  const sourceIds = new Set();
  for (let index = 0; index < count; index += 1) {
    const shapePointer = `${pointer}/${index}`;
    const shape = shapes[index];
    assertShapeRecord(shape, shapePointer, ERROR_CODES.TARGET_INVALID);
    assertSemanticId(shape.shapeKey, `${shapePointer}/shapeKey`, ERROR_CODES.TARGET_INVALID);
    if (!Number.isInteger(shape.sourceId) || shape.sourceId < 1 || shape.sourceId > 4_294_967_295) {
      fail(ERROR_CODES.TARGET_INVALID, `${shapePointer}/sourceId`);
    }
    if (!SHAPE_KINDS.has(shape.kind)) fail(ERROR_CODES.TARGET_INVALID, `${shapePointer}/kind`);
    if (byKey.has(shape.shapeKey)) fail(ERROR_CODES.TARGET_INVALID, `${shapePointer}/shapeKey`);
    assertUniqueValue(sourceIds, shape.sourceId, `${shapePointer}/sourceId`, ERROR_CODES.TARGET_INVALID);
    const hasPlaceholder = Object.hasOwn(shape, "placeholder");
    if ((shape.kind === "placeholder") !== hasPlaceholder) {
      fail(ERROR_CODES.TARGET_INVALID, shapePointer);
    }
    if (hasPlaceholder) {
      assertExactRecord(
        shape.placeholder,
        ["type", "index"],
        `${shapePointer}/placeholder`,
        ERROR_CODES.TARGET_INVALID
      );
      assertSemanticId(
        shape.placeholder.type,
        `${shapePointer}/placeholder/type`,
        ERROR_CODES.TARGET_INVALID
      );
      if (!Number.isInteger(shape.placeholder.index) ||
          shape.placeholder.index < 0 || shape.placeholder.index > 65_535) {
        fail(ERROR_CODES.TARGET_INVALID, `${shapePointer}/placeholder/index`);
      }
    }
    byKey.set(shape.shapeKey, shape);
  }
  return byKey;
}

function parseTemplateIndex(index) {
  assertExactRecord(index, [
    "schemaVersion",
    "contractType",
    "templateIndexId",
    "templateProfileId",
    "templateFormat",
    "templateSha256",
    "presentationPart",
    "slideSizeEmu",
    "observedFeatureIds",
    "masters",
    "layouts",
    "slides"
  ], "/templateIndex", ERROR_CODES.DOCUMENT_INVALID);
  assertContractIdentity(index, CONTRACT_TYPES.templateIndex, "/templateIndex");
  assertSemanticId(index.templateIndexId, "/templateIndex/templateIndexId", ERROR_CODES.DOCUMENT_INVALID);
  assertSemanticId(index.templateProfileId, "/templateIndex/templateProfileId", ERROR_CODES.DOCUMENT_INVALID);
  if (!["potx", "pptx"].includes(index.templateFormat)) {
    fail(ERROR_CODES.DOCUMENT_INVALID, "/templateIndex/templateFormat");
  }
  if (typeof index.templateSha256 !== "string" || !SHA256.test(index.templateSha256)) {
    fail(ERROR_CODES.DOCUMENT_INVALID, "/templateIndex/templateSha256");
  }
  assertPackagePartPath(
    index.presentationPart,
    "/templateIndex/presentationPart",
    ERROR_CODES.DOCUMENT_INVALID
  );
  assertSortedUniqueStrings(
    index.observedFeatureIds,
    "/templateIndex/observedFeatureIds",
    ERROR_CODES.DOCUMENT_INVALID,
    256
  );

  const masterCount = assertDenseArray(
    index.masters,
    "/templateIndex/masters",
    ERROR_CODES.TARGET_INVALID,
    MAX_MASTERS,
    { nonempty: true }
  );
  const layoutCount = assertDenseArray(
    index.layouts,
    "/templateIndex/layouts",
    ERROR_CODES.TARGET_INVALID,
    MAX_LAYOUTS,
    { nonempty: true }
  );
  const slideCount = assertDenseArray(
    index.slides,
    "/templateIndex/slides",
    ERROR_CODES.TARGET_INVALID,
    MAX_SLIDES,
    { nonempty: true }
  );

  const masters = new Map();
  const layouts = new Map();
  const slides = new Map();
  const masterSourceIds = new Set();
  const layoutSourceIds = new Set();
  const slideSourceIds = new Set();
  const partPaths = new Set([index.presentationPart]);
  const foldedPartPaths = new Set([index.presentationPart.toLowerCase()]);

  const claimPartPath = (partPath, pointer) => {
    assertPackagePartPath(partPath, pointer, ERROR_CODES.TARGET_INVALID);
    const folded = partPath.toLowerCase();
    if (partPaths.has(partPath) || foldedPartPaths.has(folded)) {
      fail(ERROR_CODES.TARGET_INVALID, pointer);
    }
    partPaths.add(partPath);
    foldedPartPaths.add(folded);
  };

  for (let indexPosition = 0; indexPosition < masterCount; indexPosition += 1) {
    const pointer = `/templateIndex/masters/${indexPosition}`;
    const master = index.masters[indexPosition];
    assertExactRecord(master, ["masterKey", "sourceId", "partPath"], pointer, ERROR_CODES.TARGET_INVALID);
    assertSemanticId(master.masterKey, `${pointer}/masterKey`, ERROR_CODES.TARGET_INVALID);
    if (masters.has(master.masterKey)) fail(ERROR_CODES.TARGET_INVALID, `${pointer}/masterKey`);
    if (!Number.isInteger(master.sourceId) || master.sourceId < 1 || master.sourceId > 4_294_967_295) {
      fail(ERROR_CODES.TARGET_INVALID, `${pointer}/sourceId`);
    }
    assertUniqueValue(masterSourceIds, master.sourceId, `${pointer}/sourceId`, ERROR_CODES.TARGET_INVALID);
    claimPartPath(master.partPath, `${pointer}/partPath`);
    masters.set(master.masterKey, master);
  }

  for (let indexPosition = 0; indexPosition < layoutCount; indexPosition += 1) {
    const pointer = `/templateIndex/layouts/${indexPosition}`;
    const layout = index.layouts[indexPosition];
    assertExactRecord(
      layout,
      ["layoutKey", "sourceId", "partPath", "masterKey", "shapes"],
      pointer,
      ERROR_CODES.TARGET_INVALID
    );
    assertSemanticId(layout.layoutKey, `${pointer}/layoutKey`, ERROR_CODES.TARGET_INVALID);
    assertSemanticId(layout.masterKey, `${pointer}/masterKey`, ERROR_CODES.TARGET_INVALID);
    if (layouts.has(layout.layoutKey)) fail(ERROR_CODES.TARGET_INVALID, `${pointer}/layoutKey`);
    if (!Number.isInteger(layout.sourceId) || layout.sourceId < 1 || layout.sourceId > 4_294_967_295) {
      fail(ERROR_CODES.TARGET_INVALID, `${pointer}/sourceId`);
    }
    assertUniqueValue(layoutSourceIds, layout.sourceId, `${pointer}/sourceId`, ERROR_CODES.TARGET_INVALID);
    claimPartPath(layout.partPath, `${pointer}/partPath`);
    layouts.set(layout.layoutKey, Object.freeze({
      owner: layout,
      shapes: parseShapes(layout.shapes, `${pointer}/shapes`)
    }));
  }

  for (let indexPosition = 0; indexPosition < slideCount; indexPosition += 1) {
    const pointer = `/templateIndex/slides/${indexPosition}`;
    const slide = index.slides[indexPosition];
    assertExactRecord(
      slide,
      ["slideKey", "sourceId", "partPath", "layoutKey", "shapes"],
      pointer,
      ERROR_CODES.TARGET_INVALID
    );
    assertSemanticId(slide.slideKey, `${pointer}/slideKey`, ERROR_CODES.TARGET_INVALID);
    assertSemanticId(slide.layoutKey, `${pointer}/layoutKey`, ERROR_CODES.TARGET_INVALID);
    if (slides.has(slide.slideKey)) fail(ERROR_CODES.TARGET_INVALID, `${pointer}/slideKey`);
    if (!Number.isInteger(slide.sourceId) || slide.sourceId < 1 || slide.sourceId > 4_294_967_295) {
      fail(ERROR_CODES.TARGET_INVALID, `${pointer}/sourceId`);
    }
    assertUniqueValue(slideSourceIds, slide.sourceId, `${pointer}/sourceId`, ERROR_CODES.TARGET_INVALID);
    claimPartPath(slide.partPath, `${pointer}/partPath`);
    slides.set(slide.slideKey, Object.freeze({
      owner: slide,
      shapes: parseShapes(slide.shapes, `${pointer}/shapes`)
    }));
  }

  for (let indexPosition = 0; indexPosition < layoutCount; indexPosition += 1) {
    if (!masters.has(index.layouts[indexPosition].masterKey)) {
      fail(ERROR_CODES.TARGET_INVALID, `/templateIndex/layouts/${indexPosition}/masterKey`);
    }
  }
  for (let indexPosition = 0; indexPosition < slideCount; indexPosition += 1) {
    if (!layouts.has(index.slides[indexPosition].layoutKey)) {
      fail(ERROR_CODES.TARGET_INVALID, `/templateIndex/slides/${indexPosition}/layoutKey`);
    }
  }
  return Object.freeze({ layouts, slides });
}

function assertSame(actual, expected, pointer) {
  if (actual !== expected) fail(ERROR_CODES.IDENTITY_MISMATCH, pointer);
}

function parseOverlay(overlay, registry, definitions, index, indexMaps) {
  assertExactRecord(overlay, [
    "schemaVersion",
    "contractType",
    "projectOverlayId",
    "projectId",
    "templateProfileId",
    "templateIndexId",
    "templateSha256",
    "capabilityRegistryId",
    "registryVersion",
    "capabilitySelections",
    "shapeBindings"
  ], "/projectOverlay", ERROR_CODES.DOCUMENT_INVALID);
  assertContractIdentity(overlay, CONTRACT_TYPES.projectOverlay, "/projectOverlay");
  for (const field of ["projectOverlayId", "projectId", "templateProfileId", "templateIndexId", "capabilityRegistryId"]) {
    assertSemanticId(overlay[field], `/projectOverlay/${field}`, ERROR_CODES.DOCUMENT_INVALID);
  }
  assertSemanticVersion(overlay.registryVersion, "/projectOverlay/registryVersion", ERROR_CODES.DOCUMENT_INVALID);
  if (typeof overlay.templateSha256 !== "string" || !SHA256.test(overlay.templateSha256)) {
    fail(ERROR_CODES.DOCUMENT_INVALID, "/projectOverlay/templateSha256");
  }
  assertSame(overlay.templateProfileId, index.templateProfileId, "/projectOverlay/templateProfileId");
  assertSame(overlay.templateIndexId, index.templateIndexId, "/projectOverlay/templateIndexId");
  assertSame(overlay.templateSha256, index.templateSha256, "/projectOverlay/templateSha256");
  assertSame(
    overlay.capabilityRegistryId,
    registry.capabilityRegistryId,
    "/projectOverlay/capabilityRegistryId"
  );
  assertSame(overlay.registryVersion, registry.registryVersion, "/projectOverlay/registryVersion");

  const bindingCount = assertDenseArray(
    overlay.shapeBindings,
    "/projectOverlay/shapeBindings",
    ERROR_CODES.BINDING_INVALID,
    MAX_BINDINGS,
    { nonempty: true }
  );
  const bindings = new Map();
  const bindingPointers = new Map();
  const targets = new Set();
  let previousBindingId;
  for (let indexPosition = 0; indexPosition < bindingCount; indexPosition += 1) {
    const pointer = `/projectOverlay/shapeBindings/${indexPosition}`;
    const binding = overlay.shapeBindings[indexPosition];
    assertExactRecord(binding, [
      "shapeBindingId",
      "containerKind",
      "containerKey",
      "shapeKey",
      "expectedKind",
      "cardinality"
    ], pointer, ERROR_CODES.BINDING_INVALID);
    for (const field of ["shapeBindingId", "containerKey", "shapeKey"]) {
      assertSemanticId(binding[field], `${pointer}/${field}`, ERROR_CODES.BINDING_INVALID);
    }
    if (!Object.hasOwn(indexMaps, `${binding.containerKind}s`)) {
      fail(ERROR_CODES.BINDING_INVALID, `${pointer}/containerKind`);
    }
    if (!SHAPE_KINDS.has(binding.expectedKind)) {
      fail(ERROR_CODES.BINDING_INVALID, `${pointer}/expectedKind`);
    }
    if (binding.cardinality !== "exactly-one") {
      fail(ERROR_CODES.BINDING_INVALID, `${pointer}/cardinality`);
    }
    if (previousBindingId !== undefined && compareText(previousBindingId, binding.shapeBindingId) >= 0) {
      fail(ERROR_CODES.BINDING_INVALID, `${pointer}/shapeBindingId`);
    }
    const owners = indexMaps[`${binding.containerKind}s`];
    const owner = owners.get(binding.containerKey);
    if (!owner) fail(ERROR_CODES.TARGET_INVALID, `${pointer}/containerKey`);
    const shape = owner.shapes.get(binding.shapeKey);
    if (!shape) fail(ERROR_CODES.TARGET_INVALID, `${pointer}/shapeKey`);
    if (shape.kind !== binding.expectedKind) {
      fail(ERROR_CODES.TARGET_INVALID, `${pointer}/expectedKind`);
    }
    const target = `${binding.containerKind}\0${binding.containerKey}\0${binding.shapeKey}`;
    if (targets.has(target)) fail(ERROR_CODES.BINDING_INVALID, `${pointer}/shapeKey`);
    targets.add(target);
    bindings.set(binding.shapeBindingId, binding);
    bindingPointers.set(binding.shapeBindingId, pointer);
    previousBindingId = binding.shapeBindingId;
  }

  const selectionCount = assertDenseArray(
    overlay.capabilitySelections,
    "/projectOverlay/capabilitySelections",
    ERROR_CODES.SELECTION_INVALID,
    MAX_SELECTIONS,
    { nonempty: true }
  );
  const selections = new Map();
  const referencedBindingIds = new Set();
  let previousSelectionId;
  for (let indexPosition = 0; indexPosition < selectionCount; indexPosition += 1) {
    const pointer = `/projectOverlay/capabilitySelections/${indexPosition}`;
    const selection = overlay.capabilitySelections[indexPosition];
    assertExactRecord(selection, [
      "capabilitySelectionId",
      "capabilityId",
      "capabilityVersion",
      "experimentalOptIn",
      "bindings"
    ], pointer, ERROR_CODES.SELECTION_INVALID);
    assertSemanticId(
      selection.capabilitySelectionId,
      `${pointer}/capabilitySelectionId`,
      ERROR_CODES.SELECTION_INVALID
    );
    assertSemanticId(selection.capabilityId, `${pointer}/capabilityId`, ERROR_CODES.SELECTION_INVALID);
    assertSemanticVersion(
      selection.capabilityVersion,
      `${pointer}/capabilityVersion`,
      ERROR_CODES.SELECTION_INVALID
    );
    if (typeof selection.experimentalOptIn !== "boolean") {
      fail(ERROR_CODES.SELECTION_INVALID, `${pointer}/experimentalOptIn`);
    }
    if (previousSelectionId !== undefined &&
        compareText(previousSelectionId, selection.capabilitySelectionId) >= 0) {
      fail(ERROR_CODES.SELECTION_INVALID, `${pointer}/capabilitySelectionId`);
    }
    const definition = definitions.get(selection.capabilityId);
    if (!definition) fail(ERROR_CODES.SELECTION_INVALID, `${pointer}/capabilityId`);
    if (selection.capabilityVersion !== definition.capabilityVersion) {
      fail(ERROR_CODES.SELECTION_INVALID, `${pointer}/capabilityVersion`);
    }
    const assignmentCount = assertDenseArray(
      selection.bindings,
      `${pointer}/bindings`,
      ERROR_CODES.BINDING_INVALID,
      MAX_BINDING_ROLES,
      { nonempty: true }
    );
    if (assignmentCount !== definition.requiredBindingRoles.length) {
      fail(ERROR_CODES.BINDING_INVALID, `${pointer}/bindings`);
    }
    const resolvedBindings = [];
    const selectionBindingIds = new Set();
    let previousRole;
    for (let assignmentIndex = 0; assignmentIndex < assignmentCount; assignmentIndex += 1) {
      const assignmentPointer = `${pointer}/bindings/${assignmentIndex}`;
      const assignment = selection.bindings[assignmentIndex];
      assertExactRecord(
        assignment,
        ["role", "shapeBindingId"],
        assignmentPointer,
        ERROR_CODES.BINDING_INVALID
      );
      assertSemanticId(assignment.role, `${assignmentPointer}/role`, ERROR_CODES.BINDING_INVALID);
      assertSemanticId(
        assignment.shapeBindingId,
        `${assignmentPointer}/shapeBindingId`,
        ERROR_CODES.BINDING_INVALID
      );
      if (previousRole !== undefined && compareText(previousRole, assignment.role) >= 0) {
        fail(ERROR_CODES.BINDING_INVALID, `${assignmentPointer}/role`);
      }
      if (assignment.role !== definition.requiredBindingRoles[assignmentIndex]) {
        fail(ERROR_CODES.BINDING_INVALID, `${assignmentPointer}/role`);
      }
      const binding = bindings.get(assignment.shapeBindingId);
      if (!binding) fail(ERROR_CODES.BINDING_INVALID, `${assignmentPointer}/shapeBindingId`);
      if (selectionBindingIds.has(assignment.shapeBindingId)) {
        fail(ERROR_CODES.BINDING_INVALID, `${assignmentPointer}/shapeBindingId`);
      }
      selectionBindingIds.add(assignment.shapeBindingId);
      referencedBindingIds.add(assignment.shapeBindingId);
      resolvedBindings.push(Object.freeze({
        role: assignment.role,
        shapeBindingId: binding.shapeBindingId,
        containerKind: binding.containerKind,
        containerKey: binding.containerKey,
        shapeKey: binding.shapeKey,
        expectedKind: binding.expectedKind,
        cardinality: binding.cardinality
      }));
      previousRole = assignment.role;
    }
    selections.set(selection.capabilitySelectionId, Object.freeze({
      capabilitySelectionId: selection.capabilitySelectionId,
      capabilityId: selection.capabilityId,
      capabilityVersion: selection.capabilityVersion,
      experimentalOptIn: selection.experimentalOptIn,
      bindings: Object.freeze(resolvedBindings)
    }));
    previousSelectionId = selection.capabilitySelectionId;
  }

  if (referencedBindingIds.size !== bindings.size) {
    for (const bindingId of bindings.keys()) {
      if (!referencedBindingIds.has(bindingId)) {
        fail(ERROR_CODES.BINDING_INVALID, bindingPointers.get(bindingId));
      }
    }
  }
  return selections;
}

function buildInvocations(deck, overlay, index, selections) {
  assertExactRecord(deck, [
    "schemaVersion",
    "contractType",
    "deckId",
    "projectId",
    "templateProfileId",
    "projectOverlayId",
    "slides"
  ], "/deckSpec", ERROR_CODES.DOCUMENT_INVALID);
  assertContractIdentity(deck, CONTRACT_TYPES.deckSpec, "/deckSpec");
  for (const field of ["deckId", "projectId", "templateProfileId", "projectOverlayId"]) {
    assertSemanticId(deck[field], `/deckSpec/${field}`, ERROR_CODES.DOCUMENT_INVALID);
  }
  assertSame(deck.projectId, overlay.projectId, "/deckSpec/projectId");
  assertSame(deck.templateProfileId, overlay.templateProfileId, "/deckSpec/templateProfileId");
  assertSame(deck.templateProfileId, index.templateProfileId, "/deckSpec/templateProfileId");
  assertSame(deck.projectOverlayId, overlay.projectOverlayId, "/deckSpec/projectOverlayId");
  const count = assertDenseArray(
    deck.slides,
    "/deckSpec/slides",
    ERROR_CODES.SELECTION_INVALID,
    MAX_SLIDES,
    { nonempty: true }
  );
  const slideIds = new Set();
  const invocations = [];
  for (let indexPosition = 0; indexPosition < count; indexPosition += 1) {
    const pointer = `/deckSpec/slides/${indexPosition}`;
    const slide = deck.slides[indexPosition];
    assertExactRecord(
      slide,
      ["slideId", "capabilitySelectionId", "payload"],
      pointer,
      ERROR_CODES.SELECTION_INVALID
    );
    assertSemanticId(slide.slideId, `${pointer}/slideId`, ERROR_CODES.SELECTION_INVALID);
    assertSemanticId(
      slide.capabilitySelectionId,
      `${pointer}/capabilitySelectionId`,
      ERROR_CODES.SELECTION_INVALID
    );
    if (!isPlainRecord(slide.payload)) fail(ERROR_CODES.DOCUMENT_INVALID, `${pointer}/payload`);
    if (slideIds.has(slide.slideId)) fail(ERROR_CODES.SELECTION_INVALID, `${pointer}/slideId`);
    slideIds.add(slide.slideId);
    const selection = selections.get(slide.capabilitySelectionId);
    if (!selection) fail(ERROR_CODES.SELECTION_INVALID, `${pointer}/capabilitySelectionId`);
    invocations.push(deepFreeze({
      invocationId: slide.slideId,
      capabilitySelectionId: selection.capabilitySelectionId,
      capabilityId: selection.capabilityId,
      capabilityVersion: selection.capabilityVersion,
      experimentalOptIn: selection.experimentalOptIn,
      payload: slide.payload,
      bindings: selection.bindings.map((binding) => ({ ...binding }))
    }));
  }
  return Object.freeze(invocations);
}

/**
 * Resolve a complete in-memory project bundle and immediately prepare an
 * authenticated one-shot dispatcher plan. Intermediate invocations never
 * become caller-owned data.
 */
export function prepareResolvedDeckDispatch(options) {
  assertExactRecord(options, [
    "runtime",
    "capabilityRegistry",
    "projectOverlay",
    "templateIndex",
    "deckSpec",
    "dependencies"
  ], "", ERROR_CODES.ARGUMENT_INVALID);

  const runtime = dataProperty(options, "runtime");
  const dependencies = captureDependencies(dataProperty(options, "dependencies"));
  const sources = Object.freeze({
    capabilityRegistry: dataProperty(options, "capabilityRegistry"),
    deckSpec: dataProperty(options, "deckSpec"),
    projectOverlay: dataProperty(options, "projectOverlay"),
    templateIndex: dataProperty(options, "templateIndex")
  });
  const totals = { nodes: 0, stringBytes: 0 };
  const registry = snapshotDocument(sources.capabilityRegistry, "/capabilityRegistry", totals);
  const overlay = snapshotDocument(sources.projectOverlay, "/projectOverlay", totals);
  const index = snapshotDocument(sources.templateIndex, "/templateIndex", totals);
  const deck = snapshotDocument(sources.deckSpec, "/deckSpec", totals);

  callExactTrue(dependencies.validateCapabilityRegistry, registry, "/capabilityRegistry");
  callExactTrue(dependencies.validateProjectOverlay, overlay, "/projectOverlay");
  callExactTrue(dependencies.validateTemplateIndex, index, "/templateIndex");
  callExactTrue(dependencies.validateDeckSpec, deck, "/deckSpec");

  const definitions = parseRegistry(registry);
  assertCapabilityRuntimeRegistry({ runtime, capabilityRegistry: registry });
  const indexMaps = parseTemplateIndex(index);
  const selections = parseOverlay(overlay, registry, definitions, index, indexMaps);
  const invocations = buildInvocations(deck, overlay, index, selections);
  return prepareCapabilityDispatch({ runtime, invocations });
}

/**
 * Validate the complete readable project identity graph before delegating to
 * the existing full-batch resolver. The returned plan is still opaque and
 * one-shot; callers that only validate must discard it without execution.
 */
export function prepareResolvedProjectDispatch(options) {
  assertExactRecord(options, [
    "runtime",
    "projectConfig",
    "templateProfile",
    "templateIndex",
    "capabilityRegistry",
    "projectOverlay",
    "deckSpec",
    "dependencies"
  ], "", ERROR_CODES.ARGUMENT_INVALID);

  const runtime = dataProperty(options, "runtime");
  const dependencies = captureProjectDependencies(dataProperty(options, "dependencies"));
  const totals = { nodes: 0, stringBytes: 0 };
  const config = snapshotDocument(dataProperty(options, "projectConfig"), "/projectConfig", totals);
  const profile = snapshotDocument(dataProperty(options, "templateProfile"), "/templateProfile", totals);
  const index = snapshotDocument(dataProperty(options, "templateIndex"), "/templateIndex", totals);
  const registry = snapshotDocument(
    dataProperty(options, "capabilityRegistry"),
    "/capabilityRegistry",
    totals
  );
  const overlay = snapshotDocument(dataProperty(options, "projectOverlay"), "/projectOverlay", totals);
  const deck = snapshotDocument(dataProperty(options, "deckSpec"), "/deckSpec", totals);

  callExactTrue(dependencies.validateProjectConfig, config, "/projectConfig");
  callExactTrue(dependencies.validateTemplateProfile, profile, "/templateProfile");
  callExactTrue(dependencies.validateTemplateIndex, index, "/templateIndex");
  callExactTrue(dependencies.validateCapabilityRegistry, registry, "/capabilityRegistry");
  callExactTrue(dependencies.validateProjectOverlay, overlay, "/projectOverlay");
  callExactTrue(dependencies.validateDeckSpec, deck, "/deckSpec");

  assertExactRecord(config, [
    "schemaVersion",
    "contractType",
    "projectId",
    "template",
    "capabilityRegistry",
    "projectOverlay",
    "paths",
    "policies"
  ], "/projectConfig", ERROR_CODES.DOCUMENT_INVALID);
  assertContractIdentity(config, CONTRACT_TYPES.projectConfig, "/projectConfig");
  assertSemanticId(config.projectId, "/projectConfig/projectId", ERROR_CODES.DOCUMENT_INVALID);
  assertExactRecord(config.template, [
    "sourcePath",
    "profileId",
    "profilePath",
    "indexId",
    "indexPath"
  ], "/projectConfig/template", ERROR_CODES.DOCUMENT_INVALID);
  assertSemanticId(
    config.template.profileId,
    "/projectConfig/template/profileId",
    ERROR_CODES.DOCUMENT_INVALID
  );
  assertSemanticId(
    config.template.indexId,
    "/projectConfig/template/indexId",
    ERROR_CODES.DOCUMENT_INVALID
  );
  assertExactRecord(config.capabilityRegistry, [
    "registryId",
    "registryVersion",
    "path"
  ], "/projectConfig/capabilityRegistry", ERROR_CODES.DOCUMENT_INVALID);
  assertSemanticId(
    config.capabilityRegistry.registryId,
    "/projectConfig/capabilityRegistry/registryId",
    ERROR_CODES.DOCUMENT_INVALID
  );
  assertSemanticVersion(
    config.capabilityRegistry.registryVersion,
    "/projectConfig/capabilityRegistry/registryVersion",
    ERROR_CODES.DOCUMENT_INVALID
  );
  assertExactRecord(
    config.projectOverlay,
    ["overlayId", "path"],
    "/projectConfig/projectOverlay",
    ERROR_CODES.DOCUMENT_INVALID
  );
  assertSemanticId(
    config.projectOverlay.overlayId,
    "/projectConfig/projectOverlay/overlayId",
    ERROR_CODES.DOCUMENT_INVALID
  );

  assertExactRecord(profile, [
    "schemaVersion",
    "contractType",
    "templateProfileId",
    "templateIndexId",
    "templateFormat",
    "templateSha256",
    "slideSizeEmu",
    "layoutBindings"
  ], "/templateProfile", ERROR_CODES.DOCUMENT_INVALID);
  assertContractIdentity(profile, CONTRACT_TYPES.templateProfile, "/templateProfile");
  assertSemanticId(
    profile.templateProfileId,
    "/templateProfile/templateProfileId",
    ERROR_CODES.DOCUMENT_INVALID
  );
  assertSemanticId(
    profile.templateIndexId,
    "/templateProfile/templateIndexId",
    ERROR_CODES.DOCUMENT_INVALID
  );
  if (typeof profile.templateSha256 !== "string" || !SHA256.test(profile.templateSha256)) {
    fail(ERROR_CODES.DOCUMENT_INVALID, "/templateProfile/templateSha256");
  }
  if (!["potx", "pptx"].includes(profile.templateFormat)) {
    fail(ERROR_CODES.DOCUMENT_INVALID, "/templateProfile/templateFormat");
  }
  assertExactRecord(
    profile.slideSizeEmu,
    ["cx", "cy"],
    "/templateProfile/slideSizeEmu",
    ERROR_CODES.DOCUMENT_INVALID
  );
  for (const dimension of ["cx", "cy"]) {
    const value = profile.slideSizeEmu[dimension];
    if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) {
      fail(ERROR_CODES.DOCUMENT_INVALID, `/templateProfile/slideSizeEmu/${dimension}`);
    }
  }

  const indexMaps = parseTemplateIndex(index);
  const bindingCount = assertDenseArray(
    profile.layoutBindings,
    "/templateProfile/layoutBindings",
    ERROR_CODES.DOCUMENT_INVALID,
    MAX_LAYOUT_BINDINGS,
    { nonempty: true }
  );
  const semanticRoles = new Set();
  let previousLayoutKey;
  for (let bindingIndex = 0; bindingIndex < bindingCount; bindingIndex += 1) {
    const pointer = `/templateProfile/layoutBindings/${bindingIndex}`;
    const binding = profile.layoutBindings[bindingIndex];
    assertExactRecord(
      binding,
      ["layoutKey", "semanticRole"],
      pointer,
      ERROR_CODES.DOCUMENT_INVALID
    );
    assertSemanticId(binding.layoutKey, `${pointer}/layoutKey`, ERROR_CODES.DOCUMENT_INVALID);
    assertSemanticId(binding.semanticRole, `${pointer}/semanticRole`, ERROR_CODES.DOCUMENT_INVALID);
    if (previousLayoutKey !== undefined && compareText(previousLayoutKey, binding.layoutKey) >= 0) {
      fail(ERROR_CODES.DOCUMENT_INVALID, `${pointer}/layoutKey`);
    }
    if (semanticRoles.has(binding.semanticRole)) {
      fail(ERROR_CODES.DOCUMENT_INVALID, `${pointer}/semanticRole`);
    }
    if (!indexMaps.layouts.has(binding.layoutKey)) {
      fail(ERROR_CODES.IDENTITY_MISMATCH, `${pointer}/layoutKey`);
    }
    semanticRoles.add(binding.semanticRole);
    previousLayoutKey = binding.layoutKey;
  }

  assertSame(profile.templateProfileId, config.template.profileId, "/templateProfile/templateProfileId");
  assertSame(profile.templateIndexId, config.template.indexId, "/templateProfile/templateIndexId");
  assertSame(index.templateProfileId, profile.templateProfileId, "/templateIndex/templateProfileId");
  assertSame(index.templateIndexId, profile.templateIndexId, "/templateIndex/templateIndexId");
  assertSame(index.templateFormat, profile.templateFormat, "/templateIndex/templateFormat");
  assertSame(index.templateSha256, profile.templateSha256, "/templateIndex/templateSha256");
  assertSame(index.slideSizeEmu.cx, profile.slideSizeEmu.cx, "/templateIndex/slideSizeEmu/cx");
  assertSame(index.slideSizeEmu.cy, profile.slideSizeEmu.cy, "/templateIndex/slideSizeEmu/cy");
  assertSame(
    registry.capabilityRegistryId,
    config.capabilityRegistry.registryId,
    "/capabilityRegistry/capabilityRegistryId"
  );
  assertSame(
    registry.registryVersion,
    config.capabilityRegistry.registryVersion,
    "/capabilityRegistry/registryVersion"
  );
  assertSame(overlay.projectOverlayId, config.projectOverlay.overlayId, "/projectOverlay/projectOverlayId");
  assertSame(overlay.projectId, config.projectId, "/projectOverlay/projectId");
  assertSame(deck.projectId, config.projectId, "/deckSpec/projectId");

  return prepareResolvedDeckDispatch({
    runtime,
    capabilityRegistry: registry,
    projectOverlay: overlay,
    templateIndex: index,
    deckSpec: deck,
    dependencies: {
      validateCapabilityRegistry: dependencies.validateCapabilityRegistry,
      validateDeckSpec: dependencies.validateDeckSpec,
      validateProjectOverlay: dependencies.validateProjectOverlay,
      validateTemplateIndex: dependencies.validateTemplateIndex
    }
  });
}
