import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { ModalHeader } from '../../src/components/common/ModalHeader';
import { ChevronRight, Play, Star, BookOpen, Clock, X, Trophy, GraduationCap, Layers, ClipboardList, CheckCircle, AlertCircle, School, FileText, Telescope, Video as VideoIcon, Headphones, Image as ImageIcon, Link, Link2, UploadCloud, Calendar, Lock, Timer, ChevronLeft, Maximize2, Pause, Volume2 } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';
import { Colors, Radius, Shadow } from '../../src/theme';
import { GIRAFFE, OWL, PENGUIN, ELEPHANT, BUTTERFLY } from '../../src/assets/svgs';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';

import AudioPlayer from '../../src/components/media/AudioPlayer';
import DocumentViewer from '../../src/components/media/DocumentViewer';
import UniversalLinkPlayer from '../../src/components/media/UniversalLinkPlayer';
import UniversalFileViewer from '../../src/components/media/UniversalFileViewer';
import RichTextRenderer from '../../src/components/text/RichTextRenderer';

import { getStandardLabel } from '../../src/constants/standards';
import { API_BASE_URL, useAuth } from '../../src/context/AuthContext';
import QuizRenderer from '../../src/components/quiz/QuizRenderer';
import StudentVideoLearningView from '../../src/components/student/StudentVideoLearningView';
import { createVideoSectionsApi } from '../../src/api/videoSections';
import { PickedFile, pickFileAsDataUrl, uploadPickedFileToS3 } from '../../src/utils/fileUpload';
import MediaUploader from '../../src/components/media/MediaUploader';
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
  endTime?: string | null;
  status: 'active' | 'completed' | 'draft';
  completionPct: number;
  contents: LearningContentItem[];
  quizzes: ClassroomQuiz[];
  assignments: ClassroomAssignment[];
};

type StudentTab = 'content' | 'quiz' | 'assignments';


const STATUS_COLORS: Record<ClassroomItem['status'], string> = {
  active: '#16a34a',
  completed: '#525C6B',
  draft: '#2563eb',
};




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

// Some feeds key content by a composite `<contentUuid>:<sectionOrder>` id;
// video-section endpoints need the raw content UUID.
function baseContentId(id: string): string {
  return String(id).split(':')[0];
}

// Draft/preview ids (e.g. "d-25") are not persisted content; skip video APIs.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(id: string): boolean {
  return UUID_RE.test(String(id));
}

function isImageUrl(url: string): boolean {
  if (!url) return false;
  return (
    /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)(?:$|[?#])/i.test(url) ||
    /images\.unsplash\.com/i.test(url) ||
    /^data:image\//i.test(url) ||
    /(?:auto|format)=(?:jpg|jpeg|png|webp|avif)/i.test(url) ||
    /\/images?\//i.test(url) ||
    /\b(photo|image|picture|graphic)\b/i.test(url)
  );
}

function isYouTubeUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be');
}

function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
  return match ? match[1] : null;
}

function getYouTubeEmbedUrl(url: string): string {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : url;
}

function getYouTubeThumbnail(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
}

export default function ClassroomScreen() {
  const { apiFetch, isAuthenticated, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isLargeScreen = windowWidth >= 900;
  const isTabletOrLarger = windowWidth >= 640;

  const [loading, setLoading] = useState(true);
  const [savingSubmission, setSavingSubmission] = useState(false);
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [activeClassroomPage, setActiveClassroomPage] = useState(1);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [viewAllClasses, setViewAllClasses] = useState(false);
  const [nowTs, setNowTs] = useState<number>(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const [activeTab, setActiveTab] = useState<StudentTab>('content');
  const [activeContentIndex, setActiveContentIndex] = useState<number>(0);
  const [activePanelTab, setActivePanelTab] = useState<'quiz' | 'assignments'>('quiz');

  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [previewContentIndex, setPreviewContentIndex] = useState<number | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<ClassroomAssignment | null>(null);
  const [submissionText, setSubmissionText]                   = useState('');
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
      const res = await apiFetch('/classrooms/student');
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
      const res = await apiFetch('/classrooms/student');
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

  const activeContent = useMemo(() => {
    if (!selectedClassroom || !selectedClassroom.contents.length) return null;
    const idx = Math.min(Math.max(0, activeContentIndex), selectedClassroom.contents.length - 1);
    return selectedClassroom.contents[idx] || null;
  }, [selectedClassroom, activeContentIndex]);

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

  // Detect whether the currently opened content has published video sections so
  // we can render the sectioned watch -> quiz -> progress experience.
  const vsApi = useMemo(() => createVideoSectionsApi(apiFetch), [apiFetch]);
  // Video learning sections are scoped to a specific content section, keyed here
  // by `<contentUuid>:<sectionOrder>` (1-based). Each video content section is
  // checked independently for published sections.
  const [sectionedMap, setSectionedMap] = useState<Record<string, { url: string }>>({});
  useEffect(() => {
    const c = (previewContent || activeContent) as any;
    if (!c?.id) return undefined;
    const secs = c.sections?.length ? c.sections : [c];
    const baseId = baseContentId(c.id);
    if (!isUuid(baseId)) return undefined;
    let cancelled = false;
    (async () => {
      const found: Record<string, { url: string }> = {};
      await Promise.all(
        secs.map(async (s: any, idx: number) => {
          const u = resolveMediaUrl(s?.externalUrl) || resolveMediaUrl(s?.mediaUrl) || '';
          if (!u || !(isYouTubeUrl(u) || /\.(mp4|mov|webm|avi)/i.test(u))) return;
          const order = idx + 1;
          try {
            const rows = await vsApi.list(baseId, order);
            if (rows.length > 0) {
              found[`${baseId}:${order}`] = { url: u };
            }
          } catch {
            /* ignore */
          }
        }),
      );
      if (!cancelled && Object.keys(found).length > 0) {
        setSectionedMap((m) => ({ ...m, ...found }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [previewContent, activeContent, vsApi]);

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



  const submitAssignment = async () => {
    if (!assignmentModal || !selectedClassroom) return;
    if (!submissionText.trim() && !submissionAttachmentUrl.trim()) {
      setMessage({ type: 'error', text: 'Please provide submission text or attachment.' });
      return;
    }
    setSavingSubmission(true);
    try {
      const res = await apiFetch(
        `/assignments/classrooms/${selectedClassroom.id}/${assignmentModal.id}/submissions`,
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
      loadData();
    }, [loadData])
  );

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        


        {/* Header */}
        {(viewAllClasses || (!selectedClassroomId && !isLargeScreen) || !selectedClassroom) ? (
          <View style={clStyles.myClassesHeaderRow}>
            <View>
              <Text style={clStyles.myClassesTitle}>My Classes</Text>
              <Text style={clStyles.myClassesSub}>
                {activeClassrooms.length} active session{activeClassrooms.length !== 1 ? 's' : ''} available to learn
              </Text>
            </View>
            <Pressable style={clStyles.historyBtnModern} onPress={openHistory}>
              <Clock size={15} color="#2D5DC9" />
              <Text style={clStyles.historyBtnModernText}>Class History</Text>
            </Pressable>
          </View>
        ) : (
          <View style={theaterStyles.classroomHeaderBar}>
            <Pressable
              style={theaterStyles.backBtn}
              onPress={() => {
                setViewAllClasses(true);
                setSelectedClassroomId(null);
              }}
            >
              <ChevronLeft size={16} color="#2D5DC9" />
              <Text style={theaterStyles.backBtnText}>All Classes</Text>
            </Pressable>

            <View style={theaterStyles.classTitleWrap}>
              <Text style={theaterStyles.headerClassTitle} numberOfLines={1}>
                {selectedClassroom.title}
              </Text>
              <View style={theaterStyles.standardBadge}>
                <Text style={theaterStyles.standardBadgeText}>
                  {getStandardLabel(selectedClassroom.classLevel)}
                </Text>
              </View>
            </View>

            <Pressable style={clStyles.historyBtnSmall} onPress={openHistory}>
              <Clock size={13} color="#5A6A8A" />
              <Text style={clStyles.historyBtnSmallText}>History</Text>
            </Pressable>
          </View>
        )}

        {message ? (
          <View style={[styles.messageCard, message.type === 'success' ? styles.successCard : styles.errorCard]}>
            <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>{message.text}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centerWrapper}>
            <ActivityIndicator accessibilityLabel="Loading" size="large" color="#4f46e5" />
            <Text style={styles.loadingText}>Loading Playroom...</Text>
          </View>
        ) : activeClassrooms.length === 0 && !(selectedClassroomId && classrooms.find((c) => c.id === selectedClassroomId)) ? (
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
            {(viewAllClasses || (!selectedClassroomId && !isLargeScreen) || !selectedClassroom) ? (
              <View style={clStyles.listSection}>
                <View style={clStyles.gridContainer}>
                  {activeClassrooms.slice((activeClassroomPage - 1) * 10, activeClassroomPage * 10).map((room, idx) => {
                    const curIdx = (activeClassroomPage - 1) * 10 + idx;
                    const BG_COLORS    = ['#EBF3FF', '#E8F8F0', '#FFF2EA', '#F3ECFF', '#FFF8DB'];
                    const ICON_COLORS  = ['#2D5DC9', '#176B47', '#D33F13', '#7C3AED', '#B45309'];
                    const ICON_COMPS   = [BookOpen, School, Star, Layers, Telescope];
                    const bg           = BG_COLORS[curIdx % BG_COLORS.length];
                    const iconColor    = ICON_COLORS[curIdx % ICON_COLORS.length];
                    const IconComp     = ICON_COMPS[curIdx % ICON_COMPS.length];
                    const pending = room.assignments.filter((a) => a.status !== 'submitted').length;

                    return (
                      <Pressable
                        key={room.id}
                        style={[
                          clStyles.modernClassCard,
                          isTabletOrLarger && clStyles.modernClassCardDesktop,
                        ]}
                        onPress={() => {
                          setSelectedClassroomId(room.id);
                          setViewAllClasses(false);
                          setActiveContentIndex(0);
                        }}
                      >
                        {/* Top Card Header */}
                        <View style={clStyles.classCardTop}>
                          <View style={[clStyles.classCardIconWrap, { backgroundColor: bg }]}>
                            <IconComp size={24} color={iconColor} />
                          </View>
                          <View style={clStyles.classCardBadges}>
                            <View style={clStyles.classLevelBadge}>
                              <Text style={clStyles.classLevelBadgeText}>
                                {getStandardLabel(room.classLevel)}
                              </Text>
                            </View>
                            <View style={clStyles.classLiveBadge}>
                              <View style={clStyles.classLiveDot} />
                              <Text style={clStyles.classLiveBadgeText}>
                                {room.scheduleType === 'instant' ? 'Instant' : 'Scheduled'}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Title and Schedule Info */}
                        <View style={clStyles.classCardMain}>
                          <Text style={clStyles.classCardTitle} numberOfLines={2}>
                            {room.title}
                          </Text>
                          {room.scheduleType === 'scheduled' && room.startTime ? (
                            <View style={clStyles.classCardTimeRow}>
                              <Calendar size={12} color="#525C6B" />
                              <Text style={clStyles.classCardTimeText}>
                                {new Date(room.startTime).toLocaleDateString()} • {new Date(room.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                          ) : (
                            <Text style={clStyles.classCardSub}>
                              Self-paced interactive class
                            </Text>
                          )}
                        </View>

                        {/* Key Metrics: Videos, Quizzes, Tasks */}
                        <View style={clStyles.classMetricsRow}>
                          <View style={clStyles.classMetricPill}>
                            <VideoIcon size={12} color="#2D5DC9" />
                            <Text style={clStyles.classMetricPillText}>
                              {room.contents.length} video{room.contents.length !== 1 ? 's' : ''}
                            </Text>
                          </View>
                          <View style={clStyles.classMetricPill}>
                            <Trophy size={12} color="#D33F13" />
                            <Text style={clStyles.classMetricPillText}>
                              {room.quizzes.length} quiz{room.quizzes.length !== 1 ? 'zes' : ''}
                            </Text>
                          </View>
                          {pending > 0 ? (
                            <View style={[clStyles.classMetricPill, clStyles.classMetricPillDue]}>
                              <AlertCircle size={12} color="#B23D00" />
                              <Text style={[clStyles.classMetricPillText, { color: '#B23D00' }]}>
                                {pending} task{pending !== 1 ? 's' : ''} due
                              </Text>
                            </View>
                          ) : room.assignments.length > 0 ? (
                            <View style={clStyles.classMetricPill}>
                              <ClipboardList size={12} color="#525C6B" />
                              <Text style={clStyles.classMetricPillText}>
                                {room.assignments.length} tasks
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Progress Bar */}
                        <View style={clStyles.classProgressSection}>
                          <View style={clStyles.classProgressTop}>
                            <Text style={clStyles.classProgressLabel}>Completion</Text>
                            <Text style={clStyles.classProgressVal}>{room.completionPct}%</Text>
                          </View>
                          <View style={clStyles.progressBarTrack}>
                            <View
                              style={[
                                clStyles.progressBarFill,
                                { width: `${Math.min(100, Math.max(0, room.completionPct))}%` },
                              ]}
                            />
                          </View>
                        </View>

                        {/* Card Action Button */}
                        <View style={clStyles.classCardActionRow}>
                          <Text style={clStyles.classCardActionText}>Enter Classroom</Text>
                          <ChevronRight size={16} color="#2D5DC9" />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                {(() => {
                  const itemsPerPage = 10;
                  const totalPages = Math.ceil(activeClassrooms.length / itemsPerPage);
                  if (totalPages <= 1) return null;
                  return (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                      <Pressable 
                        style={[clStyles.pageBtn, activeClassroomPage === 1 && { opacity: 0.5 }]} 
                        onPress={() => setActiveClassroomPage(p => Math.max(1, p - 1))}
                        disabled={activeClassroomPage === 1}
                      >
                        <Text style={clStyles.pageBtnText}>Previous</Text>
                      </Pressable>
                      <Text style={clStyles.pageText}>Page {activeClassroomPage} of {totalPages}</Text>
                      <Pressable 
                        style={[clStyles.pageBtn, activeClassroomPage === totalPages && { opacity: 0.5 }]} 
                        onPress={() => setActiveClassroomPage(p => Math.min(totalPages, p + 1))}
                        disabled={activeClassroomPage === totalPages}
                      >
                        <Text style={clStyles.pageBtnText}>Next</Text>
                      </Pressable>
                    </View>
                  );
                })()}
              </View>
            ) : (
              <>

                {selectedClassroom && selectedClassroom.scheduleType === 'scheduled' && selectedClassroom.startTime && new Date(selectedClassroom.startTime).getTime() > nowTs ? (
                  <View style={clStyles.notStartedCard}>
                    <View style={clStyles.notStartedIconBox}>
                      <Lock size={42} color="#2D5DC9" />
                    </View>
                    <Text style={clStyles.notStartedTitle}>Class hasn't started yet</Text>
                    <Text style={clStyles.notStartedSubtitle} numberOfLines={2}>
                      {selectedClassroom.title}
                    </Text>
                    <View style={clStyles.countdownRow}>
                      {(() => {
                        const remainMs = Math.max(0, new Date(selectedClassroom.startTime!).getTime() - nowTs);
                        const totalSec = Math.floor(remainMs / 1000);
                        const days = Math.floor(totalSec / 86400);
                        const hours = Math.floor((totalSec % 86400) / 3600);
                        const minutes = Math.floor((totalSec % 3600) / 60);
                        const seconds = totalSec % 60;
                        const pad = (n: number) => String(n).padStart(2, '0');
                        const units = days > 0
                          ? [['Days', String(days)], ['Hours', pad(hours)], ['Min', pad(minutes)], ['Sec', pad(seconds)]]
                          : [['Hours', pad(hours)], ['Min', pad(minutes)], ['Sec', pad(seconds)]];
                        return units.map(([label, val]) => (
                          <View key={label} style={clStyles.countdownUnit}>
                            <Text style={clStyles.countdownVal}>{val}</Text>
                            <Text style={clStyles.countdownLabel}>{label}</Text>
                          </View>
                        ));
                      })()}
                    </View>
                    <View style={clStyles.scheduledMetaRow}>
                      <Calendar size={14} color="#3F5D8C" />
                      <Text style={clStyles.scheduledMetaText}>
                        Starts {new Date(selectedClassroom.startTime).toLocaleString()}
                      </Text>
                    </View>
                    {selectedClassroom.endTime ? (
                      <View style={clStyles.scheduledMetaRow}>
                        <Timer size={14} color="#3F5D8C" />
                        <Text style={clStyles.scheduledMetaText}>
                          Ends {new Date(selectedClassroom.endTime).toLocaleString()}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={clStyles.notStartedHint}>
                      Content, quizzes, and assignments will unlock when class starts.
                    </Text>
                  </View>
                ) : (
                  <>
                    {isLargeScreen ? (
                      /* ── 2-COLUMN THEATRE LAYOUT MATCHING REFERENCE DESIGN ── */
                      (() => {
                        const activeUrl = resolveMediaUrl(activeContent?.mediaUrl) || resolveMediaUrl(activeContent?.externalUrl) || '';
                        const isLinksContent = activeContent?.contentType === 'links';
                        const isFileUploadContent = activeContent?.contentType === 'file_upload';
                        const activeYtVideoId = getYouTubeVideoId(activeUrl);
                        const activeSecKey = activeContent?.id ? `${baseContentId(activeContent.id)}:1` : '';
                        const activeSectioned = activeSecKey ? sectionedMap[activeSecKey] : null;
                        const isVideoContent = Boolean(activeSectioned || activeYtVideoId || (activeUrl && activeUrl.match(/\.(mp4|mov|webm|avi)/i)));
                        const isAudioContent = Boolean(activeUrl && activeUrl.match(/\.(mp3|wav|ogg|aac|m4a|flac)/i));
                        const isImageContent = Boolean(activeUrl && isImageUrl(activeUrl));
                        const isDocContent = Boolean(activeUrl && activeUrl.match(/\.(pdf|doc|docx|ppt|pptx|txt|rtf)/i));
                        const isTextOnlyContent = !isVideoContent && !isAudioContent && !isImageContent && !isDocContent && Boolean(activeContent?.textContent);

                        return (
                          <View style={theaterStyles.container}>
                            {/* LEFT COLUMN: Main Video Stage + Interactive Activities */}
                            <View style={theaterStyles.leftCol}>
                              {/* 1. Video Player Card */}
                              <View style={theaterStyles.videoCard}>
                                {/* Card Top Bar */}
                                <View style={theaterStyles.videoTopBar}>
                                  <View style={theaterStyles.videoTopBarLeft}>
                                    {isLinksContent ? (
                                      <Link2 size={16} color="#0284C7" />
                                    ) : isFileUploadContent ? (
                                      <UploadCloud size={16} color="#2D5DC9" />
                                    ) : isAudioContent ? (
                                      <Headphones size={16} color="#7C3AED" />
                                    ) : isImageContent ? (
                                      <ImageIcon size={16} color="#0D9488" />
                                    ) : isDocContent ? (
                                      <FileText size={16} color="#0284C7" />
                                    ) : isTextOnlyContent ? (
                                      <BookOpen size={16} color="#0D9488" />
                                    ) : (
                                      <VideoIcon size={16} color="#2D5DC9" />
                                    )}
                                    <Text style={theaterStyles.videoTopBarTitle} numberOfLines={1}>
                                      {activeContent?.title || 'Learning Content'}
                                    </Text>
                                  </View>
                                  <View style={theaterStyles.videoTopBarRight}>
                                    {activeContent?.subject ? (
                                      <View style={theaterStyles.videoTypeBadge}>
                                        <Text style={theaterStyles.videoTypeBadgeText}>
                                          {activeContent.subject}
                                        </Text>
                                      </View>
                                    ) : null}
                                    <Pressable
                                      style={theaterStyles.fullscreenBtn}
                                      onPress={() => openContentAt(activeContentIndex)}
                                      accessibilityLabel="Open Fullscreen"
                                    >
                                      <Maximize2 size={15} color="#525C6B" />
                                    </Pressable>
                                  </View>
                                </View>

                                {/* Media Display Area */}
                                {(() => {
                                  if (!activeContent) {
                                    return (
                                      <View style={theaterStyles.videoPlayerWrap}>
                                        <View style={theaterStyles.emptyPlayer}>
                                          <Text style={theaterStyles.emptyPlayerText}>No lesson selected</Text>
                                        </View>
                                      </View>
                                    );
                                  }

                                  if (isLinksContent && activeUrl) {
                                    return (
                                      <View style={theaterStyles.videoPlayerWrap}>
                                        <UniversalLinkPlayer
                                          url={activeUrl}
                                          title={activeContent.title}
                                          showBadge={false}
                                          fillContainer
                                        />
                                      </View>
                                    );
                                  }

                                  if (isFileUploadContent) {
                                    return (
                                      <View style={{ minHeight: 320, padding: 12 }}>
                                        <UniversalFileViewer
                                          mediaUrl={activeContent.mediaUrl || activeUrl}
                                          fileName={activeContent.title}
                                          textContent={activeContent.textContent}
                                        />
                                      </View>
                                    );
                                  }

                                  if (activeSectioned) {
                                    return (
                                      <View style={theaterStyles.videoPlayerWrap}>
                                        <StudentVideoLearningView
                                          contentId={baseContentId(activeContent.id)}
                                          contentSectionOrder={1}
                                          videoUrl={activeSectioned.url}
                                          apiFetch={apiFetch}
                                        />
                                      </View>
                                    );
                                  }

                                  if (activeYtVideoId) {
                                    return (
                                      <View style={theaterStyles.videoPlayerWrap}>
                                        {Platform.OS === 'web' ? (
                                          <View style={theaterStyles.webVideoFrame}>
                                            <iframe
                                              src={`https://www.youtube.com/embed/${activeYtVideoId}?rel=0&autoplay=0&controls=1`}
                                              style={{ width: '100%', height: '100%', border: 'none' } as any}
                                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                              allowFullScreen
                                            />
                                          </View>
                                        ) : (
                                          <YoutubePlayer
                                            height={380}
                                            videoId={activeYtVideoId}
                                            webViewStyle={{ opacity: 0.99 }}
                                          />
                                        )}
                                      </View>
                                    );
                                  }

                                  if (activeUrl && activeUrl.match(/\.(mp4|mov|webm|avi)/i)) {
                                    return (
                                      <View style={theaterStyles.videoPlayerWrap}>
                                        <View style={theaterStyles.webVideoFrame}>
                                          <Video
                                            source={{ uri: activeUrl }}
                                            useNativeControls
                                            resizeMode={ResizeMode.CONTAIN}
                                            style={{ width: '100%', height: '100%' }}
                                          />
                                        </View>
                                      </View>
                                    );
                                  }

                                  if (isAudioContent) {
                                    return (
                                      <View style={theaterStyles.audioPlayerWrap}>
                                        <AudioPlayer
                                          uri={activeUrl}
                                          title={activeContent.title}
                                          subtitle={activeContent.subject ? `${activeContent.subject}` : 'Audio Lesson'}
                                          emoji="🎵"
                                          accentColor="#6B5C97"
                                          bgColor="#EDE4FF"
                                          hasPrev={activeContentIndex > 0}
                                          hasNext={activeContentIndex < selectedClassroom.contents.length - 1}
                                          onPrev={() => setActiveContentIndex((i) => Math.max(0, i - 1))}
                                          onNext={() => setActiveContentIndex((i) => Math.min(selectedClassroom.contents.length - 1, i + 1))}
                                        />
                                      </View>
                                    );
                                  }

                                  if (isImageContent) {
                                    return (
                                      <View style={theaterStyles.imagePlayerWrap}>
                                        <Image source={{ uri: activeUrl }} style={theaterStyles.stageImage} resizeMode="contain" />
                                      </View>
                                    );
                                  }

                                  if (isDocContent) {
                                    return (
                                      <View style={theaterStyles.docPlayerWrap}>
                                        <View style={theaterStyles.docCardInner}>
                                          <View style={theaterStyles.docIconCircle}>
                                            <FileText size={36} color="#0284C7" />
                                          </View>
                                          <Text style={theaterStyles.docTitleText}>{activeContent.title}</Text>
                                          <Text style={theaterStyles.docSubtitleText}>Attached Document / Reading File</Text>
                                          <Pressable
                                            style={theaterStyles.docOpenBtn}
                                            onPress={() => {
                                              if (Platform.OS === 'web') {
                                                window.open(activeUrl, '_blank');
                                              } else {
                                                Linking.openURL(activeUrl);
                                              }
                                            }}
                                          >
                                            <BookOpen size={16} color="#FFFFFF" />
                                            <Text style={theaterStyles.docOpenBtnText}>Open Document</Text>
                                          </Pressable>
                                        </View>
                                      </View>
                                    );
                                  }

                                  if (isTextOnlyContent || activeContent.contentType === 'text') {
                                    return (
                                      <ScrollView style={theaterStyles.textPlayerWrap} contentContainerStyle={{ padding: 16 }}>
                                        <View style={theaterStyles.textStageBadge}>
                                          <BookOpen size={13} color="#0D9488" />
                                          <Text style={theaterStyles.textStageBadgeText}>Reading & Study Material</Text>
                                        </View>
                                        <Text style={theaterStyles.textStageTitle}>{activeContent.title}</Text>
                                        <RichTextRenderer text={activeContent.textContent || ''} />
                                      </ScrollView>
                                    );
                                  }

                                  return (
                                    <View style={[theaterStyles.emptyPlayer, { backgroundColor: '#F8FAFC' }]}>
                                      <SvgXml xml={PENGUIN} width={72} height={72} />
                                      <Text style={[theaterStyles.emptyPlayerText, { marginTop: 12, color: '#1a1a2e', fontWeight: '700' }]}>
                                        {activeContent.title}
                                      </Text>
                                      <Text style={{ fontSize: 13, color: '#525C6B', marginTop: 4 }}>
                                        Interactive Learning Item
                                      </Text>
                                    </View>
                                  );
                                })()}

                                {/* Video Footer Info & Step Buttons */}
                                <View style={theaterStyles.videoCardFooter}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={theaterStyles.videoCardTitle}>{activeContent?.title}</Text>
                                    <View style={theaterStyles.videoMetaRow}>
                                      <View style={theaterStyles.subjectPill}>
                                        <Text style={theaterStyles.subjectPillText}>{activeContent?.subject || 'Lesson'}</Text>
                                      </View>
                                      <Text style={theaterStyles.metaDot}>•</Text>
                                      <Text style={theaterStyles.videoDurationText}>
                                        Lesson {activeContentIndex + 1} of {selectedClassroom.contents.length}
                                      </Text>
                                    </View>
                                  </View>
                                  <View style={theaterStyles.navBtnGroup}>
                                    <Pressable
                                      style={[theaterStyles.stepBtn, activeContentIndex === 0 && { opacity: 0.4 }]}
                                      disabled={activeContentIndex === 0}
                                      onPress={() => setActiveContentIndex((i) => Math.max(0, i - 1))}
                                    >
                                      <ChevronLeft size={16} color="#2D5DC9" />
                                      <Text style={theaterStyles.stepBtnText}>Prev</Text>
                                    </Pressable>
                                    <Pressable
                                      style={[theaterStyles.stepBtn, activeContentIndex >= selectedClassroom.contents.length - 1 && { opacity: 0.4 }]}
                                      disabled={activeContentIndex >= selectedClassroom.contents.length - 1}
                                      onPress={() => setActiveContentIndex((i) => Math.min(selectedClassroom.contents.length - 1, i + 1))}
                                    >
                                      <Text style={theaterStyles.stepBtnText}>Next</Text>
                                      <ChevronRight size={16} color="#2D5DC9" />
                                    </Pressable>
                                  </View>
                                </View>
                              </View>

                              {/* 2. Lesson Overview (if text content exists and not already displayed as full text-only lesson) */}
                              {activeContent?.textContent && !isTextOnlyContent ? (
                                <View style={[theaterStyles.panelCard, { marginBottom: 20 }]}>
                                  <Text style={theaterStyles.textContentTitle}>Lesson Overview</Text>
                                  <Text style={theaterStyles.textContentBody}>{activeContent.textContent}</Text>
                                </View>
                              ) : null}

                          {/* 3. Real Classroom Activities (Quizzes & Tasks) */}
                          {(selectedClassroom.quizzes.length > 0 || selectedClassroom.assignments.length > 0) && (
                            <View style={theaterStyles.panelCard}>
                              <View style={theaterStyles.panelHeader}>
                                <Text style={theaterStyles.panelHeaderTitle}>Class Activities</Text>
                                <View style={theaterStyles.panelTabs}>
                                  {selectedClassroom.quizzes.length > 0 && (
                                    <Pressable
                                      style={[theaterStyles.panelTab, activePanelTab === 'quiz' && theaterStyles.panelTabActive]}
                                      onPress={() => setActivePanelTab('quiz')}
                                    >
                                      <Trophy size={14} color={activePanelTab === 'quiz' ? '#FFFFFF' : '#525C6B'} />
                                      <Text style={[theaterStyles.panelTabText, activePanelTab === 'quiz' && theaterStyles.panelTabTextActive]}>
                                        Quizzes ({selectedClassroom.quizzes.length})
                                      </Text>
                                    </Pressable>
                                  )}
                                  {selectedClassroom.assignments.length > 0 && (
                                    <Pressable
                                      style={[theaterStyles.panelTab, activePanelTab === 'assignments' && theaterStyles.panelTabActive]}
                                      onPress={() => setActivePanelTab('assignments')}
                                    >
                                      <ClipboardList size={14} color={activePanelTab === 'assignments' ? '#FFFFFF' : '#525C6B'} />
                                      <Text style={[theaterStyles.panelTabText, activePanelTab === 'assignments' && theaterStyles.panelTabTextActive]}>
                                        Tasks ({selectedClassroom.assignments.length})
                                      </Text>
                                    </Pressable>
                                  )}
                                </View>
                              </View>

                              {activePanelTab === 'quiz' && selectedClassroom.quizzes.length > 0 && (
                                <View style={theaterStyles.quizBody}>
                                  {selectedClassroom.quizzes.map((quiz) => {
                                    const isDone = quiz.status === 'completed';
                                    return (
                                      <View key={quiz.id} style={theaterStyles.panelQuizCard}>
                                        <View style={theaterStyles.panelQuizIconBox}>
                                          <Trophy size={18} color="#D97706" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <Text style={theaterStyles.panelQuizTitle}>{quiz.title}</Text>
                                            <View style={[theaterStyles.quizLevelBadge, { backgroundColor: isDone ? '#D1FAE5' : '#FEF3C7' }]}>
                                              <Text style={[theaterStyles.quizLevelBadgeText, { color: isDone ? '#065F46' : '#92400E' }]}>
                                                {isDone ? 'COMPLETED' : (quiz.difficultyLevel ? quiz.difficultyLevel.toUpperCase() : 'STANDARD')}
                                              </Text>
                                            </View>
                                          </View>
                                          <Text style={theaterStyles.panelQuizSub}>
                                            {quiz.totalQuestions} questions • Test knowledge & earn XP
                                          </Text>
                                        </View>
                                        <Pressable
                                          style={[theaterStyles.panelQuizPlayBtn, isDone && { backgroundColor: '#059669' }]}
                                          onPress={() => setSelectedQuizId(quiz.id)}
                                        >
                                          <Play size={12} color="#fff" fill="#fff" />
                                          <Text style={theaterStyles.panelQuizPlayBtnText}>
                                            {isDone ? 'Replay Quiz' : 'Play Quiz'}
                                          </Text>
                                          <ChevronRight size={12} color="#fff" />
                                        </Pressable>
                                      </View>
                                    );
                                  })}
                                </View>
                              )}

                              {(activePanelTab === 'assignments' || selectedClassroom.quizzes.length === 0) && selectedClassroom.assignments.length > 0 && (
                                <View style={theaterStyles.tasksBody}>
                                  {selectedClassroom.assignments.map((assignment) => {
                                    const isSubmitted = assignment.status === 'submitted';
                                    return (
                                      <View key={assignment.id} style={theaterStyles.panelTaskCard}>
                                        <View style={{ flex: 1 }}>
                                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <Text style={theaterStyles.panelTaskTitle}>{assignment.title}</Text>
                                            <View
                                              style={[
                                                theaterStyles.panelTaskBadge,
                                                isSubmitted
                                                  ? { backgroundColor: '#D4EFE3' }
                                                  : { backgroundColor: '#FFE8DF' },
                                              ]}
                                            >
                                              <Text
                                                style={[
                                                  theaterStyles.panelTaskBadgeText,
                                                  isSubmitted ? { color: '#176B47' } : { color: '#D33F13' },
                                                ]}
                                              >
                                                {assignment.status.toUpperCase()}
                                              </Text>
                                            </View>
                                          </View>
                                          <Text style={theaterStyles.panelTaskDue}>
                                            Due: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date'}
                                          </Text>
                                        </View>
                                        <Pressable
                                          style={theaterStyles.panelTaskBtn}
                                          onPress={() => openAssignment(assignment)}
                                        >
                                          <Text style={theaterStyles.panelTaskBtnText}>
                                            {isSubmitted ? 'View Submission' : 'Submit Task'}
                                          </Text>
                                        </Pressable>
                                      </View>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                          )}
                        </View>

                        {/* RIGHT COLUMN: Upcoming Videos Sidebar */}
                        <View style={theaterStyles.rightCol}>
                          <View style={theaterStyles.sidebarCard}>
                            {/* Playlist Header */}
                            <View style={theaterStyles.sidebarHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={theaterStyles.playlistTitle}>Upcoming Videos</Text>
                                <Text style={theaterStyles.playlistCount}>
                                  {selectedClassroom.contents.length} video{selectedClassroom.contents.length !== 1 ? 's' : ''} in this class
                                </Text>
                              </View>
                              <View style={theaterStyles.progressPill}>
                                <Text style={theaterStyles.progressPillText}>{selectedClassroom.completionPct}%</Text>
                              </View>
                            </View>

                            {/* Upcoming Videos List */}
                            <View style={theaterStyles.playlistSection}>
                              <ScrollView style={theaterStyles.playlistScroll} showsVerticalScrollIndicator={false}>
                                {selectedClassroom.contents.length === 0 ? (
                                  <Text style={styles.emptyText}>No videos in this classroom.</Text>
                                ) : (
                                  selectedClassroom.contents.map((content, idx) => {
                                    const isCur = idx === activeContentIndex;

                                    return (
                                      <Pressable
                                        key={content.id || idx}
                                        style={[
                                          theaterStyles.videoItemCard,
                                          isCur && theaterStyles.videoItemCardActive,
                                        ]}
                                        onPress={() => setActiveContentIndex(idx)}
                                      >
                                        <View
                                          style={[
                                            theaterStyles.videoItemIconBox,
                                            isCur && theaterStyles.videoItemIconBoxActive,
                                          ]}
                                        >
                                          {isCur ? (
                                            <Pause size={14} color="#FFFFFF" fill="#FFFFFF" />
                                          ) : (
                                            <Play size={14} color="#2D5DC9" fill="#2D5DC9" />
                                          )}
                                        </View>

                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                          <Text
                                            style={[
                                              theaterStyles.videoItemTitle,
                                              isCur && theaterStyles.videoItemTitleActive,
                                            ]}
                                            numberOfLines={2}
                                          >
                                            {content.title}
                                          </Text>
                                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                            {isCur ? (
                                              <View style={theaterStyles.playingNowBadge}>
                                                <Text style={theaterStyles.playingNowText}>Playing Now</Text>
                                              </View>
                                            ) : (
                                              <Text style={theaterStyles.videoItemSub}>
                                                {content.subject || 'Video'}
                                              </Text>
                                            )}
                                          </View>
                                        </View>

                                        <View style={theaterStyles.videoItemRight}>
                                          <Text style={[theaterStyles.videoItemIndex, isCur && { color: '#2D5DC9', fontWeight: '800' }]}>
                                            #{idx + 1}
                                          </Text>
                                        </View>
                                      </Pressable>
                                    );
                                  })
                                )}
                              </ScrollView>
                            </View>

                            {/* Other Active Classrooms Switcher */}
                            {activeClassrooms.length > 1 && (
                              <View style={theaterStyles.otherClassesCard}>
                                <Text style={theaterStyles.otherClassesTitle}>Other Active Sessions</Text>
                                {activeClassrooms
                                  .filter((c) => c.id !== selectedClassroom.id)
                                  .slice(0, 3)
                                  .map((other) => (
                                    <Pressable
                                      key={other.id}
                                      style={theaterStyles.otherClassItem}
                                      onPress={() => {
                                        setSelectedClassroomId(other.id);
                                        setActiveContentIndex(0);
                                      }}
                                    >
                                      <View style={{ flex: 1 }}>
                                        <Text style={theaterStyles.otherClassName} numberOfLines={1}>
                                          {other.title}
                                        </Text>
                                        <Text style={theaterStyles.otherClassMeta}>
                                          {getStandardLabel(other.classLevel)} • {other.contents.length} videos
                                        </Text>
                                      </View>
                                      <ChevronRight size={14} color="#525C6B" />
                                    </Pressable>
                                  ))}
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })()
                ) : (
                      /* ── MOBILE / SINGLE COLUMN VIEW ── */
                      <>
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
                                const ytThumb = getYouTubeThumbnail(externalUrl || mediaUrl);
                                const previewImageUrl = isImageUrl(mediaUrl) ? mediaUrl : isImageUrl(externalUrl) ? externalUrl : (ytThumb || '');
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
                                      <View style={{ position: 'relative' }}>
                                        <Image source={{ uri: previewImageUrl }} style={styles.storyImage} resizeMode="cover" />
                                        {Boolean(ytThumb) && (
                                          <View style={styles.storyPlayBadge}>
                                            <Play size={11} color="#FFFFFF" fill="#FFFFFF" />
                                          </View>
                                        )}
                                      </View>
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
                                      <Trophy size={20} color="#D33F13" />
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
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── History Modal ── */}
      <Modal visible={isHistoryOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { setIsHistoryOpen(false); setHistorySelectedId(null); }}>
        <View style={clStyles.historyScreen}>
          <ModalHeader
            title={historySelectedId ? historySelected?.title ?? 'Class Details' : 'Previous Classes'}
            subtitle={historySelectedId ? 'Tap a quiz to play or replay' : 'Your completed classroom sessions'}
            onBack={() => { setIsHistoryOpen(false); setHistorySelectedId(null); }}
            right={
              historySelectedId ? (
                <Pressable onPress={() => setHistorySelectedId(null)} style={clStyles.historyBackToListBtn}>
                  <Text style={clStyles.historyBackToListText}>All Classes</Text>
                </Pressable>
              ) : undefined
            }
          />

          {historyLoading ? (
            <View style={clStyles.historyCenter}>
              <ActivityIndicator accessibilityLabel="Loading" size="large" color="#2D5DC9" />
              <Text style={{ color: '#525C6B', marginTop: 8 }}>Loading history…</Text>
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
                  const ICON_COLORS = ['#2D5DC9', '#4CAF50', '#D33F13', '#9B8EC4', '#E6A817'];
                  const ICON_COMPS  = [School, BookOpen, Layers, Trophy, Star];
                  const IconComp    = ICON_COMPS[idx % ICON_COMPS.length];
                  return (
                    <Pressable key={room.id} style={clStyles.historyCard} onPress={() => { setSelectedClassroomId(room.id); setActiveTab('content'); setIsHistoryOpen(false); setHistorySelectedId(null); }}>
                      <View style={[clStyles.historyCardIcon, { backgroundColor: BG_COLORS[idx % BG_COLORS.length] }]}>
                        <IconComp size={22} color={ICON_COLORS[idx % ICON_COLORS.length]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={clStyles.historyCardTitle} numberOfLines={1}>{room.title}</Text>
                        <Text style={clStyles.historyCardMeta}>{getStandardLabel(room.classLevel)}</Text>
                        <View style={clStyles.historyCardChips}>
                          <View style={clStyles.historyChip}>
                            <Trophy size={9} color="#3F5D8C" />
                            <Text style={clStyles.historyChipText}>{room.quizzes.length} quiz</Text>
                          </View>
                          <View style={clStyles.historyChip}>
                            <ClipboardList size={9} color="#3F5D8C" />
                            <Text style={clStyles.historyChipText}>{room.assignments.length} task</Text>
                          </View>
                          <View style={[clStyles.historyChip, { backgroundColor: '#D6F5D6' }]}>
                            <Text style={[clStyles.historyChipText, { color: '#1A6B1A' }]}>{room.completionPct}% done</Text>
                          </View>
                        </View>
                      </View>
                      <ChevronRight size={18} color="#525C6B" />
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
                  <Text style={[clStyles.historyStatVal, { color: '#2D5DC9' }]}>{historySelected.completionPct}%</Text>
                  <Text style={clStyles.historyStatLabel}>Done</Text>
                </View>
              </View>

              {/* Quizzes — with replay */}
              {historySelected.quizzes.length > 0 && (
                <View style={clStyles.historySection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Trophy size={16} color="#D33F13" />
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
                    <ClipboardList size={16} color="#2D5DC9" />
                    <Text style={clStyles.historySectionTitle}>Assignments</Text>
                  </View>
                  {historySelected.assignments.map((assignment) => (
                    <View key={assignment.id} style={clStyles.historyAssignCard}>
                      <Text style={clStyles.historyAssignTitle} numberOfLines={1}>{assignment.title}</Text>
                      <View style={[clStyles.historyChip, { backgroundColor: assignment.status === 'submitted' ? '#D6F5D6' : '#FFE8D6' }]}>
                        <Text style={[clStyles.historyChipText, { color: assignment.status === 'submitted' ? '#1A6B1A' : '#B23D00' }]}>
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
            links:       { label: 'Links',       IconComp: Link2,       accentColor: '#0284C7', bgColor: '#E0F2FE' },
            file_upload: { label: 'File Upload', IconComp: UploadCloud, accentColor: '#2D5DC9', bgColor: '#D6EAFF' },
            video:    { label: 'Video',    IconComp: VideoIcon,  accentColor: '#B03A19', bgColor: '#FFE8D6' },
            audio:    { label: 'Audio',    IconComp: Headphones, accentColor: '#554E6C', bgColor: '#EDE4FF' },
            image:    { label: 'Image',    IconComp: ImageIcon,  accentColor: '#2D5DC9', bgColor: '#D6EAFF' },
            text:     { label: 'Reading',  IconComp: BookOpen,   accentColor: '#2F6B2D', bgColor: '#D6F5D6' },
            youtube:  { label: 'YouTube',  IconComp: Play,       accentColor: '#B71C1C', bgColor: '#FFE8D6' },
            document: { label: 'Document', IconComp: FileText,   accentColor: '#2D5DC9', bgColor: '#D6EAFF' },
            link:     { label: 'Resource', IconComp: Link,       accentColor: '#8F680C', bgColor: '#FFF5CC' },
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
            if (s.contentType === 'links') return 'links';
            if (s.contentType === 'file_upload') return 'file_upload';
            if (s.contentType === 'text') return 'text';
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
          const typeCfg = TYPE_CONFIG[primaryType] ?? { label: 'Content', IconComp: BookOpen, accentColor: '#2D5DC9', bgColor: fallbackBg };

          return (
            <View style={styles.viewerContainer}>

              {/* ── Header ── */}
              <ModalHeader
                onBack={() => setPreviewContentIndex(null)}
                center={
                  <View style={styles.vHeaderMid}>
                    <View style={[styles.vTypeBadge, { backgroundColor: `${typeCfg.accentColor}18` }]}>
                      <Text style={[styles.vTypeBadgeText, { color: typeCfg.accentColor }]}>{typeCfg.label}</Text>
                    </View>
                    <Text style={styles.vHeaderTitle} numberOfLines={1}>{content?.title || 'Content'}</Text>
                  </View>
                }
                right={
                  <View style={[styles.vCounter, { backgroundColor: `${typeCfg.accentColor}15` }]}>
                    <Text style={[styles.vCounterTxt, { color: typeCfg.accentColor }]}>{curIdx + 1}/{contents.length}</Text>
                  </View>
                }
              />

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
                  const secKey = content?.id ? `${baseContentId(content.id)}:${idx + 1}` : '';
                  const sectioned = secKey ? sectionedMap[secKey] : null;

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

                      {sectioned ? (
                        <StudentVideoLearningView
                          contentId={baseContentId(content?.id || '')}
                          contentSectionOrder={idx + 1}
                          videoUrl={sectioned.url}
                          apiFetch={apiFetch}
                        />
                      ) : (
                      <>
                      {/* LINKS TYPE */}
                      {section.contentType === 'links' && (
                        <UniversalLinkPlayer url={url} title={(section as any).title || content?.title} />
                      )}

                      {/* FILE UPLOAD TYPE */}
                      {section.contentType === 'file_upload' && (
                        <UniversalFileViewer
                          mediaUrl={section.mediaUrl || url}
                          fileName={(section as any).title || content?.title}
                          textContent={section.textContent}
                        />
                      )}

                      {/* LEGACY IMAGE */}
                      {section.contentType !== 'links' && section.contentType !== 'file_upload' && url && isImageUrl(url) && (
                        <View style={styles.vImgWrap}>
                          <Image source={{ uri: url }} style={styles.vImg} resizeMode="cover" />
                        </View>
                      )}

                      {/* LEGACY YOUTUBE */}
                      {section.contentType !== 'links' && section.contentType !== 'file_upload' && url && isYouTubeUrl(url) && (() => {
                        const videoId = getYouTubeVideoId(url);
                        if (!videoId) return null;
                        return (
                          <View style={styles.vVideoWrap}>
                            <View style={[styles.vVideoFrame, { borderColor: `${sCfg.accentColor}30` }]}>
                              {Platform.OS === 'web' ? (
                                <iframe
                                  src={`https://www.youtube.com/embed/${videoId}?rel=0&controls=1`}
                                  style={{ width: '100%', height: '100%', border: 'none', borderRadius: 16 }}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              ) : (
                                <YoutubePlayer
                                  height={(Dimensions.get('window').width - 32) * (9 / 16)}
                                  videoId={videoId}
                                  webViewStyle={{ opacity: 0.99 }}
                                />
                              )}
                            </View>
                          </View>
                        );
                      })()}

                      {/* LEGACY AUDIO */}
                      {section.contentType !== 'links' && section.contentType !== 'file_upload' && url && url.match(/\.(mp3|wav|ogg|aac|m4a|flac)/i) && (
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

                      {/* LEGACY VIDEO (non-YouTube, non-audio) */}
                      {section.contentType !== 'links' && section.contentType !== 'file_upload' && url && !isImageUrl(url) && !isYouTubeUrl(url) && !url.match(/\.(mp3|wav|ogg|aac|m4a|flac)/i) && url.match(/\.(mp4|mov|webm|avi)/i) && (
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

                      {/* TEXT (RichTextRenderer) */}
                      {section.textContent && section.contentType !== 'file_upload' && section.contentType !== 'links' ? (
                        <View style={styles.vTextBlock}>
                          <RichTextRenderer text={section.textContent} />
                        </View>
                      ) : null}

                      {/* LEGACY DOCUMENT / EXTERNAL LINK */}
                      {section.contentType !== 'links' && section.contentType !== 'file_upload' && eUrl && !isYouTubeUrl(eUrl) && !isImageUrl(eUrl) && !url.match(/\.(mp4|mov|webm|mp3|wav|ogg|aac|m4a|flac)/i) ? (
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
                      </>
                      )}
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
          <ModalHeader
            tone="#fff"
            left={
              <Pressable onPress={() => setAssignmentModal(null)} style={aStyles.backBtn}>
                <X size={20} color="#1a1a2e" />
              </Pressable>
            }
            center={
              <View style={{ flex: 1 }}>
                <Text style={aStyles.headerLabel}>Assignment</Text>
                <Text style={aStyles.headerTitle} numberOfLines={1}>{assignmentModal?.title || 'Task'}</Text>
              </View>
            }
            right={
              assignmentModal?.status === 'submitted' ? (
                <View style={[aStyles.statusBadgeSubmitted, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                  <CheckCircle size={12} color="#1A6B1A" />
                  <Text style={aStyles.statusBadgeText}>Submitted</Text>
                </View>
              ) : assignmentModal?.status === 'overdue' ? (
                <View style={aStyles.statusBadgeOverdue}><Text style={aStyles.statusBadgeText}>⚠ Overdue</Text></View>
              ) : (
                <View style={aStyles.statusBadgePending}><Text style={aStyles.statusBadgeText}>📋 Pending</Text></View>
              )
            }
          />

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
                  <View style={aStyles.attachmentIcon}><Link size={18} color="#2D5DC9" /></View>
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
                  {!submissionAttachmentUrl && (
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
                  )}
                  <MediaUploader
                    accept="image/*,audio/*,video/*,application/pdf"
                    mediaType="document"
                    value={submissionAttachmentUrl || null}
                    fileName={submissionAttachmentUrl ? submissionAttachmentUrl.split('/').pop() : ''}
                    onUploadSuccess={(url) => setSubmissionAttachmentUrl(url)}
                    onClear={() => setSubmissionAttachmentUrl('')}
                    buttonLabel="Upload File"
                  />
                </View>
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Footer submit button */}
          {assignmentModal?.status !== 'submitted' && (
            <View style={[aStyles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Pressable style={aStyles.submitBtn} onPress={submitAssignment} disabled={savingSubmission}>
                {savingSubmission
                  ? <ActivityIndicator accessibilityLabel="Loading" color="#fff" />
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
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
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
    backgroundColor: '#2D5DC9',
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
    color: '#2D5DC9',
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
    color: '#2D5DC9',
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
    borderColor: '#2D5DC9',
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
    backgroundColor: '#D33F13',
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
  storyPlayBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
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
    backgroundColor: '#D33F13',
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
    color: '#4B5768',
    marginBottom: 16,
  },
  taskButton: {
    backgroundColor: '#EBF4FF',
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  taskButtonText: {
    color: '#2D5DC9',
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
    color: '#2D5DC9',
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
    shadowColor: '#2D5DC9',
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
    color: '#2D5DC9',
  },
  navButtonTextDisabled: {
    color: '#B5D4FF',
  },
  navButtonPrimary: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#2D5DC9',
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
    backgroundColor: '#2D5DC9',
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
    backgroundColor: '#2D5DC9',
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
    color: '#2D5DC9',
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
    color: '#4B5768',
    fontWeight: '500',
  },
  emptyText: {
    color: '#4E5D71',
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
  vVideoFrame: { width: '100%', aspectRatio: 16 / 9, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0a0a0a', borderWidth: 2 },

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
  vMoreCardMeta: { fontSize: 10, fontWeight: '500', color: '#525C6B' },
});

// ── Assignment full-screen modal styles ────────────────────────────────────────
const aStyles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#F5F7FF' },

  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#F5F7FF' },
  headerLabel: { fontSize: 10, fontWeight: '800', color: '#525C6B', textTransform: 'uppercase', letterSpacing: 0.8 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1a1a2e', marginTop: 1 },

  statusBadgeSubmitted: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#D6F5D6' },
  statusBadgeOverdue:   { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FFE8D6' },
  statusBadgePending:   { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EEF4FF' },
  statusBadgeText:      { fontSize: 11, fontWeight: '800', color: '#1a1a2e' },

  scrollContent: {
    padding: 16,
    gap: 16,
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },

  metaRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  metaChipEmoji: { fontSize: 13 },
  metaChipText:  { fontSize: 12, fontWeight: '700', color: '#5A6A8A' },

  section:       { gap: 8 },
  sectionLabel:  { fontSize: 11, fontWeight: '800', color: '#525C6B', textTransform: 'uppercase', letterSpacing: 0.8, paddingLeft: 2 },
  sectionCard:   { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 6, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  sectionText:   { fontSize: 14, color: '#1a1a2e', lineHeight: 22, fontWeight: '500' },
  sectionSubLabel:{ fontSize: 11, fontWeight: '800', color: '#525C6B', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  sectionDivider:{ height: 1, backgroundColor: '#F0F0F8', marginVertical: 6 },

  attachmentRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  attachmentIcon:   { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' },
  attachmentTitle:  { fontSize: 14, fontWeight: '800', color: '#1A4DA2' },
  attachmentUrl:    { fontSize: 11, color: '#525C6B', marginTop: 2 },
  attachmentArrow:  { fontSize: 22, color: '#525C6B', fontWeight: '300' },

  submittedCard:        { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  submittedBanner:      { backgroundColor: '#D6F5D6', padding: 16, gap: 3 },
  submittedBannerTitle: { fontSize: 16, fontWeight: '900', color: '#1A6B1A' },
  submittedBannerDate:  { fontSize: 12, fontWeight: '600', color: '#4CAF50' },
  submittedField:       { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F5F7FF', gap: 5 },
  submittedFieldLabel:  { fontSize: 11, fontWeight: '800', color: '#525C6B', textTransform: 'uppercase', letterSpacing: 0.5 },
  submittedFieldValue:  { fontSize: 14, color: '#1a1a2e', lineHeight: 22, fontWeight: '500' },
  submittedAttachLink:  { fontSize: 13, color: '#2D5DC9', fontWeight: '700' },

  fieldGroup:  { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 8, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  fieldLabel:  { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  fieldHint:   { fontSize: 12, color: '#525C6B', fontWeight: '500', lineHeight: 18, marginBottom: 2 },
  textArea:    { backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, padding: 14, minHeight: 120, fontSize: 14, color: '#1a1a2e', lineHeight: 22 },
  uploadRow:   { gap: 8 },
  urlInput:    { flex: 1, height: 44, fontSize: 13, color: '#1a1a2e', fontWeight: '500', backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 14 },
  uploadBtn:   { borderRadius: 10, borderWidth: 1, borderColor: '#D6EAFF', backgroundColor: '#F5F9FF', paddingVertical: 12, alignItems: 'center', borderStyle: 'dashed', marginTop: 10 },
  uploadBtnText: { fontSize: 13, fontWeight: '700', color: '#2D5DC9' },
  mediaPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  badge: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8F9FF', borderRadius: 12, borderWidth: 1, borderColor: '#ECEEF4', padding: 10 },
  badgeInfo: { flex: 1, gap: 4 },
  badgeTitle: { fontSize: 13, fontWeight: '600', color: '#374151' },
  badgeSubtitle: { fontSize: 11, color: '#525C6B' },
  mediaRemoveBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFE8E8', justifyContent: 'center', alignItems: 'center' },
  mediaRemoveBtnText: { fontSize: 12, fontWeight: '800', color: '#DC2626' },

  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F8',
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  submitBtn:     { backgroundColor: '#2D5DC9', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
});

// ── Classroom list + history styles ───────────────────────────────────────────
const clStyles = StyleSheet.create({
  // Header additions
  historyBtnSmall:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, borderWidth: 1.5, borderColor: '#D0D8F0', paddingHorizontal: 10, paddingVertical: 6 },
  historyBtnSmallText: { fontSize: 11, fontWeight: '700', color: '#5A6A8A' },

  historyLinkBtn:  { marginTop: 12, borderRadius: 12, backgroundColor: '#EBF4FF', paddingHorizontal: 16, paddingVertical: 10 },
  historyLinkText: { fontSize: 13, fontWeight: '800', color: '#1A4DA2' },

  // Redesigned My Classes Header
  myClassesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 12,
  },
  myClassesTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: -0.3,
  },
  myClassesSub: {
    fontSize: 13,
    color: '#525C6B',
    fontWeight: '500',
    marginTop: 4,
  },
  historyBtnModern: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  historyBtnModernText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D5DC9',
  },

  // Active classroom list & grid
  listSection: {
    paddingBottom: 24,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  modernClassCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 20,
    width: '100%',
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  modernClassCardDesktop: {
    flexBasis: '48%',
    maxWidth: '49%',
    minWidth: 280,
    flexGrow: 1,
  },
  classCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  classCardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classCardBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  classLevelBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6E8FF',
  },
  classLevelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D5DC9',
  },
  classLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F8F0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  classLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#176B47',
  },
  classLiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#176B47',
  },
  classCardMain: {
    marginBottom: 14,
  },
  classCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1a1a2e',
    lineHeight: 24,
    marginBottom: 4,
  },
  classCardSub: {
    fontSize: 12,
    color: '#525C6B',
    fontWeight: '500',
  },
  classCardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  classCardTimeText: {
    fontSize: 12,
    color: '#525C6B',
    fontWeight: '600',
  },
  classMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  classMetricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  classMetricPillDue: {
    backgroundColor: '#FFF2EA',
    borderColor: '#FFD9C6',
  },
  classMetricPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#525C6B',
  },
  classProgressSection: {
    marginBottom: 16,
  },
  classProgressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  classProgressLabel: {
    fontSize: 11,
    color: '#525C6B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  classProgressVal: {
    fontSize: 12,
    color: '#2D5DC9',
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#EEF2F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2D5DC9',
    borderRadius: 3,
  },
  classCardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F4FF',
  },
  classCardActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D5DC9',
  },

  backToList:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, marginBottom: 6 },
  backToListText: { fontSize: 13, fontWeight: '700', color: '#2D5DC9' },
  notStartedCard: {
    backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 28,
    alignItems: 'center', marginHorizontal: 4, marginTop: 8, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E9F2',
  },
  notStartedIconBox: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#EBF4FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  notStartedTitle:    { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  notStartedSubtitle: { fontSize: 13, color: '#3F5D8C', textAlign: 'center', marginTop: 4 },
  countdownRow:       { flexDirection: 'row', gap: 8, marginVertical: 20 },
  countdownUnit: {
    minWidth: 60, paddingVertical: 10, paddingHorizontal: 6,
    backgroundColor: '#F4F8FE', borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#DCE7F5',
  },
  countdownVal:   { fontSize: 22, fontWeight: '900', color: '#1A4DA2', fontVariant: ['tabular-nums'] },
  countdownLabel: { fontSize: 10, fontWeight: '700', color: '#3F5D8C', textTransform: 'uppercase', marginTop: 2, letterSpacing: 0.6 },
  scheduledMetaRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  scheduledMetaText:  { fontSize: 12, color: '#3F5D8C', fontWeight: '600' },
  notStartedHint:     { fontSize: 12, color: '#525C6B', textAlign: 'center', marginTop: 14, paddingHorizontal: 12 },

  // History full-screen modal
  historyScreen:    { flex: 1, backgroundColor: '#F5F7FF' },
  historyHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  historyBackBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F7FF', alignItems: 'center', justifyContent: 'center' },
  historyBackArrow: { fontSize: 28, color: '#1a1a2e', fontWeight: '300', lineHeight: 34 },
  historyTitle:     { fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  historySubtitle:  { fontSize: 11, color: '#525C6B', fontWeight: '500', marginTop: 1 },
  historyBackToListBtn: { borderRadius: 10, backgroundColor: '#EBF4FF', paddingHorizontal: 12, paddingVertical: 6 },
  historyBackToListText:{ fontSize: 12, fontWeight: '700', color: '#1A4DA2' },

  historyCenter:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 60 },
  historyEmptyTitle:{ fontSize: 18, fontWeight: '900', color: '#1a1a2e' },
  historyEmptySub:  { fontSize: 13, color: '#525C6B', textAlign: 'center' },
  historyList: {
    padding: 16,
    gap: 10,
    paddingBottom: 40,
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },

  historyCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 18, padding: 14, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  historyCardIcon:  { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  historyCardTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  historyCardMeta:  { fontSize: 12, color: '#525C6B', fontWeight: '500', marginTop: 1 },
  historyCardChips: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  historyChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#F0F4FF' },
  historyChipText:  { fontSize: 10, fontWeight: '700', color: '#3F5D8C' },

  // History single classroom detail
  historyDetail: {
    padding: 16,
    paddingBottom: 48,
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  historyStatsRow:  { flexDirection: 'row', gap: 10, marginBottom: 16 },
  historyStat:      { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 3, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  historyStatVal:   { fontSize: 22, fontWeight: '900', color: '#1a1a2e' },
  historyStatLabel: { fontSize: 10, fontWeight: '700', color: '#525C6B', textTransform: 'uppercase' },

  historySection:      { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  historySectionTitle: { fontSize: 14, fontWeight: '900', color: '#1a1a2e' },

  historyQuizCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  historyQuizInfo:  { flex: 1 },
  historyQuizTitle: { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  historyQuizMeta:  { fontSize: 11, color: '#525C6B', fontWeight: '500', marginTop: 2 },
  historyScoreBadge:{ marginTop: 4, backgroundColor: '#FFF5CC', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  // Darkened from #E6A817 (1.92:1 on the #FFF5CC badge bg) to clear WCAG AA.
  historyScoreText: { fontSize: 11, fontWeight: '800', color: '#8F680C' },

  replayBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2D5DC9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  replayBtnText:  { fontSize: 12, fontWeight: '800', color: '#fff' },

  pageBtn:      { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#EEF4FF', borderRadius: 8 },
  pageBtnText:  { fontSize: 13, fontWeight: '700', color: '#2D5DC9' },
  pageText:     { fontSize: 13, fontWeight: '600', color: '#525C6B' },


  historyAssignCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  historyAssignTitle:{ fontSize: 13, fontWeight: '700', color: '#1a1a2e', flex: 1, marginRight: 8 },
});

const theaterStyles = StyleSheet.create({
  classroomHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    marginBottom: 16,
    gap: 8,
    flexWrap: 'wrap',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D5DC9',
  },
  classTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerClassTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  standardBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D6E8FF',
  },
  standardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D5DC9',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  leftCol: {
    flex: 1,
    minWidth: 0,
  },
  rightCol: {
    width: 350,
    minWidth: 280,
    maxWidth: 400,
  },
  videoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  videoTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4FF',
  },
  videoTopBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 12,
  },
  videoTopBarTitle: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  videoTopBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoTypeBadge: {
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  videoTypeBadgeText: {
    color: '#2D5DC9',
    fontSize: 11,
    fontWeight: '700',
  },
  fullscreenBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayerWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#0B0F19',
    overflow: 'hidden',
  },
  audioPlayerWrap: {
    width: '100%',
    backgroundColor: '#FAF5FF',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
  },
  imagePlayerWrap: {
    width: '100%',
    minHeight: 280,
    maxHeight: 520,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stageImage: {
    width: '100%',
    height: 480,
  },
  docPlayerWrap: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
  },
  docCardInner: {
    alignItems: 'center',
    maxWidth: 440,
  },
  docIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  docTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  docSubtitleText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  docOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  docOpenBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  textPlayerWrap: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    padding: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
  },
  textStageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  textStageBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
  },
  textStageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  textStageContent: {
    fontSize: 15,
    lineHeight: 24,
    color: '#334155',
  },
  webVideoFrame: {
    width: '100%',
    height: '100%',
  },
  emptyPlayer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0B0F19',
  },
  emptyPlayerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  videoCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  videoCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  videoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectPill: {
    backgroundColor: '#D6E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  subjectPillText: {
    color: '#2D5DC9',
    fontSize: 11,
    fontWeight: '700',
  },
  metaDot: {
    color: '#94A3B8',
    fontSize: 12,
  },
  videoDurationText: {
    fontSize: 12,
    color: '#525C6B',
    fontWeight: '600',
  },
  navBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F0F4FF',
  },
  stepBtnText: {
    color: '#2D5DC9',
    fontSize: 12,
    fontWeight: '700',
  },
  panelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 18,
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  panelHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  panelTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  panelTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
  },
  panelTabActive: {
    backgroundColor: '#2D5DC9',
  },
  panelTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#525C6B',
  },
  panelTabTextActive: {
    color: '#FFFFFF',
  },
  textContentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  textContentBody: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
  quizBody: {
    gap: 10,
  },
  panelQuizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  panelQuizIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFE8DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelQuizTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  panelQuizSub: {
    fontSize: 12,
    color: '#525C6B',
    marginTop: 2,
  },
  quizLevelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quizLevelBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  panelQuizPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2D5DC9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  panelQuizPlayBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tasksBody: {
    gap: 10,
  },
  panelTaskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  panelTaskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  panelTaskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  panelTaskBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  panelTaskDue: {
    fontSize: 11,
    color: '#525C6B',
  },
  panelTaskBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2D5DC9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  panelTaskBtnText: {
    color: '#2D5DC9',
    fontSize: 12,
    fontWeight: '700',
  },
  sidebarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 18,
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  progressPill: {
    backgroundColor: '#D4EFE3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  progressPillText: {
    color: '#176B47',
    fontSize: 12,
    fontWeight: '800',
  },
  playlistSection: {
    gap: 8,
  },
  playlistTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  playlistCount: {
    fontSize: 12,
    color: '#525C6B',
    fontWeight: '500',
    marginTop: 2,
  },
  playlistScroll: {
    maxHeight: 480,
  },
  videoItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    marginBottom: 8,
  },
  videoItemCardActive: {
    backgroundColor: '#F0F5FF',
    borderColor: '#2D5DC9',
    borderWidth: 1.5,
  },
  videoItemIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoItemIconBoxActive: {
    backgroundColor: '#2D5DC9',
  },
  videoItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a2e',
    lineHeight: 18,
  },
  videoItemTitleActive: {
    color: '#2D5DC9',
    fontWeight: '800',
  },
  videoItemSub: {
    fontSize: 11,
    color: '#525C6B',
  },
  playingNowBadge: {
    backgroundColor: '#D6E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  playingNowText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2D5DC9',
  },
  videoItemRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoItemIndex: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  otherClassesCard: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F4FF',
  },
  otherClassesTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7A7A9A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  otherClassItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  otherClassName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  otherClassMeta: {
    fontSize: 11,
    color: '#525C6B',
    marginTop: 2,
  },
});
