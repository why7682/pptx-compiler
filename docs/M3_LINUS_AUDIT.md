# M3 Linus Audit — Candidate Alpha Before Command Breadth

Date: 2026-08-11

Status: accepted planning correction. New M3 feature work was frozen while this
audit was performed; D-034 was then the last implemented slice. D-036 has since
completed the corrected project-spine step and D-037 has completed the exact
candidate-render step without changing this audit's blocked-QA constraint.

## Core judgment

Worth doing, but the old M3 task shape was wrong. The real problem is not that
six command names are still unavailable. The real problem is that the
repository has no honest installed path from one readable project to a mutable
candidate and a truthful QA decision.

The next release target is therefore a **candidate alpha**, not a delivery
alpha:

- it may create a candidate PPTX plus its `CandidateBuildRecord`;
- `qa` must create the existing `QaReport` with `decision: "blocked"` when
  required rendered, pixel, or compatibility evidence is absent;
- a blocked assessment is a successfully executed assessment, not a passing
  delivery;
- no `BuildArtifact` is created until the existing final-delivery requirements
  are actually satisfied; and
- `supportClaimsEnabled` remains false.

## The three questions

### 1. Is this a real problem?

Yes. A clean install still cannot take one public project through inspection,
whole-project preflight, candidate creation, and an evidence-aware QA result.
That blocks a useful alpha.

Implementing eight command names is not the real problem. `doctor`, a generic
`onboard`, and a standalone `diff` do not create the first usable output and do
not block a candidate alpha.

### 2. Is there a simpler path?

Yes. Preserve one authority chain and put a thin command boundary over it:

```text
ProjectConfig + source template
  -> TemplateIndex
  -> TemplateProfile + CapabilityRegistry + ProjectOverlay + DeckSpec
  -> normative support decision + static-host full-batch preflight
  -> Candidate PPTX + CandidateBuildRecord
  -> recomputed QaReport
  -> BuildArtifact only when every required fact passes
```

Do not add a CLI job file, `GenerationIntent`, serialized dispatcher plan,
second structural-QA record, or second diff authority.

### 3. What can this break?

The dangerous break is semantic, not syntactic: publishing a command named
`validate` or `render` that appears to authorize more than it proves. The other
risks are source overwrite, a support-policy bypass, freezing a redundant CLI
argument as public compatibility, and packaging before the installed
composition root is stable.

D-034 has not been published. Its internal compatibility re-export remains
valuable, but its draft command grammar is not userspace and must be corrected
before the first package is released.

## Five-layer audit

### 1. Data structures

The data model is mostly good. The normative objects already exist:

- `ProjectConfig` owns project-relative locations;
- `TemplateIndex` owns inspected template facts;
- `TemplateProfile`, `CapabilityRegistry`, `ProjectOverlay`, and `DeckSpec` own
  readable project intent and bindings;
- the opaque dispatcher plan is runtime-only and one-shot;
- `CandidateBuildRecord` owns replayable candidate authority;
- `QaReport` owns the assessment decision; and
- `BuildArtifact` is the final publication marker.

Commands must project or consume these objects. They must not own parallel
models.

Two concrete consequences follow:

1. `inspect --output` is redundant. `ProjectConfig` already owns the exact
   `TemplateIndex` path. Before publication, `inspect` should derive its output
   from that one authority instead of requiring a second value that can only be
   equal or fail.
2. The current `validate --contract` proves only one document's Schema shape.
   It is useful as an explicit document diagnostic, but it is not the
   `validate` step in the alpha spine. Product validation must load the complete
   project graph, resolve all identities and hashes, apply the normative support
   policy, run real static-host preflight, and discard the resulting one-shot
   plan. Render must prepare a fresh plan.

### 2. Special cases

The old order put `render -> qa` before `init`. That would force the first host
to construct fixed documents in code, import fixtures, or wrap a test helper,
then add a different disk model later. Delete that order.

The public-synthetic bootstrap may be an explicitly labeled conformance preset.
It may create a complete schema-valid project under one selected root. That is
not proof of generic onboarding.

Generic onboarding is not safe with the current metadata: capability
definitions name required binding roles, but do not describe enough binding
constraints to synthesize a `ProjectOverlay` without capability-specific rules.
Hard-coding those rules in the CLI would recreate the deck-specific renderer
problem. Keep generic `onboard` unavailable until an actual data-contract
decision supplies the missing semantics.

### 3. Complexity

D-034's three modules, one protocol, and `0/1/2` process meanings are small
enough. Keep them. Do not add a command-class hierarchy, plugin discovery, a
filesystem abstraction, or a serialized run graph.

The old M3-001 task made all eight commands one milestone. That is checklist
complexity. Split the effect-producing spine from auxiliary commands:

- alpha blockers: synthetic bootstrap, inspect, project validation,
  candidate-only render, and honest QA;
- deferred: `doctor`, generic `onboard`, standalone `diff`, formula CLI, direct
  OMML delivery, and generalized ordered delivery.

Internal collateral-diff recomputation remains mandatory for QA. A public
standalone `diff` command does not.

### 4. Breakage and authorization

The current support matrix makes the input, inspection, assembly, and
collateral-QA rows needed by a product render unavailable. A complete runtime
registration cannot override that fact. Therefore the next render slice has
only two honest choices:

1. remain unavailable; or
2. select one exact public-synthetic profile and, in the same reviewed change,
   promote every dependency row actually exercised by that profile to
   `experimental`, require explicit opt-in, and leave the global support switch
   false.

The selected smallest profile is one public-synthetic native-card candidate.
It avoids unsupported clone/fill and OMML dependencies. The exact dependency
closure must be enumerated and tested before any matrix change; no
`conformance-only` support resolver is permitted.

The compatibility rules to preserve are:

- source templates stay read-only;
- all outputs stay create-only;
- the existing Schema implementation and script compatibility re-export stay
  intact;
- no test helper becomes a production composition root;
- a document-level validation result never claims project preflight; and
- a blocked `QaReport` never creates a `BuildArtifact`.

### 5. Practical value

The cheapest useful release is a candidate alpha. It demonstrates a real
installed output path without pretending that public headless CI has supplied
PowerPoint, human, or model evidence.

For JSON callers, a successfully computed blocked QA result may use process exit
`0` with `ok: true`, because the assessment ran correctly; the normative result
must still say `decision: "blocked"`. Human output must say `qa: blocked`, never
`qa: ok`. Invalid or unassessable inputs remain process failures. The smoke test
must assert both the blocked decision and absence of `BuildArtifact`.

## Findings

### Blockers before render

1. **No authorized render path.** The normative matrix currently rejects
   required input/assembly/QA rows. Fix the exact experimental dependency
   closure or keep render unavailable.
2. **Undefined QA success semantics.** Public CI cannot invent missing visual or
   compatibility evidence. Candidate alpha explicitly expects a blocked
   `QaReport`; delivery alpha remains later work.
3. **Public-CI/repository cycle.** The old plan required public CI before the
   public repository existed, while final package repository metadata depended
   on the later hosting decision. Public repository creation must precede final
   public CI evidence.

### High-priority corrections

1. Rename/scope the current single-document validation before publication; it
   is not project validation.
2. Remove “all eight commands block alpha.”
3. Build the on-disk synthetic project before the render host, not after it.

### Medium corrections

1. Remove the redundant `inspect --output` authority before publication.
2. Defer generic onboarding until binding requirements are representable as
   data rather than CLI conditionals.
3. Split minimum pre-public security/governance documents from final release
   notes and changelog work.

## Corrected execution order

1. **Keep D-034.** Its protocol, contained I/O, secure inspection, Schema
   relocation, compatibility re-export, and tests remain valid.
2. **Project spine.** Implement one create-only public-synthetic bootstrap under
   one explicit root; remove `inspect --output`; expose document validation
   explicitly and add real whole-project validation using the normative static
   host and support policy.
3. **Candidate render.** Select the exact one-slide native-card experimental
   profile, close and review its matrix dependency set, re-prepare a fresh
   one-shot plan, and publish only candidate plus CandidateBuildRecord.
4. **Honest QA.** Recompute mechanical and collateral facts. Emit the same
   `QaReport` contract as blocked when evidence is incomplete; never publish a
   `BuildArtifact` on that path.
5. **Package and leakage gates.** Freeze package boundaries only after the
   installed vertical flow is stable; then run positive allowlist, tarball,
   clean-install, secret/path/PII, license, provenance, and SBOM gates.
6. **Pre-public documents.** Add the minimum SECURITY, CONTRIBUTING, governance,
   and vulnerability-reporting material.
7. **Create the public repository.** Run a fresh leakage preflight, obtain the
   user's account/organization choice, create the clean public remote, and only
   then collect public CI evidence.
8. **Public CI and release documents.** Run Linux/Windows/macOS jobs, finalize
   repository metadata, support text, changelog, and release notes, then cut the
   alpha.
9. **Defer auxiliary commands.** Implement `doctor`, generic `onboard`, and
   standalone `diff` only when an actual user workflow makes their contracts
   clear.

## Keep / delete / refactor / defer

Keep:

- one CLI protocol and `0/1/2` exit taxonomy;
- safe `code + pointer` failures;
- secure `inspect` implementation;
- one Schema implementation plus compatibility re-export;
- `CandidateBuildRecord -> QaReport -> BuildArtifact-last` authority; and
- package allowlists, clean-install gates, and three-platform CI requirements.

Delete:

- render/QA before the project bootstrap;
- eight-command breadth as an alpha exit condition;
- any implication that one Schema-valid document is a renderable project;
- any test-only support override or structural-QA substitute; and
- the public-CI-before-public-repository ordering.

Refactor:

- `validate` into explicit document and project meanings;
- `inspect` to use the configured output path without a duplicate argument;
- M3-001 into an alpha spine plus deferred auxiliary commands;
- support rows with the exact experimental render profile and no broader claim;
- QA into explicit blocked/pass semantics; and
- public-repository/CI/package-metadata ordering.

Defer:

- `doctor`, generic `onboard`, standalone `diff`, and formula CLI;
- direct-OMML final receipt and generalized native/OMML ordering;
- arbitrary-template or platform support; and
- delivery alpha until actual required evidence exists.

## Independent challenge

One bounded read-only review reported three blockers, three highs, and two
medium planning findings. This document incorporates them and adds the redundant
`inspect --output` authority and missing generic-onboarding metadata findings.
No production file, support row, public contract, package, or release claim was
changed by the audit itself.
