export interface PublicSyntheticPackageAssets {
  readonly packageRoot: string;
  readonly assetRoot: string;
  readonly fixtureSourceRoot: string;
  readonly expectedTemplateIndexPath: string;
}

export declare const PUBLIC_SYNTHETIC_PACKAGE_ASSETS:
  Readonly<PublicSyntheticPackageAssets>;
