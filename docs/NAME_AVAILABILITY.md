# Name Availability Check

## Current selection — 2026-08-11

The user selected `why7682/pptx-compiler` as the exact first public repository.
Read-only checks found:

- `gh repo view why7682/pptx-compiler` reported that the repository did not
  exist;
- an exact-name GitHub search found no repository named `pptx-compiler`;
- the official npm registry returned E404 for `pptx-compiler`,
  `pptx-compiler-core`, `pptx-compiler-native-card-arrow`, and
  `pptx-compiler-public-synthetic`;
- the former working repository stem now has an exact public collision at
  `michaelhaddad-code/pptx-pipeline`.

This evidence drove D-044's atomic pre-public rename. It did not reserve either
kind of name and is not trademark clearance.

## Current repository state — 2026-08-12

M3-006 published the exact reviewed object
`410642b668514ab7193212d617cc0f8acb837924` as the first public `main` ref for
`why7682/pptx-compiler`. GitHub reports numeric repository ID `1330979133`;
after the exact push, private vulnerability reporting was reverified as
`enabled: true` and remote `main` was reverified equal to that object. This was
source publication only at that checkpoint. D-048 later authorized one exact
candidate-alpha publication transition for the four selected npm names; that
authorization does not reserve a name or prove that a registry write occurred.
The npm availability observations above remain dated observations and reserve
nothing.

## Latest official-registry observation — 2026-08-13

After the retired `alpha.1` workflow stopped before its first npm write, fresh
official-registry reads returned E404 for all four package packuments and all
four exact `0.1.0-alpha.1` versions. No npm identity was created or reserved by
that attempt. D-049 now authorizes the same four names at
`0.1.0-alpha.2`; candidate preparation and publication must still recheck the
official registry at their own time-of-use boundaries. This dated observation
is neither reservation nor publication evidence.

## Historical working-name check

The former working stem `pptx-pipeline` was initially checked on 2026-07-30 and
its four M3-002 package names were rechecked on 2026-08-11.

### Evidence

A read-only query was sent to the official npm registry:

```sh
npm view pptx-pipeline name version --json \
  --registry=https://registry.npmjs.org
```

- The query returned `E404 Not Found` and stated that `pptx-pipeline@*` was not
  in the registry.
- Exact public searches for `"pptx-pipeline" npm`, `"pptx-pipeline" GitHub`, and
  `"PPTX Pipeline" software` found no exact-name package or project. Results did
  reveal adjacent presentation-generation products, so the descriptive product
  space is not unique.

The M3-002 recheck sent the same read-only official-registry query for:

- `pptx-pipeline`;
- `pptx-pipeline-core`;
- `pptx-pipeline-native-card-arrow`;
- `pptx-pipeline-public-synthetic`.

All four returned `E404` on 2026-08-11. The result is recorded as a dated input
to `packaging/alpha-package-plan.json`; it is not a reservation.

## Interpretation and limits

The selected unscoped npm names were not registered at the time of the query.
The checks do not reserve a package or repository name, prove that npm will
accept a future publish, search private repositories, establish social-media or
domain availability, or constitute a trademark clearance opinion.

Re-run the official registry query immediately before first publication. If an
unscoped name becomes unavailable, stop publication and revise the complete
name/import/dependency plan atomically; do not publish a partially renamed
graph.
