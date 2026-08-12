# M3-005 Handoff — Minimum Public Documents

## Status

M3-005 is split at the real evidence boundary:

- `M3-005A` owns the minimum pre-public reproducibility, vulnerability-
  reporting, contribution, and governance documents.
- `M3-005B` owns the changelog, known limitations, and final support/release
  wording after M3-004B supplies public hosted evidence.

M3-005A is complete. The local document contract defines one private reporting
process plus the minimum contribution, governance, and reproducibility
boundaries. M3-006 has since completed the exact first public source ref.
M3-005B remains blocked because M3-004B has only partial hosted evidence: both
Windows cells failed and Dependency Review has not yet run.

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

Steps 1–7 are complete for the exact first source ref at public repository ID
`1330979133`. This completion does not authorize npm publication or satisfy
M3-004B/M3-005B.

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
leakage policy. D-045 separately proved the empty public repository and active
private-reporting setting; M3-006 later proved the exact first source ref. None
of these milestones proves npm publication, complete hosted platform evidence,
signing, registry provenance, support, or release equality.

The fixed non-FileProvider verification copy passes 1198/1198 complete tests
under both Node 22.23.2/npm 10.9.8 and Node 24.19.0/npm 11.17.0. Both runtimes
also pass the 124-file source gate and the real guarded four-tarball build,
offline joint install, installed CLI spine, expected blocked QA, and no-
BuildArtifact check. The focused content-policy and document suites pass 41/41
and 14/14 respectively. The bounded final security, provenance, and state
reviews report 0 blocker, 0 high, and 0 medium findings.

## Next actions

1. Retain M3-005A as complete.
2. Retain the exact M3-006 repository identity, PVR state, first-ref OID, and
   remote-main equality evidence.
3. Complete M3-004B without converting partial hosted results into support or
   release claims.
4. Freeze M3-005B text only after M3-004B closes.
