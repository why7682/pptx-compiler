# M3-006 Handoff — First Public Ref

## Status

M3-006 is active. GitHub now reports `why7682/pptx-compiler` as a public empty
repository with numeric ID `1330979133`; the empty-repository refs endpoint
returns HTTP 409, no local remote has been added, and no source ref exists.
Private vulnerability reporting was enabled with HTTP 204 and subsequently
verified by GET as exact `enabled: true`. D-044 and its dual-runtime evidence
are closed. D-045 now implements the repository tuple, manifest/SBOM
projection, separate npm-private guard, and readable-plan evidence binding.
The repository-bound snapshot now passes the final dual-runtime/package gates.
The active boundary is the reviewed local commit and final history scan; source
publication remains forbidden until that exact object is rechecked and pushed
by exact object ID.

## Core judgment

The real risk is not the current working tree. A first push of `main` exposes
every reachable ancestor commit, old blob version, commit message, author, and
committer. Index and working-tree scans cannot see a forbidden file that was
committed and later deleted.

The smallest complete fix is a third mode on the existing scanner:

```sh
node scripts/check-forbidden-materials.mjs --mode history
```

It does not create a second policy or history manifest. It fixes
`refs/heads/main` as the candidate ref, reads the forbidden-material policy from
that ref's tip, then follows the raw commit object's own parent/tree OIDs rather
than mutable shallow or graft reachability. Every admitted tree entry and
message is scanned, and every author and committer must equal the one
repository-local public Git identity. Identity values and noncanonical path
bytes never appear in the report. The scan is bounded to 64 commits, 4096
unique tree-entry versions, 64 MiB aggregate regular-blob data, and the existing
per-file limit. Ambient repository/object/config selectors, indirect Git/common
directories, shallow history, replace refs, grafts, alternates, unsupported
commit or tree grammar, symlinks, submodules, oversized blobs, identity drift,
or a moving `main` ref fail closed.

The gate intentionally ignores dangling objects, reflogs, and unrelated local
refs because the launch uses one exact object-ID-to-`refs/heads/main` refspec.
They are not reachable from, and are not transferred by, that push.

## Current local evidence

The current `main` history is non-shallow and has one ref, 13 commits, 286
unique leaf-entry versions, 3,677,606 scanned regular-blob bytes, and 26 exact
author/committer occurrences. The history gate reports zero findings. A broader
read-only audit also found no tag, note, stash, replace ref, remote, merge,
alternate, graft, credential/token pattern, private path, or private-fixture
hash; `git fsck --strict` passes.

The focused policy suite passes 49/49. Its eight history tests prove stable
positive output plus rejection of a deleted forbidden path under tip-policy
authority, repository/common-directory and case-variant environment redirects,
noncanonical BOM/control paths and byte-level modes, local/global fsck warning
downgrades, a forbidden commit message without diagnostic disclosure, identity
drift, a deleted symlink, and a deleted oversized blob. Bounded independent
closing reviews reproduced the strongest environment, shallow-history,
multi-parent, raw-tree, fsck-configuration, and redaction probes and report
0 blocker, 0 high, and 0 medium.

These observations apply only to the current pre-source-ref tip. The final
repository-bound commit does not yet exist and must be scanned again.

The D-044 identity migration was first verified in the fixed non-FileProvider
copy: Node 22.23.2 and Node 24.19.0 each pass 1206/1206 tests, and npm 10.9.8
and 11.17.0 each build, admit, jointly install, and smoke the four renamed
`pptx-compiler*` tarballs. The former complete reviewed set was authenticated
and moved intact within the fixed verification root before reuse of the same
`.package-stage/`. That 1206-node result is the D-044 pre-binding checkpoint,
not the current repository-bound evidence. Two bounded D-044 current-byte
closing reviews report 0 blocker, 0 high, and 0 medium, so the local rename/
provenance boundary closed without creating a remote.

The current repository-bound snapshot passes 1217/1217 complete tests under
both Node 22.23.2 and Node 24.19.0. The package-stage suite passes 24/24 under
each runtime. npm 10.9.8 and npm 11.17.0 each build and
independently admit the four
npm-private repository-bound tarballs, install them together offline, execute
the installed `init -> inspect -> validate project -> render -> qa` spine from
an unrelated working directory, return blocked QA, and create no BuildArtifact.
The final retained reviewed set records Node 24/npm 11 evidence and exact
boundary fingerprints in the ignored fixed stage; those hashes are not copied
into planning documents.

## Fail-closed launch state machine

D-045 completed the one-time prefix: it verified the approved owner/identity,
created exactly one empty public repository, enabled PVR, required PUT 204 and
subsequent GET `enabled: true`, and retained GitHub's canonical tuple. Those
creation transitions are historical facts, not commands to replay.

The repository binding and dual-runtime/package portions of steps 1–2 are now
complete. The current resumable state machine is:

1. Re-read repository ID `1330979133`, exact owner/name/HTML URL, public
   visibility, empty refs, PVR `enabled: true`, authenticated account, and the
   approved repository-local Git identity. Any mismatch stops the transition.
2. Retain the completed package-plan schema v2 tuple, manifest/SBOM projections,
   executable npm-private guard, M3-003 package gate, and full Node 22/24 local
   preflight evidence. Any later packed-source change invalidates this step and
   requires the package builds to run again.
3. Create the reviewed repository-bound commit on local `main`. Re-run the
   history gate and retain its exact tip object ID. Recheck the branch and
   working tree before any transport is configured.
4. Immediately before push, query GitHub again and require the same numeric ID,
   owner, name, canonical URL, public visibility, empty ref set, and positive
   PVR state.
5. Add only one canonical HTTPS remote. Require
   `git remote get-url --push --all <remote>` to resolve to exactly one
   `https://github.com/why7682/pptx-compiler.git`; reject any `pushurl`, extra
   URL, SSH form, credential-bearing URL, or URL rewrite to another endpoint.
6. Push exactly the scanned object ID to `refs/heads/main`. Never use `--all`,
   `--tags`, `--mirror`, `--force`, a wildcard refspec, or a pull/merge as
   reconciliation.
7. If push completion is ambiguous, read `refs/heads/main`: the expected object
   ID means success, an absent ref permits one exact retry, and any different
   object ID is a hard stop. Finally re-read the same repository/PVR tuple and
   require remote `main` to equal the scanned object ID.

No state before step 6 publishes source. No local label, candidate hash, or
successful package build substitutes for the GitHub-owned remote facts.

## External authorization state

D-044 records the exact target and the user's authorization to use the already
approved public Git identity. D-045 used that authority only for the empty
public shell and PVR activation; it did not create a local remote or source ref
and did not authorize npm publication. The remaining gates above are mandatory
before the first exact-object-ID push.
