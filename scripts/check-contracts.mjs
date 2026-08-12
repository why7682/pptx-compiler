#!/usr/bin/env node

import { constants as fsConstants } from "node:fs";
import { lstat, mkdir, open, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveSlideLayoutIr } from "../packages/core/src/slide-layout-ir.mjs";
import {
  EXPECTED_META_SCHEMA,
  assertSupportedSchema,
  createSchemaRegistry,
  isPlainObject,
  resolveSchemaReference,
  validateJson
} from "./lib/json-schema.mjs";

const REPORT_SCHEMA_VERSION = 1;
const MANIFEST_SCHEMA_VERSION = 1;
const CONTRACT_VERSION = "0.1.0";
const MANIFEST_PATH = "schemas/contracts/manifest.json";
const SUPPORT_MATRIX_PATH = "policy/support-matrix.json";
const TYPE_OUTPUT_PATH = "types/contracts.d.ts";
const MAX_CONTROL_FILE_BYTES = 2 * 1024 * 1024;
const REQUIRED_CONTRACT_TYPES = [
  "build-artifact",
  "candidate-build-record",
  "capability-registry",
  "deck-spec",
  "project-config",
  "project-overlay",
  "qa-report",
  "template-index",
  "template-profile"
];
const REQUIRED_SCHEMA_IDS = [
  "urn:pptx-compiler:schema:build-artifact:0.1.0",
  "urn:pptx-compiler:schema:candidate-build-record:0.1.0",
  "urn:pptx-compiler:schema:capability-registry:0.1.0",
  "urn:pptx-compiler:schema:deck-spec:0.1.0",
  "urn:pptx-compiler:schema:project-config:0.1.0",
  "urn:pptx-compiler:schema:project-overlay:0.1.0",
  "urn:pptx-compiler:schema:qa-report:0.1.0",
  "urn:pptx-compiler:schema:shared:0.1.0",
  "urn:pptx-compiler:schema:template-index:0.1.0",
  "urn:pptx-compiler:schema:template-profile:0.1.0"
];
const REQUIRED_TYPE_EXPORTS = [
  ["BindingAssignment", "project-overlay", "#/$defs/bindingAssignment"],
  ["BuildArtifact", "build-artifact", "#"],
  ["CandidateBuildRecord", "candidate-build-record", "#/$defs/candidateBuildRecord"],
  ["CapabilityDefinition", "capability-registry", "#/$defs/capabilityDefinition"],
  ["CapabilityRegistry", "capability-registry", "#"],
  ["CapabilitySelection", "project-overlay", "#/$defs/capabilitySelection"],
  ["ComposedSlidePlan", "candidate-build-record", "#/$defs/composedSlidePlan"],
  ["DeckSpec", "deck-spec", "#"],
  ["Diagnostic", "qa-report", "#/$defs/diagnostic"],
  ["ManualGate", "qa-report", "#/$defs/manualGate"],
  ["ProjectConfig", "project-config", "#"],
  ["ProjectOverlay", "project-overlay", "#"],
  ["PublishedOutput", "build-artifact", "#/$defs/publishedOutput"],
  ["QaCheck", "qa-report", "#/$defs/qaCheck"],
  ["QaReport", "qa-report", "#"],
  ["ShapeBinding", "project-overlay", "#/$defs/shapeBinding"],
  ["SlideLayoutIR", "candidate-build-record", "#/$defs/slideLayoutIr"],
  ["SlideResult", "build-artifact", "#/$defs/slideResult"],
  ["SlideSpec", "deck-spec", "#/$defs/slideSpec"],
  ["TemplateIndex", "template-index", "#"],
  ["TemplateLayoutIndexEntry", "template-index", "#/$defs/layoutEntry"],
  ["TemplateMasterIndexEntry", "template-index", "#/$defs/masterEntry"],
  ["TemplateProfile", "template-profile", "#"],
  ["TemplateShapeIndexEntry", "template-index", "#/$defs/shapeEntry"],
  ["TemplateSlideIndexEntry", "template-index", "#/$defs/slideEntry"]
].map(([name, schemaName, pointer]) => [
  name,
  `urn:pptx-compiler:schema:${schemaName}:${CONTRACT_VERSION}`,
  pointer
]);
const decoder = new TextDecoder("utf-8", { fatal: true });

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalPath(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate !== candidate.normalize("NFC")) {
    return false;
  }
  if (candidate.includes("\\") || candidate.includes("\0") || candidate.startsWith("/") ||
      candidate.startsWith("//") || /^[A-Za-z]:/.test(candidate)) {
    return false;
  }
  const parts = candidate.split("/");
  return !parts.some((part) => part === "" || part === "." || part === "..") &&
    path.posix.normalize(candidate) === candidate;
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function runGit(root, args, { encoding = "utf8", maxBuffer = 16 * 1024 * 1024 } = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding,
    maxBuffer,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed`);
  return result.stdout;
}

function splitNull(buffer) {
  const values = [];
  let start = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0) {
      if (index > start) values.push(buffer.subarray(start, index));
      start = index + 1;
    }
  }
  if (start !== buffer.length) throw new Error("Git returned malformed path data");
  return values;
}

function decode(buffer) {
  try {
    return decoder.decode(buffer);
  } catch {
    throw new Error("control data is not valid UTF-8");
  }
}

function listAdmittedPaths(root, mode) {
  const args = mode === "index"
    ? ["ls-files", "--cached", "-z"]
    : ["ls-files", "--cached", "--others", "--exclude-standard", "-z"];
  const output = runGit(root, args, { encoding: null });
  return new Set(splitNull(output).map((entry) => decode(entry)));
}

function readIndexControl(root, relativePath) {
  if (!canonicalPath(relativePath)) throw new Error("control path is invalid");
  const entry = runGit(root, ["ls-files", "--stage", "--", relativePath]).trim();
  const match = /^(100644|100755) ([0-9a-f]{40,64}) 0\t/.exec(entry);
  if (!match) throw new Error("control file is missing from the index or not a regular stage-zero file");
  const size = Number(runGit(root, ["cat-file", "-s", match[2]]).trim());
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_CONTROL_FILE_BYTES) {
    throw new Error("control file has an invalid size");
  }
  return runGit(root, ["cat-file", "blob", match[2]], {
    encoding: null,
    maxBuffer: MAX_CONTROL_FILE_BYTES + 1
  });
}

async function readWorkingControl(root, relativePath) {
  if (!canonicalPath(relativePath)) throw new Error("control path is invalid");
  const absolutePath = path.resolve(root, ...relativePath.split("/"));
  if (!isContained(root, absolutePath)) throw new Error("control path escapes the repository");
  const metadata = await lstat(absolutePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_CONTROL_FILE_BYTES) {
    throw new Error("control file is not a safe regular file");
  }
  const rootReal = await realpath(root);
  const fileReal = await realpath(absolutePath);
  if (!isContained(rootReal, fileReal) || fileReal !== absolutePath) {
    throw new Error("control file resolves through a link or outside the repository");
  }
  const handle = await open(absolutePath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== metadata.dev || opened.ino !== metadata.ino) {
      throw new Error("control file changed during inspection");
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function parseJson(content, label) {
  try {
    return JSON.parse(decode(content));
  } catch {
    throw new Error(`${label} is not valid UTF-8 JSON`);
  }
}

function exactKeys(value, keys) {
  return isPlainObject(value) &&
    Object.keys(value).sort(compareText).join("\0") === [...keys].sort(compareText).join("\0");
}

function assertLoadableManifest(manifest) {
  if (!exactKeys(manifest, [
    "schemaVersion", "contractVersion", "metaSchema", "fixturePurpose", "typeOutput", "schemas", "fixtures", "typeExports"
  ]) || manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION || manifest.contractVersion !== CONTRACT_VERSION ||
      manifest.metaSchema !== EXPECTED_META_SCHEMA || manifest.fixturePurpose !== "schema-conformance-only" ||
      manifest.typeOutput !== TYPE_OUTPUT_PATH ||
      !Array.isArray(manifest.schemas) || !Array.isArray(manifest.fixtures) || !Array.isArray(manifest.typeExports)) {
    throw new Error("contract manifest has an unsupported structure");
  }
  for (const entry of manifest.schemas) {
    if (!exactKeys(entry, ["id", "path"]) || typeof entry.id !== "string" ||
        !canonicalPath(entry.path) || !entry.path.startsWith("schemas/contracts/") ||
        !entry.path.endsWith(".schema.json")) {
      throw new Error("contract manifest has an invalid schema entry");
    }
  }
  for (const entry of manifest.fixtures) {
    if (!exactKeys(entry, ["contractType", "schemaId", "path"]) || typeof entry.contractType !== "string" ||
        typeof entry.schemaId !== "string" || !canonicalPath(entry.path) ||
        !entry.path.startsWith("fixtures/contracts/valid/") || !entry.path.endsWith(".json")) {
      throw new Error("contract manifest has an invalid fixture entry");
    }
  }
  for (const entry of manifest.typeExports) {
    if (!exactKeys(entry, ["name", "schemaId", "pointer"]) || !/^[A-Z][A-Za-z0-9]*$/.test(entry.name) ||
        typeof entry.schemaId !== "string" || typeof entry.pointer !== "string" ||
        (entry.pointer !== "#" && !entry.pointer.startsWith("#/"))) {
      throw new Error("contract manifest has an invalid type export entry");
    }
  }
}

export async function loadContractSet(repositoryRoot, mode, { allowMissingType = false } = {}) {
  const admittedPaths = listAdmittedPaths(repositoryRoot, mode);
  const read = mode === "index"
    ? (relativePath) => readIndexControl(repositoryRoot, relativePath)
    : (relativePath) => readWorkingControl(repositoryRoot, relativePath);
  const manifest = parseJson(await read(MANIFEST_PATH), "contract manifest");
  assertLoadableManifest(manifest);

  const schemas = {};
  for (const entry of manifest.schemas) {
    schemas[entry.id] = parseJson(await read(entry.path), entry.path);
  }
  const fixtures = {};
  for (const entry of manifest.fixtures) {
    fixtures[entry.contractType] = parseJson(await read(entry.path), entry.path);
  }
  let typeSource = "";
  if (!allowMissingType || admittedPaths.has(manifest.typeOutput)) {
    typeSource = decode(await read(manifest.typeOutput));
  }
  const supportMatrix = parseJson(await read(SUPPORT_MATRIX_PATH), SUPPORT_MATRIX_PATH);
  return { manifest, schemas, fixtures, typeSource, supportMatrix, admittedPaths };
}

function finding(pathValue, ruleId, jsonPointer = "/") {
  return {
    path: pathValue,
    ruleId,
    severity: "error",
    location: { jsonPointer }
  };
}

function sortFindings(findings) {
  return findings.sort((left, right) =>
    compareText(left.path, right.path) ||
    compareText(left.ruleId, right.ruleId) ||
    compareText(left.location?.jsonPointer ?? "", right.location?.jsonPointer ?? "")
  );
}

function indentBlock(source, spaces) {
  const prefix = " ".repeat(spaces);
  return source.split("\n").map((line) => `${prefix}${line}`).join("\n");
}

function propertyName(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function targetKey(schemaId, pointer) {
  return `${schemaId}${pointer}`;
}

export function generateContractTypes(manifest, schemas) {
  const registry = createSchemaRegistry(Object.values(schemas));
  const exportNames = new Map();
  for (const entry of manifest.typeExports) {
    const root = registry.get(entry.schemaId);
    if (!root) throw new Error(`type export ${entry.name} references an unknown schema`);
    const resolved = resolveSchemaReference(entry.pointer, root, registry);
    exportNames.set(targetKey(resolved.schemaId, resolved.pointer), entry.name);
  }

  const render = (schema, rootSchema, currentName, depth = 0) => {
    if (depth > 64) throw new Error("schema type graph exceeds the supported depth");
    if (schema.$ref !== undefined) {
      const resolved = resolveSchemaReference(schema.$ref, rootSchema, registry);
      const named = exportNames.get(targetKey(resolved.schemaId, resolved.pointer));
      if (named !== undefined && named !== currentName) return named;
      return render(resolved.schema, resolved.rootSchema, currentName, depth + 1);
    }
    if (schema.const !== undefined) return JSON.stringify(schema.const);
    if (schema.enum !== undefined) return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
    if (schema.oneOf !== undefined) {
      return schema.oneOf.map((candidate) => render(candidate, rootSchema, currentName, depth + 1)).join(" | ");
    }
    if (schema.type === "object") {
      const entries = Object.entries(schema.properties ?? {});
      if (entries.length === 0 && schema.additionalProperties === true) return "Record<string, unknown>";
      const required = new Set(schema.required ?? []);
      const lines = ["{"];
      if (schema.additionalProperties === true) lines.push("  readonly [key: string]: unknown;");
      for (const [name, child] of entries) {
        const rendered = render(child, rootSchema, currentName, depth + 1);
        const optional = required.has(name) ? "" : "?";
        const declaration = `readonly ${propertyName(name)}${optional}: ${rendered};`;
        lines.push(indentBlock(declaration, 2));
      }
      lines.push("}");
      return lines.join("\n");
    }
    if (schema.type === "array") {
      return `ReadonlyArray<${render(schema.items ?? {}, rootSchema, currentName, depth + 1)}>`;
    }
    if (["integer", "number"].includes(schema.type)) return "number";
    if (["string", "boolean", "null"].includes(schema.type)) return schema.type;
    throw new Error("schema node cannot be rendered as a TypeScript type");
  };

  const lines = [
    "// Generated from schemas/contracts/manifest.json and the normative JSON Schemas.",
    "// Do not edit by hand; run npm run generate:contract-types.",
    ""
  ];
  for (const entry of manifest.typeExports) {
    const root = registry.get(entry.schemaId);
    const resolved = resolveSchemaReference(entry.pointer, root, registry);
    lines.push(`export type ${entry.name} = ${render(resolved.schema, resolved.rootSchema, entry.name)};`, "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function checkSortedUnique(items, key, filePath, basePointer, findings) {
  if (!Array.isArray(items)) return;
  const seen = new Set();
  let previous;
  for (let index = 0; index < items.length; index += 1) {
    const value = items[index]?.[key];
    if (typeof value !== "string") continue;
    const pointer = `${basePointer}/${index}/${key}`;
    if (previous !== undefined && compareText(previous, value) >= 0) {
      findings.push(finding(filePath, "unsorted-or-duplicate-contract-id", pointer));
    }
    if (seen.has(value)) findings.push(finding(filePath, "duplicate-contract-id", pointer));
    seen.add(value);
    previous = value;
  }
}

function checkUniqueKeys(items, key, filePath, basePointer, findings) {
  if (!Array.isArray(items)) return;
  const seen = new Set();
  for (let index = 0; index < items.length; index += 1) {
    const value = items[index]?.[key];
    if (typeof value !== "string") continue;
    if (seen.has(value)) findings.push(finding(filePath, "duplicate-contract-id", `${basePointer}/${index}/${key}`));
    seen.add(value);
  }
}

function checkSortedStrings(items, filePath, basePointer, findings) {
  if (!Array.isArray(items)) return;
  let previous;
  for (let index = 0; index < items.length; index += 1) {
    const value = items[index];
    if (typeof value === "string" && previous !== undefined && compareText(previous, value) >= 0) {
      findings.push(finding(filePath, "unsorted-or-duplicate-contract-value", `${basePointer}/${index}`));
    }
    previous = value;
  }
}

function checkUniqueValues(items, key, filePath, basePointer, findings, ruleId = "duplicate-source-id") {
  if (!Array.isArray(items)) return;
  const seen = new Set();
  for (let index = 0; index < items.length; index += 1) {
    const value = items[index]?.[key];
    if (value === undefined) continue;
    if (seen.has(value)) findings.push(finding(filePath, ruleId, `${basePointer}/${index}/${key}`));
    seen.add(value);
  }
}

function equalJson(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => equalJson(value, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left).sort(compareText);
    const rightKeys = Object.keys(right).sort(compareText);
    return leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) => key === rightKeys[index] && equalJson(left[key], right[key]));
  }
  return false;
}

function beginsInside(candidate, root) {
  return candidate === root || candidate.startsWith(`${root}/`);
}

function addMismatch(findings, filePath, pointer) {
  findings.push(finding(filePath, "cross-contract-reference-mismatch", pointer));
}

function validateSemantics(bundle, fixturePaths, findings) {
  const config = bundle.fixtures["project-config"];
  const profile = bundle.fixtures["template-profile"];
  const index = bundle.fixtures["template-index"];
  const registry = bundle.fixtures["capability-registry"];
  const overlay = bundle.fixtures["project-overlay"];
  const deck = bundle.fixtures["deck-spec"];
  const artifact = bundle.fixtures["build-artifact"];
  const candidate = bundle.fixtures["candidate-build-record"];
  const qa = bundle.fixtures["qa-report"];
  if (![config, profile, index, registry, overlay, deck, artifact, candidate, qa]
    .every(isPlainObject)) return;

  const pathFor = (type) => fixturePaths.get(type) ?? MANIFEST_PATH;
  const same = (actual, expected, type, pointer) => {
    if (!equalJson(actual, expected)) addMismatch(findings, pathFor(type), pointer);
  };

  try {
    const replayed = resolveSlideLayoutIr(candidate.slide.layoutIr);
    if (!equalJson(replayed, candidate.slide.composedSlidePlan) ||
        candidate.slide.slideId !== replayed.slideId) {
      findings.push(finding(
        pathFor("candidate-build-record"),
        "candidate-build-record-replay-mismatch",
        "/slide/composedSlidePlan"
      ));
    }
  } catch {
    findings.push(finding(
      pathFor("candidate-build-record"),
      "candidate-build-record-replay-mismatch",
      "/slide/layoutIr"
    ));
  }
  const candidateProfiles = {
    "native-card-arrow-assembled-pptx": [
      "target-specific-native-card-arrow-output",
      "native-card-arrow",
      "native-card-arrow-insertion"
    ],
    "native-omml-formula-assembled-pptx": [
      "target-specific-native-omml-formula-output",
      "native-omml-formula",
      "native-omml-formula-replacement"
    ]
  };
  const expectedCandidateProfile = candidateProfiles[candidate.sourceArtifactType];
  if (expectedCandidateProfile === undefined ||
      candidate.sourceVerificationProfile !== expectedCandidateProfile[0] ||
      candidate.slide.capabilityEvidence.evidenceType !== expectedCandidateProfile[1] ||
      candidate.slide.diff.allowedChanges[0].reason !== expectedCandidateProfile[2] ||
      candidate.slide.diff.allowedChanges[0].partPath !== candidate.slide.slidePart ||
      candidate.slide.diff.modifiedParts[0] !== candidate.slide.slidePart) {
    findings.push(finding(
      pathFor("candidate-build-record"),
      "candidate-build-record-source-mismatch",
      "/sourceArtifactType"
    ));
  }

  same(config.template.profileId, profile.templateProfileId, "project-config", "/template/profileId");
  same(config.template.indexId, index.templateIndexId, "project-config", "/template/indexId");
  same(config.template.profilePath, pathFor("template-profile"), "project-config", "/template/profilePath");
  same(config.template.indexPath, pathFor("template-index"), "project-config", "/template/indexPath");
  same(config.capabilityRegistry.registryId, registry.capabilityRegistryId,
    "project-config", "/capabilityRegistry/registryId");
  same(config.capabilityRegistry.registryVersion, registry.registryVersion,
    "project-config", "/capabilityRegistry/registryVersion");
  same(config.capabilityRegistry.path, pathFor("capability-registry"),
    "project-config", "/capabilityRegistry/path");
  same(config.projectOverlay.overlayId, overlay.projectOverlayId, "project-config", "/projectOverlay/overlayId");
  same(config.projectOverlay.path, pathFor("project-overlay"), "project-config", "/projectOverlay/path");
  const sourceExtension = config.template.sourcePath.slice(config.template.sourcePath.lastIndexOf(".") + 1);
  if (sourceExtension !== profile.templateFormat || sourceExtension !== index.templateFormat) {
    addMismatch(findings, pathFor("project-config"), "/template/sourcePath");
  }

  const roots = [config.paths.assetRoot, config.paths.stagingRoot, config.paths.outputRoot];
  if (new Set(roots).size !== roots.length || roots.some((left, i) =>
    roots.some((right, j) => i !== j && beginsInside(left, right)))) {
    findings.push(finding(pathFor("project-config"), "overlapping-project-roots", "/paths"));
  }
  if (beginsInside(config.template.sourcePath, config.paths.stagingRoot) ||
      beginsInside(config.template.sourcePath, config.paths.outputRoot)) {
    findings.push(finding(pathFor("project-config"), "template-path-is-write-target", "/template/sourcePath"));
  }

  for (const [field, expected] of [
    ["templateProfileId", profile.templateProfileId],
    ["templateIndexId", profile.templateIndexId],
    ["templateFormat", profile.templateFormat],
    ["templateSha256", profile.templateSha256],
    ["slideSizeEmu", profile.slideSizeEmu]
  ]) same(index[field], expected, "template-index", `/${field}`);

  checkSortedStrings(index.observedFeatureIds, pathFor("template-index"), "/observedFeatureIds", findings);
  checkUniqueKeys(index.masters, "masterKey", pathFor("template-index"), "/masters", findings);
  checkUniqueKeys(index.layouts, "layoutKey", pathFor("template-index"), "/layouts", findings);
  checkUniqueKeys(index.slides, "slideKey", pathFor("template-index"), "/slides", findings);
  checkUniqueValues(index.masters, "sourceId", pathFor("template-index"), "/masters", findings);
  checkUniqueValues(index.layouts, "sourceId", pathFor("template-index"), "/layouts", findings);
  checkUniqueValues(index.slides, "sourceId", pathFor("template-index"), "/slides", findings);
  checkSortedUnique(profile.layoutBindings, "layoutKey", pathFor("template-profile"), "/layoutBindings", findings);
  checkUniqueValues(profile.layoutBindings, "semanticRole", pathFor("template-profile"),
    "/layoutBindings", findings, "duplicate-semantic-layout-role");
  const masters = new Map((index.masters ?? []).map((item) => [item.masterKey, item]));
  const layouts = new Map((index.layouts ?? []).map((item) => [item.layoutKey, item]));
  const slides = new Map((index.slides ?? []).map((item) => [item.slideKey, item]));
  const partPaths = new Map([[index.presentationPart, "/presentationPart"]]);
  for (const [collectionName, entries] of [["masters", index.masters], ["layouts", index.layouts], ["slides", index.slides]]) {
    for (let entryIndex = 0; entryIndex < (entries ?? []).length; entryIndex += 1) {
      const partPath = entries[entryIndex].partPath;
      const pointer = `/${collectionName}/${entryIndex}/partPath`;
      if (partPaths.has(partPath)) {
        findings.push(finding(pathFor("template-index"), "duplicate-template-part-path", pointer));
      } else {
        partPaths.set(partPath, pointer);
      }
    }
  }
  for (let itemIndex = 0; itemIndex < (index.layouts ?? []).length; itemIndex += 1) {
    const item = index.layouts[itemIndex];
    if (!masters.has(item.masterKey)) addMismatch(findings, pathFor("template-index"), `/layouts/${itemIndex}/masterKey`);
    checkUniqueKeys(item.shapes, "shapeKey", pathFor("template-index"), `/layouts/${itemIndex}/shapes`, findings);
    checkUniqueValues(item.shapes, "sourceId", pathFor("template-index"), `/layouts/${itemIndex}/shapes`, findings);
  }
  for (let itemIndex = 0; itemIndex < (index.slides ?? []).length; itemIndex += 1) {
    const item = index.slides[itemIndex];
    if (!layouts.has(item.layoutKey)) addMismatch(findings, pathFor("template-index"), `/slides/${itemIndex}/layoutKey`);
    checkUniqueKeys(item.shapes, "shapeKey", pathFor("template-index"), `/slides/${itemIndex}/shapes`, findings);
    checkUniqueValues(item.shapes, "sourceId", pathFor("template-index"), `/slides/${itemIndex}/shapes`, findings);
  }
  for (let itemIndex = 0; itemIndex < (profile.layoutBindings ?? []).length; itemIndex += 1) {
    if (!layouts.has(profile.layoutBindings[itemIndex].layoutKey)) {
      addMismatch(findings, pathFor("template-profile"), `/layoutBindings/${itemIndex}/layoutKey`);
    }
  }
  for (const [containerName, containers] of [["layouts", index.layouts], ["slides", index.slides]]) {
    for (let containerIndex = 0; containerIndex < (containers ?? []).length; containerIndex += 1) {
      for (let shapeIndex = 0; shapeIndex < (containers[containerIndex].shapes ?? []).length; shapeIndex += 1) {
        const shape = containers[containerIndex].shapes[shapeIndex];
        if ((shape.kind === "placeholder") !== isPlainObject(shape.placeholder)) {
          findings.push(finding(pathFor("template-index"), "invalid-placeholder-metadata",
            `/${containerName}/${containerIndex}/shapes/${shapeIndex}`));
        }
      }
    }
  }

  const supportRows = new Map();
  for (const [dimension, items] of Object.entries(bundle.supportMatrix?.dimensions ?? {})) {
    for (const item of items ?? []) supportRows.set(item.id, { dimension, item });
  }
  for (let featureIndex = 0; featureIndex < (index.observedFeatureIds ?? []).length; featureIndex += 1) {
    const row = supportRows.get(index.observedFeatureIds[featureIndex]);
    if (row?.dimension !== "ooxmlFeatures") {
      findings.push(finding(pathFor("template-index"), "unknown-support-matrix-reference",
        `/observedFeatureIds/${featureIndex}`));
    }
  }

  checkSortedUnique(registry.capabilities, "capabilityId", pathFor("capability-registry"), "/capabilities", findings);
  const capabilities = new Map((registry.capabilities ?? []).map((item) => [item.capabilityId, item]));
  for (let capabilityIndex = 0; capabilityIndex < (registry.capabilities ?? []).length; capabilityIndex += 1) {
    const capability = registry.capabilities[capabilityIndex];
    checkSortedStrings(capability.requiredBindingRoles, pathFor("capability-registry"),
      `/capabilities/${capabilityIndex}/requiredBindingRoles`, findings);
    checkSortedStrings(capability.conformanceFixtureIds, pathFor("capability-registry"),
      `/capabilities/${capabilityIndex}/conformanceFixtureIds`, findings);
    const row = supportRows.get(capability.supportMatrixItemId);
    if (row?.dimension !== "capabilities") {
      findings.push(finding(pathFor("capability-registry"), "unknown-support-matrix-reference",
        `/capabilities/${capabilityIndex}/supportMatrixItemId`));
    }
  }

  for (const [field, expected] of [
    ["projectId", config.projectId],
    ["templateProfileId", profile.templateProfileId],
    ["templateIndexId", index.templateIndexId],
    ["templateSha256", profile.templateSha256],
    ["capabilityRegistryId", registry.capabilityRegistryId],
    ["registryVersion", registry.registryVersion]
  ]) same(overlay[field], expected, "project-overlay", `/${field}`);

  checkSortedUnique(overlay.capabilitySelections, "capabilitySelectionId", pathFor("project-overlay"),
    "/capabilitySelections", findings);
  checkSortedUnique(overlay.shapeBindings, "shapeBindingId", pathFor("project-overlay"),
    "/shapeBindings", findings);
  const bindings = new Map((overlay.shapeBindings ?? []).map((item) => [item.shapeBindingId, item]));
  const selections = new Map((overlay.capabilitySelections ?? []).map((item) => [item.capabilitySelectionId, item]));
  const referencedBindings = new Set();
  for (let selectionIndex = 0; selectionIndex < (overlay.capabilitySelections ?? []).length; selectionIndex += 1) {
    const selection = overlay.capabilitySelections[selectionIndex];
    const capability = capabilities.get(selection.capabilityId);
    if (!capability || capability.capabilityVersion !== selection.capabilityVersion) {
      addMismatch(findings, pathFor("project-overlay"), `/capabilitySelections/${selectionIndex}/capabilityId`);
      continue;
    }
    checkSortedUnique(selection.bindings, "role", pathFor("project-overlay"),
      `/capabilitySelections/${selectionIndex}/bindings`, findings);
    const roles = selection.bindings.map((item) => item.role);
    if (!equalJson(roles, capability.requiredBindingRoles)) {
      findings.push(finding(pathFor("project-overlay"), "capability-binding-role-mismatch",
        `/capabilitySelections/${selectionIndex}/bindings`));
    }
    const selectionBindings = new Set();
    for (let assignmentIndex = 0; assignmentIndex < selection.bindings.length; assignmentIndex += 1) {
      const bindingId = selection.bindings[assignmentIndex].shapeBindingId;
      if (!bindings.has(bindingId)) {
        addMismatch(findings, pathFor("project-overlay"),
          `/capabilitySelections/${selectionIndex}/bindings/${assignmentIndex}/shapeBindingId`);
      }
      if (selectionBindings.has(bindingId)) {
        findings.push(finding(pathFor("project-overlay"), "ambiguous-shape-binding",
          `/capabilitySelections/${selectionIndex}/bindings/${assignmentIndex}/shapeBindingId`));
      }
      selectionBindings.add(bindingId);
      referencedBindings.add(bindingId);
    }
  }
  const bindingTargets = new Set();
  for (let bindingIndex = 0; bindingIndex < (overlay.shapeBindings ?? []).length; bindingIndex += 1) {
    const binding = overlay.shapeBindings[bindingIndex];
    if (!referencedBindings.has(binding.shapeBindingId)) {
      findings.push(finding(pathFor("project-overlay"), "unused-shape-binding", `/shapeBindings/${bindingIndex}`));
    }
    const container = binding.containerKind === "layout"
      ? layouts.get(binding.containerKey)
      : slides.get(binding.containerKey);
    const shape = container?.shapes?.find((candidate) => candidate.shapeKey === binding.shapeKey);
    if (!shape || shape.kind !== binding.expectedKind) {
      addMismatch(findings, pathFor("project-overlay"), `/shapeBindings/${bindingIndex}/shapeKey`);
    }
    const targetKey = `${binding.containerKind}\0${binding.containerKey}\0${binding.shapeKey}`;
    if (bindingTargets.has(targetKey)) {
      findings.push(finding(pathFor("project-overlay"), "ambiguous-shape-binding",
        `/shapeBindings/${bindingIndex}/shapeKey`));
    }
    bindingTargets.add(targetKey);
  }

  for (const [field, expected] of [
    ["projectId", config.projectId],
    ["templateProfileId", profile.templateProfileId],
    ["projectOverlayId", overlay.projectOverlayId]
  ]) same(deck[field], expected, "deck-spec", `/${field}`);
  checkUniqueKeys(deck.slides, "slideId", pathFor("deck-spec"), "/slides", findings);
  for (let slideIndex = 0; slideIndex < (deck.slides ?? []).length; slideIndex += 1) {
    if (!selections.has(deck.slides[slideIndex].capabilitySelectionId)) {
      addMismatch(findings, pathFor("deck-spec"), `/slides/${slideIndex}/capabilitySelectionId`);
    }
  }

  for (const [field, expected] of [
    ["projectId", config.projectId],
    ["deckId", deck.deckId],
    ["templateProfileId", profile.templateProfileId],
    ["templateIndexId", index.templateIndexId],
    ["capabilityRegistryId", registry.capabilityRegistryId],
    ["registryVersion", registry.registryVersion],
    ["projectOverlayId", overlay.projectOverlayId],
    ["templateSha256", profile.templateSha256]
  ]) same(artifact[field], expected, "build-artifact", `/${field}`);
  checkUniqueKeys(artifact.slides, "slideId", pathFor("build-artifact"), "/slides", findings);
  checkSortedStrings(artifact.changedParts, pathFor("build-artifact"), "/changedParts", findings);
  if ((artifact.slides ?? []).length !== (deck.slides ?? []).length) {
    addMismatch(findings, pathFor("build-artifact"), "/slides");
  }
  for (let slideIndex = 0; slideIndex < (deck.slides ?? []).length; slideIndex += 1) {
    const slide = deck.slides[slideIndex];
    const selection = selections.get(slide.capabilitySelectionId);
    const result = artifact.slides?.[slideIndex];
    if (!selection || !result || result.slideId !== slide.slideId ||
        result.capabilityId !== selection.capabilityId ||
        result.capabilityVersion !== selection.capabilityVersion) {
      addMismatch(findings, pathFor("build-artifact"), `/slides/${slideIndex}`);
    }
  }
  if (!beginsInside(artifact.output.publishPath, config.paths.outputRoot)) {
    findings.push(finding(pathFor("build-artifact"), "output-outside-configured-root", "/output/publishPath"));
  }
  if (artifact.output.publishPath === config.template.sourcePath ||
      beginsInside(artifact.output.publishPath, config.paths.stagingRoot)) {
    findings.push(finding(pathFor("build-artifact"), "invalid-publication-target", "/output/publishPath"));
  }

  for (const [field, expected] of [
    ["qaReportId", artifact.qaReportId],
    ["buildId", artifact.buildId],
    ["projectId", config.projectId],
    ["deckId", deck.deckId],
    ["templateProfileId", profile.templateProfileId],
    ["templateIndexId", index.templateIndexId],
    ["capabilityRegistryId", registry.capabilityRegistryId],
    ["registryVersion", registry.registryVersion],
    ["projectOverlayId", overlay.projectOverlayId],
    ["templateSha256", profile.templateSha256]
  ]) same(qa[field], expected, "qa-report", `/${field}`);
  checkSortedUnique(qa.checks, "checkId", pathFor("qa-report"), "/checks", findings);
  checkSortedUnique(qa.manualGates, "manualGateId", pathFor("qa-report"), "/manualGates", findings);
  checkSortedUnique(qa.diagnostics, "diagnosticId", pathFor("qa-report"), "/diagnostics", findings);
  const gates = new Map((qa.manualGates ?? []).map((item) => [item.manualGateId, item]));
  const diagnostics = new Map((qa.diagnostics ?? []).map((item) => [item.diagnosticId, item]));
  const requiredQaContracts = new Set();
  const slideQaContracts = new Map();
  for (const slide of deck.slides ?? []) {
    const selection = selections.get(slide.capabilitySelectionId);
    const capability = selection && capabilities.get(selection.capabilityId);
    if (capability) {
      requiredQaContracts.add(capability.qaContractId);
      slideQaContracts.set(slide.slideId, capability.qaContractId);
    }
  }
  const globallyCheckedQaContracts = new Set();
  const checkedSlideIds = new Set();
  const usedGates = new Set();
  const usedDiagnostics = new Set();
  const slideScopeIds = new Set((deck.slides ?? []).map((slide) => slide.slideId));
  const validScope = (scopeKind, scopeId) =>
    (scopeKind === "build" && scopeId === artifact.buildId) ||
    (scopeKind === "deck" && scopeId === deck.deckId) ||
    (scopeKind === "slide" && slideScopeIds.has(scopeId));
  for (let checkIndex = 0; checkIndex < (qa.checks ?? []).length; checkIndex += 1) {
    const check = qa.checks[checkIndex];
    if (!validScope(check.scopeKind, check.scopeId)) {
      findings.push(finding(pathFor("qa-report"), "invalid-qa-scope", `/checks/${checkIndex}/scopeId`));
    }
    if (!requiredQaContracts.has(check.qaContractId)) {
      addMismatch(findings, pathFor("qa-report"), `/checks/${checkIndex}/qaContractId`);
    } else if (["build", "deck"].includes(check.scopeKind)) {
      globallyCheckedQaContracts.add(check.qaContractId);
    } else if (slideQaContracts.get(check.scopeId) === check.qaContractId) {
      checkedSlideIds.add(check.scopeId);
    }
    if (check.scopeKind === "slide" && slideQaContracts.get(check.scopeId) !== check.qaContractId) {
      findings.push(finding(pathFor("qa-report"), "qa-scope-mismatch", `/checks/${checkIndex}/qaContractId`));
    }
    if (["manual", "unavailable"].includes(check.outcome) && check.manualGateIds.length === 0) {
      findings.push(finding(pathFor("qa-report"), "missing-manual-gate-reference",
        `/checks/${checkIndex}/manualGateIds`));
    }
    checkSortedStrings(check.manualGateIds, pathFor("qa-report"), `/checks/${checkIndex}/manualGateIds`, findings);
    checkSortedStrings(check.diagnosticIds, pathFor("qa-report"), `/checks/${checkIndex}/diagnosticIds`, findings);
    for (let gateIndex = 0; gateIndex < check.manualGateIds.length; gateIndex += 1) {
      const gateId = check.manualGateIds[gateIndex];
      const gate = gates.get(gateId);
      if (!gate) {
        addMismatch(findings, pathFor("qa-report"), `/checks/${checkIndex}/manualGateIds/${gateIndex}`);
      } else if (gate.scopeKind !== check.scopeKind || gate.scopeId !== check.scopeId) {
        findings.push(finding(pathFor("qa-report"), "qa-scope-mismatch",
          `/checks/${checkIndex}/manualGateIds/${gateIndex}`));
      }
      usedGates.add(gateId);
    }
    for (let diagnosticIndex = 0; diagnosticIndex < check.diagnosticIds.length; diagnosticIndex += 1) {
      const diagnosticId = check.diagnosticIds[diagnosticIndex];
      const diagnostic = diagnostics.get(diagnosticId);
      if (!diagnostic) {
        addMismatch(findings, pathFor("qa-report"), `/checks/${checkIndex}/diagnosticIds/${diagnosticIndex}`);
      } else if (diagnostic.scopeKind !== check.scopeKind || diagnostic.scopeId !== check.scopeId) {
        findings.push(finding(pathFor("qa-report"), "qa-scope-mismatch",
          `/checks/${checkIndex}/diagnosticIds/${diagnosticIndex}`));
      } else if (diagnostic.severity === "error" && check.outcome !== "fail") {
        findings.push(finding(pathFor("qa-report"), "diagnostic-outcome-mismatch",
          `/checks/${checkIndex}/diagnosticIds/${diagnosticIndex}`));
      }
      usedDiagnostics.add(diagnosticId);
    }
  }
  if ([...slideQaContracts].some(([slideId, qaContractId]) =>
    !globallyCheckedQaContracts.has(qaContractId) && !checkedSlideIds.has(slideId))) {
    findings.push(finding(pathFor("qa-report"), "missing-qa-contract-coverage", "/checks"));
  }
  for (let gateIndex = 0; gateIndex < (qa.manualGates ?? []).length; gateIndex += 1) {
    const gate = qa.manualGates[gateIndex];
    if (!usedGates.has(gate.manualGateId)) {
      findings.push(finding(pathFor("qa-report"), "unused-manual-gate", `/manualGates/${gateIndex}`));
    }
    if (!validScope(gate.scopeKind, gate.scopeId)) {
      findings.push(finding(pathFor("qa-report"), "invalid-qa-scope", `/manualGates/${gateIndex}/scopeId`));
    }
    const supportRow = supportRows.get(gate.supportMatrixItemId);
    if (!supportRow) {
      findings.push(finding(pathFor("qa-report"), "unknown-support-matrix-reference",
        `/manualGates/${gateIndex}/supportMatrixItemId`));
    } else if (supportRow.item.status !== "manual" || supportRow.item.disposition !== "report-manual-gate") {
      findings.push(finding(pathFor("qa-report"), "invalid-manual-gate-support-reference",
        `/manualGates/${gateIndex}/supportMatrixItemId`));
    }
  }
  for (let diagnosticIndex = 0; diagnosticIndex < (qa.diagnostics ?? []).length; diagnosticIndex += 1) {
    if (!validScope(qa.diagnostics[diagnosticIndex].scopeKind, qa.diagnostics[diagnosticIndex].scopeId)) {
      findings.push(finding(pathFor("qa-report"), "invalid-qa-scope", `/diagnostics/${diagnosticIndex}/scopeId`));
    }
    if (!usedDiagnostics.has(qa.diagnostics[diagnosticIndex].diagnosticId)) {
      findings.push(finding(pathFor("qa-report"), "unused-diagnostic", `/diagnostics/${diagnosticIndex}`));
    }
  }
  const hasFailure = (qa.checks ?? []).some((check) => check.outcome === "fail") ||
    (qa.diagnostics ?? []).some((diagnostic) => diagnostic.severity === "error") ||
    (qa.manualGates ?? []).some((gate) => gate.status === "failed");
  const hasBlocker = (qa.checks ?? []).some((check) => ["manual", "unavailable"].includes(check.outcome)) ||
    (qa.manualGates ?? []).some((gate) => ["unresolved", "unavailable"].includes(gate.status));
  const expectedDecision = hasFailure ? "fail" : hasBlocker ? "blocked" : "pass";
  if (qa.decision !== expectedDecision) {
    findings.push(finding(pathFor("qa-report"), "invalid-qa-aggregation", "/decision"));
  }
  if (qa.decision !== "pass" || expectedDecision !== "pass") {
    findings.push(finding(pathFor("build-artifact"), "unpublishable-build-artifact", "/qaReportId"));
  }
}

export function validateContractSet(bundle) {
  const findings = [];
  const manifest = bundle.manifest;
  if (!exactKeys(manifest, [
    "schemaVersion", "contractVersion", "metaSchema", "fixturePurpose", "typeOutput", "schemas", "fixtures", "typeExports"
  ]) || manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION || manifest.contractVersion !== CONTRACT_VERSION ||
      manifest.metaSchema !== EXPECTED_META_SCHEMA || manifest.fixturePurpose !== "schema-conformance-only" ||
      manifest.typeOutput !== TYPE_OUTPUT_PATH) {
    return [finding(MANIFEST_PATH, "invalid-contract-manifest")];
  }

  const schemaEntries = Array.isArray(manifest.schemas) ? manifest.schemas : [];
  const fixtureEntries = Array.isArray(manifest.fixtures) ? manifest.fixtures : [];
  const typeExports = Array.isArray(manifest.typeExports) ? manifest.typeExports : [];
  checkSortedUnique(schemaEntries, "id", MANIFEST_PATH, "/schemas", findings);
  checkSortedUnique(fixtureEntries, "contractType", MANIFEST_PATH, "/fixtures", findings);
  checkSortedUnique(typeExports, "name", MANIFEST_PATH, "/typeExports", findings);
  if (!equalJson(schemaEntries.map((entry) => entry.id), REQUIRED_SCHEMA_IDS)) {
    findings.push(finding(MANIFEST_PATH, "incomplete-contract-schema-set", "/schemas"));
  }
  if (!equalJson(fixtureEntries.map((entry) => entry.contractType), REQUIRED_CONTRACT_TYPES)) {
    findings.push(finding(MANIFEST_PATH, "incomplete-contract-fixture-set", "/fixtures"));
  }
  if (!equalJson(typeExports.map((entry) => [entry.name, entry.schemaId, entry.pointer]), REQUIRED_TYPE_EXPORTS)) {
    findings.push(finding(MANIFEST_PATH, "incomplete-contract-type-export-set", "/typeExports"));
  }
  const declaredPaths = new Set([MANIFEST_PATH, manifest.typeOutput]);
  for (const [collection, prefix, suffix] of [
    [schemaEntries, "schemas/contracts/", ".schema.json"],
    [fixtureEntries, "fixtures/contracts/valid/", ".json"]
  ]) {
    for (const entry of collection) {
      if (!canonicalPath(entry.path) || !entry.path.startsWith(prefix) || !entry.path.endsWith(suffix)) {
        findings.push(finding(MANIFEST_PATH, "invalid-contract-control-path", "/"));
      }
      if (declaredPaths.has(entry.path)) findings.push(finding(MANIFEST_PATH, "duplicate-contract-control-path", "/"));
      declaredPaths.add(entry.path);
    }
  }
  if (bundle.admittedPaths instanceof Set) {
    for (const declaredPath of declaredPaths) {
      if (!bundle.admittedPaths.has(declaredPath)) {
        findings.push(finding(MANIFEST_PATH, "missing-contract-control-file", "/"));
      }
    }
    for (const admittedPath of bundle.admittedPaths) {
      const inContractTree = admittedPath.startsWith("schemas/contracts/") ||
        admittedPath.startsWith("fixtures/contracts/valid/") || admittedPath === TYPE_OUTPUT_PATH;
      if (inContractTree && !declaredPaths.has(admittedPath)) {
        findings.push(finding(admittedPath, "unlisted-contract-control-file"));
      }
    }
  }

  let registry;
  let schemaConfigurationValid = true;
  try {
    registry = createSchemaRegistry(Object.values(bundle.schemas ?? {}));
  } catch {
    findings.push(finding(MANIFEST_PATH, "invalid-contract-schema-registry", "/schemas"));
    schemaConfigurationValid = false;
  }
  if (registry) {
    for (let index = 0; index < schemaEntries.length; index += 1) {
      const entry = schemaEntries[index];
      const schema = bundle.schemas?.[entry.id];
      if (!schema || schema.$id !== entry.id) {
        findings.push(finding(entry.path, "contract-schema-id-mismatch"));
        schemaConfigurationValid = false;
        continue;
      }
      try {
        assertSupportedSchema(schema, { expectedId: entry.id, registry });
      } catch {
        findings.push(finding(entry.path, "unsupported-contract-schema"));
        schemaConfigurationValid = false;
      }
      if (entry.id !== "urn:pptx-compiler:schema:shared:0.1.0" &&
          (schema.additionalProperties !== false || schema.properties?.schemaVersion?.$ref === undefined ||
           schema.properties?.contractType?.const === undefined)) {
        findings.push(finding(entry.path, "unclosed-contract-root"));
      }
    }
  }

  const fixturePaths = new Map();
  let fixtureSchemasValid = registry !== undefined && schemaConfigurationValid;
  if (registry && schemaConfigurationValid) {
    for (const entry of fixtureEntries) {
      fixturePaths.set(entry.contractType, entry.path);
      const fixture = bundle.fixtures?.[entry.contractType];
      const schema = registry.get(entry.schemaId);
      if (!fixture || !schema || fixture.contractType !== entry.contractType) {
        findings.push(finding(entry.path, "contract-fixture-identity-mismatch"));
        fixtureSchemasValid = false;
        continue;
      }
      for (const error of validateJson(fixture, schema, { rootSchema: schema, registry })) {
        findings.push(finding(entry.path, "contract-schema-validation", error.pointer || "/"));
        fixtureSchemasValid = false;
      }
    }
  }

  if (registry && schemaConfigurationValid) {
    try {
      const generated = generateContractTypes(manifest, bundle.schemas);
      if (bundle.typeSource !== generated) findings.push(finding(manifest.typeOutput, "generated-contract-types-drift"));
    } catch {
      findings.push(finding(MANIFEST_PATH, "contract-type-generation-failed", "/typeExports"));
    }
  }
  if (fixtureSchemasValid) validateSemantics(bundle, fixturePaths, findings);
  return sortFindings(findings);
}

function report(mode, findings) {
  const sorted = sortFindings(findings);
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    gate: "contracts",
    mode,
    ok: sorted.length === 0,
    findings: sorted
  };
}

export async function runContractGate({ repositoryRoot, mode }) {
  try {
    const bundle = await loadContractSet(repositoryRoot, mode);
    return report(mode, validateContractSet(bundle));
  } catch {
    return report(mode, [finding(MANIFEST_PATH, "contract-gate-configuration")]);
  }
}

async function generateTypes(repositoryRoot) {
  const bundle = await loadContractSet(repositoryRoot, "working-tree", { allowMissingType: true });
  const generated = generateContractTypes(bundle.manifest, bundle.schemas);
  const target = path.resolve(repositoryRoot, ...TYPE_OUTPUT_PATH.split("/"));
  if (!isContained(repositoryRoot, target)) throw new Error("type output escapes the repository");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, generated, "utf8");
}

function parseArguments(argv) {
  const options = { mode: "index", repositoryRoot: process.cwd(), writeTypes: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--write-types") {
      options.writeTypes = true;
    } else if (["--mode", "--root"].includes(argument)) {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === "--mode") options.mode = value;
      if (argument === "--root") options.repositoryRoot = path.resolve(value);
    } else {
      throw new Error(`unknown argument ${argument}`);
    }
  }
  if (!new Set(["index", "working-tree"]).has(options.mode)) throw new Error("unsupported mode");
  if (options.writeTypes && options.mode !== "index") throw new Error("--write-types does not accept --mode");
  return options;
}

const isMain = process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.writeTypes) {
      await generateTypes(options.repositoryRoot);
      process.stdout.write(`${TYPE_OUTPUT_PATH}\n`);
    } else {
      const result = await runContractGate(options);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (!result.ok) process.exitCode = 1;
    }
  } catch {
    process.stdout.write(`${JSON.stringify(report("configuration-error", [
      finding(MANIFEST_PATH, "contract-gate-configuration")
    ]))}\n`);
    process.exitCode = 1;
  }
}
