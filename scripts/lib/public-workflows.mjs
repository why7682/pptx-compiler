const CHECKOUT_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";
const SETUP_NODE_SHA = "820762786026740c76f36085b0efc47a31fe5020";
const CODEQL_SHA = "5595ccaf912efad79be6eef63a5619ff05969be3";
const DEPENDENCY_REVIEW_SHA = "a1d282b36b6f3519aa1f3fc636f609c47dddb294";

export const ALPHA_RELEASE_TAG = "v0.1.0-alpha.1";
export const ALPHA_RELEASE_ENVIRONMENT = "npm-release";
export const ALPHA_RELEASE_PREPARATION_COMMAND =
  `node scripts/check-alpha-release-preparation.mjs --mode release-tag --tag ${ALPHA_RELEASE_TAG} --stage-root .package-stage/reviewed`;
export const ALPHA_RELEASE_SOURCE_VERIFICATION_COMMAND =
  `node scripts/publish-alpha-release.mjs --mode verify-source --tag ${ALPHA_RELEASE_TAG} --stage-root .package-stage/reviewed`;
export const ALPHA_RELEASE_PUBLISH_COMMAND =
  `node scripts/publish-alpha-release.mjs --mode publish --tag ${ALPHA_RELEASE_TAG} --stage-root .package-stage/reviewed`;
export const ALPHA_GITHUB_RELEASE_COMMAND =
  `node scripts/create-alpha-github-release.mjs --tag ${ALPHA_RELEASE_TAG} --stage-root .package-stage/reviewed`;
export const ALPHA_RELEASE_RUNTIME_COMMAND =
  "test \"$(node --version)\" = \"v24.19.0\" && test \"$(npm --version)\" = \"11.17.0\"";
export const PUBLIC_MAIN_HISTORY_CONDITION =
  "github.event_name == 'push' && github.ref == 'refs/heads/main'";
export const PUBLIC_IDENTITY_ANCHOR_COMMIT =
  "16ff7331195842c6a427db1a855862bc0f007786";
export const PUBLIC_MAIN_IDENTITY_COMMAND =
  `git config --local user.name "$(git --no-replace-objects show -s --format=%an ${PUBLIC_IDENTITY_ANCHOR_COMMIT})" && git config --local user.email "$(git --no-replace-objects show -s --format=%ae ${PUBLIC_IDENTITY_ANCHOR_COMMIT})"`;
export const PUBLIC_MAIN_HISTORY_COMMAND =
  "node scripts/check-forbidden-materials.mjs --mode history";
export const REQUIRED_RELEASE_ENTRY_PATHS = Object.freeze([
  "scripts/check-alpha-release-preparation.mjs",
  "scripts/create-alpha-github-release.mjs",
  "scripts/publish-alpha-release.mjs"
]);

export const PUBLIC_WORKFLOW_PINS = Object.freeze({
  checkout: Object.freeze({ version: "v7.0.1", sha: CHECKOUT_SHA }),
  setupNode: Object.freeze({ version: "v7.0.0", sha: SETUP_NODE_SHA }),
  codeql: Object.freeze({ version: "v4.37.6", sha: CODEQL_SHA }),
  dependencyReview: Object.freeze({ version: "v5.0.0", sha: DEPENDENCY_REVIEW_SHA })
});

export const EXPECTED_PUBLIC_SCRIPTS = Object.freeze({
  cli: "node scripts/pptx-compiler.mjs",
  test: "node --test \"tests/*.test.mjs\"",
  typecheck: "tsc --project tsconfig.public.json",
  lint: "node scripts/check-source-policy.mjs && node scripts/check-package-plan.mjs",
  "generate:fixtures": "node scripts/generate-synthetic-fixtures.mjs --output-dir fixtures/generated",
  "inspect:synthetic": "node scripts/inspect-synthetic-fixture.mjs",
  "compat:ordered-powerpoint": "node scripts/run-ordered-powerpoint-compatibility.mjs --trusted-local-run",
  "evidence:mixed-same-candidate": "node scripts/run-mixed-same-candidate-delivery.mjs --trusted-local-run",
  "render:p3": "node scripts/render-controlled-comparison.mjs",
  "generate:contract-types": "node scripts/check-contracts.mjs --write-types",
  "check:forbidden": "node scripts/check-forbidden-materials.mjs --mode index",
  "check:provenance": "node scripts/check-provenance.mjs --mode index",
  "check:support-matrix": "node scripts/check-support-matrix.mjs --mode index",
  "check:contracts": "node scripts/check-contracts.mjs --mode index",
  "check:package-plan": "node scripts/check-package-plan.mjs",
  "check:public-workflows": "node scripts/check-public-workflows.mjs",
  "check:release-metadata": "node scripts/check-release-metadata.mjs",
  "build:alpha-packages": "node scripts/build-alpha-packages.mjs",
  "check:public-tree": "npm run check:forbidden && npm run check:provenance && npm run check:support-matrix && npm run check:contracts",
  "check:working-tree": "node scripts/check-forbidden-materials.mjs --mode working-tree && node scripts/check-provenance.mjs --mode working-tree && node scripts/check-support-matrix.mjs --mode working-tree && node scripts/check-contracts.mjs --mode working-tree",
});

export const REQUIRED_PUBLIC_SCRIPTS = Object.freeze(
  Object.keys(EXPECTED_PUBLIC_SCRIPTS)
);

const CI_WORKFLOW = `name: Public CI

on:
  push:
    branches: [main]
    tags: [${ALPHA_RELEASE_TAG}]
  pull_request:

permissions:
  contents: read

jobs:
  portable:
    name: \${{ matrix.os }} / Node \${{ matrix.node }}
    runs-on: \${{ matrix.os }}
    timeout-minutes: 45
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-24.04, windows-2025, macos-15]
        node: [22, 24]
    steps:
      - name: Checkout without persistent credentials
        uses: actions/checkout@${CHECKOUT_SHA} # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - name: Select supported Node runtime
        uses: actions/setup-node@${SETUP_NODE_SHA} # v7.0.0
        with:
          node-version: \${{ matrix.node }}
          package-manager-cache: false
      - name: Admit workflow policy before dependency installation
        run: node scripts/check-public-workflows.mjs
      - name: Reject forbidden material before dependency installation
        run: node scripts/check-forbidden-materials.mjs --mode working-tree
      - name: Restore the approved public Git identity from immutable history
        if: ${PUBLIC_MAIN_HISTORY_CONDITION}
        run: ${PUBLIC_MAIN_IDENTITY_COMMAND}
      - name: Scan the complete accepted-main history
        if: ${PUBLIC_MAIN_HISTORY_CONDITION}
        run: ${PUBLIC_MAIN_HISTORY_COMMAND}
      - name: Bind lock, license, declarations, and static-ESM SBOM before installation
        run: node scripts/check-release-metadata.mjs
      - name: Install the fixed development toolchain
        run: npm ci --ignore-scripts --no-audit --no-fund
      - name: Typecheck the published declarations
        run: node node_modules/typescript/bin/tsc --project tsconfig.public.json
      - name: Check source and package import policy
        run: node scripts/check-source-policy.mjs
      - name: Check package plan
        run: node scripts/check-package-plan.mjs
      - name: Run the complete test suite
        run: node --test "tests/*.test.mjs"
      - name: Build and smoke the guarded alpha tarballs
        run: node scripts/build-alpha-packages.mjs
      - name: Recheck the admitted working tree
        run: node scripts/check-forbidden-materials.mjs --mode working-tree && node scripts/check-provenance.mjs --mode working-tree && node scripts/check-support-matrix.mjs --mode working-tree && node scripts/check-contracts.mjs --mode working-tree
      - name: Reject tracked-file drift
        run: git diff --exit-code
`;

const SECURITY_WORKFLOW = `name: Security

on:
  push:
    branches: [main]
    tags: [${ALPHA_RELEASE_TAG}]
  pull_request:
  schedule:
    - cron: "31 4 * * 1"

permissions:
  contents: read

jobs:
  codeql:
    if: \${{ github.event_name != 'pull_request' }}
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    permissions:
      contents: read
      security-events: write
    steps:
      - name: Checkout without persistent credentials
        uses: actions/checkout@${CHECKOUT_SHA} # v7.0.1
        with:
          persist-credentials: false
      - name: Initialize CodeQL without building or executing the project
        uses: github/codeql-action/init@${CODEQL_SHA} # v4.37.6
        with:
          languages: javascript-typescript
          build-mode: none
      - name: Analyze
        uses: github/codeql-action/analyze@${CODEQL_SHA} # v4.37.6

  dependency-review:
    if: \${{ github.event_name == 'pull_request' }}
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    permissions:
      contents: read
    steps:
      - name: Review dependency changes
        uses: actions/dependency-review-action@${DEPENDENCY_REVIEW_SHA} # v5.0.0
`;

const ALPHA_RELEASE_WORKFLOW = `name: Alpha npm Release

on:
  workflow_dispatch:
    inputs:
      tag:
        description: Exact annotated tag to publish
        required: true
        type: choice
        options:
          - ${ALPHA_RELEASE_TAG}

permissions:
  contents: read

concurrency:
  group: alpha-release-${ALPHA_RELEASE_TAG}
  cancel-in-progress: false

jobs:
  admit:
    name: Admit exact release tag
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    permissions:
      contents: read
    steps:
      - name: Require the exact manual tag ref
        env:
          EXPECTED_TAG: ${ALPHA_RELEASE_TAG}
          RELEASE_EVENT: \${{ github.event_name }}
          RELEASE_REF_TYPE: \${{ github.ref_type }}
          RELEASE_REF_NAME: \${{ github.ref_name }}
          RELEASE_INPUT_TAG: \${{ inputs.tag }}
        run: test "$RELEASE_EVENT" = "workflow_dispatch" && test "$RELEASE_REF_TYPE" = "tag" && test "$RELEASE_REF_NAME" = "$EXPECTED_TAG" && test "$RELEASE_INPUT_TAG" = "$EXPECTED_TAG"

  publish:
    name: Publish reviewed alpha tarballs
    needs: admit
    runs-on: ubuntu-24.04
    timeout-minutes: 60
    environment: ${ALPHA_RELEASE_ENVIRONMENT}
    permissions:
      actions: read
      contents: read
      id-token: write
    steps:
      - name: Checkout the dispatched tag commit without persistent credentials
        uses: actions/checkout@${CHECKOUT_SHA} # v7.0.1
        with:
          ref: \${{ github.sha }}
          fetch-depth: 0
          persist-credentials: false
      - name: Select the fixed release runtime and official registry
        uses: actions/setup-node@${SETUP_NODE_SHA} # v7.0.0
        with:
          node-version: 24.19.0
          registry-url: https://registry.npmjs.org/
          package-manager-cache: false
      - name: Reject release runtime or npm drift
        run: ${ALPHA_RELEASE_RUNTIME_COMMAND}
      - name: Require the release entry points to exist and parse
        run: node --check scripts/check-alpha-release-preparation.mjs && node --check scripts/publish-alpha-release.mjs
      - name: Admit workflow policy before dependency installation
        run: node scripts/check-public-workflows.mjs
      - name: Reject forbidden material before dependency installation
        run: node scripts/check-forbidden-materials.mjs --mode working-tree
      - name: Bind lock, license, declarations, and static-ESM SBOM before installation
        run: node scripts/check-release-metadata.mjs
      - name: Install the fixed development toolchain
        run: npm ci --ignore-scripts --no-audit --no-fund
      - name: Typecheck the published declarations
        run: node node_modules/typescript/bin/tsc --project tsconfig.public.json
      - name: Check source and package import policy
        run: node scripts/check-source-policy.mjs
      - name: Check package plan
        run: node scripts/check-package-plan.mjs
      - name: Run the complete test suite
        run: node --test "tests/*.test.mjs"
      - name: Build and smoke the reviewed alpha tarballs
        run: node scripts/build-alpha-packages.mjs
      - name: Recheck the admitted working tree
        run: node scripts/check-forbidden-materials.mjs --mode working-tree && node scripts/check-provenance.mjs --mode working-tree && node scripts/check-support-matrix.mjs --mode working-tree && node scripts/check-contracts.mjs --mode working-tree
      - name: Reject tracked-file drift
        run: git diff --exit-code
      - name: Bind the exact tag to the reviewed release candidate
        run: ${ALPHA_RELEASE_PREPARATION_COMMAND}
      - name: Verify the exact public GitHub source commit
        run: ${ALPHA_RELEASE_SOURCE_VERIFICATION_COMMAND}
        env:
          GITHUB_TOKEN: \${{ github.token }}
      - name: Publish exact reviewed tarballs to npm
        run: ${ALPHA_RELEASE_PUBLISH_COMMAND}
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
          NPM_CONFIG_REGISTRY: https://registry.npmjs.org/
          NPM_CONFIG_TAG: alpha
          NPM_CONFIG_ACCESS: public
          NPM_CONFIG_PROVENANCE: "true"

  declare:
    name: Declare the exact GitHub prerelease last
    needs: publish
    runs-on: ubuntu-24.04
    timeout-minutes: 60
    permissions:
      actions: read
      contents: write
    steps:
      - name: Checkout the dispatched tag commit without persistent credentials
        uses: actions/checkout@${CHECKOUT_SHA} # v7.0.1
        with:
          ref: \${{ github.sha }}
          fetch-depth: 0
          persist-credentials: false
      - name: Select the fixed release runtime without npm credentials
        uses: actions/setup-node@${SETUP_NODE_SHA} # v7.0.0
        with:
          node-version: 24.19.0
          package-manager-cache: false
      - name: Reject release runtime or npm drift
        run: ${ALPHA_RELEASE_RUNTIME_COMMAND}
      - name: Require every release entry point to exist and parse
        run: node --check scripts/check-alpha-release-preparation.mjs && node --check scripts/publish-alpha-release.mjs && node --check scripts/create-alpha-github-release.mjs
      - name: Admit workflow policy before dependency installation
        run: node scripts/check-public-workflows.mjs
      - name: Reject forbidden material before dependency installation
        run: node scripts/check-forbidden-materials.mjs --mode working-tree
      - name: Bind lock, license, declarations, and static-ESM SBOM before installation
        run: node scripts/check-release-metadata.mjs
      - name: Install the fixed development toolchain without credentials
        run: npm ci --ignore-scripts --no-audit --no-fund
      - name: Typecheck the published declarations
        run: node node_modules/typescript/bin/tsc --project tsconfig.public.json
      - name: Check source and package import policy
        run: node scripts/check-source-policy.mjs
      - name: Check package plan
        run: node scripts/check-package-plan.mjs
      - name: Run the complete test suite
        run: node --test "tests/*.test.mjs"
      - name: Rebuild and smoke the exact reviewed alpha tarballs
        run: node scripts/build-alpha-packages.mjs
      - name: Recheck the admitted working tree
        run: node scripts/check-forbidden-materials.mjs --mode working-tree && node scripts/check-provenance.mjs --mode working-tree && node scripts/check-support-matrix.mjs --mode working-tree && node scripts/check-contracts.mjs --mode working-tree
      - name: Reject tracked-file drift
        run: git diff --exit-code
      - name: Bind the exact tag to the reviewed release candidate
        run: ${ALPHA_RELEASE_PREPARATION_COMMAND}
      - name: Verify npm completion and declare the exact GitHub prerelease
        run: ${ALPHA_GITHUB_RELEASE_COMMAND}
        env:
          GITHUB_TOKEN: \${{ github.token }}
`;

const EXPECTED_ACTIONS = Object.freeze({
  ".github/workflows/ci.yml": Object.freeze([
    `actions/checkout@${CHECKOUT_SHA}`,
    `actions/setup-node@${SETUP_NODE_SHA}`
  ]),
  ".github/workflows/security.yml": Object.freeze([
    `actions/checkout@${CHECKOUT_SHA}`,
    `github/codeql-action/init@${CODEQL_SHA}`,
    `github/codeql-action/analyze@${CODEQL_SHA}`,
    `actions/dependency-review-action@${DEPENDENCY_REVIEW_SHA}`
  ]),
  ".github/workflows/alpha-release.yml": Object.freeze([
    `actions/checkout@${CHECKOUT_SHA}`,
    `actions/setup-node@${SETUP_NODE_SHA}`,
    `actions/checkout@${CHECKOUT_SHA}`,
    `actions/setup-node@${SETUP_NODE_SHA}`
  ])
});

const EXPECTED_RUNS = Object.freeze({
  ".github/workflows/ci.yml": Object.freeze([
    "node scripts/check-public-workflows.mjs",
    "node scripts/check-forbidden-materials.mjs --mode working-tree",
    PUBLIC_MAIN_IDENTITY_COMMAND,
    PUBLIC_MAIN_HISTORY_COMMAND,
    "node scripts/check-release-metadata.mjs",
    "npm ci --ignore-scripts --no-audit --no-fund",
    "node node_modules/typescript/bin/tsc --project tsconfig.public.json",
    "node scripts/check-source-policy.mjs",
    "node scripts/check-package-plan.mjs",
    "node --test \"tests/*.test.mjs\"",
    "node scripts/build-alpha-packages.mjs",
    "node scripts/check-forbidden-materials.mjs --mode working-tree && node scripts/check-provenance.mjs --mode working-tree && node scripts/check-support-matrix.mjs --mode working-tree && node scripts/check-contracts.mjs --mode working-tree",
    "git diff --exit-code"
  ]),
  ".github/workflows/security.yml": Object.freeze([]),
  ".github/workflows/alpha-release.yml": Object.freeze([
    "test \"$RELEASE_EVENT\" = \"workflow_dispatch\" && test \"$RELEASE_REF_TYPE\" = \"tag\" && test \"$RELEASE_REF_NAME\" = \"$EXPECTED_TAG\" && test \"$RELEASE_INPUT_TAG\" = \"$EXPECTED_TAG\"",
    ALPHA_RELEASE_RUNTIME_COMMAND,
    "node --check scripts/check-alpha-release-preparation.mjs && node --check scripts/publish-alpha-release.mjs",
    "node scripts/check-public-workflows.mjs",
    "node scripts/check-forbidden-materials.mjs --mode working-tree",
    "node scripts/check-release-metadata.mjs",
    "npm ci --ignore-scripts --no-audit --no-fund",
    "node node_modules/typescript/bin/tsc --project tsconfig.public.json",
    "node scripts/check-source-policy.mjs",
    "node scripts/check-package-plan.mjs",
    "node --test \"tests/*.test.mjs\"",
    "node scripts/build-alpha-packages.mjs",
    "node scripts/check-forbidden-materials.mjs --mode working-tree && node scripts/check-provenance.mjs --mode working-tree && node scripts/check-support-matrix.mjs --mode working-tree && node scripts/check-contracts.mjs --mode working-tree",
    "git diff --exit-code",
    ALPHA_RELEASE_PREPARATION_COMMAND,
    ALPHA_RELEASE_SOURCE_VERIFICATION_COMMAND,
    ALPHA_RELEASE_PUBLISH_COMMAND,
    ALPHA_RELEASE_RUNTIME_COMMAND,
    "node --check scripts/check-alpha-release-preparation.mjs && node --check scripts/publish-alpha-release.mjs && node --check scripts/create-alpha-github-release.mjs",
    "node scripts/check-public-workflows.mjs",
    "node scripts/check-forbidden-materials.mjs --mode working-tree",
    "node scripts/check-release-metadata.mjs",
    "npm ci --ignore-scripts --no-audit --no-fund",
    "node node_modules/typescript/bin/tsc --project tsconfig.public.json",
    "node scripts/check-source-policy.mjs",
    "node scripts/check-package-plan.mjs",
    "node --test \"tests/*.test.mjs\"",
    "node scripts/build-alpha-packages.mjs",
    "node scripts/check-forbidden-materials.mjs --mode working-tree && node scripts/check-provenance.mjs --mode working-tree && node scripts/check-support-matrix.mjs --mode working-tree && node scripts/check-contracts.mjs --mode working-tree",
    "git diff --exit-code",
    ALPHA_RELEASE_PREPARATION_COMMAND,
    ALPHA_GITHUB_RELEASE_COMMAND
  ])
});

const ORDINARY_FORBIDDEN = Object.freeze([
  ["workflow-dangerous-trigger", /\b(?:pull_request_target|workflow_run|repository_dispatch|workflow_call)\b/u],
  ["workflow-self-hosted", /\bself-hosted\b/u],
  ["workflow-floating-runner", /\b(?:ubuntu|windows|macos)-latest\b/u],
  ["workflow-secret", /(?:secrets[.]|\benvironment\s*:)/u],
  ["workflow-soft-failure", /\bcontinue-on-error\s*:/u],
  ["workflow-artifact-or-cache", /(?:upload-artifact|download-artifact|\/cache@|^\s*cache\s*:)/mu],
  ["workflow-publication", /(?:npm\s+publish|git\s+push|\bid-token\s*:\s*write)/u],
  ["workflow-private-tool", /(?:PowerPoint|osascript|pandoc|trusted-local-run|model|private-fixture)/iu],
  ["workflow-network-command", /(?:\bcurl\b|\bwget\b|\bnpx\b)/u],
  ["workflow-broad-write", /(?:contents|actions|packages|pull-requests)\s*:\s*write/u]
]);

const RELEASE_FORBIDDEN = Object.freeze([
  ["workflow-dangerous-trigger", /\b(?:push|pull_request(?:_target)?|workflow_run|repository_dispatch|workflow_call|release|schedule)\s*:/u],
  ["workflow-self-hosted", /\bself-hosted\b/u],
  ["workflow-floating-runner", /\b(?:ubuntu|windows|macos)-latest\b/u],
  ["workflow-soft-failure", /\bcontinue-on-error\s*:/u],
  ["workflow-artifact-or-cache", /(?:upload-artifact|download-artifact|\/cache@|^\s*cache\s*:)/mu],
  ["workflow-private-tool", /(?:PowerPoint|osascript|pandoc|trusted-local-run|model|private-fixture)/iu],
  ["workflow-network-command", /(?:\bcurl\b|\bwget\b|\bnpx\b)/u],
  ["workflow-broad-write", /(?:actions|packages|pull-requests|security-events)\s*:\s*write/u],
  ["workflow-github-release", /(?:\bgh\s+release\b|action-gh-release|create-release|upload-release-asset)/iu],
  ["workflow-source-mutation", /(?:\bgit\s+push\b|\bgit\s+tag\b|\bnpm\s+version\b)/u]
]);

function finding(code, pointer) {
  return Object.freeze({ code, pointer });
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function usesOf(text) {
  return [...text.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gmu)]
    .map((match) => match[1]);
}

function runsOf(text) {
  return [...text.matchAll(/^\s*-?\s*run:\s*(\S.*)$/gmu)]
    .map((match) => match[1]);
}

function conditionsOf(text) {
  return [...text.matchAll(/^\s*if:\s*(\S.*)$/gmu)]
    .map((match) => match[1]);
}

export function renderPublicWorkflows() {
  return new Map([
    [".github/workflows/ci.yml", CI_WORKFLOW],
    [".github/workflows/security.yml", SECURITY_WORKFLOW],
    [".github/workflows/alpha-release.yml", ALPHA_RELEASE_WORKFLOW]
  ]);
}

export function inspectPublicWorkflowText(relativePath, text) {
  const findings = [];
  if (typeof text !== "string" || !Object.hasOwn(EXPECTED_ACTIONS, relativePath)) {
    return Object.freeze([finding("workflow-input", relativePath)]);
  }
  const releaseWorkflow = relativePath === ".github/workflows/alpha-release.yml";
  for (const [code, expression] of releaseWorkflow
    ? RELEASE_FORBIDDEN
    : ORDINARY_FORBIDDEN) {
    if (expression.test(text)) findings.push(finding(code, relativePath));
  }
  const actualUses = usesOf(text);
  if (actualUses.some((value) => !/@[0-9a-f]{40}$/u.test(value)) ||
      actualUses.length !== EXPECTED_ACTIONS[relativePath].length ||
      actualUses.some((value, index) => value !== EXPECTED_ACTIONS[relativePath][index])) {
    findings.push(finding("workflow-action-pin", relativePath));
  }
  const actualRuns = runsOf(text);
  if (actualRuns.length !== EXPECTED_RUNS[relativePath].length ||
      actualRuns.some((value, index) => value !== EXPECTED_RUNS[relativePath][index])) {
    findings.push(finding("workflow-command", relativePath));
  }
  const checkoutCount = actualUses.filter((value) => value.startsWith("actions/checkout@")).length;
  const credentialCount = (text.match(/^\s*persist-credentials:\s*false\s*$/gmu) ?? []).length;
  if (checkoutCount !== credentialCount) {
    findings.push(finding("workflow-checkout-credentials", relativePath));
  }
  if (!text.includes("permissions:\n  contents: read\n")) {
    findings.push(finding("workflow-default-permission", relativePath));
  }
  if (relativePath === ".github/workflows/ci.yml") {
    const identityBoundary =
      "      - name: Restore the approved public Git identity from immutable history\n" +
      `        if: ${PUBLIC_MAIN_HISTORY_CONDITION}\n` +
      `        run: ${PUBLIC_MAIN_IDENTITY_COMMAND}\n`;
    const historyBoundary =
      "      - name: Scan the complete accepted-main history\n" +
      `        if: ${PUBLIC_MAIN_HISTORY_CONDITION}\n` +
      `        run: ${PUBLIC_MAIN_HISTORY_COMMAND}\n`;
    const checkoutBoundary =
      `        uses: actions/checkout@${CHECKOUT_SHA} # v7.0.1\n` +
      "        with:\n" +
      "          fetch-depth: 0\n" +
      "          persist-credentials: false\n";
    const conditions = conditionsOf(text);
    if (!text.includes("os: [ubuntu-24.04, windows-2025, macos-15]") ||
        !text.includes("node: [22, 24]") ||
        !text.includes("fail-fast: false") ||
        !text.includes("package-manager-cache: false") ||
        !text.includes(`tags: [${ALPHA_RELEASE_TAG}]`) ||
        text.includes("security-events: write")) {
      findings.push(finding("workflow-portable-matrix", relativePath));
    }
    if (!text.includes(checkoutBoundary) || !text.includes(identityBoundary) ||
        !text.includes(historyBoundary) || conditions.length !== 2 ||
        conditions.some((condition) => condition !== PUBLIC_MAIN_HISTORY_CONDITION)) {
      findings.push(finding("workflow-main-history-scope", relativePath));
    }
  } else if (relativePath === ".github/workflows/security.yml") {
    const securityWrites = (text.match(/^\s*security-events:\s*write\s*$/gmu) ?? []).length;
    if (securityWrites !== 1 || !text.includes("build-mode: none") ||
        !text.includes(`tags: [${ALPHA_RELEASE_TAG}]`) ||
        !text.includes("github.event_name != 'pull_request'") ||
        !text.includes("github.event_name == 'pull_request'")) {
      findings.push(finding("workflow-security-scope", relativePath));
    }
  } else {
    const oidcWrites = (text.match(/^\s*id-token:\s*write\s*$/gmu) ?? []).length;
    const environmentUses = (text.match(/^\s*environment:\s*npm-release\s*$/gmu) ?? []).length;
    const tokenUses = (text.match(/\$\{\{ secrets[.]NPM_TOKEN \}\}/gu) ?? []).length;
    const secretUses = (text.match(/\$\{\{\s*secrets[.]/gu) ?? []).length;
    const githubTokenUses = (text.match(/\$\{\{ github[.]token \}\}/gu) ?? []).length;
    const contentsWrites = (text.match(/^\s*contents:\s*write\s*$/gmu) ?? []).length;
    const workflowDispatches = (text.match(/^\s*workflow_dispatch:\s*$/gmu) ?? []).length;
    const publishAuthorityBoundary =
      `    environment: ${ALPHA_RELEASE_ENVIRONMENT}\n` +
      "    permissions:\n" +
      "      actions: read\n" +
      "      contents: read\n" +
      "      id-token: write\n";
    if (workflowDispatches !== 1 ||
        !text.includes(`type: choice\n        options:\n          - ${ALPHA_RELEASE_TAG}`) ||
        !text.includes("RELEASE_REF_TYPE: ${{ github.ref_type }}") ||
        !text.includes("RELEASE_REF_NAME: ${{ github.ref_name }}") ||
        !text.includes("RELEASE_INPUT_TAG: ${{ inputs.tag }}")) {
      findings.push(finding("workflow-release-trigger", relativePath));
    }
    const publishSecretBoundary = `        run: ${ALPHA_RELEASE_PUBLISH_COMMAND}\n` +
      "        env:\n" +
      "          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\n" +
      "          NPM_CONFIG_REGISTRY: https://registry.npmjs.org/\n" +
      "          NPM_CONFIG_TAG: alpha\n" +
      "          NPM_CONFIG_ACCESS: public\n" +
      "          NPM_CONFIG_PROVENANCE: \"true\"\n";
    const sourceVerificationBoundary =
      `        run: ${ALPHA_RELEASE_SOURCE_VERIFICATION_COMMAND}\n` +
      "        env:\n" +
      "          GITHUB_TOKEN: ${{ github.token }}\n";
    const declarationAuthorityBoundary =
      "  declare:\n" +
      "    name: Declare the exact GitHub prerelease last\n" +
      "    needs: publish\n" +
      "    runs-on: ubuntu-24.04\n" +
      "    timeout-minutes: 60\n" +
      "    permissions:\n" +
      "      actions: read\n" +
      "      contents: write\n";
    const declarationCredentialBoundary =
      `        run: ${ALPHA_GITHUB_RELEASE_COMMAND}\n` +
      "        env:\n" +
      "          GITHUB_TOKEN: ${{ github.token }}\n";
    const actionsReads = (text.match(/^\s*actions:\s*read\s*$/gmu) ?? []).length;
    const immutableCheckoutRefs = (text.match(/^\s*ref:\s*\$\{\{ github[.]sha \}\}\s*$/gmu) ?? []).length;
    const fullHistoryCheckouts = (text.match(/^\s*fetch-depth:\s*0\s*$/gmu) ?? []).length;
    const fixedRuntimeChecks = text.split(`run: ${ALPHA_RELEASE_RUNTIME_COMMAND}`).length - 1;
    if (oidcWrites !== 1 || actionsReads !== 2 || contentsWrites !== 1 ||
        environmentUses !== 1 || tokenUses !== 1 ||
        secretUses !== 1 || githubTokenUses !== 2 ||
        immutableCheckoutRefs !== 2 || fullHistoryCheckouts !== 2 ||
        fixedRuntimeChecks !== 2 ||
        !text.includes(sourceVerificationBoundary) ||
        !text.includes(publishSecretBoundary) ||
        !text.includes(declarationAuthorityBoundary) ||
        !text.includes(declarationCredentialBoundary) ||
        !text.includes(publishAuthorityBoundary) ||
        !text.includes("needs: admit") ||
        !text.includes("node-version: 24.19.0") ||
        !text.includes(`run: ${ALPHA_RELEASE_RUNTIME_COMMAND}`) ||
        !text.includes("registry-url: https://registry.npmjs.org/") ||
        !text.includes("ref: ${{ github.sha }}") ||
        !text.includes("fetch-depth: 0") ||
        !text.includes("NPM_CONFIG_REGISTRY: https://registry.npmjs.org/") ||
        !text.includes("NPM_CONFIG_TAG: alpha") ||
        !text.includes("NPM_CONFIG_ACCESS: public") ||
        !text.includes("NPM_CONFIG_PROVENANCE: \"true\"")) {
      findings.push(finding("workflow-release-scope", relativePath));
    }
  }
  if (!/^\s*timeout-minutes:\s*[1-9][0-9]*\s*$/mu.test(text)) {
    findings.push(finding("workflow-timeout", relativePath));
  }
  return Object.freeze(findings);
}

export function validatePublicWorkflowSet(files, packageScripts, releaseEntries) {
  const findings = [];
  if (!(files instanceof Map) || packageScripts === null ||
      typeof packageScripts !== "object" || Array.isArray(packageScripts) ||
      !(releaseEntries instanceof Map)) {
    return Object.freeze([finding("workflow-input", "")]);
  }
  const expected = renderPublicWorkflows();
  const actualPaths = [...files.keys()].sort(compareText);
  const expectedPaths = [...expected.keys()].sort(compareText);
  if (actualPaths.length !== expectedPaths.length ||
      actualPaths.some((value, index) => value !== expectedPaths[index])) {
    findings.push(finding("workflow-inventory", ".github/workflows"));
  }
  for (const [relativePath, expectedText] of expected) {
    const actualText = files.get(relativePath);
    findings.push(...inspectPublicWorkflowText(relativePath, actualText));
    if (actualText !== expectedText) findings.push(finding("workflow-byte-drift", relativePath));
  }
  const actualScriptNames = Object.keys(packageScripts).sort(compareText);
  const expectedScriptNames = [...REQUIRED_PUBLIC_SCRIPTS].sort(compareText);
  if (actualScriptNames.length !== expectedScriptNames.length ||
      actualScriptNames.some((name, index) => name !== expectedScriptNames[index])) {
    findings.push(finding("workflow-package-script", "/scripts"));
  }
  for (const name of REQUIRED_PUBLIC_SCRIPTS) {
    if (packageScripts[name] !== EXPECTED_PUBLIC_SCRIPTS[name]) {
      findings.push(finding("workflow-package-script", `/scripts/${name}`));
    }
    for (const hook of [`pre${name}`, `post${name}`]) {
      if (Object.hasOwn(packageScripts, hook)) {
        findings.push(finding("workflow-package-script", `/scripts/${hook}`));
      }
    }
  }
  const actualReleasePaths = [...releaseEntries.keys()].sort(compareText);
  const expectedReleasePaths = [...REQUIRED_RELEASE_ENTRY_PATHS].sort(compareText);
  if (actualReleasePaths.length !== expectedReleasePaths.length ||
      actualReleasePaths.some((value, index) => value !== expectedReleasePaths[index])) {
    findings.push(finding("workflow-release-entry", "/scripts"));
  }
  for (const relativePath of REQUIRED_RELEASE_ENTRY_PATHS) {
    const text = releaseEntries.get(relativePath);
    if (typeof text !== "string" || !text.startsWith("#!/usr/bin/env node\n") ||
        text.length > 128 * 1024) {
      findings.push(finding("workflow-release-entry", relativePath));
    }
  }
  return Object.freeze(findings);
}
