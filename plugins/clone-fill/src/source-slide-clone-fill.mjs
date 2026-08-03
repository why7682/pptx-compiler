const BODY_ROLE = "body";
const TITLE_ROLE = "title";
const MAX_BODY_PARAGRAPHS = 16;
const MAX_TITLE_BYTES = 1024;
const MAX_BODY_PARAGRAPH_BYTES = 8192;
const MAX_INVOCATION_TEXT_BYTES = 32 * 1024;
const encoder = new TextEncoder();

function isSafeText(value) {
  if (typeof value !== "string" || value.length === 0 || !/\S/u.test(value) || /\p{Cf}/u.test(value)) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const first = value.charCodeAt(index);
    let codePoint = first;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || second < 0xdc00 || second > 0xdfff) return false;
      codePoint = ((first - 0xd800) * 0x400) + second - 0xdc00 + 0x10000;
      index += 1;
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      return false;
    }
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f) ||
        codePoint === 0x2028 || codePoint === 0x2029 ||
        (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
        (codePoint & 0xfffe) === 0xfffe) {
      return false;
    }
  }
  return true;
}

function textBytes(value, maximum) {
  if (!isSafeText(value) || value.length > maximum) return Number.POSITIVE_INFINITY;
  return encoder.encode(value).byteLength;
}

function bindingContract(binding, role) {
  return binding !== null && typeof binding === "object" &&
    binding.role === role &&
    binding.containerKind === "slide" &&
    binding.expectedKind === "text-box" &&
    binding.cardinality === "exactly-one";
}

export function preflightSourceSlideCloneFill(invocation) {
  if (invocation === null || typeof invocation !== "object" ||
      !Array.isArray(invocation.bindings) || invocation.bindings.length !== 2 ||
      invocation.payload === null || typeof invocation.payload !== "object") {
    return false;
  }
  const [bodyBinding, titleBinding] = invocation.bindings;
  if (!bindingContract(bodyBinding, BODY_ROLE) ||
      !bindingContract(titleBinding, TITLE_ROLE) ||
      bodyBinding.containerKey !== titleBinding.containerKey ||
      bodyBinding.shapeBindingId === titleBinding.shapeBindingId ||
      bodyBinding.shapeKey === titleBinding.shapeKey) {
    return false;
  }
  const { body, title } = invocation.payload;
  if (!Array.isArray(body) || body.length < 1 || body.length > MAX_BODY_PARAGRAPHS ||
      textBytes(title, MAX_TITLE_BYTES) > MAX_TITLE_BYTES) {
    return false;
  }
  let totalBytes = textBytes(title, MAX_TITLE_BYTES);
  for (const paragraph of body) {
    const bytes = textBytes(paragraph, MAX_BODY_PARAGRAPH_BYTES);
    if (bytes > MAX_BODY_PARAGRAPH_BYTES) return false;
    totalBytes += bytes;
    if (totalBytes > MAX_INVOCATION_TEXT_BYTES) return false;
  }
  return true;
}

export function executeSourceSlideCloneFill(invocation) {
  const [bodyBinding, titleBinding] = invocation.bindings;
  return {
    planVersion: "0.1.0",
    planType: "source-slide-clone-fill-plan",
    outputSlideId: invocation.invocationId,
    clone: {
      operationId: "clone-source-slide",
      operationType: "clone-slide",
      sourceContainerKind: "slide",
      sourceSlideKey: bodyBinding.containerKey
    },
    fills: [
      {
        operationId: "fill-body",
        operationType: "replace-cloned-shape-text",
        role: BODY_ROLE,
        shapeBindingId: bodyBinding.shapeBindingId,
        sourceShapeKey: bodyBinding.shapeKey,
        expectedKind: bodyBinding.expectedKind,
        paragraphs: [...invocation.payload.body]
      },
      {
        operationId: "fill-title",
        operationType: "replace-cloned-shape-text",
        role: TITLE_ROLE,
        shapeBindingId: titleBinding.shapeBindingId,
        sourceShapeKey: titleBinding.shapeKey,
        expectedKind: titleBinding.expectedKind,
        paragraphs: [invocation.payload.title]
      }
    ]
  };
}

function arraysEqual(left, right) {
  return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length && left.every((value, index) => value === right[index]);
}

export const sourceSlideCloneFillQaAssertions = Object.freeze([
  Object.freeze({
    assertionId: "binding-target-contract",
    assert({ invocation, output }) {
      if (!Array.isArray(invocation.bindings) || !Array.isArray(output.fills) ||
          invocation.bindings.length !== 2 || output.fills.length !== 2) {
        return false;
      }
      return output.fills.every((fill, index) => {
        const binding = invocation.bindings[index];
        return fill.role === binding.role &&
          fill.shapeBindingId === binding.shapeBindingId &&
          fill.sourceShapeKey === binding.shapeKey &&
          fill.expectedKind === binding.expectedKind;
      }) && output.fills[0].sourceShapeKey !== output.fills[1].sourceShapeKey;
    }
  }),
  Object.freeze({
    assertionId: "clone-source-contract",
    assert({ invocation, output }) {
      return output.outputSlideId === invocation.invocationId &&
        output.clone?.sourceContainerKind === "slide" &&
        output.clone?.sourceSlideKey === invocation.bindings?.[0]?.containerKey &&
        output.clone?.sourceSlideKey === invocation.bindings?.[1]?.containerKey;
    }
  }),
  Object.freeze({
    assertionId: "fill-role-order-contract",
    assert({ output }) {
      return output.clone?.operationId === "clone-source-slide" &&
        output.clone?.operationType === "clone-slide" &&
        Array.isArray(output.fills) && output.fills.length === 2 &&
        output.fills[0]?.operationId === "fill-body" &&
        output.fills[0]?.operationType === "replace-cloned-shape-text" &&
        output.fills[0]?.role === BODY_ROLE &&
        output.fills[1]?.operationId === "fill-title" &&
        output.fills[1]?.operationType === "replace-cloned-shape-text" &&
        output.fills[1]?.role === TITLE_ROLE;
    }
  }),
  Object.freeze({
    assertionId: "text-preservation-contract",
    assert({ invocation, output }) {
      return arraysEqual(output.fills?.[0]?.paragraphs, invocation.payload?.body) &&
        arraysEqual(output.fills?.[1]?.paragraphs, [invocation.payload?.title]);
    }
  })
]);
