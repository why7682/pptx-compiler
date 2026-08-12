# M3-001 Handoff — Thin CLI Authority

## Current state

M3-001 is complete.
Protocol `0.1.0` now implements `init`, `inspect`, `validate document`,
`validate project`, one exact experimental `render`, and honest blocked `qa`.
`doctor`, generic `onboard`, and `diff` remain explicitly unavailable.

This is intentional. D-037 grants candidate authority only to the fixed
public-synthetic one-slide native-card profile, and D-038 grants assessment
authority only over that exact candidate/record pair. The fixed mixed M2 helper
is not a product host, arbitrary templates remain unavailable, and a blocked QA
result grants no delivery authority.

## Protocol 0.1.0

- exit `0`: success;
- exit `1`: domain/runtime failure;
- exit `2`: command syntax failure.

Detailed machine meaning remains the existing redacted `code + pointer`; do not
add another exit-code taxonomy. With `--json`, success and failure each emit
exactly one newline-terminated stdout object and leave stderr empty:

```json
{"protocolVersion":"0.1.0","command":"validate","ok":true,"result":{"scope":"document","contractType":"template-index","schemaVersion":"0.1.0","valid":true}}
```

```json
{"protocolVersion":"0.1.0","command":"inspect","ok":false,"error":{"code":"CLI_OUTPUT_CONFLICT","pointer":"/output"}}
```

Never serialize `Error.message`, stack, cause, a supplied path, raw content,
XML, adapter stderr, or an unknown command string.

## Implemented command chain

`init --preset public-synthetic-native-card` requires one explicit normalized
absolute `--project-root` that does not exist. The production conformance-preset
package creates schema-validated ProjectConfig, TemplateProfile,
CapabilityRegistry, ProjectOverlay, DeckSpec, and public synthetic POTX data.
It deliberately leaves TemplateIndex for `inspect`.

ProjectConfig is the visible bootstrap commit marker. Before marker visibility,
the writer removes only its fixed owned paths; a complete rollback reports
`PUBLIC_SYNTHETIC_PROJECT_NOT_COMMITTED`, while an unexpected entry or failed
cleanup/directory barrier reports `PUBLIC_SYNTHETIC_PROJECT_ROLLBACK_INCOMPLETE`.
After marker visibility, every failure reports
`PUBLIC_SYNTHETIC_PROJECT_COMMIT_UNCERTAIN` and preserves the root.

`inspect` requires exact `--project-root` and `--config` absolute paths. It
performs:

```text
bounded contained ProjectConfig read
  -> normative manifest-selected schema validation
  -> ProjectContext
  -> secure template source ingestion
  -> TemplateIndex
  -> exact configured index path, create-only
```

The JSON result is the same existing TemplateIndex object; the CLI does not
invent a summary/index authority. The output writer canonicalizes object-key
order, stages beside the target, fsyncs, hard-links without overwrite, and
removes its stage.

`validate document` requires exact `--project-root`, `--input`, and `--contract`
paths/identity. It validates one contained JSON document against a root contract
named by the installation's manifest and writes nothing.

`validate project` requires exact `--project-root`, `--config`, and `--deck`
paths. It loads all six readable project documents, validates them, securely
re-inspects the current template, and requires exact TemplateIndex equality. A
fixed static host loads only installation-owned native-card schemas and cases
plus the normative support matrix. Runtime admission executes those fixed
registration conformance fixtures; the project resolver then validates the full
identity/hash/binding graph, applies normative experimental opt-in, prepares one
full-batch plan, and discards it without executing a project invocation or
writing an output. Its result explicitly distinguishes those states and says
`renderEligibility: "not-granted"`.

`render` accepts the same explicit project/config/deck roots and no caller-
selected output path. Before OOXML mutation, the static host requires all 15
invariant rows owned by the frozen candidate profile, the executing platform's
Node 22/24 row, and the public-automated evidence row to be
`experimental/accept-with-warning`; the global support switch remains false.
The fresh source bytes and readable TemplateIndex come from one stable read and
must exactly match the installation-owned public-synthetic TemplateIndex graph.
The command then derives the `slide-content-tail` semantic placement, exact-
compares the complete calculated geometry with DeckSpec, prepares a new
one-shot plan, executes one typed native-card invocation, verifies containment,
occupancy, and exact package diff, and publishes:

```text
deliveries/<deckId>.candidate.json
deliveries/<deckId>.pptx
```

The record is file-flushed and linked first and the PPTX is the visible logical
commit marker. POSIX additionally requests parent-directory fsync barriers. Failure
is classified as not committed, rollback incomplete, or commit uncertain; a
visible candidate is never destructively rolled back. The result is explicitly
`experimental`, `deliveryEligible: false`, and creates no QaReport or
BuildArtifact.

`qa` accepts the same explicit project/config/deck roots and no evidence or
output override. It reloads and validates the current readable project state,
uses the same semantic-slot and fresh one-shot derivation as `render`, rebuilds
the expected authenticated PPTX/CandidateBuildRecord pair in memory, and
stable-reads the actual PPTX commit marker before its record. Both files must
match the current expected bytes exactly, and the actual record must replay.
Missing files, tampering, stale authored intent, invalid support rows, or a read
race are command failures and create no report.

For the exact valid pair, QA emits the existing closed `QaReport 0.1.0` with
three calculated checks passing and rendered-pixel review, PowerPoint
compatibility, and render-completeness marked unavailable through the two
normative manual support rows. The command succeeds with
`decision: "blocked"`, writes only `deliveries/<deckId>.qa.json` create-only,
returns that same complete QaReport in JSON mode, prints exactly `qa: blocked`
in human mode, and never creates BuildArtifact. It accepts no local evidence
path and scans no project directory for screenshots, reviews, or PowerPoint
transcripts.

The Schema subset has moved to `packages/core/src/json-schema.mjs`.
`scripts/lib/json-schema.mjs` remains a one-line re-export for existing 0.x
workspace callers. Core has no CLI dependency.

## D-036 evidence

Nineteen CLI tests cover deterministic bootstrap bytes, pre-marker rollback,
rollback-incomplete reconciliation, post-marker uncertainty, configured-path
inspection, document/project validation, stale index and identity drift,
normative opt-in, exact protocol streams/exits, fatal UTF-8, redaction, and
deferred commands. The dispatcher/resolver/native/support/fixture focus passes
263/263 and the complete repository suite passes 1065/1065.

The D-036 bounded review initially found two highs and one medium: dishonest
bootstrap commit states, a testing package in the production composition root,
and ambiguous executor-execution reporting. Exact three-state fault handling,
the production `packages/public-synthetic` boundary, and explicit registration/
project execution fields closed all three. Final re-review reports 0 blocker,
0 high, and 0 medium.

## Linus audit correction

D-035 and `docs/M3_LINUS_AUDIT.md` froze the unsafe render-first order for three
concrete reasons:

1. at audit time the normative support matrix authorized no complete product-
   render dependency set, so a successful host would have bypassed policy;
2. public headless QA must say `blocked` when required rendered, pixel, or
   compatibility evidence is absent, but the old alpha plan did not define that
   outcome; and
3. a host built before its real on-disk project bootstrap would recreate fixed
   fixture construction inside production code.

The release target is a candidate alpha. Candidate PPTX plus
CandidateBuildRecord is useful output. A correctly computed blocked QaReport is
an honest assessment and must create no BuildArtifact. Delivery alpha remains a
later evidence milestone.

Those prerequisites are now closed by D-036 and D-037 without weakening the
global support switch.

## D-037 evidence

Twenty-five CLI tests now cover exact static-profile closure and runtime
rejection, fresh same-read source/index binding, full TemplateIndex authority,
one-shot execution, deterministic candidate/record bytes, semantic geometry,
three clear occupancy checks, source immutability, create-only conflict, and no
QA/BuildArtifact. Core publication fault injection covers not-committed,
rollback-incomplete, and commit-uncertain outcomes. The D-037 focused set passes
180/180 and the complete suite passes 1076/1076 under Node.js 22. A frozen
1600 x 902 render of the exact ignored
candidate passed an independent pixel-only review with no blocker, high,
medium, or low finding; that review is visual evidence only and cannot approve
its own generation or promote delivery.

The bounded code review found one medium dependency-boundary defect: the exact
CLI imported the broad native/OMML/ordered publisher while its test scanned only
three direct files. The CLI now imports a native-card-only authenticator, both
old and new entries share one format-independent record-first/marker-last pair
publisher, and
the regression recursively walks the complete production import graph. The
same reviewer confirmed compatibility and the three-state semantics with
0 blocker, 0 high, and 0 medium remaining.

## D-038 evidence

Thirty-three CLI tests now cover the complete bootstrap-to-blocked-QA spine,
full QaReport output, deterministic bytes across roots, ignored-evidence
independence, human output, exact missing/tampered/stale/oversized failure
boundaries, unauthorized-argument rejection, and create-only report
publication. The native-card core suite adds a pure evaluator test for fixed
outcomes, deep freezing, exact input shape, byte tampering, and validator
failure. The QA-focused CLI/native/support set passes 99/99 and the complete
repository suite passes 1085/1085 under Node.js 22.

The normative matrix remains 0 supported / 22 experimental / 3 manual / 35
unsupported with `supportClaimsEnabled=false`. The `collateral-mutation-qa`
row now cites the executable blocked-QA projection without promotion; both
external evidence rows remain manual gates, not passing evidence.

The bounded review initially found one high and two medium defects: a validator
could mutate the report before it was frozen, a Buffer could spoof its own
length until after copying, and a rejected Promise from the synchronous
validator could escape as an unhandled rejection. QA now freezes before
validation, reads intrinsic typed-array length before copying, and consumes
non-true Promise rejections. Exact regressions plus a candidate-symlink case
pass; the same reviewer reports 0 blocker, 0 high, and 0 medium remaining.

The closing working-tree gates pass: forbidden-material and provenance checks
cover all 216 admitted files, the 60-row support matrix passes, and the contract
gate reports no finding. `git diff --check` remains a final mechanical check
after this status-only documentation update.

## Next vertical slice

M3-001 is complete. Begin M3-002 by defining the smallest explicit publishable
package graph around this
installed spine. Every publishable package needs a positive files allowlist,
exports, types, runtime declaration, license, and repository metadata staging;
the private workspace root, labs, PowerPoint/manual adapters, ignored evidence,
and broad unused M2 implementations are not admitted by default.

`doctor`, generic `onboard`, standalone `diff`, and formula CLI are deferred.
Generic onboarding needs data describing capability binding constraints; the
current role names are insufficient, and hard-coded CLI rules are forbidden.
