import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions
} from 'react-native';
import WebView from 'react-native-webview';
import { BookOpen, BookOpenCheck, ChevronLeft, Headphones, Sparkles } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import YoutubePlayer from 'react-native-youtube-iframe';

import { resolveMediaUrl } from '../../utils/media';
import QuizRenderer from '../quiz/QuizRenderer';
import PlayQuizCTA from '../quiz/PlayQuizCTA';
import AudioPlayer from '../media/AudioPlayer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type StoryPreviewMedia = {
  kind: 'image' | 'video' | 'audio';
  url: string;
  caption?: string;
};

export type StoryPreviewSection = {
  id: string;
  title: string;
  bodyText: string;
  media: StoryPreviewMedia[];
  quizId: string | null;
  orderIndex: number;
};

export type StoryPreviewMeta = {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string | null;
  classLevel?: string | null;
};

type Props = {
  visible: boolean;
  story: StoryPreviewMeta;
  sections: StoryPreviewSection[];
  onClose: () => void;
};

const SECTION_PALETTE = [
  { bg: '#FFFDE7', accent: '#E6A817' },
  { bg: '#E6F4FF', accent: '#4A90E2' },
  { bg: '#E7F8EE', accent: '#22A36E' },
  { bg: '#F2EAFE', accent: '#7C3AED' },
  { bg: '#FFEFE0', accent: '#E05A3A' },
];

const paletteFor = (idx: number) => SECTION_PALETTE[idx % SECTION_PALETTE.length];
const isYouTube = (url: string) => /youtube\.com|youtu\.be/.test(url);
const getYouTubeId = (url: string): string | null => {
  const match = url.match(/(?:youtu\.be\/|watch\?v=|embed\/)([^&?/]+)/);
  return match?.[1] ?? null;
};
const getEmbedUrl = (url: string) => {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}?rel=0&controls=1&playsinline=1` : url;
};
const getYouTubeThumb = (url: string): string | null => {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
};

export default function StudentStoryViewer({ visible, story, sections, onClose }: Props) {
  const [curIdx, setCurIdx] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [quizModalQuizId, setQuizModalQuizId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => a.orderIndex - b.orderIndex),
    [sections],
  );

  useEffect(() => {
    if (!visible) return;
    setCurIdx(0);
    setFinishing(false);
    setQuizModalQuizId(null);
  }, [visible, story.id, sortedSections.length]);

  const section = sortedSections[curIdx];
  const hasPrev = curIdx > 0;
  const hasNext = curIdx < sortedSections.length - 1;
  const cfg = paletteFor(curIdx);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= sortedSections.length) return;
    setCurIdx(idx);
  };

  const handleFinish = () => {
    if (finishing) return;
    setFinishing(true);
    onClose();
  };

  const handleNext = () => {
    if (!hasNext) {
      handleFinish();
      return;
    }
    setCurIdx((prev) => Math.min(prev + 1, sortedSections.length - 1));
  };

  const handleQuizClose = () => {
    setQuizModalQuizId(null);
    if (!hasNext) handleFinish();
    else handleNext();
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <View style={s.screen}>
          <View style={[s.header, { paddingTop: Math.max(insets.top, 12) }]}>
            <Pressable onPress={onClose} style={s.backBtn} hitSlop={12}>
              <ChevronLeft size={22} color="#1a1a2e" />
            </Pressable>
            <View style={s.headerMid}>
              <View style={[s.typeBadge, { backgroundColor: `${cfg.accent}18` }]}>
                <Sparkles size={11} color={cfg.accent} />
                <Text style={[s.typeBadgeText, { color: cfg.accent }]}>Story Preview</Text>
              </View>
              <Text style={s.headerTitle} numberOfLines={1}>{story.title || 'Untitled Story'}</Text>
            </View>
            {sortedSections.length > 0 && (
              <View style={[s.counter, { backgroundColor: `${cfg.accent}15` }]}>
                <Text style={[s.counterTxt, { color: cfg.accent }]}>{curIdx + 1}/{sortedSections.length}</Text>
              </View>
            )}
          </View>

          {sortedSections.length === 0 || !section ? (
            <View style={s.center}>
              <BookOpenCheck size={56} color="#B0B8D0" />
              <Text style={s.emptyTitle}>No sections yet</Text>
              <Text style={s.emptySub}>Add at least one section in Story Sections to preview.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
              <View style={[s.heroCard, { backgroundColor: cfg.bg }]}>
                <View style={s.heroRow}>
                  <View style={s.heroLeft}>
                    <Text style={s.heroTitle}>{section.title || `Section ${curIdx + 1}`}</Text>
                    <Text style={s.heroSub}>{story.title} · Section {curIdx + 1}</Text>
                  </View>
                  {(() => {
                    const firstImage = section.media.find((m) => m.kind === 'image');
                    const firstVideo = section.media.find((m) => m.kind === 'video');
                    if (firstImage?.url) {
                      const resolved = resolveMediaUrl(firstImage.url);
                      return resolved ? <Image source={{ uri: resolved }} style={s.heroThumb} resizeMode="contain" /> : null;
                    }
                    if (firstVideo?.url && isYouTube(firstVideo.url)) {
                      const thumb = getYouTubeThumb(firstVideo.url);
                      if (thumb) return <Image source={{ uri: thumb }} style={s.heroThumb} resizeMode="contain" />;
                    }
                    if (story.coverImageUrl) {
                      const resolved = resolveMediaUrl(story.coverImageUrl);
                      return resolved ? <Image source={{ uri: resolved }} style={s.heroThumb} resizeMode="contain" /> : null;
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

              <View style={s.section}>
                {section.media.map((media, index) => {
                  const resolvedUrl = resolveMediaUrl(media.url);
                  if (!resolvedUrl) return null;

                  if (media.kind === 'video') {
                    if (isYouTube(media.url)) {
                      const videoId = getYouTubeId(media.url);
                      if (!videoId) return null;
                      return (
                        <View key={`media-${index}`} style={s.videoWrap}>
                          <View style={s.videoFrame}>
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
                          {!!media.caption && <Text style={s.mediaCaption}>{media.caption}</Text>}
                        </View>
                      );
                    }
                    return (
                      <View key={`media-${index}`} style={s.videoWrap}>
                        <View style={s.videoFrame}>
                          <Video
                            source={{ uri: resolvedUrl }}
                            useNativeControls
                            resizeMode={ResizeMode.CONTAIN}
                            style={{ width: '100%', height: '100%' }}
                          />
                        </View>
                        {!!media.caption && <Text style={s.mediaCaption}>{media.caption}</Text>}
                      </View>
                    );
                  }

                  if (media.kind === 'image') {
                    return (
                      <View key={`media-${index}`} style={s.imgWrap}>
                        <Image source={{ uri: resolvedUrl }} style={s.img} resizeMode="contain" />
                        {!!media.caption && <Text style={s.mediaCaption}>{media.caption}</Text>}
                      </View>
                    );
                  }

                  if (media.kind === 'audio') {
                    return (
                      <View key={`media-${index}`} style={s.audioWrap}>
                        <View style={s.audioIconWrap}>
                          <Headphones size={20} color="#7C3AED" />
                        </View>
                        <AudioPlayer
                          uri={resolvedUrl}
                          title={media.caption || section.title || 'Listen along'}
                          subtitle={story.title || 'Story audio'}
                          accentColor="#7C3AED"
                          bgColor="#F5EFFE"
                        />
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
                  <PlayQuizCTA
                    onPress={() => setQuizModalQuizId(section.quizId!)}
                    title="Play Quiz"
                    subtitle="Tap to test what you learned"
                    themeKey={section.id || section.quizId}
                  />
                )}

                <View style={s.bottomActionRow}>
                  {hasNext ? (
                    <TouchableOpacity style={[s.primaryBtn, { backgroundColor: cfg.accent }]} onPress={handleNext}>
                      <Text style={s.primaryBtnText}>Next Section</Text>
                      <ChevronLeft size={18} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[s.primaryBtn, { backgroundColor: '#22A36E' }, finishing && { opacity: 0.6 }]} onPress={handleFinish} disabled={finishing}>
                      {finishing ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Close Preview</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {sortedSections.length > 1 && (
                <View style={s.moreWrap}>
                  <Text style={s.moreTitle}>More in {story.title}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.moreScroll}>
                    {sortedSections.map((item, index) => {
                      const active = index === curIdx;
                      const sectionPalette = paletteFor(index);
                      const firstImg = item.media.find((m) => m.kind === 'image');
                      const firstVid = item.media.find((m) => m.kind === 'video');
                      const thumb = firstImg?.url || (firstVid?.url && isYouTube(firstVid.url) ? getYouTubeThumb(firstVid.url) : null);
                      const resolvedThumb = thumb ? resolveMediaUrl(thumb) : null;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => goTo(index)}
                          style={[s.moreCard, active && { backgroundColor: sectionPalette.bg, borderColor: sectionPalette.accent, borderWidth: 2 }]}
                        >
                          <View style={[s.moreCardIconWrap, { backgroundColor: active ? `${sectionPalette.accent}20` : '#F0F0F8' }]}>
                            {resolvedThumb
                              ? <Image source={{ uri: resolvedThumb }} style={s.moreCardImg} resizeMode="contain" />
                              : <BookOpen size={22} color={active ? sectionPalette.accent : '#9A9AB0'} />}
                          </View>
                          <Text style={s.moreCardTitle} numberOfLines={2}>{item.title || `Section ${index + 1}`}</Text>
                          <Text style={[s.moreCardMeta, { color: active ? sectionPalette.accent : '#9A9AB0' }]}>
                            Section {index + 1}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {quizModalQuizId && (
        <QuizRenderer
          quizId={quizModalQuizId}
          visible={!!quizModalQuizId}
          onClose={handleQuizClose}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32, backgroundColor: '#FFFFFF' },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#9A9AB0', textAlign: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8', gap: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F4F5FF', alignItems: 'center', justifyContent: 'center' },
  headerMid: { flex: 1, gap: 3 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  headerTitle: { fontSize: 15, fontWeight: '900', color: '#1a1a2e' },
  counter: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  counterTxt: { fontSize: 11, fontWeight: '800' },
  scroll: { paddingBottom: 48 },

  heroCard: { margin: 16, borderRadius: 24, padding: 20, marginBottom: 10 },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  heroLeft: { flex: 1 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#1a1a2e', lineHeight: 28, marginBottom: 4 },
  heroSub: { fontSize: 12, fontWeight: '500', color: '#7A7A9A' },
  heroThumb: { width: 72, height: 72, borderRadius: 14 },
  heroIconBox: { width: 72, height: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroNav: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.07)', paddingTop: 14 },
  heroNavBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  heroNavArrow: { fontSize: 14, fontWeight: '800', color: '#5A5A7A' },
  heroNavDivider: { width: 1, height: 20, alignSelf: 'center' },

  section: { marginHorizontal: 16, marginBottom: 16, gap: 12 },
  videoWrap: { borderRadius: 20, overflow: 'hidden' },
  videoFrame: { width: '100%', aspectRatio: 16 / 9, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0a0a0a' },
  imgWrap: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#F4F5FF', alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: 220 },
  mediaCaption: { fontSize: 12, color: '#7A7A9A', fontWeight: '600', paddingHorizontal: 4, marginTop: 6 },

  audioWrap: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#F5EFFE', padding: 10, gap: 10 },
  audioIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFE7FB', alignItems: 'center', justifyContent: 'center' },

  textBlock: { backgroundColor: '#F8F9FF', borderRadius: 16, padding: 20 },
  textBody: { fontSize: 16, color: '#1a1a2e', lineHeight: 28, fontWeight: '500' },

  bottomActionRow: { marginTop: 4 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },

  moreWrap: { marginTop: 8, paddingBottom: 8 },
  moreTitle: { fontSize: 17, fontWeight: '900', color: '#1a1a2e', paddingHorizontal: 16, marginBottom: 12 },
  moreScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  moreCard: { width: 130, borderRadius: 18, padding: 12, gap: 8, backgroundColor: '#F4F5FF' },
  moreCardIconWrap: { width: '100%', height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  moreCardImg: { width: '100%', height: '100%', borderRadius: 12 },
  moreCardTitle: { fontSize: 12, fontWeight: '800', color: '#1a1a2e', lineHeight: 17 },
  moreCardMeta: { fontSize: 10, fontWeight: '600' },
});
