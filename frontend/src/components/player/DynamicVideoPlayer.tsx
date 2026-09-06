import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { detectVideoType, getYouTubeVideoId } from '../../utils/youtubeUtils';
import type { VideoType } from '../../types/videoContent';
import YouTubeSectionPlayer from './YouTubeSectionPlayer';
import UploadedVideoSectionPlayer from './UploadedVideoSectionPlayer';

interface Props {
  videoUrl: string;
  videoType?: VideoType;
  activeSection: { startTime: number; endTime: number } | null;
  playToken: number;
  paused?: boolean;
  onSectionEnd: () => void;
  onTick?: (currentTime: number) => void;
}

// Chooses the correct section player for the video source and delegates the
// bounded start/end playback to it.
export default function DynamicVideoPlayer({
  videoUrl,
  videoType,
  activeSection,
  playToken,
  paused,
  onSectionEnd,
  onTick,
}: Props) {
  if (!videoUrl) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Add a video URL to begin.</Text>
      </View>
    );
  }
  if (!activeSection) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Select a section to play.</Text>
      </View>
    );
  }

  const type = videoType || detectVideoType(videoUrl);
  if (type === 'youtube') {
    const videoId = getYouTubeVideoId(videoUrl);
    if (!videoId) {
      return (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Invalid YouTube URL.</Text>
        </View>
      );
    }
    return (
      <YouTubeSectionPlayer
        videoId={videoId}
        startTime={activeSection.startTime}
        endTime={activeSection.endTime}
        playToken={playToken}
        paused={paused}
        onSectionEnd={onSectionEnd}
        onTick={onTick}
      />
    );
  }

  return (
    <UploadedVideoSectionPlayer
      url={videoUrl}
      startTime={activeSection.startTime}
      endTime={activeSection.endTime}
      playToken={playToken}
      paused={paused}
      onSectionEnd={onSectionEnd}
      onTick={onTick}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    backgroundColor: '#EEF0F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: '#8A8AA0', fontSize: 14 },
});
