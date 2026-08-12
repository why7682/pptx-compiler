import assert from "node:assert/strict";
import test from "node:test";

import {
  LAYOUT_SELECTION_VERSION,
  LayoutSelectionInputError,
  selectTemplateLayout
} from "../labs/layout-selection/layout-selector.mjs";

const decisionBrief = {
  briefVersion: "0.1.0",
  slideId: "decision-slide",
  function: "decision",
  audienceGoal: "Approve the proposed pilot",
  availableAssetIds: [],
  evidencePolicy: "required",
  primaryTakeawayUnitId: "recommendation",
  units: [
    {
      unitId: "recommendation",
      role: "takeaway",
      kind: "text",
      content: "Approve a limited pilot now"
    },
    {
      unitId: "review-consensus",
      role: "evidence",
      kind: "metric",
      content: { label: "Independent reviews", value: "3/3 aligned" }
    },
    {
      unitId: "next-step",
      role: "action",
      kind: "text",
      content: "Authorize the two-week test"
    }
  ]
};

const layouts = [
  {
    layoutId: "generic-title-body",
    sourceSlideKey: "slide-generic",
    functions: ["*"],
    slots: [
      {
        slotId: "headline",
        acceptsRoles: ["takeaway"],
        kind: "text",
        minUnits: 1,
        maxUnits: 1,
        capacity: { maxChars: 72 }
      },
      {
        slotId: "body",
        acceptsRoles: ["*"],
        kind: "any",
        minUnits: 1,
        maxUnits: 4,
        capacity: {
          image: { maxImages: 2 },
          list: { maxCharsPerItem: 120, maxItems: 8 },
          metric: { maxChars: 120 },
          text: { maxChars: 240 }
        }
      }
    ]
  },
  {
    layoutId: "decision-with-proof",
    sourceSlideKey: "slide-decision-proof",
    functions: ["decision"],
    slots: [
      {
        slotId: "headline",
        acceptsRoles: ["takeaway"],
        kind: "text",
        minUnits: 1,
        maxUnits: 1,
        capacity: { maxChars: 72 }
      },
      {
        slotId: "proof",
        acceptsRoles: ["evidence"],
        kind: "metric",
        minUnits: 1,
        maxUnits: 3,
        capacity: { maxChars: 64 }
      },
      {
        slotId: "action",
        acceptsRoles: ["action"],
        kind: "text",
        minUnits: 1,
        maxUnits: 1,
        capacity: { maxChars: 56 }
      }
    ]
  },
  {
    layoutId: "photo-statement",
    sourceSlideKey: "slide-photo",
    functions: ["decision"],
    slots: [
      {
        slotId: "headline",
        acceptsRoles: ["takeaway"],
        kind: "text",
        minUnits: 1,
        maxUnits: 1,
        capacity: { maxChars: 72 }
      },
      {
        slotId: "hero-image",
        acceptsRoles: ["visual"],
        kind: "image",
        minUnits: 1,
        maxUnits: 1,
        capacity: { maxImages: 1 }
      }
    ]
  }
];

test("selects the exact decision layout with a dedicated evidence affordance", () => {
  const result = selectTemplateLayout({ brief: decisionBrief, layouts });
  assert.equal(result.selectionVersion, LAYOUT_SELECTION_VERSION);
  assert.equal(result.selected.layoutId, "decision-with-proof");
  assert.deepEqual(result.selected.assignments, [
    { unitId: "next-step", slotId: "action" },
    { unitId: "recommendation", slotId: "headline" },
    { unitId: "review-consensus", slotId: "proof" }
  ]);
  assert.equal(result.candidates[1].layoutId, "generic-title-body");
  assert.deepEqual(
    result.rejected.find((item) => item.layoutId === "photo-statement").reasons,
    [
      { code: "unit-unassignable", unitId: "review-consensus" },
      { code: "unit-unassignable", unitId: "next-step" }
    ]
  );
});

test("capacity is a hard constraint and never silently truncates content", () => {
  const constrained = structuredClone(layouts[1]);
  constrained.slots[0].capacity.maxChars = 8;
  const result = selectTemplateLayout({ brief: decisionBrief, layouts: [constrained] });
  assert.equal(result.selected, null);
  assert.deepEqual(result.rejected[0].reasons, [
    { code: "unit-unassignable", unitId: "recommendation" }
  ]);
});

test("wildcard slots enforce explicit text, metric, list, and image capacities", () => {
  const wildcardLayout = {
    layoutId: "bounded-wildcard",
    sourceSlideKey: "slide-bounded-wildcard",
    functions: ["statement"],
    slots: [
      {
        slotId: "headline",
        acceptsRoles: ["takeaway"],
        kind: "text",
        minUnits: 1,
        maxUnits: 1,
        capacity: { maxChars: 40 }
      },
      {
        slotId: "body",
        acceptsRoles: ["*"],
        kind: "any",
        minUnits: 1,
        maxUnits: 4,
        capacity: {
          image: { maxImages: 1 },
          list: { maxCharsPerItem: 4, maxItems: 1 },
          metric: { maxChars: 4 },
          text: { maxChars: 4 }
        }
      }
    ]
  };
  const cases = [
    {
      availableAssetIds: [],
      unit: { unitId: "body", role: "body", kind: "text", content: "overflow" }
    },
    {
      availableAssetIds: [],
      unit: {
        unitId: "proof",
        role: "body",
        kind: "metric",
        content: { label: "rate", value: "100%" }
      }
    },
    {
      availableAssetIds: [],
      unit: { unitId: "points", role: "body", kind: "list", content: ["one", "two"] }
    },
    {
      availableAssetIds: ["asset-a", "asset-b"],
      unit: {
        unitId: "image-a",
        role: "body",
        kind: "image",
        content: { alt: "First", assetId: "asset-a" }
      },
      extraUnit: {
        unitId: "image-b",
        role: "body",
        kind: "image",
        content: { alt: "Second", assetId: "asset-b" }
      }
    }
  ];

  for (const [index, item] of cases.entries()) {
    const brief = {
      briefVersion: "0.1.0",
      slideId: `wildcard-${index}`,
      function: "statement",
      audienceGoal: "Show bounded content",
      availableAssetIds: item.availableAssetIds,
      evidencePolicy: "none",
      primaryTakeawayUnitId: "takeaway",
      units: [
        { unitId: "takeaway", role: "takeaway", kind: "text", content: "Bounded" },
        item.unit,
        ...(item.extraUnit ? [item.extraUnit] : [])
      ]
    };
    const result = selectTemplateLayout({ brief, layouts: [wildcardLayout] });
    assert.equal(result.selected, null, item.unit.kind);
  }
});

test("wildcard slots reject an incomplete per-kind capacity declaration", () => {
  const invalid = structuredClone(layouts[0]);
  delete invalid.slots[1].capacity.image;
  assert.throws(
    () => selectTemplateLayout({ brief: decisionBrief, layouts: [invalid] }),
    (error) => {
      assert.ok(error instanceof LayoutSelectionInputError);
      assert.equal(error.pointer, "/layouts/0/slots/1/capacity");
      return true;
    }
  );
});

test("an exact semantic role outranks wildcard placement without weighted model scores", () => {
  const exact = structuredClone(layouts[1]);
  exact.layoutId = "exact-second-in-catalog";
  const generic = structuredClone(layouts[0]);
  generic.layoutId = "generic-first-in-catalog";
  const result = selectTemplateLayout({ brief: decisionBrief, layouts: [generic, exact] });
  assert.equal(result.selected.layoutId, "exact-second-in-catalog");
  assert.deepEqual(result.scoreDimensions, [
    "functionFallbacks",
    "roleFallbacks",
    "kindFallbacks",
    "unusedOptionalSlots",
    "capacitySlack",
    "catalogOrder"
  ]);
});

test("a decision brief cannot claim required evidence without an evidence unit", () => {
  const invalid = structuredClone(decisionBrief);
  invalid.units = invalid.units.filter((unit) => unit.role !== "evidence");
  assert.throws(
    () => selectTemplateLayout({ brief: invalid, layouts }),
    (error) => {
      assert.ok(error instanceof LayoutSelectionInputError);
      assert.equal(error.pointer, "/brief/evidencePolicy");
      return true;
    }
  );
});

test("image units must reference an explicitly available asset", () => {
  const invalid = {
    ...structuredClone(decisionBrief),
    availableAssetIds: [],
    units: [
      ...structuredClone(decisionBrief.units),
      {
        unitId: "visual",
        role: "visual",
        kind: "image",
        content: { alt: "Pilot diagram", assetId: "missing-asset" }
      }
    ]
  };
  assert.throws(
    () => selectTemplateLayout({ brief: invalid, layouts }),
    (error) => {
      assert.ok(error instanceof LayoutSelectionInputError);
      assert.equal(error.pointer, "/brief/units/3/content/assetId");
      return true;
    }
  );
});

test("the aggregate brief string budget is enforced before layout search", () => {
  const invalid = {
    briefVersion: "0.1.0",
    slideId: "aggregate-budget",
    function: "statement",
    audienceGoal: "Bound all brief text",
    availableAssetIds: [],
    evidencePolicy: "none",
    primaryTakeawayUnitId: "unit-0",
    units: Array.from({ length: 5 }, (_, index) => ({
      unitId: `unit-${index}`,
      role: index === 0 ? "takeaway" : "body",
      kind: "text",
      content: "x".repeat(15_000)
    }))
  };
  assert.throws(
    () => selectTemplateLayout({ brief: invalid, layouts }),
    (error) => {
      assert.ok(error instanceof LayoutSelectionInputError);
      assert.equal(error.pointer, "/brief");
      return true;
    }
  );
});

test("brief and catalog UTF-8 budgets are explicit and deterministic", () => {
  const invalidBrief = structuredClone(decisionBrief);
  invalidBrief.units = Array.from({ length: 5 }, (_, index) => ({
    unitId: `unit-${index}`,
    role: index === 0 ? "takeaway" : "body",
    kind: "text",
    content: "界".repeat(15_000)
  }));
  invalidBrief.evidencePolicy = "none";
  invalidBrief.primaryTakeawayUnitId = "unit-0";
  assert.throws(
    () => selectTemplateLayout({ brief: invalidBrief, layouts }),
    (error) => error instanceof LayoutSelectionInputError && error.pointer === "/brief"
  );

  const oversizedCatalog = Array.from({ length: 20 }, (_, layoutIndex) => ({
    layoutId: `layout-${layoutIndex}`,
    sourceSlideKey: `slide-${layoutIndex}`,
    functions: ["statement"],
    slots: Array.from({ length: 16 }, (_, slotIndex) => ({
      slotId: `slot-${slotIndex}`,
      acceptsRoles: Array.from({ length: 32 }, (__, roleIndex) =>
        `${"界".repeat(120)}-${roleIndex}`),
      kind: "text",
      minUnits: 0,
      maxUnits: 1,
      capacity: { maxChars: 1 }
    }))
  }));
  assert.throws(
    () => selectTemplateLayout({ brief: decisionBrief, layouts: oversizedCatalog }),
    (error) => error instanceof LayoutSelectionInputError && error.pointer === "/layouts"
  );
});

test("selection is deterministic and does not mutate the brief or catalog", () => {
  const briefBefore = structuredClone(decisionBrief);
  const layoutsBefore = structuredClone(layouts);
  const first = selectTemplateLayout({ brief: decisionBrief, layouts });
  const second = selectTemplateLayout({ brief: decisionBrief, layouts });
  assert.deepEqual(first, second);
  assert.deepEqual(decisionBrief, briefBefore);
  assert.deepEqual(layouts, layoutsBefore);
});

test("ambiguous catalogs fail closed at a deterministic search budget", () => {
  const ambiguousBrief = {
    briefVersion: "0.1.0",
    slideId: "ambiguous-slide",
    function: "statement",
    audienceGoal: "Communicate one bounded statement",
    availableAssetIds: [],
    evidencePolicy: "none",
    primaryTakeawayUnitId: "unit-0",
    units: Array.from({ length: 8 }, (_, index) => ({
      unitId: `unit-${index}`,
      role: index === 0 ? "takeaway" : "body",
      kind: "text",
      content: `Content ${index}`
    }))
  };
  const ambiguousLayout = {
    layoutId: "ambiguous-layout",
    sourceSlideKey: "slide-ambiguous",
    functions: ["statement"],
    slots: Array.from({ length: 8 }, (_, index) => ({
      slotId: `slot-${index}`,
      acceptsRoles: ["*"],
      kind: "text",
      minUnits: 0,
      maxUnits: 8,
      capacity: { maxChars: 1_000 }
    }))
  };

  const result = selectTemplateLayout({
    brief: ambiguousBrief,
    layouts: [ambiguousLayout]
  });
  assert.equal(result.selectionStatus, "incomplete");
  assert.equal(result.selected, null);
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(result.rejected, []);
  assert.deepEqual(result.incompleteReason, {
    code: "layout-search-budget-exceeded",
    layoutId: "ambiguous-layout",
    maxSearchStates: 100_000
  });
});

test("one incomplete competitor prevents authority for an otherwise valid candidate", () => {
  const brief = {
    briefVersion: "0.1.0",
    slideId: "mixed-completeness",
    function: "statement",
    audienceGoal: "Reject authority from an incompletely searched catalog",
    availableAssetIds: [],
    evidencePolicy: "none",
    primaryTakeawayUnitId: "unit-0",
    units: Array.from({ length: 8 }, (_, index) => ({
      unitId: `unit-${index}`,
      role: index === 0 ? "takeaway" : "body",
      kind: "text",
      content: `Content ${index}`
    }))
  };
  const valid = {
    layoutId: "cheap-valid",
    sourceSlideKey: "slide-cheap-valid",
    functions: ["statement"],
    slots: [
      {
        slotId: "headline",
        acceptsRoles: ["takeaway"],
        kind: "text",
        minUnits: 1,
        maxUnits: 1,
        capacity: { maxChars: 100 }
      },
      {
        slotId: "body",
        acceptsRoles: ["body"],
        kind: "text",
        minUnits: 7,
        maxUnits: 7,
        capacity: { maxChars: 1_000 }
      }
    ]
  };
  const ambiguous = {
    layoutId: "expensive-unknown",
    sourceSlideKey: "slide-expensive-unknown",
    functions: ["statement"],
    slots: Array.from({ length: 8 }, (_, index) => ({
      slotId: `slot-${index}`,
      acceptsRoles: ["*"],
      kind: "text",
      minUnits: 0,
      maxUnits: 8,
      capacity: { maxChars: 1_000 }
    }))
  };

  const result = selectTemplateLayout({ brief, layouts: [valid, ambiguous] });
  assert.equal(result.selectionStatus, "incomplete");
  assert.equal(result.selected, null);
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(result.incompleteReason, {
    code: "layout-search-budget-exceeded",
    layoutId: "expensive-unknown",
    maxSearchStates: 100_000
  });
});

test("the whole catalog fails closed when its aggregate search is incomplete", () => {
  const ambiguousBrief = {
    briefVersion: "0.1.0",
    slideId: "request-budget-slide",
    function: "statement",
    audienceGoal: "Compare a bounded catalog",
    availableAssetIds: [],
    evidencePolicy: "none",
    primaryTakeawayUnitId: "unit-0",
    units: Array.from({ length: 6 }, (_, index) => ({
      unitId: `unit-${index}`,
      role: index === 0 ? "takeaway" : "body",
      kind: "text",
      content: `Content ${index}`
    }))
  };
  const ambiguousLayouts = Array.from({ length: 5 }, (_, layoutIndex) => ({
    layoutId: `ambiguous-${layoutIndex}`,
    sourceSlideKey: `slide-ambiguous-${layoutIndex}`,
    functions: ["statement"],
    slots: Array.from({ length: 6 }, (_, slotIndex) => ({
      slotId: `slot-${slotIndex}`,
      acceptsRoles: ["*"],
      kind: "text",
      minUnits: 0,
      maxUnits: 6,
      capacity: { maxChars: 1_000 }
    }))
  }));

  const result = selectTemplateLayout({ brief: ambiguousBrief, layouts: ambiguousLayouts });
  assert.equal(result.selectionStatus, "incomplete");
  assert.equal(result.selected, null);
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(result.incompleteReason, {
    code: "whole-request-search-budget-exceeded",
    maxSearchStates: 250_000
  });
});

test("assignment ordering uses deterministic UTF-16 code-unit order", () => {
  const brief = {
    briefVersion: "0.1.0",
    slideId: "code-unit-order",
    function: "statement",
    audienceGoal: "Keep ordering independent of host locale",
    availableAssetIds: [],
    evidencePolicy: "none",
    primaryTakeawayUnitId: "takeaway",
    units: [
      { unitId: "takeaway", role: "takeaway", kind: "text", content: "Order" },
      { unitId: "ä-unit", role: "body", kind: "text", content: "Later" },
      { unitId: "z-unit", role: "body", kind: "text", content: "Earlier" }
    ]
  };
  const layout = {
    layoutId: "code-unit-layout",
    sourceSlideKey: "slide-code-unit",
    functions: ["statement"],
    slots: [
      {
        slotId: "headline",
        acceptsRoles: ["takeaway"],
        kind: "text",
        minUnits: 1,
        maxUnits: 1,
        capacity: { maxChars: 40 }
      },
      {
        slotId: "body",
        acceptsRoles: ["body"],
        kind: "text",
        minUnits: 2,
        maxUnits: 2,
        capacity: { maxChars: 40 }
      }
    ]
  };

  const result = selectTemplateLayout({ brief, layouts: [layout] });
  assert.deepEqual(result.selected.assignments.map((item) => item.unitId), [
    "takeaway",
    "z-unit",
    "ä-unit"
  ]);
});
