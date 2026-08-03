# Compatibility Policy

## Scope of a claim

A support statement applies only to the exact matrix item, schema version,
runtime line, operating system, adapter version, fixture class, and evidence
level named by that statement. Success on one template, platform, or private
probe never implies arbitrary-template compatibility.

Planning milestones and target dispositions are not present-tense support.
Until `supportClaimsEnabled` becomes true through a reviewed matrix change, the
project makes no supported PPTX capability claim.

## Fail-closed resolution

Before mutating an output, the capability dispatcher and later consumers must
resolve every requested input and feature to one matrix row:

1. unknown schema version or field: reject;
2. unknown or unlisted input/OOXML/platform: select the explicit catch-all and
   reject;
3. missing or ambiguous semantic binding: reject;
4. `unsupported`: reject or report unavailable;
5. `experimental`: require explicit opt-in and emit the status in the result;
6. `manual`: emit an unresolved `ManualGate` until trusted evidence is recorded;
7. `supported`: dispatch only the named executor and run its QA contract.

No status may silently select deck-specific code, strip an unknown feature,
flatten an editable object to an image, modify the source template, or convert
missing evidence into success.

## Executable registration and dispatch

Serialized capability metadata is not executable authority. An executor ID,
schema ID, fixture ID, QA ID, or support item ID supplied by a registry is never
loaded dynamically. The M2-001 runtime admits a capability only through a
closed trusted registration whose capability/version and every artifact ID
exactly match one registry definition. Input/output schema documents and
validators, a nonempty exact conformance set, executor preflight/execute
functions, and nonempty QA assertions must all be present and pass together.

All invocations are detached, bounded, and frozen. The complete batch must pass
exact lookup/version checks, support authorization, input validation, resolved
binding-role checks, and executor preflight before any executor runs. Output is
again detached, bounded, frozen, schema-validated, and checked by every QA
assertion. Unknown, unavailable, manual, and non-opted-in experimental cases
stop before execution; a `supported` decision is invalid while the global
claim switch is false.

Complete registration is necessary but not sufficient for public support.
Source isolation, create-only staging, collateral-mutation checks, declared
platform evidence, the global switch, and an explicit matrix promotion remain
required. The dispatcher conformance probe is never product capability
evidence.

## Promotion and demotion

A capability can move to `supported` only when all of these exist in the public
repository and pass on the declared runtime/platform matrix:

- capability metadata and a dispatchable executor;
- versioned input and output schemas;
- repository-owned public conformance fixture;
- deterministic positive and negative tests;
- capability-specific QA assertions;
- source-isolation and collateral-mutation evidence.

`experimental` requires a bounded implemented path and explicit limitations;
an idea or architecture document alone remains `unsupported`. `manual` requires
a named manual gate and trusted execution policy. A regression, missing
artifact, expired environment assumption, security finding, or incompatible
dependency change demotes the affected row immediately; it does not wait for a
release.

## Evidence hierarchy

Automated public evidence is the only level that can support an automatic
`supported` result. It must use repository-owned synthetic fixtures and public
dependencies in reproducible CI.

Trusted manual evidence can establish only the named manual result. Private
compatibility probes are optional, local, redacted, and narrower still. They
may find defects or support a fixture-class statement but never replace the
public fixture. Predecessor observations, compilation, visual similarity, and
unavailable evidence are insufficient.

Manual and unavailable results remain first-class report values. Aggregation
must never treat them as passing booleans.

## Contract versioning during 0.x

Every stable data boundary carries a schema version. Unknown versions and
unknown fields fail closed unless an explicit migration contract is implemented
and tested.

The first data-contract set is `0.1.0`. Its manifest registers exact absolute
schema identifiers; there is no `latest` alias, network schema resolution, or
implicit migration. Checked-in TypeScript declarations are generated from the
normative JSON Schemas and do not weaken runtime validation.

- An incompatible schema or behavior change during 0.x increments the minor
  version and includes migration notes and negative tests.
- A patch release remains backward-compatible within its minor contract and may
  narrow an unsafe claim immediately.
- Adding a new supported item is a reviewed claim change, even when its data
  shape is backward-compatible.
- At 1.0, incompatible public-contract changes require a major version change.

Matrix history must preserve the reason and evidence for promotions,
demotions, removals, and changed limitations. Release notes and package claims
must match the matrix shipped in the same reviewed commit.

## Platform and adapter compatibility

Node.js 22.x and 24.x LTS on Linux, macOS, and Windows are the declared runtime
envelope. Each combination remains experimental until the public CI matrix
passes. A result from the current off-matrix development runtime is not support
evidence.

Pandoc, if later integrated, remains a user-installed optional process with a
versioned adapter contract. PowerPoint automation remains an optional trusted
manual adapter and is never required by public PR CI. Absence of either adapter
must produce an explicit unavailable/manual result, not a fallback claim.

## Editability and visual compatibility

Editability is capability-specific. Native OOXML structure plus the required QA
evidence may establish the declared editability property; visual similarity
alone cannot. Pixel-level or PowerPoint-runtime compatibility is manual unless
a future public, reproducible evidence contract explicitly promotes it.

## Security precedence

Security rejection overrides compatibility preservation. Unsafe external
relationships, macros, ActiveX, OLE, embedded payloads, archive/XML limit
violations, or unknown high-risk parts are not preserved merely to improve
round-trip fidelity. M1-005 enforces the fixed 1 MiB archive, 32-member,
256 KiB member, 1 MiB expanded-total, 100:1 compression, depth-64 XML, and
50,000-element package ceilings documented in `docs/M1-005_HANDOFF.md`.
Callers cannot relax them. This implemented rejection profile is public
security evidence, not a compatibility promise: inputs outside the exact
minimal positive grammar remain unsupported and fail closed.
