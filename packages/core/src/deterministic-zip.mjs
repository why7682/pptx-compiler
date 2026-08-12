import { SECURE_ZIP_LIMITS } from "./secure-zip.mjs";

export const DETERMINISTIC_ZIP_VERSION = "0.1.0";

const UTF8_FLAG = 0x0800;
const DOS_DATE_2000_01_01 = ((2000 - 1980) << 9) | (1 << 5) | 1;
const DOS_TIME_MIDNIGHT = 0;
const SAFE_PART_PATH = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/u;

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

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertPartPath(partPath) {
  if (typeof partPath !== "string" || partPath.length === 0 ||
      partPath !== partPath.normalize("NFC") ||
      (partPath !== "[Content_Types].xml" && !SAFE_PART_PATH.test(partPath)) ||
      partPath.startsWith("/") || partPath.endsWith("/") || partPath.includes("\\") ||
      partPath.split("/").some((segment) => segment === "." || segment === "..") ||
      Buffer.byteLength(partPath, "utf8") > SECURE_ZIP_LIMITS.maxPartPathBytes) {
    throw new TypeError("DETERMINISTIC_ZIP_PART_PATH_INVALID");
  }
}

function captureEntries(parts) {
  if (!(parts instanceof Map) || parts.size < 1 || parts.size > SECURE_ZIP_LIMITS.maxEntries) {
    throw new TypeError("DETERMINISTIC_ZIP_PARTS_INVALID");
  }
  const folded = new Set();
  let totalBytes = 0;
  const entries = [];
  for (const [partPath, value] of parts) {
    assertPartPath(partPath);
    const foldedPath = partPath.toLowerCase();
    if (folded.has(foldedPath) || !(value instanceof Uint8Array)) {
      throw new TypeError("DETERMINISTIC_ZIP_PARTS_INVALID");
    }
    folded.add(foldedPath);
    const bytes = Buffer.from(value);
    if (bytes.length < 1 || bytes.length > SECURE_ZIP_LIMITS.maxUncompressedEntryBytes) {
      throw new TypeError("DETERMINISTIC_ZIP_RESOURCE_LIMIT");
    }
    totalBytes += bytes.length;
    if (totalBytes > SECURE_ZIP_LIMITS.maxTotalUncompressedBytes) {
      throw new TypeError("DETERMINISTIC_ZIP_RESOURCE_LIMIT");
    }
    entries.push({ partPath, bytes });
  }
  entries.sort((left, right) => compareText(left.partPath, right.partPath));
  return entries;
}

/** Create a bounded, stored-entry ZIP with stable ordering and timestamps. */
export function createDeterministicZip(parts) {
  const entries = captureEntries(parts);
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.partPath, "utf8");
    const checksum = crc32(entry.bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(DOS_TIME_MIDNIGHT, 10);
    local.writeUInt16LE(DOS_DATE_2000_01_01, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(entry.bytes.length, 18);
    local.writeUInt32LE(entry.bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localRecords.push(local, name, entry.bytes);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(DOS_TIME_MIDNIGHT, 12);
    central.writeUInt16LE(DOS_DATE_2000_01_01, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(entry.bytes.length, 20);
    central.writeUInt32LE(entry.bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralRecords.push(central, name);
    offset += local.length + name.length + entry.bytes.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  const archive = Buffer.concat([...localRecords, centralDirectory, end]);
  if (archive.length > SECURE_ZIP_LIMITS.maxArchiveBytes) {
    throw new TypeError("DETERMINISTIC_ZIP_RESOURCE_LIMIT");
  }
  return archive;
}
