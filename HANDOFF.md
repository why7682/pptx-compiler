# Codex Handoff

## Current state

This is an independent, clean-history workspace created to extract a generic
PPTX rendering and QA pipeline from a private predecessor project. It now has
plans, versioned data contracts, dependency-free foundation policy gates,
reviewed text-only OOXML fixture parts, generated TypeScript declarations, a
pure explicit-root runtime context, a pure semantic inspector, bounded secure
ZIP/XML ingestion for the public minimal fixture class, a fail-closed capability
runtime/dispatcher, a bounded pure project-dispatch resolver, a no-I/O semantic
clone/fill operation planner, and synthetic mutation tests. No arbitrary
PPTX/POTX compatibility layer or OOXML rendering/mutation implementation,
tracked binary fixture, design asset, dependency lockfile, prompt log, or
predecessor Git history has been copied.

The project uses the MIT License with Elliot Wu as the declared copyright
holder. The working name, monorepo shape, and repository-local public Git author
identity are selected. Before every commit, run the leakage checks defined in
`docs/RELEASE_GATES.md`.

`M0-004` is complete: the repository now has dependency-free, fail-closed
forbidden-material and exact per-file provenance gates. The bounded suite has 2
passing baselines and 31 rejection mutations. Its independent read-only review
closed with no blocking findings.

`M0-005` is complete: the versioned public support matrix covers 60 input,
OOXML, capability, platform, and evidence items. Its global claim switch is
false, so no PPTX capability is currently represented as supported. A
dependency-free staged/working-tree gate rejects matrix overclaims and drift.

`M1-001` is complete: 12 independently reviewed, repository-owned text parts
generate deterministic ignored PPTX and POTX archives through a dependency-free,
create-only ZIP writer. The suite locks the minimal internal graph, content
types, owner references, source limits, high-risk exclusions, ZIP metadata, and
publication behavior. This is public test-data production, not PPTX ingestion
or rendering support; the global support switch remains false.

`M1-002` is complete: eight closed root schemas plus shared definitions form
contract version `0.1.0`. A dependency-free staged gate validates registered
references, positive examples, cross-document keys/bindings, safe relative
paths, QA/manual aggregation, and generated TypeScript drift. The example
bundle is machine-marked `schema-conformance-only`; its placeholder executor
references and fictional build/QA records are not runtime or support evidence.
The 146-test suite passes on Node.js 22.23.1 and 24.14.0; cross-platform OS
evidence remains M3-004.

`M1-003` is complete: `ProjectContext` revalidates a detached frozen
`ProjectConfig 0.1.0` snapshot through an explicit synchronous dependency and
resolves eight locations beneath an explicit absolute root. It rejects lexical
escape, overlapping/case-aliased roots, all 10 case-only input-document role
aliases, and source/write conflicts without filesystem I/O or ambient root
discovery. The 225-test suite passes on Node.js 22.23.1 and 24.14.0. This is path
modeling, not template inspection or symlink/TOCTOU-safe input opening.

`M1-004` is complete: the dependency-free semantic inspector consumes an
explicit `ProjectContext`, a bounded already-parsed reviewed-fixture package
view, and an injected exact `TemplateIndex 0.1.0` validator. It emits the
deterministic path/text-redacted public golden, preserves source owner/z-order,
and rejects graph ambiguity, unsupported vocabulary, unbounded arrays,
accessors, and unknown fields. The reviewed producer fingerprints its normalized
OOXML structure so unmodeled attributes and children cannot disappear into an
empty feature list. The 344-test suite passes on Node.js 22.23.1 and 24.14.0;
the independent closing review reports no remaining blocker. This is not secure
ZIP/XML ingestion, arbitrary-template support, or npm clean-install evidence.

`M1-005` is complete: the high-level inspector derives its source only from a
frozen `ProjectContext`, takes one bounded stable file snapshot, validates a
fixed non-extracting ZIP profile, parses a namespace-aware bounded XML subset,
and maps only the public minimal OPC/PresentationML vocabulary. Traversal,
symlinks, archive bombs and ambiguity, malformed XML, external relationships,
macros, ActiveX, embedded objects, and unknown vocabulary fail closed. The
422-test suite passes on Node.js 22.23.1 and 24.14.0; the bounded closing review
reports no remaining blocker or high finding. The portable filesystem race
residual is documented, and no input or capability support claim was promoted.

`M2-001` is complete: declarative capability metadata becomes executable only
through an atomically admitted trusted registration with exact executor,
input/output schemas, nonempty conformance fixtures, QA assertions, and support
binding. Dispatch snapshots and preflights the complete batch before execution,
uses an authenticated one-shot plan, and validates bounded outputs plus QA. The
85-node dispatcher suite and complete 507-test repository suite pass on Node.js
22.23.1 and 24.14.0; dispatcher plus support-matrix tests pass 99/99 under
`--unhandled-rejections=strict`. The bounded closing review's
registration-race blocker and two resource/rejection-handling high findings
were fixed and rechecked with no remaining blocker or high. The only executor
is a data-only conformance probe; all 60 product support rows remain
non-supported and the global switch is false.

`M2-002` is complete: the runtime authenticates exact captured registry content,
and the synchronous resolver snapshots and validates the complete
registry/overlay/index/deck bundle before resolving every semantic binding and
preparing any executor preflight. The statically registered clone/fill plugin
accepts only two exact text-box roles from one source slide and returns a closed,
schema-validated data-only operation plan guarded by four QA assertions. The
56-node M2-002 suite, 156-node resolver/dispatcher/support focus, and complete
564-test repository suite pass on Node.js 22.23.1 and 24.14.0. The closing
review's provenance, pre-encoding resource, Unicode-contract, and stale-policy
findings were fixed, with no remaining code blocker or high finding. The plan is
not OOXML mutation, rendering, editability, staging, source-isolation,
collateral-diff, or publication evidence. All 60 support rows remain
non-supported and the global switch is false.

The repository has no remote. Keep it local until the public synthetic-fixture
flow can run `init -> inspect -> validate -> render -> qa`. After that executable
checkpoint and a fresh public-preflight scan, create a **public** repository;
the hosting account/organization is still undecided. The npm scoped-versus-
unscoped package decision is also deferred until package metadata is designed.

## Immediate objective

The next dependency is `M2-003`: implement one minimal native DrawingML
component through the same resolver/dispatcher path. Keep its input data-only,
fail closed on unsupported vocabulary, preserve editability as an explicit exit
criterion, and do not broaden the unavailable input or clone/fill claims.

## First commands after switching workspace

```sh
git status --short --branch
git config --local --list
rg -n '/[U]sers/|[A-Za-z]:\\\\[U]sers\\\\|PRIVATE KEY|BEGIN [A-Z ]+ PRIVATE KEY' .
rg --files
git log -1 --oneline
git remote -v
```

The private root package has no dependencies, so no install step is required.
Run `npm test`, `npm run inspect:synthetic`, and `npm run check:public-tree` to
revalidate the completed admission, support, fixture, data-contract,
runtime-context, semantic-inspector, secure-ingestion, capability-dispatch, and
semantic operation-planning gates.

## Next work session

1. Confirm the M0-004 through M2-002 acceptance commands pass on the clean checkout.
2. Read `docs/M2-002_HANDOFF.md`, the resolver, clone/fill schemas/plugin, and
   existing DrawingML contract/index vocabulary before designing M2-003.
3. Keep predecessor code, presentation assets, and generated archives out of
   Git; use only repository-owned text/synthetic contract fixtures for tests.

## Known predecessor findings

These facts justify the clean extraction boundary; they are not evidence that
this repository already implements the corresponding functions.

- The predecessor contains useful template inspection, formula, OOXML QA,
  capability-registry, and deterministic build experiments.
- Several apparent generic paths still dispatch to project-specific renderers,
  fixed slide/shape identifiers, or helpers that cannot be redistributed.
- A package dry-run without a positive allowlist produced a 1,440,242,285-byte
  tarball and 1,751,118,178 bytes unpacked, including build and worktree data.
  No package was published.
- Structural onboarding checks have been demonstrated on two fixtures, but a
  fully generic render has not. Do not claim arbitrary-template support.
- Direct formula-to-OMML transplantation has automated evidence, while the
  final native PowerPoint editing check remains a manual compatibility gate.

## Private local compatibility testing

Private files may be used from outside this repository under
`docs/PRIVATE_FIXTURE_POLICY.md`. Configure paths only in an ignored `.env` or a
local manifest. Never copy the input, derived preview, extracted XML, filename,
path, embedded metadata, slide text, or screenshot into this Git tree or public
CI artifacts.

## Definition of the first releasable alpha

An alpha is eligible only when a clean checkout can install the packed tarball
and run `init -> inspect -> validate -> render -> qa` on a synthetic template;
the output passes archive/relationship/schema/collateral checks; package and
repository leakage gates pass; all claimed capabilities have executors and
conformance tests; and the remaining compatibility limits are documented.
