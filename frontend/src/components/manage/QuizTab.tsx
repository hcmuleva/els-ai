import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  PenLine,
  GraduationCap,
  Trophy,
  Search,
  RotateCw,
  Clock,
  BookOpen,
  Layers,
  ListChecks,
  SplitSquareHorizontal,
  Volume2,
  CheckSquare,
  Eye,
  Plus,
  Minus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Filter,
  Zap,
  School,
  Puzzle,
  Pencil,
  Library,
  Trash2,
} from 'lucide-react-native';

import { STANDARD_OPTIONS, GLOBAL_SUBJECTS, getStandardLabel } from '../../constants/standards';
import { getAuthorizedClasses, getAuthorizedCatalogItems } from '../../utils/assignments';
import { useAuth } from '../../context/AuthContext';
import { Colors, Radius, Shadow } from '../../theme';
import SelectorModal from '../SelectorModal';
import QuizEditorModal from '../quiz/QuizEditorModal';
import ConfirmModal from '../common/ConfirmModal';
import SafeImage from '../quiz/SafeImage';
import { resolveMediaUrl } from '../../utils/media';

type QuizType =
  | 'drag_drop'
  | 'image_select'
  | 'sound_match'
  | 'memory_game'
  | 'drag_drop_match'
  | 'guess_image'
  | 'guess_audio'
  | 'true_false'
  | 'single_choice'
  | 'multi_choice'
  | 'logico'
  | 'memory_match'
  | 'fill_blank'
  | 'jigsaw';
type Difficulty = 'Easy' | 'Medium' | 'Hard';
type BankTab = 'question' | 'selected';
type SelectorField = 'quizClassLevel' | 'quizSubject' | 'bankClassLevel' | 'bankSubject' | 'bankType';
type PageView = 'creator' | 'quiz_bank';

type QuizBankItem = {
  id: string;
  title: string;
  description?: string;
  classLevel?: string;
  subject?: string;
  quizType?: string;
  difficultyLevel?: string;
  totalQuestions?: number;
  isPublished?: boolean;
  createdAt?: string;
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
  created_at: string;
};

type AssessmentDraft = {
  title: string;
  description: string;
  classLevel: string;
  subject: string;
  quizType: QuizType;
  difficultyLevel: Difficulty;
  isPublished: boolean;
};

type SubjectCatalogItem = {
  classLevel: string;
  subject: string;
  coverImage?: string;
  iconImage?: string;
  iconBgColor?: string;
};

const INITIAL_DRAFT: AssessmentDraft = {
  title: '',
  description: '',
  classLevel: '',
  subject: '',
  quizType: 'single_choice',
  difficultyLevel: 'Medium',
  isPublished: true,
};

const QUIZ_TYPE_LABEL: Record<string, string> = {
  single_choice: 'Single Choice',
  multi_choice: 'Multiple Choice',
  true_false: 'True / False',
  image_select: 'Image Select',
  sound_match: 'Sound Match',
  memory_game: 'Memory Game',
  drag_drop: 'Drag & Drop',
  drag_drop_match: 'Drag & Drop Match',
  guess_image: 'Guess Image',
  guess_audio: 'Guess Audio',
  logico: 'Logico',
  memory_match: 'Memory Match',
  fill_blank: 'Fill in the Blank',
  jigsaw: 'Jigsaw Puzzle',
};

const DIFFICULTY_STYLE: Record<Difficulty, { bg: string; color: string }> = {
  Easy: { bg: '#D6F5D6', color: '#1A6B1A' },
  Medium: { bg: '#FFF3C4', color: '#B45309' },
  Hard: { bg: '#FFE8E8', color: '#B91C1C' },
};

export interface QuizTabProps {
  filters?: { classLevel: string; subject: string };
  onFiltersChange?: (filters: Partial<{ classLevel: string; subject: string }>) => void;
}

export default function QuizTab({ filters: externalFilters, onFiltersChange }: QuizTabProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const { user, apiFetch } = useAuth();
  const [bankTab, setBankTab]                             = useState<BankTab>('question');
  const [questionBankSearch, setQuestionBankSearch]       = useState('');
  const [bankTypeFilter, setBankTypeFilter]               = useState('');
  const [bankClassFilter, setBankClassFilter]             = useState('');
  const [bankSubjectFilter, setBankSubjectFilter]         = useState('');

  const [loadingQuestionBank, setLoadingQuestionBank]     = useState(false);
  const [creating, setCreating]                           = useState(false);
  const [selectorField, setSelectorField]                 = useState<SelectorField | null>(null);
  const [bankPage, setBankPage]                           = useState(0);
  const [questionBank, setQuestionBank]                   = useState<QuestionBankItem[]>([]);
  const [quizDraft, setQuizDraft]                         = useState<AssessmentDraft>(INITIAL_DRAFT);
  const [quizSelectedQuestionIds, setQuizSelectedQuestionIds] = useState<string[]>([]);
  const [message, setMessage]                             = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [subjectCatalogItems, setSubjectCatalogItems]     = useState<SubjectCatalogItem[]>([]);
  const [pageView, setPageView]                           = useState<PageView>('creator');
  const [quizBank, setQuizBank]                           = useState<QuizBankItem[]>([]);
  const [loadingQuizBank, setLoadingQuizBank]             = useState(false);
  const [quizBankSearch, setQuizBankSearch]               = useState('');
  const [editingQuizId, setEditingQuizId]                 = useState<string | null>(null);
  const [deletingQuizId, setDeletingQuizId]               = useState<string | null>(null);
  const [confirmDeleteQuiz, setConfirmDeleteQuiz]         = useState<QuizBankItem | null>(null);
  const [quizBankPage, setQuizBankPage]                   = useState(0);
  const [previewQuestion, setPreviewQuestion]             = useState<QuestionBankItem | null>(null);
  const [loadingPreview, setLoadingPreview]               = useState(false);

  const isTeacherView = user?.activeRole === 'teacher' || user?.activeRole === 'admin' || user?.activeRole === 'superadmin';

  const handleOpenPreview = useCallback(async (q: QuestionBankItem) => {
    setPreviewQuestion(q);
    if (!q.question_data) {
      setLoadingPreview(true);
      try {
        const res = await apiFetch(`/questions/${q.id}`);
        if (res.ok) {
          const payload = await res.json();
          const fetched = payload.question || payload;
          setPreviewQuestion((prev) =>
            prev?.id === q.id
              ? { ...prev, ...fetched, question_data: fetched.question_data ?? fetched.questionData }
              : prev
          );
        }
      } catch (err) {
        console.warn('Failed to fetch full question details:', err);
      } finally {
        setLoadingPreview(false);
      }
    }
  }, [apiFetch]);

  // Sync initial external filters if passed on mount
  const isInitialFilterMount = useRef(true);
  useEffect(() => {
    if (externalFilters && isInitialFilterMount.current) {
      isInitialFilterMount.current = false;
      setQuizDraft((prev) => ({
        ...prev,
        classLevel: externalFilters.classLevel || prev.classLevel,
        subject: externalFilters.subject || prev.subject,
      }));
      if (externalFilters.classLevel) setBankClassFilter(externalFilters.classLevel);
      if (externalFilters.subject) setBankSubjectFilter(externalFilters.subject);
    }
  }, [externalFilters]);

  const currentDraft = quizDraft;
  const currentSelectedIds = quizSelectedQuestionIds;

  const setCurrentDraft = (patch: Partial<AssessmentDraft>) => {
    setQuizDraft((c) => ({ ...c, ...patch }));
  };

  const loadSubjectCatalog = useCallback(async () => {
    if (!isTeacherView) return;
    try {
      const res = await apiFetch('/content/subjects');
      if (res.ok) {
        const payload = await res.json();
        const items = Array.isArray(payload.subjects) ? payload.subjects : [];
        setSubjectCatalogItems(
          items
            .map((item: any) => ({
              classLevel: String(item.classLevel || item.class_level || '').trim(),
              subject:    String(item.title || item.subject || '').trim(),
              coverImage: String(item.coverImage || item.cover_image || '').trim() || undefined,
              iconImage: String(item.iconImage || item.icon_image || '').trim() || undefined,
              iconBgColor: String(item.iconBgColor || item.icon_bg_color || '').trim() || undefined,
            }))
            .filter((item: SubjectCatalogItem) => item.classLevel && item.subject),
        );
      }
    } catch { /* silently fail */ }
  }, [apiFetch, isTeacherView]);

  const fetchPagedRows = useCallback(
    async (endpoint: string, key: 'questions' | 'quizzes', baseQuery: URLSearchParams, chunkSize = 200) => {
      const merged: any[] = [];
      let offset = 0;
      let guard = 0;
      while (guard < 1000) {
        const query = new URLSearchParams(baseQuery);
        query.set('limit', String(chunkSize));
        query.set('offset', String(offset));
        const res = await apiFetch(`${endpoint}?${query.toString()}`);
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.message || `Failed to load ${key}`);
        }
        const payload = await res.json();
        const rows = Array.isArray(payload[key]) ? payload[key] : [];
        merged.push(...rows);
        if (rows.length === 0) break;
        const total = Number(payload.total ?? NaN);
        if (Number.isFinite(total)) {
          if (merged.length >= total) break;
        } else if (rows.length < chunkSize) {
          break;
        }
        offset += rows.length;
        guard += 1;
      }
      return merged;
    },
    [apiFetch],
  );

  const loadQuestionBank = useCallback(async () => {
    if (!isTeacherView) return;
    setLoadingQuestionBank(true);
    try {
      const query = new URLSearchParams();
      if (bankClassFilter.trim()) query.set('class_level', bankClassFilter.trim());
      if (bankSubjectFilter.trim()) query.set('subject', bankSubjectFilter.trim());
      if (bankTypeFilter.trim()) query.set('question_type', bankTypeFilter.trim());
      const rows = await fetchPagedRows('/question-bank', 'questions', query, 200);
      setQuestionBank(rows as QuestionBankItem[]);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load question bank' });
    } finally {
      setLoadingQuestionBank(false);
    }
  }, [bankClassFilter, bankSubjectFilter, bankTypeFilter, fetchPagedRows, isTeacherView]);

  const loadQuizBank = useCallback(async () => {
    if (!isTeacherView) return;
    setLoadingQuizBank(true);
    try {
      const items = await fetchPagedRows(
        '/quizzes/teacher/library',
        'quizzes',
        new URLSearchParams({ status: 'all' }),
        200,
      );
      setQuizBank(items.map((q: any) => ({
        id: String(q.id),
        title: q.title || 'Untitled',
        description: q.description || '',
        classLevel: q.class_level || q.classLevel,
        subject: q.subject,
        quizType: q.quiz_type || q.quizType,
        difficultyLevel: q.difficulty_level || q.difficultyLevel,
        totalQuestions: q.total_questions ?? q.totalQuestions ?? q.questionCount ?? 0,
        isPublished: q.is_published ?? q.isPublished,
        createdAt: q.created_at || q.createdAt,
      })));
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load quizzes' });
    } finally {
      setLoadingQuizBank(false);
    }
  }, [fetchPagedRows, isTeacherView]);

  const handleDeleteQuiz = async (id: string) => {
    setDeletingQuizId(id);
    try {
      const res = await apiFetch(`/quizzes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to delete quiz');
      setQuizBank((prev) => prev.filter((q) => q.id !== id));
      setMessage({ type: 'success', text: 'Quiz deleted.' });
      setTimeout(() => setMessage(null), 2500);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete quiz' });
      setTimeout(() => setMessage(null), 3500);
    } finally {
      setDeletingQuizId(null);
    }
  };

  useEffect(() => {
    loadSubjectCatalog();
  }, [loadSubjectCatalog]);

  useEffect(() => {
    if (pageView === 'quiz_bank') {
      loadQuizBank();
    }
  }, [pageView, loadQuizBank]);

  useEffect(() => {
    loadQuestionBank();
  }, [loadQuestionBank]);

  const filteredQuizBank = useMemo(() => {
    const keyword = quizBankSearch.trim().toLowerCase();
    return quizBank.filter((q) => {
      if (!keyword) return true;
      return [q.title, q.description, q.subject, q.classLevel].filter(Boolean).join(' ').toLowerCase().includes(keyword);
    });
  }, [quizBank, quizBankSearch]);

  useEffect(() => { setQuizBankPage(0); }, [quizBankSearch]);

  // Class options for Quiz Setup and Question Bank filter (includes Any Class)
  const classOptions = useMemo(() => {
    const authorizedValues = getAuthorizedClasses(user, STANDARD_OPTIONS.map(i => i.value));
    return STANDARD_OPTIONS.filter(opt => authorizedValues.includes(opt.value));
  }, [user]);

  // Subject options — includes catalog subjects + Any Class GLOBAL_SUBJECTS
  const subjectOptions = useMemo(() => {
    const byTitle = new Map<string, { coverImage?: string; iconImage?: string; iconBgColor?: string }>();
    const items = getAuthorizedCatalogItems(
      user, 
      subjectCatalogItems, 
      (i) => i.classLevel, 
      (i) => i.subject, 
      currentDraft.classLevel || 'ANY'
    );
    
    items.forEach((item) => {
      if (!item.subject || byTitle.has(item.subject)) return;
      byTitle.set(item.subject, {
        coverImage: item.coverImage,
        iconImage: item.iconImage,
        iconBgColor: item.iconBgColor,
      });
    });

    GLOBAL_SUBJECTS.forEach((sub) => {
      if (!byTitle.has(sub)) {
        byTitle.set(sub, {});
      }
    });

    return Array.from(byTitle.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([subject, meta]) => ({
        label: subject,
        value: subject,
        coverImage: meta.coverImage,
        iconUrl: meta.iconImage,
        iconBgColor: meta.iconBgColor,
      }));
  }, [currentDraft.classLevel, subjectCatalogItems, user]);

  const bankTypeOptions = useMemo(() => {
    return Object.entries(QUIZ_TYPE_LABEL).map(([value, label]) => ({
      label,
      value,
    }));
  }, []);

  const filteredQuestions = useMemo(() => {
    const keyword = questionBankSearch.trim().toLowerCase();
    return questionBank.filter((q) => {
      if (bankClassFilter && q.class_level !== bankClassFilter && q.class_level !== 'ANY') return false;
      if (bankSubjectFilter && q.subject?.toLowerCase() !== bankSubjectFilter.toLowerCase()) return false;
      if (bankTypeFilter && q.question_type !== bankTypeFilter) return false;
      if (!keyword) return true;
      return [q.question_title, q.question_instruction, q.quiz_title, q.subject].filter(Boolean).join(' ').toLowerCase().includes(keyword);
    });
  }, [bankClassFilter, bankSubjectFilter, bankTypeFilter, questionBank, questionBankSearch]);

  useEffect(() => { setBankPage(0); }, [bankClassFilter, bankSubjectFilter, bankTypeFilter, questionBankSearch]);

  const selectedQuestions = useMemo(() => {
    const set = new Set(currentSelectedIds);
    return questionBank.filter((q) => set.has(q.id));
  }, [currentSelectedIds, questionBank]);

  const toggleSelectQuestion = (id: string) => {
    setQuizSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    const filteredIds = filteredQuestions.map((q) => q.id);
    const allSelected = filteredIds.every((id) => quizSelectedQuestionIds.includes(id));
    if (allSelected) {
      setQuizSelectedQuestionIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setQuizSelectedQuestionIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleCreate = async () => {
    if (!currentDraft.title.trim()) {
      setMessage({ type: 'error', text: 'Please provide a Quiz Title.' });
      return;
    }
    if (currentSelectedIds.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least 1 question.' });
      return;
    }
    setCreating(true);
    setMessage(null);
    try {
      const body = {
        title: currentDraft.title.trim(),
        description: currentDraft.description.trim() || undefined,
        class_level: currentDraft.classLevel || undefined,
        subject: currentDraft.subject || undefined,
        quiz_type: currentDraft.quizType,
        difficulty_level: currentDraft.difficultyLevel,
        is_published: currentDraft.isPublished,
        time_limit_minutes: 30,
        question_ids: currentSelectedIds,
      };
      const res = await apiFetch('/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to create Quiz.');
      }
      setMessage({ type: 'success', text: `Quiz "${currentDraft.title}" created successfully with ${currentSelectedIds.length} question(s)!` });
      setQuizDraft(INITIAL_DRAFT);
      setQuizSelectedQuestionIds([]);
      setPageView('quiz_bank');
      loadQuizBank();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'An error occurred.' });
    } finally {
      setCreating(false);
    }
  };

  const handleClearQuizFilters = () => {
    setCurrentDraft({ classLevel: '', subject: '' });
  };

  const hasQuizFilters = !!(currentDraft.classLevel || currentDraft.subject);
  const hasBankFilters = !!(bankClassFilter || bankSubjectFilter || bankTypeFilter);

  return (
    <View style={s.root}>
      {/* Dynamic Sub-header */}
      <View style={s.topNav}>
        <View style={s.tabGroup}>
          <Pressable
            style={[s.tabBtn, pageView === 'creator' && s.tabBtnActive]}
            onPress={() => setPageView('creator')}
          >
            <Plus size={15} color={pageView === 'creator' ? '#4A90E2' : '#9A9AB0'} />
            <Text style={[s.tabBtnText, pageView === 'creator' && s.tabBtnTextActive]}>Create New Quiz</Text>
          </Pressable>
          <Pressable
            style={[s.tabBtn, pageView === 'quiz_bank' && s.tabBtnActive]}
            onPress={() => setPageView('quiz_bank')}
          >
            <Library size={15} color={pageView === 'quiz_bank' ? '#4A90E2' : '#9A9AB0'} />
            <Text style={[s.tabBtnText, pageView === 'quiz_bank' && s.tabBtnTextActive]}>Quiz Library</Text>
          </Pressable>
        </View>
      </View>

      {/* Main Container */}
      <ScrollView contentContainerStyle={s.content}>
        {/* Banner */}
        <View style={s.heroCard}>
          <View style={s.heroTextWrap}>
            <Text style={s.heroTitle}>
              {pageView === 'quiz_bank' ? 'Quiz Management' : 'Quiz Builder'}
            </Text>
            <Text style={s.heroSub}>
              {pageView === 'quiz_bank'
                ? 'Browse, edit, and assign quizzes created for your classes.'
                : 'Select questions from the question bank to create interactive quizzes for your students.'}
            </Text>
          </View>

          {pageView === 'quiz_bank' ? (
            <Pressable style={s.heroActionBtn} onPress={() => setPageView('creator')}>
              <Plus size={16} color="#fff" />
              <Text style={s.heroActionBtnText}>Create Quiz</Text>
            </Pressable>
          ) : (
            <Pressable style={s.heroActionBtnOutline} onPress={() => setPageView('quiz_bank')}>
              <Library size={16} color="#4A90E2" />
              <Text style={s.heroActionBtnTextOutline}>View Quizzes ({quizBank.length})</Text>
            </Pressable>
          )}
        </View>

        {/* Message Banner */}
        {message && (
          <View style={[s.msgBanner, message.type === 'error' ? s.msgError : s.msgSuccess]}>
            <Text style={[s.msgText, message.type === 'error' ? s.msgTextError : s.msgTextSuccess]}>
              {message.text}
            </Text>
          </View>
        )}

        {/* PAGE VIEW 1: QUIZ BANK */}
        {pageView === 'quiz_bank' ? (
          <View style={s.bankSection}>
            <View style={s.bankSearchRow}>
              <View style={s.searchWrap}>
                <Search size={16} color="#9A9AB0" />
                <TextInput
                  value={quizBankSearch}
                  onChangeText={setQuizBankSearch}
                  placeholder="Search quizzes by title, subject, standard..."
                  placeholderTextColor="#9A9AB0"
                  style={s.searchInput}
                />
                {quizBankSearch !== '' && (
                  <Pressable onPress={() => setQuizBankSearch('')}>
                    <X size={14} color="#9A9AB0" />
                  </Pressable>
                )}
              </View>
              <Pressable style={s.reloadBtn} onPress={loadQuizBank} disabled={loadingQuizBank}>
                <RotateCw size={16} color="#4A90E2" />
              </Pressable>
            </View>

            {loadingQuizBank ? (
              <View style={s.emptyBox}>
                <ActivityIndicator size="large" color="#4A90E2" />
                <Text style={s.emptyText}>Loading quizzes...</Text>
              </View>
            ) : filteredQuizBank.length === 0 ? (
              <View style={s.emptyBox}>
                <Trophy size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No Quizzes Found</Text>
                <Text style={s.emptyText}>
                  {quizBankSearch ? 'Try a different search query.' : 'Create your first quiz using the button above.'}
                </Text>
              </View>
            ) : (
              <View style={[s.quizGrid, isMobile && { flexDirection: 'column' }]}>
                {filteredQuizBank
                  .slice(quizBankPage * 12, (quizBankPage + 1) * 12)
                  .map((q) => {
                    const diff = (q.difficultyLevel as Difficulty) || 'Medium';
                    const diffCfg = DIFFICULTY_STYLE[diff] || DIFFICULTY_STYLE.Medium;
                    return (
                      <View key={q.id} style={[s.quizCard, isMobile && { width: '100%', maxWidth: '100%' }]}>
                        <View style={s.quizCardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.quizCardTitle} numberOfLines={1}>{q.title}</Text>
                            <View style={s.quizBadgeRow}>
                              {q.classLevel && (
                                <View style={s.quizChip}>
                                  <Text style={s.quizChipText}>{getStandardLabel(q.classLevel)}</Text>
                                </View>
                              )}
                              {q.subject && (
                                <View style={s.quizChipSubject}>
                                  <Text style={s.quizChipSubjectText}>{q.subject}</Text>
                                </View>
                              )}
                              <View style={[s.quizChipDiff, { backgroundColor: diffCfg.bg }]}>
                                <Text style={[s.quizChipDiffText, { color: diffCfg.color }]}>{diff}</Text>
                              </View>
                            </View>
                          </View>
                          <Pressable
                            style={s.editIconBtn}
                            onPress={() => setEditingQuizId(q.id)}
                            title="Edit Quiz"
                          >
                            <Pencil size={15} color="#4A90E2" />
                          </Pressable>
                        </View>

                        {q.description ? (
                          <Text style={s.quizCardDesc} numberOfLines={2}>{q.description}</Text>
                        ) : null}

                        <View style={s.quizCardFooter}>
                          <View style={s.quizMetaItem}>
                            <ListChecks size={13} color="#9A9AB0" />
                            <Text style={s.quizMetaText}>{q.totalQuestions || 0} Questions</Text>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            <Pressable
                              style={s.deleteIconBtn}
                              onPress={() => setConfirmDeleteQuiz(q)}
                              disabled={deletingQuizId === q.id}
                            >
                              {deletingQuizId === q.id ? (
                                <ActivityIndicator size="small" color="#DC2626" />
                              ) : (
                                <Trash2 size={15} color="#DC2626" />
                              )}
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })}
              </View>
            )}

            {/* Pagination for Quiz Bank */}
            {filteredQuizBank.length > 12 && (
              <View style={s.pageRow}>
                <Pressable
                  style={[s.pageBtn, quizBankPage === 0 && s.pageBtnDisabled]}
                  onPress={() => setQuizBankPage((p) => Math.max(0, p - 1))}
                  disabled={quizBankPage === 0}
                >
                  <ChevronLeft size={16} color={quizBankPage === 0 ? '#CBD5E1' : '#4A90E2'} />
                  <Text style={[s.pageBtnText, quizBankPage === 0 && s.pageBtnTextDisabled]}>Prev</Text>
                </Pressable>
                <Text style={s.pageInfo}>
                  Page {quizBankPage + 1} of {Math.ceil(filteredQuizBank.length / 12)}
                </Text>
                <Pressable
                  style={[s.pageBtn, (quizBankPage + 1) * 12 >= filteredQuizBank.length && s.pageBtnDisabled]}
                  onPress={() => setQuizBankPage((p) => p + 1)}
                  disabled={(quizBankPage + 1) * 12 >= filteredQuizBank.length}
                >
                  <Text style={[s.pageBtnText, (quizBankPage + 1) * 12 >= filteredQuizBank.length && s.pageBtnTextDisabled]}>Next</Text>
                  <ChevronRight size={16} color={(quizBankPage + 1) * 12 >= filteredQuizBank.length ? '#CBD5E1' : '#4A90E2'} />
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          /* PAGE VIEW 2: CREATOR FORM */
          <View style={[s.creatorLayout, isMobile && { flexDirection: 'column' }]}>
            {/* Left Box: Quiz Setup */}
            <View style={[s.formCard, isMobile && { width: '100%', minWidth: '100%' }]}>
              <Text style={s.formCardTitle}>1. Quiz Setup</Text>

              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>Title *</Text>
                <TextInput
                  value={currentDraft.title}
                  onChangeText={(v) => setCurrentDraft({ title: v })}
                  placeholder="e.g. Class 5 Mathematics Quick Quiz"
                  placeholderTextColor="#9A9AB0"
                  style={s.textInput}
                />
              </View>

              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>Description</Text>
                <TextInput
                  value={currentDraft.description}
                  onChangeText={(v) => setCurrentDraft({ description: v })}
                  placeholder="Optional brief instructions..."
                  placeholderTextColor="#9A9AB0"
                  multiline
                  numberOfLines={3}
                  style={[s.textInput, { height: 70, textAlignVertical: 'top' }]}
                />
              </View>

              <View style={s.rowTwo}>
                <View style={[s.inputGroup, { flex: 1, minWidth: 120 }]}>
                  <Text style={s.inputLabel}>Class / Standard</Text>
                  <Pressable style={s.selectInput} onPress={() => setSelectorField('quizClassLevel')}>
                    <Text style={currentDraft.classLevel ? s.selectText : s.selectPlaceholder} numberOfLines={1} ellipsizeMode="tail">
                      {currentDraft.classLevel ? getStandardLabel(currentDraft.classLevel) : 'Select Class'}
                    </Text>
                    <ChevronDown size={14} color="#9A9AB0" />
                  </Pressable>
                </View>
                <View style={[s.inputGroup, { flex: 1, minWidth: 120 }]}>
                  <Text style={s.inputLabel}>Subject</Text>
                  <Pressable style={s.selectInput} onPress={() => setSelectorField('quizSubject')}>
                    <Text style={currentDraft.subject ? s.selectText : s.selectPlaceholder} numberOfLines={1} ellipsizeMode="tail">
                      {currentDraft.subject || 'Select Subject'}
                    </Text>
                    <ChevronDown size={14} color="#9A9AB0" />
                  </Pressable>
                </View>
              </View>

              {/* Clear Filter Button */}
              {hasQuizFilters && (
                <Pressable style={s.clearBtnInline} onPress={handleClearQuizFilters}>
                  <X size={12} color="#DC2626" />
                  <Text style={s.clearBtnInlineText}>Clear Selection</Text>
                </Pressable>
              )}

              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>Difficulty Level</Text>
                <View style={s.diffRow}>
                  {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((d) => {
                    const active = currentDraft.difficultyLevel === d;
                    const cfg = DIFFICULTY_STYLE[d];
                    return (
                      <Pressable
                        key={d}
                        style={[s.diffBtn, active && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                        onPress={() => setCurrentDraft({ difficultyLevel: d })}
                      >
                        <Text style={[s.diffBtnText, active && { color: cfg.color, fontWeight: '800' }]}>{d}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View>
                <Pressable style={s.createSubmitBtn} onPress={handleCreate} disabled={creating}>
                  {creating ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Check size={16} color="#fff" />
                      <Text style={s.createSubmitText}>Publish Quiz</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>

            {/* Right Box: Question Selection Bank */}
            <View style={[s.bankCard, isMobile && { width: '100%', minWidth: '100%' }]}>
              <View style={s.bankHeader}>
                <Text style={s.formCardTitle}>2. Question Selection ({filteredQuestions.length})</Text>

                <View style={s.bankTabRow}>
                  <Pressable
                    style={[s.bankTab, bankTab === 'question' && s.bankTabActive]}
                    onPress={() => setBankTab('question')}
                  >
                    <Text style={[s.bankTabText, bankTab === 'question' && s.bankTabTextActive]}>Question Bank</Text>
                  </Pressable>
                  <Pressable
                    style={[s.bankTab, bankTab === 'selected' && s.bankTabActive]}
                    onPress={() => setBankTab('selected')}
                  >
                    <Text style={[s.bankTabText, bankTab === 'selected' && s.bankTabTextActive]}>
                      Selected ({currentSelectedIds.length})
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Question Bank Filters: Independent Class & Subject selectors */}
              {bankTab === 'question' && (
                <View style={s.bankFiltersCol}>
                  <View style={s.bankFiltersRow}>
                    <Pressable style={s.selectInputCompact} onPress={() => setSelectorField('bankClassLevel')}>
                      <Text style={bankClassFilter ? s.selectTextCompact : s.selectPlaceholderCompact} numberOfLines={1}>
                        {bankClassFilter ? getStandardLabel(bankClassFilter) : 'Class Level'}
                      </Text>
                      <ChevronDown size={13} color="#9A9AB0" />
                    </Pressable>

                    <Pressable style={s.selectInputCompact} onPress={() => setSelectorField('bankSubject')}>
                      <Text style={bankSubjectFilter ? s.selectTextCompact : s.selectPlaceholderCompact} numberOfLines={1}>
                        {bankSubjectFilter || 'Subject'}
                      </Text>
                      <ChevronDown size={13} color="#9A9AB0" />
                    </Pressable>

                    <Pressable style={s.selectInputCompact} onPress={() => setSelectorField('bankType')}>
                      <Text style={bankTypeFilter ? s.selectTextCompact : s.selectPlaceholderCompact} numberOfLines={1}>
                        {bankTypeFilter ? (QUIZ_TYPE_LABEL[bankTypeFilter] || bankTypeFilter) : 'Question Type'}
                      </Text>
                      <ChevronDown size={13} color="#9A9AB0" />
                    </Pressable>

                    {hasBankFilters && (
                      <Pressable style={s.clearBtnCompact} onPress={() => { setBankClassFilter(''); setBankSubjectFilter(''); setBankTypeFilter(''); }}>
                        <X size={13} color="#DC2626" />
                      </Pressable>
                    )}
                  </View>

                  <View style={s.bankSearchRow}>
                    <View style={s.bankSearchWrap}>
                      <Search size={14} color="#9A9AB0" />
                      <TextInput
                        value={questionBankSearch}
                        onChangeText={setQuestionBankSearch}
                        placeholder="Search questions..."
                        placeholderTextColor="#9A9AB0"
                        style={s.bankSearchInput}
                      />
                      {questionBankSearch !== '' && (
                        <Pressable onPress={() => setQuestionBankSearch('')}>
                          <X size={14} color="#9A9AB0" />
                        </Pressable>
                      )}
                    </View>

                    <Pressable style={s.selectAllBtn} onPress={handleSelectAll}>
                      <CheckSquare size={13} color="#4A90E2" />
                      <Text style={s.selectAllText}>Toggle All</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Question list */}
              {loadingQuestionBank ? (
                <View style={s.bankLoadingBox}>
                  <ActivityIndicator size="large" color="#4A90E2" />
                  <Text style={s.emptyText}>Loading question bank...</Text>
                </View>
              ) : bankTab === 'selected' ? (
                selectedQuestions.length === 0 ? (
                  <View style={s.emptyBox}>
                    <CheckSquare size={36} color="#CBD5E1" />
                    <Text style={s.emptyText}>No questions selected yet. Switch to Question Bank to add questions.</Text>
                  </View>
                ) : (
                  <ScrollView style={s.questionList}>
                    {selectedQuestions.map((q) => (
                      <View key={q.id} style={s.qItemRow}>
                        <View style={s.qItemMain}>
                          <Text style={s.qItemTitle}>{q.question_title || 'Untitled Question'}</Text>
                          <View style={s.qItemMetaRow}>
                            {q.class_level && (
                              <Text style={[s.qItemMetaTag, s.qItemClassTag]}>{getStandardLabel(q.class_level)}</Text>
                            )}
                            <Text style={s.qItemMetaTag}>{QUIZ_TYPE_LABEL[q.question_type] || q.question_type}</Text>
                            {q.subject && <Text style={s.qItemMetaTag}>{q.subject}</Text>}
                            <Text style={s.qItemMetaTag}>{q.points || 10} pts</Text>
                          </View>
                        </View>
                        <Pressable style={s.qPreviewBtn} onPress={() => handleOpenPreview(q)}>
                          <Eye size={14} color="#4A90E2" />
                        </Pressable>
                        <Pressable style={s.qRemoveBtn} onPress={() => toggleSelectQuestion(q.id)}>
                          <Minus size={14} color="#DC2626" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                )
              ) : filteredQuestions.length === 0 ? (
                <View style={s.emptyBox}>
                  <HelpIconFallback size={36} color="#CBD5E1" />
                  <Text style={s.emptyText}>No questions match your filter.</Text>
                </View>
              ) : (
                <ScrollView style={s.questionList}>
                  {filteredQuestions
                    .slice(bankPage * 20, (bankPage + 1) * 20)
                    .map((q) => {
                      const selected = quizSelectedQuestionIds.includes(q.id);
                      return (
                        <View key={q.id} style={[s.qItemRow, selected && s.qItemRowSelected]}>
                          <Pressable style={s.qItemCheck} onPress={() => toggleSelectQuestion(q.id)}>
                            <View style={[s.checkbox, selected && s.checkboxSelected]}>
                              {selected && <Check size={12} color="#fff" />}
                            </View>
                          </Pressable>
                          <View style={s.qItemMain}>
                            <Text style={s.qItemTitle}>{q.question_title || 'Untitled Question'}</Text>
                            <View style={s.qItemMetaRow}>
                              {q.class_level && (
                                <Text style={[s.qItemMetaTag, s.qItemClassTag]}>{getStandardLabel(q.class_level)}</Text>
                              )}
                              <Text style={s.qItemMetaTag}>{QUIZ_TYPE_LABEL[q.question_type] || q.question_type}</Text>
                              {q.subject && <Text style={s.qItemMetaTag}>{q.subject}</Text>}
                              <Text style={s.qItemMetaTag}>{q.points || 10} pts</Text>
                            </View>
                          </View>
                          <Pressable style={s.qPreviewBtn} onPress={() => handleOpenPreview(q)}>
                            <Eye size={14} color="#4A90E2" />
                          </Pressable>
                        </View>
                      );
                    })}
                </ScrollView>
              )}

              {/* Question Bank Pagination */}
              {bankTab === 'question' && filteredQuestions.length > 20 && (
                <View style={s.pageRow}>
                  <Pressable
                    style={[s.pageBtn, bankPage === 0 && s.pageBtnDisabled]}
                    onPress={() => setBankPage((p) => Math.max(0, p - 1))}
                    disabled={bankPage === 0}
                  >
                    <ChevronLeft size={16} color={bankPage === 0 ? '#CBD5E1' : '#4A90E2'} />
                    <Text style={[s.pageBtnText, bankPage === 0 && s.pageBtnTextDisabled]}>Prev</Text>
                  </Pressable>
                  <Text style={s.pageInfo}>
                    Page {bankPage + 1} of {Math.ceil(filteredQuestions.length / 20)}
                  </Text>
                  <Pressable
                    style={[s.pageBtn, (bankPage + 1) * 20 >= filteredQuestions.length && s.pageBtnDisabled]}
                    onPress={() => setBankPage((p) => p + 1)}
                    disabled={(bankPage + 1) * 20 >= filteredQuestions.length}
                  >
                    <Text style={[s.pageBtnText, (bankPage + 1) * 20 >= filteredQuestions.length && s.pageBtnTextDisabled]}>Next</Text>
                    <ChevronRight size={16} color={(bankPage + 1) * 20 >= filteredQuestions.length ? '#CBD5E1' : '#4A90E2'} />
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Selector Modal */}
      <SelectorModal
        visible={selectorField !== null}
        title={
          selectorField === 'quizClassLevel' || selectorField === 'bankClassLevel'
            ? 'Select Class Level'
            : selectorField === 'quizSubject' || selectorField === 'bankSubject'
            ? 'Select Subject'
            : 'Select Question Type'
        }
        options={
          selectorField === 'quizClassLevel'
            ? [{ label: 'Select Class', value: '' }, ...classOptions]
            : selectorField === 'bankClassLevel'
            ? classOptions
            : selectorField === 'quizSubject' || selectorField === 'bankSubject'
            ? subjectOptions
            : bankTypeOptions
        }
        selectedValue={
          selectorField === 'quizClassLevel'
            ? currentDraft.classLevel
            : selectorField === 'quizSubject'
            ? currentDraft.subject
            : selectorField === 'bankClassLevel'
            ? bankClassFilter
            : selectorField === 'bankSubject'
            ? bankSubjectFilter
            : bankTypeFilter
        }
        anyLabel={
          selectorField === 'quizClassLevel' || selectorField === 'bankClassLevel'
            ? 'Any Class'
            : selectorField === 'quizSubject' || selectorField === 'bankSubject'
            ? 'Any Subject'
            : 'All Types'
        }
        onClose={() => setSelectorField(null)}
        onSelect={(val) => {
          if (selectorField === 'quizClassLevel') {
            setCurrentDraft({ classLevel: val, subject: '' });
          } else if (selectorField === 'quizSubject') {
            setCurrentDraft({ subject: val });
          } else if (selectorField === 'bankClassLevel') {
            setBankClassFilter(val);
          } else if (selectorField === 'bankSubject') {
            setBankSubjectFilter(val);
          } else if (selectorField === 'bankType') {
            setBankTypeFilter(val);
          }
          setSelectorField(null);
        }}
      />

      {/* Edit Quiz Modal */}
      {editingQuizId && (
        <QuizEditorModal
          visible={!!editingQuizId}
          quizId={editingQuizId}
          apiFetch={apiFetch}
          user={user}
          onClose={() => {
            setEditingQuizId(null);
            loadQuizBank();
          }}
          onUpdated={() => {
            loadQuizBank();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={confirmDeleteQuiz !== null}
        title="Delete Quiz"
        itemName={confirmDeleteQuiz?.title}
        loading={deletingQuizId !== null}
        onConfirm={async () => {
          if (confirmDeleteQuiz) {
            await handleDeleteQuiz(confirmDeleteQuiz.id);
            setConfirmDeleteQuiz(null);
          }
        }}
        onClose={() => setConfirmDeleteQuiz(null)}
      />

      {/* Question Preview Modal */}
      <Modal
        visible={previewQuestion !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewQuestion(null)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.pvModalCard, isMobile && { width: '95%', maxHeight: '85%' }]}>
            <View style={s.pvModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={s.pvHeaderIconWrap}>
                  <Eye size={18} color="#4A90E2" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.pvModalTitle}>Question Preview</Text>
                  {previewQuestion?.quiz_title ? (
                    <Text style={s.pvModalSubtitle} numberOfLines={1}>
                      Source Quiz: {previewQuestion.quiz_title}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Pressable onPress={() => setPreviewQuestion(null)} style={s.pvModalCloseBtn}>
                <X size={18} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView style={s.pvModalScroll} contentContainerStyle={s.pvModalContent}>
              {loadingPreview && (
                <View style={s.pvLoadingRow}>
                  <ActivityIndicator size="small" color="#4A90E2" />
                  <Text style={s.pvLoadingText}>Loading complete details...</Text>
                </View>
              )}

              <Text style={s.pvQuestionTitle}>{previewQuestion?.question_title || 'Untitled Question'}</Text>

              <View style={s.pvBadgeRow}>
                {previewQuestion?.class_level ? (
                  <View style={s.quizChip}>
                    <Text style={s.quizChipText}>{getStandardLabel(previewQuestion.class_level)}</Text>
                  </View>
                ) : null}
                {previewQuestion?.subject ? (
                  <View style={s.quizChipSubject}>
                    <Text style={s.quizChipSubjectText}>{previewQuestion.subject}</Text>
                  </View>
                ) : null}
                <View style={s.pvTypeChip}>
                  <Text style={s.pvTypeChipText}>
                    {QUIZ_TYPE_LABEL[previewQuestion?.question_type || ''] || previewQuestion?.question_type}
                  </Text>
                </View>
              </View>

              <View style={s.pvStatBar}>
                <View style={s.pvStatItem}>
                  <Zap size={13} color="#E6A817" fill="#E6A817" />
                  <Text style={s.pvStatText}>{previewQuestion?.points ?? 10} points</Text>
                </View>
                <View style={s.pvStatItem}>
                  <Clock size={13} color="#64748B" />
                  <Text style={s.pvStatText}>{previewQuestion?.time_limit_seconds ?? 30}s time limit</Text>
                </View>
              </View>

              {previewQuestion?.question_instruction ? (
                <View style={s.pvInstructionBox}>
                  <Text style={s.pvInstructionLabel}>Instruction</Text>
                  <Text style={s.pvInstructionText}>{previewQuestion.question_instruction}</Text>
                </View>
              ) : null}

              {/* Media & Question Data Details */}
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
                                    <Check size={12} color="#16a34a" />
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
              {previewQuestion && pageView === 'creator' && (
                <Pressable
                  style={[
                    s.pvToggleSelectBtn,
                    quizSelectedQuestionIds.includes(previewQuestion.id) ? s.pvToggleRemoveBtn : s.pvToggleAddBtn,
                  ]}
                  onPress={() => toggleSelectQuestion(previewQuestion.id)}
                >
                  {quizSelectedQuestionIds.includes(previewQuestion.id) ? (
                    <>
                      <Minus size={14} color="#DC2626" />
                      <Text style={s.pvToggleRemoveText}>Remove from Quiz</Text>
                    </>
                  ) : (
                    <>
                      <Plus size={14} color="#16a34a" />
                      <Text style={s.pvToggleAddText}>Add to Quiz</Text>
                    </>
                  )}
                </Pressable>
              )}
              <Pressable style={s.pvCloseActionBtn} onPress={() => setPreviewQuestion(null)}>
                <Text style={s.pvCloseActionText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function HelpIconFallback({ size = 20, color = '#9A9AB0' }: { size?: number; color?: string }) {
  return <Layers size={size} color={color} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FF' },
  topNav: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F8',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabGroup: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F0F0F8',
  },
  tabBtnActive: { backgroundColor: '#D6EAFF' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#9A9AB0' },
  tabBtnTextActive: { color: '#1A4DA2', fontWeight: '800' },

  content: { padding: 16, gap: 16 },

  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    flexWrap: 'wrap',
    gap: 12,
  },
  heroTextWrap: { flex: 1, minWidth: 200, gap: 4 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  heroSub: { fontSize: 13, color: '#9A9AB0', lineHeight: 19 },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  heroActionBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  heroActionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#4A90E2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  heroActionBtnTextOutline: { color: '#4A90E2', fontWeight: '800', fontSize: 13 },

  msgBanner: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  msgSuccess: { backgroundColor: '#D6F5D6', borderWidth: 1, borderColor: '#7DC67A' },
  msgError: { backgroundColor: '#FFE8E8', borderWidth: 1, borderColor: '#FF7043' },
  msgText: { fontSize: 13, fontWeight: '600' },
  msgTextSuccess: { color: '#1A6B1A' },
  msgTextError: { color: '#B91C1C' },

  bankSection: { gap: 16 },
  bankSearchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1a1a2e' },
  reloadBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  quizGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  quizCard: {
    flex: 1,
    minWidth: 280,
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quizCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  quizCardTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  quizBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  quizChip: { backgroundColor: '#F0F0F8', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  quizChipText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  quizChipSubject: { backgroundColor: '#E0F2FE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  quizChipSubjectText: { fontSize: 11, fontWeight: '700', color: '#0369A1' },
  quizChipDiff: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  quizChipDiffText: { fontSize: 11, fontWeight: '800' },
  editIconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F0F8', alignItems: 'center', justifyContent: 'center' },
  deleteIconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFE8E8', alignItems: 'center', justifyContent: 'center' },
  quizCardDesc: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  quizCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  quizMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  quizMetaText: { fontSize: 12, fontWeight: '600', color: '#9A9AB0' },

  creatorLayout: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', width: '100%', alignItems: 'flex-start' },
  formCard: {
    flex: 1,
    minWidth: 300,
    minHeight: 520,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    rowGap: 14,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    alignSelf: 'flex-start',
  },
  formCardTitle: { fontSize: 16, fontWeight: '900', color: '#1a1a2e' },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#9A9AB0' },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1a1a2e',
  },
  rowTwo: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    overflow: 'hidden',
  },
  selectText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
  selectPlaceholder: { flex: 1, fontSize: 13, color: '#9A9AB0' },

  clearBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  clearBtnInlineText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },

  diffRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  diffBtn: {
    flex: 1,
    minWidth: 70,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    alignItems: 'center',
  },
  diffBtnText: { fontSize: 12, fontWeight: '600', color: '#9A9AB0' },

  summaryCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  summaryTitle: { fontSize: 11, fontWeight: '800', color: '#0369A1', textTransform: 'uppercase' },
  summaryCount: { fontSize: 28, fontWeight: '900', color: '#0284C7' },
  summarySub: { fontSize: 11, color: '#0369A1' },

  createSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 4,
  },
  createSubmitText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  bankCard: {
    flex: 1.4,
    minWidth: 300,
    minHeight: 520,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    alignSelf: 'flex-start',
  },
  bankLoadingBox: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  bankHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  bankTabRow: { flexDirection: 'row', gap: 4, backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3, flexWrap: 'wrap' },
  bankTab: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  bankTabActive: { backgroundColor: '#fff' },
  bankTabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  bankTabTextActive: { fontWeight: '800', color: '#4A90E2' },

  bankFiltersCol: { gap: 10 },
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
  selectPlaceholderCompact: { fontSize: 11, color: '#9A9AB0' },
  clearBtnCompact: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 7, alignItems: 'center', justifyContent: 'center' },

  bankSearchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  bankSearchWrap: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bankSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1a1a2e',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F0F7FF', borderRadius: 10 },
  selectAllText: { fontSize: 12, fontWeight: '700', color: '#4A90E2' },

  questionList: { maxHeight: 420, minHeight: 250 },
  qItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  qItemRowSelected: { backgroundColor: '#F0F7FF' },
  qItemCheck: { padding: 2 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  qItemMain: { flex: 1, gap: 4, minWidth: 0 },
  qItemTitle: { fontSize: 13, fontWeight: '600', color: '#1a1a2e', lineHeight: 18, flexShrink: 1 },
  qItemMetaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  qItemMetaTag: { fontSize: 11, color: '#64748B', backgroundColor: '#F1F5F9', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  qItemClassTag: { color: '#1D4ED8', backgroundColor: '#EFF6FF', fontWeight: '600' },
  qRemoveBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFE8E8', alignItems: 'center', justifyContent: 'center' },
  qPreviewBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0F7FF', alignItems: 'center', justifyContent: 'center' },

  emptyBox: { minHeight: 250, padding: 40, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  emptyText: { fontSize: 13, color: '#9A9AB0', textAlign: 'center' },

  pageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0F7FF' },
  pageBtnDisabled: { backgroundColor: '#F8FAFC' },
  pageBtnText: { fontSize: 12, fontWeight: '700', color: '#4A90E2' },
  pageBtnTextDisabled: { color: '#CBD5E1' },
  pageInfo: { fontSize: 12, color: '#9A9AB0', fontWeight: '600' },

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
  pvModalSubtitle: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  pvModalCloseBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F1F5F9' },
  pvModalScroll: { maxHeight: 500 },
  pvModalContent: { padding: 20, gap: 14 },
  pvLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  pvLoadingText: { fontSize: 12, color: '#4A90E2', fontWeight: '600' },
  pvQuestionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', lineHeight: 22 },
  pvBadgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  pvTypeChip: { backgroundColor: '#F0F7FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pvTypeChipText: { fontSize: 11, fontWeight: '700', color: '#4A90E2' },
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
  pvPairArrow: { fontSize: 14, color: '#4A90E2', fontWeight: '800' },
  pvExplanationBox: { backgroundColor: '#F0F7FF', borderColor: '#BAE6FD', borderWidth: 1, padding: 12, borderRadius: 10 },
  pvExplanationText: { fontSize: 13, color: '#0369A1', lineHeight: 18 },
  pvModalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FAFCFF' },
  pvCloseActionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#E2E8F0' },
  pvCloseActionText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  pvToggleSelectBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  pvToggleAddBtn: { backgroundColor: '#DCFCE7' },
  pvToggleAddText: { fontSize: 13, fontWeight: '700', color: '#15803D' },
  pvToggleRemoveBtn: { backgroundColor: '#FEE2E2' },
  pvToggleRemoveText: { fontSize: 13, fontWeight: '700', color: '#B91C1C' },
});
