import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  stat
} from "node:fs/promises";
import path from "node:path";

import { captureAuthenticatedControlledRenderBatch } from
  "./controlled-comparison.mjs";

export const CONTROLLED_RENDER_HARNESS_VERSION = "0.1.0";

const SHA256 = /^[a-f0-9]{64}$/u;
const BLIND_LABEL = /^blind-[0-9]{2}$/u;
const MAX_PROCESS_OUTPUT_BYTES = 128 * 1024;
const PROCESS_TIMEOUT_MS = 45_000;
const MANIFEST_NAME = "render-manifest.json";
const LOCAL_RUNNERS = new WeakSet();
const TEST_RUNNERS = new WeakSet();
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export class ControlledRenderHarnessError extends Error {
  constructor(pointer) {
    super(`CONTROLLED_RENDER_HARNESS_INVALID at ${pointer}`);
    this.name = "ControlledRenderHarnessError";
    this.code = "CONTROLLED_RENDER_HARNESS_INVALID";
    this.pointer = pointer;
  }
}

function fail(pointer) {
  throw new ControlledRenderHarnessError(pointer);
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256Json(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value) ||
      ArrayBuffer.isView(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function closedRecord(value, pointer, expectedKeys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(pointer);
  let prototype;
  let descriptors;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(pointer);
  }
  if (prototype !== Object.prototype && prototype !== null) fail(pointer);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string") || keys.length !== expectedKeys.length) {
    fail(pointer);
  }
  const fields = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(`${pointer}/${key}`);
    }
    fields[key] = descriptor.value;
  }
  return fields;
}

function absolutePath(value, pointer) {
  if (typeof value !== "string" || value.length < 1 || value.length > 4096 ||
      value.trim() !== value || !path.isAbsolute(value) || value.includes("\u0000")) {
    fail(pointer);
  }
  return path.resolve(value);
}

function digest(value, pointer) {
  if (typeof value !== "string" || !SHA256.test(value)) fail(pointer);
  return value;
}

function safeRelativePath(value, pointer) {
  if (typeof value !== "string" || value.length < 1 || value.length > 512 ||
      value.includes("\\") || value.startsWith("/") || value.includes("\u0000")) {
    fail(pointer);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === ".." || normalized.startsWith("../")) fail(pointer);
  return value;
}

function pngDimensions(bytes, pointer) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 24 ||
      !Buffer.from(bytes.subarray(0, 8)).equals(PNG_SIGNATURE) ||
      Buffer.from(bytes.subarray(12, 16)).toString("ascii") !== "IHDR") {
    fail(pointer);
  }
  const width = Buffer.from(bytes).readUInt32BE(16);
  const height = Buffer.from(bytes).readUInt32BE(20);
  if (width < 1 || height < 1 || width > 20_000 || height > 20_000) fail(pointer);
  return { width, height };
}

async function writeCreateOnly(filePath, bytes, pointer) {
  let handle;
  try {
    handle = await open(filePath, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
  } catch {
    fail(pointer);
  } finally {
    await handle?.close().catch(() => {});
  }
}

function boundedProcess(executable, argumentsList, cwd) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(executable, argumentsList, {
        cwd,
        env: {
          LANG: "en_US.UTF-8",
          LC_ALL: "en_US.UTF-8",
          PATH: "/usr/local/bin:/usr/bin:/bin"
        },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch (error) {
      reject(error);
      return;
    }
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let settled = false;
    let timer = null;
    const finish = (operation) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      operation();
    };
    const append = (current, chunk) => {
      const next = Buffer.concat([current, Buffer.from(chunk)]);
      if (next.length > MAX_PROCESS_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(() => reject(new Error("process-output-limit")));
      }
      return next;
    };
    child.stdout.on("data", (chunk) => {
      if (!settled) stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      if (!settled) stderr = append(stderr, chunk);
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code, signal) => finish(() => resolve({
      exitCode: code,
      signal,
      stdout,
      stderr
    })));
    timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error("process-timeout")));
    }, PROCESS_TIMEOUT_MS);
  });
}

async function resolveExecutable(value, pointer) {
  const requested = absolutePath(value, pointer);
  let resolved;
  let facts;
  try {
    resolved = await realpath(requested);
    facts = await stat(resolved);
    await access(resolved, fsConstants.X_OK);
  } catch {
    fail(pointer);
  }
  if (!facts.isFile()) fail(pointer);
  return Object.freeze({
    path: resolved,
    sha256: sha256Bytes(await readFile(resolved))
  });
}

/** Create the only production-like runner admitted by this optional local lab. */
export async function createLocalControlledRenderRunner(options) {
  const fields = closedRecord(options, "/options", [
    "montageExecutablePath", "rendererExecutablePath"
  ]);
  const renderer = await resolveExecutable(
    fields.rendererExecutablePath,
    "/options/rendererExecutablePath"
  );
  const montage = await resolveExecutable(
    fields.montageExecutablePath,
    "/options/montageExecutablePath"
  );
  const runner = Object.freeze({
    runnerClass: "local-command",
    async probe(cwd) {
      const rendererProbe = await boundedProcess(renderer.path, ["-h"], cwd);
      const montageProbe = await boundedProcess(montage.path, ["-version"], cwd);
      if (rendererProbe.exitCode !== 0 || montageProbe.exitCode !== 0) fail("/runner/probe");
      return Object.freeze({
        rendererIdentity: "macos-quick-look-thumbnail",
        rendererExecutableSha256: renderer.sha256,
        rendererProbeSha256: sha256Bytes(Buffer.concat([
          rendererProbe.stdout,
          rendererProbe.stderr
        ])),
        montageIdentity: "imagemagick-montage",
        montageExecutableSha256: montage.sha256,
        montageProbeSha256: sha256Bytes(Buffer.concat([
          montageProbe.stdout,
          montageProbe.stderr
        ]))
      });
    },
    async render({ inputPath, outputDirectory }) {
      const result = await boundedProcess(renderer.path, [
        "-t", "-s", "1600", "-o", outputDirectory, inputPath
      ], outputDirectory);
      if (result.exitCode !== 0) fail("/runner/render");
    },
    async montage({ inputPaths, outputPath, cwd }) {
      const result = await boundedProcess(montage.path, [
        "montage",
        ...inputPaths,
        "-tile", "3x1",
        "-geometry", "800x451+24+24",
        "-background", "#F4F4F2",
        "-strip",
        "-define", "png:exclude-chunk=date,time",
        outputPath
      ], cwd);
      if (result.exitCode !== 0) fail("/runner/montage");
    }
  });
  LOCAL_RUNNERS.add(runner);
  return runner;
}

/** Public tests can exercise the filesystem state machine without a GUI tool. */
export function createControlledRenderTestRunner(options) {
  const fields = closedRecord(options, "/options", ["montage", "probe", "render"]);
  if (typeof fields.probe !== "function" || typeof fields.render !== "function" ||
      typeof fields.montage !== "function") {
    fail("/options");
  }
  const runner = Object.freeze({
    runnerClass: "test-double",
    probe: fields.probe,
    render: fields.render,
    montage: fields.montage
  });
  TEST_RUNNERS.add(runner);
  return runner;
}

function captureRunner(value) {
  if (!LOCAL_RUNNERS.has(value) && !TEST_RUNNERS.has(value)) fail("/options/runner");
  return value;
}

function renderRecord(relativeInputPath, inputSha256, relativeOutputPath, outputBytes) {
  const dimensions = pngDimensions(outputBytes, `/output/${relativeOutputPath}`);
  return {
    inputPath: relativeInputPath,
    inputSha256,
    outputPath: relativeOutputPath,
    outputSha256: sha256Bytes(outputBytes),
    width: dimensions.width,
    height: dimensions.height
  };
}

function positiveInteger(value, pointer, maximum = 20_000) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) fail(pointer);
  return value;
}

function boundedIdentity(value, pointer) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128 ||
      value.trim() !== value || /[\u0000-\u001f\u007f]/u.test(value)) {
    fail(pointer);
  }
  return value;
}

async function assertExactOutputInventory(outputRoot, expectedFiles, expectedDirectories) {
  const pending = [""];
  const actualFiles = new Set();
  const actualDirectories = new Set();
  let entryCount = 0;
  while (pending.length > 0) {
    const relativeDirectory = pending.shift();
    const absoluteDirectory = relativeDirectory.length === 0
      ? outputRoot
      : path.join(outputRoot, relativeDirectory);
    let entries;
    try {
      entries = await readdir(absoluteDirectory, { withFileTypes: true });
    } catch {
      fail("/manifest/inventory");
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      entryCount += 1;
      if (entryCount > 128 || entry.name.includes("/") || entry.name.includes("\\") ||
          entry.name === "." || entry.name === "..") {
        fail("/manifest/inventory");
      }
      const relativePath = relativeDirectory.length === 0
        ? entry.name
        : `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) {
        actualDirectories.add(relativePath);
        pending.push(relativePath);
      } else if (entry.isFile()) {
        actualFiles.add(relativePath);
      } else {
        fail("/manifest/inventory");
      }
    }
  }
  const sameSet = (actual, expected) => actual.size === expected.size &&
    [...actual].every((item) => expected.has(item));
  if (!sameSet(actualFiles, expectedFiles) ||
      !sameSet(actualDirectories, expectedDirectories)) {
    fail("/manifest/inventory");
  }
  for (const relativePath of [...expectedFiles, ...expectedDirectories]) {
    let facts;
    try {
      facts = await lstat(path.join(outputRoot, relativePath));
    } catch {
      fail("/manifest/inventory");
    }
    if ((expectedFiles.has(relativePath) && !facts.isFile()) ||
        (expectedDirectories.has(relativePath) && !facts.isDirectory()) ||
        facts.isSymbolicLink()) {
      fail("/manifest/inventory");
    }
  }
}

async function validateCompletedManifest(outputRoot, manifest, batch) {
  const fields = closedRecord(manifest, "/manifest", [
    "candidateRenders", "contactSheetSetSha256", "evidenceScope", "harnessVersion",
    "manifestSha256", "matrixReceiptSha256", "renderBatchReceiptSha256",
    "renderSetSha256", "runnerClass", "runnerFingerprint"
  ]);
  if (fields.harnessVersion !== CONTROLLED_RENDER_HARNESS_VERSION ||
      fields.evidenceScope !== "simulated-review-only" ||
      digest(fields.renderBatchReceiptSha256, "/manifest/renderBatchReceiptSha256") !==
        batch.renderBatchReceipt.renderBatchReceiptSha256 ||
      digest(fields.matrixReceiptSha256, "/manifest/matrixReceiptSha256") !==
        batch.renderBatchReceipt.matrixReceiptSha256 ||
      !Array.isArray(fields.candidateRenders) ||
      fields.candidateRenders.length !== 6) {
    fail("/manifest");
  }
  if (fields.runnerClass !== "local-command" && fields.runnerClass !== "test-double") {
    fail("/manifest/runnerClass");
  }
  const fingerprint = closedRecord(fields.runnerFingerprint, "/manifest/runnerFingerprint", [
    "montageExecutableSha256", "montageIdentity", "montageProbeSha256",
    "rendererExecutableSha256", "rendererIdentity", "rendererProbeSha256"
  ]);
  boundedIdentity(fingerprint.montageIdentity, "/manifest/runnerFingerprint/montageIdentity");
  boundedIdentity(fingerprint.rendererIdentity, "/manifest/runnerFingerprint/rendererIdentity");
  for (const key of [
    "montageExecutableSha256", "montageProbeSha256",
    "rendererExecutableSha256", "rendererProbeSha256"
  ]) digest(fingerprint[key], `/manifest/runnerFingerprint/${key}`);
  const { manifestSha256, ...core } = manifest;
  if (sha256Json(core) !== digest(manifestSha256, "/manifest/manifestSha256")) {
    fail("/manifest/manifestSha256");
  }
  const artifactRecords = [];
  const expectedDirectories = new Set(["contact-sheets", "decks", "renders", "slides"]);
  const normalizedCandidates = [];
  for (const [candidateIndex, candidate] of fields.candidateRenders.entries()) {
    const expectedCandidate = batch.candidates[candidateIndex];
    const candidateFields = closedRecord(candidate, `/manifest/candidateRenders/${candidateIndex}`, [
      "archivePath", "archiveSha256", "blindLabel", "contactSheet", "slides"
    ]);
    if (!BLIND_LABEL.test(candidateFields.blindLabel) ||
        candidateFields.blindLabel !== expectedCandidate.blindLabel ||
        candidateFields.archivePath !== `decks/${expectedCandidate.blindLabel}.pptx` ||
        candidateFields.archiveSha256 !== expectedCandidate.archiveSha256 ||
        !Array.isArray(candidateFields.slides) ||
        candidateFields.slides.length !== 3) {
      fail(`/manifest/candidateRenders/${candidateIndex}`);
    }
    expectedDirectories.add(`slides/${candidateFields.blindLabel}`);
    expectedDirectories.add(`renders/${candidateFields.blindLabel}`);
    artifactRecords.push({
      relativePath: safeRelativePath(candidateFields.archivePath,
        `/manifest/candidateRenders/${candidateIndex}/archivePath`),
      sha256: digest(candidateFields.archiveSha256,
        `/manifest/candidateRenders/${candidateIndex}/archiveSha256`)
    });
    const contact = closedRecord(candidateFields.contactSheet,
      `/manifest/candidateRenders/${candidateIndex}/contactSheet`, [
        "height", "outputPath", "outputSha256", "width"
      ]);
    if (contact.outputPath !== `contact-sheets/${candidateFields.blindLabel}.png`) {
      fail(`/manifest/candidateRenders/${candidateIndex}/contactSheet/outputPath`);
    }
    positiveInteger(contact.width,
      `/manifest/candidateRenders/${candidateIndex}/contactSheet/width`);
    positiveInteger(contact.height,
      `/manifest/candidateRenders/${candidateIndex}/contactSheet/height`);
    artifactRecords.push({
      relativePath: safeRelativePath(contact.outputPath,
        `/manifest/candidateRenders/${candidateIndex}/contactSheet/outputPath`),
      sha256: digest(contact.outputSha256,
        `/manifest/candidateRenders/${candidateIndex}/contactSheet/outputSha256`)
    });
    const normalizedSlides = [];
    for (const [slideIndex, slide] of candidateFields.slides.entries()) {
      const expectedSlide = expectedCandidate.slides[slideIndex];
      const slideFields = closedRecord(slide,
        `/manifest/candidateRenders/${candidateIndex}/slides/${slideIndex}`, [
          "height", "inputPath", "inputSha256", "outputPath", "outputSha256", "width"
        ]);
      const expectedInputPath =
        `slides/${candidateFields.blindLabel}/${expectedSlide.blindSlideId}.pptx`;
      const expectedOutputPath =
        `renders/${candidateFields.blindLabel}/${expectedSlide.blindSlideId}.pptx.png`;
      if (slideFields.inputPath !== expectedInputPath ||
          slideFields.inputSha256 !== expectedSlide.archiveSha256 ||
          slideFields.outputPath !== expectedOutputPath) {
        fail(`/manifest/candidateRenders/${candidateIndex}/slides/${slideIndex}`);
      }
      positiveInteger(slideFields.width,
        `/manifest/candidateRenders/${candidateIndex}/slides/${slideIndex}/width`);
      positiveInteger(slideFields.height,
        `/manifest/candidateRenders/${candidateIndex}/slides/${slideIndex}/height`);
      artifactRecords.push({
        relativePath: safeRelativePath(slideFields.inputPath,
          `/manifest/candidateRenders/${candidateIndex}/slides/${slideIndex}/inputPath`),
        sha256: digest(slideFields.inputSha256,
          `/manifest/candidateRenders/${candidateIndex}/slides/${slideIndex}/inputSha256`)
      });
      artifactRecords.push({
        relativePath: safeRelativePath(slideFields.outputPath,
          `/manifest/candidateRenders/${candidateIndex}/slides/${slideIndex}/outputPath`),
        sha256: digest(slideFields.outputSha256,
          `/manifest/candidateRenders/${candidateIndex}/slides/${slideIndex}/outputSha256`)
      });
      normalizedSlides.push({
        blindLabel: candidateFields.blindLabel,
        inputSha256: slideFields.inputSha256,
        outputSha256: slideFields.outputSha256,
        width: slideFields.width,
        height: slideFields.height
      });
    }
    normalizedCandidates.push({
      blindLabel: candidateFields.blindLabel,
      slides: normalizedSlides,
      contactSheet: {
        blindLabel: candidateFields.blindLabel,
        outputSha256: contact.outputSha256,
        width: contact.width,
        height: contact.height
      }
    });
  }
  if (new Set(artifactRecords.map((record) => record.relativePath)).size !== artifactRecords.length) {
    fail("/manifest/candidateRenders");
  }
  const expectedFiles = new Set([
    MANIFEST_NAME,
    ...artifactRecords.map((record) => record.relativePath)
  ]);
  await assertExactOutputInventory(outputRoot, expectedFiles, expectedDirectories);
  for (const record of artifactRecords) {
    let bytes;
    try {
      bytes = await readFile(path.join(outputRoot, record.relativePath));
    } catch {
      fail(`/manifest/artifacts/${record.relativePath}`);
    }
    if (sha256Bytes(bytes) !== record.sha256) fail(`/manifest/artifacts/${record.relativePath}`);
    if (record.relativePath.endsWith(".png")) {
      const dimensions = pngDimensions(bytes, `/manifest/artifacts/${record.relativePath}`);
      const slide = fields.candidateRenders.flatMap((candidate) => candidate.slides)
        .find((item) => item.outputPath === record.relativePath);
      const contact = fields.candidateRenders.map((candidate) => candidate.contactSheet)
        .find((item) => item.outputPath === record.relativePath);
      const declared = slide ?? contact;
      if (declared === undefined || dimensions.width !== declared.width ||
          dimensions.height !== declared.height) {
        fail(`/manifest/artifacts/${record.relativePath}`);
      }
    }
  }
  const recomputedRenderSetSha256 = sha256Json(normalizedCandidates.flatMap((candidate) =>
    candidate.slides));
  const recomputedContactSheetSetSha256 = sha256Json(normalizedCandidates.map((candidate) =>
    candidate.contactSheet));
  if (digest(fields.renderSetSha256, "/manifest/renderSetSha256") !==
      recomputedRenderSetSha256 ||
      digest(fields.contactSheetSetSha256, "/manifest/contactSheetSetSha256") !==
      recomputedContactSheetSetSha256) {
    fail("/manifest/setDigests");
  }
  return deepFreeze(manifest);
}

async function reuseCompletedRun(outputRoot, entries, batch) {
  if (!entries.includes(MANIFEST_NAME)) return null;
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(outputRoot, MANIFEST_NAME), "utf8"));
  } catch {
    fail("/outputRoot/manifest");
  }
  const validated = await validateCompletedManifest(outputRoot, manifest, batch);
  return Object.freeze({ status: "reused", outputRoot, manifest: validated });
}

/**
 * Execute the complete batch once in a stable directory. A partial directory
 * is deliberately preserved and rejected on reuse; a repair must use a new,
 * explicit version directory rather than selectively rerendering one arm.
 */
export async function renderControlledComparisonBatch(options) {
  const fields = closedRecord(options, "/options", ["outputRoot", "renderBatch", "runner"]);
  const outputRoot = absolutePath(fields.outputRoot, "/options/outputRoot");
  const runner = captureRunner(fields.runner);
  let batch;
  try {
    batch = captureAuthenticatedControlledRenderBatch(fields.renderBatch);
  } catch {
    fail("/options/renderBatch");
  }
  let entries;
  try {
    await mkdir(outputRoot, { recursive: true });
    entries = await readdir(outputRoot);
  } catch {
    fail("/outputRoot");
  }
  if (entries.length > 0) {
    const reused = await reuseCompletedRun(
      outputRoot,
      entries,
      batch
    );
    if (reused !== null) return reused;
    fail("/outputRoot/incomplete");
  }

  let runnerFingerprint;
  try {
    runnerFingerprint = await runner.probe(outputRoot);
  } catch (error) {
    if (error instanceof ControlledRenderHarnessError) throw error;
    fail("/runner/probe");
  }
  const fingerprintFields = closedRecord(runnerFingerprint, "/runner/fingerprint", [
    "montageExecutableSha256", "montageIdentity", "montageProbeSha256",
    "rendererExecutableSha256", "rendererIdentity", "rendererProbeSha256"
  ]);
  for (const key of [
    "montageExecutableSha256", "montageProbeSha256",
    "rendererExecutableSha256", "rendererProbeSha256"
  ]) digest(fingerprintFields[key], `/runner/fingerprint/${key}`);

  const roots = {
    decks: path.join(outputRoot, "decks"),
    slides: path.join(outputRoot, "slides"),
    renders: path.join(outputRoot, "renders"),
    contacts: path.join(outputRoot, "contact-sheets")
  };
  try {
    await Promise.all(Object.values(roots).map((directory) => mkdir(directory, { recursive: false })));
  } catch {
    fail("/outputRoot/directories");
  }

  const candidateRenders = [];
  let expectedRenderDimensions = null;
  for (const [candidateIndex, candidate] of batch.candidates.entries()) {
    const archiveRelativePath = `decks/${candidate.blindLabel}.pptx`;
    const archivePath = path.join(outputRoot, archiveRelativePath);
    await writeCreateOnly(
      archivePath,
      candidate.archiveBytes,
      `/output/candidates/${candidateIndex}/archive`
    );
    const candidateSlideRoot = path.join(roots.slides, candidate.blindLabel);
    const candidateRenderRoot = path.join(roots.renders, candidate.blindLabel);
    try {
      await mkdir(candidateSlideRoot);
      await mkdir(candidateRenderRoot);
    } catch {
      fail(`/output/candidates/${candidateIndex}/directories`);
    }
    const slideRecords = [];
    for (const [slideIndex, slide] of candidate.slides.entries()) {
      const inputRelativePath = `slides/${candidate.blindLabel}/${slide.blindSlideId}.pptx`;
      const inputPath = path.join(outputRoot, inputRelativePath);
      await writeCreateOnly(
        inputPath,
        slide.archiveBytes,
        `/output/candidates/${candidateIndex}/slides/${slideIndex}/input`
      );
      try {
        await runner.render({ inputPath, outputDirectory: candidateRenderRoot });
      } catch (error) {
        if (error instanceof ControlledRenderHarnessError) throw error;
        fail(`/runner/render/${candidateIndex}/${slideIndex}`);
      }
      const outputRelativePath =
        `renders/${candidate.blindLabel}/${path.basename(inputPath)}.png`;
      const outputPath = path.join(outputRoot, outputRelativePath);
      let outputBytes;
      try {
        outputBytes = await readFile(outputPath);
      } catch {
        fail(`/output/candidates/${candidateIndex}/slides/${slideIndex}/render`);
      }
      const record = renderRecord(
        inputRelativePath,
        slide.archiveSha256,
        outputRelativePath,
        outputBytes
      );
      if (record.width < 1200 || record.width / record.height < 1.70 ||
          record.width / record.height > 1.80) {
        fail(`/output/candidates/${candidateIndex}/slides/${slideIndex}/dimensions`);
      }
      if (expectedRenderDimensions === null) {
        expectedRenderDimensions = { width: record.width, height: record.height };
      } else if (record.width !== expectedRenderDimensions.width ||
          record.height !== expectedRenderDimensions.height) {
        fail(`/output/candidates/${candidateIndex}/slides/${slideIndex}/dimensions`);
      }
      slideRecords.push(record);
    }
    const contactRelativePath = `contact-sheets/${candidate.blindLabel}.png`;
    const contactPath = path.join(outputRoot, contactRelativePath);
    try {
      await runner.montage({
        inputPaths: slideRecords.map((record) => path.join(outputRoot, record.outputPath)),
        outputPath: contactPath,
        cwd: outputRoot
      });
    } catch (error) {
      if (error instanceof ControlledRenderHarnessError) throw error;
      fail(`/runner/montage/${candidateIndex}`);
    }
    let contactBytes;
    try {
      contactBytes = await readFile(contactPath);
    } catch {
      fail(`/output/candidates/${candidateIndex}/contactSheet`);
    }
    const contactDimensions = pngDimensions(
      contactBytes,
      `/output/candidates/${candidateIndex}/contactSheet`
    );
    candidateRenders.push({
      blindLabel: candidate.blindLabel,
      archivePath: archiveRelativePath,
      archiveSha256: candidate.archiveSha256,
      slides: slideRecords,
      contactSheet: {
        outputPath: contactRelativePath,
        outputSha256: sha256Bytes(contactBytes),
        width: contactDimensions.width,
        height: contactDimensions.height
      }
    });
  }

  const initialExpectedDirectories = new Set([
    "contact-sheets", "decks", "renders", "slides"
  ]);
  const initialExpectedFiles = new Set();
  for (const candidate of candidateRenders) {
    initialExpectedDirectories.add(`slides/${candidate.blindLabel}`);
    initialExpectedDirectories.add(`renders/${candidate.blindLabel}`);
    initialExpectedFiles.add(candidate.archivePath);
    initialExpectedFiles.add(candidate.contactSheet.outputPath);
    for (const slide of candidate.slides) {
      initialExpectedFiles.add(slide.inputPath);
      initialExpectedFiles.add(slide.outputPath);
    }
  }
  await assertExactOutputInventory(
    outputRoot,
    initialExpectedFiles,
    initialExpectedDirectories
  );

  const renderSetSha256 = sha256Json(candidateRenders.flatMap((candidate) =>
    candidate.slides.map((slide) => ({
      blindLabel: candidate.blindLabel,
      inputSha256: slide.inputSha256,
      outputSha256: slide.outputSha256,
      width: slide.width,
      height: slide.height
    }))));
  const contactSheetSetSha256 = sha256Json(candidateRenders.map((candidate) => ({
    blindLabel: candidate.blindLabel,
    outputSha256: candidate.contactSheet.outputSha256,
    width: candidate.contactSheet.width,
    height: candidate.contactSheet.height
  })));
  const manifestCore = {
    harnessVersion: CONTROLLED_RENDER_HARNESS_VERSION,
    evidenceScope: "simulated-review-only",
    runnerClass: runner.runnerClass,
    matrixReceiptSha256: batch.renderBatchReceipt.matrixReceiptSha256,
    renderBatchReceiptSha256: batch.renderBatchReceipt.renderBatchReceiptSha256,
    runnerFingerprint: { ...fingerprintFields },
    renderSetSha256,
    contactSheetSetSha256,
    candidateRenders
  };
  const manifest = deepFreeze({
    ...manifestCore,
    manifestSha256: sha256Json(manifestCore)
  });
  await writeCreateOnly(
    path.join(outputRoot, MANIFEST_NAME),
    Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    "/output/manifest"
  );
  return Object.freeze({ status: "created", outputRoot, manifest });
}
