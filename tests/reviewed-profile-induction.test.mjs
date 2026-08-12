import assert from "node:assert/strict";
import test from "node:test";

import {
  REVIEWED_PROFILE_INDUCTION_VERSION,
  ReviewedProfileInductionError,
  induceCloneFillProfileProposals,
  selectAndAssembleInducedCloneFillPresentation
} from "../labs/layout-selection/reviewed-profile-induction.mjs";
import {
  SECURE_ZIP_LIMITS,
  parseSecureZip
} from "../packages/core/src/secure-zip.mjs";
import { parseStrictXml } from "../packages/core/src/strict-xml.mjs";
import {
  buildSyntheticProfileExemplars,
  decisionBrief,
  makeSyntheticProfileAcceptance,
  statusBrief
} from "./helpers/synthetic-profile-exemplars.mjs";

const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";

function proposalSetFor(exemplars = buildSyntheticProfileExemplars()) {
  return induceCloneFillProfileProposals({ exemplars });
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

function outputSlideFacts(archiveBytes) {
  const slide = parseStrictXml(parseSecureZip(archiveBytes).get("ppt/slides/slide1.xml")).root;
  return {
    text: collectNodes(slide, NS_A, "t").map((node) => node.text),
    fontSizes: collectNodes(slide, NS_A, "rPr")
      .map((node) => Number(node.attributes.get("\u0000sz")?.value))
  };
}

function assertInductionError(error, pointer) {
  assert.ok(error instanceof ReviewedProfileInductionError);
  assert.equal(error.code, "REVIEWED_PROFILE_INDUCTION_INVALID");
  assert.equal(error.pointer, pointer);
  return true;
}

test("multiple distinct source exemplars induce redacted review proposals, not semantic authority", () => {
  const proposalSet = proposalSetFor();
  assert.equal(proposalSet.inductionVersion, REVIEWED_PROFILE_INDUCTION_VERSION);
  assert.match(proposalSet.proposalSetSha256, /^[a-f0-9]{64}$/u);
  assert.equal(
    proposalSet.proposalSetSha256,
    "b151f468880c0cb5061d2040a66296720a33ead4c9a5f6b9e8ae6387dfcbd607"
  );
  assert.deepEqual(proposalSet.proposals.map((proposal) => proposal.exemplarId), [
    "ambiguous-balance",
    "decision-focus",
    "status-focus"
  ]);
  assert.equal(new Set(proposalSet.proposals.map((proposal) => proposal.templateSha256)).size, 3);
  assert.deepEqual(proposalSet.proposals.map((proposal) => proposal.proposalSha256), [
    "9e3fe2b9fbfb48de25a384359638088f221718413fc61b2ca361cb32f99b5b3e",
    "019357596169975a1fa6cca292a6bd3d02069f4c0e4acd19b3430b2adad08037",
    "023aea174863b846540b0d05e38bc1cff25f52965688f30ce735b059df672f5b"
  ]);

  const decision = proposalSet.proposals.find((proposal) => proposal.exemplarId === "decision-focus");
  const status = proposalSet.proposals.find((proposal) => proposal.exemplarId === "status-focus");
  const ambiguous = proposalSet.proposals.find((proposal) => proposal.exemplarId === "ambiguous-balance");
  assert.equal(decision.hierarchyConfidence, "clear");
  assert.equal(status.hierarchyConfidence, "clear");
  assert.equal(ambiguous.hierarchyConfidence, "ambiguous");
  assert.deepEqual(decision.candidates.map((candidate) => [
    candidate.sourceShapeKey,
    candidate.salienceRank,
    candidate.typography.fontSizeHundredths,
    candidate.suggestedRole
  ]), [
    ["shape-1", 1, 4400, "takeaway"],
    ["shape-2", 2, 2000, "evidence"]
  ]);
  assert.deepEqual(status.candidates.map((candidate) => [
    candidate.sourceShapeKey,
    candidate.salienceRank,
    candidate.typography.fontSizeHundredths
  ]), [
    ["shape-1", 2, 2400],
    ["shape-2", 1, 4800]
  ]);
  const serialized = JSON.stringify(proposalSet);
  assert.equal(serialized.includes("Synthetic Fixture"), false);
  assert.equal(serialized.includes("Repository-owned text-only OOXML"), false);
  assert.equal(serialized.includes("Synthetic Sans"), false);
  assert.ok(Object.isFrozen(proposalSet));
  assert.ok(Object.isFrozen(proposalSet.proposals[0].candidates[0].typography));
});

test("proposal hashes and ordering are independent of caller exemplar order", () => {
  const exemplars = buildSyntheticProfileExemplars();
  const forward = proposalSetFor(exemplars);
  const reversed = proposalSetFor([...exemplars].reverse());
  assert.deepEqual(reversed, forward);
});

test("reviewed decision profile selects its own source and preserves the stronger action hierarchy", () => {
  const exemplars = buildSyntheticProfileExemplars();
  const proposalSet = proposalSetFor(exemplars);
  const result = selectAndAssembleInducedCloneFillPresentation({
    exemplars,
    acceptance: makeSyntheticProfileAcceptance(),
    brief: decisionBrief,
    outputSlideId: "induced-decision-slide"
  });
  assert.equal(result.selectedExemplarId, "decision-focus");
  assert.equal(result.selection.selected.layoutId, "decision-focus-layout");
  assert.deepEqual(result.planTrace.fills.map((fill) => [
    fill.role,
    fill.sourceShapeKey,
    fill.paragraphs[0]
  ]), [
    ["body", "shape-2", "3/3 aligned — Independent reviews"],
    ["title", "shape-1", "Approve a limited pilot now"]
  ]);
  assert.deepEqual(outputSlideFacts(result.archiveBytes), {
    text: ["Approve a limited pilot now", "3/3 aligned — Independent reviews"],
    fontSizes: [4400, 2000]
  });
  assert.equal(result.report.diff.collateralChanges.length, 0);
});

test("reviewed status profile can promote a later source shape without confusing source order", () => {
  const exemplars = buildSyntheticProfileExemplars();
  const proposalSet = proposalSetFor(exemplars);
  const result = selectAndAssembleInducedCloneFillPresentation({
    exemplars,
    acceptance: makeSyntheticProfileAcceptance(),
    brief: statusBrief,
    outputSlideId: "induced-status-slide"
  });
  assert.equal(result.selectedExemplarId, "status-focus");
  assert.equal(result.selection.selected.layoutId, "status-focus-layout");
  assert.deepEqual(result.planTrace.fills.map((fill) => [fill.role, fill.sourceShapeKey]), [
    ["body", "shape-1"],
    ["title", "shape-2"]
  ]);
  assert.deepEqual(outputSlideFacts(result.archiveBytes), {
    text: ["Two final checks remain", "87% — Controls ready"],
    fontSizes: [2400, 4800]
  });
  const primaryTrace = result.trace.slots.find((slot) => slot.cloneFillRole === "title");
  assert.equal(primaryTrace.sourceShapeKey, "shape-2");
  assert.ok(primaryTrace.regionMillionths[1] < 200_000);
});

test("cross-source selection and assembly are deterministic while distinct profiles stay distinct", () => {
  const exemplars = buildSyntheticProfileExemplars();
  const proposalSet = proposalSetFor(exemplars);
  const acceptance = makeSyntheticProfileAcceptance();
  const decisionFirst = selectAndAssembleInducedCloneFillPresentation({
    exemplars,
    acceptance,
    brief: decisionBrief,
    outputSlideId: "stable-decision-output"
  });
  const decisionSecond = selectAndAssembleInducedCloneFillPresentation({
    exemplars: [...exemplars].reverse(),
    acceptance: structuredClone(acceptance),
    brief: structuredClone(decisionBrief),
    outputSlideId: "stable-decision-output"
  });
  const status = selectAndAssembleInducedCloneFillPresentation({
    exemplars,
    acceptance,
    brief: statusBrief,
    outputSlideId: "stable-status-output"
  });
  assert.deepEqual(decisionSecond, decisionFirst);
  assert.notEqual(decisionFirst.report.outputSha256, status.report.outputSha256);
  assert.notDeepEqual(decisionFirst.trace.slots, status.trace.slots);
});

test("every inferred exemplar needs a hash-bound accepted or rejected review decision", () => {
  const exemplars = buildSyntheticProfileExemplars();
  const proposalSet = proposalSetFor(exemplars);
  const missing = makeSyntheticProfileAcceptance();
  missing.decisions.pop();
  assert.throws(
    () => selectAndAssembleInducedCloneFillPresentation({
      exemplars,
      acceptance: missing,
      brief: decisionBrief,
      outputSlideId: "missing-review-output"
    }),
    (error) => assertInductionError(error, "/acceptance/decisions/length")
  );

  const stale = makeSyntheticProfileAcceptance();
  stale.proposalSetSha256 = "0".repeat(64);
  assert.throws(
    () => selectAndAssembleInducedCloneFillPresentation({
      exemplars,
      acceptance: stale,
      brief: decisionBrief,
      outputSlideId: "stale-review-output"
    }),
    (error) => assertInductionError(error, "/acceptance")
  );
});

test("ambiguous hierarchy cannot be silently promoted and capacity cannot exceed inferred geometry", () => {
  const exemplars = buildSyntheticProfileExemplars();
  const proposalSet = proposalSetFor(exemplars);
  const ambiguousProposal = proposalSet.proposals.find((proposal) =>
    proposal.exemplarId === "ambiguous-balance");
  const ambiguous = makeSyntheticProfileAcceptance();
  const decision = ambiguous.decisions.find((item) => item.exemplarId === "ambiguous-balance");
  const primary = ambiguousProposal.candidates.find((candidate) => candidate.salienceRank === 1);
  const supporting = ambiguousProposal.candidates.find((candidate) => candidate.salienceRank === 2);
  decision.status = "accepted";
  decision.reasonCode = null;
  decision.profile = {
    layoutId: "ambiguous-layout",
    sourceSlideKey: ambiguousProposal.sourceSlideKey,
    functions: ["decision"],
    slots: [
      {
        slotId: "ambiguous-primary",
        candidateId: primary.candidateId,
        sourceShapeKey: primary.sourceShapeKey,
        visualRole: "primary",
        cloneFillRole: "title",
        acceptsRoles: ["takeaway"],
        kind: "text",
        minUnits: 1,
        maxUnits: 1,
        capacity: { maxChars: 40 }
      },
      {
        slotId: "ambiguous-supporting",
        candidateId: supporting.candidateId,
        sourceShapeKey: supporting.sourceShapeKey,
        visualRole: "supporting",
        cloneFillRole: "body",
        acceptsRoles: ["evidence"],
        kind: "metric",
        minUnits: 1,
        maxUnits: 1,
        capacity: { maxChars: 40 }
      }
    ]
  };
  assert.throws(
    () => selectAndAssembleInducedCloneFillPresentation({
      exemplars,
      acceptance: ambiguous,
      brief: decisionBrief,
      outputSlideId: "ambiguous-review-output"
    }),
    (error) => assertInductionError(error, "/acceptance/decisions/2/profile")
  );

  const overCapacity = makeSyntheticProfileAcceptance();
  const decisionProposal = proposalSet.proposals.find((proposal) =>
    proposal.exemplarId === "decision-focus");
  const acceptedDecision = overCapacity.decisions.find((item) =>
    item.exemplarId === "decision-focus");
  acceptedDecision.profile.slots[0].capacity.maxChars =
    decisionProposal.candidates.find((candidate) => candidate.salienceRank === 1)
      .estimatedMaxChars + 1;
  assert.throws(
    () => selectAndAssembleInducedCloneFillPresentation({
      exemplars,
      acceptance: overCapacity,
      brief: decisionBrief,
      outputSlideId: "over-capacity-output"
    }),
    (error) => assertInductionError(
      error,
      "/acceptance/decisions/0/profile/slots/0/capacity/maxChars"
    )
  );
});

test("source bytes, exact indexes, and reviews cannot be mixed across exemplars", () => {
  const exemplars = buildSyntheticProfileExemplars();
  const mismatched = structuredClone(exemplars);
  mismatched[0].sourceArchiveBytes = Buffer.from(exemplars[1].sourceArchiveBytes);
  assert.throws(
    () => induceCloneFillProfileProposals({ exemplars: mismatched }),
    (error) => assertInductionError(error, "/exemplars/0/templateIndex")
  );

  const oversized = buildSyntheticProfileExemplars();
  let lyingLengthHits = 0;
  const oversizedBytes = new Uint8Array(SECURE_ZIP_LIMITS.maxArchiveBytes + 1);
  Object.defineProperty(oversizedBytes, "byteLength", {
    configurable: true,
    get() {
      lyingLengthHits += 1;
      return 1;
    }
  });
  oversized[0].sourceArchiveBytes = oversizedBytes;
  assert.throws(
    () => induceCloneFillProfileProposals({ exemplars: oversized }),
    (error) => assertInductionError(error, "/exemplars/0/sourceArchiveBytes")
  );
  assert.equal(lyingLengthHits, 0);

  const guarded = buildSyntheticProfileExemplars();
  let metadataGetterHits = 0;
  for (const key of ["buffer", "byteLength", "byteOffset"]) {
    Object.defineProperty(guarded[0].sourceArchiveBytes, key, {
      configurable: true,
      get() {
        metadataGetterHits += 1;
        return null;
      }
    });
  }
  assert.equal(
    induceCloneFillProfileProposals({ exemplars: guarded }).proposalSetSha256,
    "b151f468880c0cb5061d2040a66296720a33ead4c9a5f6b9e8ae6387dfcbd607"
  );
  assert.equal(metadataGetterHits, 0);
});

test("template-index capture fails closed before recursive input can exhaust the call stack", () => {
  const exemplars = buildSyntheticProfileExemplars();
  let nested = Object.create(null);
  for (let depth = 0; depth < 256; depth += 1) nested = { child: nested };
  exemplars[0].templateIndex.masters = nested;
  assert.throws(
    () => induceCloneFillProfileProposals({ exemplars }),
    (error) => {
      assert.ok(error instanceof ReviewedProfileInductionError);
      assert.equal(error.code, "REVIEWED_PROFILE_INDUCTION_INVALID");
      assert.match(error.pointer, /^\/exemplars\/0\/templateIndex\/masters/u);
      return true;
    }
  );
});

test("top-level, exemplar, and acceptance accessors are rejected without invocation", () => {
  const exemplars = buildSyntheticProfileExemplars();
  let invoked = false;
  const inductionOptions = { exemplars };
  Object.defineProperty(inductionOptions, "exemplars", {
    enumerable: true,
    get() {
      invoked = true;
      return exemplars;
    }
  });
  assert.throws(
    () => induceCloneFillProfileProposals(inductionOptions),
    (error) => assertInductionError(error, "/options/exemplars")
  );
  assert.equal(invoked, false);

  const proposalSet = proposalSetFor(exemplars);
  const acceptance = makeSyntheticProfileAcceptance();
  Object.defineProperty(acceptance, "proposalSetSha256", {
    enumerable: true,
    get() {
      invoked = true;
      return proposalSet.proposalSetSha256;
    }
  });
  assert.throws(
    () => selectAndAssembleInducedCloneFillPresentation({
      exemplars,
      acceptance,
      brief: decisionBrief,
      outputSlideId: "accessor-output"
    }),
    (error) => assertInductionError(error, "/acceptance/proposalSetSha256")
  );
  assert.equal(invoked, false);
});
