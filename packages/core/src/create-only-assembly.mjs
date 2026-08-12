import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";

import { createDeterministicZip } from "./deterministic-zip.mjs";
import { buildSecureTemplatePackageView } from "./ooxml-package-view.mjs";
import { parseSecureZip, SECURE_ZIP_LIMITS } from "./secure-zip.mjs";
import { parseStrictXml } from "./strict-xml.mjs";

export const CREATE_ONLY_ASSEMBLY_VERSION = "0.1.0";

const NS = Object.freeze({
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  contentTypes: "http://schemas.openxmlformats.org/package/2006/content-types",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  xml: "http://www.w3.org/XML/1998/namespace"
});
const PRESENTATION_CONTENT_TYPES = Object.freeze({
  potx: "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"
});
const XML_DECLARATION = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
const MAX_JSON_NODES = 10_000;
const MAX_TEXT_BYTES = 8 * 1024;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const encoder = new TextEncoder();
const authenticAssemblyReports = new WeakMap();
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength"
).get;

const ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "ASSEMBLY_ARGUMENT_INVALID",
  COLLATERAL_CHANGE: "ASSEMBLY_COLLATERAL_CHANGE",
  OUTPUT_EXISTS: "ASSEMBLY_OUTPUT_EXISTS",
  OUTPUT_INVALID: "ASSEMBLY_OUTPUT_INVALID",
  OUTPUT_WRITE_FAILED: "ASSEMBLY_OUTPUT_WRITE_FAILED",
  PLAN_UNSUPPORTED: "ASSEMBLY_PLAN_UNSUPPORTED",
  SOURCE_MISMATCH: "ASSEMBLY_SOURCE_MISMATCH",
  TARGET_INVALID: "ASSEMBLY_TARGET_INVALID"
});

export class CreateOnlyAssemblyError extends Error {
  constructor(code, pointer = "") {
    super(pointer.length === 0 ? code : `${code} at ${pointer}`);
    this.name = "CreateOnlyAssemblyError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer = "") {
  throw new CreateOnlyAssemblyError(code, pointer);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function snapshotFrozenJson(value, pointer, state = { nodes: 0 }) {
  state.nodes += 1;
  if (state.nodes > MAX_JSON_NODES) fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
    return value;
  }
  if (typeof value !== "object" || !Object.isFrozen(value)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  if (Array.isArray(value)) {
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => key !== "length" &&
        (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key))) ||
        keys.filter((key) => key !== "length").length !== value.length) {
      fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
    }
    return Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
        fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/${index}`);
      }
      return snapshotFrozenJson(descriptor.value, `${pointer}/${index}`, state);
    });
  }
  if (!isPlainRecord(value)) fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  const output = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
      fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/${key}`);
    }
    output[key] = snapshotFrozenJson(descriptor.value, `${pointer}/${key}`, state);
  }
  return output;
}

function exactKeys(value, keys, pointer, code = ERROR_CODES.PLAN_UNSUPPORTED) {
  if (!isPlainRecord(value) || Object.keys(value).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(value, key))) {
    fail(code, pointer);
  }
}

function safeText(value) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value ||
      !/\S/u.test(value) || /\p{Cf}/u.test(value) ||
      encoder.encode(value).byteLength > MAX_TEXT_BYTES) {
    return false;
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f) ||
        codePoint === 0x2028 || codePoint === 0x2029 ||
        (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
        (codePoint & 0xfffe) === 0xfffe) {
      return false;
    }
  }
  return true;
}

function validatePlan(candidate) {
  const plan = snapshotFrozenJson(candidate, "/plan");
  exactKeys(plan, ["planVersion", "planType", "outputSlideId", "clone", "fills"], "/plan");
  if (plan.planVersion !== "0.1.0" || plan.planType !== "source-slide-clone-fill-plan" ||
      typeof plan.outputSlideId !== "string") {
    fail(ERROR_CODES.PLAN_UNSUPPORTED, "/plan");
  }
  exactKeys(plan.clone, ["operationId", "operationType", "sourceContainerKind", "sourceSlideKey"], "/plan/clone");
  if (plan.clone.operationId !== "clone-source-slide" ||
      plan.clone.operationType !== "clone-slide" ||
      plan.clone.sourceContainerKind !== "slide" ||
      typeof plan.clone.sourceSlideKey !== "string" ||
      !Array.isArray(plan.fills) || plan.fills.length !== 2) {
    fail(ERROR_CODES.PLAN_UNSUPPORTED, "/plan");
  }
  const roles = ["body", "title"];
  for (let index = 0; index < plan.fills.length; index += 1) {
    const fill = plan.fills[index];
    exactKeys(fill, [
      "operationId", "operationType", "role", "shapeBindingId",
      "sourceShapeKey", "expectedKind", "paragraphs"
    ], `/plan/fills/${index}`);
    if (fill.operationId !== `fill-${roles[index]}` ||
        fill.operationType !== "replace-cloned-shape-text" ||
        fill.role !== roles[index] || fill.expectedKind !== "text-box" ||
        typeof fill.shapeBindingId !== "string" || typeof fill.sourceShapeKey !== "string" ||
        !Array.isArray(fill.paragraphs) || fill.paragraphs.length !== 1 ||
        !safeText(fill.paragraphs[0])) {
      fail(ERROR_CODES.PLAN_UNSUPPORTED, `/plan/fills/${index}`);
    }
  }
  if (plan.fills[0].sourceShapeKey === plan.fills[1].sourceShapeKey) {
    fail(ERROR_CODES.PLAN_UNSUPPORTED, "/plan/fills");
  }
  return plan;
}

function cloneXmlNode(node) {
  return {
    namespaceURI: node.namespaceURI,
    localName: node.localName,
    key: node.key,
    attributes: new Map([...node.attributes].map(([key, attribute]) => [key, { ...attribute }])),
    children: node.children.map(cloneXmlNode),
    text: node.text
  };
}

function elementName(node, defaultNamespace) {
  if (node.namespaceURI === defaultNamespace) return node.localName;
  for (const prefix of ["a", "p", "r", "xml"]) {
    if (node.namespaceURI === NS[prefix]) return `${prefix}:${node.localName}`;
  }
  fail(ERROR_CODES.TARGET_INVALID, "/xml/namespace");
}

function attributeName(attribute) {
  if (attribute.namespaceURI === "") return attribute.localName;
  for (const prefix of ["r", "xml"]) {
    if (attribute.namespaceURI === NS[prefix]) return `${prefix}:${attribute.localName}`;
  }
  fail(ERROR_CODES.TARGET_INVALID, "/xml/attributeNamespace");
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeXml(value).replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function serializeNode(node, defaultNamespace, root = false) {
  const name = elementName(node, defaultNamespace);
  const declarations = root
    ? (defaultNamespace === NS.contentTypes
        ? ` xmlns="${NS.contentTypes}"`
        : ` xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"`)
    : "";
  const attributes = [...node.attributes.values()]
    .map((attribute) => ` ${attributeName(attribute)}="${escapeAttribute(attribute.value)}"`)
    .join("");
  if (node.children.length === 0 && node.text.length === 0) {
    return `<${name}${declarations}${attributes}/>`;
  }
  return `<${name}${declarations}${attributes}>${escapeXml(node.text)}` +
    `${node.children.map((child) => serializeNode(child, defaultNamespace)).join("")}</${name}>`;
}

function serializeDocument(root) {
  const defaultNamespace = root.namespaceURI === NS.contentTypes ? NS.contentTypes : "";
  return Buffer.from(`${XML_DECLARATION}${serializeNode(root, defaultNamespace, true)}\n`, "utf8");
}

function descendants(node, namespaceURI, localName, output = []) {
  if (node.namespaceURI === namespaceURI && node.localName === localName) output.push(node);
  for (const child of node.children) descendants(child, namespaceURI, localName, output);
  return output;
}

function attribute(node, namespaceURI, localName) {
  return node.attributes.get(`${namespaceURI}\u0000${localName}`);
}

function shapeBySourceId(root, sourceId) {
  const matches = descendants(root, NS.p, "sp").filter((shape) => {
    const nonVisual = descendants(shape, NS.p, "cNvPr");
    return nonVisual.length === 1 && attribute(nonVisual[0], "", "id")?.value === String(sourceId);
  });
  if (matches.length !== 1) fail(ERROR_CODES.TARGET_INVALID, "/plan/fills/sourceShapeKey");
  return matches[0];
}

function replaceShapeText(shape, text) {
  const paragraphs = descendants(shape, NS.a, "p");
  const textNodes = descendants(shape, NS.a, "t");
  if (paragraphs.length !== 1 || textNodes.length !== 1 ||
      textNodes[0].attributes.size !== 0 || textNodes[0].children.length !== 0) {
    fail(ERROR_CODES.TARGET_INVALID, "/slide/text");
  }
  textNodes[0].text = text;
}

function maskShapeText(shape) {
  const textNodes = descendants(shape, NS.a, "t");
  if (textNodes.length !== 1) fail(ERROR_CODES.TARGET_INVALID, "/slide/text");
  textNodes[0].text = "@target-text";
}

function rewriteSlide(sourceBytes, sourceIdsByShapeKey, plan) {
  const sourceRoot = parseStrictXml(sourceBytes).root;
  const outputRoot = cloneXmlNode(sourceRoot);
  const maskedSource = cloneXmlNode(sourceRoot);
  for (const fill of plan.fills) {
    const sourceId = sourceIdsByShapeKey.get(fill.sourceShapeKey);
    if (!Number.isSafeInteger(sourceId)) {
      fail(ERROR_CODES.TARGET_INVALID, "/plan/fills/sourceShapeKey");
    }
    replaceShapeText(shapeBySourceId(outputRoot, sourceId), fill.paragraphs[0]);
    maskShapeText(shapeBySourceId(maskedSource, sourceId));
  }
  const maskedOutput = cloneXmlNode(outputRoot);
  for (const fill of plan.fills) {
    maskShapeText(shapeBySourceId(maskedOutput, sourceIdsByShapeKey.get(fill.sourceShapeKey)));
  }
  if (!serializeDocument(maskedSource).equals(serializeDocument(maskedOutput))) {
    fail(ERROR_CODES.COLLATERAL_CHANGE, "/slide");
  }
  return serializeDocument(outputRoot);
}

/**
 * @internal Deterministically convert the admitted POTX main content type to
 * PPTX. Downstream candidate verification reuses this exact transformation so
 * the delivery boundary cannot merely count `[Content_Types].xml` as changed.
 */
export function rewriteTemplateMainContentTypeForPptx(sourceBytes) {
  if (!(sourceBytes instanceof Uint8Array)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/contentTypes");
  }
  const root = cloneXmlNode(parseStrictXml(sourceBytes).root);
  const matches = root.children.filter((node) =>
    node.namespaceURI === NS.contentTypes && node.localName === "Override" &&
    attribute(node, "", "PartName")?.value === "/ppt/presentation.xml");
  if (matches.length !== 1) fail(ERROR_CODES.TARGET_INVALID, "/contentTypes");
  const contentType = attribute(matches[0], "", "ContentType");
  if (contentType?.value !== PRESENTATION_CONTENT_TYPES.potx &&
      contentType?.value !== PRESENTATION_CONTENT_TYPES.pptx) {
    fail(ERROR_CODES.TARGET_INVALID, "/contentTypes");
  }
  contentType.value = PRESENTATION_CONTENT_TYPES.pptx;
  return serializeDocument(root);
}

function exactGeometry(candidate, expected, pointer) {
  exactKeys(candidate, ["cx", "cy", "x", "y"], pointer, ERROR_CODES.SOURCE_MISMATCH);
  if (candidate.x !== expected.x || candidate.y !== expected.y ||
      candidate.cx !== expected.cx || candidate.cy !== expected.cy) {
    fail(ERROR_CODES.SOURCE_MISMATCH, pointer);
  }
}

function exactSlideSize(candidate, expected, pointer) {
  exactKeys(candidate, ["cx", "cy"], pointer, ERROR_CODES.SOURCE_MISMATCH);
  if (candidate.cx !== expected.cx || candidate.cy !== expected.cy) {
    fail(ERROR_CODES.SOURCE_MISMATCH, pointer);
  }
}

function exactIndexedShapes(candidate, expected, pointer) {
  if (!Array.isArray(candidate) || candidate.length !== expected.length) {
    fail(ERROR_CODES.SOURCE_MISMATCH, pointer);
  }
  for (let index = 0; index < expected.length; index += 1) {
    const shapePointer = `${pointer}/${index}`;
    const expectedShape = expected[index];
    const keys = expectedShape.placeholder
      ? ["geometry", "kind", "placeholder", "shapeKey", "sourceId"]
      : ["geometry", "kind", "shapeKey", "sourceId"];
    exactKeys(candidate[index], keys, shapePointer, ERROR_CODES.SOURCE_MISMATCH);
    if (candidate[index].shapeKey !== `shape-${index + 1}` ||
        candidate[index].sourceId !== expectedShape.sourceId ||
        candidate[index].kind !== expectedShape.kind) {
      fail(ERROR_CODES.SOURCE_MISMATCH, shapePointer);
    }
    exactGeometry(candidate[index].geometry, expectedShape.geometry, `${shapePointer}/geometry`);
    if (expectedShape.placeholder) {
      exactKeys(
        candidate[index].placeholder,
        ["index", "type"],
        `${shapePointer}/placeholder`,
        ERROR_CODES.SOURCE_MISMATCH
      );
      if (candidate[index].placeholder.index !== expectedShape.placeholder.index ||
          candidate[index].placeholder.type !== expectedShape.placeholder.type) {
        fail(ERROR_CODES.SOURCE_MISMATCH, `${shapePointer}/placeholder`);
      }
    }
  }
}

function relationshipTarget(sourceView, ownerPart, relationshipId, pointer) {
  const ownerSets = sourceView.relationshipSets.filter((set) => set.ownerPart === ownerPart);
  const matches = ownerSets.length === 1
    ? ownerSets[0].relationships.filter((relationship) =>
      relationship.relationshipId === relationshipId)
    : [];
  if (matches.length !== 1) fail(ERROR_CODES.SOURCE_MISMATCH, pointer);
  return matches[0].targetPart;
}

function sameStringArray(left, right) {
  return Array.isArray(left) && left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

/** @internal Re-derive the complete admitted synthetic template index. */
export function verifyCreateOnlyTemplateIndexAgainstSourceView(
  candidate,
  sourceView,
  sourceSha
) {
  const index = snapshotFrozenJson(candidate, "/templateIndex");
  exactKeys(index, [
    "contractType", "layouts", "masters", "observedFeatureIds", "presentationPart",
    "schemaVersion", "slides", "slideSizeEmu", "templateFormat", "templateIndexId",
    "templateProfileId", "templateSha256"
  ], "/templateIndex", ERROR_CODES.SOURCE_MISMATCH);
  if (index.schemaVersion !== "0.1.0" || index.contractType !== "template-index" ||
      typeof index.templateIndexId !== "string" || !SEMANTIC_ID.test(index.templateIndexId) ||
      typeof index.templateProfileId !== "string" || !SEMANTIC_ID.test(index.templateProfileId) ||
      index.templateSha256 !== sourceSha || sourceView.archiveSha256 !== sourceSha ||
      index.templateFormat !== sourceView.templateFormat ||
      index.presentationPart !== sourceView.presentation.partPath ||
      !sameStringArray(index.observedFeatureIds, sourceView.observedFeatureIds)) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/templateIndex");
  }
  exactSlideSize(index.slideSizeEmu, sourceView.presentation.slideSizeEmu, "/templateIndex/slideSizeEmu");

  if (!Array.isArray(index.masters) || index.masters.length !== 1 ||
      !Array.isArray(index.layouts) || index.layouts.length !== 1 ||
      !Array.isArray(index.slides) || index.slides.length !== 1 ||
      sourceView.presentation.masterReferences.length !== 1 ||
      sourceView.presentation.slideReferences.length !== 1 ||
      sourceView.masters.length !== 1 || sourceView.layouts.length !== 1 ||
      sourceView.slides.length !== 1 || sourceView.masters[0].layoutReferences.length !== 1) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/templateIndex");
  }

  const masterReference = sourceView.presentation.masterReferences[0];
  const masterPart = relationshipTarget(
    sourceView,
    sourceView.presentation.partPath,
    masterReference.relationshipId,
    "/templateIndex/masters/0"
  );
  const master = index.masters[0];
  exactKeys(master, ["masterKey", "partPath", "sourceId"], "/templateIndex/masters/0", ERROR_CODES.SOURCE_MISMATCH);
  if (master.masterKey !== "master-1" || master.sourceId !== masterReference.sourceId ||
      master.partPath !== masterPart || sourceView.masters[0].partPath !== masterPart) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/templateIndex/masters/0");
  }

  const layoutReference = sourceView.masters[0].layoutReferences[0];
  const layoutPart = relationshipTarget(
    sourceView,
    masterPart,
    layoutReference.relationshipId,
    "/templateIndex/layouts/0"
  );
  const layout = index.layouts[0];
  exactKeys(
    layout,
    ["layoutKey", "masterKey", "partPath", "shapes", "sourceId"],
    "/templateIndex/layouts/0",
    ERROR_CODES.SOURCE_MISMATCH
  );
  if (layout.layoutKey !== "layout-1" || layout.masterKey !== "master-1" ||
      layout.sourceId !== layoutReference.sourceId || layout.partPath !== layoutPart ||
      sourceView.layouts[0].partPath !== layoutPart) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/templateIndex/layouts/0");
  }
  exactIndexedShapes(layout.shapes, sourceView.layouts[0].shapes, "/templateIndex/layouts/0/shapes");

  const slideReference = sourceView.presentation.slideReferences[0];
  const slidePart = relationshipTarget(
    sourceView,
    sourceView.presentation.partPath,
    slideReference.relationshipId,
    "/templateIndex/slides/0"
  );
  const slideRelationships = sourceView.relationshipSets.filter((set) => set.ownerPart === slidePart);
  if (slideRelationships.length !== 1 || slideRelationships[0].relationships.length !== 1 ||
      slideRelationships[0].relationships[0].targetPart !== layoutPart) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/templateIndex/slides/0/layoutKey");
  }
  const slide = index.slides[0];
  exactKeys(
    slide,
    ["layoutKey", "partPath", "shapes", "slideKey", "sourceId"],
    "/templateIndex/slides/0",
    ERROR_CODES.SOURCE_MISMATCH
  );
  if (slide.slideKey !== "slide-1" || slide.layoutKey !== "layout-1" ||
      slide.sourceId !== slideReference.sourceId || slide.partPath !== slidePart ||
      sourceView.slides[0].partPath !== slidePart) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/templateIndex/slides/0");
  }
  exactIndexedShapes(slide.shapes, sourceView.slides[0].shapes, "/templateIndex/slides/0/shapes");
  return index;
}

function selectTarget(index, sourceView, plan) {
  const slides = index.slides.filter((slide) => slide.slideKey === plan.clone.sourceSlideKey);
  if (slides.length !== 1 || !Array.isArray(slides[0].shapes)) {
    fail(ERROR_CODES.TARGET_INVALID, "/plan/clone/sourceSlideKey");
  }
  const slide = slides[0];
  const viewSlides = sourceView.slides.filter((candidate) => candidate.partPath === slide.partPath);
  if (viewSlides.length !== 1 || viewSlides[0].shapes.length !== slide.shapes.length) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/templateIndex/slides");
  }
  const sourceIdsByShapeKey = new Map();
  for (const shape of slide.shapes) {
    if (shape.kind !== "text-box" || sourceIdsByShapeKey.has(shape.shapeKey) ||
        !viewSlides[0].shapes.some((candidate) =>
          candidate.sourceId === shape.sourceId && candidate.kind === shape.kind)) {
      fail(ERROR_CODES.SOURCE_MISMATCH, "/templateIndex/slides/shapes");
    }
    sourceIdsByShapeKey.set(shape.shapeKey, shape.sourceId);
  }
  return { slidePart: slide.partPath, sourceIdsByShapeKey };
}

function packageDiff(sourceParts, outputParts, reasons) {
  const sourcePaths = [...sourceParts.keys()].sort();
  const outputPaths = [...outputParts.keys()].sort();
  const addedParts = outputPaths.filter((partPath) => !sourceParts.has(partPath));
  const removedParts = sourcePaths.filter((partPath) => !outputParts.has(partPath));
  const modifiedParts = sourcePaths.filter((partPath) =>
    outputParts.has(partPath) && !Buffer.from(sourceParts.get(partPath)).equals(outputParts.get(partPath)));
  const allowedChanges = modifiedParts
    .filter((partPath) => reasons.has(partPath))
    .map((partPath) => Object.freeze({ partPath, reason: reasons.get(partPath) }));
  const collateralChanges = [
    ...addedParts,
    ...removedParts,
    ...modifiedParts.filter((partPath) => !reasons.has(partPath))
  ].sort();
  return Object.freeze({
    addedParts: Object.freeze(addedParts),
    removedParts: Object.freeze(removedParts),
    modifiedParts: Object.freeze(modifiedParts),
    allowedChanges: Object.freeze(allowedChanges),
    collateralChanges: Object.freeze(collateralChanges)
  });
}

function registerAssemblyArtifact({
  archiveBytes,
  outputSlideId,
  diff,
  capturedIndex,
  targetSlide
}) {
  const report = Object.freeze({
    assemblyVersion: CREATE_ONLY_ASSEMBLY_VERSION,
    artifactType: "assembled-pptx",
    outputSlideId,
    outputBytes: archiveBytes.length,
    outputSha256: sha256(archiveBytes),
    diff
  });
  const publicFacts = Object.freeze({
    outputBytes: report.outputBytes,
    outputSha256: report.outputSha256,
    outputSlideId: report.outputSlideId
  });
  const targetFacts = Object.freeze({
    sourceSlideKey: targetSlide.slideKey,
    slidePart: targetSlide.partPath,
    slideSizeEmu: Object.freeze({ ...capturedIndex.slideSizeEmu }),
    shapes: Object.freeze(targetSlide.shapes.map((shape) => Object.freeze({
      shapeKey: shape.shapeKey,
      sourceId: shape.sourceId,
      kind: shape.kind,
      geometry: Object.freeze({ ...shape.geometry })
    })))
  });
  authenticAssemblyReports.set(report, Object.freeze({ publicFacts, targetFacts }));
  return Object.freeze({ archiveBytes: Buffer.from(archiveBytes), report });
}

/**
 * M2-005A: apply one validated/frozen clone-fill plan to one securely admitted
 * source snapshot. Multi-paragraph, multi-slide, native, and OMML application
 * deliberately fail closed until their typed rebuild slices exist.
 */
export function assembleCloneFillPresentation({ sourceArchiveBytes, templateIndex, plan } = {}) {
  if (!(sourceArchiveBytes instanceof Uint8Array)) fail(ERROR_CODES.ARGUMENT_INVALID, "/sourceArchiveBytes");
  if (sourceArchiveBytes.byteLength < 1 ||
      sourceArchiveBytes.byteLength > SECURE_ZIP_LIMITS.maxArchiveBytes) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/sourceArchiveBytes");
  }
  const sourceSnapshot = Buffer.from(sourceArchiveBytes);
  let sourceView;
  let sourceParts;
  try {
    sourceView = buildSecureTemplatePackageView({
      sourceLocation: path.resolve("/synthetic-source.potx"),
      archiveBytes: sourceSnapshot
    });
    sourceParts = parseSecureZip(sourceSnapshot);
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/sourceArchiveBytes");
  }
  const sourceSha = sha256(sourceSnapshot);
  const capturedPlan = validatePlan(plan);
  const capturedIndex = verifyCreateOnlyTemplateIndexAgainstSourceView(
    templateIndex,
    sourceView,
    sourceSha
  );
  const target = selectTarget(capturedIndex, sourceView, capturedPlan);
  if (!sourceParts.has(target.slidePart)) fail(ERROR_CODES.SOURCE_MISMATCH, "/templateIndex/slides");

  const outputParts = new Map([...sourceParts].map(([partPath, bytes]) => [partPath, Buffer.from(bytes)]));
  outputParts.set(
    target.slidePart,
    rewriteSlide(sourceParts.get(target.slidePart), target.sourceIdsByShapeKey, capturedPlan)
  );
  outputParts.set(
    "[Content_Types].xml",
    rewriteTemplateMainContentTypeForPptx(sourceParts.get("[Content_Types].xml"))
  );

  const reasons = new Map([[target.slidePart, "clone-fill-text"]]);
  if (sourceView.templateFormat === "potx") reasons.set("[Content_Types].xml", "template-to-presentation");
  const diff = packageDiff(sourceParts, outputParts, reasons);
  if (diff.collateralChanges.length !== 0 || diff.addedParts.length !== 0 ||
      diff.removedParts.length !== 0 || !diff.modifiedParts.includes(target.slidePart)) {
    fail(ERROR_CODES.COLLATERAL_CHANGE, "/diff");
  }

  let archiveBytes;
  try {
    archiveBytes = createDeterministicZip(outputParts);
    const outputView = buildSecureTemplatePackageView({
      sourceLocation: path.resolve("/synthetic-output.pptx"),
      archiveBytes
    });
    if (outputView.templateFormat !== "pptx" || outputView.slides.length !== sourceView.slides.length) {
      fail(ERROR_CODES.OUTPUT_INVALID, "/output");
    }
  } catch (error) {
    if (error instanceof CreateOnlyAssemblyError) throw error;
    fail(ERROR_CODES.OUTPUT_INVALID, "/output");
  }

  const targetSlide = capturedIndex.slides.find(
    (slide) => slide.slideKey === capturedPlan.clone.sourceSlideKey
  );
  return registerAssemblyArtifact({
    archiveBytes,
    outputSlideId: capturedPlan.outputSlideId,
    diff,
    capturedIndex,
    targetSlide
  });
}

/**
 * @internal Build the exact source-owned one-slide PPTX base used by typed
 * applicators. This performs only canonical slide serialization and POTX→PPTX
 * conversion; it has no authored text or capability-plan input.
 */
export function assembleSourcePreservingPresentation({
  sourceArchiveBytes,
  templateIndex,
  outputSlideId
} = {}) {
  if (!(sourceArchiveBytes instanceof Uint8Array)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/sourceArchiveBytes");
  }
  if (sourceArchiveBytes.byteLength < 1 ||
      sourceArchiveBytes.byteLength > SECURE_ZIP_LIMITS.maxArchiveBytes) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/sourceArchiveBytes");
  }
  if (typeof outputSlideId !== "string" || outputSlideId.length > 128 ||
      !SEMANTIC_ID.test(outputSlideId)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/outputSlideId");
  }
  const sourceSnapshot = Buffer.from(sourceArchiveBytes);
  let sourceView;
  let sourceParts;
  let capturedIndex;
  try {
    sourceView = buildSecureTemplatePackageView({
      sourceLocation: path.resolve("/source-preserving-base.potx"),
      archiveBytes: sourceSnapshot
    });
    sourceParts = parseSecureZip(sourceSnapshot);
    capturedIndex = verifyCreateOnlyTemplateIndexAgainstSourceView(
      templateIndex,
      sourceView,
      sha256(sourceSnapshot)
    );
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/sourceArchiveBytes");
  }
  if (capturedIndex.slides.length !== 1) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/templateIndex/slides");
  }
  const targetSlide = capturedIndex.slides[0];
  const sourceSlideBytes = sourceParts.get(targetSlide.partPath);
  const contentTypesBytes = sourceParts.get("[Content_Types].xml");
  if (sourceSlideBytes === undefined || contentTypesBytes === undefined) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/sourceArchiveBytes");
  }
  const outputParts = new Map(
    [...sourceParts].map(([partPath, bytes]) => [partPath, Buffer.from(bytes)])
  );
  try {
    outputParts.set(
      targetSlide.partPath,
      serializeDocument(parseStrictXml(sourceSlideBytes).root)
    );
    outputParts.set(
      "[Content_Types].xml",
      rewriteTemplateMainContentTypeForPptx(contentTypesBytes)
    );
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/sourceArchiveBytes");
  }
  const reasons = new Map([
    [targetSlide.partPath, "source-slide-normalization"]
  ]);
  if (sourceView.templateFormat === "potx") {
    reasons.set("[Content_Types].xml", "template-to-presentation");
  }
  const diff = packageDiff(sourceParts, outputParts, reasons);
  if (diff.collateralChanges.length !== 0 || diff.addedParts.length !== 0 ||
      diff.removedParts.length !== 0) {
    fail(ERROR_CODES.COLLATERAL_CHANGE, "/diff");
  }
  let archiveBytes;
  try {
    archiveBytes = createDeterministicZip(outputParts);
    const outputView = buildSecureTemplatePackageView({
      sourceLocation: path.resolve("/source-preserving-base.pptx"),
      archiveBytes
    });
    if (outputView.templateFormat !== "pptx" || outputView.slides.length !== 1) {
      fail(ERROR_CODES.OUTPUT_INVALID, "/output");
    }
  } catch (error) {
    if (error instanceof CreateOnlyAssemblyError) throw error;
    fail(ERROR_CODES.OUTPUT_INVALID, "/output");
  }
  return registerAssemblyArtifact({
    archiveBytes,
    outputSlideId,
    diff,
    capturedIndex,
    targetSlide
  });
}

function authenticateAssemblyArtifact(options) {
  if (!isPlainRecord(options)) fail(ERROR_CODES.ARGUMENT_INVALID, "/artifact");
  const descriptors = Object.getOwnPropertyDescriptors(options);
  if (Reflect.ownKeys(descriptors).length !== 2 ||
      !Object.hasOwn(descriptors, "archiveBytes") || !Object.hasOwn(descriptors, "report") ||
      !("value" in descriptors.archiveBytes) || !("value" in descriptors.report) ||
      descriptors.archiveBytes.enumerable !== true || descriptors.report.enumerable !== true ||
      !Buffer.isBuffer(descriptors.archiveBytes.value)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/artifact");
  }
  const facts = authenticAssemblyReports.get(descriptors.report.value);
  if (facts === undefined) fail(ERROR_CODES.ARGUMENT_INVALID, "/artifact/report");
  const archiveBytes = descriptors.archiveBytes.value;
  let byteLength;
  let snapshot;
  try {
    byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(archiveBytes);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/artifact/archiveBytes");
  }
  if (byteLength !== facts.publicFacts.outputBytes) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/archiveBytes");
  }
  try {
    snapshot = Buffer.from(archiveBytes);
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/archiveBytes");
  }
  if (sha256(snapshot) !== facts.publicFacts.outputSha256) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/archiveBytes");
  }
  return { archiveBytes: snapshot, facts };
}

/** @internal Bind one exact in-memory M2-005A report to its archive snapshot. */
export function authenticateCloneFillAssemblyArtifact(options) {
  return authenticateAssemblyArtifact(options).facts.publicFacts;
}

/**
 * @internal Bind a downstream typed applicator to the exact target facts that
 * M2-005A re-derived from its admitted source. The byte snapshot is detached
 * before any downstream asynchronous dispatch can run.
 */
export function authenticateCloneFillAssemblyTargetArtifact(options) {
  const authenticated = authenticateAssemblyArtifact(options);
  return Object.freeze({
    archiveBytes: authenticated.archiveBytes,
    authority: authenticated.facts.targetFacts
  });
}

async function destinationExists(destination) {
  try {
    await lstat(destination);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/destination");
  }
}

async function unlinkIfOwned(stagePath, destination) {
  try {
    const [stageMetadata, destinationMetadata] = await Promise.all([
      lstat(stagePath),
      lstat(destination)
    ]);
    if (stageMetadata.dev === destinationMetadata.dev && stageMetadata.ino === destinationMetadata.ino) {
      await unlink(destination);
    }
  } catch {
    // A path that disappeared or changed identity is not owned by this call.
  }
}

/** Atomically publish one already assembled PPTX without replacing any path. */
export async function publishCreateOnlyPresentation({ archiveBytes, destinationPath } = {}) {
  if (!(archiveBytes instanceof Uint8Array) || typeof destinationPath !== "string" ||
      !path.isAbsolute(destinationPath) || path.normalize(destinationPath) !== destinationPath ||
      !destinationPath.toLowerCase().endsWith(".pptx") ||
      /[\u0000-\u001f\u007f]/u.test(destinationPath)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/destination");
  }
  if (archiveBytes.byteLength < 1 || archiveBytes.byteLength > SECURE_ZIP_LIMITS.maxArchiveBytes) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/archiveBytes");
  }
  const snapshot = Buffer.from(archiveBytes);
  try {
    buildSecureTemplatePackageView({
      sourceLocation: path.resolve("/publication-check.pptx"),
      archiveBytes: snapshot
    });
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, "/archiveBytes");
  }

  const parent = path.dirname(destinationPath);
  let parentMetadata;
  let canonicalParent;
  try {
    [parentMetadata, canonicalParent] = await Promise.all([lstat(parent), realpath(parent)]);
  } catch {
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/destination");
  }
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink() || canonicalParent !== parent) {
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/destination");
  }
  if (await destinationExists(destinationPath)) fail(ERROR_CODES.OUTPUT_EXISTS, "/destination");

  const stagePath = path.join(parent, `.pptx-pipeline-stage-${process.pid}-${randomUUID()}`);
  let handle;
  let linked = false;
  try {
    handle = await open(
      stagePath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW ?? 0),
      0o600
    );
    await handle.writeFile(snapshot);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(stagePath, destinationPath);
    linked = true;
    const [stageMetadata, destinationMetadata] = await Promise.all([
      lstat(stagePath),
      lstat(destinationPath)
    ]);
    if (!stageMetadata.isFile() || destinationMetadata.isSymbolicLink() ||
        stageMetadata.dev !== destinationMetadata.dev || stageMetadata.ino !== destinationMetadata.ino) {
      fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/destination");
    }
    await unlink(stagePath);
  } catch (error) {
    if (handle) {
      try { await handle.close(); } catch { /* best-effort close */ }
    }
    if (linked) await unlinkIfOwned(stagePath, destinationPath);
    try { await unlink(stagePath); } catch { /* best-effort staging cleanup */ }
    if (error instanceof CreateOnlyAssemblyError) throw error;
    if (error?.code === "EEXIST") fail(ERROR_CODES.OUTPUT_EXISTS, "/destination");
    fail(ERROR_CODES.OUTPUT_WRITE_FAILED, "/destination");
  }
  return Object.freeze({
    publicationVersion: CREATE_ONLY_ASSEMBLY_VERSION,
    artifactType: "published-pptx",
    bytes: snapshot.length,
    sha256: sha256(snapshot)
  });
}
