# pptx-compiler-core

## Purpose and boundary

`pptx-compiler-core` is the dependency-free `0.1.0-alpha.1` runtime for
contracts, secure ingestion, deterministic layout and candidate primitives,
replay records, and honest blocked QA. It is not a CLI or general renderer.

## Fact ownership and dependency flow

Core has no package runtime dependency. It owns the public contract assets,
support-policy asset, secure readers, layout facts, candidate publication state
machines, and three declared surfaces: the candidate API, extension API, and
package-assets API. It does not own a trusted registration or project preset.

## Executable contract

Callers provide explicit roots, validators, registrations, and package-owned
resources. Unknown contracts, inputs, features, relationships, and mutations
fail closed before candidate publication.

## Evidence

The repository-level [architecture](https://github.com/why7682/pptx-compiler/blob/main/docs/ARCHITECTURE_TARGET.md)
owns the complete fact and control flow. Hosted and local evidence cannot
broaden this package's declared surface.

## Limitations

Core does not provide command dispatch, a native capability by itself,
PowerPoint or Pandoc integration, arbitrary-template compatibility, delivery
approval, or a support claim.

## Next authorized action

Use only the exported surfaces described by the package manifest and consult
the [known limitations](https://github.com/why7682/pptx-compiler/blob/main/docs/KNOWN_LIMITATIONS.md).
Do not infer unexported monorepo paths or publication authority.

## License

MIT. Publication is permitted only through the exact public `alpha` channel
with npm provenance. Publication status is owned by the official-registry byte
record, the tracked release lock, and npm provenance; this README never asserts
current lifecycle state. Distribution cannot enable the repository's
`supportClaimsEnabled: false` switch. Report vulnerabilities through the
[security policy](https://github.com/why7682/pptx-compiler/blob/main/SECURITY.md).
