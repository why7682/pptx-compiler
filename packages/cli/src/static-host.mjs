import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  assertSupportedSchema,
  createCapabilityRuntime,
  validateJson
} from "#pptx-compiler/extension-api";
import {
  createNativeCardArrowRegistration,
  NativeCardArrowRegistrationError
} from "#pptx-compiler/native-card-arrow";
import { PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE } from
  "#pptx-compiler/public-synthetic";

const MAX_INSTALLATION_JSON_BYTES = 4 * 1024 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true });
const ARTIFACT_PATH_KEYS = Object.freeze([
  "conformanceCasesPath",
  "expectedTemplateIndexPath",
  "inputSchemaPath",
  "outputSchemaPath",
  "supportMatrixPath",
  "supportMatrixSchemaPath"
]);
const REPOSITORY_ARTIFACT_PATHS = Object.freeze({
  conformanceCasesPath: "fixtures/capabilities/native-card-arrow/cases.json",
  expectedTemplateIndexPath: "fixtures/inspection/expected-potx-template-index.json",
  inputSchemaPath: "plugins/native-card-arrow/schemas/input.schema.json",
  outputSchemaPath: "plugins/native-card-arrow/schemas/output.schema.json",
  supportMatrixPath: "policy/support-matrix.json",
  supportMatrixSchemaPath: "schemas/support-matrix.schema.json"
});

export class CliStaticHostError extends Error {
  constructor(pointer = "/host") {
    super("CLI_STATIC_HOST_INVALID");
    this.name = "CliStaticHostError";
    this.code = "CLI_STATIC_HOST_INVALID";
    this.pointer = pointer;
  }
}

function fail(pointer) {
  throw new CliStaticHostError(pointer);
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const expected = new Set(keys);
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length ||
      actual.some((key) => typeof key !== "string" || !expected.has(key))) {
    return false;
  }
  return actual.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
  });
}

function normalizedRoot(value) {
  if (typeof value !== "string" || !path.isAbsolute(value) || path.normalize(value) !== value ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    fail("/host");
  }
  return value;
}

function normalizedArtifactPath(value) {
  if (typeof value !== "string" || !path.isAbsolute(value) || path.normalize(value) !== value ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    fail("/host");
  }
  return value;
}

function captureArtifactPaths({ installationRoot, artifactPaths }) {
  if (artifactPaths === undefined) {
    const root = normalizedRoot(installationRoot);
    return Object.freeze(Object.fromEntries(ARTIFACT_PATH_KEYS.map((key) => [
      key,
      path.join(root, ...REPOSITORY_ARTIFACT_PATHS[key].split("/"))
    ])));
  }
  if (installationRoot !== undefined || !exactRecord(artifactPaths, ARTIFACT_PATH_KEYS)) {
    fail("/host");
  }
  return Object.freeze(Object.fromEntries(ARTIFACT_PATH_KEYS.map((key) => [
    key,
    normalizedArtifactPath(Object.getOwnPropertyDescriptor(artifactPaths, key).value)
  ])));
}

async function readArtifactJson(filePath) {
  let bytes;
  try {
    bytes = await readFile(filePath);
    if (bytes.length < 1 || bytes.length > MAX_INSTALLATION_JSON_BYTES) fail("/host");
    return JSON.parse(decoder.decode(bytes));
  } catch (error) {
    if (error instanceof CliStaticHostError) throw error;
    fail("/host");
  }
}

function createSupportResolver(matrix, schema) {
  try {
    assertSupportedSchema(schema);
    if (validateJson(matrix, schema).length !== 0) fail("/supportMatrix");
  } catch (error) {
    if (error instanceof CliStaticHostError) throw error;
    fail("/supportMatrix");
  }
  const rows = new Map();
  for (const items of Object.values(matrix.dimensions)) {
    for (const item of items) {
      if (rows.has(item.id)) fail("/supportMatrix");
      rows.set(item.id, item);
    }
  }
  const resolveCapabilitySupport = Object.freeze(function resolveCapabilitySupport(query) {
    const item = rows.get(query?.supportMatrixItemId);
    if (!item) fail("/supportMatrix");
    return Object.freeze({
      supportMatrixItemId: item.id,
      supportClaimsEnabled: matrix.supportClaimsEnabled,
      status: item.status,
      disposition: item.disposition
    });
  });
  return Object.freeze({ matrix, resolveCapabilitySupport, rows });
}

export function resolveCliRuntimeSupportItemId({ platform, nodeVersion } = {}) {
  const mappedPlatform = Object.freeze({
    darwin: "macos",
    linux: "linux",
    win32: "windows"
  })[platform];
  const match = typeof nodeVersion === "string"
    ? /^(22|24)[.][0-9]+[.][0-9]+(?:[-+].*)?$/u.exec(nodeVersion)
    : null;
  if (mappedPlatform === undefined || match === null) fail("/runtime");
  return `${mappedPlatform}-node-${match[1]}`;
}

function runtimeSupportItemId() {
  return resolveCliRuntimeSupportItemId({
    platform: process.platform,
    nodeVersion: process.versions.node
  });
}

function createCandidateProfile(support, sourceTemplateIndex, validateTemplateIndex) {
  const profile = PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE;
  const itemIds = profile.supportItemIds;
  const qaManualGateItemIds = profile.qaManualGateItemIds;
  const observedFeatureIds = profile.observedFeatureIds;
  const projectIdentity = profile.projectIdentity;
  if (!Object.isFrozen(profile) || !Object.isFrozen(itemIds) ||
      !Object.isFrozen(qaManualGateItemIds) ||
      !Object.isFrozen(observedFeatureIds) || !Object.isFrozen(projectIdentity) ||
      profile.profileVersion !== "0.1.0" ||
      profile.profileId !== "public-synthetic-native-card-candidate" ||
      itemIds.length !== 15 || new Set(itemIds).size !== itemIds.length ||
      [...itemIds].sort().some((itemId, index) => itemId !== itemIds[index]) ||
      qaManualGateItemIds.length !== 2 ||
      new Set(qaManualGateItemIds).size !== qaManualGateItemIds.length ||
      [...qaManualGateItemIds].sort().some((itemId, index) =>
        itemId !== qaManualGateItemIds[index]) ||
      observedFeatureIds.length !== 5 ||
      new Set(observedFeatureIds).size !== observedFeatureIds.length ||
      [...observedFeatureIds].sort().some((itemId, index) =>
        itemId !== observedFeatureIds[index] || !itemIds.includes(itemId)) ||
      support.matrix.supportClaimsEnabled !== false) {
    fail("/supportProfile");
  }
  if (sourceTemplateIndex?.templateIndexId !== "synthetic-template-index" ||
      sourceTemplateIndex?.templateProfileId !== "synthetic-template-profile") {
    fail("/supportProfile/templateIndex");
  }
  const expectedTemplateIndex = deepFreeze({
    ...sourceTemplateIndex,
    templateIndexId: projectIdentity.templateIndexId,
    templateProfileId: projectIdentity.templateProfileId
  });
  try {
    if (validateTemplateIndex(expectedTemplateIndex) !== true) {
      fail("/supportProfile/templateIndex");
    }
  } catch (error) {
    if (error instanceof CliStaticHostError) throw error;
    fail("/supportProfile/templateIndex");
  }
  if (expectedTemplateIndex.templateFormat !== "potx" ||
      expectedTemplateIndex.observedFeatureIds.length !== observedFeatureIds.length ||
      expectedTemplateIndex.observedFeatureIds.some((itemId, index) =>
        itemId !== observedFeatureIds[index])) {
    fail("/supportProfile/templateIndex");
  }
  const runtimeItemId = runtimeSupportItemId();
  for (const [itemId, pointer] of [
    ...itemIds.map((itemId) => [itemId, "/supportProfile/supportItemIds"]),
    [runtimeItemId, "/runtime"],
    [profile.evidenceItemId, "/supportProfile/evidenceItemId"]
  ]) {
    const row = support.rows.get(itemId);
    if (row?.status !== "experimental" || row?.disposition !== "accept-with-warning") {
      fail(pointer);
    }
  }
  for (const itemId of qaManualGateItemIds) {
    const row = support.rows.get(itemId);
    if (row?.status !== "manual" || row?.disposition !== "report-manual-gate") {
      fail("/supportProfile/qaManualGateItemIds");
    }
  }
  return Object.freeze({
    profileVersion: profile.profileVersion,
    profileId: profile.profileId,
    status: "experimental",
    supportClaimsEnabled: false,
    observedFeatureIds,
    projectIdentity,
    qaManualGateItemIds,
    supportItemIds: Object.freeze([...itemIds, runtimeItemId].sort()),
    runtimeSupportItemId: runtimeItemId,
    evidenceItemId: profile.evidenceItemId,
    expectedTemplateIndex
  });
}

export async function createCliStaticHost({
  installationRoot,
  artifactPaths,
  capabilityRegistry,
  validateCapabilityRegistry,
  validateTemplateIndex
} = {}) {
  const paths = captureArtifactPaths({ installationRoot, artifactPaths });
  if (typeof validateCapabilityRegistry !== "function" ||
      typeof validateTemplateIndex !== "function") fail("/host");
  const [cases, sourceTemplateIndex, inputSchema, outputSchema, supportMatrix, supportSchema] =
    await Promise.all(ARTIFACT_PATH_KEYS.map((key) => readArtifactJson(paths[key])));
  let registration;
  try {
    registration = createNativeCardArrowRegistration({ cases, inputSchema, outputSchema });
  } catch (error) {
    if (error instanceof NativeCardArrowRegistrationError) fail("/host");
    throw error;
  }
  const support = createSupportResolver(supportMatrix, supportSchema);
  const candidateProfile = createCandidateProfile(
    support,
    sourceTemplateIndex,
    validateTemplateIndex
  );
  const runtime = await createCapabilityRuntime({
    capabilityRegistry,
    registrations: [registration],
    dependencies: {
      validateCapabilityRegistry,
      validateSchemaDocument(value) {
        try {
          assertSupportedSchema(value);
          return true;
        } catch {
          return false;
        }
      },
      resolveCapabilitySupport: support.resolveCapabilitySupport
    }
  });
  return Object.freeze({ runtime, candidateProfile });
}

/** Compatibility projection for the D-036 project-validation surface. */
export async function createCliStaticRuntime(options) {
  return (await createCliStaticHost(options)).runtime;
}
