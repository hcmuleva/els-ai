/**
 * TopicsTab — full-screen classroom-style create/edit modal for topics.
 * Tabs: ⚙ Setup | 📚 Sections | 👁 Preview
 * Sections tab: assign content + quizzes with order management (planner style).
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  ActivityIndicator, Image, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import {
  ChevronDown, ChevronUp, GripVertical,
  Play, Video as VideoIcon, Headphones, Image as ImageIcon, BookOpen,
  FileText, Film, Link, Trophy, GraduationCap, ClipboardList, BarChart2, PenLine,
  Layers, Search, Filter, X, RefreshCw, Plus, FolderOpen, Pencil, Trash2, Eye,
  Star, Leaf, Telescope, Music, Palette, ChevronLeft,
} from 'lucide-react-native';

import { STANDARD_OPTIONS, getStandardLabel } from '../../constants/standards';
import SelectorModal from '../SelectorModal';
import { API_BASE_URL } from '../../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
export type ContentTopic = {
  id: string; classLevel: string; subject: string;
  title: string; coverImage?: string;
  sectionCount: number;
  contentCount?: number;
  quizCount?: number;
};
export type ContentItem = {
  id: string; classLevel: string; subject: string;
  title: string; contentType: string; sectionCount?: number;
};
type QuizItem = {
  id: string; title: string; quiz_type: string;
  class_level: string; subject: string;
  is_published: boolean; total_questions: number;
};
type ModalTab = 'setup' | 'sections' | 'preview';
type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;

type TopicDetailContent = {
  id: string; title: string; contentType: string; sectionCount?: number;
  mediaUrl?: string; externalUrl?: string;
};
type TopicDetailQuiz = {
  id: string; title: string; quiz_type: string;
  class_level: string; subject: string; total_questions: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function resolveUrl(url?: string) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
}
function moveUp<T>(arr: T[], idx: number): T[] {
  if (idx === 0) return arr;
  const a = [...arr]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; return a;
}
function moveDown<T>(arr: T[], idx: number): T[] {
  if (idx >= arr.length - 1) return arr;
  const a = [...arr]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; return a;
}
function toggleId(arr: string[], id: string) {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

const TOPIC_COLORS    = ['#D6EAFF', '#FFE8D6', '#D6F5D6', '#EDE4FF', '#FFF5CC', '#FFE0F0'];
const TOPIC_ICON_COLORS = ['#4A90E2', '#E91E8C', '#7DC67A', '#9B8EC4', '#E6A817', '#FF7043'];
type SubjectCatalogItem = { classLevel: string; title: string; coverImage?: string; iconImage?: string; iconBgColor?: string };
type LucideIcon = React.ComponentType<{ size?: number; color?: string; fill?: string }>;
const TOPIC_ICONS: { Icon: LucideIcon; color: string }[] = [
  { Icon: BookOpen,   color: '#4A90E2' },
  { Icon: Palette,    color: '#E91E8C' },
  { Icon: Leaf,       color: '#7DC67A' },
  { Icon: Telescope,  color: '#9B8EC4' },
  { Icon: Star,       color: '#E6A817' },
  { Icon: Music,      color: '#FF7043' },
];

// SelectorSheet → replaced by shared SelectorModal component

// ── Topic Details Modal ───────────────────────────────────────────────────────
type TypeCfg = { Icon: LucideIcon; color: string; bg: string };
const CONTENT_TYPE_STYLE: Record<string, TypeCfg> = {
  video:       { Icon: Play,       color: '#FF4444', bg: '#FFE8D6' },
  youtube_url: { Icon: Play,       color: '#FF4444', bg: '#FFE8D6' },
  reel_url:    { Icon: Film,       color: '#E91E8C', bg: '#FFE0F0' },
  reel:        { Icon: Film,       color: '#E91E8C', bg: '#FFE0F0' },
  audio:       { Icon: Headphones, color: '#9B8EC4', bg: '#EDE4FF' },
  image:       { Icon: ImageIcon,  color: '#4A90E2', bg: '#D6EAFF' },
  text:        { Icon: BookOpen,   color: '#7DC67A', bg: '#D6F5D6' },
  document:    { Icon: FileText,   color: '#4A90E2', bg: '#D6EAFF' },
};
const DEFAULT_CT_STYLE: TypeCfg = { Icon: Layers, color: '#9A9AB0', bg: '#F4F4FB' };
function ctStyle(t: string): TypeCfg { return CONTENT_TYPE_STYLE[t] ?? DEFAULT_CT_STYLE; }

type QuizTypeCfg = { Icon: LucideIcon; color: string; bg: string };
const QUIZ_TYPE_STYLE: Record<string, QuizTypeCfg> = {
  practice:   { Icon: PenLine,      color: '#4A90E2', bg: '#D6EAFF' },
  exam:       { Icon: GraduationCap, color: '#FF7043', bg: '#FFE8D6' },
  homework:   { Icon: ClipboardList, color: '#9B8EC4', bg: '#EDE4FF' },
  assessment: { Icon: BarChart2,    color: '#7DC67A', bg: '#D6F5D6' },
};
const DEFAULT_QT_STYLE: QuizTypeCfg = { Icon: Trophy, color: '#9A9AB0', bg: '#F4F4FB' };
function qStyle(t: string): QuizTypeCfg { return QUIZ_TYPE_STYLE[t] ?? DEFAULT_QT_STYLE; }

function TopicDetailsModal({ topic, apiFetch, onClose, onEdit }: {
  topic: ContentTopic | null;
  apiFetch: ApiFetch;
  onClose: () => void;
  onEdit: (topic: ContentTopic) => void;
}) {
  const [loading, setLoading]       = useState(false);
  const [contents, setContents]     = useState<TopicDetailContent[]>([]);
  const [quizzes, setQuizzes]       = useState<TopicDetailQuiz[]>([]);

  useEffect(() => {
    if (!topic) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/topics/${topic.id}/details`),
      apiFetch(`/topics/${topic.id}/quizzes`),
    ])
      .then(async ([detailsRes, quizzesRes]) => {
        const details = detailsRes.ok ? await detailsRes.json() : {};
        const quizData = quizzesRes.ok ? await quizzesRes.json() : {};
        setContents(details.contentItems ?? []);
        setQuizzes(quizData.quizzes ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [topic?.id]);

  const cover = resolveUrl(topic?.coverImage);
  const CARD_COLORS = ['#D6EAFF', '#FFE8D6', '#D6F5D6', '#EDE4FF', '#FFF5CC'];

  return (
    <Modal visible={!!topic} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={d.screen}>
        {/* Header */}
        <View style={[d.header, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
          <Pressable onPress={onClose} style={d.backBtn}>
            <ChevronLeft size={24} color="#1a1a2e" />
          </Pressable>
          <Text style={d.headerTitle} numberOfLines={1}>Topic Details</Text>
          {topic && (
            <Pressable style={d.editBtn} onPress={() => { onClose(); onEdit(topic); }}>
              <Text style={d.editBtnText}>Edit</Text>
            </Pressable>
          )}
        </View>

        <ScrollView contentContainerStyle={d.scroll} showsVerticalScrollIndicator={false}>
          {topic && (
            <>
              {/* Hero */}
              <View style={d.hero}>
                {cover ? (
                  <Image source={{ uri: cover }} style={d.heroCover} resizeMode="cover" />
                ) : (
                  <View style={[d.heroCoverPlaceholder, { backgroundColor: CARD_COLORS[0] }]}>
                    <BookOpen size={56} color="#4A90E2" />
                  </View>
                )}
                <View style={d.heroOverlay}>
                  <View style={d.heroBadgeRow}>
                    <View style={d.heroBadge}><Text style={d.heroBadgeText}>{getStandardLabel(topic.classLevel)}</Text></View>
                    <View style={d.heroBadge}><Text style={d.heroBadgeText}>{topic.subject}</Text></View>
                  </View>
                  <Text style={d.heroTitle}>{topic.title}</Text>
                </View>
              </View>

              {/* Stats row */}
              <View style={d.statsRow}>
                <View style={d.statCard}>
                  <Text style={d.statVal}>{contents.length}</Text>
                  <Text style={d.statLabel}>Content</Text>
                </View>
                <View style={d.statCard}>
                  <Text style={d.statVal}>{quizzes.length}</Text>
                  <Text style={d.statLabel}>Quizzes</Text>
                </View>
              </View>

              {loading ? (
                <View style={d.loadingWrap}>
                  <ActivityIndicator size="large" color="#4A90E2" />
                  <Text style={d.loadingText}>Loading details…</Text>
                </View>
              ) : (
                <>
                  {/* Content */}
                  <View style={d.section}>
                    <View style={d.sectionTitleRow}>
                      <BookOpen size={15} color="#4A90E2" />
                      <Text style={d.sectionTitle}>Learning Content</Text>
                    </View>
                    {contents.length === 0 ? (
                      <View style={d.emptyCard}>
                        <Text style={d.emptyText}>No content assigned yet.</Text>
                        <Text style={d.emptyHint}>Edit this topic to add content.</Text>
                      </View>
                    ) : (
                      contents.map((item, idx) => {
                        const cs = ctStyle(item.contentType);
                        return (
                          <View key={item.id} style={d.itemCard}>
                            <View style={[d.itemIcon, { backgroundColor: cs.bg }]}>
                              <cs.Icon size={20} color={cs.color} />
                            </View>
                            <View style={d.itemInfo}>
                              <Text style={d.itemTitle} numberOfLines={2}>{item.title}</Text>
                              <View style={d.itemMetaRow}>
                                <View style={[d.typeChip, { backgroundColor: cs.bg }]}>
                                  <Text style={[d.typeChipText, { color: cs.color }]}>{item.contentType}</Text>
                                </View>
                                <Text style={d.itemMeta}>{item.sectionCount ?? 1} section{(item.sectionCount ?? 1) !== 1 ? 's' : ''}</Text>
                              </View>
                            </View>
                            <View style={d.orderBadge}>
                              <Text style={d.orderBadgeText}>{idx + 1}</Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>

                  {/* Quizzes */}
                  <View style={d.section}>
                    <View style={d.sectionTitleRow}>
                      <Trophy size={15} color="#FF7043" />
                      <Text style={d.sectionTitle}>Quizzes</Text>
                    </View>
                    {quizzes.length === 0 ? (
                      <View style={d.emptyCard}>
                        <Text style={d.emptyText}>No quizzes assigned yet.</Text>
                        <Text style={d.emptyHint}>Edit this topic to add quizzes.</Text>
                      </View>
                    ) : (
                      quizzes.map((quiz, idx) => {
                        const qs = qStyle(quiz.quiz_type);
                        return (
                          <View key={quiz.id} style={d.itemCard}>
                            <View style={[d.itemIcon, { backgroundColor: qs.bg }]}>
                              <qs.Icon size={20} color={qs.color} />
                            </View>
                            <View style={d.itemInfo}>
                              <Text style={d.itemTitle} numberOfLines={2}>{quiz.title}</Text>
                              <View style={d.itemMetaRow}>
                                <View style={[d.typeChip, { backgroundColor: qs.bg }]}>
                                  <Text style={[d.typeChipText, { color: qs.color }]}>{quiz.quiz_type}</Text>
                                </View>
                                <Text style={d.itemMeta}>{getStandardLabel(quiz.class_level)} · {quiz.subject} · {quiz.total_questions}Q</Text>
                              </View>
                            </View>
                            <View style={d.orderBadge}>
                              <Text style={d.orderBadgeText}>{idx + 1}</Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Details styles ────────────────────────────────────────────────────────────
const d = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: '#F5F7FF' },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backArrow:{ fontSize: 28, color: '#1a1a2e', fontWeight: '300', lineHeight: 34 },
  headerTitle:{ flex: 1, fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  editBtn:  { backgroundColor: '#4A90E2', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  editBtnText:{ color: '#fff', fontWeight: '800', fontSize: 13 },
  scroll:   { paddingBottom: 40 },

  hero:                 { margin: 16, borderRadius: 20, overflow: 'hidden', height: 200 },
  heroCover:            { width: '100%', height: '100%' },
  heroCoverPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  heroOverlay:          { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', padding: 16 },
  heroBadgeRow:         { flexDirection: 'row', gap: 8, marginBottom: 6 },
  heroBadge:            { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  heroBadgeText:        { color: '#fff', fontSize: 11, fontWeight: '700' },
  heroTitle:            { fontSize: 20, fontWeight: '900', color: '#fff', lineHeight: 26 },

  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  statVal:  { fontSize: 24, fontWeight: '900', color: '#1a1a2e' },
  statLabel:{ fontSize: 11, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5 },

  loadingWrap:{ alignItems: 'center', paddingVertical: 48, gap: 10 },
  loadingText:{ fontSize: 13, color: '#9A9AB0', fontWeight: '500' },

  section:        { marginHorizontal: 16, marginBottom: 16 },
  sectionTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle:   { fontSize: 15, fontWeight: '900', color: '#1a1a2e' },

  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', gap: 6 },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#9A9AB0' },
  emptyHint: { fontSize: 12, color: '#B0B8D0' },

  itemCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  itemIcon:    { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  itemInfo:    { flex: 1, gap: 5 },
  itemTitle:   { fontSize: 14, fontWeight: '800', color: '#1a1a2e', lineHeight: 20 },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typeChip:    { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  typeChipText:{ fontSize: 10, fontWeight: '800' },
  itemMeta:    { fontSize: 11, color: '#9A9AB0', fontWeight: '500' },
  orderBadge:  { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F0F0F8', alignItems: 'center', justifyContent: 'center' },
  orderBadgeText:{ fontSize: 12, fontWeight: '900', color: '#9A9AB0' },
});

// ── Topic card ────────────────────────────────────────────────────────────────
function TopicCard({ topic, idx, onAction }: {
  topic: ContentTopic; idx: number;
  onAction: (a: 'details' | 'edit' | 'delete' | 'assign_content' | 'assign_quiz') => void;
}) {
  const bg    = TOPIC_COLORS[idx % TOPIC_COLORS.length];
  const { Icon: TopicIcon, color: iconColor } = TOPIC_ICONS[idx % TOPIC_ICONS.length];
  const cover = resolveUrl(topic.coverImage);
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={[s.artBox, { backgroundColor: bg }]}>
          {cover ? <Image source={{ uri: cover }} style={s.artImg} resizeMode="cover" /> : <TopicIcon size={28} color={iconColor} />}
        </View>
        <View style={s.cardInfo}>
          <Text style={s.cardTitle} numberOfLines={2}>{topic.title}</Text>
          <Text style={s.cardMeta}>{getStandardLabel(topic.classLevel)} · {topic.subject}</Text>
          <View style={s.cardChipRow}>
            <View style={s.cardChip}>
              <BookOpen size={10} color="#4A90E2" />
              <Text style={s.cardChipText}>{topic.contentCount ?? 0} content</Text>
            </View>
            <View style={s.cardChip}>
              <Trophy size={10} color="#FF7043" />
              <Text style={s.cardChipText}>{topic.quizCount ?? 0} quiz</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={s.cardFooter}>
        <Pressable style={[s.footerBtn, { backgroundColor: '#EBF4FF' }]} onPress={() => onAction('details')}>
          <Eye size={13} color="#1A4DA2" />
          <Text style={[s.footerBtnText, { color: '#1A4DA2' }]}>Details</Text>
        </Pressable>
        <Pressable style={[s.footerBtn, { backgroundColor: '#FFF3E0' }]} onPress={() => onAction('edit')}>
          <Pencil size={13} color="#E65100" />
          <Text style={[s.footerBtnText, { color: '#E65100' }]}>Edit</Text>
        </Pressable>
        <Pressable style={[s.footerBtn, { backgroundColor: '#FEF0ED' }]} onPress={() => onAction('delete')}>
          <Trash2 size={13} color="#E05A3A" />
          <Text style={[s.footerBtnText, { color: '#E05A3A' }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  topics: ContentTopic[];
  loading: boolean;
  filters: { classLevel: string; subject: string };
  subjectCatalog: SubjectCatalogItem[];
  contentItems: ContentItem[];
  apiFetch: ApiFetch;
  onFiltersChange: (f: { classLevel: string; subject: string }) => void;
  onApplyFilters: () => void;
  onTopicAction: (topic: ContentTopic, action: 'delete') => void;
  onRefresh: () => void;
  onUploadCover: () => Promise<string>;
  message?: { type: 'success' | 'error'; text: string } | null;
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TopicsTab({
  topics, loading, filters, subjectCatalog, contentItems, apiFetch,
  onFiltersChange, onApplyFilters, onTopicAction, onRefresh, onUploadCover, message,
}: Props) {
  // List filter selectors
  const [classFilterOpen, setClassFilterOpen]     = useState(false);
  const [subjectFilterOpen, setSubjectFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery]             = useState('');

  // Details modal
  const [detailsTopic, setDetailsTopic] = useState<ContentTopic | null>(null);

  // Modal state
  const [isOpen, setIsOpen]               = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [modalTab, setModalTab]           = useState<ModalTab>('setup');
  const [saving, setSaving]               = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [allQuizzes, setAllQuizzes]       = useState<QuizItem[]>([]);
  const [toast, setToast]                 = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [title, setTitle]           = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [subject, setSubject]       = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [contentIds, setContentIds] = useState<string[]>([]);
  const [quizIds, setQuizIds]       = useState<string[]>([]);

  // Picker state
  const [contentPickerOpen, setContentPickerOpen] = useState(false);
  const [quizPickerOpen, setQuizPickerOpen]       = useState(false);
  const [contentSearch, setContentSearch]         = useState('');
  const [quizSearch, setQuizSearch]               = useState('');
  const [quizSubjectFilter, setQuizSubjectFilter]         = useState('');
  const [quizSubjectOpen, setQuizSubjectOpen]             = useState(false);
  const [contentClassPickerOpen, setContentClassPickerOpen]     = useState(false);
  const [contentSubjectPickerOpen, setContentSubjectPickerOpen] = useState(false);

  // Draft selectors
  const [draftClassOpen, setDraftClassOpen]     = useState(false);
  const [draftSubjectOpen, setDraftSubjectOpen] = useState(false);
  const [contentPickerClass, setContentPickerClass]     = useState('');
  const [contentPickerSubject, setContentPickerSubject] = useState('');

  const classOptions   = STANDARD_OPTIONS.map((o) => ({ label: o.label, value: o.value }));
  const subjectOptions = useMemo(() => {
    const filtered = subjectCatalog.filter((item) => !filters.classLevel || item.classLevel === filters.classLevel);
    const byTitle = new Map<string, { coverImage?: string; iconUrl?: string; iconBgColor?: string }>();
    filtered.forEach((item) => {
      const title = item.title.trim();
      if (!title) return;
      if (!byTitle.has(title)) {
        byTitle.set(title, { coverImage: item.coverImage, iconUrl: item.iconImage, iconBgColor: item.iconBgColor });
      }
    });
    if (filters.subject && !byTitle.has(filters.subject)) byTitle.set(filters.subject, {});
    return Array.from(byTitle.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, icon]) => ({
        label: title,
        value: title,
        coverImage: icon.coverImage,
        iconUrl: icon.iconUrl,
        iconBgColor: icon.iconBgColor,
      }));
  }, [filters.classLevel, filters.subject, subjectCatalog]);
  const draftSubjectOptions = useMemo(() => {
    const filtered = subjectCatalog.filter((item) => !classLevel || item.classLevel === classLevel);
    const byTitle = new Map<string, { coverImage?: string; iconUrl?: string; iconBgColor?: string }>();
    filtered.forEach((item) => {
      const title = item.title.trim();
      if (!title) return;
      if (!byTitle.has(title)) {
        byTitle.set(title, { coverImage: item.coverImage, iconUrl: item.iconImage, iconBgColor: item.iconBgColor });
      }
    });
    if (subject && !byTitle.has(subject)) byTitle.set(subject, {});
    return Array.from(byTitle.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, icon]) => ({
        label: title,
        value: title,
        coverImage: icon.coverImage,
        iconUrl: icon.iconUrl,
        iconBgColor: icon.iconBgColor,
      }));
  }, [classLevel, subject, subjectCatalog]);
  const contentPickerSubjectOptions = useMemo(() => {
    const filtered = subjectCatalog.filter((item) => !contentPickerClass || item.classLevel === contentPickerClass);
    const byTitle = new Map<string, { coverImage?: string; iconUrl?: string; iconBgColor?: string }>();
    filtered.forEach((item) => {
      const title = item.title.trim();
      if (!title) return;
      if (!byTitle.has(title)) {
        byTitle.set(title, { coverImage: item.coverImage, iconUrl: item.iconImage, iconBgColor: item.iconBgColor });
      }
    });
    if (contentPickerSubject && !byTitle.has(contentPickerSubject)) byTitle.set(contentPickerSubject, {});
    return Array.from(byTitle.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, icon]) => ({
        label: title,
        value: title,
        coverImage: icon.coverImage,
        iconUrl: icon.iconUrl,
        iconBgColor: icon.iconBgColor,
      }));
  }, [contentPickerClass, contentPickerSubject, subjectCatalog]);
  const quizSubjectOptions = useMemo(() => {
    const filtered = subjectCatalog.filter((item) => !classLevel || item.classLevel === classLevel);
    const byTitle = new Map<string, { coverImage?: string; iconUrl?: string; iconBgColor?: string }>();
    filtered.forEach((item) => {
      const title = item.title.trim();
      if (!title) return;
      if (!byTitle.has(title)) {
        byTitle.set(title, { coverImage: item.coverImage, iconUrl: item.iconImage, iconBgColor: item.iconBgColor });
      }
    });
    if (quizSubjectFilter && !byTitle.has(quizSubjectFilter)) byTitle.set(quizSubjectFilter, {});
    return Array.from(byTitle.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, icon]) => ({
        label: title,
        value: title,
        coverImage: icon.coverImage,
        iconUrl: icon.iconUrl,
        iconBgColor: icon.iconBgColor,
      }));
  }, [classLevel, quizSubjectFilter, subjectCatalog]);

  // Load quiz library when class is selected
  useEffect(() => {
    if (!classLevel || !isOpen) return;
    setLoadingQuizzes(true);
    apiFetch(`/quizzes/teacher/library?status=all&limit=200`)
      .then((r) => r.ok ? r.json() : { quizzes: [] })
      .then((d) => setAllQuizzes(d.quizzes ?? []))
      .catch(() => {})
      .finally(() => setLoadingQuizzes(false));
  }, [classLevel, isOpen]);

  const openCreate = () => {
    setEditingId(null); setTitle(''); setClassLevel(''); setSubject('');
    setCoverImage(''); setContentIds([]); setQuizIds([]);
    setModalTab('setup'); setIsOpen(true);
  };

  const openEdit = async (topic: ContentTopic) => {
    setEditingId(topic.id);
    setTitle(topic.title); setClassLevel(topic.classLevel);
    setSubject(topic.subject); setCoverImage(topic.coverImage ?? '');
    setModalTab('setup'); setSaving(false);
    // Load existing assignments
    const [contentRes, quizRes] = await Promise.all([
      apiFetch(`/topics/${topic.id}/assignments`),
      apiFetch(`/topics/${topic.id}/quizzes`),
    ]);
    if (contentRes.ok) {
      const d = await contentRes.json();
      setContentIds(d.contentIds ?? []);
    }
    if (quizRes.ok) {
      const d = await quizRes.json();
      setQuizIds((d.quizzes ?? []).map((q: QuizItem) => q.id));
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !classLevel || !subject) {
      setToast({ type: 'error', text: 'Title, class and subject are required.' });
      return;
    }
    setSaving(true);
    try {
      const endpoint = editingId ? `/topics/${editingId}` : '/topics';
      const method   = editingId ? 'PATCH' : 'POST';
      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify({ title: title.trim(), classLevel, subject, coverImage: coverImage.trim() || undefined }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to save topic'); }
      const saved = await res.json();
      const topicId = saved.id ?? editingId;

      // Assign content
      if (topicId) {
        await Promise.all([
          apiFetch(`/topics/${topicId}/assignments`, { method: 'PUT', body: JSON.stringify({ contentIds }) }),
          apiFetch(`/topics/${topicId}/quizzes`,     { method: 'PUT', body: JSON.stringify({ quizIds }) }),
        ]);
      }
      setToast({ type: 'success', text: editingId ? 'Topic updated.' : 'Topic created.' });
      setIsOpen(false);
      onRefresh();
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save topic' });
    } finally { setSaving(false); }
  };

  const handleUploadCover = async () => {
    setUploadingCover(true);
    try { const url = await onUploadCover(); setCoverImage(url); }
    catch (e) { setToast({ type: 'error', text: 'Image upload failed.' }); }
    finally { setUploadingCover(false); }
  };

  // Reset picker filters when modal opens
  useEffect(() => {
    if (isOpen) {
      setContentPickerClass(classLevel);
      setContentPickerSubject(subject);
    }
  }, [isOpen]);

  const filteredContents = useMemo(() => {
    const q = contentSearch.trim().toLowerCase();
    return contentItems.filter((c) => {
      if (contentPickerClass && c.classLevel !== contentPickerClass) return false;
      if (contentPickerSubject && c.subject !== contentPickerSubject) return false;
      if (q && !c.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [contentItems, contentSearch, contentPickerClass, contentPickerSubject]);

  const filteredQuizzes = useMemo(() => {
    const q = quizSearch.trim().toLowerCase();
    return allQuizzes.filter((qz) => {
      if (quizSubjectFilter && qz.subject !== quizSubjectFilter) return false;
      if (q && !qz.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allQuizzes, quizSearch, quizSubjectFilter]);

  const selectedContents = contentIds.map((id) => contentItems.find((c) => c.id === id)).filter(Boolean) as ContentItem[];
  const selectedQuizzes  = quizIds.map((id) => allQuizzes.find((q) => q.id === id)).filter(Boolean) as QuizItem[];

  return (
    <View style={s.root}>
      {/* ── Page header ── */}
      <View style={s.pageHeader}>
        <View>
          <Text style={s.pageTitle}>Topics</Text>
          <Text style={s.pageSub}>{topics.length} topic{topics.length !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable style={s.createBtn} onPress={openCreate}>
          <Plus size={14} color="#fff" />
          <Text style={s.createBtnText}>New Topic</Text>
        </Pressable>
      </View>

      {/* ── External toast ── */}
      {(toast || message) && (() => {
        const t = toast ?? message!;
        return (
          <View style={[s.toast, t.type === 'success' ? s.toastSuccess : s.toastError]}>
            <Text style={[s.toastText, t.type === 'success' ? s.toastSuccessText : s.toastErrorText]}>{t.text}</Text>
          </View>
        );
      })()}

      {/* ── Filters ── */}
      <View style={s.filterSection}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
          <Filter size={11} color="#9A9AB0" />
          <Text style={[s.filterLabel, { marginBottom: 0 }]}>Filters</Text>
        </View>
        <View style={s.searchBar}>
          <Search size={14} color="#9A9AB0" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search topics..."
            placeholderTextColor="#A0A8C0"
            style={s.searchBarInput}
          />
          {searchQuery !== '' && (
            <Pressable onPress={() => setSearchQuery('')}>
              <X size={14} color="#9A9AB0" />
            </Pressable>
          )}
        </View>
        <View style={s.filterRow}>
          <Pressable style={[s.chip, !!filters.classLevel && s.chipActive]} onPress={() => setClassFilterOpen(true)}>
            <Text style={[s.chipText, !!filters.classLevel && s.chipTextActive]}>
              {filters.classLevel ? getStandardLabel(filters.classLevel) : 'All Classes'}
            </Text>
          </Pressable>
          <Pressable style={[s.chip, !!filters.subject && s.chipActive]} onPress={() => setSubjectFilterOpen(true)}>
            <Text style={[s.chipText, !!filters.subject && s.chipTextActive]}>
              {filters.subject || 'All Subjects'}
            </Text>
          </Pressable>
          {(filters.classLevel || filters.subject) && (
            <Pressable style={s.clearChip} onPress={() => { onFiltersChange({ classLevel: '', subject: '' }); onApplyFilters(); }}>
              <Text style={s.clearChipText}>✕ Clear</Text>
            </Pressable>
          )}
          <Pressable style={s.applyBtn} onPress={onApplyFilters} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.applyBtnText}>Apply</Text>}
          </Pressable>
        </View>
      </View>

      {/* ── Topic list ── */}
      <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={s.emptyWrap}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={s.loadingText}>Loading topics…</Text>
          </View>
        ) : topics.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' }}>
              <FolderOpen size={36} color="#4A90E2" />
            </View>
            <Text style={s.emptyTitle}>No topics yet</Text>
            <Text style={s.emptySub}>Create your first topic to get started.</Text>
            <Pressable style={s.emptyBtn} onPress={openCreate}><Text style={s.emptyBtnText}>Create Topic</Text></Pressable>
          </View>
        ) : (() => {
          const keyword = searchQuery.trim().toLowerCase();
          const visibleTopics = keyword
            ? topics.filter((t) => `${t.title} ${t.classLevel} ${t.subject}`.toLowerCase().includes(keyword))
            : topics;
          if (visibleTopics.length === 0) {
            return (
              <View style={s.emptyWrap}>
                <FolderOpen size={36} color="#D0D8F0" />
                <Text style={s.emptyTitle}>No topics match "{searchQuery}"</Text>
              </View>
            );
          }
          return visibleTopics.map((topic, idx) => (
            <TopicCard
              key={topic.id} topic={topic} idx={idx}
              onAction={(action) => {
                if (action === 'edit') openEdit(topic);
                else if (action === 'details') setDetailsTopic(topic);
                else if (action === 'delete') onTopicAction(topic, 'delete');
              }}
            />
          ));
        })()}
      </ScrollView>

      {/* ── Filter selectors ── */}
      <SelectorModal visible={classFilterOpen} title="Select Class" options={classOptions} selected={filters.classLevel} anyLabel="All Classes" onSelect={(v) => { onFiltersChange({ classLevel: v, subject: '' }); setClassFilterOpen(false); }} onClose={() => setClassFilterOpen(false)} />
      <SelectorModal visible={subjectFilterOpen} title="Select Subject" options={subjectOptions} selected={filters.subject} anyLabel="All Subjects" isSubject onSelect={(v) => { onFiltersChange({ ...filters, subject: v }); setSubjectFilterOpen(false); }} onClose={() => setSubjectFilterOpen(false)} />

      {/* ── Topic Details Modal ── */}
      <TopicDetailsModal
        topic={detailsTopic}
        apiFetch={apiFetch}
        onClose={() => setDetailsTopic(null)}
        onEdit={(topic) => openEdit(topic)}
      />

      {/* ══ Full-screen Create / Edit Modal ══ */}
      <Modal visible={isOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setIsOpen(false)}>
        <View style={s.modalScreen}>

          {/* Header */}
          <View style={[s.modalHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
            <Pressable onPress={() => setIsOpen(false)} style={s.modalBackBtn}>
              <ChevronLeft size={24} color="#1a1a2e" />
            </Pressable>
            <Text style={s.modalTitle} numberOfLines={1}>{editingId ? 'Edit Topic' : 'New Topic'}</Text>
            <Pressable style={s.modalSaveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSaveBtnText}>Save</Text>}
            </Pressable>
          </View>

          {/* Tab bar */}
          <View style={s.modalTabBar}>
            {([
              ['setup',    Layers,   'Setup'],
              ['sections', BookOpen, 'Sections'],
              ['preview',  Eye,      'Preview'],
            ] as [ModalTab, LucideIcon, string][]).map(([tab, TabIcon, label]) => {
              const active = modalTab === tab;
              return (
                <Pressable key={tab} style={[s.modalTab, active && s.modalTabActive]} onPress={() => setModalTab(tab)}>
                  <TabIcon size={14} color={active ? '#4A90E2' : '#9A9AB0'} />
                  <Text style={[s.modalTabText, active && s.modalTabTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── SETUP tab ── */}
          {modalTab === 'setup' && (
            <ScrollView contentContainerStyle={s.tabContent}>

              <View style={s.fieldGroup}>
                <Text style={s.groupLabel}>BASIC INFO</Text>
                <View style={s.fieldCard}>
                  <Text style={s.fieldLabel}>Topic Title *</Text>
                  <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Panchatantra Stories" style={s.fieldInput} placeholderTextColor="#B0B8D0" />
                </View>
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.groupLabel}>CLASS SETTINGS</Text>
                <View style={s.fieldCard}>
                  <Text style={s.fieldLabel}>Standard / Class *</Text>
                  <Pressable style={s.selectorRow} onPress={() => setDraftClassOpen(true)}>
                    <Text style={classLevel ? s.selectorVal : s.selectorPlaceholder}>{classLevel ? getStandardLabel(classLevel) : 'Select Standard'}</Text>
                    <Text style={{ color: '#B0B8D0', fontSize: 16 }}>›</Text>
                  </Pressable>
                  <View style={s.fieldDivider} />
                  <Text style={s.fieldLabel}>Subject *</Text>
                  <Pressable style={s.selectorRow} onPress={() => setDraftSubjectOpen(true)}>
                    <Text style={subject ? s.selectorVal : s.selectorPlaceholder}>{subject || 'Select Subject'}</Text>
                    <Text style={{ color: '#B0B8D0', fontSize: 16 }}>›</Text>
                  </Pressable>
                </View>
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.groupLabel}>COVER IMAGE</Text>
                <View style={s.fieldCard}>
                  <Text style={s.fieldLabel}>Image URL</Text>
                  <TextInput
                    value={coverImage} onChangeText={setCoverImage}
                    placeholder="Paste URL or upload below…"
                    style={s.fieldInput} placeholderTextColor="#B0B8D0" autoCapitalize="none"
                  />
                  <View style={s.fieldDivider} />
                  <Pressable style={s.uploadBtn} onPress={handleUploadCover} disabled={uploadingCover}>
                    {uploadingCover
                      ? <ActivityIndicator size="small" color="#4A90E2" />
                      : <Text style={s.uploadBtnText}>⬆ Upload Image</Text>}
                  </Pressable>
                  {coverImage.trim() ? (
                    <View style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden' }}>
                      <Image source={{ uri: resolveUrl(coverImage) }} style={{ width: '100%', height: 160 }} resizeMode="cover" />
                      <Pressable style={s.removeImgBtn} onPress={() => setCoverImage('')}>
                        <Text style={s.removeImgBtnText}>✕ Remove</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            </ScrollView>
          )}

          {/* ── SECTIONS tab ── */}
          {modalTab === 'sections' && (
            <ScrollView contentContainerStyle={s.tabContent}>
              {!classLevel && (
                <View style={s.infoBox}>
                  <Text style={s.infoBoxText}>⚠ Select a Standard/Class in Setup first to add resources.</Text>
                </View>
              )}

              {/* ── Content section ── */}
              <View style={s.secGroup}>
                <View style={s.secGroupHeader}>
                  <Text style={s.secGroupTitle}>📚 Learning Content</Text>
                  <Pressable style={[s.addSecBtn, !classLevel && { opacity: 0.4 }]} disabled={!classLevel} onPress={() => setContentPickerOpen(true)}>
                    <Text style={s.addSecBtnText}>+ Add</Text>
                  </Pressable>
                </View>
                {contentIds.length === 0 ? (
                  <Text style={s.secEmptyText}>No content added yet.</Text>
                ) : (
                  selectedContents.map((item, idx) => (
                    <View key={item.id} style={s.sectionItem}>
                      <View style={s.dragHandle}>
                        <GripVertical size={16} color="#B0B8D0" />
                        <Text style={s.sectionItemOrder}>{idx + 1}</Text>
                      </View>
                      <View style={s.sectionItemBody}>
                        <Text style={s.sectionItemTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={s.sectionItemMeta}>{item.subject} · {item.contentType}</Text>
                      </View>
                      <View style={s.sectionItemActions}>
                        <TouchableOpacity onPress={() => setContentIds((p) => moveUp(p, idx))} disabled={idx === 0} style={[s.orderBtn, idx === 0 && { opacity: 0.2 }]}>
                          <ChevronUp size={14} color="#4A90E2" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setContentIds((p) => moveDown(p, idx))} disabled={idx === contentIds.length - 1} style={[s.orderBtn, idx === contentIds.length - 1 && { opacity: 0.2 }]}>
                          <ChevronDown size={14} color="#4A90E2" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setContentIds((p) => p.filter((x) => x !== item.id))} style={s.removeBtn}>
                          <Text style={s.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* ── Quiz section ── */}
              <View style={s.secGroup}>
                <View style={s.secGroupHeader}>
                  <Text style={s.secGroupTitle}>✏ Quizzes</Text>
                  <Pressable style={[s.addSecBtn, !classLevel && { opacity: 0.4 }]} disabled={!classLevel} onPress={() => setQuizPickerOpen(true)}>
                    <Text style={s.addSecBtnText}>+ Add</Text>
                  </Pressable>
                </View>
                {quizIds.length === 0 ? (
                  <Text style={s.secEmptyText}>No quizzes added yet.</Text>
                ) : loadingQuizzes ? (
                  <ActivityIndicator size="small" color="#FF7043" style={{ margin: 12 }} />
                ) : (
                  selectedQuizzes.map((qItem, qidx) => (
                    <View key={qItem.id} style={s.sectionItem}>
                      <View style={s.dragHandle}>
                        <GripVertical size={16} color="#B0B8D0" />
                        <Text style={s.sectionItemOrder}>{qidx + 1}</Text>
                      </View>
                      <View style={s.sectionItemBody}>
                        <Text style={s.sectionItemTitle} numberOfLines={1}>{qItem.title}</Text>
                        <Text style={s.sectionItemMeta}>{qItem.subject} · {qItem.quiz_type} · {qItem.total_questions}Q</Text>
                      </View>
                      <View style={s.sectionItemActions}>
                        <TouchableOpacity onPress={() => setQuizIds((p) => moveUp(p, qidx))} disabled={qidx === 0} style={[s.orderBtn, qidx === 0 && { opacity: 0.2 }]}>
                          <ChevronUp size={14} color="#FF7043" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setQuizIds((p) => moveDown(p, qidx))} disabled={qidx === quizIds.length - 1} style={[s.orderBtn, qidx === quizIds.length - 1 && { opacity: 0.2 }]}>
                          <ChevronDown size={14} color="#FF7043" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setQuizIds((p) => p.filter((x) => x !== qItem.id))} style={s.removeBtn}>
                          <Text style={s.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}

          {/* ── PREVIEW tab ── */}
          {modalTab === 'preview' && (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              <View style={s.previewCard}>
                <View style={[s.previewHeader, { backgroundColor: '#4A7FE0' }]}>
                  <Text style={s.previewTitle}>{title || 'Untitled Topic'}</Text>
                  <Text style={s.previewSub}>
                    {classLevel ? getStandardLabel(classLevel) : 'No class'}{' · '}{subject || 'No subject'}
                  </Text>
                  <View style={s.previewStatsRow}>
                    <View style={s.previewStat}><Text style={s.previewStatVal}>{contentIds.length}</Text><Text style={s.previewStatLabel}>Content</Text></View>
                    <View style={s.previewStat}><Text style={s.previewStatVal}>{quizIds.length}</Text><Text style={s.previewStatLabel}>Quizzes</Text></View>
                  </View>
                </View>
                <View style={s.previewBody}>
                  {selectedContents.length > 0 && (
                    <>
                      <Text style={s.previewSectionTitle}>📚 Content</Text>
                      {selectedContents.map((c, i) => (
                        <View key={c.id} style={s.previewItem}>
                          <View style={[s.previewItemDot, { backgroundColor: '#4A90E2' }]}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{i + 1}</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.previewItemTitle}>{c.title}</Text>
                            <Text style={s.previewItemMeta}>{c.subject} · {c.contentType}</Text>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                  {selectedQuizzes.length > 0 && (
                    <>
                      <Text style={[s.previewSectionTitle, { marginTop: 12 }]}>✏ Quizzes</Text>
                      {selectedQuizzes.map((q, i) => (
                        <View key={q.id} style={s.previewItem}>
                          <View style={[s.previewItemDot, { backgroundColor: '#FF7043' }]}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{i + 1}</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.previewItemTitle}>{q.title}</Text>
                            <Text style={s.previewItemMeta}>{q.subject} · {q.quiz_type} · {q.total_questions}Q</Text>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                  {selectedContents.length === 0 && selectedQuizzes.length === 0 && (
                    <View style={s.previewEmpty}>
                      <Text style={{ fontSize: 36 }}>📭</Text>
                      <Text style={s.previewEmptyText}>No sections added yet. Go to the Sections tab to add content and quizzes.</Text>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
          )}
        </View>

        {/* ── Content picker (bottom sheet) ── */}
        <Modal visible={contentPickerOpen} transparent animationType="slide" onRequestClose={() => setContentPickerOpen(false)}>
          <View style={s.pickerOverlay}>
            <View style={s.pickerSheet}>
              <View style={s.pickerHeader}>
                <Text style={s.pickerTitle}>Add Learning Content</Text>
                <Pressable style={s.pickerDoneBtn} onPress={() => setContentPickerOpen(false)}>
                  <Text style={s.pickerDoneText}>Done ({contentIds.length})</Text>
                </Pressable>
              </View>
              <View style={s.pickerSearch}>
                <View style={[s.quizFilterRow, { marginBottom: 8 }]}>
                  <Pressable style={[s.filterChipBtn, contentPickerClass && { backgroundColor: '#D6EAFF' }]} onPress={() => setContentClassPickerOpen(true)}>
                    <Text style={contentPickerClass ? s.filterChipActive : s.filterChipPlaceholder}>
                      {contentPickerClass ? getStandardLabel(contentPickerClass) : 'Class ▾'}
                    </Text>
                  </Pressable>
                  <Pressable style={[s.filterChipBtn, contentPickerSubject && { backgroundColor: '#D6EAFF' }]} onPress={() => setContentSubjectPickerOpen(true)}>
                    <Text style={contentPickerSubject ? s.filterChipActive : s.filterChipPlaceholder}>
                      {contentPickerSubject || 'Subject ▾'}
                    </Text>
                  </Pressable>
                  {(contentPickerClass || contentPickerSubject) && (
                    <Pressable style={[s.filterChipBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => { setContentPickerClass(''); setContentPickerSubject(''); }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>✕ Clear</Text>
                    </Pressable>
                  )}
                </View>
                <TextInput value={contentSearch} onChangeText={setContentSearch} placeholder="Search content…" style={s.searchInput} placeholderTextColor="#B0B8D0" />
              </View>
              <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
                {filteredContents.length === 0 ? <Text style={s.flatEmpty}>No content found.</Text> :
                  filteredContents.map((item) => {
                    const sel = contentIds.includes(item.id);
                    return (
                      <Pressable key={item.id} style={[s.pickerItem, sel && s.pickerItemSelected]} onPress={() => setContentIds((p) => toggleId(p, item.id))}>
                        <View style={[s.checkBox, sel && s.checkBoxSelected]}>{sel && <Text style={s.checkTick}>✓</Text>}</View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.pickerItemTitle}>{item.title}</Text>
                          <Text style={s.pickerItemMeta}>{getStandardLabel(item.classLevel)} · {item.subject} · {item.contentType}</Text>
                        </View>
                      </Pressable>
                    );
                  })
                }
              </ScrollView>
            </View>
          </View>
          <SelectorModal visible={contentClassPickerOpen} title="Filter by Class" options={classOptions} selected={contentPickerClass} anyLabel="All Classes" onSelect={(v) => { setContentPickerClass(v); setContentClassPickerOpen(false); }} onClose={() => setContentClassPickerOpen(false)} />
          <SelectorModal visible={contentSubjectPickerOpen} title="Filter by Subject" options={contentPickerSubjectOptions} selected={contentPickerSubject} anyLabel="All Subjects" isSubject onSelect={(v) => { setContentPickerSubject(v); setContentSubjectPickerOpen(false); }} onClose={() => setContentSubjectPickerOpen(false)} />
        </Modal>

        {/* ── Quiz picker (bottom sheet) ── */}
        <Modal visible={quizPickerOpen} transparent animationType="slide" onRequestClose={() => setQuizPickerOpen(false)}>
          <View style={s.pickerOverlay}>
            <View style={s.pickerSheet}>
              <View style={s.pickerHeader}>
                <Text style={s.pickerTitle}>Add Quizzes</Text>
                <Pressable style={s.pickerDoneBtn} onPress={() => setQuizPickerOpen(false)}>
                  <Text style={s.pickerDoneText}>Done ({quizIds.length})</Text>
                </Pressable>
              </View>
              <View style={s.pickerSearch}>
                <View style={s.quizFilterRow}>
                  <Pressable style={s.filterChipBtn} onPress={() => setQuizSubjectOpen(true)}>
                    <Text style={quizSubjectFilter ? s.filterChipActive : s.filterChipPlaceholder}>{quizSubjectFilter || 'Subject ▾'}</Text>
                  </Pressable>
                  <TextInput value={quizSearch} onChangeText={setQuizSearch} placeholder="Search quizzes…" style={[s.searchInput, { flex: 1 }]} placeholderTextColor="#B0B8D0" />
                </View>
              </View>
              <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
                {loadingQuizzes ? <ActivityIndicator style={{ marginTop: 20 }} color="#FF7043" /> :
                  filteredQuizzes.length === 0 ? <Text style={s.flatEmpty}>No quizzes found.</Text> :
                  filteredQuizzes.map((quiz) => {
                    const sel = quizIds.includes(quiz.id);
                    return (
                      <Pressable key={quiz.id} style={[s.pickerItem, sel && s.pickerItemSelectedQuiz]} onPress={() => setQuizIds((p) => toggleId(p, quiz.id))}>
                        <View style={[s.checkBox, sel && s.checkBoxSelectedQuiz]}>{sel && <Text style={s.checkTick}>✓</Text>}</View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.pickerItemTitle}>{quiz.title}</Text>
                          <Text style={s.pickerItemMeta}>{quiz.subject || '-'} · {quiz.quiz_type} · {quiz.total_questions}Q</Text>
                        </View>
                      </Pressable>
                    );
                  })
                }
              </ScrollView>
            </View>
          </View>
          <SelectorModal visible={quizSubjectOpen} title="Filter by Subject" options={quizSubjectOptions} selected={quizSubjectFilter} anyLabel="All Subjects" isSubject onSelect={(v) => { setQuizSubjectFilter(v); setQuizSubjectOpen(false); }} onClose={() => setQuizSubjectOpen(false)} />
        </Modal>

        {/* Draft selectors */}
        <SelectorModal visible={draftClassOpen} title="Select Class" options={classOptions} selected={classLevel} onSelect={(v) => { setClassLevel(v); setSubject(''); setDraftClassOpen(false); }} onClose={() => setDraftClassOpen(false)} />
        <SelectorModal visible={draftSubjectOpen} title="Select Subject" options={draftSubjectOptions} selected={subject} isSubject onSelect={(v) => { setSubject(v); setDraftSubjectOpen(false); }} onClose={() => setDraftSubjectOpen(false)} />
      </Modal>
    </View>
  );
}

// ── Styles (matching planner.tsx) ─────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FF' },
  list: { padding: 16, paddingBottom: 40 },

  pageHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingVertical: 16 },
  pageTitle:     { fontSize: 22, fontWeight: '900', color: '#1a1a2e' },
  pageSub:       { fontSize: 12, color: '#9A9AB0', fontWeight: '500', marginTop: 2 },
  createBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#4A90E2', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  toast:            { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  toastSuccess:     { backgroundColor: '#D6F5D6', borderWidth: 1, borderColor: '#7DC67A' },
  toastError:       { backgroundColor: '#FFE8E8', borderWidth: 1, borderColor: '#FF7043' },
  toastText:        { fontSize: 13, fontWeight: '600' },
  toastSuccessText: { color: '#1A6B1A' },
  toastErrorText:   { color: '#B91C1C' },

  filterSection: { paddingHorizontal: 16, marginBottom: 10 },
  filterLabel:   { fontSize: 11, fontWeight: '800', color: '#9A9AB0', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  filterRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  searchBar:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 },
  searchBarInput:{ flex: 1, fontSize: 13, color: '#1a1a2e', paddingVertical: 0 },
  chip:          { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#F0F0F8' },
  chipActive:    { backgroundColor: '#D6EAFF' },
  chipText:      { fontSize: 12, fontWeight: '600', color: '#9A9AB0' },
  chipTextActive:{ color: '#1A4DA2', fontWeight: '700' },
  clearChip:     { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FEE2E2' },
  clearChipText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  applyBtn:      { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#4A90E2' },
  applyBtnText:  { fontSize: 12, fontWeight: '700', color: '#fff' },

  emptyWrap:   { alignItems: 'center', paddingVertical: 60, gap: 8 },
  loadingText: { fontSize: 13, color: '#9A9AB0', fontWeight: '500' },
  emptyTitle:  { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptySub:    { fontSize: 13, color: '#9A9AB0', textAlign: 'center', lineHeight: 20 },
  emptyBtn:    { marginTop: 8, backgroundColor: '#4A90E2', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:{ color: '#fff', fontWeight: '800', fontSize: 14 },

  card:        { backgroundColor: '#fff', borderRadius: 20, marginBottom: 14, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, paddingBottom: 10 },
  artBox:      { width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  artImg:      { width: '100%', height: '100%' },
  cardInfo:    { flex: 1, gap: 3 },
  cardTitle:   { fontSize: 15, fontWeight: '800', color: '#1a1a2e', lineHeight: 22 },
  cardMeta:    { fontSize: 12, color: '#9A9AB0', fontWeight: '500' },
  cardChipRow: { flexDirection: 'row', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  cardChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF4FF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  cardChipText:{ fontSize: 11, fontWeight: '700', color: '#5A7AB0' },
  cardFooter:  { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  footerBtn:   { flex: 1, borderRadius: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  footerBtnText: { fontSize: 11, fontWeight: '800' },



  // ── Full-screen modal ──
  modalScreen:      { flex: 1, backgroundColor: '#F5F7FF' },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  modalBackBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalBackArrow:   { fontSize: 28, color: '#1a1a2e', fontWeight: '300', lineHeight: 34 },
  modalTitle:       { flex: 1, fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  modalSaveBtn:     { backgroundColor: '#4A90E2', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  modalSaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  modalTabBar:      { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  modalTab:         { flex: 1, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  modalTabActive:   { borderBottomColor: '#4A90E2' },
  modalTabText:     { fontSize: 13, fontWeight: '600', color: '#9A9AB0' },
  modalTabTextActive:{ color: '#4A90E2', fontWeight: '800' },

  tabContent: { padding: 16, gap: 16, paddingBottom: 40 },
  fieldGroup: { gap: 8 },
  groupLabel: { fontSize: 10, fontWeight: '800', color: '#9A9AB0', letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 4 },
  fieldCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 10, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { fontSize: 14, color: '#1a1a2e', fontWeight: '500', paddingVertical: 6 },
  fieldDivider:{ height: 1, backgroundColor: '#F0F0F8' },
  selectorRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  selectorVal:{ fontSize: 14, color: '#1a1a2e', fontWeight: '500' },
  selectorPlaceholder:{ fontSize: 14, color: '#B0B8D0' },

  uploadBtn:     { borderRadius: 8, borderWidth: 1, borderColor: '#D6EAFF', backgroundColor: '#F5F9FF', paddingVertical: 10, alignItems: 'center' },
  uploadBtnText: { fontSize: 13, fontWeight: '700', color: '#4A90E2' },
  removeImgBtn:  { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  removeImgBtnText:{ color: '#fff', fontSize: 12, fontWeight: '700' },

  infoBox:     { backgroundColor: '#FFFBEA', borderRadius: 10, padding: 12 },
  infoBoxText: { fontSize: 13, color: '#7A5A00', fontWeight: '500' },

  secGroup:       { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  secGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  secGroupTitle:  { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  addSecBtn:      { backgroundColor: '#D6EAFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  addSecBtnText:  { fontSize: 12, fontWeight: '800', color: '#1A4DA2' },
  secEmptyText:   { fontSize: 13, color: '#B0B8D0', padding: 14, textAlign: 'center' },

  sectionItem:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  dragHandle:         { alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  sectionItemOrder:   { fontSize: 10, fontWeight: '800', color: '#B0B8D0' },
  sectionItemBody:    { flex: 1, gap: 2 },
  sectionItemTitle:   { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  sectionItemMeta:    { fontSize: 11, color: '#9A9AB0' },
  sectionItemActions: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  orderBtn:           { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#F5F7FF' },
  removeBtn:          { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#FFE8E8', marginLeft: 2 },
  removeBtnText:      { fontSize: 11, fontWeight: '800', color: '#FF7043' },

  previewCard:         { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  previewHeader:       { padding: 20, gap: 6 },
  previewTitle:        { fontSize: 20, fontWeight: '900', color: '#fff' },
  previewSub:          { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  previewStatsRow:     { flexDirection: 'row', gap: 20, marginTop: 8 },
  previewStat:         { alignItems: 'center', gap: 2 },
  previewStatVal:      { fontSize: 22, fontWeight: '900', color: '#fff' },
  previewStatLabel:    { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  previewBody:         { padding: 16, gap: 6 },
  previewSectionTitle: { fontSize: 13, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.8 },
  previewItem:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  previewItemDot:      { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewItemTitle:    { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  previewItemMeta:     { fontSize: 11, color: '#9A9AB0', marginTop: 1 },
  previewEmpty:        { alignItems: 'center', paddingVertical: 32, gap: 8 },
  previewEmptyText:    { fontSize: 13, color: '#9A9AB0', textAlign: 'center', lineHeight: 20 },

  pickerOverlay:      { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  pickerSheet:        { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', overflow: 'hidden' },
  pickerHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  pickerTitle:        { fontSize: 16, fontWeight: '900', color: '#1a1a2e' },
  pickerDoneBtn:      { backgroundColor: '#4A90E2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  pickerDoneText:     { color: '#fff', fontWeight: '800', fontSize: 13 },
  pickerSearch:       { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  searchInput:        { backgroundColor: '#F5F7FF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#1a1a2e' },
  quizFilterRow:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterChipBtn:      { borderRadius: 10, backgroundColor: '#F0F0F8', paddingHorizontal: 12, paddingVertical: 9 },
  filterChipActive:   { fontSize: 12, fontWeight: '700', color: '#4A90E2' },
  filterChipPlaceholder:{ fontSize: 12, fontWeight: '600', color: '#9A9AB0' },
  pickerItem:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9FAFF', borderRadius: 12, padding: 12 },
  pickerItemSelected: { backgroundColor: '#D6EAFF', borderWidth: 1, borderColor: '#4A90E2' },
  pickerItemSelectedQuiz:{ backgroundColor: '#F0E6FF', borderWidth: 1, borderColor: '#7C3AED' },
  pickerItemTitle:    { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  pickerItemMeta:     { fontSize: 11, color: '#9A9AB0', marginTop: 1 },
  checkBox:           { width: 20, height: 20, borderWidth: 2, borderColor: '#D0D8F0', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkBoxSelected:   { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  checkBoxSelectedQuiz:{ backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  checkTick:          { color: '#fff', fontSize: 11, fontWeight: '900' },
  flatEmpty:          { fontSize: 13, color: '#B0B8D0', paddingVertical: 16, textAlign: 'center' },
});
