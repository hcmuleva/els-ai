import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/context/AuthContext';
import { getStandardLabel } from '../../src/constants/standards';

type TeacherOverview = {
  summary: {
    total_quizzes: string;
    published_quizzes: string;
    ai_generated_quizzes: string;
    total_attempts: string;
    average_score_pct: string;
  };
  classPerformance: Array<{
    class_level: string;
    attempts: string;
    average_score_pct: string;
  }>;
  topGaps: Array<{
    question_id: string;
    question_title: string;
    incorrect_pct: string;
  }>;
  difficultyMix: Array<{
    difficulty_level: string;
    quiz_count: string;
  }>;
};

export default function ReportsScreen() {
  const { user, apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<TeacherOverview | null>(null);

  const isTeacherView = user?.activeRole === 'teacher' || user?.activeRole === 'admin' || user?.activeRole === 'superadmin';

  const loadTeacherReport = useCallback(async () => {
    if (!isTeacherView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/quizzes/teacher/overview');
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to load teacher reports');
      }
      setOverview(await res.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load teacher reports');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, isTeacherView]);

  useFocusEffect(
    useCallback(() => {
      loadTeacherReport();
    }, [loadTeacherReport]),
  );

  if (!isTeacherView) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>Role-based reports are shown for the selected profile.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Teacher Reports</Text>
      <Text style={styles.subtitle}>Class performance and topic-level insights.</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#1d4ed8" />
      ) : error ? (
        <Text style={styles.warn}>{error}</Text>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Class Performance</Text>
            {overview?.classPerformance?.length ? (
              overview.classPerformance.map((classItem) => (
                <View key={classItem.class_level} style={styles.row}>
                  <Text style={styles.label}>{getStandardLabel(classItem.class_level)}</Text>
                  <Text style={styles.value}>
                    {Number(classItem.average_score_pct).toFixed(1)}% avg • {classItem.attempts} attempts
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.warn}>No class performance data available yet.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Topic Insights</Text>
            {overview?.topGaps?.length ? (
              overview.topGaps.map((gap) => (
                <View key={gap.question_id} style={styles.row}>
                  <Text style={styles.label}>{gap.question_title}</Text>
                  <Text style={Number(gap.incorrect_pct) >= 25 ? styles.warn : styles.good}>
                    {Number(gap.incorrect_pct).toFixed(1)}% incorrect
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.warn}>No topic-gap data available yet.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quiz Pipeline</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Total Quizzes</Text>
              <Text style={styles.value}>{overview?.summary.total_quizzes || '0'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Published</Text>
              <Text style={styles.good}>{overview?.summary.published_quizzes || '0'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>AI Generated</Text>
              <Text style={styles.value}>{overview?.summary.ai_generated_quizzes || '0'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Average Score</Text>
              <Text style={styles.good}>{Number(overview?.summary.average_score_pct || '0').toFixed(1)}%</Text>
            </View>
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
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  value: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  good: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  warn: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
});
