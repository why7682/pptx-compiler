import { createHash } from "node:crypto";

import { assembleOrderedSlideDeck } from "../../packages/core/src/ordered-slide-assembly.mjs";
import { SECURE_ZIP_LIMITS } from "../../packages/core/src/secure-zip.mjs";
import { selectAndAssembleInducedCloneFillPresentation } from
  "./reviewed-profile-induction.mjs";

export const ORDERED_STORY_DECK_VERSION = "0.1.0";

const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SAFE_TEXT = /^(?=.*\S)(?!.*\p{Cf})(?!.*\p{Noncharacter_Code_Point})(?!.*[\uD800-\uDFFF])[^\u0000-\u001F\u007F-\u009F\u2028\u2029]+$/u;
const NARRATIVE_ROLES = Object.freeze(["setup", "evidence", "resolution"]);
const FUNCTIONS = Object.freeze(["status", "status", "decision"]);
const TRANSITION_RELATIONS = Object.freeze(["deepens", "supports"]);
const MAX_JSON_NODES = 20_000;
const MAX_JSON_DEPTH = 128;
const MAX_JSON_STRING_CODE_UNITS = 65_536;
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

export class OrderedStoryDeckError extends Error {
  constructor(pointer) {
    super(`ORDERED_STORY_DECK_INVALID at ${pointer}`);
    this.name = "OrderedStoryDeckError";
    this.code = "ORDERED_STORY_DECK_INVALID";
    this.pointer = pointer;
  }
}

function fail(pointer) {
  throw new OrderedStoryDeckError(pointer);
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

function arrayValues(value, pointer, expectedLength) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail(pointer);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (descriptors.length?.value !== expectedLength ||
      Reflect.ownKeys(descriptors).length !== expectedLength + 1) {
    fail(`${pointer}/length`);
  }
  return Array.from({ length: expectedLength }, (_, index) => {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(`${pointer}/${index}`);
    }
    return descriptor.value;
  });
}

function semanticId(value, pointer) {
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) fail(pointer);
  return value;
}

function safeString(value, pointer, maximum = 4_096) {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum ||
      value.trim() !== value || !SAFE_TEXT.test(value)) {
    fail(pointer);
  }
  return value;
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value) ||
      ArrayBuffer.isView(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function snapshotJson(value, pointer, state = { nodes: 0 }, depth = 0) {
  state.nodes += 1;
  if (state.nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) fail(pointer);
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length > MAX_JSON_STRING_CODE_UNITS) fail(pointer);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) fail(pointer);
    return value;
  }
  if (typeof value !== "object") fail(pointer);
  const prototype = Object.getPrototypeOf(value);
  const array = Array.isArray(value);
  if ((array && prototype !== Array.prototype) ||
      (!array && prototype !== Object.prototype && prototype !== null)) {
    fail(pointer);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) fail(pointer);
  if (array) {
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) fail(pointer);
    return Object.freeze(Array.from({ length }, (_, index) => {
      const descriptor = descriptors[String(index)];
      if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
        fail(`${pointer}/${index}`);
      }
      return snapshotJson(descriptor.value, `${pointer}/${index}`, state, depth + 1);
    }));
  }
  const output = Object.create(null);
  for (const key of keys.sort()) {
    const descriptor = descriptors[key];
    if (!("value" in descriptor) || descriptor.enumerable !== true) fail(`${pointer}/${key}`);
    output[key] = snapshotJson(descriptor.value, `${pointer}/${key}`, state, depth + 1);
  }
  return Object.freeze(output);
}

function boundedArrayValues(value, pointer, minimum, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail(pointer);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length < minimum || length > maximum ||
      Reflect.ownKeys(descriptors).length !== length + 1) {
    fail(`${pointer}/length`);
  }
  return Array.from({ length }, (_, index) => {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(`${pointer}/${index}`);
    }
    return descriptor.value;
  });
}

function snapshotArchiveBytes(value, pointer) {
  if (!(value instanceof Uint8Array)) fail(pointer);
  let buffer;
  let byteLength;
  let byteOffset;
  try {
    buffer = TYPED_ARRAY_BUFFER_GETTER.call(value);
    byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(value);
    byteOffset = TYPED_ARRAY_BYTE_OFFSET_GETTER.call(value);
  } catch {
    fail(pointer);
  }
  if (!Number.isSafeInteger(byteLength) || byteLength < 1 ||
      byteLength > SECURE_ZIP_LIMITS.maxArchiveBytes ||
      !Number.isSafeInteger(byteOffset) || byteOffset < 0) {
    fail(pointer);
  }
  try {
    return Buffer.from(new Uint8Array(buffer, byteOffset, byteLength));
  } catch {
    fail(pointer);
  }
}

function snapshotExemplars(value) {
  const exemplars = boundedArrayValues(value, "/exemplars", 2, 32)
    .map((exemplar, index) => {
      const pointer = `/exemplars/${index}`;
      const fields = closedRecord(exemplar, pointer, [
        "exemplarId", "sourceArchiveBytes", "templateIndex"
      ]);
      return Object.freeze({
        exemplarId: semanticId(fields.exemplarId, `${pointer}/exemplarId`),
        sourceArchiveBytes: snapshotArchiveBytes(
          fields.sourceArchiveBytes,
          `${pointer}/sourceArchiveBytes`
        ),
        templateIndex: snapshotJson(fields.templateIndex, `${pointer}/templateIndex`)
      });
    });
  return Object.freeze(exemplars);
}

function jsonSha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function captureInput(pointer, operation) {
  try {
    return operation();
  } catch (error) {
    if (error instanceof OrderedStoryDeckError) throw error;
    fail(pointer);
  }
}

function inspectBrief(value, pointer) {
  const fields = closedRecord(value, pointer, [
    "audienceGoal",
    "availableAssetIds",
    "briefVersion",
    "evidencePolicy",
    "function",
    "primaryTakeawayUnitId",
    "slideId",
    "units"
  ]);
  return {
    value,
    slideId: semanticId(fields.slideId, `${pointer}/slideId`),
    function: semanticId(fields.function, `${pointer}/function`),
    evidencePolicy: semanticId(fields.evidencePolicy, `${pointer}/evidencePolicy`),
    primaryTakeawayUnitId: semanticId(
      fields.primaryTakeawayUnitId,
      `${pointer}/primaryTakeawayUnitId`
    )
  };
}

function parseStory(value) {
  const fields = closedRecord(value, "/story", [
    "audienceGoal", "deckId", "desiredOutcome", "slides", "storyVersion", "transitions"
  ]);
  if (fields.storyVersion !== ORDERED_STORY_DECK_VERSION) fail("/story/storyVersion");
  const deckId = semanticId(fields.deckId, "/story/deckId");
  const audienceGoal = safeString(fields.audienceGoal, "/story/audienceGoal");
  const desiredOutcome = safeString(fields.desiredOutcome, "/story/desiredOutcome");
  const slides = arrayValues(fields.slides, "/story/slides", NARRATIVE_ROLES.length)
    .map((slide, index) => {
      const pointer = `/story/slides/${index}`;
      const slideFields = closedRecord(slide, pointer, ["brief", "narrativeRole"]);
      const narrativeRole = semanticId(slideFields.narrativeRole, `${pointer}/narrativeRole`);
      if (narrativeRole !== NARRATIVE_ROLES[index]) fail(`${pointer}/narrativeRole`);
      const brief = inspectBrief(slideFields.brief, `${pointer}/brief`);
      if (brief.function !== FUNCTIONS[index] || brief.evidencePolicy !== "required") {
        fail(`${pointer}/brief`);
      }
      return { narrativeRole, brief };
    });
  if (new Set(slides.map((slide) => slide.brief.slideId)).size !== slides.length ||
      new Set(slides.map((slide) => slide.brief.primaryTakeawayUnitId)).size !== slides.length) {
    fail("/story/slides");
  }
  const transitions = arrayValues(
    fields.transitions,
    "/story/transitions",
    NARRATIVE_ROLES.length - 1
  ).map((transition, index) => {
    const pointer = `/story/transitions/${index}`;
    const transitionFields = closedRecord(transition, pointer, [
      "fromSlideId", "relation", "toSlideId"
    ]);
    const parsed = {
      fromSlideId: semanticId(transitionFields.fromSlideId, `${pointer}/fromSlideId`),
      relation: semanticId(transitionFields.relation, `${pointer}/relation`),
      toSlideId: semanticId(transitionFields.toSlideId, `${pointer}/toSlideId`)
    };
    if (parsed.fromSlideId !== slides[index].brief.slideId ||
        parsed.toSlideId !== slides[index + 1].brief.slideId ||
        parsed.relation !== TRANSITION_RELATIONS[index]) {
      fail(pointer);
    }
    return parsed;
  });
  return { storyVersion: fields.storyVersion, deckId, audienceGoal, desiredOutcome, slides, transitions };
}

/**
 * Select every story beat through the reviewed multi-exemplar boundary, then
 * rebuild one ordered deck only after the complete three-act batch succeeds.
 */
export function selectAndAssembleOrderedStoryDeck(options) {
  const fields = captureInput("/options", () =>
    closedRecord(options, "/options", ["acceptance", "exemplars", "story"]));
  const capturedStory = captureInput("/story", () => snapshotJson(fields.story, "/story"));
  const story = parseStory(capturedStory);
  const capturedAcceptance = captureInput(
    "/acceptance",
    () => snapshotJson(fields.acceptance, "/acceptance")
  );
  const capturedExemplars = captureInput(
    "/exemplars",
    () => snapshotExemplars(fields.exemplars)
  );
  const selections = story.slides.map((slide, index) => {
    try {
      return selectAndAssembleInducedCloneFillPresentation({
        exemplars: capturedExemplars,
        acceptance: capturedAcceptance,
        brief: slide.brief.value,
        outputSlideId: slide.brief.slideId
      });
    } catch {
      fail(`/story/slides/${index}/selection`);
    }
  });
  if (new Set(selections.map((selection) => selection.proposalSetSha256)).size !== 1) {
    fail("/selection/proposalSetSha256");
  }
  let assembled;
  try {
    assembled = assembleOrderedSlideDeck({
      slides: selections.map((selection) => ({
        archiveBytes: selection.archiveBytes,
        report: selection.report
      }))
    });
  } catch {
    fail("/assembly");
  }
  if (assembled.report.slides.some((record, index) =>
    record.outputSlideId !== story.slides[index].brief.slideId ||
    record.sourceArtifactSha256 !== selections[index].report.outputSha256)) {
    fail("/assembly/slideBinding");
  }
  const graph = deepFreeze({
    graphVersion: ORDERED_STORY_DECK_VERSION,
    deckId: story.deckId,
    audienceGoal: story.audienceGoal,
    desiredOutcome: story.desiredOutcome,
    nodes: story.slides.map((slide, index) => ({
      slideId: slide.brief.slideId,
      order: index + 1,
      narrativeRole: slide.narrativeRole,
      function: slide.brief.function,
      primaryTakeawayUnitId: slide.brief.primaryTakeawayUnitId,
      selectedExemplarId: selections[index].selectedExemplarId,
      selectedLayoutId: selections[index].selection.selected.layoutId,
      partPath: assembled.report.slides[index].partPath,
      presentationSlideId: assembled.report.slides[index].presentationSlideId,
      relationshipId: assembled.report.slides[index].relationshipId
    })),
    edges: story.transitions.map((transition) => ({ ...transition }))
  });
  return Object.freeze({
    storyVersion: ORDERED_STORY_DECK_VERSION,
    acceptanceSha256: jsonSha256(capturedAcceptance),
    proposalSetSha256: selections[0].proposalSetSha256,
    graph,
    selectionTraces: deepFreeze(selections.map((selection) => ({
      selectedExemplarId: selection.selectedExemplarId,
      selectedProposalSha256: selection.selectedProposalSha256,
      selection: selection.selection,
      trace: selection.trace,
      planTrace: selection.planTrace,
      singleSlideSha256: selection.report.outputSha256,
      singleSlideDiff: selection.report.diff
    }))),
    archiveBytes: Buffer.from(assembled.archiveBytes),
    report: assembled.report
  });
}
