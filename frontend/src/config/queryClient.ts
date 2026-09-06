/**
 * Shared React Query client.
 * `refetchOnWindowFocus`/`refetchOnReconnect` are disabled because RN has no
 * browser window-focus event by default — screens instead refetch
 * explicitly on `useFocusEffect` (see `planner.tsx`), matching the refetch
 * timing the app already relied on before React Query was introduced.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
