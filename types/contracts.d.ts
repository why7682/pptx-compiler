// Generated from schemas/contracts/manifest.json and the normative JSON Schemas.
// Do not edit by hand; run npm run generate:contract-types.

export type BindingAssignment = {
  readonly role: string;
  readonly shapeBindingId: string;
};

export type BuildArtifact = {
  readonly schemaVersion: "0.1.0";
  readonly contractType: "build-artifact";
  readonly buildId: string;
  readonly projectId: string;
  readonly deckId: string;
  readonly templateProfileId: string;
  readonly templateIndexId: string;
  readonly capabilityRegistryId: string;
  readonly registryVersion: string;
  readonly projectOverlayId: string;
  readonly templateSha256: string;
  readonly slides: ReadonlyArray<SlideResult>;
  readonly changedParts: ReadonlyArray<"[Content_Types].xml" | string>;
  readonly qaReportId: string;
  readonly output: PublishedOutput;
};

export type CapabilityDefinition = {
  readonly capabilityId: string;
  readonly capabilityVersion: string;
  readonly supportMatrixItemId: string;
  readonly executorId: string;
  readonly inputSchemaId: string;
  readonly outputSchemaId: string;
  readonly qaContractId: string;
  readonly requiredBindingRoles: ReadonlyArray<string>;
  readonly conformanceFixtureIds: ReadonlyArray<string>;
};

export type CapabilityRegistry = {
  readonly schemaVersion: "0.1.0";
  readonly contractType: "capability-registry";
  readonly capabilityRegistryId: string;
  readonly registryVersion: string;
  readonly capabilities: ReadonlyArray<CapabilityDefinition>;
};

export type CapabilitySelection = {
  readonly capabilitySelectionId: string;
  readonly capabilityId: string;
  readonly capabilityVersion: string;
  readonly experimentalOptIn: boolean;
  readonly bindings: ReadonlyArray<BindingAssignment>;
};

export type DeckSpec = {
  readonly schemaVersion: "0.1.0";
  readonly contractType: "deck-spec";
  readonly deckId: string;
  readonly projectId: string;
  readonly templateProfileId: string;
  readonly projectOverlayId: string;
  readonly slides: ReadonlyArray<SlideSpec>;
};

export type Diagnostic = {
  readonly diagnosticId: string;
  readonly severity: "error" | "info" | "warning";
  readonly code: string;
  readonly scopeKind: "build" | "deck" | "slide";
  readonly scopeId: string;
};

export type ManualGate = {
  readonly manualGateId: string;
  readonly supportMatrixItemId: string;
  readonly scopeKind: "build" | "deck" | "slide";
  readonly scopeId: string;
  readonly status: "unresolved";
} | {
  readonly manualGateId: string;
  readonly supportMatrixItemId: string;
  readonly scopeKind: "build" | "deck" | "slide";
  readonly scopeId: string;
  readonly status: "unavailable";
} | {
  readonly manualGateId: string;
  readonly supportMatrixItemId: string;
  readonly scopeKind: "build" | "deck" | "slide";
  readonly scopeId: string;
  readonly status: "failed" | "passed";
  readonly evidenceRecordId: string;
};

export type ProjectConfig = {
  readonly schemaVersion: "0.1.0";
  readonly contractType: "project-config";
  readonly projectId: string;
  readonly template: {
    readonly sourcePath: string;
    readonly profileId: string;
    readonly profilePath: string;
    readonly indexId: string;
    readonly indexPath: string;
  };
  readonly capabilityRegistry: {
    readonly registryId: string;
    readonly registryVersion: string;
    readonly path: string;
  };
  readonly projectOverlay: {
    readonly overlayId: string;
    readonly path: string;
  };
  readonly paths: {
    readonly assetRoot: string;
    readonly stagingRoot: string;
    readonly outputRoot: string;
  };
  readonly policies: {
    readonly experimentalCapabilities: "require-explicit-opt-in";
    readonly unknownFeatures: "reject";
    readonly ambiguousBindings: "reject";
    readonly sourceMutation: "reject";
  };
};

export type ProjectOverlay = {
  readonly schemaVersion: "0.1.0";
  readonly contractType: "project-overlay";
  readonly projectOverlayId: string;
  readonly projectId: string;
  readonly templateProfileId: string;
  readonly templateIndexId: string;
  readonly templateSha256: string;
  readonly capabilityRegistryId: string;
  readonly registryVersion: string;
  readonly capabilitySelections: ReadonlyArray<CapabilitySelection>;
  readonly shapeBindings: ReadonlyArray<ShapeBinding>;
};

export type PublishedOutput = {
  readonly format: "pptx";
  readonly publishPath: string;
  readonly sha256: string;
  readonly byteLength: number;
};

export type QaCheck = {
  readonly checkId: string;
  readonly qaContractId: string;
  readonly scopeKind: "build" | "deck" | "slide";
  readonly scopeId: string;
  readonly outcome: "fail" | "manual" | "pass" | "unavailable";
  readonly manualGateIds: ReadonlyArray<string>;
  readonly diagnosticIds: ReadonlyArray<string>;
};

export type QaReport = {
  readonly schemaVersion: "0.1.0";
  readonly contractType: "qa-report";
  readonly qaReportId: string;
  readonly buildId: string;
  readonly projectId: string;
  readonly deckId: string;
  readonly templateProfileId: string;
  readonly templateIndexId: string;
  readonly capabilityRegistryId: string;
  readonly registryVersion: string;
  readonly projectOverlayId: string;
  readonly templateSha256: string;
  readonly decision: "blocked" | "fail" | "pass";
  readonly checks: ReadonlyArray<QaCheck>;
  readonly manualGates: ReadonlyArray<ManualGate>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
};

export type ShapeBinding = {
  readonly shapeBindingId: string;
  readonly containerKind: "layout" | "slide";
  readonly containerKey: string;
  readonly shapeKey: string;
  readonly expectedKind: "auto-shape" | "graphic-frame" | "group" | "picture" | "placeholder" | "text-box";
  readonly cardinality: "exactly-one";
};

export type SlideResult = {
  readonly slideId: string;
  readonly capabilityId: string;
  readonly capabilityVersion: string;
};

export type SlideSpec = {
  readonly slideId: string;
  readonly capabilitySelectionId: string;
  readonly payload: Record<string, unknown>;
};

export type TemplateIndex = {
  readonly schemaVersion: "0.1.0";
  readonly contractType: "template-index";
  readonly templateIndexId: string;
  readonly templateProfileId: string;
  readonly templateFormat: "potx" | "pptx";
  readonly templateSha256: string;
  readonly presentationPart: string;
  readonly slideSizeEmu: {
    readonly cx: number;
    readonly cy: number;
  };
  readonly observedFeatureIds: ReadonlyArray<string>;
  readonly masters: ReadonlyArray<TemplateMasterIndexEntry>;
  readonly layouts: ReadonlyArray<TemplateLayoutIndexEntry>;
  readonly slides: ReadonlyArray<TemplateSlideIndexEntry>;
};

export type TemplateLayoutIndexEntry = {
  readonly layoutKey: string;
  readonly sourceId: number;
  readonly partPath: string;
  readonly masterKey: string;
  readonly shapes: ReadonlyArray<TemplateShapeIndexEntry>;
};

export type TemplateMasterIndexEntry = {
  readonly masterKey: string;
  readonly sourceId: number;
  readonly partPath: string;
};

export type TemplateProfile = {
  readonly schemaVersion: "0.1.0";
  readonly contractType: "template-profile";
  readonly templateProfileId: string;
  readonly templateIndexId: string;
  readonly templateFormat: "potx" | "pptx";
  readonly templateSha256: string;
  readonly slideSizeEmu: {
    readonly cx: number;
    readonly cy: number;
  };
  readonly layoutBindings: ReadonlyArray<{
    readonly layoutKey: string;
    readonly semanticRole: string;
  }>;
};

export type TemplateShapeIndexEntry = {
  readonly shapeKey: string;
  readonly sourceId: number;
  readonly kind: "auto-shape" | "graphic-frame" | "group" | "picture" | "placeholder" | "text-box";
  readonly geometry: {
    readonly x: number;
    readonly y: number;
    readonly cx: number;
    readonly cy: number;
  };
  readonly placeholder?: {
    readonly type: string;
    readonly index: number;
  };
};

export type TemplateSlideIndexEntry = {
  readonly slideKey: string;
  readonly sourceId: number;
  readonly partPath: string;
  readonly layoutKey: string;
  readonly shapes: ReadonlyArray<TemplateShapeIndexEntry>;
};
