import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChevronRight, Play, Star, BookOpen, Clock, X, Trophy } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';

import AudioPlayer from '../../src/components/media/AudioPlayer';
import DocumentViewer from '../../src/components/media/DocumentViewer';

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

  // Viewer scroll-based playback tracking
  const [viewerScrollY, setViewerScrollY] = useState(0);
  const sectionYsRef = useRef<Record<string, number>>({});
  const SCREEN_H = Dimensions.get('window').height;

  const isMediaInView = (key: string) => {
    const y = sectionYsRef.current[key] ?? -1;
    if (y < 0) return true; // not measured yet — allow play on first section
    return y >= viewerScrollY && y < viewerScrollY + SCREEN_H * 0.9;
  };

  // Reset scroll tracking when navigating to a new content item
  const openContentAt = (idx: number | null) => {
    sectionYsRef.current = {};
    setViewerScrollY(0);
    setPreviewContentIndex(idx);
  };

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
    if (!user?.id || user.activeRole !== 'student') return '';
    const res = await apiFetch(`/users/${user.id}`);
    if (!res.ok) return '';
    const profile = await res.json();
    return (profile.classLevel as string) || '';
  }, [apiFetch, user?.id, user?.activeRole]);

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
                <Text style={styles.categoryTitle}>Content</Text>
              </Pressable>
              
              <Pressable style={[styles.categoryCard, activeTab === 'quiz' && styles.categoryCardActive]} onPress={() => setActiveTab('quiz')}>
                <View style={[styles.categoryIconBg, { backgroundColor: '#fce7f3' }]}>
                   <Trophy size={24} color="#db2777" />
                </View>
                <Text style={styles.categoryTitle}>Quiz</Text>
              </Pressable>

              <Pressable style={[styles.categoryCard, activeTab === 'assignments' && styles.categoryCardActive]} onPress={() => setActiveTab('assignments')}>
                <View style={[styles.categoryIconBg, { backgroundColor: '#ffedd5' }]}>
                   <Clock size={24} color="#ea580c" />
                </View>
                <Text style={styles.categoryTitle}>Assignment</Text>
              </Pressable>
            </View>

            <View style={styles.spacer} />

            {/* List Views based on active tab */}
            {activeTab === 'content' ? (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Content</Text>
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

                    const cardColors = ['#D6EAFF', '#FFE8D6', '#D6F5D6', '#EDE4FF', '#FFF5CC'];
                    const emojis = ['📖', '🎨', '🌿', '🔮', '🌟'];
                    const bgColor = cardColors[idx % cardColors.length];
                    const emoji = emojis[idx % emojis.length];

                    return (
                      <Pressable key={content.id} style={[styles.storyCard, { backgroundColor: bgColor }]} onPress={() => setPreviewContentIndex(idx)}>
                        <View style={styles.storyContent}>
                          <Text style={styles.storyLabel}>{content.subject || content.contentType || 'Content'}</Text>
                          <Text style={styles.storyTitle}>{content.title}</Text>
                          <View style={styles.storyMetaRow}>
                            <Pressable style={styles.playMiniBtn} onPress={() => setPreviewContentIndex(idx)}>
                              <Play size={11} color="#fff" fill="#fff" />
                              <Text style={styles.playMiniBtnText}>Open</Text>
                            </Pressable>
                          </View>
                        </View>
                        {showImage ? (
                          <Image source={{ uri: previewImageUrl }} style={styles.storyImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.storyImagePlaceholder}>
                            <Text style={{ fontSize: 38 }}>{emoji}</Text>
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
                  selectedClassroom.quizzes.map((quiz) => {
                    const isCompleted = quiz.status === 'completed';
                    return (
                      <View key={quiz.id} style={styles.gameCard}>
                        <View style={[styles.gameIconBox, { backgroundColor: '#FFE8D6' }]}>
                          <Trophy size={20} color="#FF7043" />
                        </View>
                        <View style={styles.gameInfo}>
                          <Text style={styles.gameTitle}>{quiz.title}</Text>
                          <Text style={styles.gameSubtitle}>{quiz.totalQuestions} questions · {quiz.difficultyLevel || 'Standard'}</Text>
                        </View>
                        <Pressable style={styles.playButton} onPress={() => setSelectedQuizId(quiz.id)}>
                          <Play size={12} color="#fff" fill="#fff" />
                          <Text style={styles.playButtonText}>{isCompleted ? 'Replay' : 'Play'}</Text>
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
        {(() => {
          const EMOJIS   = ['🦕', '🦁', '🐢', '🦒', '🌟', '🦊', '🐧', '🎨'];
          const BG_CARDS = ['#FAFAC8', '#D6EAFF', '#D6F5D6', '#FFE8D6', '#EDE4FF'];
          const TYPE_CONFIG: Record<string, { label: string; emoji: string; accentColor: string; bgColor: string }> = {
            video:    { label: '🎬 Video',      emoji: '🎬', accentColor: '#FF7043', bgColor: '#FFE8D6' },
            audio:    { label: '🎵 Audio',      emoji: '🎵', accentColor: '#9B8EC4', bgColor: '#EDE4FF' },
            image:    { label: '🖼️ Image',      emoji: '🖼️', accentColor: '#4A90E2', bgColor: '#D6EAFF' },
            text:     { label: '📖 Reading',    emoji: '📖', accentColor: '#7DC67A', bgColor: '#D6F5D6' },
            youtube:  { label: '▶️ YouTube',    emoji: '▶️', accentColor: '#FF4444', bgColor: '#FFE8D6' },
            document: { label: '📄 Document',   emoji: '📄', accentColor: '#4A90E2', bgColor: '#D6EAFF' },
            link:     { label: '🔗 Resource',   emoji: '🔗', accentColor: '#E6A817', bgColor: '#FFF5CC' },
          };

          const curIdx   = previewContentIndex ?? 0;
          const contents = selectedClassroom?.contents ?? [];
          const content  = previewContent;
          const fallbackEmoji = EMOJIS[curIdx % EMOJIS.length];
          const fallbackBg    = BG_CARDS[curIdx % BG_CARDS.length];

          // Detect primary content type across sections
          const sections = content?.sections?.length ? content.sections : [content];
          const detectType = (s: typeof sections[0]) => {
            if (!s) return 'text';
            const mUrl = resolveMediaUrl(s?.mediaUrl);
            const eUrl = resolveMediaUrl(s?.externalUrl);
            const url = mUrl || eUrl || '';
            if (isYouTubeUrl(url)) return 'youtube';
            if (isImageUrl(url)) return 'image';
            if (url.match(/\.(mp4|mov|webm|avi)/i)) return 'video';
            if (url.match(/\.(mp3|wav|ogg|aac|m4a|flac)/i)) return 'audio';
            if (url.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)/i)) return 'document';
            if (eUrl && !isImageUrl(eUrl)) return 'link';
            return 'text';
          };
          const primaryType = detectType(sections[0]);
          const typeCfg = TYPE_CONFIG[primaryType] ?? { label: '📖 Content', emoji: fallbackEmoji, accentColor: '#4A90E2', bgColor: fallbackBg };

          return (
            <View style={styles.viewerContainer}>

              {/* ── Header ── */}
              <View style={[styles.vHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
                <Pressable onPress={() => setPreviewContentIndex(null)} style={styles.vBackBtn}>
                  <Text style={styles.vBackArrow}>‹</Text>
                </Pressable>
                <View style={styles.vHeaderMid}>
                  <View style={[styles.vTypeBadge, { backgroundColor: `${typeCfg.accentColor}18` }]}>
                    <Text style={[styles.vTypeBadgeText, { color: typeCfg.accentColor }]}>{typeCfg.label}</Text>
                  </View>
                  <Text style={styles.vHeaderTitle} numberOfLines={1}>{content?.title || 'Content'}</Text>
                </View>
                <View style={[styles.vCounter, { backgroundColor: `${typeCfg.accentColor}15` }]}>
                  <Text style={[styles.vCounterTxt, { color: typeCfg.accentColor }]}>{curIdx + 1}/{contents.length}</Text>
                </View>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.vScroll}
                scrollEventThrottle={100}
                onScroll={(e) => setViewerScrollY(e.nativeEvent.contentOffset.y)}
              >

                {/* ── Hero info card ── */}
                <View style={[styles.vHeroCard, { backgroundColor: typeCfg.bgColor }]}>
                  <View style={styles.vHeroRow}>
                    <View style={styles.vHeroLeft}>
                      <Text style={styles.vHeroTitle}>{content?.title || 'Content'}</Text>
                      <Text style={styles.vHeroSub}>{content?.subject || 'General'}</Text>
                      {content?.sections && content.sections.length > 1 && (
                        <View style={[styles.vSectionCountBadge, { backgroundColor: `${typeCfg.accentColor}20` }]}>
                          <Text style={[styles.vSectionCountText, { color: typeCfg.accentColor }]}>
                            {content.sections.length} sections
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 64 }}>{typeCfg.emoji}</Text>
                  </View>
                  {/* Nav arrows inside hero */}
                  <View style={styles.vHeroNav}>
                    <Pressable
                      style={[styles.vHeroNavBtn, !hasPrevContent && { opacity: 0.3 }]}
                      disabled={!hasPrevContent}
                      onPress={() => openContentAt(curIdx > 0 ? curIdx - 1 : null)}
                    >
                      <Text style={styles.vHeroNavArrow}>‹ Prev</Text>
                    </Pressable>
                    <View style={[styles.vHeroDivider, { backgroundColor: `${typeCfg.accentColor}30` }]} />
                    <Pressable
                      style={[styles.vHeroNavBtn, !hasNextContent && { opacity: 0.3 }]}
                      disabled={!hasNextContent}
                      onPress={() => openContentAt(curIdx + 1 < contents.length ? curIdx + 1 : null)}
                    >
                      <Text style={styles.vHeroNavArrow}>Next ›</Text>
                    </Pressable>
                  </View>
                </View>

                {/* ── Sections ── */}
                {sections.map((section, idx) => {
                  if (!section) return null;
                  const mUrl = resolveMediaUrl(section.mediaUrl);
                  const eUrl = resolveMediaUrl(section.externalUrl);
                  const url  = mUrl || eUrl || '';
                  const sType = detectType(section);
                  const sCfg  = TYPE_CONFIG[sType] ?? typeCfg;

                  const mediaKey = `s-${curIdx}-${idx}`;

                  return (
                    <View
                      key={(section as any).id || idx}
                      style={styles.vSection}
                      onLayout={(e) => {
                        sectionYsRef.current[mediaKey] = e.nativeEvent.layout.y;
                      }}
                    >
                      {/* Section title with type chip */}
                      {(section as any).title ? (
                        <View style={styles.vSectionTitleRow}>
                          <View style={[styles.vSectionChip, { backgroundColor: `${sCfg.accentColor}15` }]}>
                            <Text style={[styles.vSectionChipTxt, { color: sCfg.accentColor }]}>{sCfg.emoji}</Text>
                          </View>
                          <Text style={styles.vSectionTitleTxt}>{(section as any).title}</Text>
                        </View>
                      ) : idx > 0 ? (
                        <View style={styles.vSectionTitleRow}>
                          <View style={[styles.vSectionChip, { backgroundColor: `${sCfg.accentColor}15` }]}>
                            <Text style={[styles.vSectionChipTxt, { color: sCfg.accentColor }]}>{sCfg.emoji}</Text>
                          </View>
                          <Text style={styles.vSectionTitleTxt}>Section {idx + 1}</Text>
                        </View>
                      ) : null}

                      {/* IMAGE */}
                      {url && isImageUrl(url) && (
                        <View style={styles.vImgWrap}>
                          <Image source={{ uri: url }} style={styles.vImg} resizeMode="cover" />
                        </View>
                      )}

                      {/* YOUTUBE */}
                      {url && isYouTubeUrl(url) && (
                        <View style={styles.vVideoWrap}>
                          <View style={[styles.vVideoFrame, { borderColor: `${sCfg.accentColor}30` }]}>
                            {Platform.OS === 'web' ? (
                              <iframe
                                src={getYouTubeEmbedUrl(url) + `&controls=1&modestbranding=1${isMediaInView(mediaKey) ? '&autoplay=1' : ''}`}
                                style={{ width: '100%', height: '100%', border: 'none', borderRadius: 16 }}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            ) : (
                              <WebView
                                source={{ uri: getYouTubeEmbedUrl(url) + `&controls=1${isMediaInView(mediaKey) ? '&autoplay=1' : ''}` }}
                                style={{ width: '100%', height: '100%', borderRadius: 16 }}
                                allowsFullscreenVideo
                                allowsInlineMediaPlayback
                                mediaPlaybackRequiresUserAction={false}
                              />
                            )}
                          </View>
                        </View>
                      )}

                      {/* AUDIO */}
                      {url && url.match(/\.(mp3|wav|ogg|aac|m4a|flac)/i) && (
                        <AudioPlayer
                          uri={url}
                          title={content?.title || 'Audio'}
                          subtitle={content?.subject ? `⏱ 15 Minutes · ${content.subject}` : '⏱ 15 Minutes'}
                          emoji="🎵"
                          accentColor={sCfg.accentColor}
                          bgColor={sCfg.bgColor ?? '#EDE4FF'}
                          hasPrev={hasPrevContent}
                          hasNext={hasNextContent}
                          onPrev={() => openContentAt(curIdx > 0 ? curIdx - 1 : null)}
                          onNext={() => openContentAt(curIdx + 1 < contents.length ? curIdx + 1 : null)}
                        />
                      )}

                      {/* VIDEO (non-YouTube, non-audio) */}
                      {url && !isImageUrl(url) && !isYouTubeUrl(url) && !url.match(/\.(mp3|wav|ogg|aac|m4a|flac)/i) && url.match(/\.(mp4|mov|webm|avi)/i) && (
                        <View style={styles.vVideoWrap}>
                          <View style={[styles.vVideoFrame, { borderColor: `${sCfg.accentColor}30` }]}>
                            <Video
                              source={{ uri: url }}
                              useNativeControls
                              shouldPlay={isMediaInView(mediaKey)}
                              resizeMode={ResizeMode.CONTAIN}
                              style={{ width: '100%', height: '100%' }}
                            />
                          </View>
                        </View>
                      )}

                      {/* TEXT */}
                      {section.textContent ? (
                        <View style={styles.vTextBlock}>
                          <Text style={styles.vTextBody}>{section.textContent}</Text>
                        </View>
                      ) : null}

                      {/* DOCUMENT / EXTERNAL LINK */}
                      {eUrl && !isYouTubeUrl(eUrl) && !isImageUrl(eUrl) && !url.match(/\.(mp4|mov|webm|mp3|wav|ogg|aac|m4a|flac)/i) ? (
                        eUrl.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)/i) ? (
                          <DocumentViewer
                            uri={eUrl}
                            title={content?.title}
                            accentColor={sCfg.accentColor}
                            bgColor={sCfg.bgColor}
                          />
                        ) : (
                          <Pressable
                            style={[styles.vLinkBtn, { backgroundColor: `${sCfg.accentColor}12`, borderColor: `${sCfg.accentColor}30` }]}
                            onPress={() => openExternalResource(eUrl)}
                          >
                            <Text style={[styles.vLinkBtnTxt, { color: sCfg.accentColor }]}>🔗 Open Resource</Text>
                          </Pressable>
                        )
                      ) : null}
                    </View>
                  );
                })}

                {/* ── More content ── */}
                {contents.length > 1 && (
                  <View style={styles.vMoreWrap}>
                    <Text style={styles.vMoreTitle}>More Content</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vMoreScroll}>
                      {contents.map((c, i) => {
                        if (i === curIdx) return null;
                        const cBg    = BG_CARDS[i % BG_CARDS.length];
                        const cEmoji = EMOJIS[i % EMOJIS.length];
                        const cm = resolveMediaUrl(c.mediaUrl);
                        const ce = resolveMediaUrl(c.externalUrl);
                        const img = isImageUrl(cm) ? cm : isImageUrl(ce) ? ce : '';
                        return (
                          <Pressable key={c.id} style={[styles.vMoreCard, { backgroundColor: cBg }]} onPress={() => setPreviewContentIndex(i)}>
                            {img
                              ? <Image source={{ uri: img }} style={styles.vMoreCardImg} resizeMode="cover" />
                              : <Text style={styles.vMoreCardEmoji}>{cEmoji}</Text>}
                            <Text style={styles.vMoreCardTitle} numberOfLines={2}>{c.title}</Text>
                            <Text style={styles.vMoreCardMeta}>{c.subject || 'Content'}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </ScrollView>
            </View>
          );
        })()}
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

              {assignmentModal?.status === 'submitted' ? (
                <View style={{ backgroundColor: '#D6F5D6', borderRadius: 16, padding: 16, gap: 8 }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: '#2E7D32' }}>✅ Submitted</Text>
                  {assignmentModal.submission?.submittedAt && (
                    <Text style={{ fontSize: 12, color: '#4CAF50', fontWeight: '600' }}>
                      {new Date(assignmentModal.submission.submittedAt).toLocaleString()}
                    </Text>
                  )}
                  {submissionText ? (
                    <>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#4B5563', marginTop: 4 }}>Your Answer:</Text>
                      <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20 }}>{submissionText}</Text>
                    </>
                  ) : null}
                  {submissionAttachmentUrl ? (
                    <Text style={{ fontSize: 12, color: '#4A90E2', fontWeight: '600', marginTop: 4 }}>📎 Attachment submitted</Text>
                  ) : null}
                </View>
              ) : (
                <>
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
                </>
              )}

            </ScrollView>
            {assignmentModal?.status !== 'submitted' && (
              <View style={styles.modalFooter}>
                <Pressable style={styles.bigPrimaryButton} onPress={submitAssignment} disabled={savingSubmission}>
                  {savingSubmission ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigPrimaryButtonText}>Submit Task</Text>}
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F0F4FF',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  welcomeSubtitle: {
    fontSize: 12,
    color: '#7A7A9A',
    fontWeight: '600',
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1a1a2e',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  pointsText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  quoteBanner: {
    backgroundColor: '#D6EAFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  quoteContent: {
    flex: 1,
    paddingRight: 10,
  },
  quoteLabel: {
    fontSize: 11,
    color: '#7A7A9A',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  quoteText: {
    fontSize: 14,
    color: '#1a1a2e',
    fontWeight: '800',
    lineHeight: 20,
  },
  quoteCharacterPlaceholder: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1a1a2e',
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A90E2',
  },
  classSwitcher: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#B5D4FF',
  },
  classSwitcherText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4A90E2',
  },
  categoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EBEBF5',
  },
  categoryCardActive: {
    borderColor: '#4A90E2',
    backgroundColor: '#EBF4FF',
  },
  categoryIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  spacer: {
    height: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  // Content / story cards
  storyCard: {
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  storyContent: {
    flex: 1,
    paddingRight: 12,
  },
  storyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7A7A9A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  storyTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1a1a2e',
    marginBottom: 12,
    lineHeight: 20,
  },
  storyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF7043',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  playMiniBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7A7A9A',
  },
  storyImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  storyImagePlaceholder: {
    width: 72,
    height: 72,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Quiz / game cards
  gameCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#EBEBF5',
    gap: 12,
  },
  gameIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameInfo: {
    flex: 1,
  },
  gameTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  gameSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7A7A9A',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF7043',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    gap: 6,
  },
  playButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  playIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Task / assignment cards
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#EBEBF5',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  taskTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#1a1a2e',
    marginRight: 10,
  },
  taskMeta: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
  },
  taskButton: {
    backgroundColor: '#EBF4FF',
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  taskButtonText: {
    color: '#4A90E2',
    fontWeight: '700',
    fontSize: 13,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillSuccess: { backgroundColor: '#D6F5D6' },
  statusPillWarning: { backgroundColor: '#FFF5CC' },
  statusPillDanger: { backgroundColor: '#FFE4EE' },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  statusPillSuccessText: { color: '#2E7D32' },
  statusPillWarningText: { color: '#B45309' },
  statusPillDangerText: { color: '#C62828' },

  // ── CONTENT VIEWER ────────────────────────────────────────────────────────
  viewerContainer: {
    flex: 1,
    backgroundColor: '#F0F4FF',
  },
  viewerHeader: {
    paddingTop: Platform.OS === 'ios' ? 52 : 18,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBF5',
  },
  viewerHeaderTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  viewerBadge: {
    backgroundColor: '#D6EAFF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  viewerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  viewerTrackerBadge: {
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  viewerTrackerText: {
    color: '#7A7A9A',
    fontSize: 10,
    fontWeight: '700',
  },
  viewerBadgeText: {
    color: '#4A90E2',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  viewerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1a1a2e',
  },
  viewerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#4A90E2',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
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
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EBEBF5',
    gap: 12,
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#F0F4FF',
    borderWidth: 1.5,
    borderColor: '#B5D4FF',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A90E2',
  },
  navButtonTextDisabled: {
    color: '#B5D4FF',
  },
  navButtonPrimary: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#4A90E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  navButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
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
    backgroundColor: '#4A90E2',
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
    backgroundColor: '#4A90E2',
    paddingVertical: 15,
    borderRadius: 999,
    alignItems: 'center',
  },
  bigPrimaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  taskDetailCard: {
    backgroundColor: '#F0F4FF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  taskDetailText: {
    fontSize: 14,
    color: '#1a1a2e',
    lineHeight: 22,
    marginBottom: 8,
  },
  taskLink: {
    color: '#4A90E2',
    fontWeight: '700',
    fontSize: 14,
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 6,
    marginLeft: 2,
  },
  textArea: {
    backgroundColor: '#F0F4FF',
    borderWidth: 1.5,
    borderColor: '#B5D4FF',
    borderRadius: 16,
    padding: 14,
    minHeight: 110,
    fontSize: 14,
    color: '#1a1a2e',
    marginBottom: 16,
  },
  uploadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputFlex: {
    flex: 1,
    backgroundColor: '#F0F4FF',
    borderWidth: 1.5,
    borderColor: '#B5D4FF',
    borderRadius: 999,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1a1a2e',
  },
  uploadBtn: {
    backgroundColor: '#D6EAFF',
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: 999,
  },
  uploadBtnText: {
    color: '#4A90E2',
    fontWeight: '800',
    fontSize: 13,
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

  // ── Viewer modal ──────────────────────────────────────────────────────────
  vHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F8', gap: 10,
  },
  vBackBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F4F5FF', alignItems: 'center', justifyContent: 'center' },
  vBackArrow: { fontSize: 22, fontWeight: '900', color: '#1a1a2e', lineHeight: 26 },
  vHeaderMid: { flex: 1, gap: 2 },
  vTypeBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  vTypeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  vHeaderTitle: { fontSize: 15, fontWeight: '900', color: '#1a1a2e' },
  vCounter:   { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  vCounterTxt:{ fontSize: 11, fontWeight: '800' },

  vScroll: { paddingBottom: 40 },

  // Hero card
  vHeroCard: { margin: 16, borderRadius: 24, padding: 20, marginBottom: 8 },
  vHeroRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  vHeroLeft: { flex: 1 },
  vHeroTitle:{ fontSize: 20, fontWeight: '900', color: '#1a1a2e', lineHeight: 28, marginBottom: 4 },
  vHeroSub:  { fontSize: 12, fontWeight: '500', color: '#7A7A9A' },
  vSectionCountBadge: { alignSelf: 'flex-start', marginTop: 8, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  vSectionCountText:  { fontSize: 11, fontWeight: '700' },
  vHeroNav:  { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 14 },
  vHeroNavBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  vHeroNavArrow: { fontSize: 14, fontWeight: '800', color: '#5A5A7A' },
  vHeroDivider:{ width: 1, height: 20, alignSelf: 'center' },

  // Sections
  vSection: { marginHorizontal: 16, marginBottom: 16 },
  vSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  vSectionChip: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  vSectionChipTxt: { fontSize: 14 },
  vSectionTitleTxt: { fontSize: 15, fontWeight: '800', color: '#1a1a2e' },

  // Image
  vImgWrap: { borderRadius: 20, overflow: 'hidden' },
  vImg:     { width: '100%', height: 220 },

  // Video / YouTube
  vVideoWrap:  { borderRadius: 20, overflow: 'hidden', marginBottom: 4 },
  vVideoFrame: { width: '100%', height: 220, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0a0a0a', borderWidth: 2 },

  // Text
  vTextBlock: {
    backgroundColor: '#F8F9FF', borderRadius: 16, padding: 20,
  },
  vTextBody: { fontSize: 16, color: '#1a1a2e', lineHeight: 28, fontWeight: '500' },

  // Link
  vLinkBtn: {
    borderRadius: 16, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5,
  },
  vLinkBtnTxt: { fontSize: 14, fontWeight: '800' },

  // More content
  vMoreWrap:  { marginTop: 8 },
  vMoreTitle: { fontSize: 17, fontWeight: '900', color: '#1a1a2e', paddingHorizontal: 16, marginBottom: 12 },
  vMoreScroll:{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  vMoreCard:  { width: 140, borderRadius: 20, padding: 14, gap: 6 },
  vMoreCardImg:  { width: '100%', height: 72, borderRadius: 12 },
  vMoreCardEmoji:{ fontSize: 34 },
  vMoreCardTitle:{ fontSize: 12, fontWeight: '800', color: '#1a1a2e', lineHeight: 17 },
  vMoreCardMeta: { fontSize: 10, fontWeight: '500', color: '#9A9AB0' },
});
