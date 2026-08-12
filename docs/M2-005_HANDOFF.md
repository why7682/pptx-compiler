# M2-005 Handoff — Create-Only Assembly and Observable Output

## Objective

Consume only operation plans already authenticated and schema-validated by the
upstream resolver/dispatcher boundary; independently revalidate the source and
its indexed target facts; rebuild admitted target OOXML inside a new package;
normalize target identities; prove exact allowed versus collateral changes; and
atomically publish a new PPTX without modifying or replacing the source. The
narrow backend does not authenticate a detached plan's provenance by itself.

Visual quality is the user-facing objective. Structural gates exist so a
render-observe-repair loop can be trusted, but a structurally valid deck is not
a visual pass. The optional reviewer contract is isolated under
`labs/visual-review-agent/` and cannot be imported by core.

## Sequencing correction

Do not expand this writer directly from `M2-005A` to broad multi-slide,
native-component, or formula coverage. The commit-pinned study in
`docs/EFFECT_FIRST_IMPLEMENTATION_PLAN.md` showed that the missing
outcome-bearing layer is content-to-layout selection, not another mutation
primitive.

The next integration target is therefore:

1. a slide brief with audience goal, primary takeaway, and evidence policy;
2. a template-derived layout profile with semantic slots and capacities;
3. deterministic hard-fit and lexicographic layout selection; and
4. conversion of the selected unit-to-slot assignment into the already frozen
   clone/fill plan consumed here.

`labs/layout-selection/layout-selector.mjs` is the first non-authorizing
prototype. It cannot write a package or change a support claim. Complete one
public synthetic match-to-render comparison before broadening the writer.

## Deck-level sequencing correction — 2026-08-09

The match-to-render and ordered-story slices proved that semantic hierarchy and
batch order can improve a bounded output, but a broader review found that the
brief-to-layout plan still begins too late. It assumes that the argument,
subject-specific visual language, and whole-deck rhythm already exist.

The non-authorizing, lab-only P1–P3 planning and rendered-comparison gate in
`docs/PRESENTATION_DESIGN_PLANNING_REVIEW.md` is now complete for the bounded
public-synthetic case:

1. consume one raw synthetic brief, evidence inventory, and explicit template
   mode through an executable lab planner;
2. produce and validate multiple communication/narrative/slide/visual/rhythm
   candidates, then record a justified human selection or non-authorizing
   comparative recommendation;
3. feed the accepted receipt through the existing layout and assembly path with
   no manual visual retouching;
4. upgrade the optional reviewer with a blind outcome probe, non-votable
   required-item reconciliation, and a separate whole-deck taste lane; and
5. prove the planner and reviewer with a label-randomized comparison matrix that
   isolates narrative, evidence-bearing visual language, topic decoration, and
   live-versus-leave-behind delivery.

D-023 separately formalizes the earlier effect-first edits to the public product
objective. This sequencing correction does not add a new serialized `0.1.0`
contract or promote a support row. All model-assisted planning and review
remains under `labs/`, cannot be imported by core, and cannot authorize package
mutation. The controlled rendered-comparison gate now passes, so native/OMML
application may resume without promoting a support claim.

### P1 planning gate implemented — 2026-08-09

`labs/design-planning/deck-planner.mjs` implements the first itemized planning
slice without accepting a pre-authored candidate or story. One text-only raw
brief, three bounded evidence records, and an explicit template profile produce
three complete communication, narrative, slide, visual-language, rhythm, exact
input-coverage, and leave-one-node-out hypotheses. The built-in comparison uses a deterministic semantic
tuple and remains recommendation-only. A separate external selection fixture
binds the raw input, complete candidate set, one selected candidate, and both
rejected alternatives. The second provenance-managed approval record must bind
that acceptance and match a complete canonical digest in the planner's fixed
reviewed registry; caller-invented approvals stay assembly-ineligible and cannot
mint the opaque module-private receipt token consumed by projection.

The accepted proof-led receipt projects to the existing fixed three-act story,
selects the reviewed status/status/decision layouts, and produces one exact
three-slide PPTX with no collateral changes. Locked, flexible, and scratch modes
are tested; fixed/flexible attributes form a complete partition, the claimed
planning template is bound to the actual proposal-set and layout-acceptance
hashes, and scratch remains assembly-ineligible. The final assembly receipt
binds the planning receipt, selected candidate, story projection, actual layout
evidence, and output PPTX hash. The separately approved hidden outcome key
shares the raw-input digest but is not imported by the planner. Fifteen focused
positive and adversarial tests pass. This is lab evidence only: it adds no
public contract, executor, capability, or support claim. The locked projection
renders only the admitted brief/layout subset of the richer visual/rhythm plan;
the P2 staged reviewer is implemented with `simulated-review-only` evidence,
and P3 now supplies the separate controlled real-pixel evidence needed before
`M2-005C` resumes.

## Implemented sub-slice: M2-005A

`packages/core/src/create-only-assembly.mjs` implements one deliberately narrow
vertical path:

1. copy one bounded source archive snapshot;
2. reject its byte length before copying, then revalidate it through the existing
   secure OOXML package view;
3. bind its SHA-256 and re-derive the exact one-master, one-layout, one-slide,
   source-order shape/geometry facts claimed by the frozen `TemplateIndex`;
4. admit exactly one frozen `source-slide-clone-fill-plan`;
5. rebuild the two target text nodes from parsed namespace-expanded XML;
6. convert the main POTX content type to PPTX;
7. assert the masked target slide has no non-text semantic change;
8. assert every other part is byte-identical;
9. serialize a deterministic bounded stored-entry ZIP;
10. re-ingest the result as a valid PPTX; and
11. publish through an exclusive staging file and an atomic create-only hard
    link in the destination directory.

The runtime report lists every modified, added, removed, allowed, and collateral
part. Any unexpected path fails before publication.

## Explicit M2-005A limits

- one source master, layout, slide, plan, and output slide only;
- exactly one paragraph in each of the two target text boxes;
- the narrow public synthetic OOXML grammar only;
- no slide graph expansion or relationship/ID allocation yet;
- no native-card-arrow or OMML target application yet;
- no support-matrix promotion;
- PowerPoint/Quick Look render observations are local compatibility evidence,
  not committed public fixtures or CI prerequisites.

## Implemented M2-005 obligations and deferred follow-on

### Effect-bearing prerequisite — match to one real render

Completed as a bounded same-geometry control. Two reviewed semantic profiles
bind to exact repository-owned synthetic shape facts; selection and private-plan
assembly execute atomically; exact-fit and generic candidates were rendered at
1600 × 902; and three isolated reviewers agreed that the action-first exact
candidate serves the approval goal better. One reviewer also flagged incomplete
decision evidence and small supporting type. See
`docs/M2-005_MATCH_TO_RENDER.md`. This validates the relative hierarchy
hypothesis, not general automatic induction or production visual readiness.

### Effect-bearing prerequisite — reviewed profiles across distinct exemplars

Completed as a bounded clean-room induction/review/selection slice. Three
runtime-generated public synthetic POTX sources have different geometry and
type hierarchy. The automatic phase emits only redacted geometry, region,
source order, typography, capacity estimates, and a non-authorizing salience
hypothesis. The committed review artifact freezes proposal hashes, accepts the
two clear 44/20 pt and 48/24 pt hierarchies, and rejects the equal 28/28 pt
hierarchy. Accepted profiles must expose exactly one primary takeaway and one
supporting evidence slot, meet 24/18 pt minimums, and stay below inferred
capacity. Cross-source selection then hands the winning exact source/index to
the existing atomic backend. Ten focused tests and two real 1600 × 902 renders
pass; see `docs/M2-005_PROFILE_INDUCTION.md`. This is not arbitrary-template
semantic induction or a support claim.

### M2-005B — bounded ordered deck graph implemented

The implemented vertical slice accepts exactly three reviewed story beats in
the roles `setup`, `evidence`, and `resolution`. It captures the complete story,
acceptance, and exemplar set once; validates graph order and adjacency before
selection; authenticates every M2-005A report against its exact bytes; and
publishes nothing during assembly.

The lower-level assembler accepts 2–11 authentic one-slide artifacts, requires
an exact reachable root/presentation/master/layout/theme/properties/slide
relationship closure, rejects orphan content parts, and allocates deterministic
part names, presentation slide IDs, and relationship IDs. It normalizes content
types and owner references, securely re-ingests the output, and returns an exact
allowed/collateral part diff. Fifteen focused tests and the render-review-repair
evidence are recorded in `docs/M2-005_ORDERED_STORY_DECK.md`.

At this boundary alone, the ordered public-synthetic story slice did not finish
the parent milestone. The later fixed mixed delivery/evidence closure and D-033
complete the bounded milestone without claiming arbitrary multi-slide/template
compatibility.

### M2-005C — native and formula targets

Unblocked by the executable deck-planning and controlled rendered-comparison
gate above. The first native application sub-slice is implemented:

1. authenticate one exact M2-005A report/archive pair and detach its target
   slide, canvas, shape, and archive facts before asynchronous work;
2. accept one frozen single-invocation dispatcher plan, consume it inside the
   assembly boundary, and require the exact experimental
   `native-card-arrow@0.1.0` executor and QA identity;
3. use only typed geometry, label, and style data—the unbound XML exemplar is
   present only as an upstream conformance field and is never read, parsed,
   concatenated, or string-rewritten by the applicator;
4. require the clone source and direct text-box anchor to match the authentic
   M2-005A target facts and require the component frame to fit the actual slide;
5. inspect every object in the root and nested `p:spTree`, reject missing,
   duplicate, non-canonical, non-positive, or out-of-UInt32 IDs, and allocate
   the three smallest free IDs in group/card/arrow order;
6. rebuild the fixed native group as namespace-expanded nodes, insert it
   immediately after the anchor, add no `r:*` attribute or relationship, and
   prove an exact one-slide allowed diff; and
7. deterministically serialize and re-open the ZIP, verify the exact generated
   group, then remove it and prove the target slide equals the authentic base.

The public synthetic target allocates `4/5/6`. Twenty-four focused tests cover
the happy path, byte determinism, one-shot replay, report/archive forgery and
tamper, source/anchor/canvas mismatch, dispatcher schema/QA drift, root/nested
ID collisions and invalid forms, closed inputs, and static core isolation from
plugins, labs, and the fragment runtime.

At that boundary the complete repository suite passed 883/883. The bounded independent review
found one medium pre-limit byte-copy issue in the exported ID allocator. The
allocator now applies the strict 256 KiB XML size gate to the original byte view
before any copy, its oversized-input regression passes, and targeted closure
found no remaining blocker, high, or medium finding.

The next narrow bridge is also implemented:

1. the native applicator registers the exact report identity, output digest,
   detached output bytes, and authentic M2-005A base only after target-specific
   verification;
2. ordered assembly admits authentic clone-fill and native artifacts without
   changing its serialized input shape, copies each real native slide exactly,
   and builds an in-memory verification shadow using the authentic base slide;
3. the unchanged generic package view plus complete relationship-closure checks
   run against that shadow, while the real output is separately proved to carry
   each exact authenticated input slide;
4. the ordered report is registered only after that proof and records whether it
   contains a target-specific native slide; and
5. a separate create-only publisher accepts only a direct authentic native
   artifact or an authentic native-containing ordered artifact, snapshots before
   its first filesystem await, and preserves staging, hard-link, parent-identity,
   no-overwrite, and cleanup behavior.

The direct report deliberately remains `publicationEligible: false`: the generic
raw-byte package view and publisher still reject group shapes. The private bridge
uses report identity, not that caller-visible label. Clone-only ordered output
does not enter the bridge. Thirty-six focused tests cover direct and ordered
publication, native first/middle/last and all-native ordering, exact slide-byte
copy, determinism, detached authentication snapshots, forged/copied reports,
tamper, duplicate slide IDs, closed inputs, caller-label forgery, pre-I/O caller
mutation, no overwrite, symlink parents, and continued generic rejection. The
complete repository suite passes 895/895. The bounded bridge review's one high
hash-before-copy TOCTOU was fixed by intrinsic length admission plus copy-then-
hash of the returned private snapshot. Direct and ordered SharedArrayBuffer
regressions pass, and targeted closure found no remaining blocker, high, or
medium finding.

The placement and compatibility closure is now implemented for this exact
public-synthetic native slice:

1. the original overlap geometry is a mandatory failure regression based on
   slide-wide conservative paint bounds rather than shape-frame bounds alone;
2. a JSON-round-trippable `SlideLayoutIR` preserves fixed template nodes plus
   one bounded semantic slot, parent-owned padding, allowed component identity,
   alignment, preferred size, z-order, and all constraints;
3. a separately persisted `ComposedSlidePlan` binds the IR digest to frozen EMU
   coordinates, paint bounds, resolved slots, a plan digest, and containment,
   slot, and pairwise-occupancy receipts;
4. the product entry point accepts `slotRef=slide-content-tail`,
   `placementIntent=slot-aligned-fixed`, and preferred size, derives x/y from
   authenticated template facts, and rejects any executor geometry drift;
5. the old raw-coordinate entry point remains a low-level compatibility
   primitive and still passes the same occupancy gate;
6. structurally authenticated output is written through an explicit
   `candidate-pptx` writer with `deliveryEligible: false`; the old publication-
   named API remains a compatibility alias, not delivery authority; and
7. one exact repaired public-synthetic candidate passed Quick Look rendering,
   independent pixel-only review, PowerPoint 16.111.3 group rename/save/reopen,
   child ungroup/text editability, strict post-save package inspection, a fresh
   post-save render, and a second independent pixel-only review. The initial
   and saved artifacts, pixels, automation, and raw reviews remain local and
   ignored.

The assembly report carries the JSON-safe facts from which the normative
candidate build record is now constructed. `CandidateBuildRecord 0.1.0`
persists both the complete IR and exact plan, binds them to the direct candidate
PPTX, and replays the resolver on load. A `.pptx` without that record remains
usable for viewing/editing shapes, but is not an authority for constraint-aware
regeneration.

Eight focused layout-IR tests, forty focused native assembly/publication tests,
and the complete 918-test repository suite pass. This is still a narrow local
compatibility result: it does not authorize arbitrary templates, promote a
support row, complete rollback/schema integration, or create a final delivery
publisher. The compatible typed formula target described below is the direct
follow-on; these earlier 918-test figures remain the native-slice checkpoint.

The bounded closing code review reproduced two medium durability defects:
semantic JSON objects were compared by key order, and repeated live Proxy
`length` reads could admit an invalid array. Canonical normalized comparison,
one descriptor snapshot, a unified revoked-Proxy exception boundary, and two
regressions closed both; final re-review found no remaining blocker, high, or
medium issue.

The typed formula target is now implemented as the next bounded M2-005C slice:

1. authenticate and detach the exact M2-005A base before asynchronous dispatch;
2. require one exact `formula-transplant@0.1.0` result and its four QA IDs;
3. strict-parse the canonical unbound `m:oMath`, admit only the closed typed
   topology, and apply the tighter target capacity of 64 elements, 16 runs, and
   256 UTF-8 text bytes;
4. rebuild every admitted node and fixed DrawingML run property in core, wrap
   the one formula as direct `a14:m -> m:oMath`, and never concatenate source
   XML or emit a raster fallback;
5. preserve the original text-box geometry as one semantic formula slot, resolve
   the same JSON-replayable IR/plan calculation, and require exact planned
   target geometry before mutation;
6. permit only `ppt/slides/slide1.xml` to change, add no relationship, restore
   the target, and require byte equality with the authenticated base; and
7. register the verified report in private authority and admit only that exact
   artifact to the existing non-deliverable candidate writer.

PowerPoint 16.111.3 opened the direct candidate without repair, saved a shape-
name edit, closed it, and reopened it with the native OMML choice preserved.
PowerPoint's save normalized the math into `mc:AlternateContent` and authored a
PNG fallback; this post-save fallback is not generator flattening. Its extracted
pixels were complete and unclipped, and an independent reviewer passed a layout
composite using those pixels at the exact persisted target geometry. Quick Look
did not render the native formula, and the composite is not a direct PowerPoint
screenshot. D-032 later passes a separate fixed mixed-candidate formula-edit
observation; this direct candidate still lacks its operation-bound receipt.

Eleven OMML tests and the combined 67-test create-only/native/layout/OMML focus
pass. The bounded review found a high shared-memory mutation interval in the
reused base authenticator and a medium reserved-root ID path that could skip
slot containment. Intrinsic length admission, copy-before-hash, rejection of
`slide-canvas` as a node/slot identity, mandatory slot-check cardinality, and
two regressions closed both. Final re-review found no remaining blocker, high,
or medium issue; the complete repository suite passes 930/930.

The following bounded sub-slice serializes the shared facts instead of leaving
them only in memory:

1. `CandidateBuildRecord 0.1.0` is a separate ninth root contract rather than
   an overload of the QA-backed published `BuildArtifact`;
2. it preserves the exact bounded-slot `SlideLayoutIR`, replayed
   `ComposedSlidePlan`, receipt, diff, authentic base digest, and either native
   object IDs or typed-OMML target evidence;
3. it binds the record to one ASCII candidate basename, byte length, and
   SHA-256, then requires canonical bytes and exact resolver replay on load;
4. one artifact field snapshot is captured before authentication so a live
   Proxy cannot pair one authentic PPTX with another authentic report;
5. candidate and record buffers are limited before copying, and each source
   artifact/profile/evidence/diff/component identity is one closed schema and
   runtime tuple;
6. both files are staged and file-flushed in one canonical directory; the record
   is published first and the PPTX last as the logical commit marker; POSIX also
   requests parent-directory fsync barriers; and
7. handled rollback removes the candidate before removing the record, with a
   POSIX directory barrier between them. If candidate removal or a supported
   barrier fails, the record is retained
   rather than creating an unrecorded candidate.

The existing PPTX-only candidate writer and publication-named 0.x alias remain
unchanged. Fixed-absolute compatibility artifacts and ordered decks are
rejected by the direct bundle writer; neither its sidecar nor its validator
grants delivery or support authority.

That ordered follow-on is now implemented as a separate authenticated bundle
entry point. One closed ordered branch binds the base and per-slide source
hashes, slide/relationship/presentation allocation, deck diff, and candidate
bytes. Its per-slide source-build union is authoritative; redundant native
flags, counts, and ordered source-profile labels are not serialized. Clone/fill
slides are recorded as digest-bound sources. Every semantic native slide retains
its original base digest and source part, complete IR, exact plan/receipt,
one-slide diff, and allocated IDs;
raw-coordinate native slides fail before staging. Both branches reuse the same
record-first/candidate-last pair publisher. The candidate/contracts/
native/OMML/ordered/support focus passes 166/166 and the complete suite passes
945/945.
The bounded D-028 review found one medium schema/runtime classification drift;
the sourceBuild-only data model closed it, and re-review found no remaining
blocker, high, or medium issue.

Three record-unit tests plus the direct native and OMML bundle regressions pass
in the complete 942/942 suite. The bounded independent review reproduced and
closed cross-pair Proxy authentication, profile/evidence/diff and capability-
reference drift, Unicode/component filename bounds, pre-copy resource limits,
directory-barrier handling, and rollback ordering/failure handling. Final re-review
found no remaining blocker, high, or medium issue.

## Acceptance commands for the current sub-slice

```sh
node --test tests/create-only-assembly.test.mjs
node --test tests/layout-selection.test.mjs
node --test tests/reviewed-clone-fill-catalog.test.mjs
node --test tests/reviewed-profile-induction.test.mjs
node --test tests/ordered-story-deck.test.mjs
node --test tests/design-planning.test.mjs
node --test tests/visual-review-agent.test.mjs
node --test tests/visual-review-agent-v2.test.mjs
node --test tests/controlled-comparison.test.mjs
node --test tests/controlled-render-harness.test.mjs
node --test tests/candidate-build-record.test.mjs
node --test tests/native-card-arrow-assembly.test.mjs
node --test tests/native-omml-formula-assembly.test.mjs
node --test tests/receipt-bound-final-delivery.test.mjs
node --test tests/receipt-bound-omml-final-delivery.test.mjs
node --test tests/receipt-bound-ordered-final-delivery.test.mjs
node --test tests/slide-layout-ir.test.mjs
npm test
npm run check:working-tree
```

D-033 closes the parent milestone on the smallest complete product boundary:
the exact fixed mixed public-synthetic vertical slice. That slice now covers
source immutability, readable authority through `DeckSpec`/IR/plan, deterministic
candidate reconstruction, exact allowed/collateral diff, same-candidate render
and pixel review, ordered PowerPoint save/reopen, QA, BuildArtifact-last
publication, and both shared publication fault states.

The exact direct single-slide formula-content receipt remains absent, so that
optional direct-OMML final-delivery path stays unavailable. General ordered
native/OMML delivery and arbitrary template/platform compatibility are also
follow-on capabilities, not hidden M2-005 exit conditions. The global support
claim switch remains false.

## D-029 authority correction — 2026-08-10

Do not turn the candidate sidecar or its digests into a second semantic model.
The source template owns unchanged inherited content and package structure. The
raw brief, evidence inventory, and `DeckSpec` own authored content and
relationships; formula source remains LaTeX in `DeckSpec`. `SlideLayoutIR` owns editable layout
intent and constraints. `ComposedSlidePlan` owns deterministic resolved geometry
and its measured receipt. `CandidateBuildRecord` binds and replays the bounded
layout/build facts, but cannot regenerate omitted semantic content by itself.

There is no `GenerationIntent`, persisted formula AST, or tenth root delivery
contract in this milestone. Existing 0.1 digests stay compatible and detect
exact-object drift; they are not semantic authority. The final candidate digest
is retained only to ensure that the reviewed bytes are the delivered bytes.
Iteration is calculation-first, while final acceptance always renders that
exact candidate and uses an independent pixel-only reviewer.

The implemented delivery slice is deliberately smaller than the remaining
milestone: one direct, single-slide, semantic-slot `native-card-arrow` candidate
with the already completed PowerPoint compatibility evidence. Its base
normalizes the source slide and converts POTX to PPTX while preserving the
source template's visible text; no unrepresented clone/fill content is admitted.

Preparation synchronously snapshots the candidate, record, source template,
and complete project contract tuple. It replays the candidate record, re-derives
the complete admitted synthetic index from the source, resolves the exact
overlay anchor, and sends the re-derived source shapes/canvas plus the readable
DeckSpec request through the same pure slot calculation used by generation. It
requires the complete resulting `SlideLayoutIR` and `ComposedSlidePlan` to equal
the candidate record, not merely the native node box. It then rebuilds the
native group from DeckSpec label/style plus that verified geometry and
deterministically reconstructs the complete expected archive—including the
exact POTX→PPTX content-type conversion and normalized unchanged source
slide—and requires byte equality with the candidate. Thus a replay-valid record
cannot preserve the pixels while falsifying source constraints, relabel an
OMML/plain PPTX as native, or hide a non-target/collateral part change. All fail
before external receipts are consulted. Only then are mechanical, render,
independent-pixel, and compatibility receipts bound to the exact pair, and the
existing passing `QaReport` and `BuildArtifact` contracts are created.

Publication reserves one create-only delivery directory, stages complete files,
and links the candidate record, QA report, and exact PPTX before linking
`BuildArtifact` as the final commit marker. A pre-commit cancellation removes
the owned files and reserved directory; an existing destination is untouched;
the opaque plan is one-shot; and a failure after the build marker is reported
as commit-uncertain rather than destructively rolled back. Link success is
recorded before fallible inode verification, so a visible marker is never
reported as uncommitted. JSON node/key/escaped-byte budgets reject during
traversal before a full serialized copy is allocated. The final focus passes
23/23 and the complete repository suite passes 968/968. Coverage includes
success, byte/semantic/index/binding/evidence drift, a replay-valid false source-
constraint record, non-native relabeling, collateral mutation, resource
ceilings, unassessable pixels, missing compatibility, ordered rejection,
create-only/one-shot behavior, pre-commit cancellation, post-marker uncertainty,
and SharedArrayBuffer/caller-mutation snapshots. Ordered decks and OMML remain
blocked at this boundary. The closing independent re-review found no remaining
blocker, high, or medium issue.

The next bounded extension admits typed OMML to the existing ordered branch. It
does not add another assembler or root contract: the ordered assembler uses one
target-specific native profile table to authenticate card and formula artifacts.
For each formula source it copies the exact authentic slide bytes, uses only the
separately authenticated M2-005A base in the temporary generic-verification
shadow, and records the exact artifact/profile tuple, complete IR/plan/receipt,
one-slide diff, formula digest, target capacity, and observed target facts. Both
formula-first and formula-last orderings are covered, and the deck base digest
is the digest of the actual first source artifact. Copied report authority and
formula-evidence drift fail closed; no redundant deck-level OMML/native
classifier is serialized. Three new tests bring the focused closure to 201/201
and the complete suite to 971/971. Bounded independent review found no blocker,
high, or medium issue. This is candidate-build replay evidence only; ordered and
OMML final delivery remain blocked and no support authority is granted.

The following direct-OMML final-delivery slice applies D-029 without adding a
new root contract or treating the candidate sidecar as formula authority:

1. `assembleNativeOmmlFormulaFromSource` derives a normalized PPTX base from the
   exact admitted source template and verified `TemplateIndex`, preserving
   unchanged inherited content instead of importing the clone/fill compatibility
   artifact's authored title;
2. the compatibility and product entry points share one typed OMML mutation
   core, so strict topology, capacity, semantic-slot IR/plan, target verification,
   and one-slide collateral rules cannot drift;
3. `prepareReceiptBoundOmmlFinalDelivery` snapshots the candidate, record,
   project documents, output facts, receipt references, and dependencies before
   its first `await`, then creates a fresh resolver/dispatcher plan from the
   captured registry/overlay/index/DeckSpec tuple;
4. final preparation regenerates the whole candidate and requires exact archive
   bytes plus base identity, slide identity, full IR, full composed plan, diff,
   formula digest, and formula-target evidence to match the reviewed record;
5. it recomputes the actual source-to-candidate part set, permitting only the
   target slide and PPTX content-type conversion; undeclared clone/fill content
   and DeckSpec LaTeX drift fail before receipt authentication, while a no-op
   compatibility call producing the identical readable result is accepted; and
6. the shared BuildArtifact-last publisher accepts the OMML plan only after an
   authenticated compatibility receipt states the exact operation
   `formula-content-edit-save-reopen`. Shape-name evidence is insufficient.

The existing synchronous native-card preparation function and publication
behavior remain unchanged. Fifteen OMML assembly tests, twenty-three direct-card
final tests, six OMML-final tests, and the complete 978/978 suite pass. The one
bounded independent review's call-history ambiguity was closed by explicitly
making readable-result convergence—not hidden provenance—the authority;
re-review found no blocker, high, or medium issue. This is
public-synthetic implementation evidence only: the repository still has no
exact direct-candidate formula-content receipt, so the path cannot establish a
delivery or support claim. D-032's later feature-level `COMPAT-OMML-001` pass is
deliberately non-authorizing. Ordered final delivery, real-Pandoc evidence,
broader templates, and broader fault/compatibility coverage remain open.

The implemented bounded extension closes ordered delivery only for same-template
clone/fill batches, without adding another record, package assembler, or
publisher:

1. `prepareReceiptBoundCloneFillOrderedFinalDelivery` snapshots the ordered
   candidate/record, complete project tuple, evidence references, output facts,
   and validators before its first `await`;
2. it requires 2–11 DeckSpec slides to use the one exact
   `source-slide-clone-fill@0.1.0` selection and requires every ordered
   `sourceBuild` to remain the honest `clone-fill-source` branch;
3. one resolver plan executes the entire frozen DeckSpec batch, every returned
   semantic plan is applied to the exact source/index through M2-005A, and the
   resulting authentic one-slide artifacts enter the unchanged ordered
   assembler;
4. the complete regenerated ordered archive, base artifact identity, slide
   order/allocation/source hashes, and deck diff must equal the reviewed
   candidate and record; the source-to-output part relation is independently
   recomputed;
5. mechanical and render receipts must enumerate all slide IDs in exact order,
   and compatibility must authenticate `ordered-deck-open-save-reopen`; and
6. `QaReport` remains build-scoped, `BuildArtifact` lists every slide, and the
   shared create-only publisher still exposes `BuildArtifact` last.

Eleven focused tests cover success/publication, the executable 11-slide edge,
12-slide pre-dispatch rejection, readable content and order drift,
target-specific native source rejection, complete-slide evidence, compatibility
purpose, and caller mutation after the async boundary. The direct/OMML/ordered
final focus passed 55/55 and the complete suite passed 990/990 at that
implementation boundary. Eleven is the
last artifact size that fits the unchanged 32-entry secure-ZIP profile: the
admitted package grammar has ten fixed parts plus two per slide. The bounded
review found one medium mismatch in the former 16-slide execution claim; after
the 11-slide limit and 11/12 boundary regressions were added, re-review found no
blocker, high, or medium issue.

The missing external compatibility receipt is now closed only for one fixed
two-slide public-synthetic clone/fill candidate. The optional trusted macOS
adapter requires an explicit local flag, refuses CI, accepts only absolute file
arguments, refuses pre-open user presentations, and uses PowerPoint's static
object model without shell, System Events, or VBA. PowerPoint 16.111.3 opened
the exact candidate, exported a before PDF, saved a new PPTX, closed, reopened,
re-read the exact two-slide text inventory in order, and exported an after PDF.
The source bytes remained unchanged. Corresponding 1600 × 900 pages were
byte-identical, and one independent pixel-only review of anonymous frozen sets
found no blocker, high, medium, or minor issue. Raw candidate, roundtrip, PDFs,
pixels, transcript, and review remain ignored local evidence.

Eight focused adapter tests and the complete 998/998 suite pass with this exact
compatibility boundary in place.

This does not broaden the public-synthetic grammar or prove the full 2–11 range,
arbitrary templates, target-specific native/OMML ordered delivery, formula-
content editability, or product support. `supportClaimsEnabled` remains false.

## Fixed mixed ordered closure — 2026-08-10

The next complete vertical slice removes the fixed story's former mixed-source
delivery gap without broadening the grammar:

1. one readable three-slide `DeckSpec` owns the
   `clone/fill → typed OMML → native card-arrow` order and payloads;
2. one resolver batch preflights all three selections before any executor runs;
3. each result is applied through its existing source-preserving target-specific
   assembler, retaining its complete IR, composed plan, constraint receipt,
   diff, capacity, IDs, and capability evidence;
4. the unchanged ordered assembler rebuilds the exact story, and
   `prepareReceiptBoundMixedOrderedFinalDelivery` regenerates and compares the
   full archive plus CandidateBuildRecord before consulting any receipt;
5. mechanical/render receipts cover all three slide IDs in exact order,
   compatibility remains purpose-bound to `ordered-deck-open-save-reopen`, and
   the shared publisher exposes `BuildArtifact` last; and
6. source-build swaps, readable story or LaTeX drift, a later preflight failure,
   incomplete receipts, wrong-purpose compatibility, and mutation after the
   async snapshot all fail closed.

The exact public-synthetic mixed candidate passed PowerPoint 16.111.3
open/save/reopen. The formula target now serializes as
`mc:AlternateContent`: an ordinary shape containing
`a14:m → m:oMathPara → m:oMath` in the Office 2010 choice, and a separate
editable linear-text shape in the fallback. The choice removes the text-box
marker required to keep the native math ordinary-shape compatible; the fallback
retains it. Both paths use Cambria Math at 48 pt. No generator-authored raster or
relationship is introduced.

The first compatible render made the formula too small. Expanding the preserved
semantic slot and raising the formula to 48 pt produced a readable final result
without overlap. All three 1600 × 900 before/after page pairs are byte-identical.
The bounded independent reviewer ultimately found no defect, but only after
withdrawing a false missing-text report caused by transient incomplete image
display. D-030 therefore makes exact equality deterministic authority, collapses
duplicate comparison images, and requires a second read of the exact image
before any blank/missing-content finding. `prepareVisualEvidencePlan` now makes
the equality step executable: it snapshots bounded bytes, uses exact byte
comparison rather than a digest alone, and emits only the image IDs a reviewer
actually needs.

The PowerPoint adapter also now uses one stable ignored carrier basename and
updates that regular file in place, verifying unchanged device/inode identity
and exact new bytes. This minimizes repeated macOS consent while preserving the
product boundary: the carrier is a trusted local probe transport, not an input
template, candidate publication, or semantic authority. Product generation
remains create-only and source templates remain read-only.

This closes only the fixed mixed public-synthetic implementation and its local
ordered save/reopen fact. The immediately following D-031 slice closes the
same-candidate evidence-to-`BuildArtifact` chain for these exact bytes; it still
does not satisfy the human `formula-content-edit-save-reopen` gate, arbitrary
mixed stories/templates, public CI, or support.

## D-031 same-candidate evidence closure — 2026-08-10

One readable manifest now binds the exact mixed candidate and
CandidateBuildRecord, the purpose-bound PowerPoint receipt, captured before/after
PDFs, the exact three-page render relation, and the independent pixel-only
review. Manifest creation and inspection are public pure-data operations only:
inspection returns frozen `authority: none` facts and cannot mint a token or
publish anything.

The fixed trusted-local CLI owns the authority seam. It refuses CI, uses the
existing ignored PowerPoint evidence root, requires explicit Poppler
`pdftoppm`/`pdfinfo` executables, snapshots every bounded regular input through
an `O_NOFOLLOW` file handle, rejects extra PDF pages, rerasterizes the captured
PDF bytes at 120 dpi, and exact-compares every PNG. Only after those checks and
the frozen pixel review pass does an unexported same-process closure issue the
four one-shot receipts consumed by the existing mixed final preparer.
`BuildArtifact` remains the last publication marker.

The fresh local finalize run published the exact candidate SHA-256
`ccbffcb1a37d05c533ab92005da308c9b42b8e5cae0a95f66191d0e2d51a2802`
under manifest
`5f9b0c23d3163f8d59385266d5e9f636db7dfd24e72dc45d207b2eb2920a1a42`
and render set
`render-98fd2a63de2af07e02c3de9a1738fb0da7121057fec202152f470c62eefff9ab`.
The bounded review's public-authority blocker, carrier-binding high, and
file/process medium were fixed; final re-review reports 0 blocker, 0 high, and
0 medium. Eleven focused tests and the complete 1032/1032 repository suite pass.
Support remains disabled, and the human formula-content edit plus broader
compatibility/fault/platform coverage remain open.

## D-032 formula-content edit observation boundary — 2026-08-11

One ignored PowerPoint derivative now records a real human change from the
fixed mixed candidate's readable `3/3` fraction to `2/3`, followed by save,
close, reopen, and confirmation that the result remains editable. The original
candidate, its CandidateBuildRecord, and the derivative are frozen under exact
SHA-256 values `ccbffcb1…2802`, `5a88c576…15c1`, and `2592ad9d…8d3`.

The public inspector is deliberately weaker than a compatibility recorder. It
accepts only detached bytes, verifies the candidate record, and reports the
readable before/after fraction plus narrow observed namespace topology. It has
no gate status, human facts, receipt, publisher, or support authority, and says
`closedGrammarValidated: false` because PowerPoint's rewritten OMML is not run
through the project's closed typed grammar.

The fixed trusted-local recorder alone admits the exact three digests and
source/slide relation. It records machine observations separately from explicit
operator statements, refuses CI, and emits only ignored feature-level evidence
marked `authority: none` and `deliveryEligible: false`. Alternate self-
consistent candidates, unrelated-slide changes, unknown package parts, record
drift, and unknown math nodes are covered by twelve focused tests. The complete
suite passes 1044/1044; final re-review reports 0 blocker and 0 high. One Medium
is accepted only at this ignored local boundary: Node.js lacks an `openat`
equivalent for the final create-only pathname, so `wx` prevents overwrite and
post-write directory identity checks detect, but cannot prevent, a same-
principal directory swap.

The operator explicitly confirmed that both opening and reopening occurred
without repair or conversion prompts, and the fixed recorder created a passing
feature-level `COMPAT-OMML-001` record. It cannot substitute for the exact
direct single-slide `formula-content-edit-save-reopen` receipt required by final
delivery, and it changes no support status.

## Fixed mixed publication fault closure — 2026-08-11

The exact fixed mixed profile now executes both sides of the existing shared
publication commit boundary. A cancellation after staging/publication begins
but before the `BuildArtifact` hard link must return
`commitState: not-committed`, `rollbackStatus: complete`, and leave no delivery
directory. A failure observed immediately after that final link must return
`FINAL_DELIVERY_COMMIT_UNCERTAIN`, set `rollbackStatus: not-attempted`, and
retain the candidate record, QA report, exact PPTX, and `BuildArtifact` for
reconciliation.

Both regressions pass against the real three-slide
`clone/fill -> typed OMML -> native card-arrow` preparation. The focused mixed
suite is 13/13 and the complete repository suite is 1046/1046. Production code
did not change: this profile uses the same create-only publisher and the same
commit marker as every other receipt-bound delivery path, so adding a mixed-only
recovery branch would be duplicated state and worse failure semantics.

## D-033 bounded M2-005 completion — 2026-08-11

M2-005 is complete for one exact fixed public-synthetic three-slide flow:
`clone/fill -> typed OMML -> native card-arrow`. Its readable source,
`TemplateIndex`, overlay, `DeckSpec`, `SlideLayoutIR`, `ComposedSlidePlan`,
candidate record, exact package diff, rendered pixels, compatibility facts,
`QaReport`, and final `BuildArtifact` form one replayable chain. The source stays
unchanged; the delivered PPTX is the exact reviewed candidate; publication is
create-only and atomic at the shared commit boundary.

This is the useful boundary. Requiring every target-specific ordering variant or
the unavailable direct single-slide OMML receipt before closing the assembly
milestone would turn one proven vertical slice into an unbounded capability
matrix. Those paths therefore continue to fail closed and may be implemented
only when a real delivery requirement justifies them. D-032 remains a separate
feature-level human observation and grants no receipt or delivery authority.

The complete repository suite passes 1046/1046. The forbidden-material and
provenance gates pass 201/201, the 60-row support matrix remains internally
consistent, and the contract gate passes. One bounded milestone-exit review
found 0 blocker, 0 high, and 0 medium. No support row or release claim changed.
The next dependency is M3-001: expose the already-proven public-synthetic flow
through the smallest stable CLI surface.
