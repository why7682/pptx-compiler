# Private Fixture Policy

Private files may be used as optional local compatibility probes while the
public project remains independently buildable and testable.

## Location and configuration

- Store every private PPTX/POTX and related asset outside this Git repository.
- Configure locations only through ignored local environment/configuration
  files. The committed `.env.example` contains empty values only.
- Require `RUN_PRIVATE_FIXTURE_TESTS=1` for every private test lane.
- Resolve and validate canonical paths before opening inputs. Inputs are
  read-only; extraction and output use a dedicated temporary directory.

## Prohibited Git and artifact content

Never commit or upload:

- the source deck, binary derivative, extracted package, preview, screenshot,
  PDF, font, or embedded asset;
- a filename, absolute path, hostname, embedded author/company metadata, slide
  text, notes, comments, template identifier, or private shape/creation ID;
- a raw error, diff, manifest, XML fragment, hash list, or log that could reveal
  private content or local paths;
- a test baseline that makes the private fixture necessary to reproduce a
  public claim.

Private input hashes remain in ignored local evidence only. Public reports use
an opaque fixture class and redacted feature counts where disclosure is
approved.

## Public CI boundary

Public CI uses only fixtures generated from repository-owned, text-only OOXML
parts. It does not call a model, desktop GUI, private storage, or self-hosted
runner with private data.

A self-hosted PowerPoint job, if later added, must be manually dispatched from
trusted code, have no publication credentials, reject pull-request code, and
upload only preapproved redacted evidence. Private inputs and visual artifacts
remain local.

## Evidentiary meaning

A private fixture can identify a compatibility defect or support a narrowly
scoped compatibility statement. It cannot substitute for the public fixture,
prove public reproducibility, or authorize a broader support claim. Passing one
private template never means arbitrary templates are supported.
