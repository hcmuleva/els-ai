import {
  Activity,
  BookOpen,
  FlaskConical,
  Globe,
  Hash,
  Languages,
  Leaf,
  Monitor,
  Palette,
  Sparkles,
} from 'lucide-react-native';

export type SubjectIconComp = React.ComponentType<{ size: number; color: string }>;

export type SubjectIconLibraryEntry = {
  key: string;
  label: string;
  Icon: SubjectIconComp;
  color: string;
};

export const SUBJECT_ICON_LIBRARY: SubjectIconLibraryEntry[] = [
  { key: 'book-open', label: 'Book',     Icon: BookOpen,     color: '#4A90E2' },
  { key: 'hash',      label: 'Math',     Icon: Hash,         color: '#FF7043' },
  { key: 'flask',     label: 'Science',  Icon: FlaskConical, color: '#7DC67A' },
  { key: 'leaf',      label: 'Nature',   Icon: Leaf,         color: '#4CAF50' },
  { key: 'languages', label: 'Language', Icon: Languages,    color: '#9B8EC4' },
  { key: 'globe',     label: 'GK',       Icon: Globe,        color: '#F97316' },
  { key: 'monitor',   label: 'Computer', Icon: Monitor,      color: '#0EA5E9' },
  { key: 'sparkles',  label: 'Rhymes',   Icon: Sparkles,     color: '#7C3AED' },
  { key: 'activity',  label: 'Activity', Icon: Activity,     color: '#22C55E' },
  { key: 'palette',   label: 'Art',      Icon: Palette,      color: '#F59E0B' },
];

export const SUBJECT_ICON_LIBRARY_MAP: Record<string, { Icon: SubjectIconComp; color: string }> =
  SUBJECT_ICON_LIBRARY.reduce<Record<string, { Icon: SubjectIconComp; color: string }>>((acc, item) => {
    acc[item.key] = { Icon: item.Icon, color: item.color };
    return acc;
  }, {});

export const DEFAULT_SUBJECT_ICON_BG = '#EEF2FF';
export const DEFAULT_SUBJECT_ICON_COLOR = '#4A90E2';

export const DEFAULT_SUBJECT_ICON: SubjectIconComp = BookOpen;

export function resolveSubjectSymbolKey(value?: string | null): string | null {
  const trimmed = (value || '').trim().toLowerCase();
  if (!trimmed.startsWith('symbol:')) return null;
  const symbol = trimmed.slice('symbol:'.length);
  return SUBJECT_ICON_LIBRARY_MAP[symbol] ? symbol : null;
}
