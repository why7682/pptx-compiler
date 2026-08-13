# pptx-compiler-native-card-arrow

## Purpose and boundary

`pptx-compiler-native-card-arrow` owns one exact, statically registered
`0.1.0-alpha.3` card-and-arrow candidate capability. It is not a standalone
PPTX writer, a general DrawingML library, or evidence of editability.

## Fact ownership and dependency flow

This package depends only on `pptx-compiler-core`. It owns validated input and
output schemas, conformance cases, registration metadata, and the typed native
executor. Core owns target IDs, package reconstruction, placement, and
candidate publication.

## Executable contract

The executor returns an unbound plan with `insertable: false`. Core validates
that typed data, remaps target-local identifiers, and rebuilds the DrawingML in
the fixed admitted path; raw fragment concatenation is forbidden.

## Evidence

The [support matrix](https://github.com/why7682/pptx-compiler/blob/main/docs/SUPPORT_MATRIX.md)
owns the experimental status, and the
[architecture](https://github.com/why7682/pptx-compiler/blob/main/docs/ARCHITECTURE_TARGET.md)
owns the application boundary. Neither source alone authorizes delivery.

## Limitations

The public CLI ends with blocked QA and no `BuildArtifact`. This package proves
only the exact card-arrow candidate cases; it does not prove arbitrary
components, PowerPoint compatibility, or delivery readiness. Select exact
`0.1.0-alpha.3` or `@alpha`; do not treat a bare install as a version-selection
contract for this prerelease.

## Next authorized action

Keep registration static and exact. Any broader input, output, or support scope
requires its own schemas, conformance evidence, QA assertions, and reviewed
matrix change.

## License

MIT. Publication is permitted only through the exact public `alpha` channel
with npm provenance. Publication status is owned by the official-registry byte
record, the tracked release lock, and npm provenance; this README never asserts
current lifecycle state. Distribution cannot enable the repository's
`supportClaimsEnabled: false` switch. Report vulnerabilities through the
[security policy](https://github.com/why7682/pptx-compiler/blob/main/SECURITY.md).
