# M0-004 Implementation Handoff

## Objective

Turn the documentary clean-room rules into two deterministic, fail-closed gates
before any predecessor code or fixture can be considered for admission:

1. a tracked/staged-tree forbidden-material gate;
2. a machine-readable per-file provenance gate.

Complete this slice without reading the predecessor repository, private
fixtures, PowerPoint files, or presentation evidence.

## Fixed input set

Read only:

- `AGENTS.md`;
- `HANDOFF.md`;
- `TODO.md`;
- `docs/PROVENANCE_LEDGER.md`;
- `docs/PRIVATE_FIXTURE_POLICY.md`;
- `docs/RELEASE_GATES.md`;
- `docs/DECISIONS.md`;
- the files created for this task.

Official Node, JSON Schema, SPDX, Git, or REUSE documentation may be consulted
when a contract detail cannot be established locally. Do not perform broad
competitive, PPTX, predecessor, or filesystem research.

## Required deliverables

The implementer may adjust names while preserving these boundaries:

```text
policy/forbidden-materials.json
schemas/provenance-record.schema.json
provenance/records.json
scripts/check-forbidden-materials.mjs
scripts/check-provenance.mjs
tests/policy-gates.test.mjs
package.json                         # private root; dependency-free if feasible
```

`package.json`, if introduced, must use `"private": true`; it must not decide
the future npm scope, add a repository URL, or expose a publishable package.
Avoid dependencies unless a standard-library implementation would materially
weaken validation or security.

## Forbidden-material contract

The normative policy must be data, not hard-coded project-specific conditionals.
At minimum, the gate must:

- scan the Git index/staged tree, with an explicit working-tree diagnostic mode;
- reject absolute user paths, host-specific paths, secrets/private-key markers,
  local environment files, private manifests, worktrees, build/review outputs,
  presentation/PDF/font/archive binaries, symlinks, submodules, and oversized
  files;
- inspect both extension and file magic so renaming a binary does not bypass the
  gate;
- reject unapproved executable files and private identifiers without embedding
  predecessor-specific names in the public policy;
- use a narrow allowlist for approved public copyright identity;
- redact matched secret/private text in diagnostics while reporting path, rule
  ID, severity, and non-sensitive location;
- return nonzero on policy/configuration errors and on findings;
- produce deterministic human output and a versioned JSON report mode;
- never follow symlinks or read outside the repository root.

For M0-004, rejecting every ZIP/archive binary is acceptable. Public PPTX
fixtures will later be generated from reviewed text OOXML parts into ignored
temporary output.

## Provenance contract

Make a machine-readable provenance file the normative source. The existing
Markdown ledger remains the human policy and may summarize the machine data.

Every tracked file must have either an exact provenance record or a narrowly
defined, documented generated-file rule. Each record must cover:

- repository-relative path;
- kind and origin;
- copyright holder or source authority;
- SPDX license expression or explicit rights basis;
- review/admission date;
- third-party dependencies;
- private-information review;
- project-constant cleanup status;
- public conformance applicability;
- independent-review status and notes.

Paths must be canonical repository-relative paths. Reject duplicates,
nonexistent entries, missing tracked files, path traversal, absolute paths,
unknown schema versions, invalid enum values, and unapproved pending fields.

## Required tests

Use temporary, repository-owned text fixtures. Include at least one passing
case and one mutation for each failure family:

- forbidden extension;
- disguised ZIP/binary magic;
- absolute local path in text;
- private-key/secret marker with redacted diagnostic;
- symlink;
- oversized file;
- forbidden directory;
- unapproved executable bit;
- missing provenance record;
- orphan/duplicate/traversing provenance path;
- invalid SPDX/rights/status field;
- nondeterministic ordering or unstable JSON output.

Tests must not contain a real secret, private filename, local absolute path, or
copied predecessor identifier. Construct synthetic markers at runtime from
separate string fragments when necessary so the repository itself remains
clean.

## Acceptance sequence

The final command names may differ, but one documented command must execute the
complete gate:

```sh
npm test
npm run check:public-tree
git diff --check
git status --short --branch
```

Before marking `M0-004` complete:

- run the gate against the staged tree containing its own implementation;
- prove required mutations are rejected;
- verify the Git author identity remains repository-local;
- update `docs/PROVENANCE_LEDGER.md`, `TODO.md`, and any changed decision;
- obtain one bounded independent read-only review;
- commit only the reviewed M0-004 slice.

## Token and fan-out budget

- Do not scan the predecessor repository.
- Do not start per-file agents or open-ended research.
- Keep tool output to exact files and failing mutations.
- Use one main implementation context and at most one final read-only reviewer.
- Do not work on the Codex runner experiment in `labs/`.

## Stop condition

Stop after `M0-004` is committed and the working tree is clean. Report the
commit, commands, mutation count, known limitations, and next TODO. Do not begin
`M0-005`, create a Git remote, choose an npm scope, or migrate predecessor code
without a new user instruction.
