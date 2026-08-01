import { createHash, randomUUID } from "node:crypto";
import {
  constants as fsConstants,
  link,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  unlink
} from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
export const defaultFixtureSourceRoot = path.join(
  repositoryRoot,
  "fixtures",
  "source-parts",
  "minimal"
);

const CONTENT_TYPE_TOKEN = "@@MAIN_CONTENT_TYPE@@";
const HARD_LIMITS = Object.freeze({
  maxPartBytes: 1024 * 1024,
  maxPackageBytes: 4 * 1024 * 1024,
  maxParts: 64
});
const MAIN_CONTENT_TYPES = Object.freeze({
  potx: "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"
});
const REVIEWED_PART_PATHS = Object.freeze([
  "[Content_Types].xml",
  "_rels/.rels",
  "ppt/_rels/presentation.xml.rels",
  "ppt/presProps.xml",
  "ppt/presentation.xml",
  "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
  "ppt/slideLayouts/slideLayout1.xml",
  "ppt/slideMasters/_rels/slideMaster1.xml.rels",
  "ppt/slideMasters/slideMaster1.xml",
  "ppt/slides/_rels/slide1.xml.rels",
  "ppt/slides/slide1.xml",
  "ppt/theme/theme1.xml"
]);
const REVIEWED_INSPECTION_CONTENT_PATHS = Object.freeze([
  "ppt/presProps.xml",
  "ppt/presentation.xml",
  "ppt/slideLayouts/slideLayout1.xml",
  "ppt/slideMasters/slideMaster1.xml",
  "ppt/slides/slide1.xml",
  "ppt/theme/theme1.xml"
]);
const REVIEWED_INSPECTION_VOCABULARY_SHA256 =
  "ec5438257d696fb7141593ad6e71b42b97b08076e29301c66a5e158b9292f052";
const CANONICAL_XML_DECLARATION = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
const RELATIONSHIP_BASE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
const REVIEWED_RELATIONSHIPS = Object.freeze({
  "_rels/.rels": [["rId1", "officeDocument", "ppt/presentation.xml"]],
  "ppt/_rels/presentation.xml.rels": [
    ["rId1", "slideMaster", "slideMasters/slideMaster1.xml"],
    ["rId2", "presProps", "presProps.xml"],
    ["rId3", "slide", "slides/slide1.xml"],
    ["rId4", "theme", "theme/theme1.xml"]
  ],
  "ppt/slideLayouts/_rels/slideLayout1.xml.rels": [
    ["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]
  ],
  "ppt/slideMasters/_rels/slideMaster1.xml.rels": [
    ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
    ["rId2", "theme", "../theme/theme1.xml"]
  ],
  "ppt/slides/_rels/slide1.xml.rels": [
    ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"]
  ]
});
const REVIEWED_PART_CONTENT_TYPES = Object.freeze({
  "ppt/presProps.xml": "application/vnd.openxmlformats-officedocument.presentationml.presProps+xml",
  "ppt/slideLayouts/slideLayout1.xml": "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml",
  "ppt/slideMasters/slideMaster1.xml": "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml",
  "ppt/slides/slide1.xml": "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
  "ppt/theme/theme1.xml": "application/vnd.openxmlformats-officedocument.theme+xml"
});
const REVIEWED_DEFAULT_CONTENT_TYPES = Object.freeze([
  ["rels", "application/vnd.openxmlformats-package.relationships+xml"],
  ["xml", "application/xml"]
]);
const REVIEWED_OWNER_RELATIONSHIP_REFERENCES = Object.freeze({
  "ppt/presentation.xml": [
    ["p:sldMasterId", "id", "rId1"],
    ["p:sldId", "id", "rId3"]
  ],
  "ppt/slideMasters/slideMaster1.xml": [["p:sldLayoutId", "id", "rId1"]]
});
const HIGH_RISK_MARKERS = [
  /activeX/iu,
  /embeddedPackage/iu,
  /oleObject/iu,
  /TargetMode\s*=/iu,
  /vbaProject/iu,
  /<\s*(?:[A-Za-z_][A-Za-z0-9_.-]*:)?(?:control|oleObj)\b/iu
];
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const PACKAGE_VIEW_VERSION = "0.1.0";
const PACKAGE_VIEW_TYPE = "template-package-view";
const PACKAGE_VIEW_PRODUCER_CLASS = "reviewed-fixture-producer";

export class FixtureGenerationError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "FixtureGenerationError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new FixtureGenerationError(code, message);
}

function byteCompare(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function assertObject(value, label) {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    fail("invalid-manifest", `${label} must be an object`);
  }
}

function assertExactKeys(value, expected, label) {
  assertObject(value, label);
  const actual = Object.keys(value).sort(byteCompare);
  const wanted = [...expected].sort(byteCompare);
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail("invalid-manifest", `${label} fields must be exactly ${wanted.join(", ")}`);
  }
}

function assertCanonicalRelative(value, label) {
  if (typeof value !== "string" || value.length === 0 || Buffer.byteLength(value) > 240) {
    fail("unsafe-path", `${label} must be a short non-empty string`);
  }
  if (value.includes("\\") || value.startsWith("/") || /^[A-Za-z]:/u.test(value)) {
    fail("unsafe-path", `${label} must use a relative POSIX path`);
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    fail("unsafe-path", `${label} contains a forbidden path segment`);
  }
  if (path.posix.normalize(value) !== value) {
    fail("unsafe-path", `${label} is not canonical`);
  }
  return value;
}

function assertSortedUnique(items, select, label) {
  const values = items.map(select);
  const folded = new Set();
  for (const value of values) {
    const key = value.toLocaleLowerCase("en-US");
    if (folded.has(key)) {
      fail("duplicate-entry", `${label} contains duplicate or case-conflicting value ${value}`);
    }
    folded.add(key);
  }
  const sorted = [...values].sort(byteCompare);
  if (JSON.stringify(values) !== JSON.stringify(sorted)) {
    fail("nondeterministic-order", `${label} must be sorted by UTF-8 bytes`);
  }
}

function validateManifest(manifest) {
  assertExactKeys(manifest, [
    "schemaVersion",
    "fixtureId",
    "standardProfile",
    "fixedZipDate",
    "limits",
    "parts",
    "variants"
  ], "manifest");
  if (manifest.schemaVersion !== 1) {
    fail("invalid-manifest", "schemaVersion must be 1");
  }
  if (manifest.fixtureId !== "minimal-text-presentation") {
    fail("invalid-manifest", "fixtureId is not the reviewed fixture identifier");
  }
  if (manifest.standardProfile !== "ECMA-376 Transitional PresentationML") {
    fail("invalid-manifest", "standardProfile is not the reviewed profile");
  }
  if (manifest.fixedZipDate !== "2000-01-01T00:00:00Z") {
    fail("invalid-manifest", "fixedZipDate must remain the reviewed deterministic timestamp");
  }

  assertExactKeys(manifest.limits, ["maxPartBytes", "maxPackageBytes", "maxParts"], "limits");
  for (const [name, hardLimit] of Object.entries(HARD_LIMITS)) {
    const value = manifest.limits[name];
    if (!Number.isSafeInteger(value) || value < 1 || value > hardLimit) {
      fail("invalid-limit", `${name} must be a positive integer no greater than ${hardLimit}`);
    }
  }
  if (!Array.isArray(manifest.parts) || manifest.parts.length === 0 || manifest.parts.length > manifest.limits.maxParts) {
    fail("invalid-manifest", "parts must be a non-empty array within maxParts");
  }
  for (const [index, part] of manifest.parts.entries()) {
    assertExactKeys(part, ["path", "source", "template"], `parts[${index}]`);
    assertCanonicalRelative(part.path, `parts[${index}].path`);
    assertCanonicalRelative(part.source, `parts[${index}].source`);
    if (!part.path.endsWith(".xml") && !part.path.endsWith(".rels")) {
      fail("invalid-source-extension", `parts[${index}].path must be text XML or relationships data`);
    }
    if (part.source !== `parts/${part.path}`) {
      fail("unsafe-path", `parts[${index}].source must mirror its archive path under parts/`);
    }
    if (typeof part.template !== "boolean") {
      fail("invalid-manifest", `parts[${index}].template must be boolean`);
    }
  }
  assertSortedUnique(manifest.parts, (part) => part.path, "parts paths");
  assertSortedUnique(manifest.parts, (part) => part.source, "parts sources");
  if (JSON.stringify(manifest.parts.map((part) => part.path)) !== JSON.stringify(REVIEWED_PART_PATHS)) {
    fail("unreviewed-part-set", "parts must exactly match the independently reviewed source-part set");
  }
  const templates = manifest.parts.filter((part) => part.template);
  if (templates.length !== 1 || templates[0].path !== "[Content_Types].xml") {
    fail("invalid-template", "only [Content_Types].xml may be templated");
  }

  if (!Array.isArray(manifest.variants) || manifest.variants.length !== 2) {
    fail("invalid-manifest", "variants must contain the reviewed PPTX and POTX pair");
  }
  for (const [index, variant] of manifest.variants.entries()) {
    assertExactKeys(variant, ["id", "filename", "mainContentType"], `variants[${index}]`);
    if (!Object.hasOwn(MAIN_CONTENT_TYPES, variant.id)) {
      fail("invalid-variant", `variants[${index}].id is not reviewed`);
    }
    assertCanonicalRelative(variant.filename, `variants[${index}].filename`);
    if (variant.filename.includes("/") || !variant.filename.endsWith(`.${variant.id}`)) {
      fail("invalid-variant", `variants[${index}].filename must be a basename ending in .${variant.id}`);
    }
    if (variant.mainContentType !== MAIN_CONTENT_TYPES[variant.id]) {
      fail("invalid-variant", `variants[${index}] has an unreviewed main content type`);
    }
  }
  assertSortedUnique(manifest.variants, (variant) => variant.id, "variant IDs");
  assertSortedUnique(manifest.variants, (variant) => variant.filename, "variant filenames");
  if (manifest.variants.map((variant) => variant.id).join(",") !== "potx,pptx") {
    fail("invalid-variant", "variants must be exactly potx and pptx");
  }
  return manifest;
}

async function readRegularFile(filePath, displayPath, maxBytes) {
  let metadata;
  try {
    metadata = await lstat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail("missing-source", `${displayPath} does not exist`);
    }
    fail("source-read-failed", `${displayPath} metadata could not be read`);
  }
  if (metadata.isSymbolicLink()) {
    fail("source-symlink", `${displayPath} must not be a symbolic link`);
  }
  if (!metadata.isFile()) {
    fail("invalid-source-type", `${displayPath} must be a regular file`);
  }
  if (metadata.size > maxBytes) {
    fail("part-too-large", `${displayPath} exceeds maxPartBytes`);
  }
  try {
    return await readFile(filePath);
  } catch {
    fail("source-read-failed", `${displayPath} could not be read`);
  }
}

function decodeReviewedText(bytes, displayPath) {
  let text;
  try {
    text = UTF8_DECODER.decode(bytes);
  } catch {
    fail("invalid-text", `${displayPath} is not valid UTF-8`);
  }
  if (text.charCodeAt(0) === 0xfeff || text.includes("\0") || text.includes("\r")) {
    fail("invalid-text", `${displayPath} must be BOM-free UTF-8 with LF line endings`);
  }
  if (/<!DOCTYPE\b|<!ENTITY\b/iu.test(text)) {
    fail("unsafe-xml", `${displayPath} contains a forbidden XML declaration`);
  }
  for (const marker of HIGH_RISK_MARKERS) {
    if (marker.test(text)) {
      fail("high-risk-ooxml", `${displayPath} contains a forbidden OOXML marker`);
    }
  }
  return text;
}

async function listSourceFiles(directory, prefix = "") {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    fail("source-read-failed", `${prefix || "parts"} directory could not be read`);
  }
  const files = [];
  for (const entry of entries.sort((left, right) => byteCompare(left.name, right.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) {
      fail("source-symlink", `parts/${relative} must not be a symbolic link`);
    }
    if (entry.isDirectory()) {
      files.push(...await listSourceFiles(path.join(directory, entry.name), relative));
    } else if (entry.isFile()) {
      files.push(`parts/${relative}`);
    } else {
      fail("invalid-source-type", `parts/${relative} is not a regular file or directory`);
    }
  }
  return files;
}

function relationshipOwner(relsPath) {
  if (relsPath === "_rels/.rels") {
    return "";
  }
  const match = /^(.*\/)_rels\/([^/]+)\.rels$/u.exec(relsPath);
  if (!match) {
    fail("invalid-relationship-part", `${relsPath} is not in an OPC relationship location`);
  }
  return `${match[1]}${match[2]}`;
}

function xmlAttributes(fragment, displayPath) {
  const attributes = new Map();
  for (const match of fragment.matchAll(/([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/gu)) {
    if (attributes.has(match[1])) {
      fail("invalid-xml-attributes", `${displayPath} repeats attribute ${match[1]}`);
    }
    attributes.set(match[1], match[2]);
  }
  return attributes;
}

function assertCanonicalXmlContainer(text, rootName, namespace, childPattern, displayPath) {
  const opening = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<${rootName} xmlns="${namespace}">\n`;
  const closing = `</${rootName}>\n`;
  if (!text.startsWith(opening) || !text.endsWith(closing)) {
    fail("noncanonical-xml-container", `${displayPath} has an unreviewed root or XML declaration`);
  }
  const body = text.slice(opening.length, -closing.length);
  if (body.replace(childPattern, "").trim() !== "") {
    fail("noncanonical-xml-container", `${displayPath} contains an unreviewed child element or text`);
  }
}

function validateRelationships(parts) {
  const archivePaths = new Set(parts.keys());
  for (const [relsPath, text] of parts) {
    if (!relsPath.endsWith(".rels")) continue;
    const owner = relationshipOwner(relsPath);
    const ownerDirectory = owner === "" ? "" : path.posix.dirname(owner);
    const matches = [...text.matchAll(/<Relationship\b([^>]*)\/>/gu)];
    const relationshipOpenings = [...text.matchAll(
      /<(?:[A-Za-z_][A-Za-z0-9_.-]*:)?Relationship\b/gu
    )];
    if (matches.length !== relationshipOpenings.length) {
      fail("noncanonical-relationship-element", `${relsPath} contains a relationship outside the reviewed self-closing form`);
    }
    assertCanonicalXmlContainer(
      text,
      "Relationships",
      "http://schemas.openxmlformats.org/package/2006/relationships",
      /\s*<Relationship\b[^>]*\/>\s*/gu,
      relsPath
    );
    if (matches.length === 0) {
      fail("invalid-relationships", `${relsPath} must contain at least one relationship`);
    }
    const ids = new Set();
    const relationshipTuples = [];
    for (const match of matches) {
      const attributes = xmlAttributes(match[1], relsPath);
      const id = attributes.get("Id");
      const type = attributes.get("Type");
      const target = attributes.get("Target");
      if (!id || !type || !target || attributes.size !== 3) {
        fail("invalid-relationships", `${relsPath} relationship must contain only Id, Type, and Target`);
      }
      if (ids.has(id)) {
        fail("duplicate-relationship", `${relsPath} repeats relationship ID ${id}`);
      }
      ids.add(id);
      if (!type.startsWith(RELATIONSHIP_BASE)) {
        fail("unreviewed-relationship", `${relsPath} contains an unreviewed relationship type`);
      }
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(target) || target.startsWith("/") || target.includes("\\")) {
        fail("external-relationship", `${relsPath} contains an external or absolute target`);
      }
      let decodedTarget;
      try {
        decodedTarget = decodeURIComponent(target);
      } catch {
        fail("invalid-relationship-target", `${relsPath} contains an invalid encoded target`);
      }
      if (decodedTarget.includes("\0") || decodedTarget.includes("?") || decodedTarget.includes("#")) {
        fail("invalid-relationship-target", `${relsPath} contains a non-part target suffix`);
      }
      const resolved = path.posix.normalize(path.posix.join(ownerDirectory, decodedTarget));
      if (resolved === ".." || resolved.startsWith("../") || !archivePaths.has(resolved)) {
        fail("missing-relationship-target", `${relsPath} target does not resolve to a declared part`);
      }
      relationshipTuples.push([id, type.slice(RELATIONSHIP_BASE.length), target]);
    }
    if (JSON.stringify(relationshipTuples) !== JSON.stringify(REVIEWED_RELATIONSHIPS[relsPath])) {
      fail("unreviewed-relationship-graph", `${relsPath} differs from the reviewed minimal graph`);
    }
  }
  const actualRelationshipParts = [...parts.keys()].filter((partPath) => partPath.endsWith(".rels"));
  if (JSON.stringify(actualRelationshipParts) !== JSON.stringify(Object.keys(REVIEWED_RELATIONSHIPS))) {
    fail("unreviewed-relationship-graph", "relationship parts differ from the reviewed minimal graph");
  }
}

function validateOwnerRelationshipReferences(parts) {
  for (const [partPath, text] of parts) {
    if (partPath === "[Content_Types].xml" || partPath.endsWith(".rels")) continue;
    const references = [];
    for (const element of text.matchAll(/<([A-Za-z_][A-Za-z0-9_.:-]*)\b([^>]*)>/gu)) {
      for (const attribute of element[2].matchAll(/\br:([A-Za-z_][A-Za-z0-9_.-]*)="([^"]+)"/gu)) {
        references.push([element[1], attribute[1], attribute[2]]);
      }
    }
    const expected = REVIEWED_OWNER_RELATIONSHIP_REFERENCES[partPath] ?? [];
    if (JSON.stringify(references) !== JSON.stringify(expected)) {
      fail("unreviewed-owner-relationship-reference", `${partPath} differs from the reviewed owner relationship references`);
    }
  }
}

function validateContentTypes(parts, variant) {
  const text = parts.get("[Content_Types].xml");
  if (!text || text.includes(CONTENT_TYPE_TOKEN)) {
    fail("invalid-content-types", "[Content_Types].xml was not instantiated exactly once");
  }
  const defaultMatches = [...text.matchAll(/<Default\b([^>]*)\/>/gu)];
  const defaultOpenings = [...text.matchAll(/<(?:[A-Za-z_][A-Za-z0-9_.-]*:)?Default\b/gu)];
  if (defaultMatches.length !== defaultOpenings.length) {
    fail("noncanonical-content-type-element", "[Content_Types].xml contains a Default outside the reviewed self-closing form");
  }
  const defaults = defaultMatches.map((match) => {
    const attributes = xmlAttributes(match[1], "[Content_Types].xml");
    const extension = attributes.get("Extension");
    const contentType = attributes.get("ContentType");
    if (!extension || !contentType || attributes.size !== 2) {
      fail("invalid-content-types", "each Default must contain only Extension and ContentType");
    }
    return [extension, contentType];
  });
  if (JSON.stringify(defaults) !== JSON.stringify(REVIEWED_DEFAULT_CONTENT_TYPES)) {
    fail("unreviewed-default-content-types", "default content types differ from the reviewed minimal set");
  }

  const overrides = new Map();
  const matches = [...text.matchAll(/<Override\b([^>]*)\/>/gu)];
  const overrideOpenings = [...text.matchAll(/<(?:[A-Za-z_][A-Za-z0-9_.-]*:)?Override\b/gu)];
  if (matches.length !== overrideOpenings.length) {
    fail("noncanonical-content-type-element", "[Content_Types].xml contains an Override outside the reviewed self-closing form");
  }
  assertCanonicalXmlContainer(
    text,
    "Types",
    "http://schemas.openxmlformats.org/package/2006/content-types",
    /\s*<(?:Default|Override)\b[^>]*\/>\s*/gu,
    "[Content_Types].xml"
  );
  for (const match of matches) {
    const attributes = xmlAttributes(match[1], "[Content_Types].xml");
    const partName = attributes.get("PartName");
    const contentType = attributes.get("ContentType");
    if (!partName?.startsWith("/") || !contentType || attributes.size !== 2) {
      fail("invalid-content-types", "each Override must contain only PartName and ContentType");
    }
    const archivePath = partName.slice(1);
    assertCanonicalRelative(archivePath, "content-type PartName");
    if (overrides.has(archivePath)) {
      fail("duplicate-content-type", `${archivePath} has more than one content type`);
    }
    overrides.set(archivePath, contentType);
  }
  const expected = [...parts.keys()]
    .filter((partPath) => partPath !== "[Content_Types].xml" && !partPath.endsWith(".rels"))
    .sort(byteCompare);
  const actual = [...overrides.keys()].sort(byteCompare);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail("invalid-content-types", "content-type overrides must exactly cover non-relationship parts");
  }
  if (overrides.get("ppt/presentation.xml") !== variant.mainContentType) {
    fail("invalid-content-types", `${variant.id} has the wrong main content type`);
  }
  for (const [partPath, contentType] of Object.entries(REVIEWED_PART_CONTENT_TYPES)) {
    if (overrides.get(partPath) !== contentType) {
      fail("unreviewed-content-type", `${partPath} has an unreviewed content type`);
    }
  }
}

function normalizedInspectionAttribute(elementPath, name, value) {
  const tagName = elementPath.split("/").at(-1);
  if (name === "name" || name === "matchingName") return "@name";
  if (name === "id" && ["p:sldMasterId", "p:sldLayoutId", "p:sldId"].includes(tagName)) {
    return "@source-id";
  }
  if (name === "id" && tagName === "p:cNvPr" && elementPath.includes("/p:sp/")) {
    return "@source-id";
  }
  if (["cx", "cy"].includes(name) && tagName === "p:sldSz") return "@slide-size";
  if (elementPath.includes("/p:sp/") && elementPath.includes("/p:spPr/a:xfrm/") &&
      ((tagName === "a:off" && ["x", "y"].includes(name)) ||
       (tagName === "a:ext" && ["cx", "cy"].includes(name)))) {
    return "@shape-geometry";
  }
  return value;
}

function normalizedInspectionStructure(text, displayPath) {
  if (!text.startsWith(CANONICAL_XML_DECLARATION)) {
    fail("invalid-inspection-view", `${displayPath} has an unreviewed XML declaration`);
  }
  const body = text.slice(CANONICAL_XML_DECLARATION.length);
  const elementPattern = /<(\/?)(([A-Za-z_][A-Za-z0-9_.:-]*))\b([^>]*)>/gu;
  const attributePattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/gu;
  const stack = [];
  const tokens = [];
  let cursor = 0;
  for (const match of body.matchAll(elementPattern)) {
    const interstitial = body.slice(cursor, match.index);
    if (interstitial.trim() !== "") {
      if (stack.at(-1) !== "a:t") {
        fail("invalid-inspection-view", `${displayPath} has text outside the reviewed text node`);
      }
      tokens.push(JSON.stringify(["text"]));
    }

    const closing = match[1] === "/";
    const tagName = match[2];
    const fragment = match[4];
    if (closing) {
      if (fragment.trim() !== "" || stack.pop() !== tagName) {
        fail("invalid-inspection-view", `${displayPath} has mismatched element structure`);
      }
      tokens.push(JSON.stringify(["close", tagName]));
    } else {
      const attributes = [];
      const names = new Set();
      for (const attribute of fragment.matchAll(attributePattern)) {
        if (names.has(attribute[1])) {
          fail("invalid-inspection-view", `${displayPath} repeats an XML attribute`);
        }
        names.add(attribute[1]);
        const elementPath = [...stack, tagName].join("/");
        attributes.push([
          attribute[1],
          normalizedInspectionAttribute(elementPath, attribute[1], attribute[2])
        ]);
      }
      const residue = fragment.replace(attributePattern, "").trim();
      const selfClosing = residue === "/";
      if (residue !== "" && residue !== "/") {
        fail("invalid-inspection-view", `${displayPath} has an unreviewed XML tag form`);
      }
      attributes.sort((left, right) => byteCompare(left[0], right[0]));
      tokens.push(JSON.stringify([selfClosing ? "self" : "open", tagName, attributes]));
      if (!selfClosing) stack.push(tagName);
    }
    cursor = match.index + match[0].length;
  }
  if (body.slice(cursor).trim() !== "" || stack.length !== 0) {
    fail("invalid-inspection-view", `${displayPath} has incomplete element structure`);
  }
  return tokens.join("\n");
}

function validateInspectionVocabulary(parts) {
  const normalized = [];
  for (const partPath of REVIEWED_INSPECTION_CONTENT_PATHS) {
    const text = parts.get(partPath);
    if (typeof text !== "string") {
      fail("invalid-inspection-view", "the reviewed content-part set is incomplete");
    }
    normalized.push([partPath, normalizedInspectionStructure(text, partPath)]);
  }
  const digest = createHash("sha256")
    .update(normalized.map((record) => JSON.stringify(record)).join("\n"))
    .digest("hex");
  if (digest !== REVIEWED_INSPECTION_VOCABULARY_SHA256) {
    fail("invalid-inspection-view", "reviewed content contains an unmodeled structural feature");
  }
}

function parseUnsignedInteger(value, displayPath) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    fail("invalid-inspection-view", `${displayPath} is not an unsigned decimal integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    fail("invalid-inspection-view", `${displayPath} exceeds the reviewed numeric range`);
  }
  return parsed;
}

function matchingSelfClosingAttributes(text, tagName, displayPath) {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const matches = [...text.matchAll(new RegExp(`<${escapedTagName}\\b([^>]*)\\/>`, "gu"))];
  const openings = [...text.matchAll(new RegExp(`<${escapedTagName}\\b`, "gu"))];
  if (matches.length !== openings.length) {
    fail("invalid-inspection-view", `${displayPath} has a non-self-closing ${tagName}`);
  }
  return matches.map((match) => xmlAttributes(match[1], displayPath));
}

function oneSelfClosingAttributes(text, tagName, displayPath) {
  const matches = matchingSelfClosingAttributes(text, tagName, displayPath);
  if (matches.length !== 1) {
    fail("invalid-inspection-view", `${displayPath} must contain one ${tagName}`);
  }
  return matches[0];
}

function relationshipFacts() {
  return Object.entries(REVIEWED_RELATIONSHIPS).map(([relsPath, relationships]) => {
    const owner = relationshipOwner(relsPath);
    const ownerDirectory = owner === "" ? "" : path.posix.dirname(owner);
    return {
      ownerPart: owner === "" ? null : owner,
      relationships: relationships.map(([relationshipId, relationshipKind, target]) => ({
        relationshipId,
        relationshipType: `${RELATIONSHIP_BASE}${relationshipKind}`,
        targetPart: path.posix.normalize(path.posix.join(ownerDirectory, target))
      }))
    };
  });
}

function relationshipById(relationshipSets, ownerPart, relationshipId, expectedKind, displayPath) {
  const owner = relationshipSets.find((entry) => entry.ownerPart === ownerPart);
  const relationship = owner?.relationships.find((entry) => entry.relationshipId === relationshipId);
  if (!relationship || relationship.relationshipType !== `${RELATIONSHIP_BASE}${expectedKind}`) {
    fail("invalid-inspection-view", `${displayPath} does not resolve through the reviewed relationship graph`);
  }
  return relationship;
}

function parseReferenceElements(text, tagName, displayPath) {
  return matchingSelfClosingAttributes(text, tagName, displayPath).map((attributes) => {
    const sourceId = parseUnsignedInteger(attributes.get("id"), `${displayPath} ${tagName}@id`);
    const relationshipId = attributes.get("r:id");
    if (attributes.size !== 2 || !relationshipId) {
      fail("invalid-inspection-view", `${displayPath} ${tagName} has unreviewed attributes`);
    }
    return { sourceId, relationshipId };
  });
}

function parseShapeBlock(block, displayPath) {
  const nonVisual = oneSelfClosingAttributes(block, "p:cNvPr", displayPath);
  const sourceId = parseUnsignedInteger(nonVisual.get("id"), `${displayPath} p:cNvPr@id`);
  if (nonVisual.size !== 2 || !nonVisual.has("name")) {
    fail("invalid-inspection-view", `${displayPath} p:cNvPr has unreviewed attributes`);
  }
  const shapeProperties = oneSelfClosingAttributes(block, "p:cNvSpPr", displayPath);
  const placeholderMatches = matchingSelfClosingAttributes(block, "p:ph", displayPath);
  if (placeholderMatches.length > 1) {
    fail("invalid-inspection-view", `${displayPath} repeats placeholder metadata`);
  }
  let kind;
  let placeholder;
  if (placeholderMatches.length === 1) {
    const attributes = placeholderMatches[0];
    const type = attributes.get("type");
    const index = parseUnsignedInteger(attributes.get("idx"), `${displayPath} p:ph@idx`);
    if (shapeProperties.size !== 0 || attributes.size !== 2 || !type ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(type) || index > 65535) {
      fail("invalid-inspection-view", `${displayPath} has incomplete placeholder metadata`);
    }
    kind = "placeholder";
    placeholder = { type, index };
  } else if (shapeProperties.size === 1 && shapeProperties.get("txBox") === "1") {
    kind = "text-box";
  } else if (shapeProperties.size === 0) {
    kind = "auto-shape";
  } else {
    fail("invalid-inspection-view", `${displayPath} has unreviewed shape properties`);
  }
  if (kind !== "text-box" && /<p:txBody\b/gu.test(block)) {
    fail("invalid-inspection-view", `${displayPath} has text outside the reviewed text-box mapping`);
  }

  const transformOpenings = [...block.matchAll(/<a:xfrm\b/gu)];
  const transformMatches = [...block.matchAll(/<a:xfrm\b[^>]*>([\s\S]*?)<\/a:xfrm>/gu)];
  if (transformOpenings.length !== 1 || transformMatches.length !== 1) {
    fail("invalid-inspection-view", `${displayPath} must contain one explicit transform`);
  }
  const offset = oneSelfClosingAttributes(transformMatches[0][1], "a:off", displayPath);
  const extent = oneSelfClosingAttributes(transformMatches[0][1], "a:ext", displayPath);
  if (offset.size !== 2 || extent.size !== 2) {
    fail("invalid-inspection-view", `${displayPath} transform has unreviewed attributes`);
  }
  const geometry = {
    x: parseUnsignedInteger(offset.get("x"), `${displayPath} a:off@x`),
    y: parseUnsignedInteger(offset.get("y"), `${displayPath} a:off@y`),
    cx: parseUnsignedInteger(extent.get("cx"), `${displayPath} a:ext@cx`),
    cy: parseUnsignedInteger(extent.get("cy"), `${displayPath} a:ext@cy`)
  };
  if (geometry.cx < 1 || geometry.cy < 1) {
    fail("invalid-inspection-view", `${displayPath} shape extents must be positive`);
  }
  return placeholder
    ? { sourceId, kind, geometry, placeholder }
    : { sourceId, kind, geometry };
}

function parseShapes(text, displayPath) {
  const unsupported = [...text.matchAll(/<p:(?:cxnSp|graphicFrame|grpSp|pic)\b/gu)];
  if (unsupported.length !== 0) {
    fail("invalid-inspection-view", `${displayPath} contains a shape outside the reviewed view vocabulary`);
  }
  const openings = [...text.matchAll(/<p:sp\b/gu)];
  const blocks = [...text.matchAll(/<p:sp\b[^>]*>([\s\S]*?)<\/p:sp>/gu)];
  if (openings.length !== blocks.length) {
    fail("invalid-inspection-view", `${displayPath} has a noncanonical shape element`);
  }
  return blocks.map((match, index) => parseShapeBlock(match[1], `${displayPath} shape ${index + 1}`));
}

function buildInspectionViewData(parts, variant, archiveSha256) {
  validateInspectionVocabulary(parts);
  const relationshipSets = relationshipFacts();
  const contentParts = [...parts.keys()]
    .filter((partPath) => partPath !== "[Content_Types].xml" && !partPath.endsWith(".rels"))
    .map((partPath) => ({
      partPath,
      contentType: partPath === "ppt/presentation.xml"
        ? variant.mainContentType
        : REVIEWED_PART_CONTENT_TYPES[partPath]
    }));
  if (contentParts.some((part) => typeof part.contentType !== "string")) {
    fail("invalid-inspection-view", "a content part has no reviewed content type");
  }

  const presentationPart = relationshipById(
    relationshipSets,
    null,
    "rId1",
    "officeDocument",
    "package root"
  ).targetPart;
  const presentationText = parts.get(presentationPart);
  const slideSize = oneSelfClosingAttributes(presentationText, "p:sldSz", presentationPart);
  if (slideSize.size !== 3 || !slideSize.has("type")) {
    fail("invalid-inspection-view", `${presentationPart} has unreviewed slide-size attributes`);
  }
  const masterReferences = parseReferenceElements(presentationText, "p:sldMasterId", presentationPart);
  const slideReferences = parseReferenceElements(presentationText, "p:sldId", presentationPart);
  if (masterReferences.length === 0 || slideReferences.length === 0) {
    fail("invalid-inspection-view", `${presentationPart} must reference masters and slides`);
  }

  const masters = masterReferences.map((reference) => {
    const partPath = relationshipById(
      relationshipSets,
      presentationPart,
      reference.relationshipId,
      "slideMaster",
      presentationPart
    ).targetPart;
    const masterText = parts.get(partPath);
    if (parseShapes(masterText, partPath).length !== 0) {
      fail("invalid-inspection-view", `${partPath} contains master shapes not representable by TemplateIndex 0.1.0`);
    }
    return {
      partPath,
      layoutReferences: parseReferenceElements(masterText, "p:sldLayoutId", partPath)
    };
  });
  const layouts = masters.flatMap((master) => master.layoutReferences.map((reference) => {
    const partPath = relationshipById(
      relationshipSets,
      master.partPath,
      reference.relationshipId,
      "slideLayout",
      master.partPath
    ).targetPart;
    return { partPath, shapes: parseShapes(parts.get(partPath), partPath) };
  }));
  const slides = slideReferences.map((reference) => {
    const partPath = relationshipById(
      relationshipSets,
      presentationPart,
      reference.relationshipId,
      "slide",
      presentationPart
    ).targetPart;
    return { partPath, shapes: parseShapes(parts.get(partPath), partPath) };
  });
  const allShapes = [...layouts, ...slides].flatMap((entry) => entry.shapes);
  const observedFeatureIds = [
    "content-types-and-relationships",
    ...(allShapes.length > 0 ? ["drawingml-shapes"] : []),
    "masters-layouts-themes",
    "package-container",
    ...(allShapes.some((shape) => shape.kind === "text-box") ? ["slide-text"] : [])
  ].sort(byteCompare);

  return {
    viewVersion: PACKAGE_VIEW_VERSION,
    viewType: PACKAGE_VIEW_TYPE,
    producerClass: PACKAGE_VIEW_PRODUCER_CLASS,
    templateFormat: variant.id,
    archiveSha256,
    contentParts,
    relationshipSets,
    presentation: {
      partPath: presentationPart,
      slideSizeEmu: {
        cx: parseUnsignedInteger(slideSize.get("cx"), `${presentationPart} p:sldSz@cx`),
        cy: parseUnsignedInteger(slideSize.get("cy"), `${presentationPart} p:sldSz@cy`)
      },
      masterReferences,
      slideReferences
    },
    masters,
    layouts,
    slides,
    observedFeatureIds,
    unhandledFeatureIds: []
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function createReviewedFixturePackageView({ archive, sourceLocation } = {}) {
  if (archive === null || typeof archive !== "object" || Array.isArray(archive) ||
      archive.inspectionViewData === null || typeof archive.inspectionViewData !== "object" ||
      archive.inspectionViewData.archiveSha256 !== archive.sha256) {
    fail("invalid-inspection-view", "archive must be a product of buildSyntheticFixtures");
  }
  if (typeof sourceLocation !== "string" || sourceLocation.length === 0 ||
      !path.isAbsolute(sourceLocation) || /[\u0000-\u001f\u007f]/u.test(sourceLocation)) {
    fail("invalid-inspection-view", "sourceLocation must be an explicit absolute path");
  }
  const data = cloneJson(archive.inspectionViewData);
  return deepFreeze({
    viewVersion: data.viewVersion,
    viewType: data.viewType,
    producerClass: data.producerClass,
    sourceLocation: path.normalize(sourceLocation),
    templateFormat: data.templateFormat,
    archiveSha256: data.archiveSha256,
    contentParts: data.contentParts,
    relationshipSets: data.relationshipSets,
    presentation: data.presentation,
    masters: data.masters,
    layouts: data.layouts,
    slides: data.slides,
    observedFeatureIds: data.observedFeatureIds,
    unhandledFeatureIds: data.unhandledFeatureIds
  });
}

async function loadReviewedSources(sourceRoot) {
  const rootMetadata = await lstat(sourceRoot).catch(() => null);
  if (!rootMetadata || rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    fail("invalid-source-root", "fixture source root must be a real directory, not a symbolic link");
  }
  const manifestBytes = await readRegularFile(
    path.join(sourceRoot, "fixture.json"),
    "fixture.json",
    HARD_LIMITS.maxPartBytes
  );
  const manifestText = decodeReviewedText(manifestBytes, "fixture.json");
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    fail("invalid-manifest", "fixture.json is not valid JSON");
  }
  validateManifest(manifest);

  const declaredSources = manifest.parts.map((part) => part.source);
  const actualSources = await listSourceFiles(path.join(sourceRoot, "parts"));
  if (JSON.stringify(actualSources) !== JSON.stringify(declaredSources)) {
    fail("source-drift", "parts/ must contain exactly the sorted files declared by fixture.json");
  }

  const texts = new Map();
  let totalBytes = 0;
  for (const part of manifest.parts) {
    const bytes = await readRegularFile(
      path.join(sourceRoot, ...part.source.split("/")),
      part.source,
      manifest.limits.maxPartBytes
    );
    totalBytes += bytes.length;
    if (totalBytes > manifest.limits.maxPackageBytes) {
      fail("package-too-large", "declared source parts exceed maxPackageBytes");
    }
    const text = decodeReviewedText(bytes, part.source);
    const tokenCount = text.split(CONTENT_TYPE_TOKEN).length - 1;
    if ((part.template && tokenCount !== 1) || (!part.template && tokenCount !== 0)) {
      fail("invalid-template", `${part.source} has an unexpected template token count`);
    }
    texts.set(part.path, text);
  }
  return { manifest, texts };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function zipDateFields(isoDate) {
  const date = new Date(isoDate);
  const year = date.getUTCFullYear();
  const dosDate = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  const dosTime = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
  return { dosDate, dosTime };
}

function createStoredZip(entries, isoDate) {
  const { dosDate, dosTime } = zipDateFields(isoDate);
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, "utf8");
    const data = entry.bytes;
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localRecords.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralRecords.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localRecords, centralDirectory, end]);
}

export async function buildSyntheticFixtures({ sourceRoot = defaultFixtureSourceRoot } = {}) {
  if (typeof sourceRoot !== "string" || sourceRoot.length === 0) {
    fail("invalid-source-root", "fixture source root must be a non-empty path string");
  }
  const { manifest, texts } = await loadReviewedSources(path.resolve(sourceRoot));
  const archives = [];
  for (const variant of manifest.variants) {
    const entries = manifest.parts.map((part) => {
      let text = texts.get(part.path);
      if (part.template) {
        text = text.replace(CONTENT_TYPE_TOKEN, variant.mainContentType);
      }
      return { path: part.path, bytes: Buffer.from(text, "utf8") };
    });
    const partMap = new Map(entries.map((entry) => [entry.path, entry.bytes.toString("utf8")]));
    validateRelationships(partMap);
    validateOwnerRelationshipReferences(partMap);
    validateContentTypes(partMap, variant);
    const bytes = createStoredZip(entries, manifest.fixedZipDate);
    if (bytes.length > manifest.limits.maxPackageBytes) {
      fail("package-too-large", `${variant.id} archive exceeds maxPackageBytes`);
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    archives.push({
      variant: variant.id,
      filename: variant.filename,
      mainContentType: variant.mainContentType,
      bytes,
      sha256,
      inspectionViewData: deepFreeze(buildInspectionViewData(partMap, variant, sha256))
    });
  }
  return { fixtureId: manifest.fixtureId, archives };
}

async function destinationExists(destination) {
  try {
    await lstat(destination);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    fail("output-check-failed", "an output destination could not be checked");
  }
}

async function unlinkPublishedLinkIfOwned(stagePath, destination) {
  try {
    const [stageMetadata, destinationMetadata] = await Promise.all([
      lstat(stagePath),
      lstat(destination)
    ]);
    if (stageMetadata.dev === destinationMetadata.dev && stageMetadata.ino === destinationMetadata.ino) {
      await unlink(destination);
    }
  } catch {
    // A concurrently removed or replaced path is not owned by this invocation.
  }
}

export async function generateSyntheticFixtures({
  sourceRoot = defaultFixtureSourceRoot,
  outputDir
} = {}) {
  if (typeof outputDir !== "string" || outputDir.length === 0) {
    fail("invalid-output", "outputDir is required");
  }
  const built = await buildSyntheticFixtures({ sourceRoot });
  const resolvedOutput = path.resolve(outputDir);
  try {
    await mkdir(resolvedOutput, { recursive: true });
  } catch {
    fail("invalid-output", "outputDir could not be created as a directory");
  }
  let outputMetadata;
  try {
    outputMetadata = await lstat(resolvedOutput);
  } catch {
    fail("invalid-output", "outputDir metadata could not be read");
  }
  if (outputMetadata.isSymbolicLink() || !outputMetadata.isDirectory()) {
    fail("invalid-output", "outputDir must be a real directory, not a symbolic link");
  }

  const destinations = built.archives.map((archive) => path.join(resolvedOutput, archive.filename));
  for (const destination of destinations) {
    if (await destinationExists(destination)) {
      fail("output-exists", `${path.basename(destination)} already exists; generation is create-only`);
    }
  }

  const staged = [];
  const published = [];
  try {
    for (const archive of built.archives) {
      const stageName = `.${archive.filename}.stage-${process.pid}-${randomUUID()}`;
      const stagePath = path.join(resolvedOutput, stageName);
      const handle = await open(stagePath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o600);
      try {
        await handle.writeFile(archive.bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      staged.push(stagePath);
    }
    for (let index = 0; index < built.archives.length; index += 1) {
      await link(staged[index], destinations[index]);
      published.push({ stagePath: staged[index], destination: destinations[index] });
    }
    await Promise.all(staged.map((stagePath) => unlink(stagePath)));
  } catch (error) {
    await Promise.allSettled(published.map(({ stagePath, destination }) => (
      unlinkPublishedLinkIfOwned(stagePath, destination)
    )));
    await Promise.allSettled(staged.map((stagePath) => unlink(stagePath)));
    if (error instanceof FixtureGenerationError) throw error;
    if (error?.code === "EEXIST") {
      fail("output-exists", "an output appeared during atomic publication");
    }
    fail("output-write-failed", "staged output could not be atomically published");
  }

  return {
    schemaVersion: 1,
    fixtureId: built.fixtureId,
    files: built.archives.map((archive) => ({
      variant: archive.variant,
      filename: archive.filename,
      bytes: archive.bytes.length,
      sha256: archive.sha256
    }))
  };
}

async function runCli() {
  const { values } = parseArgs({
    options: {
      "output-dir": { type: "string", default: "fixtures/generated" }
    },
    strict: true,
    allowPositionals: false
  });
  const report = await generateSyntheticFixtures({ outputDir: values["output-dir"] });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runCli().catch((error) => {
    const message = error instanceof Error ? error.message : "unknown error";
    process.stderr.write(`fixture generation failed: ${message}\n`);
    process.exitCode = 1;
  });
}
