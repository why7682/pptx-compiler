# M1-002 Versioned Contract Handoff

## Status and boundary

M1-002 defines the first public data-contract version, `0.1.0`, without adding
an inspector, renderer, dispatcher, package reader, or accepted user input.
JSON Schema Draft 2020-12 is normative. `types/contracts.d.ts` is generated from
that source and is a compile-time consumer, not a second authority.

The implementation was authored from this repository's public requirements and
the public JSON Schema specifications. It did not inspect predecessor code,
presentation assets, private fixtures, or generated presentation archives.

## Normative contract set

`schemas/contracts/manifest.json` admits exactly nine schemas: one shared
definition schema and eight independently valid root documents.

| Root document | Nested public structures | Purpose |
| --- | --- | --- |
| `ProjectConfig` | explicit template, registry, overlay, and root references | Replaces future ambient lookup with data; `ProjectContext` remains M1-003. |
| `TemplateProfile` | semantic layout bindings | Binds each semantic role to exactly one layout in one normalized index and template digest. |
| `TemplateIndex` | master, layout, slide, shape, geometry, and placeholder entries | Path-redacted normalized inspection result whose arrays preserve source order and shape z-order; generation remains M1-004. |
| `CapabilityRegistry` | `CapabilityDefinition` | Names exact executor/schema/QA references without claiming that they exist. |
| `ProjectOverlay` | `CapabilitySelection`, `ShapeBinding` | Selects registry entries and maps required semantic roles to exactly one indexed shape. |
| `DeckSpec` | `SlideSpec` | Carries ordered slide requests and an explicitly open capability payload; result arrays preserve the same order. |
| `BuildArtifact` | `SlideResult`, `PublishedOutput` | Describes only a QA-passing published result; it is not an operation-failure envelope. |
| `QaReport` | `QaCheck`, `ManualGate`, `Diagnostic` | Preserves pass, fail, blocked, manual, and unavailable outcomes without boolean flattening. |

Every root has an absolute versioned `$id`, `schemaVersion: "0.1.0"`, a fixed
`contractType`, complete required fields, and `additionalProperties: false`.
The sole open extension point is `SlideSpec.payload`; a future dispatcher must
validate it a second time against the exact `CapabilityDefinition.inputSchemaId`
before mutation. Passing the base `DeckSpec` schema alone never makes a payload
dispatchable.

All configured and package-part paths use a deliberately narrow canonical
ASCII relative-path subset. Absolute paths, URI-like values, backslashes,
control characters, empty segments, and `.`/`..` segments fail schema
validation. The OPC root metadata name `[Content_Types].xml` is accepted only
as an exact `BuildArtifact.changedParts` entry; it cannot masquerade as an
indexed presentation, master, layout, or slide part. Runtime containment,
case-insensitive alias analysis, symlink defense, archive limits, and digest
recalculation remain mandatory consumer responsibilities.

## Manifest, validator, and types

`scripts/lib/json-schema.mjs` is a dependency-free evaluator for the exact
Draft 2020-12 keyword subset used by this repository. It supports local JSON
Pointers and absolute references resolved only from the in-memory manifest
registry. It never fetches a schema over the network and rejects unknown
keywords or nested identifier scopes. It is not presented as a general-purpose
implementation of the complete JSON Schema standard.

`scripts/check-contracts.mjs` validates the staged index by default and checks:

- the closed manifest, exact schema/fixture inventory, unique `$id` values, and
  registered references;
- each positive synthetic fixture against its root schema;
- unique semantic keys, canonical ordering for set-like collections, preserved
  source/deck order for ordered arrays, and closed ID/version/hash links;
- profile/index/master/layout/slide/shape references and exact binding roles;
- support-matrix references without promoting any status;
- output-root separation, slide-to-capability result mapping, canonical changed
  parts, and QA/manual aggregation;
- QA coverage for every rendered slide by its selected capability contract,
  with slide-scope matching and error diagnostics forcing a failed aggregate;
- byte-identical generated TypeScript declarations.

Run `npm run generate:contract-types` after a normative schema change. Both
`npm run check:public-tree` and `npm run check:working-tree` reject generated
type drift.

## Fixture claim boundary

The manifest marks every file under `fixtures/contracts/valid` as
`schema-conformance-only`. Values are fictional public examples. Digests are
syntax tokens; executor/schema/QA URNs are explicitly named
`fixture-placeholder`; the described build and QA result was not executed.
These files are neither capability conformance fixtures nor support evidence.
The support matrix remains authoritative with `supportClaimsEnabled: false`,
and `source-slide-clone-fill` remains `unsupported` with no executor or
conformance artifact.

A real `BuildArtifact` can exist only after trusted code produces a matching
`QaReport` whose aggregate decision is `pass`. A blocked or failed attempt has
a QA/operation result but no published artifact. Contract fields cannot prove
source isolation or atomic publication by self-assertion; future implementation
and collateral-diff tests must establish those facts before emitting the
artifact.

## Compatibility and excluded work

Unknown versions and fields fail closed. During 0.x, an incompatible contract
change increments the minor version and requires migration notes plus negative
tests. Registered external references are exact; no latest-version alias or
implicit migration exists.

This slice intentionally does not define or implement:

- `ProjectContext` runtime path/dependency injection (`M1-003`);
- `CapabilityExecutor`, capability-specific input/output schemas, dispatch, or
  executor-artifact existence checks (`M2-001`);
- template inspection or secure ZIP/XML ingestion (`M1-004`/`M1-005`);
- source-slide mutation, assembly, QA execution, or publication (`M2`);
- arbitrary asset paths, private template metadata, or a migration registry.

The normative standard references are the JSON Schema
[2020-12 core specification](https://json-schema.org/draft/2020-12/json-schema-core)
and [validation specification](https://json-schema.org/draft/2020-12/json-schema-validation).

## Exit evidence

The complete 146-test suite passed on Node.js 22.23.1 and Node.js 24.14.0. It
contains 135 total rejection mutations. The contract suite contributes 70
tests (2 positive and 68 rejection mutations); one additional
provenance-authority regression belongs to the M1-002 slice.
The contract working-tree gate also produced a byte-stable zero-finding report,
and generated TypeScript exactly matched the normative schemas.

This satisfies the two declared Node runtime lines. Linux/Windows and broader
cross-platform OS coverage remains assigned to M3-004 and does not expand this
local macOS runtime evidence.
