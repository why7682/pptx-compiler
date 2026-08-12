import { createHash } from "node:crypto";
import path from "node:path";

import { buildSecureTemplatePackageView } from "../../packages/core/src/ooxml-package-view.mjs";
import {
  SECURE_ZIP_LIMITS,
  parseSecureZip
} from "../../packages/core/src/secure-zip.mjs";
import { parseStrictXml } from "../../packages/core/src/strict-xml.mjs";
import {
  REVIEWED_CLONE_FILL_CATALOG_VERSION,
  compileReviewedCloneFillCatalog,
  selectAndAssembleReviewedCloneFillPresentation
} from "./reviewed-clone-fill-catalog.mjs";
import {
  LAYOUT_SELECTION_VERSION,
  selectTemplateLayout
} from "./layout-selector.mjs";

export const REVIEWED_PROFILE_INDUCTION_VERSION = "0.1.0";

const MAX_EXEMPLARS = 32;
const MAX_STRING_CODE_UNITS = 512;
const MAX_TEXT_CODE_UNITS = 16_384;
const MAX_XML_NODES = 50_000;
const MAX_JSON_NODES = 50_000;
const MAX_JSON_DEPTH = 128;
const MIN_PRIMARY_FONT_SIZE_HUNDREDTHS = 2_400;
const MIN_SUPPORTING_FONT_SIZE_HUNDREDTHS = 1_800;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_TEXT = /^(?=.*\S)(?!.*\p{Cf})(?!.*\p{Noncharacter_Code_Point})(?!.*[\uD800-\uDFFF])[^\u0000-\u001F\u007F-\u009F\u2028\u2029]+$/u;
const EVIDENCE_POLICIES = new Set(["none", "optional", "required"]);
const SLOT_KINDS = new Set(["metric", "text"]);
const CLONE_FILL_ROLES = new Set(["body", "title"]);
const DECISION_STATUSES = new Set(["accepted", "rejected"]);
const VISUAL_ROLES = new Set(["primary", "supporting"]);
const NS = Object.freeze({
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main"
});
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer"
).get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength"
).get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset"
).get;

export class ReviewedProfileInductionError extends Error {
  constructor(pointer) {
    super(`REVIEWED_PROFILE_INDUCTION_INVALID at ${pointer}`);
    this.name = "ReviewedProfileInductionError";
    this.code = "REVIEWED_PROFILE_INDUCTION_INVALID";
    this.pointer = pointer;
  }
}

function fail(pointer) {
  throw new ReviewedProfileInductionError(pointer);
}

function compareCodeUnits(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function closedRecord(value, pointer, expectedKeys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(pointer);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(pointer);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string") || keys.length !== expectedKeys.length) {
    fail(pointer);
  }
  const fields = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(`${pointer}/${key}`);
    }
    fields[key] = descriptor.value;
  }
  return fields;
}

function arrayValues(value, pointer, minimum, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail(pointer);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const lengthDescriptor = descriptors.length;
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < minimum || lengthDescriptor.value > maximum) {
    fail(`${pointer}/length`);
  }
  const length = lengthDescriptor.value;
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== length + 1 || keys.some((key) => {
    if (key === "length") return false;
    if (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key)) return true;
    const descriptor = descriptors[key];
    return Number(key) >= length || !("value" in descriptor) || descriptor.enumerable !== true;
  })) {
    fail(pointer);
  }
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor)) fail(`${pointer}/${index}`);
    result.push(descriptor.value);
  }
  return result;
}

function semanticId(value, pointer) {
  if (typeof value !== "string" || value.length < 1 || value.length > 96 ||
      !SEMANTIC_ID.test(value)) {
    fail(pointer);
  }
  return value;
}

function digest(value, pointer) {
  if (typeof value !== "string" || !SHA256.test(value)) fail(pointer);
  return value;
}

function safeString(value, pointer, maximum = MAX_STRING_CODE_UNITS) {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum ||
      value.trim() !== value || !SAFE_TEXT.test(value)) {
    fail(pointer);
  }
  return value;
}

function boundedInteger(value, pointer, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(pointer);
  return value;
}

function stringArray(value, pointer, { minimum = 1, maximum = 32 } = {}) {
  const items = arrayValues(value, pointer, minimum, maximum)
    .map((item, index) => semanticId(item, `${pointer}/${index}`));
  if (new Set(items).size !== items.length) fail(pointer);
  return items;
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function snapshotJson(value, pointer, state = { nodes: 0 }, depth = 0) {
  state.nodes += 1;
  if (state.nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) fail(pointer);
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(pointer);
    return value;
  }
  if (typeof value !== "object") fail(pointer);
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) fail(pointer);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const lengthDescriptor = descriptors.length;
    if (lengthDescriptor === undefined || !("value" in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 ||
        lengthDescriptor.value > MAX_JSON_NODES) {
      fail(`${pointer}/length`);
    }
    const length = lengthDescriptor.value;
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length !== length + 1 || keys.some((key) => {
      if (key === "length") return false;
      if (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key)) return true;
      const descriptor = descriptors[key];
      return Number(key) >= length || !("value" in descriptor) || descriptor.enumerable !== true;
    })) {
      fail(pointer);
    }
    return Object.freeze(Array.from({ length }, (_, index) => {
      const descriptor = descriptors[String(index)];
      if (descriptor === undefined || !("value" in descriptor)) fail(`${pointer}/${index}`);
      return snapshotJson(descriptor.value, `${pointer}/${index}`, state, depth + 1);
    }));
  }
  if (prototype !== Object.prototype && prototype !== null) fail(pointer);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length > MAX_JSON_NODES || keys.some((key) => {
    if (typeof key !== "string") return true;
    const descriptor = descriptors[key];
    return !("value" in descriptor) || descriptor.enumerable !== true;
  })) {
    fail(pointer);
  }
  const result = Object.create(null);
  for (const key of keys.sort(compareCodeUnits)) {
    result[key] = snapshotJson(descriptors[key].value, `${pointer}/${key}`, state, depth + 1);
  }
  return Object.freeze(result);
}

function snapshotArchiveBytes(value, pointer) {
  if (!(value instanceof Uint8Array)) fail(pointer);
  let backingBuffer;
  let byteLength;
  let byteOffset;
  try {
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch {
    fail(pointer);
  }
  if (!Number.isSafeInteger(byteLength) || byteLength < 1 ||
      byteLength > SECURE_ZIP_LIMITS.maxArchiveBytes ||
      !Number.isSafeInteger(byteOffset) || byteOffset < 0) {
    fail(pointer);
  }
  try {
    return Buffer.from(new Uint8Array(backingBuffer, byteOffset, byteLength));
  } catch {
    fail(pointer);
  }
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort(compareCodeUnits)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), "utf8"));
}

function sameGeometry(left, right) {
  return left.x === right.x && left.y === right.y && left.cx === right.cx && left.cy === right.cy;
}

function parseGeometry(value, pointer, slideSize) {
  const fields = closedRecord(value, pointer, ["cx", "cy", "x", "y"]);
  const geometry = {
    x: boundedInteger(fields.x, `${pointer}/x`, 0, slideSize.cx),
    y: boundedInteger(fields.y, `${pointer}/y`, 0, slideSize.cy),
    cx: boundedInteger(fields.cx, `${pointer}/cx`, 1, slideSize.cx),
    cy: boundedInteger(fields.cy, `${pointer}/cy`, 1, slideSize.cy)
  };
  if (geometry.x + geometry.cx > slideSize.cx || geometry.y + geometry.cy > slideSize.cy) {
    fail(pointer);
  }
  return geometry;
}

function millionths(value, total) {
  return Number((BigInt(value) * 1_000_000n) / BigInt(total));
}

function regionMillionths(geometry, slideSize) {
  return [
    millionths(geometry.x, slideSize.cx),
    millionths(geometry.y, slideSize.cy),
    millionths(geometry.cx, slideSize.cx),
    millionths(geometry.cy, slideSize.cy)
  ];
}

function parseRelevantIndex(templateIndex, sourceView, archiveSha, pointer) {
  const fields = closedRecord(templateIndex, pointer, [
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
  ]);
  if (fields.schemaVersion !== "0.1.0" || fields.contractType !== "template-index" ||
      fields.templateFormat !== "potx" || sourceView.templateFormat !== "potx" ||
      digest(fields.templateSha256, `${pointer}/templateSha256`) !== archiveSha ||
      sourceView.archiveSha256 !== archiveSha ||
      fields.presentationPart !== sourceView.presentation.partPath) {
    fail(pointer);
  }
  const slideSizeFields = closedRecord(fields.slideSizeEmu, `${pointer}/slideSizeEmu`, ["cx", "cy"]);
  const slideSize = {
    cx: boundedInteger(slideSizeFields.cx, `${pointer}/slideSizeEmu/cx`, 1, 1_000_000_000),
    cy: boundedInteger(slideSizeFields.cy, `${pointer}/slideSizeEmu/cy`, 1, 1_000_000_000)
  };
  if (slideSize.cx !== sourceView.presentation.slideSizeEmu.cx ||
      slideSize.cy !== sourceView.presentation.slideSizeEmu.cy) {
    fail(`${pointer}/slideSizeEmu`);
  }
  const slides = arrayValues(fields.slides, `${pointer}/slides`, 1, 1);
  const slideFields = closedRecord(slides[0], `${pointer}/slides/0`, [
    "layoutKey", "partPath", "shapes", "slideKey", "sourceId"
  ]);
  if (sourceView.slides.length !== 1) fail(`${pointer}/slides/0`);
  const viewSlide = sourceView.slides[0];
  if (slideFields.partPath !== viewSlide.partPath) {
    fail(`${pointer}/slides/0`);
  }
  const indexedShapes = arrayValues(slideFields.shapes, `${pointer}/slides/0/shapes`, 2, 2)
    .map((shape, index) => {
      const shapePointer = `${pointer}/slides/0/shapes/${index}`;
      const shapeFields = closedRecord(shape, shapePointer, [
        "geometry", "kind", "shapeKey", "sourceId"
      ]);
      if (shapeFields.kind !== "text-box") fail(`${shapePointer}/kind`);
      return {
        shapeKey: semanticId(shapeFields.shapeKey, `${shapePointer}/shapeKey`),
        sourceId: boundedInteger(shapeFields.sourceId, `${shapePointer}/sourceId`, 1, 4_294_967_295),
        kind: shapeFields.kind,
        geometry: parseGeometry(shapeFields.geometry, `${shapePointer}/geometry`, slideSize)
      };
    });
  if (new Set(indexedShapes.map((shape) => shape.sourceId)).size !== indexedShapes.length ||
      viewSlide.shapes.length !== indexedShapes.length || indexedShapes.some((shape, index) => {
    const observed = viewSlide.shapes[index];
    return observed.sourceId !== shape.sourceId || observed.kind !== shape.kind ||
      !sameGeometry(observed.geometry, shape.geometry);
  }) || new Set(indexedShapes.map((shape) => shape.shapeKey)).size !== indexedShapes.length) {
    fail(`${pointer}/slides/0/shapes`);
  }
  return {
    templateIndexId: semanticId(fields.templateIndexId, `${pointer}/templateIndexId`),
    templateSha256: archiveSha,
    sourceSlideKey: semanticId(slideFields.slideKey, `${pointer}/slides/0/slideKey`),
    slidePartPath: safeString(slideFields.partPath, `${pointer}/slides/0/partPath`, 240),
    slideSize,
    shapes: indexedShapes
  };
}

function findNodes(root, namespaceURI, localName) {
  const result = [];
  const stack = [root];
  let visited = 0;
  while (stack.length > 0) {
    const node = stack.pop();
    visited += 1;
    if (visited > MAX_XML_NODES) fail("/exemplars/xml");
    if (node.namespaceURI === namespaceURI && node.localName === localName) result.push(node);
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push(node.children[index]);
    }
  }
  return result;
}

function attribute(node, localName) {
  return node.attributes.get(`\u0000${localName}`)?.value;
}

function oneDescendant(node, namespaceURI, localName, pointer) {
  const matches = findNodes(node, namespaceURI, localName);
  if (matches.length !== 1) fail(pointer);
  return matches[0];
}

function parseAlignment(value, pointer) {
  const alignments = new Map([
    ["ctr", "center"],
    ["l", "left"],
    ["r", "right"],
    ["just", "justify"]
  ]);
  const result = alignments.get(value);
  if (result === undefined) fail(pointer);
  return result;
}

function extractTypography(archiveBytes, indexFacts, pointer) {
  const parts = parseSecureZip(archiveBytes);
  const slideBytes = parts.get(indexFacts.slidePartPath);
  if (slideBytes === undefined) fail(`${pointer}/sourceArchiveBytes`);
  const document = parseStrictXml(slideBytes);
  const shapes = findNodes(document.root, NS.p, "sp");
  if (shapes.length !== indexFacts.shapes.length) fail(`${pointer}/sourceArchiveBytes`);
  const bySourceId = new Map();
  for (let index = 0; index < shapes.length; index += 1) {
    const shapePointer = `${pointer}/sourceArchiveBytes/shapes/${index}`;
    const shape = shapes[index];
    const cNvPr = oneDescendant(shape, NS.p, "cNvPr", `${shapePointer}/sourceId`);
    const sourceIdText = attribute(cNvPr, "id");
    if (typeof sourceIdText !== "string" || !/^[1-9][0-9]*$/u.test(sourceIdText)) {
      fail(`${shapePointer}/sourceId`);
    }
    const sourceId = boundedInteger(Number(sourceIdText), `${shapePointer}/sourceId`, 1, 4_294_967_295);
    const run = oneDescendant(shape, NS.a, "r", `${shapePointer}/run`);
    const runProperties = oneDescendant(run, NS.a, "rPr", `${shapePointer}/runProperties`);
    const fontSizeText = attribute(runProperties, "sz");
    if (typeof fontSizeText !== "string" || !/^[1-9][0-9]*$/u.test(fontSizeText)) {
      fail(`${shapePointer}/fontSizeHundredths`);
    }
    const fontSizeHundredths = boundedInteger(
      Number(fontSizeText),
      `${shapePointer}/fontSizeHundredths`,
      100,
      40_000
    );
    const boldText = attribute(runProperties, "b");
    if (boldText !== undefined && boldText !== "0" && boldText !== "1") {
      fail(`${shapePointer}/bold`);
    }
    const paragraphProperties = oneDescendant(shape, NS.a, "pPr", `${shapePointer}/alignment`);
    const alignment = parseAlignment(attribute(paragraphProperties, "algn"), `${shapePointer}/alignment`);
    if (bySourceId.has(sourceId)) fail(`${shapePointer}/sourceId`);
    bySourceId.set(sourceId, {
      fontSizeHundredths,
      bold: boldText === "1",
      alignment
    });
  }
  return indexFacts.shapes.map((shape, sourceOrder) => {
    const typography = bySourceId.get(shape.sourceId);
    if (typography === undefined) fail(`${pointer}/sourceArchiveBytes/shapes`);
    return { ...shape, sourceOrder, typography };
  });
}

function estimatedMaxChars(geometry, fontSizeHundredths) {
  const fontEmu = BigInt(fontSizeHundredths) * 127n;
  const averageCharacterWidth = (fontEmu * 11n + 19n) / 20n;
  const lineHeight = (fontEmu * 6n + 4n) / 5n;
  const columns = BigInt(geometry.cx) / averageCharacterWidth;
  const rows = BigInt(geometry.cy) / lineHeight;
  const estimate = columns * (rows < 1n ? 1n : rows);
  return Number(estimate > 100_000n ? 100_000n : estimate < 1n ? 1n : estimate);
}

function compareSalience(left, right) {
  if (left.typography.fontSizeHundredths !== right.typography.fontSizeHundredths) {
    return right.typography.fontSizeHundredths - left.typography.fontSizeHundredths;
  }
  if (left.typography.bold !== right.typography.bold) return left.typography.bold ? -1 : 1;
  const leftArea = BigInt(left.geometry.cx) * BigInt(left.geometry.cy);
  const rightArea = BigInt(right.geometry.cx) * BigInt(right.geometry.cy);
  if (leftArea !== rightArea) return leftArea > rightArea ? -1 : 1;
  if (left.geometry.y !== right.geometry.y) return left.geometry.y - right.geometry.y;
  return left.sourceOrder - right.sourceOrder;
}

function hierarchyConfidence(ranked) {
  const primary = ranked[0];
  const supporting = ranked[1];
  const primarySize = primary.typography.fontSizeHundredths;
  const supportingSize = supporting.typography.fontSizeHundredths;
  if (primarySize * 100 >= supportingSize * 125) return "clear";
  if (primarySize * 100 >= supportingSize * 110 &&
      primary.typography.bold && !supporting.typography.bold) {
    return "clear";
  }
  return "ambiguous";
}

function makeProposal(exemplarId, indexFacts, observedShapes) {
  const ranked = [...observedShapes].sort(compareSalience);
  const rankBySourceId = new Map(ranked.map((shape, index) => [shape.sourceId, index + 1]));
  const candidates = observedShapes.map((shape) => {
    const salienceRank = rankBySourceId.get(shape.sourceId);
    return {
      candidateId: semanticId(
        `${exemplarId}-candidate-${shape.sourceOrder + 1}`,
        "/proposal/candidateId"
      ),
      sourceShapeKey: shape.shapeKey,
      sourceOrder: shape.sourceOrder,
      geometryEmu: { ...shape.geometry },
      regionMillionths: regionMillionths(shape.geometry, indexFacts.slideSize),
      typography: { ...shape.typography },
      salienceRank,
      suggestedRole: salienceRank === 1 ? "takeaway" : "evidence",
      estimatedMaxChars: estimatedMaxChars(shape.geometry, shape.typography.fontSizeHundredths)
    };
  });
  const core = {
    inductionVersion: REVIEWED_PROFILE_INDUCTION_VERSION,
    exemplarId,
    templateIndexId: indexFacts.templateIndexId,
    templateSha256: indexFacts.templateSha256,
    sourceSlideKey: indexFacts.sourceSlideKey,
    hierarchyConfidence: hierarchyConfidence(ranked),
    salienceBasis: ["font-size", "bold-emphasis", "occupied-area", "vertical-position", "source-order"],
    candidates
  };
  return { ...core, proposalSha256: sha256Json(core) };
}

function captureExemplar(value, index) {
  const pointer = `/exemplars/${index}`;
  const fields = closedRecord(value, pointer, ["exemplarId", "sourceArchiveBytes", "templateIndex"]);
  const exemplarId = semanticId(fields.exemplarId, `${pointer}/exemplarId`);
  const sourceArchiveBytes = snapshotArchiveBytes(
    fields.sourceArchiveBytes,
    `${pointer}/sourceArchiveBytes`
  );
  const templateIndex = snapshotJson(fields.templateIndex, `${pointer}/templateIndex`);
  let sourceView;
  try {
    sourceView = buildSecureTemplatePackageView({
      sourceLocation: path.join(path.parse(process.execPath).root, "synthetic-profile-exemplar.potx"),
      archiveBytes: sourceArchiveBytes
    });
  } catch {
    fail(`${pointer}/sourceArchiveBytes`);
  }
  const archiveSha = sha256Bytes(sourceArchiveBytes);
  const indexFacts = parseRelevantIndex(templateIndex, sourceView, archiveSha, `${pointer}/templateIndex`);
  let observedShapes;
  try {
    observedShapes = extractTypography(sourceArchiveBytes, indexFacts, pointer);
  } catch (error) {
    if (error instanceof ReviewedProfileInductionError) throw error;
    fail(`${pointer}/sourceArchiveBytes`);
  }
  return {
    exemplarId,
    sourceArchiveBytes,
    templateIndex,
    proposal: makeProposal(exemplarId, indexFacts, observedShapes)
  };
}

function induceInternal(options) {
  const optionFields = closedRecord(options, "/options", ["exemplars"]);
  const exemplars = arrayValues(optionFields.exemplars, "/exemplars", 2, MAX_EXEMPLARS)
    .map(captureExemplar)
    .sort((left, right) => compareCodeUnits(left.exemplarId, right.exemplarId));
  if (new Set(exemplars.map((item) => item.exemplarId)).size !== exemplars.length ||
      new Set(exemplars.map((item) => item.proposal.templateSha256)).size !== exemplars.length ||
      new Set(exemplars.map((item) => item.proposal.templateIndexId)).size !== exemplars.length) {
    fail("/exemplars");
  }
  const proposalCore = {
    inductionVersion: REVIEWED_PROFILE_INDUCTION_VERSION,
    proposals: exemplars.map((item) => item.proposal)
  };
  const proposalSet = deepFreeze({
    ...proposalCore,
    proposalSetSha256: sha256Json(proposalCore)
  });
  return { exemplars, proposalSet };
}

/**
 * Derive only redacted, reviewable structural/style evidence. Source wording,
 * font names, archive bytes, and semantic acceptance do not cross this API.
 */
export function induceCloneFillProfileProposals(options) {
  return induceInternal(options).proposalSet;
}

function parseAcceptedProfile(value, pointer, proposal) {
  if (proposal.hierarchyConfidence !== "clear") fail(`${pointer}/profile`);
  const fields = closedRecord(value, `${pointer}/profile`, [
    "functions", "layoutId", "slots", "sourceSlideKey"
  ]);
  if (semanticId(fields.sourceSlideKey, `${pointer}/profile/sourceSlideKey`) !==
      proposal.sourceSlideKey) {
    fail(`${pointer}/profile/sourceSlideKey`);
  }
  const candidates = new Map(proposal.candidates.map((candidate) => [candidate.candidateId, candidate]));
  const slots = arrayValues(fields.slots, `${pointer}/profile/slots`, 2, 2).map((slot, index) => {
    const slotPointer = `${pointer}/profile/slots/${index}`;
    const slotFields = closedRecord(slot, slotPointer, [
      "acceptsRoles",
      "candidateId",
      "capacity",
      "cloneFillRole",
      "kind",
      "maxUnits",
      "minUnits",
      "slotId",
      "sourceShapeKey",
      "visualRole"
    ]);
    const candidateId = semanticId(slotFields.candidateId, `${slotPointer}/candidateId`);
    const candidate = candidates.get(candidateId);
    if (candidate === undefined ||
        semanticId(slotFields.sourceShapeKey, `${slotPointer}/sourceShapeKey`) !==
          candidate.sourceShapeKey) {
      fail(`${slotPointer}/candidateId`);
    }
    const visualRole = semanticId(slotFields.visualRole, `${slotPointer}/visualRole`);
    if (!VISUAL_ROLES.has(visualRole) ||
        visualRole !== (candidate.salienceRank === 1 ? "primary" : "supporting")) {
      fail(`${slotPointer}/visualRole`);
    }
    const minimumFontSize = visualRole === "primary"
      ? MIN_PRIMARY_FONT_SIZE_HUNDREDTHS
      : MIN_SUPPORTING_FONT_SIZE_HUNDREDTHS;
    if (candidate.typography.fontSizeHundredths < minimumFontSize) {
      fail(`${slotPointer}/visualRole`);
    }
    const acceptsRoles = stringArray(slotFields.acceptsRoles, `${slotPointer}/acceptsRoles`, {
      minimum: 1,
      maximum: 1
    });
    const requiredRole = visualRole === "primary" ? "takeaway" : "evidence";
    if (acceptsRoles[0] !== requiredRole) fail(`${slotPointer}/acceptsRoles`);
    const kind = semanticId(slotFields.kind, `${slotPointer}/kind`);
    if (!SLOT_KINDS.has(kind)) fail(`${slotPointer}/kind`);
    const capacityFields = closedRecord(slotFields.capacity, `${slotPointer}/capacity`, ["maxChars"]);
    const maxChars = boundedInteger(
      capacityFields.maxChars,
      `${slotPointer}/capacity/maxChars`,
      kind === "metric" ? 4 : 1,
      candidate.estimatedMaxChars
    );
    const cloneFillRole = semanticId(slotFields.cloneFillRole, `${slotPointer}/cloneFillRole`);
    if (!CLONE_FILL_ROLES.has(cloneFillRole) ||
        cloneFillRole !== (visualRole === "primary" ? "title" : "body")) {
      fail(`${slotPointer}/cloneFillRole`);
    }
    boundedInteger(slotFields.minUnits, `${slotPointer}/minUnits`, 1, 1);
    boundedInteger(slotFields.maxUnits, `${slotPointer}/maxUnits`, 1, 1);
    return {
      slotId: semanticId(slotFields.slotId, `${slotPointer}/slotId`),
      sourceShapeKey: candidate.sourceShapeKey,
      cloneFillRole,
      acceptsRoles,
      kind,
      minUnits: 1,
      maxUnits: 1,
      capacity: { maxChars }
    };
  });
  if (new Set(slots.map((slot) => slot.sourceShapeKey)).size !== slots.length ||
      new Set(slots.map((slot) => slot.slotId)).size !== slots.length ||
      new Set(slots.map((slot) => slot.cloneFillRole)).size !== slots.length) {
    fail(`${pointer}/profile/slots`);
  }
  return {
    layoutId: semanticId(fields.layoutId, `${pointer}/profile/layoutId`),
    sourceSlideKey: proposal.sourceSlideKey,
    functions: stringArray(fields.functions, `${pointer}/profile/functions`),
    slots
  };
}

function parseAcceptance(value, proposalSet) {
  const fields = closedRecord(value, "/acceptance", [
    "acceptanceVersion", "decisions", "proposalSetSha256"
  ]);
  if (fields.acceptanceVersion !== REVIEWED_PROFILE_INDUCTION_VERSION ||
      digest(fields.proposalSetSha256, "/acceptance/proposalSetSha256") !==
        proposalSet.proposalSetSha256) {
    fail("/acceptance");
  }
  const proposalById = new Map(proposalSet.proposals.map((proposal) => [proposal.exemplarId, proposal]));
  const decisions = arrayValues(
    fields.decisions,
    "/acceptance/decisions",
    proposalSet.proposals.length,
    proposalSet.proposals.length
  ).map((decision, index) => {
    const pointer = `/acceptance/decisions/${index}`;
    const decisionFields = closedRecord(decision, pointer, [
      "exemplarId", "profile", "proposalSha256", "reasonCode", "status"
    ]);
    const exemplarId = semanticId(decisionFields.exemplarId, `${pointer}/exemplarId`);
    const proposal = proposalById.get(exemplarId);
    if (proposal === undefined ||
        digest(decisionFields.proposalSha256, `${pointer}/proposalSha256`) !==
          proposal.proposalSha256) {
      fail(pointer);
    }
    const status = semanticId(decisionFields.status, `${pointer}/status`);
    if (!DECISION_STATUSES.has(status)) fail(`${pointer}/status`);
    if (status === "rejected") {
      if (decisionFields.profile !== null) fail(`${pointer}/profile`);
      return {
        exemplarId,
        proposal,
        status,
        reasonCode: semanticId(decisionFields.reasonCode, `${pointer}/reasonCode`),
        profile: null
      };
    }
    if (decisionFields.reasonCode !== null) fail(`${pointer}/reasonCode`);
    return {
      exemplarId,
      proposal,
      status,
      reasonCode: null,
      profile: parseAcceptedProfile(decisionFields.profile, pointer, proposal)
    };
  });
  if (new Set(decisions.map((decision) => decision.exemplarId)).size !== decisions.length ||
      decisions.some((decision) => !proposalById.has(decision.exemplarId)) ||
      new Set(decisions.filter((decision) => decision.profile !== null)
        .map((decision) => decision.profile.layoutId)).size !==
        decisions.filter((decision) => decision.profile !== null).length ||
      decisions.every((decision) => decision.status === "rejected")) {
    fail("/acceptance/decisions");
  }
  return decisions.sort((left, right) => compareCodeUnits(left.exemplarId, right.exemplarId));
}

function parseBrief(value) {
  const fields = closedRecord(value, "/brief", [
    "audienceGoal",
    "availableAssetIds",
    "briefVersion",
    "evidencePolicy",
    "function",
    "primaryTakeawayUnitId",
    "slideId",
    "units"
  ]);
  if (fields.briefVersion !== LAYOUT_SELECTION_VERSION) fail("/brief/briefVersion");
  const availableAssetIds = arrayValues(fields.availableAssetIds, "/brief/availableAssetIds", 0, 0);
  const evidencePolicy = semanticId(fields.evidencePolicy, "/brief/evidencePolicy");
  if (!EVIDENCE_POLICIES.has(evidencePolicy)) fail("/brief/evidencePolicy");
  const units = arrayValues(fields.units, "/brief/units", 2, 2).map((unit, index) => {
    const pointer = `/brief/units/${index}`;
    const unitFields = closedRecord(unit, pointer, ["content", "kind", "role", "unitId"]);
    const kind = semanticId(unitFields.kind, `${pointer}/kind`);
    if (!SLOT_KINDS.has(kind)) fail(`${pointer}/kind`);
    let content;
    if (kind === "text") {
      content = safeString(unitFields.content, `${pointer}/content`, MAX_TEXT_CODE_UNITS);
    } else {
      const contentFields = closedRecord(unitFields.content, `${pointer}/content`, ["label", "value"]);
      content = {
        label: safeString(contentFields.label, `${pointer}/content/label`, MAX_TEXT_CODE_UNITS),
        value: safeString(contentFields.value, `${pointer}/content/value`, MAX_TEXT_CODE_UNITS)
      };
    }
    return {
      unitId: semanticId(unitFields.unitId, `${pointer}/unitId`),
      role: semanticId(unitFields.role, `${pointer}/role`),
      kind,
      content
    };
  });
  if (new Set(units.map((unit) => unit.unitId)).size !== units.length) fail("/brief/units");
  const primaryTakeawayUnitId = semanticId(
    fields.primaryTakeawayUnitId,
    "/brief/primaryTakeawayUnitId"
  );
  const primary = units.find((unit) => unit.unitId === primaryTakeawayUnitId);
  if (primary === undefined || primary.role !== "takeaway") fail("/brief/primaryTakeawayUnitId");
  const evidenceCount = units.filter((unit) => unit.role === "evidence").length;
  if ((evidencePolicy === "required" && evidenceCount !== 1) ||
      (evidencePolicy === "none" && evidenceCount !== 0)) {
    fail("/brief/evidencePolicy");
  }
  return deepFreeze({
    briefVersion: fields.briefVersion,
    slideId: semanticId(fields.slideId, "/brief/slideId"),
    function: semanticId(fields.function, "/brief/function"),
    audienceGoal: safeString(fields.audienceGoal, "/brief/audienceGoal", 4_096),
    availableAssetIds,
    evidencePolicy,
    primaryTakeawayUnitId,
    units
  });
}

function selectorReadyLayout(layout) {
  if (layout.slots.some((slot) => slot.kind === "metric" && slot.capacity.maxChars <= 3)) {
    fail("/acceptance/decisions/profile/slots/capacity");
  }
  return {
    ...layout,
    slots: layout.slots.map((slot) => slot.kind === "metric"
      ? { ...slot, capacity: { maxChars: slot.capacity.maxChars - 3 } }
      : { ...slot })
  };
}

/**
 * Recompute every proposal from the exact source bytes, require a complete
 * explicit review decision set, select across accepted exemplars, and hand
 * only the winning source/profile to the existing atomic clone/fill boundary.
 */
export function selectAndAssembleInducedCloneFillPresentation(options) {
  const fields = closedRecord(options, "/options", [
    "acceptance", "brief", "exemplars", "outputSlideId"
  ]);
  const induced = induceInternal({ exemplars: fields.exemplars });
  const decisions = parseAcceptance(fields.acceptance, induced.proposalSet);
  const brief = parseBrief(fields.brief);
  const exemplarById = new Map(induced.exemplars.map((exemplar) => [exemplar.exemplarId, exemplar]));
  const accepted = decisions.filter((decision) => decision.status === "accepted").map((decision) => {
    const exemplar = exemplarById.get(decision.exemplarId);
    if (exemplar === undefined || decision.profile === null) fail("/acceptance/decisions");
    const review = {
      catalogVersion: REVIEWED_CLONE_FILL_CATALOG_VERSION,
      templateIndexId: decision.proposal.templateIndexId,
      templateSha256: decision.proposal.templateSha256,
      profiles: [decision.profile]
    };
    const catalog = compileReviewedCloneFillCatalog({
      templateIndex: exemplar.templateIndex,
      review
    });
    return {
      decision,
      exemplar,
      review,
      layout: selectorReadyLayout(catalog.layouts[0])
    };
  });
  const selection = selectTemplateLayout({
    brief,
    layouts: accepted.map((entry) => entry.layout)
  });
  if (selection.selectionStatus !== "complete" || selection.selected === null) {
    fail("/selection");
  }
  const selected = accepted.find((entry) =>
    entry.layout.layoutId === selection.selected.layoutId);
  if (selected === undefined) fail("/selection");
  const assembled = selectAndAssembleReviewedCloneFillPresentation({
    sourceArchiveBytes: selected.exemplar.sourceArchiveBytes,
    templateIndex: selected.exemplar.templateIndex,
    review: selected.review,
    brief,
    outputSlideId: semanticId(fields.outputSlideId, "/outputSlideId")
  });
  if (assembled.selection.selected?.layoutId !== selection.selected.layoutId) fail("/selection");
  return Object.freeze({
    inductionVersion: REVIEWED_PROFILE_INDUCTION_VERSION,
    proposalSetSha256: induced.proposalSet.proposalSetSha256,
    selectedExemplarId: selected.exemplar.exemplarId,
    selectedProposalSha256: selected.decision.proposal.proposalSha256,
    selection: deepFreeze(selection),
    trace: assembled.trace,
    planTrace: assembled.planTrace,
    archiveBytes: Buffer.from(assembled.archiveBytes),
    report: assembled.report
  });
}
