import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deflateRawSync } from "node:zlib";

import { createProjectContext } from "../packages/core/src/project-context.mjs";
import {
  inspectTemplateSource,
  TemplateIngestionError
} from "../packages/core/src/secure-template-ingestion.mjs";
import { parseSecureZip } from "../packages/core/src/secure-zip.mjs";
import { buildSyntheticFixtures, crc32 } from "../scripts/generate-synthetic-fixtures.mjs";
import {
  assertSupportedSchema,
  createSchemaRegistry,
  validateJson
} from "../scripts/lib/json-schema.mjs";

const contractManifest = JSON.parse(await readFile(
  new URL("../schemas/contracts/manifest.json", import.meta.url),
  "utf8"
));
const schemas = await Promise.all(contractManifest.schemas.map(async ({ path: schemaPath }) =>
  JSON.parse(await readFile(new URL(`../${schemaPath}`, import.meta.url), "utf8"))));
const registry = createSchemaRegistry(schemas);
for (const schema of schemas) assertSupportedSchema(schema, { registry });
const projectConfigSchema = registry.get("urn:pptx-pipeline:schema:project-config:0.1.0");
const templateIndexSchema = registry.get("urn:pptx-pipeline:schema:template-index:0.1.0");
const baseProjectConfig = JSON.parse(await readFile(
  new URL("../fixtures/contracts/valid/project-config.json", import.meta.url),
  "utf8"
));
const expectedPotxIndex = JSON.parse(await readFile(
  new URL("../fixtures/inspection/expected-potx-template-index.json", import.meta.url),
  "utf8"
));
const builtFixtures = await buildSyntheticFixtures();
const archives = new Map(builtFixtures.archives.map((archive) => [archive.variant, archive]));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateAgainst(value, schema) {
  return validateJson(value, schema, { rootSchema: schema, registry }).length === 0;
}

function validateProjectConfig(value) {
  return validateAgainst(value, projectConfigSchema);
}

function validateTemplateIndex(value) {
  return validateAgainst(value, templateIndexSchema);
}

function makeContext(projectRoot, format = "potx", sourcePath = `workspace/template.${format}`) {
  const config = clone(baseProjectConfig);
  config.template.sourcePath = sourcePath;
  return createProjectContext({
    projectRoot,
    projectConfig: config,
    dependencies: { validateProjectConfig }
  });
}

async function temporaryRoot(prefix = "secure-template-") {
  return realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
}

async function inspectArchive(bytes, format = "potx", sourcePath = `workspace/template.${format}`) {
  const root = await temporaryRoot();
  const source = path.join(root, ...sourcePath.split("/"));
  await mkdir(path.dirname(source), { recursive: true });
  await writeFile(source, bytes);
  const context = makeContext(root, format, sourcePath);
  try {
    const index = await inspectTemplateSource({
      context,
      dependencies: { validateTemplateIndex }
    });
    return { index, context, root, source };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

async function expectRejected(bytes, code, options = {}) {
  const format = options.format ?? "potx";
  const sourcePath = options.sourcePath ?? `workspace/template.${format}`;
  await assert.rejects(
    async () => {
      const result = await inspectArchive(bytes, format, sourcePath);
      await rm(result.root, { recursive: true, force: true });
    },
    (error) => {
      assert.ok(error instanceof TemplateIngestionError);
      assert.equal(error.code, code);
      assert.deepEqual(error.toJSON(), { code, pointer: error.pointer });
      return true;
    }
  );
}

function clonedParts(format = "potx") {
  return new Map([...parseSecureZip(archives.get(format).bytes)].map(([name, bytes]) =>
    [name, Buffer.from(bytes)]));
}

function mutatePart(parts, partPath, mutate) {
  const original = parts.get(partPath);
  assert.ok(original, `missing public source part ${partPath}`);
  const changed = mutate(original.toString("utf8"));
  assert.notEqual(changed, original.toString("utf8"));
  parts.set(partPath, Buffer.from(changed, "utf8"));
  return parts;
}

function zipDateFields() {
  const year = 2026;
  return {
    dosDate: ((year - 1980) << 9) | (1 << 5) | 1,
    dosTime: 0
  };
}

function createZip(entries, options = {}) {
  const { dosDate, dosTime } = zipDateFields();
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const name = Buffer.from(entry.path, "utf8");
    const data = Buffer.from(entry.bytes);
    const method = entry.method ?? options.method ?? 0;
    const flags = entry.flags ?? options.flags ?? 0x0800;
    let compressed = method === 8 ? deflateRawSync(data, { level: 9 }) : Buffer.from(data);
    if (entry.compressedSuffix) compressed = Buffer.concat([compressed, entry.compressedSuffix]);
    const checksum = entry.checksum ?? crc32(data);
    const localExtra = entry.localExtra ?? Buffer.alloc(0);
    const centralExtra = entry.centralExtra ?? Buffer.alloc(0);
    const gapAfter = entry.gapAfter ?? Buffer.alloc(0);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(localExtra.length, 28);
    localRecords.push(local, name, localExtra, compressed, gapAfter);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(centralExtra.length, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralRecords.push({ index, bytes: Buffer.concat([central, name, centralExtra]) });
    offset += local.length + name.length + localExtra.length + compressed.length + gapAfter.length;
  }
  const orderedCentral = options.reverseCentral ? [...centralRecords].reverse() : centralRecords;
  const centralDirectory = Buffer.concat(orderedCentral.flatMap((entry) => [entry.bytes]));
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localRecords, centralDirectory, end]);
}

function zipFromParts(parts, options = {}) {
  return createZip([...parts].map(([partPath, bytes]) => ({ partPath, path: partPath, bytes })), options);
}

function mutatedZip(bytes, mutate) {
  const copy = Buffer.from(bytes);
  mutate(copy);
  return copy;
}

function endOffset(bytes) {
  return bytes.length - 22;
}

function centralOffsets(bytes) {
  const end = endOffset(bytes);
  const count = bytes.readUInt16LE(end + 10);
  const offsets = [];
  let cursor = bytes.readUInt32LE(end + 16);
  for (let index = 0; index < count; index += 1) {
    offsets.push(cursor);
    cursor += 46 + bytes.readUInt16LE(cursor + 28) +
      bytes.readUInt16LE(cursor + 30) + bytes.readUInt16LE(cursor + 32);
  }
  return offsets;
}

function expectedFor(format, bytes) {
  const expected = clone(expectedPotxIndex);
  expected.templateFormat = format;
  expected.templateSha256 = createHash("sha256").update(bytes).digest("hex");
  return expected;
}

test("secure file ingestion exactly inspects the stored public POTX and PPTX", async (t) => {
  for (const format of ["potx", "pptx"]) {
    await t.test(format, async () => {
      const archive = archives.get(format);
      const result = await inspectArchive(archive.bytes, format);
      try {
        assert.deepEqual(result.index, expectedFor(format, archive.bytes));
        assert.equal(validateTemplateIndex(result.index), true);
        assert.ok(Object.isFrozen(result.index));
        assert.ok(Object.isFrozen(result.index.slides[0].shapes[0].geometry));
        assert.deepEqual(await readFile(result.source), archive.bytes);
      } finally {
        await rm(result.root, { recursive: true, force: true });
      }
    });
  }
});

test("Deflate, central-directory order, and namespace-prefix variations preserve semantics", async (t) => {
  const baseParts = clonedParts();
  const variants = [];
  variants.push(["deflate", zipFromParts(baseParts, { method: 8 })]);
  variants.push(["central order", zipFromParts(baseParts, { reverseCentral: true })]);
  const prefixParts = clonedParts();
  mutatePart(prefixParts, "ppt/slides/slide1.xml", (text) => text
    .replaceAll("<p:", "<q:")
    .replaceAll("</p:", "</q:")
    .replace("xmlns:p=", "xmlns:q="));
  variants.push(["namespace prefix", zipFromParts(prefixParts)]);
  const attributeParts = clonedParts();
  mutatePart(attributeParts, "ppt/slides/slide1.xml", (text) => text
    .replace('id="2" name="Synthetic Title"', 'name="Synthetic Title" id="2"'));
  variants.push(["attribute order", zipFromParts(attributeParts)]);
  for (const [name, bytes] of variants) {
    await t.test(name, async () => {
      const result = await inspectArchive(bytes);
      try {
        assert.deepEqual(result.index, expectedFor("potx", bytes));
      } finally {
        await rm(result.root, { recursive: true, force: true });
      }
    });
  }
});

test("filesystem admission rejects missing, non-regular, and symbolic-link sources", async (t) => {
  await t.test("missing source", async () => {
    const root = await temporaryRoot();
    try {
      const context = makeContext(root);
      await assert.rejects(
        inspectTemplateSource({ context, dependencies: { validateTemplateIndex } }),
        (error) => error instanceof TemplateIngestionError &&
          error.code === "TEMPLATE_INGESTION_SOURCE_UNAVAILABLE"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("directory source", async () => {
    const root = await temporaryRoot();
    try {
      await mkdir(path.join(root, "workspace", "template.potx"), { recursive: true });
      const context = makeContext(root);
      await assert.rejects(
        inspectTemplateSource({ context, dependencies: { validateTemplateIndex } }),
        (error) => error instanceof TemplateIngestionError &&
          error.code === "TEMPLATE_INGESTION_SOURCE_NOT_REGULAR"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("final symbolic link", { skip: process.platform === "win32" }, async () => {
    const root = await temporaryRoot();
    try {
      await mkdir(path.join(root, "workspace"));
      await writeFile(path.join(root, "workspace", "actual.potx"), archives.get("potx").bytes);
      await symlink("actual.potx", path.join(root, "workspace", "template.potx"));
      const context = makeContext(root);
      await assert.rejects(
        inspectTemplateSource({ context, dependencies: { validateTemplateIndex } }),
        (error) => error instanceof TemplateIngestionError &&
          error.code === "TEMPLATE_INGESTION_SOURCE_SYMLINK"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("intermediate symbolic link", { skip: process.platform === "win32" }, async () => {
    const root = await temporaryRoot();
    try {
      await mkdir(path.join(root, "real-workspace"));
      await writeFile(path.join(root, "real-workspace", "template.potx"), archives.get("potx").bytes);
      await symlink("real-workspace", path.join(root, "workspace"));
      const context = makeContext(root);
      await assert.rejects(
        inspectTemplateSource({ context, dependencies: { validateTemplateIndex } }),
        (error) => error instanceof TemplateIngestionError &&
          error.code === "TEMPLATE_INGESTION_SOURCE_SYMLINK"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("project-root symbolic link", { skip: process.platform === "win32" }, async () => {
    const parent = await temporaryRoot();
    try {
      const actualRoot = path.join(parent, "actual-root");
      const linkedRoot = path.join(parent, "linked-root");
      await mkdir(path.join(actualRoot, "workspace"), { recursive: true });
      await writeFile(path.join(actualRoot, "workspace", "template.potx"), archives.get("potx").bytes);
      await symlink("actual-root", linkedRoot);
      const context = makeContext(linkedRoot);
      await assert.rejects(
        inspectTemplateSource({ context, dependencies: { validateTemplateIndex } }),
        (error) => error instanceof TemplateIngestionError &&
          error.code === "TEMPLATE_INGESTION_SOURCE_SYMLINK"
      );
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});

test("archive limits and canonical layout reject traversal, aliases, bombs, and ambiguous ZIP features", async (t) => {
  const baseEntries = [...clonedParts()].map(([partPath, bytes]) => ({ path: partPath, bytes }));
  const corruptCrc = Buffer.from(archives.get("potx").bytes);
  const firstNameLength = corruptCrc.readUInt16LE(26);
  corruptCrc[30 + firstNameLength] ^= 0x01;
  const cases = [
    ["traversal member", createZip([{ path: "../escape.xml", bytes: Buffer.from("<x/>") }]), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["absolute member", createZip([{ path: "/escape.xml", bytes: Buffer.from("<x/>") }]), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["backslash member", createZip([{ path: "ppt\\escape.xml", bytes: Buffer.from("<x/>") }]), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["duplicate member", createZip([baseEntries[0], baseEntries[0], ...baseEntries.slice(1)]), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["case-conflicting member", createZip([...baseEntries, { path: "PPT/PRESENTATION.XML", bytes: Buffer.from("<x/>") }]), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["member count", createZip(Array.from({ length: 33 }, (_, index) => ({ path: `p${index}.xml`, bytes: Buffer.from("<x/>") }))), "TEMPLATE_INGESTION_RESOURCE_LIMIT"],
    ["expanded member size", createZip([{ path: "large.xml", bytes: Buffer.alloc(256 * 1024 + 1, 65) }]), "TEMPLATE_INGESTION_RESOURCE_LIMIT"],
    ["compression-ratio bomb", createZip([{ path: "bomb.xml", bytes: Buffer.alloc(64 * 1024, 65), method: 8 }]), "TEMPLATE_INGESTION_RESOURCE_LIMIT"],
    ["encrypted flag", createZip(baseEntries, { flags: 0x0801 }), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["data descriptor flag", createZip(baseEntries, { flags: 0x0808 }), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["unsupported method", createZip(baseEntries.map((entry, index) => ({ ...entry, method: index === 0 ? 99 : 0 }))), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["extra field", createZip(baseEntries.map((entry, index) => ({ ...entry, centralExtra: index === 0 ? Buffer.from([1, 0]) : undefined }))), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["CRC mismatch", corruptCrc, "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["trailing data", Buffer.concat([archives.get("potx").bytes, Buffer.from([0])]), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["nested archive", createZip([{ path: "nested.xml", bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]) }]), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["deflate trailing data", createZip([{ path: "x.xml", bytes: Buffer.from("<x/>"), method: 8, compressedSuffix: Buffer.from([0]) }]), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"]
  ];
  for (const [name, bytes, code] of cases) {
    await t.test(name, () => expectRejected(bytes, code));
  }
  await t.test("archive byte limit", async () => {
    await expectRejected(Buffer.alloc(1024 * 1024 + 1), "TEMPLATE_INGESTION_RESOURCE_LIMIT");
  });
});

test("ZIP record mutations cover EOCD, ZIP64 sentinels, header drift, gaps, offsets, and expanded total", async (t) => {
  const base = archives.get("potx").bytes;
  const firstCentral = centralOffsets(base)[0];
  const secondCentral = centralOffsets(base)[1];
  const firstLocalOffset = base.readUInt32LE(firstCentral + 42);
  const cases = [
    ["multi-disk EOCD", mutatedZip(base, (bytes) => bytes.writeUInt16LE(1, endOffset(bytes) + 4)), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["EOCD count mismatch", mutatedZip(base, (bytes) => bytes.writeUInt16LE(1, endOffset(bytes) + 8)), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["central offset drift", mutatedZip(base, (bytes) => bytes.writeUInt32LE(bytes.readUInt32LE(endOffset(bytes) + 16) + 1, endOffset(bytes) + 16)), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["ZIP64 entry-count sentinel", mutatedZip(base, (bytes) => {
      bytes.writeUInt16LE(0xffff, endOffset(bytes) + 8);
      bytes.writeUInt16LE(0xffff, endOffset(bytes) + 10);
    }), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["ZIP64 size sentinel", mutatedZip(base, (bytes) => bytes.writeUInt32LE(0xffffffff, firstCentral + 24)), "TEMPLATE_INGESTION_RESOURCE_LIMIT"],
    ["local method drift", mutatedZip(base, (bytes) => bytes.writeUInt16LE(8, firstLocalOffset + 8)), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["local CRC drift", mutatedZip(base, (bytes) => bytes.writeUInt32LE(
      (bytes.readUInt32LE(firstLocalOffset + 14) ^ 1) >>> 0,
      firstLocalOffset + 14
    )), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["local name drift", mutatedZip(base, (bytes) => { bytes[firstLocalOffset + 30] ^= 1; }), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"],
    ["reused local offset", mutatedZip(base, (bytes) => bytes.writeUInt32LE(firstLocalOffset, secondCentral + 42)), "TEMPLATE_INGESTION_ARCHIVE_REJECTED"]
  ];
  for (const [name, bytes, code] of cases) await t.test(name, () => expectRejected(bytes, code));

  await t.test("gap between local records", async () => {
    const entries = [...clonedParts()].map(([partPath, bytes], index) => ({
      path: partPath,
      bytes,
      gapAfter: index === 0 ? Buffer.from([0]) : undefined
    }));
    await expectRejected(createZip(entries), "TEMPLATE_INGESTION_ARCHIVE_REJECTED");
  });

  await t.test("declared expanded-total limit", async () => {
    const block = Buffer.alloc(8192);
    let state = 0x12345678;
    for (let index = 0; index < block.length; index += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      block[index] = state & 0xff;
    }
    const expanded = Buffer.concat(Array(27).fill(block));
    const entries = Array.from({ length: 5 }, (_, index) => ({
      path: `part${index}.xml`,
      bytes: expanded,
      method: 8
    }));
    const bytes = createZip(entries);
    assert.ok(bytes.length <= 1024 * 1024);
    assert.ok(expanded.length * entries.length > 1024 * 1024);
    const compressedSize = bytes.readUInt32LE(18);
    assert.ok(expanded.length <= compressedSize * 100, "per-entry ratio must remain within the profile");
    await expectRejected(bytes, "TEMPLATE_INGESTION_RESOURCE_LIMIT");
  });
});

test("strict XML and fail-closed OOXML grammar reject malformed or unmodeled markup", async (t) => {
  const cases = [
    ["malformed closing tag", "ppt/slides/slide1.xml", (text) => text.replace("</p:sld>", "</p:bad>")],
    ["DTD and entity declaration", "ppt/slides/slide1.xml", (text) => text.replace(
      "\n<p:sld ", "\n<!DOCTYPE p:sld [<!ENTITY injected 'x'>]>\n<p:sld "
    )],
    ["processing instruction", "ppt/slides/slide1.xml", (text) => text.replace("</p:sld>", "<?extra data?></p:sld>")],
    ["comment", "ppt/slides/slide1.xml", (text) => text.replace("</p:sld>", "<!--hidden--></p:sld>")],
    ["unknown element", "ppt/slides/slide1.xml", (text) => text.replace("</p:sld>", "<p:timing/></p:sld>")],
    ["unknown attribute", "ppt/slides/slide1.xml", (text) => text.replace("<p:sld ", '<p:sld hidden="1" ')],
    ["shape rotation", "ppt/slides/slide1.xml", (text) => text.replace("<a:xfrm>", '<a:xfrm rot="60000">')],
    ["unknown namespace", "ppt/slides/slide1.xml", (text) => text.replace("<p:sld ", '<p:sld xmlns:vendor="urn:vendor" ')]
  ];
  for (const [name, partPath, mutate] of cases) {
    await t.test(name, async () => {
      const parts = mutatePart(clonedParts(), partPath, mutate);
      await expectRejected(zipFromParts(parts), name === "malformed closing tag" ||
        name === "DTD and entity declaration" || name === "processing instruction" || name === "comment"
        ? "TEMPLATE_INGESTION_XML_REJECTED"
        : "TEMPLATE_INGESTION_OOXML_REJECTED");
    });
  }
  await t.test("invalid UTF-8", async () => {
    const parts = clonedParts();
    parts.set("ppt/slides/slide1.xml", Buffer.from([0xff]));
    await expectRejected(zipFromParts(parts), "TEMPLATE_INGESTION_XML_REJECTED");
  });
  await t.test("XML depth limit", async () => {
    const parts = clonedParts();
    parts.set("ppt/slides/slide1.xml", Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?><x>${"<x>".repeat(64)}${"</x>".repeat(64)}</x>`
    ));
    await expectRejected(zipFromParts(parts), "TEMPLATE_INGESTION_RESOURCE_LIMIT");
  });
});

test("XML namespace and aggregate limits reject aliasing, rebinding, hidden children, and exhaustion", async (t) => {
  const presentationNamespace = "http://schemas.openxmlformats.org/presentationml/2006/main";
  const relationshipNamespace = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  for (const [name, mutate] of [
    ["Default child", (text) => text
      .replace("<Types ", `<Types xmlns:p="${presentationNamespace}" `)
      .replace(/<Default ([^>]+)\/>/u, "<Default $1><p:timing/></Default>")],
    ["Override child", (text) => text
      .replace("<Types ", `<Types xmlns:p="${presentationNamespace}" `)
      .replace(/<Override ([^>]+)\/>/u, "<Override $1><p:timing/></Override>")]
  ]) {
    await t.test(`content types ${name}`, async () => {
      await expectRejected(zipFromParts(mutatePart(clonedParts(), "[Content_Types].xml", mutate)),
        "TEMPLATE_INGESTION_OOXML_REJECTED");
    });
  }

  await t.test("nested namespace rebinding", async () => {
    const parts = mutatePart(clonedParts(), "ppt/slides/slide1.xml", (text) =>
      text.replace("<p:cSld ", `<p:cSld xmlns:p="${presentationNamespace}" `));
    await expectRejected(zipFromParts(parts), "TEMPLATE_INGESTION_XML_REJECTED");
  });

  await t.test("duplicate expanded attribute through alias prefix", async () => {
    const parts = mutatePart(clonedParts(), "ppt/presentation.xml", (text) => text
      .replace("<p:presentation ", `<p:presentation xmlns:s="${relationshipNamespace}" `)
      .replace('r:id="rId1"', 'r:id="rId1" s:id="rId1"'));
    await expectRejected(zipFromParts(parts), "TEMPLATE_INGESTION_XML_REJECTED");
  });

  await t.test("per-part element limit", async () => {
    const parts = clonedParts();
    parts.set("ppt/slides/slide1.xml", Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?><p:x xmlns:p="${presentationNamespace}">${"<p:x/>".repeat(10_000)}</p:x>`
    ));
    await expectRejected(zipFromParts(parts), "TEMPLATE_INGESTION_RESOURCE_LIMIT");
  });

  await t.test("per-part attribute-total limit", async () => {
    const attributes = Array.from({ length: 25 }, (_, index) => ` a${index}="0"`).join("");
    const parts = clonedParts();
    parts.set("ppt/slides/slide1.xml", Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?><p:x xmlns:p="${presentationNamespace}">${`<p:x${attributes}/>` .repeat(401)}</p:x>`
    ));
    await expectRejected(zipFromParts(parts), "TEMPLATE_INGESTION_RESOURCE_LIMIT");
  });

  await t.test("text-node limit", async () => {
    const parts = clonedParts();
    parts.set("ppt/slides/slide1.xml", Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?><p:x xmlns:p="${presentationNamespace}">${"a".repeat(64 * 1024 + 1)}</p:x>`
    ));
    await expectRejected(zipFromParts(parts), "TEMPLATE_INGESTION_RESOURCE_LIMIT");
  });

  await t.test("package element-total limit", async () => {
    const parts = clonedParts();
    const largeDocument = Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?><p:x xmlns:p="${presentationNamespace}">${"<p:x/>".repeat(9000)}</p:x>`
    );
    for (const partPath of [
      "ppt/presProps.xml",
      "ppt/presentation.xml",
      "ppt/slideLayouts/slideLayout1.xml",
      "ppt/slideMasters/slideMaster1.xml",
      "ppt/slides/slide1.xml",
      "ppt/theme/theme1.xml"
    ]) parts.set(partPath, largeDocument);
    await expectRejected(zipFromParts(parts), "TEMPLATE_INGESTION_RESOURCE_LIMIT");
  });
});

test("relationships and high-risk OOXML constructs fail closed", async (t) => {
  const mutations = [
    ["external target mode", "ppt/slides/_rels/slide1.xml.rels", (text) =>
      text.replace("<Relationship ", '<Relationship TargetMode="External" ') , "TEMPLATE_INGESTION_EXTERNAL_RELATIONSHIP"],
    ["external URI target", "ppt/slides/_rels/slide1.xml.rels", (text) =>
      text.replace('../slideLayouts/slideLayout1.xml', "https://example.invalid/template"), "TEMPLATE_INGESTION_EXTERNAL_RELATIONSHIP"],
    ["escaping relationship target", "ppt/slides/_rels/slide1.xml.rels", (text) =>
      text.replace('../slideLayouts/slideLayout1.xml', "../../../outside.xml"), "TEMPLATE_INGESTION_OOXML_REJECTED"],
    ["macro relationship type", "ppt/slides/_rels/slide1.xml.rels", (text) =>
      text.replace("/slideLayout\"", "/vbaProject\""), "TEMPLATE_INGESTION_HIGH_RISK_CONTENT"],
    ["OLE element", "ppt/slides/slide1.xml", (text) =>
      text.replace("</p:sld>", "<p:oleObj/></p:sld>"), "TEMPLATE_INGESTION_HIGH_RISK_CONTENT"],
    ["unknown content type", "[Content_Types].xml", (text) =>
      text.replace("presentationml.slide+xml", "presentationml.notesSlide+xml"), "TEMPLATE_INGESTION_OOXML_REJECTED"],
    ["macro-enabled main type", "[Content_Types].xml", (text) =>
      text.replace("presentationml.template.main+xml", "presentationml.template.macroEnabled.main+xml"), "TEMPLATE_INGESTION_HIGH_RISK_CONTENT"]
  ];
  for (const [name, partPath, mutate, code] of mutations) {
    await t.test(name, async () => {
      await expectRejected(zipFromParts(mutatePart(clonedParts(), partPath, mutate)), code);
    });
  }
  for (const [name, partPath] of [
    ["VBA part", "ppt/vbaProject.bin"],
    ["ActiveX part", "ppt/activeX/activeX1.xml"],
    ["embedded object", "ppt/embeddings/object1.bin"]
  ]) {
    await t.test(name, async () => {
      const entries = [...clonedParts()].map(([entryPath, bytes]) => ({ path: entryPath, bytes }));
      entries.push({ path: partPath, bytes: Buffer.from("not-executed") });
      await expectRejected(createZip(entries), "TEMPLATE_INGESTION_HIGH_RISK_CONTENT");
    });
  }
});

test("boundary errors redact source paths and untrusted XML content", async () => {
  const secretName = "confidential-client-template.potx";
  const secretText = "confidential-client-marker";
  const parts = mutatePart(clonedParts(), "ppt/slides/slide1.xml", (text) =>
    text.replace("<p:sld ", `<p:sld leaked="${secretText}" `));
  const root = await temporaryRoot("redacted-ingestion-");
  const sourcePath = `workspace/${secretName}`;
  const source = path.join(root, ...sourcePath.split("/"));
  await mkdir(path.dirname(source), { recursive: true });
  await writeFile(source, zipFromParts(parts));
  const context = makeContext(root, "potx", sourcePath);
  try {
    await assert.rejects(
      inspectTemplateSource({ context, dependencies: { validateTemplateIndex } }),
      (error) => {
        assert.ok(error instanceof TemplateIngestionError);
        const visible = `${error.message}\n${JSON.stringify(error.toJSON())}`;
        for (const secret of [root, source, secretName, secretText]) {
          assert.equal(visible.includes(secret), false);
        }
        return true;
      }
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("high-level options reject injected paths, views, limits, and accessors before I/O", async () => {
  let getterCalls = 0;
  const accessorOptions = { dependencies: { validateTemplateIndex } };
  Object.defineProperty(accessorOptions, "context", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return null;
    }
  });
  await assert.rejects(
    inspectTemplateSource(accessorOptions),
    (error) => error instanceof TemplateIngestionError &&
      error.code === "TEMPLATE_INGESTION_ARGUMENT_INVALID"
  );
  assert.equal(getterCalls, 0);

  for (const key of ["path", "packageView", "limits", "resolver"]) {
    await assert.rejects(
      inspectTemplateSource({ context: null, dependencies: { validateTemplateIndex }, [key]: null }),
      (error) => error instanceof TemplateIngestionError &&
        error.code === "TEMPLATE_INGESTION_ARGUMENT_INVALID"
    );
  }
});

test("secure core has no extraction, network, process, fixture, or ambient-root dependency", async () => {
  const paths = [
    "../packages/core/src/secure-template-ingestion.mjs",
    "../packages/core/src/secure-zip.mjs",
    "../packages/core/src/strict-xml.mjs",
    "../packages/core/src/ooxml-package-view.mjs"
  ];
  const source = (await Promise.all(paths.map((relative) =>
    readFile(new URL(relative, import.meta.url), "utf8")))).join("\n");
  for (const forbidden of [
    "node:child_process",
    "node:dns",
    "node:http",
    "node:https",
    "node:net",
    "node:tls",
    "scripts/",
    "process.cwd",
    "process.env",
    "fetch("
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.equal(/from "node:fs\/promises"/u.test(source), true);
  assert.equal(/\b(?:appendFile|cp|mkdir|rename|rm|unlink|writeFile)\b/u.test(source), false);
});
