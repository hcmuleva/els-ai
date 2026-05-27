import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import {
  Bell,
  CheckCheck,
  BookOpen,
  Trophy,
  ClipboardList,
  Megaphone,
  GraduationCap,
  Receipt,
  X,
  Trash2,
  Video,
  ChevronRight,
} from 'lucide-react-native';
import { AppNotification, useNotifications } from '../../context/NotificationContext';

const CATEGORY_CONFIG: Record<string, { icon: any; bg: string; color: string }> = {
  classroom:   { icon: GraduationCap, bg: '#D6EAFF', color: '#4A90E2' },
  remark:      { icon: Megaphone,     bg: '#EDE4FF', color: '#9B8EC4' },
  billing:     { icon: Receipt,       bg: '#FFE8D6', color: '#FF7043' },
  assignment:  { icon: ClipboardList, bg: '#D6EAFF', color: '#4A90E2' },
  quiz:        { icon: BookOpen,      bg: '#FFE8D6', color: '#FF7043' },
  achievement: { icon: Trophy,        bg: '#FFF5CC', color: '#E6A817' },
  system:      { icon: Megaphone,     bg: '#EDE4FF', color: '#9B8EC4' },
};

function configFor(category: string) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.system;
}

function timeAgo(iso: string): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return '';
  const diff = Date.now() - created;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  const label = count > 9 ? '9+' : String(count);
  return (
    <View style={[b.badge, count > 9 && b.badgeWide]}>
      <Text style={b.badgeText}>{label}</Text>
    </View>
  );
}

const b = StyleSheet.create({
  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FFFFFF',
    zIndex: 10,
  },
  badgeWide: { paddingHorizontal: 3, borderRadius: 8 },
  badgeText: { fontSize: 9, fontWeight: '900', color: '#fff', lineHeight: 12 },
});

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead, deleteOne, deleteAllRead } = useNotifications();

  const handlePress = async (n: AppNotification) => {
    if (n.status === 'unread') await markRead(n.id);
    const meta: any = n.metadata || {};
    let target = n.ctaRoute;
    if (!target && n.category === 'classroom' && !meta.expired && meta.audience !== 'parent') {
      target = '/(tabs)/classroom';
    }
    if (!target) return;
    setOpen(false);
    try { router.push(target as any); } catch (_e) { /* ignore */ }
  };

  return (
    <View style={s.wrapper}>
      <Pressable onPress={() => setOpen(true)} style={s.bellBtn} accessibilityLabel="Notifications">
        <Bell size={20} color={'#5A5A7A'} strokeWidth={2} />
        <Badge count={unreadCount} />
      </Pressable>

      <NotificationPanel
        open={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
        onMarkAllRead={markAllRead}
        onDeleteAllRead={deleteAllRead}
        onItemPress={handlePress}
        onItemDelete={deleteOne}
        unreadCount={unreadCount}
      />
    </View>
  );
}

function NotificationPanel(props: {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onDeleteAllRead: () => void;
  onItemPress: (n: AppNotification) => void;
  onItemDelete: (id: string) => void;
}) {
  const { open, onClose, notifications, unreadCount, onMarkAllRead, onDeleteAllRead, onItemPress, onItemDelete } = props;
  const sorted = useMemo(() => [...notifications].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [notifications]);
  const readCount = useMemo(() => notifications.filter((n) => n.status === 'read').length, [notifications]);

  return (
    <Modal visible={open} animationType="slide" presentationStyle={Platform.OS === 'web' ? undefined : 'pageSheet'} onRequestClose={onClose} transparent={Platform.OS === 'web'}>
      <View style={p.container}>
        <View style={p.handle} />
        <View style={p.header}>
          <Text style={p.title}>Notifications</Text>
          <View style={p.headerRight}>
            {unreadCount > 0 ? (
              <TouchableOpacity onPress={onMarkAllRead} style={p.markAllBtn}>
                <CheckCheck size={14} color="#4A90E2" />
                <Text style={p.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            ) : null}
            {readCount > 0 ? (
              <TouchableOpacity onPress={onDeleteAllRead} style={p.markAllBtn}>
                <Trash2 size={14} color="#EF4444" />
                <Text style={p.deleteAllText}>Delete read</Text>
              </TouchableOpacity>
            ) : null}
            <Pressable onPress={onClose} style={p.closeBtn}>
              <X size={18} color="#5A5A7A" />
            </Pressable>
          </View>
        </View>

        <ScrollView style={p.list} contentContainerStyle={p.listContent} showsVerticalScrollIndicator={false}>
          {sorted.length === 0 ? (
            <View style={p.empty}>
              <Bell size={36} color="#C9CCD8" />
              <Text style={p.emptyText}>You're all caught up</Text>
            </View>
          ) : (
            sorted.map((n) => {
              const cfg = configFor(n.category);
              const Icon = cfg.icon;
              const meta: any = n.metadata || {};
              const isParentAudience = meta.audience === 'parent';
              const hasRoute = !!n.ctaRoute || (n.category === 'classroom' && !meta.expired && !isParentAudience);
              const isLive = (n.type === 'CLASS_LIVE' || n.type === 'CLASS_RESTARTED') && hasRoute;
              const isClass = n.category === 'classroom' && hasRoute;
              const isCancelled = !n.ctaRoute && n.category === 'classroom' && !!meta.expired;
              const buttonLabel = isLive ? 'Join Now' : n.ctaLabel || 'View';
              return (
                <Pressable
                  key={n.id}
                  onPress={() => onItemPress(n)}
                  style={[p.item, n.status === 'unread' && p.itemUnread, isLive && p.itemLive, isCancelled && p.itemCancelled]}
                >
                  <View style={[p.itemIcon, { backgroundColor: cfg.bg }]}>
                    <Icon size={18} color={cfg.color} strokeWidth={2} />
                  </View>
                  <View style={p.itemBody}>
                    <View style={p.itemTitleRow}>
                      {isLive ? (
                        <View style={p.liveBadge}>
                          <View style={p.liveDot} />
                          <Text style={p.liveBadgeText}>LIVE</Text>
                        </View>
                      ) : null}
                      <Text style={[p.itemTitle, n.status === 'unread' && p.itemTitleBold]} numberOfLines={1}>
                        {n.title}
                      </Text>
                      {n.status === 'unread' ? <View style={p.unreadDot} /> : null}
                    </View>
                    <Text style={p.itemMessage} numberOfLines={2}>{n.message}</Text>
                    <View style={p.itemFooter}>
                      <Text style={p.itemTime}>{timeAgo(n.createdAt)}</Text>
                      {isCancelled ? (
                        <View style={p.cancelledPill}>
                          <Text style={p.cancelledPillText}>No longer available</Text>
                        </View>
                      ) : isClass ? (
                        <Pressable
                          onPress={(e) => { e.stopPropagation?.(); onItemPress(n); }}
                          style={[p.joinButton, isLive ? p.joinButtonLive : p.joinButtonNormal]}
                        >
                          {isLive ? (
                            <Video size={13} color="#fff" strokeWidth={2.5} />
                          ) : (
                            <ChevronRight size={13} color="#fff" strokeWidth={2.5} />
                          )}
                          <Text style={p.joinButtonText}>{buttonLabel}</Text>
                        </Pressable>
                      ) : n.ctaLabel ? (
                        <Pressable
                          onPress={(e) => { e.stopPropagation?.(); onItemPress(n); }}
                          style={p.ctaPill}
                        >
                          <Text style={p.ctaPillText}>{n.ctaLabel}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    onPress={(e) => { e.stopPropagation?.(); onItemDelete(n.id); }}
                    style={p.deleteBtn}
                    hitSlop={8}
                  >
                    <Trash2 size={14} color="#9CA3AF" />
                  </Pressable>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrapper: { position: 'relative' },
  bellBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F4F5FF',
    alignItems: 'center', justifyContent: 'center',
  },
});

const p = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 8 },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginBottom: 6 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F8',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1a1a2e' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markAllText: { fontSize: 12, fontWeight: '700', color: '#4A90E2' },
  deleteAllText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F4F5FF',
    alignItems: 'center', justifyContent: 'center',
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 8 },

  empty: { alignItems: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { color: '#9CA3AF', fontSize: 13 },

  item: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 14, backgroundColor: '#FFFFFF',
    marginBottom: 6,
  },
  itemUnread: { backgroundColor: '#F8F9FF' },
  itemLive: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FFD1D1' },
  itemCancelled: { opacity: 0.65 },
  cancelledPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#F3F4F6' },
  cancelledPillText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: '#EF4444', borderRadius: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.6 },
  joinButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  joinButtonLive: { backgroundColor: '#EF4444' },
  joinButtonNormal: { backgroundColor: '#4A90E2' },
  joinButtonText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  itemIcon: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  itemBody: { flex: 1, gap: 4 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  itemTitleBold: { fontWeight: '800' },
  itemMessage: { fontSize: 12, color: '#6B7280', lineHeight: 16 },
  itemFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  itemTime: { fontSize: 11, color: '#B0B8CC' },
  ctaPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#EAF1FB' },
  ctaPillText: { fontSize: 11, fontWeight: '700', color: '#4A90E2' },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4A90E2', flexShrink: 0 },

  deleteBtn: { padding: 4 },
});
