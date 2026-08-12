import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const FINAL_DOCUMENT_PATHS = Object.freeze([
  "README.md",
  "CHANGELOG.md",
  "docs/ARCHITECTURE_TARGET.md",
  "docs/COMPATIBILITY_POLICY.md",
  "docs/KNOWN_LIMITATIONS.md",
  "docs/RELEASE_GATES.md",
  "docs/REPRODUCIBILITY.md",
  "docs/SUPPORT_MATRIX.md",
  "docs/M3-004_HANDOFF.md",
  "docs/releases/0.1.0-alpha.1.md",
  "packages/cli/README.md",
  "packages/core/README.md",
  "packages/public-synthetic/README.md",
  "plugins/native-card-arrow/README.md"
]);

const HOSTED_RUN_IDS = Object.freeze([
  "31600528716",
  "31600528742",
  "31600806512",
  "31600806350"
]);

const ORDERED_SECTION_CHAINS = Object.freeze({
  "README.md": Object.freeze([
    "## Purpose and current boundary",
    "## Fact ownership",
    "## Executable flow",
    "## Packages and contracts",
    "## Public evidence",
    "## Limitations",
    "## Next authorized action"
  ]),
  "docs/ARCHITECTURE_TARGET.md": Object.freeze([
    "## Purpose and boundary",
    "## Fact ownership",
    "## Data and control flow",
    "## Executable components and dependency direction",
    "## Contracts",
    "## Evidence and support state",
    "## Limitations and trust assumptions",
    "## Next authorized action"
  ]),
  "docs/COMPATIBILITY_POLICY.md": Object.freeze([
    "## Purpose and boundary",
    "## Fact ownership",
    "## Fail-closed resolution flow",
    "## Executable capability contract",
    "## Evidence and status changes",
    "## Current limitations and next action"
  ]),
  "docs/SUPPORT_MATRIX.md": Object.freeze([
    "## Purpose and boundary",
    "## Fact ownership",
    "## Executable candidate flow",
    "## Current matrix",
    "## Status and resolution contract",
    "## Public evidence",
    "## Limitations",
    "## Next authorized action"
  ]),
  "docs/RELEASE_GATES.md": Object.freeze([
    "## Purpose and boundary",
    "## Fact ownership",
    "## Release data and control flow",
    "## G3 — Capability correctness",
    "## Public evidence",
    "## Limitations and next authorized action"
  ]),
  "docs/releases/0.1.0-alpha.1.md": Object.freeze([
    "## Purpose and boundary",
    "## Fact ownership",
    "## What the candidate contains",
    "## Candidate flow",
    "## Executable contracts",
    "## Public evidence",
    "## Limitations",
    "## Publication status and next authorized action"
  ]),
  "packages/cli/README.md": Object.freeze([
    "## Purpose and boundary", "## Fact ownership and dependency flow",
    "## Executable contract", "## Evidence", "## Limitations",
    "## Next authorized action", "## License"
  ]),
  "packages/core/README.md": Object.freeze([
    "## Purpose and boundary", "## Fact ownership and dependency flow",
    "## Executable contract", "## Evidence", "## Limitations",
    "## Next authorized action", "## License"
  ]),
  "packages/public-synthetic/README.md": Object.freeze([
    "## Purpose and boundary", "## Fact ownership and dependency flow",
    "## Executable contract", "## Evidence", "## Limitations",
    "## Next authorized action", "## License"
  ]),
  "plugins/native-card-arrow/README.md": Object.freeze([
    "## Purpose and boundary", "## Fact ownership and dependency flow",
    "## Executable contract", "## Evidence", "## Limitations",
    "## Next authorized action", "## License"
  ])
});

const README_OWNER_LINK_TARGETS = Object.freeze([
  "docs/ARCHITECTURE_TARGET.md",
  "docs/COMPATIBILITY_POLICY.md",
  "docs/KNOWN_LIMITATIONS.md",
  "docs/RELEASE_GATES.md",
  "docs/REPRODUCIBILITY.md",
  "docs/SUPPORT_MATRIX.md",
  "docs/releases/0.1.0-alpha.1.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "GOVERNANCE.md",
  "SECURITY.md"
]);

const EVIDENCE_PROJECTION_PATHS = Object.freeze([
  "README.md",
  "CHANGELOG.md",
  "docs/ARCHITECTURE_TARGET.md",
  "docs/RELEASE_GATES.md",
  "docs/REPRODUCIBILITY.md",
  "docs/SUPPORT_MATRIX.md",
  "docs/M3-004_HANDOFF.md",
  "docs/releases/0.1.0-alpha.1.md"
]);

const BLOCKED_QA_PATHS = Object.freeze([
  "README.md",
  "CHANGELOG.md",
  "docs/ARCHITECTURE_TARGET.md",
  "docs/KNOWN_LIMITATIONS.md",
  "docs/RELEASE_GATES.md",
  "docs/REPRODUCIBILITY.md",
  "docs/SUPPORT_MATRIX.md",
  "docs/releases/0.1.0-alpha.1.md"
]);

const documents = new Map(await Promise.all(FINAL_DOCUMENT_PATHS.map(async (relativePath) => [
  relativePath,
  await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8")
])));
const supportMatrix = JSON.parse(await readFile(
  new URL("../policy/support-matrix.json", import.meta.url),
  "utf8"
));
const packagePlan = JSON.parse(await readFile(
  new URL("../packaging/alpha-package-plan.json", import.meta.url),
  "utf8"
));

function finding(code, path) {
  return Object.freeze({ code, path });
}

function prose(text) {
  return text.replace(/[*_`]/gu, "").replace(/\s+/gu, " ").trim();
}

function hasOrderedSections(text, headings) {
  let cursor = -1;
  for (const heading of headings) {
    const index = text.indexOf(`${heading}\n`);
    if (index <= cursor) return false;
    cursor = index;
  }
  return true;
}

function supportCounts(matrixDocument) {
  const counts = { supported: 0, experimental: 0, manual: 0, unsupported: 0 };
  const dimensions = matrixDocument?.dimensions;
  if (typeof dimensions !== "object" || dimensions === null || Array.isArray(dimensions)) {
    return null;
  }
  for (const items of Object.values(dimensions)) {
    if (!Array.isArray(items)) return null;
    for (const item of items) {
      if (!Object.hasOwn(counts, item?.status)) return null;
      counts[item.status] += 1;
    }
  }
  return counts;
}

function validateFinalPublicDocuments(files, matrixDocument, packageDocument) {
  if (!(files instanceof Map) || typeof matrixDocument !== "object" ||
      matrixDocument === null || typeof packageDocument !== "object" ||
      packageDocument === null) {
    return Object.freeze([finding("final-doc-input", "")]);
  }

  const findings = [];
  const actualPaths = [...files.keys()].sort();
  const expectedPaths = [...FINAL_DOCUMENT_PATHS].sort();
  if (actualPaths.length !== expectedPaths.length ||
      actualPaths.some((value, index) => value !== expectedPaths[index])) {
    findings.push(finding("final-doc-inventory", ""));
  }

  for (const [relativePath, headings] of Object.entries(ORDERED_SECTION_CHAINS)) {
    if (!hasOrderedSections(files.get(relativePath) ?? "", headings)) {
      findings.push(finding("final-doc-constructive-order", relativePath));
    }
  }

  const alphaGraph = packageDocument.packages.map((item) => [
    item.name,
    item.dependencies.map(({ packageId }) => packageDocument.packages
      .find((candidate) => candidate.packageId === packageId)?.name)
  ]);
  const expectedGraph = [
    ["pptx-compiler", ["pptx-compiler-core", "pptx-compiler-native-card-arrow",
      "pptx-compiler-public-synthetic"]],
    ["pptx-compiler-core", []],
    ["pptx-compiler-native-card-arrow", ["pptx-compiler-core"]],
    ["pptx-compiler-public-synthetic", []]
  ];
  if (JSON.stringify(alphaGraph) !== JSON.stringify(expectedGraph) ||
      !files.get("README.md")?.includes("pptx-compiler-native-card-arrow --> pptx-compiler-core") ||
      !files.get("docs/ARCHITECTURE_TARGET.md")?.includes("`-- pptx-compiler-core typed native-card executor")) {
    findings.push(finding("final-doc-package-graph", "packaging/alpha-package-plan.json"));
  }

  for (const relativePath of [
    "packages/cli/README.md",
    "packages/core/README.md",
    "packages/public-synthetic/README.md",
    "plugins/native-card-arrow/README.md"
  ]) {
    const text = files.get(relativePath) ?? "";
    const links = [...text.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)].map((match) => match[1]);
    if (links.length === 0 || links.some((target) =>
      !target.startsWith("https://github.com/why7682/pptx-compiler"))) {
      findings.push(finding("final-doc-package-readme-link", relativePath));
    }
  }

  const readme = files.get("README.md") ?? "";
  for (const target of README_OWNER_LINK_TARGETS) {
    if (!readme.includes(`](${target})`)) {
      findings.push(finding("final-doc-readme-owner-link", target));
    }
  }
  const nextActionIndex = readme.indexOf("## Next authorized action\n");
  for (const historyTarget of ["HANDOFF.md", "TODO.md"]) {
    if (nextActionIndex === -1 || readme.indexOf(`](${historyTarget})`) <= nextActionIndex) {
      findings.push(finding("final-doc-history-placement", historyTarget));
    }
  }

  const supportSummary = prose(files.get("docs/SUPPORT_MATRIX.md") ?? "");
  const releaseGates = prose(files.get("docs/RELEASE_GATES.md") ?? "");
  const rawChangelog = files.get("CHANGELOG.md") ?? "";
  if (!supportSummary.includes("normative authority is [policy/support-matrix.json](../policy/support-matrix.json)") ||
      !supportSummary.includes("If this summary and the JSON disagree, the JSON wins") ||
      !releaseGates.includes("Current support state | policy/support-matrix.json") ||
      !releaseGates.includes("These gates answer one question: may the exact reviewed source and package set be presented as a release") ||
      !rawChangelog.includes("Current support remains owned by\n[`policy/support-matrix.json`](policy/support-matrix.json)") ||
      !rawChangelog.includes("release eligibility\nby [`docs/RELEASE_GATES.md`](docs/RELEASE_GATES.md)")) {
    findings.push(finding("final-doc-fact-owner", ""));
  }

  const counts = supportCounts(matrixDocument);
  if (matrixDocument.supportClaimsEnabled !== false ||
      counts === null ||
      Object.values(counts).reduce((total, value) => total + value, 0) !== 60 ||
      counts.supported !== 0 || counts.experimental !== 22 ||
      counts.manual !== 3 || counts.unsupported !== 35) {
    findings.push(finding("final-doc-support-state", "policy/support-matrix.json"));
  }
  const countProjections = [
    ["README.md", /60 rows: 0 supported, 22 experimental, 3 manual, and 35 unsupported/iu],
    ["CHANGELOG.md", /matrix remains 0 supported \/ 22 experimental \/ 3 manual \/ 35 unsupported/iu],
    ["docs/SUPPORT_MATRIX.md", /\| Total \| 60 \| 0 \| 22 \| 3 \| 35 \|/u],
    ["docs/releases/0.1.0-alpha.1.md", /\| 0 \| 22 \| 3 \| 35 \|/u]
  ];
  for (const [relativePath, pattern] of countProjections) {
    if (!pattern.test(prose(files.get(relativePath) ?? ""))) {
      findings.push(finding("final-doc-support-projection", relativePath));
    }
  }

  for (const relativePath of EVIDENCE_PROJECTION_PATHS) {
    const text = files.get(relativePath) ?? "";
    if (HOSTED_RUN_IDS.some((runId) => !text.includes(runId))) {
      findings.push(finding("final-doc-hosted-evidence", relativePath));
    }
  }

  for (const relativePath of BLOCKED_QA_PATHS) {
    const text = prose(files.get(relativePath) ?? "");
    if (!/\bblocked\b/iu.test(text) || !/\bno BuildArtifact\b/u.test(text)) {
      findings.push(finding("final-doc-blocked-qa", relativePath));
    }
  }

  const releaseNoteRaw = files.get("docs/releases/0.1.0-alpha.1.md") ?? "";
  if (/editable[^\n]{0,80}candidate|candidate[^\n]{0,80}editable/iu.test(releaseNoteRaw) ||
      /(?:qa|delivery)[^\n]{0,80}(?:passed|approved)/iu.test(releaseNoteRaw)) {
    findings.push(finding("final-doc-candidate-overclaim", "docs/releases/0.1.0-alpha.1.md"));
  }

  const releaseNote = prose(files.get("docs/releases/0.1.0-alpha.1.md") ?? "");
  if (!rawChangelog.includes("## Unreleased\n") ||
      !releaseNote.includes("Status: draft — not released") ||
      !releaseNote.includes("npm publication remains blocked") ||
      !releaseGates.includes("G6 — Release evidence | Pending")) {
    findings.push(finding("final-doc-draft-release-state", ""));
  }
  if (packageDocument.releaseGuard?.state !== "blocked" ||
      packageDocument.releaseGuard?.reason !== "npm-publication-not-authorized") {
    findings.push(finding("final-doc-npm-publication-guard", "packaging/alpha-package-plan.json"));
  }

  const limitations = files.get("docs/KNOWN_LIMITATIONS.md") ?? "";
  for (const area of [
    "Release state",
    "Support claims",
    "Input class",
    "Output authority",
    "Create-only outputs",
    "QA",
    "Accessibility",
    "Package distribution",
    "Runtime envelope",
    "Branch protection"
  ]) {
    if (!limitations.includes(`| ${area} |`)) {
      findings.push(finding("final-doc-known-limitation", area));
    }
  }

  const nextActionRequirements = [
    ["README.md", "0.1.0-alpha.1"],
    ["CHANGELOG.md", "M4-001"],
    ["docs/KNOWN_LIMITATIONS.md", "M4-001"],
    ["docs/RELEASE_GATES.md", "M4-001"],
    ["docs/SUPPORT_MATRIX.md", "M4-001"],
    ["docs/releases/0.1.0-alpha.1.md", "M4-001"]
  ];
  for (const [relativePath, requirement] of nextActionRequirements) {
    if (!(files.get(relativePath) ?? "").includes(requirement)) {
      findings.push(finding("final-doc-next-action", relativePath));
    }
  }

  const branchDocuments = [
    "README.md",
    "CHANGELOG.md",
    "docs/KNOWN_LIMITATIONS.md",
    "docs/RELEASE_GATES.md"
  ];
  for (const relativePath of branchDocuments) {
    const text = prose(files.get(relativePath) ?? "");
    if (!/branch protection|branch-protection/iu.test(text) || !/defer/iu.test(text)) {
      findings.push(finding("final-doc-branch-protection-deferred", relativePath));
    }
    if (/branch protection (?:is|remains) (?:active|configured|enabled)/iu.test(text)) {
      findings.push(finding("final-doc-branch-protection-overclaim", relativePath));
    }
  }

  return Object.freeze(findings);
}

function mutateDocument(relativePath, transform) {
  const result = new Map(documents);
  result.set(relativePath, transform(result.get(relativePath)));
  return result;
}

test("the final public-document bundle constructs one evidence-bounded candidate-alpha model", () => {
  assert.deepEqual(validateFinalPublicDocuments(documents, supportMatrix, packagePlan), []);
});

test("final public-document mutations fail closed", async (t) => {
  await t.test("constructive section order is reversed", () => {
    const value = mutateDocument("README.md", (text) => text
      .replace("## Fact ownership", "## __temporary_section__")
      .replace("## Executable flow", "## Fact ownership")
      .replace("## __temporary_section__", "## Executable flow"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-constructive-order"), true);
  });

  await t.test("reader entry point loses an authority route", () => {
    const value = mutateDocument("README.md", (text) =>
      text.replace("](docs/KNOWN_LIMITATIONS.md)", ")"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-readme-owner-link"), true);
  });

  await t.test("support switch and counts are promoted", () => {
    const value = structuredClone(supportMatrix);
    value.supportClaimsEnabled = true;
    value.dimensions.capabilities[0].status = "supported";
    assert.equal(validateFinalPublicDocuments(documents, value, packagePlan)
      .some(({ code }) => code === "final-doc-support-state"), true);
  });

  await t.test("one hosted run binding disappears", () => {
    const value = mutateDocument("docs/releases/0.1.0-alpha.1.md", (text) =>
      text.replaceAll("31600806350", "removed-run"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-hosted-evidence"), true);
  });

  await t.test("the package dependency graph loses its native-to-core edge", () => {
    const value = mutateDocument("README.md", (text) =>
      text.replace("pptx-compiler-native-card-arrow --> pptx-compiler-core",
        "pptx-compiler-native-card-arrow"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-package-graph"), true);
  });

  await t.test("a package README reintroduces an unpacked relative link", () => {
    const value = mutateDocument("packages/core/README.md", (text) =>
      text.replace("https://github.com/why7682/pptx-compiler/blob/main/docs/KNOWN_LIMITATIONS.md",
        "../../docs/KNOWN_LIMITATIONS.md"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-package-readme-link"), true);
  });

  await t.test("the blocked candidate is overclaimed as editable", () => {
    const value = mutateDocument("docs/releases/0.1.0-alpha.1.md", (text) =>
      text.replace("native DrawingML card-arrow\ncandidate", "editable native-card candidate"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-candidate-overclaim"), true);
  });

  await t.test("blocked QA is described as producing a BuildArtifact", () => {
    const value = mutateDocument("README.md", (text) =>
      text.replace(/no\s+`?BuildArtifact`?/gu, "a BuildArtifact"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-blocked-qa"), true);
  });

  await t.test("draft release is announced as released", () => {
    const value = mutateDocument("docs/releases/0.1.0-alpha.1.md", (text) =>
      text.replace("Status: draft — not released", "Status: released"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-draft-release-state"), true);
  });

  await t.test("npm publication guard is removed", () => {
    const value = structuredClone(packagePlan);
    value.releaseGuard = { state: "authorized", reason: "release-requested" };
    assert.equal(validateFinalPublicDocuments(documents, supportMatrix, value)
      .some(({ code }) => code === "final-doc-npm-publication-guard"), true);
  });

  await t.test("an input limitation disappears", () => {
    const value = mutateDocument("docs/KNOWN_LIMITATIONS.md", (text) =>
      text.replace("| Input class |", "| Input coverage |"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-known-limitation"), true);
  });

  await t.test("the next release action loses its owner", () => {
    const value = mutateDocument("CHANGELOG.md", (text) =>
      text.replaceAll("M4-001", "an unnamed future task"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-next-action"), true);
  });

  await t.test("deferred branch protection is overclaimed", () => {
    const value = mutateDocument("README.md", (text) =>
      `${text}\nBranch protection is active.\n`);
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-branch-protection-overclaim"), true);
  });
});
