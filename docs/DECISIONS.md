# Decision Register

No item below is decided merely because a recommendation is recorded.

| ID | Status | Decision | Current recommendation | Required evidence |
| --- | --- | --- | --- | --- |
| D-001 | SUPERSEDED | Working public project and package stem | Preserve the original `pptx-pipeline` decision as dated history; D-044 owns the current name. | Official npm registry returned E404 and exact-name public searches found no project on 2026-07-30; the later public collision and user-selected replacement are recorded in D-044. |
| D-002 | ACCEPTED | License | Use the MIT License. | User selected MIT after reviewing the Apache-2.0 trade-off; official MIT text is present in `LICENSE`. |
| D-003 | ACCEPTED | Public Git author identity | Use the user-approved repository-local identity; do not duplicate its personal fields in tracked planning files. | Local `git config` verification completed. |
| D-004 | ACCEPTED | Repository shape | Use a private-root npm monorepo with separately publishable core, CLI, and optional adapters. | User decision recorded; dependency-direction tests remain required. |
| D-005 | ACCEPTED | Runtime target | Target Node.js 22.x and 24.x LTS on Linux, Windows, and macOS; the private root manifest enforces these release lines. | The official Node.js release table listed both lines as LTS on 2026-07-30; M3-004B records complete accepted-PR and accepted-main six-cell execution. Platform rows remain experimental and support claims remain disabled. |
| D-006 | ACCEPTED | Schema source of truth | Use JSON Schema Draft 2020-12 as normative; generated or verified TypeScript types remain a later consumer. | M0-004 validates the bounded provenance contract from its checked-in schema and rejects structural, enum, rights, date, and version mutations. |
| D-007 | OPEN | Public formula font | Select an OFL-compatible math font for SVG examples; do not redistribute proprietary fonts. | License file and rendered conformance proof. |
| D-008 | ACCEPTED | Pandoc integration | Invoke only a separately installed executable at a trusted absolute path through the optional adapter; never bundle, link, install, or dynamically discover Pandoc. Admit `>=2.15.0 <4.0.0` only after fixed version/API/OMML probes, and omit executor registration when unavailable. | M2-004 attribution record, fixed-process and absence/error tests, strict DOCX/OMML reconstruction, unsupported formula rows, and unchanged false global claim switch. |
| D-009 | ACCEPTED | Unsupported high-risk OOXML | Reject macros, ActiveX, OLE, embedded packages, and unsafe external relationships in 0.x. | M1-005 bounded high-risk path/content-type/relationship/XML mutations and unchanged unsupported matrix rows. |
| D-010 | ACCEPTED | PowerPoint evidence adapter | Keep macOS automation optional, trusted/manual, and outside public PR CI. | Static PowerPoint-only automation, explicit local trust, CI refusal, absolute-path and presentation-set checks, ignored raw evidence, closed readable receipt validation, and one exact public-synthetic ordered save/reopen plus independent-pixel result. |
| D-011 | ACCEPTED | Copyright holder | Elliot Wu. | User stated that no employer, university, collaborator, or other holder applies to the new clean-room project. Third-party dependencies and migrated candidates still require separate rights review. |
| D-012 | SUPERSEDED | npm package scope and alpha names | Preserve the original four unscoped working names as dated history; D-044 owns the renamed four-package set. | Both the original and replacement registry checks are time-bounded and reserve nothing. |
| D-013 | ACCEPTED | Git remote timing and visibility | Keep no remote until the public synthetic-fixture CLI flow is executable; after a fresh public-preflight gate, create the repository as public. | User selected post-executable timing and public visibility; D-044 now fixes the exact GitHub target. |
| D-014 | ACCEPTED | Public support taxonomy | Use exactly `supported`, `experimental`, `manual`, and `unsupported`, with a global claim switch and machine-checked evidence/disposition rules. | M0-005 matrix/schema/checker plus 13 overclaim/drift mutations. |
| D-015 | ACCEPTED | 0.x contract compatibility | Breaking contract changes increment the minor version with migration notes; patches remain compatible within a minor except an immediate documented safety demotion; unknown versions/fields fail closed. | M0-005 compatibility policy and schema-version mutations. |
| D-016 | ACCEPTED | First public data-contract set | Use contract version `0.1.0`, eight closed root documents, registered shared references, generated TypeScript declarations, and explicitly schema-only synthetic examples. | M1-002 manifest, shared validator, cross-document gate, and positive/negative fixtures. |
| D-017 | ACCEPTED | ProjectContext boundary | Use a pure runtime context with an explicit absolute root and injected exact ProjectConfig validator; defer filesystem identity and time-of-use safety to actual consumers. | M1-003 context source, path/dependency mutations, ambient-root scan, and explicit M1-005/M2-005 security boundary. |
| D-018 | ACCEPTED | Template inspection versus secure ingestion | Keep core inspection as a pure normalization of an explicit parsed package view; admit only the reviewed public fixture producer in M1-004 and defer untrusted file/ZIP/XML conversion to M1-005. | M1-004 source, public execution golden, graph/redaction mutations, clean-directory module-closure smoke, and unchanged false support switch. |
| D-019 | ACCEPTED | Initial secure-ingestion profile | Use a non-relaxable narrow ZIP/XML/OPC profile and a one-step `ProjectContext` source-to-index API; document portable Node filesystem race limits instead of claiming hostile-directory atomic containment. | M1-005 stored/DEFLATE positives, filesystem/archive/XML/OOXML mutation suite, exact public golden, residual-risk review, and unchanged false support switch. |
| D-020 | ACCEPTED | Capability runtime and dispatcher trust boundary | Keep serialized registry IDs declarative; atomically bind only trusted exact artifact registrations, preflight complete batches, and execute authenticated one-shot plans without dynamic loading or fallback. | M2-001 runtime, conformance-only schemas/fixture/executor, admission/dispatch mutation suite, support-policy tests, and unchanged false support switch. |
| D-021 | ACCEPTED | Semantic project resolution and clone/fill plan boundary | Resolve the complete in-memory registry/overlay/index/deck graph before dispatcher preflight, bind exact runtime registry content, and keep clone/fill output data-only until isolated OOXML application exists. | M2-002 resolver, product artifact set, public semantic mutation suite, exact unavailable policy, and unchanged false support switch. |
| D-022 | ACCEPTED | Minimal native component and ID boundary | Emit one fixed native card-arrow group as an unbound, non-insertable conformance exemplar; keep component IDs local and require safe target-slide rebuild/remap in M2-005. | M2-003 metadata, schemas, executor, public conformance fixtures, strict XML/vocabulary QA, experimental opt-in policy, and unchanged false support switch. |
| D-023 | ACCEPTED | Effect-first product objective and model-assisted planning boundary | Treat rendered communication effect as the user objective while keeping deterministic assembly as an enabling constraint; allow prompt-driven planning/review only as optional, non-authorizing labs that core cannot import. | User direction, revised project definition, lab/core dependency rule, disabled support claims, and the clean-room presentation design-planning review. |
| D-024 | ACCEPTED | Secure ZIP local-extra compatibility profile | Continue rejecting central and unknown local extras; admit only one bounded canonical Open Packaging Growth Hint in a local header, without treating it as producer authentication. | Public text-derived positive/boundary/adversarial tests plus a local public-synthetic PowerPoint save/reopen probe; support remains disabled. |
| D-025 | ACCEPTED | Persistent layout intent and delivery authority | Preserve both replayable `SlideLayoutIR` constraints and the frozen `ComposedSlidePlan`; product placement uses semantic slots while the raw-coordinate API remains a low-level compatibility primitive, and structural output is written as a non-deliverable candidate. | JSON round-trip/drift/collision tests, semantic-slot product-path tests, same-artifact render reviews, PowerPoint edit/save/reopen evidence, and unchanged false support switch. |
| D-026 | ACCEPTED | Typed OMML target boundary | Reparse and typed-rebuild one bounded `mc:AlternateContent` formula target whose `a14:m -> m:oMathPara -> m:oMath` choice stays native and whose fallback remains editable linear text; bind its semantic slot, frozen plan, target capacity, and digests in the candidate build record; grant no delivery/support authority. | Typed topology/fallback/style tests, exact one-slide diff, PowerPoint open/save/reopen evidence, independent pixel review, bounded closing code review, later D-032 feature-level edit observation with the direct receipt still absent, and unchanged false support switch. |
| D-027 | ACCEPTED | Normative candidate build record | Add `CandidateBuildRecord 0.1.0` as a separate non-delivery root contract; canonically persist exact semantic-slot IR, replayed plan, diff, capability evidence, and candidate byte identity beside direct native candidates, with the record published before the PPTX commit marker. | Schema fixture and generated types, contract replay/source-tuple mutations, native/OMML bundle replay and tamper tests, create-only/no-overwrite checks, bounded independent review, and unchanged false support switch. |
| D-028 | ACCEPTED | Ordered candidate build record | Extend the same `0.1.0` union with one closed ordered-deck branch: make each slide's discriminated source build authoritative, bind every output identity and source hash, retain full replay data for every semantic native slide, and use a separate ordered bundle entry point over the same record-first/marker-last pair publisher. | Ordered schema/type positives, generic/card/typed-OMML ordered bundle replay and tamper tests, exact order/diff/source binding, redundant-classification rejection, raw-coordinate rejection, bounded independent review, and unchanged false support switch. |
| D-029 | ACCEPTED | Readable planning authority and boundary-only fingerprints | Keep unchanged inherited content/package structure in the source template, authored semantic content and relationships in the raw brief/evidence/`DeckSpec`, layout intent in `SlideLayoutIR`, and calculated geometry in `ComposedSlidePlan`; treat PPTX/OMML as derived outputs, screenshots as final visual facts, and SHA-256 only as an exact-object boundary check. Final delivery must reuse the generation derivation to reconstruct and exact-compare the complete IR/plan, then reconstruct the expected source→binding→payload→plan package before reusing `QaReport` plus `BuildArtifact`; do not add `GenerationIntent`, a formula AST, or a tenth root contract. | User decision, fixed-workflow/PAL/multimodal-review analysis, authority-map documentation, candidate-record replay plus full-constraint and target-specific package projection/tamper tests, source-preserving direct-OMML regeneration, complete-batch clone/fill ordered regeneration, operation-bound compatibility receipt checks, same-artifact pixel review, exact reviewed-to-delivered byte binding, and unchanged false support switch. |
| D-030 | ACCEPTED | Stable manual probe transport and visual-drift authority | Reuse one ignored regular-file carrier and preserve its file identity for trusted local PowerPoint probes; keep that in-place transport outside product publication. Compute exact image equality before model review, collapse identical comparison images, and require repeat viewing for alleged blank or missing-content failures. | Same-file identity/exact-byte regression, executable bounded visual-evidence dedup plan, PowerPoint 16.111.3 mixed-deck save/reopen evidence, byte-identical per-page renders, contradictory-view replay and reviewer correction, and unchanged false support switch. |
| D-031 | ACCEPTED | Same-candidate evidence authority | Keep manifest creation and evidence inspection public but permanently non-authorizing. Only the fixed explicit-trust, CI-refusing local bridge may verify its captured PDF/image files with fixed Poppler tools, translate the frozen facts into private one-shot receipts, and invoke the existing `BuildArtifact`-last publisher. | Public API/export regression, exact carrier/candidate and manifest/review bindings, same-handle bounded file reads, exact PDF page/raster verification, a fresh fixed-candidate prepare/finalize run, bounded independent code re-review, and unchanged false support switch. |
| D-032 | ACCEPTED | Formula-edit observation boundary | Separate byte-derived observations from explicit operator attestation; admit only the exact fixed candidate/record/derivative triple into an ignored feature-level record, and grant it no direct receipt, delivery, or support authority. | Fixed digest/source/slide relation, readable `3/3 -> 2/3` edit, explicit no-repair/save/close/reopen/editable attestation, twelve adversarial tests, bounded re-review, and unchanged false support switch. |
| D-033 | ACCEPTED | Bounded M2-005 completion boundary | Close M2-005 on the exact fixed mixed public-synthetic vertical slice; keep the exact direct-OMML receipt, generalized target-specific ordering, release, and support as separate fail-closed follow-on work. | Source/DeckSpec/IR/plan replay, exact diff and reconstruction, same-candidate render/pixel and ordered PowerPoint evidence, D-032's non-authorizing edit observation, QA/BuildArtifact publication, pre/post-commit fault tests, 1046 passing tests, working-tree gates, and a 0/0/0 milestone-exit review. |
| D-034 | ACCEPTED | Thin CLI protocol and first command boundary | Use one `0.1.0` CLI envelope, process exits `0/1/2`, and existing domain `code + pointer`; implement real `inspect`/`validate` over explicit contained paths and normative Schemas, while every command without genuine authority fails unavailable. | Core Schema move with compatibility re-export, secure-ingestion reuse, create-only configured index output, read-only validation, deterministic/redacted process tests, and unchanged false support switch. |
| D-035 | ACCEPTED | M3 candidate-alpha critical path | Replace eight-command breadth and render-before-bootstrap with one on-disk project spine, whole-project validation, one exact experimental candidate profile, and honest blocked/pass QA; create the public repository before collecting final public CI evidence. | Five-layer Linus audit, one bounded independent challenge reporting 3 blocker/3 high/2 medium planning findings, explicit support-closure and QA semantics, corrected TODO/handoff/release order, and no production/support change during the audit. |
| D-036 | ACCEPTED | M3 on-disk project spine | Make one production public-synthetic preset the create-only bootstrap, remove duplicate inspect output authority, split document/project validation, and prepare/discard a normative full-batch project plan without project execution or render authority. | Three-state bootstrap fault tests, source re-inspection, static registration conformance, normative opt-in, complete graph/preflight mutations, 1065 passing tests, and a closing 0/0/0 bounded review. |
| D-037 | ACCEPTED | Exact experimental candidate render | Authorize only the frozen public-synthetic one-slide native-card profile through its complete normative support closure; bind one stable source byte snapshot to the full readable TemplateIndex, derive layout through the semantic slot, execute a fresh one-shot plan, and publish only a replayable candidate pair with explicit commit states. | Fifteen invariant rows plus the matching Node 22/24 and public-automated rows, full-index/profile and geometry equality, typed assembly and exact diff, deterministic record/PPTX pair, three-state publication faults, 180 focused and 1076 complete tests, independent frozen-pixel review, false global support switch, and no QaReport/BuildArtifact. |
| D-038 | ACCEPTED | Honest blocked QA for the exact candidate | Re-derive the current authenticated candidate and canonical record from readable project authorities, exact-compare both stable-read files, and emit the existing fixed blocked QaReport when external visual/compatibility evidence is unavailable; never create BuildArtifact or scan local evidence. | Full QaReport output, three pass/three unavailable checks, normative manual-gate rows, exact pair/replay checks, missing/tampered/stale/resource/symlink/validator mutations, create-only and deterministic output, 99 focused and 1085 complete tests, closing 0/0/0 review, unchanged support counts, and false global support switch. |
| D-039 | ACCEPTED | Guarded candidate-alpha package graph | Publish only CLI, core, native-card-arrow, and public-synthetic in the first alpha graph; make resource ownership explicit and expose narrow facades. D-045 supersedes only D-039's former repository-pending guard. | Positive source-to-stage plan, exact exports/types/bin/import aliases/assets, dependency and forbidden-closure mutations, split-resource full-spine execution, executable-bin check, and no labs/PowerPoint/Pandoc/OMML/ordered/final-delivery content. |
| D-040 | ACCEPTED | Fixed-stage and tgz byte acceptance boundary | Keep the readable plan and retained source/policy bytes authoritative; use one recoverable owned stage, treat npm as a constrained packer, independently admit only canonical exact tgz bytes, and keep final hashes as boundary fingerprints. | Private leaf manifests, strict gzip/ustar and forbidden-material mutations, control/source/tarball retained-byte checks, live/stale stage and completion recovery, offline four-package install, installed-bin full spine, blocked QA, and no BuildArtifact. |
| D-041 | ACCEPTED | Local public-workflow and development-toolchain boundary | Keep exactly two canonical least-privilege workflows, derive declaration paths and the static-ESM SBOM projection from the alpha package plan, and separate local workflow definition from public runner evidence. | Full-SHA action pins, fixed three-OS/two-Node matrix, real TypeScript consumer, exact dev lock, source/release/workflow mutations, and local Node 22/24 verification. M3-004B closes on accepted PR runs `31600528716`/`31600528742` and accepted-main runs `31600806512`/`31600806350`, bound to one byte-identical tree. |
| D-042 | ACCEPTED | Minimum public documents and first-ref private-reporting boundary | Give security, contribution, governance, and reproduction one readable owner each; use GitHub private vulnerability reporting without publishing a second personal contact, and require empty-public-repository creation, positive activation/status verification, repository-bound package regeneration, and a fresh package gate before any source branch/ref is pushed. | Exact document routing and workflow-command projection, fail-closed document mutations, zero text/copyright leakage exceptions, dual-runtime local verification, D-045 remote activation, and completed M3-006 repository-bound regeneration plus separately gated first ref. |
| D-043 | ACCEPTED | Reachable-history and exact-first-ref boundary | Reuse the current forbidden-material policy to scan every commit/tree-entry/message reachable from local `refs/heads/main`, derive reachability from raw parent/tree OIDs, verify metadata against the repository-local public Git identity without echoing it, and push only the scanned exact object ID after remote/PVR/package reconciliation. | Bounded history mode, eight deletion/redirect/grammar/message/identity/type/resource regressions, final 14-commit/505-leaf/7,698,368-byte/28-identity zero-finding scan, canonical HTTPS push, and exact remote-main equality. |
| D-044 | ACCEPTED | Final pre-public product and repository identity | Use `pptx-compiler` as the one public repository, CLI, package, import, and serialized-contract stem; keep only the existing ignored transaction namespace and dated history under the former working name. | User selected `why7682/pptx-compiler`; exact GitHub and four-name npm checks were clear on 2026-08-11, and the atomic rename must pass dual-runtime package and contract evidence before the first ref. |
| D-045 | ACCEPTED | Empty public shell, repository binding, and separate npm guard | Bind GitHub repository ID `1330979133` plus its exact owner/name/URL into package-plan schema v2 after empty-public creation and positive PVR verification; derive manifest/SBOM repository data from that tuple while retaining `private: true` and a blocked npm release guard. | Public/empty repository facts, PVR PUT 204 plus GET `enabled: true`, exact repository/manifest/SBOM mutations, canonical-plan evidence fingerprint, and repository-bound dual-runtime package verification; M3-006 later supplied the final first-ref evidence. |
| D-046 | ACCEPTED | Constructive final-document structure | Write final reader-facing documentation by constructing one coherent model from goals and boundaries through fact ownership, data/control flow, executable contracts, evidence, limitations, and next actions; keep chronological repair history in handoffs, decisions, and provenance rather than using it as the main exposition. | Explicit user requirement; M3-005B must review README, architecture, support, limitations, and release-facing text against this structure before freezing them. |
| D-047 | DEFERRED | Main-branch protection | Do not configure or claim branch protection yet; revisit force-push/deletion restrictions and required status checks only after M3-005B is complete. | Explicit user instruction on 2026-08-12 to postpone this repository-setting change; M3-004B completion does not activate it. |

Record a decision by changing its status to `ACCEPTED`, adding the date and
rationale below the table, and updating every affected contract/TODO in the
same change.

## Decision record — 2026-07-30

- **D-001 accepted, later superseded by D-044:** `pptx-pipeline` was the working project name and package
  stem. The official npm registry returned `E404 Not Found` for the unscoped
  name on 2026-07-30, and exact-name public searches found no conflicting
  project. This does not reserve the name or resolve trademark conflicts; see
  `docs/NAME_AVAILABILITY.md`.
- **D-002 accepted:** use the MIT License. The user prioritized its short,
  minimal redistribution conditions over Apache-2.0's explicit patent terms.
- **D-003 accepted:** the user supplied a public Git author identity. It has
  been configured only in this repository's local Git settings and is not
  repeated in tracked documents.
- **D-004 accepted:** use a monorepo with a private workspace root and separately
  publishable core, CLI, and optional adapter packages.
- **D-011 accepted:** Elliot Wu is the copyright holder for this new clean-room
  project. This does not grant rights to import third-party or predecessor files;
  each candidate remains subject to the provenance gate.
- **D-012 accepted, later superseded by D-044:** M3-002 resolved the deferred alpha naming decision to four
  unscoped names: `pptx-pipeline`, `pptx-pipeline-core`,
  `pptx-pipeline-native-card-arrow`, and
  `pptx-pipeline-public-synthetic`. All four official-registry queries returned
  E404 on 2026-08-11. That evidence is time-bounded and reserves nothing; the
  complete graph must be rechecked atomically immediately before publication.
- **D-013 accepted:** do not create a remote during planning or foundation work.
  Once the synthetic public fixture completes the executable CLI flow and the
  public-preflight scan passes, create a public repository. Select the hosting
  account/organization at that gate.
- **D-005 accepted:** support the actively supported Node.js 22.x and 24.x LTS
  release lines on Linux, Windows, and macOS. The private workspace manifest
  declares `^22.0.0 || ^24.0.0`; the local Node.js 23 development run is not
  support evidence. The official release status was checked at
  <https://nodejs.org/en/about/previous-releases> on 2026-07-30.
- **D-006 accepted:** JSON Schema Draft 2020-12 is the normative schema source.
  M1-002 extracts a dependency-free, fail-closed evaluator for the repository's
  bounded keyword subset, adds registered absolute references, and generates
  checked-in TypeScript declarations. Unsupported keywords still fail closed;
  this evaluator is not claimed as a complete JSON Schema implementation.
- **D-014 accepted:** public status is restricted to `supported`,
  `experimental`, `manual`, or `unsupported`. The normative matrix has a global
  claim switch, exact item scope, explicit catch-alls, and evidence rules. It is
  false at M0-005 completion, so no PPTX capability is currently supported.
- **D-015 accepted:** during 0.x, incompatible public contract changes require a
  minor-version increment, migration notes, and negative tests. Patches remain
  backward-compatible within their minor contract except that an unsafe claim
  may be demoted immediately with an explicit security/compatibility notice.
  Unknown versions and fields fail closed absent an explicit tested migration.
- **D-016 accepted:** the first data-contract version is `0.1.0`. Eight root
  schemas share registered definitions and generate TypeScript from the
  normative schemas. Their positive examples are marked
  `schema-conformance-only`; placeholder executor/schema/QA identifiers and a
  fictional build record are never implementation or support evidence.

## Decision record — 2026-08-01

- **D-017 accepted:** `ProjectContext` is deterministic path/dependency wiring,
  not a filesystem authorization token. It requires an explicit absolute root,
  revalidates a frozen `ProjectConfig 0.1.0` snapshot through an injected exact
  validator, and resolves only lexically contained locations. Constructor-time
  `realpath`/`lstat` checks would not prevent replacement before use; secure
  opening stays with M1-005 consumers and staging/publication stays M2-005.
- **D-018 accepted:** `TemplatePackageView 0.1.0` is a runtime adapter contract,
  not proof that bytes were opened or parsed safely. M1-004 core accepts the
  reviewed-fixture producer class, validates its normalized content/relationship
  graph, and emits a frozen schema-validated `TemplateIndex` without I/O.
  M1-005 must implement and prove the separate untrusted filesystem, ZIP, XML,
  relationship, high-risk-part, and resource-limit boundary before another
  producer class or user-owned input can be admitted.
- **D-009 accepted:** the 0.x high-risk policy is rejection, not preservation or
  quarantine. The M1-005 high-level boundary rejects macros/VBA, ActiveX, OLE,
  embedded packages/objects, and external relationships through independent
  path, content-type, relationship, and XML vocabulary checks. These tests do
  not promote any compatibility row.
- **D-019 accepted:** the first secure-ingestion profile is deliberately narrow
  and non-configurable: 1 MiB archive, 32 members, 256 KiB per member, 1 MiB
  expanded total, 100:1 compression ratio, bounded strict XML, and an exact
  public minimal OOXML grammar. `inspectTemplateSource()` accepts no alternate
  path/parser/view/limits. It uses stable opened-handle identity checks and
  `O_NOFOLLOW` where available, while explicitly retaining the portable Node
  TOCTOU residual recorded in the threat model. `TemplatePackageView` remains
  version `0.1.0` because its exact data shape did not change; admitting a new
  producer class is additive and the label itself remains non-authoritative.

## Decision record — 2026-08-02

- **D-020 accepted:** `CapabilityRegistry 0.1.0` remains declarative metadata;
  executor/schema/QA URNs are exact comparison keys and never module paths.
  Runtime contract `0.1.0` atomically admits only complete trusted artifact
  bundles, verifies their public conformance cases, and keeps the executable
  map behind a frozen facade. Dispatch snapshots and validates the full batch,
  checks support policy and preflight for every invocation, then consumes an
  authenticated plan once before ordered execution, output validation, and QA.
  The repository probe is data-only conformance infrastructure, not a product
  capability. Trusted executors are not sandboxed; staging rollback, source
  isolation, and atomic publication remain M2-005.

## Decision record — 2026-08-03

- **D-021 accepted:** the project-level resolver is synchronous and pure. It
  snapshots all four version `0.1.0` documents before invoking exact validators,
  rejects the complete ambiguous/dangling semantic reference graph, authenticates
  exact registry content against M2-001 private runtime state, and returns only
  an opaque dispatcher plan. The statically registered clone/fill executor
  derives source and target identities only from resolved invocation data and
  emits a closed clone-plus-text-fill operation plan. It has no package or
  staging authority. The product row remains `unsupported/unavailable`; only
  M2-005 may establish actual OOXML application, source isolation, collateral
  safety, and publication evidence.
- **D-022 accepted:** `native-card-arrow@0.1.0` is the sole initial native
  component. A fixed typed tree canonically emits an allowlisted `p:grpSp` with
  one text-bearing `roundRect` and one `rightArrow`; payload data cannot supply
  XML vocabulary, relationships, or source identifiers. The fragment is an
  unbound conformance exemplar with `insertable: false`, component-local
  `1/2/3` IDs, and mandatory target-slide remapping. Its exact capability row is
  experimental and opt-in with all executable artifacts, while broad
  DrawingML, slide text, package output, and PowerPoint editability remain
  unsupported. M2-005 must rebuild from typed data, allocate collision-free
  IDs, validate containment, and apply only in isolated create-only staging.
  The M2-003 TODO exit criterion is therefore clarified in the same change:
  "native" and "non-raster" describe the structurally validated DrawingML
  exemplar, while target insertion and editable-PowerPoint evidence are
  explicit M2-005 obligations. This clarification prevents the milestone from
  claiming an output artifact that its dispatcher result cannot produce.

## Decision record — 2026-08-05

- **D-008 accepted:** Pandoc is a user-installed optional external program, not
  repository or package content. Trusted host configuration supplies one
  absolute executable path; capability data cannot choose a process, argv,
  path, environment, defaults file, filter, resource path, reference document,
  or network location. The adapter accepts only Pandoc `>=2.15.0 <4.0.0`, then
  requires fixed sandboxed JSON-API and canonical OMML capability probes before
  an executor can be registered. Missing, incompatible, warning-producing,
  malformed, timed-out, output-limited, or capability-drifting processes remain
  unavailable. Formula text is JSON-encoded into a Math AST on stdin, and DOCX
  stdout is treated as untrusted ZIP/XML before one non-insertable `m:oMath`
  conformance fragment is rebuilt. Pandoc is not bundled, linked, installed,
  copied, or redistributed; its GPL-2.0-or-later identity and the generated-
  output caveat are recorded in `docs/PANDOC_ADAPTER_ATTRIBUTION.md`. Public
  evidence uses a fake runner and repository-authored text-derived DOCX, so
  formula input/transplant/native-OMML rows remain unsupported, the global
  claim switch remains false, and M2-005 plus COMPAT-OMML-001 retain application
  and PowerPoint editability authority.

## Decision record — 2026-08-09

- **D-023 accepted:** the product objective is a rendered presentation that
  communicates well from a user-owned template and semantic data; archive
  correctness, determinism, editability, and fail-closed handling are enabling
  constraints rather than substitutes for the result. Version 0.x may emit an
  optional rendered-review report and may use prompt-driven planning/review only
  in `labs/`. Those labs are not a required product path, cannot be imported by
  core or authorize package mutation, do not add a supported capability, and
  cannot claim actual audience comprehension from model preference alone. The
  template remains authoritative through explicit locked/flexible modes; a
  scratch art-direction route remains lab-only. This decision formalizes the
  earlier project-definition edits and the sequencing correction in
  `docs/PRESENTATION_DESIGN_PLANNING_REVIEW.md`.
- **D-024 accepted:** secure ZIP profile `0.2.0` keeps every central-directory
  extra field and every unknown local field rejected, but accepts one complete
  local Open Packaging Growth Hint (`0xA220`) under explicit per-entry and
  aggregate limits. The field must carry signature `0xA028`, exact lengths, and
  zero-filled padding; the narrower repository profile also requires the
  initial padding length to equal the current padding. This is a standards-
  based compatibility exception, not proof that PowerPoint produced the file.
- **D-025 accepted:** layout intent and resolved geometry are separate durable
  facts. `SlideLayoutIR` keeps semantic slot bounds, parent-owned padding,
  allowed component identity, alignment, fixed size clamps, collision policy,
  and requested placement; `ComposedSlidePlan` binds the IR digest to frozen
  EMU boxes, paint bounds, z-order, and a constraint receipt. The product-level
  native path accepts `slotRef`, `placementIntent`, and preferred size, then
  requires the typed executor geometry to equal the resolved plan. The old raw-
  coordinate applicator remains available as a low-level 0.x compatibility
  primitive. Structurally authenticated bytes now have an explicit candidate
  writer with `deliveryEligible: false`; the legacy publication-named API is
  retained as a compatibility alias and grants no final delivery authority.
  The IR and frozen plan must travel together as the candidate build record;
  PPTX bytes alone are an output, not a recoverable source of layout intent.
  The repaired public-synthetic artifact passed deterministic occupancy,
  save/reopen structural checks in PowerPoint 16.111.3, and two independent
  pixel-only visual reviews before and after the PowerPoint round trip. This is
  narrow local compatibility evidence, not arbitrary-template or support
  promotion.
- **D-026 accepted:** the optional adapter remains responsible only for an
  unbound, non-insertable conformance result. Core independently strict-parses
  its exact typed/validated output, enforces the target's smaller element/run/
  text capacity, rebuilds fixed namespace-expanded nodes and math run styling,
  and inserts one `mc:AlternateContent` target whose Office 2010 choice is
  `a14:m -> m:oMathPara -> m:oMath` and whose fallback is an editable linear
  text shape. The generator never concatenates raw OMML, creates a relationship,
  or flattens the formula to a picture. The formula target is a semantic slot in the same replayable
  `SlideLayoutIR` and digest-bound `ComposedSlidePlan`; target capacity and
  formula/artifact digests also remain in the JSON-safe candidate build record.
  PowerPoint 16.111.3 opened and round-tripped the candidate without repair,
  retained native OMML, and authored its own fallback on save. A shape-name
  edit and a pixel composite do not prove formula-content editability. At D-026
  acceptance the manual gate, typed-OMML ordered-deck application/records, final
  delivery authority, real-Pandoc matrix, and support promotion were open. The
  later D-028 extension closes the ordered candidate/replay item. D-029 later
  implements a source-preserving direct-OMML final preparation path, but the
  actual human formula-content receipt, real-Pandoc matrix, ordered delivery,
  broader compatibility, and support gates remain open.
- **D-027 accepted:** `BuildArtifact` continues to describe a QA-backed
  published output and is not overloaded with pre-delivery state. The additive
  `CandidateBuildRecord 0.1.0` root instead stores one direct semantic-slot
  candidate's complete `SlideLayoutIR`, exact replayed `ComposedSlidePlan`,
  constraint receipt, package diff, capability-specific native/OMML evidence,
  base digest, and candidate basename/length/SHA-256. Canonical loading re-runs
  the resolver and rejects plan, source-profile, evidence, diff, filename, or
  byte drift. The bundle writer stages both files in one directory, publishes
  the record first, and publishes the PPTX last as the visible commit marker;
  successful rollback removes both owned links, while an unconfirmed candidate
  removal or directory barrier retains the record. The old PPTX-only writer and
  publication-named compatibility alias are unchanged. At the D-027 boundary,
  fixed-absolute and ordered artifacts remained outside until complete replay
  data existed; the sidecar grants neither final-delivery nor support authority.
- **D-028 accepted:** the additive ordered branch keeps the same root contract
  version and candidate-versus-delivery meaning. It records the base artifact
  digest, exact slide/relationship/presentation ordering, every source
  one-slide digest, deck diff, and output identity. Each slide's closed
  `sourceBuild` union is the only classification authority; derived native
  flags, counts, and ordered source-profile labels are omitted so they cannot
  drift from the actual source list.
  Clone/fill-only slides remain explicitly digest-bound instead of receiving a
  fabricated layout plan. Each semantic card-arrow source retains its original
  slide part, base digest, complete bounded-slot IR, exact composed plan and
  receipt, one-slide diff, and allocated IDs. The typed-OMML extension uses the
  same authenticated profile table and ordered branch, retaining the formula
  source's complete IR/plan/diff plus digest, capacity, and observed target
  evidence while copying its authentic slide bytes exactly. Generic and native-
  containing ordered artifacts use `writeAuthenticatedOrderedCandidateBundle`;
  raw-coordinate native slides remain rejected.
  The shared record-first/candidate-last publisher and old 0.x APIs are
  unchanged, and no ordered or support authority is granted. D-029 later adds a
  separately regenerated direct-OMML final path; the ordered record itself does
  not authorize it.
- **D-029 accepted:** there is one owner for each kind of fact. The source
  template owns unchanged inherited content and package structure. The raw
  brief, evidence inventory, and `DeckSpec` own authored semantic content and
  relationships; formula source remains LaTeX in `DeckSpec`. `SlideLayoutIR` owns editable
  layout intent and constraints. `ComposedSlidePlan` owns the deterministic
  resolved geometry and measured constraint receipt. `CandidateBuildRecord`
  is therefore a layout/build replay record, not a complete content-
  regeneration source. No `GenerationIntent`, persisted formula AST, or
  parallel delivery root is added.
  Existing `0.1.0` digests remain for compatibility and exact-object integrity,
  but they are not semantic authority and must not be copied into additional
  layers without a concrete identity need. The final candidate digest is kept
  only to prove that the reviewed PPTX is the delivered PPTX; byte equality is
  not semantic equivalence. Iteration uses deterministic calculations first,
  while final acceptance requires a render of that exact candidate and an
  independent pixel review. The execution model is a fixed chain—plan,
  calculate, assemble, render, independently review—not one autonomous agent
  that generates and approves its own work. The existing `QaReport` and
  `BuildArtifact` remain the QA and final-publication records. A final boundary
  must first use the same pure calculation as generation to re-derive the full
  `SlideLayoutIR` and `ComposedSlidePlan` from source/index facts plus the
  readable `DeckSpec` request and compare both whole objects. It then
  reconstructs the target-specific source/template + overlay/index + DeckSpec
  payload + composed-plan package and compares it with the actual package. A
  matching component box, record discriminator, or candidate hash is not
  generation authentication.
  The direct typed-OMML implementation follows this without a new semantic
  layer. It derives a source-preserving normalized base from the exact admitted
  template/index, resolves a fresh dispatch from the captured DeckSpec LaTeX,
  shares the existing typed OMML mutation core, and requires the complete
  regenerated archive plus IR/plan/diff/formula evidence to equal the reviewed
  candidate. The older clone/fill OMML entry remains compatible but its authored
  title cannot enter final delivery. Every caller-owned fact is captured before
  the async execution boundary. Compatibility authentication is also purpose-
  bound: the expected and returned receipt must name
  `formula-content-edit-save-reopen`; the existing shape-name edit cannot be
  reused. This implements the gate without claiming that its required human
  evidence exists or changing any support row. Generation call history is not a
  new authority: a compatibility call that writes the exact source-owned text
  and therefore converges to the identical source/DeckSpec-derived archive and
  report is accepted; only observable relationship drift is rejected.
  The clone/fill-only ordered implementation applies the same rule at batch
  scope. It snapshots one complete same-template 2–11 slide readable project
  tuple, executes one resolver batch, regenerates every slide from source/index
  facts, and exact-compares the rebuilt archive and all ordered record facts.
  Receipts cover the complete ordered slide list and compatibility must name
  `ordered-deck-open-save-reopen`; `BuildArtifact` remains the final publication
  marker. The executable ceiling is 11 because the admitted package has ten
  fixed ZIP parts plus two per slide under the existing 32-entry security limit.
  The older 16-slide CandidateBuildRecord parsing ceiling is retained only for
  format compatibility and grants no executable or support authority.

- **D-030 accepted:** macOS PowerPoint sandbox consent can attach to a file
  identity rather than merely to a directory name. The trusted local adapter
  therefore uses one ignored regular-file carrier, replaces its bytes through
  the already-open file descriptor, fsyncs, and verifies unchanged device/inode
  plus exact resulting bytes. This is deliberately not atomic publication: it
  is a local transport seam for an already authenticated public-synthetic
  candidate. Product source templates remain read-only and product candidates
  remain create-only.
  Pixel equality is cheaper and stronger than a model comparison. When two
  rendered pages are byte-identical, orchestration records that fact and sends
  at most one representative image for quality judgment. A reviewer may still
  find a defect shared by both pages, but it cannot claim drift between equal
  bytes. `prepareVisualEvidencePlan` makes this executable from bounded detached
  image bytes, emits explicit comparison relations and the minimal review-image
  set, and uses SHA-256 only to bind snapshots while byte comparison decides
  equality. Blank or missing-essential-content observations require an immediate
  reopen of the exact image; inconsistent views are input instability, not a
  deck defect. This rule was added after one blind review incorrectly reported
  missing text from transient incomplete image displays, then reproduced the
  display failure and withdrew the finding on exact-path replay.

## Decision record — 2026-08-10

- **D-010 accepted:** the optional macOS PowerPoint evidence adapter is a
  trusted/manual compatibility probe, not a renderer dependency or public-CI
  step. The Node runner requires an explicit local flag, refuses common CI
  environments, uses one stable ignored root, admits only its deterministic
  repository-owned candidate/record, bounds process time/output, checks source
  immutability, and emits a receipt only after every expected file exists. Its
  static AppleScript accepts only absolute paths, uses no shell, System Events,
  or VBA, refuses pre-open user presentations, closes only a narrowly identified
  cold-start blank, and requires the sole running presentation to have the
  expected absolute path after each open. PowerPoint 16.111.3 preserved the
  exact two-slide readable order/text; corresponding before/after pixels were
  byte-identical and passed one independent anonymous pixel review. Raw PPTX,
  PDF, transcript, pixel, and review artifacts remain ignored. This accepts the
  adapter boundary only; it does not promote support or prove other templates,
  the full 2–11 range, target-specific native/OMML ordered delivery, or the
  pending human formula-content edit.
- **D-031 accepted:** evidence normalization is not evidence authority. The
  public `same-candidate-evidence` module may snapshot and recompute one readable
  candidate/record/compatibility/PDF/raster/review relation, but returns only
  frozen facts marked `authority: none` and `deliveryEligible: false`. It exports
  no receipt session, token, authenticator, publisher, process, or filesystem
  capability; public synthetic PDF/PNG data therefore cannot publish a
  `BuildArtifact`.
  The sole authority bridge is the fixed trusted-local CLI. It refuses CI,
  accepts only an explicit absolute `pdftoppm` path and its sibling `pdfinfo`,
  rereads bounded regular files through `O_NOFOLLOW` handles, writes captured
  PDF bytes to exclusive snapshots, rejects extra pages, rerasterizes every page
  at 120 dpi, and requires exact PNG bytes before creating private same-process
  one-shot receipts. The existing final preparer still regenerates the complete
  readable project and candidate record, while the shared publisher exposes
  `BuildArtifact` last. This closes one exact fixed mixed-candidate chain only;
  it adds no root contract or support claim and does not satisfy the human
  formula-content edit or broader compatibility gates.
- **D-032 accepted:** a formula-edit machine observation and a human
  compatibility attestation are different data. The public PowerPoint module
  accepts only detached candidate, CandidateBuildRecord, and edited-derivative
  bytes; it verifies the record and reports the readable fraction transition
  plus observed namespace topology, but returns no gate, status, operation,
  human fact, receipt, delivery authority, or support claim. Because it does
  not run the closed typed-OMML grammar over PowerPoint's rewritten output, it
  states `closedGrammarValidated: false` instead of claiming that native OMML
  was mechanically proven editable.
  The fixed trusted-local recorder alone admits the exact public-synthetic
  candidate `ccbffcb1…2802`, record `5a88c576…15c1`, and edited derivative
  `2592ad9d…8d3`, then requires their fixed source/slide relation and the
  readable `3/3 -> 2/3` transition. Alternate self-consistent candidates,
  unrelated-slide changes, unknown parts, or any other derivative digest fail
  before a feature record can exist. Explicit operator and no-repair flags are
  recorded under `operatorAttestation`; they are not presented as machine
  proof. The resulting record is feature-level only, marked `authority: none`
  and `deliveryEligible: false`, and cannot satisfy the direct single-slide
  exact-candidate receipt contract or promote support.
  Node.js exposes no `openat` equivalent for the final create-only pathname, so
  the trusted-local writer retains one documented directory-swap residual:
  `wx` prevents overwrite and post-write device/inode/realpath checks detect
  drift, but cannot prevent a same-principal concurrent pathname swap. This is
  accepted only for ignored, non-authorizing public-synthetic evidence. The
  operator explicitly confirmed that both opening and reopening occurred
  without repair/conversion prompts, so the fixed feature-level
  `COMPAT-OMML-001` record passes. The direct single-slide receipt and support
  state remain unchanged.
- **D-033 accepted:** M2-005 is an assembly milestone, not an implicit promise
  to implement every cross-product of template, target, ordering, renderer, and
  platform. The exact fixed three-slide public-synthetic flow now preserves its
  source, binds readable semantic/layout authority, reconstructs and exact-
  compares the candidate, proves allowed/collateral changes, reviews the same
  rendered bytes, records ordered PowerPoint compatibility, emits QA and
  `BuildArtifact` through one shared create-only publisher, and exercises both
  sides of the publication commit boundary. That satisfies the written exit
  criterion.
  The direct single-slide OMML final-delivery path still lacks its purpose-bound
  formula-content receipt and therefore remains unavailable. General native/
  OMML ordered delivery and arbitrary template/platform compatibility remain
  separate work triggered by actual product demand. D-032 is retained as
  feature-level observation only. The complete suite passes 1046/1046, all
  working-tree gates pass, and the bounded exit review found 0 blocker, 0 high,
  and 0 medium. Support and release state remain unchanged; M3-001 is next.
- **D-034 accepted:** process exit codes answer only “success, operation failed,
  or syntax failed.” Re-encoding every domain error as a distinct process value
  would create a second taxonomy and make compatibility worse. Machine callers
  instead receive one deterministic `0.1.0` envelope whose error branch copies
  only an existing safe code and JSON pointer. JSON mode uses stdout for both
  branches so callers never have to merge streams; human failures use stderr.
  `inspect` reads a bounded ProjectConfig below an explicit root, validates it
  with the normative manifest/Schema set, creates the existing immutable
  `ProjectContext`, and calls the existing secure ingestion/inspector. It may
  publish only the configured TemplateIndex path and never overwrite it.
  `validate` is read-only and creates no executor plan. Moving the existing
  Schema subset into core, while retaining the old script import as a re-export,
  leaves one implementation and preserves workspace callers. Commands without
  real product authority return unavailable; no test helper, fixed local
  evidence, or false support override enters the CLI.
- **D-035 accepted:** the first useful public result is a candidate alpha, not
  eight implemented command names and not a false delivery alpha. D-034 remains
  the last implemented slice. Before mutation work, one create-only synthetic
  bootstrap must establish the actual on-disk project model; `inspect` must use
  ProjectConfig's TemplateIndex path without a duplicate output argument; and
  the alpha `validate` path must load and preflight the complete readable
  ProjectConfig/Profile/Index/Registry/Overlay/DeckSpec graph. The current
  single-document Schema diagnostic remains useful only under an explicit
  document meaning.
  A successful render is forbidden while any required normative support row is
  unavailable. The first candidate path will therefore select one exact
  public-synthetic native-card profile and promote only its complete proven
  dependency closure to `experimental` in the same reviewed implementation
  change, with explicit opt-in and `supportClaimsEnabled` still false. Missing
  rendered, pixel, or compatibility evidence produces the existing QaReport as
  `blocked`; it never produces BuildArtifact. Generic onboarding, doctor,
  standalone diff, formula CLI, direct OMML delivery, and generalized ordering
  do not block the candidate alpha. Finally, public repository creation moves
  before final public CI evidence, eliminating the old milestone cycle.
- **D-036 accepted:** the public-synthetic bootstrap is a production
  conformance-preset responsibility, not a testing-helper dependency. It lives
  under `packages/public-synthetic`; workspace scripts and tests reuse that
  producer. One exclusive explicit root is the only mutable target and
  ProjectConfig is its visible commit marker. Pre-marker failures distinguish a
  complete exact owned-path rollback from rollback-incomplete reconciliation;
  every failure after marker visibility is commit-uncertain and non-destructive.
  `inspect` now has no duplicate output argument. `validate document` preserves
  the narrow Schema diagnostic, while `validate project` loads the complete
  Config/Profile/Index/Registry/Overlay/Deck graph, securely re-inspects the
  source, exact-compares the index, and uses only the fixed installation
  registration plus normative matrix to prepare and discard a full-batch plan.
  Runtime registration still executes its fixed conformance fixtures, so the
  machine result says that explicitly; no user-project invocation runs, no
  project output is written, and render eligibility is not granted. This
  changes no support row, package publication decision, render authority, QA
  state, or release claim.
- **D-037 accepted:** candidate authority is narrower than renderer
  availability. The installation-owned profile closes exactly fifteen invariant
  input/OOXML/capability rows, the one runtime row selected from platform plus
  Node major, and the public-automated evidence row. Any missing, unsupported,
  or wrongly disposed row rejects before package mutation. All admitted rows
  remain experimental, the selection requires explicit opt-in, and
  `supportClaimsEnabled` remains false.
  Secure ingestion returns source bytes and TemplateIndex from one stable read.
  The host adapts the repository-owned readable POTX golden only to the preset's
  semantic profile/index IDs, validates and deeply freezes it, and requires the
  current complete index to match. The embedded digest binds exact source bytes
  but does not replace the readable graph as planning authority.
  Render re-derives `slide-content-tail` placement, exact-compares the whole
  calculated geometry with DeckSpec, creates a fresh one-shot plan, executes
  one typed native-card assembly, and checks containment, occupancy, source
  immutability, and exact package diff. ProjectConfig alone determines the
  output directory. CandidateBuildRecord is file-flushed and linked first, and
  PPTX is the logical commit marker; POSIX additionally requests parent-
  directory fsync barriers. Failures distinguish not committed, rollback incomplete, and
  commit uncertain without deleting a visible candidate. Success remains an
  experimental, non-deliverable candidate and creates no QaReport or
  BuildArtifact. A dedicated native-card publication entry and recursive import
  graph close the broad OMML/ordered startup dependency while one lower-level
  pair state machine and the old 0.x APIs remain compatible. The bounded
  re-review found 0 blocker, 0 high, and 0 medium. The next slice is honest
  blocked QA over that exact pair.
- **D-038 accepted:** blocked QA is a calculation over the same readable
  relationship authorities as generation, not an approval of a compiled PPTX
  in isolation. The CLI reloads ProjectConfig/Profile/Index/Registry/Overlay/
  DeckSpec, uses the same semantic-slot derivation with a fresh one-shot plan,
  rebuilds the expected authenticated candidate plus canonical record, then
  stable-reads and exact-compares both actual files before record replay.
  Valid internal evidence produces the existing QaReport with three passes and
  three unavailable external checks, `decision=blocked`, and no BuildArtifact.
  Missing, tampered, stale, oversized, symlinked, or noncanonical inputs fail
  without a report. QA accepts no evidence or output override and scans no
  directory, so ignored local facts cannot self-promote. Render and QA share one
  candidate/record projection, and JSON returns the same complete report that
  is persisted.
  The bounded review initially found one high mutable-validator boundary and
  two medium resource/rejection-handling defects. Freezing before validation,
  reading intrinsic typed-array length before copying, consuming rejected
  Promise results, and exact regressions closed all three; re-review reports
  0 blocker, 0 high, and 0 medium. The 99-test focus and 1085-test complete
  Node 22 suite pass. Matrix counts remain 0/22/3/35 and
  `supportClaimsEnabled` remains false.
- **D-039 accepted:** the alpha package boundary is the smallest graph that can
  execute the existing product spine without copying implementations:
  `CLI -> core`, `CLI -> native-card-arrow -> core`, and
  `CLI -> public-synthetic`. Package-owned resource descriptors replace the
  false assumption that one repository root is an installation root. Exact
  package import aliases preserve current source locations and prevent cross-
  package relative imports. The plan positively maps every staged file and
  rejects forbidden implementations, undeclared edges, unmapped exports/types,
  duplicate targets, non-executable bin input, premature repository metadata,
  and name drift. M3-003 alone may materialize and pack the fixed ignored stage;
  D-039 is not tarball, clean-install, public-remote, or release evidence.
- **D-040 accepted:** package acceptance is a direct relation between the
  readable D-039 plan, exact retained control/source bytes, generated private
  manifest bytes, canonical tgz members, and the installed result. npm runs
  offline with scripts/config/network effects disabled and supplies only a
  cross-check report; an independent narrow gzip/ustar parser decides member
  admission. One atomic live claim prevents concurrent stage use; work is
  recoverable when the claim PID is confirmed dead, and `previous` remains
  authoritative until a post-rename review creates a full-evidence `reviewed`
  completion marker. Tarballs are reread against retained bytes through
  installation and publication. The authenticated retained reviewed inventory is only that
  marker, canonical evidence, and four tgz files. Their
  SHA-256 values identify only the final reviewed tgz objects in ignored
  evidence; there is no member-hash graph or new planning/delivery root.
  Current manifests remain npm-private while D-045 adds exact repository
  metadata; QA remains blocked. D-045 later completed the required full package
  rerun and final local digest binding. Foreign live-PID reuse and a dead Worker under a
  still-live host are accepted fail-closed availability residuals; no TTL may
  steal a real writer. Under an owner-verified stage only unknown directories
  proven empty may be removed to tolerate observed FileProvider conflict debris;
  unknown files, links, and nonempty entries remain failures. Directory names
  do not authorize deletion: only marker-authenticated exact reviewed members
  are unlinked, with the completion marker last, and `failed` is a persistent
  rename-only quarantine. Materialized/install/smoke trees use exact typed
  inventories; npm cache/config/tmp remain ignored non-authoritative state and
  are never promoted or recursively cleared.
- **D-041 accepted:** M3-004 is split at the real evidence boundary. M3-004A
  owns two exact local workflow definitions, fixed hosted-runner labels,
  least-privilege permissions, complete action SHAs, exact package-script
  bodies, one locked TypeScript 6.0.2 declaration consumer, stable-source syntax
  checks, mechanical MIT/provenance relations, and a plan-derived four-package
  CycloneDX static-ESM SBOM projection. TypeScript is dev-only and does not enter the alpha
  runtime graph. The workflow checker enumerates the real directory and rejects
  indirection, extra workflows, floating actions/runners, dangerous triggers,
  secrets, cache/artifact/publication paths, and no-op gate substitution.
  M3-004B owns and now records the public six-cell plus CodeQL/Dependency
  Review evidence. Accepted PR head
  `f6ba6bad48c928d31c356d47911dd929ccf3b2d1` passed CI run `31600528716`
  in all six cells and Dependency Review in security run `31600528742`; PR
  CodeQL was skipped by event design. Accepted main
  `c4dee58a8920a8e71c20f53ab93c62a96d3cb89d` passed CI run `31600806512`
  in all six cells and CodeQL in security run `31600806350`; push Dependency
  Review was skipped by event design. Both commits share tree
  `4e70ec4323807824b0578241fe4a4d94951cd608` with no tree diff. This closes
  M3-004B but does not promote support or release. All platforms flush
  owned regular files before logical commit markers; POSIX additionally
  requests parent-directory fsync barriers, while Windows makes no sudden-
  power-loss directory-entry persistence claim. A managed FileProvider created
  nonempty conflict entries during local package testing; the product correctly
  stopped and preserved the complete stage, so reproducible local matrix runs
  use one fixed non-FileProvider working copy rather than weakening deletion
  authority.
- **D-042 accepted:** the private-reporting process and the remote setting are
  different facts. `SECURITY.md` owns reporting instructions; GitHub owns the
  channel state; M3-006 owns the transition. The first alpha publishes no
  security email or fallback private channel. D-045 later created the selected
  repository empty and public, enabled private vulnerability reporting through
  the repository REST endpoint, required a subsequent exact `enabled: true`
  status, and bound GitHub's canonical repository identity into the package
  plan, leaf manifests, and SBOM. M3-006 has since completed the repository-
  bound package gate, final history scan, canonical transport, and exact first
  source ref. A failed create, enable, verification, metadata, or
  package-gate step leaves the public shell without source and grants no
  publication evidence. M3-005A mechanically binds the four human process
  documents and the canonical workflow command projection. M3-004B later
  supplied the hosted evidence, and M3-005B then completed the D-046 reader-
  document boundary without authorizing publication. This GitHub-only alpha channel does not promise a
  mirror, email fallback, response SLA, support status, CVE, or release date.
- **D-043 accepted:** current-tree cleanliness does not prove first-push
  cleanliness. A file committed and later deleted, a commit message, or Git
  identity metadata remains reachable from `main` and becomes public with that
  ref. The existing forbidden-material CLI therefore gains one bounded
  `history` mode instead of a second scanner or hash ledger. It fixes local
  `refs/heads/main`, reads the policy from that tip, walks raw commit parent/tree
  OIDs, scans unique historical tree-entry versions plus every commit message,
  and separately requires every
  author/committer to equal the single repository-local public identity without
  emitting the identity value. Shallow/overridden object graphs, unsupported
  commit metadata, forbidden historical modes/content, resource overflow,
  identity drift, and a moving tip fail closed. The D-043 preflight's 13 commits, 286
  leaf-entry versions, 3,677,606 regular-blob bytes, and 26 identity occurrences
  passed the preflight with zero finding. After the public CLI entry moved to
  the package root, policy schema v2 retained one tip-owned authority: current
  modes recognize only the new path, while non-tip history may recognize the
  retired executable only by exact old path plus blob OID and still applies all
  content/type/history checks.
  This does not
  authorize a history rewrite or source ref. D-044/D-045 later confirmed the
  exact owner/repository and existing public identity. M3-006 later scanned the
  final 14-commit history with 505 leaf versions, 7,698,368 regular-blob bytes,
  and 28 identity occurrences at zero finding, then used canonical HTTPS
  transport and verified exact remote-main equality. No tags, wildcard, mirror,
  force, or implicit reconciliation was used.
- **D-044 accepted:** the user selected `why7682/pptx-compiler` as the exact
  first public repository. The active product identity is one atomic stem:
  `pptx-compiler` for the CLI, `pptx-compiler-*` for the other three alpha
  packages, `#pptx-compiler/*` for workspace/package aliases, and
  `urn:pptx-compiler:*` for the unpublished serialized contract namespace.
  There is no old-name compatibility alias because at D-044 acceptance no
  public ref, npm package, or external userspace existed. The local workspace folder is not public
  identity and remains unchanged. The existing ignored stage owner, package
  plan ID, and `.pptx-pipeline-*` transaction prefixes remain stable so a crash
  scene created before the rename is not reclassified as foreign. D-001 and
  D-012 remain dated history; the existing 13 commits are not rewritten.
  On 2026-08-11 the selected GitHub target did not exist, an exact GitHub name
  search returned no `pptx-compiler` repository, and the official npm registry
  returned E404 for all four selected package names. Those checks reserve
  nothing. The rename is accepted only after regenerated contracts/SBOM,
  dual-runtime tests, package build/install smoke, and an independent review.
  At that checkpoint repository-bound metadata still waited for the empty-
  remote/PVR transition; D-045 and M3-006 later completed it and the exact first
  source ref.
- **D-045 accepted:** M3-006 created only the empty public GitHub shell and
  verified its private-reporting setting before any source ref. GitHub reports
  repository ID `1330979133`, owner `why7682`, name `pptx-compiler`, canonical
  HTML URL `https://github.com/why7682/pptx-compiler`, public visibility, and an
  empty refs state; the enable request returned HTTP 204 and the subsequent
  status read returned exact `enabled: true`. Package-plan schema v2 is the one
  readable repository authority. Leaf `repository` fields and the root SBOM VCS
  reference are pure projections; PVR state is not copied into either.
  Authorization for a GitHub source ref is not npm authorization, so every leaf
  stays `private: true`, `publishConfig` remains absent, and the plan retains
  `blocked: npm-publication-not-authorized`. Package evidence and its completion
  marker use schema v2 and bind the SHA-256 of the canonical readable plan, so
  a pre-binding tarball cannot be recovered as evidence for a changed plan with
  the same plan ID/version/file shape. The previously reviewed set must be
  authenticated under its own code and moved intact before the fixed stage is
  reused. The repository-bound dual-runtime rebuild passed, and M3-006 later
  completed the final history scan and exact-object-ID push. npm publication
  remains separately unauthorized.
- **D-046 accepted on 2026-08-12:** final reader-facing documentation must be constructive,
  not an accumulation of TODO fragments or repair chronology. Its stable order
  is: purpose and explicit boundary; core concepts and one readable owner for
  each fact; data and control flow; executable contracts and commands; public
  evidence; limitations; then the next authorized action. Historical failures,
  superseded decisions, run-by-run diagnostics, and provenance relations stay
  available in handoffs, this decision register, and the provenance ledger,
  but they do not lead or fragment the final explanation. M3-005B owns the
  final cross-document review and may not close on sentence-level cleanup alone.
- **D-047 deferred on 2026-08-12:** the user explicitly postponed main-branch
  protection. No protection rule is configured or claimed by this decision.
  M3-005B has since completed, but that fact does not automatically resume the
  deferred work. Revisit force-push/deletion restrictions and required status
  checks only after the user explicitly reauthorizes D-047/M3-008.

## MIT versus Apache-2.0 review

Both are OSI-approved permissive licenses: they allow commercial use,
modification, distribution, and sublicensing without requiring derivative
source code to be published. Their important differences are:

| Topic | MIT | Apache-2.0 |
| --- | --- | --- |
| Main redistribution duty | Retain the copyright and permission notice in copies or substantial portions. | Include the license, mark modified files, retain applicable notices, and propagate relevant `NOTICE` attribution when one exists. |
| Patent language | Contains no explicit patent-license section. This is not a statement that all patent questions are resolved against the user. | Each contributor expressly grants a limited license to patent claims necessarily infringed by the contribution/work combination. |
| Patent litigation | No express patent-retaliation clause. | The patent license for the work terminates for a party that brings the specified patent infringement litigation. |
| Contributions | No detailed contribution-submission rule. | Intentional contributions are Apache-2.0 by default unless explicitly stated otherwise or covered by a separate agreement. |
| Trademarks | No detailed trademark provision. | Expressly withholds trademark rights except customary origin/NOTICE use. |
| Operational cost | Very short and easy to preserve. | More compliance bookkeeping, especially modification notices and third-party `NOTICE` content. |

Apache-2.0 would provide more explicit patent and contribution rules. The user
selected MIT to minimize downstream compliance obligations and declared that
no employer, university, collaborator, or other copyright holder applies to the
new clean-room project. That declaration does not cover third-party dependencies
or files considered for later migration. This project record is not legal
advice.

Authoritative texts:

- MIT: <https://opensource.org/license/mit>
- Apache License 2.0: <https://www.apache.org/licenses/LICENSE-2.0.html>
