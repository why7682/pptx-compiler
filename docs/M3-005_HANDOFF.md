# M3-005 Handoff — Minimum Public Documents

## Status

M3-005 is split at the real evidence boundary:

- `M3-005A` owns the minimum pre-public reproducibility, vulnerability-
  reporting, contribution, and governance documents.
- `M3-005B` owns the changelog, known limitations, and final support/release
  wording after M3-004B supplies public hosted evidence. D-046 requires that
  final reader-facing text construct one coherent system model rather than
  concatenate TODO fragments or repair chronology.

M3-005A is complete. The local document contract defines one private reporting
process plus the minimum contribution, governance, and reproducibility
boundaries. M3-006 has since completed the exact first public source ref.
M3-004B is also complete. Pull-request head
`f6ba6bad48c928d31c356d47911dd929ccf3b2d1` and accepted main
`c4dee58a8920a8e71c20f53ab93c62a96d3cb89d` share tree
`4e70ec4323807824b0578241fe4a4d94951cd608`. PR CI run `31600528716` and
main CI run `31600806512` passed all six hosted cells; PR security run
`31600528742` passed Dependency Review while CodeQL was skipped by event design,
and main security run `31600806350` passed CodeQL while Dependency Review
was skipped by event design. M3-005B is complete: the final reader-facing text
constructs the D-046 model, its cross-document and package-document cold review
closed at 0 blocker / 0 high / 0 medium, and content-frozen commit
`ad7c5007823fc28dca838db4ed2d0e9d2703e7ab` passed 1247/1247 complete tests
under each admitted runtime and the guarded four-package build, admission,
offline joint install, and installed-CLI smoke under both runtime/npm pairs.
This does not enable support claims or authorize release.

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

For M3-005B, content-frozen commit
`ad7c5007823fc28dca838db4ed2d0e9d2703e7ab` (tree
`5dc99284a2be71e110ee4c64099abbd16c4d4e20`) passes 1247/1247 complete tests
under Node 22.23.2/npm 10.9.8 and Node 24.19.0/npm 11.17.0. Both runtime/npm
pairs also pass canonical four-package admission, guarded build, offline joint
install, installed CLI smoke, expected blocked QA, and the no-BuildArtifact
boundary. The focused constructive-document/package-plan suite passes 82/82,
and bounded current-byte cold review closes at 0 blocker, 0 high, and 0 medium.
The subsequent completion-status/provenance-only delta is covered by focused
and lightweight gates rather than being misrepresented as the same content
tree.

## Next actions

1. Retain M3-005A as complete.
2. Retain the exact M3-006 repository identity, PVR state, first-ref OID, and
   remote-main equality evidence.
3. Retain M3-004B as complete without converting its hosted results into
   support or release claims.
4. Retain M3-005B as complete in D-046 order: purpose and boundary; fact
   ownership; data/control flow; executable contracts; evidence; limitations;
   next authorized action.
5. Prepare M4-001 evidence without creating a tag or publishing npm until the
   user separately authorizes that external release action.
6. Keep D-047 branch protection deferred. M3-005B completion does not resume it
   by implication.
