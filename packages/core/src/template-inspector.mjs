import path from "node:path";

export const TEMPLATE_INSPECTOR_VERSION = "0.1.0";
export const TEMPLATE_PACKAGE_VIEW_VERSION = "0.1.0";

const PROJECT_CONTEXT_VERSION = "0.1.0";
const PROJECT_CONTEXT_TYPE = "project-context";
const TEMPLATE_INDEX_TYPE = "template-index";
const PACKAGE_VIEW_TYPE = "template-package-view";
const REVIEWED_PRODUCER_CLASS = "reviewed-fixture-producer";
const SECURE_PRODUCER_CLASS = "secure-ooxml-ingestion";
const ALLOWED_PRODUCER_CLASSES = new Set([REVIEWED_PRODUCER_CLASS, SECURE_PRODUCER_CLASS]);

const SAFE_RELATIVE_PATH = /^(?!.*(?:^|\/)\.{1,2}(?:\/|$))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/u;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const RELATIONSHIP_ID = /^[A-Za-z_][A-Za-z0-9_.-]*$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

const CONTENT_TYPES = Object.freeze({
  potx: "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
  presProps: "application/vnd.openxmlformats-officedocument.presentationml.presProps+xml",
  slideLayout: "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml",
  slideMaster: "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml",
  slide: "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
  theme: "application/vnd.openxmlformats-officedocument.theme+xml"
});

const RELATIONSHIP_BASE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
const RELATIONSHIP_TYPES = Object.freeze({
  officeDocument: `${RELATIONSHIP_BASE}officeDocument`,
  presProps: `${RELATIONSHIP_BASE}presProps`,
  slide: `${RELATIONSHIP_BASE}slide`,
  slideLayout: `${RELATIONSHIP_BASE}slideLayout`,
  slideMaster: `${RELATIONSHIP_BASE}slideMaster`,
  theme: `${RELATIONSHIP_BASE}theme`
});

const ALLOWED_CONTENT_TYPES = new Set(Object.values(CONTENT_TYPES));
const ALLOWED_RELATIONSHIP_TYPES = new Set(Object.values(RELATIONSHIP_TYPES));
const INDEXABLE_SHAPE_KINDS = new Set(["auto-shape", "placeholder", "text-box"]);
const BASE_FEATURE_IDS = Object.freeze([
  "content-types-and-relationships",
  "masters-layouts-themes",
  "package-container"
]);
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
  ARGUMENT_INVALID: "TEMPLATE_INSPECTION_ARGUMENT_INVALID",
  CONTEXT_INVALID: "TEMPLATE_INSPECTION_CONTEXT_INVALID",
  DEPENDENCY_INVALID: "TEMPLATE_INSPECTION_DEPENDENCY_INVALID",
  GRAPH_INVALID: "TEMPLATE_INSPECTION_GRAPH_INVALID",
  OUTPUT_INVALID: "TEMPLATE_INSPECTION_OUTPUT_INVALID",
  SOURCE_MISMATCH: "TEMPLATE_INSPECTION_SOURCE_MISMATCH",
  UNHANDLED_FEATURE: "TEMPLATE_INSPECTION_UNHANDLED_FEATURE",
  VIEW_INVALID: "TEMPLATE_INSPECTION_VIEW_INVALID"
});

export class TemplateInspectionError extends Error {
  constructor(code, pointer = "") {
    super(pointer.length === 0 ? code : `${code} at ${pointer}`);
    this.name = "TemplateInspectionError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer = "") {
  throw new TemplateInspectionError(code, pointer);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertDataRecord(value, requiredKeys, optionalKeys, pointer, code) {
  if (!isPlainRecord(value)) fail(code, pointer);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  let enumerableOwnCount = 0;
  for (const key in value) {
    if (!Object.hasOwn(value, key) || !allowed.has(key)) fail(code, pointer);
    enumerableOwnCount += 1;
    if (enumerableOwnCount > allowed.size) fail(code, pointer);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string" || !allowed.has(key))) {
    fail(code, pointer);
  }
  for (const key of requiredKeys) {
    if (!ownKeys.includes(key)) fail(code, pointer);
  }
  for (const key of ownKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail(code, `${pointer}/${key}`);
    }
  }
}

function assertExactDataRecord(value, keys, pointer, code) {
  assertDataRecord(value, keys, [], pointer, code);
  if (Reflect.ownKeys(value).length !== keys.length) fail(code, pointer);
}

function dataProperty(value, key) {
  return Object.getOwnPropertyDescriptor(value, key).value;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function assertFrozen(value, pointer) {
  if (!Object.isFrozen(value)) fail(ERROR_CODES.CONTEXT_INVALID, pointer);
}

function assertSemanticId(value, pointer, code = ERROR_CODES.VIEW_INVALID) {
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) {
    fail(code, pointer);
  }
  return value;
}

function assertCanonicalPartPath(value, pointer) {
  if (typeof value !== "string" || value.length > 512 || value !== value.normalize("NFC") ||
      !SAFE_RELATIVE_PATH.test(value) || path.posix.normalize(value) !== value) {
    fail(ERROR_CODES.VIEW_INVALID, pointer);
  }
  return value;
}

function assertSourceId(value, pointer) {
  if (!Number.isInteger(value) || value < 1 || value > 4294967295) {
    fail(ERROR_CODES.VIEW_INVALID, pointer);
  }
  return value;
}

function assertArray(value, min, max, pointer) {
  if (!Array.isArray(value)) {
    fail(ERROR_CODES.VIEW_INVALID, pointer);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  const length = lengthDescriptor?.value;
  if (!lengthDescriptor || !("value" in lengthDescriptor) || !Number.isSafeInteger(length) ||
      length < min || length > max) {
    fail(ERROR_CODES.VIEW_INVALID, pointer);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== length + 1 || ownKeys.some((key) => {
    if (key === "length") return false;
    if (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key)) return true;
    const index = Number(key);
    return !Number.isSafeInteger(index) || index < 0 || index >= length;
  })) {
    fail(ERROR_CODES.VIEW_INVALID, pointer);
  }
  const snapshot = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail(ERROR_CODES.VIEW_INVALID, `${pointer}/${index}`);
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function assertRelationshipId(value, pointer) {
  if (typeof value !== "string" || value.length > 128 || !RELATIONSHIP_ID.test(value)) {
    fail(ERROR_CODES.VIEW_INVALID, pointer);
  }
  return value;
}

function assertSortedUniqueSemanticIds(value, pointer) {
  const ids = assertArray(value, 0, 256, pointer);
  const seen = new Set();
  let previous = null;
  for (let index = 0; index < ids.length; index += 1) {
    const id = assertSemanticId(ids[index], `${pointer}/${index}`);
    if (seen.has(id) || (previous !== null && compareText(previous, id) >= 0)) {
      fail(ERROR_CODES.VIEW_INVALID, pointer);
    }
    seen.add(id);
    previous = id;
  }
  return ids;
}

function validateDependencies(value) {
  assertExactDataRecord(
    value,
    ["validateTemplateIndex"],
    "/dependencies",
    ERROR_CODES.DEPENDENCY_INVALID
  );
  const validateTemplateIndex = dataProperty(value, "validateTemplateIndex");
  if (typeof validateTemplateIndex !== "function") {
    fail(ERROR_CODES.DEPENDENCY_INVALID, "/dependencies/validateTemplateIndex");
  }
  return validateTemplateIndex;
}

function validateProjectContext(value) {
  assertExactDataRecord(
    value,
    ["contextVersion", "contextType", "projectRoot", "projectConfig", "locations", "dependencies"],
    "/context",
    ERROR_CODES.CONTEXT_INVALID
  );
  assertFrozen(value, "/context");
  if (dataProperty(value, "contextVersion") !== PROJECT_CONTEXT_VERSION ||
      dataProperty(value, "contextType") !== PROJECT_CONTEXT_TYPE) {
    fail(ERROR_CODES.CONTEXT_INVALID, "/context");
  }

  const projectRoot = dataProperty(value, "projectRoot");
  if (typeof projectRoot !== "string" || !path.isAbsolute(projectRoot) ||
      path.normalize(projectRoot) !== projectRoot || /[\u0000-\u001f\u007f]/u.test(projectRoot)) {
    fail(ERROR_CODES.CONTEXT_INVALID, "/context/projectRoot");
  }

  const projectConfig = dataProperty(value, "projectConfig");
  assertDataRecord(
    projectConfig,
    ["schemaVersion", "contractType", "template"],
    ["projectId", "capabilityRegistry", "projectOverlay", "paths", "policies"],
    "/context/projectConfig",
    ERROR_CODES.CONTEXT_INVALID
  );
  assertFrozen(projectConfig, "/context/projectConfig");
  if (dataProperty(projectConfig, "schemaVersion") !== PROJECT_CONTEXT_VERSION ||
      dataProperty(projectConfig, "contractType") !== "project-config") {
    fail(ERROR_CODES.CONTEXT_INVALID, "/context/projectConfig");
  }
  const template = dataProperty(projectConfig, "template");
  assertExactDataRecord(
    template,
    ["sourcePath", "profileId", "profilePath", "indexId", "indexPath"],
    "/context/projectConfig/template",
    ERROR_CODES.CONTEXT_INVALID
  );
  assertFrozen(template, "/context/projectConfig/template");
  const sourcePath = dataProperty(template, "sourcePath");
  if (typeof sourcePath !== "string" || sourcePath.length > 512 || !SAFE_RELATIVE_PATH.test(sourcePath)) {
    fail(ERROR_CODES.CONTEXT_INVALID, "/context/projectConfig/template/sourcePath");
  }
  const templateProfileId = assertSemanticId(
    dataProperty(template, "profileId"),
    "/context/projectConfig/template/profileId",
    ERROR_CODES.CONTEXT_INVALID
  );
  const templateIndexId = assertSemanticId(
    dataProperty(template, "indexId"),
    "/context/projectConfig/template/indexId",
    ERROR_CODES.CONTEXT_INVALID
  );

  const locations = dataProperty(value, "locations");
  assertExactDataRecord(
    locations,
    LOCATION_FIELDS,
    "/context/locations",
    ERROR_CODES.CONTEXT_INVALID
  );
  assertFrozen(locations, "/context/locations");
  const templateSource = dataProperty(locations, "templateSource");
  const expectedSource = path.normalize(path.resolve(projectRoot, ...sourcePath.split("/")));
  if (typeof templateSource !== "string" || templateSource !== expectedSource) {
    fail(ERROR_CODES.CONTEXT_INVALID, "/context/locations/templateSource");
  }

  const contextDependencies = dataProperty(value, "dependencies");
  assertExactDataRecord(
    contextDependencies,
    ["validateProjectConfig"],
    "/context/dependencies",
    ERROR_CODES.CONTEXT_INVALID
  );
  assertFrozen(contextDependencies, "/context/dependencies");
  if (typeof dataProperty(contextDependencies, "validateProjectConfig") !== "function") {
    fail(ERROR_CODES.CONTEXT_INVALID, "/context/dependencies/validateProjectConfig");
  }

  return { templateIndexId, templateProfileId, templateSource };
}

function validateContentParts(partsValue) {
  const parts = assertArray(partsValue, 6, 4096, "/packageView/contentParts");
  const byPath = new Map();
  const foldedPaths = new Set();
  const byContentType = new Map();
  for (let index = 0; index < parts.length; index += 1) {
    const pointer = `/packageView/contentParts/${index}`;
    const part = parts[index];
    assertExactDataRecord(part, ["partPath", "contentType"], pointer, ERROR_CODES.VIEW_INVALID);
    const partPath = assertCanonicalPartPath(dataProperty(part, "partPath"), `${pointer}/partPath`);
    const folded = partPath.toLowerCase();
    if (byPath.has(partPath) || foldedPaths.has(folded)) {
      fail(ERROR_CODES.VIEW_INVALID, "/packageView/contentParts");
    }
    const contentType = dataProperty(part, "contentType");
    if (typeof contentType !== "string" || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      fail(ERROR_CODES.UNHANDLED_FEATURE, `${pointer}/contentType`);
    }
    byPath.set(partPath, { partPath, contentType });
    foldedPaths.add(folded);
    const paths = byContentType.get(contentType) ?? [];
    paths.push(partPath);
    byContentType.set(contentType, paths);
  }
  return { byPath, byContentType };
}

function allowedEdge(ownerContentType, relationshipType, targetContentType) {
  if (ownerContentType === CONTENT_TYPES.potx || ownerContentType === CONTENT_TYPES.pptx) {
    return (relationshipType === RELATIONSHIP_TYPES.slideMaster && targetContentType === CONTENT_TYPES.slideMaster) ||
      (relationshipType === RELATIONSHIP_TYPES.slide && targetContentType === CONTENT_TYPES.slide) ||
      (relationshipType === RELATIONSHIP_TYPES.presProps && targetContentType === CONTENT_TYPES.presProps) ||
      (relationshipType === RELATIONSHIP_TYPES.theme && targetContentType === CONTENT_TYPES.theme);
  }
  if (ownerContentType === CONTENT_TYPES.slideMaster) {
    return (relationshipType === RELATIONSHIP_TYPES.slideLayout && targetContentType === CONTENT_TYPES.slideLayout) ||
      (relationshipType === RELATIONSHIP_TYPES.theme && targetContentType === CONTENT_TYPES.theme);
  }
  if (ownerContentType === CONTENT_TYPES.slideLayout) {
    return relationshipType === RELATIONSHIP_TYPES.slideMaster && targetContentType === CONTENT_TYPES.slideMaster;
  }
  if (ownerContentType === CONTENT_TYPES.slide) {
    return relationshipType === RELATIONSHIP_TYPES.slideLayout && targetContentType === CONTENT_TYPES.slideLayout;
  }
  return false;
}

function validateRelationshipSets(setsValue, partsByPath, presentationContentType) {
  const sets = assertArray(setsValue, 1, 4097, "/packageView/relationshipSets");
  const byOwner = new Map();
  for (let setIndex = 0; setIndex < sets.length; setIndex += 1) {
    const pointer = `/packageView/relationshipSets/${setIndex}`;
    const set = sets[setIndex];
    assertExactDataRecord(set, ["ownerPart", "relationships"], pointer, ERROR_CODES.VIEW_INVALID);
    const rawOwner = dataProperty(set, "ownerPart");
    const ownerPart = rawOwner === null
      ? null
      : assertCanonicalPartPath(rawOwner, `${pointer}/ownerPart`);
    const ownerKey = ownerPart ?? "";
    if (byOwner.has(ownerKey) || (ownerPart !== null && !partsByPath.has(ownerPart))) {
      fail(ERROR_CODES.VIEW_INVALID, `${pointer}/ownerPart`);
    }
    const relationships = assertArray(
      dataProperty(set, "relationships"),
      1,
      8192,
      `${pointer}/relationships`
    );
    const byId = new Map();
    const edgeKeys = new Set();
    for (let relationshipIndex = 0; relationshipIndex < relationships.length; relationshipIndex += 1) {
      const relationshipPointer = `${pointer}/relationships/${relationshipIndex}`;
      const relationship = relationships[relationshipIndex];
      assertExactDataRecord(
        relationship,
        ["relationshipId", "relationshipType", "targetPart"],
        relationshipPointer,
        ERROR_CODES.VIEW_INVALID
      );
      const relationshipId = assertRelationshipId(
        dataProperty(relationship, "relationshipId"),
        `${relationshipPointer}/relationshipId`
      );
      if (byId.has(relationshipId)) {
        fail(ERROR_CODES.VIEW_INVALID, `${pointer}/relationships`);
      }
      const relationshipType = dataProperty(relationship, "relationshipType");
      if (typeof relationshipType !== "string" || !ALLOWED_RELATIONSHIP_TYPES.has(relationshipType)) {
        fail(ERROR_CODES.UNHANDLED_FEATURE, `${relationshipPointer}/relationshipType`);
      }
      const targetPart = assertCanonicalPartPath(
        dataProperty(relationship, "targetPart"),
        `${relationshipPointer}/targetPart`
      );
      const target = partsByPath.get(targetPart);
      if (!target) fail(ERROR_CODES.GRAPH_INVALID, `${relationshipPointer}/targetPart`);
      const edgeKey = `${relationshipType}\u0000${targetPart}`;
      if (edgeKeys.has(edgeKey)) fail(ERROR_CODES.GRAPH_INVALID, `${pointer}/relationships`);
      edgeKeys.add(edgeKey);

      if (ownerPart === null) {
        if (relationshipType !== RELATIONSHIP_TYPES.officeDocument ||
            target.contentType !== presentationContentType) {
          fail(ERROR_CODES.GRAPH_INVALID, relationshipPointer);
        }
      } else {
        const owner = partsByPath.get(ownerPart);
        if (!allowedEdge(owner.contentType, relationshipType, target.contentType)) {
          fail(ERROR_CODES.GRAPH_INVALID, relationshipPointer);
        }
      }
      byId.set(relationshipId, { relationshipId, relationshipType, targetPart });
    }
    byOwner.set(ownerKey, { ownerPart, relationships: [...byId.values()], byId });
  }
  const root = byOwner.get("");
  if (!root || root.relationships.length !== 1) {
    fail(ERROR_CODES.GRAPH_INVALID, "/packageView/relationshipSets");
  }
  return byOwner;
}

function validateGeometry(value, pointer) {
  assertExactDataRecord(value, ["x", "y", "cx", "cy"], pointer, ERROR_CODES.VIEW_INVALID);
  const geometry = {};
  for (const name of ["x", "y"]) {
    const coordinate = dataProperty(value, name);
    if (!Number.isInteger(coordinate) || coordinate < 0 || coordinate > 2147483647) {
      fail(ERROR_CODES.VIEW_INVALID, `${pointer}/${name}`);
    }
    geometry[name] = coordinate;
  }
  for (const name of ["cx", "cy"]) {
    const extent = dataProperty(value, name);
    if (!Number.isInteger(extent) || extent < 1 || extent > 2147483647) {
      fail(ERROR_CODES.VIEW_INVALID, `${pointer}/${name}`);
    }
    geometry[name] = extent;
  }
  return geometry;
}

function validateSlideSize(value, pointer) {
  assertExactDataRecord(value, ["cx", "cy"], pointer, ERROR_CODES.VIEW_INVALID);
  const slideSize = {};
  for (const name of ["cx", "cy"]) {
    const extent = dataProperty(value, name);
    if (!Number.isInteger(extent) || extent < 1 || extent > 2147483647) {
      fail(ERROR_CODES.VIEW_INVALID, `${pointer}/${name}`);
    }
    slideSize[name] = extent;
  }
  return slideSize;
}

function validateShapes(value, pointer) {
  const shapes = assertArray(value, 0, 8192, pointer);
  const normalized = [];
  const sourceIds = new Set();
  const placeholders = new Set();
  for (let index = 0; index < shapes.length; index += 1) {
    const shapePointer = `${pointer}/${index}`;
    const shape = shapes[index];
    assertDataRecord(
      shape,
      ["sourceId", "kind", "geometry"],
      ["placeholder"],
      shapePointer,
      ERROR_CODES.VIEW_INVALID
    );
    const sourceId = assertSourceId(dataProperty(shape, "sourceId"), `${shapePointer}/sourceId`);
    if (sourceIds.has(sourceId)) fail(ERROR_CODES.GRAPH_INVALID, pointer);
    sourceIds.add(sourceId);
    const kind = dataProperty(shape, "kind");
    if (typeof kind !== "string" || !INDEXABLE_SHAPE_KINDS.has(kind)) {
      fail(ERROR_CODES.UNHANDLED_FEATURE, `${shapePointer}/kind`);
    }
    const geometry = validateGeometry(dataProperty(shape, "geometry"), `${shapePointer}/geometry`);
    const hasPlaceholder = Object.hasOwn(shape, "placeholder");
    if ((kind === "placeholder") !== hasPlaceholder) {
      fail(ERROR_CODES.VIEW_INVALID, shapePointer);
    }
    const normalizedShape = { sourceId, kind, geometry };
    if (hasPlaceholder) {
      const placeholder = dataProperty(shape, "placeholder");
      assertExactDataRecord(
        placeholder,
        ["type", "index"],
        `${shapePointer}/placeholder`,
        ERROR_CODES.VIEW_INVALID
      );
      const type = assertSemanticId(
        dataProperty(placeholder, "type"),
        `${shapePointer}/placeholder/type`
      );
      const placeholderIndex = dataProperty(placeholder, "index");
      if (!Number.isInteger(placeholderIndex) || placeholderIndex < 0 || placeholderIndex > 65535) {
        fail(ERROR_CODES.VIEW_INVALID, `${shapePointer}/placeholder/index`);
      }
      const placeholderKey = `${type}\u0000${placeholderIndex}`;
      if (placeholders.has(placeholderKey)) fail(ERROR_CODES.GRAPH_INVALID, pointer);
      placeholders.add(placeholderKey);
      normalizedShape.placeholder = { type, index: placeholderIndex };
    }
    normalized.push(normalizedShape);
  }
  return normalized;
}

function validateReferenceList(value, pointer, maxItems) {
  const references = assertArray(value, 1, maxItems, pointer);
  const normalized = [];
  const sourceIds = new Set();
  const relationshipIds = new Set();
  for (let index = 0; index < references.length; index += 1) {
    const referencePointer = `${pointer}/${index}`;
    const reference = references[index];
    assertExactDataRecord(
      reference,
      ["sourceId", "relationshipId"],
      referencePointer,
      ERROR_CODES.VIEW_INVALID
    );
    const sourceId = assertSourceId(dataProperty(reference, "sourceId"), `${referencePointer}/sourceId`);
    const relationshipId = assertRelationshipId(
      dataProperty(reference, "relationshipId"),
      `${referencePointer}/relationshipId`
    );
    if (sourceIds.has(sourceId) || relationshipIds.has(relationshipId)) {
      fail(ERROR_CODES.GRAPH_INVALID, pointer);
    }
    sourceIds.add(sourceId);
    relationshipIds.add(relationshipId);
    normalized.push({ sourceId, relationshipId });
  }
  return normalized;
}

function relationshipFor(ownerSet, relationshipId, relationshipType, pointer) {
  const relationship = ownerSet?.byId.get(relationshipId);
  if (!relationship || relationship.relationshipType !== relationshipType) {
    fail(ERROR_CODES.GRAPH_INVALID, pointer);
  }
  return relationship;
}

function requireExactRelationshipCoverage(ownerSet, consumedIds, requiredSingletonTypes, pointer) {
  const singletonTargets = new Map();
  for (const relationship of ownerSet.relationships) {
    if (consumedIds.has(relationship.relationshipId)) continue;
    if (!requiredSingletonTypes.has(relationship.relationshipType) ||
        singletonTargets.has(relationship.relationshipType)) {
      fail(ERROR_CODES.GRAPH_INVALID, pointer);
    }
    singletonTargets.set(relationship.relationshipType, relationship.targetPart);
  }
  if (singletonTargets.size !== requiredSingletonTypes.size) {
    fail(ERROR_CODES.GRAPH_INVALID, pointer);
  }
  return singletonTargets;
}

function assertModelInventory(modelMap, expectedPaths, contentTypePaths, pointer) {
  if (modelMap.size !== expectedPaths.size || modelMap.size !== contentTypePaths.length) {
    fail(ERROR_CODES.GRAPH_INVALID, pointer);
  }
  for (const partPath of expectedPaths) {
    if (!modelMap.has(partPath)) fail(ERROR_CODES.GRAPH_INVALID, pointer);
  }
  for (const partPath of contentTypePaths) {
    if (!expectedPaths.has(partPath)) fail(ERROR_CODES.GRAPH_INVALID, pointer);
  }
}

function validatePackageGraph(view) {
  const templateFormat = dataProperty(view, "templateFormat");
  if (templateFormat !== "potx" && templateFormat !== "pptx") {
    fail(ERROR_CODES.VIEW_INVALID, "/packageView/templateFormat");
  }
  const presentationContentType = CONTENT_TYPES[templateFormat];
  const { byPath: partsByPath, byContentType } = validateContentParts(dataProperty(view, "contentParts"));
  const presentationParts = byContentType.get(presentationContentType) ?? [];
  const otherPresentationParts = byContentType.get(CONTENT_TYPES[templateFormat === "potx" ? "pptx" : "potx"]) ?? [];
  if (presentationParts.length !== 1 || otherPresentationParts.length !== 0) {
    fail(ERROR_CODES.GRAPH_INVALID, "/packageView/contentParts");
  }
  for (const contentType of [
    CONTENT_TYPES.presProps,
    CONTENT_TYPES.theme
  ]) {
    if ((byContentType.get(contentType) ?? []).length !== 1) {
      fail(ERROR_CODES.GRAPH_INVALID, "/packageView/contentParts");
    }
  }

  const relationshipSets = validateRelationshipSets(
    dataProperty(view, "relationshipSets"),
    partsByPath,
    presentationContentType
  );
  const rootTarget = relationshipSets.get("").relationships[0].targetPart;

  const presentationValue = dataProperty(view, "presentation");
  assertExactDataRecord(
    presentationValue,
    ["partPath", "slideSizeEmu", "masterReferences", "slideReferences"],
    "/packageView/presentation",
    ERROR_CODES.VIEW_INVALID
  );
  const presentationPart = assertCanonicalPartPath(
    dataProperty(presentationValue, "partPath"),
    "/packageView/presentation/partPath"
  );
  if (presentationPart !== rootTarget || presentationPart !== presentationParts[0]) {
    fail(ERROR_CODES.GRAPH_INVALID, "/packageView/presentation/partPath");
  }
  const slideSizeEmu = validateSlideSize(
    dataProperty(presentationValue, "slideSizeEmu"),
    "/packageView/presentation/slideSizeEmu"
  );
  const masterReferences = validateReferenceList(
    dataProperty(presentationValue, "masterReferences"),
    "/packageView/presentation/masterReferences",
    256
  );
  const slideReferences = validateReferenceList(
    dataProperty(presentationValue, "slideReferences"),
    "/packageView/presentation/slideReferences",
    4096
  );

  const presentationRelationships = relationshipSets.get(presentationPart);
  if (!presentationRelationships) {
    fail(ERROR_CODES.GRAPH_INVALID, "/packageView/relationshipSets");
  }
  const consumedPresentationRelationships = new Set();
  const orderedMasterTargets = [];
  for (let index = 0; index < masterReferences.length; index += 1) {
    const reference = masterReferences[index];
    const relationship = relationshipFor(
      presentationRelationships,
      reference.relationshipId,
      RELATIONSHIP_TYPES.slideMaster,
      `/packageView/presentation/masterReferences/${index}/relationshipId`
    );
    if (orderedMasterTargets.includes(relationship.targetPart)) {
      fail(ERROR_CODES.GRAPH_INVALID, "/packageView/presentation/masterReferences");
    }
    orderedMasterTargets.push(relationship.targetPart);
    consumedPresentationRelationships.add(reference.relationshipId);
  }
  const orderedSlideTargets = [];
  for (let index = 0; index < slideReferences.length; index += 1) {
    const reference = slideReferences[index];
    const relationship = relationshipFor(
      presentationRelationships,
      reference.relationshipId,
      RELATIONSHIP_TYPES.slide,
      `/packageView/presentation/slideReferences/${index}/relationshipId`
    );
    if (orderedSlideTargets.includes(relationship.targetPart)) {
      fail(ERROR_CODES.GRAPH_INVALID, "/packageView/presentation/slideReferences");
    }
    orderedSlideTargets.push(relationship.targetPart);
    consumedPresentationRelationships.add(reference.relationshipId);
  }
  const presentationSingletons = requireExactRelationshipCoverage(
    presentationRelationships,
    consumedPresentationRelationships,
    new Set([RELATIONSHIP_TYPES.presProps, RELATIONSHIP_TYPES.theme]),
    "/packageView/relationshipSets"
  );

  const mastersValue = assertArray(dataProperty(view, "masters"), 1, 256, "/packageView/masters");
  const masterModels = new Map();
  for (let index = 0; index < mastersValue.length; index += 1) {
    const pointer = `/packageView/masters/${index}`;
    const model = mastersValue[index];
    assertExactDataRecord(model, ["partPath", "layoutReferences"], pointer, ERROR_CODES.VIEW_INVALID);
    const partPath = assertCanonicalPartPath(dataProperty(model, "partPath"), `${pointer}/partPath`);
    if (masterModels.has(partPath) || partsByPath.get(partPath)?.contentType !== CONTENT_TYPES.slideMaster) {
      fail(ERROR_CODES.GRAPH_INVALID, `${pointer}/partPath`);
    }
    masterModels.set(partPath, {
      partPath,
      layoutReferences: validateReferenceList(
        dataProperty(model, "layoutReferences"),
        `${pointer}/layoutReferences`,
        2048
      )
    });
  }

  const layoutsValue = assertArray(dataProperty(view, "layouts"), 1, 2048, "/packageView/layouts");
  const layoutModels = new Map();
  for (let index = 0; index < layoutsValue.length; index += 1) {
    const pointer = `/packageView/layouts/${index}`;
    const model = layoutsValue[index];
    assertExactDataRecord(model, ["partPath", "shapes"], pointer, ERROR_CODES.VIEW_INVALID);
    const partPath = assertCanonicalPartPath(dataProperty(model, "partPath"), `${pointer}/partPath`);
    if (layoutModels.has(partPath) || partsByPath.get(partPath)?.contentType !== CONTENT_TYPES.slideLayout) {
      fail(ERROR_CODES.GRAPH_INVALID, `${pointer}/partPath`);
    }
    layoutModels.set(partPath, {
      partPath,
      shapes: validateShapes(dataProperty(model, "shapes"), `${pointer}/shapes`)
    });
  }

  const slidesValue = assertArray(dataProperty(view, "slides"), 1, 4096, "/packageView/slides");
  const slideModels = new Map();
  for (let index = 0; index < slidesValue.length; index += 1) {
    const pointer = `/packageView/slides/${index}`;
    const model = slidesValue[index];
    assertExactDataRecord(model, ["partPath", "shapes"], pointer, ERROR_CODES.VIEW_INVALID);
    const partPath = assertCanonicalPartPath(dataProperty(model, "partPath"), `${pointer}/partPath`);
    if (slideModels.has(partPath) || partsByPath.get(partPath)?.contentType !== CONTENT_TYPES.slide) {
      fail(ERROR_CODES.GRAPH_INVALID, `${pointer}/partPath`);
    }
    slideModels.set(partPath, {
      partPath,
      shapes: validateShapes(dataProperty(model, "shapes"), `${pointer}/shapes`)
    });
  }

  assertModelInventory(
    masterModels,
    new Set(orderedMasterTargets),
    byContentType.get(CONTENT_TYPES.slideMaster) ?? [],
    "/packageView/masters"
  );
  assertModelInventory(
    slideModels,
    new Set(orderedSlideTargets),
    byContentType.get(CONTENT_TYPES.slide) ?? [],
    "/packageView/slides"
  );

  const orderedLayoutRecords = [];
  const layoutTargets = new Set();
  const layoutSourceIds = new Set();
  for (let masterIndex = 0; masterIndex < orderedMasterTargets.length; masterIndex += 1) {
    const masterPart = orderedMasterTargets[masterIndex];
    const masterModel = masterModels.get(masterPart);
    const masterRelationships = relationshipSets.get(masterPart);
    if (!masterRelationships) fail(ERROR_CODES.GRAPH_INVALID, "/packageView/relationshipSets");
    const consumedMasterRelationships = new Set();
    for (let layoutIndex = 0; layoutIndex < masterModel.layoutReferences.length; layoutIndex += 1) {
      const reference = masterModel.layoutReferences[layoutIndex];
      const relationship = relationshipFor(
        masterRelationships,
        reference.relationshipId,
        RELATIONSHIP_TYPES.slideLayout,
        "/packageView/masters"
      );
      if (layoutTargets.has(relationship.targetPart)) {
        fail(ERROR_CODES.GRAPH_INVALID, "/packageView/masters");
      }
      if (layoutSourceIds.has(reference.sourceId)) {
        fail(ERROR_CODES.GRAPH_INVALID, "/packageView/masters");
      }
      layoutTargets.add(relationship.targetPart);
      layoutSourceIds.add(reference.sourceId);
      consumedMasterRelationships.add(reference.relationshipId);
      orderedLayoutRecords.push({
        masterIndex,
        sourceId: reference.sourceId,
        partPath: relationship.targetPart
      });
    }
    const masterSingletons = requireExactRelationshipCoverage(
      masterRelationships,
      consumedMasterRelationships,
      new Set([RELATIONSHIP_TYPES.theme]),
      "/packageView/relationshipSets"
    );
    if (masterSingletons.get(RELATIONSHIP_TYPES.theme) !==
        presentationSingletons.get(RELATIONSHIP_TYPES.theme)) {
      fail(ERROR_CODES.GRAPH_INVALID, "/packageView/relationshipSets");
    }
  }
  assertModelInventory(
    layoutModels,
    layoutTargets,
    byContentType.get(CONTENT_TYPES.slideLayout) ?? [],
    "/packageView/layouts"
  );

  for (const layoutRecord of orderedLayoutRecords) {
    const relationships = relationshipSets.get(layoutRecord.partPath);
    const masterPart = orderedMasterTargets[layoutRecord.masterIndex];
    if (!relationships || relationships.relationships.length !== 1 ||
        relationships.relationships[0].relationshipType !== RELATIONSHIP_TYPES.slideMaster ||
        relationships.relationships[0].targetPart !== masterPart) {
      fail(ERROR_CODES.GRAPH_INVALID, "/packageView/relationshipSets");
    }
  }

  const slideLayoutTargets = [];
  for (const slidePart of orderedSlideTargets) {
    const relationships = relationshipSets.get(slidePart);
    if (!relationships || relationships.relationships.length !== 1 ||
        relationships.relationships[0].relationshipType !== RELATIONSHIP_TYPES.slideLayout ||
        !layoutTargets.has(relationships.relationships[0].targetPart)) {
      fail(ERROR_CODES.GRAPH_INVALID, "/packageView/relationshipSets");
    }
    slideLayoutTargets.push(relationships.relationships[0].targetPart);
  }

  const expectedRelationshipOwners = new Set([
    "",
    presentationPart,
    ...orderedMasterTargets,
    ...orderedLayoutRecords.map((entry) => entry.partPath),
    ...orderedSlideTargets
  ]);
  if (relationshipSets.size !== expectedRelationshipOwners.size ||
      [...relationshipSets.keys()].some((owner) => !expectedRelationshipOwners.has(owner))) {
    fail(ERROR_CODES.GRAPH_INVALID, "/packageView/relationshipSets");
  }

  const modeledParts = new Set([
    presentationPart,
    presentationSingletons.get(RELATIONSHIP_TYPES.presProps),
    presentationSingletons.get(RELATIONSHIP_TYPES.theme),
    ...orderedMasterTargets,
    ...orderedLayoutRecords.map((entry) => entry.partPath),
    ...orderedSlideTargets
  ]);
  if (modeledParts.size !== partsByPath.size || [...partsByPath.keys()].some((partPath) => !modeledParts.has(partPath))) {
    fail(ERROR_CODES.UNHANDLED_FEATURE, "/packageView/contentParts");
  }

  return {
    templateFormat,
    presentationPart,
    slideSizeEmu,
    masterReferences,
    orderedMasterTargets,
    orderedLayoutRecords,
    layoutModels,
    slideReferences,
    orderedSlideTargets,
    slideLayoutTargets,
    slideModels
  };
}

function normalizedShape(shape, index) {
  const output = {
    shapeKey: `shape-${index + 1}`,
    sourceId: shape.sourceId,
    kind: shape.kind,
    geometry: { ...shape.geometry }
  };
  if (shape.placeholder) output.placeholder = { ...shape.placeholder };
  return output;
}

function buildTemplateIndex(contextValues, graph) {
  const masterKeys = graph.orderedMasterTargets.map((_, index) => `master-${index + 1}`);
  const layoutKeysByPart = new Map(
    graph.orderedLayoutRecords.map((record, index) => [record.partPath, `layout-${index + 1}`])
  );
  return {
    schemaVersion: TEMPLATE_INSPECTOR_VERSION,
    contractType: TEMPLATE_INDEX_TYPE,
    templateIndexId: contextValues.templateIndexId,
    templateProfileId: contextValues.templateProfileId,
    templateFormat: graph.templateFormat,
    templateSha256: graph.archiveSha256,
    presentationPart: graph.presentationPart,
    slideSizeEmu: { ...graph.slideSizeEmu },
    observedFeatureIds: [...graph.observedFeatureIds],
    masters: graph.masterReferences.map((reference, index) => ({
      masterKey: masterKeys[index],
      sourceId: reference.sourceId,
      partPath: graph.orderedMasterTargets[index]
    })),
    layouts: graph.orderedLayoutRecords.map((record, index) => ({
      layoutKey: `layout-${index + 1}`,
      sourceId: record.sourceId,
      partPath: record.partPath,
      masterKey: masterKeys[record.masterIndex],
      shapes: graph.layoutModels.get(record.partPath).shapes.map(normalizedShape)
    })),
    slides: graph.slideReferences.map((reference, index) => ({
      slideKey: `slide-${index + 1}`,
      sourceId: reference.sourceId,
      partPath: graph.orderedSlideTargets[index],
      layoutKey: layoutKeysByPart.get(graph.slideLayoutTargets[index]),
      shapes: graph.slideModels.get(graph.orderedSlideTargets[index]).shapes.map(normalizedShape)
    }))
  };
}

function validateFeatureFacts(view, graph) {
  const unhandledFeatureIds = assertSortedUniqueSemanticIds(
    dataProperty(view, "unhandledFeatureIds"),
    "/packageView/unhandledFeatureIds"
  );
  if (unhandledFeatureIds.length !== 0) {
    fail(ERROR_CODES.UNHANDLED_FEATURE, "/packageView/unhandledFeatureIds");
  }
  const observedFeatureIds = assertSortedUniqueSemanticIds(
    dataProperty(view, "observedFeatureIds"),
    "/packageView/observedFeatureIds"
  );
  const allShapes = [
    ...[...graph.layoutModels.values()].flatMap((layout) => layout.shapes),
    ...[...graph.slideModels.values()].flatMap((slide) => slide.shapes)
  ];
  const expected = [...BASE_FEATURE_IDS];
  if (allShapes.length > 0) expected.push("drawingml-shapes");
  if (allShapes.some((shape) => shape.kind === "text-box")) expected.push("slide-text");
  expected.sort(compareText);
  if (JSON.stringify(observedFeatureIds) !== JSON.stringify(expected)) {
    fail(ERROR_CODES.GRAPH_INVALID, "/packageView/observedFeatureIds");
  }
  return observedFeatureIds;
}

/**
 * Normalize an explicit, already parsed template-package view into a frozen
 * TemplateIndex. This API performs no filesystem, archive, or XML I/O. The
 * Producer labels are structural metadata, not security credentials. The
 * reviewed-fixture and secure-ingestion classes are admitted here, but only the
 * separate one-step ingestion API proves its filesystem/ZIP/XML origin chain.
 */
export function inspectTemplate(options) {
  assertExactDataRecord(
    options,
    ["context", "packageView", "dependencies"],
    "",
    ERROR_CODES.ARGUMENT_INVALID
  );
  const contextValues = validateProjectContext(dataProperty(options, "context"));
  const validateTemplateIndex = validateDependencies(dataProperty(options, "dependencies"));

  const view = dataProperty(options, "packageView");
  assertExactDataRecord(
    view,
    [
      "viewVersion",
      "viewType",
      "producerClass",
      "sourceLocation",
      "templateFormat",
      "archiveSha256",
      "contentParts",
      "relationshipSets",
      "presentation",
      "masters",
      "layouts",
      "slides",
      "observedFeatureIds",
      "unhandledFeatureIds"
    ],
    "/packageView",
    ERROR_CODES.VIEW_INVALID
  );
  if (dataProperty(view, "viewVersion") !== TEMPLATE_PACKAGE_VIEW_VERSION ||
      dataProperty(view, "viewType") !== PACKAGE_VIEW_TYPE ||
      !ALLOWED_PRODUCER_CLASSES.has(dataProperty(view, "producerClass"))) {
    fail(ERROR_CODES.VIEW_INVALID, "/packageView");
  }
  const sourceLocation = dataProperty(view, "sourceLocation");
  if (typeof sourceLocation !== "string" || sourceLocation !== contextValues.templateSource) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/packageView/sourceLocation");
  }
  const archiveSha256 = dataProperty(view, "archiveSha256");
  if (typeof archiveSha256 !== "string" || !SHA256.test(archiveSha256)) {
    fail(ERROR_CODES.VIEW_INVALID, "/packageView/archiveSha256");
  }
  const templateFormat = dataProperty(view, "templateFormat");
  if (templateFormat !== "potx" && templateFormat !== "pptx") {
    fail(ERROR_CODES.VIEW_INVALID, "/packageView/templateFormat");
  }
  if (path.extname(contextValues.templateSource).toLowerCase() !== `.${templateFormat}`) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/packageView/templateFormat");
  }

  const graph = validatePackageGraph(view);
  graph.archiveSha256 = archiveSha256;
  graph.observedFeatureIds = validateFeatureFacts(view, graph);
  const output = deepFreeze(buildTemplateIndex(contextValues, graph));
  let validationResult;
  try {
    validationResult = validateTemplateIndex(output);
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, "/templateIndex");
  }
  if (validationResult !== true) fail(ERROR_CODES.OUTPUT_INVALID, "/templateIndex");
  return output;
}
