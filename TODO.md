# TODO

Status values: `DONE`, `NEXT`, `BLOCKED`, `PENDING`, and `DEFERRED`.

Complete tasks in dependency order. A task is complete only when its exit
criterion is recorded in the repository.

## M0 — Clean bootstrap

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| M0-001 | DONE | Create a new workspace and independent Git tree without copying predecessor content. | Only planning text is present; parent repository ignores this nested tree. |
| M0-002 | DONE | Record the project boundary, handoff, private-fixture policy, target architecture, and release gates. | The documents linked from `README.md` agree on scope and status. |
| M0-003 | DONE | Select the working name, monorepo shape, MIT license, copyright holder, and repository-local public Git identity. | Dated decisions, official-registry name check, MIT license text, and local Git identity verification are recorded. |
| M0-004 | DONE | Implement the bounded provenance and forbidden-material gates in `docs/M0-004_HANDOFF.md`. | Every tracked/admitted file has machine-readable provenance; mutations covering forbidden paths/text/extensions/magic, symlinks, oversize files, missing/invalid records, and private-output leakage are rejected. |
| M0-005 | DONE | Define the public support matrix and compatibility policy. | Each input, OOXML feature, platform, and evidence level is marked supported, experimental, manual, or unsupported. |

### M0-004 completion evidence — 2026-07-30

- `npm test`: 33/33 passed, comprising 2 passing baselines and 31 rejection
  mutations.
- `npm run check:public-tree`: staged forbidden-material and exact per-file
  provenance gates passed for the complete slice.
- `git diff --check`: passed.
- The bounded independent read-only review found four issues; all were fixed,
  regression-tested, and the closing review reported no blocking findings.
- The local run used Node.js 23.7.0 only as development verification. Node.js
  22.x/24.x and cross-platform evidence remains assigned to public CI work.

### M0-005 completion evidence — 2026-07-31

- The normative matrix contains 60 sorted, unique rows across all required
  dimensions, zero `supported` items, and an explicit false global claim switch.
- `npm test`: 47/47 passed, including 44 total rejection mutations; 13 are
  support-matrix overclaim and drift mutations.
- `npm run check:public-tree`: staged forbidden-material, provenance, and
  support-matrix gates passed for the complete slice.
- `git diff --cached --check`: passed.
- The compatibility policy defines status promotion/demotion, evidence scope,
  fail-closed resolution, manual/private boundaries, and 0.x versioning.

## M1 — Public, self-contained foundation

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| M1-001 | DONE | Create a repository-owned synthetic PPTX/POTX fixture generator from reviewed text-only OOXML parts. | Generated decks are deterministic, contain no third-party branding/content, and pass an independent provenance review. |
| M1-002 | DONE | Define versioned schemas for project config, template profile/index, capability registry/overlay, slide spec, build artifact, and QA report. | Valid and mutation-invalid fixtures pass/fail predictably on every supported Node version. |
| M1-003 | DONE | Implement `ProjectContext` and remove ambient root-path assumptions. | Core APIs accept explicit paths/dependencies; scans find no project-root singleton or absolute path. |
| M1-004 | DONE | Implement a distributable template inspector without managed/private helpers. | A clean installation inspects the synthetic fixture and emits a deterministic, path-redacted index. |
| M1-005 | DONE | Implement secure ZIP/XML ingestion. | Tests cover traversal, symlinks, zip bombs, member/size limits, duplicates, case conflicts, malformed XML, external relationships, macros, ActiveX, and embedded objects. |

### M1-001 completion evidence — 2026-07-31

- A positive manifest admits exactly 12 repository-owned UTF-8/LF OOXML parts;
  no presentation, image, font, private fixture, or predecessor file was used.
- The dependency-free generator produces ignored PPTX and POTX archives that
  differ only in the reviewed main-part content type. ZIP entry order, bytes,
  timestamp, permissions, CRC-32, comments, and extra fields are deterministic.
- `npm test`: 75/75 passed, including 66 rejection mutations; the M1-001 suite
  contributes 28 tests and 22 focused rejection mutations.
- All 12 source parts passed local XML well-formedness checks, and both generated
  variants passed archive integrity checks. Public tests independently parse the
  ZIP records and do not depend on those local tools.
- The bounded independent provenance/security review found four blocking
  validation gaps. Canonical tag forms, exact Default/Override content types,
  high-risk namespace prefixes, and element-bound relationship references were
  fixed and regression-tested; the closing review reported no blocking findings.
- `npm run check:public-tree` and `git diff --cached --check` passed on the staged
  48-file tree. The global support-claim switch remains false.
- Local verification used Node.js 23.7.0. Supported Node.js 22.x/24.x and
  cross-platform evidence remain assigned to public CI work.

### M1-002 completion evidence — 2026-07-31

- Contract version `0.1.0` contains eight closed root schemas, one registered
  shared-definition schema, eight positive text fixtures, and 22 generated
  TypeScript exports from the normative JSON Schemas.
- The dependency-free contract gate rejects unregistered references, unknown
  keywords/versions/fields, unsafe relative paths, duplicate or dangling IDs,
  ambiguous bindings, cross-document version/hash drift, invalid publication
  targets, incorrect QA/manual aggregation, and generated-type drift.
- `npm test`: 146/146 passed, including 135 total rejection mutations. The
  contract suite contributes 70 tests (2 positive and 68 rejection mutations);
  one additional provenance-authority regression belongs to the M1-002 slice.
- The identical 146-test suite passed on Node.js 22.23.1 and Node.js 24.14.0,
  satisfying the two declared runtime lines. Linux/Windows and broader
  cross-platform evidence remains assigned to M3-004.
- The fixture manifest is machine-marked `schema-conformance-only`; placeholder
  executor/schema/QA references and fictional artifact values are not runtime
  evidence. `supportClaimsEnabled` remains false and no matrix row is promoted.

### M1-003 completion evidence — 2026-08-01

- `packages/core/src/project-context.mjs` constructs a detached, deeply frozen
  runtime context from an explicit absolute root, `ProjectConfig 0.1.0`, and an
  exact injected validator. It performs no filesystem or presentation I/O.
- All eight configured locations are lexically contained below the explicit
  root. Three project roots remain pairwise non-overlapping, five input-document
  roles reject all 10 case-only aliases, and template/write conflicts fail
  closed without adding a control-file-under-write restriction.
- The complete suite is 225/225: the M1-003 suite contributes 79 test nodes and
  60 focused rejection mutations, bringing the repository total to 195 focused
  rejection mutations.
- The identical 225-test suite passed on Node.js 22.23.1 and Node.js 24.14.0.
  Cross-platform OS evidence, including Windows filesystem edge cases, remains
  M3-004.
- The bounded independent review found one input-document case-alias gap. The
  implementation and all 10 role-pair mutations were added; the closing review
  reported no remaining blocker.
- Working-tree and staged forbidden-material, exact provenance, support-matrix,
  and versioned-contract gates passed. `supportClaimsEnabled` remains false;
  no file input, inspector, secure ingestion, capability, render, or QA support
  is claimed.

### M1-004 completion evidence — 2026-08-01

- `packages/core/src/template-inspector.mjs` accepts an explicit frozen
  `ProjectContext`, a bounded already-parsed `TemplatePackageView`, and an
  injected exact `TemplateIndex 0.1.0` validator. It performs no filesystem,
  archive, XML, cwd, environment, or Git discovery.
- The reviewed public-fixture producer emits archive-bound package views and
  fingerprints its normalized OOXML structure. Unmodeled attributes, children,
  transitions, timing, extension lists, ambiguous shapes, and unsupported
  relationships fail closed before an index is returned.
- POTX output exactly matches the committed path/text-redacted execution golden;
  PPTX differs only in format and exact archive SHA-256. Ordinal master, layout,
  slide, and shape keys preserve source owner/z-order without using names or
  fixture IDs.
- `npm test`: 344/344 passed. The M1-004 suite contributes 119 test nodes and 94
  focused rejection mutations, bringing the repository total to 289 focused
  rejection mutations.
- The identical 344-test suite passed on Node.js 22.23.1 and Node.js 24.14.0.
  Cross-platform OS evidence remains M3-004.
- The clean-install exit criterion is presently evidenced by a clean-directory
  module-closure smoke from an unrelated cwd. Literal packed-tarball installation
  remains M3-002/M3-003 because the private workspace is not publishable.
- The bounded independent review found three blockers: unmodeled OOXML could be
  omitted, caller views were copied before bounds, and slide-size extra fields
  were lost. Structural fingerprinting, bounded normalization, and exact
  `{cx, cy}` validation closed all three; re-review found no remaining blocker.
- Working-tree and staged forbidden-material, exact provenance, support-matrix,
  and versioned-contract gates passed. `supportClaimsEnabled` remains false;
  no PPTX/POTX file input, secure ingestion, capability, render, or QA support
  is claimed.

### M1-005 completion evidence — 2026-08-01

- `inspectTemplateSource` accepts only a frozen `ProjectContext` plus the exact
  `TemplateIndex` validator. It reads one identity-checked, size-bounded file
  snapshot and binds both parsing and the emitted archive digest to those same
  detached bytes.
- The dependency-free ingestion path enforces fixed ZIP, XML, OPC,
  relationship, PresentationML, and package-wide limits. It never extracts
  members and rejects traversal, symlink components, bombs, duplicate/case
  aliases, ambiguous records, malformed or unmodeled XML, external targets,
  macros, ActiveX, OLE, and embedded packages/objects.
- `npm test`: 422/422 passed. The M1-005 suite contributes 78 test nodes,
  including exact stored/DEFLATE POTX/PPTX results and adversarial filesystem,
  ZIP, XML, namespace, graph, high-risk, redaction, and dependency-boundary
  cases.
- The identical 422-test suite passed on Node.js 22.23.1 and Node.js 24.14.0.
  Cross-platform OS evidence, including Windows junction/reparse behavior,
  remains M3-004.
- The bounded independent closing review's blocker and two high findings were
  fixed: content-type entries now reject hidden children, package views and
  digests derive from one snapshot, and regression coverage exercises both.
  Re-review found no remaining blocker or high finding. The portable Node
  descriptor-relative-walk/TOCTOU residual remains explicitly documented.
- Working-tree and staged forbidden-material, exact provenance, support-matrix,
  and versioned-contract gates passed. `supportClaimsEnabled` remains false;
  every support row remains non-supported, so this security baseline is not an
  arbitrary-template compatibility or capability claim.

## M2 — Generic rendering vertical slice

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| M2-001 | NEXT | Define the executable capability interface and dispatcher. | `supported` cannot be registered without executor, schemas, conformance fixture, and QA contract. |
| M2-002 | PENDING | Implement data-driven source-slide clone/fill with semantic shape bindings. | No fixture-specific slide/shape identifiers exist in source; missing or ambiguous bindings fail closed. |
| M2-003 | PENDING | Implement a minimal native DrawingML component capability. | One data-only slide spec renders through the same dispatcher and remains editable. |
| M2-004 | PENDING | Parameterize the optional Pandoc/OMML adapter and isolate it from core. | Pandoc is detected as an external optional dependency; formula transplant and failure behavior have conformance tests and attribution review. |
| M2-005 | PENDING | Implement create-only assembly, normalization, semantic diff, and collateral-mutation checks. | The source is unchanged; output is atomically published; allowed and forbidden part changes are machine-verifiable. |

## M3 — CLI, packaging, and public QA

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| M3-001 | PENDING | Implement `init`, `doctor`, `inspect`, `onboard`, `validate`, `render`, `qa`, and `diff`. | Commands have stable exit codes, JSON output mode, path redaction, and end-to-end tests. |
| M3-002 | PENDING | Create a private workspace root and explicit publishable packages; decide scoped versus unscoped npm names at this point. | Each published package declares `files`, `exports`, `types`, `bin` where applicable, license, repository, and engines. |
| M3-003 | PENDING | Add repository and npm leakage gates. | Tarball is at most 5 MiB compressed/20 MiB unpacked, at most 300 files/1 MiB each, matches an allowlist, contains no forbidden magic/extensions, and installs in an empty directory. |
| M3-004 | PENDING | Add Linux, Windows, and macOS public CI plus security scanning. | Typecheck, lint, unit, mutation, schema, fixture, archive, CLI, package, secret/PII/path, license, SBOM, and clean-install jobs pass without model/GUI/private inputs. |
| M3-005 | PENDING | Add support, security, contribution, governance, changelog, and release documentation. | A new contributor can reproduce the public test suite and report a vulnerability privately. |
| M3-006 | DEFERRED | After the public synthetic-fixture `init -> inspect -> validate -> render -> qa` flow is executable, pass a fresh public-preflight scan and create the Git hosting repository as public. | User selects the hosting account/organization; public remote contains only reviewed clean history and no release claim beyond executable evidence. |

## M4 — Release progression

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| M4-001 | PENDING | Release `0.1.0-alpha.1` after all alpha gates pass. | Signed/provenance-enabled release is reproducible from a clean tag; published contents equal the reviewed tarball. |
| M4-002 | PENDING | Collect compatibility evidence without expanding claims beyond tests. | Each tested external template records only redacted feature-level results and the public fixture remains sufficient for CI. |
| M4-003 | PENDING | Define beta and 1.0 stability, migration, deprecation, and support promises. | Compatibility policy and conformance suite enforce the promises. |

## Deferred follow-through from the predecessor project

These entries intentionally remain at the tail so the generic public core is
not delayed or distorted by project-specific validation.

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| COMPAT-OMML-001 | PENDING | Complete the approved manual PowerPoint editability check for the direct OMML path. | A human edits and saves the formula in PowerPoint without repair; the result is recorded only as redacted compatibility evidence. |
| LAB-TOKEN-001 | PENDING | Harden the approved preloaded, report-only Codex task runner as a separate `labs/` experiment. | Zero-tool enforcement, canonical path containment, hashed/classified inputs, minimal environment, bounded/schema-checked output, exact completion/usage accounting, prompt-injection mutations, and canary token/quality comparisons all pass. It is never a renderer prerequisite. |
| COMPAT-TEMPLATE-003 | DEFERRED | Test a third independent design package after the project is mature. | Start only after the alpha vertical slice and public fixture pass; require before 1.0, not before initial implementation. No private asset enters Git or public artifacts. |
