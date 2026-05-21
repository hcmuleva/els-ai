import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Bell, Star, Users, BookOpen, TrendingUp, Calendar, ChevronRight } from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import QuizRenderer from '../../src/components/quiz/QuizRenderer';

// ── Parent types ──────────────────────────────────────────────────────────────
type ChildInfo = {
  id: string; firstName: string; lastName: string;
  classLevel?: string; completionPct?: number;
};

// ── Types ─────────────────────────────────────────────────────────────────────
type Classroom = {
  id: string; title: string; classLevel: string;
  completionPct: number; status: string;
  contents: Array<{
    id: string; title: string; subject?: string; contentType?: string;
  }>;
  quizzes: Array<{
    id: string; title: string; totalQuestions: number;
    difficultyLevel?: string; status: string;
  }>;
  assignments: Array<{ id: string; status: string }>;
};

// ── Static config ─────────────────────────────────────────────────────────────
const SUBJECTS = [
  { label: 'Numbers',   emoji: '🦊', bg: '#FFE8D6', iconBg: '#FFD4B5' },
  { label: 'Alphabets', emoji: '🐧', bg: '#D6EAFF', iconBg: '#B5D4FF' },
  { label: 'Animals',   emoji: '🐾', bg: '#D6F5D6', iconBg: '#B2E5B2' },
  { label: 'Colors',    emoji: '🎨', bg: '#EDE4FF', iconBg: '#D9CCFF' },
];

const QUIZ_ICONS  = ['🧩', '⚡', '🔮', '🎯'];
const QUIZ_BG     = ['#FFE8D6', '#EDE4FF', '#D6F5D6', '#D6EAFF'];
const STORY_EMOJI = ['🦕', '🦁', '🐢', '🦒', '🌟'];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user, apiFetch } = useAuth();
  const role = user?.activeRole ?? 'student';

  const [loading, setLoading]               = useState(true);
  const [classroom, setClassroom]           = useState<Classroom | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [children, setChildren]             = useState<ChildInfo[]>([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    if (role === 'teacher') return;
    if (role === 'admin' || role === 'superadmin') return;
    setLoading(true);
    try {
      if (role === 'student') {
        const res = await apiFetch('/quizzes/students/classrooms');
        if (res.ok) {
          const payload = await res.json();
          const rooms   = (payload.classrooms ?? []) as Classroom[];
          setClassroom(rooms.find((r) => r.status === 'active') ?? rooms[0] ?? null);
        }
      } else if (role === 'parent') {
        // Try to fetch parent's linked children
        const res = await apiFetch(`/users/${user.id}`);
        if (res.ok) {
          const profile = await res.json();
          const linked = (profile.students ?? []) as ChildInfo[];
          setChildren(linked);
        }
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [apiFetch, user, role]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // All hooks must be called before any conditional return
  const pending  = useMemo(() => classroom?.assignments.filter((a) => a.status !== 'submitted').length ?? 0, [classroom]);
  const xp       = Math.round((classroom?.completionPct ?? 0) * 15);
  const featured = classroom?.contents?.[0] ?? null;
  const quizzes  = classroom?.quizzes?.slice(0, 4) ?? [];

  // ── Role-based redirects ──────────────────────────────────────────────────
  if (role === 'teacher') return <Redirect href="/(tabs)/planner" />;
  if (role === 'admin' || role === 'superadmin') return <Redirect href="/(tabs)/admin" />;

  // ── Parent view ───────────────────────────────────────────────────────────
  if (role === 'parent') {
    return (
      <View style={s.screen}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* Top bar */}
          <View style={[s.topBar, { paddingTop: Platform.OS === 'ios' ? 2 : 8 }]}>
            <View>
              <Text style={s.greetingSub}>Hello,</Text>
              <Text style={s.greetingName}>{user?.firstName ?? 'Parent'} 👋</Text>
            </View>
            <Pressable style={s.bellWrap}>
              <Bell size={15} color="#1a1a2e" />
            </Pressable>
          </View>

          {/* Hero banner */}
          <View style={[s.heroBanner, { backgroundColor: '#9B8EC4' }]}>
            <View style={s.heroLeft}>
              <Text style={s.heroSub}>Parent Dashboard</Text>
              <Text style={s.heroTitle}>Track your child's learning journey</Text>
              <Pressable style={[s.heroBtn, { backgroundColor: 'rgba(255,255,255,0.25)' }]} onPress={() => router.push('/(tabs)/reports')}>
                <Text style={s.heroBtnText}>View Reports ›</Text>
              </Pressable>
            </View>
            <View style={[s.heroAvatar, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <Text style={{ fontSize: 28 }}>👨‍👩‍👧</Text>
            </View>
          </View>

          {/* Children section */}
          <View style={s.rowHeader}>
            <Text style={s.rowTitle}>My Children</Text>
            <Pressable onPress={() => router.push('/(tabs)/reports')}>
              <Text style={s.rowLink}>See Reports</Text>
            </Pressable>
          </View>
          {loading ? (
            <View style={s.loadingBlock}>
              <ActivityIndicator color="#9B8EC4" />
            </View>
          ) : children.length === 0 ? (
            <View style={s.emptyBlock}>
              <Text style={{ fontSize: 40, textAlign: 'center' }}>👧</Text>
              <Text style={s.emptyTitle}>No children linked yet</Text>
              <Text style={s.emptyBody}>Ask your school admin to link your account to your child's profile.</Text>
            </View>
          ) : (
            children.map((child) => (
              <Pressable
                key={child.id}
                style={s.childCard}
                onPress={() => router.push('/(tabs)/reports')}
              >
                <View style={s.childAvatar}>
                  <Text style={{ fontSize: 24 }}>🧒</Text>
                </View>
                <View style={s.childInfo}>
                  <Text style={s.childName}>{child.firstName} {child.lastName}</Text>
                  <Text style={s.childMeta}>{child.classLevel ? `Class ${child.classLevel}` : 'No class assigned'}</Text>
                  {child.completionPct !== undefined && (
                    <View style={s.childProgressWrap}>
                      <View style={s.childProgressTrack}>
                        <View style={[s.childProgressFill, { width: `${child.completionPct}%` }]} />
                      </View>
                      <Text style={s.childProgressPct}>{child.completionPct}%</Text>
                    </View>
                  )}
                </View>
                <ChevronRight size={16} color="#9A9AB0" />
              </Pressable>
            ))
          )}

          {/* Quick actions */}
          <View style={s.rowHeader}>
            <Text style={s.rowTitle}>Quick Actions</Text>
          </View>
          <View style={s.quickActionsGrid}>
            {[
              { label: 'Reports',    emoji: '📊', color: '#D6EAFF', textColor: '#1A4DA2', route: '/(tabs)/reports' as const },
              { label: 'Classroom',  emoji: '📚', color: '#FFE8D6', textColor: '#B04A1A', route: '/(tabs)/reports' as const },
              { label: 'Progress',   emoji: '📈', color: '#D6F5D6', textColor: '#1A6B1A', route: '/(tabs)/reports' as const },
              { label: 'Schedule',   emoji: '📅', color: '#EDE4FF', textColor: '#5A3A9A', route: '/(tabs)/reports' as const },
            ].map((qa) => (
              <Pressable key={qa.label} style={[s.quickActionTile, { backgroundColor: qa.color }]} onPress={() => router.push(qa.route)}>
                <Text style={{ fontSize: 28 }}>{qa.emoji}</Text>
                <Text style={[s.quickActionLabel, { color: qa.textColor }]}>{qa.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ─── TOP BAR ─────────────────────────────────────────────────── */}
        <View style={[s.topBar, { paddingTop: Platform.OS === 'ios' ? 2 : 8 }]}>
          <View>
            <Text style={s.greetingSub}>Hello Little</Text>
            <Text style={s.greetingName}>{user?.firstName ?? 'Learner'} 👋</Text>
          </View>
          <View style={s.topActions}>
            <View style={s.xpChip}>
              <Star size={12} color="#F5C842" fill="#F5C842" />
              <Text style={s.xpLabel}>{xp > 0 ? xp.toLocaleString() : '1,200'}</Text>
            </View>
            <Pressable style={s.bellWrap}>
              {pending > 0 && <View style={s.bellDot} />}
              <Bell size={15} color="#1a1a2e" />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={s.loadingBlock}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={s.loadingLabel}>Loading your space…</Text>
          </View>
        ) : (
          <>
            {/* ─── HERO BANNER ───────────────────────────────────────── */}
            <Pressable
              style={[s.heroBanner, !classroom && s.heroBannerPurple]}
              onPress={() => router.push('/(tabs)/classroom')}
              
            >
              <View style={s.heroLeft}>
                {classroom ? (
                  <>
                    <Text style={s.heroSub}>Online class in</Text>
                    <Text style={s.heroTitle}>{classroom.title}</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.heroSub}>Online class in</Text>
                    <Text style={s.heroTitle}>next 20 minutes</Text>
                  </>
                )}
                <View style={[s.heroBtn, !classroom && { backgroundColor: '#9B8EC4' }]}>
                  <Text style={s.heroBtnText}>
                    {classroom ? 'Join Now ›' : 'Explore ›'}
                  </Text>
                </View>
              </View>
              <View style={[s.heroAvatar, !classroom && { backgroundColor: 'rgba(155,142,196,0.2)' }]}>
                <Text style={{ fontSize: 28 }}>{classroom ? '👩‍🏫' : '🦒'}</Text>
              </View>
            </Pressable>

            {/* ─── SUBJECTS ──────────────────────────────────────────── */}
            <View style={s.rowHeader}>
              <Text style={s.rowTitle}>Subjects</Text>
              <Text style={s.rowLink}>See All</Text>
            </View>
            <View style={s.tilesGrid}>
              {SUBJECTS.map((tile, i) => (
                <Pressable
                  key={i}
                  style={[s.tile, { backgroundColor: tile.bg }]}
                  onPress={() => router.push('/(tabs)/classroom')}
                  
                >
                  <Text style={s.tileEmoji}>{tile.emoji}</Text>
                  <Text style={s.tileLabel}>{tile.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* ─── FEATURED STORY ────────────────────────────────────── */}
            <Text style={s.secTitle}>Featured Story</Text>
            <Pressable
              style={s.storyCard}
              onPress={() => router.push('/(tabs)/classroom')}
              
            >
              <View style={s.storyLeft}>
                <Text style={s.storyTitle}>
                  {featured?.title ?? 'Story Of\nBaby Dinosaur'}
                </Text>
                <View style={s.storyMeta}>
                  <Text style={s.storyMetaText}>⏱ 15 Minutes · 22 Aug</Text>
                </View>
                <View style={s.storyPlayBtn}>
                  <Text style={s.storyPlayText}>▶  Play</Text>
                </View>
              </View>
              <Text style={s.storyEmoji}>
                {STORY_EMOJI[0]}
              </Text>
            </Pressable>

            {/* ─── GAMES / QUIZZES ───────────────────────────────────── */}
            {quizzes.length > 0 && (
              <>
                <View style={s.rowHeader}>
                  <Text style={s.rowTitle}>Games</Text>
                  <Pressable onPress={() => router.push('/(tabs)/classroom')}>
                    <Text style={s.rowLink}>See All</Text>
                  </Pressable>
                </View>
                {quizzes.map((quiz, idx) => (
                  <Pressable
                    key={quiz.id}
                    style={s.gameCard}
                    onPress={() => setSelectedQuizId(quiz.id)}
                    
                  >
                    <View style={[s.gameIconBox, { backgroundColor: QUIZ_BG[idx % QUIZ_BG.length] }]}>
                      <Text style={{ fontSize: 24 }}>{QUIZ_ICONS[idx % QUIZ_ICONS.length]}</Text>
                    </View>
                    <View style={s.gameInfo}>
                      <Text style={s.gameTitle}>{quiz.title}</Text>
                      <Text style={s.gameSub}>
                        {quiz.totalQuestions} levels · {quiz.difficultyLevel ?? 'Standard'}
                      </Text>
                    </View>
                    <View style={s.gamePlayBtn}>
                      <Text style={s.gamePlayText}>
                        {quiz.status === 'completed' ? 'Replay' : 'Play'}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {/* ─── PROGRESS STRIP ────────────────────────────────────── */}
            {classroom && (
              <View style={s.progressCard}>
                <View style={s.progressRow}>
                  <Text style={s.progressLabel}>Classroom Progress</Text>
                  <Text style={s.progressPct}>{classroom.completionPct ?? 0}%</Text>
                </View>
                <View style={s.progressTrack}>
                  <View
                    style={[
                      s.progressFill,
                      { width: `${Math.min(100, classroom.completionPct ?? 0)}%` },
                    ]}
                  />
                </View>
                <View style={s.progressStats}>
                  <View style={s.progressStat}>
                    <Text style={[s.progressStatVal, { color: '#4A90E2' }]}>
                      {classroom.contents?.length ?? 0}
                    </Text>
                    <Text style={s.progressStatLabel}>Content</Text>
                  </View>
                  <View style={s.progressDivider} />
                  <View style={s.progressStat}>
                    <Text style={[s.progressStatVal, { color: '#FF7043' }]}>
                      {classroom.quizzes?.length ?? 0}
                    </Text>
                    <Text style={s.progressStatLabel}>Quizzes</Text>
                  </View>
                  <View style={s.progressDivider} />
                  <View style={s.progressStat}>
                    <Text style={[s.progressStatVal, { color: '#7DC67A' }]}>
                      {pending}
                    </Text>
                    <Text style={s.progressStatLabel}>Pending</Text>
                  </View>
                </View>
              </View>
            )}

            {/* ─── EMPTY STATE ───────────────────────────────────────── */}
            {!classroom && (
              <View style={s.emptyBlock}>
                <Text style={{ fontSize: 56, textAlign: 'center' }}>🦒</Text>
                <Text style={s.emptyTitle}>No classroom yet</Text>
                <Text style={s.emptyBody}>
                  Your teacher will add you to a class soon!
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {selectedQuizId && (
        <QuizRenderer
          quizId={selectedQuizId}
          visible
          onClose={() => { setSelectedQuizId(null); loadData(); }}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#FFFFFF' },
  scroll:  { paddingBottom: 48 },

  // ─── TOP BAR ──────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  greetingSub:  { fontSize: 12, color: '#9A9AB0', fontWeight: '500' },
  greetingName: { fontSize: 22, color: '#1a1a2e', fontWeight: '900', lineHeight: 28 },
  topActions:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  xpChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#4A90E2', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  xpLabel: { fontSize: 13, fontWeight: '800', color: '#fff' },
  bellWrap: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  bellDot: {
    position: 'absolute', top: 2, right: 2,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#F44336', zIndex: 1,
    borderWidth: 1.5, borderColor: '#fff',
  },

  // ─── HERO BANNER ──────────────────────────────────────────────────────────
  heroBanner: {
    marginHorizontal: 16, marginBottom: 24,
    backgroundColor: '#4A7FE0', borderRadius: 24,
    paddingTop: 20, paddingBottom: 20, paddingLeft: 20, paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  heroBannerPurple: { backgroundColor: '#C5B3E6' },
  heroLeft:  { flex: 1, paddingRight: 8 },
  heroSub:   { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginBottom: 2 },
  heroTitle: { fontSize: 20, color: '#fff', fontWeight: '900', lineHeight: 26, marginBottom: 14 },
  heroBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6,
  },
  heroBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  heroAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ─── SECTION HEADERS ──────────────────────────────────────────────────────
  rowHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12,
  },
  rowTitle: { fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  rowLink:  { fontSize: 13, fontWeight: '700', color: '#4A90E2' },
  secTitle: {
    fontSize: 17, fontWeight: '900', color: '#1a1a2e',
    paddingHorizontal: 20, marginBottom: 12,
  },

  // ─── SUBJECT TILES ────────────────────────────────────────────────────────
  tilesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, paddingHorizontal: 16, marginBottom: 24,
  },
  tile: {
    width: '47%', borderRadius: 20,
    paddingVertical: 22, paddingHorizontal: 12,
    alignItems: 'center', gap: 10,
  },
  tileEmoji: { fontSize: 42 },
  tileLabel: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },

  // ─── FEATURED STORY CARD ──────────────────────────────────────────────────
  storyCard: {
    marginHorizontal: 16, marginBottom: 24,
    backgroundColor: '#FAFAC8', borderRadius: 20,
    paddingTop: 18, paddingBottom: 18, paddingLeft: 18, paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  storyLeft:     { flex: 1, paddingRight: 8 },
  storyTitle:    { fontSize: 16, fontWeight: '900', color: '#1a1a2e', lineHeight: 22, marginBottom: 4 },
  storyMeta:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  storyMetaText: { fontSize: 11, color: '#9A9AB0', fontWeight: '500' },
  storyPlayBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF7043', borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 7,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  storyPlayText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  storyEmoji:    { fontSize: 58 },

  // ─── GAME / QUIZ CARDS ────────────────────────────────────────────────────
  gameCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 18, padding: 14, gap: 12,
    borderWidth: 1, borderColor: '#F0F0F8',
    shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 2,
  },
  gameIconBox: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  gameInfo:    { flex: 1 },
  gameTitle:   { fontSize: 14, fontWeight: '800', color: '#1a1a2e', marginBottom: 2 },
  gameSub:     { fontSize: 11, fontWeight: '500', color: '#9A9AB0' },
  gamePlayBtn: {
    backgroundColor: '#4A90E2', borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  gamePlayText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  // ─── PROGRESS CARD ────────────────────────────────────────────────────────
  progressCard: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#fff', borderRadius: 20,
    padding: 16, borderWidth: 1, borderColor: '#F0F0F8',
    shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 2,
  },
  progressRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  progressLabel: { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  progressPct:   { fontSize: 13, fontWeight: '900', color: '#4A90E2' },
  progressTrack: {
    height: 8, backgroundColor: '#F0F0F8',
    borderRadius: 999, overflow: 'hidden', marginBottom: 14,
  },
  progressFill: {
    height: '100%', borderRadius: 999,
    backgroundColor: '#4A90E2',
  },
  progressStats:    { flexDirection: 'row', justifyContent: 'space-around' },
  progressStat:     { alignItems: 'center', gap: 2 },
  progressStatVal:  { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  progressStatLabel:{ fontSize: 9, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase' },
  progressDivider:  { width: 1, backgroundColor: '#F0F0F8', alignSelf: 'stretch' },

  // ─── LOADING / EMPTY ──────────────────────────────────────────────────────
  loadingBlock:  { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingLabel:  { fontSize: 13, color: '#9A9AB0', fontWeight: '500' },
  emptyBlock:    { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 40, gap: 8 },
  emptyTitle:    { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptyBody:     { fontSize: 13, fontWeight: '500', color: '#9A9AB0', textAlign: 'center', lineHeight: 20 },

  // ── Parent-specific ──────────────────────────────────────────────────────
  childCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#fff', borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: '#F0F0F8',
    shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 2,
  },
  childAvatar: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: '#EDE4FF', alignItems: 'center', justifyContent: 'center',
  },
  childInfo:   { flex: 1, gap: 3 },
  childName:   { fontSize: 15, fontWeight: '800', color: '#1a1a2e' },
  childMeta:   { fontSize: 12, color: '#9A9AB0', fontWeight: '500' },
  childProgressWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  childProgressTrack: { flex: 1, height: 5, backgroundColor: '#F0F0F8', borderRadius: 999, overflow: 'hidden' },
  childProgressFill:  { height: '100%', backgroundColor: '#9B8EC4', borderRadius: 999 },
  childProgressPct:   { fontSize: 11, fontWeight: '700', color: '#9B8EC4' },
  quickActionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    paddingHorizontal: 16, marginBottom: 24,
  },
  quickActionTile: {
    width: '47%', borderRadius: 18, paddingVertical: 20,
    alignItems: 'center', gap: 8,
  },
  quickActionLabel: { fontSize: 13, fontWeight: '800' },
});
