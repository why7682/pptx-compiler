# Repository Instructions

These instructions apply to the complete repository.

## Read order

Use progressive disclosure to avoid repeatedly loading the complete project
history.

For every new session, read only:

1. `HANDOFF.md`
2. `TODO.md`

For maintenance or audit of the completed `M0-004` gates, then read:

3. `docs/M0-004_HANDOFF.md`
4. `docs/PROVENANCE_LEDGER.md`
5. `docs/PRIVATE_FIXTURE_POLICY.md`
6. `docs/RELEASE_GATES.md`
7. `docs/DECISIONS.md`

For maintenance or audit of the completed `M0-005` support contract, read:

3. `docs/M0-005_HANDOFF.md`
4. `docs/SUPPORT_MATRIX.md`
5. `docs/COMPATIBILITY_POLICY.md`
6. `policy/support-matrix.json`

Read `docs/PROJECT_DEFINITION.md` and `docs/ARCHITECTURE_TARGET.md` only before
changing product scope, public contracts, packages, or dependency direction.

## Clean-room extraction

- This is a new, independent Git history. Never import another repository's
  history, worktrees, build products, review evidence, prompts, logs, or private
  assets.
- Do not copy a source file into this repository until its origin, copyright,
  dependencies, intended license, cleanup decision, and verification are
  recorded in `docs/PROVENANCE_LEDGER.md`.
- Treat any predecessor implementation as read-only reference material. Prefer
  a fresh implementation from the public contract and standards.
- Never commit an absolute local path, hostname, private personal name, private
  template identifier, source-deck text, slide/shape identifier from a private
  deck, or a hash that discloses the identity of a private fixture. The only
  exception is public project identity/copyright metadata explicitly accepted
  in `docs/DECISIONS.md`; do not extend that exception by inference.
- Do not add a license or make redistribution claims until the rights decision
  is recorded in `docs/DECISIONS.md`.

## Product rules

- Project onboarding generates schema-validated data by default, not renderer
  source code.
- A capability is `supported` only when metadata, a dispatchable executor,
  input/output schemas, conformance fixtures, and QA assertions all exist.
- Unknown template features, unsupported relationships, and ambiguous mutations
  fail closed. Never silently flatten an editable object to an image.
- Source templates are read-only. Builds are create-only and use staging plus
  atomic publication where the platform permits it.
- Public tests use only repository-owned, text-derived synthetic fixtures.
  Private fixtures are optional local compatibility probes and never required
  for public reproducibility.
- Treat PPTX/POTX as untrusted ZIP/XML input. Enforce archive, path, XML,
  relationship, macro, embedded-object, and resource limits before parsing or
  extraction.

## Packaging and release

- The workspace root remains private. Each publishable package has an explicit
  positive `files` allowlist, `exports`, `types`, `license`, `repository`, and
  supported runtime declaration.
- A release must pass a tarball-content gate, clean-directory install smoke
  test, secret/PII/absolute-path scan, license/provenance audit, SBOM generation,
  and public-fixture end-to-end test.
- Never run untrusted pull-request code on a machine with PowerPoint, private
  fixtures, signing material, or publication credentials.
- Do not commit until the public author identity is configured locally and the
  staged content has passed the leakage scan.

## Change discipline

- Implement the smallest complete vertical slice that advances the current
  TODO dependency.
- When maintaining `M0-004`, do not scan the predecessor repository, start a broad multi-agent
  fan-out, or load presentation assets. The exact task is self-contained in
  `docs/M0-004_HANDOFF.md`. One bounded independent review after implementation
  is sufficient.
- When maintaining `M0-005`, do not turn roadmap targets or predecessor
  observations into current support. The machine-readable matrix is normative.
- Add tests with every executable capability.
- Update the architecture, support matrix, provenance ledger, and release gates
  in the same change when their contract changes.
- Do not mark a TODO complete from compilation alone; record the executable or
  manual evidence named by its exit criterion.
