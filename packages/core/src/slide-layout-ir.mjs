import { createHash } from "node:crypto";

export const SLIDE_LAYOUT_IR_VERSION = "0.1.0";
export const COMPOSED_SLIDE_PLAN_VERSION = "0.1.0";

const MAX_EMU = 100_000_000;
const MAX_NODES = 256;
const MAX_PAINT_OUTSET_EMU = 914_400;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ROOT_NODE_ID = "slide-canvas";
const SOURCE_KINDS = new Set(["template-shape", "native-component"]);
const ROLES = new Set(["background", "content", "decoration"]);
const ALIGNMENTS = new Set(["start", "center", "end"]);
const PLACEMENT_INTENTS = new Set([
  "legacy-absolute-fixed",
  "slot-aligned-fixed",
  "template-fixed"
]);

const ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "SLIDE_LAYOUT_IR_ARGUMENT_INVALID",
  CONSTRAINT_INVALID: "SLIDE_LAYOUT_IR_CONSTRAINT_INVALID",
  OCCUPANCY_CONFLICT: "SLIDE_LAYOUT_IR_OCCUPANCY_CONFLICT"
});

export class SlideLayoutIrError extends Error {
  constructor(code, pointer) {
    super(`${code} at ${pointer}`);
    this.name = "SlideLayoutIrError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer) {
  throw new SlideLayoutIrError(code, pointer);
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

function captureRecord(value, expectedKeys, pointer) {
  if (!isPlainRecord(value)) fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  let descriptors;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  const captured = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/${key}`);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function semanticId(value, pointer) {
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  return value;
}

function nonRootNodeId(value, pointer) {
  const id = semanticId(value, pointer);
  if (id === ROOT_NODE_ID) fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  return id;
}

function integer(value, minimum, maximum, pointer) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  return value;
}

function captureBox(value, pointer, allowOriginExtent = false) {
  const fields = captureRecord(value, ["x", "y", "cx", "cy"], pointer);
  const box = {
    x: integer(fields.x, 0, MAX_EMU, `${pointer}/x`),
    y: integer(fields.y, 0, MAX_EMU, `${pointer}/y`),
    cx: integer(fields.cx, allowOriginExtent ? 0 : 1, MAX_EMU, `${pointer}/cx`),
    cy: integer(fields.cy, allowOriginExtent ? 0 : 1, MAX_EMU, `${pointer}/cy`)
  };
  if (box.x + box.cx > MAX_EMU || box.y + box.cy > MAX_EMU) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  return Object.freeze(box);
}

function captureSize(value, pointer) {
  const fields = captureRecord(value, ["cx", "cy"], pointer);
  return Object.freeze({
    cx: integer(fields.cx, 1, MAX_EMU, `${pointer}/cx`),
    cy: integer(fields.cy, 1, MAX_EMU, `${pointer}/cy`)
  });
}

function capturePadding(value, pointer) {
  const fields = captureRecord(value, ["top", "right", "bottom", "left"], pointer);
  return Object.freeze({
    top: integer(fields.top, 0, MAX_EMU, `${pointer}/top`),
    right: integer(fields.right, 0, MAX_EMU, `${pointer}/right`),
    bottom: integer(fields.bottom, 0, MAX_EMU, `${pointer}/bottom`),
    left: integer(fields.left, 0, MAX_EMU, `${pointer}/left`)
  });
}

function captureCanvas(value, pointer) {
  const canvas = captureBox(
    { x: 0, y: 0, ...captureRecord(value, ["cx", "cy"], pointer) },
    pointer,
    true
  );
  if (canvas.x !== 0 || canvas.y !== 0 || canvas.cx < 1 || canvas.cy < 1) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  return canvas;
}

function exactArray(value, pointer, minimum = 0, maximum = MAX_NODES) {
  let array;
  let prototype;
  let descriptors;
  try {
    array = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  const length = descriptors.length?.value;
  if (!array || prototype !== Array.prototype || !Number.isSafeInteger(length) ||
      length < minimum || length > maximum ||
      Reflect.ownKeys(descriptors).length !== length + 1) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  const output = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/${index}`);
    }
    output.push(descriptor.value);
  }
  return output;
}

function captureNodeInput(
  value,
  index,
  { parentNodeId = "slide-canvas", pointerRoot = "/options/nodes", positionMode = "absolute" } = {}
) {
  const pointer = `${pointerRoot}/${index}`;
  const fields = captureRecord(value, [
    "nodeId",
    "sourceKind",
    "sourceRef",
    "semanticSlotId",
    "role",
    "geometry",
    "paintOutsetEmu",
    "zOrder",
    "placementIntent"
  ], pointer);
  const sourceKind = fields.sourceKind;
  const role = fields.role;
  const placementIntent = fields.placementIntent;
  if (!SOURCE_KINDS.has(sourceKind)) fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/sourceKind`);
  if (!ROLES.has(role)) fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/role`);
  if (!PLACEMENT_INTENTS.has(placementIntent)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/placementIntent`);
  }
  if (positionMode !== "absolute" && positionMode !== "flow") {
    fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/positionMode`);
  }
  const requestedBox = captureBox(fields.geometry, `${pointer}/geometry`);
  const paintOutsetEmu = integer(
    fields.paintOutsetEmu,
    0,
    MAX_PAINT_OUTSET_EMU,
    `${pointer}/paintOutsetEmu`
  );
  return Object.freeze({
    nodeId: nonRootNodeId(fields.nodeId, `${pointer}/nodeId`),
    sourceKind,
    sourceRef: semanticId(fields.sourceRef, `${pointer}/sourceRef`),
    parentNodeId: semanticId(parentNodeId, `${pointer}/parentNodeId`),
    semanticSlotId: semanticId(fields.semanticSlotId, `${pointer}/semanticSlotId`),
    role,
    positionMode,
    placementIntent,
    sizing: Object.freeze({
      horizontal: "fixed",
      vertical: "fixed",
      minCx: requestedBox.cx,
      maxCx: requestedBox.cx,
      minCy: requestedBox.cy,
      maxCy: requestedBox.cy
    }),
    requestedBox,
    paintOutset: Object.freeze({
      top: paintOutsetEmu,
      right: paintOutsetEmu,
      bottom: paintOutsetEmu,
      left: paintOutsetEmu
    }),
    zOrder: integer(fields.zOrder, 0, MAX_NODES - 1, `${pointer}/zOrder`),
    collisionPolicy: role === "background" ? "allow" : "forbid"
  });
}

function captureArrayNodes(value, pointer = "/options/nodes") {
  return exactArray(value, pointer, 1).map((node, index) =>
    captureNodeInput(node, index, { pointerRoot: pointer }));
}

function validateNodeIdentity(nodes, pointer) {
  const nodeIds = new Set();
  const zOrders = new Set();
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (nodeIds.has(node.nodeId)) fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/${index}/nodeId`);
    if (zOrders.has(node.zOrder)) fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/${index}/zOrder`);
    nodeIds.add(node.nodeId);
    zOrders.add(node.zOrder);
  }
}

function frozenStringArray(values) {
  return Object.freeze([...values]);
}

function makeContainmentConstraint(nodes) {
  return Object.freeze({
    constraintId: "slide-content-containment",
    constraintType: "containment",
    containerNodeId: "slide-canvas",
    subjectNodeIds: frozenStringArray(
      nodes.filter((node) => node.role !== "background").map((node) => node.nodeId)
    )
  });
}

function makeOccupancyConstraint(nodes) {
  return Object.freeze({
    constraintId: "slide-content-non-overlap",
    constraintType: "pairwise-non-overlap",
    containerNodeId: "slide-canvas",
    subjectNodeIds: frozenStringArray(
      nodes.filter((node) => node.role === "content").map((node) => node.nodeId)
    )
  });
}

export function createFixedSlideLayoutIr(options) {
  const fields = captureRecord(options, ["slideId", "canvas", "nodes"], "/options");
  const slideId = semanticId(fields.slideId, "/options/slideId");
  const canvas = captureCanvas(fields.canvas, "/options/canvas");
  const nodes = captureArrayNodes(fields.nodes);
  if (nodes.some((node) => node.placementIntent === "slot-aligned-fixed")) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/options/nodes");
  }
  validateNodeIdentity(nodes, "/options/nodes");
  const orderedNodes = Object.freeze([...nodes].sort((left, right) => left.zOrder - right.zOrder));
  return Object.freeze({
    layoutIrVersion: SLIDE_LAYOUT_IR_VERSION,
    layoutIrType: "slide-layout-ir",
    inputProfile: "fixed-absolute-bridge",
    slideId,
    canvas,
    nodes: orderedNodes,
    constraints: Object.freeze([
      makeContainmentConstraint(orderedNodes),
      makeOccupancyConstraint(orderedNodes)
    ])
  });
}

function captureSlotInput(value, pointer) {
  const fields = captureRecord(value, [
    "slotId",
    "outerBox",
    "padding",
    "alignX",
    "alignY",
    "allowedSourceKind",
    "allowedSourceRef"
  ], pointer);
  const slotId = nonRootNodeId(fields.slotId, `${pointer}/slotId`);
  const outerBox = captureBox(fields.outerBox, `${pointer}/outerBox`);
  const padding = capturePadding(fields.padding, `${pointer}/padding`);
  if (padding.left + padding.right >= outerBox.cx ||
      padding.top + padding.bottom >= outerBox.cy) {
    fail(ERROR_CODES.CONSTRAINT_INVALID, `${pointer}/padding`);
  }
  if (!ALIGNMENTS.has(fields.alignX)) fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/alignX`);
  if (!ALIGNMENTS.has(fields.alignY)) fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/alignY`);
  if (!SOURCE_KINDS.has(fields.allowedSourceKind)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/allowedSourceKind`);
  }
  const contentBox = Object.freeze({
    x: outerBox.x + padding.left,
    y: outerBox.y + padding.top,
    cx: outerBox.cx - padding.left - padding.right,
    cy: outerBox.cy - padding.top - padding.bottom
  });
  const input = Object.freeze({
    slotId,
    outerBox,
    padding,
    alignX: fields.alignX,
    alignY: fields.alignY,
    allowedSourceKind: fields.allowedSourceKind,
    allowedSourceRef: semanticId(fields.allowedSourceRef, `${pointer}/allowedSourceRef`)
  });
  const slot = Object.freeze({
    slotId,
    parentNodeId: "slide-canvas",
    outerBox,
    padding,
    contentBox,
    alignX: input.alignX,
    alignY: input.alignY,
    allowedSourceKind: input.allowedSourceKind,
    allowedSourceRef: input.allowedSourceRef,
    overflowPolicy: "reject",
    capacity: Object.freeze({ minChildren: 1, maxChildren: 1 })
  });
  return { input, slot };
}

function capturePlacementInput(value, pointer) {
  const fields = captureRecord(value, [
    "nodeId",
    "sourceKind",
    "sourceRef",
    "role",
    "slotRef",
    "size",
    "paintOutsetEmu",
    "zOrder",
    "placementIntent"
  ], pointer);
  if (!SOURCE_KINDS.has(fields.sourceKind)) fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/sourceKind`);
  if (!ROLES.has(fields.role)) fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/role`);
  if (fields.placementIntent !== "slot-aligned-fixed") {
    fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/placementIntent`);
  }
  return Object.freeze({
    nodeId: nonRootNodeId(fields.nodeId, `${pointer}/nodeId`),
    sourceKind: fields.sourceKind,
    sourceRef: semanticId(fields.sourceRef, `${pointer}/sourceRef`),
    role: fields.role,
    slotRef: nonRootNodeId(fields.slotRef, `${pointer}/slotRef`),
    size: captureSize(fields.size, `${pointer}/size`),
    paintOutsetEmu: integer(
      fields.paintOutsetEmu,
      0,
      MAX_PAINT_OUTSET_EMU,
      `${pointer}/paintOutsetEmu`
    ),
    zOrder: integer(fields.zOrder, 0, MAX_NODES - 1, `${pointer}/zOrder`),
    placementIntent: fields.placementIntent
  });
}

function alignedOffset(origin, available, requested, alignment) {
  if (alignment === "start") return origin;
  if (alignment === "end") return origin + available - requested;
  return origin + Math.floor((available - requested) / 2);
}

function resolveSlotBox(slot, placement) {
  const contentBox = slot.contentBox;
  if (placement.size.cx > contentBox.cx || placement.size.cy > contentBox.cy) {
    fail(ERROR_CODES.CONSTRAINT_INVALID, "/options/placement/size");
  }
  return Object.freeze({
    x: alignedOffset(contentBox.x, contentBox.cx, placement.size.cx, slot.alignX),
    y: alignedOffset(contentBox.y, contentBox.cy, placement.size.cy, slot.alignY),
    cx: placement.size.cx,
    cy: placement.size.cy
  });
}

export function createBoundedSlotSlideLayoutIr(options) {
  const fields = captureRecord(
    options,
    ["slideId", "canvas", "fixedNodes", "slot", "placement"],
    "/options"
  );
  const slideId = semanticId(fields.slideId, "/options/slideId");
  const canvas = captureCanvas(fields.canvas, "/options/canvas");
  const fixedNodes = captureArrayNodes(fields.fixedNodes, "/options/fixedNodes");
  if (fixedNodes.some((node) => node.placementIntent === "slot-aligned-fixed")) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/options/fixedNodes");
  }
  const { input: slotInput, slot } = captureSlotInput(fields.slot, "/options/slot");
  const placement = capturePlacementInput(fields.placement, "/options/placement");
  if (placement.slotRef !== slot.slotId ||
      placement.sourceKind !== slot.allowedSourceKind ||
      placement.sourceRef !== slot.allowedSourceRef || placement.role !== "content") {
    fail(ERROR_CODES.CONSTRAINT_INVALID, "/options/placement");
  }
  if (!contained(slot.outerBox, canvas)) {
    fail(ERROR_CODES.CONSTRAINT_INVALID, "/options/slot/outerBox");
  }
  const geometry = resolveSlotBox(slot, placement);
  const placedNode = captureNodeInput({
    nodeId: placement.nodeId,
    sourceKind: placement.sourceKind,
    sourceRef: placement.sourceRef,
    semanticSlotId: placement.slotRef,
    role: placement.role,
    geometry,
    paintOutsetEmu: placement.paintOutsetEmu,
    zOrder: placement.zOrder,
    placementIntent: placement.placementIntent
  }, fixedNodes.length, {
    parentNodeId: slot.slotId,
    pointerRoot: "/options/nodes",
    positionMode: "flow"
  });
  const nodes = [...fixedNodes, placedNode];
  validateNodeIdentity(nodes, "/options/nodes");
  const orderedNodes = Object.freeze([...nodes].sort((left, right) => left.zOrder - right.zOrder));
  return Object.freeze({
    layoutIrVersion: SLIDE_LAYOUT_IR_VERSION,
    layoutIrType: "slide-layout-ir",
    inputProfile: "bounded-slot-placement",
    slideId,
    canvas,
    slots: Object.freeze([slot]),
    placementRequests: Object.freeze([placement]),
    nodes: orderedNodes,
    constraints: Object.freeze([
      makeContainmentConstraint(orderedNodes),
      Object.freeze({
        constraintId: "semantic-slot-containment",
        constraintType: "slot-containment",
        containerNodeId: slot.slotId,
        subjectNodeIds: frozenStringArray([placement.nodeId])
      }),
      makeOccupancyConstraint(orderedNodes)
    ])
  });
}

function paintBounds(node) {
  return Object.freeze({
    x: node.requestedBox.x - node.paintOutset.left,
    y: node.requestedBox.y - node.paintOutset.top,
    cx: node.requestedBox.cx + node.paintOutset.left + node.paintOutset.right,
    cy: node.requestedBox.cy + node.paintOutset.top + node.paintOutset.bottom
  });
}

function contained(inner, outer) {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.cx <= outer.x + outer.cx &&
    inner.y + inner.cy <= outer.y + outer.cy;
}

function intersects(left, right) {
  return left.x < right.x + right.cx && right.x < left.x + left.cx &&
    left.y < right.y + right.cy && right.y < left.y + left.cy;
}

function capturePersistedNode(value, index) {
  const pointer = `/layoutIr/nodes/${index}`;
  const captured = captureRecord(value, [
    "nodeId",
    "sourceKind",
    "sourceRef",
    "parentNodeId",
    "semanticSlotId",
    "role",
    "positionMode",
    "placementIntent",
    "sizing",
    "requestedBox",
    "paintOutset",
    "zOrder",
    "collisionPolicy"
  ], pointer);
  const sizing = captureRecord(captured.sizing, [
    "horizontal", "vertical", "minCx", "maxCx", "minCy", "maxCy"
  ], `${pointer}/sizing`);
  const requestedBox = captureRecord(
    captured.requestedBox,
    ["x", "y", "cx", "cy"],
    `${pointer}/requestedBox`
  );
  const paintOutset = captureRecord(
    captured.paintOutset,
    ["top", "right", "bottom", "left"],
    `${pointer}/paintOutset`
  );
  if (sizing.horizontal !== "fixed" || sizing.vertical !== "fixed" ||
      sizing.minCx !== requestedBox.cx || sizing.maxCx !== requestedBox.cx ||
      sizing.minCy !== requestedBox.cy || sizing.maxCy !== requestedBox.cy ||
      paintOutset.top !== paintOutset.right || paintOutset.top !== paintOutset.bottom ||
      paintOutset.top !== paintOutset.left ||
      captured.collisionPolicy !== (captured.role === "background" ? "allow" : "forbid")) {
    fail(ERROR_CODES.CONSTRAINT_INVALID, pointer);
  }
  const input = {
    nodeId: captured.nodeId,
    sourceKind: captured.sourceKind,
    sourceRef: captured.sourceRef,
    semanticSlotId: captured.semanticSlotId,
    role: captured.role,
    geometry: requestedBox,
    paintOutsetEmu: paintOutset.top,
    zOrder: captured.zOrder,
    placementIntent: captured.placementIntent
  };
  const node = captureNodeInput(input, index, {
    parentNodeId: captured.parentNodeId,
    pointerRoot: "/layoutIr/nodes",
    positionMode: captured.positionMode
  });
  return { input, node };
}

function captureConstraints(value, expectedCount) {
  return exactArray(value, "/layoutIr/constraints", expectedCount, expectedCount)
    .map((constraint, index) => {
      const pointer = `/layoutIr/constraints/${index}`;
      const captured = captureRecord(constraint, [
        "constraintId", "constraintType", "containerNodeId", "subjectNodeIds"
      ], pointer);
      return {
        constraintId: semanticId(captured.constraintId, `${pointer}/constraintId`),
        constraintType: captured.constraintType,
        containerNodeId: semanticId(captured.containerNodeId, `${pointer}/containerNodeId`),
        subjectNodeIds: exactArray(captured.subjectNodeIds, `${pointer}/subjectNodeIds`)
          .map((nodeId, nodeIndex) => semanticId(
            nodeId,
            `${pointer}/subjectNodeIds/${nodeIndex}`
          ))
      };
    });
}

function assertSameJson(actual, expected, pointer) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(ERROR_CODES.CONSTRAINT_INVALID, pointer);
  }
}

function canonicalFixedLayoutIr(value) {
  const fields = captureRecord(value, [
    "layoutIrVersion",
    "layoutIrType",
    "inputProfile",
    "slideId",
    "canvas",
    "nodes",
    "constraints"
  ], "/layoutIr");
  if (fields.layoutIrVersion !== SLIDE_LAYOUT_IR_VERSION ||
      fields.layoutIrType !== "slide-layout-ir" ||
      fields.inputProfile !== "fixed-absolute-bridge") {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/layoutIr");
  }
  const canvas = captureRecord(fields.canvas, ["x", "y", "cx", "cy"], "/layoutIr/canvas");
  if (canvas.x !== 0 || canvas.y !== 0) {
    fail(ERROR_CODES.CONSTRAINT_INVALID, "/layoutIr/canvas");
  }
  const persistedNodes = exactArray(fields.nodes, "/layoutIr/nodes", 1)
    .map(capturePersistedNode);
  if (persistedNodes.some(({ node }) =>
    node.parentNodeId !== "slide-canvas" || node.positionMode !== "absolute" ||
    node.placementIntent === "slot-aligned-fixed")) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/layoutIr/nodes");
  }
  const recreated = createFixedSlideLayoutIr({
    slideId: fields.slideId,
    canvas: { cx: canvas.cx, cy: canvas.cy },
    nodes: persistedNodes.map(({ input }) => input)
  });
  assertSameJson(persistedNodes.map(({ node }) => node), recreated.nodes, "/layoutIr/nodes");
  assertSameJson(
    captureConstraints(fields.constraints, 2),
    recreated.constraints,
    "/layoutIr/constraints"
  );
  return recreated;
}

function capturePersistedSlot(value) {
  const pointer = "/layoutIr/slots/0";
  const fields = captureRecord(value, [
    "slotId",
    "parentNodeId",
    "outerBox",
    "padding",
    "contentBox",
    "alignX",
    "alignY",
    "allowedSourceKind",
    "allowedSourceRef",
    "overflowPolicy",
    "capacity"
  ], pointer);
  const capacity = captureRecord(fields.capacity, ["minChildren", "maxChildren"], `${pointer}/capacity`);
  if (fields.parentNodeId !== "slide-canvas" || fields.overflowPolicy !== "reject" ||
      capacity.minChildren !== 1 || capacity.maxChildren !== 1) {
    fail(ERROR_CODES.CONSTRAINT_INVALID, pointer);
  }
  const input = {
    slotId: fields.slotId,
    outerBox: fields.outerBox,
    padding: fields.padding,
    alignX: fields.alignX,
    alignY: fields.alignY,
    allowedSourceKind: fields.allowedSourceKind,
    allowedSourceRef: fields.allowedSourceRef
  };
  const captured = captureSlotInput(input, pointer);
  const persistedContentBox = captureBox(fields.contentBox, `${pointer}/contentBox`);
  if (JSON.stringify(persistedContentBox) !== JSON.stringify(captured.slot.contentBox)) {
    fail(ERROR_CODES.CONSTRAINT_INVALID, `${pointer}/contentBox`);
  }
  return captured;
}

function canonicalBoundedSlotLayoutIr(value) {
  const fields = captureRecord(value, [
    "layoutIrVersion",
    "layoutIrType",
    "inputProfile",
    "slideId",
    "canvas",
    "slots",
    "placementRequests",
    "nodes",
    "constraints"
  ], "/layoutIr");
  if (fields.layoutIrVersion !== SLIDE_LAYOUT_IR_VERSION ||
      fields.layoutIrType !== "slide-layout-ir" ||
      fields.inputProfile !== "bounded-slot-placement") {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/layoutIr");
  }
  const canvas = captureRecord(fields.canvas, ["x", "y", "cx", "cy"], "/layoutIr/canvas");
  if (canvas.x !== 0 || canvas.y !== 0) {
    fail(ERROR_CODES.CONSTRAINT_INVALID, "/layoutIr/canvas");
  }
  const slot = capturePersistedSlot(exactArray(fields.slots, "/layoutIr/slots", 1, 1)[0]);
  const placement = capturePlacementInput(
    exactArray(fields.placementRequests, "/layoutIr/placementRequests", 1, 1)[0],
    "/layoutIr/placementRequests/0"
  );
  const persistedNodes = exactArray(fields.nodes, "/layoutIr/nodes", 2)
    .map(capturePersistedNode);
  const placed = persistedNodes.filter(({ node }) => node.nodeId === placement.nodeId);
  const fixed = persistedNodes.filter(({ node }) => node.nodeId !== placement.nodeId);
  if (placed.length !== 1 || placed[0].node.parentNodeId !== slot.slot.slotId ||
      placed[0].node.positionMode !== "flow" ||
      fixed.some(({ node }) => node.parentNodeId !== "slide-canvas" || node.positionMode !== "absolute")) {
    fail(ERROR_CODES.CONSTRAINT_INVALID, "/layoutIr/nodes");
  }
  const recreated = createBoundedSlotSlideLayoutIr({
    slideId: fields.slideId,
    canvas: { cx: canvas.cx, cy: canvas.cy },
    fixedNodes: fixed.map(({ input }) => input),
    slot: slot.input,
    placement
  });
  assertSameJson([slot.slot], recreated.slots, "/layoutIr/slots");
  assertSameJson([placement], recreated.placementRequests, "/layoutIr/placementRequests");
  assertSameJson(persistedNodes.map(({ node }) => node), recreated.nodes, "/layoutIr/nodes");
  assertSameJson(
    captureConstraints(fields.constraints, 3),
    recreated.constraints,
    "/layoutIr/constraints"
  );
  return recreated;
}

function canonicalLayoutIr(value) {
  if (!isPlainRecord(value)) fail(ERROR_CODES.ARGUMENT_INVALID, "/layoutIr");
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, "inputProfile");
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/layoutIr/inputProfile");
  }
  if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/layoutIr/inputProfile");
  }
  if (descriptor.value === "fixed-absolute-bridge") return canonicalFixedLayoutIr(value);
  if (descriptor.value === "bounded-slot-placement") return canonicalBoundedSlotLayoutIr(value);
  fail(ERROR_CODES.ARGUMENT_INVALID, "/layoutIr/inputProfile");
}

function digestJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function constraintIndex(layoutIr, constraintId) {
  return layoutIr.constraints.findIndex((constraint) => constraint.constraintId === constraintId);
}

export function resolveSlideLayoutIr(value) {
  const layoutIr = canonicalLayoutIr(value);
  const resolvedNodes = layoutIr.nodes.map((node) => Object.freeze({
    nodeId: node.nodeId,
    sourceKind: node.sourceKind,
    sourceRef: node.sourceRef,
    parentNodeId: node.parentNodeId,
    semanticSlotId: node.semanticSlotId,
    role: node.role,
    positionMode: node.positionMode,
    placementIntent: node.placementIntent,
    box: node.requestedBox,
    paintBounds: paintBounds(node),
    zOrder: node.zOrder,
    collisionPolicy: node.collisionPolicy
  }));
  const canvas = layoutIr.canvas;
  const containmentChecks = [];
  for (const node of resolvedNodes.filter((candidate) => candidate.role !== "background")) {
    const status = contained(node.paintBounds, canvas) ? "pass" : "fail";
    containmentChecks.push(Object.freeze({ nodeId: node.nodeId, status }));
    if (status === "fail") {
      fail(
        ERROR_CODES.CONSTRAINT_INVALID,
        `/layoutIr/constraints/${constraintIndex(layoutIr, "slide-content-containment")}`
      );
    }
  }

  const slots = Object.freeze([...(layoutIr.slots ?? [])]);
  const slotChecks = [];
  for (const node of resolvedNodes.filter((candidate) => candidate.parentNodeId !== "slide-canvas")) {
    const slot = slots.find((candidate) => candidate.slotId === node.parentNodeId);
    const status = slot !== undefined && contained(node.paintBounds, slot.contentBox) ? "pass" : "fail";
    slotChecks.push(Object.freeze({ nodeId: node.nodeId, slotId: node.parentNodeId, status }));
    if (status === "fail") {
      fail(
        ERROR_CODES.CONSTRAINT_INVALID,
        `/layoutIr/constraints/${constraintIndex(layoutIr, "semantic-slot-containment")}`
      );
    }
  }
  if (layoutIr.inputProfile === "bounded-slot-placement" &&
      slotChecks.length !== layoutIr.placementRequests.length) {
    fail(
      ERROR_CODES.CONSTRAINT_INVALID,
      `/layoutIr/constraints/${constraintIndex(layoutIr, "semantic-slot-containment")}`
    );
  }

  const contentNodes = resolvedNodes.filter((node) => node.role === "content");
  const occupancyChecks = [];
  for (let leftIndex = 0; leftIndex < contentNodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < contentNodes.length; rightIndex += 1) {
      const left = contentNodes[leftIndex];
      const right = contentNodes[rightIndex];
      const status = intersects(left.paintBounds, right.paintBounds) ? "conflict" : "clear";
      occupancyChecks.push(Object.freeze({
        leftNodeId: left.nodeId,
        rightNodeId: right.nodeId,
        status
      }));
      if (status === "conflict") {
        fail(
          ERROR_CODES.OCCUPANCY_CONFLICT,
          `/layoutIr/constraints/${constraintIndex(layoutIr, "slide-content-non-overlap")}`
        );
      }
    }
  }

  const layoutIrDigest = digestJson(layoutIr);
  const constraintReceipt = Object.freeze({
    receiptVersion: "0.1.0",
    status: "pass",
    checkedConstraintIds: Object.freeze(layoutIr.constraints.map((item) => item.constraintId)),
    containmentChecks: Object.freeze(containmentChecks),
    slotChecks: Object.freeze(slotChecks),
    occupancyChecks: Object.freeze(occupancyChecks)
  });
  const planBody = {
    planVersion: COMPOSED_SLIDE_PLAN_VERSION,
    planType: "composed-slide-plan",
    layoutIrDigest,
    slideId: layoutIr.slideId,
    canvas,
    slots,
    nodes: Object.freeze(resolvedNodes),
    constraintReceipt
  };
  return Object.freeze({
    ...planBody,
    planDigest: digestJson(planBody)
  });
}
