import { createHash, createHmac } from "node:crypto";

import { selectDeckHypothesis } from "./deck-planner.mjs";
import { selectAndAssembleReviewedCloneFillPresentation } from
  "../layout-selection/reviewed-clone-fill-catalog.mjs";
import { createDeliveryReviewProfile } from
  "../visual-review-agent/review-v2-contract.mjs";
import { createDeterministicZip } from
  "../../packages/core/src/deterministic-zip.mjs";
import { assembleOrderedSlideDeck } from
  "../../packages/core/src/ordered-slide-assembly.mjs";
import { parseSecureZip, SECURE_ZIP_LIMITS } from
  "../../packages/core/src/secure-zip.mjs";

export const CONTROLLED_COMPARISON_VERSION = "0.1.0";

const ARM_COUNT = 6;
const SLIDE_COUNT = 3;
const SEED_BYTES = 32;
const SHA256 = /^[a-f0-9]{64}$/u;
const FORBIDDEN_BLIND_TOKENS = Object.freeze([
  "causal",
  "proof-led-decision",
  "restrained-generic",
  "subject-grounded",
  "topic-decorated",
  "permuted-order"
]);
const MATRIX_TOKENS = new WeakMap();
const MATRIX_STATES = new WeakMap();
const AUTHENTIC_RENDER_BATCHES = new WeakSet();
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

const NARRATIVES = Object.freeze([
  Object.freeze({ id: "causal", order: Object.freeze([0, 1, 2]) }),
  Object.freeze({ id: "permuted-order", order: Object.freeze([0, 2, 1]) })
]);

// Visible semantic wording is an experimental constant. Each grammar may
// encode these labels differently through position, type, scale, and color,
// but no arm receives an extra fact or more informative motif text.
const SHARED_MOTIF_VALUES = Object.freeze([
  "3/3 REVIEWS",
  "87/100 CONTROLS",
  "EDIT/SAVE | ACCESSIBILITY"
]);

const VISUAL_GRAMMARS = Object.freeze([
  Object.freeze({
    id: "restrained-generic",
    typeface: "Arial",
    theme: Object.freeze({
      dk1: "1E2329", lt1: "F7F5F0", dk2: "5A6068", lt2: "ECE9E2",
      accent1: "5C6F82", accent2: "87929D", accent3: "A16C52",
      accent4: "657A65", accent5: "8B6D86", accent6: "607D8B",
      hlink: "385E8D", folHlink: "6F5A7E"
    }),
    status: Object.freeze({
      title: Object.freeze({
        geometry: Object.freeze({ x: 914400, y: 1200000, cx: 10363200, cy: 1600000 }),
        size: 5000, bold: true, color: "tx1", alignment: "ctr", anchor: "ctr"
      }),
      body: Object.freeze({
        geometry: Object.freeze({ x: 1460000, y: 3380000, cx: 9272000, cy: 980000 }),
        size: 2200, bold: false, color: "tx1", alignment: "ctr", anchor: "ctr"
      })
    }),
    decision: Object.freeze({
      title: Object.freeze({
        geometry: Object.freeze({ x: 1100000, y: 1250000, cx: 9992000, cy: 2000000 }),
        size: 4200, bold: true, color: "tx1", alignment: "ctr", anchor: "ctr"
      }),
      body: Object.freeze({
        geometry: Object.freeze({ x: 4300000, y: 4050000, cx: 3592000, cy: 800000 }),
        size: 2300, bold: true, color: "accent1", alignment: "ctr", anchor: "ctr"
      })
    }),
    motif: Object.freeze({
      geometry: Object.freeze({ x: 4520000, y: 5350000, cx: 3152000, cy: 360000 }),
      size: 1200, bold: false, color: "accent1", alignment: "ctr", anchor: "ctr",
      values: SHARED_MOTIF_VALUES
    })
  }),
  Object.freeze({
    id: "subject-grounded",
    typeface: "Arial",
    theme: Object.freeze({
      dk1: "121A2A", lt1: "F4F7FB", dk2: "536174", lt2: "E5ECF5",
      accent1: "1D4ED8", accent2: "0F766E", accent3: "B45309",
      accent4: "475569", accent5: "7C3AED", accent6: "0369A1",
      hlink: "1D4ED8", folHlink: "6D28D9"
    }),
    status: Object.freeze({
      title: Object.freeze({
        geometry: Object.freeze({ x: 850000, y: 780000, cx: 4200000, cy: 2300000 }),
        size: 6200, bold: true, color: "accent1", alignment: "l", anchor: "ctr"
      }),
      body: Object.freeze({
        geometry: Object.freeze({ x: 5400000, y: 1120000, cx: 6000000, cy: 1450000 }),
        size: 2200, bold: false, color: "tx1", alignment: "l", anchor: "ctr"
      })
    }),
    decision: Object.freeze({
      title: Object.freeze({
        geometry: Object.freeze({ x: 850000, y: 950000, cx: 7600000, cy: 2500000 }),
        size: 4000, bold: true, color: "tx1", alignment: "l", anchor: "ctr"
      }),
      body: Object.freeze({
        geometry: Object.freeze({ x: 9000000, y: 1120000, cx: 2300000, cy: 1250000 }),
        size: 2500, bold: true, color: "accent1", alignment: "ctr", anchor: "ctr"
      })
    }),
    motif: Object.freeze({
      geometry: Object.freeze({ x: 5400000, y: 3180000, cx: 6000000, cy: 620000 }),
      size: 1700, bold: true, color: "accent1", alignment: "l", anchor: "ctr",
      values: SHARED_MOTIF_VALUES
    })
  }),
  Object.freeze({
    id: "topic-decorated",
    typeface: "Courier New",
    theme: Object.freeze({
      dk1: "16212C", lt1: "F4F8FC", dk2: "334155", lt2: "DCE5ED",
      accent1: "00566B", accent2: "8B4A00", accent3: "9F1239",
      accent4: "38BDF8", accent5: "A78BFA", accent6: "2DD4BF",
      hlink: "38BDF8", folHlink: "A78BFA"
    }),
    status: Object.freeze({
      title: Object.freeze({
        geometry: Object.freeze({ x: 700000, y: 1450000, cx: 10792000, cy: 1750000 }),
        size: 4800, bold: true, color: "accent1", alignment: "ctr", anchor: "ctr"
      }),
      body: Object.freeze({
        geometry: Object.freeze({ x: 1250000, y: 3370000, cx: 9692000, cy: 1050000 }),
        size: 2200, bold: false, color: "tx1", alignment: "ctr", anchor: "ctr"
      })
    }),
    decision: Object.freeze({
      title: Object.freeze({
        geometry: Object.freeze({ x: 700000, y: 1370000, cx: 10792000, cy: 2050000 }),
        size: 3900, bold: true, color: "accent1", alignment: "ctr", anchor: "ctr"
      }),
      body: Object.freeze({
        geometry: Object.freeze({ x: 4000000, y: 4000000, cx: 4192000, cy: 850000 }),
        size: 2400, bold: true, color: "accent2", alignment: "ctr", anchor: "ctr"
      })
    }),
    motif: Object.freeze({
      geometry: Object.freeze({ x: 350000, y: 330000, cx: 11492000, cy: 560000 }),
      size: 1900, bold: true, color: "accent2", alignment: "ctr", anchor: "ctr",
      values: SHARED_MOTIF_VALUES
    })
  })
]);

const BASE_THEME_COLORS = Object.freeze({
  dk1: "1F2937", lt1: "FFFFFF", dk2: "374151", lt2: "F3F4F6",
  accent1: "2563EB", accent2: "0F766E", accent3: "B45309",
  accent4: "7C3AED", accent5: "BE123C", accent6: "0369A1",
  hlink: "1D4ED8", folHlink: "6D28D9"
});

export class ControlledComparisonError extends TypeError {
  constructor(pointer) {
    super(`CONTROLLED_COMPARISON_INVALID at ${pointer}`);
    this.name = "ControlledComparisonError";
    this.code = "CONTROLLED_COMPARISON_INVALID";
    this.pointer = pointer;
  }
}

function fail(pointer) {
  throw new ControlledComparisonError(pointer);
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256Json(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value) ||
      ArrayBuffer.isView(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function closedRecord(value, pointer, expectedKeys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(pointer);
  let prototype;
  let descriptors;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(pointer);
  }
  if (prototype !== Object.prototype && prototype !== null) fail(pointer);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string") || keys.length !== expectedKeys.length) {
    fail(pointer);
  }
  const fields = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(`${pointer}/${key}`);
    }
    fields[key] = descriptor.value;
  }
  return fields;
}

function snapshotJson(value, pointer, state = { nodes: 0 }, depth = 0) {
  state.nodes += 1;
  if (state.nodes > 50_000 || depth > 128) fail(pointer);
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) fail(pointer);
    return value;
  }
  if (typeof value !== "object") fail(pointer);
  let prototype;
  let descriptors;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(pointer);
  }
  const isArray = Array.isArray(value);
  if (isArray ? prototype !== Array.prototype :
      prototype !== Object.prototype && prototype !== null) {
    fail(pointer);
  }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) fail(pointer);
  if (isArray) {
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) fail(pointer);
    return Array.from({ length }, (_, index) => {
      const descriptor = descriptors[String(index)];
      if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
        fail(`${pointer}/${index}`);
      }
      return snapshotJson(descriptor.value, `${pointer}/${index}`, state, depth + 1);
    });
  }
  const output = Object.create(null);
  for (const key of keys.sort()) {
    const descriptor = descriptors[key];
    if (!("value" in descriptor) || descriptor.enumerable !== true) fail(`${pointer}/${key}`);
    output[key] = snapshotJson(descriptor.value, `${pointer}/${key}`, state, depth + 1);
  }
  return output;
}

function snapshotBytes(value, pointer, maximum = SECURE_ZIP_LIMITS.maxArchiveBytes) {
  if (!(value instanceof Uint8Array)) fail(pointer);
  let buffer;
  let byteLength;
  let byteOffset;
  try {
    buffer = TYPED_ARRAY_BUFFER_GETTER.call(value);
    byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(value);
    byteOffset = TYPED_ARRAY_BYTE_OFFSET_GETTER.call(value);
  } catch {
    fail(pointer);
  }
  if (!Number.isSafeInteger(byteLength) || byteLength < 1 || byteLength > maximum ||
      !Number.isSafeInteger(byteOffset) || byteOffset < 0) {
    fail(pointer);
  }
  try {
    return Buffer.from(new Uint8Array(buffer, byteOffset, byteLength));
  } catch {
    fail(pointer);
  }
}

function snapshotSeed(value) {
  const seed = snapshotBytes(value, "/options/randomizationSeed", SEED_BYTES);
  if (seed.length !== SEED_BYTES) fail("/options/randomizationSeed");
  return seed;
}

function replaceOnce(source, before, after, pointer) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) fail(pointer);
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

function replaceFirst(source, before, after, pointer) {
  const first = source.indexOf(before);
  if (first < 0) fail(pointer);
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function geometryXml(geometry) {
  return `<a:off x="${geometry.x}" y="${geometry.y}"/>\n            ` +
    `<a:ext cx="${geometry.cx}" cy="${geometry.cy}"/>`;
}

function runAttributes(style) {
  return `lang="en-US" sz="${style.size}"${style.bold ? " b=\"1\"" : ""}`;
}

function motifShapeXml(grammar, slideIndex) {
  const style = grammar.motif;
  return `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="4" name="Synthetic Motif"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            ${geometryXml(style.geometry)}
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
          <a:ln><a:noFill/></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="${style.anchor}"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="${style.alignment}"/>
            <a:r>
              <a:rPr ${runAttributes(style)}>
                <a:solidFill><a:schemeClr val="${style.color}"/></a:solidFill>
                <a:latin typeface="${grammar.typeface}"/>
              </a:rPr>
              <a:t>${escapeXml(style.values[slideIndex])}</a:t>
            </a:r>
            <a:endParaRPr lang="en-US"/>
          </a:p>
        </p:txBody>
      </p:sp>`;
}

function rewriteSlideXml(source, grammar, slideIndex, slideFunction) {
  const style = grammar[slideFunction];
  if (style === undefined) fail("/visualGrammar/function");
  let slide = source;
  slide = replaceOnce(
    slide,
    '<a:off x="914400" y="1285875"/>\n            <a:ext cx="10363200" cy="1143000"/>',
    geometryXml(style.title.geometry),
    "/baseSource/slide/titleGeometry"
  );
  slide = replaceOnce(
    slide,
    '<a:off x="1371600" y="2971800"/>\n            <a:ext cx="9448800" cy="914400"/>',
    geometryXml(style.body.geometry),
    "/baseSource/slide/bodyGeometry"
  );
  slide = replaceOnce(
    slide,
    'lang="en-US" sz="2800" b="1"',
    runAttributes(style.title),
    "/baseSource/slide/titleTypography"
  );
  slide = replaceOnce(
    slide,
    'lang="en-US" sz="1600"',
    runAttributes(style.body),
    "/baseSource/slide/bodyTypography"
  );
  slide = replaceFirst(slide, '<a:schemeClr val="tx1"/>',
    `<a:schemeClr val="${style.title.color}"/>`, "/baseSource/slide/titleColor");
  slide = replaceFirst(slide, '<a:schemeClr val="tx2"/>',
    `<a:schemeClr val="${style.body.color}"/>`, "/baseSource/slide/bodyColor");
  slide = replaceFirst(slide, '<a:bodyPr anchor="ctr"/>',
    `<a:bodyPr anchor="${style.title.anchor}"/>`, "/baseSource/slide/titleAnchor");
  slide = replaceFirst(slide, '<a:bodyPr anchor="ctr"/>',
    `<a:bodyPr anchor="${style.body.anchor}"/>`, "/baseSource/slide/bodyAnchor");
  slide = replaceFirst(slide, '<a:pPr algn="ctr"/>',
    `<a:pPr algn="${style.title.alignment}"/>`, "/baseSource/slide/titleAlignment");
  slide = replaceFirst(slide, '<a:pPr algn="ctr"/>',
    `<a:pPr algn="${style.body.alignment}"/>`, "/baseSource/slide/bodyAlignment");
  slide = replaceFirst(slide, '<a:latin typeface="Synthetic Sans"/>',
    `<a:latin typeface="${grammar.typeface}"/>`, "/baseSource/slide/titleTypeface");
  slide = replaceFirst(slide, '<a:latin typeface="Synthetic Sans"/>',
    `<a:latin typeface="${grammar.typeface}"/>`, "/baseSource/slide/bodyTypeface");
  slide = replaceOnce(
    slide,
    "\n    </p:spTree>",
    `${motifShapeXml(grammar, slideIndex)}\n    </p:spTree>`,
    "/baseSource/slide/motif"
  );
  return slide;
}

function rewriteThemeXml(source, grammar) {
  let theme = source;
  for (const [role, baseValue] of Object.entries(BASE_THEME_COLORS)) {
    theme = replaceOnce(
      theme,
      `<a:${role}><a:srgbClr val="${baseValue}"/></a:${role}>`,
      `<a:${role}><a:srgbClr val="${grammar.theme[role]}"/></a:${role}>`,
      `/baseSource/theme/${role}`
    );
  }
  theme = replaceFirst(theme, '<a:latin typeface="Synthetic Sans"/>',
    `<a:latin typeface="${grammar.typeface}"/>`, "/baseSource/theme/majorTypeface");
  theme = replaceFirst(theme, '<a:latin typeface="Synthetic Sans"/>',
    `<a:latin typeface="${grammar.typeface}"/>`, "/baseSource/theme/minorTypeface");
  return theme;
}

function makeSyntheticSource({ baseArchiveBytes, baseTemplateIndex, grammar, slideIndex, brief }) {
  let parts;
  try {
    parts = new Map([...parseSecureZip(baseArchiveBytes)]
      .map(([partPath, bytes]) => [partPath, Buffer.from(bytes)]));
  } catch {
    fail("/options/baseSourceArchiveBytes");
  }
  const slidePath = "ppt/slides/slide1.xml";
  const themePath = "ppt/theme/theme1.xml";
  if (!parts.has(slidePath) || !parts.has(themePath)) fail("/options/baseSourceArchiveBytes");
  parts.set(slidePath, Buffer.from(rewriteSlideXml(
    parts.get(slidePath).toString("utf8"),
    grammar,
    slideIndex,
    brief.function
  ), "utf8"));
  parts.set(themePath, Buffer.from(rewriteThemeXml(
    parts.get(themePath).toString("utf8"),
    grammar
  ), "utf8"));
  let archiveBytes;
  try {
    archiveBytes = createDeterministicZip(parts);
  } catch {
    fail("/sourceTemplate");
  }
  const archiveSha256 = sha256Bytes(archiveBytes);
  const templateIndex = structuredClone(baseTemplateIndex);
  const opaqueStem = `p3-${archiveSha256.slice(0, 16)}`;
  templateIndex.templateIndexId = `${opaqueStem}-template-index`;
  templateIndex.templateProfileId = `${opaqueStem}-template-profile`;
  templateIndex.templateSha256 = archiveSha256;
  templateIndex.slides[0].shapes[0].geometry = { ...grammar[brief.function].title.geometry };
  templateIndex.slides[0].shapes[1].geometry = { ...grammar[brief.function].body.geometry };
  templateIndex.slides[0].shapes.push({
    shapeKey: "shape-3",
    sourceId: 4,
    kind: "text-box",
    geometry: { ...grammar.motif.geometry }
  });
  return {
    archiveBytes,
    templateIndex: deepFreeze(templateIndex),
    archiveSha256,
    opaqueStem
  };
}

function makeReview(source, brief) {
  return {
    catalogVersion: "0.1.0",
    templateIndexId: source.templateIndex.templateIndexId,
    templateSha256: source.archiveSha256,
    profiles: [{
      layoutId: `${source.opaqueStem}-layout`,
      sourceSlideKey: "slide-1",
      functions: [brief.function],
      slots: [
        {
          slotId: `${source.opaqueStem}-primary`,
          sourceShapeKey: "shape-1",
          cloneFillRole: "title",
          acceptsRoles: ["takeaway"],
          kind: brief.units[0].kind,
          minUnits: 1,
          maxUnits: 1,
          capacity: { maxChars: 256 }
        },
        {
          slotId: `${source.opaqueStem}-supporting`,
          sourceShapeKey: "shape-2",
          cloneFillRole: "body",
          acceptsRoles: ["evidence"],
          kind: brief.units[1].kind,
          minUnits: 1,
          maxUnits: 1,
          capacity: { maxChars: 256 }
        }
      ]
    }]
  };
}

function opaqueBrief(sourceBrief, slideIndex) {
  const slideStem = `unit-${String(slideIndex + 1).padStart(2, "0")}`;
  const units = sourceBrief.units.map((unit, unitIndex) => ({
    ...unit,
    unitId: `${slideStem}-${unitIndex === 0 ? "primary" : "support"}`,
    content: typeof unit.content === "object" && unit.content !== null
      ? { ...unit.content }
      : unit.content
  }));
  return {
    briefVersion: sourceBrief.briefVersion,
    slideId: slideStem,
    function: sourceBrief.function,
    audienceGoal: sourceBrief.audienceGoal,
    availableAssetIds: [],
    evidencePolicy: sourceBrief.evidencePolicy,
    primaryTakeawayUnitId: units[0].unitId,
    units
  };
}

function assembleVisualSlideSet(baseArchiveBytes, baseTemplateIndex, grammar, selectedCandidate) {
  return selectedCandidate.slideContracts.map((contract, slideIndex) => {
    const brief = opaqueBrief(contract.brief, slideIndex);
    const source = makeSyntheticSource({
      baseArchiveBytes,
      baseTemplateIndex,
      grammar,
      slideIndex,
      brief
    });
    let assembled;
    try {
      assembled = selectAndAssembleReviewedCloneFillPresentation({
        brief,
        outputSlideId: brief.slideId,
        review: makeReview(source, brief),
        sourceArchiveBytes: source.archiveBytes,
        templateIndex: source.templateIndex
      });
    } catch {
      fail(`/assembly/slides/${slideIndex}`);
    }
    return Object.freeze({
      logicalIndex: slideIndex,
      plannedDensity: contract.deliveryDensity,
      semanticPayloadSha256: sha256Json({
        function: brief.function,
        motifText: grammar.motif.values[slideIndex],
        primaryTakeawayUnitId: brief.primaryTakeawayUnitId,
        units: brief.units
      }),
      sourceTemplateSha256: source.archiveSha256,
      archiveBytes: Buffer.from(assembled.archiveBytes),
      archiveSha256: assembled.report.outputSha256,
      report: assembled.report
    });
  });
}

function scanBlindArchive(archiveBytes) {
  let parts;
  try {
    parts = parseSecureZip(archiveBytes);
  } catch {
    fail("/blindArchive");
  }
  for (const [partPath, bytes] of parts) {
    const haystack = `${partPath}\n${Buffer.from(bytes).toString("utf8")}`.toLowerCase();
    if (FORBIDDEN_BLIND_TOKENS.some((token) => haystack.includes(token))) {
      fail("/blindArchive/semanticLeak");
    }
  }
}

function hmac(seed, value) {
  return createHmac("sha256", seed).update(value, "utf8").digest("hex");
}

function sortByHmac(values, seed, domain, valueKey = (value) => value) {
  return [...values].sort((left, right) => {
    const leftDigest = hmac(seed, `${domain}\u0000${valueKey(left)}`);
    const rightDigest = hmac(seed, `${domain}\u0000${valueKey(right)}`);
    return leftDigest < rightDigest ? -1 : leftDigest > rightDigest ? 1 : 0;
  });
}

function makeInternalArms(baseArchiveBytes, baseTemplateIndex, selectedCandidate) {
  const slideSets = new Map(VISUAL_GRAMMARS.map((grammar) => [
    grammar.id,
    assembleVisualSlideSet(baseArchiveBytes, baseTemplateIndex, grammar, selectedCandidate)
  ]));
  return NARRATIVES.flatMap((narrative) => VISUAL_GRAMMARS.map((grammar) => {
    const visualSlides = slideSets.get(grammar.id);
    const orderedSlides = narrative.order.map((index) => visualSlides[index]);
    let assembled;
    try {
      assembled = assembleOrderedSlideDeck({
        slides: orderedSlides.map((slide) => ({
          archiveBytes: slide.archiveBytes,
          report: slide.report
        }))
      });
    } catch {
      fail("/assembly/deck");
    }
    scanBlindArchive(assembled.archiveBytes);
    return Object.freeze({
      internalId: `${narrative.id}--${grammar.id}`,
      narrativeId: narrative.id,
      visualGrammarId: grammar.id,
      order: [...narrative.order],
      semanticSequenceSha256: sha256Json(orderedSlides.map((slide) =>
        slide.semanticPayloadSha256)),
      semanticSetSha256: sha256Json(orderedSlides.map((slide) =>
        slide.semanticPayloadSha256).sort()),
      sourceTemplateSetSha256: sha256Json(orderedSlides.map((slide) =>
        slide.sourceTemplateSha256).sort()),
      orderedSlides,
      archiveBytes: Buffer.from(assembled.archiveBytes),
      archiveSha256: assembled.report.outputSha256,
      report: assembled.report
    });
  }));
}

function makeBlindCandidates(internalArms, seed) {
  const randomized = sortByHmac(
    internalArms,
    seed,
    "p3-candidate-order-v1",
    (arm) => `${arm.internalId}\u0000${arm.archiveSha256}`
  );
  const mapping = new Map();
  const candidates = randomized.map((arm, index) => {
    const blindLabel = `blind-${String(index + 1).padStart(2, "0")}`;
    mapping.set(arm.internalId, blindLabel);
    const slides = arm.orderedSlides.map((slide, slideIndex) => Object.freeze({
      blindSlideId: `${blindLabel}-slide-${String(slideIndex + 1).padStart(2, "0")}`,
      plannedDensity: slide.plannedDensity,
      archiveBytes: Buffer.from(slide.archiveBytes),
      archiveSha256: slide.archiveSha256
    }));
    return Object.freeze({
      candidateVersion: CONTROLLED_COMPARISON_VERSION,
      candidateType: "blind-controlled-render-candidate",
      blindLabel,
      archiveBytes: Buffer.from(arm.archiveBytes),
      archiveSha256: arm.archiveSha256,
      slideCount: slides.length,
      slides: Object.freeze(slides)
    });
  });
  return { candidates: Object.freeze(candidates), mapping };
}

function makeReviewCells(candidates) {
  return Object.freeze(candidates.flatMap((candidate) => ["live-room", "leave-behind"]
    .map((deliveryMode) => {
      const deliveryProfile = createDeliveryReviewProfile({
        deliveryMode,
        slides: candidate.slides.map((slide) => ({
          slideId: slide.blindSlideId,
          plannedDensity: slide.plannedDensity,
          messageSlide: true
        }))
      });
      return Object.freeze({
        reviewCellId: `${candidate.blindLabel}-${deliveryMode}`,
        blindLabel: candidate.blindLabel,
        archiveSha256: candidate.archiveSha256,
        deliveryProfile
      });
    })));
}

function makeReviewOrders(candidates, seed) {
  return Object.freeze([1, 2, 3].flatMap((reviewerIndex) =>
    ["live-room", "leave-behind"].map((deliveryMode) => Object.freeze({
      reviewerSlot: `reviewer-${reviewerIndex}`,
      deliveryMode,
      blindLabels: Object.freeze(sortByHmac(
        candidates.map((candidate) => candidate.blindLabel),
        seed,
        `p3-review-order-v1\u0000${reviewerIndex}\u0000${deliveryMode}`
      ))
    }))));
}

function makeContrastReceipt(internalArms, mapping) {
  const narrativePairs = VISUAL_GRAMMARS.map((grammar, index) => {
    const arms = NARRATIVES.map((narrative) => internalArms.find((arm) =>
      arm.narrativeId === narrative.id && arm.visualGrammarId === grammar.id));
    if (arms.some((arm) => arm === undefined) ||
        new Set(arms.map((arm) => arm.semanticSetSha256)).size !== 1 ||
        new Set(arms.map((arm) => arm.sourceTemplateSetSha256)).size !== 1 ||
        new Set(arms.map((arm) => arm.semanticSequenceSha256)).size !== 2) {
      fail("/invariants/narrativePairs");
    }
    return {
      pairId: `narrative-pair-${index + 1}`,
      blindLabels: arms.map((arm) => mapping.get(arm.internalId)).sort(),
      semanticSetSha256: arms[0].semanticSetSha256,
      sourceTemplateSetSha256: arms[0].sourceTemplateSetSha256
    };
  });
  const visualTriplets = NARRATIVES.map((narrative, index) => {
    const arms = VISUAL_GRAMMARS.map((grammar) => internalArms.find((arm) =>
      arm.narrativeId === narrative.id && arm.visualGrammarId === grammar.id));
    if (arms.some((arm) => arm === undefined) ||
        new Set(arms.map((arm) => arm.semanticSequenceSha256)).size !== 1 ||
        new Set(arms.map((arm) => arm.sourceTemplateSetSha256)).size !== 3) {
      fail("/invariants/visualTriplets");
    }
    return {
      tripletId: `visual-triplet-${index + 1}`,
      blindLabels: arms.map((arm) => mapping.get(arm.internalId)).sort(),
      semanticSequenceSha256: arms[0].semanticSequenceSha256
    };
  });
  return deepFreeze({ narrativePairs, visualTriplets });
}

/**
 * Build one complete 2 × 3 controlled matrix from a single authenticated P1
 * snapshot. The caller cannot inject arms, stories, visual treatments, repair
 * budgets, or postprocessors. Delivery is a review context over identical
 * pixels, not a second deck-generation path.
 */
export function prepareControlledComparisonMatrix(options) {
  const fields = closedRecord(options, "/options", [
    "approvedPlanningAcceptance",
    "baseSourceArchiveBytes",
    "baseTemplateIndex",
    "evidenceInventory",
    "planningAcceptance",
    "randomizationSeed",
    "rawBrief",
    "templateProfile"
  ]);
  const captured = {
    approvedPlanningAcceptance: snapshotJson(
      fields.approvedPlanningAcceptance,
      "/options/approvedPlanningAcceptance"
    ),
    baseSourceArchiveBytes: snapshotBytes(
      fields.baseSourceArchiveBytes,
      "/options/baseSourceArchiveBytes"
    ),
    baseTemplateIndex: snapshotJson(fields.baseTemplateIndex, "/options/baseTemplateIndex"),
    evidenceInventory: snapshotJson(fields.evidenceInventory, "/options/evidenceInventory"),
    planningAcceptance: snapshotJson(fields.planningAcceptance, "/options/planningAcceptance"),
    randomizationSeed: snapshotSeed(fields.randomizationSeed),
    rawBrief: snapshotJson(fields.rawBrief, "/options/rawBrief"),
    templateProfile: snapshotJson(fields.templateProfile, "/options/templateProfile")
  };
  let selection;
  try {
    selection = selectDeckHypothesis({
      approvedAcceptance: captured.approvedPlanningAcceptance,
      evidenceInventory: captured.evidenceInventory,
      planningAcceptance: captured.planningAcceptance,
      rawBrief: captured.rawBrief,
      templateProfile: captured.templateProfile
    });
  } catch {
    fail("/planningSelection");
  }
  if (selection.selectionStatus !== "externally-approved" ||
      selection.assemblyStatus !== "eligible" || selection.planningReceipt === null ||
      selection.selectedCandidate === null ||
      !SHA256.test(selection.selectedCandidate.rawInputSha256) ||
      selection.selectedCandidate.rawInputSha256 !== selection.planningReceipt.rawInputSha256) {
    fail("/planningSelection");
  }
  const internalArms = makeInternalArms(
    captured.baseSourceArchiveBytes,
    captured.baseTemplateIndex,
    selection.selectedCandidate
  );
  if (internalArms.length !== ARM_COUNT ||
      internalArms.some((arm) => arm.orderedSlides.length !== SLIDE_COUNT) ||
      new Set(internalArms.map((arm) => arm.archiveSha256)).size !== ARM_COUNT) {
    fail("/matrix/arms");
  }
  const { candidates, mapping } = makeBlindCandidates(internalArms, captured.randomizationSeed);
  const reviewCells = makeReviewCells(candidates);
  if (reviewCells.length !== ARM_COUNT * 2 ||
      new Set(reviewCells.map((cell) => cell.reviewCellId)).size !== ARM_COUNT * 2) {
    fail("/matrix/reviewCells");
  }
  const reviewOrders = makeReviewOrders(candidates, captured.randomizationSeed);
  const contrastReceipt = makeContrastReceipt(internalArms, mapping);
  const seedCommitmentSha256 = sha256Bytes(captured.randomizationSeed);
  const receiptCore = {
    matrixVersion: CONTROLLED_COMPARISON_VERSION,
    matrixType: "blind-controlled-comparison-matrix",
    evidenceScope: "simulated-review-only",
    rawInputSha256: selection.planningReceipt.rawInputSha256,
    planningReceiptSha256: selection.planningReceipt.receiptSha256,
    seedCommitmentSha256,
    armCount: candidates.length,
    reviewCellCount: reviewCells.length,
    candidateBindings: candidates.map((candidate) => ({
      blindLabel: candidate.blindLabel,
      archiveSha256: candidate.archiveSha256,
      slideArtifactSha256s: candidate.slides.map((slide) => slide.archiveSha256)
    })),
    deliveryBindings: reviewCells.map((cell) => ({
      reviewCellId: cell.reviewCellId,
      blindLabel: cell.blindLabel,
      archiveSha256: cell.archiveSha256,
      deliveryProfileSha256: cell.deliveryProfile.profileSha256
    })),
    contrastReceipt
  };
  const matrixReceipt = deepFreeze({
    ...receiptCore,
    matrixReceiptSha256: sha256Json(receiptCore)
  });
  const matrixToken = Object.freeze(Object.create(null));
  MATRIX_TOKENS.set(matrixToken, Object.freeze({
    matrixReceiptSha256: matrixReceipt.matrixReceiptSha256,
    matrixReceipt,
    candidates,
    factorMapping: Object.freeze(internalArms.map((arm) => Object.freeze({
      blindLabel: mapping.get(arm.internalId),
      narrativeId: arm.narrativeId,
      visualGrammarId: arm.visualGrammarId,
      archiveSha256: arm.archiveSha256
    })))
  }));
  MATRIX_STATES.set(matrixToken, "prepared");
  return Object.freeze({
    matrixVersion: CONTROLLED_COMPARISON_VERSION,
    evidenceScope: "simulated-review-only",
    candidates,
    reviewCells,
    reviewOrders,
    contrastReceipt,
    matrixReceipt,
    matrixToken
  });
}

/**
 * Consume one authentic matrix into one all-candidate render batch. This is a
 * one-shot handoff: selective arm rendering, caller-rebuilt receipts, mutated
 * bytes, and token replay are rejected before any filesystem work begins.
 */
export function consumeControlledComparisonRenderBatch(options) {
  const fields = closedRecord(options, "/options", [
    "candidates", "matrixReceipt", "matrixToken"
  ]);
  const authority = MATRIX_TOKENS.get(fields.matrixToken);
  if (authority === undefined || MATRIX_STATES.get(fields.matrixToken) !== "prepared" ||
      fields.candidates !== authority.candidates || fields.matrixReceipt !== authority.matrixReceipt) {
    fail("/options/matrixToken");
  }
  if (fields.candidates.length !== ARM_COUNT ||
      fields.matrixReceipt.matrixReceiptSha256 !== authority.matrixReceiptSha256) {
    fail("/options/candidates");
  }
  for (let index = 0; index < fields.candidates.length; index += 1) {
    const candidate = fields.candidates[index];
    const binding = fields.matrixReceipt.candidateBindings[index];
    if (candidate.blindLabel !== binding.blindLabel ||
        candidate.archiveSha256 !== binding.archiveSha256 ||
        sha256Bytes(candidate.archiveBytes) !== binding.archiveSha256 ||
        candidate.slides.length !== SLIDE_COUNT ||
        candidate.slides.some((slide, slideIndex) =>
          slide.archiveSha256 !== binding.slideArtifactSha256s[slideIndex] ||
          sha256Bytes(slide.archiveBytes) !== slide.archiveSha256)) {
      fail(`/options/candidates/${index}`);
    }
  }
  MATRIX_STATES.set(fields.matrixToken, "render-consumed");
  const batchCore = {
    renderBatchVersion: CONTROLLED_COMPARISON_VERSION,
    renderBatchType: "controlled-comparison-render-batch",
    evidenceScope: "simulated-review-only",
    matrixReceiptSha256: authority.matrixReceiptSha256,
    candidates: fields.candidates.map((candidate) => ({
      blindLabel: candidate.blindLabel,
      archiveSha256: candidate.archiveSha256,
      slideArtifactSha256s: candidate.slides.map((slide) => slide.archiveSha256)
    }))
  };
  const renderBatchReceipt = deepFreeze({
    ...batchCore,
    renderBatchReceiptSha256: sha256Json(batchCore)
  });
  const renderBatch = Object.freeze({
    renderBatchVersion: CONTROLLED_COMPARISON_VERSION,
    evidenceScope: "simulated-review-only",
    renderBatchReceipt,
    candidates: Object.freeze(fields.candidates.map((candidate) => Object.freeze({
      blindLabel: candidate.blindLabel,
      archiveBytes: Buffer.from(candidate.archiveBytes),
      archiveSha256: candidate.archiveSha256,
      slides: Object.freeze(candidate.slides.map((slide) => Object.freeze({
        blindSlideId: slide.blindSlideId,
        archiveBytes: Buffer.from(slide.archiveBytes),
        archiveSha256: slide.archiveSha256
      })))
    })))
  });
  AUTHENTIC_RENDER_BATCHES.add(renderBatch);
  return renderBatch;
}

/** Internal lab bridge used by the render harness; it returns fresh byte copies. */
export function captureAuthenticatedControlledRenderBatch(renderBatch) {
  if (!AUTHENTIC_RENDER_BATCHES.has(renderBatch)) fail("/renderBatch");
  for (let index = 0; index < renderBatch.candidates.length; index += 1) {
    const candidate = renderBatch.candidates[index];
    if (sha256Bytes(candidate.archiveBytes) !== candidate.archiveSha256 ||
        candidate.slides.some((slide) => sha256Bytes(slide.archiveBytes) !== slide.archiveSha256)) {
      fail(`/renderBatch/candidates/${index}`);
    }
  }
  return Object.freeze({
    renderBatchReceipt: renderBatch.renderBatchReceipt,
    candidates: Object.freeze(renderBatch.candidates.map((candidate) => Object.freeze({
      blindLabel: candidate.blindLabel,
      archiveBytes: Buffer.from(candidate.archiveBytes),
      archiveSha256: candidate.archiveSha256,
      slides: Object.freeze(candidate.slides.map((slide) => Object.freeze({
        blindSlideId: slide.blindSlideId,
        archiveBytes: Buffer.from(slide.archiveBytes),
        archiveSha256: slide.archiveSha256
      })))
    })))
  });
}
