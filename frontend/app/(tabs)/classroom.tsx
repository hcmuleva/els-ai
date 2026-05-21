import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChevronRight, Play, Star, BookOpen, Clock, X, Trophy } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';

import { getStandardLabel, STANDARD_OPTIONS } from '../../src/constants/standards';
import { API_BASE_URL, useAuth } from '../../src/context/AuthContext';
import QuizRenderer from '../../src/components/quiz/QuizRenderer';

type LearningContentItem = {
  id: string;
  title: string;
  classLevel: string;
  subject: string;
  contentType: string;
  mediaUrl?: string;
  externalUrl?: string;
  textContent?: string;
  status?: 'not_started' | 'in_progress' | 'completed';
  sections?: Array<{
    id?: string;
    title?: string;
    contentType: string;
    mediaUrl?: string;
    externalUrl?: string;
    textContent?: string;
  }>;
};

type ClassroomQuiz = {
  id: string;
  title: string;
  classLevel: string;
  subject: string;
  quizType: string;
  difficultyLevel?: string;
  totalQuestions: number;
  status: 'not_attempted' | 'completed';
  score?: number;
};

type ClassroomAssignment = {
  id: string;
  title: string;
  description?: string;
  attachmentUrl?: string;
  instructions?: string;
  dueDate?: string | null;
  isTimeBound: boolean;
  status: 'pending' | 'submitted' | 'overdue';
  submission?: {
    submittedAt?: string | null;
    submissionText?: string;
    attachmentUrl?: string;
  } | null;
};

type ClassroomItem = {
  id: string;
  title: string;
  description?: string;
  classLevel: string;
  scheduleType: 'instant' | 'scheduled';
  startTime?: string | null;
  status: 'active' | 'completed' | 'draft';
  completionPct: number;
  contents: LearningContentItem[];
  quizzes: ClassroomQuiz[];
  assignments: ClassroomAssignment[];
};

type SelectorField = 'class';
type StudentTab = 'content' | 'quiz' | 'assignments';
type PickedFile = { dataUrl: string; fileName: string; mimeType: string };

const STATUS_COLORS: Record<ClassroomItem['status'], string> = {
  active: '#16a34a',
  completed: '#6b7280',
  draft: '#2563eb',
};

async function pickFileAsDataUrl(accept: string): Promise<PickedFile> {
  if (Platform.OS !== 'web') {
    throw new Error('File upload is currently supported on web. On mobile, paste submission URL manually.');
  }

  return await new Promise((resolve, reject) => {
    const doc = (globalThis as any).document;
    if (!doc) {
      reject(new Error('File picker is unavailable in this environment.'));
      return;
    }
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          dataUrl: String(reader.result || ''),
          fileName: file.name || 'uploaded-file',
          mimeType: file.type || '',
        });
      reader.onerror = () => reject(new Error('Failed to read selected file.'));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

function resolveMediaType(file: PickedFile): 'image' | 'audio' | 'video' {
  const mime = file.mimeType.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  return 'video';
}

function resolveMediaUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('/media')) return `${API_BASE_URL}${url}`;
  return url;
}

function isImageUrl(url: string): boolean {
  if (!url) return false;
  const sanitized = url.split('?')[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(sanitized);
}

function isYouTubeUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be');
}

function getYouTubeEmbedUrl(url: string): string {
  if (!url) return '';
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
  const videoId = match ? match[1] : '';
  return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : url;
}

export default function ClassroomScreen() {
  const { apiFetch, isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingSubmission, setSavingSubmission] = useState(false);
  const [selectorField, setSelectorField] = useState<SelectorField | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [classLevels, setClassLevels] = useState<string[]>(STANDARD_OPTIONS.map((item) => item.value));
  const [selectedClassLevel, setSelectedClassLevel] = useState('');
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudentTab>('content');
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [previewContentIndex, setPreviewContentIndex] = useState<number | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<ClassroomAssignment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionAttachmentUrl, setSubmissionAttachmentUrl] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);



  const loadClassrooms = useCallback(
    async (classLevelOverride?: string) => {
      const classLevel = classLevelOverride ?? selectedClassLevel;
      const query = new URLSearchParams();
      if (classLevel) query.set('class_level', classLevel);
      const res = await apiFetch(`/quizzes/students/classrooms?${query.toString()}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to load classroom data');
      }
      const payload = await res.json();
      const loadedClassrooms = (payload.classrooms || []) as ClassroomItem[];
      const loadedLevels = (payload.classLevels || []) as string[];
      const currentLevel = (payload.currentClassLevel as string) || classLevel || loadedLevels[0] || '';

      setClassrooms(loadedClassrooms);
      setClassLevels(
        loadedLevels.length > 0
          ? loadedLevels
          : [...new Set(loadedClassrooms.map((item) => item.classLevel).filter(Boolean))],
      );
      setSelectedClassLevel(currentLevel);
      setSelectedClassroomId((current) => {
        if (current && loadedClassrooms.some((item) => item.id === current)) return current;
        return loadedClassrooms[0]?.id || null;
      });
    },
    [apiFetch, selectedClassLevel],
  );

  const loadStudentClassLevel = useCallback(async () => {
    if (!user?.id) return '';
    const res = await apiFetch(`/users/${user.id}`);
    if (!res.ok) return '';
    const profile = await res.json();
    return (profile.classLevel as string) || '';
  }, [apiFetch, user?.id]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setMessage(null);
    try {
      const profileClass = await loadStudentClassLevel();
      await loadClassrooms(profileClass);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load classrooms' });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, loadClassrooms, loadStudentClassLevel]);

  const selectedClassroom = useMemo(
    () => classrooms.find((item) => item.id === selectedClassroomId) || classrooms[0] || null,
    [classrooms, selectedClassroomId],
  );

  const previewContent = previewContentIndex !== null && selectedClassroom 
    ? selectedClassroom.contents[previewContentIndex] 
    : null;

  const hasNextContent = previewContentIndex !== null && selectedClassroom 
    ? previewContentIndex < selectedClassroom.contents.length - 1 
    : false;
  const hasPrevContent = previewContentIndex !== null 
    ? previewContentIndex > 0 
    : false;

  const pendingAssignments = useMemo(
    () => selectedClassroom?.assignments.filter((assignment) => assignment.status !== 'submitted').length || 0,
    [selectedClassroom],
  );

  const completedActivities = useMemo(() => selectedClassroom?.completionPct || 0, [selectedClassroom]);

  const openExternalResource = async (url: string) => {
    const target = resolveMediaUrl(url);
    if (!target) return;
    try {
      const supported = await Linking.canOpenURL(target);
      if (!supported) throw new Error('Cannot open this link');
      await Linking.openURL(target);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to open link' });
    }
  };

  const continueLearning = () => {
    setActiveTab('content');
    if (!selectedClassroom || selectedClassroom.contents.length === 0) return;
    const nextIdx = selectedClassroom.contents.findIndex(item => item.status === 'in_progress') !== -1 
      ? selectedClassroom.contents.findIndex(item => item.status === 'in_progress')
      : selectedClassroom.contents.findIndex(item => item.status !== 'completed') !== -1
        ? selectedClassroom.contents.findIndex(item => item.status !== 'completed')
        : 0;
    setPreviewContentIndex(nextIdx);
  };

  const openAssignment = (assignment: ClassroomAssignment) => {
    setAssignmentModal(assignment);
    setSubmissionText(assignment.submission?.submissionText || '');
    setSubmissionAttachmentUrl(assignment.submission?.attachmentUrl || '');
  };

  const uploadSubmissionAttachment = async () => {
    if (!assignmentModal) return;
    try {
      const picked = await pickFileAsDataUrl('image/*,audio/*,video/*');
      const mediaType = resolveMediaType(picked);
      const res = await apiFetch('/quizzes/uploads/media', {
        method: 'POST',
        body: JSON.stringify({
          dataUrl: picked.dataUrl,
          fileName: picked.fileName,
          mimeType: picked.mimeType,
          mediaType,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to upload submission attachment');
      }
      const payload = await res.json();
      setSubmissionAttachmentUrl(payload.url || '');
      setMessage({ type: 'success', text: 'Attachment uploaded successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to upload attachment' });
    }
  };

  const submitAssignment = async () => {
    if (!assignmentModal || !selectedClassroom) return;
    if (!submissionText.trim() && !submissionAttachmentUrl.trim()) {
      setMessage({ type: 'error', text: 'Please provide submission text or attachment.' });
      return;
    }
    setSavingSubmission(true);
    try {
      const res = await apiFetch(
        `/quizzes/students/classrooms/${selectedClassroom.id}/assignments/${assignmentModal.id}/submissions`,
        {
          method: 'POST',
          body: JSON.stringify({
            submissionText: submissionText.trim() || undefined,
            attachmentUrl: submissionAttachmentUrl.trim() || undefined,
          }),
        },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to submit assignment');
      }
      await loadClassrooms(selectedClassLevel);
      setAssignmentModal(null);
      setMessage({ type: 'success', text: 'Assignment submitted successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to submit assignment' });
    } finally {
      setSavingSubmission(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View>
            <Text style={styles.welcomeSubtitle}>Good Afternoon!</Text>
            <Text style={styles.welcomeTitle}>{user?.firstName} {user?.lastName}</Text>
          </View>
          <View style={styles.pointsBadge}>
            <Star size={14} color="#fcd34d" fill="#fcd34d" />
            <Text style={styles.pointsText}>1200</Text>
          </View>
        </View>

        {/* Motivational Banner */}
        <View style={styles.quoteBanner}>
          <View style={styles.quoteContent}>
            <Text style={styles.quoteLabel}>Today's good habit</Text>
            <Text style={styles.quoteText}>"Kindness makes the world a better place."</Text>
          </View>
          {/* A cute illustrative character could go here */}
          <View style={styles.quoteCharacterPlaceholder}>
            <Text style={{fontSize: 50}}>🦉</Text>
          </View>
        </View>

        {/* Class Selector Header */}
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>My Classroom</Text>
          <Pressable style={styles.classSwitcher} onPress={() => setSelectorField('class')}>
            <Text style={styles.classSwitcherText}>
              {selectedClassLevel ? getStandardLabel(selectedClassLevel) : 'Select Class'}
            </Text>
          </Pressable>
        </View>

        {message ? (
          <View style={[styles.messageCard, message.type === 'success' ? styles.successCard : styles.errorCard]}>
            <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>{message.text}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centerWrapper}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={styles.loadingText}>Loading Playroom...</Text>
          </View>
        ) : !selectedClassroom ? (
          <View style={styles.centerWrapper}>
            <Text style={styles.emptyText}>No classroom sessions available for this class.</Text>
          </View>
        ) : (
          <>
            {/* Quick Categories Row */}
            <View style={styles.categoriesRow}>
              <Pressable style={[styles.categoryCard, activeTab === 'content' && styles.categoryCardActive]} onPress={() => setActiveTab('content')}>
                <View style={[styles.categoryIconBg, { backgroundColor: '#e0e7ff' }]}>
                   <BookOpen size={24} color="#4f46e5" />
                </View>
                <Text style={styles.categoryTitle}>Stories</Text>
              </Pressable>
              
              <Pressable style={[styles.categoryCard, activeTab === 'quiz' && styles.categoryCardActive]} onPress={() => setActiveTab('quiz')}>
                <View style={[styles.categoryIconBg, { backgroundColor: '#fce7f3' }]}>
                   <Trophy size={24} color="#db2777" />
                </View>
                <Text style={styles.categoryTitle}>Games</Text>
              </Pressable>

              <Pressable style={[styles.categoryCard, activeTab === 'assignments' && styles.categoryCardActive]} onPress={() => setActiveTab('assignments')}>
                <View style={[styles.categoryIconBg, { backgroundColor: '#ffedd5' }]}>
                   <Clock size={24} color="#ea580c" />
                </View>
                <Text style={styles.categoryTitle}>Tasks</Text>
              </Pressable>
            </View>

            <View style={styles.spacer} />

            {/* List Views based on active tab */}
            {activeTab === 'content' ? (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>More Stories</Text>
                  <Text style={styles.seeAllText}>See All</Text>
                </View>

                {selectedClassroom.contents.length === 0 ? (
                  <Text style={styles.emptyText}>No learning content available.</Text>
                ) : (
                  selectedClassroom.contents.map((content, idx) => {
                    const mediaUrl = resolveMediaUrl(content.mediaUrl);
                    const externalUrl = resolveMediaUrl(content.externalUrl);
                    const previewImageUrl = isImageUrl(mediaUrl) ? mediaUrl : isImageUrl(externalUrl) ? externalUrl : '';
                    const showImage = Boolean(previewImageUrl);
                    
                    const colors = ['#fef3c7', '#dbeafe', '#fce7f3', '#dcfce3'];
                    const bgColor = colors[idx % colors.length];

                    return (
                      <Pressable key={content.id} style={[styles.storyCard, { backgroundColor: bgColor }]} onPress={() => setPreviewContentIndex(idx)}>
                        <View style={styles.storyContent}>
                          <Text style={styles.storyLabel}>Mystical Stories</Text>
                          <Text style={styles.storyTitle}>{content.title}</Text>
                          
                          <View style={styles.storyMetaRow}>
                            <Pressable style={styles.playMiniBtn}>
                              <Play size={12} color="#4f46e5" fill="#4f46e5" />
                              <Text style={styles.playMiniBtnText}>Play</Text>
                            </Pressable>
                            <View style={styles.timeBadge}>
                              <Clock size={12} color="#64748b" />
                              <Text style={styles.timeText}>15 min</Text>
                            </View>
                          </View>
                        </View>
                        {showImage ? (
                          <Image source={{ uri: previewImageUrl }} style={styles.storyImage} resizeMode="contain" />
                        ) : (
                          <View style={styles.storyImagePlaceholder}>
                             <BookOpen size={40} color="rgba(0,0,0,0.1)" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}

            {activeTab === 'quiz' ? (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Puzzle Games</Text>
                  <Text style={styles.seeAllText}>See All</Text>
                </View>

                {selectedClassroom.quizzes.length === 0 ? (
                  <Text style={styles.emptyText}>No games assigned yet.</Text>
                ) : (
                  selectedClassroom.quizzes.map((quiz, idx) => {
                    const isCompleted = quiz.status === 'completed';
                    
                    return (
                      <View key={quiz.id} style={styles.gameCard}>
                        <View style={styles.gameInfo}>
                          <Text style={styles.gameTitle}>{quiz.title}</Text>
                          <Text style={styles.gameSubtitle}>Play & match the puzzles</Text>
                        </View>
                        <Pressable 
                          style={styles.playButton} 
                          onPress={() => setSelectedQuizId(quiz.id)}
                        >
                          <Text style={styles.playButtonText}>{isCompleted ? 'Replay' : 'Play'}</Text>
                          <View style={styles.playIconCircle}>
                            <Play size={10} color="#4f46e5" fill="#4f46e5" />
                          </View>
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}

            {activeTab === 'assignments' ? (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>My Tasks</Text>
                </View>

                {selectedClassroom.assignments.length === 0 ? (
                  <Text style={styles.emptyText}>No tasks available.</Text>
                ) : (
                  selectedClassroom.assignments.map((assignment) => (
                    <View key={assignment.id} style={styles.taskCard}>
                      <View style={styles.taskHeader}>
                        <Text style={styles.taskTitle}>{assignment.title}</Text>
                        <View
                          style={[
                            styles.statusPill,
                            assignment.status === 'submitted'
                              ? styles.statusPillSuccess
                              : assignment.status === 'overdue'
                                ? styles.statusPillWarning
                                : styles.statusPillDanger,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              assignment.status === 'submitted'
                                ? styles.statusPillSuccessText
                                : assignment.status === 'overdue'
                                  ? styles.statusPillWarningText
                                  : styles.statusPillDangerText,
                            ]}
                          >
                            {assignment.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.taskMeta}>
                        Due: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleString() : 'No due date'}
                      </Text>
                      <Pressable style={styles.taskButton} onPress={() => openAssignment(assignment)}>
                        <Text style={styles.taskButtonText}>{assignment.status === 'submitted' ? 'View Details' : 'Complete Task'}</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {selectedQuizId && (
        <QuizRenderer
          quizId={selectedQuizId}
          visible={selectedQuizId !== null}
          onClose={() => {
            setSelectedQuizId(null);
            loadClassrooms(selectedClassLevel);
          }}
        />
      )}

      {/* Class Selector Modal */}
      <Modal visible={selectorField !== null} transparent animationType="fade" onRequestClose={() => setSelectorField(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Class</Text>
              <Pressable onPress={() => setSelectorField(null)} style={styles.closeBtn}>
                <X size={20} color="#64748b" />
              </Pressable>
            </View>
            <ScrollView style={styles.selectorList}>
              {classLevels.map((level) => (
                <Pressable
                  key={level}
                  style={styles.selectorOption}
                  onPress={() => {
                    setSelectorField(null);
                    loadClassrooms(level);
                  }}
                >
                  <Text style={styles.selectorOptionText}>{getStandardLabel(level)}</Text>
                  {selectedClassLevel === level && <View style={styles.radioDot} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Content Viewer Modal */}
      <Modal visible={previewContentIndex !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setPreviewContentIndex(null)}>
        <View style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
            <View style={styles.viewerHeaderTitleContainer}>
              <View style={styles.viewerBadgeRow}>
                <View style={styles.viewerBadge}>
                  <Text style={styles.viewerBadgeText}>{previewContent?.subject || 'Learning'}</Text>
                </View>
                <View style={styles.viewerTrackerBadge}>
                  <Text style={styles.viewerTrackerText}>Content {previewContentIndex !== null ? previewContentIndex + 1 : 1} of {selectedClassroom?.contents?.length || 1}</Text>
                </View>
              </View>
              <Text style={styles.viewerTitle} numberOfLines={1}>{previewContent?.title || 'Story Time!'}</Text>
            </View>
            <Pressable onPress={() => setPreviewContentIndex(null)} style={styles.viewerCloseBtn}>
              <X size={24} color="#1e293b" />
            </Pressable>
          </View>
          
          <ScrollView contentContainerStyle={styles.viewerContentScroll}>
            {(previewContent?.sections?.length ? previewContent.sections : [previewContent]).map((section, idx) => {
              if (!section) return null;
              
              const targetUrl = section?.mediaUrl 
                ? resolveMediaUrl(section.mediaUrl) 
                : resolveMediaUrl(section?.externalUrl);

              return (
                <View key={section.id || idx} style={styles.viewerSectionBlock}>
                  {section.title ? (
                    <Text style={styles.viewerSectionTitle}>{section.title}</Text>
                  ) : null}

                  {targetUrl && isImageUrl(targetUrl) ? (
                    <View style={styles.viewerImageWrapper}>
                      <Image
                        source={{ uri: targetUrl }}
                        style={styles.viewerImage}
                        resizeMode="cover"
                      />
                    </View>
                  ) : null}

                  {targetUrl && isYouTubeUrl(targetUrl) ? (
                    <View style={styles.viewerVideoWrapper}>
                      <View style={styles.tvFrame}>
                        {Platform.OS === 'web' ? (
                          <iframe
                            src={getYouTubeEmbedUrl(targetUrl) + '&controls=1&modestbranding=1&showinfo=0'}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <WebView
                            source={{ uri: getYouTubeEmbedUrl(targetUrl) + '&controls=1&modestbranding=1&showinfo=0' }}
                            style={{ width: '100%', height: '100%' }}
                            allowsFullscreenVideo
                            allowsInlineMediaPlayback
                          />
                        )}
                      </View>
                    </View>
                  ) : null}

                  {targetUrl && !isImageUrl(targetUrl) && !isYouTubeUrl(targetUrl) ? (
                    <View style={styles.viewerVideoWrapper}>
                      <View style={styles.tvFrame}>
                        <Video
                          source={{ uri: targetUrl }}
                          useNativeControls
                          resizeMode={ResizeMode.COVER}
                          style={{ width: '100%', height: '100%' }}
                        />
                      </View>
                    </View>
                  ) : null}

                  {section.textContent ? (
                    <View style={styles.viewerTextCard}>
                      <Text style={styles.viewerTextContent}>{section.textContent}</Text>
                    </View>
                  ) : null}

                  {section.externalUrl && !isYouTubeUrl(resolveMediaUrl(section.externalUrl) || '') && !isImageUrl(resolveMediaUrl(section.externalUrl) || '') ? (
                    <View style={styles.actionContainer}>
                      <Pressable style={styles.bigPrimaryButton} onPress={() => openExternalResource(section.externalUrl || '')}>
                        <Text style={styles.bigPrimaryButtonText}>Open External Link</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>

          {/* Navigation Footer */}
          <View style={styles.viewerFooter}>
            <Pressable 
              style={[styles.navButton, !hasPrevContent && styles.navButtonDisabled]} 
              disabled={!hasPrevContent}
              onPress={() => setPreviewContentIndex(prev => prev !== null ? prev - 1 : null)}
            >
              <Text style={[styles.navButtonText, !hasPrevContent && styles.navButtonTextDisabled]}>Previous</Text>
            </Pressable>
            <Pressable 
              style={[styles.navButtonPrimary, !hasNextContent && styles.navButtonDisabled]} 
              disabled={!hasNextContent}
              onPress={() => setPreviewContentIndex(prev => prev !== null ? prev + 1 : null)}
            >
              <Text style={styles.navButtonPrimaryText}>Next Content</Text>
              <ChevronRight size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Assignment Modal */}
      <Modal visible={assignmentModal !== null} transparent animationType="slide" onRequestClose={() => setAssignmentModal(null)}>
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{assignmentModal?.title || 'Task'}</Text>
              <Pressable onPress={() => setAssignmentModal(null)} style={styles.closeBtn}>
                <X size={20} color="#64748b" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{padding: 20}}>
              
              <View style={styles.taskDetailCard}>
                {assignmentModal?.description ? <Text style={styles.taskDetailText}>{assignmentModal.description}</Text> : null}
                {assignmentModal?.instructions ? <Text style={styles.taskDetailText}>{assignmentModal.instructions}</Text> : null}
                {assignmentModal?.attachmentUrl ? (
                  <Pressable onPress={() => openExternalResource(assignmentModal.attachmentUrl!)}>
                    <Text style={styles.taskLink}>View Attachment</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.inputLabel}>Your Work</Text>
              <TextInput
                value={submissionText}
                onChangeText={setSubmissionText}
                placeholder="Write your answer here..."
                style={styles.textArea}
                multiline
                textAlignVertical="top"
              />
              
              <Text style={styles.inputLabel}>Attach a File (URL)</Text>
              <View style={styles.uploadRow}>
                <TextInput
                  value={submissionAttachmentUrl}
                  onChangeText={setSubmissionAttachmentUrl}
                  placeholder="https://..."
                  style={styles.inputFlex}
                />
                <Pressable style={styles.uploadBtn} onPress={uploadSubmissionAttachment}>
                  <Text style={styles.uploadBtnText}>Upload</Text>
                </Pressable>
              </View>

            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={styles.bigPrimaryButton} onPress={submitAssignment} disabled={savingSubmission}>
                {savingSubmission ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigPrimaryButtonText}>Submit Task</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  pointsText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  quoteBanner: {
    backgroundColor: '#dbeafe',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  quoteContent: {
    flex: 1,
    paddingRight: 10,
  },
  quoteLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 6,
  },
  quoteText: {
    fontSize: 18,
    color: '#1e293b',
    fontWeight: '800',
    lineHeight: 24,
  },
  quoteCharacterPlaceholder: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  classSwitcher: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  classSwitcherText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  categoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  categoryCardActive: {
    borderColor: '#4f46e5',
  },
  categoryIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  spacer: {
    height: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  storyCard: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  storyContent: {
    flex: 1,
    paddingRight: 16,
  },
  storyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
    marginBottom: 8,
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 16,
  },
  storyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  playMiniBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  storyImage: {
    width: 100,
    height: 100,
  },
  storyImagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gameInfo: {
    flex: 1,
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  gameSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 8,
  },
  playButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  playIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginRight: 12,
  },
  taskMeta: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
  },
  taskButton: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  taskButtonText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 13,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillSuccess: { backgroundColor: '#dcfce3' },
  statusPillWarning: { backgroundColor: '#fef3c7' },
  statusPillDanger: { backgroundColor: '#fee2e2' },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  statusPillSuccessText: { color: '#166534' },
  statusPillWarningText: { color: '#92400e' },
  statusPillDangerText: { color: '#991b1b' },

  // Viewer Screen Styles (Replaces Full Modal)
  viewerContainer: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  viewerHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  viewerHeaderTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  viewerBadge: {
    backgroundColor: '#dbeafe',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  viewerTrackerBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewerTrackerText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  viewerBadgeText: {
    color: '#2563eb',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  viewerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1e293b',
  },
  viewerCloseBtn: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 24,
  },
  viewerContentScroll: {
    padding: 24,
    paddingBottom: 60,
  },
  viewerSectionBlock: {
    marginBottom: 40,
  },
  viewerSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  viewerImageWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerVideoWrapper: {
    width: '100%',
    marginBottom: 24,
  },
  tvFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#1e293b',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#334155',
    overflow: 'hidden',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 15,
    elevation: 5,
  },
  viewerTextCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 24,
  },
  viewerTextContent: {
    fontSize: 18,
    color: '#334155',
    lineHeight: 28,
  },
  viewerFooter: {
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  navButtonTextDisabled: {
    color: '#94a3b8',
  },
  navButtonPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#4f46e5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#cbd5e1',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#4f46e5',
  },

  // Shared Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  closeBtn: {
    padding: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
  },
  selectorList: {
    maxHeight: 300,
  },
  selectorOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  selectorOptionText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4f46e5',
  },
  
  // Full screenish modals
  fullModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  fullModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  imageContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  contentModalImage: {
    width: '100%',
    height: 250,
  },
  videoContainer: {
    backgroundColor: '#000',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    width: '100%',
    aspectRatio: 16 / 9,
  },
  contentModalVideo: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
  },
  storyText: {
    fontSize: 16,
    color: '#334155',
    lineHeight: 26,
  },
  actionContainer: {
    gap: 12,
  },
  bigPrimaryButton: {
    backgroundColor: '#4f46e5',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  bigPrimaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  
  taskDetailCard: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  taskDetailText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
    marginBottom: 8,
  },
  taskLink: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 14,
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    marginLeft: 4,
  },
  textArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    fontSize: 15,
    marginBottom: 20,
  },
  uploadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputFlex: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  uploadBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 16,
  },
  uploadBtnText: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 14,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  
  centerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  messageCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  successCard: { backgroundColor: '#dcfce3', borderColor: '#86efac' },
  errorCard: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  messageText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  successText: { color: '#166534' },
  errorText: { color: '#991b1b' },
});
