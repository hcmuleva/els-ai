import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import type { TeacherVideoProgressSummary } from '../../types/videoContent';
import { createVideoSectionsApi } from '../../api/videoSections';
import SectionCompletionSummary from './SectionCompletionSummary';

type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;

interface Props {
  contentId: string;
  contentTitle?: string;
  apiFetch: ApiFetch;
}

function StudentList({ title, rows, accent }: { title: string; rows: Array<{ name: string | null; score?: number }>; accent: string }) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.listBlock}>
      <Text style={[styles.listTitle, { color: accent }]}>{title} ({rows.length})</Text>
      {rows.map((r, i) => (
        <View key={i} style={styles.listRow}>
          <Text style={styles.name}>{r.name || 'Unknown student'}</Text>
          {r.score != null ? <Text style={[styles.score, { color: accent }]}>{r.score}%</Text> : null}
        </View>
      ))}
    </View>
  );
}

// Section-level progress dashboard for teachers.
export default function TeacherVideoProgressDashboard({ contentId, contentTitle, apiFetch }: Props) {
  const api = useMemo(() => createVideoSectionsApi(apiFetch), [apiFetch]);
  const [summary, setSummary] = useState<TeacherVideoProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .dashboard(contentId)
      .then((d) => !cancelled && setSummary(d))
      .catch((e) => !cancelled && setError(e?.message || 'Failed to load dashboard'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api, contentId]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} color="#4A90E2" />;
  if (error || !summary) return <Text style={styles.error}>{error || 'No data'}</Text>;

  return (
    <View style={styles.container}>
      {contentTitle ? <Text style={styles.heading}>{contentTitle}</Text> : null}
      <SectionCompletionSummary summary={summary} />

      <StudentList
        title="Pending quiz"
        rows={summary.studentsPendingQuiz.map((s) => ({ name: s.name }))}
        accent="#C77700"
      />
      <StudentList
        title="Failed quiz"
        rows={summary.studentsFailedQuiz.map((s) => ({ name: s.name, score: s.score }))}
        accent="#D64545"
      />
      {summary.studentsRequiringIntervention.length > 0 ? (
        <View style={styles.interventionBanner}>
          <AlertTriangle size={16} color="#D64545" />
          <Text style={styles.interventionText}>
            {summary.studentsRequiringIntervention.length} student(s) require intervention.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  heading: { fontSize: 18, fontWeight: '700', color: '#2A2A44' },
  error: { color: '#D64545', fontSize: 13, marginTop: 12 },
  listBlock: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#ECECF4', gap: 6 },
  listTitle: { fontSize: 14, fontWeight: '700' },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 13, color: '#3A3A54' },
  score: { fontSize: 13, fontWeight: '700' },
  interventionBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FDEAEA', borderRadius: 12, padding: 12 },
  interventionText: { color: '#D64545', fontSize: 13, fontWeight: '600', flex: 1 },
});
