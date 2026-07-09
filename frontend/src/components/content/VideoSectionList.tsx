import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { VideoSection } from '../../types/videoContent';
import VideoSectionCard from './VideoSectionCard';

interface Props {
  sections: VideoSection[];
  onEdit?: (section: VideoSection) => void;
  onDelete?: (section: VideoSection) => void;
  onPreview?: (section: VideoSection) => void;
  onAttachQuiz?: (section: VideoSection) => void;
}

export default function VideoSectionList({ sections, onEdit, onDelete, onPreview, onAttachQuiz }: Props) {
  if (sections.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No video sections yet. Create one to divide the video into learning segments.</Text>
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {sections.map((section) => (
        <VideoSectionCard
          key={section.id}
          section={section}
          onEdit={onEdit}
          onDelete={onDelete}
          onPreview={onPreview}
          onAttachQuiz={onAttachQuiz}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  empty: { padding: 18, borderRadius: 12, backgroundColor: '#F7F8FC', borderWidth: 1, borderColor: '#ECECF4', borderStyle: 'dashed' },
  emptyText: { fontSize: 13, color: '#8A8AA0', textAlign: 'center', lineHeight: 19 },
});
