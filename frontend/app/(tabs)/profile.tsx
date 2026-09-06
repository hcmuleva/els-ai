import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Modal } from 'react-native';
import { router } from 'expo-router';
import {
  LogOut,
  ChevronRight,
  Star,
  Flame,
  BookOpen,
  Award,
  Lock,
  Mail,
  Bell,
  GraduationCap,
  UserRound,
  Users,
  Shield,
  Check,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { useStudentProfile } from '../../src/context/StudentProfileContext';
import { UserRole } from '../../src/types/roles';
import { RoleColors } from '../../src/theme';

// Was a hardcoded duplicate of `RoleColors` with stale (pre-a11y-fix)
// parent/admin/superadmin values that failed WCAG AA as a solid hero-card
// background with white text — now sourced from the single theme copy.
const ROLE_COLORS = RoleColors;

const ROLE_ICONS: Record<string, LucideIcon> = {
  student: GraduationCap,
  teacher: UserRound,
  parent: Users,
  admin: Shield,
  superadmin: Star,
};

export default function ProfileScreen() {
  const { user, setActiveRole, signOut, apiFetch, deleteAccount, deleteChildAccount } = useAuth();
  const { refreshAll } = useStudentProfile();
  const [connectId, setConnectId] = useState('');
  const [connectMessage, setConnectMessage] = useState('');
  const [connectError, setConnectError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [deleteChildId, setDeleteChildId] = useState('');
  const [deleteChildLoading, setDeleteChildLoading] = useState(false);
  const [deleteChildError, setDeleteChildError] = useState('');

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [deleteChildModalVisible, setDeleteChildModalVisible] = useState(false);

  const handleRoleSelect = (role: UserRole) => {
    setActiveRole(role);
    router.replace('/(tabs)');
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';
  const roleColor = ROLE_COLORS[user?.activeRole ?? 'student'];
  const canConnect = user?.activeRole === 'parent' || user?.activeRole === 'student';

  const handleConnect = async () => {
    if (!connectId.trim()) {
      setConnectError('Please enter registration ID');
      return;
    }
    setConnectError('');
    setConnectMessage('');
    setConnecting(true);
    try {
      const res = await apiFetch('/users/me/connect-by-registration-id', {
        method: 'POST',
        body: JSON.stringify({ registrationId: connectId.trim().toUpperCase() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'Failed to connect');
      setConnectMessage(payload.message || 'Connected successfully');
      setConnectId('');
      refreshAll();
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  const handleDeleteAccount = () => {
    setDeleteAccountError('');
    setDeleteModalVisible(true);
  };

  const confirmDeleteAccount = async () => {
    setDeleteAccountLoading(true);
    setDeleteAccountError('');
    const res = await deleteAccount();
    setDeleteAccountLoading(false);
    if (!res.success) {
      setDeleteAccountError(res.error || "Failed to delete account");
    } else {
      setDeleteModalVisible(false);
    }
  };

  const handleDeleteChildAccount = () => {
    if (!deleteChildId.trim()) {
      setDeleteChildError('Please enter child registration ID');
      return;
    }
    setDeleteChildModalVisible(true);
  };

  const confirmDeleteChildAccount = async () => {
    setDeleteChildLoading(true);
    setDeleteChildError('');
    const res = await deleteChildAccount(deleteChildId.trim());
    setDeleteChildLoading(false);
    if (res.success) {
      setDeleteChildModalVisible(false);
      setDeleteChildId('');
    } else {
      setDeleteChildError(res.error || "Failed to delete child account");
    }
  };


  return (
    <ScrollView style={s.screen} contentContainerStyle={s.scroll}>

      {/* ─── Hero card ─────────────────────────────────────────────────── */}
      <View style={[s.heroCard, { backgroundColor: roleColor }]}>
        <View style={[s.blob1, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
        <View style={[s.blob2, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />

        {/* Avatar — darkening (not lightening) overlay so white initials keep
            WCAG AA contrast against the role-colored hero background */}
        <View style={s.avatarRing}>
          <View style={[s.avatar, { backgroundColor: 'rgba(0,0,0,0.18)' }]}>
            <Text style={s.avatarInitials}>{initials}</Text>
          </View>
        </View>

        <Text style={s.heroName}>{user ? `${user.firstName} ${user.lastName}` : ''}</Text>
        <Text style={s.heroEmail}>{user?.email ?? ''}</Text>

        {/* Role badge */}
        <View style={s.roleBadge}>
          {(() => {
            const RoleIcon = ROLE_ICONS[user?.activeRole ?? 'student'] ?? UserRound;
            return <RoleIcon size={14} color="#fff" />;
          })()}
          <Text style={s.roleBadgeText}>{user?.activeRole?.toUpperCase() ?? ''}</Text>
        </View>
      </View>

      {/* ─── Stats row ─────────────────────────────────────────────────── */}
      <View style={s.statsRow}>
        {[
          { icon: <Star   size={18} color="#E6A817" fill="#E6A817" />, val: '1,200',  label: 'XP Points' },
          { icon: <Flame  size={18} color="#D33F13" />,                val: '7',      label: 'Day Streak' },
          { icon: <BookOpen size={18} color="#2D5DC9" />,              val: '27',     label: 'Lessons' },
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
              const color    = ROLE_COLORS[role] ?? '#2D5DC9';
              return (
                <Pressable
                  key={role}
                  onPress={() => handleRoleSelect(role)}
                  style={[s.roleRow, idx < arr.length - 1 && s.roleRowBorder]}
                >
                  <View style={[s.roleIcon, { backgroundColor: `${color}18` }]}>
                    {(() => {
                      const RoleIcon = ROLE_ICONS[role] ?? UserRound;
                      return <RoleIcon size={18} color={color} />;
                    })()}
                  </View>
                  <View style={s.roleInfo}>
                    <Text style={s.roleName}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
                    <Text style={s.roleDesc}>{isActive ? 'Currently active' : 'Tap to switch'}</Text>
                  </View>
                  {isActive
                    ? (
                      <View style={[s.activeCheck, { backgroundColor: color }]}>
                        <Check size={13} color="#fff" strokeWidth={3} />
                      </View>
                    )
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
          { Icon: Lock, label: 'Change Password', sub: 'Update your password', color: '#2D5DC9' },
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

      {canConnect && (
        <>
          <Text style={s.sectionTitle}>Connect</Text>
          <View style={s.menuCard}>
            <View style={s.connectWrap}>
              <Text style={s.connectTitle}>
                {user?.activeRole === 'parent' ? 'Add Kid by Registration ID' : 'Add Parent by Registration ID'}
              </Text>
              <TextInput
                value={connectId}
                onChangeText={setConnectId}
                autoCapitalize="characters"
                placeholder="ELS-XXXXXXXXXX"
                placeholderTextColor="#525C6B"
                style={s.connectInput}
              />
              <Pressable style={s.connectBtn} onPress={handleConnect} disabled={connecting}>
                {connecting ? <ActivityIndicator color="#fff" /> : <Text style={s.connectBtnText}>Connect</Text>}
              </Pressable>
              {!!connectMessage && <Text style={s.connectSuccess}>{connectMessage}</Text>}
              {!!connectError && <Text style={s.connectError}>{connectError}</Text>}
            </View>
          </View>
        </>
      )}

      {user?.activeRole === 'parent' && (
        <>
          <Text style={s.sectionTitle}>Danger Zone</Text>
          <View style={[s.menuCard, s.dangerCard]}>
            <View style={s.connectWrap}>
              <Text style={s.connectTitle}>Delete Child's Account</Text>
              <Text style={s.menuSub}>Enter child's registration ID to delete their account</Text>
              <TextInput
                value={deleteChildId}
                onChangeText={setDeleteChildId}
                autoCapitalize="characters"
                placeholder="ELS-XXXXXXXXXX"
                placeholderTextColor="#525C6B"
                style={s.connectInput}
              />
              <Pressable style={s.deleteBtn} onPress={handleDeleteChildAccount} disabled={deleteChildLoading}>
                {deleteChildLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.deleteBtnText}>Delete Child's Account</Text>}
              </Pressable>
              {!!deleteChildError && <Text style={s.connectError}>{deleteChildError}</Text>}
            </View>
          </View>
        </>
      )}

      {/* ─── Delete Account ──────────────────────────────────────────────────── */}
      <Pressable style={s.signOutBtn} onPress={handleDeleteAccount}>
        <Trash2 size={18} color="#FF4444" />
        <Text style={s.signOutText}>Delete Account</Text>
      </Pressable>

      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Delete Account</Text>
            <Text style={s.modalText}>
              Are you sure you want to delete your account?{'\n\n'}
              This will permanently delete your profile, progress, scores, and all associated data. This action cannot be undone.
            </Text>
            {!!deleteAccountError && <Text style={s.connectError}>{deleteAccountError}</Text>}
            <View style={s.modalActions}>
              <Pressable style={s.modalBtnCancel} onPress={() => setDeleteModalVisible(false)}>
                <Text style={s.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.modalBtnDelete} onPress={confirmDeleteAccount} disabled={deleteAccountLoading}>
                {deleteAccountLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnDeleteText}>Delete</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteChildModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteChildModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Delete Child's Account</Text>
            <Text style={s.modalText}>
              Are you sure you want to delete this child's account?{'\n\n'}
              This will permanently delete their profile, learning progress, scores, and all associated data. This action cannot be undone.
            </Text>
            {!!deleteChildError && <Text style={s.connectError}>{deleteChildError}</Text>}
            <View style={s.modalActions}>
              <Pressable style={s.modalBtnCancel} onPress={() => setDeleteChildModalVisible(false)}>
                <Text style={s.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.modalBtnDelete} onPress={confirmDeleteChildAccount} disabled={deleteChildLoading}>
                {deleteChildLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnDeleteText}>Delete</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
  heroEmail: { fontSize: 12, fontWeight: '500', color: '#fff' },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    // Darkening (not lightening) overlay — see avatar comment above.
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    marginTop: 4,
  },
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
  statLabel: { fontSize: 10, fontWeight: '600', color: '#525C6B' },

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
  roleDesc:      { fontSize: 11, fontWeight: '500', color: '#525C6B', marginTop: 1 },
  activeCheck: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },

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
  menuSub:    { fontSize: 11, fontWeight: '500', color: '#525C6B', marginTop: 1 },
  connectWrap: { padding: 14, gap: 8 },
  connectTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  connectInput: {
    borderWidth: 1,
    borderColor: '#E0E4F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1a1a2e',
    backgroundColor: '#F8F9FF',
  },
  connectBtn: {
    backgroundColor: '#2D5DC9',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  connectBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  connectSuccess: { fontSize: 12, color: '#2E7D32', fontWeight: '600' },
  connectError: { fontSize: 12, color: '#C62828', fontWeight: '600' },

  // Danger
  dangerCard: {
    borderColor: '#FFD8D8',
    shadowColor: '#FF8888',
  },
  deleteBtn: {
    backgroundColor: '#FF4444',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // Sign out / Delete Account
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#FFF0F0', borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1, borderColor: '#FFD8D8',
  },
  signOutText: { fontSize: 14, fontWeight: '800', color: '#FF4444' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  modalText: {
    fontSize: 14,
    color: '#5A5A7A',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F4F5FF',
  },
  modalBtnCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5A5A7A',
  },
  modalBtnDelete: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FF4444',
  },
  modalBtnDeleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
