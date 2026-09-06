import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { VideoSection } from '../../types/videoContent';
import { createVideoSectionsApi, type CreateSectionInput } from '../../api/videoSections';
import { detectVideoType } from '../../utils/youtubeUtils';
import DynamicVideoPlayer from '../player/DynamicVideoPlayer';
import SectionEndQuizPrompt from '../player/SectionEndQuizPrompt';
import CreateVideoSectionButton from './CreateVideoSectionButton';
import VideoSectionList from './VideoSectionList';
import VideoSectionTimeline from './VideoSectionTimeline';
import VideoSectionModal from './VideoSectionModal';
import QuizAttachPanel from './QuizAttachPanel';
import CreateQuizModal from '../quiz/CreateQuizModal';
import type { SubjectCatalogItem } from '../quiz/QuestionEditor';
import type { AppUser } from '../../types/roles';

type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;

interface Props {
  contentId: string;
  videoUrl: string;
  videoDuration?: number | null;
  apiFetch: ApiFetch;
  classLevel?: string;
  subject?: string;
  contentSectionOrder?: number;
  onSectionsChange?: (sections: VideoSection[]) => void;
  user?: AppUser | null;
  subjectCatalog?: SubjectCatalogItem[];
}

function confirmDelete(onConfirm: () => void) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm('Delete this video section?')) onConfirm();
    return;
  }
  Alert.alert('Delete section', 'Delete this video section?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

// Orchestrates the full creator experience: create/edit/delete sections, attach
// quizzes, preview bounded playback, and publish.
export default function VideoSectionBuilder({ contentId, videoUrl, videoDuration, apiFetch, classLevel, subject, contentSectionOrder, onSectionsChange, user, subjectCatalog }: Props) {
  const api = useMemo(() => createVideoSectionsApi(apiFetch), [apiFetch]);

  // Keep the latest callback in a ref so refresh() does not depend on an
  // unstable inline prop (which would re-fire the load effect on every render).
  const onSectionsChangeRef = useRef(onSectionsChange);
  useEffect(() => {
    onSectionsChangeRef.current = onSectionsChange;
  }, [onSectionsChange]);

  const [sections, setSections] = useState<VideoSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<VideoSection | null>(null);
  const [quizPanelSection, setQuizPanelSection] = useState<VideoSection | null>(null);
  const [createQuizForSection, setCreateQuizForSection] = useState<VideoSection | null>(null);

  const [previewSection, setPreviewSection] = useState<VideoSection | null>(null);
  const [playToken, setPlayToken] = useState(0);
  const [endPromptVisible, setEndPromptVisible] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.list(contentId, contentSectionOrder);
      setSections(rows);
      onSectionsChangeRef.current?.(rows);
    } catch (e: any) {
      setError(e?.message || 'Failed to load sections');
    } finally {
      setLoading(false);
    }
  }, [api, contentId, contentSectionOrder]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = useCallback(
    async (input: CreateSectionInput, sectionId?: string) => {
      if (sectionId) {
        await api.update(sectionId, input);
      } else {
        await api.create(contentId, input, contentSectionOrder);
      }
      await refresh();
    },
    [api, contentId, contentSectionOrder, refresh],
  );

  const handleDelete = useCallback(
    (section: VideoSection) => {
      confirmDelete(async () => {
        try {
          await api.remove(section.id);
          await refresh();
        } catch (e: any) {
          setError(e?.message || 'Failed to delete section');
        }
      });
    },
    [api, refresh],
  );

  const handleAttachQuiz = useCallback(
    async (quizId: string) => {
      if (!quizPanelSection) return;
      await api.attachQuiz(quizPanelSection.id, quizId);
      await refresh();
    },
    [api, quizPanelSection, refresh],
  );

  const handleRemoveQuiz = useCallback(
    async (section: VideoSection) => {
      try {
        await api.detachQuiz(section.id);
        await refresh();
      } catch (e: any) {
        setError(e?.message || 'Failed to remove quiz');
      }
    },
    [api, refresh],
  );

  const handlePreview = useCallback((section: VideoSection) => {
    setPreviewSection(section);
    setEndPromptVisible(false);
    setPlayToken((t) => t + 1);
  }, []);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const videoType = detectVideoType(videoUrl);

  return (
    <View style={styles.container}>
      {isDesktop ? (
        <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 14 }}>
            {previewSection ? (
              <View style={styles.previewWrap}>
                <DynamicVideoPlayer
                  videoUrl={videoUrl}
                  videoType={videoType}
                  activeSection={previewSection}
                  playToken={playToken}
                  onSectionEnd={() => setEndPromptVisible(true)}
                />
                <Text style={styles.previewLabel}>Previewing: {previewSection.title}</Text>
              </View>
            ) : (
              <View style={{ height: 260, backgroundColor: '#1E1E2E', borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <Text style={{ color: '#A0A0C0', fontSize: 14, textAlign: 'center' }}>
                  🎬 Select a chapter from the list or click "Add Section" to preview video chapters.
                </Text>
              </View>
            )}

            <VideoSectionTimeline
              sections={sections}
              activeSectionId={previewSection?.id}
              onSelect={handlePreview}
            />
          </View>

          <View style={{ flex: 1, gap: 14 }}>
            <CreateVideoSectionButton
              onPress={() => {
                setEditingSection(null);
                setModalOpen(true);
              }}
              disabled={!videoUrl}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {loading ? (
              <ActivityIndicator accessibilityLabel="Loading" style={{ marginTop: 16 }} color="#2D5DC9" />
            ) : (
              <VideoSectionList
                sections={sections}
                onEdit={(section) => {
                  setEditingSection(section);
                  setModalOpen(true);
                }}
                onDelete={handleDelete}
                onPreview={handlePreview}
                onAttachQuiz={(section) => setQuizPanelSection(section)}
              />
            )}
          </View>
        </View>
      ) : (
        <>
          {previewSection ? (
            <View style={styles.previewWrap}>
              <DynamicVideoPlayer
                videoUrl={videoUrl}
                videoType={videoType}
                activeSection={previewSection}
                playToken={playToken}
                onSectionEnd={() => setEndPromptVisible(true)}
              />
              <Text style={styles.previewLabel}>Previewing: {previewSection.title}</Text>
            </View>
          ) : null}

          <VideoSectionTimeline
            sections={sections}
            activeSectionId={previewSection?.id}
            onSelect={handlePreview}
          />

          <CreateVideoSectionButton
            onPress={() => {
              setEditingSection(null);
              setModalOpen(true);
            }}
            disabled={!videoUrl}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading ? (
            <ActivityIndicator accessibilityLabel="Loading" style={{ marginTop: 16 }} color="#2D5DC9" />
          ) : (
            <VideoSectionList
              sections={sections}
              onEdit={(section) => {
                setEditingSection(section);
                setModalOpen(true);
              }}
              onDelete={handleDelete}
              onPreview={handlePreview}
              onAttachQuiz={(section) => setQuizPanelSection(section)}
            />
          )}
        </>
      )}

      <VideoSectionModal
        visible={modalOpen}
        editingSection={editingSection}
        existingSections={sections}
        videoUrl={videoUrl}
        videoDuration={videoDuration}
        onSave={handleSave}
        onClose={() => setModalOpen(false)}
      />

      <QuizAttachPanel
        visible={!!quizPanelSection}
        apiFetch={apiFetch}
        classLevel={classLevel}
        subject={subject}
        currentQuizId={quizPanelSection?.quizId}
        onAttach={handleAttachQuiz}
        onDetach={async () => { if (quizPanelSection) await handleRemoveQuiz(quizPanelSection); }}
        onCreateNew={() => { const s = quizPanelSection; setQuizPanelSection(null); setCreateQuizForSection(s); }}
        onClose={() => setQuizPanelSection(null)}
      />

      <CreateQuizModal
        visible={!!createQuizForSection}
        apiFetch={apiFetch}
        user={user ?? null}
        initialClassLevel={classLevel}
        initialSubject={subject}
        subjectCatalog={subjectCatalog}
        onClose={() => setCreateQuizForSection(null)}
        onCreated={async (quiz) => {
          const sec = createQuizForSection;
          setCreateQuizForSection(null);
          if (sec) {
            try {
              await api.attachQuiz(sec.id, quiz.id);
              await refresh();
            } catch (e: any) {
              setError(e?.message || 'Failed to attach quiz');
            }
          }
        }}
      />

      <SectionEndQuizPrompt
        visible={endPromptVisible}
        sectionTitle={previewSection?.title || ''}
        hasQuiz={!!previewSection?.quizId}
        onStartQuiz={() => setEndPromptVisible(false)}
        onReplay={() => {
          setEndPromptVisible(false);
          setPlayToken((t) => t + 1);
        }}
        onClose={() => setEndPromptVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  previewWrap: { gap: 6 },
  previewLabel: { fontSize: 12, color: '#8A8AA0', fontStyle: 'italic' },
  error: { color: '#D64545', fontSize: 13 },
});
