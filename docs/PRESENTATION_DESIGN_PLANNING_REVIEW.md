# Presentation Design and Planning Review

## Decision

P1, the P2 staged blind/design reviewer, and the P3 controlled rendered
comparison are now implemented under `labs/`. P3 found a visible narrative
effect, a visible visual-language effect, and a delivery-context interaction,
so `M2-005C` may resume. Native shapes and formulas expand the rendering
vocabulary; they still do not make a presentation more persuasive or less
generic by themselves.

The earlier effect-first plan was still one layer too low. Its brief-to-layout
selector answers, “Which admitted composition fits these content units?” It
cannot answer the more important questions:

- What should this audience think, feel, decide, or do after the presentation?
- Which sequence of claims and evidence can cause that change?
- Why should this presentation look like this subject rather than any other?
- How should visual density, scale, and layout silhouette change across the
  whole deck?
- What visible evidence would prove that the chosen story and art direction
  worked?

The fundamental mechanism is therefore:

> Before laying out slides, turn one concrete communication job and the
> subject's own visual world into a frozen, testable deck hypothesis. Use that
> hypothesis to control narrative, art direction, page rhythm, layout choice,
> and rendered acceptance.

Everything after that—template induction, hard-fit layout selection, native
PPTX assembly, and visual repair—is an execution mechanism for the hypothesis.

## Scope and evidence

This review was completed on 2026-08-09 from official product documentation,
fixed public source revisions, papers, and current locally installed
presentation instructions. External projects were read-only references. No
source file, prompt, asset, sample deck, rendered image, build product, or Git
history from another project entered this repository.

Claims below distinguish public implementation evidence from product claims.
Closed commercial products expose workflows and outputs but not authoritative
layout algorithms. Visual observations from public example decks are treated
as observations, not as proof of audience comprehension.

Canva was reviewed only from public official material. Its current
[terms](https://www.canva.com/policies/terms-of-use/) bar access for competitive
performance benchmarking, scraping, and reverse engineering, so no logged-in
testing, automated sampling, or template extraction was performed.

## What the strongest systems actually contribute

| System | Mechanism that materially affects the result | Limitation that matters |
| --- | --- | --- |
| [Anthropic PPTX skill at `fa0fa64`](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/pptx/SKILL.md) | Requires a coherent theme-specific visual system, a recurring motif, and inspection of real slide renders. Its explicit rejection of generic blue, decorative bars, repeated layouts, and dashboard-like cards is a useful anti-default discipline. | It is primarily a production and visual-QA guide. It does not make audience change, claims, evidence, objections, and action a first-class deck graph; it can yield polished pages without a persuasive presentation. Its PPTX text, scripts, and assets are proprietary and cannot be imported; only independently phrased high-level mechanisms are considered here. |
| [Anthropic frontend-design skill](https://github.com/anthropics/claude-plugins-official/blob/d029127f7d29bdb8fd8902ac34dd7d5c8ba92b6e/plugins/frontend-design/skills/frontend-design/SKILL.md) | Treats design as a brief-conditioned hypothesis. It derives visual choices from the subject's materials, objects, and vernacular; externalizes palette, type, composition, one memorable signature, and one justified risk; then asks whether the same design would appear for an unrelated prompt. | It is not a presentation planner. It supplies no claim/evidence graph, slide roster, delivery-mode model, layout-capacity contract, or whole-deck acceptance protocol. |
| [Guizang PPT skill at `c91369c`](https://github.com/op7418/guizang-ppt-skill/tree/c91369c) | Its Swiss path makes content shape precede layout choice, holds a strict grid and one accent, distinguishes hero from information pages, gives a recurring motif a declared job, measures overflow, and requires inspection of complete renders. These are useful visual-grammar hypotheses for a technical deck. | It is an opinionated HTML-slide generator, not this project's PPTX pipeline or narrative planner. Its fixed 1280 × 720 canvas, theme locks, page quotas, browser runtime, presenter mode, WebGL path, CSS, templates, assets, and prompts are not imported. A Swiss lock is one experiment arm, not a universal definition of quality; the rendered result remains the authority when prose and helper CSS disagree. |
| [ppt-master at `5a76272`](https://github.com/hugohe3/ppt-master/tree/5a76272b413b82d2a305641c125aa35316965773) | Separates communication mode from visual style, writes the audience's before→after move for every page, freezes the complete page roster, and plans density rhythm before rendering. This is the strongest public example examined here of planning the presentation rather than decorating slides. | Safe style directions and a small narrative-mode vocabulary can become new defaults. Free-layout selection is largely one model's judgment, and whole-deck visual review is not a mandatory independent acceptance boundary. |
| [AWS spec-driven presentation maker at `5359eb1`](https://github.com/aws-samples/sample-spec-driven-presentation-maker/tree/5359eb1ee51c35900a7f1a24e9fadbb5ad03d40d) | Inserts three reviewable commitments before authoring: audience/decision brief, per-slide outline, and global art direction. It then uses actual PPTX previews for repair. Its architecture-diagram engine also shows the value of hard geometry defects before softer preferences. | The general slide composer still chooses composition freely; the layout search is specific to diagram internals rather than the normal deck path. The SVG judge has incomplete coverage and is not uniformly applied by every entry point. |
| [Microsoft Copilot Narrative Builder](https://www.microsoft.com/en-us/microsoft-365/blog/2024/11/07/the-latest-on-ai-at-work-november-2024/) | Places a cheap, editable, rejectable outline checkpoint before slide generation. Microsoft's [brand guidance](https://support.microsoft.com/en-US/PowerPoint/copilot/keep-your-presentation-on-brand-with-copilot) also recommends complete, purpose-filled sample slides so the system sees real hierarchy, density, and placeholder meaning rather than only brand colors. | A topic outline is not yet a causal claim/evidence graph. The closed product does not expose deterministic layout candidate search, deck-rhythm evaluation, or a finished-deck visual repair protocol. |
| [PPTAgent / DeepPresenter at `2419d30`](https://github.com/icip-cas/PPTAgent/tree/2419d30b134a71486523e95ded60b32489fd3c61) | PPTAgent converts a human reference deck into functional slide types, element schemas, and capacity-aware exemplars; DeepPresenter adds research, a global design plan, freer composition, and render reflection. The useful combination is human design prior plus content-specific direction plus perceptual feedback. | Reference-led quality is bounded by topic and brand fit. Representative selection, layout choice, and theme inheritance can preserve a mismatched design. Current public defaults do not guarantee a planner, heavy reflection, or independent whole-deck critic. |
| [Presenton at `1a1b7ae`](https://github.com/presenton/presenton/tree/1a1b7ae6134b31d7465d8f7fd065c1c9fa8eff97) | Selects layouts before filling them, then constrains generation with slot type, character, item, table, and chart capacities. This directly reduces overflow and hierarchy collapse. | It stabilizes template filling, not the central argument. The normal deck path has no equivalent of the template-builder's screenshot repair loop, and a single model layout-index call can still flatten the story into familiar cards and columns. |
| [Gamma](https://help.gamma.app/en/articles/11029130-what-s-the-fastest-way-to-transform-content-and-layouts) | Shrinks the design search space to responsive cards, semantic blocks, Smart Layouts, and a unified theme. The inference is that these constraints reduce common local alignment and restyling work; the public help pages do not establish a quality distribution. | The same fluid-card grammar can absorb excess content instead of forcing editing for stage time. Cards, columns, and galleries can turn an argument into a sequence of web sections; theme and image-style references mostly change skin rather than inventing a subject-specific visual language. |
| [Beautiful.ai](https://support.beautiful.ai/hc/en-us/articles/12885226948109-Creating-a-presentation-with-AI) | Separates commitments: a human can edit the low-cost text-only outline, Smart Slides compile pages inside a constrained adaptive grammar, and [Slide AI](https://support.beautiful.ai/hc/en-us/articles/43350069148557-Create-and-Edit-your-Slides-with-Slide-AI) offers reversible same-content local candidates with presentation context and optional exact-text preservation. | The finite grammar is both the stability source and the design ceiling. Switching templates can lose data when capacities differ; converting to a free Classic slide removes the guardrails. Candidate ranking, whole-deck rhythm handling, and independent visual QA are closed or undocumented. |
| [Canva Magic Design](https://www.canva.com/create/ai-presentations/) | Combines professional template priors, several near-finished whole-deck visual candidates, fast human perceptual ranking, and a layered editor. It uses the model as a design-space navigator and the human as the art-direction selector. | Template priors can drive the story toward familiar business rosters, stock visuals, and surface-level theme changes. Public material exposes no independent outline approval, claim/evidence graph, deck-rhythm planner, or finished-render verification loop. Canva AI 2.0's richer brief conversation is a research preview, not standard Magic Design evidence. |
| [PresentBench at `e70ff01`](https://github.com/PresentBench/PresentBench/tree/e70ff01da962274e1e3cc03f77ec435ad66c5eb6) | Replaces a generic holistic score with instance-specific, source-grounded, separately testable requirements. Missing facts, wrong facts, extra unsupported claims, and visual obligations cannot hide inside one pleasant average. | It evaluates completed static decks and does not generate or repair them. Its visual taste coverage remains largely generic, and its human-alignment study is useful directional evidence rather than proof of objective correctness. |
| Current Codex Presentations skill (`26.730.11710`) | Its prose already asks for a communication job, one purpose per slide, an arc, deliberate opening and closing, and render inspection. Those are good principles. | When visual direction is absent, the bundled 26-layout Grid library becomes the practical default: 14 two-column layouts and 15 dense layouts dominate a white/gray/blue, top-left-title grammar. The communication brief remains conversational context rather than an authenticated artifact. Mechanical quality is enforceable; subject specificity, originality, and whole-deck rhythm are not. |

The systems differ, but the recurring causal chain is consistent:

1. expose intent before pixels;
2. make story order cheap to reject;
3. constrain page construction with a real visual grammar;
4. inspect the artifact in the same rendered space as the audience; and
5. revise the wrong level instead of polishing a failed premise.

No examined implementation shows that package correctness, editability, a
large template catalog, or unconstrained layout generation alone creates a
good presentation.

## Visual audit of public examples

Three official `ppt-master` example exports at revision `5a76272` were exported
through PowerPoint and reviewed as complete contact sheets outside the
repository: [indie bookstore zine](https://github.com/hugohe3/ppt-master/blob/5a76272b413b82d2a305641c125aa35316965773/examples/ppt169_indie_bookstore_zine_guide/exports/indie_bookstore_zine_guide.pptx),
[Attention Is All You Need](https://github.com/hugohe3/ppt-master/blob/5a76272b413b82d2a305641c125aa35316965773/examples/ppt169_attention_is_all_you_need/exports/attention_is_all_you_need_narrated.pptx),
and [brutalist AI newspaper](https://github.com/hugohe3/ppt-master/blob/5a76272b413b82d2a305641c125aa35316965773/examples/ppt169_brutalist_ai_newspaper_2026/exports/brutalist_ai_newspaper_2026.pptx).
The inspection was useful because project descriptions and screenshots of
isolated slides hide cross-slide repetition.

### Subject-specific zine guide

The indie-bookstore zine example uses risograph-like color, print texture,
misregistration, editorial type, and recurring physical-publication motifs.
Many pages still use grids, but the deck does not feel generic because its
materials, typography, imagery, and compositional behavior come from the
subject. The corresponding [design specification](https://github.com/hugohe3/ppt-master/blob/5a76272b413b82d2a305641c125aa35316965773/examples/ppt169_indie_bookstore_zine_guide/design_spec.md)
describes that visual world and the page roster before implementation.

### Technical paper deck

The “Attention Is All You Need” example is clear and content-specific in its
diagrams, yet its blue-and-white palette, repeated top-left headings, rules,
tables, cards, and two-/three-column silhouettes make it feel closer to a
polished AI template. Correct diagrams improve meaning; they do not by
themselves create a distinctive deck-level experience.

### Brutalist newspaper deck

The brutalist newspaper example has a memorable identity and strong continuity,
but its extreme density is more suitable for reader-led inspection than a live
room. Distinctiveness is not the objective by itself. The correct target is
distinctiveness conditioned on delivery context and audience reading time.

These examples expose two important truths:

- a grid is not inherently generic; it becomes generic when its visual and
  semantic choices are interchangeable with another topic; and
- originality must be gated by the presentation situation, not maximized as a
  style score.

Here, “AI-looking” does not mean merely clean, blue, or card-based. It means
**low conditionality**: the visible decisions are weakly conditioned on the
specific subject, argument, audience, and delivery situation. Common symptoms
include the same title-plus-three-equal-cards silhouette on unrelated topics,
icons and accent bars that encode nothing, a generic gradient or stock image as
the only mood carrier, uniform density across the deck, decorative metaphors
that never return in the argument, and copy whose nouns can be replaced without
changing its rhetorical structure. This definition is testable without banning
any individual style.

## Where this project was optimizing the wrong layer

The current implementation has made real progress, but its evidence is narrower
than the prose implied.

1. The layout selector proves deterministic compatibility and hierarchy choice
   among admitted exemplars. It does not formulate the argument or visual
   language.
2. The three-slide synthetic story proves ordered assembly and a legible
   setup→evidence→resolution sequence. It does not prove a compelling full
   presentation.
3. Visual reviewer `0.1.0` is good at visible hygiene and basic goal alignment.
   It has no explicit criteria for subject specificity, decorative-semantic
   mismatch, interchangeable visual language, repeated layout silhouettes,
   deck rhythm, motif development, opening/closing payoff, or formulaic copy.
4. Its universal word, element, whitespace, and body-size gates are useful
   defaults but can misjudge a reader-led report, a live keynote, or a dense
   technical defense when used without delivery context.
5. A three-run consensus makes a rubric more reliable; it cannot make an
   incomplete rubric complete. The previous pass proves that the reviewed
   synthetic deck met the supplied hierarchy/readability contract, not that it
   reached excellent presentation design.
6. `M2-005C` would add editable components and formula vocabulary while leaving
   these upstream design failures untouched.

The correction is not more free-form prompting. The correction is to externalize
the missing design decisions, bind them to review evidence, and keep opaque
model preference outside the authoritative selection boundary.

## Clean-room target contract

D-023 formalizes rendered communication effect as the public product objective.
The planning experiment still remains under `labs/`: prompt-driven content and
design generation is not a core or required 0.x path, core packages must not
import model-assisted planning or review code, and lab output cannot authorize
package mutation or promote support.

### 1. Communication contract

Freeze these fields before an outline exists:

- specific audience and their starting belief or uncertainty;
- desired observable change or action;
- central claim, recommendation, or ask;
- presentation situation, speaking time, and reading distance;
- expected artifact afterlife: live-only, leave-behind, or both;
- allowed evidence sources and unresolved evidence gaps; and
- explicit non-goals.

“Inform stakeholders about X” is not enough. The contract must describe a
before→after change that can fail.

### 2. Narrative graph

Represent the deck as claim, evidence, objection, mechanism, example, decision,
and action nodes connected by causal, contrast, dependency, or zoom edges.
Section titles alone are insufficient.

Every node must survive a deletion test: removing it must either break the
argument or reveal that it never belonged. The graph then yields the ordered
slide roster; slide count is a consequence, not a target supplied to a text
splitter.

### 3. Slide contract

Each slide records:

- its narrative role and audience before→after move;
- one message stated as a claim rather than a topic label;
- required evidence identifiers and confidence boundaries;
- the visual job—compare, explain mechanism, establish scale, show proof,
  surface tension, or request action;
- the reason that visual job is better than prose;
- transition to the next graph node;
- delivery density; and
- required native editability, if any.

This contract is the instance-specific conformance source after a blind outcome
probe. It cannot by itself prove audience effect: a reviewer who first reads the
intended answer can only measure agreement with the planner.

### 4. Subject visual language

Before choosing layouts, extract the subject's own evidence-bearing materials,
objects, processes, environments, notation, and vernacular. Produce two or
three genuinely different art-direction candidates, not palette swaps.

The user-owned template has explicit precedence through three modes:

- **template-locked 0.x:** typography, palette, shape language, and structural
  rhythm are hard constraints. Subject specificity may come only from evidence,
  diagrams, charts, images, wording, and variations already allowed by the
  template. A valid restrained corporate or academic template cannot fail merely
  for being visually conservative.
- **template-flexible 0.x:** preserve identity-bearing tokens and recurring
  roles while selecting among the template's admitted visual and rhythm
  affordances. If the template cannot express required evidence legibly, return
  an explicit topic/template mismatch for human direction; never silently
  replace its design language.
- **scratch-lab:** derive candidates from the subject world only when no user
  template governs the result. This route remains experimental and cannot
  authorize core assembly.

Each candidate declares:

- palette roles, typography roles, image behavior, shape and line grammar;
- one deck-wide signature element and why it belongs to the subject;
- one justified visual risk;
- chart, diagram, and evidence-display behavior;
- continuity rules and allowed variation;
- forbidden defaults; and
- a rationale for every prominent design decision.

Use a topic-swap counterfactual only as a diagnostic. Ask which information-
bearing decisions lose meaning after the swap. Theme-colored decoration,
icons, textures, or stock imagery do not count as subject grounding; a restrained
grid can pass when its hierarchy and evidence encoding are the right answer for
the audience and template. Fail only a candidate that claims subject-specific
art direction yet has no evidence-bearing decision tied to the subject. Pair
this check with delivery fit and decorative-semantic mismatch so it never
rewards ornament for its own sake.

Select comparatively from low-fidelity whole-deck silhouettes, not from prose
style names. A human owns a material art-direction choice when one is available;
an independent visual critic may rank subject fit, delivery fit, and genericity
with explicit evidence, but it cannot silently authorize core mutation.

### 5. Rhythm plan

Plan the contact-sheet silhouette before detailed slide authoring. For every
slide, record:

- layout family and dominant visual carrier;
- density: anchor, normal, or deep-reading;
- scale and focal location;
- background/lightness state;
- motif use or deliberate absence; and
- relation to the previous and next slide.

Reject accidental repetition and random variation. Repetition must establish a
role; variation must mark a narrative change. Opening, chapter resets, evidence
peaks, synthesis, and close need different jobs rather than decorative novelty.

### 6. Layout compatibility and ranking

Only after the previous contracts are frozen should the existing selector run.
It should:

1. hard-reject missing semantic roles, slot capacities, required assets,
   reading-distance failures, and incompatible template inheritance;
2. rank survivors by semantic fit, evidence legibility, subject-language fit,
   contribution to rhythm, unused affordances, repetition penalty, and stable
   catalog order; and
3. expose the reasons and rejected candidates.

No single model score can authorize a layout. A model may propose candidates or
explanations, but deterministic contracts decide admissibility.

### 7. Four-lane review and typed repair

The next visual-review contract must separate four jobs:

1. **Mechanical lane:** deterministic overflow, clipping, overlap, geometry,
   contrast, capacity, and package/render consistency checks.
2. **Blind outcome lane:** reveal only the rendered deck, audience situation,
   delivery mode, and fixed viewing time. Do not reveal the intended takeaway,
   narrative graph, slide messages, art-direction rationale, candidate label, or
   baseline identity. Require the reviewer to reconstruct the takeaway,
   argument/evidence chain, uncertainty boundary, and requested action.
3. **Instance lane:** only after the blind response is frozen, compare it with
   independently approved hidden ground truth and atomic items projected from
   the communication, narrative, slide, and visual-language contracts. A
   missing required fact/evidence/action or an incorrect claim is non-votable:
   one reported failure triggers a bounded source- and crop-bound reconciliation
   rather than disappearing under 2-of-3 taste consensus.
4. **Whole-deck lane:** an independent, label-blind contact-sheet critic for
   subject conditionality, decorative-semantic fit, motif coherence, silhouette
   repetition, density rhythm, opening/closing payoff, and delivery fitness.
   It may assess a simulated audience proxy, but only real audience testing can
   establish actual comprehension or persuasion.

Every finding needs slide/region evidence and a repair level:

- `refine`: the hypothesis is sound; adjust hierarchy, crop, wording, spacing,
  or a local layout;
- `replan`: the slide role, evidence allocation, or deck rhythm is wrong; or
- `pivot`: the narrative premise or visual direction is wrong.

Keep the best rendered candidate before every repair. Stop after a bounded
number of non-improving revisions; do not confuse more rounds with progress.

## Ordered implementation plan

### P0 — review frozen on 2026-08-09

- record the clean-room evidence and current limitations;
- run one bounded independent challenge focused on whether this conclusion is
  still over-optimizing schemas instead of audience effect; and
- keep all external research notes, sample decks, and renders outside Git.

The challenge found one blocker, four high, and two medium gaps. The fixes added
the executable raw-input planner/selector, contract-blind outcome probe,
controlled comparison matrix, explicit template precedence, non-votable
required-item reconciliation, fixed evidence links, and D-023 governance
closure. The stable-snapshot recheck found no remaining blocker, high, or medium
issue.

### Skill responsibility boundary

- **Presentation Design** owns the upstream audience change, causal claim /
  evidence / action graph, slide jobs, opening and closing, and whole-deck
  rhythm. It proposes what must be communicated; it does not authorize OOXML
  mutation or award its own pass.
- **Guizang PPT skill** is a midstream visual-grammar reference. This P3 slice
  independently re-expresses its grid, hierarchy, single-accent, meaningful-
  motif, density-rhythm, and complete-render checks. The skill's HTML runtime,
  templates, assets, and fixed theme are outside the implementation boundary.
- **Presentation file tooling** supplies inspection and rendering mechanics. It
  does not replace the repository planner, reviewed layout selector, create-
  only writer, or evidence contracts.
- **This repository** alone owns raw-input capture, candidate derivation,
  template fit, PPTX assembly, pinned rendering, randomization, hash binding,
  and non-authorizing evidence. Core cannot import the optional labs.
- **The visual reviewer** is a frozen evaluator only. It may localize visible
  failures and classify the repair level; it cannot mutate a candidate, reveal
  its factor mapping, relax a support gate, or authorize its own fix.

The boundary prevents “use the Swiss skill” from becoming “make every deck
Swiss,” while also preventing pipeline correctness from substituting for the
pixels the audience actually sees.

### P1 — executable deck-planning and selection lab — implemented 2026-08-09

- add one repository-owned raw, text-only synthetic defense brief, bounded
  evidence inventory, independently approved hidden outcome key, and synthetic
  template profile with an explicit `template-locked`, `template-flexible`, or
  `scratch-lab` mode;
- implement an isolated lab planner that consumes those raw inputs and produces
  two or three complete `DeckHypothesisCandidate` objects containing a
  `CommunicationContract`, `NarrativeGraph`, `SlideContract[]`, visual-language
  proposal, and `RhythmPlan`—not pre-authored accepted plans;
- validate evidence references, exact input coverage, actual leave-one-node-out
  argument failure, template precedence, capacity preconditions, and bounded
  candidate completeness before review;
- implement an explicit selector that records external acceptance when available,
  otherwise returns a non-authorizing comparative recommendation with reasons;
- bind the accepted candidate and all rejected alternatives to one planning
  receipt, then feed only that receipt through the existing layout selector and
  assembly path; and
- test raw-input→candidates→selection→layouts→deck end to end. A hand-authored
  planning artifact or manually retouched candidate cannot satisfy the exit.

Implementation evidence: the repository-owned P1 bundle contains one raw
synthetic defense brief, three required evidence records, a locked synthetic
template profile, a separately approved hidden outcome key, and an explicit
selection fixture. A second provenance-managed approval fixture binds the
canonical selection digest; arbitrary acceptance JSON is recorded but remains
ineligible, and only a complete approval record whose canonical digest matches
the fixed reviewed registry mints an opaque module-private receipt token. The
planner deterministically emits three full hypotheses and ranks them
with a semantic tuple rather than fixed array position. Every candidate now
includes the complete bounded communication, graph, slide, visual-language,
subject-evidence, risk, continuity, and rhythm fields defined above. Input
coverage is recomputed exactly from actual item/evidence references. Separate
node-deletion records remove each node and its incident edges, then recompute
the opening, evidence bridge, bounded action, and causal-link invariants; every
removal must make the argument invalid. The planning template is bound to the
real proposal-set and layout-acceptance hashes.

The accepted proof-led token is projected through the existing reviewed layout
and ordered assembly path. The result is an exact three-page PPTX with zero
collateral changes and an assembly receipt binding planning, candidate, story,
layout, and output hashes. Fifteen focused tests cover the positive chain and
re-signed invalid coverage or node-deletion conclusions, forged/unapproved/
stale/swapped/incomplete decisions,
accessors, capacity, evidence, template binding/modes, scratch, and hand-
authored-injection cases. In locked mode the current renderer consumes only the
admitted brief and layout-family projection of the richer visual/rhythm plan;
P3 has now exercised the visible controlled subset described below. No public
contract or support row changes.

### P2 — visual reviewer `0.2.0` — implemented 2026-08-09

- replace universal density rules with delivery-mode-aware defaults;
- add the blind outcome, instance-specific, and whole-deck lanes above;
- add genericity, decorative-semantic mismatch, silhouette repetition, rhythm,
  signature coherence, and opening/closing calibration cases;
- add positive and negative controls for a strong restrained deck, a weak deck
  with conspicuous topic decoration, a strong subject-encoding deck, and a
  distinctive but delivery-inappropriate deck;
- preserve three independent runs for taste findings, evidence binding,
  blocker follow-up, and deterministic verdict derivation, while routing every
  required-evidence/fact/action disagreement to mandatory reconciliation; and
- test `refine`, `replan`, and `pivot` repair classification.

Implementation evidence: the staged prompt and closed union schema separate
blind outcome reconstruction, revealed instance comparison, and label-blind
whole-deck critique. A fixed reviewed evidence manifest pre-binds the assembly,
render set, anonymous contact sheet, delivery profile, every required-item
source/crop, and the whole-deck crop registry before the executable contract
freezes both three-report label-blind lanes under one opaque session. Only then
can it read the fixed reviewed hidden key and P1 atomic outcome manifest.
Matched items must cite the exact visible frozen slot; one non-matched required
item in any run creates mandatory source/crop-bound reconciliation. Ordinary
whole-deck taste findings retain two-of-three spatial and slide agreement,
incompatible locations remain unable-to-judge, and blockers use only their
freeze-time reviewed crop request for follow-up.
Caller-supplied simulated dismissals cannot authorize pass. Live-room,
leave-behind, and hybrid profiles replace universal density quotas. Eleven
text-only controls cover the four planned positive/negative anchors, negative
signature/motif/silhouette/opening/closing behavior, the same dense contact
sheet under live versus reader delivery, and unusable/not-visible, non-matched,
blocker/unable, and random-silhouette boundaries. Twenty-three focused tests
and the complete 842-test repository suite cover prompt leakage, schema
examples, opaque one-shot session/stage authority, exact
manifest/item/blind-slot/hash binding, non-votable disagreement, failure
precedence, severity/repair/verdict derivation, spatial/slide scope, caller crop
rejection, region and Proxy rejection, and core/support isolation. Evidence remains
`simulated-review-only`; the bounded closing recheck found no remaining blocker,
high, or medium. P3 then supplied the separate real-pixel controlled evidence.

### P3 — public synthetic controlled comparison — implemented 2026-08-09

- generate every candidate from the same P1 raw input and executable planner;
  forbid manual visual additions or candidate-specific repair budgets;
- isolate sequence effect by comparing the causal `evidence → boundary →
  decision` order with a predeclared `evidence → decision → boundary`
  permutation under the same visual grammar; do not generalize this narrow
  permutation into a topic-list-versus-causal-planning claim;
- isolate visual-language effect by holding the approved narrative, evidence,
  wording, and slide roles fixed while comparing a restrained generic grammar,
  a subject-grounded evidence-encoding grammar, and a stylized topic control
  predeclared as a negative hypothesis rather than assumed to be weak;
- repeat the relevant controls for live-room and leave-behind delivery so
  density and restraint are not judged against one universal style;
- render all candidates through the same pinned local renderer path, randomize
  labels and order, and compare complete contact sheets rather than hero
  slides; PowerPoint edit/save/reopen remains a separate manual compatibility
  gate and is not required for the optional visual comparison;
- freeze blind outcome responses before revealing the hidden answer and
  diagnostic contracts; run three isolated taste reviews plus mandatory
  reconciliation for every required-item disagreement; and
- preserve best-so-far outputs and report the factors separately. Do not claim
  actual audience effect from synthetic reviewer preference alone.

Implementation evidence: `controlled-comparison.mjs` derives all six arms from
one authenticated P1 selection. Its exact 2 × 3 design crosses the causal order
with one fixed action-before-boundary permutation and restrained-generic,
subject-grounded evidence encoding, and stylized-topic-control visual grammars.
All three visual arms contain the same three visible text nodes on every
logical slide—including the motif labels—so only geometry, scale, type, color,
and placement vary. It produces twelve delivery review cells over byte-identical
live-room/leave-behind deck pairs, three independent review orderings per
delivery mode, opaque HMAC labels, and one authenticated all-arm render handoff.
The caller cannot inject an arm, retouch a candidate, or assign a candidate-
specific repair budget.

`controlled-render-harness.mjs` writes six complete decks, eighteen one-slide
inputs, eighteen 1600 × 902 rendered PNGs, and six three-slide contact sheets
into one explicit create-only output root. A manifest is published last; partial
roots, renderer sidecars, extra artifacts, changed bytes, swapped candidates,
stale batch bindings, and selective reruns are rejected before an authoritative
manifest exists. Completed runs are hash-verified and reused
without launching the renderer. The local adapter invokes macOS Quick Look and
ImageMagick without a shell; it never invokes PowerPoint or creates random
temporary directories. The final unconfounded run is bound by matrix receipt
`65009c3b41bc1678bd7bc36ebfab3ec8b93524e99fecea2041995398eb58c490`,
render manifest
`e11ab84da264763899d8526bef3ed3383e174867492c35fa57f12a85347c1d10`,
render set
`f6c3e9b8a55ef8544b858661ff8d1ca034d1969ea6c1a48581060943c452d867`,
and contact-sheet set
`1e7bc1e52b3f86948baa267aa01bece147b1ce8cfe8eb513bc9d29c5afa4d7f7`.
Generated decks, pixels, and raw reviewer reports remain ignored local evidence.

The earlier diagnostic render/review pass exposed weak supporting contrast and
generic check labels, but a closing code review also found that its subject arm
contained more informative motif wording. That pass is retained only as repair
diagnosis, not factor evidence. The final matrix instead fixes every visible
word across the visual triplets and was reviewed afresh by three isolated
reviewers in randomized orders. After two disputed pixel claims were reconciled
against the exact anonymous source images and explicitly retracted, every
reviewer's top three candidates in both delivery contexts were the three causal
arms. The subject-grounded causal arm ranked first live in all three reviews and
first, first, and second as a leave-behind. The stylized mono control remained
competitive and led one leave-behind ranking because its repeated category
markers helped self-navigation; it never displaced the subject arm in the live
room. Delivery context therefore changed fitness judgments without changing
the causal-order result.

The shared remaining visual limitation is also concrete: `3/3` and `87%` are
still typographic assertions, not an editable review/control structure that
shows composition, owners, timing, or pass criteria. That becomes an input to
the next native-component slice rather than a reason to add candidate-specific
P3 repair.

Seventeen focused tests and the complete 859-test suite cover the matrix,
randomization, delivery identity, one-shot authority, renderer isolation,
create-only batch state, exact inventory, tamper detection, and stable reuse.
The isolated prose reviews were frozen operationally before factor reveal but
were not committed or promoted into the P2 token state machine. This is bounded
`simulated-review-only` preference evidence, not proof of audience
comprehension, arbitrary-template quality, package support, or PowerPoint
editability. Quick Look's gray fallback background also remains a limitation of
the admitted narrow synthetic OOXML grammar.

### P4 — resume `M2-005C`

P1–P3 now demonstrate that raw inputs—not hand-authored planning artifacts—can
produce, select, render, and blindly distinguish the controlled candidates.
Resume native component and OMML application. Those capabilities must serve an
already justified slide contract rather than become the next proxy for quality.

## Borrow and reject boundary

Borrow independently phrased mechanisms:

- editable outline checkpoints;
- audience before→after moves;
- communication mode separated from visual style;
- subject-derived visual language and a counterfactual conditionality diagnostic;
- reference-deck functional schemas and capacity profiles;
- layout-before-content with hard compatibility;
- contact-sheet rhythm planning;
- real-render feedback; and
- instance-specific atomic acceptance plus independent whole-deck critique.

Reject:

- copied prompts, code, templates, sample content, decks, or assets;
- proprietary Anthropic PPTX material as implementation source;
- executable model actions as an authoritative mutation surface;
- a generic grid, card system, theme, or template catalog as art direction;
- one-shot model layout selection or self-awarded acceptance;
- visual scores that reward decoration without semantic purpose;
- fluid overflow avoidance that substitutes for editing; and
- claims that editability, security, or package validity prove visual effect.

## Success criterion for the planning gate

The complete P1–P3 gate now succeeds for the bounded public-synthetic case.
Every arm came from the executable raw-input path and the same assembly/render
mechanism. Blinded review favored the stronger causal plan, did not reward the
action-before-boundary permutations, ranked the subject-grounded treatment
highest overall without proving that every stylized treatment is weak, changed
its criticism between live and reader delivery, and localized pixels instead of
awarding a vague style score. This remains simulated reviewer evidence, not
proof of real audience comprehension or persuasion.
