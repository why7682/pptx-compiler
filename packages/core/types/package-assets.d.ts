export interface CorePackageAssets {
  readonly packageRoot: string;
  readonly assetRoot: string;
  readonly contractRoot: string;
  readonly contractSchemaRoot: string;
  readonly contractFixtureRoot: string;
  readonly supportMatrixPath: string;
  readonly supportMatrixSchemaPath: string;
}

export declare const CORE_PACKAGE_ASSETS: Readonly<CorePackageAssets>;
