import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import { verifyCandidateBuildRecord } from
  "../../core/src/candidate-build-record.mjs";
import {
  parseSecureZip,
  SECURE_ZIP_LIMITS
} from "../../core/src/secure-zip.mjs";
import { parseStrictXml } from "../../core/src/strict-xml.mjs";

export const FORMULA_CONTENT_EDIT_INSPECTION_VERSION = "0.1.0";

const CANDIDATE_FILE_NAME = "ordered-compatibility-source.pptx";
const FORMULA_SLIDE_ID = "mixed-evidence";
const NS = Object.freeze({
  math: "http://schemas.openxmlformats.org/officeDocument/2006/math",
  markupCompatibility:
    "http://schemas.openxmlformats.org/markup-compatibility/2006",
  office2010Drawing:
    "http://schemas.microsoft.com/office/drawing/2010/main"
});
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const VIEW_BUFFER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer"
).get;
const VIEW_LENGTH = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength"
).get;
const VIEW_OFFSET = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset"
).get;
const ARRAY_BUFFER_LENGTH = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength"
).get;
const ARRAY_BUFFER_RESIZABLE = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "resizable"
)?.get;

export class FormulaContentEditInspectionError extends TypeError {
  constructor(pointer) {
    super(`FORMULA_CONTENT_EDIT_INSPECTION_INVALID at ${pointer}`);
    this.name = "FormulaContentEditInspectionError";
    this.code = "FORMULA_CONTENT_EDIT_INSPECTION_INVALID";
    this.pointer = pointer;
  }
}

function fail(pointer) {
  throw new FormulaContentEditInspectionError(pointer);
}

function exactOptions(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    fail("/options");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = ["candidateBytes", "candidateRecordBytes", "editedBytes"];
  if (Reflect.ownKeys(descriptors).length !== keys.length ||
      keys.some((key) => descriptors[key] === undefined ||
        !("value" in descriptors[key]) || descriptors[key].enumerable !== true)) {
    fail("/options");
  }
  return keys.map((key) => descriptors[key].value);
}

function snapshotBuffer(value, pointer) {
  try {
    if (utilTypes.isProxy(value) || !Buffer.isBuffer(value) ||
        Object.getPrototypeOf(value) !== Buffer.prototype ||
        ["buffer", "byteLength", "byteOffset", "length"]
          .some((key) => Object.hasOwn(value, key))) {
      fail(pointer);
    }
    const backing = Reflect.apply(VIEW_BUFFER, value, []);
    const length = Reflect.apply(VIEW_LENGTH, value, []);
    const offset = Reflect.apply(VIEW_OFFSET, value, []);
    const backingLength = Reflect.apply(ARRAY_BUFFER_LENGTH, backing, []);
    const resizable = ARRAY_BUFFER_RESIZABLE === undefined
      ? false
      : Reflect.apply(ARRAY_BUFFER_RESIZABLE, backing, []);
    if (!utilTypes.isArrayBuffer(backing) || utilTypes.isSharedArrayBuffer(backing) ||
        resizable === true || !Number.isSafeInteger(length) || length < 1 ||
        length > SECURE_ZIP_LIMITS.maxArchiveBytes ||
        !Number.isSafeInteger(offset) || offset < 0 ||
        offset + length > backingLength) {
      fail(pointer);
    }
    return Buffer.from(new Uint8Array(backing, offset, length));
  } catch (error) {
    if (error instanceof FormulaContentEditInspectionError) throw error;
    fail(pointer);
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function freezeTree(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeTree(child);
  return Object.freeze(value);
}

function flatten(root) {
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    for (const child of node.children) visit(child);
  };
  visit(root);
  return nodes;
}

function named(nodes, namespaceURI, localName) {
  return nodes.filter((node) =>
    node.namespaceURI === namespaceURI && node.localName === localName);
}

function oneText(node, pointer) {
  const texts = named(flatten(node), NS.math, "t");
  if (texts.length !== 1 || texts[0].text.length < 1 ||
      Buffer.byteLength(texts[0].text, "utf8") > 128 ||
      /[\u0000-\u001f\u007f]/u.test(texts[0].text)) {
    fail(pointer);
  }
  return texts[0].text;
}

function inspectFraction(slideBytes, pointer) {
  let root;
  try {
    root = parseStrictXml(slideBytes).root;
  } catch {
    fail(pointer);
  }
  const nodes = flatten(root);
  const alternates = named(nodes, NS.markupCompatibility, "AlternateContent");
  const choices = named(nodes, NS.markupCompatibility, "Choice");
  const fallbacks = named(nodes, NS.markupCompatibility, "Fallback");
  const zones = named(nodes, NS.office2010Drawing, "m");
  const paragraphs = named(nodes, NS.math, "oMathPara");
  const maths = named(nodes, NS.math, "oMath");
  const fractions = named(nodes, NS.math, "f");
  if ([alternates, choices, fallbacks, zones, paragraphs, maths, fractions]
    .some((matches) => matches.length !== 1) ||
      !flatten(alternates[0]).includes(choices[0]) ||
      !flatten(alternates[0]).includes(fallbacks[0]) ||
      !flatten(choices[0]).includes(zones[0]) ||
      !flatten(zones[0]).includes(paragraphs[0]) ||
      !flatten(paragraphs[0]).includes(maths[0]) ||
      !flatten(maths[0]).includes(fractions[0])) {
    fail(`${pointer}/topology`);
  }
  const fractionNodes = flatten(fractions[0]);
  const numerators = named(fractionNodes, NS.math, "num");
  const denominators = named(fractionNodes, NS.math, "den");
  if (numerators.length !== 1 || denominators.length !== 1 ||
      named(nodes, NS.math, "t").length !== 2) {
    fail(`${pointer}/fraction`);
  }
  return Object.freeze({
    fraction: Object.freeze({
      numerator: oneText(numerators[0], `${pointer}/numerator`),
      denominator: oneText(denominators[0], `${pointer}/denominator`)
    }),
    observedTopology: Object.freeze({
      alternateContentCount: 1,
      office2010MathZoneCount: 1,
      mathParagraphCount: 1,
      mathObjectCount: 1,
      fractionCount: 1,
      closedGrammarValidated: false
    })
  });
}

function verifiedFormulaSlide(candidateBytes, candidateRecordBytes) {
  let verified;
  try {
    verified = verifyCandidateBuildRecord({
      candidateBytes,
      recordBytes: candidateRecordBytes,
      candidateFileName: CANDIDATE_FILE_NAME
    });
  } catch {
    fail("/options/candidate");
  }
  const slides = verified.record.deck?.slides;
  const matches = Array.isArray(slides)
    ? slides.filter((slide) => slide.slideId === FORMULA_SLIDE_ID)
    : [];
  const slide = matches[0];
  if (verified.record.sourceArtifactType !== "ordered-assembled-pptx" ||
      matches.length !== 1 ||
      slide.sourceBuild?.buildType !== "native-omml-formula-source" ||
      slide.sourceBuild?.capabilityEvidence?.evidenceType !== "native-omml-formula") {
    fail("/options/candidate/formulaSlide");
  }
  return Object.freeze({ verified, slide });
}

function parseArchive(bytes, pointer) {
  try {
    return parseSecureZip(bytes);
  } catch {
    fail(pointer);
  }
}

/**
 * Return machine observations only. This function does not establish a human
 * action, PowerPoint provenance, whole-package safety, a gate result, or any
 * receipt/publication authority.
 */
export function inspectFormulaContentEditTransition(options) {
  const [candidateValue, recordValue, editedValue] = exactOptions(options);
  const candidateBytes = snapshotBuffer(candidateValue, "/options/candidateBytes");
  const candidateRecordBytes = snapshotBuffer(
    recordValue,
    "/options/candidateRecordBytes"
  );
  const editedBytes = snapshotBuffer(editedValue, "/options/editedBytes");
  const { verified, slide } = verifiedFormulaSlide(candidateBytes, candidateRecordBytes);
  const candidateArchive = parseArchive(candidateBytes, "/options/candidateBytes");
  const editedArchive = parseArchive(editedBytes, "/options/editedBytes");
  const expectedSlideParts = verified.record.deck.slides.map((entry) => entry.slidePart);
  const editedSlideParts = [...editedArchive.keys()].filter((partPath) =>
    /^ppt\/slides\/slide[1-9][0-9]*\.xml$/u.test(partPath));
  if (editedSlideParts.length !== expectedSlideParts.length ||
      expectedSlideParts.some((partPath) => !editedArchive.has(partPath))) {
    fail("/options/editedBytes/slideSet");
  }
  const beforeSlide = candidateArchive.get(slide.slidePart);
  const afterSlide = editedArchive.get(slide.slidePart);
  if (beforeSlide === undefined || afterSlide === undefined) {
    fail("/options/editedBytes/formulaSlide");
  }
  return freezeTree({
    inspectionVersion: FORMULA_CONTENT_EDIT_INSPECTION_VERSION,
    inspectionType: "formula-content-edit-machine-observation",
    authority: "none",
    deliveryEligible: false,
    supportClaimsEnabled: false,
    machineObservation: {
      candidateRecordVerified: true,
      orderedSlideSetRetained: true,
      slideId: slide.slideId,
      slidePart: slide.slidePart,
      sourceBuildType: slide.sourceBuild.buildType,
      structureProfile:
        slide.sourceBuild.capabilityEvidence.formulaTarget.structureProfile,
      before: inspectFraction(beforeSlide, "/options/candidateBytes/formulaSlide"),
      after: inspectFraction(afterSlide, "/options/editedBytes/formulaSlide")
    },
    artifacts: {
      candidateSha256: verified.candidateSha256,
      candidateRecordSha256: verified.recordSha256,
      editedDerivativeSha256: sha256(editedBytes),
      formulaSourceArtifactSha256: slide.sourceArtifactSha256,
      beforeFormulaSlideSha256: sha256(beforeSlide),
      afterFormulaSlideSha256: sha256(afterSlide)
    },
    limitations: [
      "machine-observation-only",
      "not-a-whole-package-safety-assessment",
      "closed-omml-grammar-not-validated",
      "not-a-human-attestation",
      "not-a-compatibility-receipt",
      "not-final-delivery-authority",
      "not-support-promotion"
    ]
  });
}
