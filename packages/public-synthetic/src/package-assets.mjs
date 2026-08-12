import { fileURLToPath } from "node:url";

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const assetRoot = fileURLToPath(new URL("../assets/", import.meta.url));

export const PUBLIC_SYNTHETIC_PACKAGE_ASSETS = deepFreeze({
  packageRoot,
  assetRoot,
  fixtureSourceRoot: fileURLToPath(
    new URL("../assets/fixtures/source-parts/minimal/", import.meta.url)
  ),
  expectedTemplateIndexPath: fileURLToPath(
    new URL("../assets/fixtures/inspection/expected-potx-template-index.json", import.meta.url)
  )
});
