import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  ChevronLeft, BookOpen, Play, Video as VideoIcon, Headphones,
  Image as ImageIcon, FileText, Film, Layers, ArrowRight,
  Hash, FlaskConical, Languages, Leaf, Monitor, Globe, GraduationCap,
  ListChecks, PlayCircle,
} from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';

import QuizRenderer from '../../src/components/quiz/QuizRenderer';
import { useAuth } from '../../src/context/AuthContext';
import { GIRAFFE, OWL, PANDA, PENGUIN, ELEPHANT, BUTTERFLY } from '../../src/assets/svgs';

const SCREEN_H = Dimensions.get('window').height;

// ── Types ─────────────────────────────────────────────────────────────────────
type ContentItem = {
  id: string;
  title: string;
  contentType: string;
  mediaUrl?: string;
  externalUrl?: string;
  textContent?: string;
  quizId?: string;
  sortOrder: number;
};

type TopicDetail = {
  id: string; classLevel: string; subject: string;
  title: string; coverImage?: string | null;
};

type SubjectTopic = {
  id: string; classLevel: string; subject: string;
  title: string; coverImage?: string | null; contentCount: number;
};

type LucideIcon = React.ComponentType<{ size?: number; color?: string; fill?: string }>;

// ── Helpers ───────────────────────────────────────────────────────────────────
const SUBJECT_STYLE: Record<string, { bg: string; accent: string; Icon: LucideIcon }> = {
  'Hindi Stories': { bg: '#FFF5E6', accent: '#FF8C00', Icon: Languages },
  'English':       { bg: '#E6F0FF', accent: '#4A90E2', Icon: BookOpen   },
  'Maths':         { bg: '#E6FAE6', accent: '#4CAF50', Icon: Hash       },
  'Science':       { bg: '#F0E6FF', accent: '#9B8EC4', Icon: FlaskConical },
  'Hindi':         { bg: '#FFF5E6', accent: '#FF8C00', Icon: Languages  },
  'EVS':           { bg: '#E6FAE6', accent: '#4CAF50', Icon: Leaf       },
  'GK':            { bg: '#FFF8E1', accent: '#E6A817', Icon: Globe      },
  'Computer':      { bg: '#E8F5FF', accent: '#1A88D4', Icon: Monitor    },
  'default':       { bg: '#F4F4FB', accent: '#9A9AB0', Icon: BookOpen   },
};
function subjectStyle(sub: string) { return SUBJECT_STYLE[sub] ?? SUBJECT_STYLE.default; }

type TypeCfg = { label: string; Icon: LucideIcon; accent: string; bg: string };
const TYPE_CONFIG: Record<string, TypeCfg> = {
  video:       { label: 'YouTube Video', Icon: Play,       accent: '#FF4444', bg: '#FFE8D6' },
  youtube_url: { label: 'YouTube Video', Icon: Play,       accent: '#FF4444', bg: '#FFE8D6' },
  reel_url:    { label: 'Reel',          Icon: Film,       accent: '#E91E8C', bg: '#FFE0F0' },
  reel:        { label: 'Reel',          Icon: Film,       accent: '#E91E8C', bg: '#FFE0F0' },
  audio:       { label: 'Audio',         Icon: Headphones, accent: '#9B8EC4', bg: '#EDE4FF' },
  image:       { label: 'Image',         Icon: ImageIcon,  accent: '#4A90E2', bg: '#D6EAFF' },
  text:        { label: 'Reading',       Icon: FileText,   accent: '#7DC67A', bg: '#D6F5D6' },
  document:    { label: 'Document',      Icon: FileText,   accent: '#4A90E2', bg: '#D6EAFF' },
};
const DEFAULT_TYPE: TypeCfg = { label: 'Content', Icon: Layers, accent: '#4A90E2', bg: '#D6EAFF' };
function typeCfg(t: string): TypeCfg { return TYPE_CONFIG[t] ?? DEFAULT_TYPE; }

function isYouTube(url: string) { return url.includes('youtube.com') || url.includes('youtu.be'); }

function embedUrl(url: string): string {
  const m = url.match(/(?:youtu\.be\/|watch\?v=|embed\/)([^&?/]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0&controls=1&autoplay=1` : url;
}

function thumbUrl(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|watch\?v=|embed\/)([^&?/]+)/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

const CARD_COLORS = ['#D6EAFF', '#FFE8D6', '#D6F5D6', '#EDE4FF', '#FFF5CC', '#FFE0F0'];

const SUBJECT_ANIMAL: Record<string, string> = {
  'Animals':       GIRAFFE,
  'Animals 1':     GIRAFFE,
  'Animals 2':     ELEPHANT,
  'English':       OWL,
  'Hindi Stories': PANDA,
  'Hindi':         PANDA,
  'Maths':         ELEPHANT,
  'Science':       BUTTERFLY,
  'EVS':           BUTTERFLY,
};
function subjectAnimal(sub: string): string { return SUBJECT_ANIMAL[sub] ?? PENGUIN; }

// ── Content Viewer (full-screen modal) ────────────────────────────────────────
function ContentViewer({
  contents, startIdx, topic, onClose,
}: {
  contents: ContentItem[];
  startIdx: number;
  topic: TopicDetail;
  onClose: () => void;
}) {
  const [curIdx, setCurIdx] = useState(startIdx);
  const [scrollY, setScrollY] = useState(0);
  const [quizModalQuizId, setQuizModalQuizId] = useState<string | null>(null);
  const sectionYs = useRef<Record<string, number>>({});

  const content = contents[curIdx];
  const hasPrev = curIdx > 0;
  const hasNext = curIdx < contents.length - 1;

  const goTo = (idx: number) => { sectionYs.current = {}; setCurIdx(idx); };

  const isInView = (key: string) => {
    const y = sectionYs.current[key] ?? -1;
    return y >= scrollY && y < scrollY + SCREEN_H * 0.9;
  };

  if (!content) return null;

  const cfg = typeCfg(content.contentType);
  const url = content.externalUrl ?? content.mediaUrl ?? '';
  const ytThumb = url ? thumbUrl(url) : null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={sv.screen}>
        {/* Header */}
        <View style={[sv.header, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
          <Pressable onPress={onClose} style={sv.backBtn}>
            <ChevronLeft size={22} color="#1a1a2e" />
          </Pressable>
          <View style={sv.headerMid}>
            <View style={[sv.typeBadge, { backgroundColor: `${cfg.accent}18` }]}>
              <cfg.Icon size={11} color={cfg.accent} />
              <Text style={[sv.typeBadgeText, { color: cfg.accent }]}>{cfg.label}</Text>
            </View>
            <Text style={sv.headerTitle} numberOfLines={1}>{content.title}</Text>
          </View>
          <View style={[sv.counter, { backgroundColor: `${cfg.accent}15` }]}>
            <Text style={[sv.counterTxt, { color: cfg.accent }]}>{curIdx + 1}/{contents.length}</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sv.scroll}
          scrollEventThrottle={100}
          onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        >
          {/* Hero card */}
          <View style={[sv.heroCard, { backgroundColor: cfg.bg }]}>
            <View style={sv.heroRow}>
              <View style={sv.heroLeft}>
                <Text style={sv.heroTitle}>{content.title}</Text>
                <Text style={sv.heroSub}>{topic.subject} · Class {topic.classLevel}</Text>
              </View>
              {ytThumb ? (
                <Image source={{ uri: ytThumb }} style={sv.heroThumb} resizeMode="cover" />
              ) : (
                <View style={[sv.heroIconBox, { backgroundColor: `${cfg.accent}20` }]}>
                  <cfg.Icon size={36} color={cfg.accent} />
                </View>
              )}
            </View>
            {/* Prev / Next nav */}
            <View style={sv.heroNav}>
              <Pressable style={[sv.heroNavBtn, !hasPrev && { opacity: 0.3 }]} disabled={!hasPrev} onPress={() => goTo(curIdx - 1)}>
                <ChevronLeft size={16} color="#5A5A7A" />
                <Text style={sv.heroNavArrow}>Prev</Text>
              </Pressable>
              <View style={[sv.heroNavDivider, { backgroundColor: `${cfg.accent}30` }]} />
              <Pressable style={[sv.heroNavBtn, !hasNext && { opacity: 0.3 }]} disabled={!hasNext} onPress={() => goTo(curIdx + 1)}>
                <Text style={sv.heroNavArrow}>Next</Text>
                <ChevronLeft size={16} color="#5A5A7A" style={{ transform: [{ scaleX: -1 }] }} />
              </Pressable>
            </View>
          </View>

          {/* Content */}
          <View
            style={sv.section}
            onLayout={(e) => { sectionYs.current[`s-${curIdx}`] = e.nativeEvent.layout.y; }}
          >
            {url && isYouTube(url) && (
              <View style={sv.videoWrap}>
                <View style={sv.videoFrame}>
                  {Platform.OS === 'web' ? (
                    // @ts-ignore
                    <iframe
                      src={embedUrl(url)}
                      style={{ width: '100%', height: '100%', border: 'none', borderRadius: 16 }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <WebView
                      source={{ uri: isInView(`s-${curIdx}`) ? embedUrl(url) : `https://www.youtube.com/embed/${url.match(/(?:youtu\.be\/|watch\?v=|embed\/)([^&?/]+)/)?.[1] ?? ''}?rel=0&controls=1` }}
                      style={{ flex: 1 }}
                      allowsFullscreenVideo
                      allowsInlineMediaPlayback
                      mediaPlaybackRequiresUserAction={false}
                      javaScriptEnabled
                    />
                  )}
                </View>
              </View>
            )}

            {url && !isYouTube(url) && url.match(/\.(jpg|jpeg|png|gif|webp|svg)/i) && (
              <View style={sv.imgWrap}>
                <Image source={{ uri: url }} style={sv.img} resizeMode="cover" />
              </View>
            )}

            {content.textContent && (
              <View style={sv.textBlock}>
                <Text style={sv.textBody}>{content.textContent}</Text>
              </View>
            )}

            {content.quizId && (
              <Pressable style={sv.quizCta} onPress={() => setQuizModalQuizId(content.quizId!)}>
                <View style={sv.quizCtaIcon}>
                  <ListChecks size={18} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sv.quizCtaTitle}>Quick Challenge</Text>
                  <Text style={sv.quizCtaSub}>Test what you learned in this section</Text>
                </View>
                <PlayCircle size={22} color="#7C3AED" />
              </Pressable>
            )}
          </View>

          {/* More in this topic */}
          {contents.length > 1 && (
            <View style={sv.moreWrap}>
              <Text style={sv.moreTitle}>More in {topic.title}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sv.moreScroll}>
                {contents.map((c, i) => {
                  const yt = c.externalUrl ? thumbUrl(c.externalUrl) : null;
                  const cc = typeCfg(c.contentType);
                  const active = i === curIdx;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => goTo(i)}
                      style={[sv.moreCard, active && { backgroundColor: cc.bg, borderColor: cc.accent, borderWidth: 2 }]}
                    >
                      <View style={[sv.moreCardIconWrap, { backgroundColor: active ? `${cc.accent}20` : '#F0F0F8' }]}>
                        {yt
                          ? <Image source={{ uri: yt }} style={sv.moreCardImg} resizeMode="cover" />
                          : <cc.Icon size={22} color={active ? cc.accent : '#9A9AB0'} />
                        }
                      </View>
                      <Text style={sv.moreCardTitle} numberOfLines={2}>{c.title}</Text>
                      <Text style={[sv.moreCardMeta, { color: active ? cc.accent : '#9A9AB0' }]}>
                        {cc.label} · {i + 1}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </View>

      {quizModalQuizId && (
        <QuizRenderer
          quizId={quizModalQuizId}
          visible={!!quizModalQuizId}
          onClose={() => setQuizModalQuizId(null)}
        />
      )}
    </Modal>
  );
}

// ── Topic Contents Screen ─────────────────────────────────────────────────────
function TopicScreen({ topic, onBack }: { topic: TopicDetail; onBack: () => void }) {
  const { apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  const ss = subjectStyle(topic.subject);

  useEffect(() => {
    apiFetch(`/students/subjects/${topic.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setContents(d.contents ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [topic.id, apiFetch]);

  return (
    <View style={sc.screen}>
      {/* Header */}
      <View style={[sc.topicHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 18 }]}>
        <Pressable onPress={onBack} style={sc.backBtn}>
          <ChevronLeft size={22} color="#1a1a2e" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={sc.topicHeaderTitle} numberOfLines={1}>{topic.title}</Text>
          <Text style={sc.topicHeaderSub}>{topic.subject} · Class {topic.classLevel}</Text>
        </View>
        <View style={[sc.lessonBadge, { backgroundColor: ss.accent + '22' }]}>
          <BookOpen size={13} color={ss.accent} />
          <Text style={[sc.lessonBadgeText, { color: ss.accent }]}>{contents.length} lesson{contents.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Subject accent bar */}
      <View style={[sc.accentBar, { backgroundColor: ss.accent }]} />

      {loading ? (
        <View style={sc.center}>
          <ActivityIndicator size="large" color={ss.accent} />
          <Text style={sc.loadingText}>Loading content…</Text>
        </View>
      ) : contents.length === 0 ? (
        <View style={sc.center}>
          <SvgXml xml={subjectAnimal(topic.subject)} width={110} height={110} />
          <Text style={sc.emptyTitle}>No lessons yet</Text>
          <Text style={sc.emptySub}>Your teacher hasn't added lessons to this topic yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={sc.contentScroll} showsVerticalScrollIndicator={false}>
          {/* Topic hero banner */}
          <View style={[sc.topicHero, { backgroundColor: ss.bg }]}>
            <View style={{ flex: 1 }}>
              <Text style={sc.topicHeroLabel}>{topic.subject}</Text>
              <Text style={sc.topicHeroTitle}>{topic.title}</Text>
              <Text style={[sc.topicHeroCount, { color: ss.accent }]}>
                {contents.length} lesson{contents.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <SvgXml xml={subjectAnimal(topic.subject)} width={90} height={90} />
          </View>

          {/* Lesson list */}
          <View style={sc.lessonList}>
            <Text style={sc.sectionLabel}>Lessons</Text>
            {contents.map((item, idx) => {
              const tc = typeCfg(item.contentType);
              const yt = item.externalUrl ? thumbUrl(item.externalUrl) : null;
              const cardBg = CARD_COLORS[idx % CARD_COLORS.length];

              return (
                <Pressable
                  key={item.id}
                  style={sc.lessonCard}
                  onPress={() => setViewerIdx(idx)}
                >
                  {/* Left: number badge */}
                  <View style={sc.lessonNumBadge}>
                    <Text style={sc.lessonNumText}>{idx + 1}</Text>
                  </View>

                  {/* Middle: info */}
                  <View style={sc.lessonInfo}>
                    <View style={[sc.typeChip, { backgroundColor: tc.bg }]}>
                      <tc.Icon size={10} color={tc.accent} />
                      <Text style={[sc.typeChipText, { color: tc.accent }]}>{tc.label}</Text>
                    </View>
                    <Text style={sc.lessonTitle} numberOfLines={2}>{item.title}</Text>
                    {item.textContent
                      ? <Text style={sc.lessonPreview} numberOfLines={1}>{item.textContent}</Text>
                      : null}
                  </View>

                  {/* Right: thumbnail or SVG */}
                  <View style={[sc.lessonThumbWrap, { backgroundColor: cardBg }]}>
                    {yt ? (
                      <Image source={{ uri: yt }} style={sc.lessonThumbImg} resizeMode="cover" />
                    ) : (
                      <SvgXml xml={subjectAnimal(topic.subject)} width={48} height={48} />
                    )}
                    {/* Play overlay */}
                    <View style={[sc.playOverlay, { backgroundColor: `${tc.accent}DD` }]}>
                      <tc.Icon size={14} color="#fff" />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {viewerIdx !== null && (
        <ContentViewer
          contents={contents}
          startIdx={viewerIdx}
          topic={topic}
          onClose={() => setViewerIdx(null)}
        />
      )}
    </View>
  );
}

// ── Subject List Screen ───────────────────────────────────────────────────────
export default function SubjectScreen() {
  const { apiFetch } = useAuth();
  const params = useLocalSearchParams<{ subject?: string }>();
  const filterSubject = params.subject;

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<{ subject: string; topics: SubjectTopic[] }[]>([]);
  const [classLevel, setClassLevel] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicDetail | null>(null);

  useEffect(() => {
    apiFetch('/students/subjects')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setClassLevel(d.classLevel); setSubjects(d.subjects ?? []); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiFetch]);

  if (selectedTopic) {
    return <TopicScreen topic={selectedTopic} onBack={() => setSelectedTopic(null)} />;
  }

  const displaySubjects = filterSubject ? subjects.filter((s) => s.subject === filterSubject) : subjects;
  const headerSubject = filterSubject ?? 'My Subjects';
  const hs = subjectStyle(filterSubject ?? 'default');

  return (
    <View style={sc.screen}>
      {/* Header */}
      <View style={[sc.header, { paddingTop: Platform.OS === 'ios' ? 52 : 18, backgroundColor: hs.accent }]}>
        <Pressable onPress={() => router.back()} style={sc.headerBackBtn}>
          <ChevronLeft size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={sc.headerTitle}>{headerSubject}</Text>
          {classLevel && <Text style={sc.headerSub}>Class {classLevel}</Text>}
        </View>
        <View style={[sc.headerIconBox, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <hs.Icon size={20} color="#fff" />
        </View>
      </View>

      {loading ? (
        <View style={sc.center}>
          <ActivityIndicator size="large" color={hs.accent} />
          <Text style={sc.loadingText}>Loading subjects…</Text>
        </View>
      ) : displaySubjects.length === 0 ? (
        <View style={sc.center}>
          <SvgXml xml={OWL} width={110} height={110} />
          <Text style={sc.emptyTitle}>No topics yet</Text>
          <Text style={sc.emptySub}>Your teacher hasn't added content for Class {classLevel} yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={sc.listScroll} showsVerticalScrollIndicator={false}>
          {displaySubjects.map(({ subject, topics }) => {
            const ss = subjectStyle(subject);
            return (
              <View key={subject}>
                {/* Subject group header (only shown when not filtered) */}
                {!filterSubject && (
                  <View style={sc.subjectGroupRow}>
                    <View style={[sc.subjectIconBox, { backgroundColor: ss.bg }]}>
                      <ss.Icon size={18} color={ss.accent} />
                    </View>
                    <Text style={sc.subjectName}>{subject}</Text>
                    <Text style={sc.subjectCount}>{topics.length} topic{topics.length !== 1 ? 's' : ''}</Text>
                  </View>
                )}

                {/* Topic cards */}
                {topics.map((topic, idx) => {
                  const bg = CARD_COLORS[idx % CARD_COLORS.length];
                  const openTopic = () => setSelectedTopic({
                    id: topic.id, classLevel: topic.classLevel,
                    subject: topic.subject, title: topic.title, coverImage: topic.coverImage,
                  });
                  return (
                    <Pressable key={topic.id} style={sc.topicCard} onPress={openTopic}>
                      <View style={sc.topicCardBody}>
                        <View style={sc.topicCardLeft}>
                          <View style={[sc.topicSubjectChip, { backgroundColor: ss.bg }]}>
                            <ss.Icon size={11} color={ss.accent} />
                            <Text style={[sc.topicSubjectChipText, { color: ss.accent }]}>{subject}</Text>
                          </View>
                          <Text style={sc.topicCardTitle} numberOfLines={2}>{topic.title}</Text>
                          <View style={sc.topicCardMeta}>
                            <BookOpen size={12} color="#9A9AB0" />
                            <Text style={sc.topicCardMetaText}>
                              {topic.contentCount} lesson{topic.contentCount !== 1 ? 's' : ''}
                            </Text>
                          </View>
                        </View>

                        {/* Thumbnail */}
                        <View style={[sc.topicThumbWrap, { backgroundColor: bg }]}>
                          {topic.coverImage ? (
                            <Image source={{ uri: topic.coverImage }} style={sc.topicThumbImg} resizeMode="cover" />
                          ) : (
                            <SvgXml xml={subjectAnimal(subject)} width={64} height={64} />
                          )}
                          {/* Small circle arrow */}
                          <View style={[sc.topicOpenCircle, { backgroundColor: ss.accent }]}>
                            <ArrowRight size={11} color="#fff" />
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ── Viewer Styles ─────────────────────────────────────────────────────────────
const sv = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
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

  section:   { marginHorizontal: 16, marginBottom: 16 },
  videoWrap: { borderRadius: 20, overflow: 'hidden', marginBottom: 4 },
  videoFrame:{ width: '100%', height: 230, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0a0a0a' },
  imgWrap:   { borderRadius: 20, overflow: 'hidden' },
  img:       { width: '100%', height: 220 },
  textBlock: { backgroundColor: '#F8F9FF', borderRadius: 16, padding: 20 },
  textBody:  { fontSize: 16, color: '#1a1a2e', lineHeight: 28, fontWeight: '500' },
  quizCta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: '#F5EFFE', borderWidth: 1, borderColor: '#E5D9F8', marginTop: 14 },
  quizCtaIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFE7FB', alignItems: 'center', justifyContent: 'center' },
  quizCtaTitle: { fontSize: 14, fontWeight: '900', color: '#5B21B6' },
  quizCtaSub: { fontSize: 11, color: '#7C3AED', marginTop: 2, fontWeight: '600' },

  moreWrap:        { marginTop: 8, paddingBottom: 8 },
  moreTitle:       { fontSize: 17, fontWeight: '900', color: '#1a1a2e', paddingHorizontal: 16, marginBottom: 12 },
  moreScroll:      { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  moreCard:        { width: 130, borderRadius: 18, padding: 12, gap: 8, backgroundColor: '#F4F5FF' },
  moreCardIconWrap:{ width: '100%', height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  moreCardImg:     { width: '100%', height: '100%', borderRadius: 12 },
  moreCardTitle:   { fontSize: 12, fontWeight: '800', color: '#1a1a2e', lineHeight: 17 },
  moreCardMeta:    { fontSize: 10, fontWeight: '600' },
});

// ── Screen Styles ─────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: '#F5F7FF' },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  loadingText:{ fontSize: 13, color: '#9A9AB0', fontWeight: '600', marginTop: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptySub:   { fontSize: 13, color: '#9A9AB0', textAlign: 'center', lineHeight: 20, maxWidth: 260 },

  // Subject list header
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  headerBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSub:     { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 2 },
  headerIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Topic screen header
  topicHeader:    { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F8', flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicHeaderTitle:{ fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  topicHeaderSub: { fontSize: 12, color: '#9A9AB0', fontWeight: '600', marginTop: 2 },
  backBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F4F5FF', alignItems: 'center', justifyContent: 'center' },
  lessonBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  lessonBadgeText:{ fontSize: 11, fontWeight: '800' },
  accentBar:      { height: 3, width: '100%' },

  // Topic hero
  topicHero:       { flexDirection: 'row', alignItems: 'center', margin: 16, borderRadius: 20, padding: 18, gap: 12 },
  topicHeroLabel:  { fontSize: 10, fontWeight: '800', color: '#7A7A9A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  topicHeroTitle:  { fontSize: 18, fontWeight: '900', color: '#1a1a2e', lineHeight: 24, marginBottom: 6 },
  topicHeroCount:  { fontSize: 12, fontWeight: '800' },

  // Lesson list
  contentScroll: { paddingBottom: 48 },
  lessonList:    { paddingHorizontal: 16 },
  sectionLabel:  { fontSize: 11, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },

  lessonCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12,
    shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  lessonNumBadge: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#F0F0F8', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lessonNumText:  { fontSize: 12, fontWeight: '900', color: '#5A6A8A' },
  lessonInfo:     { flex: 1, gap: 5 },
  typeChip:       { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  typeChipText:   { fontSize: 10, fontWeight: '800' },
  lessonTitle:    { fontSize: 14, fontWeight: '800', color: '#1a1a2e', lineHeight: 20 },
  lessonPreview:  { fontSize: 11, color: '#9A9AB0', fontWeight: '500' },

  lessonThumbWrap: { width: 70, height: 70, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, position: 'relative' },
  lessonThumbImg:  { width: '100%', height: '100%' },
  playOverlay:     { position: 'absolute', bottom: 5, right: 5, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Subject list scroll
  listScroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },

  subjectGroupRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 12 },
  subjectIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  subjectName:    { fontSize: 17, fontWeight: '900', color: '#1a1a2e', flex: 1 },
  subjectCount:   { fontSize: 12, fontWeight: '700', color: '#9A9AB0' },

  topicCard: {
    backgroundColor: '#fff', borderRadius: 20, marginBottom: 14,
    shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  topicCardBody:    { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  topicCardLeft:    { flex: 1, gap: 6 },
  topicSubjectChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  topicSubjectChipText: { fontSize: 10, fontWeight: '800' },
  topicCardTitle:   { fontSize: 15, fontWeight: '800', color: '#1a1a2e', lineHeight: 21 },
  topicCardMeta:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topicCardMetaText:{ fontSize: 12, color: '#9A9AB0', fontWeight: '600' },
  topicThumbWrap:   { width: 80, height: 80, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'visible', flexShrink: 0, position: 'relative' },
  topicThumbImg:    { width: 80, height: 80, borderRadius: 14 },
  topicOpenCircle:  { position: 'absolute', bottom: -6, right: -6, width: 26, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 3 },
});
