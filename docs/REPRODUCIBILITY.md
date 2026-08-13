# Reproducing the Candidate-Alpha Boundary

## Scope

This procedure reproduces the current local source, test, and guarded four-
package candidate-alpha boundary. It does not prove hosted Linux, Windows, or
macOS CI, platform support, publication, signing, or reviewed-to-published
equality.

M4-001 adds a stricter release-candidate boundary. D-050 authorizes the fresh
`0.1.0-alpha.3` recovery after the exact partial `alpha.2` publication, but this
ordinary checkout procedure still cannot
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

On macOS, Finder may create `.DS_Store` in a local ignored staging directory.
The package-stage inventory must reject it as a foreign entry; do not add an
exception, silently delete it, or relax the inventory. A Finder preference such
as `DSDontWriteNetworkStores` is not a control for an ordinary local directory.
Apple's [File System Programming Guide](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/FileSystemOverview/FileSystemOverview.html)
also distinguishes Finder's presentation of hidden files from programmatic
directory enumeration, so the gate observing an entry hidden by Finder is
expected behavior.

For frozen macOS full-suite and guarded-build evidence, use this boundary:

1. create a fresh system temporary directory outside synchronized or
   Finder-browsed trees;
2. create a Git-backed snapshot there from the exact source `HEAD`, including
   a consistent index and object database, and apply the complete reviewed
   delta rather than copying only its surviving files;
3. before running either fixed runtime, compare the complete candidate
   projection: added, deleted, and renamed paths; Git object types and modes;
   blob bytes; and absence of any extra endpoint;
4. run full suites and builders sequentially, retain reviewed evidence outside
   the repository, and verify the stage has no unknown entry; and
5. treat any snapshot-only commit as disposable verification scaffolding, not
   as the candidate commit, provenance origin, or release evidence.

A source-only copy without a consistent, verified Git index and object database
is insufficient because Git-aware contract tests use those facts; the transfer
mechanism itself is not authority. If the source stage is already polluted,
preserve its exact contents for diagnosis and start from a new isolated
snapshot rather than mutating the stage until the gate passes.

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

### Registry facts that local mocks cannot prove

Model npm as three related facts: the package identity, each immutable
`name@version`, and the package-level mutable dist-tag map. An explicit
`npm publish --tag alpha` controls the requested channel, but it does not make
the package-level `latest` key optional. The official registry metadata
contract states that every package has `latest`; the observed first
`pptx-compiler-core` publication seeded both `alpha` and `latest`. Research the
current upstream registry contract and CLI documentation before changing this
model, then confirm it with the official live endpoint. A synchronous mock
cannot establish seed-tag behavior. The upstream references are npm's
[package-metadata contract](https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md)
and [dist-tag documentation](https://docs.npmjs.com/cli/dist-tag/).

Treat registry metadata, tarball bytes, and attestations as eventually
consistent observations, not one atomic response. The `alpha.2` core metadata
records publication at `2026-08-13T19:43:34.408Z`; the workflow stopped around
`19:43:35Z` during its immediate attestation check, and a later attestation
response carried `Last-Modified: 19:44:33 GMT`. That approximately 59-second
gap is a single observation, not an npm SLA or an exact first-visible instant:
the suppressed child error cannot distinguish an initial 404, empty result, or
cryptographic freshness failure. Product logic therefore uses a bounded retry
only for the exact expected absent/incomplete propagation state, followed by
the same strict certificate-bound check. Malformed payloads, wrong identities,
bad signatures, unexpected tags, and timeout remain failures.

The npm client is also part of the write boundary. Its normal fetch retry
setting is not safe evidence for `npm publish`: a registry `PUT` may commit and
then return a retryable transport/5xx result, causing one CLI invocation to send
another `PUT`. The release subprocess therefore fixes `fetch-retries=0` and
ignores ambient retry configuration. A nonzero publish result triggers only
bounded read-only convergence in that process; it never triggers another
publish call. A later invocation may write only after time-separated official-
registry absence samples. The npm configuration reference documents the
default retry count, and [npm/cli issue 6693](https://github.com/npm/cli/issues/6693)
records the observed 503-then-second-PUT failure mode. This is a reusable
publication rule, not a version-specific workaround.

M4-001A's contract admission and M4-001B's immutable `alpha.2` candidate/tag
gates are historical prerequisites. D-050's fresh `alpha.3` lane begins only
after source, package manifests, changelog, limitations, support matrix, SBOM,
and the state-neutral `alpha.3` note are frozen. The three lock-bound reader
documents are lifecycle-state neutral. It requires this exact order:

1. the complete canonical gate sequence;
2. an independent guarded build/install/smoke under Node 22.23.2/npm 10.9.8;
3. the same under Node 24.19.0/npm 11.17.0;
4. exact equality of each decompressed canonical tar payload after every
   member, mode, and content byte is re-projected from the tracked source;
   each builder's own canonical gzip SHA-256, SHA-512, compressed size, and
   complete evidence record are bound separately, while one top-level SHA-256
   binds the canonical package/source projection used for both validations,
   with only Node 24/npm 11 envelopes eligible for publication, before writing
   create-only `packaging/releases/0.1.0-alpha.3.lock.json`;
5. review, provenance admission, commit, and accepted-main merge of that exact
   tracked lock without changing any locked input; call that GitHub-verified
   merge commit `S3`;
6. exactly one repository-local public-identity attestation commit `A3` whose
   sole parent is `S3` and whose tip-owned policy grants exact OID `S3`;
7. the complete reachable-history gate at current `main=A3`, followed by a
   remote comparison proving `S3` is its sole direct parent with `ahead_by=1`
   and `behind_by=0`;
8. annotated tag `v0.1.0-alpha.3` peeling to unchanged `S3` and its intended
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

Immediately before the first publish, the workflow admits the GitHub Actions
OIDC request URL only as HTTPS on exactly one validated DNS label beneath
`actions.githubusercontent.com`, with a nonempty path and no user info,
explicit port, fragment, nested label, suffix confusion, non-ASCII raw URL
text, or non-GitHub authority. That environment check is not provenance
proof: the fetched v0.3 bundle must still pass fixed npm 11.17.0 Sigstore
verification for the exact workflow/tag certificate identity and GitHub
Actions issuer.

The immutable `alpha.2` candidate followed that order through tag-hosted gates.
Manual run `31665307969`, attempt 2, then published the exact reviewed core
tarball and stopped before another package or GitHub Release write. Later
independent verification downloaded 118,488 exact bytes (SHA-256
`ed0cc4a2f66049ed9bd6823544913161377a229e290b70bb5527857520930268`),
matched the fixed Node 24/npm 11 lock envelope, passed the bundled npm
11.17.0/Sigstore 4.1.1 certificate check for the exact tag, source, workflow,
issuer, and invocation, and passed isolated `npm audit signatures
--include-attestations` with no invalid or missing entry. Those are later
read-only facts; the original workflow did not record verifier success. The
other three `alpha.2` versions and its GitHub Release remain absent. Preserve
that prefix without unpublish, tag movement, dist-tag repair, or version reuse.

D-050's fresh `alpha.3` lane derives npm dependency order from the package
graph: core, native-card-arrow, public-synthetic, then CLI. For each exact
`0.1.0-alpha.3` name/version, `absent`
permits publishing
only the locked tarball, `present-equal` permits continuation, and
`present-mismatch` stops without unpublish. Completion requires downloading all
four official-registry tarballs, matching lock bytes, validating npm
provenance, and requiring the complete expected dist-tag map: core keeps
`latest -> 0.1.0-alpha.2` while `alpha -> 0.1.0-alpha.3`; each newly created
other package has both `latest` and `alpha` at `0.1.0-alpha.3`. Only the exact
`npm publish --tag alpha` operations may assign `alpha` and trigger npm's
first-identity `latest` seed; the lane runs no separate `npm dist-tag add/rm`
repair and otherwise only reads these pointers.
Only then may it create the GitHub Release last.

After that Release succeeds, the existing `alpha-release.yml` workflow stops;
it does not automatically modify npm or GitHub settings. The remainder is an
external local interactive procedure using the authenticated maintainer's
fixed npm 11.17.0. The npm account must have package-write authority and 2FA.
For each of `pptx-compiler-core`, `pptx-compiler-native-card-arrow`,
`pptx-compiler-public-synthetic`, and `pptx-compiler`, begin with a new process
and fresh `npm trust list <exact-package> --json` result from the official
registry:

```sh
npm trust list <exact-package> --json --registry=https://registry.npmjs.org/
```

An empty JSON list permits exactly one create:

```sh
npm trust github <exact-package> \
  --file alpha-release.yml \
  --repository why7682/pptx-compiler \
  --environment npm-release \
  --allow-publish \
  --yes \
  --registry=https://registry.npmjs.org/
```

Do not pass `--allow-stage-publish`. Discard the create response as completion
evidence and rerun the fresh list command. Exactly one normalized exact binding
permits an idempotent rerun to continue without writing; a mismatch or any
other cardinality hard-stops. Normalize the raw readback as follows:

| npm JSON readback | Required project fact |
| --- | --- |
| `type: "github"` | provider `github-actions` |
| `repository: "why7682/pptx-compiler"` | owner `why7682`; repository `pptx-compiler` |
| `file: "alpha-release.yml"` | workflow filename `alpha-release.yml` |
| `environment: "npm-release"` | environment `npm-release` |
| sole `permissions: ["createPackage"]` | allowed action `npm publish` only |

`createStagedPackage`, another permission or field value, multiple bindings,
or a non-list response is a hard stop. The operator must repeat the fresh list
readback for all four exact names; no cached create result completes a package.

Only after four fresh exact readbacks may the operator retire the bootstrap
credentials. First obtain a fresh `npm token list --json` inventory, uniquely
confirm the bootstrap token's full ID, revoke only it, and take another fresh
inventory:

```sh
npm token list --json --registry=https://registry.npmjs.org/
npm token revoke <operator-confirmed-unique-full-id> \
  --registry=https://registry.npmjs.org/
npm token list --json --registry=https://registry.npmjs.org/
```

Any ambiguity is a hard stop. Revoke only the selected full ID and require a
fresh token list in which it is absent. Only after that absence is visible may
a GitHub-authenticated operator with permission to manage Actions environment
secrets delete the GitHub Actions environment secret `NPM_TOKEN` from
repository `why7682/pptx-compiler`, environment `npm-release`, and fresh-read
that exact scope:

```sh
gh secret delete NPM_TOKEN \
  --env npm-release \
  --repo why7682/pptx-compiler
gh secret list \
  --env npm-release \
  --repo why7682/pptx-compiler \
  --json name
```

The fresh environment-secret list must omit exactly `NPM_TOKEN`; a repository-
level, organization-level, or other-environment secret is out of scope. Record
only IDs/names and absence facts, never token or secret values. npm's
[Trusted Publisher documentation](https://docs.npmjs.com/trusted-publishers/)
states that configuration is not validated when saved, so configured/visible
state is not execution proof. A future exact tokenless OIDC publication is the
first proof that the binding works. The lock-bound changelog, limitations, and release note
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
