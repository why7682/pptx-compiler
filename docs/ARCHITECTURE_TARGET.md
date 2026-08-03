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
- `TemplateProfile`, `TemplatePackageView`, and `TemplateIndex`;
- `CapabilityDefinition`, `CapabilityExecutor`, and `CapabilityRegistry`;
- `ProjectOverlay` and `ShapeBinding`;
- `DeckSpec` and `SlideSpec`;
- `BuildArtifact`, `QaReport`, and `ManualGate`;
- `SupportMatrix` and the public compatibility policy.

Each serialized data contract receives a JSON Schema and TypeScript type
generated or checked from one normative source. Runtime-only contracts keep one
executable source shape and receive their publishable type surface with package
metadata. Unknown fields and version mismatches are handled by an explicit
compatibility policy.

M1-002 implements data-contract version `0.1.0` for `ProjectConfig`,
`TemplateProfile`, `TemplateIndex`, `CapabilityRegistry`, `ProjectOverlay`,
`DeckSpec`, `BuildArtifact`, and `QaReport`, including the nested data
structures named above. JSON Schema remains normative and the checked-in
TypeScript declarations are generated from it. M1-003 implements
`ProjectContext` as a side-effect-free runtime contract composed from an
explicit absolute root, the normative `ProjectConfig`, and an injected schema
validator. It resolves only lexical locations and creates no second serialized
authority; its publishable package/type surface remains M3-002.
M1-004 implements `TemplatePackageView` as a runtime-only, already-parsed
semantic graph and a pure inspector that validates that graph and emits the
normative `TemplateIndex`. Core performs no filesystem, archive, decompression,
or XML I/O. M1-005 adds a separate one-step consumer that reads only the source
bound by `ProjectContext`, validates a fixed bounded ZIP/XML/OPC profile, and
creates the same view with producer class `secure-ooxml-ingestion`. The direct
semantic API still treats every producer label as structural metadata rather
than a security credential; only the high-level opened-handle-to-index chain is
secure-ingestion evidence. The grammar remains limited to the repository-owned
public minimal fixture class and fails closed on unknown vocabulary.
M2-001 implements `CapabilityExecutor` and the dispatcher as runtime-only
contract version `0.1.0` without changing the serialized data-contract set. A
registry string naming an executor is not dispatchability evidence. Only an
atomically admitted trusted registration with exact executor, input/output
schema documents and validators, nonempty conformance fixtures, QA assertions,
and support-policy binding enters the private executable map. The public
contract probe is conformance-only and is not a product capability.

Dispatch uses a frozen runtime facade, full-batch synchronous validation and
preflight, an opaque module-authenticated one-shot plan, and ordered execution
with post-output schema and QA checks. Executor IDs are never module paths;
there is no dynamic import, ambient lookup, semver fallback, or incremental
registration. M2-001 provides executors no filesystem or staging authority.
Trusted product executors, overlay/index resolution, staged mutation, rollback,
and publication enter only in later M2 slices.

## Capability resolution

```text
SlideSpec
  -> schema validation
  -> project overlay resolution
  -> capability lookup
  -> support-policy authorization
  -> executor preflight
  -> source/template binding validation
  -> staged mutation
  -> package normalization
  -> QA and collateral diff
  -> atomic output publication
```

There is no generic fallback to deck-specific code. If resolution is ambiguous
or an executor is absent, the build fails before modifying an output package.
All invocations in one batch must pass lookup, input validation, binding checks,
support authorization, and preflight before the first executor runs.

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
