import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

export type AppNotification = {
  id: string;
  userId: string;
  organizationId: string;
  type: string;
  category: 'classroom' | 'remark' | 'billing' | 'system' | string;
  title: string;
  message: string;
  status: 'unread' | 'read';
  ctaLabel?: string | null;
  ctaRoute?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string | null;
  expiryAt: string;
};

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteOne: (id: string) => Promise<void>;
  deleteRange: (range: 'hour' | 'day' | 'week' | 'all') => Promise<void>;
  deleteAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const POLL_FALLBACK_MS = 60_000;

export function NotificationProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, user, apiFetch } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ablyRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInitial = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        apiFetch('/notifications?limit=30'),
        apiFetch('/notifications/unread-count'),
      ]);
      if (listRes.ok) {
        const data = await listRes.json();
        setNotifications(data.notifications || []);
      }
      if (countRes.ok) {
        const data = await countRes.json();
        setUnreadCount(Number(data.count || 0));
      }
    } catch (err) {
      console.warn('[notifications] fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, isAuthenticated]);

  const startRealtime = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const tokenRes = await apiFetch('/notifications/ably-token', { method: 'POST' });
      if (!tokenRes.ok) {
        startPolling();
        return;
      }
      const { tokenRequest, channel } = await tokenRes.json();
      const AblyModule: any = await import('ably');
      const Realtime = AblyModule.Realtime || AblyModule.default?.Realtime;
      if (!Realtime) {
        console.warn('[notifications] ably SDK Realtime not found → polling');
        startPolling();
        return;
      }
      let cachedTokenRequest: any = tokenRequest;
      const client = new Realtime({
        authCallback: async (_params: any, cb: any) => {
          try {
            if (cachedTokenRequest) {
              const seed = cachedTokenRequest;
              cachedTokenRequest = null;
              cb(null, seed);
              return;
            }
            const refreshRes = await apiFetch('/notifications/ably-token', { method: 'POST' });
            if (!refreshRes.ok) throw new Error('token refresh failed');
            const refreshed = await refreshRes.json();
            cb(null, refreshed.tokenRequest);
          } catch (err) {
            cb(err as Error, null);
          }
        },
        autoConnect: true,
      });
      ablyRef.current = client;
      client.connection.on('connected', () => console.log('[notifications] ABLY CONNECTED'));
      client.connection.on('failed', (err: any) => console.error('[notifications] ABLY FAILED', err));
      client.connection.on('disconnected', () => console.warn('[notifications] ABLY DISCONNECTED'));
      const ch = client.channels.get(channel);
      channelRef.current = ch;
      ch.subscribe('new_notification', (msg: any) => {
        console.log('[notifications] ← new_notification', msg?.data);
        const incoming: AppNotification | undefined = msg?.data?.notification;
        if (!incoming) return;
        setNotifications((prev) => {
          const idx = prev.findIndex((n) => n.id === incoming.id);
          if (idx === -1) {
            if (incoming.status === 'unread') setUnreadCount((c) => c + 1);
            return [incoming, ...prev];
          }
          const wasUnread = prev[idx].status === 'unread';
          if (!wasUnread && incoming.status === 'unread') setUnreadCount((c) => c + 1);
          const next = prev.slice();
          next.splice(idx, 1);
          return [incoming, ...next];
        });
      });
      ch.subscribe('notification_read', (msg: any) => {
        console.log('[notifications] ← notification_read', msg?.data);
        const id = msg?.data?.id;
        if (!id) return;
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)));
        setUnreadCount((c) => Math.max(0, c - 1));
      });
      ch.subscribe('notification_deleted', (msg: any) => {
        console.log('[notifications] ← notification_deleted', msg?.data);
        const id = msg?.data?.id;
        if (!id) return;
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      });
      ch.subscribe('notifications_cleared', (msg: any) => {
        console.log('[notifications] ← notifications_cleared', msg?.data);
        fetchInitial();
      });
      console.log('[notifications] subscribed to all events on', channel);
    } catch (err) {
      console.warn('[notifications] realtime init failed, polling instead', err);
      startPolling();
    }
  }, [apiFetch, isAuthenticated, user?.id, fetchInitial]);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(() => {
      fetchInitial();
    }, POLL_FALLBACK_MS);
  }, [fetchInitial]);

  const stopRealtime = useCallback(() => {
    try { channelRef.current?.unsubscribe?.(); } catch (_e) { /* ignore */ }
    try { ablyRef.current?.close?.(); } catch (_e) { /* ignore */ }
    channelRef.current = null;
    ablyRef.current = null;
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      stopRealtime();
      return;
    }
    fetchInitial();
    startRealtime();
    return () => stopRealtime();
  }, [isAuthenticated, user?.id, fetchInitial, startRealtime, stopRealtime]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch (err) {
      console.warn('[notifications] markRead failed', err);
    }
  }, [apiFetch]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' })));
    setUnreadCount(0);
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
    } catch (err) {
      console.warn('[notifications] markAllRead failed', err);
    }
  }, [apiFetch]);

  const deleteOne = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('[notifications] deleteOne failed', err);
    }
  }, [apiFetch]);

  const deleteRange = useCallback(async (range: 'hour' | 'day' | 'week' | 'all') => {
    try {
      await apiFetch(`/notifications?range=${range}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('[notifications] deleteRange failed', err);
    }
    await fetchInitial();
  }, [apiFetch, fetchInitial]);

  const deleteAllRead = useCallback(async () => {
    setNotifications((prev) => prev.filter((n) => n.status !== 'read'));
    try {
      await apiFetch('/notifications/read-all', { method: 'DELETE' });
    } catch (err) {
      console.warn('[notifications] deleteAllRead failed', err);
    }
    await fetchInitial();
  }, [apiFetch, fetchInitial]);

  const value = useMemo(
    () => ({ notifications, unreadCount, loading, refresh: fetchInitial, markRead, markAllRead, deleteOne, deleteRange, deleteAllRead }),
    [notifications, unreadCount, loading, fetchInitial, markRead, markAllRead, deleteOne, deleteRange, deleteAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
}
