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
| Package graph and intended tarball contents | `packaging/alpha-package-plan.json` |
| Workflow commands and permissions | `.github/workflows/ci.yml` and `security.yml` |
| Hosted execution evidence | `docs/M3-004_HANDOFF.md` |
| Reproduction procedure | `docs/REPRODUCIBILITY.md` |
| User-visible limitations | `docs/KNOWN_LIMITATIONS.md` |
| Release delta and release-facing projection | `CHANGELOG.md` and `docs/releases/0.1.0-alpha.1.md` |

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
  -> clean-tag rebuild and reviewed/published equality
  -> release publication
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
| G4 — Package boundary | Satisfied for the guarded package contract | Four allowlisted private tarballs install together offline and execute the installed candidate flow; exact release-tag tarballs and publication equality remain G6. |
| G5 — Project security and maintenance | **Satisfied** | Least-privilege workflows, CodeQL, Dependency Review, private vulnerability reporting, SBOM, and public process documents are present and evidenced. Branch protection is outside this closure and remains deferred. |
| G6 — Release evidence | **Pending** | No reviewed release tag, clean-tag build, signed/provenance-enabled publication, registry authorization, or reviewed-to-published equality exists. |

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
- a release ref cannot introduce an unscanned history, replacement object,
  shallow boundary, or unreviewed identity drift.

The first public source ref passed the complete reachable-history scan and was
transported by exact object ID. A future release tag must still point to its own
reviewed source object; the first-ref result is not release-tag evidence.

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

Every leaf manifest remains `private: true`, and the package plan retains
`npm-publication-not-authorized`. Removing that guard or publishing to npm
requires a separate explicit reviewed authorization.

## G5 — Project security and maintenance

G5 is satisfied for the current public repository:

- exactly two least-privilege workflows use fixed hosted runners and full-SHA
  action pins;
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

G6 remains pending. A release may be created only after all of these facts bind
the same reviewed source and artifact set:

- a reviewed release tag points to the intended commit;
- a clean tag checkout passes the full public conformance and security gates;
- the guarded four-tarball build and empty-directory installed CLI flow pass;
- changelog, limitations, support matrix, SBOM, and release note match those
  exact bytes;
- the publication channel is explicitly authorized and uses signing/provenance
  where required;
- every published tarball byte-for-byte equals its reviewed tarball;
- the public release record identifies the exact source and artifacts without
  broadening support.

Until then, `0.1.0-alpha.1` is a draft release projection, not a published
release, and npm publication remains blocked.

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

## Limitations and next authorized action

[`docs/KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) is the user-facing negative
contract. The release-critical facts are: zero supported rows, blocked QA, no
BuildArtifact, no arbitrary-template flow, no release tag, and no authorized
npm publication.

The next authorized action is M4-001. Freeze the final candidate-alpha source,
select and review the release tag, execute the clean-tag gates, obtain explicit
publication authorization, and prove reviewed-to-published equality. If any
byte or claim changes, rerun the affected gate rather than citing an older
result.
