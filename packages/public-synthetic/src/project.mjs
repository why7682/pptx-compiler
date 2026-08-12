import { constants as fsConstants } from "node:fs";
import { lstat, mkdir, open, realpath, rmdir, unlink } from "node:fs/promises";
import path from "node:path";

import { buildSyntheticFixtures } from "./fixtures.mjs";

export const PUBLIC_SYNTHETIC_PROJECT_VERSION = "0.1.0";
export const PUBLIC_SYNTHETIC_PRESET = "public-synthetic-native-card";
export const PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE = Object.freeze({
  profileVersion: "0.1.0",
  profileId: "public-synthetic-native-card-candidate",
  projectIdentity: Object.freeze({
    projectId: "public-synthetic-native-card-project",
    templateProfileId: "public-synthetic-template-profile",
    templateIndexId: "public-synthetic-template-index",
    capabilityRegistryId: "public-synthetic-native-card-registry",
    projectOverlayId: "public-synthetic-native-card-overlay",
    capabilitySelectionId: "public-synthetic-native-card-selection",
    capabilityId: "native-card-arrow",
    capabilityVersion: "0.1.0"
  }),
  observedFeatureIds: Object.freeze([
    "content-types-and-relationships",
    "drawingml-shapes",
    "masters-layouts-themes",
    "package-container",
    "slide-text"
  ]),
  supportItemIds: Object.freeze([
    "capability-overlay",
    "collateral-mutation-qa",
    "content-types-and-relationships",
    "deck-slide-spec",
    "drawingml-shapes",
    "masters-layouts-themes",
    "native-drawingml",
    "package-container",
    "package-inspection",
    "potx-template",
    "project-config",
    "slide-text",
    "staged-create-only-assembly",
    "template-profile-binding",
    "template-profile-index"
  ]),
  qaManualGateItemIds: Object.freeze([
    "macos-powerpoint-automation",
    "manual-trusted-runtime"
  ]),
  evidenceItemId: "automated-public-synthetic"
});

const PROJECT_CONFIG_NAME = "pptx-compiler.project.json";
const FILES = Object.freeze([
  "data/capability-registry.json",
  "data/deck-spec.json",
  "data/project-overlay.json",
  "data/template-profile.json",
  "input/template.potx",
  PROJECT_CONFIG_NAME
]);
const DIRECTORIES = Object.freeze([
  "assets",
  "data",
  "deliveries",
  "input",
  "records",
  "staging"
]);
const VALIDATOR_KEYS = Object.freeze([
  "validateCapabilityRegistry",
  "validateDeckSpec",
  "validateProjectConfig",
  "validateProjectOverlay",
  "validateTemplateProfile"
]);
const OPERATION_KEYS = Object.freeze(["syncDirectory", "syncFile"]);

export class PublicSyntheticProjectError extends Error {
  constructor(code, pointer = "/projectRoot") {
    super(code);
    this.name = "PublicSyntheticProjectError";
    this.code = code;
    this.pointer = pointer;
  }
}

function fail(code, pointer) {
  throw new PublicSyntheticProjectError(code, pointer);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactRecord(value, keys) {
  if (!isPlainRecord(value)) return false;
  const actual = Reflect.ownKeys(value);
  const allowed = new Set(keys);
  if (actual.length !== keys.length ||
      actual.some((key) => typeof key !== "string" || !allowed.has(key))) {
    return false;
  }
  return actual.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
  });
}

function captureDependencies(value) {
  if (!exactRecord(value, VALIDATOR_KEYS)) fail("PUBLIC_SYNTHETIC_PROJECT_INVALID", "/dependencies");
  const captured = {};
  for (const key of VALIDATOR_KEYS) {
    if (typeof value[key] !== "function") {
      fail("PUBLIC_SYNTHETIC_PROJECT_INVALID", `/dependencies/${key}`);
    }
    captured[key] = Object.getOwnPropertyDescriptor(value, key).value;
  }
  return Object.freeze(captured);
}

function normalizedAbsolute(value) {
  if (typeof value !== "string" || value.length === 0 ||
      /[\u0000-\u001f\u007f]/u.test(value) || !path.isAbsolute(value) ||
      path.normalize(value) !== value || path.dirname(value) === value) {
    fail("PUBLIC_SYNTHETIC_PROJECT_INVALID", "/projectRoot");
  }
  return value;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value === null || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value).sort()) output[key] = canonicalJson(value[key]);
  return output;
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(canonicalJson(value), null, 2)}\n`, "utf8");
}

function projectDocuments(templateSha256) {
  const projectConfig = {
    schemaVersion: "0.1.0",
    contractType: "project-config",
    projectId: "public-synthetic-native-card-project",
    template: {
      sourcePath: "input/template.potx",
      profileId: "public-synthetic-template-profile",
      profilePath: "data/template-profile.json",
      indexId: "public-synthetic-template-index",
      indexPath: "records/template-index.json"
    },
    capabilityRegistry: {
      registryId: "public-synthetic-native-card-registry",
      registryVersion: "0.1.0",
      path: "data/capability-registry.json"
    },
    projectOverlay: {
      overlayId: "public-synthetic-native-card-overlay",
      path: "data/project-overlay.json"
    },
    paths: {
      assetRoot: "assets",
      stagingRoot: "staging",
      outputRoot: "deliveries"
    },
    policies: {
      experimentalCapabilities: "require-explicit-opt-in",
      unknownFeatures: "reject",
      ambiguousBindings: "reject",
      sourceMutation: "reject"
    }
  };
  const templateProfile = {
    schemaVersion: "0.1.0",
    contractType: "template-profile",
    templateProfileId: "public-synthetic-template-profile",
    templateIndexId: "public-synthetic-template-index",
    templateFormat: "potx",
    templateSha256,
    slideSizeEmu: { cx: 12_192_000, cy: 6_858_000 },
    layoutBindings: [{ layoutKey: "layout-1", semanticRole: "content" }]
  };
  const capabilityRegistry = {
    schemaVersion: "0.1.0",
    contractType: "capability-registry",
    capabilityRegistryId: "public-synthetic-native-card-registry",
    registryVersion: "0.1.0",
    capabilities: [{
      capabilityId: "native-card-arrow",
      capabilityVersion: "0.1.0",
      supportMatrixItemId: "native-drawingml",
      executorId: "urn:pptx-compiler:capability:executor:native-card-arrow:0.1.0",
      inputSchemaId: "urn:pptx-compiler:capability:schema:native-card-arrow-input:0.1.0",
      outputSchemaId: "urn:pptx-compiler:capability:schema:native-card-arrow-output:0.1.0",
      qaContractId: "urn:pptx-compiler:capability:qa:native-card-arrow:0.1.0",
      requiredBindingRoles: ["anchor"],
      conformanceFixtureIds: ["native-card-arrow-basic", "native-card-arrow-escaping"]
    }]
  };
  const projectOverlay = {
    schemaVersion: "0.1.0",
    contractType: "project-overlay",
    projectOverlayId: "public-synthetic-native-card-overlay",
    projectId: "public-synthetic-native-card-project",
    templateProfileId: "public-synthetic-template-profile",
    templateIndexId: "public-synthetic-template-index",
    templateSha256,
    capabilityRegistryId: "public-synthetic-native-card-registry",
    registryVersion: "0.1.0",
    capabilitySelections: [{
      capabilitySelectionId: "public-synthetic-native-card-selection",
      capabilityId: "native-card-arrow",
      capabilityVersion: "0.1.0",
      experimentalOptIn: true,
      bindings: [{ role: "anchor", shapeBindingId: "public-synthetic-anchor-binding" }]
    }],
    shapeBindings: [{
      shapeBindingId: "public-synthetic-anchor-binding",
      containerKind: "slide",
      containerKey: "slide-1",
      shapeKey: "shape-2",
      expectedKind: "text-box",
      cardinality: "exactly-one"
    }]
  };
  const deckSpec = {
    schemaVersion: "0.1.0",
    contractType: "deck-spec",
    deckId: "public-synthetic-native-card-deck",
    projectId: "public-synthetic-native-card-project",
    templateProfileId: "public-synthetic-template-profile",
    projectOverlayId: "public-synthetic-native-card-overlay",
    slides: [{
      slideId: "public-synthetic-native-card-slide",
      capabilitySelectionId: "public-synthetic-native-card-selection",
      payload: {
        geometry: { x: 1_981_200, y: 4_000_500, cx: 8_229_600, cy: 1_828_800 },
        label: "Public synthetic decision",
        style: {
          arrowFill: "2563EB",
          cardFill: "E0E7FF",
          fontSizeHundredthPoints: 1_800,
          lineColor: "1E3A8A",
          textColor: "111827"
        }
      }
    }]
  };
  return { projectConfig, templateProfile, capabilityRegistry, projectOverlay, deckSpec };
}

function validateDocuments(documents, validators) {
  const pairs = [
    ["validateProjectConfig", documents.projectConfig, "/projectConfig"],
    ["validateTemplateProfile", documents.templateProfile, "/templateProfile"],
    ["validateCapabilityRegistry", documents.capabilityRegistry, "/capabilityRegistry"],
    ["validateProjectOverlay", documents.projectOverlay, "/projectOverlay"],
    ["validateDeckSpec", documents.deckSpec, "/deckSpec"]
  ];
  for (const [validatorName, document, pointer] of pairs) {
    let result;
    try {
      result = validators[validatorName](document);
    } catch {
      fail("PUBLIC_SYNTHETIC_PROJECT_INVALID", pointer);
    }
    if (result !== true) fail("PUBLIC_SYNTHETIC_PROJECT_INVALID", pointer);
  }
}

async function assertParent(parent) {
  let metadata;
  try {
    metadata = await lstat(parent);
    await realpath(parent);
  } catch {
    fail("PUBLIC_SYNTHETIC_PROJECT_PARENT_UNAVAILABLE", "/projectRoot");
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    fail("PUBLIC_SYNTHETIC_PROJECT_PARENT_UNAVAILABLE", "/projectRoot");
  }
}

async function writeExclusive(filePath, bytes, { onVisible = () => {}, syncFile }) {
  let handle;
  try {
    handle = await open(
      filePath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY |
      (fsConstants.O_NOFOLLOW ?? 0),
      0o600
    );
    onVisible();
    await handle.writeFile(bytes);
    await syncFile(handle, filePath);
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

async function syncDirectory(directory) {
  if (process.platform === "win32") return;
  let handle;
  try {
    handle = await open(directory, fsConstants.O_RDONLY);
    await handle.sync();
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

function captureOperations(value) {
  const defaults = {
    syncDirectory,
    syncFile(handle) {
      return handle.sync();
    }
  };
  if (value === undefined) return Object.freeze(defaults);
  if (!isPlainRecord(value)) fail("PUBLIC_SYNTHETIC_PROJECT_INVALID", "/operations");
  const allowed = new Set(OPERATION_KEYS);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowed.has(key))) {
    fail("PUBLIC_SYNTHETIC_PROJECT_INVALID", "/operations");
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor) ||
        typeof descriptor.value !== "function") {
      fail("PUBLIC_SYNTHETIC_PROJECT_INVALID", `/operations/${String(key)}`);
    }
    defaults[key] = descriptor.value;
  }
  return Object.freeze(defaults);
}

function sameDirectoryIdentity(left, right) {
  return left?.isDirectory() === true && right?.isDirectory() === true &&
    left.isSymbolicLink() === false && right.isSymbolicLink() === false &&
    left.dev === right.dev && left.ino === right.ino;
}

async function rollbackOwnedRoot({ root, parent, rootIdentity, operations }) {
  let current;
  try {
    current = await lstat(root, { bigint: true });
  } catch {
    return false;
  }
  if (!sameDirectoryIdentity(rootIdentity, current)) return false;

  let complete = true;
  for (const relativePath of [...FILES].reverse()) {
    try {
      await unlink(path.join(root, ...relativePath.split("/")));
    } catch (error) {
      if (error?.code !== "ENOENT") complete = false;
    }
  }
  for (const directory of [...DIRECTORIES].reverse()) {
    try {
      await rmdir(path.join(root, directory));
    } catch (error) {
      if (error?.code !== "ENOENT") complete = false;
    }
  }
  try {
    await rmdir(root);
  } catch (error) {
    if (error?.code !== "ENOENT") complete = false;
  }
  if (complete) {
    try {
      await operations.syncDirectory(parent);
    } catch {
      complete = false;
    }
  }
  return complete;
}

export async function createPublicSyntheticProject({
  projectRoot,
  preset,
  dependencies,
  fixtureSourceRoot
} = {}, operationOverrides) {
  const root = normalizedAbsolute(projectRoot);
  if (preset !== PUBLIC_SYNTHETIC_PRESET) {
    fail("PUBLIC_SYNTHETIC_PROJECT_PRESET_UNAVAILABLE", "/preset");
  }
  const validators = captureDependencies(dependencies);
  const operations = captureOperations(operationOverrides);
  const built = await buildSyntheticFixtures(
    fixtureSourceRoot === undefined ? {} : { sourceRoot: fixtureSourceRoot }
  );
  const template = built.archives.find((archive) => archive.variant === "potx");
  if (!template) fail("PUBLIC_SYNTHETIC_PROJECT_INVALID", "/preset");
  const documents = projectDocuments(template.sha256);
  validateDocuments(documents, validators);

  const parent = path.dirname(root);
  await assertParent(parent);
  try {
    await mkdir(root, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") fail("PUBLIC_SYNTHETIC_PROJECT_CONFLICT", "/projectRoot");
    fail("PUBLIC_SYNTHETIC_PROJECT_NOT_COMMITTED", "/projectRoot");
  }

  let rootIdentity;
  try {
    rootIdentity = await lstat(root, { bigint: true });
    if (!rootIdentity.isDirectory() || rootIdentity.isSymbolicLink()) throw new Error("root-identity");
  } catch {
    fail("PUBLIC_SYNTHETIC_PROJECT_ROLLBACK_INCOMPLETE", "/projectRoot");
  }

  let markerVisible = false;
  try {
    for (const directory of DIRECTORIES) {
      await mkdir(path.join(root, directory), { mode: 0o700 });
    }
    const fileBytes = new Map([
      ["data/capability-registry.json", jsonBytes(documents.capabilityRegistry)],
      ["data/deck-spec.json", jsonBytes(documents.deckSpec)],
      ["data/project-overlay.json", jsonBytes(documents.projectOverlay)],
      ["data/template-profile.json", jsonBytes(documents.templateProfile)],
      ["input/template.potx", Buffer.from(template.bytes)]
    ]);
    for (const [relativePath, bytes] of fileBytes) {
      await writeExclusive(path.join(root, ...relativePath.split("/")), bytes, operations);
    }
    for (const directory of DIRECTORIES) {
      await operations.syncDirectory(path.join(root, directory));
    }
    await operations.syncDirectory(root);

    // ProjectConfig is the logical commit marker: every referenced bootstrap
    // input except the inspect-produced TemplateIndex is file-flushed first.
    // POSIX also requests containing-directory fsync barriers.
    await writeExclusive(
      path.join(root, PROJECT_CONFIG_NAME),
      jsonBytes(documents.projectConfig),
      {
        ...operations,
        onVisible() {
          markerVisible = true;
        }
      }
    );
    await operations.syncDirectory(root);
    await operations.syncDirectory(parent);
  } catch {
    if (markerVisible) {
      fail("PUBLIC_SYNTHETIC_PROJECT_COMMIT_UNCERTAIN", "/projectRoot");
    }
    const rolledBack = await rollbackOwnedRoot({ root, parent, rootIdentity, operations });
    fail(
      rolledBack
        ? "PUBLIC_SYNTHETIC_PROJECT_NOT_COMMITTED"
        : "PUBLIC_SYNTHETIC_PROJECT_ROLLBACK_INCOMPLETE",
      "/projectRoot"
    );
  }

  return Object.freeze({
    preset: PUBLIC_SYNTHETIC_PRESET,
    projectVersion: PUBLIC_SYNTHETIC_PROJECT_VERSION,
    created: true,
    files: FILES
  });
}
