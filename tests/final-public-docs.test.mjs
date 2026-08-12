import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const FINAL_DOCUMENT_PATHS = Object.freeze([
  "README.md",
  "CHANGELOG.md",
  "docs/ARCHITECTURE_TARGET.md",
  "docs/COMPATIBILITY_POLICY.md",
  "docs/KNOWN_LIMITATIONS.md",
  "docs/M4-001_HANDOFF.md",
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

const CURRENT_READER_RUN_IDS = Object.freeze([
  "31608992503",
  "31608992491",
  "31609285181",
  "31609285220"
]);

const CURRENT_READER_OBJECT_BINDINGS = Object.freeze([
  "093d527fc3fadf7cae577139b8d400719755dd52",
  "8cdf968b72f8dd5f41fee37a68e239e477dec44b",
  "1d6d148a8bc347dc3cbc13dde3fd4314d86c421a"
]);

const M3_IMPLEMENTATION_RUN_IDS = Object.freeze([
  "31600528716",
  "31600528742",
  "31600806512",
  "31600806350"
]);

const CURRENT_ALPHA_LOCK_SHA256 =
  "d3b4818e9bcdb43f39df557847613d3e5ce0afa2f6fffda5af655217f2f5170a";

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
  "docs/M4-001_HANDOFF.md": Object.freeze([
    "## Status",
    "## Fact ownership",
    "## Release candidate and lock",
    "## Hosted workflow boundary",
    "## Publication and recovery state machine",
    "## Current public evidence",
    "## M4-001A completion evidence",
    "## M4-001B tracked-lock checkpoint",
    "## Next actions"
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
  "docs/COMPATIBILITY_POLICY.md",
  "docs/RELEASE_GATES.md",
  "docs/REPRODUCIBILITY.md",
  "docs/SUPPORT_MATRIX.md",
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

const LOCK_BOUND_RELEASE_DOCUMENT_PATHS = Object.freeze([
  "CHANGELOG.md",
  "docs/KNOWN_LIMITATIONS.md",
  "docs/releases/0.1.0-alpha.1.md"
]);

const PACKAGE_README_PATHS = Object.freeze([
  "packages/cli/README.md",
  "packages/core/README.md",
  "packages/public-synthetic/README.md",
  "plugins/native-card-arrow/README.md"
]);

const EXPIRING_RELEASE_STATE = /(?:^|\n)## Unreleased\n|Status:\s*(?:draft|released)|\b(?:is|remains) (?:not released|unreleased)\b|There is(?: currently)? no release tag|no npm package(?:s)?(?:,|\s)|changelog stays under `Unreleased`|release note (?:remains|marked) draft|keep this document marked draft/iu;

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

function hasOrderedPhrases(text, phrases) {
  let cursor = -1;
  for (const phrase of phrases) {
    const index = text.indexOf(phrase);
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

  for (const relativePath of PACKAGE_README_PATHS) {
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
    if ([...CURRENT_READER_RUN_IDS, ...CURRENT_READER_OBJECT_BINDINGS]
      .some((binding) => !text.includes(binding))) {
      findings.push(finding("final-doc-hosted-evidence", relativePath));
    }
  }
  const implementationHandoff = files.get("docs/M3-004_HANDOFF.md") ?? "";
  if (M3_IMPLEMENTATION_RUN_IDS.some((runId) => !implementationHandoff.includes(runId))) {
    findings.push(finding("final-doc-hosted-evidence", "docs/M3-004_HANDOFF.md"));
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

  const releaseNote = prose((files.get("docs/releases/0.1.0-alpha.1.md") ?? "")
    .replace(/^>\s?/gmu, ""));
  const changelog = prose(rawChangelog);
  const knownLimitations = prose(files.get("docs/KNOWN_LIMITATIONS.md") ?? "");
  if (!rawChangelog.includes("## 0.1.0-alpha.1 candidate contents\n") ||
      !changelog.includes("does not announce or deny an external release") ||
      !releaseNote.includes("Status boundary: release-state neutral") ||
      !releaseNote.includes("neither announces nor denies mutable external release state") ||
      !knownLimitations.includes("This lock-bound document makes no current external-release assertion") ||
      !releaseGates.includes("G6 — Release evidence | In progress under D-048")) {
    findings.push(finding("final-doc-release-lifecycle", ""));
  }
  for (const relativePath of LOCK_BOUND_RELEASE_DOCUMENT_PATHS) {
    if (EXPIRING_RELEASE_STATE.test(files.get(relativePath) ?? "")) {
      findings.push(finding("final-doc-release-lifecycle", relativePath));
    }
  }
  for (const relativePath of PACKAGE_README_PATHS) {
    const text = prose(files.get(relativePath) ?? "");
    if (!text.includes("Publication is permitted only through the exact public alpha channel") ||
        !text.includes("Publication status is owned by the official-registry byte record, the tracked release lock, and npm provenance") ||
        !text.includes("this README never asserts current lifecycle state") ||
        EXPIRING_RELEASE_STATE.test(files.get(relativePath) ?? "") ||
        /not yet been published|has not yet been published|not a published npm release/iu.test(text)) {
      findings.push(finding("final-doc-package-lifecycle", relativePath));
    }
  }
  if (packageDocument.releaseGuard?.state !== "authorized" ||
      packageDocument.releaseGuard?.decisionId !== "D-048" ||
      packageDocument.publication?.registry !== "https://registry.npmjs.org/" ||
      packageDocument.publication?.tag !== "alpha" ||
      packageDocument.publication?.access !== "public" ||
      packageDocument.publication?.provenance !== true) {
    findings.push(finding("final-doc-npm-publication-guard", "packaging/alpha-package-plan.json"));
  }

  const reproduction = files.get("docs/REPRODUCIBILITY.md") ?? "";
  const m4Handoff = files.get("docs/M4-001_HANDOFF.md") ?? "";
  if (!hasOrderedPhrases(files.get("docs/RELEASE_GATES.md") ?? "", [
    "dual-builder tar-payload equality and fixed-builder release envelopes",
    "create-only tracked release lock",
    "reviewed lock merge as GitHub-verified commit S",
    "single-parent local attestation A with sole parent S and exact grant for S",
    "complete reachable-history gate at current main=A",
    "exact annotated-tag admission on unchanged S",
    "tag-triggered Public CI and Security evidence",
    "ordered npm publication and official-registry equality",
    "GitHub Release created last"
  ]) || !hasOrderedPhrases(reproduction, [
    "state-neutral release note are frozen",
    "the complete canonical gate sequence",
    "an independent guarded build/install/smoke under Node 22.23.2/npm 10.9.8",
    "review, provenance admission, commit, and accepted-main merge of that exact",
    "sole parent is `S`",
    "complete reachable-history gate at current `main=A`",
    "annotated tag `v0.1.0-alpha.1` peeling to unchanged `S`",
    "tag-triggered Public CI and Security workflows",
    "M4-001C derives npm dependency order",
    "GitHub Release last"
  ]) || !hasOrderedPhrases(m4Handoff, [
    "freeze the locked inputs, run both builders, write",
    "merge it as the",
    "GitHub-verified lock-containing commit `S`. Then",
    "`A` must have `S` as",
    "reachable-history gate at current `main=A`",
    "create the annotated",
    "tag on unchanged `S`",
    "Public CI and Security may run on the exact tag",
    "Publication order is the dependency order",
    "GitHub Release to be created"
  ]) || !reproduction.includes("with `ahead_by=1`\n   and `behind_by=0`") ||
      !m4Handoff.includes("`ahead_by=1` and\n`behind_by=0`; equality or a deeper descendant fails closed")) {
    findings.push(finding("final-doc-release-order", "docs/RELEASE_GATES.md"));
  }
  if (!m4Handoff.includes("| Package graph, public manifest, registry, access, dist-tag, provenance setting, derived dependency order | `packaging/alpha-package-plan.json` schema 3 |") ||
      !m4Handoff.includes("| Exact tag, builders, lock inputs, recovery and completion rules | `packaging/alpha-release-plan.json` |") ||
      !m4Handoff.includes("| Release phase order and eligibility | `docs/RELEASE_GATES.md` |") ||
      !releaseGates.includes("package-plan schema 3 is the only authority for official registry, public access, dist-tag alpha, npm provenance, and the dependency graph from which publication order is derived") ||
      !releaseGates.includes("this document owns the phase sequence")) {
    findings.push(finding("final-doc-release-fact-owner", "docs/M4-001_HANDOFF.md"));
  }
  const compatibility = files.get("docs/COMPATIBILITY_POLICY.md") ?? "";
  const compatibilityProse = prose(compatibility);
  const m4HandoffProse = prose(m4Handoff);
  if (!m4Handoff.includes("`M4-001A` is complete") ||
      !m4Handoff.includes("`M4-001B` is in progress") ||
      !files.get("docs/RELEASE_GATES.md")?.includes("### M4-001A — contract admission (complete)") ||
      !files.get("docs/RELEASE_GATES.md")?.includes("### M4-001B — exact candidate and lock (in progress)") ||
      !compatibility.includes("Release Gates is the sole current release-phase owner") ||
      !compatibility.includes("M4-001A contract\nadmission is complete") ||
      !compatibility.includes("M4-001B is in progress") ||
      !m4Handoff.includes(CURRENT_ALPHA_LOCK_SHA256) ||
      !files.get("docs/RELEASE_GATES.md")?.includes(CURRENT_ALPHA_LOCK_SHA256) ||
      !compatibility.includes(CURRENT_ALPHA_LOCK_SHA256) ||
      !m4HandoffProse.includes("exact reviewed lock") ||
      !m4HandoffProse.includes("included in this tracked-admission change") ||
      !m4HandoffProse.includes("has not been merged as S") ||
      !releaseGates.includes("exact independently reviewed dual-builder lock is included in this tracked-admission change") ||
      !releaseGates.includes("remaining M4-001B boundary is its unchanged commit and GitHub-verified merge as S") ||
      !compatibilityProse.includes("included in the current tracked-admission change") ||
      !compatibilityProse.includes("Release Gates owns the remaining merge S, attestation A, history, tag, hosted-evidence, and M4-001C registry/declaration phases") ||
      /M4-001A is active|M4-001B (?:is next|remains pending)|review-pending candidate lock/iu.test(compatibility)) {
    findings.push(finding("final-doc-release-phase", "docs/M4-001_HANDOFF.md"));
  }
  if (!reproduction.includes("four\nreviewed public-alpha candidate tarballs") ||
      !reproduction.includes("none is published by this procedure") ||
      /creates four\s+private reviewed tarballs/iu.test(reproduction)) {
    findings.push(finding("final-doc-package-candidate-state", "docs/REPRODUCIBILITY.md"));
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
      text.replaceAll("31609285220", "removed-run"));
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

  await t.test("a lock-bound release note embeds a mutable released label", () => {
    const value = mutateDocument("docs/releases/0.1.0-alpha.1.md", (text) =>
      text.replace("# PPTX Compiler 0.1.0-alpha.1\n",
        "# PPTX Compiler 0.1.0-alpha.1\n\nStatus: released\n"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-release-lifecycle"), true);
  });

  await t.test("a lock-bound changelog embeds a mutable pre-release label", () => {
    const value = mutateDocument("CHANGELOG.md", (text) =>
      text.replace("## 0.1.0-alpha.1 candidate contents",
        "## Unreleased"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-release-lifecycle"), true);
  });

  await t.test("D-048 publication authorization regresses to blocked", () => {
    const value = structuredClone(packagePlan);
    value.releaseGuard = { state: "blocked", reason: "release-requested" };
    assert.equal(validateFinalPublicDocuments(documents, supportMatrix, value)
      .some(({ code }) => code === "final-doc-npm-publication-guard"), true);
  });

  await t.test("the history gate is moved before the local attestation", () => {
    const value = mutateDocument("docs/RELEASE_GATES.md", (text) => text
      .replace(
        "single-parent local attestation A with sole parent S and exact grant for S",
        "__release_order_a__"
      )
      .replace(
        "complete reachable-history gate at current main=A",
        "single-parent local attestation A with sole parent S and exact grant for S"
      )
      .replace(
        "__release_order_a__",
        "complete reachable-history gate at current main=A"
      ));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-release-order"), true);
  });

  await t.test("the release plan steals publication-order authority", () => {
    const value = mutateDocument("docs/M4-001_HANDOFF.md", (text) => text
      .replace(
        "| Exact tag, builders, lock inputs, recovery and completion rules |",
        "| Exact tag, builders, publication order, lock inputs, recovery and completion rules |"
      ));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-release-fact-owner"), true);
  });

  await t.test("the tag target is allowed to equal current main", () => {
    const value = mutateDocument("docs/REPRODUCIBILITY.md", (text) => text
      .replace("with `ahead_by=1`\n   and `behind_by=0`", "with `ahead_by=0`\n   and `behind_by=0`"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-release-order"), true);
  });

  await t.test("the completed contract phase regresses to active", () => {
    const value = mutateDocument("docs/M4-001_HANDOFF.md", (text) => text
      .replace("`M4-001A` is complete", "`M4-001A` is in progress"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-release-phase"), true);
  });

  await t.test("the reviewed tracked-lock checkpoint regresses to next", () => {
    const value = mutateDocument("docs/M4-001_HANDOFF.md", (text) => text
      .replace("`M4-001B` is in progress", "`M4-001B` is next"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-release-phase"), true);
  });

  await t.test("the current package candidates are relabeled as private tarballs", () => {
    const value = mutateDocument("docs/REPRODUCIBILITY.md", (text) => text
      .replace("reviewed public-alpha candidate tarballs", "private reviewed tarballs"));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-package-candidate-state"), true);
  });

  await t.test("a package README embeds a pre-publication state that expires after release", () => {
    const value = mutateDocument("packages/core/README.md", (text) =>
      text.replace(
        "Publication status is owned by the official-registry byte\nrecord, the tracked release lock, and npm provenance; this README never asserts\ncurrent lifecycle state",
        "This version has not yet been published"
      ));
    assert.equal(validateFinalPublicDocuments(value, supportMatrix, packagePlan)
      .some(({ code }) => code === "final-doc-package-lifecycle"), true);
  });

  await t.test("the authorized alpha publication policy drifts", () => {
    const value = structuredClone(packagePlan);
    value.publication.tag = "latest";
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
