export const LAYOUT_SELECTION_VERSION = "0.1.0";

const UNIT_KINDS = new Set(["image", "list", "metric", "text"]);
const SLOT_KINDS = new Set([...UNIT_KINDS, "any"]);
const EVIDENCE_POLICIES = new Set(["none", "optional", "required"]);
const MAX_LAYOUTS = 128;
const MAX_SLOTS = 32;
const MAX_UNITS = 32;
const MAX_SEARCH_STATES = 100_000;
const MAX_REQUEST_SEARCH_STATES = 250_000;
const MAX_OBJECT_KEY_CODE_UNITS = 128;
const MAX_METADATA_STRING_CODE_UNITS = 128;
const MAX_AUDIENCE_GOAL_CODE_UNITS = 4_096;
const MAX_CONTENT_STRING_CODE_UNITS = 16_384;
const MAX_LIST_ITEM_CODE_UNITS = 4_096;
const MAX_BRIEF_STRING_CODE_UNITS = 65_536;
const MAX_BRIEF_STRING_UTF8_BYTES = 128 * 1024;
const MAX_LAYOUT_STRING_CODE_UNITS = 1024 * 1024;
const MAX_LAYOUT_STRING_UTF8_BYTES = 2 * 1024 * 1024;
const encoder = new TextEncoder();

export class LayoutSelectionInputError extends Error {
  constructor(pointer) {
    super(`LAYOUT_SELECTION_INPUT_INVALID at ${pointer}`);
    this.name = "LayoutSelectionInputError";
    this.code = "LAYOUT_SELECTION_INPUT_INVALID";
    this.pointer = pointer;
  }
}

function fail(pointer) {
  throw new LayoutSelectionInputError(pointer);
}

function record(value, pointer) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(pointer);
  return value;
}

function exactKeys(value, expected, pointer) {
  record(value, pointer);
  const actual = Object.keys(value);
  if (actual.length !== expected.length) fail(pointer);
  if (actual.some((key) => key.length > MAX_OBJECT_KEY_CODE_UNITS)) fail(pointer);
  actual.sort(compareCodeUnits);
  const wanted = [...expected].sort(compareCodeUnits);
  if (actual.some((key, index) => key !== wanted[index])) {
    fail(pointer);
  }
}

function nonemptyString(
  value,
  pointer,
  { maxCodeUnits = MAX_METADATA_STRING_CODE_UNITS } = {}
) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxCodeUnits) fail(pointer);
  if (value.trim() !== value) fail(pointer);
  return value;
}

function stringArray(
  value,
  pointer,
  { min = 1, max = 32, maxCodeUnits = MAX_METADATA_STRING_CODE_UNITS } = {}
) {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(pointer);
  const result = value.map((item, index) => nonemptyString(
    item,
    `${pointer}/${index}`,
    { maxCodeUnits }
  ));
  if (new Set(result).size !== result.length) fail(pointer);
  return result;
}

function boundedInteger(value, pointer, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(pointer);
  return value;
}

function textLength(value) {
  return Array.from(value).length;
}

function compareCodeUnits(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function enforceStringBudget(strings, pointer, maxCodeUnits, maxUtf8Bytes) {
  let codeUnits = 0;
  let utf8Bytes = 0;
  for (const value of strings) {
    codeUnits += value.length;
    if (codeUnits > maxCodeUnits) fail(pointer);
    utf8Bytes += encoder.encode(value).byteLength;
    if (utf8Bytes > maxUtf8Bytes) fail(pointer);
  }
}

function parseUnit(value, index) {
  const pointer = `/brief/units/${index}`;
  exactKeys(value, ["content", "kind", "role", "unitId"], pointer);
  const kind = nonemptyString(value.kind, `${pointer}/kind`);
  if (!UNIT_KINDS.has(kind)) fail(`${pointer}/kind`);
  const unit = {
    unitId: nonemptyString(value.unitId, `${pointer}/unitId`),
    role: nonemptyString(value.role, `${pointer}/role`),
    kind,
    content: value.content
  };
  if (kind === "text") {
    unit.content = nonemptyString(value.content, `${pointer}/content`, {
      maxCodeUnits: MAX_CONTENT_STRING_CODE_UNITS
    });
  } else if (kind === "list") {
    unit.content = stringArray(value.content, `${pointer}/content`, {
      max: 64,
      maxCodeUnits: MAX_LIST_ITEM_CODE_UNITS
    });
  } else if (kind === "metric") {
    exactKeys(value.content, ["label", "value"], `${pointer}/content`);
    unit.content = {
      label: nonemptyString(value.content.label, `${pointer}/content/label`, {
        maxCodeUnits: MAX_CONTENT_STRING_CODE_UNITS
      }),
      value: nonemptyString(value.content.value, `${pointer}/content/value`, {
        maxCodeUnits: MAX_CONTENT_STRING_CODE_UNITS
      })
    };
  } else {
    exactKeys(value.content, ["alt", "assetId"], `${pointer}/content`);
    unit.content = {
      alt: nonemptyString(value.content.alt, `${pointer}/content/alt`, {
        maxCodeUnits: MAX_CONTENT_STRING_CODE_UNITS
      }),
      assetId: nonemptyString(value.content.assetId, `${pointer}/content/assetId`)
    };
  }
  return unit;
}

function parseBrief(value) {
  exactKeys(value, [
    "audienceGoal", "availableAssetIds", "briefVersion", "evidencePolicy", "function",
    "primaryTakeawayUnitId", "slideId", "units"
  ], "/brief");
  if (nonemptyString(value.briefVersion, "/brief/briefVersion", { maxCodeUnits: 16 }) !==
      LAYOUT_SELECTION_VERSION) fail("/brief/briefVersion");
  const evidencePolicy = nonemptyString(value.evidencePolicy, "/brief/evidencePolicy");
  if (!EVIDENCE_POLICIES.has(evidencePolicy)) fail("/brief/evidencePolicy");
  const availableAssetIds = stringArray(value.availableAssetIds, "/brief/availableAssetIds", {
    min: 0,
    max: 128
  });
  if (!Array.isArray(value.units) || value.units.length === 0 || value.units.length > MAX_UNITS) {
    fail("/brief/units");
  }
  const units = value.units.map(parseUnit);
  const ids = units.map((unit) => unit.unitId);
  if (new Set(ids).size !== ids.length) fail("/brief/units");
  const primaryTakeawayUnitId = nonemptyString(
    value.primaryTakeawayUnitId,
    "/brief/primaryTakeawayUnitId"
  );
  const takeaway = units.find((unit) => unit.unitId === primaryTakeawayUnitId);
  if (!takeaway || takeaway.role !== "takeaway" || !["metric", "text"].includes(takeaway.kind)) {
    fail("/brief/primaryTakeawayUnitId");
  }
  const evidenceCount = units.filter((unit) => unit.role === "evidence").length;
  if ((evidencePolicy === "required" && evidenceCount === 0) ||
      (evidencePolicy === "none" && evidenceCount !== 0)) {
    fail("/brief/evidencePolicy");
  }
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    if (unit.kind === "image" && !availableAssetIds.includes(unit.content.assetId)) {
      fail(`/brief/units/${index}/content/assetId`);
    }
  }
  const brief = {
    briefVersion: value.briefVersion,
    slideId: nonemptyString(value.slideId, "/brief/slideId"),
    function: nonemptyString(value.function, "/brief/function"),
    audienceGoal: nonemptyString(value.audienceGoal, "/brief/audienceGoal", {
      maxCodeUnits: MAX_AUDIENCE_GOAL_CODE_UNITS
    }),
    evidencePolicy,
    primaryTakeawayUnitId,
    availableAssetIds,
    units
  };
  const strings = [
    brief.briefVersion,
    brief.slideId,
    brief.function,
    brief.audienceGoal,
    brief.evidencePolicy,
    brief.primaryTakeawayUnitId,
    ...brief.availableAssetIds
  ];
  for (const unit of brief.units) {
    strings.push(unit.unitId, unit.role, unit.kind);
    if (unit.kind === "text") strings.push(unit.content);
    else if (unit.kind === "list") {
      strings.push(...unit.content);
    } else if (unit.kind === "metric") {
      strings.push(unit.content.label, unit.content.value);
    } else {
      strings.push(unit.content.alt, unit.content.assetId);
    }
  }
  enforceStringBudget(
    strings,
    "/brief",
    MAX_BRIEF_STRING_CODE_UNITS,
    MAX_BRIEF_STRING_UTF8_BYTES
  );
  return brief;
}

function parseCapacity(value, pointer, kind) {
  if (kind === "text" || kind === "metric") {
    exactKeys(value, ["maxChars"], pointer);
    return { maxChars: boundedInteger(value.maxChars, `${pointer}/maxChars`, 1, 100_000) };
  }
  if (kind === "list") {
    exactKeys(value, ["maxCharsPerItem", "maxItems"], pointer);
    return {
      maxItems: boundedInteger(value.maxItems, `${pointer}/maxItems`, 1, 256),
      maxCharsPerItem: boundedInteger(
        value.maxCharsPerItem,
        `${pointer}/maxCharsPerItem`,
        1,
        100_000
      )
    };
  }
  if (kind === "image") {
    exactKeys(value, ["maxImages"], pointer);
    return { maxImages: boundedInteger(value.maxImages, `${pointer}/maxImages`, 1, MAX_UNITS) };
  }
  if (kind === "any") {
    exactKeys(value, ["image", "list", "metric", "text"], pointer);
    return {
      image: parseCapacity(value.image, `${pointer}/image`, "image"),
      list: parseCapacity(value.list, `${pointer}/list`, "list"),
      metric: parseCapacity(value.metric, `${pointer}/metric`, "metric"),
      text: parseCapacity(value.text, `${pointer}/text`, "text")
    };
  }
  exactKeys(value, [], pointer);
  return {};
}

function parseSlot(value, layoutIndex, slotIndex) {
  const pointer = `/layouts/${layoutIndex}/slots/${slotIndex}`;
  exactKeys(value, ["acceptsRoles", "capacity", "kind", "maxUnits", "minUnits", "slotId"], pointer);
  const kind = nonemptyString(value.kind, `${pointer}/kind`);
  if (!SLOT_KINDS.has(kind)) fail(`${pointer}/kind`);
  const minUnits = boundedInteger(value.minUnits, `${pointer}/minUnits`, 0, MAX_UNITS);
  const maxUnits = boundedInteger(value.maxUnits, `${pointer}/maxUnits`, 1, MAX_UNITS);
  if (minUnits > maxUnits) fail(`${pointer}/minUnits`);
  return {
    slotId: nonemptyString(value.slotId, `${pointer}/slotId`),
    acceptsRoles: stringArray(value.acceptsRoles, `${pointer}/acceptsRoles`),
    kind,
    minUnits,
    maxUnits,
    capacity: parseCapacity(value.capacity, `${pointer}/capacity`, kind)
  };
}

function parseLayout(value, index) {
  const pointer = `/layouts/${index}`;
  exactKeys(value, ["functions", "layoutId", "slots", "sourceSlideKey"], pointer);
  if (!Array.isArray(value.slots) || value.slots.length === 0 || value.slots.length > MAX_SLOTS) {
    fail(`${pointer}/slots`);
  }
  const slots = value.slots.map((slot, slotIndex) => parseSlot(slot, index, slotIndex));
  if (new Set(slots.map((slot) => slot.slotId)).size !== slots.length) fail(`${pointer}/slots`);
  return {
    layoutId: nonemptyString(value.layoutId, `${pointer}/layoutId`),
    sourceSlideKey: nonemptyString(value.sourceSlideKey, `${pointer}/sourceSlideKey`),
    functions: stringArray(value.functions, `${pointer}/functions`),
    slots
  };
}

function measureUnit(unit) {
  if (unit.kind === "text") return { chars: textLength(unit.content), items: 0 };
  if (unit.kind === "metric") {
    return { chars: textLength(unit.content.label) + textLength(unit.content.value), items: 0 };
  }
  if (unit.kind === "list") {
    return {
      chars: unit.content.reduce((sum, item) => sum + textLength(item), 0),
      itemChars: unit.content.map(textLength),
      items: unit.content.length
    };
  }
  return { chars: 0, images: 1, items: 0 };
}

function initialLoad(slot) {
  return {
    units: 0,
    byKind: {
      image: { images: 0 },
      list: { itemChars: [], items: 0 },
      metric: { chars: 0 },
      text: { chars: 0 }
    },
    slot
  };
}

function placement(slot, load, unit) {
  if (load.units >= slot.maxUnits) return null;
  const roleExact = slot.acceptsRoles.includes(unit.role);
  if (!roleExact && !slot.acceptsRoles.includes("*")) return null;
  const kindExact = slot.kind === unit.kind;
  if (!kindExact && slot.kind !== "any") return null;
  const measure = measureUnit(unit);
  const capacity = slot.kind === "any" ? slot.capacity[unit.kind] : slot.capacity;
  const kindLoad = load.byKind[unit.kind];
  if ((unit.kind === "text" || unit.kind === "metric") &&
      kindLoad.chars + measure.chars > capacity.maxChars) return null;
  if (unit.kind === "list" &&
      (kindLoad.items + measure.items > capacity.maxItems ||
       measure.itemChars.some((size) => size > capacity.maxCharsPerItem))) return null;
  if (unit.kind === "image" && kindLoad.images + measure.images > capacity.maxImages) return null;
  const nextKindLoad = unit.kind === "text" || unit.kind === "metric"
    ? { chars: kindLoad.chars + measure.chars }
    : unit.kind === "list"
      ? {
          items: kindLoad.items + measure.items,
          itemChars: [...kindLoad.itemChars, ...(measure.itemChars ?? [])]
        }
      : { images: kindLoad.images + measure.images };
  return {
    roleFallback: roleExact ? 0 : 1,
    kindFallback: kindExact ? 0 : 1,
    nextLoad: {
      ...load,
      units: load.units + 1,
      byKind: { ...load.byKind, [unit.kind]: nextKindLoad }
    }
  };
}

function compareTuple(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return left.length - right.length;
}

function assignmentScore(loads, roleFallbacks, kindFallbacks) {
  const unusedOptionalSlots = loads.filter((load) => load.units === 0 && load.slot.minUnits === 0).length;
  let capacitySlack = 0;
  for (const load of loads) {
    const kinds = load.slot.kind === "any" ? [...UNIT_KINDS] : [load.slot.kind];
    for (const kind of kinds) {
      const capacity = load.slot.kind === "any" ? load.slot.capacity[kind] : load.slot.capacity;
      if (kind === "text" || kind === "metric") {
        capacitySlack += capacity.maxChars - load.byKind[kind].chars;
      } else if (kind === "list") {
        capacitySlack += capacity.maxItems - load.byKind.list.items;
      } else {
        capacitySlack += capacity.maxImages - load.byKind.image.images;
      }
    }
    capacitySlack += load.slot.maxUnits - load.units;
  }
  return [roleFallbacks, kindFallbacks, unusedOptionalSlots, capacitySlack];
}

function matchLayout(brief, layout, catalogIndex, requestSearchBudget) {
  const functionExact = layout.functions.includes(brief.function);
  const functionFallback = layout.functions.includes("*");
  if (!functionExact && !functionFallback) {
    return {
      status: "rejected",
      layoutId: layout.layoutId,
      reasons: [{ code: "function-mismatch", function: brief.function }]
    };
  }

  const loads = layout.slots.map(initialLoad);
  const unitOrder = brief.units
    .map((unit, index) => ({ unit, index }))
    .sort((left, right) => {
      const options = ({ unit }) => layout.slots.filter((slot) =>
        (slot.acceptsRoles.includes(unit.role) || slot.acceptsRoles.includes("*")) &&
        (slot.kind === unit.kind || slot.kind === "any")
      ).length;
      return options(left) - options(right) || left.index - right.index;
    });
  let best = null;
  let searchStates = 0;
  let searchBudgetExceeded = false;
  let requestSearchBudgetExceeded = false;

  function visit(position, assignments, roleFallbacks, kindFallbacks) {
    if (searchBudgetExceeded || requestSearchBudgetExceeded) return;
    if (searchStates >= MAX_SEARCH_STATES) {
      searchBudgetExceeded = true;
      return;
    }
    if (requestSearchBudget.used >= MAX_REQUEST_SEARCH_STATES) {
      requestSearchBudgetExceeded = true;
      return;
    }
    searchStates += 1;
    requestSearchBudget.used += 1;
    if (position === unitOrder.length) {
      if (loads.some((load) => load.units < load.slot.minUnits)) return;
      const score = assignmentScore(loads, roleFallbacks, kindFallbacks);
      const signature = assignments
        .map((item) => `${item.unitId}:${item.slotId}`)
        .sort(compareCodeUnits)
        .join("|");
      if (!best || compareTuple(score, best.score) < 0 ||
          (compareTuple(score, best.score) === 0 && signature < best.signature)) {
        best = { assignments: assignments.map((item) => ({ ...item })), score, signature };
      }
      return;
    }
    const { unit } = unitOrder[position];
    for (let slotIndex = 0; slotIndex < layout.slots.length; slotIndex += 1) {
      const candidate = placement(layout.slots[slotIndex], loads[slotIndex], unit);
      if (!candidate) continue;
      const previous = loads[slotIndex];
      loads[slotIndex] = candidate.nextLoad;
      assignments.push({ unitId: unit.unitId, slotId: layout.slots[slotIndex].slotId });
      visit(
        position + 1,
        assignments,
        roleFallbacks + candidate.roleFallback,
        kindFallbacks + candidate.kindFallback
      );
      assignments.pop();
      loads[slotIndex] = previous;
    }
  }

  visit(0, [], 0, 0);
  if (requestSearchBudgetExceeded) {
    return {
      status: "incomplete",
      layoutId: layout.layoutId,
      reason: {
        code: "whole-request-search-budget-exceeded",
        maxSearchStates: MAX_REQUEST_SEARCH_STATES
      }
    };
  }
  if (searchBudgetExceeded) {
    return {
      status: "incomplete",
      layoutId: layout.layoutId,
      reason: {
        code: "layout-search-budget-exceeded",
        layoutId: layout.layoutId,
        maxSearchStates: MAX_SEARCH_STATES
      }
    };
  }
  if (!best) {
    const reasons = brief.units
      .filter((unit) => !layout.slots.some((slot) => placement(slot, initialLoad(slot), unit)))
      .map((unit) => ({ code: "unit-unassignable", unitId: unit.unitId }));
    if (reasons.length === 0) reasons.push({ code: "slot-cardinality-or-combined-capacity" });
    return { status: "rejected", layoutId: layout.layoutId, reasons };
  }
  const score = [functionExact ? 0 : 1, ...best.score, catalogIndex];
  return {
    status: "candidate",
    layoutId: layout.layoutId,
    sourceSlideKey: layout.sourceSlideKey,
    score,
    assignments: best.assignments.sort((left, right) =>
      compareCodeUnits(left.unitId, right.unitId)
    )
  };
}

export function selectTemplateLayout({ brief: briefInput, layouts: layoutInputs }) {
  const brief = parseBrief(briefInput);
  if (!Array.isArray(layoutInputs) || layoutInputs.length === 0 || layoutInputs.length > MAX_LAYOUTS) {
    fail("/layouts");
  }
  const layouts = layoutInputs.map(parseLayout);
  if (new Set(layouts.map((layout) => layout.layoutId)).size !== layouts.length) fail("/layouts");
  enforceStringBudget(
    layouts.flatMap((layout) => [
      layout.layoutId,
      layout.sourceSlideKey,
      ...layout.functions,
      ...layout.slots.flatMap((slot) => [slot.slotId, slot.kind, ...slot.acceptsRoles])
    ]),
    "/layouts",
    MAX_LAYOUT_STRING_CODE_UNITS,
    MAX_LAYOUT_STRING_UTF8_BYTES
  );
  const requestSearchBudget = { used: 0 };
  const results = [];
  let incomplete = null;
  for (let index = 0; index < layouts.length; index += 1) {
    const result = matchLayout(brief, layouts[index], index, requestSearchBudget);
    results.push(result);
    if (result.status === "incomplete") {
      incomplete = result.reason;
      break;
    }
  }
  if (incomplete) {
    return {
      selectionVersion: LAYOUT_SELECTION_VERSION,
      selectionStatus: "incomplete",
      slideId: brief.slideId,
      audienceGoal: brief.audienceGoal,
      selected: null,
      candidates: [],
      rejected: [],
      incompleteReason: incomplete,
      scoreDimensions: [
        "functionFallbacks",
        "roleFallbacks",
        "kindFallbacks",
        "unusedOptionalSlots",
        "capacitySlack",
        "catalogOrder"
      ]
    };
  }
  const candidates = results
    .filter((result) => result.status === "candidate")
    .sort((left, right) => compareTuple(left.score, right.score));
  return {
    selectionVersion: LAYOUT_SELECTION_VERSION,
    selectionStatus: "complete",
    slideId: brief.slideId,
    audienceGoal: brief.audienceGoal,
    selected: candidates[0] ?? null,
    candidates,
    rejected: results.filter((result) => result.status === "rejected"),
    incompleteReason: null,
    scoreDimensions: [
      "functionFallbacks",
      "roleFallbacks",
      "kindFallbacks",
      "unusedOptionalSlots",
      "capacitySlack",
      "catalogOrder"
    ]
  };
}
