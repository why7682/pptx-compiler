const EXPECTED_META_SCHEMA = "https://json-schema.org/draft/2020-12/schema";

const SUPPORTED_KEYWORDS = new Set([
  "$schema",
  "$id",
  "$defs",
  "$ref",
  "title",
  "description",
  "type",
  "additionalProperties",
  "required",
  "properties",
  "const",
  "enum",
  "oneOf",
  "items",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "minProperties",
  "maxProperties"
]);

const JSON_TYPES = new Set(["object", "array", "string", "integer", "number", "boolean", "null"]);

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => jsonEqual(value, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) => key === rightKeys[index] && jsonEqual(left[key], right[key]));
  }
  return false;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function escapePointer(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function decodePointerSegment(value) {
  if (/~(?:[^01]|$)/.test(value)) throw new Error("JSON Schema reference has an invalid JSON Pointer escape");
  return value.replaceAll("~1", "/").replaceAll("~0", "~");
}

function splitReference(reference) {
  if (typeof reference !== "string" || reference.length === 0) {
    throw new Error("JSON Schema reference must be a non-empty string");
  }
  if (reference.startsWith("#")) return { schemaId: null, fragment: reference };
  const hash = reference.indexOf("#");
  const schemaId = hash === -1 ? reference : reference.slice(0, hash);
  const fragment = hash === -1 ? "#" : reference.slice(hash);
  if (!/^[A-Za-z][A-Za-z0-9+.-]*:[^\s#]+$/.test(schemaId)) {
    throw new Error("only absolute registered JSON Schema references are supported");
  }
  return { schemaId, fragment };
}

function resolveFragment(rootSchema, fragment) {
  if (fragment === "#") return { schema: rootSchema, pointer: "#" };
  if (!fragment.startsWith("#/")) {
    throw new Error("only root and JSON Pointer schema fragments are supported");
  }
  let current = rootSchema;
  for (const encoded of fragment.slice(2).split("/")) {
    const key = decodePointerSegment(encoded);
    if (!isPlainObject(current) || !Object.hasOwn(current, key)) {
      throw new Error("JSON Schema reference does not resolve");
    }
    current = current[key];
  }
  if (!isPlainObject(current)) {
    throw new Error("JSON Schema reference does not resolve to a schema object");
  }
  return { schema: current, pointer: fragment };
}

const schemaLocationCache = new WeakMap();

function schemaLocations(rootSchema) {
  const cached = schemaLocationCache.get(rootSchema);
  if (cached) return cached;
  const locations = new Set(["#"]);
  const pending = [[rootSchema, "#"]];
  const seen = new WeakSet();
  const enqueue = (candidate, pointer) => {
    if (!isPlainObject(candidate)) return;
    locations.add(pointer);
    pending.push([candidate, pointer]);
  };
  while (pending.length > 0) {
    const [node, pointer] = pending.pop();
    if (seen.has(node)) continue;
    seen.add(node);
    if (isPlainObject(node.properties)) {
      for (const [key, child] of Object.entries(node.properties)) {
        enqueue(child, `${pointer}/properties/${escapePointer(key)}`);
      }
    }
    if (isPlainObject(node.$defs)) {
      for (const [key, child] of Object.entries(node.$defs)) {
        enqueue(child, `${pointer}/$defs/${escapePointer(key)}`);
      }
    }
    enqueue(node.additionalProperties, `${pointer}/additionalProperties`);
    enqueue(node.items, `${pointer}/items`);
    if (Array.isArray(node.oneOf)) {
      for (let index = 0; index < node.oneOf.length; index += 1) {
        enqueue(node.oneOf[index], `${pointer}/oneOf/${index}`);
      }
    }
  }
  schemaLocationCache.set(rootSchema, locations);
  return locations;
}

export function createSchemaRegistry(schemas) {
  const registry = new Map();
  for (const schema of schemas) {
    if (!isPlainObject(schema) || typeof schema.$id !== "string" || schema.$id.length === 0) {
      throw new Error("every registered JSON Schema must have a non-empty $id");
    }
    if (registry.has(schema.$id)) throw new Error(`duplicate JSON Schema identifier ${schema.$id}`);
    registry.set(schema.$id, schema);
  }
  return registry;
}

export function resolveSchemaReference(reference, rootSchema, registry = new Map()) {
  const { schemaId, fragment } = splitReference(reference);
  const targetRoot = schemaId === null ? rootSchema : registry.get(schemaId);
  if (!isPlainObject(targetRoot)) throw new Error("JSON Schema reference targets an unregistered schema");
  const resolved = resolveFragment(targetRoot, fragment);
  if (!schemaLocations(targetRoot).has(resolved.pointer)) {
    throw new Error("JSON Schema reference does not target a schema location");
  }
  return {
    ...resolved,
    rootSchema: targetRoot,
    schemaId: targetRoot.$id
  };
}

function assertNonNegativeInteger(value, keyword) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${keyword} must be a non-negative safe integer`);
}

function assertFiniteNumber(value, keyword) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${keyword} must be finite`);
}

export function assertSupportedSchema(schema, {
  expectedId,
  registry = new Map([[schema?.$id, schema]])
} = {}) {
  const assertRootAuthority = (rootSchema) => {
    if (!isPlainObject(rootSchema) || rootSchema.$schema !== EXPECTED_META_SCHEMA ||
        typeof rootSchema.$id !== "string") {
      throw new Error("unsupported JSON Schema authority or identifier");
    }
    if (!/^[A-Za-z][A-Za-z0-9+.-]*:[^\s#]+$/.test(rootSchema.$id) ||
        registry.get(rootSchema.$id) !== rootSchema) {
      throw new Error("JSON Schema identifier is not an absolute registered authority");
    }
  };
  assertRootAuthority(schema);
  if (expectedId !== undefined && schema.$id !== expectedId) {
    throw new Error("unexpected JSON Schema identifier");
  }

  const visit = (node, nodeRoot, isRoot = false) => {
    if (!isPlainObject(node)) throw new Error("schema nodes must be objects");
    for (const keyword of Object.keys(node)) {
      if (!SUPPORTED_KEYWORDS.has(keyword)) throw new Error(`unsupported JSON Schema keyword ${keyword}`);
    }
    for (const keyword of ["title", "description"]) {
      if (node[keyword] !== undefined && typeof node[keyword] !== "string") {
        throw new Error(`schema ${keyword} must be a string`);
      }
    }
    if (!isRoot && (node.$schema !== undefined || node.$id !== undefined)) {
      throw new Error("nested $schema and $id scopes are unsupported");
    }
    if (node.type !== undefined && !JSON_TYPES.has(node.type)) throw new Error("unsupported JSON Schema type");
    if (node.required !== undefined &&
        (!Array.isArray(node.required) || new Set(node.required).size !== node.required.length ||
         node.required.some((key) => typeof key !== "string"))) {
      throw new Error("schema required must contain unique strings");
    }
    if (node.enum !== undefined && (!Array.isArray(node.enum) || node.enum.length === 0)) {
      throw new Error("schema enum must be a non-empty array");
    }
    if (node.enum !== undefined && new Set(node.enum.map(canonicalJson)).size !== node.enum.length) {
      throw new Error("schema enum values must be unique");
    }
    if (node.uniqueItems !== undefined && typeof node.uniqueItems !== "boolean") {
      throw new Error("schema uniqueItems must be a boolean");
    }
    if (node.properties !== undefined) {
      if (!isPlainObject(node.properties)) throw new Error("schema properties must be an object");
      for (const child of Object.values(node.properties)) visit(child, nodeRoot);
    }
    if (node.$defs !== undefined) {
      if (!isPlainObject(node.$defs)) throw new Error("schema $defs must be an object");
      for (const child of Object.values(node.$defs)) visit(child, nodeRoot);
    }
    if (node.additionalProperties !== undefined && typeof node.additionalProperties !== "boolean") {
      visit(node.additionalProperties, nodeRoot);
    }
    if (node.items !== undefined) visit(node.items, nodeRoot);
    if (node.oneOf !== undefined) {
      if (!Array.isArray(node.oneOf) || node.oneOf.length === 0) throw new Error("schema oneOf must be non-empty");
      for (const child of node.oneOf) visit(child, nodeRoot);
    }
    for (const keyword of ["minItems", "maxItems", "minLength", "maxLength", "minProperties", "maxProperties"]) {
      if (node[keyword] !== undefined) assertNonNegativeInteger(node[keyword], keyword);
    }
    for (const keyword of ["minimum", "maximum"]) {
      if (node[keyword] !== undefined) assertFiniteNumber(node[keyword], keyword);
    }
    if (node.minItems !== undefined && node.maxItems !== undefined && node.minItems > node.maxItems) {
      throw new Error("schema minItems exceeds maxItems");
    }
    if (node.minLength !== undefined && node.maxLength !== undefined && node.minLength > node.maxLength) {
      throw new Error("schema minLength exceeds maxLength");
    }
    if (node.minProperties !== undefined && node.maxProperties !== undefined &&
        node.minProperties > node.maxProperties) {
      throw new Error("schema minProperties exceeds maxProperties");
    }
    if (node.minimum !== undefined && node.maximum !== undefined && node.minimum > node.maximum) {
      throw new Error("schema minimum exceeds maximum");
    }
    if (node.pattern !== undefined) {
      if (typeof node.pattern !== "string") throw new Error("schema pattern must be a string");
      new RegExp(node.pattern, "u");
    }
    if (node.format !== undefined && node.format !== "date") {
      throw new Error("only the asserted date format is supported");
    }
    if (node.$ref !== undefined) resolveSchemaReference(node.$ref, nodeRoot, registry);
  };
  visit(schema, schema, true);

  const completedReferences = new Set();
  const walkReferences = (node, nodeRoot, activeReferences) => {
    if (node.$ref !== undefined) {
      const resolved = resolveSchemaReference(node.$ref, nodeRoot, registry);
      const key = `${resolved.schemaId}${resolved.pointer}`;
      if (activeReferences.has(key)) throw new Error("cyclic JSON Schema references are unsupported");
      if (!completedReferences.has(key)) {
        assertRootAuthority(resolved.rootSchema);
        visit(resolved.schema, resolved.rootSchema, resolved.pointer === "#");
        activeReferences.add(key);
        walkReferences(resolved.schema, resolved.rootSchema, activeReferences);
        activeReferences.delete(key);
        completedReferences.add(key);
      }
    }
    for (const child of Object.values(node.properties ?? {})) walkReferences(child, nodeRoot, activeReferences);
    for (const child of Object.values(node.$defs ?? {})) walkReferences(child, nodeRoot, activeReferences);
    if (isPlainObject(node.additionalProperties)) walkReferences(node.additionalProperties, nodeRoot, activeReferences);
    if (isPlainObject(node.items)) walkReferences(node.items, nodeRoot, activeReferences);
    for (const child of node.oneOf ?? []) walkReferences(child, nodeRoot, activeReferences);
  };
  walkReferences(schema, schema, new Set([`${schema.$id}#`]));
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function matchesType(instance, type) {
  return (type === "object" && isPlainObject(instance)) ||
    (type === "array" && Array.isArray(instance)) ||
    (type === "string" && typeof instance === "string") ||
    (type === "integer" && Number.isInteger(instance)) ||
    (type === "number" && typeof instance === "number" && Number.isFinite(instance)) ||
    (type === "boolean" && typeof instance === "boolean") ||
    (type === "null" && instance === null);
}

export function validateJson(instance, schema, {
  rootSchema = schema,
  registry = new Map([[rootSchema?.$id, rootSchema]]),
  pointer = ""
} = {}) {
  const errors = [];

  if (schema.$ref !== undefined) {
    const resolved = resolveSchemaReference(schema.$ref, rootSchema, registry);
    errors.push(...validateJson(instance, resolved.schema, {
      rootSchema: resolved.rootSchema,
      registry,
      pointer
    }));
  }
  if (schema.const !== undefined && !jsonEqual(instance, schema.const)) {
    errors.push({ pointer, keyword: "const" });
  }
  if (schema.enum !== undefined && !schema.enum.some((item) => jsonEqual(item, instance))) {
    errors.push({ pointer, keyword: "enum" });
  }
  if (schema.oneOf !== undefined) {
    const matches = schema.oneOf.filter((candidate) => validateJson(instance, candidate, {
      rootSchema,
      registry,
      pointer
    }).length === 0);
    if (matches.length !== 1) errors.push({ pointer, keyword: "oneOf" });
  }
  if (schema.type !== undefined && !matchesType(instance, schema.type)) {
    errors.push({ pointer, keyword: "type" });
    return errors;
  }

  if (isPlainObject(instance)) {
    const keys = Object.keys(instance);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      errors.push({ pointer, keyword: "minProperties" });
    }
    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
      errors.push({ pointer, keyword: "maxProperties" });
    }
    if (schema.required !== undefined) {
      for (const key of schema.required) {
        if (!Object.hasOwn(instance, key)) {
          errors.push({ pointer: `${pointer}/${escapePointer(key)}`, keyword: "required" });
        }
      }
    }
    for (const [key, value] of Object.entries(instance)) {
      if (isPlainObject(schema.properties) && Object.hasOwn(schema.properties, key)) {
        errors.push(...validateJson(value, schema.properties[key], {
          rootSchema,
          registry,
          pointer: `${pointer}/${escapePointer(key)}`
        }));
      } else if (schema.additionalProperties === false) {
        errors.push({ pointer: `${pointer}/${escapePointer(key)}`, keyword: "additionalProperties" });
      } else if (isPlainObject(schema.additionalProperties)) {
        errors.push(...validateJson(value, schema.additionalProperties, {
          rootSchema,
          registry,
          pointer: `${pointer}/${escapePointer(key)}`
        }));
      }
    }
  }

  if (Array.isArray(instance)) {
    if (schema.minItems !== undefined && instance.length < schema.minItems) {
      errors.push({ pointer, keyword: "minItems" });
    }
    if (schema.maxItems !== undefined && instance.length > schema.maxItems) {
      errors.push({ pointer, keyword: "maxItems" });
    }
    if (schema.uniqueItems === true) {
      const seen = new Set();
      for (let index = 0; index < instance.length; index += 1) {
        const canonical = canonicalJson(instance[index]);
        if (seen.has(canonical)) errors.push({ pointer: `${pointer}/${index}`, keyword: "uniqueItems" });
        seen.add(canonical);
      }
    }
    if (schema.items !== undefined) {
      for (let index = 0; index < instance.length; index += 1) {
        errors.push(...validateJson(instance[index], schema.items, {
          rootSchema,
          registry,
          pointer: `${pointer}/${index}`
        }));
      }
    }
  }

  if (typeof instance === "string") {
    const length = [...instance].length;
    if (schema.minLength !== undefined && length < schema.minLength) {
      errors.push({ pointer, keyword: "minLength" });
    }
    if (schema.maxLength !== undefined && length > schema.maxLength) {
      errors.push({ pointer, keyword: "maxLength" });
    }
    if (schema.pattern !== undefined && !(new RegExp(schema.pattern, "u")).test(instance)) {
      errors.push({ pointer, keyword: "pattern" });
    }
    if (schema.format === "date" && !validDate(instance)) {
      errors.push({ pointer, keyword: "format" });
    }
  }

  if (typeof instance === "number" && Number.isFinite(instance)) {
    if (schema.minimum !== undefined && instance < schema.minimum) {
      errors.push({ pointer, keyword: "minimum" });
    }
    if (schema.maximum !== undefined && instance > schema.maximum) {
      errors.push({ pointer, keyword: "maximum" });
    }
  }
  return errors;
}

export { EXPECTED_META_SCHEMA };
