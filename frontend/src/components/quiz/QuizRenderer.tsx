import React, { useEffect, useState, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ActivityIndicator, Image, Platform } from 'react-native';
import { X, Award, ChevronRight, Play } from 'lucide-react-native';
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

function normalizeQuestionType(questionType: string): string {
  if (questionType === 'image_select') return 'guess_image';
  if (questionType === 'drag_drop') return 'drag_drop_match';
  if (questionType === 'sound_match') return 'guess_audio';
  if (questionType === 'memory_game') return 'multi_choice';
  return questionType;
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

  // Rendering Loading Screen
  if (loading) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <X size={20} color="#475569" />
            </Pressable>
          </View>
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color="#a855f7" />
            <Text style={styles.loadingText}>Loading Playroom...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Rendering Intro Screen (To get user interaction for Audio Playback)
  if (!hasStarted) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
        <View style={styles.introContainer}>
          <View style={styles.headerTransparent}>
            <Pressable onPress={handleClose} style={styles.closeButtonLight}>
              <X size={24} color="#64748b" />
            </Pressable>
          </View>
          
          <View style={styles.introContent}>
            <View style={styles.introCard}>
              <View style={styles.characterContainer}>
                {/* Cute Character Placeholder */}
                <View style={styles.characterCircle}>
                  <Text style={{fontSize: 60}}>🦒</Text>
                </View>
              </View>
              
              <Text style={styles.introSubtitle}>Let's be smart together!</Text>
              <Text style={styles.introTitle}>{quiz?.title}</Text>
              
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>{totalQuestions} Levels</Text>
              </View>

              <Pressable style={styles.startButton} onPress={handleStartGame}>
                <Text style={styles.startButtonText}>Play Now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <View style={styles.modalContainer}>
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <X size={20} color="#475569" />
          </Pressable>

          {!showResultScreen && quiz && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>Level {currentQuestionIndex + 1}</Text>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${((currentQuestionIndex) / totalQuestions) * 100}%` },
                  ]}
                />
              </View>
            </View>
          )}

          <View style={styles.dummyHeaderRight} />
        </View>

        {showResultScreen ? (
          /* Result/Score Screen */
          <View style={styles.resultContainer}>
            <View style={styles.successBadge}>
              <Text style={styles.successBadgeText}>Level Passed!</Text>
            </View>
            
            <View style={styles.resultCard}>
              <Text style={{fontSize: 80, marginBottom: 20}}>🎉</Text>
              <Text style={styles.resultTitle}>Congratulations!</Text>
              <Text style={styles.resultSubtitle}>You chose the right answers!{"\n"}Let's play another one!</Text>

              <View style={styles.scoreBox}>
                <Text style={styles.scoreText}>
                  {correctCount} / {totalQuestions}
                </Text>
                <Text style={styles.scoreLabel}>Correct</Text>
              </View>

              {savingAttempt ? (
                <Text style={styles.savingText}>Saving your accomplishments...</Text>
              ) : (
                <View style={{width: '100%', gap: 12}}>
                  <Pressable onPress={handleClose} style={styles.finishButton}>
                    <Text style={styles.finishButtonText}>Next</Text>
                  </Pressable>
                  <Pressable onPress={handleClose} style={styles.restButton}>
                    <Text style={styles.restButtonText}>No, I want to take a rest</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        ) : (
          /* Question View */
          <View style={styles.gameWrapper}>
            <View style={styles.instructionCard}>
              <Text style={styles.questionTitle}>{currentQuestion?.question_title}</Text>
              {currentQuestion?.question_instruction ? (
                <Text style={styles.questionInstruction}>{currentQuestion?.question_instruction}</Text>
              ) : null}
            </View>

            <View style={styles.rendererWrapper}>
              {currentQuestion && normalizeQuestionType(currentQuestion.question_type) === 'drag_drop_match' && (
                <DragDropRenderer
                  key={currentQuestion.id}
                  questionData={currentQuestion.question_data}
                  onComplete={handleQuestionComplete}
                />
              )}

              {currentQuestion && normalizeQuestionType(currentQuestion.question_type) === 'guess_image' && (
                <ImageSelectRenderer
                  key={currentQuestion.id}
                  questionData={currentQuestion.question_data}
                  onComplete={handleQuestionComplete}
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
                />
                )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  introContainer: {
    flex: 1,
    backgroundColor: '#ede9fe', // Light purple bg
  },
  headerTransparent: {
    padding: 20,
    alignItems: 'flex-start',
  },
  closeButtonLight: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  introContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  introCard: {
    backgroundColor: '#fff',
    borderRadius: 30,
    padding: 30,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#a855f7',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 5,
  },
  characterContainer: {
    marginBottom: 20,
  },
  characterCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fef08a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  introSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a855f7',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 16,
  },
  levelBadge: {
    backgroundColor: '#dcfce3',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 30,
  },
  levelBadgeText: {
    color: '#16a34a',
    fontWeight: '800',
    fontSize: 12,
  },
  startButton: {
    backgroundColor: '#f97316', // Orange
    width: '100%',
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },

  modalContainer: {
    flex: 1,
    backgroundColor: '#dbeafe', // light blue background
  },
  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    marginTop: Platform.OS === 'ios' ? 40 : 10,
  },
  closeButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  progressContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '60%',
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 6,
  },
  progressBarBackground: {
    height: 12,
    width: '100%',
    backgroundColor: '#bfdbfe',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4f46e5',
    borderRadius: 6,
  },
  dummyHeaderRight: {
    width: 40,
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
  },
  gameWrapper: {
    flex: 1,
  },
  instructionCard: {
    padding: 20,
    alignItems: 'center',
  },
  questionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  questionInstruction: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    fontWeight: '500',
  },
  rendererWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#bbf7d0', // Light green bg for win
  },
  successBadge: {
    backgroundColor: '#86efac',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    marginBottom: -20,
    zIndex: 10,
    borderWidth: 3,
    borderColor: '#fff',
  },
  successBadgeText: {
    color: '#166534',
    fontWeight: '800',
    fontSize: 14,
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 30,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  resultTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 10,
  },
  resultSubtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 24,
  },
  scoreBox: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 20,
    marginBottom: 30,
  },
  scoreText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#f97316',
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  savingText: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  finishButton: {
    backgroundColor: '#f97316',
    paddingVertical: 18,
    borderRadius: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4,
  },
  finishButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  restButton: {
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  restButtonText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14,
  },
});
