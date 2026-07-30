# PPTX Pipeline

Working name for a deterministic, contract-driven, template-first PPTX
compiler and quality-assurance toolkit.

## Status

This repository is a foundation pre-alpha licensed under the MIT License. It
contains executable clean-room admission and support-matrix gates plus a
repository-owned text-to-PPTX/POTX synthetic fixture generator. Generated
archives are ignored test data; there is still no migrated production code,
accepted presentation input, inspector, or renderer. It is not yet a releasable
software package. Do not publish until the release gates in [TODO.md](TODO.md)
pass.

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
4. Load broader project/architecture documents only when the handoff routes to
   them.

The private root package has no dependencies; `npm test` and
`npm run check:public-tree` verify the current foundation. The next task is the
versioned schema set in `M1-002`, not renderer migration.

## License

MIT. See [LICENSE](LICENSE).
