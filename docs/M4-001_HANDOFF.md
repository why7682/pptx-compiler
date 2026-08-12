# M4-001 Handoff — Candidate-Alpha Release

## Status

M4-001 is active and split at observable boundaries:

- `M4-001A` is complete: the fail-closed non-publishing release contract and
  its current-byte provenance/review boundary are admitted;
- `M4-001B` is in progress: exact reviewed lock
  `d3b4818e9bcdb43f39df557847613d3e5ce0afa2f6fffda5af655217f2f5170a`
  is included in this tracked-admission change; merge as GitHub-verified commit
  `S`, the single-parent local attestation commit `A`, history gate at
  `main=A`, annotated tag `v0.1.0-alpha.1` on unchanged `S`, and clean-tag gates
  remain outstanding;
- `M4-001C` is pending: publish and reread four npm packages, verify provenance
  and dist-tags, then create the GitHub Release last.

D-048 records the user's explicit authorization for the exact tag and GitHub
Release, four public npm packages under dist-tag `alpha`, and GitHub Actions
plus npm provenance. Authorization is not evidence that an action occurred.
The exact reviewed release lock is now admitted by this change, but it has not
been merged as `S`; there is no attestation `A`, release tag, tag-hosted result,
npm publication, registry provenance result, or GitHub Release. The lock-bound
changelog, limitations, and release note are lifecycle-state neutral so their
bytes remain truthful before and after any authorized external transition.

D-047/M3-008 branch protection is separately deferred. No M4 state resumes it
or makes it a release prerequisite.

On 2026-08-13, the user confirmed the external bootstrap prerequisites: the npm
account email is verified, account 2FA is enabled, and GitHub environment
`npm-release` contains `NPM_TOKEN`. The repository records only this attestation,
never the token value. It is not an independent credential check and does not
prove that any package was published. The bootstrap token remains temporary:
after all four initial package identities exist, configure each exact npm Trusted
Publisher, revoke the token, and remove the GitHub secret.

## Fact ownership

| Fact | Owner |
| --- | --- |
| External-action authorization | D-048 in `docs/DECISIONS.md` |
| Package graph, public manifest, registry, access, dist-tag, provenance setting, derived dependency order | `packaging/alpha-package-plan.json` schema 3 |
| Exact tag, builders, lock inputs, recovery and completion rules | `packaging/alpha-release-plan.json` |
| Release phase order and eligibility | `docs/RELEASE_GATES.md` |
| Candidate source/artifact identity | Reviewed `packaging/releases/0.1.0-alpha.1.lock.json`; tracked admission is part of this change, while merge `S` and later phases remain outstanding |
| Current support state | `policy/support-matrix.json` |
| User-facing delta and limits | `CHANGELOG.md`, `docs/KNOWN_LIMITATIONS.md`, state-neutral release note |
| Eligibility and transition rules | `docs/RELEASE_GATES.md` |
| Actual npm/GitHub state | Official registry responses, npm provenance, GitHub tag and Release records |

The package plan owns publication settings and dependency edges exactly once;
the publisher derives `core -> native-card-arrow -> public-synthetic -> CLI`
from that graph. The release plan uses JSON pointers to publication settings
rather than copying them, while Release Gates owns the phase sequence. A
release lock is an exact-boundary record, not a second package plan and not a
support authority.

Release-plan schema 2 also closes the final declaration: exact title, locked
note source, deterministic lock/package identity projection, tag-target
binding, non-draft prerelease state, `make_latest=false`, disabled generated
notes, no assets, and create-or-exact idempotency. These fields project already
owned facts; they do not create a second release note or mutable state record.

## Release candidate and lock

The only candidate tag is the annotated `v0.1.0-alpha.1`, with exact message
`pptx-compiler 0.1.0-alpha.1`. Candidate admission
must prove that it peels to reviewed GitHub-verified lock-containing commit
`S` and its intended tree, while current remote `main=A` has `S` as its sole
parent; that the tagger is the already-approved public Git identity; that the tag
object has no extra header, signature block, control text, or unreviewed
message; and that the checkout is clean, full-history, and free of replace
refs, grafts, alternates, or a shallow boundary. A lightweight, moving,
mismatched, malformed, or dirty candidate fails closed.

The tag is an exact annotated identity binding to a GitHub-verified accepted-
main commit, not a cryptographically signed tag; no local signing key is
configured or claimed. Tag-triggered Public CI and CodeQL supply source-test
evidence. The artifact signature/provenance boundary is npm Sigstore provenance
from the admitted GitHub Actions publication.

The tracked lock path is
`packaging/releases/0.1.0-alpha.1.lock.json`. It was not generated during
M4-001A; it is independently reviewed and included in this M4-001B
tracked-admission change. Its closed fields are:

```text
schemaVersion
lockType
releaseVersion
releasePlanSha256
packagePlanSha256
packageSourceProjectionSha256
inputs[{ path, sha256 }]
builderResults[{
  nodeVersion, npmVersion, evidenceSha256, evidenceBytes,
  packages[{
    packageId, name, tarball, sha256, sha512, compressedBytes,
    tarSha256, tarBytes
  }]
}]
```

The two builder results are fixed and ordered:

1. Node 22.23.2 with npm 10.9.8;
2. Node 24.19.0 with npm 11.17.0.

`evidenceSha256` and `evidenceBytes` bind each builder's complete canonical
`package-evidence.json`; they are not summaries reconstructed by the lock
writer. `packageSourceProjectionSha256` binds the complete canonical package
projection used to admit both builders: package ID and every generated
manifest or mapped source's source/target path, role, admitted source mode,
package mode, byte length, and SHA-256. Candidate inspection rereads every
mapped blob and mode from the exact tag-target tree, rederives that projection,
and rejects any mismatch before admitting the tag. npm 10 and npm 11 may encode
the same canonical tar payload into different canonical gzip streams. For each
package ID, `tarSha256` and
`tarBytes` must therefore match across both builders, while each builder's own
gzip SHA-256, SHA-512, and compressed size remain separately recorded. Only
the fixed Node 24/npm 11 builder's gzip envelopes are release bytes; official-
registry equality remains byte-for-byte against those envelopes. A single
successful builder, different tar payloads, or an older M3 private tarball
cannot mint the release lock. The lock also binds the package plan, release
plan, support matrix, SBOM, changelog, limitations, and state-neutral release
note that readers will receive.

The ordering is mandatory: freeze the locked inputs, run both builders, write
the lock create-only, review and commit the lock, and merge it as the
GitHub-verified lock-containing commit `S`. Then append exactly one
repository-local public-identity attestation commit `A`: `A` must have `S` as
its sole parent and its tip-owned policy must grant exact OID `S`. Run the full
reachable-history gate at current `main=A`, and only then create the annotated
tag on unchanged `S`. The publisher must prove remote `main` is exactly `A`,
the tag target is exactly `S`, and GitHub comparison reports `ahead_by=1` and
`behind_by=0`; equality or a deeper descendant fails closed.
Creating the tag before committing the lock is an impossible state because the
tag checkout would not contain the authority it is required to verify.

## Hosted workflow boundary

Public CI and Security may run on the exact tag to collect the six
Ubuntu/macOS/Windows × Node 22/24 cells and CodeQL without publication
credentials. Their ordinary pull-request and main behavior remains
least-privilege and cannot publish.

The separate alpha-release workflow is manual-only. Its one input choice is
`v0.1.0-alpha.1`, and an admission job must match the event, tag ref type, ref
name, and input before the publish job exists. The publish job checks out exact
event `github.sha`, not a tag name that could be retargeted while queued, with
full history; the candidate checker then proves that the locally fetched exact
annotated `v0.1.0-alpha.1` still peels to `HEAD`. It uses GitHub-hosted Ubuntu
24.04, Node 24.19.0, environment `npm-release`, `contents: read`, and
`id-token: write`, then reruns the complete source/package gates and release
candidate check.

Before candidate preparation, the publisher's `verify-source` mode uses the
GitHub API without npm credentials and requires event `HEAD=S`, current remote
`main=A`, `S` as `A`'s sole parent, and `A`'s tip-owned policy to grant exact
OID `S`. The remote annotated-tag ref/object must equal the locally admitted
tag object and target, and `S`'s `verification.verified` value must be `true`.
Only `publish` mode in the final
publish step may see the first-release npm token. The first release uses that
narrow bootstrap because npm Trusted Publisher is configured against package
identities that do not exist before initial publication. After the package
identities exist, migrate the workflow to Trusted Publisher and remove the
token fallback. A separate `declare` job in the same manual workflow needs the
successful publish job, starts from a fresh immutable checkout, rebuilds the
reviewed stage, and receives only `contents: write`/`actions: read` plus the
job-scoped GitHub token—never the npm token or OIDC inputs. It performs a fresh
complete source, lock, registry-byte, provenance, dist-tag, and signature
verification before the first Release write.

## Publication and recovery state machine

Publication order is the dependency order:

```text
pptx-compiler-core
  -> pptx-compiler-native-card-arrow
  -> pptx-compiler-public-synthetic
  -> pptx-compiler
```

Before each step, query the official registry for the exact name/version:

- `absent`: publish only the retained lock-matching tarball, with public
  access, dist-tag `alpha`, and npm provenance;
- `present-equal`: download and exact-compare registry bytes, provenance, and
  metadata, then continue without republishing;
- `present-mismatch`: hard-stop. Never unpublish, overwrite, or continue under
  the same version.

The publisher never hands npm a mutable reviewed-stage path. It materializes
the already-frozen tarball bytes into its own private read-only temporary file,
verifies that file, publishes it, and removes only that owned temporary root.
After each package becomes present-equal, signature audit of the complete
published dependency prefix must pass before the next package is touched; a
final four-package audit still runs at completion.

After all four are present-equal, reread all four official-registry tarballs and
require exact lock bytes, valid npm provenance bound to the exact source
workflow/tag, `alpha` pointing to `0.1.0-alpha.1`, and no `latest` assignment.
Only that complete state permits the GitHub Release to be created. The GitHub
Release must bind the exact annotated tag, lock and package identities without
broadening the support matrix. Immediately after an authenticated 404 and
before POST, the declaration lane rechecks the exact tag/main source relation.
It creates only the closed non-draft prerelease, accepts an existing Release or
a 422 race only when a fresh authenticated read exactly equals the deterministic
request, and never patches or deletes a mismatch. Afterward it rereads source,
all four registry packages and signatures, and the exact Release, with the
Release read last.

## Current public evidence

M3-004B remains the implementation-baseline evidence on accepted PR head
`f6ba6bad48c928d31c356d47911dd929ccf3b2d1` and accepted main
`c4dee58a8920a8e71c20f53ab93c62a96d3cb89d`.

The later constructive-document pull request #2 preserves rather than rewrites
that history. PR head `093d527fc3fadf7cae577139b8d400719755dd52`
passed Public CI run `31608992503` and Security run `31608992491`; accepted
main `8cdf968b72f8dd5f41fee37a68e239e477dec44b` passed Public CI run
`31609285181` and Security run `31609285220`. Both commits share tree
`1d6d148a8bc347dc3cbc13dde3fd4314d86c421a`.

Those runs establish the accepted pre-M4 reader/document baseline. They are not
clean-tag, public-manifest, release-lock, npm provenance, registry-equality, or
GitHub Release evidence.

## M4-001A completion evidence

The exact 52-path pre-close snapshot was copied into two independent Git-backed
worktrees. Node 22.23.2/npm 10.9.8 and Node 24.19.0/npm 11.17.0 each pass
1322/1324 complete test nodes. The only two failures under each runtime are the
release-metadata baseline and file-alias baseline caused by the same 52
deliberately pending provenance records; no implementation or contract test
fails.

Both snapshots separately pass the guarded four-package build, exact package
admission, offline joint install, and installed-CLI
`init -> inspect -> validate -> render -> qa` smoke. QA remains `blocked` and
no `BuildArtifact` exists. Bounded independent review of the final
source-projection lock, publication state machine, workflow credentials, npm
provenance identity, and GitHub Release-last boundary reports 0 blocker, 0
high, and 0 medium. The subsequent completion-status/provenance-only delta is
covered by the focused document and canonical lightweight gates and does not
overlap package mappings or release-lock inputs.

This closes contract admission only. No release lock, annotated tag, npm
publication, registry provenance result, or GitHub Release was created.

## M4-001B tracked-lock checkpoint

The frozen lock-generation base is exact M4-001A commit
`b80761a62cff23cb90101605e09cc6e3c2924abd`, tree
`e4a4ca28fbfa3a83080142af63c9b08b36291ccc`. The fixed Node 22.23.2/npm
10.9.8 stage contributes evidence SHA-256
`f4e2da682b0870b1f26c07d3f522bf63ae2619708ec8b2230554f0a1be49e360`
over 14409 bytes; the fixed Node 24.19.0/npm 11.17.0 stage contributes
`524b6a43da205d65347c48740792aba25b560ebc2fd340ceb407898829e3c795`
over 14410 bytes. Both bind the same canonical tar payload for each of the four
packages.

Create-only generation produced canonical lock SHA-256
`d3b4818e9bcdb43f39df557847613d3e5ce0afa2f6fffda5af655217f2f5170a`
(Git blob `61d6df477769d3ebd5cd3ab3607fb977fc21ab5b`, 6218 bytes) and package-source
projection
`962defc231e784627c142f01df84669b08d9a7b3f1bae39da2ea1f2728d95312`.
The projection covers 89 exact Git sources and 96 package members, including
modes and byte lengths. The lock records both builder-local evidence records
and gzip envelopes; only the fixed Node 24/npm 11 entries may become release
bytes.

One bounded independent exact-lock review recomputed the six inputs, source
projection, both reviewed stages, four tar payloads, fixed-builder admission,
dependency order, and forbidden-material result. It reports 0 blocker, 0 high,
and 0 medium with Taste=good. The exact lock and its state/provenance projection
are admitted in this nine-path tracked change. M4-001B remains in progress:
this change has not been merged as `S`, and no `A`, tag, hosted tag result, npm
publication, registry equality/provenance result, or GitHub Release exists.

## Next actions

1. Commit and merge this exact reviewed tracked lock as verified `S` without
   changing the lock or its inputs.
2. Append the single-parent local-identity history-attestation `A` with sole parent
   `S` and an exact grant for `S`; run the reachable-history gate at `main=A`;
   then create the annotated tag on unchanged `S` and pass the clean-tag,
   tag-hosted, and release-candidate gates.
3. Only after the lock and tag-hosted gates pass, run M4-001C's ordered npm
   state machine and official-registry reread.
4. Create the GitHub Release last. Then configure all four exact npm Trusted
   Publisher bindings, revoke the bootstrap token, and delete GitHub
   `NPM_TOKEN`; M4-001C remains incomplete until those non-secret configuration
   facts are recorded. Do not rewrite the lock-bound changelog, limitations, or
   release note merely to add a lifecycle label.
5. Keep every support row and D-047/M3-008 unchanged unless separately reviewed
   and authorized.
