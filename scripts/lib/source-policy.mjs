import { spawnSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function finding(code, pointer) {
  return Object.freeze({ code, pointer });
}

export function inspectModuleSourceBytes(bytes, pointer = "") {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > MAX_SOURCE_BYTES) {
    return Object.freeze([finding("source-size", pointer)]);
  }
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    return Object.freeze([finding("source-utf8", pointer)]);
  }
  const findings = [];
  if (text.charCodeAt(0) === 0xfeff) findings.push(finding("source-bom", pointer));
  if (text.includes("\0")) findings.push(finding("source-nul", pointer));
  if (text.includes("\r")) findings.push(finding("source-line-ending", pointer));
  if (/[\t ]+$/mu.test(text)) findings.push(finding("source-trailing-whitespace", pointer));
  if (!text.endsWith("\n")) findings.push(finding("source-final-newline", pointer));
  return Object.freeze(findings);
}

function canonicalRelative(value) {
  return typeof value === "string" && value.length > 0 &&
    /^[A-Za-z0-9._/-]+$/u.test(value) &&
    !value.includes("\\") && !value.startsWith("/") &&
    !value.split("/").some((part) => part === "" || part === "." || part === "..") &&
    path.posix.normalize(value) === value;
}

function sameStat(left, right) {
  return left.dev === right.dev && left.ino === right.ino &&
    left.mode === right.mode && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

export async function inspectModuleFile({
  root,
  relativePath,
  nodeExecutable = process.execPath
}) {
  if (typeof root !== "string" || !path.isAbsolute(root) ||
      !canonicalRelative(relativePath) || !relativePath.endsWith(".mjs") ||
      typeof nodeExecutable !== "string" || !path.isAbsolute(nodeExecutable)) {
    return Object.freeze([finding("source-input", relativePath ?? "")]);
  }
  let handle;
  try {
    const canonicalRoot = await realpath(root);
    const absolutePath = path.join(canonicalRoot, ...relativePath.split("/"));
    const [metadata, canonical] = await Promise.all([
      lstat(absolutePath, { bigint: true }),
      realpath(absolutePath)
    ]);
    if (!metadata.isFile() || metadata.isSymbolicLink() || canonical !== absolutePath) {
      return Object.freeze([finding("source-file", relativePath)]);
    }
    handle = await open(
      absolutePath,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)
    );
    const before = await handle.stat({ bigint: true });
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (!sameStat(metadata, before) || !sameStat(before, after) ||
        before.size !== BigInt(bytes.length)) {
      return Object.freeze([finding("source-file", relativePath)]);
    }
    await handle.close();
    handle = undefined;
    const findings = [...inspectModuleSourceBytes(bytes, relativePath)];
    const checked = spawnSync(nodeExecutable, ["--check", "--input-type=module"], {
      cwd: canonicalRoot,
      input: bytes,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30_000,
      maxBuffer: 1024 * 1024
    });
    if (checked.error !== undefined || checked.signal !== null || checked.status !== 0 ||
        checked.stdout !== "" || checked.stderr !== "") {
      findings.push(finding("source-syntax", relativePath));
    }
    return Object.freeze(findings);
  } catch {
    return Object.freeze([finding("source-file", relativePath)]);
  } finally {
    await handle?.close().catch(() => {});
  }
}

export function splitNullPaths(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.at(-1) !== 0) {
    throw new Error("source-path-list");
  }
  const paths = [];
  let start = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== 0) continue;
    const entry = decoder.decode(bytes.subarray(start, index));
    if (!canonicalRelative(entry)) throw new Error("source-path-list");
    paths.push(entry);
    start = index + 1;
  }
  return Object.freeze(paths);
}
