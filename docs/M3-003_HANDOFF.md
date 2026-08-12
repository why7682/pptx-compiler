# M3-003 Handoff — Guarded Tarball and Fixed Stage

## Core judgment

The real failure was not whether `npm pack` could emit four archives. It was
whether the bytes admitted for review were exactly the planned public bytes,
remained stable through installation, and could survive interruption without
mistaking a directory name or marker for completed evidence.

M3-003 closes that local implementation boundary. It does not publish a
package, select a Git hosting account, prove three-platform compatibility, or
enable any support claim.

## One readable authority chain

- `packaging/alpha-package-plan.json` owns the four package profiles and exact
  source-to-target mappings.
- The plan bytes, `policy/forbidden-materials.json`, `.gitignore`, and every
  mapped source byte plus mode are stable-read once and retained as the build
  control snapshot.
- Runtime-source validation consumes those retained source snapshots; it does
  not reopen a second semantic authority before materialization.
- Leaf `package.json` bytes are derived canonically from package-plan schema v2.
  D-045 adds the verified GitHub repository projection while every leaf remains
  `private: true` and has no `publishConfig` or lifecycle script; source-ref
  authorization does not imply npm-publication authorization.
- npm is a constrained packer, not an acceptance oracle. The admitted Node
  executable invokes its bundled npm CLI offline with lifecycle scripts,
  ambient npm configuration, audit/fund, lockfile writes, and network access
  disabled.
- `scripts/lib/package-tarball.mjs` independently decides whether each tgz is
  the exact canonical projection of the retained plan, source, and manifest.

No member-hash graph, binary-derived planning model, or second package manifest
authority was added. SHA-256 appears only in ignored evidence to bind each
final reviewed tgz byte object.

## Tarball admission

The parser intentionally accepts one narrow npm 10/11 output form rather than
implementing a general tar reader:

- one canonical level-9 gzip member with no optional, concatenated, trailing,
  or alternate encoded data;
- canonical npm ustar regular files in exact packlist order and exactly two
  trailer blocks;
- exact field grammar, checksum, fixed npm mtime, ownership, device, padding,
  type, mode, path, and executable declarations;
- exactly the plan targets plus the generated `package.json`, with direct
  byte/mode equality to the retained inputs;
- no path alias, traversal, link, special entry, undeclared executable, hidden
  metadata channel, forbidden extension, forbidden magic, or forbidden text.

Each tgz is limited to 5 MiB compressed and 20 MiB unpacked, 300 members
including the generated manifest, and 1 MiB per member. npm's reported file
list, sizes, shasum, and integrity are cross-checks only.

## Installation evidence

All four accepted tgz buffers are persisted and installed together into one
empty owned directory. The installer uses the same admitted Node/npm pair,
offline mode, stage-local cache and configuration, and disabled scripts.

The gate then checks exact installed package inventories, bytes, modes, and the
complete platform-specific `.bin` inventory. From a working directory outside
the source workspace and without workspace aliases, the installed CLI executes:

```text
init -> inspect -> validate project -> render -> qa
```

The smoke project has an exact ten-file inventory. QA ends with
`decision: blocked`, and no `BuildArtifact` exists. This proves only the current
candidate-alpha package spine with repository-owned synthetic inputs.

## Fixed-stage transaction

There is one ignored `.package-stage/`, not a stream of temporary package
roots. An atomic owner record and hard-link process claim establish single
writer ownership. The claim binds PID, process start identity, and a per-module
instance ID so concurrent Workers in one process cannot release each other's
claim. A foreign candidate whose PID is still live is classified as active
before its not-yet-stable body is read; only a candidate carrying this module
instance's exact PID/instance capability is parsed and cleared. A live claim
fails closed and has no unsafe time-to-live override. Removing `.active.json`
is the release point, so the releasing writer does not inspect a successor's
candidate after ownership has transferred.

Publication uses `work`, `reviewed`, `previous`, and `failed` as a small
transaction:

1. build and verify the complete payload in `work`;
2. preserve the last complete `reviewed` as `previous`;
3. rename `work` to `reviewed` and repeat control, source, tgz, and evidence
   checks;
4. write and sync a create-only completion marker containing the complete
   canonical evidence relation;
5. revalidate completion, then remove `previous`.

Owned payload files are flushed before the marker on every admitted platform.
POSIX additionally requests containing-directory fsync barriers. Node does not
expose the same directory barrier on Windows, so sudden-power-loss directory
entry persistence there remains unproved even after M3-004B cross-platform CI.
Recovery never treats a
static directory name or plan ID as proof:
the marker, evidence object, exact reviewed inventory, tgz names, sizes, and
digests must agree before a candidate is complete.

The authenticated retained reviewed inventory is deliberately small:

```text
.complete.json
package-evidence.json
tarballs/<exact four tgz files>
```

Materialized package trees, installations, and smoke projects are removed only
through exact typed inventories before publication. npm cache, configuration,
and temporary compiler state persist below `.package-stage/npm/` as ignored,
non-authoritative tool state; they never enter `reviewed`, release evidence, or
the package bytes, and the recovery path never recursively clears them.

## Recovery and residuals

- A claim whose encoded PID is confirmed dead can be removed even when a crash
  left a partial claim body. Concurrent removal of that exact dead path treats
  `ENOENT` as already cleaned; every other removal error still fails closed.
  Stale work is then quarantined and rebuilt.
- A directory name is never deletion authority. A complete marker embeds the
  evidence needed to classify a review as complete or authenticated-partial;
  only exact verified tgz/evidence members are unlinked, the marker is removed
  last, and directories are closed with `rmdir`. On POSIX, each earlier
  unlink/rmdir is followed by a containing-directory fsync request before the
  marker can be removed. Windows preserves the same marker-last logical order
  but claims no sudden-power-loss persistence for those directory entries.
  There is no recursive deletion primitive in the product stage implementation.
- `failed` is a rename-only quarantine. Its contents persist across successful
  rebuilds. If another stale or foreign attempt needs the occupied slot, the
  build fails closed and leaves both trees for exact operator reconciliation.
- An owner-candidate file is not touched until the owner record has been
  verified and the current process holds the stage claim. A nonempty stage
  without a valid owner is never adopted or cleaned.
- If an old PID has been reused by a different still-live process, portable
  Node APIs cannot prove that foreign process's start identity. The gate
  conservatively reports the stage active. This is a fail-closed availability
  residual; do not add a TTL that could steal a real long-running build.
- If a Worker dies while its host PID remains alive, the same conservative
  availability residual applies until the host exits or an operator verifies
  and clears the exact claim.
- macOS FileProvider was observed creating an empty conflict directory named
  `reviewed 2`. Under an owner-verified stage or attempt, only unknown direct
  child directories proven strictly empty are removed with a POSIX parent-
  directory fsync request where supported. Unknown nonempty directories, files,
  and links still fail closed or
  are preserved by a rename-only quarantine. FileProvider may create another
  empty conflict directory later; that does not widen deletion authority.

## D-040 closure evidence — 2026-08-11

At the original D-040/M3-003 checkpoint, the local run used Node.js 22.23.2
with its npm 10.9.8 CLI:

- focused package-stage tests: 22/22;
- complete strict repository suite: 1129/1129;
- actual `build:alpha-packages`: four tgz files admitted, installed together,
  and exercised through blocked QA;
- package-plan, forbidden-material, exact-provenance, support-matrix,
  versioned-contract, and diff gates pass;
- bounded closing review reports no remaining blocker or high finding.

The tgz digest values stay in ignored `package-evidence.json`; this document
does not turn them into source or planning facts.

## Next dependency

M3-004A has since defined the local public workflow contract; see
`docs/M3-004_HANDOFF.md`. Its hosted evidence remains M3-004B, blocked until
M3-006. M3-005A now completes the pre-public document contract and M3-005B
waits for hosted evidence. M3-006 has created the user-selected repository as an
empty public shell, verified private vulnerability reporting, and inserted its
canonical identity into the plan, leaf manifests, and SBOM. Evidence/marker
schema v2 binds the canonical plan fingerprint. The repository-bound rerun now
passes: Node 22.23.2 and Node 24.19.0 each pass 1217/1217 complete tests, the
24-node package-stage suite passes, and npm 10.9.8/11.17.0 each pass the real
four-tarball offline install and installed CLI smoke. No source ref exists yet.
