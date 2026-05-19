import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/context/AuthContext';

type TeacherOverview = {
  summary: {
    total_quizzes: string;
    published_quizzes: string;
    ai_generated_quizzes: string;
    total_attempts: string;
    average_score_pct: string;
  };
  topGaps: Array<{
    question_id: string;
    question_title: string;
    quiz_title: string;
    attempts: string;
    incorrect_pct: string;
  }>;
  classPerformance: Array<{
    class_level: string;
    attempts: string;
    average_score_pct: string;
  }>;
};

export default function AssessmentDashboardScreen() {
  const { user, apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<TeacherOverview | null>(null);

  const isTeacherView = user?.activeRole === 'teacher' || user?.activeRole === 'admin' || user?.activeRole === 'superadmin';

  const loadOverview = useCallback(async () => {
    if (!isTeacherView) return;
    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/quizzes/teacher/overview');
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to load teacher assessment data');
      }
      setOverview(await res.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load teacher assessment data');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, isTeacherView]);

  useFocusEffect(
    useCallback(() => {
      loadOverview();
    }, [loadOverview]),
  );

  if (!isTeacherView) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Student Assessment Dashboard</Text>
        <Text style={styles.errorText}>You do not have permission to access teacher assessment.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Student Assessment Dashboard</Text>
      <Text style={styles.subtitle}>Track performance, submissions, and intervention needs.</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#1d4ed8" />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{Number(overview?.summary.average_score_pct || '0').toFixed(1)}%</Text>
              <Text style={styles.metricLabel}>Avg Score</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{overview?.summary.total_attempts || '0'}</Text>
              <Text style={styles.metricLabel}>Submissions</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{overview?.summary.total_quizzes || '0'}</Text>
              <Text style={styles.metricLabel}>Quiz Templates</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Gaps</Text>
            {overview?.topGaps?.length ? (
              overview.topGaps.map((gap) => (
                <View key={gap.question_id} style={styles.row}>
                  <View style={styles.gapLabelWrap}>
                    <Text style={styles.label}>{gap.question_title}</Text>
                    <Text style={styles.quizTitle}>{gap.quiz_title}</Text>
                  </View>
                  <Text style={styles.value}>{Number(gap.incorrect_pct).toFixed(1)}% incorrect</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No attempts yet to compute top gaps.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Class Performance</Text>
            {overview?.classPerformance?.length ? (
              overview.classPerformance.map((classRow) => (
                <View key={classRow.class_level} style={styles.row}>
                  <Text style={styles.label}>{classRow.class_level}</Text>
                  <Text style={styles.classValue}>
                    {Number(classRow.average_score_pct).toFixed(1)}% ({classRow.attempts} attempts)
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No class-level performance data available yet.</Text>
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
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
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
    gap: 10,
  },
  gapLabelWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  quizTitle: {
    fontSize: 11,
    color: '#64748b',
  },
  value: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '700',
  },
  classValue: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b91c1c',
  },
});
