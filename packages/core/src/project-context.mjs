import path from "node:path";

export const PROJECT_CONTEXT_VERSION = "0.1.0";

const PROJECT_CONTEXT_TYPE = "project-context";
const PROJECT_CONFIG_TYPE = "project-config";
const SAFE_RELATIVE_PATH = /^(?!.*(?:^|\/)\.{1,2}(?:\/|$))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/u;

const LOCATION_FIELDS = Object.freeze([
  ["templateSource", ["template", "sourcePath"], "/template/sourcePath"],
  ["templateProfile", ["template", "profilePath"], "/template/profilePath"],
  ["templateIndex", ["template", "indexPath"], "/template/indexPath"],
  ["capabilityRegistry", ["capabilityRegistry", "path"], "/capabilityRegistry/path"],
  ["projectOverlay", ["projectOverlay", "path"], "/projectOverlay/path"],
  ["assetRoot", ["paths", "assetRoot"], "/paths/assetRoot"],
  ["stagingRoot", ["paths", "stagingRoot"], "/paths/stagingRoot"],
  ["outputRoot", ["paths", "outputRoot"], "/paths/outputRoot"]
]);

const ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "PROJECT_CONTEXT_ARGUMENT_INVALID",
  CONFIG_INVALID: "PROJECT_CONTEXT_CONFIG_INVALID",
  DEPENDENCY_INVALID: "PROJECT_CONTEXT_DEPENDENCY_INVALID",
  PATH_ALIAS: "PROJECT_CONTEXT_PATH_ALIAS",
  PATH_ESCAPE: "PROJECT_CONTEXT_PATH_ESCAPE",
  PATH_INVALID: "PROJECT_CONTEXT_PATH_INVALID",
  ROOT_INVALID: "PROJECT_CONTEXT_ROOT_INVALID",
  WRITE_TARGET_CONFLICT: "PROJECT_CONTEXT_WRITE_TARGET_CONFLICT"
});

export class ProjectContextError extends Error {
  constructor(code, pointer = "") {
    super(pointer.length === 0 ? code : `${code} at ${pointer}`);
    this.name = "ProjectContextError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer) {
  throw new ProjectContextError(code, pointer);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactDataRecord(value, allowedKeys, pointer, errorCode) {
  if (!isPlainRecord(value)) fail(errorCode, pointer);
  const allowed = new Set(allowedKeys);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowed.has(key)) || keys.length !== allowed.size) {
    fail(errorCode, pointer);
  }
  for (const key of allowedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail(errorCode, `${pointer}/${key}`);
    }
  }
}

function cloneJsonValue(value, seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-json-number");
    return value;
  }
  if (typeof value !== "object" || seen.has(value)) throw new TypeError("non-json-value");

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const ownKeys = Reflect.ownKeys(value);
      const expectedKeys = new Set(["length", ...Array.from({ length: value.length }, (_, index) => String(index))]);
      if (ownKeys.some((key) => typeof key !== "string" || !expectedKeys.has(key)) ||
          ownKeys.length !== expectedKeys.size) {
        throw new TypeError("non-json-array");
      }
      const clone = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
          throw new TypeError("non-json-array");
        }
        clone.push(cloneJsonValue(descriptor.value, seen));
      }
      return clone;
    }

    if (!isPlainRecord(value)) throw new TypeError("non-json-object");
    const clone = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new TypeError("non-json-object");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
        throw new TypeError("non-json-object");
      }
      Object.defineProperty(clone, key, {
        configurable: true,
        enumerable: true,
        value: cloneJsonValue(descriptor.value, seen),
        writable: true
      });
    }
    return clone;
  } finally {
    seen.delete(value);
  }
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function validateDependencies(dependencies) {
  assertExactDataRecord(
    dependencies,
    ["validateProjectConfig"],
    "/dependencies",
    ERROR_CODES.DEPENDENCY_INVALID
  );
  if (typeof dependencies.validateProjectConfig !== "function") {
    fail(ERROR_CODES.DEPENDENCY_INVALID, "/dependencies/validateProjectConfig");
  }
  return Object.freeze({ validateProjectConfig: dependencies.validateProjectConfig });
}

function snapshotAndValidateConfig(projectConfig, validateProjectConfig) {
  let snapshot;
  try {
    snapshot = deepFreeze(cloneJsonValue(projectConfig));
  } catch {
    fail(ERROR_CODES.CONFIG_INVALID, "/projectConfig");
  }

  let validationResult;
  try {
    validationResult = validateProjectConfig(snapshot);
  } catch {
    fail(ERROR_CODES.CONFIG_INVALID, "/projectConfig");
  }
  if (validationResult !== true || snapshot.schemaVersion !== PROJECT_CONTEXT_VERSION ||
      snapshot.contractType !== PROJECT_CONFIG_TYPE) {
    fail(ERROR_CODES.CONFIG_INVALID, "/projectConfig");
  }
  return snapshot;
}

function normalizeProjectRoot(projectRoot) {
  if (typeof projectRoot !== "string" || projectRoot.length === 0 || /[\u0000-\u001f\u007f]/u.test(projectRoot)) {
    fail(ERROR_CODES.ROOT_INVALID, "/projectRoot");
  }
  if (!path.isAbsolute(projectRoot)) fail(ERROR_CODES.ROOT_INVALID, "/projectRoot");

  let normalized;
  try {
    normalized = path.normalize(path.resolve(projectRoot));
  } catch {
    fail(ERROR_CODES.ROOT_INVALID, "/projectRoot");
  }
  if (!path.isAbsolute(normalized) || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    fail(ERROR_CODES.ROOT_INVALID, "/projectRoot");
  }
  return normalized;
}

function readConfiguredPath(config, keys, pointer) {
  let value = config;
  for (const key of keys) {
    if (!isPlainRecord(value) || !Object.hasOwn(value, key)) {
      fail(ERROR_CODES.CONFIG_INVALID, "/projectConfig");
    }
    value = value[key];
  }
  if (typeof value !== "string" || value.length > 512 || !SAFE_RELATIVE_PATH.test(value)) {
    fail(ERROR_CODES.PATH_INVALID, pointer);
  }
  return value;
}

function resolveContained(projectRoot, relativePath, pointer) {
  let resolved;
  let relative;
  try {
    resolved = path.normalize(path.resolve(projectRoot, ...relativePath.split("/")));
    relative = path.relative(projectRoot, resolved);
  } catch {
    fail(ERROR_CODES.PATH_INVALID, pointer);
  }
  if (relative.length === 0 || path.isAbsolute(relative) || relative === ".." ||
      relative.startsWith(`..${path.sep}`)) {
    fail(ERROR_CODES.PATH_ESCAPE, pointer);
  }
  return resolved;
}

function foldedPath(relativePath) {
  return relativePath.toLowerCase();
}

function sameOrInside(candidate, root) {
  return candidate === root || candidate.startsWith(`${root}/`);
}

function assertProjectPathSemantics(relativeLocations) {
  const inputDocuments = [
    relativeLocations.templateSource,
    relativeLocations.templateProfile,
    relativeLocations.templateIndex,
    relativeLocations.capabilityRegistry,
    relativeLocations.projectOverlay
  ].map(foldedPath);
  if (new Set(inputDocuments).size !== inputDocuments.length) {
    fail(ERROR_CODES.PATH_ALIAS, "/projectConfig");
  }

  const roots = [
    foldedPath(relativeLocations.assetRoot),
    foldedPath(relativeLocations.stagingRoot),
    foldedPath(relativeLocations.outputRoot)
  ];
  for (let left = 0; left < roots.length; left += 1) {
    for (let right = left + 1; right < roots.length; right += 1) {
      if (sameOrInside(roots[left], roots[right]) || sameOrInside(roots[right], roots[left])) {
        fail(ERROR_CODES.PATH_ALIAS, "/paths");
      }
    }
  }

  const source = foldedPath(relativeLocations.templateSource);
  if (sameOrInside(source, roots[1]) || sameOrInside(source, roots[2])) {
    fail(ERROR_CODES.WRITE_TARGET_CONFLICT, "/template/sourcePath");
  }
}

/**
 * Construct an immutable runtime context from an explicit project root and a
 * schema-validated ProjectConfig. This function performs lexical path modeling
 * only; returned locations are not filesystem or time-of-use safety claims.
 */
export function createProjectContext(options) {
  assertExactDataRecord(
    options,
    ["projectRoot", "projectConfig", "dependencies"],
    "",
    ERROR_CODES.ARGUMENT_INVALID
  );

  const dependencies = validateDependencies(options.dependencies);
  const projectConfig = snapshotAndValidateConfig(
    options.projectConfig,
    dependencies.validateProjectConfig
  );
  const projectRoot = normalizeProjectRoot(options.projectRoot);

  const relativeLocations = {};
  const locations = {};
  for (const [name, keys, pointer] of LOCATION_FIELDS) {
    const relativePath = readConfiguredPath(projectConfig, keys, pointer);
    relativeLocations[name] = relativePath;
    locations[name] = resolveContained(projectRoot, relativePath, pointer);
  }
  assertProjectPathSemantics(relativeLocations);

  return Object.freeze({
    contextVersion: PROJECT_CONTEXT_VERSION,
    contextType: PROJECT_CONTEXT_TYPE,
    projectRoot,
    projectConfig,
    locations: deepFreeze(locations),
    dependencies
  });
}
