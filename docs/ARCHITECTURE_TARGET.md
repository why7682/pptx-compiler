# Architecture Target

## Design principles

1. Explicit context replaces ambient repository roots and hard-coded files.
2. Schemas define every stable boundary before implementation.
3. Data selects capabilities; only executors contain rendering logic.
4. Support claims are executable contracts, not registry labels.
5. Core behavior is cross-platform; optional adapters isolate external tools and
   platform-specific PowerPoint automation.
6. Every build is deterministic, create-only, inspectable, and fail closed.
7. Rendered communication effect is reviewed separately from structural
   correctness; model-assisted planning or review never authorizes core mutation.

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
  design-planning/         non-authorizing deck-hypothesis experiment
  visual-review-agent/     optional rendered-outcome review experiment
schemas/
fixtures/
  source-parts/            reviewed, repository-owned text OOXML only
examples/
docs/adr/
```

The monorepo and high-level package split are accepted. D-039 fixes the first
candidate-alpha publication graph and unscoped staging names:

```text
pptx-compiler
  -> pptx-compiler-core
  -> pptx-compiler-native-card-arrow -> pptx-compiler-core
  -> pptx-compiler-public-synthetic
```

No other package enters the first alpha closure. Exact package import aliases,
not cross-package relative paths, join the graph. The dependency direction is
fixed: `core` cannot import CLI, plugins, platform adapters, labs, private
fixtures, or a presentation project.

Package resources are owned by the package that interprets them. Core owns
contract schemas/positive fixtures and the support policy; native-card-arrow
owns its input/output Schemas and conformance cases; public-synthetic owns its
reviewed text parts and readable index golden. The CLI composition root receives
their absolute installed paths explicitly. Repository-layout projection remains
only a source-workspace compatibility entry; installed execution never infers
one monorepo root.

`packaging/alpha-package-plan.json` is the sole M3-002 source-to-stage map. Its
schema v2 uses positive file lists, exact exports/types/bin/import maps, a fixed
ignored `.package-stage/`, one verified GitHub repository tuple, and a separate
blocked npm-publication guard. M3-003 stable-reads the plan,
forbidden-material policy, `.gitignore`, and mapped source bytes/modes as one
control snapshot. It materializes only the mapped sources, derives npm-private
repository-bound leaf manifests from the plan, invokes the bundled npm through the same admitted Node
runtime, independently checks the resulting tgz bytes, installs all four tgz
files together offline, and runs the installed bin. It may not rediscover files
with a broad directory scan or silently widen the graph.

The readable plan and source bytes remain authoritative. `.package-stage/`,
leaf manifests, tgz files, the installed tree, smoke project, and package
evidence are derived and ignored. One owned fixed stage uses an atomic process
claim, `work/reviewed/previous/failed` recovery, and a create-only completion
marker; no random stage root is created. npm's JSON report is only a cross-
check. Acceptance comes from an independent single-member canonical gzip/ustar
parser, exact planned bytes/modes/order, retained-byte comparisons through
post-rename verification, and the installed result. SHA-256 is recorded only
as the final tgz boundary fingerprint, never as a replacement planning model.
The retained reviewed state is only the completion marker, canonical package
evidence, and four exact tgz files. Owned payload files are flushed on every
admitted platform; POSIX additionally requests containing-directory fsync
barriers. Node's Windows API provides no equivalent directory barrier, so
Windows CI proves the logical state machine and exact bytes, not sudden-power-
loss directory-entry persistence.
Materialized packages, installations, and smoke projects are removed through
exact typed inventories. npm cache/config/
temporary compiler data remain persistent ignored tool state below the fixed
stage and never enter reviewed evidence. Recovery has no recursive deletion
primitive: authenticated review members are removed individually with the
completion marker last, while foreign content is preserved and fails closed or
moves by rename into the single persistent quarantine.

M3-004A adds a development boundary without changing the runtime graph. Exactly
two canonical GitHub workflow files are byte-derived from one local workflow
policy. That policy owns only events, fixed hosted-runner labels, least
privileges, command order, and full action SHAs; the root package scripts,
alpha package plan, provenance ledger, and MIT text retain their existing facts.
One locked dev-only TypeScript compiler checks a consumer whose eight public
specifier paths are derived from the package plan. It is not mapped into any
publishable package. The CycloneDX document is likewise a deterministic readable
projection of the declared four-package graph and parser-proven static ESM
edges, not a JavaScript sandbox, new dependency authority, or artifact-
attestation hash graph. Local workflow conformance is M3-004A; actual
Linux/Windows/macOS hosted results remain M3-004B after the exact reviewed first
source ref exists and those jobs run.

D-044 changes the unpublished public identity, not that graph. Repository,
CLI, package names, package import aliases, and serialized contract URNs use the
single `pptx-compiler` stem with no compatibility alias. Neutral package IDs,
schema/CLI protocol versions, directory roles, and error codes remain
unchanged. The local workspace directory also remains unchanged. Only the
existing ignored package-stage owner/plan ID and `.pptx-pipeline-*` transaction
prefixes retain the former stem so pre-rename crash state remains recognizable;
they grant no public package, schema, or repository identity.

D-045 separates three facts that must not be collapsed. GitHub owns live public
visibility, empty refs, and private-reporting state. Package-plan schema v2 owns
only the fixed repository provider/ID/owner/name/HTML-URL tuple. Leaf manifest
`repository` objects and the root CycloneDX VCS reference are pure projections
of that tuple. The independent release guard keeps every leaf `private: true`
and npm publication blocked. Stage evidence/marker schema v2 records a SHA-256
fingerprint of the canonical readable plan, so recovery cannot accept a
pre-binding tarball merely because plan ID, version, package names, and file
shape stayed constant. The fingerprint authenticates an authority boundary; it
does not replace the plan or become a second planning model.

The effect-first scope in D-023 does not reverse that direction. A lab may
consume a raw brief, evidence inventory, and template profile; propose and
compare planning artifacts; or review rendered output. It may return a bounded
recommendation or a human-accepted planning receipt, but core accepts only the
existing schema-validated semantic data and authenticated capability/assembly
path. Lab artifacts cannot register support, select an executor, bypass
preflight, or mutate a package.

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

`CommunicationContract`, `NarrativeGraph`, `SlideContract`, visual-language
proposals, rhythm plans, blind outcome reports, and planning receipts are
proposed lab contracts, not members of the public `0.1.0` contract set. An
optional rendered visual-review report is a version 0.x product objective, but
it cannot become a public contract or release claim until its separate schema,
producer, deterministic verdict boundary, synthetic evidence, and support
disposition exist.

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
M2-002 adds the pure synchronous `prepareResolvedDeckDispatch()` boundary. It
snapshots and schema-validates registry, overlay, index, and deck documents,
checks their complete semantic identity/reference graph, binds the full
registry exactly to the authentic runtime's private capture, and immediately
prepares an opaque dispatcher plan. Intermediate invocations are never exposed
to callers. The resolver performs no file, archive, XML, network, process, or
staging I/O.

The first product executor, `source-slide-clone-fill`, consumes only frozen
resolved text-box bindings and emits a closed data-only semantic operation
plan. Core never imports the plugin and registry URNs still never load it; a
trusted host supplies the static registration. The executor does not apply the
plan to OOXML. Staged mutation, relationship/ID remapping, rollback, collateral
diff, source isolation, and publication remain M2-005 work, so the product
support row remains unavailable.

M2-003 adds `native-card-arrow` as a second statically registered product
plugin without changing core or the serialized `0.1.0` contracts. It consumes
one resolved text-box anchor plus closed geometry/text/style data, constructs a
fixed typed native group, canonically serializes it, and reparses it through the
strict XML boundary before exact vocabulary QA. The resulting `p:grpSp`
contains one native text-bearing `roundRect` and one native `rightArrow`, never
a raster fallback. Its XML is explicitly an unbound, non-insertable conformance
exemplar with component-local IDs; final target-slide ID allocation,
containment, application, and package publication remain M2-005. The exact
capability row is experimental with opt-in, while broad DrawingML and slide
text remain unavailable.

The first M2-005C application slice preserves that dependency direction. Core
accepts one authentic M2-005A artifact and one opaque, single-invocation
dispatcher plan; it executes the plan internally and independently rebuilds
the fixed native tree from typed geometry, text, and style. Core does not import
the plugin and does not read its unbound XML exemplar. Target-local object IDs
come from a complete root-and-nested `p:spTree` scan, actual slide containment
is mandatory, and the only allowed package change is insertion after the
authenticated direct anchor. The resulting target-specific artifact is marked
non-publishable by the generic raw-byte path because the untrusted-input package
grammar still rejects groups.

The separate authenticated bridge admits only the exact generated artifact.
The native applicator registers a report object and its verified byte/base facts
in a module-private map only after exact target verification. Ordered assembly
admits the existing clone-fill report identity or that native report identity—
never a serialized label—and uses the authentic M2-005A base as a verification
shadow. Real native slide bytes are copied unchanged; only the in-memory shadow
replaces those exact slides before the unchanged generic package view and
relationship-closure verifier run. A separate create-only publisher recognizes
direct native or native-containing ordered reports registered by their producers
and snapshots the bytes before filesystem I/O. Its explicit product-facing
entry point writes a `candidate-pptx` with `deliveryEligible: false`; the older
publication-named function remains only as a 0.x compatibility alias.
`publicationEligible: false` on
the direct native report continues to mean “not eligible for the generic raw-
byte publisher.” The private bridge does not import a fragment, parse arbitrary
groups, change the serialized public contract set, or promote support.

The typed M2-005C slice applies the same authority model to one formula target.
Core consumes one exact formula dispatch, strict-parses the unbound `m:oMath`
under a target-specific element/run/text budget, validates its closed topology,
and rebuilds namespace-expanded typed nodes with fixed DrawingML math-run
properties. It inserts direct `a14:m -> m:oMath` into the existing text
paragraph, which is the minimal `CT_TextMath` structure accepted by the tested
PowerPoint path. No raw fragment, relationship, picture, or fallback enters the
generated candidate. Formula placement is a semantic slot with the target
text-box geometry and travels in the same IR/plan build record. Exact report
identity admits only the verified bytes to the candidate writer. The product
generation entry point now derives its base from the exact admitted source
template and verified index, preserving unchanged inherited content; the older
clone/fill entry remains a compatibility path and is not delivery authority.
Generic input parsing, generic publication, and support remain closed.

## Composition and delivery boundary

Same-slide composition is no longer inferred from independent capability
coordinates. The narrow executable bridge has two persistent JSON-safe layers:

1. `SlideLayoutIR` preserves editable intent: semantic slot identity and bounds,
   parent-owned padding, allowed component identity, alignment, per-axis fixed
   sizing with explicit min/max clamps, paint outset, z-order, and containment/
   non-overlap constraints.
2. `ComposedSlidePlan` binds the IR digest to the resolved EMU boxes, conservative
   paint bounds, resolved slots, z-order, a plan digest, and the complete
   deterministic constraint receipt consumed by assembly.

These two objects travel as one candidate build record even though they have
different responsibilities. The record is the layout/build replay authority
for later edits: load the IR, change layout intent, resolve a new plan, and
assemble a new candidate. It is not the full semantic source: unchanged
inherited content and structure remain in the source template; raw brief,
evidence, authored `DeckSpec` content, and formula LaTeX remain upstream. A standalone PPTX
contains only the result and must never be used to reverse-engineer or silently
replace either source layer.

Digests in the 0.1 contracts are exact-object boundary checks, not the data
model. They remain for compatibility and tamper detection, but new layers must
not duplicate them without a concrete identity requirement. The final output
digest has one essential job: bind the exact rendered/reviewed candidate to the
delivered file. Deterministic calculations are the cheap iteration gate;
screenshots of that same artifact are mandatory final visual evidence.

Final delivery does not trust the candidate record's discriminator as
generation authentication. The current direct native slice re-derives the
complete admitted synthetic index from the source, resolves the overlay anchor,
and passes the re-derived source shapes, canvas, and readable DeckSpec request
through the same pure slot calculation used by generation. The complete
expected `SlideLayoutIR` and `ComposedSlidePlan` must equal the record—not merely
the final native box. It then rebuilds the exact native group from DeckSpec
label/style plus the verified plan, normalizes the unchanged source slide and
POTX content type, and deterministically reconstructs the complete expected
candidate archive. Only exact relationship-layer and package matches can
receive passing diff/QA facts; every other part is closed by construction.

The direct typed-OMML path follows the same rule without inventing a formula
AST or semantic hash. It synchronously snapshots the candidate and complete
readable project tuple, resolves a fresh one-shot dispatch from the captured
DeckSpec LaTeX, runs the shared source-preserving OMML assembler, and compares
the complete regenerated archive plus IR/plan/diff/formula evidence with the
reviewed candidate. This makes undeclared clone/fill title text and changed
LaTeX ordinary projection failures. Its compatibility authenticator receives
the required operation as an expected fact, and the receipt must independently
state `formula-content-edit-save-reopen`; the existing shape-name round trip is
not sufficient. The prepared plan then uses the same create-only
BuildArtifact-last publisher as the native-card path.
Call history is deliberately absent from the authority model. If the older
compatibility call writes source-identical inherited text and converges to the
same archive/report, final regeneration accepts it; adding provenance solely to
distinguish indistinguishable results would duplicate authority without a user-
visible relationship.

A separate formula-edit observation lane may compare one fixed candidate with
a PowerPoint-edited derivative, but it is not part of this receipt chain. Its
machine layer reports only readable fraction and namespace observations and
does not claim the closed typed-OMML grammar was validated. Its trusted-local
layer records explicit human/no-repair attestations separately and remains
`authority: none`, `deliveryEligible: false`, and feature-level only. Therefore
neither the `3/3 -> 2/3` observation nor its passing local record can satisfy the
direct candidate's operation-bound compatibility receipt or promote support.

D-033 closes M2-005 only at the exact fixed mixed public-synthetic architecture
boundary. That path carries readable source/DeckSpec/IR/plan authority through
deterministic reconstruction, exact diff, same-candidate rendered review,
ordered compatibility evidence, QA, and one shared BuildArtifact-last publisher,
including pre-commit rollback and post-commit uncertainty. The missing direct
single-slide OMML receipt keeps that optional delivery path unavailable; the
architecture does not infer generalized native/OMML ordering or template/
platform compatibility from the fixed path. No support or release boundary
moves. The next dependency is the M3-001 CLI surface over proven operations.

The first normative form is `CandidateBuildRecord 0.1.0`. It is a closed,
canonical JSON sidecar for one direct semantic-slot native candidate. It binds
the candidate basename, byte length, SHA-256, authentic base digest, exact slide
part and diff, complete IR, complete composed plan and constraint receipt, plus
the native-card object IDs or typed-OMML target evidence. Loading re-runs the
layout resolver and requires exact plan equality. The create-only bundle writer
stages both files in one canonical directory, links the record first, and links
the PPTX last as the logical commit marker. Files are flushed on every admitted
platform; POSIX additionally requests parent-directory fsync barriers.
Successful rollback removes both owned
links; if candidate removal or its directory barrier cannot be confirmed, the
record is deliberately retained instead of creating an orphan candidate. Thus
a visible candidate PPTX cannot be published by this path before its constraints
exist. The old PPTX-only writer remains unchanged for 0.x callers,
but it is not the record-backed product path. Fixed-absolute compatibility
artifacts remain rejected by the direct record-backed path.

The same `0.1.0` union now has one ordered-deck branch. It binds base/source
artifact hashes, canonical output order, slide parts, relationship and
presentation IDs, complete deck diff, and candidate bytes. The discriminated
per-slide `sourceBuild` union is the only classification authority; redundant
deck-level native flags, counts, and source-profile labels are deliberately not
serialized. Plain clone/fill slides are honestly represented as digest-bound
source artifacts; the record does not invent a layout calculation they never carried.
Every native card-arrow slide must instead retain its complete bounded-slot IR,
replayed plan/receipt, source one-slide diff, base digest, and allocated object
IDs. Typed-OMML slides retain the same layout/build relationship plus their
formula digest, target capacity, and observed target facts. A single target-
specific native profile table authenticates both kinds; exact authentic slide
bytes enter ordered output while only each artifact's authenticated base enters
the generic verification shadow. Generic and native-containing ordered decks
use a separate authenticated ordered bundle entry point but the identical
record-first/candidate-last publication state machine. Low-level fixed-absolute native
slides still fail closed because they lack the required replay profile. Ordered
final delivery remains outside this candidate-only boundary. Direct OMML has a
separate source/DeckSpec regeneration boundary, but the candidate record itself
still grants no delivery authority.

The current product-level native placement accepts only `slotRef`,
`placementIntent`, and preferred size. It derives the bounded content-tail slot
from authenticated template shape facts and requires the typed executor's
geometry to equal the frozen plan before mutation. The existing raw-coordinate
applicator is retained as a low-level compatibility primitive; it cannot bypass
the same slide-wide paint-bounds occupancy gate.

This borrows Figma's useful data model—container-owned padding, flow versus
absolute placement, and sizing clamps—without importing Figma IDs, runtime,
auto-layout behavior, slots, or file formats. Assembly consumes frozen
coordinates and never performs a renderer-dependent responsive layout.

Structural authentication authorizes candidate creation only. The two bounded
direct final-delivery preparers add application-level authority by binding the
exact candidate to structural/mechanical, render, blind visual, and required
compatibility receipts after deterministic semantic/package regeneration.
One third preparer admits only 2–11 same-template clone/fill ordered records. It
executes the complete captured DeckSpec batch, applies every returned plan to
the exact source/index, and reuses the existing ordered assembler before exact
archive/deck-record comparison. Multi-slide receipts cover the complete ordered
slide-ID list and BuildArtifact lists every slide. Generic raw-byte and target-
specific native/OMML ordered delivery remain unavailable. The 11-slide maximum
is derived from the admitted package grammar's ten fixed parts plus two parts
per slide under the unchanged 32-entry secure-ZIP limit; 12 slides fail before
dispatch or artifact inspection. A verification agent
may produce evidence over frozen pixels; it cannot mint mutation or delivery
authority, and the typed-OMML path cannot activate without the exact formula-
content edit/save/reopen receipt. The clone/fill ordered path likewise requires
`ordered-deck-open-save-reopen` compatibility evidence; the trusted local
adapter now supplies it only for one exact two-slide public-synthetic candidate,
not for the full executable range or another template/member profile.

## Capability resolution

```text
raw brief / SlideSpec
  -> schema validation
  -> audience and evidence plan
  -> template semantic-slot match
  -> SlideLayoutIR
  -> deterministic ComposedSlidePlan + constraint receipt
  -> project overlay resolution
  -> source/template binding validation
  -> capability lookup
  -> support-policy authorization
  -> executor preflight
  -> semantic operation plan or unbound native component exemplar
  -> staged mutation
  -> package normalization
  -> QA and collateral diff
  -> stage canonical candidate build record + authenticated candidate bytes
  -> publish record first, then candidate PPTX as the create-only commit marker
  -> same-artifact render + mechanical + blind visual evidence
  -> compatibility evidence where required
  -> pass QaReport
  -> BuildArtifact-last create-only delivery publication
```

There is no generic fallback to deck-specific code. If resolution is ambiguous
or an executor is absent, the build fails before modifying an output package.
All invocations in one batch must pass lookup, input validation, binding checks,
support authorization, and preflight before the first executor runs.

## CLI surface

```text
pptx-compiler init
pptx-compiler doctor
pptx-compiler inspect
pptx-compiler onboard
pptx-compiler validate
pptx-compiler render
pptx-compiler qa
pptx-compiler diff
pptx-compiler formula transplant
```

Commands must support deterministic JSON output, documented exit codes, path
redaction, explicit input/output paths, and non-interactive CI operation.

D-034 implements the first thin slice. One protocol `0.1.0` has three process
meanings only: `0` success, `1` domain/runtime failure, and `2` invalid command
syntax. Machine detail stays in the existing redacted domain `code + pointer`;
the process code does not duplicate the business error taxonomy. In `--json`
mode both success and failure emit exactly one stdout envelope with
`protocolVersion`, `command`, `ok`, and exactly one of `result` or `error`.
Unknown exceptions collapse to a fixed operation-failure code; messages, stacks,
causes, absolute paths, source bytes, and XML are never copied.

The real `inspect` path is deliberately thin:

```text
explicit absolute project root/config
  -> bounded contained JSON read
  -> manifest-selected ProjectConfig Schema
  -> immutable ProjectContext
  -> existing secure template ingestion and inspector
  -> existing TemplateIndex
  -> exact configured index path, create-only
```

`validate document` applies the same manifest-selected Schema engine to one
explicit contained JSON document and creates no output. The Schema subset now
lives in core; the prior script location re-exports it for 0.x workspace
compatibility. CLI depends on core, never the reverse.

D-035 corrects the next-slice order before that private draft surface is
published. ProjectConfig is already the TemplateIndex-path authority, so the
redundant `inspect --output` argument must disappear rather than become a public
compatibility obligation. The existing `validate --contract` behavior is only
a document-Schema diagnostic; the alpha spine requires a separate explicit
whole-project meaning that loads the complete ProjectConfig/Profile/Index/
Registry/Overlay/DeckSpec graph, resolves normative support through a real
static host, performs full-batch preflight, discards the opaque plan, executes
no project invocation, and writes nothing. Render later prepares its own fresh
one-shot plan.

The first release target is a candidate alpha. It may publish candidate PPTX
plus CandidateBuildRecord for one exact explicitly opted-in experimental
public-synthetic profile. Missing rendered, pixel, or compatibility evidence
must produce the existing QaReport with `decision: "blocked"`; that successful
assessment creates no BuildArtifact. A complete product-render dependency set
must first be promoted in the normative support matrix in the same reviewed
change. Static registration never overrides an unavailable matrix row, and a
test-only or conformance-only support resolver is forbidden.

D-036 implements the on-disk spine. `packages/public-synthetic` is a production
conformance-preset boundary reused by workspace tests and scripts; CLI never
imports `tests/` or a testing package. `init` exclusively creates one selected
root and publishes ProjectConfig as its visible commit marker. Pre-marker
failure has two explicit outcomes—complete exact owned-path rollback or
rollback-incomplete reconciliation—while every post-marker failure is
commit-uncertain and non-destructive.

`inspect` now accepts no output override. `validate project` loads all six
readable authorities, re-inspects the template, exact-compares the index, and
creates a fixed installation-owned native-card runtime using the normative
support matrix. Static registration admission executes only its two fixed
conformance fixtures. The project resolver prepares the complete batch and the
CLI discards that one-shot plan; no project invocation is executed and no
project output is written. The machine result reports registration conformance,
project preflight, project non-execution, and missing render authority as four
different facts.

Generic onboarding is deferred until capability binding constraints can be
represented as data; role names alone do not authorize the CLI to invent
capability-specific binding rules. `doctor`, standalone `diff`, formula CLI,
direct-OMML delivery, and generalized native/OMML ordering are not
candidate-alpha blockers.

## M3-001 exact candidate render

D-037 adds one thin product composition root; it does not add a general
renderer. The static host owns a frozen candidate profile whose closure is the
15 invariant support rows exercised by the public-synthetic POTX/native-card
path, the runtime row resolved from the executing OS and Node 22/24, and the
public-automated evidence row. The normative matrix is the only support
authority. Every row must be `experimental/accept-with-warning`, explicit
selection opt-in remains mandatory, and the global support switch remains
false.

The authoritative data path is:

```text
ProjectConfig/Profile/Overlay/Registry/DeckSpec
  + one stable source-byte snapshot
  -> secure readable TemplateIndex
  -> exact installation-owned candidate-profile match
  -> semantic-slot request
  -> SlideLayoutIR + ComposedSlidePlan
  -> fresh one-shot typed dispatch
  -> native-card-only artifact authentication
  -> format-independent logical pair publication
  -> authenticated PPTX + CandidateBuildRecord pair
```

The CLI's static import closure mirrors that data path. It does not load the
legacy broad native/OMML/ordered publication entry; the old entry keeps its 0.x
API but delegates pair publication to the same format-independent state machine.

The readable TemplateIndex, DeckSpec, `SlideLayoutIR`, and
`ComposedSlidePlan` carry relationships and calculations. The source digest and
candidate digest bind exact objects at boundaries only. Render must compare the
complete TemplateIndex and complete calculated geometry before execution; a
matching feature list or final screenshot is insufficient authority.

ProjectConfig's output root and DeckSpec's deck ID derive both filenames.
CandidateBuildRecord is file-flushed and linked first; the PPTX link is the
visible logical commit marker. POSIX additionally requests parent-directory
fsync barriers; Windows does not claim sudden-power-loss persistence for the
directory entries. Before the marker, exact owned rollback can report not
committed or rollback incomplete. After marker visibility, failure is commit
uncertain and non-destructive. The product result is an experimental candidate,
not a QaReport, BuildArtifact, delivery, arbitrary-template claim, or global
support claim.

## M3-001 honest candidate QA

D-038 keeps QA as a calculation over the same readable authorities instead of
approving a compiled derivative in isolation:

```text
current ProjectConfig/Profile/Index/Registry/Overlay/DeckSpec
  -> same semantic-slot derivation + fresh one-shot dispatch
  -> expected authenticated candidate bytes + canonical record bytes
  + stable-read actual candidate commit marker + record
  -> exact pair comparison + CandidateBuildRecord replay
  -> fixed schema-valid blocked QaReport
```

The pure QA evaluator accepts bytes and typed state, not paths or evidence
directories. The CLI owns contained stable reads and one create-only report
write. Render and QA share the native-card authenticated candidate/record
projection, so there is no second record builder. JSON output returns the same
complete QaReport that is persisted; human output is only a presentation of its
decision.

The fixed report records `candidate-record-replay`, `mechanical-constraints`,
and `package-source-diff` as pass. `pixel-review`,
`powerpoint-compatibility`, and `render-complete` remain unavailable and bind
only the normative `manual-trusted-runtime` and
`macos-powerpoint-automation` support rows. Therefore the decision is blocked,
the command exits successfully, and no BuildArtifact exists. Missing,
oversized, tampered, noncanonical, or stale pairs fail before report
publication. Ignored screenshots, review files, or PowerPoint transcripts are
not inputs and cannot upgrade the result.

## Adapter boundaries

- Pandoc is invoked as a user-installed optional process. It is not bundled,
  linked, installed, or dynamically discovered. The trusted host supplies one
  absolute executable path and a bounded environment to the adapter package;
  core never imports `node:child_process` or depends on Pandoc.
- M2-004 fixes this formula-adapter flow:

  ```text
  absolute executable configuration
    -> bounded version/API/canonical-OMML probes
    -> optional static executor registration
    -> Math JSON AST on stdin
    -> bounded DOCX stdout
    -> secure ZIP + strict XML + typed OMML allowlist
    -> canonical unbound m:oMath conformance fragment
  ```

  Missing or incompatible Pandoc omits the executor registration. The adapter
  fragment remains `insertable: false`; the bounded M2-005 target applicator
  may consume its typed/validated result but must independently parse and
  rebuild the target-specific PresentationML/OMML tree.
- macOS PowerPoint automation is an optional compatibility adapter and is never
  required by public CI. Its bounded ordered probe is a one-way local evidence
  boundary:

  ```text
  fixed repository-owned two-slide candidate + CandidateBuildRecord
    -> explicit trusted-local flag + CI refusal
    -> one stable ignored evidence root + absolute paths
    -> PowerPoint open + readable ordered inventory + PDF export
    -> save-as new PPTX + close + reopen
    -> exact readable ordered inventory + second PDF export
    -> source-byte check + closed operation-specific receipt
    -> independent review of frozen anonymous pixels
  ```

  It refuses pre-open user presentations. On a true cold start it may close only
  PowerPoint's single unsaved, empty-path startup presentation; after each open
  it requires the application to contain exactly the expected absolute target.
  The AppleScript contains no shell, System Events, or VBA. Node bounds process
  output and time, treats partial output as failure, and writes the readable
  local receipt only after the source and all three derived files validate.
  PPTX/PDF/pixel/transcript evidence remains ignored and does not promote a
  support row.
- Font files are never bundled without explicit redistribution rights. Public
  SVG examples use a redistribution-safe font selected during the rights gate;
  native OMML may name a user-installed font without shipping it.
- Model-assisted task execution lives under `labs/` and cannot be imported by
  rendering packages. Template-locked and template-flexible planning must treat
  the user-owned template as authoritative; scratch art direction remains
  lab-only. Model reviews are simulated audience proxies and cannot be reported
  as actual comprehension or persuasion evidence.
