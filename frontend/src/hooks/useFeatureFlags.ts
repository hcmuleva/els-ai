/**
 * Feature flags: per-organization overrides of a small server-side
 * registry (backend/core-api/src/services/featureFlags/registry.ts). See
 * PENDING_ITEMS.md #11 for why this exists — CLIENT_PLAN.md item 11 calls
 * out "rolling out AI features gradually" as the motivating use case, so
 * an org's admin can turn a flagged feature on/off for their own school
 * without needing a deploy.
 *
 * Backed by React Query so every screen that calls useFeatureFlag()
 * shares one fetch/cache entry (`['feature-flags']`) instead of each
 * mounting its own request, and the Admin toggle UI's mutation just
 * refetches that same shared entry so every consumer updates at once.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

export type FeatureFlag = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
};

export function useFeatureFlags(): UseQueryResult<FeatureFlag[]> {
  const { apiFetch, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const res = await apiFetch('/feature-flags');
      if (!res.ok) throw new Error('Failed to load feature flags');
      const data = await res.json();
      return (data.flags ?? []) as FeatureFlag[];
    },
    enabled: isAuthenticated,
  });
}

/**
 * Convenience for gating one feature. Fails OPEN — returns `fallback`
 * (default true) while loading or if the fetch errors — so a network
 * hiccup never hides a feature that's supposed to be on. Same rule
 * already used for the AI provider fallback chain (agents/router.ts):
 * an infra problem shouldn't make behavior *more* restrictive than the
 * code otherwise would.
 */
export function useFeatureFlag(key: string, fallback = true): boolean {
  const { data, isLoading, isError } = useFeatureFlags();
  if (isLoading || isError) return fallback;
  const flag = data?.find((f) => f.key === key);
  return flag ? flag.enabled : fallback;
}
