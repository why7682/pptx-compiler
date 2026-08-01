import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateSupportMatrix } from "../scripts/check-support-matrix.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const matrix = JSON.parse(await readFile(path.join(projectRoot, "policy", "support-matrix.json"), "utf8"));
const schema = JSON.parse(await readFile(path.join(projectRoot, "schemas", "support-matrix.schema.json"), "utf8"));
const summary = await readFile(path.join(projectRoot, "docs", "SUPPORT_MATRIX.md"), "utf8");
const admittedPaths = new Set([
  "docs/M1-001_HANDOFF.md",
  "docs/M1-002_HANDOFF.md",
  "docs/PRIVATE_FIXTURE_POLICY.md",
  "docs/RELEASE_GATES.md",
  "fixtures/source-parts/minimal/fixture.json",
  "package.json",
  "packages/core/src/project-context.mjs",
  "policy/support-matrix.json",
  "schemas/support-matrix.schema.json",
  "schemas/contracts/build-artifact.schema.json",
  "schemas/contracts/capability-registry.schema.json",
  "schemas/contracts/deck-spec.schema.json",
  "schemas/contracts/project-config.schema.json",
  "schemas/contracts/project-overlay.schema.json",
  "schemas/contracts/qa-report.schema.json",
  "schemas/contracts/template-index.schema.json",
  "schemas/contracts/template-profile.schema.json",
  "scripts/generate-synthetic-fixtures.mjs",
  "scripts/check-support-matrix.mjs",
  "tests/synthetic-fixture.test.mjs",
  "tests/contracts.test.mjs",
  "tests/project-context.test.mjs",
  "tests/support-matrix.test.mjs"
]);

function cloneMatrix() {
  return structuredClone(matrix);
}

function findings(document, paths = admittedPaths) {
  return validateSupportMatrix(document, schema, { admittedPaths: paths });
}

function assertRule(document, ruleId, paths = admittedPaths) {
  const result = findings(document, paths);
  assert.ok(result.some((item) => item.ruleId === ruleId),
    `expected ${ruleId}, got ${JSON.stringify(result)}`);
}

function completeCapabilityArtifacts() {
  return ["metadata", "executor", "input-schema", "output-schema", "conformance-fixture", "qa-assertions"].map((type) => ({
    type,
    path: "docs/RELEASE_GATES.md",
    note: "Synthetic mutation-only artifact reference."
  }));
}

test("support matrix validates and produces byte-stable findings", () => {
  const first = findings(matrix);
  const second = findings(matrix);
  assert.deepEqual(first, []);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(matrix.supportClaimsEnabled, false);
  assert.equal(matrix.dimensions.capabilities.some((item) => item.status === "supported"), false);
  const headings = {
    inputs: "Inputs",
    ooxmlFeatures: "OOXML features",
    capabilities: "Capabilities",
    platforms: "Platforms",
    evidenceLevels: "Evidence levels"
  };
  for (const [dimension, heading] of Object.entries(headings)) {
    const items = matrix.dimensions[dimension];
    const counts = ["supported", "experimental", "manual", "unsupported"]
      .map((status) => items.filter((item) => item.status === status).length);
    assert.ok(summary.includes(`| ${heading} | ${items.length} | ${counts.join(" | ")} |`),
      `human summary is stale for ${dimension}`);
  }
  assert.ok(summary.includes("`supportClaimsEnabled` is `false`"));
});

test("mutation: unknown support-matrix schema version is rejected", () => {
  const mutated = cloneMatrix();
  mutated.schemaVersion = 2;
  assertRule(mutated, "support-matrix-schema-validation");
});

test("mutation: unknown support-matrix field is rejected", () => {
  const mutated = cloneMatrix();
  mutated.unreviewedClaim = true;
  assertRule(mutated, "support-matrix-schema-validation");
});

test("mutation: missing dimension is rejected", () => {
  const mutated = cloneMatrix();
  delete mutated.dimensions.ooxmlFeatures;
  assertRule(mutated, "support-matrix-schema-validation");
});

test("mutation: unknown public support status is rejected", () => {
  const mutated = cloneMatrix();
  mutated.dimensions.inputs[0].status = "planned";
  assertRule(mutated, "support-matrix-schema-validation");
});

test("mutation: supported claim is rejected while claims are disabled", () => {
  const mutated = cloneMatrix();
  const capability = mutated.dimensions.capabilities[0];
  capability.status = "supported";
  capability.disposition = "accept";
  capability.evidence = { level: "automated-public", artifacts: completeCapabilityArtifacts() };
  assertRule(mutated, "support-claim-disabled");
});

test("mutation: supported capability missing contract evidence is rejected", () => {
  const mutated = cloneMatrix();
  mutated.supportClaimsEnabled = true;
  mutated.productStage = "alpha";
  const capability = mutated.dimensions.capabilities[0];
  capability.status = "supported";
  capability.disposition = "accept";
  capability.evidence = {
    level: "automated-public",
    artifacts: [{ type: "executor", path: "docs/RELEASE_GATES.md", note: "Mutation-only executor reference." }]
  };
  assertRule(mutated, "missing-supported-capability-evidence");
});

test("mutation: manual status without a manual gate is rejected", () => {
  const mutated = cloneMatrix();
  const manual = mutated.dimensions.platforms.find((item) => item.id === "macos-powerpoint-automation");
  manual.disposition = "accept-with-warning";
  manual.evidence = { level: "none", artifacts: [] };
  assertRule(mutated, "invalid-manual-evidence");
});

test("mutation: unsupported item with accepting disposition is rejected", () => {
  const mutated = cloneMatrix();
  mutated.dimensions.inputs[0].disposition = "accept";
  assertRule(mutated, "invalid-unsupported-disposition");
});

test("mutation: duplicate matrix ID is rejected across dimensions", () => {
  const mutated = cloneMatrix();
  mutated.dimensions.capabilities[0].id = mutated.dimensions.inputs[0].id;
  assertRule(mutated, "duplicate-support-matrix-id");
});

test("mutation: nondeterministic item ordering is rejected", () => {
  const mutated = cloneMatrix();
  mutated.dimensions.evidenceLevels.reverse();
  assertRule(mutated, "unsorted-support-matrix-ids");
});

test("mutation: missing unknown-feature catch-all is rejected", () => {
  const mutated = cloneMatrix();
  mutated.dimensions.ooxmlFeatures = mutated.dimensions.ooxmlFeatures
    .filter((item) => item.id !== "unknown-ooxml-feature");
  assertRule(mutated, "missing-support-matrix-catch-all");
});

test("mutation: accepting unknown-input catch-all is rejected", () => {
  const mutated = cloneMatrix();
  const catchAll = mutated.dimensions.inputs.find((item) => item.id === "unknown-input");
  catchAll.status = "experimental";
  catchAll.disposition = "accept-with-warning";
  assertRule(mutated, "invalid-support-matrix-catch-all");
});

test("mutation: nonexistent evidence artifact is rejected", () => {
  const mutated = cloneMatrix();
  const manual = mutated.dimensions.evidenceLevels.find((item) => item.id === "manual-trusted-runtime");
  manual.evidence.artifacts[0].path = "docs/nonexistent-evidence.md";
  assertRule(mutated, "missing-evidence-artifact");
});
