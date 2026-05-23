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
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  BookOpen, Check, FlaskConical, Globe, Hash,
  Languages, Leaf, Monitor, School, X,
} from 'lucide-react-native';

export type SelectorOption = { label: string; value: string };

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

const SUBJECT_ICONS: Record<string, IconEntry> = {
  'English':       { Icon: BookOpen,     color: '#4A90E2', bg: '#D6EAFF' },
  'Maths':         { Icon: Hash,          color: '#FF7043', bg: '#FFE8D6' },
  'Mathematics':   { Icon: Hash,          color: '#FF7043', bg: '#FFE8D6' },
  'Science':       { Icon: FlaskConical,  color: '#7DC67A', bg: '#D6F5D6' },
  'Hindi':         { Icon: Languages,     color: '#9B8EC4', bg: '#EDE4FF' },
  'Hindi Stories': { Icon: BookOpen,      color: '#9B8EC4', bg: '#EDE4FF' },
  'EVS':           { Icon: Leaf,           color: '#4CAF50', bg: '#D6F5D6' },
  'Computer':      { Icon: Monitor,        color: '#E6A817', bg: '#FFF5CC' },
  'GK':            { Icon: Globe,          color: '#FF7043', bg: '#FFE8D6' },
};

function getIconEntry(value: string, isSubject: boolean): IconEntry {
  if (isSubject) return SUBJECT_ICONS[value] ?? { Icon: BookOpen, color: '#9A9AB0', bg: '#F0F0F8' };
  return { Icon: School, color: '#4A90E2', bg: '#EBF4FF' };
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
              const entry    = getIconEntry(option.value, isSubject);
              return (
                <Pressable
                  key={option.value}
                  style={[s.item, isActive && s.itemActive]}
                  onPress={() => { onSelect(option.value); onClose(); }}
                >
                  <View style={[s.itemIcon, { backgroundColor: entry.bg }]}>
                    <entry.Icon size={16} color={entry.color} />
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
  itemText:   { flex: 1, fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  itemTextActive: { color: '#4A90E2', fontWeight: '700' },
});
