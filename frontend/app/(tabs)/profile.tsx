import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LogOut, ChevronRight, Shield, Star, Flame, BookOpen, Award, Lock, Mail, Bell } from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { UserRole } from '../../src/types/roles';

const ROLE_COLORS: Record<string, string> = {
  student:    '#4A90E2',
  teacher:    '#FF7043',
  parent:     '#7DC67A',
  admin:      '#9B8EC4',
  superadmin: '#E6A817',
};

const ROLE_EMOJIS: Record<string, string> = {
  student:    '🎒',
  teacher:    '🍎',
  parent:     '👨‍👩‍👧',
  admin:      '🛡️',
  superadmin: '⭐',
};

export default function ProfileScreen() {
  const { user, setActiveRole, signOut } = useAuth();

  const handleRoleSelect = (role: UserRole) => {
    setActiveRole(role);
    router.replace('/(tabs)');
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';
  const roleColor = ROLE_COLORS[user?.activeRole ?? 'student'];

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.scroll}>

      {/* ─── Hero card ─────────────────────────────────────────────────── */}
      <View style={[s.heroCard, { backgroundColor: roleColor }]}>
        <View style={[s.blob1, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
        <View style={[s.blob2, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />

        {/* Avatar */}
        <View style={s.avatarRing}>
          <View style={[s.avatar, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={s.avatarInitials}>{initials}</Text>
          </View>
        </View>

        <Text style={s.heroName}>{user ? `${user.firstName} ${user.lastName}` : ''}</Text>
        <Text style={s.heroEmail}>{user?.email ?? ''}</Text>

        {/* Role badge */}
        <View style={s.roleBadge}>
          <Text style={s.roleBadgeEmoji}>{ROLE_EMOJIS[user?.activeRole ?? 'student']}</Text>
          <Text style={s.roleBadgeText}>{user?.activeRole?.toUpperCase() ?? ''}</Text>
        </View>
      </View>

      {/* ─── Stats row ─────────────────────────────────────────────────── */}
      <View style={s.statsRow}>
        {[
          { icon: <Star   size={18} color="#E6A817" fill="#E6A817" />, val: '1,200',  label: 'XP Points' },
          { icon: <Flame  size={18} color="#FF7043" />,                val: '7',      label: 'Day Streak' },
          { icon: <BookOpen size={18} color="#4A90E2" />,              val: '27',     label: 'Lessons' },
          { icon: <Award  size={18} color="#9B8EC4" />,                val: '5',      label: 'Badges' },
        ].map((item) => (
          <View key={item.label} style={s.statItem}>
            {item.icon}
            <Text style={s.statVal}>{item.val}</Text>
            <Text style={s.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* ─── Switch role ───────────────────────────────────────────────── */}
      {(user?.roles?.length ?? 0) > 1 && (
        <>
          <Text style={s.sectionTitle}>Switch Role</Text>
          <View style={s.rolesCard}>
            {user?.roles.map((role, idx, arr) => {
              const isActive = role === user.activeRole;
              const color    = ROLE_COLORS[role] ?? '#4A90E2';
              return (
                <Pressable
                  key={role}
                  onPress={() => handleRoleSelect(role)}
                  style={[s.roleRow, idx < arr.length - 1 && s.roleRowBorder]}
                >
                  <View style={[s.roleIcon, { backgroundColor: `${color}18` }]}>
                    <Text style={{ fontSize: 18 }}>{ROLE_EMOJIS[role] ?? '👤'}</Text>
                  </View>
                  <View style={s.roleInfo}>
                    <Text style={s.roleName}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
                    <Text style={s.roleDesc}>{isActive ? 'Currently active' : 'Tap to switch'}</Text>
                  </View>
                  {isActive
                    ? <View style={[s.activeCheck, { backgroundColor: color }]}><Text style={s.activeCheckText}>✓</Text></View>
                    : <ChevronRight size={16} color="#C0C8D8" />}
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* ─── Account section ───────────────────────────────────────────── */}
      <Text style={s.sectionTitle}>Account</Text>
      <View style={s.menuCard}>
        {[
          { Icon: Lock, label: 'Change Password', sub: 'Update your password', color: '#4A90E2' },
          { Icon: Mail, label: 'Update Email',     sub: user?.email ?? '',      color: '#7DC67A' },
          { Icon: Bell, label: 'Notifications',    sub: 'Manage alerts',        color: '#E6A817' },
        ].map((item, idx, arr) => (
          <Pressable key={item.label} style={[s.menuRow, idx < arr.length - 1 && s.menuBorder]}>
            <View style={[s.menuIconBox, { backgroundColor: `${item.color}18` }]}>
              <item.Icon size={18} color={item.color} />
            </View>
            <View style={s.menuInfo}>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={s.menuSub} numberOfLines={1}>{item.sub}</Text>
            </View>
            <ChevronRight size={16} color="#C0C8D8" />
          </Pressable>
        ))}
      </View>

      {/* ─── Sign out ──────────────────────────────────────────────────── */}
      <Pressable style={s.signOutBtn} onPress={signOut}>
        <LogOut size={18} color="#FF4444" />
        <Text style={s.signOutText}>Sign Out</Text>
      </Pressable>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F9FF' },
  scroll: { paddingBottom: 48 },

  // Hero
  heroCard: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 16,
    borderRadius: 28, padding: 24,
    alignItems: 'center', gap: 6,
    overflow: 'hidden', position: 'relative',
  },
  blob1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, top: -50, right: -40 },
  blob2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, bottom: -30, left: -20 },
  avatarRing: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 70, height: 70, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 26, fontWeight: '900', color: '#fff' },
  heroName:  { fontSize: 20, fontWeight: '900', color: '#fff' },
  heroEmail: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.8)' },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    marginTop: 4,
  },
  roleBadgeEmoji: { fontSize: 14 },
  roleBadgeText:  { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 20, padding: 16,
    justifyContent: 'space-around',
    shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F8',
  },
  statItem:  { alignItems: 'center', gap: 3 },
  statVal:   { fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#9A9AB0' },

  // Section title
  sectionTitle: {
    fontSize: 14, fontWeight: '800', color: '#5A5A7A',
    paddingHorizontal: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // Roles card
  rolesCard: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#fff', borderRadius: 20,
    borderWidth: 1, borderColor: '#F0F0F8',
    shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 2,
  },
  roleRow:       { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  roleRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5FB' },
  roleIcon:      { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  roleInfo:      { flex: 1 },
  roleName:      { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  roleDesc:      { fontSize: 11, fontWeight: '500', color: '#9A9AB0', marginTop: 1 },
  activeCheck: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  activeCheckText: { fontSize: 13, fontWeight: '900', color: '#fff' },

  // Menu card
  menuCard: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#fff', borderRadius: 20,
    borderWidth: 1, borderColor: '#F0F0F8',
    shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 2,
  },
  menuRow:    { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5FB' },
  menuIconBox:{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F4F5FF', alignItems: 'center', justifyContent: 'center' },
  menuInfo:   { flex: 1 },
  menuLabel:  { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  menuSub:    { fontSize: 11, fontWeight: '500', color: '#9A9AB0', marginTop: 1 },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#FFF0F0', borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1, borderColor: '#FFD8D8',
  },
  signOutText: { fontSize: 14, fontWeight: '800', color: '#FF4444' },
});
