# M3-004 Handoff — Public Workflow Contract

## Outcome and split

M3-004 has two different facts and they must not be conflated:

- `M3-004A` defines and locally verifies the public-safe workflow, development-
  toolchain, source-policy, license, and static-ESM SBOM projection contracts.
- `M3-004B` is the six-cell public GitHub Actions run. The empty public shell
  now exists, but it remains blocked until M3-006 publishes the exact reviewed
  first source ref.

The local workflow definition is complete. No Linux, Windows, macOS, CodeQL, or
dependency-review run is claimed merely because the YAML exists or local macOS
tests pass. M3-005A completes the local public-document contract. D-045 created
the empty shell and verified private reporting; M3-006 must still close the
repository-bound local evidence and exact first-ref publication.

## Kernel-style judgment

**Core judgment:** worth doing. A public repository without a reproducible,
least-privilege CI definition has no credible release boundary.

**Critical data relationship:** existing readable authorities remain owners.
`package.json` owns executable development commands; the alpha package plan owns
the four-package runtime graph; provenance and the MIT text own redistribution
facts; Git owns the admitted source set. The workflow module owns only event,
runner, permission, command-order, and action-pin policy. The SBOM is a readable
projection of the package plan, never a second package graph.

**Removed complexity:** there is no general YAML parser, second package policy,
parallel dependency manifest, artifact hash graph, or home-grown type checker.
Two fixed YAML byte strings are generated and exact-compared. TypeScript itself
checks one consumer compiled against every plan-derived public declaration
subpath.

**Compatibility risk:** Windows does not expose the POSIX directory `fsync`
primitive through Node. All admitted platforms still file-flush owned regular
payloads and keep create-only, record-first/marker-last, exact reconciliation,
and the same fault-state machine. POSIX additionally requests parent-directory
fsync barriers. Windows has no sudden-power-loss directory-entry persistence
claim.

## Canonical public workflows

Only these direct workflow files are admitted:

```text
.github/workflows/ci.yml
.github/workflows/security.yml
```

`scripts/lib/public-workflows.mjs` is their one local workflow-policy owner.
`scripts/check-public-workflows.mjs` enumerates the actual workflow directory,
rejects directory/file indirection, compares both files byte-for-byte, binds the
exact package-script bodies, and rejects any third workflow.

The CI matrix is fixed at:

```text
ubuntu-24.04  × Node 22, 24
windows-2025  × Node 22, 24
macos-15      × Node 22, 24
```

The ordinary CI workflow has only `contents: read`, checks out without
persistent credentials, and disables the setup-node package cache. Before any
dependency installation it directly admits the workflow policy, working-tree
forbidden-material/root identity, and release metadata plus lock. It then
installs the fixed development toolchain with scripts/audit/fund disabled and
runs typecheck, source/import, package-plan, complete test, guarded package-
build, working-tree rechecks, and tracked-drift gates. It never
invokes PowerPoint, Pandoc, a model, a private fixture, a secret, signing,
publication, or artifact upload.

The security workflow runs CodeQL only on `push` and `schedule`, using
`build-mode: none`; it does not execute repository code. Dependency Review runs
only on the ordinary `pull_request` event. There is no `pull_request_target`,
`workflow_run`, self-hosted runner, persisted checkout credential, shared cache,
or write permission other than CodeQL's one `security-events: write` grant.

The action references were checked against their official GitHub repositories
on 2026-08-11 and are pinned to complete commits:

- actions/checkout v7.0.1:
  `3d3c42e5aac5ba805825da76410c181273ba90b1`;
- actions/setup-node v7.0.0:
  `820762786026740c76f36085b0efc47a31fe5020`;
- github/codeql-action v4.37.6:
  `5595ccaf912efad79be6eef63a5619ff05969be3`;
- actions/dependency-review-action v5.0.0:
  `a1d282b36b6f3519aa1f3fc636f609c47dddb294`.

Full-SHA pins are deliberately updated by review rather than replaced with
floating tags.

## Development and release metadata projection

The private root has no runtime dependency. It has one exact dev-only tool:
TypeScript 6.0.2, Apache-2.0, locked by registry URL and integrity. The release-
metadata gate rejects extra root/lock dependencies, extra lock fields,
noncanonical or duplicate-key-collapsed lock text, script substitution, engine
drift, and tool version/license/bin/integrity drift.

`tsconfig.public.json` is derived from all eight public export subpaths in the
alpha package plan. `tests/types/alpha-public-api.ts` must import that exact
specifier set. The real compiler checks representative values and types; a
syntax-only check or `node -e 0` cannot satisfy the workflow contract.

`scripts/lib/source-policy.mjs` uses the current admitted Node executable to
syntax-check the exact stable bytes of every admitted `.mjs` through stdin,
without executing source. It also rejects invalid UTF-8, BOM, NUL, CRLF,
trailing whitespace, missing final newline, path indirection, and noncanonical
Git paths. The existing package-plan scanner remains the only package runtime
import-policy authority.

`sbom.alpha.cdx.json` is a deterministic CycloneDX 1.6 projection of the four
publishable runtime packages and their internal edges. The package-plan gate
parses every exact staged `.mjs` source with Node's module parser and closes all
static `import`/`export` specifiers against the staged package graph. Direct
dynamic-import, CommonJS/module-loader, and code-generation forms are rejected
as reviewed-source hardening. This is not a restricted JavaScript language or a
malicious-code sandbox: computed loader authority is outside the proof and must
be controlled by source review plus the unprivileged CI boundary. The SBOM
intentionally excludes the dev-only TypeScript compiler, PowerPoint, Pandoc,
labs, tests, and ignored artifacts. It is a readable alpha static-dependency
projection, not a signed release attestation or a claim about the complete
development environment.

## Local verification and FileProvider observation

The complete local verification ran from one fixed non-FileProvider working
copy so repeated package transactions did not create new temporary roots. Node
22.23.2/npm 10.9.8 and Node 24.19.0/npm 11.17.0 each passed 1180/1180 tests plus
the real four-tarball pack/install/installed-CLI smoke. The 104/104 focused
workflow/release/package/source/policy set, TypeScript compiler, 260-file
forbidden/provenance gates, 60-row support gate, contracts, release metadata,
and tracked-drift check passed. Independent closing review reported 0 blocker,
0 high, and 0 medium. During
an attempted run in the managed Documents workspace, macOS FileProvider created
nonempty conflict copies of completion/evidence files and a very large conflict
directory while the stage was active. The stage correctly failed closed and the
complete conflicting trees were retained for reconciliation; no unknown member
was deleted. This is availability evidence for the existing threat-model
residual, not permission to weaken the exact stage inventory.

These local macOS results are also recorded in `TODO.md`. They do not substitute
for the six public runner cells.

## Public evidence still required

M3-006 has created the empty public shell, verified PVR, inserted the exact
repository identity into package-plan schema v2/manifests, and regenerated the
static-ESM SBOM projection. The repository-bound M3-003 gate now passes under
both admitted runtimes, including real npm 10/11 four-tarball offline install
and installed CLI smoke. M3-004B must still retain the public URLs and
conclusions for all six CI cells plus CodeQL and Dependency Review. Until then
no platform row, support switch, publication, or security-scan claim is
promoted.

## Next dependency

M3-005A now supplies only the minimum pre-public security, contribution,
governance, and reproducibility text. M3-006 has completed its empty-shell/PVR
prefix, repository binding, and complete dual-runtime package gate; it must now
create and history-scan the reviewed local commit before an exact source ref.
M3-005B keeps final changelog/release wording blocked until public CI evidence
exists rather than predicting it.
