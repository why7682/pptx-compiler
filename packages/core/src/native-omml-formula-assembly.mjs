import { createHash } from "node:crypto";
import path from "node:path";

import { executeCapabilityDispatch } from "./capability-dispatcher.mjs";
import {
  authenticateCloneFillAssemblyTargetArtifact,
  rewriteTemplateMainContentTypeForPptx,
  verifyCreateOnlyTemplateIndexAgainstSourceView
} from "./create-only-assembly.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { buildSecureTemplatePackageView } from "./ooxml-package-view.mjs";
import { parseSecureZip, SECURE_ZIP_LIMITS } from "./secure-zip.mjs";
import {
  createBoundedSlotSlideLayoutIr,
  resolveSlideLayoutIr,
  SlideLayoutIrError
} from "./slide-layout-ir.mjs";
import { parseStrictXml } from "./strict-xml.mjs";

export const NATIVE_OMML_FORMULA_ASSEMBLY_VERSION = "0.1.0";

const XML_DECLARATION = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
const MAX_OMML_FRAGMENT_CODE_UNITS = 16 * 1024;
const MAX_TARGET_OMML_ELEMENTS = 64;
const MAX_TARGET_OMML_RUNS = 16;
const MAX_TARGET_OMML_TEXT_BYTES = 256;
const FORMULA_FONT_SIZE_HUNDREDTH_POINTS = 4_800;
const FORMULA_TYPEFACE = "Cambria Math";
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const encoder = new TextEncoder();
const authenticNativeOmmlReports = new WeakMap();
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength"
).get;

const NS = Object.freeze({
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  a14: "http://schemas.microsoft.com/office/drawing/2010/main",
  m: "http://schemas.openxmlformats.org/officeDocument/2006/math",
  mc: "http://schemas.openxmlformats.org/markup-compatibility/2006",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  xml: "http://www.w3.org/XML/1998/namespace"
});

const EXPECTED_QA_ASSERTIONS = Object.freeze([
  "formula-target-binding-contract",
  "omml-application-boundary-contract",
  "omml-native-structure-contract",
  "omml-operation-contract"
]);

const ALLOWED_OMML_ELEMENTS = new Set([
  "oMath",
  "r",
  "t",
  "f",
  "fPr",
  "type",
  "num",
  "den",
  "sSup",
  "sSupPr",
  "e",
  "sup",
  "sSub",
  "sSubPr",
  "sub",
  "sSubSup",
  "sSubSupPr",
  "rad",
  "radPr",
  "degHide",
  "deg"
]);

const OMML_EXPRESSION_ELEMENTS = new Set([
  "r",
  "f",
  "sSup",
  "sSub",
  "sSubSup",
  "rad"
]);

const ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "NATIVE_OMML_FORMULA_ASSEMBLY_ARGUMENT_INVALID",
  COLLATERAL_CHANGE: "NATIVE_OMML_FORMULA_ASSEMBLY_COLLATERAL_CHANGE",
  DISPATCH_INVALID: "NATIVE_OMML_FORMULA_ASSEMBLY_DISPATCH_INVALID",
  OUTPUT_INVALID: "NATIVE_OMML_FORMULA_ASSEMBLY_OUTPUT_INVALID",
  SOURCE_MISMATCH: "NATIVE_OMML_FORMULA_ASSEMBLY_SOURCE_MISMATCH",
  TARGET_INVALID: "NATIVE_OMML_FORMULA_ASSEMBLY_TARGET_INVALID"
});

export class NativeOmmlFormulaAssemblyError extends Error {
  constructor(code, pointer) {
    super(`${code} at ${pointer}`);
    this.name = "NativeOmmlFormulaAssemblyError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer) {
  throw new NativeOmmlFormulaAssemblyError(code, pointer);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function snapshotArchiveBytes(value, pointer) {
  let byteLength;
  try {
    byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(value);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  if (!Number.isSafeInteger(byteLength) || byteLength < 1 ||
      byteLength > SECURE_ZIP_LIMITS.maxArchiveBytes) {
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

function isPlainRecord(value) {
  if (value === null || typeof value !== "object") return false;
  try {
    if (Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function exactRecord(value, expectedKeys, pointer, code = ERROR_CODES.ARGUMENT_INVALID) {
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

function semanticId(value, pointer, code) {
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) {
    fail(code, pointer);
  }
  return value;
}

function exactArray(value, expected, pointer, code) {
  let array;
  let prototype;
  let descriptors;
  try {
    array = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(code, pointer);
  }
  const length = descriptors.length?.value;
  if (!array || prototype !== Array.prototype || length !== expected.length ||
      Reflect.ownKeys(descriptors).length !== expected.length + 1) {
    fail(code, pointer);
  }
  for (let index = 0; index < expected.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) ||
        descriptor.enumerable !== true || descriptor.value !== expected[index]) {
      fail(code, `${pointer}/${index}`);
    }
  }
}

function captureSingleDispatchPlan(plan) {
  exactRecord(plan, ["planVersion", "planType", "invocationCount"], "/dispatchPlan");
  if (!Object.isFrozen(plan) || dataValue(plan, "planVersion") !== "0.1.0" ||
      dataValue(plan, "planType") !== "capability-dispatch-plan" ||
      dataValue(plan, "invocationCount") !== 1) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/dispatchPlan");
  }
  return plan;
}

function captureFormulaResult(result, authority) {
  exactRecord(
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
  let isArray;
  let prototype;
  let resultDescriptors;
  try {
    isArray = Array.isArray(results);
    prototype = Object.getPrototypeOf(results);
    resultDescriptors = Object.getOwnPropertyDescriptors(results);
  } catch {
    fail(ERROR_CODES.DISPATCH_INVALID, "/dispatchResult/results");
  }
  if (!isArray || prototype !== Array.prototype || resultDescriptors.length?.value !== 1 ||
      Reflect.ownKeys(resultDescriptors).length !== 2 ||
      !("value" in (resultDescriptors["0"] ?? {}))) {
    fail(ERROR_CODES.DISPATCH_INVALID, "/dispatchResult/results");
  }
  const entry = resultDescriptors["0"].value;
  exactRecord(entry, [
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
      dataValue(entry, "capabilityId") !== "formula-transplant" ||
      dataValue(entry, "capabilityVersion") !== "0.1.0" ||
      dataValue(entry, "supportMatrixItemId") !== "formula-transplant" ||
      dataValue(entry, "supportStatus") !== "experimental" ||
      dataValue(entry, "executorId") !==
        "urn:pptx-compiler:capability:executor:formula-transplant:0.1.0" ||
      dataValue(entry, "qaContractId") !==
        "urn:pptx-compiler:capability:qa:formula-transplant:0.1.0") {
    fail(ERROR_CODES.DISPATCH_INVALID, "/dispatchResult/results/0");
  }
  const outputSlideId = semanticId(
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
  exactRecord(
    output,
    ["planVersion", "planType", "outputSlideId", "clone", "replace", "formula"],
    "/output",
    ERROR_CODES.DISPATCH_INVALID
  );
  if (dataValue(output, "planVersion") !== "0.1.0" ||
      dataValue(output, "planType") !== "formula-transplant-plan" ||
      dataValue(output, "outputSlideId") !== outputSlideId) {
    fail(ERROR_CODES.DISPATCH_INVALID, "/output");
  }

  const clone = dataValue(output, "clone");
  exactRecord(clone, [
    "operationId", "operationType", "sourceContainerKind", "sourceSlideKey"
  ], "/output/clone", ERROR_CODES.DISPATCH_INVALID);
  if (dataValue(clone, "operationId") !== "clone-source-slide" ||
      dataValue(clone, "operationType") !== "clone-slide" ||
      dataValue(clone, "sourceContainerKind") !== "slide" ||
      dataValue(clone, "sourceSlideKey") !== authority.sourceSlideKey) {
    fail(ERROR_CODES.TARGET_INVALID, "/output/clone/sourceSlideKey");
  }

  const replace = dataValue(output, "replace");
  exactRecord(replace, [
    "operationId",
    "operationType",
    "role",
    "targetBindingId",
    "targetShapeKey",
    "expectedKind",
    "applicationPolicy"
  ], "/output/replace", ERROR_CODES.DISPATCH_INVALID);
  if (dataValue(replace, "operationId") !== "replace-formula-target" ||
      dataValue(replace, "operationType") !== "replace-text-box-content-with-native-omml" ||
      dataValue(replace, "role") !== "formula-target" ||
      dataValue(replace, "expectedKind") !== "text-box" ||
      dataValue(replace, "applicationPolicy") !== "typed-rebuild-required") {
    fail(ERROR_CODES.DISPATCH_INVALID, "/output/replace");
  }
  const targetBindingId = semanticId(
    dataValue(replace, "targetBindingId"),
    "/output/replace/targetBindingId",
    ERROR_CODES.DISPATCH_INVALID
  );
  const targetShapeKey = semanticId(
    dataValue(replace, "targetShapeKey"),
    "/output/replace/targetShapeKey",
    ERROR_CODES.DISPATCH_INVALID
  );
  const targets = authority.shapes.filter((shape) => shape.shapeKey === targetShapeKey);
  if (targets.length !== 1 || targets[0].kind !== "text-box") {
    fail(ERROR_CODES.TARGET_INVALID, "/output/replace/targetShapeKey");
  }

  const formula = dataValue(output, "formula");
  exactRecord(formula, [
    "componentType",
    "representation",
    "artifactKind",
    "insertable",
    "sourceFormat",
    "displayMode",
    "adapterProfileVersion",
    "unboundOmmlFragment"
  ], "/output/formula", ERROR_CODES.DISPATCH_INVALID);
  if (dataValue(formula, "componentType") !== "native-omml-formula" ||
      dataValue(formula, "representation") !== "native-office-math" ||
      dataValue(formula, "artifactKind") !== "unbound-omml-conformance-fragment" ||
      dataValue(formula, "insertable") !== false ||
      dataValue(formula, "sourceFormat") !== "latex-math" ||
      dataValue(formula, "displayMode") !== "display" ||
      dataValue(formula, "adapterProfileVersion") !== "0.1.0") {
    fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula");
  }
  const fragment = dataValue(formula, "unboundOmmlFragment");
  if (typeof fragment !== "string" || fragment.length < 1 ||
      fragment.length > MAX_OMML_FRAGMENT_CODE_UNITS) {
    fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/unboundOmmlFragment");
  }
  return Object.freeze({
    outputSlideId,
    targetBindingId,
    target: targets[0],
    fragment
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

function descendants(node, namespaceURI, localName, output = []) {
  if (node.namespaceURI === namespaceURI && node.localName === localName) output.push(node);
  for (const child of node.children) descendants(child, namespaceURI, localName, output);
  return output;
}

function locateSlideTree(root, code, pointer = "/slide") {
  if (root.namespaceURI !== NS.p || root.localName !== "sld") fail(code, pointer);
  const cSld = oneDirectChild(root, NS.p, "cSld", `${pointer}/cSld`, code);
  return oneDirectChild(cSld, NS.p, "spTree", `${pointer}/spTree`, code);
}

function directShapeId(shape, code, pointer) {
  if (shape.namespaceURI !== NS.p || shape.localName !== "sp") fail(code, pointer);
  const nvSpPr = oneDirectChild(shape, NS.p, "nvSpPr", `${pointer}/nvSpPr`, code);
  const cNvPr = oneDirectChild(nvSpPr, NS.p, "cNvPr", `${pointer}/cNvPr`, code);
  const raw = attribute(cNvPr, "", "id");
  if (typeof raw !== "string" || !/^[1-9][0-9]*$/u.test(raw)) fail(code, pointer);
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id > 4_294_967_295) fail(code, pointer);
  return id;
}

function findDirectShape(spTree, sourceId, code, pointer) {
  const matches = spTree.children.filter((child) =>
    child.namespaceURI === NS.p && child.localName === "sp" &&
    directShapeId(child, code, pointer) === sourceId);
  if (matches.length !== 1) fail(code, pointer);
  return matches[0];
}

function elementName(node) {
  for (const prefix of ["a", "a14", "m", "mc", "p", "r", "xml"]) {
    if (node.namespaceURI === NS[prefix]) return `${prefix}:${node.localName}`;
  }
  fail(ERROR_CODES.OUTPUT_INVALID, "/output/xml/namespace");
}

function attributeName(value) {
  if (value.namespaceURI === "") return value.localName;
  for (const prefix of ["m", "mc", "r", "xml"]) {
    if (value.namespaceURI === NS[prefix]) return `${prefix}:${value.localName}`;
  }
  fail(ERROR_CODES.OUTPUT_INVALID, "/output/xml/attributeNamespace");
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeXml(value).replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function containsNamespace(node, namespaceURI) {
  return node.namespaceURI === namespaceURI ||
    [...node.attributes.values()].some((item) => item.namespaceURI === namespaceURI) ||
    node.children.some((child) => containsNamespace(child, namespaceURI));
}

function serializeNode(node, root = false) {
  let declarations = "";
  if (root) {
    declarations = ` xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"`;
  } else if (node.namespaceURI === NS.mc && node.localName === "AlternateContent") {
    declarations = ` xmlns:mc="${NS.mc}"`;
  } else if (node.namespaceURI === NS.mc && node.localName === "Choice") {
    declarations = ` xmlns:a14="${NS.a14}"`;
  } else if (node.namespaceURI === NS.m && node.localName === "oMathPara") {
    declarations = ` xmlns:m="${NS.m}"`;
  }
  const attributes = [...node.attributes.values()]
    .map((item) => ` ${attributeName(item)}="${escapeAttribute(item.value)}"`)
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

function hasChildSequence(node, names) {
  return node.children.length === names.length &&
    names.every((name, index) => node.children[index].localName === name &&
      node.children[index].namespaceURI === NS.m);
}

function hasExpressionChildren(node, { allowEmpty = false } = {}) {
  return (allowEmpty || node.children.length > 0) && node.children.every((child) =>
    child.namespaceURI === NS.m && OMML_EXPRESSION_ELEMENTS.has(child.localName));
}

function validateOmmlStructure(node) {
  switch (node.localName) {
    case "oMath":
      if (!hasExpressionChildren(node)) fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math");
      break;
    case "r":
      if (!hasChildSequence(node, ["t"])) {
        fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math/run");
      }
      break;
    case "t":
    case "type":
    case "degHide":
    case "sSupPr":
    case "sSubPr":
    case "sSubSupPr":
      if (node.children.length !== 0) fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math");
      break;
    case "f":
      if (!(hasChildSequence(node, ["fPr", "num", "den"]) ||
          hasChildSequence(node, ["num", "den"]))) {
        fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math/fraction");
      }
      break;
    case "fPr":
      if (!hasChildSequence(node, ["type"])) {
        fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math/fractionProperties");
      }
      break;
    case "num":
    case "den":
    case "e":
    case "sup":
    case "sub":
      if (!hasExpressionChildren(node)) fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math");
      break;
    case "sSup":
      if (!(hasChildSequence(node, ["e", "sup"]) ||
          hasChildSequence(node, ["sSupPr", "e", "sup"]))) {
        fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math/superscript");
      }
      break;
    case "sSub":
      if (!(hasChildSequence(node, ["e", "sub"]) ||
          hasChildSequence(node, ["sSubPr", "e", "sub"]))) {
        fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math/subscript");
      }
      break;
    case "sSubSup":
      if (!(hasChildSequence(node, ["e", "sub", "sup"]) ||
          hasChildSequence(node, ["sSubSupPr", "e", "sub", "sup"]))) {
        fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math/subSuperscript");
      }
      break;
    case "rad":
      if (!(hasChildSequence(node, ["deg", "e"]) ||
          hasChildSequence(node, ["radPr", "deg", "e"]))) {
        fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math/radical");
      }
      break;
    case "radPr":
      if (!hasChildSequence(node, ["degHide"])) {
        fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math/radicalProperties");
      }
      break;
    case "deg":
      if (!hasExpressionChildren(node, { allowEmpty: true })) {
        fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math/degree");
      }
      break;
    default:
      fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math");
  }
  for (const child of node.children) validateOmmlStructure(child);
}

function parseTypedOmml(fragment) {
  let parsed;
  try {
    parsed = parseStrictXml(encoder.encode(fragment));
  } catch {
    fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/unboundOmmlFragment");
  }
  const root = parsed.root;
  if (root.namespaceURI !== NS.m || root.localName !== "oMath" ||
      root.attributes.size !== 0 || parsed.namespaceUris.size !== 2 ||
      !parsed.namespaceUris.has(NS.xml) || !parsed.namespaceUris.has(NS.m)) {
    fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math");
  }
  const nodes = [];
  const pending = [root];
  let runCount = 0;
  let textBytes = 0;
  while (pending.length > 0) {
    const node = pending.pop();
    nodes.push(node);
    if (node.namespaceURI !== NS.m || !ALLOWED_OMML_ELEMENTS.has(node.localName)) {
      fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math");
    }
    if (node.localName === "r") runCount += 1;
    if (node.localName === "t") {
      if (node.children.length !== 0 || node.text.length === 0 ||
          (node.attributes.size === 1 && attribute(node, NS.xml, "space") !== "preserve") ||
          node.attributes.size > 1) {
        fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math/text");
      }
      textBytes += encoder.encode(node.text).byteLength;
    } else {
      if (node.text !== "") fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math");
      if (node.localName === "type") {
        if (node.attributes.size !== 1 || attribute(node, NS.m, "val") !== "bar") {
          fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math/fractionType");
        }
      } else if (node.localName === "degHide") {
        if (node.attributes.size !== 1 || attribute(node, NS.m, "val") !== "1") {
          fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math/degreeHidden");
        }
      } else if (node.attributes.size !== 0) {
        fail(ERROR_CODES.DISPATCH_INVALID, "/output/formula/math");
      }
    }
    pending.push(...node.children);
  }
  if (nodes.length > MAX_TARGET_OMML_ELEMENTS || runCount < 1 ||
      runCount > MAX_TARGET_OMML_RUNS || textBytes < 1 ||
      textBytes > MAX_TARGET_OMML_TEXT_BYTES) {
    fail(ERROR_CODES.TARGET_INVALID, "/output/formula/capacity");
  }
  validateOmmlStructure(root);
  return Object.freeze({
    root: cloneXmlNode(root),
    capacity: Object.freeze({
      maxElements: MAX_TARGET_OMML_ELEMENTS,
      maxRuns: MAX_TARGET_OMML_RUNS,
      maxTextBytes: MAX_TARGET_OMML_TEXT_BYTES
    }),
    observed: Object.freeze({ elements: nodes.length, runs: runCount, textBytes })
  });
}

function formulaMathParagraph(typedOmml) {
  return makeElement(NS.m, "oMathPara", [], [
    makeElement(NS.m, "oMathParaPr", [], [
      makeElement(NS.m, "jc", [[NS.m, "val", "centerGroup"]])
    ]),
    decorateFormulaRuns(typedOmml.root)
  ]);
}

function formulaRunProperties(localName) {
  return makeElement(NS.a, localName, [
    ["", "lang", "en-US"],
    ["", "sz", FORMULA_FONT_SIZE_HUNDREDTH_POINTS]
  ], [
    makeElement(NS.a, "latin", [["", "typeface", FORMULA_TYPEFACE]])
  ]);
}

function decorateFormulaRuns(node) {
  const output = cloneXmlNode(node);
  output.children = output.children.map(decorateFormulaRuns);
  if (output.namespaceURI === NS.m && output.localName === "r") {
    output.children.unshift(formulaRunProperties("rPr"));
  }
  return output;
}

function linearizeFormulaNode(node) {
  const text = (child) => linearizeFormulaNode(child);
  const children = () => node.children.map(text).join("");
  const named = (localName) => node.children.find((child) =>
    child.namespaceURI === NS.m && child.localName === localName);
  switch (node.localName) {
    case "t":
      return node.text;
    case "oMath":
    case "r":
    case "num":
    case "den":
    case "e":
    case "sup":
    case "sub":
    case "deg":
      return children();
    case "f":
      return `(${text(named("num"))}) / (${text(named("den"))})`;
    case "sSup":
      return `${text(named("e"))}^(${text(named("sup"))})`;
    case "sSub":
      return `${text(named("e"))}_(${text(named("sub"))})`;
    case "sSubSup":
      return `${text(named("e"))}_(${text(named("sub"))})^(${text(named("sup"))})`;
    case "rad": {
      const degree = text(named("deg"));
      return `${degree}√(${text(named("e"))})`;
    }
    case "fPr":
    case "type":
    case "sSupPr":
    case "sSubPr":
    case "sSubSupPr":
    case "radPr":
    case "degHide":
      return "";
    default:
      fail(ERROR_CODES.OUTPUT_INVALID, "/output/formula/fallback");
  }
}

function replaceShapeTextBodyWithEditableFallback(shape, typedOmml, code, pointer) {
  const output = cloneXmlNode(shape);
  const txBody = oneDirectChild(output, NS.p, "txBody", `${pointer}/txBody`, code);
  if (txBody.children.length !== 3 ||
      txBody.children[0].namespaceURI !== NS.a || txBody.children[0].localName !== "bodyPr" ||
      txBody.children[1].namespaceURI !== NS.a || txBody.children[1].localName !== "lstStyle" ||
      txBody.children[2].namespaceURI !== NS.a || txBody.children[2].localName !== "p") {
    fail(code, `${pointer}/txBody`);
  }
  const paragraph = txBody.children[2];
  const pPr = oneDirectChild(paragraph, NS.a, "pPr", `${pointer}/paragraph`, code);
  const fallbackText = linearizeFormulaNode(typedOmml.root);
  if (fallbackText.length === 0 || encoder.encode(fallbackText).byteLength > 512) {
    fail(code, `${pointer}/fallbackText`);
  }
  paragraph.children = [
    cloneXmlNode(pPr),
    makeElement(NS.a, "r", [], [
      formulaRunProperties("rPr"),
      makeElement(NS.a, "t", [], [], fallbackText)
    ]),
    formulaRunProperties("endParaRPr")
  ];
  return output;
}

function replaceShapeTextBody(shape, typedOmml, code, pointer) {
  const output = cloneXmlNode(shape);
  const nvSpPr = oneDirectChild(output, NS.p, "nvSpPr", `${pointer}/nvSpPr`, code);
  const cNvSpPr = oneDirectChild(nvSpPr, NS.p, "cNvSpPr", `${pointer}/cNvSpPr`, code);
  if (cNvSpPr.attributes.size !== 1 || attribute(cNvSpPr, "", "txBox") !== "1") {
    fail(code, `${pointer}/cNvSpPr`);
  }
  cNvSpPr.attributes = new Map();
  const txBody = oneDirectChild(output, NS.p, "txBody", `${pointer}/txBody`, code);
  if (txBody.children.length !== 3 ||
      txBody.children[0].namespaceURI !== NS.a || txBody.children[0].localName !== "bodyPr" ||
      txBody.children[1].namespaceURI !== NS.a || txBody.children[1].localName !== "lstStyle" ||
      txBody.children[2].namespaceURI !== NS.a || txBody.children[2].localName !== "p") {
    fail(code, `${pointer}/txBody`);
  }
  const paragraph = txBody.children[2];
  const pPr = oneDirectChild(paragraph, NS.a, "pPr", `${pointer}/paragraph`, code);
  const run = oneDirectChild(paragraph, NS.a, "r", `${pointer}/paragraph`, code);
  const end = oneDirectChild(paragraph, NS.a, "endParaRPr", `${pointer}/paragraph`, code);
  if (paragraph.children.length !== 3 ||
      run.children.length !== 2 ||
      run.children[0].namespaceURI !== NS.a || run.children[0].localName !== "rPr" ||
      run.children[1].namespaceURI !== NS.a || run.children[1].localName !== "t") {
    fail(code, `${pointer}/paragraph`);
  }
  paragraph.children = [
    cloneXmlNode(pPr),
    makeElement(NS.a14, "m", [], [formulaMathParagraph(typedOmml)]),
    formulaRunProperties("endParaRPr")
  ];
  return output;
}

function wrapFormulaShape(shape, fallbackShape) {
  return makeElement(NS.mc, "AlternateContent", [], [
    makeElement(NS.mc, "Choice", [["", "Requires", "a14"]], [shape]),
    makeElement(NS.mc, "Fallback", [], [fallbackShape])
  ]);
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
      ? [Object.freeze({ partPath: slidePart, reason: "native-omml-formula-replacement" })]
      : []),
    collateralChanges: Object.freeze(collateralChanges)
  });
}

function hasRelationshipAttribute(node) {
  return [...node.attributes.values()].some((item) => item.namespaceURI === NS.r) ||
    node.children.some(hasRelationshipAttribute);
}

function verifyOutput({
  archiveBytes,
  sourceParts,
  slidePart,
  baseSlideBytes,
  targetSourceId,
  baseShape,
  expectedShape,
  expectedFallbackShape
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
  let parsed;
  try {
    parsed = parseStrictXml(outputParts.get(slidePart)).root;
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, "/output/slide");
  }
  const mathZones = descendants(parsed, NS.a14, "m");
  const mathParagraphs = descendants(parsed, NS.m, "oMathPara");
  const formulas = descendants(parsed, NS.m, "oMath");
  if (parsed.attributes.size !== 0 ||
      mathZones.length !== 1 || mathParagraphs.length !== 1 || formulas.length !== 1 ||
      mathZones[0].children.length !== 1 ||
      mathZones[0].children[0] !== mathParagraphs[0] ||
      mathParagraphs[0].children.length !== 2 ||
      mathParagraphs[0].children[1] !== formulas[0]) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/output/slide/mathCompatibility");
  }
  const spTree = locateSlideTree(parsed, ERROR_CODES.OUTPUT_INVALID, "/output/slide");
  const alternates = directChildren(spTree, NS.mc, "AlternateContent");
  const choice = alternates.length === 1
    ? oneDirectChild(
      alternates[0],
      NS.mc,
      "Choice",
      "/output/slide/formulaTarget",
      ERROR_CODES.OUTPUT_INVALID
    )
    : undefined;
  const fallback = alternates.length === 1
    ? oneDirectChild(
      alternates[0],
      NS.mc,
      "Fallback",
      "/output/slide/formulaFallback",
      ERROR_CODES.OUTPUT_INVALID
    )
    : undefined;
  const target = choice?.children.length === 1 ? choice.children[0] : undefined;
  const fallbackTarget = fallback?.children.length === 1 ? fallback.children[0] : undefined;
  if (alternates[0]?.children.length !== 2 || choice === undefined ||
      attribute(choice, "", "Requires") !== "a14" ||
      target === undefined || directShapeId(
        target,
        ERROR_CODES.OUTPUT_INVALID,
        "/output/slide/formulaTarget"
      ) !== targetSourceId || serializeNode(target) !== serializeNode(expectedShape) ||
      fallbackTarget === undefined || directShapeId(
        fallbackTarget,
        ERROR_CODES.OUTPUT_INVALID,
        "/output/slide/formulaFallback"
      ) !== targetSourceId ||
      serializeNode(fallbackTarget) !== serializeNode(expectedFallbackShape) ||
      descendants(fallbackTarget, NS.a14, "m").length !== 0 ||
      descendants(fallbackTarget, NS.m, "oMath").length !== 0 ||
      hasRelationshipAttribute(alternates[0])) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/output/slide/formulaTarget");
  }
  const targetIndex = spTree.children.indexOf(alternates[0]);
  spTree.children.splice(targetIndex, 1, cloneXmlNode(baseShape));
  if (!serializeDocument(parsed).equals(baseSlideBytes)) {
    fail(ERROR_CODES.COLLATERAL_CHANGE, "/output/slide");
  }
}

function captureSourcePreservingBase(sourceArchiveBytes, templateIndex) {
  const sourceSnapshot = snapshotArchiveBytes(sourceArchiveBytes, "/sourceArchiveBytes");
  const templateFormat = dataValue(templateIndex, "templateFormat");
  if (templateFormat !== "potx" && templateFormat !== "pptx") {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/templateIndex/templateFormat");
  }
  let sourceView;
  let sourceParts;
  let index;
  try {
    sourceView = buildSecureTemplatePackageView({
      sourceLocation: path.resolve(`/source.${templateFormat}`),
      archiveBytes: sourceSnapshot
    });
    sourceParts = parseSecureZip(sourceSnapshot);
    index = verifyCreateOnlyTemplateIndexAgainstSourceView(
      templateIndex,
      sourceView,
      sha256(sourceSnapshot)
    );
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/sourceArchiveBytes");
  }
  const slide = index.slides[0];
  const sourceSlideBytes = sourceParts.get(slide.partPath);
  const contentTypesBytes = sourceParts.get("[Content_Types].xml");
  if (sourceSlideBytes === undefined || contentTypesBytes === undefined) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/sourceArchiveBytes");
  }
  let sourceRoot;
  let canonicalSlideBytes;
  let normalizedContentTypes;
  try {
    sourceRoot = parseStrictXml(sourceSlideBytes).root;
    canonicalSlideBytes = serializeDocument(sourceRoot);
    normalizedContentTypes = rewriteTemplateMainContentTypeForPptx(contentTypesBytes);
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/sourceArchiveBytes");
  }
  if (containsNamespace(sourceRoot, NS.a14) || containsNamespace(sourceRoot, NS.m) ||
      containsNamespace(sourceRoot, NS.mc)) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/sourceArchiveBytes/slide");
  }
  const baseParts = new Map(
    [...sourceParts].map(([partName, bytes]) => [partName, Buffer.from(bytes)])
  );
  baseParts.set("[Content_Types].xml", normalizedContentTypes);
  baseParts.set(slide.partPath, canonicalSlideBytes);
  let baseArchiveBytes;
  try {
    baseArchiveBytes = createDeterministicZip(baseParts);
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, "/baseArtifact");
  }
  return Object.freeze({
    baseArchiveBytes,
    authority: Object.freeze({
      sourceSlideKey: slide.slideKey,
      slidePart: slide.partPath,
      slideSizeEmu: Object.freeze({ ...index.slideSizeEmu }),
      shapes: Object.freeze(slide.shapes.map((shape) => Object.freeze({
        shapeKey: shape.shapeKey,
        sourceId: shape.sourceId,
        kind: shape.kind,
        geometry: Object.freeze({ ...shape.geometry })
      })))
    })
  });
}

function authenticateArtifact(options) {
  const descriptors = exactRecord(options, ["archiveBytes", "report"], "/artifact");
  const archiveBytes = descriptors.archiveBytes.value;
  const report = descriptors.report.value;
  if (!Buffer.isBuffer(archiveBytes)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/artifact/archiveBytes");
  }
  const facts = authenticNativeOmmlReports.get(report);
  if (facts === undefined) fail(ERROR_CODES.ARGUMENT_INVALID, "/artifact/report");
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
  return { snapshot, facts };
}

/** @internal Authenticate one exact verified native-OMML formula artifact. */
export function authenticateNativeOmmlFormulaAssemblyArtifact(options) {
  const authenticated = authenticateArtifact(options);
  return Object.freeze({
    archiveBytes: authenticated.snapshot,
    baseArchiveBytes: Buffer.from(authenticated.facts.baseArchiveBytes),
    authority: authenticated.facts.publicFacts
  });
}

async function assembleNativeOmmlFormulaFromBase({
  baseArchiveBytes,
  authority,
  dispatchPlan
}) {
  let sourceParts;
  try {
    sourceParts = parseSecureZip(baseArchiveBytes);
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/baseArtifact/archiveBytes");
  }
  const baseSlideBytes = sourceParts.get(authority.slidePart);
  if (baseSlideBytes === undefined) fail(ERROR_CODES.SOURCE_MISMATCH, "/baseArtifact/slidePart");
  let baseRoot;
  try {
    baseRoot = parseStrictXml(baseSlideBytes).root;
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/baseArtifact/slide");
  }
  if (!serializeDocument(baseRoot).equals(baseSlideBytes) ||
      containsNamespace(baseRoot, NS.a14) || containsNamespace(baseRoot, NS.m) ||
      containsNamespace(baseRoot, NS.mc)) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/baseArtifact/slide/canonical");
  }

  const dispatchResult = await executeCapabilityDispatch({ plan: dispatchPlan });
  const component = captureFormulaResult(dispatchResult, authority);
  const typedOmml = parseTypedOmml(component.fragment);
  let layoutIr;
  let composedSlidePlan;
  try {
    const targetZOrder = authority.shapes.findIndex((shape) =>
      shape.shapeKey === component.target.shapeKey);
    layoutIr = createBoundedSlotSlideLayoutIr({
      slideId: component.outputSlideId,
      canvas: authority.slideSizeEmu,
      fixedNodes: authority.shapes.flatMap((shape, index) =>
        shape.shapeKey === component.target.shapeKey ? [] : [{
        nodeId: shape.shapeKey,
        sourceKind: "template-shape",
        sourceRef: shape.shapeKey,
        semanticSlotId: shape.shapeKey,
        role: "content",
        geometry: shape.geometry,
        paintOutsetEmu: 0,
        zOrder: index,
        placementIntent: "template-fixed"
      }]),
      slot: {
        slotId: component.targetBindingId,
        outerBox: component.target.geometry,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        alignX: "center",
        alignY: "center",
        allowedSourceKind: "native-component",
        allowedSourceRef: "native-omml-formula"
      },
      placement: {
        nodeId: component.outputSlideId,
        sourceKind: "native-component",
        sourceRef: "native-omml-formula",
        role: "content",
        slotRef: component.targetBindingId,
        size: {
          cx: component.target.geometry.cx,
          cy: component.target.geometry.cy
        },
        paintOutsetEmu: 0,
        zOrder: targetZOrder,
        placementIntent: "slot-aligned-fixed"
      }
    });
    composedSlidePlan = resolveSlideLayoutIr(layoutIr);
  } catch (error) {
    if (error instanceof SlideLayoutIrError) {
      fail(ERROR_CODES.TARGET_INVALID, "/output/replace/targetShapeKey");
    }
    throw error;
  }
  const plannedTarget = composedSlidePlan.nodes.find((node) =>
    node.sourceKind === "native-component" && node.sourceRef === "native-omml-formula");
  if (plannedTarget === undefined ||
      JSON.stringify(plannedTarget.box) !== JSON.stringify(component.target.geometry)) {
    fail(ERROR_CODES.TARGET_INVALID, "/output/replace/targetShapeKey");
  }

  const outputRoot = cloneXmlNode(baseRoot);
  const outputSpTree = locateSlideTree(
    outputRoot,
    ERROR_CODES.SOURCE_MISMATCH,
    "/baseArtifact/slide"
  );
  const targetSourceId = component.target.sourceId;
  const baseSpTree = locateSlideTree(baseRoot, ERROR_CODES.SOURCE_MISMATCH, "/baseArtifact/slide");
  const baseShape = findDirectShape(
    baseSpTree,
    targetSourceId,
    ERROR_CODES.SOURCE_MISMATCH,
    "/baseArtifact/formulaTarget"
  );
  const target = findDirectShape(
    outputSpTree,
    targetSourceId,
    ERROR_CODES.TARGET_INVALID,
    "/output/replace/targetShapeKey"
  );
  const expectedShape = replaceShapeTextBody(
    target,
    typedOmml,
    ERROR_CODES.TARGET_INVALID,
    "/output/formulaTarget"
  );
  const expectedFallbackShape = replaceShapeTextBodyWithEditableFallback(
    target,
    typedOmml,
    ERROR_CODES.TARGET_INVALID,
    "/output/formulaFallback"
  );
  const expectedWrapper = wrapFormulaShape(expectedShape, expectedFallbackShape);
  const targetIndex = outputSpTree.children.indexOf(target);
  outputSpTree.children.splice(targetIndex, 1, expectedWrapper);

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
    baseSlideBytes,
    targetSourceId,
    baseShape,
    expectedShape,
    expectedFallbackShape
  });

  const formulaTarget = Object.freeze({
    targetShapeKey: component.target.shapeKey,
    sourceId: targetSourceId,
    geometry: Object.freeze({ ...plannedTarget.box }),
    structureProfile: "powerpoint-office-2010-text-math",
    fontSizeHundredthPoints: FORMULA_FONT_SIZE_HUNDREDTH_POINTS,
    typeface: FORMULA_TYPEFACE,
    capacity: typedOmml.capacity,
    observed: typedOmml.observed,
    status: "pass"
  });
  const report = Object.freeze({
    assemblyVersion: NATIVE_OMML_FORMULA_ASSEMBLY_VERSION,
    artifactType: "native-omml-formula-assembled-pptx",
    verificationProfile: "target-specific-native-omml-formula-output",
    publicationEligible: false,
    outputSlideId: component.outputSlideId,
    baseOutputSha256: sha256(baseArchiveBytes),
    outputBytes: archiveBytes.length,
    outputSha256: sha256(archiveBytes),
    slidePart: authority.slidePart,
    formulaDigest: sha256(Buffer.from(component.fragment, "utf8")),
    formulaTarget,
    layoutIr,
    composedSlidePlan,
    diff
  });
  const publicFacts = Object.freeze({
    artifactType: report.artifactType,
    verificationProfile: report.verificationProfile,
    publicationEligible: report.publicationEligible,
    authenticatedPublicationProfile: "direct-native-omml-artifact-only",
    outputSlideId: report.outputSlideId,
    outputBytes: report.outputBytes,
    outputSha256: report.outputSha256,
    slidePart: report.slidePart
  });
  authenticNativeOmmlReports.set(report, Object.freeze({
    publicFacts,
    baseArchiveBytes: Buffer.from(baseArchiveBytes)
  }));
  return Object.freeze({ archiveBytes: Buffer.from(archiveBytes), report });
}

/**
 * Replace one authenticated clone/fill text-box target with a typed
 * a14:m + m:oMath tree. This compatibility entry point preserves its existing
 * behavior; its clone/fill content is not automatically final-delivery
 * authority.
 */
export async function assembleNativeOmmlFormulaOnCloneFill(options) {
  let optionDescriptors;
  try {
    optionDescriptors = exactRecord(options, ["baseArtifact", "dispatchPlan"], "/options");
  } catch (error) {
    if (error instanceof NativeOmmlFormulaAssemblyError) throw error;
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
  return assembleNativeOmmlFormulaFromBase({
    baseArchiveBytes: authenticated.archiveBytes,
    authority: authenticated.authority,
    dispatchPlan
  });
}

/**
 * Product candidate entry point. Unchanged authored content stays in the source
 * template; only the formula described by the resolved DeckSpec dispatch is
 * rebuilt. The same typed mutation core is shared with the compatibility path.
 */
export async function assembleNativeOmmlFormulaFromSource(options) {
  let optionDescriptors;
  try {
    optionDescriptors = exactRecord(
      options,
      ["sourceArchiveBytes", "templateIndex", "dispatchPlan"],
      "/options"
    );
  } catch (error) {
    if (error instanceof NativeOmmlFormulaAssemblyError) throw error;
    fail(ERROR_CODES.ARGUMENT_INVALID, "/options");
  }
  const dispatchPlan = captureSingleDispatchPlan(optionDescriptors.dispatchPlan.value);
  const base = captureSourcePreservingBase(
    optionDescriptors.sourceArchiveBytes.value,
    optionDescriptors.templateIndex.value
  );
  return assembleNativeOmmlFormulaFromBase({
    baseArchiveBytes: base.baseArchiveBytes,
    authority: base.authority,
    dispatchPlan
  });
}
