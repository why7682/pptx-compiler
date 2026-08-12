import { createHash } from "node:crypto";
import path from "node:path";

import { authenticateCloneFillAssemblyArtifact } from "./create-only-assembly.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { authenticateNativeCardArrowAssemblyArtifact } from
  "./native-card-arrow-assembly.mjs";
import { authenticateNativeOmmlFormulaAssemblyArtifact } from
  "./native-omml-formula-assembly.mjs";
import { buildSecureTemplatePackageView } from "./ooxml-package-view.mjs";
import { parseSecureZip, SECURE_ZIP_LIMITS } from "./secure-zip.mjs";
import { parseStrictXml } from "./strict-xml.mjs";

export const ORDERED_SLIDE_ASSEMBLY_VERSION = "0.1.0";

const MIN_SLIDES = 2;
// The admitted package grammar has ten fixed parts plus one slide part and one
// slide-relationship part per slide. Keep assembly inside the secure ZIP
// parser's 32-entry ceiling instead of advertising an artifact it cannot read.
const MAX_SLIDES = 11;
const SEMANTIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const XML_DECLARATION = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
const SLIDE_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
const NS = Object.freeze({
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  contentTypes: "http://schemas.openxmlformats.org/package/2006/content-types",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  relationships: "http://schemas.openxmlformats.org/package/2006/relationships",
  xml: "http://www.w3.org/XML/1998/namespace"
});
const RELATIONSHIP_TYPES = Object.freeze({
  officeDocument:
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
  presProps:
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps",
  slide:
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
  slideLayout:
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout",
  slideMaster:
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster",
  theme:
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme"
});
const PRESENTATION_PART = "ppt/presentation.xml";
const PRESENTATION_RELS_PART = "ppt/_rels/presentation.xml.rels";
const SOURCE_SLIDE_PART = "ppt/slides/slide1.xml";
const SOURCE_SLIDE_RELS_PART = "ppt/slides/_rels/slide1.xml.rels";
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer"
).get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength"
).get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset"
).get;
const authenticOrderedAssemblyReports = new WeakMap();
const TARGET_SPECIFIC_NATIVE_PROFILES = Object.freeze([
  Object.freeze({
    artifactType: "native-card-arrow-assembled-pptx",
    verificationProfile: "target-specific-native-card-arrow-output",
    publicationProfile: "direct-native-artifact-only",
    buildType: "native-card-arrow-source",
    unreplayableBuildType: "unreplayable-native-card-arrow-source",
    authenticate: authenticateNativeCardArrowAssemblyArtifact,
    capabilityEvidence(report) {
      return Object.freeze({
        evidenceType: "native-card-arrow",
        allocatedShapeIds: report.allocatedShapeIds
      });
    }
  }),
  Object.freeze({
    artifactType: "native-omml-formula-assembled-pptx",
    verificationProfile: "target-specific-native-omml-formula-output",
    publicationProfile: "direct-native-omml-artifact-only",
    buildType: "native-omml-formula-source",
    unreplayableBuildType: "unreplayable-native-omml-formula-source",
    authenticate: authenticateNativeOmmlFormulaAssemblyArtifact,
    capabilityEvidence(report) {
      return Object.freeze({
        evidenceType: "native-omml-formula",
        formulaDigest: report.formulaDigest,
        formulaTarget: report.formulaTarget
      });
    }
  })
]);

const ERROR_CODES = Object.freeze({
  ARGUMENT_INVALID: "ORDERED_SLIDE_ASSEMBLY_ARGUMENT_INVALID",
  COLLATERAL_CHANGE: "ORDERED_SLIDE_ASSEMBLY_COLLATERAL_CHANGE",
  OUTPUT_INVALID: "ORDERED_SLIDE_ASSEMBLY_OUTPUT_INVALID",
  SOURCE_MISMATCH: "ORDERED_SLIDE_ASSEMBLY_SOURCE_MISMATCH"
});

export class OrderedSlideAssemblyError extends Error {
  constructor(code, pointer) {
    super(`${code} at ${pointer}`);
    this.name = "OrderedSlideAssemblyError";
    this.code = code;
    this.pointer = pointer;
  }

  toJSON() {
    return { code: this.code, pointer: this.pointer };
  }
}

function fail(code, pointer) {
  throw new OrderedSlideAssemblyError(code, pointer);
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function closedRecord(value, pointer, expectedKeys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string") || keys.length !== expectedKeys.length) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  const fields = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/${key}`);
    }
    fields[key] = descriptor.value;
  }
  return fields;
}

function arrayValues(value, pointer, minimum, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length < minimum || length > maximum) {
    fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/length`);
  }
  if (Reflect.ownKeys(descriptors).length !== length + 1) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(ERROR_CODES.ARGUMENT_INVALID, `${pointer}/${index}`);
    }
    result.push(descriptor.value);
  }
  return result;
}

function semanticId(value, pointer) {
  if (typeof value !== "string" || value.length > 96 || !SEMANTIC_ID.test(value)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  return value;
}

function snapshotArchiveBytes(value, pointer) {
  if (!(value instanceof Uint8Array)) fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  let buffer;
  let byteLength;
  let byteOffset;
  try {
    buffer = TYPED_ARRAY_BUFFER_GETTER.call(value);
    byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(value);
    byteOffset = TYPED_ARRAY_BYTE_OFFSET_GETTER.call(value);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, pointer);
  }
  if (!Number.isSafeInteger(byteLength) || byteLength < 1 ||
      byteLength > SECURE_ZIP_LIMITS.maxArchiveBytes ||
      !Number.isSafeInteger(byteOffset) || byteOffset < 0) {
    fail(ERROR_CODES.SOURCE_MISMATCH, pointer);
  }
  try {
    return Buffer.from(new Uint8Array(buffer, byteOffset, byteLength));
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, pointer);
  }
}

function captureSlides(options) {
  const optionFields = closedRecord(options, "/options", ["slides"]);
  const slides = arrayValues(optionFields.slides, "/slides", MIN_SLIDES, MAX_SLIDES)
    .map((value, index) => {
      const pointer = `/slides/${index}`;
      const fields = closedRecord(value, pointer, ["archiveBytes", "report"]);
      return {
        archiveBytes: snapshotArchiveBytes(fields.archiveBytes, `${pointer}/archiveBytes`),
        report: fields.report
      };
    });
  return slides;
}

function relationshipSet(view, ownerPart, pointer, code = ERROR_CODES.SOURCE_MISMATCH) {
  const sets = view.relationshipSets.filter((candidate) => candidate.ownerPart === ownerPart);
  if (sets.length !== 1) fail(code, pointer);
  return sets[0];
}

function oneRelationship(
  set,
  relationshipType,
  pointer,
  code = ERROR_CODES.SOURCE_MISMATCH
) {
  const matches = set.relationships.filter((relationship) =>
    relationship.relationshipType === relationshipType);
  if (matches.length !== 1) fail(code, pointer);
  return matches[0];
}

function contentPartHasType(view, partPath, contentType) {
  return view.contentParts.some((part) =>
    part.partPath === partPath && part.contentType === contentType);
}

function validateClosedRelationshipGraph(
  view,
  expectedSlideParts,
  pointer,
  code = ERROR_CODES.SOURCE_MISMATCH
) {
  if (view.presentation.partPath !== PRESENTATION_PART || view.masters.length !== 1 ||
      view.layouts.length !== 1 || view.slides.length !== expectedSlideParts.length ||
      view.presentation.masterReferences.length !== 1 ||
      view.presentation.slideReferences.length !== expectedSlideParts.length ||
      view.masters[0].layoutReferences.length !== 1 ||
      view.relationshipSets.length !== 4 + expectedSlideParts.length ||
      expectedSlideParts.some((partPath) =>
        !view.slides.some((slide) => slide.partPath === partPath))) {
    fail(code, pointer);
  }

  const rootRelationships = relationshipSet(view, null, `${pointer}/root`, code);
  const rootPresentation = oneRelationship(
    rootRelationships,
    RELATIONSHIP_TYPES.officeDocument,
    `${pointer}/root`,
    code
  );
  if (rootRelationships.relationships.length !== 1 ||
      rootPresentation.targetPart !== PRESENTATION_PART) {
    fail(code, `${pointer}/root`);
  }

  const presentationRelationships = relationshipSet(
    view,
    PRESENTATION_PART,
    `${pointer}/presentation`,
    code
  );
  if (presentationRelationships.relationships.length !== 3 + expectedSlideParts.length) {
    fail(code, `${pointer}/presentation`);
  }
  const master = oneRelationship(
    presentationRelationships,
    RELATIONSHIP_TYPES.slideMaster,
    `${pointer}/presentation/master`,
    code
  );
  const presProps = oneRelationship(
    presentationRelationships,
    RELATIONSHIP_TYPES.presProps,
    `${pointer}/presentation/presProps`,
    code
  );
  const theme = oneRelationship(
    presentationRelationships,
    RELATIONSHIP_TYPES.theme,
    `${pointer}/presentation/theme`,
    code
  );
  const slideRelationships = presentationRelationships.relationships.filter((relationship) =>
    relationship.relationshipType === RELATIONSHIP_TYPES.slide);
  if (master.targetPart !== view.masters[0].partPath ||
      view.presentation.masterReferences[0].relationshipId !== master.relationshipId ||
      slideRelationships.length !== expectedSlideParts.length ||
      !contentPartHasType(
        view,
        presProps.targetPart,
        "application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"
      ) ||
      !contentPartHasType(
        view,
        theme.targetPart,
        "application/vnd.openxmlformats-officedocument.theme+xml"
      )) {
    fail(code, `${pointer}/presentation`);
  }

  const masterRelationships = relationshipSet(
    view,
    master.targetPart,
    `${pointer}/master`,
    code
  );
  if (masterRelationships.relationships.length !== 2) fail(code, `${pointer}/master`);
  const masterLayout = oneRelationship(
    masterRelationships,
    RELATIONSHIP_TYPES.slideLayout,
    `${pointer}/master/layout`,
    code
  );
  const masterTheme = oneRelationship(
    masterRelationships,
    RELATIONSHIP_TYPES.theme,
    `${pointer}/master/theme`,
    code
  );
  if (masterLayout.targetPart !== view.layouts[0].partPath ||
      masterTheme.targetPart !== theme.targetPart ||
      view.masters[0].layoutReferences[0].relationshipId !== masterLayout.relationshipId) {
    fail(code, `${pointer}/master`);
  }

  const layoutRelationships = relationshipSet(
    view,
    masterLayout.targetPart,
    `${pointer}/layout`,
    code
  );
  const layoutMaster = oneRelationship(
    layoutRelationships,
    RELATIONSHIP_TYPES.slideMaster,
    `${pointer}/layout/master`,
    code
  );
  if (layoutRelationships.relationships.length !== 1 ||
      layoutMaster.targetPart !== master.targetPart) {
    fail(code, `${pointer}/layout`);
  }

  for (let index = 0; index < expectedSlideParts.length; index += 1) {
    const slidePointer = `${pointer}/slides/${index}`;
    const reference = view.presentation.slideReferences[index];
    const ownerRelationship = slideRelationships.find((relationship) =>
      relationship.relationshipId === reference.relationshipId);
    if (ownerRelationship?.targetPart !== expectedSlideParts[index]) {
      fail(code, slidePointer);
    }
    const relationships = relationshipSet(view, expectedSlideParts[index], slidePointer, code);
    const layout = oneRelationship(
      relationships,
      RELATIONSHIP_TYPES.slideLayout,
      `${slidePointer}/layout`,
      code
    );
    if (relationships.relationships.length !== 1 || layout.targetPart !== masterLayout.targetPart) {
      fail(code, slidePointer);
    }
  }
  const reachableContentParts = [
    PRESENTATION_PART,
    master.targetPart,
    presProps.targetPart,
    theme.targetPart,
    masterLayout.targetPart,
    ...expectedSlideParts
  ].sort(compareCodeUnits);
  const actualContentParts = view.contentParts
    .map((part) => part.partPath)
    .sort(compareCodeUnits);
  if (actualContentParts.length !== reachableContentParts.length ||
      actualContentParts.some((partPath, index) => partPath !== reachableContentParts[index])) {
    fail(code, `${pointer}/contentParts`);
  }
  return {
    layout: masterLayout.targetPart,
    master: master.targetPart,
    presProps: presProps.targetPart,
    theme: theme.targetPart
  };
}

function hasRelationshipAttribute(node) {
  if ([...node.attributes.values()].some((attribute) => attribute.namespaceURI === NS.r)) {
    return true;
  }
  return node.children.some(hasRelationshipAttribute);
}

function authenticateTargetSpecificNativeSlide(slide, index) {
  for (const profile of TARGET_SPECIFIC_NATIVE_PROFILES) {
    let authenticated;
    try {
      authenticated = profile.authenticate({
        archiveBytes: slide.archiveBytes,
        report: slide.report
      });
    } catch {
      continue;
    }
    if (authenticated.authority.artifactType !== profile.artifactType ||
        authenticated.authority.verificationProfile !== profile.verificationProfile ||
        authenticated.authority.publicationEligible !== false ||
        authenticated.authority.authenticatedPublicationProfile !== profile.publicationProfile) {
      fail(ERROR_CODES.SOURCE_MISMATCH, `/slides/${index}/report`);
    }
    const replayable = slide.report.layoutIr?.inputProfile === "bounded-slot-placement";
    return {
      artifactType: authenticated.authority.artifactType,
      archiveBytes: authenticated.archiveBytes,
      verificationArchiveBytes: authenticated.baseArchiveBytes,
      authority: authenticated.authority,
      targetSpecificNative: true,
      recordSource: replayable
        ? Object.freeze({
            buildType: profile.buildType,
            artifactType: authenticated.authority.artifactType,
            verificationProfile: authenticated.authority.verificationProfile,
            baseArtifactSha256: slide.report.baseOutputSha256,
            sourceSlidePart: slide.report.slidePart,
            layoutIr: slide.report.layoutIr,
            composedSlidePlan: slide.report.composedSlidePlan,
            diff: slide.report.diff,
            capabilityEvidence: profile.capabilityEvidence(slide.report)
          })
        : Object.freeze({
            buildType: profile.unreplayableBuildType,
            artifactType: authenticated.authority.artifactType
          })
    };
  }
  return null;
}

function authenticateSlideArtifact(slide, index) {
  try {
    const authority = authenticateCloneFillAssemblyArtifact({
      archiveBytes: slide.archiveBytes,
      report: slide.report
    });
    return {
      artifactType: "assembled-pptx",
      archiveBytes: slide.archiveBytes,
      verificationArchiveBytes: slide.archiveBytes,
      authority,
      targetSpecificNative: false,
      recordSource: Object.freeze({
        buildType: "clone-fill-source",
        artifactType: "assembled-pptx"
      })
    };
  } catch {
    // Target-specific native profiles are the only alternative admission.
  }
  const targetSpecific = authenticateTargetSpecificNativeSlide(slide, index);
  if (targetSpecific !== null) return targetSpecific;
  fail(ERROR_CODES.SOURCE_MISMATCH, `/slides/${index}/report`);
}

function inspectArtifact(slide, index) {
  const pointer = `/slides/${index}/archiveBytes`;
  const admitted = authenticateSlideArtifact(slide, index);
  let view;
  let parts;
  let verificationParts;
  try {
    view = buildSecureTemplatePackageView({
      sourceLocation: path.resolve(`/ordered-slide-${index + 1}.pptx`),
      archiveBytes: admitted.verificationArchiveBytes
    });
    parts = parseSecureZip(admitted.archiveBytes);
    verificationParts = admitted.targetSpecificNative
      ? parseSecureZip(admitted.verificationArchiveBytes)
      : parts;
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, pointer);
  }
  if (view.templateFormat !== "pptx" ||
      view.slides[0].partPath !== SOURCE_SLIDE_PART ||
      !parts.has(PRESENTATION_RELS_PART) || !parts.has(SOURCE_SLIDE_RELS_PART) ||
      !verificationParts.has(SOURCE_SLIDE_PART)) {
    fail(ERROR_CODES.SOURCE_MISMATCH, pointer);
  }
  if (admitted.targetSpecificNative) {
    const actualPaths = [...parts.keys()].sort(compareCodeUnits);
    const verificationPaths = [...verificationParts.keys()].sort(compareCodeUnits);
    if (actualPaths.length !== verificationPaths.length ||
        actualPaths.some((partPath, pathIndex) => partPath !== verificationPaths[pathIndex]) ||
        actualPaths.some((partPath) => partPath !== SOURCE_SLIDE_PART &&
          !Buffer.from(parts.get(partPath)).equals(verificationParts.get(partPath)))) {
      fail(ERROR_CODES.SOURCE_MISMATCH, `${pointer}/targetSpecificDiff`);
    }
  }
  const sharedTargets = validateClosedRelationshipGraph(
    view,
    [SOURCE_SLIDE_PART],
    `${pointer}/relationshipClosure`
  );
  try {
    if (hasRelationshipAttribute(parseStrictXml(parts.get(SOURCE_SLIDE_PART)).root)) {
      fail(ERROR_CODES.SOURCE_MISMATCH, `${pointer}/slideRelationshipAttributes`);
    }
  } catch (error) {
    if (error instanceof OrderedSlideAssemblyError) throw error;
    fail(ERROR_CODES.SOURCE_MISMATCH, pointer);
  }
  return {
    archiveBytes: admitted.archiveBytes,
    outputSlideId: semanticId(
      admitted.authority.outputSlideId,
      `/slides/${index}/report/outputSlideId`
    ),
    artifactType: admitted.artifactType,
    targetSpecificNative: admitted.targetSpecificNative,
    verificationSlideBytes: Buffer.from(verificationParts.get(SOURCE_SLIDE_PART)),
    view,
    parts,
    sharedTargets,
    artifactSha256: sha256(admitted.archiveBytes),
    recordSource: admitted.recordSource
  };
}

function assertSharedClosure(artifacts) {
  const base = artifacts[0];
  const basePaths = [...base.parts.keys()].sort(compareCodeUnits);
  for (let index = 1; index < artifacts.length; index += 1) {
    const candidate = artifacts[index];
    const pointer = `/slides/${index}/archiveBytes/sharedClosure`;
    const candidatePaths = [...candidate.parts.keys()].sort(compareCodeUnits);
    if (candidatePaths.length !== basePaths.length ||
        candidatePaths.some((partPath, pathIndex) => partPath !== basePaths[pathIndex]) ||
        candidate.view.presentation.slideSizeEmu.cx !== base.view.presentation.slideSizeEmu.cx ||
        candidate.view.presentation.slideSizeEmu.cy !== base.view.presentation.slideSizeEmu.cy ||
        Object.keys(base.sharedTargets).some((key) =>
          candidate.sharedTargets[key] !== base.sharedTargets[key])) {
      fail(ERROR_CODES.SOURCE_MISMATCH, pointer);
    }
    for (const partPath of basePaths) {
      if (partPath === SOURCE_SLIDE_PART || partPath === SOURCE_SLIDE_RELS_PART) continue;
      if (!Buffer.from(base.parts.get(partPath)).equals(candidate.parts.get(partPath))) {
        fail(ERROR_CODES.SOURCE_MISMATCH, pointer);
      }
    }
  }
}

function cloneXmlNode(node) {
  return {
    namespaceURI: node.namespaceURI,
    localName: node.localName,
    key: node.key,
    attributes: new Map([...node.attributes].map(([key, value]) => [key, { ...value }])),
    children: node.children.map(cloneXmlNode),
    text: node.text
  };
}

function makeElement(namespaceURI, localName, attributes = []) {
  const mappedAttributes = new Map();
  for (const [attributeNamespace, attributeLocalName, value] of attributes) {
    mappedAttributes.set(`${attributeNamespace}\u0000${attributeLocalName}`, {
      namespaceURI: attributeNamespace,
      localName: attributeLocalName,
      value
    });
  }
  return {
    namespaceURI,
    localName,
    key: `${namespaceURI}\u0000${localName}`,
    attributes: mappedAttributes,
    children: [],
    text: ""
  };
}

function attribute(node, namespaceURI, localName) {
  return node.attributes.get(`${namespaceURI}\u0000${localName}`);
}

function oneDirectChild(node, namespaceURI, localName, pointer) {
  const matches = node.children.filter((child) =>
    child.namespaceURI === namespaceURI && child.localName === localName);
  if (matches.length !== 1) fail(ERROR_CODES.SOURCE_MISMATCH, pointer);
  return matches[0];
}

function elementName(node, defaultNamespace) {
  if (node.namespaceURI === defaultNamespace) return node.localName;
  for (const prefix of ["a", "p", "r", "xml"]) {
    if (node.namespaceURI === NS[prefix]) return `${prefix}:${node.localName}`;
  }
  fail(ERROR_CODES.OUTPUT_INVALID, "/output/xml/namespace");
}

function attributeName(value) {
  if (value.namespaceURI === "") return value.localName;
  for (const prefix of ["r", "xml"]) {
    if (value.namespaceURI === NS[prefix]) return `${prefix}:${value.localName}`;
  }
  fail(ERROR_CODES.OUTPUT_INVALID, "/output/xml/attributeNamespace");
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeXml(value).replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function serializeNode(node, defaultNamespace, root = false) {
  const name = elementName(node, defaultNamespace);
  let declarations = "";
  if (root) {
    if (defaultNamespace === NS.contentTypes || defaultNamespace === NS.relationships) {
      declarations = ` xmlns="${defaultNamespace}"`;
    } else {
      declarations = ` xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"`;
    }
  }
  const attributes = [...node.attributes.values()]
    .map((value) => ` ${attributeName(value)}="${escapeAttribute(value.value)}"`)
    .join("");
  if (node.children.length === 0 && node.text.length === 0) {
    return `<${name}${declarations}${attributes}/>`;
  }
  return `<${name}${declarations}${attributes}>${escapeXml(node.text)}` +
    `${node.children.map((child) => serializeNode(child, defaultNamespace)).join("")}</${name}>`;
}

function serializeDocument(root) {
  const defaultNamespace = root.namespaceURI === NS.contentTypes ||
    root.namespaceURI === NS.relationships ? root.namespaceURI : "";
  return Buffer.from(`${XML_DECLARATION}${serializeNode(root, defaultNamespace, true)}\n`, "utf8");
}

function targetSlidePart(index) {
  return `ppt/slides/slide${index + 1}.xml`;
}

function targetSlideRelsPart(index) {
  return `ppt/slides/_rels/slide${index + 1}.xml.rels`;
}

function relativeTarget(ownerPart, targetPart) {
  const target = path.posix.relative(path.posix.dirname(ownerPart), targetPart);
  if (target.length === 0 || target.startsWith("../..") || target.startsWith("/")) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/slides/sharedClosure");
  }
  return target;
}

function relationshipNode(id, type, target) {
  return makeElement(NS.relationships, "Relationship", [
    ["", "Id", id],
    ["", "Type", type],
    ["", "Target", target]
  ]);
}

function rebuildPresentation(sourceBytes, slideCount) {
  const root = cloneXmlNode(parseStrictXml(sourceBytes).root);
  const masterList = oneDirectChild(root, NS.p, "sldMasterIdLst", "/presentation/masterList");
  const slideList = oneDirectChild(root, NS.p, "sldIdLst", "/presentation/slideList");
  if (masterList.children.length !== 1) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/presentation/masterList");
  }
  const masterRelationship = attribute(masterList.children[0], NS.r, "id");
  if (masterRelationship === undefined) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/presentation/masterList");
  }
  masterRelationship.value = "rId1";
  slideList.children = Array.from({ length: slideCount }, (_, index) =>
    makeElement(NS.p, "sldId", [
      ["", "id", String(256 + index)],
      [NS.r, "id", `rId${4 + index}`]
    ]));
  return serializeDocument(root);
}

function rebuildPresentationRelationships(sharedTargets, slideCount) {
  const root = makeElement(NS.relationships, "Relationships");
  root.children = [
    relationshipNode(
      "rId1",
      RELATIONSHIP_TYPES.slideMaster,
      relativeTarget(PRESENTATION_PART, sharedTargets.master)
    ),
    relationshipNode(
      "rId2",
      RELATIONSHIP_TYPES.presProps,
      relativeTarget(PRESENTATION_PART, sharedTargets.presProps)
    ),
    relationshipNode(
      "rId3",
      RELATIONSHIP_TYPES.theme,
      relativeTarget(PRESENTATION_PART, sharedTargets.theme)
    ),
    ...Array.from({ length: slideCount }, (_, index) => relationshipNode(
      `rId${4 + index}`,
      RELATIONSHIP_TYPES.slide,
      relativeTarget(PRESENTATION_PART, targetSlidePart(index))
    ))
  ];
  return serializeDocument(root);
}

function rebuildSlideRelationships(layoutPart, slideIndex) {
  const ownerPart = targetSlidePart(slideIndex);
  const root = makeElement(NS.relationships, "Relationships");
  root.children = [relationshipNode(
    "rId1",
    RELATIONSHIP_TYPES.slideLayout,
    relativeTarget(ownerPart, layoutPart)
  )];
  return serializeDocument(root);
}

function rebuildContentTypes(sourceBytes, slideCount) {
  const root = cloneXmlNode(parseStrictXml(sourceBytes).root);
  const defaults = root.children.filter((child) => child.localName === "Default");
  const overrides = root.children.filter((child) => child.localName === "Override" &&
    attribute(child, "", "ContentType")?.value !== SLIDE_CONTENT_TYPE);
  for (let index = 0; index < slideCount; index += 1) {
    overrides.push(makeElement(NS.contentTypes, "Override", [
      ["", "PartName", `/${targetSlidePart(index)}`],
      ["", "ContentType", SLIDE_CONTENT_TYPE]
    ]));
  }
  overrides.sort((left, right) => compareCodeUnits(
    attribute(left, "", "PartName")?.value ?? "",
    attribute(right, "", "PartName")?.value ?? ""
  ));
  root.children = [...defaults, ...overrides];
  return serializeDocument(root);
}

function packageDiff(sourceParts, outputParts, reasons) {
  const sourcePaths = [...sourceParts.keys()].sort(compareCodeUnits);
  const outputPaths = [...outputParts.keys()].sort(compareCodeUnits);
  const addedParts = outputPaths.filter((partPath) => !sourceParts.has(partPath));
  const removedParts = sourcePaths.filter((partPath) => !outputParts.has(partPath));
  const modifiedParts = sourcePaths.filter((partPath) => outputParts.has(partPath) &&
    !Buffer.from(sourceParts.get(partPath)).equals(outputParts.get(partPath)));
  const changedParts = [...addedParts, ...modifiedParts].sort(compareCodeUnits);
  const collateralChanges = [
    ...removedParts,
    ...changedParts.filter((partPath) => !reasons.has(partPath))
  ].sort(compareCodeUnits);
  return Object.freeze({
    addedParts: Object.freeze(addedParts),
    removedParts: Object.freeze(removedParts),
    modifiedParts: Object.freeze(modifiedParts),
    allowedChanges: Object.freeze(changedParts.filter((partPath) => reasons.has(partPath))
      .map((partPath) => Object.freeze({ partPath, reason: reasons.get(partPath) }))),
    collateralChanges: Object.freeze(collateralChanges)
  });
}

function verifyOutput(archiveBytes, slideRecords, sharedTargets, artifacts) {
  let outputParts;
  try {
    outputParts = parseSecureZip(archiveBytes);
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, "/output");
  }
  const verificationParts = new Map(
    [...outputParts].map(([partPath, bytes]) => [partPath, Buffer.from(bytes)])
  );
  for (let index = 0; index < slideRecords.length; index += 1) {
    const record = slideRecords[index];
    const artifact = artifacts[index];
    const expectedSlideBytes = artifact.parts.get(SOURCE_SLIDE_PART);
    if (expectedSlideBytes === undefined ||
        !Buffer.from(outputParts.get(record.partPath) ?? []).equals(expectedSlideBytes)) {
      fail(ERROR_CODES.OUTPUT_INVALID, `/output/slides/${index}/content`);
    }
    if (artifact.targetSpecificNative) {
      verificationParts.set(record.partPath, Buffer.from(artifact.verificationSlideBytes));
    }
  }
  let view;
  try {
    const verificationArchiveBytes = createDeterministicZip(verificationParts);
    view = buildSecureTemplatePackageView({
      sourceLocation: path.resolve("/ordered-deck-verification-shadow.pptx"),
      archiveBytes: verificationArchiveBytes
    });
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, "/output");
  }
  if (view.templateFormat !== "pptx" || view.slides.length !== slideRecords.length ||
      view.presentation.slideReferences.length !== slideRecords.length) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/output/slideCount");
  }
  const outputTargets = validateClosedRelationshipGraph(
    view,
    slideRecords.map((record) => record.partPath),
    "/output/relationshipClosure",
    ERROR_CODES.OUTPUT_INVALID
  );
  if (Object.keys(sharedTargets).some((key) => outputTargets[key] !== sharedTargets[key])) {
    fail(ERROR_CODES.OUTPUT_INVALID, "/output/relationshipClosure");
  }
  const presentationRelationships = relationshipSet(
    view,
    PRESENTATION_PART,
    "/output/presentationRelationships",
    ERROR_CODES.OUTPUT_INVALID
  );
  for (let index = 0; index < slideRecords.length; index += 1) {
    const record = slideRecords[index];
    const reference = view.presentation.slideReferences[index];
    const relationship = presentationRelationships.relationships.find((candidate) =>
      candidate.relationshipId === record.relationshipId);
    if (reference.sourceId !== record.presentationSlideId ||
        reference.relationshipId !== record.relationshipId ||
        relationship?.relationshipType !== RELATIONSHIP_TYPES.slide ||
        relationship.targetPart !== record.partPath ||
        !view.slides.some((slide) => slide.partPath === record.partPath)) {
      fail(ERROR_CODES.OUTPUT_INVALID, `/output/slides/${index}`);
    }
    const slideRelationships = relationshipSet(
      view,
      record.partPath,
      `/output/slides/${index}/relationships`,
      ERROR_CODES.OUTPUT_INVALID
    );
    if (slideRelationships.relationships.length !== 1 ||
        slideRelationships.relationships[0].relationshipId !== "rId1" ||
        slideRelationships.relationships[0].relationshipType !== RELATIONSHIP_TYPES.slideLayout ||
        slideRelationships.relationships[0].targetPart !== sharedTargets.layout) {
      fail(ERROR_CODES.OUTPUT_INVALID, `/output/slides/${index}/relationships`);
    }
  }
  return view;
}

/** @internal Bind one exact ordered output report to its deterministic bytes. */
export function authenticateOrderedSlideAssemblyArtifact(options) {
  const fields = closedRecord(options, "/artifact", ["archiveBytes", "report"]);
  if (!Buffer.isBuffer(fields.archiveBytes)) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/artifact/archiveBytes");
  }
  const authenticated = authenticOrderedAssemblyReports.get(fields.report);
  if (authenticated === undefined) {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/artifact/report");
  }
  const facts = authenticated.publicFacts;
  let byteLength;
  let snapshot;
  try {
    byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(fields.archiveBytes);
  } catch {
    fail(ERROR_CODES.ARGUMENT_INVALID, "/artifact/archiveBytes");
  }
  if (byteLength !== facts.outputBytes) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/archiveBytes");
  }
  try {
    snapshot = Buffer.from(fields.archiveBytes);
  } catch {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/archiveBytes");
  }
  if (sha256(snapshot) !== facts.outputSha256) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/artifact/archiveBytes");
  }
  return Object.freeze({
    archiveBytes: snapshot,
    authority: facts,
    candidateRecordFacts: authenticated.candidateRecordFacts
  });
}

/**
 * Combine a complete batch of already assembled one-slide PPTX artifacts into
 * one deterministic ordered deck. Every input is admitted before graph rebuild,
 * and the function has no publication side effect.
 */
export function assembleOrderedSlideDeck(options) {
  let capturedSlides;
  try {
    capturedSlides = captureSlides(options);
  } catch (error) {
    if (error instanceof OrderedSlideAssemblyError) throw error;
    fail(ERROR_CODES.ARGUMENT_INVALID, "/options");
  }
  const artifacts = capturedSlides.map(inspectArtifact);
  if (new Set(artifacts.map((artifact) => artifact.outputSlideId)).size !== artifacts.length) {
    fail(ERROR_CODES.SOURCE_MISMATCH, "/slides/report/outputSlideId");
  }
  assertSharedClosure(artifacts);

  const base = artifacts[0];
  const outputParts = new Map();
  for (const [partPath, bytes] of base.parts) {
    if (partPath === SOURCE_SLIDE_PART || partPath === SOURCE_SLIDE_RELS_PART) continue;
    outputParts.set(partPath, Buffer.from(bytes));
  }

  const slideRecords = artifacts.map((artifact, index) => {
    const partPath = targetSlidePart(index);
    const relationshipsPartPath = targetSlideRelsPart(index);
    outputParts.set(partPath, Buffer.from(artifact.parts.get(SOURCE_SLIDE_PART)));
    outputParts.set(
      relationshipsPartPath,
      rebuildSlideRelationships(base.sharedTargets.layout, index)
    );
    return Object.freeze({
      outputSlideId: artifact.outputSlideId,
      order: index + 1,
      partPath,
      relationshipsPartPath,
      presentationSlideId: 256 + index,
      relationshipId: `rId${4 + index}`,
      sourceArtifactSha256: artifact.artifactSha256
    });
  });

  outputParts.set(
    PRESENTATION_PART,
    rebuildPresentation(base.parts.get(PRESENTATION_PART), artifacts.length)
  );
  outputParts.set(
    PRESENTATION_RELS_PART,
    rebuildPresentationRelationships(base.sharedTargets, artifacts.length)
  );
  outputParts.set(
    "[Content_Types].xml",
    rebuildContentTypes(base.parts.get("[Content_Types].xml"), artifacts.length)
  );

  const reasons = new Map([
    ["[Content_Types].xml", "ordered-slide-content-types"],
    [PRESENTATION_PART, "ordered-slide-owner-list"],
    [PRESENTATION_RELS_PART, "ordered-slide-relationships"]
  ]);
  for (let index = 0; index < slideRecords.length; index += 1) {
    reasons.set(slideRecords[index].relationshipsPartPath, "normalized-slide-layout-relationship");
    if (index > 0) reasons.set(slideRecords[index].partPath, "cloned-slide-content");
  }
  const diff = packageDiff(base.parts, outputParts, reasons);
  if (diff.collateralChanges.length !== 0 || diff.removedParts.length !== 0) {
    fail(ERROR_CODES.COLLATERAL_CHANGE, "/diff");
  }

  let archiveBytes;
  try {
    archiveBytes = createDeterministicZip(outputParts);
  } catch {
    fail(ERROR_CODES.OUTPUT_INVALID, "/output");
  }
  verifyOutput(archiveBytes, slideRecords, base.sharedTargets, artifacts);

  const containsTargetSpecificNative = artifacts.some(
    (artifact) => artifact.targetSpecificNative
  );
  const report = Object.freeze({
    assemblyVersion: ORDERED_SLIDE_ASSEMBLY_VERSION,
    artifactType: "ordered-assembled-pptx",
    verificationProfile: containsTargetSpecificNative
      ? "authenticated-native-ordered-output"
      : "secure-generic-ordered-output",
    genericPublicationEligible: !containsTargetSpecificNative,
    containsTargetSpecificNative,
    outputBytes: archiveBytes.length,
    outputSha256: sha256(archiveBytes),
    slides: Object.freeze(slideRecords),
    diff
  });
  const publicFacts = Object.freeze({
    artifactType: report.artifactType,
    verificationProfile: report.verificationProfile,
    genericPublicationEligible: report.genericPublicationEligible,
    containsTargetSpecificNative: report.containsTargetSpecificNative,
    authenticatedPublicationProfile: containsTargetSpecificNative
      ? "native-containing-ordered-artifact-only"
      : null,
    outputBytes: report.outputBytes,
    outputSha256: report.outputSha256
  });
  const candidateSlides = Object.freeze(slideRecords.map((record, index) =>
    Object.freeze({
      slideId: record.outputSlideId,
      order: record.order,
      slidePart: record.partPath,
      relationshipsPartPath: record.relationshipsPartPath,
      presentationSlideId: record.presentationSlideId,
      relationshipId: record.relationshipId,
      sourceArtifactSha256: record.sourceArtifactSha256,
      sourceBuild: artifacts[index].recordSource
    })));
  const candidateRecordFacts = Object.freeze({
    assemblyVersion: report.assemblyVersion,
    baseArtifactSha256: slideRecords[0].sourceArtifactSha256,
    slides: candidateSlides,
    diff: report.diff
  });
  authenticOrderedAssemblyReports.set(report, Object.freeze({
    publicFacts,
    candidateRecordFacts
  }));
  return Object.freeze({ archiveBytes: Buffer.from(archiveBytes), report });
}
