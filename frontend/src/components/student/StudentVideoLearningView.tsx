import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StudentVideoProgress, VideoSection } from '../../types/videoContent';
import { createVideoSectionsApi } from '../../api/videoSections';
import { detectVideoType } from '../../utils/youtubeUtils';
import DynamicVideoPlayer from '../player/DynamicVideoPlayer';
import SectionEndQuizPrompt from '../player/SectionEndQuizPrompt';
import VideoSectionTimeline from '../content/VideoSectionTimeline';
import DynamicQuizPanel from './DynamicQuizPanel';
import StudentSectionProgress from './StudentSectionProgress';

type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;

interface Props {
  contentId: string;
  videoUrl: string;
  apiFetch: ApiFetch;
  contentSectionOrder?: number;
}

// The student learning loop: watch a bounded section -> quiz prompt -> quiz ->
// progress.
export default function StudentVideoLearningView({ contentId, videoUrl, apiFetch, contentSectionOrder }: Props) {
  const api = useMemo(() => createVideoSectionsApi(apiFetch), [apiFetch]);

  const [sections, setSections] = useState<VideoSection[]>([]);
  const [progress, setProgress] = useState<Record<string, StudentVideoProgress>>({});
  const [loading, setLoading] = useState(true);

  const [activeSection, setActiveSection] = useState<VideoSection | null>(null);
  const [playToken, setPlayToken] = useState(0);
  const [endPromptVisible, setEndPromptVisible] = useState(false);
  const [autoOpenQuiz, setAutoOpenQuiz] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);

  const loadProgress = useCallback(async () => {
    try {
      const rows = await api.myProgress(contentId);
      const map: Record<string, StudentVideoProgress> = {};
      rows.forEach((r) => {
        map[r.sectionId] = r;
      });
      setProgress(map);
    } catch {
      /* progress is best-effort */
    }
  }, [api, contentId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .list(contentId, contentSectionOrder)
      .then((rows) => {
        if (cancelled) return;
        // Publishing is automatic now, so every returned section is shown.
        setSections(rows);
        // Cue and play the first section by default so the student lands on it.
        if (rows.length > 0) {
          setActiveSection(rows[0]);
          setPlayToken((t) => t + 1);
          api.saveProgress(rows[0].id, { videoWatchStatus: 'in_progress' }).catch(() => undefined);
        }
      })
      .catch(() => !cancelled && setSections([]))
      .finally(() => !cancelled && setLoading(false));
    loadProgress();
    return () => {
      cancelled = true;
    };
  }, [api, contentId, contentSectionOrder, loadProgress]);

  const playSection = useCallback(
    (section: VideoSection) => {
      setActiveSection(section);
      setEndPromptVisible(false);
      setAutoOpenQuiz(false);
      setPlayToken((t) => t + 1);
      api.saveProgress(section.id, { videoWatchStatus: 'in_progress' }).catch(() => undefined);
    },
    [api],
  );

  const handleSectionEnd = useCallback(() => {
    if (!activeSection) return;
    setEndPromptVisible(true);
    api
      .saveProgress(activeSection.id, {
        videoWatchStatus: 'completed',
        watchedSeconds: activeSection.duration,
      })
      .then(() => loadProgress())
      .catch(() => undefined);
  }, [activeSection, api, loadProgress]);

  const completedSectionIds = useMemo(
    () => Object.values(progress).filter((p) => p.videoWatchStatus === 'completed').map((p) => p.sectionId),
    [progress],
  );

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 24 }} color="#4A90E2" />;
  }

  if (sections.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No learning sections are available for this video yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <DynamicVideoPlayer
        videoUrl={videoUrl}
        videoType={detectVideoType(videoUrl)}
        activeSection={activeSection}
        playToken={playToken}
        paused={quizOpen || endPromptVisible}
        onSectionEnd={handleSectionEnd}
      />

      <VideoSectionTimeline
        sections={sections}
        activeSectionId={activeSection?.id}
        completedSectionIds={completedSectionIds}
        onSelect={playSection}
      />

      <DynamicQuizPanel
        api={api}
        activeSectionId={activeSection?.id ?? null}
        autoOpen={autoOpenQuiz}
        onRendererOpenChange={setQuizOpen}
        onQuizCompleted={() => {
          setAutoOpenQuiz(false);
          loadProgress();
        }}
      />

      <StudentSectionProgress sections={sections} progress={progress} />

      <SectionEndQuizPrompt
        visible={endPromptVisible}
        sectionTitle={activeSection?.title || ''}
        hasQuiz={!!activeSection?.quizId}
        onStartQuiz={() => {
          setEndPromptVisible(false);
          setAutoOpenQuiz(true);
        }}
        onReplay={() => {
          setEndPromptVisible(false);
          setPlayToken((t) => t + 1);
        }}
        onClose={() => setEndPromptVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingVertical: 8 },
  empty: { padding: 20, borderRadius: 12, backgroundColor: '#F7F8FC', borderWidth: 1, borderColor: '#ECECF4' },
  emptyText: { fontSize: 14, color: '#8A8AA0', textAlign: 'center' },
});
