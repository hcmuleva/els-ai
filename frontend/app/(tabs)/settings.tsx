import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View, Modal, ActivityIndicator, TextInput, Alert } from 'react-native';
import {
  ChevronRight,
  Moon,
  Bell,
  Globe,
  BarChart3,
  Clock3,
  MessageCircle,
  Info,
  Star,
  Shield,
  Trash2,
  Settings,
  Volume2,
  Lock,
  type LucideIcon,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { useNotifications } from '../../src/context/NotificationContext';

type SettingRow = {
  Icon: LucideIcon;
  label: string;
  sub?: string;
  type: 'nav' | 'toggle' | 'danger';
  color?: string;
  bg?: string;
  key?: string;
};

const SECTIONS: { title: string; rows: SettingRow[] }[] = [
  {
    title: 'Preferences',
    rows: [
      { Icon: Moon, label: 'Dark Mode',          sub: 'Easy on your eyes at night',  type: 'toggle', key: 'darkMode',       color: '#9B8EC4', bg: '#EDE4FF' },
      { Icon: Bell, label: 'Push Notifications',  sub: 'Assignments, quizzes & more', type: 'toggle', key: 'notifications',  color: '#D33F13', bg: '#FFE8D6' },
      { Icon: Volume2, label: 'Sound Effects',        sub: 'Play sounds in quizzes',      type: 'toggle', key: 'sounds',         color: '#2D5DC9', bg: '#D6EAFF' },
    ],
  },
  {
    title: 'Account',
    rows: [
      { Icon: Lock, label: 'Change Password', sub: 'Update your login password', type: 'nav', color: '#2D5DC9', bg: '#D6EAFF' },
    ],
  },
  {
    title: 'Learning',
    rows: [
      { Icon: Globe, label: 'Language',          sub: 'English',                    type: 'nav', color: '#7DC67A', bg: '#D6F5D6' },
      { Icon: BarChart3, label: 'Difficulty Level',  sub: 'Beginner → Advanced',        type: 'nav', color: '#E6A817', bg: '#FFF5CC' },
      { Icon: Clock3, label: 'Daily Goal',         sub: '20 minutes / day',           type: 'nav', color: '#D33F13', bg: '#FFE8D6' },
    ],
  },
  {
    title: 'Support',
    rows: [
      { Icon: MessageCircle, label: 'Help & Feedback',   sub: 'Send us a message',           type: 'nav', color: '#2D5DC9', bg: '#D6EAFF' },
      { Icon: Info, label: 'About ELS·AI',       sub: 'Version 1.0.0',              type: 'nav', color: '#9B8EC4', bg: '#EDE4FF' },
      { Icon: Star, label: 'Rate the App',       sub: 'Share your experience',      type: 'nav', color: '#E6A817', bg: '#FFF5CC' },
      { Icon: Shield, label: 'Privacy Policy',     sub: 'How we protect your data',   type: 'nav', color: '#7DC67A', bg: '#D6F5D6' },
    ],
  },
  {
    title: 'Danger Zone',
    rows: [
      { Icon: Trash2, label: 'Clear App Data',    sub: 'Resets local cache',          type: 'danger', color: '#FF4444', bg: '#FFF0F0' },
    ],
  },
];

export default function SettingsScreen() {
  const { user, changePassword } = useAuth();
  const { deleteRange } = useNotifications();
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    darkMode:      false,
    notifications: true,
    sounds:        true,
  });

  const flip = (key: string) =>
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleClearData = async () => {
    setClearing(true);
    try {
      await deleteRange('all');
      setClearModalVisible(false);
    } catch (err) {
      /* silent */
    } finally {
      setClearing(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Error', 'Please enter both current and new passwords.');
      return;
    }
    if (newPassword.length < 4) {
      Alert.alert('Error', 'New password must be at least 4 characters long.');
      return;
    }

    setChangingPassword(true);
    const result = await changePassword(currentPassword, newPassword);
    setChangingPassword(false);

    if (result.success) {
      Alert.alert('Success', 'Your password has been changed successfully.');
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
    } else {
      Alert.alert('Error', result.error || 'Failed to change password');
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.scroll}>

      {/* ─── Header card ───────────────────────────────────────────────── */}
      <View style={s.headerCard}>
        <View style={s.headerIconWrap}>
          <Settings size={24} color="#fff" />
        </View>
        <View>
          <Text style={s.headerTitle}>Settings</Text>
          <Text style={s.headerSub}>Signed in as {user?.email ?? ''}</Text>
        </View>
      </View>

      {/* ─── Sections ──────────────────────────────────────────────────── */}
      {SECTIONS.map((section) => (
        <View key={section.title}>
          <Text style={s.sectionTitle}>{section.title}</Text>
          <View style={[s.card, section.title === 'Danger Zone' && s.dangerCard]}>
            {section.rows.map((row, idx, arr) => (
              <Pressable
                key={row.label}
                style={[s.row, idx < arr.length - 1 && s.rowBorder]}
                onPress={() => {
                  if (row.type === 'toggle' && row.key) flip(row.key);
                  else if (row.type === 'danger' && row.label === 'Clear App Data') setClearModalVisible(true);
                  else if (row.label === 'Change Password') setPasswordModalVisible(true);
                }}
              >
                <View style={[s.iconBox, { backgroundColor: row.bg ?? '#F4F5FF' }]}>
                  <row.Icon size={18} color={row.color ?? '#7A7A9A'} />
                </View>
                <View style={s.rowInfo}>
                  <Text style={[s.rowLabel, row.type === 'danger' && { color: '#FF4444' }]}>
                    {row.label}
                  </Text>
                  {row.sub && <Text style={s.rowSub}>{row.sub}</Text>}
                </View>
                {row.type === 'toggle' && row.key ? (
                  <Switch
                    value={toggles[row.key] ?? false}
                    onValueChange={() => flip(row.key!)}
                    trackColor={{ false: '#E8EAF0', true: row.color ?? '#2D5DC9' }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#E8EAF0"
                    accessibilityLabel={row.label}
                    accessibilityHint={row.sub}
                  />
                ) : (
                  <ChevronRight size={16} color={row.type === 'danger' ? '#FF4444' : '#C0C8D8'} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Text style={s.footerText}>ELS·AI © 2026 · Made for young minds</Text>

      {/* ─── Clear Data Modal ──────────────────────────────────────────── */}
      <Modal visible={clearModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <View style={[s.modalIcon, { backgroundColor: '#FFF0F0' }]}>
                <Trash2 size={24} color="#FF4444" />
              </View>
              <Text style={s.modalTitle}>Clear App Data?</Text>
            </View>

            <Text style={s.modalDesc}>
              This will clear all notifications and local data. Are you sure?
            </Text>

            <View style={s.modalActions}>
              <Pressable
                style={[s.modalBtn, s.modalBtnCancel]}
                onPress={() => setClearModalVisible(false)}
                disabled={clearing}
              >
                <Text style={s.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.modalBtn, s.modalBtnDanger]}
                onPress={handleClearData}
                disabled={clearing}
              >
                {clearing ? (
                  <ActivityIndicator accessibilityLabel="Loading" color="#fff" />
                ) : (
                  <Text style={s.modalBtnDangerText}>Clear Data</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Change Password Modal ───────────────────────────────────────── */}
      <Modal visible={passwordModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <View style={[s.modalIcon, { backgroundColor: '#D6EAFF' }]}>
                <Lock size={24} color="#2D5DC9" />
              </View>
              <Text style={s.modalTitle}>Change Password</Text>
            </View>

            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>Current Password</Text>
              <TextInput
                style={s.input}
                secureTextEntry
                placeholder="Enter current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholderTextColor="#A0A0A0"
              />
            </View>

            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>New Password</Text>
              <TextInput
                style={s.input}
                secureTextEntry
                placeholder="Enter new password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholderTextColor="#A0A0A0"
              />
            </View>

            <View style={s.modalActions}>
              <Pressable
                style={[s.modalBtn, s.modalBtnCancel]}
                onPress={() => setPasswordModalVisible(false)}
                disabled={changingPassword}
              >
                <Text style={s.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.modalBtn, { backgroundColor: '#2D5DC9' }]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator accessibilityLabel="Loading" color="#fff" />
                ) : (
                  <Text style={s.modalBtnDangerText}>Update</Text>
                )}
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

  headerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginTop: 12, marginBottom: 20,
    backgroundColor: '#2D5DC9', borderRadius: 20, padding: 16,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSub:   { fontSize: 12, fontWeight: '500', color: '#fff', marginTop: 2 },

  sectionTitle: {
    fontSize: 12, fontWeight: '800', color: '#525C6B',
    paddingHorizontal: 20, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  card: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 1, borderColor: '#F0F0F8',
    shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  dangerCard: {
    borderColor: '#FFD8D8',
    shadowColor: '#FF8888',
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
    backgroundColor: '#FFFFFF',
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5FB' },

  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  rowInfo:  { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  rowSub:   { fontSize: 11, fontWeight: '500', color: '#525C6B', marginTop: 2 },

  footerText: {
    textAlign: 'center', fontSize: 11, color: '#B0B8CC',
    fontWeight: '500', paddingBottom: 8,
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    width: '100%', maxWidth: 400,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  modalHeader: { alignItems: 'center', marginBottom: 16 },
  modalIcon: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a2e', textAlign: 'center' },
  modalDesc: { fontSize: 14, color: '#6A6A8B', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: {
    flex: 1, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBtnCancel: { backgroundColor: '#F4F5FF' },
  modalBtnCancelText: { color: '#6A6A8B', fontSize: 15, fontWeight: '700' },
  modalBtnDanger: { backgroundColor: '#FF4444' },
  modalBtnDangerText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
  input: {
    backgroundColor: '#F4F5FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a2e',
    fontWeight: '500',
  },
});
