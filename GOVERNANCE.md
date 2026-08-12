# Governance

## Current model

The project uses a single-maintainer model during pre-alpha. The copyright
holder named in [LICENSE](LICENSE) is the current maintainer and has final
merge, release, security-policy, scope, and governance authority.

Executable release gates and support contracts cannot be overridden by a
label, vote, review count, candidate hash, or maintainer assertion.

## Roles

Contributors may propose issues, documentation, tests, and code. Contribution
does not automatically grant merge, release, embargoed-security, or support-
promotion authority.

Additional maintainers must be appointed through an explicit reviewed change
to this document and the repository's access controls. No quorum or committee
is implied by the current model.

## Decisions

Routine implementation decisions are made in the relevant issue or pull
request. Changes to product scope, public contracts, dependency direction,
license, support status, release authority, or governance must also be recorded
in [docs/DECISIONS.md](docs/DECISIONS.md) and in every affected executable
contract.

Consensus is preferred, but the maintainer makes the final decision and records
the technical rationale.

## Security and releases

Embargoed vulnerability information follows [SECURITY.md](SECURITY.md).
Releases must satisfy [docs/RELEASE_GATES.md](docs/RELEASE_GATES.md), while
support changes must satisfy the machine-readable policy summarized in
[docs/SUPPORT_MATRIX.md](docs/SUPPORT_MATRIX.md). Governance authority does not
substitute for missing evidence.

## Changing governance

Governance changes require an explicit pull request and maintainer approval.
They do not grant retroactive authority over earlier security reports or
releases. This pre-alpha model promises no fixed review, response, or release
schedule.
