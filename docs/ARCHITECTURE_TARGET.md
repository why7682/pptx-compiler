# PPTX Compiler Architecture

This document describes the current candidate-alpha architecture and the
stricter delivery boundary that candidates must eventually cross. It is a model
of authority, data, control flow, and executable contracts. Milestone history,
superseded states, individual repair runs, and review chronology belong in the
handoff, decision, and provenance records.

## Purpose and boundary

PPTX Compiler is intended to compile semantic presentation data against a
user-owned PowerPoint template while preserving the template's design language
and capability-specific native editability. It couples deterministic assembly
to rendered-outcome verification: structural validity can create a candidate,
but it cannot by itself authorize delivery.

The current public package boundary implements one exact candidate-alpha path:

```text
repository-owned synthetic POTX
  + schema-validated synthetic project
  + one explicitly opted-in native-card request
  -> deterministic candidate PPTX
  + CandidateBuildRecord
  -> schema-valid blocked QaReport
```

The blocked decision is intentional because the public CLI has no input channel
for the required rendered, independent-pixel, and PowerPoint compatibility
receipts. It creates no `BuildArtifact`.

The current boundary is not arbitrary-template compatibility, a general PPTX
renderer, a universal PowerPoint object model, a delivery release, or a promise
that every implemented internal experiment belongs to the public package graph.
Unknown features and ambiguous mutation requests fail closed; they are never
silently flattened to images.

The design follows seven rules:

1. explicit context replaces ambient roots, workstation discovery, and
   hard-coded project files;
2. normative schemas define stable serialized boundaries;
3. data selects capabilities, while only trusted executors contain behavior;
4. support is an executable policy decision, not a registry label;
5. source templates are read-only and every output is create-only;
6. deterministic structural calculation and rendered review are separate
   authorities; and
7. optional adapters and model-assisted labs cannot widen core authority.

## Fact ownership

Every durable fact has one readable owner. Derived objects may bind or project
those facts, but may not silently replace their owner.

| Fact | Readable owner | Consequence |
| --- | --- | --- |
| Unchanged inherited content and package structure | Source template | Assembly may project it but never rewrite the source or treat a candidate as the original |
| Authored semantic content and relationships, including formula LaTeX | Raw brief, evidence, and `DeckSpec` | Candidate records are not complete content-regeneration sources |
| Reviewed expectations and capacity for a template class | `TemplateProfile` | A profile does not prove the bytes currently being inspected |
| Normalized observable source structure | `TemplateIndex` derived from the admitted source snapshot | Shape, owner, and order facts must be re-derived when source bytes change |
| Project-specific semantic bindings and capability selections | `ProjectOverlay` | A capability cannot invent bindings from names or positions |
| Declared capability metadata and artifact identities | `CapabilityRegistry` | Registry identifiers are comparison keys, never code locations |
| Executable registration | Trusted static host and capability runtime | Only exact code/schema/fixture/QA registrations enter the private executable map |
| Support authorization | `policy/support-matrix.json` | Static registration cannot override an unavailable or non-opted-in row |
| Editable layout intent | `SlideLayoutIR` | Slots, padding, alignment, sizing clamps, paint outset, z-order, and constraints remain editable facts |
| Frozen geometry and measured constraint results | `ComposedSlidePlan` | Assembly consumes resolved EMU boxes and never re-solves responsive layout |
| Candidate layout/build replay | `CandidateBuildRecord` | It binds exact candidate bytes and replay facts but grants no delivery authority |
| QA facts and aggregate decision | `QaReport` | Missing or manual evidence remains visible rather than becoming a passing boolean |
| Final delivered outputs | `BuildArtifact` | It exists only after exact candidate-bound evidence passes and is published last |
| Public package graph | `packaging/alpha-package-plan.json` | Manifests, tarballs, installations, and the SBOM are projections, not competing package graphs |
| Release eligibility | `docs/RELEASE_GATES.md` | A passing test or plausible deck alone is never a release decision |

SHA-256 values are boundary fingerprints. They prove equality of exact objects
at a named boundary; they do not carry semantic meaning, replace a readable
model, or authenticate a plan merely because two derived artifacts happen to
match.

## Data and control flow

### Project creation, inspection, and validation

One explicit absolute project root anchors every path. No production path
searches the current working directory, environment, home directory, sibling
repository, PowerPoint installation, or asset folder.

```text
explicit new root + public-synthetic preset
  -> create ProjectConfig/Profile/Registry/Overlay/DeckSpec/source
  -> publish ProjectConfig as bootstrap commit marker

ProjectConfig + explicit root
  -> immutable ProjectContext
  -> bounded stable source read
  -> secure ZIP/XML/OPC inspection
  -> normalized TemplateIndex at the configured create-only path

current ProjectConfig/Profile/Index/Registry/Overlay/DeckSpec
  + fresh source inspection
  -> exact index comparison
  -> trusted static capability registration
  -> normative support resolution
  -> complete-batch binding and executor preflight
  -> discard opaque one-shot plan without project execution
```

Project validation proves only that the readable graph and the complete batch
can be prepared. It writes no presentation output and grants no later render
plan. Rendering must prepare a fresh plan from a fresh captured state.

### Current candidate build

The public render path closes one exact profile before the first mutation:

```text
stable source snapshot + complete readable project graph
  -> secure TemplateIndex re-derivation
  -> exact installation-owned candidate-profile match
  -> matching platform/Node support row + explicit experimental opt-in
  -> semantic slot request
  -> SlideLayoutIR
  -> deterministic ComposedSlidePlan + complete constraint receipt
  -> fresh opaque one-shot native-card dispatch
  -> typed target-specific OOXML rebuild with collision-free IDs
  -> source immutability + exact allowed/collateral package diff
  -> canonical CandidateBuildRecord
  -> record first, candidate PPTX as logical commit marker
```

ProjectConfig's output root and DeckSpec's deck ID derive both filenames. The
caller cannot select a renderer, bypass support, supply x/y coordinates, or
choose an alternate output path.

### Current QA calculation

QA does not inspect a compiled derivative in isolation:

```text
current readable project graph + current source bytes
  -> same semantic-slot derivation
  -> fresh one-shot dispatch
  -> expected candidate bytes + canonical record bytes
  + stable-read actual candidate marker + record
  -> exact pair comparison + complete record replay
  -> fixed QaReport
```

The report passes candidate-record replay, mechanical constraints, and
source/package diff. Render completeness, independent pixel review, and
PowerPoint compatibility remain unavailable. The aggregate decision is
therefore `blocked`, the command succeeds, and no `BuildArtifact` is created.
Ignored local evidence is not an input and cannot upgrade this result.

### Delivery boundary

A delivery boundary is intentionally stricter than candidate authentication:

```text
source/template + TemplateIndex/ProjectOverlay + readable DeckSpec
  -> generation's same pure layout derivation
  -> exact full SlideLayoutIR and ComposedSlidePlan comparison
  -> deterministic target-specific package reconstruction
  -> exact candidate and collateral comparison
  -> candidate-bound mechanical receipt
  -> render of that exact candidate
  -> independent review of frozen anonymous pixels
  -> operation-specific compatibility receipt where required
  -> passing QaReport
  -> BuildArtifact-last create-only publication
```

Matching only a final component box, screenshot, candidate label, or digest is
insufficient. The whole IR, whole plan, complete package projection, and exact
reviewed bytes must converge.

The repository contains bounded internal final-delivery demonstrations for
exact public-synthetic candidates. They prove only their named fixed facts.
Those broad delivery modules are outside the four-package CLI import closure;
they do not become arbitrary-template support or a public CLI delivery path.

A verification agent receives only frozen pixels and stated review context. It
cannot generate or mutate a candidate, inspect a hidden answer, approve its own
repair, select support, or authorize publication.

## Executable components and dependency direction

### Guarded alpha graph

The first package graph is exact:

```text
pptx-compiler                    CLI composition root
  |-- pptx-compiler-core         contracts, policy, ingestion, layout,
  |                              candidate assembly, and blocked QA
  |-- pptx-compiler-native-card-arrow
  |       `-- pptx-compiler-core typed native-card executor plus core API
  `-- pptx-compiler-public-synthetic
                                 reviewed synthetic source parts and preset
```

The CLI passes installed resource locations explicitly. Installed execution
never derives one monorepo root. Core cannot import the CLI, plugins, optional
process or PowerPoint adapters, labs, tests, private fixtures, or a presentation
project. Package-to-package imports use declared package aliases, not relative
paths across source trees.

The package that interprets a resource owns it. Core owns public contracts and
the support policy; native-card-arrow owns its input/output schemas and
conformance cases; public-synthetic owns its reviewed OOXML text parts and
normalized golden. The package plan is the only source-to-stage and dependency
map.

### Capability admission and execution

Serialized metadata is never executable authority. A trusted registration is
admitted atomically only when all of these exact facts agree:

- capability identity and version;
- executor and preflight functions;
- input and output schema documents plus validators;
- at least one repository-owned conformance fixture;
- ordered QA assertions; and
- a matching support-policy decision.

There is no registry-directed dynamic import, ambient lookup, semver fallback,
or incremental partial registration. The runtime snapshots the complete
registry/overlay/index/deck bundle, validates every reference and binding, and
preflights the complete batch before the first executor runs. Callers receive
only an opaque authenticated one-shot plan, which is consumed before execution.
Outputs are bounded, detached, frozen, schema-validated, and checked by every
QA assertion.

The public candidate host registers only the native-card path required by its
fixed profile. Other repository capabilities and conformance experiments do not
enter that production import closure merely because their code exists.

### Layout and assembly

Product placement accepts a semantic `slotRef`, placement intent, and preferred
size. It does not accept caller-authored product x/y coordinates.

`SlideLayoutIR` retains:

- semantic slot identity and bounds;
- container-owned padding and alignment;
- fixed/preferred size with explicit per-axis clamps;
- conservative paint outset and z-order; and
- containment, slot, and non-overlap constraints.

`ComposedSlidePlan` retains:

- resolved EMU boxes and conservative paint bounds;
- resolved slots and z-order;
- the IR and plan digests; and
- the complete deterministic constraint receipt.

These objects travel together in the candidate record but do not duplicate one
another. Assembly consumes the frozen plan and never performs renderer-dependent
responsive layout. The low-level raw-coordinate primitive remains only for 0.x
compatibility and cannot bypass the slide-wide occupancy gate or become the
public product path.

Native and OMML targets are rebuilt from typed, validated data. Unbound XML
conformance exemplars are never concatenated into a slide. Target IDs,
containment, namespaces, relationships, capacities, and the complete part diff
are revalidated against the actual target package.

## Contracts

### Serialized roots

JSON Schema is normative for contract version `0.1.0`:

| Root | Role |
| --- | --- |
| `ProjectConfig` | Explicit contained project locations and document roles |
| `TemplateProfile` | Reviewed template expectations and policy metadata |
| `TemplateIndex` | Normalized redacted structure observed from exact source bytes |
| `CapabilityRegistry` | Declarative capabilities and artifact identities |
| `ProjectOverlay` | Project selections and semantic shape bindings |
| `DeckSpec` | Authored slides, content, relationships, and capability requests |
| `CandidateBuildRecord` | Candidate identity, exact diff, IR/plan replay, and target evidence |
| `QaReport` | Mechanical, render, visual, compatibility, and manual/unavailable results |
| `BuildArtifact` | Final published outputs after a passing delivery boundary |

The checked TypeScript declarations are generated from these schemas. Fixtures
marked `schema-conformance-only` prove only contract shape; placeholder IDs or
fictional QA values are not executor or presentation evidence. Unknown schema
versions, fields, roots, and references fail closed unless an explicit tested
migration exists.

### Runtime-only and policy contracts

`ProjectContext`, `TemplatePackageView`, trusted capability registrations,
opaque dispatcher plans, typed assembly reports, and one-shot evidence receipts
are runtime-only objects. They do not create competing serialized authorities.
Producer labels are structural metadata rather than security credentials;
secure-ingestion evidence belongs to the complete opened-handle-to-index chain.

The support matrix, alpha package plan, forbidden-material policy, provenance
records, workflow policy, and release gates are separately schema-checked
policy contracts. Generated manifests, SBOM data, workflow YAML, tarballs, and
evidence receipts remain exact projections of their readable owners.

## Security and publication state machines

### Untrusted input

PPTX and POTX are untrusted ZIP/XML/OPC packages. The bounded ingestion path:

- obtains one size- and identity-checked stable file snapshot;
- never extracts archive members;
- limits members, individual and expanded sizes, compression ratio, names, and
  XML structure before deeper processing;
- rejects traversal, symlinks, duplicates, case aliases, malformed XML, unknown
  vocabulary, external relationships, macros, ActiveX, OLE, and embedded
  objects/packages; and
- derives both parsing results and the archive digest from the same detached
  bytes.

Portable Node APIs cannot provide a universal descriptor-relative walk across
all platforms. Every consumer must therefore repeat containment and identity
checks at its time of use; no lexical check alone is treated as filesystem
identity.

### Create-only publication

Visible commit markers make incomplete states explicit:

- project bootstrap publishes `ProjectConfig` last;
- candidate publication links `CandidateBuildRecord` first and the PPTX last;
- final delivery links `BuildArtifact` last.

Before a marker is visible, exact owned-path rollback may report either
`not-committed` or `rollback-incomplete`. After marker visibility, an observed
failure is `commit-uncertain`; reconciliation is non-destructive. Caller labels,
filenames, and stage-slot names never grant deletion or publication authority.

Owned payload files are flushed on every admitted platform. POSIX additionally
requests containing-directory fsync barriers. Node exposes no corresponding
Windows directory primitive, so Windows evidence covers exact bytes, logical
commit order, and recovery—not sudden-power-loss persistence of directory
entries.

### Guarded package stage

One ignored, owner-verified `.package-stage/` holds derived package work. The
readable package plan, forbidden-material policy, `.gitignore`, and exact mapped
source snapshots remain authoritative. npm is a constrained packer; an
independent bounded gzip/ustar parser admits the tarball members, paths, bytes,
modes, order, and limits.

The stage uses marker-authenticated `work`, `reviewed`, `previous`, and `failed`
states. Removal uses exact typed inventories only. There is no recursive
deletion primitive: unknown nonempty entries fail closed, authenticated failed
work is preserved, and foreign content is quarantined by rename. Tarballs are
installed together offline into an empty directory before the installed CLI
smoke runs.

Every leaf manifest remains `private: true`, and the readable release guard is
`blocked: npm-publication-not-authorized`. A local reviewed tarball is neither a
published package nor release evidence.

## CLI contract

Protocol `0.1.0` exposes only implemented authority:

| Command | Current meaning |
| --- | --- |
| `init --preset public-synthetic-native-card` | Create one exact project beneath an explicit new absolute root |
| `inspect` | Securely derive the configured `TemplateIndex`, create-only |
| `validate document` | Validate one contained JSON document against one installed root schema; write nothing |
| `validate project` | Re-inspect and validate the complete exact project, admit the static registration, preflight the batch, then discard the plan |
| `render` | Build only the fixed explicitly opted-in native-card candidate pair |
| `qa` | Re-derive and assess only that exact pair; return `decision: blocked` and create no `BuildArtifact` |

`doctor`, generic `onboard`, standalone `diff`, and a formula CLI remain
unavailable. They are not listed as current functionality merely because the
parser recognizes a name or roadmap work exists.

JSON mode emits exactly one newline-terminated success or failure envelope.
Process exits are `0` for success, `1` for domain/runtime failure, and `2` for
invalid syntax. Detailed errors expose a stable code and JSON pointer only;
messages, stacks, causes, absolute paths, source bytes, XML, adapter stderr, and
unknown command text are not serialized.

## Optional adapters and labs

Pandoc is a separately installed optional process. The trusted host supplies an
absolute executable path and bounded environment; core never imports
`node:child_process` or discovers Pandoc. Version, JSON API, and canonical OMML
probes must pass before an executor can be registered. DOCX stdout then crosses
the same strict ZIP/XML/OPC and typed-OMML boundary. The adapter is outside the
four-package alpha graph, and a successful probe does not make formula delivery
or the formula CLI available.

PowerPoint automation is a trusted-local compatibility-evidence adapter, never
a public CI dependency. It refuses untrusted CI use and pre-open user
presentations. Its exact candidate-specific open/save/reopen observations do not
generalize to another template, operation, PowerPoint version, or platform.
Raw presentations, renders, transcripts, and review records remain ignored.

Planning and visual-review experiments live under `labs/`. They may propose a
deck hypothesis, compare layouts, or review frozen renders, but core cannot
import them. They cannot register an executor, mutate a package, promote
support, or turn model preference into a claim about real audience
comprehension, recall, persuasion, or decision quality. If used, they are
optional upstream recommendations; the normative product flow still begins
from readable template/project/DeckSpec facts.

## Evidence and support state

The accepted executable baseline is
`c4dee58a8920a8e71c20f53ab93c62a96d3cb89d`. Public evidence for that baseline
includes:

| Boundary | Evidence |
| --- | --- |
| Pull-request workflow | [CI run 31600528716](https://github.com/why7682/pptx-compiler/actions/runs/31600528716): Ubuntu, Windows, and macOS under Node 22/24 passed |
| Pull-request dependency policy | [Dependency Review 31600528742](https://github.com/why7682/pptx-compiler/actions/runs/31600528742): passed |
| Accepted main workflow | [CI run 31600806512](https://github.com/why7682/pptx-compiler/actions/runs/31600806512): all six cells passed |
| Accepted main static security | [Security run 31600806350](https://github.com/why7682/pptx-compiler/actions/runs/31600806350): CodeQL passed |

The canonical workflow also executes source and policy admission, declaration
typechecking, the complete public test suite, guarded four-package creation,
clean joint installation, the installed CLI spine, working-tree rechecks, and
drift detection. These are object-bound workflow facts. They are not a claim
that every platform or capability is supported, that static analysis found
every vulnerability, or that a registry artifact equals the reviewed tarball.

The normative matrix currently contains 60 rows:

| Status | Count |
| --- | ---: |
| `supported` | 0 |
| `experimental` | 22 |
| `manual` | 3 |
| `unsupported` | 35 |

`supportClaimsEnabled` remains `false`. The six Linux/macOS/Windows × Node
22/24 runtime rows remain experimental. A matching platform result is necessary
for the exact candidate profile but cannot independently authorize a product
capability or enable global support.

## Limitations and trust assumptions

- Only the exact repository-owned synthetic POTX/profile is admitted by the
  public candidate path. Arbitrary PPTX and POTX input remains unavailable.
- The public CLI exposes one one-slide native-card candidate. General clone/fill,
  DrawingML, target-specific ordered native/OMML delivery, direct formula
  delivery, and formula CLI behavior are unavailable.
- The direct typed-OMML delivery boundary lacks its exact operation-bound public
  receipt, and real-Pandoc public conformance is absent.
- PowerPoint and independent pixel observations are narrow local evidence. They
  cannot be inferred for another candidate or treated as automatic CI facts.
- Manual and unavailable evidence remains unresolved; it is never aggregated as
  a pass.
- Windows has no Node parent-directory fsync equivalent, so the durability claim
  is narrower than on POSIX.
- The current packages are npm-private. No release tag, signature, registry
  provenance, or reviewed-to-published byte equality exists.
- Branch protection is deliberately deferred and is not a current repository
  security claim.

## Next authorized action

This architecture is part of the reader-facing bundle being frozen by the
M3-005B cross-document gate. Only after that gate records its final evidence may the project prepare
the `0.1.0-alpha.1` release gate. Actual npm publication still requires explicit
authorization, a clean-tag build, signing/provenance, and equality between the
reviewed and published tarballs. Deferred branch-protection work must be resumed
explicitly rather than folded into the release path by implication.
