import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateSupportMatrix } from "../scripts/check-support-matrix.mjs";
import { PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE } from
  "../packages/public-synthetic/src/project.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const matrix = JSON.parse(await readFile(path.join(projectRoot, "policy", "support-matrix.json"), "utf8"));
const schema = JSON.parse(await readFile(path.join(projectRoot, "schemas", "support-matrix.schema.json"), "utf8"));
const summary = await readFile(path.join(projectRoot, "docs", "SUPPORT_MATRIX.md"), "utf8");
const admittedPaths = new Set([
  "docs/M1-001_HANDOFF.md",
  "docs/M1-002_HANDOFF.md",
  "docs/M2-001_HANDOFF.md",
  "docs/M2-003_HANDOFF.md",
  "docs/M2-004_HANDOFF.md",
  "docs/PRIVATE_FIXTURE_POLICY.md",
  "docs/RELEASE_GATES.md",
  "fixtures/source-parts/minimal/fixture.json",
  "fixtures/inspection/expected-potx-template-index.json",
  "fixtures/capabilities/dispatcher-contract-probe/cases.json",
  "fixtures/capabilities/dispatcher-contract-probe/input.schema.json",
  "fixtures/capabilities/dispatcher-contract-probe/output.schema.json",
  "fixtures/capabilities/dispatcher-contract-probe/registry.json",
  "fixtures/capabilities/dispatcher-contract-probe/runtime.mjs",
  "fixtures/capabilities/source-slide-clone-fill/cases.json",
  "fixtures/capabilities/source-slide-clone-fill/deck-spec.json",
  "fixtures/capabilities/source-slide-clone-fill/project-overlay.json",
  "fixtures/capabilities/source-slide-clone-fill/registry.json",
  "fixtures/capabilities/native-card-arrow/cases.json",
  "fixtures/capabilities/native-card-arrow/deck-spec.json",
  "fixtures/capabilities/native-card-arrow/project-overlay.json",
  "fixtures/capabilities/native-card-arrow/registry.json",
  "fixtures/capabilities/formula-transplant/cases.json",
  "fixtures/capabilities/formula-transplant/registry.json",
  "fixtures/contracts/valid/candidate-build-record.json",
  "package.json",
  "packages/core/src/candidate-build-record.mjs",
  "packages/core/src/candidate-pair-publication.mjs",
  "packages/core/src/create-only-assembly.mjs",
  "packages/core/src/native-card-candidate-publication.mjs",
  "packages/core/src/native-card-candidate-qa.mjs",
  "packages/core/src/native-card-arrow-assembly.mjs",
  "packages/core/src/ordered-slide-assembly.mjs",
  "packages/core/src/project-context.mjs",
  "packages/core/src/capability-dispatcher.mjs",
  "packages/core/src/project-dispatch-resolver.mjs",
  "packages/core/src/receipt-bound-final-delivery.mjs",
  "packages/core/src/native-omml-formula-assembly.mjs",
  "packages/core/src/native-presentation-publication.mjs",
  "packages/core/src/ooxml-package-view.mjs",
  "packages/core/src/secure-template-ingestion.mjs",
  "packages/core/src/secure-zip.mjs",
  "packages/core/src/strict-xml.mjs",
  "packages/core/src/template-inspector.mjs",
  "packages/public-synthetic/src/project.mjs",
  "packages/powerpoint-macos/src/formula-content-edit-evidence.mjs",
  "packages/powerpoint-macos/src/ordered-compatibility-receipt.mjs",
  "packages/adapter-pandoc-omml/schemas/input.schema.json",
  "packages/adapter-pandoc-omml/schemas/output.schema.json",
  "packages/adapter-pandoc-omml/src/formula-transplant.mjs",
  "packages/adapter-pandoc-omml/src/pandoc-omml-adapter.mjs",
  "plugins/clone-fill/schemas/input.schema.json",
  "plugins/clone-fill/schemas/output.schema.json",
  "plugins/clone-fill/src/source-slide-clone-fill.mjs",
  "plugins/native-card-arrow/schemas/input.schema.json",
  "plugins/native-card-arrow/schemas/output.schema.json",
  "plugins/native-card-arrow/src/native-card-arrow.mjs",
  "policy/support-matrix.json",
  "schemas/support-matrix.schema.json",
  "schemas/contracts/build-artifact.schema.json",
  "schemas/contracts/candidate-build-record.schema.json",
  "schemas/contracts/capability-registry.schema.json",
  "schemas/contracts/deck-spec.schema.json",
  "schemas/contracts/project-config.schema.json",
  "schemas/contracts/project-overlay.schema.json",
  "schemas/contracts/qa-report.schema.json",
  "schemas/contracts/template-index.schema.json",
  "schemas/contracts/template-profile.schema.json",
  "scripts/generate-synthetic-fixtures.mjs",
  "scripts/check-support-matrix.mjs",
  "scripts/record-omml-formula-content-edit.mjs",
  "scripts/run-ordered-powerpoint-compatibility.mjs",
  "scripts/validate-ordered-powerpoint.applescript",
  "tests/synthetic-fixture.test.mjs",
  "tests/contracts.test.mjs",
  "tests/create-only-assembly.test.mjs",
  "tests/capability-dispatcher.test.mjs",
  "tests/cli.test.mjs",
  "tests/project-context.test.mjs",
  "tests/formula-content-edit-evidence.test.mjs",
  "tests/secure-template-ingestion.test.mjs",
  "tests/source-slide-clone-fill.test.mjs",
  "tests/native-card-arrow.test.mjs",
  "tests/native-card-arrow-assembly.test.mjs",
  "tests/native-omml-formula-assembly.test.mjs",
  "tests/ordered-powerpoint-compatibility.test.mjs",
  "tests/pandoc-omml-adapter.test.mjs",
  "tests/receipt-bound-final-delivery.test.mjs",
  "tests/receipt-bound-omml-final-delivery.test.mjs",
  "tests/receipt-bound-ordered-final-delivery.test.mjs",
  "tests/support-matrix.test.mjs",
  "tests/template-inspector.test.mjs"
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
  assert.equal(
    matrix.dimensions.capabilities.some((item) => item.id === "dispatcher-contract-probe"),
    false
  );
  const cloneFill = matrix.dimensions.capabilities.find((item) =>
    item.id === "source-slide-clone-fill");
  assert.equal(cloneFill.status, "unsupported");
  assert.equal(cloneFill.disposition, "unavailable");
  assert.deepEqual(
    new Set(cloneFill.evidence.artifacts.map((artifact) => artifact.type)),
    new Set([
      "metadata",
      "executor",
      "input-schema",
      "output-schema",
      "conformance-fixture",
      "qa-assertions",
      "contract"
    ])
  );
  const nativeDrawingml = matrix.dimensions.capabilities.find((item) =>
    item.id === "native-drawingml");
  assert.equal(nativeDrawingml.status, "experimental");
  assert.equal(nativeDrawingml.disposition, "accept-with-warning");
  assert.equal(nativeDrawingml.evidence.level, "automated-public");
  assert.deepEqual(
    new Set(nativeDrawingml.evidence.artifacts.map((artifact) => artifact.type)),
    new Set([
      "metadata",
      "executor",
      "input-schema",
      "output-schema",
      "conformance-fixture",
      "qa-assertions",
      "contract"
    ])
  );
  for (const broadId of ["drawingml-shapes", "slide-text"]) {
    const broadRow = matrix.dimensions.ooxmlFeatures.find((item) => item.id === broadId);
    assert.equal(broadRow.status, "experimental");
    assert.equal(broadRow.disposition, "accept-with-warning");
  }
  for (const capabilityId of [
    "collateral-mutation-qa",
    "package-inspection",
    "staged-create-only-assembly",
    "template-profile-binding"
  ]) {
    const capability = matrix.dimensions.capabilities.find((item) => item.id === capabilityId);
    assert.equal(capability.status, "experimental");
    assert.equal(capability.disposition, "accept-with-warning");
    assert.equal(capability.evidence.level, "automated-public");
    const types = new Set(capability.evidence.artifacts.map((artifact) => artifact.type));
    for (const required of [
      "metadata", "executor", "input-schema", "output-schema",
      "conformance-fixture", "qa-assertions"
    ]) assert.equal(types.has(required), true, `${capabilityId}:${required}`);
  }
  for (const formulaId of ["formula-transplant", "latex-formula", "native-omml"]) {
    const formulaRow = formulaId === "native-omml"
      ? matrix.dimensions.ooxmlFeatures.find((item) => item.id === formulaId)
      : matrix.dimensions.capabilities.find((item) => item.id === formulaId) ??
        matrix.dimensions.inputs.find((item) => item.id === formulaId);
    assert.equal(formulaRow.status, "unsupported");
    assert.equal(formulaRow.disposition, "unavailable");
    assert.equal(formulaRow.evidence.level, "automated-public");
  }
  assert.deepEqual(
    matrix.dimensions.inputs
      .filter((item) => ["potx-template", "pptx-template"].includes(item.id))
      .map((item) => item.status),
    ["experimental", "unsupported"]
  );
  const rows = new Map(Object.values(matrix.dimensions).flat().map((item) => [item.id, item]));
  assert.equal(PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE.supportItemIds.length, 15);
  for (const itemId of PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE.supportItemIds) {
    assert.equal(rows.get(itemId)?.status, "experimental", itemId);
    assert.equal(rows.get(itemId)?.disposition, "accept-with-warning", itemId);
  }
  assert.deepEqual(
    Object.values(matrix.dimensions).flat().reduce((counts, item) => {
      counts[item.status] += 1;
      return counts;
    }, { supported: 0, experimental: 0, manual: 0, unsupported: 0 }),
    { supported: 0, experimental: 22, manual: 3, unsupported: 35 }
  );
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

test("mutation: experimental capability requires automated public evidence", () => {
  const mutated = cloneMatrix();
  const capability = mutated.dimensions.capabilities[0];
  capability.status = "experimental";
  capability.disposition = "accept-with-warning";
  capability.evidence = { level: "none", artifacts: [] };
  assertRule(mutated, "invalid-experimental-capability-evidence");
  assertRule(mutated, "missing-experimental-capability-evidence");
});

test("mutation: experimental capability requires every executable artifact type", () => {
  const mutated = cloneMatrix();
  const capability = mutated.dimensions.capabilities[0];
  capability.status = "experimental";
  capability.disposition = "accept-with-warning";
  capability.evidence = {
    level: "automated-public",
    artifacts: [
      { type: "executor", path: "docs/RELEASE_GATES.md", note: "Mutation-only executor." }
    ]
  };
  assertRule(mutated, "missing-experimental-capability-evidence");
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
  const unsupported = mutated.dimensions.inputs.find((item) =>
    item.status === "unsupported" && item.disposition === "unavailable");
  unsupported.disposition = "accept";
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
