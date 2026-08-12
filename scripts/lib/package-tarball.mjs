import { createHash } from "node:crypto";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { gunzipSync, gzipSync, inflateRawSync } from "node:zlib";

import {
  inspectForbiddenMaterialContent,
  inspectForbiddenMaterialPath
} from "../check-forbidden-materials.mjs";
import {
  ALPHA_RELEASE_GUARD,
  ALPHA_REPOSITORY,
  flattenPackageFiles
} from "./package-plan.mjs";

export const ALPHA_TARBALL_LIMITS = Object.freeze({
  compressedBytes: 5 * 1024 * 1024,
  unpackedBytes: 20 * 1024 * 1024,
  fileBytes: 1024 * 1024,
  files: 300,
  tarStreamBytes: 22 * 1024 * 1024
});

const TAR_BLOCK_BYTES = 512;
const TAR_TRAILER_BYTES = TAR_BLOCK_BYTES * 2;
const PACKAGE_PREFIX = "package/";
const NPM_TAR_MTIME_SECONDS = 499_162_500;

export class AlphaTarballError extends Error {
  constructor(code) {
    super(code);
    this.name = "AlphaTarballError";
    this.code = code;
  }
}

function fail(code) {
  throw new AlphaTarballError(code);
}

function exactObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalTarget(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 100 ||
      value.includes("\\") || path.posix.isAbsolute(value) ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    return false;
  }
  const parts = value.split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..") &&
    path.posix.normalize(value) === value;
}

function sortedTargets(item) {
  return [...flattenPackageFiles(item).map((entry) => entry.target)].sort();
}

function npmPackOrder(left, right) {
  const leftExtension = path.posix.extname(left).toLowerCase();
  const rightExtension = path.posix.extname(right).toLowerCase();
  const leftBase = path.posix.basename(left).toLowerCase();
  const rightBase = path.posix.basename(right).toLowerCase();
  return leftExtension.localeCompare(rightExtension, "en") ||
    leftBase.localeCompare(rightBase, "en") ||
    left.localeCompare(right, "en");
}

function npmFilePattern(target) {
  if (/[*?{}]/u.test(target)) fail("manifest-files");
  return target.replaceAll("[", "[[]");
}

export function createAlphaPackageManifest(plan, item) {
  if (!exactObject(plan) || !exactObject(item)) {
    fail("manifest-plan");
  }
  if (!isDeepStrictEqual(plan.repository, ALPHA_REPOSITORY)) {
    fail("manifest-repository");
  }
  if (!isDeepStrictEqual(plan.releaseGuard, ALPHA_RELEASE_GUARD)) {
    fail("manifest-release-guard");
  }
  const packagesById = new Map(plan.packages.map((candidate) => [
    candidate.packageId,
    candidate
  ]));
  const files = sortedTargets(item);
  if (files.length + 1 > ALPHA_TARBALL_LIMITS.files ||
      files.some((target) => !canonicalTarget(target))) {
    fail("manifest-files");
  }
  const dependencies = {};
  for (const dependency of item.dependencies) {
    const target = packagesById.get(dependency.packageId);
    if (target === undefined || dependency.version !== plan.packageVersion) {
      fail("manifest-dependencies");
    }
    dependencies[target.name] = dependency.version;
  }
  return Object.freeze({
    name: item.name,
    version: plan.packageVersion,
    description: item.description,
    private: true,
    license: plan.license,
    type: plan.moduleType,
    engines: structuredClone(plan.engines),
    repository: {
      type: "git",
      url: `git+${plan.repository.htmlUrl}.git`,
      directory: item.repositoryDirectory
    },
    files: files.map(npmFilePattern),
    exports: structuredClone(item.exports),
    imports: structuredClone(item.imports),
    types: item.types,
    bin: structuredClone(item.bin),
    dependencies
  });
}

export function alphaPackageManifestBytes(plan, item) {
  return Buffer.from(`${JSON.stringify(createAlphaPackageManifest(plan, item), null, 2)}\n`);
}

export function alphaTarballFilename(plan, item) {
  return `${item.name}-${plan.packageVersion}.tgz`;
}

function tarString(field, code) {
  const zero = field.indexOf(0);
  const end = zero === -1 ? field.length : zero;
  if (zero !== -1 && field.subarray(zero).some((byte) => byte !== 0)) fail(code);
  const value = field.subarray(0, end);
  if (value.some((byte) => byte < 0x20 || byte > 0x7e)) fail(code);
  return value.toString("ascii");
}

function npmTarOctal(field, code) {
  if (field.length < 3 || field[field.length - 2] !== 0x20 ||
      field[field.length - 1] !== 0 ||
      field.subarray(0, field.length - 2)
        .some((byte) => byte < 0x30 || byte > 0x37)) {
    fail(code);
  }
  const value = Number.parseInt(
    field.subarray(0, field.length - 2).toString("ascii"),
    8
  );
  if (!Number.isSafeInteger(value) || value < 0) fail(code);
  return value;
}

function allZero(field) {
  return field.every((byte) => byte === 0);
}

function tarChecksum(header) {
  let value = 0;
  for (let index = 0; index < header.length; index += 1) {
    value += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  return value;
}

function zeroBlock(value) {
  return value.length === TAR_BLOCK_BYTES && value.every((byte) => byte === 0);
}

function strictGzipHeader(bytes) {
  if (bytes.length < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b ||
      bytes[2] !== 0x08 || bytes[3] !== 0 ||
      bytes.subarray(4, 8).some((byte) => byte !== 0) ||
      bytes[8] !== 0x02 || bytes[9] !== 0xff) {
    fail("tar-gzip-header");
  }
}

function assertSingleGzipMember(bytes) {
  let probe;
  try {
    probe = inflateRawSync(bytes.subarray(10), {
      info: true,
      maxOutputLength: ALPHA_TARBALL_LIMITS.tarStreamBytes
    });
  } catch {
    fail("tar-gzip");
  }
  const consumed = probe?.engine?.bytesWritten;
  if (!Number.isSafeInteger(consumed) || consumed < 1 ||
      10 + consumed + 8 !== bytes.length) {
    fail("tar-gzip-envelope");
  }
}

function parseStrictTar(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < TAR_TRAILER_BYTES ||
      bytes.length % TAR_BLOCK_BYTES !== 0) {
    fail("tar-envelope");
  }
  const entries = [];
  const folded = new Set();
  let offset = 0;
  let unpackedBytes = 0;
  while (offset + TAR_BLOCK_BYTES <= bytes.length) {
    const header = bytes.subarray(offset, offset + TAR_BLOCK_BYTES);
    if (zeroBlock(header)) {
      const second = bytes.subarray(offset + TAR_BLOCK_BYTES, offset + TAR_TRAILER_BYTES);
      if (!zeroBlock(second) || offset + TAR_TRAILER_BYTES !== bytes.length) {
        fail("tar-trailer");
      }
      return Object.freeze({ entries: Object.freeze(entries), unpackedBytes });
    }
    if (header.subarray(257, 263).toString("ascii") !== "ustar\0" ||
        header.subarray(263, 265).toString("ascii") !== "00") {
      fail("tar-format");
    }
    if (npmTarOctal(header.subarray(148, 156), "tar-checksum") !==
        tarChecksum(header)) {
      fail("tar-checksum");
    }
    if (tarString(header.subarray(345, 500), "tar-prefix") !== "" ||
        tarString(header.subarray(157, 257), "tar-link") !== "" ||
        tarString(header.subarray(265, 297), "tar-owner-name") !== "" ||
        tarString(header.subarray(297, 329), "tar-owner-name") !== "") {
      fail("tar-link-or-prefix");
    }
    if (!allZero(header.subarray(108, 124))) fail("tar-owner-id");
    if (npmTarOctal(header.subarray(136, 148), "tar-mtime") !==
        NPM_TAR_MTIME_SECONDS) {
      fail("tar-mtime");
    }
    if (npmTarOctal(header.subarray(329, 337), "tar-device") !== 0 ||
        npmTarOctal(header.subarray(337, 345), "tar-device") !== 0) {
      fail("tar-device");
    }
    if (!allZero(header.subarray(500, 512))) fail("tar-header-padding");
    const type = header[156];
    if (type !== 0x30) fail("tar-entry-type");
    const archivePath = tarString(header.subarray(0, 100), "tar-path");
    if (!archivePath.startsWith(PACKAGE_PREFIX)) fail("tar-root");
    const target = archivePath.slice(PACKAGE_PREFIX.length);
    if (!canonicalTarget(target)) fail("tar-path");
    const foldedTarget = target.toLocaleLowerCase("en-US");
    if (folded.has(foldedTarget)) fail("tar-target-alias");
    folded.add(foldedTarget);

    const mode = npmTarOctal(header.subarray(100, 108), "tar-mode");
    if (mode !== 0o644 && mode !== 0o755) fail("tar-mode");
    const size = npmTarOctal(header.subarray(124, 136), "tar-size");
    if (size > ALPHA_TARBALL_LIMITS.fileBytes) fail("tar-file-size");
    unpackedBytes += size;
    if (unpackedBytes > ALPHA_TARBALL_LIMITS.unpackedBytes) fail("tar-unpacked-size");
    const contentStart = offset + TAR_BLOCK_BYTES;
    const contentEnd = contentStart + size;
    if (contentEnd > bytes.length) fail("tar-truncated");
    const paddedSize = Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
    const nextOffset = contentStart + paddedSize;
    if (nextOffset > bytes.length ||
        bytes.subarray(contentEnd, nextOffset).some((byte) => byte !== 0)) {
      fail("tar-padding");
    }
    entries.push(Object.freeze({
      path: target,
      mode,
      size,
      bytes: Buffer.from(bytes.subarray(contentStart, contentEnd))
    }));
    if (entries.length > ALPHA_TARBALL_LIMITS.files) fail("tar-file-count");
    offset = nextOffset;
  }
  fail("tar-trailer");
}

function expectedEntryMap(expectedFiles) {
  if (!(expectedFiles instanceof Map) || expectedFiles.size === 0) {
    fail("tar-expected-files");
  }
  const output = new Map();
  for (const [target, entry] of expectedFiles) {
    if (!canonicalTarget(target) || !exactObject(entry) ||
        !Buffer.isBuffer(entry.bytes) ||
        ![0o644, 0o755].includes(entry.mode) || typeof entry.role !== "string") {
      fail("tar-expected-files");
    }
    output.set(target, entry);
  }
  return output;
}

function scanPackedEntry(entry, policy) {
  const pathFindings = inspectForbiddenMaterialPath(entry.path, "100644", policy);
  const contentFindings = inspectForbiddenMaterialContent(entry.path, entry.bytes, policy);
  if (pathFindings.length !== 0 || contentFindings.length !== 0) {
    fail("tar-forbidden-material");
  }
}

export function inspectAlphaTarball({
  tarballBytes,
  expectedFiles,
  forbiddenPolicy
}) {
  if (!Buffer.isBuffer(tarballBytes) || tarballBytes.length < 1 ||
      tarballBytes.length > ALPHA_TARBALL_LIMITS.compressedBytes) {
    fail("tar-compressed-size");
  }
  strictGzipHeader(tarballBytes);
  assertSingleGzipMember(tarballBytes);
  let tarBytes;
  try {
    tarBytes = gunzipSync(tarballBytes, {
      maxOutputLength: ALPHA_TARBALL_LIMITS.tarStreamBytes
    });
  } catch {
    fail("tar-gzip");
  }
  const expected = expectedEntryMap(expectedFiles);
  const parsed = parseStrictTar(tarBytes);
  if (parsed.entries.length !== expected.size) fail("tar-allowlist");
  const actual = new Map(parsed.entries.map((entry) => [entry.path, entry]));
  if (actual.size !== parsed.entries.length ||
      [...expected.keys()].some((target) => !actual.has(target))) {
    fail("tar-allowlist");
  }
  const expectedOrder = [...expected.keys()].sort(npmPackOrder);
  if (parsed.entries.some((entry, index) => entry.path !== expectedOrder[index])) {
    fail("tar-order");
  }
  for (const [target, expectedEntry] of expected) {
    const entry = actual.get(target);
    if (entry.mode !== expectedEntry.mode) fail("tar-entry-mode");
    if (!entry.bytes.equals(expectedEntry.bytes)) fail("tar-entry-content");
    if ((entry.mode === 0o755) !== (expectedEntry.role === "bin")) {
      fail("tar-executable-boundary");
    }
    scanPackedEntry(entry, forbiddenPolicy);
  }
  const canonicalGzip = gzipSync(tarBytes, { level: 9, mtime: 0 });
  canonicalGzip[9] = 0xff;
  if (!canonicalGzip.equals(tarballBytes)) fail("tar-gzip-canonical");
  const files = [...actual.values()]
    .map((entry) => Object.freeze({ path: entry.path, size: entry.size, mode: entry.mode }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return Object.freeze({
    sha256: createHash("sha256").update(tarballBytes).digest("hex"),
    compressedBytes: tarballBytes.length,
    unpackedBytes: parsed.unpackedBytes,
    fileCount: files.length,
    files: Object.freeze(files)
  });
}

export function parseNpmPackOutput(stdout) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout) > 1024 * 1024) {
    fail("npm-pack-output");
  }
  let value;
  try {
    value = JSON.parse(stdout);
  } catch {
    fail("npm-pack-output");
  }
  if (!Array.isArray(value) || value.length !== 1 || !exactObject(value[0])) {
    fail("npm-pack-output");
  }
  return value[0];
}

export function crossCheckNpmPackRecord({
  record,
  plan,
  item,
  inspection,
  tarballBytes
}) {
  const expectedName = alphaTarballFilename(plan, item);
  if (!exactObject(record) || record.name !== item.name ||
      record.version !== plan.packageVersion || record.filename !== expectedName ||
      record.size !== inspection.compressedBytes ||
      record.unpackedSize !== inspection.unpackedBytes || !Array.isArray(record.files) ||
      record.shasum !== createHash("sha1").update(tarballBytes).digest("hex") ||
      record.integrity !== `sha512-${createHash("sha512").update(tarballBytes).digest("base64")}`) {
    fail("npm-pack-record");
  }
  const reported = record.files.map((entry) => {
    if (!exactObject(entry) || typeof entry.path !== "string" ||
        !Number.isSafeInteger(entry.size) || !Number.isSafeInteger(entry.mode)) {
      fail("npm-pack-record");
    }
    return { path: entry.path, size: entry.size, mode: entry.mode & 0o777 };
  }).sort((left, right) => left.path.localeCompare(right.path));
  if (reported.length !== inspection.files.length ||
      reported.some((entry, index) => {
        const actual = inspection.files[index];
        return entry.path !== actual.path || entry.size !== actual.size ||
          entry.mode !== actual.mode;
      })) {
    fail("npm-pack-record");
  }
  return true;
}
