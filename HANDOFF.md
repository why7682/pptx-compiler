# Codex Handoff

## Current state

This is an independent, clean-history workspace created to extract a generic
PPTX rendering and QA pipeline from a private predecessor project. Only plans,
contracts, safety rules, and release gates have been created. No code, binary
fixture, design asset, dependency lockfile, prompt log, or predecessor Git
history has been copied.

The project uses the MIT License with Elliot Wu as the declared copyright
holder. The working name, monorepo shape, and repository-local public Git author
identity are selected. Before every commit, run the leakage checks defined in
`docs/RELEASE_GATES.md`.

The repository has no remote. Keep it local until the public synthetic-fixture
flow can run `init -> inspect -> validate -> render -> qa`. After that executable
checkpoint and a fresh public-preflight scan, create a **public** repository;
the hosting account/organization is still undecided. The npm scoped-versus-
unscoped package decision is also deferred until package metadata is designed.

## Immediate objective

Implement only `M0-004`: executable provenance and forbidden-material gates.
The bounded contract, file targets, tests, and stop condition are in
`docs/M0-004_HANDOFF.md`.

Do not inspect or copy predecessor source code during this task. `M0-004` exists
to make that later admission process safe.

## First commands after switching workspace

```sh
git status --short --branch
git config --local --list
rg -n '/[U]sers/|[A-Za-z]:\\\\[U]sers\\\\|PRIVATE KEY|BEGIN [A-Z ]+ PRIVATE KEY' .
rg --files
git log -1 --oneline
git remote -v
```

Do not run `npm install` on entry: no package manifest or dependency lockfile
exists. `M0-004` may introduce a dependency-free, private root package manifest
only after recording the supported Node runtime decision.

## First work session

1. Read the bounded `M0-004` contract.
2. Record the minimum Node runtime and schema-authority decisions needed by the
   gate implementation; do not decide npm publication scope yet.
3. Implement and mutation-test the two gates against repository-owned temporary
   text fixtures.
4. Run the acceptance commands, update provenance/TODO, obtain one bounded
   read-only review, and commit the completed slice.
5. Stop. Do not start `M0-005` or inspect predecessor code in the same session
   unless the user explicitly continues.

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
