import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DESIGN_PLANNING_VERSION,
  DesignPlanningError,
  produceDeckHypothesisCandidates,
  selectAndAssemblePlannedDeck,
  selectDeckHypothesis,
  verifyDeckHypothesisCandidates
} from "../labs/design-planning/deck-planner.mjs";
import { induceCloneFillProfileProposals } from
  "../labs/layout-selection/reviewed-profile-induction.mjs";
import { parseSecureZip } from "../packages/core/src/secure-zip.mjs";
import { parseStrictXml } from "../packages/core/src/strict-xml.mjs";
import {
  buildSyntheticProfileExemplars,
  makeSyntheticProfileAcceptance
} from "./helpers/synthetic-profile-exemplars.mjs";

const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const fixtureUrl = new URL("../fixtures/design-planning/", import.meta.url);

async function loadFixture(name) {
  return JSON.parse(await readFile(new URL(`${name}.json`, fixtureUrl), "utf8"));
}

const rawBrief = await loadFixture("raw-defense-brief");
const evidenceInventory = await loadFixture("evidence-inventory");
const templateProfile = await loadFixture("template-profile");
const planningAcceptance = await loadFixture("planning-acceptance");
const planningApproval = await loadFixture("planning-approval");
const hiddenOutcomeKey = await loadFixture("hidden-outcome-key");

function plannerInputs(overrides = {}) {
  return {
    rawBrief: structuredClone(rawBrief),
    evidenceInventory: structuredClone(evidenceInventory),
    templateProfile: structuredClone(templateProfile),
    ...overrides
  };
}

function candidateSet(overrides = {}) {
  return produceDeckHypothesisCandidates(plannerInputs(overrides));
}

function selectorInputs({
  plannerOverrides = {},
  acceptance = planningAcceptance,
  approval = planningApproval
} = {}) {
  return {
    ...plannerInputs(plannerOverrides),
    planningAcceptance: acceptance === null ? null : structuredClone(acceptance),
    approvedAcceptance: approval === null ? null : structuredClone(approval)
  };
}

function makeAcceptance(set, selectedCandidateId = set.candidates[0].candidateId) {
  return {
    acceptanceVersion: "0.1.0",
    acceptanceType: "deck-hypothesis-selection",
    rawInputSha256: set.rawInputSha256,
    candidateSetSha256: set.candidateSetSha256,
    reviewerClass: "synthetic-test-reviewer",
    decisions: set.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      candidateSha256: candidate.candidateSha256,
      status: candidate.candidateId === selectedCandidateId ? "accepted" : "rejected",
      reasonCodes: [candidate.candidateId === selectedCandidateId
        ? "test-acceptance"
        : "test-alternative-rejected"]
    }))
  };
}

function assembleInputs(overrides = {}) {
  return {
    ...plannerInputs(),
    planningAcceptance: structuredClone(planningAcceptance),
    approvedPlanningAcceptance: structuredClone(planningApproval),
    layoutAcceptance: makeSyntheticProfileAcceptance(),
    exemplars: buildSyntheticProfileExemplars(),
    ...overrides
  };
}

function alternateReviewedLayoutInputs() {
  const exemplars = buildSyntheticProfileExemplars().map((exemplar, index) => {
    const renamed = {
      ...exemplar,
      exemplarId: `alternate-${index + 1}`,
      templateIndex: structuredClone(exemplar.templateIndex)
    };
    renamed.templateIndex.templateIndexId = `${renamed.exemplarId}-template-index`;
    renamed.templateIndex.templateProfileId = `${renamed.exemplarId}-template-profile`;
    return renamed;
  });
  const proposalSet = induceCloneFillProfileProposals({ exemplars });
  const sourceAcceptance = makeSyntheticProfileAcceptance();
  const decisions = sourceAcceptance.decisions.map((decision, index) => {
    const proposal = proposalSet.proposals[index];
    return {
      exemplarId: proposal.exemplarId,
      proposalSha256: proposal.proposalSha256,
      status: decision.status,
      reasonCode: decision.reasonCode,
      profile: decision.profile === null ? null : {
        ...structuredClone(decision.profile),
        layoutId: `${proposal.exemplarId}-layout`,
        slots: decision.profile.slots.map((slot, slotIndex) => ({
          ...structuredClone(slot),
          slotId: `${proposal.exemplarId}-${slotIndex === 0 ? "primary" : "supporting"}`,
          candidateId: `${proposal.exemplarId}-candidate-${slot.sourceShapeKey.slice(-1)}`
        }))
      }
    };
  });
  return {
    exemplars,
    acceptance: {
      acceptanceVersion: sourceAcceptance.acceptanceVersion,
      proposalSetSha256: proposalSet.proposalSetSha256,
      decisions
    }
  };
}

function assertPlanningError(error, pointer) {
  assert.ok(error instanceof DesignPlanningError);
  assert.equal(error.code, "DESIGN_PLANNING_INVALID");
  assert.equal(error.pointer, pointer);
  return true;
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256Json(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function resignCandidateSet(value) {
  for (const candidate of value.candidates) {
    const { candidateSha256, ...candidateCore } = candidate;
    candidate.candidateSha256 = sha256Json(candidateCore);
  }
  const { candidateSetSha256, ...candidateSetCore } = value;
  value.candidateSetSha256 = sha256Json(candidateSetCore);
  return value;
}

function collectNodes(root, namespaceURI, localName) {
  const result = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node.namespaceURI === namespaceURI && node.localName === localName) result.push(node);
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push(node.children[index]);
    }
  }
  return result;
}

function slideText(parts, partPath) {
  return collectNodes(parseStrictXml(parts.get(partPath)).root, NS_A, "t")
    .map((node) => node.text);
}

test("raw brief, evidence, and template data produce three complete frozen hypotheses", () => {
  const result = candidateSet();
  assert.equal(result.plannerVersion, DESIGN_PLANNING_VERSION);
  assert.equal(result.candidateSetType, "deck-hypothesis-candidate-set");
  assert.equal(
    result.rawInputSha256,
    "5f5e93f00196a0afd856e8a6974c7c7c171b2910ae506c2e6389951dcd5ee381"
  );
  assert.equal(
    result.candidateSetSha256,
    "f82f0f66920ddfaa7703964f9cfcf341d980747ec398816d91a937a261987036"
  );
  assert.deepEqual(result.candidates.map((candidate) => candidate.candidateId), [
    "proof-led-decision",
    "constraint-led-decision",
    "readiness-led-decision"
  ]);
  const requiredTargets = new Set([
    ...rawBrief.requiredItems.map((item) => item.itemId),
    ...evidenceInventory.map((entry) => entry.evidenceId)
  ]);
  for (const candidate of result.candidates) {
    assert.equal(candidate.candidateType, "deck-hypothesis-candidate");
    assert.equal(candidate.communicationContract.contractVersion, DESIGN_PLANNING_VERSION);
    assert.equal(candidate.narrativeGraph.nodes.length, 3);
    assert.equal(candidate.narrativeGraph.edges.length, 2);
    assert.deepEqual(candidate.slideContracts.map((slide) => [
      slide.order,
      slide.narrativeRole,
      slide.function,
      slide.brief.units.map((unit) => `${unit.role}:${unit.kind}`)
    ]), [
      [1, "setup", "status", ["takeaway:metric", "evidence:text"]],
      [2, "evidence", "status", ["takeaway:metric", "evidence:text"]],
      [3, "resolution", "decision", ["takeaway:text", "evidence:metric"]]
    ]);
    assert.deepEqual(
      new Set(candidate.inputCoverageAssertions.map((entry) => entry.targetId)),
      requiredTargets
    );
    assert.ok(candidate.inputCoverageAssertions.every((entry) =>
      entry.coveredBySlideIds.length > 0));
    assert.equal(candidate.nodeDeletionTests.length, 3);
    assert.deepEqual(candidate.nodeDeletionTests.map((entry) => entry.outcome), [
      "argument-invalid", "argument-invalid", "argument-invalid"
    ]);
    assert.ok(candidate.nodeDeletionTests.every((entry) =>
      entry.remainingSlideIds.length === 2 && entry.violatedInvariants.length > 0));
    assert.ok(candidate.nodeDeletionTests[0].violatedInvariants.includes(
      "missing-opening-condition"
    ));
    assert.ok(candidate.nodeDeletionTests[1].violatedInvariants.includes(
      "missing-evidence-bridge"
    ));
    assert.ok(candidate.nodeDeletionTests[2].violatedInvariants.includes(
      "missing-bounded-action"
    ));
    assert.equal(candidate.visualLanguageProposal.templateMode, "template-locked");
    assert.equal(candidate.visualLanguageProposal.origin, "template");
    assert.deepEqual(candidate.visualLanguageProposal.flexibleAttributes, []);
    assert.equal(candidate.visualLanguageProposal.subjectBindings.length, 3);
    assert.ok(candidate.visualLanguageProposal.subjectBindings.every((binding, index) =>
      candidate.slideContracts[index].evidenceIds.includes(binding.evidenceId)));
    assert.equal(candidate.visualLanguageProposal.decisionRationales.length, 3);
    assert.deepEqual(candidate.slideContracts.map((slide) => slide.deliveryDensity), [
      "anchor", "normal", "anchor"
    ]);
    assert.ok(candidate.slideContracts.every((slide) =>
      slide.visualReason.length > 0 && slide.confidenceBoundary.boundaryItemIds.length === 1 &&
      slide.nativeEditability.required === true));
    assert.equal(candidate.rhythmPlan.beats.length, 3);
    assert.ok(candidate.rhythmPlan.beats.every((beat) =>
      beat.layoutFamily.length > 0 && beat.dominantCarrier.length > 0 &&
      beat.focalLocation.length > 0 && beat.backgroundState.length > 0));
    assert.match(candidate.candidateSha256, /^[a-f0-9]{64}$/u);
    assert.ok(Object.isFrozen(candidate));
    assert.ok(Object.isFrozen(candidate.slideContracts[0].brief.units));
  }
  assert.equal(result.recommendation.candidateId, "proof-led-decision");
  assert.deepEqual(result.recommendation.ranking.map((entry) => entry.candidateId), [
    "proof-led-decision",
    "readiness-led-decision",
    "constraint-led-decision"
  ]);
  assert.ok(Object.isFrozen(result));
});

test("canonical planning is stable across unordered inventories but changes with raw evidence", () => {
  const first = candidateSet();
  const reorderedBrief = structuredClone(rawBrief);
  reorderedBrief.requiredItems.reverse();
  const reorderedTemplate = structuredClone(templateProfile);
  reorderedTemplate.capacityContracts.reverse();
  const reordered = candidateSet({
    rawBrief: reorderedBrief,
    evidenceInventory: structuredClone(evidenceInventory).reverse(),
    templateProfile: reorderedTemplate
  });
  assert.deepEqual(reordered, first);

  const changedEvidence = structuredClone(evidenceInventory);
  changedEvidence.find((entry) => entry.planningRole === "proof").value = "4/4";
  const changed = candidateSet({ evidenceInventory: changedEvidence });
  assert.notEqual(changed.rawInputSha256, first.rawInputSha256);
  assert.notEqual(changed.candidateSetSha256, first.candidateSetSha256);
  assert.equal(
    changed.candidates[0].slideContracts[0].brief.units[0].content.value,
    "4/4"
  );
});

test("re-signed coverage and node-deletion assertions must match the actual argument", () => {
  const baseline = candidateSet();
  const verified = verifyDeckHypothesisCandidates({
    ...plannerInputs(),
    candidateSet: baseline
  });
  assert.equal(canonicalJson(verified), canonicalJson(baseline));

  const wrongCoverage = structuredClone(baseline);
  wrongCoverage.candidates[0].inputCoverageAssertions[0].coveredBySlideIds = [
    wrongCoverage.candidates[0].slideContracts[0].slideId
  ];
  resignCandidateSet(wrongCoverage);
  assert.throws(
    () => verifyDeckHypothesisCandidates({
      ...plannerInputs(),
      candidateSet: wrongCoverage
    }),
    (error) => assertPlanningError(
      error,
      "/candidateSet/candidates/0/inputCoverageAssertions/0"
    )
  );

  const wrongType = structuredClone(baseline);
  wrongType.candidates[0].inputCoverageAssertions[0].targetType = "evidence";
  wrongType.candidates[0].inputCoverageAssertions[0].removalEffect = "wrong-effect";
  resignCandidateSet(wrongType);
  assert.throws(
    () => verifyDeckHypothesisCandidates({
      ...plannerInputs(),
      candidateSet: wrongType
    }),
    (error) => assertPlanningError(
      error,
      "/candidateSet/candidates/0/inputCoverageAssertions/0"
    )
  );

  const extraField = structuredClone(baseline);
  extraField.candidates[0].inputCoverageAssertions[0].unknown = true;
  resignCandidateSet(extraField);
  assert.throws(
    () => verifyDeckHypothesisCandidates({
      ...plannerInputs(),
      candidateSet: extraField
    }),
    (error) => assertPlanningError(
      error,
      "/candidateSet/candidates/0/inputCoverageAssertions/0"
    )
  );

  const falseNodeDeletion = structuredClone(baseline);
  falseNodeDeletion.candidates[0].nodeDeletionTests[0].violatedInvariants = [
    "missing-evidence-bridge"
  ];
  resignCandidateSet(falseNodeDeletion);
  assert.throws(
    () => verifyDeckHypothesisCandidates({
      ...plannerInputs(),
      candidateSet: falseNodeDeletion
    }),
    (error) => assertPlanningError(
      error,
      "/candidateSet/candidates/0/nodeDeletionTests/0"
    )
  );
});

test("the built-in comparison cannot authorize itself", () => {
  const set = candidateSet();
  const selection = selectDeckHypothesis({
    ...plannerInputs(),
    planningAcceptance: null,
    approvedAcceptance: null
  });
  assert.deepEqual(selection, {
    selectionStatus: "recommendation-only",
    assemblyStatus: "ineligible",
    rawInputSha256: set.rawInputSha256,
    candidateSetSha256: set.candidateSetSha256,
    recommendedCandidateId: "proof-led-decision",
    reasonCodes: [
      "opens-with-causal-proof",
      "opening-supports-central-claim",
      "boundary-precedes-decision",
      "action-closes-story"
    ],
    planningReceipt: null,
    receiptToken: null,
    selectedCandidate: null,
    rejectedCandidates: []
  });
  assert.ok(Object.isFrozen(selection));
});

test("an acceptance assertion without a separately approved digest stays ineligible", () => {
  const recorded = selectDeckHypothesis(selectorInputs({ approval: null }));
  assert.equal(recorded.selectionStatus, "external-selection-recorded");
  assert.equal(recorded.assemblyStatus, "ineligible");
  assert.equal(recorded.receiptToken, null);
  assert.equal(recorded.planningReceipt.approvalSha256, null);

  let exemplarReads = 0;
  const exemplars = new Proxy([], {
    ownKeys() {
      exemplarReads += 1;
      return ["length"];
    }
  });
  assert.throws(
    () => selectAndAssemblePlannedDeck(assembleInputs({
      approvedPlanningAcceptance: null,
      exemplars
    })),
    (error) => assertPlanningError(error, "/selection/assemblyStatus")
  );
  assert.equal(exemplarReads, 0);

  const staleApproval = structuredClone(planningApproval);
  staleApproval.acceptanceSha256 = "0".repeat(64);
  assert.throws(
    () => selectDeckHypothesis(selectorInputs({ approval: staleApproval })),
    (error) => assertPlanningError(error, "/approvedAcceptance")
  );

  const forgedApproval = {
    ...structuredClone(planningApproval),
    approvalId: "planner-self-approval",
    acceptanceSha256: recorded.planningReceipt.acceptanceSha256
  };
  assert.throws(
    () => selectDeckHypothesis(selectorInputs({ approval: forgedApproval })),
    (error) => assertPlanningError(error, "/approvedAcceptance")
  );
});

test("the reviewed fixture binds one selected candidate and every rejected alternative", () => {
  const set = candidateSet();
  const selection = selectDeckHypothesis({
    ...plannerInputs(),
    planningAcceptance: structuredClone(planningAcceptance),
    approvedAcceptance: structuredClone(planningApproval)
  });
  assert.equal(selection.selectionStatus, "externally-approved");
  assert.equal(selection.assemblyStatus, "eligible");
  assert.equal(selection.selectedCandidate.candidateId, "proof-led-decision");
  assert.deepEqual(selection.rejectedCandidates.map((candidate) => candidate.candidateId), [
    "constraint-led-decision",
    "readiness-led-decision"
  ]);
  assert.equal(selection.planningReceipt.rawInputSha256, set.rawInputSha256);
  assert.equal(selection.planningReceipt.candidateSetSha256, set.candidateSetSha256);
  assert.equal(
    selection.planningReceipt.selectedCandidateSha256,
    set.candidates[0].candidateSha256
  );
  assert.equal(
    selection.planningReceipt.receiptSha256,
    "8352d12164d61d140ece0e3fb595ffd4dc5ca1837a79bcfa0690d2361bcb4a13"
  );
  assert.equal(
    selection.planningReceipt.layoutBinding.proposalSetSha256,
    templateProfile.layoutBinding.proposalSetSha256
  );
  assert.equal(Object.keys(selection.receiptToken).length, 0);
  assert.ok(Object.isFrozen(selection.planningReceipt));
  assert.ok(Object.isFrozen(selection.rejectedCandidates[0]));
});

test("the accepted raw-input plan reaches reviewed layouts and one exact ordered PPTX", () => {
  const result = selectAndAssemblePlannedDeck(assembleInputs());
  assert.equal(result.planningVersion, DESIGN_PLANNING_VERSION);
  assert.equal(result.selectedCandidate.candidateId, "proof-led-decision");
  assert.equal(result.report.artifactType, "ordered-assembled-pptx");
  assert.equal(
    result.report.outputSha256,
    "67860e10c373cb07822af571f4b3c7ee23d35e4bb612506bfeca20b303c953d7"
  );
  assert.equal(result.assemblyReceipt.outputSha256, result.report.outputSha256);
  assert.equal(
    result.assemblyReceipt.planningReceiptSha256,
    result.planningReceipt.receiptSha256
  );
  assert.equal(
    result.assemblyReceipt.layoutProposalSetSha256,
    templateProfile.layoutBinding.proposalSetSha256
  );
  assert.equal(
    result.assemblyReceipt.assemblyReceiptSha256,
    "a6462f8e7f9e5f05989864f634bb6efd67aeb5226bb79f2d8a178f8fbfd946e4"
  );
  assert.deepEqual(result.graph.nodes.map((node) => [
    node.order,
    node.narrativeRole,
    node.function,
    node.selectedExemplarId,
    node.partPath
  ]), [
    [1, "setup", "status", "status-focus", "ppt/slides/slide1.xml"],
    [2, "evidence", "status", "status-focus", "ppt/slides/slide2.xml"],
    [3, "resolution", "decision", "decision-focus", "ppt/slides/slide3.xml"]
  ]);
  const parts = parseSecureZip(result.archiveBytes);
  assert.deepEqual(slideText(parts, "ppt/slides/slide1.xml"), [
    "Three independent reviews agree on scope, hierarchy, and readability",
    "3/3 — Independent reviews agree"
  ]);
  assert.deepEqual(slideText(parts, "ppt/slides/slide2.xml"), [
    "Edit/save and accessibility checks remain before wider rollout",
    "87% — Controls ready"
  ]);
  assert.deepEqual(slideText(parts, "ppt/slides/slide3.xml"), [
    "Approve a limited pilot with two completion checks",
    "3/3 — Independent reviews agree"
  ]);
  assert.equal(result.report.diff.collateralChanges.length, 0);
  assert.ok(result.selectionTraces.every((trace) =>
    trace.singleSlideDiff.collateralChanges.length === 0));
});

test("the hidden outcome key is bound to raw input but is absent from planner authority", async () => {
  const set = candidateSet();
  assert.equal(hiddenOutcomeKey.keyVersion, DESIGN_PLANNING_VERSION);
  assert.equal(hiddenOutcomeKey.keyType, "blind-outcome-key");
  assert.equal(hiddenOutcomeKey.rawInputSha256, set.rawInputSha256);
  assert.equal(hiddenOutcomeKey.approval.approvalStatus, "approved");
  assert.equal(hiddenOutcomeKey.approval.reviewerClass, "independent-synthetic-fixture-review");
  assert.deepEqual(
    new Set(hiddenOutcomeKey.expectedOutcome.requiredEvidenceIds),
    new Set(evidenceInventory.map((entry) => entry.evidenceId))
  );
  assert.ok(rawBrief.requiredItems.some((item) =>
    item.itemId === hiddenOutcomeKey.expectedOutcome.takeawayItemId && item.itemType === "claim"));
  assert.ok(rawBrief.requiredItems.some((item) =>
    item.itemId === hiddenOutcomeKey.expectedOutcome.requestedActionItemId &&
    item.itemType === "action"));
  assert.ok(rawBrief.requiredItems.some((item) =>
    item.itemId === hiddenOutcomeKey.expectedOutcome.boundaryItemId &&
    item.itemType === "constraint"));
  const source = await readFile(
    new URL("../labs/design-planning/deck-planner.mjs", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /hidden-outcome-key\.json|bounded-readiness-claim/u);
  assert.deepEqual(
    [...source.matchAll(/from\s+"([^"]+)"/gu)].map((match) => match[1]),
    ["node:crypto", "../layout-selection/ordered-story-deck.mjs"]
  );
});

test("stale, incomplete, and swapped external decisions fail before deck assembly", () => {
  const stale = structuredClone(planningAcceptance);
  stale.rawInputSha256 = "0".repeat(64);
  assert.throws(
    () => selectDeckHypothesis(selectorInputs({ acceptance: stale })),
    (error) => assertPlanningError(error, "/acceptance")
  );

  const incomplete = structuredClone(planningAcceptance);
  incomplete.decisions.pop();
  assert.throws(
    () => selectDeckHypothesis(selectorInputs({ acceptance: incomplete })),
    (error) => assertPlanningError(error, "/acceptance/decisions/length")
  );

  const twoAccepted = structuredClone(planningAcceptance);
  twoAccepted.decisions[1].status = "accepted";
  assert.throws(
    () => selectDeckHypothesis(selectorInputs({ acceptance: twoAccepted })),
    (error) => assertPlanningError(error, "/acceptance/decisions")
  );

  const swappedHash = structuredClone(planningAcceptance);
  swappedHash.decisions[0].candidateSha256 = swappedHash.decisions[1].candidateSha256;
  assert.throws(
    () => selectDeckHypothesis(selectorInputs({ acceptance: swappedHash })),
    (error) => assertPlanningError(error, "/acceptance/decisions/0")
  );
});

test("candidate and raw-input tampering cannot reuse an old acceptance", () => {
  const changedEvidence = structuredClone(evidenceInventory);
  changedEvidence[0].value = "4/4";
  const changedSet = candidateSet({ evidenceInventory: changedEvidence });
  const selfSignedAcceptance = makeAcceptance(changedSet);
  assert.throws(
    () => selectDeckHypothesis(selectorInputs({ acceptance: selfSignedAcceptance })),
    (error) => assertPlanningError(error, "/acceptance")
  );

  let exemplarReads = 0;
  const exemplars = new Proxy([], {
    ownKeys() {
      exemplarReads += 1;
      return ["length"];
    }
  });
  assert.throws(
    () => selectAndAssemblePlannedDeck(assembleInputs({
      evidenceInventory: changedEvidence,
      exemplars
    })),
    (error) => assertPlanningError(error, "/acceptance")
  );
  assert.equal(exemplarReads, 0);
});

test("template precedence distinguishes locked, flexible, and scratch modes", () => {
  const locked = candidateSet();
  assert.ok(locked.candidates.every((candidate) =>
    candidate.visualLanguageProposal.origin === "template" &&
    candidate.visualLanguageProposal.flexibleAttributes.length === 0));

  const flexibleProfile = structuredClone(templateProfile);
  flexibleProfile.mode = "template-flexible";
  flexibleProfile.fixedAttributes = ["palette", "typography"];
  flexibleProfile.flexibleAttributes = ["density", "emphasis", "geometry", "hierarchy"];
  const flexible = candidateSet({ templateProfile: flexibleProfile });
  assert.ok(flexible.candidates.every((candidate) =>
    candidate.visualLanguageProposal.origin === "template-plus-subject" &&
    candidate.visualLanguageProposal.fixedAttributes.includes("palette") &&
    !candidate.visualLanguageProposal.flexibleAttributes.includes("palette")));
  const flexibleAcceptance = makeAcceptance(flexible);
  const flexibleSelection = selectDeckHypothesis(selectorInputs({
    plannerOverrides: { templateProfile: flexibleProfile },
    acceptance: flexibleAcceptance,
    approval: null
  }));
  assert.equal(flexibleSelection.selectionStatus, "external-selection-recorded");
  assert.equal(flexibleSelection.assemblyStatus, "ineligible");

  const scratchProfile = structuredClone(templateProfile);
  scratchProfile.mode = "scratch-lab";
  scratchProfile.fixedAttributes = [];
  scratchProfile.flexibleAttributes = [
    "density", "emphasis", "geometry", "hierarchy", "palette", "typography"
  ];
  const scratch = candidateSet({ templateProfile: scratchProfile });
  const scratchAcceptance = makeAcceptance(scratch);
  const scratchSelection = selectDeckHypothesis(selectorInputs({
    plannerOverrides: { templateProfile: scratchProfile },
    acceptance: scratchAcceptance,
    approval: null
  }));
  assert.equal(scratchSelection.selectionStatus, "external-selection-recorded");
  assert.equal(scratchSelection.assemblyStatus, "ineligible");
  let exemplarReads = 0;
  const exemplars = new Proxy([], {
    ownKeys() {
      exemplarReads += 1;
      return ["length"];
    }
  });
  assert.throws(
    () => selectAndAssemblePlannedDeck({
      ...plannerInputs({ templateProfile: scratchProfile }),
      planningAcceptance: scratchAcceptance,
      approvedPlanningAcceptance: null,
      layoutAcceptance: makeSyntheticProfileAcceptance(),
      exemplars
    }),
    (error) => assertPlanningError(error, "/selection/assemblyStatus")
  );
  assert.equal(exemplarReads, 0);
});

test("the reviewed plan rejects a different actual layout proposal set", () => {
  const alternate = alternateReviewedLayoutInputs();
  assert.throws(
    () => selectAndAssemblePlannedDeck({
      ...assembleInputs(),
      layoutAcceptance: alternate.acceptance,
      exemplars: alternate.exemplars
    }),
    (error) => assertPlanningError(error, "/deckAssembly/templateBinding")
  );
});

test("locked overrides, missing evidence binding, and capacity overflow fail closed", () => {
  const invalidLocked = structuredClone(templateProfile);
  invalidLocked.fixedAttributes = invalidLocked.fixedAttributes
    .filter((attribute) => attribute !== "density");
  invalidLocked.flexibleAttributes = ["density"];
  assert.throws(
    () => candidateSet({ templateProfile: invalidLocked }),
    (error) => assertPlanningError(error, "/templateProfile/mode")
  );

  const invalidEvidence = structuredClone(evidenceInventory);
  invalidEvidence[0].supportsRequiredItemIds = ["unknown-required-item"];
  assert.throws(
    () => candidateSet({ evidenceInventory: invalidEvidence }),
    (error) => assertPlanningError(
      error,
      "/evidenceInventory/0/supportsRequiredItemIds"
    )
  );

  const tinyCapacity = structuredClone(templateProfile);
  tinyCapacity.capacityContracts.find((entry) => entry.function === "status")
    .evidenceMaxChars = 10;
  let exemplarReads = 0;
  const exemplars = new Proxy([], {
    ownKeys() {
      exemplarReads += 1;
      return ["length"];
    }
  });
  assert.throws(
    () => selectAndAssemblePlannedDeck(assembleInputs({
      templateProfile: tinyCapacity,
      exemplars
    })),
    (error) => assertPlanningError(
      error,
      "/candidates/0/slideContracts/0/brief/units"
    )
  );
  assert.equal(exemplarReads, 0);
});

test("accessors, revoked objects, and pre-authored plan injection stay outside the boundary", () => {
  let audienceReads = 0;
  const accessorBrief = structuredClone(rawBrief);
  Object.defineProperty(accessorBrief, "audience", {
    enumerable: true,
    get() {
      audienceReads += 1;
      return rawBrief.audience;
    }
  });
  assert.throws(
    () => candidateSet({ rawBrief: accessorBrief }),
    (error) => assertPlanningError(error, "/rawBrief/audience")
  );
  assert.equal(audienceReads, 0);

  const revoked = Proxy.revocable(structuredClone(templateProfile), {});
  revoked.revoke();
  assert.throws(
    () => candidateSet({ templateProfile: revoked.proxy }),
    (error) => assertPlanningError(error, "/templateProfile")
  );

  assert.throws(
    () => produceDeckHypothesisCandidates({
      ...plannerInputs(),
      candidateSet: candidateSet()
    }),
    (error) => assertPlanningError(error, "/options")
  );
  assert.throws(
    () => selectAndAssemblePlannedDeck({
      ...assembleInputs(),
      story: { storyVersion: "0.1.0" }
    }),
    (error) => assertPlanningError(error, "/options")
  );
});

test("the lab cannot promote support or reverse the core dependency direction", async () => {
  const support = JSON.parse(await readFile(
    new URL("../policy/support-matrix.json", import.meta.url),
    "utf8"
  ));
  assert.equal(support.supportClaimsEnabled, false);
  const coreFiles = [
    "create-only-assembly.mjs",
    "ordered-slide-assembly.mjs",
    "secure-zip.mjs"
  ];
  for (const file of coreFiles) {
    const source = await readFile(new URL(`../packages/core/src/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /labs\//u);
  }
});
