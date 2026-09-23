import { useEffect, useMemo, useRef, useState } from 'react';
import LatexText from '../common/LatexText';
import { ChatMarkdown } from '../chat/ChatMarkdown';
import { Dimensions, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { ChevronLeft, ChevronRight, BookOpen, Play, Pause, Film, Headphones, Image as ImageIcon, FileText, Layers, X, Trophy, Sparkles } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import * as Linking from 'expo-linking';
import YoutubePlayer from 'react-native-youtube-iframe';

import QuizRenderer from '../quiz/QuizRenderer';
import PlayQuizCTA from '../quiz/PlayQuizCTA';
import AudioPlayer from '../media/AudioPlayer';
import DocumentViewer from '../media/DocumentViewer';
import StudentVideoLearningView from '../student/StudentVideoLearningView';
import { createVideoSectionsApi } from '../../api/videoSections';
import { API_BASE_URL, useAuth } from '../../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type StudentContentItem = {
  id: string;
  title: string;
  contentType: string;
  mediaUrl?: string;
  externalUrl?: string;
  textContent?: string;
  quizId?: string | null;
  sortOrder?: number;
};

export type StudentTopicMeta = {
  id: string;
  classLevel: string;
  subject: string;
  title: string;
};

type LucideIcon = React.ComponentType<{ size?: number; color?: string; fill?: string }>;

type Props = {
  visible: boolean;
  contents: StudentContentItem[];
  startIdx: number;
  topic: StudentTopicMeta;
  onClose: () => void;
};

type TypeCfg = { label: string; Icon: LucideIcon; accent: string; bg: string };
const TYPE_CONFIG: Record<string, TypeCfg> = {
  video: { label: 'YouTube Video', Icon: Play, accent: '#B71C1C', bg: '#FFE8D6' },
  youtube_url: { label: 'YouTube Video', Icon: Play, accent: '#B71C1C', bg: '#FFE8D6' },
  reel_url: { label: 'Reel', Icon: Film, accent: '#A81762', bg: '#FFE0F0' },
  reel: { label: 'Reel', Icon: Film, accent: '#A81762', bg: '#FFE0F0' },
  audio: { label: 'Audio', Icon: Headphones, accent: '#554E6C', bg: '#EDE4FF' },
  image: { label: 'Image / Video', Icon: ImageIcon, accent: '#2D5DC9', bg: '#D6EAFF' },
  text: { label: 'Reading', Icon: BookOpen, accent: '#2F6B2D', bg: '#D6F5D6' },
  document: { label: 'Document', Icon: FileText, accent: '#2D5DC9', bg: '#D6EAFF' },
};
const DEFAULT_TYPE: TypeCfg = { label: 'Content', Icon: Layers, accent: '#2D5DC9', bg: '#D6EAFF' };
const typeCfg = (type: string): TypeCfg => TYPE_CONFIG[type] ?? DEFAULT_TYPE;

const resolveMediaUrl = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('/assets') || url.startsWith('./assets') || url.startsWith('assets/')) {
    const cleanUrl = url.startsWith('./') ? url.slice(1) : url.startsWith('assets/') ? `/${url}` : url;
    const frontendBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${frontendBaseUrl}${cleanUrl}`;
  }
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
};

const baseContentId = (id: string): string => String(id).split(':')[0];
const sectionOrderFromId = (id: string): number | undefined => {
  const parts = String(id).split(':');
  if (parts.length < 2) return undefined;
  const n = Number(parts[1]);
  return Number.isFinite(n) ? n : undefined;
};

const isYouTubeUrl = (url: string): boolean => /(?:youtube\.com|youtu\.be)/i.test(url);
const isImageUrl = (url: string): boolean => /\.(png|jpe?g|gif|webp|bmp|svg)(?:$|[?#])/i.test(url);
const isAudioUrl = (url: string): boolean => /\.(mp3|wav|ogg|aac|m4a|flac)(?:$|[?#])/i.test(url);
const isVideoUrl = (url: string): boolean => /\.(mp4|mov|m4v|webm|avi|mkv)(?:$|[?#])/i.test(url);
const isDocumentUrl = (url: string): boolean => /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)(?:$|[?#])/i.test(url);

const getYouTubeVideoId = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const getYouTubeThumbUrl = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
};

const openExternalResource = (url: string) => {
  if (!url) return;
  if (Platform.OS === 'web' && typeof globalThis.open === 'function') {
    globalThis.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL(url);
};

export default function StudentContentViewer({ visible, contents, startIdx, topic, onClose }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const isLargeScreen = windowWidth >= 900;
  const insets = useSafeAreaInsets();
  const { apiFetch } = useAuth();
  const api = useMemo(() => createVideoSectionsApi(apiFetch), [apiFetch]);

  const [curIdx, setCurIdx] = useState(startIdx);
  const [quizModalQuizId, setQuizModalQuizId] = useState<string | null>(null);
  const [hasSections, setHasSections] = useState<Record<string, boolean>>({});

  const PLAYLIST_PAGE_SIZE = 10;
  const [playlistPage, setPlaylistPage] = useState(() => Math.floor(startIdx / PLAYLIST_PAGE_SIZE));
  const totalPlaylistPages = Math.ceil(contents.length / PLAYLIST_PAGE_SIZE);
  const pagedPlaylist = contents.slice(playlistPage * PLAYLIST_PAGE_SIZE, (playlistPage + 1) * PLAYLIST_PAGE_SIZE);

  useEffect(() => {
    setCurIdx(Math.max(0, Math.min(startIdx, contents.length - 1)));
  }, [startIdx, visible, contents.length]);

  useEffect(() => {
    setPlaylistPage(Math.floor(curIdx / PLAYLIST_PAGE_SIZE));
  }, [curIdx]);

  const content = contents[curIdx];
  const hasPrev = curIdx > 0;
  const hasNext = curIdx < contents.length - 1;

  const goTo = (idx: number) => {
    if (idx >= 0 && idx < contents.length) {
      setCurIdx(idx);
    }
  };

  // Detect sectioned video
  useEffect(() => {
    const c = contents[curIdx];
    if (!c) return undefined;
    const u = resolveMediaUrl(c.externalUrl ?? c.mediaUrl);
    const videoish =
      ['youtube_url', 'video', 'reel_url', 'reel'].includes(c.contentType) ||
      (!!u && (isYouTubeUrl(u) || isVideoUrl(u)));
    if (!videoish) return undefined;
    const baseId = baseContentId(c.id);
    const order = sectionOrderFromId(c.id);
    let cancelled = false;
    api
      .list(baseId, order)
      .then((rows) => {
        if (!cancelled) setHasSections((m) => ({ ...m, [c.id]: rows.length > 0 }));
      })
      .catch(() => {
        if (!cancelled) setHasSections((m) => ({ ...m, [c.id]: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [contents, curIdx, api]);

  if (!content) return null;

  const cfg = typeCfg(content.contentType);
  const url = resolveMediaUrl(content.externalUrl ?? content.mediaUrl);
  const isSectioned = !!hasSections[content.id];

  const isVideo =
    ['youtube_url', 'video', 'reel_url', 'reel'].includes(content.contentType) ||
    (!!url && (isYouTubeUrl(url) || isVideoUrl(url)));
  const isAudio =
    content.contentType === 'audio' ||
    (!!url && isAudioUrl(url) && !isVideo);
  const isImage =
    (content.contentType === 'image' || (!!url && isImageUrl(url))) && !isVideo && !isAudio && !isDocumentUrl(url);
  const isDoc =
    (content.contentType === 'document' || (!!url && isDocumentUrl(url))) && !isVideo && !isAudio;
  const isReading =
    !isVideo && !isAudio && !isImage && !isDoc && (content.contentType === 'text' || !!content.textContent);

  const renderPlayer = (isTheater: boolean) => {
    if (isSectioned && url) {
      return (
        <StudentVideoLearningView
          contentId={baseContentId(content.id)}
          contentSectionOrder={sectionOrderFromId(content.id)}
          videoUrl={url}
          apiFetch={apiFetch}
        />
      );
    }

    if (isVideo && url) {
      const videoId = getYouTubeVideoId(url);
      if (videoId) {
        return Platform.OS === 'web' ? (
          <View style={s.webVideoFrame}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0&controls=1`}
              style={{ width: '100%', height: '100%', border: 'none' } as any}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </View>
        ) : (
          <YoutubePlayer
            height={isTheater ? 420 : (Dimensions.get('window').width - 32) * (9 / 16)}
            videoId={videoId}
            webViewStyle={{ opacity: 0.99 }}
          />
        );
      }
      return Platform.OS === 'web' ? (
        <video src={url} controls style={{ width: '100%', height: '100%', borderRadius: 0 }} />
      ) : (
        <Video source={{ uri: url }} useNativeControls resizeMode={ResizeMode.CONTAIN} style={{ width: '100%', height: '100%' }} />
      );
    }

    if (isAudio && url) {
      return (
        <View style={s.audioStageContainer}>
          <AudioPlayer uri={url} title={content.title} subtitle={topic.subject} accentColor="#2D5DC9" bgColor="#EDE4FF" />
        </View>
      );
    }

    if (isImage && url) {
      return (
        <View style={s.imageStageFrame}>
          <Image source={{ uri: url }} style={s.imageStageImg} resizeMode="contain" />
        </View>
      );
    }

    if (isDoc && url) {
      return (
        <View style={s.docStageContainer}>
          <DocumentViewer uri={url} title={content.title} accentColor="#2D5DC9" bgColor="#D6EAFF" />
        </View>
      );
    }

    if (isReading) {
      return (
        <View style={s.readingStageBody}>
          <View style={[s.readingBadge, { backgroundColor: `${cfg.accent}15` }]}>
            <BookOpen size={14} color={cfg.accent} />
            <Text style={[s.readingBadgeText, { color: cfg.accent }]}>Reading Lesson</Text>
          </View>
          <ChatMarkdown content={content.textContent || ''} isUser={false} />
        </View>
      );
    }

    if (url) {
      return (
        <View style={s.emptyPlayer}>
          <Pressable style={s.openBtn} onPress={() => openExternalResource(url)}>
            <Text style={s.openBtnText}>Open Resource Link</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={s.emptyPlayer}>
        <Text style={s.emptyPlayerText}>{content.title}</Text>
      </View>
    );
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <View style={s.screen}>
          {/* Top Bar */}
          <View style={[s.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
            <View style={s.topBarInner}>
              <Pressable onPress={onClose} style={s.backBtn} accessibilityLabel="Back">
                <ChevronLeft size={20} color="#1a1a2e" />
                <Text style={s.backBtnText}>Back to Lessons</Text>
              </Pressable>

              <View style={s.topBarMid}>
                <View style={[s.typeBadge, { backgroundColor: `${cfg.accent}15` }]}>
                  <cfg.Icon size={12} color={cfg.accent} />
                  <Text style={[s.typeBadgeText, { color: cfg.accent }]}>{cfg.label}</Text>
                </View>
                <LatexText content={content.title} style={s.headerTitle} compact compactHeight={22} numberOfLines={1} background="transparent" />
              </View>

              <View style={s.counterBadge}>
                <Text style={s.counterText}>{curIdx + 1} / {contents.length}</Text>
              </View>
            </View>
          </View>

          {/* Main Content Area */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContainer}
          >
            <View style={s.bodyConstrained}>
              {isLargeScreen ? (
                /* ── 2-COLUMN THEATRE LAYOUT FOR DESKTOP (≥ 900px) ── */
                <View style={s.theatreLayout}>
                  {/* Left Column: Video Stage & Interactive Activities */}
                  <View style={s.theatreLeftCol}>
                    <View style={s.stageCard}>
                      {/* Video Stage Top Bar */}
                      <View style={s.stageTopBar}>
                        <View style={s.stageTopBarLeft}>
                          <cfg.Icon size={16} color={cfg.accent} />
                          <Text style={s.stageTopBarTitle} numberOfLines={1}>
                            {content.title}
                          </Text>
                        </View>
                        <View style={s.stageTopBarRight}>
                          <View style={s.subjectPill}>
                            <Text style={s.subjectPillText}>{topic.subject}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Video / Media Player Display Area */}
                      <View
                        style={[
                          isVideo && s.stagePlayerWrapVideo,
                          isAudio && s.stagePlayerWrapAudio,
                          isImage && s.stagePlayerWrapImage,
                          isDoc && s.stagePlayerWrapDoc,
                          isReading && s.stagePlayerWrapText,
                          !isVideo && !isAudio && !isImage && !isDoc && !isReading && s.stagePlayerWrapFallback,
                        ]}
                      >
                        {renderPlayer(true)}
                      </View>

                      {/* Stage Card Footer: Title, Meta, and Prev/Next */}
                      <View style={s.stageFooter}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={s.stageFooterTitle}>{content.title}</Text>
                          <Text style={s.stageFooterMeta}>
                            {topic.title} · Class {topic.classLevel} • Lesson {curIdx + 1} of {contents.length}
                          </Text>
                        </View>
                        <View style={s.stepBtnGroup}>
                          <Pressable
                            style={[s.stepBtn, !hasPrev && { opacity: 0.35 }]}
                            disabled={!hasPrev}
                            onPress={() => goTo(curIdx - 1)}
                          >
                            <ChevronLeft size={16} color="#2D5DC9" />
                            <Text style={s.stepBtnText}>Prev</Text>
                          </Pressable>
                          <Pressable
                            style={[s.stepBtn, !hasNext && { opacity: 0.35 }]}
                            disabled={!hasNext}
                            onPress={() => goTo(curIdx + 1)}
                          >
                            <Text style={s.stepBtnText}>Next</Text>
                            <ChevronRight size={16} color="#2D5DC9" />
                          </Pressable>
                        </View>
                      </View>
                    </View>

                    {/* Lesson Notes Overview (only for media that has text notes and is not a pure reading lesson) */}
                    {content.textContent && !isReading ? (
                      <View style={s.notesCard}>
                        <Text style={s.notesCardTitle}>Lesson Overview & Notes</Text>
                        <ChatMarkdown content={content.textContent} isUser={false} />
                      </View>
                    ) : null}

                    {/* Play Quiz Section for Large Devices */}
                    {content.quizId && !isSectioned ? (
                      <View style={s.desktopQuizSection}>
                        <View style={s.desktopQuizCard}>
                          <View style={s.desktopQuizLeft}>
                            <View style={s.desktopQuizIconBox}>
                              <Trophy size={26} color="#D97706" />
                            </View>
                            <View style={s.desktopQuizInfo}>
                              <View style={s.desktopQuizBadgeRow}>
                                <View style={s.desktopQuizBadge}>
                                  <Sparkles size={12} color="#7C3AED" />
                                  <Text style={s.desktopQuizBadgeText}>Interactive Quiz</Text>
                                </View>
                                <View style={s.desktopQuizXpBadge}>
                                  <Text style={s.desktopQuizXpBadgeText}>⭐ Earn XP</Text>
                                </View>
                              </View>
                              <Text style={s.desktopQuizTitle}>Ready to Test Your Knowledge?</Text>
                              <Text style={s.desktopQuizSub} numberOfLines={2}>
                                Play the quiz for "{content.title}" to practice and level up!
                              </Text>
                            </View>
                          </View>
                          <Pressable
                            style={({ pressed }) => [
                              s.desktopQuizPlayBtn,
                              pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
                            ]}
                            onPress={() => setQuizModalQuizId(content.quizId!)}
                          >
                            <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                            <Text style={s.desktopQuizPlayBtnText}>Play Quiz</Text>
                            <ChevronRight size={16} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Right Column: Topic Lessons Playlist Sidebar */}
                  <View style={s.theatreRightCol}>
                    <View style={s.sidebarCard}>
                      <View style={s.sidebarHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.sidebarTitle}>Topic Lessons</Text>
                          <Text style={s.sidebarSub}>{contents.length} lessons in this topic</Text>
                        </View>
                        <View style={s.sidebarCountPill}>
                          <Text style={s.sidebarCountPillText}>
                            {curIdx + 1}/{contents.length}
                          </Text>
                        </View>
                      </View>

                      <View style={s.playlistList}>
                        {pagedPlaylist.map((item, index) => {
                          const globalIdx = playlistPage * PLAYLIST_PAGE_SIZE + index;
                          const isCur = globalIdx === curIdx;
                          const itemCfg = typeCfg(item.contentType);
                          const itemMedia = resolveMediaUrl(item.externalUrl ?? item.mediaUrl);
                          const yt = itemMedia ? getYouTubeThumbUrl(itemMedia) : null;

                          return (
                            <Pressable
                              key={item.id || globalIdx}
                              style={[
                                s.playlistItem,
                                isCur && s.playlistItemActive,
                              ]}
                              onPress={() => goTo(globalIdx)}
                            >
                              <View style={[s.playlistIconBox, isCur && s.playlistIconBoxActive]}>
                                {yt ? (
                                  <Image source={{ uri: yt }} style={s.playlistThumb} resizeMode="cover" />
                                ) : isCur ? (
                                  <Pause size={14} color="#FFFFFF" fill="#FFFFFF" />
                                ) : (
                                  <Play size={14} color={itemCfg.accent} fill={itemCfg.accent} />
                                )}
                              </View>

                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text
                                  style={[s.playlistItemTitle, isCur && s.playlistItemTitleActive]}
                                  numberOfLines={2}
                                >
                                  {item.title}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                  {isCur ? (
                                    <View style={s.playingBadge}>
                                      <Text style={s.playingBadgeText}>Playing Now</Text>
                                    </View>
                                  ) : (
                                    <Text style={s.playlistItemMeta}>{itemCfg.label}</Text>
                                  )}
                                </View>
                              </View>

                              <Text style={[s.playlistIndexText, isCur && { color: '#2D5DC9', fontWeight: '800' }]}>
                                #{globalIdx + 1}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {totalPlaylistPages > 1 && (
                        <View style={s.playlistPaginationRow}>
                          <Pressable
                            style={[s.playlistPageBtn, playlistPage === 0 && s.playlistPageBtnDisabled]}
                            disabled={playlistPage === 0}
                            onPress={() => setPlaylistPage((p) => Math.max(0, p - 1))}
                          >
                            <ChevronLeft size={14} color={playlistPage === 0 ? '#94A3B8' : '#2D5DC9'} />
                            <Text style={[s.playlistPageBtnText, playlistPage === 0 && s.playlistPageBtnTextDisabled]}>
                              Prev
                            </Text>
                          </Pressable>
                          <Text style={s.playlistPageText}>
                            Page {playlistPage + 1} of {totalPlaylistPages}
                          </Text>
                          <Pressable
                            style={[s.playlistPageBtn, playlistPage >= totalPlaylistPages - 1 && s.playlistPageBtnDisabled]}
                            disabled={playlistPage >= totalPlaylistPages - 1}
                            onPress={() => setPlaylistPage((p) => Math.min(totalPlaylistPages - 1, p + 1))}
                          >
                            <Text style={[s.playlistPageBtnText, playlistPage >= totalPlaylistPages - 1 && s.playlistPageBtnDisabled]}>
                              Next
                            </Text>
                            <ChevronRight size={14} color={playlistPage >= totalPlaylistPages - 1 ? '#94A3B8' : '#2D5DC9'} />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ) : (
                /* ── MOBILE / TABLET SINGLE COLUMN STACK (< 900px) ── */
                <View style={s.mobileLayout}>
                  <View style={s.stageCard}>
                    <View
                      style={[
                        isVideo && s.stagePlayerWrapVideo,
                        isAudio && s.stagePlayerWrapAudio,
                        isImage && s.stagePlayerWrapImage,
                        isDoc && s.stagePlayerWrapDoc,
                        isReading && s.stagePlayerWrapText,
                        !isVideo && !isAudio && !isImage && !isDoc && !isReading && s.stagePlayerWrapFallback,
                      ]}
                    >
                      {renderPlayer(false)}
                    </View>
                    <View style={s.stageFooter}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={s.stageFooterTitle}>{content.title}</Text>
                        <Text style={s.stageFooterMeta}>
                          {topic.subject} · Lesson {curIdx + 1} of {contents.length}
                        </Text>
                      </View>
                      <View style={s.stepBtnGroup}>
                        <Pressable
                          style={[s.stepBtn, !hasPrev && { opacity: 0.35 }]}
                          disabled={!hasPrev}
                          onPress={() => goTo(curIdx - 1)}
                        >
                          <ChevronLeft size={16} color="#2D5DC9" />
                          <Text style={s.stepBtnText}>Prev</Text>
                        </Pressable>
                        <Pressable
                          style={[s.stepBtn, !hasNext && { opacity: 0.35 }]}
                          disabled={!hasNext}
                          onPress={() => goTo(curIdx + 1)}
                        >
                          <Text style={s.stepBtnText}>Next</Text>
                          <ChevronRight size={16} color="#2D5DC9" />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {content.textContent && !isReading ? (
                    <View style={s.notesCard}>
                      <Text style={s.notesCardTitle}>Lesson Overview</Text>
                      <ChatMarkdown content={content.textContent} isUser={false} />
                    </View>
                  ) : null}

                  {content.quizId && !isSectioned ? (
                    <View style={s.mobileQuizWrap}>
                      <View style={s.desktopQuizCard}>
                        <View style={s.desktopQuizLeft}>
                          <View style={s.desktopQuizIconBox}>
                            <Trophy size={22} color="#D97706" />
                          </View>
                          <View style={s.desktopQuizInfo}>
                            <View style={s.desktopQuizBadgeRow}>
                              <View style={s.desktopQuizBadge}>
                                <Sparkles size={11} color="#7C3AED" />
                                <Text style={s.desktopQuizBadgeText}>Quiz</Text>
                              </View>
                              <View style={s.desktopQuizXpBadge}>
                                <Text style={s.desktopQuizXpBadgeText}>⭐ XP</Text>
                              </View>
                            </View>
                            <Text style={s.desktopQuizTitleMobile}>Ready for the Quiz?</Text>
                            <Text style={s.desktopQuizSub} numberOfLines={1}>
                              Test what you learned and level up!
                            </Text>
                          </View>
                        </View>
                        <Pressable
                          style={({ pressed }) => [
                            s.desktopQuizPlayBtn,
                            s.mobileQuizPlayBtn,
                            pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
                          ]}
                          onPress={() => setQuizModalQuizId(content.quizId!)}
                        >
                          <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                          <Text style={s.desktopQuizPlayBtnText}>Play</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {contents.length > 1 && (
                    <View style={s.mobileMoreSection}>
                      <Text style={s.sidebarTitle}>More in {topic.title}</Text>
                      <View style={{ gap: 10, marginTop: 12 }}>
                        {pagedPlaylist.map((item, index) => {
                          const globalIdx = playlistPage * PLAYLIST_PAGE_SIZE + index;
                          const isCur = globalIdx === curIdx;
                          const itemCfg = typeCfg(item.contentType);
                          const itemMedia = resolveMediaUrl(item.externalUrl ?? item.mediaUrl);
                          const yt = itemMedia ? getYouTubeThumbUrl(itemMedia) : null;
                          return (
                            <Pressable
                              key={item.id || globalIdx}
                              style={[s.playlistItem, isCur && s.playlistItemActive]}
                              onPress={() => goTo(globalIdx)}
                            >
                              <View style={[s.playlistIconBox, isCur && s.playlistIconBoxActive]}>
                                {yt ? (
                                  <Image source={{ uri: yt }} style={s.playlistThumb} resizeMode="cover" />
                                ) : isCur ? (
                                  <Pause size={14} color="#FFFFFF" fill="#FFFFFF" />
                                ) : (
                                  <Play size={14} color={itemCfg.accent} fill={itemCfg.accent} />
                                )}
                              </View>
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={[s.playlistItemTitle, isCur && s.playlistItemTitleActive]} numberOfLines={1}>
                                  {item.title}
                                </Text>
                                <Text style={s.playlistItemMeta}>{itemCfg.label}</Text>
                              </View>
                              <Text style={[s.playlistIndexText, isCur && { color: '#2D5DC9', fontWeight: '800' }]}>
                                #{globalIdx + 1}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {totalPlaylistPages > 1 && (
                        <View style={s.playlistPaginationRow}>
                          <Pressable
                            style={[s.playlistPageBtn, playlistPage === 0 && s.playlistPageBtnDisabled]}
                            disabled={playlistPage === 0}
                            onPress={() => setPlaylistPage((p) => Math.max(0, p - 1))}
                          >
                            <ChevronLeft size={14} color={playlistPage === 0 ? '#94A3B8' : '#2D5DC9'} />
                            <Text style={[s.playlistPageBtnText, playlistPage === 0 && s.playlistPageBtnTextDisabled]}>
                              Prev
                            </Text>
                          </Pressable>
                          <Text style={s.playlistPageText}>
                            Page {playlistPage + 1} of {totalPlaylistPages}
                          </Text>
                          <Pressable
                            style={[s.playlistPageBtn, playlistPage >= totalPlaylistPages - 1 && s.playlistPageBtnDisabled]}
                            disabled={playlistPage >= totalPlaylistPages - 1}
                            onPress={() => setPlaylistPage((p) => Math.min(totalPlaylistPages - 1, p + 1))}
                          >
                            <Text style={[s.playlistPageBtnText, playlistPage >= totalPlaylistPages - 1 && s.playlistPageBtnDisabled]}>
                              Next
                            </Text>
                            <ChevronRight size={14} color={playlistPage >= totalPlaylistPages - 1 ? '#94A3B8' : '#2D5DC9'} />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {quizModalQuizId && (
        <QuizRenderer quizId={quizModalQuizId} visible={!!quizModalQuizId} onClose={() => setQuizModalQuizId(null)} />
      )}
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F4FF' },
  topBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  topBarInner: {
    maxWidth: 1440,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
  topBarMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1a1a2e',
    flex: 1,
  },
  counterBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D5DC9',
  },
  scrollContainer: {
    paddingBottom: 48,
    paddingTop: 16,
  },
  bodyConstrained: {
    maxWidth: 1440,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
  },

  /* ── 2-Column Theatre Layout ── */
  theatreLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  theatreLeftCol: {
    flex: 1,
    minWidth: 0,
    gap: 16,
  },
  theatreRightCol: {
    width: 360,
    minWidth: 280,
    maxWidth: 420,
  },

  /* ── Main Stage Card ── */
  stageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    overflow: 'hidden',
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  stageTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4FF',
  },
  stageTopBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 12,
  },
  stageTopBarTitle: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  stageTopBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D6E8FF',
  },
  subjectPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D5DC9',
  },
  stagePlayerWrapVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#0B0F19',
    overflow: 'hidden',
  },
  stagePlayerWrapAudio: {
    width: '100%',
    backgroundColor: '#FAF5FF',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stagePlayerWrapImage: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    maxHeight: 520,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stagePlayerWrapDoc: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  stagePlayerWrapText: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  stagePlayerWrapFallback: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readingStageBody: {
    gap: 12,
    width: '100%',
  },
  readingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  readingBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  readingText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#1E293B',
  },
  imageStageFrame: {
    width: '100%',
    height: 380,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageStageImg: {
    width: '100%',
    height: '100%',
  },
  audioStageContainer: {
    width: '100%',
    maxWidth: 600,
  },
  docStageContainer: {
    width: '100%',
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
  stageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F4FF',
  },
  stageFooterTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  stageFooterMeta: {
    fontSize: 12,
    color: '#525C6B',
    fontWeight: '500',
  },
  stepBtnGroup: {
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

  /* ── Notes Card ── */
  notesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 18,
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  notesCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  notesCardBody: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },

  /* ── Right Column Playlist Sidebar ── */
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4FF',
    marginBottom: 12,
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  sidebarSub: {
    fontSize: 12,
    color: '#525C6B',
    marginTop: 2,
  },
  sidebarCountPill: {
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sidebarCountPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D5DC9',
  },
  playlistList: {
    gap: 8,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    gap: 10,
  },
  playlistItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2D5DC9',
  },
  playlistIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playlistIconBoxActive: {
    backgroundColor: '#2D5DC9',
    borderColor: '#2D5DC9',
  },
  playlistThumb: {
    width: '100%',
    height: '100%',
  },
  playlistItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  playlistItemTitleActive: {
    color: '#2D5DC9',
    fontWeight: '800',
  },
  playlistItemMeta: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  playingBadge: {
    backgroundColor: '#2D5DC9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  playingBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  playlistIndexText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },

  /* ── Mobile Layout ── */
  mobileLayout: {
    gap: 16,
  },
  mobileMoreSection: {
    marginTop: 8,
  },
  openBtn: {
    alignSelf: 'center',
    backgroundColor: '#EBF4FF',
    borderColor: '#CFE1FF',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  openBtnText: {
    color: '#1A4DA2',
    fontWeight: '700',
    fontSize: 13,
  },

  /* ── Playlist Pagination ── */
  playlistPaginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F4FF',
  },
  playlistPageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D6E8FF',
  },
  playlistPageBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E8ECF4',
  },
  playlistPageBtnText: {
    fontSize: 12,
    color: '#2D5DC9',
    fontWeight: '700',
  },
  playlistPageBtnTextDisabled: {
    color: '#94A3B8',
  },
  playlistPageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },

  /* ── Proper Play Quiz Section for Large & Mobile Devices ── */
  desktopQuizSection: {
    marginTop: 18,
    width: '100%',
  },
  desktopQuizCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    shadowColor: '#2D5DC9',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  desktopQuizLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  desktopQuizIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  desktopQuizInfo: {
    flex: 1,
    gap: 3,
  },
  desktopQuizBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  desktopQuizBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  desktopQuizBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  desktopQuizXpBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  desktopQuizXpBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  desktopQuizTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  desktopQuizTitleMobile: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  desktopQuizSub: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  desktopQuizPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D97706',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#D97706',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  desktopQuizPlayBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  mobileQuizWrap: {
    marginTop: 14,
    width: '100%',
  },
  mobileQuizPlayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 4,
  },
});
