import { useRef, useState } from 'react';
import { Dimensions, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ChevronLeft, BookOpen, Play, Film, Headphones, Image as ImageIcon, FileText, Layers } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import * as Linking from 'expo-linking';
import YoutubePlayer from 'react-native-youtube-iframe';

import QuizRenderer from '../quiz/QuizRenderer';
import PlayQuizCTA from '../quiz/PlayQuizCTA';
import AudioPlayer from '../media/AudioPlayer';
import DocumentViewer from '../media/DocumentViewer';
import { API_BASE_URL } from '../../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_H = Dimensions.get('window').height;

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
  video: { label: 'YouTube Video', Icon: Play, accent: '#FF4444', bg: '#FFE8D6' },
  youtube_url: { label: 'YouTube Video', Icon: Play, accent: '#FF4444', bg: '#FFE8D6' },
  reel_url: { label: 'Reel', Icon: Film, accent: '#E91E8C', bg: '#FFE0F0' },
  reel: { label: 'Reel', Icon: Film, accent: '#E91E8C', bg: '#FFE0F0' },
  audio: { label: 'Audio', Icon: Headphones, accent: '#9B8EC4', bg: '#EDE4FF' },
  image: { label: 'Image / Video', Icon: ImageIcon, accent: '#4A90E2', bg: '#D6EAFF' },
  text: { label: 'Reading', Icon: BookOpen, accent: '#7DC67A', bg: '#D6F5D6' },
  document: { label: 'Document', Icon: FileText, accent: '#4A90E2', bg: '#D6EAFF' },
};
const DEFAULT_TYPE: TypeCfg = { label: 'Content', Icon: Layers, accent: '#4A90E2', bg: '#D6EAFF' };
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
  const [curIdx, setCurIdx] = useState(startIdx);
  const [scrollY, setScrollY] = useState(0);
  const [quizModalQuizId, setQuizModalQuizId] = useState<string | null>(null);
  const sectionYs = useRef<Record<string, number>>({});
  const insets = useSafeAreaInsets();

  const content = contents[curIdx];
  const hasPrev = curIdx > 0;
  const hasNext = curIdx < contents.length - 1;

  const goTo = (idx: number) => {
    sectionYs.current = {};
    setCurIdx(idx);
  };
  const isInView = (key: string) => {
    const y = sectionYs.current[key] ?? -1;
    return y >= scrollY && y < scrollY + SCREEN_H * 0.9;
  };

  if (!content) return null;

  const cfg = typeCfg(content.contentType);
  const url = resolveMediaUrl(content.externalUrl ?? content.mediaUrl);
  const ytThumb = url ? getYouTubeThumbUrl(url) : null;

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <View style={s.screen}>
          <View style={[s.header, { paddingTop: Math.max(insets.top, 12) }]}>
            <Pressable onPress={onClose} style={s.backBtn}>
              <ChevronLeft size={22} color="#1a1a2e" />
            </Pressable>
            <View style={s.headerMid}>
              <View style={[s.typeBadge, { backgroundColor: `${cfg.accent}18` }]}>
                <cfg.Icon size={11} color={cfg.accent} />
                <Text style={[s.typeBadgeText, { color: cfg.accent }]}>{cfg.label}</Text>
              </View>
              <Text style={s.headerTitle} numberOfLines={1}>{content.title}</Text>
            </View>
            <View style={[s.counter, { backgroundColor: `${cfg.accent}15` }]}>
              <Text style={[s.counterTxt, { color: cfg.accent }]}>{curIdx + 1}/{contents.length}</Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
            scrollEventThrottle={100}
            onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
          >
            <View style={[s.heroCard, { backgroundColor: cfg.bg }]}>
              <View style={s.heroRow}>
                <View style={s.heroLeft}>
                  <Text style={s.heroTitle}>{content.title}</Text>
                  <Text style={s.heroSub}>{topic.subject} · Class {topic.classLevel}</Text>
                </View>
                {ytThumb ? (
                  <Image source={{ uri: ytThumb }} style={s.heroThumb} resizeMode="cover" />
                ) : (
                  <View style={[s.heroIconBox, { backgroundColor: `${cfg.accent}20` }]}>
                    <cfg.Icon size={36} color={cfg.accent} />
                  </View>
                )}
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

            <View style={s.section} onLayout={(e) => { sectionYs.current[`s-${curIdx}`] = e.nativeEvent.layout.y; }}>
              {url && (content.contentType === 'youtube_url' || content.contentType === 'video' || isYouTubeUrl(url)) && (() => {
                const videoId = getYouTubeVideoId(url);
                if (!videoId) return null;
                return (
                  <View style={s.videoWrap}>
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
                  </View>
                );
              })()}

              {url && (content.contentType === 'image' || isImageUrl(url)) && !isVideoUrl(url) && !isYouTubeUrl(url) && !isAudioUrl(url) && !isDocumentUrl(url) && (
                <View style={s.imgWrap}>
                  <Image source={{ uri: url }} style={s.img} resizeMode="cover" />
                </View>
              )}

              {url && (content.contentType === 'audio' || isAudioUrl(url)) && !isVideoUrl(url) && !isYouTubeUrl(url) && (
                <View style={{ marginTop: 10 }}>
                  <AudioPlayer uri={url} title={content.title} subtitle={topic.subject} accentColor="#4A90E2" bgColor="#D6EAFF" />
                </View>
              )}

              {url && (content.contentType === 'reel' || content.contentType === 'reel_url' || isVideoUrl(url)) && !isYouTubeUrl(url) && (
                <View style={s.videoWrap}>
                  <View style={s.videoFrame}>
                    {Platform.OS === 'web' ? (
                      <video src={url} controls style={{ width: '100%', height: '100%', borderRadius: 16 }} />
                    ) : (
                      <Video source={{ uri: url }} useNativeControls resizeMode={ResizeMode.CONTAIN} style={{ width: '100%', height: '100%' }} />
                    )}
                  </View>
                </View>
              )}

              {url && isDocumentUrl(url) && (
                <DocumentViewer uri={url} title={content.title} accentColor="#4A90E2" bgColor="#D6EAFF" />
              )}

              {!isYouTubeUrl(url) && !isImageUrl(url) && !isAudioUrl(url) && !isVideoUrl(url) && !isDocumentUrl(url) && !!url && (
                <Pressable style={[s.openBtn, { marginTop: 10 }]} onPress={() => openExternalResource(url)}>
                  <Text style={s.openBtnText}>Open Resource Link</Text>
                </Pressable>
              )}

              {content.textContent && (
                <View style={s.textBlock}>
                  <Text style={s.textBody}>{content.textContent}</Text>
                </View>
              )}

              {content.quizId && (
                <PlayQuizCTA
                  onPress={() => setQuizModalQuizId(content.quizId!)}
                  title="Play Quiz"
                  subtitle="Tap to test what you learned"
                  themeKey={content.id || content.quizId!}
                />
              )}
            </View>

            {contents.length > 1 && (
              <View style={s.moreWrap}>
                <Text style={s.moreTitle}>More in {topic.title}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.moreScroll}>
                  {contents.map((item, index) => {
                    const yt = item.externalUrl ? getYouTubeThumbUrl(resolveMediaUrl(item.externalUrl)) : null;
                    const itemCfg = typeCfg(item.contentType);
                    const active = index === curIdx;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => goTo(index)}
                        style={[s.moreCard, active && { backgroundColor: itemCfg.bg, borderColor: itemCfg.accent, borderWidth: 2 }]}
                      >
                        <View style={[s.moreCardIconWrap, { backgroundColor: active ? `${itemCfg.accent}20` : '#F0F0F8' }]}>
                          {yt
                            ? <Image source={{ uri: yt }} style={s.moreCardImg} resizeMode="cover" />
                            : <itemCfg.Icon size={22} color={active ? itemCfg.accent : '#9A9AB0'} />
                          }
                        </View>
                        <Text style={s.moreCardTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={[s.moreCardMeta, { color: active ? itemCfg.accent : '#9A9AB0' }]}>
                          {itemCfg.label} · {index + 1}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
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
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
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
  videoWrap: { borderRadius: 20, overflow: 'hidden', marginBottom: 4 },
  videoFrame: { width: '100%', aspectRatio: 16 / 9, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0a0a0a' },
  imgWrap: { borderRadius: 20, overflow: 'hidden' },
  img: { width: '100%', height: 220 },
  textBlock: { backgroundColor: '#F8F9FF', borderRadius: 16, padding: 20 },
  textBody: { fontSize: 16, color: '#1a1a2e', lineHeight: 28, fontWeight: '500' },
  openBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#EBF4FF',
    borderColor: '#CFE1FF',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  openBtnText: { color: '#1A4DA2', fontWeight: '700', fontSize: 12 },

  moreWrap: { marginTop: 8, paddingBottom: 8 },
  moreTitle: { fontSize: 17, fontWeight: '900', color: '#1a1a2e', paddingHorizontal: 16, marginBottom: 12 },
  moreScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  moreCard: { width: 130, borderRadius: 18, padding: 12, gap: 8, backgroundColor: '#F4F5FF' },
  moreCardIconWrap: { width: '100%', height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  moreCardImg: { width: '100%', height: '100%', borderRadius: 12 },
  moreCardTitle: { fontSize: 12, fontWeight: '800', color: '#1a1a2e', lineHeight: 17 },
  moreCardMeta: { fontSize: 10, fontWeight: '600' },
});
