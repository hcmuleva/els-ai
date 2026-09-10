import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Check,
  ChevronLeft,
  Clock,
  Eye,
  HelpCircle,
  Pencil,
  Play,
  Sparkles,
  Trophy,
  Volume2,
  X,
  Zap,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LatexText from '../common/LatexText';
import SafeImage from './SafeImage';
import QuizRenderer from './QuizRenderer';
import { resolveMediaUrl } from '../../utils/media';
import { getStandardLabel } from '../../constants/standards';

export interface QuizPreviewQuestion {
  id: string;
  quiz_id?: string;
  question_type: string;
  question_title?: string;
  question_instruction?: string;
  explanation?: string | null;
  question_audio?: string | null;
  time_limit_seconds?: number;
  points?: number;
  question_data?: any;
  sort_order?: number;
}

export interface QuizPreviewData {
  id?: string;
  title: string;
  description?: string;
  class_level?: string;
  classLevel?: string;
  subject?: string;
  difficulty_level?: string;
  difficultyLevel?: string;
  quiz_type?: string;
  quizType?: string;
  total_questions?: number;
  is_published?: boolean;
  questions?: QuizPreviewQuestion[];
}

export type QuizPreviewModalProps = {
  visible: boolean;
  quizId?: string | null;
  draftQuiz?: QuizPreviewData | null;
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onEdit?: (quizId: string) => void;
};

const DIFFICULTY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  Easy:   { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  Medium: { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  Hard:   { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
};

const TYPE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  single_choice:    { label: 'Single Choice', bg: '#EFF6FF', color: '#1D4ED8' },
  multi_choice:     { label: 'Multiple Choice', bg: '#F5F3FF', color: '#6D28D9' },
  true_false:       { label: 'True / False', bg: '#ECFDF5', color: '#047857' },
  drag_drop:        { label: 'Drag & Drop', bg: '#FFF7ED', color: '#C2410C' },
  drag_drop_match:  { label: 'Drag & Drop Match', bg: '#FFF7ED', color: '#C2410C' },
  memory_game:      { label: 'Memory Game', bg: '#FDF2F8', color: '#BE185D' },
  memory_match:     { label: 'Memory Match', bg: '#FDF2F8', color: '#BE185D' },
  fill_blank:       { label: 'Fill in Blank', bg: '#F0FDFA', color: '#0F766E' },
  logico:           { label: 'Logico Matrix', bg: '#FEFCE8', color: '#A16207' },
  jigsaw:           { label: 'Jigsaw Puzzle', bg: '#F1F5F9', color: '#475569' },
  jigsaw_puzzle:    { label: 'Jigsaw Puzzle', bg: '#F1F5F9', color: '#475569' },
  guess_image:      { label: 'Image Select', bg: '#EFF6FF', color: '#2563EB' },
  guess_audio:      { label: 'Audio Match', bg: '#FAF5FF', color: '#7E22CE' },
  image_select:     { label: 'Image Select', bg: '#EFF6FF', color: '#2563EB' },
  sound_match:      { label: 'Sound Match', bg: '#FAF5FF', color: '#7E22CE' },
};

function normalizeType(raw: string): string {
  const t = (raw || '').toLowerCase().trim();
  if (t === 'jigsaw_puzzle') return 'jigsaw';
  return t;
}

export default function QuizPreviewModal({
  visible,
  quizId,
  draftQuiz,
  apiFetch,
  onClose,
  onEdit,
}: QuizPreviewModalProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 900;

  const [loading, setLoading] = useState(false);
  const [fetchedQuiz, setFetchedQuiz] = useState<QuizPreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playInteractive, setPlayInteractive] = useState(false);

  // Fetch full quiz when opened by quizId
  useEffect(() => {
    if (!visible) {
      setFetchedQuiz(null);
      setError(null);
      setPlayInteractive(false);
      return;
    }

    if (quizId) {
      setLoading(true);
      setError(null);
      apiFetch(`/quizzes/${quizId}`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`Could not load quiz (HTTP ${res.status})`);
          const data = await res.json();
          setFetchedQuiz(data);
        })
        .catch((err) => {
          setError(err?.message || 'Failed to fetch quiz data');
        })
        .finally(() => setLoading(false));
    }
  }, [visible, quizId, apiFetch]);

  const quiz: QuizPreviewData | null = useMemo(() => {
    if (quizId && fetchedQuiz) return fetchedQuiz;
    if (draftQuiz) return draftQuiz;
    return fetchedQuiz;
  }, [quizId, fetchedQuiz, draftQuiz]);

  const questions: QuizPreviewQuestion[] = useMemo(() => {
    return Array.isArray(quiz?.questions) ? quiz.questions : [];
  }, [quiz]);

  const classLvl = quiz?.class_level || quiz?.classLevel || '';
  const subj = quiz?.subject || '';
  const diff = (quiz?.difficulty_level || quiz?.difficultyLevel || 'Medium') as string;
  const diffCfg = DIFFICULTY_COLORS[diff] || DIFFICULTY_COLORS.Medium;

  const totalPoints = useMemo(() => {
    return questions.reduce((acc, q) => acc + (Number(q.points) || 1), 0);
  }, [questions]);

  const totalEstTime = useMemo(() => {
    return questions.reduce((acc, q) => acc + (Number(q.time_limit_seconds) || 30), 0);
  }, [questions]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.root, isDesktop && styles.rootDesktop]}>
        <View style={[styles.container, isDesktop && styles.containerDesktop]}>
          {/* Top Bar Header */}
          <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 12) }]}>
            <View style={styles.headerLeft}>
              <Pressable onPress={onClose} style={styles.backBtn} accessibilityLabel="Close Quiz Preview">
                <ChevronLeft size={22} color="#1E293B" />
              </Pressable>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    Quiz Preview
                  </Text>
                  <View style={styles.previewModeBadge}>
                    <Eye size={12} color="#4338CA" />
                    <Text style={styles.previewModeBadgeText}>Educator Mode</Text>
                  </View>
                </View>
                <Text style={styles.headerSub} numberOfLines={1}>
                  {quiz?.title || 'Review Quiz Content & Data'}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {quiz?.id && (
                <Pressable
                  style={styles.playInteractiveBtn}
                  onPress={() => setPlayInteractive(true)}
                >
                  <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.playInteractiveBtnText}>Play Quiz</Text>
                </Pressable>
              )}

              {quiz?.id && onEdit && (
                <Pressable
                  style={styles.editActionBtn}
                  onPress={() => {
                    onClose();
                    onEdit(quiz.id!);
                  }}
                >
                  <Pencil size={14} color="#1E293B" />
                  <Text style={styles.editActionBtnText}>Edit</Text>
                </Pressable>
              )}

              <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
                <X size={20} color="#64748B" />
              </Pressable>
            </View>
          </View>

          {/* Loading or Error State */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator accessibilityLabel="Loading" size="large" color="#2D5DC9" />
              <Text style={styles.loadingText}>Fetching quiz data & questions...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorTitle}>Error Loading Quiz</Text>
              <Text style={styles.errorSub}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={onClose}>
                <Text style={styles.retryBtnText}>Close</Text>
              </Pressable>
            </View>
          ) : !quiz ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorTitle}>No Quiz Data Available</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Quiz Summary Hero Card */}
              <View style={styles.heroCard}>
                <View style={styles.heroTopRow}>
                  <View style={styles.heroIconBox}>
                    <Trophy size={26} color="#2D5DC9" />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.heroTitle}>{quiz.title || 'Untitled Quiz'}</Text>
                    {quiz.description ? (
                      <Text style={styles.heroDesc}>{quiz.description}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Metadata Pills */}
                <View style={styles.metaRow}>
                  {classLvl ? (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Class</Text>
                      <Text style={styles.metaPillValue}>{getStandardLabel(classLvl)}</Text>
                    </View>
                  ) : null}

                  {subj ? (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Subject</Text>
                      <Text style={styles.metaPillValue}>{subj}</Text>
                    </View>
                  ) : null}

                  <View style={[styles.metaPill, { backgroundColor: diffCfg.bg, borderColor: diffCfg.border }]}>
                    <Text style={[styles.metaPillLabel, { color: diffCfg.color }]}>Difficulty</Text>
                    <Text style={[styles.metaPillValue, { color: diffCfg.color }]}>{diff}</Text>
                  </View>

                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillLabel}>Questions</Text>
                    <Text style={styles.metaPillValue}>{questions.length}</Text>
                  </View>

                  <View style={styles.metaPill}>
                    <Zap size={13} color="#D97706" />
                    <Text style={styles.metaPillValue}>{totalPoints} pts</Text>
                  </View>

                  <View style={styles.metaPill}>
                    <Clock size={13} color="#64748B" />
                    <Text style={styles.metaPillValue}>~{Math.ceil(totalEstTime / 60)} min</Text>
                  </View>
                </View>
              </View>

              {/* Questions Section Header */}
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.sectionTitle}>Questions Breakdown</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{questions.length}</Text>
                  </View>
                </View>
                <Text style={styles.sectionSubtitle}>
                  Review complete question prompts, answer choices, and keys
                </Text>
              </View>

              {/* Questions List */}
              {questions.length === 0 ? (
                <View style={styles.emptyQuestionsCard}>
                  <HelpCircle size={36} color="#94A3B8" />
                  <Text style={styles.emptyQuestionsTitle}>No questions attached</Text>
                  <Text style={styles.emptyQuestionsSub}>
                    This quiz doesn't have any questions configured yet.
                  </Text>
                </View>
              ) : (
                <View style={styles.questionsList}>
                  {questions.map((q, idx) => (
                    <QuizQuestionDetailCard
                      key={q.id || `q-${idx}`}
                      question={q}
                      index={idx}
                    />
                  ))}
                </View>
              )}
            </ScrollView>
          )}

          {/* Interactive Quiz Player Overlay */}
          {quiz?.id && playInteractive && (
            <QuizRenderer
              quizId={quiz.id}
              visible={playInteractive}
              onClose={() => setPlayInteractive(false)}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Single Question Card in Preview ──────────────────────────────────────────
function QuizQuestionDetailCard({
  question,
  index,
}: {
  question: QuizPreviewQuestion;
  index: number;
}) {
  const normType = normalizeType(question.question_type);
  const typeCfg = TYPE_CONFIG[normType] || {
    label: question.question_type || 'Question',
    bg: '#F1F5F9',
    color: '#475569',
  };

  // Extract question data safely
  const qData = useMemo(() => {
    let data = question.question_data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }
    return data || {};
  }, [question.question_data]);

  // Extract options
  const options = useMemo(() => {
    const rawOpts = qData.options || qData.choices || [];
    if (!Array.isArray(rawOpts)) return [];
    return rawOpts;
  }, [qData]);

  // Extract pairs for matching
  const pairs = useMemo(() => {
    const rawPairs = qData.pairs || qData.matching_pairs || qData.match_pairs || [];
    if (!Array.isArray(rawPairs)) return [];
    return rawPairs;
  }, [qData]);

  // Extract prompt image & audio
  const promptImage = useMemo(() => {
    const raw = qData.prompt_image || qData.image || qData.media_url || qData.imageUrl;
    return resolveMediaUrl(raw);
  }, [qData]);

  const promptAudio = useMemo(() => {
    const raw = question.question_audio || qData.prompt_audio || qData.audio_url || qData.audio;
    return resolveMediaUrl(raw);
  }, [question.question_audio, qData]);

  const explanation = question.explanation || qData.explanation;

  return (
    <View style={styles.qCard}>
      {/* Question Card Top Bar */}
      <View style={styles.qCardTop}>
        <View style={styles.qCardTopLeft}>
          <View style={styles.qIndexPill}>
            <Text style={styles.qIndexPillText}>Q{index + 1}</Text>
          </View>
          <View style={[styles.qTypePill, { backgroundColor: typeCfg.bg }]}>
            <Text style={[styles.qTypePillText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
          </View>
        </View>

        <View style={styles.qCardTopRight}>
          <View style={styles.qStatPill}>
            <Zap size={12} color="#D97706" />
            <Text style={styles.qStatPillText}>{question.points ?? 1} pts</Text>
          </View>
          {question.time_limit_seconds ? (
            <View style={styles.qStatPill}>
              <Clock size={12} color="#64748B" />
              <Text style={styles.qStatPillText}>{question.time_limit_seconds}s</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Question Prompt Title (LaTeX rendered) */}
      <View style={styles.qTitleBox}>
        <LatexText
          content={question.question_title || 'Untitled Question'}
          style={styles.qTitleText}
          background="transparent"
        />
      </View>

      {/* Instruction stimulus if present */}
      {question.question_instruction ? (
        <View style={styles.qInstructionBox}>
          <Text style={styles.qInstructionText}>{question.question_instruction}</Text>
        </View>
      ) : null}

      {/* Media: Prompt Image */}
      {promptImage ? (
        <View style={styles.promptImgContainer}>
          <SafeImage uri={promptImage} style={styles.promptImg} resizeMode="contain" />
        </View>
      ) : null}

      {/* Media: Prompt Audio badge */}
      {promptAudio ? (
        <View style={styles.promptAudioRow}>
          <Volume2 size={16} color="#2D5DC9" />
          <Text style={styles.promptAudioText}>Audio Prompt Attached</Text>
        </View>
      ) : null}

      {/* Choice Options List */}
      {options.length > 0 && (
        <View style={styles.optionsWrap}>
          <Text style={styles.optionsHeaderLabel}>Options & Answer Key</Text>
          <View style={styles.optionsList}>
            {options.map((opt: any, optIdx: number) => {
              const isCorrect = Boolean(
                opt.is_correct ?? opt.correct ?? opt.isCorrect ?? (qData.correct_option === optIdx)
              );
              const optText =
                opt.text || opt.label || opt.option_text || (typeof opt === 'string' ? opt : `Option ${optIdx + 1}`);
              const optImg = resolveMediaUrl(typeof opt === 'object' ? opt?.image : undefined);

              return (
                <View
                  key={optIdx}
                  style={[styles.optionItem, isCorrect && styles.optionItemCorrect]}
                >
                  <View style={[styles.optLetterBadge, isCorrect && styles.optLetterBadgeCorrect]}>
                    <Text style={[styles.optLetterText, isCorrect && styles.optLetterTextCorrect]}>
                      {String.fromCharCode(65 + optIdx)}
                    </Text>
                  </View>

                  <View style={{ flex: 1, gap: 4 }}>
                    <LatexText
                      content={String(optText)}
                      style={StyleSheet.flatten([styles.optText, isCorrect && styles.optTextCorrect])}
                      background="transparent"
                      compact
                    />
                    {optImg ? (
                      <SafeImage uri={optImg} style={styles.optImg} resizeMode="contain" />
                    ) : null}
                  </View>

                  {isCorrect ? (
                    <View style={styles.correctBadge}>
                      <Check size={12} color="#15803D" />
                      <Text style={styles.correctBadgeText}>Correct</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Matching Pairs List */}
      {pairs.length > 0 && (
        <View style={styles.optionsWrap}>
          <Text style={styles.optionsHeaderLabel}>Matching Pairs</Text>
          <View style={styles.pairsList}>
            {pairs.map((p: any, pIdx: number) => {
              const left = p.left || p.item || p.leftText || `Item ${pIdx + 1}`;
              const right = p.right || p.pair || p.rightText || `Match ${pIdx + 1}`;
              return (
                <View key={pIdx} style={styles.pairRow}>
                  <View style={styles.pairItem}>
                    <Text style={styles.pairItemText}>{String(left)}</Text>
                  </View>
                  <View style={styles.pairArrowBox}>
                    <Text style={styles.pairArrowText}>➔</Text>
                  </View>
                  <View style={[styles.pairItem, styles.pairItemTarget]}>
                    <Text style={styles.pairItemTextTarget}>{String(right)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Sentence / Fill Blank info */}
      {qData.sentence || qData.blank_answer || qData.correct_answer ? (
        <View style={styles.blankInfoBox}>
          {qData.sentence ? (
            <Text style={styles.blankSentenceText}>
              <Text style={{ fontWeight: '700' }}>Sentence: </Text>
              {qData.sentence}
            </Text>
          ) : null}
          {(qData.blank_answer || qData.correct_answer) && (
            <View style={styles.correctAnswerKeyRow}>
              <Check size={14} color="#15803D" />
              <Text style={styles.correctAnswerKeyText}>
                Accepted Answer: {String(qData.blank_answer || qData.correct_answer)}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Explanation Box */}
      {explanation ? (
        <View style={styles.explanationBox}>
          <View style={styles.explanationHeader}>
            <Sparkles size={14} color="#2563EB" />
            <Text style={styles.explanationLabel}>Explanation</Text>
          </View>
          <Text style={styles.explanationText}>{explanation}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Styles (Compliant with uniform border guidelines in AGENTS.md) ─────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  rootDesktop: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  containerDesktop: {
    flex: undefined as any,
    width: '100%',
    maxWidth: 1020,
    height: '92%',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 8,
  },

  // Top Bar Header
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  previewModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  previewModeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playInteractiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2D5DC9',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: '#2D5DC9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  playInteractiveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  editActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },

  // Content & Scroll
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
    gap: 16,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 18,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  heroIconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  heroDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  metaPillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  metaPillValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Section Header
  sectionHeaderRow: {
    gap: 4,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  countBadge: {
    backgroundColor: '#2D5DC9',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Questions List
  questionsList: {
    gap: 14,
  },
  qCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 16,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  qCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qCardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qIndexPill: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  qIndexPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  qTypePill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  qTypePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  qCardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  qStatPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  qTitleBox: {
    paddingVertical: 2,
  },
  qTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
  },
  qInstructionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  qInstructionText: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  promptImgContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    height: 180,
  },
  promptImg: {
    width: '100%',
    height: '100%',
  },
  promptAudioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 10,
  },
  promptAudioText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },

  // Options
  optionsWrap: {
    gap: 8,
  },
  optionsHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionsList: {
    gap: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  optionItemCorrect: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  optLetterBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optLetterBadgeCorrect: {
    backgroundColor: '#22C55E',
  },
  optLetterText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  optLetterTextCorrect: {
    color: '#FFFFFF',
  },
  optText: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  optTextCorrect: {
    color: '#14532D',
    fontWeight: '700',
  },
  optImg: {
    width: 80,
    height: 60,
    borderRadius: 6,
    marginTop: 4,
  },
  correctBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  correctBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },

  // Pairs
  pairsList: {
    gap: 6,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pairItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pairItemTarget: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  pairItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  pairItemTextTarget: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  pairArrowBox: {
    paddingHorizontal: 4,
  },
  pairArrowText: {
    fontSize: 14,
    color: '#94A3B8',
  },

  // Blank info
  blankInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 6,
  },
  blankSentenceText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
  },
  correctAnswerKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  correctAnswerKeyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },

  // Explanation
  explanationBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 10,
    gap: 4,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  explanationLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
    textTransform: 'uppercase',
  },
  explanationText: {
    fontSize: 12,
    color: '#1E3A8A',
    lineHeight: 18,
  },

  // Center / Empty / Errors
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#B91C1C',
  },
  errorSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#0F172A',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyQuestionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    gap: 8,
  },
  emptyQuestionsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#475569',
  },
  emptyQuestionsSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
