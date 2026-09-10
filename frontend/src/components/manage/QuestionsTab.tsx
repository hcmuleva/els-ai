/**
 * QuestionsTab — revamped to match ContentTab / TopicsTab UI style.
 * - No search text field (filters only)
 * - Filter chips + type chips on separate rows, both horizontally scrollable
 * - Full-screen QuestionDetailsModal
 */
import { useMemo, useState, useRef, useEffect } from 'react';
import LatexText from '../common/LatexText';
import {
  ActivityIndicator, Dimensions, Image, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
  useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  ChevronLeft, ChevronRight, Search, Filter, X,
  Zap, Clock, Eye, Volume2, CheckSquare, SplitSquareHorizontal, ListChecks, Layers, HelpCircle, ClipboardList,
  Play, Pause, Check, Image as ImageIcon, Pencil, Trash2,
} from 'lucide-react-native';
import { Audio } from 'expo-av';
import SelectorModal from '../SelectorModal';
import ConfirmModal from '../common/ConfirmModal';
import PaginationControls from '../common/PaginationControls';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { createOffsetPageFetcher } from '../../utils/paginationFetcher';
import QuestionPreviewModal from '../quiz/QuestionPreviewModal';

import { STANDARD_OPTIONS, getStandardLabel } from '../../constants/standards';
import { getAuthorizedClasses, getAuthorizedSubjects } from '../../utils/assignments';
import { AppUser } from '../../types/roles';
import { API_BASE_URL } from '../../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Types ─────────────────────────────────────────────────────────────────────
export type QuestionItem = {
  id: string;
  quiz_id: string;
  quiz_title: string;
  class_level?: string;
  subject?: string;
  quiz_type: string;
  question_type: string;
  question_title?: string;
  question_instruction?: string;
  question_audio?: string;
  time_limit_seconds: number;
  points: number;
  sort_order?: number;
  question_data?: unknown;   // not included in list response, fetched on demand
  created_at: string;
};

type Filters = { search: string; classLevel: string; subject: string; category: string };
type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;
type QuestionFull = QuestionItem & { question_data: unknown };

// ── Helpers ───────────────────────────────────────────────────────────────────
function resolveUrl(url?: string) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
}

function SafeImage({ uri, style, resizeMode = 'contain' }: { uri: string; style?: any; resizeMode?: any }) {
  const [error, setError] = useState(false);
  
  if (!uri || error) {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F4FB', overflow: 'hidden' }]}>
        <ImageIcon size={24} color="#525C6B" />
      </View>
    );
  }

  return (
    <Image 
      source={{ uri }} 
      style={style} 
      resizeMode={resizeMode} 
      onError={() => setError(true)}
    />
  );
}

type QtypeCfg = { Icon: React.ComponentType<{ size?: number; color?: string }>; label: string; color: string; bg: string };
const QTYPE_CONFIG: Record<string, QtypeCfg> = {
  guess_image:     { Icon: Eye,                  label: 'Guess Image',   color: '#2D5DC9', bg: '#D6EAFF' },
  drag_drop_match: { Icon: SplitSquareHorizontal,label: 'Drag & Drop',   color: '#554E6C', bg: '#EDE4FF' },
  guess_audio:     { Icon: Volume2,              label: 'Guess Audio',   color: '#2F6B2D', bg: '#D6F5D6' },
  true_false:      { Icon: CheckSquare,          label: 'True / False',  color: '#8F680C', bg: '#FFF5CC' },
  // Darkened from #D33F13 (3.96:1 on this bg, short of the 4.5:1 needed at this text size).
  single_choice:   { Icon: Layers,              label: 'Single Choice', color: '#B03A19', bg: '#FFE8D6' },
  multi_choice:    { Icon: ListChecks,          label: 'Multi Choice',  color: '#A81762', bg: '#FFE0F0' },
  logico:          { Icon: ListChecks,          label: 'Logico',        color: '#0f766e', bg: '#DCFCE7' },
  memory_match:    { Icon: Layers,              label: 'Memory Match',  color: '#7C3AED', bg: '#EDE9FE' },
  fill_blank:      { Icon: ClipboardList,       label: 'Fill in Blank', color: '#075985', bg: '#E0F2FE' },
  jigsaw:          { Icon: Layers,              label: 'Jigsaw Puzzle', color: '#0369A1', bg: '#E0F2FE' },
};
function qtypeCfg(t: string): QtypeCfg {
  const normalized = t === 'jigsaw_puzzle' ? 'jigsaw' : t;
  return QTYPE_CONFIG[normalized] ?? { Icon: HelpCircle, label: normalized || 'Question', color: '#525C6B', bg: '#F4F4FB' };
}

const PAGE_SIZE = 10;



const CARD_COLORS = ['#D6EAFF', '#FFE8D6', '#D6F5D6', '#EDE4FF', '#FFF5CC', '#FFE0F0'];
type SubjectCatalogItem = { classLevel: string; title: string; coverImage?: string; iconImage?: string; iconBgColor?: string };



// ── Question Card ─────────────────────────────────────────────────────────────
function QuestionCard({ question, idx, onAction }: {
  question: QuestionItem;
  idx: number;
  onAction: (a: 'view' | 'edit' | 'delete' | 'preview') => void;
}) {
  const cfg = qtypeCfg(question.question_type);

  return (
    <View style={q.card}>
      <View style={q.cardTop}>
        <View style={[q.artBox, { backgroundColor: cfg.bg }]}>
          <cfg.Icon size={22} color={cfg.color} />
        </View>
        <View style={q.cardInfo}>
          <LatexText content={question.question_title || 'Untitled Question'} style={q.cardTitle} compact compactHeight={46} numberOfLines={2} background="transparent" />
          <Text style={q.cardMeta}>
            {question.class_level ? getStandardLabel(question.class_level) : '–'} · {question.subject || '–'}
          </Text>
          <View style={q.cardTagRow}>
            <View style={[q.typeTag, { backgroundColor: cfg.bg, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              <cfg.Icon size={10} color={cfg.color} />
              <Text style={[q.typeTagText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <View style={q.cardChipRow}>
              <Zap size={11} color="#D97706" />
              <Text style={q.cardChip}>{question.points ?? 1} pt{question.points !== 1 ? 's' : ''}</Text>
            </View>
            {question.time_limit_seconds ? (
              <View style={q.cardChipRow}>
                <Clock size={11} color="#64748B" />
                <Text style={q.cardChip}>{question.time_limit_seconds}s</Text>
              </View>
            ) : null}
          </View>
          {question.quiz_title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <ClipboardList size={11} color="#64748B" />
              <Text style={q.quizTag} numberOfLines={1}>{question.quiz_title}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={q.cardFooter}>
        <Pressable style={q.footerBtnPreview} onPress={() => onAction('preview')}>
          <Eye size={13} color="#1D4ED8" />
          <Text style={q.footerBtnTextPreview}>Preview</Text>
        </Pressable>
        <Pressable style={q.footerBtnEdit} onPress={() => onAction('edit')}>
          <Pencil size={13} color="#334155" />
          <Text style={q.footerBtnTextEdit}>Edit</Text>
        </Pressable>
        <Pressable style={q.footerBtnDelete} onPress={() => onAction('delete')}>
          <Trash2 size={13} color="#DC2626" />
          <Text style={q.footerBtnTextDelete}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  enabled?: boolean;
  reloadToken?: number;
  deletingQuestionId: string | null;
  filters: Filters;
  subjectCatalog: SubjectCatalogItem[];
  apiFetch: ApiFetch;
  user: AppUser | null;
  onFiltersChange: (patch: Partial<Filters>) => void;
  onApplyFilters: () => void;
  onOpenCreate: () => void;
  onQuestionAction: (q: QuestionItem, action: 'view' | 'edit' | 'delete') => void;
  message?: { type: 'success' | 'error'; text: string } | null;
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function QuestionsTab({
  enabled, reloadToken, deletingQuestionId, filters, subjectCatalog, apiFetch, user,
  onFiltersChange, onApplyFilters, onOpenCreate, onQuestionAction, message,
}: Props) {
  const { width } = useWindowDimensions();
  const numCols = width >= 768 ? 2 : 1;

  const [classOpen, setClassOpen]         = useState(false);
  const [subjectOpen, setSubjectOpen]     = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionFull | null>(null);
  const [confirmDeleteQuestion, setConfirmDeleteQuestion] = useState<QuestionItem | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  // Debounce the search box into an applied (server-side) search term.
  const [appliedSearch, setAppliedSearch] = useState(filters.search || '');
  useEffect(() => {
    const t = setTimeout(() => setAppliedSearch((filters.search || '').trim()), 350);
    return () => clearTimeout(t);
  }, [filters.search]);

  const cacheKey = useMemo(
    () => `questions|${filters.classLevel}|${filters.subject}|${filters.category}|${appliedSearch}`,
    [filters.classLevel, filters.subject, filters.category, appliedSearch],
  );
  const fetchPage = useMemo(() => {
    const baseQuery = new URLSearchParams();
    if (appliedSearch.trim()) baseQuery.set('search', appliedSearch.trim());
    if (filters.classLevel.trim()) baseQuery.set('class_level', filters.classLevel.trim());
    if (filters.subject.trim()) baseQuery.set('subject', filters.subject.trim());
    if (filters.category.trim()) baseQuery.set('category', filters.category.trim());
    return createOffsetPageFetcher<QuestionItem>({ apiFetch, endpoint: '/questions', dataKey: 'questions', baseQuery });
  }, [apiFetch, appliedSearch, filters.classLevel, filters.subject, filters.category]);

  const pager = usePaginatedResource<QuestionItem>({ cacheKey, pageSize: PAGE_SIZE, fetchPage, enabled, persist: true });
  const loading = pager.loading;

  const firstReloadRef = useRef(true);
  useEffect(() => {
    if (firstReloadRef.current) { firstReloadRef.current = false; return; }
    pager.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  const openPreview = async (q: QuestionItem) => {
    setPreviewQuestion({ ...q, question_data: q.question_data ?? {} } as QuestionFull);
    setFetchingDetails(true);
    try {
      const res = await apiFetch(`/questions/${q.id}`);
      if (res.ok) {
        const payload = await res.json();
        setPreviewQuestion((payload.question || payload) as QuestionFull);
      }
    } catch {
      // keep preview data
    } finally {
      setFetchingDetails(false);
    }
  };

  const classOptions = useMemo(() =>
    getAuthorizedClasses(user, STANDARD_OPTIONS.map((o) => o.value))
      .map((v) => ({ label: getStandardLabel(v), value: v })),
    [user]
  );
  const subjectOptions = useMemo(() => {
    const titles = getAuthorizedSubjects(user, subjectCatalog, (i) => i.classLevel, (i) => i.title, filters.classLevel || undefined);
    const byTitle = new Map<string, { coverImage?: string; iconUrl?: string; iconBgColor?: string }>();
    titles.forEach((title) => {
      const meta = subjectCatalog.find((i) => i.title.trim() === title && (!filters.classLevel || i.classLevel === filters.classLevel || i.classLevel === 'ANY'));
      byTitle.set(title, { coverImage: meta?.coverImage, iconUrl: meta?.iconImage, iconBgColor: meta?.iconBgColor });
    });
    if (filters.subject && !byTitle.has(filters.subject)) byTitle.set(filters.subject, {});
    return Array.from(byTitle.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([title, icon]) => ({ label: title, value: title, coverImage: icon.coverImage, iconUrl: icon.iconUrl, iconBgColor: icon.iconBgColor }));
  }, [filters.classLevel, filters.subject, subjectCatalog, user]);

  const hasFilters = !!(filters.classLevel || filters.subject || filters.category || filters.search);

  return (
    <View style={q.root}>
      {/* Header */}
      <View style={q.pageHeader}>
        <View>
          <Text style={q.pageTitle}>Questions</Text>
          <Text style={q.pageSub}>{pager.totalCount} question{pager.totalCount !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable style={q.createBtn} onPress={onOpenCreate}>
          <Text style={q.createBtnText}>+ New Question</Text>
        </Pressable>
      </View>

      {/* Toast */}
      {message && (
        <View style={[q.toast, message.type === 'success' ? q.toastSuccess : q.toastError]}>
          <Text style={[q.toastText, message.type === 'success' ? q.toastSuccessText : q.toastErrorText]}>{message.text}</Text>
        </View>
      )}

      {/* ── Filters ─── */}
      <View style={q.filterSection}>
        <View style={q.filterLabelRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Filter size={12} color="#525C6B" />
            <Text style={q.filterLabel}>Filters</Text>
          </View>
          {hasFilters && (
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => { onFiltersChange({ classLevel: '', subject: '', category: '', search: '' }); onApplyFilters(); pager.goFirst(); }}>
              <X size={11} color="#DC2626" />
              <Text style={q.clearAllText}>Clear all</Text>
            </Pressable>
          )}
        </View>

        {/* Search bar */}
        <View style={q.searchRow}>
          <Search size={14} color="#525C6B" />
          <TextInput
            value={filters.search}
            onChangeText={(v) => onFiltersChange({ search: v })}
            onSubmitEditing={() => { onApplyFilters(); pager.goFirst(); }}
            returnKeyType="search"
            placeholder="Search questions..."
            placeholderTextColor="#A0A8C0"
            style={q.searchInput}
          />
          {filters.search !== '' && (
            <Pressable onPress={() => { onFiltersChange({ search: '' }); onApplyFilters(); pager.goFirst(); }}>
              <X size={14} color="#525C6B" />
            </Pressable>
          )}
        </View>

        {/* Class + Subject chips — single scrollable row, no wrapping */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={q.filterChipRow}>
          <Pressable
            style={[q.chip, !!filters.classLevel && q.chipActive]}
            onPress={() => setClassOpen(true)}
          >
            <Text style={[q.chipText, !!filters.classLevel && q.chipTextActive]}>
              {filters.classLevel ? getStandardLabel(filters.classLevel) : 'All Classes'}
            </Text>
          </Pressable>
          <Pressable
            style={[q.chip, !!filters.subject && q.chipActive]}
            onPress={() => setSubjectOpen(true)}
          >
            <Text style={[q.chipText, !!filters.subject && q.chipTextActive]}>
              {filters.subject || 'All Subjects'}
            </Text>
          </Pressable>
          {hasFilters && (
            <Pressable
              style={q.clearChip}
              onPress={() => {
                onFiltersChange({ classLevel: '', subject: '', category: '', search: '' });
                onApplyFilters();
                pager.goFirst();
              }}
            >
              <Text style={q.clearChipText}>✕ Clear</Text>
            </Pressable>
          )}
          <Pressable style={q.applyBtn} onPress={onApplyFilters} disabled={loading}>
            {loading ? <ActivityIndicator accessibilityLabel="Loading" size="small" color="#fff" /> : <Text style={q.applyBtnText}>Apply</Text>}
          </Pressable>
        </ScrollView>
      </View>

      {/* ── Question type chips ── */}
      <View style={q.typeSection}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Search size={12} color="#525C6B" />
          <Text style={q.filterLabel}>Question Type</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={q.filterChipRow}>
          {Object.entries(QTYPE_CONFIG).map(([key, cfg]) => {
            const active = filters.category === key;
            return (
              <Pressable
                key={key}
                style={[q.typeChip, active && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                onPress={() => { onFiltersChange({ category: active ? '' : key }); pager.goFirst(); }}
              >
                <cfg.Icon size={13} color={active ? cfg.color : '#525C6B'} />
                <Text style={[q.typeChipText, active && { color: cfg.color, fontWeight: '800' }]}>{cfg.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      <View style={{ flex: 1 }}>
        <FlashList
          key={numCols}
          data={pager.data}
          keyExtractor={(item) => item.id}
          numColumns={numCols}
          contentContainerStyle={q.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={numCols === 2 ? { flex: 1, marginHorizontal: 6 } : undefined}>
              <QuestionCard
                question={item}
                idx={(pager.currentPage - 1) * pager.pageSize + index}
                onAction={async (action) => {
                  if (action === 'view' || action === 'preview') {
                    openPreview(item);
                  } else if (action === 'edit') {
                    setFetchingDetails(true);
                    try {
                      const res = await apiFetch(`/questions/${item.id}`);
                      if (res.ok) {
                        const payload = await res.json();
                        onQuestionAction(payload.question || payload, 'edit');
                      } else {
                        onQuestionAction(item, 'edit');
                      }
                    } catch {
                      onQuestionAction(item, 'edit');
                    } finally {
                      setFetchingDetails(false);
                    }
                  } else if (action === 'delete') {
                    setConfirmDeleteQuestion(item);
                  } else {
                    onQuestionAction(item, action);
                  }
                }}
              />
            </View>
          )}
          ListEmptyComponent={
            loading ? (
              <View style={q.emptyWrap}>
                <ActivityIndicator accessibilityLabel="Loading" size="large" color="#2D5DC9" />
                <Text style={q.loadingText}>Loading questions…</Text>
              </View>
            ) : pager.error ? (
              <View style={q.emptyWrap}>
                <HelpCircle size={48} color="#D0D8F0" />
                <Text style={q.emptyTitle}>Couldn’t load questions</Text>
                <Text style={q.emptySub}>{pager.error}</Text>
                <Pressable style={q.emptyBtn} onPress={pager.retry}>
                  <Text style={q.emptyBtnText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <View style={q.emptyWrap}>
                <HelpCircle size={48} color="#D0D8F0" />
                <Text style={q.emptyTitle}>No questions found</Text>
                <Text style={q.emptySub}>Create your first question or adjust filters.</Text>
                <Pressable style={q.emptyBtn} onPress={onOpenCreate}>
                  <Text style={q.emptyBtnText}>Create Question</Text>
                </Pressable>
              </View>
            )
          }
          ListFooterComponent={
            pager.data.length > 0 ? (
              <PaginationControls
                currentPage={pager.currentPage}
                totalPages={pager.totalPages}
                totalCount={pager.totalCount}
                loading={pager.loading}
                itemLabel="questions"
                onFirst={pager.goFirst}
                onPrev={pager.goPrev}
                onNext={pager.goNext}
                onLast={pager.goLast}
              />
            ) : null
          }
        />
      </View>

      {/* Selector modals */}
      <SelectorModal visible={classOpen}   title="Select Class"   options={classOptions}   selected={filters.classLevel} isSubject={false} anyLabel="All Classes"   onSelect={(v) => { onFiltersChange({ classLevel: v, subject: '' }); pager.goFirst(); }} onClose={() => setClassOpen(false)} />
      <SelectorModal visible={subjectOpen} title="Select Subject" options={subjectOptions} selected={filters.subject}     isSubject={true}  anyLabel="All Subjects" onSelect={(v) => { onFiltersChange({ subject: v }); pager.goFirst(); }}   onClose={() => setSubjectOpen(false)} />

      {/* Fetching details overlay (only when editing directly) */}
      {fetchingDetails && !previewQuestion && (
        <View style={q.fetchingOverlay}>
          <View style={q.fetchingCard}>
            <ActivityIndicator accessibilityLabel="Loading" size="large" color="#2D5DC9" />
            <Text style={q.fetchingText}>Loading question…</Text>
          </View>
        </View>
      )}

      {/* Unified Question Preview Modal */}
      <QuestionPreviewModal
        visible={previewQuestion !== null}
        question={previewQuestion}
        loading={fetchingDetails}
        onClose={() => setPreviewQuestion(null)}
        onEdit={(qItem) => {
          setPreviewQuestion(null);
          onQuestionAction(qItem as QuestionItem, 'edit');
        }}
      />

      <ConfirmModal
        visible={confirmDeleteQuestion !== null}
        title="Delete Question"
        itemName={confirmDeleteQuestion?.question_title || 'Untitled Question'}
        loading={deletingQuestionId === confirmDeleteQuestion?.id}
        onConfirm={async () => {
          if (confirmDeleteQuestion) {
            await onQuestionAction(confirmDeleteQuestion, 'delete');
            setConfirmDeleteQuestion(null);
          }
        }}
        onClose={() => setConfirmDeleteQuestion(null)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const q = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FF' },
  fetchingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.35)', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  fetchingCard:    { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 10 },
  fetchingText:    { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  list: { padding: 16, paddingBottom: 40 },

  pageHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingVertical: 16 },
  pageTitle:     { fontSize: 22, fontWeight: '900', color: '#1a1a2e' },
  pageSub:       { fontSize: 12, color: '#525C6B', fontWeight: '500', marginTop: 2 },
  createBtn:     { backgroundColor: '#2D5DC9', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  toast:            { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  toastSuccess:     { backgroundColor: '#D6F5D6', borderWidth: 1, borderColor: '#7DC67A' },
  toastError:       { backgroundColor: '#FFE8E8', borderWidth: 1, borderColor: '#D33F13' },
  toastText:        { fontSize: 13, fontWeight: '600' },
  toastSuccessText: { color: '#1A6B1A' },
  toastErrorText:   { color: '#B91C1C' },

  filterSection:   { paddingHorizontal: 16, marginBottom: 6 },
  filterLabelRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  filterLabel:     { fontSize: 11, fontWeight: '800', color: '#525C6B', letterSpacing: 0.8, textTransform: 'uppercase' },
  clearAllText:    { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  filterChipRow:   { gap: 8, paddingBottom: 2 },

  typeSection:  { paddingHorizontal: 16, marginBottom: 10, gap: 8 },

  chip:           { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8ECF4' },
  chipActive:     { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
  chipText:       { fontSize: 12, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#1D4ED8', fontWeight: '700' },
  applyBtn:       { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#2D5DC9' },
  applyBtnText:   { fontSize: 12, fontWeight: '700', color: '#fff' },
  clearChip:      { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA', justifyContent: 'center', alignItems: 'center' },
  clearChipText:  { fontSize: 12, fontWeight: '700', color: '#B71C1C' },

  typeChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8ECF4' },
  typeChipText:  { fontSize: 12, fontWeight: '600', color: '#64748B' },

  searchRow:           { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8ECF4', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 },
  searchInput:         { flex: 1, fontSize: 13, color: '#1a1a2e', paddingVertical: 0 },
  paginationBar:       { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F0F4FF', marginTop: 4, alignItems: 'center', gap: 10 },
  paginationButtonsRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, width: '100%' },
  pageBtn:             { minWidth: 86, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#DCE9FF' },
  pageBtnDisabled:     { backgroundColor: '#F2F5FB', borderColor: '#E3E8F4' },
  pageBtnText:         { fontSize: 13, fontWeight: '700', color: '#2B6FD5' },
  pageBtnTextDisabled: { color: '#9BAAC2' },
  pageIndicator:       { fontSize: 14, fontWeight: '700', color: '#4B5B78', textAlign: 'center' },

  emptyWrap:   { alignItems: 'center', paddingVertical: 60, gap: 8 },
  loadingText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  emptyTitle:  { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptySub:    { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  emptyBtn:    { marginTop: 8, backgroundColor: '#2D5DC9', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:{ color: '#fff', fontWeight: '800', fontSize: 14 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    paddingBottom: 12,
  },
  artBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
  },
  cardMeta: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  cardTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  typeTag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardChip: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  quizTag: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerBtnPreview: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 8,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  footerBtnTextPreview: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  footerBtnEdit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 8,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  footerBtnTextEdit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  footerBtnDelete: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 8,
    paddingVertical: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  footerBtnTextDelete: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
});
