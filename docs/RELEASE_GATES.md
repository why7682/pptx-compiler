# Release Gates

## Purpose and boundary

These gates answer one question: may the exact reviewed source and package set
be presented as a release? They do not decide product support, and a passing
test, plausible slide, public branch, or candidate PPTX is never sufficient by
itself.

All gates fail closed. The first release target is a **candidate alpha**. It may
produce a candidate PPTX and `CandidateBuildRecord`, followed by a schema-valid
`QaReport` whose decision is `blocked` when required delivery evidence is
unavailable. It must not create a `BuildArtifact` for that result. A delivery
alpha is a different, later boundary.

## Fact ownership

| Fact | Owner |
| --- | --- |
| Identity, rights, and source provenance | `docs/DECISIONS.md`, `LICENSE`, provenance ledger |
| Current support state | `policy/support-matrix.json` |
| Package graph, intended tarball contents, public channel, and derived dependency order | `packaging/alpha-package-plan.json` |
| Workflow commands and permissions | `.github/workflows/ci.yml` and `security.yml` |
| Hosted execution evidence | `docs/M3-004_HANDOFF.md` |
| Reproduction procedure | `docs/REPRODUCIBILITY.md` |
| User-visible limitations | `docs/KNOWN_LIMITATIONS.md` |
| Release delta and state-neutral release-facing projection | `CHANGELOG.md` and `docs/releases/0.1.0-alpha.3.md`; the `alpha.2` note is immutable history |
| Exact tag, builders, locked inputs, recovery, and completion rules | D-050 and `packaging/alpha-release-plan.json`; D-048/D-049 remain old-version history |
| Release phase order and eligibility | This document |
| Exact candidate and artifact identity | `alpha.2` is bound by its immutable lock, `S2`, `A2`, and annotated tag; `alpha.3` is bound by its immutable lock, verified `S3=20f7f64faa8c8d688922896296c134b25bc58e7f`, sole-child `A3=7270ae7814583117050abac648ba96067e4fce67`, and annotated tag object `46c5360bd5daa48a1b493f1c9310b2358b3d6e6d` peeling to `S3` |

The support matrix may block a release, but a release cannot promote the
matrix. The package plan owns intended files, while the final reviewed tarball
bytes own what would actually be published. A tag and digest are identity
bindings, not substitutes for either readable authority.

## Release data and control flow

```text
reviewed source identity and rights
  -> public reproducibility and input-security gates
  -> exact experimental capability closure
  -> guarded four-package tarballs and clean install
  -> hosted CI/security evidence
  -> dual-builder tar-payload equality and fixed-builder release envelopes
  -> create-only tracked release lock
  -> reviewed alpha.3 lock merge as GitHub-verified commit S3
  -> single-parent local attestation A3 with sole parent S3 and exact grant for S3
  -> complete reachable-history gate at current main=A3
  -> exact annotated v0.1.0-alpha.3 admission on unchanged S3
  -> tag-triggered Public CI and Security evidence
  -> ordered npm publication and official-registry equality
  -> GitHub Release created last
  -> external local interactive npm 11.17.0 Trusted Publisher closure
  -> four fresh exact npm trust list readbacks
  -> uniquely identified full bootstrap-token ID revoked and fresh-proved absent
  -> exact npm-release environment secret NPM_TOKEN deleted and fresh-proved absent
```

Failure at any step stops the chain. No later result repairs a missing earlier
authority. In particular, hosted CI cannot cure incomplete provenance, and a
registry digest cannot turn different bytes into the reviewed tarball.

## Current readiness

| Gate | Candidate-alpha state | Decisive boundary |
| --- | --- | --- |
| G0 — Identity, rights, provenance | **Satisfied for `alpha.3`** | Public identity, MIT rights, exact provenance and leakage policy are recorded; immutable lock, verified `S3`, sole-child `A3`, and annotated tag object/peel all match exactly. |
| G1 — Public reproducibility | **Satisfied for the exact release tag** | Canonical workflow passed Linux/macOS/Windows × Node 22/24 on accepted main and again in tag Public CI `31750881903`; tag Security `31750881914` passed CodeQL. |
| G2 — Input security | Satisfied for the fixed public-synthetic profile | Bounded filesystem, ZIP, XML, OPC, relationship, and high-risk rejections pass; arbitrary templates remain outside scope. |
| G3 — Capability correctness | Satisfied for the exact candidate path | One opt-in native-card candidate replays readable layout facts, proves exact diff/source isolation, and produces blocked QA with no BuildArtifact. |
| G4 — Package boundary | **Satisfied for the exact `alpha.3` package graph** | Four allowlisted tarballs install together offline, execute the installed candidate flow, and exact-match all four official-registry Node 24/npm 11 envelopes. |
| G5 — Project security and maintenance | **Satisfied** | Least-privilege workflows, CodeQL, Dependency Review, private vulnerability reporting, SBOM, and public process documents are present and evidenced. Branch protection is outside this closure and remains deferred. |
| G6 — Release evidence | **Satisfied under D-050** | `alpha.1` remains retired unpublished and `alpha.2` remains a one-package partial prefix. Exact `alpha.3` lock/tag/hosted gates, four official tarballs, certificate-bound provenance/signatures, complete tag maps, GitHub Release `370278133` created last, four Trusted Publisher readbacks, and bootstrap-token/environment-secret retirement are complete. Configured/visible Trusted Publisher state is not tokenless OIDC execution proof. |

This table is scope-sensitive. “Satisfied” for G2 or G3 refers only to the
fixed repository-owned candidate profile. It is not arbitrary-template,
delivery, PowerPoint, formula, or npm-publication evidence.

## G0 — Identity, rights, and provenance

The release source must satisfy all of these:

- one active `pptx-compiler` identity graph covers the CLI, four package names,
  imports, contract namespace, and `why7682/pptx-compiler` repository;
- the MIT license and copyright decision cover every repository-authored file;
- every admitted source, schema, fixture, example, dependency, and document has
  an exact compatible provenance record;
- private material, absolute local paths, credentials, PII, predecessor
  artifacts, and unsupported binary classes are rejected mechanically;
- the approved public Git identity owns every reachable author/committer fact;
- a GitHub merge identity or OpenPGP-shaped header is never accepted by shape
  alone: the tip-owned policy must grant the exact previously verified merge
  object OID, the closed merge grammar and all tree/message rules must pass,
  and a later local public-identity attestation must make a new grant reachable;
- a release ref cannot introduce an unscanned history, replacement object,
  shallow boundary, or unreviewed identity drift.

The first public source ref passed the complete reachable-history scan and was
transported by exact object ID. Later accepted GitHub merge objects are admitted
only through those exact grants, never through a broad GitHub identity rule. A
release tag must still point to its own reviewed source object. For `alpha.3`,
call that object `S3`: current remote `main` must be exactly the one-commit
attestation `A3`, `A3` must have `S3` as its sole parent and exact-grant `S3`,
and the comparison must report `ahead_by=1` and `behind_by=0`. Equality, a
deeper descendant, or another
parent fails closed; the first-ref result is not release-tag evidence.

## G1 — Public reproducibility

The clean public workflow must use only declared public dependencies and
repository-owned synthetic inputs. It must not require a private presentation,
local font, model, PowerPoint, Pandoc, signing material, publication credential,
or managed helper.

The canonical six-cell matrix is:

```text
ubuntu-24.04  × Node 22, 24
windows-2025  × Node 22, 24
macos-15      × Node 22, 24
```

Accepted-main Public CI run `31600806512` passed all six cells for object
`c4dee58`, after pull-request run `31600528716` passed the same matrix. This
closes the historical hosted reproducibility prerequisite. The exact
`alpha.3` tag later reran the same matrix successfully in Public CI
`31750881903`; tag Security `31750881914` passed CodeQL.

## G2 — Input security

The admitted input boundary must reject before extraction or mutation:

- traversal, symlink/reparse escape, duplicate and case-conflicting members;
- archive/member/expanded-size, compression-ratio, nesting, and XML resource
  violations;
- external entities and relationships;
- macros, ActiveX, OLE, embedded packages/objects, and unknown high-risk parts;
- malformed, ambiguous, or unsupported OPC/PresentationML structures.

The current non-relaxable profile is 1 MiB per archive, 32 members, 256 KiB per
member, 1 MiB expanded total, 100:1 compression ratio, XML depth 64, and 50,000
elements. These limits satisfy the public-synthetic candidate profile only.

## G3 — Capability correctness

The shipped matrix must pass its schema and overclaim gate. Every executable
capability in the release path must bind exact metadata, executor, input/output
schemas, conformance fixtures, QA assertions, deterministic output, and
negative tests.

The candidate path must also prove:

- complete registry/overlay/index/deck resolution before execution;
- explicit opt-in for every experimental dependency;
- source-template immutability and create-only output publication;
- exact content-type, relationship, geometry, capacity, and collateral diff;
- separate durable `SlideLayoutIR` intent and `ComposedSlidePlan` geometry;
- generation and QA re-derivation of the same complete readable plan;
- record-first/PPTX-marker-last candidate publication and exact replay;
- a blocked `QaReport` and no `BuildArtifact` when delivery evidence is absent.

Structural success cannot be upgraded by a screenshot or by the component that
created the candidate. Final delivery would require independent exact-candidate
mechanical, render, pixel, and required compatibility receipts.

## G4 — Package boundary

The candidate package graph is exactly four packages: CLI, core,
native-card-arrow, and public-synthetic. Each has an explicit files allowlist,
exports, declarations, license, engines, repository metadata, and only the
declared internal dependency edges.

Every tarball must:

- be at most 5 MiB compressed and 20 MiB unpacked;
- contain at most 300 files, each at most 1 MiB;
- match the positive plan exactly, including executable modes;
- contain no presentation, PDF, font, archive, worktree, test/lab/private
  evidence, source map with private paths, secret, PII, or undeclared loader;
- install with the other three tarballs in an empty directory without network,
  lifecycle scripts, or ambient npm configuration;
- run installed `init -> inspect -> validate project -> render -> qa`, observe
  blocked QA, and create no `BuildArtifact`.

The ignored fixed package stage is recoverable but not authoritative merely by
directory name. Only exact typed transient inventories and marker-authenticated
review members may be removed. Unknown nonempty entries fail closed and are
preserved. The retained tarballs are local evidence, not publication.

The M3 private-manifest evidence remains historical package-boundary evidence;
it is not publishable and cannot be relabeled as a release artifact. D-050
authorizes a fresh package-plan projection for `0.1.0-alpha.3`, but only that
candidate's fresh dual-builder lock may identify its publication bytes.

## G5 — Project security and maintenance

G5 is satisfied for the current public repository:

- exactly two ordinary least-privilege verification workflows use fixed hosted
  runners and full-SHA action pins; M4-001 adds one separately admitted manual
  alpha-release workflow whose release credentials and OIDC permission cannot
  be reached from ordinary CI or Security;
- untrusted pull-request code has no private fixtures, desktop runtime, secrets,
  signing keys, provenance identity, or publication credentials;
- Dependency Review passed in
  [PR Security run 31600528742](https://github.com/why7682/pptx-compiler/actions/runs/31600528742);
- CodeQL passed in
  [accepted-main Security run 31600806350](https://github.com/why7682/pptx-compiler/actions/runs/31600806350);
- the static-ESM CycloneDX SBOM is a deterministic projection of the four
  package plan and its parsed static imports;
- private vulnerability reporting is enabled and `SECURITY.md` is the sole
  reporting process owner;
- contribution, governance, reproduction, support, and compatibility policies
  have one public owner each.

Branch protection is deliberately deferred by D-047 and is not claimed here.
That deferred repository setting does not erase the passing G5 evidence and
must not be described as already configured.

## G6 — Release evidence

G6 is satisfied under D-050 for the exact `alpha.3` candidate. Authorization
did not substitute for execution; every machine-observable phase below has its
own exact evidence.

### M4-001A — contract admission (complete)

M4-001A admitted package-plan schema 3 as its historical contract. D-050's
current package-plan schema 4 remains the only authority for official registry,
public access, dist-tag `alpha`, npm provenance, and graph-derived publication order.
Release-plan schema 3 owns the exact tag, locked inputs, builders, recovery,
registry checks, and closed GitHub prerelease declaration. The contract and its
negative states were admitted before any external publication mutation.

The provenance-environment contract now recognizes the GitHub Actions service
boundary rather than one observed runner hostname. It accepts HTTPS with
exactly one validated DNS label beneath `actions.githubusercontent.com`, a
nonempty path, and no user info, explicit port, fragment, nested label, suffix
confusion, non-ASCII raw URL text, or non-GitHub authority. This admission is
only a precondition; the fetched v0.3 provenance bundle must still pass fixed
npm 11.17.0 Sigstore verification against the exact workflow/tag certificate
identity and GitHub Actions issuer.

### Immutable `alpha.1` checkpoint (complete and retired)

The first candidate's GitHub-verified lock merge is
`S1=ad4ab94959e9f7cff56834c81be4ddecd11e7332`; its sole-child public-identity
attestation is `A1=7d8341ebc01f8769a73020103d18c93b4049468f`. Annotated tag
`v0.1.0-alpha.1` remains on `S1`. Tag Public CI run
[`31652084833`](https://github.com/why7682/pptx-compiler/actions/runs/31652084833)
and Security run
[`31652084727`](https://github.com/why7682/pptx-compiler/actions/runs/31652084727)
passed.

Manual release run
[`31652404999`](https://github.com/why7682/pptx-compiler/actions/runs/31652404999)
passed source, history, complete tests, guarded package build, exact tag, and
remote-main admission, then failed closed in the first publish step on the
overly narrow OIDC-host precondition. It stopped before the first npm write;
the declaration job was skipped, all four exact `0.1.0-alpha.1` versions and
the GitHub Release remained absent, and no rollback or unpublish occurred.
That version is retired unpublished. Its tag, lock, note, source/attestation
objects, and hosted records are immutable evidence, never `alpha.2` or
`alpha.3` authority.

### Immutable `alpha.2` checkpoint (candidate complete, publication partial)

The exact dual-builder lock is immutable with SHA-256
`922a862092d3785ccca17ba4f6740afb95bb038ae718aaed80a105d086200a31`.
GitHub-verified `S2=b884b39bdded17d7bc2ccedad159605523329bae`, sole-child exact-grant
`A2=626560ec43e748ac8002352d9f849ee0d6e09b2f`, and annotated tag object
`e7f6f17b7ba2db6ef723d309ed35ea7dd1ccef1d` passed the exact relation and
hosted tag gates.

Release run `31665307969`, attempt 2, published only
`pptx-compiler-core@0.1.0-alpha.2`. The official 118,488-byte tarball has
SHA-256
`ed0cc4a2f66049ed9bd6823544913161377a229e290b70bb5527857520930268`,
exactly the fixed Node 24/npm 11 lock envelope. A later independent read matched
and cryptographically verified its keyless SLSA provenance against `S2`, the
tag, workflow, issuer, and attempt-2 invocation; isolated npm signature audit
also passed. That later evidence did not make the original workflow successful.

The packument records publication at `2026-08-13T19:43:34.408Z` and both
`alpha` and `latest` at `0.1.0-alpha.2`. The workflow stopped around
`19:43:35Z`; a later attestation response was last-modified at `19:44:33Z`.
That approximate 59-second interval proves only that bounded propagation must
be modeled, not a fixed npm SLA or exact first-visible instant. The other three
versions and GitHub Release remain absent. No unpublish, old-tag movement,
separate `npm dist-tag add/rm`, or declaration occurred.

### M4-001D — fresh `alpha.3` candidate and publication (complete)

Create-only generation from exact pre-lock commit
`131b15d80b9dfc51b48092a13357348c242d4103` produced the schema-2 lock at
6218 bytes, mode `100644`, SHA-256
`f5e3b8ceff284b908b6febb678501f63e07d50eff041b3c60532a8f6511dd675`,
package-source projection
`71269e5d7b25ada8f208893e57a3160766374a51bb23808b5df18893e60d9548`,
and Git blob `eb875526ffefc81b4bbaa2c15ed4412b31a8d026`. Independent regeneration
and direct Git-tree/tar recomputation reported 0 blocker, 0 high, and 0 medium.

GitHub merged that exact lock unchanged as verified
`S3=20f7f64faa8c8d688922896296c134b25bc58e7f`. Sole-child exact-grant
`A3=7270ae7814583117050abac648ba96067e4fce67` passed current-main history
admission. Annotated tag object `46c5360bd5daa48a1b493f1c9310b2358b3d6e6d`
peels to unchanged `S3`. A3 Public CI/Security runs
`31750359756`/`31750359778` and tag Public CI/Security runs
`31750881903`/`31750881914` all passed.

Release run `31751437354` demonstrates fail-closed recovery rather than
success. Attempt 1 published only exact core `alpha.3` before bounded registry
stabilization exhausted. Attempt 2 stopped at the GitHub-repository precondition
before another npm write. No rollback, unpublish, dist-tag repair, or blind
publish followed. After a no-write cooldown and two time-separated exact
official-state samples, fresh release run `31756489430` completed all three
jobs and the remaining dependency-order suffix.

The final official registry state exact-matches the fixed Node 24/npm 11 lock
envelopes:

| Package | Bytes | SHA-256 | Complete tag map |
| --- | ---: | --- | --- |
| `pptx-compiler-core@0.1.0-alpha.3` | 118555 | `60c9466bff289b72e88752bd21658f170c33d04740aac3e7cbfe1a823784905d` | `alpha -> 0.1.0-alpha.3`; `latest -> 0.1.0-alpha.2` |
| `pptx-compiler-native-card-arrow@0.1.0-alpha.3` | 11012 | `d66da46daf4369a51b252f971205465393ffd827a1908669d9a44dba2bfaeb63` | `alpha/latest -> 0.1.0-alpha.3` |
| `pptx-compiler-public-synthetic@0.1.0-alpha.3` | 21242 | `17cc4300f012e1a93b745c7e91f6ec1a05dc3232566166f9253054d447f5358a` | `alpha/latest -> 0.1.0-alpha.3` |
| `pptx-compiler@0.1.0-alpha.3` | 13829 | `a3713bd6d88628148271b9122efbf7dce7d41d1a1120220fb094f6488cc30cb8` | `alpha/latest -> 0.1.0-alpha.3` |

Every tarball, npm signature, and certificate-bound provenance passed before
the declaration job created non-draft prerelease `v0.1.0-alpha.3` last as
GitHub Release `370278133`, target `S3`, with no assets.

After the release workflow stopped without changing npm or GitHub settings, a
separate local interactive npm 11.17.0 procedure fresh-read exactly one
normalized Trusted Publisher binding for each package. Every binding has raw
`type: "github"` projected to provider `github-actions`, owner `why7682`,
repository `pptx-compiler`, raw `file: "alpha-release.yml"` projected to that
workflow filename, environment `npm-release`, and sole
`permissions: ["createPackage"]` projected to allowed action npm publish only;
`createStagedPackage` is absent. Only after all four exact reads did the
operator uniquely revoke the bootstrap token by full ID and fresh-prove it
absent, then delete and fresh-prove absent the scoped GitHub Actions environment
secret `NPM_TOKEN`. No token ID or secret value is recorded. npm does not
validate a saved binding, so this is configured/visible state, not execution
proof; a future exact tokenless OIDC publication is the first proof the
bindings work.

The lock-bound changelog, limitations, and `alpha.3` note remain lifecycle-
neutral. The `alpha.1` and `alpha.2` notes, refs, locks, versions, and registry
writes remain immutable. D-047/M3-008 branch protection remains deferred.

## Canonical verification

The canonical workflow and
[`docs/REPRODUCIBILITY.md`](REPRODUCIBILITY.md) own the complete command order.
Its effective gate sequence is:

```sh
node scripts/check-public-workflows.mjs
node scripts/check-forbidden-materials.mjs --mode working-tree
node scripts/check-release-metadata.mjs
npm ci --ignore-scripts --no-audit --no-fund
node node_modules/typescript/bin/tsc --project tsconfig.public.json
node scripts/check-source-policy.mjs
node scripts/check-package-plan.mjs
node --test "tests/*.test.mjs"
node scripts/build-alpha-packages.mjs
node scripts/check-forbidden-materials.mjs --mode working-tree && node scripts/check-provenance.mjs --mode working-tree && node scripts/check-support-matrix.mjs --mode working-tree && node scripts/check-contracts.mjs --mode working-tree
git diff --exit-code
```

The workflows themselves remain machine authority. This copy exists so a
reader can understand the control flow; a document edit cannot silently replace
the workflow commands.

## Public evidence

- [PR Public CI 31600528716](https://github.com/why7682/pptx-compiler/actions/runs/31600528716):
  all six portable cells passed.
- [PR Security 31600528742](https://github.com/why7682/pptx-compiler/actions/runs/31600528742):
  Dependency Review passed.
- [accepted-main Public CI 31600806512](https://github.com/why7682/pptx-compiler/actions/runs/31600806512):
  all six portable cells passed for `c4dee58`.
- [accepted-main Security 31600806350](https://github.com/why7682/pptx-compiler/actions/runs/31600806350):
  CodeQL passed for `c4dee58`.

The detailed run/object/event boundary lives in
[`docs/M3-004_HANDOFF.md`](M3-004_HANDOFF.md). These historical results satisfy
G5 and the hosted portion of G1/G4 for that source baseline; they are not the
evidence used to satisfy the later `alpha.3` G6 boundary.

Constructive-document PR #2 head
`093d527fc3fadf7cae577139b8d400719755dd52` passed Public CI run
`31608992503` and Security run `31608992491`; accepted main
`8cdf968b72f8dd5f41fee37a68e239e477dec44b` passed Public CI run
`31609285181` and Security run `31609285220`. Both commits share tree
`1d6d148a8bc347dc3cbc13dde3fd4314d86c421a`. This is the accepted reader-
document baseline entering M4, not release-tag or registry evidence.

The completed `alpha.3` boundary is bound to reviewed source `S3`
`20f7f64faa8c8d688922896296c134b25bc58e7f`, accepted-main attestation `A3`
`7270ae7814583117050abac648ba96067e4fce67`, annotated tag object
`46c5360bd5daa48a1b493f1c9310b2358b3d6e6d`, tag Public CI run
`31750881903`, tag Security run `31750881914`, successful manual release run
`31756489430`, and exact non-draft prerelease ID `370278133`. The earlier
accepted-main Public CI/Security runs `31750359756` and `31750359778` passed on
`A3`. Failed release run `31751437354` is retained as fail-closed history: its
first attempt left only exact-equal core, its second attempt stopped before
another npm write, and a fresh run followed only after time-separated stable
registry-absence evidence.

Official-registry reread closed the four exact `0.1.0-alpha.3` package bytes,
their provenance/signatures, and their complete dist-tag maps. The external
local interactive closure then recorded four fresh exact Trusted Publisher
readbacks, revoked only the uniquely identified bootstrap token full ID and
fresh-proved it absent, and deleted only the `npm-release` environment secret
`NPM_TOKEN` and fresh-proved it absent. No token ID or value is recorded.
Configured/visible Trusted Publisher state is not execution proof; only a
future exact tokenless OIDC publication can prove that execution path.

## Limitations and next authorized action

[`docs/KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) is the user-facing negative
contract. The release-critical facts are: zero supported rows, blocked QA, no
BuildArtifact, no arbitrary-template flow, one preserved partial `alpha.2`
package graph, and one completed exact `alpha.3` prerelease graph. Bare
unversioned npm installation is intentionally inconsistent across package
identities until a later stable release can own a coherent `latest`; consumers
of this prerelease must select the exact version or `@alpha`.

`M4-001D` is complete and G6 is satisfied for the exact bindings above. No
further `alpha.3` publish, dist-tag mutation, tag movement, Release mutation,
or credential transition is authorized by this closure. The next product
evidence task is `M4-002`; it must preserve the false global support switch and
all 60 current row statuses. Branch protection remains separately deferred by
D-047/M3-008 and is not folded into G6. Configured/visible Trusted Publisher
state remains distinct from proof by a future exact tokenless OIDC
publication.
