import assert from "node:assert/strict";
import {
  cp,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildSyntheticFixtures,
  crc32,
  defaultFixtureSourceRoot,
  FixtureGenerationError,
  generateSyntheticFixtures
} from "../scripts/generate-synthetic-fixtures.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const expectedArchivePaths = [
  "[Content_Types].xml",
  "_rels/.rels",
  "ppt/_rels/presentation.xml.rels",
  "ppt/presProps.xml",
  "ppt/presentation.xml",
  "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
  "ppt/slideLayouts/slideLayout1.xml",
  "ppt/slideMasters/_rels/slideMaster1.xml.rels",
  "ppt/slideMasters/slideMaster1.xml",
  "ppt/slides/_rels/slide1.xml.rels",
  "ppt/slides/slide1.xml",
  "ppt/theme/theme1.xml"
];

function parseStoredZip(bytes) {
  const entries = [];
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(bytes.readUInt16LE(offset + 4), 20, "ZIP version needed");
    assert.equal(bytes.readUInt16LE(offset + 6), 0x0800, "UTF-8 is the only ZIP flag");
    assert.equal(bytes.readUInt16LE(offset + 8), 0, "entries are stored without compression");
    assert.equal(bytes.readUInt16LE(offset + 10), 0, "fixed DOS time");
    assert.equal(bytes.readUInt16LE(offset + 12), 0x2821, "fixed 2000-01-01 DOS date");
    const checksum = bytes.readUInt32LE(offset + 14);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const uncompressedSize = bytes.readUInt32LE(offset + 22);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    assert.equal(extraLength, 0, "local headers contain no extra fields");
    assert.equal(compressedSize, uncompressedSize, "stored entry sizes match");
    const nameStart = offset + 30;
    const name = bytes.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const dataStart = nameStart + nameLength;
    const data = bytes.subarray(dataStart, dataStart + uncompressedSize);
    assert.equal(crc32(data), checksum, `${name} CRC-32`);
    entries.push({ name, data: Buffer.from(data), localOffset: offset });
    offset = dataStart + uncompressedSize;
  }

  const centralOffset = offset;
  for (const entry of entries) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50, "central-directory signature");
    assert.equal(bytes.readUInt16LE(offset + 8), 0x0800, "central UTF-8 flag");
    assert.equal(bytes.readUInt16LE(offset + 10), 0, "central storage method");
    assert.equal(bytes.readUInt16LE(offset + 12), 0, "central fixed DOS time");
    assert.equal(bytes.readUInt16LE(offset + 14), 0x2821, "central fixed DOS date");
    const nameLength = bytes.readUInt16LE(offset + 28);
    assert.equal(bytes.readUInt16LE(offset + 30), 0, "central extra length");
    assert.equal(bytes.readUInt16LE(offset + 32), 0, "central comment length");
    assert.equal(bytes.readUInt32LE(offset + 38), (0o100644 << 16) >>> 0, "fixed file mode");
    assert.equal(bytes.readUInt32LE(offset + 42), entry.localOffset, "central local offset");
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    assert.equal(name, entry.name, "central and local names match");
    offset += 46 + nameLength;
  }
  assert.equal(bytes.readUInt32LE(offset), 0x06054b50, "end-of-central-directory signature");
  assert.equal(bytes.readUInt16LE(offset + 8), entries.length, "entry count on disk");
  assert.equal(bytes.readUInt16LE(offset + 10), entries.length, "total entry count");
  assert.equal(bytes.readUInt32LE(offset + 12), offset - centralOffset, "central directory size");
  assert.equal(bytes.readUInt32LE(offset + 16), centralOffset, "central directory offset");
  assert.equal(bytes.readUInt16LE(offset + 20), 0, "ZIP comment length");
  assert.equal(offset + 22, bytes.length, "no trailing bytes");
  return new Map(entries.map((entry) => [entry.name, entry.data]));
}

async function cloneSource() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "synthetic-fixture-source-"));
  const sourceRoot = path.join(temporaryRoot, "source");
  await cp(defaultFixtureSourceRoot, sourceRoot, { recursive: true, errorOnExist: true });
  return { temporaryRoot, sourceRoot };
}

async function mutateManifest(sourceRoot, mutate) {
  const manifestPath = path.join(sourceRoot, "fixture.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  mutate(manifest);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function assertMutation(code, mutate) {
  const { temporaryRoot, sourceRoot } = await cloneSource();
  try {
    await mutate(sourceRoot);
    await assert.rejects(
      buildSyntheticFixtures({ sourceRoot }),
      (error) => error instanceof FixtureGenerationError && error.code === code,
      `expected ${code}`
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

test("synthetic PPTX and POTX archives are byte-deterministic", async () => {
  const first = await buildSyntheticFixtures();
  const second = await buildSyntheticFixtures();
  assert.equal(first.fixtureId, "minimal-text-presentation");
  assert.deepEqual(first.archives.map(({ variant, filename, sha256 }) => ({ variant, filename, sha256 })), [
    {
      variant: "potx",
      filename: "synthetic-minimal.potx",
      sha256: first.archives[0].sha256
    },
    {
      variant: "pptx",
      filename: "synthetic-minimal.pptx",
      sha256: first.archives[1].sha256
    }
  ]);
  for (let index = 0; index < first.archives.length; index += 1) {
    assert.deepEqual(first.archives[index].bytes, second.archives[index].bytes);
    assert.equal(first.archives[index].sha256, second.archives[index].sha256);
  }
});

test("archives contain the reviewed minimal PresentationML graph and deterministic ZIP metadata", async () => {
  const { archives } = await buildSyntheticFixtures();
  const parsed = archives.map((archive) => ({ archive, parts: parseStoredZip(archive.bytes) }));
  for (const { archive, parts } of parsed) {
    assert.deepEqual([...parts.keys()], expectedArchivePaths, `${archive.variant} entry order`);
    const presentation = parts.get("ppt/presentation.xml").toString("utf8");
    const masterId = Number(/<p:sldMasterId id="([0-9]+)"/u.exec(presentation)?.[1]);
    const slideId = Number(/<p:sldId id="([0-9]+)"/u.exec(presentation)?.[1]);
    const layoutId = Number(/<p:sldLayoutId id="([0-9]+)"/u.exec(
      parts.get("ppt/slideMasters/slideMaster1.xml").toString("utf8")
    )?.[1]);
    assert.ok(masterId >= 2147483648, "master IDs occupy the schema's unsigned high range");
    assert.ok(layoutId >= 2147483648, "layout IDs occupy the schema's unsigned high range");
    assert.ok(slideId >= 256 && slideId < 2147483648, "slide ID is in the schema's slide range");
    assert.match(parts.get("ppt/slides/slide1.xml").toString("utf8"), /Synthetic Fixture/u);
    assert.match(parts.get("ppt/slideMasters/slideMaster1.xml").toString("utf8"), /<p:sldMaster\b/u);
    assert.match(parts.get("ppt/slideLayouts/slideLayout1.xml").toString("utf8"), /<p:sldLayout\b/u);
    assert.match(parts.get("ppt/theme/theme1.xml").toString("utf8"), /<a:theme\b/u);
  }

  const potx = parsed[0];
  const pptx = parsed[1];
  for (const partPath of expectedArchivePaths) {
    if (partPath === "[Content_Types].xml") continue;
    assert.deepEqual(potx.parts.get(partPath), pptx.parts.get(partPath), `${partPath} is variant-independent`);
  }
  assert.match(
    potx.parts.get("[Content_Types].xml").toString("utf8"),
    /presentationml\.template\.main\+xml/u
  );
  assert.match(
    pptx.parts.get("[Content_Types].xml").toString("utf8"),
    /presentationml\.presentation\.main\+xml/u
  );
});

test("reviewed sources are text-only, branding-free, and contain no high-risk package features", async () => {
  const manifest = JSON.parse(await readFile(path.join(defaultFixtureSourceRoot, "fixture.json"), "utf8"));
  const combined = [];
  for (const part of manifest.parts) {
    const sourcePath = path.join(defaultFixtureSourceRoot, ...part.source.split("/"));
    const metadata = await lstat(sourcePath);
    const bytes = await readFile(sourcePath);
    const text = bytes.toString("utf8");
    assert.equal(metadata.isFile(), true);
    assert.equal(bytes.includes(0), false);
    assert.equal(text.includes("\r"), false);
    assert.equal(text.startsWith("\uFEFF"), false);
    combined.push(text);
  }
  const text = combined.join("\n");
  assert.doesNotMatch(text, /Microsoft|Apple|Google|Adobe/iu);
  assert.doesNotMatch(text, /<!DOCTYPE\b|<!ENTITY\b|TargetMode=|vbaProject|activeX|oleObject|embeddedPackage/iu);
  assert.doesNotMatch(text, /<p:(?:control|oleObj)\b/iu);
  assert.match(text, /Repository-owned text-only OOXML/u);
});

test("create-only generation atomically publishes exactly two ignored outputs", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "synthetic-fixture-output-"));
  const outputDir = path.join(temporaryRoot, "generated");
  try {
    const report = await generateSyntheticFixtures({ outputDir });
    assert.deepEqual(report.files.map((file) => file.filename), [
      "synthetic-minimal.potx",
      "synthetic-minimal.pptx"
    ]);
    const names = (await readdir(outputDir)).sort();
    assert.deepEqual(names, ["synthetic-minimal.potx", "synthetic-minimal.pptx"]);
    const built = await buildSyntheticFixtures();
    for (let index = 0; index < built.archives.length; index += 1) {
      assert.deepEqual(
        await readFile(path.join(outputDir, built.archives[index].filename)),
        built.archives[index].bytes
      );
      assert.equal(report.files[index].sha256, built.archives[index].sha256);
    }
    await assert.rejects(
      generateSyntheticFixtures({ outputDir }),
      (error) => error instanceof FixtureGenerationError && error.code === "output-exists"
    );
    assert.deepEqual((await readdir(outputDir)).sort(), names, "failed rerun leaves published files unchanged");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("output errors are fail-closed without disclosing the requested path", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "synthetic-fixture-invalid-output-"));
  const outputPath = path.join(temporaryRoot, "not-a-directory");
  try {
    await writeFile(outputPath, "occupied\n", "utf8");
    await assert.rejects(
      generateSyntheticFixtures({ outputDir: outputPath }),
      (error) => error instanceof FixtureGenerationError
        && error.code === "invalid-output"
        && !error.message.includes(outputPath)
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("mutation: archive path traversal is rejected", async () => {
  await assertMutation("unsafe-path", (sourceRoot) => mutateManifest(sourceRoot, (manifest) => {
    manifest.parts[0].path = "../outside.xml";
  }));
});

test("mutation: case-conflicting archive paths are rejected", async () => {
  await assertMutation("duplicate-entry", (sourceRoot) => mutateManifest(sourceRoot, (manifest) => {
    manifest.parts[1].path = manifest.parts[0].path.toLocaleLowerCase("en-US");
    manifest.parts[1].source = `parts/${manifest.parts[1].path}`;
  }));
});

test("mutation: unsorted manifest entries are rejected", async () => {
  await assertMutation("nondeterministic-order", (sourceRoot) => mutateManifest(sourceRoot, (manifest) => {
    [manifest.parts[0], manifest.parts[1]] = [manifest.parts[1], manifest.parts[0]];
  }));
});

test("mutation: unlisted source-part drift is rejected", async () => {
  await assertMutation("source-drift", async (sourceRoot) => {
    await writeFile(path.join(sourceRoot, "parts", "unreviewed.xml"), "<unreviewed/>\n", "utf8");
  });
});

test("mutation: a manifest cannot expand the independently reviewed part set", async () => {
  await assertMutation("unreviewed-part-set", (sourceRoot) => mutateManifest(sourceRoot, (manifest) => {
    manifest.parts[manifest.parts.length - 1].path = "ppt/unreviewed.xml";
    manifest.parts[manifest.parts.length - 1].source = "parts/ppt/unreviewed.xml";
  }));
});

test("mutation: a source-part symlink is rejected without being followed", async () => {
  await assertMutation("source-symlink", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "ppt", "presProps.xml");
    await rm(target);
    await symlink("presentation.xml", target);
  });
});

test("mutation: oversized source parts are rejected", async () => {
  await assertMutation("part-too-large", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "ppt", "presProps.xml");
    await writeFile(target, "x".repeat(262145), "utf8");
  });
});

test("mutation: XML document type declarations are rejected", async () => {
  await assertMutation("unsafe-xml", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "ppt", "presProps.xml");
    const original = await readFile(target, "utf8");
    await writeFile(target, original.replace("<p:presentationPr", "<!DOCTYPE x>\n<p:presentationPr"), "utf8");
  });
});

test("mutation: external relationships are rejected", async () => {
  await assertMutation("external-relationship", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "ppt", "_rels", "presentation.xml.rels");
    const original = await readFile(target, "utf8");
    await writeFile(target, original.replace(
      "Target=\"slides/slide1.xml\"",
      "Target=\"https://example.invalid/slide.xml\""
    ), "utf8");
  });
});

test("mutation: an explicit-end relationship cannot bypass graph validation", async () => {
  await assertMutation("noncanonical-relationship-element", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "ppt", "_rels", "presentation.xml.rels");
    const original = await readFile(target, "utf8");
    const injected = "  <Relationship Id=\"rId9\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink\" Target=\"https://example.invalid/\"></Relationship>\n";
    await writeFile(target, original.replace("</Relationships>", `${injected}</Relationships>`), "utf8");
  });
});

test("mutation: missing internal relationship targets are rejected", async () => {
  await assertMutation("missing-relationship-target", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "ppt", "_rels", "presentation.xml.rels");
    const original = await readFile(target, "utf8");
    await writeFile(target, original.replace("slides/slide1.xml", "slides/missing.xml"), "utf8");
  });
});

test("mutation: a semantically wrong internal relationship is rejected", async () => {
  await assertMutation("unreviewed-relationship-graph", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "ppt", "_rels", "presentation.xml.rels");
    const original = await readFile(target, "utf8");
    await writeFile(target, original.replace(
      "Target=\"slides/slide1.xml\"",
      "Target=\"slideLayouts/slideLayout1.xml\""
    ), "utf8");
  });
});

test("mutation: dangling owner relationship IDs are rejected", async () => {
  await assertMutation("unreviewed-owner-relationship-reference", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "ppt", "presentation.xml");
    const original = await readFile(target, "utf8");
    await writeFile(target, original.replace('r:id="rId3"', 'r:id="rId9"'), "utf8");
  });
});

test("mutation: owner relationship IDs cannot move to unrelated elements", async () => {
  await assertMutation("unreviewed-owner-relationship-reference", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "ppt", "presentation.xml");
    const original = await readFile(target, "utf8");
    await writeFile(target, original
      .replace("<p:sldIdLst>", '<p:sldIdLst r:id="rId3">')
      .replace(' id="300" r:id="rId3"', ' id="300"'), "utf8");
  });
});

test("mutation: unreviewed embedded relationship references are rejected", async () => {
  await assertMutation("unreviewed-owner-relationship-reference", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "ppt", "slides", "slide1.xml");
    const original = await readFile(target, "utf8");
    await writeFile(target, original.replace(
      "</p:spTree>",
      "  <a:blip r:embed=\"rId9\"/>\n    </p:spTree>"
    ), "utf8");
  });
});

test("mutation: an unreviewed non-main content type is rejected", async () => {
  await assertMutation("unreviewed-content-type", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "[Content_Types].xml");
    const original = await readFile(target, "utf8");
    await writeFile(target, original.replace(
      "application/vnd.openxmlformats-officedocument.theme+xml",
      "application/xml"
    ), "utf8");
  });
});

test("mutation: an explicit-end Override cannot bypass content-type validation", async () => {
  await assertMutation("noncanonical-content-type-element", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "[Content_Types].xml");
    const original = await readFile(target, "utf8");
    const injected = "  <Override PartName=\"/ppt/unreviewed.xml\" ContentType=\"application/xml\"></Override>\n";
    await writeFile(target, original.replace("</Types>", `${injected}</Types>`), "utf8");
  });
});

test("mutation: an extra default content type is rejected", async () => {
  await assertMutation("unreviewed-default-content-types", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "[Content_Types].xml");
    const original = await readFile(target, "utf8");
    const injected = "  <Default Extension=\"bin\" ContentType=\"application/octet-stream\"/>\n";
    await writeFile(target, original.replace("</Types>", `${injected}</Types>`), "utf8");
  });
});

test("mutation: an unknown relationship sibling is rejected", async () => {
  await assertMutation("noncanonical-xml-container", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "_rels", ".rels");
    const original = await readFile(target, "utf8");
    await writeFile(target, original.replace("</Relationships>", "  <Unknown/>\n</Relationships>"), "utf8");
  });
});

test("mutation: high-risk OOXML tags are rejected under alternate prefixes", async () => {
  await assertMutation("high-risk-ooxml", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "ppt", "presProps.xml");
    const original = await readFile(target, "utf8");
    await writeFile(target, original.replace("/>", "><x:oleObj xmlns:x=\"urn:synthetic\"/></p:presentationPr>"), "utf8");
  });
});

test("mutation: macro relationship markers are rejected", async () => {
  await assertMutation("high-risk-ooxml", async (sourceRoot) => {
    const target = path.join(sourceRoot, "parts", "ppt", "_rels", "presentation.xml.rels");
    const original = await readFile(target, "utf8");
    await writeFile(target, original.replace("presProps", "vbaProject"), "utf8");
  });
});

test("mutation: relaxed manifest resource limits are rejected", async () => {
  await assertMutation("invalid-limit", (sourceRoot) => mutateManifest(sourceRoot, (manifest) => {
    manifest.limits.maxPackageBytes = 4 * 1024 * 1024 + 1;
  }));
});

test("fixture output remains ignored and no generated archive is tracked", async () => {
  const ignore = await readFile(path.join(projectRoot, ".gitignore"), "utf8");
  assert.match(ignore, /^fixtures\/generated\/$/mu);
  assert.match(ignore, /^\*\.pptx$/mu);
  assert.match(ignore, /^\*\.potx$/mu);
});
