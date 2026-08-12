# Compatibility Policy

## Purpose and boundary

Compatibility is an exact relation, not a general impression. A statement
applies only to the matrix item, schema version, runtime line, operating system,
adapter version, fixture class, and evidence level it names. Success on one
synthetic template, one desktop probe, or one operating system never implies
arbitrary-template compatibility.

The normative status owner is
[`policy/support-matrix.json`](../policy/support-matrix.json). While
`supportClaimsEnabled` is false, the project makes no `supported` PPTX claim,
even when an exact experimental path and its hosted tests pass.

## Fact ownership

| Fact | Owner |
| --- | --- |
| Current status, disposition, limitation, and evidence class | Support matrix |
| Authored semantic content and relationships | Raw brief, evidence, and `DeckSpec` |
| Unchanged inherited package content | Source template |
| Editable layout intent and constraints | `SlideLayoutIR` |
| Resolved geometry and constraint receipt | `ComposedSlidePlan` |
| Candidate replay and exact candidate-byte identity | `CandidateBuildRecord` |
| QA decision | `QaReport` |
| Final delivery publication | `BuildArtifact` |

Hashes bind exact boundary objects. They do not replace readable content,
constraints, support policy, or a compatibility receipt.

## Fail-closed resolution flow

Before output mutation, the runtime must resolve every requested dependency:

1. reject unknown schema versions, unknown fields, and invalid matrix data;
2. map each input, OOXML feature, capability, platform, and evidence level to
   one exact row;
3. select the explicit catch-all and reject an unknown or unlisted item;
4. reject missing, duplicate, ambiguous, case-aliased, or kind-mismatched
   semantic bindings;
5. reject or report unavailable for `unsupported`;
6. retain a named unresolved gate for `manual`;
7. require explicit opt-in and preserve the label for `experimental`;
8. dispatch `supported` only when the global switch is enabled and the exact
   capability evidence remains complete.

No result may silently select deck-specific code, strip an unknown feature,
flatten an editable object to an image, modify the source template, or convert
missing evidence into success.

## Executable capability contract

Serialized IDs are comparison keys, never executable authority. A registry
cannot load an executor, schema, fixture, or QA implementation by naming it.
The runtime admits only a closed trusted registration whose exact capability
and version bind all of these together:

- metadata and a dispatchable executor;
- versioned input and output schemas plus exact validators;
- at least one repository-owned conformance fixture;
- deterministic positive and rejection tests;
- capability-specific QA assertions;
- the matching matrix decision.

The project resolver snapshots and validates the complete registry, overlay,
index, and deck bundle before callbacks can mutate caller data. It prepares the
complete batch before any executor runs, consumes one opaque plan once, and
validates every bounded output and QA assertion. Complete registration is
necessary for execution but insufficient for public support: source isolation,
create-only staging, collateral-diff evidence, declared platform evidence, the
global switch, and an explicit matrix promotion remain separate requirements.

The exact candidate-alpha path additionally re-derives the readable layout
intent and resolved plan, reconstructs the expected package, and exact-compares
the `CandidateBuildRecord` and PPTX. Its QA report remains blocked when external
delivery evidence is unavailable and therefore cannot produce a
`BuildArtifact`.

## Evidence and status changes

Automated public evidence is the only evidence class that may participate in a
future automatic `supported` result. It must use repository-owned synthetic
fixtures and declared public dependencies in reproducible public CI.

An `experimental` capability still requires the complete executable artifact
set above, a bounded implemented path, explicit limitations, and per-use opt-in.
An idea, roadmap, compilation result, or architecture document remains
`unsupported`.

Manual evidence records only its named observation. A private probe is optional,
local, redacted, and narrower still. Neither can replace public conformance or
be aggregated as an automatic boolean pass. Predecessor observations, visual
similarity by itself, and unavailable evidence are insufficient.

A regression, missing artifact, expired environment assumption, security
finding, or incompatible dependency change immediately demotes the affected
row. Promotion requires a reviewed matrix change with the evidence; demotion
does not wait for a release.

## Declared platform envelope

The declared public runner matrix is Linux, macOS, and Windows under Node.js
22.x and 24.x. Every row remains `experimental/accept-with-warning` even though
M3-004B now records automated public evidence:

- [PR Public CI run 31600528716](https://github.com/why7682/pptx-compiler/actions/runs/31600528716)
  passed all six cells;
- [accepted-main Public CI run 31600806512](https://github.com/why7682/pptx-compiler/actions/runs/31600806512)
  passed all six cells for object `c4dee58`.

The corresponding Dependency Review and CodeQL evidence is recorded in
[`docs/M3-004_HANDOFF.md`](M3-004_HANDOFF.md). Platform execution proves neither
a capability closure nor PowerPoint behavior. An off-matrix development runtime
is not compatibility evidence.

Every admitted platform file-flushes owned payloads and preserves create-only,
record-first/marker-last ordering plus exact recovery. POSIX additionally
requests parent-directory fsync barriers. Node does not expose the equivalent
directory flush on Windows, so no sudden-power-loss directory-entry persistence
claim is made there.

## Optional adapters

### Pandoc

Pandoc is a separately installed optional process, never a bundled or ambient
core dependency. A trusted absolute executable path is required. The adapter
profile treats `>=2.15.0 <4.0.0` only as an eligibility window; exact version,
sandboxed JSON-API, and canonical OMML probes must all pass before registration.
Missing, warning-producing, failed, future-major, or capability-drifting tools
remain unavailable. There is no text, raster, alternate-program, or ambient
fallback.

Public conformance uses a fake process runner and repository-authored,
text-derived DOCX bytes. It proves process and parser contracts, not a real
Pandoc release/platform matrix. Formula input, formula transplantation, and
native OMML remain unsupported in the candidate package graph.

### PowerPoint

PowerPoint automation is a trusted manual adapter and is absent from public PR
CI. Its local observations are bound to exact repository-owned candidates and
purposes. A shape-name edit cannot satisfy a formula-content edit receipt, and a
feature-level edit observation cannot authorize another candidate or a delivery
flow. Absence of PowerPoint must remain visible as manual/unavailable, never as
a fallback success.

## Editability and visual compatibility

Editability is capability-specific. Native OOXML structure, collision-free
target IDs, exact package application, open-without-repair, edit, save, reopen,
and retained native structure are distinct facts. Pixel similarity alone proves
none of them.

A rendered review may supplement structural evidence, but final delivery must
bind the exact reviewed candidate to its mechanical, render, independent-pixel,
and required compatibility receipts. The component that generates a candidate
cannot approve its own mutation or turn a screenshot into support authority.

## Security precedence

Security rejection overrides round-trip preservation. External relationships,
macros, ActiveX, OLE, embedded payloads, archive/XML limit violations, and
unknown high-risk parts are rejected rather than preserved for compatibility.

The current secure-ingestion profile fixes a 1 MiB archive, 32 members, 256 KiB
per member, 1 MiB expanded total, 100:1 compression ratio, XML depth 64, and
50,000 package elements. Callers cannot relax these limits. Passing the bounded
profile is security evidence for the public-synthetic grammar, not a promise to
accept arbitrary presentations.

## Contract versioning during 0.x

Every stable data boundary carries a schema version. Unknown versions and
unknown fields fail closed unless an explicit tested migration exists.

- an incompatible contract or behavior change increments the 0.x minor version
  and includes migration notes plus negative tests;
- a patch remains backward-compatible within its minor, except that an unsafe
  claim may be narrowed immediately with documentation;
- a new supported item is a reviewed claim change even when its data shape is
  backward-compatible;
- incompatible public-contract changes after 1.0 require a major version.

Matrix history records why a status changed, but release notes and public prose
must project the current matrix shipped in the same reviewed commit.

## Current limitations and next action

The complete user-facing list is
[`docs/KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md). The decisive current facts
are that arbitrary templates are unsupported, the candidate QA result is
blocked, no BuildArtifact is created, and no npm package or release has been
published.

M3-004B closed hosted platform/security evidence without changing support. The
next compatibility-affecting action is not a blanket promotion: M4-001 must
reproduce the exact release tag and reviewed tarballs first. Any later support
promotion must then name one demonstrated user scope, update its exact matrix
rows, and retain every unknown case as fail-closed.
