import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ORDERED_STORY_DECK_VERSION,
  OrderedStoryDeckError,
  selectAndAssembleOrderedStoryDeck
} from "../labs/layout-selection/ordered-story-deck.mjs";
import { selectAndAssembleInducedCloneFillPresentation } from
  "../labs/layout-selection/reviewed-profile-induction.mjs";
import {
  assembleCloneFillPresentation,
  publishCreateOnlyPresentation
} from
  "../packages/core/src/create-only-assembly.mjs";
import { verifyCandidateBuildRecord } from
  "../packages/core/src/candidate-build-record.mjs";
import { createDeterministicZip } from
  "../packages/core/src/deterministic-zip.mjs";
import {
  ORDERED_SLIDE_ASSEMBLY_VERSION,
  OrderedSlideAssemblyError,
  assembleOrderedSlideDeck
} from "../packages/core/src/ordered-slide-assembly.mjs";
import { writeAuthenticatedOrderedCandidateBundle } from
  "../packages/core/src/native-presentation-publication.mjs";
import { buildSecureTemplatePackageView } from
  "../packages/core/src/ooxml-package-view.mjs";
import { parseSecureZip, SECURE_ZIP_LIMITS } from
  "../packages/core/src/secure-zip.mjs";
import { parseStrictXml } from "../packages/core/src/strict-xml.mjs";
import {
  buildSyntheticProfileExemplars,
  decisionBrief,
  makeSyntheticProfileAcceptance
} from "./helpers/synthetic-profile-exemplars.mjs";
import {
  makeSyntheticOrderedStory,
  reviewSignalBrief,
  storyStatusBrief
} from "./helpers/synthetic-ordered-story.mjs";

const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";

function buildStory(overrides = {}) {
  return selectAndAssembleOrderedStoryDeck({
    exemplars: buildSyntheticProfileExemplars(),
    acceptance: makeSyntheticProfileAcceptance(),
    story: makeSyntheticOrderedStory(),
    ...overrides
  });
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

function slideFacts(parts, partPath) {
  const root = parseStrictXml(parts.get(partPath)).root;
  return {
    text: collectNodes(root, NS_A, "t").map((node) => node.text),
    fontSizes: collectNodes(root, NS_A, "rPr")
      .map((node) => Number(node.attributes.get("\u0000sz")?.value))
  };
}

function assembleOneSlide(brief, outputSlideId) {
  return selectAndAssembleInducedCloneFillPresentation({
    exemplars: buildSyntheticProfileExemplars(),
    acceptance: makeSyntheticProfileAcceptance(),
    brief,
    outputSlideId
  });
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function makeDirectPlan(outputSlideId) {
  return deepFreeze({
    planVersion: "0.1.0",
    planType: "source-slide-clone-fill-plan",
    outputSlideId,
    clone: {
      operationId: "clone-source-slide",
      operationType: "clone-slide",
      sourceContainerKind: "slide",
      sourceSlideKey: "slide-1"
    },
    fills: [
      {
        operationId: "fill-body",
        operationType: "replace-cloned-shape-text",
        role: "body",
        shapeBindingId: "direct-body-binding",
        sourceShapeKey: "shape-2",
        expectedKind: "text-box",
        paragraphs: ["Bounded supporting evidence"]
      },
      {
        operationId: "fill-title",
        operationType: "replace-cloned-shape-text",
        role: "title",
        shapeBindingId: "direct-title-binding",
        sourceShapeKey: "shape-1",
        expectedKind: "text-box",
        paragraphs: ["Bounded primary takeaway"]
      }
    ]
  });
}

function assertStoryError(error, pointer) {
  assert.ok(error instanceof OrderedStoryDeckError);
  assert.equal(error.code, "ORDERED_STORY_DECK_INVALID");
  assert.equal(error.pointer, pointer);
  return true;
}

function assertAssemblyError(error, code, pointer) {
  assert.ok(error instanceof OrderedSlideAssemblyError);
  assert.equal(error.code, code);
  assert.equal(error.pointer, pointer);
  return true;
}

test("reviewed setup, evidence, and resolution beats become one exact ordered PPTX graph", () => {
  const result = buildStory();
  assert.equal(result.storyVersion, ORDERED_STORY_DECK_VERSION);
  assert.equal(result.report.assemblyVersion, ORDERED_SLIDE_ASSEMBLY_VERSION);
  assert.equal(result.report.artifactType, "ordered-assembled-pptx");
  assert.deepEqual(result.graph.nodes.map((node) => [
    node.order,
    node.narrativeRole,
    node.function,
    node.selectedExemplarId,
    node.partPath,
    node.presentationSlideId,
    node.relationshipId
  ]), [
    [1, "setup", "status", "status-focus", "ppt/slides/slide1.xml", 256, "rId4"],
    [2, "evidence", "status", "status-focus", "ppt/slides/slide2.xml", 257, "rId5"],
    [3, "resolution", "decision", "decision-focus", "ppt/slides/slide3.xml", 258, "rId6"]
  ]);
  assert.deepEqual(result.graph.edges, [
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
  ]);
  assert.equal(result.report.diff.collateralChanges.length, 0);
  assert.ok(result.selectionTraces.every((trace) =>
    trace.singleSlideDiff.collateralChanges.length === 0));
  assert.deepEqual(result.report.diff.addedParts, [
    "ppt/slides/_rels/slide2.xml.rels",
    "ppt/slides/_rels/slide3.xml.rels",
    "ppt/slides/slide2.xml",
    "ppt/slides/slide3.xml"
  ]);
  assert.match(result.report.outputSha256, /^[a-f0-9]{64}$/u);
  assert.ok(Object.isFrozen(result.graph));
  assert.ok(Object.isFrozen(result.graph.nodes[0]));
});

test("the authentic hierarchy changes by story beat while each slide keeps one takeaway and support", () => {
  const result = buildStory();
  const parts = parseSecureZip(result.archiveBytes);
  assert.deepEqual(slideFacts(parts, "ppt/slides/slide1.xml"), {
    text: ["Scope, hierarchy, and readability agreed", "3/3 — Reviewers aligned"],
    fontSizes: [2400, 4800]
  });
  assert.deepEqual(slideFacts(parts, "ppt/slides/slide2.xml"), {
    text: ["Edit/save and accessibility checks remain", "87% — Controls ready"],
    fontSizes: [2400, 4800]
  });
  assert.deepEqual(slideFacts(parts, "ppt/slides/slide3.xml"), {
    text: ["Approve a limited pilot now", "3/3 aligned — Independent reviews"],
    fontSizes: [4400, 2000]
  });
  assert.deepEqual(result.graph.nodes.map((node) => node.primaryTakeawayUnitId), [
    "alignment", "readiness", "recommendation"
  ]);
});

test("the output graph is byte-deterministic across caller copies and exemplar order", () => {
  const first = buildStory();
  const exemplars = buildSyntheticProfileExemplars().reverse();
  const second = selectAndAssembleOrderedStoryDeck({
    exemplars,
    acceptance: structuredClone(makeSyntheticProfileAcceptance()),
    story: structuredClone(makeSyntheticOrderedStory())
  });
  assert.deepEqual(second, first);
  assert.equal(
    first.report.outputSha256,
    "07bffa7c11baef63fe797e32614e98f7c29b0f1c1817b85dc83dd6c6db5ead18"
  );
});

test("narrative order and adjacency fail before exemplar access", () => {
  const story = makeSyntheticOrderedStory();
  story.transitions[0].toSlideId = "decision-slide";
  const exemplars = buildSyntheticProfileExemplars();
  let getterCalls = 0;
  Object.defineProperty(exemplars[0], "sourceArchiveBytes", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return new Uint8Array([1]);
    }
  });
  assert.throws(
    () => selectAndAssembleOrderedStoryDeck({
      exemplars,
      acceptance: makeSyntheticProfileAcceptance(),
      story
    }),
    (error) => assertStoryError(error, "/story/transitions/0")
  );
  assert.equal(getterCalls, 0);
});

test("the detached story snapshot prevents later graph fields from rewriting an earlier brief", () => {
  const story = makeSyntheticOrderedStory();
  const originalTransitions = story.transitions;
  story.transitions = new Proxy(originalTransitions, {
    ownKeys(target) {
      story.slides[0].brief.units[0].content = {
        label: "Mutated after capture",
        value: "0/3"
      };
      return Reflect.ownKeys(target);
    }
  });
  const result = selectAndAssembleOrderedStoryDeck({
    exemplars: buildSyntheticProfileExemplars(),
    acceptance: makeSyntheticProfileAcceptance(),
    story
  });
  assert.deepEqual(
    slideFacts(parseSecureZip(result.archiveBytes), "ppt/slides/slide1.xml").text,
    ["Scope, hierarchy, and readability agreed", "3/3 — Reviewers aligned"]
  );
  assert.equal(result.graph.nodes[0].primaryTakeawayUnitId, "alignment");
});

test("one acceptance and exemplar snapshot authorizes the complete story batch", () => {
  const acceptance = makeSyntheticProfileAcceptance();
  let acceptanceCaptures = 0;
  const acceptanceProxy = new Proxy(acceptance, {
    ownKeys(target) {
      acceptanceCaptures += 1;
      if (acceptanceCaptures > 1) throw new Error("acceptance-reread");
      return Reflect.ownKeys(target);
    }
  });
  const exemplars = buildSyntheticProfileExemplars();
  let exemplarCaptures = 0;
  const exemplarProxy = new Proxy(exemplars, {
    ownKeys(target) {
      exemplarCaptures += 1;
      if (exemplarCaptures > 1) throw new Error("exemplar-reread");
      return Reflect.ownKeys(target);
    }
  });
  const result = selectAndAssembleOrderedStoryDeck({
    acceptance: acceptanceProxy,
    exemplars: exemplarProxy,
    story: makeSyntheticOrderedStory()
  });
  assert.equal(acceptanceCaptures, 1);
  assert.equal(exemplarCaptures, 1);
  assert.match(result.acceptanceSha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(result.graph.nodes.map((node) => node.selectedExemplarId), [
    "status-focus", "status-focus", "decision-focus"
  ]);
});

test("story input introspection failures stay inside the structured error boundary", () => {
  const storyRevocable = Proxy.revocable(makeSyntheticOrderedStory(), {});
  storyRevocable.revoke();
  assert.throws(
    () => selectAndAssembleOrderedStoryDeck({
      acceptance: makeSyntheticProfileAcceptance(),
      exemplars: buildSyntheticProfileExemplars(),
      story: storyRevocable.proxy
    }),
    (error) => assertStoryError(error, "/story")
  );

  const acceptance = new Proxy(makeSyntheticProfileAcceptance(), {
    ownKeys() {
      throw new Error("acceptance-introspection-failure");
    }
  });
  assert.throws(
    () => selectAndAssembleOrderedStoryDeck({
      acceptance,
      exemplars: buildSyntheticProfileExemplars(),
      story: makeSyntheticOrderedStory()
    }),
    (error) => assertStoryError(error, "/acceptance")
  );
});

test("a semantically invalid final beat returns no partial deck", () => {
  const story = makeSyntheticOrderedStory();
  story.slides[2].brief.units[0].content = "x".repeat(20_000);
  assert.throws(
    () => selectAndAssembleOrderedStoryDeck({
      exemplars: buildSyntheticProfileExemplars(),
      acceptance: makeSyntheticProfileAcceptance(),
      story
    }),
    (error) => assertStoryError(error, "/story/slides/2/selection")
  );
});

test("single-slide report identity prevents bytes and semantic labels from being swapped", () => {
  const decision = assembleOneSlide(decisionBrief, "decision-artifact");
  const status = assembleOneSlide(storyStatusBrief, "status-artifact");
  assert.throws(
    () => assembleOrderedSlideDeck({
      slides: [
        { archiveBytes: status.archiveBytes, report: decision.report },
        { archiveBytes: decision.archiveBytes, report: status.report }
      ]
    }),
    (error) => assertAssemblyError(
      error,
      "ORDERED_SLIDE_ASSEMBLY_SOURCE_MISMATCH",
      "/slides/0/report"
    )
  );
});

test("every admitted relationship edge closes over the intended typed target", () => {
  const source = buildSyntheticProfileExemplars().find((exemplar) =>
    exemplar.exemplarId === "decision-focus");
  const parts = new Map([...parseSecureZip(source.sourceArchiveBytes)].map(([partPath, bytes]) =>
    [partPath, Buffer.from(bytes)]));
  const layoutRelationshipsPart = "ppt/slideLayouts/_rels/slideLayout1.xml.rels";
  parts.set(
    layoutRelationshipsPart,
    Buffer.from(
      parts.get(layoutRelationshipsPart).toString("utf8")
        .replace("../slideMasters/slideMaster1.xml", "../theme/theme1.xml"),
      "utf8"
    )
  );
  const malformedSource = createDeterministicZip(parts);
  const malformedIndex = structuredClone(source.templateIndex);
  malformedIndex.templateSha256 = createHash("sha256").update(malformedSource).digest("hex");
  const malformedArtifact = assembleCloneFillPresentation({
    sourceArchiveBytes: malformedSource,
    templateIndex: deepFreeze(malformedIndex),
    plan: makeDirectPlan("malformed-relationship-slide")
  });
  const validArtifact = assembleOneSlide(reviewSignalBrief, "valid-relationship-slide");
  assert.throws(
    () => assembleOrderedSlideDeck({
      slides: [
        { archiveBytes: malformedArtifact.archiveBytes, report: malformedArtifact.report },
        { archiveBytes: validArtifact.archiveBytes, report: validArtifact.report }
      ]
    }),
    (error) => assertAssemblyError(
      error,
      "ORDERED_SLIDE_ASSEMBLY_SOURCE_MISMATCH",
      "/slides/0/archiveBytes/relationshipClosure/layout"
    )
  );
});

test("relationship closure rejects every unreferenced content part", () => {
  const source = buildSyntheticProfileExemplars().find((exemplar) =>
    exemplar.exemplarId === "decision-focus");
  const parts = new Map([...parseSecureZip(source.sourceArchiveBytes)].map(([partPath, bytes]) =>
    [partPath, Buffer.from(bytes)]));
  parts.set("ppt/theme/theme2.xml", Buffer.from(parts.get("ppt/theme/theme1.xml")));
  parts.set(
    "[Content_Types].xml",
    Buffer.from(
      parts.get("[Content_Types].xml").toString("utf8").replace(
        "</Types>",
        "  <Override PartName=\"/ppt/theme/theme2.xml\" " +
          "ContentType=\"application/vnd.openxmlformats-officedocument.theme+xml\"/>\n</Types>"
      ),
      "utf8"
    )
  );
  const orphanSource = createDeterministicZip(parts);
  const orphanIndex = structuredClone(source.templateIndex);
  orphanIndex.templateSha256 = createHash("sha256").update(orphanSource).digest("hex");
  const orphanArtifact = assembleCloneFillPresentation({
    sourceArchiveBytes: orphanSource,
    templateIndex: deepFreeze(orphanIndex),
    plan: makeDirectPlan("orphan-content-slide")
  });
  const validArtifact = assembleOneSlide(reviewSignalBrief, "valid-content-slide");
  assert.throws(
    () => assembleOrderedSlideDeck({
      slides: [
        { archiveBytes: orphanArtifact.archiveBytes, report: orphanArtifact.report },
        { archiveBytes: validArtifact.archiveBytes, report: validArtifact.report }
      ]
    }),
    (error) => assertAssemblyError(
      error,
      "ORDERED_SLIDE_ASSEMBLY_SOURCE_MISMATCH",
      "/slides/0/archiveBytes/relationshipClosure/contentParts"
    )
  );
});

test("archive limits use intrinsic metadata and reject before copying", () => {
  const valid = assembleOneSlide(decisionBrief, "valid-slide");
  const oversized = new Uint8Array(SECURE_ZIP_LIMITS.maxArchiveBytes + 1);
  let getterCalls = 0;
  Object.defineProperty(oversized, "byteLength", {
    get() {
      getterCalls += 1;
      return 1;
    }
  });
  assert.throws(
    () => assembleOrderedSlideDeck({
      slides: [
        { archiveBytes: valid.archiveBytes, report: valid.report },
        { archiveBytes: oversized, report: valid.report }
      ]
    }),
    (error) => assertAssemblyError(
      error,
      "ORDERED_SLIDE_ASSEMBLY_SOURCE_MISMATCH",
      "/slides/1/archiveBytes"
    )
  );
  assert.equal(getterCalls, 0);
});

test("ordered assembly option introspection failures stay inside its error boundary", () => {
  const options = Proxy.revocable({ slides: [] }, {});
  options.revoke();
  assert.throws(
    () => assembleOrderedSlideDeck(options.proxy),
    (error) => assertAssemblyError(
      error,
      "ORDERED_SLIDE_ASSEMBLY_ARGUMENT_INVALID",
      "/options"
    )
  );
});

test("ordered assembly rejects twelve slides before inspecting any artifact", () => {
  let reportReads = 0;
  const slides = Array.from({ length: 12 }, () => {
    const entry = { archiveBytes: new Uint8Array([1]) };
    Object.defineProperty(entry, "report", {
      enumerable: true,
      get() {
        reportReads += 1;
        throw new Error("report-must-not-be-read");
      }
    });
    return entry;
  });
  assert.throws(
    () => assembleOrderedSlideDeck({ slides }),
    (error) => assertAssemblyError(
      error,
      "ORDERED_SLIDE_ASSEMBLY_ARGUMENT_INVALID",
      "/slides/length"
    )
  );
  assert.equal(reportReads, 0);
});

test("the rebuilt deck passes secure ingestion and create-only publication", async () => {
  const result = buildStory();
  const view = buildSecureTemplatePackageView({
    sourceLocation: path.resolve("/ordered-story.pptx"),
    archiveBytes: result.archiveBytes
  });
  assert.equal(view.templateFormat, "pptx");
  assert.equal(view.presentation.slideReferences.length, 3);
  assert.equal(view.slides.length, 3);

  const directory = await mkdtemp(path.join(os.tmpdir(), "ordered-story-publication-"));
  const canonicalDirectory = await realpath(directory);
  const destination = path.join(canonicalDirectory, "story.pptx");
  try {
    const publication = await publishCreateOnlyPresentation({
      archiveBytes: result.archiveBytes,
      destinationPath: destination
    });
    assert.equal(publication.sha256, result.report.outputSha256);
    assert.deepEqual(await readFile(destination), result.archiveBytes);
    await assert.rejects(
      publishCreateOnlyPresentation({
        archiveBytes: result.archiveBytes,
        destinationPath: destination
      }),
      (error) => error?.code === "ASSEMBLY_OUTPUT_EXISTS"
    );
  } finally {
    await rm(canonicalDirectory, { recursive: true, force: true });
  }
});

test("generic ordered candidate bundle preserves complete slide order and source identity", async () => {
  const result = buildStory();
  const firstDirectory = await realpath(await mkdtemp(
    path.join(os.tmpdir(), "ordered-story-candidate-one-")
  ));
  const secondDirectory = await realpath(await mkdtemp(
    path.join(os.tmpdir(), "ordered-story-candidate-two-")
  ));
  const fileName = "story.pptx";
  const firstDestination = path.join(firstDirectory, fileName);
  const secondDestination = path.join(secondDirectory, fileName);
  const firstRecordPath = path.join(firstDirectory, "story.candidate.json");
  const secondRecordPath = path.join(secondDirectory, "story.candidate.json");
  try {
    const first = await writeAuthenticatedOrderedCandidateBundle({
      artifact: { archiveBytes: result.archiveBytes, report: result.report },
      destinationPath: firstDestination
    });
    const second = await writeAuthenticatedOrderedCandidateBundle({
      artifact: { archiveBytes: result.archiveBytes, report: result.report },
      destinationPath: secondDestination
    });
    const [candidateBytes, firstRecordBytes, secondRecordBytes] = await Promise.all([
      readFile(firstDestination),
      readFile(firstRecordPath),
      readFile(secondRecordPath)
    ]);
    const verified = verifyCandidateBuildRecord({
      candidateBytes,
      recordBytes: firstRecordBytes,
      candidateFileName: fileName
    });
    assert.equal(first.verificationProfile, "authenticated-ordered-candidate-artifact");
    assert.equal(first.sourceVerificationProfile, "secure-generic-ordered-output");
    assert.equal(first.deliveryEligible, false);
    assert.deepEqual(first, second);
    assert.ok(firstRecordBytes.equals(secondRecordBytes));
    assert.equal(
      verified.record.deck.slides.every((slide) =>
        slide.sourceBuild.buildType === "clone-fill-source"),
      true
    );
    assert.equal(verified.record.baseArtifactSha256, result.report.slides[0].sourceArtifactSha256);
    assert.deepEqual(
      verified.record.deck.slides.map((slide) => [
        slide.order,
        slide.slideId,
        slide.sourceArtifactSha256,
        slide.sourceBuild.buildType
      ]),
      result.report.slides.map((slide) => [
        slide.order,
        slide.outputSlideId,
        slide.sourceArtifactSha256,
        "clone-fill-source"
      ])
    );
    assert.deepEqual(verified.record.deck.diff, result.report.diff);
    assert.equal(firstRecordBytes.includes(Buffer.from(firstDirectory)), false);

    const tamperedCandidate = Buffer.from(candidateBytes);
    tamperedCandidate[0] ^= 0xff;
    assert.throws(
      () => verifyCandidateBuildRecord({
        candidateBytes: tamperedCandidate,
        recordBytes: firstRecordBytes,
        candidateFileName: fileName
      }),
      (error) => error?.code === "CANDIDATE_BUILD_RECORD_ARTIFACT_MISMATCH" &&
        error?.pointer === "/output/sha256"
    );
  } finally {
    await Promise.all([
      rm(firstDirectory, { recursive: true, force: true }),
      rm(secondDirectory, { recursive: true, force: true })
    ]);
  }
});
