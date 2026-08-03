# Release Gates

All gates fail closed. Compilation or a visually plausible deck is not release
evidence by itself.

## G0 — Identity, rights, and provenance

- project/package names and public Git identity are selected;
- an OSI-approved license is selected after confirming ownership and third-party
  obligations;
- each source, schema, fixture part, example, and dependency has a provenance
  record and compatible redistribution status;
- excluded private materials and non-redistributable helpers have machine-
  checked patterns;
- per-file SPDX/copyright policy is decided and enforced.

## G1 — Public reproducibility

- clean checkout uses only declared public dependencies;
- synthetic fixture is repository-owned, deterministic, and independently
  reviewed;
- no private fixture, local font, model, GUI, or managed helper is required;
- Linux, Windows, and macOS non-GUI tests agree on normalized results.

## G2 — Input security

- canonical containment blocks traversal and symlink escape;
- archive member count, individual size, expanded total, compression ratio,
  nesting, duplicate, and case-conflict limits are enforced before extraction;
- XML parser limits and external-entity/network access are disabled;
- external relationships, macros, ActiveX, OLE, embedded packages, and unknown
  high-risk parts follow the documented reject/quarantine policy;
- resource exhaustion and malformed-input mutation suites pass.

## G3 — Capability correctness

- the shipped support matrix passes its schema and semantic overclaim gate;
- every supported capability has exact bound metadata, an executor, input and
  output schemas, conformance fixtures, deterministic output, negative tests,
  and a concrete QA contract with assertions;
- runtime project resolution binds the exact captured registry content and
  rejects missing, duplicate, ambiguous, case-aliased, or kind-mismatched
  overlay/index/deck references before executor preflight;
- source template is unchanged and output publication is create-only;
- OOXML relationships, content types, geometry/capacity, semantic diff, and
  collateral mutation checks pass;
- manual and unavailable evidence remains visible and cannot be promoted to an
  automatic pass.

## G4 — Package boundary

Every publishable package uses a positive `files` allowlist. The packed tarball:

- is at most 5 MiB compressed and 20 MiB unpacked;
- has at most 300 files and no file larger than 1 MiB;
- contains only allowlisted runtime files and required notices;
- contains no presentation/PDF/font/archive binary, worktree, build/review
  output, private manifest, absolute path, secret, PII, source map with private
  sources, or undeclared executable;
- installs in an empty directory and completes the documented CLI smoke flow.

The reviewed tarball hash must equal the published tarball hash.

## G5 — Project security and maintenance

- least-privilege CI, pinned actions, dependency review, CodeQL/static analysis,
  secret scanning, license audit, SBOM, and vulnerability reporting are active;
- untrusted pull-request code never reaches private fixtures, PowerPoint hosts,
  signing keys, provenance identity, or registry tokens;
- supported Node/platform versions, compatibility levels, deprecation policy,
  and security response process are documented;
- contributor and governance documents are present.

## G6 — Release evidence

- release tag points to the reviewed commit;
- clean-tag build, full public conformance suite, tarball install smoke, and CLI
  end-to-end flow pass;
- changelog and known limitations match the executable support matrix;
- alpha/beta/stable channel is explicit;
- package publication uses registry provenance where available.

## Reference policies

- OSI licenses: <https://opensource.org/licenses>
- REUSE Specification: <https://reuse.software/spec/>
- npm package metadata: <https://docs.npmjs.com/cli/configuring-npm/package-json/>
- OpenSSF Scorecard: <https://github.com/ossf/scorecard>
- GitHub security policy guidance: <https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/add-security-policy>

## Executable foundation gates

M0-004 makes the G0 admission boundary executable without third-party runtime
dependencies:

- `npm run check:public-tree` checks the staged Git index using the staged
  policy, schema, and provenance records;
- `npm run check:working-tree` diagnoses tracked and non-ignored untracked
  working-tree files without following symlinks;
- `npm test` proves deterministic reports and fail-closed behavior with
  repository-owned temporary text fixtures and 31 rejection mutations.

Both CLIs emit deterministic human output by default and accept `--json` for a
versioned machine report. A configuration error is itself a gate failure.

M0-005 adds `npm run check:support-matrix`. It validates the staged 60-row
matrix, explicit catch-alls, claim switch, status/disposition/evidence
combinations, required capability evidence, deterministic IDs, and admitted
evidence paths. It is part of `npm run check:public-tree`.

M1-001 adds `npm run generate:fixtures` and the synthetic-fixture tests. The
generator admits only its reviewed text-part allowlist, rejects source/graph
drift and high-risk markers, creates deterministic PPTX/POTX archives in an
ignored directory, and refuses overwrite. This is producer-side public test
evidence only; it is not the secure ingestion gate required by G2.

M1-002 adds `npm run check:contracts` and
`npm run generate:contract-types`. The contract gate validates the exact
versioned schema/fixture manifest, registered references, closed root objects,
cross-document semantic links, safe relative paths, QA/manual aggregation, and
generated TypeScript drift. QA evidence must cover every rendered slide through
its selected capability contract; slide-scoped checks cannot cover another
slide, and referenced error diagnostics cannot aggregate to pass.
Schema-conformance examples are explicitly barred from serving as executor or
support evidence. The staged contract gate is part of
`npm run check:public-tree`.

M1-003 adds the side-effect-free `ProjectContext` runtime contract. It requires
an explicit absolute root and exact injected ProjectConfig validator, produces
detached frozen path/config snapshots, rejects lexical escape and case-folded
root/write-target aliases, and contains no cwd/environment/Git root discovery.
These tests establish explicit wiring only: they do not satisfy G2 filesystem,
symlink, TOCTOU, archive, or XML gates, which remain consumer-time work.

M1-004 adds a side-effect-free semantic template inspector and the
`npm run inspect:synthetic` evidence harness. The reviewed fixture producer
builds archive bytes, digest, and an already-parsed package view in one bounded
in-memory flow; core validates the view graph and emits a deterministic,
path-redacted `TemplateIndex 0.1.0`. A clean-directory module-closure smoke
copies only the core sources and runtime-generated public view to an empty
directory and executes from an unrelated cwd. This is not npm tarball/install
evidence and does not satisfy G2: arbitrary file opening, ZIP/XML safety, and a
secure package-view producer remain M1-005.

M1-005 adds `inspectTemplateSource()` as the bounded G2 foundation lane. It
derives its source solely from `ProjectContext`, checks path components and an
opened-handle identity before/after an exact-size read, and performs all ZIP,
XML, OPC, relationship, and narrow OOXML validation in memory without
extraction or network resolution. Fixed limits and residual cross-platform
TOCTOU constraints are documented in `docs/M1-005_HANDOFF.md`. Public mutations
cover traversal, symlinks, archive/member/ratio limits, duplicate/case aliases,
ambiguous ZIP formats, malformed/entity-bearing XML, unknown vocabulary,
external relationships, macros, ActiveX, OLE, and embedded objects. This
satisfies the bounded public G2 baseline for the synthetic minimal profile; it
does not establish arbitrary-template compatibility, package installation, a
CLI, a renderer capability, or any supported matrix row.

M2-001 adds the bounded G3 registration/dispatch foundation. Declarative
registry strings never load code. Atomic runtime admission requires exact
capability/version, executor, input/output schema, nonempty conformance fixture,
QA assertion, and support-item binding. The entire bounded invocation batch is
snapshotted, input-validated, support-authorized, binding-checked, and
preflighted before any executor runs; an opaque one-shot plan then executes in
order and validates every output and QA assertion. Public mutations cover
missing/drifting artifacts, placeholder metadata, accessors and non-JSON data,
immediate aggregate resource ceilings including object keys, async admission
mutation races, rejected sync-callback Promises, lookup/version/binding
ambiguity, support states, batch atomicity, plan replay, executor/output/QA
failures, and redaction.

M2-001's only positive executor is a no-I/O dispatcher conformance probe. It is
not a renderer or support artifact for any product capability. M2-001 does not
establish overlay/index resolution, source immutability, create-only staging,
rollback, OOXML collateral diff, atomic publication, packaging, CLI behavior,
or sandboxing of hostile third-party JavaScript; those remain later gates.

M2-002 adds the bounded project-resolution and semantic operation-planning
portion of G3. The synchronous resolver snapshots the complete registry,
overlay, index, and deck set before validator callbacks; binds the full registry
to authentic M2-001 private runtime state; closes owner, selection, binding,
target, kind, ordering, and identity ambiguity; and immediately returns an
opaque dispatcher plan. Public mutations cover same-ID registry substitution,
missing/duplicate/case-aliased graph identities, cross-document drift,
selection reuse, later-slide atomicity, validator races, descriptor/non-JSON
inputs, fixed resource ceilings, redaction, fixture neutrality, and clean-
directory closure.

The statically registered clone/fill executor emits only a schema-validated
clone-plus-two-fill JSON plan and runs four cross-field QA assertions. Its two
public conformance cases execute during runtime admission even while the
normative policy remains `unsupported/unavailable`; normal product dispatch is
therefore blocked before capability preflight. This satisfies only semantic
planning evidence. Actual source-slide bytes, relationships and identifiers are
not cloned or remapped, and source immutability, create-only staging, rollback,
editability, visual fidelity, collateral diff, and atomic publication remain
unsatisfied M2-005 gates.
