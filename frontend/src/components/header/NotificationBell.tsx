import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bell, CheckCheck, BookOpen, Trophy, ClipboardList, Megaphone } from 'lucide-react-native';

// ── Mock notifications (replace with API later) ───────────────────────────────
export type AppNotification = {
  id: string;
  type: 'assignment' | 'quiz' | 'achievement' | 'announcement';
  title: string;
  body: string;
  time: string;
  read: boolean;
};

const MOCK_NOTIFICATIONS: AppNotification[] = [
  { id: '1', type: 'assignment',   title: 'New Assignment',       body: 'Complete the Numbers worksheet by Friday.',      time: '10m ago',  read: false },
  { id: '2', type: 'quiz',         title: 'Quiz Ready',           body: 'Alphabets Quiz #2 is now available.',            time: '1h ago',   read: false },
  { id: '3', type: 'achievement',  title: 'Badge Earned! 🏆',     body: 'You earned the Top 10 badge. Keep it up!',       time: '2h ago',   read: false },
  { id: '4', type: 'announcement', title: 'Class Reminder',       body: 'Online class starts in 20 minutes.',             time: '3h ago',   read: false },
  { id: '5', type: 'quiz',         title: 'Quiz Result',          body: 'You scored 88% on Numbers Quiz #1.',             time: 'Yesterday', read: true  },
  { id: '6', type: 'announcement', title: 'Holiday Notice',       body: 'No classes on Monday. Enjoy your day!',          time: '2d ago',   read: true  },
  { id: '7', type: 'assignment',   title: 'Assignment Submitted', body: 'Your Colors worksheet was submitted successfully.','time': '3d ago', read: true },
];

const TYPE_CONFIG = {
  assignment:   { icon: ClipboardList, bg: '#D6EAFF', color: '#4A90E2' },
  quiz:         { icon: BookOpen,      bg: '#FFE8D6', color: '#FF7043' },
  achievement:  { icon: Trophy,        bg: '#FFF5CC', color: '#E6A817' },
  announcement: { icon: Megaphone,     bg: '#EDE4FF', color: '#9B8EC4' },
};

// ── Badge ─────────────────────────────────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────────
export function NotificationBell() {
  const [open, setOpen]               = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const unread = notifications.filter((n) => !n.read).length;

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const markRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  return (
    <View style={s.wrapper}>
      {/* Bell button */}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={s.bellBtn}
        accessibilityLabel="Notifications"
      >
        <Bell size={20} color={open ? '#4A90E2' : '#5A5A7A'} strokeWidth={2} />
        <Badge count={unread} />
      </Pressable>

      {/* Dropdown panel */}
      {open && (
        <View style={s.panel}>
          {/* Header */}
          <View style={s.panelHeader}>
            <Text style={s.panelTitle}>Notifications</Text>
            <View style={s.panelHeaderRight}>
              {unread > 0 && (
                <TouchableOpacity onPress={markAllRead} style={s.markAllBtn}>
                  <CheckCheck size={13} color="#4A90E2" />
                  <Text style={s.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* List */}
          <ScrollView
            style={s.list}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {notifications.map((n, idx) => {
              const cfg  = TYPE_CONFIG[n.type];
              const Icon = cfg.icon;
              return (
                <Pressable
                  key={n.id}
                  style={[s.item, !n.read && s.itemUnread, idx < notifications.length - 1 && s.itemBorder]}
                  onPress={() => markRead(n.id)}
                >
                  <View style={[s.itemIcon, { backgroundColor: cfg.bg }]}>
                    <Icon size={16} color={cfg.color} strokeWidth={2} />
                  </View>
                  <View style={s.itemBody}>
                    <View style={s.itemTitleRow}>
                      <Text style={[s.itemTitle, !n.read && s.itemTitleBold]} numberOfLines={1}>
                        {n.title}
                      </Text>
                      {!n.read && <View style={s.unreadDot} />}
                    </View>
                    <Text style={s.itemBody2} numberOfLines={2}>{n.body}</Text>
                    <Text style={s.itemTime}>{n.time}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Backdrop to close */}
      {open && (
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrapper: { position: 'relative' },

  bellBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F4F5FF',
    alignItems: 'center', justifyContent: 'center',
  },

  // Dropdown
  panel: {
    position: 'absolute',
    top: 44, right: 0,
    width: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0F0F8',
    shadowColor: '#1a1a3e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 200,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F8',
  },
  panelTitle:      { fontSize: 15, fontWeight: '900', color: '#1a1a2e' },
  panelHeaderRight:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  markAllBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markAllText:     { fontSize: 11, fontWeight: '700', color: '#4A90E2' },

  list: { maxHeight: 360 },

  item: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  itemUnread:  { backgroundColor: '#F8F9FF' },
  itemBorder:  { borderBottomWidth: 1, borderBottomColor: '#F5F5FB' },
  itemIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  itemBody:      { flex: 1, gap: 2 },
  itemTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTitle:     { flex: 1, fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
  itemTitleBold: { fontWeight: '800' },
  itemBody2:     { fontSize: 11, fontWeight: '500', color: '#7A7A9A', lineHeight: 16 },
  itemTime:      { fontSize: 10, fontWeight: '500', color: '#B0B8CC' },
  unreadDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#4A90E2', flexShrink: 0,
  },

  backdrop: {
    position: 'absolute',
    top: 44, right: -999, bottom: -999, left: -999,
    zIndex: 199,
  },
});
