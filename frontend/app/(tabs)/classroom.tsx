import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChevronRight, Play, Star, BookOpen, Clock, X, Trophy, GraduationCap, Layers, ClipboardList, CheckCircle, AlertCircle, School, FileText, Telescope, Video as VideoIcon, Headphones, Image as ImageIcon, Link, Calendar } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';
import { Colors, Radius, Shadow } from '../../src/theme';
import { GIRAFFE, OWL, PENGUIN, ELEPHANT, BUTTERFLY } from '../../src/assets/svgs';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';

import AudioPlayer from '../../src/components/media/AudioPlayer';
import DocumentViewer from '../../src/components/media/DocumentViewer';

import { getStandardLabel } from '../../src/constants/standards';
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
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudentTab>('content');
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [previewContentIndex, setPreviewContentIndex] = useState<number | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<ClassroomAssignment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionAttachmentUrl, setSubmissionAttachmentUrl] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isHistoryOpen, setIsHistoryOpen]           = useState(false);
  const [historyLoading, setHistoryLoading]          = useState(false);
  const [historyClassrooms, setHistoryClassrooms]    = useState<ClassroomItem[]>([]);
  const [historySelectedId, setHistorySelectedId]    = useState<string | null>(null);

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
    async () => {
      const res = await apiFetch('/quizzes/students/classrooms');
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to load classroom data');
      }
      const payload = await res.json();
      const loadedClassrooms = (payload.classrooms || []) as ClassroomItem[];

      setClassrooms(loadedClassrooms);
      setSelectedClassroomId((current) => {
        if (current && loadedClassrooms.some((item) => item.id === current)) return current;
        return null;
      });
    },
    [apiFetch],
  );

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setMessage(null);
    try {
      await loadClassrooms();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load classrooms' });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, loadClassrooms]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await apiFetch('/quizzes/students/classrooms');
      if (res.ok) {
        const d = await res.json();
        const all = (d.classrooms ?? []) as ClassroomItem[];
        setHistoryClassrooms(all.filter((c) => c.status === 'completed'));
      }
    } finally { setHistoryLoading(false); }
  };

  const openHistory = () => { setIsHistoryOpen(true); loadHistory(); };

  // Active classrooms = non-completed
  const activeClassrooms = useMemo(
    () => classrooms.filter((c) => c.status !== 'completed'),
    [classrooms],
  );

  const selectedClassroom = useMemo(
    () => classrooms.find((item) => item.id === selectedClassroomId) || activeClassrooms[0] || null,
    [classrooms, selectedClassroomId, activeClassrooms],
  );

  const historySelected = useMemo(
    () => historyClassrooms.find((c) => c.id === historySelectedId) ?? null,
    [historyClassrooms, historySelectedId],
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
      await loadClassrooms();
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
      setSelectedClassroomId(null);   // Always return to list on tab focus
      loadData();
    }, [loadData])
  );

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        


        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>My Classes</Text>
          <Pressable style={clStyles.historyBtnSmall} onPress={openHistory}>
            <Clock size={13} color="#5A6A8A" />
            <Text style={clStyles.historyBtnSmallText}>History</Text>
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
        ) : activeClassrooms.length === 0 ? (
          <View style={styles.centerWrapper}>
            <SvgXml xml={PENGUIN} width={96} height={96} />
            <Text style={[styles.emptyText, { marginTop: 12, fontSize: 15, fontWeight: '700', color: '#1a1a2e' }]}>No active sessions yet</Text>
            <Text style={[styles.emptyText, { marginTop: 4 }]}>Your teacher hasn't started a class yet.</Text>
            <Pressable style={clStyles.historyLinkBtn} onPress={openHistory}>
              <Text style={clStyles.historyLinkText}>View Previous Classes</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── Active Classrooms List ── */}
            {!selectedClassroomId || !activeClassrooms.find((c) => c.id === selectedClassroomId) ? (
              <View style={clStyles.listSection}>
                <Text style={clStyles.listSectionLabel}>{activeClassrooms.length} active session{activeClassrooms.length !== 1 ? 's' : ''}</Text>
                {activeClassrooms.map((room, idx) => {
                  const BG_COLORS    = ['#D6EAFF', '#D6F5D6', '#FFE8D6', '#EDE4FF', '#FFF5CC'];
                  const ICON_COLORS  = ['#4A90E2', '#4CAF50', '#FF7043', '#9B8EC4', '#E6A817'];
                  const ICON_COMPS   = [BookOpen, School, Star, Layers, Telescope];
                  const bg           = BG_COLORS[idx % BG_COLORS.length];
                  const iconColor    = ICON_COLORS[idx % ICON_COLORS.length];
                  const IconComp     = ICON_COMPS[idx % ICON_COMPS.length];
                  const pending = room.assignments.filter((a) => a.status !== 'submitted').length;
                  return (
                    <Pressable key={room.id} style={[clStyles.roomCard, { backgroundColor: '#fff' }]}
                      onPress={() => setSelectedClassroomId(room.id)}>
                      <View style={[clStyles.roomCardArt, { backgroundColor: bg }]}>
                        <IconComp size={26} color={iconColor} />
                      </View>
                      <View style={clStyles.roomCardInfo}>
                        <Text style={clStyles.roomCardTitle} numberOfLines={1}>{room.title}</Text>
                        <Text style={clStyles.roomCardMeta}>
                          {getStandardLabel(room.classLevel)} · {room.scheduleType === 'instant' ? 'Instant' : 'Scheduled'}
                        </Text>
                        <View style={clStyles.roomCardChips}>
                          <View style={clStyles.roomChip}>
                            <BookOpen size={10} color="#5A7AB0" />
                            <Text style={clStyles.roomChipText}>{room.contents.length}</Text>
                          </View>
                          <View style={clStyles.roomChip}>
                            <Trophy size={10} color="#5A7AB0" />
                            <Text style={clStyles.roomChipText}>{room.quizzes.length} quiz</Text>
                          </View>
                          {pending > 0 && (
                            <View style={[clStyles.roomChip, { backgroundColor: '#FFE8D6' }]}>
                              <AlertCircle size={10} color="#E65100" />
                              <Text style={[clStyles.roomChipText, { color: '#E65100' }]}>{pending} due</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={clStyles.roomCardProgress}>
                        <Text style={clStyles.roomCardPct}>{room.completionPct}%</Text>
                        <Text style={clStyles.roomCardPctLabel}>done</Text>
                        <ChevronRight size={16} color="#9A9AB0" style={{ marginTop: 4 }} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <>
                {/* Back to list */}
                <Pressable style={clStyles.backToList} onPress={() => setSelectedClassroomId(null)}>
                  <Text style={clStyles.backToListText}>‹ All Classes</Text>
                </Pressable>

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
                    const CONTENT_SVGS = [GIRAFFE, OWL, ELEPHANT, BUTTERFLY, PENGUIN];
                    const bgColor = cardColors[idx % cardColors.length];
                    const contentSvg = CONTENT_SVGS[idx % CONTENT_SVGS.length];

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
                            <SvgXml xml={contentSvg} width={52} height={52} />
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
          </>
        )}
      </ScrollView>

      {/* ── History Modal ── */}
      <Modal visible={isHistoryOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { setIsHistoryOpen(false); setHistorySelectedId(null); }}>
        <View style={clStyles.historyScreen}>
          <View style={[clStyles.historyHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
            <Pressable onPress={() => { setIsHistoryOpen(false); setHistorySelectedId(null); }} style={clStyles.historyBackBtn}>
              <Text style={clStyles.historyBackArrow}>‹</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={clStyles.historyTitle}>
                {historySelectedId ? historySelected?.title ?? 'Class Details' : 'Previous Classes'}
              </Text>
              <Text style={clStyles.historySubtitle}>
                {historySelectedId ? 'Tap a quiz to play or replay' : 'Your completed classroom sessions'}
              </Text>
            </View>
            {historySelectedId && (
              <Pressable onPress={() => setHistorySelectedId(null)} style={clStyles.historyBackToListBtn}>
                <Text style={clStyles.historyBackToListText}>All Classes</Text>
              </Pressable>
            )}
          </View>

          {historyLoading ? (
            <View style={clStyles.historyCenter}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={{ color: '#9A9AB0', marginTop: 8 }}>Loading history…</Text>
            </View>
          ) : !historySelectedId ? (
            /* ── Classroom list ── */
            historyClassrooms.length === 0 ? (
              <View style={clStyles.historyCenter}>
                <SvgXml xml={OWL} width={88} height={88} />
                <Text style={clStyles.historyEmptyTitle}>No history yet</Text>
                <Text style={clStyles.historyEmptySub}>Completed classes will appear here.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={clStyles.historyList}>
                {historyClassrooms.map((room, idx) => {
                  const BG_COLORS   = ['#D6EAFF', '#D6F5D6', '#FFE8D6', '#EDE4FF', '#FFF5CC'];
                  const ICON_COLORS = ['#4A90E2', '#4CAF50', '#FF7043', '#9B8EC4', '#E6A817'];
                  const ICON_COMPS  = [School, BookOpen, Layers, Trophy, Star];
                  const IconComp    = ICON_COMPS[idx % ICON_COMPS.length];
                  return (
                    <Pressable key={room.id} style={clStyles.historyCard} onPress={() => setHistorySelectedId(room.id)}>
                      <View style={[clStyles.historyCardIcon, { backgroundColor: BG_COLORS[idx % BG_COLORS.length] }]}>
                        <IconComp size={22} color={ICON_COLORS[idx % ICON_COLORS.length]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={clStyles.historyCardTitle} numberOfLines={1}>{room.title}</Text>
                        <Text style={clStyles.historyCardMeta}>{getStandardLabel(room.classLevel)}</Text>
                        <View style={clStyles.historyCardChips}>
                          <View style={clStyles.historyChip}>
                            <Trophy size={9} color="#5A7AB0" />
                            <Text style={clStyles.historyChipText}>{room.quizzes.length} quiz</Text>
                          </View>
                          <View style={clStyles.historyChip}>
                            <ClipboardList size={9} color="#5A7AB0" />
                            <Text style={clStyles.historyChipText}>{room.assignments.length} task</Text>
                          </View>
                          <View style={[clStyles.historyChip, { backgroundColor: '#D6F5D6' }]}>
                            <Text style={[clStyles.historyChipText, { color: '#1A6B1A' }]}>{room.completionPct}% done</Text>
                          </View>
                        </View>
                      </View>
                      <ChevronRight size={18} color="#9A9AB0" />
                    </Pressable>
                  );
                })}
              </ScrollView>
            )
          ) : historySelected ? (
            /* ── Single history classroom detail ── */
            <ScrollView contentContainerStyle={clStyles.historyDetail}>
              {/* Stats */}
              <View style={clStyles.historyStatsRow}>
                <View style={clStyles.historyStat}>
                  <Text style={clStyles.historyStatVal}>{historySelected.contents.length}</Text>
                  <Text style={clStyles.historyStatLabel}>Content</Text>
                </View>
                <View style={clStyles.historyStat}>
                  <Text style={clStyles.historyStatVal}>{historySelected.quizzes.length}</Text>
                  <Text style={clStyles.historyStatLabel}>Quizzes</Text>
                </View>
                <View style={clStyles.historyStat}>
                  <Text style={clStyles.historyStatVal}>{historySelected.assignments.length}</Text>
                  <Text style={clStyles.historyStatLabel}>Tasks</Text>
                </View>
                <View style={clStyles.historyStat}>
                  <Text style={[clStyles.historyStatVal, { color: '#4A90E2' }]}>{historySelected.completionPct}%</Text>
                  <Text style={clStyles.historyStatLabel}>Done</Text>
                </View>
              </View>

              {/* Quizzes — with replay */}
              {historySelected.quizzes.length > 0 && (
                <View style={clStyles.historySection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Trophy size={16} color="#FF7043" />
                    <Text style={clStyles.historySectionTitle}>Quizzes</Text>
                  </View>
                  {historySelected.quizzes.map((quiz) => {
                    const canReplay = quiz.status === 'completed';
                    return (
                    <View key={quiz.id} style={clStyles.historyQuizCard}>
                      <View style={clStyles.historyQuizInfo}>
                        <Text style={clStyles.historyQuizTitle} numberOfLines={1}>{quiz.title}</Text>
                        <Text style={clStyles.historyQuizMeta}>{quiz.totalQuestions} questions · {quiz.subject}</Text>
                        {quiz.status === 'completed' && quiz.score !== undefined && (
                          <View style={[clStyles.historyScoreBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                            <Star size={10} color="#E6A817" fill="#E6A817" />
                            <Text style={clStyles.historyScoreText}>Score: {quiz.score}</Text>
                          </View>
                        )}
                      </View>
                      <Pressable style={clStyles.replayBtn} onPress={() => setSelectedQuizId(quiz.id)}>
                        <Play size={14} color="#fff" fill="#fff" />
                        <Text style={clStyles.replayBtnText}>{canReplay ? 'Replay' : 'Play'}</Text>
                      </Pressable>
                    </View>
                  );
                  })}
                </View>
              )}

              {/* Assignments — view only */}
              {historySelected.assignments.length > 0 && (
                <View style={clStyles.historySection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <ClipboardList size={16} color="#4A90E2" />
                    <Text style={clStyles.historySectionTitle}>Assignments</Text>
                  </View>
                  {historySelected.assignments.map((assignment) => (
                    <View key={assignment.id} style={clStyles.historyAssignCard}>
                      <Text style={clStyles.historyAssignTitle} numberOfLines={1}>{assignment.title}</Text>
                      <View style={[clStyles.historyChip, { backgroundColor: assignment.status === 'submitted' ? '#D6F5D6' : '#FFE8D6' }]}>
                        <Text style={[clStyles.historyChipText, { color: assignment.status === 'submitted' ? '#1A6B1A' : '#E65100' }]}>
                          {assignment.status === 'submitted' ? 'Submitted' : assignment.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      {selectedQuizId && (
        <QuizRenderer
          quizId={selectedQuizId}
          visible={selectedQuizId !== null}
          onClose={() => {
            setSelectedQuizId(null);
            loadClassrooms();
          }}
        />
      )}



      {/* Fullscreen Content Viewer Modal */}
      <Modal visible={previewContentIndex !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setPreviewContentIndex(null)}>
        {(() => {
          const BG_CARDS = ['#FAFAC8', '#D6EAFF', '#D6F5D6', '#FFE8D6', '#EDE4FF'];
          type TypeCfgEntry = { label: string; IconComp: React.ComponentType<{ size?: number; color?: string }>; accentColor: string; bgColor: string };
          const TYPE_CONFIG: Record<string, TypeCfgEntry> = {
            video:    { label: 'Video',    IconComp: VideoIcon,  accentColor: '#FF7043', bgColor: '#FFE8D6' },
            audio:    { label: 'Audio',    IconComp: Headphones, accentColor: '#9B8EC4', bgColor: '#EDE4FF' },
            image:    { label: 'Image',    IconComp: ImageIcon,  accentColor: '#4A90E2', bgColor: '#D6EAFF' },
            text:     { label: 'Reading',  IconComp: BookOpen,   accentColor: '#7DC67A', bgColor: '#D6F5D6' },
            youtube:  { label: 'YouTube',  IconComp: Play,       accentColor: '#FF4444', bgColor: '#FFE8D6' },
            document: { label: 'Document', IconComp: FileText,   accentColor: '#4A90E2', bgColor: '#D6EAFF' },
            link:     { label: 'Resource', IconComp: Link,       accentColor: '#E6A817', bgColor: '#FFF5CC' },
          };

          const curIdx   = previewContentIndex ?? 0;
          const contents = selectedClassroom?.contents ?? [];
          const content  = previewContent;
          const fallbackBg    = BG_CARDS[curIdx % BG_CARDS.length];
          const CONTENT_SVGS_VIEWER = [GIRAFFE, OWL, ELEPHANT, BUTTERFLY, PENGUIN];

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
          const typeCfg = TYPE_CONFIG[primaryType] ?? { label: 'Content', IconComp: BookOpen, accentColor: '#4A90E2', bgColor: fallbackBg };

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
                    <View style={[styles.vHeroIconBox, { backgroundColor: `${typeCfg.accentColor}18` }]}>
                      <typeCfg.IconComp size={40} color={typeCfg.accentColor} />
                    </View>
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
                            <sCfg.IconComp size={14} color={sCfg.accentColor} />
                          </View>
                          <Text style={styles.vSectionTitleTxt}>{(section as any).title}</Text>
                        </View>
                      ) : idx > 0 ? (
                        <View style={styles.vSectionTitleRow}>
                          <View style={[styles.vSectionChip, { backgroundColor: `${sCfg.accentColor}15` }]}>
                            <sCfg.IconComp size={14} color={sCfg.accentColor} />
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
                          subtitle={content?.subject ? `15 Minutes · ${content.subject}` : '15 Minutes'}
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
                            <Link size={14} color={sCfg.accentColor} />
                    <Text style={[styles.vLinkBtnTxt, { color: sCfg.accentColor }]}>Open Resource</Text>
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
                        const cBg  = BG_CARDS[i % BG_CARDS.length];
                        const cSvg = CONTENT_SVGS_VIEWER[i % CONTENT_SVGS_VIEWER.length];
                        const cm = resolveMediaUrl(c.mediaUrl);
                        const ce = resolveMediaUrl(c.externalUrl);
                        const img = isImageUrl(cm) ? cm : isImageUrl(ce) ? ce : '';
                        return (
                          <Pressable key={c.id} style={[styles.vMoreCard, { backgroundColor: cBg }]} onPress={() => setPreviewContentIndex(i)}>
                            {img
                              ? <Image source={{ uri: img }} style={styles.vMoreCardImg} resizeMode="cover" />
                              : <SvgXml xml={cSvg} width={44} height={44} />}
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
      <Modal visible={assignmentModal !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setAssignmentModal(null)}>
        <View style={aStyles.screen}>
          {/* Header */}
          <View style={[aStyles.header, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
            <Pressable onPress={() => setAssignmentModal(null)} style={aStyles.backBtn}>
              <X size={20} color="#1a1a2e" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={aStyles.headerLabel}>Assignment</Text>
              <Text style={aStyles.headerTitle} numberOfLines={1}>{assignmentModal?.title || 'Task'}</Text>
            </View>
            {assignmentModal?.status === 'submitted' ? (
              <View style={[aStyles.statusBadgeSubmitted, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <CheckCircle size={12} color="#1A6B1A" />
                <Text style={aStyles.statusBadgeText}>Submitted</Text>
              </View>
            ) : assignmentModal?.status === 'overdue' ? (
              <View style={aStyles.statusBadgeOverdue}><Text style={aStyles.statusBadgeText}>⚠ Overdue</Text></View>
            ) : (
              <View style={aStyles.statusBadgePending}><Text style={aStyles.statusBadgeText}>📋 Pending</Text></View>
            )}
          </View>

          <ScrollView contentContainerStyle={aStyles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* Meta row: due date + time bound */}
            <View style={aStyles.metaRow}>
              <View style={aStyles.metaChip}>
                <Calendar size={13} color="#5A6A8A" />
                <Text style={aStyles.metaChipText}>
                  {assignmentModal?.dueDate
                    ? `Due ${new Date(assignmentModal.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : 'No due date'}
                </Text>
              </View>
              {assignmentModal?.isTimeBound && (
                <View style={aStyles.metaChip}>
                  <Clock size={13} color="#5A6A8A" />
                  <Text style={aStyles.metaChipText}>Time-bound</Text>
                </View>
              )}
            </View>

            {/* Description */}
            {(assignmentModal?.description || assignmentModal?.instructions) ? (
              <View style={aStyles.section}>
                <Text style={aStyles.sectionLabel}>Description</Text>
                <View style={aStyles.sectionCard}>
                  {assignmentModal?.description ? (
                    <Text style={aStyles.sectionText}>{assignmentModal.description}</Text>
                  ) : null}
                  {assignmentModal?.instructions ? (
                    <>
                      {assignmentModal?.description ? <View style={aStyles.sectionDivider} /> : null}
                      <Text style={aStyles.sectionSubLabel}>Instructions</Text>
                      <Text style={aStyles.sectionText}>{assignmentModal.instructions}</Text>
                    </>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Teacher attachment */}
            {assignmentModal?.attachmentUrl ? (
              <View style={aStyles.section}>
                <Text style={aStyles.sectionLabel}>Reference Material</Text>
                <Pressable style={aStyles.attachmentRow} onPress={() => openExternalResource(assignmentModal.attachmentUrl!)}>
                  <View style={aStyles.attachmentIcon}><Link size={18} color="#4A90E2" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={aStyles.attachmentTitle}>View Attachment</Text>
                    <Text style={aStyles.attachmentUrl} numberOfLines={1}>{assignmentModal.attachmentUrl}</Text>
                  </View>
                  <Text style={aStyles.attachmentArrow}>›</Text>
                </Pressable>
              </View>
            ) : null}

            {/* ── Submitted view ── */}
            {assignmentModal?.status === 'submitted' ? (
              <View style={aStyles.section}>
                <Text style={aStyles.sectionLabel}>✅ Your Submission</Text>
                <View style={aStyles.submittedCard}>
                  <View style={aStyles.submittedBanner}>
                    <Text style={aStyles.submittedBannerTitle}>Assignment Submitted</Text>
                    {assignmentModal.submission?.submittedAt ? (
                      <Text style={aStyles.submittedBannerDate}>
                        {new Date(assignmentModal.submission.submittedAt).toLocaleString(undefined, {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    ) : null}
                  </View>
                  {submissionText ? (
                    <View style={aStyles.submittedField}>
                      <Text style={aStyles.submittedFieldLabel}>Your Answer</Text>
                      <Text style={aStyles.submittedFieldValue}>{submissionText}</Text>
                    </View>
                  ) : null}
                  {submissionAttachmentUrl ? (
                    <View style={aStyles.submittedField}>
                      <Text style={aStyles.submittedFieldLabel}>Attached File</Text>
                      <Pressable onPress={() => openExternalResource(submissionAttachmentUrl)}>
                        <Text style={aStyles.submittedAttachLink}>View submitted file</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : (
              /* ── Submission form ── */
              <View style={aStyles.section}>
                <Text style={aStyles.sectionLabel}>✏️ Your Submission</Text>

                {/* Answer text */}
                <View style={aStyles.fieldGroup}>
                  <Text style={aStyles.fieldLabel}>Answer / Notes</Text>
                  <Text style={aStyles.fieldHint}>Write your answer, observations, or notes for this task.</Text>
                  <TextInput
                    value={submissionText}
                    onChangeText={setSubmissionText}
                    placeholder="Start writing your answer here…"
                    style={aStyles.textArea}
                    multiline
                    textAlignVertical="top"
                    placeholderTextColor="#B0B8D0"
                  />
                </View>

                {/* Attachment */}
                <View style={aStyles.fieldGroup}>
                  <Text style={aStyles.fieldLabel}>Attachment (optional)</Text>
                  <Text style={aStyles.fieldHint}>Upload a file or paste a link to your work.</Text>
                  <View style={aStyles.uploadRow}>
                    <TextInput
                      value={submissionAttachmentUrl}
                      onChangeText={setSubmissionAttachmentUrl}
                      placeholder="https://… or tap Upload"
                      style={aStyles.urlInput}
                      autoCapitalize="none"
                      placeholderTextColor="#B0B8D0"
                    />
                  </View>
                  <Pressable style={aStyles.uploadFileBtn} onPress={uploadSubmissionAttachment}>
                    <Text style={aStyles.uploadFileBtnText}>Upload File</Text>
                  </Pressable>
                  {submissionAttachmentUrl ? (
                    <View style={aStyles.attachPreviewRow}>
                      <FileText size={13} color="#1A4DA2" />
                      <Text style={aStyles.attachPreviewText} numberOfLines={1}>{submissionAttachmentUrl}</Text>
                      <Pressable onPress={() => setSubmissionAttachmentUrl('')}>
                        <X size={14} color="#FF7043" />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Footer submit button */}
          {assignmentModal?.status !== 'submitted' && (
            <View style={aStyles.footer}>
              <Pressable style={aStyles.submitBtn} onPress={submitAssignment} disabled={savingSubmission}>
                {savingSubmission
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={aStyles.submitBtnText}>Submit Assignment</Text>}
              </Pressable>
            </View>
          )}
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
  vHeroIconBox: { width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, paddingVertical: 14,
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

// ── Assignment full-screen modal styles ────────────────────────────────────────
const aStyles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#F5F7FF' },

  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#F5F7FF' },
  headerLabel: { fontSize: 10, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.8 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1a1a2e', marginTop: 1 },

  statusBadgeSubmitted: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#D6F5D6' },
  statusBadgeOverdue:   { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FFE8D6' },
  statusBadgePending:   { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EEF4FF' },
  statusBadgeText:      { fontSize: 11, fontWeight: '800', color: '#1a1a2e' },

  scrollContent: { padding: 16, gap: 16 },

  metaRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  metaChipEmoji: { fontSize: 13 },
  metaChipText:  { fontSize: 12, fontWeight: '700', color: '#5A6A8A' },

  section:       { gap: 8 },
  sectionLabel:  { fontSize: 11, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.8, paddingLeft: 2 },
  sectionCard:   { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 6, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  sectionText:   { fontSize: 14, color: '#1a1a2e', lineHeight: 22, fontWeight: '500' },
  sectionSubLabel:{ fontSize: 11, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  sectionDivider:{ height: 1, backgroundColor: '#F0F0F8', marginVertical: 6 },

  attachmentRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  attachmentIcon:   { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' },
  attachmentTitle:  { fontSize: 14, fontWeight: '800', color: '#1A4DA2' },
  attachmentUrl:    { fontSize: 11, color: '#9A9AB0', marginTop: 2 },
  attachmentArrow:  { fontSize: 22, color: '#9A9AB0', fontWeight: '300' },

  submittedCard:        { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  submittedBanner:      { backgroundColor: '#D6F5D6', padding: 16, gap: 3 },
  submittedBannerTitle: { fontSize: 16, fontWeight: '900', color: '#1A6B1A' },
  submittedBannerDate:  { fontSize: 12, fontWeight: '600', color: '#4CAF50' },
  submittedField:       { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F5F7FF', gap: 5 },
  submittedFieldLabel:  { fontSize: 11, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5 },
  submittedFieldValue:  { fontSize: 14, color: '#1a1a2e', lineHeight: 22, fontWeight: '500' },
  submittedAttachLink:  { fontSize: 13, color: '#4A90E2', fontWeight: '700' },

  fieldGroup:  { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 8, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  fieldLabel:  { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  fieldHint:   { fontSize: 12, color: '#9A9AB0', fontWeight: '500', lineHeight: 18, marginBottom: 2 },
  textArea:    { backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, padding: 14, minHeight: 120, fontSize: 14, color: '#1a1a2e', lineHeight: 22 },
  uploadRow:   { gap: 8 },
  urlInput:    { backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: '#1a1a2e' },
  uploadFileBtn:    { borderRadius: 12, borderWidth: 1.5, borderColor: '#D6EAFF', backgroundColor: '#F5F9FF', paddingVertical: 12, alignItems: 'center' },
  uploadFileBtnText:{ fontSize: 13, fontWeight: '700', color: '#4A90E2' },
  attachPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF4FF', borderRadius: 10, padding: 10 },
  attachPreviewText:{ flex: 1, fontSize: 12, color: '#1A4DA2', fontWeight: '500' },
  attachClearBtn:   { fontSize: 13, fontWeight: '800', color: '#FF7043' },

  footer:        { padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F8' },
  submitBtn:     { backgroundColor: '#4A90E2', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
});

// ── Classroom list + history styles ───────────────────────────────────────────
const clStyles = StyleSheet.create({
  // Header additions
  historyBtnSmall:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, borderWidth: 1.5, borderColor: '#D0D8F0', paddingHorizontal: 10, paddingVertical: 6 },
  historyBtnSmallText: { fontSize: 11, fontWeight: '700', color: '#5A6A8A' },

  historyLinkBtn:  { marginTop: 12, borderRadius: 12, backgroundColor: '#EBF4FF', paddingHorizontal: 16, paddingVertical: 10 },
  historyLinkText: { fontSize: 13, fontWeight: '800', color: '#1A4DA2' },

  // Active classroom list
  listSection:      { paddingBottom: 8 },
  listSectionLabel: { fontSize: 12, fontWeight: '700', color: '#9A9AB0', marginBottom: 10, paddingHorizontal: 4 },

  roomCard:     { flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  roomCardArt:  { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  roomCardInfo: { flex: 1 },
  roomCardTitle:{ fontSize: 15, fontWeight: '800', color: '#1a1a2e', lineHeight: 22 },
  roomCardMeta: { fontSize: 12, color: '#9A9AB0', fontWeight: '500', marginTop: 2 },
  roomCardChips:{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  roomChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#F0F4FF' },
  roomChipText: { fontSize: 11, fontWeight: '700', color: '#5A7AB0' },
  roomCardProgress: { alignItems: 'center', gap: 2, flexShrink: 0 },
  roomCardPct:  { fontSize: 18, fontWeight: '900', color: '#4A90E2' },
  roomCardPctLabel: { fontSize: 9, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase' },

  backToList:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, marginBottom: 6 },
  backToListText: { fontSize: 13, fontWeight: '700', color: '#4A90E2' },

  // History full-screen modal
  historyScreen:    { flex: 1, backgroundColor: '#F5F7FF' },
  historyHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  historyBackBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F7FF', alignItems: 'center', justifyContent: 'center' },
  historyBackArrow: { fontSize: 28, color: '#1a1a2e', fontWeight: '300', lineHeight: 34 },
  historyTitle:     { fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  historySubtitle:  { fontSize: 11, color: '#9A9AB0', fontWeight: '500', marginTop: 1 },
  historyBackToListBtn: { borderRadius: 10, backgroundColor: '#EBF4FF', paddingHorizontal: 12, paddingVertical: 6 },
  historyBackToListText:{ fontSize: 12, fontWeight: '700', color: '#1A4DA2' },

  historyCenter:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 60 },
  historyEmptyTitle:{ fontSize: 18, fontWeight: '900', color: '#1a1a2e' },
  historyEmptySub:  { fontSize: 13, color: '#9A9AB0', textAlign: 'center' },
  historyList:      { padding: 16, gap: 10, paddingBottom: 40 },

  historyCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 18, padding: 14, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  historyCardIcon:  { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  historyCardTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  historyCardMeta:  { fontSize: 12, color: '#9A9AB0', fontWeight: '500', marginTop: 1 },
  historyCardChips: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  historyChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#F0F4FF' },
  historyChipText:  { fontSize: 10, fontWeight: '700', color: '#5A7AB0' },

  // History single classroom detail
  historyDetail:    { padding: 16, paddingBottom: 48 },
  historyStatsRow:  { flexDirection: 'row', gap: 10, marginBottom: 16 },
  historyStat:      { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 3, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  historyStatVal:   { fontSize: 22, fontWeight: '900', color: '#1a1a2e' },
  historyStatLabel: { fontSize: 10, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase' },

  historySection:      { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  historySectionTitle: { fontSize: 14, fontWeight: '900', color: '#1a1a2e' },

  historyQuizCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  historyQuizInfo:  { flex: 1 },
  historyQuizTitle: { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  historyQuizMeta:  { fontSize: 11, color: '#9A9AB0', fontWeight: '500', marginTop: 2 },
  historyScoreBadge:{ marginTop: 4, backgroundColor: '#FFF5CC', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  historyScoreText: { fontSize: 11, fontWeight: '800', color: '#E6A817' },

  replayBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#4A90E2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  replayBtnText:  { fontSize: 12, fontWeight: '800', color: '#fff' },

  historyAssignCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  historyAssignTitle:{ fontSize: 13, fontWeight: '700', color: '#1a1a2e', flex: 1, marginRight: 8 },
});
