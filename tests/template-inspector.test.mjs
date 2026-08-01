import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ProjectContextError,
  createProjectContext
} from "../packages/core/src/project-context.mjs";
import {
  TEMPLATE_INSPECTOR_VERSION,
  TEMPLATE_PACKAGE_VIEW_VERSION,
  TemplateInspectionError,
  inspectTemplate
} from "../packages/core/src/template-inspector.mjs";
import {
  FixtureGenerationError,
  buildSyntheticFixtures,
  createReviewedFixturePackageView,
  defaultFixtureSourceRoot
} from "../scripts/generate-synthetic-fixtures.mjs";
import {
  assertSupportedSchema,
  createSchemaRegistry,
  validateJson
} from "../scripts/lib/json-schema.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
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
const schemaOnlyIndex = JSON.parse(await readFile(
  new URL("../fixtures/contracts/valid/template-index.json", import.meta.url),
  "utf8"
));
const builtFixtures = await buildSyntheticFixtures();
const archives = new Map(builtFixtures.archives.map((archive) => [archive.variant, archive]));
const filesystemRoot = path.parse(process.execPath).root;
const defaultProjectRoot = path.join(filesystemRoot, "public-template-inspection-project");
const RELATIONSHIP_SENTINEL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
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

function makeConfig(format = "potx", mutate = () => {}) {
  const config = clone(baseProjectConfig);
  config.template.sourcePath = `workspace/template.${format}`;
  mutate(config);
  return config;
}

function makeContext(format = "potx", options = {}) {
  return createProjectContext({
    projectRoot: options.projectRoot ?? defaultProjectRoot,
    projectConfig: options.projectConfig ?? makeConfig(format),
    dependencies: { validateProjectConfig }
  });
}

function makeView(format = "potx", context = makeContext(format)) {
  return createReviewedFixturePackageView({
    archive: archives.get(format),
    sourceLocation: context.locations.templateSource
  });
}

function inspect(format = "potx", overrides = {}) {
  const context = overrides.context ?? makeContext(format);
  const packageView = overrides.packageView ?? makeView(format, context);
  return inspectTemplate({
    context,
    packageView,
    dependencies: {
      validateTemplateIndex: overrides.validateTemplateIndex ?? validateTemplateIndex
    }
  });
}

function assertInspectionError(callback, code, pointer, secrets = []) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof TemplateInspectionError);
    assert.equal(error.code, code);
    if (pointer !== undefined) assert.equal(error.pointer, pointer);
    assert.deepEqual(error.toJSON(), { code, pointer: error.pointer });
    for (const secret of secrets) {
      assert.equal(error.message.includes(secret), false);
      assert.equal(JSON.stringify(error.toJSON()).includes(secret), false);
    }
    return true;
  });
}

function mutableView(format = "potx", context = makeContext(format)) {
  return clone(makeView(format, context));
}

function relationshipSet(view, ownerPart) {
  return view.relationshipSets.find((entry) => entry.ownerPart === ownerPart);
}

function contentPart(view, contentTypeFragment) {
  return view.contentParts.find((entry) => entry.contentType.includes(contentTypeFragment));
}

function addSecondMasterBranch(view, layoutSourceId) {
  const presentationOwner = relationshipSet(view, "ppt/presentation.xml");
  const masterRelationshipType = presentationOwner.relationships.find((entry) =>
    entry.relationshipType.endsWith("/slideMaster")).relationshipType;
  const layoutRelationshipType = relationshipSet(
    view,
    "ppt/slideMasters/slideMaster1.xml"
  ).relationships.find((entry) => entry.relationshipType.endsWith("/slideLayout")).relationshipType;
  const themeRelationship = relationshipSet(
    view,
    "ppt/slideMasters/slideMaster1.xml"
  ).relationships.find((entry) => entry.relationshipType.endsWith("/theme"));
  const reciprocalType = relationshipSet(
    view,
    "ppt/slideLayouts/slideLayout1.xml"
  ).relationships[0].relationshipType;
  const masterContentType = contentPart(view, ".slideMaster+xml").contentType;
  const layoutContentType = contentPart(view, ".slideLayout+xml").contentType;
  const masterPart = "ppt/slideMasters/slideMaster2.xml";
  const layoutPart = "ppt/slideLayouts/slideLayout2.xml";

  view.contentParts.push({ partPath: masterPart, contentType: masterContentType });
  view.contentParts.push({ partPath: layoutPart, contentType: layoutContentType });
  presentationOwner.relationships.push({
    relationshipId: "rId5",
    relationshipType: masterRelationshipType,
    targetPart: masterPart
  });
  view.presentation.masterReferences.push({ sourceId: 2147483902, relationshipId: "rId5" });
  view.relationshipSets.push({
    ownerPart: masterPart,
    relationships: [
      { relationshipId: "rId1", relationshipType: layoutRelationshipType, targetPart: layoutPart },
      { ...themeRelationship, relationshipId: "rId2" }
    ]
  });
  view.relationshipSets.push({
    ownerPart: layoutPart,
    relationships: [
      { relationshipId: "rId1", relationshipType: reciprocalType, targetPart: masterPart }
    ]
  });
  view.masters.push({
    partPath: masterPart,
    layoutReferences: [{ sourceId: layoutSourceId, relationshipId: "rId1" }]
  });
  view.layouts.push({ partPath: layoutPart, shapes: [] });
}

function forgeContext(context, mutate) {
  const forged = {
    contextVersion: context.contextVersion,
    contextType: context.contextType,
    projectRoot: context.projectRoot,
    projectConfig: clone(context.projectConfig),
    locations: clone(context.locations),
    dependencies: { validateProjectConfig: context.dependencies.validateProjectConfig }
  };
  mutate(forged);
  return deepFreeze(forged);
}

async function cloneReviewedFixtureSource() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "inspection-source-"));
  const sourceRoot = path.join(temporaryRoot, "source");
  await cp(defaultFixtureSourceRoot, sourceRoot, { recursive: true, errorOnExist: true });
  return { temporaryRoot, sourceRoot };
}

test("reviewed fixture producer emits deterministic bound package views", () => {
  const context = makeContext();
  const first = makeView("potx", context);
  const second = makeView("potx", context);

  assert.equal(first.viewVersion, TEMPLATE_PACKAGE_VIEW_VERSION);
  assert.equal(first.viewType, "template-package-view");
  assert.equal(first.producerClass, "reviewed-fixture-producer");
  assert.equal(first.sourceLocation, context.locations.templateSource);
  assert.equal(first.archiveSha256, archives.get("potx").sha256);
  assert.deepEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.presentation));
  assert.ok(Object.isFrozen(first.slides[0].shapes[0].geometry));
  assert.equal(Object.hasOwn(archives.get("potx").inspectionViewData, "sourceLocation"), false);
});

test("POTX inspection exactly matches the execution golden and normative schema", () => {
  const actual = inspect("potx");
  assert.deepEqual(actual, expectedPotxIndex);
  assert.equal(validateTemplateIndex(actual), true);
  assert.equal(actual.schemaVersion, TEMPLATE_INSPECTOR_VERSION);
  assert.notDeepEqual(actual, schemaOnlyIndex, "schema-only data must not become the execution oracle");
  assert.ok(Object.isFrozen(actual));
  assert.ok(Object.isFrozen(actual.layouts));
  assert.ok(Object.isFrozen(actual.slides[0].shapes[0].geometry));
});

test("PPTX inspection differs only in exact archive-bound format facts", () => {
  const actual = inspect("pptx");
  const expected = clone(expectedPotxIndex);
  expected.templateFormat = "pptx";
  expected.templateSha256 = archives.get("pptx").sha256;
  assert.deepEqual(actual, expected);
  assert.notEqual(actual.templateSha256, archives.get("potx").sha256);
  assert.equal(validateTemplateIndex(actual), true);
});

test("inspection output bytes are deterministic and path/content redacted", () => {
  const context = makeContext();
  const first = inspect("potx", { context });
  const second = inspect("potx", { context });
  const serialized = JSON.stringify(first);

  assert.equal(serialized, JSON.stringify(second));
  for (const forbidden of [
    context.projectRoot,
    context.locations.templateSource,
    "template.potx",
    "Synthetic Fixture",
    "Repository-owned text-only OOXML",
    "Synthetic Sans",
    "Synthetic Text Slide"
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("context IDs drive output and no fixture identity is hard-coded by the inspector", () => {
  const config = makeConfig("potx", (value) => {
    value.template.indexId = "alternate-template-index";
    value.template.profileId = "alternate-template-profile";
  });
  const context = makeContext("potx", { projectConfig: config });
  const actual = inspect("potx", { context });
  assert.equal(actual.templateIndexId, "alternate-template-index");
  assert.equal(actual.templateProfileId, "alternate-template-profile");
  assert.deepEqual(actual.slides[0].shapes.map((shape) => shape.shapeKey), ["shape-1", "shape-2"]);
});

test("shape keys preserve package-view z-order instead of deriving from source IDs", () => {
  const context = makeContext();
  const view = mutableView("potx", context);
  view.slides[0].shapes.reverse();
  const actual = inspect("potx", { context, packageView: view });
  assert.deepEqual(actual.slides[0].shapes.map(({ shapeKey, sourceId }) => ({ shapeKey, sourceId })), [
    { shapeKey: "shape-1", sourceId: 3 },
    { shapeKey: "shape-2", sourceId: 2 }
  ]);
});

test("reviewed producer derives geometry from source while names and text stay out of the index", async () => {
  const { temporaryRoot, sourceRoot } = await cloneReviewedFixtureSource();
  try {
    const slidePath = path.join(sourceRoot, "parts", "ppt", "slides", "slide1.xml");
    const original = await readFile(slidePath, "utf8");
    const changed = original
      .replace('name="Synthetic Title"', 'name="Changed Public Name"')
      .replace("<a:t>Synthetic Fixture</a:t>", "<a:t>Changed public text</a:t>")
      .replace('x="914400" y="1285875"', 'x="914401" y="1285875"');
    assert.notEqual(changed, original);
    await writeFile(slidePath, changed, "utf8");

    const built = await buildSyntheticFixtures({ sourceRoot });
    const archive = built.archives.find((entry) => entry.variant === "potx");
    const context = makeContext();
    const packageView = createReviewedFixturePackageView({
      archive,
      sourceLocation: context.locations.templateSource
    });
    const actual = inspect("potx", { context, packageView });
    assert.equal(actual.slides[0].shapes[0].geometry.x, 914401);
    assert.notEqual(actual.templateSha256, expectedPotxIndex.templateSha256);
    assert.equal(JSON.stringify(actual).includes("Changed Public Name"), false);
    assert.equal(JSON.stringify(actual).includes("Changed public text"), false);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("reviewed producer rejects shape facts outside its bounded view mapping", async (t) => {
  for (const [name, mutate] of [
    ["contradictory text-box metadata", (text) => text.replace('txBox="1"', 'txBox="2"')],
    ["unsupported group shape", (text) => text.replace("<p:sp>", "<p:grpSp>")],
    ["placeholder and text-box conflict", (text) => text.replace(
      '<p:cNvSpPr txBox="1"/>\n          <p:nvPr/>',
      '<p:cNvSpPr txBox="1"/>\n          <p:nvPr><p:ph type="title" idx="0"/></p:nvPr>'
    )],
    ["shape rotation", (text) => text.replace(
      '<a:xfrm>\n            <a:off x="914400" y="1285875"/>',
      '<a:xfrm rot="60000">\n            <a:off x="914400" y="1285875"/>'
    )],
    ["shape flip", (text) => text.replace(
      '<a:xfrm>\n            <a:off x="914400" y="1285875"/>',
      '<a:xfrm flipH="1">\n            <a:off x="914400" y="1285875"/>'
    )],
    ["extra transform child", (text) => text.replace(
      '<a:ext cx="10363200" cy="1143000"/>',
      '<a:ext cx="10363200" cy="1143000"/><a:chOff x="0" y="0"/>'
    )],
    ["slide transition", (text) => text.replace("</p:sld>", '<p:transition spd="fast"/></p:sld>')],
    ["slide timing", (text) => text.replace("</p:sld>", "<p:timing/></p:sld>")],
    ["extension list", (text) => text.replace("</p:sld>", "<p:extLst/></p:sld>")]
  ]) {
    await t.test(name, async () => {
      const { temporaryRoot, sourceRoot } = await cloneReviewedFixtureSource();
      try {
        const slidePath = path.join(sourceRoot, "parts", "ppt", "slides", "slide1.xml");
        const original = await readFile(slidePath, "utf8");
        await writeFile(slidePath, mutate(original), "utf8");
        await assert.rejects(
          buildSyntheticFixtures({ sourceRoot }),
          (error) => error instanceof FixtureGenerationError && error.code === "invalid-inspection-view"
        );
      } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
      }
    });
  }
});

test("the inspector snapshots mutable views and validates a frozen output exactly once", () => {
  const context = makeContext();
  const view = mutableView("potx", context);
  let calls = 0;
  let observed;
  const actual = inspect("potx", {
    context,
    packageView: view,
    validateTemplateIndex(value) {
      calls += 1;
      observed = value;
      assert.ok(Object.isFrozen(value));
      assert.ok(Object.isFrozen(value.slides[0].shapes[0]));
      assert.throws(() => {
        value.templateFormat = "pptx";
      }, TypeError);
      return validateTemplateIndex(value);
    }
  });
  view.slides[0].shapes[0].sourceId = 999;
  assert.equal(calls, 1);
  assert.equal(observed, actual);
  assert.equal(actual.slides[0].shapes[0].sourceId, 2);
});

test("argument and dependency objects fail closed without invoking accessors", async (t) => {
  const context = makeContext();
  const view = makeView("potx", context);
  const validOptions = {
    context,
    packageView: view,
    dependencies: { validateTemplateIndex }
  };
  for (const [name, options, pointer] of [
    ["missing options", undefined, ""],
    ["array options", [], ""],
    ["missing view", { context, dependencies: validOptions.dependencies }, ""],
    ["unknown option", { ...validOptions, fallbackReader: true }, ""],
    ["symbol option", Object.assign({ ...validOptions }, { [Symbol("unknown")]: true }), ""]
  ]) {
    await t.test(name, () => {
      assertInspectionError(
        () => inspectTemplate(options),
        "TEMPLATE_INSPECTION_ARGUMENT_INVALID",
        pointer
      );
    });
  }

  await t.test("option accessor", () => {
    let invoked = false;
    const options = { context, dependencies: validOptions.dependencies };
    Object.defineProperty(options, "packageView", {
      enumerable: true,
      get() {
        invoked = true;
        return view;
      }
    });
    assertInspectionError(
      () => inspectTemplate(options),
      "TEMPLATE_INSPECTION_ARGUMENT_INVALID",
      "/packageView"
    );
    assert.equal(invoked, false);
  });

  for (const [name, dependencies, code, pointer] of [
    ["missing dependencies", undefined, "TEMPLATE_INSPECTION_DEPENDENCY_INVALID", "/dependencies"],
    ["empty dependencies", {}, "TEMPLATE_INSPECTION_DEPENDENCY_INVALID", "/dependencies"],
    ["unknown dependency", { validateTemplateIndex, readArchive() {} }, "TEMPLATE_INSPECTION_DEPENDENCY_INVALID", "/dependencies"],
    ["non-function validator", { validateTemplateIndex: true }, "TEMPLATE_INSPECTION_DEPENDENCY_INVALID", "/dependencies/validateTemplateIndex"]
  ]) {
    await t.test(name, () => {
      assertInspectionError(
        () => inspectTemplate({ context, packageView: view, dependencies }),
        code,
        pointer
      );
    });
  }

  await t.test("dependency accessor", () => {
    let invoked = false;
    const dependencies = {};
    Object.defineProperty(dependencies, "validateTemplateIndex", {
      enumerable: true,
      get() {
        invoked = true;
        return validateTemplateIndex;
      }
    });
    assertInspectionError(
      () => inspectTemplate({ context, packageView: view, dependencies }),
      "TEMPLATE_INSPECTION_DEPENDENCY_INVALID",
      "/dependencies/validateTemplateIndex"
    );
    assert.equal(invoked, false);
  });
});

test("output validators must return literal true synchronously", async (t) => {
  for (const [name, validator] of [
    ["false", () => false],
    ["undefined", () => undefined],
    ["promise", () => Promise.resolve(true)],
    ["throw", () => { throw new Error("not disclosed"); }]
  ]) {
    await t.test(name, () => {
      assertInspectionError(
        () => inspect("potx", { validateTemplateIndex: validator }),
        "TEMPLATE_INSPECTION_OUTPUT_INVALID",
        "/templateIndex"
      );
    });
  }
});

test("forged or mutable ProjectContext values fail closed", async (t) => {
  const context = makeContext();
  const view = makeView("potx", context);
  await t.test("mutable shell", () => {
    assertInspectionError(
      () => inspect("potx", { context: { ...context }, packageView: view }),
      "TEMPLATE_INSPECTION_CONTEXT_INVALID",
      "/context"
    );
  });
  await t.test("wrong version", () => {
    const forged = forgeContext(context, (value) => { value.contextVersion = "0.2.0"; });
    assertInspectionError(
      () => inspect("potx", { context: forged, packageView: view }),
      "TEMPLATE_INSPECTION_CONTEXT_INVALID",
      "/context"
    );
  });
  await t.test("nonsemantic index ID", () => {
    const forged = forgeContext(context, (value) => {
      value.projectConfig.template.indexId = "Private Index";
    });
    assertInspectionError(
      () => inspect("potx", { context: forged, packageView: view }),
      "TEMPLATE_INSPECTION_CONTEXT_INVALID",
      "/context/projectConfig/template/indexId"
    );
  });
  await t.test("inconsistent resolved source", () => {
    const forged = forgeContext(context, (value) => {
      value.locations.templateSource = path.join(value.projectRoot, "workspace", "other.potx");
    });
    assertInspectionError(
      () => inspect("potx", { context: forged, packageView: view }),
      "TEMPLATE_INSPECTION_CONTEXT_INVALID",
      "/context/locations/templateSource"
    );
  });
});

test("non-JSON and accessor-bearing package views fail without evaluation", async (t) => {
  const context = makeContext();
  await t.test("cycle", () => {
    const view = mutableView("potx", context);
    view.self = view;
    assertInspectionError(
      () => inspect("potx", { context, packageView: view }),
      "TEMPLATE_INSPECTION_VIEW_INVALID",
      "/packageView"
    );
  });
  await t.test("bigint", () => {
    const view = mutableView("potx", context);
    view.archiveSha256 = 1n;
    assertInspectionError(
      () => inspect("potx", { context, packageView: view }),
      "TEMPLATE_INSPECTION_VIEW_INVALID",
      "/packageView/archiveSha256"
    );
  });
  await t.test("huge sparse array is bounded before enumeration", () => {
    const view = mutableView("potx", context);
    view.contentParts = new Array(100_000_000);
    assertInspectionError(
      () => inspect("potx", { context, packageView: view }),
      "TEMPLATE_INSPECTION_VIEW_INVALID",
      "/packageView/contentParts"
    );
  });
  await t.test("deep unknown field is rejected without recursive copying", () => {
    const view = mutableView("potx", context);
    const unknown = {};
    let cursor = unknown;
    for (let depth = 0; depth < 20000; depth += 1) {
      cursor.next = {};
      cursor = cursor.next;
    }
    view.slides[0].shapes[0].unknown = unknown;
    assertInspectionError(
      () => inspect("potx", { context, packageView: view }),
      "TEMPLATE_INSPECTION_VIEW_INVALID",
      "/packageView/slides/0/shapes/0"
    );
  });
  await t.test("symbol", () => {
    const view = mutableView("potx", context);
    view[Symbol("unknown")] = true;
    assertInspectionError(
      () => inspect("potx", { context, packageView: view }),
      "TEMPLATE_INSPECTION_VIEW_INVALID",
      "/packageView"
    );
  });
  await t.test("accessor", () => {
    let invoked = false;
    const view = mutableView("potx", context);
    Object.defineProperty(view, "sourceLocation", {
      enumerable: true,
      get() {
        invoked = true;
        return context.locations.templateSource;
      }
    });
    assertInspectionError(
      () => inspect("potx", { context, packageView: view }),
      "TEMPLATE_INSPECTION_VIEW_INVALID",
      "/packageView/sourceLocation"
    );
    assert.equal(invoked, false);
  });
});

test("package-view identity and source binding mutations fail closed", async (t) => {
  const context = makeContext();
  const cases = [
    ["view version", (view) => { view.viewVersion = "0.2.0"; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["view type", (view) => { view.viewType = "archive-view"; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["producer class", (view) => { view.producerClass = "unreviewed-producer"; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["source location", (view) => { view.sourceLocation = path.join(context.projectRoot, "other.potx"); }, "TEMPLATE_INSPECTION_SOURCE_MISMATCH"],
    ["format extension", (view) => { view.templateFormat = "pptx"; }, "TEMPLATE_INSPECTION_SOURCE_MISMATCH"],
    ["unknown format", (view) => { view.templateFormat = "ppsx"; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["uppercase digest", (view) => { view.archiveSha256 = view.archiveSha256.toUpperCase(); }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["missing digest", (view) => { delete view.archiveSha256; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["unknown field", (view) => { view.archivePath = context.locations.templateSource; }, "TEMPLATE_INSPECTION_VIEW_INVALID"]
  ];
  for (const [name, mutate, code] of cases) {
    await t.test(name, () => {
      const view = mutableView("potx", context);
      mutate(view);
      assertInspectionError(() => inspect("potx", { context, packageView: view }), code);
    });
  }
});

test("content-part inventory mutations reject aliases, drift, and unknown features", async (t) => {
  const context = makeContext();
  const cases = [
    ["case alias", (view) => {
      view.contentParts.push({ ...view.contentParts.at(-1), partPath: "PPT/theme/theme1.xml" });
    }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["duplicate path", (view) => { view.contentParts.push({ ...view.contentParts[0] }); }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["parent segment", (view) => { view.contentParts[0].partPath = "ppt/../presProps.xml"; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["backslash", (view) => { view.contentParts[0].partPath = "ppt\\presProps.xml"; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["unknown content type", (view) => { view.contentParts[0].contentType = "application/x-unknown"; }, "TEMPLATE_INSPECTION_UNHANDLED_FEATURE"],
    ["format content mismatch", (view) => {
      contentPart(view, ".template.main+xml").contentType =
        "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml";
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["missing theme", (view) => {
      view.contentParts = view.contentParts.filter((entry) => !entry.contentType.endsWith("theme+xml"));
    }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["extra known auxiliary", (view) => {
      view.contentParts.push({ partPath: "ppt/extra.xml", contentType: view.contentParts[0].contentType });
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"]
  ];
  for (const [name, mutate, code] of cases) {
    await t.test(name, () => {
      const view = mutableView("potx", context);
      mutate(view);
      assertInspectionError(() => inspect("potx", { context, packageView: view }), code);
    });
  }
});

test("relationship mutations fail before any normalized index is returned", async (t) => {
  const context = makeContext();
  const cases = [
    ["missing root", (view) => {
      view.relationshipSets = view.relationshipSets.filter((entry) => entry.ownerPart !== null);
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["duplicate root edge", (view) => {
      const root = relationshipSet(view, null);
      root.relationships.push({ ...root.relationships[0], relationshipId: "rId2" });
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["duplicate ID", (view) => {
      const owner = relationshipSet(view, "ppt/presentation.xml");
      owner.relationships.push({
        ...owner.relationships[0],
        targetPart: "ppt/slides/slide1.xml"
      });
    }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["unknown type", (view) => {
      relationshipSet(view, null).relationships[0].relationshipType = `${RELATIONSHIP_SENTINEL}custom`;
    }, "TEMPLATE_INSPECTION_UNHANDLED_FEATURE"],
    ["dangling target", (view) => {
      relationshipSet(view, null).relationships[0].targetPart = "ppt/missing.xml";
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["wrong target type", (view) => {
      relationshipSet(view, null).relationships[0].targetPart = "ppt/theme/theme1.xml";
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["case-mismatched target", (view) => {
      relationshipSet(view, null).relationships[0].targetPart = "ppt/Presentation.xml";
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["missing presentation owner set", (view) => {
      view.relationshipSets = view.relationshipSets.filter((entry) => entry.ownerPart !== "ppt/presentation.xml");
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["missing presProps edge", (view) => {
      const owner = relationshipSet(view, "ppt/presentation.xml");
      owner.relationships = owner.relationships.filter((entry) => !entry.relationshipType.endsWith("/presProps"));
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["layout reciprocal mismatch", (view) => {
      relationshipSet(view, "ppt/slideLayouts/slideLayout1.xml").relationships[0].targetPart =
        "ppt/slides/slide1.xml";
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["slide points to master", (view) => {
      relationshipSet(view, "ppt/slides/slide1.xml").relationships[0].targetPart =
        "ppt/slideMasters/slideMaster1.xml";
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"]
  ];
  for (const [name, mutate, code] of cases) {
    await t.test(name, () => {
      const view = mutableView("potx", context);
      mutate(view);
      assertInspectionError(() => inspect("potx", { context, packageView: view }), code);
    });
  }
});

test("owner-list and model mutations reject ambiguity and orphans", async (t) => {
  const context = makeContext();
  const cases = [
    ["empty master list", (view) => { view.presentation.masterReferences = []; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["dangling master rId", (view) => {
      view.presentation.masterReferences[0].relationshipId = "missing";
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["duplicate master source ID", (view) => {
      const owner = relationshipSet(view, "ppt/presentation.xml");
      owner.relationships.push({
        relationshipId: "rId5",
        relationshipType: owner.relationships[0].relationshipType,
        targetPart: owner.relationships[0].targetPart
      });
      view.presentation.masterReferences.push({
        sourceId: view.presentation.masterReferences[0].sourceId,
        relationshipId: "rId5"
      });
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["duplicate model", (view) => { view.masters.push(clone(view.masters[0])); }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["layout source ID reused by another master", (view) => {
      addSecondMasterBranch(view, view.masters[0].layoutReferences[0].sourceId);
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["layout model wrong part", (view) => { view.layouts[0].partPath = "ppt/theme/theme1.xml"; }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["slide model wrong part", (view) => { view.slides[0].partPath = "ppt/presProps.xml"; }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["layout reference wrong type", (view) => {
      view.masters[0].layoutReferences[0].relationshipId = "rId2";
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["presentation part mismatch", (view) => { view.presentation.partPath = "ppt/slides/slide1.xml"; }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["extra model relationship owner", (view) => {
      view.relationshipSets.push({
        ownerPart: "ppt/theme/theme1.xml",
        relationships: [{
          relationshipId: "rId1",
          relationshipType: relationshipSet(view, null).relationships[0].relationshipType,
          targetPart: "ppt/presentation.xml"
        }]
      });
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"]
  ];
  for (const [name, mutate, code] of cases) {
    await t.test(name, () => {
      const view = mutableView("potx", context);
      mutate(view);
      assertInspectionError(() => inspect("potx", { context, packageView: view }), code);
    });
  }
});

test("slide size and shape facts enforce index bounds and lossless vocabulary", async (t) => {
  const context = makeContext();
  const cases = [
    ["missing slide width", (view) => { delete view.presentation.slideSizeEmu.cx; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["slide size x field", (view) => { view.presentation.slideSizeEmu.x = 7; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["slide size y field", (view) => { view.presentation.slideSizeEmu.y = 9; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["slide size unknown field", (view) => { view.presentation.slideSizeEmu.unit = "emu"; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["zero slide height", (view) => { view.presentation.slideSizeEmu.cy = 0; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["negative coordinate", (view) => { view.slides[0].shapes[0].geometry.x = -1; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["zero extent", (view) => { view.slides[0].shapes[0].geometry.cx = 0; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["fractional extent", (view) => { view.slides[0].shapes[0].geometry.cy = 1.5; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["overflow extent", (view) => { view.slides[0].shapes[0].geometry.cy = 2147483648; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["duplicate shape source ID", (view) => {
      view.slides[0].shapes[1].sourceId = view.slides[0].shapes[0].sourceId;
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["unsupported picture", (view) => { view.slides[0].shapes[0].kind = "picture"; }, "TEMPLATE_INSPECTION_UNHANDLED_FEATURE"],
    ["unsupported group", (view) => { view.slides[0].shapes[0].kind = "group"; }, "TEMPLATE_INSPECTION_UNHANDLED_FEATURE"],
    ["placeholder metadata on text box", (view) => {
      view.slides[0].shapes[0].placeholder = { type: "title", index: 0 };
    }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["placeholder without metadata", (view) => { view.slides[0].shapes[0].kind = "placeholder"; }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["placeholder invalid type", (view) => {
      view.slides[0].shapes[0].kind = "placeholder";
      view.slides[0].shapes[0].placeholder = { type: "Title", index: 0 };
    }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["duplicate placeholder", (view) => {
      for (const shape of view.slides[0].shapes) {
        shape.kind = "placeholder";
        shape.placeholder = { type: "body", index: 1 };
      }
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"]
  ];
  for (const [name, mutate, code] of cases) {
    await t.test(name, () => {
      const view = mutableView("potx", context);
      mutate(view);
      assertInspectionError(() => inspect("potx", { context, packageView: view }), code);
    });
  }
});

test("observed and unhandled feature facts fail closed", async (t) => {
  const context = makeContext();
  const cases = [
    ["missing observed feature", (view) => { view.observedFeatureIds.pop(); }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["extra observed feature", (view) => {
      view.observedFeatureIds.push("vendor-extension-xml");
      view.observedFeatureIds.sort();
    }, "TEMPLATE_INSPECTION_GRAPH_INVALID"],
    ["unsorted observed features", (view) => { view.observedFeatureIds.reverse(); }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["duplicate observed feature", (view) => {
      view.observedFeatureIds.splice(1, 0, view.observedFeatureIds[0]);
    }, "TEMPLATE_INSPECTION_VIEW_INVALID"],
    ["unhandled feature", (view) => { view.unhandledFeatureIds = ["external-relationship"]; }, "TEMPLATE_INSPECTION_UNHANDLED_FEATURE"],
    ["unsorted unhandled features", (view) => {
      view.unhandledFeatureIds = ["vendor-extension-xml", "external-relationship"];
    }, "TEMPLATE_INSPECTION_VIEW_INVALID"]
  ];
  for (const [name, mutate, code] of cases) {
    await t.test(name, () => {
      const view = mutableView("potx", context);
      mutate(view);
      assertInspectionError(() => inspect("potx", { context, packageView: view }), code);
    });
  }
});

test("inspection errors never disclose the source path, digest, or local root", () => {
  const context = makeContext();
  const view = mutableView("potx", context);
  const originalDigest = view.archiveSha256;
  view.sourceLocation = path.join(context.projectRoot, "private", "revealing-name.potx");
  assertInspectionError(
    () => inspect("potx", { context, packageView: view }),
    "TEMPLATE_INSPECTION_SOURCE_MISMATCH",
    "/packageView/sourceLocation",
    [context.projectRoot, context.locations.templateSource, view.sourceLocation, originalDigest]
  );
});

test("clean-directory module closure inspects the public view from an unrelated cwd", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "template-inspector-clean-"));
  try {
    const moduleRoot = path.join(temporaryRoot, "module");
    const projectRoot = path.join(temporaryRoot, "project");
    await cp(
      path.join(repositoryRoot, "packages", "core", "src"),
      moduleRoot,
      { recursive: true, errorOnExist: true }
    );
    const config = makeConfig("potx");
    const context = makeContext("potx", { projectRoot, projectConfig: config });
    const view = makeView("potx", context);
    await writeFile(
      path.join(temporaryRoot, "payload.json"),
      JSON.stringify({ projectRoot, config, view }),
      "utf8"
    );
    const runner = `
import { readFile } from "node:fs/promises";
import { createProjectContext } from "./module/project-context.mjs";
import { inspectTemplate } from "./module/template-inspector.mjs";
const payload = JSON.parse(await readFile(new URL("./payload.json", import.meta.url), "utf8"));
const context = createProjectContext({
  projectRoot: payload.projectRoot,
  projectConfig: payload.config,
  dependencies: { validateProjectConfig: () => true }
});
const result = inspectTemplate({
  context,
  packageView: payload.view,
  dependencies: { validateTemplateIndex: () => true }
});
process.stdout.write(JSON.stringify(result));
`;
    await writeFile(path.join(temporaryRoot, "run.mjs"), runner, "utf8");
    const execution = spawnSync(process.execPath, [path.join(temporaryRoot, "run.mjs")], {
      cwd: os.tmpdir(),
      encoding: "utf8",
      env: {}
    });
    assert.equal(execution.status, 0, execution.stderr);
    assert.deepEqual(JSON.parse(execution.stdout), expectedPotxIndex);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("public synthetic inspection harness emits only the deterministic golden index", () => {
  const first = spawnSync(
    process.execPath,
    [path.join(repositoryRoot, "scripts", "inspect-synthetic-fixture.mjs")],
    { cwd: os.tmpdir(), encoding: "utf8", env: {} }
  );
  const second = spawnSync(
    process.execPath,
    [path.join(repositoryRoot, "scripts", "inspect-synthetic-fixture.mjs")],
    { cwd: filesystemRoot, encoding: "utf8", env: {} }
  );
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stderr, "");
  assert.equal(second.stderr, "");
  assert.equal(first.stdout, second.stdout);
  assert.deepEqual(JSON.parse(first.stdout), expectedPotxIndex);
  assert.equal(first.stdout.includes(repositoryRoot), false);
});

test("core inspector source contains no I/O, archive, XML, ambient-root, or fixture constants", async () => {
  const source = await readFile(
    new URL("../packages/core/src/template-inspector.mjs", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /node:(?:fs|zlib|stream|child_process)|from\s+["'][^"']*scripts\//u);
  assert.doesNotMatch(source, /fixtures\/|process\.(?:cwd|env)|\.git|0x04034b50|DOMParser|parseStoredZip/iu);
  assert.doesNotMatch(source, /2147483900|2147483901|Synthetic Fixture|Synthetic Sans|Repository-owned text-only OOXML/u);
  assert.match(source, /already parsed template-package view/u);
});

test("fixture-view helper rejects objects and locations outside its reviewed producer contract", () => {
  assert.throws(
    () => createReviewedFixturePackageView({ archive: {}, sourceLocation: defaultProjectRoot }),
    (error) => error.code === "invalid-inspection-view"
  );
  assert.throws(
    () => createReviewedFixturePackageView({ archive: archives.get("potx"), sourceLocation: "relative.potx" }),
    (error) => error.code === "invalid-inspection-view"
  );
  assert.throws(
    () => createReviewedFixturePackageView(),
    (error) => error.code === "invalid-inspection-view"
  );
});

test("ProjectContext still rejects invalid configs before inspection", () => {
  const config = makeConfig("potx");
  config.template.sourcePath = "../outside.potx";
  assert.throws(
    () => makeContext("potx", { projectConfig: config }),
    (error) => error instanceof ProjectContextError
  );
});
