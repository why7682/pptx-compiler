import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createProjectContext } from "../packages/core/src/project-context.mjs";
import {
  prepareReceiptBoundMixedOrderedFinalDelivery,
  publishReceiptBoundFinalDelivery
} from "../packages/core/src/receipt-bound-final-delivery.mjs";
import {
  createSameCandidateEvidenceManifest,
  inspectSameCandidateEvidence
} from "../packages/powerpoint-macos/src/same-candidate-evidence.mjs";
import {
  createMixedOrderedProjectConfig,
  createPublicMixedOrderedDocuments,
  createPublicMixedOrderedRuntime
} from "../tests/helpers/public-mixed-ordered-candidate.mjs";
import {
  createPublicMixedOrderedCompatibilityCandidate
} from "./run-ordered-powerpoint-compatibility.mjs";
import {
  assertSupportedSchema,
  createSchemaRegistry,
  validateJson
} from "./lib/json-schema.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const evidenceRoot = path.join(
  repositoryRoot,
  ".private-test-artifacts",
  "powerpoint-ordered"
);
const localPaths = Object.freeze({
  compatibilityEvidence: "mixed-ordered-compatibility-effect-evidence.local.json",
  roundtrip: "mixed-ordered-compatibility-effect-roundtrip.pptx",
  beforePdf: "mixed-ordered-compatibility-effect-before.pdf",
  afterPdf: "mixed-ordered-compatibility-effect-after.pdf",
  manifest: "mixed-same-candidate-manifest.local.json",
  pixelReview: "mixed-same-candidate-pixel-review.local.json"
});
const buildId = "mixed-same-candidate-delivery";
const MAX_LOCAL_JSON_BYTES = 512 * 1024;
const MAX_LOCAL_ARCHIVE_BYTES = 1024 * 1024;
const MAX_LOCAL_PDF_BYTES = 64 * 1024 * 1024;
const MAX_LOCAL_IMAGE_BYTES = 16 * 1024 * 1024;
const CI_KEYS = Object.freeze([
  "CI", "GITHUB_ACTIONS", "GITHUB_EVENT_NAME", "BUILD_BUILDID", "BUILDKITE"
]);

function assertManualTrustedRun(values, environment) {
  if (values["trusted-local-run"] !== true) {
    throw new Error("SAME_CANDIDATE_EXPLICIT_TRUST_REQUIRED");
  }
  if (CI_KEYS.some((key) => environment[key] || process.env[key])) {
    throw new Error("SAME_CANDIDATE_CI_FORBIDDEN");
  }
}

async function assertExistingEvidenceRoot() {
  const [metadata, canonical] = await Promise.all([
    lstat(evidenceRoot),
    realpath(evidenceRoot)
  ]);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || canonical !== evidenceRoot) {
    throw new Error("SAME_CANDIDATE_EVIDENCE_ROOT_INVALID");
  }
}

function readOnlyNoFollowFlags() {
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) {
    throw new Error("SAME_CANDIDATE_NOFOLLOW_UNAVAILABLE");
  }
  return fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW;
}

function writeExclusiveNoFollowFlags() {
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) {
    throw new Error("SAME_CANDIDATE_NOFOLLOW_UNAVAILABLE");
  }
  return fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL |
    fsConstants.O_NOFOLLOW;
}

function sameOpenFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino &&
    left.size === right.size && left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs;
}

async function readBoundedRegularFile(filePath, maximum, errorCode) {
  let handle;
  try {
    handle = await open(filePath, readOnlyNoFollowFlags());
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size < 1n ||
        before.size > BigInt(maximum) || before.size > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(errorCode);
    }
    const size = Number(before.size);
    const bytes = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
      const result = await handle.read(bytes, offset, size - offset, offset);
      if (result.bytesRead < 1) throw new Error(errorCode);
      offset += result.bytesRead;
    }
    const extra = Buffer.allocUnsafe(1);
    const afterEnd = await handle.read(extra, 0, 1, size);
    const after = await handle.stat({ bigint: true });
    if (afterEnd.bytesRead !== 0 || !sameOpenFile(before, after)) {
      throw new Error(errorCode);
    }
    return bytes;
  } catch (error) {
    if (error?.message === "SAME_CANDIDATE_NOFOLLOW_UNAVAILABLE") throw error;
    throw new Error(errorCode);
  } finally {
    await handle?.close();
  }
}

async function readLocalBytes(fileName, maximum) {
  const filePath = path.join(evidenceRoot, fileName);
  return readBoundedRegularFile(
    filePath,
    maximum,
    "SAME_CANDIDATE_LOCAL_EVIDENCE_INVALID"
  );
}

async function readLocalJson(fileName) {
  const bytes = await readLocalBytes(fileName, MAX_LOCAL_JSON_BYTES);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("SAME_CANDIDATE_LOCAL_JSON_INVALID");
  }
}

async function writeExactOrReuse(fileName, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  const filePath = path.join(evidenceRoot, fileName);
  try {
    await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
    return "created";
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  const existing = await readBoundedRegularFile(
    filePath,
    bytes.length,
    "SAME_CANDIDATE_LOCAL_MANIFEST_DRIFT"
  );
  if (!existing.equals(bytes)) throw new Error("SAME_CANDIDATE_LOCAL_MANIFEST_DRIFT");
  return "reused";
}

function runPdftoppmPage(pdftoppmPath, pdfPath, pageNumber, outputRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(pdftoppmPath, [
      "-png", "-r", "120", "-f", String(pageNumber), "-l", String(pageNumber),
      "-singlefile", pdfPath, outputRoot
    ], {
      cwd: evidenceRoot,
      env: Object.fromEntries([
        "HOME", "LANG", "LC_ALL", "LOGNAME", "PATH", "TMPDIR", "USER"
      ].flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]])),
      shell: false,
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let spawnError;
    let stderrOverflow = false;
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 30_000);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (Buffer.byteLength(stderr, "utf8") > 64 * 1024) {
        stderrOverflow = true;
        child.kill("SIGKILL");
      }
    });
    child.once("error", (error) => { spawnError = error; });
    child.once("close", (code) => {
      if (spawnError !== undefined) {
        settle(reject, spawnError);
        return;
      }
      if (timedOut) {
        settle(reject, new Error("SAME_CANDIDATE_RASTER_TIMEOUT"));
        return;
      }
      if (code !== 0 || stderr.length > 0 || stderrOverflow) {
        settle(reject, new Error("SAME_CANDIDATE_RASTER_FAILED"));
        return;
      }
      settle(resolve);
    });
  });
}

function runPdfInfo(pdfinfoPath, pdfPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(pdfinfoPath, [pdfPath], {
      cwd: evidenceRoot,
      env: Object.fromEntries([
        "HOME", "LANG", "LC_ALL", "LOGNAME", "PATH", "TMPDIR", "USER"
      ].flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]])),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let spawnError;
    let stdoutOverflow = false;
    let stderrOverflow = false;
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 30_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout, "utf8") > 64 * 1024) {
        stdoutOverflow = true;
        child.kill("SIGKILL");
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (Buffer.byteLength(stderr, "utf8") > 64 * 1024) {
        stderrOverflow = true;
        child.kill("SIGKILL");
      }
    });
    child.once("error", (error) => { spawnError = error; });
    child.once("close", (code) => {
      if (spawnError !== undefined) {
        settle(reject, spawnError);
        return;
      }
      if (timedOut) {
        settle(reject, new Error("SAME_CANDIDATE_PDFINFO_TIMEOUT"));
        return;
      }
      if (code !== 0 || stderr.length > 0 || stdoutOverflow || stderrOverflow) {
        settle(reject, new Error("SAME_CANDIDATE_PDFINFO_FAILED"));
        return;
      }
      settle(resolve, stdout);
    });
  });
}

async function verifyPdfRasterPages(
  poppler,
  pdfBytes,
  pages,
  role
) {
  const token = `${process.pid}-${randomUUID()}`;
  const snapshotPath = path.join(evidenceRoot, `.raster-source-${token}-${role}.pdf`);
  let snapshotOwned = false;
  try {
    let snapshotHandle;
    try {
      snapshotHandle = await open(
        snapshotPath,
        writeExclusiveNoFollowFlags(),
        0o600
      );
      snapshotOwned = true;
      let offset = 0;
      while (offset < pdfBytes.length) {
        const result = await snapshotHandle.write(
          pdfBytes,
          offset,
          pdfBytes.length - offset,
          offset
        );
        if (result.bytesWritten < 1) {
          throw new Error("SAME_CANDIDATE_RASTER_SOURCE_INVALID");
        }
        offset += result.bytesWritten;
      }
      await snapshotHandle.sync();
      const snapshotMetadata = await snapshotHandle.stat({ bigint: true });
      if (!snapshotMetadata.isFile() ||
          snapshotMetadata.size !== BigInt(pdfBytes.length)) {
        throw new Error("SAME_CANDIDATE_RASTER_SOURCE_INVALID");
      }
    } finally {
      await snapshotHandle?.close();
    }
    const info = await runPdfInfo(poppler.pdfinfoPath, snapshotPath);
    const pageMatches = /^Pages:\s+([1-9][0-9]*)$/gmu.exec(info);
    if (pageMatches === null || Number(pageMatches[1]) !== pages.length) {
      throw new Error("SAME_CANDIDATE_PDF_PAGE_COUNT_INVALID");
    }
    for (let index = 0; index < pages.length; index += 1) {
      const outputRoot = path.join(evidenceRoot, `.raster-proof-${token}-${role}-${index + 1}`);
      const outputPath = `${outputRoot}.png`;
      try {
        await runPdftoppmPage(
          poppler.pdftoppmPath,
          snapshotPath,
          index + 1,
          outputRoot
        );
        const actual = await readBoundedRegularFile(
          outputPath,
          MAX_LOCAL_IMAGE_BYTES,
          "SAME_CANDIDATE_RASTER_OUTPUT_INVALID"
        );
        if (!actual.equals(pages[index].bytes)) {
          throw new Error("SAME_CANDIDATE_RASTER_DRIFT");
        }
      } finally {
        try { await unlink(outputPath); } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      }
    }
    const finalSnapshot = await readBoundedRegularFile(
      snapshotPath,
      pdfBytes.length,
      "SAME_CANDIDATE_RASTER_SOURCE_MUTATED"
    );
    if (!finalSnapshot.equals(pdfBytes)) {
      throw new Error("SAME_CANDIDATE_RASTER_SOURCE_MUTATED");
    }
  } finally {
    if (snapshotOwned) {
      try { await unlink(snapshotPath); } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  }
}

async function buildEvidenceInputs(poppler) {
  const candidate = await createPublicMixedOrderedCompatibilityCandidate();
  const compatibilityEvidence = await readLocalJson(localPaths.compatibilityEvidence);
  const [roundtripBytes, beforePdfBytes, afterPdfBytes] = await Promise.all([
    readLocalBytes(localPaths.roundtrip, MAX_LOCAL_ARCHIVE_BYTES),
    readLocalBytes(localPaths.beforePdf, MAX_LOCAL_PDF_BYTES),
    readLocalBytes(localPaths.afterPdf, MAX_LOCAL_PDF_BYTES)
  ]);
  const beforePages = [];
  const afterPages = [];
  for (let index = 0; index < candidate.expectedSlides.length; index += 1) {
    const number = index + 1;
    const [beforeBytes, afterBytes] = await Promise.all([
      readLocalBytes(`mixed-effect-before-${number}.png`, MAX_LOCAL_IMAGE_BYTES),
      readLocalBytes(`mixed-effect-after-${number}.png`, MAX_LOCAL_IMAGE_BYTES)
    ]);
    beforePages.push({
      slideId: candidate.expectedSlides[index].slideId,
      imageId: `mixed-effect-before-${number}`,
      bytes: beforeBytes
    });
    afterPages.push({
      slideId: candidate.expectedSlides[index].slideId,
      imageId: `mixed-effect-after-${number}`,
      bytes: afterBytes
    });
  }
  await Promise.all([
    verifyPdfRasterPages(
      poppler,
      beforePdfBytes,
      beforePages,
      "before"
    ),
    verifyPdfRasterPages(
      poppler,
      afterPdfBytes,
      afterPages,
      "after"
    )
  ]);
  return {
    candidate: {
      candidateBytes: candidate.candidateBytes,
      candidateRecordBytes: candidate.candidateRecordBytes,
      candidateFileName: candidate.candidateFileName
    },
    compatibility: {
      evidence: compatibilityEvidence,
      roundtripBytes,
      beforePdfBytes,
      afterPdfBytes
    },
    render: {
      rendererId: "pdftoppm-120dpi-local",
      beforePages,
      afterPages
    }
  };
}

async function resolvePopplerTools(value) {
  if (typeof value !== "string" || !path.isAbsolute(value) ||
      path.basename(value) !== "pdftoppm") {
    throw new Error("SAME_CANDIDATE_PDFTOPPM_PATH_REQUIRED");
  }
  let canonical;
  let metadata;
  try {
    canonical = await realpath(value);
    metadata = await lstat(canonical);
  } catch {
    throw new Error("SAME_CANDIDATE_PDFTOPPM_INVALID");
  }
  if (!path.isAbsolute(canonical) || !metadata.isFile() || metadata.isSymbolicLink() ||
      (metadata.mode & 0o111) === 0) {
    throw new Error("SAME_CANDIDATE_PDFTOPPM_INVALID");
  }
  const pdfinfoCandidate = path.join(path.dirname(canonical), "pdfinfo");
  let pdfinfoPath;
  let pdfinfoMetadata;
  try {
    pdfinfoPath = await realpath(pdfinfoCandidate);
    pdfinfoMetadata = await lstat(pdfinfoPath);
  } catch {
    throw new Error("SAME_CANDIDATE_PDFINFO_INVALID");
  }
  if (!path.isAbsolute(pdfinfoPath) || !pdfinfoMetadata.isFile() ||
      pdfinfoMetadata.isSymbolicLink() || (pdfinfoMetadata.mode & 0o111) === 0) {
    throw new Error("SAME_CANDIDATE_PDFINFO_INVALID");
  }
  return Object.freeze({ pdftoppmPath: canonical, pdfinfoPath });
}

async function createValidators() {
  const manifest = JSON.parse(await readFile(
    path.join(repositoryRoot, "schemas/contracts/manifest.json"),
    "utf8"
  ));
  const schemas = await Promise.all(manifest.schemas.map(async ({ path: schemaPath }) =>
    JSON.parse(await readFile(path.join(repositoryRoot, schemaPath), "utf8"))));
  const registry = createSchemaRegistry(schemas);
  for (const schema of schemas) assertSupportedSchema(schema, { registry });
  const validator = (name) => {
    const schema = registry.get(`urn:pptx-compiler:schema:${name}:0.1.0`);
    return (value) => validateJson(value, schema, {
      rootSchema: schema,
      registry
    }).length === 0;
  };
  return Object.freeze({
    validateBuildArtifact: validator("build-artifact"),
    validateCapabilityRegistry: validator("capability-registry"),
    validateDeckSpec: validator("deck-spec"),
    validateProjectConfig: validator("project-config"),
    validateProjectOverlay: validator("project-overlay"),
    validateQaReport: validator("qa-report"),
    validateTemplateIndex: validator("template-index"),
    validateTemplateProfile: validator("template-profile")
  });
}

function sameStringArray(left, right) {
  return Array.isArray(left) && left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

// This authority is deliberately private to the fixed trusted-local bridge.
// The public evidence module returns facts only and cannot mint core receipts.
function createLocalReceiptAuthority(facts) {
  const common = {
    receiptVersion: "0.1.0",
    candidateSha256: facts.candidate.sha256,
    candidateRecordSha256: facts.candidate.candidateRecordSha256
  };
  const receipts = Object.freeze({
    mechanical: Object.freeze({
      ...common,
      receiptType: "mechanical",
      slideIds: Object.freeze([...facts.slideIds]),
      status: "pass"
    }),
    render: Object.freeze({
      ...common,
      receiptType: "render",
      renderSetId: facts.renderSetId,
      slideIds: Object.freeze([...facts.slideIds]),
      status: "pass"
    }),
    pixelReview: Object.freeze({
      ...common,
      receiptType: "pixel-review",
      renderSetId: facts.renderSetId,
      reviewerMode: "independent-pixel-only",
      status: "pass",
      verdict: "pass",
      blockerCount: 0,
      majorCount: 0
    }),
    compatibility: facts.compatibilityReceipt
  });
  const states = new WeakMap();
  const issue = (kind) => {
    const token = Object.freeze({ localEvidenceToken: kind });
    states.set(token, { kind, consumed: false });
    return token;
  };
  const evidence = Object.freeze({
    mechanicalReceipt: issue("mechanical"),
    renderReceipt: issue("render"),
    pixelReviewReceipt: issue("pixelReview"),
    compatibilityReceipt: issue("compatibility")
  });
  const authenticate = (kind) => (token, expected) => {
    const state = states.get(token);
    const expectedKeys = [
      "candidateSha256", "candidateRecordSha256", "candidateFileName", "slideIds",
      ...(kind === "pixelReview" ? ["renderSetId"] : []),
      ...(kind === "compatibility" ? ["operation"] : [])
    ];
    let keys;
    try {
      keys = Reflect.ownKeys(expected);
    } catch {
      throw new Error("SAME_CANDIDATE_LOCAL_TOKEN_INVALID");
    }
    if (state === undefined || state.kind !== kind || state.consumed ||
        expected === null || typeof expected !== "object" || Array.isArray(expected) ||
        keys.length !== expectedKeys.length ||
        keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key)) ||
        expected.candidateSha256 !== facts.candidate.sha256 ||
        expected.candidateRecordSha256 !== facts.candidate.candidateRecordSha256 ||
        expected.candidateFileName !== facts.candidate.fileName ||
        !sameStringArray(expected.slideIds, facts.slideIds) ||
        (kind === "pixelReview" && expected.renderSetId !== facts.renderSetId) ||
        (kind === "compatibility" &&
          expected.operation !== "ordered-deck-open-save-reopen")) {
      throw new Error("SAME_CANDIDATE_LOCAL_TOKEN_INVALID");
    }
    state.consumed = true;
    return receipts[kind];
  };
  return Object.freeze({
    evidence,
    authenticators: Object.freeze({
      authenticateMechanicalReceipt: authenticate("mechanical"),
      authenticateRenderReceipt: authenticate("render"),
      authenticatePixelReviewReceipt: authenticate("pixelReview"),
      authenticateCompatibilityReceipt: authenticate("compatibility")
    })
  });
}

async function finalize(inputs, manifest) {
  const pixelReview = await readLocalJson(localPaths.pixelReview);
  const facts = inspectSameCandidateEvidence({
    ...inputs,
    manifest,
    pixelReview
  });
  const authority = createLocalReceiptAuthority(facts);
  const [documents, validators] = await Promise.all([
    createPublicMixedOrderedDocuments(),
    createValidators()
  ]);
  const runtime = await createPublicMixedOrderedRuntime(documents);
  await mkdir(path.join(evidenceRoot, "workspace", "output"), {
    recursive: true,
    mode: 0o700
  });
  const projectContext = createProjectContext({
    projectRoot: evidenceRoot,
    projectConfig: createMixedOrderedProjectConfig(),
    dependencies: { validateProjectConfig: validators.validateProjectConfig }
  });
  const plan = await prepareReceiptBoundMixedOrderedFinalDelivery({
    candidate: inputs.candidate,
    projectBundle: {
      projectContext,
      templateProfile: documents.templateProfile,
      templateIndex: documents.templateIndex,
      capabilityRegistry: documents.capabilityRegistry,
      projectOverlay: documents.projectOverlay,
      deckSpec: documents.deckSpec,
      sourceTemplateBytes: documents.sourceTemplateBytes
    },
    evidence: authority.evidence,
    output: {
      buildId,
      qaReportId: "mixed-same-candidate-qa",
      publishPath: `workspace/output/${buildId}/${inputs.candidate.candidateFileName}`
    },
    dependencies: {
      ...authority.authenticators,
      validateBuildArtifact: validators.validateBuildArtifact,
      validateCapabilityRegistry: validators.validateCapabilityRegistry,
      validateDeckSpec: validators.validateDeckSpec,
      validateProjectOverlay: validators.validateProjectOverlay,
      validateQaReport: validators.validateQaReport,
      validateTemplateIndex: validators.validateTemplateIndex,
      validateTemplateProfile: validators.validateTemplateProfile
    },
    runtime
  });
  return publishReceiptBoundFinalDelivery({ plan });
}

export async function runMixedSameCandidateDeliveryCli(
  argv = process.argv.slice(2),
  environment = process.env
) {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: false,
    strict: true,
    options: {
      mode: { type: "string", default: "prepare" },
      "pdftoppm-path": { type: "string" },
      "trusted-local-run": { type: "boolean" }
    }
  });
  assertManualTrustedRun(parsed.values, environment);
  if (parsed.values.mode !== "prepare" && parsed.values.mode !== "finalize") {
    throw new Error("SAME_CANDIDATE_MODE_INVALID");
  }
  const poppler = await resolvePopplerTools(parsed.values["pdftoppm-path"]);
  await assertExistingEvidenceRoot();
  const inputs = await buildEvidenceInputs(poppler);
  const manifest = createSameCandidateEvidenceManifest(inputs);
  const manifestStatus = await writeExactOrReuse(localPaths.manifest, manifest);
  if (parsed.values.mode === "prepare") {
    return Object.freeze({
      status: "prepared",
      manifestStatus,
      manifestSha256: manifest.manifestSha256,
      renderSetId: manifest.render.renderSetId,
      reviewImageIds: Object.freeze(
        manifest.render.slides.map((slide) => slide.reviewImageId)
      )
    });
  }
  const published = await finalize(inputs, manifest);
  return Object.freeze({
    status: "published",
    manifestStatus,
    manifestSha256: manifest.manifestSha256,
    renderSetId: manifest.render.renderSetId,
    publishPath: published.publishPath,
    sha256: published.sha256,
    qaReportId: published.qaReportId,
    buildId: published.buildId
  });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runMixedSameCandidateDeliveryCli();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
