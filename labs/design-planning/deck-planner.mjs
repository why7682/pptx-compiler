import { createHash } from "node:crypto";

import { selectAndAssembleOrderedStoryDeck } from
  "../layout-selection/ordered-story-deck.mjs";

export const DESIGN_PLANNING_VERSION = "0.1.0";

const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_TEXT = /^(?=.*\S)(?!.*\p{Cf})(?!.*\p{Noncharacter_Code_Point})(?!.*[\uD800-\uDFFF])[^\u0000-\u001F\u007F-\u009F\u2028\u2029]+$/u;
const TEMPLATE_MODES = new Set(["template-locked", "template-flexible", "scratch-lab"]);
const DELIVERY_MODES = new Set(["live-room", "leave-behind"]);
const VIEWING_DISTANCES = new Set(["room", "personal"]);
const REQUIRED_ITEM_TYPES = Object.freeze(["action", "claim", "constraint"]);
const PLANNING_ROLES = Object.freeze(["constraint", "proof", "readiness"]);
const TEMPLATE_ATTRIBUTES = new Set([
  "density", "emphasis", "geometry", "hierarchy", "palette", "typography"
]);
const NARRATIVE_ROLES = Object.freeze(["setup", "evidence", "resolution"]);
const FUNCTIONS = Object.freeze(["status", "status", "decision"]);
const TRANSITION_RELATIONS = Object.freeze(["deepens", "supports"]);
const MAX_JSON_NODES = 20_000;
const MAX_JSON_DEPTH = 96;
const MAX_JSON_STRING_CODE_UNITS = 16_384;

// This bounded lab recognizes only approval records whose complete canonical
// digest was admitted during repository review. A caller can replay the exact
// reviewed record, but cannot turn a newly invented acceptance into authority
// by merely claiming the same authorityClass.
const REVIEWED_APPROVAL_RECORD_SHA256S = new Set([
  "f14f0667ade7c6460b4f10a6f17749d34e22bf590d5e005bd452252fa045bf33"
]);

const STRATEGIES = Object.freeze([
  Object.freeze({
    candidateId: "proof-led-decision",
    setupRole: "proof",
    evidenceRole: "readiness",
    evidenceSupportRole: "constraint",
    resolutionRole: "proof",
    rhythmId: "proof-build-close",
    densityPattern: Object.freeze(["anchor", "normal", "anchor"])
  }),
  Object.freeze({
    candidateId: "constraint-led-decision",
    setupRole: "constraint",
    evidenceRole: "readiness",
    evidenceSupportRole: "proof",
    resolutionRole: "proof",
    rhythmId: "risk-release-close",
    densityPattern: Object.freeze(["normal", "anchor", "anchor"])
  }),
  Object.freeze({
    candidateId: "readiness-led-decision",
    setupRole: "readiness",
    evidenceRole: "proof",
    evidenceSupportRole: "constraint",
    resolutionRole: "constraint",
    rhythmId: "status-proof-close",
    densityPattern: Object.freeze(["normal", "normal", "anchor"])
  })
]);

const RECEIPT_TOKENS = new WeakMap();

export class DesignPlanningError extends Error {
  constructor(pointer) {
    super(`DESIGN_PLANNING_INVALID at ${pointer}`);
    this.name = "DesignPlanningError";
    this.code = "DESIGN_PLANNING_INVALID";
    this.pointer = pointer;
  }
}

function fail(pointer) {
  throw new DesignPlanningError(pointer);
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
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

function arrayValues(value, pointer, minimum, maximum = minimum) {
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

function safeString(value, pointer, maximum = 4_096) {
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

function digest(value, pointer) {
  if (typeof value !== "string" || !SHA256.test(value)) fail(pointer);
  return value;
}

function boundedInteger(value, pointer, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(pointer);
  return value;
}

function stringArray(value, pointer, {
  minimum = 0,
  maximum = 16,
  semantic = false
} = {}) {
  const values = arrayValues(value, pointer, minimum, maximum)
    .map((entry, index) => semantic
      ? semanticId(entry, `${pointer}/${index}`)
      : safeString(entry, `${pointer}/${index}`));
  if (new Set(values).size !== values.length) fail(pointer);
  return values;
}

function captureInput(pointer, operation) {
  try {
    return operation();
  } catch (error) {
    if (error instanceof DesignPlanningError) throw error;
    fail(pointer);
  }
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
  const isArray = Array.isArray(value);
  if ((isArray && prototype !== Array.prototype) ||
      (!isArray && prototype !== Object.prototype && prototype !== null)) {
    fail(pointer);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) fail(pointer);
  if (isArray) {
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
  for (const key of keys.sort(compareCodeUnits)) {
    const descriptor = descriptors[key];
    if (!("value" in descriptor) || descriptor.enumerable !== true) fail(`${pointer}/${key}`);
    output[key] = snapshotJson(descriptor.value, `${pointer}/${key}`, state, depth + 1);
  }
  return Object.freeze(output);
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value) ||
      ArrayBuffer.isView(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort(compareCodeUnits)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256Json(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function parseRawBrief(value) {
  const fields = closedRecord(value, "/rawBrief", [
    "audience", "briefId", "briefType", "briefVersion", "delivery", "desiredOutcome",
    "nonGoals", "requiredItems"
  ]);
  if (fields.briefVersion !== DESIGN_PLANNING_VERSION) fail("/rawBrief/briefVersion");
  if (fields.briefType !== "synthetic-defense-brief") fail("/rawBrief/briefType");
  const audienceFields = closedRecord(fields.audience, "/rawBrief/audience", [
    "role", "startingState"
  ]);
  const deliveryFields = closedRecord(fields.delivery, "/rawBrief/delivery", [
    "durationMinutes", "mode", "viewingDistance"
  ]);
  const mode = semanticId(deliveryFields.mode, "/rawBrief/delivery/mode");
  if (!DELIVERY_MODES.has(mode)) fail("/rawBrief/delivery/mode");
  const viewingDistance = semanticId(
    deliveryFields.viewingDistance,
    "/rawBrief/delivery/viewingDistance"
  );
  if (!VIEWING_DISTANCES.has(viewingDistance) ||
      (mode === "live-room" && viewingDistance !== "room") ||
      (mode === "leave-behind" && viewingDistance !== "personal")) {
    fail("/rawBrief/delivery/viewingDistance");
  }
  const requiredItems = arrayValues(fields.requiredItems, "/rawBrief/requiredItems", 3, 3)
    .map((item, index) => {
      const pointer = `/rawBrief/requiredItems/${index}`;
      const itemFields = closedRecord(item, pointer, ["itemId", "itemType", "statement"]);
      const itemType = semanticId(itemFields.itemType, `${pointer}/itemType`);
      if (!REQUIRED_ITEM_TYPES.includes(itemType)) fail(`${pointer}/itemType`);
      return {
        itemId: semanticId(itemFields.itemId, `${pointer}/itemId`),
        itemType,
        statement: safeString(itemFields.statement, `${pointer}/statement`, 512)
      };
    })
    .sort((left, right) => compareCodeUnits(left.itemId, right.itemId));
  if (new Set(requiredItems.map((item) => item.itemId)).size !== requiredItems.length ||
      REQUIRED_ITEM_TYPES.some((itemType) =>
        requiredItems.filter((item) => item.itemType === itemType).length !== 1)) {
    fail("/rawBrief/requiredItems");
  }
  return deepFreeze({
    briefVersion: fields.briefVersion,
    briefType: fields.briefType,
    briefId: semanticId(fields.briefId, "/rawBrief/briefId"),
    audience: {
      role: safeString(audienceFields.role, "/rawBrief/audience/role", 256),
      startingState: safeString(
        audienceFields.startingState,
        "/rawBrief/audience/startingState",
        512
      )
    },
    desiredOutcome: safeString(fields.desiredOutcome, "/rawBrief/desiredOutcome", 512),
    delivery: {
      mode,
      durationMinutes: boundedInteger(
        deliveryFields.durationMinutes,
        "/rawBrief/delivery/durationMinutes",
        1,
        60
      ),
      viewingDistance
    },
    requiredItems,
    nonGoals: stringArray(fields.nonGoals, "/rawBrief/nonGoals", {
      minimum: 1,
      maximum: 8
    })
  });
}

function parseEvidenceInventory(value, rawBrief) {
  const requiredItemIds = new Set(rawBrief.requiredItems.map((item) => item.itemId));
  const entries = arrayValues(value, "/evidenceInventory", 3, 3)
    .map((entry, index) => {
      const pointer = `/evidenceInventory/${index}`;
      const fields = closedRecord(entry, pointer, [
        "evidenceId", "evidenceType", "label", "planningRole", "required", "statement",
        "supportsRequiredItemIds", "value"
      ]);
      const evidenceType = semanticId(fields.evidenceType, `${pointer}/evidenceType`);
      if (evidenceType !== "metric" || fields.required !== true) fail(pointer);
      const planningRole = semanticId(fields.planningRole, `${pointer}/planningRole`);
      if (!PLANNING_ROLES.includes(planningRole)) fail(`${pointer}/planningRole`);
      const supportsRequiredItemIds = stringArray(
        fields.supportsRequiredItemIds,
        `${pointer}/supportsRequiredItemIds`,
        { minimum: 1, maximum: 3, semantic: true }
      ).sort(compareCodeUnits);
      if (supportsRequiredItemIds.some((itemId) => !requiredItemIds.has(itemId))) {
        fail(`${pointer}/supportsRequiredItemIds`);
      }
      return {
        evidenceId: semanticId(fields.evidenceId, `${pointer}/evidenceId`),
        evidenceType,
        planningRole,
        required: true,
        label: safeString(fields.label, `${pointer}/label`, 128),
        value: safeString(fields.value, `${pointer}/value`, 32),
        statement: safeString(fields.statement, `${pointer}/statement`, 512),
        supportsRequiredItemIds
      };
    })
    .sort((left, right) => compareCodeUnits(left.evidenceId, right.evidenceId));
  if (new Set(entries.map((entry) => entry.evidenceId)).size !== entries.length ||
      PLANNING_ROLES.some((role) =>
        entries.filter((entry) => entry.planningRole === role).length !== 1) ||
      rawBrief.requiredItems.some((item) =>
        !entries.some((entry) => entry.supportsRequiredItemIds.includes(item.itemId)))) {
    fail("/evidenceInventory");
  }
  return deepFreeze(entries);
}

function parseCapacityContract(value, index) {
  const pointer = `/templateProfile/capacityContracts/${index}`;
  const fields = closedRecord(value, pointer, [
    "evidenceKind", "evidenceMaxChars", "function", "takeawayKind", "takeawayMaxChars"
  ]);
  const functionName = semanticId(fields.function, `${pointer}/function`);
  const takeawayKind = semanticId(fields.takeawayKind, `${pointer}/takeawayKind`);
  const evidenceKind = semanticId(fields.evidenceKind, `${pointer}/evidenceKind`);
  if ((functionName === "status" &&
       (takeawayKind !== "metric" || evidenceKind !== "text")) ||
      (functionName === "decision" &&
       (takeawayKind !== "text" || evidenceKind !== "metric")) ||
      !["status", "decision"].includes(functionName)) {
    fail(pointer);
  }
  return {
    function: functionName,
    takeawayKind,
    takeawayMaxChars: boundedInteger(
      fields.takeawayMaxChars,
      `${pointer}/takeawayMaxChars`,
      8,
      512
    ),
    evidenceKind,
    evidenceMaxChars: boundedInteger(
      fields.evidenceMaxChars,
      `${pointer}/evidenceMaxChars`,
      8,
      512
    )
  };
}

function parseTemplateProfile(value) {
  const fields = closedRecord(value, "/templateProfile", [
    "allowedMotifIds", "capacityContracts", "fixedAttributes", "flexibleAttributes",
    "layoutBinding", "mode", "profileVersion", "templateProfileId"
  ]);
  if (fields.profileVersion !== DESIGN_PLANNING_VERSION) {
    fail("/templateProfile/profileVersion");
  }
  const mode = semanticId(fields.mode, "/templateProfile/mode");
  if (!TEMPLATE_MODES.has(mode)) fail("/templateProfile/mode");
  const fixedAttributes = stringArray(fields.fixedAttributes, "/templateProfile/fixedAttributes", {
    minimum: 0,
    maximum: TEMPLATE_ATTRIBUTES.size,
    semantic: true
  }).sort(compareCodeUnits);
  const flexibleAttributes = stringArray(
    fields.flexibleAttributes,
    "/templateProfile/flexibleAttributes",
    { minimum: 0, maximum: TEMPLATE_ATTRIBUTES.size, semantic: true }
  ).sort(compareCodeUnits);
  if ([...fixedAttributes, ...flexibleAttributes]
    .some((attribute) => !TEMPLATE_ATTRIBUTES.has(attribute)) ||
      fixedAttributes.some((attribute) => flexibleAttributes.includes(attribute)) ||
      new Set([...fixedAttributes, ...flexibleAttributes]).size !== TEMPLATE_ATTRIBUTES.size) {
    fail("/templateProfile");
  }
  const lockedCore = ["geometry", "hierarchy", "palette", "typography"];
  if ((mode === "template-locked" &&
       (flexibleAttributes.length !== 0 ||
        lockedCore.some((attribute) => !fixedAttributes.includes(attribute)))) ||
      (mode === "template-flexible" &&
       (["palette", "typography"].some((attribute) => !fixedAttributes.includes(attribute)) ||
        flexibleAttributes.length < 1)) ||
      (mode === "scratch-lab" &&
       (fixedAttributes.length !== 0 ||
        lockedCore.some((attribute) => !flexibleAttributes.includes(attribute))))) {
    fail("/templateProfile/mode");
  }
  const capacityContracts = arrayValues(
    fields.capacityContracts,
    "/templateProfile/capacityContracts",
    2,
    2
  ).map(parseCapacityContract).sort((left, right) => compareCodeUnits(left.function, right.function));
  if (capacityContracts[0]?.function !== "decision" ||
      capacityContracts[1]?.function !== "status") {
    fail("/templateProfile/capacityContracts");
  }
  const layoutBindingFields = closedRecord(
    fields.layoutBinding,
    "/templateProfile/layoutBinding",
    ["layoutAcceptanceSha256", "proposalSetSha256"]
  );
  return deepFreeze({
    profileVersion: fields.profileVersion,
    templateProfileId: semanticId(
      fields.templateProfileId,
      "/templateProfile/templateProfileId"
    ),
    mode,
    allowedMotifIds: stringArray(
      fields.allowedMotifIds,
      "/templateProfile/allowedMotifIds",
      { minimum: STRATEGIES.length, maximum: STRATEGIES.length, semantic: true }
    ),
    fixedAttributes,
    flexibleAttributes,
    capacityContracts,
    layoutBinding: {
      layoutAcceptanceSha256: digest(
        layoutBindingFields.layoutAcceptanceSha256,
        "/templateProfile/layoutBinding/layoutAcceptanceSha256"
      ),
      proposalSetSha256: digest(
        layoutBindingFields.proposalSetSha256,
        "/templateProfile/layoutBinding/proposalSetSha256"
      )
    }
  });
}

function parsePlannerInputs(options) {
  const fields = captureInput("/options", () => closedRecord(options, "/options", [
    "evidenceInventory", "rawBrief", "templateProfile"
  ]));
  const capturedRawBrief = captureInput(
    "/rawBrief",
    () => snapshotJson(fields.rawBrief, "/rawBrief")
  );
  const capturedEvidence = captureInput(
    "/evidenceInventory",
    () => snapshotJson(fields.evidenceInventory, "/evidenceInventory")
  );
  const capturedTemplate = captureInput(
    "/templateProfile",
    () => snapshotJson(fields.templateProfile, "/templateProfile")
  );
  const rawBrief = parseRawBrief(capturedRawBrief);
  const evidenceInventory = parseEvidenceInventory(capturedEvidence, rawBrief);
  const templateProfile = parseTemplateProfile(capturedTemplate);
  const inputCore = deepFreeze({ rawBrief, evidenceInventory, templateProfile });
  return { rawBrief, evidenceInventory, templateProfile, rawInputSha256: sha256Json(inputCore) };
}

function itemByType(rawBrief, itemType) {
  return rawBrief.requiredItems.find((item) => item.itemType === itemType);
}

function evidenceByRole(evidenceInventory, planningRole) {
  return evidenceInventory.find((entry) => entry.planningRole === planningRole);
}

function metricUnit(slideId, evidence, role) {
  return {
    unitId: `${slideId}-${role}`,
    role,
    kind: "metric",
    content: { label: evidence.label, value: evidence.value }
  };
}

function textUnit(slideId, text, role) {
  return {
    unitId: `${slideId}-${role}`,
    role,
    kind: "text",
    content: text
  };
}

function metricLength(unit) {
  return unit.content.label.length + unit.content.value.length;
}

function unitLength(unit) {
  return unit.kind === "metric" ? metricLength(unit) : unit.content.length;
}

function capacityFor(templateProfile, functionName) {
  return templateProfile.capacityContracts.find((entry) => entry.function === functionName);
}

function makeStatusSlide({
  rawBrief,
  templateProfile,
  strategy,
  narrativeRole,
  metricEvidence,
  supportingEvidence,
  order
}) {
  const slideId = `${rawBrief.briefId}-${strategy.candidateId}-${narrativeRole}`;
  const takeaway = metricUnit(slideId, metricEvidence, "takeaway");
  const evidence = textUnit(slideId, supportingEvidence.statement, "evidence");
  const requiredItemIds = [...new Set([
    ...metricEvidence.supportsRequiredItemIds,
    ...supportingEvidence.supportsRequiredItemIds
  ])].sort(compareCodeUnits);
  return {
    slideId,
    order,
    narrativeRole,
    function: "status",
    audienceMove: {
      before: order === 1 ? rawBrief.audience.startingState : "The committee needs the next causal link",
      after: `Recognize ${metricEvidence.value} ${metricEvidence.label}`
    },
    message: `${metricEvidence.value} — ${metricEvidence.label}: ${supportingEvidence.statement}`,
    requiredItemIds,
    evidenceIds: [...new Set([
      metricEvidence.evidenceId,
      supportingEvidence.evidenceId
    ])].sort(compareCodeUnits),
    visualJob: narrativeRole === "setup" ? "establish-condition" : "show-decision-evidence",
    brief: {
      briefVersion: "0.1.0",
      slideId,
      function: "status",
      audienceGoal: `Recognize ${metricEvidence.value} ${metricEvidence.label}`,
      availableAssetIds: [],
      evidencePolicy: "required",
      primaryTakeawayUnitId: takeaway.unitId,
      units: [takeaway, evidence]
    },
    capacityContract: capacityFor(templateProfile, "status")
  };
}

function makeResolutionSlide({ rawBrief, templateProfile, strategy, evidence }) {
  const action = itemByType(rawBrief, "action");
  const slideId = `${rawBrief.briefId}-${strategy.candidateId}-resolution`;
  const takeaway = textUnit(slideId, action.statement, "takeaway");
  const support = metricUnit(slideId, evidence, "evidence");
  return {
    slideId,
    order: 3,
    narrativeRole: "resolution",
    function: "decision",
    audienceMove: {
      before: "The committee understands the evidence and boundary",
      after: rawBrief.desiredOutcome
    },
    message: `${action.statement} because ${evidence.value} ${evidence.label}`,
    requiredItemIds: [...new Set([
      action.itemId,
      ...evidence.supportsRequiredItemIds
    ])].sort(compareCodeUnits),
    evidenceIds: [evidence.evidenceId],
    visualJob: "request-bounded-action",
    brief: {
      briefVersion: "0.1.0",
      slideId,
      function: "decision",
      audienceGoal: rawBrief.desiredOutcome,
      availableAssetIds: [],
      evidencePolicy: "required",
      primaryTakeawayUnitId: takeaway.unitId,
      units: [takeaway, support]
    },
    capacityContract: capacityFor(templateProfile, "decision")
  };
}

function makeInputCoverageAssertions(rawBrief, evidenceInventory, slideContracts) {
  const requiredItemTests = rawBrief.requiredItems.map((item) => ({
    targetId: item.itemId,
    targetType: item.itemType,
    coveredBySlideIds: slideContracts
      .filter((slide) => slide.requiredItemIds.includes(item.itemId))
      .map((slide) => slide.slideId),
    removalEffect: item.itemType === "action"
      ? "removes-requested-action"
      : item.itemType === "constraint"
        ? "overstates-evidence-boundary"
        : "breaks-central-claim"
  }));
  const evidenceTests = evidenceInventory.map((evidence) => ({
    targetId: evidence.evidenceId,
    targetType: "evidence",
    coveredBySlideIds: slideContracts
      .filter((slide) => slide.evidenceIds.includes(evidence.evidenceId))
      .map((slide) => slide.slideId),
    removalEffect: "breaks-evidence-support"
  }));
  return [...requiredItemTests, ...evidenceTests]
    .sort((left, right) => compareCodeUnits(left.targetId, right.targetId));
}

function argumentViolations(nodes, edges, requestedActionItemId) {
  const violations = [];
  const setup = nodes.find((node) =>
    node.order === 1 && node.narrativeRole === "setup" && node.nodeType === "claim");
  const evidence = nodes.find((node) =>
    node.order === 2 && node.narrativeRole === "evidence" && node.nodeType === "evidence");
  const resolution = nodes.find((node) =>
    node.order === 3 && node.narrativeRole === "resolution" && node.nodeType === "action" &&
    node.requiredItemIds.includes(requestedActionItemId));
  if (setup === undefined) violations.push("missing-opening-condition");
  if (evidence === undefined) violations.push("missing-evidence-bridge");
  if (resolution === undefined) violations.push("missing-bounded-action");
  if (setup === undefined || evidence === undefined || !edges.some((edge) =>
    edge.fromSlideId === setup.slideId && edge.toSlideId === evidence.slideId &&
    edge.relation === "deepens")) {
    violations.push("missing-opening-evidence-link");
  }
  if (evidence === undefined || resolution === undefined || !edges.some((edge) =>
    edge.fromSlideId === evidence.slideId && edge.toSlideId === resolution.slideId &&
    edge.relation === "supports")) {
    violations.push("missing-evidence-action-link");
  }
  return violations.sort(compareCodeUnits);
}

function makeNodeDeletionTests(nodes, edges, requestedActionItemId) {
  if (argumentViolations(nodes, edges, requestedActionItemId).length !== 0) {
    fail("/candidate/narrativeGraph");
  }
  return nodes.map((node) => {
    const remainingNodes = nodes.filter((entry) => entry.slideId !== node.slideId);
    const remainingEdges = edges.filter((edge) =>
      edge.fromSlideId !== node.slideId && edge.toSlideId !== node.slideId);
    const violatedInvariants = argumentViolations(
      remainingNodes,
      remainingEdges,
      requestedActionItemId
    );
    if (violatedInvariants.length === 0) fail("/candidate/nodeDeletionTests");
    return {
      targetSlideId: node.slideId,
      targetNodeType: node.nodeType,
      remainingSlideIds: remainingNodes.map((entry) => entry.slideId),
      removedEdgeCount: edges.length - remainingEdges.length,
      violatedInvariants,
      outcome: "argument-invalid"
    };
  });
}

function makeCandidate(context, strategy, motifId, candidateIndex) {
  const { rawBrief, evidenceInventory, templateProfile, rawInputSha256 } = context;
  const setupEvidence = evidenceByRole(evidenceInventory, strategy.setupRole);
  const evidencePrimary = evidenceByRole(evidenceInventory, strategy.evidenceRole);
  const evidenceSupport = evidenceByRole(evidenceInventory, strategy.evidenceSupportRole);
  const resolutionEvidence = evidenceByRole(evidenceInventory, strategy.resolutionRole);
  const baseSlides = [
    makeStatusSlide({
      rawBrief,
      templateProfile,
      strategy,
      narrativeRole: "setup",
      metricEvidence: setupEvidence,
      supportingEvidence: setupEvidence,
      order: 1
    }),
    makeStatusSlide({
      rawBrief,
      templateProfile,
      strategy,
      narrativeRole: "evidence",
      metricEvidence: evidencePrimary,
      supportingEvidence: evidenceSupport,
      order: 2
    }),
    makeResolutionSlide({
      rawBrief,
      templateProfile,
      strategy,
      evidence: resolutionEvidence
    })
  ];
  const edges = baseSlides.slice(0, -1).map((slide, index) => ({
    fromSlideId: slide.slideId,
    relation: TRANSITION_RELATIONS[index],
    toSlideId: baseSlides[index + 1].slideId
  }));
  const constraintItem = itemByType(rawBrief, "constraint");
  const densityPattern = templateProfile.mode === "template-locked"
    ? ["anchor", "normal", "anchor"]
    : strategy.densityPattern;
  const slides = baseSlides.map((slide, index) => ({
    ...slide,
    confidenceBoundary: {
      boundaryItemIds: [constraintItem.itemId],
      excludedClaims: [...rawBrief.nonGoals]
    },
    visualReason: index === 2
      ? "A dominant editable action plus one bound metric makes the decision explicit"
      : "A dominant metric plus one bound statement exposes evidence and its limit",
    transition: index < edges.length ? { ...edges[index] } : null,
    deliveryDensity: densityPattern[index],
    nativeEditability: { required: true, objectKinds: ["text"] }
  }));
  const visualOwnership = templateProfile.mode === "template-locked"
    ? "template-owned"
    : templateProfile.mode === "template-flexible"
      ? "template-preserved"
      : "subject-derived";
  const subjectBindings = [
    {
      bindingId: "opening-signature",
      evidenceId: setupEvidence.evidenceId,
      expression: "opening-metric-anchor",
      rationale: `Open with ${setupEvidence.value} ${setupEvidence.label} because it frames the first inference`
    },
    {
      bindingId: "evidence-peak",
      evidenceId: evidencePrimary.evidenceId,
      expression: "middle-evidence-anchor",
      rationale: `Use ${evidencePrimary.value} ${evidencePrimary.label} as the evidence peak`
    },
    {
      bindingId: "decision-support",
      evidenceId: resolutionEvidence.evidenceId,
      expression: "closing-decision-support",
      rationale: `Return to ${resolutionEvidence.value} ${resolutionEvidence.label} beside the requested action`
    }
  ];
  const graphNodes = slides.map((slide, index) => ({
    slideId: slide.slideId,
    order: slide.order,
    narrativeRole: slide.narrativeRole,
    nodeType: ["claim", "evidence", "action"][index],
    message: slide.message,
    requiredItemIds: [...slide.requiredItemIds],
    evidenceIds: [...slide.evidenceIds],
    deletionTargetIds: [...new Set([
      ...slide.requiredItemIds,
      ...slide.evidenceIds
    ])].sort(compareCodeUnits)
  }));
  const core = {
    candidateVersion: DESIGN_PLANNING_VERSION,
    candidateType: "deck-hypothesis-candidate",
    candidateId: strategy.candidateId,
    strategyId: strategy.candidateId,
    rawInputSha256,
    communicationContract: {
      contractVersion: DESIGN_PLANNING_VERSION,
      audienceRole: rawBrief.audience.role,
      startingState: rawBrief.audience.startingState,
      desiredOutcome: rawBrief.desiredOutcome,
      centralClaimItemId: itemByType(rawBrief, "claim").itemId,
      centralClaim: itemByType(rawBrief, "claim").statement,
      requestedActionItemId: itemByType(rawBrief, "action").itemId,
      requestedAction: itemByType(rawBrief, "action").statement,
      boundaryItemId: itemByType(rawBrief, "constraint").itemId,
      delivery: { ...rawBrief.delivery },
      presentationSituation: `${rawBrief.audience.role} ${rawBrief.delivery.mode}`,
      artifactAfterlife: rawBrief.delivery.mode === "live-room" ? "live-only" : "leave-behind",
      allowedEvidenceIds: evidenceInventory.map((entry) => entry.evidenceId),
      unresolvedEvidenceGapItemIds: [constraintItem.itemId],
      nonGoals: [...rawBrief.nonGoals]
    },
    narrativeGraph: {
      graphVersion: DESIGN_PLANNING_VERSION,
      nodes: graphNodes,
      edges
    },
    slideContracts: slides,
    visualLanguageProposal: {
      proposalVersion: DESIGN_PLANNING_VERSION,
      templateProfileId: templateProfile.templateProfileId,
      templateMode: templateProfile.mode,
      origin: templateProfile.mode === "template-locked"
        ? "template"
        : templateProfile.mode === "template-flexible"
          ? "template-plus-subject"
          : "subject",
      motifId,
      fixedAttributes: [...templateProfile.fixedAttributes],
      flexibleAttributes: [...templateProfile.flexibleAttributes],
      paletteRoles: {
        identity: visualOwnership,
        evidence: visualOwnership,
        boundary: visualOwnership
      },
      typographyRoles: {
        primary: visualOwnership,
        supporting: visualOwnership
      },
      imageBehavior: "evidence-only-no-stock",
      shapeLineGrammar: visualOwnership,
      signatureElement: {
        signatureId: motifId,
        evidenceId: setupEvidence.evidenceId,
        rationale: subjectBindings[0].rationale
      },
      visualRisk: {
        riskId: `${strategy.candidateId}-opening-bias`,
        description: `Leading with ${setupEvidence.label} may over-weight the opening condition`,
        mitigation: "Keep the completion boundary visible before the action"
      },
      evidenceDisplayBehavior: "pair-metric-with-bounded-statement",
      continuityRules: [
        "reuse-signature-only-for-bound-evidence",
        "retain-one-primary-and-one-supporting-unit"
      ],
      allowedVariations: templateProfile.flexibleAttributes.length === 0
        ? ["evidence-order-within-template"]
        : templateProfile.flexibleAttributes.map((attribute) => `${attribute}-within-profile`),
      forbiddenDefaults: [
        "topic-only-decoration",
        "uniform-slide-density",
        "unverified-stock-imagery"
      ],
      subjectBindings,
      decisionRationales: subjectBindings.map((binding) => ({
        decisionId: binding.bindingId,
        evidenceId: binding.evidenceId,
        rationale: binding.rationale
      })),
      layoutBinding: { ...templateProfile.layoutBinding }
    },
    rhythmPlan: {
      planVersion: DESIGN_PLANNING_VERSION,
      rhythmId: strategy.rhythmId,
      deliveryMode: rawBrief.delivery.mode,
      beats: slides.map((slide, index) => ({
        slideId: slide.slideId,
        beat: ["orient", "examine", "decide"][index],
        layoutFamily: slide.function,
        dominantCarrier: slide.brief.units[0].kind,
        density: slide.deliveryDensity,
        scale: "primary-dominant",
        focalLocation: visualOwnership === "subject-derived"
          ? "subject-primary"
          : "template-primary",
        backgroundState: visualOwnership,
        motifUse: index === 1 ? "deliberate-absence" : motifId,
        previousRelation: index === 0 ? null : edges[index - 1].relation,
        nextRelation: index === edges.length ? null : edges[index].relation,
        emphasis: index === 2
          ? "action"
          : templateProfile.mode === "template-locked"
            ? ["opening", "evidence"][index]
            : index === 0 ? strategy.setupRole : strategy.evidenceRole
      }))
    },
    inputCoverageAssertions: makeInputCoverageAssertions(rawBrief, evidenceInventory, slides),
    nodeDeletionTests: makeNodeDeletionTests(
      graphNodes,
      edges,
      itemByType(rawBrief, "action").itemId
    )
  };
  validateCandidateCore(core, context, `/candidates/${candidateIndex}`);
  return deepFreeze({ ...core, candidateSha256: sha256Json(core) });
}

function validateBriefCapacity(slide, templateProfile, pointer) {
  const expected = capacityFor(templateProfile, slide.function);
  if (expected === undefined || slide.capacityContract.function !== expected.function ||
      slide.capacityContract.takeawayKind !== expected.takeawayKind ||
      slide.capacityContract.evidenceKind !== expected.evidenceKind ||
      slide.capacityContract.takeawayMaxChars !== expected.takeawayMaxChars ||
      slide.capacityContract.evidenceMaxChars !== expected.evidenceMaxChars) {
    fail(`${pointer}/capacityContract`);
  }
  const [takeaway, evidence] = slide.brief.units;
  if (takeaway.kind !== expected.takeawayKind || evidence.kind !== expected.evidenceKind ||
      unitLength(takeaway) > expected.takeawayMaxChars ||
      unitLength(evidence) > expected.evidenceMaxChars) {
    fail(`${pointer}/brief/units`);
  }
}

function validateCandidateCore(candidate, context, pointer) {
  const fields = closedRecord(candidate, pointer, [
    "candidateId", "candidateType", "candidateVersion", "communicationContract",
    "inputCoverageAssertions", "narrativeGraph", "nodeDeletionTests", "rawInputSha256",
    "rhythmPlan", "slideContracts", "strategyId", "visualLanguageProposal"
  ]);
  if (fields.candidateVersion !== DESIGN_PLANNING_VERSION ||
      fields.candidateType !== "deck-hypothesis-candidate" ||
      fields.rawInputSha256 !== context.rawInputSha256 ||
      fields.strategyId !== fields.candidateId) {
    fail(pointer);
  }
  semanticId(fields.candidateId, `${pointer}/candidateId`);
  const communication = closedRecord(fields.communicationContract, `${pointer}/communicationContract`, [
    "allowedEvidenceIds", "artifactAfterlife", "audienceRole", "boundaryItemId", "centralClaim",
    "centralClaimItemId", "contractVersion", "delivery", "desiredOutcome", "nonGoals",
    "presentationSituation", "requestedAction", "requestedActionItemId", "startingState",
    "unresolvedEvidenceGapItemIds"
  ]);
  if (communication.contractVersion !== DESIGN_PLANNING_VERSION ||
      communication.centralClaimItemId !== itemByType(context.rawBrief, "claim").itemId ||
      communication.centralClaim !== itemByType(context.rawBrief, "claim").statement ||
      communication.requestedActionItemId !== itemByType(context.rawBrief, "action").itemId ||
      communication.requestedAction !== itemByType(context.rawBrief, "action").statement ||
      communication.boundaryItemId !== itemByType(context.rawBrief, "constraint").itemId ||
      canonicalJson(communication.allowedEvidenceIds) !== canonicalJson(
        context.evidenceInventory.map((entry) => entry.evidenceId)
      ) ||
      canonicalJson(communication.nonGoals) !== canonicalJson(context.rawBrief.nonGoals) ||
      canonicalJson(communication.unresolvedEvidenceGapItemIds) !== canonicalJson([
        itemByType(context.rawBrief, "constraint").itemId
      ])) {
    fail(`${pointer}/communicationContract`);
  }
  const slides = arrayValues(fields.slideContracts, `${pointer}/slideContracts`, 3, 3);
  const validEvidenceIds = new Set(context.evidenceInventory.map((entry) => entry.evidenceId));
  const validItemIds = new Set(context.rawBrief.requiredItems.map((entry) => entry.itemId));
  slides.forEach((slide, index) => {
    const slidePointer = `${pointer}/slideContracts/${index}`;
    const slideFields = closedRecord(slide, slidePointer, [
      "audienceMove", "brief", "capacityContract", "confidenceBoundary", "deliveryDensity",
      "evidenceIds", "function", "message", "narrativeRole", "nativeEditability", "order",
      "requiredItemIds", "slideId", "transition", "visualJob", "visualReason"
    ]);
    if (slideFields.order !== index + 1 || slideFields.narrativeRole !== NARRATIVE_ROLES[index] ||
        slideFields.function !== FUNCTIONS[index]) {
      fail(slidePointer);
    }
    semanticId(slideFields.slideId, `${slidePointer}/slideId`);
    safeString(slideFields.message, `${slidePointer}/message`, 1_024);
    const evidenceIds = stringArray(slideFields.evidenceIds, `${slidePointer}/evidenceIds`, {
      minimum: 1,
      maximum: 3,
      semantic: true
    });
    const requiredItemIds = stringArray(
      slideFields.requiredItemIds,
      `${slidePointer}/requiredItemIds`,
      { minimum: 1, maximum: 3, semantic: true }
    );
    if (evidenceIds.some((id) => !validEvidenceIds.has(id)) ||
        requiredItemIds.some((id) => !validItemIds.has(id))) {
      fail(slidePointer);
    }
    const expectedRequiredItemIds = [...new Set(evidenceIds.flatMap((evidenceId) =>
      context.evidenceInventory.find((entry) => entry.evidenceId === evidenceId)
        .supportsRequiredItemIds))];
    if (index === 2) expectedRequiredItemIds.push(itemByType(context.rawBrief, "action").itemId);
    expectedRequiredItemIds.sort(compareCodeUnits);
    if (canonicalJson([...requiredItemIds].sort(compareCodeUnits)) !==
        canonicalJson([...new Set(expectedRequiredItemIds)])) {
      fail(`${slidePointer}/requiredItemIds`);
    }
    const audienceMove = closedRecord(slideFields.audienceMove, `${slidePointer}/audienceMove`, [
      "after", "before"
    ]);
    safeString(audienceMove.before, `${slidePointer}/audienceMove/before`, 1_024);
    safeString(audienceMove.after, `${slidePointer}/audienceMove/after`, 1_024);
    const confidenceBoundary = closedRecord(
      slideFields.confidenceBoundary,
      `${slidePointer}/confidenceBoundary`,
      ["boundaryItemIds", "excludedClaims"]
    );
    if (canonicalJson(confidenceBoundary.boundaryItemIds) !== canonicalJson([
      itemByType(context.rawBrief, "constraint").itemId
    ]) || canonicalJson(confidenceBoundary.excludedClaims) !==
        canonicalJson(context.rawBrief.nonGoals)) {
      fail(`${slidePointer}/confidenceBoundary`);
    }
    if (!["anchor", "normal", "deep-reading"].includes(slideFields.deliveryDensity) ||
        (context.rawBrief.delivery.mode === "live-room" &&
         slideFields.deliveryDensity === "deep-reading")) {
      fail(`${slidePointer}/deliveryDensity`);
    }
    const editability = closedRecord(
      slideFields.nativeEditability,
      `${slidePointer}/nativeEditability`,
      ["objectKinds", "required"]
    );
    if (editability.required !== true || canonicalJson(editability.objectKinds) !== '["text"]') {
      fail(`${slidePointer}/nativeEditability`);
    }
    safeString(slideFields.visualReason, `${slidePointer}/visualReason`, 1_024);
    if (index < 2) {
      const transition = closedRecord(slideFields.transition, `${slidePointer}/transition`, [
        "fromSlideId", "relation", "toSlideId"
      ]);
      if (transition.fromSlideId !== slideFields.slideId ||
          transition.relation !== TRANSITION_RELATIONS[index]) {
        fail(`${slidePointer}/transition`);
      }
    } else if (slideFields.transition !== null) {
      fail(`${slidePointer}/transition`);
    }
    validateBriefCapacity(slide, context.templateProfile, slidePointer);
  });
  if (new Set(slides.map((slide) => slide.slideId)).size !== slides.length ||
      context.evidenceInventory.some((evidence) =>
        !slides.some((slide) => slide.evidenceIds.includes(evidence.evidenceId))) ||
      context.rawBrief.requiredItems.some((item) =>
        !slides.some((slide) => slide.requiredItemIds.includes(item.itemId)))) {
    fail(`${pointer}/slideContracts`);
  }
  const graph = closedRecord(fields.narrativeGraph, `${pointer}/narrativeGraph`, [
    "edges", "graphVersion", "nodes"
  ]);
  const graphNodes = arrayValues(graph.nodes, `${pointer}/narrativeGraph/nodes`, 3, 3)
    .map((node, index) => {
      const nodePointer = `${pointer}/narrativeGraph/nodes/${index}`;
      const nodeFields = closedRecord(node, nodePointer, [
        "deletionTargetIds", "evidenceIds", "message", "narrativeRole", "nodeType",
        "order", "requiredItemIds", "slideId"
      ]);
      const expectedDeletionTargets = [...new Set([
        ...slides[index].requiredItemIds,
        ...slides[index].evidenceIds
      ])].sort(compareCodeUnits);
      if (nodeFields.slideId !== slides[index].slideId || nodeFields.order !== index + 1 ||
          nodeFields.narrativeRole !== NARRATIVE_ROLES[index] ||
          nodeFields.nodeType !== ["claim", "evidence", "action"][index] ||
          nodeFields.message !== slides[index].message ||
          canonicalJson(nodeFields.requiredItemIds) !== canonicalJson(slides[index].requiredItemIds) ||
          canonicalJson(nodeFields.evidenceIds) !== canonicalJson(slides[index].evidenceIds) ||
          canonicalJson(nodeFields.deletionTargetIds) !== canonicalJson(expectedDeletionTargets)) {
        fail(nodePointer);
      }
      return nodeFields;
    });
  const graphEdges = arrayValues(graph.edges, `${pointer}/narrativeGraph/edges`, 2, 2)
    .map((edge, index) => {
      const edgePointer = `${pointer}/narrativeGraph/edges/${index}`;
      const edgeFields = closedRecord(edge, edgePointer, [
        "fromSlideId", "relation", "toSlideId"
      ]);
      if (edgeFields.fromSlideId !== slides[index].slideId ||
          edgeFields.toSlideId !== slides[index + 1].slideId ||
          edgeFields.relation !== TRANSITION_RELATIONS[index] ||
          canonicalJson(slides[index].transition) !== canonicalJson(edgeFields)) {
        fail(edgePointer);
      }
      return edgeFields;
    });
  if (graph.graphVersion !== DESIGN_PLANNING_VERSION ||
      graphNodes.length !== slides.length || graphEdges.length !== slides.length - 1) {
    fail(`${pointer}/narrativeGraph`);
  }
  const visual = closedRecord(
    fields.visualLanguageProposal,
    `${pointer}/visualLanguageProposal`,
    [
      "allowedVariations", "continuityRules", "decisionRationales", "evidenceDisplayBehavior",
      "fixedAttributes", "flexibleAttributes", "forbiddenDefaults", "imageBehavior",
      "layoutBinding", "motifId", "origin", "paletteRoles", "proposalVersion",
      "shapeLineGrammar", "signatureElement", "subjectBindings", "templateMode",
      "templateProfileId", "typographyRoles", "visualRisk"
    ]
  );
  const expectedOrigin = context.templateProfile.mode === "template-locked"
    ? "template"
    : context.templateProfile.mode === "template-flexible"
      ? "template-plus-subject"
      : "subject";
  if (visual.proposalVersion !== DESIGN_PLANNING_VERSION ||
      visual.templateProfileId !== context.templateProfile.templateProfileId ||
      visual.templateMode !== context.templateProfile.mode ||
      visual.origin !== expectedOrigin ||
      !context.templateProfile.allowedMotifIds.includes(visual.motifId) ||
      canonicalJson(visual.fixedAttributes) !== canonicalJson(context.templateProfile.fixedAttributes) ||
      canonicalJson(visual.flexibleAttributes) !==
        canonicalJson(context.templateProfile.flexibleAttributes) ||
      canonicalJson(visual.layoutBinding) !== canonicalJson(context.templateProfile.layoutBinding)) {
    fail(`${pointer}/visualLanguageProposal`);
  }
  const expectedOwnership = context.templateProfile.mode === "template-locked"
    ? "template-owned"
    : context.templateProfile.mode === "template-flexible"
      ? "template-preserved"
      : "subject-derived";
  const paletteRoles = closedRecord(
    visual.paletteRoles,
    `${pointer}/visualLanguageProposal/paletteRoles`,
    ["boundary", "evidence", "identity"]
  );
  const typographyRoles = closedRecord(
    visual.typographyRoles,
    `${pointer}/visualLanguageProposal/typographyRoles`,
    ["primary", "supporting"]
  );
  if (Object.values(paletteRoles).some((value) => value !== expectedOwnership) ||
      Object.values(typographyRoles).some((value) => value !== expectedOwnership) ||
      visual.shapeLineGrammar !== expectedOwnership ||
      visual.imageBehavior !== "evidence-only-no-stock" ||
      visual.evidenceDisplayBehavior !== "pair-metric-with-bounded-statement") {
    fail(`${pointer}/visualLanguageProposal`);
  }
  const signature = closedRecord(
    visual.signatureElement,
    `${pointer}/visualLanguageProposal/signatureElement`,
    ["evidenceId", "rationale", "signatureId"]
  );
  const visualRisk = closedRecord(
    visual.visualRisk,
    `${pointer}/visualLanguageProposal/visualRisk`,
    ["description", "mitigation", "riskId"]
  );
  if (signature.signatureId !== visual.motifId || !validEvidenceIds.has(signature.evidenceId) ||
      !slides[0].evidenceIds.includes(signature.evidenceId)) {
    fail(`${pointer}/visualLanguageProposal/signatureElement`);
  }
  safeString(signature.rationale, `${pointer}/visualLanguageProposal/signatureElement/rationale`);
  semanticId(visualRisk.riskId, `${pointer}/visualLanguageProposal/visualRisk/riskId`);
  safeString(visualRisk.description, `${pointer}/visualLanguageProposal/visualRisk/description`);
  safeString(visualRisk.mitigation, `${pointer}/visualLanguageProposal/visualRisk/mitigation`);
  stringArray(
    visual.continuityRules,
    `${pointer}/visualLanguageProposal/continuityRules`,
    { minimum: 1, maximum: 8, semantic: true }
  );
  stringArray(
    visual.allowedVariations,
    `${pointer}/visualLanguageProposal/allowedVariations`,
    { minimum: 1, maximum: 8, semantic: true }
  );
  stringArray(
    visual.forbiddenDefaults,
    `${pointer}/visualLanguageProposal/forbiddenDefaults`,
    { minimum: 1, maximum: 8, semantic: true }
  );
  const subjectBindings = arrayValues(
    visual.subjectBindings,
    `${pointer}/visualLanguageProposal/subjectBindings`,
    3,
    3
  ).map((binding, index) => {
    const bindingPointer = `${pointer}/visualLanguageProposal/subjectBindings/${index}`;
    const bindingFields = closedRecord(binding, bindingPointer, [
      "bindingId", "evidenceId", "expression", "rationale"
    ]);
    semanticId(bindingFields.bindingId, `${bindingPointer}/bindingId`);
    semanticId(bindingFields.expression, `${bindingPointer}/expression`);
    safeString(bindingFields.rationale, `${bindingPointer}/rationale`);
    if (!validEvidenceIds.has(bindingFields.evidenceId) ||
        !slides[index].evidenceIds.includes(bindingFields.evidenceId)) {
      fail(`${bindingPointer}/evidenceId`);
    }
    return bindingFields;
  });
  if (new Set(subjectBindings.map((binding) => binding.bindingId)).size !== subjectBindings.length) {
    fail(`${pointer}/visualLanguageProposal/subjectBindings`);
  }
  const rationales = arrayValues(
    visual.decisionRationales,
    `${pointer}/visualLanguageProposal/decisionRationales`,
    subjectBindings.length,
    subjectBindings.length
  );
  if (rationales.some((rationale, index) =>
    canonicalJson(rationale) !== canonicalJson({
      decisionId: subjectBindings[index].bindingId,
      evidenceId: subjectBindings[index].evidenceId,
      rationale: subjectBindings[index].rationale
    }))) {
    fail(`${pointer}/visualLanguageProposal/decisionRationales`);
  }
  const rhythm = closedRecord(fields.rhythmPlan, `${pointer}/rhythmPlan`, [
    "beats", "deliveryMode", "planVersion", "rhythmId"
  ]);
  const rhythmBeats = arrayValues(rhythm.beats, `${pointer}/rhythmPlan/beats`, 3, 3)
    .map((beat, index) => {
      const beatPointer = `${pointer}/rhythmPlan/beats/${index}`;
      const beatFields = closedRecord(beat, beatPointer, [
        "backgroundState", "beat", "density", "dominantCarrier", "emphasis",
        "focalLocation", "layoutFamily", "motifUse", "nextRelation", "previousRelation",
        "scale", "slideId"
      ]);
      if (beatFields.slideId !== slides[index].slideId ||
          beatFields.layoutFamily !== slides[index].function ||
          beatFields.dominantCarrier !== slides[index].brief.units[0].kind ||
          beatFields.density !== slides[index].deliveryDensity ||
          beatFields.previousRelation !== (index === 0 ? null : TRANSITION_RELATIONS[index - 1]) ||
          beatFields.nextRelation !== (index === 2 ? null : TRANSITION_RELATIONS[index]) ||
          ![visual.motifId, "deliberate-absence"].includes(beatFields.motifUse)) {
        fail(beatPointer);
      }
      return beatFields;
    });
  if (rhythm.planVersion !== DESIGN_PLANNING_VERSION ||
      rhythm.deliveryMode !== context.rawBrief.delivery.mode || rhythmBeats.length !== slides.length) {
    fail(`${pointer}/rhythmPlan`);
  }
  const inputCoverageAssertions = arrayValues(
    fields.inputCoverageAssertions,
    `${pointer}/inputCoverageAssertions`,
    context.rawBrief.requiredItems.length + context.evidenceInventory.length,
    context.rawBrief.requiredItems.length + context.evidenceInventory.length
  );
  const expectedTargets = new Set([
    ...context.rawBrief.requiredItems.map((item) => item.itemId),
    ...context.evidenceInventory.map((entry) => entry.evidenceId)
  ]);
  const parsedCoverageAssertions = inputCoverageAssertions.map((deletionTest, index) => {
    const deletionPointer = `${pointer}/inputCoverageAssertions/${index}`;
    const deletionFields = closedRecord(deletionTest, deletionPointer, [
      "coveredBySlideIds", "removalEffect", "targetId", "targetType"
    ]);
    const item = context.rawBrief.requiredItems.find((entry) =>
      entry.itemId === deletionFields.targetId);
    const evidence = context.evidenceInventory.find((entry) =>
      entry.evidenceId === deletionFields.targetId);
    if ((item === undefined) === (evidence === undefined)) fail(`${deletionPointer}/targetId`);
    const expectedType = item?.itemType ?? "evidence";
    const expectedEffect = expectedType === "action"
      ? "removes-requested-action"
      : expectedType === "constraint"
        ? "overstates-evidence-boundary"
        : expectedType === "claim"
          ? "breaks-central-claim"
          : "breaks-evidence-support";
    const expectedCoverage = slides
      .filter((slide) => item === undefined
        ? slide.evidenceIds.includes(deletionFields.targetId)
        : slide.requiredItemIds.includes(deletionFields.targetId))
      .map((slide) => slide.slideId);
    const coveredBySlideIds = stringArray(
      deletionFields.coveredBySlideIds,
      `${deletionPointer}/coveredBySlideIds`,
      { minimum: 1, maximum: 3, semantic: true }
    );
    if (deletionFields.targetType !== expectedType ||
        deletionFields.removalEffect !== expectedEffect ||
        canonicalJson(coveredBySlideIds) !== canonicalJson(expectedCoverage)) {
      fail(deletionPointer);
    }
    return deletionFields;
  });
  if (new Set(parsedCoverageAssertions.map((entry) => entry.targetId)).size !==
        expectedTargets.size ||
      parsedCoverageAssertions.some((entry) => !expectedTargets.has(entry.targetId))) {
    fail(`${pointer}/inputCoverageAssertions`);
  }
  if (argumentViolations(
    graphNodes,
    graphEdges,
    communication.requestedActionItemId
  ).length !== 0) {
    fail(`${pointer}/narrativeGraph`);
  }
  const expectedNodeDeletionTests = makeNodeDeletionTests(
    graphNodes,
    graphEdges,
    communication.requestedActionItemId
  );
  const nodeDeletionTests = arrayValues(
    fields.nodeDeletionTests,
    `${pointer}/nodeDeletionTests`,
    graphNodes.length,
    graphNodes.length
  ).map((deletionTest, index) => {
    const deletionPointer = `${pointer}/nodeDeletionTests/${index}`;
    const deletionFields = closedRecord(deletionTest, deletionPointer, [
      "outcome", "remainingSlideIds", "removedEdgeCount", "targetNodeType",
      "targetSlideId", "violatedInvariants"
    ]);
    semanticId(deletionFields.targetSlideId, `${deletionPointer}/targetSlideId`);
    semanticId(deletionFields.targetNodeType, `${deletionPointer}/targetNodeType`);
    boundedInteger(deletionFields.removedEdgeCount, `${deletionPointer}/removedEdgeCount`, 1, 2);
    stringArray(deletionFields.remainingSlideIds, `${deletionPointer}/remainingSlideIds`, {
      minimum: 2,
      maximum: 2,
      semantic: true
    });
    stringArray(deletionFields.violatedInvariants, `${deletionPointer}/violatedInvariants`, {
      minimum: 1,
      maximum: 5,
      semantic: true
    });
    if (deletionFields.outcome !== "argument-invalid" ||
        canonicalJson(deletionFields) !== canonicalJson(expectedNodeDeletionTests[index])) {
      fail(deletionPointer);
    }
    return deletionFields;
  });
  if (nodeDeletionTests.length !== graphNodes.length) {
    fail(`${pointer}/nodeDeletionTests`);
  }
}

function candidateCore(candidate) {
  const fields = closedRecord(candidate, "/candidate", [
    "candidateId", "candidateSha256", "candidateType", "candidateVersion",
    "communicationContract", "inputCoverageAssertions", "narrativeGraph",
    "nodeDeletionTests", "rawInputSha256", "rhythmPlan", "slideContracts", "strategyId",
    "visualLanguageProposal"
  ]);
  digest(fields.candidateSha256, "/candidate/candidateSha256");
  const core = {
    candidateVersion: fields.candidateVersion,
    candidateType: fields.candidateType,
    candidateId: fields.candidateId,
    strategyId: fields.strategyId,
    rawInputSha256: fields.rawInputSha256,
    communicationContract: fields.communicationContract,
    narrativeGraph: fields.narrativeGraph,
    slideContracts: fields.slideContracts,
    visualLanguageProposal: fields.visualLanguageProposal,
    rhythmPlan: fields.rhythmPlan,
    inputCoverageAssertions: fields.inputCoverageAssertions,
    nodeDeletionTests: fields.nodeDeletionTests
  };
  if (sha256Json(core) !== fields.candidateSha256) fail("/candidate/candidateSha256");
  return { core, candidateSha256: fields.candidateSha256 };
}

function compareScore(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

function evaluateCandidate(candidate, context) {
  const proofEvidenceId = evidenceByRole(context.evidenceInventory, "proof").evidenceId;
  const claimItemId = itemByType(context.rawBrief, "claim").itemId;
  const constraintItemId = itemByType(context.rawBrief, "constraint").itemId;
  const actionItemId = itemByType(context.rawBrief, "action").itemId;
  const opening = candidate.slideContracts[0];
  const firstTwo = candidate.slideContracts.slice(0, 2);
  const close = candidate.slideContracts[2];
  const score = [
    opening.evidenceIds.includes(proofEvidenceId) ? 0 : 1,
    opening.requiredItemIds.includes(claimItemId) ? 0 : 1,
    firstTwo.some((slide) => slide.requiredItemIds.includes(constraintItemId)) ? 0 : 1,
    close.requiredItemIds.includes(actionItemId) ? 0 : 1
  ];
  const reasonCodes = [
    score[0] === 0 ? "opens-with-causal-proof" : "delays-causal-proof",
    score[1] === 0 ? "opening-supports-central-claim" : "opening-delays-central-claim",
    score[2] === 0 ? "boundary-precedes-decision" : "boundary-follows-decision",
    score[3] === 0 ? "action-closes-story" : "action-not-in-close"
  ];
  return { candidateId: candidate.candidateId, score, reasonCodes };
}

function makeCandidateSet(context) {
  const candidates = STRATEGIES.map((strategy, index) =>
    makeCandidate(context, strategy, context.templateProfile.allowedMotifIds[index], index));
  const ranking = candidates.map((candidate) => evaluateCandidate(candidate, context))
    .sort((left, right) => compareScore(left.score, right.score) ||
      compareCodeUnits(left.candidateId, right.candidateId));
  const recommendation = {
    candidateId: ranking[0].candidateId,
    reasonCodes: [...ranking[0].reasonCodes],
    ranking
  };
  const core = {
    plannerVersion: DESIGN_PLANNING_VERSION,
    candidateSetType: "deck-hypothesis-candidate-set",
    rawInputSha256: context.rawInputSha256,
    templateProfileId: context.templateProfile.templateProfileId,
    templateMode: context.templateProfile.mode,
    candidates,
    recommendation
  };
  return deepFreeze({ ...core, candidateSetSha256: sha256Json(core) });
}

/**
 * Produce three complete, deterministic hypotheses from raw planning inputs.
 * No candidate, story, or accepted plan can be supplied by the caller.
 */
export function produceDeckHypothesisCandidates(options) {
  return makeCandidateSet(parsePlannerInputs(options));
}

/**
 * Revalidate a detached candidate set against the raw inputs and require byte-
 * semantic equality with the built-in deterministic producer. This function
 * is diagnostic only and never returns an assembly-eligible receipt.
 */
export function verifyDeckHypothesisCandidates(options) {
  const fields = captureInput("/options", () => closedRecord(options, "/options", [
    "candidateSet", "evidenceInventory", "rawBrief", "templateProfile"
  ]));
  const context = parsePlannerInputs({
    rawBrief: fields.rawBrief,
    evidenceInventory: fields.evidenceInventory,
    templateProfile: fields.templateProfile
  });
  const supplied = captureInput(
    "/candidateSet",
    () => parseCandidateSet(fields.candidateSet)
  );
  supplied.candidates.forEach((candidate, index) => {
    const parsed = candidateCore(candidate);
    validateCandidateCore(parsed.core, context, `/candidateSet/candidates/${index}`);
  });
  const expected = makeCandidateSet(context);
  if (canonicalJson(supplied) !== canonicalJson(expected)) fail("/candidateSet");
  return supplied;
}

function parseCandidateSet(value) {
  const captured = captureInput(
    "/candidateSet",
    () => snapshotJson(value, "/candidateSet")
  );
  const fields = closedRecord(captured, "/candidateSet", [
    "candidateSetSha256", "candidateSetType", "candidates", "plannerVersion",
    "rawInputSha256", "recommendation", "templateMode", "templateProfileId"
  ]);
  if (fields.plannerVersion !== DESIGN_PLANNING_VERSION ||
      fields.candidateSetType !== "deck-hypothesis-candidate-set") {
    fail("/candidateSet");
  }
  const templateMode = semanticId(fields.templateMode, "/candidateSet/templateMode");
  if (!TEMPLATE_MODES.has(templateMode)) fail("/candidateSet/templateMode");
  const candidates = arrayValues(fields.candidates, "/candidateSet/candidates", 3, 3)
    .map((candidate, index) => {
      const parsed = candidateCore(candidate);
      if (parsed.core.candidateVersion !== DESIGN_PLANNING_VERSION ||
          parsed.core.candidateType !== "deck-hypothesis-candidate" ||
          parsed.core.rawInputSha256 !== fields.rawInputSha256 ||
          parsed.core.visualLanguageProposal.templateMode !== templateMode ||
          parsed.core.visualLanguageProposal.templateProfileId !== fields.templateProfileId) {
        fail(`/candidateSet/candidates/${index}`);
      }
      return candidate;
    });
  if (new Set(candidates.map((candidate) => candidate.candidateId)).size !== candidates.length ||
      new Set(candidates.map((candidate) => candidate.candidateSha256)).size !== candidates.length) {
    fail("/candidateSet/candidates");
  }
  const recommendation = closedRecord(fields.recommendation, "/candidateSet/recommendation", [
    "candidateId", "ranking", "reasonCodes"
  ]);
  if (!candidates.some((candidate) => candidate.candidateId === recommendation.candidateId)) {
    fail("/candidateSet/recommendation/candidateId");
  }
  stringArray(recommendation.reasonCodes, "/candidateSet/recommendation/reasonCodes", {
    minimum: 1,
    maximum: 8,
    semantic: true
  });
  const ranking = arrayValues(
    recommendation.ranking,
    "/candidateSet/recommendation/ranking",
    candidates.length,
    candidates.length
  ).map((entry, index) => {
    const pointer = `/candidateSet/recommendation/ranking/${index}`;
    const rankingFields = closedRecord(entry, pointer, [
      "candidateId", "reasonCodes", "score"
    ]);
    if (!candidates.some((candidate) => candidate.candidateId === rankingFields.candidateId)) {
      fail(`${pointer}/candidateId`);
    }
    const score = arrayValues(rankingFields.score, `${pointer}/score`, 4, 4)
      .map((value, scoreIndex) => boundedInteger(value, `${pointer}/score/${scoreIndex}`, 0, 1));
    stringArray(rankingFields.reasonCodes, `${pointer}/reasonCodes`, {
      minimum: 4,
      maximum: 4,
      semantic: true
    });
    return { candidateId: rankingFields.candidateId, score };
  });
  if (new Set(ranking.map((entry) => entry.candidateId)).size !== candidates.length ||
      ranking.some((entry, index) => index > 0 &&
        compareScore(ranking[index - 1].score, entry.score) > 0) ||
      recommendation.candidateId !== ranking[0].candidateId) {
    fail("/candidateSet/recommendation/ranking");
  }
  const core = {
    plannerVersion: fields.plannerVersion,
    candidateSetType: fields.candidateSetType,
    rawInputSha256: digest(fields.rawInputSha256, "/candidateSet/rawInputSha256"),
    templateProfileId: semanticId(
      fields.templateProfileId,
      "/candidateSet/templateProfileId"
    ),
    templateMode,
    candidates,
    recommendation: fields.recommendation
  };
  if (sha256Json(core) !== digest(fields.candidateSetSha256, "/candidateSet/candidateSetSha256")) {
    fail("/candidateSet/candidateSetSha256");
  }
  return deepFreeze({ ...core, candidateSetSha256: fields.candidateSetSha256 });
}

function parsePlanningAcceptance(value, candidateSet) {
  const fields = closedRecord(value, "/acceptance", [
    "acceptanceType", "acceptanceVersion", "candidateSetSha256", "decisions",
    "rawInputSha256", "reviewerClass"
  ]);
  if (fields.acceptanceVersion !== DESIGN_PLANNING_VERSION ||
      fields.acceptanceType !== "deck-hypothesis-selection" ||
      fields.rawInputSha256 !== candidateSet.rawInputSha256 ||
      fields.candidateSetSha256 !== candidateSet.candidateSetSha256) {
    fail("/acceptance");
  }
  const candidateById = new Map(candidateSet.candidates.map((candidate) => [
    candidate.candidateId,
    candidate
  ]));
  const decisions = arrayValues(
    fields.decisions,
    "/acceptance/decisions",
    candidateSet.candidates.length,
    candidateSet.candidates.length
  ).map((decision, index) => {
    const pointer = `/acceptance/decisions/${index}`;
    const decisionFields = closedRecord(decision, pointer, [
      "candidateId", "candidateSha256", "reasonCodes", "status"
    ]);
    const candidateId = semanticId(decisionFields.candidateId, `${pointer}/candidateId`);
    const candidate = candidateById.get(candidateId);
    if (candidate === undefined ||
        digest(decisionFields.candidateSha256, `${pointer}/candidateSha256`) !==
          candidate.candidateSha256 ||
        !["accepted", "rejected"].includes(decisionFields.status)) {
      fail(pointer);
    }
    return {
      candidateId,
      candidateSha256: decisionFields.candidateSha256,
      status: decisionFields.status,
      reasonCodes: stringArray(decisionFields.reasonCodes, `${pointer}/reasonCodes`, {
        minimum: 1,
        maximum: 8,
        semantic: true
      })
    };
  }).sort((left, right) => compareCodeUnits(left.candidateId, right.candidateId));
  if (new Set(decisions.map((decision) => decision.candidateId)).size !== candidatesLength(candidateSet) ||
      decisions.filter((decision) => decision.status === "accepted").length !== 1) {
    fail("/acceptance/decisions");
  }
  return deepFreeze({
    acceptanceVersion: fields.acceptanceVersion,
    acceptanceType: fields.acceptanceType,
    rawInputSha256: fields.rawInputSha256,
    candidateSetSha256: fields.candidateSetSha256,
    reviewerClass: semanticId(fields.reviewerClass, "/acceptance/reviewerClass"),
    decisions
  });
}

function candidatesLength(candidateSet) {
  return candidateSet.candidates.length;
}

function recommendationOnly(candidateSet) {
  return deepFreeze({
    selectionStatus: "recommendation-only",
    assemblyStatus: "ineligible",
    rawInputSha256: candidateSet.rawInputSha256,
    candidateSetSha256: candidateSet.candidateSetSha256,
    recommendedCandidateId: candidateSet.recommendation.candidateId,
    reasonCodes: [...candidateSet.recommendation.reasonCodes],
    planningReceipt: null,
    receiptToken: null,
    selectedCandidate: null,
    rejectedCandidates: []
  });
}

function parseApprovedAcceptance(value, acceptanceSha256) {
  const fields = closedRecord(value, "/approvedAcceptance", [
    "acceptanceSha256", "approvalId", "approvalType", "approvalVersion", "authorityClass"
  ]);
  if (fields.approvalVersion !== DESIGN_PLANNING_VERSION ||
      fields.approvalType !== "reviewed-planning-acceptance" ||
      fields.authorityClass !== "repository-reviewed-fixture" ||
      digest(fields.acceptanceSha256, "/approvedAcceptance/acceptanceSha256") !==
        acceptanceSha256) {
    fail("/approvedAcceptance");
  }
  const approval = deepFreeze({
    approvalVersion: fields.approvalVersion,
    approvalType: fields.approvalType,
    approvalId: semanticId(fields.approvalId, "/approvedAcceptance/approvalId"),
    authorityClass: semanticId(fields.authorityClass, "/approvedAcceptance/authorityClass"),
    acceptanceSha256: fields.acceptanceSha256
  });
  if (!REVIEWED_APPROVAL_RECORD_SHA256S.has(sha256Json(approval))) {
    fail("/approvedAcceptance");
  }
  return approval;
}

function mintReceiptToken(candidateSet, planningReceipt) {
  const token = Object.freeze(Object.create(null));
  RECEIPT_TOKENS.set(token, Object.freeze({
    receiptSha256: planningReceipt.receiptSha256,
    rawInputSha256: candidateSet.rawInputSha256,
    candidateSetSha256: candidateSet.candidateSetSha256,
    selectedCandidateId: planningReceipt.selectedCandidateId,
    selectedCandidateSha256: planningReceipt.selectedCandidateSha256,
    templateMode: planningReceipt.templateMode,
    assemblyStatus: planningReceipt.assemblyStatus
  }));
  return token;
}

function externalSelection(candidateSet, acceptance, approvedAcceptance) {
  const selectedDecision = acceptance.decisions.find((decision) => decision.status === "accepted");
  const selectedCandidate = candidateSet.candidates.find((candidate) =>
    candidate.candidateId === selectedDecision.candidateId);
  const rejectedCandidates = acceptance.decisions
    .filter((decision) => decision.status === "rejected")
    .map((decision) => ({
      candidateId: decision.candidateId,
      candidateSha256: decision.candidateSha256,
      reasonCodes: [...decision.reasonCodes]
    }));
  const acceptanceSha256 = sha256Json(acceptance);
  const externallyApproved = approvedAcceptance !== null;
  const assemblyStatus = !externallyApproved || candidateSet.templateMode === "scratch-lab"
    ? "ineligible"
    : "eligible";
  const receiptCore = {
    receiptVersion: DESIGN_PLANNING_VERSION,
    receiptType: "deck-planning-selection-receipt",
    rawInputSha256: candidateSet.rawInputSha256,
    candidateSetSha256: candidateSet.candidateSetSha256,
    templateProfileId: candidateSet.templateProfileId,
    templateMode: candidateSet.templateMode,
    layoutBinding: { ...selectedCandidate.visualLanguageProposal.layoutBinding },
    acceptanceSha256,
    approvalId: approvedAcceptance?.approvalId ?? null,
    approvalSha256: approvedAcceptance === null ? null : sha256Json(approvedAcceptance),
    selectedCandidateId: selectedCandidate.candidateId,
    selectedCandidateSha256: selectedCandidate.candidateSha256,
    rejectedCandidates,
    assemblyStatus
  };
  const planningReceipt = deepFreeze({
    ...receiptCore,
    receiptSha256: sha256Json(receiptCore)
  });
  const receiptToken = assemblyStatus === "eligible"
    ? mintReceiptToken(candidateSet, planningReceipt)
    : null;
  return deepFreeze({
    selectionStatus: externallyApproved ? "externally-approved" : "external-selection-recorded",
    assemblyStatus,
    rawInputSha256: candidateSet.rawInputSha256,
    candidateSetSha256: candidateSet.candidateSetSha256,
    recommendedCandidateId: candidateSet.recommendation.candidateId,
    reasonCodes: [...selectedDecision.reasonCodes],
    planningReceipt,
    receiptToken,
    selectedCandidate,
    rejectedCandidates
  });
}

function selectFromContext(context, planningAcceptance, approvedAcceptance) {
  const candidateSet = parseCandidateSet(makeCandidateSet(context));
  if (planningAcceptance === null) {
    if (approvedAcceptance !== null) fail("/approvedAcceptance");
    return { candidateSet, selection: recommendationOnly(candidateSet) };
  }
  const capturedAcceptance = captureInput(
    "/acceptance",
    () => snapshotJson(planningAcceptance, "/acceptance")
  );
  const acceptance = parsePlanningAcceptance(capturedAcceptance, candidateSet);
  const acceptanceSha256 = sha256Json(acceptance);
  let approval = null;
  if (approvedAcceptance !== null) {
    const capturedApproval = captureInput(
      "/approvedAcceptance",
      () => snapshotJson(approvedAcceptance, "/approvedAcceptance")
    );
    approval = parseApprovedAcceptance(capturedApproval, acceptanceSha256);
  }
  return {
    candidateSet,
    selection: externalSelection(candidateSet, acceptance, approval)
  };
}

function consumeReceiptToken(candidateSet, selection) {
  if (selection.receiptToken === null || selection.planningReceipt === null) {
    fail("/selection/receiptToken");
  }
  const authority = RECEIPT_TOKENS.get(selection.receiptToken);
  if (authority === undefined || authority.assemblyStatus !== "eligible" ||
      authority.receiptSha256 !== selection.planningReceipt.receiptSha256 ||
      authority.rawInputSha256 !== candidateSet.rawInputSha256 ||
      authority.candidateSetSha256 !== candidateSet.candidateSetSha256 ||
      authority.templateMode !== candidateSet.templateMode ||
      selection.planningReceipt.receiptSha256 !== sha256Json((({ receiptSha256, ...core }) => core)(
        selection.planningReceipt
      ))) {
    fail("/selection/receiptToken");
  }
  const selectedCandidate = candidateSet.candidates.find((candidate) =>
    candidate.candidateId === authority.selectedCandidateId &&
    candidate.candidateSha256 === authority.selectedCandidateSha256);
  if (selectedCandidate === undefined) fail("/selection/receiptToken");
  return selectedCandidate;
}

/**
 * A missing acceptance returns a comparative recommendation only. A complete
 * external decision set produces a hash-bound receipt but remains ineligible
 * unless its complete approval record is in the fixed reviewed registry;
 * scratch work remains ineligible for the template-backed assembly path.
 */
export function selectDeckHypothesis(options) {
  const fields = captureInput("/options", () => closedRecord(options, "/options", [
    "approvedAcceptance", "evidenceInventory", "planningAcceptance", "rawBrief",
    "templateProfile"
  ]));
  const context = parsePlannerInputs({
    rawBrief: fields.rawBrief,
    evidenceInventory: fields.evidenceInventory,
    templateProfile: fields.templateProfile
  });
  return selectFromContext(
    context,
    fields.planningAcceptance,
    fields.approvedAcceptance
  ).selection;
}

function candidateToStory(candidate, rawBrief) {
  const slides = candidate.rhythmPlan.beats.map((beat, index) => {
    const slide = candidate.slideContracts[index];
    if (beat.slideId !== slide.slideId || beat.layoutFamily !== slide.function ||
        beat.density !== slide.deliveryDensity ||
        candidate.narrativeGraph.nodes[index].slideId !== slide.slideId) {
      fail(`/projection/slides/${index}`);
    }
    return { narrativeRole: slide.narrativeRole, brief: slide.brief };
  });
  const transitions = candidate.slideContracts.slice(0, -1)
    .map((slide, index) => {
      if (canonicalJson(slide.transition) !==
          canonicalJson(candidate.narrativeGraph.edges[index])) {
        fail(`/projection/transitions/${index}`);
      }
      return { ...slide.transition };
    });
  return deepFreeze({
    storyVersion: "0.1.0",
    deckId: `${rawBrief.briefId}-${candidate.candidateId}`,
    audienceGoal: candidate.communicationContract.desiredOutcome,
    desiredOutcome: candidate.communicationContract.desiredOutcome,
    slides,
    transitions
  });
}

/**
 * Re-plan from raw inputs, authenticate the complete reviewed selection receipt,
 * and only then project the accepted candidate into the existing reviewed
 * layout-selection and ordered-assembly path.
 */
export function selectAndAssemblePlannedDeck(options) {
  const fields = captureInput("/options", () => closedRecord(options, "/options", [
    "approvedPlanningAcceptance", "evidenceInventory", "exemplars", "layoutAcceptance",
    "planningAcceptance", "rawBrief", "templateProfile"
  ]));
  const context = parsePlannerInputs({
    rawBrief: fields.rawBrief,
    evidenceInventory: fields.evidenceInventory,
    templateProfile: fields.templateProfile
  });
  const { candidateSet, selection } = selectFromContext(
    context,
    fields.planningAcceptance,
    fields.approvedPlanningAcceptance
  );
  if (selection.selectionStatus !== "externally-approved" ||
      selection.assemblyStatus !== "eligible" ||
      selection.planningReceipt === null || selection.receiptToken === null) {
    fail("/selection/assemblyStatus");
  }
  const selectedCandidate = consumeReceiptToken(candidateSet, selection);
  const story = candidateToStory(selectedCandidate, context.rawBrief);
  let assembled;
  try {
    assembled = selectAndAssembleOrderedStoryDeck({
      acceptance: fields.layoutAcceptance,
      exemplars: fields.exemplars,
      story
    });
  } catch {
    fail("/deckAssembly");
  }
  if (assembled.acceptanceSha256 !== context.templateProfile.layoutBinding.layoutAcceptanceSha256 ||
      assembled.proposalSetSha256 !== context.templateProfile.layoutBinding.proposalSetSha256) {
    fail("/deckAssembly/templateBinding");
  }
  const assemblyReceiptCore = {
    receiptVersion: DESIGN_PLANNING_VERSION,
    receiptType: "planned-deck-assembly-receipt",
    planningReceiptSha256: selection.planningReceipt.receiptSha256,
    rawInputSha256: candidateSet.rawInputSha256,
    candidateSetSha256: candidateSet.candidateSetSha256,
    selectedCandidateSha256: selectedCandidate.candidateSha256,
    storyProjectionSha256: sha256Json(story),
    layoutAcceptanceSha256: assembled.acceptanceSha256,
    layoutProposalSetSha256: assembled.proposalSetSha256,
    outputSha256: assembled.report.outputSha256
  };
  const assemblyReceipt = deepFreeze({
    ...assemblyReceiptCore,
    assemblyReceiptSha256: sha256Json(assemblyReceiptCore)
  });
  return Object.freeze({
    planningVersion: DESIGN_PLANNING_VERSION,
    rawInputSha256: candidateSet.rawInputSha256,
    candidateSetSha256: candidateSet.candidateSetSha256,
    planningReceipt: selection.planningReceipt,
    assemblyReceipt,
    selectedCandidate,
    rejectedCandidates: selection.rejectedCandidates,
    graph: assembled.graph,
    selectionTraces: assembled.selectionTraces,
    archiveBytes: Buffer.from(assembled.archiveBytes),
    report: assembled.report
  });
}
