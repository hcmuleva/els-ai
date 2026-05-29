/**
 * SelectorModal — shared bottom-sheet picker used across the app.
 *
 * Usage:
 *   <SelectorModal
 *     visible={open}
 *     title="Select Subject"
 *     options={[{ label: 'English', value: 'English' }]}
 *     selected={currentSubject}
 *     isSubject
 *     onSelect={(v) => setSubject(v)}
 *     onClose={() => setOpen(false)}
 *   />
 */
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Activity, BookOpen, Check, FlaskConical, Globe, Hash, Languages, Leaf, Monitor, Palette, School, Sparkles, X,
} from 'lucide-react-native';
import { API_BASE_URL } from '../context/AuthContext';

export type SelectorOption = { label: string; value: string; coverImage?: string; iconUrl?: string; iconBgColor?: string };

export type SelectorModalProps = {
  visible: boolean;
  title: string;
  options: SelectorOption[];
  selected?: string;
  /** Show contextual subject icons; false = School icon for all items */
  isSubject?: boolean;
  /** Prepend an "Any / All" clear option (default true) */
  showAny?: boolean;
  /** Label for the clear option (default "Any") */
  anyLabel?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

type IconEntry = { Icon: React.ComponentType<{ size?: number; color?: string }>; color: string; bg: string };

const SUBJECT_SYMBOL_ICONS: Record<string, IconEntry> = {
  'book-open': { Icon: BookOpen, color: '#4A90E2', bg: '#D6EAFF' },
  hash: { Icon: Hash, color: '#FF7043', bg: '#FFE8D6' },
  flask: { Icon: FlaskConical, color: '#7DC67A', bg: '#D6F5D6' },
  languages: { Icon: Languages, color: '#9B8EC4', bg: '#EDE4FF' },
  leaf: { Icon: Leaf, color: '#4CAF50', bg: '#D6F5D6' },
  monitor: { Icon: Monitor, color: '#E6A817', bg: '#FFF5CC' },
  globe: { Icon: Globe, color: '#FF7043', bg: '#FFE8D6' },
  sparkles: { Icon: Sparkles, color: '#7C3AED', bg: '#F3E8FF' },
  activity: { Icon: Activity, color: '#0EA5E9', bg: '#E0F2FE' },
  palette: { Icon: Palette, color: '#F59E0B', bg: '#FEF3C7' },
};

function getIconEntry(isSubject: boolean): IconEntry {
  if (isSubject) return { Icon: BookOpen, color: '#9A9AB0', bg: '#F0F0F8' };
  return { Icon: School, color: '#4A90E2', bg: '#EBF4FF' };
}

function resolveOptionIconUrl(raw?: string): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('symbol:')) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/')) return `${API_BASE_URL}${trimmed}`;
  return null;
}

function resolveOptionBgColor(raw?: string): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  return null;
}

function resolveIconSymbol(raw?: string): string | null {
  const trimmed = String(raw || '').trim().toLowerCase();
  if (!trimmed.startsWith('symbol:')) return null;
  const symbol = trimmed.slice('symbol:'.length);
  return SUBJECT_SYMBOL_ICONS[symbol] ? symbol : null;
}

function getInitials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  return label.trim().slice(0, 2).toUpperCase() || 'SB';
}

export default function SelectorModal({
  visible,
  title,
  options,
  selected = '',
  isSubject = false,
  showAny = true,
  anyLabel = 'Any',
  onSelect,
  onClose,
}: SelectorModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={[s.headerIcon, { backgroundColor: isSubject ? '#EDE4FF' : '#D6EAFF' }]}>
              {isSubject ? <BookOpen size={20} color="#9B8EC4" /> : <School size={20} color="#4A90E2" />}
            </View>
            <Text style={s.headerTitle}>{title}</Text>
            <Pressable onPress={onClose} style={s.closeBtn}>
              <X size={18} color="#5A6A8A" />
            </Pressable>
          </View>

          {/* List */}
          <ScrollView
            style={s.list}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.listContent}
          >
            {/* Any / clear option */}
            {showAny && (
              <Pressable
                style={[s.item, !selected && s.itemActive]}
                onPress={() => { onSelect(''); onClose(); }}
              >
                <View style={[s.itemIcon, { backgroundColor: '#F0F0F8' }]}>
                  <X size={14} color="#9A9AB0" />
                </View>
                <Text style={[s.itemText, !selected && s.itemTextActive]}>{anyLabel}</Text>
                {!selected && <Check size={16} color="#4A90E2" />}
              </Pressable>
            )}

            {options.map((option) => {
              const isActive = selected === option.value;
              const entry    = getIconEntry(isSubject);
              const coverUrl = isSubject ? resolveOptionIconUrl(option.coverImage) : null;
              const iconSymbol = isSubject ? resolveIconSymbol(option.iconUrl) : null;
              const symbolEntry = iconSymbol ? SUBJECT_SYMBOL_ICONS[iconSymbol] : null;
              const iconUrl = isSubject ? resolveOptionIconUrl(option.iconUrl) : null;
              const iconBgColor = isSubject ? resolveOptionBgColor(option.iconBgColor) : null;
              return (
                <Pressable
                  key={option.value}
                  style={[s.item, isActive && s.itemActive]}
                  onPress={() => { onSelect(option.value); onClose(); }}
                >
                  <View style={[s.itemIcon, { backgroundColor: iconBgColor || symbolEntry?.bg || entry.bg }]}>
                    {coverUrl ? (
                      <Image source={{ uri: coverUrl }} style={s.optionImage} resizeMode="cover" />
                    ) : iconSymbol && symbolEntry ? (
                      <symbolEntry.Icon size={16} color={symbolEntry.color} />
                    ) : iconUrl ? (
                      <Image source={{ uri: iconUrl }} style={s.optionImage} resizeMode="cover" />
                    ) : isSubject ? (
                      <Text style={s.initialText}>{getInitials(option.label)}</Text>
                    ) : (
                      <entry.Icon size={16} color={entry.color} />
                    )}
                  </View>
                  <Text style={[s.itemText, isActive && s.itemTextActive]}>{option.label}</Text>
                  {isActive && <Check size={16} color="#4A90E2" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '82%', paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E4F0', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 12 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ flex: 1, fontSize: 17, fontWeight: '800', color: '#1a1a2e' },
  closeBtn:   { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F5F7FF', alignItems: 'center', justifyContent: 'center' },
  list:       { maxHeight: 420 },
  listContent:{ paddingHorizontal: 14, paddingBottom: 8 },
  item:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, marginBottom: 4 },
  itemActive: { backgroundColor: '#EBF4FF' },
  itemIcon:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionImage:{ width: 32, height: 32, borderRadius: 8 },
  initialText:{ fontSize: 11, fontWeight: '800', color: '#475569' },
  itemText:   { flex: 1, fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  itemTextActive: { color: '#4A90E2', fontWeight: '700' },
});
