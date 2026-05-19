import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { X, Award, ChevronRight } from 'lucide-react-native';
import { useAuth, API_BASE_URL } from '../../context/AuthContext';
import { AudioManager } from '../../utils/audio';
import DragDropRenderer from './DragDropRenderer';
import ImageSelectRenderer from './ImageSelectRenderer';

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

export default function QuizRenderer({ quizId, visible, onClose }: Props) {
  const { apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [showResultScreen, setShowResultScreen] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);

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
          // Play background music ONLY if there is no sound-based quiz question
          if (data.background_music_url) {
            const hasSoundQuestion = data.questions?.some(
              (q: any) => q.question_audio || q.question_data?.prompt_audio
            );
            if (!hasSoundQuestion) {
              const bgmUrl = resolveMediaUrl(data.background_music_url);
              if (bgmUrl) {
                await AudioManager.playBGM(bgmUrl);
              }
            }
          }
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
    onClose();
  };

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
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {currentQuestionIndex + 1} / {totalQuestions}
              </Text>
            </View>
          )}

          <View style={styles.dummyHeaderRight} />
        </View>

        {loading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Loading Playroom...</Text>
          </View>
        ) : showResultScreen ? (
          /* Result/Score Screen */
          <View style={styles.resultContainer}>
            <View style={styles.resultCard}>
              <Award size={80} color="#eab308" />
              <Text style={styles.resultTitle}>Quiz Completed!</Text>
              <Text style={styles.resultSubtitle}>{quiz?.title}</Text>

              <View style={styles.scoreBox}>
                <Text style={styles.scoreText}>
                  {correctCount} / {totalQuestions}
                </Text>
                <Text style={styles.scoreLabel}>Correct Answers</Text>
              </View>

              {savingAttempt ? (
                <Text style={styles.savingText}>Saving your accomplishments...</Text>
              ) : (
                <Pressable onPress={handleClose} style={styles.finishButton}>
                  <Text style={styles.finishButtonText}>Finish Playroom</Text>
                  <ChevronRight size={18} color="#ffffff" />
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          /* Question View */
          <View style={styles.gameWrapper}>
            <View style={styles.instructionCard}>
              <Text style={styles.questionTitle}>{currentQuestion?.question_title}</Text>
              <Text style={styles.questionInstruction}>{currentQuestion?.question_instruction}</Text>
            </View>

            <View style={styles.rendererWrapper}>
              {currentQuestion?.question_type === 'drag_drop' && (
                <DragDropRenderer
                  key={currentQuestion.id}
                  questionData={currentQuestion.question_data}
                  onComplete={handleQuestionComplete}
                />
              )}

              {currentQuestion?.question_type === 'image_select' && (
                <ImageSelectRenderer
                  key={currentQuestion.id}
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    maxWidth: '70%',
  },
  progressBarBackground: {
    height: 10,
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dummyHeaderRight: {
    width: 32,
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  gameWrapper: {
    flex: 1,
  },
  instructionCard: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  questionInstruction: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginTop: 4,
  },
  rendererWrapper: {
    flex: 1,
  },
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    gap: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
  scoreBox: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    width: '100%',
    marginVertical: 10,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#6366f1',
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },
  savingText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  finishButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
  },
  finishButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
