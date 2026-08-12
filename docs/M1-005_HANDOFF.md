# M1-005 Secure ZIP/XML Ingestion Handoff

## Scope and claim boundary

M1-005 adds a dependency-free, fail-closed path from the source named by a
frozen `ProjectContext 0.1.0` to the existing semantic inspector. The public
high-level operation is:

```js
const templateIndex = await inspectTemplateSource({
  context,
  dependencies: { validateTemplateIndex }
});
```

The caller cannot supply another path, parser, package view, resolver, network
hook, or relaxed limit. The operation reads one stable bounded byte snapshot,
validates a deliberately narrow ZIP/XML/OPC/PresentationML profile entirely in
memory, creates `TemplatePackageView 0.1.0` with producer class
`secure-ooxml-ingestion`, and passes it to the pure semantic inspector.

This is a secure ingestion baseline for the repository-owned public minimal
fixture class. It is not a general XML parser, general ZIP reader, arbitrary
OOXML compatibility layer, published CLI, renderer, or support claim. The
machine support switch remains false, all PPTX/POTX and capability rows remain
unsupported, and direct caller-created package views remain non-credentials.

## Module boundary

- `secure-template-ingestion.mjs` owns exact option/context validation, stable
  source-file snapshotting, error redaction, and the one-step high-level API.
- `secure-zip.mjs` owns the bounded non-extracting ZIP profile.
- `strict-xml.mjs` owns the bounded namespace-aware XML subset parser.
- `ooxml-package-view.mjs` owns content types, internal relationships, the
  narrow PresentationML/Theme vocabulary, and normalized package-view facts.
- `template-inspector.mjs` remains the semantic graph validator/normalizer. It
  admits the new producer label structurally; the label alone is not proof of
  secure origin. Only the high-level operation establishes the complete chain.

Core imports only Node built-ins and other core modules. It does not import the
synthetic-fixture generator, gate scripts, CLI code, private helpers, external
XML/ZIP packages, network APIs, child processes, environment state, or an
ambient repository root.

## Fixed resource profile

The initial profile is intentionally small and cannot be relaxed by a caller:

| Resource | Limit |
| --- | ---: |
| Archive bytes | 1 MiB |
| Central directory | 128 KiB |
| ZIP members | 32 |
| Compressed bytes per member | 256 KiB |
| Expanded bytes per member | 256 KiB |
| Total declared expanded bytes | 1 MiB |
| Compression ratio | 100:1 |
| Member path | 512 UTF-8 bytes |
| Local extra field per member | 4 KiB |
| Total local extra fields | 32 KiB |
| XML bytes per part | 256 KiB |
| XML depth | 64 |
| Elements per part | 10,000 |
| Elements per package | 50,000 |
| Attributes per element / part | 32 / 10,000 |
| Root namespace declarations | 16 |
| QName / attribute value | 128 bytes / 4 KiB |
| Text node / decoded text per part | 64 KiB / 256 KiB |
| Relationships per package | 128 |
| Modeled shapes per slide | 128 |

Only stored and raw-DEFLATE members are admitted. Central-directory extra fields
are rejected. A local header may contain only one complete, bounded Open
Packaging Growth Hint (`0xA220`) with the expected `0xA028` signature, exact
lengths, and zero-filled padding; the repository's deliberately narrow profile
also requires the recorded initial padding length to equal the current padding.
ZIP64, encryption, data descriptors, every other extra field, comments,
multiple disks, prefixes, trailing data,
directory/symlink/special entries, nested archives, duplicate names, ASCII
case aliases, non-contiguous or overlapping local records, local/central drift,
CRC drift, output-size drift, compression-ratio excess, and DEFLATE trailing
data are rejected before any package view is produced. Members are never
extracted to the filesystem.

## Filesystem safety contract

The source location is derived only from `ProjectContext.projectRoot`, the
validated relative `template.sourcePath`, and the exact precomputed
`locations.templateSource` binding. The reader:

1. `lstat`s the project root and every source-path component and rejects a
   symbolic-link component or unexpected node type;
2. verifies canonical containment with `realpath`;
3. opens the final component read-only with `O_NOFOLLOW` where Node exposes it;
4. compares the opened regular-file identity with the path identity;
5. reads exactly the bounded pre-open size through the same `FileHandle`, then
   checks that no additional byte exists;
6. compares device, inode, size, modification time, and change time before and
   after reading;
7. repeats the component walk and canonical containment check; and
8. parses only the detached in-memory snapshot and binds its SHA-256 to the
   resulting index.

The implementation does not claim a formally race-free descriptor-relative
walk. Portable Node.js 22/24 does not expose `openat2`/equivalent containment
on every target platform, and Windows does not expose the same `O_NOFOLLOW`
semantics. A process that can concurrently rewrite ancestor namespace entries,
hard-link aliases, unusual reparse points, or network-filesystem metadata is a
residual threat. Strong hostile-directory guarantees require a native platform
broker or a trusted host-provided already-open handle. M1-005 instead guarantees
a bounded stable opened-handle snapshot and rejects detected path or identity
changes.

## XML and OPC profile

The XML parser accepts BOM-free fatal UTF-8 XML 1.0, one optional bounded XML
declaration, one root, strict tag pairing, legal XML characters, the five
predefined entities, legal numeric character references, and namespace-expanded
QNames. It rejects DTD/entity declarations, comments, CDATA, processing
instructions after the declaration, unbound/reserved namespace misuse,
duplicate expanded attributes, unknown markup, and every resource-limit excess.
It performs no external resolution and has no network entry point.

Every archive member must be consumed as `[Content_Types].xml`, an OPC
relationship part, or an allowlisted XML content part. Content-type overrides
must exactly cover every non-relationship part. Relationship owners must exist;
IDs are unique; types are allowlisted; targets are internal, canonical,
case-exact, and present. `TargetMode`, schemes, authorities, absolute paths,
backslashes, percent encoding, query/fragment suffixes, and root escape are
rejected.

The namespace-expanded OOXML grammar consumes only the public minimal profile:
one presentation graph, presentation properties, masters with no modeled
shapes, blank layouts with no modeled shapes, slides containing only explicitly
bounded text boxes, and an exact bounded theme structure. Prefix and attribute
order do not carry meaning. Unknown elements, attributes, namespaces,
transitions, timing, extension lists, shapes, parts, content types, or
relationships fail closed. Names, slide text, and typeface values are validated
but omitted from `TemplateIndex`.

Macros/VBA, ActiveX, OLE, embedded packages/objects, digital-signature and other
high-risk paths, content types, relationship types, namespaces, and element
markers are rejected. External relationships are rejected before resolution;
no network access occurs. Unsupported non-high-risk features are also rejected,
not silently preserved or flattened.

## Standards basis

The narrow parser was independently authored from repository contracts, the
repository-owned text fixture, and public specifications. ZIP record semantics
follow the PKWARE APPNOTE; parts/content-types/relationships follow ECMA-376
OPC; filesystem and DEFLATE behavior use documented Node.js APIs:

- <https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT>
- <https://ecma-international.org/publications-and-standards/standards/ecma-376/>
- <https://nodejs.org/download/release/latest-v22.x/docs/api/fs.html>
- <https://nodejs.org/download/release/latest-v22.x/docs/api/zlib.html>

No predecessor repository, private fixture, presentation binary, presentation
application, generated deck, prompt/log, or managed helper was inspected or
admitted.

## Completion evidence — 2026-08-01

- The focused secure-ingestion suite passes 78/78 test nodes. It covers exact
  stored and DEFLATE POTX/PPTX inspection plus filesystem, ZIP, XML, namespace,
  OPC graph, high-risk, redaction, and dependency-boundary adversarial cases.
- The complete repository suite passes 422/422 on Node.js 22.23.1 and Node.js
  24.14.0, as well as on the local development runtime.
- The bounded independent closing review found a content-type child fail-open,
  separate archive-bytes/digest inputs, and missing direct regressions. All
  were fixed and rechecked; no blocker or high finding remains.
- Working-tree and staged forbidden-material, exact provenance, support-matrix,
  and versioned-contract gates pass, as do the deterministic synthetic
  inspection harness and staged diff check.
- `supportClaimsEnabled` remains false and every matrix row remains
  non-supported. No package metadata, publishability, arbitrary-template,
  renderer, or cross-platform filesystem claim is added.
