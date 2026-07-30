# M0-005 Implementation Contract

## Objective

Define one fail-closed public vocabulary for what the project supports now,
what remains experimental or manual, and what is unsupported. Separate the
current pre-alpha evidence from the intended 0.x roadmap so planning text can
never be mistaken for an executable support claim.

This task may define and validate contracts. It must not inspect predecessor
code, ingest a presentation, implement rendering, create a synthetic PPTX, or
claim that any PPTX capability is already supported.

## Inputs

Use only the repository's public planning, architecture, security, private-
fixture, provenance, decision, and release-gate documents. Standards links may
clarify terminology, but no private or predecessor evidence is admissible.

## Required deliverables

```text
policy/support-matrix.json
schemas/support-matrix.schema.json
scripts/check-support-matrix.mjs
tests/support-matrix.test.mjs
docs/SUPPORT_MATRIX.md
docs/COMPATIBILITY_POLICY.md
```

The JSON matrix is normative. The Markdown documents explain it for humans and
must not broaden its claims.

## Required contract

- Use exactly four public statuses: `supported`, `experimental`, `manual`, and
  `unsupported`.
- Cover inputs, OOXML features, capabilities, platforms, and evidence levels.
- Include explicit catch-all rows for unknown inputs, OOXML features, platforms,
  and unavailable evidence.
- Set a global claim switch. It remains false while this repository has no
  executable PPTX vertical slice.
- A capability may become `supported` only with metadata, executor, input and
  output schemas, a public conformance fixture, and QA assertions.
- `manual` evidence remains visible and can never be promoted to an automatic
  pass. Private compatibility probes cannot establish public support.
- Unknown versions, fields, features, ambiguous bindings, missing evidence, and
  invalid status/disposition combinations fail closed.
- High-risk OOXML dispositions remain target policy only until the secure
  ingestion mutations in M1-005 pass.

## Compatibility rules

- Matrix and public data contracts carry explicit schema versions.
- During 0.x, an incompatible contract change requires a minor-version bump and
  migration notes; patches remain backward-compatible within the same minor.
- Unknown major/minor schema versions and unknown fields are rejected unless a
  later, explicit migration contract says otherwise.
- Support is scoped to the exact item, platform, runtime, adapter, and evidence
  named. No success may be generalized to arbitrary templates or editability.

## Tests and acceptance

Mutation tests must reject at least: unknown versions and fields, missing
dimensions, unknown statuses, a supported claim while claims are disabled, a
supported capability missing required evidence, invalid manual/unsupported
dispositions, duplicate or unsorted IDs, missing catch-alls, and nonexistent
evidence artifacts.

Acceptance commands:

```sh
npm test
npm run check:working-tree
git add <the reviewed M0-005 slice>
npm run check:public-tree
git diff --cached --check
git status --short --branch
```

## Stop condition

Stop after M0-005 is committed and the working tree is clean. Report the
current support-claim state, test count, known limitations, commit, and next
TODO. Do not begin M1-001 or create a Git remote in the same session.
