import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ModalHeader } from '../../src/components/common/ModalHeader';
import {
  ActivityIndicator, Dimensions, Image, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  ChevronLeft, ChevronRight, BookOpen, Play, Video as VideoIcon, Headphones,
  Image as ImageIcon, FileText, Film, Layers, ArrowRight, Sparkles,
  Hash, FlaskConical, Languages, Leaf, Monitor, Globe, GraduationCap,
  Link2, UploadCloud,
} from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';

import QuizRenderer from '../../src/components/quiz/QuizRenderer';
import PlayQuizCTA from '../../src/components/quiz/PlayQuizCTA';
import { useAuth } from '../../src/context/AuthContext';
import { GIRAFFE, OWL, PANDA, PENGUIN, ELEPHANT, BUTTERFLY } from '../../src/assets/svgs';
import StudentContentViewer from '../../src/components/subject/StudentContentViewer';

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
  'Creativity':            { bg: '#FFF7ED', accent: '#EA580C', Icon: Sparkles },
  'Dharm':                 { bg: '#FAF5FF', accent: '#7C3AED', Icon: Sparkles },
  'DIY & Crafts':          { bg: '#ECFDF5', accent: '#059669', Icon: Layers },
  'Do You Know?':          { bg: '#FFFBEB', accent: '#D97706', Icon: Globe },
  'Environmental Studies': { bg: '#ECFDF5', accent: '#059669', Icon: Leaf },
  'General Knowledge':     { bg: '#EFF6FF', accent: '#2563EB', Icon: Globe },
  'How Things Work':       { bg: '#F5F3FF', accent: '#7C3AED', Icon: FlaskConical },
  'Moral Values':          { bg: '#FFF1F2', accent: '#E11D48', Icon: BookOpen },
  'Puzzles & Logic':       { bg: '#FFF7ED', accent: '#EA580C', Icon: Hash },
  'Rhymes & Stories':      { bg: '#ECFDF5', accent: '#0D9488', Icon: BookOpen },
  'Stories & Tales':       { bg: '#FAF5FF', accent: '#9333EA', Icon: BookOpen },
  'Tips and Tricks':       { bg: '#EFF6FF', accent: '#1D4ED8', Icon: Sparkles },
  'Hindi Stories':         { bg: '#FFF5E6', accent: '#FF8C00', Icon: Languages },
  'English':               { bg: '#E6F0FF', accent: '#2D5DC9', Icon: BookOpen },
  'Maths':                 { bg: '#E6FAE6', accent: '#4CAF50', Icon: Hash },
  'Science':               { bg: '#F0E6FF', accent: '#554E6C', Icon: FlaskConical },
  'Hindi':                 { bg: '#FFF5E6', accent: '#FF8C00', Icon: Languages },
  'EVS':                   { bg: '#ECFDF5', accent: '#059669', Icon: Leaf },
  'GK':                    { bg: '#FFF8E1', accent: '#8F680C', Icon: Globe },
  'Computer':              { bg: '#E8F5FF', accent: '#1A88D4', Icon: Monitor },
  'default':               { bg: '#F4F4FB', accent: '#2563EB', Icon: BookOpen },
};
function subjectStyle(sub: string) { return SUBJECT_STYLE[sub] ?? SUBJECT_STYLE.default; }

type TypeCfg = { label: string; Icon: LucideIcon; accent: string; bg: string };
const TYPE_CONFIG: Record<string, TypeCfg> = {
  links:       { label: 'Links',         Icon: Link2,       accent: '#0284C7', bg: '#E0F2FE' },
  file_upload: { label: 'File',          Icon: UploadCloud, accent: '#2D5DC9', bg: '#D6EAFF' },
  text:        { label: 'Text',          Icon: BookOpen,    accent: '#16A34A', bg: '#DCFCE7' },
  video:       { label: 'Video',         Icon: Play,        accent: '#0284C7', bg: '#E0F2FE' },
  youtube_url: { label: 'YouTube Video', Icon: Play,        accent: '#0284C7', bg: '#E0F2FE' },
  reel_url:    { label: 'Reel',          Icon: Film,        accent: '#0284C7', bg: '#E0F2FE' },
  reel:        { label: 'Reel',          Icon: Film,        accent: '#0284C7', bg: '#E0F2FE' },
  audio:       { label: 'Audio',         Icon: Headphones,  accent: '#554E6C', bg: '#EDE4FF' },
  image:       { label: 'File',          Icon: ImageIcon,   accent: '#2D5DC9', bg: '#D6EAFF' },
  document:    { label: 'Document',      Icon: FileText,    accent: '#2D5DC9', bg: '#D6EAFF' },
};
const DEFAULT_TYPE: TypeCfg = { label: 'Content', Icon: Layers, accent: '#2D5DC9', bg: '#D6EAFF' };
function typeCfg(t: string): TypeCfg { return TYPE_CONFIG[t] ?? DEFAULT_TYPE; }

function isYouTube(url: string) { return url.includes('youtube.com') || url.includes('youtu.be'); }

function embedUrl(url: string): string {
  const m = url.match(/(?:youtu\.be\/|watch\?v=|embed\/)([^&?/]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0&controls=1` : url;
}

function thumbUrl(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|watch\?v=|embed\/)([^&?/]+)/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

const CARD_COLORS = ['#D6EAFF', '#FFE8D6', '#D6F5D6', '#EDE4FF', '#FFF5CC', '#FFE0F0'];

const SUBJECT_ANIMAL: Record<string, string> = {
  'Creativity':    GIRAFFE,
  'Dharm':         BUTTERFLY,
  'DIY & Crafts':  OWL,
  'Do You Know?':  ELEPHANT,
  'Moral Values':  PANDA,
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
function subjectAnimal(sub: string): string { return SUBJECT_ANIMAL[sub] ?? GIRAFFE; }

// ── Content Viewer (full-screen modal) ────────────────────────────────────────
function ContentViewer({
  contents, startIdx, topic, onClose,
}: {
  contents: ContentItem[];
  startIdx: number;
  topic: TopicDetail;
  onClose: () => void;
}) {
  return (
    <StudentContentViewer
      visible
      contents={contents}
      startIdx={startIdx}
      topic={topic}
      onClose={onClose}
    />
  );
}

// ── Pagination Helper ────────────────────────────────────────────────────────
function renderPaginationBar(
  currentPage: number,
  totalItems: number,
  pageSize: number,
  onPageChange: (newPage: number) => void,
  accentColor: string = '#2D5DC9',
) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;
  const startItem = currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalItems);

  return (
    <View style={sc.paginationRow}>
      <Pressable
        style={[sc.paginationButton, currentPage === 0 && sc.paginationButtonDisabled]}
        onPress={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
      >
        <ChevronLeft size={16} color={currentPage === 0 ? '#94A3B8' : accentColor} />
        <Text style={[sc.paginationButtonText, currentPage === 0 && sc.paginationButtonTextDisabled]}>
          Previous
        </Text>
      </Pressable>

      <Text style={sc.paginationText}>
        Page {currentPage + 1} of {totalPages}{' '}
        <Text style={sc.paginationSubText}>({startItem}–{endItem} of {totalItems})</Text>
      </Text>

      <Pressable
        style={[sc.paginationButton, currentPage >= totalPages - 1 && sc.paginationButtonDisabled]}
        onPress={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages - 1}
      >
        <Text style={[sc.paginationButtonText, currentPage >= totalPages - 1 && sc.paginationButtonTextDisabled]}>
          Next
        </Text>
        <ChevronRight size={16} color={currentPage >= totalPages - 1 ? '#94A3B8' : accentColor} />
      </Pressable>
    </View>
  );
}

// ── Topic Contents Screen ─────────────────────────────────────────────────────
function TopicScreen({ topic, onBack }: { topic: TopicDetail; onBack: () => void }) {
  const { apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [lessonPage, setLessonPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 640 && windowWidth < 1024;

  const ss = subjectStyle(topic.subject);
  const LESSON_PAGE_SIZE = 12;
  const paginatedContents = contents.slice(lessonPage * LESSON_PAGE_SIZE, (lessonPage + 1) * LESSON_PAGE_SIZE);

  useEffect(() => {
    setLessonPage(0);
    apiFetch(`/students/subjects/${topic.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setContents(d.contents ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [topic.id, apiFetch]);

  return (
    <View style={sc.screen}>
      {/* Header */}
      <ModalHeader
        tone={ss.accent}
        titleColor="#fff"
        borderless
        style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}
        left={
          <Pressable onPress={onBack} style={sc.headerBackBtn}>
            <ChevronLeft size={22} color="#fff" />
          </Pressable>
        }
        center={
          <View style={{ flex: 1 }}>
            <Text style={sc.headerTitle} numberOfLines={1} accessibilityRole="header">{topic.title}</Text>
            <Text style={sc.headerSub}>{topic.subject} · Class {topic.classLevel}</Text>
          </View>
        }
        right={
          <View style={[sc.lessonBadge, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
            <BookOpen size={13} color="#fff" />
            <Text style={[sc.lessonBadgeText, { color: '#fff' }]}>{contents.length} lesson{contents.length !== 1 ? 's' : ''}</Text>
          </View>
        }
      />

      {loading ? (
        <View style={sc.center}>
          <ActivityIndicator accessibilityLabel="Loading" size="large" color={ss.accent} />
          <Text style={sc.loadingText}>Loading content…</Text>
        </View>
      ) : contents.length === 0 ? (
        <View style={sc.center}>
          <SvgXml xml={subjectAnimal(topic.subject)} width={110} height={110} />
          <Text style={sc.emptyTitle}>No lessons yet</Text>
          <Text style={sc.emptySub}>Your teacher hasn't added lessons to this topic yet.</Text>
        </View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={sc.contentScroll} showsVerticalScrollIndicator={false}>
          <View style={sc.mainContainer}>
            {/* Topic hero banner */}
            <View style={[sc.topicHero, { backgroundColor: ss.bg, borderColor: `${ss.accent}30` }]}>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={[sc.topicSubjectChip, { backgroundColor: `${ss.accent}20` }]}>
                  <ss.Icon size={12} color={ss.accent} />
                  <Text style={[sc.topicSubjectChipText, { color: ss.accent }]}>{topic.subject}</Text>
                </View>
                <Text style={sc.topicHeroTitle}>{topic.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[sc.lessonBadge, { backgroundColor: '#fff', borderColor: `${ss.accent}40`, borderWidth: 1 }]}>
                    <BookOpen size={13} color={ss.accent} />
                    <Text style={[sc.lessonBadgeText, { color: ss.accent }]}>
                      {contents.length} lesson{contents.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={sc.topicHeroSub}>Class {topic.classLevel}</Text>
                </View>
              </View>
              <View style={[sc.topicHeroAnimalCircle, { backgroundColor: `${ss.accent}15` }]}>
                <SvgXml xml={subjectAnimal(topic.subject)} width={84} height={84} />
              </View>
            </View>

            {/* Lesson list */}
            <View style={sc.lessonSection}>
              <View style={sc.sectionHeaderRow}>
                <View style={sc.sectionTitleRow}>
                  <Layers size={18} color={ss.accent} />
                  <Text style={sc.sectionLabel}>Topic Lessons</Text>
                </View>
                <Text style={sc.sectionCountText}>
                  Showing {paginatedContents.length} of {contents.length}
                </Text>
              </View>

              <View style={isDesktop ? sc.lessonGridDesktop : isTablet ? sc.lessonGridTablet : sc.lessonGridMobile}>
                {paginatedContents.map((item, idx) => {
                  const globalIdx = lessonPage * LESSON_PAGE_SIZE + idx;
                  const tc = typeCfg(item.contentType);
                  const yt = item.externalUrl ? thumbUrl(item.externalUrl) : null;
                  const cardBg = CARD_COLORS[globalIdx % CARD_COLORS.length];

                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        sc.lessonCard,
                        isDesktop ? sc.lessonCardDesktop : isTablet ? sc.lessonCardTablet : sc.lessonCardMobile,
                      ]}
                      onPress={() => setViewerIdx(globalIdx)}
                    >
                      {/* Left: number badge */}
                      <View style={[sc.lessonNumBadge, { backgroundColor: `${tc.accent}15` }]}>
                        <Text style={[sc.lessonNumText, { color: tc.accent }]}>{globalIdx + 1}</Text>
                      </View>

                      {/* Middle: info */}
                      <View style={sc.lessonInfo}>
                        <View style={[sc.typeChip, { backgroundColor: tc.bg }]}>
                          <tc.Icon size={10} color={tc.accent} />
                          <Text style={[sc.typeChipText, { color: tc.accent }]}>{tc.label}</Text>
                        </View>
                        <Text style={sc.lessonTitle} numberOfLines={2}>{item.title}</Text>
                        {item.textContent ? (
                          <Text style={sc.lessonPreview} numberOfLines={1}>{item.textContent}</Text>
                        ) : null}
                      </View>

                      {/* Right: thumbnail or SVG */}
                      <View style={[sc.lessonThumbWrap, { backgroundColor: cardBg }]}>
                        {yt ? (
                          <Image source={{ uri: yt }} style={sc.lessonThumbImg} resizeMode="cover" />
                        ) : (
                          <SvgXml xml={subjectAnimal(topic.subject)} width={48} height={48} />
                        )}
                        {/* Play overlay */}
                        <View style={[sc.playOverlay, { backgroundColor: `${tc.accent}EE` }]}>
                          <Play size={11} color="#fff" fill="#fff" />
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Pagination Bar */}
              {renderPaginationBar(
                lessonPage,
                contents.length,
                LESSON_PAGE_SIZE,
                (newPage) => {
                  setLessonPage(newPage);
                  scrollRef.current?.scrollTo({ y: 0, animated: true });
                },
                ss.accent,
              )}
            </View>
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
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 640 && windowWidth < 1024;

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<{ subject: string; topics: SubjectTopic[] }[]>([]);
  const [classLevel, setClassLevel] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicDetail | null>(null);

  const [topicPages, setTopicPages] = useState<Record<string, number>>({});
  const TOPIC_PAGE_SIZE = 12;

  useEffect(() => {
    apiFetch('/students/subjects')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setClassLevel(d.classLevel); setSubjects(d.subjects ?? []); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiFetch]);

  useEffect(() => {
    setSelectedTopic(null);
  }, [filterSubject]);

  if (selectedTopic) {
    return <TopicScreen topic={selectedTopic} onBack={() => setSelectedTopic(null)} />;
  }

  const displaySubjects = filterSubject ? subjects.filter((s) => s.subject === filterSubject) : subjects;
  const headerSubject = filterSubject ?? 'My Subjects';
  const hs = subjectStyle(filterSubject ?? 'default');

  return (
    <View style={sc.screen}>
      {/* Header */}
      <ModalHeader
        tone={hs.accent}
        titleColor="#fff"
        borderless
        style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}
        left={
          <Pressable onPress={() => router.back()} style={sc.headerBackBtn}>
            <ChevronLeft size={22} color="#fff" />
          </Pressable>
        }
        center={
          <View style={{ flex: 1 }}>
            <Text style={sc.headerTitle} accessibilityRole="header">{headerSubject}</Text>
            {classLevel && <Text style={sc.headerSub}>Class {classLevel}</Text>}
          </View>
        }
        right={
          <View style={[sc.headerIconBox, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
            <hs.Icon size={20} color="#fff" />
          </View>
        }
      />

      {loading ? (
        <View style={sc.center}>
          <ActivityIndicator accessibilityLabel="Loading" size="large" color={hs.accent} />
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
          <View style={sc.mainContainer}>
            {displaySubjects.map(({ subject, topics }) => {
              const ss = subjectStyle(subject);
              const curTopicPage = topicPages[subject] || 0;
              const paginatedTopics = topics.slice(curTopicPage * TOPIC_PAGE_SIZE, (curTopicPage + 1) * TOPIC_PAGE_SIZE);

              return (
                <View key={subject} style={sc.subjectGroupWrap}>
                  {/* Subject group header (only shown when not filtered) */}
                  {!filterSubject && (
                    <View style={sc.subjectGroupRow}>
                      <View style={[sc.subjectIconBox, { backgroundColor: ss.bg }]}>
                        <ss.Icon size={18} color={ss.accent} />
                      </View>
                      <Text style={sc.subjectName}>{subject}</Text>
                      <View style={[sc.subjectCountBadge, { backgroundColor: `${ss.accent}15` }]}>
                        <Text style={[sc.subjectCount, { color: ss.accent }]}>
                          {topics.length} topic{topics.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Responsive Topic cards grid */}
                  <View style={isDesktop ? sc.topicGridDesktop : isTablet ? sc.topicGridTablet : sc.topicGridMobile}>
                    {paginatedTopics.map((topic, idx) => {
                      const globalIdx = curTopicPage * TOPIC_PAGE_SIZE + idx;
                      const bg = CARD_COLORS[globalIdx % CARD_COLORS.length];
                      const openTopic = () => setSelectedTopic({
                        id: topic.id, classLevel: topic.classLevel,
                        subject: topic.subject, title: topic.title, coverImage: topic.coverImage,
                      });
                      return (
                        <Pressable
                          key={topic.id}
                          style={[
                            sc.topicCard,
                            isDesktop ? sc.topicCardDesktop : isTablet ? sc.topicCardTablet : sc.topicCardMobile,
                          ]}
                          onPress={openTopic}
                        >
                          <View style={sc.topicCardBody}>
                            <View style={sc.topicCardLeft}>
                              <View style={[sc.topicSubjectChip, { backgroundColor: `${ss.accent}15` }]}>
                                <ss.Icon size={11} color={ss.accent} />
                                <Text style={[sc.topicSubjectChipText, { color: ss.accent }]}>{subject}</Text>
                              </View>
                              <Text style={sc.topicCardTitle} numberOfLines={2}>{topic.title}</Text>
                              <View style={sc.topicCardMeta}>
                                <BookOpen size={12} color="#64748B" />
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
                                <SvgXml xml={subjectAnimal(subject)} width={58} height={58} />
                              )}
                              {/* Small circle arrow */}
                              <View style={[sc.topicOpenCircle, { backgroundColor: ss.accent }]}>
                                <ArrowRight size={12} color="#fff" />
                              </View>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Pagination Bar for Topics */}
                  {renderPaginationBar(
                    curTopicPage,
                    topics.length,
                    TOPIC_PAGE_SIZE,
                    (newPage) => setTopicPages((prev) => ({ ...prev, [subject]: newPage })),
                    ss.accent,
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── Screen Styles ─────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F4FF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  loadingText: { fontSize: 13, color: '#525C6B', fontWeight: '600', marginTop: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#525C6B', textAlign: 'center', lineHeight: 20, maxWidth: 260 },

  mainContainer: {
    maxWidth: 1440,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
  },

  // Subject list header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  headerBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: '#fff', fontWeight: '600', marginTop: 2 },
  headerIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Topic screen header
  topicHeader: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F8', flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicHeaderTitle: { fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  topicHeaderSub: { fontSize: 12, color: '#525C6B', fontWeight: '600', marginTop: 2 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F4F5FF', alignItems: 'center', justifyContent: 'center' },
  lessonBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  lessonBadgeText: { fontSize: 11, fontWeight: '800' },
  accentBar: { height: 3, width: '100%' },

  // Topic hero
  topicHero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    borderRadius: 22,
    padding: 20,
    gap: 16,
    borderWidth: 1.5,
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  topicHeroTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', lineHeight: 28 },
  topicHeroSub: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  topicHeroAnimalCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Lesson list
  contentScroll: { paddingBottom: 48 },
  lessonSection: { marginTop: 8 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  sectionCountText: { fontSize: 12, fontWeight: '700', color: '#64748B' },

  lessonGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  lessonGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  lessonGridMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  lessonCardDesktop: {
    flexBasis: '48.5%',
    maxWidth: '49.2%',
    flexGrow: 1,
  },
  lessonCardTablet: {
    flexBasis: '48%',
    maxWidth: '49%',
    flexGrow: 1,
  },
  lessonCardMobile: {
    width: '100%',
  },
  lessonNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  lessonNumText: { fontSize: 13, fontWeight: '900' },
  lessonInfo: { flex: 1, gap: 4 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeChipText: { fontSize: 10, fontWeight: '800' },
  lessonTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', lineHeight: 20 },
  lessonPreview: { fontSize: 12, color: '#64748B', fontWeight: '500' },

  lessonThumbWrap: {
    width: 76,
    height: 76,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
  },
  lessonThumbImg: { width: '100%', height: '100%' },
  playOverlay: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Subject list scroll
  listScroll: { paddingVertical: 16, paddingBottom: 48 },
  subjectGroupWrap: { marginBottom: 20 },
  subjectGroupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 14 },
  subjectIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  subjectName: { fontSize: 18, fontWeight: '900', color: '#0F172A', flex: 1 },
  subjectCountBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  subjectCount: { fontSize: 11, fontWeight: '800' },

  topicGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  topicGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  topicGridMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  topicCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  topicCardDesktop: {
    flexBasis: '31.8%',
    maxWidth: '32.5%',
    flexGrow: 1,
  },
  topicCardTablet: {
    flexBasis: '48%',
    maxWidth: '49%',
    flexGrow: 1,
  },
  topicCardMobile: {
    width: '100%',
  },
  topicCardBody: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  topicCardLeft: { flex: 1, gap: 6 },
  topicSubjectChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  topicSubjectChipText: { fontSize: 10, fontWeight: '800' },
  topicCardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', lineHeight: 22 },
  topicCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  topicCardMetaText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  topicThumbWrap: { width: 80, height: 80, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'visible', flexShrink: 0, position: 'relative' },
  topicThumbImg: { width: 80, height: 80, borderRadius: 16 },
  topicOpenCircle: { position: 'absolute', bottom: -6, right: -6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 },

  /* ── Pagination ── */
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    marginTop: 20,
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    flexWrap: 'wrap',
    gap: 8,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D6E8FF',
  },
  paginationButtonDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E8ECF4',
  },
  paginationButtonText: {
    fontSize: 13,
    color: '#2D5DC9',
    fontWeight: '700',
  },
  paginationButtonTextDisabled: {
    color: '#94A3B8',
  },
  paginationText: {
    fontSize: 13,
    color: '#1a1a2e',
    fontWeight: '700',
  },
  paginationSubText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
