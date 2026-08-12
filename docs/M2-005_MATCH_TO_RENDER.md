# M2-005 Match-to-Render Evidence

## Scope

This is a bounded public-synthetic control experiment, not a product support
claim. It tests the effect-first hypothesis that placing the primary takeaway
in the dominant template slot improves the stated audience outcome more than a
generic evidence-first assignment.

No PPTX, PNG, raw model report, prompt transcript, or renderer output is
committed. The source is the repository-owned minimal text-only POTX. macOS
Quick Look is an optional local compatibility oracle, not a CI requirement.

## Three-artifact boundary

`labs/layout-selection/reviewed-clone-fill-catalog.mjs` implements the narrow
boundary distilled from the commit-pinned public-project study:

1. exact admitted `TemplateIndex` slide, shape, and geometry facts;
2. explicit reviewed semantic slots, roles, capacities, and clone/fill targets;
3. deterministic selection followed atomically by the existing create-only
   assembly backend.

The intermediate clone/fill plan remains private to the atomic API so a plan
cannot be detached from the exact index facts that produced it. Metric
serialization is capacity-accounted before selection and checked again after
selection.

## Control pair

Both profiles use the same two source text boxes so the comparison isolates
semantic assignment rather than theme or geometry changes.

| Candidate | Dominant title slot | Supporting body slot | Purpose |
| --- | --- | --- | --- |
| exact-fit | `Approve a limited pilot now` | `3/3 aligned — Independent reviews` | primary action first |
| generic control | `3/3 aligned — Independent reviews` | `Approve a limited pilot now` | evidence first |

The decision brief requires approval of the pilot, names the approval statement
as the primary takeaway, and requires supporting evidence. The deterministic
selector chooses `decision-with-proof`; selecting the generic-only catalog
produces the control.

## Deterministic and rendered evidence

- focused reviewed-catalog tests: 8/8 pass;
- exact-fit PPTX SHA-256:
  `53d1734a4c92a6a23711b37428546742777c04e34f5b739c2c8d95b09c8aaad1`;
- generic-control PPTX SHA-256:
  `912527a3bf26e32f89a0a68e43fb5bd13c9b93a1cd2a382bf88b3ad7428c2f10`;
- both local Quick Look renders: 1600 × 902 pixels;
- exact-fit render SHA-256:
  `020231236383ea09de026674da568951fe98c48eac19a5733fbba134a47bb15f`;
- generic-control render SHA-256:
  `7e8ff8a5c4ae63129c6435353fe28522169e70b5355195482ebfdd47dd6f0f56`;
- externally derived review-context SHA-256:
  `f967655604a7e05cde0971173301b8438fdb6fa4d983580205d231a9b593bc3e`.

The current atomic API reproduced byte-identical PPTX hashes after the detached-
plan, metric-capacity, and accessor fixes, so the reviewed renders still bind
to the current implementation output.

## Three isolated visual runs

All three reviewers judged only the supplied full-slide pixels and the stated
audience goal. All agreed that the exact-fit action-first hierarchy serves the
approval goal more directly than the generic evidence-first hierarchy.

| Run | Goal assessment | Findings |
| --- | --- | --- |
| 1 | met | none |
| 2 | met | none |
| 3 | partially met | major: evidence does not say what was reviewed; minor: supporting line may be too small at presentation distance |

The executable aggregator returned `status: final`, `verdict: pass`, and no
retained 2-of-3 finding. That result supports the relative hierarchy hypothesis;
it does not erase the third reviewer's useful dissent. A production decision
slide still needs decision-specific evidence rather than a bare consensus
count, and should retest the evidence typography at presentation distance.

## Conclusion and next constraint

The fundamental borrowed mechanism is validated at the smallest executable
scale: audience goal plus takeaway and evidence units, matched to reviewed
template slots, changes what the audience reads first in the real render.

The next experience-bearing step is not another verifier iteration or a wider
shape API. It is reviewed profile induction from multiple distinct synthetic
source exemplars, with evidence units that state the assessed outcome and
decision basis. Writer expansion may resume only while preserving this
source-facts → semantic-plan → atomic-assembly boundary.
