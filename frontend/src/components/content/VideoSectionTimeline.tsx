import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import type { VideoSection } from '../../types/videoContent';
import { formatTime } from '../../utils/timeUtils';
import { getSectionVisual } from './sectionStatus';

interface Props {
  sections: VideoSection[];
  activeSectionId?: string;
  completedSectionIds?: string[];
  onSelect?: (section: VideoSection) => void;
}

// Visual timeline of the sections below the video.
export default function VideoSectionTimeline({ sections, activeSectionId, completedSectionIds = [], onSelect }: Props) {
  if (sections.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {sections.map((section, index) => {
        const visual = getSectionVisual(section);
        const active = section.id === activeSectionId;
        const completed = completedSectionIds.includes(section.id);
        return (
          <Pressable
            key={section.id}
            onPress={() => onSelect?.(section)}
            style={[
              styles.block,
              { borderColor: visual.color, backgroundColor: visual.bg },
              active && styles.active,
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.index}>{index + 1}</Text>
              {completed ? <CheckCircle2 size={14} color="#2FA36B" /> : null}
            </View>
            <Text style={styles.title} numberOfLines={1}>{section.title}</Text>
            <Text style={styles.time}>{formatTime(section.startTime)} - {formatTime(section.endTime)}</Text>
            <Text style={[styles.badge, { color: visual.color }]}>
              {section.quizId ? 'Quiz attached' : 'No quiz'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingVertical: 8, paddingHorizontal: 2 },
  block: { minWidth: 130, borderRadius: 12, borderWidth: 1.5, padding: 10, gap: 3 },
  active: { transform: [{ scale: 1.03 }], borderWidth: 2.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  index: { fontSize: 12, fontWeight: '800', color: '#5A5A7A' },
  title: { fontSize: 13, fontWeight: '700', color: '#2A2A44' },
  time: { fontSize: 11, color: '#6B6B80' },
  badge: { fontSize: 11, fontWeight: '600' },
});
