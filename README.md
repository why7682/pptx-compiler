# PPTX Compiler

A contract-driven, template-grounded pipeline for deterministic PPTX candidates
and evidence-backed QA.

## Purpose and current boundary

PPTX Compiler is intended to compile semantic presentation data against a
user-owned PowerPoint template while preserving the template's design language
and native editability wherever an explicitly declared capability supports it.
Structural correctness is necessary, but a candidate becomes a delivery only
after the same artifact has the required mechanical, rendered, independent
visual, and compatibility evidence.

The current candidate-alpha boundary is deliberately much smaller. It can:

1. create one repository-owned public-synthetic project;
2. inspect its bounded POTX source into a normalized `TemplateIndex`;
3. validate the complete project graph and preflight one exact capability batch;
4. render one explicitly opted-in, one-slide native-card candidate; and
5. re-derive that candidate and emit a schema-valid `QaReport` whose decision is
   `"blocked"` because required external evidence is unavailable.

That blocked result is successful, honest assessment. It creates no
`BuildArtifact` and grants no delivery authority.

This version does **not** provide arbitrary-template compatibility, a general
renderer, or passed delivery QA. Whether exact package bytes were distributed
is a separate official-registry/lock/provenance fact and never changes that
capability boundary. The normative global switch remains
`supportClaimsEnabled: false`, and no support row is `supported`.

## Fact ownership

One readable owner is kept for each fact:

| Fact | Authority |
| --- | --- |
| Unchanged inherited content and package structure | The source template |
| Authored content and relationships, including formula LaTeX | Raw brief, evidence, and `DeckSpec` |
| Normalized observable template structure | `TemplateIndex`, derived through bounded inspection |
| Project-specific semantic bindings | `ProjectOverlay` |
| Editable layout intent, slots, padding, sizing, and constraints | `SlideLayoutIR` |
| Frozen EMU geometry and deterministic constraint results | `ComposedSlidePlan` |
| Candidate layout/build replay and exact candidate identity | `CandidateBuildRecord` |
| Checks, unavailable evidence, and the aggregate QA decision | `QaReport` |
| Final delivered outputs after every required gate passes | `BuildArtifact` |
| Current support dispositions | `policy/support-matrix.json` |
| Four-package source graph and authorized public-alpha channel | `packaging/alpha-package-plan.json` |
| Exact release tag, builders, lock inputs, recovery, and completion rules | `packaging/alpha-release-plan.json` |
| Release phase order, eligibility, and phase evidence | `docs/RELEASE_GATES.md` |

Hashes bind exact objects at authority boundaries. They do not replace the
readable source, semantic, layout, or evidence model.

## Executable flow

The installed candidate-alpha spine is:

```text
public-synthetic project
  -> bounded POTX ingestion and TemplateIndex
  -> exact project validation and full-batch preflight
  -> semantic slot and SlideLayoutIR
  -> deterministic ComposedSlidePlan
  -> fresh one-shot native-card dispatch
  -> typed OOXML assembly and exact collateral diff
  -> CandidateBuildRecord first, candidate PPTX as commit marker
  -> independent re-derivation and exact pair comparison
  -> blocked QaReport, with no BuildArtifact
```

`validate project` discards its preflight plan without executing the project.
`render` prepares a fresh one-shot plan. `qa` independently reloads the readable
project facts, re-runs the same layout derivation, reconstructs the expected
candidate pair, and compares the complete bytes and replay record. It does not
search for screenshots, PowerPoint transcripts, or other ignored local
evidence.

All commands require explicit project paths. In JSON mode the CLI emits one
deterministic envelope and uses only process exits `0` (success), `1`
(domain/runtime failure), and `2` (usage failure). Errors expose a bounded code
and pointer, never source content, XML, an absolute path, or a stack trace.

## Packages and contracts

The private workspace projects exactly four public-alpha npm packages:

```text
pptx-compiler
  |-- pptx-compiler-core
  |-- pptx-compiler-native-card-arrow --> pptx-compiler-core
  `-- pptx-compiler-public-synthetic
```

The CLI is the composition root. Core does not import the CLI, optional process
or PowerPoint adapters, model-assisted labs, private fixtures, or a presentation
project. Each package owns the schemas, fixtures, and static resources it
interprets. The current package plan positively maps every staged file and records
D-050's exact public channel: version `0.1.0-alpha.3`, official npm registry,
dist-tag `alpha`, public access, and npm provenance. That is authorization and
staging policy, not evidence that any package has been published.

Contract version `0.1.0` has nine closed serialized roots:
`ProjectConfig`, `TemplateProfile`, `TemplateIndex`, `CapabilityRegistry`,
`ProjectOverlay`, `DeckSpec`, `CandidateBuildRecord`, `QaReport`, and
`BuildArtifact`. JSON Schema is normative; checked TypeScript declarations are
generated from it. Unknown versions, fields, bindings, features, and mutation
requests fail closed.

Node.js 22.x and 24.x are the admitted runtime lines. Follow the canonical
source and guarded-package procedure in
[docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md). That source procedure uses
guarded local tarballs; consumers must trust an npm installation only when the
official-registry bytes, tracked release lock, and npm provenance agree.

This prerelease must be selected explicitly with exact version
`0.1.0-alpha.3` or dist-tag `@alpha`. A bare install resolves each package's
package-level `latest`: npm requires that key, core retains its immutable
`alpha.2` seed while the other three first identities seed at `alpha.3`. That
mixed bare-install graph is a documented limitation, not a supported selector.

## Public evidence

The latest accepted pre-M4 reader baseline is pull-request head
`093d527fc3fadf7cae577139b8d400719755dd52` and accepted main
`8cdf968b72f8dd5f41fee37a68e239e477dec44b`. They share tree
`1d6d148a8bc347dc3cbc13dde3fd4314d86c421a`. Its hosted evidence is:

| Boundary | Result |
| --- | --- |
| [Pull-request CI](https://github.com/why7682/pptx-compiler/actions/runs/31608992503) | Ubuntu, Windows, and macOS under Node 22 and 24 passed |
| [Pull-request security](https://github.com/why7682/pptx-compiler/actions/runs/31608992491) | Dependency Review passed |
| [Accepted-main CI](https://github.com/why7682/pptx-compiler/actions/runs/31609285181) | All six platform/runtime cells passed |
| [Accepted-main security](https://github.com/why7682/pptx-compiler/actions/runs/31609285220) | CodeQL passed |

Those runs preserve the earlier M3-004B implementation evidence while checking
the accepted constructive reader bundle. They exercise the public-safe source
gates, complete test suite, guarded four-package build, clean joint
installation, and installed CLI smoke. They prove the workflow on the named Git
objects. They do not prove an M4 candidate, annotated tag, arbitrary-template
support, absence of every vulnerability, registry publication,
reviewed-to-published equality, provenance, or release eligibility.

The later immutable `alpha.2` tag passed Public CI run `31665054553` and
Security run `31665054531`. Release run `31665307969`, attempt 2, published
only exact reviewed `pptx-compiler-core@0.1.0-alpha.2`; later independent byte
and certificate-bound provenance verification passed, while the other three
versions and GitHub Release remained absent. This is partial historical release
evidence, not the current four-package candidate.

The completed `alpha.3` source chain is
`S3=20f7f64faa8c8d688922896296c134b25bc58e7f` followed by sole-child
`A3=7270ae7814583117050abac648ba96067e4fce67`; annotated tag object
`46c5360bd5daa48a1b493f1c9310b2358b3d6e6d` peels to `S3`. A3 Public
CI/Security runs `31750359756`/`31750359778` and tag Public CI/Security runs
`31750881903`/`31750881914` passed. Release run `31756489430` exact-verified
all four official npm packages and created non-draft prerelease
[`v0.1.0-alpha.3`](https://github.com/why7682/pptx-compiler/releases/tag/v0.1.0-alpha.3)
last as GitHub Release `370278133`, target `S3`, with no assets. Release Gates
owns the complete lifecycle evidence and its failure/cooldown history.

The machine-readable matrix currently contains 60 rows: 0 `supported`, 22
`experimental`, 3 `manual`, and 35 `unsupported`. The six platform/runtime rows
remain experimental because platform execution evidence alone cannot promote a
product capability or enable the global support switch.

## Limitations

- The public candidate path accepts only the exact repository-owned synthetic
  profile. Arbitrary PPTX input and arbitrary POTX templates remain unavailable.
- The public CLI exposes one native-card candidate flow. General clone/fill,
  DrawingML, ordered native/OMML delivery, direct formula delivery, and a
  formula CLI are not public alpha capabilities.
- The optional Pandoc adapter is externally configured, not bundled, and is
  outside the four-package alpha graph. Real-Pandoc public conformance is absent.
- PowerPoint compatibility evidence is a narrow trusted-local fact. It does not
  generalize to another template, platform, feature, or candidate.
- Planning and visual-review experiments under `labs/` are non-authorizing.
  Model preference is not evidence of actual audience comprehension or effect.
- Windows preserves the logical create-only state machine and flushed file
  bytes, but Node exposes no parent-directory fsync equivalent there; no sudden-
  power-loss directory-entry persistence claim is made.
- D-050 authorized the exact `alpha.3` recovery. Its completed lifecycle does
  not change support: exact tag/lock identity, official-registry bytes, npm
  provenance, and the GitHub Release record own those facts.

## Next authorized action

D-050 and M4-001D are complete. All four exact package identities, provenance,
tag maps, the GitHub prerelease, four Trusted Publisher readbacks, bootstrap-
token retirement, and `NPM_TOKEN` environment-secret deletion are recorded by
their exact state owners. The bindings establish configured/visible state, not
execution proof; only a future tokenless OIDC publication can prove they work.
The release workflow does not automatically modify npm or GitHub settings; the
completed transition was an external local interactive npm 11.17.0 procedure.
No further `alpha.3` release mutation is authorized.

The next product milestone is M4-002's bounded compatibility evidence. It must
use only redacted feature-level results, preserve the public synthetic fixture
as sufficient for CI, and must not promote support or generalize one candidate
to arbitrary templates.
Main-branch protection remains deliberately
deferred by D-047/M3-008 and must not be claimed as active.

## Documentation and project processes

- Start with the [candidate changelog](CHANGELOG.md), the single
  [known-limitations list](docs/KNOWN_LIMITATIONS.md), and the
  [state-neutral `0.1.0-alpha.3` note](docs/releases/0.1.0-alpha.3.md) for the
  reader-facing candidate scope.
- Read the human [support matrix](docs/SUPPORT_MATRIX.md) together with the
  [compatibility policy](docs/COMPATIBILITY_POLICY.md).
- See [docs/ARCHITECTURE_TARGET.md](docs/ARCHITECTURE_TARGET.md) for the complete
  authority, control-flow, security, and delivery model.
- Use the [release gates](docs/RELEASE_GATES.md) as the publication authority;
  the lock-bound changelog and release note cannot authorize a release.
- Follow [docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md) for the canonical
  public-safe verification sequence.
- Report vulnerabilities only through [SECURITY.md](SECURITY.md).
- Before proposing a change, read [CONTRIBUTING.md](CONTRIBUTING.md) and
  [GOVERNANCE.md](GOVERNANCE.md).
- [HANDOFF.md](HANDOFF.md) and [TODO.md](TODO.md) retain implementation history
  and dependency-ordered work; they are intentionally last rather than the main
  product explanation.

## License

MIT. See [LICENSE](LICENSE).
