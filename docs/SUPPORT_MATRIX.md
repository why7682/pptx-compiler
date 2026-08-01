# Public Support Matrix

The normative matrix is `policy/support-matrix.json`, validated against
`schemas/support-matrix.schema.json`. This document is a human summary and does
not broaden any machine-readable claim.

## Current truth

The project is `pre-alpha-contract-only`, and `supportClaimsEnabled` is `false`.
There is no supported PPTX input, OOXML feature, renderer capability, or output
flow yet. The executable code currently in this repository protects admission
and validates this policy. It also validates the version `0.1.0` data-contract
shapes, creates ignored repository-owned synthetic PPTX/POTX test data, and
normalizes that reviewed lane's explicit parsed package view into a redacted
TemplateIndex. It does not open, accept, dispatch, or render user presentations.

| Dimension | Items | Supported | Experimental | Manual | Unsupported |
| --- | ---: | ---: | ---: | ---: | ---: |
| Inputs | 13 | 0 | 0 | 0 | 13 |
| OOXML features | 22 | 0 | 0 | 0 | 22 |
| Capabilities | 8 | 0 | 0 | 0 | 8 |
| Platforms | 10 | 0 | 6 | 1 | 3 |
| Evidence levels | 7 | 0 | 1 | 2 | 4 |
| **Total** | **60** | **0** | **7** | **3** | **50** |

The six experimental platform rows are only the declared Node.js 22.x/24.x
runtime envelope on Linux, macOS, and Windows. They remain experimental until
public cross-platform CI exists, and they imply no PPTX feature support.

## Status vocabulary

- `supported`: the exact scope has a dispatchable implementation and all
  required public conformance evidence. A capability additionally needs
  metadata, executor, input/output schemas, conformance fixture, and QA
  assertions.
- `experimental`: a bounded implementation path or contract exists, but its
  stability or required evidence is incomplete. It must remain labeled at all
  public boundaries.
- `manual`: an explicit trusted human or external-runtime gate is required.
  The result remains unresolved until recorded and never becomes an automatic
  pass.
- `unsupported`: reject or report unavailable before output mutation. There is
  no silent fallback, preservation guess, or flatten-to-image escape hatch.

Roadmap entries describe intended work only. They do not change current status.

## Important boundaries

- PPTX/POTX inputs remain unsupported. The pure semantic inspector does not
  open archives or parse XML; secure ZIP/XML ingestion and accepted CLI input
  remain M1-005/M3 work. Producing and inspecting the bounded synthetic lane
  does not make arbitrary packages accepted input.
- ProjectConfig now has automated schema evidence and a pure in-memory
  `ProjectContext` consumer that resolves explicit paths lexically. It remains
  `unsupported`: there is no config file/CLI loader, filesystem-safe input
  opening, or accepted presentation flow.
- Profile/index has automated schema evidence plus a reviewed-fixture semantic
  inspector, but no secure input or profile/overlay resolver. Registry/overlay
  and deck/slide schemas still have no runtime resolver or dispatcher.
  Schema-only fixtures are explicitly not capability conformance evidence.
- Macros, ActiveX, OLE, embedded packages, external relationships, embedded
  fonts, unknown vendor XML, and every unlisted OOXML feature have a target
  disposition of `reject`. That rejection is not executable PPTX evidence yet.
- Native charts, tables, arbitrary animations, media, notes/comments, and
  digital-signature handling have no 0.x support promise unless a later matrix
  revision says otherwise.
- PowerPoint automation is a manual trusted lane only. It is optional, absent
  from public PR CI, and cannot replace public synthetic conformance.
- Predecessor observations, compilation success, screenshots, and private
  fixture results cannot independently establish public support.

## Verification

Run:

```sh
npm run check:support-matrix
npm run check:contracts
```

The gate reads the staged matrix and schema by default, validates their
structure and semantic status combinations, requires catch-all rows, checks
evidence paths against admitted files, and rejects overclaims. Use
`--mode working-tree` only for pre-staging diagnostics.

The contract gate separately validates the staged `0.1.0` schema manifest,
positive examples, cross-document semantics, and generated TypeScript. Passing
it does not alter any support status.
