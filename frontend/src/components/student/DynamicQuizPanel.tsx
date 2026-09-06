import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { HelpCircle, Play } from 'lucide-react-native';
import type { VideoSectionsApi } from '../../api/videoSections';
import QuizRenderer from '../quiz/QuizRenderer';

interface Props {
  api: VideoSectionsApi;
  activeSectionId: string | null;
  autoOpen?: boolean;
  onQuizCompleted?: (sectionId: string, score: number) => void;
  onRendererOpenChange?: (open: boolean) => void;
}

// The quiz panel is always bound to the active section. When activeSectionId
// changes it reloads the quiz; if none is attached it shows an empty state.
export default function DynamicQuizPanel({ api, activeSectionId, autoOpen, onQuizCompleted, onRendererOpenChange }: Props) {
  const [quizId, setQuizId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>('');
  const [questionCount, setQuestionCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rendererOpen, setRendererOpen] = useState(false);

  useEffect(() => {
    if (!activeSectionId) {
      setQuizId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getQuiz(activeSectionId)
      .then((payload) => {
        if (cancelled) return;
        if (payload.quiz) {
          setQuizId(payload.quiz.id);
          setQuizTitle(payload.quiz.title);
          setQuestionCount(payload.quiz.questions.length);
        } else {
          setQuizId(null);
        }
      })
      .catch(() => !cancelled && setQuizId(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api, activeSectionId]);

  useEffect(() => {
    if (autoOpen && quizId) setRendererOpen(true);
  }, [autoOpen, quizId]);

  // Let the parent pause the background video whenever the quiz modal is open.
  useEffect(() => {
    onRendererOpenChange?.(rendererOpen);
  }, [rendererOpen, onRendererOpenChange]);

  if (!activeSectionId) return null;

  if (loading) {
    return (
      <View style={styles.panel}>
        <ActivityIndicator color="#2D5DC9" />
      </View>
    );
  }

  if (!quizId) {
    return (
      <View style={styles.panel}>
        <HelpCircle size={20} color="#525C6B" />
        <Text style={styles.empty}>No quiz attached for this section.</Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{quizTitle || 'Section quiz'}</Text>
        <Text style={styles.meta}>{questionCount} question{questionCount === 1 ? '' : 's'}</Text>
      </View>
      <Pressable style={styles.btn} onPress={() => setRendererOpen(true)}>
        <Play size={16} color="#FFFFFF" />
        <Text style={styles.btnText}>Start Quiz</Text>
      </Pressable>

      <QuizRenderer
        quizId={quizId}
        visible={rendererOpen}
        onClose={() => setRendererOpen(false)}
        onCompleted={({ score, totalPoints }) => {
          const pct = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
          api.submitQuiz(activeSectionId, score, totalPoints).catch(() => undefined);
          onQuizCompleted?.(activeSectionId, pct);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#ECECF4' },
  title: { fontSize: 15, fontWeight: '700', color: '#2A2A44' },
  meta: { fontSize: 12, color: '#8A8AA0', marginTop: 2 },
  empty: { fontSize: 13, color: '#8A8AA0', flex: 1 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2D5DC9', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
