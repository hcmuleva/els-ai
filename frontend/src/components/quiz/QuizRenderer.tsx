import React, { useEffect, useState, useRef } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useAuth, API_BASE_URL } from '../../context/AuthContext';
import { AudioManager } from '../../utils/audio';
import DragDropRenderer from './DragDropRenderer';
import ImageSelectRenderer from './ImageSelectRenderer';
import ChoiceQuestionRenderer from './ChoiceQuestionRenderer';

type QuizQuestion = {
  id: string;
  question_type: string;
  question_title?: string;
  question_instruction?: string;
  question_audio?: string;
  question_data: any;
  points: number;
};

type Quiz = {
  id: string;
  title: string;
  background_music_url?: string;
  questions: QuizQuestion[];
};

type Props = {
  quizId: string;
  visible: boolean;
  onClose: () => void;
};

export function resolveMediaUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/media')) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}

export function normalizeQuestionType(questionType: string): string {
  if (questionType === 'image_select') return 'guess_image';
  if (questionType === 'drag_drop') return 'drag_drop_match';
  if (questionType === 'sound_match') return 'guess_audio';
  if (questionType === 'memory_game') return 'multi_choice';
  return questionType;
}

export type QuestionTheme = {
  bg: string;
  cardBg: string;
  accent: string;
  textColor: string;
  emoji: string;
  label: string;
};

const QUESTION_THEMES: Record<string, QuestionTheme> = {
  true_false: {
    bg: '#D6EAFF', cardBg: '#EBF4FF', accent: '#4A90E2',
    textColor: '#1e3a8a', emoji: '🤔', label: 'True or False?',
  },
  guess_audio: {
    bg: '#D6EAFF', cardBg: '#EBF4FF', accent: '#4A90E2',
    textColor: '#1e3a8a', emoji: '🎵', label: 'Listen carefully!',
  },
  single_choice: {
    bg: '#D6EAFF', cardBg: '#EBF4FF', accent: '#4A90E2',
    textColor: '#2C6BC9', emoji: '💡', label: 'Pick the right one!',
  },
  multi_choice: {
    bg: '#D6EAFF', cardBg: '#EBF4FF', accent: '#4A90E2',
    textColor: '#2C6BC9', emoji: '✅', label: 'Select all correct!',
  },
  guess_image: {
    bg: '#D6EAFF', cardBg: '#EBF4FF', accent: '#4A90E2',
    textColor: '#2C6BC9', emoji: '👀', label: 'Find the match!',
  },
  drag_drop_match: {
    bg: '#D6EAFF', cardBg: '#EBF4FF', accent: '#4A90E2',
    textColor: '#2C6BC9', emoji: '🎯', label: 'Match them up!',
  },
};

function getQuestionTheme(questionType: string): QuestionTheme {
  const normalized = normalizeQuestionType(questionType);
  return QUESTION_THEMES[normalized] ?? QUESTION_THEMES['single_choice'];
}



export default function QuizRenderer({ quizId, visible, onClose }: Props) {
  const { apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [showResultScreen, setShowResultScreen] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);


  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cardSlideAnim = useRef(new Animated.Value(30)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;
  const answerFadeAnim = useRef(new Animated.Value(0)).current;
  const answerSlideAnim = useRef(new Animated.Value(20)).current;

  // Intro play-button pulse
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Slide-in animation per question
  useEffect(() => {
    if (!hasStarted || showResultScreen) return;
    cardSlideAnim.setValue(30);
    cardOpacityAnim.setValue(0);
    answerSlideAnim.setValue(20);
    answerFadeAnim.setValue(0);
    Animated.parallel([
      Animated.timing(cardSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(cardOpacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    // Stagger: answers come in slightly after the question
    Animated.sequence([
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(answerFadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(answerSlideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();
  }, [currentQuestionIndex, hasStarted, showResultScreen]);





  // Load quiz details on open
  useEffect(() => {
    if (!visible) return;

    async function loadQuiz() {
      setLoading(true);
      try {
        const res = await apiFetch(`/quizzes/${quizId}`);
        if (res.ok) {
          const data = await res.json();
          setQuiz(data);
        }
      } catch (e) {
        console.warn('Failed to load quiz', e);
      } finally {
        setLoading(false);
      }
    }

    loadQuiz();

    return () => {
      AudioManager.stopBGM();
    };
  }, [quizId, visible]);

  // Handle starting the quiz (requires explicit interaction for web BGM play)
  const handleStartGame = async () => {
    if (!quiz) return;
    setHasStarted(true);

    // Default BGM if not provided but we still want the playful vibe for kids
    const bgmUrlRaw = quiz.background_music_url || '/media/bg-audio/eliveta-kids-happy-music-474162.mp3';

    // Check if there are any sound-based questions
    const hasSoundQuestion = quiz.questions?.some(
      (q: any) => (q.question_audio && q.question_audio !== 'null') ||
        (q.question_data?.prompt_audio && q.question_data.prompt_audio !== 'null')
    );

    // Only play BGM if there are NO sound questions
    if (!hasSoundQuestion && bgmUrlRaw) {
      const bgmUrl = resolveMediaUrl(bgmUrlRaw);
      if (bgmUrl) {
        try {
          await AudioManager.playBGM(bgmUrl);
        } catch (e) {
          console.warn('Failed to play BGM, browser policy likely blocked it:', e);
        }
      }
    }
  };

  if (!visible) return null;

  const currentQuestion = quiz?.questions?.[currentQuestionIndex];
  const totalQuestions = quiz?.questions?.length || 0;
  const currentTheme = currentQuestion
    ? getQuestionTheme(currentQuestion.question_type)
    : QUESTION_THEMES['single_choice'];

  const getStarCount = () => {
    const ratio = correctCount / totalQuestions;
    if (ratio >= 0.85) return 3;
    if (ratio >= 0.5) return 2;
    return 1;
  };

  const getAnswerSectionLabel = (type: string) => {
    switch (normalizeQuestionType(type)) {
      case 'drag_drop_match': return 'Drag & match';
      case 'guess_image': return 'Pick the right image';
      case 'guess_audio': return 'What did you hear?';
      case 'true_false': return 'Is this true or false?';
      default: return 'Choose your answer';
    }
  };

  const handleQuestionComplete = (isCorrect: boolean, responseData: any) => {
    const nextCorrectCount = isCorrect ? correctCount + 1 : correctCount;
    if (isCorrect) {
      setCorrectCount(nextCorrectCount);
    }


    const newAttempts = [
      ...attempts,
      {
        questionId: currentQuestion!.id,
        isCorrect,
        responseData,
        timeSpentSeconds: 10, // Simulated duration
      },
    ];
    setAttempts(newAttempts);

    // Go to next question or show results
    setTimeout(() => {
      if (currentQuestionIndex + 1 < totalQuestions) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else {
        finishQuiz(nextCorrectCount, newAttempts);
      }
    }, 1200);
  };

  const finishQuiz = async (finalCorrectCount: number, finalAttempts: any[]) => {
    setShowResultScreen(true);
    setSavingAttempt(true);
    AudioManager.stopBGM();


    // Play local win or lose sound effect depending on performance
    const winThreshold = Math.ceil(totalQuestions / 2);
    const soundPath = finalCorrectCount >= winThreshold
      ? '/media/sound-effects/you-won.mp3'
      : '/media/sound-effects/you-lost.mp3';
    const soundUrl = resolveMediaUrl(soundPath);
    if (soundUrl) {
      AudioManager.playSound(soundUrl);
    }

    // Send attempt report to backend
    try {
      const score = finalCorrectCount;
      const totalPoints = totalQuestions * 10;
      await apiFetch('/quizzes/attempts', {
        method: 'POST',
        body: JSON.stringify({
          quizId,
          score,
          totalPoints,
          questionAttempts: finalAttempts,
        }),
      });
    } catch (e) {
      console.warn('Failed to save score attempt on backend', e);
    } finally {
      setSavingAttempt(false);
    }
  };

  const handleClose = () => {
    AudioManager.stopBGM();
    setHasStarted(false);
    setShowResultScreen(false);
    setCurrentQuestionIndex(0);
    setCorrectCount(0);
    setAttempts([]);
    onClose();
  };

  // ── LOADING ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingCard}>
            <Text style={styles.loadingMascot}>🦒</Text>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.loadingText}>Loading Playroom...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  // ── INTRO ────────────────────────────────────────────────────────────────
  if (!hasStarted) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
        <View style={styles.introContainer}>
          {/* Decorative blobs */}
          <View style={[styles.blob, styles.blob1]} />
          <View style={[styles.blob, styles.blob2]} />
          <View style={[styles.blob, styles.blob3]} />

          <View style={[styles.introTopBar, { paddingTop: Platform.OS === 'ios' ? 52 : 18 }]}>
            <Pressable onPress={handleClose} style={styles.introCloseBtn}>
              <X size={20} color="#64748b" />
            </Pressable>

          </View>

          <View style={styles.introBody}>
            <View style={styles.mascotWrap}>
              <View style={styles.mascotOuter}>
                <View style={styles.mascotInner}>
                  <Text style={styles.mascotEmoji}>🦒</Text>
                </View>
              </View>
              <Text style={[styles.floatStar, { top: 4, right: 4 }]}>⭐</Text>
              <Text style={[styles.floatStar, { top: 36, left: -4, fontSize: 18 }]}>✨</Text>
            </View>

            <Text style={styles.introTagline}>Let's be smart together!</Text>
            <Text style={styles.introTitle}>{quiz?.title}</Text>

            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>🎯  {totalQuestions} Questions</Text>
              </View>
              <View style={[styles.badge, styles.badgeGreen]}>
                <Text style={[styles.badgeText, { color: '#15803d' }]}>🏆  Earn Stars</Text>
              </View>
            </View>

            <Animated.View style={[styles.playBtnWrap, { transform: [{ scale: pulseAnim }] }]}>
              <Pressable style={styles.playBtn} onPress={handleStartGame}>
                <Text style={styles.playBtnText}>▶  Play Now!</Text>
              </Pressable>
            </Animated.View>

            <Text style={styles.introHint}>Tap play to start your adventure</Text>
          </View>
        </View>
      </Modal>
    );
  }

  // ── GAME SCREEN ──────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <View style={styles.gameContainer}>

        {/* Header */}
        <View style={[styles.gameHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 18 }]}>
          <Pressable onPress={handleClose} style={styles.closeBtn}>
            <X size={18} color="#475569" />
          </Pressable>
          {!showResultScreen && (
            <View style={styles.levelChipWrap}>
              <Text style={styles.levelChipText}>Level {currentQuestionIndex + 1}</Text>
            </View>
          )}
          <View style={styles.headerRight}>

            <View style={styles.xpChip}>
              <Text style={styles.xpText}>⭐ {correctCount * 10}</Text>
            </View>
          </View>
        </View>

        {/* Dot progress bar */}
        {!showResultScreen && (
          <View style={styles.progressRow}>
            <View style={styles.dotProgress}>
              {quiz?.questions.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i < currentQuestionIndex && styles.dotDone,
                    i === currentQuestionIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── RESULT / QUESTION VIEW ── */}
        {showResultScreen ? (
          <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.celebChip}>
              <Text style={styles.celebChipText}>✅  Level {currentQuestionIndex} passed!</Text>
            </View>
            <Text style={styles.resultEmoji}>🎉🦒🎊</Text>
            <Text style={styles.resultTitle}>Congratulations!</Text>
            <Text style={styles.resultSubtitle}>
              You finished the quiz!{"\n"}Let's play another one!
            </Text>

            {/* 3-col stats */}
            <View style={styles.statsCard}>
              <View style={[styles.statCell, { backgroundColor: '#F0F4FF' }]}>
                <Text style={[styles.statValue, { color: '#4A90E2' }]}>
                  {Math.round((correctCount / Math.max(totalQuestions, 1)) * 100)}%
                </Text>
                <Text style={styles.statLabel}>Score</Text>
              </View>
              <View style={[styles.statCell, { backgroundColor: '#FFF5CC' }]}>
                <Text style={[styles.statValue, { color: '#E6A020' }]}>+{correctCount * 10}</Text>
                <Text style={styles.statLabel}>XP Earned</Text>
              </View>
              <View style={[styles.statCell, { backgroundColor: '#E8F7E8' }]}>
                <Text style={[styles.statValue, { color: '#4CAF50' }]}>{correctCount}</Text>
                <Text style={styles.statLabel}>Correct</Text>
              </View>
            </View>

            <View style={styles.resultStarsRow}>
              {[1, 2, 3].map((s) => (
                <Text key={s} style={s <= getStarCount() ? styles.starOn : styles.starOff}>★</Text>
              ))}
            </View>

            {savingAttempt ? (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color="#4A90E2" />
                <Text style={styles.savingText}>Saving your progress...</Text>
              </View>
            ) : (
              <View style={styles.resultBtns}>
                <Pressable onPress={handleClose} style={styles.nextBtn}>
                  <Text style={styles.nextBtnText}>Next Level  ›</Text>
                </Pressable>
                <Pressable onPress={handleClose} style={styles.restBtn}>
                  <Text style={styles.restBtnText}>No, I want to take a rest</Text>
                </Pressable>
                <Text style={styles.resultFooter}>∧ Swipe up to see full score</Text>
              </View>
            )}
          </ScrollView>
        ) : (
          /* ── QUESTION VIEW ── */
          <>
            <View style={styles.questionView}>
              {/* Listen / type chip */}
              <View style={styles.listenChipWrap}>
                <View style={styles.listenChip}>
                  <Text style={styles.listenChipText}>
                    {currentTheme.emoji}  {currentTheme.label}
                  </Text>
                </View>
              </View>

              {/* Question card slides in */}
              <Animated.View
                style={{ transform: [{ translateY: cardSlideAnim }], opacity: cardOpacityAnim }}
              >
                <View style={styles.questionCard}>
                  <Text style={styles.questionTitle}>{currentQuestion?.question_title}</Text>
                  {currentQuestion?.question_instruction ? (
                    <Text style={styles.questionInstruction}>
                      {currentQuestion.question_instruction}
                    </Text>
                  ) : null}

                </View>
              </Animated.View>

              {/* Answer section - staggered fade in, no divider */}
              <Animated.View
                style={[
                  styles.answerSection,
                  { opacity: answerFadeAnim, transform: [{ translateY: answerSlideAnim }] },
                ]}
              >
                <View style={styles.rendererArea}>
                  {currentQuestion && normalizeQuestionType(currentQuestion.question_type) === 'drag_drop_match' && (
                    <DragDropRenderer
                      key={currentQuestion.id}
                      questionData={currentQuestion.question_data}
                      onComplete={handleQuestionComplete}
                      theme={currentTheme}
                    />
                  )}
                  {currentQuestion && normalizeQuestionType(currentQuestion.question_type) === 'guess_image' && (
                    <ImageSelectRenderer
                      key={currentQuestion.id}
                      questionData={currentQuestion.question_data}
                      onComplete={handleQuestionComplete}
                      theme={currentTheme}
                    />
                  )}
                  {currentQuestion &&
                    ['guess_audio', 'true_false', 'single_choice', 'multi_choice'].includes(
                      normalizeQuestionType(currentQuestion.question_type),
                    ) && (
                      <ChoiceQuestionRenderer
                        key={currentQuestion.id}
                        questionType={currentQuestion.question_type}
                        questionAudio={currentQuestion.question_audio}
                        questionData={currentQuestion.question_data}
                        onComplete={handleQuestionComplete}
                        theme={currentTheme}
                      />
                    )}
                </View>
              </Animated.View>
            </View>

            {/* Bottom streak / XP strip */}
            <View style={styles.streakStrip}>
              <View style={styles.streakBadge}>
                <Text style={styles.streakBadgeText}>🔥 On a Roll!</Text>
              </View>
              <View style={styles.xpBar}>
                <View
                  style={[
                    styles.xpBarFill,
                    { width: `${Math.min(100, Math.round((correctCount / Math.max(1, totalQuestions)) * 100))}%` },
                  ]}
                />
              </View>
              <Text style={styles.xpBarLabel}>{correctCount * 10} XP</Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ── LOADING ──────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1, backgroundColor: '#F0F4FF', justifyContent: 'center', alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 40, alignItems: 'center', gap: 16,
    shadowColor: '#4A90E2', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16, elevation: 4,
  },
  loadingMascot: { fontSize: 56 },
  loadingText: { fontSize: 15, fontWeight: '800', color: '#4A90E2' },

  // ── INTRO ─────────────────────────────────────────────────────────────────
  introContainer: { flex: 1, backgroundColor: '#F0F4FF', overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 9999, opacity: 0.15 },
  blob1: { width: 260, height: 260, backgroundColor: '#4A90E2', top: -100, right: -70 },
  blob2: { width: 180, height: 180, backgroundColor: '#FF7043', bottom: 80, left: -50 },
  blob3: { width: 120, height: 120, backgroundColor: '#7DC67A', top: 200, left: -20 },
  introTopBar: { paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  introCloseBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5, elevation: 2,
  },
  introBody: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, gap: 16,
  },
  mascotWrap: { position: 'relative', marginBottom: 4 },
  mascotOuter: {
    width: 128, height: 128, borderRadius: 64,
    backgroundColor: '#D6EAFF', alignItems: 'center', justifyContent: 'center',
  },
  mascotInner: {
    width: 106, height: 106, borderRadius: 53,
    backgroundColor: '#FFF5CC', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  mascotEmoji: { fontSize: 58 },
  floatStar: { position: 'absolute', fontSize: 20 },
  introTagline: {
    fontSize: 11, fontWeight: '800', color: '#4A90E2',
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  introTitle: { fontSize: 22, fontWeight: '900', color: '#1a1a2e', textAlign: 'center', lineHeight: 30 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: { backgroundColor: '#EBF4FF', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  badgeGreen: { backgroundColor: '#E8F7E8' },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#4A90E2' },
  playBtnWrap: { width: '100%' },
  playBtn: {
    backgroundColor: '#FF7043', paddingVertical: 18, borderRadius: 999, alignItems: 'center',
    shadowColor: '#FF7043', shadowOpacity: 0.38, shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14, elevation: 5,
  },
  playBtnText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.3 },
  introHint: { fontSize: 12, color: '#7A7A9A', fontWeight: '600' },

  // ── GAME CONTAINER ────────────────────────────────────────────────────────
  gameContainer: { flex: 1, backgroundColor: '#D6EAFF' },
  gameHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5, elevation: 2,
  },
  levelChipWrap: {
    backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5, elevation: 2,
  },
  levelChipText: { fontSize: 13, fontWeight: '900', color: '#1a1a2e' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  xpChip: {
    backgroundColor: '#4A90E2', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  xpText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  progressRow: {
    paddingHorizontal: 16, paddingBottom: 10,
  },
  dotProgress: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 5, justifyContent: 'center', alignItems: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#B5D4FF' },
  dotDone: { backgroundColor: '#7DC67A' },
  dotActive: { width: 24, height: 8, borderRadius: 4, backgroundColor: '#4A90E2' },

  // ── QUESTION VIEW ─────────────────────────────────────────────────────────
  questionView: { flex: 1, paddingHorizontal: 16, gap: 10, paddingTop: 4, justifyContent: 'center' },
  listenChipWrap: { alignItems: 'center' },
  listenChip: {
    backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7,
    borderWidth: 1.5, borderColor: '#EBEBF5',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3, elevation: 1,
  },
  listenChipText: { fontSize: 12, fontWeight: '800', color: '#4A90E2' },

  questionCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 14,
    alignItems: 'center', gap: 6,
    shadowColor: '#4A90E2', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12, elevation: 3,
  },
  questionTitle: {
    fontSize: 15, fontWeight: '800', color: '#1a1a2e',
    lineHeight: 22, textAlign: 'center',
  },
  questionInstruction: {
    fontSize: 12, fontWeight: '600', color: '#7A7A9A', textAlign: 'center',
  },

  // ── ANSWER SECTION ────────────────────────────────────────────────────────
  answerSection: { flex: 1 },
  rendererArea: { flex: 1 },

  // ── STREAK STRIP ─────────────────────────────────────────────────────────
  streakStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  streakBadge: {
    backgroundColor: '#FF9800', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
  streakBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  xpBar: {
    flex: 1, height: 6, backgroundColor: '#fff',
    borderRadius: 999, overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%', borderRadius: 999,
    backgroundColor: '#4A90E2',
  },
  xpBarLabel: { fontSize: 11, fontWeight: '800', color: '#4A90E2' },

  // ── RESULT SCREEN ─────────────────────────────────────────────────────────
  resultScroll: {
    flexGrow: 1, alignItems: 'center', paddingHorizontal: 24,
    paddingTop: 20, paddingBottom: 48, gap: 14,
    backgroundColor: '#E8F7E8',
  },
  celebChip: {
    backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8,
    borderWidth: 1.5, borderColor: '#A5D6A7',
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  celebChipText: { fontSize: 12, fontWeight: '900', color: '#4CAF50' },
  resultEmoji: { fontSize: 60, textAlign: 'center' },
  resultTitle: { fontSize: 26, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  resultSubtitle: {
    fontSize: 13, color: '#7A7A9A', textAlign: 'center',
    lineHeight: 20, fontWeight: '600',
  },
  statsCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 14,
    flexDirection: 'row', gap: 8, width: '100%',
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8, elevation: 2,
  },
  statCell: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 9, color: '#7A7A9A', fontWeight: '700', marginTop: 2 },
  resultStarsRow: { flexDirection: 'row', gap: 6 },
  starOn: { fontSize: 42, color: '#F5C842' },
  starOff: { fontSize: 42, color: '#C8C8D8' },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savingText: { fontSize: 13, color: '#4A90E2', fontWeight: '700' },
  resultBtns: { width: '100%', gap: 10, alignItems: 'center' },
  nextBtn: {
    backgroundColor: '#7DC67A', width: '100%', paddingVertical: 18,
    borderRadius: 999, alignItems: 'center',
    shadowColor: '#7DC67A', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12, elevation: 4,
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  restBtn: { paddingVertical: 12, alignItems: 'center' },
  restBtnText: { color: '#7A7A9A', fontSize: 13, fontWeight: '700' },
  resultFooter: { fontSize: 10, color: '#A5D6A7', fontWeight: '700', marginTop: 4 },
});
