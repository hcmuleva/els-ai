import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

export type PageFetcher<T> = (args: {
  page: number;
  limit: number;
  signal: AbortSignal;
}) => Promise<PaginatedResponse<T>>;

type CacheEntry<T> = {
  data: T[];
  totalCount: number;
  totalPages: number;
  ts: number;
};

export type UsePaginatedResourceOptions<T> = {
  /** Namespace + serialized filters. Changing this resets pagination to page 1 and drops the old cache. */
  cacheKey: string;
  pageSize?: number;
  fetchPage: PageFetcher<T>;
  /** When false, no fetching happens (e.g. tab not active). */
  enabled?: boolean;
  /** Persist pages to AsyncStorage so they survive remounts/app restarts. */
  persist?: boolean;
  /** Time-to-live for persisted entries (ms). Default 5 min. */
  ttlMs?: number;
  /** Debounce window for the network call when navigating rapidly (ms). Default 250. */
  debounceMs?: number;
};

export type UsePaginatedResourceResult<T> = {
  data: T[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  canPrev: boolean;
  canNext: boolean;
  goFirst: () => void;
  goPrev: () => void;
  goNext: () => void;
  goLast: () => void;
  goToPage: (page: number) => void;
  /** Force re-fetch of the current page and drop this resource's cache. */
  refresh: () => void;
  /** Retry the current page after an error. */
  retry: () => void;
};

const PERSIST_PREFIX = '@paginate';

function persistStorageKey(cacheKey: string, page: number) {
  return `${PERSIST_PREFIX}:${cacheKey}:page_${page}`;
}

export function usePaginatedResource<T>(
  options: UsePaginatedResourceOptions<T>,
): UsePaginatedResourceResult<T> {
  const {
    cacheKey,
    pageSize = 10,
    fetchPage,
    enabled = true,
    persist = false,
    ttlMs = 5 * 60 * 1000,
    debounceMs = 250,
  } = options;

  const [currentPage, setCurrentPage] = useState(1);
  const [data, setData] = useState<T[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In-memory cache for the *current* cacheKey only.
  const cacheRef = useRef<Map<number, CacheEntry<T>>>(new Map());
  const persistedPagesRef = useRef<Set<number>>(new Set());
  const cacheKeyRef = useRef(cacheKey);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightPageRef = useRef<number | null>(null);

  const clearMemoryCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const clearPersistedCache = useCallback(async (key: string) => {
    const pages = Array.from(persistedPagesRef.current);
    persistedPagesRef.current.clear();
    if (!pages.length) return;
    try {
      await AsyncStorage.multiRemove(pages.map((p) => persistStorageKey(key, p)));
    } catch {
      // ignore persistence failures
    }
  }, []);

  const applyEntry = useCallback((page: number, entry: CacheEntry<T>) => {
    setData(entry.data);
    setTotalCount(entry.totalCount);
    setTotalPages(Math.max(1, entry.totalPages));
    setLoading(false);
    setError(null);
    inFlightPageRef.current = null;
    // Clamp if the dataset shrank below the requested page.
    if (page > Math.max(1, entry.totalPages)) {
      setCurrentPage(Math.max(1, entry.totalPages));
    }
  }, []);

  const readPersisted = useCallback(
    async (key: string, page: number): Promise<CacheEntry<T> | null> => {
      if (!persist) return null;
      try {
        const raw = await AsyncStorage.getItem(persistStorageKey(key, page));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CacheEntry<T>;
        if (!parsed || typeof parsed.ts !== 'number') return null;
        if (Date.now() - parsed.ts > ttlMs) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    [persist, ttlMs],
  );

  const writePersisted = useCallback(
    async (key: string, page: number, entry: CacheEntry<T>) => {
      if (!persist) return;
      persistedPagesRef.current.add(page);
      try {
        await AsyncStorage.setItem(persistStorageKey(key, page), JSON.stringify(entry));
      } catch {
        // ignore persistence failures
      }
    },
    [persist],
  );

  const fetchFromNetwork = useCallback(
    async (key: string, page: number) => {
      // Cancel any prior in-flight request.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      inFlightPageRef.current = page;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPageRef.current({ page, limit: pageSize, signal: controller.signal });
        if (controller.signal.aborted || cacheKeyRef.current !== key) return;
        const entry: CacheEntry<T> = {
          data: res.data,
          totalCount: res.totalCount,
          totalPages: Math.max(1, res.totalPages),
          ts: Date.now(),
        };
        cacheRef.current.set(page, entry);
        void writePersisted(key, page, entry);
        applyEntry(page, entry);
      } catch (err) {
        if (controller.signal.aborted || cacheKeyRef.current !== key) return;
        // Fallback to any cached copy of this page if available.
        const cached = cacheRef.current.get(page);
        if (cached) {
          applyEntry(page, cached);
          return;
        }
        setLoading(false);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (inFlightPageRef.current === page) inFlightPageRef.current = null;
      }
    },
    [applyEntry, pageSize, writePersisted],
  );

  const resolvePage = useCallback(
    async (key: string, page: number, force = false) => {
      if (!enabled) return;

      if (!force) {
        const mem = cacheRef.current.get(page);
        if (mem) {
          applyEntry(page, mem);
          return;
        }
        const persisted = await readPersisted(key, page);
        if (persisted && cacheKeyRef.current === key) {
          cacheRef.current.set(page, persisted);
          applyEntry(page, persisted);
          return;
        }
      }

      // Not cached (or forced): debounce the network call so rapid clicks
      // collapse into a single request for the final page.
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setLoading(true);
      debounceTimerRef.current = setTimeout(() => {
        if (cacheKeyRef.current === key) void fetchFromNetwork(key, page);
      }, debounceMs);
    },
    [applyEntry, debounceMs, enabled, fetchFromNetwork, readPersisted],
  );

  // Reset everything when the cacheKey (filters/namespace) changes.
  useEffect(() => {
    const previousKey = cacheKeyRef.current;
    cacheKeyRef.current = cacheKey;
    if (previousKey !== cacheKey) {
      clearMemoryCache();
      void clearPersistedCache(previousKey);
      setCurrentPage(1);
      setError(null);
    }
    void resolvePage(cacheKey, previousKey !== cacheKey ? 1 : currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  // React to page changes for the same cacheKey.
  useEffect(() => {
    void resolvePage(cacheKeyRef.current, currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage((prev) => {
        const next = Math.min(Math.max(1, page), Math.max(1, totalPages));
        return next === prev ? prev : next;
      });
    },
    [totalPages],
  );

  const goFirst = useCallback(() => goToPage(1), [goToPage]);
  const goPrev = useCallback(() => setCurrentPage((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(
    () => setCurrentPage((p) => Math.min(Math.max(1, totalPages), p + 1)),
    [totalPages],
  );
  const goLast = useCallback(() => goToPage(totalPages), [goToPage, totalPages]);

  const refresh = useCallback(() => {
    clearMemoryCache();
    void clearPersistedCache(cacheKeyRef.current);
    void resolvePage(cacheKeyRef.current, currentPage, true);
  }, [clearMemoryCache, clearPersistedCache, currentPage, resolvePage]);

  const retry = useCallback(() => {
    void resolvePage(cacheKeyRef.current, currentPage, true);
  }, [currentPage, resolvePage]);

  return {
    data,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    loading,
    error,
    canPrev: currentPage > 1,
    canNext: currentPage < totalPages,
    goFirst,
    goPrev,
    goNext,
    goLast,
    goToPage,
    refresh,
    retry,
  };
}
