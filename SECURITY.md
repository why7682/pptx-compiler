# Security Policy

## Report a vulnerability

Use GitHub private vulnerability reporting for this repository. Open the
repository's **Security** page, choose **Advisories**, and select
**Report a vulnerability**. Do not disclose a suspected vulnerability in a
public issue, discussion, pull request, or commit.

This is the project's only private reporting channel. Before any source branch
or ref is pushed to the public repository, the maintainer must enable private
vulnerability reporting and verify through GitHub's repository API that its
status is `enabled: true`. If **Report a vulnerability** is unavailable, do not
send vulnerability details through another public channel. A public issue may
state only that the private reporting channel is unavailable.

## What to include

Describe the affected version or commit, security impact, prerequisites, and a
minimal reproduction using repository-owned synthetic inputs where possible.
Do not attach private presentations, customer data, credentials, access tokens,
private templates, proprietary assets, or other secrets. Replace sensitive
facts with the smallest sanitized synthetic example that still demonstrates
the issue.

Appropriate reports include suspected path traversal, unsafe archive or XML
handling, unintended code or process execution, secret or private-material
exposure, and bypasses of create-only or release-integrity boundaries. Visual
quality, unsupported template features, compatibility requests, and ordinary
bugs belong in the normal contribution flow unless they create a concrete
security impact.

## Handling and disclosure

The maintainer will triage the report privately, may request a smaller
reproduction, and will coordinate disclosure when a fix or mitigation is ready.
This pre-alpha project promises no fixed response, fix, release, CVE, or support
timeline. A private report does not by itself establish support or release
authority; the repository's executable release gates remain controlling.
