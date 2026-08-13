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
| Release delta and state-neutral release-facing projection | `CHANGELOG.md` and `docs/releases/0.1.0-alpha.2.md` |
| Exact tag, builders, locked inputs, recovery, and completion rules | D-049 and `packaging/alpha-release-plan.json` |
| Release phase order and eligibility | This document |
| Exact candidate and artifact identity | Create-only `packaging/releases/0.1.0-alpha.2.lock.json` exists with SHA-256 `922a862092d3785ccca17ba4f6740afb95bb038ae718aaed80a105d086200a31`; independent exact recomputation and provenance admission passed, and this checkpoint admits it for tracking; reviewed merge `S2` remains pending |

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
  -> reviewed lock merge as GitHub-verified commit S2
  -> single-parent local attestation A2 with sole parent S2 and exact grant for S2
  -> complete reachable-history gate at current main=A2
  -> exact annotated v0.1.0-alpha.2 admission on unchanged S2
  -> tag-triggered Public CI and Security evidence
  -> ordered npm publication and official-registry equality
  -> GitHub Release created last
```

Failure at any step stops the chain. No later result repairs a missing earlier
authority. In particular, hosted CI cannot cure incomplete provenance, and a
registry digest cannot turn different bytes into the reviewed tarball.

## Current readiness

| Gate | Candidate-alpha state | Decisive boundary |
| --- | --- | --- |
| G0 — Identity, rights, provenance | Satisfied for the admitted source lineage | Public identity, MIT rights, exact provenance, leakage policy, and reachable-history scan are recorded; the new `alpha.2` source/attestation/tag relation still needs exact admission. |
| G1 — Public reproducibility | Satisfied for the accepted M3-004B implementation baseline | Canonical workflow passed Linux/macOS/Windows × Node 22/24 on accepted main; the release tag must rerun under G6. |
| G2 — Input security | Satisfied for the fixed public-synthetic profile | Bounded filesystem, ZIP, XML, OPC, relationship, and high-risk rejections pass; arbitrary templates remain outside scope. |
| G3 — Capability correctness | Satisfied for the exact candidate path | One opt-in native-card candidate replays readable layout facts, proves exact diff/source isolation, and produces blocked QA with no BuildArtifact. |
| G4 — Package boundary | Satisfied for the guarded package contract | Four allowlisted public-alpha candidate tarballs install together offline and execute the installed candidate flow; fresh `alpha.2` release bytes and publication equality remain G6. |
| G5 — Project security and maintenance | **Satisfied** | Least-privilege workflows, CodeQL, Dependency Review, private vulnerability reporting, SBOM, and public process documents are present and evidenced. Branch protection is outside this closure and remains deferred. |
| G6 — Release evidence | **In progress under D-049** | The immutable `alpha.1` tag gates completed, but its release run stopped before the first npm publish and that candidate is retired unpublished. The fresh `alpha.2` package projection and create-only lock now exist; exact lock review and provenance admission passed, while reviewed merge `S2`, `A2`, annotated tag, and hosted evidence remain. M4-001C remains pending. |

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
release tag must still point to its own reviewed source object. For `alpha.2`,
call that object `S2`: current remote `main` must be exactly the one-commit
attestation `A2`, `A2` must have `S2` as its sole parent and exact-grant `S2`,
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
it is not publishable and cannot be relabeled as a release artifact. D-049 now
authorizes package-plan schema 3 to produce the exact public manifests for
`0.1.0-alpha.2`, but only M4-001B's fresh dual-builder lock may identify the
tarballs used by M4-001C.

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

G6 is in progress under D-049. Authorization permits the exact `alpha.2`
transition but cannot skip any machine-observable phase.

### M4-001A — contract admission (complete)

Package-plan schema 3 remains the only authority for official registry, public
access, dist-tag `alpha`, npm provenance, and graph-derived publication order.
Release-plan schema 2 owns the exact tag, locked inputs, builders, recovery,
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
objects, and hosted records are immutable evidence, never `alpha.2` authority.

### M4-001B — fresh `alpha.2` candidate and lock (in progress)

The replacement candidate must proceed in this order:

1. project all four manifests and dependency edges to exact version
   `0.1.0-alpha.2` and bind the lifecycle-neutral changelog, limitations, and
   `docs/releases/0.1.0-alpha.2.md`;
2. independently build and smoke all four tarballs under Node 22.23.2/npm
   10.9.8 and Node 24.19.0/npm 11.17.0;
3. require byte-identical canonical decompressed tar payloads after every
   member, mode, length, and content byte is reprojected from tracked source;
4. write `packaging/releases/0.1.0-alpha.2.lock.json` create-only, recording
   both builder-local evidence/gzip identities and selecting only the fixed
   Node 24/npm 11 envelopes as release bytes;
5. review and merge that exact lock as GitHub-verified `S2`, append exactly one
   public-identity attestation `A2` whose sole parent is `S2` and whose tip
   policy exact-grants `S2`, then pass the complete reachable-history gate at
   remote `main=A2`; and
6. create exact annotated tag `v0.1.0-alpha.2` on unchanged `S2`, prove its
   closed raw object and source relation, then pass the complete clean-tag,
   Public CI, and Security gates.

Create-only generation from exact commit
`3ddc8f36d636adfdb40c7b6a58c429543b9bd690` produced schema-2
`packaging/releases/0.1.0-alpha.2.lock.json`, SHA-256
`922a862092d3785ccca17ba4f6740afb95bb038ae718aaed80a105d086200a31`,
6218 bytes, mode `100644`, and package-source projection
`a022eb1e9a768bac7c22b0d50a7ab2c7ac11f4435f5751cd53033bc1c8b906e7`.
Independent exact recomputation and the exact nine-endpoint provenance review
passed with 0 blocker, 0 high, and 0 medium. This checkpoint admits the lock
for tracking; reviewed merge as `S2` is not implied. No `A2`, tag, tag-hosted result, npm
package, registry provenance/signature result, dist-tag, Trusted Publisher
binding, credential-retirement result, or GitHub Release is asserted.

The source identity claim remains deliberately narrow: the future exact
annotated tag binds a GitHub-verified accepted-main commit and receives tag CI
and CodeQL. No cryptographically signed Git tag is claimed. Artifact provenance
is npm Sigstore provenance from the admitted GitHub Actions workflow.

### M4-001C — publication and final declaration (pending)

Publish exact `0.1.0-alpha.2` bytes in dependency order: core,
native-card-arrow, public-synthetic, then CLI. Before each step,
official-registry `absent` permits only the reviewed tarball to be published;
`present-equal` permits continuation; and `present-mismatch` is a hard stop.
Never unpublish as rollback or reuse a version for different bytes.

npm receives a publisher-owned read-only materialization of frozen bytes,
never a mutable reviewed-stage path. After each package is present-equal, audit
the complete published dependency prefix before advancing. After all four
exist, reread official-registry tarballs and require exact lock bytes, valid
certificate-bound npm provenance/signatures, dist-tag `alpha` pointing to
`0.1.0-alpha.2`, and no `latest` assignment.

Create the GitHub prerelease last in a separate fresh-checkout credential
boundary that never receives the npm token. It must revalidate source, all four
registry packages, provenance, signatures, and dist-tags before the first
Release write, accept only an absent exact declaration or an exact-equal retry,
and never edit or delete a mismatch. M4-001C closes only after all four exact
npm Trusted Publisher bindings are configured, the bootstrap npm token is
revoked, and GitHub `NPM_TOKEN` is deleted. Record only non-secret configuration
facts.

The lock-bound changelog, limitations, and `alpha.2` release note remain
lifecycle-state neutral. D-049 authorization and partial registry state are not
a release declaration; observed completion belongs in non-lock state owners
and official npm/GitHub records.

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
for the new `alpha.2` tag.

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
BuildArtifact, no arbitrary-template flow, and no `0.1.0-alpha.2` publication
evidence.

M4-001A is complete. The next action is M4-001B's independent lock
recomputation, exact provenance/tracking, and reviewed `S2`/`A2` relation. Only
that relation, an annotated tag on unchanged `S2`, and passing tag-hosted gates
may enter M4-001C's ordered
registry state machine. If any byte or claim changes, rerun the affected gate
rather than citing an older result. Branch protection remains separately
deferred by D-047 and is not folded into G6.
