import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { deflateRawSync } from "node:zlib";

import {
  CapabilityRuntimeError,
  createCapabilityRuntime,
  executeCapabilityDispatch
} from "../packages/core/src/capability-dispatcher.mjs";
import {
  prepareResolvedDeckDispatch,
  ProjectDispatchResolutionError
} from "../packages/core/src/project-dispatch-resolver.mjs";
import {
  convertLatexToOmml,
  createPandocOmmlAdapter,
  extractCanonicalOmmlFromPandocDocx,
  isCanonicalPandocOmmlFragment,
  isSupportedLatexMathExpression,
  PandocOmmlAdapterError
} from "../packages/adapter-pandoc-omml/src/pandoc-omml-adapter.mjs";
import {
  createFormulaTransplantExecutor,
  formulaTransplantQaAssertions,
  preflightFormulaTransplant
} from "../packages/adapter-pandoc-omml/src/formula-transplant.mjs";
import {
  createPandocProcessRunner,
  PANDOC_PROCESS_RUNNER_VERSION
} from "../packages/adapter-pandoc-omml/src/node-process-runner.mjs";
import {
  assertSupportedSchema,
  createSchemaRegistry,
  validateJson
} from "../scripts/lib/json-schema.mjs";

const MATH_NAMESPACE =
  "http://schemas.openxmlformats.org/officeDocument/2006/math";
const WORD_NAMESPACE =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const CONTENT_TYPES_NAMESPACE =
  "http://schemas.openxmlformats.org/package/2006/content-types";
const RELATIONSHIPS_NAMESPACE =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_DOCUMENT_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";
const DOCX_MAIN_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const VERSION_ARGUMENTS = ["--version"];
const API_ARGUMENTS = [
  "--sandbox",
  "--from=markdown",
  "--to=json",
  "--output=-",
  "--fail-if-warnings",
  "+RTS",
  "-M128m",
  "-K16m",
  "-RTS"
];
const DOCX_ARGUMENTS = [
  "--sandbox",
  "--from=json",
  "--to=docx",
  "--output=-",
  "--fail-if-warnings",
  "+RTS",
  "-M128m",
  "-K16m",
  "-RTS"
];

const readJson = async (relativePath) => JSON.parse(await readFile(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8"
));

const contractManifest = await readJson("schemas/contracts/manifest.json");
const contractSchemas = await Promise.all(
  contractManifest.schemas.map(({ path: schemaPath }) => readJson(schemaPath))
);
const contractSchemaRegistry = createSchemaRegistry(contractSchemas);
for (const schema of contractSchemas) {
  assertSupportedSchema(schema, { registry: contractSchemaRegistry });
}

const registry = await readJson("fixtures/capabilities/formula-transplant/registry.json");
const projectOverlay = await readJson(
  "fixtures/capabilities/formula-transplant/project-overlay.json"
);
const deckSpec = await readJson("fixtures/capabilities/formula-transplant/deck-spec.json");
const cases = await readJson("fixtures/capabilities/formula-transplant/cases.json");
const templateIndex = await readJson("fixtures/inspection/expected-potx-template-index.json");
const inputSchema = await readJson("packages/adapter-pandoc-omml/schemas/input.schema.json");
const outputSchema = await readJson("packages/adapter-pandoc-omml/schemas/output.schema.json");
const supportMatrix = await readJson("policy/support-matrix.json");

const adapterSource = await readFile(
  new URL("../packages/adapter-pandoc-omml/src/pandoc-omml-adapter.mjs", import.meta.url),
  "utf8"
);
const formulaSource = await readFile(
  new URL("../packages/adapter-pandoc-omml/src/formula-transplant.mjs", import.meta.url),
  "utf8"
);
const runnerSource = await readFile(
  new URL("../packages/adapter-pandoc-omml/src/node-process-runner.mjs", import.meta.url),
  "utf8"
);
const dispatcherSource = await readFile(
  new URL("../packages/core/src/capability-dispatcher.mjs", import.meta.url),
  "utf8"
);
const resolverSource = await readFile(
  new URL("../packages/core/src/project-dispatch-resolver.mjs", import.meta.url),
  "utf8"
);

assertSupportedSchema(inputSchema);
assertSupportedSchema(outputSchema);

const definition = registry.capabilities[0];
const capabilityRow = supportMatrix.dimensions.capabilities.find(
  (item) => item.id === definition.supportMatrixItemId
);
const schemasByType = new Map([
  ["capability-registry", contractSchemaRegistry.get(
    "urn:pptx-pipeline:schema:capability-registry:0.1.0"
  )],
  ["project-overlay", contractSchemaRegistry.get(
    "urn:pptx-pipeline:schema:project-overlay:0.1.0"
  )],
  ["template-index", contractSchemaRegistry.get(
    "urn:pptx-pipeline:schema:template-index:0.1.0"
  )],
  ["deck-spec", contractSchemaRegistry.get(
    "urn:pptx-pipeline:schema:deck-spec:0.1.0"
  )]
]);

function clone(value) {
  return structuredClone(value);
}

function validateContract(type, value) {
  const schema = schemasByType.get(type);
  return validateJson(value, schema, {
    rootSchema: schema,
    registry: contractSchemaRegistry
  }).length === 0;
}

function validateSchemaDocument(value) {
  try {
    assertSupportedSchema(value);
    return true;
  } catch {
    return false;
  }
}

function validateInput(value) {
  return validateJson(value, inputSchema).length === 0;
}

function validateOutput(value) {
  return validateJson(value, outputSchema).length === 0;
}

function resolverDependencies() {
  return {
    validateCapabilityRegistry: (value) => validateContract("capability-registry", value),
    validateDeckSpec: (value) => validateContract("deck-spec", value),
    validateProjectOverlay: (value) => validateContract("project-overlay", value),
    validateTemplateIndex: (value) => validateContract("template-index", value)
  };
}

function normativeDecision() {
  return {
    supportMatrixItemId: definition.supportMatrixItemId,
    supportClaimsEnabled: supportMatrix.supportClaimsEnabled,
    status: capabilityRow.status,
    disposition: capabilityRow.disposition
  };
}

function experimentalDecision() {
  return {
    supportMatrixItemId: definition.supportMatrixItemId,
    supportClaimsEnabled: false,
    status: "experimental",
    disposition: "accept-with-warning"
  };
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ ((value & 1) === 1 ? 0xedb88320 : 0);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function createZip(entries, { method = 0 } = {}) {
  const localRecords = [];
  const centralRecords = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, "utf8");
    const bytes = Buffer.from(entry.bytes);
    const entryMethod = entry.method ?? method;
    const compressed = entryMethod === 8
      ? deflateRawSync(bytes, { level: 9 })
      : Buffer.from(bytes);
    const checksum = entry.checksum ?? crc32(bytes);
    const flags = entry.flags ?? 0x0800;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(entryMethod, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x5c21, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localRecords.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(entryMethod, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x5c21, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralRecords.push(central, name);
    localOffset += local.length + name.length + compressed.length;
  }
  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localRecords, centralDirectory, end]);
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function fractionOmml(numerator, denominator) {
  return `<m:oMath><m:f><m:fPr><m:type m:val="bar"/></m:fPr>` +
    `<m:num><m:r><m:t>${escapeXml(numerator)}</m:t></m:r></m:num>` +
    `<m:den><m:r><m:t>${escapeXml(denominator)}</m:t></m:r></m:den>` +
    `</m:f></m:oMath>`;
}

function superscriptOmml(base, exponent) {
  return `<m:oMath><m:sSup><m:sSupPr/><m:e><m:r><m:t>${escapeXml(base)}</m:t>` +
    `</m:r></m:e><m:sup><m:r><m:t>${escapeXml(exponent)}</m:t></m:r></m:sup>` +
    `</m:sSup></m:oMath>`;
}

function contentTypesXml(overrides = {}) {
  const mainType = overrides.mainType ?? DOCX_MAIN_CONTENT_TYPE;
  return `<Types xmlns="${CONTENT_TYPES_NAMESPACE}">` +
    `<Default Extension="rels" ` +
    `ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="${mainType}"/>` +
    `</Types>`;
}

function rootRelationshipsXml(overrides = {}) {
  const target = overrides.target ?? "word/document.xml";
  const type = overrides.type ?? OFFICE_DOCUMENT_RELATIONSHIP;
  const extraAttribute = overrides.extraAttribute ?? "";
  return `<Relationships xmlns="${RELATIONSHIPS_NAMESPACE}">` +
    `<Relationship Id="rId1" Type="${type}" Target="${target}"${extraAttribute}/>` +
    `</Relationships>`;
}

function documentXml(omml, overrides = {}) {
  const wordPrefix = overrides.wordPrefix ?? "w";
  const mathPrefix = overrides.mathPrefix ?? "m";
  const convertedOmml = mathPrefix === "m" ? omml : omml.replaceAll("m:", `${mathPrefix}:`);
  const paragraphChildren = overrides.paragraphChildren ??
    `<${mathPrefix}:oMathPara>${convertedOmml}</${mathPrefix}:oMathPara>`;
  const bodyTail = overrides.bodyTail ?? `<${wordPrefix}:sectPr/>`;
  const extraNamespaces = overrides.extraNamespaces ?? "";
  return `<${wordPrefix}:document xmlns:${wordPrefix}="${WORD_NAMESPACE}" ` +
    `xmlns:${mathPrefix}="${MATH_NAMESPACE}"${extraNamespaces}>` +
    `<${wordPrefix}:body><${wordPrefix}:p>${paragraphChildren}</${wordPrefix}:p>` +
    `${bodyTail}</${wordPrefix}:body></${wordPrefix}:document>`;
}

function baseDocxEntries({
  omml = fractionOmml("a", "b"),
  document = documentXml(omml),
  contentTypes = contentTypesXml(),
  relationships = rootRelationshipsXml()
} = {}) {
  return [
    { path: "[Content_Types].xml", bytes: encoder.encode(contentTypes) },
    { path: "_rels/.rels", bytes: encoder.encode(relationships) },
    { path: "word/document.xml", bytes: encoder.encode(document) }
  ];
}

function makeDocx(options = {}) {
  return createZip(
    options.entries ?? baseDocxEntries(options),
    { method: options.method ?? 0 }
  );
}

function toBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  return encoder.encode(value);
}

function completed(stdout, { exitCode = 0, stderr = new Uint8Array(0) } = {}) {
  return {
    outcome: "completed",
    exitCode,
    signal: null,
    stdout: toBytes(stdout),
    stderr: toBytes(stderr)
  };
}

function failedOutcome(kind) {
  return {
    outcome: kind,
    exitCode: null,
    signal: null,
    stdout: new Uint8Array(0),
    stderr: new Uint8Array(0)
  };
}

function runnerFrom(run) {
  return {
    runnerVersion: PANDOC_PROCESS_RUNNER_VERSION,
    runnerType: "pandoc-process-runner",
    run
  };
}

function snapshotRequest(request) {
  return {
    arguments: [...request.arguments],
    stdin: Buffer.from(request.stdin),
    timeoutMs: request.timeoutMs,
    maxStdoutBytes: request.maxStdoutBytes,
    maxStderrBytes: request.maxStderrBytes
  };
}

function latexFromPandocAst(stdin) {
  const value = JSON.parse(decoder.decode(stdin));
  return {
    value,
    latex: value.blocks?.[0]?.c?.[0]?.c?.[1]
  };
}

function ommlForLatex(latex) {
  if (latex === "\\frac{1}{1}") return fractionOmml("1", "1");
  if (latex === "\\frac{a}{b}") return fractionOmml("a", "b");
  if (latex === "x^{2}") return superscriptOmml("x", "2");
  return `<m:oMath><m:r><m:t>${escapeXml(latex)}</m:t></m:r></m:oMath>`;
}

function makeHappyFakeRunner({
  method = 0,
  version = "pandoc 3.6.4\n",
  apiVersion = [1, 23, 1],
  override
} = {}) {
  const calls = [];
  const returnedDocx = [];
  const runner = runnerFrom(async (request) => {
    assert.ok(Object.isFrozen(request));
    assert.ok(Object.isFrozen(request.arguments));
    const captured = snapshotRequest(request);
    calls.push(captured);
    let kind;
    let latex;
    let defaultOutcome;
    if (captured.arguments.length === 1 && captured.arguments[0] === "--version") {
      kind = "version";
      defaultOutcome = completed(version);
    } else if (captured.arguments.includes("--to=json")) {
      kind = "api";
      defaultOutcome = completed(`${JSON.stringify({
        "pandoc-api-version": apiVersion,
        meta: {},
        blocks: []
      })}\n`);
    } else if (captured.arguments.includes("--to=docx")) {
      kind = "docx";
      ({ latex } = latexFromPandocAst(captured.stdin));
      const bytes = makeDocx({ omml: ommlForLatex(latex), method });
      returnedDocx.push(bytes);
      defaultOutcome = completed(bytes);
    } else {
      throw new Error("unexpected fake Pandoc request");
    }
    return override?.({
      kind,
      latex,
      callIndex: calls.length - 1,
      request: captured,
      defaultOutcome
    }) ?? defaultOutcome;
  });
  return { runner, calls, returnedDocx };
}

function expectedAst(latex) {
  return {
    "pandoc-api-version": [1, 23, 1],
    meta: {},
    blocks: [{
      t: "Para",
      c: [{ t: "Math", c: [{ t: "DisplayMath" }, latex] }]
    }]
  };
}

function assertPandocError(code, pointer) {
  return (error) => {
    assert.ok(error instanceof PandocOmmlAdapterError);
    assert.equal(error.code, code);
    if (pointer !== undefined) assert.equal(error.pointer, pointer);
    assert.deepEqual(error.toJSON(), { code, pointer: error.pointer });
    return true;
  };
}

function makeRegistration(adapter, { preflight, execute, assertions } = {}) {
  const executor = createFormulaTransplantExecutor({ adapter });
  return {
    capabilityId: definition.capabilityId,
    capabilityVersion: definition.capabilityVersion,
    executor: {
      executorId: definition.executorId,
      preflight: preflight ?? executor.preflight,
      execute: execute ?? executor.execute
    },
    inputSchema: {
      schemaId: definition.inputSchemaId,
      schema: clone(inputSchema),
      validate: validateInput
    },
    outputSchema: {
      schemaId: definition.outputSchemaId,
      schema: clone(outputSchema),
      validate: validateOutput
    },
    conformanceFixtures: clone(cases.fixtures),
    qaContract: {
      qaContractId: definition.qaContractId,
      assertions: [...(assertions ?? formulaTransplantQaAssertions)]
    }
  };
}

async function makeRuntime(adapter, {
  decision = normativeDecision(),
  registration = makeRegistration(adapter)
} = {}) {
  return createCapabilityRuntime({
    capabilityRegistry: clone(registry),
    registrations: [registration],
    dependencies: {
      validateCapabilityRegistry: (value) => validateContract("capability-registry", value),
      validateSchemaDocument,
      resolveCapabilitySupport: () => decision
    }
  });
}

function bundle(overrides = {}) {
  return {
    capabilityRegistry: clone(overrides.capabilityRegistry ?? registry),
    projectOverlay: clone(overrides.projectOverlay ?? projectOverlay),
    templateIndex: clone(overrides.templateIndex ?? templateIndex),
    deckSpec: clone(overrides.deckSpec ?? deckSpec)
  };
}

function prepare(runtime, documents) {
  return prepareResolvedDeckDispatch({
    runtime,
    capabilityRegistry: documents.capabilityRegistry,
    projectOverlay: documents.projectOverlay,
    templateIndex: documents.templateIndex,
    deckSpec: documents.deckSpec,
    dependencies: resolverDependencies()
  });
}

function deckWithSlideId(slideId) {
  const deck = clone(deckSpec);
  deck.slides[0].slideId = slideId;
  return deck;
}

function processRequest(argumentsList, overrides = {}) {
  return {
    arguments: argumentsList,
    stdin: overrides.stdin ?? new Uint8Array(0),
    timeoutMs: overrides.timeoutMs ?? 2_000,
    maxStdoutBytes: overrides.maxStdoutBytes ?? 4_096,
    maxStderrBytes: overrides.maxStderrBytes ?? 4_096
  };
}

test("formula schemas and text-only fixtures close the existing 0.1.0 contracts", () => {
  assert.equal(validateContract("capability-registry", registry), true);
  assert.equal(validateContract("project-overlay", projectOverlay), true);
  assert.equal(validateContract("template-index", templateIndex), true);
  assert.equal(validateContract("deck-spec", deckSpec), true);
  assert.equal(cases.fixtures.length, 1);
  assert.equal(validateInput(cases.fixtures[0].invocation.payload), true);
  assert.equal(validateOutput(cases.fixtures[0].expectedOutput), true);
  assert.equal(capabilityRow.status, "unsupported");
  assert.equal(capabilityRow.disposition, "unavailable");
  assert.equal(supportMatrix.supportClaimsEnabled, false);
  assert.equal(cases.fixtures[0].expectedOutput.formula.insertable, false);
  assert.equal(
    isCanonicalPandocOmmlFragment(
      cases.fixtures[0].expectedOutput.formula.unboundOmmlFragment
    ),
    true
  );
});

test("stored and deflated text-derived DOCX normalize to the same canonical OMML", () => {
  const expected = cases.fixtures[0].expectedOutput.formula.unboundOmmlFragment;
  const stored = makeDocx({ method: 0 });
  const deflated = makeDocx({ method: 8 });
  assert.equal(extractCanonicalOmmlFromPandocDocx(stored), expected);
  assert.equal(extractCanonicalOmmlFromPandocDocx(deflated), expected);

  const alternateDocument = documentXml(fractionOmml("a", "b"), {
    wordPrefix: "word",
    mathPrefix: "math"
  });
  assert.equal(
    extractCanonicalOmmlFromPandocDocx(makeDocx({ document: alternateDocument, method: 8 })),
    expected
  );
  assert.equal(isCanonicalPandocOmmlFragment(expected), true);
  assert.equal(isCanonicalPandocOmmlFragment(expected.replace("m:f", "x:f")), false);
});

test("detection and conversion use exact fixed requests and a formula-only Pandoc JSON AST", async () => {
  const fake = makeHappyFakeRunner({ method: 8 });
  const adapter = await createPandocOmmlAdapter({ runner: fake.runner });
  assert.deepEqual(adapter, {
    adapterVersion: "0.1.0",
    adapterType: "pandoc-omml-adapter",
    availability: "available",
    reason: "ready",
    pandocVersion: "3.6.4"
  });
  assert.ok(Object.isFrozen(adapter));
  assert.equal(fake.calls.length, 3);

  assert.deepEqual(fake.calls[0], {
    arguments: VERSION_ARGUMENTS,
    stdin: Buffer.alloc(0),
    timeoutMs: 2_000,
    maxStdoutBytes: 8 * 1024,
    maxStderrBytes: 16 * 1024
  });
  assert.deepEqual(fake.calls[1].arguments, API_ARGUMENTS);
  assert.equal(fake.calls[1].stdin.length, 0);
  assert.equal(fake.calls[1].timeoutMs, 5_000);
  assert.equal(fake.calls[1].maxStdoutBytes, 64 * 1024);
  assert.deepEqual(fake.calls[2].arguments, DOCX_ARGUMENTS);
  assert.deepEqual(latexFromPandocAst(fake.calls[2].stdin).value, expectedAst("\\frac{1}{1}"));

  const conversion = await convertLatexToOmml({ adapter, latex: "x^{2}" });
  assert.equal(fake.calls.length, 4);
  assert.deepEqual(fake.calls[3].arguments, DOCX_ARGUMENTS);
  assert.deepEqual(latexFromPandocAst(fake.calls[3].stdin).value, expectedAst("x^{2}"));
  for (const request of fake.calls) {
    assert.equal(request.arguments.some((argument) => argument.includes("x^{2}")), false);
    assert.equal(request.arguments.some((argument) => argument.includes("\\frac")), false);
  }
  assert.deepEqual(conversion, {
    adapterProfileVersion: "0.1.0",
    artifactKind: "unbound-omml-conformance-fragment",
    insertable: false,
    ommlFragment: `<m:oMath xmlns:m="${MATH_NAMESPACE}"><m:sSup><m:sSupPr/>` +
      `<m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t>` +
      `</m:r></m:sup></m:sSup></m:oMath>`
  });
  assert.ok(Object.isFrozen(conversion));
});

test("detection fails closed for absence, version, process, stderr, and malformed results", async (t) => {
  const casesToRun = [
    ["not found", async () => failedOutcome("not-found"), {
      availability: "unavailable", reason: "not-found", pandocVersion: null
    }],
    ["unsupported version", async () => completed("pandoc 2.14.0\n"), {
      availability: "incompatible", reason: "unsupported-version", pandocVersion: "2.14.0"
    }],
    ["timeout", async () => failedOutcome("timed-out"), {
      availability: "unavailable", reason: "version-probe-failed", pandocVersion: null
    }],
    ["nonzero exit", async () => completed("failure", { exitCode: 2 }), {
      availability: "unavailable", reason: "version-probe-failed", pandocVersion: null
    }],
    ["stderr on success", async () => completed("pandoc 3.6.4\n", { stderr: "warning" }), {
      availability: "unavailable", reason: "version-probe-failed", pandocVersion: null
    }],
    ["malformed version", async () => completed("tool 3.6.4\n"), {
      availability: "unavailable", reason: "version-output-invalid", pandocVersion: null
    }],
    ["runner rejection", async () => { throw new Error("private runner detail"); }, {
      availability: "unavailable", reason: "version-process-failed", pandocVersion: null
    }]
  ];
  for (const [name, run, expected] of casesToRun) {
    await t.test(name, async () => {
      const adapter = await createPandocOmmlAdapter({ runner: runnerFrom(run) });
      assert.equal(adapter.adapterVersion, "0.1.0");
      assert.equal(adapter.adapterType, "pandoc-omml-adapter");
      assert.deepEqual({
        availability: adapter.availability,
        reason: adapter.reason,
        pandocVersion: adapter.pandocVersion
      }, expected);
      assert.equal(JSON.stringify(adapter).includes("private runner detail"), false);
    });
  }

  await t.test("invalid UTF-8 version", async () => {
    await assert.rejects(
      createPandocOmmlAdapter({
        runner: runnerFrom(async () => completed(new Uint8Array([0xff])))
      }),
      assertPandocError("PANDOC_OMML_OUTPUT_INVALID", "/detection/version")
    );
  });

  await t.test("accessor-bearing outcome", async () => {
    const candidate = completed("pandoc 3.6.4\n");
    Object.defineProperty(candidate, "stdout", {
      enumerable: true,
      get() {
        throw new Error("must not execute");
      }
    });
    await assert.rejects(
      createPandocOmmlAdapter({ runner: runnerFrom(async () => candidate) }),
      assertPandocError("PANDOC_OMML_DEPENDENCY_INVALID", "/detection/version")
    );
  });

  await t.test("oversize outcome", async () => {
    await assert.rejects(
      createPandocOmmlAdapter({
        runner: runnerFrom(async () => completed(Buffer.alloc((8 * 1024) + 1, 65)))
      }),
      assertPandocError("PANDOC_OMML_DEPENDENCY_INVALID", "/detection/version")
    );
  });

  await t.test("malformed API JSON", async () => {
    const fake = makeHappyFakeRunner({
      override({ kind, defaultOutcome }) {
        return kind === "api" ? completed("{broken") : defaultOutcome;
      }
    });
    const adapter = await createPandocOmmlAdapter({ runner: fake.runner });
    assert.equal(adapter.availability, "unavailable");
    assert.equal(adapter.reason, "api-probe-failed");
    assert.equal(fake.calls.length, 2);
  });

  await t.test("malformed probe DOCX", async () => {
    const fake = makeHappyFakeRunner({
      override({ kind, defaultOutcome }) {
        return kind === "docx" ? completed("not-a-zip") : defaultOutcome;
      }
    });
    const adapter = await createPandocOmmlAdapter({ runner: fake.runner });
    assert.equal(adapter.availability, "unavailable");
    assert.equal(adapter.reason, "omml-probe-failed");
    assert.equal(fake.calls.length, 3);
  });
});

test("conversion maps process and output failures without leaking stderr or formula text", async (t) => {
  const scenarios = [
    ["timeout", ({ kind, callIndex, defaultOutcome }) =>
      kind === "docx" && callIndex >= 3 ? failedOutcome("timed-out") : defaultOutcome,
    "PANDOC_OMML_PROCESS_FAILED"],
    ["nonzero", ({ kind, callIndex, defaultOutcome }) =>
      kind === "docx" && callIndex >= 3 ? completed("failed", { exitCode: 7 }) : defaultOutcome,
    "PANDOC_OMML_PROCESS_FAILED"],
    ["stderr", ({ kind, callIndex, defaultOutcome }) =>
      kind === "docx" && callIndex >= 3
        ? completed("unused", { stderr: "private/path and x^{2}" })
        : defaultOutcome,
    "PANDOC_OMML_PROCESS_FAILED"],
    ["malformed DOCX", ({ kind, callIndex, defaultOutcome }) =>
      kind === "docx" && callIndex >= 3 ? completed("not-a-docx") : defaultOutcome,
    "PANDOC_OMML_OUTPUT_INVALID"]
  ];
  for (const [name, override, code] of scenarios) {
    await t.test(name, async () => {
      const fake = makeHappyFakeRunner({ override });
      const adapter = await createPandocOmmlAdapter({ runner: fake.runner });
      await assert.rejects(
        convertLatexToOmml({ adapter, latex: "x^{2}" }),
        (error) => {
          assertPandocError(code, "/conversion")(error);
          assert.equal(error.message.includes("x^{2}"), false);
          assert.equal(error.message.includes("private/path"), false);
          return true;
        }
      );
    });
  }

  await t.test("oversize runner response", async () => {
    const fake = makeHappyFakeRunner({
      override({ kind, callIndex, defaultOutcome }) {
        return kind === "docx" && callIndex >= 3
          ? completed(Buffer.alloc((1024 * 1024) + 1, 65))
          : defaultOutcome;
      }
    });
    const adapter = await createPandocOmmlAdapter({ runner: fake.runner });
    await assert.rejects(
      convertLatexToOmml({ adapter, latex: "x^{2}" }),
      assertPandocError("PANDOC_OMML_DEPENDENCY_INVALID", "/conversion")
    );
  });
});

test("LaTeX input is bounded, Unicode-safe, brace-balanced, and command-restricted", async (t) => {
  const valid = [
    "\\frac{a}{b}",
    "x^{2}",
    "α+β",
    "𝑥+1",
    "a".repeat(512),
    "😀".repeat(512)
  ];
  for (const value of valid) {
    assert.equal(isSupportedLatexMathExpression(value), true, `expected valid: ${value.slice(0, 16)}`);
  }

  const invalid = [
    "",
    "   ",
    " leading",
    "trailing ",
    "a%comment",
    "$x$",
    "a#b",
    "`command`",
    "a&b",
    "{a",
    "a}",
    `${"{".repeat(17)}a${"}".repeat(17)}`,
    "a\u0000b",
    "a\u202Eb",
    "a\uFDD0b",
    "\uD800",
    "a".repeat(513)
  ];
  const dangerousCommands = [
    "begin", "catcode", "csname", "def", "documentclass", "edef", "end",
    "futurelet", "gdef", "href", "immediate", "include", "includegraphics",
    "input", "let", "newcommand", "openin", "openout", "read", "renewcommand",
    "special", "url", "usepackage", "write", "xdef"
  ];
  invalid.push(...dangerousCommands.map((command) => `\\${command}{x}`));
  for (const value of invalid) {
    await t.test(JSON.stringify(value).slice(0, 70), () => {
      assert.equal(isSupportedLatexMathExpression(value), false);
    });
  }

  const fake = makeHappyFakeRunner();
  const adapter = await createPandocOmmlAdapter({ runner: fake.runner });
  const callsBefore = fake.calls.length;
  await assert.rejects(
    convertLatexToOmml({ adapter, latex: "\\input{secret}" }),
    assertPandocError("PANDOC_OMML_INPUT_INVALID", "/latex")
  );
  assert.equal(fake.calls.length, callsBefore);
});

test("DOCX, OPC, XML, and OMML mutations fail closed", async (t) => {
  const validOmml = fractionOmml("a", "b");
  const secondMath = `<m:oMathPara>${fractionOmml("c", "d")}</m:oMathPara>`;
  const mutations = [
    ["missing root relationship", () => makeDocx({
      entries: baseDocxEntries().filter((entry) => entry.path !== "_rels/.rels")
    })],
    ["unknown part", () => makeDocx({
      entries: [...baseDocxEntries(), { path: "word/media/image1.png", bytes: Buffer.from("x") }]
    })],
    ["macro-looking part", () => makeDocx({
      entries: [...baseDocxEntries(), { path: "word/vbaProject.bin", bytes: Buffer.from("x") }]
    })],
    ["wrong main content type", () => makeDocx({
      contentTypes: contentTypesXml({ mainType: "application/xml" })
    })],
    ["wrong default content type", () => makeDocx({
      contentTypes: contentTypesXml().replace(
        `ContentType="application/xml"`,
        `ContentType="application/custom+xml"`
      )
    })],
    ["extra default content type", () => makeDocx({
      contentTypes: contentTypesXml().replace(
        "</Types>",
        `<Default Extension="bin" ContentType="application/octet-stream"/></Types>`
      )
    })],
    ["content-type override for a missing part", () => makeDocx({
      contentTypes: contentTypesXml().replace(
        "</Types>",
        `<Override PartName="/word/styles.xml" ContentType="application/xml"/></Types>`
      )
    })],
    ["wrong ancillary content type", () => {
      const types = contentTypesXml().replace(
        "</Types>",
        `<Override PartName="/word/styles.xml" ContentType="application/xml"/></Types>`
      );
      return makeDocx({
        entries: [
          ...baseDocxEntries({ contentTypes: types }),
          { path: "word/styles.xml", bytes: encoder.encode("<x/>") }
        ]
      });
    }],
    ["external relationship", () => makeDocx({
      relationships: rootRelationshipsXml({
        target: "https://example.invalid/document.xml",
        extraAttribute: " TargetMode=\"External\""
      })
    })],
    ["wrong office-document target", () => makeDocx({
      relationships: rootRelationshipsXml({ target: "word/other.xml" })
    })],
    ["dangling internal relationship", () => makeDocx({
      relationships: rootRelationshipsXml().replace(
        "</Relationships>",
        `<Relationship Id="rId2" Type="${OFFICE_DOCUMENT_RELATIONSHIP}" ` +
          `Target="word/styles.xml"/></Relationships>`
      )
    })],
    ["percent-encoded relationship target", () => makeDocx({
      relationships: rootRelationshipsXml({ target: "word/%64ocument.xml" })
    })],
    ...[
      "oleObject",
      "package",
      "attachedTemplate",
      "hyperlink",
      "invented-relationship"
    ].map((relationshipType) => [
      `${relationshipType} relationship type`,
      () => makeDocx({
        relationships: rootRelationshipsXml().replace(
          "</Relationships>",
          `<Relationship Id="rId2" ` +
            `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/` +
            `${relationshipType}" Target="word/document.xml"/></Relationships>`
        )
      })
    ]),
    ["invented package-metadata relationship type", () => makeDocx({
      relationships: rootRelationshipsXml().replace(
        "</Relationships>",
        `<Relationship Id="rId2" ` +
          `Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/invented" ` +
          `Target="word/document.xml"/></Relationships>`
      )
    })],
    ["missing relationship part for a present ancillary part", () => {
      const stylesType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml";
      const types = contentTypesXml().replace(
        "</Types>",
        `<Override PartName="/word/styles.xml" ContentType="${stylesType}"/></Types>`
      );
      return makeDocx({
        entries: [
          ...baseDocxEntries({ contentTypes: types }),
          { path: "word/styles.xml", bytes: encoder.encode("<x/>") }
        ]
      });
    }],
    ["malformed document XML", () => makeDocx({ document: "<w:document>" })],
    ["DTD", () => makeDocx({
      document: `<!DOCTYPE x [<!ENTITY e "x">]>${documentXml(validOmml)}`
    })],
    ["two formula paragraphs", () => makeDocx({
      document: documentXml(validOmml, {
        paragraphChildren: `<m:oMathPara>${validOmml}</m:oMathPara>${secondMath}`
      })
    })],
    ["no formula", () => makeDocx({
      document: documentXml(validOmml, { paragraphChildren: "<w:r><w:t>x</w:t></w:r>" })
    })],
    ["unknown OMML element", () => makeDocx({
      omml: `<m:oMath><m:matrix><m:r><m:t>x</m:t></m:r></m:matrix></m:oMath>`
    })],
    ["allowed OMML vocabulary in an invalid structure", () => makeDocx({
      omml: `<m:oMath><m:f><m:num><m:r><m:t>a</m:t></m:r></m:num>` +
        `<m:num><m:r><m:t>b</m:t></m:r></m:num></m:f></m:oMath>`
    })],
    ["invalid fraction property value", () => makeDocx({
      omml: `<m:oMath><m:f><m:fPr><m:type m:val="linear"/></m:fPr>` +
        `<m:num><m:r><m:t>a</m:t></m:r></m:num>` +
        `<m:den><m:r><m:t>b</m:t></m:r></m:den></m:f></m:oMath>`
    })],
    ["relationship attribute inside OMML", () => makeDocx({
      document: documentXml(
        `<m:oMath><m:r r:id="rId9"><m:t>x</m:t></m:r></m:oMath>`,
        { extraNamespaces: " xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"" }
      )
    })],
    ["duplicate member", () => makeDocx({
      entries: [...baseDocxEntries(), baseDocxEntries()[2]]
    })],
    ["case-alias member", () => makeDocx({
      entries: [...baseDocxEntries(), {
        path: "WORD/DOCUMENT.XML",
        bytes: encoder.encode(documentXml(validOmml))
      }]
    })],
    ["traversal member", () => createZip([
      { path: "../escape.xml", bytes: encoder.encode("<x/>") }
    ])],
    ["CRC drift", () => createZip(baseDocxEntries().map((entry, index) =>
      index === 0 ? { ...entry, checksum: 0 } : entry))],
    ["member count", () => createZip(Array.from({ length: 33 }, (_, index) => ({
      path: `part-${index}.xml`, bytes: encoder.encode("<x/>")
    })))],
    ["compression bomb", () => createZip([
      { path: "word/document.xml", bytes: Buffer.alloc(64 * 1024, 65), method: 8 }
    ])]
  ];
  for (const [name, makeBytes] of mutations) {
    await t.test(name, () => {
      assert.throws(
        () => extractCanonicalOmmlFromPandocDocx(makeBytes()),
        (error) => error instanceof PandocOmmlAdapterError &&
          ["PANDOC_OMML_OUTPUT_INVALID", "PANDOC_OMML_RESOURCE_LIMIT"].includes(error.code)
      );
    });
  }

  await t.test("archive byte limit", () => {
    assert.throws(
      () => extractCanonicalOmmlFromPandocDocx(Buffer.alloc((1024 * 1024) + 1)),
      assertPandocError("PANDOC_OMML_RESOURCE_LIMIT", "/docx")
    );
  });
});

test("formula preflight accepts only an exact resolved text-box target", () => {
  const invocation = clone(cases.fixtures[0].invocation);
  assert.equal(preflightFormulaTransplant(invocation), true);
  for (const mutate of [
    (value) => { value.bindings[0].role = "anchor"; },
    (value) => { value.bindings[0].containerKind = "layout"; },
    (value) => { value.bindings[0].expectedKind = "picture"; },
    (value) => { value.bindings[0].cardinality = "zero-or-one"; },
    (value) => { value.bindings.push(clone(value.bindings[0])); },
    (value) => { value.payload.displayMode = "inline"; },
    (value) => { value.payload.latex = "{"; },
    (value) => { value.payload.extra = true; }
  ]) {
    const candidate = clone(invocation);
    mutate(candidate);
    assert.equal(preflightFormulaTransplant(candidate), false);
  }
});

test("normative formula dispatch remains unavailable after executable conformance", async () => {
  const fake = makeHappyFakeRunner();
  const adapter = await createPandocOmmlAdapter({ runner: fake.runner });
  const runtime = await makeRuntime(adapter);
  assert.equal(fake.calls.length, 4, "runtime admission must execute the public conformance case");
  const before = fake.calls.length;
  assert.throws(
    () => prepare(runtime, bundle()),
    (error) => error instanceof CapabilityRuntimeError &&
      error.code === "CAPABILITY_RUNTIME_CAPABILITY_UNAVAILABLE"
  );
  assert.equal(fake.calls.length, before);
});

test("temporary experimental policy exercises the real resolver and dispatcher path", async () => {
  const fake = makeHappyFakeRunner({ method: 8 });
  const adapter = await createPandocOmmlAdapter({ runner: fake.runner });
  const runtime = await makeRuntime(adapter, { decision: experimentalDecision() });
  assert.equal(fake.calls.length, 4);
  const documents = bundle();
  const plan = prepare(runtime, documents);
  documents.deckSpec.slides[0].payload.latex = "x^{2}";
  const result = await executeCapabilityDispatch({ plan });
  assert.equal(fake.calls.length, 5);
  assert.deepEqual(result.results[0].output, cases.fixtures[0].expectedOutput);
  assert.equal(result.results[0].supportStatus, "experimental");
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.results[0].output.formula));
  assert.deepEqual(
    latexFromPandocAst(fake.calls[4].stdin).value,
    expectedAst("\\frac{a}{b}")
  );
});

test("a later invalid formula preflight causes zero runner calls for the batch", async () => {
  const fake = makeHappyFakeRunner();
  const adapter = await createPandocOmmlAdapter({ runner: fake.runner });
  let preflightCalls = 0;
  const baseExecutor = createFormulaTransplantExecutor({ adapter });
  const registration = makeRegistration(adapter, {
    preflight(invocation) {
      preflightCalls += 1;
      return baseExecutor.preflight(invocation);
    }
  });
  const runtime = await makeRuntime(adapter, {
    decision: experimentalDecision(),
    registration
  });
  preflightCalls = 0;
  const deck = clone(deckSpec);
  deck.slides.push({
    slideId: "formula-output-two",
    capabilitySelectionId: deck.slides[0].capabilitySelectionId,
    payload: { displayMode: "display", latex: "{" }
  });
  const before = fake.calls.length;
  assert.throws(
    () => prepare(runtime, bundle({ deckSpec: deck })),
    (error) => error instanceof CapabilityRuntimeError &&
      error.code === "CAPABILITY_RUNTIME_PREFLIGHT_REJECTED"
  );
  assert.equal(preflightCalls, 2);
  assert.equal(fake.calls.length, before);
});

test("output-schema and QA drift are rejected after successful conversion", async (t) => {
  async function executeMutation(mutate, expectedCode) {
    const fake = makeHappyFakeRunner();
    const adapter = await createPandocOmmlAdapter({ runner: fake.runner });
    const baseExecutor = createFormulaTransplantExecutor({ adapter });
    const registration = makeRegistration(adapter, {
      async execute(invocation) {
        const output = await baseExecutor.execute(invocation);
        if (invocation.invocationId !== "formula-output-two") return output;
        const changed = clone(output);
        mutate(changed);
        return changed;
      }
    });
    const runtime = await makeRuntime(adapter, {
      decision: experimentalDecision(),
      registration
    });
    const plan = prepare(runtime, bundle({ deckSpec: deckWithSlideId("formula-output-two") }));
    await assert.rejects(
      executeCapabilityDispatch({ plan }),
      (error) => error instanceof CapabilityRuntimeError && error.code === expectedCode
    );
  }

  await t.test("output schema", () => executeMutation(
    (output) => { output.formula.insertable = true; },
    "CAPABILITY_RUNTIME_OUTPUT_INVALID"
  ));
  await t.test("QA binding", () => executeMutation(
    (output) => { output.clone.sourceSlideKey = "different-slide"; },
    "CAPABILITY_RUNTIME_QA_FAILED"
  ));
});

test("adapter results are deterministic and detached from runner-owned DOCX bytes", async () => {
  const fake = makeHappyFakeRunner({ method: 8 });
  const adapter = await createPandocOmmlAdapter({ runner: fake.runner });
  const first = await convertLatexToOmml({ adapter, latex: "\\frac{a}{b}" });
  const returned = fake.returnedDocx.at(-1);
  returned.fill(0);
  const second = await convertLatexToOmml({ adapter, latex: "\\frac{a}{b}" });
  assert.deepEqual(first, second);
  assert.equal(first.ommlFragment, cases.fixtures[0].expectedOutput.formula.unboundOmmlFragment);
  assert.ok(Object.isFrozen(first));
});

test("Node process runner handles missing executables, literal argv, timeout, and stream caps", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pandoc-runner-test-"));
  try {
    await t.test("missing executable", async () => {
      const runner = createPandocProcessRunner({
        executable: path.join(root, "definitely-missing-pandoc"),
        workingDirectory: root,
        environment: {}
      });
      const result = await runner.run(processRequest([]));
      assert.equal(result.outcome, "not-found");
      assert.equal(result.exitCode, null);
      assert.equal(result.stdout.byteLength, 0);
      assert.equal(result.stderr.byteLength, 0);
    });

    await t.test("literal no-shell arguments", async () => {
      const marker = "literal;$(echo-not-run)&`still-literal`";
      const runner = createPandocProcessRunner({
        executable: process.execPath,
        workingDirectory: root,
        environment: {}
      });
      const result = await runner.run(processRequest([
        "-e",
        "process.stdout.write(JSON.stringify(process.argv.slice(1)))",
        marker
      ]));
      assert.equal(result.outcome, "completed");
      assert.equal(result.exitCode, 0);
      assert.deepEqual(JSON.parse(decoder.decode(result.stdout)), [marker]);
      assert.equal(result.stderr.byteLength, 0);
    });

    await t.test("timeout", async () => {
      const runner = createPandocProcessRunner({
        executable: process.execPath,
        workingDirectory: root,
        environment: {}
      });
      const result = await runner.run(processRequest(
        ["-e", "setInterval(() => {}, 1000)"],
        { timeoutMs: 100 }
      ));
      assert.equal(result.outcome, "timed-out");
    });

    for (const stream of ["stdout", "stderr"]) {
      await t.test(`${stream} cap`, async () => {
        const runner = createPandocProcessRunner({
          executable: process.execPath,
          workingDirectory: root,
          environment: {}
        });
        const code = `process.${stream}.write("x".repeat(65))`;
        const result = await runner.run(processRequest(
          ["-e", code],
          stream === "stdout"
            ? { maxStdoutBytes: 64 }
            : { maxStderrBytes: 64 }
        ));
        assert.equal(result.outcome, "output-limit");
        assert.equal(result.stdout.byteLength, 0);
        assert.equal(result.stderr.byteLength, 0);
      });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("adapter dependency direction, no-I/O split, fixture neutrality, and clean closure hold", {
  concurrency: false
}, async () => {
  for (const source of [adapterSource, formulaSource]) {
    for (const forbidden of [
      "node:child_process",
      "node:fs",
      "node:http",
      "node:https",
      "process.env",
      "process.cwd",
      "fetch(",
      "import(",
      "require(",
      "eval(",
      "Function("
    ]) {
      assert.equal(source.includes(forbidden), false, `pure adapter source contains ${forbidden}`);
    }
  }
  assert.match(runnerSource, /from "node:child_process"/u);
  assert.match(runnerSource, /shell: false/u);
  assert.doesNotMatch(runnerSource, /\bexec(?:File)?\s*\(/u);
  assert.doesNotMatch(runnerSource, /\bshell:\s*true\b/u);
  assert.doesNotMatch(dispatcherSource, /adapter-pandoc-omml|formula-transplant/u);
  assert.doesNotMatch(resolverSource, /adapter-pandoc-omml|formula-transplant/u);
  for (const fixtureSpecific of ["formula-transplant-fraction", "shape-2", "formula-output-one"]) {
    assert.equal(adapterSource.includes(fixtureSpecific), false);
    assert.equal(formulaSource.includes(fixtureSpecific), false);
  }

  const root = await mkdtemp(path.join(os.tmpdir(), "pandoc-omml-closure-"));
  try {
    const coreDirectory = path.join(root, "packages", "core", "src");
    const adapterDirectory = path.join(root, "packages", "adapter-pandoc-omml", "src");
    await mkdir(coreDirectory, { recursive: true });
    await mkdir(adapterDirectory, { recursive: true });
    await Promise.all([
      copyFile(
        new URL("../packages/core/src/secure-zip.mjs", import.meta.url),
        path.join(coreDirectory, "secure-zip.mjs")
      ),
      copyFile(
        new URL("../packages/core/src/strict-xml.mjs", import.meta.url),
        path.join(coreDirectory, "strict-xml.mjs")
      ),
      copyFile(
        new URL("../packages/adapter-pandoc-omml/src/pandoc-omml-adapter.mjs", import.meta.url),
        path.join(adapterDirectory, "pandoc-omml-adapter.mjs")
      ),
      copyFile(
        new URL("../packages/adapter-pandoc-omml/src/formula-transplant.mjs", import.meta.url),
        path.join(adapterDirectory, "formula-transplant.mjs")
      ),
      copyFile(
        new URL("../packages/adapter-pandoc-omml/src/node-process-runner.mjs", import.meta.url),
        path.join(adapterDirectory, "node-process-runner.mjs")
      )
    ]);
    const previous = process.cwd();
    try {
      process.chdir(os.tmpdir());
      const importedAdapter = await import(`${pathToFileURL(
        path.join(adapterDirectory, "pandoc-omml-adapter.mjs")
      ).href}?closure=1`);
      const importedFormula = await import(`${pathToFileURL(
        path.join(adapterDirectory, "formula-transplant.mjs")
      ).href}?closure=1`);
      const importedRunner = await import(`${pathToFileURL(
        path.join(adapterDirectory, "node-process-runner.mjs")
      ).href}?closure=1`);
      const fake = makeHappyFakeRunner();
      const adapter = await importedAdapter.createPandocOmmlAdapter({ runner: fake.runner });
      assert.equal(adapter.availability, "available");
      assert.equal(typeof importedFormula.createFormulaTransplantExecutor, "function");
      assert.equal(typeof importedRunner.createPandocProcessRunner, "function");
    } finally {
      process.chdir(previous);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
