# M1-001 Synthetic Fixture Handoff

## Objective

Generate one repository-owned minimal presentation as both PPTX and POTX from
reviewed, text-only OOXML source parts. The generated archives are temporary
test artifacts: they remain ignored and are never admitted to Git.

This slice is testing infrastructure only. It does not implement secure input
ingestion, template inspection, rendering, or a supported PPTX capability.

## Clean-room source boundary

The source set under `fixtures/source-parts/minimal/` was authored for this
repository from the public format contract. No existing presentation, Office
output, predecessor file, private fixture, template, image, font file, embedded
object, or third-party brand content was used.

`fixture.json` is the positive allowlist. It declares exactly 12 UTF-8/LF text
parts: content types, internal relationships, presentation properties, one
presentation, one slide, one slide master, one blank layout, and one theme.
PPTX and POTX differ only in the main-part content type.

The structure is grounded in:

- ECMA-376, including the Open Packaging Conventions and PresentationML
  vocabulary: <https://ecma-international.org/publications-and-standards/standards/ecma-376/>;
- Microsoft's PresentationML structure summary and minimum-part description:
  <https://learn.microsoft.com/en-us/office/open-xml/presentation/structure-of-a-presentationml-document>;
- Microsoft's basic presentation-creation relationship graph:
  <https://learn.microsoft.com/en-us/office/open-xml/presentation/how-to-create-a-presentation-document-by-providing-a-file-name>;
- Microsoft's `PresentationDocumentType` documentation distinguishing PPTX and
  POTX: <https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentationdocumenttype>.

These references define interfaces and vocabulary; their example source and
sample presentation content were not copied. Namespace and MIME identifiers are
interoperability constants from the public standard.

## Generator contract

`scripts/generate-synthetic-fixtures.mjs` uses only Node.js built-ins. It:

- validates the manifest with exact fields, reviewed variants, positive limits,
  canonical paths, sorted entries, and duplicate/case-conflict rejection;
- accepts only declared regular UTF-8/LF files and rejects symlinks, drift,
  invalid text, XML document types/entities, high-risk OOXML markers, external
  relationships, missing relationship targets, and unresolved templates;
- writes stored ZIP entries in UTF-8 byte order with a fixed 2000-01-01 DOS
  timestamp, fixed mode, no comments or extra fields, and deterministic CRC-32;
- stages complete files in the destination directory and publishes with
  create-only hard links, cleaning only files created by the failed invocation;
- emits a path-redacted JSON report containing public synthetic-output hashes.

Run `npm run generate:fixtures` only when `fixtures/generated/` is empty. A
second run fails closed rather than overwriting output. Generated files are
covered by both directory and extension ignore rules.

## Verification and claim boundary

`tests/synthetic-fixture.test.mjs` independently parses the produced ZIP
records, compares repeated builds byte-for-byte, checks the minimal internal
graph and PPTX/POTX content-type distinction, scans for branding and high-risk
features, exercises create-only publication, and runs failure mutations.

The repository support switch remains false. These tests establish the public
synthetic evidence lane, not correctness on arbitrary or untrusted packages.
Secure ZIP/XML ingestion remains `M1-005`; schema validation beyond the bounded
fixture contract remains outside this slice.

## Acceptance sequence

```sh
npm test
npm run check:working-tree
npm run check:public-tree
git diff --cached --check
git status --short --branch
```

Before completion, obtain one bounded independent read-only provenance review
covering only the M1-001 source parts, generator, tests, task record, and public
contract updates. Stop after the reviewed slice is committed and the worktree
is clean.

## Completion evidence — 2026-07-31

- The complete suite passed 75/75 tests, including 66 rejection mutations; the
  fixture suite passed 28/28 with 22 focused mutations.
- All text parts passed local XML well-formedness checks; both generated variants
  passed local ZIP integrity checks. The dependency-free public tests perform
  their own byte, CRC, directory, graph, and policy assertions.
- The independent review's four blocking validation classes were fixed and
  regression-tested. Its closing pass reported no blocking findings.
- Staged forbidden-material, provenance, and support-matrix gates passed for all
  48 admitted files. No generated archive was staged or left in the worktree.
- Full untrusted XML/package validation remains M1-005 work. The reviewed source
  reader has a local concurrent-replacement window between metadata and content
  reads and must not be reused as an untrusted ingestion boundary.
