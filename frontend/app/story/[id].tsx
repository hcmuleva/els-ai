import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import WebView from 'react-native-webview';
import {
  BookOpen, BookOpenCheck, ChevronLeft, Headphones, Image as ImageIcon, ListChecks,
  PlayCircle, Sparkles, Video as VideoIcon,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { resolveMediaUrl } from '../../src/utils/media';
import QuizRenderer from '../../src/components/quiz/QuizRenderer';

type Section = {
  id: string;
  title: string;
  bodyText: string;
  media: Array<{ kind: 'image' | 'video' | 'audio'; url: string; caption?: string }>;
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

const SECTION_PALETTE = [
  { bg: '#FFFDE7', accent: '#E6A817' },
  { bg: '#E6F4FF', accent: '#4A90E2' },
  { bg: '#E7F8EE', accent: '#22A36E' },
  { bg: '#F2EAFE', accent: '#7C3AED' },
  { bg: '#FFEFE0', accent: '#E05A3A' },
];

function paletteFor(idx: number) { return SECTION_PALETTE[idx % SECTION_PALETTE.length]; }
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
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export default function StoryReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiFetch } = useAuth();
  const [story, setStory] = useState<Story | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [curIdx, setCurIdx] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [quizModalQuizId, setQuizModalQuizId] = useState<string | null>(null);
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
          if (resumeIdx > 0) setCurIdx(resumeIdx);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, id]);

  useEffect(() => { load(); }, [load]);

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

  const [finishing, setFinishing] = useState(false);
  const finishedRef = useRef(false);

  const safeBack = () => {
    try {
      if ((router as any).canGoBack && (router as any).canGoBack()) {
        router.back();
        return;
      }
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

  const handleQuiz = (quizId: string) => setQuizModalQuizId(quizId);
  const handleQuizClose = () => {
    setQuizModalQuizId(null);
    const isLast = curIdx === sections.length - 1;
    if (isLast) handleFinish(); else handleNext();
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#4A90E2" size="large" />
        <Text style={s.loadingText}>Loading story…</Text>
      </View>
    );
  }

  if (!story) {
    return (
      <View style={s.center}>
        <BookOpenCheck size={56} color="#B0B8D0" />
        <Text style={s.emptyTitle}>Story not found</Text>
        <TouchableOpacity style={s.emptyBtn} onPress={safeBack}>
          <ChevronLeft size={16} color="#fff" />
          <Text style={s.emptyBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const section = sections[curIdx];
  const hasPrev = curIdx > 0;
  const hasNext = curIdx < sections.length - 1;
  const cfg = paletteFor(curIdx);

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
        <Pressable onPress={safeBack} style={s.backBtn} hitSlop={12}>
          <ChevronLeft size={22} color="#1a1a2e" />
        </Pressable>
        <View style={s.headerMid}>
          <View style={[s.typeBadge, { backgroundColor: `${cfg.accent}18` }]}>
            <Sparkles size={11} color={cfg.accent} />
            <Text style={[s.typeBadgeText, { color: cfg.accent }]}>Story</Text>
          </View>
          <Text style={s.headerTitle} numberOfLines={1}>{story.title}</Text>
        </View>
        {sections.length > 0 && (
          <View style={[s.counter, { backgroundColor: `${cfg.accent}15` }]}>
            <Text style={[s.counterTxt, { color: cfg.accent }]}>{curIdx + 1}/{sections.length}</Text>
          </View>
        )}
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
          contentContainerStyle={s.scroll}
        >
          {/* Hero card */}
          <View style={[s.heroCard, { backgroundColor: cfg.bg }]}>
            <View style={s.heroRow}>
              <View style={s.heroLeft}>
                <Text style={s.heroTitle}>{section.title}</Text>
                <Text style={s.heroSub}>{story.title} · Section {curIdx + 1}</Text>
              </View>
              {(() => {
                const firstImage = section.media.find((m) => m.kind === 'image');
                const firstVideo = section.media.find((m) => m.kind === 'video');
                if (firstImage?.url) {
                  return <Image source={{ uri: resolveMediaUrl(firstImage.url) }} style={s.heroThumb} resizeMode="cover" />;
                }
                if (firstVideo?.url && isYouTube(firstVideo.url)) {
                  const yt = ytThumb(firstVideo.url);
                  if (yt) return <Image source={{ uri: yt }} style={s.heroThumb} resizeMode="cover" />;
                }
                if (story.coverImageUrl) {
                  return <Image source={{ uri: resolveMediaUrl(story.coverImageUrl) }} style={s.heroThumb} resizeMode="cover" />;
                }
                return (
                  <View style={[s.heroIconBox, { backgroundColor: `${cfg.accent}20` }]}>
                    <BookOpen size={32} color={cfg.accent} />
                  </View>
                );
              })()}
            </View>
            <View style={s.heroNav}>
              <Pressable style={[s.heroNavBtn, !hasPrev && { opacity: 0.3 }]} disabled={!hasPrev} onPress={() => goTo(curIdx - 1)}>
                <ChevronLeft size={16} color="#5A5A7A" />
                <Text style={s.heroNavArrow}>Prev</Text>
              </Pressable>
              <View style={[s.heroNavDivider, { backgroundColor: `${cfg.accent}30` }]} />
              <Pressable style={[s.heroNavBtn, !hasNext && { opacity: 0.3 }]} disabled={!hasNext} onPress={() => goTo(curIdx + 1)}>
                <Text style={s.heroNavArrow}>Next</Text>
                <ChevronLeft size={16} color="#5A5A7A" style={{ transform: [{ scaleX: -1 }] }} />
              </Pressable>
            </View>
          </View>

          {/* Section media + body */}
          <View style={s.section}>
            {section.media.map((m, i) => {
              if (m.kind === 'video' && m.url) {
                if (isYouTube(m.url)) {
                  return (
                    <View key={i} style={s.videoWrap}>
                      <View style={s.videoFrame}>
                        {Platform.OS === 'web' ? (
                          // @ts-ignore
                          <iframe
                            src={embedUrl(m.url)}
                            style={{ width: '100%', height: '100%', border: 'none', borderRadius: 16 }}
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
                      <video src={resolveMediaUrl(m.url)} controls style={{ width: '100%', borderRadius: 16, maxHeight: 240 }} />
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
                    <Image source={{ uri: resolveMediaUrl(m.url) }} style={s.img} resizeMode="cover" />
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
            })}

            {!!section.bodyText && (
              <View style={s.textBlock}>
                <Text style={s.textBody}>{section.bodyText}</Text>
              </View>
            )}

            {section.quizId && (
              <TouchableOpacity style={s.quizCta} onPress={() => handleQuiz(section.quizId!)}>
                <View style={s.quizCtaIcon}>
                  <ListChecks size={18} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.quizCtaTitle}>Quick Challenge</Text>
                  <Text style={s.quizCtaSub}>Test what you learned in this section</Text>
                </View>
                <PlayCircle size={22} color="#7C3AED" />
              </TouchableOpacity>
            )}

            {/* Bottom action */}
            <View style={s.bottomActionRow}>
              {hasNext ? (
                <TouchableOpacity style={[s.primaryBtn, { backgroundColor: cfg.accent }]} onPress={handleNext}>
                  <Text style={s.primaryBtnText}>Next Section</Text>
                  <ChevronLeft size={18} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: '#22A36E' }, finishing && { opacity: 0.6 }]}
                  onPress={handleFinish}
                  disabled={finishing}
                >
                  {finishing
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.primaryBtnText}>Finish Story</Text>}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* More sections carousel */}
          {sections.length > 1 && (
            <View style={s.moreWrap}>
              <Text style={s.moreTitle}>More in {story.title}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.moreScroll}>
                {sections.map((c, i) => {
                  const active = i === curIdx;
                  const cc = paletteFor(i);
                  const firstImg = c.media.find((m) => m.kind === 'image');
                  const firstVid = c.media.find((m) => m.kind === 'video');
                  const thumb = firstImg?.url || (firstVid?.url && isYouTube(firstVid.url) ? ytThumb(firstVid.url) : null);
                  const isCompleted = completedIds.has(c.id);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => goTo(i)}
                      style={[s.moreCard, active && { backgroundColor: cc.bg, borderColor: cc.accent, borderWidth: 2 }]}
                    >
                      <View style={[s.moreCardIconWrap, { backgroundColor: active ? `${cc.accent}20` : '#F0F0F8' }]}>
                        {thumb
                          ? <Image source={{ uri: resolveMediaUrl(thumb) }} style={s.moreCardImg} resizeMode="cover" />
                          : <BookOpen size={22} color={active ? cc.accent : '#9A9AB0'} />}
                      </View>
                      <Text style={s.moreCardTitle} numberOfLines={2}>{c.title}</Text>
                      <Text style={[s.moreCardMeta, { color: active ? cc.accent : '#9A9AB0' }]}>
                        {isCompleted ? '✓ Completed' : `Section ${i + 1}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      )}

      {quizModalQuizId && (
        <QuizRenderer
          quizId={quizModalQuizId}
          visible={!!quizModalQuizId}
          onClose={handleQuizClose}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32, backgroundColor: '#FFFFFF' },
  loadingText: { fontSize: 13, color: '#9A9AB0', fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#9A9AB0', textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#4A90E2', marginTop: 4 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8', gap: 10,
  },
  backBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F4F5FF', alignItems: 'center', justifyContent: 'center' },
  headerMid:     { flex: 1, gap: 3 },
  typeBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  headerTitle:   { fontSize: 15, fontWeight: '900', color: '#1a1a2e' },
  counter:       { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  counterTxt:    { fontSize: 11, fontWeight: '800' },
  scroll:        { paddingBottom: 48 },

  heroCard:    { margin: 16, borderRadius: 24, padding: 20, marginBottom: 10 },
  heroRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  heroLeft:    { flex: 1 },
  heroTitle:   { fontSize: 20, fontWeight: '900', color: '#1a1a2e', lineHeight: 28, marginBottom: 4 },
  heroSub:     { fontSize: 12, fontWeight: '500', color: '#7A7A9A' },
  heroThumb:   { width: 72, height: 72, borderRadius: 14 },
  heroIconBox: { width: 72, height: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroNav:     { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.07)', paddingTop: 14 },
  heroNavBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  heroNavArrow:{ fontSize: 14, fontWeight: '800', color: '#5A5A7A' },
  heroNavDivider:{ width: 1, height: 20, alignSelf: 'center' },

  section:   { marginHorizontal: 16, marginBottom: 16, gap: 12 },
  videoWrap: { borderRadius: 20, overflow: 'hidden' },
  videoFrame:{ width: '100%', height: 230, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0a0a0a' },
  imgWrap:   { borderRadius: 20, overflow: 'hidden' },
  img:       { width: '100%', height: 220 },
  mediaCaption: { fontSize: 12, color: '#7A7A9A', fontWeight: '600', paddingHorizontal: 4, marginTop: 6 },

  audioBlock: { flexDirection: 'row', gap: 12, padding: 14, backgroundColor: '#F5EFFE', borderRadius: 16, alignItems: 'center' },
  audioIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFE7FB', alignItems: 'center', justifyContent: 'center' },
  audioTitle: { fontSize: 13, fontWeight: '800', color: '#5B21B6' },
  audioMeta: { fontSize: 11, color: '#7C3AED', marginTop: 2 },

  textBlock: { backgroundColor: '#F8F9FF', borderRadius: 16, padding: 20 },
  textBody:  { fontSize: 16, color: '#1a1a2e', lineHeight: 28, fontWeight: '500' },

  quizCta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: '#F5EFFE', borderWidth: 1, borderColor: '#E5D9F8' },
  quizCtaIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFE7FB', alignItems: 'center', justifyContent: 'center' },
  quizCtaTitle: { fontSize: 14, fontWeight: '900', color: '#5B21B6' },
  quizCtaSub: { fontSize: 11, color: '#7C3AED', marginTop: 2, fontWeight: '600' },

  bottomActionRow: { marginTop: 4 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },

  moreWrap:        { marginTop: 8, paddingBottom: 8 },
  moreTitle:       { fontSize: 17, fontWeight: '900', color: '#1a1a2e', paddingHorizontal: 16, marginBottom: 12 },
  moreScroll:      { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  moreCard:        { width: 130, borderRadius: 18, padding: 12, gap: 8, backgroundColor: '#F4F5FF' },
  moreCardIconWrap:{ width: '100%', height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  moreCardImg:     { width: '100%', height: '100%', borderRadius: 12 },
  moreCardTitle:   { fontSize: 12, fontWeight: '800', color: '#1a1a2e', lineHeight: 17 },
  moreCardMeta:    { fontSize: 10, fontWeight: '600' },
});
