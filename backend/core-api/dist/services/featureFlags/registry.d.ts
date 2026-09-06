export type FeatureFlagDef = {
    key: string;
    label: string;
    description: string;
    defaultEnabled: boolean;
};
export declare const FEATURE_FLAG_REGISTRY: FeatureFlagDef[];
export declare const FEATURE_FLAG_KEYS: ReadonlySet<string>;
export declare function getFlagDef(key: string): FeatureFlagDef | undefined;
//# sourceMappingURL=registry.d.ts.map