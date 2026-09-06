import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pencil, Trash2, Play, HelpCircle } from 'lucide-react-native';
import type { VideoSection } from '../../types/videoContent';
import { formatTime, formatDuration } from '../../utils/timeUtils';
import { getSectionVisual } from './sectionStatus';

interface Props {
  section: VideoSection;
  onEdit?: (section: VideoSection) => void;
  onDelete?: (section: VideoSection) => void;
  onPreview?: (section: VideoSection) => void;
  onAttachQuiz?: (section: VideoSection) => void;
}

export default function VideoSectionCard({ section, onEdit, onDelete, onPreview, onAttachQuiz }: Props) {
  const visual = getSectionVisual(section);
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{section.title}</Text>
          <Text style={styles.time}>
            {formatTime(section.startTime)} - {formatTime(section.endTime)} · {formatDuration(section.duration)}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: visual.bg }]}>
          <Text style={[styles.badgeText, { color: visual.color }]}>{visual.label}</Text>
        </View>
      </View>

      {section.description ? <Text style={styles.desc} numberOfLines={2}>{section.description}</Text> : null}

      <View style={styles.meta}>
        {section.difficulty ? <Text style={styles.metaTag}>{section.difficulty}</Text> : null}
        {section.ageGroup ? <Text style={styles.metaTag}>Age {section.ageGroup}</Text> : null}
        {section.category ? <Text style={styles.metaTag}>{section.category}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={() => onPreview?.(section)}>
          <Play size={15} color="#2D5DC9" />
          <Text style={styles.actionText}>Preview</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => onAttachQuiz?.(section)}>
          <HelpCircle size={15} color={section.quizId ? '#2FA36B' : '#C77700'} />
          <Text style={styles.actionText}>{section.quizId ? 'Quiz' : 'Attach quiz'}</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => onEdit?.(section)}>
          <Pencil size={15} color="#5A5A7A" />
          <Text style={styles.actionText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => onDelete?.(section)}>
          <Trash2 size={15} color="#D64545" />
          <Text style={[styles.actionText, { color: '#D64545' }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: '#ECECF4' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 15, fontWeight: '700', color: '#2A2A44' },
  time: { fontSize: 12, color: '#6B6B80', marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  desc: { fontSize: 13, color: '#5A5A7A', lineHeight: 18 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaTag: { fontSize: 11, color: '#5A5A7A', backgroundColor: '#F3F4FA', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 13, color: '#5A5A7A', fontWeight: '600' },
});
