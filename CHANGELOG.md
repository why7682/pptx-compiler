# Changelog

## Purpose and boundary

This file constructs the user-visible candidate-alpha line from product scope
through executable contracts, evidence, and limits. The current projection is
`0.1.0-alpha.3`. It deliberately does not announce or deny an external release:
that mutable lifecycle fact is not owned by a lock-bound changelog.
Current support remains owned by
[`policy/support-matrix.json`](policy/support-matrix.json), release eligibility
by [`docs/RELEASE_GATES.md`](docs/RELEASE_GATES.md), and negative boundaries by
[`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md).

## 0.1.0-alpha.3 candidate contents

`0.1.0-alpha.3` preserves the same narrow product boundary: one installed
public-synthetic project, one explicit native-card candidate path, replayable
`CandidateBuildRecord`, honest blocked QA, and no `BuildArtifact`. It adds no
arbitrary-template compatibility, general renderer, delivery authority, or
supported matrix row.

The release contract now models npm's actual public-registry data. Package
identity, immutable `name@version`, and package-level dist-tags are separate
facts. Every package identity has `latest`; therefore the intended `alpha.3`
postcondition keeps core's existing `latest` at `0.1.0-alpha.2` while assigning
its `alpha` pointer to `0.1.0-alpha.3`, and allows the other three first-created
identities to receive both registry-seeded `latest` and requested `alpha` at
`0.1.0-alpha.3`. Only exact `npm publish --tag alpha` operations may produce
those assignments. No separate dist-tag repair or unpublish belongs to the
recovery.

The verifier also treats package metadata, tarball bytes, and attestations as
eventually consistent. It bounded-retries only an exact expected incomplete
propagation state, then applies the unchanged exact byte and certificate-bound
Sigstore checks. The approximately 59-second `alpha.2` observation motivates a
bounded policy; it is not an npm SLA or fixed wait.

D-050 authorizes the fresh annotated `alpha.3` tag and matching GitHub
prerelease, the four exact packages under `alpha`, GitHub Actions npm
provenance, and completion of the Trusted Publisher/bootstrap-credential
transition. Authorization is not publication evidence. The
[state-neutral `alpha.3` release projection](docs/releases/0.1.0-alpha.3.md)
owns the reader-facing candidate; Release Gates and official records own the
mutable phase.

### Preserved `alpha.2` partial state

The immutable `alpha.2` candidate passed its source, lock, tag, and hosted
gates. Release run `31665307969`, attempt 2, published only exact reviewed
`pptx-compiler-core@0.1.0-alpha.2` before stopping during immediate attestation
verification. Later independent reads matched its official tarball to the lock
and passed the exact certificate-bound SLSA and npm signature audits. The other
three versions and GitHub Release remain absent. No unpublish, old-tag movement,
separate `npm dist-tag add/rm`, or GitHub declaration occurred.

## 0.1.0-alpha.2 candidate contents (historical)

`0.1.0-alpha.2` preserves the exact product boundary below: one installed
public-synthetic project, one explicit native-card candidate path, replayable
`CandidateBuildRecord`, honest blocked QA, and no `BuildArtifact`. It does not
add arbitrary-template compatibility, a general renderer, delivery authority,
or a supported matrix row.

This subsection preserves D-049's candidate projection. D-050 and the current
`alpha.3` projection above own the forward recovery; nothing here authorizes an
additional `alpha.2` mutation.

The release boundary now admits the GitHub Actions OIDC request endpoint as
HTTPS on exactly one validated runner-service label beneath
`actions.githubusercontent.com`. It continues to reject user info, explicit
ports, fragments, empty paths, nested labels, suffix confusion, Unicode host
ambiguity, and non-GitHub endpoints. npm provenance still must pass the exact
workflow/tag certificate identity and GitHub Actions issuer checks; accepting a
service-owned runner shard does not weaken that cryptographic binding.

D-049 authorizes the exact annotated `v0.1.0-alpha.2` tag and GitHub
prerelease, the same four packages at `0.1.0-alpha.2` under dist-tag `alpha`,
and GitHub Actions npm provenance followed by Trusted Publisher migration and
bootstrap-token retirement. Authorization is not publication evidence. Current
lifecycle state is established only by joining the exact tracked `alpha.2`
lock identity with official GitHub and npm records; this sentence asserts no
current phase. See the
[state-neutral `alpha.2` release projection](docs/releases/0.1.0-alpha.2.md).

### `alpha.1` publication history

The immutable `v0.1.0-alpha.1` source candidate passed tag Public CI run
`31652084833` and Security run `31652084727`. Manual release run
`31652404999` then failed closed at OIDC environment admission before the
first npm publish; its GitHub declaration job was skipped. All four exact
`0.1.0-alpha.1` npm versions and the GitHub Release remained absent, so no
rollback or unpublish occurred. That version is retired unpublished; its tag,
lock, note, source commit, attestation commit, and run evidence remain immutable
history and are not reused as `alpha.2` authority.

## 0.1.0-alpha.1 candidate contents (historical)

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
  they cannot be relabeled as release artifacts. Historical package-plan schema
  3 defined the `alpha.1`/`alpha.2` public manifests, while each M4-001 lock requires
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
current boundary. The immutable historical
[`alpha.1` projection](docs/releases/0.1.0-alpha.1.md) and preserved
[`alpha.2` projection](docs/releases/0.1.0-alpha.2.md) remain available beside
the current [`alpha.3` projection](docs/releases/0.1.0-alpha.3.md).

## Release verification boundary

At any lifecycle state, M4-001 may advance only through the earliest
unsatisfied `alpha.3` release gate. The required order is: admit the corrected
registry model; freeze the inputs and two builder results; create, review, and
merge the fresh lock as GitHub-verified `S3`; append sole-parent exact-grant
`A3`; pass the full history gate; then annotate unchanged `S3` as
`v0.1.0-alpha.3`. Tag-triggered Public CI and Security precede dependency-order
npm publication. Official-registry bytes, provenance, and complete dist-tag
maps must match the contract before the GitHub Release is created last. D-047 branch protection
remains separately deferred and is never implied by this sequence. Whether the
sequence is pending or complete belongs to Release Gates and official records,
not this changelog.
