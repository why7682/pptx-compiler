# Codex Handoff

## Current state

This is an independent, clean-history workspace created to extract a generic
PPTX rendering and QA pipeline from a private predecessor project. It now has
plans, versioned data contracts, dependency-free foundation policy gates,
reviewed text-only OOXML fixture parts, generated TypeScript declarations, a
pure explicit-root runtime context, and synthetic mutation tests. No PPTX
product implementation, tracked binary fixture, design asset, dependency
lockfile, prompt log, or predecessor Git history has been copied.

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

The repository has no remote. Keep it local until the public synthetic-fixture
flow can run `init -> inspect -> validate -> render -> qa`. After that executable
checkpoint and a fresh public-preflight scan, create a **public** repository;
the hosting account/organization is still undecided. The npm scoped-versus-
unscoped package decision is also deferred until package metadata is designed.

## Immediate objective

The next dependency is `M1-004`: implement a distributable template inspector
that consumes the explicit `ProjectContext` and produces a deterministic,
path-redacted index for the repository-owned synthetic fixture. Keep secure
untrusted ZIP/XML ingestion in M1-005 and do not import managed/private helpers.

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
Run `npm test` and `npm run check:public-tree` to revalidate the completed
admission, support, fixture, data-contract, and runtime-context gates.

## Next work session

1. Confirm the M0-004 through M1-003 acceptance commands pass on the clean checkout.
2. Read `docs/M1-003_HANDOFF.md` before consuming `ProjectContext` in M1-004.
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
