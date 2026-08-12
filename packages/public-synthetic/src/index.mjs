import {
  createPublicSyntheticProject as createProject,
  PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE,
  PUBLIC_SYNTHETIC_PRESET,
  PUBLIC_SYNTHETIC_PROJECT_VERSION,
  PublicSyntheticProjectError
} from "./project.mjs";
import { PUBLIC_SYNTHETIC_PACKAGE_ASSETS } from "./package-assets.mjs";

export {
  PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE,
  PUBLIC_SYNTHETIC_PRESET,
  PUBLIC_SYNTHETIC_PROJECT_VERSION,
  PublicSyntheticProjectError
};

export function createPublicSyntheticProject({
  projectRoot,
  preset,
  dependencies,
  fixtureSourceRoot = PUBLIC_SYNTHETIC_PACKAGE_ASSETS.fixtureSourceRoot
} = {}) {
  return createProject({
    projectRoot,
    preset,
    dependencies,
    fixtureSourceRoot
  });
}

export { createPublicSyntheticProject as createInstalledPublicSyntheticProject };
