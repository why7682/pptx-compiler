# M1-004 Template Inspector Handoff

## Scope and architecture boundary

M1-004 adds a dependency-free semantic template inspector. Core accepts an
explicit `ProjectContext 0.1.0`, an already parsed `TemplatePackageView 0.1.0`,
and an injected synchronous validator for the normative `TemplateIndex 0.1.0`
schema. It emits a deterministic, detached, deeply frozen index and performs no
filesystem, ZIP, decompression, or XML work.

This split is intentional. A package view is an explicit runtime adapter
contract, not a security credential. The current producer class is admitted
only for the repository-owned reviewed fixture lane. M1-005 remains responsible
for safely converting arbitrary untrusted PPTX/POTX files into an equivalent
view after canonical open, archive, resource, XML, relationship, and high-risk
part checks.

The inspector is independently authored from the public contracts and the
reviewed synthetic OOXML source parts. No predecessor repository, private
fixture, presentation binary, managed helper, or presentation application was
read or used.

## Runtime API

The implementation is `packages/core/src/template-inspector.mjs`:

```js
const templateIndex = inspectTemplate({
  context,
  packageView,
  dependencies: {
    validateTemplateIndex
  }
});
```

`validateTemplateIndex(value)` must synchronously validate the exact normative
schema and return literal `true`. Throws, promises, and every other result fail
closed. Core never imports repository gate code from `scripts/`.

`TemplatePackageView 0.1.0` contains only normalized technical facts:

- an exact source-location binding to `ProjectContext.locations.templateSource`;
- format and archive SHA-256 supplied by the reviewed producer;
- canonical content-part paths and exact content types;
- resolved internal relationship sets with owner, ID, type, and target;
- presentation size and ordered master/slide references;
- ordered master-to-layout references;
- normalized layout/slide shapes with source ID, kind, EMU geometry, and
  optional explicit placeholder metadata;
- sorted observed feature IDs and an explicit unhandled-feature list.

It deliberately contains no shape names, common-slide names, slide text,
typeface names, local metadata, or implicit project lookup.

## Determinism and graph invariants

The inspector discovers the presentation through the unique package-root
`officeDocument` relationship and verifies format, main content type, and the
configured source extension agree. It rejects unknown content and relationship
types, missing/dangling/duplicate edges, part-path case aliases, orphan models,
ambiguous ownership, non-reciprocal master/layout links, invalid source IDs,
invalid geometry, duplicate placeholders, and any non-empty unhandled-feature
set.

Keys are technical ordinals derived only from owner order and shape z-order:
`master-1`, `layout-1`, `slide-1`, and per-container `shape-1`. OOXML IDs remain
separate `sourceId` values. Names and text never influence a key. Layout order
is the ordered traversal of presentation masters and each master's layout list;
slide order is the presentation slide list.

The current bounded view vocabulary covers the public minimal fixture graph
and normalized DrawingML auto-shape, placeholder, and text-box entries.
The reviewed producer compares a normalized structural fingerprint before it
emits facts, masking only the names, text, source IDs, and geometry values that
are intentionally derived or redacted. Attribute order and insignificant
whitespace do not matter; an unmodeled attribute, child, transition, timing, or
extension changes the fingerprint and fails closed. Core separately rejects any
non-empty unhandled-feature list.

## Claim and task boundary

This slice proves a distributable, side-effect-free semantic module can inspect
the repository-owned synthetic facts and produce a schema-valid redacted index.
It does **not** accept a user-owned `.pptx` or `.potx`, prove a caller-created
view is truthful, resolve a TemplateProfile or ProjectOverlay, dispatch a
capability, render, mutate, or write a presentation. All support-matrix rows
remain unsupported and the global claim switch remains false.

M1-005 still owns filesystem identity, symlink and TOCTOU handling, ZIP
headers/CRC/compression/traversal/duplicates/case conflicts, decompression and
resource limits, XML well-formedness/entity/parser limits, external
relationships, macros, ActiveX, OLE, embedded objects/packages, and arbitrary
user input. M3-002/M3-003 still own npm package metadata, tarball allowlists,
and literal `npm pack` clean-install evidence.

Until package metadata exists, the M1-004 clean-install exit criterion is
verified as a clean-directory module-closure smoke: the required core modules
and a runtime-generated public package view are copied to an empty directory
and executed from an unrelated working directory. This is not described as an
npm installation.

## Verification target

The M1-004 tests must cover exact public PPTX/POTX results, repeated byte
determinism, normative schema validation, redaction, context/view binding,
format/digest/content/relationship/ownership/geometry mutations, frozen
snapshots, unhandled features, output-validator failure, source-order and
z-order preservation, clean-directory execution, and static scans excluding
filesystem/archive/XML/private-helper dependencies from core.

Completion evidence is recorded only after the full supported-Node test matrix,
working/staged public gates, and one bounded independent closing review pass.

## Completion evidence — 2026-08-01

- The exact public POTX result matches
  `fixtures/inspection/expected-potx-template-index.json`; the PPTX result has
  the same semantic graph and differs only in `templateFormat` and its exact
  archive SHA-256. `npm run inspect:synthetic` reproduces the golden.
- The inspector suite passes 119/119 test nodes, including 94 focused rejection
  mutations. The complete repository suite passes 344/344.
- The same 344-test suite passes on Node.js 22.23.1 and Node.js 24.14.0.
- The clean-directory module-closure smoke copies only the required public core
  modules and a runtime-generated package view, then inspects from an unrelated
  cwd. It is intentionally not described as an npm installation.
- Working-tree and staged forbidden-material, exact provenance, support-matrix,
  and versioned-contract gates pass for the 80-file public tree. The checked
  support matrix still has 60 rows, zero supported rows, and
  `supportClaimsEnabled: false`.
- The bounded independent review identified three release blockers: the first
  reviewed producer could omit unmodeled OOXML, core copied an entire caller
  view before bounds, and slide-size extra fields were silently dropped. A
  normalized OOXML fingerprint, bounded descriptor-based normalization, and
  exact `{cx, cy}` validation closed all three. The same reviewer rechecked the
  fixes and reported no remaining or newly introduced blocker.
