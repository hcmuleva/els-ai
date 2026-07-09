import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TeacherVideoProgressSummary } from '../../types/videoContent';

interface Props {
  summary: TeacherVideoProgressSummary;
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.value, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export default function SectionCompletionSummary({ summary }: Props) {
  return (
    <View style={styles.grid}>
      <Stat label="Total sections" value={summary.totalSections} />
      <Stat label="Published" value={summary.publishedSections} accent="#2FA36B" />
      <Stat label="With quiz" value={summary.sectionsWithQuiz} accent="#2F6FED" />
      <Stat label="Without quiz" value={summary.sectionsWithoutQuiz} accent="#C77700" />
      <Stat label="Completion" value={`${summary.studentCompletionPct}%`} />
      <Stat label="Avg score" value={summary.quizAverageScore != null ? `${summary.quizAverageScore}%` : '-'} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, minWidth: 100, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#ECECF4' },
  value: { fontSize: 22, fontWeight: '800', color: '#2A2A44' },
  label: { fontSize: 12, color: '#8A8AA0', marginTop: 2 },
});
