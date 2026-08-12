# M3-005 Handoff — Minimum Public Documents

## Status

M3-005 is split at the real evidence boundary:

- `M3-005A` owns the minimum pre-public reproducibility, vulnerability-
  reporting, contribution, and governance documents.
- `M3-005B` owns the changelog, known limitations, and final support/release
  wording after M3-004B supplies public hosted evidence.

M3-005A is complete. The local document contract defines one private reporting
process plus the minimum contribution, governance, and reproducibility
boundaries. D-045 has since created the empty public shell, enabled private
vulnerability reporting, and verified exact `enabled: true`; M3-006 still owns
the final local history and first source ref after completing the repository-
bound dual-runtime rebuild.

## Responsibility boundary

- `SECURITY.md` is the only vulnerability-reporting process owner.
- `CONTRIBUTING.md` is the only contribution-process and MIT inbound owner.
- `GOVERNANCE.md` is the only human decision-authority owner.
- `docs/REPRODUCIBILITY.md` is the human reproduction guide; package scripts and
  the canonical public workflow remain the machine command authority.
- `policy/support-matrix.json` remains the support-claim authority, and
  `docs/RELEASE_GATES.md` remains the release-condition authority.

No public email address, CLA, DCO, committee, quorum, fixed response SLA, second
support document, or final changelog is introduced without a demonstrated
need.

## Definition versus activation

`SECURITY.md` selects GitHub private vulnerability reporting as the first
alpha's sole private channel. The document itself did not activate that
setting. D-045 later executed the first five transitions in this fail-closed
order:

1. complete a fresh local preflight and select the GitHub owner/repository;
2. create an empty public repository without README, license, ignore template,
   initial commit, or imported history;
3. enable private vulnerability reporting through the repository REST API;
4. query the status endpoint and require the exact positive `enabled: true`
   result;
5. create no source branch/ref if creation, enablement, or verification fails;
6. after the positive status, retain GitHub's canonical repository identity,
   bind it into the package plan, leaf manifests, and static-ESM SBOM, then
   rerun the complete M3-003 package gate and local preflight; and
7. only after that repository-bound evidence passes, add the reviewed remote
   and create the first source ref.

Steps 1–5 and the repository-binding half of step 6 are complete for public
repository ID `1330979133`, with no source ref created. The dual-runtime rerun
half of step 6 now also passes; step 7 remains forbidden until the final local
commit and history review close.

The public shell may exist without code while a failed activation is retried.
It is not a release or source publication. This sequence removes the need to
repurpose the Git author email and keeps channel state with its real owner: the
GitHub repository setting.

The forbidden-material compiler now permits `exceptPaths` only on path rules.
Text and copyright rules cannot express an exception, including an empty one;
`SECURITY.md` therefore passes the same secret, private-material, email, local-
path, and identity rules as every other text file.

## Evidence boundary

M3-005A itself proves only that the documents are complete, linked, internally
consistent, and mechanically checked against the canonical workflow and
leakage policy. D-045 separately proves the empty public repository and active
private-reporting setting. Neither milestone proves hosted platform runs,
CodeQL or Dependency Review results, a source ref, package publication,
signing, registry provenance, support, or release equality.

The fixed non-FileProvider verification copy passes 1198/1198 complete tests
under both Node 22.23.2/npm 10.9.8 and Node 24.19.0/npm 11.17.0. Both runtimes
also pass the 124-file source gate and the real guarded four-tarball build,
offline joint install, installed CLI spine, expected blocked QA, and no-
BuildArtifact check. The focused content-policy and document suites pass 41/41
and 14/14 respectively. The bounded final security, provenance, and state
reviews report 0 blocker, 0 high, and 0 medium findings.

## Next actions

1. Retain M3-005A as complete; its final bounded review closed at zero blocker,
   high, and medium findings.
2. Retain the exact D-045 repository identity and positive PVR state; do not
   recreate, adopt, or reinterpret another shell.
3. Retain the completed repository-bound package/preflight evidence, create and
   history-scan the reviewed local commit, then reverify the same live GitHub
   facts before the exact-object-ID first push.
4. Keep M3-004B hosted evidence and M3-005B final claim text separate.
