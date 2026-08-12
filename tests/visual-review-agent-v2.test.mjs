import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertSupportedSchema,
  validateJson
} from "../scripts/lib/json-schema.mjs";

import {
  VISUAL_REVIEW_EVIDENCE_SCOPE,
  VISUAL_REVIEW_V2_CONTRACT_VERSION,
  VisualReviewV2Error,
  classifyVisualRepair,
  createDeliveryReviewProfile,
  createVisualReviewSession,
  finalizeWholeDeckReviewRuns,
  finalizeVisualReviewV2,
  freezeBlindOutcomeRuns,
  freezeWholeDeckReviewRuns,
  prepareInstanceReviewReveal
} from "../labs/visual-review-agent/review-v2-contract.mjs";

const REVIEW_CONTEXT_SHA256 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RENDER_SET_SHA256 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const CONTACT_SHEET_SHA256 = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const BLOCKER_CROP_SHA256 = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const UNKNOWN_SHA256 = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
const fixtureUrl = new URL("../fixtures/design-planning/", import.meta.url);
const coreSourceUrl = new URL("../packages/core/src/", import.meta.url);

const readJson = async (url) => JSON.parse(await readFile(url, "utf8"));
const atomicOutcomeManifest = await readJson(new URL("atomic-outcome-manifest.json", fixtureUrl));
const hiddenOutcomeKey = await readJson(new URL("hidden-outcome-key.json", fixtureUrl));
const reviewedEvidenceManifest = await readJson(new URL(
  "reviewed-visual-evidence-manifest.json",
  fixtureUrl
));
const reviewV2Schema = await readJson(new URL(
  "../labs/visual-review-agent/review-v2.schema.json",
  import.meta.url
));
const calibrationV2 = await readJson(new URL(
  "../labs/visual-review-agent/calibration-v2-examples.json",
  import.meta.url
));
const promptV2 = await readFile(new URL(
  "../labs/visual-review-agent/PROMPT_V2.md",
  import.meta.url
), "utf8");

const SLIDES = Object.freeze([
  Object.freeze({ slideId: "slide-a", plannedDensity: "anchor", messageSlide: true }),
  Object.freeze({ slideId: "slide-b", plannedDensity: "normal", messageSlide: false }),
  Object.freeze({ slideId: "slide-c", plannedDensity: "anchor", messageSlide: true })
]);

const WHOLE_DECK_DIMENSIONS = Object.freeze([
  "subject-conditionality",
  "decorative-semantic-fit",
  "signature-coherence",
  "motif-coherence",
  "silhouette-rhythm",
  "density-rhythm",
  "opening-payoff",
  "closing-payoff",
  "delivery-fitness"
]);

const UNASSESSED_PROPERTIES = Object.freeze([
  "accessibility-metadata",
  "animation",
  "font-embedding",
  "native-editability",
  "ooxml-correctness",
  "speaker-notes"
]);

const deliveryProfile = createDeliveryReviewProfile({
  deliveryMode: "live-room",
  slides: structuredClone(SLIDES)
});

function observation(slideId, evidence, region = [0.08, 0.08, 0.84, 0.2]) {
  return { slideId, region, evidenceSource: "full-slide", evidence };
}

function identifiedOutcome(text, slideId, evidence, region) {
  return {
    status: "identified",
    text,
    observations: [observation(slideId, evidence, region)]
  };
}

function makeBlindRuns() {
  return [1, 2, 3].map((reviewRun) => ({
    schemaVersion: VISUAL_REVIEW_V2_CONTRACT_VERSION,
    contractType: "blind-outcome-report",
    lane: "blind-outcome",
    disclosurePhase: "blind",
    evidenceScope: VISUAL_REVIEW_EVIDENCE_SCOPE,
    reviewId: "blind-pilot-review",
    reviewRun,
    reviewContextSha256: REVIEW_CONTEXT_SHA256,
    renderSetSha256: RENDER_SET_SHA256,
    deliveryProfileSha256: deliveryProfile.profileSha256,
    inputQuality: { status: "ok", notes: [] },
    orderedSlides: SLIDES.map((slide, index) => ({
      slideId: slide.slideId,
      slideNumber: index + 1,
      assessmentStatus: "assessable",
      visibleSummary: [
        "Independent checks establish bounded readiness.",
        "The middle slide shows remaining controls and completion checks.",
        "The close requests a limited pilot while preserving the rollout boundary."
      ][index]
    })),
    reconstruction: {
      takeaway: identifiedOutcome(
        "The defense pilot is ready for bounded approval.",
        "slide-a",
        "The opening combines aligned independent reviews with a bounded readiness claim.",
        [0.08, 0.08, 0.84, 0.24]
      ),
      requestedAction: identifiedOutcome(
        "Approve a limited pilot with two completion checks.",
        "slide-c",
        "The closing action is explicit and limited to the pilot.",
        [0.08, 0.12, 0.84, 0.22]
      ),
      uncertaintyBoundary: identifiedOutcome(
        "Wider rollout still requires edit/save and accessibility checks.",
        "slide-c",
        "The close names the two checks that still gate wider rollout.",
        [0.08, 0.52, 0.84, 0.22]
      ),
      argumentEvidenceChain: [
        "Three independent reviews agree on the visible readiness evidence.",
        "Most controls are ready while two completion checks remain.",
        "That evidence supports a limited pilot, not wider rollout."
      ],
      argumentEvidenceObservations: [observation(
        "slide-b",
        "The middle slide visibly supplies the control-readiness evidence and remaining checks.",
        [0.08, 0.18, 0.84, 0.64]
      )]
    },
    unassessedProperties: [...UNASSESSED_PROPERTIES]
  }));
}

function makeUnusableBlindRuns() {
  return makeBlindRuns().map((report) => ({
    ...report,
    inputQuality: {
      status: "unusable",
      notes: ["The supplied images do not contain enough visible information for outcome reconstruction."]
    },
    orderedSlides: report.orderedSlides.map((slide) => ({
      ...slide,
      assessmentStatus: "unable-to-judge"
    })),
    reconstruction: {
      takeaway: { status: "not-visible", text: null, observations: [] },
      requestedAction: { status: "not-visible", text: null, observations: [] },
      uncertaintyBoundary: { status: "not-visible", text: null, observations: [] },
      argumentEvidenceChain: [],
      argumentEvidenceObservations: []
    }
  }));
}

function createReviewSession(manifest = reviewedEvidenceManifest) {
  return createVisualReviewSession({
    deliveryProfile,
    reviewedEvidenceManifest: structuredClone(manifest)
  });
}

function freezeBlind(reports = makeBlindRuns(), manifest = reviewedEvidenceManifest) {
  const prepared = createReviewSession(manifest);
  const frozen = freezeBlindOutcomeRuns(reports, {
    reviewSession: prepared.reviewSession,
    reviewSessionToken: prepared.reviewSessionToken
  });
  return { ...prepared, ...frozen };
}

function freezeReviewSession({
  blindReports = makeBlindRuns(),
  wholeReports = makeWholeDeckRuns(),
  manifest = reviewedEvidenceManifest
} = {}) {
  const prepared = createReviewSession(manifest);
  const blind = freezeBlindOutcomeRuns(blindReports, {
    reviewSession: prepared.reviewSession,
    reviewSessionToken: prepared.reviewSessionToken
  });
  const whole = freezeWholeDeckReviewRuns(wholeReports, {
    reviewSession: prepared.reviewSession,
    wholeDeckEvidenceToken: prepared.wholeDeckEvidenceToken
  });
  return { ...prepared, ...blind, ...whole };
}

function makeRequiredItemSources() {
  return structuredClone(reviewedEvidenceManifest.requiredItemSources);
}

function revealInstance({
  blindReports = makeBlindRuns(),
  wholeReports = makeWholeDeckRuns(),
  manifest = reviewedEvidenceManifest,
  revealOverrides = {},
  blockerFollowUps = []
} = {}) {
  const frozen = freezeReviewSession({ blindReports, wholeReports, manifest });
  const revealed = prepareInstanceReviewReveal({
    atomicOutcomeManifest: structuredClone(atomicOutcomeManifest),
    blindBatch: frozen.blindBatch,
    blindToken: frozen.blindToken,
    hiddenOutcomeKey: structuredClone(hiddenOutcomeKey),
    ...revealOverrides
  });
  const whole = finalizeWholeDeckReviewRuns({
    wholeDeckBatch: frozen.wholeDeckBatch,
    wholeDeckReviewToken: frozen.wholeDeckReviewToken,
    blockerFollowUps
  });
  return { ...frozen, ...revealed, ...whole };
}

function makeInstanceReports(instanceContext, concern = null) {
  return [1, 2, 3].map((reviewRun) => ({
    schemaVersion: VISUAL_REVIEW_V2_CONTRACT_VERSION,
    contractType: "instance-review-report",
    lane: "instance",
    disclosurePhase: "revealed",
    evidenceScope: VISUAL_REVIEW_EVIDENCE_SCOPE,
    reviewId: instanceContext.reviewId,
    reviewRun,
    reviewContextSha256: REVIEW_CONTEXT_SHA256,
    deliveryProfileSha256: deliveryProfile.profileSha256,
    instanceContextSha256: instanceContext.instanceContextSha256,
    blindBatchSha256: instanceContext.blindBatchSha256,
    hiddenOutcomeKeySha256: instanceContext.hiddenOutcomeKeySha256,
    atomicOutcomeManifestSha256: instanceContext.atomicOutcomeManifestSha256,
    itemAssessments: atomicOutcomeManifest.items.map((item) => {
      const slot = item.itemKind === "takeaway"
        ? "takeaway"
        : item.itemKind === "requested-action"
          ? "requested-action"
          : item.itemKind === "uncertainty-boundary"
            ? "uncertainty-boundary"
            : "argument-evidence-chain";
      const isConcern = concern !== null && concern.reviewRun === reviewRun &&
        concern.itemId === item.itemId;
      return {
        itemId: item.itemId,
        itemKind: item.itemKind,
        status: isConcern ? concern.status : "matched",
        blindEvidenceRefs: [`run-${reviewRun}:${slot}`],
        visibleEvidence: [isConcern
          ? "The visible wording does not completely preserve this required item."
          : `The rendered deck visibly preserves ${item.expectedMeaning}`],
        diagnosis: isConcern
          ? "The required meaning is only partially visible in the rendered deck."
          : "The blind reconstruction and visible evidence match the approved atomic item.",
        recommendation: isConcern
          ? "Inspect the fixed crop and source render before deciding whether the item failed."
          : "Retain this required meaning in the next rendered candidate.",
        confidence: isConcern ? 0.82 : 0.96
      };
    }),
    unassessedProperties: [...UNASSESSED_PROPERTIES]
  }));
}

function makeUnmatchedInstanceReports(instanceContext, status = "uncertain") {
  return makeInstanceReports(instanceContext).map((report) => ({
    ...report,
    itemAssessments: report.itemAssessments.map((assessment) => ({
      ...assessment,
      status,
      blindEvidenceRefs: [],
      visibleEvidence: ["The blind input did not expose enough visible evidence to match this item."],
      diagnosis: "The frozen blind reconstruction cannot establish the required meaning.",
      recommendation: "Obtain an assessable render before making an instance-level claim.",
      confidence: 0.51
    }))
  }));
}

function makeReconciliation(instanceContext, itemId, resolution, overrides = {}) {
  const source = makeRequiredItemSources().find((entry) => entry.itemId === itemId);
  return {
    reconciliationId: "required-item-1",
    itemId,
    instanceContextSha256: instanceContext.instanceContextSha256,
    blindBatchSha256: instanceContext.blindBatchSha256,
    followUpReviewId: `${itemId}-crop-review`,
    sourceRenderSha256: source.sourceRenderSha256,
    cropSha256: source.cropSha256,
    evidenceSource: "crop",
    resolution,
    evidence: resolution === "confirmed-failure"
      ? "The fixed crop confirms that part of the required meaning is absent."
      : resolution === "dismissed-failure"
        ? "The fixed crop contains the complete required meaning and dismisses the concern."
        : "The fixed crop remains ambiguous and cannot resolve the required-item concern.",
    confidence: resolution === "unable-to-resolve" ? 0.55 : 0.98,
    ...overrides
  };
}

function makeWholeFinding(overrides = {}) {
  return {
    dimension: "density-rhythm",
    affectedSlideIds: ["slide-b"],
    region: [0.1, 0.08, 0.8, 0.82],
    rootCause: "flat-density-rhythm",
    severity: "major",
    evidence: "The contact sheet repeats the same information weight across adjacent beats.",
    impact: "The evidence peak is not perceptually distinct from setup and resolution.",
    recommendation: "Replan the middle beat so its evidence density creates a deliberate peak.",
    confidence: 0.93,
    ...overrides
  };
}

function makeWholeDeckRuns({ ordinaryRuns = [], blockerRuns = [] } = {}) {
  return [1, 2, 3].map((reviewRun) => {
    const finding = blockerRuns.includes(reviewRun)
      ? makeWholeFinding({
          dimension: "delivery-fitness",
          rootCause: "delivery-density-mismatch",
          severity: "blocker",
          affectedSlideIds: ["slide-c"],
          region: [0.08, 0.12, 0.84, 0.76],
          evidence: "The decision text is not fully visible at room-reading scale.",
          impact: "The requested action cannot be recovered in the live-room delivery window.",
          recommendation: "Use the fixed crop to confirm visibility before replanning the close."
        })
      : ordinaryRuns.includes(reviewRun)
        ? makeWholeFinding()
        : null;
    return {
      schemaVersion: VISUAL_REVIEW_V2_CONTRACT_VERSION,
      contractType: "whole-deck-review-report",
      lane: "whole-deck",
      disclosurePhase: "label-blind",
      evidenceScope: VISUAL_REVIEW_EVIDENCE_SCOPE,
      labelBlind: true,
      reviewId: "blind-pilot-review",
      reviewRun,
      reviewContextSha256: REVIEW_CONTEXT_SHA256,
      deliveryProfileSha256: deliveryProfile.profileSha256,
      contactSheetSha256: CONTACT_SHEET_SHA256,
      inputQuality: { status: "ok", notes: [] },
      orderedSlides: SLIDES.map((slide, index) => ({
        slideId: slide.slideId,
        slideNumber: index + 1
      })),
      contactSheetSummary: "The three-page sequence shows setup, an evidence peak, and a bounded close.",
      dimensionAssessments: WHOLE_DECK_DIMENSIONS.map((dimension) => ({
        dimension,
        status: finding?.dimension === dimension ? "concern" : "fit",
        evidence: finding?.dimension === dimension
          ? finding.evidence
          : `The contact sheet provides assessable evidence for ${dimension}.`,
        confidence: finding?.dimension === dimension ? finding.confidence : 0.9
      })),
      findings: finding === null ? [] : [finding],
      unassessedProperties: [...UNASSESSED_PROPERTIES]
    };
  });
}

function aggregateWhole(reports = makeWholeDeckRuns(), { blockerFollowUps = [] } = {}) {
  const frozen = freezeReviewSession({ wholeReports: reports });
  const finalized = finalizeWholeDeckReviewRuns({
    wholeDeckBatch: frozen.wholeDeckBatch,
    wholeDeckReviewToken: frozen.wholeDeckReviewToken,
    blockerFollowUps
  });
  return { ...frozen, ...finalized };
}

function makeBlockerFollowUp(overrides = {}) {
  return {
    blockerId: "blocker-1",
    reviewContextSha256: REVIEW_CONTEXT_SHA256,
    followUpReviewId: "whole-deck-crop-review",
    cropSha256: BLOCKER_CROP_SHA256,
    resolution: "confirmed",
    evidenceSource: "crop",
    evidence: "The supplied crop confirms that the final action is cut off at room-reading scale.",
    confidence: 0.99,
    ...overrides
  };
}

function finalizeScenario({
  concern = null,
  reconciliations = [],
  wholeReports = makeWholeDeckRuns(),
  blockerFollowUps = []
} = {}) {
  const revealed = revealInstance({ wholeReports, blockerFollowUps });
  const instanceReports = makeInstanceReports(revealed.instanceContext, concern);
  return finalizeVisualReviewV2({
    instanceReports,
    reconciliationToken: revealed.reconciliationToken,
    requiredItemReconciliations: reconciliations.map((resolution) => makeReconciliation(
      revealed.instanceContext,
      resolution.itemId,
      resolution.resolution,
      resolution.overrides
    )),
    wholeDeckAggregate: revealed.wholeDeckAggregate,
    wholeDeckToken: revealed.wholeDeckToken
  });
}

test("v2 schema, staged prompt, and effect calibrations agree without blind-answer leakage", () => {
  assertSupportedSchema(reviewV2Schema, {
    expectedId: "urn:pptx-compiler:labs:visual-review-report:0.2.0"
  });
  assert.deepEqual(calibrationV2.examples.map(({ label }) => label), [
    "blind-outcome-reconstruction",
    "instance-required-items-matched",
    "strong-restrained",
    "weak-topic-decoration",
    "strong-subject-encoding",
    "delivery-inappropriate",
    "broken-sequence-rhythm",
    "same-visual-leave-behind",
    "blind-input-unusable",
    "instance-required-items-not-matched",
    "whole-blocker-unable-random-silhouette"
  ]);
  for (const example of calibrationV2.examples) {
    assert.deepEqual(validateJson(example.report, reviewV2Schema), [], example.label);
  }

  const blindSection = promptV2.slice(
    promptV2.indexOf("## Stage 1 — blind outcome reconstruction"),
    promptV2.indexOf("## Deterministic freeze boundary")
  );
  const hiddenValues = [
    hiddenOutcomeKey.expectedOutcome.takeawayItemId,
    hiddenOutcomeKey.expectedOutcome.requestedActionItemId,
    hiddenOutcomeKey.expectedOutcome.boundaryItemId,
    ...hiddenOutcomeKey.expectedOutcome.requiredEvidenceIds,
    ...atomicOutcomeManifest.items.map(({ expectedMeaning }) => expectedMeaning)
  ];
  for (const hiddenValue of hiddenValues) {
    assert.equal(blindSection.includes(hiddenValue), false, hiddenValue);
  }
  for (const prohibitedUniversal of [
    "no more than 50 body words",
    "no more than six primary visual elements",
    "no body text below 18 pt",
    "at least 10% intentional whitespace"
  ]) {
    assert.equal(promptV2.toLowerCase().includes(prohibitedUniversal), false);
  }
  for (const requiredGuard of [
    "reopen the exact same image once",
    "collapses byte-identical comparison images",
    "render-drift decisions in this deterministic lane",
    "prepareVisualEvidencePlan"
  ]) {
    assert.ok(promptV2.includes(requiredGuard), requiredGuard);
  }
  assert.equal(
    promptV2.match(/shared review-session digest, identical across lanes/gu)?.length,
    3
  );

  const live = calibrationV2.examples.find(({ label }) => label === "delivery-inappropriate").report;
  const reader = calibrationV2.examples.find(({ label }) => label === "same-visual-leave-behind").report;
  assert.equal(live.contactSheetSha256, reader.contactSheetSha256);
  assert.equal(live.contactSheetSummary, reader.contactSheetSummary);
  assert.equal(
    live.dimensionAssessments.find(({ dimension }) => dimension === "delivery-fitness").status,
    "concern"
  );
  assert.equal(
    reader.dimensionAssessments.find(({ dimension }) => dimension === "delivery-fitness").status,
    "fit"
  );

  const negativeRoots = new Set(calibrationV2.examples.flatMap(({ report }) =>
    report.findings?.map(({ rootCause }) => rootCause) ?? []));
  for (const rootCause of [
    "interchangeable-visual-language",
    "decoration-without-semantic-function",
    "signature-disconnected-from-subject",
    "motif-role-drift",
    "accidental-silhouette-repetition",
    "flat-density-rhythm",
    "missing-opening-job",
    "missing-closing-payoff",
    "delivery-density-mismatch",
    "random-silhouette-variation"
  ]) {
    assert.equal(negativeRoots.has(rootCause), true, rootCause);
  }

  const boundaryStatuses = new Set(calibrationV2.examples.flatMap(({ report }) =>
    report.itemAssessments?.map(({ status }) => status) ?? []));
  for (const status of ["matched", "missing", "incomplete", "incorrect", "uncertain"]) {
    assert.equal(boundaryStatuses.has(status), true, status);
  }
  assert.equal(
    calibrationV2.examples.some(({ report }) => report.inputQuality?.status === "unusable"),
    true
  );
  assert.equal(
    calibrationV2.examples.some(({ report }) => report.reconstruction !== undefined &&
      [report.reconstruction.takeaway, report.reconstruction.requestedAction,
        report.reconstruction.uncertaintyBoundary]
        .every(({ status }) => status === "not-visible")),
    true
  );
  assert.equal(
    calibrationV2.examples.some(({ report }) => report.findings?.some(
      ({ severity }) => severity === "blocker")),
    true
  );
  assert.equal(
    calibrationV2.examples.some(({ report }) => report.dimensionAssessments?.some(
      ({ status }) => status === "unable-to-judge")),
    true
  );

  const calibrationSlideIds = calibrationV2.examples.flatMap(({ report }) => [
    ...(report.orderedSlides?.map(({ slideId }) => slideId) ?? []),
    ...(report.findings?.flatMap(({ affectedSlideIds }) => affectedSlideIds) ?? [])
  ]);
  assert.equal(
    calibrationSlideIds.some((slideId) => /opening|evidence|decision/u.test(slideId)),
    false
  );
});

test("delivery profiles are mode-aware, immutable, and reject live-room deep reading", () => {
  assert.equal(VISUAL_REVIEW_V2_CONTRACT_VERSION, "0.2.0");
  assert.deepEqual({
    deliveryMode: deliveryProfile.deliveryMode,
    artifactAfterlife: deliveryProfile.artifactAfterlife,
    readingDistance: deliveryProfile.readingDistance,
    messageRecognitionSeconds: deliveryProfile.messageRecognitionSeconds,
    densityPolicy: deliveryProfile.densityPolicy
  }, {
    deliveryMode: "live-room",
    artifactAfterlife: "live-only",
    readingDistance: "room",
    messageRecognitionSeconds: 5,
    densityPolicy: "single-scan"
  });
  assert.ok(Object.isFrozen(deliveryProfile));
  assert.ok(Object.isFrozen(deliveryProfile.slides));

  const leaveBehind = createDeliveryReviewProfile({
    deliveryMode: "leave-behind",
    slides: [{ slideId: "detail-slide", plannedDensity: "deep-reading", messageSlide: true }]
  });
  assert.equal(leaveBehind.messageRecognitionSeconds, null);
  assert.equal(leaveBehind.densityPolicy, "self-guided");
  assert.throws(() => createDeliveryReviewProfile({
    deliveryMode: "live-room",
    slides: [{ slideId: "detail-slide", plannedDensity: "deep-reading", messageSlide: true }]
  }), VisualReviewV2Error);
});

test("a visual-review session admits only the fixed reviewed evidence manifest", () => {
  const prepared = createVisualReviewSession({
    deliveryProfile,
    reviewedEvidenceManifest: structuredClone(reviewedEvidenceManifest)
  });
  assert.equal(
    prepared.reviewSession.contactSheetSha256,
    reviewedEvidenceManifest.contactSheetSha256
  );
  assert.ok(Object.isFrozen(prepared.reviewSession));
  assert.ok(Object.isFrozen(prepared.reviewSessionToken));

  const mutations = [
    (manifest) => { manifest.contactSheetSha256 = UNKNOWN_SHA256; },
    (manifest) => { manifest.renderSetSha256 = UNKNOWN_SHA256; },
    (manifest) => { manifest.assemblyReceiptSha256 = UNKNOWN_SHA256; },
    (manifest) => { manifest.requiredItemSources[0].sourceRenderSha256 = UNKNOWN_SHA256; },
    (manifest) => { manifest.requiredItemSources[0].cropSha256 = UNKNOWN_SHA256; }
  ];
  for (const mutate of mutations) {
    const manifest = structuredClone(reviewedEvidenceManifest);
    mutate(manifest);
    assert.throws(() => createVisualReviewSession({
      deliveryProfile,
      reviewedEvidenceManifest: manifest
    }), VisualReviewV2Error);
  }

  const other = createVisualReviewSession({
    deliveryProfile,
    reviewedEvidenceManifest: structuredClone(reviewedEvidenceManifest)
  });
  assert.throws(() => freezeBlindOutcomeRuns(makeBlindRuns(), {
    reviewSession: prepared.reviewSession,
    reviewSessionToken: other.reviewSessionToken
  }), VisualReviewV2Error);

  freezeBlindOutcomeRuns(makeBlindRuns(), {
    reviewSession: prepared.reviewSession,
    reviewSessionToken: prepared.reviewSessionToken
  });
  let reportsInspected = false;
  const guardedReports = new Proxy(makeBlindRuns(), {
    getPrototypeOf() {
      reportsInspected = true;
      return Array.prototype;
    }
  });
  assert.throws(() => freezeBlindOutcomeRuns(guardedReports, {
    reviewSession: prepared.reviewSession,
    reviewSessionToken: prepared.reviewSessionToken
  }), VisualReviewV2Error);
  assert.equal(reportsInspected, false);

  freezeWholeDeckReviewRuns(makeWholeDeckRuns(), {
    reviewSession: prepared.reviewSession,
    wholeDeckEvidenceToken: prepared.wholeDeckEvidenceToken
  });
  let wholeReportsInspected = false;
  const guardedWholeReports = new Proxy(makeWholeDeckRuns(), {
    getPrototypeOf() {
      wholeReportsInspected = true;
      return Array.prototype;
    }
  });
  assert.throws(() => freezeWholeDeckReviewRuns(guardedWholeReports, {
    reviewSession: prepared.reviewSession,
    wholeDeckEvidenceToken: prepared.wholeDeckEvidenceToken
  }), VisualReviewV2Error);
  assert.equal(wholeReportsInspected, false);
});

test("repair classification separates refinement, replanning, and art-direction pivots", () => {
  assert.equal(classifyVisualRepair("clipped-content"), "refine");
  assert.equal(classifyVisualRepair("missing-evidence"), "replan");
  assert.equal(classifyVisualRepair("random-silhouette-variation"), "replan");
  assert.equal(classifyVisualRepair("interchangeable-visual-language"), "pivot");
  assert.equal(classifyVisualRepair("signature-disconnected-from-subject"), "pivot");
  assert.throws(() => classifyVisualRepair("model-preferred-redesign"), VisualReviewV2Error);
});

test("blind reports freeze before reveal, bind their exact context, and ignore later mutation", () => {
  const reports = makeBlindRuns();
  const frozen = freezeReviewSession({ blindReports: reports });
  const before = structuredClone(frozen.blindBatch);

  reports[0].reconstruction.takeaway.text = "A later mutation must not alter the frozen batch.";
  reports[1].orderedSlides.reverse();

  assert.deepEqual(frozen.blindBatch, before);
  assert.ok(Object.isFrozen(frozen.blindBatch));
  assert.ok(Object.isFrozen(frozen.blindToken));
  assert.doesNotThrow(() => prepareInstanceReviewReveal({
    atomicOutcomeManifest: structuredClone(atomicOutcomeManifest),
    blindBatch: frozen.blindBatch,
    blindToken: frozen.blindToken,
    hiddenOutcomeKey: structuredClone(hiddenOutcomeKey)
  }));

  const wrongContext = makeBlindRuns();
  wrongContext[2].reviewContextSha256 = UNKNOWN_SHA256;
  assert.throws(() => freezeBlind(wrongContext), VisualReviewV2Error);

  const wrongProfile = makeBlindRuns();
  wrongProfile[0].deliveryProfileSha256 = UNKNOWN_SHA256;
  assert.throws(() => freezeBlind(wrongProfile), VisualReviewV2Error);
});

test("an invalid blind token is rejected before any hidden outcome getter runs", () => {
  const frozen = freezeReviewSession();
  const guardedKey = structuredClone(hiddenOutcomeKey);
  let invoked = false;
  Object.defineProperty(guardedKey, "keyVersion", {
    enumerable: true,
    get() {
      invoked = true;
      return hiddenOutcomeKey.keyVersion;
    }
  });

  assert.throws(() => prepareInstanceReviewReveal({
    atomicOutcomeManifest: structuredClone(atomicOutcomeManifest),
    blindBatch: frozen.blindBatch,
    blindToken: Object.freeze(Object.create(null)),
    hiddenOutcomeKey: guardedKey
  }), VisualReviewV2Error);
  assert.equal(invoked, false);
});

test("reveal is impossible until the same session has frozen whole-deck evidence", () => {
  const frozen = freezeBlind();
  const guardedKey = structuredClone(hiddenOutcomeKey);
  let invoked = false;
  Object.defineProperty(guardedKey, "keyVersion", {
    enumerable: true,
    get() {
      invoked = true;
      return hiddenOutcomeKey.keyVersion;
    }
  });

  assert.throws(() => prepareInstanceReviewReveal({
    atomicOutcomeManifest: structuredClone(atomicOutcomeManifest),
    blindBatch: frozen.blindBatch,
    blindToken: frozen.blindToken,
    hiddenOutcomeKey: guardedKey
  }), VisualReviewV2Error);
  assert.equal(invoked, false);
});

test("blind slots and argument evidence cannot cite an unable-to-judge slide", () => {
  const slotReports = makeBlindRuns();
  slotReports[0].orderedSlides[1].assessmentStatus = "unable-to-judge";
  slotReports[0].reconstruction.takeaway.observations[0].slideId = "slide-b";
  assert.throws(() => freezeBlind(slotReports), VisualReviewV2Error);

  const argumentReports = makeBlindRuns();
  argumentReports[0].orderedSlides[1].assessmentStatus = "unable-to-judge";
  assert.throws(() => freezeBlind(argumentReports), VisualReviewV2Error);
});

test("unusable blind evidence cannot be rewritten as matched or reach pass", () => {
  const frozen = freezeReviewSession({ blindReports: makeUnusableBlindRuns() });
  const revealed = prepareInstanceReviewReveal({
    atomicOutcomeManifest: structuredClone(atomicOutcomeManifest),
    blindBatch: frozen.blindBatch,
    blindToken: frozen.blindToken,
    hiddenOutcomeKey: structuredClone(hiddenOutcomeKey)
  });
  const whole = finalizeWholeDeckReviewRuns({
    wholeDeckBatch: frozen.wholeDeckBatch,
    wholeDeckReviewToken: frozen.wholeDeckReviewToken,
    blockerFollowUps: []
  });
  const base = {
    reconciliationToken: revealed.reconciliationToken,
    wholeDeckAggregate: whole.wholeDeckAggregate,
    wholeDeckToken: whole.wholeDeckToken
  };

  assert.throws(() => finalizeVisualReviewV2({
    ...base,
    instanceReports: makeInstanceReports(revealed.instanceContext),
    requiredItemReconciliations: []
  }), VisualReviewV2Error);

  const instanceReports = makeUnmatchedInstanceReports(revealed.instanceContext);
  const itemIds = revealed.instanceContext.items.map(({ itemId }) => itemId)
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  const requiredItemReconciliations = itemIds.map((itemId, index) => makeReconciliation(
    revealed.instanceContext,
    itemId,
    "dismissed-failure",
    { reconciliationId: `required-item-${index + 1}` }
  ));
  const result = finalizeVisualReviewV2({
    ...base,
    instanceReports,
    requiredItemReconciliations
  });
  assert.equal(result.status, "final");
  assert.equal(result.verdict, "unable-to-judge");
  assert.equal(result.requiredItemStatus.blindInputStatus, "unusable");
});

test("instance reveal requires the reviewed manifest, hidden key, complete source set, and matching token", () => {
  const frozen = freezeReviewSession();
  const valid = {
    atomicOutcomeManifest: structuredClone(atomicOutcomeManifest),
    blindBatch: frozen.blindBatch,
    blindToken: frozen.blindToken,
    hiddenOutcomeKey: structuredClone(hiddenOutcomeKey)
  };
  const revealed = prepareInstanceReviewReveal(valid);
  assert.equal(revealed.instanceContext.rawInputSha256, atomicOutcomeManifest.rawInputSha256);
  assert.equal(
    revealed.instanceContext.assemblyReceiptSha256,
    atomicOutcomeManifest.assemblyReceiptSha256
  );
  assert.ok(Object.isFrozen(revealed.instanceContext));
  assert.ok(Object.isFrozen(revealed.reconciliationToken));

  const wrongManifest = structuredClone(atomicOutcomeManifest);
  wrongManifest.assemblyReceiptSha256 = UNKNOWN_SHA256;
  const manifestRun = freezeReviewSession();
  assert.throws(() => prepareInstanceReviewReveal({
    ...valid,
    blindBatch: manifestRun.blindBatch,
    blindToken: manifestRun.blindToken,
    atomicOutcomeManifest: wrongManifest
  }), VisualReviewV2Error);

  const wrongKey = structuredClone(hiddenOutcomeKey);
  wrongKey.expectedOutcome.requiredEvidenceIds.reverse();
  const keyRun = freezeReviewSession();
  assert.throws(() => prepareInstanceReviewReveal({
    ...valid,
    blindBatch: keyRun.blindBatch,
    blindToken: keyRun.blindToken,
    hiddenOutcomeKey: wrongKey
  }), VisualReviewV2Error);

  const incompleteEvidenceManifest = structuredClone(reviewedEvidenceManifest);
  incompleteEvidenceManifest.requiredItemSources.pop();
  assert.throws(() => freezeBlind(makeBlindRuns(), incompleteEvidenceManifest), VisualReviewV2Error);

  const originalFrozen = freezeReviewSession();
  const otherFrozen = freezeReviewSession();
  assert.throws(() => prepareInstanceReviewReveal({
    ...valid,
    blindBatch: originalFrozen.blindBatch,
    blindToken: otherFrozen.blindToken
  }), VisualReviewV2Error);

  const cloneRun = freezeReviewSession();
  assert.throws(() => prepareInstanceReviewReveal({
    ...valid,
    blindToken: cloneRun.blindToken,
    blindBatch: structuredClone(cloneRun.blindBatch)
  }), VisualReviewV2Error);
});

test("instance reports must preserve the exact revealed item set, order, kinds, and hashes", () => {
  const revealed = revealInstance();
  const base = {
    reconciliationToken: revealed.reconciliationToken,
    requiredItemReconciliations: [],
    wholeDeckAggregate: revealed.wholeDeckAggregate,
    wholeDeckToken: revealed.wholeDeckToken
  };

  const missing = makeInstanceReports(revealed.instanceContext);
  missing[0].itemAssessments.pop();
  assert.throws(() => finalizeVisualReviewV2({ ...base, instanceReports: missing }), VisualReviewV2Error);

  const duplicate = makeInstanceReports(revealed.instanceContext);
  duplicate[1].itemAssessments[1].itemId = duplicate[1].itemAssessments[0].itemId;
  assert.throws(() => finalizeVisualReviewV2({ ...base, instanceReports: duplicate }), VisualReviewV2Error);

  const wrongKind = makeInstanceReports(revealed.instanceContext);
  wrongKind[2].itemAssessments[0].itemKind = "evidence";
  assert.throws(() => finalizeVisualReviewV2({ ...base, instanceReports: wrongKind }), VisualReviewV2Error);

  const wrongHash = makeInstanceReports(revealed.instanceContext);
  wrongHash[0].instanceContextSha256 = UNKNOWN_SHA256;
  assert.throws(() => finalizeVisualReviewV2({ ...base, instanceReports: wrongHash }), VisualReviewV2Error);

  const wrongBlindRef = makeInstanceReports(revealed.instanceContext);
  wrongBlindRef[0].itemAssessments[0].blindEvidenceRefs = ["run-1:requested-action"];
  assert.throws(() => finalizeVisualReviewV2({
    ...base,
    instanceReports: wrongBlindRef
  }), VisualReviewV2Error);

  const inventedBlindRef = makeInstanceReports(revealed.instanceContext);
  inventedBlindRef[0].itemAssessments[0].blindEvidenceRefs = ["run-1:invented-slot"];
  assert.notDeepEqual(validateJson(inventedBlindRef[0], reviewV2Schema), []);
  assert.throws(() => finalizeVisualReviewV2({
    ...base,
    instanceReports: inventedBlindRef
  }), VisualReviewV2Error);
});

test("same-digest aggregates from different review sessions cannot be mixed", () => {
  const firstFrozen = freezeReviewSession();
  const secondFrozen = freezeReviewSession();
  assert.equal(
    firstFrozen.wholeDeckBatch.wholeDeckBatchSha256,
    secondFrozen.wholeDeckBatch.wholeDeckBatchSha256
  );
  assert.throws(() => finalizeWholeDeckReviewRuns({
    wholeDeckBatch: firstFrozen.wholeDeckBatch,
    wholeDeckReviewToken: secondFrozen.wholeDeckReviewToken,
    blockerFollowUps: []
  }), VisualReviewV2Error);

  const revealed = revealInstance();
  const other = revealInstance();
  assert.equal(
    revealed.wholeDeckAggregate.wholeDeckAggregateSha256,
    other.wholeDeckAggregate.wholeDeckAggregateSha256
  );
  assert.notEqual(revealed.reviewSession, other.reviewSession);
  assert.throws(() => finalizeVisualReviewV2({
    instanceReports: makeInstanceReports(revealed.instanceContext),
    reconciliationToken: revealed.reconciliationToken,
    requiredItemReconciliations: [],
    wholeDeckAggregate: other.wholeDeckAggregate,
    wholeDeckToken: other.wholeDeckToken
  }), VisualReviewV2Error);
});

test("one of three required-item concerns cannot be voted away and reconciliation is source-bound", () => {
  const concern = {
    reviewRun: 1,
    itemId: "remaining-completion-checks",
    status: "incomplete"
  };
  const revealed = revealInstance();
  const base = {
    instanceReports: makeInstanceReports(revealed.instanceContext, concern),
    reconciliationToken: revealed.reconciliationToken,
    requiredItemReconciliations: [],
    wholeDeckAggregate: revealed.wholeDeckAggregate,
    wholeDeckToken: revealed.wholeDeckToken
  };
  const pending = finalizeVisualReviewV2(base);
  assert.equal(pending.status, "follow-up-required");
  assert.equal(pending.verdict, null);
  assert.equal(pending.requiredItemStatus.status, "follow-up-required");
  assert.equal(
    pending.requiredItemStatus.assessments.find(({ itemId }) => itemId === concern.itemId)
      .aggregateStatus,
    "reconciliation-required"
  );

  const wrongCrop = makeReconciliation(
    revealed.instanceContext,
    concern.itemId,
    "dismissed-failure",
    { cropSha256: UNKNOWN_SHA256 }
  );
  assert.throws(() => finalizeVisualReviewV2({
    ...base,
    requiredItemReconciliations: [wrongCrop]
  }), VisualReviewV2Error);

  const wrongSource = makeReconciliation(
    revealed.instanceContext,
    concern.itemId,
    "dismissed-failure",
    { sourceRenderSha256: UNKNOWN_SHA256 }
  );
  assert.throws(() => finalizeVisualReviewV2({
    ...base,
    requiredItemReconciliations: [wrongSource]
  }), VisualReviewV2Error);
});

test("required-item reconciliation outcomes deterministically control the final verdict", () => {
  const concern = {
    reviewRun: 1,
    itemId: "remaining-completion-checks",
    status: "incomplete"
  };

  const confirmed = finalizeScenario({
    concern,
    reconciliations: [{ itemId: concern.itemId, resolution: "confirmed-failure" }]
  });
  assert.equal(confirmed.verdict, "revise");
  assert.equal(confirmed.evidenceScope, VISUAL_REVIEW_EVIDENCE_SCOPE);
  assert.equal(confirmed.requiredItemStatus.repairs[0].repairLevel, "replan");

  const missing = finalizeScenario({
    concern: { ...concern, status: "missing" },
    reconciliations: [{ itemId: concern.itemId, resolution: "confirmed-failure" }]
  });
  assert.equal(missing.verdict, "fail");
  assert.equal(missing.requiredItemStatus.repairs[0].repairLevel, "replan");

  const incorrect = finalizeScenario({
    concern: { ...concern, status: "incorrect" },
    reconciliations: [{ itemId: concern.itemId, resolution: "confirmed-failure" }]
  });
  assert.equal(incorrect.verdict, "fail");
  assert.equal(incorrect.requiredItemStatus.repairs[0].repairLevel, "pivot");

  const dismissed = finalizeScenario({
    concern,
    reconciliations: [{ itemId: concern.itemId, resolution: "dismissed-failure" }]
  });
  assert.equal(dismissed.verdict, "revise");

  const unresolved = finalizeScenario({
    concern,
    reconciliations: [{ itemId: concern.itemId, resolution: "unable-to-resolve" }]
  });
  assert.equal(unresolved.verdict, "unable-to-judge");

  for (const result of [confirmed, missing, incorrect, dismissed, unresolved]) {
    assert.ok(Object.isFrozen(result));
    assert.equal("modelVerdict" in result, false);
  }
});

test("a confirmed required failure dominates an unrelated unable whole-deck judgment", () => {
  const wholeReports = makeWholeDeckRuns();
  for (const reviewRun of [1, 2]) {
    wholeReports[reviewRun - 1].dimensionAssessments[0] = {
      dimension: "subject-conditionality",
      status: "unable-to-judge",
      evidence: "The supplied contact sheet does not preserve enough subject detail for this judgment.",
      confidence: 0.52
    };
  }
  const itemId = "remaining-completion-checks";
  const result = finalizeScenario({
    concern: { reviewRun: 1, itemId, status: "missing" },
    reconciliations: [{ itemId, resolution: "confirmed-failure" }],
    wholeReports
  });
  assert.equal(result.requiredItemStatus.verdict, "fail");
  assert.equal(result.wholeDeckStatus.verdict, "unable-to-judge");
  assert.equal(result.verdict, "fail");
});

test("whole-deck ordinary findings require two of three independent reports", () => {
  const reports = makeWholeDeckRuns({ ordinaryRuns: [1, 2] });
  const before = structuredClone(reports);
  const result = aggregateWhole(reports);

  assert.deepEqual(reports, before);
  assert.equal(result.wholeDeckAggregate.status, "final");
  assert.equal(result.wholeDeckAggregate.verdict, "revise");
  assert.equal(result.wholeDeckAggregate.findings.length, 1);
  assert.deepEqual(result.wholeDeckAggregate.findings[0].reportingRuns, [1, 2]);
  assert.equal(
    classifyVisualRepair(result.wholeDeckAggregate.findings[0].rootCause),
    "replan"
  );
  assert.ok(Object.isFrozen(result.wholeDeckAggregate));
  assert.ok(Object.isFrozen(result.wholeDeckToken));

  const lone = aggregateWhole(makeWholeDeckRuns({ ordinaryRuns: [1] }));
  assert.equal(lone.wholeDeckAggregate.verdict, "pass");
  assert.equal(lone.wholeDeckAggregate.findings.length, 0);
});

test("one-run extra slide scope cannot enlarge a same-region whole-deck finding", () => {
  const reports = makeWholeDeckRuns({ ordinaryRuns: [1, 2] });
  reports[0].findings[0].affectedSlideIds.push("slide-c");
  const aggregate = aggregateWhole(reports).wholeDeckAggregate;
  assert.equal(aggregate.findings.length, 1);
  assert.deepEqual(aggregate.findings[0].affectedSlideIds, ["slide-b"]);
});

test("two concern votes at disjoint regions stay unable rather than inventing a repair", () => {
  const reports = makeWholeDeckRuns({ ordinaryRuns: [1, 2] });
  reports[1].findings[0] = makeWholeFinding({
    affectedSlideIds: ["slide-c"],
    region: [0.02, 0.02, 0.2, 0.2],
    evidence: "The second run locates a different rhythm concern near the final slide.",
    impact: "The two runs do not agree on the visible location of the failure.",
    recommendation: "Obtain a localized confirming observation before assigning a repair."
  });
  reports[1].dimensionAssessments[5].evidence = reports[1].findings[0].evidence;

  const aggregate = aggregateWhole(reports).wholeDeckAggregate;
  assert.equal(aggregate.verdict, "unable-to-judge");
  assert.deepEqual(aggregate.unlocalizedConcernDimensions, ["density-rhythm"]);
  assert.deepEqual(aggregate.findings, []);
});

test("whole-deck concerns require evidence and code applies a major severity floor", () => {
  const missingFinding = makeWholeDeckRuns();
  missingFinding[0].dimensionAssessments[5] = {
    ...missingFinding[0].dimensionAssessments[5],
    status: "concern"
  };
  assert.throws(() => aggregateWhole(missingFinding), VisualReviewV2Error);

  const hiddenFinding = makeWholeDeckRuns({ ordinaryRuns: [1] });
  hiddenFinding[0].dimensionAssessments[5] = {
    ...hiddenFinding[0].dimensionAssessments[5],
    status: "fit"
  };
  assert.throws(() => aggregateWhole(hiddenFinding), VisualReviewV2Error);

  const understated = makeWholeDeckRuns({ ordinaryRuns: [1, 2] });
  understated[0].findings[0].severity = "minor";
  understated[1].findings[0].severity = "minor";
  const aggregate = aggregateWhole(understated).wholeDeckAggregate;
  assert.equal(aggregate.findings[0].severity, "major");
  assert.equal(aggregate.verdict, "revise");
});

test("a whole-deck blocker requires the exact reviewed crop follow-up", () => {
  const reports = makeWholeDeckRuns({ blockerRuns: [1] });
  const frozen = freezeReviewSession({ wholeReports: reports });
  const wholeOptions = {
    wholeDeckBatch: frozen.wholeDeckBatch,
    wholeDeckReviewToken: frozen.wholeDeckReviewToken
  };
  assert.ok(Object.isFrozen(frozen.wholeDeckBatch));
  assert.deepEqual(
    frozen.wholeDeckBatch.blockerRequests.map((request) => ({
      blockerId: request.blockerId,
      cropEvidenceId: request.cropEvidenceId,
      sourceRenderSha256: request.sourceRenderSha256,
      expectedCropSha256: request.expectedCropSha256
    })),
    [{
      blockerId: "blocker-1",
      cropEvidenceId: "slide-c-room-action",
      sourceRenderSha256: reviewedEvidenceManifest.wholeDeckCropSources[0].sourceRenderSha256,
      expectedCropSha256: BLOCKER_CROP_SHA256
    }]
  );
  const pending = finalizeWholeDeckReviewRuns({
    ...wholeOptions,
    blockerFollowUps: []
  });
  assert.equal(pending.wholeDeckAggregate.status, "follow-up-required");
  assert.equal(pending.wholeDeckAggregate.verdict, null);
  assert.deepEqual(
    pending.wholeDeckAggregate.blockerFollowUps.map(({ blockerId, reportingRuns, status }) => ({
      blockerId,
      reportingRuns,
      status
    })),
    [{ blockerId: "blocker-1", reportingRuns: [1], status: "pending" }]
  );

  assert.throws(() => finalizeWholeDeckReviewRuns({
    ...wholeOptions,
    expectedBlockerCrops: [{ blockerId: "blocker-1", cropSha256: BLOCKER_CROP_SHA256 }],
    blockerFollowUps: []
  }), VisualReviewV2Error);

  assert.throws(() => finalizeWholeDeckReviewRuns({
    ...wholeOptions,
    blockerFollowUps: [makeBlockerFollowUp({ cropSha256: UNKNOWN_SHA256 })]
  }), VisualReviewV2Error);

  const confirmed = finalizeWholeDeckReviewRuns({
    ...wholeOptions,
    blockerFollowUps: [makeBlockerFollowUp()]
  });
  assert.equal(confirmed.wholeDeckAggregate.status, "final");
  assert.equal(confirmed.wholeDeckAggregate.verdict, "fail");
  assert.equal(confirmed.wholeDeckAggregate.findings[0].severity, "blocker");

  const dismissedFrozen = freezeReviewSession({ wholeReports: reports });
  const dismissed = finalizeWholeDeckReviewRuns({
    wholeDeckBatch: dismissedFrozen.wholeDeckBatch,
    wholeDeckReviewToken: dismissedFrozen.wholeDeckReviewToken,
    blockerFollowUps: [makeBlockerFollowUp({ resolution: "dismissed" })]
  });
  assert.equal(dismissed.wholeDeckAggregate.status, "final");
  assert.equal(dismissed.wholeDeckAggregate.verdict, "revise");
  assert.equal(dismissed.wholeDeckAggregate.blockerFollowUps[0].status, "dismissed");
});

test("a confirmed whole-deck blocker dominates an unrelated unable dimension", () => {
  const reports = makeWholeDeckRuns({ blockerRuns: [1] });
  for (const reviewRun of [2, 3]) {
    reports[reviewRun - 1].dimensionAssessments[0] = {
      dimension: "subject-conditionality",
      status: "unable-to-judge",
      evidence: "The subject-specific encoding cannot be assessed from this supplied view.",
      confidence: 0.5
    };
  }
  const aggregate = aggregateWhole(reports, {
    blockerFollowUps: [makeBlockerFollowUp()]
  }).wholeDeckAggregate;
  assert.equal(
    aggregate.dimensionAssessments.find(({ dimension }) =>
      dimension === "subject-conditionality").status,
    "unable-to-judge"
  );
  assert.equal(aggregate.verdict, "fail");
});

test("v2 reports are closed, reject overflowing regions, and cannot supply their own verdict", () => {
  const extra = makeBlindRuns();
  extra[0].modelVerdict = "pass";
  assert.throws(() => freezeBlind(extra), VisualReviewV2Error);

  const overflow = makeBlindRuns();
  overflow[0].reconstruction.takeaway.observations[0].region = [0.8, 0.1, 0.3, 0.2];
  assert.throws(() => freezeBlind(overflow), VisualReviewV2Error);

  const negativeZero = makeBlindRuns();
  negativeZero[0].reconstruction.takeaway.observations[0].region[0] = -0;
  assert.throws(() => freezeBlind(negativeZero), VisualReviewV2Error);

  const revoked = Proxy.revocable(makeBlindRuns()[0], {});
  revoked.revoke();
  const proxied = makeBlindRuns();
  proxied[0] = revoked.proxy;
  assert.throws(() => freezeBlind(proxied), VisualReviewV2Error);

  const wholeVerdict = makeWholeDeckRuns();
  wholeVerdict[1].verdict = "pass";
  assert.throws(() => aggregateWhole(wholeVerdict), VisualReviewV2Error);
});

test("the lab reviewer does not enter core imports or enable a support claim", async () => {
  const names = (await readdir(coreSourceUrl)).filter((name) => name.endsWith(".mjs"));
  const sources = await Promise.all(names.map((name) => readFile(new URL(name, coreSourceUrl), "utf8")));
  for (const [index, source] of sources.entries()) {
    assert.equal(
      /visual-review-agent|review-v2-contract/u.test(source),
      false,
      `${names[index]} must not import the lab reviewer`
    );
  }

  const supportMatrix = await readJson(new URL("../policy/support-matrix.json", import.meta.url));
  assert.equal(supportMatrix.supportClaimsEnabled, false);
  assert.equal(JSON.stringify(supportMatrix).includes("visual-review-v2"), false);
});
