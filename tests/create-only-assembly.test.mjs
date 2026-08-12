import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assembleCloneFillPresentation,
  assembleSourcePreservingPresentation,
  CREATE_ONLY_ASSEMBLY_VERSION,
  CreateOnlyAssemblyError,
  publishCreateOnlyPresentation
} from "../packages/core/src/create-only-assembly.mjs";
import { buildSecureTemplatePackageView } from "../packages/core/src/ooxml-package-view.mjs";
import { parseSecureZip, SECURE_ZIP_LIMITS } from "../packages/core/src/secure-zip.mjs";
import { parseStrictXml } from "../packages/core/src/strict-xml.mjs";
import { executeSourceSlideCloneFill } from "../plugins/clone-fill/src/source-slide-clone-fill.mjs";
import { buildSyntheticFixtures } from "../scripts/generate-synthetic-fixtures.mjs";

const readJson = async (relativePath) => JSON.parse(await readFile(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8"
));

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function collectText(node, output = []) {
  if (node.localName === "t" &&
      node.namespaceURI === "http://schemas.openxmlformats.org/drawingml/2006/main") {
    output.push(node.text);
  }
  for (const child of node.children) collectText(child, output);
  return output;
}

function planForPublicTemplate({ body = ["Evidence supports the recommendation"], title = "Decision-ready synthesis" } = {}) {
  return deepFreeze(executeSourceSlideCloneFill({
    invocationId: "assembled-slide-one",
    payload: { body, title },
    bindings: [
      {
        role: "body",
        shapeBindingId: "body-binding",
        containerKind: "slide",
        containerKey: "slide-1",
        shapeKey: "shape-2",
        expectedKind: "text-box",
        cardinality: "exactly-one"
      },
      {
        role: "title",
        shapeBindingId: "title-binding",
        containerKind: "slide",
        containerKey: "slide-1",
        shapeKey: "shape-1",
        expectedKind: "text-box",
        cardinality: "exactly-one"
      }
    ]
  }));
}

const fixtureBuild = await buildSyntheticFixtures();
const sourceArchive = fixtureBuild.archives.find((archive) => archive.variant === "potx");
const templateIndex = deepFreeze(await readJson("fixtures/inspection/expected-potx-template-index.json"));

function assertAssemblyError(error, code, pointer) {
  assert.ok(error instanceof CreateOnlyAssemblyError);
  assert.equal(error.code, code);
  assert.equal(error.pointer, pointer);
  assert.deepEqual(error.toJSON(), { code, pointer });
  return true;
}

test("M2-005A assembles one real PPTX with only declared part changes", () => {
  assert.equal(CREATE_ONLY_ASSEMBLY_VERSION, "0.1.0");
  assert.equal(digest(sourceArchive.bytes), templateIndex.templateSha256);
  const sourceBefore = Buffer.from(sourceArchive.bytes);
  const result = assembleCloneFillPresentation({
    sourceArchiveBytes: sourceArchive.bytes,
    templateIndex,
    plan: planForPublicTemplate()
  });

  assert.ok(result.archiveBytes instanceof Uint8Array);
  assert.equal(digest(sourceArchive.bytes), digest(sourceBefore));
  assert.equal(result.report.artifactType, "assembled-pptx");
  assert.equal(result.report.outputSlideId, "assembled-slide-one");
  assert.equal(result.report.outputSha256, digest(result.archiveBytes));
  assert.deepEqual(result.report.diff, {
    addedParts: [],
    removedParts: [],
    modifiedParts: ["[Content_Types].xml", "ppt/slides/slide1.xml"],
    allowedChanges: [
      { partPath: "[Content_Types].xml", reason: "template-to-presentation" },
      { partPath: "ppt/slides/slide1.xml", reason: "clone-fill-text" }
    ],
    collateralChanges: []
  });

  const outputView = buildSecureTemplatePackageView({
    sourceLocation: path.resolve("/public-output.pptx"),
    archiveBytes: result.archiveBytes
  });
  assert.equal(outputView.templateFormat, "pptx");
  const parts = parseSecureZip(result.archiveBytes);
  assert.deepEqual(
    collectText(parseStrictXml(parts.get("ppt/slides/slide1.xml")).root),
    ["Decision-ready synthesis", "Evidence supports the recommendation"]
  );
  for (const [partPath, sourceBytes] of parseSecureZip(sourceArchive.bytes)) {
    if (!["[Content_Types].xml", "ppt/slides/slide1.xml"].includes(partPath)) {
      assert.ok(Buffer.from(sourceBytes).equals(parts.get(partPath)), `${partPath} changed`);
    }
  }
});

test("M2-005A output is byte-deterministic", () => {
  const options = {
    sourceArchiveBytes: sourceArchive.bytes,
    templateIndex,
    plan: planForPublicTemplate({ title: "Stable output", body: ["Same semantic input"] })
  };
  const first = assembleCloneFillPresentation(options);
  const second = assembleCloneFillPresentation(options);
  assert.ok(first.archiveBytes.equals(second.archiveBytes));
  assert.deepEqual(first.report, second.report);
});

test("source-preserving base converges with an exact source-text clone/fill", () => {
  const sourceOwned = assembleSourcePreservingPresentation({
    sourceArchiveBytes: sourceArchive.bytes,
    templateIndex,
    outputSlideId: "assembled-slide-one"
  });
  const exactCloneFill = assembleCloneFillPresentation({
    sourceArchiveBytes: sourceArchive.bytes,
    templateIndex,
    plan: planForPublicTemplate({
      title: "Synthetic Fixture",
      body: ["Repository-owned text-only OOXML"]
    })
  });

  assert.deepEqual(sourceOwned.archiveBytes, exactCloneFill.archiveBytes);
  assert.equal(sourceOwned.report.outputSha256, exactCloneFill.report.outputSha256);
  assert.equal(sourceOwned.report.outputSlideId, "assembled-slide-one");
  assert.deepEqual(sourceOwned.report.diff.collateralChanges, []);
});

test("M2-005A fails closed for unsupported paragraphs and semantic targets", () => {
  assert.throws(
    () => assembleCloneFillPresentation({
      sourceArchiveBytes: sourceArchive.bytes,
      templateIndex,
      plan: planForPublicTemplate({ body: ["Paragraph one", "Paragraph two"] })
    }),
    (error) => assertAssemblyError(error, "ASSEMBLY_PLAN_UNSUPPORTED", "/plan/fills/0")
  );

  const unknownTarget = structuredClone(planForPublicTemplate());
  unknownTarget.fills[0].sourceShapeKey = "missing-shape";
  deepFreeze(unknownTarget);
  assert.throws(
    () => assembleCloneFillPresentation({
      sourceArchiveBytes: sourceArchive.bytes,
      templateIndex,
      plan: unknownTarget
    }),
    (error) => assertAssemblyError(error, "ASSEMBLY_TARGET_INVALID", "/plan/fills/sourceShapeKey")
  );

  const mutablePlan = structuredClone(planForPublicTemplate());
  assert.throws(
    () => assembleCloneFillPresentation({
      sourceArchiveBytes: sourceArchive.bytes,
      templateIndex,
      plan: mutablePlan
    }),
    (error) => assertAssemblyError(error, "ASSEMBLY_ARGUMENT_INVALID", "/plan")
  );
});

test("M2-005A binds the exact admitted source digest", () => {
  const changedIndex = structuredClone(templateIndex);
  changedIndex.templateSha256 = "0".repeat(64);
  deepFreeze(changedIndex);
  assert.throws(
    () => assembleCloneFillPresentation({
      sourceArchiveBytes: sourceArchive.bytes,
      templateIndex: changedIndex,
      plan: planForPublicTemplate()
    }),
    (error) => assertAssemblyError(error, "ASSEMBLY_SOURCE_MISMATCH", "/templateIndex")
  );
});

test("M2-005A re-derives exact slide and shape facts instead of trusting index keys", () => {
  const swappedSourceIds = structuredClone(templateIndex);
  [
    swappedSourceIds.slides[0].shapes[0].sourceId,
    swappedSourceIds.slides[0].shapes[1].sourceId
  ] = [
    swappedSourceIds.slides[0].shapes[1].sourceId,
    swappedSourceIds.slides[0].shapes[0].sourceId
  ];
  deepFreeze(swappedSourceIds);
  assert.throws(
    () => assembleCloneFillPresentation({
      sourceArchiveBytes: sourceArchive.bytes,
      templateIndex: swappedSourceIds,
      plan: planForPublicTemplate()
    }),
    (error) => assertAssemblyError(
      error,
      "ASSEMBLY_SOURCE_MISMATCH",
      "/templateIndex/slides/0/shapes/0"
    )
  );

  const swappedShapeKeys = structuredClone(templateIndex);
  [
    swappedShapeKeys.slides[0].shapes[0].shapeKey,
    swappedShapeKeys.slides[0].shapes[1].shapeKey
  ] = [
    swappedShapeKeys.slides[0].shapes[1].shapeKey,
    swappedShapeKeys.slides[0].shapes[0].shapeKey
  ];
  deepFreeze(swappedShapeKeys);
  assert.throws(
    () => assembleCloneFillPresentation({
      sourceArchiveBytes: sourceArchive.bytes,
      templateIndex: swappedShapeKeys,
      plan: planForPublicTemplate()
    }),
    (error) => assertAssemblyError(
      error,
      "ASSEMBLY_SOURCE_MISMATCH",
      "/templateIndex/slides/0/shapes/0"
    )
  );
});

test("archive byte ceilings apply before assembly or publication snapshots", async () => {
  const oversized = Buffer.alloc(SECURE_ZIP_LIMITS.maxArchiveBytes + 1);
  assert.throws(
    () => assembleCloneFillPresentation({
      sourceArchiveBytes: oversized,
      templateIndex,
      plan: planForPublicTemplate()
    }),
    (error) => assertAssemblyError(
      error,
      "ASSEMBLY_SOURCE_MISMATCH",
      "/sourceArchiveBytes"
    )
  );
  await assert.rejects(
    publishCreateOnlyPresentation({
      archiveBytes: oversized,
      destinationPath: path.join(os.tmpdir(), "bounded-output.pptx")
    }),
    (error) => assertAssemblyError(error, "ASSEMBLY_OUTPUT_INVALID", "/archiveBytes")
  );
});

test("publication is create-only, atomic, and leaves the source file unchanged", async () => {
  const tempRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), "pptx-assembly-")));
  try {
    const sourcePath = path.join(tempRoot, "source.potx");
    const destinationPath = path.join(tempRoot, "output.pptx");
    await writeFile(sourcePath, sourceArchive.bytes, { flag: "wx", mode: 0o600 });
    const sourceBefore = await readFile(sourcePath);
    const assembled = assembleCloneFillPresentation({
      sourceArchiveBytes: sourceBefore,
      templateIndex,
      plan: planForPublicTemplate()
    });
    const publication = await publishCreateOnlyPresentation({
      archiveBytes: assembled.archiveBytes,
      destinationPath
    });
    assert.deepEqual(publication, {
      publicationVersion: "0.1.0",
      artifactType: "published-pptx",
      bytes: assembled.archiveBytes.length,
      sha256: assembled.report.outputSha256
    });
    assert.ok((await readFile(destinationPath)).equals(assembled.archiveBytes));
    assert.ok((await readFile(sourcePath)).equals(sourceBefore));
    assert.deepEqual((await readdir(tempRoot)).sort(), ["output.pptx", "source.potx"]);

    await assert.rejects(
      publishCreateOnlyPresentation({ archiveBytes: assembled.archiveBytes, destinationPath }),
      (error) => assertAssemblyError(error, "ASSEMBLY_OUTPUT_EXISTS", "/destination")
    );
    assert.ok((await readFile(destinationPath)).equals(assembled.archiveBytes));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
