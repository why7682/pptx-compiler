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
