import { parseStrictXml } from "#pptx-compiler/extension-api";

const DRAWINGML_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PRESENTATIONML_NAMESPACE =
  "http://schemas.openxmlformats.org/presentationml/2006/main";
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";

const ANCHOR_ROLE = "anchor";
const MAX_CANVAS_EMU = 100_000_000;
const MIN_WIDTH_EMU = 914_400;
const MIN_HEIGHT_EMU = 457_200;
const MAX_LABEL_CODE_POINTS = 256;
const MAX_LABEL_BYTES = 1_024;
const MAX_FRAGMENT_CODE_UNITS = 8_192;
const LINE_WIDTH_EMU = 12_700;
const TEXT_INSET_EMU = 91_440;
const COLOR = /^[0-9A-F]{6}$/u;
const encoder = new TextEncoder();

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactDataProperties(value, keys) {
  if (!isPlainRecord(value)) return false;
  const allowed = new Set(keys);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !allowed.has(key))) {
    return false;
  }
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
  });
}

function dataProperty(value, key) {
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

function isExactSingleItemArray(value) {
  if (!Array.isArray(value)) return false;
  const length = Object.getOwnPropertyDescriptor(value, "length");
  const item = Object.getOwnPropertyDescriptor(value, "0");
  const keys = Reflect.ownKeys(value);
  return length?.value === 1 && item?.enumerable === true &&
    Object.hasOwn(item, "value") && keys.length === 2 &&
    keys.every((key) => key === "0" || key === "length");
}

function isSafeText(value) {
  if (typeof value !== "string" || value.length === 0 || !/\S/u.test(value) ||
      /\p{Cf}/u.test(value)) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const first = value.charCodeAt(index);
    let codePoint = first;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || second < 0xdc00 || second > 0xdfff) return false;
      codePoint = ((first - 0xd800) * 0x400) + second - 0xdc00 + 0x10000;
      index += 1;
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      return false;
    }
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f) ||
        codePoint === 0x2028 || codePoint === 0x2029 ||
        (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
        (codePoint & 0xfffe) === 0xfffe) {
      return false;
    }
  }
  return true;
}

function isBoundedText(value) {
  if (!isSafeText(value) || value.length > MAX_LABEL_BYTES) return false;
  let codePoints = 0;
  for (const _character of value) {
    codePoints += 1;
    if (codePoints > MAX_LABEL_CODE_POINTS) return false;
  }
  return encoder.encode(value).byteLength <= MAX_LABEL_BYTES;
}

function isIntegerBetween(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function isGeometry(value) {
  if (!hasExactDataProperties(value, ["x", "y", "cx", "cy"])) return false;
  const x = dataProperty(value, "x");
  const y = dataProperty(value, "y");
  const cx = dataProperty(value, "cx");
  const cy = dataProperty(value, "cy");
  return isIntegerBetween(x, 0, MAX_CANVAS_EMU) &&
    isIntegerBetween(y, 0, MAX_CANVAS_EMU) &&
    isIntegerBetween(cx, MIN_WIDTH_EMU, MAX_CANVAS_EMU) &&
    isIntegerBetween(cy, MIN_HEIGHT_EMU, MAX_CANVAS_EMU) &&
    x + cx <= MAX_CANVAS_EMU && y + cy <= MAX_CANVAS_EMU;
}

function isStyle(value) {
  if (!hasExactDataProperties(value, [
    "arrowFill",
    "cardFill",
    "fontSizeHundredthPoints",
    "lineColor",
    "textColor"
  ])) {
    return false;
  }
  return ["arrowFill", "cardFill", "lineColor", "textColor"]
    .every((key) => COLOR.test(dataProperty(value, key))) &&
    isIntegerBetween(dataProperty(value, "fontSizeHundredthPoints"), 800, 4_400);
}

function isSourceBinding(value) {
  if (!hasExactDataProperties(value, [
    "role",
    "shapeBindingId",
    "containerKind",
    "containerKey",
    "shapeKey",
    "expectedKind",
    "cardinality"
  ])) {
    return false;
  }
  return dataProperty(value, "role") === ANCHOR_ROLE &&
    dataProperty(value, "containerKind") === "slide" &&
    dataProperty(value, "expectedKind") === "text-box" &&
    dataProperty(value, "cardinality") === "exactly-one";
}

export function preflightNativeCardArrow(invocation) {
  if (!isPlainRecord(invocation)) return false;
  const bindings = dataProperty(invocation, "bindings");
  const payload = dataProperty(invocation, "payload");
  if (!isExactSingleItemArray(bindings) ||
      !hasExactDataProperties(payload, ["geometry", "label", "style"])) {
    return false;
  }
  return isSourceBinding(dataProperty(bindings, "0")) &&
    isGeometry(dataProperty(payload, "geometry")) &&
    isBoundedText(dataProperty(payload, "label")) &&
    isStyle(dataProperty(payload, "style"));
}

function escapeXmlText(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeXmlAttribute(value) {
  return escapeXmlText(String(value)).replaceAll('"', "&quot;");
}

const SERIALIZER_ELEMENTS = new Set([
  "p:grpSp", "p:nvGrpSpPr", "p:cNvPr", "p:cNvGrpSpPr", "p:nvPr", "p:grpSpPr",
  "p:sp", "p:nvSpPr", "p:cNvSpPr", "p:spPr", "p:txBody",
  "a:xfrm", "a:off", "a:ext", "a:chOff", "a:chExt", "a:prstGeom", "a:avLst",
  "a:solidFill", "a:srgbClr", "a:ln", "a:bodyPr", "a:lstStyle", "a:p", "a:pPr",
  "a:r", "a:rPr", "a:t", "a:endParaRPr"
]);
const SERIALIZER_ATTRIBUTES = new Set([
  "xmlns:a", "xmlns:p", "xml:space", "id", "name", "x", "y", "cx", "cy", "prst",
  "val", "w", "anchor", "lIns", "rIns", "tIns", "bIns", "wrap", "algn", "sz"
]);

function xmlElement(name, attributes = [], children = []) {
  if (!SERIALIZER_ELEMENTS.has(name) ||
      attributes.some(([attributeName]) => !SERIALIZER_ATTRIBUTES.has(attributeName))) {
    throw new TypeError("native-card-arrow-serializer-vocabulary");
  }
  return { type: "element", name, attributes, children };
}

function xmlText(value) {
  return { type: "text", value };
}

function serializeXmlNode(node) {
  if (node.type === "text") return escapeXmlText(node.value);
  const attributes = node.attributes
    .map(([name, value]) => ` ${name}="${escapeXmlAttribute(value)}"`)
    .join("");
  if (node.children.length === 0) return `<${node.name}${attributes}/>`;
  return `<${node.name}${attributes}>${node.children.map(serializeXmlNode).join("")}` +
    `</${node.name}>`;
}

function deriveGeometry({ x, y, cx, cy }) {
  const cardCx = Math.floor((cx * 7) / 10);
  const gapCx = Math.floor(cx / 10);
  const arrowCx = cx - cardCx - gapCx;
  const arrowCy = Math.floor(cy / 2);
  const arrowX = cardCx + gapCx;
  const arrowY = Math.floor((cy - arrowCy) / 2);
  return { x, y, cx, cy, cardCx, arrowCx, arrowCy, arrowX, arrowY };
}

function renderNativeCardArrowFragment(payload) {
  const geometry = deriveGeometry(payload.geometry);
  const style = payload.style;
  const solidFill = (color) => xmlElement("a:solidFill", [], [
    xmlElement("a:srgbClr", [["val", color]])
  ]);
  const line = () => xmlElement("a:ln", [["w", LINE_WIDTH_EMU]], [
    solidFill(style.lineColor)
  ]);
  const shapeTransform = (x, y, cx, cy) => xmlElement("a:xfrm", [], [
    xmlElement("a:off", [["x", x], ["y", y]]),
    xmlElement("a:ext", [["cx", cx], ["cy", cy]])
  ]);
  const nonVisualShape = (id, name) => xmlElement("p:nvSpPr", [], [
    xmlElement("p:cNvPr", [["id", id], ["name", name]]),
    xmlElement("p:cNvSpPr"),
    xmlElement("p:nvPr")
  ]);
  const presetGeometry = (preset) => xmlElement("a:prstGeom", [["prst", preset]], [
    xmlElement("a:avLst")
  ]);

  const card = xmlElement("p:sp", [], [
    nonVisualShape(2, "Native Card"),
    xmlElement("p:spPr", [], [
      shapeTransform(0, 0, geometry.cardCx, geometry.cy),
      presetGeometry("roundRect"),
      solidFill(style.cardFill),
      line()
    ]),
    xmlElement("p:txBody", [], [
      xmlElement("a:bodyPr", [
        ["anchor", "ctr"],
        ["lIns", TEXT_INSET_EMU],
        ["rIns", TEXT_INSET_EMU],
        ["tIns", TEXT_INSET_EMU],
        ["bIns", TEXT_INSET_EMU],
        ["wrap", "square"]
      ]),
      xmlElement("a:lstStyle"),
      xmlElement("a:p", [], [
        xmlElement("a:pPr", [["algn", "ctr"]]),
        xmlElement("a:r", [], [
          xmlElement("a:rPr", [["sz", style.fontSizeHundredthPoints]], [
            solidFill(style.textColor)
          ]),
          xmlElement("a:t", [["xml:space", "preserve"]], [xmlText(payload.label)])
        ]),
        xmlElement("a:endParaRPr")
      ])
    ])
  ]);
  const arrow = xmlElement("p:sp", [], [
    nonVisualShape(3, "Native Arrow"),
    xmlElement("p:spPr", [], [
      shapeTransform(geometry.arrowX, geometry.arrowY, geometry.arrowCx, geometry.arrowCy),
      presetGeometry("rightArrow"),
      solidFill(style.arrowFill),
      line()
    ])
  ]);
  const group = xmlElement("p:grpSp", [
    ["xmlns:a", DRAWINGML_NAMESPACE],
    ["xmlns:p", PRESENTATIONML_NAMESPACE]
  ], [
    xmlElement("p:nvGrpSpPr", [], [
      xmlElement("p:cNvPr", [["id", 1], ["name", "Native Card Arrow"]]),
      xmlElement("p:cNvGrpSpPr"),
      xmlElement("p:nvPr")
    ]),
    xmlElement("p:grpSpPr", [], [
      xmlElement("a:xfrm", [], [
        xmlElement("a:off", [["x", geometry.x], ["y", geometry.y]]),
        xmlElement("a:ext", [["cx", geometry.cx], ["cy", geometry.cy]]),
        xmlElement("a:chOff", [["x", 0], ["y", 0]]),
        xmlElement("a:chExt", [["cx", geometry.cx], ["cy", geometry.cy]])
      ])
    ]),
    card,
    arrow
  ]);
  return serializeXmlNode(group);
}

function nodeIs(node, namespaceURI, localName) {
  return node?.namespaceURI === namespaceURI && node?.localName === localName;
}

function attributeValues(nodes, localName) {
  return nodes.map((node) => node.attributes.get(`\u0000${localName}`)?.value);
}

function collectNodes(root) {
  const nodes = [];
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    nodes.push(node);
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push(node.children[index]);
    }
  }
  return nodes;
}

const ALLOWED_ELEMENTS = new Set([
  `${PRESENTATIONML_NAMESPACE}\u0000grpSp`,
  `${PRESENTATIONML_NAMESPACE}\u0000nvGrpSpPr`,
  `${PRESENTATIONML_NAMESPACE}\u0000cNvPr`,
  `${PRESENTATIONML_NAMESPACE}\u0000cNvGrpSpPr`,
  `${PRESENTATIONML_NAMESPACE}\u0000nvPr`,
  `${PRESENTATIONML_NAMESPACE}\u0000grpSpPr`,
  `${PRESENTATIONML_NAMESPACE}\u0000sp`,
  `${PRESENTATIONML_NAMESPACE}\u0000nvSpPr`,
  `${PRESENTATIONML_NAMESPACE}\u0000cNvSpPr`,
  `${PRESENTATIONML_NAMESPACE}\u0000spPr`,
  `${PRESENTATIONML_NAMESPACE}\u0000txBody`,
  `${DRAWINGML_NAMESPACE}\u0000xfrm`,
  `${DRAWINGML_NAMESPACE}\u0000off`,
  `${DRAWINGML_NAMESPACE}\u0000ext`,
  `${DRAWINGML_NAMESPACE}\u0000chOff`,
  `${DRAWINGML_NAMESPACE}\u0000chExt`,
  `${DRAWINGML_NAMESPACE}\u0000prstGeom`,
  `${DRAWINGML_NAMESPACE}\u0000avLst`,
  `${DRAWINGML_NAMESPACE}\u0000solidFill`,
  `${DRAWINGML_NAMESPACE}\u0000srgbClr`,
  `${DRAWINGML_NAMESPACE}\u0000ln`,
  `${DRAWINGML_NAMESPACE}\u0000bodyPr`,
  `${DRAWINGML_NAMESPACE}\u0000lstStyle`,
  `${DRAWINGML_NAMESPACE}\u0000p`,
  `${DRAWINGML_NAMESPACE}\u0000pPr`,
  `${DRAWINGML_NAMESPACE}\u0000r`,
  `${DRAWINGML_NAMESPACE}\u0000rPr`,
  `${DRAWINGML_NAMESPACE}\u0000t`,
  `${DRAWINGML_NAMESPACE}\u0000endParaRPr`
]);

function isNativeCardArrowFragment(fragment, payload) {
  if (typeof fragment !== "string" || fragment.length === 0 ||
      fragment.length > MAX_FRAGMENT_CODE_UNITS ||
      fragment !== renderNativeCardArrowFragment(payload)) {
    return false;
  }
  let parsed;
  try {
    parsed = parseStrictXml(encoder.encode(fragment));
  } catch {
    return false;
  }
  if (!nodeIs(parsed.root, PRESENTATIONML_NAMESPACE, "grpSp") ||
      parsed.counts.elements !== 54 || parsed.counts.attributes !== 40 ||
      parsed.namespaceUris.size !== 3 ||
      !parsed.namespaceUris.has(XML_NAMESPACE) ||
      !parsed.namespaceUris.has(DRAWINGML_NAMESPACE) ||
      !parsed.namespaceUris.has(PRESENTATIONML_NAMESPACE)) {
    return false;
  }
  const nodes = collectNodes(parsed.root);
  if (nodes.some((node) => !ALLOWED_ELEMENTS.has(node.key))) return false;
  const presentationShapes = nodes.filter((node) =>
    nodeIs(node, PRESENTATIONML_NAMESPACE, "sp"));
  const nonVisual = nodes.filter((node) =>
    nodeIs(node, PRESENTATIONML_NAMESPACE, "cNvPr"));
  const geometries = nodes.filter((node) =>
    nodeIs(node, DRAWINGML_NAMESPACE, "prstGeom"));
  const textNodes = nodes.filter((node) => nodeIs(node, DRAWINGML_NAMESPACE, "t"));
  const colors = nodes.filter((node) => nodeIs(node, DRAWINGML_NAMESPACE, "srgbClr"));
  return presentationShapes.length === 2 && nonVisual.length === 3 &&
    geometries.length === 2 && textNodes.length === 1 && colors.length === 5 &&
    nonVisual.every((node) => node.attributes.size === 2) &&
    attributeValues(nonVisual, "id").join(",") === "1,2,3" &&
    attributeValues(nonVisual, "name").join("\u0000") ===
      ["Native Card Arrow", "Native Card", "Native Arrow"].join("\u0000") &&
    attributeValues(geometries, "prst").join(",") === "roundRect,rightArrow" &&
    textNodes[0].text === payload.label &&
    attributeValues(colors, "val").join(",") === [
      payload.style.cardFill,
      payload.style.lineColor,
      payload.style.textColor,
      payload.style.arrowFill,
      payload.style.lineColor
    ].join(",");
}

export function executeNativeCardArrow(invocation) {
  const binding = invocation.bindings[0];
  const payload = invocation.payload;
  return {
    planVersion: "0.1.0",
    planType: "native-card-arrow-plan",
    outputSlideId: invocation.invocationId,
    clone: {
      operationId: "clone-source-slide",
      operationType: "clone-slide",
      sourceContainerKind: "slide",
      sourceSlideKey: binding.containerKey,
    },
    insert: {
      operationId: "insert-native-card-arrow",
      operationType: "insert-drawingml-group-after-anchor",
      role: ANCHOR_ROLE,
      anchorBindingId: binding.shapeBindingId,
      anchorShapeKey: binding.shapeKey,
      expectedKind: binding.expectedKind,
      idPolicy: "local-remap-required"
    },
    component: {
      componentType: "native-card-arrow",
      representation: "native-drawingml-group-shape",
      artifactKind: "unbound-drawingml-conformance-fragment",
      insertable: false,
      idScope: "component-local",
      localShapeIds: [1, 2, 3],
      geometry: { ...payload.geometry },
      label: payload.label,
      style: { ...payload.style },
      unboundDrawingmlFragment: renderNativeCardArrowFragment(payload)
    }
  };
}

function recordsEqual(left, right, keys) {
  return left !== null && right !== null && keys.every((key) => left?.[key] === right?.[key]);
}

export const nativeCardArrowQaAssertions = Object.freeze([
  Object.freeze({
    assertionId: "anchor-binding-contract",
    assert({ invocation, output }) {
      const binding = invocation.bindings?.[0];
      return invocation.bindings?.length === 1 && output.insert?.role === ANCHOR_ROLE &&
        output.clone?.sourceContainerKind === binding?.containerKind &&
        output.clone?.sourceSlideKey === binding?.containerKey &&
        output.insert?.anchorBindingId === binding?.shapeBindingId &&
        output.insert?.anchorShapeKey === binding?.shapeKey &&
        output.insert?.expectedKind === binding?.expectedKind;
    }
  }),
  Object.freeze({
    assertionId: "component-data-contract",
    assert({ invocation, output }) {
      return output.outputSlideId === invocation.invocationId &&
        output.component?.componentType === "native-card-arrow" &&
        output.component?.representation === "native-drawingml-group-shape" &&
        output.component?.artifactKind === "unbound-drawingml-conformance-fragment" &&
        output.component?.insertable === false &&
        output.component?.label === invocation.payload?.label &&
        recordsEqual(output.component?.geometry, invocation.payload?.geometry, ["x", "y", "cx", "cy"]) &&
        recordsEqual(output.component?.style, invocation.payload?.style, [
          "arrowFill",
          "cardFill",
          "fontSizeHundredthPoints",
          "lineColor",
          "textColor"
        ]);
    }
  }),
  Object.freeze({
    assertionId: "native-shape-structure-contract",
    assert({ invocation, output }) {
      return output.insert?.idPolicy === "local-remap-required" &&
        output.component?.idScope === "component-local" &&
        Array.isArray(output.component?.localShapeIds) &&
        output.component.localShapeIds.join(",") === "1,2,3" &&
        isNativeCardArrowFragment(
          output.component?.unboundDrawingmlFragment,
          invocation.payload
        );
    }
  }),
  Object.freeze({
    assertionId: "rendered-fragment-contract",
    assert({ invocation, output }) {
      return output.clone?.operationId === "clone-source-slide" &&
        output.clone?.operationType === "clone-slide" &&
        output.insert?.operationId === "insert-native-card-arrow" &&
        output.insert?.operationType === "insert-drawingml-group-after-anchor" &&
        output.component?.unboundDrawingmlFragment ===
          renderNativeCardArrowFragment(invocation.payload);
    }
  })
]);
