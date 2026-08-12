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

This repository does **not** currently provide arbitrary-template
compatibility, a general renderer, passed delivery QA, or a published npm
package. The normative global switch remains `supportClaimsEnabled: false`, and
no support row is `supported`.

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
| Four-package source and dependency graph | `packaging/alpha-package-plan.json` |
| Release eligibility | `docs/RELEASE_GATES.md` |

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

The guarded alpha graph contains exactly four npm-private packages:

```text
pptx-compiler
  |-- pptx-compiler-core
  |-- pptx-compiler-native-card-arrow --> pptx-compiler-core
  `-- pptx-compiler-public-synthetic
```

The CLI is the composition root. Core does not import the CLI, optional process
or PowerPoint adapters, model-assisted labs, private fixtures, or a presentation
project. Each package owns the schemas, fixtures, and static resources it
interprets. The package plan positively maps every staged file and keeps npm
publication blocked.

Contract version `0.1.0` has nine closed serialized roots:
`ProjectConfig`, `TemplateProfile`, `TemplateIndex`, `CapabilityRegistry`,
`ProjectOverlay`, `DeckSpec`, `CandidateBuildRecord`, `QaReport`, and
`BuildArtifact`. JSON Schema is normative; checked TypeScript declarations are
generated from it. Unknown versions, fields, bindings, features, and mutation
requests fail closed.

Node.js 22.x and 24.x are the admitted runtime lines. Follow the canonical
source and guarded-package procedure in
[docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md); there is no npm installation
command because the packages have not been published.

## Public evidence

The accepted executable baseline is Git object
`c4dee58a8920a8e71c20f53ab93c62a96d3cb89d`. Its hosted evidence is:

| Boundary | Result |
| --- | --- |
| [Pull-request CI](https://github.com/why7682/pptx-compiler/actions/runs/31600528716) | Ubuntu, Windows, and macOS under Node 22 and 24 passed |
| [Dependency Review](https://github.com/why7682/pptx-compiler/actions/runs/31600528742) | Passed on the ordinary pull request |
| [Accepted-main CI](https://github.com/why7682/pptx-compiler/actions/runs/31600806512) | All six platform/runtime cells passed |
| [Accepted-main security](https://github.com/why7682/pptx-compiler/actions/runs/31600806350) | CodeQL passed |

Those runs also exercise the public-safe source gates, complete test suite,
guarded four-package build, clean joint installation, and installed CLI smoke.
They prove the workflow on the named Git objects. They do not prove arbitrary
template support, absence of every vulnerability, registry publication,
reviewed-to-published equality, signing, or release eligibility.

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
- No npm artifact, release tag, signature, registry provenance, or
  reviewed-to-published byte equality exists yet.

## Next authorized action

This reader-facing bundle constructs the candidate from purpose through
limitations and is being frozen by the M3-005B cross-document gate. Once that
gate records its final evidence, the repository may prepare the
`0.1.0-alpha.1` release gate. npm publication still requires
separate explicit authorization plus a clean-tag build, signing/provenance, and
reviewed-to-published byte equality. Main-branch protection remains deliberately
deferred and must not be claimed as active.

## Documentation and project processes

- Start with the [unreleased changelog](CHANGELOG.md), the single
  [known-limitations list](docs/KNOWN_LIMITATIONS.md), and the
  [draft `0.1.0-alpha.1` note](docs/releases/0.1.0-alpha.1.md) for the current
  reader-facing candidate scope.
- Read the human [support matrix](docs/SUPPORT_MATRIX.md) together with the
  [compatibility policy](docs/COMPATIBILITY_POLICY.md).
- See [docs/ARCHITECTURE_TARGET.md](docs/ARCHITECTURE_TARGET.md) for the complete
  authority, control-flow, security, and delivery model.
- Use the [release gates](docs/RELEASE_GATES.md) as the publication authority;
  the changelog and draft release note cannot authorize a release.
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
