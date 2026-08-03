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

The XML namespace, relationship-type, and MIME strings are interoperability
identifiers from the public format specification. They do not convey third-
party presentation content. The fictional `Synthetic Sans` typeface name does
not identify or redistribute a font file.
