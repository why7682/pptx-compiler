export function preflightProbe(invocation) {
  return invocation.bindings.length === 1 &&
    invocation.bindings[0].role === "probe-target";
}

export function executeProbe() {
  return {
    accepted: true,
    resultType: "dispatcher-conformance-probe"
  };
}

export const probeQaAssertions = Object.freeze([
  Object.freeze({
    assertionId: "binding-contract",
    assert({ invocation }) {
      return invocation.bindings.length === 1 &&
        invocation.bindings[0].cardinality === "exactly-one";
    }
  }),
  Object.freeze({
    assertionId: "output-contract",
    assert({ output }) {
      return output.accepted === true &&
        output.resultType === "dispatcher-conformance-probe";
    }
  })
]);
