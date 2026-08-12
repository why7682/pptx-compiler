# M2-001 Capability Runtime and Dispatcher Handoff

## Scope and claim boundary

M2-001 adds a dependency-free runtime-only capability registration and dispatch
contract. It turns declarative `CapabilityRegistry 0.1.0` entries into
executable entries only when a trusted host supplies every bound artifact and
the public support decision permits invocation.

The three-stage API is:

```js
const runtime = await createCapabilityRuntime({
  capabilityRegistry,
  registrations,
  dependencies: {
    validateCapabilityRegistry,
    validateSchemaDocument,
    resolveCapabilitySupport
  }
});

const plan = prepareCapabilityDispatch({ runtime, invocations });
const result = await executeCapabilityDispatch({ plan });
```

`createCapabilityRuntime()` performs atomic admission and public conformance
verification. `prepareCapabilityDispatch()` synchronously snapshots, validates,
and preflights the entire invocation batch before any executor runs.
`executeCapabilityDispatch()` authenticates and consumes the opaque plan before
its first `await`, then executes in source order.

This is dispatch infrastructure, not a product renderer or PPTX capability. The
only positive executor is the repository-owned `dispatcher-contract-probe`,
which returns a fixed data-only result and is machine-labeled
`dispatcher-conformance-only`. It is absent from the product support matrix and
cannot establish clone/fill, native DrawingML, package inspection, editability,
source isolation, or publication support. `supportClaimsEnabled` remains false
and every capability row remains non-supported.

## Serialized versus executable authority

The existing serialized contract set remains version `0.1.0` and is unchanged.
Its `executorId`, schema IDs, QA ID, and fixture IDs are declarative references,
not code or proof that artifacts exist. In particular, the existing
`schema-conformance-only` registry fixture deliberately contains placeholder
URNs and an empty fixture list. It remains schema-valid but produces a runtime
with zero executable capabilities.

Runtime admission accepts a subset of known registry definitions. Each complete
registration must provide:

- an exact capability ID and version matching the sole metadata definition;
- an executor object whose `executorId`, synchronous `preflight`, and `execute`
  functions are fixed data properties;
- exact input/output schema IDs, frozen schema documents with matching `$id`,
  trusted schema-document validation, and synchronous payload validators;
- the complete nonempty, sorted, unique conformance-fixture set named by the
  metadata;
- the exact QA contract ID and a nonempty, sorted, unique assertion set; and
- an exact support decision for the definition's `supportMatrixItemId`.

Any orphan, duplicate, missing artifact, accessor, ID/version drift, invalid
schema, empty fixture set, empty QA set, failed conformance case, or malformed
support decision aborts admission before a runtime facade becomes visible.
Known metadata without a registration remains explicitly unavailable.
All registration records are captured before the first conformance `await`;
the asynchronous verification pass uses only those internal captures and never
rereads the caller-owned registrations array.

Executor URNs are comparison keys only. Core never treats them as paths and
does not call dynamic `import`, `require`, `eval`, filesystem discovery, network
access, or a child process. There is no incremental registration API, semantic
version fallback, `latest` alias, case folding, or deck-specific fallback.

## Dispatch invocation and binding contract

Every invocation is an exact runtime record:

```js
{
  invocationId,
  capabilitySelectionId,
  capabilityId,
  capabilityVersion,
  experimentalOptIn,
  payload,
  bindings: [{
    role,
    shapeBindingId,
    containerKind,
    containerKey,
    shapeKey,
    expectedKind,
    cardinality: "exactly-one"
  }]
}
```

The dispatcher resolves capability ID and version exactly. Binding roles must
be sorted, unique, and identical to `requiredBindingRoles`; binding IDs and
resolved shape targets must also be unique. M2-001 consumes already-resolved
bindings. Loading `ProjectOverlay`, resolving it against `TemplateIndex`, and
proving actual shape identity remain M2-002 work.

Payloads are detached and deeply frozen before the exact capability input
validator runs. All input validators for the batch run before any executor
preflight; all preflights run before the opaque plan is returned. If a later
invocation fails, no executor `execute` function has run.

Support policy is part of pre-execution authorization:

- `unsupported` returns unavailable before execution;
- `manual` returns a manual-gate-required error before execution;
- `experimental` requires an explicit per-invocation opt-in; and
- `supported` requires both an accepting disposition and an enabled global
  support-claim switch.

A complete artifact registration is necessary for dispatchability but never
creates a support claim by itself.

## Execution and QA contract

Plans are frozen facades backed by module-private `WeakMap` state. A copied,
spread, reconstructed, or cross-module plan is invalid. Execution marks the
authentic plan consumed synchronously, so replay and concurrent calls fail
before an executor can run twice.

Executors receive only the frozen invocation data. M2-001 provides no path,
file handle, staging writer, output package, network service, environment, or
ambient root. Execution is sequential and preserves invocation order. Each
output is converted to bounded detached JSON, deeply frozen, validated against
the exact output schema, and checked by every QA assertion. Only then is a
frozen result returned with the exact executor, QA, capability, support, and
assertion identities.

Validators, preflight functions, and QA assertions must synchronously return
the literal value `true`. `false`, another truthy value, `undefined`, a Promise,
or an exception fails closed. A Promise rejection from a sync-only callback is
immediately consumed before the stable error is raised, preventing an
`unhandledRejection` from exposing its reason. Executor `execute` may be
synchronous or return a Promise. All dependency/executor errors are mapped to
stable `CapabilityRuntimeError` values containing only `{code, pointer}`;
underlying messages, payload values, binding values, and paths are omitted.

## Fixed data limits

Callers cannot relax the initial runtime limits:

| Resource | Limit |
| --- | ---: |
| Registry capabilities / registrations | 1,024 |
| Invocations per plan | 4,096 |
| Binding roles / QA assertions | 64 |
| Conformance fixtures per capability | 256 |
| JSON depth | 64 |
| Array items | 4,096 |
| Object properties | 256 |
| JSON nodes per value | 50,000 |
| JSON nodes per runtime artifact set or dispatch batch | 200,000 |
| UTF-8 bytes per string | 256 KiB |
| UTF-8 bytes per object key | 256 bytes |
| UTF-8 string bytes per runtime artifact set or batch | 4 MiB |

Sparse arrays, array side properties, symbols, accessors, non-enumerable data,
cycles, functions, `undefined`, bigint, non-finite numbers, negative zero,
Date, Map, Set, typed arrays, and non-plain object prototypes are rejected
before a capability validator sees them. Batch totals include payloads,
bindings, registry/support records, schemas, fixtures, expected outputs, actual
outputs, and object-key bytes at their respective boundaries. Node and string
budgets are deducted during traversal, so an oversized shared string graph is
rejected without first cloning or encoding the complete value.

## Trust and residual risk

Executors, schema validators, the schema-document validator, QA assertions, and
the support resolver are trusted in-process code supplied by a future closed
package catalog. The dispatcher prevents caller-controlled ID strings from
loading code and prevents mutable data from replacing captured functions, but
it is not a sandbox for hostile JavaScript. A malicious or non-terminating
trusted function can still consume CPU, retain its own state, or perform ambient
operations available to its module.

M2-001 intentionally supplies no mutation capability to its public probe.
Future product executors require dependency/provenance review and must operate
only on an isolated staging authority. If execution or post-execution QA fails,
discarding staged mutations and preventing output publication remain M2-005
responsibilities. This slice therefore establishes the registration/dispatch
portion of G3, not source immutability, create-only assembly, collateral diff,
atomic publication, packaging, or arbitrary third-party plugin safety.

## Public conformance fixture

`fixtures/capabilities/dispatcher-contract-probe/` contains only reviewed UTF-8
text:

- one independent registry metadata document;
- exact versioned input and output JSON Schemas;
- one data-only invocation/expected-output case; and
- one no-I/O runtime module containing the executor and two QA assertions.

The fixture uses no presentation file, OOXML asset, private identifier,
filesystem path, network call, child process, external dependency, or product
capability ID. Core does not import it; only the public test suite does.

## Completion evidence — 2026-08-02

- The dispatcher-focused suite passes 85/85 nodes. It covers exact and atomic
  admission, caller-mutation races, full-batch validation/preflight, support
  states, one-shot/replay behavior, schema/output/QA failures, rejected-Promise
  handling, descriptor-safe JSON, immediate aggregate limits including object
  keys, immutability, redaction, no-I/O scans, clean-directory closure, and
  probe isolation.
- `npm test` passes 507/507. Dispatcher plus support-matrix tests pass 99/99
  under `--unhandled-rejections=strict`.
- The identical 507-test suite passes on checksum-verified official Node.js
  22.23.1 and Node.js 24.14.0 releases. Cross-platform OS evidence remains
  M3-004B after M3-006.
- The bounded closing review found one admission-race blocker, two high
  findings covering late aggregate enforcement and unhandled rejected
  Promises, and one stale-provenance medium. All were fixed; the same reviewer
  verified the code fixes with no remaining blocker or high finding, and the
  final exact-path provenance records close the documentation finding.
- Working-tree and staged forbidden-material, exact-provenance, support-matrix,
  and unchanged versioned-contract gates pass, along with cached diff checks.
- The normative support matrix remains 60 rows with
  `supportClaimsEnabled: false`, zero `supported` rows, and no product row for
  the conformance probe.
