import { fileURLToPath } from "node:url";

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const assetRoot = fileURLToPath(new URL("../assets/", import.meta.url));

export const NATIVE_CARD_ARROW_PACKAGE_ASSETS = deepFreeze({
  packageRoot,
  assetRoot,
  inputSchemaPath: fileURLToPath(
    new URL("../assets/schemas/input.schema.json", import.meta.url)
  ),
  outputSchemaPath: fileURLToPath(
    new URL("../assets/schemas/output.schema.json", import.meta.url)
  ),
  conformanceCasesPath: fileURLToPath(
    new URL("../assets/fixtures/cases.json", import.meta.url)
  )
});
