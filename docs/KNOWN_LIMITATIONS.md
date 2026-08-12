# Known Limitations

## Purpose and boundary

This is the user-facing negative contract for the unreleased candidate alpha.
It states what the current repository does not promise and how failure remains
visible. The normative support status is still
[`policy/support-matrix.json`](../policy/support-matrix.json); this document
cannot broaden it.

## Fact ownership and flow

The source template owns unchanged inherited content, `DeckSpec` owns authored
semantics, `SlideLayoutIR` owns editable constraints, and
`ComposedSlidePlan` owns calculated geometry. A `CandidateBuildRecord` binds
those facts to one candidate PPTX. QA rebuilds and compares that relation. When
required delivery evidence is missing, it reports `blocked` and stops before a
`BuildArtifact` exists.

That ownership chain is deliberate: a standalone PPTX, screenshot, hash,
manual observation, or hosted test cannot invent the missing semantic or
delivery authority.

## Current limitations

| Area | Current behavior | Boundary and unlock condition |
| --- | --- | --- |
| Release state | Source is public, but `0.1.0-alpha.1` is not released. | A reviewed tag, clean-tag build, publication authorization, signing/provenance, and reviewed-to-published equality remain G6/M4-001 work. |
| Support claims | Zero rows are `supported`; `supportClaimsEnabled=false`. | The 22 experimental rows are exact opt-in dependencies, not general promises. Promotion requires a separate reviewed matrix change. |
| Input class | The CLI accepts only the installation-owned public-synthetic POTX/profile. | User-owned PPTX, arbitrary POTX structures, unknown OOXML, and other document/design formats remain unsupported. |
| Output authority | `render` creates one native-card candidate PPTX plus `CandidateBuildRecord`; `deliveryEligible=false`. | A candidate is not a delivery. Final authority requires exact candidate-bound mechanical, render, independent-pixel, and required compatibility receipts. |
| Create-only outputs | Existing project, index, candidate, record, and report paths are not updated in place. | A conflicting destination fails visibly; choose a new path or explicitly reconcile the existing artifact outside the compiler. |
| QA | The public CLI emits a schema-valid `QaReport` with `decision: "blocked"`. | Pixel review, render completeness, and PowerPoint compatibility are unavailable in the public headless path, so no `BuildArtifact` is created. |
| Accessibility | No alt-text, screen-reader, focus-order, or reading-order conformance is claimed. | Accessibility requires an explicit contract, authored semantics, generated-package checks, and assistive-technology evidence before any support review. |
| Capability breadth | The package graph exposes one one-slide native-card candidate profile. | General clone/fill delivery, formula delivery, arbitrary DrawingML, images, charts, tables, media, animations, transitions, notes, and comments are not alpha capabilities. |
| Formula/Pandoc | Formula and OMML work exists only in separately bounded repository paths; Pandoc public tests use a fake runner. | The four-package alpha graph exposes no formula CLI. A real-Pandoc matrix and exact purpose-bound compatibility evidence would be required before any scope review. |
| PowerPoint | A trusted local observation exists only for exact synthetic candidates in Microsoft PowerPoint 16.111.3 on macOS. | It is absent from public CI and cannot generalize to macOS compatibility as a whole, Windows automation, arbitrary templates, or another candidate's delivery receipt. |
| Visual review | Pixels and model-assisted labs may reveal defects but cannot authorize support or publication. | Final acceptance must review the exact frozen artifact under a separate evidence contract; model preference is not audience-effect proof. |
| Archive/profile limits | Input is limited to 1 MiB, 32 ZIP members, 256 KiB per member, 1 MiB expanded total, 100:1 compression ratio, XML depth 64, and 50,000 elements. | These fixed security ceilings are not user-configurable. Broader grammar requires public positive and adversarial evidence plus a matrix review. |
| Windows durability | Windows keeps file flush, create-only links, logical commit ordering, and exact recovery. | Node exposes no parent-directory fsync equivalent there, so sudden-power-loss directory-entry persistence is not claimed. |
| Filesystem races | Portable Node APIs cannot provide a universal descriptor-relative walk or `openat` publication boundary. | Stable-handle checks, `O_NOFOLLOW` where available, identity rechecks, create-only writes, and fail-closed recovery reduce but do not erase same-principal race residuals. |
| Package distribution | Four private guarded tarballs can be built, inspected, installed together offline, and smoked. | They are ignored local/CI evidence. Leaf manifests remain `private: true`; npm publication is explicitly unauthorized. |
| Package stage | One ignored fixed stage retains reviewed output and failed/quarantined attempts. | Concurrent builds and unknown nonempty stage entries fail closed. Directory names alone never authorize recursive deletion. |
| Runtime envelope | Hosted CI passed Linux/macOS/Windows under Node 22/24. | Those platform rows remain experimental and authorize nothing alone. Browsers and undeclared Node/OS versions are unsupported. |
| CLI breadth | `init`, `inspect`, `validate document`, `validate project`, exact `render`, and exact `qa` exist. | `doctor`, generic `onboard`, standalone `diff`, and formula CLI remain deferred until a demonstrated workflow justifies them. |
| Contract stability | Public contracts are versioned `0.x`. | Breaking changes increment the minor version with migration notes and negative tests; no 1.0 stability promise exists. |
| Private fixtures | Optional private probes may find narrow defects. | They remain outside Git and public CI and cannot be required for reproduction or used to establish public support. |
| Branch protection | Main-branch protection is not configured or claimed. | D-047 defers force-push/deletion restrictions and required-check rules until the current document sequence is complete. |

## Public evidence

The canonical workflow passed all six Linux/macOS/Windows × Node 22/24 cells on
accepted-main object `c4dee58` in
[run 31600806512](https://github.com/why7682/pptx-compiler/actions/runs/31600806512).
CodeQL passed for the same object in
[run 31600806350](https://github.com/why7682/pptx-compiler/actions/runs/31600806350),
and pull-request Dependency Review passed in
[run 31600528742](https://github.com/why7682/pptx-compiler/actions/runs/31600528742).

These facts close M3-004B and G5. They do not contradict any limitation above:
the runs verify the declared repository workflow, not arbitrary presentation
compatibility, delivery QA, a release tag, or published package equality.

## Working safely within the boundary

- Use only the documented public-synthetic preset for the candidate flow.
- Treat the produced PPTX and record as a pair and preserve a blocked QA result
  as blocked.
- Do not feed private presentations to public issues, CI, or committed fixtures.
- Reproduce from an ordinary clean checkout using
  [`docs/REPRODUCIBILITY.md`](REPRODUCIBILITY.md).
- Report suspected vulnerabilities through [`SECURITY.md`](../SECURITY.md), not
  a public issue or pull request.

## Next authorized action

M4-001 may address release-state limitations only. It must not silently broaden
input, capability, compatibility, or support scope. Every broader limitation
requires its own executable user need, public conformance evidence, and exact
matrix review.
