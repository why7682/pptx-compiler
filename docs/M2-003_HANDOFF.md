# M2-003 Native Card-Arrow Handoff

## Scope and claim boundary

M2-003 adds the first narrowly executable native DrawingML product capability,
`native-card-arrow` version `0.1.0`. A schema-validated data-only slide payload
resolves through the existing M2-002 project resolver and M2-001 dispatcher,
then deterministically produces a closed component plan and one canonical
PresentationML `p:grpSp` exemplar. The group contains two native `p:sp`
children: a text-bearing `roundRect` card and a `rightArrow` auto shape. No
raster fallback exists.

The XML is deliberately an **unbound conformance fragment**, not a package
mutation. Its wrapper fixes `artifactKind` to
`unbound-drawingml-conformance-fragment`, `insertable` to `false`, `idScope` to
`component-local`, and the planned placement policy to
`local-remap-required`. Local exemplar IDs `1`, `2`, and `3` prove only internal
uniqueness; they are expected to collide with real slide object IDs and must
never be copied directly into a target shape tree.

This slice does not create or modify a PPTX/POTX, validate the component against
the target slide size, allocate final OOXML IDs, mutate relationships, stage a
package, prove source isolation, publish an output, or run PowerPoint. It proves
a native non-raster component representation, not an insertion-ready artifact
or a manually verified editable presentation. Those application and
compatibility obligations remain M2-005 work.

Accordingly, M2-003's TODO exit criterion is clarified in this same slice. The
milestone exits when the data-only spec reaches this strict native non-raster
group exemplar through the shared dispatcher. It does not exit by claiming
target insertion or PowerPoint editability; M2-005 must establish both with a
complete package and the named automated/manual evidence.

## Exact capability artifacts

The registry binds:

- capability: `native-card-arrow@0.1.0`;
- support item: `native-drawingml`;
- executor:
  `urn:pptx-compiler:capability:executor:native-card-arrow:0.1.0`;
- input schema:
  `urn:pptx-compiler:capability:schema:native-card-arrow-input:0.1.0`;
- output schema:
  `urn:pptx-compiler:capability:schema:native-card-arrow-output:0.1.0`;
- QA contract:
  `urn:pptx-compiler:capability:qa:native-card-arrow:0.1.0`;
- required binding role: exactly `anchor`;
- conformance fixtures: `native-card-arrow-basic` and
  `native-card-arrow-escaping`, in lexical order.

The resolver is unchanged. The public integration overlay binds `anchor` to one
real repository-owned synthetic slide text box with
`containerKind: "slide"`, `expectedKind: "text-box"`, and
`cardinality: "exactly-one"`. The binding identifies the source slide and the
intended z-order anchor; the plugin neither reads nor changes the bound shape.
One project selection may be reused by multiple DeckSpec slides, and each slide
supplies independent component data.

## Data-only input

The closed payload is:

```js
{
  geometry: { x, y, cx, cy },
  label,
  style: {
    arrowFill,
    cardFill,
    fontSizeHundredthPoints,
    lineColor,
    textColor
  }
}
```

Coordinates and extents are integer EMUs in a fixed bounded planning canvas.
`x` and `y` are nonnegative; `cx` is at least 914,400; `cy` is at least
457,200; all values and their sums are at most 100,000,000. These checks prevent
negative, zero, fractional, non-finite, overflowed, and degenerate component
geometry. They are not a substitute for M2-005 containment against the actual
`TemplateIndex.slideSizeEmu`.

All colors are exactly six uppercase hexadecimal digits and serialize only as
`a:srgbClr`. Font size is an integer from 800 through 4,400 hundredth-points.
The label is nonblank, at most 256 Unicode scalar values and 1 KiB UTF-8.
Control characters, line separators, format controls, unpaired surrogates, and
Unicode noncharacters fail closed. A code-unit ceiling runs before UTF-8
encoding. No QName, XML node, attribute name, relationship, preset geometry,
file, path, or source ID can enter through the payload.

## Closed native representation

The executor first creates a fixed typed internal tree, then a canonical
serializer escapes text and attribute values. User data never selects element
or attribute names. The only generated namespaces are the public DrawingML,
PresentationML, and built-in XML namespaces. The fixed hierarchy is:

```text
p:grpSp
├─ p:nvGrpSpPr
├─ p:grpSpPr/a:xfrm
├─ p:sp (roundRect card)
│  ├─ p:nvSpPr
│  ├─ p:spPr (transform, srgb fill, srgb line)
│  └─ p:txBody (one paragraph, one run, one a:t)
└─ p:sp (rightArrow)
   ├─ p:nvSpPr
   └─ p:spPr (transform, srgb fill, srgb line)
```

The group transform uses the requested outer geometry with child coordinates
starting at zero. The card receives 70 percent of the group width, a 10 percent
gap follows, and the arrow receives the remaining width at half height,
vertically centered. Integer remainder stays with the arrow, so both shapes
remain deterministic and contained in the component coordinate system. The
card preserves leading and trailing spaces with `xml:space="preserve"` and
does not use the text-box flag; it remains a native auto shape with text.

Before QA accepts the result, the executor reparses the emitted UTF-8 through
the repository strict XML parser and checks the exact expanded-name allowlist,
namespace set, element/attribute counts, object count/order, local ID/name
sequence, preset sequence, decoded label, and color sequence. The canonical
output comparison additionally rejects reordered, added, removed, or altered
nodes and attributes. The vocabulary contains no `p:pic`, `p:graphicFrame`,
`p:cxnSp`, `a:blip`, custom geometry, theme/gradient/pattern color, hyperlink,
relationship attribute, extension, effect, external reference, comment,
CDATA, processing instruction, DTD, or entity declaration.

## Output and deferred application

The closed output contains:

1. a semantic clone-source-slide operation;
2. a planned group placement after the resolved anchor;
3. the exact component data;
4. the explicitly unbound and non-insertable native group exemplar.

M2-005 must treat the typed component data as authority and the XML only as a
conformance exemplar. A safe applicator must inspect the complete target
`p:spTree`, including its root and nested groups, reject invalid or duplicate
existing object IDs, allocate three collision-free positive UInt32 IDs in
group/card/arrow order, rebuild the fixed tree, and serialize it into isolated
staging. It must not perform raw-string ID replacement or direct fragment
concatenation. This component creates no relationship, so it must not add or
rewrite any `r:id`.

## Support policy

The exact `native-drawingml` capability row is
`experimental/accept-with-warning`. Experimental product dispatch requires the
overlay's explicit opt-in and all six executable artifact classes: metadata,
executor, input schema, output schema, conformance fixture, and QA assertions.
The support-matrix gate now enforces that evidence rule for every experimental
capability row.

`supportClaimsEnabled` remains `false`; there are no `supported` rows. The
broader `drawingml-shapes` and `slide-text` rows remain
`unsupported/unavailable`, as do clone/fill, every input class, package
assembly, staging, publication, and PowerPoint editability. The narrow
experimental decision must never be generalized to arbitrary shapes,
templates, or complete presentations.

## Public evidence

All tracked evidence is repository-owned UTF-8 text. The integration fixture
uses the already reviewed synthetic TemplateIndex and contains two independent
data-only slides. The conformance corpus uses unrelated semantic keys and
includes exact escaped `&`, `<`, `>`, quotes, leading/trailing spaces, and a
valid astral scalar. No PPTX/POTX binary, extracted private XML, screenshot,
font, asset, predecessor code, local path, or private fixture identity is
loaded or committed.

The focused suite covers exact artifact registration, schema conformance,
experimental opt-in, ordered dispatch, exact registry authentication,
identity/binding ambiguity, later-slide atomicity, geometry/style/text limits,
Unicode and XML injection, deterministic bytes, native group/shape structure,
non-insertable ID policy, output and QA drift, fixture neutrality, absence of
ambient I/O, and clean-directory module closure. Completion evidence and exact
test counts are recorded in `TODO.md` after the full repository suite, the
official Node.js 22/24 matrix, staged policy gates, and one bounded independent
closing review pass.

## Residual risk and next dependency

The executor, schema validators, QA callbacks, support resolver, and strict XML
parser remain trusted in-process JavaScript rather than a sandbox. The anchor
binding does not carry its source geometry, the invocation carries no target
slide-size proof, and the exemplar's component-local IDs are intentionally not
final identifiers. Text fit, theme/font rendering, visual fidelity, grouping
behavior, and manual PowerPoint edit/save/reopen behavior remain unverified.

M2-004 is the next dependency: isolate the optional Pandoc/OMML adapter without
widening core or the current native-component claim. M2-005 remains responsible
for all source-bound package application, ID/relationship allocation,
normalization, collateral diff, rollback, atomic publication, and final
editability evidence.
