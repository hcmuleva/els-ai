import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Circle, CirclePlay } from 'lucide-react-native';
import type { StudentVideoProgress, VideoSection, WatchStatus } from '../../types/videoContent';

interface Props {
  sections: VideoSection[];
  progress: Record<string, StudentVideoProgress>;
}

function statusIcon(status: WatchStatus | undefined) {
  if (status === 'completed') return <CheckCircle2 size={16} color="#2FA36B" />;
  if (status === 'in_progress') return <CirclePlay size={16} color="#4A90E2" />;
  return <Circle size={16} color="#C5C5D5" />;
}

export default function StudentSectionProgress({ sections, progress }: Props) {
  const completed = sections.filter((s) => progress[s.id]?.videoWatchStatus === 'completed' && progress[s.id]?.quizStatus === 'completed').length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Your progress ({completed}/{sections.length})</Text>
      {sections.map((section) => {
        const p = progress[section.id];
        return (
          <View key={section.id} style={styles.row}>
            <View style={styles.statusCol}>{statusIcon(p?.videoWatchStatus)}</View>
            <Text style={styles.title} numberOfLines={1}>{section.title}</Text>
            <Text style={[styles.quiz, p?.quizStatus === 'completed' && styles.quizDone]}>
              {p?.quizStatus === 'completed'
                ? `Quiz ${p.quizScore ?? 0}%`
                : section.quizId
                ? 'Quiz pending'
                : 'No quiz'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: '#ECECF4' },
  heading: { fontSize: 14, fontWeight: '700', color: '#2A2A44', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusCol: { width: 20, alignItems: 'center' },
  title: { flex: 1, fontSize: 13, color: '#3A3A54' },
  quiz: { fontSize: 12, color: '#8A8AA0' },
  quizDone: { color: '#2FA36B', fontWeight: '700' },
});
