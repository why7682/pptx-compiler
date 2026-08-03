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
TemplateIndex. A separate internal lane now opens the `ProjectContext`-bound
source and validates the public minimal fixture through fixed filesystem,
ZIP/XML/OPC, relationship, and high-risk rejection controls. This is bounded
security evidence, not a published input or arbitrary-template compatibility
claim. A separate runtime-only dispatcher now atomically binds complete trusted
artifact registrations and executes a data-only conformance probe through
batch preflight, input/output schemas, support policy, and QA assertions. The
probe is not a product capability. M2-002 now resolves caller-supplied in-memory
registry/overlay/index/deck documents into private dispatcher invocations and
admits a real clone/fill product executor whose conformance output is a closed
JSON operation plan. The normative row remains `unsupported/unavailable`, so
normal product dispatch is blocked before preflight; no OOXML is cloned,
mutated, staged, or published.

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

- PPTX/POTX inputs remain unsupported. `inspectTemplateSource()` proves only a
  fixed, narrow source-to-index path for the repository-owned minimal grammar;
  no package/CLI is published and no arbitrary template class is promised.
  The direct semantic inspector still performs no archive/XML I/O and a caller
  package-view label still proves no origin.
- ProjectConfig now has automated schema evidence and a pure in-memory
  `ProjectContext` consumer that resolves explicit paths lexically. It remains
  `unsupported`: there is no config file/CLI loader, filesystem-safe input
  opening, or accepted presentation flow.
- Profile/index has automated schema evidence, a reviewed-fixture semantic
  inspector, a bounded secure-ingestion producer, and a pure in-memory
  overlay/index/deck resolver. Registry/overlay and deck/slide documents still
  have no file/CLI loader or accepted project input flow. The clone/fill
  executor produces only semantic operation plans and has no staging authority
  or render flow. Schema-only fixtures remain explicitly excluded from product
  capability conformance evidence.
- Macros, ActiveX, OLE, embedded packages, and external relationships have
  executable rejection mutations in the bounded ingestion lane. Embedded
  fonts, unknown vendor XML, and every unlisted OOXML feature also retain a
  `reject` disposition; none of these rejection results is compatibility or
  capability support.
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
node --test tests/capability-dispatcher.test.mjs
node --test tests/source-slide-clone-fill.test.mjs
```

The gate reads the staged matrix and schema by default, validates their
structure and semantic status combinations, requires catch-all rows, checks
evidence paths against admitted files, and rejects overclaims. Use
`--mode working-tree` only for pre-staging diagnostics.

The contract gate separately validates the staged `0.1.0` schema manifest,
positive examples, cross-document semantics, and generated TypeScript. Passing
it does not alter any support status.

The dispatcher test verifies runtime admission and execution mechanics using a
separate conformance-only probe. The clone/fill test verifies exact semantic
resolution and product artifact conformance, then separately proves that the
normative unavailable decision blocks normal dispatch. Passing either test
does not promote a matrix status or establish presentation output support.
