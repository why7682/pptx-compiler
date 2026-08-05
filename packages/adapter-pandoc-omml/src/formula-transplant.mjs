import {
  convertLatexToOmml,
  isCanonicalPandocOmmlFragment,
  isSupportedLatexMathExpression,
  PANDOC_OMML_ADAPTER_VERSION
} from "./pandoc-omml-adapter.mjs";

const FORMULA_TARGET_ROLE = "formula-target";

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactDataProperties(value, keys) {
  if (!isPlainRecord(value)) return false;
  const allowed = new Set(keys);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !allowed.has(key))) {
    return false;
  }
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
  });
}

function dataProperty(value, key) {
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

function isExactSingleItemArray(value) {
  if (!Array.isArray(value)) return false;
  const length = Object.getOwnPropertyDescriptor(value, "length");
  const item = Object.getOwnPropertyDescriptor(value, "0");
  const keys = Reflect.ownKeys(value);
  return length?.value === 1 && item?.enumerable === true &&
    Object.hasOwn(item, "value") && keys.length === 2 &&
    keys.every((key) => key === "0" || key === "length");
}

function isTargetBinding(value) {
  if (!hasExactDataProperties(value, [
    "role",
    "shapeBindingId",
    "containerKind",
    "containerKey",
    "shapeKey",
    "expectedKind",
    "cardinality"
  ])) {
    return false;
  }
  return dataProperty(value, "role") === FORMULA_TARGET_ROLE &&
    dataProperty(value, "containerKind") === "slide" &&
    dataProperty(value, "expectedKind") === "text-box" &&
    dataProperty(value, "cardinality") === "exactly-one";
}

export function preflightFormulaTransplant(invocation) {
  if (!isPlainRecord(invocation)) return false;
  const bindings = dataProperty(invocation, "bindings");
  const payload = dataProperty(invocation, "payload");
  return isExactSingleItemArray(bindings) &&
    isTargetBinding(dataProperty(bindings, "0")) &&
    hasExactDataProperties(payload, ["displayMode", "latex"]) &&
    dataProperty(payload, "displayMode") === "display" &&
    isSupportedLatexMathExpression(dataProperty(payload, "latex"));
}

export function createFormulaTransplantExecutor(options) {
  if (!hasExactDataProperties(options, ["adapter"])) {
    throw new TypeError("formula-transplant-options");
  }
  const adapter = dataProperty(options, "adapter");
  if (!hasExactDataProperties(adapter, [
    "adapterVersion",
    "adapterType",
    "availability",
    "reason",
    "pandocVersion"
  ]) || adapter.adapterVersion !== PANDOC_OMML_ADAPTER_VERSION ||
      adapter.adapterType !== "pandoc-omml-adapter" ||
      adapter.availability !== "available" || adapter.reason !== "ready") {
    throw new TypeError("formula-transplant-adapter-unavailable");
  }

  async function execute(invocation) {
    const binding = invocation.bindings[0];
    const conversion = await convertLatexToOmml({
      adapter,
      latex: invocation.payload.latex
    });
    return {
      planVersion: "0.1.0",
      planType: "formula-transplant-plan",
      outputSlideId: invocation.invocationId,
      clone: {
        operationId: "clone-source-slide",
        operationType: "clone-slide",
        sourceContainerKind: "slide",
        sourceSlideKey: binding.containerKey
      },
      replace: {
        operationId: "replace-formula-target",
        operationType: "replace-text-box-content-with-native-omml",
        role: FORMULA_TARGET_ROLE,
        targetBindingId: binding.shapeBindingId,
        targetShapeKey: binding.shapeKey,
        expectedKind: binding.expectedKind,
        applicationPolicy: "typed-rebuild-required"
      },
      formula: {
        componentType: "native-omml-formula",
        representation: "native-office-math",
        artifactKind: conversion.artifactKind,
        insertable: conversion.insertable,
        sourceFormat: "latex-math",
        displayMode: invocation.payload.displayMode,
        adapterProfileVersion: conversion.adapterProfileVersion,
        unboundOmmlFragment: conversion.ommlFragment
      }
    };
  }

  return Object.freeze({
    preflight: preflightFormulaTransplant,
    execute
  });
}

export const formulaTransplantQaAssertions = Object.freeze([
  Object.freeze({
    assertionId: "formula-target-binding-contract",
    assert({ invocation, output }) {
      const binding = invocation.bindings?.[0];
      return invocation.bindings?.length === 1 &&
        output.outputSlideId === invocation.invocationId &&
        output.clone?.sourceContainerKind === binding?.containerKind &&
        output.clone?.sourceSlideKey === binding?.containerKey &&
        output.replace?.role === FORMULA_TARGET_ROLE &&
        output.replace?.targetBindingId === binding?.shapeBindingId &&
        output.replace?.targetShapeKey === binding?.shapeKey &&
        output.replace?.expectedKind === binding?.expectedKind;
    }
  }),
  Object.freeze({
    assertionId: "omml-application-boundary-contract",
    assert({ invocation, output }) {
      return output.formula?.componentType === "native-omml-formula" &&
        output.formula?.representation === "native-office-math" &&
        output.formula?.artifactKind === "unbound-omml-conformance-fragment" &&
        output.formula?.insertable === false &&
        output.formula?.sourceFormat === "latex-math" &&
        output.formula?.displayMode === invocation.payload?.displayMode &&
        output.formula?.adapterProfileVersion === PANDOC_OMML_ADAPTER_VERSION &&
        output.replace?.applicationPolicy === "typed-rebuild-required";
    }
  }),
  Object.freeze({
    assertionId: "omml-native-structure-contract",
    assert({ output }) {
      return isCanonicalPandocOmmlFragment(output.formula?.unboundOmmlFragment);
    }
  }),
  Object.freeze({
    assertionId: "omml-operation-contract",
    assert({ output }) {
      return output.planVersion === "0.1.0" &&
        output.planType === "formula-transplant-plan" &&
        output.clone?.operationId === "clone-source-slide" &&
        output.clone?.operationType === "clone-slide" &&
        output.replace?.operationId === "replace-formula-target" &&
        output.replace?.operationType === "replace-text-box-content-with-native-omml";
    }
  })
]);
