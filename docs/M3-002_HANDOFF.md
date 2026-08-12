# M3-002 Handoff — Guarded Alpha Package Definition

## Core judgment

The real packaging defect was not missing `package.json` fields. Production
composition still treated the private monorepo root as the installation root.
Publishing that shape would create tarballs that pack successfully but cannot
locate each other or their static resources after installation.

M3-002 removes that assumption without moving or copying implementation files.
It defines the smallest complete candidate-alpha graph:

```text
pptx-compiler
  -> pptx-compiler-core
  -> pptx-compiler-native-card-arrow -> pptx-compiler-core
  -> pptx-compiler-public-synthetic
```

Pandoc, PowerPoint, clone/fill, labs, tests, native OMML, ordered assembly, and
final-delivery implementations are excluded.

## Authorities

- `packaging/alpha-package-plan.json` is the sole source-to-stage and metadata
  plan. It records exact names, version, license, engines, dependencies,
  exports, types, bin, import aliases, assets, and positive file mappings.
- `scripts/lib/package-plan.mjs` validates the complete plan, including source
  existence/type/size, unique targets, import closure, dependency cycles,
  forbidden implementations, notices, executable bin input, and the ignored
  fixed stage.
- Narrow core, extension, plugin, preset, and CLI facades are the only planned
  runtime exports. Existing implementation paths remain compatible inside the
  source workspace through the root import aliases.
- Package-owned descriptors resolve contracts/support policy, plugin
  Schemas/cases, and public-synthetic fixtures/golden relative to their own
  installed modules. The installed CLI composes those exact paths and passes
  them through `executeCliWithResources`.
- The legacy explicit repository-root CLI remains a workspace compatibility
  projection. It is not used by the installed bin.

## Naming and publication

D-044 supersedes the original working names with the four `pptx-compiler*`
names shown above. All four exact replacement names returned E404 from the
official npm registry on 2026-08-11. This is time-bounded evidence, not a
reservation. Recheck the whole set immediately before publication and fail
closed if any name changed. The existing package-plan ID remains the stable
ignored-stage recovery identity; it is not an npm or repository alias.

D-045 has since replaced the original `repository-url-pending-m3-006` state
with one exact GitHub tuple in package-plan schema v2. Leaf repository fields
are derived from that tuple while `private: true` and
`npm-publication-not-authorized` remain the executable npm guard. Do not invent
a second repository authority or weaken that guard merely to make a tarball
look publishable.

## Verification boundary

Focused tests prove the exact four-package graph, positive file mapping, narrow
facade exports, package-owned asset projections, forbidden closure, missing
dependency, unmapped export/type, target alias, non-executable bin, premature
repository URL, and name drift. A separate execution test passes explicit
contract, public-fixture, plugin, golden, and support paths through the complete
`init -> inspect -> validate project -> render -> qa` spine; QA ends blocked and
no `BuildArtifact` exists.

This is package-definition evidence only. It is not tarball-content,
empty-directory installation, npm publication, public repository, cross-
platform CI, or release evidence.

The package/CLI/native/policy focus passes 146/146 and the complete Node 22
strict suite passes 1107/1107. `check:package-plan` validates all four guarded
profiles. Forbidden-material and provenance working-tree gates each pass across
239 files; the 60-row support gate, versioned-contract gate, and
`git diff --check` also pass. The bounded independent review's initial one high
and one medium findings were fixed; final re-review reports 0 blocker, 0 high,
and 0 medium.

## Next dependency

M3-003 must reuse one fixed ignored `.package-stage/` rather than creating new
temporary package roots. Materialize the plan create-only, generate exact leaf
manifests, pack all four packages, inspect their contents and limits, install
the local tarballs together in one empty directory, and run the complete
installed-bin spine. Any mismatch must delete or quarantine only the owned
stage attempt and leave source files untouched.
