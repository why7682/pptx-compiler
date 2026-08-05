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
| M2-001 | DONE | Define the executable capability interface and dispatcher. | `supported` cannot be registered without executor, schemas, conformance fixture, and QA contract. |
| M2-002 | DONE | Implement data-driven source-slide clone/fill with semantic shape bindings. | No fixture-specific slide/shape identifiers exist in source; missing or ambiguous bindings fail closed. |
| M2-003 | DONE | Implement a minimal native DrawingML component capability. | One data-only slide spec emits a strict native non-raster group exemplar through the same dispatcher; the result is explicitly non-insertable until M2-005 proves target application and PowerPoint editability. |
| M2-004 | DONE | Parameterize the optional Pandoc/OMML adapter and isolate it from core. | Pandoc is detected as an external optional dependency; formula transplant and failure behavior have conformance tests and attribution review. |
| M2-005 | NEXT | Implement create-only assembly, normalization, semantic diff, and collateral-mutation checks. | The source is unchanged; output is atomically published; allowed and forbidden part changes are machine-verifiable. |

### M2-001 completion evidence — 2026-08-02

- `createCapabilityRuntime` atomically binds exact metadata, executor,
  input/output schema documents and validators, nonempty conformance fixtures,
  QA assertions, and support decisions. Metadata-only definitions stay known
  but unavailable; registry URNs never load code.
- `prepareCapabilityDispatch` validates and preflights the complete detached,
  frozen, bounded batch before any executor runs. `executeCapabilityDispatch`
  authenticates and consumes an opaque plan before its first `await`, preserves
  order, and validates every bounded output and QA assertion.
- The repository-owned `dispatcher-contract-probe` is data-only,
  conformance-only, absent from product capability rows, and has no filesystem,
  network, process, dynamic-loader, presentation, or mutation authority.
- `npm test`: 507/507 passed. The dispatcher suite contributes 85 nodes; the
  dispatcher plus support-matrix suites also pass 99/99 under
  `--unhandled-rejections=strict`.
- The identical 507-test suite passed on the checksum-verified official Node.js
  22.23.1 and Node.js 24.14.0 releases. Cross-platform OS evidence remains
  M3-004.
- The bounded independent review found one blocker, two high findings, and one
  provenance medium. Internal registration captures now close the async
  mutation race; aggregate node/string/key budgets reject during traversal;
  rejected Promises from sync-only callbacks are consumed before redacted
  failure; and all modified provenance records were refreshed. Re-review found
  no remaining blocker or high finding.
- Working-tree and staged forbidden-material, exact-provenance, support-matrix,
  and versioned-contract gates passed, as did `git diff --cached --check`.
- `supportClaimsEnabled` remains false and all 60 support rows remain
  non-supported. Complete registration is necessary for dispatchability, not a
  renderer, staging/publication guarantee, product capability, or support claim.

### M2-002 completion evidence — 2026-08-03

- `assertCapabilityRuntimeRegistry` compares a bounded detached caller registry
  with the exact registry privately captured by the authentic runtime, rejecting
  same-ID/version content substitution.
- `prepareResolvedDeckDispatch` snapshots and freezes all four documents before
  any validator callback, resolves the complete overlay/index/deck graph with
  exact identity, uniqueness, ordering, role, kind, cardinality, and target
  checks, then returns only an opaque M2-001 plan. A bad later slide causes zero
  product preflight or execution calls.
- The repository-owned `source-slide-clone-fill` artifact set has exact metadata,
  input/output schemas, two text-only conformance cases, a no-I/O executor, and
  four ordered QA assertions. It produces only a deterministic clone/fill JSON
  operation plan from semantic bindings; product dispatch remains unavailable.
- Snapshotters apply O(1) code-unit ceilings before bounded UTF-8 encoding.
  Input schema, preflight, and output schema consistently reject blank/control,
  format-character, unpaired-surrogate, and Unicode-noncharacter text while
  accepting valid astral scalars.
- `npm test`: 564/564 passed. The M2-002 suite contributes 56 nodes; the
  resolver/dispatcher/support focus passes 156/156.
- The identical 564-test suite passed on checksum-verified official Node.js
  22.23.1 and Node.js 24.14.0 releases. Cross-platform OS evidence remains
  M3-004.
- The bounded independent review found a missing-provenance blocker, one
  pre-encoding resource high finding, and Unicode/schema plus stale-document
  lower-severity findings. All were fixed and regression-tested; final re-review
  found no remaining code blocker or high finding.
- Working-tree and staged forbidden-material, exact-provenance, support-matrix,
  and versioned-contract gates passed, as did `git diff --cached --check`.
- `supportClaimsEnabled` remains false and all 60 support rows remain
  non-supported. This is not OOXML mutation, rendering, editability,
  source-isolation, collateral-diff, staging, or publication evidence.

### M2-003 completion evidence — 2026-08-03

- `native-card-arrow@0.1.0` supplies exact metadata, closed input/output
  schemas, two repository-owned text conformance cases, a no-I/O executor, and
  four ordered QA assertions through the existing resolver and dispatcher.
- The executor builds a closed typed tree and canonically serializes one
  allowlisted native `p:grpSp` containing a text-bearing `roundRect` plus a
  `rightArrow`. Strict parsing and exact vocabulary, namespace, structure,
  count, transform, text, color, preset-geometry, and no-relationship/no-raster
  assertions fail closed.
- The result is explicitly an `unbound-drawingml-conformance-fragment` with
  `insertable: false`, component-local IDs `1/2/3`, and
  `local-remap-required`. M2-005 must rebuild from typed data, allocate safe
  target-slide IDs, validate containment, apply in create-only staging, and
  prove PowerPoint editability; raw fragment concatenation is forbidden.
- The exact `native-drawingml` row is experimental and requires explicit
  opt-in plus automated public evidence for all executable artifacts. The
  global claim switch remains false, no row is supported, and broad DrawingML,
  slide text, every input class, clone/fill, package output, staging,
  publication, and PowerPoint editability remain unsupported.
- `npm test`: 623/623 passed. The native-component suite contributes 57 nodes;
  the resolver/dispatcher/clone-fill/support focus passes 215/215, including
  native structure, safe Unicode/XML escaping, resource limits, batch
  atomicity, semantic-key independence, fixture neutrality, no-I/O closure,
  support overclaim, and QA/output drift cases.
- The identical 623-test suite passed on checksum-verified official Node.js
  22.23.1 and Node.js 24.14.0 releases. Cross-platform OS evidence remains
  M3-004.
- The bounded independent review found one contract-boundary mismatch: the old
  exit criterion implied insertion-ready PowerPoint editability. D-022, this
  criterion, the handoff, and support documents now consistently limit M2-003
  to the strict native non-raster exemplar and assign application/editability
  evidence to M2-005; no implementation blocker or high finding remained.
- Working-tree and staged forbidden-material, exact-provenance, support-matrix,
  and versioned-contract gates passed, as did `git diff --cached --check`.

### M2-004 completion evidence — 2026-08-05

- `adapter-pandoc-omml@0.1.0` is core-isolated: only its Node runner imports
  `node:child_process`, requires trusted absolute process/cwd configuration,
  uses no shell or ambient discovery, and enforces fixed argv, an explicit
  bounded environment, stdin/output limits, timeout, and stable redacted
  outcomes.
- Pandoc `>=2.15.0 <4.0.0` is only an eligibility window. Version, sandboxed
  JSON-API, and exact fraction-to-DOCX/OMML probes must pass before the static
  formula executor can be registered; missing, warning-producing, failed, or
  drifting tools remain unavailable with no fallback.
- `formula-transplant@0.1.0` has exact metadata, closed schemas, one text-only
  conformance case, a real semantic text-box binding, an adapter-injected
  executor, and four ordered QA assertions through the existing resolver and
  dispatcher. It emits only an unbound canonical `m:oMath` plan with
  `insertable: false` and `typed-rebuild-required`.
- Public tests use a fake process runner and runtime-built text-derived DOCX.
  The 115-node focused suite covers fixed JSON-AST transport, absence/error and
  stream handling, formula bounds, batch atomicity, exact content-type and
  source/type/target relationship profiles, secure ZIP/XML, typed OMML
  topology, schemas/QA, determinism, no-I/O direction, and clean closure. The
  strict dispatcher/resolver/native/formula/support focus passes 330/330.
- The complete 738-test suite passed on checksum-verified official Node.js
  22.23.1 and Node.js 24.14.0. Cross-platform OS and real compatible-Pandoc
  evidence remain M3-004 or a later compatibility gate.
- D-008 and `docs/PANDOC_ADAPTER_ATTRIBUTION.md` record fixed official Pandoc
  3.10.1 behavior/license sources, external-only GPL-2.0-or-later separation,
  warning-to-text fallback, non-insertable PPTX wrapper boundary, and no blanket
  generated-output ownership claim. No Pandoc code, binary, template, output,
  or upstream-derived fixture is tracked.
- The bounded closing review found one high relationship-prefix bypass and one
  medium content-type overbreadth. Exact mappings plus 10 regression subtests
  closed both; the bounded re-review found no remaining blocker or high issue.
- Working-tree and staged forbidden-material, exact-provenance, support-matrix,
  and versioned-contract gates passed, as did `git diff --cached --check`.
  `formula-transplant`, `latex-formula`, and `native-omml` remain
  `unsupported/unavailable`; `supportClaimsEnabled` remains false and no row is
  supported.

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
