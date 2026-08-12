# PPTX Compiler

A template-first, contract-driven compiler for editable PPTX with
rendered-outcome verification.

## Status

This repository implements one narrow candidate-alpha spine under the MIT
License. The CLI can create the repository-owned public-synthetic project,
inspect its bounded POTX profile, validate the complete project graph, render
one explicitly opted-in native-card candidate, and emit an honest
`decision: "blocked"` QA report while required visual and compatibility
evidence is unavailable. It never creates a `BuildArtifact` for that result.

The publishable boundary is now designed as four guarded packages: CLI, core,
native-card-arrow, and public-synthetic. A machine-validated positive staging
plan owns their exact files, exports, types, bin, dependencies, assets, license,
runtime range, and currently unscoped alpha names. The final repository URL is
now bound to the verified public GitHub repository through package-plan
schema v2; npm publication remains separately blocked. M3-003 materializes
npm-private leaf manifests, creates and independently checks all four guarded
tarballs, installs them together offline in one empty directory, and runs the
complete installed-bin spine. The exact first-ref snapshot passed 1217/1217
tests under both admitted Node lines, the 24-node package-stage suite, and real
npm 10/11 four-tarball builds with offline installed-bin smoke. The subsequent
Windows portability correction changes the package plan and packed README, so
that historical evidence is not reused for the current working tree. This is
source and local package evidence, not npm publication or final release evidence.

This is not arbitrary-template compatibility, a general renderer, passed
delivery QA, or a published package. `supportClaimsEnabled` remains false and
no support row is `supported`. Do not publish until the release gates in
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
12. For the candidate-alpha CLI and blocked-QA boundary, read
    [docs/M3-001_HANDOFF.md](docs/M3-001_HANDOFF.md).
13. For the guarded four-package staging boundary, read
    [docs/M3-002_HANDOFF.md](docs/M3-002_HANDOFF.md).
14. For fixed-stage tarball inspection and clean-install evidence, read
    [docs/M3-003_HANDOFF.md](docs/M3-003_HANDOFF.md).
15. For the local public CI/security and development-toolchain contract, read
    [docs/M3-004_HANDOFF.md](docs/M3-004_HANDOFF.md).
16. For the completed minimum public-document boundary, read
    [docs/M3-005_HANDOFF.md](docs/M3-005_HANDOFF.md).
17. To reproduce the local public-safe boundary, follow
    [docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md).
18. Report suspected vulnerabilities through [SECURITY.md](SECURITY.md), and
    never through a public issue, discussion, or pull request.
19. Before proposing a change, read [CONTRIBUTING.md](CONTRIBUTING.md) and
    [GOVERNANCE.md](GOVERNANCE.md).
20. Load broader project/architecture documents only when the handoff routes to
    them.

Select an admitted Node 22 or 24 runtime first and follow the exact sequence in
[docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md). The guarded package build
regenerates one ignored `.package-stage/`, checks four npm-private tarballs,
installs them together offline, and runs the installed candidate-alpha spine.
GitHub now owns the first public `main` ref for `why7682/pptx-compiler`.
Private vulnerability reporting was reverified as enabled after the exact
push. M3-006 verified the final
history, canonical HTTPS transport, repository identity, and exact remote-main
equality. The canonical
repository ID/owner/name/URL are bound in package-plan schema v2 and projected
into each leaf manifest plus the root SBOM component, while `private: true`
continues to enforce the separate npm-publication guard. Corrected pull-request
Public CI run `31591756372` passes all Ubuntu/macOS/Windows × Node 22/24 cells;
first-ref CodeQL passes. Private-repository Dependency Review remains unavailable
without GitHub Advanced Security, and accepted-main CI/CodeQL remain pending. See
[docs/M3-004_HANDOFF.md](docs/M3-004_HANDOFF.md) for the exact evidence boundary.

## License

MIT. See [LICENSE](LICENSE).
