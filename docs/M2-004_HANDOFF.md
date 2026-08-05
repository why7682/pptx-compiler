# M2-004 Optional Pandoc/OMML Adapter Handoff

## Scope and claim boundary

M2-004 adds a bounded optional external-process adapter and one
`formula-transplant@0.1.0` capability definition. A closed in-memory display
formula, one resolved `formula-target` text-box binding, and a successfully
probed adapter can travel through the existing M2-002 resolver and M2-001
dispatcher to produce a deterministic clone/replace plan plus one canonical
`m:oMath` conformance fragment.

The result is deliberately:

```json
{
  "artifactKind": "unbound-omml-conformance-fragment",
  "insertable": false,
  "applicationPolicy": "typed-rebuild-required"
}
```

It is not a PresentationML text body, shape mutation, PPTX/POTX package,
BuildArtifact, or editable-PowerPoint result. M2-005 must define and prove the
typed target-shape wrapper, package mutation, source isolation, collateral diff,
staging, and publication boundary. `COMPAT-OMML-001` remains the separate
trusted manual open/edit/save/reopen check.

The normative `formula-transplant`, `latex-formula`, and `native-omml` rows all
remain `unsupported/unavailable`. Public tests use a fake process runner and
repository-authored in-memory DOCX text. No compatible real-Pandoc public
matrix exists, `supportClaimsEnabled` remains `false`, and no row is promoted.

## Exact implementation artifacts

- `packages/adapter-pandoc-omml/src/node-process-runner.mjs`
- `packages/adapter-pandoc-omml/src/pandoc-omml-adapter.mjs`
- `packages/adapter-pandoc-omml/src/formula-transplant.mjs`
- `packages/adapter-pandoc-omml/schemas/input.schema.json`
- `packages/adapter-pandoc-omml/schemas/output.schema.json`
- `fixtures/capabilities/formula-transplant/registry.json`
- `fixtures/capabilities/formula-transplant/project-overlay.json`
- `fixtures/capabilities/formula-transplant/deck-spec.json`
- `fixtures/capabilities/formula-transplant/cases.json`
- `tests/pandoc-omml-adapter.test.mjs`
- `docs/PANDOC_ADAPTER_ATTRIBUTION.md`

No package manifest is added before M3-002. Core, the dispatcher, the resolver,
the eight root `0.1.0` data schemas, and generated TypeScript declarations do
not change.

## External-process boundary

`createPandocProcessRunner()` is the sole module that imports
`node:child_process`. It requires trusted host configuration with an explicit
absolute executable and working directory plus a bounded allowlisted
environment. It never reads `process.env`, `cwd`, a registry URN, a DeckSpec,
or formula data to choose the process.

Each request has a dense fixed argv, copied stdin bytes, a timeout, and separate
stdout/stderr ceilings. The runner uses `spawn` with `shell: false`, pipes only,
and no inherited stdio. It enforces both stream ceilings while reading, kills on
timeout/overflow, consumes stdin errors, and returns one closed outcome:

- `completed`
- `not-found`
- `spawn-failed`
- `timed-out`
- `output-limit`
- `signaled`

Only a successful zero exit with empty stderr and nonempty bounded stdout can
advance. Path, environment, raw stderr, signal detail, and formula text never
enter adapter errors or capability output.

## Detection and version profile

`createPandocOmmlAdapter()` performs three fixed probes before it returns an
`available` facade:

1. `pandoc --version` must emit a canonical version line.
2. A sandboxed Markdown-to-JSON probe must expose a bounded Pandoc API version.
3. A repository-owned `\frac{1}{1}` Math JSON AST must produce bounded DOCX
   stdout whose canonical fragment exactly matches the adapter profile.

The eligibility window is Pandoc `>=2.15.0 <4.0.0`; availability still requires
all active probes. Version 2.15 is the floor because upstream introduced
`--sandbox` there. The process calls also use
`--fail-if-warnings`, `--output=-`, fixed 128 MiB heap/16 MiB stack RTS requests,
and no filters, custom writers, input files, URLs, resource paths, defaults, or
reference document.

Missing, incompatible, malformed, timed-out, output-limited, nonzero, warning,
or capability-drifting tools return a frozen unavailable/incompatible facade.
Only an `available/ready` facade can construct the executor registration. If
Pandoc is absent, the registry may still declare the known capability while the
runtime omits its registration; normal dispatch then fails with the existing
capability-unavailable boundary rather than failing runtime admission.

## Formula transport

The capability payload is exactly:

```json
{
  "displayMode": "display",
  "latex": "\\frac{a}{b}"
}
```

It is not a LaTeX document, Markdown string, path, command, or environment
value. Preflight applies an O(1) code-unit ceiling before code-point and UTF-8
checks, rejects blank/edge-whitespace/control/Cf/unpaired-surrogate/noncharacter
text, limits brace depth, and rejects document/file/network/macro primitives.

The adapter JSON-encodes the validated string as the data value of one Pandoc
`Math/DisplayMath` AST node using the API version captured by detection. The
formula appears only in stdin. Because it never enters argv or a shell, quotes,
backslashes, parentheses, and ordinary TeX math syntax cannot change process
selection or command structure.

## DOCX and OMML boundary

Pandoc stdout is treated as untrusted binary data. It first passes the existing
non-extracting secure ZIP profile:

- at most 1 MiB archive and expanded bytes;
- at most 32 members;
- at most 256 KiB compressed/uncompressed per member;
- at most 100:1 compression ratio;
- no traversal, aliases, encryption, data descriptors, extra fields, ZIP64,
  nested ZIPs, or ambiguous records.

The adapter then requires `[Content_Types].xml`, `_rels/.rels`, and
`word/document.xml`; classifies every part against the fixed formula-DOCX set;
requires each override and internal relationship target to name a present
allowlisted part, the non-macro Word main content type, and one office-document
relationship; and rejects duplicate content-type identities, dangling,
external/unsafe/encoded relationships, or unknown parts.

Every inspected XML part passes `parseStrictXml()`. The Word document must have
one exact body/paragraph/display-math wrapper, no extra body text, and exactly
one `m:oMath`. The formula subtree accepts only the initial closed OMML element
and attribute vocabulary, exact run/fraction/superscript/subscript/radical child
topology, and fixed property values, with tighter 256-element, 128-attribute,
4 KiB text, and 16 KiB fragment limits. It is rebuilt from namespace-expanded
parsed nodes with canonical `m`/`xml` prefixes and XML escaping. Raw substring
extraction, regex capture, namespace-prefix trust, structurally rearranged
allowlisted elements, and raw XML transplantation are forbidden.

## Capability contract

The registry requires exactly one `formula-target` role resolving to one slide
`text-box`. The executor returns:

1. a semantic source-slide clone operation;
2. a target-bound replace operation with `typed-rebuild-required`;
3. an unbound native-office-math component with no input formula duplication,
   executable path, Pandoc version, stderr, relationship, or raster fallback.

Four ordered QA assertions bind the target, non-insertable application boundary,
canonical native OMML structure, and operation semantics. Registration
conformance executes only with an already available adapter. Under the
normative unsupported decision, dispatcher authorization rejects the capability
before product preflight or process execution.

## Attribution and redistribution

D-008 accepts the external-process-only design. Pandoc upstream identifies the
program as GPL-2.0-or-later. This repository ships only independently authored
MIT adapter code and does not bundle, link, install, copy, or redistribute
Pandoc, its libraries, templates, reference document, source, or generated DOCX.
The precise technical and generated-output caveats are recorded in
`docs/PANDOC_ADAPTER_ATTRIBUTION.md`.

## Public evidence and residual risk

The focused tests use fake outcomes and text-derived stored/Deflate DOCX bytes
constructed in memory. They cover version/capability detection, fixed requests,
real Node no-shell/timeout/stream behavior, input isolation, resolver/dispatcher
integration, unavailable policy, batch preflight, ZIP/OPC/XML/OMML mutations,
canonical output, schema/QA drift, no-I/O module separation, and clean-directory
closure. The focused adapter suite passes 115/115, the strict
dispatcher/resolver/native/formula/support focus passes 330/330, and the full
738-test suite passes on Node.js 22.23.1 and 24.14.0. The bounded closing review
found one high relationship-prefix bypass and one medium content-type
overbreadth. Exact mappings plus 10 regression subtests closed both; bounded
re-review found no remaining blocker or high finding.

The fake runner proves the adapter contract, not compatibility with a real
Pandoc release. A compromised executable, OS-level process tree, kernel resource
accounting, version-to-version TexMath changes, font/layout behavior, target
PowerPoint wrapping, and edit/save/reopen behavior remain outside this slice.
The Node runner can request and police timeout/streams but cannot provide a
portable kernel memory or descendant-process sandbox; the fixed Pandoc RTS
limit and `--sandbox` reduce rather than eliminate that residual.

M2-005 is the next dependency. It must consume typed/validated operation data,
not concatenate this conformance string, and must retain fail-closed behavior if
the target shape cannot accept the exact native formula representation.
