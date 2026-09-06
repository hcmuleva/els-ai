import { useCallback, useEffect, useMemo, useState } from 'react';
import LatexText from '../common/LatexText';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Layers,
  ListChecks,
  Minus,
  Plus,
  RotateCw,
  Search,
  Trash2,
  X,
  Zap,
} from 'lucide-react-native';

import { STANDARD_OPTIONS, getStandardLabel } from '../../constants/standards';
import { getAuthorizedClasses, getAuthorizedSubjects } from '../../utils/assignments';
import { AppUser } from '../../types/roles';
import SelectorModal from '../SelectorModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import SafeImage from './SafeImage';
import { resolveMediaUrl } from '../../utils/media';

type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;
type Tab = 'setup' | 'questions';
type Difficulty = 'Easy' | 'Medium' | 'Hard';
type SelectorField = 'classLevel' | 'subject' | 'bankClassLevel' | 'bankSubject' | 'bankType' | null;

type QuizQuestion = {
  id: string;
  question_type: string;
  question_title?: string;
  question_instruction?: string;
  points: number;
  time_limit_seconds: number;
  question_data?: unknown;
  class_level?: string;
  subject?: string;
};

type QuestionBankItem = {
  id: string;
  quiz_id: string;
  quiz_title: string;
  class_level?: string;
  subject?: string;
  question_type: string;
  question_title?: string;
  question_instruction?: string;
  points: number;
  time_limit_seconds: number;
  question_data?: unknown;
};

export type QuizEditorModalProps = {
  visible: boolean;
  quizId: string | null;
  apiFetch?: ApiFetch;
  onClose: () => void;
  onUpdated?: () => void;
  user?: AppUser | null;
};

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

const QUIZ_TYPE_LABELS: Record<string, string> = {
  drag_drop_match: 'Drag & Drop',
  guess_image: 'Guess Image',
  guess_audio: 'Guess Audio',
  true_false: 'True / False',
  single_choice: 'Single Choice',
  multi_choice: 'Multi Choice',
  logico: 'Logico',
  memory_match: 'Memory Match',
  fill_blank: 'Fill in Blank',
  jigsaw: 'Jigsaw Puzzle',
};

const QUESTION_TYPE_OPTIONS = [
  { label: 'All Question Types', value: '' },
  { label: 'Single Choice', value: 'single_choice' },
  { label: 'Multi Choice', value: 'multi_choice' },
  { label: 'True / False', value: 'true_false' },
  { label: 'Drag & Drop', value: 'drag_drop_match' },
  { label: 'Guess Image', value: 'guess_image' },
  { label: 'Guess Audio', value: 'guess_audio' },
  { label: 'Logico', value: 'logico' },
  { label: 'Memory Match', value: 'memory_match' },
  { label: 'Fill in Blank', value: 'fill_blank' },
  { label: 'Jigsaw Puzzle', value: 'jigsaw' },
];

function normalizeQuestionType(type: string): string {
  if (type === 'drag_drop' || type === 'drag_drop_match') return 'drag_drop_match';
  if (type === 'image_select' || type === 'guess_image') return 'guess_image';
  if (type === 'sound_match' || type === 'guess_audio') return 'guess_audio';
  if (type === 'memory_game' || type === 'multi_choice') return 'multi_choice';
  if (type === 'true_false') return 'true_false';
  if (type === 'single_choice') return 'single_choice';
  if (type === 'logico') return 'logico';
  if (type === 'memory_match') return 'memory_match';
  if (type === 'fill_blank' || type === 'fill_in_blank') return 'fill_blank';
  if (type === 'jigsaw' || type === 'jigsaw_puzzle') return 'jigsaw';
  return type;
}

export default function QuizEditorModal({
  visible,
  quizId,
  apiFetch: apiFetchProp,
  onClose,
  onUpdated,
  user: userProp,
}: QuizEditorModalProps) {
  const { user: authUser, apiFetch: authApiFetch } = useAuth();
  const apiFetch = apiFetchProp || authApiFetch;
  const user = userProp || authUser;
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [tab, setTab] = useState<Tab>('setup');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Easy');
  const [isPublished, setIsPublished] = useState(false);

  const [attached, setAttached] = useState<QuizQuestion[]>([]);
  const [bank, setBank] = useState<QuestionBankItem[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [bankClassFilter, setBankClassFilter] = useState('');
  const [bankSubjectFilter, setBankSubjectFilter] = useState('');
  const [bankTypeFilter, setBankTypeFilter] = useState('');
  const [loadingBank, setLoadingBank] = useState(false);
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null);
  const [selectorField, setSelectorField] = useState<SelectorField>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [subjectOpts, setSubjectOpts] = useState<{ label: string; value: string }[]>([]);
  const [bankPage, setBankPage] = useState(0);

  const [previewQuestion, setPreviewQuestion] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const insets = useSafeAreaInsets();
  const PAGE_SIZE = 10;

  const handleOpenPreview = async (q: any) => {
    setPreviewQuestion(q);
    if (!q.question_data) {
      setLoadingPreview(true);
      try {
        const res = await apiFetch(`/questions/${q.id}`);
        if (res.ok) {
          const payload = await res.json();
          const fetched = payload.question || payload;
          setPreviewQuestion((prev: any) =>
            prev?.id === q.id
              ? { ...prev, ...fetched, question_data: fetched.question_data ?? fetched.questionData }
              : prev
          );
        }
      } catch { /* ignore */ }
      finally {
        setLoadingPreview(false);
      }
    }
  };

  const loadQuiz = useCallback(async () => {
    if (!quizId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/quizzes/${quizId}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to load quiz');
      const data = await res.json();
      setTitle(data.title || '');
      setDescription(data.description || '');
      setClassLevel(data.class_level || '');
      setSubject(data.subject || '');
      setDifficulty(((data.difficulty_level as Difficulty) || 'Easy'));
      setIsPublished(Boolean(data.is_published));
      setAttached(Array.isArray(data.questions) ? data.questions : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, quizId]);

  const loadBank = useCallback(async () => {
    setLoadingBank(true);
    try {
      const merged: QuestionBankItem[] = [];
      let offset = 0;
      let guard = 0;
      while (guard < 1000) {
        const query = new URLSearchParams();
        query.set('limit', '200');
        query.set('offset', String(offset));
        if (classLevel.trim()) query.set('class_level', classLevel.trim());
        if (subject.trim()) query.set('subject', subject.trim());
        const res = await apiFetch(`/question-bank?${query.toString()}`);
        if (!res.ok) break;
        const payload = await res.json();
        const rows = Array.isArray(payload.questions) ? payload.questions : [];
        merged.push(...rows);
        if (rows.length === 0) break;
        const total = Number(payload.total ?? NaN);
        if (Number.isFinite(total)) {
          if (merged.length >= total) break;
        } else if (rows.length < 200) {
          break;
        }
        offset += rows.length;
        guard += 1;
      }
      setBank(merged);
    } catch { /* ignore */ }
    finally {
      setLoadingBank(false);
    }
  }, [apiFetch, classLevel, subject]);

  const loadSubjects = useCallback(async () => {
    try {
      const res = await apiFetch('/content/subjects');
      if (!res.ok) return;
      const payload = await res.json();
      const items = Array.isArray(payload.subjects) ? payload.subjects : [];
      const seen = new Set<string>();
      const out: { label: string; value: string }[] = [];
      items.forEach((it: any) => {
        const t = String(it.title || it.subject || '').trim();
        if (!t || seen.has(t)) return;
        seen.add(t);
        out.push({ label: t, value: t });
      });
      setSubjectOpts(out.sort((a, b) => a.label.localeCompare(b.label)));
    } catch { /* ignore */ }
  }, [apiFetch]);

  useEffect(() => {
    if (!visible) return;
    setTab('setup');
    setError(null);
    setToast(null);
    setBankSearch('');
    if (quizId) {
      loadQuiz();
      loadSubjects();
    }
  }, [visible, quizId, loadQuiz, loadSubjects]);

  useEffect(() => {
    if (!visible || !quizId) return;
    loadBank();
  }, [visible, quizId, loadBank]);

  const attachedIds = useMemo(() => new Set(attached.map((q) => q.id)), [attached]);

  const hasBankFilters = !!(bankClassFilter || bankSubjectFilter || bankTypeFilter);

  const filteredBank = useMemo(() => {
    const keyword = bankSearch.trim().toLowerCase();
    
    const attachedSignatures = new Set(
      attached.map((a) => `${a.question_type}|${(a.question_title || '').trim().toLowerCase()}`)
    );
    const seenSigs = new Set<string>();

    return bank.filter((q) => {
      const sig = `${q.question_type}|${(q.question_title || '').trim().toLowerCase()}`;
      if (seenSigs.has(sig)) return false;
      seenSigs.add(sig);

      if (attachedIds.has(q.id)) return false;
      if (attachedSignatures.has(sig)) return false;

      if (bankClassFilter && q.class_level !== bankClassFilter) return false;
      if (bankSubjectFilter && q.subject !== bankSubjectFilter) return false;
      if (bankTypeFilter && normalizeQuestionType(q.question_type) !== normalizeQuestionType(bankTypeFilter)) return false;

      if (!keyword) return true;
      return [q.question_title, q.quiz_title, q.question_instruction, q.question_type, q.class_level, q.subject]
        .filter(Boolean).join(' ').toLowerCase().includes(keyword);
    });
  }, [bank, bankSearch, bankClassFilter, bankSubjectFilter, bankTypeFilter, attachedIds, attached]);

  useEffect(() => { setBankPage(0); }, [bankSearch, bankClassFilter, bankSubjectFilter, bankTypeFilter]);

  const handleSave = async () => {
    if (!quizId) return;
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/quizzes/${quizId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: title.trim() || undefined,
          description: description.trim() || null,
          classLevel: classLevel || null,
          subject: subject || null,
          difficultyLevel: difficulty,
          isPublished,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to update quiz');
      setToast('Quiz updated successfully.');
      setTimeout(() => setToast(null), 3000);
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update quiz');
    } finally {
      setSaving(false);
    }
  };

  const handleAttach = async (sourceQuestionId: string) => {
    if (!quizId) return;
    const bankItem = bank.find((q) => q.id === sourceQuestionId);
    setBusyQuestionId(sourceQuestionId);
    setError(null);
    try {
      const res = await apiFetch(`/quizzes/${quizId}/questions/reuse`, {
        method: 'POST',
        body: JSON.stringify({
          sourceQuestionId,
          question_type: bankItem?.question_type,
          question_title: bankItem?.question_title,
          question_instruction: bankItem?.question_instruction,
          points: bankItem?.points || 10,
          time_limit_seconds: bankItem?.time_limit_seconds || 30,
          question_data: bankItem?.question_data,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to attach question');
      const created = await res.json();
      setAttached((prev) => [...prev, {
        id: created.id,
        question_type: created.question_type,
        question_title: created.question_title,
        question_instruction: created.question_instruction,
        points: Number(created.points) || 10,
        time_limit_seconds: created.time_limit_seconds || 30,
        class_level: created.class_level || classLevel,
        subject: created.subject || subject,
      }]);
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to attach question');
    } finally {
      setBusyQuestionId(null);
    }
  };

  const handleDetach = async (attachedId: string) => {
    if (!quizId) return;
    setBusyQuestionId(attachedId);
    setError(null);
    try {
      const res = await apiFetch(`/quizzes/${quizId}/questions/${attachedId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to detach question');
      setAttached((prev) => prev.filter((q) => q.id !== attachedId));
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to detach question');
    } finally {
      setBusyQuestionId(null);
    }
  };

  const classOptions = useMemo(() =>
    getAuthorizedClasses(user, STANDARD_OPTIONS.map((o) => o.value))
      .map((v) => ({ label: getStandardLabel(v), value: v })),
    [user]
  );
  const authorizedSubjectOpts = useMemo(() => {
    return subjectOpts.filter((opt) => {
      const catalog = subjectOpts.map(o => ({ classLevel: classLevel || '', title: o.value }));
      const allowed = getAuthorizedSubjects(user, catalog, (i) => i.classLevel, (i) => i.title, classLevel || undefined);
      return allowed.includes(opt.value);
    });
  }, [subjectOpts, classLevel, user]);

  const renderSetupCard = () => (
    <View style={s.card}>
      <Text style={s.cardTitle}>1. Basic Info</Text>
      <ScrollView style={s.innerScrollList} contentContainerStyle={{ gap: 12 }}>
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Title *</Text>
          <TextInput value={title} onChangeText={setTitle} style={s.input} placeholderTextColor="#A0A8C0" />
        </View>
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
            placeholderTextColor="#A0A8C0"
          />
        </View>

        <Text style={[s.cardTitle, { marginTop: 8 }]}>2. Class Settings</Text>
        <View style={s.row}>
          <View style={[s.fieldGroup, { flex: 1 }]}>
            <Text style={s.fieldLabel}>Standard</Text>
            <Pressable style={s.dropdownField} onPress={() => setSelectorField('classLevel')}>
              <Text style={classLevel ? s.dropdownText : s.dropdownPlaceholder}>
                {classLevel ? getStandardLabel(classLevel) : 'Select Standard'}
              </Text>
              <ChevronDown size={14} color="#525C6B" />
            </Pressable>
          </View>
          <View style={[s.fieldGroup, { flex: 1 }]}>
            <Text style={s.fieldLabel}>Subject</Text>
            <Pressable style={s.dropdownField} onPress={() => setSelectorField('subject')}>
              <Text style={subject ? s.dropdownText : s.dropdownPlaceholder}>
                {subject || 'Select Subject'}
              </Text>
              <ChevronDown size={14} color="#525C6B" />
            </Pressable>
          </View>
        </View>
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Difficulty</Text>
          <View style={s.chipsRow}>
            {DIFFICULTIES.map((d) => (
              <Pressable
                key={d}
                style={[s.diffChip, difficulty === d && s.diffChipActive]}
                onPress={() => setDifficulty(d)}
              >
                <Text style={[s.diffChipText, difficulty === d && s.diffChipTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable style={s.toggleRow} onPress={() => setIsPublished((v) => !v)}>
          <View style={[s.checkbox, isPublished && s.checkboxChecked]}>
            {isPublished && <CheckCircle2 size={14} color="#fff" />}
          </View>
          <Text style={s.toggleLabel}>Published (visible to students)</Text>
        </Pressable>
      </ScrollView>

      <Pressable style={[s.submitSaveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving || loading}>
        {saving ? <ActivityIndicator accessibilityLabel="Loading" size="small" color="#fff" /> : <Text style={s.submitSaveText}>Save Quiz Settings</Text>}
      </Pressable>
    </View>
  );

  const renderAttachedCard = () => (
    <View style={s.card}>
      <View style={s.cardHeaderRow}>
        <Text style={s.cardTitle}>1. Attached Questions ({attached.length})</Text>
        <Text style={s.totalPtsText}>
          Total: {attached.reduce((sum, q) => sum + (q.points || 10), 0)} pts
        </Text>
      </View>
      {attached.length === 0 ? (
        <Text style={s.emptyText}>No questions attached. Pick from the bank on the right.</Text>
      ) : (
        <ScrollView style={s.innerScrollList} contentContainerStyle={{ gap: 8 }}>
          {attached.map((q) => {
            const typeLabel = QUIZ_TYPE_LABELS[normalizeQuestionType(q.question_type)] || q.question_type;
            return (
              <View key={q.id} style={s.qRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <LatexText
                    content={q.question_title || 'Untitled'}
                    style={s.qTitle}
                    compact
                    compactHeight={40}
                    numberOfLines={2}
                    background="transparent"
                  />
                  <View style={s.qBadgeRow}>
                    {q.class_level && (
                      <View style={s.qBadge}><Text style={s.qBadgeText}>{getStandardLabel(q.class_level)}</Text></View>
                    )}
                    <View style={s.qBadge}><Text style={s.qBadgeText}>{typeLabel}</Text></View>
                    <View style={s.qBadge}><Zap size={10} color="#E6A817" fill="#E6A817" /><Text style={s.qBadgeText}>{q.points || 10} pts</Text></View>
                  </View>
                </View>
                <Pressable style={s.qPreviewIconBtn} onPress={() => handleOpenPreview(q)}>
                  <Eye size={14} color="#2D5DC9" />
                </Pressable>
                <Pressable
                  style={s.removeBtn}
                  onPress={() => handleDetach(q.id)}
                  disabled={busyQuestionId === q.id}
                >
                  {busyQuestionId === q.id
                    ? <ActivityIndicator accessibilityLabel="Loading" size="small" color="#dc2626" />
                    : <Trash2 size={16} color="#dc2626" />}
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  const renderBankCard = () => (
    <View style={s.card}>
      <View style={s.cardHeaderRow}>
        <Text style={s.cardTitle}>2. Question Bank Selection</Text>
        <Pressable style={s.refreshBtn} onPress={loadBank} disabled={loadingBank}>
          {loadingBank ? <ActivityIndicator accessibilityLabel="Loading" size="small" color="#2D5DC9" /> : <RotateCw size={14} color="#2D5DC9" />}
        </Pressable>
      </View>

      {/* Filter Row: Class, Subject, Type, Clear */}
      <View style={s.bankFiltersRow}>
        <Pressable style={s.selectInputCompact} onPress={() => setSelectorField('bankClassLevel')}>
          <Text style={bankClassFilter ? s.selectTextCompact : s.selectPlaceholderCompact} numberOfLines={1}>
            {bankClassFilter ? getStandardLabel(bankClassFilter) : 'Class Level'}
          </Text>
          <ChevronDown size={13} color="#525C6B" />
        </Pressable>

        <Pressable style={s.selectInputCompact} onPress={() => setSelectorField('bankSubject')}>
          <Text style={bankSubjectFilter ? s.selectTextCompact : s.selectPlaceholderCompact} numberOfLines={1}>
            {bankSubjectFilter || 'Subject'}
          </Text>
          <ChevronDown size={13} color="#525C6B" />
        </Pressable>

        <Pressable style={s.selectInputCompact} onPress={() => setSelectorField('bankType')}>
          <Text style={bankTypeFilter ? s.selectTextCompact : s.selectPlaceholderCompact} numberOfLines={1}>
            {bankTypeFilter ? (QUIZ_TYPE_LABELS[normalizeQuestionType(bankTypeFilter)] || bankTypeFilter) : 'Question Type'}
          </Text>
          <ChevronDown size={13} color="#525C6B" />
        </Pressable>

        {hasBankFilters && (
          <Pressable style={s.clearBtnCompact} onPress={() => { setBankClassFilter(''); setBankSubjectFilter(''); setBankTypeFilter(''); }}>
            <X size={13} color="#DC2626" />
          </Pressable>
        )}
      </View>

      <View style={s.searchRow}>
        <Search size={14} color="#525C6B" />
        <TextInput
          value={bankSearch}
          onChangeText={setBankSearch}
          placeholder="Search questions..."
          style={s.searchInput}
          placeholderTextColor="#A0A8C0"
        />
        {bankSearch !== '' && (
          <Pressable onPress={() => setBankSearch('')}><X size={14} color="#525C6B" /></Pressable>
        )}
      </View>
      {filteredBank.length === 0 ? (
        <Text style={s.emptyText}>No questions match the filter.</Text>
      ) : (() => {
        const bTotalPages = Math.max(1, Math.ceil(filteredBank.length / PAGE_SIZE));
        const bPaged = filteredBank.slice(bankPage * PAGE_SIZE, (bankPage + 1) * PAGE_SIZE);
        return (<>
          <ScrollView style={s.innerScrollList} contentContainerStyle={{ gap: 8 }}>
            {bPaged.map((q) => {
              const typeLabel = QUIZ_TYPE_LABELS[normalizeQuestionType(q.question_type)] || q.question_type;
              return (
                <View key={q.id} style={s.qRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <LatexText
                      content={q.question_title || 'Untitled'}
                      style={s.qTitle}
                      compact
                      compactHeight={40}
                      numberOfLines={2}
                      background="transparent"
                    />
                    <View style={s.qBadgeRow}>
                      {q.class_level && (
                        <View style={[s.qBadge, s.qClassBadge]}>
                          <Text style={[s.qBadgeText, s.qClassBadgeText]}>{getStandardLabel(q.class_level)}</Text>
                        </View>
                      )}
                      <View style={s.qBadge}><Text style={s.qBadgeText}>{typeLabel}</Text></View>
                      {q.subject ? <View style={s.qBadge}><Text style={s.qBadgeText}>{q.subject}</Text></View> : null}
                      <View style={s.qBadge}><Zap size={10} color="#E6A817" fill="#E6A817" /><Text style={s.qBadgeText}>{q.points || 10} pts</Text></View>
                    </View>
                  </View>
                  <Pressable style={s.qPreviewIconBtn} onPress={() => handleOpenPreview(q)}>
                    <Eye size={14} color="#2D5DC9" />
                  </Pressable>
                  <Pressable
                    style={s.attachBtn}
                    onPress={() => handleAttach(q.id)}
                    disabled={busyQuestionId === q.id}
                  >
                    {busyQuestionId === q.id
                      ? <ActivityIndicator accessibilityLabel="Loading" size="small" color="#16a34a" />
                      : <><Plus size={13} color="#16a34a" /><Text style={s.attachBtnText}>Add</Text></>}
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
          {filteredBank.length > PAGE_SIZE && (
            <View style={s.paginationBar}>
              <Pressable
                style={[s.pageBtn, bankPage === 0 && s.pageBtnDisabled]}
                onPress={() => setBankPage((p) => Math.max(0, p - 1))}
                disabled={bankPage === 0}
              >
                <ChevronLeft size={16} color={bankPage === 0 ? '#C0C8D8' : '#2D5DC9'} />
                <Text style={[s.pageBtnText, bankPage === 0 && s.pageBtnTextDisabled]}>Prev</Text>
              </Pressable>
              <Text style={s.pageIndicator}>Page {bankPage + 1} / {bTotalPages}</Text>
              <Pressable
                style={[s.pageBtn, bankPage >= bTotalPages - 1 && s.pageBtnDisabled]}
                onPress={() => setBankPage((p) => Math.min(bTotalPages - 1, p + 1))}
                disabled={bankPage >= bTotalPages - 1}
              >
                <Text style={[s.pageBtnText, bankPage >= bTotalPages - 1 && s.pageBtnTextDisabled]}>Next</Text>
                <ChevronRight size={16} color={bankPage >= bTotalPages - 1 ? '#C0C8D8' : '#2D5DC9'} />
              </Pressable>
            </View>
          )}
        </>);
      })()}
    </View>
  );

  const renderPreviewContent = () => (
    <View style={s.card}>
      <Text style={s.cardTitle}>2. Quiz Overview</Text>
      <ScrollView style={s.innerScrollList} contentContainerStyle={{ gap: 10 }}>
        {description ? <Text style={s.previewBody}>{description}</Text> : null}
        <View style={s.qBadgeRow}>
          <View style={s.qBadge}><Text style={s.qBadgeText}>{classLevel ? getStandardLabel(classLevel) : 'No class'}</Text></View>
          {subject ? <View style={s.qBadge}><Text style={s.qBadgeText}>{subject}</Text></View> : null}
          <View style={s.qBadge}><Text style={s.qBadgeText}>{difficulty}</Text></View>
          <View style={s.qBadge}><Text style={s.qBadgeText}>{isPublished ? 'Published' : 'Draft'}</Text></View>
        </View>

        <Text style={[s.cardTitle, { marginTop: 12 }]}>Questions Summary ({attached.length})</Text>
        {attached.length === 0 ? (
          <Text style={s.emptyText}>No questions attached yet.</Text>
        ) : (
          attached.map((q, i) => (
            <View key={q.id} style={s.previewItem}>
              <Text style={s.previewItemNum}>{i + 1}.</Text>
              <LatexText
                content={q.question_title || 'Untitled'}
                style={s.previewItemTitle}
                compact
                compactHeight={36}
                numberOfLines={1}
                background="transparent"
              />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={s.screen}>
        <View style={[s.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <Pressable onPress={onClose} style={s.backBtn}>
            <ChevronLeft size={24} color="#1a1a2e" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>Edit Quiz</Text>
            <Text style={s.headerSub} numberOfLines={1}>{title || 'Untitled'}</Text>
          </View>
          <Pressable style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving || loading}>
            {saving ? <ActivityIndicator accessibilityLabel="Loading" size="small" color="#fff" /> : <Text style={s.saveBtnText}>Save</Text>}
          </Pressable>
        </View>

        {toast && <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>}
        {error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}

        {/* 2-Tab Navigation Bar */}
        <View style={s.tabBar}>
          <Pressable style={[s.tab, tab === 'setup' && s.tabActive]} onPress={() => setTab('setup')}>
            <Text style={[s.tabText, tab === 'setup' && s.tabTextActive]}>Basic Info & Setup</Text>
          </Pressable>
          <Pressable style={[s.tab, tab === 'questions' && s.tabActive]} onPress={() => setTab('questions')}>
            <Text style={[s.tabText, tab === 'questions' && s.tabTextActive]}>
              Questions & Bank ({attached.length})
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={s.centerWrap}><ActivityIndicator accessibilityLabel="Loading" size="large" color="#2D5DC9" /></View>
        ) : isDesktop ? (
          /* Desktop Symmetrical 2-Column Fixed Card View */
          <View style={s.desktopLayout}>
            {tab === 'setup' ? (
              <>
                <View style={s.desktopLeftCol}>
                  {renderSetupCard()}
                </View>
                <View style={s.desktopRightCol}>
                  {renderPreviewContent()}
                </View>
              </>
            ) : (
              <>
                <View style={s.desktopLeftCol}>
                  {renderAttachedCard()}
                </View>
                <View style={s.desktopRightCol}>
                  {renderBankCard()}
                </View>
              </>
            )}
          </View>
        ) : (
          /* Mobile View */
          <View style={{ flex: 1, padding: 12 }}>
            {tab === 'setup' && (
              <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
                {renderSetupCard()}
                {renderPreviewContent()}
              </ScrollView>
            )}
            {tab === 'questions' && (
              <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
                {renderAttachedCard()}
                {renderBankCard()}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {/* Selectors */}
      <SelectorModal
        visible={selectorField === 'classLevel'}
        title="Select Standard"
        options={classOptions}
        selected={classLevel}
        onSelect={(v) => { setClassLevel(v); setSelectorField(null); }}
        onClose={() => setSelectorField(null)}
      />
      <SelectorModal
        visible={selectorField === 'subject'}
        title="Select Subject"
        options={authorizedSubjectOpts}
        selected={subject}
        onSelect={(v) => { setSubject(v); setSelectorField(null); }}
        onClose={() => setSelectorField(null)}
      />
      <SelectorModal
        visible={selectorField === 'bankClassLevel'}
        title="Filter by Class / Standard"
        options={[{ label: 'All Classes', value: '' }, ...classOptions]}
        selected={bankClassFilter}
        onSelect={(v) => { setBankClassFilter(v); setSelectorField(null); }}
        onClose={() => setSelectorField(null)}
      />
      <SelectorModal
        visible={selectorField === 'bankSubject'}
        title="Filter by Subject"
        options={[{ label: 'All Subjects', value: '' }, ...subjectOpts]}
        selected={bankSubjectFilter}
        onSelect={(v) => { setBankSubjectFilter(v); setSelectorField(null); }}
        onClose={() => setSelectorField(null)}
      />
      <SelectorModal
        visible={selectorField === 'bankType'}
        title="Filter by Question Type"
        options={QUESTION_TYPE_OPTIONS}
        selected={bankTypeFilter}
        onSelect={(v) => { setBankTypeFilter(v); setSelectorField(null); }}
        onClose={() => setSelectorField(null)}
      />

      {/* Question Preview Modal */}
      <Modal
        visible={previewQuestion !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewQuestion(null)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.pvModalCard, isDesktop && { width: 620 }]}>
            <View style={s.pvModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={s.pvHeaderIconWrap}>
                  <Eye size={18} color="#2D5DC9" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.pvModalTitle}>Question Preview</Text>
                  {previewQuestion?.quiz_title ? (
                    <Text style={s.pvModalSubtitle} numberOfLines={1}>
                      Source: {previewQuestion.quiz_title}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Pressable onPress={() => setPreviewQuestion(null)} style={s.pvModalCloseBtn}>
                <X size={18} color="#4B5768" />
              </Pressable>
            </View>

            <ScrollView style={s.pvModalScroll} contentContainerStyle={s.pvModalContent}>
              {loadingPreview && (
                <View style={s.pvLoadingRow}>
                  <ActivityIndicator accessibilityLabel="Loading" size="small" color="#2D5DC9" />
                  <Text style={s.pvLoadingText}>Loading complete details...</Text>
                </View>
              )}

              <LatexText
                content={previewQuestion?.question_title || 'Untitled Question'}
                style={s.pvQuestionTitle}
                background="transparent"
              />

              <View style={s.pvBadgeRow}>
                {previewQuestion?.class_level ? (
                  <View style={s.qBadge}>
                    <Text style={s.qBadgeText}>{getStandardLabel(previewQuestion.class_level)}</Text>
                  </View>
                ) : null}
                {previewQuestion?.subject ? (
                  <View style={s.qBadge}>
                    <Text style={s.qBadgeText}>{previewQuestion.subject}</Text>
                  </View>
                ) : null}
                <View style={s.pvTypeChip}>
                  <Text style={s.pvTypeChipText}>
                    {QUIZ_TYPE_LABELS[normalizeQuestionType(previewQuestion?.question_type || '')] || previewQuestion?.question_type}
                  </Text>
                </View>
              </View>

              <View style={s.pvStatBar}>
                <View style={s.pvStatItem}>
                  <Zap size={13} color="#E6A817" fill="#E6A817" />
                  <Text style={s.pvStatText}>{previewQuestion?.points ?? 10} points</Text>
                </View>
                <View style={s.pvStatItem}>
                  <Clock size={13} color="#4B5768" />
                  <Text style={s.pvStatText}>{previewQuestion?.time_limit_seconds ?? 30}s limit</Text>
                </View>
              </View>

              {previewQuestion?.question_instruction ? (
                <View style={s.pvInstructionBox}>
                  <Text style={s.pvInstructionLabel}>Instruction</Text>
                  <Text style={s.pvInstructionText}>{previewQuestion.question_instruction}</Text>
                </View>
              ) : null}

              {/* Media & Options */}
              {(() => {
                const qData = (previewQuestion?.question_data as Record<string, unknown> | null | undefined) ?? {};
                const promptImg = resolveMediaUrl((qData.prompt_image as string) || (qData.image as string));
                const options = Array.isArray(qData.options) ? qData.options : [];
                const pairs = Array.isArray(qData.pairs)
                  ? qData.pairs
                  : Array.isArray(qData.match_pairs)
                  ? qData.match_pairs
                  : [];
                const explanation = (qData.explanation as string) || '';

                return (
                  <>
                    {promptImg ? (
                      <View style={s.pvSection}>
                        <Text style={s.pvSectionLabel}>Prompt Image</Text>
                        <SafeImage uri={promptImg} style={s.pvPromptImage} resizeMode="contain" />
                      </View>
                    ) : null}

                    {options.length > 0 && (
                      <View style={s.pvSection}>
                        <Text style={s.pvSectionLabel}>Options ({options.length})</Text>
                        <View style={s.pvOptionsList}>
                          {options.map((opt: any, idx: number) => {
                            const isCorrect = !!(opt.is_correct || opt.correct || opt.isCorrect);
                            const optText = opt.text || opt.label || opt.option_text || (typeof opt === 'string' ? opt : `Option ${idx + 1}`);
                            const optImg = resolveMediaUrl(typeof opt === 'object' ? opt?.image : undefined);
                            return (
                              <View key={idx} style={[s.pvOptionCard, isCorrect && s.pvOptionCardCorrect]}>
                                <View style={[s.pvOptionDot, isCorrect && s.pvOptionDotCorrect]}>
                                  <Text style={[s.pvOptionDotText, isCorrect && s.pvOptionDotTextCorrect]}>
                                    {String.fromCharCode(65 + idx)}
                                  </Text>
                                </View>
                                <View style={{ flex: 1, gap: 4 }}>
                                  {optText ? <Text style={s.pvOptionText}>{optText}</Text> : null}
                                  {optImg ? (
                                    <SafeImage uri={optImg} style={s.pvOptionImg} resizeMode="contain" />
                                  ) : null}
                                </View>
                                {isCorrect && (
                                  <View style={s.pvCorrectBadge}>
                                    <CheckCircle2 size={12} color="#16a34a" />
                                    <Text style={s.pvCorrectBadgeText}>Correct</Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {pairs.length > 0 && (
                      <View style={s.pvSection}>
                        <Text style={s.pvSectionLabel}>Matching Pairs</Text>
                        <View style={s.pvPairsList}>
                          {pairs.map((pair: any, idx: number) => {
                            const leftVal = pair.left || pair.item || pair.leftText || `Item ${idx + 1}`;
                            const rightVal = pair.right || pair.pair || pair.rightText || `Match ${idx + 1}`;
                            return (
                              <View key={idx} style={s.pvPairRow}>
                                <View style={s.pvPairBox}>
                                  <Text style={s.pvPairText}>{leftVal}</Text>
                                </View>
                                <Text style={s.pvPairArrow}>➔</Text>
                                <View style={s.pvPairBox}>
                                  <Text style={s.pvPairText}>{rightVal}</Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {explanation ? (
                      <View style={s.pvSection}>
                        <Text style={s.pvSectionLabel}>Explanation</Text>
                        <View style={s.pvExplanationBox}>
                          <Text style={s.pvExplanationText}>{explanation}</Text>
                        </View>
                      </View>
                    ) : null}
                  </>
                );
              })()}
            </ScrollView>

            <View style={s.pvModalFooter}>
              <Pressable style={s.pvCloseActionBtn} onPress={() => setPreviewQuestion(null)}>
                <Text style={s.pvCloseActionText}>Close Preview</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8ECF8' },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8F9FF', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#1a1a2e' },
  headerSub: { fontSize: 12, color: '#525C6B', fontWeight: '500', marginTop: 1 },
  saveBtn: { backgroundColor: '#2D5DC9', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  submitSaveBtn: { backgroundColor: '#2D5DC9', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitSaveText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  desktopLayout: { flex: 1, flexDirection: 'row', gap: 16, padding: 16, overflow: 'hidden' },
  desktopLeftCol: { flex: 1, minWidth: 320, height: '100%' },
  desktopRightCol: { flex: 1.4, minWidth: 360, height: '100%' },

  tabBar: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8ECF8' },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8, backgroundColor: '#F5F7FF' },
  tabActive: { backgroundColor: '#EBF4FF' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#525C6B' },
  tabTextActive: { color: '#2D5DC9' },

  tabContent: { padding: 14, gap: 14, paddingBottom: 60 },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, overflow: 'hidden' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  totalPtsText: { fontSize: 12, fontWeight: '700', color: '#0284C7' },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#5A6A8A', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#1a1a2e' },
  row: { flexDirection: 'row', gap: 10 },
  dropdownField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  dropdownText: { fontSize: 13, color: '#1a1a2e', fontWeight: '600', flex: 1 },
  dropdownPlaceholder: { fontSize: 13, color: '#A0A8C0', flex: 1 },

  chipsRow: { flexDirection: 'row', gap: 8 },
  diffChip: { borderRadius: 999, borderWidth: 1.5, borderColor: '#E0E4F0', backgroundColor: '#F8FAFC', paddingHorizontal: 14, paddingVertical: 7 },
  diffChipActive: { borderColor: '#2D5DC9', backgroundColor: '#EBF4FF' },
  diffChipText: { fontSize: 12, fontWeight: '700', color: '#525C6B' },
  diffChipTextActive: { color: '#2D5DC9' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#D0D8F0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  checkboxChecked: { borderColor: '#2D5DC9', backgroundColor: '#2D5DC9' },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },

  bankFiltersRow: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  selectInputCompact: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
  },
  selectTextCompact: { fontSize: 11, fontWeight: '600', color: '#1a1a2e' },
  selectPlaceholderCompact: { fontSize: 11, color: '#525C6B' },
  clearBtnCompact: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 7, alignItems: 'center', justifyContent: 'center' },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 13, color: '#1a1a2e', paddingVertical: 0 },
  refreshBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#EBF4FF', alignItems: 'center', justifyContent: 'center' },

  emptyText: { fontSize: 12, color: '#525C6B', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },

  qRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E8ECF8' },
  qTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  qBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  qBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E8ECF8', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  qBadgeText: { fontSize: 10, fontWeight: '700', color: '#5A6A8A' },
  qClassBadge: { backgroundColor: '#EFF6FF' },
  qClassBadgeText: { color: '#1D4ED8', fontWeight: '700' },
  innerScrollList: { maxHeight: 420, minHeight: 180 },

  qPreviewIconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F7FF', alignItems: 'center', justifyContent: 'center' },
  attachBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: '#86efac', backgroundColor: '#ecfdf5' },
  attachBtnText: { fontSize: 12, fontWeight: '800', color: '#166534' },
  removeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#fee2e2' },

  errorBox: { margin: 12, padding: 12, borderRadius: 10, backgroundColor: '#FFF1F2', borderWidth: 1.5, borderColor: '#FECDD3' },
  errorText: { color: '#9F1239', fontSize: 12, fontWeight: '700' },
  toast: { margin: 12, padding: 12, borderRadius: 10, backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#86EFAC' },
  toastText: { color: '#166534', fontSize: 12, fontWeight: '700' },

  previewBody: { fontSize: 13, color: '#334155', lineHeight: 20 },
  previewItem: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F4FF' },
  previewItemNum: { fontWeight: '900', color: '#2D5DC9', fontSize: 13 },
  previewItemTitle: { flex: 1, fontSize: 13, color: '#1a1a2e' },

  paginationBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F4FF', marginTop: 4 },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EBF4FF' },
  pageBtnDisabled: { backgroundColor: '#F4F5FF' },
  pageBtnText: { fontSize: 12, fontWeight: '700', color: '#2D5DC9' },
  pageBtnTextDisabled: { color: '#C0C8D8' },
  pageIndicator: { fontSize: 12, fontWeight: '700', color: '#5A6A8A' },
  centerWrap: { padding: 40, alignItems: 'center', justifyContent: 'center' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  pvModalCard: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  pvModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAFCFF',
  },
  pvHeaderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pvModalTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  pvModalSubtitle: { fontSize: 12, color: '#4B5768', fontWeight: '500' },
  pvModalCloseBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F1F5F9' },
  pvModalScroll: { maxHeight: 480 },
  pvModalContent: { padding: 20, gap: 14 },
  pvLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  pvLoadingText: { fontSize: 12, color: '#2D5DC9', fontWeight: '600' },
  pvQuestionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', lineHeight: 22 },
  pvBadgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  pvTypeChip: { backgroundColor: '#F0F7FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pvTypeChipText: { fontSize: 11, fontWeight: '700', color: '#2D5DC9' },
  pvStatBar: { flexDirection: 'row', gap: 16, alignItems: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10 },
  pvStatItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pvStatText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  pvInstructionBox: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D', borderWidth: 1, padding: 12, borderRadius: 10, gap: 4 },
  pvInstructionLabel: { fontSize: 11, fontWeight: '800', color: '#B45309', textTransform: 'uppercase' },
  pvInstructionText: { fontSize: 13, color: '#78350F', lineHeight: 18 },
  pvSection: { gap: 8 },
  pvSectionLabel: { fontSize: 12, fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  pvPromptImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#F8FAFC' },
  pvOptionsList: { gap: 8 },
  pvOptionCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  pvOptionCardCorrect: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  pvOptionDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  pvOptionDotCorrect: { backgroundColor: '#22C55E' },
  pvOptionDotText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  pvOptionDotTextCorrect: { color: '#ffffff' },
  pvOptionText: { fontSize: 13, color: '#1E293B', fontWeight: '500' },
  pvOptionImg: { width: '100%', height: 90, borderRadius: 6 },
  pvCorrectBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pvCorrectBadgeText: { fontSize: 11, fontWeight: '700', color: '#15803D' },
  pvPairsList: { gap: 6 },
  pvPairRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pvPairBox: { flex: 1, backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  pvPairText: { fontSize: 12, fontWeight: '600', color: '#334155', textAlign: 'center' },
  pvPairArrow: { fontSize: 14, color: '#2D5DC9', fontWeight: '800' },
  pvExplanationBox: { backgroundColor: '#F0F7FF', borderColor: '#BAE6FD', borderWidth: 1, padding: 12, borderRadius: 10 },
  pvExplanationText: { fontSize: 13, color: '#0369A1', lineHeight: 18 },
  pvModalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FAFCFF' },
  pvCloseActionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#E2E8F0' },
  pvCloseActionText: { fontSize: 13, fontWeight: '700', color: '#475569' },
});
