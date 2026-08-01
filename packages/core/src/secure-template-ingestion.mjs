import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

import { buildSecureTemplatePackageView, SecureOoxmlError } from "./ooxml-package-view.mjs";
import { SECURE_ZIP_LIMITS, SecureZipError } from "./secure-zip.mjs";
import { StrictXmlError } from "./strict-xml.mjs";
import { inspectTemplate, TemplateInspectionError } from "./template-inspector.mjs";

export const SECURE_TEMPLATE_INGESTION_VERSION = "0.1.0";

const PROJECT_CONTEXT_VERSION = "0.1.0";
const SAFE_RELATIVE_PATH = /^(?!.*(?:^|\/)\.{1,2}(?:\/|$))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/u;
const LOCATION_FIELDS = Object.freeze([
  "templateSource",
  "templateProfile",
  "templateIndex",
  "capabilityRegistry",
  "projectOverlay",
  "assetRoot",
  "stagingRoot",
  "outputRoot"
]);

const ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "TEMPLATE_INGESTION_ARGUMENT_INVALID",
  ARCHIVE_REJECTED: "TEMPLATE_INGESTION_ARCHIVE_REJECTED",
  CONTEXT_INVALID: "TEMPLATE_INGESTION_CONTEXT_INVALID",
  DEPENDENCY_INVALID: "TEMPLATE_INGESTION_DEPENDENCY_INVALID",
  EXTERNAL_RELATIONSHIP: "TEMPLATE_INGESTION_EXTERNAL_RELATIONSHIP",
  GRAPH_REJECTED: "TEMPLATE_INGESTION_GRAPH_REJECTED",
  HIGH_RISK_CONTENT: "TEMPLATE_INGESTION_HIGH_RISK_CONTENT",
  OOXML_REJECTED: "TEMPLATE_INGESTION_OOXML_REJECTED",
  RESOURCE_LIMIT: "TEMPLATE_INGESTION_RESOURCE_LIMIT",
  SOURCE_ESCAPE: "TEMPLATE_INGESTION_SOURCE_ESCAPE",
  SOURCE_NOT_REGULAR: "TEMPLATE_INGESTION_SOURCE_NOT_REGULAR",
  SOURCE_SYMLINK: "TEMPLATE_INGESTION_SOURCE_SYMLINK",
  SOURCE_UNAVAILABLE: "TEMPLATE_INGESTION_SOURCE_UNAVAILABLE",
  SOURCE_UNSTABLE: "TEMPLATE_INGESTION_SOURCE_UNSTABLE",
  XML_REJECTED: "TEMPLATE_INGESTION_XML_REJECTED"
});

export class TemplateIngestionError extends Error {
  constructor(code, pointer = "") {
    super(pointer.length === 0 ? code : `${code} at ${pointer}`);
    this.name = "TemplateIngestionError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer = "") {
  throw new TemplateIngestionError(code, pointer);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactDataRecord(value, keys, pointer, code) {
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

function assertDataRecord(value, requiredKeys, optionalKeys, pointer, code) {
  if (!isPlainRecord(value)) fail(code, pointer);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string" || !allowed.has(key)) ||
      requiredKeys.some((key) => !ownKeys.includes(key))) {
    fail(code, pointer);
  }
  for (const key of ownKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail(code, `${pointer}/${key}`);
    }
  }
}

function dataProperty(value, key) {
  return Object.getOwnPropertyDescriptor(value, key).value;
}

function contextSource(context) {
  assertExactDataRecord(context, [
    "contextVersion", "contextType", "projectRoot", "projectConfig", "locations", "dependencies"
  ], "/context", ERROR_CODES.CONTEXT_INVALID);
  if (!Object.isFrozen(context) || dataProperty(context, "contextVersion") !== PROJECT_CONTEXT_VERSION ||
      dataProperty(context, "contextType") !== "project-context") {
    fail(ERROR_CODES.CONTEXT_INVALID, "/context");
  }
  const projectRoot = dataProperty(context, "projectRoot");
  if (typeof projectRoot !== "string" || !path.isAbsolute(projectRoot) ||
      path.normalize(projectRoot) !== projectRoot || /[\u0000-\u001f\u007f]/u.test(projectRoot)) {
    fail(ERROR_CODES.CONTEXT_INVALID, "/context/projectRoot");
  }

  const projectConfig = dataProperty(context, "projectConfig");
  assertDataRecord(
    projectConfig,
    ["schemaVersion", "contractType", "template"],
    ["projectId", "capabilityRegistry", "projectOverlay", "paths", "policies"],
    "/context/projectConfig",
    ERROR_CODES.CONTEXT_INVALID
  );
  if (!Object.isFrozen(projectConfig) ||
      dataProperty(projectConfig, "schemaVersion") !== PROJECT_CONTEXT_VERSION ||
      dataProperty(projectConfig, "contractType") !== "project-config") {
    fail(ERROR_CODES.CONTEXT_INVALID, "/context/projectConfig");
  }
  const templateDescriptor = Object.getOwnPropertyDescriptor(projectConfig, "template");
  if (!templateDescriptor || !templateDescriptor.enumerable || !("value" in templateDescriptor)) {
    fail(ERROR_CODES.CONTEXT_INVALID, "/context/projectConfig/template");
  }
  const template = templateDescriptor.value;
  assertExactDataRecord(template, [
    "sourcePath", "profileId", "profilePath", "indexId", "indexPath"
  ], "/context/projectConfig/template", ERROR_CODES.CONTEXT_INVALID);
  if (!Object.isFrozen(template)) fail(ERROR_CODES.CONTEXT_INVALID, "/context/projectConfig/template");
  const sourcePath = dataProperty(template, "sourcePath");
  if (typeof sourcePath !== "string" || sourcePath.length > 512 ||
      !SAFE_RELATIVE_PATH.test(sourcePath) || !/[.](?:pptx|potx)$/iu.test(sourcePath)) {
    fail(ERROR_CODES.CONTEXT_INVALID, "/context/projectConfig/template/sourcePath");
  }

  const locations = dataProperty(context, "locations");
  assertExactDataRecord(locations, LOCATION_FIELDS, "/context/locations", ERROR_CODES.CONTEXT_INVALID);
  if (!Object.isFrozen(locations)) fail(ERROR_CODES.CONTEXT_INVALID, "/context/locations");
  const sourceLocation = dataProperty(locations, "templateSource");
  const expectedLocation = path.normalize(path.resolve(projectRoot, ...sourcePath.split("/")));
  if (sourceLocation !== expectedLocation) {
    fail(ERROR_CODES.CONTEXT_INVALID, "/context/locations/templateSource");
  }
  const contextDependencies = dataProperty(context, "dependencies");
  assertExactDataRecord(
    contextDependencies,
    ["validateProjectConfig"],
    "/context/dependencies",
    ERROR_CODES.CONTEXT_INVALID
  );
  if (!Object.isFrozen(contextDependencies) ||
      typeof dataProperty(contextDependencies, "validateProjectConfig") !== "function") {
    fail(ERROR_CODES.CONTEXT_INVALID, "/context/dependencies");
  }
  return { projectRoot, sourceLocation, sourcePath };
}

function validateOptions(options) {
  assertExactDataRecord(
    options,
    ["context", "dependencies"],
    "",
    ERROR_CODES.ARGUMENT_INVALID
  );
  const dependencies = dataProperty(options, "dependencies");
  assertExactDataRecord(
    dependencies,
    ["validateTemplateIndex"],
    "/dependencies",
    ERROR_CODES.DEPENDENCY_INVALID
  );
  if (typeof dataProperty(dependencies, "validateTemplateIndex") !== "function") {
    fail(ERROR_CODES.DEPENDENCY_INVALID, "/dependencies/validateTemplateIndex");
  }
  return {
    context: dataProperty(options, "context"),
    dependencies,
    ...contextSource(dataProperty(options, "context"))
  };
}

function identity(stat) {
  return Object.freeze({
    dev: stat.dev,
    ino: stat.ino,
    size: stat.size,
    mtimeNs: stat.mtimeNs,
    ctimeNs: stat.ctimeNs
  });
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

async function safeLstat(location) {
  try {
    return await lstat(location, { bigint: true });
  } catch {
    fail(ERROR_CODES.SOURCE_UNAVAILABLE, "/source");
  }
}

async function inspectSourceChain(projectRoot, sourcePath) {
  const rootStat = await safeLstat(projectRoot);
  if (rootStat.isSymbolicLink()) fail(ERROR_CODES.SOURCE_SYMLINK, "/source");
  if (!rootStat.isDirectory()) fail(ERROR_CODES.SOURCE_NOT_REGULAR, "/source");
  const chain = [identity(rootStat)];
  const segments = sourcePath.split("/");
  let current = projectRoot;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    const stat = await safeLstat(current);
    if (stat.isSymbolicLink()) fail(ERROR_CODES.SOURCE_SYMLINK, "/source");
    const final = index === segments.length - 1;
    if ((!final && !stat.isDirectory()) || (final && !stat.isFile())) {
      fail(ERROR_CODES.SOURCE_NOT_REGULAR, "/source");
    }
    chain.push(identity(stat));
  }
  return chain;
}

async function canonicalLocations(projectRoot, sourceLocation, sourcePath) {
  let canonicalRoot;
  let canonicalSource;
  try {
    canonicalRoot = await realpath(projectRoot);
    canonicalSource = await realpath(sourceLocation);
  } catch {
    fail(ERROR_CODES.SOURCE_UNAVAILABLE, "/source");
  }
  const expected = path.join(canonicalRoot, ...sourcePath.split("/"));
  const relative = path.relative(canonicalRoot, canonicalSource);
  if (canonicalSource !== expected || relative === "" || relative === ".." ||
      relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(ERROR_CODES.SOURCE_ESCAPE, "/source");
  }
  return { canonicalRoot, canonicalSource };
}

async function readStableArchive({ projectRoot, sourceLocation, sourcePath }) {
  const beforeChain = await inspectSourceChain(projectRoot, sourcePath);
  const beforeCanonical = await canonicalLocations(projectRoot, sourceLocation, sourcePath);
  let handle;
  try {
    const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
    try {
      handle = await open(sourceLocation, flags);
    } catch (error) {
      if (error?.code === "ELOOP") fail(ERROR_CODES.SOURCE_SYMLINK, "/source");
      fail(ERROR_CODES.SOURCE_UNAVAILABLE, "/source");
    }
    const beforeStat = await handle.stat({ bigint: true });
    if (!beforeStat.isFile()) fail(ERROR_CODES.SOURCE_NOT_REGULAR, "/source");
    if (!sameIdentity(identity(beforeStat), beforeChain.at(-1))) {
      fail(ERROR_CODES.SOURCE_UNSTABLE, "/source");
    }
    if (beforeStat.size < 1n || beforeStat.size > BigInt(SECURE_ZIP_LIMITS.maxArchiveBytes)) {
      fail(ERROR_CODES.RESOURCE_LIMIT, "/source");
    }
    const size = Number(beforeStat.size);
    const bytes = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
      const result = await handle.read(bytes, offset, size - offset, offset);
      if (result.bytesRead < 1) fail(ERROR_CODES.SOURCE_UNSTABLE, "/source");
      offset += result.bytesRead;
    }
    const extra = Buffer.alloc(1);
    const extraRead = await handle.read(extra, 0, 1, size);
    if (extraRead.bytesRead !== 0) fail(ERROR_CODES.SOURCE_UNSTABLE, "/source");
    const afterStat = await handle.stat({ bigint: true });
    if (!sameIdentity(identity(beforeStat), identity(afterStat))) {
      fail(ERROR_CODES.SOURCE_UNSTABLE, "/source");
    }
    const afterChain = await inspectSourceChain(projectRoot, sourcePath);
    if (afterChain.length !== beforeChain.length ||
        afterChain.some((entry, index) => !sameIdentity(entry, beforeChain[index]))) {
      fail(ERROR_CODES.SOURCE_UNSTABLE, "/source");
    }
    const afterCanonical = await canonicalLocations(projectRoot, sourceLocation, sourcePath);
    if (afterCanonical.canonicalRoot !== beforeCanonical.canonicalRoot ||
        afterCanonical.canonicalSource !== beforeCanonical.canonicalSource) {
      fail(ERROR_CODES.SOURCE_UNSTABLE, "/source");
    }
    return bytes;
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // The byte snapshot is already detached; close failure does not expose path data.
      }
    }
  }
}

function mapBoundaryError(error) {
  if (error instanceof TemplateIngestionError) throw error;
  if (error instanceof SecureZipError) fail(
    error.code === "ZIP_RESOURCE_LIMIT" ? ERROR_CODES.RESOURCE_LIMIT : ERROR_CODES.ARCHIVE_REJECTED,
    "/archive"
  );
  if (error instanceof StrictXmlError) fail(
    error.code === "XML_RESOURCE_LIMIT" ? ERROR_CODES.RESOURCE_LIMIT : ERROR_CODES.XML_REJECTED,
    "/xml"
  );
  if (error instanceof SecureOoxmlError) {
    if (error.code === "OOXML_RESOURCE_LIMIT") fail(ERROR_CODES.RESOURCE_LIMIT, "/package");
    if (error.code === "OOXML_HIGH_RISK_CONTENT") fail(ERROR_CODES.HIGH_RISK_CONTENT, "/package");
    if (error.code === "OOXML_EXTERNAL_RELATIONSHIP") {
      fail(ERROR_CODES.EXTERNAL_RELATIONSHIP, "/package/relationships");
    }
    fail(ERROR_CODES.OOXML_REJECTED, "/package");
  }
  if (error instanceof TemplateInspectionError) fail(ERROR_CODES.GRAPH_REJECTED, "/package");
  fail(ERROR_CODES.OOXML_REJECTED, "/package");
}

/**
 * Read the configured source through a bounded stable handle, validate a narrow
 * ZIP/XML/OPC profile, and return the semantic inspector's frozen TemplateIndex.
 * Callers cannot supply a path, package view, parser, network resolver, or
 * relaxed resource limits.
 */
export async function inspectTemplateSource(options) {
  let validated;
  try {
    validated = validateOptions(options);
    const archiveBytes = await readStableArchive(validated);
    const packageView = buildSecureTemplatePackageView({
      sourceLocation: validated.sourceLocation,
      archiveBytes
    });
    return inspectTemplate({
      context: validated.context,
      packageView,
      dependencies: validated.dependencies
    });
  } catch (error) {
    mapBoundaryError(error);
  }
}
