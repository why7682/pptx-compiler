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

export type CandidateBuildRecord = {
  readonly schemaVersion: "0.1.0";
  readonly contractType: "candidate-build-record";
  readonly candidateVersion: "0.1.0";
  readonly artifactType: "candidate-pptx";
  readonly verificationProfile: "authenticated-native-candidate-artifact";
  readonly deliveryEligible: false;
  readonly sourceArtifactType: "native-card-arrow-assembled-pptx";
  readonly sourceVerificationProfile: "target-specific-native-card-arrow-output";
  readonly baseArtifactSha256: string;
  readonly output: {
    readonly fileName: string;
    readonly sha256: string;
    readonly byteLength: number;
  };
  readonly slide: {
    readonly slideId: string;
    readonly slidePart: string;
    readonly layoutIr: {
      readonly layoutIrVersion: "0.1.0";
      readonly layoutIrType: "slide-layout-ir";
      readonly inputProfile: "bounded-slot-placement";
      readonly slideId: string;
      readonly canvas: {
        readonly x: 0;
        readonly y: 0;
        readonly cx: number;
        readonly cy: number;
      };
      readonly slots: ReadonlyArray<{
        readonly slotId: string;
        readonly parentNodeId: "slide-canvas";
        readonly outerBox: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly padding: {
          readonly top: number;
          readonly right: number;
          readonly bottom: number;
          readonly left: number;
        };
        readonly contentBox: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly alignX: "start" | "center" | "end";
        readonly alignY: "start" | "center" | "end";
        readonly allowedSourceKind: "native-component";
        readonly allowedSourceRef: "native-card-arrow";
        readonly overflowPolicy: "reject";
        readonly capacity: {
          readonly minChildren: 1;
          readonly maxChildren: 1;
        };
      }>;
      readonly placementRequests: ReadonlyArray<{
        readonly nodeId: string;
        readonly sourceKind: "native-component";
        readonly sourceRef: "native-card-arrow";
        readonly role: "content";
        readonly slotRef: string;
        readonly size: {
          readonly cx: number;
          readonly cy: number;
        };
        readonly paintOutsetEmu: number;
        readonly zOrder: number;
        readonly placementIntent: "slot-aligned-fixed";
      }>;
      readonly nodes: ReadonlyArray<{
        readonly nodeId: string;
        readonly sourceKind: "template-shape";
        readonly sourceRef: string;
        readonly parentNodeId: string;
        readonly semanticSlotId: string;
        readonly role: "background" | "content" | "decoration";
        readonly positionMode: "absolute" | "flow";
        readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
        readonly sizing: {
          readonly horizontal: "fixed";
          readonly vertical: "fixed";
          readonly minCx: number;
          readonly maxCx: number;
          readonly minCy: number;
          readonly maxCy: number;
        };
        readonly requestedBox: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly paintOutset: {
          readonly top: number;
          readonly right: number;
          readonly bottom: number;
          readonly left: number;
        };
        readonly zOrder: number;
        readonly collisionPolicy: "allow" | "forbid";
      } | {
        readonly nodeId: string;
        readonly sourceKind: "native-component";
        readonly sourceRef: "native-card-arrow";
        readonly parentNodeId: string;
        readonly semanticSlotId: string;
        readonly role: "background" | "content" | "decoration";
        readonly positionMode: "absolute" | "flow";
        readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
        readonly sizing: {
          readonly horizontal: "fixed";
          readonly vertical: "fixed";
          readonly minCx: number;
          readonly maxCx: number;
          readonly minCy: number;
          readonly maxCy: number;
        };
        readonly requestedBox: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly paintOutset: {
          readonly top: number;
          readonly right: number;
          readonly bottom: number;
          readonly left: number;
        };
        readonly zOrder: number;
        readonly collisionPolicy: "allow" | "forbid";
      }>;
      readonly constraints: ReadonlyArray<{
        readonly constraintId: string;
        readonly constraintType: "containment" | "slot-containment" | "pairwise-non-overlap";
        readonly containerNodeId: string;
        readonly subjectNodeIds: ReadonlyArray<string>;
      }>;
    };
    readonly composedSlidePlan: {
      readonly planVersion: "0.1.0";
      readonly planType: "composed-slide-plan";
      readonly layoutIrDigest: string;
      readonly slideId: string;
      readonly canvas: {
        readonly x: 0;
        readonly y: 0;
        readonly cx: number;
        readonly cy: number;
      };
      readonly slots: ReadonlyArray<{
        readonly slotId: string;
        readonly parentNodeId: "slide-canvas";
        readonly outerBox: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly padding: {
          readonly top: number;
          readonly right: number;
          readonly bottom: number;
          readonly left: number;
        };
        readonly contentBox: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly alignX: "start" | "center" | "end";
        readonly alignY: "start" | "center" | "end";
        readonly allowedSourceKind: "native-component";
        readonly allowedSourceRef: "native-card-arrow";
        readonly overflowPolicy: "reject";
        readonly capacity: {
          readonly minChildren: 1;
          readonly maxChildren: 1;
        };
      }>;
      readonly nodes: ReadonlyArray<{
        readonly nodeId: string;
        readonly sourceKind: "template-shape";
        readonly sourceRef: string;
        readonly parentNodeId: string;
        readonly semanticSlotId: string;
        readonly role: "background" | "content" | "decoration";
        readonly positionMode: "absolute" | "flow";
        readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
        readonly box: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly paintBounds: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly zOrder: number;
        readonly collisionPolicy: "allow" | "forbid";
      } | {
        readonly nodeId: string;
        readonly sourceKind: "native-component";
        readonly sourceRef: "native-card-arrow";
        readonly parentNodeId: string;
        readonly semanticSlotId: string;
        readonly role: "background" | "content" | "decoration";
        readonly positionMode: "absolute" | "flow";
        readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
        readonly box: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly paintBounds: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly zOrder: number;
        readonly collisionPolicy: "allow" | "forbid";
      }>;
      readonly constraintReceipt: {
        readonly receiptVersion: "0.1.0";
        readonly status: "pass";
        readonly checkedConstraintIds: ReadonlyArray<string>;
        readonly containmentChecks: ReadonlyArray<{
          readonly nodeId: string;
          readonly status: "pass";
        }>;
        readonly slotChecks: ReadonlyArray<{
          readonly nodeId: string;
          readonly slotId: string;
          readonly status: "pass";
        }>;
        readonly occupancyChecks: ReadonlyArray<{
          readonly leftNodeId: string;
          readonly rightNodeId: string;
          readonly status: "clear";
        }>;
      };
      readonly planDigest: string;
    };
    readonly diff: {
      readonly addedParts: ReadonlyArray<string>;
      readonly removedParts: ReadonlyArray<string>;
      readonly modifiedParts: ReadonlyArray<string>;
      readonly allowedChanges: ReadonlyArray<{
        readonly partPath: string;
        readonly reason: "native-card-arrow-insertion";
      }>;
      readonly collateralChanges: ReadonlyArray<string>;
    };
    readonly capabilityEvidence: {
      readonly evidenceType: "native-card-arrow";
      readonly allocatedShapeIds: ReadonlyArray<number>;
    };
  };
} | {
  readonly schemaVersion: "0.1.0";
  readonly contractType: "candidate-build-record";
  readonly candidateVersion: "0.1.0";
  readonly artifactType: "candidate-pptx";
  readonly verificationProfile: "authenticated-native-candidate-artifact";
  readonly deliveryEligible: false;
  readonly sourceArtifactType: "native-omml-formula-assembled-pptx";
  readonly sourceVerificationProfile: "target-specific-native-omml-formula-output";
  readonly baseArtifactSha256: string;
  readonly output: {
    readonly fileName: string;
    readonly sha256: string;
    readonly byteLength: number;
  };
  readonly slide: {
    readonly slideId: string;
    readonly slidePart: string;
    readonly layoutIr: {
      readonly layoutIrVersion: "0.1.0";
      readonly layoutIrType: "slide-layout-ir";
      readonly inputProfile: "bounded-slot-placement";
      readonly slideId: string;
      readonly canvas: {
        readonly x: 0;
        readonly y: 0;
        readonly cx: number;
        readonly cy: number;
      };
      readonly slots: ReadonlyArray<{
        readonly slotId: string;
        readonly parentNodeId: "slide-canvas";
        readonly outerBox: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly padding: {
          readonly top: number;
          readonly right: number;
          readonly bottom: number;
          readonly left: number;
        };
        readonly contentBox: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly alignX: "start" | "center" | "end";
        readonly alignY: "start" | "center" | "end";
        readonly allowedSourceKind: "native-component";
        readonly allowedSourceRef: "native-omml-formula";
        readonly overflowPolicy: "reject";
        readonly capacity: {
          readonly minChildren: 1;
          readonly maxChildren: 1;
        };
      }>;
      readonly placementRequests: ReadonlyArray<{
        readonly nodeId: string;
        readonly sourceKind: "native-component";
        readonly sourceRef: "native-omml-formula";
        readonly role: "content";
        readonly slotRef: string;
        readonly size: {
          readonly cx: number;
          readonly cy: number;
        };
        readonly paintOutsetEmu: number;
        readonly zOrder: number;
        readonly placementIntent: "slot-aligned-fixed";
      }>;
      readonly nodes: ReadonlyArray<{
        readonly nodeId: string;
        readonly sourceKind: "template-shape";
        readonly sourceRef: string;
        readonly parentNodeId: string;
        readonly semanticSlotId: string;
        readonly role: "background" | "content" | "decoration";
        readonly positionMode: "absolute" | "flow";
        readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
        readonly sizing: {
          readonly horizontal: "fixed";
          readonly vertical: "fixed";
          readonly minCx: number;
          readonly maxCx: number;
          readonly minCy: number;
          readonly maxCy: number;
        };
        readonly requestedBox: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly paintOutset: {
          readonly top: number;
          readonly right: number;
          readonly bottom: number;
          readonly left: number;
        };
        readonly zOrder: number;
        readonly collisionPolicy: "allow" | "forbid";
      } | {
        readonly nodeId: string;
        readonly sourceKind: "native-component";
        readonly sourceRef: "native-omml-formula";
        readonly parentNodeId: string;
        readonly semanticSlotId: string;
        readonly role: "background" | "content" | "decoration";
        readonly positionMode: "absolute" | "flow";
        readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
        readonly sizing: {
          readonly horizontal: "fixed";
          readonly vertical: "fixed";
          readonly minCx: number;
          readonly maxCx: number;
          readonly minCy: number;
          readonly maxCy: number;
        };
        readonly requestedBox: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly paintOutset: {
          readonly top: number;
          readonly right: number;
          readonly bottom: number;
          readonly left: number;
        };
        readonly zOrder: number;
        readonly collisionPolicy: "allow" | "forbid";
      }>;
      readonly constraints: ReadonlyArray<{
        readonly constraintId: string;
        readonly constraintType: "containment" | "slot-containment" | "pairwise-non-overlap";
        readonly containerNodeId: string;
        readonly subjectNodeIds: ReadonlyArray<string>;
      }>;
    };
    readonly composedSlidePlan: {
      readonly planVersion: "0.1.0";
      readonly planType: "composed-slide-plan";
      readonly layoutIrDigest: string;
      readonly slideId: string;
      readonly canvas: {
        readonly x: 0;
        readonly y: 0;
        readonly cx: number;
        readonly cy: number;
      };
      readonly slots: ReadonlyArray<{
        readonly slotId: string;
        readonly parentNodeId: "slide-canvas";
        readonly outerBox: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly padding: {
          readonly top: number;
          readonly right: number;
          readonly bottom: number;
          readonly left: number;
        };
        readonly contentBox: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly alignX: "start" | "center" | "end";
        readonly alignY: "start" | "center" | "end";
        readonly allowedSourceKind: "native-component";
        readonly allowedSourceRef: "native-omml-formula";
        readonly overflowPolicy: "reject";
        readonly capacity: {
          readonly minChildren: 1;
          readonly maxChildren: 1;
        };
      }>;
      readonly nodes: ReadonlyArray<{
        readonly nodeId: string;
        readonly sourceKind: "template-shape";
        readonly sourceRef: string;
        readonly parentNodeId: string;
        readonly semanticSlotId: string;
        readonly role: "background" | "content" | "decoration";
        readonly positionMode: "absolute" | "flow";
        readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
        readonly box: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly paintBounds: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly zOrder: number;
        readonly collisionPolicy: "allow" | "forbid";
      } | {
        readonly nodeId: string;
        readonly sourceKind: "native-component";
        readonly sourceRef: "native-omml-formula";
        readonly parentNodeId: string;
        readonly semanticSlotId: string;
        readonly role: "background" | "content" | "decoration";
        readonly positionMode: "absolute" | "flow";
        readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
        readonly box: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly paintBounds: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly zOrder: number;
        readonly collisionPolicy: "allow" | "forbid";
      }>;
      readonly constraintReceipt: {
        readonly receiptVersion: "0.1.0";
        readonly status: "pass";
        readonly checkedConstraintIds: ReadonlyArray<string>;
        readonly containmentChecks: ReadonlyArray<{
          readonly nodeId: string;
          readonly status: "pass";
        }>;
        readonly slotChecks: ReadonlyArray<{
          readonly nodeId: string;
          readonly slotId: string;
          readonly status: "pass";
        }>;
        readonly occupancyChecks: ReadonlyArray<{
          readonly leftNodeId: string;
          readonly rightNodeId: string;
          readonly status: "clear";
        }>;
      };
      readonly planDigest: string;
    };
    readonly diff: {
      readonly addedParts: ReadonlyArray<string>;
      readonly removedParts: ReadonlyArray<string>;
      readonly modifiedParts: ReadonlyArray<string>;
      readonly allowedChanges: ReadonlyArray<{
        readonly partPath: string;
        readonly reason: "native-omml-formula-replacement";
      }>;
      readonly collateralChanges: ReadonlyArray<string>;
    };
    readonly capabilityEvidence: {
      readonly evidenceType: "native-omml-formula";
      readonly formulaDigest: string;
      readonly formulaTarget: {
        readonly targetShapeKey: string;
        readonly sourceId: number;
        readonly geometry: {
          readonly x: number;
          readonly y: number;
          readonly cx: number;
          readonly cy: number;
        };
        readonly structureProfile: "powerpoint-office-2010-text-math";
        readonly fontSizeHundredthPoints: 4800;
        readonly typeface: "Cambria Math";
        readonly capacity: {
          readonly maxElements: 64;
          readonly maxRuns: 16;
          readonly maxTextBytes: 256;
        };
        readonly observed: {
          readonly elements: number;
          readonly runs: number;
          readonly textBytes: number;
        };
        readonly status: "pass";
      };
    };
  };
} | {
  readonly schemaVersion: "0.1.0";
  readonly contractType: "candidate-build-record";
  readonly candidateVersion: "0.1.0";
  readonly artifactType: "candidate-pptx";
  readonly verificationProfile: "authenticated-ordered-candidate-artifact";
  readonly deliveryEligible: false;
  readonly sourceArtifactType: "ordered-assembled-pptx";
  readonly baseArtifactSha256: string;
  readonly output: {
    readonly fileName: string;
    readonly sha256: string;
    readonly byteLength: number;
  };
  readonly deck: {
    readonly assemblyVersion: "0.1.0";
    readonly slides: ReadonlyArray<{
      readonly slideId: string;
      readonly order: number;
      readonly slidePart: string;
      readonly relationshipsPartPath: string;
      readonly presentationSlideId: number;
      readonly relationshipId: string;
      readonly sourceArtifactSha256: string;
      readonly sourceBuild: {
        readonly buildType: "clone-fill-source";
        readonly artifactType: "assembled-pptx";
      };
    } | {
      readonly slideId: string;
      readonly order: number;
      readonly slidePart: string;
      readonly relationshipsPartPath: string;
      readonly presentationSlideId: number;
      readonly relationshipId: string;
      readonly sourceArtifactSha256: string;
      readonly sourceBuild: {
        readonly buildType: "native-card-arrow-source";
        readonly artifactType: "native-card-arrow-assembled-pptx";
        readonly verificationProfile: "target-specific-native-card-arrow-output";
        readonly baseArtifactSha256: string;
        readonly sourceSlidePart: string;
        readonly layoutIr: {
          readonly layoutIrVersion: "0.1.0";
          readonly layoutIrType: "slide-layout-ir";
          readonly inputProfile: "bounded-slot-placement";
          readonly slideId: string;
          readonly canvas: {
            readonly x: 0;
            readonly y: 0;
            readonly cx: number;
            readonly cy: number;
          };
          readonly slots: ReadonlyArray<{
            readonly slotId: string;
            readonly parentNodeId: "slide-canvas";
            readonly outerBox: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly padding: {
              readonly top: number;
              readonly right: number;
              readonly bottom: number;
              readonly left: number;
            };
            readonly contentBox: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly alignX: "start" | "center" | "end";
            readonly alignY: "start" | "center" | "end";
            readonly allowedSourceKind: "native-component";
            readonly allowedSourceRef: "native-card-arrow";
            readonly overflowPolicy: "reject";
            readonly capacity: {
              readonly minChildren: 1;
              readonly maxChildren: 1;
            };
          }>;
          readonly placementRequests: ReadonlyArray<{
            readonly nodeId: string;
            readonly sourceKind: "native-component";
            readonly sourceRef: "native-card-arrow";
            readonly role: "content";
            readonly slotRef: string;
            readonly size: {
              readonly cx: number;
              readonly cy: number;
            };
            readonly paintOutsetEmu: number;
            readonly zOrder: number;
            readonly placementIntent: "slot-aligned-fixed";
          }>;
          readonly nodes: ReadonlyArray<{
            readonly nodeId: string;
            readonly sourceKind: "template-shape";
            readonly sourceRef: string;
            readonly parentNodeId: string;
            readonly semanticSlotId: string;
            readonly role: "background" | "content" | "decoration";
            readonly positionMode: "absolute" | "flow";
            readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
            readonly sizing: {
              readonly horizontal: "fixed";
              readonly vertical: "fixed";
              readonly minCx: number;
              readonly maxCx: number;
              readonly minCy: number;
              readonly maxCy: number;
            };
            readonly requestedBox: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly paintOutset: {
              readonly top: number;
              readonly right: number;
              readonly bottom: number;
              readonly left: number;
            };
            readonly zOrder: number;
            readonly collisionPolicy: "allow" | "forbid";
          } | {
            readonly nodeId: string;
            readonly sourceKind: "native-component";
            readonly sourceRef: "native-card-arrow";
            readonly parentNodeId: string;
            readonly semanticSlotId: string;
            readonly role: "background" | "content" | "decoration";
            readonly positionMode: "absolute" | "flow";
            readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
            readonly sizing: {
              readonly horizontal: "fixed";
              readonly vertical: "fixed";
              readonly minCx: number;
              readonly maxCx: number;
              readonly minCy: number;
              readonly maxCy: number;
            };
            readonly requestedBox: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly paintOutset: {
              readonly top: number;
              readonly right: number;
              readonly bottom: number;
              readonly left: number;
            };
            readonly zOrder: number;
            readonly collisionPolicy: "allow" | "forbid";
          }>;
          readonly constraints: ReadonlyArray<{
            readonly constraintId: string;
            readonly constraintType: "containment" | "slot-containment" | "pairwise-non-overlap";
            readonly containerNodeId: string;
            readonly subjectNodeIds: ReadonlyArray<string>;
          }>;
        };
        readonly composedSlidePlan: {
          readonly planVersion: "0.1.0";
          readonly planType: "composed-slide-plan";
          readonly layoutIrDigest: string;
          readonly slideId: string;
          readonly canvas: {
            readonly x: 0;
            readonly y: 0;
            readonly cx: number;
            readonly cy: number;
          };
          readonly slots: ReadonlyArray<{
            readonly slotId: string;
            readonly parentNodeId: "slide-canvas";
            readonly outerBox: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly padding: {
              readonly top: number;
              readonly right: number;
              readonly bottom: number;
              readonly left: number;
            };
            readonly contentBox: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly alignX: "start" | "center" | "end";
            readonly alignY: "start" | "center" | "end";
            readonly allowedSourceKind: "native-component";
            readonly allowedSourceRef: "native-card-arrow";
            readonly overflowPolicy: "reject";
            readonly capacity: {
              readonly minChildren: 1;
              readonly maxChildren: 1;
            };
          }>;
          readonly nodes: ReadonlyArray<{
            readonly nodeId: string;
            readonly sourceKind: "template-shape";
            readonly sourceRef: string;
            readonly parentNodeId: string;
            readonly semanticSlotId: string;
            readonly role: "background" | "content" | "decoration";
            readonly positionMode: "absolute" | "flow";
            readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
            readonly box: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly paintBounds: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly zOrder: number;
            readonly collisionPolicy: "allow" | "forbid";
          } | {
            readonly nodeId: string;
            readonly sourceKind: "native-component";
            readonly sourceRef: "native-card-arrow";
            readonly parentNodeId: string;
            readonly semanticSlotId: string;
            readonly role: "background" | "content" | "decoration";
            readonly positionMode: "absolute" | "flow";
            readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
            readonly box: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly paintBounds: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly zOrder: number;
            readonly collisionPolicy: "allow" | "forbid";
          }>;
          readonly constraintReceipt: {
            readonly receiptVersion: "0.1.0";
            readonly status: "pass";
            readonly checkedConstraintIds: ReadonlyArray<string>;
            readonly containmentChecks: ReadonlyArray<{
              readonly nodeId: string;
              readonly status: "pass";
            }>;
            readonly slotChecks: ReadonlyArray<{
              readonly nodeId: string;
              readonly slotId: string;
              readonly status: "pass";
            }>;
            readonly occupancyChecks: ReadonlyArray<{
              readonly leftNodeId: string;
              readonly rightNodeId: string;
              readonly status: "clear";
            }>;
          };
          readonly planDigest: string;
        };
        readonly diff: {
          readonly addedParts: ReadonlyArray<string>;
          readonly removedParts: ReadonlyArray<string>;
          readonly modifiedParts: ReadonlyArray<string>;
          readonly allowedChanges: ReadonlyArray<{
            readonly partPath: string;
            readonly reason: "native-card-arrow-insertion";
          }>;
          readonly collateralChanges: ReadonlyArray<string>;
        };
        readonly capabilityEvidence: {
          readonly evidenceType: "native-card-arrow";
          readonly allocatedShapeIds: ReadonlyArray<number>;
        };
      };
    } | {
      readonly slideId: string;
      readonly order: number;
      readonly slidePart: string;
      readonly relationshipsPartPath: string;
      readonly presentationSlideId: number;
      readonly relationshipId: string;
      readonly sourceArtifactSha256: string;
      readonly sourceBuild: {
        readonly buildType: "native-omml-formula-source";
        readonly artifactType: "native-omml-formula-assembled-pptx";
        readonly verificationProfile: "target-specific-native-omml-formula-output";
        readonly baseArtifactSha256: string;
        readonly sourceSlidePart: string;
        readonly layoutIr: {
          readonly layoutIrVersion: "0.1.0";
          readonly layoutIrType: "slide-layout-ir";
          readonly inputProfile: "bounded-slot-placement";
          readonly slideId: string;
          readonly canvas: {
            readonly x: 0;
            readonly y: 0;
            readonly cx: number;
            readonly cy: number;
          };
          readonly slots: ReadonlyArray<{
            readonly slotId: string;
            readonly parentNodeId: "slide-canvas";
            readonly outerBox: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly padding: {
              readonly top: number;
              readonly right: number;
              readonly bottom: number;
              readonly left: number;
            };
            readonly contentBox: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly alignX: "start" | "center" | "end";
            readonly alignY: "start" | "center" | "end";
            readonly allowedSourceKind: "native-component";
            readonly allowedSourceRef: "native-omml-formula";
            readonly overflowPolicy: "reject";
            readonly capacity: {
              readonly minChildren: 1;
              readonly maxChildren: 1;
            };
          }>;
          readonly placementRequests: ReadonlyArray<{
            readonly nodeId: string;
            readonly sourceKind: "native-component";
            readonly sourceRef: "native-omml-formula";
            readonly role: "content";
            readonly slotRef: string;
            readonly size: {
              readonly cx: number;
              readonly cy: number;
            };
            readonly paintOutsetEmu: number;
            readonly zOrder: number;
            readonly placementIntent: "slot-aligned-fixed";
          }>;
          readonly nodes: ReadonlyArray<{
            readonly nodeId: string;
            readonly sourceKind: "template-shape";
            readonly sourceRef: string;
            readonly parentNodeId: string;
            readonly semanticSlotId: string;
            readonly role: "background" | "content" | "decoration";
            readonly positionMode: "absolute" | "flow";
            readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
            readonly sizing: {
              readonly horizontal: "fixed";
              readonly vertical: "fixed";
              readonly minCx: number;
              readonly maxCx: number;
              readonly minCy: number;
              readonly maxCy: number;
            };
            readonly requestedBox: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly paintOutset: {
              readonly top: number;
              readonly right: number;
              readonly bottom: number;
              readonly left: number;
            };
            readonly zOrder: number;
            readonly collisionPolicy: "allow" | "forbid";
          } | {
            readonly nodeId: string;
            readonly sourceKind: "native-component";
            readonly sourceRef: "native-omml-formula";
            readonly parentNodeId: string;
            readonly semanticSlotId: string;
            readonly role: "background" | "content" | "decoration";
            readonly positionMode: "absolute" | "flow";
            readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
            readonly sizing: {
              readonly horizontal: "fixed";
              readonly vertical: "fixed";
              readonly minCx: number;
              readonly maxCx: number;
              readonly minCy: number;
              readonly maxCy: number;
            };
            readonly requestedBox: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly paintOutset: {
              readonly top: number;
              readonly right: number;
              readonly bottom: number;
              readonly left: number;
            };
            readonly zOrder: number;
            readonly collisionPolicy: "allow" | "forbid";
          }>;
          readonly constraints: ReadonlyArray<{
            readonly constraintId: string;
            readonly constraintType: "containment" | "slot-containment" | "pairwise-non-overlap";
            readonly containerNodeId: string;
            readonly subjectNodeIds: ReadonlyArray<string>;
          }>;
        };
        readonly composedSlidePlan: {
          readonly planVersion: "0.1.0";
          readonly planType: "composed-slide-plan";
          readonly layoutIrDigest: string;
          readonly slideId: string;
          readonly canvas: {
            readonly x: 0;
            readonly y: 0;
            readonly cx: number;
            readonly cy: number;
          };
          readonly slots: ReadonlyArray<{
            readonly slotId: string;
            readonly parentNodeId: "slide-canvas";
            readonly outerBox: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly padding: {
              readonly top: number;
              readonly right: number;
              readonly bottom: number;
              readonly left: number;
            };
            readonly contentBox: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly alignX: "start" | "center" | "end";
            readonly alignY: "start" | "center" | "end";
            readonly allowedSourceKind: "native-component";
            readonly allowedSourceRef: "native-omml-formula";
            readonly overflowPolicy: "reject";
            readonly capacity: {
              readonly minChildren: 1;
              readonly maxChildren: 1;
            };
          }>;
          readonly nodes: ReadonlyArray<{
            readonly nodeId: string;
            readonly sourceKind: "template-shape";
            readonly sourceRef: string;
            readonly parentNodeId: string;
            readonly semanticSlotId: string;
            readonly role: "background" | "content" | "decoration";
            readonly positionMode: "absolute" | "flow";
            readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
            readonly box: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly paintBounds: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly zOrder: number;
            readonly collisionPolicy: "allow" | "forbid";
          } | {
            readonly nodeId: string;
            readonly sourceKind: "native-component";
            readonly sourceRef: "native-omml-formula";
            readonly parentNodeId: string;
            readonly semanticSlotId: string;
            readonly role: "background" | "content" | "decoration";
            readonly positionMode: "absolute" | "flow";
            readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
            readonly box: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly paintBounds: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly zOrder: number;
            readonly collisionPolicy: "allow" | "forbid";
          }>;
          readonly constraintReceipt: {
            readonly receiptVersion: "0.1.0";
            readonly status: "pass";
            readonly checkedConstraintIds: ReadonlyArray<string>;
            readonly containmentChecks: ReadonlyArray<{
              readonly nodeId: string;
              readonly status: "pass";
            }>;
            readonly slotChecks: ReadonlyArray<{
              readonly nodeId: string;
              readonly slotId: string;
              readonly status: "pass";
            }>;
            readonly occupancyChecks: ReadonlyArray<{
              readonly leftNodeId: string;
              readonly rightNodeId: string;
              readonly status: "clear";
            }>;
          };
          readonly planDigest: string;
        };
        readonly diff: {
          readonly addedParts: ReadonlyArray<string>;
          readonly removedParts: ReadonlyArray<string>;
          readonly modifiedParts: ReadonlyArray<string>;
          readonly allowedChanges: ReadonlyArray<{
            readonly partPath: string;
            readonly reason: "native-omml-formula-replacement";
          }>;
          readonly collateralChanges: ReadonlyArray<string>;
        };
        readonly capabilityEvidence: {
          readonly evidenceType: "native-omml-formula";
          readonly formulaDigest: string;
          readonly formulaTarget: {
            readonly targetShapeKey: string;
            readonly sourceId: number;
            readonly geometry: {
              readonly x: number;
              readonly y: number;
              readonly cx: number;
              readonly cy: number;
            };
            readonly structureProfile: "powerpoint-office-2010-text-math";
            readonly fontSizeHundredthPoints: 4800;
            readonly typeface: "Cambria Math";
            readonly capacity: {
              readonly maxElements: 64;
              readonly maxRuns: 16;
              readonly maxTextBytes: 256;
            };
            readonly observed: {
              readonly elements: number;
              readonly runs: number;
              readonly textBytes: number;
            };
            readonly status: "pass";
          };
        };
      };
    }>;
    readonly diff: {
      readonly addedParts: ReadonlyArray<"[Content_Types].xml" | string>;
      readonly removedParts: ReadonlyArray<"[Content_Types].xml" | string>;
      readonly modifiedParts: ReadonlyArray<"[Content_Types].xml" | string>;
      readonly allowedChanges: ReadonlyArray<{
        readonly partPath: "[Content_Types].xml" | string;
        readonly reason: "ordered-slide-content-types" | "ordered-slide-owner-list" | "ordered-slide-relationships" | "normalized-slide-layout-relationship" | "cloned-slide-content";
      }>;
      readonly collateralChanges: ReadonlyArray<"[Content_Types].xml" | string>;
    };
  };
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

export type ComposedSlidePlan = {
  readonly planVersion: "0.1.0";
  readonly planType: "composed-slide-plan";
  readonly layoutIrDigest: string;
  readonly slideId: string;
  readonly canvas: {
    readonly x: 0;
    readonly y: 0;
    readonly cx: number;
    readonly cy: number;
  };
  readonly slots: ReadonlyArray<{
    readonly slotId: string;
    readonly parentNodeId: "slide-canvas";
    readonly outerBox: {
      readonly x: number;
      readonly y: number;
      readonly cx: number;
      readonly cy: number;
    };
    readonly padding: {
      readonly top: number;
      readonly right: number;
      readonly bottom: number;
      readonly left: number;
    };
    readonly contentBox: {
      readonly x: number;
      readonly y: number;
      readonly cx: number;
      readonly cy: number;
    };
    readonly alignX: "start" | "center" | "end";
    readonly alignY: "start" | "center" | "end";
    readonly allowedSourceKind: "template-shape" | "native-component";
    readonly allowedSourceRef: string;
    readonly overflowPolicy: "reject";
    readonly capacity: {
      readonly minChildren: 1;
      readonly maxChildren: 1;
    };
  }>;
  readonly nodes: ReadonlyArray<{
    readonly nodeId: string;
    readonly sourceKind: "template-shape" | "native-component";
    readonly sourceRef: string;
    readonly parentNodeId: string;
    readonly semanticSlotId: string;
    readonly role: "background" | "content" | "decoration";
    readonly positionMode: "absolute" | "flow";
    readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
    readonly box: {
      readonly x: number;
      readonly y: number;
      readonly cx: number;
      readonly cy: number;
    };
    readonly paintBounds: {
      readonly x: number;
      readonly y: number;
      readonly cx: number;
      readonly cy: number;
    };
    readonly zOrder: number;
    readonly collisionPolicy: "allow" | "forbid";
  }>;
  readonly constraintReceipt: {
    readonly receiptVersion: "0.1.0";
    readonly status: "pass";
    readonly checkedConstraintIds: ReadonlyArray<string>;
    readonly containmentChecks: ReadonlyArray<{
      readonly nodeId: string;
      readonly status: "pass";
    }>;
    readonly slotChecks: ReadonlyArray<{
      readonly nodeId: string;
      readonly slotId: string;
      readonly status: "pass";
    }>;
    readonly occupancyChecks: ReadonlyArray<{
      readonly leftNodeId: string;
      readonly rightNodeId: string;
      readonly status: "clear";
    }>;
  };
  readonly planDigest: string;
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

export type SlideLayoutIR = {
  readonly layoutIrVersion: "0.1.0";
  readonly layoutIrType: "slide-layout-ir";
  readonly inputProfile: "bounded-slot-placement";
  readonly slideId: string;
  readonly canvas: {
    readonly x: 0;
    readonly y: 0;
    readonly cx: number;
    readonly cy: number;
  };
  readonly slots: ReadonlyArray<{
    readonly slotId: string;
    readonly parentNodeId: "slide-canvas";
    readonly outerBox: {
      readonly x: number;
      readonly y: number;
      readonly cx: number;
      readonly cy: number;
    };
    readonly padding: {
      readonly top: number;
      readonly right: number;
      readonly bottom: number;
      readonly left: number;
    };
    readonly contentBox: {
      readonly x: number;
      readonly y: number;
      readonly cx: number;
      readonly cy: number;
    };
    readonly alignX: "start" | "center" | "end";
    readonly alignY: "start" | "center" | "end";
    readonly allowedSourceKind: "template-shape" | "native-component";
    readonly allowedSourceRef: string;
    readonly overflowPolicy: "reject";
    readonly capacity: {
      readonly minChildren: 1;
      readonly maxChildren: 1;
    };
  }>;
  readonly placementRequests: ReadonlyArray<{
    readonly nodeId: string;
    readonly sourceKind: "template-shape" | "native-component";
    readonly sourceRef: string;
    readonly role: "content";
    readonly slotRef: string;
    readonly size: {
      readonly cx: number;
      readonly cy: number;
    };
    readonly paintOutsetEmu: number;
    readonly zOrder: number;
    readonly placementIntent: "slot-aligned-fixed";
  }>;
  readonly nodes: ReadonlyArray<{
    readonly nodeId: string;
    readonly sourceKind: "template-shape" | "native-component";
    readonly sourceRef: string;
    readonly parentNodeId: string;
    readonly semanticSlotId: string;
    readonly role: "background" | "content" | "decoration";
    readonly positionMode: "absolute" | "flow";
    readonly placementIntent: "legacy-absolute-fixed" | "slot-aligned-fixed" | "template-fixed";
    readonly sizing: {
      readonly horizontal: "fixed";
      readonly vertical: "fixed";
      readonly minCx: number;
      readonly maxCx: number;
      readonly minCy: number;
      readonly maxCy: number;
    };
    readonly requestedBox: {
      readonly x: number;
      readonly y: number;
      readonly cx: number;
      readonly cy: number;
    };
    readonly paintOutset: {
      readonly top: number;
      readonly right: number;
      readonly bottom: number;
      readonly left: number;
    };
    readonly zOrder: number;
    readonly collisionPolicy: "allow" | "forbid";
  }>;
  readonly constraints: ReadonlyArray<{
    readonly constraintId: string;
    readonly constraintType: "containment" | "slot-containment" | "pairwise-non-overlap";
    readonly containerNodeId: string;
    readonly subjectNodeIds: ReadonlyArray<string>;
  }>;
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
