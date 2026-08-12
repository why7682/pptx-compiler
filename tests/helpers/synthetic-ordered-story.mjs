import {
  decisionBrief,
  statusBrief
} from "./synthetic-profile-exemplars.mjs";

export const reviewSignalBrief = Object.freeze({
  briefVersion: "0.1.0",
  slideId: "review-signal-slide",
  function: "status",
  audienceGoal: "Recognize that the independent evidence is consistent",
  availableAssetIds: [],
  evidencePolicy: "required",
  primaryTakeawayUnitId: "alignment",
  units: [
    {
      unitId: "alignment",
      role: "takeaway",
      kind: "metric",
      content: { label: "Reviewers aligned", value: "3/3" }
    },
    {
      unitId: "visible-result",
      role: "evidence",
      kind: "text",
      content: "Scope, hierarchy, and readability agreed"
    }
  ]
});

export const storyStatusBrief = Object.freeze({
  ...statusBrief,
  units: statusBrief.units.map((unit) => unit.unitId === "remaining-work"
    ? { ...unit, content: "Edit/save and accessibility checks remain" }
    : { ...unit })
});

export function makeSyntheticOrderedStory() {
  return structuredClone({
    storyVersion: "0.1.0",
    deckId: "pilot-readiness-story",
    audienceGoal: "Decide whether the proposed pilot is ready to approve",
    desiredOutcome: "Approve a limited pilot while retaining edit/save and accessibility checks",
    slides: [
      { narrativeRole: "setup", brief: reviewSignalBrief },
      { narrativeRole: "evidence", brief: storyStatusBrief },
      { narrativeRole: "resolution", brief: decisionBrief }
    ],
    transitions: [
      {
        fromSlideId: "review-signal-slide",
        relation: "deepens",
        toSlideId: "status-slide"
      },
      {
        fromSlideId: "status-slide",
        relation: "supports",
        toSlideId: "decision-slide"
      }
    ]
  });
}
