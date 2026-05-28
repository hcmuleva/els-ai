import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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
} from 'lucide-react-native';

import { STANDARD_OPTIONS, getStandardLabel } from '../../src/constants/standards';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Radius, Shadow } from '../../src/theme';
import SelectorModal from '../../src/components/SelectorModal';

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
  | 'fill_blank';
type Difficulty = 'Easy' | 'Medium' | 'Hard';
type CreationMode = 'quiz' | 'exam';
type BankTab = 'question' | 'selected';
type SelectorField = 'classLevel' | 'subject';

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
  difficultyLevel: Difficulty;
  hasTimeLimit: boolean;
  timeLimitMinutes: string;
};
type SubjectCatalogItem = {
  classLevel: string;
  subject: string;
};

const QUIZ_TYPE_LABELS: Record<string, string> = {
  drag_drop_match: 'Drag & Drop',
  guess_image: 'Guess Image',
  guess_audio: 'Guess Audio',
  true_false: 'True / False',
  single_choice: 'Single Choice',
  multi_choice: 'Multi Choice',
  drag_drop: 'Drag & Drop',
  image_select: 'Guess Image',
  sound_match: 'Guess Audio',
  memory_game: 'Multi Choice',
  logico: 'Logico',
  memory_match: 'Memory Match',
  fill_blank: 'Fill in Blank',
};

const INITIAL_DRAFT: AssessmentDraft = {
  title: '',
  description: '',
  classLevel: '',
  subject: '',
  difficultyLevel: 'Easy',
  hasTimeLimit: false,
  timeLimitMinutes: '10',
};

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

const DIFF_CONFIG: Record<Difficulty, { color: string; bg: string; label: string }> = {
  Easy:   { color: '#16a34a', bg: '#dcfce7', label: 'Easy' },
  Medium: { color: '#d97706', bg: '#fef3c7', label: 'Medium' },
  Hard:   { color: '#dc2626', bg: '#fee2e2', label: 'Hard' },
};

const QUESTION_TYPE_FILTERS = [
  { value: '', label: 'All Types' },
  { value: 'single_choice',  label: 'Single Choice' },
  { value: 'multi_choice',   label: 'Multi Choice' },
  { value: 'true_false',     label: 'True / False' },
  { value: 'drag_drop_match',label: 'Drag & Drop' },
  { value: 'guess_image',    label: 'Guess Image' },
  { value: 'guess_audio',    label: 'Guess Audio' },
  { value: 'logico',         label: 'Logico' },
  { value: 'memory_match',   label: 'Memory Match' },
  { value: 'fill_blank',     label: 'Fill in Blank' },
];

const PAGE_SIZE = 10;

function normalizeQuestionType(type: string): QuizType {
  if (type === 'drag_drop' || type === 'drag_drop_match') return 'drag_drop_match';
  if (type === 'image_select' || type === 'guess_image') return 'guess_image';
  if (type === 'sound_match' || type === 'guess_audio') return 'guess_audio';
  if (type === 'memory_game' || type === 'multi_choice') return 'multi_choice';
  if (type === 'true_false') return 'true_false';
  if (type === 'single_choice') return 'single_choice';
  if (type === 'logico') return 'logico';
  if (type === 'memory_match') return 'memory_match';
  if (type === 'fill_blank' || type === 'fill_in_blank') return 'fill_blank';
  return 'single_choice';
}

function inferQuizType(questions: QuestionBankItem[]): QuizType {
  if (questions.length === 0) return 'single_choice';
  return normalizeQuestionType(questions[0].question_type || 'single_choice');
}

function QuestionTypeIcon({ type, size = 14, color = '#5A6A8A' }: { type: string; size?: number; color?: string }) {
  const norm = normalizeQuestionType(type);
  if (norm === 'drag_drop_match') return <SplitSquareHorizontal size={size} color={color} />;
  if (norm === 'guess_image')     return <Eye size={size} color={color} />;
  if (norm === 'guess_audio')     return <Volume2 size={size} color={color} />;
  if (norm === 'true_false')      return <CheckSquare size={size} color={color} />;
  if (norm === 'multi_choice')    return <ListChecks size={size} color={color} />;
  if (norm === 'logico')          return <Puzzle size={size} color={color} />;
  if (norm === 'memory_match')    return <Zap size={size} color={color} />;
  if (norm === 'fill_blank')      return <PenLine size={size} color={color} />;
  return <Layers size={size} color={color} />;
}

export default function QuizExamCreatorScreen() {
  const { user, apiFetch } = useAuth();
  const [activeMode, setActiveMode]                       = useState<CreationMode>('quiz');
  const [bankTab, setBankTab]                             = useState<BankTab>('question');
  const [questionBankSearch, setQuestionBankSearch]       = useState('');
  const [bankTypeFilter, setBankTypeFilter]               = useState('');
  const [loadingQuestionBank, setLoadingQuestionBank]     = useState(false);
  const [creating, setCreating]                           = useState(false);
  const [selectorField, setSelectorField]                 = useState<SelectorField | null>(null);
  const [bankPage, setBankPage]                           = useState(0);
  const [viewQuestion, setViewQuestion]                   = useState<QuestionBankItem | null>(null);
  const [questionBank, setQuestionBank]                   = useState<QuestionBankItem[]>([]);
  const [quizDraft, setQuizDraft]                         = useState<AssessmentDraft>(INITIAL_DRAFT);
  const [examDraft, setExamDraft]                         = useState<AssessmentDraft>(INITIAL_DRAFT);
  const [quizSelectedQuestionIds, setQuizSelectedQuestionIds] = useState<string[]>([]);
  const [examSelectedQuestionIds, setExamSelectedQuestionIds] = useState<string[]>([]);
  const [message, setMessage]                             = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [subjectCatalogItems, setSubjectCatalogItems]     = useState<SubjectCatalogItem[]>([]);

  const isTeacherView = user?.activeRole === 'teacher' || user?.activeRole === 'admin' || user?.activeRole === 'superadmin';

  const currentDraft          = activeMode === 'quiz' ? quizDraft : examDraft;
  const currentSelectedIds    = activeMode === 'quiz' ? quizSelectedQuestionIds : examSelectedQuestionIds;

  const setCurrentDraft = (patch: Partial<AssessmentDraft>) => {
    if (activeMode === 'quiz') { setQuizDraft((c) => ({ ...c, ...patch })); return; }
    setExamDraft((c) => ({ ...c, ...patch }));
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
            }))
            .filter((item: SubjectCatalogItem) => item.classLevel && item.subject),
        );
      }
    } catch { /* silently fail */ }
  }, [apiFetch, isTeacherView]);

  const loadQuestionBank = useCallback(async () => {
    if (!isTeacherView) return;
    setLoadingQuestionBank(true);
    try {
      const res = await apiFetch('/question-bank?limit=300');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to load question bank');
      const payload = await res.json();
      setQuestionBank(payload.questions || []);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load question bank' });
    } finally {
      setLoadingQuestionBank(false);
    }
  }, [apiFetch, isTeacherView]);

  useFocusEffect(
    useCallback(() => {
      loadSubjectCatalog();
      loadQuestionBank();
    }, [loadSubjectCatalog, loadQuestionBank]),
  );

  const classOptions   = useMemo(() => STANDARD_OPTIONS.map((item) => item.value), []);
  const subjectOptions = useMemo(
    () => [
      ...new Set(
        subjectCatalogItems
          .filter((item) => !currentDraft.classLevel || item.classLevel === currentDraft.classLevel)
          .map((item) => item.subject),
      ),
    ].sort((a, b) => a.localeCompare(b)),
    [currentDraft.classLevel, subjectCatalogItems],
  );

  const filteredQuestionBank = useMemo(() => {
    const keyword = questionBankSearch.trim().toLowerCase();
    return questionBank.filter((q) => {
      if (currentDraft.classLevel && q.class_level !== currentDraft.classLevel) return false;
      if (currentDraft.subject && q.subject !== currentDraft.subject) return false;
      if (bankTypeFilter && normalizeQuestionType(q.question_type) !== bankTypeFilter) return false;
      if (!keyword) return true;
      return [q.quiz_title, q.question_title, q.question_instruction, q.question_type]
        .filter(Boolean).join(' ').toLowerCase().includes(keyword);
    });
  }, [currentDraft.classLevel, currentDraft.subject, bankTypeFilter, questionBank, questionBankSearch]);

  const selectedQuestionMap = useMemo(() => {
    const map = new Map<string, QuestionBankItem>();
    questionBank.forEach((q) => map.set(q.id, q));
    return map;
  }, [questionBank]);

  const selectedQuestions = useMemo(
    () => currentSelectedIds.map((id) => selectedQuestionMap.get(id)).filter((q): q is QuestionBankItem => Boolean(q)),
    [currentSelectedIds, selectedQuestionMap],
  );

  const selectedPointsTotal = useMemo(
    () => selectedQuestions.reduce((sum, q) => sum + (Number(q.points) || 0), 0),
    [selectedQuestions],
  );

  const toggleQuestionSelection = (questionId: string) => {
    const updater = (current: string[]) =>
      current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId];
    if (activeMode === 'quiz') { setQuizSelectedQuestionIds(updater); return; }
    setExamSelectedQuestionIds(updater);
  };

  const createAssessment = async () => {
    if (!currentDraft.title.trim()) {
      setMessage({ type: 'error', text: `${activeMode === 'quiz' ? 'Quiz' : 'Exam'} title is required.` });
      return;
    }
    if (currentSelectedIds.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one question from Question Bank.' });
      return;
    }
    if (currentDraft.hasTimeLimit) {
      const minutes = Number(currentDraft.timeLimitMinutes);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        setMessage({ type: 'error', text: 'Enter a valid time limit in minutes.' });
        return;
      }
    }

    setCreating(true);
    setMessage(null);
    try {
      const selected = currentSelectedIds.map((id) => selectedQuestionMap.get(id)).filter((q): q is QuestionBankItem => Boolean(q));
      const createRes = await apiFetch('/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          title: currentDraft.title.trim(),
          description: currentDraft.description.trim() || undefined,
          classLevel: currentDraft.classLevel || undefined,
          subject: currentDraft.subject || undefined,
          quizType: inferQuizType(selected),
          difficultyLevel: currentDraft.difficultyLevel,
          isPublished: activeMode === 'quiz',
          isAiGenerated: false,
          theme: {
            colors: { primary: '#1d4ed8', background: '#eff6ff' },
            settings: {
              assessmentType: activeMode,
              hasTimeLimit: currentDraft.hasTimeLimit,
              timeLimitMinutes: currentDraft.hasTimeLimit ? Number(currentDraft.timeLimitMinutes) : null,
              pointPolicy: activeMode === 'exam' ? 'use_question_points' : 'ignore_question_points',
            },
          },
        }),
      });

      if (!createRes.ok) throw new Error((await createRes.json().catch(() => ({}))).message || `Failed to create ${activeMode}`);

      const createdAssessment = await createRes.json();
      const createdQuizId = String(createdAssessment.id || '');
      if (!createdQuizId) throw new Error('Created item id not returned from server.');

      let addedQuestionCount = 0;
      const failedQuestionIds: string[] = [];

      for (const sourceQuestionId of currentSelectedIds) {
        const reuseRes = await apiFetch(`/quizzes/${createdQuizId}/questions/reuse`, {
          method: 'POST',
          body: JSON.stringify({ sourceQuestionId }),
        });
        if (!reuseRes.ok) { failedQuestionIds.push(sourceQuestionId); continue; }
        addedQuestionCount += 1;
        if (activeMode === 'quiz') {
          const reusedQuestion = await reuseRes.json();
          const reusedQuestionId = String(reusedQuestion.id || '');
          if (reusedQuestionId) {
            await apiFetch(`/questions/${reusedQuestionId}`, {
              method: 'PATCH',
              body: JSON.stringify({ points: 0 }),
            });
          }
        }
      }

      const verifyRes = await apiFetch(`/quizzes/${createdQuizId}`);
      if (!verifyRes.ok) throw new Error('Quiz/Exam was created but failed to verify attached questions.');
      const verifyPayload = await verifyRes.json().catch(() => ({}));
      const attachedQuestions = Array.isArray(verifyPayload.questions) ? verifyPayload.questions.length : addedQuestionCount;

      if (attachedQuestions === 0) throw new Error('Created successfully, but no selected questions were attached. Please retry question selection.');

      if (activeMode === 'quiz') { setQuizDraft(INITIAL_DRAFT); setQuizSelectedQuestionIds([]); }
      else { setExamDraft(INITIAL_DRAFT); setExamSelectedQuestionIds([]); }
      setBankTab('question');
      const successMsg = {
        type: 'success' as const,
        text: activeMode === 'quiz'
          ? `Quiz created and published with ${attachedQuestions} question(s).${failedQuestionIds.length ? ` ${failedQuestionIds.length} failed to attach.` : ''}`
          : `Exam created with ${attachedQuestions} question(s), points preserved.${failedQuestionIds.length ? ` ${failedQuestionIds.length} failed to attach.` : ''}`,
      };
      setMessage(successMsg);
      setTimeout(() => setMessage(null), 4000);
    } catch (error) {
      const errMsg = { type: 'error' as const, text: error instanceof Error ? error.message : `Failed to create ${activeMode}` };
      setMessage(errMsg);
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setCreating(false);
    }
  };

  const selectorOptions = selectorField === 'classLevel' ? classOptions : subjectOptions;
  const selectorTitle   = selectorField === 'classLevel' ? 'Select Standard' : 'Select Subject';

  const applySelectorValue = (value: string) => {
    if (selectorField === 'classLevel') setCurrentDraft({ classLevel: value, subject: '' });
    else if (selectorField === 'subject') setCurrentDraft({ subject: value });
    setSelectorField(null);
  };

  const rowsToRender   = bankTab === 'question' ? filteredQuestionBank : selectedQuestions;
  const totalPages     = Math.max(1, Math.ceil(rowsToRender.length / PAGE_SIZE));
  const pagedRows      = rowsToRender.slice(bankPage * PAGE_SIZE, (bankPage + 1) * PAGE_SIZE);

  if (!isTeacherView) {
    return (
      <View style={s.container}>
        <View style={s.content}>
          <Text style={s.pageTitle}>Quiz / Exam Creator</Text>
          <Text style={s.errorText}>You do not have permission to create quizzes or exams.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* ── Page Header ── */}
      <View style={s.pageHeader}>
        <View style={s.pageHeaderLeft}>
          <Text style={s.pageTitle}>Assessment Creator</Text>
          <Text style={s.pageSubtitle}>Build quizzes & exams from your question bank</Text>
        </View>
        <View style={s.pageHeaderIcon}>
          {activeMode === 'quiz' ? <Trophy size={28} color="#4A90E2" /> : <GraduationCap size={28} color="#9B8EC4" />}
        </View>
      </View>

      {/* ── Mode Tabs ── */}
      <View style={s.modeTabs}>
        <Pressable
          style={[s.modeTab, activeMode === 'quiz' && s.modeTabActive]}
          onPress={() => { setActiveMode('quiz'); setBankTab('question'); }}
        >
          <Trophy size={16} color={activeMode === 'quiz' ? '#4A90E2' : '#9A9AB0'} />
          <Text style={[s.modeTabText, activeMode === 'quiz' && s.modeTabTextActive]}>Create Quiz</Text>
        </Pressable>
        <Pressable
          style={[s.modeTab, activeMode === 'exam' && s.modeTabExam]}
          onPress={() => { setActiveMode('exam'); setBankTab('question'); }}
        >
          <GraduationCap size={16} color={activeMode === 'exam' ? '#9B8EC4' : '#9A9AB0'} />
          <Text style={[s.modeTabText, activeMode === 'exam' && s.modeTabTextExam]}>Create Exam</Text>
        </Pressable>
      </View>

      {/* ── Create Form Card ── */}
      <View style={s.card}>
        <View style={s.cardHeaderRow}>
          <View style={[s.cardHeaderIcon, { backgroundColor: activeMode === 'quiz' ? '#D6EAFF' : '#EDE4FF' }]}>
            {activeMode === 'quiz' ? <PenLine size={18} color="#4A90E2" /> : <BookOpen size={18} color="#9B8EC4" />}
          </View>
          <View>
            <Text style={s.cardTitle}>{activeMode === 'quiz' ? 'Quiz Details' : 'Exam Details'}</Text>
            <Text style={s.cardSubtitle}>{activeMode === 'quiz' ? 'Published immediately for students' : 'Graded assessment with points'}</Text>
          </View>
        </View>

        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>{activeMode === 'quiz' ? 'Quiz Title' : 'Exam Title'} *</Text>
          <TextInput
            value={currentDraft.title}
            onChangeText={(title) => setCurrentDraft({ title })}
            placeholder={activeMode === 'quiz' ? 'e.g. Chapter 3 Review' : 'e.g. Mid-Term Exam 2025'}
            style={s.input}
            placeholderTextColor="#A0A8C0"
          />
        </View>

        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Description</Text>
          <TextInput
            value={currentDraft.description}
            onChangeText={(description) => setCurrentDraft({ description })}
            placeholder="Optional description"
            style={[s.input, s.multilineInput]}
            multiline
            placeholderTextColor="#A0A8C0"
          />
        </View>

        <View style={s.row}>
          <View style={[s.fieldGroup, { flex: 1 }]}>
            <Text style={s.fieldLabel}>Standard</Text>
            <Pressable style={s.dropdownField} onPress={() => setSelectorField('classLevel')}>
              <Text style={currentDraft.classLevel ? s.dropdownText : s.dropdownPlaceholder}>
                {currentDraft.classLevel ? getStandardLabel(currentDraft.classLevel) : 'Select Standard'}
              </Text>
              <ChevronDown size={14} color="#9A9AB0" />
            </Pressable>
          </View>
          <View style={[s.fieldGroup, { flex: 1 }]}>
            <Text style={s.fieldLabel}>Subject</Text>
            <Pressable
              style={[s.dropdownField, !currentDraft.classLevel && s.dropdownFieldDisabled]}
              onPress={() => { if (currentDraft.classLevel) setSelectorField('subject'); }}
              disabled={!currentDraft.classLevel}
            >
              <Text style={currentDraft.subject ? s.dropdownText : s.dropdownPlaceholder}>
                {currentDraft.subject || (currentDraft.classLevel ? 'Select Subject' : 'Select class first')}
              </Text>
              <ChevronDown size={14} color="#9A9AB0" />
            </Pressable>
          </View>
        </View>

        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Difficulty</Text>
          <View style={s.chipsRow}>
            {DIFFICULTIES.map((diff) => {
              const cfg = DIFF_CONFIG[diff];
              const isActive = currentDraft.difficultyLevel === diff;
              return (
                <Pressable
                  key={diff}
                  style={[s.diffChip, isActive && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                  onPress={() => setCurrentDraft({ difficultyLevel: diff })}
                >
                  {isActive && <Zap size={11} color={cfg.color} fill={cfg.color} />}
                  <Text style={[s.diffChipText, isActive && { color: cfg.color }]}>{cfg.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          style={s.checkboxRow}
          onPress={() => setCurrentDraft({ hasTimeLimit: !currentDraft.hasTimeLimit })}
        >
          <View style={[s.checkbox, currentDraft.hasTimeLimit && s.checkboxChecked]}>
            {currentDraft.hasTimeLimit && <Check size={11} color="#fff" />}
          </View>
          <Clock size={14} color="#5A6A8A" />
          <Text style={s.checkboxLabel}>Add time limit</Text>
        </Pressable>

        {currentDraft.hasTimeLimit && (
          <View style={s.fieldGroup}>
            <TextInput
              value={currentDraft.timeLimitMinutes}
              onChangeText={(timeLimitMinutes) => setCurrentDraft({ timeLimitMinutes })}
              placeholder="Time in minutes"
              keyboardType="numeric"
              style={s.input}
              placeholderTextColor="#A0A8C0"
            />
          </View>
        )}

        {/* Summary */}
        <View style={[s.summaryCard, activeMode === 'exam' && s.summaryCardExam]}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Questions selected</Text>
            <Text style={s.summaryValue}>{currentSelectedIds.length}</Text>
          </View>
          {activeMode === 'exam' ? (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Total points</Text>
              <Text style={s.summaryValue}>{selectedPointsTotal}</Text>
            </View>
          ) : (
            <View style={s.summaryRow}>
              <Text style={s.summaryNote}>Quiz mode: question points are ignored</Text>
            </View>
          )}
        </View>

        <Pressable style={[s.createBtn, activeMode === 'exam' && s.createBtnExam]} onPress={createAssessment} disabled={creating}>
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              {activeMode === 'quiz' ? <Trophy size={16} color="#fff" /> : <GraduationCap size={16} color="#fff" />}
              <Text style={s.createBtnText}>{activeMode === 'quiz' ? 'Create & Publish Quiz' : 'Create Exam'}</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* ── Question Bank Card ── */}
      <View style={s.card}>
        <View style={s.bankHeaderRow}>
          <View>
            <Text style={s.cardTitle}>Question Bank</Text>
            <Text style={s.cardSubtitle}>{questionBank.length} questions available</Text>
          </View>
          <Pressable style={s.refreshBtn} onPress={loadQuestionBank} disabled={loadingQuestionBank}>
            {loadingQuestionBank
              ? <ActivityIndicator size="small" color="#4A90E2" />
              : <RotateCw size={16} color="#4A90E2" />}
          </Pressable>
        </View>

        {/* Search */}
        <View style={s.searchRow}>
          <Search size={15} color="#9A9AB0" />
          <TextInput
            value={questionBankSearch}
            onChangeText={setQuestionBankSearch}
            placeholder="Search questions…"
            style={s.searchInput}
            placeholderTextColor="#A0A8C0"
          />
          {questionBankSearch !== '' && (
            <Pressable onPress={() => { setQuestionBankSearch(''); setBankPage(0); }}>
              <X size={15} color="#9A9AB0" />
            </Pressable>
          )}
        </View>

        {/* Question type filter chips */}
        <View>
          <View style={s.filterRow}>
            <Filter size={13} color="#5A6A8A" />
            <Text style={s.filterLabel}>Filter by type</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeFilterChips}>
            {QUESTION_TYPE_FILTERS.map((f) => {
              const isActive = bankTypeFilter === f.value;
              return (
                <Pressable
                  key={f.value}
                  style={[s.typeFilterChip, isActive && s.typeFilterChipActive]}
                  onPress={() => { setBankTypeFilter(isActive ? '' : f.value); setBankPage(0); }}
                >
                  <Text style={[s.typeFilterChipText, isActive && s.typeFilterChipTextActive]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Bank/Selected tabs */}
        <View style={s.bankTabs}>
          <Pressable
            style={[s.bankTab, bankTab === 'question' && s.bankTabActive]}
            onPress={() => { setBankTab('question'); setBankPage(0); }}
          >
            <Text style={[s.bankTabText, bankTab === 'question' && s.bankTabTextActive]}>
              All Questions {bankTypeFilter ? `(${filteredQuestionBank.length})` : `(${questionBank.length})`}
            </Text>
          </Pressable>
          <Pressable
            style={[s.bankTab, bankTab === 'selected' && s.bankTabActive]}
            onPress={() => { setBankTab('selected'); setBankPage(0); }}
          >
            <Text style={[s.bankTabText, bankTab === 'selected' && s.bankTabTextActive]}>
              {activeMode === 'quiz' ? 'Quiz' : 'Exam'} Selected ({currentSelectedIds.length})
            </Text>
          </Pressable>
        </View>

        {/* Question list */}
        {loadingQuestionBank ? (
          <View style={s.bankEmpty}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={s.bankEmptyText}>Loading questions…</Text>
          </View>
        ) : rowsToRender.length === 0 ? (
          <View style={s.bankEmpty}>
            <BookOpen size={40} color="#D0D8F0" />
            <Text style={s.bankEmptyText}>
              {bankTab === 'question' ? 'No questions match the filter.' : 'No questions selected yet.'}
            </Text>
          </View>
        ) : (
          <View style={s.questionList}>
            {pagedRows.map((question) => {
              const isSelected = currentSelectedIds.includes(question.id);
              const typeLabel = QUIZ_TYPE_LABELS[normalizeQuestionType(question.question_type)] || question.question_type;
              return (
                <View key={`${bankTab}-${question.id}`} style={[s.questionCard, isSelected && s.questionCardSelected]}>
                  {/* Top meta row */}
                  <View style={s.questionMeta}>
                    <View style={s.questionBadge}><Text style={s.questionBadgeText}>{question.class_level || '—'}</Text></View>
                    {question.subject ? <View style={[s.questionBadge, { backgroundColor: '#EDE4FF' }]}><Text style={[s.questionBadgeText, { color: '#7B5EA7' }]}>{question.subject}</Text></View> : null}
                    <View style={[s.questionBadge, s.typeBadge]}>
                      <QuestionTypeIcon type={question.question_type} size={10} color="#4A90E2" />
                      <Text style={[s.questionBadgeText, { color: '#4A90E2' }]}>{typeLabel}</Text>
                    </View>
                  </View>
                  {/* Title */}
                  <Text style={s.questionTitle} numberOfLines={2}>
                    {question.question_title || 'Untitled Question'}
                  </Text>
                  {/* Bottom row: points + time + actions */}
                  <View style={s.questionFooter}>
                    <View style={s.questionStats}>
                      <View style={s.statChip}>
                        <Zap size={10} color="#E6A817" fill="#E6A817" />
                        <Text style={s.statChipText}>
                          {activeMode === 'quiz' && bankTab === 'selected' ? 'Ignored' : `${question.points} pts`}
                        </Text>
                      </View>
                      <View style={s.statChip}>
                        <Clock size={10} color="#5A6A8A" />
                        <Text style={s.statChipText}>{Math.ceil((question.time_limit_seconds || 0) / 60)}m</Text>
                      </View>
                    </View>
                    <View style={s.questionActions}>
                      <Pressable style={s.viewBtn} onPress={() => setViewQuestion(question)}>
                        <Eye size={13} color="#4A90E2" />
                      </Pressable>
                      <Pressable
                        style={[s.toggleBtn, isSelected ? s.toggleBtnRemove : s.toggleBtnAdd]}
                        onPress={() => toggleQuestionSelection(question.id)}
                      >
                        {isSelected
                          ? <Minus size={13} color="#dc2626" />
                          : <Plus  size={13} color="#16a34a" />}
                        <Text style={[s.toggleBtnText, isSelected ? s.toggleBtnTextRemove : s.toggleBtnTextAdd]}>
                          {isSelected ? 'Remove' : 'Add'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Pagination bar */}
        {rowsToRender.length > PAGE_SIZE && (
          <View style={s.paginationBar}>
            <Pressable
              style={[s.pageBtn, bankPage === 0 && s.pageBtnDisabled]}
              onPress={() => setBankPage((p) => Math.max(0, p - 1))}
              disabled={bankPage === 0}
            >
              <ChevronLeft size={16} color={bankPage === 0 ? '#C0C8D8' : '#4A90E2'} />
              <Text style={[s.pageBtnText, bankPage === 0 && s.pageBtnTextDisabled]}>Prev</Text>
            </Pressable>
            <Text style={s.pageIndicator}>Page {bankPage + 1} / {totalPages}</Text>
            <Pressable
              style={[s.pageBtn, bankPage >= totalPages - 1 && s.pageBtnDisabled]}
              onPress={() => setBankPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={bankPage >= totalPages - 1}
            >
              <Text style={[s.pageBtnText, bankPage >= totalPages - 1 && s.pageBtnTextDisabled]}>Next</Text>
              <ChevronRight size={16} color={bankPage >= totalPages - 1 ? '#C0C8D8' : '#4A90E2'} />
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Selector Modal ── */}
      <SelectorModal
        visible={selectorField !== null}
        title={selectorTitle}
        options={selectorOptions.map((o) => ({ label: selectorField === 'classLevel' ? getStandardLabel(o) : o, value: o }))}
        selected={selectorField === 'classLevel' ? currentDraft.classLevel : currentDraft.subject}
        isSubject={selectorField === 'subject'}
        onSelect={applySelectorValue}
        onClose={() => setSelectorField(null)}
      />

      {/* ── Question Preview Modal ── */}
      <Modal visible={viewQuestion !== null} transparent animationType="fade" onRequestClose={() => setViewQuestion(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Question Preview</Text>
              <Pressable onPress={() => setViewQuestion(null)} style={s.modalCloseBtn}>
                <X size={18} color="#5A6A8A" />
              </Pressable>
            </View>
            <ScrollView style={s.modalList}>
              <Text style={s.previewTitle}>{viewQuestion?.question_title || 'Untitled'}</Text>
              <View style={s.previewMetaRow}>
                <View style={s.questionBadge}><Text style={s.questionBadgeText}>{viewQuestion?.class_level || '—'}</Text></View>
                {viewQuestion?.subject ? <View style={[s.questionBadge, { backgroundColor: '#EDE4FF' }]}><Text style={[s.questionBadgeText, { color: '#7B5EA7' }]}>{viewQuestion.subject}</Text></View> : null}
                <View style={[s.questionBadge, s.typeBadge]}>
                  <Text style={[s.questionBadgeText, { color: '#4A90E2' }]}>
                    {QUIZ_TYPE_LABELS[normalizeQuestionType(viewQuestion?.question_type || '')] || viewQuestion?.question_type}
                  </Text>
                </View>
              </View>
              <View style={s.previewStatRow}>
                <View style={s.statChip}><Zap size={11} color="#E6A817" fill="#E6A817" /><Text style={s.statChipText}>{viewQuestion?.points ?? 0} pts</Text></View>
                <View style={s.statChip}><Clock size={11} color="#5A6A8A" /><Text style={s.statChipText}>{Math.ceil((viewQuestion?.time_limit_seconds || 0) / 60)}m</Text></View>
              </View>
              {viewQuestion?.question_instruction ? (
                <Text style={s.previewBody}>{viewQuestion.question_instruction}</Text>
              ) : null}
              <Text style={s.previewFieldLabel}>Source Quiz</Text>
              <Text style={s.previewBody}>{viewQuestion?.quiz_title || '—'}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>

    {/* ── Fixed toast overlay ── */}
    {message && (
      <View pointerEvents="none" style={[
        s.toast,
        message.type === 'success' ? s.toastSuccess : s.toastError,
      ]}>
        <Text style={s.toastIcon}>{message.type === 'success' ? '✅' : '❌'}</Text>
        <Text style={[s.toastText, message.type === 'success' ? s.toastTextSuccess : s.toastTextError]}>
          {message.text}
        </Text>
      </View>
    )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FF' },
  content: { padding: 16, gap: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },

  // Page header
  pageHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  pageHeaderLeft: { flex: 1 },
  pageHeaderIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  pageTitle:      { fontSize: 22, fontWeight: '900', color: '#1a1a2e' },
  pageSubtitle:   { fontSize: 12, color: '#9A9AB0', fontWeight: '500', marginTop: 2 },

  // Mode tabs
  modeTabs: { flexDirection: 'row', gap: 10 },
  modeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#E8ECF8', paddingVertical: 11, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  modeTabActive: { borderColor: '#93c5fd', backgroundColor: '#EBF4FF' },
  modeTabExam:   { borderColor: '#C4B0E8', backgroundColor: '#F0EAFF' },
  modeTabText:        { fontSize: 13, fontWeight: '700', color: '#9A9AB0' },
  modeTabTextActive:  { color: '#4A90E2' },
  modeTabTextExam:    { color: '#9B8EC4' },

  // Card
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 14, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeaderIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle:    { fontSize: 15, fontWeight: '800', color: '#1a1a2e' },
  cardSubtitle: { fontSize: 11, color: '#9A9AB0', fontWeight: '500', marginTop: 1 },

  // Fields
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#5A6A8A', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#1a1a2e' },
  multilineInput: { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
  row: { flexDirection: 'row', gap: 10 },

  dropdownField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  dropdownFieldDisabled: { opacity: 0.5 },
  dropdownText: { fontSize: 13, color: '#1a1a2e', fontWeight: '600', flex: 1 },
  dropdownPlaceholder: { fontSize: 13, color: '#A0A8C0', flex: 1 },

  // Difficulty chips
  chipsRow:    { flexDirection: 'row', gap: 8 },
  diffChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#F8F9FF' },
  diffChipText:{ fontSize: 12, fontWeight: '700', color: '#9A9AB0' },

  // Time limit checkbox
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#D0D8F0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FF' },
  checkboxChecked: { borderColor: '#4A90E2', backgroundColor: '#4A90E2' },
  checkboxLabel: { fontSize: 13, fontWeight: '600', color: '#1a1a2e' },

  // Summary card
  summaryCard: { backgroundColor: '#EBF4FF', borderRadius: 14, padding: 14, gap: 6 },
  summaryCardExam: { backgroundColor: '#F0EAFF' },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel:{ fontSize: 13, fontWeight: '600', color: '#4A6A8A' },
  summaryValue:{ fontSize: 15, fontWeight: '900', color: '#1a1a2e' },
  summaryNote: { fontSize: 12, color: '#7B9AB0', fontStyle: 'italic' },

  // Create button
  createBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4A90E2', borderRadius: 14, paddingVertical: 14 },
  createBtnExam:  { backgroundColor: '#9B8EC4' },
  createBtnText:  { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Bank header
  bankHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refreshBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EBF4FF', alignItems: 'center', justifyContent: 'center' },

  // Search
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 13, color: '#1a1a2e', paddingVertical: 0 },

  // Type filter
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  filterLabel: { fontSize: 11, fontWeight: '700', color: '#5A6A8A' },
  typeFilterChips: { gap: 7, paddingBottom: 4 },
  typeFilterChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: '#E0E4F0', backgroundColor: '#F8F9FF' },
  typeFilterChipActive: { borderColor: '#4A90E2', backgroundColor: '#EBF4FF' },
  typeFilterChipText: { fontSize: 11, fontWeight: '700', color: '#9A9AB0' },
  typeFilterChipTextActive: { color: '#4A90E2' },

  // Bank tabs
  bankTabs:         { flexDirection: 'row', backgroundColor: '#F5F7FF', borderRadius: 10, padding: 3 },
  bankTab:          { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  bankTabActive:    { backgroundColor: '#fff', shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  bankTabText:      { fontSize: 12, fontWeight: '700', color: '#9A9AB0' },
  bankTabTextActive:{ color: '#1a1a2e' },

  // Question list
  bankEmpty:     { alignItems: 'center', paddingVertical: 40, gap: 10 },
  bankEmptyText: { fontSize: 13, color: '#9A9AB0', textAlign: 'center' },
  questionList:  { gap: 10 },

  questionCard: {
    backgroundColor: '#F8F9FF', borderRadius: 14, padding: 14, gap: 8,
    borderWidth: 1.5, borderColor: '#E8ECF8',
  },
  questionCardSelected: { borderColor: '#86BFFF', backgroundColor: '#F0F7FF' },

  questionMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  questionBadge:   { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#E8ECF8' },
  questionBadgeText:{ fontSize: 10, fontWeight: '700', color: '#5A6A8A' },
  typeBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EBF4FF' },
  questionTitle:   { fontSize: 13, fontWeight: '700', color: '#1a1a2e', lineHeight: 19 },

  questionFooter:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  questionStats:   { flexDirection: 'row', gap: 8 },
  statChip:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statChipText:    { fontSize: 11, fontWeight: '600', color: '#7A8AA0' },

  questionActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EBF4FF', alignItems: 'center', justifyContent: 'center' },
  toggleBtn:          { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5 },
  toggleBtnAdd:       { borderColor: '#86efac', backgroundColor: '#ecfdf5' },
  toggleBtnRemove:    { borderColor: '#fca5a5', backgroundColor: '#fee2e2' },
  toggleBtnText:      { fontSize: 12, fontWeight: '700' },
  toggleBtnTextAdd:   { color: '#166534' },
  toggleBtnTextRemove:{ color: '#b91c1c' },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 20 },
  modalCard:     { backgroundColor: '#fff', borderRadius: 20, padding: 18, maxHeight: '88%', gap: 12 },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle:    { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F5F7FF', alignItems: 'center', justifyContent: 'center' },
  modalList:     { maxHeight: 400 },
  optionRow:    { borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 8 },
  optionText:   { color: '#1a1a2e', fontSize: 13, fontWeight: '600' },

  previewTitle:     { fontSize: 16, fontWeight: '800', color: '#1a1a2e', marginBottom: 8 },
  previewMetaRow:   { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  previewStatRow:   { flexDirection: 'row', gap: 10, marginBottom: 12 },
  previewFieldLabel:{ fontSize: 11, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', marginTop: 10, marginBottom: 4 },
  previewBody:      { fontSize: 13, color: '#334155', lineHeight: 20 },

  // Pagination
  paginationBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0F4FF', marginTop: 4 },
  pageBtn:              { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EBF4FF' },
  pageBtnDisabled:      { backgroundColor: '#F4F5FF' },
  pageBtnText:          { fontSize: 12, fontWeight: '700', color: '#4A90E2' },
  pageBtnTextDisabled:  { color: '#C0C8D8' },
  pageIndicator:        { fontSize: 12, fontWeight: '700', color: '#5A6A8A' },



  // Toast overlay
  toast: {
    position: 'absolute', bottom: 32, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 10,
  },
  toastSuccess:     { backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#86EFAC' },
  toastError:       { backgroundColor: '#FFF1F2', borderWidth: 1.5, borderColor: '#FECDD3' },
  toastIcon:        { fontSize: 18, lineHeight: 22 },
  toastText:        { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 20 },
  toastTextSuccess: { color: '#166534' },
  toastTextError:   { color: '#9F1239' },
  errorText:        { color: '#b91c1c' },
});
