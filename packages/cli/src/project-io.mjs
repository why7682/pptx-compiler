import { constants as fsConstants } from "node:fs";
import { randomUUID } from "node:crypto";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";

export const CLI_JSON_MAX_BYTES = 4 * 1024 * 1024;
const fatalUtf8Decoder = new TextDecoder("utf-8", { fatal: true });

const ERROR_CODES = Object.freeze({
  INPUT_INVALID: "CLI_INPUT_INVALID",
  INPUT_UNAVAILABLE: "CLI_INPUT_UNAVAILABLE",
  OUTPUT_COMMIT_UNCERTAIN: "CLI_OUTPUT_COMMIT_UNCERTAIN",
  OUTPUT_CONFLICT: "CLI_OUTPUT_CONFLICT",
  OUTPUT_FAILED: "CLI_OUTPUT_FAILED"
});

export class CliProjectIoError extends Error {
  constructor(code, pointer) {
    super(code);
    this.name = "CliProjectIoError";
    this.code = code;
    this.pointer = pointer;
  }
}

function fail(code, pointer) {
  throw new CliProjectIoError(code, pointer);
}

function normalizedAbsolute(value, pointer) {
  if (typeof value !== "string" || value.length === 0 ||
      /[\u0000-\u001f\u007f]/u.test(value) || !path.isAbsolute(value)) {
    fail(ERROR_CODES.INPUT_INVALID, pointer);
  }
  const normalized = path.normalize(value);
  if (normalized !== value) fail(ERROR_CODES.INPUT_INVALID, pointer);
  return normalized;
}

function contained(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
}

async function assertRealRoot(rootPath) {
  let metadata;
  let canonical;
  try {
    [metadata, canonical] = await Promise.all([lstat(rootPath), realpath(rootPath)]);
  } catch {
    fail(ERROR_CODES.INPUT_UNAVAILABLE, "/projectRoot");
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    fail(ERROR_CODES.INPUT_INVALID, "/projectRoot");
  }
  return canonical;
}

async function assertRealContainedFile(rootPath, filePath, pointer) {
  const canonicalRoot = await assertRealRoot(rootPath);
  if (!contained(rootPath, filePath)) fail(ERROR_CODES.INPUT_INVALID, pointer);
  const relative = path.relative(rootPath, filePath);
  const segments = relative.split(path.sep);
  let current = rootPath;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let metadata;
    try {
      metadata = await lstat(current);
    } catch {
      fail(ERROR_CODES.INPUT_UNAVAILABLE, pointer);
    }
    const final = index === segments.length - 1;
    if (metadata.isSymbolicLink() || (final ? !metadata.isFile() : !metadata.isDirectory())) {
      fail(ERROR_CODES.INPUT_INVALID, pointer);
    }
  }
  let canonical;
  try {
    canonical = await realpath(filePath);
  } catch {
    fail(ERROR_CODES.INPUT_UNAVAILABLE, pointer);
  }
  if (canonical !== path.join(canonicalRoot, ...segments)) {
    fail(ERROR_CODES.INPUT_INVALID, pointer);
  }
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

async function readExactFile(filePath, pointer, maximumBytes = CLI_JSON_MAX_BYTES) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 ||
      maximumBytes > CLI_JSON_MAX_BYTES) {
    fail(ERROR_CODES.INPUT_INVALID, pointer);
  }
  let handle;
  try {
    handle = await open(filePath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size < 1n || before.size > BigInt(maximumBytes)) {
      fail(ERROR_CODES.INPUT_INVALID, pointer);
    }
    const size = Number(before.size);
    const bytes = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
      const { bytesRead } = await handle.read(bytes, offset, size - offset, offset);
      if (bytesRead < 1) fail(ERROR_CODES.INPUT_UNAVAILABLE, pointer);
      offset += bytesRead;
    }
    const extra = Buffer.alloc(1);
    if ((await handle.read(extra, 0, 1, size)).bytesRead !== 0) {
      fail(ERROR_CODES.INPUT_INVALID, pointer);
    }
    const after = await handle.stat({ bigint: true });
    if (!sameFile(before, after)) fail(ERROR_CODES.INPUT_UNAVAILABLE, pointer);
    return bytes;
  } catch (error) {
    if (error instanceof CliProjectIoError) throw error;
    fail(ERROR_CODES.INPUT_UNAVAILABLE, pointer);
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

export async function readContainedBytes({
  projectRoot,
  filePath,
  pointer = "/input",
  maximumBytes
} = {}) {
  const root = normalizedAbsolute(projectRoot, "/projectRoot");
  const input = normalizedAbsolute(filePath, pointer);
  await assertRealContainedFile(root, input, pointer);
  return readExactFile(input, pointer, maximumBytes);
}

export async function readContainedJson({ projectRoot, filePath, pointer = "/input" } = {}) {
  const root = normalizedAbsolute(projectRoot, "/projectRoot");
  const input = normalizedAbsolute(filePath, pointer);
  await assertRealContainedFile(root, input, pointer);
  const bytes = await readExactFile(input, pointer);
  try {
    return JSON.parse(fatalUtf8Decoder.decode(bytes));
  } catch {
    fail(ERROR_CODES.INPUT_INVALID, pointer);
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value === null || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value).sort()) output[key] = canonicalJson(value[key]);
  return output;
}

async function outputParent(projectRoot, outputPath) {
  const parent = path.dirname(outputPath);
  if (!contained(projectRoot, outputPath)) fail(ERROR_CODES.INPUT_INVALID, "/output");
  const canonicalRoot = await assertRealRoot(projectRoot);
  const relative = path.relative(projectRoot, parent);
  const segments = relative === "" ? [] : relative.split(path.sep);
  let current = projectRoot;
  for (const segment of segments) {
    current = path.join(current, segment);
    let metadata;
    try {
      metadata = await lstat(current);
    } catch {
      fail(ERROR_CODES.OUTPUT_FAILED, "/output");
    }
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      fail(ERROR_CODES.OUTPUT_FAILED, "/output");
    }
  }
  let canonical;
  try {
    canonical = await realpath(parent);
  } catch {
    fail(ERROR_CODES.OUTPUT_FAILED, "/output");
  }
  if (canonical !== path.join(canonicalRoot, ...segments)) {
    fail(ERROR_CODES.OUTPUT_FAILED, "/output");
  }
  return parent;
}

/**
 * Resolve a lexically contained create-only output to its canonical parent
 * after rejecting every symlink in the project-relative directory chain.
 * This keeps `/tmp`-style platform aliases compatible without granting a
 * symlink escape to downstream writers that require a canonical destination.
 */
export async function resolveContainedOutputPath({ projectRoot, filePath } = {}) {
  const root = normalizedAbsolute(projectRoot, "/projectRoot");
  const output = normalizedAbsolute(filePath, "/output");
  await assertRealRoot(root);
  const parent = await outputParent(root, output);
  let canonicalParent;
  try {
    canonicalParent = await realpath(parent);
  } catch {
    fail(ERROR_CODES.OUTPUT_FAILED, "/output");
  }
  return path.join(canonicalParent, path.basename(output));
}

async function fsyncDirectory(directory) {
  if (process.platform === "win32") return;
  let handle;
  try {
    handle = await open(directory, fsConstants.O_RDONLY);
    await handle.sync();
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

export async function writeContainedJsonCreateOnly(
  { projectRoot, filePath, value } = {},
  { syncDirectory = fsyncDirectory } = {}
) {
  if (typeof syncDirectory !== "function") fail(ERROR_CODES.OUTPUT_FAILED, "/output");
  const root = normalizedAbsolute(projectRoot, "/projectRoot");
  const output = normalizedAbsolute(filePath, "/output");
  await assertRealRoot(root);
  const parent = await outputParent(root, output);
  const bytes = Buffer.from(`${JSON.stringify(canonicalJson(value), null, 2)}\n`, "utf8");
  if (bytes.length > CLI_JSON_MAX_BYTES) fail(ERROR_CODES.OUTPUT_FAILED, "/output");

  const stagePath = path.join(parent, `.pptx-pipeline-json-${process.pid}-${randomUUID()}`);
  let handle;
  let linked = false;
  try {
    handle = await open(
      stagePath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY |
        (fsConstants.O_NOFOLLOW ?? 0),
      0o600
    );
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    try {
      await link(stagePath, output);
    } catch (error) {
      if (error?.code === "EEXIST") fail(ERROR_CODES.OUTPUT_CONFLICT, "/output");
      fail(ERROR_CODES.OUTPUT_FAILED, "/output");
    }
    linked = true;
    try {
      await syncDirectory(parent);
    } catch {
      fail(ERROR_CODES.OUTPUT_COMMIT_UNCERTAIN, "/output");
    }
  } catch (error) {
    if (error instanceof CliProjectIoError) throw error;
    fail(ERROR_CODES.OUTPUT_FAILED, "/output");
  } finally {
    if (handle) await handle.close().catch(() => {});
    await unlink(stagePath).catch(() => {});
    if (linked) await syncDirectory(parent).catch(() => {});
  }
  return bytes.length;
}
