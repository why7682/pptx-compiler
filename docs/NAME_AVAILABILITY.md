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

## Current repository state — 2026-08-11

After D-044 closed, M3-006 created `why7682/pptx-compiler` as an empty public
GitHub repository. GitHub reports numeric repository ID `1330979133`, the refs
API reports the repository is empty, and private vulnerability reporting was
enabled with HTTP 204 then verified by GET as exact `enabled: true`. No source
ref has been created. The npm availability observations above remain only dated
observations and still reserve nothing.

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
