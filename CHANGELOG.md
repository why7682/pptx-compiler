# Changelog

## Purpose and boundary

This file freezes the user-visible contents associated with the first public
candidate alpha. It deliberately does not announce or deny an external release:
that mutable lifecycle fact is not owned by a lock-bound changelog.
Current support remains owned by
[`policy/support-matrix.json`](policy/support-matrix.json), release eligibility
by [`docs/RELEASE_GATES.md`](docs/RELEASE_GATES.md), and negative boundaries by
[`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md).

## 0.1.0-alpha.1 candidate contents

These are the exact reader-facing changes for version `0.1.0-alpha.1`. D-048
authorizes its exact tag, four public npm packages under dist-tag `alpha`, and
GitHub Actions plus npm provenance. Authorization is not publication evidence;
actual release status is established only by joining the tracked release lock
to official GitHub and npm records.

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
- Kept the historical M3 private-manifest tarballs as package-boundary evidence;
  they cannot be relabeled as release artifacts. Package-plan schema 3 defines
  the separately authorized public manifests, while the M4-001 lock requires
  equal dual-builder canonical tar payloads and alone identifies the fixed
  builder's gzip envelopes as candidate release bytes.

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

- Constructive-document PR #2 Public CI
  [run 31608992503](https://github.com/why7682/pptx-compiler/actions/runs/31608992503)
  and Security
  [run 31608992491](https://github.com/why7682/pptx-compiler/actions/runs/31608992491)
  passed for head `093d527fc3fadf7cae577139b8d400719755dd52`.
- Accepted-main Public CI
  [run 31609285181](https://github.com/why7682/pptx-compiler/actions/runs/31609285181)
  and Security
  [run 31609285220](https://github.com/why7682/pptx-compiler/actions/runs/31609285220)
  passed for `8cdf968b72f8dd5f41fee37a68e239e477dec44b`.

Those two commits share tree `1d6d148a8bc347dc3cbc13dde3fd4314d86c421a`.
This is accepted reader-document evidence. Those named runs do not establish a
clean-tag build, public tarball, registry equality, provenance, or GitHub
Release result.

### Not included

- No arbitrary PPTX/POTX compatibility, generic renderer, delivery-authorized
  QA, formula CLI, asset placement, charts, tables, media, or animation support.
- No release or support conclusion may be inferred from this changelog.
  Candidate identity comes from the tracked lock; distribution and provenance
  come from the official registry and GitHub records.
- No branch-protection claim; D-047 deliberately defers that repository setting.

See [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) for the complete
current boundary and
[`docs/releases/0.1.0-alpha.1.md`](docs/releases/0.1.0-alpha.1.md) for the
state-neutral release-facing projection.

## Release verification boundary

M4-001 may advance only through the earliest unsatisfied release gate. Freeze
the inputs and two builder results; create, review, commit, and merge the lock
as GitHub-verified commit `S`; append exactly one repository-local identity
attestation `A` whose sole parent is `S` and whose tip policy grants `S`; pass
the full history gate at `main=A`; then annotate `S` as
`v0.1.0-alpha.1`. Tag-triggered Public CI and Security precede dependency-order
npm publication. Official-registry bytes, provenance, and dist-tags must match
the lock before the GitHub Release is created last. D-047 branch protection
remains separately deferred and is never implied by this sequence.
