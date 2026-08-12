type ReadonlyRecord = Readonly<Record<string, unknown>>;

type ErrorJson = Readonly<{
  code: string;
  pointer: string;
}>;

type CapabilityRuntime = Readonly<{
  runtimeVersion: "0.1.0";
  runtimeType: "capability-runtime";
  capabilityRegistryId: string;
  registryVersion: string;
  knownCapabilityCount: number;
  executableCapabilityCount: number;
}>;

type SchemaRegistry = ReadonlyMap<string, unknown>;

type SchemaOptions = Readonly<{
  expectedId?: string;
  registry?: SchemaRegistry;
}>;

type ValidationOptions = Readonly<{
  rootSchema?: unknown;
  registry?: SchemaRegistry;
  pointer?: string;
}>;

type ValidationFinding = Readonly<{
  pointer: string;
  keyword: string;
}>;

type StrictXmlAttribute = Readonly<{
  namespaceURI: string;
  localName: string;
  value: string;
}>;

type StrictXmlNode = Readonly<{
  namespaceURI: string;
  localName: string;
  key: string;
  attributes: ReadonlyMap<string, StrictXmlAttribute>;
  children: ReadonlyArray<StrictXmlNode>;
  text: string;
}>;

type StrictXmlDocument = Readonly<{
  root: StrictXmlNode;
  namespaceUris: ReadonlySet<string>;
  counts: Readonly<{
    elements: number;
    attributes: number;
  }>;
}>;

export declare class CapabilityRuntimeError extends Error {
  constructor(code: string, pointer?: string);
  readonly code: string;
  readonly pointer: string;
  toJSON(): ErrorJson;
}

export declare function createCapabilityRuntime(options: Readonly<{
  capabilityRegistry: unknown;
  registrations: ReadonlyArray<unknown>;
  dependencies: ReadonlyRecord;
}>): Promise<CapabilityRuntime>;

export declare function assertSupportedSchema(
  schema: unknown,
  options?: SchemaOptions
): void;

export declare function createSchemaRegistry(
  schemas: Iterable<ReadonlyRecord & Readonly<{ $id: string }>>
): SchemaRegistry;

export declare function validateJson(
  instance: unknown,
  schema: unknown,
  options?: ValidationOptions
): ReadonlyArray<ValidationFinding>;

export declare class StrictXmlError extends Error {
  constructor(code: string, pointer?: string);
  readonly code: string;
  readonly pointer: string;
  toJSON(): ErrorJson;
}

export declare function parseStrictXml(input: Uint8Array): StrictXmlDocument;
