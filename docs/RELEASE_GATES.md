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
| Release delta and state-neutral release-facing projection | `CHANGELOG.md` and `docs/releases/0.1.0-alpha.1.md` |
| Exact tag, builders, locked inputs, recovery, and completion rules | D-048 and `packaging/alpha-release-plan.json` |
| Release phase order and eligibility | This document |
| Exact candidate and artifact identity | `packaging/releases/0.1.0-alpha.1.lock.json` |

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
  -> reviewed lock merge as GitHub-verified commit S
  -> single-parent local attestation A with sole parent S and exact grant for S
  -> complete reachable-history gate at current main=A
  -> exact annotated-tag admission on unchanged S
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
| G0 — Identity, rights, provenance | Satisfied for the admitted source lineage | Public identity, MIT rights, exact provenance, leakage policy, and reachable-history scan are recorded; the release tag still needs its final exact check. |
| G1 — Public reproducibility | Satisfied for the accepted M3-004B implementation baseline | Canonical workflow passed Linux/macOS/Windows × Node 22/24 on accepted main; the release tag must rerun under G6. |
| G2 — Input security | Satisfied for the fixed public-synthetic profile | Bounded filesystem, ZIP, XML, OPC, relationship, and high-risk rejections pass; arbitrary templates remain outside scope. |
| G3 — Capability correctness | Satisfied for the exact candidate path | One opt-in native-card candidate replays readable layout facts, proves exact diff/source isolation, and produces blocked QA with no BuildArtifact. |
| G4 — Package boundary | Satisfied for the guarded package contract | Four allowlisted public-alpha candidate tarballs install together offline and execute the installed candidate flow; none is published yet, and exact release-tag tarballs plus publication equality remain G6. |
| G5 — Project security and maintenance | **Satisfied** | Least-privilege workflows, CodeQL, Dependency Review, private vulnerability reporting, SBOM, and public process documents are present and evidenced. Branch protection is outside this closure and remains deferred. |
| G6 — Release evidence | **In progress under D-048** | M4-001A contract admission is complete. M4-001B's exact independently reviewed dual-builder lock is included in this tracked-admission change, but it has not been merged as `S`; no `A`, tag, tag-hosted result, published package, registry equality/provenance result, or GitHub Release exists yet. |

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
release tag must still point to its own reviewed source object `S`. For this
release, current remote `main` must be exactly the one-commit attestation `A`,
`A` must have `S` as its sole parent and exact-grant `S`, and the comparison must
report `ahead_by=1` and `behind_by=0`. Equality, a deeper descendant, or another
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
it is not publishable and cannot be relabeled as a release artifact. D-048 now
authorizes package-plan schema 3 to produce the exact public manifests for this
candidate alpha, but only M4-001B's final dual-builder lock may identify the
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

G6 is in progress under D-048. Authorization permits the transition but cannot
skip any of its three machine-observable phases.

### M4-001A — contract admission (complete)

- package-plan schema 3 is the only authority for official registry, public
  access, dist-tag `alpha`, npm provenance, and the dependency graph from which
  publication order is derived;
- release-plan schema 2 fixes annotated tag `v0.1.0-alpha.1`, its exact
  non-secret message, input digests, builders, recovery policy,
  official-registry checks, and the final declaration's exact title, locked
  body source/projection, non-draft prerelease state, disabled generated notes,
  `make_latest=false`, zero assets, and create-or-exact rule; this document owns
  the phase sequence;
- pure validation and mutations cover dirty, lightweight/mismatched tag,
  shallow/replace/graft/alternate history, package/document drift, builder
  disagreement, bad recovery state, provenance drift, `latest`, and early
  GitHub Release;
- this phase performs no tag creation, npm publication, or GitHub Release.

### M4-001B — exact candidate and lock (in progress)

- Node 22.23.2/npm 10.9.8 and Node 24.19.0/npm 11.17.0 independently build and
  smoke the four public tarballs;
- every package matches across builders on its canonical decompressed tar
  payload; each builder's canonical gzip SHA-256, SHA-512, compressed size,
  and complete evidence record remain separately bound, and only the fixed
  Node 24/npm 11 gzip envelopes are eligible release bytes;
- `packaging/releases/0.1.0-alpha.1.lock.json` binds those builder results plus
  exact release-plan, package-plan, support-matrix, SBOM, changelog,
  limitations, and state-neutral release-note inputs; its top-level package-
  source-projection SHA-256 binds every generated manifest and mapped source
  path, target, role, admitted Git mode, package mode, length, and content
  digest used to validate both builders; it is written create-only, reviewed,
  committed, and merged before the tag exists;
- call the GitHub-verified lock-containing merge commit `S`; append exactly one
  repository-local public-identity attestation commit `A` whose sole parent is
  `S` and whose tip-owned policy exact-authorizes OID `S`, then require current
  `main=A` to pass the complete reachable-history gate;
- the exact annotated tag then peels to unchanged `S` and its intended tree;
  candidate inspection rereads every mapped blob and mode from that exact tree
  and rederives the locked source projection before tag admission;
  remote comparison must prove `S` is the sole direct parent of `A` with
  `ahead_by=1` and `behind_by=0`, while its closed raw object,
  approved public tagger, exact message, and remote ref/object all agree; and
- the tag checkout is clean and full-history with no replace refs, grafts,
  alternates, or shallow boundary, then passes the complete canonical gates.

Current checkpoint: create-only generation from exact M4-001A commit
`b80761a62cff23cb90101605e09cc6e3c2924abd` (tree
`e4a4ca28fbfa3a83080142af63c9b08b36291ccc`) and both fixed guarded stages
produced lock
`d3b4818e9bcdb43f39df557847613d3e5ce0afa2f6fffda5af655217f2f5170a`
with package-source projection
`962defc231e784627c142f01df84669b08d9a7b3f1bae39da2ea1f2728d95312`.
One bounded independent review recomputed the exact lock/blob/size, six inputs,
89 Git sources projected into 96 members with modes and lengths, two stage
evidence records, four cross-builder tar payloads, fixed Node 24/npm 11 release
envelopes, dependency order, and forbidden-material result; it reports
0 blocker, 0 high, and 0 medium with Taste=good. That exact reviewed lock is
included in this nine-path tracked-admission change. The remaining M4-001B
boundary is its unchanged commit and GitHub-verified merge as `S`, followed by
`A`, history admission, tag creation, and tag-hosted evidence.

The source identity claim is deliberately narrow: this is an exact annotated
tag pointing to a GitHub-verified accepted-main commit, followed by tag Public
CI and CodeQL. No cryptographically signed Git tag is claimed because no local
tag-signing key is part of the repository contract. Artifact provenance is npm
Sigstore provenance from the admitted GitHub Actions workflow.

### M4-001C — publication and final declaration

Publish in dependency order: core, native-card-arrow, public-synthetic, then
CLI. Before each step, official-registry `absent` permits only the reviewed
tarball to be published; `present-equal` permits a retry to continue; and
`present-mismatch` is a hard stop. Never unpublish as rollback and never reuse
the same version for different bytes.

Npm receives only a publisher-owned read-only materialization of the already-
frozen bytes, never a mutable reviewed-stage path. After each package is
present-equal, signature audit of the complete published dependency prefix must
pass before the next package is touched; the final state is audited again as a
four-package set.

After all four exist, reread the official-registry tarballs and require exact
lock bytes, npm provenance bound to the exact source workflow/tag, dist-tag
`alpha` pointing to `0.1.0-alpha.1`, and no `latest` assignment. Create the
GitHub Release last and bind it to the exact annotated tag, lock, and package
set without broadening support. The first release may use the D-048-authorized,
environment-scoped token exposed only to the final publish step; configure npm
Trusted Publisher after all four initial package identities exist and remove the
token fallback. GitHub Release creation is the last publication mutation, but
M4-001C is not complete until all four exact Trusted Publisher bindings are
configured, the bootstrap token is revoked, and GitHub `NPM_TOKEN` is deleted;
record only those non-secret configuration facts.

The final declaration is a separate fresh-checkout job that needs the publish
job. It receives `contents: write` and the GitHub token but no npm credential or
OIDC input. It rebuilds the locked stage, revalidates all four registry bytes,
provenance identities, dist-tags, and npm signatures, then revalidates the exact
source relation both after that potentially long audit and again between an
authenticated 404 and POST. A pre-existing Release or 422 race is accepted
only when the authenticated reread exactly equals the closed request; mismatch
is never edited or deleted. Post-declaration source and complete registry checks
run before one final exact Release reread.

The lock-bound changelog, limitations, and release note remain lifecycle-state
neutral. D-048 authorization and a partial registry state are not a release
declaration; observed completion belongs in the non-lock gate, handoff,
decision/provenance, registry, and GitHub records.

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
for a future tag.

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
BuildArtifact, no arbitrary-template flow, no release tag, and no published npm
package.

M4-001A is complete without a publication mutation. M4-001B's exact reviewed
dual-builder lock is included in this tracked-admission change; the next action
is to commit and merge it unchanged as verified `S`. Append single-parent
attestation `A`, exact-grant `S`, and pass the history gate at `main=A`; only
afterward may the annotated tag target unchanged `S` and run the clean-tag
gates. Only that complete lock/tag state may enter M4-001C's ordered registry
state machine. If any byte or claim changes, rerun the affected gate rather
than citing an older result. Branch protection remains separately deferred by
D-047 and is not folded into G6.
