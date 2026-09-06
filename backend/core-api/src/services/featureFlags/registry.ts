// Static registry of everything that can be feature-flagged. Adding a new
// flag is a one-line addition here — no migration, no backfill — because
// `feature_flags` (see db.ts) only stores *overrides*; any organization
// with no override row for a key falls back to that key's `defaultEnabled`.
//
// This exists per CLIENT_PLAN.md item 11 ("feature flags... useful for
// rolling out AI features gradually") and PENDING_ITEMS.md #11. Scoped
// down by explicit decision to just this generic mechanism — no crash
// reporting/telemetry pipeline was requested this round.
export type FeatureFlagDef = {
  key: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
};

export const FEATURE_FLAG_REGISTRY: FeatureFlagDef[] = [
  {
    key: 'admin_school_analytics',
    label: 'Admin School Analytics',
    description:
      "Risk distribution, at-risk roster, and performance-trend forecast tab on the Admin dashboard. The risk levels and forecast are a score-threshold + linear-trend heuristic, not a trained model (see PENDING_ITEMS.md #10) — turn this off for a school if that isn't a good fit yet.",
    defaultEnabled: true,
  },
];

export const FEATURE_FLAG_KEYS: ReadonlySet<string> = new Set(
  FEATURE_FLAG_REGISTRY.map((def) => def.key),
);

export function getFlagDef(key: string): FeatureFlagDef | undefined {
  return FEATURE_FLAG_REGISTRY.find((def) => def.key === key);
}
