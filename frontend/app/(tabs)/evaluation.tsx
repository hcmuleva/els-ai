import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/context/AuthContext';

type AiQuizItem = {
  id: string;
  title: string;
  class_level?: string;
  subject?: string;
  quiz_type: string;
  difficulty_level?: string;
  is_published: boolean;
  is_ai_generated: boolean;
  total_questions: number;
};

export default function ContentEvaluationScreen() {
  const { user, apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [aiQuizzes, setAiQuizzes] = useState<AiQuizItem[]>([]);

  const isTeacherView = user?.activeRole === 'teacher' || user?.activeRole === 'admin' || user?.activeRole === 'superadmin';

  const summary = useMemo(() => {
    const total = aiQuizzes.length || 1;
    const accepted = aiQuizzes.filter((quiz) => quiz.is_published).length;
    const rework = aiQuizzes.filter((quiz) => !quiz.is_published).length;
    return {
      acceptedPct: Math.round((accepted / total) * 100),
      reworkPct: Math.round((rework / total) * 100),
    };
  }, [aiQuizzes]);

  const loadAiQuizzes = useCallback(async () => {
    if (!isTeacherView) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/quizzes/teacher/library?source=ai&status=all&limit=100');
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to load AI evaluation list');
      }
      const payload = await res.json();
      setAiQuizzes(payload.quizzes || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load AI evaluation list');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, isTeacherView]);

  useFocusEffect(
    useCallback(() => {
      loadAiQuizzes();
    }, [loadAiQuizzes]),
  );

  const togglePublish = async (quizId: string, isPublished: boolean) => {
    setSavingId(quizId);
    setError('');
    try {
      const res = await apiFetch(`/quizzes/${quizId}/publish`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: !isPublished }),
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to update review decision');
      }

      await loadAiQuizzes();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update review decision');
    } finally {
      setSavingId(null);
    }
  };

  if (!isTeacherView) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Content Evaluation (AI vs Manual)</Text>
        <Text style={styles.statusWarn}>You do not have permission to access teacher evaluation.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Content Evaluation (AI vs Manual)</Text>
      <Text style={styles.subtitle}>Review AI-generated quiz templates and approve for live use.</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#1d4ed8" />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Evaluation Summary</Text>
            <View style={styles.row}>
              <Text style={styles.label}>AI Accepted</Text>
              <Text style={styles.aiValue}>{summary.acceptedPct}%</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Manual Rework</Text>
              <Text style={styles.manualValue}>{summary.reworkPct}%</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Reviews</Text>
            {error ? <Text style={styles.statusWarn}>{error}</Text> : null}
            {aiQuizzes.length === 0 ? (
              <Text style={styles.emptyText}>No AI-generated quizzes available yet.</Text>
            ) : (
              aiQuizzes.map((quiz) => (
                <View key={quiz.id} style={styles.reviewItem}>
                  <View style={styles.row}>
                    <Text style={styles.label}>{quiz.title}</Text>
                    <Text style={quiz.is_published ? styles.statusPass : styles.statusWarn}>
                      {quiz.is_published ? 'AI Pass' : 'Manual Edit'}
                    </Text>
                  </View>
                  <Text style={styles.metaText}>
                    {quiz.class_level || 'Unassigned'} • {quiz.subject || 'General'} • {quiz.quiz_type} • {quiz.total_questions} questions
                  </Text>
                  <Pressable
                    style={styles.actionButton}
                    disabled={savingId === quiz.id}
                    onPress={() => togglePublish(quiz.id, quiz.is_published)}
                  >
                    {savingId === quiz.id ? (
                      <ActivityIndicator color="#1d4ed8" />
                    ) : (
                      <Text style={styles.actionButtonText}>
                        {quiz.is_published ? 'Mark as Needs Manual Edit' : 'Approve and Publish'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </>
      )}
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
  card: {
    backgroundColor: '#ffffff',
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  aiValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  manualValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b45309',
  },
  statusPass: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  statusWarn: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  reviewItem: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  actionButton: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
  },
});
