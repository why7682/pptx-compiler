# pptx-compiler

## Purpose and boundary

`pptx-compiler` is the private `0.1.0-alpha.1` CLI composition root. It exposes
one exact installed candidate flow, not a general PPTX renderer, arbitrary-
template tool, delivery approval system, or published npm release.

## Fact ownership and dependency flow

The complete package graph is:

```text
pptx-compiler
  |-- pptx-compiler-core
  |-- pptx-compiler-native-card-arrow --> pptx-compiler-core
  `-- pptx-compiler-public-synthetic
```

The CLI owns command dispatch only. Core owns contracts and candidate
primitives, native-card-arrow owns its exact executor and schemas, and
public-synthetic owns the reviewed preset and source parts. Resources resolve
through these declared dependencies, never through a monorepo root.

## Executable contract

```text
init -> inspect -> validate project -> render candidate -> qa
```

Every command requires an explicit project path. The final `qa` step reports
`decision: blocked` and creates no `BuildArtifact`.

## Evidence

The repository-level [public evidence owner](https://github.com/why7682/pptx-compiler/blob/main/docs/M3-004_HANDOFF.md)
records the exact hosted runs. That evidence verifies the declared workflow; it
does not turn a candidate into delivery or support.

## Limitations

Only the installation-owned public-synthetic profile is admitted. PowerPoint
compatibility, arbitrary templates, general rendering, delivery QA, and npm
publication are unavailable.

## Next authorized action

Consult the [release gates](https://github.com/why7682/pptx-compiler/blob/main/docs/RELEASE_GATES.md)
and [known limitations](https://github.com/why7682/pptx-compiler/blob/main/docs/KNOWN_LIMITATIONS.md).
Do not publish this package without a separate explicit authorization.

## License

MIT. The manifest remains `private: true`, npm publication is blocked, and the
repository switch remains `supportClaimsEnabled: false`; no support row is
`supported`. Report vulnerabilities through the
[security policy](https://github.com/why7682/pptx-compiler/blob/main/SECURITY.md).
