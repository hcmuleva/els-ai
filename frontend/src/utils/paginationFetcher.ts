import type { PageFetcher } from '../hooks/usePaginatedResource';

type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;

/**
 * Builds a page fetcher for our backend, which uses `limit`/`offset` and returns
 * `{ [dataKey]: [...], total }`. Adapts 1-based page → offset on the frontend.
 */
export function createOffsetPageFetcher<T>(args: {
  apiFetch: ApiFetch;
  endpoint: string;
  dataKey: string;
  baseQuery?: URLSearchParams;
}): PageFetcher<T> {
  const { apiFetch, endpoint, dataKey, baseQuery } = args;
  return async ({ page, limit, signal }) => {
    const query = new URLSearchParams(baseQuery ? baseQuery.toString() : undefined);
    query.set('limit', String(limit));
    query.set('offset', String((page - 1) * limit));

    const res = await apiFetch(`${endpoint}?${query.toString()}`, { signal });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.message || `Failed to load ${dataKey}`);
    }
    const payload = await res.json();
    const rows = Array.isArray(payload[dataKey]) ? payload[dataKey] : [];
    const totalCount = Number(payload.total ?? rows.length);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    return { data: rows as T[], page, limit, totalCount, totalPages };
  };
}
