import { createHash } from "node:crypto";
import path from "node:path";

import { parseSecureZip } from "./secure-zip.mjs";
import { parseStrictXml } from "./strict-xml.mjs";

export const SECURE_OOXML_PROFILE_VERSION = "0.1.0";

const PACKAGE_VIEW_VERSION = "0.1.0";
const PACKAGE_VIEW_TYPE = "template-package-view";
const PRODUCER_CLASS = "secure-ooxml-ingestion";
const MAX_PACKAGE_XML_ELEMENTS = 50_000;
const MAX_RELATIONSHIPS = 128;
const MAX_SHAPES_PER_PART = 128;

const NS = Object.freeze({
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  contentTypes: "http://schemas.openxmlformats.org/package/2006/content-types",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  relationships: "http://schemas.openxmlformats.org/package/2006/relationships",
  xml: "http://www.w3.org/XML/1998/namespace"
});

const CONTENT_TYPES = Object.freeze({
  potx: "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
  presProps: "application/vnd.openxmlformats-officedocument.presentationml.presProps+xml",
  slideLayout: "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml",
  slideMaster: "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml",
  slide: "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
  theme: "application/vnd.openxmlformats-officedocument.theme+xml"
});
const ALLOWED_CONTENT_TYPES = new Set(Object.values(CONTENT_TYPES));
const RELATIONSHIP_BASE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
const RELATIONSHIP_TYPES = new Set([
  "officeDocument",
  "presProps",
  "slide",
  "slideLayout",
  "slideMaster",
  "theme"
].map((name) => `${RELATIONSHIP_BASE}${name}`));
const RELATIONSHIP_ID = /^[A-Za-z_][A-Za-z0-9_.-]*$/u;
const SAFE_TARGET_SEGMENT = /^[A-Za-z0-9._-]+$/u;
const HIGH_RISK = /(?:activex|embedded|embedding|oleobject|vbaproject|macroenabled|digital-signature|signature|customxml|font|media|audio|video)/iu;
const KNOWN_NAMESPACES = new Set(Object.values(NS));

export class SecureOoxmlError extends Error {
  constructor(code, pointer = "/package") {
    super(`${code} at ${pointer}`);
    this.name = "SecureOoxmlError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer = "/package") {
  throw new SecureOoxmlError(code, pointer);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function key(namespaceURI, localName) {
  return `${namespaceURI}\u0000${localName}`;
}

function elementKey(prefix, localName) {
  return key(NS[prefix], localName);
}

function attributeKey(prefix, localName) {
  return key(prefix === "" ? "" : NS[prefix], localName);
}

function assertNode(node, prefix, localName, attributes = [], pointer = "/package/xml") {
  if (!node || node.key !== elementKey(prefix, localName)) fail("OOXML_UNHANDLED_FEATURE", pointer);
  const allowed = new Set(attributes.map(([attributePrefix, attributeName]) =>
    attributeKey(attributePrefix, attributeName)));
  if (node.attributes.size !== allowed.size ||
      [...node.attributes.keys()].some((name) => !allowed.has(name))) {
    fail("OOXML_UNHANDLED_FEATURE", pointer);
  }
  if (node.text.trim() !== "") fail("OOXML_UNHANDLED_FEATURE", pointer);
  return node;
}

function assertChildren(node, expectedKeys, pointer = "/package/xml") {
  if (node.children.length !== expectedKeys.length ||
      node.children.some((child, index) => child.key !== expectedKeys[index])) {
    fail("OOXML_UNHANDLED_FEATURE", pointer);
  }
  return node.children;
}

function attr(node, prefix, localName, pointer = "/package/xml") {
  const value = node.attributes.get(attributeKey(prefix, localName))?.value;
  if (typeof value !== "string") fail("OOXML_UNHANDLED_FEATURE", pointer);
  return value;
}

function unsigned(value, { min = 0, max = 2147483647 } = {}, pointer = "/package/xml") {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) fail("OOXML_VALUE_INVALID", pointer);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    fail("OOXML_VALUE_INVALID", pointer);
  }
  return parsed;
}

function token(value, pointer = "/package/xml", { allowEmpty = false } = {}) {
  if ((!allowEmpty && value.length === 0) || value.length > 256 ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    fail("OOXML_VALUE_INVALID", pointer);
  }
  return value;
}

function booleanToken(value, pointer = "/package/xml") {
  if (value !== "0" && value !== "1") fail("OOXML_VALUE_INVALID", pointer);
}

function assertKnownNamespaces(document) {
  if ([...document.namespaceUris].some((uri) => !KNOWN_NAMESPACES.has(uri))) {
    fail("OOXML_UNHANDLED_FEATURE", "/package/xml/namespaces");
  }
}

function scanHighRiskXml(node) {
  if (HIGH_RISK.test(node.namespaceURI) || /^(?:control|oleObj)$/iu.test(node.localName)) {
    fail("OOXML_HIGH_RISK_CONTENT", "/package/xml");
  }
  for (const child of node.children) scanHighRiskXml(child);
}

function parseDocuments(parts) {
  const documents = new Map();
  let totalElements = 0;
  for (const [partPath, bytes] of parts) {
    if (HIGH_RISK.test(partPath)) fail("OOXML_HIGH_RISK_CONTENT", "/package/parts");
    if (partPath !== "[Content_Types].xml" && !partPath.endsWith(".xml") &&
        !partPath.endsWith(".rels")) {
      fail("OOXML_UNHANDLED_FEATURE", "/package/parts");
    }
    const document = parseStrictXml(bytes);
    totalElements += document.counts.elements;
    if (totalElements > MAX_PACKAGE_XML_ELEMENTS) {
      fail("OOXML_RESOURCE_LIMIT", "/package/xml/elements");
    }
    assertKnownNamespaces(document);
    scanHighRiskXml(document.root);
    documents.set(partPath, document);
  }
  return documents;
}

function parseContentTypes(parts, documents) {
  const document = documents.get("[Content_Types].xml");
  if (!document) fail("OOXML_CONTENT_TYPES_INVALID", "/package/contentTypes");
  const root = assertNode(document.root, "contentTypes", "Types", [], "/package/contentTypes");
  const defaults = new Map();
  const overrides = new Map();
  let seenOverride = false;
  for (const child of root.children) {
    if (child.key === elementKey("contentTypes", "Default")) {
      if (seenOverride) fail("OOXML_CONTENT_TYPES_INVALID", "/package/contentTypes");
      assertNode(child, "contentTypes", "Default", [["", "Extension"], ["", "ContentType"]]);
      assertChildren(child, [], "/package/contentTypes");
      const extension = attr(child, "", "Extension");
      const contentType = attr(child, "", "ContentType");
      if (defaults.has(extension)) fail("OOXML_CONTENT_TYPES_INVALID", "/package/contentTypes");
      defaults.set(extension, contentType);
    } else if (child.key === elementKey("contentTypes", "Override")) {
      seenOverride = true;
      assertNode(child, "contentTypes", "Override", [["", "PartName"], ["", "ContentType"]]);
      assertChildren(child, [], "/package/contentTypes");
      const rawPartName = attr(child, "", "PartName");
      const contentType = attr(child, "", "ContentType");
      if (!rawPartName.startsWith("/") || rawPartName.length < 2 || rawPartName.includes("\\") ||
          rawPartName.includes("%") || rawPartName.includes("//")) {
        fail("OOXML_CONTENT_TYPES_INVALID", "/package/contentTypes");
      }
      const partName = rawPartName.slice(1);
      if (overrides.has(partName)) fail("OOXML_CONTENT_TYPES_INVALID", "/package/contentTypes");
      if (HIGH_RISK.test(contentType) || HIGH_RISK.test(partName)) {
        fail("OOXML_HIGH_RISK_CONTENT", "/package/contentTypes");
      }
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        fail("OOXML_UNHANDLED_FEATURE", "/package/contentTypes");
      }
      overrides.set(partName, contentType);
    } else {
      fail("OOXML_UNHANDLED_FEATURE", "/package/contentTypes");
    }
  }
  if (defaults.size !== 2 ||
      defaults.get("rels") !== "application/vnd.openxmlformats-package.relationships+xml" ||
      defaults.get("xml") !== "application/xml") {
    fail("OOXML_CONTENT_TYPES_INVALID", "/package/contentTypes");
  }
  const contentPaths = [...parts.keys()].filter((partPath) =>
    partPath !== "[Content_Types].xml" && !partPath.endsWith(".rels"));
  if (overrides.size !== contentPaths.length ||
      contentPaths.some((partPath) => !overrides.has(partPath)) ||
      [...overrides.keys()].some((partPath) => !parts.has(partPath) || partPath.endsWith(".rels"))) {
    fail("OOXML_CONTENT_TYPES_INVALID", "/package/contentTypes");
  }
  const formats = [...overrides.values()].filter((value) =>
    value === CONTENT_TYPES.potx || value === CONTENT_TYPES.pptx);
  if (formats.length !== 1) fail("OOXML_CONTENT_TYPES_INVALID", "/package/contentTypes");
  return {
    contentParts: [...overrides.entries()]
      .map(([partPath, contentType]) => ({ partPath, contentType }))
      .sort((left, right) => compareText(left.partPath, right.partPath)),
    contentTypesByPath: overrides,
    templateFormat: formats[0] === CONTENT_TYPES.potx ? "potx" : "pptx"
  };
}

function relationshipOwner(relsPath) {
  if (relsPath === "_rels/.rels") return null;
  const match = /^(.*\/)_rels\/([^/]+)\.rels$/u.exec(relsPath);
  if (!match) fail("OOXML_RELATIONSHIPS_INVALID", "/package/relationships");
  return `${match[1]}${match[2]}`;
}

function resolveTarget(ownerPart, target, parts) {
  if (target.length === 0 || target.includes("\\") || target.includes("%") ||
      target.includes("?") || target.includes("#") || target.startsWith("/") ||
      target.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(target) ||
      /[\u0000-\u001f\u007f]/u.test(target)) {
    fail("OOXML_EXTERNAL_RELATIONSHIP", "/package/relationships/target");
  }
  const segments = target.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." ||
      (segment !== ".." && !SAFE_TARGET_SEGMENT.test(segment)))) {
    fail("OOXML_RELATIONSHIP_TARGET_INVALID", "/package/relationships/target");
  }
  const ownerDirectory = ownerPart === null ? "" : path.posix.dirname(ownerPart);
  const resolved = path.posix.normalize(path.posix.join(ownerDirectory, target));
  if (resolved === ".." || resolved.startsWith("../") || !parts.has(resolved)) {
    fail("OOXML_RELATIONSHIP_TARGET_INVALID", "/package/relationships/target");
  }
  return resolved;
}

function parseRelationshipSets(parts, documents, contentTypesByPath) {
  const relsPaths = [...parts.keys()]
    .filter((partPath) => partPath.endsWith(".rels"))
    .sort(compareText);
  if (!relsPaths.includes("_rels/.rels")) {
    fail("OOXML_RELATIONSHIPS_INVALID", "/package/relationships");
  }
  let relationshipCount = 0;
  const sets = [];
  for (const relsPath of relsPaths) {
    const ownerPart = relationshipOwner(relsPath);
    if (ownerPart !== null && !contentTypesByPath.has(ownerPart)) {
      fail("OOXML_RELATIONSHIPS_INVALID", "/package/relationships/owner");
    }
    const root = assertNode(
      documents.get(relsPath)?.root,
      "relationships",
      "Relationships",
      [],
      "/package/relationships"
    );
    if (root.children.length === 0) fail("OOXML_RELATIONSHIPS_INVALID", "/package/relationships");
    const ids = new Set();
    const edges = new Set();
    const relationships = root.children.map((node) => {
      if (node.attributes.has(attributeKey("", "TargetMode"))) {
        fail("OOXML_EXTERNAL_RELATIONSHIP", "/package/relationships");
      }
      assertNode(node, "relationships", "Relationship", [
        ["", "Id"], ["", "Type"], ["", "Target"]
      ], "/package/relationships");
      if (node.children.length !== 0) fail("OOXML_UNHANDLED_FEATURE", "/package/relationships");
      const relationshipId = attr(node, "", "Id");
      const relationshipType = attr(node, "", "Type");
      const target = attr(node, "", "Target");
      if (!RELATIONSHIP_ID.test(relationshipId) || ids.has(relationshipId)) {
        fail("OOXML_RELATIONSHIPS_INVALID", "/package/relationships/id");
      }
      if (HIGH_RISK.test(relationshipType)) {
        fail("OOXML_HIGH_RISK_CONTENT", "/package/relationships/type");
      }
      if (!RELATIONSHIP_TYPES.has(relationshipType)) {
        fail("OOXML_UNHANDLED_FEATURE", "/package/relationships/type");
      }
      const targetPart = resolveTarget(ownerPart, target, parts);
      const edge = `${relationshipType}\u0000${targetPart}`;
      if (edges.has(edge)) fail("OOXML_RELATIONSHIPS_INVALID", "/package/relationships");
      ids.add(relationshipId);
      edges.add(edge);
      relationshipCount += 1;
      if (relationshipCount > MAX_RELATIONSHIPS) {
        fail("OOXML_RESOURCE_LIMIT", "/package/relationships");
      }
      return { relationshipId, relationshipType, targetPart };
    });
    sets.push({ ownerPart, relationships });
  }
  sets.sort((left, right) => {
    if (left.ownerPart === null) return -1;
    if (right.ownerPart === null) return 1;
    return compareText(left.ownerPart, right.ownerPart);
  });
  return sets;
}

function validateGroupTree(spTree, pointer) {
  assertNode(spTree, "p", "spTree", [], pointer);
  if (spTree.children.length < 2) fail("OOXML_UNHANDLED_FEATURE", pointer);
  const nvGrpSpPr = spTree.children[0];
  assertNode(nvGrpSpPr, "p", "nvGrpSpPr", [], pointer);
  const [cNvPr, cNvGrpSpPr, nvPr] = assertChildren(nvGrpSpPr, [
    elementKey("p", "cNvPr"), elementKey("p", "cNvGrpSpPr"), elementKey("p", "nvPr")
  ], pointer);
  assertNode(cNvPr, "p", "cNvPr", [["", "id"], ["", "name"]], pointer);
  unsigned(attr(cNvPr, "", "id"), { min: 1, max: 4294967295 }, pointer);
  token(attr(cNvPr, "", "name"), pointer, { allowEmpty: true });
  assertChildren(cNvPr, [], pointer);
  assertNode(cNvGrpSpPr, "p", "cNvGrpSpPr", [], pointer);
  assertChildren(cNvGrpSpPr, [], pointer);
  assertNode(nvPr, "p", "nvPr", [], pointer);
  assertChildren(nvPr, [], pointer);

  const grpSpPr = spTree.children[1];
  assertNode(grpSpPr, "p", "grpSpPr", [], pointer);
  const [xfrm] = assertChildren(grpSpPr, [elementKey("a", "xfrm")], pointer);
  assertNode(xfrm, "a", "xfrm", [], pointer);
  const transformChildren = assertChildren(xfrm, [
    elementKey("a", "off"), elementKey("a", "ext"),
    elementKey("a", "chOff"), elementKey("a", "chExt")
  ], pointer);
  for (const [index, child] of transformChildren.entries()) {
    const offset = index === 0 || index === 2;
    assertNode(child, "a", offset ? (index === 0 ? "off" : "chOff") :
      (index === 1 ? "ext" : "chExt"), offset
      ? [["", "x"], ["", "y"]]
      : [["", "cx"], ["", "cy"]], pointer);
    for (const attribute of child.attributes.values()) {
      if (unsigned(attribute.value, {}, pointer) !== 0) fail("OOXML_UNHANDLED_FEATURE", pointer);
    }
    assertChildren(child, [], pointer);
  }
}

function parseReferenceList(node, listName, itemName, pointer) {
  assertNode(node, "p", listName, [], pointer);
  if (node.children.length === 0) fail("OOXML_UNHANDLED_FEATURE", pointer);
  const ids = new Set();
  const relationshipIds = new Set();
  return node.children.map((item) => {
    assertNode(item, "p", itemName, [["", "id"], ["r", "id"]], pointer);
    assertChildren(item, [], pointer);
    const sourceId = unsigned(attr(item, "", "id"), { min: 1, max: 4294967295 }, pointer);
    const relationshipId = attr(item, "r", "id");
    if (!RELATIONSHIP_ID.test(relationshipId) || ids.has(sourceId) ||
        relationshipIds.has(relationshipId)) {
      fail("OOXML_VALUE_INVALID", pointer);
    }
    ids.add(sourceId);
    relationshipIds.add(relationshipId);
    return { sourceId, relationshipId };
  });
}

function parsePresentation(document) {
  const pointer = "/package/presentation";
  const root = assertNode(document.root, "p", "presentation", [
    ["", "saveSubsetFonts"], ["", "autoCompressPictures"]
  ], pointer);
  booleanToken(attr(root, "", "saveSubsetFonts"), pointer);
  booleanToken(attr(root, "", "autoCompressPictures"), pointer);
  const [masterList, slideList, slideSize, notesSize, defaultTextStyle] = assertChildren(root, [
    elementKey("p", "sldMasterIdLst"), elementKey("p", "sldIdLst"),
    elementKey("p", "sldSz"), elementKey("p", "notesSz"),
    elementKey("p", "defaultTextStyle")
  ], pointer);
  const masterReferences = parseReferenceList(masterList, "sldMasterIdLst", "sldMasterId", pointer);
  const slideReferences = parseReferenceList(slideList, "sldIdLst", "sldId", pointer);
  assertNode(slideSize, "p", "sldSz", [["", "cx"], ["", "cy"], ["", "type"]], pointer);
  assertChildren(slideSize, [], pointer);
  token(attr(slideSize, "", "type"), pointer);
  const slideSizeEmu = {
    cx: unsigned(attr(slideSize, "", "cx"), { min: 1 }, pointer),
    cy: unsigned(attr(slideSize, "", "cy"), { min: 1 }, pointer)
  };
  assertNode(notesSize, "p", "notesSz", [["", "cx"], ["", "cy"]], pointer);
  assertChildren(notesSize, [], pointer);
  unsigned(attr(notesSize, "", "cx"), { min: 1 }, pointer);
  unsigned(attr(notesSize, "", "cy"), { min: 1 }, pointer);
  assertNode(defaultTextStyle, "p", "defaultTextStyle", [], pointer);
  const [defPPr] = assertChildren(defaultTextStyle, [elementKey("a", "defPPr")], pointer);
  assertNode(defPPr, "a", "defPPr", [], pointer);
  const [defRPr] = assertChildren(defPPr, [elementKey("a", "defRPr")], pointer);
  assertNode(defRPr, "a", "defRPr", [["", "lang"]], pointer);
  token(attr(defRPr, "", "lang"), pointer);
  assertChildren(defRPr, [], pointer);
  return { slideSizeEmu, masterReferences, slideReferences };
}

function validateColorMap(node, pointer) {
  const names = [
    "accent1", "accent2", "accent3", "accent4", "accent5", "accent6",
    "bg1", "bg2", "folHlink", "hlink", "tx1", "tx2"
  ];
  assertNode(node, "p", "clrMap", names.map((name) => ["", name]), pointer);
  for (const name of names) token(attr(node, "", name), pointer);
  assertChildren(node, [], pointer);
}

function parseMaster(document) {
  const pointer = "/package/master";
  const root = assertNode(document.root, "p", "sldMaster", [], pointer);
  const [cSld, clrMap, layoutList, txStyles] = assertChildren(root, [
    elementKey("p", "cSld"), elementKey("p", "clrMap"),
    elementKey("p", "sldLayoutIdLst"), elementKey("p", "txStyles")
  ], pointer);
  assertNode(cSld, "p", "cSld", [["", "name"]], pointer);
  token(attr(cSld, "", "name"), pointer);
  const [spTree] = assertChildren(cSld, [elementKey("p", "spTree")], pointer);
  validateGroupTree(spTree, pointer);
  if (spTree.children.length !== 2) fail("OOXML_UNHANDLED_FEATURE", pointer);
  validateColorMap(clrMap, pointer);
  const layoutReferences = parseReferenceList(layoutList, "sldLayoutIdLst", "sldLayoutId", pointer);
  assertNode(txStyles, "p", "txStyles", [], pointer);
  const styleNodes = assertChildren(txStyles, [
    elementKey("p", "titleStyle"), elementKey("p", "bodyStyle"), elementKey("p", "otherStyle")
  ], pointer);
  for (const [index, style] of styleNodes.entries()) {
    assertNode(style, "p", ["titleStyle", "bodyStyle", "otherStyle"][index], [], pointer);
    assertChildren(style, [], pointer);
  }
  return { layoutReferences };
}

function validateColorMapOverride(node, pointer) {
  assertNode(node, "p", "clrMapOvr", [], pointer);
  const [mapping] = assertChildren(node, [elementKey("a", "masterClrMapping")], pointer);
  assertNode(mapping, "a", "masterClrMapping", [], pointer);
  assertChildren(mapping, [], pointer);
}

function parseLayout(document) {
  const pointer = "/package/layout";
  const root = assertNode(document.root, "p", "sldLayout", [
    ["", "matchingName"], ["", "type"], ["", "preserve"]
  ], pointer);
  token(attr(root, "", "matchingName"), pointer);
  token(attr(root, "", "type"), pointer);
  booleanToken(attr(root, "", "preserve"), pointer);
  const [cSld, clrMapOvr] = assertChildren(root, [elementKey("p", "cSld"), elementKey("p", "clrMapOvr")], pointer);
  assertNode(cSld, "p", "cSld", [["", "name"]], pointer);
  token(attr(cSld, "", "name"), pointer);
  const [spTree] = assertChildren(cSld, [elementKey("p", "spTree")], pointer);
  validateGroupTree(spTree, pointer);
  if (spTree.children.length !== 2) fail("OOXML_UNHANDLED_FEATURE", pointer);
  validateColorMapOverride(clrMapOvr, pointer);
  return { shapes: [] };
}

function parseTextShape(node, sourceIds, pointer) {
  assertNode(node, "p", "sp", [], pointer);
  const [nvSpPr, spPr, txBody] = assertChildren(node, [
    elementKey("p", "nvSpPr"), elementKey("p", "spPr"), elementKey("p", "txBody")
  ], pointer);
  assertNode(nvSpPr, "p", "nvSpPr", [], pointer);
  const [cNvPr, cNvSpPr, nvPr] = assertChildren(nvSpPr, [
    elementKey("p", "cNvPr"), elementKey("p", "cNvSpPr"), elementKey("p", "nvPr")
  ], pointer);
  assertNode(cNvPr, "p", "cNvPr", [["", "id"], ["", "name"]], pointer);
  const sourceId = unsigned(attr(cNvPr, "", "id"), { min: 1, max: 4294967295 }, pointer);
  token(attr(cNvPr, "", "name"), pointer);
  if (sourceIds.has(sourceId)) fail("OOXML_VALUE_INVALID", pointer);
  sourceIds.add(sourceId);
  assertChildren(cNvPr, [], pointer);
  assertNode(cNvSpPr, "p", "cNvSpPr", [["", "txBox"]], pointer);
  if (attr(cNvSpPr, "", "txBox") !== "1") fail("OOXML_UNHANDLED_FEATURE", pointer);
  assertChildren(cNvSpPr, [], pointer);
  assertNode(nvPr, "p", "nvPr", [], pointer);
  assertChildren(nvPr, [], pointer);

  assertNode(spPr, "p", "spPr", [], pointer);
  const [xfrm, prstGeom, noFill, ln] = assertChildren(spPr, [
    elementKey("a", "xfrm"), elementKey("a", "prstGeom"),
    elementKey("a", "noFill"), elementKey("a", "ln")
  ], pointer);
  assertNode(xfrm, "a", "xfrm", [], pointer);
  const [off, ext] = assertChildren(xfrm, [elementKey("a", "off"), elementKey("a", "ext")], pointer);
  assertNode(off, "a", "off", [["", "x"], ["", "y"]], pointer);
  assertChildren(off, [], pointer);
  assertNode(ext, "a", "ext", [["", "cx"], ["", "cy"]], pointer);
  assertChildren(ext, [], pointer);
  const geometry = {
    x: unsigned(attr(off, "", "x"), {}, pointer),
    y: unsigned(attr(off, "", "y"), {}, pointer),
    cx: unsigned(attr(ext, "", "cx"), { min: 1 }, pointer),
    cy: unsigned(attr(ext, "", "cy"), { min: 1 }, pointer)
  };
  assertNode(prstGeom, "a", "prstGeom", [["", "prst"]], pointer);
  if (attr(prstGeom, "", "prst") !== "rect") fail("OOXML_UNHANDLED_FEATURE", pointer);
  const [avLst] = assertChildren(prstGeom, [elementKey("a", "avLst")], pointer);
  assertNode(avLst, "a", "avLst", [], pointer);
  assertChildren(avLst, [], pointer);
  assertNode(noFill, "a", "noFill", [], pointer);
  assertChildren(noFill, [], pointer);
  assertNode(ln, "a", "ln", [], pointer);
  const [lineNoFill] = assertChildren(ln, [elementKey("a", "noFill")], pointer);
  assertNode(lineNoFill, "a", "noFill", [], pointer);
  assertChildren(lineNoFill, [], pointer);

  assertNode(txBody, "p", "txBody", [], pointer);
  const [bodyPr, lstStyle, paragraph] = assertChildren(txBody, [
    elementKey("a", "bodyPr"), elementKey("a", "lstStyle"), elementKey("a", "p")
  ], pointer);
  assertNode(bodyPr, "a", "bodyPr", [["", "anchor"]], pointer);
  token(attr(bodyPr, "", "anchor"), pointer);
  assertChildren(bodyPr, [], pointer);
  assertNode(lstStyle, "a", "lstStyle", [], pointer);
  assertChildren(lstStyle, [], pointer);
  assertNode(paragraph, "a", "p", [], pointer);
  const [pPr, run, endParaRPr] = assertChildren(paragraph, [
    elementKey("a", "pPr"), elementKey("a", "r"), elementKey("a", "endParaRPr")
  ], pointer);
  assertNode(pPr, "a", "pPr", [["", "algn"]], pointer);
  token(attr(pPr, "", "algn"), pointer);
  assertChildren(pPr, [], pointer);
  assertNode(run, "a", "r", [], pointer);
  const [rPr, text] = assertChildren(run, [elementKey("a", "rPr"), elementKey("a", "t")], pointer);
  const rPrAttrKeys = new Set(rPr.attributes.keys());
  const requiredRPr = [attributeKey("", "lang"), attributeKey("", "sz")];
  const optionalBold = attributeKey("", "b");
  if (rPr.key !== elementKey("a", "rPr") || requiredRPr.some((name) => !rPrAttrKeys.has(name)) ||
      (rPrAttrKeys.size !== 2 && rPrAttrKeys.size !== 3) ||
      [...rPrAttrKeys].some((name) => !requiredRPr.includes(name) && name !== optionalBold) ||
      rPr.text.trim() !== "") {
    fail("OOXML_UNHANDLED_FEATURE", pointer);
  }
  token(attr(rPr, "", "lang"), pointer);
  unsigned(attr(rPr, "", "sz"), { min: 1, max: 400000 }, pointer);
  if (rPrAttrKeys.has(optionalBold)) booleanToken(attr(rPr, "", "b"), pointer);
  const [solidFill, latin] = assertChildren(rPr, [elementKey("a", "solidFill"), elementKey("a", "latin")], pointer);
  assertNode(solidFill, "a", "solidFill", [], pointer);
  const [schemeClr] = assertChildren(solidFill, [elementKey("a", "schemeClr")], pointer);
  assertNode(schemeClr, "a", "schemeClr", [["", "val"]], pointer);
  token(attr(schemeClr, "", "val"), pointer);
  assertChildren(schemeClr, [], pointer);
  assertNode(latin, "a", "latin", [["", "typeface"]], pointer);
  token(attr(latin, "", "typeface"), pointer);
  assertChildren(latin, [], pointer);
  if (text.key !== elementKey("a", "t") || text.attributes.size !== 0 || text.children.length !== 0) {
    fail("OOXML_UNHANDLED_FEATURE", pointer);
  }
  assertNode(endParaRPr, "a", "endParaRPr", [["", "lang"]], pointer);
  token(attr(endParaRPr, "", "lang"), pointer);
  assertChildren(endParaRPr, [], pointer);
  return { sourceId, kind: "text-box", geometry };
}

function parseSlide(document) {
  const pointer = "/package/slide";
  const root = assertNode(document.root, "p", "sld", [], pointer);
  const [cSld, clrMapOvr] = assertChildren(root, [elementKey("p", "cSld"), elementKey("p", "clrMapOvr")], pointer);
  assertNode(cSld, "p", "cSld", [["", "name"]], pointer);
  token(attr(cSld, "", "name"), pointer);
  const [spTree] = assertChildren(cSld, [elementKey("p", "spTree")], pointer);
  validateGroupTree(spTree, pointer);
  const shapeNodes = spTree.children.slice(2);
  if (shapeNodes.length > MAX_SHAPES_PER_PART) fail("OOXML_RESOURCE_LIMIT", pointer);
  const sourceIds = new Set([unsigned(attr(spTree.children[0].children[0], "", "id"), {
    min: 1, max: 4294967295
  }, pointer)]);
  const shapes = shapeNodes.map((node) => parseTextShape(node, sourceIds, pointer));
  validateColorMapOverride(clrMapOvr, pointer);
  return { shapes };
}

function validateTheme(document) {
  const pointer = "/package/theme";
  const root = assertNode(document.root, "a", "theme", [["", "name"]], pointer);
  token(attr(root, "", "name"), pointer);
  const [themeElements, objectDefaults, extraClrSchemeLst] = assertChildren(root, [
    elementKey("a", "themeElements"), elementKey("a", "objectDefaults"),
    elementKey("a", "extraClrSchemeLst")
  ], pointer);
  assertNode(objectDefaults, "a", "objectDefaults", [], pointer);
  assertChildren(objectDefaults, [], pointer);
  assertNode(extraClrSchemeLst, "a", "extraClrSchemeLst", [], pointer);
  assertChildren(extraClrSchemeLst, [], pointer);
  assertNode(themeElements, "a", "themeElements", [], pointer);
  const [clrScheme, fontScheme, fmtScheme] = assertChildren(themeElements, [
    elementKey("a", "clrScheme"), elementKey("a", "fontScheme"), elementKey("a", "fmtScheme")
  ], pointer);

  assertNode(clrScheme, "a", "clrScheme", [["", "name"]], pointer);
  token(attr(clrScheme, "", "name"), pointer);
  const colorNames = [
    "dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4",
    "accent5", "accent6", "hlink", "folHlink"
  ];
  const colors = assertChildren(clrScheme, colorNames.map((name) => elementKey("a", name)), pointer);
  for (const [index, color] of colors.entries()) {
    assertNode(color, "a", colorNames[index], [], pointer);
    const [srgb] = assertChildren(color, [elementKey("a", "srgbClr")], pointer);
    assertNode(srgb, "a", "srgbClr", [["", "val"]], pointer);
    if (!/^[0-9A-Fa-f]{6}$/u.test(attr(srgb, "", "val"))) fail("OOXML_VALUE_INVALID", pointer);
    assertChildren(srgb, [], pointer);
  }

  assertNode(fontScheme, "a", "fontScheme", [["", "name"]], pointer);
  token(attr(fontScheme, "", "name"), pointer);
  const fontFamilies = assertChildren(fontScheme, [elementKey("a", "majorFont"), elementKey("a", "minorFont")], pointer);
  for (const [familyIndex, family] of fontFamilies.entries()) {
    assertNode(family, "a", familyIndex === 0 ? "majorFont" : "minorFont", [], pointer);
    const members = assertChildren(family, [elementKey("a", "latin"), elementKey("a", "ea"), elementKey("a", "cs")], pointer);
    for (const [memberIndex, member] of members.entries()) {
      assertNode(member, "a", ["latin", "ea", "cs"][memberIndex], [["", "typeface"]], pointer);
      token(attr(member, "", "typeface"), pointer, { allowEmpty: true });
      assertChildren(member, [], pointer);
    }
  }

  assertNode(fmtScheme, "a", "fmtScheme", [["", "name"]], pointer);
  token(attr(fmtScheme, "", "name"), pointer);
  const [fillStyleLst, lnStyleLst, effectStyleLst, bgFillStyleLst] = assertChildren(fmtScheme, [
    elementKey("a", "fillStyleLst"), elementKey("a", "lnStyleLst"),
    elementKey("a", "effectStyleLst"), elementKey("a", "bgFillStyleLst")
  ], pointer);
  validateFillList(fillStyleLst, [[], ["tint", "satMod"], ["shade", "satMod"]], pointer);
  validateLineList(lnStyleLst, pointer);
  assertNode(effectStyleLst, "a", "effectStyleLst", [], pointer);
  const effects = assertChildren(effectStyleLst, Array(3).fill(elementKey("a", "effectStyle")), pointer);
  for (const effect of effects) {
    assertNode(effect, "a", "effectStyle", [], pointer);
    const [effectLst] = assertChildren(effect, [elementKey("a", "effectLst")], pointer);
    assertNode(effectLst, "a", "effectLst", [], pointer);
    assertChildren(effectLst, [], pointer);
  }
  validateFillList(bgFillStyleLst, [[], ["tint"], ["shade"]], pointer, "bgFillStyleLst");
}

function validateFillList(node, modifiers, pointer, localName = "fillStyleLst") {
  assertNode(node, "a", localName, [], pointer);
  const fills = assertChildren(node, Array(3).fill(elementKey("a", "solidFill")), pointer);
  for (const [index, fill] of fills.entries()) {
    assertNode(fill, "a", "solidFill", [], pointer);
    const [schemeClr] = assertChildren(fill, [elementKey("a", "schemeClr")], pointer);
    assertNode(schemeClr, "a", "schemeClr", [["", "val"]], pointer);
    token(attr(schemeClr, "", "val"), pointer);
    const expected = modifiers[index];
    const children = assertChildren(schemeClr, expected.map((name) => elementKey("a", name)), pointer);
    for (const [childIndex, child] of children.entries()) {
      assertNode(child, "a", expected[childIndex], [["", "val"]], pointer);
      unsigned(attr(child, "", "val"), { max: 200000 }, pointer);
      assertChildren(child, [], pointer);
    }
  }
}

function validateLineList(node, pointer) {
  assertNode(node, "a", "lnStyleLst", [], pointer);
  const lines = assertChildren(node, Array(3).fill(elementKey("a", "ln")), pointer);
  for (const line of lines) {
    assertNode(line, "a", "ln", [["", "w"], ["", "cap"], ["", "cmpd"], ["", "algn"]], pointer);
    unsigned(attr(line, "", "w"), { min: 1 }, pointer);
    token(attr(line, "", "cap"), pointer);
    token(attr(line, "", "cmpd"), pointer);
    token(attr(line, "", "algn"), pointer);
    const [solidFill, prstDash, miter] = assertChildren(line, [
      elementKey("a", "solidFill"), elementKey("a", "prstDash"), elementKey("a", "miter")
    ], pointer);
    assertNode(solidFill, "a", "solidFill", [], pointer);
    const [schemeClr] = assertChildren(solidFill, [elementKey("a", "schemeClr")], pointer);
    assertNode(schemeClr, "a", "schemeClr", [["", "val"]], pointer);
    token(attr(schemeClr, "", "val"), pointer);
    assertChildren(schemeClr, [], pointer);
    assertNode(prstDash, "a", "prstDash", [["", "val"]], pointer);
    token(attr(prstDash, "", "val"), pointer);
    assertChildren(prstDash, [], pointer);
    assertNode(miter, "a", "miter", [["", "lim"]], pointer);
    unsigned(attr(miter, "", "lim"), { min: 1 }, pointer);
    assertChildren(miter, [], pointer);
  }
}

function validateContentDocuments(documents, contentTypesByPath) {
  const models = new Map();
  for (const [partPath, contentType] of contentTypesByPath) {
    const document = documents.get(partPath);
    if (!document) fail("OOXML_CONTENT_TYPES_INVALID", "/package/contentParts");
    if (contentType === CONTENT_TYPES.potx || contentType === CONTENT_TYPES.pptx) {
      models.set(partPath, { kind: "presentation", ...parsePresentation(document) });
    } else if (contentType === CONTENT_TYPES.presProps) {
      const root = assertNode(document.root, "p", "presentationPr", [], "/package/presProps");
      assertChildren(root, [], "/package/presProps");
      models.set(partPath, { kind: "presProps" });
    } else if (contentType === CONTENT_TYPES.slideMaster) {
      models.set(partPath, { kind: "master", ...parseMaster(document) });
    } else if (contentType === CONTENT_TYPES.slideLayout) {
      models.set(partPath, { kind: "layout", ...parseLayout(document) });
    } else if (contentType === CONTENT_TYPES.slide) {
      models.set(partPath, { kind: "slide", ...parseSlide(document) });
    } else if (contentType === CONTENT_TYPES.theme) {
      validateTheme(document);
      models.set(partPath, { kind: "theme" });
    } else {
      fail("OOXML_UNHANDLED_FEATURE", "/package/contentParts");
    }
  }
  return models;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

/** @internal Build a narrow package view from one bounded archive snapshot. */
export function buildSecureTemplatePackageView({ sourceLocation, archiveBytes } = {}) {
  if (typeof sourceLocation !== "string" || !path.isAbsolute(sourceLocation) ||
      /[\u0000-\u001f\u007f]/u.test(sourceLocation) || !(archiveBytes instanceof Uint8Array)) {
    fail("OOXML_ARGUMENT_INVALID");
  }
  const snapshot = Buffer.from(archiveBytes);
  const parts = parseSecureZip(snapshot);
  const documents = parseDocuments(parts);
  const { contentParts, contentTypesByPath, templateFormat } = parseContentTypes(parts, documents);
  const relationshipSets = parseRelationshipSets(parts, documents, contentTypesByPath);
  const models = validateContentDocuments(documents, contentTypesByPath);
  const presentationEntries = [...models.entries()].filter(([, model]) => model.kind === "presentation");
  if (presentationEntries.length !== 1) fail("OOXML_CONTENT_TYPES_INVALID", "/package/presentation");
  const [presentationPart, presentationModel] = presentationEntries[0];
  const masters = [...models.entries()]
    .filter(([, model]) => model.kind === "master")
    .map(([partPath, model]) => ({ partPath, layoutReferences: model.layoutReferences }))
    .sort((left, right) => compareText(left.partPath, right.partPath));
  const layouts = [...models.entries()]
    .filter(([, model]) => model.kind === "layout")
    .map(([partPath, model]) => ({ partPath, shapes: model.shapes }))
    .sort((left, right) => compareText(left.partPath, right.partPath));
  const slides = [...models.entries()]
    .filter(([, model]) => model.kind === "slide")
    .map(([partPath, model]) => ({ partPath, shapes: model.shapes }))
    .sort((left, right) => compareText(left.partPath, right.partPath));
  const allShapes = [...layouts, ...slides].flatMap((entry) => entry.shapes);
  const observedFeatureIds = [
    "content-types-and-relationships",
    ...(allShapes.length > 0 ? ["drawingml-shapes"] : []),
    "masters-layouts-themes",
    "package-container",
    ...(allShapes.some((shape) => shape.kind === "text-box") ? ["slide-text"] : [])
  ].sort();
  return deepFreeze({
    viewVersion: PACKAGE_VIEW_VERSION,
    viewType: PACKAGE_VIEW_TYPE,
    producerClass: PRODUCER_CLASS,
    sourceLocation: path.normalize(sourceLocation),
    templateFormat,
    archiveSha256: createHash("sha256").update(snapshot).digest("hex"),
    contentParts,
    relationshipSets,
    presentation: {
      partPath: presentationPart,
      slideSizeEmu: presentationModel.slideSizeEmu,
      masterReferences: presentationModel.masterReferences,
      slideReferences: presentationModel.slideReferences
    },
    masters,
    layouts,
    slides,
    observedFeatureIds,
    unhandledFeatureIds: []
  });
}
