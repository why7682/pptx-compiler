#!/usr/bin/env node

import { constants as fsConstants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import path from "node:path";

import {
  ALPHA_RELEASE_LOCK_PATH,
  ALPHA_RELEASE_TAG_NAME,
  alphaReleaseRepositoryRoot,
  deriveAlphaPublicationOrder,
  inspectAlphaReleaseCandidateSnapshot,
  validateAlphaReleaseLock,
  validateAlphaReleasePlan,
  validateAlphaReviewedTarballs
} from "./lib/alpha-release.mjs";
import { validateAlphaPackagePlan } from "./lib/package-plan.mjs";
import { reviewedStageComplete } from "./lib/package-stage.mjs";

const root = alphaReleaseRepositoryRoot();
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const EXPECTED_ARGUMENTS = Object.freeze([
  "--mode",
  "release-tag",
  "--tag",
  ALPHA_RELEASE_TAG_NAME,
  "--stage-root",
  ".package-stage/reviewed"
]);

function sameStat(left, right) {
  return left.dev === right.dev && left.ino === right.ino &&
    left.size === right.size && left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

async function stableRead(absolutePath) {
  let handle;
  try {
    handle = await open(
      absolutePath,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)
    );
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size < 1n || before.size > BigInt(MAX_INPUT_BYTES)) {
      throw new Error("release-input-file");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (!sameStat(before, after) || bytes.length !== Number(before.size)) {
      throw new Error("release-input-changed");
    }
    return bytes;
  } finally {
    await handle?.close();
  }
}

function emitFailure(code, pointer = "", exitCode = 1) {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    gate: "alpha-release-preparation",
    ok: false,
    findings: [{ code, pointer }]
  })}\n`);
  process.exitCode = exitCode;
}

function parseArguments(argv) {
  if (argv.length !== EXPECTED_ARGUMENTS.length ||
      argv.some((value, index) => value !== EXPECTED_ARGUMENTS[index])) {
    throw new Error("alpha-release-preparation-usage");
  }
  return Object.freeze({
    mode: "release-tag",
    tagName: ALPHA_RELEASE_TAG_NAME,
    stageRelative: ".package-stage/reviewed"
  });
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch {
  emitFailure("release-preparation-usage", "", 2);
}

if (options !== undefined) {
  let candidateSnapshot;
  try {
    candidateSnapshot = await inspectAlphaReleaseCandidateSnapshot({
      root,
      tagName: options.tagName,
      environment: process.env
    });
  } catch {
    emitFailure("release-control-unreadable", `/${ALPHA_RELEASE_LOCK_PATH}`);
  }

  if (candidateSnapshot !== undefined) {
    const {
      releasePlan,
      packagePlan,
      releaseLock,
      inputBytes
    } = candidateSnapshot;
    const findings = [
      ...(await validateAlphaPackagePlan(packagePlan, { root })),
      ...validateAlphaReleasePlan(releasePlan, { packagePlan }),
      ...validateAlphaReleaseLock(releaseLock, { releasePlan, packagePlan, inputBytes })
    ];
    if (findings.length !== 0) {
      process.stdout.write(`${JSON.stringify({
        schemaVersion: 1,
        gate: "alpha-release-preparation",
        ok: false,
        findings
      })}\n`);
      process.exitCode = 1;
    } else {
      const reviewed = path.join(root, ...options.stageRelative.split("/"));
      let releaseTag;
      let packageEvidence;
      let tarballBytes;
      try {
        if (await realpath(reviewed) !== reviewed ||
            !(await reviewedStageComplete(reviewed, packagePlan))) {
          throw new Error("release-reviewed-stage");
        }
        releaseTag = candidateSnapshot.releaseTag;
        const evidenceBytes = await stableRead(path.join(reviewed, "package-evidence.json"));
        packageEvidence = JSON.parse(new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true
        }).decode(evidenceBytes));
        tarballBytes = new Map(await Promise.all(
          deriveAlphaPublicationOrder(packagePlan).map(async (entry) => [
            entry.packageId,
            await stableRead(path.join(reviewed, "tarballs", entry.tarball))
          ])
        ));
      } catch {
        emitFailure("release-tag-stage-invalid", "/stage-root");
      }
      if (releaseTag !== undefined && packageEvidence !== undefined &&
          tarballBytes !== undefined) {
        const reviewedFindings = validateAlphaReviewedTarballs({
          releaseLock,
          packagePlan,
          packageEvidence,
          tarballBytes
        });
        if (reviewedFindings.length !== 0) {
          process.stdout.write(`${JSON.stringify({
            schemaVersion: 1,
            gate: "alpha-release-preparation",
            ok: false,
            findings: reviewedFindings
          })}\n`);
          process.exitCode = 1;
        } else {
          process.stdout.write(
            "PASS alpha-release-preparation: exact tag, 4 reviewed package(s), 2 builder(s), 6 locked input(s)\n"
          );
        }
      }
    }
  }
}
