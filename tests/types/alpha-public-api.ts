import {
  executeCli,
  type CliExecutionOptions,
  type CliExecutionResult
} from "pptx-compiler";
import {
  assessNativeCardCandidate,
  createProjectContext,
  type ProjectConfig,
  writeAuthenticatedNativeCardCandidateBundle
} from "pptx-compiler-core";
import {
  createCapabilityRuntime,
  parseStrictXml,
  validateJson
} from "pptx-compiler-core/extension-api";
import { CORE_PACKAGE_ASSETS } from "pptx-compiler-core/package-assets";
import {
  createNativeCardArrowRegistration,
  executeNativeCardArrow,
  type NativeCardArrowInvocation
} from "pptx-compiler-native-card-arrow";
import { NATIVE_CARD_ARROW_PACKAGE_ASSETS } from
  "pptx-compiler-native-card-arrow/package-assets";
import {
  createInstalledPublicSyntheticProject,
  PUBLIC_SYNTHETIC_PRESET,
  type PublicSyntheticProjectResult
} from "pptx-compiler-public-synthetic";
import { PUBLIC_SYNTHETIC_PACKAGE_ASSETS } from
  "pptx-compiler-public-synthetic/package-assets";

declare const invocation: Readonly<NativeCardArrowInvocation>;
declare const projectConfig: Readonly<ProjectConfig>;

const cliOptions: CliExecutionOptions = { argv: ["--json", "inspect"] };
const cliResult: Promise<Readonly<CliExecutionResult>> = executeCli(cliOptions);
const projectContext = createProjectContext({
  projectRoot: "/synthetic-absolute-root",
  projectConfig,
  dependencies: { validateProjectConfig: () => true }
});
const componentPlan = executeNativeCardArrow(invocation);
const syntheticResult: Promise<Readonly<PublicSyntheticProjectResult>> =
  createInstalledPublicSyntheticProject({
    projectRoot: "/synthetic-absolute-root",
    preset: PUBLIC_SYNTHETIC_PRESET,
    dependencies: {
      validateCapabilityRegistry: () => true,
      validateDeckSpec: () => true,
      validateProjectConfig: () => true,
      validateProjectOverlay: () => true,
      validateTemplateProfile: () => true
    }
  });

void cliResult;
void projectContext;
void componentPlan;
void syntheticResult;
void assessNativeCardCandidate;
void writeAuthenticatedNativeCardCandidateBundle;
void createCapabilityRuntime;
void parseStrictXml;
void validateJson;
void createNativeCardArrowRegistration;
void CORE_PACKAGE_ASSETS;
void NATIVE_CARD_ARROW_PACKAGE_ASSETS;
void PUBLIC_SYNTHETIC_PACKAGE_ASSETS;
