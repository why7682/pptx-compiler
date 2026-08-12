import assert from "node:assert/strict";
import test from "node:test";

import {
  prepareVisualEvidencePlan,
  VISUAL_EVIDENCE_PLAN_VERSION,
  VisualEvidencePlanError
} from "../labs/visual-review-agent/visual-evidence-plan.mjs";

function input() {
  return {
    images: [
      { imageId: "page-two-after", bytes: Buffer.from("second page after", "utf8") },
      { imageId: "page-one-before", bytes: Buffer.from("first page", "utf8") },
      { imageId: "page-two-before", bytes: Buffer.from("second page before", "utf8") },
      { imageId: "page-one-after", bytes: Buffer.from("first page", "utf8") }
    ],
    comparisons: [
      {
        comparisonId: "page-two-roundtrip",
        leftImageId: "page-two-before",
        rightImageId: "page-two-after"
      },
      {
        comparisonId: "page-one-roundtrip",
        leftImageId: "page-one-before",
        rightImageId: "page-one-after"
      }
    ]
  };
}

function assertPlanError(error, pointer) {
  assert.ok(error instanceof VisualEvidencePlanError);
  assert.equal(error.code, "VISUAL_EVIDENCE_PLAN_INVALID");
  assert.equal(error.pointer, pointer);
  return true;
}

test("exact image equality collapses redundant model inputs while differences remain paired", () => {
  const plan = prepareVisualEvidencePlan(input());
  assert.equal(plan.planVersion, VISUAL_EVIDENCE_PLAN_VERSION);
  assert.equal(plan.planType, "visual-evidence-dedup-plan");
  assert.deepEqual(plan.comparisons, [
    {
      comparisonId: "page-one-roundtrip",
      leftImageId: "page-one-before",
      rightImageId: "page-one-after",
      relation: "exact-byte-equal",
      reviewImageIds: ["page-one-after"]
    },
    {
      comparisonId: "page-two-roundtrip",
      leftImageId: "page-two-before",
      rightImageId: "page-two-after",
      relation: "different",
      reviewImageIds: ["page-two-before", "page-two-after"]
    }
  ]);
  assert.deepEqual(plan.reviewImageIds, [
    "page-one-after", "page-two-after", "page-two-before"
  ]);
  assert.equal(plan.images.find(({ imageId }) => imageId === "page-one-before")
    .representativeImageId, "page-one-after");
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.comparisons[0].reviewImageIds), true);
});

test("the relationship plan is deterministic across caller ordering and detached from bytes", () => {
  const source = input();
  const first = prepareVisualEvidencePlan(source);
  source.images.reverse();
  source.comparisons.reverse();
  const second = prepareVisualEvidencePlan(source);
  assert.deepEqual(second, first);
  source.images[0].bytes.fill(0);
  assert.deepEqual(first, second);
});

test("equality is decided from bytes rather than caller-supplied identity or digest", () => {
  const source = input();
  source.images[3].bytes = Buffer.from("not the first page", "utf8");
  const plan = prepareVisualEvidencePlan(source);
  assert.equal(plan.comparisons[0].relation, "different");
  assert.deepEqual(plan.comparisons[0].reviewImageIds, [
    "page-one-before", "page-one-after"
  ]);
});

test("ambiguous relationships and unreferenced evidence fail closed", () => {
  const duplicatePair = input();
  duplicatePair.comparisons.push({
    comparisonId: "same-pair-reversed",
    leftImageId: "page-one-after",
    rightImageId: "page-one-before"
  });
  assert.throws(
    () => prepareVisualEvidencePlan(duplicatePair),
    (error) => assertPlanError(error, "/options/comparisons")
  );

  const missing = input();
  missing.comparisons[0].rightImageId = "missing-image";
  assert.throws(
    () => prepareVisualEvidencePlan(missing),
    (error) => assertPlanError(error, "/options/comparisons/0/rightImageId")
  );

  const unreferenced = input();
  unreferenced.images.push({ imageId: "unused-image", bytes: Buffer.from("unused", "utf8") });
  assert.throws(
    () => prepareVisualEvidencePlan(unreferenced),
    (error) => assertPlanError(error, "/options/images")
  );
});

test("accessors and unsupported or oversized byte sources are rejected before copying", () => {
  let invoked = false;
  const accessor = input();
  Object.defineProperty(accessor.images[0], "bytes", {
    enumerable: true,
    get() {
      invoked = true;
      return Buffer.from("hidden", "utf8");
    }
  });
  assert.throws(
    () => prepareVisualEvidencePlan(accessor),
    (error) => assertPlanError(error, "/options/images/0/bytes")
  );
  assert.equal(invoked, false);

  assert.throws(
    () => prepareVisualEvidencePlan(new Proxy(input(), {})),
    (error) => assertPlanError(error, "/options")
  );

  const proxiedBytes = input();
  proxiedBytes.images[0].bytes = new Proxy(proxiedBytes.images[0].bytes, {});
  assert.throws(
    () => prepareVisualEvidencePlan(proxiedBytes),
    (error) => assertPlanError(error, "/options/images/0/bytes")
  );

  const shared = input();
  shared.images[0].bytes = new Uint8Array(new SharedArrayBuffer(4));
  assert.throws(
    () => prepareVisualEvidencePlan(shared),
    (error) => assertPlanError(error, "/options/images/0/bytes")
  );

  const oversized = input();
  oversized.images[0].bytes = Buffer.alloc((16 * 1024 * 1024) + 1);
  assert.throws(
    () => prepareVisualEvidencePlan(oversized),
    (error) => assertPlanError(error, "/options/images/0/bytes")
  );
});

test("typed-array and backing-buffer metadata cannot forge admission bounds", () => {
  let byteLengthGetterInvoked = false;
  const forgedLength = input();
  Object.defineProperty(forgedLength.images[0].bytes, "byteLength", {
    configurable: true,
    get() {
      byteLengthGetterInvoked = true;
      return 1;
    }
  });
  assert.throws(
    () => prepareVisualEvidencePlan(forgedLength),
    (error) => assertPlanError(error, "/options/images/0/bytes")
  );
  assert.equal(byteLengthGetterInvoked, false);

  let bufferGetterInvoked = false;
  const forgedBuffer = input();
  Object.defineProperty(forgedBuffer.images[0].bytes, "buffer", {
    configurable: true,
    get() {
      bufferGetterInvoked = true;
      return new ArrayBuffer(1);
    }
  });
  assert.throws(
    () => prepareVisualEvidencePlan(forgedBuffer),
    (error) => assertPlanError(error, "/options/images/0/bytes")
  );
  assert.equal(bufferGetterInvoked, false);

  const forgedOversizedLength = input();
  const oversized = Buffer.alloc((16 * 1024 * 1024) + 1);
  Object.defineProperty(oversized, "byteLength", { configurable: true, value: 1 });
  forgedOversizedLength.images[0].bytes = oversized;
  assert.throws(
    () => prepareVisualEvidencePlan(forgedOversizedLength),
    (error) => assertPlanError(error, "/options/images/0/bytes")
  );

  let resizableGetterInvoked = false;
  const forgedResizable = input();
  const ordinaryBacking = new ArrayBuffer(4);
  Object.defineProperty(ordinaryBacking, "resizable", {
    configurable: true,
    get() {
      resizableGetterInvoked = true;
      return false;
    }
  });
  forgedResizable.images[0].bytes = new Uint8Array(ordinaryBacking);
  assert.throws(
    () => prepareVisualEvidencePlan(forgedResizable),
    (error) => assertPlanError(error, "/options/images/0/bytes")
  );
  assert.equal(resizableGetterInvoked, false);

  const disguisedShared = input();
  const sharedBacking = new SharedArrayBuffer(4);
  Object.setPrototypeOf(sharedBacking, ArrayBuffer.prototype);
  Object.defineProperty(sharedBacking, "resizable", { configurable: true, value: false });
  disguisedShared.images[0].bytes = new Uint8Array(sharedBacking);
  assert.throws(
    () => prepareVisualEvidencePlan(disguisedShared),
    (error) => assertPlanError(error, "/options/images/0/bytes")
  );

  const ResizableArrayBuffer = ArrayBuffer;
  const resizableBacking = new ResizableArrayBuffer(4, { maxByteLength: 8 });
  if (resizableBacking.resizable === true) {
    const resizable = input();
    resizable.images[0].bytes = new Uint8Array(resizableBacking);
    assert.throws(
      () => prepareVisualEvidencePlan(resizable),
      (error) => assertPlanError(error, "/options/images/0/bytes")
    );
  }
});

test("canonical byte representatives are reused across different comparison pairs", () => {
  const plan = prepareVisualEvidencePlan({
    images: [
      { imageId: "alpha-before", bytes: Buffer.from("same", "utf8") },
      { imageId: "alpha-after", bytes: Buffer.from("same", "utf8") },
      { imageId: "beta-before", bytes: Buffer.from("same", "utf8") },
      { imageId: "beta-after", bytes: Buffer.from("different", "utf8") }
    ],
    comparisons: [
      {
        comparisonId: "alpha-roundtrip",
        leftImageId: "alpha-before",
        rightImageId: "alpha-after"
      },
      {
        comparisonId: "beta-roundtrip",
        leftImageId: "beta-before",
        rightImageId: "beta-after"
      }
    ]
  });

  assert.deepEqual(plan.comparisons[0].reviewImageIds, ["alpha-after"]);
  assert.deepEqual(plan.comparisons[1].reviewImageIds, ["alpha-after", "beta-after"]);
  assert.deepEqual(plan.reviewImageIds, ["alpha-after", "beta-after"]);
});
