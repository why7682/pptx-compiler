# Changelog

## Purpose and boundary

This file records user-visible changes intended for the first public candidate
alpha. It does not announce a release. Current support remains owned by
[`policy/support-matrix.json`](policy/support-matrix.json), release eligibility
by [`docs/RELEASE_GATES.md`](docs/RELEASE_GATES.md), and negative boundaries by
[`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md).

## Unreleased

The planned package version is `0.1.0-alpha.1`. No release tag, npm package, or
published release artifact currently exists.

### Candidate workflow

- Added one installed, explicit-root public-synthetic flow:
  `init -> inspect -> validate project -> render -> qa`.
- Added a bounded secure POTX inspection path and a complete project graph
  preflight against the normative support matrix.
- Added one explicitly opted-in native-card candidate renderer that publishes a
  deterministic PPTX with its replayable `CandidateBuildRecord`.
- Added honest QA that re-derives and exact-compares the candidate pair, emits
  `decision: "blocked"` while external delivery evidence is unavailable, and
  creates no `BuildArtifact`.

### Contracts and authority

- Added versioned JSON Schema contracts and generated public TypeScript
  declarations for project, template, capability, deck, candidate, QA, and
  build records.
- Separated editable `SlideLayoutIR` intent from frozen
  `ComposedSlidePlan` geometry and retained both in candidate replay evidence.
- Kept support, release, package, evidence, and human-process facts under
  separate machine-readable or documented owners.

### Security and failure behavior

- Added fail-closed filesystem, ZIP, XML, OPC, relationship, macro, ActiveX,
  OLE, embedded-object, resource-limit, and unknown-feature rejection for the
  exact public-synthetic input profile.
- Added create-only publication, source-immutability, exact collateral-diff,
  record-first/PPTX-marker-last ordering, and explicit not-committed,
  rollback-incomplete, and commit-uncertain outcomes.
- Added exact per-file provenance, forbidden-material, source/import, package,
  support-overclaim, contract, and reachable-history gates.

### Packages and public project

- Defined four guarded packages: `pptx-compiler`, `pptx-compiler-core`,
  `pptx-compiler-native-card-arrow`, and
  `pptx-compiler-public-synthetic`.
- Added positive file/export/type/bin/dependency plans, canonical tarball
  admission, offline joint installation, installed CLI smoke, and a
  plan-derived CycloneDX static-ESM SBOM.
- Published the reviewed source history at
  [`why7682/pptx-compiler`](https://github.com/why7682/pptx-compiler) and enabled
  GitHub private vulnerability reporting.
- Kept all leaf manifests private and npm publication explicitly unauthorized.

### Public evidence

- Pull-request Public CI
  [run 31600528716](https://github.com/why7682/pptx-compiler/actions/runs/31600528716)
  passed Linux, macOS, and Windows under Node.js 22 and 24.
- Pull-request Security
  [run 31600528742](https://github.com/why7682/pptx-compiler/actions/runs/31600528742)
  passed Dependency Review.
- Accepted-main Public CI
  [run 31600806512](https://github.com/why7682/pptx-compiler/actions/runs/31600806512)
  passed all six cells for object `c4dee58`.
- Accepted-main Security
  [run 31600806350](https://github.com/why7682/pptx-compiler/actions/runs/31600806350)
  passed CodeQL for the same object.

These runs establish hosted evidence, not supported capabilities or a released
artifact. The matrix remains 0 supported / 22 experimental / 3 manual / 35
unsupported with `supportClaimsEnabled=false`.

### Not included

- No arbitrary PPTX/POTX compatibility, generic renderer, delivery-authorized
  QA, formula CLI, asset placement, charts, tables, media, or animation support.
- No release tag, signing/provenance-enabled release, npm authorization, or
  reviewed-to-published tarball equality.
- No branch-protection claim; D-047 deliberately defers that repository setting.

See [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) for the complete
current boundary and
[`docs/releases/0.1.0-alpha.1.md`](docs/releases/0.1.0-alpha.1.md) for the draft
release-facing projection.

## Next authorized action

M4-001 may cut `0.1.0-alpha.1` only after a reviewed tag passes the clean-tag
gates, publication is explicitly authorized, and every published artifact is
proved byte-identical to its reviewed tarball. Until then, this changelog stays
under `Unreleased`.
