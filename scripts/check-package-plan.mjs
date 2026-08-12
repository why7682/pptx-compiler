#!/usr/bin/env node

import {
  loadAlphaPackagePlan,
  packagePlanRepositoryRoot,
  validateAlphaPackagePlan
} from "./lib/package-plan.mjs";

const root = packagePlanRepositoryRoot();
let plan;
try {
  plan = await loadAlphaPackagePlan({ root });
} catch {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    gate: "package-plan",
    ok: false,
    findings: [{ code: "package-plan-unreadable", pointer: "" }]
  })}\n`);
  process.exitCode = 1;
}

if (plan !== undefined) {
  const findings = await validateAlphaPackagePlan(plan, { root });
  if (findings.length !== 0) {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      gate: "package-plan",
      ok: false,
      findings
    })}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("PASS package-plan: 4 guarded alpha package(s) checked\n");
  }
}
