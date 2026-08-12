import { fileURLToPath } from "node:url";

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const assetRoot = fileURLToPath(new URL("../assets/", import.meta.url));

export const CORE_PACKAGE_ASSETS = deepFreeze({
  packageRoot,
  assetRoot,
  contractRoot: assetRoot,
  contractSchemaRoot: fileURLToPath(new URL("../assets/schemas/contracts/", import.meta.url)),
  contractFixtureRoot: fileURLToPath(
    new URL("../assets/fixtures/contracts/valid/", import.meta.url)
  ),
  supportMatrixPath: fileURLToPath(
    new URL("../assets/policy/support-matrix.json", import.meta.url)
  ),
  supportMatrixSchemaPath: fileURLToPath(
    new URL("../assets/schemas/support-matrix.schema.json", import.meta.url)
  )
});
