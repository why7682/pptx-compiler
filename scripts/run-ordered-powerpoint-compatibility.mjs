import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createOrderedCandidateBuildRecord } from
  "../packages/core/src/candidate-build-record.mjs";
import { assembleCloneFillPresentation } from
  "../packages/core/src/create-only-assembly.mjs";
import {
  assembleOrderedSlideDeck,
  authenticateOrderedSlideAssemblyArtifact
} from "../packages/core/src/ordered-slide-assembly.mjs";
import { createOrderedPowerPointCompatibilityReceipt } from
  "../packages/powerpoint-macos/src/ordered-compatibility-receipt.mjs";
import { buildSyntheticFixtures } from "./generate-synthetic-fixtures.mjs";
import {
  createPublicMixedOrderedCandidate,
  createPublicMixedOrderedDocuments,
  createPublicMixedOrderedRuntime
} from "../tests/helpers/public-mixed-ordered-candidate.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const evidenceRoot = path.join(
  repositoryRoot,
  ".private-test-artifacts",
  "powerpoint-ordered"
);
const probeCarrierFileName = "ordered-compatibility-source.pptx";
const appleScriptPath = fileURLToPath(
  new URL("./validate-ordered-powerpoint.applescript", import.meta.url)
);
const candidateFileName = "ordered-compatibility-source.pptx";
const expectedSlides = Object.freeze([
  Object.freeze({
    slideId: "ordered-compatibility-one",
    title: "First ordered takeaway",
    body: "First bounded evidence statement"
  }),
  Object.freeze({
    slideId: "ordered-compatibility-two",
    title: "Second ordered takeaway",
    body: "Second bounded evidence statement"
  })
]);
const mixedExpectedSlides = Object.freeze([
  Object.freeze({
    slideId: "mixed-setup",
    texts: Object.freeze([
      "One decision, three inspectable signals",
      "Structure, editability, and visible stability"
    ])
  }),
  Object.freeze({
    slideId: "mixed-evidence",
    texts: Object.freeze(["A safe pilot needs three independent checks", " 3 3 "])
  }),
  Object.freeze({
    slideId: "mixed-resolution",
    texts: Object.freeze([
      "A safe pilot needs three independent checks",
      "Structure, editability, and visible stability"
    ])
  })
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneFillPlan(slide) {
  return deepFreeze({
    planVersion: "0.1.0",
    planType: "source-slide-clone-fill-plan",
    outputSlideId: slide.slideId,
    clone: {
      operationId: "clone-source-slide",
      operationType: "clone-slide",
      sourceContainerKind: "slide",
      sourceSlideKey: "slide-1"
    },
    fills: [
      {
        operationId: "fill-body",
        operationType: "replace-cloned-shape-text",
        role: "body",
        shapeBindingId: "ordered-compatibility-body-binding",
        sourceShapeKey: "shape-2",
        expectedKind: "text-box",
        paragraphs: [slide.body]
      },
      {
        operationId: "fill-title",
        operationType: "replace-cloned-shape-text",
        role: "title",
        shapeBindingId: "ordered-compatibility-title-binding",
        sourceShapeKey: "shape-1",
        expectedKind: "text-box",
        paragraphs: [slide.title]
      }
    ]
  });
}

async function loadTemplateIndex() {
  return deepFreeze(JSON.parse(await readFile(
    new URL("../fixtures/inspection/expected-potx-template-index.json", import.meta.url),
    "utf8"
  )));
}

export async function createPublicOrderedCompatibilityCandidate() {
  const [fixtureBuild, templateIndex] = await Promise.all([
    buildSyntheticFixtures(),
    loadTemplateIndex()
  ]);
  const source = fixtureBuild.archives.find((archive) => archive.variant === "potx");
  if (source === undefined) throw new Error("ORDERED_COMPATIBILITY_SOURCE_UNAVAILABLE");
  const oneSlideArtifacts = expectedSlides.map((slide) => assembleCloneFillPresentation({
    sourceArchiveBytes: source.bytes,
    templateIndex,
    plan: cloneFillPlan(slide)
  }));
  const ordered = assembleOrderedSlideDeck({
    slides: oneSlideArtifacts.map((artifact) => ({
      archiveBytes: artifact.archiveBytes,
      report: artifact.report
    }))
  });
  const authenticated = authenticateOrderedSlideAssemblyArtifact({
    archiveBytes: ordered.archiveBytes,
    report: ordered.report
  });
  const record = createOrderedCandidateBuildRecord({
    candidateBytes: ordered.archiveBytes,
    candidateFileName,
    baseArtifactSha256: authenticated.candidateRecordFacts.baseArtifactSha256,
    orderedDeck: {
      assemblyVersion: authenticated.candidateRecordFacts.assemblyVersion,
      slides: authenticated.candidateRecordFacts.slides,
      diff: authenticated.candidateRecordFacts.diff
    }
  });
  return Object.freeze({
    candidateBytes: Buffer.from(record.candidateBytes),
    candidateRecordBytes: Buffer.from(record.recordBytes),
    candidateSha256: record.record.output.sha256,
    candidateRecordSha256: record.recordSha256,
    candidateFileName,
    evidenceRecordId: "urn:pptx-compiler:compatibility:ordered-clone-fill-local-001",
    expectedSlides: Object.freeze(expectedSlides.map((slide) => Object.freeze({
      slideId: slide.slideId,
      texts: Object.freeze([slide.title, slide.body])
    })))
  });
}

export async function createPublicMixedOrderedCompatibilityCandidate() {
  const documents = await createPublicMixedOrderedDocuments();
  const runtime = await createPublicMixedOrderedRuntime(documents);
  const acceptGeneratedDocument = () => true;
  const candidate = await createPublicMixedOrderedCandidate({
    documents,
    runtime,
    candidateFileName: probeCarrierFileName,
    resolverDependencies: {
      validateCapabilityRegistry: acceptGeneratedDocument,
      validateDeckSpec: acceptGeneratedDocument,
      validateProjectOverlay: acceptGeneratedDocument,
      validateTemplateIndex: acceptGeneratedDocument
    }
  });
  return Object.freeze({
    candidateBytes: Buffer.from(candidate.candidateBytes),
    candidateRecordBytes: Buffer.from(candidate.candidateRecordBytes),
    candidateSha256: candidate.record.output.sha256,
    candidateRecordSha256: sha256(candidate.candidateRecordBytes),
    candidateFileName: candidate.candidateFileName,
    evidenceRecordId: "urn:pptx-compiler:compatibility:mixed-ordered-effect-local-001",
    expectedSlides: mixedExpectedSlides
  });
}

async function ensureStableDirectory() {
  await mkdir(evidenceRoot, { recursive: true, mode: 0o700 });
  const [metadata, canonical] = await Promise.all([lstat(evidenceRoot), realpath(evidenceRoot)]);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || canonical !== evidenceRoot) {
    throw new Error("ORDERED_COMPATIBILITY_EVIDENCE_ROOT_INVALID");
  }
}

async function writeExactOrReuse(filePath, bytes) {
  try {
    await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
    return "created";
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("ORDERED_COMPATIBILITY_STABLE_INPUT_INVALID");
  }
  const existing = await readFile(filePath);
  if (!existing.equals(bytes)) throw new Error("ORDERED_COMPATIBILITY_STABLE_INPUT_DRIFT");
  return "reused";
}

export async function writeStablePowerPointProbeCarrier(filePath, bytes) {
  let metadata;
  try {
    metadata = await lstat(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
    return "created";
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("ORDERED_COMPATIBILITY_PROBE_CARRIER_INVALID");
  }
  const existing = await readFile(filePath);
  if (existing.equals(bytes)) return "reused";

  const handle = await open(filePath, "r+");
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== metadata.dev || opened.ino !== metadata.ino) {
      throw new Error("ORDERED_COMPATIBILITY_PROBE_CARRIER_CHANGED");
    }
    await handle.truncate(0);
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  const after = await lstat(filePath);
  if (!after.isFile() || after.isSymbolicLink() || after.dev !== metadata.dev ||
      after.ino !== metadata.ino || !(await readFile(filePath)).equals(bytes)) {
    throw new Error("ORDERED_COMPATIBILITY_PROBE_CARRIER_CHANGED");
  }
  return "updated-in-place";
}

function runAppleScript(paths) {
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/osascript", [
      appleScriptPath,
      paths.candidate,
      paths.roundtrip,
      paths.beforePdf,
      paths.afterPdf
    ], {
      cwd: repositoryRoot,
      env: Object.fromEntries([
        "HOME",
        "LANG",
        "LC_ALL",
        "LOGNAME",
        "PATH",
        "TMPDIR",
        "USER"
      ].flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]])),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      settle(reject, new Error("ORDERED_COMPATIBILITY_POWERPOINT_TIMEOUT"));
    }, 60_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout, "utf8") > 64 * 1024) child.kill("SIGKILL");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (Buffer.byteLength(stderr, "utf8") > 64 * 1024) child.kill("SIGKILL");
    });
    child.once("error", (error) => {
      settle(reject, error);
    });
    child.once("close", (code) => {
      if (code !== 0 || stderr.length > 0 || stdout.length > 64 * 1024) {
        settle(reject, new Error("ORDERED_COMPATIBILITY_POWERPOINT_FAILED"));
        return;
      }
      settle(resolve, stdout);
    });
  });
}

function assertManualTrustedRun(values, environment) {
  if (values["trusted-local-run"] !== true) {
    throw new Error("ORDERED_COMPATIBILITY_EXPLICIT_TRUST_REQUIRED");
  }
  if (environment.CI || environment.GITHUB_ACTIONS || environment.GITHUB_EVENT_NAME ||
      environment.BUILD_BUILDID || environment.BUILDKITE) {
    throw new Error("ORDERED_COMPATIBILITY_CI_FORBIDDEN");
  }
}

export async function runOrderedPowerPointCompatibilityCli(
  argv = process.argv.slice(2),
  environment = process.env,
  dependencies = { runProbe: runAppleScript }
) {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: false,
    strict: true,
    options: {
      scenario: { type: "string", default: "clone-fill" },
      "trusted-local-run": { type: "boolean" }
    }
  });
  assertManualTrustedRun(parsed.values, environment);
  if (!new Set(["clone-fill", "mixed"]).has(parsed.values.scenario)) {
    throw new Error("ORDERED_COMPATIBILITY_SCENARIO_INVALID");
  }
  await ensureStableDirectory();
  const mixed = parsed.values.scenario === "mixed";
  const candidate = mixed
    ? await createPublicMixedOrderedCompatibilityCandidate()
    : await createPublicOrderedCompatibilityCandidate();
  const prefix = mixed ? "mixed-ordered-compatibility-effect" : "ordered-compatibility";
  const paths = Object.freeze({
    candidate: path.join(evidenceRoot, probeCarrierFileName),
    candidateRecord: path.join(evidenceRoot, `${prefix}-source.candidate.json`),
    roundtrip: path.join(evidenceRoot, `${prefix}-roundtrip.pptx`),
    beforePdf: path.join(evidenceRoot, `${prefix}-before.pdf`),
    afterPdf: path.join(evidenceRoot, `${prefix}-after.pdf`),
    evidence: path.join(evidenceRoot, `${prefix}-evidence.local.json`)
  });
  await Promise.all([
    writeStablePowerPointProbeCarrier(paths.candidate, candidate.candidateBytes),
    writeExactOrReuse(paths.candidateRecord, candidate.candidateRecordBytes)
  ]);
  for (const outputPath of [paths.roundtrip, paths.beforePdf, paths.afterPdf, paths.evidence]) {
    try {
      await lstat(outputPath);
      throw new Error("ORDERED_COMPATIBILITY_OUTPUT_EXISTS");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const transcript = await dependencies.runProbe(paths);
  const sourceAfterProbe = await readFile(paths.candidate);
  if (!sourceAfterProbe.equals(candidate.candidateBytes)) {
    throw new Error("ORDERED_COMPATIBILITY_SOURCE_MUTATED");
  }
  const authenticated = createOrderedPowerPointCompatibilityReceipt({
    candidateSha256: candidate.candidateSha256,
    candidateRecordSha256: candidate.candidateRecordSha256,
    evidenceRecordId: candidate.evidenceRecordId,
    expectedSlides: candidate.expectedSlides,
    transcript
  });
  const outputFiles = await Promise.all([
    lstat(paths.roundtrip),
    lstat(paths.beforePdf),
    lstat(paths.afterPdf)
  ]);
  if (outputFiles.some((metadata) => !metadata.isFile() || metadata.isSymbolicLink() ||
      metadata.size < 1)) {
    throw new Error("ORDERED_COMPATIBILITY_OUTPUT_INVALID");
  }
  const evidence = {
    probeVersion: authenticated.probe.probeVersion,
    status: "passed",
    operation: authenticated.receipt.operation,
    application: {
      name: authenticated.probe.applicationName,
      version: authenticated.probe.applicationVersion
    },
    candidate: {
      fileName: candidate.candidateFileName,
      probeCarrierFileName: path.basename(paths.candidate),
      sha256: candidate.candidateSha256,
      candidateRecordSha256: candidate.candidateRecordSha256
    },
    slides: authenticated.slides,
    output: {
      roundtripFileName: path.basename(paths.roundtrip),
      beforePdfFileName: path.basename(paths.beforePdf),
      afterPdfFileName: path.basename(paths.afterPdf),
      roundtripSha256: sha256(await readFile(paths.roundtrip)),
      beforePdfSha256: sha256(await readFile(paths.beforePdf)),
      afterPdfSha256: sha256(await readFile(paths.afterPdf))
    },
    receipt: authenticated.receipt
  };
  await writeFile(paths.evidence, `${JSON.stringify(evidence, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600
  });
  return Object.freeze({
    status: evidence.status,
    operation: evidence.operation,
    applicationVersion: evidence.application.version,
    slideIds: Object.freeze(evidence.slides.map((slide) => slide.slideId)),
    evidenceRoot,
    receipt: authenticated.receipt
  });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runOrderedPowerPointCompatibilityCli();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
