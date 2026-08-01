# Open-Source Readiness Assessment

## Verdict

Publication is feasible, but the predecessor is a research-grade, project-bound
system rather than a releasable general package. The correct strategy is a
clean-room extraction into this empty-history repository, not a rename or bulk
copy. The current readiness level is `foundation-security / pre-alpha`:
admission, support-claim, data-contract, explicit-context, semantic-inspection,
and bounded secure-ingestion gates are executable, while PPTX product
capabilities are not.

## Reusable foundations observed in the predecessor

- deterministic OOXML assembly and relationship checks;
- schema, capacity, geometry, semantic-diff, and source-isolation experiments;
- template inspection and capability-overlay concepts;
- source-slide clone/fill and native DrawingML prototypes;
- optional LaTeX-to-OMML transplantation;
- structured automatic and manual gate evidence;
- bounded-task/token-control experiments.

These are candidate ideas and test requirements. They are not automatically
redistributable code and do not establish generic support.

## P0 blockers found

1. **Distribution boundary:** a package dry-run produced a 1,440,242,285-byte
   tarball and 1,751,118,178 unpacked bytes, including worktree and generated
   data. A positive package allowlist and binary-magic leak gate are mandatory.
2. **Rights:** MIT is selected and executable exact per-file provenance is in
   place, but no predecessor code or template has been admitted for
   redistribution.
3. **Self-containment:** parts of inspection and rendering depend on managed or
   private helpers, fixed project roots, and project-specific identifiers.
4. **Capability truth:** registry metadata can claim support without a generic
   dispatchable executor. Structural onboarding has not proved generic render.
5. **Untrusted input compatibility:** M1-005 provides fixed resource and
   high-risk rejection controls for the public minimal grammar, but it does not
   establish arbitrary external PPTX/POTX compatibility or fully atomic
   hostile-directory containment on every Node platform.
6. **Public fixture breadth:** the rights-owned synthetic fixture and mutation
   suite now exist, but additional positive compatibility classes require
   separate evidence and cannot be inferred from the minimal fixture.
7. **Package surface:** the compatibility/versioning policy now exists, but
   there is no public CLI/API implementation, package allowlist, or clean-install
   smoke test.
8. **Community/security:** contribution, governance, vulnerability reporting,
   CI hardening, dependency/licensing audit, SBOM, and release provenance remain
   to be created.

## Legal and dependency boundary

This assessment is technical, not legal advice. New clean-room project work is
licensed under MIT. Before admitting or releasing any code, fixture, design,
font, or example from another source, confirm its rights and record per-file
provenance. Pandoc is GPL-licensed and should remain a user-installed optional
process rather than bundled code; its integration and generated-output
obligations require a documented rights review. Never ship a font file without
explicit redistribution rights.

OOXML behavior should be specified against the published ECMA-376 standard:
<https://ecma-international.org/publications-and-standards/standards/ecma-376/>.
Pandoc's upstream licensing and source are documented at
<https://github.com/jgm/pandoc>.

## Recommended milestones

1. **Bootstrap:** executable provenance/exclusion controls, compatibility
   policy, and the synthetic fixture are complete.
2. **Foundation:** explicit context/schemas, semantic inspector, and the bounded
   secure archive/XML layer are complete; publishable package metadata remains
   later work.
3. **Vertical slice:** capability dispatcher, clone/fill, one native component,
   assembly, QA, optional OMML adapter.
4. **Product surface:** CLI/API, package split, docs, compatibility matrix,
   clean-install examples.
5. **Release engineering:** cross-platform CI, leak gate, security checks, SBOM,
   signed/provenance release.
6. **Evidence expansion:** alpha feedback, additional redacted compatibility
   probes, then beta/1.0 promises.

For one experienced engineer, a credible narrow alpha is plausibly three to
five focused weeks if secure package handling and clean-room reimplementation do
not uncover a larger OOXML rewrite. This is an estimate, not a schedule promise.
