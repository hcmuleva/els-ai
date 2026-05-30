import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
import SelectorModal from '../SelectorModal';

type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;
type Tab = 'setup' | 'questions' | 'preview';
type Difficulty = 'Easy' | 'Medium' | 'Hard';
type SelectorField = 'classLevel' | 'subject' | null;

type QuizQuestion = {
  id: string;
  question_type: string;
  question_title?: string;
  question_instruction?: string;
  points: number;
  time_limit_seconds: number;
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
};

export type QuizEditorModalProps = {
  visible: boolean;
  quizId: string | null;
  apiFetch: ApiFetch;
  onClose: () => void;
  onUpdated?: () => void;
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

export default function QuizEditorModal({ visible, quizId, apiFetch, onClose, onUpdated }: QuizEditorModalProps) {
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
  const [loadingBank, setLoadingBank] = useState(false);
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null);
  const [selectorField, setSelectorField] = useState<SelectorField>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [subjectOpts, setSubjectOpts] = useState<{ label: string; value: string }[]>([]);
  const [bankPage, setBankPage] = useState(0);
  const PAGE_SIZE = 10;

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
      const res = await apiFetch('/question-bank?limit=300');
      if (!res.ok) return;
      const payload = await res.json();
      setBank(payload.questions || []);
    } catch { /* ignore */ }
    finally {
      setLoadingBank(false);
    }
  }, [apiFetch]);

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
      loadBank();
      loadSubjects();
    }
  }, [visible, quizId, loadQuiz, loadBank, loadSubjects]);

  const attachedIds = useMemo(() => new Set(attached.map((q) => q.id)), [attached]);

  const filteredBank = useMemo(() => {
    const keyword = bankSearch.trim().toLowerCase();
    return bank.filter((q) => {
      if (classLevel && q.class_level !== classLevel) return false;
      if (subject && q.subject !== subject) return false;
      if (!keyword) return true;
      return [q.question_title, q.quiz_title, q.question_instruction, q.question_type]
        .filter(Boolean).join(' ').toLowerCase().includes(keyword);
    });
  }, [bank, bankSearch, classLevel, subject]);

  useEffect(() => { setBankPage(0); }, [bankSearch, classLevel, subject]);

  const handleSave = async () => {
    if (!quizId) return;
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
    setBusyQuestionId(sourceQuestionId);
    setError(null);
    try {
      const res = await apiFetch(`/quizzes/${quizId}/questions/reuse`, {
        method: 'POST',
        body: JSON.stringify({ sourceQuestionId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to attach question');
      const created = await res.json();
      setAttached((prev) => [...prev, {
        id: created.id,
        question_type: created.question_type,
        question_title: created.question_title,
        question_instruction: created.question_instruction,
        points: created.points || 0,
        time_limit_seconds: created.time_limit_seconds || 30,
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

  const classOptions = STANDARD_OPTIONS.map((o) => ({ label: o.label, value: o.value }));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={s.screen}>
        <View style={[s.header, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
          <Pressable onPress={onClose} style={s.backBtn}>
            <ChevronLeft size={24} color="#1a1a2e" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>Edit Quiz</Text>
            <Text style={s.headerSub} numberOfLines={1}>{title || 'Untitled'}</Text>
          </View>
          <Pressable style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving || loading}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>Save</Text>}
          </Pressable>
        </View>

        <View style={s.tabBar}>
          {(['setup', 'questions', 'preview'] as Tab[]).map((t) => (
            <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'setup' ? 'Setup' : t === 'questions' ? `Questions (${attached.length})` : 'Preview'}
              </Text>
            </Pressable>
          ))}
        </View>

        {toast && <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>}
        {error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}

        {loading ? (
          <View style={s.centerWrap}><ActivityIndicator size="large" color="#4A90E2" /></View>
        ) : (
          <>
            {tab === 'setup' && (
              <ScrollView contentContainerStyle={s.tabContent}>
                <View style={s.card}>
                  <Text style={s.cardTitle}>Basic Info</Text>
                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>Title *</Text>
                    <TextInput value={title} onChangeText={setTitle} style={s.input} placeholderTextColor="#A0A8C0" />
                  </View>
                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>Description</Text>
                    <TextInput value={description} onChangeText={setDescription} multiline style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholderTextColor="#A0A8C0" />
                  </View>
                </View>

                <View style={s.card}>
                  <Text style={s.cardTitle}>Class Settings</Text>
                  <View style={s.row}>
                    <View style={[s.fieldGroup, { flex: 1 }]}>
                      <Text style={s.fieldLabel}>Standard</Text>
                      <Pressable style={s.dropdownField} onPress={() => setSelectorField('classLevel')}>
                        <Text style={classLevel ? s.dropdownText : s.dropdownPlaceholder}>
                          {classLevel ? getStandardLabel(classLevel) : 'Select Standard'}
                        </Text>
                        <ChevronDown size={14} color="#9A9AB0" />
                      </Pressable>
                    </View>
                    <View style={[s.fieldGroup, { flex: 1 }]}>
                      <Text style={s.fieldLabel}>Subject</Text>
                      <Pressable style={s.dropdownField} onPress={() => setSelectorField('subject')}>
                        <Text style={subject ? s.dropdownText : s.dropdownPlaceholder}>
                          {subject || 'Select Subject'}
                        </Text>
                        <ChevronDown size={14} color="#9A9AB0" />
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
                </View>
              </ScrollView>
            )}

            {tab === 'questions' && (
              <ScrollView contentContainerStyle={s.tabContent}>
                <View style={s.card}>
                  <View style={s.cardHeaderRow}>
                    <Text style={s.cardTitle}>Attached Questions ({attached.length})</Text>
                  </View>
                  {attached.length === 0 ? (
                    <Text style={s.emptyText}>No questions attached. Pick from the bank below.</Text>
                  ) : (
                    attached.map((q) => {
                      const typeLabel = QUIZ_TYPE_LABELS[normalizeQuestionType(q.question_type)] || q.question_type;
                      return (
                        <View key={q.id} style={s.qRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.qTitle} numberOfLines={2}>{q.question_title || 'Untitled'}</Text>
                            <View style={s.qBadgeRow}>
                              <View style={s.qBadge}><Text style={s.qBadgeText}>{typeLabel}</Text></View>
                              <View style={s.qBadge}><Zap size={10} color="#E6A817" fill="#E6A817" /><Text style={s.qBadgeText}>{q.points} pts</Text></View>
                            </View>
                          </View>
                          <Pressable
                            style={s.removeBtn}
                            onPress={() => handleDetach(q.id)}
                            disabled={busyQuestionId === q.id}
                          >
                            {busyQuestionId === q.id
                              ? <ActivityIndicator size="small" color="#dc2626" />
                              : <Trash2 size={16} color="#dc2626" />}
                          </Pressable>
                        </View>
                      );
                    })
                  )}
                </View>

                <View style={s.card}>
                  <View style={s.cardHeaderRow}>
                    <Text style={s.cardTitle}>Question Bank</Text>
                    <Pressable style={s.refreshBtn} onPress={loadBank} disabled={loadingBank}>
                      {loadingBank ? <ActivityIndicator size="small" color="#4A90E2" /> : <RotateCw size={14} color="#4A90E2" />}
                    </Pressable>
                  </View>
                  <View style={s.searchRow}>
                    <Search size={14} color="#9A9AB0" />
                    <TextInput
                      value={bankSearch}
                      onChangeText={setBankSearch}
                      placeholder="Search questions..."
                      style={s.searchInput}
                      placeholderTextColor="#A0A8C0"
                    />
                    {bankSearch !== '' && (
                      <Pressable onPress={() => setBankSearch('')}><X size={14} color="#9A9AB0" /></Pressable>
                    )}
                  </View>
                  {filteredBank.length === 0 ? (
                    <Text style={s.emptyText}>No questions match the filter.</Text>
                  ) : (() => {
                    const bTotalPages = Math.max(1, Math.ceil(filteredBank.length / PAGE_SIZE));
                    const bPaged = filteredBank.slice(bankPage * PAGE_SIZE, (bankPage + 1) * PAGE_SIZE);
                    return (<>
                      {bPaged.map((q) => {
                        const isAttached = attachedIds.has(q.id);
                        const typeLabel = QUIZ_TYPE_LABELS[normalizeQuestionType(q.question_type)] || q.question_type;
                        return (
                          <View key={q.id} style={[s.qRow, isAttached && s.qRowMuted]}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.qTitle} numberOfLines={2}>{q.question_title || 'Untitled'}</Text>
                              <View style={s.qBadgeRow}>
                                <View style={s.qBadge}><Text style={s.qBadgeText}>{q.class_level || '-'}</Text></View>
                                {q.subject ? <View style={s.qBadge}><Text style={s.qBadgeText}>{q.subject}</Text></View> : null}
                                <View style={s.qBadge}><Text style={s.qBadgeText}>{typeLabel}</Text></View>
                              </View>
                            </View>
                            <Pressable
                              style={[s.attachBtn, isAttached && s.attachBtnDisabled]}
                              onPress={() => !isAttached && handleAttach(q.id)}
                              disabled={isAttached || busyQuestionId === q.id}
                            >
                              {busyQuestionId === q.id
                                ? <ActivityIndicator size="small" color="#16a34a" />
                                : isAttached
                                  ? <Text style={s.attachBtnTextMuted}>Added</Text>
                                  : <><Plus size={13} color="#16a34a" /><Text style={s.attachBtnText}>Add</Text></>}
                            </Pressable>
                          </View>
                        );
                      })}
                      {filteredBank.length > PAGE_SIZE && (
                        <View style={s.paginationBar}>
                          <Pressable
                            style={[s.pageBtn, bankPage === 0 && s.pageBtnDisabled]}
                            onPress={() => setBankPage((p) => Math.max(0, p - 1))}
                            disabled={bankPage === 0}
                          >
                            <ChevronLeft size={16} color={bankPage === 0 ? '#C0C8D8' : '#4A90E2'} />
                            <Text style={[s.pageBtnText, bankPage === 0 && s.pageBtnTextDisabled]}>Prev</Text>
                          </Pressable>
                          <Text style={s.pageIndicator}>Page {bankPage + 1} / {bTotalPages}</Text>
                          <Pressable
                            style={[s.pageBtn, bankPage >= bTotalPages - 1 && s.pageBtnDisabled]}
                            onPress={() => setBankPage((p) => Math.min(bTotalPages - 1, p + 1))}
                            disabled={bankPage >= bTotalPages - 1}
                          >
                            <Text style={[s.pageBtnText, bankPage >= bTotalPages - 1 && s.pageBtnTextDisabled]}>Next</Text>
                            <ChevronRight size={16} color={bankPage >= bTotalPages - 1 ? '#C0C8D8' : '#4A90E2'} />
                          </Pressable>
                        </View>
                      )}
                    </>);
                  })()}
                </View>
              </ScrollView>
            )}

            {tab === 'preview' && (
              <ScrollView contentContainerStyle={s.tabContent}>
                <View style={s.card}>
                  <Text style={s.cardTitle}>{title || 'Untitled Quiz'}</Text>
                  {description ? <Text style={s.previewBody}>{description}</Text> : null}
                  <View style={s.qBadgeRow}>
                    <View style={s.qBadge}><Text style={s.qBadgeText}>{classLevel ? getStandardLabel(classLevel) : 'No class'}</Text></View>
                    {subject ? <View style={s.qBadge}><Text style={s.qBadgeText}>{subject}</Text></View> : null}
                    <View style={s.qBadge}><Text style={s.qBadgeText}>{difficulty}</Text></View>
                    <View style={s.qBadge}><Text style={s.qBadgeText}>{isPublished ? 'Published' : 'Draft'}</Text></View>
                  </View>
                </View>
                <View style={s.card}>
                  <Text style={s.cardTitle}>Questions ({attached.length})</Text>
                  {attached.length === 0 ? (
                    <Text style={s.emptyText}>No questions attached yet.</Text>
                  ) : (
                    attached.map((q, i) => (
                      <View key={q.id} style={s.previewItem}>
                        <Text style={s.previewItemNum}>{i + 1}.</Text>
                        <Text style={s.previewItemTitle}>{q.question_title || 'Untitled'}</Text>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            )}
          </>
        )}
      </View>

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
        options={subjectOpts}
        selected={subject}
        isSubject
        onSelect={(v) => { setSubject(v); setSelectorField(null); }}
        onClose={() => setSelectorField(null)}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FF' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#ECEEF4',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#1a1a2e' },
  headerSub: { fontSize: 11, color: '#9A9AB0', fontWeight: '600' },
  saveBtn: { backgroundColor: '#4A90E2', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  saveBtnDisabled: { backgroundColor: '#9DBDF0' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  tabBar: { flexDirection: 'row', gap: 6, padding: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ECEEF4' },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8, backgroundColor: '#F5F7FF' },
  tabActive: { backgroundColor: '#EBF4FF' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#9A9AB0' },
  tabTextActive: { color: '#4A90E2' },

  tabContent: { padding: 14, gap: 14, paddingBottom: 60 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 12 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#5A6A8A', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#1a1a2e' },
  row: { flexDirection: 'row', gap: 10 },
  dropdownField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  dropdownText: { fontSize: 13, color: '#1a1a2e', fontWeight: '600', flex: 1 },
  dropdownPlaceholder: { fontSize: 13, color: '#A0A8C0', flex: 1 },

  chipsRow: { flexDirection: 'row', gap: 8 },
  diffChip: { borderRadius: 999, borderWidth: 1.5, borderColor: '#E0E4F0', backgroundColor: '#F8F9FF', paddingHorizontal: 14, paddingVertical: 7 },
  diffChipActive: { borderColor: '#4A90E2', backgroundColor: '#EBF4FF' },
  diffChipText: { fontSize: 12, fontWeight: '700', color: '#9A9AB0' },
  diffChipTextActive: { color: '#4A90E2' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#D0D8F0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FF' },
  checkboxChecked: { borderColor: '#4A90E2', backgroundColor: '#4A90E2' },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 13, color: '#1a1a2e', paddingVertical: 0 },
  refreshBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#EBF4FF', alignItems: 'center', justifyContent: 'center' },

  emptyText: { fontSize: 12, color: '#9A9AB0', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },

  qRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E8ECF8' },
  qRowMuted: { opacity: 0.6 },
  qTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  qBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  qBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E8ECF8', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  qBadgeText: { fontSize: 10, fontWeight: '700', color: '#5A6A8A' },

  attachBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: '#86efac', backgroundColor: '#ecfdf5' },
  attachBtnDisabled: { borderColor: '#D0D8F0', backgroundColor: '#F4F5FF' },
  attachBtnText: { fontSize: 12, fontWeight: '800', color: '#166534' },
  attachBtnTextMuted: { fontSize: 12, fontWeight: '800', color: '#9A9AB0' },
  removeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#fee2e2' },

  errorBox: { margin: 12, padding: 12, borderRadius: 10, backgroundColor: '#FFF1F2', borderWidth: 1.5, borderColor: '#FECDD3' },
  errorText: { color: '#9F1239', fontSize: 12, fontWeight: '700' },
  toast: { margin: 12, padding: 12, borderRadius: 10, backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#86EFAC' },
  toastText: { color: '#166534', fontSize: 12, fontWeight: '700' },

  previewBody: { fontSize: 13, color: '#334155', lineHeight: 20 },
  previewItem: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F4FF' },
  previewItemNum: { fontWeight: '900', color: '#4A90E2', fontSize: 13 },
  previewItemTitle: { flex: 1, fontSize: 13, color: '#1a1a2e' },

  paginationBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F4FF', marginTop: 4 },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EBF4FF' },
  pageBtnDisabled: { backgroundColor: '#F4F5FF' },
  pageBtnText: { fontSize: 12, fontWeight: '700', color: '#4A90E2' },
  pageBtnTextDisabled: { color: '#C0C8D8' },
  pageIndicator: { fontSize: 12, fontWeight: '700', color: '#5A6A8A' },
});
