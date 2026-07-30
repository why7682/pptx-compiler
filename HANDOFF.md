# Codex Handoff

## Current state

This is an independent, empty-history workspace created to extract a generic
PPTX rendering and QA pipeline from a private predecessor project. Only plans,
contracts, safety rules, and release gates have been created. No code, binary
fixture, design asset, dependency lockfile, prompt log, or predecessor Git
history has been copied.

The project uses the MIT License with Elliot Wu as the declared copyright
holder. The working name, monorepo shape, and repository-local public Git author
identity are selected. Before every commit, run the leakage checks defined in
`docs/RELEASE_GATES.md`.

## First commands after switching workspace

```sh
git status --short --branch
git config --local --list
rg -n '/[U]sers/|[A-Za-z]:\\\\[U]sers\\\\|PRIVATE KEY|BEGIN [A-Z ]+ PRIVATE KEY' .
rg --files
```

Do not run `npm install`: no package manifest should exist until the P0 design
decisions are resolved.

## First work session

1. Recheck working-name availability before registry/repository registration
   and select the runtime support policy in `docs/DECISIONS.md`.
2. Complete the exclusion and provenance policy before reviewing any candidate
   predecessor source file.
3. Write the synthetic-fixture generator from repository-owned text OOXML
   parts. Do not use or derive it from a private template.
4. Define the versioned `ProjectConfig`, `TemplateProfile`, `Capability`,
   `SlideSpec`, `BuildArtifact`, and `QaReport` schemas.
5. Implement one end-to-end `inspect -> validate -> clone-fill -> qa` vertical
   slice against the synthetic fixture.
6. Add secure archive handling before accepting arbitrary external decks.

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
