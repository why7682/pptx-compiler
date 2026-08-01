export const STRICT_XML_PROFILE_VERSION = "0.1.0";

export const STRICT_XML_LIMITS = Object.freeze({
  maxPartBytes: 256 * 1024,
  maxDepth: 64,
  maxElements: 10_000,
  maxAttributesPerElement: 32,
  maxAttributes: 10_000,
  maxNamespaceDeclarations: 16,
  maxQNameBytes: 128,
  maxAttributeValueBytes: 4 * 1024,
  maxTextNodeBytes: 64 * 1024,
  maxDecodedTextBytes: 256 * 1024
});

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
const NAME_START = /[A-Za-z_]/u;
const NAME_CONTINUE = /[A-Za-z0-9_.:-]/u;
const NAMED_REFERENCES = Object.freeze({ lt: "<", gt: ">", amp: "&", apos: "'", quot: '"' });

export class StrictXmlError extends Error {
  constructor(code, pointer = "/xml") {
    super(`${code} at ${pointer}`);
    this.name = "StrictXmlError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer = "/xml") {
  throw new StrictXmlError(code, pointer);
}

function isXmlCodePoint(codePoint) {
  return codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff);
}

function validateXmlCharacters(value, pointer) {
  for (const character of value) {
    if (!isXmlCodePoint(character.codePointAt(0))) fail("XML_DOCUMENT_INVALID", pointer);
  }
}

function decodeReferences(value, pointer) {
  if (!value.includes("&")) return value;
  let output = "";
  let cursor = 0;
  while (cursor < value.length) {
    const ampersand = value.indexOf("&", cursor);
    if (ampersand === -1) {
      output += value.slice(cursor);
      break;
    }
    output += value.slice(cursor, ampersand);
    const semicolon = value.indexOf(";", ampersand + 1);
    if (semicolon === -1 || semicolon - ampersand > 16) {
      fail("XML_ENTITY_INVALID", pointer);
    }
    const reference = value.slice(ampersand + 1, semicolon);
    if (Object.hasOwn(NAMED_REFERENCES, reference)) {
      output += NAMED_REFERENCES[reference];
    } else {
      const decimal = /^#[0-9]+$/u.test(reference);
      const hexadecimal = /^#x[0-9A-Fa-f]+$/u.test(reference);
      if (!decimal && !hexadecimal) fail("XML_ENTITY_INVALID", pointer);
      const codePoint = Number.parseInt(reference.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      if (!Number.isSafeInteger(codePoint) || !isXmlCodePoint(codePoint)) {
        fail("XML_ENTITY_INVALID", pointer);
      }
      output += String.fromCodePoint(codePoint);
    }
    cursor = semicolon + 1;
  }
  validateXmlCharacters(output, pointer);
  return output;
}

function splitQName(rawName, pointer) {
  if (Buffer.byteLength(rawName, "utf8") > STRICT_XML_LIMITS.maxQNameBytes ||
      !NAME_START.test(rawName[0] ?? "") ||
      [...rawName].some((character) => !NAME_CONTINUE.test(character))) {
    fail("XML_DOCUMENT_INVALID", pointer);
  }
  const pieces = rawName.split(":");
  if (pieces.length > 2 || pieces.some((piece) => piece.length === 0 || !NAME_START.test(piece[0]))) {
    fail("XML_NAMESPACE_INVALID", pointer);
  }
  return pieces.length === 1
    ? { prefix: "", localName: pieces[0] }
    : { prefix: pieces[0], localName: pieces[1] };
}

function expandedKey(namespaceURI, localName) {
  return `${namespaceURI}\u0000${localName}`;
}

function parseDeclaration(text) {
  if (!text.startsWith("<?xml")) return 0;
  const end = text.indexOf("?>");
  if (end === -1 || end > 256) fail("XML_DOCUMENT_INVALID", "/xml/declaration");
  const declaration = text.slice(0, end + 2);
  const pattern = /^<\?xml[\t\r\n ]+version=(?:"1\.0"|'1\.0')(?:[\t\r\n ]+encoding=(?:"UTF-8"|'UTF-8'|"utf-8"|'utf-8'))?(?:[\t\r\n ]+standalone=(?:"yes"|'yes'|"no"|'no'))?[\t\r\n ]*\?>$/u;
  if (!pattern.test(declaration)) fail("XML_DOCUMENT_INVALID", "/xml/declaration");
  return end + 2;
}

function makeParser(text) {
  let cursor = parseDeclaration(text);
  let elementCount = 0;
  let attributeCount = 0;
  let decodedTextBytes = 0;
  const namespaceUris = new Set([XML_NAMESPACE]);
  const stack = [];
  let root = null;

  function pointer() {
    return `/xml/elements/${elementCount}`;
  }

  function skipWhitespace() {
    while (cursor < text.length && /[\t\r\n ]/u.test(text[cursor])) cursor += 1;
  }

  function readName(namePointer) {
    const start = cursor;
    if (!NAME_START.test(text[cursor] ?? "")) fail("XML_DOCUMENT_INVALID", namePointer);
    cursor += 1;
    while (cursor < text.length && NAME_CONTINUE.test(text[cursor])) cursor += 1;
    return text.slice(start, cursor);
  }

  function readAttributeValue(attributePointer) {
    const quote = text[cursor];
    if (quote !== '"' && quote !== "'") fail("XML_DOCUMENT_INVALID", attributePointer);
    cursor += 1;
    const start = cursor;
    while (cursor < text.length && text[cursor] !== quote) {
      if (text[cursor] === "<") fail("XML_DOCUMENT_INVALID", attributePointer);
      cursor += 1;
    }
    if (cursor >= text.length) fail("XML_DOCUMENT_INVALID", attributePointer);
    const rawValue = text.slice(start, cursor);
    cursor += 1;
    if (Buffer.byteLength(rawValue, "utf8") > STRICT_XML_LIMITS.maxAttributeValueBytes) {
      fail("XML_RESOURCE_LIMIT", attributePointer);
    }
    return decodeReferences(rawValue, attributePointer);
  }

  function resolveName(rawName, namespaces, isAttribute, namePointer) {
    const { prefix, localName } = splitQName(rawName, namePointer);
    const namespaceURI = prefix === ""
      ? (isAttribute ? "" : (namespaces.get("") ?? ""))
      : namespaces.get(prefix);
    if (namespaceURI === undefined || prefix === "xmlns") {
      fail("XML_NAMESPACE_INVALID", namePointer);
    }
    return { namespaceURI, localName, key: expandedKey(namespaceURI, localName) };
  }

  function addText(rawText) {
    if (rawText.length === 0) return;
    if (rawText.includes("]]>") || stack.length === 0) {
      if (rawText.trim() !== "") fail("XML_DOCUMENT_INVALID", "/xml/text");
      return;
    }
    if (Buffer.byteLength(rawText, "utf8") > STRICT_XML_LIMITS.maxTextNodeBytes) {
      fail("XML_RESOURCE_LIMIT", "/xml/text");
    }
    const decoded = decodeReferences(rawText, "/xml/text");
    decodedTextBytes += Buffer.byteLength(decoded, "utf8");
    if (decodedTextBytes > STRICT_XML_LIMITS.maxDecodedTextBytes) {
      fail("XML_RESOURCE_LIMIT", "/xml/text");
    }
    stack.at(-1).node.textSegments.push(decoded);
  }

  function parseStartTag() {
    const nodePointer = pointer();
    cursor += 1;
    const rawName = readName(`${nodePointer}/name`);
    const rawAttributes = [];
    const rawAttributeNames = new Set();
    let selfClosing = false;
    let closed = false;
    while (cursor < text.length) {
      skipWhitespace();
      if (text.startsWith("/>", cursor)) {
        cursor += 2;
        selfClosing = true;
        closed = true;
        break;
      }
      if (text[cursor] === ">") {
        cursor += 1;
        closed = true;
        break;
      }
      if (rawAttributes.length >= STRICT_XML_LIMITS.maxAttributesPerElement) {
        fail("XML_RESOURCE_LIMIT", `${nodePointer}/attributes`);
      }
      const attributeName = readName(`${nodePointer}/attributes`);
      if (rawAttributeNames.has(attributeName)) {
        fail("XML_DOCUMENT_INVALID", `${nodePointer}/attributes`);
      }
      rawAttributeNames.add(attributeName);
      skipWhitespace();
      if (text[cursor] !== "=") fail("XML_DOCUMENT_INVALID", `${nodePointer}/attributes`);
      cursor += 1;
      skipWhitespace();
      rawAttributes.push([
        attributeName,
        readAttributeValue(`${nodePointer}/attributes`)
      ]);
    }
    if (!closed) fail("XML_DOCUMENT_INVALID", nodePointer);

    const parentNamespaces = stack.length === 0
      ? new Map([["xml", XML_NAMESPACE]])
      : stack.at(-1).namespaces;
    const namespaces = new Map(parentNamespaces);
    let declarationCount = 0;
    for (const [name, value] of rawAttributes) {
      if (name !== "xmlns" && !name.startsWith("xmlns:")) continue;
      declarationCount += 1;
      if (stack.length !== 0 || declarationCount > STRICT_XML_LIMITS.maxNamespaceDeclarations ||
          value.length === 0) {
        fail("XML_NAMESPACE_INVALID", `${nodePointer}/namespaces`);
      }
      const prefix = name === "xmlns" ? "" : name.slice(6);
      splitQName(prefix === "" ? "default" : prefix, `${nodePointer}/namespaces`);
      if (prefix === "xml" || prefix === "xmlns" || namespaces.has(prefix) ||
          value === XML_NAMESPACE || value === XMLNS_NAMESPACE) {
        fail("XML_NAMESPACE_INVALID", `${nodePointer}/namespaces`);
      }
      namespaces.set(prefix, value);
      namespaceUris.add(value);
    }

    const name = resolveName(rawName, namespaces, false, `${nodePointer}/name`);
    const attributes = new Map();
    for (const [rawAttributeName, value] of rawAttributes) {
      if (rawAttributeName === "xmlns" || rawAttributeName.startsWith("xmlns:")) continue;
      const attributeName = resolveName(
        rawAttributeName,
        namespaces,
        true,
        `${nodePointer}/attributes`
      );
      if (attributes.has(attributeName.key)) {
        fail("XML_DOCUMENT_INVALID", `${nodePointer}/attributes`);
      }
      attributes.set(attributeName.key, {
        namespaceURI: attributeName.namespaceURI,
        localName: attributeName.localName,
        value
      });
      attributeCount += 1;
      if (attributeCount > STRICT_XML_LIMITS.maxAttributes) {
        fail("XML_RESOURCE_LIMIT", "/xml/attributes");
      }
    }

    elementCount += 1;
    if (elementCount > STRICT_XML_LIMITS.maxElements) {
      fail("XML_RESOURCE_LIMIT", "/xml/elements");
    }
    const node = {
      namespaceURI: name.namespaceURI,
      localName: name.localName,
      key: name.key,
      attributes,
      children: [],
      textSegments: [],
      text: ""
    };
    if (stack.length === 0) {
      if (root !== null) fail("XML_DOCUMENT_INVALID", "/xml/root");
      root = node;
    } else {
      stack.at(-1).node.children.push(node);
    }
    if (!selfClosing) {
      stack.push({ rawName, namespaces, node });
      if (stack.length > STRICT_XML_LIMITS.maxDepth) {
        fail("XML_RESOURCE_LIMIT", "/xml/depth");
      }
    } else {
      node.text = "";
      delete node.textSegments;
    }
  }

  function parseEndTag() {
    const current = stack.at(-1);
    if (!current) fail("XML_DOCUMENT_INVALID", "/xml/endTag");
    cursor += 2;
    const rawName = readName("/xml/endTag");
    skipWhitespace();
    if (text[cursor] !== ">" || rawName !== current.rawName) {
      fail("XML_DOCUMENT_INVALID", "/xml/endTag");
    }
    cursor += 1;
    current.node.text = current.node.textSegments.join("");
    delete current.node.textSegments;
    stack.pop();
  }

  while (cursor < text.length) {
    const opening = text.indexOf("<", cursor);
    if (opening === -1) {
      addText(text.slice(cursor));
      cursor = text.length;
      break;
    }
    addText(text.slice(cursor, opening));
    cursor = opening;
    if (text.startsWith("</", cursor)) {
      parseEndTag();
    } else if (text.startsWith("<!", cursor) || text.startsWith("<?", cursor)) {
      fail("XML_UNSUPPORTED_MARKUP", "/xml/markup");
    } else {
      parseStartTag();
    }
  }
  if (stack.length !== 0 || root === null) fail("XML_DOCUMENT_INVALID", "/xml/root");
  return {
    root,
    namespaceUris,
    counts: Object.freeze({ elements: elementCount, attributes: attributeCount })
  };
}

/** Parse a strict, bounded UTF-8 XML 1.0 subset into namespace-expanded nodes. */
export function parseStrictXml(input) {
  if (!(input instanceof Uint8Array)) fail("XML_ARGUMENT_INVALID");
  if (input.byteLength === 0 || input.byteLength > STRICT_XML_LIMITS.maxPartBytes) {
    fail("XML_RESOURCE_LIMIT");
  }
  let text;
  try {
    text = UTF8_DECODER.decode(Buffer.from(input));
  } catch {
    fail("XML_DOCUMENT_INVALID", "/xml/encoding");
  }
  if (text.startsWith("\uFEFF")) fail("XML_DOCUMENT_INVALID", "/xml/encoding");
  validateXmlCharacters(text, "/xml/characters");
  return makeParser(text);
}
