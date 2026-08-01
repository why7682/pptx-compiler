#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createProjectContext } from "../packages/core/src/project-context.mjs";
import { inspectTemplate } from "../packages/core/src/template-inspector.mjs";
import {
  buildSyntheticFixtures,
  createReviewedFixturePackageView
} from "./generate-synthetic-fixtures.mjs";
import {
  assertSupportedSchema,
  createSchemaRegistry,
  validateJson
} from "./lib/json-schema.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

async function loadValidationDependencies() {
  const manifest = JSON.parse(await readFile(
    new URL("../schemas/contracts/manifest.json", import.meta.url),
    "utf8"
  ));
  const schemas = await Promise.all(manifest.schemas.map(async ({ path: schemaPath }) =>
    JSON.parse(await readFile(new URL(`../${schemaPath}`, import.meta.url), "utf8"))));
  const registry = createSchemaRegistry(schemas);
  for (const schema of schemas) assertSupportedSchema(schema, { registry });
  const projectConfigSchema = registry.get("urn:pptx-pipeline:schema:project-config:0.1.0");
  const templateIndexSchema = registry.get("urn:pptx-pipeline:schema:template-index:0.1.0");
  const validate = (value, schema) => validateJson(value, schema, {
    rootSchema: schema,
    registry
  }).length === 0;
  return {
    validateProjectConfig: (value) => validate(value, projectConfigSchema),
    validateTemplateIndex: (value) => validate(value, templateIndexSchema)
  };
}

export async function inspectSyntheticFixture() {
  const [projectConfig, validation, built] = await Promise.all([
    readFile(new URL("../fixtures/contracts/valid/project-config.json", import.meta.url), "utf8")
      .then((text) => JSON.parse(text)),
    loadValidationDependencies(),
    buildSyntheticFixtures()
  ]);
  const context = createProjectContext({
    projectRoot: repositoryRoot,
    projectConfig,
    dependencies: { validateProjectConfig: validation.validateProjectConfig }
  });
  const archive = built.archives.find((entry) => entry.variant === "potx");
  const packageView = createReviewedFixturePackageView({
    archive,
    sourceLocation: context.locations.templateSource
  });
  return inspectTemplate({
    context,
    packageView,
    dependencies: { validateTemplateIndex: validation.validateTemplateIndex }
  });
}

async function main() {
  if (process.argv.length !== 2) throw new Error("unsupported-arguments");
  const templateIndex = await inspectSyntheticFixture();
  process.stdout.write(`${JSON.stringify(templateIndex, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    process.stderr.write("synthetic fixture inspection failed\n");
    process.exitCode = 1;
  });
}
