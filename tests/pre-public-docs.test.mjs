import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  compileForbiddenMaterialPolicy,
  inspectForbiddenMaterialContent
} from "../scripts/check-forbidden-materials.mjs";
import { renderPublicWorkflows } from "../scripts/lib/public-workflows.mjs";

const REQUIRED_DOCUMENTS = Object.freeze([
  "README.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "GOVERNANCE.md",
  "docs/REPRODUCIBILITY.md"
]);
const PUBLIC_REPOSITORY_URL = "https://github.com/why7682/pptx-compiler";
const HOSTED_RUN_IDS = Object.freeze([
  "31600528716",
  "31600528742",
  "31600806512",
  "31600806350"
]);

const documents = new Map(await Promise.all(REQUIRED_DOCUMENTS.map(async (relativePath) => [
  relativePath,
  await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8")
])));
const forbiddenPolicy = compileForbiddenMaterialPolicy(JSON.parse(await readFile(
  new URL("../policy/forbidden-materials.json", import.meta.url),
  "utf8"
)));

const canonicalRuns = [...renderPublicWorkflows()
  .get(".github/workflows/ci.yml")
  .matchAll(/^\s*-?\s*run:\s*(\S.*)$/gmu)]
  .map((match) => match[1]);

function finding(code, path) {
  return Object.freeze({ code, path });
}

function prose(text) {
  return text.replace(/\s+/gu, " ");
}

function commandBlock(text) {
  const heading = "## Canonical public CI command sequence\n";
  const headingIndex = text.indexOf(heading);
  if (headingIndex === -1) return null;
  const remainder = text.slice(headingIndex + heading.length);
  const matches = [...remainder.matchAll(/```sh\n([\s\S]*?)\n```/gu)];
  if (matches.length !== 1) return null;
  return matches[0][1].split("\n");
}

function validatePrePublicDocuments(files, expectedRuns) {
  const findings = [];
  if (!(files instanceof Map) || !Array.isArray(expectedRuns)) {
    return Object.freeze([finding("public-doc-input", "")]);
  }
  const actualPaths = [...files.keys()].sort();
  const expectedPaths = [...REQUIRED_DOCUMENTS].sort();
  if (actualPaths.length !== expectedPaths.length ||
      actualPaths.some((value, index) => value !== expectedPaths[index])) {
    findings.push(finding("public-doc-inventory", ""));
  }

  const readme = files.get("README.md") ?? "";
  const requiredReadmeLinks = [
    "[SECURITY.md](SECURITY.md)",
    "[CONTRIBUTING.md](CONTRIBUTING.md)",
    "[GOVERNANCE.md](GOVERNANCE.md)",
    "[docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md)"
  ];
  if (requiredReadmeLinks.some((link) => !readme.includes(link))) {
    findings.push(finding("public-doc-readme-links", "README.md"));
  }
  if (!readme.includes(PUBLIC_REPOSITORY_URL)) {
    findings.push(finding("public-doc-repository-fact", "README.md"));
  }

  for (const relativePath of REQUIRED_DOCUMENTS.filter((value) => value !== "README.md")) {
    const text = files.get(relativePath) ?? "";
    if (/\b(?:TBD|TODO|FIXME|CHANGEME|PLACEHOLDER)\b|example[.](?:com|org|net|invalid)|OWNER\/REPO|your[-_ ](?:name|email|repo)/iu.test(text)) {
      findings.push(finding("public-doc-placeholder", relativePath));
    }
  }

  const security = files.get("SECURITY.md") ?? "";
  const securityProse = prose(security);
  if (!securityProse.includes("GitHub private vulnerability reporting") ||
      !securityProse.includes("Report a vulnerability") ||
      !securityProse.includes("enabled: true") ||
      !securityProse.includes("This is the project's only private reporting channel")) {
    findings.push(finding("public-doc-security-channel", "SECURITY.md"));
  }
  if (!securityProse.includes("Do not disclose a suspected vulnerability in a") ||
      !securityProse.includes("A public issue may state only that the private reporting channel is unavailable")) {
    findings.push(finding("public-doc-security-disclosure", "SECURITY.md"));
  }
  if (inspectForbiddenMaterialContent(
    "SECURITY.md",
    Buffer.from(security, "utf8"),
    forbiddenPolicy
  ).length !== 0) {
    findings.push(finding("public-doc-security-forbidden-material", "SECURITY.md"));
  }
  if (!securityProse.includes("Do not attach private presentations") ||
      !securityProse.includes("promises no fixed response, fix, release, CVE, or support timeline")) {
    findings.push(finding("public-doc-security-boundary", "SECURITY.md"));
  }
  if (/private vulnerability reporting is (?:not|still not|not yet) enabled|public repository (?:does not|doesn't) exist/iu.test(securityProse)) {
    findings.push(finding("public-doc-security-state-contradiction", "SECURITY.md"));
  }

  const contributing = files.get("CONTRIBUTING.md") ?? "";
  const contributingProse = prose(contributing);
  const contributionRequirements = [
    "[SECURITY.md](SECURITY.md)",
    "[docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md)",
    "[public support matrix](docs/SUPPORT_MATRIX.md)",
    "[provenance ledger](docs/PROVENANCE_LEDGER.md)",
    "repository-owned synthetic inputs",
    "[MIT License](LICENSE)"
  ];
  if (contributionRequirements.some((value) => !contributingProse.includes(value)) ||
      !contributingProse.includes("must not require") ||
      !contributingProse.includes("private presentations")) {
    findings.push(finding("public-doc-contribution-boundary", "CONTRIBUTING.md"));
  }

  const governance = files.get("GOVERNANCE.md") ?? "";
  const governanceProse = prose(governance);
  const governanceRequirements = [
    "single-maintainer model",
    "final merge, release, security-policy, scope, and governance authority",
    "[docs/DECISIONS.md](docs/DECISIONS.md)",
    "[docs/RELEASE_GATES.md](docs/RELEASE_GATES.md)",
    "[docs/SUPPORT_MATRIX.md](docs/SUPPORT_MATRIX.md)",
    "does not substitute for missing evidence"
  ];
  if (governanceRequirements.some((value) => !governanceProse.includes(value))) {
    findings.push(finding("public-doc-governance-boundary", "GOVERNANCE.md"));
  }

  const reproduction = files.get("docs/REPRODUCIBILITY.md") ?? "";
  const actualRuns = commandBlock(reproduction);
  if (actualRuns === null || actualRuns.length !== expectedRuns.length ||
      actualRuns.some((value, index) => value !== expectedRuns[index])) {
    findings.push(finding("public-doc-reproduction-commands", "docs/REPRODUCIBILITY.md"));
  }
  const reproductionProse = prose(reproduction);
  if (!reproductionProse.includes("PowerPoint, Pandoc, models") ||
      !reproductionProse.includes('decision: "blocked"')) {
    findings.push(finding("public-doc-reproduction-boundary", "docs/REPRODUCIBILITY.md"));
  }
  if (!reproductionProse.includes("A local pass remains local evidence") ||
      !reproductionProse.includes("That hosted closure does not make this local procedure proof") ||
      HOSTED_RUN_IDS.some((runId) => !reproduction.includes(runId))) {
    findings.push(finding("public-doc-reproduction-evidence-scope", "docs/REPRODUCIBILITY.md"));
  }
  if (/hosted (?:CI|evidence)[^.]{0,80}(?:is |remains )?(?:absent|unavailable|not (?:yet )?(?:available|collected|present))/iu.test(reproductionProse)) {
    findings.push(finding("public-doc-reproduction-stale-hosted-state", "docs/REPRODUCIBILITY.md"));
  }
  return Object.freeze(findings);
}

function mutate(relativePath, transform) {
  const result = new Map(documents);
  result.set(relativePath, transform(result.get(relativePath)));
  return result;
}

test("the minimum pre-public document bundle has one owner per human process", () => {
  assert.deepEqual(validatePrePublicDocuments(documents, canonicalRuns), []);
});

test("the reproduction guide is an exact projection of the canonical CI commands", () => {
  assert.deepEqual(
    commandBlock(documents.get("docs/REPRODUCIBILITY.md")),
    canonicalRuns
  );
});

test("pre-public document mutations fail closed", async (t) => {
  await t.test("missing README security route", () => {
    const value = mutate("README.md", (text) =>
      text.replace("[SECURITY.md](SECURITY.md)", "Security policy"));
    assert.equal(validatePrePublicDocuments(value, canonicalRuns)
      .some(({ code }) => code === "public-doc-readme-links"), true);
  });

  await t.test("placeholder contact", () => {
    const value = mutate("SECURITY.md", (text) => `${text}\nContact: PLACEHOLDER\n`);
    assert.equal(validatePrePublicDocuments(value, canonicalRuns)
      .some(({ code }) => code === "public-doc-placeholder"), true);
  });

  await t.test("missing verified private-reporting state", () => {
    const value = mutate("SECURITY.md", (text) =>
      text.replace("status is `enabled: true`", "status was requested"));
    assert.equal(validatePrePublicDocuments(value, canonicalRuns)
      .some(({ code }) => code === "public-doc-security-channel"), true);
  });

  await t.test("email becomes a second contact authority", () => {
    const syntheticEmail = ["security", "@", "example", ".invalid"].join("");
    const value = mutate("SECURITY.md", (text) => `${text}\n${syntheticEmail}\n`);
    assert.equal(validatePrePublicDocuments(value, canonicalRuns)
      .some(({ code }) => code === "public-doc-security-forbidden-material"), true);
  });

  await t.test("public disclosure warning is removed", () => {
    const value = mutate("SECURITY.md", (text) =>
      text.replace("Do not disclose a suspected vulnerability in a", "You may disclose it in a"));
    assert.equal(validatePrePublicDocuments(value, canonicalRuns)
      .some(({ code }) => code === "public-doc-security-disclosure"), true);
  });

  await t.test("sensitive-input boundary is removed", () => {
    const value = mutate("SECURITY.md", (text) =>
      text.replace("Do not attach private presentations", "Attach private presentations"));
    assert.equal(validatePrePublicDocuments(value, canonicalRuns)
      .some(({ code }) => code === "public-doc-security-boundary"), true);
  });

  await t.test("verified public repository identity is removed", () => {
    const value = mutate("README.md", (text) =>
      text.replaceAll(PUBLIC_REPOSITORY_URL, "https://github.invalid/local-only"));
    assert.equal(validatePrePublicDocuments(value, canonicalRuns)
      .some(({ code }) => code === "public-doc-repository-fact"), true);
  });

  await t.test("verified private-reporting state is contradicted", () => {
    const value = mutate("SECURITY.md", (text) =>
      `${text}\nPrivate vulnerability reporting is not enabled.\n`);
    assert.equal(validatePrePublicDocuments(value, canonicalRuns)
      .some(({ code }) => code === "public-doc-security-state-contradiction"), true);
  });

  await t.test("reproduction command is reordered", () => {
    const value = mutate("docs/REPRODUCIBILITY.md", (text) => text.replace(
      `${canonicalRuns[0]}\n${canonicalRuns[1]}`,
      `${canonicalRuns[1]}\n${canonicalRuns[0]}`
    ));
    assert.equal(validatePrePublicDocuments(value, canonicalRuns)
      .some(({ code }) => code === "public-doc-reproduction-commands"), true);
  });

  await t.test("local and hosted evidence are conflated", () => {
    const value = mutate("docs/REPRODUCIBILITY.md", (text) =>
      text.replace(/A local pass\s+remains local evidence\./u,
        "A local pass proves the hosted matrix."));
    assert.equal(validatePrePublicDocuments(value, canonicalRuns)
      .some(({ code }) => code === "public-doc-reproduction-evidence-scope"), true);
  });

  await t.test("synthetic-only contribution boundary is removed", () => {
    const value = mutate("CONTRIBUTING.md", (text) =>
      text.replace("repository-owned synthetic inputs", "any available inputs"));
    assert.equal(validatePrePublicDocuments(value, canonicalRuns)
      .some(({ code }) => code === "public-doc-contribution-boundary"), true);
  });

  await t.test("MIT inbound authority link is removed", () => {
    const value = mutate("CONTRIBUTING.md", (text) =>
      text.replace("[MIT License](LICENSE)", "MIT License"));
    assert.equal(validatePrePublicDocuments(value, canonicalRuns)
      .some(({ code }) => code === "public-doc-contribution-boundary"), true);
  });

  await t.test("single-maintainer authority is removed", () => {
    const value = mutate("GOVERNANCE.md", (text) =>
      text.replace("single-maintainer model", "informal model"));
    assert.equal(validatePrePublicDocuments(value, canonicalRuns)
      .some(({ code }) => code === "public-doc-governance-boundary"), true);
  });
});
