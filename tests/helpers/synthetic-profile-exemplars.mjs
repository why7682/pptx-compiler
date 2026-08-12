import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { createDeterministicZip } from "../../packages/core/src/deterministic-zip.mjs";
import { parseSecureZip } from "../../packages/core/src/secure-zip.mjs";
import { buildSyntheticFixtures } from "../../scripts/generate-synthetic-fixtures.mjs";

const baseTemplateIndex = JSON.parse(await readFile(
  new URL("../../fixtures/inspection/expected-potx-template-index.json", import.meta.url),
  "utf8"
));
const reviewedAcceptance = JSON.parse(await readFile(
  new URL("../../fixtures/profile-induction/reviewed-acceptance.json", import.meta.url),
  "utf8"
));
const fixtureBuild = await buildSyntheticFixtures();
const baseArchive = fixtureBuild.archives.find((archive) => archive.variant === "potx");

function replaceOnce(source, before, after) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error("synthetic-exemplar-replacement-mismatch");
  }
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

function geometryXml(geometry) {
  return `<a:off x="${geometry.x}" y="${geometry.y}"/>\n            ` +
    `<a:ext cx="${geometry.cx}" cy="${geometry.cy}"/>`;
}

function makeArchive({ firstGeometry, firstRunProperties, secondGeometry, secondRunProperties }) {
  const parts = new Map([...parseSecureZip(baseArchive.bytes)]
    .map(([partPath, bytes]) => [partPath, Buffer.from(bytes)]));
  const slidePath = "ppt/slides/slide1.xml";
  let slide = parts.get(slidePath).toString("utf8");
  slide = replaceOnce(
    slide,
    '<a:off x="914400" y="1285875"/>\n            <a:ext cx="10363200" cy="1143000"/>',
    geometryXml(firstGeometry)
  );
  slide = replaceOnce(
    slide,
    '<a:off x="1371600" y="2971800"/>\n            <a:ext cx="9448800" cy="914400"/>',
    geometryXml(secondGeometry)
  );
  slide = replaceOnce(slide, 'lang="en-US" sz="2800" b="1"', firstRunProperties);
  slide = replaceOnce(slide, 'lang="en-US" sz="1600"', secondRunProperties);
  parts.set(slidePath, Buffer.from(slide, "utf8"));
  return createDeterministicZip(parts);
}

function makeIndex(exemplarId, archiveBytes, firstGeometry, secondGeometry) {
  const index = structuredClone(baseTemplateIndex);
  index.templateIndexId = `${exemplarId}-template-index`;
  index.templateProfileId = `${exemplarId}-template-profile`;
  index.templateSha256 = createHash("sha256").update(archiveBytes).digest("hex");
  index.slides[0].shapes[0].geometry = { ...firstGeometry };
  index.slides[0].shapes[1].geometry = { ...secondGeometry };
  return index;
}

function buildExemplar(definition) {
  const sourceArchiveBytes = makeArchive(definition);
  return {
    exemplarId: definition.exemplarId,
    sourceArchiveBytes,
    templateIndex: makeIndex(
      definition.exemplarId,
      sourceArchiveBytes,
      definition.firstGeometry,
      definition.secondGeometry
    )
  };
}

const definitions = [
  {
    exemplarId: "decision-focus",
    firstGeometry: { x: 914400, y: 685800, cx: 10363200, cy: 1714500 },
    secondGeometry: { x: 1371600, y: 3657600, cx: 9448800, cy: 1143000 },
    firstRunProperties: 'lang="en-US" sz="4400" b="1"',
    secondRunProperties: 'lang="en-US" sz="2000"'
  },
  {
    exemplarId: "status-focus",
    firstGeometry: { x: 1371600, y: 4343400, cx: 9448800, cy: 914400 },
    secondGeometry: { x: 914400, y: 914400, cx: 10363200, cy: 2057400 },
    firstRunProperties: 'lang="en-US" sz="2400"',
    secondRunProperties: 'lang="en-US" sz="4800" b="1"'
  },
  {
    exemplarId: "ambiguous-balance",
    firstGeometry: { x: 914400, y: 1143000, cx: 10363200, cy: 1143000 },
    secondGeometry: { x: 914400, y: 3200400, cx: 10363200, cy: 1143000 },
    firstRunProperties: 'lang="en-US" sz="2800"',
    secondRunProperties: 'lang="en-US" sz="2800"'
  }
];

export function buildSyntheticProfileExemplars() {
  return definitions.map(buildExemplar);
}

export function makeSyntheticProfileAcceptance() {
  return structuredClone(reviewedAcceptance);
}

export const decisionBrief = Object.freeze({
  briefVersion: "0.1.0",
  slideId: "decision-slide",
  function: "decision",
  audienceGoal: "Approve the proposed pilot",
  availableAssetIds: [],
  evidencePolicy: "required",
  primaryTakeawayUnitId: "recommendation",
  units: [
    {
      unitId: "recommendation",
      role: "takeaway",
      kind: "text",
      content: "Approve a limited pilot now"
    },
    {
      unitId: "review-consensus",
      role: "evidence",
      kind: "metric",
      content: { label: "Independent reviews", value: "3/3 aligned" }
    }
  ]
});

export const statusBrief = Object.freeze({
  briefVersion: "0.1.0",
  slideId: "status-slide",
  function: "status",
  audienceGoal: "Understand whether the rollout is ready",
  availableAssetIds: [],
  evidencePolicy: "required",
  primaryTakeawayUnitId: "readiness",
  units: [
    {
      unitId: "readiness",
      role: "takeaway",
      kind: "metric",
      content: { label: "Controls ready", value: "87%" }
    },
    {
      unitId: "remaining-work",
      role: "evidence",
      kind: "text",
      content: "Two final checks remain"
    }
  ]
});
