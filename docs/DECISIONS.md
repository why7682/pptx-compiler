# Decision Register

No item below is decided merely because a recommendation is recorded.

| ID | Status | Decision | Current recommendation | Required evidence |
| --- | --- | --- | --- | --- |
| D-001 | ACCEPTED | Working public project and package stem | Use `pptx-pipeline`; recheck immediately before public registration. | Official npm registry returned E404 and exact-name public searches found no project on 2026-07-30; this does not reserve the name or constitute trademark clearance. |
| D-002 | ACCEPTED | License | Use the MIT License. | User selected MIT after reviewing the Apache-2.0 trade-off; official MIT text is present in `LICENSE`. |
| D-003 | ACCEPTED | Public Git author identity | Use the user-approved repository-local identity; do not duplicate its personal fields in tracked planning files. | Local `git config` verification completed. |
| D-004 | ACCEPTED | Repository shape | Use a private-root npm monorepo with separately publishable core, CLI, and optional adapters. | User decision recorded; dependency-direction tests remain required. |
| D-005 | ACCEPTED | Runtime support | Support Node.js 22.x and 24.x LTS on Linux, Windows, and macOS; the private root manifest enforces these release lines. | The official Node.js release table listed both lines as LTS on 2026-07-30; cross-platform CI evidence remains due in M3-004. |
| D-006 | ACCEPTED | Schema source of truth | Use JSON Schema Draft 2020-12 as normative; generated or verified TypeScript types remain a later consumer. | M0-004 validates the bounded provenance contract from its checked-in schema and rejects structural, enum, rights, date, and version mutations. |
| D-007 | OPEN | Public formula font | Select an OFL-compatible math font for SVG examples; do not redistribute proprietary fonts. | License file and rendered conformance proof. |
| D-008 | OPEN | Pandoc integration | Optional external adapter, never bundled with core. | License/attribution review and absence behavior tests. |
| D-009 | OPEN | Unsupported high-risk OOXML | Reject macros, ActiveX, OLE, embedded packages, and unsafe external relationships in 0.x. | Threat-model review and mutation tests. |
| D-010 | OPEN | PowerPoint evidence adapter | Keep macOS automation optional, trusted/manual, and outside public PR CI. | Least-privilege workflow and redaction review. |
| D-011 | ACCEPTED | Copyright holder | Elliot Wu. | User stated that no employer, university, collaborator, or other holder applies to the new clean-room project. Third-party dependencies and migrated candidates still require separate rights review. |
| D-012 | ACCEPTED | npm package scope timing | Defer scoped-versus-unscoped package names until M3-002 package metadata work. | User explicitly deferred the choice; no package manifest or registry reservation is created now. |
| D-013 | ACCEPTED | Git remote timing and visibility | Keep no remote until the public synthetic-fixture CLI flow is executable; after a fresh public-preflight gate, create the repository as public. | User selected post-executable timing and public visibility; hosting account/organization remains open. |
| D-014 | ACCEPTED | Public support taxonomy | Use exactly `supported`, `experimental`, `manual`, and `unsupported`, with a global claim switch and machine-checked evidence/disposition rules. | M0-005 matrix/schema/checker plus 13 overclaim/drift mutations. |
| D-015 | ACCEPTED | 0.x contract compatibility | Breaking contract changes increment the minor version with migration notes; patches remain compatible within a minor except an immediate documented safety demotion; unknown versions/fields fail closed. | M0-005 compatibility policy and schema-version mutations. |
| D-016 | ACCEPTED | First public data-contract set | Use contract version `0.1.0`, eight closed root documents, registered shared references, generated TypeScript declarations, and explicitly schema-only synthetic examples. | M1-002 manifest, shared validator, cross-document gate, and positive/negative fixtures. |

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
- **D-012 accepted:** defer the npm scoped-versus-unscoped decision until
  publishable package metadata is designed. The current unscoped-name E404 is
  time-bounded evidence only.
- **D-013 accepted:** do not create a remote during planning or foundation work.
  Once the synthetic public fixture completes the executable CLI flow and the
  public-preflight scan passes, create a public repository. Select the hosting
  account/organization at that gate.
- **D-005 accepted:** support the actively supported Node.js 22.x and 24.x LTS
  release lines on Linux, Windows, and macOS. The private workspace manifest
  declares `^22.0.0 || ^24.0.0`; the local Node.js 23 development run is not
  support evidence. The official release status was checked at
  <https://nodejs.org/en/about/previous-releases> on 2026-07-30.
- **D-006 accepted:** JSON Schema Draft 2020-12 is the normative schema source.
  M1-002 extracts a dependency-free, fail-closed evaluator for the repository's
  bounded keyword subset, adds registered absolute references, and generates
  checked-in TypeScript declarations. Unsupported keywords still fail closed;
  this evaluator is not claimed as a complete JSON Schema implementation.
- **D-014 accepted:** public status is restricted to `supported`,
  `experimental`, `manual`, or `unsupported`. The normative matrix has a global
  claim switch, exact item scope, explicit catch-alls, and evidence rules. It is
  false at M0-005 completion, so no PPTX capability is currently supported.
- **D-015 accepted:** during 0.x, incompatible public contract changes require a
  minor-version increment, migration notes, and negative tests. Patches remain
  backward-compatible within their minor contract except that an unsafe claim
  may be demoted immediately with an explicit security/compatibility notice.
  Unknown versions and fields fail closed absent an explicit tested migration.
- **D-016 accepted:** the first data-contract version is `0.1.0`. Eight root
  schemas share registered definitions and generate TypeScript from the
  normative schemas. Their positive examples are marked
  `schema-conformance-only`; placeholder executor/schema/QA identifiers and a
  fictional build record are never implementation or support evidence.

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
