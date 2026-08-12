import { CORE_PACKAGE_ASSETS } from "#pptx-compiler/core-assets";
import { NATIVE_CARD_ARROW_PACKAGE_ASSETS } from
  "#pptx-compiler/native-card-arrow-assets";
import { PUBLIC_SYNTHETIC_PACKAGE_ASSETS } from
  "#pptx-compiler/public-synthetic-assets";

import { executeCliWithResources } from "./cli.mjs";

const INSTALLED_RESOURCES = Object.freeze({
  contractRoot: CORE_PACKAGE_ASSETS.contractRoot,
  fixtureSourceRoot: PUBLIC_SYNTHETIC_PACKAGE_ASSETS.fixtureSourceRoot,
  staticHostArtifactPaths: Object.freeze({
    conformanceCasesPath: NATIVE_CARD_ARROW_PACKAGE_ASSETS.conformanceCasesPath,
    expectedTemplateIndexPath: PUBLIC_SYNTHETIC_PACKAGE_ASSETS.expectedTemplateIndexPath,
    inputSchemaPath: NATIVE_CARD_ARROW_PACKAGE_ASSETS.inputSchemaPath,
    outputSchemaPath: NATIVE_CARD_ARROW_PACKAGE_ASSETS.outputSchemaPath,
    supportMatrixPath: CORE_PACKAGE_ASSETS.supportMatrixPath,
    supportMatrixSchemaPath: CORE_PACKAGE_ASSETS.supportMatrixSchemaPath
  })
});

export async function executeInstalledCli({ argv } = {}) {
  return executeCliWithResources({ argv, resources: INSTALLED_RESOURCES });
}
