# Public Support Matrix

## Purpose and boundary

This document explains what the repository will execute today. The normative
authority is [`policy/support-matrix.json`](../policy/support-matrix.json),
validated against
[`schemas/support-matrix.schema.json`](../schemas/support-matrix.schema.json).
If this summary and the JSON disagree, the JSON wins.

The conservative machine claim-state label is `pre-alpha-contract-only`; it is
not a published release channel and does not deny the narrow candidate path described below.
`supportClaimsEnabled` is `false`. Consequently, no input, OOXML feature,
capability, platform, evidence level, or delivery flow is `supported`. The
repository does contain one deliberately narrow experimental candidate path;
that path remains opt-in, produces no delivery authority, and cannot be
generalized to arbitrary presentations.

## Fact ownership

| Fact | Readable owner |
| --- | --- |
| Current support status and disposition | `policy/support-matrix.json` |
| Contract shape and allowed vocabulary | `schemas/support-matrix.schema.json` |
| Support resolution and promotion rules | `docs/COMPATIBILITY_POLICY.md` |
| Release eligibility | `docs/RELEASE_GATES.md` |
| Hosted CI and security run record | `docs/M3-004_HANDOFF.md` |
| Alpha package graph, publication settings, and derived npm order | `packaging/alpha-package-plan.json` |
| Exact tag, builders, locked inputs, recovery, and completion rules | `packaging/alpha-release-plan.json` |
| Release phase order and eligibility | `docs/RELEASE_GATES.md` |
| User-visible negative boundaries | `docs/KNOWN_LIMITATIONS.md` |

Roadmap text, a passing test, a local PowerPoint probe, or a release note cannot
change support. A status changes only through a reviewed edit to the normative
matrix in the same change as its executable evidence.

## Executable candidate flow

The installed candidate-alpha packages expose one complete public-synthetic
flow:

```text
init public-synthetic preset
  -> inspect the exact bounded POTX
  -> validate the complete project graph and support closure
  -> render one native-card candidate PPTX + CandidateBuildRecord
  -> qa re-derives and exact-compares the pair
  -> QaReport decision: blocked; no BuildArtifact
```

The source template owns unchanged inherited package content. `DeckSpec` owns
authored semantic content. `SlideLayoutIR` owns editable layout intent, and
`ComposedSlidePlan` owns resolved geometry. `CandidateBuildRecord` binds those
facts to the candidate bytes. The candidate PPTX is a derived artifact; it is
not a source from which the missing intent may be reconstructed.

Every requested row is resolved before OOXML mutation. The path executes only
when all 15 invariant profile rows, the current OS/Node row, and the public
automated evidence row are exactly `experimental/accept-with-warning`, and the
caller explicitly opts in. The result remains `deliveryEligible: false`.

## Current matrix

| Dimension | Items | Supported | Experimental | Manual | Unsupported |
| --- | ---: | ---: | ---: | ---: | ---: |
| Inputs | 13 | 0 | 5 | 0 | 8 |
| OOXML features | 22 | 0 | 5 | 0 | 17 |
| Capabilities | 8 | 0 | 5 | 0 | 3 |
| Platforms | 10 | 0 | 6 | 1 | 3 |
| Evidence levels | 7 | 0 | 1 | 2 | 4 |
| **Total** | **60** | **0** | **22** | **3** | **35** |

The experimental rows form one bounded closure:

- inputs: capability overlay, deck/slide specification, exact
  public-synthetic POTX, project configuration, and template profile/index;
- OOXML: package container, content types/internal relationships,
  masters/layouts/themes, native slide text, and the bounded DrawingML shapes
  used by the fixed profile;
- capabilities: package inspection, template-profile binding, minimal native
  DrawingML, create-only staged assembly, and collateral-mutation QA;
- platforms: Linux, macOS, and Windows under Node.js 22.x and 24.x;
- evidence: automated public synthetic conformance.

The POTX row is not a claim for arbitrary user templates. Its limitation narrows
acceptance to the installation-owned public-synthetic profile. PPTX input,
arbitrary POTX structures, unknown platforms, and every unknown input or OOXML
feature remain fail-closed.

The three manual rows are trusted macOS PowerPoint automation, trusted manual
runtime evidence, and optional private compatibility probes. A manual result
stays manual and can never be counted as an automatic pass.

## Status and resolution contract

- `supported`: the exact scope has a dispatchable implementation and complete
  public conformance evidence. This status is currently absent.
- `experimental`: one bounded implementation exists, remains visibly labeled,
  and requires explicit opt-in.
- `manual`: a named trusted human or desktop-runtime gate remains unresolved
  until its exact evidence is recorded.
- `unsupported`: reject or report unavailable before output mutation.

Resolution is fail-closed:

1. validate the matrix version and closed fields;
2. map every requested input, feature, capability, platform, and evidence level
   to exactly one row;
3. select the explicit catch-all and reject anything unknown;
4. reject missing or ambiguous semantic bindings;
5. reject `unsupported` and unresolved `manual` dependencies;
6. require explicit opt-in for every `experimental` dependency;
7. admit a capability only through its exact metadata, executor, input/output
   schemas, conformance fixtures, and QA assertions.

There is no fallback that strips unknown content, selects deck-specific code,
modifies the source template, or flattens an editable object to an image.

## Public evidence

M3-004B established hosted execution for the declared runtime envelope without
promoting support. The latest accepted pre-M4 reader baseline preserves that
closure on pull-request head
`093d527fc3fadf7cae577139b8d400719755dd52` and accepted main
`8cdf968b72f8dd5f41fee37a68e239e477dec44b`; both commits share tree
`1d6d148a8bc347dc3cbc13dde3fd4314d86c421a`:

- [pull-request Public CI run 31608992503](https://github.com/why7682/pptx-compiler/actions/runs/31608992503)
  passed all six Linux/macOS/Windows × Node 22/24 cells before merge;
- [pull-request Security run 31608992491](https://github.com/why7682/pptx-compiler/actions/runs/31608992491)
  passed Dependency Review;
- [accepted-main Public CI run 31609285181](https://github.com/why7682/pptx-compiler/actions/runs/31609285181)
  passed all six cells for the accepted-main object;
- [accepted-main Security run 31609285220](https://github.com/why7682/pptx-compiler/actions/runs/31609285220)
  passed CodeQL for the same object.

Each of the six platform rows carries `automated-public` evidence with a
`cross-platform-ci` record. The current projection is recorded in
`docs/RELEASE_GATES.md`; `docs/M3-004_HANDOFF.md` retains the earlier
implementation-baseline detail. This proves that the canonical public workflow
executed on those runners. It does not establish an M4 candidate, authorize a
PPTX capability, enable the global claim switch, prove PowerPoint
compatibility, or prove that an annotated release tag reproduces the reviewed
tarballs.

Repository-owned fixtures, schemas, mutation tests, package installation, and
the installed CLI smoke flow provide the remaining automated evidence for the
fixed candidate path. Optional local PowerPoint observations are narrower
manual facts and are not public-CI substitutes. Pandoc conformance uses a fake
runner and does not establish real-Pandoc compatibility.

## Limitations

The practical boundaries are collected in
[`docs/KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md). In particular:

- QA deliberately returns `decision: "blocked"` because required delivery
  evidence is unavailable, and it creates no `BuildArtifact`;
- arbitrary PPTX/POTX input, general rendering, formula CLI delivery, assets,
  charts, tables, media, animations, and comments are outside the candidate
  package graph;
- Windows preserves create-only ordering and reconciliation but makes no
  sudden-power-loss directory-entry persistence claim;
- D-049 authorizes the four `0.1.0-alpha.2` package identities and npm provenance,
  but this support summary does not assert mutable external lifecycle state.
  Exact tag/lock identity, official-registry bytes, npm provenance, and GitHub
  Release records own those facts and cannot change a support row.

## Verification

Run the normative gates from an admitted Node.js 22 or 24 runtime:

```sh
npm run check:support-matrix
npm run check:contracts
npm test
```

The staged public-tree gate invokes the matrix gate again and verifies that
every evidence artifact is admitted. Passing these commands validates the
declared state; it does not change that state.

## Next authorized action

D-049 authorizes the exact `alpha.2` release; Release Gates owns current phase
state. Any incomplete M4-001 attempt advances only through its earliest
unsatisfied step: freeze and build; write the lock; merge it as GitHub-verified
`S2`; append the single-parent local attestation `A2` whose sole parent is
`S2`; pass the full history gate at `main=A2`; tag unchanged `S2`; pass tag
Public CI and Security;
publish npm in package-graph dependency order; then create the GitHub Release
last. Keep the global claim switch false and every current support status
unchanged. D-047/M3-008 branch protection remains deferred and is not a
release prerequisite.
