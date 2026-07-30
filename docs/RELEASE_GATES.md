# Release Gates

All gates fail closed. Compilation or a visually plausible deck is not release
evidence by itself.

## G0 — Identity, rights, and provenance

- project/package names and public Git identity are selected;
- an OSI-approved license is selected after confirming ownership and third-party
  obligations;
- each source, schema, fixture part, example, and dependency has a provenance
  record and compatible redistribution status;
- excluded private materials and non-redistributable helpers have machine-
  checked patterns;
- per-file SPDX/copyright policy is decided and enforced.

## G1 — Public reproducibility

- clean checkout uses only declared public dependencies;
- synthetic fixture is repository-owned, deterministic, and independently
  reviewed;
- no private fixture, local font, model, GUI, or managed helper is required;
- Linux, Windows, and macOS non-GUI tests agree on normalized results.

## G2 — Input security

- canonical containment blocks traversal and symlink escape;
- archive member count, individual size, expanded total, compression ratio,
  nesting, duplicate, and case-conflict limits are enforced before extraction;
- XML parser limits and external-entity/network access are disabled;
- external relationships, macros, ActiveX, OLE, embedded packages, and unknown
  high-risk parts follow the documented reject/quarantine policy;
- resource exhaustion and malformed-input mutation suites pass.

## G3 — Capability correctness

- the shipped support matrix passes its schema and semantic overclaim gate;
- every supported capability has an executor, schemas, conformance fixture,
  deterministic output, negative tests, and QA assertions;
- source template is unchanged and output publication is create-only;
- OOXML relationships, content types, geometry/capacity, semantic diff, and
  collateral mutation checks pass;
- manual and unavailable evidence remains visible and cannot be promoted to an
  automatic pass.

## G4 — Package boundary

Every publishable package uses a positive `files` allowlist. The packed tarball:

- is at most 5 MiB compressed and 20 MiB unpacked;
- has at most 300 files and no file larger than 1 MiB;
- contains only allowlisted runtime files and required notices;
- contains no presentation/PDF/font/archive binary, worktree, build/review
  output, private manifest, absolute path, secret, PII, source map with private
  sources, or undeclared executable;
- installs in an empty directory and completes the documented CLI smoke flow.

The reviewed tarball hash must equal the published tarball hash.

## G5 — Project security and maintenance

- least-privilege CI, pinned actions, dependency review, CodeQL/static analysis,
  secret scanning, license audit, SBOM, and vulnerability reporting are active;
- untrusted pull-request code never reaches private fixtures, PowerPoint hosts,
  signing keys, provenance identity, or registry tokens;
- supported Node/platform versions, compatibility levels, deprecation policy,
  and security response process are documented;
- contributor and governance documents are present.

## G6 — Release evidence

- release tag points to the reviewed commit;
- clean-tag build, full public conformance suite, tarball install smoke, and CLI
  end-to-end flow pass;
- changelog and known limitations match the executable support matrix;
- alpha/beta/stable channel is explicit;
- package publication uses registry provenance where available.

## Reference policies

- OSI licenses: <https://opensource.org/licenses>
- REUSE Specification: <https://reuse.software/spec/>
- npm package metadata: <https://docs.npmjs.com/cli/configuring-npm/package-json/>
- OpenSSF Scorecard: <https://github.com/ossf/scorecard>
- GitHub security policy guidance: <https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/add-security-policy>

## Executable foundation gates

M0-004 makes the G0 admission boundary executable without third-party runtime
dependencies:

- `npm run check:public-tree` checks the staged Git index using the staged
  policy, schema, and provenance records;
- `npm run check:working-tree` diagnoses tracked and non-ignored untracked
  working-tree files without following symlinks;
- `npm test` proves deterministic reports and fail-closed behavior with
  repository-owned temporary text fixtures and 31 rejection mutations.

Both CLIs emit deterministic human output by default and accept `--json` for a
versioned machine report. A configuration error is itself a gate failure.

M0-005 adds `npm run check:support-matrix`. It validates the staged 60-row
matrix, explicit catch-alls, claim switch, status/disposition/evidence
combinations, required capability evidence, deterministic IDs, and admitted
evidence paths. It is part of `npm run check:public-tree`.

M1-001 adds `npm run generate:fixtures` and the synthetic-fixture tests. The
generator admits only its reviewed text-part allowlist, rejects source/graph
drift and high-risk markers, creates deterministic PPTX/POTX archives in an
ignored directory, and refuses overwrite. This is producer-side public test
evidence only; it is not the secure ingestion gate required by G2.
