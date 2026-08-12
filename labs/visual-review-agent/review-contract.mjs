export const VISUAL_REVIEW_CONTRACT_VERSION = "0.1.0";

const AGGREGATION_VERSION = "0.1.0";
const MAX_SLIDES = 256;
const MAX_SLIDE_FINDINGS = 32;
const MAX_DECK_FINDINGS = 64;
const MAX_TOTAL_FINDINGS = 3 * (MAX_DECK_FINDINGS + (MAX_SLIDES * MAX_SLIDE_FINDINGS));
const MAX_CLUSTER_COMPARISONS = 100_000;
const REGION_IOU_THRESHOLD = 0.4;

const SEVERITIES = new Set(["blocker", "major", "minor"]);
const CRITERIA = new Set([
  "composition",
  "contrast",
  "cross-slide-consistency",
  "data-viz-integrity",
  "decorative-semantic-fit",
  "density",
  "delivery-fitness",
  "goal-alignment",
  "image-quality",
  "closing-payoff",
  "density-rhythm",
  "narrative-clarity",
  "motif-coherence",
  "opening-payoff",
  "opening-closing-payoff",
  "other",
  "overflow-clipping",
  "overlap-occlusion",
  "reference-fidelity",
  "silhouette-rhythm",
  "signature-coherence",
  "subject-conditionality",
  "typography",
  "visual-hierarchy"
]);
const ROOT_CAUSES = new Set([
  "alignment-grid-break",
  "accidental-silhouette-repetition",
  "clipped-content",
  "competing-emphasis",
  "cross-slide-role-drift",
  "distorted-or-low-resolution-image",
  "excessive-density",
  "decorative-semantic-mismatch",
  "decoration-without-semantic-function",
  "delivery-mode-mismatch",
  "delivery-density-mismatch",
  "generic-visual-language",
  "flat-density-rhythm",
  "incoherent-density-rhythm",
  "incomplete-evidence",
  "interchangeable-visual-language",
  "inconsistent-spacing",
  "insufficient-whitespace",
  "misleading-or-unclear-data-encoding",
  "missing-evidence",
  "missing-closing-payoff",
  "missing-opening-job",
  "occluded-content",
  "other-visible-cause",
  "reference-design-drift",
  "repeated-layout-silhouette",
  "random-silhouette-variation",
  "signature-disconnected-from-subject",
  "subject-motif-drift",
  "motif-role-drift",
  "text-too-small",
  "unclear-primary-message",
  "weak-contrast",
  "weak-opening-closing-payoff"
]);
const EVIDENCE_SOURCES = new Set(["crop", "full-slide", "metadata", "reference-diff"]);
const GOAL_STATUSES = new Set(["met", "partially-met", "not-met", "unable-to-judge"]);
const INPUT_STATUSES = new Set(["ok", "degraded", "unusable"]);
const REVIEW_MODES = new Set(["absolute", "compare-to-reference"]);
const SLIDE_STATUSES = new Set(["assessable", "unable-to-judge"]);
const UNASSESSED_PROPERTIES = new Set([
  "accessibility-metadata",
  "animation",
  "font-embedding",
  "native-editability",
  "ooxml-correctness",
  "speaker-notes"
]);
const SAFE_TEXT = /^(?=.*\S)(?!.*\p{Cf})(?!.*\p{Noncharacter_Code_Point})(?!.*[\uD800-\uDFFF])[^\u0000-\u001F\u007F-\u009F\u2028\u2029]+$/u;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function fail(pointer, code = "VISUAL_REVIEW_REPORT_INVALID") {
  throw new TypeError(`${code} at ${pointer}`);
}

function valuesOfClosedRecord(value, pointer, expectedKeys, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(pointer, code);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(pointer, code);

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string") || keys.length !== expectedKeys.length) {
    fail(pointer, code);
  }

  const result = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(`${pointer}/${key}`, code);
    }
    result[key] = descriptor.value;
  }
  return result;
}

function valuesOfArray(value, pointer, minimum, maximum, code) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail(pointer, code);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const lengthDescriptor = descriptors.length;
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor) ||
      !Number.isInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < minimum || lengthDescriptor.value > maximum) {
    fail(`${pointer}/length`, code);
  }
  const length = lengthDescriptor.value;
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== length + 1 || keys.some((key) => {
    if (key === "length") return false;
    if (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key)) return true;
    const index = Number(key);
    const descriptor = descriptors[key];
    return index >= length || !("value" in descriptor) || descriptor.enumerable !== true;
  })) {
    fail(pointer, code);
  }
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor)) fail(`${pointer}/${index}`, code);
    result.push(descriptor.value);
  }
  return result;
}

function assertEnum(value, allowed, pointer, code) {
  if (typeof value !== "string" || !allowed.has(value)) fail(pointer, code);
  return value;
}

function assertInteger(value, minimum, maximum, pointer, code) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) fail(pointer, code);
  return value;
}

function assertNumber(value, minimum, maximum, pointer, code) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    fail(pointer, code);
  }
  return value;
}

function assertSemanticId(value, pointer, code) {
  if (typeof value !== "string" || value.length < 1 || value.length > 96 || !SEMANTIC_ID.test(value)) {
    fail(pointer, code);
  }
  return value;
}

function assertSha256(value, pointer, code) {
  if (typeof value !== "string" || !SHA256.test(value)) fail(pointer, code);
  return value;
}

function assertSafeText(value, pointer, code, maximum = 2048) {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum * 2) {
    fail(pointer, code);
  }
  let codePoints = 0;
  for (const ignored of value) {
    void ignored;
    codePoints += 1;
    if (codePoints > maximum) fail(pointer, code);
  }
  if (!SAFE_TEXT.test(value)) fail(pointer, code);
  return value;
}

function validateStringArray(value, pointer, maximum, code, validator = assertSafeText) {
  const items = valuesOfArray(value, pointer, 0, maximum, code);
  return items.map((item, index) => validator(item, `${pointer}/${index}`, code));
}

function validateFinding(value, pointer, code) {
  const fields = valuesOfClosedRecord(value, pointer, [
    "findingId",
    "criterion",
    "rootCause",
    "severity",
    "region",
    "evidenceSource",
    "evidence",
    "impact",
    "recommendation",
    "confidence"
  ], code);
  let region = null;
  if (fields.region !== null) {
    region = valuesOfArray(fields.region, `${pointer}/region`, 4, 4, code)
      .map((item, index) => assertNumber(item, 0, 1, `${pointer}/region/${index}`, code));
  }
  return {
    findingId: assertSemanticId(fields.findingId, `${pointer}/findingId`, code),
    criterion: assertEnum(fields.criterion, CRITERIA, `${pointer}/criterion`, code),
    rootCause: assertEnum(fields.rootCause, ROOT_CAUSES, `${pointer}/rootCause`, code),
    severity: assertEnum(fields.severity, SEVERITIES, `${pointer}/severity`, code),
    region,
    evidenceSource: assertEnum(fields.evidenceSource, EVIDENCE_SOURCES, `${pointer}/evidenceSource`, code),
    evidence: assertSafeText(fields.evidence, `${pointer}/evidence`, code),
    impact: assertSafeText(fields.impact, `${pointer}/impact`, code),
    recommendation: assertSafeText(fields.recommendation, `${pointer}/recommendation`, code),
    confidence: assertNumber(fields.confidence, 0, 1, `${pointer}/confidence`, code)
  };
}

function validateReport(report, code = "VISUAL_REVIEW_REPORT_INVALID") {
  const fields = valuesOfClosedRecord(report, "", [
    "schemaVersion",
    "contractType",
    "reviewId",
    "reviewContextSha256",
    "reviewRun",
    "reviewMode",
    "inputQuality",
    "goalAssessment",
    "slides",
    "deckFindings",
    "unassessedProperties"
  ], code);
  if (fields.schemaVersion !== VISUAL_REVIEW_CONTRACT_VERSION ||
      fields.contractType !== "visual-review-report") fail("", code);

  const inputQualityFields = valuesOfClosedRecord(fields.inputQuality, "/inputQuality", [
    "status", "notes"
  ], code);
  const goalFields = valuesOfClosedRecord(fields.goalAssessment, "/goalAssessment", [
    "status", "evidence"
  ], code);
  const slideValues = valuesOfArray(fields.slides, "/slides", 1, MAX_SLIDES, code);
  const slides = slideValues.map((slide, index) => {
    const pointer = `/slides/${index}`;
    const slideFields = valuesOfClosedRecord(slide, pointer, [
      "slideId", "slideNumber", "assessmentStatus", "visibleSummary", "findings"
    ], code);
    return {
      slideId: assertSemanticId(slideFields.slideId, `${pointer}/slideId`, code),
      slideNumber: assertInteger(slideFields.slideNumber, 1, MAX_SLIDES, `${pointer}/slideNumber`, code),
      assessmentStatus: assertEnum(slideFields.assessmentStatus, SLIDE_STATUSES, `${pointer}/assessmentStatus`, code),
      visibleSummary: assertSafeText(slideFields.visibleSummary, `${pointer}/visibleSummary`, code),
      findings: valuesOfArray(slideFields.findings, `${pointer}/findings`, 0, MAX_SLIDE_FINDINGS, code)
        .map((finding, findingIndex) => validateFinding(finding, `${pointer}/findings/${findingIndex}`, code))
    };
  });
  const deckFindings = valuesOfArray(fields.deckFindings, "/deckFindings", 0, MAX_DECK_FINDINGS, code)
    .map((finding, index) => validateFinding(finding, `/deckFindings/${index}`, code));
  const unassessedProperties = validateStringArray(
    fields.unassessedProperties,
    "/unassessedProperties",
    6,
    code,
    assertUnassessedProperty
  );
  if (new Set(unassessedProperties).size !== unassessedProperties.length) {
    fail("/unassessedProperties", code);
  }

  return {
    schemaVersion: fields.schemaVersion,
    contractType: fields.contractType,
    reviewId: assertSemanticId(fields.reviewId, "/reviewId", code),
    reviewContextSha256: assertSha256(fields.reviewContextSha256, "/reviewContextSha256", code),
    reviewRun: assertInteger(fields.reviewRun, 1, 3, "/reviewRun", code),
    reviewMode: assertEnum(fields.reviewMode, REVIEW_MODES, "/reviewMode", code),
    inputQuality: {
      status: assertEnum(inputQualityFields.status, INPUT_STATUSES, "/inputQuality/status", code),
      notes: validateStringArray(inputQualityFields.notes, "/inputQuality/notes", 16, code)
    },
    goalAssessment: {
      status: assertEnum(goalFields.status, GOAL_STATUSES, "/goalAssessment/status", code),
      evidence: validateStringArray(goalFields.evidence, "/goalAssessment/evidence", 16, code)
    },
    slides,
    deckFindings,
    unassessedProperties
  };
}

function assertUnassessedProperty(value, pointer, code) {
  return assertEnum(value, UNASSESSED_PROPERTIES, pointer, code);
}

function findingsFromValidated(report) {
  const findings = report.deckFindings.map((finding) => ({ scope: "deck", slideId: null, finding }));
  for (const slide of report.slides) {
    for (const finding of slide.findings) {
      findings.push({ scope: "slide", slideId: slide.slideId, finding });
    }
  }
  return findings;
}

function deriveFromValidated(report) {
  const findings = findingsFromValidated(report).map((entry) => entry.finding);
  const hasBlocker = findings.some((finding) => finding.severity === "blocker");
  const hasMajor = findings.some((finding) => finding.severity === "major");

  if (hasBlocker || report.goalAssessment.status === "not-met") return "fail";
  if (report.inputQuality.status === "unusable" ||
      report.goalAssessment.status === "unable-to-judge" ||
      report.slides.some((slide) => slide.assessmentStatus === "unable-to-judge")) {
    return "unable-to-judge";
  }
  if (hasMajor || report.inputQuality.status === "degraded" ||
      report.goalAssessment.status === "partially-met") {
    return "revise";
  }
  return "pass";
}

/**
 * Derive the delivery decision from model-observed evidence. A model never
 * assigns its own final verdict, and degraded evidence can never produce pass.
 */
export function deriveVisualReviewVerdict(report) {
  return deriveFromValidated(validateReport(report));
}

export function summarizeVisualReview(report) {
  const validated = validateReport(report);
  const counts = { blocker: 0, major: 0, minor: 0 };
  for (const { finding } of findingsFromValidated(validated)) counts[finding.severity] += 1;
  return Object.freeze({
    verdict: deriveFromValidated(validated),
    counts: Object.freeze(counts)
  });
}

function compareKeys(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function regionKey(region) {
  return JSON.stringify(region === null ? null : region.map((value) => Object.is(value, -0) ? 0 : value));
}

function semanticFindingKey(entry) {
  return JSON.stringify([entry.scope, entry.slideId, entry.finding.criterion, entry.finding.rootCause]);
}

function canonicalNodeKey(node) {
  const finding = node.finding;
  return JSON.stringify([
    semanticFindingKey(node),
    regionKey(finding.region),
    String(node.run),
    finding.findingId,
    finding.severity,
    finding.evidenceSource,
    finding.evidence,
    finding.impact,
    finding.recommendation,
    String(finding.confidence)
  ]);
}

function regionsAreSimilar(left, right) {
  if (left === null || right === null) return left === null && right === null;
  const leftArea = left[2] * left[3];
  const rightArea = right[2] * right[3];
  const intersectionWidth = Math.max(0, Math.min(left[0] + left[2], right[0] + right[2]) - Math.max(left[0], right[0]));
  const intersectionHeight = Math.max(0, Math.min(left[1] + left[3], right[1] + right[3]) - Math.max(left[1], right[1]));
  const intersection = intersectionWidth * intersectionHeight;
  const union = leftArea + rightArea - intersection;
  if (union === 0) return regionKey(left) === regionKey(right);
  return intersection / union >= REGION_IOU_THRESHOLD;
}

function clusterFindings(reports) {
  const groups = new Map();
  let totalFindings = 0;
  for (const report of reports) {
    for (const entry of findingsFromValidated(report)) {
      totalFindings += 1;
      if (totalFindings > MAX_TOTAL_FINDINGS) fail("/reports", "VISUAL_REVIEW_AGGREGATION_INVALID");
      const node = { ...entry, run: report.reviewRun };
      const key = semanticFindingKey(node);
      const group = groups.get(key) ?? [];
      group.push(node);
      groups.set(key, group);
    }
  }

  const clusters = [];
  let comparisons = 0;
  for (const [semanticKey, unsortedNodes] of [...groups].sort(([left], [right]) => compareKeys(left, right))) {
    const nodes = [...unsortedNodes].sort((left, right) => compareKeys(canonicalNodeKey(left), canonicalNodeKey(right)));
    const components = [];
    for (const node of nodes) {
      let destination = null;
      for (const component of components) {
        if (component.some((member) => member.run === node.run)) continue;
        let compatible = true;
        for (const member of component) {
          comparisons += 1;
          if (comparisons > MAX_CLUSTER_COMPARISONS) {
            fail("/reports/findings", "VISUAL_REVIEW_AGGREGATION_INVALID");
          }
          if (!regionsAreSimilar(member.finding.region, node.finding.region)) {
            compatible = false;
            break;
          }
        }
        if (compatible) {
          destination = component;
          break;
        }
      }
      if (destination === null) components.push([node]);
      else destination.push(node);
    }

    for (const component of components) {
      const byRun = new Map(component.map((node) => [node.run, node.finding]));
      const first = component[0];
      clusters.push({
        key: JSON.stringify([semanticKey, canonicalNodeKey(first)]),
        scope: first.scope,
        slideId: first.slideId,
        byRun
      });
    }
  }
  return clusters.sort((left, right) => compareKeys(left.key, right.key));
}

function copyFinding(finding, severity = finding.severity) {
  return Object.freeze({
    ...finding,
    severity,
    region: finding.region === null ? null : Object.freeze([...finding.region])
  });
}

function validateAggregationIdentity(reports, expectedContextSha256) {
  const first = reports[0];
  for (let index = 0; index < reports.length; index += 1) {
    const report = reports[index];
    if (report.reviewRun !== index + 1 || report.reviewId !== first.reviewId ||
        report.reviewMode !== first.reviewMode || report.reviewContextSha256 !== expectedContextSha256 ||
        report.slides.length !== first.slides.length) {
      fail(`/reports/${index}`, "VISUAL_REVIEW_AGGREGATION_INVALID");
    }
    for (let slideIndex = 0; slideIndex < report.slides.length; slideIndex += 1) {
      const slide = report.slides[slideIndex];
      const expected = first.slides[slideIndex];
      if (slide.slideId !== expected.slideId || slide.slideNumber !== expected.slideNumber) {
        fail(`/reports/${index}/slides/${slideIndex}`, "VISUAL_REVIEW_AGGREGATION_INVALID");
      }
    }
  }
}

function validateAggregationOptions(value) {
  const fields = valuesOfClosedRecord(value, "/options", [
    "expectedReviewContextSha256", "expectedBlockerCrops", "blockerFollowUps"
  ], "VISUAL_REVIEW_AGGREGATION_INVALID");
  return {
    expectedReviewContextSha256: assertSha256(
      fields.expectedReviewContextSha256,
      "/options/expectedReviewContextSha256",
      "VISUAL_REVIEW_AGGREGATION_INVALID"
    ),
    expectedBlockerCrops: validateExpectedBlockerCrops(fields.expectedBlockerCrops),
    blockerFollowUps: fields.blockerFollowUps
  };
}

function validateExpectedBlockerCrops(value) {
  const records = valuesOfArray(
    value,
    "/options/expectedBlockerCrops",
    0,
    MAX_TOTAL_FINDINGS,
    "VISUAL_REVIEW_AGGREGATION_INVALID"
  );
  const byId = new Map();
  for (let index = 0; index < records.length; index += 1) {
    const pointer = `/options/expectedBlockerCrops/${index}`;
    const fields = valuesOfClosedRecord(records[index], pointer, [
      "blockerId", "cropSha256"
    ], "VISUAL_REVIEW_AGGREGATION_INVALID");
    const blockerId = assertSemanticId(fields.blockerId, `${pointer}/blockerId`, "VISUAL_REVIEW_AGGREGATION_INVALID");
    if (byId.has(blockerId)) fail(`${pointer}/blockerId`, "VISUAL_REVIEW_AGGREGATION_INVALID");
    byId.set(blockerId, assertSha256(
      fields.cropSha256,
      `${pointer}/cropSha256`,
      "VISUAL_REVIEW_AGGREGATION_INVALID"
    ));
  }
  return byId;
}

function validateBlockerFollowUps(value, expectedContextSha256, expectedCrops) {
  const followUps = valuesOfArray(
    value,
    "/options/blockerFollowUps",
    0,
    MAX_TOTAL_FINDINGS,
    "VISUAL_REVIEW_AGGREGATION_INVALID"
  );
  const byId = new Map();
  for (let index = 0; index < followUps.length; index += 1) {
    const pointer = `/options/blockerFollowUps/${index}`;
    const fields = valuesOfClosedRecord(followUps[index], pointer, [
      "blockerId",
      "reviewContextSha256",
      "followUpReviewId",
      "cropSha256",
      "resolution",
      "evidenceSource",
      "evidence",
      "confidence"
    ], "VISUAL_REVIEW_AGGREGATION_INVALID");
    const blockerId = assertSemanticId(fields.blockerId, `${pointer}/blockerId`, "VISUAL_REVIEW_AGGREGATION_INVALID");
    if (byId.has(blockerId)) fail(`${pointer}/blockerId`, "VISUAL_REVIEW_AGGREGATION_INVALID");
    const reviewContextSha256 = assertSha256(
      fields.reviewContextSha256,
      `${pointer}/reviewContextSha256`,
      "VISUAL_REVIEW_AGGREGATION_INVALID"
    );
    if (reviewContextSha256 !== expectedContextSha256) {
      fail(`${pointer}/reviewContextSha256`, "VISUAL_REVIEW_AGGREGATION_INVALID");
    }
    if (fields.evidenceSource !== "crop") {
      fail(`${pointer}/evidenceSource`, "VISUAL_REVIEW_AGGREGATION_INVALID");
    }
    const cropSha256 = assertSha256(
      fields.cropSha256,
      `${pointer}/cropSha256`,
      "VISUAL_REVIEW_AGGREGATION_INVALID"
    );
    if (!expectedCrops.has(blockerId) || expectedCrops.get(blockerId) !== cropSha256) {
      fail(`${pointer}/cropSha256`, "VISUAL_REVIEW_AGGREGATION_INVALID");
    }
    byId.set(blockerId, {
      reviewContextSha256,
      followUpReviewId: assertSemanticId(
        fields.followUpReviewId,
        `${pointer}/followUpReviewId`,
        "VISUAL_REVIEW_AGGREGATION_INVALID"
      ),
      cropSha256,
      resolution: assertEnum(
        fields.resolution,
        new Set(["confirmed", "dismissed"]),
        `${pointer}/resolution`,
        "VISUAL_REVIEW_AGGREGATION_INVALID"
      ),
      evidenceSource: "crop",
      evidence: assertSafeText(
        fields.evidence,
        `${pointer}/evidence`,
        "VISUAL_REVIEW_AGGREGATION_INVALID"
      ),
      confidence: assertNumber(fields.confidence, 0, 1, `${pointer}/confidence`, "VISUAL_REVIEW_AGGREGATION_INVALID")
    });
  }
  return byId;
}

function aggregateStatusVerdict(reports, retained) {
  if (retained.some((entry) => entry.finding.severity === "blocker") ||
      reports.filter((report) => report.goalAssessment.status === "not-met").length >= 2) {
    return "fail";
  }
  if (reports.filter((report) => report.inputQuality.status === "unusable" ||
      report.goalAssessment.status === "unable-to-judge" ||
      report.slides.some((slide) => slide.assessmentStatus === "unable-to-judge")).length >= 2) {
    return "unable-to-judge";
  }
  if (retained.some((entry) => entry.finding.severity === "major") ||
      reports.filter((report) => report.inputQuality.status !== "ok").length >= 2 ||
      reports.filter((report) => ["partially-met", "not-met"].includes(report.goalAssessment.status)).length >= 2) {
    return "revise";
  }
  return "pass";
}

function freezeFindingEntry(cluster, finding, reportingRuns) {
  return Object.freeze({
    scope: cluster.scope,
    slideId: cluster.slideId,
    reportingRuns: Object.freeze([...reportingRuns]),
    finding: copyFinding(finding)
  });
}

/**
 * Combine exactly three independent reports. Ordinary findings need support
 * from two runs. Model-reported blockers never directly authorize failure:
 * every blocker cluster first requires one explicit, deterministic follow-up.
 */
export function aggregateVisualReviewRuns(reports, options) {
  const validatedOptions = validateAggregationOptions(options);
  const reportValues = valuesOfArray(
    reports,
    "/reports",
    3,
    3,
    "VISUAL_REVIEW_AGGREGATION_INVALID"
  );
  const validatedReports = reportValues.map((report, index) => {
    try {
      return validateReport(report, "VISUAL_REVIEW_AGGREGATION_INVALID");
    } catch (error) {
      if (error instanceof TypeError) {
        throw new TypeError(error.message.replace(" at /", ` at /reports/${index}/`));
      }
      throw error;
    }
  });
  validateAggregationIdentity(validatedReports, validatedOptions.expectedReviewContextSha256);

  const clusters = clusterFindings(validatedReports);

  const blockerClusters = clusters
    .filter((cluster) => [...cluster.byRun.values()].some((finding) => finding.severity === "blocker"))
    .sort((left, right) => compareKeys(left.key, right.key));
  const blockerIndexByKey = new Map(blockerClusters.map((cluster, index) => [cluster.key, index]));
  const resolutions = validateBlockerFollowUps(
    validatedOptions.blockerFollowUps,
    validatedOptions.expectedReviewContextSha256,
    validatedOptions.expectedBlockerCrops
  );
  const blockerIds = new Set(blockerClusters.map((_, index) => `blocker-${index + 1}`));
  for (const resolutionId of resolutions.keys()) {
    if (!blockerIds.has(resolutionId)) fail("/options/blockerFollowUps", "VISUAL_REVIEW_AGGREGATION_INVALID");
  }
  for (const blockerId of validatedOptions.expectedBlockerCrops.keys()) {
    if (!blockerIds.has(blockerId)) fail("/options/expectedBlockerCrops", "VISUAL_REVIEW_AGGREGATION_INVALID");
  }

  const followUps = blockerClusters.map((cluster, index) => {
    const blockerId = `blocker-${index + 1}`;
    const blockerRuns = [...cluster.byRun]
      .filter(([, finding]) => finding.severity === "blocker")
      .map(([run]) => run)
      .sort((left, right) => left - right);
    const representative = cluster.byRun.get(blockerRuns[0]);
    const resolution = resolutions.get(blockerId);
    return Object.freeze({
      blockerId,
      scope: cluster.scope,
      slideId: cluster.slideId,
      findingId: representative.findingId,
      criterion: representative.criterion,
      rootCause: representative.rootCause,
      region: representative.region === null ? null : Object.freeze([...representative.region]),
      reportingRuns: Object.freeze(blockerRuns),
      status: resolution?.resolution ?? "pending",
      reviewContextSha256: resolution?.reviewContextSha256 ?? null,
      followUpReviewId: resolution?.followUpReviewId ?? null,
      cropSha256: resolution?.cropSha256 ?? null,
      evidenceSource: resolution?.evidenceSource ?? null,
      evidence: resolution?.evidence ?? null,
      confidence: resolution?.confidence ?? null
    });
  });

  const retained = [];
  for (const cluster of clusters) {
    const blockerIndex = blockerIndexByKey.get(cluster.key);
    if (blockerIndex !== undefined) {
      const resolution = resolutions.get(`blocker-${blockerIndex + 1}`);
      if (resolution?.resolution === "confirmed") {
        const reportingRuns = [...cluster.byRun.keys()].sort((left, right) => left - right);
        const blockerFinding = [...cluster.byRun.values()].find((finding) => finding.severity === "blocker");
        retained.push(freezeFindingEntry(cluster, { ...blockerFinding, severity: "blocker" }, reportingRuns));
      } else if (resolution?.resolution === "dismissed") {
        const ordinary = [...cluster.byRun]
          .filter(([, finding]) => finding.severity !== "blocker")
          .sort(([left], [right]) => left - right);
        if (ordinary.length >= 2) {
          const severity = ordinary.some(([, finding]) => finding.severity === "major") ? "major" : "minor";
          retained.push(freezeFindingEntry(
            cluster,
            { ...ordinary[0][1], severity },
            ordinary.map(([run]) => run)
          ));
        }
      }
      continue;
    }

    const reportsForFinding = [...cluster.byRun].sort(([left], [right]) => left - right);
    if (reportsForFinding.length >= 2) {
      const severity = reportsForFinding.some(([, finding]) => finding.severity === "major") ? "major" : "minor";
      retained.push(freezeFindingEntry(
        cluster,
        { ...reportsForFinding[0][1], severity },
        reportsForFinding.map(([run]) => run)
      ));
    }
  }

  const pending = followUps.some((followUp) => followUp.status === "pending");
  return Object.freeze({
    aggregationVersion: AGGREGATION_VERSION,
    status: pending ? "follow-up-required" : "final",
    reviewId: validatedReports[0].reviewId,
    reviewContextSha256: validatedOptions.expectedReviewContextSha256,
    reviewMode: validatedReports[0].reviewMode,
    verdict: pending ? null : aggregateStatusVerdict(validatedReports, retained),
    findings: Object.freeze(retained),
    blockerFollowUps: Object.freeze(followUps)
  });
}
