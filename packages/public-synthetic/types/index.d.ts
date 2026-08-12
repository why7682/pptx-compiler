export type PublicSyntheticValidator = (value: unknown) => boolean;

export interface PublicSyntheticProjectDependencies {
  readonly validateCapabilityRegistry: PublicSyntheticValidator;
  readonly validateDeckSpec: PublicSyntheticValidator;
  readonly validateProjectConfig: PublicSyntheticValidator;
  readonly validateProjectOverlay: PublicSyntheticValidator;
  readonly validateTemplateProfile: PublicSyntheticValidator;
}

export interface PublicSyntheticProjectOptions {
  readonly projectRoot: string;
  readonly preset: "public-synthetic-native-card";
  readonly dependencies: Readonly<PublicSyntheticProjectDependencies>;
  readonly fixtureSourceRoot?: string;
}

export interface PublicSyntheticProjectResult {
  readonly preset: "public-synthetic-native-card";
  readonly projectVersion: "0.1.0";
  readonly created: true;
  readonly files: readonly [
    "data/capability-registry.json",
    "data/deck-spec.json",
    "data/project-overlay.json",
    "data/template-profile.json",
    "input/template.potx",
    "pptx-compiler.project.json"
  ];
}

export interface PublicSyntheticNativeCardCandidateProfile {
  readonly profileVersion: "0.1.0";
  readonly profileId: "public-synthetic-native-card-candidate";
  readonly projectIdentity: Readonly<{
    projectId: "public-synthetic-native-card-project";
    templateProfileId: "public-synthetic-template-profile";
    templateIndexId: "public-synthetic-template-index";
    capabilityRegistryId: "public-synthetic-native-card-registry";
    projectOverlayId: "public-synthetic-native-card-overlay";
    capabilitySelectionId: "public-synthetic-native-card-selection";
    capabilityId: "native-card-arrow";
    capabilityVersion: "0.1.0";
  }>;
  readonly observedFeatureIds: readonly string[];
  readonly supportItemIds: readonly string[];
  readonly qaManualGateItemIds: readonly string[];
  readonly evidenceItemId: "automated-public-synthetic";
}

export declare const PUBLIC_SYNTHETIC_PROJECT_VERSION: "0.1.0";
export declare const PUBLIC_SYNTHETIC_PRESET: "public-synthetic-native-card";
export declare const PUBLIC_SYNTHETIC_NATIVE_CARD_CANDIDATE_PROFILE:
  Readonly<PublicSyntheticNativeCardCandidateProfile>;

export declare class PublicSyntheticProjectError extends Error {
  readonly name: "PublicSyntheticProjectError";
  readonly code: string;
  readonly pointer: string;
  constructor(code: string, pointer?: string);
}

export declare function createPublicSyntheticProject(
  options?: Readonly<PublicSyntheticProjectOptions>
): Promise<Readonly<PublicSyntheticProjectResult>>;

export declare function createInstalledPublicSyntheticProject(
  options?: Readonly<PublicSyntheticProjectOptions>
): Promise<Readonly<PublicSyntheticProjectResult>>;
