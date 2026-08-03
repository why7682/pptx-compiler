# Initial Threat Model

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

## M1-005 implemented input boundary

The secure-ingestion lane never extracts a member. It reads at most a 1 MiB
stable source snapshot and admits at most 32 contiguous stored/DEFLATE entries,
256 KiB compressed/expanded per entry, 1 MiB declared expanded total, a 100:1
ratio, and a 128 KiB central directory. It rejects ZIP64, encryption, data
descriptors, extras/comments, multi-disk archives, prefixes/trailing bytes,
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
