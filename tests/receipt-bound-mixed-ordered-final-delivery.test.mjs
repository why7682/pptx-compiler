import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createOrderedCandidateBuildRecord } from
  "../packages/core/src/candidate-build-record.mjs";
import { createProjectContext } from "../packages/core/src/project-context.mjs";
import {
  prepareReceiptBoundMixedOrderedFinalDelivery,
  publishReceiptBoundFinalDelivery,
  ReceiptBoundFinalDeliveryError
} from "../packages/core/src/receipt-bound-final-delivery.mjs";
import {
  createMixedOrderedProjectConfig,
  createPublicMixedOrderedCandidate,
  createPublicMixedOrderedDocuments,
  createPublicMixedOrderedRuntime,
  mixedOrderedResolverDependencies
} from "./helpers/public-mixed-ordered-candidate.mjs";
import {
  assertSupportedSchema,
  createSchemaRegistry,
  validateJson
} from "../scripts/lib/json-schema.mjs";

const readJson = async (relativePath) => JSON.parse(await readFile(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8"
));

function clone(value) {
  return structuredClone(value);
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const manifest = await readJson("schemas/contracts/manifest.json");
const schemas = await Promise.all(manifest.schemas.map(({ path: schemaPath }) =>
  readJson(schemaPath)));
const schemaRegistry = createSchemaRegistry(schemas);
for (const schema of schemas) assertSupportedSchema(schema, { registry: schemaRegistry });

function schemaValidator(name) {
  const schema = schemaRegistry.get(`urn:pptx-compiler:schema:${name}:0.1.0`);
  return (value) => validateJson(value, schema, {
    rootSchema: schema,
    registry: schemaRegistry
  }).length === 0;
}

const validators = Object.freeze({
  validateCapabilityRegistry: schemaValidator("capability-registry"),
  validateDeckSpec: schemaValidator("deck-spec"),
  validateProjectOverlay: schemaValidator("project-overlay"),
  validateTemplateIndex: schemaValidator("template-index")
});
const resolverDependencies = mixedOrderedResolverDependencies(validators);
const documents = await createPublicMixedOrderedDocuments();
const candidateRuntime = await createPublicMixedOrderedRuntime(documents);
const reviewedCandidate = await createPublicMixedOrderedCandidate({
  documents,
  runtime: candidateRuntime,
  resolverDependencies
});

const evidenceTokens = Object.freeze({
  mechanical: Object.freeze({ token: "mixed-mechanical" }),
  render: Object.freeze({ token: "mixed-render" }),
  pixelReview: Object.freeze({ token: "mixed-pixel-review" }),
  compatibility: Object.freeze({ token: "mixed-compatibility" })
});

function evidenceResult(kind, expected) {
  const common = {
    receiptVersion: "0.1.0",
    candidateSha256: expected.candidateSha256,
    candidateRecordSha256: expected.candidateRecordSha256
  };
  if (kind === "mechanical") {
    return {
      ...common,
      receiptType: "mechanical",
      slideIds: [...expected.slideIds],
      status: "pass"
    };
  }
  if (kind === "render") {
    return {
      ...common,
      receiptType: "render",
      renderSetId: "mixed-candidate-render",
      slideIds: [...expected.slideIds],
      status: "pass"
    };
  }
  if (kind === "pixelReview") {
    return {
      ...common,
      receiptType: "pixel-review",
      renderSetId: expected.renderSetId,
      reviewerMode: "independent-pixel-only",
      status: "pass",
      verdict: "pass",
      blockerCount: 0,
      majorCount: 0
    };
  }
  return {
    ...common,
    receiptType: "compatibility",
    supportMatrixItemId: "macos-powerpoint-automation",
    evidenceRecordId: "urn:pptx-compiler:compatibility:mixed-ordered-local-001",
    operation: expected.operation,
    status: "passed"
  };
}

function deliveryDependencies(overrides = {}) {
  const authenticate = (kind) => (receipt, expected) => {
    if (receipt !== evidenceTokens[kind]) throw new Error("unauthenticated-receipt");
    const result = evidenceResult(kind, expected);
    return overrides[kind] ? overrides[kind](result, expected) : result;
  };
  return {
    authenticateCompatibilityReceipt: authenticate("compatibility"),
    authenticateMechanicalReceipt: authenticate("mechanical"),
    authenticatePixelReviewReceipt: authenticate("pixelReview"),
    authenticateRenderReceipt: authenticate("render"),
    validateBuildArtifact: schemaValidator("build-artifact"),
    validateCapabilityRegistry: validators.validateCapabilityRegistry,
    validateDeckSpec: validators.validateDeckSpec,
    validateProjectOverlay: validators.validateProjectOverlay,
    validateQaReport: schemaValidator("qa-report"),
    validateTemplateIndex: validators.validateTemplateIndex,
    validateTemplateProfile: schemaValidator("template-profile")
  };
}

function candidateInput(candidate = reviewedCandidate) {
  return {
    candidateBytes: Buffer.from(candidate.candidateBytes),
    candidateRecordBytes: Buffer.from(candidate.candidateRecordBytes),
    candidateFileName: candidate.candidateFileName
  };
}

function rewrapCandidate(mutator) {
  const deck = clone(reviewedCandidate.record.deck);
  mutator(deck);
  const record = createOrderedCandidateBuildRecord({
    candidateBytes: reviewedCandidate.candidateBytes,
    candidateFileName: reviewedCandidate.candidateFileName,
    baseArtifactSha256: reviewedCandidate.record.baseArtifactSha256,
    orderedDeck: deck
  });
  return {
    candidateBytes: Buffer.from(record.candidateBytes),
    candidateRecordBytes: Buffer.from(record.recordBytes),
    candidateFileName: reviewedCandidate.candidateFileName
  };
}

async function createCase({
  mutateBundle,
  candidate,
  dependencyOverrides,
  runtime
} = {}) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "mixed-final-")));
  await mkdir(path.join(root, "workspace", "output"), { recursive: true });
  const projectContext = createProjectContext({
    projectRoot: root,
    projectConfig: createMixedOrderedProjectConfig(),
    dependencies: { validateProjectConfig: schemaValidator("project-config") }
  });
  const projectBundle = {
    projectContext,
    templateProfile: clone(documents.templateProfile),
    templateIndex: clone(documents.templateIndex),
    capabilityRegistry: clone(documents.capabilityRegistry),
    projectOverlay: clone(documents.projectOverlay),
    deckSpec: clone(documents.deckSpec),
    sourceTemplateBytes: Buffer.from(documents.sourceTemplateBytes)
  };
  mutateBundle?.(projectBundle);
  return {
    root,
    options: {
      candidate: candidate ?? candidateInput(),
      projectBundle,
      evidence: {
        mechanicalReceipt: evidenceTokens.mechanical,
        renderReceipt: evidenceTokens.render,
        pixelReviewReceipt: evidenceTokens.pixelReview,
        compatibilityReceipt: evidenceTokens.compatibility
      },
      output: {
        buildId: "mixed-build",
        qaReportId: "mixed-qa",
        publishPath: "workspace/output/mixed-build/mixed-ordered-candidate.pptx"
      },
      dependencies: deliveryDependencies(dependencyOverrides),
      runtime: runtime ?? await createPublicMixedOrderedRuntime(documents)
    }
  };
}

function assertDeliveryError(error, code, pointer) {
  assert.ok(error instanceof ReceiptBoundFinalDeliveryError);
  assert.equal(error.code, code);
  assert.equal(error.pointer, pointer);
  return true;
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("mixed ordered delivery regenerates clone, OMML, and native slides exactly", async () => {
  const { root, options } = await createCase();
  try {
    const plan = await prepareReceiptBoundMixedOrderedFinalDelivery(options);
    const published = await publishReceiptBoundFinalDelivery({ plan });
    assert.equal(published.verificationProfile, "receipt-bound-mixed-ordered-delivery");
    assert.equal(published.sha256, digest(reviewedCandidate.candidateBytes));
    const directory = path.join(root, "workspace", "output", "mixed-build");
    const [publishedBytes, buildArtifact, qaReport] = await Promise.all([
      readFile(path.join(directory, "mixed-ordered-candidate.pptx")),
      readJsonFile(path.join(directory, "mixed-ordered-candidate.build.json")),
      readJsonFile(path.join(directory, "mixed-ordered-candidate.qa.json"))
    ]);
    assert.deepEqual(publishedBytes, reviewedCandidate.candidateBytes);
    assert.deepEqual(buildArtifact.slides.map((slide) => slide.capabilityId), [
      "source-slide-clone-fill",
      "formula-transplant",
      "native-card-arrow"
    ]);
    assert.deepEqual(
      new Set(qaReport.checks.map((check) => check.qaContractId)),
      new Set(documents.capabilityRegistry.capabilities.map((item) => item.qaContractId))
    );
    assert.equal(qaReport.decision, "pass");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("mixed ordered delivery rejects readable story drift", async (t) => {
  for (const [name, expectedPointer, mutateBundle] of [
    ["setup title", "/options/candidate/projection/archiveBytes", (bundle) => {
      bundle.deckSpec.slides[0].payload.title = "Unreviewed setup";
    }],
    ["formula", "/options/candidate/projection/assembly", (bundle) => {
      bundle.deckSpec.slides[1].payload.latex = "\\frac{2}{3}";
    }],
    ["decision label", "/options/candidate/projection/archiveBytes", (bundle) => {
      bundle.deckSpec.slides[2].payload.label = "Unreviewed decision";
    }]
  ]) {
    await t.test(name, async () => {
      const { root, options } = await createCase({ mutateBundle });
      try {
        await assert.rejects(
          prepareReceiptBoundMixedOrderedFinalDelivery(options),
          (error) => assertDeliveryError(
            error,
            "FINAL_DELIVERY_CANDIDATE_INVALID",
            expectedPointer
          )
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }
});

test("mixed source-build roles cannot be swapped in a replayable candidate record", () => {
  assert.throws(
    () => rewrapCandidate((deck) => {
      [deck.slides[0].sourceBuild, deck.slides[1].sourceBuild] =
        [deck.slides[1].sourceBuild, deck.slides[0].sourceBuild];
    }),
    (error) => {
      assert.equal(error.code, "CANDIDATE_BUILD_RECORD_REPLAY_MISMATCH");
      assert.equal(error.pointer, "/deck/slides/0/sourceBuild/layoutIr/slideId");
      return true;
    }
  );
});

test("a later mixed preflight failure prevents every product executor", async () => {
  let executeCalls = 0;
  const runtime = await createPublicMixedOrderedRuntime(documents, {
    onExecute() { executeCalls += 1; },
    onPreflight(_capabilityId, invocationId) {
      if (invocationId === "mixed-resolution") throw new Error("late-preflight-rejection");
    }
  });
  executeCalls = 0;
  const { root, options } = await createCase({ runtime });
  try {
    await assert.rejects(
      prepareReceiptBoundMixedOrderedFinalDelivery(options),
      (error) => assertDeliveryError(
        error,
        "FINAL_DELIVERY_CANDIDATE_INVALID",
        "/options/candidate/projection/dispatch"
      )
    );
    assert.equal(executeCalls, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("mixed receipts cover all slides and the ordered compatibility operation", async (t) => {
  await t.test("mechanical coverage", async () => {
    const { root, options } = await createCase({
      dependencyOverrides: {
        mechanical(result) {
          result.slideIds.pop();
          return result;
        }
      }
    });
    try {
      await assert.rejects(
        prepareReceiptBoundMixedOrderedFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_EVIDENCE_INVALID",
          "/evidence/mechanical"
        )
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  await t.test("compatibility operation", async () => {
    const { root, options } = await createCase({
      dependencyOverrides: {
        compatibility(result) {
          result.operation = "shape-name-edit-save-reopen";
          return result;
        }
      }
    });
    try {
      await assert.rejects(
        prepareReceiptBoundMixedOrderedFinalDelivery(options),
        (error) => assertDeliveryError(
          error,
          "FINAL_DELIVERY_EVIDENCE_INVALID",
          "/evidence/compatibility"
        )
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("mixed preparation snapshots readable contracts before async execution", async () => {
  const { root, options } = await createCase();
  try {
    const preparing = prepareReceiptBoundMixedOrderedFinalDelivery(options);
    options.projectBundle.deckSpec.slides[0].payload.title = "Late caller mutation";
    options.candidate.candidateBytes.fill(0);
    const plan = await preparing;
    const published = await publishReceiptBoundFinalDelivery({ plan });
    assert.equal(published.sha256, digest(reviewedCandidate.candidateBytes));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("mixed publication cancellation before commit removes the complete delivery directory", async () => {
  const { root, options } = await createCase();
  try {
    const plan = await prepareReceiptBoundMixedOrderedFinalDelivery(options);
    const controller = new AbortController();
    let abortedReads = 0;
    const signal = new Proxy(controller.signal, {
      get(target, property) {
        if (property === "aborted") {
          abortedReads += 1;
          return abortedReads >= 9;
        }
        return Reflect.get(target, property, target);
      }
    });
    await assert.rejects(
      publishReceiptBoundFinalDelivery({ plan, signal }),
      (error) => {
        assertDeliveryError(error, "FINAL_DELIVERY_ABORTED", "/options/signal");
        assert.equal(error.commitState, "not-committed");
        assert.equal(error.rollbackStatus, "complete");
        return true;
      }
    );
    assert.equal(abortedReads, 9);
    assert.deepEqual(await readdir(path.join(root, "workspace", "output")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("mixed publication failure after BuildArtifact is commit-uncertain and non-destructive", async () => {
  const { root, options } = await createCase();
  try {
    const plan = await prepareReceiptBoundMixedOrderedFinalDelivery(options);
    const controller = new AbortController();
    let abortedReads = 0;
    const signal = new Proxy(controller.signal, {
      get(target, property) {
        if (property === "aborted") {
          abortedReads += 1;
          return abortedReads >= 10;
        }
        return Reflect.get(target, property, target);
      }
    });
    await assert.rejects(
      publishReceiptBoundFinalDelivery({ plan, signal }),
      (error) => {
        assertDeliveryError(
          error,
          "FINAL_DELIVERY_COMMIT_UNCERTAIN",
          "/deliveryDirectory"
        );
        assert.equal(error.commitState, "uncertain");
        assert.equal(error.rollbackStatus, "not-attempted");
        return true;
      }
    );
    assert.equal(abortedReads, 10);
    const directory = path.join(root, "workspace", "output", "mixed-build");
    for (const fileName of [
      "mixed-ordered-candidate.candidate.json",
      "mixed-ordered-candidate.qa.json",
      "mixed-ordered-candidate.pptx",
      "mixed-ordered-candidate.build.json"
    ]) {
      assert.equal((await lstat(path.join(directory, fileName))).isFile(), true);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
