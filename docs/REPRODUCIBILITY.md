# Reproducing the Candidate-Alpha Boundary

## Scope

This procedure reproduces the current local source, test, and guarded four-
package candidate-alpha boundary. It does not prove hosted Linux, Windows, or
macOS CI, platform support, publication, signing, or reviewed-to-published
equality.

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
private reviewed tarballs in the ignored `.package-stage/`, installs them
together offline, and runs the installed
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
