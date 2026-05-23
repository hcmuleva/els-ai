import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
  type LucideIcon,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';

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
      { Icon: Bell, label: 'Push Notifications',  sub: 'Assignments, quizzes & more', type: 'toggle', key: 'notifications',  color: '#FF7043', bg: '#FFE8D6' },
      { Icon: Volume2, label: 'Sound Effects',        sub: 'Play sounds in quizzes',      type: 'toggle', key: 'sounds',         color: '#4A90E2', bg: '#D6EAFF' },
    ],
  },
  {
    title: 'Learning',
    rows: [
      { Icon: Globe, label: 'Language',          sub: 'English',                    type: 'nav', color: '#7DC67A', bg: '#D6F5D6' },
      { Icon: BarChart3, label: 'Difficulty Level',  sub: 'Beginner → Advanced',        type: 'nav', color: '#E6A817', bg: '#FFF5CC' },
      { Icon: Clock3, label: 'Daily Goal',         sub: '20 minutes / day',           type: 'nav', color: '#FF7043', bg: '#FFE8D6' },
    ],
  },
  {
    title: 'Support',
    rows: [
      { Icon: MessageCircle, label: 'Help & Feedback',   sub: 'Send us a message',           type: 'nav', color: '#4A90E2', bg: '#D6EAFF' },
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
  const { user } = useAuth();
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    darkMode:      false,
    notifications: true,
    sounds:        true,
  });

  const flip = (key: string) =>
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

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
                onPress={() => row.type === 'toggle' && row.key ? flip(row.key) : undefined}
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
                    trackColor={{ false: '#E8EAF0', true: row.color ?? '#4A90E2' }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#E8EAF0"
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

    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F9FF' },
  scroll: { paddingBottom: 48 },

  headerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginTop: 12, marginBottom: 20,
    backgroundColor: '#4A90E2', borderRadius: 20, padding: 16,
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
  headerSub:   { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  sectionTitle: {
    fontSize: 12, fontWeight: '800', color: '#9A9AB0',
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
  rowSub:   { fontSize: 11, fontWeight: '500', color: '#9A9AB0', marginTop: 2 },

  footerText: {
    textAlign: 'center', fontSize: 11, color: '#B0B8CC',
    fontWeight: '500', paddingBottom: 8,
  },
});
