# PPTX Pipeline

Working name for a deterministic, contract-driven, template-first PPTX
compiler and quality-assurance toolkit.

## Status

This repository is a foundation pre-alpha licensed under the MIT License. It
contains executable clean-room admission, support-matrix, and versioned-contract
gates, a pure explicit-root `ProjectContext`, and a repository-owned
text-to-PPTX/POTX synthetic fixture generator. A pure semantic inspector now
normalizes the reviewed fixture lane's explicit parsed package view into a
deterministic redacted `TemplateIndex`. A separate bounded secure-ingestion
lane opens the configured source through a stable file handle and validates a
narrow ZIP/XML/OPC profile before producing that view. Generated archives are
ignored test data, and contract examples are schema-only fixtures. A
runtime-only dispatcher now proves exact artifact registration, full-batch
preflight, one-shot execution, output validation, and QA through a data-only
conformance probe. A pure in-memory resolver and a statically registered
clone/fill product executor now produce deterministic semantic JSON operation
plans from exact text-box bindings. Product dispatch remains unavailable and no
OOXML is mutated. There is still no published CLI, arbitrary-template
compatibility promise, or renderer. It is not yet a releasable software package.
Do not publish until the release gates in [TODO.md](TODO.md) pass.

## Intended function

The project will accept a user-owned PPTX or POTX template, a semantic deck
specification, data-only capability overlays, formulas, and local assets. It
will produce an editable PPTX where the declared capability supports native
objects, plus auditable validation and compatibility evidence.

Project onboarding should normally create configuration and schema-validated
data, not a new renderer. Project-specific code is permitted only as an
explicit extension package implementing the same capability contract and test
suite as built-in capabilities.

The initial product is not a prompt-to-slides generator, a universal design
file importer, or a complete replacement for PowerPoint. The supported input
and OOXML feature matrix will be explicit and fail closed.

## Start here

1. Read [HANDOFF.md](HANDOFF.md).
2. Read [TODO.md](TODO.md).
3. For the completed support boundary, read
   [docs/SUPPORT_MATRIX.md](docs/SUPPORT_MATRIX.md) and
   [docs/COMPATIBILITY_POLICY.md](docs/COMPATIBILITY_POLICY.md).
4. For the versioned data contracts, read
   [docs/M1-002_HANDOFF.md](docs/M1-002_HANDOFF.md).
5. For the explicit runtime context, read
   [docs/M1-003_HANDOFF.md](docs/M1-003_HANDOFF.md).
6. For the semantic inspector boundary, read
   [docs/M1-004_HANDOFF.md](docs/M1-004_HANDOFF.md).
7. For the secure ZIP/XML boundary, read
   [docs/M1-005_HANDOFF.md](docs/M1-005_HANDOFF.md).
8. For the runtime capability dispatcher, read
   [docs/M2-001_HANDOFF.md](docs/M2-001_HANDOFF.md).
9. For semantic project resolution and clone/fill planning, read
   [docs/M2-002_HANDOFF.md](docs/M2-002_HANDOFF.md).
10. Load broader project/architecture documents only when the handoff routes to
   them.

The private root package has no dependencies; `npm test`,
`npm run inspect:synthetic`, and `npm run check:public-tree` verify the current
foundation. The next dependency is the minimal native DrawingML component in
`M2-003`, implemented through the same resolver and dispatcher without
widening the unavailable input or clone/fill claims.

## License

MIT. See [LICENSE](LICENSE).
