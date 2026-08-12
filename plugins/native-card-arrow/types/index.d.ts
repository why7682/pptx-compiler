export interface NativeCardArrowGeometry {
  readonly x: number;
  readonly y: number;
  readonly cx: number;
  readonly cy: number;
}

export interface NativeCardArrowStyle {
  readonly arrowFill: string;
  readonly cardFill: string;
  readonly fontSizeHundredthPoints: number;
  readonly lineColor: string;
  readonly textColor: string;
}

export interface NativeCardArrowPayload {
  readonly geometry: Readonly<NativeCardArrowGeometry>;
  readonly label: string;
  readonly style: Readonly<NativeCardArrowStyle>;
}

export interface NativeCardArrowBinding {
  readonly role: "anchor";
  readonly shapeBindingId: string;
  readonly containerKind: "slide";
  readonly containerKey: string;
  readonly shapeKey: string;
  readonly expectedKind: "text-box";
  readonly cardinality: "exactly-one";
}

export interface NativeCardArrowInvocation {
  readonly invocationId: string;
  readonly capabilitySelectionId: string;
  readonly capabilityId: "native-card-arrow";
  readonly capabilityVersion: "0.1.0";
  readonly experimentalOptIn: boolean;
  readonly payload: Readonly<NativeCardArrowPayload>;
  readonly bindings: readonly [Readonly<NativeCardArrowBinding>];
}

export interface NativeCardArrowPlan {
  readonly planVersion: "0.1.0";
  readonly planType: "native-card-arrow-plan";
  readonly outputSlideId: string;
  readonly clone: Readonly<{
    operationId: "clone-source-slide";
    operationType: "clone-slide";
    sourceContainerKind: "slide";
    sourceSlideKey: string;
  }>;
  readonly insert: Readonly<{
    operationId: "insert-native-card-arrow";
    operationType: "insert-drawingml-group-after-anchor";
    role: "anchor";
    anchorBindingId: string;
    anchorShapeKey: string;
    expectedKind: "text-box";
    idPolicy: "local-remap-required";
  }>;
  readonly component: Readonly<{
    componentType: "native-card-arrow";
    representation: "native-drawingml-group-shape";
    artifactKind: "unbound-drawingml-conformance-fragment";
    insertable: false;
    idScope: "component-local";
    localShapeIds: readonly [1, 2, 3];
    geometry: Readonly<NativeCardArrowGeometry>;
    label: string;
    style: Readonly<NativeCardArrowStyle>;
    unboundDrawingmlFragment: string;
  }>;
}

export interface NativeCardArrowQaAssertion {
  readonly assertionId:
    | "anchor-binding-contract"
    | "component-data-contract"
    | "native-shape-structure-contract"
    | "rendered-fragment-contract";
  readonly assert: (context: Readonly<{
    invocation: Readonly<NativeCardArrowInvocation>;
    output: Readonly<NativeCardArrowPlan>;
  }>) => boolean;
}

export interface NativeCardArrowConformanceFixture {
  readonly fixtureId: string;
  readonly invocation: Readonly<NativeCardArrowInvocation>;
  readonly expectedOutput: Readonly<NativeCardArrowPlan>;
}

export interface NativeCardArrowConformanceCases {
  readonly schemaVersion: 1;
  readonly fixturePurpose: "native-card-arrow-public-conformance";
  readonly capabilityId: "native-card-arrow";
  readonly capabilityVersion: "0.1.0";
  readonly fixtures: readonly NativeCardArrowConformanceFixture[];
}

export interface JsonSchemaDocument {
  readonly $id: string;
  readonly [key: string]: unknown;
}

export interface NativeCardArrowRegistration {
  readonly capabilityId: "native-card-arrow";
  readonly capabilityVersion: "0.1.0";
  readonly executor: Readonly<{
    executorId: "urn:pptx-compiler:capability:executor:native-card-arrow:0.1.0";
    preflight: typeof preflightNativeCardArrow;
    execute: typeof executeNativeCardArrow;
  }>;
  readonly inputSchema: Readonly<{
    schemaId: "urn:pptx-compiler:capability:schema:native-card-arrow-input:0.1.0";
    schema: Readonly<JsonSchemaDocument>;
    validate: (value: unknown) => boolean;
  }>;
  readonly outputSchema: Readonly<{
    schemaId: "urn:pptx-compiler:capability:schema:native-card-arrow-output:0.1.0";
    schema: Readonly<JsonSchemaDocument>;
    validate: (value: unknown) => boolean;
  }>;
  readonly conformanceFixtures: readonly NativeCardArrowConformanceFixture[];
  readonly qaContract: Readonly<{
    qaContractId: "urn:pptx-compiler:capability:qa:native-card-arrow:0.1.0";
    assertions: typeof nativeCardArrowQaAssertions;
  }>;
}

export declare class NativeCardArrowRegistrationError extends Error {
  readonly name: "NativeCardArrowRegistrationError";
  readonly code: "NATIVE_CARD_ARROW_REGISTRATION_INVALID";
  readonly pointer: string;
  constructor(pointer?: string);
}

export declare function preflightNativeCardArrow(invocation: unknown): boolean;

export declare function executeNativeCardArrow(
  invocation: Readonly<NativeCardArrowInvocation>
): NativeCardArrowPlan;

export declare const nativeCardArrowQaAssertions:
  readonly Readonly<NativeCardArrowQaAssertion>[];

export declare function createNativeCardArrowRegistration(options?: Readonly<{
  inputSchema: Readonly<JsonSchemaDocument>;
  outputSchema: Readonly<JsonSchemaDocument>;
  cases: Readonly<NativeCardArrowConformanceCases>;
}>): Readonly<NativeCardArrowRegistration>;
