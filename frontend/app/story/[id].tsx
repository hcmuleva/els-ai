import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text,
  View, useWindowDimensions,
} from 'react-native';
import WebView from 'react-native-webview';
import {
  BookOpen, BookOpenCheck, ChevronLeft, ChevronRight, Headphones,
  Pause, Play, Sparkles, Trophy, Video as VideoIcon,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { resolveMediaUrl } from '../../src/utils/media';
import QuizRenderer from '../../src/components/quiz/QuizRenderer';

type MediaItem = { kind: 'image' | 'video' | 'audio'; url: string; caption?: string };
type Section = {
  id: string;
  title: string;
  bodyText: string;
  media: MediaItem[];
  quizId: string | null;
  orderIndex: number;
};
type Story = {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  status: string;
};

function isYouTube(url: string) { return /youtube\.com|youtu\.be/.test(url); }
function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|watch\?v=|embed\/)([^&?/]+)/);
  return m?.[1] ?? null;
}
function embedUrl(url: string): string {
  const id = youTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}?rel=0&controls=1` : url;
}
function ytThumb(url: string): string | null {
  const id = youTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

const SECTION_PALETTE = [
  { bg: '#FFFDE7', accent: '#E6A817' },
  { bg: '#E6F4FF', accent: '#2D5DC9' },
  { bg: '#E7F8EE', accent: '#22A36E' },
  { bg: '#F2EAFE', accent: '#7C3AED' },
  { bg: '#FFEFE0', accent: '#B03A19' },
];
function paletteFor(idx: number) { return SECTION_PALETTE[idx % SECTION_PALETTE.length]; }

const SIDEBAR_PAGE_SIZE = 8;

export default function StoryReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isLargeScreen = windowWidth >= 900;

  const [story, setStory] = useState<Story | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [curIdx, setCurIdx] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [quizModalQuizId, setQuizModalQuizId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [sidebarPage, setSidebarPage] = useState(0);
  const finishedRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [storyRes, progressRes] = await Promise.all([
        apiFetch(`/stories/${id}`),
        apiFetch(`/stories/${id}/progress`),
      ]);
      if (storyRes.ok) {
        const data = await storyRes.json();
        setStory(data.story);
        const list: Section[] = (data.sections || []).sort((a: Section, b: Section) => a.orderIndex - b.orderIndex);
        setSections(list);
        if (progressRes.ok) {
          const pdata = await progressRes.json();
          const completed = new Set<string>(pdata.progress?.completed_section_ids || []);
          setCompletedIds(completed);
          const resumeId = pdata.progress?.current_section_id;
          const resumeIdx = resumeId ? list.findIndex((s) => s.id === resumeId) : 0;
          if (resumeIdx > 0) {
            setCurIdx(resumeIdx);
            setSidebarPage(Math.floor(resumeIdx / SIDEBAR_PAGE_SIZE));
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSidebarPage(Math.floor(curIdx / SIDEBAR_PAGE_SIZE)); }, [curIdx]);

  const recordProgress = useCallback(async (sectionId: string, completed: boolean) => {
    try {
      await apiFetch(`/stories/${id}/progress`, {
        method: 'POST', body: JSON.stringify({ sectionId, completed }),
      });
    } catch { /* ignore */ }
  }, [apiFetch, id]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= sections.length) return;
    setCurIdx(idx);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
  };

  const safeBack = () => {
    try {
      if ((router as any).canGoBack && (router as any).canGoBack()) { router.back(); return; }
    } catch { /* ignore */ }
    router.replace('/(tabs)' as any);
  };

  const handleFinish = async () => {
    if (finishedRef.current || finishing) return;
    finishedRef.current = true;
    setFinishing(true);
    const cur = sections[curIdx];
    if (cur) {
      const next = new Set(completedIds); next.add(cur.id);
      setCompletedIds(next);
      try { await recordProgress(cur.id, true); } catch { /* ignore */ }
    }
    safeBack();
  };

  const handleNext = () => {
    const cur = sections[curIdx];
    if (!cur) return;
    const isLast = curIdx === sections.length - 1;
    if (isLast) { handleFinish(); return; }
    const next = new Set(completedIds); next.add(cur.id);
    setCompletedIds(next);
    recordProgress(cur.id, false);
    goTo(curIdx + 1);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator accessibilityLabel="Loading" color="#2D5DC9" size="large" />
        <Text style={s.loadingText}>Loading story…</Text>
      </View>
    );
  }

  if (!story) {
    return (
      <View style={s.center}>
        <BookOpenCheck size={56} color="#B0B8D0" />
        <Text style={s.emptyTitle}>Story not found</Text>
        <Pressable style={s.emptyBtn} onPress={safeBack}>
          <ChevronLeft size={16} color="#fff" />
          <Text style={s.emptyBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const section = sections[curIdx];
  const hasPrev = curIdx > 0;
  const hasNext = curIdx < sections.length - 1;
  const cfg = paletteFor(curIdx);
  const totalSidebarPages = Math.ceil(sections.length / SIDEBAR_PAGE_SIZE);
  const pagedSections = sections.slice(sidebarPage * SIDEBAR_PAGE_SIZE, (sidebarPage + 1) * SIDEBAR_PAGE_SIZE);

  // Determine section media types
  const hasVideo = section?.media.some((m) => m.kind === 'video' && m.url);
  const hasAudio = section?.media.some((m) => m.kind === 'audio' && m.url) && !hasVideo;
  const hasImages = section?.media.some((m) => m.kind === 'image' && m.url);
  const hasText = !!section?.bodyText;

  const renderMediaItem = (m: MediaItem, i: number) => {
    if (m.kind === 'video' && m.url) {
      if (isYouTube(m.url)) {
        return (
          <View key={i} style={s.videoWrap}>
            <View style={s.videoFrame}>
              {Platform.OS === 'web' ? (
                // @ts-ignore
                <iframe
                  src={embedUrl(m.url)}
                  style={{ width: '100%', height: '100%', border: 'none', borderRadius: 0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <WebView
                  source={{ uri: embedUrl(m.url) }}
                  style={{ flex: 1 }}
                  allowsFullscreenVideo
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                />
              )}
            </View>
            {!!m.caption && <Text style={s.mediaCaption}>{m.caption}</Text>}
          </View>
        );
      }
      return (
        <View key={i} style={s.videoWrap}>
          {Platform.OS === 'web' ? (
            // @ts-ignore
            <video src={resolveMediaUrl(m.url)} controls style={{ width: '100%', borderRadius: 0, maxHeight: 260 }} />
          ) : (
            <View style={[s.videoFrame, { alignItems: 'center', justifyContent: 'center' }]}>
              <VideoIcon size={36} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 11, marginTop: 6 }}>Video player not supported here</Text>
            </View>
          )}
          {!!m.caption && <Text style={s.mediaCaption}>{m.caption}</Text>}
        </View>
      );
    }
    if (m.kind === 'image' && m.url) {
      return (
        <View key={i} style={s.imgWrap}>
          <Image source={{ uri: resolveMediaUrl(m.url) ?? '' }} style={s.img} resizeMode="contain" />
          {!!m.caption && <Text style={s.mediaCaption}>{m.caption}</Text>}
        </View>
      );
    }
    if (m.kind === 'audio' && m.url) {
      return (
        <View key={i} style={s.audioBlock}>
          <View style={s.audioIconWrap}>
            <Headphones size={20} color="#7C3AED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.audioTitle}>{m.caption || 'Listen along'}</Text>
            {Platform.OS === 'web' ? (
              // @ts-ignore
              <audio src={resolveMediaUrl(m.url)} controls style={{ width: '100%', marginTop: 6 }} />
            ) : (
              <Text style={s.audioMeta}>Audio playback opens externally</Text>
            )}
          </View>
        </View>
      );
    }
    return null;
  };

  const renderSectionContent = () => {
    if (!section) return null;
    return (
      <>
        {section.media.map((m, i) => renderMediaItem(m, i))}
        {hasText && (
          <View style={s.textBlock}>
            <Text style={s.textBody}>{section.bodyText}</Text>
          </View>
        )}
      </>
    );
  };

  const getStagePlayerStyle = () => {
    if (hasVideo) return s.stagePlayerWrapVideo;
    if (hasAudio && !hasText) return s.stagePlayerWrapAudio;
    if (hasImages && !hasText) return s.stagePlayerWrapImage;
    if (hasText && !hasVideo && !hasImages) return s.stagePlayerWrapText;
    return s.stagePlayerWrapFallback;
  };
  const stagePlayerStyle = getStagePlayerStyle();

  const renderQuizCard = (compact: boolean) => {
    if (!section?.quizId) return null;
    return (
      <View style={compact ? s.mobileQuizWrap : s.desktopQuizSection}>
        <View style={s.desktopQuizCard}>
          <View style={s.desktopQuizLeft}>
            <View style={s.desktopQuizIconBox}>
              <Trophy size={compact ? 22 : 26} color="#D97706" />
            </View>
            <View style={s.desktopQuizInfo}>
              <View style={s.desktopQuizBadgeRow}>
                <View style={s.desktopQuizBadge}>
                  <Sparkles size={compact ? 11 : 12} color="#7C3AED" />
                  <Text style={s.desktopQuizBadgeText}>{compact ? 'Quiz' : 'Interactive Quiz'}</Text>
                </View>
                <View style={s.desktopQuizXpBadge}>
                  <Text style={s.desktopQuizXpBadgeText}>⭐ {compact ? 'XP' : 'Earn XP'}</Text>
                </View>
              </View>
              <Text style={compact ? s.desktopQuizTitleMobile : s.desktopQuizTitle}>
                {compact ? 'Ready for the Quiz?' : 'Ready to Test Your Knowledge?'}
              </Text>
              <Text style={s.desktopQuizSub} numberOfLines={compact ? 1 : 2}>
                {compact ? 'Test what you learned and level up!' : `Play the quiz for "${section.title}" and level up!`}
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              s.desktopQuizPlayBtn,
              compact && s.mobileQuizPlayBtn,
              pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
            ]}
            onPress={() => setQuizModalQuizId(section.quizId!)}
          >
            <Play size={compact ? 14 : 16} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={s.desktopQuizPlayBtnText}>{compact ? 'Play' : 'Play Quiz'}</Text>
            {!compact && <ChevronRight size={16} color="#FFFFFF" />}
          </Pressable>
        </View>
      </View>
    );
  };

  const renderSidebarItem = (sec: Section, globalIdx: number) => {
    const isCur = globalIdx === curIdx;
    const pal = paletteFor(globalIdx);
    const firstImg = sec.media.find((m) => m.kind === 'image');
    const firstVid = sec.media.find((m) => m.kind === 'video');
    const thumb = firstImg?.url
      ? resolveMediaUrl(firstImg.url)
      : firstVid?.url && isYouTube(firstVid.url) ? ytThumb(firstVid.url) : null;
    const isCompleted = completedIds.has(sec.id);

    return (
      <Pressable
        key={sec.id}
        style={[s.playlistItem, isCur && s.playlistItemActive]}
        onPress={() => goTo(globalIdx)}
      >
        <View style={[s.playlistIconBox, isCur && { backgroundColor: pal.accent }]}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={s.playlistThumb} resizeMode="cover" />
          ) : isCur ? (
            <Pause size={14} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Play size={14} color={pal.accent} fill={pal.accent} />
          )}
        </View>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[s.playlistItemTitle, isCur && s.playlistItemTitleActive]} numberOfLines={2}>
            {sec.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            {isCur ? (
              <View style={s.playingBadge}>
                <Text style={s.playingBadgeText}>Reading Now</Text>
              </View>
            ) : (
              <Text style={s.playlistItemMeta}>{isCompleted ? '✓ Completed' : `Section ${globalIdx + 1}`}</Text>
            )}
          </View>
        </View>
        <Text style={[s.playlistIndexText, isCur && { color: '#2D5DC9', fontWeight: '800' }]}>
          #{globalIdx + 1}
        </Text>
      </Pressable>
    );
  };

  const renderSidebarPagination = () => {
    if (totalSidebarPages <= 1) return null;
    return (
      <View style={s.playlistPaginationRow}>
        <Pressable
          style={[s.playlistPageBtn, sidebarPage === 0 && s.playlistPageBtnDisabled]}
          disabled={sidebarPage === 0}
          onPress={() => setSidebarPage((p) => Math.max(0, p - 1))}
        >
          <ChevronLeft size={14} color={sidebarPage === 0 ? '#94A3B8' : '#2D5DC9'} />
          <Text style={[s.playlistPageBtnText, sidebarPage === 0 && s.playlistPageBtnTextDisabled]}>Prev</Text>
        </Pressable>
        <Text style={s.playlistPageText}>Page {sidebarPage + 1} of {totalSidebarPages}</Text>
        <Pressable
          style={[s.playlistPageBtn, sidebarPage >= totalSidebarPages - 1 && s.playlistPageBtnDisabled]}
          disabled={sidebarPage >= totalSidebarPages - 1}
          onPress={() => setSidebarPage((p) => Math.min(totalSidebarPages - 1, p + 1))}
        >
          <Text style={[s.playlistPageBtnText, sidebarPage >= totalSidebarPages - 1 && s.playlistPageBtnTextDisabled]}>Next</Text>
          <ChevronRight size={14} color={sidebarPage >= totalSidebarPages - 1 ? '#94A3B8' : '#2D5DC9'} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={s.screen}>
      {/* ── Top Bar ── */}
      <View style={[s.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={s.topBarInner}>
          <Pressable onPress={safeBack} style={s.backBtn} accessibilityLabel="Back">
            <ChevronLeft size={20} color="#1a1a2e" />
            <Text style={s.backBtnText}>Back</Text>
          </Pressable>

          <View style={s.topBarMid}>
            <View style={[s.typeBadge, { backgroundColor: `${cfg.accent}18` }]}>
              <BookOpen size={12} color={cfg.accent} />
              <Text style={[s.typeBadgeText, { color: cfg.accent }]}>Story</Text>
            </View>
            <Text style={s.headerTitle} numberOfLines={1}>{story.title}</Text>
          </View>

          {sections.length > 0 && (
            <View style={s.counterBadge}>
              <Text style={s.counterText}>{curIdx + 1} / {sections.length}</Text>
            </View>
          )}
        </View>
      </View>

      {sections.length === 0 ? (
        <View style={s.center}>
          <BookOpenCheck size={56} color="#B0B8D0" />
          <Text style={s.emptyTitle}>No sections yet</Text>
          <Text style={s.emptySub}>This story doesn't have any sections to read.</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContainer}
        >
          <View style={s.bodyConstrained}>
            {isLargeScreen ? (
              /* ── 2-COLUMN THEATRE LAYOUT FOR DESKTOP (≥ 900px) ── */
              <View style={s.theatreLayout}>
                {/* Left Column */}
                <View style={s.theatreLeftCol}>
                  <View style={s.stageCard}>
                    {/* Stage Top Bar */}
                    <View style={s.stageTopBar}>
                      <View style={s.stageTopBarLeft}>
                        <BookOpen size={16} color={cfg.accent} />
                        <Text style={s.stageTopBarTitle} numberOfLines={1}>{section.title}</Text>
                      </View>
                      <View style={s.stageTopBarRight}>
                        <View style={[s.subjectPill, { backgroundColor: `${cfg.accent}15` }]}>
                          <Text style={[s.subjectPillText, { color: cfg.accent }]}>
                            {story.title}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Media Area */}
                    <View style={stagePlayerStyle}>
                      {renderSectionContent()}
                    </View>

                    {/* Stage Footer */}
                    <View style={s.stageFooter}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={s.stageFooterTitle}>{section.title}</Text>
                        <Text style={s.stageFooterMeta}>
                          {story.title} · Section {curIdx + 1} of {sections.length}
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
                          onPress={() => hasNext ? goTo(curIdx + 1) : handleFinish()}
                        >
                          <Text style={s.stepBtnText}>{hasNext ? 'Next' : 'Finish'}</Text>
                          <ChevronRight size={16} color="#2D5DC9" />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Desktop Quiz Card */}
                  {renderQuizCard(false)}

                  {/* Finish Story Button */}
                  {!hasNext && (
                    <Pressable
                      style={[s.finishBtn, finishing && { opacity: 0.6 }]}
                      onPress={handleFinish}
                      disabled={finishing}
                    >
                      {finishing
                        ? <ActivityIndicator accessibilityLabel="Loading" color="#fff" />
                        : <Text style={s.finishBtnText}>🎉 Finish Story</Text>}
                    </Pressable>
                  )}
                </View>

                {/* Right Column: Sidebar */}
                <View style={s.theatreRightCol}>
                  <View style={s.sidebarCard}>
                    <View style={s.sidebarHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.sidebarTitle}>Story Sections</Text>
                        <Text style={s.sidebarSub}>{sections.length} sections in this story</Text>
                      </View>
                      <View style={s.sidebarCountPill}>
                        <Text style={s.sidebarCountPillText}>{curIdx + 1}/{sections.length}</Text>
                      </View>
                    </View>
                    <View style={s.playlistList}>
                      {pagedSections.map((sec, index) => {
                        const globalIdx = sidebarPage * SIDEBAR_PAGE_SIZE + index;
                        return renderSidebarItem(sec, globalIdx);
                      })}
                    </View>
                    {renderSidebarPagination()}
                  </View>
                </View>
              </View>
            ) : (
              /* ── MOBILE SINGLE COLUMN ── */
              <View style={s.mobileLayout}>
                <View style={s.stageCard}>
                  <View style={stagePlayerStyle}>
                    {renderSectionContent()}
                  </View>
                  <View style={s.stageFooter}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={s.stageFooterTitle}>{section.title}</Text>
                      <Text style={s.stageFooterMeta}>
                        {story.title} · Section {curIdx + 1} of {sections.length}
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
                        onPress={() => hasNext ? goTo(curIdx + 1) : handleFinish()}
                      >
                        <Text style={s.stepBtnText}>{hasNext ? 'Next' : 'Finish'}</Text>
                        <ChevronRight size={16} color="#2D5DC9" />
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Mobile Quiz Card */}
                {renderQuizCard(true)}

                {/* Finish Story Button */}
                {!hasNext && (
                  <Pressable
                    style={[s.finishBtn, finishing && { opacity: 0.6 }]}
                    onPress={handleFinish}
                    disabled={finishing}
                  >
                    {finishing
                      ? <ActivityIndicator accessibilityLabel="Loading" color="#fff" />
                      : <Text style={s.finishBtnText}>🎉 Finish Story</Text>}
                  </Pressable>
                )}

                {/* Mobile Sections List */}
                {sections.length > 1 && (
                  <View style={s.mobileMoreSection}>
                    <Text style={s.sidebarTitle}>More Sections</Text>
                    <View style={{ gap: 10, marginTop: 12 }}>
                      {pagedSections.map((sec, index) => {
                        const globalIdx = sidebarPage * SIDEBAR_PAGE_SIZE + index;
                        return renderSidebarItem(sec, globalIdx);
                      })}
                    </View>
                    {renderSidebarPagination()}
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {quizModalQuizId && (
        <QuizRenderer
          quizId={quizModalQuizId}
          visible={!!quizModalQuizId}
          onClose={() => {
            setQuizModalQuizId(null);
            const isLast = curIdx === sections.length - 1;
            if (isLast) handleFinish(); else handleNext();
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F4FF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32, backgroundColor: '#F0F4FF' },
  loadingText: { fontSize: 13, color: '#525C6B', fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#525C6B', textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#2D5DC9', marginTop: 4 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // ── Top Bar ──
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
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F4F5FF',
  },
  backBtnText: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  topBarMid: { flex: 1, gap: 3 },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  headerTitle: { fontSize: 15, fontWeight: '900', color: '#1a1a2e' },
  counterBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#EFF6FF',
  },
  counterText: { fontSize: 11, fontWeight: '800', color: '#2D5DC9' },

  scrollContainer: { paddingBottom: 40 },
  bodyConstrained: { maxWidth: 1440, width: '100%', alignSelf: 'center', padding: 16 },

  // ── Theatre Layout ──
  theatreLayout: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  theatreLeftCol: { flex: 1, gap: 16 },
  theatreRightCol: { width: 300, gap: 16 },
  mobileLayout: { gap: 16 },

  // ── Stage Card ──
  stageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  stageTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4FF',
  },
  stageTopBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  stageTopBarTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a2e', flex: 1 },
  stageTopBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  subjectPillText: { fontSize: 11, fontWeight: '700' },

  // ── Player Wrap sizes by content type ──
  stagePlayerWrapVideo: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', overflow: 'hidden' },
  stagePlayerWrapAudio: { paddingHorizontal: 16, paddingVertical: 16 },
  stagePlayerWrapImage: { paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  stagePlayerWrapText:  { padding: 20 },
  stagePlayerWrapFallback: { padding: 20, minHeight: 120 },

  stageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F4FF',
  },
  stageFooterTitle: { fontSize: 15, fontWeight: '900', color: '#1a1a2e' },
  stageFooterMeta: { fontSize: 12, color: '#525C6B', marginTop: 2, fontWeight: '500' },
  stepBtnGroup: { flexDirection: 'row', gap: 8 },
  stepBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#EFF6FF', borderRadius: 10,
  },
  stepBtnText: { fontSize: 13, fontWeight: '800', color: '#2D5DC9' },

  // ── Media elements ──
  videoWrap: { width: '100%', overflow: 'hidden' },
  videoFrame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0a0a0a', overflow: 'hidden' },
  imgWrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#F4F5FF', alignItems: 'center' },
  img: { width: '100%', height: 220 },
  mediaCaption: { fontSize: 12, color: '#7A7A9A', fontWeight: '500', paddingHorizontal: 4, marginTop: 6 },
  audioBlock: { flexDirection: 'row', gap: 12, padding: 14, backgroundColor: '#F5EFFE', borderRadius: 12, alignItems: 'center' },
  audioIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFE7FB', alignItems: 'center', justifyContent: 'center' },
  audioTitle: { fontSize: 13, fontWeight: '800', color: '#5B21B6' },
  audioMeta: { fontSize: 11, color: '#7C3AED', marginTop: 2 },
  textBlock: { backgroundColor: '#FFFFFF', borderRadius: 12 },
  textBody: { fontSize: 16, color: '#1a1a2e', lineHeight: 28, fontWeight: '500' },

  // ── Desktop Quiz Card ──
  desktopQuizSection: {},
  desktopQuizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    gap: 12,
  },
  desktopQuizLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  desktopQuizIconBox: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#FFF8E7',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#FDE68A',
  },
  desktopQuizInfo: { flex: 1, gap: 4 },
  desktopQuizBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  desktopQuizBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F5F3FF', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  desktopQuizBadgeText: { fontSize: 11, fontWeight: '800', color: '#7C3AED' },
  desktopQuizXpBadge: {
    backgroundColor: '#FFFBEB', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  desktopQuizXpBadgeText: { fontSize: 11, fontWeight: '700', color: '#D97706' },
  desktopQuizTitle: { fontSize: 16, fontWeight: '900', color: '#1a1a2e' },
  desktopQuizTitleMobile: { fontSize: 14, fontWeight: '900', color: '#1a1a2e' },
  desktopQuizSub: { fontSize: 12, color: '#525C6B', fontWeight: '500' },
  desktopQuizPlayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 12,
  },
  mobileQuizPlayBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  desktopQuizPlayBtnText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  mobileQuizWrap: {},

  // ── Finish Button ──
  finishBtn: {
    backgroundColor: '#22A36E',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },

  // ── Sidebar ──
  sidebarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    overflow: 'hidden',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4FF',
  },
  sidebarTitle: { fontSize: 15, fontWeight: '900', color: '#1a1a2e' },
  sidebarSub: { fontSize: 12, color: '#525C6B', fontWeight: '500', marginTop: 2 },
  sidebarCountPill: {
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sidebarCountPillText: { fontSize: 11, fontWeight: '800', color: '#2D5DC9' },
  playlistList: { gap: 2 },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 0,
  },
  playlistItemActive: { backgroundColor: '#EFF6FF' },
  playlistIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F0F4FF',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  playlistThumb: { width: '100%', height: '100%' },
  playlistItemTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a2e', lineHeight: 18 },
  playlistItemTitleActive: { color: '#2D5DC9' },
  playlistItemMeta: { fontSize: 11, color: '#525C6B', fontWeight: '500' },
  playlistIndexText: { fontSize: 11, fontWeight: '600', color: '#94A3B8', minWidth: 26, textAlign: 'right' },
  playingBadge: {
    backgroundColor: '#EFF6FF', borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  playingBadgeText: { fontSize: 10, fontWeight: '800', color: '#2D5DC9' },

  // ── Sidebar Pagination ──
  playlistPaginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F4FF',
  },
  playlistPageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#EFF6FF', borderRadius: 8,
  },
  playlistPageBtnDisabled: { backgroundColor: '#F4F5FF', opacity: 0.5 },
  playlistPageBtnText: { fontSize: 12, fontWeight: '700', color: '#2D5DC9' },
  playlistPageBtnTextDisabled: { color: '#94A3B8' },
  playlistPageText: { fontSize: 12, color: '#525C6B', fontWeight: '600' },

  // ── Mobile More Section ──
  mobileMoreSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 16,
  },
});
