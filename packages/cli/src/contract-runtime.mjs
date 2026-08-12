import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  assertSupportedSchema,
  createSchemaRegistry,
  validateJson
} from "#pptx-compiler/extension-api";

const SAFE_SCHEMA_PATH = /^schemas\/contracts\/[A-Za-z0-9._-]+[.]json$/u;

export class CliContractRuntimeError extends Error {
  constructor() {
    super("CLI_CONTRACT_RUNTIME_INVALID");
    this.name = "CliContractRuntimeError";
    this.code = "CLI_CONTRACT_RUNTIME_INVALID";
    this.pointer = "/contracts";
  }
}

function fail() {
  throw new CliContractRuntimeError();
}

function exactRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    fail();
  }
}

function resolveSchemaPath(contractRoot, schemaPath) {
  if (typeof schemaPath !== "string" || !SAFE_SCHEMA_PATH.test(schemaPath)) fail();
  const resolved = path.resolve(contractRoot, ...schemaPath.split("/"));
  const relative = path.relative(contractRoot, resolved);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)) fail();
  return resolved;
}

function validateManifest(manifest) {
  if (!exactRecord(manifest, [
    "schemaVersion", "contractVersion", "metaSchema", "fixturePurpose",
    "typeOutput", "schemas", "fixtures", "typeExports"
  ]) || manifest.schemaVersion !== 1 || manifest.contractVersion !== "0.1.0" ||
      !Array.isArray(manifest.schemas) || !Array.isArray(manifest.fixtures)) {
    fail();
  }
}

export async function loadCliContractRuntime({ contractRoot } = {}) {
  if (typeof contractRoot !== "string" || !path.isAbsolute(contractRoot) ||
      path.normalize(contractRoot) !== contractRoot) fail();
  const manifest = await readJson(path.join(contractRoot, "schemas", "contracts", "manifest.json"));
  validateManifest(manifest);

  const schemas = await Promise.all(manifest.schemas.map(async (entry) => {
    if (!exactRecord(entry, ["id", "path"]) || typeof entry.id !== "string") fail();
    const schema = await readJson(resolveSchemaPath(contractRoot, entry.path));
    if (schema?.$id !== entry.id) fail();
    return schema;
  }));
  const registry = createSchemaRegistry(schemas);
  for (const schema of schemas) assertSupportedSchema(schema, { registry });

  const schemaIdsByContract = new Map();
  for (const fixture of manifest.fixtures) {
    if (!exactRecord(fixture, ["contractType", "schemaId", "path"]) ||
        typeof fixture.contractType !== "string" || typeof fixture.schemaId !== "string" ||
        schemaIdsByContract.has(fixture.contractType) || !registry.has(fixture.schemaId)) {
      fail();
    }
    schemaIdsByContract.set(fixture.contractType, fixture.schemaId);
  }

  function findings(contractType, value) {
    const schemaId = schemaIdsByContract.get(contractType);
    if (schemaId === undefined) return null;
    const schema = registry.get(schemaId);
    return validateJson(value, schema, { rootSchema: schema, registry });
  }

  return Object.freeze({
    contractVersion: manifest.contractVersion,
    contractTypes: Object.freeze([...schemaIdsByContract.keys()].sort()),
    findings,
    validateCapabilityRegistry(value) {
      return findings("capability-registry", value)?.length === 0;
    },
    validateDeckSpec(value) {
      return findings("deck-spec", value)?.length === 0;
    },
    validateProjectConfig(value) {
      return findings("project-config", value)?.length === 0;
    },
    validateProjectOverlay(value) {
      return findings("project-overlay", value)?.length === 0;
    },
    validateQaReport(value) {
      return findings("qa-report", value)?.length === 0;
    },
    validateTemplateProfile(value) {
      return findings("template-profile", value)?.length === 0;
    },
    validateTemplateIndex(value) {
      return findings("template-index", value)?.length === 0;
    }
  });
}
