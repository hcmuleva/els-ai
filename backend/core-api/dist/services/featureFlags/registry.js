export const FEATURE_FLAG_REGISTRY = [
    {
        key: 'admin_school_analytics',
        label: 'Admin School Analytics',
        description: "Risk distribution, at-risk roster, and performance-trend forecast tab on the Admin dashboard. The risk levels and forecast are a score-threshold + linear-trend heuristic, not a trained model (see PENDING_ITEMS.md #10) — turn this off for a school if that isn't a good fit yet.",
        defaultEnabled: true,
    },
];
export const FEATURE_FLAG_KEYS = new Set(FEATURE_FLAG_REGISTRY.map((def) => def.key));
export function getFlagDef(key) {
    return FEATURE_FLAG_REGISTRY.find((def) => def.key === key);
}
//# sourceMappingURL=registry.js.map