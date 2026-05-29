import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../src/context/AuthContext';
import { useStudentProfile } from '../../src/context/StudentProfileContext';
import { getStandardLabel } from '../../src/constants/standards';

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

type ParentAssessment = {
  id: string;
  behavior: number;
  focus: number;
  regularity: number;
  creativity: number;
  academic: number;
  outdoorActivity: number;
  createdAt: string;
};

type ParentFeedbackItem = {
  id: string;
  feedback: string;
  attachmentUrl: string | null;
  createdAt: string;
};

type PickedFile = { dataUrl: string; fileName: string; mimeType: string };

const ASSESSMENT_FIELDS: Array<{ key: keyof Omit<ParentAssessment, 'id' | 'createdAt'>; label: string }> = [
  { key: 'behavior', label: 'Behavior' },
  { key: 'focus', label: 'Focus' },
  { key: 'regularity', label: 'Regularity' },
  { key: 'creativity', label: 'Creativity' },
  { key: 'academic', label: 'Academic' },
  { key: 'outdoorActivity', label: 'Outdoor Activity' },
];

const defaultScores: Record<keyof Omit<ParentAssessment, 'id' | 'createdAt'>, number> = {
  behavior: 0,
  focus: 0,
  regularity: 0,
  creativity: 0,
  academic: 0,
  outdoorActivity: 0,
};

async function pickFileAsDataUrl(accept: string): Promise<PickedFile> {
  if (Platform.OS !== 'web') throw new Error('Attachment upload is currently available on web.');
  return await new Promise((resolve, reject) => {
    const doc = (globalThis as any).document;
    if (!doc) return reject(new Error('File picker is unavailable.'));
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No file selected.'));
      const reader = new FileReader();
      reader.onload = () => resolve({
        dataUrl: String(reader.result || ''),
        fileName: file.name || 'uploaded-file',
        mimeType: file.type || 'image/png',
      });
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

function TeacherAssessmentDashboard() {
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
                  <Text style={styles.label}>{getStandardLabel(classRow.class_level)}</Text>
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

function ParentAssessmentDashboard() {
  const { apiFetch } = useAuth();
  const { linkedStudents, activeStudent, switchToStudent, loadingStudents } = useStudentProfile();
  const [loading, setLoading] = useState(true);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [scores, setScores] = useState(defaultScores);
  const [trends, setTrends] = useState<ParentAssessment[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [feedbackItems, setFeedbackItems] = useState<ParentFeedbackItem[]>([]);

  const selectedStudent = activeStudent;
  const showChildSelector = linkedStudents.length > 1;

  const averages = useMemo(() => {
    if (!trends.length) return defaultScores;
    return ASSESSMENT_FIELDS.reduce((acc, item) => {
      acc[item.key] = Number((trends.reduce((sum, row) => sum + row[item.key], 0) / trends.length).toFixed(1));
      return acc;
    }, { ...defaultScores });
  }, [trends]);

  const loadData = useCallback(async () => {
    if (!selectedStudent) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [trendRes, feedbackRes] = await Promise.all([
        apiFetch(`/students/${selectedStudent.id}/parent-assessment-trends?limit=12`),
        apiFetch(`/students/${selectedStudent.id}/parent-feedback?limit=10`),
      ]);

      if (!trendRes.ok) throw new Error('Failed to load assessment trends');
      const trendPayload = await trendRes.json();
      const loadedTrends = (trendPayload.trends || []) as ParentAssessment[];
      setTrends(loadedTrends);
      if (trendPayload.latest) {
        const latest = trendPayload.latest as ParentAssessment;
        setScores({
          behavior: latest.behavior,
          focus: latest.focus,
          regularity: latest.regularity,
          creativity: latest.creativity,
          academic: latest.academic,
          outdoorActivity: latest.outdoorActivity,
        });
      }

      if (feedbackRes.ok) {
        const feedbackPayload = await feedbackRes.json();
        setFeedbackItems((feedbackPayload.items || []) as ParentFeedbackItem[]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load parent assessment data');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, selectedStudent]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const submitAssessment = async () => {
    if (!selectedStudent) return;
    setSavingAssessment(true);
    setMessage('');
    setError('');
    try {
      const res = await apiFetch(`/students/${selectedStudent.id}/parent-assessments`, {
        method: 'POST',
        body: JSON.stringify(scores),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to save assessment');
      }
      setMessage('Assessment saved.');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save assessment');
    } finally {
      setSavingAssessment(false);
    }
  };

  const uploadAttachment = async () => {
    setUploading(true);
    setMessage('');
    setError('');
    try {
      const picked = await pickFileAsDataUrl('image/*');
      const res = await apiFetch('/assets/upload', {
        method: 'POST',
        body: JSON.stringify({
          fileName: picked.fileName,
          dataUrl: picked.dataUrl,
          mediaType: 'image',
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'Failed to upload attachment');
      setAttachmentUrl(String(payload.url || payload.canonicalUrl || ''));
      setMessage('Attachment uploaded.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  const submitFeedback = async () => {
    if (!selectedStudent || !feedbackText.trim()) return;
    setSavingFeedback(true);
    setMessage('');
    setError('');
    try {
      const res = await apiFetch(`/students/${selectedStudent.id}/parent-feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback: feedbackText.trim(), attachmentUrl: attachmentUrl.trim() || undefined }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to submit feedback');
      }
      setFeedbackText('');
      setAttachmentUrl('');
      setMessage('Feedback submitted.');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit feedback');
    } finally {
      setSavingFeedback(false);
    }
  };

  if (loadingStudents || loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  if (!selectedStudent) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Parent Assessment</Text>
        <Text style={styles.emptyText}>No child linked to this parent account.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Parent Assessment</Text>
      <Text style={styles.subtitle}>0 means NA, 10 is highest.</Text>

      {showChildSelector && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {linkedStudents.map((child) => (
            <Pressable
              key={child.id}
              onPress={() => switchToStudent(child.id)}
              style={[styles.childChip, child.id === selectedStudent.id && styles.childChipActive]}
            >
              <Text style={[styles.childChipText, child.id === selectedStudent.id && styles.childChipTextActive]}>
                {child.firstName}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Assessment Ratings</Text>
        {ASSESSMENT_FIELDS.map((field) => (
          <View key={field.key} style={styles.scoreRow}>
            <Text style={styles.label}>{field.label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scoreWrap}>
              {Array.from({ length: 11 }, (_, value) => (
                <Pressable
                  key={value}
                  onPress={() => setScores((prev) => ({ ...prev, [field.key]: value }))}
                  style={[styles.scorePill, scores[field.key] === value && styles.scorePillActive]}
                >
                  <Text style={[styles.scorePillText, scores[field.key] === value && styles.scorePillTextActive]}>{value}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ))}
        <Pressable style={styles.primaryBtn} onPress={submitAssessment} disabled={savingAssessment}>
          <Text style={styles.primaryBtnText}>{savingAssessment ? 'Saving...' : 'Save Assessment'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Feedback</Text>
        <TextInput
          placeholder="Share feedback..."
          multiline
          value={feedbackText}
          onChangeText={setFeedbackText}
          style={styles.textArea}
        />
        <TextInput
          placeholder="Attachment URL (optional)"
          value={attachmentUrl}
          onChangeText={setAttachmentUrl}
          style={styles.input}
        />
        <Pressable style={styles.secondaryBtn} onPress={uploadAttachment} disabled={uploading}>
          <Text style={styles.secondaryBtnText}>{uploading ? 'Uploading...' : 'Upload Attachment'}</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={submitFeedback} disabled={savingFeedback}>
          <Text style={styles.primaryBtnText}>{savingFeedback ? 'Submitting...' : 'Submit Feedback'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Assessment Trends</Text>
        <View style={styles.metricsRow}>
          {ASSESSMENT_FIELDS.map((field) => (
            <View key={field.key} style={styles.metricCard}>
              <Text style={styles.metricValue}>{averages[field.key].toFixed(1)}</Text>
              <Text style={styles.metricLabel}>{field.label}</Text>
            </View>
          ))}
        </View>
        {trends.length ? trends.map((item) => (
          <Text key={item.id} style={styles.trendText}>
            {new Date(item.createdAt).toLocaleDateString()} · B:{item.behavior} F:{item.focus} R:{item.regularity} C:{item.creativity} A:{item.academic} O:{item.outdoorActivity}
          </Text>
        )) : <Text style={styles.emptyText}>No assessments submitted yet.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Feedback</Text>
        {feedbackItems.length ? feedbackItems.map((item) => (
          <View key={item.id} style={styles.feedbackItem}>
            <Text style={styles.feedbackDate}>{new Date(item.createdAt).toLocaleString()}</Text>
            <Text style={styles.feedbackText}>{item.feedback}</Text>
            {!!item.attachmentUrl && <Text style={styles.linkText}>{item.attachmentUrl}</Text>}
          </View>
        )) : <Text style={styles.emptyText}>No feedback submitted yet.</Text>}
      </View>

      {!!message && <Text style={styles.successText}>{message}</Text>}
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </ScrollView>
  );
}

export default function AssessmentDashboardScreen() {
  const { user } = useAuth();
  const isTeacherView = user?.activeRole === 'teacher' || user?.activeRole === 'admin' || user?.activeRole === 'superadmin';
  const isParentView = user?.activeRole === 'parent';

  if (isTeacherView) return <TeacherAssessmentDashboard />;
  if (isParentView) return <ParentAssessmentDashboard />;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Assessment Dashboard</Text>
      <Text style={styles.errorText}>You do not have permission to access this page.</Text>
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
  center: {
    justifyContent: 'center',
    alignItems: 'center',
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
    flexWrap: 'wrap',
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
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  chips: {
    gap: 8,
  },
  childChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  childChipActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  childChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  childChipTextActive: {
    color: '#ffffff',
  },
  scoreRow: {
    gap: 6,
  },
  scoreWrap: {
    gap: 6,
  },
  scorePill: {
    minWidth: 30,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  scorePillActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  scorePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  scorePillTextActive: {
    color: '#ffffff',
  },
  primaryBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderColor: '#93c5fd',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '700',
  },
  textArea: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 10,
    textAlignVertical: 'top',
    backgroundColor: '#ffffff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#ffffff',
  },
  trendText: {
    fontSize: 12,
    color: '#334155',
  },
  feedbackItem: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    gap: 4,
  },
  feedbackDate: {
    fontSize: 11,
    color: '#64748b',
  },
  feedbackText: {
    fontSize: 13,
    color: '#1e293b',
  },
  linkText: {
    fontSize: 11,
    color: '#1d4ed8',
  },
});
