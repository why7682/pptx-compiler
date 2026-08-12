import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  generateContractTypes,
  loadContractSet,
  runContractGate,
  validateContractSet
} from "../scripts/check-contracts.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const baseline = await loadContractSet(projectRoot, "working-tree");
const syntheticUserPath = ["", "Users", "example", "template.potx"].join("/");

function cloneBundle() {
  return structuredClone(baseline);
}

function findings(bundle) {
  return validateContractSet(bundle);
}

function assertRule(bundle, ruleId) {
  const result = findings(bundle);
  assert.ok(result.some((item) => item.ruleId === ruleId),
    `expected ${ruleId}, got ${JSON.stringify(result)}`);
}

test("versioned contract set validates with byte-stable output and no support promotion", async () => {
  const first = findings(cloneBundle());
  const second = findings(cloneBundle());
  assert.deepEqual(first, []);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(baseline.manifest.contractVersion, "0.1.0");
  assert.equal(baseline.manifest.fixturePurpose, "schema-conformance-only");
  assert.equal(baseline.supportMatrix.supportClaimsEnabled, false);
  const capability = baseline.fixtures["capability-registry"].capabilities[0];
  const matrixRow = baseline.supportMatrix.dimensions.capabilities
    .find((item) => item.id === capability.supportMatrixItemId);
  assert.equal(matrixRow.status, "unsupported");
  assert.deepEqual(capability.conformanceFixtureIds, []);
  assert.match(capability.executorId, /^urn:pptx-compiler:fixture-placeholder:/);

  const reorderedObjectKeys = cloneBundle();
  const size = reorderedObjectKeys.fixtures["template-index"].slideSizeEmu;
  reorderedObjectKeys.fixtures["template-index"].slideSizeEmu = { cy: size.cy, cx: size.cx };
  assert.deepEqual(findings(reorderedObjectKeys), []);

  const externalLocalReference = cloneBundle();
  externalLocalReference.schemas["urn:pptx-compiler:schema:shared:0.1.0"]
    .$defs.semanticIdAlias = { "$ref": "#/$defs/semanticId" };
  externalLocalReference.schemas["urn:pptx-compiler:schema:project-config:0.1.0"]
    .properties.projectId.$ref =
      "urn:pptx-compiler:schema:shared:0.1.0#/$defs/semanticIdAlias";
  assert.deepEqual(findings(externalLocalReference), []);

  const orderedSlides = cloneBundle();
  const secondSlide = structuredClone(orderedSlides.fixtures["deck-spec"].slides[0]);
  secondSlide.slideId = "slide-a";
  orderedSlides.fixtures["deck-spec"].slides[0].slideId = "slide-z";
  orderedSlides.fixtures["deck-spec"].slides.push(secondSlide);
  const secondResult = structuredClone(orderedSlides.fixtures["build-artifact"].slides[0]);
  secondResult.slideId = "slide-a";
  orderedSlides.fixtures["build-artifact"].slides[0].slideId = "slide-z";
  orderedSlides.fixtures["build-artifact"].slides.push(secondResult);
  assert.deepEqual(findings(orderedSlides), []);

  const generated = generateContractTypes(baseline.manifest, baseline.schemas);
  assert.equal(generated, await readFile(path.join(projectRoot, "types", "contracts.d.ts"), "utf8"));
  const gateA = await runContractGate({ repositoryRoot: projectRoot, mode: "working-tree" });
  const gateB = await runContractGate({ repositoryRoot: projectRoot, mode: "working-tree" });
  assert.equal(gateA.ok, true);
  assert.equal(JSON.stringify(gateA), JSON.stringify(gateB));
});

test("mutation: unknown contract version is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["project-config"].schemaVersion = "0.2.0";
  assertRule(bundle, "contract-schema-validation");
});

test("mutation: unknown root field is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["project-config"].ambientProjectRoot = "workspace";
  assertRule(bundle, "contract-schema-validation");
});

for (const [label, value] of [
  ["parent traversal", "../template.potx"],
  ["embedded parent traversal", "workspace/../template.potx"],
  ["absolute path with leading whitespace", ` ${syntheticUserPath}`],
  ["file URI", `file:${syntheticUserPath}`],
  ["web URI", "https:example.invalid/template.potx"],
  ["control character", "workspace/template\n.potx"]
]) {
  test(`mutation: ${label} project path is rejected`, () => {
    const bundle = cloneBundle();
    bundle.fixtures["project-config"].template.sourcePath = value;
    assertRule(bundle, "contract-schema-validation");
  });
}

test("mutation: malformed template digest is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["template-profile"].templateSha256 = "not-a-digest";
  assertRule(bundle, "contract-schema-validation");
});

test("mutation: profile and index digest mismatch is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["template-index"].templateSha256 = "f".repeat(64);
  assertRule(bundle, "cross-contract-reference-mismatch");
});

test("mutation: template file extension must match the declared format", () => {
  const bundle = cloneBundle();
  bundle.fixtures["project-config"].template.sourcePath = "workspace/template.pptx";
  assertRule(bundle, "cross-contract-reference-mismatch");
});

for (const partPath of ["../secret.xml", "ppt/../secret.xml", "."]) {
  test(`mutation: traversing package part ${JSON.stringify(partPath)} is rejected`, () => {
    const bundle = cloneBundle();
    bundle.fixtures["template-index"].slides[0].partPath = partPath;
    assertRule(bundle, "contract-schema-validation");
  });
}

test("mutation: reserved OPC root part cannot be used as a path prefix", () => {
  const bundle = cloneBundle();
  bundle.fixtures["build-artifact"].changedParts[0] = "[Content_Types].xml/child";
  assertRule(bundle, "contract-schema-validation");
});

test("mutation: reserved OPC root metadata cannot masquerade as a template part", () => {
  const bundle = cloneBundle();
  bundle.fixtures["template-index"].presentationPart = "[Content_Types].xml";
  assertRule(bundle, "contract-schema-validation");
});

test("mutation: negative geometry is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["template-index"].slides[0].shapes[0].geometry.x = -1;
  assertRule(bundle, "contract-schema-validation");
});

test("mutation: candidate build record cannot drift from replayed layout constraints", () => {
  const bundle = cloneBundle();
  bundle.fixtures["candidate-build-record"].slide.composedSlidePlan.nodes[1].box.x += 1;
  assertRule(bundle, "candidate-build-record-replay-mismatch");
});

test("mutation: candidate source artifact and verification profile remain one schema tuple", () => {
  const bundle = cloneBundle();
  bundle.fixtures["candidate-build-record"].sourceArtifactType =
    "native-omml-formula-assembled-pptx";
  assertRule(bundle, "contract-schema-validation");
});

test("mutation: candidate source and capability evidence remain one schema tuple", () => {
  const bundle = cloneBundle();
  bundle.fixtures["candidate-build-record"].slide.capabilityEvidence = {
    evidenceType: "native-omml-formula",
    formulaDigest: "b".repeat(64),
    formulaTarget: {
      targetShapeKey: "formula-target",
      sourceId: 2,
      geometry: { x: 1, y: 1, cx: 1, cy: 1 },
      structureProfile: "powerpoint-office-2010-text-math",
      fontSizeHundredthPoints: 4800,
      typeface: "Cambria Math",
      capacity: { maxElements: 64, maxRuns: 16, maxTextBytes: 256 },
      observed: { elements: 1, runs: 1, textBytes: 1 },
      status: "pass"
    }
  };
  assertRule(bundle, "contract-schema-validation");
});

test("mutation: candidate source and diff reason remain one schema tuple", () => {
  const bundle = cloneBundle();
  bundle.fixtures["candidate-build-record"].slide.diff.allowedChanges[0].reason =
    "native-omml-formula-replacement";
  assertRule(bundle, "contract-schema-validation");
});

test("mutation: duplicate template index key is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["template-index"].slides.push(structuredClone(bundle.fixtures["template-index"].slides[0]));
  assertRule(bundle, "duplicate-contract-id");
});

test("mutation: template index entries cannot alias one package part", () => {
  const bundle = cloneBundle();
  bundle.fixtures["template-index"].slides[0].partPath =
    bundle.fixtures["template-index"].layouts[0].partPath;
  assertRule(bundle, "duplicate-template-part-path");
});

test("mutation: shape source IDs must be unique within a container", () => {
  const bundle = cloneBundle();
  const shapes = bundle.fixtures["template-index"].slides[0].shapes;
  shapes[1].sourceId = shapes[0].sourceId;
  assertRule(bundle, "duplicate-source-id");
});

test("ordered template shape arrays preserve source z-order", () => {
  const bundle = cloneBundle();
  bundle.fixtures["template-index"].slides[0].shapes.reverse();
  assert.deepEqual(findings(bundle), []);
});

test("mutation: dangling layout-to-master reference is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["template-index"].layouts[0].masterKey = "missing-master";
  assertRule(bundle, "cross-contract-reference-mismatch");
});

test("mutation: dangling slide-to-layout reference is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["template-index"].slides[0].layoutKey = "missing-layout";
  assertRule(bundle, "cross-contract-reference-mismatch");
});

test("mutation: one semantic layout role cannot resolve to multiple layouts", () => {
  const bundle = cloneBundle();
  const secondLayout = structuredClone(bundle.fixtures["template-index"].layouts[0]);
  secondLayout.layoutKey = "content-layout-2";
  secondLayout.sourceId = 2147483650;
  secondLayout.partPath = "ppt/slideLayouts/slideLayout2.xml";
  bundle.fixtures["template-index"].layouts.push(secondLayout);
  bundle.fixtures["template-profile"].layoutBindings.push({
    layoutKey: "content-layout-2",
    semanticRole: "content"
  });
  assertRule(bundle, "duplicate-semantic-layout-role");
});

test("mutation: non-placeholder metadata is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["template-index"].slides[0].shapes[0].kind = "text-box";
  assertRule(bundle, "invalid-placeholder-metadata");
});

test("mutation: unknown observed OOXML feature is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["template-index"].observedFeatureIds.push("unlisted-feature");
  assertRule(bundle, "unknown-support-matrix-reference");
});

test("mutation: missing capability executor reference is rejected", () => {
  const bundle = cloneBundle();
  delete bundle.fixtures["capability-registry"].capabilities[0].executorId;
  assertRule(bundle, "contract-schema-validation");
});

test("mutation: registry-local support label is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["capability-registry"].capabilities[0].status = "supported";
  assertRule(bundle, "contract-schema-validation");
});

test("mutation: duplicate capability ID is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["capability-registry"].capabilities.push(
    structuredClone(bundle.fixtures["capability-registry"].capabilities[0])
  );
  assertRule(bundle, "duplicate-contract-id");
});

test("mutation: capability reference to wrong support dimension is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["capability-registry"].capabilities[0].supportMatrixItemId = "package-container";
  assertRule(bundle, "unknown-support-matrix-reference");
});

test("mutation: dangling overlay capability is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["project-overlay"].capabilitySelections[0].capabilityId = "missing-capability";
  assertRule(bundle, "cross-contract-reference-mismatch");
});

test("mutation: capability version mismatch is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["project-overlay"].capabilitySelections[0].capabilityVersion = "0.2.0";
  assertRule(bundle, "cross-contract-reference-mismatch");
});

test("mutation: incomplete capability binding roles are rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["project-overlay"].capabilitySelections[0].bindings.pop();
  assertRule(bundle, "capability-binding-role-mismatch");
});

test("mutation: dangling shape binding assignment is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["project-overlay"].capabilitySelections[0].bindings[0].shapeBindingId = "missing-binding";
  assertRule(bundle, "cross-contract-reference-mismatch");
});

test("mutation: one shape binding cannot satisfy two roles", () => {
  const bundle = cloneBundle();
  const selection = bundle.fixtures["project-overlay"].capabilitySelections[0];
  selection.bindings[1].shapeBindingId = selection.bindings[0].shapeBindingId;
  assertRule(bundle, "ambiguous-shape-binding");
});

test("separate capability selections may reuse the same semantic bindings", () => {
  const bundle = cloneBundle();
  const overlay = bundle.fixtures["project-overlay"];
  const deck = bundle.fixtures["deck-spec"];
  const artifact = bundle.fixtures["build-artifact"];
  const selection = structuredClone(overlay.capabilitySelections[0]);
  selection.capabilitySelectionId = "clone-reuse";
  overlay.capabilitySelections.push(selection);
  const slide = structuredClone(deck.slides[0]);
  slide.slideId = "slide-reuse";
  slide.capabilitySelectionId = selection.capabilitySelectionId;
  deck.slides.push(slide);
  const result = structuredClone(artifact.slides[0]);
  result.slideId = slide.slideId;
  artifact.slides.push(result);
  assert.deepEqual(findings(bundle), []);
});

test("mutation: dangling bound shape is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["project-overlay"].shapeBindings[0].shapeKey = "missing-shape";
  assertRule(bundle, "cross-contract-reference-mismatch");
});

test("mutation: wrong bound shape kind is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["project-overlay"].shapeBindings[0].expectedKind = "text-box";
  assertRule(bundle, "cross-contract-reference-mismatch");
});

test("mutation: distinct bindings cannot target the same indexed shape", () => {
  const bundle = cloneBundle();
  const shapeBindings = bundle.fixtures["project-overlay"].shapeBindings;
  shapeBindings[1].shapeKey = shapeBindings[0].shapeKey;
  assertRule(bundle, "ambiguous-shape-binding");
});

test("mutation: dangling slide capability selection is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["deck-spec"].slides[0].capabilitySelectionId = "missing-selection";
  assertRule(bundle, "cross-contract-reference-mismatch");
});

test("mutation: duplicate slide ID is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["deck-spec"].slides.push(structuredClone(bundle.fixtures["deck-spec"].slides[0]));
  assertRule(bundle, "duplicate-contract-id");
});

test("mutation: oversized capability payload is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["deck-spec"].slides[0].payload = Object.fromEntries(
    Array.from({ length: 257 }, (_, index) => [`field${index}`, index])
  );
  assertRule(bundle, "contract-schema-validation");
});

test("mutation: artifact slide-to-capability mismatch is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["build-artifact"].slides[0].capabilityVersion = "0.2.0";
  assertRule(bundle, "cross-contract-reference-mismatch");
});

test("mutation: artifact slide results must preserve DeckSpec order", () => {
  const bundle = cloneBundle();
  const secondSlide = structuredClone(bundle.fixtures["deck-spec"].slides[0]);
  secondSlide.slideId = "slide-2";
  bundle.fixtures["deck-spec"].slides.push(secondSlide);
  const secondResult = structuredClone(bundle.fixtures["build-artifact"].slides[0]);
  secondResult.slideId = "slide-2";
  bundle.fixtures["build-artifact"].slides.push(secondResult);
  bundle.fixtures["build-artifact"].slides.reverse();
  assertRule(bundle, "cross-contract-reference-mismatch");
});

test("mutation: artifact changed parts must be canonical and sorted", () => {
  const bundle = cloneBundle();
  bundle.fixtures["build-artifact"].changedParts.reverse();
  assertRule(bundle, "unsorted-or-duplicate-contract-value");
});

test("mutation: artifact output outside configured root is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["build-artifact"].output.publishPath = "elsewhere/deck.pptx";
  assertRule(bundle, "output-outside-configured-root");
});

test("mutation: source template cannot be a write target", () => {
  const bundle = cloneBundle();
  bundle.fixtures["project-config"].template.sourcePath = "workspace/output/synthetic-deck.pptx";
  assertRule(bundle, "template-path-is-write-target");
});

test("mutation: failed QA cannot aggregate to pass", () => {
  const bundle = cloneBundle();
  bundle.fixtures["qa-report"].checks[0].outcome = "fail";
  assertRule(bundle, "invalid-qa-aggregation");
});

test("mutation: manual QA cannot aggregate to pass", () => {
  const bundle = cloneBundle();
  const qa = bundle.fixtures["qa-report"];
  qa.checks[0].outcome = "manual";
  qa.checks[0].manualGateIds = ["manual-gate-1"];
  qa.manualGates = [{
    manualGateId: "manual-gate-1",
    supportMatrixItemId: "macos-powerpoint-automation",
    scopeKind: "build",
    scopeId: "synthetic-build",
    status: "unresolved"
  }];
  assertRule(bundle, "invalid-qa-aggregation");
});

test("mutation: correctly blocked QA cannot back a published BuildArtifact", () => {
  const bundle = cloneBundle();
  const qa = bundle.fixtures["qa-report"];
  qa.decision = "blocked";
  qa.checks[0].outcome = "unavailable";
  qa.checks[0].manualGateIds = ["manual-gate-1"];
  qa.manualGates = [{
    manualGateId: "manual-gate-1",
    supportMatrixItemId: "macos-powerpoint-automation",
    scopeKind: "build",
    scopeId: "synthetic-build",
    status: "unavailable"
  }];
  assertRule(bundle, "unpublishable-build-artifact");
});

test("mutation: manual or unavailable check requires a gate", () => {
  const bundle = cloneBundle();
  const qa = bundle.fixtures["qa-report"];
  qa.decision = "blocked";
  qa.checks[0].outcome = "manual";
  assertRule(bundle, "missing-manual-gate-reference");
});

test("mutation: dangling diagnostic reference is rejected", () => {
  const bundle = cloneBundle();
  bundle.fixtures["qa-report"].checks[0].diagnosticIds = ["missing-diagnostic"];
  assertRule(bundle, "cross-contract-reference-mismatch");
});

test("mutation: error diagnostic cannot coexist with a passing QA decision", () => {
  const bundle = cloneBundle();
  const qa = bundle.fixtures["qa-report"];
  qa.checks[0].diagnosticIds = ["synthetic-error"];
  qa.diagnostics = [{
    diagnosticId: "synthetic-error",
    severity: "error",
    code: "synthetic-contract-error",
    scopeKind: "build",
    scopeId: "synthetic-build"
  }];
  assertRule(bundle, "diagnostic-outcome-mismatch");
  assertRule(bundle, "invalid-qa-aggregation");
  assertRule(bundle, "unpublishable-build-artifact");
});

test("mutation: QA check scope must resolve to a declared build, deck, or slide", () => {
  const bundle = cloneBundle();
  bundle.fixtures["qa-report"].checks[0].scopeId = "missing-scope";
  assertRule(bundle, "invalid-qa-scope");
});

test("mutation: QA cannot substitute an unselected capability contract", () => {
  const bundle = cloneBundle();
  const registry = bundle.fixtures["capability-registry"];
  const selectedCapability = registry.capabilities[0];
  const originalQaContractId = selectedCapability.qaContractId;
  selectedCapability.qaContractId =
    "urn:pptx-compiler:fixture-placeholder:qa:selected-capability-revised:0.1.0";

  const unusedCapability = structuredClone(selectedCapability);
  unusedCapability.capabilityId = "unused-capability";
  unusedCapability.supportMatrixItemId = "asset-placement";
  unusedCapability.qaContractId = originalQaContractId;
  registry.capabilities.push(unusedCapability);

  const firstCheck = bundle.fixtures["qa-report"].checks[0];
  firstCheck.scopeKind = "slide";
  firstCheck.scopeId = bundle.fixtures["deck-spec"].slides[0].slideId;
  assertRule(bundle, "missing-qa-contract-coverage");
  assertRule(bundle, "qa-scope-mismatch");
});

test("mutation: slide-scoped QA must cover every rendered slide", () => {
  const bundle = cloneBundle();
  const deck = bundle.fixtures["deck-spec"];
  const artifact = bundle.fixtures["build-artifact"];
  const secondSlide = structuredClone(deck.slides[0]);
  secondSlide.slideId = "slide-2";
  deck.slides.push(secondSlide);
  const secondResult = structuredClone(artifact.slides[0]);
  secondResult.slideId = "slide-2";
  artifact.slides.push(secondResult);
  for (const check of bundle.fixtures["qa-report"].checks) {
    check.scopeKind = "slide";
    check.scopeId = "slide-1";
  }
  assertRule(bundle, "missing-qa-contract-coverage");
});

test("mutation: resolved manual gate requires opaque evidence", () => {
  const bundle = cloneBundle();
  const qa = bundle.fixtures["qa-report"];
  qa.decision = "blocked";
  qa.checks[0].outcome = "manual";
  qa.checks[0].manualGateIds = ["manual-gate-1"];
  qa.manualGates = [{
    manualGateId: "manual-gate-1",
    supportMatrixItemId: "macos-powerpoint-automation",
    scopeKind: "build",
    scopeId: "synthetic-build",
    status: "passed"
  }];
  assertRule(bundle, "contract-schema-validation");
});

test("mutation: unresolved manual gate cannot carry pass evidence", () => {
  const bundle = cloneBundle();
  const qa = bundle.fixtures["qa-report"];
  qa.decision = "blocked";
  qa.checks[0].outcome = "manual";
  qa.checks[0].manualGateIds = ["manual-gate-1"];
  qa.manualGates = [{
    manualGateId: "manual-gate-1",
    supportMatrixItemId: "macos-powerpoint-automation",
    scopeKind: "build",
    scopeId: "synthetic-build",
    status: "unresolved",
    evidenceRecordId: "urn:pptx-compiler:evidence:manual-gate-1"
  }];
  assertRule(bundle, "contract-schema-validation");
});

test("mutation: manual gate cannot convert an unsupported matrix item into pass evidence", () => {
  const bundle = cloneBundle();
  const qa = bundle.fixtures["qa-report"];
  qa.checks[0].manualGateIds = ["manual-gate-1"];
  qa.manualGates = [{
    manualGateId: "manual-gate-1",
    supportMatrixItemId: "source-slide-clone-fill",
    scopeKind: "build",
    scopeId: "synthetic-build",
    status: "passed",
    evidenceRecordId: "urn:pptx-compiler:evidence:manual-gate-1"
  }];
  assertRule(bundle, "invalid-manual-gate-support-reference");
});

test("mutation: unknown schema keyword fails closed", () => {
  const bundle = cloneBundle();
  bundle.schemas["urn:pptx-compiler:schema:project-config:0.1.0"].unevaluatedProperties = false;
  assertRule(bundle, "unsupported-contract-schema");
});

test("mutation: unregistered external schema reference fails closed", () => {
  const bundle = cloneBundle();
  bundle.schemas["urn:pptx-compiler:schema:project-config:0.1.0"]
    .properties.projectId.$ref = "urn:pptx-compiler:schema:missing:0.1.0#/$defs/id";
  assertRule(bundle, "unsupported-contract-schema");
});

test("mutation: reference cannot target a schema-shaped instance value", () => {
  const bundle = cloneBundle();
  const shared = bundle.schemas["urn:pptx-compiler:schema:shared:0.1.0"];
  shared.$defs.instanceCarrier = {
    const: {
      type: "string",
      minLength: 1,
      not: { const: "synthetic-project" }
    }
  };
  bundle.schemas["urn:pptx-compiler:schema:project-config:0.1.0"]
    .properties.projectId.$ref =
      "urn:pptx-compiler:schema:shared:0.1.0#/$defs/instanceCarrier/const";
  assertRule(bundle, "unsupported-contract-schema");
});

test("mutation: reference cannot target a schema container map", () => {
  const bundle = cloneBundle();
  bundle.schemas["urn:pptx-compiler:schema:project-config:0.1.0"]
    .properties.projectId.$ref =
      "urn:pptx-compiler:schema:shared:0.1.0#/$defs";
  assertRule(bundle, "unsupported-contract-schema");
});

test("mutation: type export cannot target a schema-shaped instance value", () => {
  const bundle = cloneBundle();
  const sharedId = "urn:pptx-compiler:schema:shared:0.1.0";
  bundle.schemas[sharedId].$defs.instanceCarrier = { const: { type: "string" } };
  bundle.manifest.typeExports[0].schemaId = sharedId;
  bundle.manifest.typeExports[0].pointer = "#/$defs/instanceCarrier/const";
  const result = findings(bundle);
  assert.ok(result.some((item) => item.ruleId === "contract-type-generation-failed"));
  assert.equal(result.some((item) => item.ruleId === "unsupported-contract-schema"), false);
});

test("mutation: cyclic schema reference fails closed", () => {
  const bundle = cloneBundle();
  bundle.schemas["urn:pptx-compiler:schema:project-config:0.1.0"]
    .properties.projectId.$ref = "urn:pptx-compiler:schema:project-config:0.1.0#";
  assertRule(bundle, "unsupported-contract-schema");
});

test("mutation: malformed supported keyword fails closed", () => {
  const bundle = cloneBundle();
  bundle.schemas["urn:pptx-compiler:schema:template-index:0.1.0"]
    .properties.observedFeatureIds.uniqueItems = "yes";
  assertRule(bundle, "unsupported-contract-schema");
});

test("mutation: incomplete manifest schema set is rejected", () => {
  const bundle = cloneBundle();
  bundle.manifest.schemas.pop();
  assertRule(bundle, "incomplete-contract-schema-set");
});

test("mutation: incomplete public type export set is rejected", () => {
  const bundle = cloneBundle();
  bundle.manifest.typeExports.pop();
  bundle.typeSource = generateContractTypes(bundle.manifest, bundle.schemas);
  assertRule(bundle, "incomplete-contract-type-export-set");
});

test("mutation: unlisted contract control file is rejected", () => {
  const bundle = cloneBundle();
  bundle.admittedPaths.add("schemas/contracts/undeclared.schema.json");
  assertRule(bundle, "unlisted-contract-control-file");
});

test("mutation: generated TypeScript drift is rejected", () => {
  const bundle = cloneBundle();
  bundle.typeSource += "// hand-edited\n";
  assertRule(bundle, "generated-contract-types-drift");
});
