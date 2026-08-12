# Effect-First Implementation Plan

## Product thesis

The fundamental user value is not mutability, archive safety, or a novel API.
It is consistently producing a presentation that communicates better than a
generic slide generator while preserving the user's chosen design language.

The shortest description is:

> Turn a strong human-made template into a semantic design system, select the
> right layout for the content, render the result, observe what an audience
> would actually see, and repair visible failures before delivery.

Native editability, deterministic output, and fail-closed package handling are
enabling constraints. They make the visual loop dependable; they are not a
substitute for the outcome.

## Correction after implementation-level review

The first version of this plan still put too much weight on the writer. That
was backwards. `M2-005A` proves that the repository can create one real PPTX,
but cloning and filling a slide cannot decide what the slide should accomplish
or which template composition best communicates it.

The missing fundamental layer is now explicit:

> Convert an audience goal, one primary takeaway, and its supporting evidence
> into semantic content units; match those units to a template-derived layout
> profile; only then assemble and review the result.

The visual reviewer detects a miss after rendering. It does not supply this
selection layer, and further prompt tuning cannot replace it.

## Second correction after deck-level design review

The selection correction above was necessary, but it was not yet fundamental.
It starts with semantic units and asks which admitted layout fits them. A strong
presentation must first decide what argument those units belong to and why the
deck should have a subject-specific visual identity.

The revised fundamental layer is:

> Convert one concrete audience change and the subject's own visual world into
> a frozen, testable deck hypothesis; derive the narrative graph, slide
> contracts, art direction, and whole-deck rhythm from that hypothesis before
> selecting layouts.

Layout matching is the first execution stage for this hypothesis, not the
source of presentation quality. Native components, formulas, editability,
determinism, and secure package handling remain important enabling constraints.
None can rescue a generic or causally weak deck plan.

The primary-source benchmark, public-example visual audit, self-critique, and
clean-room target contract are recorded in
`docs/PRESENTATION_DESIGN_PLANNING_REVIEW.md`. Prompt-driven planning remains a
non-authorizing `labs/` experiment and is not imported by core.

## Commit-pinned public implementation study

No external source, history, prompt, fixture, binary, or build product was
imported into this repository. The projects below were inspected only as public
read-only references. This document records independently phrased patterns,
not copied implementation.

| Public project | Verified implementation experience | Borrow / reject |
| --- | --- | --- |
| [OfficeCLI at `459b1a4`](https://github.com/iOfficeAI/OfficeCLI/tree/459b1a473faf33f2f52e697ac6d265a3f67b176a) | Its [node builder](https://github.com/iOfficeAI/OfficeCLI/blob/459b1a473faf33f2f52e697ac6d265a3f67b176a/src/officecli/Handlers/Pptx/PowerPointHandler.NodeBuilder.cs#L111-L245) preserves source order, group nesting, typed objects, and addressable paths; [issue view](https://github.com/iOfficeAI/OfficeCLI/blob/459b1a473faf33f2f52e697ac6d265a3f67b176a/src/officecli/Handlers/Pptx/PowerPointHandler.View.cs#L515-L1018) reports findings against those paths. | Borrow stable semantic paths. Reject typed-plus-raw replay and its independent HTML renderer as fidelity authority. |
| [ppt-master at `4dcf3c9`](https://github.com/hugohe3/ppt-master/tree/4dcf3c97f40712ccb18311b7c40a06e9ec92da98) | [Template analysis](https://github.com/hugohe3/ppt-master/blob/4dcf3c97f40712ccb18311b7c40a06e9ec92da98/skills/ppt-master/scripts/template_fill_pptx/analyzer.py#L236-L330) inventories slots, geometry, tables, charts, diagrams, and fill risks. Its [page roster](https://github.com/hugohe3/ppt-master/blob/4dcf3c97f40712ccb18311b7c40a06e9ec92da98/skills/ppt-master/references/strategist.md#L460-L510) records message, audience move, wording, layout, and evidence resources before authoring. | Borrow the source-facts → frozen page contract → create-only application boundary. Reject model-authored SVG as the canonical product IR and heuristic page classification as truth. |
| [PPTAgent at `2419d30`](https://github.com/icip-cas/PPTAgent/tree/2419d30b134a71486523e95ded60b32489fd3c61) | [`SlideInducter`](https://github.com/icip-cas/PPTAgent/blob/2419d30b134a71486523e95ded60b32489fd3c61/pptagent/induct.py#L37-L209) clusters reference slides into functions/layouts and extracts element schemas; [`Layout`](https://github.com/icip-cas/PPTAgent/blob/2419d30b134a71486523e95ded60b32489fd3c61/pptagent/presentation/layout.py#L21-L134) records element type, variable cardinality, and suggested text length. | Borrow template-derived function/schema/capacity profiles. Reject free-form LLM layout choice, executable action strings, mutable induction state, and self-review as acceptance. |
| [AWS spec-driven maker at `5359eb1`](https://github.com/aws-samples/sample-spec-driven-presentation-maker/tree/5359eb1ee51c35900a7f1a24e9fadbb5ad03d40d) | [`layout_search.py`](https://github.com/aws-samples/sample-spec-driven-presentation-maker/blob/5359eb1ee51c35900a7f1a24e9fadbb5ad03d40d/sdpm/scripts/layout_search.py) searches orientation and alignment candidates inside architecture/flow diagrams; [`metrics.py`](https://github.com/aws-samples/sample-spec-driven-presentation-maker/blob/5359eb1ee51c35900a7f1a24e9fadbb5ad03d40d/sdpm/sdpm/engine/layout/metrics.py#L189-L250) ranks overflow before weighted geometry defects and aesthetic tie-breaks; [`judge.py`](https://github.com/aws-samples/sample-spec-driven-presentation-maker/blob/5359eb1ee51c35900a7f1a24e9fadbb5ad03d40d/sdpm/sdpm/engine/preview/judge.py) measures a bounded set of collision, overflow, and contrast defects from LibreOffice SVG. General slide composition remains model-directed, and not every entry path runs the judge. | Borrow the approved brief→outline→art-direction boundary, hard constraints followed by an explainable lexicographic objective, and real-render measures. Reject treating the specialized search or partial judge as a general deck-layout authority. |
| [Presenton at `bed1fc6`](https://github.com/presenton/presenton/tree/bed1fc6c31b94d844191893a1c212d8fbe0f6d0b) | Its [schema extractor](https://github.com/presenton/presenton/blob/bed1fc6c31b94d844191893a1c212d8fbe0f6d0b/servers/fastapi/templates/v2/schema.py#L51-L183) exposes only editable semantic content while leaving geometry/decorative elements template-owned; its [preview loop](https://github.com/presenton/presenton/blob/bed1fc6c31b94d844191893a1c212d8fbe0f6d0b/servers/fastapi/templates/v2/generation.py#L1014-L1240) feeds bounded renders back to the model. | Borrow content-only schemas over frozen layouts. Reject the loophole that accepts JSON without a preview and any nondeterministic self-review verdict. |
| [pptx-automizer at `6466d43`](https://github.com/singerla/pptx-automizer/tree/6466d43abc6a9410b10b801d3aa1b510cc128446) | [`Slide.append`](https://github.com/singerla/pptx-automizer/blob/6466d43abc6a9410b10b801d3aa1b510cc128446/src/classes/slide.ts#L36-L66) copies the authentic slide and known relationship-dependent content before targeted modifications. | Borrow typed relationship-closure cloning. Reject relationship-order slide discovery, log-and-continue misses, random identities, and relationship integrity as a visual claim. |
| [docxtemplater at `6a114d2`](https://github.com/open-xml-templating/docxtemplater/tree/6a114d2edfd7d62f458d21c839a9e214b73eb6be) | [`compile`](https://github.com/open-xml-templating/docxtemplater/blob/6a114d2edfd7d62f458d21c839a9e214b73eb6be/es6/docxtemplater.js#L541-L610) performs whole-batch preparse, parse, postparse, then error verification; [`XmlTemplater`](https://github.com/open-xml-templating/docxtemplater/blob/6a114d2edfd7d62f458d21c839a9e214b73eb6be/es6/xml-templater.js#L82-L125) can bind text across XML runs without rewriting untouched content. | Borrow phase-separated batch preflight and run-crossing text binding. Reject its mutable module protocol as a slide graph assembler. |
| [pptxtojson at `2b12fce`](https://github.com/pipipi-pikachu/pptxtojson/tree/2b12fceb1d1ca4e1436480afa485567dbd1101c4) | [`processSingleSlide`](https://github.com/pipipi-pikachu/pptxtojson/blob/2b12fceb1d1ca4e1436480afa485567dbd1101c4/src/pptxtojson.js#L143-L300) resolves inherited layout/master/theme/media and normalizes known nodes. | Borrow only the layered read-only diagnostic model. Reject numeric-filename slide order, string path resolution, duplicate-key overwrite, silent XML failure, and lossy JSON round-trip. |

The projects agree on one point even though they implement it differently:
good results come from constraining generation with a content schema derived
from a visual system. None demonstrates that package correctness alone creates
a persuasive slide.

## Patterns adopted

1. **Outcome-bearing slide brief.** Every slide names its function, audience
   goal, primary takeaway, evidence policy, and semantic content units.
2. **Template-derived layout profile.** Each admitted exemplar declares its
   function, editable slots, accepted semantic roles/types, cardinality, and
   capacity; decorative geometry stays template-owned.
3. **Hard-fit then lexicographic matching.** Reject missing slots, assets,
   evidence, or capacity first. Rank survivors by exact function/role/type fit,
   unused affordances, capacity slack, and stable catalog order. No opaque model
   score selects the authoritative layout.
4. **Schema-bound content generation.** A model, when used, supplies only the
   semantic fields exposed by the selected profile.
5. **Native target rebuild.** Reconstruct the admitted target with local IDs
   and relationship closure instead of global textual patching.
6. **Render-measure-review-repair.** Deterministic render measures and the
   isolated visual reviewer produce evidence; repair changes the brief,
   layout selection, or bounded content before touching lower-level OOXML.
7. **Whole-batch postflight.** Package validity, semantic diff, collateral
   mutation, and publication are checked separately from visual judgment.

## Patterns deliberately not adopted

- HTML, SVG, or screenshots as the canonical editable representation;
- raw XML callbacks as a public capability surface;
- a universal `addText`/`addShape` API as the product differentiator;
- one model call that invents content, layout, implementation, and its own
  acceptance score;
- visual review that awards credit for compilation or package validity;
- automatic flattening when an editable object cannot be rebuilt safely.

## Ordered implementation plan

### 0. Visual acceptance contract — implemented as a hygiene baseline

`labs/visual-review-agent/` now contains an evidence-first multimodal review
prompt, a closed report schema, four calibration labels, and deterministic
verdict derivation. Its executable aggregator requires three reports bound to
one externally supplied review-context digest, constrained complete-linkage
2-of-3 agreement for ordinary findings, and a context- and crop-bound confirmed
or dismissed follow-up for every blocker before returning a final verdict. Its calibration
exercise is complete for hierarchy, readability, visible defects, and basic
goal alignment. Deck-level research exposed new empirical failure classes:
interchangeable visual language, decorative-semantic mismatch, silhouette
repetition, weak density rhythm, and missing opening/closing payoff. Version
`0.1.0` therefore remains valid for its narrow evidence but is not a design-
excellence gate; a delivery-aware `0.2.0` contract is required below.

### 1. Public implementation extraction — completed

The commit-pinned study above replaced feature-list comparison with actual
control-flow traces. The source was not vendored and no public-project history,
worktree, prompt, asset, or fixture entered this repository.

### 2. Brief-to-layout matching lab — implemented

`labs/layout-selection/layout-selector.mjs` introduces the first clean-room
effect-bearing slice. It validates a slide brief with an explicit audience goal,
primary takeaway, evidence policy, and available-asset inventory; assigns
semantic units to admitted template slots; rejects missing roles/types/assets
and per-kind capacity; and selects from fully searched survivors with an
explainable lexicographic tuple rather than model scores. Individual layouts and
the complete request have deterministic search budgets, and an incomplete
catalog can never yield an authoritative selection. The lab does not mutate a
package or change any public support claim.

### Bounded independent challenge

The first independent closing review found no blocker but found three high and
three medium gaps: replaceable source-index semantics, wildcard capacity and
request-resource bypasses, archive copying before limits, shallow visual-report
validation, prose-only three-run aggregation, and locale/asset-claim drift. The
implementation now re-derives exact source-order index facts, enforces all
capacity/input/search/archive bounds before authority, fully validates visual
reports, executes blocker-aware three-run aggregation, uses deterministic
code-unit ordering, and binds image units to an explicit asset inventory.
Successive rechecks also exposed and closed incomplete-catalog selection,
unbound review evidence, exact-ID clustering, and a single-linkage bridge that
could merge two spatial defects. The same reviewer's final pass found no
remaining blocker, high, or medium finding; 34/34 focused tests passed.

### 3. Reviewed template layout-profile bridge — multi-exemplar slice implemented

The first bounded bridge accepts exact public-synthetic `TemplateIndex` facts
and explicit reviewed roles/capacities for two text boxes. It emits a
selector-ready catalog plus exact geometry trace, then keeps the selected
clone/fill plan private inside one atomic selection-and-assembly call. Eight
focused tests close key-swap identity, final metric-capacity, accessor,
immutability, and real-assembly cases.

`labs/layout-selection/reviewed-profile-induction.mjs` now extends that boundary
across three distinct runtime-generated source exemplars. Its automatic phase
emits only redacted exact/style facts plus a deterministic salience hypothesis;
source wording and font names do not enter the proposal. A separate committed
review fixture binds the proposal-set and per-proposal hashes, accepts a clear
44/20 pt decision hierarchy and a clear 48/24 pt status hierarchy, and rejects
an equal 28/28 pt hierarchy as ambiguous. Only reviewed profiles with one
primary takeaway, one supporting evidence unit, minimum 24/18 pt type, and
capacity no greater than the geometry/type-size estimate can enter selection.
The winning exact source/index/profile is then assembled atomically through the
existing bridge. Ten focused tests cover redaction, frozen review staleness,
cross-source selection, source-order independence, capacity and ambiguity,
accessors, pre-copy archive limits, depth limits, and real deterministic PPTX
output. Automatic semantic inference is still not claimed.

See `docs/M2-005_PROFILE_INDUCTION.md` for the deterministic hashes and
three-run render evidence. The next extension belongs to the ordered
multi-slide graph; media affordances and broader content-only schemas remain
future reviewed profile vocabulary rather than inferred support.

### 4. Match-to-render vertical slice — bounded control completed

The public synthetic control holds geometry constant and reverses the semantic
assignment: exact-fit puts the action in the dominant title, while generic puts
the consensus count there. Deterministic PPTX hashes, 1600 × 902 Quick Look
renders, and three context-bound isolated visual runs are recorded in
`docs/M2-005_MATCH_TO_RENDER.md`. All reviewers preferred the action-first
hierarchy. One reviewer also flagged incomplete decision evidence and small
supporting type; those useful one-run findings are retained as next constraints
even though the 2-of-3 aggregate comparative verdict is `pass`.

### 5. M2-005A: first real renderable backend — implemented, held narrow

Apply one frozen `source-slide-clone-fill-plan` to the admitted one-slide
synthetic template, re-derive its exact source index and shape ordering, rebuild
the two target text nodes, convert POTX main content type to PPTX, prove all other
package parts byte-identical, create a deterministic bounded archive, and publish
without overwrite through same-directory staging.

This slice intentionally rejects multiple paragraphs, multiple output slides,
native components, formulas, unknown slide structures, and mutable plans.

### 6. M2-005B: bounded complete assembly graph — implemented

The first ordered effect slice now assembles the exact
`setup → evidence → resolution` story from three reviewed selections. Story,
review acceptance, and exemplars are captured once for the complete batch;
M2-005A reports are authenticated against their exact bytes; every content part
must belong to the exact typed relationship closure; and fresh slide parts,
presentation IDs, and relationship IDs are allocated deterministically. The
rebuilt PPTX passes secure re-ingestion and an allowed/collateral semantic diff,
while publication stays separate until the entire batch succeeds.

The first render review exposed generic evidence wording even though two runs
were silent. Repair named the review criteria and remaining checks; three fresh
runs then judged the goal met with no finding and the executable aggregator
returned `pass`. See `docs/M2-005_ORDERED_STORY_DECK.md`.

This is an exact three-act/two-element public-synthetic story, not arbitrary
deck generation. Broader narrative vocabulary remains behind later contracts
and evidence.

### 7. Deck-planning and design-review gate — P1 implemented

`labs/design-planning/deck-planner.mjs` now implements the P1 raw-input path. It
captures one repository-owned synthetic brief, evidence inventory, and explicit
template profile; derives three distinct proof-, constraint-, and readiness-led
`DeckHypothesisCandidate` objects; validates exact input coverage, actual
leave-one-node-out argument failure, template precedence, and the admitted
status/decision capacities; and emits a
non-authorizing comparative recommendation with an explicit deterministic
ranking tuple. A separate committed selection fixture binds the raw-input hash,
candidate-set hash, every candidate hash, one selected candidate, and both
rejected alternatives. A second provenance-managed approval fixture binds the
canonical acceptance digest, and its complete canonical record must match the
planner's fixed reviewed registry; a caller-created approval remains ineligible
and cannot mint the module-private receipt token consumed by projection. The
planning template binds the actual proposal-set and layout-acceptance hashes,
and the final assembly receipt joins the planning receipt, complete candidate,
story projection, layout evidence, and output PPTX. The scratch route remains
assembly-ineligible, and core imports no lab code.

Each candidate now records the complete bounded communication fields, claim /
evidence / action graph, slide confidence boundary, visual reason, transition,
density, editability, subject-bound evidence expressions, template-owned or
subject-derived visual roles, signature/risk/continuity/default rules, and a
carrier/focal/background/adjacency rhythm plan. The current locked-template
projection consumes and validates that plan, and P3 now demonstrates that its
admitted visual-language controls produce a visible difference in the bounded
public-synthetic case.

The P1 fixture also includes a separately approved hidden outcome key bound to
the same raw-input digest; the planner neither loads nor knows the answer.
Fifteen focused tests cover exact three-slide PPTX output, re-signed invalid
coverage and node-deletion conclusions, forged/stale/swapped decisions,
unapproved selection, candidate and input
drift, template/layout binding, template modes, capacity/evidence failures,
accessors, plan injection, and the disabled support boundary.

P2 is also executable. `review-v2-contract.mjs` adds delivery-aware profiles
and an opaque one-shot `prepared → consumed → blind-and-whole-frozen → revealed
→ reconciled` boundary. A
fixed reviewed evidence manifest first binds the assembly, renders, anonymous
contact sheet, all required-item source/crop records, and the whole-deck crop
registry. Exactly three blind runs and three label-blind whole-deck runs then
freeze under the same session before the fixed reviewed hidden key and P1
atomic outcome manifest can be read.
Every required item is evaluated once per run, matched status must cite the
exact visible frozen slot, and one non-match creates a deterministic
reconciliation bound to its preselected source render and crop. The independent
whole-deck lane covers nine exact design and delivery dimensions, binds every
blocker to a reviewed crop before follow-up, and requires two spatially and
slide-compatible runs for ordinary findings. Incompatible locations remain unable-to-judge, and simulated
dismissals cannot authorize pass. Code derives severity floors, repair class,
and final verdict. Eleven text-only calibrations include restrained, decoration,
subject-encoding, broken-sequence, identical-contact-sheet live-versus-reader,
unusable/not-visible, non-matched, blocker/unable, and random-silhouette
controls; twenty-three focused tests and the complete 842-test repository suite
pass. The bounded closing recheck independently reproduced the one-shot stage,
fixed-crop, assessable-slide, slide-scope, and same-digest cross-session
rejections and found no remaining blocker, high, or medium. The evidence
scope is `simulated-review-only`, not actual audience effect.

P3 completes the effect-bearing prerequisite with one label-randomized 2 × 3
matrix from the same P1 input and writer, twelve byte-bound delivery review
cells, six full contact sheets, and three isolated blind reviews. The causal
`evidence → boundary → decision` order beat the fixed action-before-boundary
permutation in every visual family. With every visible word held identical, the
subject-grounded arm ranked highest overall; the stylized control remained
competitive for reader delivery. A common-root visual repair improved secondary
contrast, and a later review-driven correction removed unequal motif wording
before the final render. Seventeen focused and 859 complete tests pass. Every
model-assisted artifact remains under `labs/`,
non-authorizing and unimportable by core. Generated pixels and raw prose reviews
remain ignored local evidence; PowerPoint edit/save/reopen is still a separate
manual compatibility gate.

See `docs/PRESENTATION_DESIGN_PLANNING_REVIEW.md` for the contract and ordered
subplan.

### 8. M2-005C: native component and formula application

- rebuild `native-card-arrow` from typed data with target-local shape IDs;
- rebuild the admitted OMML wrapper only in a compatible target text box;
- validate bounds, shape capacity, namespaces, and relationship closure;
- retain PowerPoint editability as a separate manual compatibility gate.

### 9. Renderer-independent visual evidence bundle

- render public synthetic outputs through an optional local oracle;
- record slide ordering, dimensions, font/geometry metadata, and image hashes;
- run deterministic overflow/overlap/capacity checks;
- feed only redacted public renders or explicitly approved local renders to the
  optional visual reviewer;
- derive pass/revise/fail outside the model.

Broad native/OMML coverage remains after the outcome-bearing path because it
adds editable vocabulary but does not improve layout choice by itself.

## Effect-oriented acceptance criteria

A candidate deck is visually ready only when:

- a contract-blind reviewer reconstructs the intended takeaway, evidence
  boundary, and action before the diagnostic contract is revealed;
- the simulated desired-audience outcome is `met`, without presenting that
  model judgment as real audience comprehension or persuasion evidence;
- no confirmed blocker or major visual finding remains;
- the primary takeaway is recognizable within the frozen delivery-mode target
  (five seconds only as the default for live-room message slides);
- the narrative sequence changes the stated audience belief or decision rather
  than merely covering topics;
- prominent visual decisions are grounded in the subject or the user-owned
  design language instead of an interchangeable generic grid;
- the contact sheet has deliberate density and silhouette rhythm appropriate
  to the delivery mode;
- decorative structures encode meaning or are removed;
- opening and closing perform distinct narrative jobs;
- reference/design-language fidelity is acceptable when a reference exists;
- no intended content is clipped, obscured, or unreadable;
- a repair iteration demonstrates that the reported root problem disappeared.

Structural success remains necessary for publication, but it cannot turn a
visually failed deck into a pass.
