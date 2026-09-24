import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Star, Users, BookOpen, TrendingUp, Calendar,
  ChevronRight, Clock, Zap, CheckCircle,
  Trophy, PlayCircle,
  Target, Layers, BarChart2, ClipboardList, User, History, BookOpenCheck, Plus,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { useStudentProfile } from '../../src/context/StudentProfileContext';
import QuizRenderer from '../../src/components/quiz/QuizRenderer';
import SubjectVisual from '../../src/components/subject/SubjectVisual';
import { SvgXml } from 'react-native-svg';

import { Colors, Radius, Shadow } from '../../src/theme';
import { GIRAFFE, OWL, BUTTERFLY, PENGUIN } from '../../src/assets/svgs';

// ── Types ─────────────────────────────────────────────────────────────────────
type IconComp = React.ComponentType<{ size: number; color: string }>;

type SubjectItem = {
  subject: string;
  coverImage: string | null;
  icon: string | null;
  iconBgColor: string | null;
};

type Classroom = {
  id: string; title: string; classLevel: string;
  completionPct: number; status: string;
  contents: Array<{ id: string; title: string; subject?: string; contentType?: string }>;
  quizzes: Array<{ id: string; title: string; totalQuestions: number; difficultyLevel?: string; status: string }>;
  assignments: Array<{ id: string; status: string }>;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const CHILD_COLORS = [Colors.primary, Colors.success, Colors.accent, Colors.purple, Colors.warning];

const QUIZ_ICON_COMPS: IconComp[] = [BookOpen, Zap, Star, Target];
const QUIZ_ICON_COLORS = [Colors.accent, Colors.purple, Colors.warning, Colors.primary];
const QUIZ_ICON_BGS = [Colors.accentLight, Colors.purpleLight, Colors.warningLight, Colors.primaryLight];

const STATUS_COLOR: Record<string, string> = {
  completed: Colors.success,
  attempted: Colors.warning,
  pending: Colors.textMuted,
};

const SUBJECT_PALETTES = [
  { bg: '#EFF6FF', border: '#BFDBFE', iconBg: '#DBEAFE', iconColor: '#1D4ED8', badgeBg: '#EFF6FF', badgeText: '#1D4ED8' },
  { bg: '#FAF5FF', border: '#E9D5FF', iconBg: '#F3E8FF', iconColor: '#7C3AED', badgeBg: '#FAF5FF', badgeText: '#7C3AED' },
  { bg: '#ECFDF5', border: '#A7F3D0', iconBg: '#D1FAE5', iconColor: '#059669', badgeBg: '#ECFDF5', badgeText: '#059669' },
  { bg: '#FFFBEB', border: '#FDE68A', iconBg: '#FEF3C7', iconColor: '#D97706', badgeBg: '#FFFBEB', badgeText: '#D97706' },
  { bg: '#FFF1F2', border: '#FECDD3', iconBg: '#FFE4E6', iconColor: '#E11D48', badgeBg: '#FFF1F2', badgeText: '#E11D48' },
  { bg: '#FFF7ED', border: '#FED7AA', iconBg: '#FFEDD5', iconColor: '#EA580C', badgeBg: '#FFF7ED', badgeText: '#EA580C' },
  { bg: '#F0FDF4', border: '#BBF7D0', iconBg: '#DCFCE7', iconColor: '#16A34A', badgeBg: '#F0FDF4', badgeText: '#16A34A' },
  { bg: '#EEF2FF', border: '#C7D2FE', iconBg: '#E0E7FF', iconColor: '#4F46E5', badgeBg: '#EEF2FF', badgeText: '#4F46E5' },
];

const QUICK_ACTIONS = [
  { label: 'Reports', Icon: BarChart2, color: Colors.primary, bg: Colors.primaryLight, route: '/(tabs)/reports' as const },
  // Colors.accent only clears 3.98:1 on accentLight (needs 4.5:1 as label
  // text), so this tile's label uses a darker textColor while the icon
  // keeps the vivid accent color.
  { label: 'Counseling', Icon: ClipboardList, color: Colors.accent, textColor: '#B03A19', bg: Colors.accentLight, route: '/(tabs)/counseling' as const },
  { label: 'Classroom', Icon: BookOpen, color: Colors.success, bg: Colors.successLight, route: '/(tabs)/classroom' as const },
  { label: 'Progress', Icon: TrendingUp, color: Colors.purple, bg: Colors.purpleLight, route: '/(tabs)/reports' as const },
];

const DEFAULT_SUBJECTS: SubjectItem[] = [];
const HISTORY_PAGE_SIZE = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function fmtSec(s: number) {
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}m`;
}

function ActivityTypeIcon({ type, size = 16, color = Colors.textMuted }: {
  type: string; size?: number; color?: string;
}) {
  if (type === 'quiz') return <Layers size={size} color={color} />;
  if (type === 'assignment') return <ClipboardList size={size} color={color} />;
  return <BookOpen size={size} color={color} />;
}

// ── Parent Dashboard ──────────────────────────────────────────────────────────
function ParentDashboard() {
  const { user, apiFetch } = useAuth();
  const {
    linkedStudents, activeStudent,
    loadingStudents, loadingActivity,
    activity, analytics,
    switchToStudent, refreshAll,
  } = useStudentProfile();

  const [counselingDone, setCounselingDone] = useState<Record<string, boolean>>({});

  const checkCounseling = useCallback(async (studentId: string) => {
    try {
      const res = await apiFetch(`/counseling/students/${studentId}/sessions`);
      if (!res.ok) return;
      const data = await res.json();
      const done = (data.sessions ?? []).some(
        (sn: { status?: string; reportCreatedAt?: string | null }) =>
          sn.reportCreatedAt != null || sn.status === 'reported',
      );
      setCounselingDone((prev) => ({ ...prev, [studentId]: done }));
    } catch {
      /* ignore */
    }
  }, [apiFetch]);

  useEffect(() => {
    if (activeStudent?.id) checkCounseling(activeStudent.id);
  }, [activeStudent?.id, checkCounseling]);

  useFocusEffect(
    useCallback(() => {
      if (activeStudent?.id) checkCounseling(activeStudent.id);
    }, [activeStudent?.id, checkCounseling]),
  );

  return (
    <View style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Top bar */}
        <View style={[s.topBar, { paddingTop: Platform.OS === 'ios' ? 2 : 8 }]}>
          <View>
            <Text style={s.greetingSub}>{getGreeting()},</Text>
            <Text style={s.greetingName}>{user?.firstName ?? 'Parent'}</Text>
          </View>
        </View>

        {/* Child switcher */}
        <View style={s.profileSwitcherWrap}>
          <Text style={s.profileSwitcherLabel}>My Children</Text>
          {loadingStudents ? (
            <ActivityIndicator accessibilityLabel="Loading" color={Colors.purple} size="small" style={{ marginTop: 8 }} />
          ) : linkedStudents.length === 0 ? (
            <View style={s.emptyBlock}>
              <SvgXml xml={PENGUIN} width={80} height={80} />
              <Text style={s.emptyTitle}>No children linked yet</Text>
              <Text style={s.emptyBody}>Ask your school admin to link your account.</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.avatarScroll}
              contentContainerStyle={{ gap: 16, paddingHorizontal: 16, paddingVertical: 8 }}
            >
              {linkedStudents.map((child, idx) => {
                const isActive = child.id === activeStudent?.id;
                const chipColor = CHILD_COLORS[idx % CHILD_COLORS.length];
                return (
                  <Pressable key={child.id} style={s.avatarItem} onPress={() => switchToStudent(child.id)}>
                    <View style={[s.avatarCircle, { backgroundColor: chipColor, borderWidth: isActive ? 3 : 0, borderColor: Colors.text }]}>
                      <User size={22} color="#fff" />
                    </View>
                    <Text style={[s.avatarName, isActive && { fontWeight: '900', color: Colors.text }]} numberOfLines={1}>
                      {child.firstName}
                    </Text>
                    {isActive && <View style={[s.avatarActiveDot, { backgroundColor: chipColor }]} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Active child detail */}
        {activeStudent && (
          <>
            <View style={s.activeChildHeader}>
              <View>
                <Text style={s.activeChildName}>{activeStudent.firstName} {activeStudent.lastName}</Text>
                <Text style={s.activeChildMeta}>
                  {activeStudent.classLevel ? `Class ${activeStudent.classLevel}` : 'No class assigned'}
                </Text>
              </View>
              <Pressable style={s.viewReportBtn} onPress={() => router.push('/(tabs)/reports')}>
                <Text style={s.viewReportBtnText}>Full Report</Text>
                <ChevronRight size={12} color="#fff" />
              </Pressable>
            </View>

            {/* Start Counseling CTA — hidden once a session is completed */}
            {!counselingDone[activeStudent.id] && (
            <Pressable
              onPress={() => router.push('/(tabs)/counseling')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: Colors.accent,
                borderRadius: Radius.card,
                paddingVertical: 14,
                paddingHorizontal: 16,
                marginHorizontal: 16,
                marginBottom: 12,
                ...Shadow.sm,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)' }}>
                <ClipboardList size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>Start Counseling</Text>
                <Text style={{ fontSize: 12, color: '#fff', marginTop: 2 }}>
                  5–10 min guided check-in + AI report for {activeStudent.firstName}
                </Text>
              </View>
              <ChevronRight size={18} color="#fff" />
            </Pressable>
            )}

            {/* Analytics strip */}
            {analytics?.summary && (
              <View style={s.statsStrip}>
                <View style={[s.statPill, { backgroundColor: Colors.primaryLight }]}>
                  <Zap size={13} color={Colors.primary} />
                  <Text style={[s.statPillVal, { color: Colors.primary }]}>{analytics.summary.streakDays}</Text>
                  <Text style={s.statPillLbl}>Streak</Text>
                </View>
                <View style={[s.statPill, { backgroundColor: Colors.successLight }]}>
                  <CheckCircle size={13} color={Colors.success} />
                  <Text style={[s.statPillVal, { color: Colors.success }]}>{analytics.summary.completionRate.toFixed(0)}%</Text>
                  <Text style={s.statPillLbl}>Done</Text>
                </View>
                <View style={[s.statPill, { backgroundColor: Colors.warningLight }]}>
                  <Star size={13} color={Colors.warning} fill={Colors.warning} />
                  {/* Colors.warning on warningLight is 1.84:1 — too low for text; darkened for the count only */}
                  <Text style={[s.statPillVal, { color: '#8F4A17' }]}>{analytics.summary.attemptedCount}</Text>
                  <Text style={s.statPillLbl}>Tried</Text>
                </View>
                <View style={[s.statPill, { backgroundColor: Colors.purpleLight }]}>
                  <Clock size={13} color={Colors.purple} />
                  <Text style={[s.statPillVal, { color: Colors.purple }]}>{fmtSec(analytics.summary.totalTimeSeconds)}</Text>
                  <Text style={s.statPillLbl}>Time</Text>
                </View>
              </View>
            )}

            {/* Breakdown */}
            {analytics?.breakdown && Object.keys(analytics.breakdown).length > 0 && (
              <>
                <View style={s.rowHeader}>
                  <Text style={s.rowTitle}>Activity Breakdown</Text>
                </View>
                <View style={s.breakdownRow}>
                  {Object.entries(analytics.breakdown).map(([type, data]) => (
                    <View key={type} style={[s.breakdownCard, { backgroundColor: Colors.surface }]}>
                      <ActivityTypeIcon type={type} size={22} color={Colors.primary} />
                      <Text style={s.breakdownCount}>{data.count}</Text>
                      <Text style={s.breakdownLabel}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                      {data.avgScore !== null && (
                        <Text style={s.breakdownScore}>avg {data.avgScore}%</Text>
                      )}
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Recent activity */}
            <View style={s.rowHeader}>
              <Text style={s.rowTitle}>Recent Activity</Text>
              <Pressable onPress={() => router.push('/(tabs)/reports')}>
                <Text style={s.rowLink}>See All</Text>
              </Pressable>
            </View>
            {loadingActivity ? (
              <ActivityIndicator accessibilityLabel="Loading" color={Colors.primary} style={{ marginVertical: 16 }} />
            ) : activity.length === 0 ? (
              <View style={s.emptyBlock}>
                <Text style={s.emptyTitle}>No activity yet</Text>
              </View>
            ) : (
              activity.slice(0, 6).map((item) => {
                const dotColor = STATUS_COLOR[item.status] ?? Colors.textMuted;
                return (
                  <View key={item.id} style={s.activityRow}>
                    <View style={[s.activityIconWrap, { backgroundColor: dotColor + '18' }]}>
                      <ActivityTypeIcon type={item.activityType} size={14} color={dotColor} />
                    </View>
                    <View style={s.activityInfo}>
                      <Text style={s.activityTitle} numberOfLines={1}>
                        {item.referenceTitle ?? item.activityType}
                      </Text>
                      <Text style={s.activityMeta}>
                        {item.status} · {item.activityDate}
                        {item.score !== undefined ? ` · ${item.score}%` : ''}
                      </Text>
                    </View>
                    {item.timeSpentSeconds > 0 && (
                      <Text style={s.activityTime}>{fmtSec(item.timeSpentSeconds)}</Text>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        {/* Quick actions */}
        <View style={s.rowHeader}>
          <Text style={s.rowTitle}>Quick Actions</Text>
        </View>
        <View style={s.quickActionsGrid}>
          {QUICK_ACTIONS.map((qa) => (
            <Pressable key={qa.label} style={[s.quickActionTile, { backgroundColor: qa.bg }]} onPress={() => router.push(qa.route)}>
              <View style={[s.quickActionIcon, { backgroundColor: qa.color + '20' }]}>
                <qa.Icon size={22} color={qa.color} />
              </View>
              <Text style={[s.quickActionLabel, { color: qa.textColor ?? qa.color }]}>{qa.label}</Text>
            </Pressable>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user, apiFetch } = useAuth();
  const role = user?.activeRole ?? 'student';
  const isTeacherOrAdmin = role === 'teacher' || role === 'admin' || role === 'superadmin';
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isLargeScreen = windowWidth >= 900;
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 640 && windowWidth < 1024;

  const [loading, setLoading] = useState(true);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [achievementGroups, setAchievementGroups] = useState<Array<{
    name: string; emoji: string; color: string; description: string; count: number;
  }>>([]);
  const [totalAchievements, setTotalAchievements] = useState(0);
  const [liveStory, setLiveStory] = useState<{ id: string; title: string; description?: string; scheduledAt?: string | null; coverImageUrl?: string | null; sectionCount?: number } | null>(null);
  const [nextStory, setNextStory] = useState<{ id: string; title: string; scheduledAt: string | null } | null>(null);
  const [previousStories, setPreviousStories] = useState<Array<{ id: string; title: string; description?: string; sectionCount?: number; endedAt?: string | null }>>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState<{ items: typeof previousStories; total: number; loading: boolean; page: number }>({ items: [], total: 0, loading: false, page: 1 });


  const loadData = useCallback(async () => {
    if (!user) return;
    if (role === 'teacher' || role === 'admin' || role === 'superadmin') return;
    setLoading(true);
    try {
      if (role === 'student') {
        const [classroomsRes, subjectsRes, achievRes, storyFeedRes] = await Promise.all([
          apiFetch('/classrooms/student'),
          apiFetch('/students/subjects'),
          apiFetch('/achievements/my'),
          apiFetch('/stories/home/feed'),
        ]);
        if (storyFeedRes.ok) {
          const sd = await storyFeedRes.json();
          setLiveStory(sd.live || null);
          setNextStory(sd.nextScheduled || null);
          setPreviousStories(sd.previous || []);
        }
        if (achievRes.ok) {
          const ad = await achievRes.json();
          setTotalAchievements(ad.total ?? 0);
          setAchievementGroups(ad.achievements ?? []);
        }
        if (classroomsRes.ok) {
          const payload = await classroomsRes.json();
          const rooms = (payload.classrooms ?? []) as Classroom[];
          setClassroom(rooms.find((r) => r.status === 'active') ?? rooms[0] ?? null);
        }
        if (subjectsRes.ok) {
          const payload = await subjectsRes.json();
          setSubjects(
            ((payload.subjects ?? []) as Array<{
              subject: string;
              coverImage?: string | null;
              icon?: string | null;
              iconBgColor?: string | null;
            }>).map((s) => ({
              subject: s.subject,
              coverImage: s.coverImage ?? null,
              icon: s.icon ?? null,
              iconBgColor: s.iconBgColor ?? null,
            })),
          );
        }
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [apiFetch, user, role]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const loadHistory = useCallback(async (page = 1) => {
    if (historyPage.loading) return;
    setHistoryPage((p) => ({ ...p, loading: true }));
    try {
      const offset = (page - 1) * HISTORY_PAGE_SIZE;
      const r = await apiFetch(`/stories?status=ended&limit=${HISTORY_PAGE_SIZE}&offset=${offset}`);
      if (!r.ok) return;
      const data = await r.json();
      const newItems = data.stories || [];
      setHistoryPage({ items: newItems, total: data.total ?? newItems.length, loading: false, page });
    } catch { setHistoryPage((p) => ({ ...p, loading: false })); }
  }, [apiFetch, historyPage.loading]);

  // Load history when modal opens
  useEffect(() => {
    if (historyOpen) loadHistory(1);
  }, [historyOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalHistoryPages = Math.max(1, Math.ceil(historyPage.total / HISTORY_PAGE_SIZE));
  const canGoHistoryPrev = historyPage.page > 1 && !historyPage.loading;
  const canGoHistoryNext = historyPage.page < totalHistoryPages && !historyPage.loading;


  const pending = useMemo(() => classroom?.assignments.filter((a) => a.status !== 'submitted').length ?? 0, [classroom]);
  const xp = Math.round((classroom?.completionPct ?? 0) * 15);
  const featured = classroom?.contents?.[0] ?? null;
  const quizzes = classroom?.quizzes?.slice(0, 4) ?? [];
  const displaySubjects = subjects.length > 0 ? subjects : DEFAULT_SUBJECTS;
  if (role === 'teacher') return <Redirect href="/(tabs)/planner" />;
  if (role === 'superadmin') return <Redirect href="/(tabs)/superadmin" />;
  if (role === 'admin') return <Redirect href="/(tabs)/admin" />;
  if (role === 'parent') return <ParentDashboard />;

  return (
    <View style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.mainContainer}>

          {/* ── TOP BAR ─────────────────────────────────────── */}
          <View style={[s.topBar, { paddingTop: Platform.OS === 'ios' ? 2 : 8 }]}>
            <View>
              <Text style={s.greetingSub}>{getGreeting()},</Text>
              <Text style={s.greetingName}>{user?.firstName ?? 'Learner'}</Text>
            </View>
            <View style={s.xpChip}>
              <Star size={14} color="#F59E0B" fill="#F59E0B" />
              <Text style={s.xpLabel}>{xp > 0 ? xp.toLocaleString() : '1,200'} XP</Text>
            </View>
          </View>

          {loading ? (
            <View style={s.loadingBlock}>
              <ActivityIndicator accessibilityLabel="Loading" size="large" color="#2563EB" />
              <Text style={s.loadingLabel}>Loading your learning space…</Text>
            </View>
          ) : (
            <>
              {/* ── HERO & PROGRESS ROW ───────────────────────── */}
              <View style={isLargeScreen && classroom ? s.heroRowDesktop : s.heroRowMobile}>
                {/* Active Classroom Banner */}
                <Pressable
                  style={[s.heroBanner, isLargeScreen && classroom && s.heroBannerDesktop]}
                  onPress={() => router.push('/(tabs)/classroom')}
                >
                  <View style={s.heroContentLeft}>
                    <View style={s.heroLiveBadge}>
                      <View style={s.heroLiveDot} />
                      <Text style={s.heroLiveBadgeText}>
                        {classroom ? 'Active Classroom' : 'Learning Space'}
                      </Text>
                    </View>
                    <Text style={s.heroTitle} numberOfLines={2}>
                      {classroom ? classroom.title : 'Explore Classes & Stories'}
                    </Text>
                    <Text style={s.heroSub}>
                      {classroom
                        ? `${classroom.classLevel || 'Any Class'} • Self-paced interactive learning`
                        : 'Start your daily learning journey today'}
                    </Text>
                    <View style={s.heroBtn}>
                      <Text style={s.heroBtnText}>{classroom ? 'Enter Classroom' : 'Explore Now'}</Text>
                      <ChevronRight size={14} color="#1E40AF" />
                    </View>
                  </View>
                  <View style={s.heroAvatar}>
                    {classroom
                      ? <Users size={28} color="#FFFFFF" />
                      : <BookOpen size={28} color="#FFFFFF" />}
                  </View>
                </Pressable>

                {/* Classroom Progress Card */}
                {classroom && (
                  <View style={[s.progressCardModern, isLargeScreen && s.progressCardDesktop]}>
                    <View style={s.progressRow}>
                      <View style={s.progressHeaderLeft}>
                        <TrendingUp size={16} color="#2563EB" />
                        <Text style={s.progressLabel}>Class Progress</Text>
                      </View>
                      <View style={s.progressBadge}>
                        <Text style={s.progressPct}>{classroom.completionPct ?? 0}%</Text>
                      </View>
                    </View>
                    <View style={s.progressTrack}>
                      <View style={[s.progressFill, { width: `${Math.min(100, Math.max(0, classroom.completionPct ?? 0))}%` }]} />
                    </View>
                    <View style={s.progressStats}>
                      <View style={[s.progressStatPill, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
                        <Text style={[s.progressStatVal, { color: '#1D4ED8' }]}>{classroom.contents?.length ?? 0}</Text>
                        <Text style={s.progressStatLabel}>Content</Text>
                      </View>
                      <View style={[s.progressStatPill, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                        <Text style={[s.progressStatVal, { color: '#D97706' }]}>{classroom.quizzes?.length ?? 0}</Text>
                        <Text style={s.progressStatLabel}>Quizzes</Text>
                      </View>
                      <View style={[s.progressStatPill, { backgroundColor: pending > 0 ? '#FEE2E2' : '#ECFDF5', borderColor: pending > 0 ? '#FECDD3' : '#A7F3D0' }]}>
                        <Text style={[s.progressStatVal, { color: pending > 0 ? '#DC2626' : '#059669' }]}>{pending}</Text>
                        <Text style={s.progressStatLabel}>Pending</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* ── SUBJECTS ────────────────────────────────── */}
              <View style={s.rowHeader}>
                <View style={s.sectionTitleRow}>
                  <Layers size={18} color="#2563EB" />
                  <Text style={s.rowTitle}>Subjects</Text>
                </View>
                <Pressable onPress={() => router.push('/(tabs)/subject')}>
                  <Text style={s.rowLink}>See All</Text>
                </Pressable>
              </View>

              <View style={s.tilesGrid}>
                {displaySubjects.map((tile, i) => {
                  const palette = SUBJECT_PALETTES[i % SUBJECT_PALETTES.length];
                  return (
                    <Pressable
                      key={`${tile.subject}-${i}`}
                      style={[
                        s.tile,
                        isDesktop ? s.tileDesktop : isTablet ? s.tileTablet : s.tileMobile,
                      ]}
                      onPress={() => router.push({ pathname: '/(tabs)/subject', params: { subject: tile.subject } })}
                    >
                      <View style={[s.tileIconBox, { backgroundColor: palette.iconBg }]}>
                        <SubjectVisual
                          coverImage={tile.coverImage}
                          icon={tile.icon}
                          iconBgColor={palette.iconBg}
                          size={30}
                          containerSize={56}
                        />
                      </View>
                      <View style={s.tileBody}>
                        <Text style={s.tileLabel} numberOfLines={2} ellipsizeMode="tail">
                          {tile.subject}
                        </Text>
                        <View style={[s.tileIndicator, { backgroundColor: palette.iconColor }]} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* ── FEATURED STORY ──────────────────────────── */}
              <View style={s.section}>
                <View style={s.storyHeaderRow}>
                  <View style={s.sectionTitleRow}>
                    <BookOpen size={18} color="#EA580C" />
                    <Text style={s.rowTitle}>Featured Story</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {isTeacherOrAdmin && (
                      <Pressable
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14 }}
                        onPress={() => router.push('/(tabs)/stories' as any)}
                      >
                        <Plus size={12} color="#C2410C" />
                        <Text style={{ color: '#C2410C', fontSize: 11, fontWeight: '700' }}>Manage</Text>
                      </Pressable>
                    )}
                    {nextStory?.scheduledAt && (() => {
                      const d = new Date(nextStory.scheduledAt);
                      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
                      const isT = d.toDateString() === tomorrow.toDateString();
                      const label = isT ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
                      return (
                        <View style={s.nextDayPill}>
                          <Calendar size={11} color="#B45309" />
                          <Text style={s.nextDayPillText}>Next: {label}</Text>
                        </View>
                      );
                    })()}
                    {previousStories.length > 0 && (
                      <Pressable style={s.historyBtn} onPress={() => setHistoryOpen(true)}>
                        <History size={15} color="#2563EB" />
                      </Pressable>
                    )}
                  </View>
                </View>

                {liveStory || nextStory ? (
                  <Pressable
                    style={s.storyCard}
                    onPress={() => liveStory && router.push(`/story/${liveStory.id}` as any)}
                    disabled={!liveStory}
                  >
                    <View style={s.storyLeft}>
                      <View style={s.storyBadgeRow}>
                        <View style={[s.storyLiveBadge, { backgroundColor: liveStory ? '#FEE2E2' : '#EFF6FF', borderColor: liveStory ? '#FECDD3' : '#BFDBFE' }]}>
                          <Text style={[s.storyLiveBadgeText, { color: liveStory ? '#DC2626' : '#1D4ED8' }]}>
                            {liveStory ? '● LIVE NOW' : 'FEATURED STORY'}
                          </Text>
                        </View>
                      </View>
                      <Text style={s.storyTitle} numberOfLines={2}>
                        {(liveStory?.title || nextStory?.title || '').trim()}
                      </Text>
                      <View style={s.storyMeta}>
                        <Clock size={12} color="#64748B" />
                        <Text style={s.storyMetaText}>
                          {liveStory
                            ? `${liveStory.sectionCount ?? 0} sections • Interactive read`
                            : nextStory?.scheduledAt
                              ? `Starts ${new Date(nextStory.scheduledAt).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}`
                              : 'Coming soon'}
                        </Text>
                      </View>
                      <View style={[s.storyPlayBtn, !liveStory && { backgroundColor: '#94A3B8' }]}>
                        <PlayCircle size={15} color="#fff" />
                        <Text style={s.storyPlayText}>{liveStory ? 'Start Story' : 'Coming Soon'}</Text>
                      </View>
                    </View>
                    <View style={s.storyIllustrationWrap}>
                      <View style={s.storyIllustrationCircle}>
                        <SvgXml xml={GIRAFFE} width={76} height={76} />
                      </View>
                    </View>
                  </Pressable>
                ) : (
                  <View style={s.storyEmptyCard}>
                    <View style={s.storyLeft}>
                      <View style={s.storyBadgeRow}>
                        <View style={[s.storyLiveBadge, { backgroundColor: '#FFEDD5', borderColor: '#FED7AA' }]}>
                          <Text style={[s.storyLiveBadgeText, { color: '#C2410C' }]}>
                            ✨ STORY TIME
                          </Text>
                        </View>
                      </View>
                      <Text style={s.storyTitle} numberOfLines={2}>
                        {isTeacherOrAdmin ? 'Manage & Create Stories' : 'Explore Magical Stories & Adventures'}
                      </Text>
                      <Text style={s.storyEmptyDesc} numberOfLines={2}>
                        {isTeacherOrAdmin
                          ? 'Design interactive illustrated stories with moral lessons, audio narration, and reading challenges for your class.'
                          : 'Read engaging illustrated stories with moral lessons, audio narration, and reading challenges.'}
                      </Text>
                      <View style={s.storyEmptyActionRow}>
                        <Pressable
                          style={s.storyPlayBtn}
                          onPress={() => router.push('/(tabs)/stories' as any)}
                        >
                          {isTeacherOrAdmin ? (
                            <>
                              <Plus size={15} color="#fff" />
                              <Text style={s.storyPlayText}>Create Story</Text>
                            </>
                          ) : (
                            <>
                              <BookOpenCheck size={15} color="#fff" />
                              <Text style={s.storyPlayText}>Explore Stories</Text>
                            </>
                          )}
                        </Pressable>
                        {previousStories.length > 0 && (
                          <Pressable
                            style={s.storyHistoryAltBtn}
                            onPress={() => setHistoryOpen(true)}
                          >
                            <History size={14} color="#2563EB" />
                            <Text style={s.storyHistoryAltText}>History ({previousStories.length})</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                    <View style={s.storyIllustrationWrap}>
                      <View style={s.storyIllustrationCircle}>
                        <SvgXml xml={GIRAFFE} width={76} height={76} />
                      </View>
                    </View>
                  </View>
                )}

                {/* Previous Stories History Modal */}
                <Modal visible={historyOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHistoryOpen(false)}>
                  <View style={s.historyModal}>
                    <View style={[s.historyModalHeader, { paddingTop: Math.max(insets.top, 24) }]}>
                      <BookOpenCheck size={20} color="#2563EB" />
                      <View style={{ flex: 1 }}>
                        <Text style={s.historyModalTitle}>Previous Stories</Text>
                        {historyPage.total > 0 && (
                          <Text style={s.historyModalCount}>{historyPage.total} stories</Text>
                        )}
                      </View>
                      <Pressable onPress={() => setHistoryOpen(false)} style={s.historyCloseBtn}>
                        <Text style={{ fontSize: 18, color: '#525C6B', fontWeight: '600' }}>✕</Text>
                      </Pressable>
                    </View>

                    <FlatList
                      data={historyPage.items}
                      keyExtractor={(x) => x.id}
                      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40, maxWidth: 860, width: '100%', alignSelf: 'center' }}
                      renderItem={({ item, index }) => (
                        <Pressable
                          style={s.historyCard}
                          onPress={() => { setHistoryOpen(false); router.push(`/story/${item.id}` as any); }}
                        >
                          <View style={s.historyCardNum}>
                            <Text style={s.historyCardNumText}>{(historyPage.page - 1) * HISTORY_PAGE_SIZE + index + 1}</Text>
                          </View>
                          <View style={s.historyCardIcon}>
                            <BookOpenCheck size={22} color="#2563EB" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.historyCardTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={s.historyCardMeta}>
                              {item.sectionCount ?? 0} sections
                              {item.endedAt ? ` · ${new Date(item.endedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                            </Text>
                          </View>
                          <View style={s.historyReplayBtn}>
                            <PlayCircle size={13} color="#2563EB" />
                            <Text style={s.historyReplayText}>Replay</Text>
                          </View>
                        </Pressable>
                      )}
                      ListEmptyComponent={
                        historyPage.loading
                          ? <ActivityIndicator accessibilityLabel="Loading" color="#2563EB" style={{ marginTop: 40 }} />
                          : <Text style={{ textAlign: 'center', color: '#64748B', marginTop: 40, fontSize: 14 }}>No previous stories yet.</Text>
                      }
                      ListFooterComponent={
                        historyPage.items.length > 0 ? (
                          <View style={s.historyPagerRow}>
                            <Pressable
                              style={[s.historyPagerBtn, !canGoHistoryPrev && s.historyPagerBtnDisabled]}
                              disabled={!canGoHistoryPrev}
                              onPress={() => loadHistory(historyPage.page - 1)}
                            >
                              <Text style={[s.historyPagerBtnText, !canGoHistoryPrev && s.historyPagerBtnTextDisabled]}>Previous</Text>
                            </Pressable>
                            <Text style={s.historyPagerText}>Page {historyPage.page} of {totalHistoryPages}</Text>
                            <Pressable
                              style={[s.historyPagerBtn, !canGoHistoryNext && s.historyPagerBtnDisabled]}
                              disabled={!canGoHistoryNext}
                              onPress={() => loadHistory(historyPage.page + 1)}
                            >
                              <Text style={[s.historyPagerBtnText, !canGoHistoryNext && s.historyPagerBtnTextDisabled]}>Next</Text>
                            </Pressable>
                          </View>
                        ) : null
                      }
                    />
                  </View>
                </Modal>
              </View>

              {/* ── GAMES / QUIZZES ─────────────────────────── */}
              {quizzes.length > 0 && (
                <View style={s.section}>
                  <View style={s.rowHeader}>
                    <View style={s.sectionTitleRow}>
                      <Target size={18} color="#7C3AED" />
                      <Text style={s.rowTitle}>Games & Puzzles</Text>
                    </View>
                    <Pressable onPress={() => router.push('/(tabs)/classroom')}>
                      <Text style={s.rowLink}>See All</Text>
                    </Pressable>
                  </View>
                  <View style={isLargeScreen ? s.quizzesGridDesktop : s.quizzesGridMobile}>
                    {quizzes.map((quiz, idx) => {
                      const QuizIcon = QUIZ_ICON_COMPS[idx % QUIZ_ICON_COMPS.length];
                      const iconColor = QUIZ_ICON_COLORS[idx % QUIZ_ICON_COLORS.length];
                      const iconBg = QUIZ_ICON_BGS[idx % QUIZ_ICON_BGS.length];
                      return (
                        <Pressable
                          key={quiz.id}
                          style={[s.gameCard, isLargeScreen && s.gameCardDesktop]}
                          onPress={() => setSelectedQuizId(quiz.id)}
                        >
                          <View style={[s.gameIconBox, { backgroundColor: iconBg }]}>
                            <QuizIcon size={24} color={iconColor} />
                          </View>
                          <View style={s.gameInfo}>
                            <Text style={s.gameTitle} numberOfLines={1}>{quiz.title}</Text>
                            <Text style={s.gameSub}>{quiz.totalQuestions} levels • {quiz.difficultyLevel ?? 'Standard'}</Text>
                          </View>
                          <View style={[s.gamePlayBtn, { backgroundColor: iconColor }]}>
                            <Text style={s.gamePlayText}>{quiz.status === 'completed' ? 'Replay' : 'Play'}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ── ACHIEVEMENTS (FROM DB) ────────────────────── */}
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <View style={s.sectionTitleRow}>
                    <Trophy size={18} color="#D97706" />
                    <Text style={s.sectionTitle}>My Achievements</Text>
                  </View>
                  <View style={s.achievBadge}>
                    <Text style={s.achievBadgeText}>{totalAchievements} total</Text>
                  </View>
                </View>

                {achievementGroups.length > 0 ? (
                  <View style={isDesktop ? s.achievGridDesktop : isTablet ? s.achievGridTablet : s.achievGridMobile}>
                    {achievementGroups.map((ag, i) => (
                      <View
                        key={`${ag.name}-${i}`}
                        style={[
                          s.achievCard,
                          isDesktop ? s.achievCardDesktop : isTablet ? s.achievCardTablet : s.achievCardMobile,
                          {
                            borderColor: `${ag.color}25`,
                          },
                        ]}
                      >
                        <View style={s.achievCardTopRow}>
                          <View style={[s.achievEmojiWrap, { backgroundColor: `${ag.color}15`, borderColor: `${ag.color}35` }]}>
                            <Text style={s.achievEmoji}>{ag.emoji}</Text>
                          </View>
                          {ag.count > 1 ? (
                            <View style={[s.achievCountBadge, { backgroundColor: ag.color }]}>
                              <Text style={s.achievCountText}>×{ag.count}</Text>
                            </View>
                          ) : (
                            <View style={[s.achievMilestoneBadge, { backgroundColor: `${ag.color}18` }]}>
                              <Text style={[s.achievMilestoneText, { color: ag.color }]}>Badge</Text>
                            </View>
                          )}
                        </View>
                        <View style={s.achievCardBody}>
                          <Text style={s.achievName} numberOfLines={1}>{ag.name}</Text>
                          <Text style={s.achievDesc} numberOfLines={2}>{ag.description || 'Milestone earned in class'}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={s.achievEmptyCard}>
                    <View style={s.achievEmptyIconWrap}>
                      <Trophy size={26} color="#D97706" />
                    </View>
                    <View style={s.achievEmptyContent}>
                      <Text style={s.achievEmptyTitle}>Unlock Your First Badge!</Text>
                      <Text style={s.achievEmptySubtitle}>
                        Complete lessons, ace quizzes, and participate in classroom activities to earn milestone achievements.
                      </Text>
                    </View>
                    <Pressable
                      style={s.achievEmptyAction}
                      onPress={() => router.push('/(tabs)/classroom')}
                    >
                      <Text style={s.achievEmptyActionText}>Go to Class</Text>
                      <ChevronRight size={14} color="#fff" />
                    </Pressable>
                  </View>
                )}
              </View>

              {/* ── EMPTY STATE ─────────────────────────────── */}
              {!classroom && (
                <View style={s.emptyBlock}>
                  <SvgXml xml={OWL} width={90} height={90} />
                  <Text style={s.emptyTitle}>No classroom yet</Text>
                  <Text style={s.emptyBody}>Your teacher will add you to an active class soon!</Text>
                </View>
              )}
            </>
          )}
        </View>
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
  screen: { flex: 1, backgroundColor: '#F0F4FF' },
  scroll: { paddingBottom: 48 },
  mainContainer: {
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 8,
  },
  greetingSub: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  greetingName: { fontSize: 24, color: '#0F172A', fontWeight: '900', lineHeight: 30 },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  xpLabel: { fontSize: 13, fontWeight: '800', color: '#B45309' },

  // ── Row headers ──────────────────────────────────────────────────────────
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  rowTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: -0.2 },
  rowLink: { fontSize: 13, fontWeight: '800', color: '#2563EB' },
  secTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 14, marginTop: 4 },

  // ── Hero & Progress Top Section ──────────────────────────────────────────
  heroRowDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
    marginBottom: 24,
  },
  heroRowMobile: {
    gap: 14,
    marginBottom: 24,
  },
  heroBanner: {
    backgroundColor: '#1D4ED8',
    borderRadius: 22,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 5,
    overflow: 'hidden',
  },
  heroBannerDesktop: {
    flex: 1.25,
  },
  heroContentLeft: {
    flex: 1,
    paddingRight: 12,
  },
  heroLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  heroLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  heroLiveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '900',
    lineHeight: 28,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    marginBottom: 16,
  },
  heroBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  heroBtnText: { fontSize: 13, fontWeight: '800', color: '#1E40AF' },
  heroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Progress card modern ─────────────────────────────────────────────────
  progressCardModern: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E8ECF4',
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    justifyContent: 'space-between',
  },
  progressCardDesktop: {
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressLabel: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  progressBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  progressPct: { fontSize: 12, fontWeight: '800', color: '#1D4ED8' },
  progressTrack: {
    height: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#2563EB' },
  progressStats: { flexDirection: 'row', gap: 10 },
  progressStatPill: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  progressStatVal: { fontSize: 18, fontWeight: '900' },
  progressStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 2,
  },

  // ── Subject tiles ─────────────────────────────────────────────────────────
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 24,
  },
  tile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E8ECF4',
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  tileDesktop: {
    flexBasis: '23.8%',
    maxWidth: '24.2%',
    flexGrow: 1,
  },
  tileTablet: {
    flexBasis: '31.5%',
    maxWidth: '32.2%',
    flexGrow: 1,
  },
  tileMobile: {
    flexBasis: '47.5%',
    maxWidth: '48.5%',
    flexGrow: 1,
  },
  tileIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBody: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    maxWidth: '100%',
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    width: '100%',
    maxWidth: '100%',
    lineHeight: 17,
  },
  tileIndicator: {
    width: 20,
    height: 3.5,
    borderRadius: 2,
  },

  // ── Story card ───────────────────────────────────────────────────────────
  storyCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  storyEmptyCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  storyLeft: { flex: 1, paddingRight: 16 },
  storyBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  storyLiveBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  storyLiveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 24,
    marginBottom: 8,
  },
  storyEmptyDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 14,
    fontWeight: '500',
  },
  storyMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  storyMetaText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  storyPlayBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EA580C',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  storyPlayText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  storyEmptyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  storyHistoryAltBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  storyHistoryAltText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  storyIllustrationWrap: { width: 90, alignItems: 'center', justifyContent: 'center' },
  storyIllustrationCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },

  storyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },
  nextDayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: '#FFF1D6',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  nextDayPillText: { fontSize: 11, fontWeight: '800', color: '#B45309' },
  historyBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyModal: { flex: 1, backgroundColor: '#F5F7FF' },
  historyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 20,
    paddingTop: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F8',
  },
  historyModalTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: '#1a1a2e' },
  historyModalCount: { fontSize: 12, color: '#525C6B', fontWeight: '700', marginTop: 2 },
  historyCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F5F7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECEEF4',
  },
  historyCardNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCardNumText: { fontSize: 11, color: '#2563EB', fontWeight: '900' },
  historyCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCardTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  historyCardMeta: { fontSize: 12, color: '#525C6B', marginTop: 2, fontWeight: '500' },
  historyReplayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: '#EFF6FF',
  },
  historyReplayText: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
  historyPagerRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyPagerBtn: {
    borderRadius: 10,
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  historyPagerBtnDisabled: { backgroundColor: '#F0F0F8' },
  historyPagerBtnText: { fontSize: 12, fontWeight: '800', color: '#1A4DA2' },
  historyPagerBtnTextDisabled: { color: '#B0B8D0' },
  historyPagerText: { fontSize: 12, color: '#7A7A9A', fontWeight: '700' },

  // ── Game cards ───────────────────────────────────────────────────────────
  quizzesGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 24,
  },
  quizzesGridMobile: {
    gap: 10,
    marginBottom: 24,
  },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#E8ECF4',
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  gameCardDesktop: {
    flexBasis: '48.8%',
    maxWidth: '49.5%',
    flexGrow: 1,
  },
  gameIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameInfo: { flex: 1 },
  gameTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 3 },
  gameSub: { fontSize: 12, fontWeight: '500', color: '#64748B' },
  gamePlayBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  gamePlayText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  // ── Loading / empty ──────────────────────────────────────────────────────
  loadingBlock: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingLabel: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  emptyBlock: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  emptyBody: { fontSize: 13, fontWeight: '500', color: '#64748B', textAlign: 'center', lineHeight: 20 },

  // ── Achievements ─────────────────────────────────────────────────────────
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  achievBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  achievBadgeText: { fontSize: 11, fontWeight: '800', color: '#B45309' },
  achievGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  achievGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  achievGridMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    gap: 12,
  },
  achievCardDesktop: {
    flexBasis: '31.5%',
    maxWidth: '32.3%',
    flexGrow: 1,
  },
  achievCardTablet: {
    flexBasis: '48%',
    maxWidth: '49%',
    flexGrow: 1,
  },
  achievCardMobile: {
    flexBasis: '100%',
    width: '100%',
  },
  achievCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  achievEmojiWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievEmoji: {
    fontSize: 26,
  },
  achievMilestoneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  achievMilestoneText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  achievCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  achievCountText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fff',
  },
  achievCardBody: {
    gap: 4,
  },
  achievName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  achievDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
    fontWeight: '500',
  },
  achievEmptyCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  achievEmptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  achievEmptyContent: {
    flex: 1,
    gap: 3,
  },
  achievEmptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
  },
  achievEmptySubtitle: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
    fontWeight: '500',
  },
  achievEmptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexShrink: 0,
  },
  achievEmptyActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },


  // ── Parent-specific ──────────────────────────────────────────────────────
  profileSwitcherWrap: { marginHorizontal: 16, marginBottom: 4, marginTop: 4 },
  profileSwitcherLabel: { fontSize: 12, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4, marginLeft: 2 },
  avatarScroll: { marginHorizontal: -16 },
  avatarItem: { alignItems: 'center', gap: 4, width: 64 },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  avatarName: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  avatarActiveDot: { width: 8, height: 8, borderRadius: 4 },

  activeChildHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  activeChildName: { fontSize: 18, fontWeight: '900', color: Colors.text },
  activeChildMeta: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },
  viewReportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  viewReportBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  statsStrip: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 8 },
  statPill: { flex: 1, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  statPillVal: { fontSize: 15, fontWeight: '900' },
  statPillLbl: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },

  breakdownRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 8 },
  breakdownCard: { flex: 1, borderRadius: Radius.lg, padding: 12, alignItems: 'center', gap: 3, borderWidth: 1, borderColor: Colors.borderLight, ...Shadow.sm },
  breakdownCount: { fontSize: 20, fontWeight: '900', color: Colors.text },
  breakdownLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  breakdownScore: { fontSize: 10, fontWeight: '700', color: Colors.success, marginTop: 2 },

  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 12,
    ...Shadow.sm,
  },
  activityIconWrap: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  activityInfo: { flex: 1, gap: 2 },
  activityTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  activityMeta: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  activityTime: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginBottom: 24 },
  quickActionTile: { width: '47%', borderRadius: Radius.xl, paddingVertical: 18, paddingHorizontal: 14, alignItems: 'center', gap: 8, ...Shadow.sm },
  quickActionIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 13, fontWeight: '800' },

  logicoCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: Radius.xl,
    backgroundColor: '#2D5DC9',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Shadow.sm,
  },
  logicoCardIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  logicoCardTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  logicoCardSubtitle: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 2 },
});
