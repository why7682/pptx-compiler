import { createHash } from "node:crypto";

import { executeCapabilityDispatch } from "./capability-dispatcher.mjs";
import {
  authenticateCloneFillAssemblyTargetArtifact,
  rewriteTemplateMainContentTypeForPptx
} from "./create-only-assembly.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { parseSecureZip, SECURE_ZIP_LIMITS } from "./secure-zip.mjs";
import { createNativeCardArrowSlotPlacement } from "./native-card-arrow-placement.mjs";
import {
  createFixedSlideLayoutIr,
  resolveSlideLayoutIr,
  SlideLayoutIrError
} from "./slide-layout-ir.mjs";
import { parseStrictXml } from "./strict-xml.mjs";

export const NATIVE_CARD_ARROW_ASSEMBLY_VERSION = "0.2.0";

const XML_DECLARATION = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
const MAX_UINT32 = 4_294_967_295;
const MAX_CANVAS_EMU = 100_000_000;
const MIN_WIDTH_EMU = 914_400;
const MIN_HEIGHT_EMU = 457_200;
const MAX_LABEL_CODE_POINTS = 256;
const MAX_LABEL_BYTES = 1_024;
const LINE_WIDTH_EMU = 12_700;
const TEXT_INSET_EMU = 91_440;
const COLOR = /^[0-9A-F]{6}$/u;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const encoder = new TextEncoder();
const authenticNativeCardArrowReports = new WeakMap();
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength"
).get;

const NS = Object.freeze({
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  xml: "http://www.w3.org/XML/1998/namespace"
});

const EXPECTED_QA_ASSERTIONS = Object.freeze([
  "anchor-binding-contract",
  "component-data-contract",
  "native-shape-structure-contract",
  "rendered-fragment-contract"
]);

const ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "NATIVE_CARD_ARROW_ASSEMBLY_ARGUMENT_INVALID",
  COLLATERAL_CHANGE: "NATIVE_CARD_ARROW_ASSEMBLY_COLLATERAL_CHANGE",
  DISPATCH_INVALID: "NATIVE_CARD_ARROW_ASSEMBLY_DISPATCH_INVALID",
  OCCUPANCY_CONFLICT: "NATIVE_CARD_ARROW_ASSEMBLY_OCCUPANCY_CONFLICT",
  OUTPUT_INVALID: "NATIVE_CARD_ARROW_ASSEMBLY_OUTPUT_INVALID",
  SOURCE_MISMATCH: "NATIVE_CARD_ARROW_ASSEMBLY_SOURCE_MISMATCH",
  TARGET_INVALID: "NATIVE_CARD_ARROW_ASSEMBLY_TARGET_INVALID"
});

export class NativeCardArrowAssemblyError extends Error {
  constructor(code, pointer) {
    super(`${code} at ${pointer}`);
    this.name = "NativeCardArrowAssemblyError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer) {
  throw new NativeCardArrowAssemblyError(code, pointer);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function assertExactRecord(value, expectedKeys, pointer, code = ERROR_CODES.ARGUMENT_INVALID) {
  if (!isPlainRecord(value)) fail(code, pointer);
  let descriptors;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(code, pointer);
  }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))) {
    fail(code, pointer);
  }
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(code, `${pointer}/${key}`);
    }
  }
  return descriptors;
}

function dataValue(value, key) {
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

function exactArray(value, expected, pointer, code) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail(code, pointer);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (descriptors.length?.value !== expected.length ||
      Reflect.ownKeys(descriptors).length !== expected.length + 1) {
    fail(code, pointer);
  }
  for (let index = 0; index < expected.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true ||
        descriptor.value !== expected[index]) {
      fail(code, `${pointer}/${index}`);
    }
  }
}

function semanticId(value, pointer, code) {
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) {
    fail(code, pointer);
  }
  return value;
}

function integerBetween(value, minimum, maximum, pointer, code) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(code, pointer);
  }
  return value;
}

function boundedText(value, pointer, code) {
  if (typeof value !== "string" || value.length === 0 || !/\S/u.test(value) ||
      /\p{Cf}/u.test(value) || encoder.encode(value).byteLength > MAX_LABEL_BYTES) {
    fail(code, pointer);
  }
  let codePoints = 0;
  for (const character of value) {
    codePoints += 1;
    if (codePoints > MAX_LABEL_CODE_POINTS) fail(code, pointer);
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f) ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
        codePoint === 0x2028 || codePoint === 0x2029 ||
        (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
        (codePoint & 0xfffe) === 0xfffe) {
      fail(code, pointer);
    }
  }
  return value;
}

function captureSingleDispatchPlan(plan) {
  assertExactRecord(
    plan,
    ["planVersion", "planType", "invocationCount"],
    "/dispatchPlan"
  );
  if (!Object.isFrozen(plan) || dataValue(plan, "planVersion") !== "0.1.0" ||
      dataValue(plan, "planType") !== "capability-dispatch-plan" ||
      dataValue(plan, "invocationCount") !== 1) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/dispatchPlan");
  }
  return plan;
}

function captureGeometry(value, slideSize, pointer) {
  assertExactRecord(value, ["x", "y", "cx", "cy"], pointer, ERROR_CODES.DISPATCH_INVALID);
  const geometry = {
    x: integerBetween(dataValue(value, "x"), 0, MAX_CANVAS_EMU, `${pointer}/x`, ERROR_CODES.DISPATCH_INVALID),
    y: integerBetween(dataValue(value, "y"), 0, MAX_CANVAS_EMU, `${pointer}/y`, ERROR_CODES.DISPATCH_INVALID),
    cx: integerBetween(
      dataValue(value, "cx"),
      MIN_WIDTH_EMU,
      MAX_CANVAS_EMU,
      `${pointer}/cx`,
      ERROR_CODES.DISPATCH_INVALID
    ),
    cy: integerBetween(
      dataValue(value, "cy"),
      MIN_HEIGHT_EMU,
      MAX_CANVAS_EMU,
      `${pointer}/cy`,
      ERROR_CODES.DISPATCH_INVALID
    )
  };
  if (geometry.x + geometry.cx > MAX_CANVAS_EMU ||
      geometry.y + geometry.cy > MAX_CANVAS_EMU) {
    fail(ERROR_CODES.DISPATCH_INVALID, pointer);
  }
  if (geometry.x + geometry.cx > slideSize.cx ||
      geometry.y + geometry.cy > slideSize.cy) {
    fail(ERROR_CODES.TARGET_INVALID, "/output/component/geometry");
  }
  return Object.freeze(geometry);
}

function captureStyle(value, pointer) {
  const keys = [
    "arrowFill",
    "cardFill",
    "fontSizeHundredthPoints",
    "lineColor",
    "textColor"
  ];
  assertExactRecord(value, keys, pointer, ERROR_CODES.DISPATCH_INVALID);
  const style = Object.create(null);
  for (const key of ["arrowFill", "cardFill", "lineColor", "textColor"]) {
    const color = dataValue(value, key);
    if (typeof color !== "string" || !COLOR.test(color)) {
      fail(ERROR_CODES.DISPATCH_INVALID, `${pointer}/${key}`);
    }
    style[key] = color;
  }
  style.fontSizeHundredthPoints = integerBetween(
    dataValue(value, "fontSizeHundredthPoints"),
    800,
    4_400,
    `${pointer}/fontSizeHundredthPoints`,
    ERROR_CODES.DISPATCH_INVALID
  );
  return Object.freeze(style);
}

function captureTypedComponentResult(result, authority) {
  assertExactRecord(
    result,
    ["dispatchVersion", "dispatchType", "results"],
    "/dispatchResult",
    ERROR_CODES.DISPATCH_INVALID
  );
  if (dataValue(result, "dispatchVersion") !== "0.1.0" ||
      dataValue(result, "dispatchType") !== "capability-dispatch-result") {
    fail(ERROR_CODES.DISPATCH_INVALID, "/dispatchResult");
  }
  const results = dataValue(result, "results");
  if (!Array.isArray(results) || results.length !== 1 ||
      Reflect.ownKeys(Object.getOwnPropertyDescriptors(results)).length !== 2) {
    fail(ERROR_CODES.DISPATCH_INVALID, "/dispatchResult/results");
  }
  const entry = dataValue(results, "0");
  assertExactRecord(entry, [
    "dispatchVersion",
    "dispatchType",
    "invocationId",
    "capabilitySelectionId",
    "capabilityId",
    "capabilityVersion",
    "supportMatrixItemId",
    "supportStatus",
    "executorId",
    "qaContractId",
    "qaAssertionIds",
    "output"
  ], "/dispatchResult/results/0", ERROR_CODES.DISPATCH_INVALID);
  if (dataValue(entry, "dispatchVersion") !== "0.1.0" ||
      dataValue(entry, "dispatchType") !== "capability-dispatch-result" ||
      dataValue(entry, "capabilityId") !== "native-card-arrow" ||
      dataValue(entry, "capabilityVersion") !== "0.1.0" ||
      dataValue(entry, "supportMatrixItemId") !== "native-drawingml" ||
      dataValue(entry, "supportStatus") !== "experimental" ||
      dataValue(entry, "executorId") !==
        "urn:pptx-compiler:capability:executor:native-card-arrow:0.1.0" ||
      dataValue(entry, "qaContractId") !==
        "urn:pptx-compiler:capability:qa:native-card-arrow:0.1.0") {
    fail(ERROR_CODES.DISPATCH_INVALID, "/dispatchResult/results/0");
  }
  const invocationId = semanticId(
    dataValue(entry, "invocationId"),
    "/dispatchResult/results/0/invocationId",
    ERROR_CODES.DISPATCH_INVALID
  );
  semanticId(
    dataValue(entry, "capabilitySelectionId"),
    "/dispatchResult/results/0/capabilitySelectionId",
    ERROR_CODES.DISPATCH_INVALID
  );
  exactArray(
    dataValue(entry, "qaAssertionIds"),
    EXPECTED_QA_ASSERTIONS,
    "/dispatchResult/results/0/qaAssertionIds",
    ERROR_CODES.DISPATCH_INVALID
  );

  const output = dataValue(entry, "output");
  assertExactRecord(
    output,
    ["planVersion", "planType", "outputSlideId", "clone", "insert", "component"],
    "/output",
    ERROR_CODES.DISPATCH_INVALID
  );
  if (dataValue(output, "planVersion") !== "0.1.0" ||
      dataValue(output, "planType") !== "native-card-arrow-plan" ||
      dataValue(output, "outputSlideId") !== invocationId) {
    fail(ERROR_CODES.DISPATCH_INVALID, "/output");
  }

  const clone = dataValue(output, "clone");
  assertExactRecord(clone, [
    "operationId", "operationType", "sourceContainerKind", "sourceSlideKey"
  ], "/output/clone", ERROR_CODES.DISPATCH_INVALID);
  if (dataValue(clone, "operationId") !== "clone-source-slide" ||
      dataValue(clone, "operationType") !== "clone-slide" ||
      dataValue(clone, "sourceContainerKind") !== "slide" ||
      dataValue(clone, "sourceSlideKey") !== authority.sourceSlideKey) {
    fail(ERROR_CODES.TARGET_INVALID, "/output/clone/sourceSlideKey");
  }

  const insert = dataValue(output, "insert");
  assertExactRecord(insert, [
    "operationId",
    "operationType",
    "role",
    "anchorBindingId",
    "anchorShapeKey",
    "expectedKind",
    "idPolicy"
  ], "/output/insert", ERROR_CODES.DISPATCH_INVALID);
  if (dataValue(insert, "operationId") !== "insert-native-card-arrow" ||
      dataValue(insert, "operationType") !== "insert-drawingml-group-after-anchor" ||
      dataValue(insert, "role") !== "anchor" ||
      dataValue(insert, "expectedKind") !== "text-box" ||
      dataValue(insert, "idPolicy") !== "local-remap-required") {
    fail(ERROR_CODES.DISPATCH_INVALID, "/output/insert");
  }
  semanticId(
    dataValue(insert, "anchorBindingId"),
    "/output/insert/anchorBindingId",
    ERROR_CODES.DISPATCH_INVALID
  );
  const anchorShapeKey = semanticId(
    dataValue(insert, "anchorShapeKey"),
    "/output/insert/anchorShapeKey",
    ERROR_CODES.DISPATCH_INVALID
  );
  const anchors = authority.shapes.filter((shape) => shape.shapeKey === anchorShapeKey);
  if (anchors.length !== 1 || anchors[0].kind !== "text-box") {
    fail(ERROR_CODES.TARGET_INVALID, "/output/insert/anchorShapeKey");
  }

  const component = dataValue(output, "component");
  assertExactRecord(component, [
    "componentType",
    "representation",
    "artifactKind",
    "insertable",
    "idScope",
    "localShapeIds",
    "geometry",
    "label",
    "style",
    "unboundDrawingmlFragment"
  ], "/output/component", ERROR_CODES.DISPATCH_INVALID);
  if (dataValue(component, "componentType") !== "native-card-arrow" ||
      dataValue(component, "representation") !== "native-drawingml-group-shape" ||
      dataValue(component, "artifactKind") !== "unbound-drawingml-conformance-fragment" ||
      dataValue(component, "insertable") !== false ||
      dataValue(component, "idScope") !== "component-local") {
    fail(ERROR_CODES.DISPATCH_INVALID, "/output/component");
  }
  exactArray(
    dataValue(component, "localShapeIds"),
    [1, 2, 3],
    "/output/component/localShapeIds",
    ERROR_CODES.DISPATCH_INVALID
  );
  return Object.freeze({
    outputSlideId: invocationId,
    anchor: anchors[0],
    geometry: captureGeometry(
      dataValue(component, "geometry"),
      authority.slideSizeEmu,
      "/output/component/geometry"
    ),
    label: boundedText(
      dataValue(component, "label"),
      "/output/component/label",
      ERROR_CODES.DISPATCH_INVALID
    ),
    style: captureStyle(dataValue(component, "style"), "/output/component/style")
  });
}

function cloneXmlNode(node) {
  return {
    namespaceURI: node.namespaceURI,
    localName: node.localName,
    key: node.key,
    attributes: new Map([...node.attributes].map(([key, value]) => [key, { ...value }])),
    children: node.children.map(cloneXmlNode),
    text: node.text
  };
}

function makeElement(namespaceURI, localName, attributes = [], children = [], text = "") {
  const mappedAttributes = new Map();
  for (const [attributeNamespace, attributeLocalName, value] of attributes) {
    mappedAttributes.set(`${attributeNamespace}\u0000${attributeLocalName}`, {
      namespaceURI: attributeNamespace,
      localName: attributeLocalName,
      value: String(value)
    });
  }
  return {
    namespaceURI,
    localName,
    key: `${namespaceURI}\u0000${localName}`,
    attributes: mappedAttributes,
    children,
    text
  };
}

function elementName(node) {
  for (const prefix of ["a", "p", "r", "xml"]) {
    if (node.namespaceURI === NS[prefix]) return `${prefix}:${node.localName}`;
  }
  fail(ERROR_CODES.OUTPUT_INVALID, "/output/xml/namespace");
}

function attributeName(attribute) {
  if (attribute.namespaceURI === "") return attribute.localName;
  for (const prefix of ["r", "xml"]) {
    if (attribute.namespaceURI === NS[prefix]) return `${prefix}:${attribute.localName}`;
  }
  fail(ERROR_CODES.OUTPUT_INVALID, "/output/xml/attributeNamespace");
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeXml(value).replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function serializeNode(node, root = false) {
  const declarations = root ? ` xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"` : "";
  const attributes = [...node.attributes.values()]
    .map((attribute) => ` ${attributeName(attribute)}="${escapeAttribute(attribute.value)}"`)
    .join("");
  const name = elementName(node);
  if (node.children.length === 0 && node.text.length === 0) {
    return `<${name}${declarations}${attributes}/>`;
  }
  return `<${name}${declarations}${attributes}>${escapeXml(node.text)}` +
    `${node.children.map((child) => serializeNode(child)).join("")}</${name}>`;
}

function serializeDocument(root) {
  return Buffer.from(`${XML_DECLARATION}${serializeNode(root, true)}\n`, "utf8");
}

function attribute(node, namespaceURI, localName) {
  return node.attributes.get(`${namespaceURI}\u0000${localName}`)?.value;
}

function directChildren(node, namespaceURI, localName) {
  return node.children.filter((child) =>
    child.namespaceURI === namespaceURI && child.localName === localName);
}

function oneDirectChild(node, namespaceURI, localName, pointer, code) {
  const matches = directChildren(node, namespaceURI, localName);
  if (matches.length !== 1) fail(code, pointer);
  return matches[0];
}

function locateSlideTree(root, code, pointer = "/slide") {
  if (root.namespaceURI !== NS.p || root.localName !== "sld") fail(code, pointer);
  const cSld = oneDirectChild(root, NS.p, "cSld", `${pointer}/cSld`, code);
  return oneDirectChild(cSld, NS.p, "spTree", `${pointer}/spTree`, code);
}

function canonicalUInt32Id(value, pointer, code) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/u.test(value)) fail(code, pointer);
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_UINT32) fail(code, pointer);
  return id;
}

function collectObjectIds(spTree, code, pointer) {
  const ids = new Set();
  let recognizedObjectCount = 0;

  function recordObjectId(object, nonVisualName) {
    const nonVisual = oneDirectChild(object, NS.p, nonVisualName, pointer, code);
    const cNvPr = oneDirectChild(nonVisual, NS.p, "cNvPr", pointer, code);
    const id = canonicalUInt32Id(attribute(cNvPr, "", "id"), pointer, code);
    if (ids.has(id)) fail(code, pointer);
    ids.add(id);
    recognizedObjectCount += 1;
  }

  function visitGroup(group, nonVisualName) {
    recordObjectId(group, nonVisualName);
    for (const child of group.children) {
      if (child.namespaceURI !== NS.p) fail(code, pointer);
      if (child.localName === nonVisualName || child.localName === "grpSpPr") continue;
      if (child.localName === "sp") {
        recordObjectId(child, "nvSpPr");
      } else if (child.localName === "grpSp") {
        visitGroup(child, "nvGrpSpPr");
      } else {
        fail(code, pointer);
      }
    }
  }

  visitGroup(spTree, "nvGrpSpPr");
  let actualNonVisualCount = 0;
  const pending = [spTree];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node.namespaceURI === NS.p && node.localName === "cNvPr") {
      actualNonVisualCount += 1;
    }
    pending.push(...node.children);
  }
  if (ids.size === 0 || actualNonVisualCount !== recognizedObjectCount) fail(code, pointer);
  return ids;
}

function allocateShapeIds(existingIds) {
  const allocated = [];
  for (let candidate = 1; candidate <= MAX_UINT32 && allocated.length < 3; candidate += 1) {
    if (!existingIds.has(candidate)) allocated.push(candidate);
  }
  if (allocated.length !== 3) fail(ERROR_CODES.TARGET_INVALID, "/slide/spTree/objectIds");
  return Object.freeze(allocated);
}

function parseTargetSlide(slideXmlBytes, code, pointer) {
  let root;
  try {
    root = parseStrictXml(slideXmlBytes).root;
  } catch {
    fail(code, pointer);
  }
  const spTree = locateSlideTree(root, code, pointer);
  const existingIds = collectObjectIds(spTree, code, `${pointer}/spTree/objectIds`);
  return { root, spTree, existingIds };
}

/** @internal Exercise the complete root-and-nested p:cNvPr allocation rule. */
export function allocateNativeCardArrowShapeIds(slideXmlBytes) {
  if (!(slideXmlBytes instanceof Uint8Array)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/slideXmlBytes");
  }
  const target = parseTargetSlide(
    slideXmlBytes,
    ERROR_CODES.TARGET_INVALID,
    "/slide"
  );
  return allocateShapeIds(target.existingIds);
}

function directShapeId(shape, code, pointer) {
  if (shape.namespaceURI !== NS.p || shape.localName !== "sp") fail(code, pointer);
  const nvSpPr = oneDirectChild(shape, NS.p, "nvSpPr", `${pointer}/nvSpPr`, code);
  const cNvPr = oneDirectChild(nvSpPr, NS.p, "cNvPr", `${pointer}/cNvPr`, code);
  return canonicalUInt32Id(attribute(cNvPr, "", "id"), `${pointer}/cNvPr/id`, code);
}

function findDirectAnchor(spTree, anchorSourceId, code, pointer) {
  const matches = spTree.children.filter((child) => {
    if (child.namespaceURI !== NS.p || child.localName !== "sp") return false;
    try {
      return directShapeId(child, code, pointer) === anchorSourceId;
    } catch (error) {
      if (error instanceof NativeCardArrowAssemblyError) throw error;
      return false;
    }
  });
  if (matches.length !== 1) fail(code, pointer);
  return matches[0];
}

function deriveGeometry({ x, y, cx, cy }) {
  const cardCx = Math.floor((cx * 7) / 10);
  const gapCx = Math.floor(cx / 10);
  const arrowCx = cx - cardCx - gapCx;
  const arrowCy = Math.floor(cy / 2);
  return Object.freeze({
    x,
    y,
    cx,
    cy,
    cardCx,
    arrowCx,
    arrowCy,
    arrowX: cardCx + gapCx,
    arrowY: Math.floor((cy - arrowCy) / 2)
  });
}

function buildNativeGroup(shapeIds, component) {
  const [groupId, cardId, arrowId] = shapeIds;
  const geometry = deriveGeometry(component.geometry);
  const solidFill = (color) => makeElement(NS.a, "solidFill", [], [
    makeElement(NS.a, "srgbClr", [["", "val", color]])
  ]);
  const line = () => makeElement(NS.a, "ln", [["", "w", LINE_WIDTH_EMU]], [
    solidFill(component.style.lineColor)
  ]);
  const shapeTransform = (x, y, cx, cy) => makeElement(NS.a, "xfrm", [], [
    makeElement(NS.a, "off", [["", "x", x], ["", "y", y]]),
    makeElement(NS.a, "ext", [["", "cx", cx], ["", "cy", cy]])
  ]);
  const nonVisualShape = (id, name) => makeElement(NS.p, "nvSpPr", [], [
    makeElement(NS.p, "cNvPr", [["", "id", id], ["", "name", name]]),
    makeElement(NS.p, "cNvSpPr"),
    makeElement(NS.p, "nvPr")
  ]);
  const presetGeometry = (preset) => makeElement(NS.a, "prstGeom", [["", "prst", preset]], [
    makeElement(NS.a, "avLst")
  ]);

  const card = makeElement(NS.p, "sp", [], [
    nonVisualShape(cardId, "Native Card"),
    makeElement(NS.p, "spPr", [], [
      shapeTransform(0, 0, geometry.cardCx, geometry.cy),
      presetGeometry("roundRect"),
      solidFill(component.style.cardFill),
      line()
    ]),
    makeElement(NS.p, "txBody", [], [
      makeElement(NS.a, "bodyPr", [
        ["", "anchor", "ctr"],
        ["", "lIns", TEXT_INSET_EMU],
        ["", "rIns", TEXT_INSET_EMU],
        ["", "tIns", TEXT_INSET_EMU],
        ["", "bIns", TEXT_INSET_EMU],
        ["", "wrap", "square"]
      ]),
      makeElement(NS.a, "lstStyle"),
      makeElement(NS.a, "p", [], [
        makeElement(NS.a, "pPr", [["", "algn", "ctr"]]),
        makeElement(NS.a, "r", [], [
          makeElement(NS.a, "rPr", [["", "sz", component.style.fontSizeHundredthPoints]], [
            solidFill(component.style.textColor)
          ]),
          makeElement(
            NS.a,
            "t",
            [[NS.xml, "space", "preserve"]],
            [],
            component.label
          )
        ]),
        makeElement(NS.a, "endParaRPr")
      ])
    ])
  ]);
  const arrow = makeElement(NS.p, "sp", [], [
    nonVisualShape(arrowId, "Native Arrow"),
    makeElement(NS.p, "spPr", [], [
      shapeTransform(geometry.arrowX, geometry.arrowY, geometry.arrowCx, geometry.arrowCy),
      presetGeometry("rightArrow"),
      solidFill(component.style.arrowFill),
      line()
    ])
  ]);
  return makeElement(NS.p, "grpSp", [], [
    makeElement(NS.p, "nvGrpSpPr", [], [
      makeElement(NS.p, "cNvPr", [
        ["", "id", groupId],
        ["", "name", "Native Card Arrow"]
      ]),
      makeElement(NS.p, "cNvGrpSpPr"),
      makeElement(NS.p, "nvPr")
    ]),
    makeElement(NS.p, "grpSpPr", [], [
      makeElement(NS.a, "xfrm", [], [
        makeElement(NS.a, "off", [["", "x", geometry.x], ["", "y", geometry.y]]),
        makeElement(NS.a, "ext", [["", "cx", geometry.cx], ["", "cy", geometry.cy]]),
        makeElement(NS.a, "chOff", [["", "x", 0], ["", "y", 0]]),
        makeElement(NS.a, "chExt", [["", "cx", geometry.cx], ["", "cy", geometry.cy]])
      ])
    ]),
    card,
    arrow
  ]);
}

function hasRelationshipAttribute(node) {
  if ([...node.attributes.values()].some((value) => value.namespaceURI === NS.r)) return true;
  return node.children.some(hasRelationshipAttribute);
}

function packageDiff(sourceParts, outputParts, slidePart) {
  const sourcePaths = [...sourceParts.keys()].sort();
  const outputPaths = [...outputParts.keys()].sort();
  const addedParts = outputPaths.filter((partPath) => !sourceParts.has(partPath));
  const removedParts = sourcePaths.filter((partPath) => !outputParts.has(partPath));
  const modifiedParts = sourcePaths.filter((partPath) => outputParts.has(partPath) &&
    !Buffer.from(sourceParts.get(partPath)).equals(outputParts.get(partPath)));
  const collateralChanges = [
    ...addedParts,
    ...removedParts,
    ...modifiedParts.filter((partPath) => partPath !== slidePart)
  ].sort();
  return Object.freeze({
    addedParts: Object.freeze(addedParts),
    removedParts: Object.freeze(removedParts),
    modifiedParts: Object.freeze(modifiedParts),
    allowedChanges: Object.freeze(modifiedParts.includes(slidePart)
      ? [Object.freeze({ partPath: slidePart, reason: "native-card-arrow-insertion" })]
      : []),
    collateralChanges: Object.freeze(collateralChanges)
  });
}

function verifyOutput({
  archiveBytes,
  sourceParts,
  slidePart,
  baseSlideBytes,
  anchorSourceId,
  allocatedShapeIds,
  expectedGroup
}) {
  let outputParts;
  try {
    outputParts = parseSecureZip(archiveBytes);
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, "/output/archive");
  }
  const sourcePaths = [...sourceParts.keys()].sort();
  const outputPaths = [...outputParts.keys()].sort();
  if (sourcePaths.length !== outputPaths.length ||
      sourcePaths.some((partPath, index) => partPath !== outputPaths[index])) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/output/parts");
  }
  for (const partPath of sourcePaths) {
    if (partPath !== slidePart &&
        !Buffer.from(sourceParts.get(partPath)).equals(outputParts.get(partPath))) {
      fail(ERROR_CODES.OUTPUT_INVALID, `/output/parts/${partPath}`);
    }
  }

  const parsed = parseTargetSlide(
    outputParts.get(slidePart),
    ERROR_CODES.OUTPUT_INVALID,
    "/output/slide"
  );
  const anchor = findDirectAnchor(
    parsed.spTree,
    anchorSourceId,
    ERROR_CODES.OUTPUT_INVALID,
    "/output/slide/anchor"
  );
  const anchorIndex = parsed.spTree.children.indexOf(anchor);
  const inserted = parsed.spTree.children[anchorIndex + 1];
  if (inserted?.namespaceURI !== NS.p || inserted?.localName !== "grpSp" ||
      serializeNode(inserted) !== serializeNode(expectedGroup) ||
      hasRelationshipAttribute(inserted)) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/output/slide/nativeGroup");
  }
  for (const id of allocatedShapeIds) {
    if (!parsed.existingIds.has(id)) fail(ERROR_CODES.OUTPUT_INVALID, "/output/slide/objectIds");
  }
  parsed.spTree.children.splice(anchorIndex + 1, 1);
  if (!serializeDocument(parsed.root).equals(baseSlideBytes)) {
    fail(ERROR_CODES.COLLATERAL_CHANGE, "/output/slide");
  }
}

function snapshotArchiveBytes(value, pointer) {
  if (!Buffer.isBuffer(value)) fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  let byteLength;
  try {
    byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(value);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  if (byteLength < 1 || byteLength > SECURE_ZIP_LIMITS.maxArchiveBytes) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  let snapshot;
  try {
    snapshot = Buffer.from(value);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  if (snapshot.length !== byteLength) fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  return snapshot;
}

function captureProjectionShapeIds(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/projection/allocatedShapeIds");
  }
  let descriptors;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/projection/allocatedShapeIds");
  }
  if (descriptors.length?.value !== 3 || Reflect.ownKeys(descriptors).length !== 4) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/projection/allocatedShapeIds");
  }
  return Object.freeze([0, 1, 2].map((index) => {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) ||
        descriptor.enumerable !== true) {
      fail(ERROR_CODES.ARGUMENT_INVALID, `/projection/allocatedShapeIds/${index}`);
    }
    return integerBetween(
      descriptor.value,
      1,
      MAX_UINT32,
      `/projection/allocatedShapeIds/${index}`,
      ERROR_CODES.ARGUMENT_INVALID
    );
  }));
}

function sameStringList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * @internal Prove one final native-card candidate is the deterministic
 * projection of the readable source/template facts, DeckSpec component data,
 * and the already replayed composed geometry. This is deliberately stricter
 * than CandidateBuildRecord replay: it authenticates actual OOXML content and
 * rejects every collateral package change.
 */
export function verifyNativeCardArrowCandidateProjection(options) {
  const fields = assertExactRecord(options, [
    "sourceTemplateBytes",
    "candidateBytes",
    "slidePart",
    "slideSizeEmu",
    "anchorSourceId",
    "allocatedShapeIds",
    "baseArtifactSha256",
    "component"
  ], "/projection");
  const sourceTemplateBytes = snapshotArchiveBytes(
    fields.sourceTemplateBytes.value,
    "/projection/sourceTemplateBytes"
  );
  const candidateBytes = snapshotArchiveBytes(
    fields.candidateBytes.value,
    "/projection/candidateBytes"
  );
  const slidePart = fields.slidePart.value;
  if (typeof slidePart !== "string" || slidePart.length > 512 ||
      !/^ppt\/slides\/slide[1-9][0-9]*\.xml$/u.test(slidePart)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/projection/slidePart");
  }
  const sizeFields = assertExactRecord(
    fields.slideSizeEmu.value,
    ["cx", "cy"],
    "/projection/slideSizeEmu"
  );
  const slideSizeEmu = Object.freeze({
    cx: integerBetween(
      sizeFields.cx.value,
      1,
      MAX_CANVAS_EMU,
      "/projection/slideSizeEmu/cx",
      ERROR_CODES.ARGUMENT_INVALID
    ),
    cy: integerBetween(
      sizeFields.cy.value,
      1,
      MAX_CANVAS_EMU,
      "/projection/slideSizeEmu/cy",
      ERROR_CODES.ARGUMENT_INVALID
    )
  });
  const anchorSourceId = integerBetween(
    fields.anchorSourceId.value,
    1,
    MAX_UINT32,
    "/projection/anchorSourceId",
    ERROR_CODES.ARGUMENT_INVALID
  );
  const allocatedShapeIds = captureProjectionShapeIds(fields.allocatedShapeIds.value);
  const baseArtifactSha256 = fields.baseArtifactSha256.value;
  if (typeof baseArtifactSha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(baseArtifactSha256)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/projection/baseArtifactSha256");
  }
  const componentFields = assertExactRecord(
    fields.component.value,
    ["geometry", "label", "style"],
    "/projection/component"
  );
  const component = Object.freeze({
    geometry: captureGeometry(
      componentFields.geometry.value,
      slideSizeEmu,
      "/projection/component/geometry"
    ),
    label: boundedText(
      componentFields.label.value,
      "/projection/component/label",
      ERROR_CODES.DISPATCH_INVALID
    ),
    style: captureStyle(componentFields.style.value, "/projection/component/style")
  });

  let sourceParts;
  try {
    sourceParts = parseSecureZip(sourceTemplateBytes);
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/projection/sourceTemplateBytes");
  }
  const sourceNames = [...sourceParts.keys()].sort();
  if (!sourceParts.has("[Content_Types].xml") || !sourceParts.has(slidePart)) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/projection/sourceTemplateBytes");
  }

  const sourceSlide = parseTargetSlide(
    sourceParts.get(slidePart),
    ERROR_CODES.SOURCE_MISMATCH,
    "/projection/sourceSlide"
  );
  const expectedAllocatedShapeIds = allocateShapeIds(sourceSlide.existingIds);
  if (!sameStringList(allocatedShapeIds, expectedAllocatedShapeIds)) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/projection/allocatedShapeIds");
  }
  const anchor = findDirectAnchor(
    sourceSlide.spTree,
    anchorSourceId,
    ERROR_CODES.SOURCE_MISMATCH,
    "/projection/anchorSourceId"
  );
  const anchorIndex = sourceSlide.spTree.children.indexOf(anchor);
  const canonicalBaseSlide = serializeDocument(sourceSlide.root);

  let contentTypesBytes;
  try {
    contentTypesBytes = rewriteTemplateMainContentTypeForPptx(
      sourceParts.get("[Content_Types].xml")
    );
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/projection/contentTypes");
  }
  const baseParts = new Map(
    [...sourceParts].map(([partName, bytes]) => [partName, Buffer.from(bytes)])
  );
  baseParts.set("[Content_Types].xml", contentTypesBytes);
  baseParts.set(slidePart, canonicalBaseSlide);
  let expectedBaseBytes;
  try {
    expectedBaseBytes = createDeterministicZip(baseParts);
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, "/projection/baseArtifact");
  }
  if (sha256(expectedBaseBytes) !== baseArtifactSha256) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/projection/baseArtifactSha256");
  }

  const expectedGroup = buildNativeGroup(allocatedShapeIds, component);
  sourceSlide.spTree.children.splice(anchorIndex + 1, 0, expectedGroup);
  const expectedParts = new Map(
    [...baseParts].map(([partName, bytes]) => [partName, Buffer.from(bytes)])
  );
  expectedParts.set(slidePart, serializeDocument(sourceSlide.root));
  let expectedCandidateBytes;
  try {
    expectedCandidateBytes = createDeterministicZip(expectedParts);
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, "/projection/candidateBytes");
  }
  if (!expectedCandidateBytes.equals(candidateBytes)) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/projection/candidateBytes");
  }

  const changedParts = sourceNames.filter((partName) =>
    !Buffer.from(sourceParts.get(partName)).equals(expectedParts.get(partName))
  );
  const expectedChangedParts = ["[Content_Types].xml", slidePart].sort();
  if (!sameStringList(changedParts, expectedChangedParts)) {
    fail(ERROR_CODES.COLLATERAL_CHANGE, "/projection/changedParts");
  }
  return Object.freeze({
    verificationProfile: "source-deck-plan-native-card-projection",
    baseArtifactSha256,
    candidateSha256: sha256(candidateBytes),
    changedParts: Object.freeze(changedParts)
  });
}

/** @internal Bind one exact generated native artifact to its verified base. */
export function authenticateNativeCardArrowAssemblyArtifact(options) {
  const descriptors = assertExactRecord(
    options,
    ["archiveBytes", "report"],
    "/artifact"
  );
  const archiveBytes = descriptors.archiveBytes.value;
  const report = descriptors.report.value;
  if (!Buffer.isBuffer(archiveBytes)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/artifact/archiveBytes");
  }
  const facts = authenticNativeCardArrowReports.get(report);
  if (facts === undefined) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/artifact/report");
  }
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
  return Object.freeze({
    archiveBytes: snapshot,
    baseArchiveBytes: Buffer.from(facts.baseArchiveBytes),
    authority: facts.publicFacts
  });
}

/**
 * M2-005C native slice: consume one opaque dispatcher plan inside the assembly
 * boundary and rebuild its typed card-arrow component on one authentic M2-005A
 * artifact. Only the exact report/byte pair may cross the authenticated native
 * publication and ordered-deck bridge; generic group-shape ingestion remains
 * unavailable.
 */
async function assembleNativeCardArrowOnCloneFillInternal(options, slotPlacement) {
  let optionDescriptors;
  try {
    optionDescriptors = assertExactRecord(
      options,
      ["baseArtifact", "dispatchPlan"],
      "/options"
    );
  } catch (error) {
    if (error instanceof NativeCardArrowAssemblyError) throw error;
    fail(ERROR_CODES.ARGUMENT_INVALID, "/options");
  }
  const dispatchPlan = captureSingleDispatchPlan(optionDescriptors.dispatchPlan.value);

  let authenticated;
  try {
    authenticated = authenticateCloneFillAssemblyTargetArtifact(
      optionDescriptors.baseArtifact.value
    );
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/baseArtifact");
  }
  const baseArchiveBytes = authenticated.archiveBytes;
  const authority = authenticated.authority;
  let sourceParts;
  try {
    sourceParts = parseSecureZip(baseArchiveBytes);
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/baseArtifact/archiveBytes");
  }
  const baseSlideBytes = sourceParts.get(authority.slidePart);
  if (baseSlideBytes === undefined) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/baseArtifact/slidePart");
  }
  const baseTarget = parseTargetSlide(
    baseSlideBytes,
    ERROR_CODES.SOURCE_MISMATCH,
    "/baseArtifact/slide"
  );
  const canonicalBaseSlide = serializeDocument(baseTarget.root);
  if (!canonicalBaseSlide.equals(baseSlideBytes)) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/baseArtifact/slide/canonical");
  }

  const dispatchResult = await executeCapabilityDispatch({ plan: dispatchPlan });
  const component = captureTypedComponentResult(dispatchResult, authority);
  let layoutIr;
  let composedSlidePlan;
  if (slotPlacement !== undefined) {
    if (slotPlacement.request.outputSlideId !== component.outputSlideId ||
        JSON.stringify(slotPlacement.resolvedGeometry) !== JSON.stringify(component.geometry) ||
        slotPlacement.sourceBinding.baseOutputSha256 !== sha256(baseArchiveBytes) ||
        slotPlacement.sourceBinding.slidePart !== authority.slidePart ||
        slotPlacement.sourceBinding.sourceSlideKey !== authority.sourceSlideKey) {
      fail(ERROR_CODES.DISPATCH_INVALID, "/output/component/geometry");
    }
    layoutIr = slotPlacement.layoutIr;
    composedSlidePlan = resolveSlideLayoutIr(layoutIr);
    if (composedSlidePlan.planDigest !== slotPlacement.composedSlidePlan.planDigest) {
      fail(ERROR_CODES.TARGET_INVALID, "/placementRequest");
    }
  } else {
    try {
      layoutIr = createFixedSlideLayoutIr({
        slideId: component.outputSlideId,
        canvas: authority.slideSizeEmu,
        nodes: [
          ...authority.shapes.map((shape, index) => ({
            nodeId: shape.shapeKey,
            sourceKind: "template-shape",
            sourceRef: shape.shapeKey,
            semanticSlotId: shape.shapeKey,
            role: "content",
            geometry: shape.geometry,
            paintOutsetEmu: 0,
            zOrder: index,
            placementIntent: "template-fixed"
          })),
          {
            nodeId: component.outputSlideId,
            sourceKind: "native-component",
            sourceRef: "native-card-arrow",
            semanticSlotId: "native-component-region",
            role: "content",
            geometry: component.geometry,
            paintOutsetEmu: Math.ceil(LINE_WIDTH_EMU / 2),
            zOrder: authority.shapes.length,
            placementIntent: "legacy-absolute-fixed"
          }
        ]
      });
      composedSlidePlan = resolveSlideLayoutIr(layoutIr);
    } catch (error) {
      if (error instanceof SlideLayoutIrError &&
          error.code === "SLIDE_LAYOUT_IR_OCCUPANCY_CONFLICT") {
        fail(ERROR_CODES.OCCUPANCY_CONFLICT, "/output/component/geometry");
      }
      fail(ERROR_CODES.TARGET_INVALID, "/output/component/geometry");
    }
  }
  const resolvedComponentNode = composedSlidePlan.nodes.find(
    (node) => node.sourceKind === "native-component" &&
      node.sourceRef === "native-card-arrow"
  );
  if (resolvedComponentNode === undefined) {
    fail(ERROR_CODES.TARGET_INVALID, "/output/component/geometry");
  }
  const resolvedComponent = Object.freeze({
    ...component,
    geometry: resolvedComponentNode.box
  });
  const anchorSourceId = component.anchor.sourceId;
  integerBetween(
    anchorSourceId,
    1,
    MAX_UINT32,
    "/baseArtifact/anchor/sourceId",
    ERROR_CODES.SOURCE_MISMATCH
  );
  const outputRoot = cloneXmlNode(baseTarget.root);
  const outputSpTree = locateSlideTree(outputRoot, ERROR_CODES.SOURCE_MISMATCH, "/baseArtifact/slide");
  const existingIds = collectObjectIds(
    outputSpTree,
    ERROR_CODES.TARGET_INVALID,
    "/baseArtifact/slide/spTree/objectIds"
  );
  const allocatedShapeIds = allocateShapeIds(existingIds);
  const anchor = findDirectAnchor(
    outputSpTree,
    anchorSourceId,
    ERROR_CODES.TARGET_INVALID,
    "/output/insert/anchorShapeKey"
  );
  const nativeGroup = buildNativeGroup(allocatedShapeIds, resolvedComponent);
  const anchorIndex = outputSpTree.children.indexOf(anchor);
  outputSpTree.children.splice(anchorIndex + 1, 0, nativeGroup);

  const outputParts = new Map(
    [...sourceParts].map(([partPath, bytes]) => [partPath, Buffer.from(bytes)])
  );
  outputParts.set(authority.slidePart, serializeDocument(outputRoot));
  const diff = packageDiff(sourceParts, outputParts, authority.slidePart);
  if (diff.addedParts.length !== 0 || diff.removedParts.length !== 0 ||
      diff.modifiedParts.length !== 1 || diff.modifiedParts[0] !== authority.slidePart ||
      diff.collateralChanges.length !== 0) {
    fail(ERROR_CODES.COLLATERAL_CHANGE, "/diff");
  }

  let archiveBytes;
  try {
    archiveBytes = createDeterministicZip(outputParts);
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, "/output/archive");
  }
  verifyOutput({
    archiveBytes,
    sourceParts,
    slidePart: authority.slidePart,
    baseSlideBytes: canonicalBaseSlide,
    anchorSourceId,
    allocatedShapeIds,
    expectedGroup: nativeGroup
  });

  const report = Object.freeze({
    assemblyVersion: NATIVE_CARD_ARROW_ASSEMBLY_VERSION,
    artifactType: "native-card-arrow-assembled-pptx",
    verificationProfile: "target-specific-native-card-arrow-output",
    publicationEligible: false,
    outputSlideId: component.outputSlideId,
    baseOutputSha256: sha256(baseArchiveBytes),
    outputBytes: archiveBytes.length,
    outputSha256: sha256(archiveBytes),
    slidePart: authority.slidePart,
    placementRecord: slotPlacement ?? null,
    layoutIr,
    composedSlidePlan,
    allocatedShapeIds,
    diff
  });
  const publicFacts = Object.freeze({
    artifactType: report.artifactType,
    verificationProfile: report.verificationProfile,
    publicationEligible: report.publicationEligible,
    authenticatedPublicationProfile: "direct-native-artifact-only",
    outputSlideId: report.outputSlideId,
    outputBytes: report.outputBytes,
    outputSha256: report.outputSha256,
    slidePart: report.slidePart
  });
  authenticNativeCardArrowReports.set(report, Object.freeze({
    publicFacts,
    baseArchiveBytes: Buffer.from(baseArchiveBytes)
  }));
  return Object.freeze({ archiveBytes: Buffer.from(archiveBytes), report });
}

/**
 * Low-level compatibility entry point. Product callers should use the semantic
 * slot entry point below so raw x/y cannot become presentation policy.
 */
export async function assembleNativeCardArrowOnCloneFill(options) {
  return assembleNativeCardArrowOnCloneFillInternal(options, undefined);
}

/**
 * Product placement entry point: compile slotRef + placementIntent into a
 * replayable layout IR, then require the typed executor geometry to match the
 * frozen result exactly before any slide mutation.
 */
export async function assembleNativeCardArrowFromSlot(options) {
  const descriptors = assertExactRecord(
    options,
    ["baseArtifact", "dispatchPlan", "placementRequest"],
    "/options"
  );
  const baseArtifact = descriptors.baseArtifact.value;
  const dispatchPlan = descriptors.dispatchPlan.value;
  const slotPlacement = createNativeCardArrowSlotPlacement({
    baseArtifact,
    request: descriptors.placementRequest.value
  });
  return assembleNativeCardArrowOnCloneFillInternal(
    { baseArtifact, dispatchPlan },
    slotPlacement
  );
}
