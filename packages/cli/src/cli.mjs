import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  CapabilityRuntimeError,
  CANDIDATE_BUILD_RECORD_MAX_BYTES,
  candidateBuildRecordFileName,
  assembleSourcePreservingPresentation,
  CreateOnlyAssemblyError,
  assembleNativeCardArrowFromSlot,
  NativeCardArrowAssemblyError,
  createNativeCardArrowSlotPlacement,
  NativeCardArrowPlacementError,
  NativePresentationPublicationError,
  writeAuthenticatedNativeCardCandidateBundle,
  assessNativeCardCandidate,
  NATIVE_CARD_CANDIDATE_QA_MAX_PPTX_BYTES,
  NativeCardCandidateQaError,
  createProjectContext,
  ProjectContextError,
  prepareResolvedProjectDispatch,
  ProjectDispatchResolutionError,
  inspectTemplateSource,
  inspectTemplateSourceSnapshot,
  TemplateIngestionError
} from "#pptx-compiler/core";
import {
  createPublicSyntheticProject,
  PublicSyntheticProjectError
} from "#pptx-compiler/public-synthetic";
import { loadCliContractRuntime, CliContractRuntimeError } from "./contract-runtime.mjs";
import {
  CliProjectIoError,
  readContainedBytes,
  readContainedJson,
  resolveContainedOutputPath,
  writeContainedJsonCreateOnly
} from "./project-io.mjs";
import {
  createCliStaticHost,
  CliStaticHostError
} from "./static-host.mjs";

export const CLI_PROTOCOL_VERSION = "0.1.0";
export const CLI_EXIT_CODES = Object.freeze({
  success: 0,
  failure: 1,
  usage: 2
});

const IMPLEMENTED_COMMANDS = Object.freeze({
  init: Object.freeze(["preset", "project-root"]),
  inspect: Object.freeze(["config", "project-root"]),
  qa: Object.freeze(["config", "deck", "project-root"]),
  render: Object.freeze(["config", "deck", "project-root"])
});
const VALIDATE_MODES = Object.freeze({
  document: Object.freeze(["contract", "input", "project-root"]),
  project: Object.freeze(["config", "deck", "project-root"])
});
const DEFERRED_COMMANDS = new Set(["doctor", "onboard", "diff"]);
const EXECUTION_RESOURCE_KEYS = Object.freeze([
  "contractRoot",
  "fixtureSourceRoot",
  "staticHostArtifactPaths"
]);
const STATIC_HOST_ARTIFACT_PATH_KEYS = Object.freeze([
  "conformanceCasesPath",
  "expectedTemplateIndexPath",
  "inputSchemaPath",
  "outputSchemaPath",
  "supportMatrixPath",
  "supportMatrixSchemaPath"
]);

class CliError extends Error {
  constructor(code, exitCode, pointer = "") {
    super(code);
    this.name = "CliError";
    this.code = code;
    this.exitCode = exitCode;
    this.pointer = pointer;
  }
}

function fail(code, exitCode, pointer = "") {
  throw new CliError(code, exitCode, pointer);
}

function exactOptions(options) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    fail("CLI_HOST_INVALID", CLI_EXIT_CODES.failure);
  }
  const keys = Object.keys(options).sort();
  if (keys.length !== 2 || keys[0] !== "argv" || keys[1] !== "contractRoot" ||
      !Array.isArray(options.argv) || typeof options.contractRoot !== "string") {
    fail("CLI_HOST_INVALID", CLI_EXIT_CODES.failure);
  }
}

function exactDataRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const expected = new Set(keys);
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length ||
      actual.some((key) => typeof key !== "string" || !expected.has(key))) {
    return false;
  }
  return actual.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
  });
}

function hostAbsolutePath(value) {
  if (typeof value !== "string" || !path.isAbsolute(value) || path.normalize(value) !== value ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    fail("CLI_HOST_INVALID", CLI_EXIT_CODES.failure);
  }
  return value;
}

function captureExecutionResources(value) {
  if (!exactDataRecord(value, EXECUTION_RESOURCE_KEYS) ||
      !exactDataRecord(value.staticHostArtifactPaths, STATIC_HOST_ARTIFACT_PATH_KEYS)) {
    fail("CLI_HOST_INVALID", CLI_EXIT_CODES.failure);
  }
  return Object.freeze({
    contractRoot: hostAbsolutePath(value.contractRoot),
    fixtureSourceRoot: hostAbsolutePath(value.fixtureSourceRoot),
    staticHostArtifactPaths: Object.freeze(Object.fromEntries(
      STATIC_HOST_ARTIFACT_PATH_KEYS.map((key) => [
        key,
        hostAbsolutePath(Object.getOwnPropertyDescriptor(value.staticHostArtifactPaths, key).value)
      ])
    ))
  });
}

function repositoryLayoutResources(contractRoot) {
  return Object.freeze({
    contractRoot,
    fixtureSourceRoot: path.join(contractRoot, "fixtures", "source-parts", "minimal"),
    staticHostArtifactPaths: Object.freeze({
      conformanceCasesPath: path.join(
        contractRoot,
        "fixtures",
        "capabilities",
        "native-card-arrow",
        "cases.json"
      ),
      expectedTemplateIndexPath: path.join(
        contractRoot,
        "fixtures",
        "inspection",
        "expected-potx-template-index.json"
      ),
      inputSchemaPath: path.join(
        contractRoot,
        "plugins",
        "native-card-arrow",
        "schemas",
        "input.schema.json"
      ),
      outputSchemaPath: path.join(
        contractRoot,
        "plugins",
        "native-card-arrow",
        "schemas",
        "output.schema.json"
      ),
      supportMatrixPath: path.join(contractRoot, "policy", "support-matrix.json"),
      supportMatrixSchemaPath: path.join(
        contractRoot,
        "schemas",
        "support-matrix.schema.json"
      )
    })
  });
}

function parseOptionPairs(tokens, allowed) {
  const values = new Map();
  let json = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--json") {
      if (json) fail("CLI_USAGE", CLI_EXIT_CODES.usage, "/arguments/json");
      json = true;
      continue;
    }
    if (typeof token !== "string" || !token.startsWith("--")) {
      fail("CLI_USAGE", CLI_EXIT_CODES.usage, "/arguments");
    }
    const name = token.slice(2);
    if (!allowed.includes(name)) fail("CLI_USAGE", CLI_EXIT_CODES.usage, "/arguments/options");
    if (values.has(name)) fail("CLI_USAGE", CLI_EXIT_CODES.usage, `/arguments/${name}`);
    const value = tokens[index + 1];
    if (typeof value !== "string" || value.length === 0 || value.startsWith("--")) {
      fail("CLI_USAGE", CLI_EXIT_CODES.usage, `/arguments/${name}`);
    }
    values.set(name, value);
    index += 1;
  }
  for (const name of allowed) {
    if (!values.has(name)) fail("CLI_USAGE", CLI_EXIT_CODES.usage, `/arguments/${name}`);
  }
  return { json, values };
}

function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.some((value) => typeof value !== "string")) {
    fail("CLI_USAGE", CLI_EXIT_CODES.usage, "/arguments");
  }
  const command = argv[0];
  if (typeof command !== "string") fail("CLI_USAGE", CLI_EXIT_CODES.usage, "/arguments/command");
  if (DEFERRED_COMMANDS.has(command)) {
    parseOptionPairs(argv.slice(1), []);
    fail("CLI_COMMAND_UNAVAILABLE", CLI_EXIT_CODES.failure, `/commands/${command}`);
  }
  if (command === "validate") {
    const mode = argv[1];
    const allowed = VALIDATE_MODES[mode];
    if (allowed === undefined) fail("CLI_USAGE", CLI_EXIT_CODES.usage, "/arguments/mode");
    const parsed = parseOptionPairs(argv.slice(2), allowed);
    return { command, mode, ...parsed };
  }
  const allowed = IMPLEMENTED_COMMANDS[command];
  if (allowed === undefined) fail("CLI_USAGE", CLI_EXIT_CODES.usage, "/arguments/command");
  const parsed = parseOptionPairs(argv.slice(1), allowed);
  return { command, ...parsed };
}

function absoluteOption(value, pointer) {
  if (!path.isAbsolute(value) || path.normalize(value) !== value ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    fail("CLI_INPUT_INVALID", CLI_EXIT_CODES.failure, pointer);
  }
  return value;
}

function firstFindingPointer(findings) {
  if (!Array.isArray(findings) || findings.length === 0) return "/input";
  const finding = findings[0];
  let pointer = finding?.pointer;
  if (finding?.keyword === "additionalProperties" && typeof pointer === "string") {
    pointer = pointer.slice(0, pointer.lastIndexOf("/"));
  }
  return typeof pointer === "string" &&
    /^(?:\/(?:[A-Za-z][A-Za-z0-9_-]{0,63}|[0-9]{1,6}))*$/u.test(pointer) && pointer !== ""
    ? pointer
    : "/input";
}

async function initCommand(parsed, contracts, fixtureSourceRoot) {
  const projectRoot = absoluteOption(parsed.values.get("project-root"), "/arguments/project-root");
  return createPublicSyntheticProject({
    projectRoot,
    preset: parsed.values.get("preset"),
    fixtureSourceRoot,
    dependencies: {
      validateCapabilityRegistry: contracts.validateCapabilityRegistry,
      validateDeckSpec: contracts.validateDeckSpec,
      validateProjectConfig: contracts.validateProjectConfig,
      validateProjectOverlay: contracts.validateProjectOverlay,
      validateTemplateProfile: contracts.validateTemplateProfile
    }
  });
}

async function inspectCommand(parsed, contracts) {
  const projectRoot = absoluteOption(parsed.values.get("project-root"), "/arguments/project-root");
  const configPath = absoluteOption(parsed.values.get("config"), "/arguments/config");
  const projectConfig = await readContainedJson({
    projectRoot,
    filePath: configPath,
    pointer: "/projectConfig"
  });
  if (!contracts.validateProjectConfig(projectConfig)) {
    const findings = contracts.findings("project-config", projectConfig);
    fail("CLI_INPUT_INVALID", CLI_EXIT_CODES.failure, firstFindingPointer(findings));
  }
  const context = createProjectContext({
    projectRoot,
    projectConfig,
    dependencies: { validateProjectConfig: contracts.validateProjectConfig }
  });
  const templateIndex = await inspectTemplateSource({
    context,
    dependencies: { validateTemplateIndex: contracts.validateTemplateIndex }
  });
  await writeContainedJsonCreateOnly({
    projectRoot,
    filePath: context.locations.templateIndex,
    value: templateIndex
  });
  return templateIndex;
}

async function validateDocumentCommand(parsed, contracts) {
  const projectRoot = absoluteOption(parsed.values.get("project-root"), "/arguments/project-root");
  const inputPath = absoluteOption(parsed.values.get("input"), "/arguments/input");
  const contractType = parsed.values.get("contract");
  if (!contracts.contractTypes.includes(contractType)) {
    fail("CLI_CONTRACT_UNAVAILABLE", CLI_EXIT_CODES.failure, "/arguments/contract");
  }
  const document = await readContainedJson({ projectRoot, filePath: inputPath });
  const findings = contracts.findings(contractType, document);
  if (findings === null) {
    fail("CLI_CONTRACT_UNAVAILABLE", CLI_EXIT_CODES.failure, "/arguments/contract");
  }
  if (findings.length !== 0) {
    fail("CLI_INPUT_INVALID", CLI_EXIT_CODES.failure, firstFindingPointer(findings));
  }
  return Object.freeze({
    scope: "document",
    contractType,
    schemaVersion: document.schemaVersion,
    valid: true
  });
}

function requireValidContract(contracts, contractType, value, pointer) {
  const findings = contracts.findings(contractType, value);
  if (findings === null) fail("CLI_CONTRACT_UNAVAILABLE", CLI_EXIT_CODES.failure, pointer);
  if (findings.length !== 0) {
    const findingPointer = firstFindingPointer(findings);
    const suffix = findingPointer === "/input" ? "" : findingPointer;
    fail("CLI_INPUT_INVALID", CLI_EXIT_CODES.failure, `${pointer}${suffix}`);
  }
}

async function loadProjectState(parsed, contracts, staticHostArtifactPaths) {
  const projectRoot = absoluteOption(parsed.values.get("project-root"), "/arguments/project-root");
  const configPath = absoluteOption(parsed.values.get("config"), "/arguments/config");
  const deckPath = absoluteOption(parsed.values.get("deck"), "/arguments/deck");
  const projectConfig = await readContainedJson({
    projectRoot,
    filePath: configPath,
    pointer: "/projectConfig"
  });
  requireValidContract(contracts, "project-config", projectConfig, "/projectConfig");
  const context = createProjectContext({
    projectRoot,
    projectConfig,
    dependencies: { validateProjectConfig: contracts.validateProjectConfig }
  });
  const [templateProfile, templateIndex, capabilityRegistry, projectOverlay, deckSpec] =
    await Promise.all([
      readContainedJson({
        projectRoot,
        filePath: context.locations.templateProfile,
        pointer: "/templateProfile"
      }),
      readContainedJson({
        projectRoot,
        filePath: context.locations.templateIndex,
        pointer: "/templateIndex"
      }),
      readContainedJson({
        projectRoot,
        filePath: context.locations.capabilityRegistry,
        pointer: "/capabilityRegistry"
      }),
      readContainedJson({
        projectRoot,
        filePath: context.locations.projectOverlay,
        pointer: "/projectOverlay"
      }),
      readContainedJson({ projectRoot, filePath: deckPath, pointer: "/deckSpec" })
    ]);
  for (const [contractType, value, pointer] of [
    ["template-profile", templateProfile, "/templateProfile"],
    ["template-index", templateIndex, "/templateIndex"],
    ["capability-registry", capabilityRegistry, "/capabilityRegistry"],
    ["project-overlay", projectOverlay, "/projectOverlay"],
    ["deck-spec", deckSpec, "/deckSpec"]
  ]) {
    requireValidContract(contracts, contractType, value, pointer);
  }

  const sourceSnapshot = await inspectTemplateSourceSnapshot({
    context,
    dependencies: { validateTemplateIndex: contracts.validateTemplateIndex }
  });
  if (!isDeepStrictEqual(sourceSnapshot.templateIndex, templateIndex)) {
    fail("CLI_PROJECT_STALE", CLI_EXIT_CODES.failure, "/templateIndex");
  }
  const staticHost = await createCliStaticHost({
    artifactPaths: staticHostArtifactPaths,
    capabilityRegistry,
    validateCapabilityRegistry: contracts.validateCapabilityRegistry,
    validateTemplateIndex: contracts.validateTemplateIndex
  });
  return Object.freeze({
    projectRoot,
    context,
    projectConfig,
    templateProfile,
    templateIndex: sourceSnapshot.templateIndex,
    sourceArchiveBytes: sourceSnapshot.sourceArchiveBytes,
    capabilityRegistry,
    projectOverlay,
    deckSpec,
    runtime: staticHost.runtime,
    candidateProfile: staticHost.candidateProfile
  });
}

function prepareProjectPlan(state, contracts) {
  const plan = prepareResolvedProjectDispatch({
    runtime: state.runtime,
    projectConfig: state.projectConfig,
    templateProfile: state.templateProfile,
    templateIndex: state.templateIndex,
    capabilityRegistry: state.capabilityRegistry,
    projectOverlay: state.projectOverlay,
    deckSpec: state.deckSpec,
    dependencies: {
      validateCapabilityRegistry: contracts.validateCapabilityRegistry,
      validateDeckSpec: contracts.validateDeckSpec,
      validateProjectConfig: contracts.validateProjectConfig,
      validateProjectOverlay: contracts.validateProjectOverlay,
      validateTemplateIndex: contracts.validateTemplateIndex,
      validateTemplateProfile: contracts.validateTemplateProfile
    }
  });
  return plan;
}

async function validateProjectCommand(parsed, contracts, staticHostArtifactPaths) {
  const state = await loadProjectState(parsed, contracts, staticHostArtifactPaths);
  const plan = prepareProjectPlan(state, contracts);
  return Object.freeze({
    scope: "project",
    schemaVersion: contracts.contractVersion,
    valid: true,
    registrationConformanceExecution: "passed",
    projectDispatchPreflight: "passed",
    invocationCount: plan.invocationCount,
    projectInvocationExecution: "not-run",
    renderEligibility: "not-granted"
  });
}

function assertCandidateProfile(state) {
  const identity = state.candidateProfile.projectIdentity;
  const slide = state.deckSpec.slides[0];
  const selection = state.projectOverlay.capabilitySelections[0];
  const capability = state.capabilityRegistry.capabilities[0];
  const exact = [
    [state.projectConfig.projectId, identity.projectId, "/projectConfig/projectId"],
    [state.templateProfile.templateProfileId, identity.templateProfileId,
      "/templateProfile/templateProfileId"],
    [state.templateProfile.templateIndexId, identity.templateIndexId,
      "/templateProfile/templateIndexId"],
    [state.capabilityRegistry.capabilityRegistryId, identity.capabilityRegistryId,
      "/capabilityRegistry/capabilityRegistryId"],
    [state.projectOverlay.projectOverlayId, identity.projectOverlayId,
      "/projectOverlay/projectOverlayId"],
    [selection?.capabilitySelectionId, identity.capabilitySelectionId,
      "/projectOverlay/capabilitySelections/0/capabilitySelectionId"],
    [selection?.capabilityId, identity.capabilityId,
      "/projectOverlay/capabilitySelections/0/capabilityId"],
    [selection?.capabilityVersion, identity.capabilityVersion,
      "/projectOverlay/capabilitySelections/0/capabilityVersion"],
    [capability?.capabilityId, identity.capabilityId,
      "/capabilityRegistry/capabilities/0/capabilityId"],
    [capability?.capabilityVersion, identity.capabilityVersion,
      "/capabilityRegistry/capabilities/0/capabilityVersion"],
    [slide?.capabilitySelectionId, identity.capabilitySelectionId,
      "/deckSpec/slides/0/capabilitySelectionId"]
  ];
  if (state.templateProfile.templateFormat !== "potx") {
    fail("CLI_CANDIDATE_PROFILE_MISMATCH", CLI_EXIT_CODES.failure,
      "/templateProfile/templateFormat");
  }
  if (state.deckSpec.slides.length !== 1 ||
      state.projectOverlay.capabilitySelections.length !== 1 ||
      state.capabilityRegistry.capabilities.length !== 1) {
    fail("CLI_CANDIDATE_PROFILE_MISMATCH", CLI_EXIT_CODES.failure, "/deckSpec/slides");
  }
  for (const [actual, expected, pointer] of exact) {
    if (actual !== expected) {
      fail("CLI_CANDIDATE_PROFILE_MISMATCH", CLI_EXIT_CODES.failure, pointer);
    }
  }
  if (!isDeepStrictEqual(
    state.templateIndex,
    state.candidateProfile.expectedTemplateIndex
  )) {
    fail("CLI_CANDIDATE_PROFILE_MISMATCH", CLI_EXIT_CODES.failure,
      "/templateIndex");
  }
  return slide;
}

async function deriveNativeCardCandidate(state, contracts, slide) {
  const baseArtifact = assembleSourcePreservingPresentation({
    sourceArchiveBytes: state.sourceArchiveBytes,
    templateIndex: state.templateIndex,
    outputSlideId: slide.slideId
  });
  const placementRequest = Object.freeze({
    placementVersion: "0.1.0",
    outputSlideId: slide.slideId,
    slotRef: "slide-content-tail",
    placementIntent: "slot-aligned-fixed",
    preferredSize: Object.freeze({
      cx: slide.payload.geometry.cx,
      cy: slide.payload.geometry.cy
    })
  });
  const placement = createNativeCardArrowSlotPlacement({
    baseArtifact,
    request: placementRequest
  });
  if (!isDeepStrictEqual(placement.resolvedGeometry, slide.payload.geometry)) {
    fail("CLI_CANDIDATE_LAYOUT_MISMATCH", CLI_EXIT_CODES.failure,
      "/deckSpec/slides/0/payload/geometry");
  }
  const plan = prepareProjectPlan(state, contracts);
  if (plan.invocationCount !== 1) {
    fail("CLI_CANDIDATE_PROFILE_MISMATCH", CLI_EXIT_CODES.failure, "/deckSpec/slides");
  }
  const artifact = await assembleNativeCardArrowFromSlot({
    baseArtifact,
    dispatchPlan: plan,
    placementRequest
  });
  return Object.freeze({ artifact, invocationCount: plan.invocationCount });
}

async function renderCommand(parsed, contracts, staticHostArtifactPaths) {
  const state = await loadProjectState(parsed, contracts, staticHostArtifactPaths);
  const slide = assertCandidateProfile(state);
  const derived = await deriveNativeCardCandidate(state, contracts, slide);
  const fileName = `${state.deckSpec.deckId}.pptx`;
  const destinationPath = await resolveContainedOutputPath({
    projectRoot: state.projectRoot,
    filePath: path.join(state.context.locations.outputRoot, fileName)
  });
  const written = await writeAuthenticatedNativeCardCandidateBundle({
    artifact: derived.artifact,
    destinationPath
  });
  return Object.freeze({
    scope: "candidate",
    supportProfileId: state.candidateProfile.profileId,
    supportStatus: state.candidateProfile.status,
    supportClaimsEnabled: state.candidateProfile.supportClaimsEnabled,
    supportItemIds: state.candidateProfile.supportItemIds,
    runtimeSupportItemId: state.candidateProfile.runtimeSupportItemId,
    evidenceItemId: state.candidateProfile.evidenceItemId,
    registrationConformanceExecution: "passed",
    projectDispatchPreflight: "passed",
    invocationCount: derived.invocationCount,
    projectInvocationExecution: "executed",
    fileName,
    ...written
  });
}

async function qaCommand(parsed, contracts, staticHostArtifactPaths) {
  const state = await loadProjectState(parsed, contracts, staticHostArtifactPaths);
  const slide = assertCandidateProfile(state);
  const candidateFileName = `${state.deckSpec.deckId}.pptx`;
  const candidateRecordFileName = candidateBuildRecordFileName(candidateFileName);
  const candidatePath = path.join(state.context.locations.outputRoot, candidateFileName);
  const candidateRecordPath = path.join(
    state.context.locations.outputRoot,
    candidateRecordFileName
  );
  const actualCandidateBytes = await readContainedBytes({
    projectRoot: state.projectRoot,
    filePath: candidatePath,
    pointer: "/candidate",
    maximumBytes: NATIVE_CARD_CANDIDATE_QA_MAX_PPTX_BYTES
  });
  const actualRecordBytes = await readContainedBytes({
    projectRoot: state.projectRoot,
    filePath: candidateRecordPath,
    pointer: "/candidateRecord",
    maximumBytes: CANDIDATE_BUILD_RECORD_MAX_BYTES
  });
  const derived = await deriveNativeCardCandidate(state, contracts, slide);
  const qaReport = assessNativeCardCandidate({
    actualCandidateBytes,
    actualRecordBytes,
    artifact: derived.artifact,
    candidateFileName,
    identity: Object.freeze({
      buildId: `${state.deckSpec.deckId}-candidate-build`,
      capabilityRegistryId: state.capabilityRegistry.capabilityRegistryId,
      deckId: state.deckSpec.deckId,
      projectId: state.projectConfig.projectId,
      projectOverlayId: state.projectOverlay.projectOverlayId,
      qaContractId: state.capabilityRegistry.capabilities[0].qaContractId,
      qaReportId: `${state.deckSpec.deckId}-qa`,
      registryVersion: state.capabilityRegistry.registryVersion,
      templateIndexId: state.templateIndex.templateIndexId,
      templateProfileId: state.templateProfile.templateProfileId,
      templateSha256: state.templateProfile.templateSha256
    }),
    validateQaReport: contracts.validateQaReport
  });
  if (!isDeepStrictEqual(
    qaReport.manualGates.map(({ supportMatrixItemId }) => supportMatrixItemId)
      .filter((itemId, index, items) => items.indexOf(itemId) === index)
      .sort(),
    state.candidateProfile.qaManualGateItemIds
  )) {
    fail("CLI_QA_PROFILE_MISMATCH", CLI_EXIT_CODES.failure, "/qaReport/manualGates");
  }
  const fileName = `${state.deckSpec.deckId}.qa.json`;
  await writeContainedJsonCreateOnly({
    projectRoot: state.projectRoot,
    filePath: path.join(state.context.locations.outputRoot, fileName),
    value: qaReport
  });
  return qaReport;
}

async function validateCommand(parsed, contracts, staticHostArtifactPaths) {
  return parsed.mode === "document"
    ? validateDocumentCommand(parsed, contracts)
    : validateProjectCommand(parsed, contracts, staticHostArtifactPaths);
}

function mapError(error) {
  if (error instanceof CliError) return error;
  if (error instanceof CliProjectIoError) {
    return new CliError(error.code, CLI_EXIT_CODES.failure, error.pointer);
  }
  if (error instanceof ProjectContextError || error instanceof TemplateIngestionError) {
    return new CliError(error.code, CLI_EXIT_CODES.failure, error.pointer);
  }
  if (error instanceof CliContractRuntimeError) {
    return new CliError(error.code, CLI_EXIT_CODES.failure, error.pointer);
  }
  if (error instanceof CapabilityRuntimeError ||
      error instanceof CreateOnlyAssemblyError ||
      error instanceof NativeCardArrowAssemblyError ||
      error instanceof NativeCardArrowPlacementError ||
      error instanceof NativeCardCandidateQaError ||
      error instanceof NativePresentationPublicationError ||
      error instanceof ProjectDispatchResolutionError ||
      error instanceof PublicSyntheticProjectError ||
      error instanceof CliStaticHostError) {
    return new CliError(error.code, CLI_EXIT_CODES.failure, error.pointer);
  }
  return new CliError("CLI_OPERATION_FAILED", CLI_EXIT_CODES.failure);
}

function errorEnvelope(command, error) {
  return {
    protocolVersion: CLI_PROTOCOL_VERSION,
    command,
    ok: false,
    error: {
      code: error.code,
      pointer: error.pointer
    }
  };
}

function successEnvelope(command, result) {
  return { protocolVersion: CLI_PROTOCOL_VERSION, command, ok: true, result };
}

function renderedResult({ command, error, json, result }) {
  if (error) {
    const line = json
      ? JSON.stringify(errorEnvelope(command, error))
      : `${error.code}${error.pointer ? ` at ${error.pointer}` : ""}`;
    return json
      ? Object.freeze({ exitCode: error.exitCode, stdout: `${line}\n`, stderr: "" })
      : Object.freeze({ exitCode: error.exitCode, stdout: "", stderr: `${line}\n` });
  }
  const line = json
    ? JSON.stringify(successEnvelope(command, result))
    : command === "render"
      ? "render: experimental candidate"
      : command === "qa"
        ? `qa: ${result.decision}`
        : `${command}: ok`;
  return Object.freeze({ exitCode: CLI_EXIT_CODES.success, stdout: `${line}\n`, stderr: "" });
}

async function executeWithResources(argv, resolveResources) {
  let command = null;
  const requestedJson = Array.isArray(argv) && argv.includes("--json");
  try {
    const resources = resolveResources();
    const requestedCommand = argv[0];
    if (Object.hasOwn(IMPLEMENTED_COMMANDS, requestedCommand) ||
        requestedCommand === "validate" || DEFERRED_COMMANDS.has(requestedCommand)) {
      command = requestedCommand;
    }
    const parsed = parseArguments(argv);
    command = parsed.command;
    const contracts = await loadCliContractRuntime({ contractRoot: resources.contractRoot });
    const result = command === "init"
      ? await initCommand(parsed, contracts, resources.fixtureSourceRoot)
      : command === "inspect"
        ? await inspectCommand(parsed, contracts)
        : command === "qa"
          ? await qaCommand(parsed, contracts, resources.staticHostArtifactPaths)
        : command === "render"
          ? await renderCommand(parsed, contracts, resources.staticHostArtifactPaths)
          : await validateCommand(parsed, contracts, resources.staticHostArtifactPaths);
    return renderedResult({ command, json: parsed.json, result });
  } catch (caught) {
    const error = mapError(caught);
    const safeCommand = Object.hasOwn(IMPLEMENTED_COMMANDS, command) ||
      command === "validate" || DEFERRED_COMMANDS.has(command)
      ? command
      : null;
    return renderedResult({ command: safeCommand, error, json: requestedJson });
  }
}

export async function executeCli(options) {
  return executeWithResources(options?.argv, () => {
    exactOptions(options);
    return repositoryLayoutResources(options.contractRoot);
  });
}

export async function executeCliWithResources(options) {
  return executeWithResources(options?.argv, () => {
    if (!exactDataRecord(options, ["argv", "resources"]) || !Array.isArray(options.argv)) {
      fail("CLI_HOST_INVALID", CLI_EXIT_CODES.failure);
    }
    return captureExecutionResources(options.resources);
  });
}
