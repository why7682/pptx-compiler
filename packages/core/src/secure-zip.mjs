import { inflateRawSync } from "node:zlib";

export const SECURE_ZIP_PROFILE_VERSION = "0.1.0";

export const SECURE_ZIP_LIMITS = Object.freeze({
  maxArchiveBytes: 1024 * 1024,
  maxCentralDirectoryBytes: 128 * 1024,
  maxEntries: 32,
  maxCompressedEntryBytes: 256 * 1024,
  maxUncompressedEntryBytes: 256 * 1024,
  maxTotalUncompressedBytes: 1024 * 1024,
  maxCompressionRatio: 100,
  maxPartPathBytes: 512
});

const SIGNATURES = Object.freeze({
  localFile: 0x04034b50,
  centralFile: 0x02014b50,
  endOfCentralDirectory: 0x06054b50
});
const ALLOWED_GENERAL_PURPOSE_FLAGS = 0x0806;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const SAFE_PART_PATH = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/u;

export class SecureZipError extends Error {
  constructor(code, pointer = "/archive") {
    super(`${code} at ${pointer}`);
    this.name = "SecureZipError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer = "/archive") {
  throw new SecureZipError(code, pointer);
}

function ensureRange(bytes, offset, length, pointer) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) ||
      offset < 0 || length < 0 || offset > bytes.length - length) {
    fail("ZIP_ARCHIVE_INVALID", pointer);
  }
}

function readUInt16(bytes, offset, pointer) {
  ensureRange(bytes, offset, 2, pointer);
  return bytes.readUInt16LE(offset);
}

function readUInt32(bytes, offset, pointer) {
  ensureRange(bytes, offset, 4, pointer);
  return bytes.readUInt32LE(offset);
}

function decodeName(bytes, pointer) {
  if (bytes.length < 1 || bytes.length > SECURE_ZIP_LIMITS.maxPartPathBytes) {
    fail("ZIP_RESOURCE_LIMIT", pointer);
  }
  let name;
  try {
    name = UTF8_DECODER.decode(bytes);
  } catch {
    fail("ZIP_ARCHIVE_INVALID", pointer);
  }
  if (Buffer.byteLength(name, "utf8") !== bytes.length || name !== name.normalize("NFC") ||
      /[\u0000-\u001f\u007f]/u.test(name)) {
    fail("ZIP_ARCHIVE_INVALID", pointer);
  }
  if (name !== "[Content_Types].xml") {
    if (!SAFE_PART_PATH.test(name)) fail("ZIP_ARCHIVE_INVALID", pointer);
    const segments = name.split("/");
    if (segments.some((segment) => segment === "." || segment === "..") ||
        name.startsWith("/") || name.endsWith("/") || name.includes("\\")) {
      fail("ZIP_ARCHIVE_INVALID", pointer);
    }
  }
  return name;
}

function validateFlags(flags, method, pointer) {
  if ((flags & ~ALLOWED_GENERAL_PURPOSE_FLAGS) !== 0 ||
      (method === 0 && (flags & 0x0006) !== 0)) {
    fail("ZIP_UNSUPPORTED_FEATURE", pointer);
  }
}

function validateUnixMode(versionMadeBy, externalAttributes, pointer) {
  const host = versionMadeBy >>> 8;
  if ((externalAttributes & 0x10) !== 0) fail("ZIP_UNSUPPORTED_FEATURE", pointer);
  if (host !== 3 && host !== 19) return;
  const mode = externalAttributes >>> 16;
  const fileType = mode & 0o170000;
  if (fileType !== 0 && fileType !== 0o100000) {
    fail("ZIP_UNSUPPORTED_FEATURE", pointer);
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function readEndOfCentralDirectory(bytes) {
  if (bytes.length < 22) fail("ZIP_ARCHIVE_INVALID");
  const offset = bytes.length - 22;
  if (readUInt32(bytes, offset, "/archive/eocd") !== SIGNATURES.endOfCentralDirectory ||
      readUInt16(bytes, offset + 20, "/archive/eocd/comment") !== 0) {
    fail("ZIP_UNSUPPORTED_FEATURE", "/archive/eocd");
  }
  const disk = readUInt16(bytes, offset + 4, "/archive/eocd/disk");
  const centralDisk = readUInt16(bytes, offset + 6, "/archive/eocd/centralDisk");
  const entriesOnDisk = readUInt16(bytes, offset + 8, "/archive/eocd/entriesOnDisk");
  const totalEntries = readUInt16(bytes, offset + 10, "/archive/eocd/totalEntries");
  const centralSize = readUInt32(bytes, offset + 12, "/archive/eocd/centralSize");
  const centralOffset = readUInt32(bytes, offset + 16, "/archive/eocd/centralOffset");
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
    fail("ZIP_UNSUPPORTED_FEATURE", "/archive/eocd");
  }
  if (totalEntries === 0 || totalEntries === 0xffff || centralSize === 0xffffffff ||
      centralOffset === 0xffffffff) {
    fail("ZIP_UNSUPPORTED_FEATURE", "/archive/eocd");
  }
  if (totalEntries > SECURE_ZIP_LIMITS.maxEntries ||
      centralSize > SECURE_ZIP_LIMITS.maxCentralDirectoryBytes) {
    fail("ZIP_RESOURCE_LIMIT", "/archive/eocd");
  }
  if (centralOffset < 1 || centralOffset + centralSize !== offset) {
    fail("ZIP_ARCHIVE_INVALID", "/archive/eocd");
  }
  return { offset, totalEntries, centralOffset, centralSize };
}

function readCentralDirectory(bytes, eocd) {
  const entries = [];
  const names = new Set();
  const foldedNames = new Set();
  const localOffsets = new Set();
  let totalUncompressedBytes = 0;
  let cursor = eocd.centralOffset;
  for (let index = 0; index < eocd.totalEntries; index += 1) {
    const pointer = `/archive/entries/${index}`;
    ensureRange(bytes, cursor, 46, pointer);
    if (readUInt32(bytes, cursor, pointer) !== SIGNATURES.centralFile) {
      fail("ZIP_ARCHIVE_INVALID", pointer);
    }
    const versionMadeBy = readUInt16(bytes, cursor + 4, `${pointer}/versionMadeBy`);
    const versionNeeded = readUInt16(bytes, cursor + 6, `${pointer}/versionNeeded`);
    const flags = readUInt16(bytes, cursor + 8, `${pointer}/flags`);
    const method = readUInt16(bytes, cursor + 10, `${pointer}/method`);
    const modifiedTime = readUInt16(bytes, cursor + 12, `${pointer}/modifiedTime`);
    const modifiedDate = readUInt16(bytes, cursor + 14, `${pointer}/modifiedDate`);
    const checksum = readUInt32(bytes, cursor + 16, `${pointer}/crc32`);
    const compressedSize = readUInt32(bytes, cursor + 20, `${pointer}/compressedSize`);
    const uncompressedSize = readUInt32(bytes, cursor + 24, `${pointer}/uncompressedSize`);
    const nameLength = readUInt16(bytes, cursor + 28, `${pointer}/name`);
    const extraLength = readUInt16(bytes, cursor + 30, `${pointer}/extra`);
    const commentLength = readUInt16(bytes, cursor + 32, `${pointer}/comment`);
    const diskStart = readUInt16(bytes, cursor + 34, `${pointer}/diskStart`);
    const externalAttributes = readUInt32(bytes, cursor + 38, `${pointer}/externalAttributes`);
    const localOffset = readUInt32(bytes, cursor + 42, `${pointer}/localOffset`);
    if (versionNeeded > 20 || (method !== 0 && method !== 8) ||
        extraLength !== 0 || commentLength !== 0 || diskStart !== 0) {
      fail("ZIP_UNSUPPORTED_FEATURE", pointer);
    }
    validateFlags(flags, method, `${pointer}/flags`);
    validateUnixMode(versionMadeBy, externalAttributes, `${pointer}/externalAttributes`);
    const variableLength = nameLength + extraLength + commentLength;
    ensureRange(bytes, cursor + 46, variableLength, pointer);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = decodeName(nameBytes, `${pointer}/name`);
    const foldedName = name.toLowerCase();
    if (names.has(name) || foldedNames.has(foldedName) || localOffsets.has(localOffset)) {
      fail("ZIP_ARCHIVE_INVALID", pointer);
    }
    names.add(name);
    foldedNames.add(foldedName);
    localOffsets.add(localOffset);
    if (compressedSize > SECURE_ZIP_LIMITS.maxCompressedEntryBytes ||
        uncompressedSize > SECURE_ZIP_LIMITS.maxUncompressedEntryBytes) {
      fail("ZIP_RESOURCE_LIMIT", pointer);
    }
    if (uncompressedSize > 0 && compressedSize === 0) {
      fail("ZIP_ARCHIVE_INVALID", pointer);
    }
    if (uncompressedSize > compressedSize * SECURE_ZIP_LIMITS.maxCompressionRatio) {
      fail("ZIP_RESOURCE_LIMIT", `${pointer}/compressionRatio`);
    }
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > SECURE_ZIP_LIMITS.maxTotalUncompressedBytes) {
      fail("ZIP_RESOURCE_LIMIT", "/archive/entries");
    }
    if (localOffset >= eocd.centralOffset) fail("ZIP_ARCHIVE_INVALID", `${pointer}/localOffset`);
    entries.push({
      index,
      pointer,
      name,
      nameBytes: Buffer.from(nameBytes),
      versionNeeded,
      flags,
      method,
      modifiedTime,
      modifiedDate,
      checksum,
      compressedSize,
      uncompressedSize,
      localOffset
    });
    cursor += 46 + variableLength;
  }
  if (cursor !== eocd.offset) fail("ZIP_ARCHIVE_INVALID", "/archive/centralDirectory");
  return entries;
}

function readLocalRecords(bytes, entries, centralOffset) {
  const ordered = [...entries].sort((left, right) => left.localOffset - right.localOffset);
  let expectedOffset = 0;
  for (const entry of ordered) {
    const pointer = `${entry.pointer}/localHeader`;
    if (entry.localOffset !== expectedOffset) fail("ZIP_ARCHIVE_INVALID", pointer);
    ensureRange(bytes, entry.localOffset, 30, pointer);
    if (readUInt32(bytes, entry.localOffset, pointer) !== SIGNATURES.localFile) {
      fail("ZIP_ARCHIVE_INVALID", pointer);
    }
    const versionNeeded = readUInt16(bytes, entry.localOffset + 4, `${pointer}/versionNeeded`);
    const flags = readUInt16(bytes, entry.localOffset + 6, `${pointer}/flags`);
    const method = readUInt16(bytes, entry.localOffset + 8, `${pointer}/method`);
    const modifiedTime = readUInt16(bytes, entry.localOffset + 10, `${pointer}/modifiedTime`);
    const modifiedDate = readUInt16(bytes, entry.localOffset + 12, `${pointer}/modifiedDate`);
    const checksum = readUInt32(bytes, entry.localOffset + 14, `${pointer}/crc32`);
    const compressedSize = readUInt32(bytes, entry.localOffset + 18, `${pointer}/compressedSize`);
    const uncompressedSize = readUInt32(bytes, entry.localOffset + 22, `${pointer}/uncompressedSize`);
    const nameLength = readUInt16(bytes, entry.localOffset + 26, `${pointer}/name`);
    const extraLength = readUInt16(bytes, entry.localOffset + 28, `${pointer}/extra`);
    if (versionNeeded !== entry.versionNeeded || flags !== entry.flags || method !== entry.method ||
        modifiedTime !== entry.modifiedTime || modifiedDate !== entry.modifiedDate ||
        checksum !== entry.checksum || compressedSize !== entry.compressedSize ||
        uncompressedSize !== entry.uncompressedSize || extraLength !== 0 ||
        nameLength !== entry.nameBytes.length) {
      fail("ZIP_ARCHIVE_INVALID", pointer);
    }
    const nameStart = entry.localOffset + 30;
    ensureRange(bytes, nameStart, nameLength + extraLength + compressedSize, pointer);
    const localName = bytes.subarray(nameStart, nameStart + nameLength);
    if (!localName.equals(entry.nameBytes)) fail("ZIP_ARCHIVE_INVALID", `${pointer}/name`);
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > centralOffset) fail("ZIP_ARCHIVE_INVALID", pointer);
    entry.compressedBytes = bytes.subarray(dataStart, dataEnd);
    expectedOffset = dataEnd;
  }
  if (expectedOffset !== centralOffset) fail("ZIP_ARCHIVE_INVALID", "/archive/localRecords");
}

function decompressEntry(entry) {
  let output;
  if (entry.method === 0) {
    if (entry.compressedSize !== entry.uncompressedSize) {
      fail("ZIP_ARCHIVE_INVALID", entry.pointer);
    }
    output = Buffer.from(entry.compressedBytes);
  } else {
    try {
      const result = inflateRawSync(entry.compressedBytes, {
        info: true,
        maxOutputLength: SECURE_ZIP_LIMITS.maxUncompressedEntryBytes
      });
      output = result.buffer;
      if (result.engine.bytesWritten !== entry.compressedBytes.length) {
        fail("ZIP_ARCHIVE_INVALID", entry.pointer);
      }
    } catch {
      fail("ZIP_ARCHIVE_INVALID", entry.pointer);
    }
  }
  if (output.length !== entry.uncompressedSize || crc32(output) !== entry.checksum) {
    fail("ZIP_ARCHIVE_INVALID", entry.pointer);
  }
  if (output.length >= 4) {
    const signature = output.readUInt32LE(0);
    if (signature === SIGNATURES.localFile || signature === SIGNATURES.centralFile ||
        signature === SIGNATURES.endOfCentralDirectory) {
      fail("ZIP_NESTED_ARCHIVE", entry.pointer);
    }
  }
  return output;
}

/**
 * Parse a deliberately narrow, bounded ZIP profile without extracting files.
 * Stored and Deflate entries are accepted; ambiguous or extensible container
 * features fail closed before decompression.
 */
export function parseSecureZip(input) {
  if (!(input instanceof Uint8Array)) fail("ZIP_ARGUMENT_INVALID", "/archive");
  if (input.byteLength > SECURE_ZIP_LIMITS.maxArchiveBytes) {
    fail("ZIP_RESOURCE_LIMIT", "/archive");
  }
  const bytes = Buffer.from(input);
  const eocd = readEndOfCentralDirectory(bytes);
  const entries = readCentralDirectory(bytes, eocd);
  readLocalRecords(bytes, entries, eocd.centralOffset);
  const parts = new Map();
  for (const entry of entries) parts.set(entry.name, decompressEntry(entry));
  return parts;
}
