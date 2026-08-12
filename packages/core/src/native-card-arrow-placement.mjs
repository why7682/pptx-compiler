import { createHash } from "node:crypto";

import { authenticateCloneFillAssemblyTargetArtifact } from "./create-only-assembly.mjs";
import {
  createBoundedSlotSlideLayoutIr,
  resolveSlideLayoutIr,
  SlideLayoutIrError
} from "./slide-layout-ir.mjs";

export const NATIVE_CARD_ARROW_PLACEMENT_VERSION = "0.1.0";
export const NATIVE_CARD_ARROW_PAINT_OUTSET_EMU = 6_350;

const SLOT_PADDING_EMU = 91_440;
const MIN_WIDTH_EMU = 914_400;
const MIN_HEIGHT_EMU = 457_200;
const MAX_EMU = 100_000_000;
const MAX_SOURCE_SHAPES = 256;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "NATIVE_CARD_ARROW_PLACEMENT_ARGUMENT_INVALID",
  CONSTRAINT_INVALID: "NATIVE_CARD_ARROW_PLACEMENT_CONSTRAINT_INVALID",
  SOURCE_MISMATCH: "NATIVE_CARD_ARROW_PLACEMENT_SOURCE_MISMATCH"
});

export class NativeCardArrowPlacementError extends Error {
  constructor(code, pointer) {
    super(`${code} at ${pointer}`);
    this.name = "NativeCardArrowPlacementError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer) {
  throw new NativeCardArrowPlacementError(code, pointer);
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

function integer(value, minimum, maximum, pointer) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  return value;
}

function captureRequest(value) {
  const pointer = "/request";
  const fields = captureRecord(value, [
    "placementVersion",
    "outputSlideId",
    "slotRef",
    "placementIntent",
    "preferredSize"
  ], pointer);
  if (fields.placementVersion !== NATIVE_CARD_ARROW_PLACEMENT_VERSION) {
    fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/placementVersion`);
  }
  if (fields.slotRef !== "slide-content-tail") {
    fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/slotRef`);
  }
  if (fields.placementIntent !== "slot-aligned-fixed") {
    fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/placementIntent`);
  }
  const sizeFields = captureRecord(fields.preferredSize, ["cx", "cy"], `${pointer}/preferredSize`);
  return Object.freeze({
    placementVersion: fields.placementVersion,
    outputSlideId: semanticId(fields.outputSlideId, `${pointer}/outputSlideId`),
    slotRef: fields.slotRef,
    placementIntent: fields.placementIntent,
    preferredSize: Object.freeze({
      cx: integer(sizeFields.cx, MIN_WIDTH_EMU, MAX_EMU, `${pointer}/preferredSize/cx`),
      cy: integer(sizeFields.cy, MIN_HEIGHT_EMU, MAX_EMU, `${pointer}/preferredSize/cy`)
    })
  });
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function contentEnvelope(shapes) {
  const left = Math.min(...shapes.map((shape) => shape.geometry.x));
  const top = Math.min(...shapes.map((shape) => shape.geometry.y));
  const right = Math.max(...shapes.map((shape) => shape.geometry.x + shape.geometry.cx));
  const bottom = Math.max(...shapes.map((shape) => shape.geometry.y + shape.geometry.cy));
  return Object.freeze({ x: left, y: top, cx: right - left, cy: bottom - top });
}

function captureSlideSize(value) {
  const fields = captureRecord(value, ["cx", "cy"], "/facts/slideSizeEmu");
  return Object.freeze({
    cx: integer(fields.cx, 1, MAX_EMU, "/facts/slideSizeEmu/cx"),
    cy: integer(fields.cy, 1, MAX_EMU, "/facts/slideSizeEmu/cy")
  });
}

function captureSourceShapes(value, slideSizeEmu) {
  let descriptors;
  let isArray;
  let prototype;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/facts/sourceShapes");
  }
  const length = descriptors.length?.value;
  if (!isArray || prototype !== Array.prototype || !Number.isSafeInteger(length) ||
      length < 1 || length > MAX_SOURCE_SHAPES ||
      Reflect.ownKeys(descriptors).length !== length + 1) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/facts/sourceShapes");
  }
  const shapes = [];
  const shapeKeys = new Set();
  for (let index = 0; index < length; index += 1) {
    const pointer = `/facts/sourceShapes/${index}`;
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
    }
    const fields = captureRecord(descriptor.value, ["shapeKey", "geometry"], pointer);
    const shapeKey = semanticId(fields.shapeKey, `${pointer}/shapeKey`);
    if (shapeKeys.has(shapeKey)) fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/shapeKey`);
    shapeKeys.add(shapeKey);
    const geometryFields = captureRecord(
      fields.geometry,
      ["x", "y", "cx", "cy"],
      `${pointer}/geometry`
    );
    const geometry = Object.freeze({
      x: integer(geometryFields.x, 0, MAX_EMU, `${pointer}/geometry/x`),
      y: integer(geometryFields.y, 0, MAX_EMU, `${pointer}/geometry/y`),
      cx: integer(geometryFields.cx, 1, MAX_EMU, `${pointer}/geometry/cx`),
      cy: integer(geometryFields.cy, 1, MAX_EMU, `${pointer}/geometry/cy`)
    });
    if (geometry.x + geometry.cx > slideSizeEmu.cx ||
        geometry.y + geometry.cy > slideSizeEmu.cy) {
      fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/geometry`);
    }
    shapes.push(Object.freeze({ shapeKey, geometry }));
  }
  return Object.freeze(shapes);
}

/**
 * @internal Deterministically derive the complete slot IR and composed plan
 * from already authenticated, readable source facts. Both generation and
 * final-delivery verification use this function so geometry and relationship
 * receipts cannot drift into separate implementations.
 */
export function deriveNativeCardArrowSlotPlacementFromFacts(options) {
  const fields = captureRecord(
    options,
    ["sourceShapes", "slideSizeEmu", "request"],
    "/facts"
  );
  const slideSizeEmu = captureSlideSize(fields.slideSizeEmu);
  const sourceShapes = captureSourceShapes(fields.sourceShapes, slideSizeEmu);
  const request = captureRequest(fields.request);
  const envelope = contentEnvelope(sourceShapes);
  const right = envelope.x + envelope.cx;
  const bottom = envelope.y + envelope.cy;
  const rightMargin = slideSizeEmu.cx - right;
  const bottomMarginEmu = Math.min(envelope.x, rightMargin);
  if (!Number.isSafeInteger(bottomMarginEmu) || bottomMarginEmu < 0 ||
      bottom + bottomMarginEmu >= slideSizeEmu.cy) {
    fail(ERROR_CODES.CONSTRAINT_INVALID, "/request/slotRef");
  }
  const outerBox = Object.freeze({
    x: envelope.x,
    y: bottom,
    cx: envelope.cx,
    cy: slideSizeEmu.cy - bottomMarginEmu - bottom
  });
  let layoutIr;
  let composedSlidePlan;
  try {
    layoutIr = createBoundedSlotSlideLayoutIr({
      slideId: request.outputSlideId,
      canvas: slideSizeEmu,
      fixedNodes: sourceShapes.map((shape, index) => ({
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
      slot: {
        slotId: request.slotRef,
        outerBox,
        padding: {
          top: SLOT_PADDING_EMU,
          right: SLOT_PADDING_EMU,
          bottom: SLOT_PADDING_EMU,
          left: SLOT_PADDING_EMU
        },
        alignX: "center",
        alignY: "center",
        allowedSourceKind: "native-component",
        allowedSourceRef: "native-card-arrow"
      },
      placement: {
        nodeId: request.outputSlideId,
        sourceKind: "native-component",
        sourceRef: "native-card-arrow",
        role: "content",
        slotRef: request.slotRef,
        size: request.preferredSize,
        paintOutsetEmu: NATIVE_CARD_ARROW_PAINT_OUTSET_EMU,
        zOrder: sourceShapes.length,
        placementIntent: request.placementIntent
      }
    });
    composedSlidePlan = resolveSlideLayoutIr(layoutIr);
  } catch (error) {
    if (error instanceof SlideLayoutIrError) {
      fail(ERROR_CODES.CONSTRAINT_INVALID, "/request/preferredSize");
    }
    throw error;
  }
  const placedNode = composedSlidePlan.nodes.find((node) =>
    node.nodeId === request.outputSlideId && node.sourceRef === "native-card-arrow");
  if (placedNode === undefined) fail(ERROR_CODES.CONSTRAINT_INVALID, "/request");
  return Object.freeze({
    request,
    slotDerivation: Object.freeze({
      derivationType: "content-envelope-tail",
      sourceShapeKeys: Object.freeze(sourceShapes.map((shape) => shape.shapeKey)),
      contentEnvelope: envelope,
      bottomMarginEmu,
      slotPaddingEmu: SLOT_PADDING_EMU
    }),
    layoutIr,
    composedSlidePlan,
    resolvedGeometry: placedNode.box
  });
}

/**
 * Compile one product-level semantic placement request into a replayable IR and
 * a frozen coordinate plan. Callers choose a slot and desired size, never x/y.
 */
export function createNativeCardArrowSlotPlacement(options) {
  const fields = captureRecord(options, ["baseArtifact", "request"], "/options");
  let authenticated;
  try {
    authenticated = authenticateCloneFillAssemblyTargetArtifact(fields.baseArtifact);
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/baseArtifact");
  }
  const authority = authenticated.authority;
  const derived = deriveNativeCardArrowSlotPlacementFromFacts({
    sourceShapes: authority.shapes.map((shape) => ({
      shapeKey: shape.shapeKey,
      geometry: shape.geometry
    })),
    slideSizeEmu: authority.slideSizeEmu,
    request: fields.request
  });
  return Object.freeze({
    placementVersion: NATIVE_CARD_ARROW_PLACEMENT_VERSION,
    placementType: "native-card-arrow-slot-placement",
    request: derived.request,
    sourceBinding: Object.freeze({
      baseOutputSha256: sha256(authenticated.archiveBytes),
      sourceSlideKey: authority.sourceSlideKey,
      slidePart: authority.slidePart
    }),
    slotDerivation: derived.slotDerivation,
    layoutIr: derived.layoutIr,
    composedSlidePlan: derived.composedSlidePlan,
    resolvedGeometry: derived.resolvedGeometry
  });
}
