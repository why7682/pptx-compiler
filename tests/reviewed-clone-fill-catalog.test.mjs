import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  compileReviewedCloneFillCatalog,
  REVIEWED_CLONE_FILL_CATALOG_VERSION,
  ReviewedCloneFillCatalogError,
  selectAndAssembleReviewedCloneFillPresentation
} from "../labs/layout-selection/reviewed-clone-fill-catalog.mjs";
import { parseSecureZip } from "../packages/core/src/secure-zip.mjs";
import { parseStrictXml } from "../packages/core/src/strict-xml.mjs";
import { buildSyntheticFixtures } from "../scripts/generate-synthetic-fixtures.mjs";

const readJson = async (relativePath) => JSON.parse(await readFile(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8"
));

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function collectText(node, output = []) {
  if (node.localName === "t" &&
      node.namespaceURI === "http://schemas.openxmlformats.org/drawingml/2006/main") {
    output.push(node.text);
  }
  for (const child of node.children) collectText(child, output);
  return output;
}

const templateIndex = deepFreeze(await readJson("fixtures/inspection/expected-potx-template-index.json"));
const fixtureBuild = await buildSyntheticFixtures();
const sourceArchive = fixtureBuild.archives.find((archive) => archive.variant === "potx");

const exactProfile = {
  layoutId: "decision-with-proof",
  sourceSlideKey: "slide-1",
  functions: ["decision"],
  slots: [
    {
      slotId: "headline",
      sourceShapeKey: "shape-1",
      cloneFillRole: "title",
      acceptsRoles: ["takeaway"],
      kind: "text",
      minUnits: 1,
      maxUnits: 1,
      capacity: { maxChars: 72 }
    },
    {
      slotId: "proof",
      sourceShapeKey: "shape-2",
      cloneFillRole: "body",
      acceptsRoles: ["evidence"],
      kind: "metric",
      minUnits: 1,
      maxUnits: 1,
      capacity: { maxChars: 64 }
    }
  ]
};

const genericProfile = {
  layoutId: "generic-inverted-hierarchy",
  sourceSlideKey: "slide-1",
  functions: ["*"],
  slots: [
    {
      slotId: "generic-heading",
      sourceShapeKey: "shape-1",
      cloneFillRole: "title",
      acceptsRoles: ["evidence"],
      kind: "metric",
      minUnits: 1,
      maxUnits: 1,
      capacity: { maxChars: 64 }
    },
    {
      slotId: "generic-body",
      sourceShapeKey: "shape-2",
      cloneFillRole: "body",
      acceptsRoles: ["takeaway"],
      kind: "text",
      minUnits: 1,
      maxUnits: 1,
      capacity: { maxChars: 72 }
    }
  ]
};

const reviewFor = (profiles) => ({
  catalogVersion: "0.1.0",
  templateIndexId: templateIndex.templateIndexId,
  templateSha256: templateIndex.templateSha256,
  profiles
});

const brief = {
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
    }
  ]
};

function assertCatalogError(error, pointer) {
  assert.ok(error instanceof ReviewedCloneFillCatalogError);
  assert.equal(error.code, "REVIEWED_CLONE_FILL_CATALOG_INVALID");
  assert.equal(error.pointer, pointer);
  return true;
}

test("reviewed semantic slots stay bound to exact synthetic source geometry", () => {
  const catalog = compileReviewedCloneFillCatalog({
    templateIndex,
    review: reviewFor([exactProfile, genericProfile])
  });
  assert.equal(catalog.catalogVersion, REVIEWED_CLONE_FILL_CATALOG_VERSION);
  assert.deepEqual(catalog.layouts.map((layout) => layout.layoutId), [
    "decision-with-proof",
    "generic-inverted-hierarchy"
  ]);
  assert.deepEqual(catalog.traces[0].slots.map((slot) => ({
    slotId: slot.slotId,
    sourceShapeKey: slot.sourceShapeKey,
    cloneFillRole: slot.cloneFillRole,
    regionMillionths: slot.regionMillionths
  })), [
    {
      slotId: "headline",
      sourceShapeKey: "shape-1",
      cloneFillRole: "title",
      regionMillionths: [75_000, 187_500, 850_000, 166_666]
    },
    {
      slotId: "proof",
      sourceShapeKey: "shape-2",
      cloneFillRole: "body",
      regionMillionths: [112_500, 433_333, 775_000, 133_333]
    }
  ]);
  assert.ok(Object.isFrozen(catalog));
  assert.ok(Object.isFrozen(catalog.traces[0].slots[0].geometryEmu));
});

test("the exact semantic profile deterministically becomes the existing frozen clone-fill plan", () => {
  const result = selectAndAssembleReviewedCloneFillPresentation({
    sourceArchiveBytes: sourceArchive.bytes,
    templateIndex,
    review: reviewFor([exactProfile, genericProfile]),
    brief,
    outputSlideId: "selected-decision-slide"
  });
  assert.equal(result.selection.selected.layoutId, "decision-with-proof");
  assert.deepEqual(result.planTrace.fills.map((fill) => ({
    role: fill.role,
    sourceShapeKey: fill.sourceShapeKey,
    paragraphs: fill.paragraphs
  })), [
    {
      role: "body",
      sourceShapeKey: "shape-2",
      paragraphs: ["3/3 aligned — Independent reviews"]
    },
    {
      role: "title",
      sourceShapeKey: "shape-1",
      paragraphs: ["Approve a limited pilot now"]
    }
  ]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.planTrace));
});

test("exact-fit and generic profiles assemble different hierarchy candidates for rendering", () => {
  const exact = selectAndAssembleReviewedCloneFillPresentation({
    sourceArchiveBytes: sourceArchive.bytes,
    templateIndex,
    review: reviewFor([exactProfile, genericProfile]),
    brief,
    outputSlideId: "exact-fit-slide"
  });
  const generic = selectAndAssembleReviewedCloneFillPresentation({
    sourceArchiveBytes: sourceArchive.bytes,
    templateIndex,
    review: reviewFor([genericProfile]),
    brief,
    outputSlideId: "generic-fit-slide"
  });
  const slidePath = "ppt/slides/slide1.xml";
  const exactText = collectText(parseStrictXml(parseSecureZip(exact.archiveBytes).get(slidePath)).root);
  const genericText = collectText(parseStrictXml(parseSecureZip(generic.archiveBytes).get(slidePath)).root);
  assert.deepEqual(exactText, [
    "Approve a limited pilot now",
    "3/3 aligned — Independent reviews"
  ]);
  assert.deepEqual(genericText, [
    "3/3 aligned — Independent reviews",
    "Approve a limited pilot now"
  ]);
  assert.notEqual(exact.report.outputSha256, generic.report.outputSha256);
});

test("catalog compilation rejects identity drift, unknown shapes, duplicate writer roles, and accessors", () => {
  const identityDrift = structuredClone(reviewFor([exactProfile]));
  identityDrift.templateSha256 = "0".repeat(64);
  assert.throws(
    () => compileReviewedCloneFillCatalog({ templateIndex, review: identityDrift }),
    (error) => assertCatalogError(error, "/review")
  );

  const unknownShape = structuredClone(reviewFor([exactProfile]));
  unknownShape.profiles[0].slots[0].sourceShapeKey = "missing-shape";
  assert.throws(
    () => compileReviewedCloneFillCatalog({ templateIndex, review: unknownShape }),
    (error) => assertCatalogError(error, "/review/profiles/0/slots/0/sourceShapeKey")
  );

  const duplicateRole = structuredClone(reviewFor([exactProfile]));
  duplicateRole.profiles[0].slots[1].cloneFillRole = "title";
  assert.throws(
    () => compileReviewedCloneFillCatalog({ templateIndex, review: duplicateRole }),
    (error) => assertCatalogError(error, "/review/profiles/0/slots")
  );

  let invoked = false;
  const accessorReview = structuredClone(reviewFor([exactProfile]));
  Object.defineProperty(accessorReview.profiles[0], "layoutId", {
    enumerable: true,
    get() {
      invoked = true;
      return "unsafe-layout";
    }
  });
  assert.throws(
    () => compileReviewedCloneFillCatalog({ templateIndex, review: accessorReview }),
    (error) => assertCatalogError(error, "/review/profiles/0/layoutId")
  );
  assert.equal(invoked, false);
});

test("selection compilation rejects forged catalogs and leaves caller data unchanged", () => {
  const review = reviewFor([exactProfile, genericProfile]);
  const beforeReview = structuredClone(review);
  const beforeBrief = structuredClone(brief);
  const options = {
    sourceArchiveBytes: sourceArchive.bytes,
    templateIndex,
    review,
    brief,
    outputSlideId: "stable-output"
  };
  const first = selectAndAssembleReviewedCloneFillPresentation(options);
  const second = selectAndAssembleReviewedCloneFillPresentation(options);
  assert.deepEqual(first, second);
  assert.deepEqual(review, beforeReview);
  assert.deepEqual(brief, beforeBrief);

  let invoked = false;
  const accessorOptions = { ...options };
  Object.defineProperty(accessorOptions, "brief", {
    enumerable: true,
    get() {
      invoked = true;
      return brief;
    }
  });
  assert.throws(
    () => selectAndAssembleReviewedCloneFillPresentation(accessorOptions),
    (error) => assertCatalogError(error, "/options/brief")
  );
  assert.equal(invoked, false);
  assert.equal(path.posix.basename(first.planTrace.sourceSlideKey), "slide-1");
});

test("an index key swap cannot detach reviewed geometry from the atomic assembly", () => {
  const swappedIndex = structuredClone(templateIndex);
  const firstKey = swappedIndex.slides[0].shapes[0].shapeKey;
  swappedIndex.slides[0].shapes[0].shapeKey = swappedIndex.slides[0].shapes[1].shapeKey;
  swappedIndex.slides[0].shapes[1].shapeKey = firstKey;
  deepFreeze(swappedIndex);
  assert.throws(
    () => selectAndAssembleReviewedCloneFillPresentation({
      sourceArchiveBytes: sourceArchive.bytes,
      templateIndex: swappedIndex,
      review: reviewFor([exactProfile]),
      brief,
      outputSlideId: "swapped-index-output"
    }),
    /ASSEMBLY_SOURCE_MISMATCH/u
  );
});

test("metric serialization characters participate in hard capacity", () => {
  const constrained = structuredClone(exactProfile);
  constrained.slots[1].capacity.maxChars = 2;
  const tinyBrief = structuredClone(brief);
  tinyBrief.units[1].content = { label: "b", value: "a" };
  assert.throws(
    () => selectAndAssembleReviewedCloneFillPresentation({
      sourceArchiveBytes: sourceArchive.bytes,
      templateIndex,
      review: reviewFor([constrained]),
      brief: tinyBrief,
      outputSlideId: "metric-capacity-output"
    }),
    (error) => assertCatalogError(error, "/selection")
  );
});

test("top-level compile options reject accessors without invoking them", () => {
  let invoked = false;
  const options = { templateIndex, review: reviewFor([exactProfile]) };
  Object.defineProperty(options, "templateIndex", {
    enumerable: true,
    get() {
      invoked = true;
      return templateIndex;
    }
  });
  assert.throws(
    () => compileReviewedCloneFillCatalog(options),
    (error) => assertCatalogError(error, "/options/templateIndex")
  );
  assert.equal(invoked, false);
});
