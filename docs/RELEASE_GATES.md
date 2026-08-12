# Release Gates

All gates fail closed. Compilation or a visually plausible deck is not release
evidence by itself.

## G0 — Identity, rights, and provenance

- D-044 fixes the one active identity stem at `pptx-compiler`, the four exact
  npm names, the `why7682/pptx-compiler` GitHub target, and the approved public
  Git identity; any drift or partial old/new graph fails closed;
- an OSI-approved license is selected after confirming ownership and third-party
  obligations;
- each source, schema, fixture part, example, and dependency has a provenance
  record and compatible redistribution status;
- excluded private materials and non-redistributable helpers have machine-
  checked patterns;
- before the first public ref, the same current policy scans every blob version
  and commit message reachable from the exact `refs/heads/main` tip, while
  author/committer metadata exact-matches the approved repository-local public
  identity without being echoed;
- per-file SPDX/copyright policy is decided and enforced.

## G1 — Public reproducibility

- clean checkout uses only declared public dependencies;
- synthetic fixture is repository-owned, deterministic, and independently
  reviewed;
- no private fixture, local font, model, GUI, or managed helper is required;
- Linux, Windows, and macOS non-GUI tests agree on normalized results.

## G2 — Input security

- canonical containment blocks traversal and symlink escape;
- archive member count, individual size, expanded total, compression ratio,
  nesting, duplicate, and case-conflict limits are enforced before extraction;
- XML parser limits and external-entity/network access are disabled;
- external relationships, macros, ActiveX, OLE, embedded packages, and unknown
  high-risk parts follow the documented reject/quarantine policy;
- resource exhaustion and malformed-input mutation suites pass.

## G3 — Capability correctness

- the shipped support matrix passes its schema and semantic overclaim gate;
- every supported capability has exact bound metadata, an executor, input and
  output schemas, conformance fixtures, deterministic output, negative tests,
  and a concrete QA contract with assertions;
- runtime project resolution binds the exact captured registry content and
  rejects missing, duplicate, ambiguous, case-aliased, or kind-mismatched
  overlay/index/deck references before executor preflight;
- source template is unchanged and output publication is create-only;
- OOXML relationships, content types, geometry/capacity, semantic diff, and
  collateral mutation checks pass;
- every same-slide operation resolves through one persisted constraint-bearing
  `SlideLayoutIR` and one digest-bound frozen `ComposedSlidePlan`; product-level
  placement cannot bypass semantic slots with caller-authored x/y;
- the exact IR and plan are retained together in the candidate build record;
  later edits re-resolve that IR, and a standalone PPTX cannot substitute for
  or regenerate the missing constraint record;
- structurally authenticated bytes are candidates, not deliveries; final
  publication requires exact candidate-bound mechanical, render, visual, and
  required compatibility receipts from separate authorities;
- structural success cannot promote a visually failed deck; any optional
  rendered-review claim has a versioned input/output contract, evidence-bound
  deterministic verdict, delivery-mode-aware criteria, and explicit separation
  between simulated reviewer evidence and real audience evidence;
- manual and unavailable evidence remains visible and cannot be promoted to an
  automatic pass.

## G4 — Package boundary

Every publishable package uses a positive `files` allowlist. The packed tarball:

- is at most 5 MiB compressed and 20 MiB unpacked;
- has at most 300 files and no file larger than 1 MiB;
- contains only allowlisted runtime files and required notices;
- contains no presentation/PDF/font/archive binary, worktree, build/review
  output, workspace or private-fixture manifest, absolute path, secret, PII,
  source map with private sources, or undeclared executable. D-045 adds the
  verified repository projection while deliberately retaining `private: true`;
  that npm guard is not a workspace/private-fixture manifest and may be removed
  only by a separate reviewed npm-publication authorization;
- installs in an empty directory and completes the documented CLI smoke flow.

The reviewed tarball hash must equal the published tarball hash.

D-039 closes only the package-definition half of G4. D-044 atomically renames
that unpublished graph without adding aliases. The guarded plan fixes
four packages, their acyclic dependency graph, positive source-to-stage files,
narrow facades, exact exports/types/bin/import aliases, package-owned assets,
MIT notices, Node 22/24 engines, and dated unscoped names. D-045 separately
binds the created GitHub repository while retaining a blocked npm guard. A
split-resource execution test runs the complete candidate-alpha spine
without deriving static assets from one installation root.

M3-003 closes the local implementation half of G4 for the current guarded,
private manifests. The fixed owned stage generates and independently inspects
all four real tgz files against retained plan/source/policy/`.gitignore` bytes
and the limits above, installs them together offline in one empty directory,
invokes the installed bin through
`init -> inspect -> validate project -> render -> qa`,
and observes `decision: blocked` with no `BuildArtifact`. The reviewed tgz bytes
remain exact through post-install and post-rename checks; only their final
boundary SHA-256 values are recorded in ignored evidence. Stage recovery never
recursively deletes a named directory: it removes only exact typed transient
inventories or marker-authenticated review members, keeps `failed` as a
rename-only quarantine, and preserves every unknown nonempty entry. Persistent
npm cache/config/tmp state remains ignored and outside reviewed evidence.

G4 is not final release evidence yet. M3-004A tracks a deterministic CycloneDX
1.6 projection of this declared four-package graph and its parser-proven static
ESM edges; the dev-only TypeScript compiler is correctly excluded. This is not
a sandbox proof against adversarial computed loaders. M3-006 reverified the
D-045 public target and PVR state, retained the npm-private guard and verified
repository projection, completed the repository-bound package gate, and later
published the exact first source ref. The first public run is only partial
three-platform evidence: Ubuntu and macOS pass under both Node lines, while
both Windows cells fail. Later Windows corrections changed package inputs and
history policy. The fixed-copy correction now passes the 216-node affected
focus, 24-node package-stage suite, and 1228-node complete suite under both
admitted Node lines; npm 10/11 each pass the guarded offline package spine. A
pull-request run `31594128100` passes all six platform/runtime cells for branch
object `94b5c1c`. After public visibility and the dependency graph were enabled,
pull-request security run `31594128139` passes Dependency Review while CodeQL
remains skipped by event design. Those runs are historical evidence bound to
branch object `94b5c1c`; the next committed PR head needs fresh checks, and
accepted-main CI/CodeQL remain open.
Final published-ref SBOM validation,
signing, registry
provenance, and reviewed-to-published equality remain G5/G6 work. Source-tree
facade tests or successful `npm pack --dry-run` alone never satisfy this gate.

## G5 — Project security and maintenance

- least-privilege CI, pinned actions, dependency review, CodeQL/static analysis,
  secret scanning, license audit, SBOM, and vulnerability reporting are active;
- untrusted pull-request code never reaches private fixtures, PowerPoint hosts,
  signing keys, provenance identity, or registry tokens;
- supported Node/platform versions, compatibility levels, deprecation policy,
  and security response process are documented;
- contributor and governance documents are present.

M3-004A closes only the local definition half of this gate: exactly two
canonical workflows, fixed full-SHA actions and hosted-runner labels, read-only
ordinary CI, isolated CodeQL/Dependency Review permissions, one exact dev
toolchain, real declaration typecheck, source/import policy, MIT/provenance
relations, and the static-ESM SBOM projection. M3-004B remains unsatisfied. Run
`31559642053` passed Ubuntu 22/24 and macOS 22/24 but failed Windows 22/24;
security run `31559642035` passed CodeQL while Dependency Review was skipped on
the push event. Pull-request run `31582316951` again passed Ubuntu/macOS but
failed Windows on two remaining portability boundaries. Pull-request security
run `31582316939` then recorded the former private-repository Dependency Review
failure. After public visibility and the dependency graph were enabled, run
`31594128139` passed Dependency Review for branch object `94b5c1c`. These
pull-request runs are historical object-bound evidence; the next committed PR
head needs fresh CI and Dependency Review, and M3-004B also remains open for
accepted-main CI/CodeQL evidence.
M3-005A closes the local vulnerability-reporting, contribution, governance,
and reproduction document contract. D-045 now records the empty public shell,
HTTP 204 activation, and subsequent exact `enabled: true` status. M3-006 then
completed the reachable-history gate, one canonical credential-free HTTPS
transport, exact-object-ID first push, and post-push repository/PVR/remote-main
equality checks. That completed first-ref evidence does not satisfy M3-004B.
M3-005B owns final claim text after hosted evidence. No local workflow or
document check upgrades a support or active-security-setting claim.

## G6 — Release evidence

- release tag points to the reviewed commit;
- clean-tag build, full public conformance suite, tarball install smoke, and CLI
  end-to-end flow pass;
- changelog and known limitations match the executable support matrix;
- alpha/beta/stable channel is explicit;
- package publication uses registry provenance where available.

## Reference policies

- OSI licenses: <https://opensource.org/licenses>
- REUSE Specification: <https://reuse.software/spec/>
- npm package metadata: <https://docs.npmjs.com/cli/configuring-npm/package-json/>
- OpenSSF Scorecard: <https://github.com/ossf/scorecard>
- GitHub security policy guidance: <https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/add-security-policy>

## Effect-first lab boundary

D-023 permits optional model-assisted planning and rendered review only under
`labs/`. Those experiments are excluded from core dependency closure and cannot
register a capability, authorize assembly, promote a support row, or become a
release prerequisite for the deterministic 0.x path. A future release that
advertises planning or visual-review behavior must additionally prove:

- one executable raw-input→candidate→selection→layout→deck path rather than
  validation of hand-authored plans;
- template-locked/flexible precedence and a separate scratch-lab route;
- blinded outcome probes before contract-aware diagnosis;
- non-votable reconciliation for required facts, evidence, and actions;
- controlled, label-randomized rendered comparisons with delivery-mode
  controls; and
- wording that does not equate model preference with actual audience effect.

The P1 design-planning lab supplies the first executable path, requires the
complete approval record to match a fixed reviewed-registry digest before
minting an opaque projection token, recomputes input and node-deletion evidence,
binds the claimed template to actual proposal/layout evidence, and tests all
three template modes. P2 supplies a fixed reviewed visual-evidence manifest,
the one-shot same-session blind-and-whole freeze/reveal boundary, exact visible blind-slot references, fixed
atomic outcome binding, non-votable source/crop-bound required-item
reconciliation, a reviewed blocker-crop registry, a delivery-aware spatially
and slide-clustered whole-deck critic, and
`simulated-review-only` result scope. Caller-supplied dismissal records cannot
authorize pass. P3 now adds a label-randomized 2 × 3 real-pixel comparison,
twelve delivery review cells, an authenticated all-arm render harness, three
isolated blind reviews, and a common-root visual repair. All remain
non-authorizing `simulated-review-only` lab evidence, so no release or support
claim is promoted.

## Executable foundation gates

M0-004 makes the G0 admission boundary executable without third-party runtime
dependencies:

- `npm run check:public-tree` checks the staged Git index using the staged
  policy, schema, and provenance records;
- `npm run check:working-tree` diagnoses tracked and non-ignored untracked
  working-tree files without following symlinks;
- `node scripts/check-forbidden-materials.mjs --mode history` fixes
  `refs/heads/main`, reads its tip-owned policy, and scans the bounded reachable
  history that an exact first-ref push would expose; it is a pre-push gate, not
  a hosted-PR workflow step;
- `npm test` proves deterministic reports and fail-closed behavior with
  repository-owned temporary text fixtures and closed history/executable
  mutations.

Policy schema v2 keeps current executable paths separate from exact retired
history objects. Index, working-tree, package, and tip-history checks recognize
only current paths. A non-tip historical executable is admitted only when both
its path and Git blob OID match the one pair in the same tip-owned policy; all
path, content, magic, size, type, identity, and history-grammar checks still
apply. This is a bounded historical identity exception, not a second policy or
a current-path compatibility alias.

Both CLIs emit deterministic human output by default and accept `--json` for a
versioned machine report. A configuration error is itself a gate failure.

M0-005 adds `npm run check:support-matrix`. It validates the staged 60-row
matrix, explicit catch-alls, claim switch, status/disposition/evidence
combinations, required capability evidence, deterministic IDs, and admitted
evidence paths. It is part of `npm run check:public-tree`.

M1-001 adds `npm run generate:fixtures` and the synthetic-fixture tests. The
generator admits only its reviewed text-part allowlist, rejects source/graph
drift and high-risk markers, creates deterministic PPTX/POTX archives in an
ignored directory, and refuses overwrite. This is producer-side public test
evidence only; it is not the secure ingestion gate required by G2.

M1-002 adds `npm run check:contracts` and
`npm run generate:contract-types`. The contract gate validates the exact
versioned schema/fixture manifest, registered references, closed root objects,
cross-document semantic links, safe relative paths, QA/manual aggregation, and
generated TypeScript drift. QA evidence must cover every rendered slide through
its selected capability contract; slide-scoped checks cannot cover another
slide, and referenced error diagnostics cannot aggregate to pass.
Schema-conformance examples are explicitly barred from serving as executor or
support evidence. The staged contract gate is part of
`npm run check:public-tree`.

M1-003 adds the side-effect-free `ProjectContext` runtime contract. It requires
an explicit absolute root and exact injected ProjectConfig validator, produces
detached frozen path/config snapshots, rejects lexical escape and case-folded
root/write-target aliases, and contains no cwd/environment/Git root discovery.
These tests establish explicit wiring only: they do not satisfy G2 filesystem,
symlink, TOCTOU, archive, or XML gates, which remain consumer-time work.

M1-004 adds a side-effect-free semantic template inspector and the
`npm run inspect:synthetic` evidence harness. The reviewed fixture producer
builds archive bytes, digest, and an already-parsed package view in one bounded
in-memory flow; core validates the view graph and emits a deterministic,
path-redacted `TemplateIndex 0.1.0`. A clean-directory module-closure smoke
copies only the core sources and runtime-generated public view to an empty
directory and executes from an unrelated cwd. This is not npm tarball/install
evidence and does not satisfy G2: arbitrary file opening, ZIP/XML safety, and a
secure package-view producer remain M1-005.

M1-005 adds `inspectTemplateSource()` as the bounded G2 foundation lane. It
derives its source solely from `ProjectContext`, checks path components and an
opened-handle identity before/after an exact-size read, and performs all ZIP,
XML, OPC, relationship, and narrow OOXML validation in memory without
extraction or network resolution. Fixed limits and residual cross-platform
TOCTOU constraints are documented in `docs/M1-005_HANDOFF.md`. Public mutations
cover traversal, symlinks, archive/member/ratio limits, duplicate/case aliases,
ambiguous ZIP formats, malformed/entity-bearing XML, unknown vocabulary,
external relationships, macros, ActiveX, OLE, and embedded objects. This
satisfies the bounded public G2 baseline for the synthetic minimal profile; it
does not establish arbitrary-template compatibility, package installation, a
CLI, a renderer capability, or any supported matrix row.

M2-001 adds the bounded G3 registration/dispatch foundation. Declarative
registry strings never load code. Atomic runtime admission requires exact
capability/version, executor, input/output schema, nonempty conformance fixture,
QA assertion, and support-item binding. The entire bounded invocation batch is
snapshotted, input-validated, support-authorized, binding-checked, and
preflighted before any executor runs; an opaque one-shot plan then executes in
order and validates every output and QA assertion. Public mutations cover
missing/drifting artifacts, placeholder metadata, accessors and non-JSON data,
immediate aggregate resource ceilings including object keys, async admission
mutation races, rejected sync-callback Promises, lookup/version/binding
ambiguity, support states, batch atomicity, plan replay, executor/output/QA
failures, and redaction.

M2-001's only positive executor is a no-I/O dispatcher conformance probe. It is
not a renderer or support artifact for any product capability. M2-001 does not
establish overlay/index resolution, source immutability, create-only staging,
rollback, OOXML collateral diff, atomic publication, packaging, CLI behavior,
or sandboxing of hostile third-party JavaScript; those remain later gates.

M2-002 adds the bounded project-resolution and semantic operation-planning
portion of G3. The synchronous resolver snapshots the complete registry,
overlay, index, and deck set before validator callbacks; binds the full registry
to authentic M2-001 private runtime state; closes owner, selection, binding,
target, kind, ordering, and identity ambiguity; and immediately returns an
opaque dispatcher plan. Public mutations cover same-ID registry substitution,
missing/duplicate/case-aliased graph identities, cross-document drift,
selection reuse, later-slide atomicity, validator races, descriptor/non-JSON
inputs, fixed resource ceilings, redaction, fixture neutrality, and clean-
directory closure.

The statically registered clone/fill executor emits only a schema-validated
clone-plus-two-fill JSON plan and runs four cross-field QA assertions. Its two
public conformance cases execute during runtime admission even while the
normative policy remains `unsupported/unavailable`; normal product dispatch is
therefore blocked before capability preflight. This satisfies only semantic
planning evidence. Actual source-slide bytes, relationships and identifiers are
not cloned or remapped, and source immutability, create-only staging, rollback,
editability, visual fidelity, collateral diff, and atomic publication remain
unsatisfied M2-005 gates.

M2-003 adds the bounded native-component portion of G3. The statically
registered `native-card-arrow` executor accepts only one exact text-box anchor
and closed geometry/text/style data. It creates a fixed typed group, escapes
values through a canonical serializer, strict-parses the result, and enforces
an exact PresentationML/DrawingML allowlist with no raster, relationship,
custom-geometry, extension, or external vocabulary. Public conformance covers
deterministic output, Unicode/XML injection, geometry/style limits, native
structure, support opt-in, later-slide atomicity, drift, fixture neutrality,
and clean-directory closure.

The output contract deliberately labels the XML exemplar unbound and
`insertable: false`; IDs are component-local and require M2-005 parse/rebuild
and collision-free target allocation. The matrix gate now requires all six
executable artifact classes for experimental capability rows. D-037 later
promotes only the exact fixed candidate closure; `supportClaimsEnabled` stays
false, broad DrawingML/slide text and arbitrary input remain unsupported, and
no candidate alone satisfies a delivery gate.

M2-004 adds the optional external-process and formula-conformance portion of
G0/G2/G3. D-008 and `docs/PANDOC_ADAPTER_ATTRIBUTION.md` keep Pandoc external:
no executable, library, template, reference document, source, generated DOCX,
or upstream-derived fixture is bundled. A trusted absolute executable path is
eligible only inside `>=2.15.0 <4.0.0` and only after fixed version, JSON-API,
and exact canonical-OMML probes pass. Absence or drift omits the static executor
registration and normal dispatch remains unavailable.

The process runner uses no shell or ambient discovery, accepts only fixed
bounded requests, passes an explicit small environment/cwd, streams stdout and
stderr under separate ceilings, and enforces timeout plus fixed Pandoc sandbox,
warning-failure, and RTS options. Formula data is validated and JSON-encoded in
one Math AST on stdin; it cannot choose argv, paths, files, filters, defaults,
resources, reference documents, or URLs. Converter stdout passes the existing
secure ZIP limits, exact OPC/relationship checks, strict XML parsing, and a
closed typed OMML vocabulary before canonical reconstruction.

Public conformance uses a fake runner and repository-authored text-derived
in-memory DOCX bytes. It covers deterministic detection/conversion, absence and
process failures, injection/resource limits, ZIP/OPC/XML/OMML mutations,
resolver/dispatcher atomicity, output/QA drift, no-I/O dependency direction,
and clean-directory closure. The result is explicitly unbound and
`insertable: false`. Consequently `formula-transplant`, `latex-formula`, and
`native-omml` remain `unsupported/unavailable`, `supportClaimsEnabled` remains
false. The real-Pandoc matrix, arbitrary-target coverage, final publication,
and human PowerPoint formula-content editability gates remain unsatisfied.

The first M2-005C native application and authenticated-bridge slices add target-specific assembly
evidence without satisfying a release or support gate. One authentic M2-005A
artifact and one opaque one-shot dispatcher plan produce a typed, freshly
ID-remapped native card-arrow group with actual-slide containment and an exact
one-slide diff. The initial twenty-four focused tests cover authority, replay, target facts,
root/nested UInt32 IDs, deterministic output, and no fragment/plugin/lab
dependency; the complete repository suite passes 883/883. The bounded review's
one medium pre-limit byte-copy issue was fixed and regression-tested, with no
remaining blocker, high, or medium finding. The report is machine-marked
`publicationEligible: false`, and the generic package view and raw-byte publisher
continue to reject the output.

The follow-on bridge registers exact native and native-containing ordered report
identities privately, copies real native slide bytes into ordered output, validates
only an authentic M2-005A shadow through the unchanged generic package grammar,
and exposes a separate create-only publisher that cannot accept raw or clone-only
artifacts. Thirty-six focused and 895 complete tests cover direct/mixed/all-native
ordering and publication, byte identity, determinism, forged authority, tamper,
closed inputs, pre-I/O snapshotting, no-overwrite staging, symlink parents, and
continued generic rejection. The bounded bridge review's one high hash-before-
copy TOCTOU was fixed with copy-then-hash private snapshots and direct/ordered
SharedArrayBuffer regressions; closure found no remaining blocker, high, or
medium finding.

The follow-on compatibility/refactor slice makes the original overlapping
native fixture fail, persists semantic-slot constraints separately from the
frozen coordinate plan, and exposes a product path whose x/y is derived from
authenticated source facts. An explicit create-only candidate writer returns
`deliveryEligible: false`; the legacy publication-named function is only a 0.x
compatibility alias. One exact public-synthetic repaired candidate passed
same-path rendering, two independent pixel-only reviews around the round trip,
PowerPoint 16.111.3 group edit/save/reopen and child editability, and strict
post-save structure inspection. Eight layout and forty native focused tests plus
918 complete tests pass. This satisfies only the bounded native target and
local compatibility seam.

The typed OMML follow-on consumes one authentic base and exact formula dispatch,
strict-parses and typed-rebuilds one bounded formula target, binds the semantic
slot and frozen plan in the JSON-safe report, and proves an exact one-slide
relationship-free diff. The initial direct `a14:m -> m:oMath` form emitted no
fallback; the compatibility-hardened form now uses one
`mc:AlternateContent` choice containing
`a14:m -> m:oMathPara -> m:oMath` plus an editable linear-text fallback. It
still emits no picture and remains `deliveryEligible: false`. PowerPoint
16.111.3 opened, saved a shape-name edit, closed, and reopened the earlier exact
candidate without repair; that saved form retained native OMML and added a
PowerPoint-authored PNG fallback. The extracted fallback and exact-geometry
composite passed a pixel-only review, but there is no human formula-content edit.

Eleven OMML tests and the combined 67-test create-only/native/layout/OMML focus
pass. The bounded review's high shared-memory base-authentication race and
medium reserved-root containment bypass were fixed with copy-before-hash,
reserved root IDs, mandatory slot-check cardinality, and regressions; final
review found no remaining blocker, high, or medium issue. The complete suite
passes 930/930.

The implemented direct candidate-record slice adds a ninth closed root contract without
changing the meaning of the existing published `BuildArtifact`. For direct
semantic-slot native card-arrow and typed-OMML candidates, the bundle writer
must canonically persist the complete `SlideLayoutIR`, exact replayed
`ComposedSlidePlan` and constraint receipt, package diff, capability evidence,
base digest, candidate basename, byte length, and SHA-256. Loading must re-run
the resolver and reject any record/plan/source/evidence/file drift. Both files
are staged and file-flushed in one canonical directory; the record is linked
first and the PPTX last as the logical candidate commit marker. POSIX
additionally requests parent-directory fsync barriers. Windows retains the same
create-only ordering and exact reconciliation but has no sudden-power-loss
directory-entry persistence claim. Successful rollback removes both owned
links; if candidate removal or a supported directory barrier cannot be
confirmed, the record must remain. Existing destinations are never overwritten.
The old PPTX-only and publication-named 0.x APIs remain compatible but grant no
record-backed replay or delivery authority. Fixed-absolute artifacts fail
closed at this direct bundle boundary.

Three record-unit tests plus direct native and OMML bundle regressions pass in
the complete 942/942 suite. The bounded independent review found no remaining
blocker, high, or medium issue after fixes for cross-pair authentication,
profile/capability drift, filename and resource bounds, directory barriers,
and rollback ordering/failure handling.

The ordered branch must additionally bind base/source artifact digests,
slide/relationship/presentation ordering, complete deck diff, and candidate
bytes. The per-slide discriminated source build is the sole classification
authority; redundant deck-level native flags/counts and ordered source-profile
labels are forbidden. Clone/fill slides are digest-bound source artifacts;
every semantic native slide must keep its original base digest, source part,
complete IR/plan/receipt, source diff, and capability evidence. Generic and
native-containing ordered bundles use the same record-first/marker-last pair
publisher. Any
native slide without bounded-slot replay data fails before staging.
The candidate/contracts/native/OMML/ordered/support focus passes 166/166 and
the complete repository suite passes 945/945. The bounded D-028 review's one
medium redundant-classification drift was closed by the sourceBuild-only data
model; re-review found no remaining blocker, high, or medium issue.

The typed-OMML ordered extension reuses the same authenticated target-specific
native profile table and ordered bundle path. It copies authentic
formula slide bytes exactly, verifies the package through the formula artifact's
separately authenticated M2-005A shadow, and persists the complete OMML
IR/plan/diff/evidence tuple in the existing per-slide union. Formula-first and
formula-last order, first-source base digest, exact slide copy, report forgery,
and evidence drift are covered. The focused closure passes 201/201 and the full
suite passes 971/971; bounded independent review found no blocker, high, or
medium issue. No release or support gate is satisfied by this candidate-only
evidence.

The direct typed-OMML final-delivery implementation must regenerate from the
exact admitted source template and verified index, never from the clone/fill
compatibility artifact. Before the first async capability execution it must
snapshot the candidate/record, complete project tuple, output facts, receipt
references, and validator dependencies; it must then resolve a fresh dispatch
from the captured DeckSpec LaTeX. The regenerated archive, base identity, slide
identity, complete IR, composed plan, diff, formula digest, and target evidence
must equal the reviewed candidate. The source-to-output part set may change only
the target slide and PPTX content type. A legacy clone/fill title, changed LaTeX,
or any other part fails before external evidence is consulted.

An OMML delivery plan additionally requires an authenticated receipt whose
expected and returned operation is exactly
`formula-content-edit-save-reopen`. Shape-name edit/save/reopen evidence cannot
satisfy this gate. D-032's later passing mixed-candidate feature record also
cannot meet the exact direct-candidate receipt condition, even though the
executable gate is present. A no-op compatibility generation call that converges to the identical
source/DeckSpec-derived result is accepted; call history is not a second
authority. Fifteen OMML assembly tests, twenty-three direct-card final tests,
six direct-OMML final tests, and 978/978 complete tests pass. Bounded independent
re-review found no remaining blocker, high, or medium issue.

The bounded clone/fill ordered final-delivery implementation adds one complete-
batch path without changing that support result. It snapshots one exact
same-template 2–11 slide `DeckSpec` and project tuple before asynchronous work,
executes the resolver batch once, regenerates every one-slide clone/fill
artifact from source/index facts, and passes only those fresh artifacts through
the existing ordered assembler. The complete archive, base identity, slide
order/allocation/source hashes, and deck diff must equal the reviewed candidate
record before evidence is consulted. Mechanical and render receipts enumerate
every slide in exact order, compatibility is purpose-bound to
`ordered-deck-open-save-reopen`, and the shared publisher still exposes
`BuildArtifact` last. The 11-slide maximum is derived from ten fixed package
parts plus two per slide under the unchanged 32-entry secure-ZIP limit; 12
slides fail before dispatch or artifact inspection. At that implementation
boundary, eleven ordered-final tests, the 55/55 combined final focus, and the
990/990 complete suite passed.

One exact two-slide public-synthetic candidate now has a trusted local
`ordered-deck-open-save-reopen` receipt from PowerPoint 16.111.3. The source
remained unchanged; the same ordered readable text inventory was observed
before and after save/reopen; corresponding 1600 × 900 PowerPoint-rendered pages
were byte-identical; and an independent pixel-only review found no visible
defect. Raw PPTX/PDF/pixel/transcript evidence remains ignored and local.
Eight focused adapter tests and the complete 998/998 suite pass.

The bounded mixed ordered final-delivery extension now regenerates one exact
three-slide public-synthetic `clone/fill → typed OMML → native card-arrow`
story from the complete readable project tuple. One resolver batch preflights
all three capability selections, the assembler preserves each authentic source
slide and its complete per-kind replay facts, and the final boundary compares
the whole regenerated candidate and record before consulting evidence. Swapped
source-build roles, readable story/LaTeX drift, incomplete slide receipts, a
wrong compatibility purpose, and caller mutation after the async boundary fail
closed. The shared publisher still writes `QaReport` and exposes
`BuildArtifact` last; no new semantic authority document was introduced.

That exact mixed candidate also passed a trusted local PowerPoint 16.111.3
open/save/reopen probe. The native fraction was raised to 48 pt inside an
expanded semantic slot after the first pass proved compatibility but looked too
small. All three 1600 × 900 before/after page pairs are byte-identical, and the
frozen independent pixel review passed after an anomalous missing-text report
was replayed and withdrawn. The review prompts now require exact-image reopen
for alleged blank/missing content, while deterministic orchestration owns byte
equality through `prepareVisualEvidencePlan` and never asks a model to
rediscover it. Equal pairs produce one review image; different pairs retain
both, and SHA-256 binds snapshots without deciding equality.

To avoid repeated macOS folder/file consent, the trusted adapter reuses one
ignored regular-file carrier and replaces bytes in place while verifying stable
device/inode identity and exact resulting bytes. This deliberately non-atomic
transport is confined to the ignored manual probe; product inputs remain
read-only and product publication remains create-only.

The visual-evidence admission boundary uses captured TypedArray/ArrayBuffer
internal-slot getters, rejects forgeable metadata and shared/resizable backing
stores, and enforces per-image and aggregate limits before its immediate copy.
The bounded closing re-review found no blocker, high, or medium issue. The
complete repository suite passes 1021/1021 at this boundary. This remains
implementation and exact local compatibility evidence, not a release or support
promotion.

D-031 closes the mechanical, render, independent-pixel, compatibility, QA, and
`BuildArtifact` chain for the one exact fixed mixed candidate. Its public
manifest/inspection API is non-authorizing; the fixed trusted-local CLI alone
rerasterizes captured bounded PDF snapshots, validates exact page/PNG identity,
and creates private one-shot receipts before the existing publisher exposes
`BuildArtifact` last. The bounded re-review reports no blocker, high, or medium,
and the complete repository suite passes 1032/1032.

D-032 adds a strictly non-authorizing formula-content observation lane. One
fixed ignored derivative visibly changes the exact mixed candidate from `3/3`
to `2/3` and remains editable after save/close/reopen. The public inspector
reports machine observations only; it does not claim a closed OMML grammar
check. The trusted-local recorder pins the exact candidate/record/derivative
digests and stores explicit operator statements separately. Its output is
feature-level, `authority: none`, and `deliveryEligible: false`; it cannot mint
the direct single-slide compatibility receipt or a support claim. Twelve
focused tests and the complete 1044/1044 suite pass. Final re-review reports no
blocker or high; the accepted Medium is limited to a detectable same-principal
directory-swap residual on the ignored create-only evidence pathname. The
operator explicitly attested that both opens produced no repair/conversion
prompt, so `COMPAT-OMML-001` passes at this feature scope.

The fixed mixed delivery profile also directly passes both shared publication
fault states. Pre-commit cancellation completely removes the owned delivery
directory and reports `not-committed`; failure immediately after the
`BuildArtifact` link reports `commit-uncertain`, performs no destructive
rollback, and retains all four committed files. These are executable public-
synthetic regressions, not an inference from the direct-card profile, and they
add no second publisher. The mixed focus passes 13/13 and the complete suite
passes 1046/1046.

D-033 therefore closes the M2-005 implementation milestone for this exact fixed
mixed public-synthetic vertical slice. It does not generalize the result to
arbitrary templates, target-specific native/OMML ordering, or other platforms.
The unavailable direct single-slide OMML path still requires its exact purpose-
bound formula-content receipt before that path can deliver anything.

A release claim remains separate and still requires the CLI/package/public-CI
and broader platform/template/fault evidence named by the later milestones.
Any release scope that includes direct OMML or generalized ordered native/OMML
delivery must first close those path-specific gates. These exact local chains
change no support status.

D-034 begins but does not satisfy the CLI release gate. The dependency-free
workspace runner now provides protocol `0.1.0`, stable `0/1/2` exits,
deterministic single-object JSON output, path/content-redacted failures, and
real public-synthetic `inspect` plus read-only `validate` commands. Inspection
writes only the exact configured TemplateIndex path through create-only staging;
validation creates no output or dispatch plan. The remaining six M3-001 command
names fail unavailable. A release still requires the complete public-synthetic
project-to-candidate flow, package metadata/tarball gates, clean install, and
public CI; D-035 below corrects its order and blocked-QA semantics. This slice
promotes no support row.

D-035 corrects that release path before any renderer work. The first release is
a **candidate alpha**: one installed public-synthetic project may produce a
candidate PPTX plus CandidateBuildRecord, while the existing QaReport must say
`blocked` whenever required rendered, pixel, or compatibility evidence is
missing. A successfully computed blocked assessment is an executable QA result,
not a passing delivery; the smoke gate requires no BuildArtifact to exist. A
delivery alpha remains gated on actual required evidence.

The current document-only Schema check is not the alpha `validate` gate.
Whole-project validation must load the complete ProjectConfig, TemplateProfile,
TemplateIndex, CapabilityRegistry, ProjectOverlay, and DeckSpec identity/hash/
binding graph, resolve the normative support decision through a real static
host, complete full-batch preflight, execute no project invocation, and write
nothing. Render must later prepare a fresh one-shot plan. ProjectConfig remains the sole
TemplateIndex-path authority, so the private draft `inspect --output` argument
must be removed before packaging.

No successful render is allowed while any required support-matrix dependency is
`unsupported/unavailable`. The first exact public-synthetic native-card profile
must enumerate and prove its complete dependency closure, promote only those
rows to `experimental` in the same reviewed change, require explicit opt-in,
and keep `supportClaimsEnabled` false. A conformance-only policy override fails
the release gate.

Packaging/leakage and minimum security/contribution/governance documents precede
the fresh public preflight. The public repository must then be created before
the final Linux/Windows/macOS public CI evidence is collected and before final
repository metadata, support text, changelog, and release notes are frozen.
`doctor`, generic `onboard`, standalone `diff`, and formula CLI are not
candidate-alpha blockers.

D-036 passes that project-spine gate but not the render or release gate. The
production public-synthetic preset creates one explicit-root project with
ProjectConfig-last commit semantics and exact `not-committed`,
`rollback-incomplete`, and `commit-uncertain` fault outcomes. `inspect` has one
configured output authority. Document and project validation are separate.
Project validation re-inspects the source, exact-compares the index, admits the
fixed static registration through installation conformance execution, applies
normative experimental opt-in, prepares the complete batch, discards its
one-shot plan, executes no project invocation, writes nothing, and reports
render eligibility as not granted.

Nineteen CLI tests, a 263-test focused set, and the complete 1065-test suite
pass. The bounded review's two high and one medium findings are closed with 0
blocker, 0 high, and 0 medium remaining. The next release-gate dependency is an
exact one-slide native-card candidate render whose complete exercised matrix
closure is promoted together to experimental. No support row or release claim
changed in D-036.

D-037 passes the candidate-render gate for exactly one installed
public-synthetic one-slide native-card profile. Its static host requires fifteen
invariant rows, the executing Linux/macOS/Windows Node 22/24 row, and
`automated-public-synthetic`; every row must remain
`experimental/accept-with-warning`, explicit opt-in is required, and the global
support switch remains false. The same stable read supplies both source bytes
and a full TemplateIndex which must match the installation-owned readable
golden. Render re-derives and exact-compares semantic geometry, executes one
fresh plan, verifies occupancy and exact collateral diff, and publishes a
replayable CandidateBuildRecord before the PPTX commit marker.

The writer has explicit not-committed, rollback-incomplete, and commit-uncertain
fault outcomes. Process tests prove deterministic bytes across roots,
create-only preservation, source immutability, and the absence of QaReport and
BuildArtifact. The installed CLI's recursively checked import closure contains
only native-card authentication plus the shared pair state machine; it excludes
the legacy broad OMML/ordered entry. A frozen local render received a clean independent pixel-only
review, but ignored local evidence is not installed release authority. D-037
therefore does not pass the candidate-alpha release gate: the next required
slice is an installed QA command that emits a schema-valid blocked QaReport and
no BuildArtifact when required public render/pixel/compatibility evidence is
unavailable. Packaging, clean-install, leakage, public repository, and public
cross-platform CI gates also remain open.

At D-038 closure, that slice passed the installed honest-QA gate for the exact D-037 pair. QA reloads
the current project graph, repeats the render derivation with a fresh one-shot
plan, rebuilds the authenticated expected PPTX and canonical
CandidateBuildRecord, stable-reads the actual commit marker then record, and
requires exact byte equality plus record replay. Missing, oversized, tampered,
noncanonical, or stale inputs fail without creating a report. A valid pair
creates one schema-valid QaReport containing three internal passes and three
external unavailable outcomes; it exits successfully with `decision: blocked`
and creates no BuildArtifact. The command accepts no evidence/output override,
ignored local evidence cannot alter its bytes, and report publication is
create-only. This closes M3-001's product spine, not the package/release gate:
M3-002 package boundaries, M3-003 tarball/leakage, and M3-004A local workflow
contracts and M3-005A's minimum public documents are complete. D-045 later
closed the empty-shell, PVR, repository binding, and repository-bound package
gate. M3-006 later completed the first ref. Pull-request six-cell CI and
Dependency Review passed for historical branch object `94b5c1c`; the next
committed PR head still needs fresh checks, and M3-004B also remains partial for
accepted-main CI/CodeQL. M3-005B remains blocked on that hosted evidence.

The D-029 authority rule applies to that work: the source template owns
unchanged inherited content/structure; readable authored semantic sources,
`SlideLayoutIR`, and `ComposedSlidePlan` remain the planning/calculation chain;
PPTX and screenshots are derived delivery facts. Existing digests bind exact
objects only. Before QA pass, final delivery must deterministically reconstruct
the complete IR/plan through the same pure derivation used by generation,
exact-compare both relationship objects, then reconstruct the target-specific
source + index/overlay + DeckSpec + plan package and reject every unexpected
part or semantic change. Matching only a resolved box is a gate failure. It
then reuses a passing `QaReport` and emits `BuildArtifact` last as the commit
marker; it must not introduce `GenerationIntent`, a persisted formula AST, or a
parallel root receipt merely to repeat the same facts.
