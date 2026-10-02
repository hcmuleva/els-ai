import { useEffect, useState } from 'react';
import { STANDARD_OPTIONS } from '../constants/standards';
import { useAuth } from '../context/AuthContext';

export type DynamicClassLevel = {
  value: string;
  label: string;
  isAny?: boolean;
  displayOrder?: number;
};

let cachedClassLevels: DynamicClassLevel[] | null = null;
let inFlightFetch: Promise<DynamicClassLevel[]> | null = null;

export function useClassLevels() {
  const { apiFetch } = useAuth();
  const [classLevels, setClassLevels] = useState<DynamicClassLevel[]>(
    cachedClassLevels || STANDARD_OPTIONS.map((s) => ({ value: s.value, label: s.label }))
  );
  const [loading, setLoading] = useState(!cachedClassLevels);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchClasses() {
      if (cachedClassLevels) {
        setClassLevels(cachedClassLevels);
        setLoading(false);
        return;
      }

      if (!inFlightFetch) {
        inFlightFetch = (async () => {
          try {
            const res = await apiFetch('/class-levels');
            if (!res.ok) {
              // Try fallback to /users/class-levels
              const fallbackRes = await apiFetch('/users/class-levels');
              if (!fallbackRes.ok) return STANDARD_OPTIONS.map((s) => ({ value: s.value, label: s.label }));
              const data = await fallbackRes.json();
              return (data.classLevels || []).map((cl: any) => ({
                value: cl.code,
                label: cl.label,
                isAny: Boolean(cl.is_any),
                displayOrder: cl.display_order ?? 0,
              }));
            }
            const data = await res.json();
            const list: DynamicClassLevel[] = (data.classLevels || []).map((cl: any) => ({
              value: cl.code,
              label: cl.label,
              isAny: Boolean(cl.is_any),
              displayOrder: cl.display_order ?? 0,
            }));
            return list.length > 0 ? list : STANDARD_OPTIONS.map((s) => ({ value: s.value, label: s.label }));
          } catch (e: any) {
            console.warn('[useClassLevels] error fetching class levels', e);
            return STANDARD_OPTIONS.map((s) => ({ value: s.value, label: s.label }));
          } finally {
            inFlightFetch = null;
          }
        })();
      }

      try {
        const fetched = await inFlightFetch;
        cachedClassLevels = fetched;
        if (isMounted) {
          setClassLevels(fetched);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load class levels');
          setLoading(false);
        }
      }
    }

    fetchClasses();

    return () => {
      isMounted = false;
    };
  }, [apiFetch]);

  return { classLevels, loading, error };
}
