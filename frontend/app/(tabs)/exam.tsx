import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../src/context/AuthContext';

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
  | 'multi_choice';
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

const QUIZ_TYPE_LABELS: Record<string, string> = {
  drag_drop_match: 'Drag & Drop Match',
  guess_image: 'Guess the Image',
  guess_audio: 'Guess the Audio',
  true_false: 'True / False',
  single_choice: 'Single Choice',
  multi_choice: 'Multi Choice',
  drag_drop: 'Drag & Drop Match',
  image_select: 'Guess the Image',
  sound_match: 'Guess the Audio',
  memory_game: 'Multi Choice',
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

function normalizeQuestionType(type: string): QuizType {
  if (type === 'drag_drop' || type === 'drag_drop_match') return 'drag_drop_match';
  if (type === 'image_select' || type === 'guess_image') return 'guess_image';
  if (type === 'sound_match' || type === 'guess_audio') return 'guess_audio';
  if (type === 'memory_game' || type === 'multi_choice') return 'multi_choice';
  if (type === 'true_false') return 'true_false';
  if (type === 'single_choice') return 'single_choice';
  return 'single_choice';
}

function inferQuizType(questions: QuestionBankItem[]): QuizType {
  if (questions.length === 0) return 'single_choice';
  return normalizeQuestionType(questions[0].question_type || 'single_choice');
}

export default function QuizExamCreatorScreen() {
  const { user, apiFetch } = useAuth();
  const [activeMode, setActiveMode] = useState<CreationMode>('quiz');
  const [bankTab, setBankTab] = useState<BankTab>('question');
  const [questionBankSearch, setQuestionBankSearch] = useState('');
  const [loadingQuestionBank, setLoadingQuestionBank] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectorField, setSelectorField] = useState<SelectorField | null>(null);
  const [viewQuestion, setViewQuestion] = useState<QuestionBankItem | null>(null);
  const [questionBank, setQuestionBank] = useState<QuestionBankItem[]>([]);
  const [quizDraft, setQuizDraft] = useState<AssessmentDraft>(INITIAL_DRAFT);
  const [examDraft, setExamDraft] = useState<AssessmentDraft>(INITIAL_DRAFT);
  const [quizSelectedQuestionIds, setQuizSelectedQuestionIds] = useState<string[]>([]);
  const [examSelectedQuestionIds, setExamSelectedQuestionIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isTeacherView = user?.activeRole === 'teacher' || user?.activeRole === 'admin' || user?.activeRole === 'superadmin';

  const currentDraft = activeMode === 'quiz' ? quizDraft : examDraft;
  const currentSelectedIds = activeMode === 'quiz' ? quizSelectedQuestionIds : examSelectedQuestionIds;

  const setCurrentDraft = (patch: Partial<AssessmentDraft>) => {
    if (activeMode === 'quiz') {
      setQuizDraft((current) => ({ ...current, ...patch }));
      return;
    }
    setExamDraft((current) => ({ ...current, ...patch }));
  };

  const loadQuestionBank = useCallback(async () => {
    if (!isTeacherView) return;
    setLoadingQuestionBank(true);
    try {
      const query = new URLSearchParams();
      query.set('limit', '300');
      const res = await apiFetch(`/quizzes/question-bank?${query.toString()}`);
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to load question bank');
      }
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
      loadQuestionBank();
    }, [loadQuestionBank]),
  );

  const classOptions = useMemo(
    () =>
      [...new Set(questionBank.map((question) => (question.class_level || '').trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [questionBank],
  );
  const subjectOptions = useMemo(
    () =>
      [...new Set(questionBank.map((question) => (question.subject || '').trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [questionBank],
  );

  const filteredQuestionBank = useMemo(() => {
    const keyword = questionBankSearch.trim().toLowerCase();
    return questionBank.filter((question) => {
      if (currentDraft.classLevel && question.class_level !== currentDraft.classLevel) return false;
      if (currentDraft.subject && question.subject !== currentDraft.subject) return false;
      if (!keyword) return true;
      const haystack = [question.quiz_title, question.question_title, question.question_instruction, question.question_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [currentDraft.classLevel, currentDraft.subject, questionBank, questionBankSearch]);

  const selectedQuestionMap = useMemo(() => {
    const map = new Map<string, QuestionBankItem>();
    questionBank.forEach((question) => map.set(question.id, question));
    return map;
  }, [questionBank]);

  const selectedQuestions = useMemo(
    () =>
      currentSelectedIds
        .map((id) => selectedQuestionMap.get(id))
        .filter((question): question is QuestionBankItem => Boolean(question)),
    [currentSelectedIds, selectedQuestionMap],
  );

  const selectedPointsTotal = useMemo(
    () => selectedQuestions.reduce((sum, question) => sum + (Number(question.points) || 0), 0),
    [selectedQuestions],
  );

  const toggleQuestionSelection = (questionId: string) => {
    const updater = (current: string[]) =>
      current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId];

    if (activeMode === 'quiz') {
      setQuizSelectedQuestionIds(updater);
      return;
    }
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
      const selected = currentSelectedIds
        .map((id) => selectedQuestionMap.get(id))
        .filter((question): question is QuestionBankItem => Boolean(question));

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

      if (!createRes.ok) {
        const errorPayload = await createRes.json().catch(() => ({}));
        throw new Error(errorPayload.message || `Failed to create ${activeMode}`);
      }

      const createdAssessment = await createRes.json();
      const createdQuizId = String(createdAssessment.id || '');
      if (!createdQuizId) {
        throw new Error('Created item id not returned from server.');
      }

      let addedQuestionCount = 0;
      const failedQuestionIds: string[] = [];

      for (const sourceQuestionId of currentSelectedIds) {
        const reuseRes = await apiFetch(`/quizzes/${createdQuizId}/questions/reuse`, {
          method: 'POST',
          body: JSON.stringify({ sourceQuestionId }),
        });
        if (!reuseRes.ok) {
          failedQuestionIds.push(sourceQuestionId);
          continue;
        }
        addedQuestionCount += 1;

        if (activeMode === 'quiz') {
          const reusedQuestion = await reuseRes.json();
          const reusedQuestionId = String(reusedQuestion.id || '');
          if (reusedQuestionId) {
            await apiFetch(`/quizzes/questions/${reusedQuestionId}`, {
              method: 'PATCH',
              body: JSON.stringify({ points: 0 }),
            });
          }
        }
      }

      const verifyRes = await apiFetch(`/quizzes/${createdQuizId}`);
      if (!verifyRes.ok) {
        throw new Error('Quiz/Exam was created but failed to verify attached questions.');
      }
      const verifyPayload = await verifyRes.json().catch(() => ({}));
      const attachedQuestions = Array.isArray(verifyPayload.questions) ? verifyPayload.questions.length : addedQuestionCount;

      if (attachedQuestions === 0) {
        throw new Error('Created successfully, but no selected questions were attached. Please retry question selection.');
      }

      if (activeMode === 'quiz') {
        setQuizDraft(INITIAL_DRAFT);
        setQuizSelectedQuestionIds([]);
      } else {
        setExamDraft(INITIAL_DRAFT);
        setExamSelectedQuestionIds([]);
      }
      setBankTab('question');
      setMessage({
        type: 'success',
        text:
          activeMode === 'quiz'
            ? `Quiz created and published with ${attachedQuestions} question(s). Question points were set to 0.${failedQuestionIds.length ? ` ${failedQuestionIds.length} question(s) failed to attach.` : ''}`
            : `Exam created with ${attachedQuestions} question(s) and question points preserved.${failedQuestionIds.length ? ` ${failedQuestionIds.length} question(s) failed to attach.` : ''}`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : `Failed to create ${activeMode}` });
    } finally {
      setCreating(false);
    }
  };

  const selectorOptions = selectorField === 'classLevel' ? classOptions : subjectOptions;
  const selectorTitle = selectorField === 'classLevel' ? 'Select Class' : 'Select Subject';

  const applySelectorValue = (value: string) => {
    if (selectorField === 'classLevel') {
      setCurrentDraft({ classLevel: value });
    } else if (selectorField === 'subject') {
      setCurrentDraft({ subject: value });
    }
    setSelectorField(null);
  };

  if (!isTeacherView) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Quiz / Exam Creator</Text>
        <Text style={styles.errorText}>You do not have permission to create quizzes or exams.</Text>
      </ScrollView>
    );
  }

  const rowsToRender = bankTab === 'question' ? filteredQuestionBank : selectedQuestions;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Quiz / Exam Creator</Text>
      <Text style={styles.subtitle}>Create Quiz or Exam using question bank selection.</Text>

      {message && (
        <View style={[styles.messageCard, message.type === 'success' ? styles.successCard : styles.errorCard]}>
          <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>
            {message.text}
          </Text>
        </View>
      )}

      <View style={styles.modeTabs}>
        <Pressable
          style={[styles.modeTab, activeMode === 'quiz' && styles.modeTabActive]}
          onPress={() => {
            setActiveMode('quiz');
            setBankTab('question');
          }}
        >
          <Text style={[styles.modeTabText, activeMode === 'quiz' && styles.modeTabTextActive]}>Create Quiz</Text>
        </Pressable>
        <Pressable
          style={[styles.modeTab, activeMode === 'exam' && styles.modeTabActive]}
          onPress={() => {
            setActiveMode('exam');
            setBankTab('question');
          }}
        >
          <Text style={[styles.modeTabText, activeMode === 'exam' && styles.modeTabTextActive]}>Create Exam</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{activeMode === 'quiz' ? 'Create Quiz' : 'Create Exam'}</Text>
        <TextInput
          value={currentDraft.title}
          onChangeText={(title) => setCurrentDraft({ title })}
          placeholder={activeMode === 'quiz' ? 'Quiz title' : 'Exam title'}
          style={styles.input}
        />
        <TextInput
          value={currentDraft.description}
          onChangeText={(description) => setCurrentDraft({ description })}
          placeholder="Description"
          style={styles.input}
          multiline
        />

        <View style={styles.row}>
          <Pressable style={[styles.dropdownField, styles.halfInput]} onPress={() => setSelectorField('classLevel')}>
            <Text style={currentDraft.classLevel ? styles.dropdownText : styles.dropdownPlaceholder}>
              {currentDraft.classLevel || 'Class Selector'}
            </Text>
          </Pressable>
          <Pressable style={[styles.dropdownField, styles.halfInput]} onPress={() => setSelectorField('subject')}>
            <Text style={currentDraft.subject ? styles.dropdownText : styles.dropdownPlaceholder}>
              {currentDraft.subject || 'Subject Selector'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.chipsRow}>
          {DIFFICULTIES.map((difficulty) => (
            <Pressable
              key={difficulty}
              style={[styles.chip, currentDraft.difficultyLevel === difficulty && styles.chipActive]}
              onPress={() => setCurrentDraft({ difficultyLevel: difficulty })}
            >
              <Text style={[styles.chipText, currentDraft.difficultyLevel === difficulty && styles.chipTextActive]}>
                {difficulty}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.checkboxRow}
          onPress={() => setCurrentDraft({ hasTimeLimit: !currentDraft.hasTimeLimit })}
        >
          <View style={[styles.checkbox, currentDraft.hasTimeLimit && styles.checkboxChecked]}>
            {currentDraft.hasTimeLimit ? <Text style={styles.checkboxTick}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>Add time limit</Text>
        </Pressable>

        {currentDraft.hasTimeLimit ? (
          <TextInput
            value={currentDraft.timeLimitMinutes}
            onChangeText={(timeLimitMinutes) => setCurrentDraft({ timeLimitMinutes })}
            placeholder="Time in minutes"
            keyboardType="numeric"
            style={styles.input}
          />
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Selection Summary</Text>
          <Text style={styles.summaryText}>Questions selected: {currentSelectedIds.length}</Text>
          {activeMode === 'exam' ? (
            <Text style={styles.summaryText}>Total points (exam): {selectedPointsTotal}</Text>
          ) : (
            <Text style={styles.summaryText}>Quiz mode ignores question points.</Text>
          )}
        </View>

        <Pressable style={styles.primaryButton} onPress={createAssessment} disabled={creating}>
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>{activeMode === 'quiz' ? 'Create Quiz' : 'Create Exam'}</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Question Bank & {activeMode === 'quiz' ? 'Quiz Bank' : 'Exam Bank'}</Text>
          <Pressable style={styles.secondaryButtonSmall} onPress={loadQuestionBank} disabled={loadingQuestionBank}>
            {loadingQuestionBank ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.secondaryButtonText}>Refresh</Text>}
          </Pressable>
        </View>

        <TextInput
          value={questionBankSearch}
          onChangeText={setQuestionBankSearch}
          placeholder="Search questions"
          style={styles.input}
        />

        <View style={styles.modeTabs}>
          <Pressable
            style={[styles.modeTab, bankTab === 'question' && styles.modeTabActive]}
            onPress={() => setBankTab('question')}
          >
            <Text style={[styles.modeTabText, bankTab === 'question' && styles.modeTabTextActive]}>Question Bank</Text>
          </Pressable>
          <Pressable
            style={[styles.modeTab, bankTab === 'selected' && styles.modeTabActive]}
            onPress={() => setBankTab('selected')}
          >
            <Text style={[styles.modeTabText, bankTab === 'selected' && styles.modeTabTextActive]}>
              {activeMode === 'quiz' ? 'Quiz Bank' : 'Exam Bank'} ({currentSelectedIds.length})
            </Text>
          </Pressable>
        </View>

        {loadingQuestionBank ? (
          <ActivityIndicator size="small" color="#1d4ed8" />
        ) : rowsToRender.length === 0 ? (
          <Text style={styles.emptyText}>{bankTab === 'question' ? 'No questions found.' : 'No questions selected yet.'}</Text>
        ) : (
          <ScrollView horizontal>
            <View>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.colStandard]}>Class</Text>
                <Text style={[styles.tableCell, styles.colSubject]}>Subject</Text>
                <Text style={[styles.tableCell, styles.colCategory]}>Question Type</Text>
                <Text style={[styles.tableCell, styles.colQuestion]}>Question</Text>
                <Text style={[styles.tableCell, styles.colMeta]}>Points</Text>
                <Text style={[styles.tableCell, styles.colMeta]}>Qn Time</Text>
                <Text style={[styles.tableCell, styles.colActions]}>Actions</Text>
              </View>
              {rowsToRender.map((question) => {
                const isSelected = currentSelectedIds.includes(question.id);
                return (
                  <View key={`${bankTab}-${question.id}`} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colStandard]}>{question.class_level || '-'}</Text>
                    <Text style={[styles.tableCell, styles.colSubject]}>{question.subject || '-'}</Text>
                    <Text style={[styles.tableCell, styles.colCategory]}>
                      {QUIZ_TYPE_LABELS[normalizeQuestionType(question.question_type)] || question.question_type}
                    </Text>
                    <Text style={[styles.tableCell, styles.colQuestion]} numberOfLines={2}>
                      {question.question_title || 'Untitled'}
                    </Text>
                    <Text style={[styles.tableCell, styles.colMeta]}>
                      {activeMode === 'quiz' && bankTab === 'selected' ? 'Ignored' : question.points}
                    </Text>
                    <Text style={[styles.tableCell, styles.colMeta]}>{Math.ceil((question.time_limit_seconds || 0) / 60)}m</Text>
                    <View style={[styles.colActions, styles.actionsRow]}>
                      {bankTab === 'question' ? (
                        <Pressable
                          style={[styles.actionButton, isSelected ? styles.removeActionButton : styles.addActionButton]}
                          onPress={() => toggleQuestionSelection(question.id)}
                        >
                          <Text style={[styles.actionButtonText, isSelected ? styles.removeActionButtonText : styles.addActionButtonText]}>
                            {isSelected ? 'Remove' : 'Add'}
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={[styles.actionButton, styles.removeActionButton]}
                          onPress={() => toggleQuestionSelection(question.id)}
                        >
                          <Text style={[styles.actionButtonText, styles.removeActionButtonText]}>Remove</Text>
                        </Pressable>
                      )}
                      <Pressable style={[styles.actionButton, styles.viewActionButton]} onPress={() => setViewQuestion(question)}>
                        <Text style={[styles.actionButtonText, styles.viewActionButtonText]}>View Question</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      <Modal visible={selectorField !== null} transparent animationType="fade" onRequestClose={() => setSelectorField(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>{selectorTitle}</Text>
            <ScrollView style={styles.modalList}>
              <Pressable style={styles.optionRow} onPress={() => applySelectorValue('')}>
                <Text style={styles.optionText}>Any</Text>
              </Pressable>
              {selectorOptions.map((option) => (
                <Pressable key={option} style={styles.optionRow} onPress={() => applySelectorValue(option)}>
                  <Text style={styles.optionText}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.primaryButton} onPress={() => setSelectorField(null)}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={viewQuestion !== null} transparent animationType="fade" onRequestClose={() => setViewQuestion(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>Question Preview</Text>
            <ScrollView style={styles.modalList}>
              <Text style={styles.previewTitle}>{viewQuestion?.question_title || 'Untitled'}</Text>
              <Text style={styles.itemMeta}>
                {viewQuestion?.class_level || '-'} • {viewQuestion?.subject || '-'} •{' '}
                {QUIZ_TYPE_LABELS[normalizeQuestionType(viewQuestion?.question_type || '')] || viewQuestion?.question_type}
              </Text>
              <Text style={styles.itemMeta}>Points: {viewQuestion?.points ?? 0}</Text>
              <Text style={styles.itemMeta}>Question Time: {Math.ceil((viewQuestion?.time_limit_seconds || 0) / 60)} minutes</Text>
              {viewQuestion?.question_instruction ? <Text style={styles.previewBody}>{viewQuestion.question_instruction}</Text> : null}
              <Text style={styles.previewLabel}>Source Quiz</Text>
              <Text style={styles.previewBody}>{viewQuestion?.quiz_title || '-'}</Text>
            </ScrollView>
            <Pressable style={styles.primaryButton} onPress={() => setViewQuestion(null)}>
              <Text style={styles.primaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
  },
  messageCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  successCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#86efac',
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  messageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  successText: {
    color: '#166534',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  dropdownField: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dropdownPlaceholder: {
    color: '#94a3b8',
    fontSize: 13,
  },
  dropdownText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
  },
  chipActive: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  chipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#1d4ed8',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    borderColor: '#1d4ed8',
    backgroundColor: '#1d4ed8',
  },
  checkboxTick: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  summaryText: {
    fontSize: 12,
    color: '#1e3a8a',
  },
  modeTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  modeTab: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  modeTabActive: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  modeTabText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  modeTabTextActive: {
    color: '#1d4ed8',
  },
  primaryButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryButtonSmall: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
    minHeight: 48,
  },
  tableHeader: {
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#334155',
  },
  colStandard: {
    width: 110,
  },
  colSubject: {
    width: 120,
  },
  colCategory: {
    width: 140,
  },
  colQuestion: {
    width: 260,
  },
  colMeta: {
    width: 80,
  },
  colActions: {
    width: 210,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  addActionButton: {
    borderColor: '#86efac',
    backgroundColor: '#ecfdf5',
  },
  addActionButtonText: {
    color: '#166534',
  },
  removeActionButton: {
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e2',
  },
  removeActionButtonText: {
    color: '#b91c1c',
  },
  viewActionButton: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  viewActionButtonText: {
    color: '#1d4ed8',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 16,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    maxHeight: '90%',
    gap: 10,
  },
  modalList: {
    maxHeight: 430,
  },
  optionRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  optionText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  itemMeta: {
    fontSize: 12,
    color: '#475569',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  previewLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  previewBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
});
