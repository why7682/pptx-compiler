import { parseSecureZip, SECURE_ZIP_LIMITS } from "../../core/src/secure-zip.mjs";
import { parseStrictXml } from "../../core/src/strict-xml.mjs";

export const PANDOC_OMML_ADAPTER_VERSION = "0.1.0";

const PANDOC_PROCESS_RUNNER_VERSION = "0.1.0";
const MATH_NAMESPACE =
  "http://schemas.openxmlformats.org/officeDocument/2006/math";
const WORDPROCESSINGML_NAMESPACE =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const CONTENT_TYPES_NAMESPACE =
  "http://schemas.openxmlformats.org/package/2006/content-types";
const PACKAGE_RELATIONSHIPS_NAMESPACE =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_DOCUMENT_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";
const RELATIONSHIP_NAMESPACE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const DRAWINGML_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/main";
const DRAWINGML_PICTURE_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/picture";
const WORDPROCESSING_DRAWING_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const OFFICE_NAMESPACE = "urn:schemas-microsoft-com:office:office";
const VML_NAMESPACE = "urn:schemas-microsoft-com:vml";
const WORD_10_NAMESPACE = "urn:schemas-microsoft-com:office:word";
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
const DOCX_MAIN_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";

const VERSION_TIMEOUT_MS = 2_000;
const PROBE_TIMEOUT_MS = 5_000;
const CONVERSION_TIMEOUT_MS = 5_000;
const VERSION_STDOUT_BYTES = 8 * 1024;
const PROBE_JSON_BYTES = 64 * 1024;
const STDERR_BYTES = 16 * 1024;
const MAX_LATEX_CODE_POINTS = 512;
const MAX_LATEX_BYTES = 2 * 1024;
const MAX_OMML_ELEMENTS = 256;
const MAX_OMML_ATTRIBUTES = 128;
const MAX_OMML_TEXT_BYTES = 4 * 1024;
const MAX_OMML_FRAGMENT_CODE_UNITS = 16 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const ADAPTER_STATE = new WeakMap();

const PANDOC_VERSION_ARGUMENTS = Object.freeze(["--version"]);
const PANDOC_API_ARGUMENTS = Object.freeze([
  "--sandbox",
  "--from=markdown",
  "--to=json",
  "--output=-",
  "--fail-if-warnings",
  "+RTS",
  "-M128m",
  "-K16m",
  "-RTS"
]);
const PANDOC_DOCX_ARGUMENTS = Object.freeze([
  "--sandbox",
  "--from=json",
  "--to=docx",
  "--output=-",
  "--fail-if-warnings",
  "+RTS",
  "-M128m",
  "-K16m",
  "-RTS"
]);

const ALLOWED_DOCX_PARTS = new Set([
  "[Content_Types].xml",
  "_rels/.rels",
  "docProps/app.xml",
  "docProps/core.xml",
  "docProps/custom.xml",
  "word/_rels/document.xml.rels",
  "word/_rels/footnotes.xml.rels",
  "word/comments.xml",
  "word/document.xml",
  "word/fontTable.xml",
  "word/footnotes.xml",
  "word/numbering.xml",
  "word/settings.xml",
  "word/styles.xml",
  "word/theme/theme1.xml",
  "word/webSettings.xml"
]);

const OFFICE_RELATIONSHIP_PREFIX =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
const PACKAGE_METADATA_RELATIONSHIP_PREFIX =
  "http://schemas.openxmlformats.org/package/2006/relationships/metadata/";

const EXPECTED_DEFAULT_CONTENT_TYPES = new Map([
  ["rels", "application/vnd.openxmlformats-package.relationships+xml"],
  ["xml", "application/xml"]
]);

const EXPECTED_OVERRIDE_CONTENT_TYPES = new Map([
  ["docProps/app.xml", "application/vnd.openxmlformats-officedocument.extended-properties+xml"],
  ["docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml"],
  ["docProps/custom.xml", "application/vnd.openxmlformats-officedocument.custom-properties+xml"],
  ["word/comments.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"],
  ["word/document.xml", DOCX_MAIN_CONTENT_TYPE],
  ["word/fontTable.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"],
  ["word/footnotes.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"],
  ["word/numbering.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"],
  ["word/settings.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"],
  ["word/styles.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"],
  ["word/theme/theme1.xml", "application/vnd.openxmlformats-officedocument.theme+xml"],
  ["word/webSettings.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml"]
]);

const EXPECTED_RELATIONSHIPS = new Map([
  ["_rels/.rels", new Map([
    [`${OFFICE_RELATIONSHIP_PREFIX}officeDocument`, "word/document.xml"],
    [`${OFFICE_RELATIONSHIP_PREFIX}extended-properties`, "docProps/app.xml"],
    [`${PACKAGE_METADATA_RELATIONSHIP_PREFIX}core-properties`, "docProps/core.xml"],
    [`${OFFICE_RELATIONSHIP_PREFIX}custom-properties`, "docProps/custom.xml"]
  ])],
  ["word/_rels/document.xml.rels", new Map([
    [`${OFFICE_RELATIONSHIP_PREFIX}numbering`, "numbering.xml"],
    [`${OFFICE_RELATIONSHIP_PREFIX}styles`, "styles.xml"],
    [`${OFFICE_RELATIONSHIP_PREFIX}settings`, "settings.xml"],
    [`${OFFICE_RELATIONSHIP_PREFIX}webSettings`, "webSettings.xml"],
    [`${OFFICE_RELATIONSHIP_PREFIX}fontTable`, "fontTable.xml"],
    [`${OFFICE_RELATIONSHIP_PREFIX}theme`, "theme/theme1.xml"],
    [`${OFFICE_RELATIONSHIP_PREFIX}footnotes`, "footnotes.xml"],
    [`${OFFICE_RELATIONSHIP_PREFIX}comments`, "comments.xml"]
  ])],
  ["word/_rels/footnotes.xml.rels", new Map()]
]);

const ALLOWED_DOCUMENT_NAMESPACES = new Set([
  XML_NAMESPACE,
  MATH_NAMESPACE,
  WORDPROCESSINGML_NAMESPACE,
  RELATIONSHIP_NAMESPACE,
  DRAWINGML_NAMESPACE,
  DRAWINGML_PICTURE_NAMESPACE,
  WORDPROCESSING_DRAWING_NAMESPACE,
  OFFICE_NAMESPACE,
  VML_NAMESPACE,
  WORD_10_NAMESPACE
]);

const ALLOWED_OMML_ELEMENTS = new Set([
  "oMath",
  "r",
  "t",
  "f",
  "fPr",
  "type",
  "num",
  "den",
  "sSup",
  "sSupPr",
  "e",
  "sup",
  "sSub",
  "sSubPr",
  "sub",
  "sSubSup",
  "sSubSupPr",
  "rad",
  "radPr",
  "degHide",
  "deg"
]);

const OMML_EXPRESSION_ELEMENTS = new Set([
  "r",
  "f",
  "sSup",
  "sSub",
  "sSubSup",
  "rad"
]);

const FORBIDDEN_LATEX_COMMAND = /\\(?:begin|catcode|csname|def|documentclass|edef|end|futurelet|gdef|href|immediate|include|includegraphics|input|let|newcommand|openin|openout|read|renewcommand|special|url|usepackage|write|xdef)(?![A-Za-z])/u;

const PROBE_LATEX = "\\frac{1}{1}";
const PROBE_OMML = `<m:oMath xmlns:m="${MATH_NAMESPACE}"><m:f><m:fPr>` +
  `<m:type m:val="bar"/></m:fPr><m:num><m:r><m:t>1</m:t></m:r></m:num>` +
  `<m:den><m:r><m:t>1</m:t></m:r></m:den></m:f></m:oMath>`;

const ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "PANDOC_OMML_ARGUMENT_INVALID",
  DEPENDENCY_INVALID: "PANDOC_OMML_DEPENDENCY_INVALID",
  INPUT_INVALID: "PANDOC_OMML_INPUT_INVALID",
  OUTPUT_INVALID: "PANDOC_OMML_OUTPUT_INVALID",
  PROCESS_FAILED: "PANDOC_OMML_PROCESS_FAILED",
  RESOURCE_LIMIT: "PANDOC_OMML_RESOURCE_LIMIT",
  UNAVAILABLE: "PANDOC_OMML_UNAVAILABLE"
});

export class PandocOmmlAdapterError extends Error {
  constructor(code, pointer = "") {
    super(pointer.length === 0 ? code : `${code} at ${pointer}`);
    this.name = "PandocOmmlAdapterError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer = "") {
  throw new PandocOmmlAdapterError(code, pointer);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactDataProperties(value, keys) {
  if (!isPlainRecord(value)) return false;
  const allowed = new Set(keys);
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && ownKeys.every((key) => {
    if (typeof key !== "string" || !allowed.has(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
  });
}

function dataProperty(value, key) {
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function isSafeUnicode(value) {
  if (typeof value !== "string" || value.length === 0 || !/\S/u.test(value) ||
      value !== value.trim() || /\p{Cf}/u.test(value)) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const first = value.charCodeAt(index);
    let codePoint = first;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || second < 0xdc00 || second > 0xdfff) return false;
      codePoint = ((first - 0xd800) * 0x400) + second - 0xdc00 + 0x10000;
      index += 1;
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      return false;
    }
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f) ||
        codePoint === 0x2028 || codePoint === 0x2029 ||
        (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
        (codePoint & 0xfffe) === 0xfffe) {
      return false;
    }
  }
  return true;
}

export function isSupportedLatexMathExpression(value) {
  if (typeof value !== "string" || value.length > MAX_LATEX_BYTES ||
      !isSafeUnicode(value) || /[%$#`&]/u.test(value) ||
      FORBIDDEN_LATEX_COMMAND.test(value)) {
    return false;
  }
  let codePoints = 0;
  let braceDepth = 0;
  for (const character of value) {
    codePoints += 1;
    if (codePoints > MAX_LATEX_CODE_POINTS) return false;
    if (character === "{") {
      braceDepth += 1;
      if (braceDepth > 16) return false;
    } else if (character === "}") {
      braceDepth -= 1;
      if (braceDepth < 0) return false;
    }
  }
  return braceDepth === 0 && encoder.encode(value).byteLength <= MAX_LATEX_BYTES;
}

function makeRequest(argumentsList, stdin, timeoutMs, maxStdoutBytes) {
  return Object.freeze({
    arguments: Object.freeze([...argumentsList]),
    stdin: new Uint8Array(stdin),
    timeoutMs,
    maxStdoutBytes,
    maxStderrBytes: STDERR_BYTES
  });
}

function captureRunner(candidate) {
  if (!hasExactDataProperties(candidate, ["runnerVersion", "runnerType", "run"]) ||
      dataProperty(candidate, "runnerVersion") !== PANDOC_PROCESS_RUNNER_VERSION ||
      dataProperty(candidate, "runnerType") !== "pandoc-process-runner" ||
      typeof dataProperty(candidate, "run") !== "function") {
    fail(ERROR_CODES.DEPENDENCY_INVALID, "/runner");
  }
  return dataProperty(candidate, "run");
}

function captureOutcome(candidate, request, pointer) {
  if (!hasExactDataProperties(candidate, [
    "outcome",
    "exitCode",
    "signal",
    "stdout",
    "stderr"
  ])) {
    fail(ERROR_CODES.DEPENDENCY_INVALID, pointer);
  }
  const kind = dataProperty(candidate, "outcome");
  const exitCode = dataProperty(candidate, "exitCode");
  const signal = dataProperty(candidate, "signal");
  const stdout = dataProperty(candidate, "stdout");
  const stderr = dataProperty(candidate, "stderr");
  if (!["completed", "not-found", "output-limit", "signaled", "spawn-failed", "timed-out"].includes(kind) ||
      !(exitCode === null || (Number.isSafeInteger(exitCode) && exitCode >= 0 && exitCode <= 255)) ||
      !(signal === null || (typeof signal === "string" && /^[A-Z0-9]+$/u.test(signal))) ||
      !(stdout instanceof Uint8Array) || !(stderr instanceof Uint8Array) ||
      stdout.byteLength > request.maxStdoutBytes || stderr.byteLength > request.maxStderrBytes ||
      (kind === "completed" && (exitCode === null || signal !== null)) ||
      (kind !== "completed" && (exitCode !== null || stdout.byteLength !== 0 || stderr.byteLength !== 0))) {
    fail(ERROR_CODES.DEPENDENCY_INVALID, pointer);
  }
  return Object.freeze({
    outcome: kind,
    exitCode,
    signal,
    stdout: Buffer.from(stdout),
    stderr: Buffer.from(stderr)
  });
}

async function invoke(run, request, pointer) {
  let candidate;
  try {
    candidate = await run(request);
  } catch {
    return { kind: "process-failed" };
  }
  return { kind: "result", result: captureOutcome(candidate, request, pointer) };
}

function decodeUtf8(bytes, pointer) {
  try {
    return decoder.decode(bytes);
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, pointer);
  }
}

function parsePandocVersion(bytes) {
  const text = decodeUtf8(bytes, "/detection/version");
  if (text.length > VERSION_STDOUT_BYTES || /\u001b/u.test(text)) return null;
  const firstLine = text.split(/\r?\n/u, 1)[0];
  const match = /^pandoc ([0-9]+(?:\.[0-9]+){1,3})$/u.exec(firstLine);
  if (!match) return null;
  const pieces = match[1].split(".").map((part) => Number.parseInt(part, 10));
  if (pieces.some((part) => !Number.isSafeInteger(part) || part > 1_000_000)) return null;
  while (pieces.length < 3) pieces.push(0);
  return Object.freeze({ text: match[1], pieces: Object.freeze(pieces) });
}

function isCompatiblePandocVersion(version) {
  const [major, minor] = version.pieces;
  return (major === 2 && minor >= 15) || major === 3;
}

function parsePandocApiVersion(bytes) {
  let value;
  try {
    value = JSON.parse(decodeUtf8(bytes, "/detection/api"));
  } catch {
    return null;
  }
  if (!isPlainRecord(value) || !Array.isArray(value["pandoc-api-version"]) ||
      !isPlainRecord(value.meta) || !Array.isArray(value.blocks)) {
    return null;
  }
  const version = value["pandoc-api-version"];
  if (version.length < 2 || version.length > 4 ||
      version.some((part) => !Number.isSafeInteger(part) || part < 0 || part > 1_000_000)) {
    return null;
  }
  return Object.freeze([...version]);
}

function makePandocMathAst(apiVersion, latex) {
  return encoder.encode(`${JSON.stringify({
    "pandoc-api-version": [...apiVersion],
    meta: {},
    blocks: [{
      t: "Para",
      c: [{ t: "Math", c: [{ t: "DisplayMath" }, latex] }]
    }]
  })}\n`);
}

function nodeIs(node, namespaceURI, localName) {
  return node?.namespaceURI === namespaceURI && node?.localName === localName;
}

function collectNodes(root) {
  const nodes = [];
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    nodes.push(node);
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push(node.children[index]);
    }
  }
  return nodes;
}

function attribute(node, namespaceURI, localName) {
  return node.attributes.get(`${namespaceURI}\u0000${localName}`)?.value;
}

function assertOnlyAttributes(node, allowed) {
  const expected = new Set(allowed.map(([namespaceURI, localName]) =>
    `${namespaceURI}\u0000${localName}`));
  return [...node.attributes.keys()].every((key) => expected.has(key));
}

function parsePart(parts, partPath, pointer) {
  const bytes = parts.get(partPath);
  if (!(bytes instanceof Uint8Array)) fail(ERROR_CODES.OUTPUT_INVALID, pointer);
  try {
    return parseStrictXml(bytes);
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, pointer);
  }
}

function validateContentTypes(parts) {
  const parsed = parsePart(parts, "[Content_Types].xml", "/docx/contentTypes");
  if (!nodeIs(parsed.root, CONTENT_TYPES_NAMESPACE, "Types") ||
      parsed.root.attributes.size !== 0 || parsed.root.text !== "") {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx/contentTypes");
  }
  const defaultExtensions = new Set();
  const overrideParts = new Set();
  for (const child of parsed.root.children) {
    if (child.text !== "" || child.children.length !== 0) {
      fail(ERROR_CODES.OUTPUT_INVALID, "/docx/contentTypes");
    }
    if (nodeIs(child, CONTENT_TYPES_NAMESPACE, "Default")) {
      if (child.attributes.size !== 2 ||
          !assertOnlyAttributes(child, [["", "Extension"], ["", "ContentType"]])) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/contentTypes");
      }
      const extension = attribute(child, "", "Extension");
      const contentType = attribute(child, "", "ContentType");
      if (typeof extension !== "string" || defaultExtensions.has(extension) ||
          EXPECTED_DEFAULT_CONTENT_TYPES.get(extension) !== contentType) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/contentTypes");
      }
      defaultExtensions.add(extension);
    } else if (nodeIs(child, CONTENT_TYPES_NAMESPACE, "Override")) {
      if (child.attributes.size !== 2 ||
          !assertOnlyAttributes(child, [["", "PartName"], ["", "ContentType"]])) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/contentTypes");
      }
      const partName = attribute(child, "", "PartName");
      const partPath = typeof partName === "string" && partName.startsWith("/")
        ? partName.slice(1)
        : "";
      const contentType = attribute(child, "", "ContentType");
      if (!ALLOWED_DOCX_PARTS.has(partPath) || !parts.has(partPath) ||
          overrideParts.has(partPath) ||
          EXPECTED_OVERRIDE_CONTENT_TYPES.get(partPath) !== contentType) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/contentTypes");
      }
      overrideParts.add(partPath);
    } else {
      fail(ERROR_CODES.OUTPUT_INVALID, "/docx/contentTypes");
    }
  }
  if (defaultExtensions.size !== EXPECTED_DEFAULT_CONTENT_TYPES.size ||
      [...EXPECTED_DEFAULT_CONTENT_TYPES.keys()].some((extension) =>
        !defaultExtensions.has(extension)) ||
      [...EXPECTED_OVERRIDE_CONTENT_TYPES.keys()].some((partPath) =>
        parts.has(partPath) !== overrideParts.has(partPath))) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx/contentTypes");
  }
}

function isSafeRelationshipTarget(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 512 ||
      value.startsWith("/") || value.includes("\\") || value.includes(":") ||
      value.includes("?") || value.includes("#") || value.includes("%")) {
    return false;
  }
  const segments = value.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function relationshipSourcePart(partPath) {
  if (partPath === "_rels/.rels") return "";
  const match = /^(.*\/)_rels\/([^/]+)\.rels$/u.exec(partPath);
  return match ? `${match[1]}${match[2]}` : null;
}

function expectedRelationshipsForPart(parts, partPath, sourceDirectory) {
  const profile = EXPECTED_RELATIONSHIPS.get(partPath);
  if (!profile) fail(ERROR_CODES.OUTPUT_INVALID, "/docx/relationships");
  return new Map([...profile].filter(([, target]) =>
    parts.has(`${sourceDirectory}${target}`)));
}

function validateRelationshipsPart(parts, partPath) {
  const parsed = parsePart(parts, partPath, `/docx/relationships/${partPath}`);
  if (!nodeIs(parsed.root, PACKAGE_RELATIONSHIPS_NAMESPACE, "Relationships") ||
      parsed.root.attributes.size !== 0 || parsed.root.text !== "") {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx/relationships");
  }
  const sourcePart = relationshipSourcePart(partPath);
  if (sourcePart === null || (sourcePart !== "" && !parts.has(sourcePart))) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx/relationships");
  }
  const sourceDirectory = sourcePart.includes("/")
    ? sourcePart.slice(0, sourcePart.lastIndexOf("/") + 1)
    : "";
  const expected = expectedRelationshipsForPart(parts, partPath, sourceDirectory);
  const ids = new Set();
  const types = new Set();
  for (const child of parsed.root.children) {
    if (!nodeIs(child, PACKAGE_RELATIONSHIPS_NAMESPACE, "Relationship") ||
        child.children.length !== 0 || child.text !== "" || child.attributes.size !== 3 ||
        !assertOnlyAttributes(child, [["", "Id"], ["", "Type"], ["", "Target"]])) {
      fail(ERROR_CODES.OUTPUT_INVALID, "/docx/relationships");
    }
    const id = attribute(child, "", "Id");
    const type = attribute(child, "", "Type");
    const target = attribute(child, "", "Target");
    if (typeof id !== "string" || !/^rId[1-9][0-9]*$/u.test(id) || ids.has(id) ||
        typeof type !== "string" || types.has(type) || expected.get(type) !== target ||
        !isSafeRelationshipTarget(target) ||
        !parts.has(`${sourceDirectory}${target}`)) {
      fail(ERROR_CODES.OUTPUT_INVALID, "/docx/relationships");
    }
    ids.add(id);
    types.add(type);
  }
  if (types.size !== expected.size || [...expected.keys()].some((type) => !types.has(type))) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx/relationships");
  }
}

function validateDocumentWrapper(parsed) {
  if (!nodeIs(parsed.root, WORDPROCESSINGML_NAMESPACE, "document") ||
      parsed.root.attributes.size !== 0 || parsed.root.text !== "" ||
      parsed.root.children.length !== 1 ||
      [...parsed.namespaceUris].some((uri) => !ALLOWED_DOCUMENT_NAMESPACES.has(uri))) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document");
  }
  const body = parsed.root.children[0];
  if (!nodeIs(body, WORDPROCESSINGML_NAMESPACE, "body") ||
      body.attributes.size !== 0 || body.text !== "" ||
      body.children.length < 1 || body.children.length > 2) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/body");
  }
  const paragraph = body.children[0];
  if (!nodeIs(paragraph, WORDPROCESSINGML_NAMESPACE, "p") ||
      paragraph.attributes.size !== 0 || paragraph.text !== "" ||
      paragraph.children.length < 1 || paragraph.children.length > 2) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/paragraph");
  }
  if (body.children.length === 2) {
    const section = body.children[1];
    if (!nodeIs(section, WORDPROCESSINGML_NAMESPACE, "sectPr") ||
        section.attributes.size !== 0 || section.children.length !== 0 || section.text !== "") {
      fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/section");
    }
  }
  let cursor = 0;
  if (nodeIs(paragraph.children[cursor], WORDPROCESSINGML_NAMESPACE, "pPr")) {
    const properties = paragraph.children[cursor];
    if (properties.attributes.size !== 0 || properties.text !== "" ||
        properties.children.length > 1) {
      fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/paragraphProperties");
    }
    if (properties.children.length === 1) {
      const style = properties.children[0];
      if (!nodeIs(style, WORDPROCESSINGML_NAMESPACE, "pStyle") ||
          style.children.length !== 0 || style.text !== "" || style.attributes.size !== 1 ||
          !assertOnlyAttributes(style, [[WORDPROCESSINGML_NAMESPACE, "val"]])) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/paragraphProperties");
      }
    }
    cursor += 1;
  }
  const mathParagraph = paragraph.children[cursor];
  if (cursor !== paragraph.children.length - 1 ||
      !nodeIs(mathParagraph, MATH_NAMESPACE, "oMathPara") ||
      mathParagraph.attributes.size !== 0 || mathParagraph.text !== "" ||
      mathParagraph.children.length < 1 || mathParagraph.children.length > 2) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/mathParagraph");
  }
  let mathIndex = 0;
  if (nodeIs(mathParagraph.children[0], MATH_NAMESPACE, "oMathParaPr")) {
    const properties = mathParagraph.children[0];
    if (properties.attributes.size !== 0 || properties.text !== "" ||
        properties.children.length > 1) {
      fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/mathParagraphProperties");
    }
    if (properties.children.length === 1) {
      const justification = properties.children[0];
      if (!nodeIs(justification, MATH_NAMESPACE, "jc") ||
          justification.children.length !== 0 || justification.text !== "" ||
          justification.attributes.size !== 1 ||
          attribute(justification, MATH_NAMESPACE, "val") !== "center") {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/mathParagraphProperties");
      }
    }
    mathIndex = 1;
  }
  if (mathIndex !== mathParagraph.children.length - 1 ||
      !nodeIs(mathParagraph.children[mathIndex], MATH_NAMESPACE, "oMath")) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math");
  }
  return mathParagraph.children[mathIndex];
}

function escapeXmlText(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeXmlAttribute(value) {
  return escapeXmlText(value).replaceAll('"', "&quot;");
}

function validateOmmlTree(root) {
  const nodes = collectNodes(root);
  if (nodes.length > MAX_OMML_ELEMENTS ||
      !nodeIs(root, MATH_NAMESPACE, "oMath") || root.attributes.size !== 0) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math");
  }
  let attributes = 0;
  let textBytes = 0;
  let runCount = 0;
  let textCount = 0;
  for (const node of nodes) {
    if (node.namespaceURI !== MATH_NAMESPACE || !ALLOWED_OMML_ELEMENTS.has(node.localName)) {
      fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math");
    }
    attributes += node.attributes.size;
    if (attributes > MAX_OMML_ATTRIBUTES) fail(ERROR_CODES.RESOURCE_LIMIT, "/docx/document/math");
    if (node.localName === "r") runCount += 1;
    if (node.localName === "t") {
      textCount += 1;
      if (node.children.length !== 0 || node.text.length === 0 ||
          !assertOnlyAttributes(node, [[XML_NAMESPACE, "space"]]) ||
          (node.attributes.size === 1 && attribute(node, XML_NAMESPACE, "space") !== "preserve")) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math/text");
      }
      textBytes += encoder.encode(node.text).byteLength;
      if (textBytes > MAX_OMML_TEXT_BYTES) fail(ERROR_CODES.RESOURCE_LIMIT, "/docx/document/math/text");
    } else {
      if (node.text !== "") {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math");
      }
      if (node.localName === "type") {
        if (node.attributes.size !== 1 ||
            attribute(node, MATH_NAMESPACE, "val") !== "bar") {
          fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math/fractionType");
        }
      } else if (node.localName === "degHide") {
        if (node.attributes.size !== 1 ||
            attribute(node, MATH_NAMESPACE, "val") !== "1") {
          fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math/degreeHidden");
        }
      } else if (node.attributes.size !== 0) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math");
      }
    }
  }
  if (runCount < 1 || textCount < 1) fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math");
  validateOmmlStructure(root);
}

function serializeOmmlNode(node, isRoot = false) {
  const attributes = [];
  for (const item of node.attributes.values()) {
    if (item.namespaceURI === MATH_NAMESPACE && item.localName === "val") {
      attributes.push(["m:val", item.value]);
    } else if (item.namespaceURI === XML_NAMESPACE && item.localName === "space") {
      attributes.push(["xml:space", item.value]);
    } else {
      fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math");
    }
  }
  attributes.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  if (isRoot) attributes.unshift(["xmlns:m", MATH_NAMESPACE]);
  const renderedAttributes = attributes
    .map(([name, value]) => ` ${name}="${escapeXmlAttribute(value)}"`)
    .join("");
  const children = node.children.map((child) => serializeOmmlNode(child)).join("");
  const text = node.localName === "t" ? escapeXmlText(node.text) : "";
  if (children.length === 0 && text.length === 0) {
    return `<m:${node.localName}${renderedAttributes}/>`;
  }
  return `<m:${node.localName}${renderedAttributes}>${text}${children}</m:${node.localName}>`;
}

function hasChildSequence(node, names) {
  return node.children.length === names.length &&
    names.every((name, index) => node.children[index].localName === name);
}

function hasExpressionChildren(node, { allowEmpty = false } = {}) {
  return (allowEmpty || node.children.length > 0) &&
    node.children.every((child) => OMML_EXPRESSION_ELEMENTS.has(child.localName));
}

function validateOmmlStructure(node) {
  switch (node.localName) {
    case "oMath":
      if (!hasExpressionChildren(node)) fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math");
      break;
    case "r":
      if (!hasChildSequence(node, ["t"])) fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math/run");
      break;
    case "t":
    case "type":
    case "degHide":
    case "sSupPr":
    case "sSubPr":
    case "sSubSupPr":
      if (node.children.length !== 0) fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math");
      break;
    case "f": {
      if (!(hasChildSequence(node, ["fPr", "num", "den"]) ||
          hasChildSequence(node, ["num", "den"]))) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math/fraction");
      }
      break;
    }
    case "fPr":
      if (!hasChildSequence(node, ["type"])) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math/fractionProperties");
      }
      break;
    case "num":
    case "den":
    case "e":
    case "sup":
    case "sub":
      if (!hasExpressionChildren(node)) fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math");
      break;
    case "sSup":
      if (!(hasChildSequence(node, ["e", "sup"]) ||
          hasChildSequence(node, ["sSupPr", "e", "sup"]))) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math/superscript");
      }
      break;
    case "sSub":
      if (!(hasChildSequence(node, ["e", "sub"]) ||
          hasChildSequence(node, ["sSubPr", "e", "sub"]))) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math/subscript");
      }
      break;
    case "sSubSup":
      if (!(hasChildSequence(node, ["e", "sub", "sup"]) ||
          hasChildSequence(node, ["sSubSupPr", "e", "sub", "sup"]))) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math/subSuperscript");
      }
      break;
    case "rad":
      if (!(hasChildSequence(node, ["deg", "e"]) ||
          hasChildSequence(node, ["radPr", "deg", "e"]))) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math/radical");
      }
      break;
    case "radPr":
      if (!hasChildSequence(node, ["degHide"])) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math/radicalProperties");
      }
      break;
    case "deg":
      if (!hasExpressionChildren(node, { allowEmpty: true })) {
        fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math/degree");
      }
      break;
    default:
      fail(ERROR_CODES.OUTPUT_INVALID, "/docx/document/math");
  }
  for (const child of node.children) validateOmmlStructure(child);
}

export function isCanonicalPandocOmmlFragment(fragment) {
  if (typeof fragment !== "string" || fragment.length === 0 ||
      fragment.length > MAX_OMML_FRAGMENT_CODE_UNITS) {
    return false;
  }
  let parsed;
  try {
    parsed = parseStrictXml(encoder.encode(fragment));
    if (parsed.namespaceUris.size !== 2 ||
        !parsed.namespaceUris.has(XML_NAMESPACE) ||
        !parsed.namespaceUris.has(MATH_NAMESPACE)) {
      return false;
    }
    validateOmmlTree(parsed.root);
    return serializeOmmlNode(parsed.root, true) === fragment;
  } catch {
    return false;
  }
}

export function extractCanonicalOmmlFromPandocDocx(input) {
  if (!(input instanceof Uint8Array)) fail(ERROR_CODES.ARGUMENT_INVALID, "/docx");
  if (input.byteLength > SECURE_ZIP_LIMITS.maxArchiveBytes) {
    fail(ERROR_CODES.RESOURCE_LIMIT, "/docx");
  }
  let parts;
  try {
    parts = parseSecureZip(Buffer.from(input));
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx");
  }
  if (!["[Content_Types].xml", "_rels/.rels", "word/document.xml"]
    .every((partPath) => parts.has(partPath)) ||
    [...parts.keys()].some((partPath) => !ALLOWED_DOCX_PARTS.has(partPath))) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx/parts");
  }
  validateContentTypes(parts);
  for (const partPath of EXPECTED_RELATIONSHIPS.keys()) {
    const sourcePart = relationshipSourcePart(partPath);
    const sourceDirectory = sourcePart?.includes("/")
      ? sourcePart.slice(0, sourcePart.lastIndexOf("/") + 1)
      : "";
    const expected = expectedRelationshipsForPart(parts, partPath, sourceDirectory);
    if ((partPath === "_rels/.rels" || expected.size > 0) && !parts.has(partPath)) {
      fail(ERROR_CODES.OUTPUT_INVALID, "/docx/relationships");
    }
    if (parts.has(partPath)) validateRelationshipsPart(parts, partPath);
  }
  if ([...parts.keys()].some((partPath) =>
    partPath.endsWith(".rels") && !EXPECTED_RELATIONSHIPS.has(partPath))) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/docx/relationships");
  }
  const document = parsePart(parts, "word/document.xml", "/docx/document");
  const root = validateDocumentWrapper(document);
  validateOmmlTree(root);
  const fragment = serializeOmmlNode(root, true);
  if (fragment.length > MAX_OMML_FRAGMENT_CODE_UNITS) {
    fail(ERROR_CODES.RESOURCE_LIMIT, "/docx/document/math");
  }
  return fragment;
}

function availability(availabilityStatus, reason, pandocVersion) {
  return deepFreeze({
    adapterVersion: PANDOC_OMML_ADAPTER_VERSION,
    adapterType: "pandoc-omml-adapter",
    availability: availabilityStatus,
    reason,
    pandocVersion
  });
}

async function completedResult(run, request, pointer) {
  const invocation = await invoke(run, request, pointer);
  if (invocation.kind !== "result") return null;
  const result = invocation.result;
  if (result.outcome !== "completed" || result.exitCode !== 0 ||
      result.signal !== null || result.stderr.byteLength !== 0 || result.stdout.byteLength === 0) {
    return null;
  }
  return result;
}

/**
 * Detect and capability-probe a trusted, explicitly configured Pandoc runner.
 * Missing or incompatible tools produce a stable unavailable facade; malformed
 * runner results fail as dependency-contract violations.
 */
export async function createPandocOmmlAdapter(options) {
  if (!hasExactDataProperties(options, ["runner"])) {
    fail(ERROR_CODES.ARGUMENT_INVALID);
  }
  const run = captureRunner(dataProperty(options, "runner"));
  const versionRequest = makeRequest(
    PANDOC_VERSION_ARGUMENTS,
    new Uint8Array(0),
    VERSION_TIMEOUT_MS,
    VERSION_STDOUT_BYTES
  );
  const versionInvocation = await invoke(run, versionRequest, "/detection/version");
  if (versionInvocation.kind !== "result") {
    const facade = availability("unavailable", "version-process-failed", null);
    ADAPTER_STATE.set(facade, Object.freeze({ run, apiVersion: null }));
    return facade;
  }
  const versionOutcome = versionInvocation.result;
  if (versionOutcome.outcome === "not-found") {
    const facade = availability("unavailable", "not-found", null);
    ADAPTER_STATE.set(facade, Object.freeze({ run, apiVersion: null }));
    return facade;
  }
  if (versionOutcome.outcome !== "completed" || versionOutcome.exitCode !== 0 ||
      versionOutcome.signal !== null || versionOutcome.stderr.byteLength !== 0 ||
      versionOutcome.stdout.byteLength === 0) {
    const facade = availability("unavailable", "version-probe-failed", null);
    ADAPTER_STATE.set(facade, Object.freeze({ run, apiVersion: null }));
    return facade;
  }
  const version = parsePandocVersion(versionOutcome.stdout);
  if (!version) {
    const facade = availability("unavailable", "version-output-invalid", null);
    ADAPTER_STATE.set(facade, Object.freeze({ run, apiVersion: null }));
    return facade;
  }
  if (!isCompatiblePandocVersion(version)) {
    const facade = availability("incompatible", "unsupported-version", version.text);
    ADAPTER_STATE.set(facade, Object.freeze({ run, apiVersion: null }));
    return facade;
  }

  const apiRequest = makeRequest(
    PANDOC_API_ARGUMENTS,
    encoder.encode(""),
    PROBE_TIMEOUT_MS,
    PROBE_JSON_BYTES
  );
  const apiResult = await completedResult(run, apiRequest, "/detection/api");
  const apiVersion = apiResult ? parsePandocApiVersion(apiResult.stdout) : null;
  if (!apiVersion) {
    const facade = availability("unavailable", "api-probe-failed", version.text);
    ADAPTER_STATE.set(facade, Object.freeze({ run, apiVersion: null }));
    return facade;
  }

  const docxRequest = makeRequest(
    PANDOC_DOCX_ARGUMENTS,
    makePandocMathAst(apiVersion, PROBE_LATEX),
    PROBE_TIMEOUT_MS,
    SECURE_ZIP_LIMITS.maxArchiveBytes
  );
  const docxResult = await completedResult(run, docxRequest, "/detection/omml");
  let probeFragment;
  try {
    probeFragment = docxResult
      ? extractCanonicalOmmlFromPandocDocx(docxResult.stdout)
      : null;
  } catch {
    probeFragment = null;
  }
  if (probeFragment !== PROBE_OMML) {
    const facade = availability("unavailable", "omml-probe-failed", version.text);
    ADAPTER_STATE.set(facade, Object.freeze({ run, apiVersion: null }));
    return facade;
  }

  const facade = availability("available", "ready", version.text);
  ADAPTER_STATE.set(facade, Object.freeze({ run, apiVersion }));
  return facade;
}

export async function convertLatexToOmml(options) {
  if (!hasExactDataProperties(options, ["adapter", "latex"])) {
    fail(ERROR_CODES.ARGUMENT_INVALID);
  }
  const adapter = dataProperty(options, "adapter");
  const state = ADAPTER_STATE.get(adapter);
  if (!state) fail(ERROR_CODES.ARGUMENT_INVALID, "/adapter");
  if (adapter.availability !== "available" || !state.apiVersion) {
    fail(ERROR_CODES.UNAVAILABLE, "/adapter");
  }
  const latex = dataProperty(options, "latex");
  if (!isSupportedLatexMathExpression(latex)) {
    fail(ERROR_CODES.INPUT_INVALID, "/latex");
  }
  const request = makeRequest(
    PANDOC_DOCX_ARGUMENTS,
    makePandocMathAst(state.apiVersion, latex),
    CONVERSION_TIMEOUT_MS,
    SECURE_ZIP_LIMITS.maxArchiveBytes
  );
  const result = await completedResult(state.run, request, "/conversion");
  if (!result) fail(ERROR_CODES.PROCESS_FAILED, "/conversion");
  let ommlFragment;
  try {
    ommlFragment = extractCanonicalOmmlFromPandocDocx(result.stdout);
  } catch (error) {
    if (error instanceof PandocOmmlAdapterError && error.code === ERROR_CODES.RESOURCE_LIMIT) {
      throw error;
    }
    fail(ERROR_CODES.OUTPUT_INVALID, "/conversion");
  }
  return deepFreeze({
    adapterProfileVersion: PANDOC_OMML_ADAPTER_VERSION,
    artifactKind: "unbound-omml-conformance-fragment",
    insertable: false,
    ommlFragment
  });
}
