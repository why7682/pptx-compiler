# Decision Register

No item below is decided merely because a recommendation is recorded.

| ID | Status | Decision | Current recommendation | Required evidence |
| --- | --- | --- | --- | --- |
| D-001 | ACCEPTED | Working public project and package stem | Use `pptx-pipeline`; recheck immediately before public registration. | Official npm registry returned E404 and exact-name public searches found no project on 2026-07-30; this does not reserve the name or constitute trademark clearance. |
| D-002 | ACCEPTED | License | Use the MIT License. | User selected MIT after reviewing the Apache-2.0 trade-off; official MIT text is present in `LICENSE`. |
| D-003 | ACCEPTED | Public Git author identity | Use the user-approved repository-local identity; do not duplicate its personal fields in tracked planning files. | Local `git config` verification completed. |
| D-004 | ACCEPTED | Repository shape | Use a private-root npm monorepo with separately publishable core, CLI, and optional adapters. | User decision recorded; dependency-direction tests remain required. |
| D-005 | OPEN | Runtime support | Begin with actively supported Node LTS releases on Linux, Windows, and macOS; document exact versions at implementation time. | CI matrix and dependency support. |
| D-006 | OPEN | Schema source of truth | Prefer JSON Schema as normative with generated/verified TypeScript types. | Prototype round-trip and error-quality comparison. |
| D-007 | OPEN | Public formula font | Select an OFL-compatible math font for SVG examples; do not redistribute proprietary fonts. | License file and rendered conformance proof. |
| D-008 | OPEN | Pandoc integration | Optional external adapter, never bundled with core. | License/attribution review and absence behavior tests. |
| D-009 | OPEN | Unsupported high-risk OOXML | Reject macros, ActiveX, OLE, embedded packages, and unsafe external relationships in 0.x. | Threat-model review and mutation tests. |
| D-010 | OPEN | PowerPoint evidence adapter | Keep macOS automation optional, trusted/manual, and outside public PR CI. | Least-privilege workflow and redaction review. |
| D-011 | ACCEPTED | Copyright holder | Elliot Wu. | User stated that no employer, university, collaborator, or other holder applies to the new clean-room project. Third-party dependencies and migrated candidates still require separate rights review. |

Record a decision by changing its status to `ACCEPTED`, adding the date and
rationale below the table, and updating every affected contract/TODO in the
same change.

## Decision record — 2026-07-30

- **D-001 accepted:** `pptx-pipeline` is the working project name and package
  stem. The official npm registry returned `E404 Not Found` for the unscoped
  name on 2026-07-30, and exact-name public searches found no conflicting
  project. This does not reserve the name or resolve trademark conflicts; see
  `docs/NAME_AVAILABILITY.md`.
- **D-002 accepted:** use the MIT License. The user prioritized its short,
  minimal redistribution conditions over Apache-2.0's explicit patent terms.
- **D-003 accepted:** the user supplied a public Git author identity. It has
  been configured only in this repository's local Git settings and is not
  repeated in tracked documents.
- **D-004 accepted:** use a monorepo with a private workspace root and separately
  publishable core, CLI, and optional adapter packages.
- **D-011 accepted:** Elliot Wu is the copyright holder for this new clean-room
  project. This does not grant rights to import third-party or predecessor files;
  each candidate remains subject to the provenance gate.

## MIT versus Apache-2.0 review

Both are OSI-approved permissive licenses: they allow commercial use,
modification, distribution, and sublicensing without requiring derivative
source code to be published. Their important differences are:

| Topic | MIT | Apache-2.0 |
| --- | --- | --- |
| Main redistribution duty | Retain the copyright and permission notice in copies or substantial portions. | Include the license, mark modified files, retain applicable notices, and propagate relevant `NOTICE` attribution when one exists. |
| Patent language | Contains no explicit patent-license section. This is not a statement that all patent questions are resolved against the user. | Each contributor expressly grants a limited license to patent claims necessarily infringed by the contribution/work combination. |
| Patent litigation | No express patent-retaliation clause. | The patent license for the work terminates for a party that brings the specified patent infringement litigation. |
| Contributions | No detailed contribution-submission rule. | Intentional contributions are Apache-2.0 by default unless explicitly stated otherwise or covered by a separate agreement. |
| Trademarks | No detailed trademark provision. | Expressly withholds trademark rights except customary origin/NOTICE use. |
| Operational cost | Very short and easy to preserve. | More compliance bookkeeping, especially modification notices and third-party `NOTICE` content. |

Apache-2.0 would provide more explicit patent and contribution rules. The user
selected MIT to minimize downstream compliance obligations and declared that
no employer, university, collaborator, or other copyright holder applies to the
new clean-room project. That declaration does not cover third-party dependencies
or files considered for later migration. This project record is not legal
advice.

Authoritative texts:

- MIT: <https://opensource.org/license/mit>
- Apache License 2.0: <https://www.apache.org/licenses/LICENSE-2.0.html>
