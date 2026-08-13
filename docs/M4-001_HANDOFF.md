# M4-001 Handoff — Candidate-Alpha Release

## Purpose and boundary

The release publishes one narrow candidate-alpha toolchain, not a general PPTX
renderer or delivery-approved product. Its installed path creates the exact
public-synthetic project, securely inspects its bounded POTX, validates and
preflights one exact experimental capability batch, renders one native-card
candidate plus `CandidateBuildRecord`, and emits a schema-valid blocked
`QaReport`. It creates no `BuildArtifact`.

Release success distributes exact reviewed bytes. It cannot promote support,
invent compatibility, change blocked QA to pass, or turn a candidate PPTX into
a delivery.

## Current status

M4-001 remains active at a fail-closed recovery boundary:

- `M4-001A` is complete. The non-publishing release contract, fixed builders,
  package graph, registry recovery states, Sigstore verification, workflow
  credential separation, and GitHub-Release-last declaration are admitted.
- The immutable `0.1.0-alpha.1` candidate completed its M4-001B source, lock,
  attestation, annotated-tag, and tag-hosted gates. Its first manual release
  run then stopped before the first npm publish. That version is retired
  unpublished and remains immutable historical evidence.
- `M4-001B` is now in progress for the D-049-authorized replacement
  `0.1.0-alpha.2`. It requires a fresh package/version projection, dual-builder
  lock, reviewed merge `S2`, attestation `A2`, full-history admission,
  annotated tag, and tag-hosted gates. None of those `alpha.2` objects is
  asserted yet.
- `M4-001C` remains pending. It may begin only after complete `alpha.2`
  candidate admission, and it is not complete until ordered npm publication,
  official-registry/provenance/signature/dist-tag verification, GitHub Release
  declaration, all four Trusted Publisher bindings, bootstrap-token revocation,
  and deletion of GitHub `NPM_TOKEN` are evidenced.

D-047/M3-008 branch protection remains independently deferred. Neither D-049
nor any M4 phase resumes it or makes it a release prerequisite.

## Fact ownership

| Fact | Owner |
| --- | --- |
| External-action authorization | D-049 in `docs/DECISIONS.md`; D-048 remains the immutable historical `alpha.1` authority |
| Package graph, version, public manifests, registry, access, dist-tag, provenance setting, dependency order | `packaging/alpha-package-plan.json` |
| Exact tag, builders, locked inputs, recovery and completion rules | `packaging/alpha-release-plan.json` |
| Release phase order and eligibility | `docs/RELEASE_GATES.md` |
| Current support state | `policy/support-matrix.json` |
| User-facing delta and negative contract | `CHANGELOG.md`, `docs/KNOWN_LIMITATIONS.md`, and `docs/releases/0.1.0-alpha.2.md` |
| Exact `alpha.2` candidate/artifact identity | Future reviewed `packaging/releases/0.1.0-alpha.2.lock.json`; no lock exists by documentation assertion |
| Actual npm/GitHub lifecycle state | Official registry responses, fetched npm provenance/signatures, exact GitHub tag and Release records |

The package plan owns publication settings and dependency edges exactly once.
The publisher derives `core -> native-card-arrow -> public-synthetic -> CLI`
from that graph. The release plan references those settings and owns exact
candidate/recovery rules. Release Gates owns phase order. A release lock is an
identity boundary, not another package plan or support authority.

## `alpha.2` candidate admission

D-049 authorizes exact package version `0.1.0-alpha.2`, annotated tag
`v0.1.0-alpha.2` with message `pptx-compiler 0.1.0-alpha.2`, public access,
dist-tag `alpha`, GitHub Actions npm provenance, and a matching non-draft
GitHub prerelease created last. Authorization is not execution evidence.

Candidate admission must prove that the tag peels to the exact reviewed
GitHub-verified lock-containing commit `S2`, while current remote `main=A2` is
exactly its one-commit public-identity attestation. `A2` must have `S2` as its
sole parent, its tip-owned policy must exact-grant `S2`, and GitHub comparison
must report `ahead_by=1` and `behind_by=0`. Equality, a deeper descendant, an
additional parent, or another verified commit fails closed.

The annotated tag must have the approved public tagger, exact message, no extra
header/signature/control text, the expected raw object identity, and exact
remote/local agreement. Its checkout must be clean and full-history with no
replace refs, grafts, alternates, shallow boundary, or tracked-input drift.
Candidate inspection rereads every mapped blob and mode from the exact tag
tree; a clean working directory is not a substitute for tracked membership.

This is an annotated identity binding, not a cryptographically signed Git tag.
Tag Public CI and CodeQL supply source-test evidence. npm Sigstore provenance
supplies the artifact signature boundary.

## Fixed builders and release lock

The two builder identities remain fixed and ordered:

1. Node 22.23.2 with npm 10.9.8;
2. Node 24.19.0 with npm 11.17.0.

Both builders must independently pass the guarded four-package build, exact
package admission, offline joint installation, and installed CLI smoke. Each
package must have byte-identical canonical decompressed tar payloads after
member-by-member tracked-source projection. Builder-local evidence records and
gzip SHA-256, SHA-512, and compressed sizes remain separate. Only the fixed
Node 24/npm 11 gzip envelopes may become publication bytes.

The new create-only `packaging/releases/0.1.0-alpha.2.lock.json` must bind:

```text
schemaVersion
lockType
releaseVersion
releasePlanSha256
packagePlanSha256
packageSourceProjectionSha256
inputs[{ path, sha256 }]
builderResults[{
  nodeVersion, npmVersion, evidenceSha256, evidenceBytes,
  packages[{
    packageId, name, tarball, sha256, sha512, compressedBytes,
    tarSha256, tarBytes
  }]
}]
```

Locked inputs include the package/release plans, support matrix, SBOM,
changelog, known limitations, and state-neutral `alpha.2` release note. The
lock does not exist until both fixed results, exact source projection, review,
and create-only write have succeeded. It must then be tracked and merged before
the tag exists.

## GitHub Actions OIDC and provenance boundary

The real observed problem was an environment precondition, not npm account,
token, package, source, or tarball drift. GitHub Actions supplies an OIDC
request URL whose runner shard is service-selected. The old check admitted one
observed hostname; the hosted runner used another legitimate single-label
subdomain of `actions.githubusercontent.com`.

The bounded correction admits only:

- HTTPS;
- exactly one ASCII DNS label beneath `actions.githubusercontent.com`;
- no username, password, explicit port, or fragment; and
- a nonempty request path.

It rejects the bare suffix, nested labels, lookalike suffixes, trailing-dot or
empty-label forms, non-ASCII raw URL text, whitespace/control bytes, IP
addresses, and non-GitHub hosts. This check only authenticates the expected
environment class. A published provenance payload remains untrusted until the
same fetched v0.3 keyless bundle passes the fixed npm 11.17.0 Sigstore verifier
with the exact alpha-release workflow/tag certificate identity and GitHub
Actions issuer.

## Workflow and credential separation

Ordinary Public CI and Security run on the exact tag without publication
credentials. The separate alpha-release workflow is manual-only. Its admission
job must match the event, ref type/name, input, and immutable event commit. The
publish job checks out that event commit with full history and proves the exact
fetched tag still peels to `HEAD`; it never resolves a mutable tag name after
queuing.

Source verification uses GitHub read authority without npm credentials. Only
the final publish step may see the environment-scoped bootstrap npm token and
OIDC request inputs. A separate fresh-checkout declaration job receives
GitHub contents-write authority but no npm token or OIDC request inputs. No
process receives both npm and GitHub write credentials.

The user confirmed on 2026-08-13 that the npm account email is verified, 2FA is
enabled, and GitHub environment `npm-release` contains the one-time
`NPM_TOKEN`. This is a user-attested non-secret configuration fact, not a token
value check or publication result.

## Publication and recovery state machine

Publication order is derived from the package graph:

```text
pptx-compiler-core
  -> pptx-compiler-native-card-arrow
  -> pptx-compiler-public-synthetic
  -> pptx-compiler
```

Before each exact `0.1.0-alpha.2` step, query the official registry:

- `absent`: publish only the retained lock-matching tarball with public access,
  dist-tag `alpha`, and npm provenance;
- `present-equal`: download and exact-compare registry bytes, metadata,
  provenance, and signature, then continue without republishing;
- `present-mismatch`: hard-stop permanently for that version. Never unpublish,
  overwrite, or continue.

The publisher materializes frozen bytes into its own private read-only
temporary file; it never gives npm a mutable reviewed-stage path. After each
package becomes present-equal, the complete published dependency prefix must
pass signature audit before publication advances.

After all four exist, reread all official-registry tarballs and require exact
lock bytes, valid certificate-bound npm provenance/signatures, dist-tag `alpha`
pointing to `0.1.0-alpha.2`, and no `latest` assignment. Only that complete
state permits the GitHub prerelease to be created. The declaration lane repeats
source and registry verification, creates an absent exact non-draft prerelease
or accepts an exact-equal retry, and never patches or deletes a mismatch.

GitHub Release creation is the last publication mutation, but M4-001C remains
incomplete until all four package settings contain the exact Trusted Publisher
binding for `why7682/pptx-compiler`, workflow `alpha-release.yml`, environment
`npm-release`; the bootstrap npm token is revoked; and GitHub `NPM_TOKEN` is
deleted. Only non-secret configuration facts may be recorded.

## Immutable `alpha.1` evidence

The retired candidate remains a useful proof that the release state machine
stopped before mutation:

| Fact | Exact evidence |
| --- | --- |
| Lock-containing merge `S1` | `ad4ab94959e9f7cff56834c81be4ddecd11e7332` |
| Sole-child attestation `A1` | `7d8341ebc01f8769a73020103d18c93b4049468f` |
| Annotated tag object | `v0.1.0-alpha.1`, object `0d23ce3903052454ba77e6c88360f0c4fffa4173`, peeling to `S1` |
| Tag Public CI | [run 31652084833](https://github.com/why7682/pptx-compiler/actions/runs/31652084833), success |
| Tag Security | [run 31652084727](https://github.com/why7682/pptx-compiler/actions/runs/31652084727), success |
| Manual release | [run 31652404999](https://github.com/why7682/pptx-compiler/actions/runs/31652404999), failed closed before first npm publish; declaration skipped |
| External result | Four exact npm versions absent; GitHub Release absent; no rollback or unpublish |

The historical lock SHA-256 remains
`d3b4818e9bcdb43f39df557847613d3e5ce0afa2f6fffda5af655217f2f5170a`,
with package-source projection
`962defc231e784627c142f01df84669b08d9a7b3f1bae39da2ea1f2728d95312`.
Those immutable facts cannot authorize an `alpha.2` byte, tag, package,
provenance result, or Release.

## Current public evidence

M3-004B remains the implementation baseline on accepted PR head
`f6ba6bad48c928d31c356d47911dd929ccf3b2d1` and accepted main
`c4dee58a8920a8e71c20f53ab93c62a96d3cb89d`. The later constructive-document
PR #2 head `093d527fc3fadf7cae577139b8d400719755dd52` passed Public CI/Security runs
`31608992503`/`31608992491`; accepted main
`8cdf968b72f8dd5f41fee37a68e239e477dec44b` passed runs
`31609285181`/`31609285220`. Those object-bound records establish source and
reader baselines, not `alpha.2` release evidence.

Support remains 0 supported / 22 experimental / 3 manual / 35 unsupported,
with `supportClaimsEnabled=false`. QA remains blocked and no `BuildArtifact`
exists. D-049 and the OIDC correction do not change those facts.

## Next exact action

1. Finish the bounded OIDC-host correction review and complete the exact
   `0.1.0-alpha.2` package/release projection without modifying historical
   `alpha.1` objects.
2. Run both fixed builders; create, review, and track the fresh `alpha.2` lock.
3. Merge the unchanged lock as GitHub-verified `S2`; append only its exact
   single-parent attestation `A2`; pass current-main history admission; create
   the annotated tag on unchanged `S2`; and require tag Public CI and Security.
4. Only then run M4-001C's dependency-order registry state machine, complete
   byte/provenance/signature/dist-tag verification, and create the GitHub
   prerelease last.
5. Configure all four Trusted Publishers, revoke the bootstrap token, and
   delete GitHub `NPM_TOKEN` before marking M4-001C complete.

Do not add lifecycle claims to the lock-bound changelog, limitations, or
`alpha.2` note. Do not resume branch protection by implication.
