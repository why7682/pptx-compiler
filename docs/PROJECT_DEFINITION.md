# Project Definition

## Product statement

PPTX Pipeline is a deterministic, contract-driven, template-first compiler and
quality-assurance toolkit for producing editable PowerPoint files from
user-owned templates and semantic slide data.

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
- normalized template/deck index;
- validation, capacity, relationship, geometry, semantic-diff, and isolation
  reports;
- a machine-readable list of manual or unavailable compatibility gates.

Editability is capability-specific. The tool never infers native editability
from visual similarity.

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

- prompt-driven content or design generation;
- semantic import from arbitrary Figma, PDF, HTML, image, or office files;
- native chart/table generation until separately specified;
- transparent support for macros, ActiveX, OLE, embedded files, arbitrary
  animations, or unknown vendor XML;
- pixel-perfect or editability certification without the required PowerPoint
  runtime/manual evidence;
- a universal PowerPoint object-model replacement.

## Success criteria

The project is generic when a new supported template can be onboarded through
inspection, semantic binding, and data files; an existing executor renders it;
unsupported features fail with an actionable diagnostic; and no source edit is
needed merely to change template, content, or asset paths.
