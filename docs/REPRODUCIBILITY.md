# Reproducing the Candidate-Alpha Boundary

## Scope

This procedure reproduces the current local source, test, and guarded four-
package candidate-alpha boundary. It does not prove hosted Linux, Windows, or
macOS CI, platform support, publication, signing, or reviewed-to-published
equality.

M4-001 adds a stricter release-candidate boundary. D-048 authorizes the exact
tag and publication channel, but this ordinary checkout procedure still cannot
prove an annotated tag, dual-builder release lock, npm provenance, official-
registry equality, or a GitHub Release.

## Prerequisites

Use a clean checkout on an ordinary local filesystem with Git and an admitted
Node.js 22.x or 24.x runtime plus its bundled npm. PowerPoint, Pandoc, models,
private fixtures, proprietary assets, and a GUI are not required.

## Canonical public CI command sequence

Run the following commands from the repository root, in order. The root package
scripts and `.github/workflows/ci.yml` remain the machine authorities; this
block is a checked human-readable projection of that workflow.

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

## Expected result

The source and policy gates pass. The guarded package build creates four
reviewed public-alpha candidate tarballs in the ignored `.package-stage/`;
none is published by this procedure. It installs them together offline and
runs the installed
`init -> inspect -> validate project -> render -> qa` spine. QA ends with
`decision: "blocked"`, and no `BuildArtifact` exists. That blocked result is
expected while the required render, pixel-review, and compatibility evidence is
unavailable.

Generated fixtures, package-stage contents, archives, smoke projects, and raw
review evidence remain ignored and must not be committed.

## Filesystem note

Do not run concurrent package builds. Use one stable checkout rather than
creating a new temporary tree for every run. If a synchronized or FileProvider
filesystem creates conflict entries, stop and reproduce from one clean checkout
on an ordinary filesystem. Do not delete preserved failed or conflicting stage
content merely because its directory name looks temporary.

## Reporting a result

Record the operating system, Node and npm versions, exact command, exit status,
and whether the checkout was clean. Do not publish private paths, credentials,
input decks, ignored evidence, or local artifact identities. A local pass
remains local evidence. M3-004B separately records six-cell PR CI run
`31600528716` plus PR Dependency Review run `31600528742`, and six-cell
accepted-main CI run `31600806512` plus main CodeQL run `31600806350`. The PR
head `f6ba6bad48c928d31c356d47911dd929ccf3b2d1` and accepted main
`c4dee58a8920a8e71c20f53ab93c62a96d3cb89d` share tree
`4e70ec4323807824b0578241fe4a4d94951cd608`. PR CodeQL and push Dependency
Review were skipped by event design. That hosted closure does not make this
local procedure proof of platform support, publication, or release, and any
changed snapshot needs its own hosted evidence.

Constructive-document PR #2 head
`093d527fc3fadf7cae577139b8d400719755dd52` passed Public CI run
`31608992503` and Security run `31608992491`; accepted main
`8cdf968b72f8dd5f41fee37a68e239e477dec44b` passed Public CI run
`31609285181` and Security run `31609285220`. Both commits share tree
`1d6d148a8bc347dc3cbc13dde3fd4314d86c421a`. These runs cover the accepted
reader-document baseline, not a release tag or public package set.

## M4-001 release reproduction

The exact tag/builders/lock/recovery contract is owned by
`packaging/alpha-release-plan.json`; package dependencies and publication
settings are owned by `packaging/alpha-package-plan.json`; phase order is owned
by `docs/RELEASE_GATES.md`. `docs/M4-001_HANDOFF.md` records the current phase.
Do not improvise a publish command from this human summary.

M4-001A validates the release plan and its negative states without creating a
tag or contacting a publication endpoint. M4-001B begins only after source,
package manifests, changelog, limitations, support matrix, SBOM, and the
state-neutral release note are frozen. The three lock-bound reader documents are
lifecycle-state neutral. It then requires this exact order:

1. the complete canonical gate sequence;
2. an independent guarded build/install/smoke under Node 22.23.2/npm 10.9.8;
3. the same under Node 24.19.0/npm 11.17.0;
4. exact equality of each decompressed canonical tar payload after every
   member, mode, and content byte is re-projected from the tracked source;
   each builder's own canonical gzip SHA-256, SHA-512, compressed size, and
   complete evidence record are bound separately, while one top-level SHA-256
   binds the canonical package/source projection used for both validations,
   with only Node 24/npm 11 envelopes eligible for publication, before writing
   create-only `packaging/releases/0.1.0-alpha.1.lock.json`;
5. review, provenance admission, commit, and accepted-main merge of that exact
   tracked lock without changing any locked input; call that GitHub-verified
   merge commit `S`;
6. exactly one repository-local public-identity attestation commit `A` whose
   sole parent is `S` and whose tip-owned policy grants exact OID `S`;
7. the complete reachable-history gate at current `main=A`, followed by a
   remote comparison proving `S` is its sole direct parent with `ahead_by=1`
   and `behind_by=0`;
8. annotated tag `v0.1.0-alpha.1` peeling to unchanged `S` and its intended
   tree; and
9. a clean, full-history tag checkout with no shallow boundary, replace refs,
   grafts, or object alternates, followed by the complete tag gates and the
   tag-triggered Public CI and Security workflows. Candidate admission rereads
   every package-plan mapped blob and mode from the exact tag-target tree and
   rejects a projection digest mismatch.

The manual release workflow checks out the immutable workflow-dispatch event
commit with full history, then verifies that the fetched annotated tag still
peels to that `HEAD`; it does not resolve a mutable tag name after queuing. The
ordinary tag-triggered Public CI and Security workflows contain no publication
credential and separately supply the six portable cells and CodeQL before npm
publication may begin.

M4-001C derives npm dependency order from the package graph: core,
native-card-arrow, public-synthetic, then CLI. For each name/version, `absent`
permits publishing
only the locked tarball, `present-equal` permits continuation, and
`present-mismatch` stops without unpublish. Completion requires downloading all
four official-registry tarballs, matching lock bytes, validating npm
provenance, requiring dist-tag `alpha` and no `latest`, then creating the
GitHub Release last. The lock-bound changelog, limitations, and release note
remain lifecycle-state neutral; observed completion belongs in Release Gates,
the handoff/decision/provenance records, and the official registry/GitHub state.

The GitHub declaration is not part of the npm-credential process. A separate
fresh-checkout job rebuilds the reviewed stage, repeats exact source and
four-package registry/provenance/signature verification, and only then receives
the job-scoped GitHub token. Its deterministic request uses the locked note plus
tag/lock/package identity projection, sets `draft=false`, `prerelease=true`,
`make_latest=false`, disables generated notes, and uploads no assets. It accepts
only authenticated 404/create/201, an exact pre-existing 200, or a 422 race
followed by an exact 200. It never patches or deletes a mismatch, and its final
network check rereads the exact Release after the post-create source and
registry checks.

This process does not claim a cryptographically signed Git tag. The annotated
tag binds the exact GitHub-verified accepted-main commit and receives tag CI and
CodeQL; npm Sigstore provenance binds the published artifacts to the admitted
GitHub Actions workflow.
