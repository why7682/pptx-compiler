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
| Exact candidate and artifact identity | `alpha.2` is bound by its immutable lock, `S2`, `A2`, and annotated tag; `alpha.3` requires a fresh create-only lock, reviewed `S3`, `A3`, and tag before publication |

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
| G0 — Identity, rights, provenance | Satisfied through immutable `alpha.2`; pending for `alpha.3` | Public identity, MIT rights, exact provenance, leakage policy, and the `S2 -> A2`/tag relation are recorded; `alpha.3` needs its own exact lock/source/attestation/tag admission. |
| G1 — Public reproducibility | Satisfied for the accepted M3-004B implementation baseline | Canonical workflow passed Linux/macOS/Windows × Node 22/24 on accepted main; the release tag must rerun under G6. |
| G2 — Input security | Satisfied for the fixed public-synthetic profile | Bounded filesystem, ZIP, XML, OPC, relationship, and high-risk rejections pass; arbitrary templates remain outside scope. |
| G3 — Capability correctness | Satisfied for the exact candidate path | One opt-in native-card candidate replays readable layout facts, proves exact diff/source isolation, and produces blocked QA with no BuildArtifact. |
| G4 — Package boundary | Satisfied for the guarded package contract | Four allowlisted public-alpha candidate tarballs install together offline and execute the installed candidate flow; fresh `alpha.3` release bytes and publication equality remain G6. |
| G5 — Project security and maintenance | **Satisfied** | Least-privilege workflows, CodeQL, Dependency Review, private vulnerability reporting, SBOM, and public process documents are present and evidenced. Branch protection is outside this closure and remains deferred. |
| G6 — Release evidence | **In progress under D-050** | `alpha.1` is retired unpublished. `alpha.2` passed tag gates but release attempt 2 published only exact core before stopping; the remaining versions and GitHub Release are absent. `alpha.3` must use a fresh lock/tag chain, accept exact seed-`latest` postconditions, and verify eventual provenance before GitHub-Release-last completion. |

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
closes the current hosted reproducibility prerequisite. The exact release tag
must run again under G6.

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

G6 is in progress under D-050. Authorization permits the exact forward-only
`alpha.3` transition but cannot skip any machine-observable phase.

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

### M4-001D — fresh `alpha.3` candidate and publication (in progress)

The replacement proceeds in this order:

1. admit a contract that separates package identity, immutable version,
   complete dist-tag maps, and eventual attestation visibility;
2. project all four manifests and locked reader inputs to exact
   `0.1.0-alpha.3`, including the lifecycle-neutral release note;
3. build and smoke under Node 22.23.2/npm 10.9.8 and Node 24.19.0/npm 11.17.0,
   require equal canonical tar payloads, and create/review the fresh lock;
4. merge the unchanged lock as verified `S3`, append sole-child exact-grant
   `A3`, pass reachable-history admission, create the annotated tag on `S3`,
   and pass tag Public CI and Security;
5. publish exact lock bytes in graph order, accepting only absent or exact-
   equal versions and never unpublishing or reusing a version;
6. for each new write, bounded-retry only the exact expected propagation state,
   then require official tarball equality and certificate-bound provenance;
7. require core `latest -> 0.1.0-alpha.2` and
   `alpha -> 0.1.0-alpha.3`, while each newly created package identity has both
   registry-seeded `latest` and requested `alpha` at `0.1.0-alpha.3`; and
8. create or exactly reuse the matching non-draft GitHub prerelease last.

Only the exact `npm publish --tag alpha` operations may assign `alpha` and
trigger npm's first-identity `latest` seed. No separate dist-tag repair is
authorized. Wrong identity, bytes, source, provenance, tag map, response shape,
or retry deadline is a hard stop.

After the GitHub Release succeeds, the existing `alpha-release.yml` workflow
stops and does not automatically modify npm or GitHub settings. A separate
local interactive npm 11.17.0 operator begins each exact package with a fresh
`npm trust list <exact-package> --json`. Empty permits one create followed by a
fresh reread; exactly one normalized exact binding permits an idempotent rerun;
a mismatch or any other cardinality is a hard stop. Raw `type: "github"` maps
to provider `github-actions`, `file: "alpha-release.yml"` is the workflow
filename, and sole `permissions: ["createPackage"]` maps to allowed action
**npm publish only**. Reject `createStagedPackage`. Owner `why7682`, repository
`pptx-compiler`, and environment `npm-release` must also match exactly.

Only after all four fresh binding readbacks match may a fresh
`npm token list --json` supply the bootstrap token's full ID. The operator must
uniquely confirm that ID or hard-stop on ambiguity, revoke only it, and require
a fresh token-list readback in which it is absent. Only then delete the GitHub
Actions environment secret `NPM_TOKEN` from repository
`why7682/pptx-compiler`, environment `npm-release`, and require a fresh
environment-secret list in which that exact name is absent. Record no secret
value. npm does not validate a binding when it is saved, so configured/visible
state is not execution proof; a future exact tokenless OIDC publication is the
first proof that the binding works.

The lock-bound changelog, limitations, and `alpha.3` note remain lifecycle-
neutral. The `alpha.2` note and all old refs/versions remain immutable.

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
[`docs/M3-004_HANDOFF.md`](M3-004_HANDOFF.md). These results satisfy G5 and the
hosted portion of G1/G4 for the current source baseline. They do not satisfy G6
for the new `alpha.3` tag.

Constructive-document PR #2 head
`093d527fc3fadf7cae577139b8d400719755dd52` passed Public CI run
`31608992503` and Security run `31608992491`; accepted main
`8cdf968b72f8dd5f41fee37a68e239e477dec44b` passed Public CI run
`31609285181` and Security run `31609285220`. Both commits share tree
`1d6d148a8bc347dc3cbc13dde3fd4314d86c421a`. This is the accepted reader-
document baseline entering M4, not release-tag or registry evidence.

## Limitations and next authorized action

[`docs/KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) is the user-facing negative
contract. The release-critical facts are: zero supported rows, blocked QA, no
BuildArtifact, no arbitrary-template flow, one preserved partial `alpha.2`
package graph, and no `0.1.0-alpha.3` release evidence. Bare unversioned npm
installation is intentionally inconsistent across package identities until a
later stable release can own a coherent `latest`; consumers of this prerelease
must select the exact version or `@alpha`.

The next action is read-only admission of the corrected registry model,
followed by the fresh `alpha.3` projection, fixed-builder lock, `S3 -> A3`, tag,
and hosted gates. Only then may the ordered registry state machine write. If
any byte or claim changes, rerun the affected gate rather than citing an older
result. Branch protection remains separately deferred by D-047 and is not
folded into G6.
