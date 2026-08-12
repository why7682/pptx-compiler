import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PROJECT_CONTEXT_VERSION,
  ProjectContextError,
  createProjectContext
} from "../packages/core/src/project-context.mjs";
import {
  assertSupportedSchema,
  createSchemaRegistry,
  validateJson
} from "../scripts/lib/json-schema.mjs";

const manifest = JSON.parse(await readFile(
  new URL("../schemas/contracts/manifest.json", import.meta.url),
  "utf8"
));
const schemas = await Promise.all(manifest.schemas.map(async ({ path: schemaPath }) =>
  JSON.parse(await readFile(new URL(`../${schemaPath}`, import.meta.url), "utf8"))));
const registry = createSchemaRegistry(schemas);
for (const schema of schemas) assertSupportedSchema(schema, { registry });
const projectConfigSchema = registry.get("urn:pptx-compiler:schema:project-config:0.1.0");
const validProjectConfig = JSON.parse(await readFile(
  new URL("../fixtures/contracts/valid/project-config.json", import.meta.url),
  "utf8"
));

const filesystemRoot = path.parse(process.execPath).root;
const defaultProjectRoot = path.join(filesystemRoot, "synthetic-project-root");

function cloneConfig() {
  return JSON.parse(JSON.stringify(validProjectConfig));
}

function validateProjectConfig(value) {
  return validateJson(value, projectConfigSchema, {
    rootSchema: projectConfigSchema,
    registry
  }).length === 0;
}

function create(overrides = {}) {
  return createProjectContext({
    projectRoot: Object.hasOwn(overrides, "projectRoot") ? overrides.projectRoot : defaultProjectRoot,
    projectConfig: Object.hasOwn(overrides, "projectConfig") ? overrides.projectConfig : cloneConfig(),
    dependencies: Object.hasOwn(overrides, "dependencies")
      ? overrides.dependencies
      : { validateProjectConfig }
  });
}

function assertContextError(callback, code, pointer) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof ProjectContextError);
    assert.equal(error.code, code);
    assert.equal(error.pointer, pointer);
    assert.deepEqual(error.toJSON(), { code, pointer });
    assert.equal(error.message.includes(defaultProjectRoot), false);
    return true;
  });
}

function expectedLocation(root, relativePath) {
  return path.join(root, ...relativePath.split("/"));
}

test("ProjectContext resolves the fixed runtime shape from the explicit root", () => {
  const config = cloneConfig();
  const context = create({ projectConfig: config });

  assert.deepEqual(Object.keys(context), [
    "contextVersion",
    "contextType",
    "projectRoot",
    "projectConfig",
    "locations",
    "dependencies"
  ]);
  assert.equal(context.contextVersion, PROJECT_CONTEXT_VERSION);
  assert.equal(context.contextType, "project-context");
  assert.equal(context.projectRoot, path.normalize(defaultProjectRoot));
  assert.deepEqual(context.locations, {
    templateSource: expectedLocation(defaultProjectRoot, config.template.sourcePath),
    templateProfile: expectedLocation(defaultProjectRoot, config.template.profilePath),
    templateIndex: expectedLocation(defaultProjectRoot, config.template.indexPath),
    capabilityRegistry: expectedLocation(defaultProjectRoot, config.capabilityRegistry.path),
    projectOverlay: expectedLocation(defaultProjectRoot, config.projectOverlay.path),
    assetRoot: expectedLocation(defaultProjectRoot, config.paths.assetRoot),
    stagingRoot: expectedLocation(defaultProjectRoot, config.paths.stagingRoot),
    outputRoot: expectedLocation(defaultProjectRoot, config.paths.outputRoot)
  });
  assert.equal(context.dependencies.validateProjectConfig, validateProjectConfig);
});

test("ProjectContext snapshots and deeply freezes config, locations, and dependencies", () => {
  const config = cloneConfig();
  const dependencies = { validateProjectConfig };
  const context = create({ projectConfig: config, dependencies });
  const originalSource = context.projectConfig.template.sourcePath;
  const originalValidator = context.dependencies.validateProjectConfig;

  config.template.sourcePath = "changed/template.potx";
  dependencies.validateProjectConfig = () => false;

  assert.equal(context.projectConfig.template.sourcePath, originalSource);
  assert.equal(context.dependencies.validateProjectConfig, originalValidator);
  assert.ok(Object.isFrozen(context));
  assert.ok(Object.isFrozen(context.projectConfig));
  assert.ok(Object.isFrozen(context.projectConfig.template));
  assert.ok(Object.isFrozen(context.locations));
  assert.ok(Object.isFrozen(context.dependencies));
  assert.throws(() => {
    context.locations.outputRoot = "changed";
  }, TypeError);
});

test("ProjectContext normalizes a trailing root separator without discovering a root", () => {
  const context = create({ projectRoot: `${defaultProjectRoot}${path.sep}` });
  assert.equal(context.projectRoot, path.normalize(defaultProjectRoot));
  assert.equal(
    context.locations.templateSource,
    expectedLocation(defaultProjectRoot, validProjectConfig.template.sourcePath)
  );
});

test("independent contexts do not share project-root state", () => {
  const firstRoot = path.join(filesystemRoot, "synthetic-project-one");
  const secondRoot = path.join(filesystemRoot, "synthetic-project-two");
  const first = create({ projectRoot: firstRoot });
  const second = create({ projectRoot: secondRoot });

  assert.equal(first.projectRoot, firstRoot);
  assert.equal(second.projectRoot, secondRoot);
  assert.notEqual(first.locations.templateSource, second.locations.templateSource);
  assert.notEqual(first.projectConfig, second.projectConfig);
});

test("changing process cwd cannot change an explicit context root", { concurrency: false }, () => {
  const originalCwd = process.cwd();
  const before = create();
  try {
    process.chdir(os.tmpdir());
    const after = create();
    assert.equal(after.projectRoot, before.projectRoot);
    assert.deepEqual(after.locations, before.locations);
  } finally {
    process.chdir(originalCwd);
  }
});

test("the validation dependency runs once against the frozen detached snapshot", () => {
  const config = cloneConfig();
  let calls = 0;
  let observed;
  const context = create({
    projectConfig: config,
    dependencies: {
      validateProjectConfig(value) {
        calls += 1;
        observed = value;
        assert.ok(Object.isFrozen(value));
        assert.ok(Object.isFrozen(value.paths));
        return true;
      }
    }
  });

  assert.equal(calls, 1);
  assert.equal(observed, context.projectConfig);
  assert.notEqual(observed, config);
});

test("option-object mutations fail closed without invoking accessors", async (t) => {
  const base = {
    projectRoot: defaultProjectRoot,
    projectConfig: cloneConfig(),
    dependencies: { validateProjectConfig }
  };
  const cases = [
    ["missing options", undefined, ""],
    ["array options", [], ""],
    ["missing root", { projectConfig: base.projectConfig, dependencies: base.dependencies }, ""],
    ["unknown option", { ...base, fallbackRoot: "disabled" }, ""],
    ["symbol option", Object.assign({ ...base }, { [Symbol("unknown")]: true }), ""]
  ];

  for (const [name, options, pointer] of cases) {
    await t.test(name, () => {
      assertContextError(
        () => createProjectContext(options),
        "PROJECT_CONTEXT_ARGUMENT_INVALID",
        pointer
      );
    });
  }

  await t.test("root accessor", () => {
    let invoked = false;
    const options = { ...base };
    Object.defineProperty(options, "projectRoot", {
      enumerable: true,
      get() {
        invoked = true;
        return defaultProjectRoot;
      }
    });
    assertContextError(
      () => createProjectContext(options),
      "PROJECT_CONTEXT_ARGUMENT_INVALID",
      "/projectRoot"
    );
    assert.equal(invoked, false);
  });
});

test("dependency mutations fail closed", async (t) => {
  const shapeCases = [
    ["missing dependencies", undefined, "/dependencies"],
    ["empty dependencies", {}, "/dependencies"],
    ["unknown dependency", { validateProjectConfig, rootFinder() {} }, "/dependencies"],
    ["non-function validator", { validateProjectConfig: true }, "/dependencies/validateProjectConfig"]
  ];
  for (const [name, dependencies, pointer] of shapeCases) {
    await t.test(name, () => {
      assertContextError(
        () => create({ dependencies }),
        "PROJECT_CONTEXT_DEPENDENCY_INVALID",
        pointer
      );
    });
  }

  for (const [name, validator] of [
    ["false result", () => false],
    ["undefined result", () => undefined],
    ["promise result", () => Promise.resolve(true)],
    ["throwing validator", () => { throw new Error("validation failed"); }]
  ]) {
    await t.test(name, () => {
      assertContextError(
        () => create({ dependencies: { validateProjectConfig: validator } }),
        "PROJECT_CONTEXT_CONFIG_INVALID",
        "/projectConfig"
      );
    });
  }

  await t.test("validator accessor", () => {
    let invoked = false;
    const dependencies = {};
    Object.defineProperty(dependencies, "validateProjectConfig", {
      enumerable: true,
      get() {
        invoked = true;
        return validateProjectConfig;
      }
    });
    assertContextError(
      () => create({ dependencies }),
      "PROJECT_CONTEXT_DEPENDENCY_INVALID",
      "/dependencies/validateProjectConfig"
    );
    assert.equal(invoked, false);
  });
});

test("schema-invalid ProjectConfig mutations remain rejected by the injected authority", async (t) => {
  const cases = [
    ["unknown version", (config) => { config.schemaVersion = "0.2.0"; }],
    ["wrong contract type", (config) => { config.contractType = "template-profile"; }],
    ["unknown field", (config) => { config.ambientRoot = "disabled"; }],
    ["missing paths", (config) => { delete config.paths; }]
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const config = cloneConfig();
      mutate(config);
      assertContextError(
        () => create({ projectConfig: config }),
        "PROJECT_CONTEXT_CONFIG_INVALID",
        "/projectConfig"
      );
    });
  }
});

test("non-JSON and accessor config values fail before validation", async (t) => {
  const cases = [
    ["undefined value", (config) => { config.paths.assetRoot = undefined; }],
    ["non-finite number", (config) => { config.paths.assetRoot = Number.NaN; }],
    ["non-plain object", (config) => { config.paths = new Date(0); }],
    ["symbol key", (config) => { config[Symbol("unknown")] = true; }],
    ["cyclic value", (config) => { config.loop = config; }]
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const config = cloneConfig();
      mutate(config);
      assertContextError(
        () => create({ projectConfig: config, dependencies: { validateProjectConfig: () => true } }),
        "PROJECT_CONTEXT_CONFIG_INVALID",
        "/projectConfig"
      );
    });
  }

  await t.test("nested accessor is not invoked", () => {
    const config = cloneConfig();
    let invoked = false;
    Object.defineProperty(config.template, "sourcePath", {
      enumerable: true,
      get() {
        invoked = true;
        return "workspace/template.potx";
      }
    });
    assertContextError(
      () => create({ projectConfig: config, dependencies: { validateProjectConfig: () => true } }),
      "PROJECT_CONTEXT_CONFIG_INVALID",
      "/projectConfig"
    );
    assert.equal(invoked, false);
  });
});

test("invalid explicit roots fail without cwd fallback", async (t) => {
  const nul = String.fromCharCode(0);
  const cases = [
    ["undefined", undefined],
    ["null", null],
    ["empty", ""],
    ["dot-relative", "."],
    ["multi-segment relative", "relative/project"],
    ["control character", `relative${nul}project`],
    ["non-string", 42]
  ];
  for (const [name, projectRoot] of cases) {
    await t.test(name, () => {
      assertContextError(
        () => create({ projectRoot }),
        "PROJECT_CONTEXT_ROOT_INVALID",
        "/projectRoot"
      );
    });
  }
});

test("defensive path syntax checks reject traversal and alternate absolute forms", async (t) => {
  const nul = String.fromCharCode(0);
  const backslash = String.fromCharCode(92);
  const drivePath = ["Z", ":", "/", "outside"].join("");
  const uncPath = [backslash, backslash, "host", backslash, "share"].join("");
  const cases = [
    ["parent traversal", "../outside"],
    ["embedded traversal", "workspace/../outside"],
    ["dot segment", "workspace/./assets"],
    ["empty segment", "workspace//assets"],
    ["posix absolute", "/outside"],
    ["drive absolute", drivePath],
    ["unc absolute", uncPath],
    ["backslash", `workspace${backslash}assets`],
    ["uri-like", "file:workspace/assets"],
    ["nul", `workspace/${nul}assets`]
  ];

  for (const [name, value] of cases) {
    await t.test(name, () => {
      const config = cloneConfig();
      config.paths.assetRoot = value;
      assertContextError(
        () => create({
          projectConfig: config,
          dependencies: { validateProjectConfig: () => true }
        }),
        "PROJECT_CONTEXT_PATH_INVALID",
        "/paths/assetRoot"
      );
    });
  }
});

test("all resolved locations remain lexically below the explicit root", () => {
  const context = create();
  for (const location of Object.values(context.locations)) {
    const relative = path.relative(context.projectRoot, location);
    assert.notEqual(relative, "");
    assert.equal(path.isAbsolute(relative), false);
    assert.notEqual(relative, "..");
    assert.equal(relative.startsWith(`..${path.sep}`), false);
  }
});

test("duplicate, nested, and case-only project roots fail closed", async (t) => {
  const cases = [
    ["duplicate", (config) => { config.paths.outputRoot = config.paths.stagingRoot; }],
    ["nested child", (config) => { config.paths.outputRoot = `${config.paths.stagingRoot}/child`; }],
    ["nested parent", (config) => { config.paths.assetRoot = "workspace"; }],
    ["case-only alias", (config) => { config.paths.outputRoot = "WORKSPACE/ASSETS"; }]
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const config = cloneConfig();
      mutate(config);
      assertContextError(
        () => create({ projectConfig: config }),
        "PROJECT_CONTEXT_PATH_ALIAS",
        "/paths"
      );
    });
  }
});

test("case-only aliases between input-document roles fail closed", async (t) => {
  const roles = [
    ["templateSource", (config) => config.template.sourcePath,
      (config, value) => { config.template.sourcePath = value; }],
    ["templateProfile", (config) => config.template.profilePath,
      (config, value) => { config.template.profilePath = value; }],
    ["templateIndex", (config) => config.template.indexPath,
      (config, value) => { config.template.indexPath = value; }],
    ["capabilityRegistry", (config) => config.capabilityRegistry.path,
      (config, value) => { config.capabilityRegistry.path = value; }],
    ["projectOverlay", (config) => config.projectOverlay.path,
      (config, value) => { config.projectOverlay.path = value; }]
  ];

  for (let left = 0; left < roles.length; left += 1) {
    for (let right = left + 1; right < roles.length; right += 1) {
      const [leftName, readLeft] = roles[left];
      const [rightName, , writeRight] = roles[right];
      await t.test(`${leftName} and ${rightName}`, () => {
        const config = cloneConfig();
        writeRight(config, readLeft(config).toUpperCase());
        assertContextError(
          () => create({ projectConfig: config }),
          "PROJECT_CONTEXT_PATH_ALIAS",
          "/projectConfig"
        );
      });
    }
  }
});

test("template source cannot alias or descend from a write root", async (t) => {
  const cases = [
    ["inside staging", (config) => { config.template.sourcePath = "workspace/staging/template.potx"; }],
    ["inside output", (config) => { config.template.sourcePath = "workspace/output/template.potx"; }],
    ["case-only output alias", (config) => { config.template.sourcePath = "WORKSPACE/OUTPUT/template.potx"; }],
    ["equal write root", (config) => {
      config.paths.outputRoot = "workspace/result.potx";
      config.template.sourcePath = "workspace/result.potx";
    }]
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const config = cloneConfig();
      mutate(config);
      assertContextError(
        () => create({ projectConfig: config }),
        "PROJECT_CONTEXT_WRITE_TARGET_CONFLICT",
        "/template/sourcePath"
      );
    });
  }
});

test("M1-003 does not silently add a control-file write-root restriction", () => {
  const config = cloneConfig();
  config.template.profilePath = "workspace/output/template-profile.json";
  const context = create({ projectConfig: config });
  assert.equal(
    context.locations.templateProfile,
    expectedLocation(defaultProjectRoot, config.template.profilePath)
  );
});

test("ProjectContext errors serialize deterministically without path values", () => {
  const config = cloneConfig();
  config.paths.outputRoot = config.paths.stagingRoot;
  let captured;
  try {
    create({ projectConfig: config });
  } catch (error) {
    captured = error;
  }
  assert.ok(captured instanceof ProjectContextError);
  assert.equal(
    JSON.stringify(captured),
    '{"code":"PROJECT_CONTEXT_PATH_ALIAS","pointer":"/paths"}'
  );
  assert.equal(JSON.stringify(captured).includes(defaultProjectRoot), false);
});

test("core source contains no ambient root discovery or out-of-scope I/O", async () => {
  const source = await readFile(
    new URL("../packages/core/src/project-context.mjs", import.meta.url),
    "utf8"
  );

  for (const forbidden of [
    /process\.(?:cwd|env)/u,
    /__dirname/u,
    /import\.meta\.url/u,
    /node:fs/u,
    /\brealpath\b/u,
    /\blstat\b/u,
    /\bfindUp\b/u,
    /\.git/u,
    /\b(?:repoRoot|rootCache|projectRootSingleton)\b/u,
    /["']\/(?:Users|home|private|tmp)\//u,
    /[A-Za-z]:\\Users\\/u
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
  assert.match(source, /from "node:path"/u);
  assert.doesNotMatch(source, /from "node:(?!path)[^"]+"/u);
});
