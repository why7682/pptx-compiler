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
plans from exact text-box bindings. One opt-in experimental native-card-arrow
executor now produces a strict, canonical, non-raster `p:grpSp` conformance
fragment from data only. That fragment is explicitly unbound and non-insertable:
no PPTX/POTX package is mutated, final object IDs are not allocated, and
PowerPoint editability has not been proved. An isolated optional adapter can
also version/capability-probe an explicitly configured external Pandoc process,
send one bounded display formula as a JSON AST on stdin, and rebuild its DOCX
stdout as a strict canonical `m:oMath` conformance fragment. Public evidence
uses a fake runner; the formula result is likewise unbound and non-insertable.
The global support switch remains false and no row is supported. There is still
no published CLI,
arbitrary-template compatibility promise, or renderer. It is not yet a
releasable software package. Do not publish until the release gates in
[TODO.md](TODO.md) pass.

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
10. For the native card-arrow capability and its non-insertable ID boundary,
    read [docs/M2-003_HANDOFF.md](docs/M2-003_HANDOFF.md).
11. For the optional Pandoc/OMML process, attribution, and non-insertable
    formula boundary, read [docs/M2-004_HANDOFF.md](docs/M2-004_HANDOFF.md).
12. Load broader project/architecture documents only when the handoff routes to
   them.

The private root package has no dependencies; `npm test`,
`npm run inspect:synthetic`, and `npm run check:public-tree` verify the current
foundation. The next dependency is isolated create-only OOXML application,
normalization, semantic diff, collateral checks, and publication in `M2-005`.

## License

MIT. See [LICENSE](LICENSE).
