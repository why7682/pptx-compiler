# M1-003 ProjectContext Handoff

## Status and boundary

M1-003 implements the first core runtime context without changing the normative
`ProjectConfig 0.1.0` data contract. `createProjectContext` accepts an explicit
absolute project root, a project-config value, and an explicit validation
dependency. It never searches Git, the current working directory, environment
variables, module ancestry, or a workstation for a project root or input.

This implementation is independently authored from the repository contracts.
It does not inspect predecessor code, presentations, generated archives,
private fixtures, or presentation assets.

## Runtime API

The implementation lives in `packages/core/src/project-context.mjs`; no
publishable package metadata or npm name is introduced before M3-002.

```js
const context = createProjectContext({
  projectRoot,
  projectConfig,
  dependencies: {
    validateProjectConfig
  }
});
```

`validateProjectConfig(value)` is a required synchronous dependency. It must
validate the exact `ProjectConfig 0.1.0` JSON Schema and return the literal
`true`; a throw or any other return value fails closed. Core does not import the
repository gate under `scripts/`, so product code does not depend on build and
admission tooling.

The returned context has a fixed runtime shape:

- `contextVersion: "0.1.0"` and `contextType: "project-context"`;
- the normalized explicit absolute `projectRoot`;
- a detached, deeply frozen `projectConfig` snapshot;
- eight absolute `locations` resolved from the corresponding canonical
  repository-relative config paths;
- a frozen snapshot of the explicit validation dependency.

The eight locations are `templateSource`, `templateProfile`, `templateIndex`,
`capabilityRegistry`, `projectOverlay`, `assetRoot`, `stagingRoot`, and
`outputRoot`. There is deliberately no general-purpose path resolver that could
turn an arbitrary string into an accepted project path.

## Fail-closed invariants

- options and dependency objects have exact data-property shapes; accessors,
  symbols, unknown fields, non-JSON config values, and cyclic values fail;
- a root is required, absolute, control-character-free, and never made absolute
  from the process working directory;
- the config is revalidated on every construction and must retain the exact
  version and contract type;
- every configured path is defensively checked against the canonical narrow
  relative-path language and must resolve lexically below the explicit root;
- asset, staging, and output roots are pairwise distinct and non-nested under a
  conservative ASCII case fold;
- the five input-document roles cannot use equal case-folded relative paths, so
  one file cannot ambiguously serve two closed contract types;
- the template source cannot be equal to or beneath staging/output, including a
  case-only alias;
- errors expose only a stable code and public contract pointer, never an input
  value or absolute local path;
- contexts contain no module-level project singleton or cache, so independent
  roots cannot contaminate one another.

These checks replay the existing `0.1.0` path semantics plus the runtime
case-alias responsibility. They do not silently add a rule forbidding profile,
index, registry, or overlay control files beneath a write root; such a rule
would require a separately versioned data-contract decision.

## Security claim boundary

ProjectContext produces **normalized, lexically contained locations**. It does
not call `lstat`, `realpath`, or `open`, does not require paths to exist, and
does not label a path safe, verified, or canonical on the filesystem. A
constructor-time filesystem observation could be invalidated before a later
read and therefore cannot establish symlink or TOCTOU safety.

Actual consumers must validate again at the time of use. Secure untrusted input
opening, intermediate/final symlink defenses, file-handle identity and bounded
reads, archive limits, ZIP member traversal/duplicate/case-conflict handling,
XML limits, external relationships, macros, ActiveX, OLE, and embedded objects
remain M1-005. Template inspection remains M1-004. Staging creation and atomic
publication remain M2-005.

The schema-conformance project config is test data for context construction
only. It is not an accepted presentation, inspector, executor, render, QA, or
support artifact. `supportClaimsEnabled` remains false.

## Verification

`tests/project-context.test.mjs` covers the fixed positive shape, independent
contexts, detached immutability, working-directory independence, exact
dependency behavior, invalid/non-JSON inputs, root failures, traversal and
non-canonical path mutations, containment, root alias/nesting, every pair of
input-document roles, source/write conflicts, redacted errors, and source scans
for ambient discovery or out-of-scope I/O.

The M1-003 suite contributes 79 test nodes with 60 focused rejection mutations.
The complete 225-test repository suite passed on Node.js 22.23.1 and 24.14.0.
Working-tree and staged public-tree gates passed after the independent review
finding was fixed and regression-tested; the closing review reported no
remaining blocker. Cross-platform OS evidence remains M3-004B after M3-006.
