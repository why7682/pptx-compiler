import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPOSED_SLIDE_PLAN_VERSION,
  createBoundedSlotSlideLayoutIr,
  createFixedSlideLayoutIr,
  resolveSlideLayoutIr,
  SLIDE_LAYOUT_IR_VERSION,
  SlideLayoutIrError
} from "../packages/core/src/slide-layout-ir.mjs";

function node({
  nodeId,
  sourceKind = "template-shape",
  sourceRef = nodeId,
  semanticSlotId = nodeId,
  role = "content",
  geometry,
  paintOutsetEmu = 0,
  zOrder,
  placementIntent = "template-fixed"
}) {
  return {
    nodeId,
    sourceKind,
    sourceRef,
    semanticSlotId,
    role,
    geometry,
    paintOutsetEmu,
    zOrder,
    placementIntent
  };
}

function input(candidateGeometry = { x: 100, y: 300, cx: 400, cy: 200 }, paintOutsetEmu = 10) {
  return {
    slideId: "synthetic-slide",
    canvas: { cx: 1_000, cy: 1_000 },
    nodes: [
      node({
        nodeId: "source-title",
        geometry: { x: 100, y: 50, cx: 400, cy: 150 },
        zOrder: 0
      }),
      node({
        nodeId: "candidate-card",
        sourceKind: "native-component",
        sourceRef: "native-card-arrow",
        semanticSlotId: "decision-region",
        geometry: candidateGeometry,
        paintOutsetEmu,
        zOrder: 1,
        placementIntent: "legacy-absolute-fixed"
      })
    ]
  };
}

function assertLayoutError(error, code, pointer) {
  assert.ok(error instanceof SlideLayoutIrError);
  assert.equal(error.code, code);
  assert.equal(error.pointer, pointer);
  assert.deepEqual(error.toJSON(), { code, pointer });
  return true;
}

test("SlideLayoutIR preserves constraints and deterministically recomputes a frozen plan", () => {
  assert.equal(SLIDE_LAYOUT_IR_VERSION, "0.1.0");
  assert.equal(COMPOSED_SLIDE_PLAN_VERSION, "0.1.0");
  const layoutIr = createFixedSlideLayoutIr(input());
  const first = resolveSlideLayoutIr(layoutIr);
  const persisted = JSON.parse(JSON.stringify(layoutIr));
  const second = resolveSlideLayoutIr(persisted);

  assert.deepEqual(second, first);
  assert.equal(first.planType, "composed-slide-plan");
  assert.equal(first.constraintReceipt.status, "pass");
  assert.deepEqual(first.constraintReceipt.checkedConstraintIds, [
    "slide-content-containment",
    "slide-content-non-overlap"
  ]);
  assert.deepEqual(first.constraintReceipt.occupancyChecks, [{
    leftNodeId: "source-title",
    rightNodeId: "candidate-card",
    status: "clear"
  }]);
  assert.equal(Object.isFrozen(layoutIr), true);
  assert.equal(Object.isFrozen(layoutIr.nodes[0].sizing), true);
  assert.equal(Object.isFrozen(first.nodes[1].paintBounds), true);
});

test("AABB occupancy uses paint bounds and permits only edge contact", () => {
  const edgeContact = resolveSlideLayoutIr(createFixedSlideLayoutIr(
    input({ x: 100, y: 200, cx: 400, cy: 200 }, 0)
  ));
  assert.equal(edgeContact.constraintReceipt.occupancyChecks[0].status, "clear");

  assert.throws(
    () => resolveSlideLayoutIr(createFixedSlideLayoutIr(
      input({ x: 100, y: 210, cx: 400, cy: 200 }, 11)
    )),
    (error) => assertLayoutError(
      error,
      "SLIDE_LAYOUT_IR_OCCUPANCY_CONFLICT",
      "/layoutIr/constraints/1"
    )
  );
});

test("persisted IR rejects sizing and constraint drift instead of guessing", () => {
  const sizingDrift = JSON.parse(JSON.stringify(createFixedSlideLayoutIr(input())));
  sizingDrift.nodes[1].sizing.maxCy += 1;
  assert.throws(
    () => resolveSlideLayoutIr(sizingDrift),
    (error) => assertLayoutError(
      error,
      "SLIDE_LAYOUT_IR_CONSTRAINT_INVALID",
      "/layoutIr/nodes/1"
    )
  );

  const constraintDrift = JSON.parse(JSON.stringify(createFixedSlideLayoutIr(input())));
  constraintDrift.constraints[1].subjectNodeIds.pop();
  assert.throws(
    () => resolveSlideLayoutIr(constraintDrift),
    (error) => assertLayoutError(
      error,
      "SLIDE_LAYOUT_IR_CONSTRAINT_INVALID",
      "/layoutIr/constraints"
    )
  );
});

test("IR creation rejects unknown fields and accessors", () => {
  const extra = input();
  extra.nodes[0].repair = true;
  assert.throws(
    () => createFixedSlideLayoutIr(extra),
    (error) => assertLayoutError(
      error,
      "SLIDE_LAYOUT_IR_ARGUMENT_INVALID",
      "/options/nodes/0"
    )
  );

  const accessor = input();
  Object.defineProperty(accessor.nodes[1], "geometry", {
    enumerable: true,
    get() {
      throw new Error("must-not-run");
    }
  });
  assert.throws(
    () => createFixedSlideLayoutIr(accessor),
    (error) => assertLayoutError(
      error,
      "SLIDE_LAYOUT_IR_ARGUMENT_INVALID",
      "/options/nodes/1/geometry"
    )
  );
});

test("array admission snapshots descriptors instead of trusting live Proxy length", () => {
  const options = input();
  let lengthReads = 0;
  options.nodes = new Proxy(options.nodes, {
    get(target, property, receiver) {
      if (property === "length") {
        lengthReads += 1;
        return lengthReads < 5 ? 1 : 0;
      }
      return Reflect.get(target, property, receiver);
    }
  });
  const layoutIr = createFixedSlideLayoutIr(options);
  assert.equal(layoutIr.nodes.length, 2);
  assert.equal(lengthReads, 0);

  const trap = input();
  trap.nodes = new Proxy(trap.nodes, {
    ownKeys() {
      throw new Error("must-not-escape");
    }
  });
  assert.throws(
    () => createFixedSlideLayoutIr(trap),
    (error) => assertLayoutError(
      error,
      "SLIDE_LAYOUT_IR_ARGUMENT_INVALID",
      "/options/nodes"
    )
  );

  const revoked = input();
  const revocable = Proxy.revocable(revoked.nodes, {});
  revoked.nodes = revocable.proxy;
  revocable.revoke();
  assert.throws(
    () => createFixedSlideLayoutIr(revoked),
    (error) => assertLayoutError(
      error,
      "SLIDE_LAYOUT_IR_ARGUMENT_INVALID",
      "/options/nodes"
    )
  );
});

function boundedSlotInput(size = { cx: 400, cy: 200 }) {
  return {
    slideId: "synthetic-slide",
    canvas: { cx: 1_000, cy: 1_000 },
    fixedNodes: [node({
      nodeId: "source-title",
      geometry: { x: 100, y: 50, cx: 400, cy: 150 },
      zOrder: 0
    })],
    slot: {
      slotId: "decision-region",
      outerBox: { x: 100, y: 250, cx: 800, cy: 500 },
      padding: { top: 50, right: 50, bottom: 50, left: 50 },
      alignX: "center",
      alignY: "center",
      allowedSourceKind: "native-component",
      allowedSourceRef: "native-card-arrow"
    },
    placement: {
      nodeId: "candidate-card",
      sourceKind: "native-component",
      sourceRef: "native-card-arrow",
      role: "content",
      slotRef: "decision-region",
      size,
      paintOutsetEmu: 10,
      zOrder: 1,
      placementIntent: "slot-aligned-fixed"
    }
  };
}

test("bounded slot IR preserves the editable constraint calculation and frozen result", () => {
  const layoutIr = createBoundedSlotSlideLayoutIr(boundedSlotInput());
  const first = resolveSlideLayoutIr(layoutIr);
  const second = resolveSlideLayoutIr(JSON.parse(JSON.stringify(layoutIr)));

  assert.deepEqual(second, first);
  assert.equal(layoutIr.inputProfile, "bounded-slot-placement");
  assert.deepEqual(layoutIr.slots[0].contentBox, {
    x: 150,
    y: 300,
    cx: 700,
    cy: 400
  });
  assert.deepEqual(layoutIr.placementRequests[0].size, { cx: 400, cy: 200 });
  assert.deepEqual(first.nodes[1].box, { x: 300, y: 400, cx: 400, cy: 200 });
  assert.deepEqual(first.constraintReceipt.slotChecks, [{
    nodeId: "candidate-card",
    slotId: "decision-region",
    status: "pass"
  }]);
  assert.match(first.layoutIrDigest, /^[0-9a-f]{64}$/u);
  assert.match(first.planDigest, /^[0-9a-f]{64}$/u);
});

test("bounded slot persistence treats JSON object order as non-semantic", () => {
  const layoutIr = createBoundedSlotSlideLayoutIr(boundedSlotInput());
  const persisted = JSON.parse(JSON.stringify(layoutIr));
  persisted.slots[0] = Object.fromEntries(Object.entries(persisted.slots[0]).reverse());
  persisted.slots[0].outerBox = Object.fromEntries(
    Object.entries(persisted.slots[0].outerBox).reverse()
  );
  persisted.placementRequests[0] = Object.fromEntries(
    Object.entries(persisted.placementRequests[0]).reverse()
  );
  persisted.placementRequests[0].size = Object.fromEntries(
    Object.entries(persisted.placementRequests[0].size).reverse()
  );

  assert.deepEqual(resolveSlideLayoutIr(persisted), resolveSlideLayoutIr(layoutIr));
});

test("bounded slot IR rejects capacity and persisted derivation drift", () => {
  assert.throws(
    () => createBoundedSlotSlideLayoutIr(boundedSlotInput({ cx: 701, cy: 200 })),
    (error) => assertLayoutError(
      error,
      "SLIDE_LAYOUT_IR_CONSTRAINT_INVALID",
      "/options/placement/size"
    )
  );

  const drift = JSON.parse(JSON.stringify(createBoundedSlotSlideLayoutIr(boundedSlotInput())));
  drift.slots[0].contentBox.x += 1;
  assert.throws(
    () => resolveSlideLayoutIr(drift),
    (error) => assertLayoutError(
      error,
      "SLIDE_LAYOUT_IR_CONSTRAINT_INVALID",
      "/layoutIr/slots/0/contentBox"
    )
  );
});

test("bounded slot IR reserves the canvas root identity and cannot skip slot containment", () => {
  const reservedSlot = boundedSlotInput();
  reservedSlot.slot.slotId = "slide-canvas";
  reservedSlot.placement.slotRef = "slide-canvas";
  assert.throws(
    () => createBoundedSlotSlideLayoutIr(reservedSlot),
    (error) => assertLayoutError(
      error,
      "SLIDE_LAYOUT_IR_ARGUMENT_INVALID",
      "/options/slot/slotId"
    )
  );

  const reservedNode = boundedSlotInput();
  reservedNode.placement.nodeId = "slide-canvas";
  assert.throws(
    () => createBoundedSlotSlideLayoutIr(reservedNode),
    (error) => assertLayoutError(
      error,
      "SLIDE_LAYOUT_IR_ARGUMENT_INVALID",
      "/options/placement/nodeId"
    )
  );
});
