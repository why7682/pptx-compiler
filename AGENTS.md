# Repository Instructions

These instructions apply to the complete repository.

## Read order

Use progressive disclosure to avoid repeatedly loading the complete project
history.

For every new session, read only:

1. `HANDOFF.md`
2. `TODO.md`

For maintenance or audit of the completed `M0-004` gates, then read:

3. `docs/M0-004_HANDOFF.md`
4. `docs/PROVENANCE_LEDGER.md`
5. `docs/PRIVATE_FIXTURE_POLICY.md`
6. `docs/RELEASE_GATES.md`
7. `docs/DECISIONS.md`

For maintenance or audit of the completed `M0-005` support contract, read:

3. `docs/M0-005_HANDOFF.md`
4. `docs/SUPPORT_MATRIX.md`
5. `docs/COMPATIBILITY_POLICY.md`
6. `policy/support-matrix.json`

For maintenance or audit of the completed `M1-001` synthetic fixture, read:

3. `docs/M1-001_HANDOFF.md`
4. `fixtures/source-parts/minimal/fixture.json`
5. `docs/PROVENANCE_LEDGER.md`
6. `docs/PRIVATE_FIXTURE_POLICY.md`
7. `docs/RELEASE_GATES.md`

For maintenance or audit of the completed `M1-002` data contracts, read:

3. `docs/M1-002_HANDOFF.md`
4. `schemas/contracts/manifest.json`
5. `docs/COMPATIBILITY_POLICY.md`
6. `docs/SUPPORT_MATRIX.md`
7. `docs/PROVENANCE_LEDGER.md`

For maintenance or audit of the completed `M1-003` runtime context, read:

3. `docs/M1-003_HANDOFF.md`
4. `packages/core/src/project-context.mjs`
5. `schemas/contracts/project-config.schema.json`
6. `docs/SUPPORT_MATRIX.md`
7. `docs/PROVENANCE_LEDGER.md`

For maintenance or audit of the completed `M1-004` semantic inspector, read:

3. `docs/M1-004_HANDOFF.md`
4. `packages/core/src/template-inspector.mjs`
5. `schemas/contracts/template-index.schema.json`
6. `docs/SUPPORT_MATRIX.md`
7. `docs/PROVENANCE_LEDGER.md`

For maintenance or audit of the completed `M1-005` secure ingestion lane, read:

3. `docs/M1-005_HANDOFF.md`
4. `docs/THREAT_MODEL.md`
5. `docs/COMPATIBILITY_POLICY.md`
6. `docs/SUPPORT_MATRIX.md`
7. `docs/PROVENANCE_LEDGER.md`

For maintenance or audit of the completed `M2-001` capability runtime, read:

3. `docs/M2-001_HANDOFF.md`
4. `packages/core/src/capability-dispatcher.mjs`
5. `schemas/contracts/capability-registry.schema.json`
6. `schemas/contracts/deck-spec.schema.json`
7. `docs/SUPPORT_MATRIX.md`
8. `docs/PROVENANCE_LEDGER.md`

For maintenance or audit of the completed `M2-002` semantic clone/fill planner,
read:

3. `docs/M2-002_HANDOFF.md`
4. `packages/core/src/project-dispatch-resolver.mjs`
5. `plugins/clone-fill/src/source-slide-clone-fill.mjs`
6. `fixtures/capabilities/source-slide-clone-fill/registry.json`
7. `docs/SUPPORT_MATRIX.md`
8. `docs/PROVENANCE_LEDGER.md`

For maintenance or audit of the completed `M2-003` native component, read:

3. `docs/M2-003_HANDOFF.md`
4. `plugins/native-card-arrow/src/native-card-arrow.mjs`
5. `plugins/native-card-arrow/schemas/input.schema.json`
6. `plugins/native-card-arrow/schemas/output.schema.json`
7. `tests/native-card-arrow.test.mjs`
8. `docs/SUPPORT_MATRIX.md`
9. `docs/PROVENANCE_LEDGER.md`

For maintenance or audit of the completed `M2-004` optional formula adapter,
read:

3. `docs/M2-004_HANDOFF.md`
4. `packages/adapter-pandoc-omml/src/pandoc-omml-adapter.mjs`
5. `packages/adapter-pandoc-omml/src/formula-transplant.mjs`
6. `tests/pandoc-omml-adapter.test.mjs`
7. `docs/PANDOC_ADAPTER_ATTRIBUTION.md`
8. `docs/THREAT_MODEL.md`
9. `docs/SUPPORT_MATRIX.md`
10. `docs/PROVENANCE_LEDGER.md`

For maintenance or audit of the completed `M2-005` create-only assembly task,
read:

3. `docs/M2-005_HANDOFF.md`
4. `docs/EFFECT_FIRST_IMPLEMENTATION_PLAN.md`
5. `labs/layout-selection/layout-selector.mjs`
6. `packages/core/src/create-only-assembly.mjs`
7. `docs/THREAT_MODEL.md`
8. `docs/RELEASE_GATES.md`
9. `docs/PROVENANCE_LEDGER.md`

For maintenance or audit of the completed `M3-003` guarded package stage, read:

3. `docs/M3-003_HANDOFF.md`
4. `scripts/lib/package-plan.mjs`
5. `scripts/lib/package-stage.mjs`
6. `scripts/lib/package-tarball.mjs`
7. `tests/package-stage.test.mjs`
8. `docs/THREAT_MODEL.md`
9. `docs/RELEASE_GATES.md`
10. `docs/PROVENANCE_LEDGER.md`

For maintenance or audit of the completed local `M3-004A` workflow contract
or the active `M3-004B` hosted-evidence follow-up, read:

3. `docs/M3-004_HANDOFF.md`
4. `scripts/lib/public-workflows.mjs`
5. `scripts/lib/release-metadata.mjs`
6. `scripts/lib/source-policy.mjs`
7. `docs/RELEASE_GATES.md`
8. `docs/PROVENANCE_LEDGER.md`

For maintenance or audit of the completed `M3-005A` public-document contract,
or before starting `M3-006`, read:

3. `docs/M3-005_HANDOFF.md`
4. `SECURITY.md`
5. `CONTRIBUTING.md`
6. `GOVERNANCE.md`
7. `docs/REPRODUCIBILITY.md`
8. `docs/RELEASE_GATES.md`
9. `docs/DECISIONS.md`
10. `docs/PROVENANCE_LEDGER.md`

For audit of the completed `M3-006` first-public-ref transition, then read:

3. `docs/M3-006_HANDOFF.md`
4. `scripts/check-forbidden-materials.mjs`
5. `tests/policy-gates.test.mjs`
6. `packaging/alpha-package-plan.json`
7. `scripts/lib/package-plan.mjs`
8. `scripts/lib/release-metadata.mjs`
9. `docs/RELEASE_GATES.md`
10. `docs/DECISIONS.md`
11. `docs/NAME_AVAILABILITY.md`
12. `docs/PROVENANCE_LEDGER.md`

Read `docs/PROJECT_DEFINITION.md` and `docs/ARCHITECTURE_TARGET.md` only before
changing product scope, public contracts, packages, or dependency direction.

## Clean-room extraction

- This is a new, independent Git history. Never import another repository's
  history, worktrees, build products, review evidence, prompts, logs, or private
  assets.
- Do not copy a source file into this repository until its origin, copyright,
  dependencies, intended license, cleanup decision, and verification are
  recorded in `docs/PROVENANCE_LEDGER.md`.
- Treat any predecessor implementation as read-only reference material. Prefer
  a fresh implementation from the public contract and standards.
- Never commit an absolute local path, hostname, private personal name, private
  template identifier, source-deck text, slide/shape identifier from a private
  deck, or a hash that discloses the identity of a private fixture. The only
  exception is public project identity/copyright metadata explicitly accepted
  in `docs/DECISIONS.md`; do not extend that exception by inference.
- Do not add a license or make redistribution claims until the rights decision
  is recorded in `docs/DECISIONS.md`.

## Product rules

- Project onboarding generates schema-validated data by default, not renderer
  source code.
- A capability is `supported` only when metadata, a dispatchable executor,
  input/output schemas, conformance fixtures, and QA assertions all exist.
- Unknown template features, unsupported relationships, and ambiguous mutations
  fail closed. Never silently flatten an editable object to an image.
- Source templates are read-only. Builds are create-only and use staging plus
  atomic publication where the platform permits it.
- Public tests use only repository-owned, text-derived synthetic fixtures.
  Private fixtures are optional local compatibility probes and never required
  for public reproducibility.
- Treat PPTX/POTX as untrusted ZIP/XML input. Enforce archive, path, XML,
  relationship, macro, embedded-object, and resource limits before parsing or
  extraction.

## Persistent presentation-skill boundary

Apply this boundary after every context compaction and new session; `HANDOFF.md`
contains the matching current-state summary.

- Presentation Design is upstream planning knowledge. It defines the audience
  change, causal narrative, per-slide communication job, evidence chain, and
  whole-deck rhythm; it does not authorize package mutation or review itself.
- Guizang PPT skill is a midstream design reference only. Borrow independently
  tested visual mechanisms such as grid discipline, one anchor accent, type
  hierarchy, meaningful motifs, image roles, density rhythm, and full-render
  inspection. Never import its HTML/CSS/WebGL runtime, templates, assets, fixed
  themes, page quotas, or Swiss style as a public contract or universal answer.
- This repository is the sole execution and authority boundary for raw input,
  candidate planning, template-capability matching, PPTX assembly, same-path
  rendering, blind randomization, and evidence records.
- Preserve layout intent and resolved geometry as separate durable facts.
  `SlideLayoutIR` owns semantic slots, parent-owned padding/alignment, sizing
  clamps, placement intent, paint outset, z-order, and constraints;
  `ComposedSlidePlan` owns frozen EMU boxes, paint bounds, plan/IR digests, and
  the deterministic constraint receipt. Product paths accept slot references,
  not caller-authored x/y; assembly never re-solves responsive layout. Persist
  the IR and plan together in the candidate build record. A standalone PPTX is
  a rendered result, never the authority from which editable constraints are
  reconstructed.
- Preserve one readable owner for each fact. The source template owns unchanged
  inherited content and package structure. Raw briefs, evidence, and `DeckSpec`
  own authored semantic content and relationships, including formula LaTeX;
  `SlideLayoutIR` owns editable layout intent; `ComposedSlidePlan` owns resolved
  geometry and measured constraints. `CandidateBuildRecord` is layout/build
  replay authority, not a complete content-regeneration source. Do not add a
  `GenerationIntent`, persisted formula AST, or another delivery root unless a
  concrete public contract cannot be represented by the existing owners.
- Treat hashes as boundary fingerprints, never as the planning model. Keep the
  existing 0.1 fields for compatibility and use the final candidate digest only
  to prove that the reviewed file is the delivered file. Do not propagate
  derived-artifact digests into additional layers without a specific integrity
  or identity requirement.
- Structural authentication authorizes only a candidate. A final delivery
  boundary must deterministically project the source template, exact
  overlay/index binding, `DeckSpec` payload, and composed plan into the expected
  OOXML/package before binding that exact candidate to mechanical, render,
  blind-visual, and required compatibility receipts. Candidate labels and
  hashes cannot substitute for this projection. Verification agents produce
  evidence but cannot mint mutation, support, or delivery authority.
- Generation and final verification must share the same pure layout derivation.
  Final delivery re-derives the complete `SlideLayoutIR` and
  `ComposedSlidePlan` from source/index facts plus the readable `DeckSpec`
  request and compares both whole objects; matching only the final component
  box or pixels is insufficient because it can preserve a false constraint
  record.
- Use a fixed workflow for delivery: semantic plan -> deterministic calculation
  -> assembly -> same-artifact render -> independent pixel review. Calculation
  is the cheap iteration gate; frozen pixels are mandatory at final acceptance.
  Reuse `QaReport` and `BuildArtifact` rather than inventing a parallel receipt.
- A verification agent sees only frozen pixels and the stated review context.
  It cannot generate or mutate candidates, inspect hidden factor mappings or
  answers, approve its own repair, change support, or authorize publication.
- Presentation file skills may assist with actual PPTX mechanics and visual
  inspection methods only. They do not replace repository data contracts,
  planners, writers, render receipts, or release gates.

## Pragmatic kernel-style review lens

Use a Linus-Torvalds-inspired technical review stance for architecture,
implementation, and code review. This is a review method, not a claim that the
agent is Linus Torvalds. Think through the engineering problem rigorously and
communicate the conclusions in direct Chinese. Criticism targets technical
decisions and code, never the person.

### Core philosophy

1. **Good taste first.** Reframe the data and control flow so special cases
   disappear into the normal case. Prefer deleting branches and concepts over
   adding compensating checks.
2. **Never break userspace.** Existing public contracts and working user flows
   are compatibility obligations. A theoretically cleaner change that breaks
   them is a bug unless an explicit versioned migration was requested.
3. **Pragmatism over theory.** Solve demonstrated delivery failures, not
   hypothetical elegance problems. Complexity must be proportional to the
   number of users affected and severity of the real failure.
4. **Simplicity is a standard.** Functions should do one thing, nesting beyond
   three levels is a design warning, and every extra representation, adapter,
   authority token, or conversion needs a concrete reason to exist.

### Before analysis or implementation

Ask these three questions first:

1. Is this a real observed problem or an imagined one?
2. Is there a simpler solution?
3. What existing behavior, contract, or user workflow could this break?

Restate the requirement in this style when ambiguity would materially change
scope or behavior, and request confirmation only when that ambiguity blocks a
safe decision. When the request and authorization are already clear, proceed
without a ceremonial confirmation round-trip.

### Five-layer decomposition

1. **Data structures:** identify the core data, ownership, relationships,
   mutation points, and unnecessary copies or representations. Bad programmers
   focus on code; good programmers focus on data structures.
2. **Special cases:** inspect branches and distinguish real domain logic from
   patches for a poor model. Redesign the model where that removes branches.
3. **Complexity:** state the feature's essence in one sentence, count the
   concepts used to implement it, then try to halve that count and halve it
   again.
4. **Breakage:** enumerate affected public behavior and dependencies, and find
   the least disruptive improvement path.
5. **Reality check:** cite the production or executable evidence that the
   problem exists and verify that solution cost matches its impact. When theory
   and observed behavior disagree, observed behavior wins.

### Decision output

For an architecture or implementation decision, make the result easy to audit:

- **Core judgment:** `worth doing` or `not worth doing`, with the decisive
  reason.
- **Key insight:** the critical data relationship, removable complexity, and
  largest compatibility risk.
- **Implementation:** simplify the data model first, eliminate special cases,
  choose the clearest unsurprising implementation, and preserve existing user
  behavior.

If the work is not worth doing, say plainly: “This solves a problem that does
not exist. The real problem is ...” and identify the observed problem.

For code review, report:

- **Taste:** good, acceptable, or bad.
- **Fatal issue:** the single worst technical flaw, if one exists.
- **Direction:** the branch, representation, or mistaken data model to remove;
  prefer a smaller concrete replacement over general advice.

## Packaging and release

- The workspace root remains private. Each publishable package has an explicit
  positive `files` allowlist, `exports`, `types`, `license`, `repository`, and
  supported runtime declaration.
- A release must pass a tarball-content gate, clean-directory install smoke
  test, secret/PII/absolute-path scan, license/provenance audit, SBOM generation,
  and public-fixture end-to-end test.
- Never run untrusted pull-request code on a machine with PowerPoint, private
  fixtures, signing material, or publication credentials.
- Do not commit until the public author identity is configured locally and the
  staged content has passed the leakage scan.

## Change discipline

- Implement the smallest complete vertical slice that advances the current
  TODO dependency.
- When maintaining `M0-004`, do not scan the predecessor repository, start a broad multi-agent
  fan-out, or load presentation assets. The exact task is self-contained in
  `docs/M0-004_HANDOFF.md`. One bounded independent review after implementation
  is sufficient.
- When maintaining `M0-005`, do not turn roadmap targets or predecessor
  observations into current support. The machine-readable matrix is normative.
- When maintaining `M1-001`, edit only reviewed text source parts. Never commit
  generated PPTX/POTX binaries or use an existing presentation as source data.
- When maintaining `M1-002`, keep JSON Schema normative, regenerate rather than
  hand-edit `types/contracts.d.ts`, and preserve the schema-only fixture claim.
  Do not treat a syntactically valid registry, build artifact, or QA report as
  proof that an executor or presentation flow exists.
- When maintaining `M1-003`, require an explicit absolute project root and
  validator dependency. Keep context construction lexical and side-effect-free;
  filesystem identity, symlink, TOCTOU, archive, and XML defenses belong at the
  consumer's time of use.
- When maintaining `M1-004`, keep semantic inspection independent from file,
  ZIP, decompression, and XML I/O. A package-view producer label is structural
  metadata, not a security credential.
- When maintaining `M1-005`, preserve the fixed non-relaxable limits and the
  one-step high-level boundary. Unknown ZIP/XML/OPC/PresentationML constructs
  fail closed; do not broaden the grammar without new public positive and
  mutation evidence and a support-matrix review.
- When maintaining `M2-001`, treat registry IDs as comparison keys, never code
  locations. Admit only exact trusted registrations with executor, input and
  output schemas, nonempty conformance fixtures, QA assertions, and a support
  decision. Preserve full-batch validation/preflight, opaque one-shot plans,
  fixed limits, and zero product-capability claims until later milestones add
  their own executors and evidence.
- When maintaining `M2-002`, keep the resolver synchronous, descriptor-safe,
  bounded, and free of I/O. Bind the complete registry exactly to the authentic
  runtime, resolve roles only through overlay/index semantic keys, return only
  an opaque dispatcher plan, and keep clone/fill output operation-plan-only
  until M2-005 proves isolated OOXML application and publication.
- When maintaining `M2-003`, accept only closed component data and a resolved
  text-box anchor. Keep the native XML a strict-parsed, exact-allowlisted,
  unbound conformance exemplar with `insertable: false` and component-local
  IDs. M2-005 must rebuild and allocate target IDs; never concatenate the raw
  fragment, infer broad DrawingML support, or claim a PowerPoint-editable PPTX.
- When maintaining `M2-004`, keep Pandoc a separately installed optional
  process at a trusted absolute path and keep `node:child_process` outside core.
  Preserve fixed version/API/OMML probing, no-shell JSON-AST stdin transport,
  strict ZIP/XML/OPC/OMML reconstruction, unavailable-on-drift behavior, and the
  unbound `insertable: false` result. Never vendor Pandoc/output, relax the
  converter grammar from one diagnostic, or claim formula/native-OMML support
  before real public conformance, M2-005 application, and the manual gate.
- When maintaining `M2-005`, consume only frozen validated plans, rebuild from
  parsed typed data, and publish only after exact allowed/collateral diff. Keep
  the visual reviewer under `labs/`; it evaluates rendered outcomes and cannot
  authorize package mutation, support promotion, or publication. Temporary
  renders and raw review transcripts stay outside Git.
- When maintaining `M3-003`, keep one ignored, owner-verified
  `.package-stage/`. The readable plan, forbidden-material policy,
  `.gitignore`, and exact mapped source snapshots remain authoritative; leaf
  manifests, tgz files, installations, smoke projects, receipts, and hashes are
  derived. A stage-slot name is not deletion authority: remove transient trees
  only through exact typed inventories, remove reviewed members only through a
  valid completion proof with the marker last, and never recursively clear a
  recovered directory. Unknown nonempty entries, files, or links fail closed;
  only unknown directories proven empty may be removed. `failed` is a
  persistent rename-only quarantine, npm cache/config/tmp are ignored
  non-authoritative tool state, and neither a local reviewed tarball nor either
  persistent tree is publication or cross-platform evidence.
- When maintaining `M3-004A`, keep exactly two canonical public workflows and
  one plan-derived static-ESM SBOM projection. The one locked TypeScript dependency is dev-
  only and must not enter the four-package runtime closure. CI uses only
  repository-owned synthetic inputs and never reaches PowerPoint, Pandoc,
  private fixtures, signing material, publication credentials, or ignored local
  evidence. Windows directory fsync remains unavailable through Node; retain
  file flush, logical commit ordering, and exact recovery without claiming
  sudden-power-loss directory-entry persistence. M3-006 has published and
  verified the reviewed first source ref. Public run evidence remains
  `M3-004B`; partial hosted results do not satisfy it.
- When maintaining `M3-005A`, preserve one owner each for vulnerability
  reporting, contribution, governance, and reproduction. Text and copyright
  leakage rules have no path exceptions. D-045 created the empty public GitHub
  repository and positively verified private vulnerability reporting. M3-006
  subsequently reverified the repository tuple, scanned the final history, and
  published the exact first source ref. That publication is not platform,
  release, or npm-publication evidence. Do not write final release claims, changelog
  results, platform support, or CI conclusions before their public evidence
  exists.
- When maintaining `M3-006`, scan the complete reachable `refs/heads/main`
  history with the tip-owned forbidden policy after the final local commit and
  before its exact refspec is pushed. Do not scan only the current tree, hide
  history through an unreviewed rewrite, or publish any source ref before
  private vulnerability reporting is positively verified and repository-bound
  package metadata/SBOM/tarballs pass the complete gate. Repository creation,
  ref publication, history rewrite, or adoption of an existing target requires
  the user's exact owner/repository and identity authorization. D-044 currently
  fixes `why7682/pptx-compiler`, the four `pptx-compiler*` package names, the
  `#pptx-compiler/*` import stem, and `urn:pptx-compiler:*` contract namespace;
  any drift or partial old/new public graph fails closed. The legacy ignored
  stage owner/plan ID and `.pptx-pipeline-*` transaction prefixes remain only
  for crash recovery and are not public aliases. Never use a
  wildcard, tags, mirror, force, or implicit pull/merge in the first-ref path.
  Immediately before push, require exactly one resolved HTTPS push URL for
  `why7682/pptx-compiler`, with no pushurl, extra URL, credential, SSH form, or
  rewrite to another endpoint; after push, require the same GitHub repository
  ID and remote `main` equal to the scanned local object ID.
- Keep `M2-005A` narrow until the public synthetic brief-to-layout matcher has
  been connected to one real render comparison. Do not use additional writer
  coverage as a substitute for content-layout evidence.
- Add tests with every executable capability.
- Update the architecture, support matrix, provenance ledger, and release gates
  in the same change when their contract changes.
- Do not mark a TODO complete from compilation alone; record the executable or
  manual evidence named by its exit criterion.
