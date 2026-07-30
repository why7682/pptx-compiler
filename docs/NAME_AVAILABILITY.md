# Name Availability Check

Checked on 2026-07-30 for the working stem `pptx-pipeline`.

## Evidence

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

## Interpretation and limits

The unscoped npm name was not registered at the time of the query. The check
does not reserve the package name, prove that npm will accept a future publish,
search private repositories, establish social-media/domain availability, or
constitute a trademark clearance opinion.

Re-run the official registry query immediately before creating package metadata
and before the first publication. If the unscoped name becomes unavailable,
prefer a user- or organization-scoped package rather than changing public API
contracts hastily.
