import {
  executeSourceSlideCloneFill,
  preflightSourceSlideCloneFill
} from "../../plugins/clone-fill/src/source-slide-clone-fill.mjs";
import { assembleCloneFillPresentation } from "../../packages/core/src/create-only-assembly.mjs";
import {
  LAYOUT_SELECTION_VERSION,
  selectTemplateLayout
} from "./layout-selector.mjs";

export const REVIEWED_CLONE_FILL_CATALOG_VERSION = "0.1.0";

const MAX_PROFILES = 128;
const MAX_SLIDES = 128;
const MAX_SHAPES = 128;
const MAX_STRING_CODE_UNITS = 512;
const MAX_TEXT_CODE_UNITS = 16_384;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_TEXT = /^(?=.*\S)(?!.*\p{Cf})(?!.*\p{Noncharacter_Code_Point})(?!.*[\uD800-\uDFFF])[^\u0000-\u001F\u007F-\u009F\u2028\u2029]+$/u;
const SHAPE_KINDS = new Set([
  "auto-shape", "graphic-frame", "group", "picture", "placeholder", "text-box"
]);
const SLOT_KINDS = new Set(["metric", "text"]);
const CLONE_FILL_ROLES = new Set(["body", "title"]);
const EVIDENCE_POLICIES = new Set(["none", "optional", "required"]);
const compiledCatalogs = new WeakSet();

export class ReviewedCloneFillCatalogError extends Error {
  constructor(pointer) {
    super(`REVIEWED_CLONE_FILL_CATALOG_INVALID at ${pointer}`);
    this.name = "ReviewedCloneFillCatalogError";
    this.code = "REVIEWED_CLONE_FILL_CATALOG_INVALID";
    this.pointer = pointer;
  }
}

function fail(pointer) {
  throw new ReviewedCloneFillCatalogError(pointer);
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

function safeString(value, pointer, maximum = MAX_STRING_CODE_UNITS) {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum ||
      value.trim() !== value || !SAFE_TEXT.test(value)) {
    fail(pointer);
  }
  return value;
}

function semanticId(value, pointer) {
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) fail(pointer);
  return value;
}

function sha256(value, pointer) {
  if (typeof value !== "string" || !SHA256.test(value)) fail(pointer);
  return value;
}

function boundedInteger(value, pointer, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(pointer);
  return value;
}

function stringArray(value, pointer, { minimum = 1, maximum = 32, wildcard = false } = {}) {
  const items = arrayValues(value, pointer, minimum, maximum).map((item, index) => {
    if (wildcard && item === "*") return item;
    return semanticId(item, `${pointer}/${index}`);
  });
  if (new Set(items).size !== items.length) fail(pointer);
  return items;
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
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

function parseRelevantIndex(templateIndex) {
  const fields = closedRecord(templateIndex, "/templateIndex", [
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
  if (fields.schemaVersion !== "0.1.0" || fields.contractType !== "template-index") {
    fail("/templateIndex");
  }
  const slideSizeFields = closedRecord(fields.slideSizeEmu, "/templateIndex/slideSizeEmu", ["cx", "cy"]);
  const slideSize = {
    cx: boundedInteger(slideSizeFields.cx, "/templateIndex/slideSizeEmu/cx", 1, 1_000_000_000),
    cy: boundedInteger(slideSizeFields.cy, "/templateIndex/slideSizeEmu/cy", 1, 1_000_000_000)
  };
  const slides = new Map();
  const slideValues = arrayValues(fields.slides, "/templateIndex/slides", 1, MAX_SLIDES);
  for (let slideIndex = 0; slideIndex < slideValues.length; slideIndex += 1) {
    const pointer = `/templateIndex/slides/${slideIndex}`;
    const slideFields = closedRecord(slideValues[slideIndex], pointer, [
      "layoutKey", "partPath", "shapes", "slideKey", "sourceId"
    ]);
    const slideKey = semanticId(slideFields.slideKey, `${pointer}/slideKey`);
    if (slides.has(slideKey)) fail(`${pointer}/slideKey`);
    semanticId(slideFields.layoutKey, `${pointer}/layoutKey`);
    boundedInteger(slideFields.sourceId, `${pointer}/sourceId`, 1, 4_294_967_295);
    safeString(slideFields.partPath, `${pointer}/partPath`, 240);
    const shapes = new Map();
    const sourceIds = new Set();
    const shapeValues = arrayValues(slideFields.shapes, `${pointer}/shapes`, 1, MAX_SHAPES);
    for (let shapeIndex = 0; shapeIndex < shapeValues.length; shapeIndex += 1) {
      const shapePointer = `${pointer}/shapes/${shapeIndex}`;
      const shapeValue = shapeValues[shapeIndex];
      if (shapeValue === null || typeof shapeValue !== "object" || Array.isArray(shapeValue)) {
        fail(shapePointer);
      }
      const descriptors = Object.getOwnPropertyDescriptors(shapeValue);
      const hasPlaceholder = Object.prototype.hasOwnProperty.call(descriptors, "placeholder");
      const shapeFields = closedRecord(shapeValue, shapePointer, hasPlaceholder
        ? ["geometry", "kind", "placeholder", "shapeKey", "sourceId"]
        : ["geometry", "kind", "shapeKey", "sourceId"]);
      const shapeKey = semanticId(shapeFields.shapeKey, `${shapePointer}/shapeKey`);
      const sourceId = boundedInteger(shapeFields.sourceId, `${shapePointer}/sourceId`, 1, 4_294_967_295);
      if (shapes.has(shapeKey) || sourceIds.has(sourceId)) fail(shapePointer);
      if (!SHAPE_KINDS.has(shapeFields.kind)) fail(`${shapePointer}/kind`);
      const geometry = parseGeometry(shapeFields.geometry, `${shapePointer}/geometry`, slideSize);
      shapes.set(shapeKey, { kind: shapeFields.kind, geometry });
      sourceIds.add(sourceId);
    }
    slides.set(slideKey, { shapes });
  }
  return {
    templateIndexId: semanticId(fields.templateIndexId, "/templateIndex/templateIndexId"),
    templateSha256: sha256(fields.templateSha256, "/templateIndex/templateSha256"),
    slideSize,
    slides
  };
}

function parseCapacity(value, pointer, kind) {
  if (kind === "text" || kind === "metric") {
    const fields = closedRecord(value, pointer, ["maxChars"]);
    return { maxChars: boundedInteger(fields.maxChars, `${pointer}/maxChars`, 1, 100_000) };
  }
  fail(pointer);
}

function parseProfile(value, profileIndex, indexFacts) {
  const pointer = `/review/profiles/${profileIndex}`;
  const fields = closedRecord(value, pointer, ["functions", "layoutId", "slots", "sourceSlideKey"]);
  const layoutId = semanticId(fields.layoutId, `${pointer}/layoutId`);
  const sourceSlideKey = semanticId(fields.sourceSlideKey, `${pointer}/sourceSlideKey`);
  const slide = indexFacts.slides.get(sourceSlideKey);
  if (slide === undefined) fail(`${pointer}/sourceSlideKey`);
  const slots = arrayValues(fields.slots, `${pointer}/slots`, 2, 2).map((slot, slotIndex) => {
    const slotPointer = `${pointer}/slots/${slotIndex}`;
    const slotFields = closedRecord(slot, slotPointer, [
      "acceptsRoles",
      "capacity",
      "cloneFillRole",
      "kind",
      "maxUnits",
      "minUnits",
      "slotId",
      "sourceShapeKey"
    ]);
    const kind = semanticId(slotFields.kind, `${slotPointer}/kind`);
    if (!SLOT_KINDS.has(kind)) fail(`${slotPointer}/kind`);
    const cloneFillRole = semanticId(slotFields.cloneFillRole, `${slotPointer}/cloneFillRole`);
    if (!CLONE_FILL_ROLES.has(cloneFillRole)) fail(`${slotPointer}/cloneFillRole`);
    const sourceShapeKey = semanticId(slotFields.sourceShapeKey, `${slotPointer}/sourceShapeKey`);
    const shape = slide.shapes.get(sourceShapeKey);
    if (shape === undefined || shape.kind !== "text-box") fail(`${slotPointer}/sourceShapeKey`);
    const minUnits = boundedInteger(slotFields.minUnits, `${slotPointer}/minUnits`, 1, 1);
    const maxUnits = boundedInteger(slotFields.maxUnits, `${slotPointer}/maxUnits`, 1, 1);
    return {
      selector: {
        slotId: semanticId(slotFields.slotId, `${slotPointer}/slotId`),
        acceptsRoles: stringArray(slotFields.acceptsRoles, `${slotPointer}/acceptsRoles`, { wildcard: true }),
        kind,
        minUnits,
        maxUnits,
        capacity: parseCapacity(slotFields.capacity, `${slotPointer}/capacity`, kind)
      },
      trace: {
        slotId: semanticId(slotFields.slotId, `${slotPointer}/slotId`),
        sourceShapeKey,
        cloneFillRole,
        sourceKind: shape.kind,
        geometryEmu: { ...shape.geometry },
        regionMillionths: regionMillionths(shape.geometry, indexFacts.slideSize)
      }
    };
  });
  if (new Set(slots.map((slot) => slot.selector.slotId)).size !== slots.length ||
      new Set(slots.map((slot) => slot.trace.sourceShapeKey)).size !== slots.length ||
      new Set(slots.map((slot) => slot.trace.cloneFillRole)).size !== CLONE_FILL_ROLES.size) {
    fail(`${pointer}/slots`);
  }
  return {
    selector: {
      layoutId,
      sourceSlideKey,
      functions: stringArray(fields.functions, `${pointer}/functions`, { wildcard: true }),
      slots: slots.map((slot) => slot.selector)
    },
    trace: {
      layoutId,
      sourceSlideKey,
      slots: slots.map((slot) => slot.trace)
    }
  };
}

/**
 * Compile already admitted structural facts plus explicitly reviewed semantic
 * annotations into the exact catalog accepted by the deterministic selector.
 * Geometry never invents a role or capacity; every semantic assertion remains
 * visible in the reviewed input and bound to an exact source shape.
 */
export function compileReviewedCloneFillCatalog(options) {
  const optionFields = closedRecord(options, "/options", ["review", "templateIndex"]);
  const templateIndex = optionFields.templateIndex;
  const review = optionFields.review;
  const indexFacts = parseRelevantIndex(templateIndex);
  const reviewFields = closedRecord(review, "/review", [
    "catalogVersion", "profiles", "templateIndexId", "templateSha256"
  ]);
  if (reviewFields.catalogVersion !== REVIEWED_CLONE_FILL_CATALOG_VERSION ||
      semanticId(reviewFields.templateIndexId, "/review/templateIndexId") !== indexFacts.templateIndexId ||
      sha256(reviewFields.templateSha256, "/review/templateSha256") !== indexFacts.templateSha256) {
    fail("/review");
  }
  const profiles = arrayValues(reviewFields.profiles, "/review/profiles", 1, MAX_PROFILES)
    .map((profile, index) => parseProfile(profile, index, indexFacts));
  if (new Set(profiles.map((profile) => profile.selector.layoutId)).size !== profiles.length) {
    fail("/review/profiles");
  }
  const catalog = deepFreeze({
    catalogVersion: REVIEWED_CLONE_FILL_CATALOG_VERSION,
    templateIndexId: indexFacts.templateIndexId,
    templateSha256: indexFacts.templateSha256,
    slideSizeEmu: { ...indexFacts.slideSize },
    layouts: profiles.map((profile) => profile.selector),
    traces: profiles.map((profile) => profile.trace)
  });
  compiledCatalogs.add(catalog);
  return catalog;
}

function parseBridgeUnit(value, index) {
  const pointer = `/brief/units/${index}`;
  const fields = closedRecord(value, pointer, ["content", "kind", "role", "unitId"]);
  const kind = semanticId(fields.kind, `${pointer}/kind`);
  if (!SLOT_KINDS.has(kind)) fail(`${pointer}/kind`);
  let content;
  if (kind === "text") {
    content = safeString(fields.content, `${pointer}/content`, MAX_TEXT_CODE_UNITS);
  } else {
    const contentFields = closedRecord(fields.content, `${pointer}/content`, ["label", "value"]);
    content = {
      label: safeString(contentFields.label, `${pointer}/content/label`, MAX_TEXT_CODE_UNITS),
      value: safeString(contentFields.value, `${pointer}/content/value`, MAX_TEXT_CODE_UNITS)
    };
  }
  return {
    unitId: semanticId(fields.unitId, `${pointer}/unitId`),
    role: semanticId(fields.role, `${pointer}/role`),
    kind,
    content
  };
}

function parseBridgeBrief(value) {
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
  const units = arrayValues(fields.units, "/brief/units", 2, 2).map(parseBridgeUnit);
  if (new Set(units.map((unit) => unit.unitId)).size !== units.length) fail("/brief/units");
  return {
    briefVersion: fields.briefVersion,
    slideId: semanticId(fields.slideId, "/brief/slideId"),
    function: semanticId(fields.function, "/brief/function"),
    audienceGoal: safeString(fields.audienceGoal, "/brief/audienceGoal", 4096),
    availableAssetIds,
    evidencePolicy,
    primaryTakeawayUnitId: semanticId(fields.primaryTakeawayUnitId, "/brief/primaryTakeawayUnitId"),
    units
  };
}

function unitText(unit) {
  return unit.kind === "text" ? unit.content : `${unit.content.value} — ${unit.content.label}`;
}

function selectorLayouts(catalog) {
  return catalog.layouts
    .filter((layout) => layout.slots.every((slot) =>
      slot.kind !== "metric" || slot.capacity.maxChars > 3))
    .map((layout) => ({
      ...layout,
      slots: layout.slots.map((slot) => slot.kind === "metric"
        ? { ...slot, capacity: { maxChars: slot.capacity.maxChars - 3 } }
        : { ...slot })
    }));
}

function selectAndCompileCloneFillPlan({ brief, catalog, outputSlideId }) {
  if (!compiledCatalogs.has(catalog) || !Object.isFrozen(catalog)) fail("/catalog");
  const capturedBrief = parseBridgeBrief(brief);
  const layouts = selectorLayouts(catalog);
  if (layouts.length === 0) fail("/selection");
  const selection = selectTemplateLayout({ brief: capturedBrief, layouts });
  if (selection.selectionStatus !== "complete" || selection.selected === null) fail("/selection");
  const trace = catalog.traces.find((candidate) => candidate.layoutId === selection.selected.layoutId);
  if (trace === undefined || trace.sourceSlideKey !== selection.selected.sourceSlideKey) fail("/selection");
  const units = new Map(capturedBrief.units.map((unit) => [unit.unitId, unit]));
  const selectedBySlot = new Map(selection.selected.assignments.map((assignment) => [
    assignment.slotId,
    units.get(assignment.unitId)
  ]));
  if (selectedBySlot.size !== 2 || [...selectedBySlot.values()].some((unit) => unit === undefined)) {
    fail("/selection/assignments");
  }
  const byCloneRole = new Map(trace.slots.map((slot) => [slot.cloneFillRole, {
    slot,
    unit: selectedBySlot.get(slot.slotId)
  }]));
  if (byCloneRole.size !== 2 || [...byCloneRole.values()].some((entry) => entry.unit === undefined)) {
    fail("/selection/assignments");
  }
  const selectedLayout = catalog.layouts.find((layout) => layout.layoutId === selection.selected.layoutId);
  for (const assignment of selection.selected.assignments) {
    const unit = units.get(assignment.unitId);
    const slot = selectedLayout?.slots.find((candidate) => candidate.slotId === assignment.slotId);
    if (unit === undefined || slot === undefined ||
        (unit.kind === "metric" && Array.from(unitText(unit)).length > slot.capacity.maxChars)) {
      fail("/selection/assignments");
    }
  }
  const outputId = semanticId(outputSlideId, "/outputSlideId");
  const invocation = {
    invocationId: outputId,
    payload: {
      body: [unitText(byCloneRole.get("body").unit)],
      title: unitText(byCloneRole.get("title").unit)
    },
    bindings: ["body", "title"].map((role) => {
      const slot = byCloneRole.get(role).slot;
      return {
        role,
        shapeBindingId: semanticId(
          `${selection.selected.layoutId}-${role}-binding`,
          "/plan/bindings/shapeBindingId"
        ),
        containerKind: "slide",
        containerKey: selection.selected.sourceSlideKey,
        shapeKey: slot.sourceShapeKey,
        expectedKind: "text-box",
        cardinality: "exactly-one"
      };
    })
  };
  if (!preflightSourceSlideCloneFill(invocation)) fail("/plan");
  const plan = deepFreeze(executeSourceSlideCloneFill(invocation));
  return deepFreeze({
    catalogVersion: catalog.catalogVersion,
    templateIndexId: catalog.templateIndexId,
    templateSha256: catalog.templateSha256,
    selection,
    plan,
    trace
  });
}

/**
 * Atomically compile reviewed source facts through selection and the existing
 * clone/fill writer. The intermediate plan never crosses this API boundary,
 * so it cannot be paired with a different same-ID TemplateIndex.
 */
export function selectAndAssembleReviewedCloneFillPresentation(options) {
  const fields = closedRecord(options, "/options", [
    "brief", "outputSlideId", "review", "sourceArchiveBytes", "templateIndex"
  ]);
  const catalog = compileReviewedCloneFillCatalog({
    templateIndex: fields.templateIndex,
    review: fields.review
  });
  const compiled = selectAndCompileCloneFillPlan({
    brief: fields.brief,
    catalog,
    outputSlideId: fields.outputSlideId
  });
  const assembled = assembleCloneFillPresentation({
    sourceArchiveBytes: fields.sourceArchiveBytes,
    templateIndex: fields.templateIndex,
    plan: compiled.plan
  });
  return Object.freeze({
    catalogVersion: compiled.catalogVersion,
    templateIndexId: compiled.templateIndexId,
    templateSha256: compiled.templateSha256,
    selection: compiled.selection,
    trace: compiled.trace,
    planTrace: deepFreeze({
      outputSlideId: compiled.plan.outputSlideId,
      sourceSlideKey: compiled.plan.clone.sourceSlideKey,
      fills: compiled.plan.fills.map((fill) => ({
        role: fill.role,
        sourceShapeKey: fill.sourceShapeKey,
        paragraphs: [...fill.paragraphs]
      }))
    }),
    archiveBytes: Buffer.from(assembled.archiveBytes),
    report: assembled.report
  });
}
