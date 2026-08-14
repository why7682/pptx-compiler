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

M4-001's exact candidate-alpha release boundary is complete:

- `M4-001A` is complete. The non-publishing release contract, fixed builders,
  package graph, registry recovery states, Sigstore verification, workflow
  credential separation, and GitHub-Release-last declaration are admitted.
- The immutable `0.1.0-alpha.1` candidate completed its M4-001B source, lock,
  attestation, annotated-tag, and tag-hosted gates. Its first manual release
  run then stopped before the first npm publish. That version is retired
  unpublished and remains immutable historical evidence.
- The immutable `0.1.0-alpha.2` candidate completed its source, dual-builder
  lock, reviewed `S2`, sole-child attestation `A2`, annotated tag, and hosted
  gates. Manual release run `31665307969`, attempt 2, then published the exact
  reviewed core package and stopped during immediate attestation verification.
  The other three exact versions and the GitHub Release remain absent. No
  unpublish, Git-tag movement, separate dist-tag repair, or declaration
  occurred. `alpha.2` is a preserved partial publication, not a release.
- D-050's fresh `0.1.0-alpha.3` four-package recovery is complete. Exact
  pre-lock source commit `131b15d80b9dfc51b48092a13357348c242d4103` and both fixed
  builder results produced the fresh create-only schema-2 lock. It is 6218
  bytes, mode `100644`, with SHA-256
  `f5e3b8ceff284b908b6febb678501f63e07d50eff041b3c60532a8f6511dd675`
  and package-source projection
  `71269e5d7b25ada8f208893e57a3160766374a51bb23808b5df18893e60d9548`.
  Independent no-local/no-hardlink regeneration and direct Git-tree/tar
  recomputation reported 0 blocker, 0 high, and 0 medium with Taste=good. The
  exact lock at Git blob `eb875526ffefc81b4bbaa2c15ed4412b31a8d026` was merged
  unchanged as verified `S3=20f7f64faa8c8d688922896296c134b25bc58e7f`;
  `A3=7270ae7814583117050abac648ba96067e4fce67` is its sole-child exact-grant
  attestation. Annotated tag object `46c5360bd5daa48a1b493f1c9310b2358b3d6e6d`
  peels to `S3`. All tag/hosted, npm, GitHub-Release-last, Trusted Publisher,
  bootstrap-token retirement, and scoped environment-secret deletion
  transitions then completed with the boundaries below.

D-047/M3-008 branch protection remains independently deferred. Neither D-050
nor any M4 phase resumes it or makes it a release prerequisite.

## Fact ownership

| Fact | Owner |
| --- | --- |
| External-action authorization | D-050 in `docs/DECISIONS.md`; D-048/D-049 remain immutable historical authorities for `alpha.1`/`alpha.2` |
| Package graph, version, public manifests, registry, access, dist-tag, provenance setting, dependency order | `packaging/alpha-package-plan.json` |
| Exact tag, builders, locked inputs, recovery and completion rules | `packaging/alpha-release-plan.json` |
| Release phase order and eligibility | `docs/RELEASE_GATES.md` |
| Current support state | `policy/support-matrix.json` |
| User-facing delta and negative contract | `CHANGELOG.md`, `docs/KNOWN_LIMITATIONS.md`, and lifecycle-neutral `docs/releases/0.1.0-alpha.3.md`; the `alpha.2` note is immutable history |
| Exact `alpha.2` candidate/artifact identity | Immutable `packaging/releases/0.1.0-alpha.2.lock.json`, lock merge `S2=b884b39bdded17d7bc2ccedad159605523329bae`, attestation `A2=626560ec43e748ac8002352d9f849ee0d6e09b2f`, and annotated tag `v0.1.0-alpha.2 -> S2` |
| Exact `alpha.3` candidate/artifact identity | Immutable `packaging/releases/0.1.0-alpha.3.lock.json`, verified `S3=20f7f64faa8c8d688922896296c134b25bc58e7f`, sole-child `A3=7270ae7814583117050abac648ba96067e4fce67`, and annotated tag object `46c5360bd5daa48a1b493f1c9310b2358b3d6e6d` peeling to `S3`; no old lock or tag is reusable authority |
| Actual npm/GitHub lifecycle state | Official registry responses, fetched npm provenance/signatures, exact GitHub tag and Release records |

The package plan owns publication settings and dependency edges exactly once.
The publisher derives `core -> native-card-arrow -> public-synthetic -> CLI`
from that graph. The release plan references those settings and owns exact
candidate/recovery rules. Release Gates owns phase order. A release lock is an
identity boundary, not another package plan or support authority.

## `alpha.3` candidate admission

D-050 authorizes exact package version `0.1.0-alpha.3`, annotated tag
`v0.1.0-alpha.3` with message `pptx-compiler 0.1.0-alpha.3`, public access,
dist-tag `alpha`, GitHub Actions npm provenance, and a matching non-draft
GitHub prerelease created last. Authorization is not execution evidence.

Candidate admission must prove that the tag peels to the exact reviewed
GitHub-verified lock-containing commit `S3`, while current remote `main=A3` is
exactly its one-commit public-identity attestation. `A3` must have `S3` as its
sole parent, its tip-owned policy must exact-grant `S3`, and GitHub comparison
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

Registry publication, packument visibility, tarball visibility, and
attestation visibility are not one atomic read. A newly published package may
therefore receive a bounded retry only while the observed state is the exact
expected absence or incomplete propagation state. Each retry rereads the
official endpoint; completion still requires the same exact tarball,
certificate identity, issuer, subject, source/tag/workflow/invocation relation,
and complete dist-tag map. A malformed response, wrong identity, invalid
signature, unexpected tag, or deadline remains a hard stop. The observed
roughly 59-second `alpha.2` gap is evidence for a bounded policy, not a fixed
sleep or universal service promise.

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

The fresh create-only `packaging/releases/0.1.0-alpha.3.lock.json` must bind:

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
changelog, known limitations, and state-neutral `alpha.3` release note.
Generation establishes a candidate identity, not review or admission. The
lock must pass independent recomputation, enter exact provenance, be tracked,
and be merged unchanged before the tag exists. The immutable `alpha.2` lock,
its builders, and its published core envelope are audit inputs only; they
cannot supply or authorize any `alpha.3` byte.

Historical create-only checkpoint: exact source commit
`131b15d80b9dfc51b48092a13357348c242d4103` produced the 6218-byte lock at
mode `100644`, SHA-256
`f5e3b8ceff284b908b6febb678501f63e07d50eff041b3c60532a8f6511dd675`,
and package-source projection
`71269e5d7b25ada8f208893e57a3160766374a51bb23808b5df18893e60d9548`.
Its six locked inputs, 89 unique mapped sources, 92 source mappings, 96 final
package members, and lock bytes are frozen. Independent regeneration and direct
Git-tree/tar recomputation report 0 blocker, 0 high, and 0 medium with
Taste=good and admit only exact blob
`eb875526ffefc81b4bbaa2c15ed4412b31a8d026` for tracking. That historical
admission was not itself `S3`, `A3`, tag, hosted, or publication evidence; the
later exact transitions recorded in Current status supplied those facts.

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

The user confirmed on 2026-08-13 that the npm account email was verified, 2FA
was enabled, and GitHub environment `npm-release` contained the one-time
`NPM_TOKEN`. That historical bootstrap fact was not a token-value check or
publication result. After release completion, the authorized local procedure
revoked the uniquely identified token and fresh-proved it absent, then deleted
and fresh-proved absent this exact environment secret. No token ID or secret
value is recorded.

## Publication and recovery state machine

Publication order is derived from the package graph:

```text
pptx-compiler-core
  -> pptx-compiler-native-card-arrow
  -> pptx-compiler-public-synthetic
  -> pptx-compiler
```

Before each exact `0.1.0-alpha.3` step, query the official registry:

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
lock bytes, valid certificate-bound npm provenance/signatures, and the complete
package-level tag maps. `pptx-compiler-core` must retain frozen
`latest -> 0.1.0-alpha.2` while its publish operation assigns
`alpha -> 0.1.0-alpha.3`. The other three newly created identities must each
have both registry-seeded `latest` and requested `alpha` at
`0.1.0-alpha.3`. Only the exact `npm publish --tag alpha` operations may cause
those expected assignments; no separate `npm dist-tag add/rm` repair is
authorized. Only that complete state permits the GitHub prerelease to be
created. The declaration lane repeats
source and registry verification, creates an absent exact non-draft prerelease
or accepts an exact-equal retry, and never patches or deletes a mismatch.

GitHub Release creation is the last publication mutation. After the GitHub
Release succeeds, the existing `alpha-release.yml` workflow stops; it does not
automatically modify npm or GitHub settings. The remaining credential
transition is an external, local, interactive npm 11.17.0/operator procedure,
not another release-workflow job.

Process `pptx-compiler-core`, `pptx-compiler-native-card-arrow`,
`pptx-compiler-public-synthetic`, and `pptx-compiler` separately. For each
exact package, start with a fresh `npm trust list <exact-package> --json`. An
empty list permits one `npm trust github` create. Exactly one normalized exact
binding permits an idempotent rerun to continue without a write. A mismatch or
any other cardinality is a hard stop. After a create, discard its response as
completion evidence and perform another fresh list readback.

Normalize raw npm readback fields exactly: `type: "github"` maps to provider
`github-actions`; `repository: "why7682/pptx-compiler"` decomposes to owner
`why7682` and repository `pptx-compiler`; `file: "alpha-release.yml"` is the
workflow filename; `environment: "npm-release"` is exact; and the sole
`permissions: ["createPackage"]` maps to allowed action npm publish.
`createStagedPackage`, another permission, another field value, or a second
binding is a hard stop.

Only after all four packages have fresh exact readbacks, obtain a fresh
`npm token list --json`. The operator must uniquely identify the bootstrap
token's full ID; ambiguity is a hard stop. Revoke only that full ID, then
require a fresh token list in which it is absent. Only then delete the GitHub
Actions environment secret `NPM_TOKEN` from repository
`why7682/pptx-compiler`, environment `npm-release`, and require a fresh
environment-secret list in which that exact name is absent. Record only these
non-secret facts, never a token or secret value. npm does not validate a
Trusted Publisher binding when it is saved: configured/visible state is not
execution proof. A future exact tokenless OIDC publication is the first proof
that the binding works.

The observed completion followed this state machine. Release run
`31751437354` attempt 1 published only exact core `alpha.3` before bounded
registry stabilization exhausted; attempt 2 stopped at its GitHub-repository
precondition before another npm write. No rollback or blind publish followed.
After a no-write cooldown and two time-separated official-state samples, fresh
run `31756489430` completed the remaining suffix, all four exact rereads, and
the GitHub declaration job. The official fixed envelopes are:

| Package | Bytes | SHA-256 | Complete tag map |
| --- | ---: | --- | --- |
| `pptx-compiler-core@0.1.0-alpha.3` | 118555 | `60c9466bff289b72e88752bd21658f170c33d04740aac3e7cbfe1a823784905d` | `alpha -> 0.1.0-alpha.3`; `latest -> 0.1.0-alpha.2` |
| `pptx-compiler-native-card-arrow@0.1.0-alpha.3` | 11012 | `d66da46daf4369a51b252f971205465393ffd827a1908669d9a44dba2bfaeb63` | `alpha/latest -> 0.1.0-alpha.3` |
| `pptx-compiler-public-synthetic@0.1.0-alpha.3` | 21242 | `17cc4300f012e1a93b745c7e91f6ec1a05dc3232566166f9253054d447f5358a` | `alpha/latest -> 0.1.0-alpha.3` |
| `pptx-compiler@0.1.0-alpha.3` | 13829 | `a3713bd6d88628148271b9122efbf7dce7d41d1a1120220fb094f6488cc30cb8` | `alpha/latest -> 0.1.0-alpha.3` |

Every tarball, npm signature, and certificate-bound provenance passed before
non-draft prerelease `v0.1.0-alpha.3` was created last as GitHub Release
`370278133`, target `S3`, with no assets. The separate local npm 11.17.0
procedure then fresh-read exactly one normalized binding for each package with
provider `github-actions`, owner `why7682`, repository `pptx-compiler`, workflow
`alpha-release.yml`, environment `npm-release`, and allowed action npm publish
only. It rejected `createStagedPackage`, retired the bootstrap token only after
all four reads, and deleted the scoped GitHub secret only after token absence.
This establishes configured/visible state, not tokenless OIDC execution proof.

## Immutable `alpha.2` partial-publication evidence

Annotated tag `v0.1.0-alpha.2` has immutable tag object
`e7f6f17b7ba2db6ef723d309ed35ea7dd1ccef1d` and peels to
`S2=b884b39bdded17d7bc2ccedad159605523329bae`. Remote `main` remains its
sole-child exact-grant attestation
`A2=626560ec43e748ac8002352d9f849ee0d6e09b2f`. Tag Public CI run
`31665054553` passed all six cells; Security run `31665054531` passed CodeQL.

Manual Alpha npm Release run `31665307969`, attempt 2, published only
`pptx-compiler-core@0.1.0-alpha.2`. Its official tarball is the exact fixed
Node 24/npm 11 envelope from the immutable lock: 118,488 bytes, SHA-256
`ed0cc4a2f66049ed9bd6823544913161377a229e290b70bb5527857520930268`,
SHA-512
`3aff97b21b51cbb639388b36d907b1e776ac8456bd5c3643350ae64c9eacafeddf6f928f668e4ddf4c7fa5bda8d51b3a0eb3238c6774e13b7b6ef0bdc1e7d1b6`,
and canonical tar SHA-256
`57216ed09b0bca7da6396d04ecbe784904599bd1a9df352f4d5f4f069c3add63`.
The packument records publish time `2026-08-13T19:43:34.408Z` and both
`alpha` and registry-required `latest` at `0.1.0-alpha.2`.

A later independent read—not the failed workflow—matched the SLSA subject,
source commit `S2`, tag, exact `.github/workflows/alpha-release.yml`, GitHub
Actions issuer, and attempt-2 invocation. The fixed npm 11.17.0 bundled
Sigstore 4.1.1 verifier passed, and isolated `npm audit signatures
--include-attestations` exited zero with no invalid or missing entry. The
registry also exposes the separate npm publish attestation. The other three
`alpha.2` versions and the GitHub Release remain absent.

The original workflow stopped around `19:43:35Z` during its immediate
attestation check. A later endpoint response carried
`Last-Modified: 19:44:33 GMT`, about 59 seconds after publish metadata. That is
an observed propagation interval, not an npm SLA or exact first-visible time;
the suppressed child error does not reveal whether the first read was absent,
empty, or cryptographically incomplete.

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
Those immutable facts cannot authorize an `alpha.3` byte, tag, package,
provenance result, or Release.

## Current public evidence

M3-004B remains the implementation baseline on accepted PR head
`f6ba6bad48c928d31c356d47911dd929ccf3b2d1` and accepted main
`c4dee58a8920a8e71c20f53ab93c62a96d3cb89d`. The later constructive-document
PR #2 head `093d527fc3fadf7cae577139b8d400719755dd52` passed Public CI/Security runs
`31608992503`/`31608992491`; accepted main
`8cdf968b72f8dd5f41fee37a68e239e477dec44b` passed runs
`31609285181`/`31609285220`. Those object-bound records establish source and
reader baselines, not `alpha.3` release evidence. The exact later release
evidence is A3 Public CI/Security `31750359756`/`31750359778`, tag Public
CI/Security `31750881903`/`31750881914`, release run `31756489430`, and GitHub
Release `370278133`, all bound to `S3` or its sole-child `A3` as appropriate.

Support remains 0 supported / 22 experimental / 3 manual / 35 unsupported,
with `supportClaimsEnabled=false`. QA remains blocked and no `BuildArtifact`
exists. D-050 and the registry-model correction do not change those facts.

## Next exact action

M4-001D is complete. No additional `alpha.3` workflow dispatch, npm publish,
dist-tag mutation, Git tag/Release mutation, Trusted Publisher write, token
mutation, or secret mutation is authorized. Preserve the complete exact
evidence above and retain configured/visible versus tokenless OIDC proof as a
hard boundary.

The next product task is M4-002's bounded compatibility evidence. Record only
redacted feature-level observations, keep the public synthetic fixture
sufficient for CI, and do not promote support or infer arbitrary-template
compatibility.

Do not add lifecycle claims to the lock-bound changelog, limitations, or
`alpha.3` note. Do not edit the immutable `alpha.2` note or resume branch
protection by implication.
