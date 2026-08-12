# Contributing

PPTX Compiler is pre-alpha. The current product surface is the narrow,
experimental public-synthetic candidate flow described in [README.md](README.md)
and the [public support matrix](docs/SUPPORT_MATRIX.md). A contribution must not
broaden that claim without matching implementation, tests, evidence, and a
reviewed matrix change.

## Choose the right channel

- Report a suspected vulnerability through [SECURITY.md](SECURITY.md), never a
  public issue, discussion, or pull request.
- Use a public issue or pull request for a reproducible non-security bug or a
  bounded documentation or implementation change once the public remote exists.
- Discuss changes to public contracts, capabilities, dependencies, package
  boundaries, licensing, or support policy before implementation.

## Reproduce first

Follow [docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md). The root package
scripts and canonical public workflow remain the machine authorities for
commands and ordering.

Public tests must use repository-owned synthetic inputs. They must not require
PowerPoint, Pandoc, a model, private fixtures, private presentations,
proprietary fonts, credentials, or local review artifacts.

## Change requirements

A contribution should:

- implement the smallest complete vertical slice;
- add positive and rejection tests for executable behavior;
- preserve existing public contracts or include an explicit versioned
  migration;
- update schemas, generated types, support policy, provenance, and release
  gates together when their facts change;
- keep source templates read-only and output create-only;
- contain no private asset, generated presentation binary, review artifact,
  absolute local path, secret, or unsupported public claim; and
- record the origin, rights, dependencies, cleanup, and verification of every
  new admitted file or third-party dependency in the
  [provenance ledger](docs/PROVENANCE_LEDGER.md).

## Pull requests

Describe the observed problem, compatibility risk, chosen data relationship,
and exact verification run. Keep unrelated changes separate. A local pass is
not public cross-platform, hosted-CI, or release evidence.

## License

Unless explicitly agreed otherwise in writing, intentional contributions are
licensed under the repository's [MIT License](LICENSE). Submit only material
you have the right to license.
