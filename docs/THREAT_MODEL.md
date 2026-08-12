# Threat Model

## Protected assets

- user-owned source templates and content;
- filesystem paths and local metadata;
- output integrity and source immutability;
- CI, signing, registry, and provenance credentials;
- machines with PowerPoint or private compatibility fixtures;
- public package and release integrity.

## Trust boundaries

- untrusted PPTX/POTX ZIP/XML input;
- caller-supplied parsed package views whose labels do not prove trustworthy
  origin;
- untrusted project/specification files;
- declarative capability registries, open slide payloads, binding selections,
  and caller attempts to substitute executor/schema/QA identities;
- local assets and optional external processes;
- public pull-request workflows;
- trusted release and optional PowerPoint hosts;
- npm tarball and installed CLI boundary.

## Priority threats

1. archive traversal, symlink escape, decompression bomb, duplicate/case-conflict
   ambiguity, nested archive, and resource exhaustion;
2. XML entity expansion, parser exhaustion, external relationship/network
   access, macro/ActiveX/OLE execution, and embedded payloads;
3. overwrite of source or existing output, path confusion, time-of-check/time-
   of-use races, and non-atomic publication;
4. private data leakage through logs, errors, reports, source maps, snapshots,
   package files, CI artifacts, or dependency metadata;
5. malicious project configuration selecting an undeclared executable or
   escaping allowed roots;
6. untrusted pull-request code reaching private fixtures, desktop automation,
   tokens, or signing identity;
7. dependency substitution, unpinned workflow actions, compromised tarball, or
   mismatch between reviewed and published content;
8. capability overclaim causing silent flattening, collateral mutation, or
   false editability/compatibility evidence.
9. registry strings triggering dynamic code loading, schema substitution,
   incomplete conformance registration, replayed execution, or QA spoofing.
10. same-ID registry substitution, duplicate or dangling semantic bindings,
    caller mutation during resolution, fixture-specific target fallback, or a
    data-only operation plan being mistaken for authorized OOXML mutation.
11. an unbound native XML exemplar being concatenated into a target slide,
    component-local object IDs colliding with existing or nested shape IDs, or
    user text/style data escaping the fixed native vocabulary.
12. formula data selecting or altering an executable, argv, path, environment,
    defaults/filter/reference file, resource lookup, or network request; a
    warning-producing TeX conversion silently degrading to text; a missing or
    compromised process hanging, forking, or exhausting memory/output; or its
    DOCX/OMML output exploiting archive, relationship, XML, namespace, or
    version-drift ambiguity.
13. a canonical OMML exemplar being mistaken for insertion authority, raw XML
    entering PresentationML, target capacity being ignored, a reserved layout
    root ID bypassing slot containment, or shared backing storage changing
    after base-artifact authentication but before the downstream snapshot.
14. treating the private monorepo root as an installation root, allowing a
    cross-package relative import, resource lookup, broad source scan, duplicate
    staged target, undeclared dependency, non-executable bin, unverified or
    drifted repository ID/owner/name/URL/directory/protocol, or a pre-binding
    reviewed stage being accepted under a changed plan to produce a packable
    but unusable, stale, or leaking package.
15. releasing from a mutable working tree, a moved tag, a source commit that is
    not admitted by the complete reachable-history policy, a stale or partial
    package stage, or a lock that does not bind both fixed builders to the same
    four canonical tar payload byte strings and the fixed builder's exact gzip
    release envelopes.
16. publishing one package before a later package's already-observable registry
    conflict is discovered, replaying an earlier partial publication with
    different bytes, allowing `latest` to move, or treating `npm unpublish` as
    rollback for an irreversible registry write.
17. accepting a self-asserted provenance payload without proving the Sigstore
    certificate identity, allowing a workflow run from another repository,
    ref, commit, or attempt to authorize the current package, or exposing npm
    and GitHub credentials to the same execution boundary.
18. creating a GitHub Release before the complete registry graph is reread and
    verified, or accepting an existing Release whose tag, target, prerelease
    state, body, lock identity, or package identities differ from the closed
    release plan.

## Default controls

- canonicalize and contain every path; create outputs in isolated staging;
- parse package metadata before extraction and enforce conservative limits;
- keep semantic inspection free of filesystem/archive/XML I/O; only a separately
  proven secure ingestion boundary may convert untrusted bytes into its package
  view;
- disable network/entity resolution; reject high-risk OOXML in 0.x;
- pass explicit minimal environments to external processes with time/output
  limits and no shell interpolation;
- redact paths/content at the report boundary and test redaction with mutations;
- use synthetic public fixtures and isolate optional private tests;
- use positive Git/package allowlists and inspect binary magic;
- separate public PR, trusted release, and PowerPoint/self-hosted workflows;
- bind release provenance to the reviewed commit and tarball digest.
- keep release planning, package planning, and observed completion separate:
  one tracked release plan fixes the tag/builders/inputs/recovery contract, one
  create-only lock binds exact locked inputs and tarball bytes, the exact tag
  binds the source candidate, and only official GitHub/npm responses can prove
  that publication occurred;
- complete a read-only four-package registry admission before the first write,
  freeze admitted tarball buffers outside the reviewed stage, publish only the
  exact dependency prefix, and never use unpublish as recovery;
- validate npm provenance cryptographically against the exact GitHub Actions
  certificate identity and issuer as well as the closed SLSA payload, package
  digest, source tag, source commit, workflow, and invocation relation;
- isolate GitHub source verification, npm publication, and final GitHub Release
  declaration so no process receives both npm and GitHub write credentials;
- derive package staging only from the closed positive package plan; validate
  every source/target, export, type, bin, import alias, dependency edge, asset
  owner, mode, count, and size before copying. Installed composition receives
  exact package-owned paths and cannot accept both a legacy installation root
  and explicit artifact paths.
- validate support claims against a versioned positive matrix; unknown items and
  missing evidence remain explicit failures.
- keep executable capability mappings closed and trusted; bind every executor,
  schema, fixture, and QA identity exactly, validate frozen input/output, and
  preflight the full batch before execution.
- snapshot the complete project document set before callbacks, authenticate
  exact registry content against private runtime state, resolve semantic keys
  without content/geometry inference, and keep operation plans separate from
  staging authority.
- construct native exemplars from closed typed data, escape through one
  canonical serializer, strict-parse and exact-allowlist the output, mark it
  non-insertable, and defer full-tree ID allocation and application to isolated
  staging.
- keep optional Pandoc execution outside core; require a trusted absolute path,
  no shell, fixed argv, an explicit minimal environment/cwd, bounded stdin,
  separate streaming stdout/stderr ceilings, a timeout, fixed RTS limits,
  `--sandbox`, and `--fail-if-warnings`; admit only a fixed version window after
  API and exact output probes, and omit registration on any drift.
- treat converter stdout as untrusted DOCX bytes, pass it through the fixed
  secure ZIP and strict XML boundaries, validate exact OPC relationships and a
  closed Word/OMML wrapper, rebuild the typed allowlisted tree canonically, and
  mark the resulting fragment unbound and non-insertable.
- at the target boundary, authenticate by report identity, admit intrinsic byte
  length, copy before hashing, reparse OMML under a smaller target capacity,
  rebuild typed nodes with fixed properties, reserve the layout root identity,
  require one containment check per placement, and emit only a non-deliverable
  candidate with the complete IR/plan record retained.

## M1-005 implemented input boundary

The secure-ingestion lane never extracts a member. It reads at most a 1 MiB
stable source snapshot and admits at most 32 contiguous stored/DEFLATE entries,
256 KiB compressed/expanded per entry, 1 MiB declared expanded total, a 100:1
ratio, a 128 KiB central directory, at most 4 KiB of local extra data per entry,
and 32 KiB total local extra data. Central extras remain rejected. The only
local exception is one exact Open Packaging Growth Hint (`0xA220`) occupying
the complete extra area with signature `0xA028`, canonical current length, and
zero padding. It rejects ZIP64, encryption, data descriptors, every other
extra/comment, multi-disk archives, prefixes/trailing bytes,
duplicate/case-aliased paths, archive symlinks/special entries, overlap/gaps,
CRC/size drift, nested archives, and DEFLATE trailing data.

XML is fatal UTF-8 with no BOM, DTD, declared entities, comments, CDATA, or
post-declaration processing instructions. Limits are 256 KiB per part, depth
64, 10,000 elements and attributes per part, 50,000 elements per package, 32
attributes per element, 4 KiB per attribute, and bounded text. Namespace names
are expanded before an exact PresentationML allowlist is applied. All parts,
content types, relationships, and nodes must be consumed. External targets,
macros, ActiveX, OLE, embedded payloads, and unknown features are rejected.

The filesystem reader rejects symbolic-link components, verifies canonical
containment, uses a read-only `FileHandle` plus `O_NOFOLLOW` where exposed, and
compares file/path identity before and after its exact-size read. Portable
Node.js does not provide a cross-platform descriptor-relative `openat2`-style
walk. Hostile concurrent ancestor replacement, hard-link/bind-mount aliases,
unusual Windows reparse points, and weak network-filesystem identity semantics
remain residual threats. Strong hostile-directory isolation requires a native
broker or a trusted already-open handle. This limitation prevents an
arbitrary-hostile-directory claim but does not permit a support promotion.

## M2-001 implemented dispatch boundary

Declarative registry URNs never trigger filesystem search, dynamic import,
`require`, `eval`, network access, or a child process. Runtime admission is
atomic: only a complete exact artifact bundle whose nonempty conformance cases
execute through input schema, preflight, output schema, and every QA assertion
enters a module-private executable map. Metadata-only definitions remain known
but unavailable.

Invocation data is bounded descriptor-safe JSON, detached from the caller, and
deeply frozen. Exact capability/version lookup, support policy, binding roles,
input validators, and all executor preflights complete for the whole batch
before an opaque plan is returned. The plan is authenticated by private module
state and marked consumed before the first asynchronous execution step. Outputs
are bounded and frozen again before exact output validation and QA. Aggregate
node and UTF-8 budgets, including object keys, are enforced during traversal;
registration conformance never rereads caller-owned records after an `await`.
Rejected Promises returned from sync-only trusted callbacks are consumed before
the mapped failure is raised. Stable errors expose only codes and structural
pointers.

The dispatcher is not a JavaScript sandbox. Executors, validators, QA
assertions, and the support resolver are trusted in-process code from a future
closed package catalog; malicious or non-terminating trusted code can still use
its own ambient authority. The M2-001 probe has no I/O or mutation authority.
Staging isolation, rollback, source immutability, collateral diff, and atomic
publication remain M2-005 controls, so no product capability is promoted.

## M2-002 implemented resolution and planning boundary

`prepareResolvedDeckDispatch()` captures data properties once, bounds and
freezes registry, overlay, index, and deck documents before calling any
validator, then checks their complete runtime-relevant semantic graph. It
rejects mismatched identity chains, duplicate or case-aliased package owners,
dangling layout/slide relationships, duplicate shape/source identities,
unknown capability versions, incomplete/unsorted roles, binding reuse or
orphans, duplicate targets, missing containers/shapes, kind mismatch, and
duplicate output slide IDs. An exact deep registry comparison through
M2-001's private runtime state prevents a different registry from reusing the
same public ID/version. Intermediate invocations stay private and the resolver
calls dispatcher preparation only after every slide resolves.

The clone/fill plugin has no file, archive, XML, network, process, dynamic-load,
environment, or staging authority. It requires two distinct resolved text-box
bindings on one semantic source slide and emits only a closed JSON plan naming
one clone operation and ordered body/title fill operations. Input schemas,
UTF-8 limits, output schemas, and QA preserve exact text and semantic identity;
they do not prove that any source part, relationship, or identifier was copied
or changed.

Validators, the plugin, QA assertions, and support resolution are still trusted
in-process code rather than a sandbox. The semantic operation-plan output can
be retained or replayed by code outside the dispatcher, but it carries no writer
or package credential and cannot mutate a presentation in this slice. M2-005
must rebind the plan to an
inspected digest and isolated create-only staging graph, remap identities and
relationships, reject collateral changes, discard failed staging, and publish
atomically. Until then, normal product dispatch remains unavailable.

## M2-003 implemented native-component boundary

The native-card-arrow plugin has no filesystem, archive, network, process,
environment, dynamic-loader, source-package, or staging authority. It accepts
one resolved slide text-box anchor and closed scalar data only. Geometry,
uppercase RGB colors, font size, and safe Unicode text have fixed schema and
preflight limits; callers cannot supply XML names, nodes, attributes,
relationships, presets, raw fragments, paths, or source IDs.

The plugin builds one fixed internal group tree, canonically escapes and
serializes it, then reparses the UTF-8 through the bounded strict XML parser.
QA locks the exact namespaces, 54-element/40-attribute resource shape, one
group, two ordered native shapes, local ID/name sequence, `roundRect` and
`rightArrow` presets, geometry, colors, and decoded text. Canonical equality
and the expanded-name allowlist exclude pictures/blips, graphic frames,
connectors, custom geometry, theme/gradient/pattern colors, effects,
extensions, hyperlinks, relationship attributes, and unsupported markup.

The result remains a replayable data object outside dispatcher control and has
no writer credential. Its XML is explicitly an unbound conformance exemplar,
`insertable: false`, with component-local numeric IDs that may collide with
the target slide. M2-005 must ignore those IDs as final authority, recursively
validate the complete target shape tree, rebuild from typed component data,
allocate unique positive UInt32 IDs, validate actual slide containment, and
apply only to disposable create-only staging. Raw concatenation or string ID
replacement is forbidden. PowerPoint open/edit/save/reopen, text fit, visual
fidelity, source isolation, collateral diff, rollback, and publication remain
unproved.

## M2-004 implemented optional-process and OMML boundary

Only `packages/adapter-pandoc-omml/src/node-process-runner.mjs` imports
`node:child_process`. Its trusted constructor requires an absolute executable
and working directory plus an explicit small allowlisted environment; it never
reads ambient cwd/environment and capability data cannot supply process
configuration. Every request snapshots fixed arguments and bytes, uses
`spawn(..., { shell: false })`, pipes only, streams separate output ceilings,
and kills on timeout or overflow. Stable outcomes and adapter errors omit the
executable path, environment, raw stderr, signal detail, and formula text.

The adapter accepts only a canonical Pandoc version in `>=2.15.0 <4.0.0`, then
requires a sandboxed JSON-API probe and an exact repository-owned fraction-to-
DOCX/OMML probe. All calls fix `--sandbox`, `--fail-if-warnings`, stdout output,
and RTS heap/stack requests. The executable receives no user argv, input file,
filter, custom writer, defaults file, resource path, reference document, URL,
or inherited user-data environment. Validated formula text is JSON-encoded only
as the data value of one Pandoc `Math/DisplayMath` AST node on stdin. Nonzero,
warning/stderr, missing, malformed, timed-out, output-limited, unsupported, or
capability-drifting results cannot produce an executor registration or formula.

DOCX stdout is never treated as XML or extracted to disk. It passes the existing
1 MiB/32-member/256 KiB/100:1 non-extracting ZIP profile, an exact formula-DOCX
part and internal-relationship set, strict namespace-aware XML parsing, a
single Word display-math wrapper, and a 256-element/128-attribute/4 KiB-text
OMML subset. The adapter reserializes namespace-expanded typed nodes with fixed
prefixes and escaping; it never substring-captures or transplants raw converter
XML. The result is an unbound conformance fragment with `insertable: false` and
no writer/package authority.

The public tests use a fake runner and repository-authored text-derived DOCX;
they do not execute or redistribute Pandoc and prove no real release/platform
compatibility. A configured executable is trusted host software: a compromised
binary retains its operating-system authority. Portable Node process control
does not provide a kernel memory/CPU sandbox or reliably terminate descendants;
the RTS request, timeout, stream limits, sandbox mode, and omission of ambient
configuration reduce but do not eliminate that risk. TexMath/Docx writer drift,
fonts/layout, PresentationML wrapping, target application, source isolation,
collateral diff, publication, and PowerPoint open/edit/save/reopen remain M2-005
or COMPAT-OMML-001 obligations.

## M2-005 implemented typed OMML target boundary

The target applicator accepts only one authentic M2-005A artifact and one exact
one-shot `formula-transplant@0.1.0` dispatch result. Base bytes pass intrinsic
length admission, are copied before hashing, and only the verified snapshot is
parsed. The applicator strict-parses the unbound formula again, requires the
closed allowlisted topology, and applies a smaller 64-element/16-run/256-byte
target budget before any slide mutation.

Core constructs namespace-expanded nodes and fixed DrawingML run properties;
it never concatenates the fragment or imports the adapter. One direct
`a14:m -> m:oMath` tree replaces the authenticated target paragraph. No
relationship, picture, `mc:AlternateContent`, or fallback is generated. The
target remains bound to a semantic slot in the JSON-replayable `SlideLayoutIR`
and frozen `ComposedSlidePlan`; `slide-canvas` is a reserved root identity and
every bounded placement must produce one slot-containment check. Restoring the
target must make the complete slide byte-equal to the authenticated base, and
only the exact verified report/bytes can enter the non-deliverable candidate
writer.

PowerPoint may normalize the candidate after trusted local open/save and may
author its own raster fallback while retaining the native OMML choice. Such a
post-save fallback is external compatibility output, not permission for the
generator to flatten. Current evidence covers one public-synthetic shape-name
round trip and a bounded pixel composite, not a direct PowerPoint screenshot,
human formula-content edit, real-Pandoc matrix, arbitrary target, actual formula-
content final-delivery authorization, or support claim.

## M2-005 implemented candidate-record persistence boundary

An editable PPTX does not contain the layout constraints needed for safe later
regeneration. The direct semantic-slot native paths therefore serialize a
closed `CandidateBuildRecord 0.1.0` beside the candidate. The record keeps the
complete IR, replayed plan and receipt, exact diff, capability-specific facts,
base digest, and candidate basename/length/SHA-256. Canonical parsing is size-
bounded before copying, rejects non-ASCII or oversized basenames, re-runs the
layout resolver, and binds the source artifact/profile/evidence/diff reason and
expected native component identity as one tuple. A live artifact object is
captured once before authentication, preventing Proxy-driven byte/report
cross-pairing.

Both staged files are flushed on every admitted platform before the PPTX
logical commit marker. On POSIX, the record-first/PPTX-last order additionally
requests parent-directory fsync barriers. Node does not expose an equivalent
Windows directory-entry barrier, so green Windows CI proves create-only
visibility and byte/identity checks, not sudden-power-loss directory-entry
persistence. On handled failure, candidate removal must succeed before record
removal is attempted. POSIX additionally requires the intervening parent-
directory fsync request to succeed; Windows preserves the logical removal order.
If either candidate step cannot be confirmed, the record is
retained, so rollback never intentionally exposes a candidate after deleting
its record. The legacy PPTX-only API remains
available for compatibility and carries no replayable-regeneration or delivery
authority.

The ordered branch authenticates one complete report/byte pair and receives its
record facts only from the assembler's private identity map. The record fixes
base and per-slide source digests, slide order, part and relationship
allocation, deck diff, and output bytes. The per-slide discriminated
`sourceBuild` union is authoritative; redundant native flags, counts, and
ordered source-profile labels are not serialized and therefore cannot disagree
with it. Clone/fill slides are marked as digest-bound sources; no invented
layout intent is accepted. Every semantic native slide must carry a bounded-slot
IR whose exact composed plan replays and whose source diff closes. Card-arrow
slides also validate allocated IDs; typed-OMML slides validate formula digest,
target capacity, and observed facts. Raw-coordinate native slides therefore fail
before any stage file exists. The shared pair publisher preserves the same
resource, create-only, file-flush, logical commit-marker, and safe-rollback
properties, plus POSIX parent-directory fsync requests.

This candidate-record boundary does not cover fixed-absolute compatibility
outputs, hostile-directory changes by another principal, target-specific
native/OMML ordered final delivery, actual compatibility evidence, or support
promotion. Clone/fill-only ordered final preparation is separately bounded
below; the record alone never authorizes it.

## M2-005 implemented source-preserving OMML final-delivery gate

The direct final boundary does not trust an OMML candidate's discriminator,
record digest, or embedded title text. It snapshots all caller-owned bytes,
project documents, output facts, receipt references, and dependency callbacks
before its first async operation. From those frozen facts it resolves a fresh
one-shot formula dispatch whose payload is the exact readable DeckSpec LaTeX,
derives the normalized base directly from the admitted source template and
verified index, and runs the same typed OMML mutation core used by candidate
generation.

Authorization requires the regenerated archive bytes and every recorded
relationship fact—base/slide identity, full SlideLayoutIR, composed plan and
receipt, diff, formula digest, and target evidence—to equal the reviewed
candidate. The source and output must contain the same part names, and only the
target slide plus PPTX content-type conversion may differ. Consequently, the
older clone/fill compatibility candidate cannot smuggle its authored title into
delivery, and changed LaTeX cannot reuse a visually or structurally plausible
record. These failures occur before external receipts.

The boundary does not attempt to identify which API call created otherwise
identical facts. A no-op clone/fill path that restores the source-owned text and
converges to the exact source/DeckSpec-derived archive and report is accepted.
Treating hidden call history as authority would add an unverifiable provenance
special case without protecting any observable relationship.

The compatibility authenticator receives the required operation in its expected
facts, and the returned receipt must independently state
`formula-content-edit-save-reopen`. Shape-name evidence is rejected. This closes
the confused-purpose receipt path in code, but the exact direct-candidate
formula-content receipt is still absent; the support switch and all matrix statuses remain
unchanged. Publication reuses the existing create-only, one-shot,
BuildArtifact-last boundary, so no second delivery contract or publisher exists.

That shared publication boundary is now executed directly with the fixed mixed
three-slide profile. Cancellation before the build-marker link must remove the
candidate record, QA report, PPTX, stages, and reserved directory before
reporting a complete rollback. Once the build-marker link succeeds, the same
failure becomes commit-uncertain: rollback is not attempted because deleting a
possibly committed delivery would destroy the user's only recoverable state.
The regression requires all four public files to remain. A profile-specific
publisher or recovery branch is forbidden; it would create two incompatible
commit-state machines for the same `BuildArtifact` contract.

## Formula-content observation is not receipt authority

PowerPoint rewriting creates a tempting confused-authority path: a readable
edited derivative can look like proof of the project's closed OMML grammar, and
a human statement can be mislabeled as a machine result. D-032 forbids both.
The public inspector accepts only detached candidate, CandidateBuildRecord, and
derivative bytes and returns narrow machine observations with
`closedGrammarValidated: false`, `authority: none`, and no gate verdict.

Only the fixed trusted-local recorder may produce the ignored feature record.
It pins the exact candidate/record/derivative digests and their source/slide
relation, refuses CI, and records operator and no-repair statements under a
separate `operatorAttestation`. Alternate self-consistent candidates,
collateral slide mutation, added unknown parts, or unknown math vocabulary do
not become compatible evidence. The result still cannot mint or substitute for
the direct single-slide `formula-content-edit-save-reopen` receipt.

Node.js does not expose a portable `openat` equivalent for the final
create-only evidence pathname. `wx` prevents overwrite and directory
device/inode/realpath checks detect a concurrent root swap, but they cannot
prevent a same-principal swap before creation. That Medium residual is accepted
only because the file is ignored, fixed-root, trusted-local, and permanently
non-authorizing; it would be unacceptable at the product publication boundary.
The operator explicitly attested that both opens occurred without repair or
conversion prompts, so the fixed feature-level gate passes. The direct single-
slide receipt and support state remain unchanged.

## M2-005 implemented clone/fill ordered final-delivery gate

The ordered preparer does not trust candidate bytes, record labels, per-slide
source hashes, or earlier one-slide call history as generation authority. Before
its first async execution it snapshots the complete candidate/record, source
template, profile/index, registry/overlay, 2–11 slide DeckSpec, output facts,
receipt references, runtime, and validators. It then resolves one complete
batch from those readable facts and consumes that plan once.

Every returned semantic plan is applied to the exact captured source/index by
the existing clone/fill assembler. Only the resulting freshly authenticated
one-slide artifacts enter the unchanged ordered graph rebuilder. Authorization
requires exact equality of the complete ordered archive plus base identity,
slide order, part/relationship allocation, source artifact hashes, source-build
classifiers, and deck diff. The source-to-candidate changed-part relation is
independently recomputed. Content/order drift, a target-specific native or OMML
member, caller mutation after capture, or any collateral part change fails
before external receipts.

Mechanical and render receipts must enumerate every slide ID in exact order;
compatibility is independently purpose-bound to
`ordered-deck-open-save-reopen`. The shared create-only publisher remains
one-shot and exposes `BuildArtifact` only after candidate and QA publication.
The package grammar has ten fixed ZIP parts plus a slide and relationship part
per slide. Under the unchanged 32-entry secure-ZIP limit, 11 slides are the
last executable size; 12 are rejected before dispatch or artifact inspection.
The CandidateBuildRecord parser retains its existing 16-slide representational
ceiling for compatibility, but that is not an execution or support promise.

One real ordered-deck PowerPoint receipt now exists only in the ignored local
evidence root for the fixed two-slide public-synthetic clone/fill candidate.
The adapter requires an explicit trusted-local flag and refuses CI. It creates
or exact-reuses only its fixed candidate/record, refuses pre-existing output,
uses absolute paths, and verifies the source bytes again after PowerPoint
returns. Its static AppleScript uses no shell, System Events, or VBA; it refuses
pre-open user presentations and checks that each running presentation set
contains exactly the expected absolute target. A cold-start exception may close
only PowerPoint's sole unsaved, empty-path startup presentation when the
application was not already running. Process time/output are bounded, errors
are redacted, partial outputs never create a receipt, and raw PPTX/PDF/text/
pixel/review evidence stays ignored.

PowerPoint 16.111.3 preserved the exact ordered readable inventory, while the
corresponding 1600 × 900 before/after page pixels were byte-identical and passed
one independent anonymous pixel review. Those readable and pixel facts are the
compatibility evidence; hashes bind exact objects only. This does not cover the
full 2–11 range, target-specific native/OMML ordered final delivery, arbitrary
templates, broader failure evidence, hostile-directory races by another
principal, or support promotion.

## M3-001 first CLI boundary

The CLI is an orchestration boundary, not a second validator or authorization
system. D-034 moves the existing bounded JSON Schema subset into core and keeps
the old script import as a compatibility re-export. The CLI loads only the
installation-supplied manifest and its exact registered Schemas; user input
cannot select a schema path, module, executor, or support status.

Project JSON reads require explicit normalized absolute paths below an explicit
real directory root. Every project-root segment is checked without following a
project-internal symlink, the final regular file is opened with `O_NOFOLLOW`
where available, size is bounded before allocation, one exact snapshot is read,
and before/after handle identity must match. `inspect` then delegates PPTX/POTX
handling to the existing stricter stable-handle ZIP/XML/OPC ingestion boundary.
Its output must equal the ProjectConfig's TemplateIndex location and is created
through a same-directory exclusive stage plus hard-link publication; existing
destinations are never replaced. Portable hostile-directory atomic containment
is still not claimed.

JSON mode returns exactly one stdout object on success or failure. Only a fixed
protocol version, admitted command name, boolean status, result, or redacted
`code + pointer` is serialized. Exception messages, stacks, causes, project
paths, filenames, source bytes, XML, and external stderr never cross the
boundary. Unknown failures collapse to `CLI_OPERATION_FAILED`. Deferred commands
return `CLI_COMMAND_UNAVAILABLE`; they cannot reach tests, labs, adapters,
capability execution, publication, or support mutation.

## M3-001 public-synthetic project spine

D-036 keeps the conformance bootstrap out of the testing composition root.
`packages/public-synthetic` owns only repository-authored source parts,
deterministic fixture construction, and one fixed schema-validated preset. User
data cannot choose a fixture source, capability module, schema, support row,
binding rule, or renderer. The selected project root must be one normalized
absolute path whose direct parent is an existing real directory; an existing
root is a conflict and is never reused or overwritten.

Exclusive root creation establishes ownership, and its device/inode identity is
captured before writes. ProjectConfig is the visible commit marker. Before that
pathname becomes visible, failure triggers deletion of only the six fixed file
paths and six fixed directories. Rollback proceeds only while the root identity
still matches; unknown content, identity drift, deletion failure, or a failed
supported parent-directory barrier reports rollback-incomplete and leaves reconciliation
state. Once the marker open succeeds, every write/file-sync/root-sync/parent-
sync failure reports commit-uncertain and performs no rollback. Root and parent
directory barriers are POSIX-only; Windows retains file flush, create-only
visibility, identity checks, and state-machine behavior but claims no sudden-
power-loss directory-entry persistence. Node.js still
has no portable `openat`/`unlinkat` directory-handle API, so a hostile
same-principal pathname swap between the identity check and fixed cleanup calls
cannot be made impossible; detected or incomplete cleanup never claims a clean
retry.

Whole-project validation reads all six documents through the existing contained
JSON boundary and securely re-inspects the template before comparing the stored
index. The static host loads only fixed installation artifacts and the
normative matrix. Runtime admission intentionally executes the registration's
two installation conformance fixtures; this is not described as zero executor
execution. The prepared user-project plan is discarded without
`executeCapabilityDispatch`, no project invocation or output occurs, and the
result explicitly grants no render eligibility. A fresh plan is mandatory for
any later render.

## M3-001 exact candidate render

D-037 authorizes only one installation-defined public-synthetic profile. User
data cannot select a support resolver, runtime module, fixture, schema,
capability registration, output path, or alternate template grammar. The static
host requires all fifteen invariant profile rows, the exact OS/Node 22-or-24
runtime row, and the public-automated evidence row to remain
`experimental/accept-with-warning`; the false global support switch is checked
and preserved. Unsupported Node majors and unknown platforms fail at
`/runtime` before assembly.

The source is opened once through the stable no-follow ingestion boundary. The
detached bytes and TemplateIndex therefore describe the same read, eliminating
the prior time-of-check/time-of-use split. The complete index is exact-compared
with a schema-validated, deeply frozen, installation-owned readable golden
adapted only to the preset's semantic IDs. The digest binds that graph to exact
bytes but is not accepted as a substitute for its relationships. Stored/fresh
index mismatch, source drift, identity drift, unsupported feature drift, and
candidate-profile drift all fail closed.

Layout cannot fall back to the old absolute-coordinate bridge. The product
derives `slide-content-tail`, exact-compares the complete resolved geometry with
DeckSpec, checks source paint occupancy, and records the resulting
`SlideLayoutIR`, `ComposedSlidePlan`, constraints, and exact package diff in the
CandidateBuildRecord. A fresh opaque one-shot plan is created for render; the
discarded validation plan cannot be replayed or copied.

The exact CLI authenticates native-card artifacts through a dedicated entry
point and delegates only the already-authenticated canonical candidate/record
pair to the generic ordered-pair writer. A recursive production import-graph test
rejects OMML, ordered-deck, clone/fill-helper, lab, test, or PowerPoint edges;
missing unrelated implementations therefore cannot break CLI startup.

Output stays below one canonical contained ProjectConfig root. macOS `/tmp` to
`/private/tmp` aliasing is normalized only after the existing directory-chain
and no-symlink containment checks; symbolic-link escape remains rejected.
Publication uses same-directory staging and create-only hard links. The record
is file-flushed and visible before the PPTX logical commit marker; POSIX also
requests parent-directory fsync barriers. Pre-marker failure removes only exact
owned output when possible and reports either not committed or rollback
incomplete. Post-marker failure retains the pair and reports commit uncertain;
it never claims ordinary failure while deleting potentially committed state.
No QaReport or BuildArtifact is created, so candidate success cannot be
confused with QA or delivery success.

## M3-001 blocked-QA boundary

D-038 does not trust the presence, filename, or self-consistency of an existing
candidate pair. QA reloads the current readable project authorities, repeats
the same one-shot semantic derivation used by render, reconstructs the expected
authenticated candidate and canonical record, and compares both actual files
byte-for-byte before replaying the record. A stale but internally consistent
pair therefore fails rather than receiving a blocked report.

The candidate commit marker is stable-read before the record, with the existing
no-final-symlink, contained-path, same-handle identity checks and authoritative
1 MiB/256 KiB limits. The portable parent-path race already recorded for Node
filesystem APIs remains; a detected read change fails, create-only normal use
does not replace the pair, and a blocked report grants no publication right.

The evaluator accepts no evidence path, screenshot, PowerPoint transcript,
BuildArtifact, checks array, or manual-gate array from the caller. Its three
pass checks and three unavailable checks are fixed code projections, validated
against the existing QaReport Schema and the two normative manual support rows.
Ignored local files cannot be discovered or used to upgrade the decision. Pair
absence, tampering, state drift, support-row drift, validator failure, output
conflict, or resource overflow creates no QA report.

## M3-003 guarded tarball and fixed-stage boundary

D-040 treats the bundled npm process as a constrained packer, not as evidence
authority. The admitted Node executable invokes its own npm CLI with offline
mode, lifecycle scripts disabled, invalid network registry, empty local/global
configuration, bounded output/time, and an owned cache/TMP below the one fixed
stage. The plan, forbidden-material policy, and `.gitignore` are stable-read
control inputs; their exact bytes and every mapped source byte/mode are retained
and rechecked through smoke and post-rename review.

The tgz inspector is deliberately not a general tar implementation. It admits
one canonical level-9 gzip member and one narrow npm ustar regular-file form.
It rejects optional/concatenated gzip members, alternate deflate bytes, hidden
gzip metadata, noncanonical member order, extra trailer blocks, links or special
entries, path aliases/traversal, unknown owner/link/prefix/name/time/device
metadata, malformed octal/checksum/padding, undeclared executables, and any
member outside the exact plan-plus-manifest set. Planned members are compared
directly with retained source bytes and modes, and the existing forbidden path,
extension, magic, and text policy is run over each member.

Inspection alone is insufficient because a same-principal process could replace
a pathname after inspection. The builder retains each accepted tgz byte buffer,
cross-checks npm's shasum/integrity report, rereads exact bytes after the offline
four-package install and immediately around reviewed-stage publication, then
verifies exact installed package files and the single CLI shim before executing
`init -> inspect -> validate project -> render -> qa` from an unrelated cwd.

The ignored stage has an atomic owner marker and hard-link process claim. A live
claim candidate rejects concurrent use before its body is read because another
live Worker may still be writing that create-only file. Only this exact module
instance's PID/instance candidate is parsed and cleared; a confirmed-dead
candidate may be removed without trusting its partial body, and concurrent
`ENOENT` means the same exact dead path was already cleared. Removing the
authenticated `.active.json` is the ownership-transfer point, so the old writer
does not inspect or classify successor candidates. `previous` is preserved
until the renamed `reviewed` tree
passes post-rename checks and receives its create-only completion marker. That
marker embeds the complete canonical evidence relation. Evidence/marker schema
v2 additionally binds the SHA-256 fingerprint of the canonical readable package
plan, so unchanged plan ID/version/package names/file shape cannot make pre-
repository tarballs current. Recovery rechecks the exact
marker/evidence/tarball inventory, names, sizes, and digests rather than trusting
a directory name or static plan ID. The fingerprint authenticates this boundary
only; it does not replace the readable plan. An interruption before the marker
restores the last complete review.

There are two deliberate fail-closed availability residuals. A new builder can
distinguish reuse of its own PID by process-start identity, but portable Node
APIs cannot query the start identity of a different live process. If an old
claim PID is reused by another still-live process, the stage is conservatively
reported active. The same can happen when a Worker dies while its host process
remains alive. A TTL is not used because it could steal a real writer after a
long build, machine sleep, or clock change.

Portable Node also provides no unlink compare-and-swap for a dead
`.active.json` pathname. Two same-principal crash-recovery attempts can
therefore race between authenticating a dead marker and removing that exact
path. The subsequent create-only `work` transition remains a second
single-writer failure boundary, but this local derived-evidence lock is not
claimed to be fully linearizable against a hostile same-principal pathname
replacer. Closing that residual would require a different lock broker or
platform primitive, not a TTL or another guessed file-name branch.

macOS FileProvider was first observed creating an empty conflict directory named
`reviewed 2`. A later local CI-shaped run also produced nonempty conflict copies
of completion/evidence files and a large tool-cache conflict directory while the
stage was live. The builder stopped and retained the whole stage. Under an
owner-verified stage or attempt, it may remove only an unknown direct child
directory proven strictly empty, using `rmdir` and a POSIX parent-directory
fsync request where supported. Unknown nonempty directories, files, and links
still fail closed or move only by rename into the persistent `failed` quarantine.
There is no recursive deletion primitive in the product stage. Completed and
interrupted reviewed trees are removable only when the canonical marker
authenticates each existing tgz/evidence member; the marker is deleted last so
an interrupted cleanup remains provable. An occupied quarantine is never
cleared to make room, and a nonempty unowned stage is never adopted or cleaned.
Exact typed inventories authorize removal of this attempt's materialized,
install, and smoke trees. npm cache/config/tmp persist as ignored,
non-authoritative tool state outside reviewed evidence and are not recursively
cleared. FileProvider may create another empty conflict directory later; that
observation does not widen deletion authority. Owned payload files are flushed
on every admitted platform; POSIX additionally requests containing-directory
fsync barriers. Node does not expose the directory barrier on Windows, so
M3-004B CI may prove logical recovery behavior but cannot prove sudden-power-loss
directory-entry persistence. These controls protect local derived
evidence; they do not turn ignored stage content into source authority or
release approval.

## M3-004 local public-workflow boundary

D-041 treats workflow YAML as a deployable derivative, not a trusted program
merely because GitHub can parse it. One dependency-free module owns the exact
two workflow byte strings and independently checks their actual directory
inventory, non-indirection, triggers, permissions, fixed runner labels, action
SHAs, package-script bodies, and command order. Unknown workflows, redirected
directories/files, floating actions/runners, write permissions, dangerous PR
events, secrets, caches, artifacts, network shell commands, publication, GUI,
PowerPoint, Pandoc, model, and private-fixture paths fail closed.

Pull-request code runs only in the ordinary `pull_request` CI job with read-only
contents. CodeQL has `security-events: write` only on push/schedule and uses
`build-mode: none`, so it does not build or execute the repository. Dependency
Review runs only on the ordinary PR event and receives no PR write permission.
Checkout does not persist credentials and setup-node caching is disabled.

The root development supply chain is closed at one exact TypeScript 6.0.2
package. Its lock entry, registry URL, integrity, Apache-2.0 license, bin map,
engine, and absence of lifecycle-script metadata are checked. The compiler is
dev-only. It does not enter the four-package plan or static-ESM SBOM projection. The typecheck
configuration and consumer must cover exactly the plan-derived public export
specifier set; a no-op script, missing specifier, or alternate declaration path
fails.

The package plan proves the static ESM dependency graph of the exact staged
`.mjs` sources by parsing their `import` and `export` specifiers. Rejection of
direct dynamic-import, CommonJS/module-loader, and code-generation forms is
reviewed-source hardening, not a JavaScript sandbox. Computed loader authority
is outside this proof. Public PR code therefore remains untrusted and receives
no secret, write credential, private fixture, PowerPoint host, or publication
authority even when the static graph passes.

Local M3-004A conformance proves only that the intended workflows and readable
metadata close under the local implementation. M3-004B requires the hosted
Linux/Windows/macOS × Node 22/24 runs after M3-006. No platform support,
security-scan success, release, or publication claim follows from local YAML.

## Candidate-alpha release boundary

The candidate-alpha release is a state transition over three independent
authorities rather than a shell command. The package plan owns the four public
manifests, dependency graph, registry, access, dist-tag, and provenance mode.
The release plan owns one exact annotated tag, two fixed builders, six readable
locked inputs, recovery states, and the requirement that GitHub Release be
last. The create-only tracked release lock binds the canonical release plan,
both complete reviewed-stage evidence objects, each builder's gzip length,
SHA-256, and SHA-512, plus the shared canonical tar-payload length and SHA-256.
Hashes authenticate those readable relations; they do not replace either plan
or prove external publication. Only the fixed Node 24/npm 11 gzip envelopes are
eligible release bytes.

The reviewed source commit `S` cannot authorize its own hosted merge identity.
Remote `main` must therefore be exactly one repository-local attestation commit
`A` ahead of `S`: `A` has `S` as its sole parent, changes only the tip-owned
forbidden-material policy, preserves every earlier grant, and adds exactly the
GitHub-verified OID of `S`. The complete reachable-history gate runs at `A`
with its fixed public identity anchor. Only after that gate passes may the exact
annotated tag point back to unchanged `S`. The release workflow checks the tag
object and target, the strict `S -> A` relation, the policy delta, current
public repository tuple, and the tag/main workflow results. It rereads mutable
remote facts before every absent-package write and after completion. A moved or
deleted tag, changed main, changed repository state, missing workflow result,
early public GitHub Release, replacement object, shallow history, or dirty tag
checkout fails closed.

Both fixed builders must independently produce the same admitted four canonical
tar payload byte strings before the lock exists. Their zlib versions may emit
different gzip envelopes, so both identities are recorded while only the fixed
builder owns the publishable envelopes. Lock generation reads every mapped
package source from the candidate tree, rebuilds the expected manifest/file
projection, and admits both stages' tar members, modes, and content bytes
against that projection; a self-consistent marker/evidence pair cannot mint a
different package. Builder runtime and smoke fields remain operator-produced
evidence, not a cryptographic runtime attestation. Preparation reads the tag
tree rather than trusting mutable working objects, verifies the tracked lock
and all six locked inputs, structurally revalidates the ignored reviewed stage,
and compares its real tarballs with the lock. The publisher then copies the retained buffers into one
owned mode-restricted temporary directory and compares them again immediately
before and after npm use. It never hands npm a mutable reviewed-stage pathname.

Registry recovery is prefix-shaped. Before the first write, all four exact
versions and their packuments are read. An existing version must match the
locked bytes, metadata, provenance, and allowed dist-tag state; an absent
version must have no conflicting `alpha` or `latest` tag. Existing packages may
form only the exact dependency prefix. Each absent member is reread immediately
before its write, published from the frozen buffer, reread from the official
registry, and added to the signature-audit prefix. A byte mismatch, later
member already present after an absent predecessor, foreign dist-tag, invalid
signature, or unexpected registry response stops without publishing another
member. An exact earlier prefix is resumable; `npm unpublish` is never a repair
operation, and `latest` is never created or moved by this alpha lane.

npm's signed SLSA statement is not trusted as self-description. The verifier
requires one exact subject and one exact resolved source dependency, the locked
package SHA-512 and source commit `S`, the exact repository/tag/workflow and
canonical invocation identifiers, a keyless Sigstore bundle, and a certificate
whose issuer is GitHub Actions and whose subject alternative name matches only
the exact alpha-release workflow at the exact tag. The fixed npm 11.17.0
runtime and its bundled Sigstore implementation are part of the admitted
verification boundary. Newly published packages bind the current invocation;
an exact resumable prefix may bind a prior canonical invocation after all other
identity checks pass.

Credentials are split by process and workflow step. The initial source-
admission process sees a read-only GitHub token and rejects an npm token. npm
publication sees only the environment-scoped bootstrap token plus OIDC inputs
and rejects GitHub tokens. The final declaration process receives one GitHub
contents-write token, uses it for its fresh source and Release checks plus the
sole permitted Release POST, and rejects npm/OIDC publication credentials.
The final public GitHub Release declaration runs only after a fresh complete registry,
provenance, signature, source, tag, and lock verification; it receives GitHub
write authority but no npm token or OIDC publication authority. It creates or
exactly reuses one non-draft prerelease with `make_latest` disabled and then
rereads the Release and all bound external facts. An early or mismatched
Release is not reconciled by deletion or overwrite.

These controls do not make npm or GitHub transactions atomic. A network or
service failure can leave an exact published prefix, which is why the recovery
model admits only byte-equal forward completion. Anonymous registry and public
GitHub responses can change between reads; bounded immediate rereads convert
detected drift into a hard stop but cannot provide a cross-service transaction.
A private GitHub draft created after the credentialed source check is not
observable to the credential-free npm process; it is not a public declaration,
but its existence makes the final declaration hard-stop rather than overwrite
or delete it. Within this controlled workflow, its only authorized non-draft/
public GitHub Release mutation occurs last; the blind window may instead leave
the authorized npm graph complete and the GitHub Release deliberately
incomplete.
Branch protection remains separately deferred, so the strict source rereads
and exact attestation relation are release prerequisites rather than inferred
repository settings.
