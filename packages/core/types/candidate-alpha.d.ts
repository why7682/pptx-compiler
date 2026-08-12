export type * from "./contracts.d.ts";

type ReadonlyRecord = Readonly<Record<string, unknown>>;
type Validator = (value: unknown) => unknown;

type ErrorJson = Readonly<{
  code: string;
  pointer: string;
}>;

type AssemblyArtifact = Readonly<{
  archiveBytes: Uint8Array;
  report: ReadonlyRecord;
}>;

type CandidateDispatchPlan = Readonly<{
  planVersion: "0.1.0";
  planType: "capability-dispatch-plan";
  invocationCount: number;
}>;

type NativeCardSlotPlacement = ReadonlyRecord & Readonly<{
  placementVersion: "0.1.0";
  placementType: "native-card-arrow-slot-placement";
  resolvedGeometry: unknown;
}>;

type ProjectContext = Readonly<{
  contextVersion: "0.1.0";
  contextType: "project-context";
  projectRoot: string;
  projectConfig: ReadonlyRecord;
  locations: Readonly<{
    templateSource: string;
    templateProfile: string;
    templateIndex: string;
    capabilityRegistry: string;
    projectOverlay: string;
    assetRoot: string;
    stagingRoot: string;
    outputRoot: string;
  }>;
  dependencies: Readonly<{
    validateProjectConfig: Validator;
  }>;
}>;

type TemplateSourceSnapshot = Readonly<{
  sourceArchiveBytes: Uint8Array;
  templateIndex: ReadonlyRecord;
}>;

export declare class CapabilityRuntimeError extends Error {
  constructor(code: string, pointer?: string);
  readonly code: string;
  readonly pointer: string;
  toJSON(): ErrorJson;
}

export declare const CANDIDATE_BUILD_RECORD_MAX_BYTES: number;

export declare function candidateBuildRecordFileName(value: unknown): string;

export declare class CreateOnlyAssemblyError extends Error {
  constructor(code: string, pointer?: string);
  readonly code: string;
  readonly pointer: string;
  toJSON(): ErrorJson;
}

export declare function assembleSourcePreservingPresentation(options: Readonly<{
  sourceArchiveBytes: Uint8Array;
  templateIndex: unknown;
  outputSlideId: string;
}>): AssemblyArtifact;

export declare class NativeCardArrowAssemblyError extends Error {
  constructor(code: string, pointer: string);
  readonly code: string;
  readonly pointer: string;
  toJSON(): ErrorJson;
}

export declare function assembleNativeCardArrowFromSlot(options: Readonly<{
  baseArtifact: unknown;
  dispatchPlan: CandidateDispatchPlan;
  placementRequest: unknown;
}>): Promise<AssemblyArtifact>;

export declare class NativeCardArrowPlacementError extends Error {
  constructor(code: string, pointer: string);
  readonly code: string;
  readonly pointer: string;
  toJSON(): ErrorJson;
}

export declare function createNativeCardArrowSlotPlacement(options: Readonly<{
  baseArtifact: unknown;
  request: unknown;
}>): NativeCardSlotPlacement;

export declare class NativePresentationPublicationError extends Error {
  constructor(code: string, pointer: string);
  readonly code: string;
  readonly pointer: string;
  toJSON(): ErrorJson;
}

export declare function writeAuthenticatedNativeCardCandidateBundle(options: Readonly<{
  artifact: unknown;
  destinationPath: string;
}>): Promise<ReadonlyRecord>;

export declare const NATIVE_CARD_CANDIDATE_QA_MAX_PPTX_BYTES: number;

export declare class NativeCardCandidateQaError extends Error {
  constructor(code: string, pointer: string);
  readonly code: string;
  readonly pointer: string;
}

export declare function assessNativeCardCandidate(options: Readonly<{
  actualCandidateBytes: unknown;
  actualRecordBytes: unknown;
  artifact: unknown;
  candidateFileName: string;
  identity: unknown;
  validateQaReport: Validator;
}>): ReadonlyRecord;

export declare class ProjectContextError extends Error {
  constructor(code: string, pointer?: string);
  readonly code: string;
  readonly pointer: string;
  toJSON(): ErrorJson;
}

export declare function createProjectContext(options: Readonly<{
  projectRoot: string;
  projectConfig: unknown;
  dependencies: Readonly<{
    validateProjectConfig: Validator;
  }>;
}>): ProjectContext;

export declare class ProjectDispatchResolutionError extends Error {
  constructor(code: string, pointer?: string);
  readonly code: string;
  readonly pointer: string;
  toJSON(): ErrorJson;
}

export declare function prepareResolvedProjectDispatch(options: Readonly<{
  runtime: unknown;
  projectConfig: unknown;
  templateProfile: unknown;
  templateIndex: unknown;
  capabilityRegistry: unknown;
  projectOverlay: unknown;
  deckSpec: unknown;
  dependencies: Readonly<{
    validateCapabilityRegistry: Validator;
    validateDeckSpec: Validator;
    validateProjectConfig: Validator;
    validateProjectOverlay: Validator;
    validateTemplateIndex: Validator;
    validateTemplateProfile: Validator;
  }>;
}>): CandidateDispatchPlan;

export declare class TemplateIngestionError extends Error {
  constructor(code: string, pointer?: string);
  readonly code: string;
  readonly pointer: string;
  toJSON(): ErrorJson;
}

export declare function inspectTemplateSource(options: Readonly<{
  context: ProjectContext;
  dependencies: Readonly<{
    validateTemplateIndex: Validator;
  }>;
}>): Promise<ReadonlyRecord>;

export declare function inspectTemplateSourceSnapshot(options: Readonly<{
  context: ProjectContext;
  dependencies: Readonly<{
    validateTemplateIndex: Validator;
  }>;
}>): Promise<TemplateSourceSnapshot>;
