# Provenance Ledger

No source file or fixture part may enter the repository without a completed
entry. An entry documents provenance; it does not itself grant rights.

## Entry template

```yaml
path: relative/repository/path
kind: new-clean-room | migrated-and-rewritten | third-party | generated
origin: public standard, upstream URL, or generic predecessor component ID
original_author_or_holder: TBD
created_or_reviewed_on: YYYY-MM-DD
license_or_rights_basis: TBD
third_party_dependencies: []
private_information_review: pending
project_constant_removal: pending
public_fixture_conformance: pending
independent_review: pending
notes: ""
```

## Entries

### Bootstrap planning set

```yaml
paths:
  - .env.example
  - .gitattributes
  - .gitignore
  - AGENTS.md
  - HANDOFF.md
  - README.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M0-004_HANDOFF.md
  - docs/NAME_AVAILABILITY.md
  - docs/OPEN_SOURCE_READINESS.md
  - docs/PRIVATE_FIXTURE_POLICY.md
  - docs/PROJECT_DEFINITION.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/THREAT_MODEL.md
kind: new-clean-room
origin: user-directed clean-room project planning
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-07-30
license_or_rights_basis: MIT; user confirmed copyright ownership
third_party_dependencies: []
private_information_review: passed
project_constant_removal: passed; no implementation or predecessor constants admitted
public_fixture_conformance: not-applicable; no fixture or executable code present
independent_review: scope, legal/security, and packaging audits completed
notes: Planning and policy text only.
```

### MIT license text

```yaml
path: LICENSE
kind: third-party-standard-license-text
origin: https://opensource.org/license/mit
original_author_or_holder: not asserted by this project
created_or_reviewed_on: 2026-07-30
license_or_rights_basis: standard MIT license text with project year and holder inserted
third_party_dependencies: []
private_information_review: passed; contains only approved public copyright metadata
project_constant_removal: not-applicable
public_fixture_conformance: not-applicable
independent_review: compared with the OSI-published MIT text
notes: Do not paraphrase the operative license text.
```

## Machine-readable source

`provenance/records.json` is now the normative per-file source. It contains one
exact, canonical repository-relative record for every admitted file, including
itself. `schemas/provenance-record.schema.json` defines the versioned JSON
Schema Draft 2020-12 contract. `npm run check:provenance` compares the records
with the Git index and rejects missing, duplicate, orphaned, traversing,
unsorted, invalid, or pending entries.

### M0-004 implementation set

```yaml
paths:
  - package.json
  - policy/forbidden-materials.json
  - provenance/records.json
  - schemas/provenance-record.schema.json
  - scripts/check-forbidden-materials.mjs
  - scripts/check-provenance.mjs
  - tests/policy-gates.test.mjs
kind: new-clean-room
origin: bounded M0-004 contract in docs/M0-004_HANDOFF.md
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-07-30
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; synthetic runtime-constructed mutations only
project_constant_removal: passed; no predecessor code or identifier inspected
public_fixture_conformance: applicable; 21 forbidden-material and 10 provenance mutations
independent_review: passed; closing review reported no blocking findings
notes: The machine-readable records contain the exact per-file fields and status.
```

### M0-005 support-contract set

```yaml
paths:
  - docs/COMPATIBILITY_POLICY.md
  - docs/M0-005_HANDOFF.md
  - docs/SUPPORT_MATRIX.md
  - policy/support-matrix.json
  - schemas/support-matrix.schema.json
  - scripts/check-support-matrix.mjs
  - tests/support-matrix.test.mjs
kind: new-clean-room
origin: repository public contracts and bounded M0-005 implementation contract
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-07-31
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; public generic feature classes only
project_constant_removal: passed; no predecessor code, identifier, or asset inspected
public_fixture_conformance: applicable; 60 matrix rows and 13 rejection mutations
independent_review: not-applicable; no independent review required for this policy slice
notes: The machine-readable records contain exact per-file admission fields.
```

### M1-001 synthetic-fixture set

```yaml
paths:
  - docs/M1-001_HANDOFF.md
  - fixtures/source-parts/minimal/fixture.json
  - fixtures/source-parts/minimal/parts/[Content_Types].xml
  - fixtures/source-parts/minimal/parts/_rels/.rels
  - fixtures/source-parts/minimal/parts/ppt/_rels/presentation.xml.rels
  - fixtures/source-parts/minimal/parts/ppt/presProps.xml
  - fixtures/source-parts/minimal/parts/ppt/presentation.xml
  - fixtures/source-parts/minimal/parts/ppt/slideLayouts/_rels/slideLayout1.xml.rels
  - fixtures/source-parts/minimal/parts/ppt/slideLayouts/slideLayout1.xml
  - fixtures/source-parts/minimal/parts/ppt/slideMasters/_rels/slideMaster1.xml.rels
  - fixtures/source-parts/minimal/parts/ppt/slideMasters/slideMaster1.xml
  - fixtures/source-parts/minimal/parts/ppt/slides/_rels/slide1.xml.rels
  - fixtures/source-parts/minimal/parts/ppt/slides/slide1.xml
  - fixtures/source-parts/minimal/parts/ppt/theme/theme1.xml
  - scripts/generate-synthetic-fixtures.mjs
  - tests/synthetic-fixture.test.mjs
kind: new-clean-room
origin: independently authored from the M1-001 contract, ECMA-376, and public
  Microsoft PresentationML structure documentation; no example source copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-07-31
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; generic synthetic text and public format identifiers only
project_constant_removal: passed; no predecessor code, asset, identifier, or private path inspected
public_fixture_conformance: applicable; deterministic PPTX/POTX generation and failure mutations
independent_review: passed; bounded review closed after four validation classes were fixed and regression-tested
notes: Generated archives remain ignored and are not provenance inputs or tracked artifacts.
```

### M1-002 versioned data-contract set

```yaml
paths:
  - docs/M1-002_HANDOFF.md
  - fixtures/contracts/README.md
  - fixtures/contracts/valid/build-artifact.json
  - fixtures/contracts/valid/capability-registry.json
  - fixtures/contracts/valid/deck-spec.json
  - fixtures/contracts/valid/project-config.json
  - fixtures/contracts/valid/project-overlay.json
  - fixtures/contracts/valid/qa-report.json
  - fixtures/contracts/valid/template-index.json
  - fixtures/contracts/valid/template-profile.json
  - schemas/contracts/build-artifact.schema.json
  - schemas/contracts/capability-registry.schema.json
  - schemas/contracts/deck-spec.schema.json
  - schemas/contracts/manifest.json
  - schemas/contracts/project-config.schema.json
  - schemas/contracts/project-overlay.schema.json
  - schemas/contracts/qa-report.schema.json
  - schemas/contracts/shared.schema.json
  - schemas/contracts/template-index.schema.json
  - schemas/contracts/template-profile.schema.json
  - scripts/check-contracts.mjs
  - scripts/lib/json-schema.mjs
  - tests/contracts.test.mjs
  - types/contracts.d.ts
kind: new-clean-room; types/contracts.d.ts is generated
origin: independently authored from the M1-002 repository contract and JSON
  Schema Draft 2020-12; no predecessor implementation or example was inspected
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-07-31
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; generic synthetic identifiers, fake digests,
  placeholder URNs, and repository-relative paths only
project_constant_removal: passed; no predecessor code, asset, identifier, private
  fixture metadata, or private path was admitted
public_fixture_conformance: applicable; eight schema-conformance-only documents,
  deterministic generated declarations, and 68 focused contract rejection mutations
independent_review: passed; bounded closing review findings were fixed and
  regression-tested
notes: The fixture bundle and placeholder executor/QA references are not runtime,
  build, QA, or support evidence. The machine-readable records contain exact
  per-file admission fields.
```

### M1-003 ProjectContext set

```yaml
paths:
  - docs/M1-003_HANDOFF.md
  - packages/core/src/project-context.mjs
  - tests/project-context.test.mjs
kind: new-clean-room
origin: independently authored from the M1-003 TODO exit criterion and the
  normative ProjectConfig 0.1.0 contract; no predecessor implementation was
  inspected
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-01
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; runtime-created synthetic absolute roots
  and canonical repository-relative contract paths only
project_constant_removal: passed; no predecessor code, asset, identifier,
  private fixture metadata, or ambient root was admitted
public_fixture_conformance: applicable; 79 context test nodes with 60 focused
  path/dependency rejection mutations
independent_review: passed; one case-only input-document alias finding was fixed
  across all 10 role pairs and the closing review reported no remaining blocker
notes: This slice performs no filesystem or presentation I/O and is not secure
  ingestion, inspector, capability, render, QA, or support evidence.
```

### M1-004 semantic template-inspector set

```yaml
paths:
  - docs/M1-004_HANDOFF.md
  - fixtures/inspection/expected-potx-template-index.json
  - packages/core/src/template-inspector.mjs
  - scripts/generate-synthetic-fixtures.mjs
  - scripts/inspect-synthetic-fixture.mjs
  - tests/template-inspector.test.mjs
kind: new-clean-room; the expected index is a deterministic generated golden
origin: independently authored from the M1-004 exit criterion, the normative
  TemplateIndex 0.1.0 contract, and the reviewed repository-owned text fixture;
  no predecessor implementation, private fixture, or presentation binary was
  inspected
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-01
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; the golden contains only normalized public
  technical facts and no names, slide text, local paths, or private identifiers
project_constant_removal: passed; core contains no fixture constants, managed
  helper, ambient root, filesystem, archive, or XML dependency
public_fixture_conformance: applicable; 119 inspector test nodes cover exact
  PPTX/POTX output, deterministic redaction, bounded views, graph mutations,
  reviewed OOXML vocabulary drift, and clean-directory module closure
independent_review: passed; three findings covering unmodeled OOXML, unbounded
  caller-view copying, and slide-size field loss were fixed and independently
  rechecked with no remaining blocker
notes: This slice accepts only an already parsed reviewed-fixture package view.
  It is not secure PPTX/POTX ingestion, arbitrary-template support, or npm
  clean-install evidence.
```

### M1-005 secure-ingestion set

```yaml
paths:
  - AGENTS.md
  - HANDOFF.md
  - README.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/COMPATIBILITY_POLICY.md
  - docs/DECISIONS.md
  - docs/M1-005_HANDOFF.md
  - docs/OPEN_SOURCE_READINESS.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - packages/core/src/ooxml-package-view.mjs
  - packages/core/src/secure-template-ingestion.mjs
  - packages/core/src/secure-zip.mjs
  - packages/core/src/strict-xml.mjs
  - packages/core/src/template-inspector.mjs
  - policy/support-matrix.json
  - tests/secure-template-ingestion.test.mjs
  - tests/support-matrix.test.mjs
kind: new-clean-room; existing planning/contracts updated in place
origin: independently authored from the M1-005 TODO exit criterion, existing
  public contracts and text-only fixture, ECMA-376 OPC, PKWARE APPNOTE, and
  documented Node.js filesystem/zlib APIs; no predecessor implementation,
  private fixture, or presentation binary was inspected
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-01
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; errors and output expose only stable codes,
  public pointers, and normalized technical facts; mutations are created only
  at runtime in temporary directories
project_constant_removal: passed; product code contains no fixture ID, private
  path, private text, managed helper, ambient root, or presentation asset
public_fixture_conformance: applicable; exact stored/DEFLATE PPTX/POTX results
  plus filesystem, ZIP, XML, OPC, relationship, vocabulary, resource, and
  high-risk rejection mutations
independent_review: passed; the bounded closing security review confirmed that
  the content-type child fail-open, archive-snapshot/digest binding, and
  adversarial-coverage findings were fixed, with no remaining blocker or high
  finding
notes: No generated archive or mutation corpus binary is tracked. The fixed
  public minimal grammar is a security baseline, not arbitrary-template or
  capability support.
```

### M2-001 capability-runtime set

```yaml
paths:
  - AGENTS.md
  - HANDOFF.md
  - README.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/COMPATIBILITY_POLICY.md
  - docs/DECISIONS.md
  - docs/M2-001_HANDOFF.md
  - docs/OPEN_SOURCE_READINESS.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - fixtures/capabilities/dispatcher-contract-probe/cases.json
  - fixtures/capabilities/dispatcher-contract-probe/input.schema.json
  - fixtures/capabilities/dispatcher-contract-probe/output.schema.json
  - fixtures/capabilities/dispatcher-contract-probe/registry.json
  - fixtures/capabilities/dispatcher-contract-probe/runtime.mjs
  - packages/core/src/capability-dispatcher.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - tests/capability-dispatcher.test.mjs
  - tests/support-matrix.test.mjs
kind: new-clean-room; existing planning/contracts updated in place
origin: independently authored from the M2-001 TODO exit criterion, existing
  public 0.1.0 registry/deck contracts, support policy, release gates, and
  repository-owned synthetic data; no predecessor implementation, private
  fixture, presentation asset, or presentation binary was inspected
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-02
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; core errors expose only stable codes and
  public pointers, while fixtures contain generic data-only probe identities
project_constant_removal: passed; registry URNs are comparison keys and core
  contains no private identifier, ambient loader, filesystem/network/process
  authority, presentation asset, or product-capability implementation
public_fixture_conformance: applicable; 85 dispatcher nodes exercise atomic
  admission, exact artifact binding, support authorization, full-batch
  validation/preflight, one-shot plans, immutable data, redaction, fixed
  limits, output QA, clean-directory closure, and probe isolation
independent_review: passed; the bounded closing review's caller-mutation race,
  late aggregate-budget enforcement, rejected-Promise handling, and stale
  record findings were fixed; code fixes were independently rechecked with no
  remaining blocker or high finding
notes: The dispatcher-contract probe is conformance-only and absent from the
  60-row product support matrix. Complete runtime registration is necessary
  for dispatchability but does not create a support claim; the global switch
  remains false and every product row remains non-supported.
```

### M2-002 semantic-resolution and clone/fill planning set

```yaml
paths:
  - AGENTS.md
  - HANDOFF.md
  - README.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/COMPATIBILITY_POLICY.md
  - docs/DECISIONS.md
  - docs/M2-002_HANDOFF.md
  - docs/OPEN_SOURCE_READINESS.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - fixtures/capabilities/source-slide-clone-fill/cases.json
  - fixtures/capabilities/source-slide-clone-fill/deck-spec.json
  - fixtures/capabilities/source-slide-clone-fill/project-overlay.json
  - fixtures/capabilities/source-slide-clone-fill/registry.json
  - packages/core/src/capability-dispatcher.mjs
  - packages/core/src/project-dispatch-resolver.mjs
  - plugins/clone-fill/schemas/input.schema.json
  - plugins/clone-fill/schemas/output.schema.json
  - plugins/clone-fill/src/source-slide-clone-fill.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - tests/capability-dispatcher.test.mjs
  - tests/source-slide-clone-fill.test.mjs
  - tests/support-matrix.test.mjs
kind: new-clean-room; existing planning, policy, and runtime files updated in place
origin: independently authored from the M2-002 TODO exit criterion, existing
  public 0.1.0 contracts and support policy, and the reviewed repository-owned
  text TemplateIndex; no predecessor implementation, private fixture,
  presentation asset, presentation binary, build output, or prompt/log material
  was inspected or copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-03
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; errors expose stable codes and structural
  pointers, while public fixtures contain only generic semantic IDs and text
project_constant_removal: passed; product source contains no fixture-specific
  slide, shape, source, path, text, or geometry constant and has no ambient
  filesystem, archive, XML, network, process, or dynamic-loader authority
public_fixture_conformance: applicable; 56 clone/fill nodes and a 156-node
  resolver/dispatcher/support focus cover exact registry authentication,
  semantic graph closure, batch atomicity, schemas, four QA assertions, fixed
  limits, safe Unicode, fixture neutrality, no-I/O closure, and unavailable
  product policy; the complete repository suite has 564 nodes
independent_review: passed; the bounded closing review's missing-provenance
  blocker, pre-encoding allocation high finding, Unicode input/output contract
  findings, stale support prose, and astral-scalar coverage suggestion were
  fixed and rechecked with no remaining code blocker or high finding
notes: The executor emits a schema-validated semantic operation plan only. It
  neither mutates OOXML nor proves rendering, editability, source isolation,
  collateral safety, staging, or publication. The global support switch remains
  false and all 60 product rows remain non-supported.
```

### M2-003 native-card-arrow set

```yaml
paths:
  - AGENTS.md
  - HANDOFF.md
  - README.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/COMPATIBILITY_POLICY.md
  - docs/DECISIONS.md
  - docs/M2-003_HANDOFF.md
  - docs/OPEN_SOURCE_READINESS.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - fixtures/capabilities/native-card-arrow/cases.json
  - fixtures/capabilities/native-card-arrow/deck-spec.json
  - fixtures/capabilities/native-card-arrow/project-overlay.json
  - fixtures/capabilities/native-card-arrow/registry.json
  - plugins/native-card-arrow/schemas/input.schema.json
  - plugins/native-card-arrow/schemas/output.schema.json
  - plugins/native-card-arrow/src/native-card-arrow.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - scripts/check-support-matrix.mjs
  - tests/native-card-arrow.test.mjs
  - tests/support-matrix.test.mjs
kind: new-clean-room; existing planning, policy, and gate files updated in place
origin: independently authored from the M2-003 TODO exit criterion, existing
  public runtime/data contracts, repository-owned text fixtures, support policy,
  strict XML boundary, and public ECMA-376 PresentationML/DrawingML structure;
  no predecessor implementation, private fixture, presentation asset, binary,
  build output, prompt, log, or example implementation was inspected or copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-03
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; fixtures contain only generic public
  semantic IDs, synthetic labels, colors, geometry, and public format namespace
  identifiers; output and errors expose no local source path or private content
project_constant_removal: passed; product source contains no fixture slide,
  shape, source, digest, path, text, or geometry constant and has no filesystem,
  archive, network, process, environment, dynamic-loader, or staging authority
public_fixture_conformance: applicable; 57 native-component nodes and a 215-node
  resolver/dispatcher/clone-fill/support focus cover exact artifacts,
  experimental opt-in, atomicity, schemas, strict native vocabulary, safe
  Unicode/XML escaping, geometry/style bounds, local-ID policy, deterministic
  output, drift, fixture neutrality, no-I/O, and clean-directory closure; the
  complete repository suite has 623 nodes
independent_review: passed; the bounded closing review found an overbroad old
  editability exit criterion and an incorrect QA-count statement, both were
  corrected, and final re-review reported no remaining blocker or high finding
notes: The executor emits one unbound, non-insertable native group conformance
  exemplar. It neither applies OOXML nor proves a complete PPTX, PowerPoint
  editability, slide containment, final object IDs, source isolation,
  collateral safety, staging, or publication. The global support switch remains
  false; one narrow capability is experimental and no row is supported.
```

### M2-004 optional Pandoc/OMML adapter set

```yaml
paths:
  - AGENTS.md
  - HANDOFF.md
  - README.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/COMPATIBILITY_POLICY.md
  - docs/DECISIONS.md
  - docs/M2-004_HANDOFF.md
  - docs/OPEN_SOURCE_READINESS.md
  - docs/PANDOC_ADAPTER_ATTRIBUTION.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - fixtures/capabilities/formula-transplant/cases.json
  - fixtures/capabilities/formula-transplant/deck-spec.json
  - fixtures/capabilities/formula-transplant/project-overlay.json
  - fixtures/capabilities/formula-transplant/registry.json
  - packages/adapter-pandoc-omml/schemas/input.schema.json
  - packages/adapter-pandoc-omml/schemas/output.schema.json
  - packages/adapter-pandoc-omml/src/formula-transplant.mjs
  - packages/adapter-pandoc-omml/src/node-process-runner.mjs
  - packages/adapter-pandoc-omml/src/pandoc-omml-adapter.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - tests/pandoc-omml-adapter.test.mjs
  - tests/support-matrix.test.mjs
kind: new-clean-room; existing planning, policy, and gate files updated in place
origin: independently authored from the M2-004 TODO exit criterion, existing
  public runtime/data contracts and repository-owned text fixtures, the fixed
  secure ZIP/strict XML boundaries, public ECMA-376 structures, and official
  Pandoc 3.10.1 documentation/source; no predecessor implementation, private
  fixture, presentation asset/binary, converter output, build output, prompt,
  log, or upstream source file was inspected as implementation material or copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-05
license_or_rights_basis: MIT for repository-authored files; Pandoc remains a
  separately installed GPL-2.0-or-later external tool and is not redistributed
third_party_dependencies: []
private_information_review: passed; fixtures contain only generic semantic IDs,
  a synthetic fraction, and public format namespaces; errors/output exclude
  executable paths, environment, raw stderr, formula source duplication, and
  private presentation data
project_constant_removal: passed; source contains no private fixture identifier,
  presentation asset, ambient project root, dynamic loader, converter output,
  or predecessor constant; executable selection is trusted absolute host config
public_fixture_conformance: applicable; the focused adapter suite covers fixed
  process requests, absence/error behavior, formula isolation, resolver and
  dispatcher integration, secure DOCX/OPC/XML/typed-OMML reconstruction,
  resource/structure mutations, deterministic output, no-I/O direction, and
  clean-directory closure; 115/115 focused, 330/330 strict integration focus,
  and 738/738 full tests pass on Node.js 22.23.1 and 24.14.0
independent_review: passed; the bounded closing review's relationship-profile
  high and content-type medium were fixed with exact mappings and 10 regression
  subtests; bounded re-review found no remaining blocker or high finding
notes: No Pandoc executable/library/template/reference file, generated DOCX,
  presentation binary, or upstream-derived fixture is tracked. The formula
  result is unbound and insertable=false; all formula rows and the global claim
  switch remain unavailable/false pending real compatibility, M2-005, and the
  manual PowerPoint gate.
```

### Presentation design-planning review set

```yaml
paths:
  - AGENTS.md
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/EFFECT_FIRST_IMPLEMENTATION_PLAN.md
  - docs/M2-005_HANDOFF.md
  - docs/PRESENTATION_DESIGN_PLANNING_REVIEW.md
  - docs/PROJECT_DEFINITION.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - provenance/records.json
kind: new-clean-room; existing planning and provenance files updated in place
origin: independently authored from the user's effect-first direction,
  repository-owned M2-005 evidence, official product documentation, fixed
  public source revisions, public research papers, and read-only visual
  inspection of public example decks; no external source text, prompt, code,
  template, asset, presentation, render, build product, or Git history was
  copied into the repository
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-09
license_or_rights_basis: MIT for repository-authored synthesis; linked external
  sources retain their own terms and are reference evidence only
third_party_dependencies: []
private_information_review: passed; the tracked review contains public URLs,
  fixed public identifiers, independently phrased observations, and repository-
  owned plans only; external research notes, sample decks, and renders remain
  outside the repository
project_constant_removal: passed; no predecessor identifier, private template,
  local path, host identity, private slide/shape/text fact, asset, or raw review
  transcript is admitted
public_fixture_conformance: applicable; D-023 formalizes the rendered-effect
  product objective and optional review output while the architecture, release,
  and support documents keep prompt-driven planning/review lab-only,
  non-authorizing, and non-promoting
independent_review: passed; the bounded challenge's one blocker, four high, and
  two medium findings were fixed across the executable planner, blind outcome,
  controlled comparisons, template precedence, non-votable required items,
  evidence pins, and D-023 governance; stable-snapshot closure found no
  remaining blocker, high, or medium issue
notes: The review corrects the fundamental layer from layout selection to an
  executable raw-input-to-deck planning/selection path with blind outcome and
  controlled rendered evidence. Native and OMML application remains paused
  behind that public-synthetic gate.
```

### P1 executable design-planning lab set

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/EFFECT_FIRST_IMPLEMENTATION_PLAN.md
  - docs/M2-005_HANDOFF.md
  - docs/PRESENTATION_DESIGN_PLANNING_REVIEW.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - fixtures/design-planning/evidence-inventory.json
  - fixtures/design-planning/hidden-outcome-key.json
  - fixtures/design-planning/planning-acceptance.json
  - fixtures/design-planning/planning-approval.json
  - fixtures/design-planning/raw-defense-brief.json
  - fixtures/design-planning/template-profile.json
  - labs/design-planning/deck-planner.mjs
  - provenance/records.json
  - tests/design-planning.test.mjs
kind: new-clean-room; existing planning, release, and provenance files updated in place
origin: independently authored from the repository P1 clean-room target contract,
  existing reviewed public-synthetic layout/assembly boundary, and the user's
  effect-first direction; no predecessor code, external prompt, source deck,
  template, asset, render, review transcript, or build output was inspected or copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-09
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; inputs and tests contain only fictional
  committee/pilot text, generic metrics, semantic IDs, and digests of repository-
  owned synthetic planning/layout data; no private path, name, host, template,
  slide/shape fact, asset, or presentation binary is tracked
project_constant_removal: passed; the lab imports only Node crypto and the
  existing ordered-story lab, never imports the hidden answer, accepts no
  pre-authored story/candidate in the assembly path, and contains no predecessor
  or private-fixture constant
public_fixture_conformance: applicable; fifteen focused tests cover raw-input
  generation, complete planning contracts, exact input/evidence coverage,
  actual leave-one-node-out argument failure, comparative ranking, fixed-registry
  external approval, opaque receipt authority,
  template/layout binding, locked/flexible/scratch precedence, exact three-slide
  PPTX and joint assembly receipt, drift, accessors, injection, and non-promotion
independent_review: passed; the initial bounded review's provenance, acceptance-
  authority, template-binding, contract-completeness, exact-coverage, comparative-
  ranking, joint-receipt, and true node-deletion findings were fixed; the same
  reviewer reproduced the forged-approval rejection and found no remaining
  blocker, high, or medium issue in targeted closure
notes: This remains a non-authorizing lab. Locked-template assembly renders the
  admitted brief/layout-family projection. P2 supplies staged simulated review
  and P3 now supplies controlled visible-effect evidence. No support row or
  public 0.1.0 product contract changes.
```

### P2 staged visual-review `0.2.0` set

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/EFFECT_FIRST_IMPLEMENTATION_PLAN.md
  - docs/M2-005_HANDOFF.md
  - docs/PRESENTATION_DESIGN_PLANNING_REVIEW.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - fixtures/design-planning/atomic-outcome-manifest.json
  - fixtures/design-planning/reviewed-visual-evidence-manifest.json
  - labs/visual-review-agent/PROMPT_V2.md
  - labs/visual-review-agent/calibration-v2-examples.json
  - labs/visual-review-agent/report.schema.json
  - labs/visual-review-agent/review-contract.mjs
  - labs/visual-review-agent/review-v2-contract.mjs
  - labs/visual-review-agent/review-v2.schema.json
  - provenance/records.json
  - tests/visual-review-agent-v2.test.mjs
kind: new-clean-room lab contract and text fixtures; existing planning, v1 lab,
  release, and provenance files updated in place
origin: independently authored from the repository P2 effect-first contract,
  the fixed P1 synthetic planning receipt/outcome boundary, and the previously
  recorded abstract public-project mechanisms; no external prompt, code, deck,
  render, asset, model transcript, predecessor material, or build output was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-09
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; all reports, prompts, item descriptions,
  calibration situations, IDs, and hashes are repository-owned text derived
  from the fictional bounded-pilot fixture; no presentation binary, image,
  private template/slide/shape identity, local path, host, or raw review output
  is tracked
project_constant_removal: passed; the lab accepts only a fixed reviewed visual-
  evidence manifest that binds delivery, assembly, render, contact-sheet,
  context, required-item sources/crops, and whole-deck crop registry; both
  label-blind report batches must freeze under one opaque one-shot session
  before only the reviewed public-synthetic hidden-key and atomic-manifest
  digests can open the P1 reveal path; core imports no lab module and support
  metadata is unchanged
public_fixture_conformance: applicable; twenty-three focused tests validate all
  eleven schema-conformant calibrations, blind prompt answer isolation, delivery
  defaults, prepared/consumed/freeze/reveal authority, same-session binding,
  fixed evidence/key/manifest and
  exact blind-slot/item/source/crop binding, non-votable reconciliation, failure
  precedence, spatially and slide-compatible whole-deck aggregation, caller
  crop rejection, fixed blocker crop follow-up, deterministic severity/repair/
  verdict, Proxy/region rejection, and core/support isolation; the complete
  repository suite passes 842/842
independent_review: passed; the same bounded reviewer reproduced failed-freeze
  and post-reveal replay rejection, fixed reviewed blocker-crop binding,
  assessable-slide blind evidence, slide-compatible scope consensus, and
  same-digest cross-session rejection, then found no remaining blocker, high,
  or medium issue
notes: Every result is explicitly simulated-review-only. This lab does not
  prove actual audience comprehension, rendering compatibility, package
  validity, editability, a public capability, or product support. P3 separately
  supplies label-randomized controlled evidence over real public-synthetic
  renders without changing this P2 authority boundary.
```

### P3 controlled comparison and stable render-harness set

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/EFFECT_FIRST_IMPLEMENTATION_PLAN.md
  - docs/M2-005_HANDOFF.md
  - docs/PRESENTATION_DESIGN_PLANNING_REVIEW.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - labs/design-planning/controlled-comparison.mjs
  - labs/design-planning/controlled-render-harness.mjs
  - package.json
  - provenance/records.json
  - scripts/render-controlled-comparison.mjs
  - tests/controlled-comparison.test.mjs
  - tests/controlled-render-harness.test.mjs
kind: new-clean-room lab implementation, CLI, and tests; existing planning,
  release, package, handoff, and provenance files updated in place
origin: independently authored from the repository P3 controlled-comparison
  contract, the existing public-synthetic P1 planner/layout/assembly path, the
  user's effect-first direction, and abstract grid/hierarchy/meaningful-motif/
  complete-render mechanisms recorded from the Guizang and Presentation Design
  skills; no external code, prompt, template, CSS, asset, deck, render, review
  transcript, predecessor material, or Git history was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-09
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; code and tests use only repository-owned
  fictional brief/evidence text, runtime-generated synthetic POTX/PPTX bytes,
  opaque labels, and content hashes; no generated deck, PNG, raw agent review,
  private fixture, absolute local path, host, personal name, or asset is tracked
project_constant_removal: passed; all six candidates derive internally from one
  authenticated P1 selection, no caller can inject an arm or repair budget, the
  only executable paths are explicit local CLI inputs, and core imports no lab
  module
public_fixture_conformance: applicable; seventeen focused tests cover exact 2 ×
  3 and twelve-cell completeness, fixed sequence and all-visible-wording visual
  invariants, randomization and non-disclosure, one-shot batch authority, source
  and byte drift, stable create-only rendering, pre-manifest renderer-sidecar
  rejection, partial/extra-root rejection, exact authentic candidate inventory,
  tamper detection, and no-shell/no-random-temp behavior; the complete
  repository suite passes 859/859
independent_review: passed; the first bounded code review found an unequal-motif
  visual-factor confound, an overstated topic-list claim, and missing first-run
  inventory validation. Shared motif wording plus an all-visible-text test,
  explicit fixed-permutation wording, pre-manifest inventory enforcement, and
  a renderer-sidecar regression closed them. The current bytes were then
  rendered afresh and three isolated blind reviews ranked all three causal arms
  above every fixed-order permutation. The subject-grounded causal arm ranked
  first live in all three and first, first, and second for leave-behind. Two
  disputed blank/clipping observations were reconciled against the exact
  anonymous images and explicitly retracted. Targeted code re-review found the
  implementation findings closed.
notes: The pinned local evidence uses Quick Look plus ImageMagick, never
  PowerPoint. Generated decks, PNGs, manifests, and raw reviews remain ignored
  local evidence. Review preference remains simulated-review-only and does not
  prove actual audience effect, PowerPoint editability, arbitrary-template
  quality, a public capability, or product support. The final matrix receipt is
  65009c3b41bc1678bd7bc36ebfab3ec8b93524e99fecea2041995398eb58c490 and
  the final render-manifest digest is
  e11ab84da264763899d8526bef3ed3383e174867492c35fa57f12a85347c1d10.
  The support claim switch remains false.
```

### M2-005C native target-application and authenticated bridge set

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/M2-005_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - packages/core/src/create-only-assembly.mjs
  - packages/core/src/native-card-arrow-assembly.mjs
  - packages/core/src/native-presentation-publication.mjs
  - packages/core/src/ordered-slide-assembly.mjs
  - provenance/records.json
  - tests/native-card-arrow-assembly.test.mjs
kind: new-clean-room core target applicator, private artifact authority,
  authenticated create-only publisher, verification-shadow ordered bridge, and
  public synthetic tests; existing assembly authority, architecture, handoff,
  release, and provenance records updated in place
origin: independently authored from D-022, the repository M2-003 typed
  native-card-arrow contract, the existing M2-001 one-shot dispatcher and
  M2-005A authentic artifact boundary, existing ordered graph/publication rules,
  public ECMA-376 identifiers, and the repository-owned synthetic package; no
  predecessor code, external project source, fragment implementation, deck,
  asset, render, or build product copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-09
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; code and tests contain only public format
  identifiers, repository-owned synthetic text, in-memory archives, stable
  error pointers, and generic target facts; no private fixture, absolute local
  path, host, asset, deck, or raw review output is tracked
project_constant_removal: passed; core imports no plugin or lab, never reads or
  parses the unbound fragment, accepts no caller source ID, derives target facts
  and new object IDs from authenticated public-synthetic state, and does not
  change the generic package grammar
public_fixture_conformance: applicable; thirty-six focused tests cover the first
  exact native insertion slice plus private artifact identity, detached and
  SharedArrayBuffer-backed snapshots, verification-shadow mixed/all-native
  ordering, exact slide-byte preservation, authenticated direct/ordered create-
  only publication, deterministic bytes, forgery/tamper, duplicate semantic IDs,
  closed inputs, caller-label non-authority, no overwrite, symlink parents, and
  continued generic parser/publisher rejection; the complete repository suite
  passes 895/895
independent_review: passed; the first applicator review is closed; the bridge
  review's one high snapshot-after-hash TOCTOU was fixed by intrinsic length
  admission followed by copy-then-hash of the returned private snapshot, direct
  and ordered SharedArrayBuffer regressions pass, and targeted closure found no
  remaining blocker, high, or medium finding
notes: The direct artifact remains publicationEligible false for the generic
  raw-byte publisher. Only private report identity admits direct native or native-
  containing ordered output to the separate authenticated publisher. No
  serialized contract, arbitrary input grammar, support row, or PowerPoint
  editability claim is promoted.
```

### Native compatibility, persistent composition, and candidate-boundary set

```yaml
paths:
  - AGENTS.md
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M1-005_HANDOFF.md
  - docs/M2-004_HANDOFF.md
  - docs/M2-005_HANDOFF.md
  - docs/PROJECT_DEFINITION.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - packages/core/src/native-card-arrow-assembly.mjs
  - packages/core/src/native-card-arrow-placement.mjs
  - packages/core/src/native-presentation-publication.mjs
  - packages/core/src/secure-zip.mjs
  - packages/core/src/slide-layout-ir.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - tests/native-card-arrow-assembly.test.mjs
  - tests/secure-template-ingestion.test.mjs
  - tests/slide-layout-ir.test.mjs
kind: new-clean-room core layout/placement and candidate-boundary modules plus
  public synthetic tests; existing security, architecture, support, release,
  handoff, policy, and provenance files updated in place
origin: independently authored from D-024/D-025, the observed public-synthetic
  overlap, existing authenticated template geometry and typed native contract,
  public PKWARE and ECMA-376 Open Packaging identifiers, the user's requirement
  to retain editable constraint calculations, and abstract parent-padding,
  alignment, slot, and sizing concepts learned from public Figma behavior; no
  Figma or external source, runtime, prompt, template, asset, deck, predecessor
  material, review transcript, or Git history was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-09
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; all code and tests use public format
  identifiers, small repository-owned synthetic geometry/text, runtime-built
  archives, semantic IDs, and stable pointers; PowerPoint files, PNGs,
  automation, raw pixel reviews, local absolute paths, hosts, private fixtures,
  and private template/slide/shape identities remain ignored and untracked
project_constant_removal: passed; the product path accepts semantic slot intent
  and preferred size instead of caller-authored x/y, derives slot geometry from
  authenticated source facts, persists IR intent separately from the frozen
  plan, applies the same paint-bound occupancy gate to the retained low-level
  coordinate bridge, and grants structural bytes candidate authority only
public_fixture_conformance: applicable; eight layout-IR tests, forty native
  assembly/candidate tests, and the secure-ingestion growth-hint positives and
  adversarial boundaries pass; the combined focused run passes 137/137 and the
  complete repository suite passes 918/918
independent_review: passed; the bounded review found a JSON key-order false
  rejection and a live/revoked Proxy array-admission defect. Canonical
  normalized comparison, one descriptor snapshot, a unified Proxy exception
  boundary, and two regressions closed them. Final re-review passed 8/8 layout
  tests and found no remaining blocker, high, or medium finding across replay,
  geometry/paint bounds, product bypass, backward compatibility, and candidate-
  versus-delivery authority
notes: The JSON-safe assembly report is the in-memory precursor to the
  normative CandidateBuildRecord and carries both complete SlideLayoutIR and
  digest-bound ComposedSlidePlan. A
  standalone PPTX is never the replay authority for later constraint-aware
  edits. One repaired synthetic candidate and its exact PowerPoint-saved round
  trip each passed an independent pixel-only review; PowerPoint 16.111.3 also
  passed group rename/save/reopen and in-memory child editability. That evidence
  is local, narrow, and does not promote arbitrary-template compatibility,
  delivery authority, or the false support switch.
```

### M2-005C typed OMML target and constraint-authority closure

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M2-004_HANDOFF.md
  - docs/M2-005_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - packages/core/src/create-only-assembly.mjs
  - packages/core/src/native-omml-formula-assembly.mjs
  - packages/core/src/native-presentation-publication.mjs
  - packages/core/src/slide-layout-ir.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - tests/native-omml-formula-assembly.test.mjs
  - tests/slide-layout-ir.test.mjs
kind: new-clean-room typed formula target applicator and public synthetic tests;
  existing artifact authentication, layout IR, candidate writer, architecture,
  support, threat, release, handoff, decision, and provenance files updated in
  place
origin: independently authored from D-008/D-025/D-026, the repository's closed
  formula-dispatch and M2-005A artifact contracts, public ECMA-376 namespace
  identifiers, Microsoft CT_TextMath/a14:m interoperability documentation, the
  user's requirement that later edits retain both constraints and their exact
  calculation, and the existing clean-room semantic-slot model; no predecessor,
  external implementation, prompt, source file, converter output, deck, image,
  font, or Git history was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-09
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; tracked code, tests, and documentation use
  only public format identifiers, repository-owned synthetic text/geometry,
  bounded in-memory archives, generic semantic IDs, digests, and stable error
  pointers; local PPTX/PNG/automation, raw reviews, absolute paths, host facts,
  and unrelated local application state remain untracked
project_constant_removal: passed; core imports no adapter, never concatenates
  the unbound fragment, derives the formula target only from authenticated
  facts, retains the full IR/plan rather than reverse-engineering a PPTX, emits
  no relationship or fallback, and does not broaden the generic package grammar
public_fixture_conformance: applicable; eleven OMML tests cover exact dispatch,
  strict typed rebuild, target capacity, semantic-slot IR/plan replay, exact
  one-slide diff, deterministic bytes, one-shot execution, authority/tamper,
  copy-before-hash shared-memory authentication, candidate-only writing,
  continued generic rejection, and adapter/raw-fragment isolation. Together
  with create-only, native, and layout tests the focused run passes 67/67; the
  complete repository suite passes 930/930
independent_review: passed; the bounded review found one high shared-memory
  mutation interval in reused base authentication and one medium reserved-root
  ID containment bypass. Intrinsic byte-length admission, copy-before-hash,
  rejection of slide-canvas as a node/slot identity, mandatory bounded slot-
  check cardinality, and two regressions closed both. Final re-review found no
  remaining blocker, high, or medium finding
notes: PowerPoint 16.111.3 opened the exact synthetic candidate without repair,
  saved a shape-name edit, closed, and reopened it with native OMML preserved;
  PowerPoint authored its own AlternateContent/PNG fallback on save. Extracted
  fallback pixels were complete and a layout composite passed an independent
  review, but the composite is not a direct PowerPoint screenshot and the edit
  is not a human formula-content edit. At this slice COMPAT-OMML-001, real-
  Pandoc evidence, rollback, typed-OMML ordered-deck application/record
  integration, final delivery, and support promotion remained open. M2-005D
  later closes only the ordered candidate/replay item.
```

### M2-005C normative direct-candidate build record

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M2-005_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - fixtures/contracts/valid/candidate-build-record.json
  - packages/core/src/candidate-build-record.mjs
  - packages/core/src/native-presentation-publication.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - schemas/contracts/candidate-build-record.schema.json
  - schemas/contracts/manifest.json
  - scripts/check-contracts.mjs
  - tests/candidate-build-record.test.mjs
  - tests/contracts.test.mjs
  - tests/native-card-arrow-assembly.test.mjs
  - tests/native-omml-formula-assembly.test.mjs
  - tests/support-matrix.test.mjs
  - types/contracts.d.ts
kind: new-clean-room canonical candidate-record module, ninth public root
  schema, text-only fixture, generated union type, direct-native bundle writer,
  conformance/adversarial tests, and in-place architecture, release, support,
  threat, handoff, decision, contract-gate, and provenance updates
origin: independently authored from D-025/D-027, the repository's bounded-slot
  resolver, authentic direct native/OMML artifact boundaries, secure ZIP byte
  limits, create-only publication rules, and the user's requirement that later
  edits retain both constraints and their exact calculation; no predecessor,
  external implementation, prompt, source deck, binary, image, asset, review
  transcript, or Git history was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-09
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; the record admits only bounded generic
  semantic IDs, repository-relative OOXML part names, geometry, stable reason
  codes, and cryptographic digests. It stores a candidate basename rather than
  a filesystem path, and no PPTX, PNG, raw review, host fact, or private fixture
  is tracked
project_constant_removal: passed; the closed card-arrow and typed-OMML branches
  bind source artifact, verification profile, capability evidence, exact diff,
  native object identity, and candidate bytes as one tuple. The canonical
  verifier replays SlideLayoutIR to the recorded ComposedSlidePlan instead of
  reverse-engineering intent from a later PPTX
public_fixture_conformance: applicable; the ninth text-only fixture validates
  and replays through the contract gate. Three record-unit tests plus direct
  native and OMML bundle regressions cover canonical bytes, exact replay,
  source/profile/evidence/diff drift, candidate tamper, cross-pair Proxy state,
  ASCII/component filename bounds, pre-copy limits, create-only races, record-
  first/marker-last ordering, POSIX directory barriers, and safe rollback. The
  complete repository suite passes 942/942
independent_review: passed; the bounded D-027 review reproduced cross-pair
  authentication, schema/runtime tuple, capability-reference, Unicode filename,
  pre-copy resource, directory-sync, and rollback ordering/failure gaps. Every
  issue was fixed and regression-tested; final re-review found no remaining
  blocker, high, or medium issue
notes: CandidateBuildRecord 0.1.0 is the readable persisted edit/replay authority for one
  direct semantic-slot candidate. It preserves both what was constrained and
  the exact resolved result, while the PPTX remains the editable candidate.
  Record-first and candidate-last publication makes the candidate the commit
  marker. The record grants neither delivery nor support authority; ordered-
  deck coverage, receipt-bound final delivery/rollback, and the manual formula-
  content edit remain open.
```

### M2-005C complete ordered-candidate build record

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M2-005_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - packages/core/src/candidate-build-record.mjs
  - packages/core/src/native-presentation-publication.mjs
  - packages/core/src/ordered-slide-assembly.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - schemas/contracts/candidate-build-record.schema.json
  - tests/candidate-build-record.test.mjs
  - tests/native-card-arrow-assembly.test.mjs
  - tests/ordered-story-deck.test.mjs
  - tests/support-matrix.test.mjs
  - types/contracts.d.ts
kind: additive clean-room ordered branches in the existing non-delivery root
  contract, private authenticated record facts in the ordered assembler, one
  ordered bundle entry point over the existing record-first/marker-last pair publisher, public
  synthetic conformance/adversarial tests, and matching documentation/policy/
  provenance updates
origin: independently authored from D-025/D-027/D-028, the current ordered
  assembler's authenticated report and slide-allocation facts, the existing
  bounded-slot resolver, direct candidate record, and create-only publication
  boundary; no predecessor, external implementation, prompt, source deck,
  binary, image, asset, review transcript, or Git history was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-09
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; records contain only generic semantic IDs,
  repository-relative OOXML parts, deterministic allocation integers, bounded
  geometry/receipts, stable reason codes, and hashes. Candidate files, record
  files, local directories, renders, raw reviews, hosts, and private fixtures
  remain untracked
project_constant_removal: passed; plain clone/fill slides are represented
  honestly as digest-bound sources, while only semantic-slot native slides may
  carry replay authority. The ordered record binds every slide's order, source
  digest, output part, relationship allocation, presentation ID, complete deck
  diff, and final bytes; raw-coordinate native slides fail before staging
public_fixture_conformance: applicable; the public schema/type union validates
  one ordered branch whose per-slide source-build union is authoritative. Unit
  and integration tests cover exact order/source/diff binding, rejection of
  redundant or malformed classification, complete native IR/plan replay,
  deterministic generic sidecars, candidate tamper, raw-native rejection, and
  unchanged direct/legacy behavior; the focused closure passes 166/166 and the
  complete suite passes 945/945
independent_review: passed; one medium schema/runtime classification drift was
  found. Redundant ordered profile/native flag/count fields were removed instead
  of multiplying conditional branches; bounded re-review reproduced their
  rejection and found no remaining blocker, high, or medium issue
notes: The ordered branch closes the generic and semantic-card deck record gap
  without pretending digest-only clone/fill slides contain a missing layout
  plan. Typed-OMML ordered application, receipt-bound final delivery/rollback,
  the human formula-content edit, broader compatibility, and support promotion
  remain open.
```

### D-029 receipt-bound direct-native final delivery

```yaml
paths:
  - AGENTS.md
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M2-005_HANDOFF.md
  - docs/PROJECT_DEFINITION.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - packages/core/src/create-only-assembly.mjs
  - packages/core/src/native-card-arrow-assembly.mjs
  - packages/core/src/native-card-arrow-placement.mjs
  - packages/core/src/receipt-bound-final-delivery.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - tests/receipt-bound-final-delivery.test.mjs
kind: additive clean-room direct final-delivery boundary, shared deterministic
  relation derivation, exact source-to-candidate projection, create-only
  BuildArtifact-last publisher, adversarial public tests, and matching authority,
  release, support, handoff, and provenance updates
origin: independently authored from D-029 and the repository's existing
  CandidateBuildRecord, QaReport, BuildArtifact, ProjectContext, secure
  package-view, native typed-construction, SlideLayoutIR/ComposedSlidePlan, and
  create-only publication contracts; no predecessor or external source,
  implementation, prompt, deck, binary, screenshot, asset, raw review, or Git
  history was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-10
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; code, tests, and records use only stable
  pointers, generic semantic identifiers, repository-relative package parts,
  fictional public-synthetic text, runtime-generated bytes, and isolated
  temporary directories. No absolute path, host fact, private template/deck,
  screenshot, personal identity, fixture fingerprint, or raw review is tracked
project_constant_removal: passed; the slice is intentionally restricted to one
  direct public-synthetic semantic-slot native profile. Ordered and OMML final
  delivery fail closed. The source template owns unchanged inherited content,
  DeckSpec owns authored component content, the shared pure derivation owns the
  relation calculation, and no record label or hash grants generation authority
public_fixture_conformance: applicable; 23/23 focused final-delivery tests cover
  exact success, complete source/index/overlay/DeckSpec/IR/plan/package
  projection, replay-valid false constraints with unchanged native geometry,
  non-native relabeling, collateral mutation, resource budgets, failed evidence,
  ordered rejection, create-only one-shot behavior, rollback, post-marker
  uncertainty, and caller/shared-memory snapshots. The placement/assembly/IR/
  candidate/final review focus passes 81/81 and the complete suite passes 968/968
independent_review: passed; the bounded review found two semantic/package
  projection blockers, one post-link commit-state high, one pre-budget allocation
  medium, and one closing full-constraint relation-layer gap. Deterministic
  archive reconstruction, one shared source-facts-to-IR/plan function, whole-
  object semantic comparison, synchronous post-link state capture, incremental
  traversal budgets, and targeted regressions closed every finding. Closing
  re-review found no remaining blocker, high, or medium issue
notes: The final boundary reuses existing QaReport and BuildArtifact and keeps
  BuildArtifact as the last visible commit marker. Binary equality and hashes
  verify exact execution boundaries only; readable source/DeckSpec/IR/plan facts
  remain authoritative. The global support switch remains false, and no
  GenerationIntent, formula AST, extra root contract, ordered/OMML delivery, or
  arbitrary-template claim is introduced.
```

### M2-005D typed-OMML ordered candidate coverage

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M2-005_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - packages/core/src/candidate-build-record.mjs
  - packages/core/src/ordered-slide-assembly.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - schemas/contracts/candidate-build-record.schema.json
  - tests/candidate-build-record.test.mjs
  - tests/native-omml-formula-assembly.test.mjs
  - types/contracts.d.ts
kind: additive clean-room typed-OMML member of the existing ordered source-build
  union, one shared target-specific native authentication table, public
  synthetic/adversarial tests, generated type refresh, and matching authority,
  release, support, handoff, and provenance updates
origin: independently authored from D-026 through D-029, the repository's
  authentic direct OMML artifact boundary, existing ordered verification shadow,
  SlideLayoutIR/ComposedSlidePlan replay contract, and ordered candidate
  publisher; no predecessor or external implementation, prompt, deck, binary,
  screenshot, asset, raw review, build product, or Git history was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-10
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; code, tests, schemas, and records contain
  only generic semantic identifiers, repository-relative OOXML parts, bounded
  geometry/capacity facts, stable errors, and runtime-built public-synthetic
  archives. No absolute path, host fact, private fixture/deck, screenshot,
  personal data, raw review, or generated PPTX is tracked
project_constant_removal: passed; the former ordered card-only branch is replaced
  by one two-profile authentication table. The per-slide sourceBuild remains the
  only classifier; no deck-level native/OMML flag, count, profile, new root
  contract, persisted formula AST, or parallel assembler was added
public_fixture_conformance: applicable; three new tests cover schema/runtime
  typed-OMML source replay, formula-evidence drift, authentic formula slides in
  first and last order, deterministic bytes/report, exact slide copy, first-
  source base digest, complete IR/plan/diff/evidence persistence, and copied-
  report rejection. The focused closure passes 201/201 and the complete suite
  passes 971/971
independent_review: passed; the bounded review independently checked OMML/base/
  byte authority, exact shadow isolation, order and digest ownership, schema/
  runtime/generated-type tuple parity, card/clone compatibility, resource and
  SharedArrayBuffer snapshots, and the closed final-delivery boundary. No
  blocker, high, or medium issue was found
notes: This closes only typed-OMML ordered candidate application and replay.
  CandidateBuildRecord still does not own formula semantics, which remain in
  readable DeckSpec/LaTeX upstream. Ordered delivery, OMML delivery, the manual
  PowerPoint formula-content edit, broad compatibility, and support promotion
  remain open; supportClaimsEnabled is still false.
```

### D-029 source-preserving direct typed-OMML final-delivery gate

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M2-005_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - packages/core/src/native-omml-formula-assembly.mjs
  - packages/core/src/receipt-bound-final-delivery.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - tests/native-omml-formula-assembly.test.mjs
  - tests/receipt-bound-omml-final-delivery.test.mjs
kind: additive clean-room source-preserving OMML generation entry, exact
  readable-authority regeneration in the existing final-delivery boundary,
  purpose-bound compatibility receipt gate, public synthetic adversarial tests,
  and matching architecture, decision, release, support, threat, handoff, and
  provenance updates
origin: independently authored from D-026 through D-029 and the repository's
  existing source-template/index, project resolver/dispatcher, typed OMML,
  CandidateBuildRecord, QaReport, BuildArtifact, and create-only publication
  contracts; no predecessor or external implementation, prompt, deck, binary,
  screenshot, asset, review transcript, build product, or Git history was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-10
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; code, tests, and documents contain only
  repository-owned synthetic text, generic semantic identifiers, bounded
  runtime-built archives, public OOXML namespaces, stable error pointers, and
  repository-relative parts. No local path, host fact, private fixture/deck,
  tracked presentation/render, raw review, or personal data is admitted
project_constant_removal: passed; the exact admitted source template owns
  unchanged inherited content, DeckSpec LaTeX owns formula semantics, and the
  shared typed mutation core owns package construction. No candidate label,
  base hash, hidden call history, persisted formula AST, or new root contract
  becomes semantic authority
public_fixture_conformance: applicable; one new source-preserving assembly test
  and six direct-OMML final tests cover unchanged inherited content, exact
  deterministic regeneration, complete archive/IR/plan/diff/formula comparison,
  DeckSpec LaTeX drift, undeclared clone/fill content, no-op call-path
  convergence, purpose-confused compatibility evidence, exact publication, and
  continued native-card compatibility. The combined OMML/direct-final focus
  passes 44/44 and the complete repository suite passes 978/978
independent_review: passed; the one bounded review found a high contract
  ambiguity between rejecting semantic drift and rejecting hidden call history.
  D-029 was explicitly resolved in favor of readable-result authority, a no-op
  convergence regression was added, and bounded re-review found no remaining
  blocker, high, or medium issue
notes: This implements a gated direct typed-OMML final path but does not provide
  its required real formula-content-edit-save-reopen evidence. COMPAT-OMML-001,
  real-Pandoc coverage, target-specific native/OMML ordered final delivery,
  broad compatibility, and support promotion remain open; supportClaimsEnabled
  is still false.
```

### D-029 clone/fill-only ordered final-delivery gate

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M2-005_HANDOFF.md
  - docs/M2-005_ORDERED_STORY_DECK.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - packages/core/src/ordered-slide-assembly.mjs
  - packages/core/src/receipt-bound-final-delivery.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - tests/ordered-story-deck.test.mjs
  - tests/receipt-bound-ordered-final-delivery.test.mjs
  - tests/support-matrix.test.mjs
kind: additive clean-room complete-batch clone/fill ordered final-preparation
  branch in the existing receipt-bound boundary, a secure-ZIP-derived executable
  range correction, public synthetic adversarial tests, and matching authority,
  release, support, threat, handoff, and provenance updates
origin: independently authored from D-029 and the repository's existing readable
  project tuple, resolver/dispatcher, clone/fill one-slide assembler, ordered
  graph rebuilder, CandidateBuildRecord, QaReport, BuildArtifact, create-only
  publisher, and secure ZIP profile; no predecessor or external implementation,
  prompt, deck, binary, screenshot, asset, review transcript, build product, or
  Git history was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-10
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; code, tests, and documents contain only
  repository-owned synthetic text, generic semantic identifiers, bounded
  runtime-built POTX/PPTX archives, public OOXML namespaces, stable error
  pointers, and repository-relative parts. No absolute path, host fact, private
  fixture/deck, tracked presentation/render, personal data, or raw review is
  admitted
project_constant_removal: passed; source/index plus the complete readable
  DeckSpec batch remain generation authority, the unchanged ordered assembler
  owns package allocation, and the shared publisher owns final exposure. No
  candidate label/hash, call history, new semantic root, parallel assembler, or
  deck-level native classifier was introduced. The existing 16-slide candidate-
  record parsing envelope remains compatibility-only; executable assembly and
  delivery are explicitly bounded to 2–11 by the unchanged security profile
public_fixture_conformance: applicable; eleven ordered-final tests cover exact
  complete-batch regeneration/publication, the 11-slide success edge, 12-slide
  rejection before dispatch, content/order drift, target-specific native source
  rejection, full-slide receipt coverage, compatibility purpose, and caller
  mutation after capture. One additional ordered-assembler regression rejects
  12 entries before artifact/report inspection. The combined final focus passes
  55/55 and the complete suite passes 990/990
independent_review: passed; the one bounded review found no blocker/high and one
  medium mismatch between the advertised 16-slide execution range and the
  secure ZIP parser's 32-entry limit. The implementation now derives the last
  executable size as 10 fixed parts + 2 × 11 slides = 32, rejects 12 before
  product execution or artifact inspection, and preserves the wider record
  parser only for compatibility. Bounded re-review found no blocker, high, or
  medium issue
notes: This implements only the same-template clone/fill ordered gate. At this
  implementation boundary no real ordered-deck-open-save-reopen receipt was
  stored; the later D-010 follow-on below supplies one exact two-slide local
  receipt without changing target-specific native/OMML ordered delivery,
  arbitrary-template, broader fault/compatibility, or support status.
  supportClaimsEnabled is false.
```

### D-010 fixed public-synthetic ordered PowerPoint compatibility probe

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M2-005_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - package.json
  - packages/powerpoint-macos/src/ordered-compatibility-receipt.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - scripts/run-ordered-powerpoint-compatibility.mjs
  - scripts/validate-ordered-powerpoint.applescript
  - tests/ordered-powerpoint-compatibility.test.mjs
  - tests/support-matrix.test.mjs
kind: additive clean-room optional trusted macOS PowerPoint evidence adapter,
  closed readable receipt parser, fixed public-synthetic runner, static
  AppleScript, adversarial tests, and matching authority/release/support/threat/
  handoff/provenance updates
origin: independently authored from D-010, D-029, the repository's existing
  ordered candidate/record and final receipt contracts, documented Node.js
  process/file APIs, PowerPoint's installed scripting dictionary, and observed
  behavior of the repository-owned synthetic candidate. No predecessor or
  external implementation, prompt, presentation, asset, binary, screenshot,
  transcript, raw review, build product, or Git history was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-10
license_or_rights_basis: MIT
third_party_dependencies:
  - Microsoft PowerPoint 16.111.3, optional trusted local runtime only; not
    bundled or redistributed
private_information_review: passed; tracked code, tests, and documents contain
  only repository-owned synthetic wording, generic semantic IDs, public OOXML/
  AppleScript identifiers, stable relative evidence names, normalized version
  facts, and redacted errors. No absolute local path, hostname, user document,
  private fixture/deck, raw transcript, PPTX/PDF/PNG, personal data, or OAuth
  material is admitted
project_constant_removal: passed; the runner derives one exact two-slide
  candidate from existing public contracts and rejects caller-selected decks,
  output roots, scripts, operations, or application names. Relative PowerPoint
  paths, CI, pre-open user presentations, semantic drift, slide loss, source
  mutation, missing/partial output, timeout, stderr, and output reuse fail
  closed. Hashes bind exact objects only; readable slide/order facts and frozen
  pixels remain the evidence
public_fixture_conformance: applicable; eight focused tests cover deterministic
  candidate/record construction, closed transcript/receipt parsing, exact
  readable order/text acceptance, semantic drift, slide loss, malformed fields,
  static least privilege, explicit trust, and CI refusal. A trusted local run
  on PowerPoint 16.111.3 opened/exported/saved/closed/reopened the exact two-page
  candidate with unchanged source and exact readable text/order. Corresponding
  1600 x 900 before/after pixels were byte-identical. The complete suite passes
  998/998
independent_review: passed; one bounded independent pixel-only reviewer saw only
  anonymous frozen A/B page sets and the visible compatibility goal, reported
  pass on every page, and found no blocker, high, medium, or minor issue. The
  reviewer did not inspect generation code, know the before/after mapping,
  mutate output, or approve a repair
notes: Raw candidate, record, roundtrip, PDFs, transcript, raster pages, and
  review remain ignored in one stable local evidence root. This closes only the
  exact two-slide ordered-deck-open-save-reopen fact; it does not prove the full
  2-11 executable range, arbitrary templates, target-specific native/OMML
  ordered delivery, human formula-content editing, public CI, or support.
  supportClaimsEnabled remains false.
```

### D-030 fixed mixed ordered final and stable PowerPoint probe

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/DECISIONS.md
  - docs/M2-005_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - labs/visual-review-agent/PROMPT.md
  - labs/visual-review-agent/PROMPT_V2.md
  - labs/visual-review-agent/visual-evidence-plan.mjs
  - packages/core/src/candidate-build-record.mjs
  - packages/core/src/native-omml-formula-assembly.mjs
  - packages/core/src/receipt-bound-final-delivery.mjs
  - packages/core/src/strict-xml.mjs
  - schemas/contracts/candidate-build-record.schema.json
  - scripts/run-ordered-powerpoint-compatibility.mjs
  - scripts/validate-ordered-powerpoint.applescript
  - tests/candidate-build-record.test.mjs
  - tests/contracts.test.mjs
  - tests/helpers/public-mixed-ordered-candidate.mjs
  - tests/native-omml-formula-assembly.test.mjs
  - tests/ordered-powerpoint-compatibility.test.mjs
  - tests/receipt-bound-mixed-ordered-final-delivery.test.mjs
  - tests/visual-review-agent.test.mjs
  - tests/visual-review-agent-v2.test.mjs
  - tests/visual-evidence-plan.test.mjs
  - types/contracts.d.ts
  - provenance/records.json
kind: additive clean-room fixed mixed-source ordered final preparation,
  Office-compatible typed OMML alternate-content serialization, stable manual
  PowerPoint carrier, effect-first geometry correction, deterministic visual
  equality rule, public synthetic tests, and matching handoff/policy records
origin: independently authored from D-025 through D-030 and the repository's
  existing public-synthetic source/index, dispatcher, semantic-slot IR,
  target-specific assemblers, ordered CandidateBuildRecord, receipt-bound
  final-delivery boundary, and visual-review contracts. Public OOXML namespace
  and element names are interoperability identifiers. No predecessor or
  external source file, prompt, deck, template, binary, screenshot, transcript,
  raw review, build product, or Git history was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-10
license_or_rights_basis: MIT
third_party_dependencies:
  - Microsoft PowerPoint 16.111.3, optional trusted local runtime only; not
    bundled or redistributed
private_information_review: passed; tracked material contains only
  repository-owned synthetic text, generic semantic identifiers, public OOXML/
  AppleScript identifiers, stable repository-relative evidence basenames, and
  redacted failures. Raw PPTX/PDF/PNG/transcript/review artifacts remain ignored;
  no absolute local path, host identity, private fixture, user deck, OAuth data,
  or personal presentation content is admitted
project_constant_removal: passed; readable source/index/DeckSpec facts remain
  semantic authority, SlideLayoutIR and ComposedSlidePlan retain constraint and
  geometry authority, and QaReport/BuildArtifact retain delivery authority. The
  stable carrier and byte hashes are boundary/transport facts only; no binary,
  screenshot, call history, fallback picture, or candidate label becomes a
  planning authority
public_fixture_conformance: applicable; focused tests cover exact three-kind
  regeneration, source-build discrimination, story/LaTeX/evidence/purpose and
  async-snapshot rejection, MCE choice/fallback topology, 48 pt run styling,
  ordinary-shape versus text-box markers, candidate-record schema/type drift,
  stable device/inode carrier replacement, exact bytes, and visual-review prompt
  safeguards. `prepareVisualEvidencePlan` now snapshots bounded image bytes,
  derives sizes/backing facts only from captured internal-slot getters, rejects
  forged metadata and shared/resizable storage before its immediate copy,
  computes exact relations with byte comparison, and emits the minimal review
  image set. One trusted PowerPoint run preserved the exact three-slide
  readable inventory and produced byte-identical 1600 x 900 before/after page
  pairs. Seven focused evidence-plan tests and the complete repository suite
  pass 1021/1021
independent_review: passed after mandatory replay and bounded code re-review;
  the bounded pixel-only
  reviewer initially reported two missing text elements, but deterministic
  equality made that claim impossible. Exact-path reopening reproduced transient
  incomplete image display, the reviewer withdrew the findings, and the final
  review found no blocker, high, medium, or minor issue. The prompts now require
  reopen on blank/missing-content claims and leave exact equality to code. The
  first code review found one High caused by reading forgeable typed-array
  metadata; internal-slot admission, pre-copy bounds, and immediate copying
  closed it, and the same reviewer found 0 blocker, 0 high, and 0 medium on
  re-review
notes: This closes only the fixed public-synthetic mixed ordered implementation
  and local ordered-deck-open-save-reopen fact. Human formula-content editing,
  arbitrary mixed stories/templates, the complete same-candidate evidence-to-
  BuildArtifact run, broader fault/platform evidence, and support remain open;
  supportClaimsEnabled is false.
```

### D-031 fixed same-candidate evidence and BuildArtifact closure

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/DECISIONS.md
  - docs/M2-005_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - package.json
  - packages/powerpoint-macos/src/same-candidate-evidence.mjs
  - scripts/run-mixed-same-candidate-delivery.mjs
  - tests/same-candidate-evidence.test.mjs
  - provenance/records.json
kind: additive clean-room readable same-candidate manifest, non-authorizing
  public inspector, fixed trusted-local evidence bridge, exact PDF/raster
  verification, public synthetic adversarial tests, and matching decision/gate
  records
origin: independently authored from D-010/D-029/D-030, the repository-owned
  mixed CandidateBuildRecord and final-delivery contracts, the closed
  PowerPoint compatibility receipt, deterministic visual-evidence relation,
  documented Node.js file/process APIs, and the installed Poppler command-line
  interface. No predecessor or external source, prompt, presentation, PDF, PNG,
  transcript, raw review, build product, or Git history was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-10
license_or_rights_basis: MIT
third_party_dependencies:
  - Microsoft PowerPoint 16.111.3 produced the ignored upstream compatibility
    evidence; this D-031 bridge does not launch PowerPoint
  - Poppler pdftoppm/pdfinfo 26.04.0, optional trusted local verification
    runtime only; not bundled or redistributed
private_information_review: passed; tracked files contain only repository-owned
  synthetic text, public technical identifiers, generic semantic IDs, stable
  repository-relative ignored evidence basenames, and redacted failure codes.
  The PPTX, CandidateBuildRecord sidecar, PowerPoint roundtrip, PDFs, PNGs,
  transcript, pixel review, QaReport, and BuildArtifact remain ignored local
  evidence; no absolute local path, host identity, user deck, private fixture,
  OAuth value, or personal presentation content is admitted
project_constant_removal: passed; source/index/DeckSpec, SlideLayoutIR, and
  ComposedSlidePlan retain semantic and calculation authority. The readable
  manifest records exact delivery relations only. Its public inspector returns
  authority:none and deliveryEligible:false, exports no receipt session, and
  cannot turn caller-authored synthetic bytes into a core receipt. Receipt
  minting exists only inside the fixed trusted-local CLI after its own evidence
  verification; no new serialized root or parallel authority model is added
public_fixture_conformance: applicable; eleven test nodes cover deterministic
  manifest construction, non-authorizing exports/results, exact candidate and
  probe-carrier binding, PDF and pixel drift, complete pixel-review coverage,
  visible-major rejection, accessors, Proxy/shared/resizable storage, explicit
  trust and CI refusal, stable evidence-root use, explicit Poppler paths,
  snapshot rerasterization, exact page counts, same-handle bounded reads, and
  close-before-cleanup source guards. A fresh trusted local prepare/finalize
  rerasterized all six page files and published the exact candidate SHA-256
  ccbffcb1a37d05c533ab92005da308c9b42b8e5cae0a95f66191d0e2d51a2802
  through the existing QaReport/BuildArtifact-last boundary under manifest
  5f9b0c23d3163f8d59385266d5e9f636db7dfd24e72dc45d207b2eb2920a1a42
  and render set
  render-98fd2a63de2af07e02c3de9a1738fb0da7121057fec202152f470c62eefff9ab;
  the complete repository suite passes 1032/1032
independent_review: passed; the first bounded review found one blocker because
  the public module could mint authority from plain caller data, one high
  missing probe-carrier binding, and one medium group in PDF/file/process
  handling. Authority moved into the unexported fixed CLI closure, the carrier
  is exact-bound, and O_NOFOLLOW same-handle reads plus exclusive PDF snapshots,
  exact page/raster checks, and close-settled child handling closed them. The
  final reviewer reports 0 blocker, 0 high, and 0 medium
notes: This closes the complete mechanical/render/pixel/compatibility/QA/
  BuildArtifact chain only for the exact fixed mixed public-synthetic candidate.
  Human formula-content editing, broader mixed/template/fault/platform evidence,
  public CI, and support remain open; supportClaimsEnabled is false.
```

### D-032 fixed formula-content edit observation boundary

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M2-005_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - packages/powerpoint-macos/src/formula-content-edit-evidence.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - scripts/record-omml-formula-content-edit.mjs
  - tests/formula-content-edit-evidence.test.mjs
  - tests/support-matrix.test.mjs
kind: additive clean-room machine-only formula-edit inspector, fixed trusted-
  local human-attestation recorder, public synthetic adversarial tests, and
  matching architecture/decision/gate/support records
origin: independently authored from D-026/D-029/D-031, the repository-owned
  mixed CandidateBuildRecord, the ignored fixed public-synthetic PowerPoint
  derivative, and documented Node.js file/ZIP APIs. No predecessor source,
  external source, private presentation, raw XML, image, prompt, review log,
  build product, or Git history was copied into the repository
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies:
  - Microsoft PowerPoint 16.111.3 produced the ignored edited derivative and
    supplied the application context for the trusted human observation; it is
    not bundled, automated by this slice, or treated as machine proof
private_information_review: passed; tracked files contain only repository-owned
  synthetic text, public technical identifiers, generic semantic IDs, stable
  repository-relative ignored evidence basenames, and fixed digests for the
  repository-owned synthetic candidate relation. The candidate, sidecar,
  edited derivative, feature record, and all PowerPoint artifacts remain ignored
  local evidence; no absolute local path, host identity, private fixture, OAuth
  value, personal presentation content, or raw operator log is admitted
project_constant_removal: passed; the public inspector consumes detached bytes
  and returns machine observations only, with no status, operation, attestation,
  receipt, delivery, or support authority. The fixed trusted-local recorder
  admits only candidate
  ccbffcb1a37d05c533ab92005da308c9b42b8e5cae0a95f66191d0e2d51a2802,
  CandidateBuildRecord
  5a88c576cd37f04b6740b19ee70a2f68a0344166cd3d752dac3882f4611d15c1,
  and edited derivative
  2592ad9da5ec294107ea7b34a56b87f8c2071667843cd14d91df28dad89d28d3;
  those hashes bind exact evidence objects and do not replace the readable
  source/DeckSpec/SlideLayoutIR/ComposedSlidePlan authority chain
public_fixture_conformance: applicable; twelve focused test nodes cover the
  machine-only output boundary, fixed digest admission, alternate self-
  consistent candidate rejection, collateral slide plus unknown-part rejection,
  unknown OMML observation without false closed-grammar claims, candidate-
  record drift, slide loss, Proxy/shared backing rejection, directory/flag/CI
  boundaries, and static absence of delivery authority. The operator explicitly
  attested to PowerPoint 16.111.3 opening, saving, closing, and reopening without
  repair/conversion prompt, displaying `2/3`, and retaining editability. The
  fixed recorder created one ignored passing feature-level COMPAT-OMML-001
  record; the complete repository suite passes 1044/1044
independent_review: passed with 0 blocker and 0 high after closing the first
  review's alternate-candidate admission blocker, generic-inspector authority
  high, unknown-OMML overclaim medium, and pathname-read race. One Medium is
  accepted at the ignored trusted-local output boundary: Node.js has no openat
  equivalent for the final create-only pathname, so wx prevents overwrite and
  post-write directory identity checks detect but cannot prevent a same-
  principal concurrent directory swap
notes: This closes only the exact fixed mixed public-synthetic feature-level
  formula edit observation. It is authority:none and deliveryEligible:false,
  cannot satisfy the exact direct single-slide formula-content receipt, does not
  validate PowerPoint's rewritten output against the closed typed-OMML grammar,
  and changes no support status; supportClaimsEnabled remains false.
```

### M2-005 fixed mixed publication fault closure

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/M2-005_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/THREAT_MODEL.md
  - provenance/records.json
  - tests/receipt-bound-mixed-ordered-final-delivery.test.mjs
kind: additive public-synthetic fault-injection coverage and matching delivery-
  state documentation; no production implementation or public contract changed
origin: independently authored from the existing D-029 shared receipt-bound
  publisher, fixed mixed public-synthetic candidate helper, and its established
  BuildArtifact-last commit contract. No predecessor test, external code,
  presentation, binary, screenshot, prompt, raw review, or build product was
  copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; tests use only repository-owned fictional
  text, runtime-generated public-synthetic archives, opaque test receipts,
  AbortSignal control flow, and isolated temporary directories. No PowerPoint
  file, private fixture, absolute local path, identity, transcript, render, or
  ignored local evidence is loaded or tracked
project_constant_removal: passed; the fixed mixed profile enters the unchanged
  shared publisher. No mixed-only publisher, recovery callback, filesystem
  dependency injection, or second commit-state model was introduced
public_fixture_conformance: applicable; two regressions execute the actual
  three-slide clone/fill -> typed OMML -> native-card preparation. The ninth
  abort-state read occurs after all four stage files and the first three public
  files exist but before BuildArtifact is linked; the test requires complete
  rollback and an empty output root. The tenth read occurs synchronously after
  the BuildArtifact link records committed state; the test requires
  FINAL_DELIVERY_COMMIT_UNCERTAIN, no rollback attempt, and all four final files
  retained. The mixed focus passes 13/13 and the complete repository suite
  passes 1046/1046
independent_review: passed; one bounded read-only review found 0 blocker, 0
  high, and 0 medium. It traced both abort reads through the shared publisher,
  verified the asserted filesystem states, confirmed the read-count checks fail
  hard rather than silently shifting, and found no profile-specific production
  branch or need for a production test hook
notes: This closes publication rollback/commit-uncertain coverage only for the
  exact fixed mixed public-synthetic profile. Broader filesystem/platform fault
  injection, the exact direct-OMML formula-content receipt, arbitrary templates,
  public CI, and every support promotion remain open; supportClaimsEnabled is
  false.
```

### D-033 bounded M2-005 completion decision

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M2-005_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - provenance/records.json
kind: repository-owned scope closure and milestone handoff; no production code,
  public contract, package dependency, support row, or release claim changed
origin: independently authored from the written M2-005 exit criterion and the
  repository's already-recorded public-synthetic M2-005A/B/C/D, D-029, D-030,
  D-031, D-032, and shared publication-fault evidence. No predecessor source,
  external code, presentation, private fixture, prompt, raw review, binary, or
  build product was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; the decision names only repository-owned
  synthetic roles, public technical identifiers, aggregate test/gate counts,
  and bounded review severity counts. It adds no path, identity, transcript,
  private asset, or ignored evidence payload
project_constant_removal: passed; completion is expressed at the readable
  source/DeckSpec/IR/plan and exact fixed public-synthetic flow boundary, not by
  importing a predecessor constant or treating a binary/hash as semantic
  authority
public_fixture_conformance: applicable; the exact fixed three-slide clone/fill
  -> typed OMML -> native-card flow preserves the source, replays the readable
  planning chain, reconstructs and exact-compares the candidate, verifies exact
  package diff and rendered pixels, records ordered PowerPoint compatibility,
  emits QaReport/BuildArtifact, and passes pre/post-commit fault regressions.
  The complete repository suite passes 1046/1046; forbidden-material and
  provenance gates pass 201/201, the 60-row support matrix is consistent, and
  the contract gate passes
independent_review: passed; one bounded milestone-exit review found 0 blocker,
  0 high, and 0 medium and concluded that the exact direct-OMML receipt and
  generalized target-specific ordering are fail-closed follow-on capabilities,
  not blockers to the written assembly milestone
notes: M2-005 is DONE only for the exact fixed mixed public-synthetic vertical
  slice. Direct single-slide OMML delivery, generalized native/OMML ordering,
  arbitrary templates/platforms, release, public CI, and support remain
  unavailable or pending. The next dependency is M3-001.
```

### D-034 first M3-001 CLI vertical slice

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M3-001_HANDOFF.md
  - docs/M3_LINUS_AUDIT.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - package.json
  - packages/cli/src/cli.mjs
  - packages/cli/src/contract-runtime.mjs
  - packages/cli/src/project-io.mjs
  - packages/core/src/json-schema.mjs
  - provenance/records.json
  - scripts/lib/json-schema.mjs
  - scripts/pptx-compiler.mjs
  - tests/cli.test.mjs
kind: additive dependency-free CLI protocol, real secure inspect/read-only
  validate orchestration, relocation of the existing Schema subset into core
  with a compatibility re-export, public-synthetic process tests, and matching
  architecture/decision/gate/support/threat records
origin: independently authored from the existing ProjectContext, secure template
  ingestion, TemplateIndex, contract manifest, bounded Schema evaluator,
  create-only publication rules, documented Node.js file/process APIs, and the
  repository-owned public synthetic fixture. No predecessor implementation,
  external CLI, package, test helper, private fixture, presentation, binary,
  prompt, raw review, or build product was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; runtime output contains the intended
  TemplateIndex or validation result only. Failures serialize a fixed protocol,
  admitted command, boolean status, and safe code/pointer; absolute paths,
  filenames, malformed option/property names, input bytes, XML, exception
  messages, stacks, causes, and environment values are excluded. Tests use only
  isolated temporary roots and repository-owned synthetic bytes
project_constant_removal: passed; CLI inputs and outputs are explicit. The
  implementation has no repository-root discovery, project-specific template,
  slide/shape identifier, fixed candidate, test-helper import, dynamic executor,
  renderer fallback, support override, or private evidence dependency. The
  installation wrapper supplies only the contract root
public_fixture_conformance: applicable; ten process-level tests cover identical
  output across roots/cwd, the exact JSON envelope and 0/1/2 exits, secure
  inspect, read-only validate, create-only conflict, configured output authority,
  archive/content/path redaction, untrusted pointer collapse, fatal malformed-
  UTF-8 rejection before Schema interpretation, explicit deferred-command
  failure, and post-link commit uncertainty with the linked file retained. The
  focused suite passes 10/10 and the complete repository suite passes 1056/1056
independent_review: passed; the bounded review initially found two highs and one
  medium: untrusted option/property reflection, post-link fsync misclassification,
  and replacement-decoded malformed UTF-8. Safe pointer collapse, explicit
  CLI_OUTPUT_COMMIT_UNCERTAIN, fatal TextDecoder, and direct regressions closed
  all three. Final re-review reports 0 blocker, 0 high, and 0 medium
notes: M3-001 remains IN PROGRESS. Only inspect and validate are implemented;
  init, doctor, onboard, render, qa, and diff return unavailable. This grants no
  render, delivery, package, release, or support claim. The required Linus-style
  M3 scope audit is completed separately in D-035 before further feature work.
```

### D-035 M3 Linus audit and candidate-alpha correction

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M3-001_HANDOFF.md
  - docs/M3_LINUS_AUDIT.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - provenance/records.json
kind: repository-owned planning audit and milestone-order correction; no
  production code, public contract, package dependency, support row, or release
  claim changed
origin: independently authored from the current D-034 CLI implementation,
  normative project/candidate/QA authorities, machine support matrix,
  compatibility policy, release gates, and one bounded read-only independent
  challenge. No predecessor source, external code, presentation, private
  fixture, prompt, raw review, binary, or build product was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; the audit contains only repository-relative
  paths, public technical concepts, milestone IDs, and aggregate review severity
  counts. It contains no private path, fixture identity, presentation content,
  account choice, environment value, transcript, or ignored evidence payload
project_constant_removal: passed; the corrected plan is expressed through the
  existing readable ProjectConfig/Profile/Index/Registry/Overlay/DeckSpec,
  CandidateBuildRecord, QaReport, BuildArtifact, and normative support
  relationships. It adds no fixed deck/shape identifier, digest authority,
  GenerationIntent, serialized plan, or second QA/diff model
public_fixture_conformance: not-applicable; this audit changes no executable
  surface or status. It requires the future exact public-synthetic native-card
  candidate dependency closure to be reviewed and promoted together to
  experimental before render, with explicit opt-in and the false global support
  switch retained
independent_review: passed for planning challenge; one bounded read-only review
  reported 3 blocker, 3 high, and 2 medium planning findings. D-035 incorporates
  the support-authorization, QA-semantics, repository/CI-cycle, validate-scope,
  command-breadth, render-order, ownership, and documentation corrections, plus
  the main audit's redundant inspect-output and missing binding-metadata findings
notes: D-034 remains the last implemented slice. The next implementation is the
  on-disk public-synthetic project spine and whole-project validation, not
  render. The release target is a candidate alpha; blocked QA creates no
  BuildArtifact. Auxiliary command breadth and delivery alpha are deferred.
```

### D-036 M3-001 public-synthetic project spine

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M3-001_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - packages/cli/src/cli.mjs
  - packages/cli/src/contract-runtime.mjs
  - packages/cli/src/static-host.mjs
  - packages/core/src/project-dispatch-resolver.mjs
  - packages/public-synthetic/src/fixtures.mjs
  - packages/public-synthetic/src/project.mjs
  - plugins/native-card-arrow/src/registration.mjs
  - provenance/records.json
  - scripts/generate-synthetic-fixtures.mjs
  - tests/cli.test.mjs
kind: additive production public-synthetic bootstrap, explicit document/project
  CLI validation, fixed static native-card registration, complete readable
  project resolver boundary, exact bootstrap fault states, compatibility
  re-export, public process/mutation evidence, and matching authority/security/
  release records
origin: independently authored from D-035, the existing repository-owned text
  OOXML fixture producer, ProjectConfig/ProjectContext/TemplateIndex contracts,
  secure ingestion, capability runtime and resolver, native-card artifacts,
  normative support matrix, and documented Node.js file APIs. No predecessor
  source/history, external implementation, private fixture, presentation,
  screenshot, prompt, raw review, binary, or build product was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; inputs and outputs contain only the
  repository-owned public-synthetic preset and explicit user-selected paths.
  Runtime failures expose fixed codes/pointers only; project paths, filenames,
  JSON values, source bytes, XML, exception messages, stacks, causes, temporary
  names, and environment values are not serialized
project_constant_removal: passed; the fixed preset is explicitly conformance-
  only and lives in a production package. The CLI has no tests/ or testing-
  package import, dynamic plugin/schema/support selection, generic binding
  inference, renderer helper, candidate helper, private evidence, or ambient
  project root. ProjectConfig owns the sole TemplateIndex output path
public_fixture_conformance: applicable; nineteen CLI tests cover deterministic
  schema-valid bootstrap bytes, create-only conflict, unavailable preset before
  mutation, pre-marker rollback-complete, rollback-incomplete reconciliation,
  marker-sync commit uncertainty, configured inspect, explicit document/project
  meanings, complete static-host preflight, registration versus project
  execution reporting, source/index staleness, identity drift, normative opt-in,
  no project output, fatal UTF-8, redaction, and stable protocol exits. The
  focused runtime/resolver/native/support/fixture set passes 263/263 and the
  complete repository suite passes 1065/1065
independent_review: passed; the bounded review initially found two highs and one
  medium: an inaccurate bootstrap commit-state model, a testing package in the
  production composition root, and ambiguous executor-execution reporting.
  Exact three-state fault handling, the production public-synthetic package,
  explicit result fields, and three new fault regressions closed every finding;
  final re-review reports 0 blocker, 0 high, and 0 medium
notes: M3-001 remains IN PROGRESS. D-036 grants no candidate render, QA,
  BuildArtifact, package, release, arbitrary-project, or support authority. The
  next slice must enumerate and promote the complete exact one-slide native-card
  render dependency closure in the same reviewed change before mutation.
```

### D-037 M3-001 exact public-synthetic candidate render

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M3-001_HANDOFF.md
  - docs/M3_LINUS_AUDIT.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - packages/cli/src/cli.mjs
  - packages/cli/src/project-io.mjs
  - packages/cli/src/static-host.mjs
  - packages/core/src/candidate-pair-publication.mjs
  - packages/core/src/native-card-candidate-publication.mjs
  - packages/core/src/native-presentation-publication.mjs
  - packages/core/src/secure-template-ingestion.mjs
  - packages/public-synthetic/src/project.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - tests/cli.test.mjs
  - tests/native-card-arrow-assembly.test.mjs
  - tests/secure-template-ingestion.test.mjs
  - tests/support-matrix.test.mjs
kind: additive exact-profile CLI candidate rendering, readable full-index
  authority, same-read source binding, semantic-slot geometry, typed one-shot
  assembly, three-state candidate-pair publication, normative support closure,
  public synthetic tests, and matching architecture/security/release records
origin: independently authored from D-035/D-036, the repository-owned text-only
  POTX fixture and readable TemplateIndex golden, existing ProjectConfig/Profile/
  Registry/Overlay/DeckSpec contracts, secure ingestion, pure slot resolver,
  native-card registration/typed applicator, CandidateBuildRecord writer, and
  normative support matrix. No predecessor source/history, external code,
  private fixture, presentation, prompt, raw review, binary, or build product
  was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; production files, tests, and public records
  contain repository-owned synthetic identities and public format terms only.
  Ignored local PPTX/PNG evidence, absolute paths, PowerPoint state, host facts,
  temporary names, exception details, and the pixel review payload are not
  admitted to Git or CLI output
project_constant_removal: passed; the only fixed identities belong to the
  explicitly named public-synthetic conformance profile. User input cannot
  choose an installation artifact, executor, schema, support resolver, output
  path, template grammar, or private evidence. The recursive production import
  graph imports no tests, labs, clone/fill helper, OMML/ordered implementation,
  PowerPoint adapter, or conformance-only policy
public_fixture_conformance: applicable; twenty-five CLI tests cover the exact
  15-row invariant closure, runtime/evidence rows, unsupported Node rejection,
  stable source/index binding, complete readable-index match, fresh one-shot
  execution, semantic geometry, deterministic candidate/record bytes, record
  replay, occupancy, source immutability, create-only conflict, and absence of
  QaReport/BuildArtifact. Publication fault injection covers not-committed,
  rollback-incomplete, and commit-uncertain states; the D-037 focused set passes
  180/180 and the complete suite passes 1076/1076 on Node 22
independent_review: passed. The first review
  found one medium transitive-dependency defect: the exact CLI imported the
  broad native/OMML/ordered publisher while its direct-source scan missed that
  closure. Publication mechanics and native-card authentication are now split,
  and the regression walks the complete static import graph. The same reviewer
  confirmed the old API/error identity and three-state semantics and reported
  0 blocker, 0 high, and 0 medium. A separate frozen-pixel verification agent
  reported no blocker, high, medium, or low visual finding; that pixel-only
  result is non-generating and non-authorizing
notes: exactly fifteen invariant matrix rows are promoted to experimental,
  bringing the unchanged 60-row matrix to 0 supported / 22 experimental / 3
  manual / 35 unsupported. supportClaimsEnabled remains false. M3-001 is still
  in progress; candidate success is not QA or delivery, and the next slice is a
  schema-valid blocked QaReport with no BuildArtifact when evidence is absent
```

### D-038 M3-001 honest blocked QA

```yaml
paths:
  - HANDOFF.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M3-001_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - packages/cli/src/cli.mjs
  - packages/cli/src/contract-runtime.mjs
  - packages/cli/src/project-io.mjs
  - packages/cli/src/static-host.mjs
  - packages/core/src/native-card-candidate-publication.mjs
  - packages/core/src/native-card-candidate-qa.mjs
  - packages/public-synthetic/src/project.mjs
  - policy/support-matrix.json
  - provenance/records.json
  - tests/cli.test.mjs
  - tests/native-card-arrow-assembly.test.mjs
  - tests/support-matrix.test.mjs
kind: additive exact-candidate QA calculation, stable contained binary reads,
  shared authenticated candidate/record projection, fixed blocked QaReport,
  manual-gate support validation, adversarial public tests, and matching
  architecture/security/release records
origin: independently authored from D-035/D-037, the existing readable project
  contracts, semantic-slot and one-shot native-card derivation, canonical
  CandidateBuildRecord, QaReport 0.1.0 Schema, contained create-only JSON I/O,
  and normative support matrix. No predecessor source/history, external code,
  private fixture, screenshot, presentation, PowerPoint transcript, prompt,
  review payload, binary, or build product was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; production code and tracked records contain
  only fixed public-synthetic identifiers, generic contract fields, stable
  codes/pointers, and public format terms. Candidate bytes, local evidence,
  absolute paths, temporary roots, exception messages, and review payloads are
  not committed or emitted
project_constant_removal: passed; fixed identities are limited to the named
  public-synthetic conformance profile. The command cannot accept a support
  override, evidence path, output path, checks/gates array, BuildArtifact, or
  alternate renderer, and its recursive production graph excludes labs, tests,
  PowerPoint, final delivery, OMML, and ordered-deck implementations
public_fixture_conformance: applicable; thirty-three CLI tests cover complete
  init/inspect/render/qa execution, full schema-valid output, deterministic
  report bytes, ignored-evidence independence, missing/tampered/stale/
  oversized/symlinked input rejection, create-only publication, human output,
  and no BuildArtifact. Core tests cover exact input shape, deep freezing,
  validator mutation/failure/rejected Promise handling, intrinsic Buffer bounds,
  and byte tampering. The QA focus passes 99/99 and the complete Node 22 suite
  passes 1085/1085. Forbidden-material and provenance gates each cover all 216
  admitted working-tree files, the 60-row support gate passes, and the contract
  gate reports no finding
independent_review: passed; the initial bounded review found one high report-
  mutation boundary and two medium pre-copy-resource/rejected-Promise defects.
  Freeze-before-validation, the intrinsic typed-array byte-length getter,
  synchronous rejection consumption, and exact regressions closed all three;
  re-review reports 0 blocker, 0 high, and 0 medium
notes: D-038 closes M3-001's exact candidate-alpha product spine with a blocked
  assessment, not a QA pass or delivery grant. The 60-row matrix remains
  0 supported / 22 experimental / 3 manual / 35 unsupported,
  supportClaimsEnabled remains false, and packaging/release work starts at
  M3-002
```

### D-039 M3-002 guarded alpha package definition

```yaml
paths:
  - .gitignore
  - HANDOFF.md
  - README.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M3-002_HANDOFF.md
  - docs/NAME_AVAILABILITY.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/THREAT_MODEL.md
  - package.json
  - packaging/alpha-package-plan.json
  - packages/cli/bin/pptx-compiler.mjs
  - packages/cli/src/cli.mjs
  - packages/cli/src/contract-runtime.mjs
  - packages/cli/src/index.mjs
  - packages/cli/src/installed.mjs
  - packages/cli/src/static-host.mjs
  - packages/cli/types/index.d.ts
  - packages/core/src/candidate-alpha.mjs
  - packages/core/src/extension-api.mjs
  - packages/core/src/package-assets.mjs
  - packages/core/types/candidate-alpha.d.ts
  - packages/core/types/contracts.d.ts
  - packages/core/types/extension-api.d.ts
  - packages/public-synthetic/src/index.mjs
  - packages/public-synthetic/src/package-assets.mjs
  - packages/public-synthetic/src/project.mjs
  - packages/public-synthetic/types/index.d.ts
  - packages/public-synthetic/types/project.d.ts
  - plugins/native-card-arrow/src/index.mjs
  - plugins/native-card-arrow/src/native-card-arrow.mjs
  - plugins/native-card-arrow/src/package-assets.mjs
  - plugins/native-card-arrow/src/registration.mjs
  - plugins/native-card-arrow/types/index.d.ts
  - plugins/native-card-arrow/types/registration.d.ts
  - policy/forbidden-materials.json
  - provenance/records.json
  - scripts/check-package-plan.mjs
  - scripts/lib/package-plan.mjs
  - tests/cli.test.mjs
  - tests/native-card-arrow.test.mjs
  - tests/package-plan.test.mjs
  - tests/policy-gates.test.mjs
kind: additive guarded four-package definition, exact positive source-to-stage
  mapping, narrow runtime/type facades, package-owned resource descriptors,
  installed CLI resource composition, fail-closed import/dependency analysis,
  fixed ignored stage reservation, and matching architecture/security/release
  records
origin: independently authored from the existing M3-001 candidate-alpha spine,
  public repository contracts and fixtures, public Node.js package semantics,
  and the official npm registry name lookup. No predecessor source/history,
  external package source, private fixture, presentation, prompt, review log,
  binary, tarball, or build product was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; planned contents and tracked records contain
  repository-relative public paths and synthetic identities only. The fixed
  stage is ignored, and local installation roots, host facts, package-manager
  caches, tarballs, logs, credentials, and private compatibility evidence are
  excluded
project_constant_removal: passed; the package graph, names, exports, types,
  executable bin, import aliases, dependency edges, required asset targets,
  runtime declarations, and release blockers are validated as one exact alpha
  profile. Synchronized drift cannot evade the validator. The exact staged
  `.mjs` graph has parser-proven static ESM closure; direct loader/codegen
  rejection is reviewed-source hardening, not a malicious-JavaScript sandbox
public_fixture_conformance: applicable; package-plan tests cover the exact four-
  package graph, positive mappings, narrow exports, required assets, executable
  bin, repository-URL guard, import closure, target aliases, dependency cycles,
  undeclared and unused internal edges, forbidden implementation closure,
  static ESM grammar variants, reviewed direct dynamic/CommonJS loader forms,
  fake builtins, and line-terminator/comment evasions. CLI execution also proves explicit package resources through
  init/inspect/validate/render/blocked-QA without a BuildArtifact
independent_review: passed; the first bounded review found one high validator-
  profile gap and one medium hidden-loader gap. Exact immutable package
  profiles, required targets, builtin validation, trivia-aware loader scanning,
  and adversarial synchronized-drift/comment/line-terminator regressions closed
  them. The final re-review reports 0 blocker, 0 high, and 0 medium
notes: D-039 freezes package-definition authority only. It makes no tarball,
  clean-install, publication, repository, release, or support claim. M3-003 has
  since materialized and verified that plan locally; D-039 itself remains only
  the package-definition decision
```

### D-040 M3-003 guarded tarball and fixed-stage boundary

```yaml
paths:
  - .gitignore
  - AGENTS.md
  - HANDOFF.md
  - README.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M3-003_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/THREAT_MODEL.md
  - package.json
  - scripts/build-alpha-packages.mjs
  - scripts/lib/package-plan.mjs
  - scripts/lib/package-stage.mjs
  - scripts/lib/package-tarball.mjs
  - tests/package-stage.test.mjs
kind: additive retained-control package materialization, canonical tgz admission,
  recoverable fixed-stage transaction, offline four-package installation,
  installed-bin candidate-alpha execution, and readable ignored evidence
origin: independently authored from D-039's exact public package plan, the
  repository's existing forbidden-material policy and candidate-alpha CLI,
  documented npm pack semantics, Node.js standard-library APIs, and executable
  mutation/recovery evidence. No predecessor source/history, external package
  source, private fixture, presentation, prompt, review log, archive, or build
  product was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies:
  - npm CLI 10.x or 11.x supplied by the admitted Node installation; invoked as
    a constrained offline tool and neither vendored nor redistributed
private_information_review: passed; tracked code, tests, and records contain
  only repository-relative paths, public package identities, fictional fixture
  content, stable error codes, and aggregate evidence. Fixed-stage manifests,
  tgz files, caches, installations, smoke projects, command output, runtime
  paths, and digest values remain ignored
project_constant_removal: passed; one readable plan/control/source snapshot is
  authoritative. The fixed four-package alpha profile is intentional D-039
  scope, while archive members, modes, ordering, installed files, CLI commands,
  recovery states, and evidence are derived and exact-validated rather than
  rediscovered from a host workspace
public_fixture_conformance: applicable; 22 focused tests cover exact leaf
  manifests, real tgz bytes, canonical gzip/ustar structure and limits,
  forbidden content, retained-byte replacement, plan/policy/.gitignore/source
  drift, exact installed package/bin/project inventories, interrupted recovery,
  same-PID Worker exclusion, dead partial claims, completion corruption,
  pre-marker last-good restoration, unowned owner-candidate preservation,
  occupied-quarantine preservation, FileProvider-style empty debris, unknown
  directories/files/links and expected-name type substitutions, redaction, and
  the complete installed CLI spine. The Node 22.23.2 repository suite passes
  1129/1129 and the actual build passes with npm 10.9.8
independent_review: passed; bounded reviewers found and executable regressions
  closed gzip/tar metadata channels, inspected-versus-published byte drift,
  control/source TOCTOU, weak completion markers, broken crash recovery,
  same-PID lock theft, partial claims, installed inventory gaps, POSIX directory-
  barrier ordering, observed conflict-directory debris, name-based recursive
  deletion, pre-owner candidate cleanup, occupied-quarantine loss, the
  pre-marker last-good recovery gap, and missing cleanup-directory fsync
  barriers. Final review reports no remaining blocker or high finding
notes: D-040 closes only the local implementation half of the package gate.
  Foreign live-PID reuse and a dead Worker under a live host remain conservative
  availability residuals. `failed` is a persistent rename-only quarantine, and
  npm cache/config/tmp remain ignored non-authoritative state. Public three-
  platform CI, repository metadata, reviewed-to-published identity, signing,
  SBOM, registry provenance, and release authority remain later M3/M4 work.
  D-045/M3-006 later reran and passed the full repository-bound package gate;
  first-ref, hosted, and release evidence remain later work
```

### D-041 M3-004A local public-workflow and release-metadata contract

```yaml
paths:
  - .github/workflows/ci.yml
  - .github/workflows/security.yml
  - AGENTS.md
  - HANDOFF.md
  - README.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M1-002_HANDOFF.md
  - docs/M1-003_HANDOFF.md
  - docs/M2-001_HANDOFF.md
  - docs/M3-003_HANDOFF.md
  - docs/M3-004_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/SUPPORT_MATRIX.md
  - docs/THREAT_MODEL.md
  - package-lock.json
  - package.json
  - policy/forbidden-materials.json
  - policy/support-matrix.json
  - provenance/records.json
  - sbom.alpha.cdx.json
  - scripts/build-alpha-packages.mjs
  - scripts/check-forbidden-materials.mjs
  - scripts/check-public-workflows.mjs
  - scripts/check-release-metadata.mjs
  - scripts/check-source-policy.mjs
  - scripts/lib/package-plan.mjs
  - scripts/lib/package-stage.mjs
  - scripts/lib/public-workflows.mjs
  - scripts/lib/release-metadata.mjs
  - scripts/lib/source-policy.mjs
  - tests/package-plan.test.mjs
  - tests/package-stage.test.mjs
  - tests/policy-gates.test.mjs
  - tests/public-workflows.test.mjs
  - tests/release-metadata.test.mjs
  - tests/source-policy.test.mjs
  - tests/types/alpha-public-api.ts
  - tsconfig.public.json
kind: additive exact public-workflow definition, one locked dev-only declaration
  checker, canonical source-byte policy, readable license/provenance closure,
  deterministic alpha static-ESM SBOM projection, package/install-authority
  maintenance, and local mutation evidence
origin: independently authored from D-039/D-040, the existing exact package
  plan and release gates, public GitHub Actions workflow semantics, TypeScript's
  published compiler contract, CycloneDX 1.6, Node.js standard-library APIs,
  and executable local mutations. No predecessor source/history, external
  workflow, action source, compiler source, private fixture, presentation,
  prompt, transcript, binary, package artifact, or hosted-run output was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies:
  - TypeScript 6.0.2; Apache-2.0; exact dev-only declaration checker locked from
    the public npm registry; neither bundled into nor redistributed with an
    alpha runtime package
  - actions/checkout v7.0.1 at
    3d3c42e5aac5ba805825da76410c181273ba90b1; MIT; pinned remote CI action,
    not vendored
  - actions/dependency-review-action v5.0.0 at
    a1d282b36b6f3519aa1f3fc636f609c47dddb294; MIT; pinned remote CI action,
    not vendored
  - actions/setup-node v7.0.0 at
    820762786026740c76f36085b0efc47a31fe5020; MIT; pinned remote CI action,
    not vendored
  - github/codeql-action v4.37.6 at
    5595ccaf912efad79be6eef63a5619ff05969be3; MIT; pinned remote CI action,
    not vendored
private_information_review: passed; tracked workflow, toolchain, type-consumer,
  source-policy, license, SBOM, tests, and records contain only public package,
  action, runner, version, license, repository-relative path, and fictional
  synthetic facts. Secrets, credentials, private fixtures, absolute paths,
  caches, install trees, ignored evidence, workflow logs, and hosted artifacts
  are neither inputs nor tracked outputs
project_constant_removal: passed; existing readable owners remain authoritative.
  The package plan owns the four-package runtime graph, package.json/lock own the
  one dev tool, declarations own the public type surface, provenance and LICENSE
  own redistribution facts, and Git owns admitted source paths. The workflow
  module owns only two exact YAML byte strings and their fixed policy. No general
  YAML parser, second package/license graph, home-grown type checker, dev SBOM,
  binary hash authority, private runner, cache, or publication path was added
public_fixture_conformance: applicable; 104/104 combined focused nodes pass on
  local Node 22.23.2 and 24.19.0: 15 workflow, 23 release-metadata, 3 source-
  policy, 26 package-plan, and 37 policy-gate nodes. They cover canonical
  workflows and direct-main aliases, preinstall authority, lifecycle shadows,
  root/lock/import/script canonicality, representative public types, static ESM
  grammar and staged-target closure, reviewed direct loader/codegen hardening,
  shrinkwrap/Git-mode admission, exact CycloneDX edges, source bytes, and Git
  paths. Each runtime also passes the complete 1180/1180 suite and a real four-
  tarball pack/install/installed-CLI smoke with its own bundled npm (10.9.8 and
  11.17.0). The real TypeScript 6.0.2 consumer, workflow/source/release/package
  gates, 260-file forbidden/provenance gates, 60-row support gate, contracts,
  and tracked-drift check pass
independent_review: passed; bounded independent review of the implemented
  M3-004A contracts found concrete workflow/install authority, no-op typecheck,
  Windows path/mode/fsync, lock/toolchain/root graph, public-type coverage,
  static-import grammar, staged-target, and overbroad runtime-closure statement
  risks. Exact controls, parser-proven static ESM scope, direct hazard hardening,
  compiler consumer, and mutations close at 0 blocker, 0 high, and 0 medium.
  This review did not observe or approve a public workflow run
notes: D-041 closes M3-004A's local definition and verification only. It does
  not claim any Linux, Windows, or hosted macOS runner result, CodeQL analysis,
  Dependency Review result, public repository, registry provenance, package
  publication, signing, malicious-JavaScript sandbox, or release authority.
  The dependency proof is limited to parser-proven static ESM edges; direct
  loader/codegen checks are reviewed-source hardening. M3-006 must first create the
  selected public remote and refresh repository-bound package bytes; M3-004B
  must then retain the six hosted CI cell URLs and hosted security conclusions
```

### M3-005A minimum public-document boundary

```yaml
paths:
  - AGENTS.md
  - CONTRIBUTING.md
  - GOVERNANCE.md
  - HANDOFF.md
  - README.md
  - SECURITY.md
  - TODO.md
  - docs/COMPATIBILITY_POLICY.md
  - docs/DECISIONS.md
  - docs/M3-003_HANDOFF.md
  - docs/M3-004_HANDOFF.md
  - docs/M3-005_HANDOFF.md
  - docs/OPEN_SOURCE_READINESS.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/REPRODUCIBILITY.md
  - docs/SUPPORT_MATRIX.md
  - policy/support-matrix.json
  - provenance/records.json
  - scripts/check-forbidden-materials.mjs
  - tests/policy-gates.test.mjs
  - tests/pre-public-docs.test.mjs
kind: additive minimum pre-public security, contribution, governance,
  reproduction, and current-state documentation plus fail-closed content-rule
  configuration
origin: independently authored from the M3-005A release dependency, existing
  clean-room/MIT/support/release authorities, D-041's canonical workflow, and
  GitHub's public private-vulnerability-reporting and repository REST contracts.
  No predecessor material, external community template, private report, email,
  account, presentation, binary, or hosted-run output was copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; files contain only approved public project
  metadata, repository-relative links, generic contribution/governance rules,
  the canonical public-safe command sequence, the repo-native first-ref rule,
  and synthetic runtime-constructed policy mutations. No contact address,
  private fixture, local path, credential, report content, or ignored artifact
  is admitted
project_constant_removal: passed; existing owners remain authoritative. The
  workflow and package scripts own machine commands, the support matrix owns
  claims, release gates own release conditions, each minimum user document owns
  one human process, and the GitHub setting owns actual channel state. No second
  contact authority, support table, command graph, committee, quorum, SLA, CLA,
  DCO, or temporary-root scheme is introduced
public_fixture_conformance: applicable; the focused policy suite passes 41/41
  and the document suite passes 14/14. Content rules reject every path-exception
  representation, the reproduction command block exact-matches the canonical
  workflow, and channel/privacy/routing/authority mutations fail closed. The
  fixed non-FileProvider copy passes the 1198-node complete suite, 124-file
  source gate, and guarded package build under both Node 22.23.2/npm 10.9.8 and
  Node 24.19.0/npm 11.17.0. Public-workflow, release, package-plan, support,
  contracts, forbidden-material, and diff gates pass on the completed local
  document tree
independent_review: passed; the bounded final security, provenance, and state
  reviews close at 0 blocker, 0 high, and 0 medium after the repository-bound
  package-regeneration transition was made explicit before the first source ref
notes: D-042 completes only the local M3-005A document definition. No public
  remote, active private-vulnerability-reporting setting, hosted CI/security
  result, package publication, support promotion, or release is claimed.
  M3-006 owns empty-public-repository creation, positive channel activation and
  verification, repository-bound package regeneration, and the first source
  push; M3-005B remains blocked until public M3-004B evidence exists
```

### M3-006 local reachable-history preflight

```yaml
paths:
  - AGENTS.md
  - HANDOFF.md
  - TODO.md
  - docs/DECISIONS.md
  - docs/M3-006_HANDOFF.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - provenance/records.json
  - scripts/check-forbidden-materials.mjs
  - tests/policy-gates.test.mjs
kind: additive first-public reachable-history admission mode, exact-ref launch
  state machine, mutation evidence, and current-state routing
origin: independently authored from the observed first-push visibility of all
  main ancestors, the existing forbidden-material policy and D-003 public Git
  identity authority, plus Git's public commit/tree/ref object model. No
  predecessor history, external checker source, account name, repository slug,
  token, remote response, private asset, presentation, or ignored output was
  copied
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; the implementation and documentation use
  only repository-relative paths, public Git vocabulary, fixed resource limits,
  generic remote transitions, aggregate history counts, and runtime-generated
  synthetic mutation identities. Reports never echo the configured public Git
  identity or matched forbidden text
project_constant_removal: passed; the current forbidden policy remains the one
  path/content/magic/identity authority, `refs/heads/main` is the exact pushed
  graph, raw commit parent/tree OIDs own reachability, and the final remote owns repository/PVR
  facts. No second scanner, history manifest, digest ledger, temporary checkout,
  repository identity, or publication token is introduced
public_fixture_conformance: applicable; the policy focus passes 49/49. Eight
  history nodes cover byte-stable positive output, a committed-then-deleted
  forbidden path under tip-policy authority, repository/common-directory and
  case-variant environment redirection, closed/non-disclosing tree grammar and
  quiet fsck, non-disclosing commit-message rejection, exact author/committer
  drift, deleted symlink mode, and deleted oversized content. The current non-
  shallow main scans 13 commits, 286 unique leaf-entry versions, 3,677,606
  regular-blob bytes, and 26 identity occurrences with zero
  finding; broader read-only ref/object/token/path checks and `git fsck --strict`
  also pass
independent_review: passed; bounded reviewers first found repository-selection,
  transient-shallow reachability, raw-tree grammar, and local fsck-downgrade
  failures. The fixed raw-parent traversal, exact tree-byte grammar, sanitized
  Git environment, and forced-error fsck configuration were independently
  replayed under Node 22/24 and close at 0 blocker, 0 high, and 0 medium
notes: D-043 closes only the local repeatable history-preflight definition.
  D-044 now records the exact GitHub target and approved public identity.
  M3-006 remains NEXT until the empty public/PVR/repository-bound package
  transitions pass, the final commit is rescanned, and that exact object ID
  alone is pushed
```

### D-044 pre-public identity migration

```yaml
paths:
  - .env.example
  - AGENTS.md
  - CONTRIBUTING.md
  - HANDOFF.md
  - README.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M2-002_HANDOFF.md
  - docs/M2-003_HANDOFF.md
  - docs/M3-002_HANDOFF.md
  - docs/M3-006_HANDOFF.md
  - docs/NAME_AVAILABILITY.md
  - docs/PROJECT_DEFINITION.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - fixtures/capabilities/dispatcher-contract-probe/input.schema.json
  - fixtures/capabilities/dispatcher-contract-probe/output.schema.json
  - fixtures/capabilities/dispatcher-contract-probe/registry.json
  - fixtures/capabilities/formula-transplant/registry.json
  - fixtures/capabilities/native-card-arrow/registry.json
  - fixtures/capabilities/source-slide-clone-fill/registry.json
  - fixtures/contracts/valid/capability-registry.json
  - fixtures/contracts/valid/qa-report.json
  - labs/visual-review-agent/report.schema.json
  - labs/visual-review-agent/review-v2.schema.json
  - package-lock.json
  - package.json
  - packages/adapter-pandoc-omml/schemas/input.schema.json
  - packages/adapter-pandoc-omml/schemas/output.schema.json
  - packages/cli/bin/pptx-compiler.mjs
  - packages/cli/src/cli.mjs
  - packages/cli/src/contract-runtime.mjs
  - packages/cli/src/installed.mjs
  - packages/cli/src/static-host.mjs
  - packages/core/src/capability-dispatcher.mjs
  - packages/core/src/native-card-arrow-assembly.mjs
  - packages/core/src/native-omml-formula-assembly.mjs
  - packages/core/src/project-dispatch-resolver.mjs
  - packages/core/src/receipt-bound-final-delivery.mjs
  - packages/public-synthetic/src/project.mjs
  - packages/public-synthetic/types/index.d.ts
  - packaging/alpha-package-plan.json
  - plugins/clone-fill/schemas/input.schema.json
  - plugins/clone-fill/schemas/output.schema.json
  - plugins/native-card-arrow/schemas/input.schema.json
  - plugins/native-card-arrow/schemas/output.schema.json
  - plugins/native-card-arrow/src/native-card-arrow.mjs
  - plugins/native-card-arrow/src/registration.mjs
  - plugins/native-card-arrow/types/index.d.ts
  - policy/forbidden-materials.json
  - provenance/records.json
  - sbom.alpha.cdx.json
  - schemas/contracts/build-artifact.schema.json
  - schemas/contracts/candidate-build-record.schema.json
  - schemas/contracts/capability-registry.schema.json
  - schemas/contracts/deck-spec.schema.json
  - schemas/contracts/manifest.json
  - schemas/contracts/project-config.schema.json
  - schemas/contracts/project-overlay.schema.json
  - schemas/contracts/qa-report.schema.json
  - schemas/contracts/shared.schema.json
  - schemas/contracts/template-index.schema.json
  - schemas/contracts/template-profile.schema.json
  - schemas/provenance-record.schema.json
  - schemas/support-matrix.schema.json
  - scripts/check-contracts.mjs
  - scripts/check-provenance.mjs
  - scripts/check-support-matrix.mjs
  - scripts/inspect-synthetic-fixture.mjs
  - scripts/lib/package-plan.mjs
  - scripts/lib/package-stage.mjs
  - scripts/lib/public-workflows.mjs
  - scripts/lib/release-metadata.mjs
  - scripts/pptx-compiler.mjs
  - scripts/record-omml-formula-content-edit.mjs
  - scripts/run-mixed-same-candidate-delivery.mjs
  - scripts/run-ordered-powerpoint-compatibility.mjs
  - tests/candidate-build-record.test.mjs
  - tests/capability-dispatcher.test.mjs
  - tests/cli.test.mjs
  - tests/contracts.test.mjs
  - tests/native-card-arrow.test.mjs
  - tests/ordered-powerpoint-compatibility.test.mjs
  - tests/package-plan.test.mjs
  - tests/package-stage.test.mjs
  - tests/pandoc-omml-adapter.test.mjs
  - tests/policy-gates.test.mjs
  - tests/project-context.test.mjs
  - tests/receipt-bound-final-delivery.test.mjs
  - tests/receipt-bound-mixed-ordered-final-delivery.test.mjs
  - tests/receipt-bound-omml-final-delivery.test.mjs
  - tests/receipt-bound-ordered-final-delivery.test.mjs
  - tests/release-metadata.test.mjs
  - tests/secure-template-ingestion.test.mjs
  - tests/source-slide-clone-fill.test.mjs
  - tests/template-inspector.test.mjs
  - tests/types/alpha-public-api.ts
  - tests/visual-review-agent-v2.test.mjs
  - tests/visual-review-agent.test.mjs
  - tsconfig.public.json
kind: atomic pre-public repository, package, CLI, import, project-file, SBOM,
  and serialized-contract identity migration with no compatibility aliases
origin: independently derived from the user's explicit `pptx-compiler`
  selection, the existing D-039 four-package graph, D-043 first-ref boundary,
  current repository-owned sources/contracts, and read-only GitHub/npm
  availability checks. No predecessor source, external implementation, remote
  content, package, asset, presentation, or generated binary was imported
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-11
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; the migration changes only approved public
  product identifiers and dated public availability facts. It adds no token,
  credential, private path, hostname, private fixture, source presentation,
  ignored build output, or new personal identity value
project_constant_removal: passed; every active public identity uses the single
  `pptx-compiler` stem. Neutral package IDs, error codes, protocol versions,
  directories, and the local workspace path are unchanged. The prior stem is
  retained only in dated D-001/D-012/query history and in the pre-existing
  ignored package-stage owner/plan ID plus transaction prefixes required to
  recognize crash state; those are not public aliases
public_fixture_conformance: applicable; Node 22.23.2 and Node 24.19.0 each pass
  the 1206-node complete suite in the fixed non-FileProvider copy. npm 10.9.8
  and 11.17.0 each build and independently admit the four renamed canonical
  tarballs, install them together offline, and execute the installed
  `pptx-compiler` init/inspect/validate/render/qa spine with blocked QA and no
  BuildArtifact. Package-plan, release, workflow, source, contract, typecheck,
  forbidden, provenance, and diff gates are rerun after final review
independent_review: passed; two bounded read-only current-byte closing reviews
  report 0 blocker, 0 high, and 0 medium. They independently confirmed the
  exact 101-path ledger/record set, the single active public identity, package
  and contract projections, file modes, and the stable stage-recovery boundary
notes: At D-044 closure, `why7682/pptx-compiler` had no remote or source ref.
  The exact GitHub target and all four npm names were absent in dated read-only
  checks, which reserve nothing. D-045 later created only the empty public
  shell, verified private vulnerability reporting, and bound its canonical
  identity. M3-006 has since closed the repository-bound dual-runtime package
  gate and still owns the local commit/history scan and exact-object-ID first
  push
```

### D-045 empty public shell and repository-bound package authority

```yaml
paths:
  - AGENTS.md
  - HANDOFF.md
  - README.md
  - TODO.md
  - docs/ARCHITECTURE_TARGET.md
  - docs/DECISIONS.md
  - docs/M3-002_HANDOFF.md
  - docs/M3-003_HANDOFF.md
  - docs/M3-004_HANDOFF.md
  - docs/M3-005_HANDOFF.md
  - docs/M3-006_HANDOFF.md
  - docs/NAME_AVAILABILITY.md
  - docs/PROVENANCE_LEDGER.md
  - docs/RELEASE_GATES.md
  - docs/THREAT_MODEL.md
  - packaging/alpha-package-plan.json
  - provenance/records.json
  - sbom.alpha.cdx.json
  - scripts/lib/package-plan.mjs
  - scripts/lib/package-stage.mjs
  - scripts/lib/package-tarball.mjs
  - scripts/lib/release-metadata.mjs
  - tests/package-plan.test.mjs
  - tests/package-stage.test.mjs
  - tests/release-metadata.test.mjs
kind: empty-public-repository activation, canonical GitHub identity binding,
  npm-private manifest projection, static-ESM SBOM projection, and exact-plan
  package-stage recovery admission
origin: independently derived from the user-selected D-044 GitHub target, the
  live GitHub repository response for public repository ID `1330979133`, the
  positive private-vulnerability-reporting PUT 204 plus later GET
  `enabled: true`, and the existing D-039 through D-043 package/release
  authorities. No remote source, predecessor implementation, package, asset,
  presentation, generated binary, token, or raw API transcript entered Git
original_author_or_holder: Elliot Wu
created_or_reviewed_on: 2026-08-12
license_or_rights_basis: MIT
third_party_dependencies: []
private_information_review: passed; only the approved public owner/repository,
  GitHub numeric repository ID, canonical public URLs, aggregate gate facts,
  and repository-owned synthetic mutations are recorded. PVR remains a live
  GitHub fact rather than a plan/SBOM boolean; no token, credential, private
  path, private/local hostname, source presentation, private fixture, raw API
  transcript, or ignored package output is recorded
project_constant_removal: passed; package-plan schema v2 is the sole readable
  owner of provider/ID/owner/name/HTML URL. Leaf repository objects and the one
  root SBOM VCS reference are pure projections. A separate executable
  `private: true` plus `npm-publication-not-authorized` guard keeps npm closed;
  no second repository manifest, PVR flag, publishConfig, or lifecycle path was
  added. The old plan ID/stage owner remain only as recovery identity
public_fixture_conformance: applicable; the fixed repository-bound snapshot
  passes 1217/1217 complete tests under both Node 22.23.2 and Node 24.19.0. The
  package-stage suite passes 24/24 under both runtimes, including exact
  repository fields,
  repository-directory drift, npm-private manifests, SBOM URL/ID drift, plan-
  fingerprint recovery, legacy/missing/tampered completion rejection, and the
  live-foreign claim classification exposed by real Node 24 contention. npm
  10.9.8 and npm 11.17.0 each build and independently admit four private
  tarballs, install them together offline, execute the installed CLI spine,
  return blocked QA, and create no BuildArtifact. Exact final tarball
  fingerprints remain only in ignored boundary evidence
independent_review: passed for the current code/security boundary; one bounded
  current-byte review plus the claim-race closing review report 0 blocker, 0
  high, and 0 medium and confirm the
  exact repository tuple/directory/protocol mutations, npm-private manifests,
  root-only SBOM projection, plan-fingerprint recovery, live-claim/release
  ownership transfer, launch state machine, and 25-path provenance relation.
  The completed dual-runtime product/package evidence above was rerun after the
  runtime, package, and packed README source snapshot froze
notes: The empty public GitHub shell and positive PVR status are real external
  facts, but no local remote or source ref exists. GitHub source authorization
  does not authorize npm publication. Before the first exact-object-ID push,
  M3-006 must create and rescan the final main commit, reverify the exact
  numeric repository/public/empty/PVR tuple and canonical resolved HTTPS push
  URL, then require remote main equality
```

The XML namespace, relationship-type, and MIME strings are interoperability
identifiers from the public format specification. They do not convey third-
party presentation content. The fictional `Synthetic Sans` typeface name does
not identify or redistribute a font file.
