# Project Definition

## Product statement

PPTX Compiler is a template-grounded presentation compiler and quality loop for
producing PowerPoint files that communicate well from user-owned templates and
semantic slide data. It combines deterministic assembly with rendered-outcome
review: structural correctness enables delivery, but never substitutes for a
clear, persuasive visual result.

Its reusable unit is a declared capability, not a deck-specific script. A
project combines a template profile, semantic bindings, a capability overlay,
deck/slide specifications, and local assets. Onboarding should produce these
data artifacts without generating renderer code. When genuinely new behavior
is required, it is implemented once as a tested extension package.

## Intended users

- teams that must preserve a supplied corporate or academic template;
- developers building deterministic document workflows;
- reviewers who need auditable OOXML, relationship, geometry, and collateral
  mutation evidence;
- advanced users who need native text, shapes, and formulas where the declared
  capability supports them.
- authors who want the supplied template's design language preserved while
  content, layout, and visual hierarchy are checked against an audience goal.

## Version 0.x inputs

- user-owned `.pptx` or `.potx` template;
- versioned project and template profile;
- data-only capability overlay and semantic shape bindings;
- schema-validated deck and slide specifications;
- local PNG, JPEG, or SVG assets under an explicit asset policy;
- optional LaTeX formulas routed through an external Pandoc/OMML adapter.

Every accepted input is explicit. The tool does not search a workstation for
templates, fonts, helpers, or assets.

## Version 0.x outputs

- create-only PPTX output;
- one candidate build record containing replayable `SlideLayoutIR` plus a
  frozen `ComposedSlidePlan`, so later layout edits retain both design
  constraints and the exact geometry used; the source template owns unchanged
  inherited content/package structure, authored semantic content and
  relationships remain in the raw brief, evidence, and `DeckSpec`, and a
  standalone PPTX is never accepted as the source of either layer;
- normalized template/deck index;
- validation, capacity, relationship, geometry, semantic-diff, and isolation
  reports;
- an optional rendered visual-review report with evidence-grounded repair
  actions and a deterministic pass/revise/fail decision;
- a machine-readable list of manual or unavailable compatibility gates.

Editability is capability-specific. The tool never infers native editability
from visual similarity.

A structurally authenticated PPTX is a candidate, not a final delivery. Final
publication requires the same artifact to satisfy deterministic mechanical
checks, rendering, independent pixel review, and any required compatibility
gate. The reviewer supplies evidence and never authorizes its own repair.
Hashes only bind exact boundary objects; they do not replace the readable
planning model or prove semantic equivalence. Final publication reuses the
existing `QaReport` and `BuildArtifact` contracts. Its boundary must reuse
generation's deterministic layout calculation to re-derive and exact-compare
the complete `SlideLayoutIR`/`ComposedSlidePlan` from readable
source/index/DeckSpec facts; matching pixels or one resolved box cannot
authenticate the stored constraints.

## Target initial capabilities

These are roadmap targets, not current support claims. The normative current
state is in `policy/support-matrix.json`; its claim switch remains false until a
public executable vertical slice has complete conformance evidence.

- PPTX/POTX package inspection and feature classification;
- hash-bound template profile and project overlay;
- data-driven source-slide clone/fill;
- a small registry of native DrawingML components;
- local raster/SVG asset placement;
- optional one-shape native OMML transplantation;
- source immutability and collateral-mutation checks.

## Explicit non-goals for 0.x

- prompt-driven content or design generation as a core or required 0.x path;
- semantic import from arbitrary Figma, PDF, HTML, image, or office files;
- native chart/table generation until separately specified;
- transparent support for macros, ActiveX, OLE, embedded files, arbitrary
  animations, or unknown vendor XML;
- pixel-perfect or editability certification without the required PowerPoint
  runtime/manual evidence;
- a universal PowerPoint object-model replacement.

D-023 permits prompt-driven planning and rendered review only as optional,
non-authorizing `labs/` experiments. Core cannot import them; they cannot select
executors, mutate packages, promote support, or turn model preference into an
audience-effect claim.

## Success criteria

The project is generic when a new supported template can be onboarded through
inspection, semantic binding, and data files; content can be matched to an
admitted template-derived layout; an existing executor renders it; unsupported
features fail with an actionable diagnostic; and no source edit is needed
merely to change template, content, or asset paths.

The product succeeds for users when the rendered deck also achieves its stated
audience outcome, exposes its intended takeaway within a delivery-mode-
appropriate viewing time, and has no confirmed blocking or major visual defect.
Five seconds is the default only for live-room message slides, not for a deep-
reading leave-behind. A build that is structurally valid but visually fails
remains a failed delivery candidate.

An optional model review can supply only simulated audience-proxy evidence.
Claims about actual comprehension, recall, persuasion, or decision quality
require appropriate human audience evidence and cannot be inferred from a model
preference score.
