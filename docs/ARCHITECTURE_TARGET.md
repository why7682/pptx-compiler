# Architecture Target

## Design principles

1. Explicit context replaces ambient repository roots and hard-coded files.
2. Schemas define every stable boundary before implementation.
3. Data selects capabilities; only executors contain rendering logic.
4. Support claims are executable contracts, not registry labels.
5. Core behavior is cross-platform; optional adapters isolate external tools and
   platform-specific PowerPoint automation.
6. Every build is deterministic, create-only, inspectable, and fail closed.

## Target layout

```text
packages/
  core/                    schemas, context, inspection, assembly, QA
  cli/                     stable command and JSON interfaces
  adapter-pandoc-omml/     optional external-process formula adapter
  powerpoint-macos/        optional manual/runtime evidence adapter
  testing/                 synthetic fixture and conformance utilities
plugins/
  clone-fill/
  native-card-arrow/
labs/
  codex-runner/            isolated token-efficiency experiment
schemas/
fixtures/
  source-parts/            reviewed, repository-owned text OOXML only
examples/
docs/adr/
```

The monorepo and high-level package split are accepted. Exact npm scopes and
publishable package names are deferred until package metadata is implemented.
The dependency direction is fixed: `core` cannot import CLI, platform adapters,
labs, private fixtures, or a presentation project.

## Public contracts

The first versioned contracts are:

- `ProjectConfig` and `ProjectContext`;
- `TemplateProfile` and `TemplateIndex`;
- `CapabilityDefinition`, `CapabilityExecutor`, and `CapabilityRegistry`;
- `ProjectOverlay` and `ShapeBinding`;
- `DeckSpec` and `SlideSpec`;
- `BuildArtifact`, `QaReport`, and `ManualGate`;
- `SupportMatrix` and the public compatibility policy.

Each contract receives a JSON Schema and TypeScript type generated or checked
from one normative source. Unknown fields and version mismatches are handled by
an explicit compatibility policy.

## Capability resolution

```text
SlideSpec
  -> schema validation
  -> project overlay resolution
  -> capability lookup
  -> executor preflight
  -> source/template binding validation
  -> staged mutation
  -> package normalization
  -> QA and collateral diff
  -> atomic output publication
```

There is no generic fallback to deck-specific code. If resolution is ambiguous
or an executor is absent, the build fails before modifying an output package.

## CLI surface

```text
pptx-pipeline init
pptx-pipeline doctor
pptx-pipeline inspect
pptx-pipeline onboard
pptx-pipeline validate
pptx-pipeline render
pptx-pipeline qa
pptx-pipeline diff
pptx-pipeline formula transplant
```

Commands must support deterministic JSON output, documented exit codes, path
redaction, explicit input/output paths, and non-interactive CI operation.

## Adapter boundaries

- Pandoc is invoked as a user-installed optional process. It is not bundled.
- macOS PowerPoint automation is an optional compatibility adapter and is never
  required by public CI.
- Font files are never bundled without explicit redistribution rights. Public
  SVG examples use a redistribution-safe font selected during the rights gate;
  native OMML may name a user-installed font without shipping it.
- Model-assisted task execution lives under `labs/` and cannot be imported by
  rendering packages.
