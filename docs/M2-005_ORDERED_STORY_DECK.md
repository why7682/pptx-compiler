# M2-005B Ordered Story-Deck Evidence

## Scope

This is a bounded public-synthetic effect experiment, not arbitrary deck
planning or a product support claim. It proves one exact three-slide narrative:

1. `setup`: establish the reviewed criteria;
2. `evidence`: state readiness and the remaining checks; and
3. `resolution`: request a bounded decision.

Each slide contains one primary takeaway and one supporting evidence unit. The
story contract requires `deepens` and `supports` adjacency in that order. The
public synthetic sources are generated at runtime from repository-owned text
OOXML; no PPTX, render, raw review report, prompt transcript, or external source
file is committed.

## Authority and assembly boundary

`labs/layout-selection/ordered-story-deck.mjs` detaches and bounds the complete
story, reviewed acceptance, and exemplar set once before selection. It validates
the whole narrative graph before exemplar access, then runs every beat through
the reviewed multi-exemplar selector. The acceptance snapshot is exposed by a
SHA-256 digest so one review decision set, rather than three independently read
mutable inputs, authorizes the complete batch.

`packages/core/src/ordered-slide-assembly.mjs` admits only authentic one-slide
M2-005A artifacts. An in-memory report identity binds each semantic slide ID to
the exact returned bytes and SHA-256; a legitimate report cannot be paired with
another legitimate artifact. Before rebuilding, the assembler proves that the
root, presentation, master, layout, theme, properties, and every slide form the
exact typed relationship closure. Every content part must be reachable; a
validly typed but unreferenced part is rejected.

Only after every input succeeds does the assembler allocate fresh deterministic
slide parts, presentation slide IDs `256..258`, and relationship IDs
`rId4..rId6`; rebuild presentation owners, content types, and per-slide layout
relationships; generate a deterministic ZIP; re-ingest the output; and emit an
allowed/collateral part diff. Publication remains a separate create-only step,
so a bad final beat produces no partial deck.

## Exact story and visual repair

| Order | Role | Function | Primary read | Supporting evidence |
| --- | --- | --- | --- | --- |
| 1 | setup | status | `3/3 — Reviewers aligned` | `Scope, hierarchy, and readability agreed` |
| 2 | evidence | status | `87% — Controls ready` | `Edit/save and accessibility checks remain` |
| 3 | resolution | decision | `Approve a limited pilot now` | `3/3 aligned — Independent reviews` |

The first rendered version was structurally correct, but one of three isolated
reviews identified a real deck-level content defect: the opening consensus did
not name what had been reviewed, and the readiness claim did not name the
remaining checks. Two other runs reported no finding. The brief was repaired
instead of treating majority silence as evidence that the effect was already
good.

The repaired version names the criteria and residual checks directly. All three
fresh absolute reviews judged the goal `met` with no slide or deck finding. The
executable aggregator returned `status: final`, `verdict: pass`, and an empty
finding set. Accessibility metadata and native editability were explicitly
unassessed.

## Deterministic and rendered evidence

- proposal-set SHA-256:
  `b151f468880c0cb5061d2040a66296720a33ead4c9a5f6b9e8ae6387dfcbd607`;
- reviewed-acceptance snapshot SHA-256:
  `d192eca86a357b81cf4b3440ae3b06db9c36db8dbfadbf0ffc2915d2b5ace913`;
- repaired ordered PPTX SHA-256:
  `07bffa7c11baef63fe797e32614e98f7c29b0f1c1817b85dc83dd6c6db5ead18`;
- repaired archive size: 19,939 bytes;
- all three local Quick Look renders: 1600 × 902 pixels;
- repaired slide 1 render SHA-256:
  `ac49f9827b8d28273d6fed4ecf5070bbbd4fc3d999c7e52e892865ae66994339`;
- repaired slide 2 render SHA-256:
  `09219d4f1eb735b3040ec1e9587758504be0c0e10afa88bd70dd07a5320d58bf`;
- repaired slide 3 render SHA-256:
  `fb6d3361b9581a497a68fe7d2c3b321c5bf2b8abc9c7a40a59588fd81f58a023`;
- externally derived repaired-review context SHA-256:
  `90fa6201beb1a7f330dd612fae8c788e642adc3f9ea96bb25cf870409cd63f02`;
- ordered-story focused tests: 14/14 pass;
- assembly/profile/visual-review focus: 44/44 pass; and
- complete repository suite: 804/804 pass.

Quick Look is an optional local visual oracle, not a public CI dependency or a
PowerPoint compatibility claim.

## Independent challenge

The bounded read-only code review reproduced four high-severity authority or
time-of-check gaps and two medium closure/error-boundary gaps. The implementation
now rejects incomplete typed relationship edges, report/byte label swaps,
story mutation during capture, acceptance/exemplar rereads across selections,
validly typed orphan content parts, and revoked/throwing Proxy exceptions that
would otherwise escape as raw errors. Each reproduction has a focused
regression test. The final re-run found no remaining blocker, high, or medium
issue; its M2-005 focus passed 39/39 and `git diff --check` passed.

## Limits and next dependency

The effect-bearing story API intentionally admits exactly three roles and two
text elements per slide. The lower-level assembler is bounded to 2–11 authentic
one-slide artifacts, but this is not evidence for arbitrary source decks,
multiple masters/layouts, media, tables, charts, notes, accessibility, animation,
or general OOXML compatibility. Eleven is the last admitted package size under
the unchanged 32-entry secure-ZIP profile; 12 inputs fail before any artifact is
inspected. Native card-arrow and OMML application,
PowerPoint edit/save/reopen evidence, schema/contract integration, and parent
milestone rollback/compatibility evidence remain M2-005C work. All support rows
remain non-supported and the global support switch remains false.
