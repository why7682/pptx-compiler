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

Quantitative archive limits and residual risks are decided during M1-005 and
must be reflected in the public compatibility policy.
