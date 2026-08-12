# TODO

Status values: `DONE`, `NEXT`, `BLOCKED`, `PENDING`, and `DEFERRED`.

Complete tasks in dependency order. A task is complete only when its exit
criterion is recorded in the repository.

## M0 — Clean bootstrap

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| M0-001 | DONE | Create a new workspace and independent Git tree without copying predecessor content. | Only planning text is present; parent repository ignores this nested tree. |
| M0-002 | DONE | Record the project boundary, handoff, private-fixture policy, target architecture, and release gates. | The documents linked from `README.md` agree on scope and status. |
| M0-003 | DONE | Select the working name, monorepo shape, MIT license, copyright holder, and repository-local public Git identity. | Dated decisions, official-registry name check, MIT license text, and local Git identity verification are recorded. |
| M0-004 | DONE | Implement the bounded provenance and forbidden-material gates in `docs/M0-004_HANDOFF.md`. | Every tracked/admitted file has machine-readable provenance; mutations covering forbidden paths/text/extensions/magic, symlinks, oversize files, missing/invalid records, and private-output leakage are rejected. |
| M0-005 | DONE | Define the public support matrix and compatibility policy. | Each input, OOXML feature, platform, and evidence level is marked supported, experimental, manual, or unsupported. |

### M0-004 completion evidence — 2026-07-30

- `npm test`: 33/33 passed, comprising 2 passing baselines and 31 rejection
  mutations.
- `npm run check:public-tree`: staged forbidden-material and exact per-file
  provenance gates passed for the complete slice.
- `git diff --check`: passed.
- The bounded independent read-only review found four issues; all were fixed,
  regression-tested, and the closing review reported no blocking findings.
- The local run used Node.js 23.7.0 only as development verification. Node.js
  22.x/24.x and cross-platform evidence remains assigned to public CI work.

### M0-005 completion evidence — 2026-07-31

- The normative matrix contains 60 sorted, unique rows across all required
  dimensions, zero `supported` items, and an explicit false global claim switch.
- `npm test`: 47/47 passed, including 44 total rejection mutations; 13 are
  support-matrix overclaim and drift mutations.
- `npm run check:public-tree`: staged forbidden-material, provenance, and
  support-matrix gates passed for the complete slice.
- `git diff --cached --check`: passed.
- The compatibility policy defines status promotion/demotion, evidence scope,
  fail-closed resolution, manual/private boundaries, and 0.x versioning.

## M1 — Public, self-contained foundation

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| M1-001 | DONE | Create a repository-owned synthetic PPTX/POTX fixture generator from reviewed text-only OOXML parts. | Generated decks are deterministic, contain no third-party branding/content, and pass an independent provenance review. |
| M1-002 | DONE | Define versioned schemas for project config, template profile/index, capability registry/overlay, slide spec, build artifact, and QA report. | Valid and mutation-invalid fixtures pass/fail predictably on every supported Node version. |
| M1-003 | DONE | Implement `ProjectContext` and remove ambient root-path assumptions. | Core APIs accept explicit paths/dependencies; scans find no project-root singleton or absolute path. |
| M1-004 | DONE | Implement a distributable template inspector without managed/private helpers. | A clean installation inspects the synthetic fixture and emits a deterministic, path-redacted index. |
| M1-005 | DONE | Implement secure ZIP/XML ingestion. | Tests cover traversal, symlinks, zip bombs, member/size limits, duplicates, case conflicts, malformed XML, external relationships, macros, ActiveX, and embedded objects. |

### M1-001 completion evidence — 2026-07-31

- A positive manifest admits exactly 12 repository-owned UTF-8/LF OOXML parts;
  no presentation, image, font, private fixture, or predecessor file was used.
- The dependency-free generator produces ignored PPTX and POTX archives that
  differ only in the reviewed main-part content type. ZIP entry order, bytes,
  timestamp, permissions, CRC-32, comments, and extra fields are deterministic.
- `npm test`: 75/75 passed, including 66 rejection mutations; the M1-001 suite
  contributes 28 tests and 22 focused rejection mutations.
- All 12 source parts passed local XML well-formedness checks, and both generated
  variants passed archive integrity checks. Public tests independently parse the
  ZIP records and do not depend on those local tools.
- The bounded independent provenance/security review found four blocking
  validation gaps. Canonical tag forms, exact Default/Override content types,
  high-risk namespace prefixes, and element-bound relationship references were
  fixed and regression-tested; the closing review reported no blocking findings.
- `npm run check:public-tree` and `git diff --cached --check` passed on the staged
  48-file tree. The global support-claim switch remains false.
- Local verification used Node.js 23.7.0. Supported Node.js 22.x/24.x and
  cross-platform evidence remain assigned to public CI work.

### M1-002 completion evidence — 2026-07-31

- Contract version `0.1.0` contains eight closed root schemas, one registered
  shared-definition schema, eight positive text fixtures, and 22 generated
  TypeScript exports from the normative JSON Schemas.
- The dependency-free contract gate rejects unregistered references, unknown
  keywords/versions/fields, unsafe relative paths, duplicate or dangling IDs,
  ambiguous bindings, cross-document version/hash drift, invalid publication
  targets, incorrect QA/manual aggregation, and generated-type drift.
- `npm test`: 146/146 passed, including 135 total rejection mutations. The
  contract suite contributes 70 tests (2 positive and 68 rejection mutations);
  one additional provenance-authority regression belongs to the M1-002 slice.
- The identical 146-test suite passed on Node.js 22.23.1 and Node.js 24.14.0,
  satisfying the two declared runtime lines. Linux/Windows and broader
  cross-platform evidence remains assigned to M3-004B.
- The fixture manifest is machine-marked `schema-conformance-only`; placeholder
  executor/schema/QA references and fictional artifact values are not runtime
  evidence. `supportClaimsEnabled` remains false and no matrix row is promoted.

### M1-003 completion evidence — 2026-08-01

- `packages/core/src/project-context.mjs` constructs a detached, deeply frozen
  runtime context from an explicit absolute root, `ProjectConfig 0.1.0`, and an
  exact injected validator. It performs no filesystem or presentation I/O.
- All eight configured locations are lexically contained below the explicit
  root. Three project roots remain pairwise non-overlapping, five input-document
  roles reject all 10 case-only aliases, and template/write conflicts fail
  closed without adding a control-file-under-write restriction.
- The complete suite is 225/225: the M1-003 suite contributes 79 test nodes and
  60 focused rejection mutations, bringing the repository total to 195 focused
  rejection mutations.
- The identical 225-test suite passed on Node.js 22.23.1 and Node.js 24.14.0.
  Cross-platform OS evidence, including Windows filesystem edge cases, remains
  M3-004B.
- The bounded independent review found one input-document case-alias gap. The
  implementation and all 10 role-pair mutations were added; the closing review
  reported no remaining blocker.
- Working-tree and staged forbidden-material, exact provenance, support-matrix,
  and versioned-contract gates passed. `supportClaimsEnabled` remains false;
  no file input, inspector, secure ingestion, capability, render, or QA support
  is claimed.

### M1-004 completion evidence — 2026-08-01

- `packages/core/src/template-inspector.mjs` accepts an explicit frozen
  `ProjectContext`, a bounded already-parsed `TemplatePackageView`, and an
  injected exact `TemplateIndex 0.1.0` validator. It performs no filesystem,
  archive, XML, cwd, environment, or Git discovery.
- The reviewed public-fixture producer emits archive-bound package views and
  fingerprints its normalized OOXML structure. Unmodeled attributes, children,
  transitions, timing, extension lists, ambiguous shapes, and unsupported
  relationships fail closed before an index is returned.
- POTX output exactly matches the committed path/text-redacted execution golden;
  PPTX differs only in format and exact archive SHA-256. Ordinal master, layout,
  slide, and shape keys preserve source owner/z-order without using names or
  fixture IDs.
- `npm test`: 344/344 passed. The M1-004 suite contributes 119 test nodes and 94
  focused rejection mutations, bringing the repository total to 289 focused
  rejection mutations.
- The identical 344-test suite passed on Node.js 22.23.1 and Node.js 24.14.0.
  Cross-platform OS evidence remains M3-004B.
- At M1-004 the clean-install exit criterion was evidenced only by a
  clean-directory module-closure smoke from an unrelated cwd. M3-003 has since
  added literal four-tarball installation evidence; publication remains
  blocked because the private workspace is not a public release source.
- The bounded independent review found three blockers: unmodeled OOXML could be
  omitted, caller views were copied before bounds, and slide-size extra fields
  were lost. Structural fingerprinting, bounded normalization, and exact
  `{cx, cy}` validation closed all three; re-review found no remaining blocker.
- Working-tree and staged forbidden-material, exact provenance, support-matrix,
  and versioned-contract gates passed. `supportClaimsEnabled` remains false;
  no PPTX/POTX file input, secure ingestion, capability, render, or QA support
  is claimed.

### M1-005 completion evidence — 2026-08-01

- `inspectTemplateSource` accepts only a frozen `ProjectContext` plus the exact
  `TemplateIndex` validator. It reads one identity-checked, size-bounded file
  snapshot and binds both parsing and the emitted archive digest to those same
  detached bytes.
- The dependency-free ingestion path enforces fixed ZIP, XML, OPC,
  relationship, PresentationML, and package-wide limits. It never extracts
  members and rejects traversal, symlink components, bombs, duplicate/case
  aliases, ambiguous records, malformed or unmodeled XML, external targets,
  macros, ActiveX, OLE, and embedded packages/objects.
- `npm test`: 422/422 passed. The M1-005 suite contributes 78 test nodes,
  including exact stored/DEFLATE POTX/PPTX results and adversarial filesystem,
  ZIP, XML, namespace, graph, high-risk, redaction, and dependency-boundary
  cases.
- The identical 422-test suite passed on Node.js 22.23.1 and Node.js 24.14.0.
  Cross-platform OS evidence, including Windows junction/reparse behavior,
  remains M3-004B.
- The bounded independent closing review's blocker and two high findings were
  fixed: content-type entries now reject hidden children, package views and
  digests derive from one snapshot, and regression coverage exercises both.
  Re-review found no remaining blocker or high finding. The portable Node
  descriptor-relative-walk/TOCTOU residual remains explicitly documented.
- Working-tree and staged forbidden-material, exact provenance, support-matrix,
  and versioned-contract gates passed. `supportClaimsEnabled` remains false;
  every support row remains non-supported, so this security baseline is not an
  arbitrary-template compatibility or capability claim.

## M2 — Generic rendering vertical slice

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| M2-001 | DONE | Define the executable capability interface and dispatcher. | `supported` cannot be registered without executor, schemas, conformance fixture, and QA contract. |
| M2-002 | DONE | Implement data-driven source-slide clone/fill with semantic shape bindings. | No fixture-specific slide/shape identifiers exist in source; missing or ambiguous bindings fail closed. |
| M2-003 | DONE | Implement a minimal native DrawingML component capability. | One data-only slide spec emits a strict native non-raster group exemplar through the same dispatcher; the result is explicitly non-insertable until M2-005 proves target application and PowerPoint editability. |
| M2-004 | DONE | Parameterize the optional Pandoc/OMML adapter and isolate it from core. | Pandoc is detected as an external optional dependency; formula transplant and failure behavior have conformance tests and attribution review. |
| M2-005 | DONE | Implement create-only assembly, composition planning, normalization, semantic diff, and collateral-mutation checks. | The source is unchanged; a digest-bound IR/plan covers same-slide constraints; candidates are atomically written; allowed/forbidden changes and delivery receipts are machine-verifiable. |

### M2-005 completion evidence — 2026-08-11

- The bounded `M2-005A` backend consumes one frozen public synthetic
  clone/fill plan, rebuilds two text targets, converts POTX to PPTX, proves the
  exact two-part allowed diff, emits a deterministic archive, re-ingests it,
  and publishes create-only through same-directory staging. It re-derives the
  admitted one-master/one-layout/one-slide and source-order shape facts, and
  enforces archive limits before copying. It is not the complete M2-005 exit
  criterion.
- A commit-pinned implementation audit of eight maintained public projects
  corrected the sequence: broad writer coverage is held until an explicit
  audience-goal/takeaway/evidence brief can be matched to a template-derived
  semantic layout profile and compared through real renders.
- `labs/layout-selection/layout-selector.mjs` is the first non-authorizing
  prototype. It rejects missing evidence/assets and semantic/per-kind capacity
  misses, bounds input and search work, and ranks only completely searched
  layouts by an explainable lexicographic tuple. Fourteen focused tests cover
  exact-over-wildcard choice, asset/capacity/resource failures, deterministic
  ordering, and non-mutation.
- `labs/layout-selection/reviewed-clone-fill-catalog.mjs` now binds reviewed
  two-slot semantic profiles to exact public synthetic shape/geometry facts and
  performs selection plus assembly atomically so no detached plan can be paired
  with another same-ID index. Eight focused tests cover identity/key swaps,
  final metric capacity, accessors, immutability, selection, and real assembly.
- `labs/layout-selection/reviewed-profile-induction.mjs` now derives redacted,
  hash-bound proposals from three distinct runtime-generated synthetic source
  exemplars, keeps inferred salience separate from a frozen accepted/rejected
  review fixture, and selects the exact winning source before atomic assembly.
  The review accepts clear 44/20 pt decision and 48/24 pt status hierarchies,
  rejects an equal 28/28 pt hierarchy, and enforces one takeaway, one evidence
  unit, 24/18 pt minimums, capacity ceilings, exact source/index binding,
  pre-copy archive limits, and bounded index capture. Ten focused tests pass.
- The first exact-fit versus generic-control render comparison is complete.
  Three isolated reviewers agreed the action-first exact candidate better serves
  the approval goal; one run also flagged incomplete decision evidence and small
  supporting type. The aggregate comparative verdict is `pass`, while that
  dissent remains a required input-quality improvement.
- The visual-review lab now fully validates its closed report boundary and
  executes three-run aggregation. Ordinary findings require 2-of-3 support and
  every blocker requires an explicit context- and crop-bound confirmation or
  dismissal before a final verdict; thirteen focused tests pass.
- Two additional 1600 × 902 renders prove that the reviewed multi-exemplar
  selector chooses different authentic hierarchies for decision and status
  briefs. Three isolated reviewers marked both outcomes met; the aggregator
  passed, and a contradictory one-run composition minor was dismissed by a
  bounded pixel-location follow-up. No binary or raw report is committed.
- The bounded ordered-story slice now captures one reviewed acceptance and
  exemplar set for a complete `setup → evidence → resolution` batch, selects
  three authentic source hierarchies, authenticates each one-slide report
  against its exact bytes, and deterministically rebuilds slide parts,
  presentation IDs, owner references, and the exact reachable relationship
  closure. Orphan content parts and partial-batch output fail closed; 14/14
  ordered-story tests pass.
- The initial three-slide render was structurally clean, but one independent
  run correctly found that the consensus and readiness evidence were generic.
  The repaired brief names the review criteria and remaining checks. Three fresh
  1600 × 902 reviews judged the goal met with no finding, and the executable
  aggregate returned `pass`; see `docs/M2-005_ORDERED_STORY_DECK.md`.
- A second primary-source and public-example review corrected the sequence again:
  deterministic brief-to-layout matching is necessary but not fundamental.
  Before layout, the system needs a frozen deck hypothesis joining one audience
  change, a causal narrative, a subject-derived visual language, and a delivery-
  aware rhythm plan. Reviewer `0.1.0` validates hygiene and basic goal
  alignment but is not used for subject specificity, genericity, motif
  coherence, silhouette repetition, deck rhythm, or opening/closing payoff.
  See `docs/PRESENTATION_DESIGN_PLANNING_REVIEW.md`.
- Its bounded challenge found one blocker, four high, and two medium gaps. All
  were corrected through an executable raw-input planning path, blind outcome
  probe, controlled comparison matrix, template precedence, non-votable
  required items, fixed evidence pins, and D-023 governance; stable-snapshot
  closure found no remaining blocker, high, or medium issue.
- P1 complete: `labs/design-planning/deck-planner.mjs` consumes only the fixed
  raw brief, evidence inventory, and explicit template profile; produces three
  complete communication/narrative/slide/visual/rhythm hypotheses; validates
  exact input coverage, leave-one-node-out argument failure, template
  precedence, and capacity; returns a
  comparative recommendation that cannot self-authorize; and requires a
  complete external selection record plus a fixed-registry match for the full
  reviewed approval record before a module-private receipt token reaches
  reviewed layout selection and
  ordered PPTX assembly. Planning template data is bound to the actual proposal
  set and layout acceptance, and a final assembly receipt joins the planning,
  story, layout, and PPTX hashes. The committed hidden outcome key is hash-bound
  to the same raw input but is not read by the planner. Fifteen focused positive
  and adversarial tests pass.
- P2 complete: reviewer `0.2.0` freezes three contract-blind reconstructions and
  three label-blind whole-deck reports under one opaque session only after a
  fixed reviewed manifest has bound the assembly, render set, contact sheet,
  required-item source/crop evidence, and whole-deck crop registry. It then reveals the
  fixed P1 outcome manifest, makes every required item non-votable through exact
  blind-slot references and source/crop-bound reconciliation, and independently
  aggregates a label-blind nine-dimension contact-sheet review. Delivery
  profiles distinguish live-room, leave-behind, and hybrid use; code owns
  severity floors, `refine`/`replan`/`pivot`, blocker follow-up, and verdicts.
  Eleven clean-room text calibrations include restrained/decoration/subject-
  encoding, broken-sequence, same-visual delivery, unusable/not-visible,
  non-matched required-item, blocker/unable, and random-silhouette controls.
  Twenty-three focused tests cover schema/prompt leakage, one-shot same-session authority,
  exact P1/blind-slot/source/crop bindings, required-item disagreements,
  failure precedence, whole-deck spatial/slide consensus, caller crop rejection,
  Proxy/region rejection, and core/support isolation. The complete 842-test
  repository suite passes. A simulated dismissal cannot authorize pass.
  The bounded closing recheck found no remaining blocker, high, or medium.
  Evidence scope remains `simulated-review-only`.
- P3 complete for the bounded public-synthetic experiment:
  `labs/design-planning/controlled-comparison.mjs` derives an exact 2 × 3
  sequence/visual matrix from one authenticated P1 selection and exposes
  twelve byte-identical live/leave delivery review cells with randomized opaque
  labels and reviewer order. The create-only render harness emits all six decks,
  eighteen one-slide renders, and six complete contact sheets as one batch,
  publishes its manifest last, and rejects partial, extra, stale, swapped, or
  tampered reuse. Exact inventory is checked before first manifest publication
  as well as on reuse.
- The final comparison holds all three visible text nodes identical across each
  visual triplet and compares causal `evidence → boundary → decision` order
  with a fixed action-before-boundary permutation. Three isolated blind reviews,
  after exact-image reconciliation of two retracted pixel-reading mistakes,
  ranked the three causal arms above all three permutations. The subject-
  grounded causal arm ranked first live in all three reviews and first, first,
  and second for leave-behind. The stylized control remained competitive for
  reader use, so the result is not generalized into “decoration is always bad.”
- The repaired 1600 × 902 run is bound by matrix receipt
  `65009c3b41bc1678bd7bc36ebfab3ec8b93524e99fecea2041995398eb58c490`,
  render manifest
  `e11ab84da264763899d8526bef3ed3383e174867492c35fa57f12a85347c1d10`,
  render set
  `f6c3e9b8a55ef8544b858661ff8d1ca034d1969ea6c1a48581060943c452d867`,
  and contact-sheet set
  `1e7bc1e52b3f86948baa267aa01bece147b1ce8cfe8eb513bc9d29c5afa4d7f7`.
  Stable reuse revalidated all artifacts without invoking the renderer.
- Seventeen focused and 859 complete tests pass. Generated decks, pixels, and raw
  reviews remain ignored local evidence. Results are `simulated-review-only`;
  they do not prove actual audience effect, arbitrary-template quality,
  PowerPoint editability, or product support.
- The first `M2-005C` native-target application sub-slice is executable.
  One authentic M2-005A artifact and one opaque single-invocation dispatcher
  plan are consumed inside core; only the schema/QA-validated typed component
  data is used. The applicator revalidates the exact source slide and direct
  anchor, checks actual-slide containment, scans root and nested object IDs,
  allocates `4/5/6` on the public synthetic target, rebuilds the fixed native
  group, and proves that only `ppt/slides/slide1.xml` changed. Twenty-four
  focused tests cover determinism, plan replay, artifact forgery/tamper,
  target mismatch, canvas overflow, schema/QA drift, complete UInt32 ID
  allocation/rejection, closed inputs, and the plugin/lab/fragment boundary.
  At that boundary the complete repository suite passed 883/883. The bounded independent review's
  one medium pre-limit byte-copy finding is fixed and regression-tested; closure
  found no remaining blocker, high, or medium finding.
- The authenticated native-output publication/ordered seam is now executable.
  A private report registry binds the exact generated bytes to the authentic
  M2-005A base. Ordered assembly accepts only authentic clone-fill or native
  artifacts, copies native slide bytes exactly, and runs the unchanged generic
  package/relationship verifier against an in-memory shadow that substitutes
  only the authentic base slide for each native slide. Direct native and native-
  containing ordered artifacts can use the separate create-only authenticated
  publisher; its artifact snapshot precedes I/O and its staging/hard-link/no-
  overwrite rules are covered. Native at the first, middle, and last ordered
  position plus all-native ordering are exercised.
- The direct native report remains `publicationEligible: false` because the
  generic raw-byte publisher still rejects group shapes. Caller-set labels do
  not authorize the private bridge, clone-only ordered output does not enter it,
  and the generic package view/publisher are unchanged. Thirty-six focused and
  895 complete tests pass. The bridge review's one high hash-before-copy TOCTOU
  is fixed with copy-then-hash private snapshots and direct/ordered
  SharedArrayBuffer regressions; targeted closure found no remaining blocker,
  high, or medium finding.
- The overlap/refactor closure replaces product-level handwritten x/y with a
  semantic `slotRef + placementIntent + preferredSize` request. A persisted
  `SlideLayoutIR` keeps slot bounds, padding, alignment, size clamps, paint
  outset, z-order, and constraints; a digest-bound `ComposedSlidePlan` keeps
  frozen geometry and deterministic containment/slot/occupancy receipts. The
  old overlapping fixture now fails, impossible capacity and executor geometry
  drift fail closed, and the raw-coordinate applicator remains a low-level
  compatibility entry point behind the same occupancy gate.
- The authenticated file writer now has an explicit `candidate-pptx` result
  with `deliveryEligible: false`. The publication-named 0.x API remains a
  compatibility alias and does not become final delivery authority. One exact
  repaired public-synthetic candidate passed Quick Look render, an independent
  pixel-only review, PowerPoint 16.111.3 group edit/save/reopen and child
  editability, strict post-save package inspection, a new render, and a second
  independent pixel-only review. Binary/pixel/automation/raw-review evidence is
  local and ignored. Eight layout tests, forty native tests, and 918 complete
  tests pass.
- The bounded closing review's JSON-key-order and live/revoked-Proxy array
  findings were fixed with normalized comparisons, one descriptor snapshot,
  one exception boundary, and regressions. Final re-review found no remaining
  blocker, high, or medium issue.
- The typed OMML target is now executable through the same durable layout and
  candidate path. It strict-parses the canonical unbound `m:oMath`, validates a
  target-specific 64-element/16-run/256-byte capacity, rebuilds typed nodes with
  fixed math run properties inside the authenticated text target, and proves
  that only `ppt/slides/slide1.xml` changed. The assembly report retains the
  complete `SlideLayoutIR`, frozen `ComposedSlidePlan`, formula digest, target
  capacity, exact diff, and artifact digest; the candidate writer still returns
  `deliveryEligible: false`.
- PowerPoint 16.111.3 opened, saved a shape-name edit, closed, and reopened the
  exact candidate without repair. Its saved file retained native OMML and added
  a PowerPoint-authored PNG fallback. The extracted fallback was unclipped and
  a pixel-only composite review passed, but this is not a direct PowerPoint
  screenshot or a human formula-content edit. D-032 later passes a separate
  mixed-candidate feature observation; the direct candidate still lacks its
  operation-bound receipt.
- Eleven OMML tests and the 67-test create-only/native/layout/OMML focus pass.
  The bounded review's high shared-memory base-snapshot race and medium reserved-
  root slot-containment bypass were fixed by copy-before-hash authentication,
  rejecting `slide-canvas` as a node/slot ID, and requiring one slot check per
  bounded placement. Final re-review found no remaining blocker, high, or
  medium issue; the complete repository suite passes 930/930.
- The normative direct-candidate bundle is now executable. The additive
  `CandidateBuildRecord 0.1.0` root schema, fixture, generated types, canonical
  serializer, and replay validator preserve the exact bounded-slot IR, frozen
  plan/receipt, diff, capability evidence, authentic base digest, and candidate
  basename/length/SHA-256. Source profile/evidence/diff/component identity is a
  discriminated tuple in both schema and runtime; candidate and record limits
  run before copying. The writer captures one artifact snapshot, stages and
  file-flushes both files, publishes the record first and PPTX logical commit
  marker last, and never deletes a record unless candidate removal is confirmed.
  POSIX additionally requests the ordered parent-directory fsync barriers. The
  old PPTX-only and publication-named APIs remain compatible.
- Three record-unit tests plus direct native and OMML bundle regressions pass
  in the complete 942/942 suite. The bounded review closed cross-pair Proxy,
  source/profile/evidence/capability drift, Unicode/component filename,
  pre-copy resource, directory-barrier, and rollback-order/failure gaps;
  final review found no remaining blocker, high, or medium issue.
- Fixed-absolute and ordered artifacts fail closed at this record-backed bundle
  boundary of the direct writer. The separate ordered bundle path now records
  complete generic and semantic-card decks: exact order and OOXML allocation,
  base/per-slide source hashes, deck diff, candidate identity, and every native
  slide's full IR/plan/source evidence. Its discriminated per-slide source build
  is the single classification authority; redundant native flags/counts and
  ordered source-profile labels are omitted. Raw-coordinate native slides still
  fail before staging. The focused closure passes 166/166 and the complete suite
  passes 945/945. The bounded D-028 review's one medium schema/runtime
  classification drift was closed by that data-model simplification; re-review
  found no blocker, high, or medium issue. This is not completed M2-005 or a
  support claim. D-029 now fixes the authority map: the source template owns
  unchanged inherited content/structure; raw brief/evidence/DeckSpec own
  authored semantics, `SlideLayoutIR` owns editable constraints,
  `ComposedSlidePlan` owns calculated geometry, and hashes bind exact boundary
  objects only. No `GenerationIntent`, formula AST, or extra delivery root will
  be added. The direct single-slide semantic-card final slice now reuses
  `QaReport`/`BuildArtifact`, but only after re-deriving the source index and
  overlay anchor, then using generation's shared pure slot calculation to
  re-derive and exact-compare the complete IR/plan from source shapes, canvas,
  and DeckSpec. It deterministically reconstructs the exact source + DeckSpec +
  composed-plan archive. This rejects record-based native relabeling, false but
  replay-valid constraint records, and every collateral part change before
  authenticated calculation/render/pixel/compatibility receipts are consulted.
  It publishes `BuildArtifact` last, rolls back a pre-commit cancellation, and
  reports post-marker failure as commit-uncertain; the final focus passes 23/23
  and the complete suite passes 968/968, including semantic/index/binding drift,
  resource ceilings, caller-owned and SharedArrayBuffer-backed snapshot
  mutation. Closing independent re-review found no remaining blocker, high, or
  medium issue.
- Typed-OMML ordered candidate coverage now reuses the same authenticated
  target-specific native profile table as semantic cards. It copies the exact
  authentic formula slide at the requested first or last position, verifies the
  complete package through the separately authenticated M2-005A shadow, and
  records the exact OMML source tuple, full IR/plan/receipt, one-slide diff,
  formula digest, target capacity, and observed facts in the existing per-slide
  `sourceBuild` union. No deck-level native/OMML classifier or new root contract
  was added. Three new public tests bring the focused closure to 201/201 and the
  complete suite to 971/971; bounded independent review found no blocker, high,
  or medium issue. Broader delivery fault coverage, every ordered or OMML final-
  delivery path, the manual formula-content edit, and broader compatibility
  evidence remain open.
  The global support claim switch remains false.
- Direct typed-OMML receipt-bound preparation now regenerates from the admitted
  source template plus exact readable registry/overlay/index/DeckSpec facts. It
  does not use the clone/fill compatibility artifact as semantic authority:
  unchanged inherited title/package content remains source-owned, while the
  DeckSpec LaTeX is executed through a fresh one-shot dispatch and the complete
  candidate bytes, IR, plan, diff, digest, and target evidence must match the
  reviewed record. Undeclared clone/fill content and LaTeX drift fail before
  receipt authentication, while a no-op compatibility path that produces the
  identical readable result remains accepted. The compatibility receipt is operation-bound to
  `formula-content-edit-save-reopen`; a shape-name edit is rejected. The old
  synchronous native-card API remains compatible. Fifteen OMML assembly tests,
  twenty-three native-card final tests, six OMML-final tests, and the complete
  978/978 suite pass. One bounded independent review's call-history ambiguity
  was resolved by that convergence contract and regression; re-review found no
  blocker, high, or medium issue. This implements the gated path only: the exact
  direct-candidate formula-content receipt, real-Pandoc evidence, mixed
  arrangements beyond the fixed bounded story, broader templates, and support
  promotion remain open; D-032's feature-level `COMPAT-OMML-001` pass does not
  authorize this path;
  `supportClaimsEnabled` remains false.
- Clone/fill-only ordered receipt-bound preparation now captures one complete
  2–11 slide same-template `DeckSpec`, executes the batch once, regenerates
  every one-slide artifact from source/index facts, and reuses the unchanged
  ordered assembler before exact candidate/record comparison. Mechanical and
  render evidence must cover every slide in order, compatibility must name
  `ordered-deck-open-save-reopen`, and the existing publisher still links
  `BuildArtifact` last. DeckSpec content/order drift, target-specific native
  source builds, incomplete or purpose-confused evidence, and post-await caller
  mutation fail closed. At that implementation boundary, eleven focused tests
  brought the combined final focus to 55/55 and the complete suite to 990/990.
  Eleven slides are the executable
  maximum under the unchanged 32-entry secure-ZIP profile; 12 fail before
  dispatch or artifact inspection. One fixed two-slide public-synthetic
  candidate now has an actual trusted local PowerPoint 16.111.3
  `ordered-deck-open-save-reopen` receipt: exact readable slide order/text
  survived save/reopen, the source stayed unchanged, corresponding 1600 × 900
  PowerPoint-rendered pages were byte-identical, and one independent pixel-only
  review passed with no finding. The adapter requires explicit local trust,
  refuses CI and pre-open user presentations, and keeps all raw evidence
  ignored. Eight focused adapter tests and the complete 998/998 suite pass. This
  does not prove the full 2–11 range, broader template grammar, or support;
  `supportClaimsEnabled` remains false.
- The fixed three-slide mixed ordered path is now receipt-bound end to end at
  the implementation boundary. It snapshots one complete readable project
  tuple, preflights `clone/fill → typed OMML → native card-arrow` as one batch,
  regenerates all three authentic source slides and their complete replay
  records, exact-compares the whole candidate before evidence, and publishes
  through the existing `QaReport`/`BuildArtifact` boundary. Role swaps, story or
  LaTeX drift, late preflight failure, incomplete slide receipts, purpose drift,
  and post-await caller mutation fail closed.
- The same exact mixed public-synthetic candidate passed PowerPoint 16.111.3
  open/save/reopen. Compatibility hardening uses
  `mc:AlternateContent` with a native `a14:m → m:oMathPara → m:oMath` choice and
  editable linear-text fallback, never a generator-authored raster. The
  fraction is 48 pt in an expanded semantic slot; all three 1600 × 900
  before/after page pairs are byte-identical and the frozen pixel review passes
  with no finding. One initial missing-text blocker was disproved by exact-byte
  equality and exact-path replay; the reviewer reproduced an unstable image
  display and withdrew it. Both visual-review prompts now require reopening
  alleged blank/missing renders, and deterministic orchestration owns exact
  image equality through a bounded `prepareVisualEvidencePlan` that collapses
  equal pairs before model review and retains both sides only when bytes differ.
- The trusted local adapter now reuses one ignored PowerPoint carrier file in
  the existing evidence directory, preserving device/inode identity while
  replacing and verifying exact bytes. This avoids repeated macOS consent
  without weakening product rules: the transport is ignored/manual and
  deliberately outside the create-only publication boundary. The deterministic
  visual-evidence admission boundary rejects forged
  typed-array/backing metadata, shared/resizable buffers, and oversized input
  before its immediate copy; the closing re-review found no blocker, high, or
  medium issue.
- D-031 closes the complete same-candidate mechanical/render/pixel/
  compatibility/QA/`BuildArtifact` chain for that exact fixed mixed candidate.
  Public manifest/inspection APIs return only frozen non-authorizing facts;
  the fixed trusted-local CLI alone rerasterizes captured PDF snapshots with
  explicit Poppler tools, exact page counts, same-handle bounded reads, and
  byte-equal PNG checks before its private one-shot receipts reach the existing
  `BuildArtifact`-last publisher. The first review's blocker, high, and medium
  are all closed; final re-review reports 0/0/0, and the complete suite passes
  1032/1032. Human formula-content editing, broader fault/template/platform
  evidence, public CI, and every support claim remain open;
  `supportClaimsEnabled` is false.
- D-032 separates the fixed mixed-candidate formula-edit observation from both
  machine proof and delivery authority. The public inspector reports only the
  readable `3/3 -> 2/3` relation and narrow namespace counts; the fixed local
  recorder pins candidate `ccbffcb1…2802`, record `5a88c576…15c1`, and edited
  derivative `2592ad9d…8d3`, then stores human statements separately under
  `operatorAttestation`. Twelve focused tests reject alternate candidates,
  collateral/unknown-part changes, unknown OMML vocabulary, record drift, and
  hostile byte containers. The complete suite passes 1044/1044; final re-review
  reports 0 blocker and 0 high, with one accepted non-authorizing local pathname
  race residual. The operator explicitly confirmed that opening and reopening
  produced no repair or conversion prompt, and the fixed local feature record
  passed. It cannot satisfy the direct single-slide exact-candidate receipt or
  enable support.
- The actual fixed mixed final-delivery profile now has direct publication-fault
  coverage through the unchanged shared publisher. Pre-commit cancellation
  removes every owned file and the reserved directory with
  `rollbackStatus: complete`; a failure immediately after the `BuildArtifact`
  link reports `commit-uncertain`, performs no destructive rollback, and leaves
  all four committed files available for reconciliation. The focused mixed
  suite passes 13/13 and the complete repository suite passes 1046/1046; no
  profile-specific publication implementation was added.
- D-033 closes M2-005 at the smallest complete product boundary: the exact
  fixed public-synthetic mixed vertical slice. One readable
  `setup -> evidence -> resolution` DeckSpec regenerates clone/fill, typed OMML,
  and native-card slides through authenticated source/index/IR/plan facts; the
  same candidate passes complete diff, rendering, independent pixel review,
  ordered PowerPoint compatibility, QaReport, BuildArtifact-last publication,
  source immutability, and both commit fault states. The exact direct single-
  slide OMML receipt and generalized target-specific native/OMML ordering remain
  unavailable follow-on capabilities, not blockers for assembly completion.
  Release and support remain separate; `supportClaimsEnabled` is false. The
  bounded milestone exit review found 0 blocker, 0 high, and 0 medium.

### M2-001 completion evidence — 2026-08-02

- `createCapabilityRuntime` atomically binds exact metadata, executor,
  input/output schema documents and validators, nonempty conformance fixtures,
  QA assertions, and support decisions. Metadata-only definitions stay known
  but unavailable; registry URNs never load code.
- `prepareCapabilityDispatch` validates and preflights the complete detached,
  frozen, bounded batch before any executor runs. `executeCapabilityDispatch`
  authenticates and consumes an opaque plan before its first `await`, preserves
  order, and validates every bounded output and QA assertion.
- The repository-owned `dispatcher-contract-probe` is data-only,
  conformance-only, absent from product capability rows, and has no filesystem,
  network, process, dynamic-loader, presentation, or mutation authority.
- `npm test`: 507/507 passed. The dispatcher suite contributes 85 nodes; the
  dispatcher plus support-matrix suites also pass 99/99 under
  `--unhandled-rejections=strict`.
- The identical 507-test suite passed on the checksum-verified official Node.js
  22.23.1 and Node.js 24.14.0 releases. Cross-platform OS evidence remains
  M3-004B.
- The bounded independent review found one blocker, two high findings, and one
  provenance medium. Internal registration captures now close the async
  mutation race; aggregate node/string/key budgets reject during traversal;
  rejected Promises from sync-only callbacks are consumed before redacted
  failure; and all modified provenance records were refreshed. Re-review found
  no remaining blocker or high finding.
- Working-tree and staged forbidden-material, exact-provenance, support-matrix,
  and versioned-contract gates passed, as did `git diff --cached --check`.
- `supportClaimsEnabled` remains false and all 60 support rows remain
  non-supported. Complete registration is necessary for dispatchability, not a
  renderer, staging/publication guarantee, product capability, or support claim.

### M2-002 completion evidence — 2026-08-03

- `assertCapabilityRuntimeRegistry` compares a bounded detached caller registry
  with the exact registry privately captured by the authentic runtime, rejecting
  same-ID/version content substitution.
- `prepareResolvedDeckDispatch` snapshots and freezes all four documents before
  any validator callback, resolves the complete overlay/index/deck graph with
  exact identity, uniqueness, ordering, role, kind, cardinality, and target
  checks, then returns only an opaque M2-001 plan. A bad later slide causes zero
  product preflight or execution calls.
- The repository-owned `source-slide-clone-fill` artifact set has exact metadata,
  input/output schemas, two text-only conformance cases, a no-I/O executor, and
  four ordered QA assertions. It produces only a deterministic clone/fill JSON
  operation plan from semantic bindings; product dispatch remains unavailable.
- Snapshotters apply O(1) code-unit ceilings before bounded UTF-8 encoding.
  Input schema, preflight, and output schema consistently reject blank/control,
  format-character, unpaired-surrogate, and Unicode-noncharacter text while
  accepting valid astral scalars.
- `npm test`: 564/564 passed. The M2-002 suite contributes 56 nodes; the
  resolver/dispatcher/support focus passes 156/156.
- The identical 564-test suite passed on checksum-verified official Node.js
  22.23.1 and Node.js 24.14.0 releases. Cross-platform OS evidence remains
  M3-004B.
- The bounded independent review found a missing-provenance blocker, one
  pre-encoding resource high finding, and Unicode/schema plus stale-document
  lower-severity findings. All were fixed and regression-tested; final re-review
  found no remaining code blocker or high finding.
- Working-tree and staged forbidden-material, exact-provenance, support-matrix,
  and versioned-contract gates passed, as did `git diff --cached --check`.
- `supportClaimsEnabled` remains false and all 60 support rows remain
  non-supported. This is not OOXML mutation, rendering, editability,
  source-isolation, collateral-diff, staging, or publication evidence.

### M2-003 completion evidence — 2026-08-03

- `native-card-arrow@0.1.0` supplies exact metadata, closed input/output
  schemas, two repository-owned text conformance cases, a no-I/O executor, and
  four ordered QA assertions through the existing resolver and dispatcher.
- The executor builds a closed typed tree and canonically serializes one
  allowlisted native `p:grpSp` containing a text-bearing `roundRect` plus a
  `rightArrow`. Strict parsing and exact vocabulary, namespace, structure,
  count, transform, text, color, preset-geometry, and no-relationship/no-raster
  assertions fail closed.
- The result is explicitly an `unbound-drawingml-conformance-fragment` with
  `insertable: false`, component-local IDs `1/2/3`, and
  `local-remap-required`. M2-005 must rebuild from typed data, allocate safe
  target-slide IDs, validate containment, apply in create-only staging, and
  prove PowerPoint editability; raw fragment concatenation is forbidden.
- The exact `native-drawingml` row is experimental and requires explicit
  opt-in plus automated public evidence for all executable artifacts. The
  global claim switch remains false, no row is supported, and broad DrawingML,
  slide text, every input class, clone/fill, package output, staging,
  publication, and PowerPoint editability remain unsupported.
- `npm test`: 623/623 passed. The native-component suite contributes 57 nodes;
  the resolver/dispatcher/clone-fill/support focus passes 215/215, including
  native structure, safe Unicode/XML escaping, resource limits, batch
  atomicity, semantic-key independence, fixture neutrality, no-I/O closure,
  support overclaim, and QA/output drift cases.
- The identical 623-test suite passed on checksum-verified official Node.js
  22.23.1 and Node.js 24.14.0 releases. Cross-platform OS evidence remains
  M3-004B.
- The bounded independent review found one contract-boundary mismatch: the old
  exit criterion implied insertion-ready PowerPoint editability. D-022, this
  criterion, the handoff, and support documents now consistently limit M2-003
  to the strict native non-raster exemplar and assign application/editability
  evidence to M2-005; no implementation blocker or high finding remained.
- Working-tree and staged forbidden-material, exact-provenance, support-matrix,
  and versioned-contract gates passed, as did `git diff --cached --check`.

### M2-004 completion evidence — 2026-08-05

- `adapter-pandoc-omml@0.1.0` is core-isolated: only its Node runner imports
  `node:child_process`, requires trusted absolute process/cwd configuration,
  uses no shell or ambient discovery, and enforces fixed argv, an explicit
  bounded environment, stdin/output limits, timeout, and stable redacted
  outcomes.
- Pandoc `>=2.15.0 <4.0.0` is only an eligibility window. Version, sandboxed
  JSON-API, and exact fraction-to-DOCX/OMML probes must pass before the static
  formula executor can be registered; missing, warning-producing, failed, or
  drifting tools remain unavailable with no fallback.
- `formula-transplant@0.1.0` has exact metadata, closed schemas, one text-only
  conformance case, a real semantic text-box binding, an adapter-injected
  executor, and four ordered QA assertions through the existing resolver and
  dispatcher. It emits only an unbound canonical `m:oMath` plan with
  `insertable: false` and `typed-rebuild-required`.
- Public tests use a fake process runner and runtime-built text-derived DOCX.
  The 115-node focused suite covers fixed JSON-AST transport, absence/error and
  stream handling, formula bounds, batch atomicity, exact content-type and
  source/type/target relationship profiles, secure ZIP/XML, typed OMML
  topology, schemas/QA, determinism, no-I/O direction, and clean closure. The
  strict dispatcher/resolver/native/formula/support focus passes 330/330.
- The complete 738-test suite passed on checksum-verified official Node.js
  22.23.1 and Node.js 24.14.0. Cross-platform OS and real compatible-Pandoc
  evidence remain M3-004B or a later compatibility gate.
- D-008 and `docs/PANDOC_ADAPTER_ATTRIBUTION.md` record fixed official Pandoc
  3.10.1 behavior/license sources, external-only GPL-2.0-or-later separation,
  warning-to-text fallback, non-insertable PPTX wrapper boundary, and no blanket
  generated-output ownership claim. No Pandoc code, binary, template, output,
  or upstream-derived fixture is tracked.
- The bounded closing review found one high relationship-prefix bypass and one
  medium content-type overbreadth. Exact mappings plus 10 regression subtests
  closed both; the bounded re-review found no remaining blocker or high issue.
- Working-tree and staged forbidden-material, exact-provenance, support-matrix,
  and versioned-contract gates passed, as did `git diff --cached --check`.
  `formula-transplant`, `latex-formula`, and `native-omml` remain
  `unsupported/unavailable`; `supportClaimsEnabled` remains false and no row is
  supported.

## M3 — CLI, packaging, and public QA

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| M3-001 | DONE | Complete one candidate-alpha spine: public-synthetic bootstrap -> inspect -> whole-project validate -> candidate-only render -> honest QA. Auxiliary command breadth does not block alpha. | One installed, explicit-root project reaches CandidateBuildRecord-bound PPTX output through normative support/preflight; incomplete evidence yields a schema-valid blocked QaReport and no BuildArtifact. |
| M3-002 | DONE | Define explicit publishable packages and decide scoped versus unscoped npm names after the installed spine is stable. | Each package has positive `files`, `exports`, `types`, `bin` where applicable, license, engines, and staged metadata; D-045 now binds the exact repository tuple while npm publication remains blocked. |
| M3-003 | DONE | Add repository and npm leakage gates. | Tarball is at most 5 MiB compressed/20 MiB unpacked, at most 300 files/1 MiB each, matches an allowlist, contains no forbidden magic/extensions, and installs in an empty directory. |
| M3-004A | DONE | Define and locally verify the public-safe CI/security, development-toolchain, source-policy, license, and static-ESM SBOM projection contracts. | Two canonical workflows and all local gates pass under admitted Node 22/24 in one fixed non-FileProvider copy without model/GUI/private inputs. |
| M3-004B | DONE | Collect the six Linux/Windows/macOS × Node 22/24 public CI cells plus CodeQL and Dependency Review evidence. | The public remote records stable URLs and conclusions for every hosted job; local YAML or macOS runs are not substitutes. |
| M3-005A | DONE | Add the minimum pre-public security, contribution, governance, and reproducibility documents. | The local documents define and mechanically verify one fail-closed repository-native private-reporting process; D-045 separately records its live remote activation. |
| M3-005B | NEXT | Construct and freeze changelog, known limitations, final support wording, and release text from public evidence. | After M3-004B, every final claim cites the matching hosted evidence and executable support state, and D-046's purpose→ownership→flow→contract→evidence→limitations→next-action structure passes cross-document review. |
| M3-006 | DONE | Create and scan the final local main commit, then push that exact object ID as the first source ref. | GitHub reports public repository ID `1330979133` for `why7682/pptx-compiler`, private vulnerability reporting `enabled: true`, and remote `main` equal to the exact scanned object ID after canonical HTTPS transport. |
| M3-007 | DEFERRED | Implement `doctor`, generic `onboard`, standalone `diff`, and optional formula CLI only from demonstrated user workflows. | Each added command has one non-duplicated data authority and executable need; generic onboarding never hard-codes capability-specific binding rules. |
| M3-008 | DEFERRED | Revisit main-branch protection after the current hosted-evidence and final-document sequence. | D-047 is explicitly resumed; force-push/deletion restrictions and required checks are configured and verified without claiming they existed earlier. |

### M3-005A completion — 2026-08-11

- `CONTRIBUTING.md`, `GOVERNANCE.md`, and `docs/REPRODUCIBILITY.md` now own the
  minimum contribution, single-maintainer, and human reproduction boundaries.
  Package scripts and the canonical workflow remain the command authority.
- `SECURITY.md` selects GitHub private vulnerability reporting as the sole
  private channel without publishing an email address. At the M3-005A
  checkpoint, activation and source publication were still future remote facts;
  D-045 and M3-006 later enabled the feature and published the exact reviewed
  first source ref.
- The forbidden-material compiler admits path exceptions only for path rules.
  Text and copyright rules have no exception representation, so SECURITY does
  not create a leakage-policy special case.
- `docs/OPEN_SOURCE_READINESS.md` is explicitly historical, and stale CLI,
  blocked-QA, formula-application, and package-name wording is corrected without
  promoting a support row.
- The document bundle test exact-compares the reproduction command projection,
  checks all four README routes and one-owner process boundaries, and rejects
  channel, privacy, placeholder, command-order, contribution, and governance
  mutations. D-042 records the definition-versus-activation boundary; M3-006
  owns the remote setting and its evidence.
- In the fixed non-FileProvider verification copy, Node 22.23.2/npm 10.9.8 and
  Node 24.19.0/npm 11.17.0 each pass the 1198-node complete suite, the 124-file
  source gate, and the real four-tarball offline install plus installed CLI
  smoke. The focused policy and document suites pass 41/41 and 14/14.
- The bounded final security, provenance, and state reviews close at 0 blocker,
  0 high, and 0 medium after making repository-bound package regeneration an
  explicit pre-first-ref M3-006 transition.

### M3-006 local first-ref preflight — 2026-08-11

- `node scripts/check-forbidden-materials.mjs --mode history` reuses the one
  forbidden-material policy and fixes `refs/heads/main` as the only candidate
  history. It reads policy bytes from that tip, follows raw commit parent/tree
  OIDs, scans reachable old tree-entry versions and commit messages,
  exact-checks author/committer occurrences against the repository-local public
  identity without printing it, and fails on shallow or overridden history.
- At that preflight checkpoint, the non-shallow 13-commit history passed with 286 unique leaf-entry
  versions, 3,677,606 regular-blob bytes, 26 identity occurrences, and zero finding.
  The broader read-only audit finds no tags, remote, replace/graft/alternate
  object source, token/credential/private-path pattern, or private fixture hash;
  `git fsck --strict` passes.
- Eight new history regressions bring the focused policy suite to 49/49: stable
  positive output, a deleted forbidden path under tip-policy authority,
  repository/common-directory and case-variant environment redirection,
  noncanonical BOM/control paths and byte-level modes, forced-error fsck
  warnings without disclosure, a
  forbidden commit message, identity drift, a deleted symlink, and a deleted
  oversized blob.
- Bounded independent closing reviews reproduced transient shallow and merge
  ancestry, Git environment selection, raw-tree bytes, local/global fsck
  downgrade, and redaction probes and close at 0 blocker, 0 high, and 0 medium.
- This was not M3-006 completion: the final repository-bound commit did not yet
  exist. D-044 subsequently closed the atomic rename and local evidence; D-045
  created the empty public shell and enabled its private reporting channel;
  M3-006 later completed the exact first-ref transition.

### M3-006 empty shell and repository binding — 2026-08-11

- GitHub reports `why7682/pptx-compiler` as public repository ID `1330979133`,
  size zero, with no Git ref. The create operation added no README, license,
  ignore template, imported history, branch, or tag.
- The private-vulnerability-reporting enable request returned HTTP 204; a later
  status request returned exact `enabled: true`.
- Package-plan schema v2 owns one exact GitHub tuple: provider, repository ID,
  owner, name, and canonical HTML URL. Leaf `repository` objects and the SBOM
  VCS reference are pure projections of that tuple; PVR state is not copied
  into package metadata.
- GitHub source authorization does not authorize npm publication. The release
  guard remains `blocked: npm-publication-not-authorized`, every leaf remains
  `private: true`, and no `publishConfig`, lifecycle script, token, or registry
  action is introduced.
- Package evidence/completion schema v2 binds the SHA-256 of the canonical
  readable package plan. This is a boundary fingerprint, not a planning model,
  and prevents pre-repository tarballs from being accepted under an unchanged
  plan ID/version/file shape.
- At the D-045 checkpoint, the repository-bound snapshot passed 1217/1217 complete tests under both
  Node 22.23.2 and Node 24.19.0. The 24-node package-stage suite passes, and
  npm 10.9.8 plus npm 11.17.0 each admit four repository-bound private
  tarballs, install them together offline, execute the installed CLI spine,
  return blocked QA, and create no BuildArtifact. M3-006 later completed the
  then-remaining final commit/history scan and exact-object-ID first push.

### M3-006 first-public-ref completion — 2026-08-12

- The reviewed first public `main` object is
  `410642b668514ab7193212d617cc0f8acb837924`.
- Its final pre-push history scan covered 14 commits, 505 unique leaf-entry
  versions, 7,698,368 regular-blob bytes, and 28 identity occurrences with zero
  finding.
- The push used the one canonical HTTPS endpoint. Repository ID `1330979133`,
  public visibility, PVR `enabled: true`, and remote-main equality were verified
  after transport.
- This closes M3-006 only. It does not publish npm packages or prove hosted
  platform, compatibility, support, or release results.

### M3-004B first hosted run and portability diagnostics — 2026-08-12

- Public CI run `31559642053` passed Ubuntu 22/24 and macOS 22/24, but failed
  Windows 22/24.
- Security run `31559642035` passed CodeQL. Dependency Review was skipped on the
  push event and still requires an ordinary pull request.
- The failures exposed four portability boundaries: a POSIX-only test path,
  CRLF handling in the Git capability parser, noncanonical npm `bin` target
  spelling, and returning from forced process termination before child `close`.
- Pull-request run `31582316951` again passed Ubuntu/macOS 22/24 but exposed two
  remaining Windows facts: Git for Windows requires Git's `/dev/null` spelling,
  and npm does not promote a nested bin target to tar mode 0755 on Windows.
  The second correction uses one package-root bin and a policy-v2 exact
  historical path/blob grant without admitting that retired path in the current
  tree; bounded code review reports 0 blocker, 0 high, and 0 medium.
- In the fixed non-FileProvider copy, Node 22.23.2 and Node 24.19.0 each pass
  the 216-node affected focus, 24-node package-stage suite, and 1228-node
  complete suite. npm 10.9.8 and npm 11.17.0 each build and admit four private
  tarballs, install them together offline, smoke the installed CLI spine, and
  retain the package-root CLI at tar mode 0755.
- For branch object `94b5c1c`, pull-request Public CI run `31594128100` passed all six Ubuntu/macOS/Windows
  × Node 22/24 cells, including complete tests, guarded packages, working-tree
  recheck, and drift check. The repository was then restored to public
  visibility, its dependency graph was enabled, and pull-request security run
  `31594128139` passed Dependency Review; CodeQL was skipped by the
  pull-request event design. Those runs are historical evidence bound to branch
  object `94b5c1c`; they explain the portability repairs but are not the later
  closure authority.

### M3-004B completion — 2026-08-12

- Accepted pull-request head
  `f6ba6bad48c928d31c356d47911dd929ccf3b2d1` passed all six
  Ubuntu/macOS/Windows × Node 22/24 cells in Public CI run `31600528716`.
- Pull-request security run `31600528742` passed Dependency Review. CodeQL
  was skipped by the pull-request event design.
- Accepted main `c4dee58a8920a8e71c20f53ab93c62a96d3cb89d` passed all six cells in
  Public CI run `31600806512`.
- Main security run `31600806350` passed CodeQL. Dependency Review was skipped
  by the push-event design.
- The accepted PR and main commits share tree
  `4e70ec4323807824b0578241fe4a4d94951cd608`, and their trees have no diff.
  The event-specific skips are expected workflow partitioning, so this closes
  M3-004B on the accepted bytes.
- M3-005B is now `NEXT`. Platform/capability support, `supportClaimsEnabled`,
  npm publication, and release state are unchanged. D-047/M3-008 branch
  protection remains deferred.

### D-044 pre-public identity migration — 2026-08-11

- The user selected `why7682/pptx-compiler`. The active repository, CLI, four
  npm packages, `#pptx-compiler/*` aliases, default project filename, SBOM, and
  unpublished `urn:pptx-compiler:*` contract namespace now share one stem with
  no old-name compatibility alias.
- The local workspace folder and neutral protocol/error/package IDs remain
  unchanged. The old name survives only in dated D-001/D-012 evidence and the
  existing ignored stage owner/plan ID plus `.pptx-pipeline-*` transaction
  prefixes needed to recognize pre-rename crash state.
- Exact read-only checks on 2026-08-11 found the selected GitHub target absent,
  no exact `pptx-compiler` repository name, and E404 for all four selected npm
  names. These checks reserve nothing.
- In the fixed non-FileProvider copy, Node 22.23.2 and Node 24.19.0 each pass
  the 1206-node complete suite. Both runtime/npm pairs also pass the real four-
  tarball offline install and installed `pptx-compiler` CLI smoke; QA remains
  blocked and no BuildArtifact exists. The former complete reviewed tarballs
  were authenticated and moved intact to the fixed verification root before
  the same `.package-stage/` path produced the renamed set.
- Two bounded current-byte closing reviews report 0 blocker, 0 high, and 0
  medium. D-044 provenance is closed; M3-006 has since completed the empty-
  shell/PVR prefix, repository-bound dual-runtime rebuild, final local history
  scan, and exact first source ref.

### M3-001 first CLI slice — 2026-08-11

- One dependency-free CLI protocol `0.1.0` now owns exact command parsing,
  deterministic JSON envelopes, redacted `code + pointer` errors, and only
  three process meanings: `0` success, `1` domain/runtime failure, and `2`
  usage failure. JSON mode writes exactly one object to stdout on both success
  and failure; it never prints an exception message, stack, path, or source
  content.
- `inspect` now performs a real explicit-root flow: bounded contained
  ProjectConfig read -> normative Schema validation -> immutable
  `ProjectContext` -> existing secure PPTX/POTX ingestion -> existing
  `TemplateIndex`. The only allowed output is the exact configured index path,
  written create-only through a same-directory stage/link boundary.
- `validate` now reads one explicit contained JSON document and checks it
  against the existing manifest-selected root Schema. It creates no output and
  no dispatcher plan. The Schema subset implementation moved from `scripts/`
  into core; the old script path is a one-line compatibility re-export, so
  existing callers are not broken and there is still one validator.
- `init`, `doctor`, `onboard`, `render`, `qa`, and `diff` are recognized but
  return `CLI_COMMAND_UNAVAILABLE`. In particular, the CLI does not import test
  helpers, bypass the false support switch, or turn the fixed M2 candidate into
  a generic renderer claim.
- Ten process-level public-synthetic tests cover deterministic output across
  roots/cwd, exact success envelopes, create-only conflict behavior, contract
  validation, schema pointers, archive/content/path redaction, `0/1/2` process
  codes, deferred-command failure, configured output authority, fatal rejection
  of malformed UTF-8 before Schema validation, and explicit post-link commit
  uncertainty with the linked file retained. The bounded re-review reports
  0 blocker, 0 high, and 0 medium. M3-001 remains in progress.

### M3 Linus audit and corrected critical path — 2026-08-11

- New feature work was frozen after D-034. The five-layer review in
  `docs/M3_LINUS_AUDIT.md` found that the old “eight commands” task was not a
  release path. It also found three blockers to implementing render at that
  time: the normative matrix authorized no complete product-render dependency
  set; public QA has no defined honest outcome when visual/compatibility facts
  are absent; and final public CI was ordered before creation of the public
  repository.
- The release target is now a candidate alpha. It may publish only candidate
  PPTX plus CandidateBuildRecord. A successfully executed QA assessment emits
  the existing QaReport with `decision: blocked` when required evidence is
  absent and emits no BuildArtifact. Delivery alpha remains later work.
- The next implementation slice is the on-disk project spine, not render:
  public-synthetic create-only bootstrap, configured-path inspect, and real
  whole-project validation against a static host plus normative support policy.
  The current single-document Schema check will remain only under an explicit
  document-validation meaning; it does not count as alpha project validation.
- Before publication, remove redundant `inspect --output`; ProjectConfig is the
  sole TemplateIndex-path authority. Generic onboarding is deferred because the
  current capability metadata names roles but cannot safely derive bindings
  without capability-specific CLI rules.
- The first render profile will be the smallest exact public-synthetic
  one-slide native-card candidate. Every input/feature/capability/output row it
  actually exercises must be reviewed and promoted together to explicit
  `experimental`; `supportClaimsEnabled` stays false and no conformance-only
  support bypass is permitted.
- One bounded read-only challenge reported 3 blocker, 3 high, and 2 medium
  planning findings. D-035 accepts the corrected order. No production code,
  contract, support row, or package changed in this audit.

### M3-001 project spine — 2026-08-11

- `init --preset public-synthetic-native-card` now creates one deterministic,
  schema-valid on-disk project under one explicit new root. The production
  `packages/public-synthetic` package owns the conformance preset; CLI no
  longer imports a testing helper.
- ProjectConfig is the bootstrap commit marker. A pre-marker failure either
  removes only the exact owned files/directories and reports `NOT_COMMITTED`,
  or preserves the root and reports `ROLLBACK_INCOMPLETE`. Once the marker is
  visible, every write/fsync failure reports `COMMIT_UNCERTAIN` and performs no
  destructive rollback. Injected regressions cover all three states.
- `inspect` has no `--output`; ProjectConfig is the sole TemplateIndex-path
  authority. The former single-document Schema check is now explicitly
  `validate document`.
- `validate project` loads ProjectConfig, TemplateProfile, TemplateIndex,
  CapabilityRegistry, ProjectOverlay, and DeckSpec; re-inspects the source;
  exact-compares the current index; creates the fixed static runtime from
  installation-owned schemas/cases plus the normative support matrix; and
  prepares then discards one complete project plan.
- Machine output explicitly reports registration conformance execution as
  passed, project dispatch preflight as passed, project invocation execution as
  not run, and render eligibility as not granted. Validation writes no project
  output. Normative experimental opt-in remains mandatory.
- Nineteen CLI tests, 263 focused dispatcher/resolver/native/support/fixture
  tests, and the complete 1065-test suite pass. The bounded review's two high
  and one medium findings were fixed; re-review reports 0 blocker, 0 high, and
  0 medium. M3-001 remains in progress, every support count is unchanged, and
  `supportClaimsEnabled` remains false.

### M3-001 exact candidate render — 2026-08-11

- `render --project-root --config --deck` now executes exactly the fixed
  public-synthetic one-slide native-card profile. ProjectConfig remains the sole
  output-root authority; callers cannot select a renderer, support override, or
  output path.
- The frozen profile closes 15 invariant dependency rows plus the executing
  Node 22/24 platform row and public-automated evidence. All required rows are
  `experimental/accept-with-warning`, explicit opt-in is mandatory,
  `supportClaimsEnabled` remains false, and the normative matrix now totals
  0 supported / 22 experimental / 3 manual / 35 unsupported.
- One stable source read supplies both source bytes and the fresh readable
  TemplateIndex. The complete index graph, not merely feature labels, must
  match the installation-owned public-synthetic golden; its digest only binds
  that graph to the exact source bytes.
- The command re-derives one semantic-slot placement, exact-compares the whole
  geometry with DeckSpec, prepares a fresh one-shot dispatch plan, reconstructs
  typed OOXML, verifies three clear occupancy checks and exact collateral diff,
  then publishes CandidateBuildRecord first and PPTX as commit marker.
- Publication fault tests cover not-committed, rollback-incomplete, and commit-
  uncertain states. Candidate/record bytes are deterministic and create-only;
  the source remains byte-identical and no QaReport or BuildArtifact is made.
- The D-037 focused set passes 180/180 and the complete suite passes 1076/1076
  on Node 22. A recursive production import-graph regression closed the review's
  one medium transitive OMML/ordered dependency; re-review found 0 blocker,
  0 high, and 0 medium. A frozen 1600 x 902 render passed an independent
  pixel-only review with no findings. M3-001 remains in
  progress; the next dependency is honest blocked QA, not delivery.

### M3-001 honest blocked QA — 2026-08-11

- `qa --project-root --config --deck` now assesses only the exact D-037
  candidate pair. It reloads the complete readable project graph, reuses the
  render semantic-slot derivation with a fresh one-shot plan, reconstructs the
  expected authenticated PPTX plus canonical CandidateBuildRecord, stable-reads
  the actual commit marker then record, and requires exact bytes plus replay.
- A valid pair emits and returns the same schema-valid `QaReport 0.1.0` with
  three internal checks passing and pixel review, PowerPoint compatibility, and
  render completeness unavailable. The command succeeds with
  `decision=blocked`, writes one create-only `<deckId>.qa.json`, and creates no
  BuildArtifact.
- Missing, oversized, tampered, noncanonical, or stale pairs fail without a QA
  file. Unknown evidence/output options fail usage parsing. Ignored local
  screenshots, review records, and PowerPoint transcripts are not read and
  cannot change the deterministic report bytes.
- Render and QA share one pure authenticated candidate/record projection. The
  production import closure still excludes the broad final-delivery,
  OMML/ordered, PowerPoint, test, and lab paths. The two required manual rows
  remain `manual/report-manual-gate`; all 60 support statuses and the false
  global claim switch are unchanged.
- The QA-focused CLI/native/support set passes 99/99, and the complete Node 22
  repository suite passes 1085/1085. The bounded review's one high and two
  medium findings were fixed; frozen-before-validation, intrinsic Buffer
  length, rejected-Promise consumption, and symlink regressions re-review with
  0 blocker, 0 high, and 0 medium. Forbidden-material and provenance gates each
  pass across 216 working-tree files, the 60-row support gate passes, and the
  contract gate reports no finding. M3-001 is DONE; M3-002 is next.

### M3-002 guarded alpha package definition — 2026-08-11

- `packaging/alpha-package-plan.json` freezes exactly four unscoped alpha
  packages: CLI, core, native-card-arrow, and public-synthetic. Positive file
  mappings, exports, types, executable bin, Node 22/24 engines, MIT metadata,
  internal dependency edges, import aliases, and required package-owned assets
  are one validated profile rather than scattered manifest conventions.
- Package-owned resource descriptors remove the monorepo-root runtime
  assumption. The installed CLI passes exact contract, fixture, golden, plugin,
  and support-policy paths through the complete
  `init -> inspect -> validate project -> render -> qa` spine. The legacy
  explicit-root entry remains compatible and QA remains blocked with no
  `BuildArtifact`.
- The official npm registry returned E404 for all four exact names on
  2026-08-11. That check is time-bounded and reserves nothing. At M3-002
  closure, repository metadata remained deliberately blocked; D-045 later
  bound the verified empty public repository while retaining the npm guard.
- The package/CLI/native/policy focus passes 146/146 and the complete Node 22
  strict suite passes 1107/1107. The package-plan gate checks all four profiles;
  forbidden-material and provenance gates each pass across 239 working-tree
  files, the 60-row support gate passes, the contract gate has no finding, and
  `git diff --check` passes.
- The bounded review's one high fixed-profile gap and one medium hidden-loader
  gap were closed with exact package profiles, required targets, builtin
  validation, trivia-aware loader scanning, and adversarial synchronized-drift,
  comment, and line-terminator mutations. Final re-review reports 0 blocker,
  0 high, and 0 medium.
- M3-002 itself created no stage, tarball, installation, publication,
  repository, or release claim. M3-003 later implemented that local gate,
  D-045 created the empty public shell and verified PVR, and M3-006 completed
  the exact first source ref. Package publication and release evidence remain
  absent.

### M3-003 guarded package-stage completion — 2026-08-11

- One stable control snapshot retains the package-plan, forbidden-material
  policy, `.gitignore`, and every mapped source byte/mode. Semantic validation,
  materialization, tar admission, smoke execution, and final publication all
  bind back to that readable snapshot.
- The same admitted Node runtime invokes its bundled npm CLI offline with
  scripts, ambient configuration, network, audit/fund, and lockfile writes
  disabled. npm supplies a pack report only; a narrow independent parser
  accepts exactly one canonical npm gzip/ustar representation and the planned
  members plus generated manifest.
- Four retained tgz byte buffers pass the 5 MiB compressed, 20 MiB unpacked,
  300-member, and 1 MiB/member limits; exact path/content/mode/order and the
  forbidden path/extension/magic/text policy are enforced.
- All four tgz files install together into one empty directory. Exact installed
  package and `.bin` inventories pass, and the installed CLI executes
  `init -> inspect -> validate project -> render -> qa` from an unrelated cwd.
  QA is blocked and no `BuildArtifact` is present.
- The ignored fixed stage has atomic ownership/claim handling, marker-authenticated
  `work/reviewed/previous/failed` recovery, repeated control/source/tgz checks,
  and a full-evidence completion marker. Reviewed output retains only the
  marker, canonical evidence, and four tgz files. Exact transient inventories
  and marker-proved review members are removed without recursive deletion;
  foreign attempts are preserved by rename in the persistent quarantine.
- Focused package-stage tests pass 22/22; the complete Node 22.23.2 strict suite
  passes 1129/1129; the actual package build passes with npm 10.9.8. Package,
  leakage, provenance, support, contract, and diff gates pass. Closing review
  reports no remaining blocker or high issue.
- Foreign live-PID reuse and a dead Worker under a still-live host can cause a
  conservative false-active result; no unsafe TTL is used. Owner-verified
  unknown empty conflict directories may be removed, while files, links, and
  nonempty unknown entries fail closed. A pre-marker interruption restores the
  last complete review and retains the unfinished candidate in `failed`.
- This was the D-040 local package checkpoint only. M3-004A owns the public-safe workflow
  definition; M3-004B owns only its hosted cross-platform evidence. D-045
  changed the repository-bound manifest and tgz inputs; the resulting
  repository-bound Node 22/24 package gate later passed, and M3-006 subsequently
  completed the final local history gate and exact first source ref.

### M3-004A local workflow-contract completion — 2026-08-11

- Exactly two byte-locked workflows define the public-safe ordinary CI and
  security jobs. Ordinary CI has read-only contents, full-SHA actions, fixed
  runner labels, no credential persistence/cache/secrets/publication, and
  admits workflow/forbidden/release controls before `npm ci --ignore-scripts`.
- The root remains private and has one exact dev-only TypeScript 6.0.2 lock
  entry. Real declaration typechecking, 123-source syntax/text policy, the
  canonical four-package plan, MIT/provenance relations, and the readable
  CycloneDX static-ESM projection all pass. The dependency proof covers parsed
  static ESM edges; direct loader/codegen rejection is reviewed-source
  hardening, not a malicious-JavaScript sandbox.
- In the one fixed non-FileProvider verification copy, Node 22.23.2 with npm
  10.9.8 and Node 24.19.0 with npm 11.17.0 each pass the complete 1180/1180
  suite and a real four-tarball pack/install/installed-CLI smoke. QA remains
  honestly `blocked` and no `BuildArtifact` is produced.
- The 104/104 workflow/release/package/source/policy focus passes. The final
  working-tree gates cover 260 provenance/forbidden files, 60 support rows,
  the complete contract set, exact release metadata, and tracked-file drift.
  Independent closing review reports 0 blocker, 0 high, and 0 medium.
- This is local macOS contract evidence only. No Linux, Windows, hosted macOS,
  CodeQL, Dependency Review, public repository, platform-support promotion,
  signing, publication, or release result was claimed at this checkpoint. The
  hosted facts were assigned to M3-004B and later completed without promoting
  support, publication, or release.

## M4 — Release progression

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| M4-001 | PENDING | Release `0.1.0-alpha.1` after all alpha gates pass. | Signed/provenance-enabled release is reproducible from a clean tag; published contents equal the reviewed tarball. |
| M4-002 | PENDING | Collect compatibility evidence without expanding claims beyond tests. | Each tested external template records only redacted feature-level results and the public fixture remains sufficient for CI. |
| M4-003 | PENDING | Define beta and 1.0 stability, migration, deprecation, and support promises. | Compatibility policy and conformance suite enforce the promises. |

## Deferred follow-through from the predecessor project

These entries intentionally remain at the tail so the generic public core is
not delayed or distorted by project-specific validation.

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| COMPAT-OMML-001 | DONE | Record the explicit no-repair operator attestation for the frozen fixed mixed-candidate `3/3 -> 2/3` edit/save/close/reopen observation. | The exact `ccbffcb1…2802` / `5a88c576…15c1` / `2592ad9d…8d3` triple produced one ignored passing feature-level record with machine observation and operator attestation separated; it grants no direct receipt, delivery, or support authority. |
| LAB-TOKEN-001 | PENDING | Harden the approved preloaded, report-only Codex task runner as a separate `labs/` experiment. | Zero-tool enforcement, canonical path containment, hashed/classified inputs, minimal environment, bounded/schema-checked output, exact completion/usage accounting, prompt-injection mutations, and canary token/quality comparisons all pass. It is never a renderer prerequisite. |
| COMPAT-TEMPLATE-003 | DEFERRED | Test a third independent design package after the project is mature. | Start only after the alpha vertical slice and public fixture pass; require before 1.0, not before initial implementation. No private asset enters Git or public artifacts. |
