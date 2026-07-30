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
