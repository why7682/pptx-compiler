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
| M0-004 | NEXT | Establish per-file provenance and a forbidden-material manifest. | Every migrated or newly written source has a ledger entry; CI rejects excluded content. |
| M0-005 | PENDING | Define the public support matrix and compatibility policy. | Each input, OOXML feature, platform, and evidence level is marked supported, experimental, manual, or unsupported. |

## M1 — Public, self-contained foundation

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| M1-001 | PENDING | Create a repository-owned synthetic PPTX/POTX fixture generator from reviewed text-only OOXML parts. | Generated decks are deterministic, contain no third-party branding/content, and pass an independent provenance review. |
| M1-002 | PENDING | Define versioned schemas for project config, template profile/index, capability registry/overlay, slide spec, build artifact, and QA report. | Valid and mutation-invalid fixtures pass/fail predictably on every supported Node version. |
| M1-003 | PENDING | Implement `ProjectContext` and remove ambient root-path assumptions. | Core APIs accept explicit paths/dependencies; scans find no project-root singleton or absolute path. |
| M1-004 | PENDING | Implement a distributable template inspector without managed/private helpers. | A clean installation inspects the synthetic fixture and emits a deterministic, path-redacted index. |
| M1-005 | PENDING | Implement secure ZIP/XML ingestion. | Tests cover traversal, symlinks, zip bombs, member/size limits, duplicates, case conflicts, malformed XML, external relationships, macros, ActiveX, and embedded objects. |

## M2 — Generic rendering vertical slice

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| M2-001 | PENDING | Define the executable capability interface and dispatcher. | `supported` cannot be registered without executor, schemas, conformance fixture, and QA contract. |
| M2-002 | PENDING | Implement data-driven source-slide clone/fill with semantic shape bindings. | No fixture-specific slide/shape identifiers exist in source; missing or ambiguous bindings fail closed. |
| M2-003 | PENDING | Implement a minimal native DrawingML component capability. | One data-only slide spec renders through the same dispatcher and remains editable. |
| M2-004 | PENDING | Parameterize the optional Pandoc/OMML adapter and isolate it from core. | Pandoc is detected as an external optional dependency; formula transplant and failure behavior have conformance tests and attribution review. |
| M2-005 | PENDING | Implement create-only assembly, normalization, semantic diff, and collateral-mutation checks. | The source is unchanged; output is atomically published; allowed and forbidden part changes are machine-verifiable. |

## M3 — CLI, packaging, and public QA

| ID | Status | Task | Exit criterion |
| --- | --- | --- | --- |
| M3-001 | PENDING | Implement `init`, `doctor`, `inspect`, `onboard`, `validate`, `render`, `qa`, and `diff`. | Commands have stable exit codes, JSON output mode, path redaction, and end-to-end tests. |
| M3-002 | PENDING | Create a private workspace root and explicit publishable packages. | Each published package declares `files`, `exports`, `types`, `bin` where applicable, license, repository, and engines. |
| M3-003 | PENDING | Add repository and npm leakage gates. | Tarball is at most 5 MiB compressed/20 MiB unpacked, at most 300 files/1 MiB each, matches an allowlist, contains no forbidden magic/extensions, and installs in an empty directory. |
| M3-004 | PENDING | Add Linux, Windows, and macOS public CI plus security scanning. | Typecheck, lint, unit, mutation, schema, fixture, archive, CLI, package, secret/PII/path, license, SBOM, and clean-install jobs pass without model/GUI/private inputs. |
| M3-005 | PENDING | Add support, security, contribution, governance, changelog, and release documentation. | A new contributor can reproduce the public test suite and report a vulnerability privately. |

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
