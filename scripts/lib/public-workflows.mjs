const CHECKOUT_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";
const SETUP_NODE_SHA = "820762786026740c76f36085b0efc47a31fe5020";
const CODEQL_SHA = "5595ccaf912efad79be6eef63a5619ff05969be3";
const DEPENDENCY_REVIEW_SHA = "a1d282b36b6f3519aa1f3fc636f609c47dddb294";

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
  ])
});

const EXPECTED_RUNS = Object.freeze({
  ".github/workflows/ci.yml": Object.freeze([
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
    "git diff --exit-code"
  ]),
  ".github/workflows/security.yml": Object.freeze([])
});

const FORBIDDEN = Object.freeze([
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

export function renderPublicWorkflows() {
  return new Map([
    [".github/workflows/ci.yml", CI_WORKFLOW],
    [".github/workflows/security.yml", SECURITY_WORKFLOW]
  ]);
}

export function inspectPublicWorkflowText(relativePath, text) {
  const findings = [];
  if (typeof text !== "string" || !Object.hasOwn(EXPECTED_ACTIONS, relativePath)) {
    return Object.freeze([finding("workflow-input", relativePath)]);
  }
  for (const [code, expression] of FORBIDDEN) {
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
  if (relativePath.endsWith("ci.yml")) {
    if (!text.includes("os: [ubuntu-24.04, windows-2025, macos-15]") ||
        !text.includes("node: [22, 24]") ||
        !text.includes("fail-fast: false") ||
        !text.includes("package-manager-cache: false") ||
        text.includes("security-events: write")) {
      findings.push(finding("workflow-portable-matrix", relativePath));
    }
  } else {
    const securityWrites = (text.match(/^\s*security-events:\s*write\s*$/gmu) ?? []).length;
    if (securityWrites !== 1 || !text.includes("build-mode: none") ||
        !text.includes("github.event_name != 'pull_request'") ||
        !text.includes("github.event_name == 'pull_request'")) {
      findings.push(finding("workflow-security-scope", relativePath));
    }
  }
  if (!/^\s*timeout-minutes:\s*[1-9][0-9]*\s*$/mu.test(text)) {
    findings.push(finding("workflow-timeout", relativePath));
  }
  return Object.freeze(findings);
}

export function validatePublicWorkflowSet(files, packageScripts) {
  const findings = [];
  if (!(files instanceof Map) || packageScripts === null ||
      typeof packageScripts !== "object" || Array.isArray(packageScripts)) {
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
  return Object.freeze(findings);
}
