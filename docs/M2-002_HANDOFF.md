# M2-002 Semantic Clone/Fill Planning Handoff

## Scope and claim boundary

M2-002 adds a pure in-memory path from the existing version `0.1.0`
`CapabilityRegistry`, `ProjectOverlay`, `TemplateIndex`, and `DeckSpec`
documents to the M2-001 dispatcher. It also adds the first product capability
artifact set, `source-slide-clone-fill`, whose executor returns a deterministic
data-only semantic operation plan.

This slice does not open, copy, parse, mutate, stage, normalize, or publish a
PPTX/POTX package. A returned plan is not a `BuildArtifact`, rendered deck,
editable presentation, source-isolation result, or collateral-diff result.
Applying the plan to isolated OOXML and proving source immutability and atomic
publication remain M2-005 work.

The normative support row therefore remains `unsupported/unavailable`, the
global `supportClaimsEnabled` switch remains false, and every product path is
rejected before executor preflight. Runtime admission still executes the exact
public conformance cases, so artifact correctness can be tested without
promoting availability.

## Runtime API and authority

The high-level synchronous API is:

```js
const plan = prepareResolvedDeckDispatch({
  runtime,
  capabilityRegistry,
  projectOverlay,
  templateIndex,
  deckSpec,
  dependencies: {
    validateCapabilityRegistry,
    validateProjectOverlay,
    validateTemplateIndex,
    validateDeckSpec
  }
});
```

The resolver captures all option and dependency data properties, snapshots and
deeply freezes all four documents before the first callback, requires each
validator to synchronously return the literal value `true`, resolves the full
project bundle, constructs internal exact M2-001 invocations in DeckSpec order,
and immediately calls `prepareCapabilityDispatch()`. It returns only the
authenticated one-shot dispatcher plan; callers never receive or replace the
intermediate invocation array.

The resolver has no `await`, filesystem, archive, XML, network, process,
environment, dynamic loader, template path, staging handle, or output handle.
Rejected Promises from sync-only validators are consumed before a stable
redacted error is raised.

M2-001 now also exposes `assertCapabilityRuntimeRegistry()`. It compares a
bounded detached registry snapshot with the exact registry stored behind the
authentic runtime's private state. Comparing only registry ID/version would
permit two different documents that incorrectly reused the same identity;
deep-exact binding closes that substitution gap without changing the serialized
contract version or exposing the captured registry.

## Exact semantic resolution

The resolver independently enforces the runtime-relevant semantic invariants
rather than treating schema validation as sufficient authority:

- overlay template profile/index/digest values exactly match TemplateIndex;
- overlay registry ID/version exactly match CapabilityRegistry, and the whole
  registry exactly matches the authentic runtime capture;
- deck project/profile/overlay identities exactly match the overlay/index;
- capability, selection, shape-binding, owner, shape, source-ID, slide-ID, and
  package-part identities are unique at their declared scopes;
- registry capabilities, required roles, conformance IDs, overlay selections,
  shape bindings, and assignment roles obey their normative ordering rules;
- master/layout/slide relationships close exactly, and package part paths reject
  exact duplicates and ASCII case aliases;
- every selection resolves one exact capability version and the exact complete
  required-role list;
- every declared ShapeBinding is assigned exactly once across the project
  overlay, and distinct binding IDs cannot target the same
  `(containerKind, containerKey, shapeKey)` tuple;
- container namespaces are never guessed or merged, and every target shape
  exists exactly once with `actual kind === expectedKind` and
  `cardinality: "exactly-one"`;
- DeckSpec slide IDs are unique, slide order is preserved, each slide resolves
  one exact project-level selection, and one selection may be reused by many
  slides without recounting its overlay bindings.

Each internal invocation uses `invocationId = SlideSpec.slideId`, copies the
capability/version/opt-in from the resolved selection, retains the frozen slide
payload, and emits only the seven M2-001 binding fields. Geometry, OOXML source
IDs, part paths, XML, and source bytes do not enter the executor envelope.

Missing, duplicate, dangling, unsorted, case-aliased, kind-mismatched, or
otherwise ambiguous references fail before `prepareCapabilityDispatch()` is
called. A later invalid DeckSpec slide therefore causes zero executor preflight
and execute calls.

## Clone/fill capability contract

The product capability metadata binds these exact artifacts:

- executor:
  `urn:pptx-pipeline:capability:executor:source-slide-clone-fill:0.1.0`;
- input schema:
  `urn:pptx-pipeline:capability:schema:source-slide-clone-fill-input:0.1.0`;
- output schema:
  `urn:pptx-pipeline:capability:schema:source-slide-clone-fill-output:0.1.0`;
- QA contract:
  `urn:pptx-pipeline:capability:qa:source-slide-clone-fill:0.1.0`.

Required roles are exactly `body` then `title`. The capability preflight
requires two distinct text-box bindings from one source slide, both with
`containerKind: "slide"` and `cardinality: "exactly-one"`. Roles come only
from the overlay. Shape order, geometry, source ID, names, text, placeholder
type, or a fixture constant never infers a role.

The input payload is the closed shape:

```js
{
  body: ["one or more nonblank paragraphs"],
  title: "one nonblank title"
}
```

There are at most 16 body paragraphs, 2,048 code points per body paragraph,
and 256 code points in the title. Control characters, embedded line breaks,
blank-only values, Unicode format controls, unpaired surrogates, noncharacters,
unknown fields, normalization, trimming, truncation, and implicit paragraph
splitting are rejected by the input and output schemas and independently by
preflight. Preflight additionally caps one title at 1 KiB UTF-8, one body
paragraph at 8 KiB, and total invocation text at 32 KiB.

Execution produces only:

```js
{
  planVersion: "0.1.0",
  planType: "source-slide-clone-fill-plan",
  outputSlideId,
  clone: {
    operationId: "clone-source-slide",
    operationType: "clone-slide",
    sourceContainerKind: "slide",
    sourceSlideKey
  },
  fills: [bodyFill, titleFill]
}
```

`outputSlideId` comes only from the invocation ID. `sourceSlideKey` comes only
from the two bindings' shared container key. Each fill copies the exact role,
binding ID, source shape key, expected kind, and text into a new JSON value.
The schema closes every record; four ordered QA assertions independently bind
the source, output identity, operation/role order, semantic targets, and exact
text preservation.

## Fixed resolver limits

Callers cannot relax the runtime profile:

| Resource | Limit |
| --- | ---: |
| Capabilities / selections | 1,024 each |
| Shape bindings / shapes per owner | 8,192 each |
| Binding roles | 64 |
| Masters / layouts / indexed or deck slides | 256 / 2,048 / 4,096 |
| JSON depth | 64 |
| JSON array items | 8,192 |
| JSON object properties | 256 |
| JSON nodes per document / four-document batch | 50,000 / 200,000 |
| UTF-8 bytes per string / object key | 256 KiB / 256 bytes |
| Aggregate UTF-8 string and key bytes | 4 MiB |

These runtime ceilings are intentionally narrower than some theoretical
combinations allowed by the serialized schemas. Sparse arrays, array side
properties, symbols, accessors, non-enumerable data, cycles, functions,
`undefined`, bigint, non-finite numbers, negative zero, Date, Map, Set, typed
arrays, and non-plain prototypes fail before a validator sees the document.
Strings and object keys first receive an O(1) UTF-16 code-unit ceiling check,
so an attacker-controlled oversized value cannot force an unbounded
`TextEncoder` allocation before the exact UTF-8 limit is enforced.

## Public evidence

The public artifact set is repository-owned UTF-8 text. It includes exact
metadata, input/output schemas, two independently named invocation/output
conformance cases, one overlay bound to the existing reviewed synthetic index,
and a two-slide DeckSpec that reuses one selection. No presentation binary or
asset is tracked or loaded.

The focused suite covers positive admission/dispatch, unavailable product
policy, exact runtime-registry binding, renamed semantic keys, owner/shape order
independence, selection reuse, unused project selections, identity drift,
missing/duplicate/ambiguous references, namespace and kind mismatch, part-path
case aliases, later-slide batch atomicity, validator mutation races, accessors,
resource ceilings, rejected Promises, input/UTF-8 limits, QA drift, static
fixture-neutrality/no-I/O scans, and clean-directory module closure.

Test-only integration may use an explicitly conformance-only experimental
support decision with the fixture's opt-in to prove the opaque
resolve/prepare/execute chain. That test resolver is not the normative support
matrix, does not alter it, and is not product availability evidence.

Final evidence is 56/56 clone/fill nodes, 156/156 focused
resolver/dispatcher/support nodes, and 564/564 repository nodes. The complete
suite passes on checksum-verified official Node.js 22.23.1 and 24.14.0
releases. The bounded closing review's missing-provenance blocker,
pre-encoding-allocation high finding, Unicode input/output consistency
findings, stale support prose, and astral-scalar coverage suggestion were fixed
and rechecked with no remaining code blocker or high finding.

## Residual risk and next dependency

Validators, capability code, QA, and support resolution remain trusted
in-process JavaScript and are not sandboxed. The operation plan itself is not a
security credential. M2-005 must rebind it to the inspected source digest and
an isolated staging package, assign/remap OOXML identities and relationships,
prove allowed versus forbidden part changes, discard failed staging, and
publish atomically. M2-003 is the next dependency: implement one minimal native
DrawingML component through the same resolver/dispatcher path without widening
the current clone/fill or input support claims.
