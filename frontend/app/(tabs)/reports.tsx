import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator, Modal, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSpring, Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import { Star, Flame, BookOpen, Trophy, Zap, TrendingUp, X, ChevronRight, Clock } from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { getStandardLabel } from '../../src/constants/standards';
import {
  CHART_DATA, SUBJECT_DETAILS, STUDENT_SUMMARY, BADGES_DATA,
  type SubjectDetail, type ChartPoint,
} from '../../src/data/studentMockData';

// ── Types ─────────────────────────────────────────────────────────────────────
type Classroom = {
  id: string; title: string; classLevel: string;
  completionPct: number; status: string;
  contents:    Array<{ id: string; title: string; subject?: string }>;
  quizzes:     Array<{ id: string; title: string; totalQuestions: number; difficultyLevel?: string; status: string }>;
  assignments: Array<{ id: string; status: string }>;
};

type TeacherOverview = {
  summary: {
    total_quizzes: string; published_quizzes: string;
    ai_generated_quizzes: string; total_attempts: string; average_score_pct: string;
  };
  classPerformance: Array<{ class_level: string; attempts: string; average_score_pct: string }>;
  topGaps:          Array<{ question_id: string; question_title: string; incorrect_pct: string }>;
};

type Period = 'hour' | 'day' | 'week' | 'month';

// ── Animated Bar ──────────────────────────────────────────────────────────────
const MAX_BAR_H = 80;

function AnimatedBar({ targetPct, isActive, color, label, value, delay }: {
  targetPct: number; isActive: boolean;
  color: string; label: string; value: number; delay: number;
}) {
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    height.value  = 0;
    opacity.value = 0;
    height.value  = withDelay(delay, withSpring(targetPct * MAX_BAR_H, {
      damping: 14, stiffness: 120, mass: 0.8,
    }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) }));
  }, [targetPct, delay]);

  const barStyle = useAnimatedStyle(() => ({
    height: height.value,
    borderRadius: 8,
    backgroundColor: isActive ? color : '#E8F0FE',
  }));

  const wrapStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[bc.barCol, wrapStyle]}>
      {isActive && value > 0 && (
        <Text style={[bc.barValue, { color }]}>{value}</Text>
      )}
      <View style={bc.barTrack}>
        <Animated.View style={barStyle} />
      </View>
      <Text style={[bc.barLabel, { color: isActive ? color : '#B0B8D0', fontWeight: isActive ? '800' : '600' }]}>
        {label}
      </Text>
    </Animated.View>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ data, activeColor = '#4A90E2', todayIdx }: {
  data: ChartPoint[]; activeColor?: string; todayIdx?: number;
}) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={bc.container}>
      {data.map((d, i) => {
        const isNow = todayIdx !== undefined ? i === todayIdx : i === data.length - 1;
        const pct   = d.value / maxVal;
        return (
          <AnimatedBar
            key={`${d.label}-${i}`}
            targetPct={Math.max(pct, 0.03)}
            isActive={isNow}
            color={activeColor}
            label={d.label}
            value={d.value}
            delay={i * 40}
          />
        );
      })}
    </View>
  );
}

const bc = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: 24, paddingBottom: 2 },
  barCol:    { flex: 1, alignItems: 'center', gap: 5 },
  barTrack:  { width: '100%', height: MAX_BAR_H, justifyContent: 'flex-end' },
  barValue:  { fontSize: 9, fontWeight: '800', textAlign: 'center' },
  barLabel:  { fontSize: 9, textAlign: 'center' },
});

// ── Mini Score Sparkline ──────────────────────────────────────────────────────
function ScoreSparkline({ scores, color }: { scores: number[]; color: string }) {
  const W = 80, H = 28;
  const maxS = Math.max(...scores);
  const minS = Math.min(...scores);
  const range = maxS - minS || 1;
  const stepX = W / (scores.length - 1);

  const points = scores.map((s, i) => ({
    x: i * stepX,
    y: H - 4 - ((s - minS) / range) * (H - 8),
  }));

  return (
    <Svg width={W} height={H}>
      {points.map((p, i) => {
        if (i === 0) return null;
        const prev = points[i - 1];
        return (
          <Line key={i} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y}
            stroke={color} strokeWidth={2} strokeLinecap="round" />
        );
      })}
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 3.5 : 2}
          fill={i === points.length - 1 ? color : '#fff'}
          stroke={color} strokeWidth={1.5} />
      ))}
    </Svg>
  );
}

// ── Subject Detail Modal ──────────────────────────────────────────────────────
function SubjectModal({ subject, onClose }: { subject: SubjectDetail; onClose: () => void }) {
  const typeIcon = { lesson: '📖', quiz: '🧩', assignment: '📝' } as const;
  const typeBg   = { lesson: '#D6EAFF', quiz: '#FFE8D6', assignment: '#D6F5D6' } as const;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          {/* Header */}
          <View style={[m.sheetHeader, { backgroundColor: subject.bg }]}>
            <View style={m.sheetHeaderLeft}>
              <Text style={m.sheetEmoji}>{subject.emoji}</Text>
              <View>
                <Text style={m.sheetTitle}>{subject.label}</Text>
                <Text style={m.sheetSub}>{subject.completedLessons} of {subject.totalLessons} completed</Text>
              </View>
            </View>
            <TouchableOpacity style={m.closeBtn} onPress={onClose}>
              <X size={18} color="#5A5A7A" />
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={m.statRow}>
            <View style={m.statItem}>
              <Text style={[m.statVal, { color: subject.color }]}>{subject.progressPct}%</Text>
              <Text style={m.statLbl}>Progress</Text>
            </View>
            <View style={m.statDivider} />
            <View style={m.statItem}>
              <Text style={[m.statVal, { color: subject.color }]}>{subject.avgScore}%</Text>
              <Text style={m.statLbl}>Avg Score</Text>
            </View>
            <View style={m.statDivider} />
            <View style={m.statItem}>
              <Text style={[m.statVal, { color: subject.color }]}>{subject.streak}d</Text>
              <Text style={m.statLbl}>Streak 🔥</Text>
            </View>
            <View style={m.statDivider} />
            <View style={m.statItem}>
              <Text style={[m.statVal, { color: subject.color }]}>{subject.xpEarned}</Text>
              <Text style={m.statLbl}>XP Earned</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={m.progressSection}>
            <View style={m.pRow}>
              <Text style={m.pLabel}>Overall Progress</Text>
              <Text style={[m.pPct, { color: subject.color }]}>{subject.progressPct}%</Text>
            </View>
            <View style={m.track}>
              <View style={[m.fill, { width: `${subject.progressPct}%`, backgroundColor: subject.color }]} />
            </View>
          </View>

          {/* Score sparkline */}
          <View style={m.sparkRow}>
            <View>
              <Text style={m.sparkTitle}>Recent Scores</Text>
              <Text style={m.sparkSub}>Last 5 quizzes</Text>
            </View>
            <ScoreSparkline scores={subject.recentScores} color={subject.color} />
            <Text style={[m.sparkLast, { color: subject.color }]}>
              {subject.recentScores[subject.recentScores.length - 1]}%
            </Text>
          </View>

          {/* Topics list */}
          <Text style={m.topicsTitle}>Topics</Text>
          <ScrollView style={m.topicsList} showsVerticalScrollIndicator={false}>
            {subject.topics.map((t, idx) => {
              const done = t.score >= 0;
              return (
                <View key={t.id} style={[m.topicRow, idx < subject.topics.length - 1 && m.topicBorder]}>
                  <View style={[m.topicIcon, { backgroundColor: typeBg[t.type] }]}>
                    <Text style={{ fontSize: 14 }}>{typeIcon[t.type]}</Text>
                  </View>
                  <View style={m.topicInfo}>
                    <Text style={[m.topicTitle, !done && { color: '#B0B8D0' }]}>{t.title}</Text>
                    <View style={m.topicMeta}>
                      <Clock size={10} color="#B0B8D0" />
                      <Text style={m.topicMetaTxt}>{t.durationMin} min</Text>
                      {t.completedAt ? (
                        <Text style={m.topicMetaTxt}>· {t.completedAt.slice(5)}</Text>
                      ) : (
                        <Text style={[m.topicMetaTxt, { color: '#C0C0D0' }]}>· Not started</Text>
                      )}
                    </View>
                  </View>
                  {done ? (
                    <View style={[m.scorePill, {
                      backgroundColor: t.score >= 80 ? '#D6F5D6' : t.score >= 60 ? '#FFF5CC' : '#FFE8D6',
                    }]}>
                      <Text style={[m.scoreText, {
                        color: t.score >= 80 ? '#3D9A6A' : t.score >= 60 ? '#B8860B' : '#FF7043',
                      }]}>{t.score}%</Text>
                    </View>
                  ) : (
                    <View style={m.lockedPill}>
                      <Text style={m.lockedText}>—</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const { user, apiFetch } = useAuth();

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [classroom, setClassroom]     = useState<Classroom | null>(null);
  const [overview, setOverview]       = useState<TeacherOverview | null>(null);
  const [period, setPeriod]           = useState<Period>('day');
  const [activeSubject, setActiveSubject] = useState<SubjectDetail | null>(null);

  const role = user?.activeRole ?? 'student';
  const isTeacherView = role === 'teacher' || role === 'admin' || role === 'superadmin';
  const isParentView  = role === 'parent';

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (isTeacherView) {
        const res = await apiFetch('/quizzes/teacher/overview');
        if (!res.ok) throw new Error('Failed to load teacher reports');
        setOverview(await res.json());
      } else {
        // Both student and parent use classroom data for now
        const res = await apiFetch('/quizzes/students/classrooms');
        if (res.ok) {
          const payload = await res.json();
          const rooms = (payload.classrooms ?? []) as Classroom[];
          setClassroom(rooms.find((r) => r.status === 'active') ?? rooms[0] ?? null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [apiFetch, isTeacherView]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const chartData  = CHART_DATA[period];
  const todayIdx   = period === 'day'
    ? (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)
    : period === 'hour' ? Math.floor(new Date().getHours() / 1.5) % chartData.length
    : chartData.length - 1;

  // Merge mock stats with real classroom data where available
  const stats = useMemo(() => ({
    lessonsCompleted: classroom?.quizzes?.filter((q) => q.status === 'completed').length || STUDENT_SUMMARY.lessonsCompleted,
    avgScore:         classroom?.completionPct || STUDENT_SUMMARY.avgScore,
    xp:               classroom ? Math.round((classroom.completionPct ?? 0) * 15) || STUDENT_SUMMARY.totalXp : STUDENT_SUMMARY.totalXp,
    dayStreak:        STUDENT_SUMMARY.dayStreak,
    quizzesDone:      classroom?.quizzes?.length || STUDENT_SUMMARY.quizzesDone,
    weeklyXp:         STUDENT_SUMMARY.weeklyXp,
  }), [classroom]);

  const recentActivity = useMemo(() => {
    const items: Array<{ id: string; title: string; type: string; xp: number; when: string }> = [];
    classroom?.quizzes?.slice(0, 2).forEach((q) =>
      items.push({ id: q.id, title: q.title, type: 'quiz', xp: 50, when: 'Today · 10 min ago' }));
    classroom?.contents?.slice(0, 2).forEach((c) =>
      items.push({ id: c.id, title: c.title, type: 'content', xp: 20, when: 'Today · 30 min ago' }));
    if (items.length === 0) {
      return [
        { id: '1', title: 'Completed Numbers Quiz',    type: 'quiz',    xp: 50, when: 'Today · 10 min ago' },
        { id: '2', title: 'Read Baby Dinosaur Story',  type: 'content', xp: 20, when: 'Today · 30 min ago' },
        { id: '3', title: 'Alphabets Practice',        type: 'quiz',    xp: 35, when: 'Yesterday' },
      ];
    }
    return items.slice(0, 4);
  }, [classroom]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={s.loadingText}>Loading report…</Text>
      </View>
    );
  }

  // ── PARENT VIEW ───────────────────────────────────────────────────────────
  if (isParentView) {
    const childName = user?.firstName ? `${user.firstName}'s` : "Your child's";
    const completionPct = classroom?.completionPct ?? 0;
    const quizzesDone   = classroom?.quizzes?.filter((q) => q.status === 'completed').length ?? 0;
    const totalQuizzes  = classroom?.quizzes?.length ?? 0;
    const contentCount  = classroom?.contents?.length ?? 0;
    const pendingTasks  = classroom?.assignments?.filter((a) => a.status !== 'submitted').length ?? 0;

    return (
      <ScrollView style={s.screen} contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={[s.topBar, { paddingTop: Platform.OS === 'ios' ? 2 : 8 }]}>
          <View>
            <Text style={s.greetingSub}>Learning Overview</Text>
            <Text style={s.greetingName}>{childName} Progress</Text>
          </View>
        </View>

        {error ? <Text style={[s.errorText, { margin: 16 }]}>{error}</Text> : null}

        {/* Hero progress card */}
        <View style={[s.parentHero, { backgroundColor: '#9B8EC4' }]}>
          <View style={s.parentHeroTop}>
            <Text style={s.parentHeroTitle}>Overall Progress</Text>
            <Text style={s.parentHeroPct}>{completionPct}%</Text>
          </View>
          <View style={s.parentProgressTrack}>
            <View style={[s.parentProgressFill, { width: `${Math.min(100, completionPct)}%` }]} />
          </View>
          <Text style={s.parentHeroSub}>
            {classroom ? `Enrolled in: ${classroom.title}` : 'No active classroom'}
          </Text>
        </View>

        {/* Stats strip */}
        <View style={s.statsStrip}>
          {[
            { val: quizzesDone,   total: totalQuizzes, label: 'Quizzes Done',   color: '#FF7043', bg: '#FFE8D6' },
            { val: contentCount,  total: null,          label: 'Lessons',         color: '#4A90E2', bg: '#D6EAFF' },
            { val: pendingTasks,  total: null,          label: 'Pending Tasks',  color: '#E6A817', bg: '#FFF5CC' },
          ].map((st) => (
            <View key={st.label} style={[s.parentStat, { backgroundColor: st.bg }]}>
              <Text style={[s.parentStatVal, { color: st.color }]}>
                {st.val}{st.total !== null ? `/${st.total}` : ''}
              </Text>
              <Text style={s.parentStatLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Subject breakdown */}
        {SUBJECT_DETAILS.length > 0 && (
          <>
            <Text style={s.secTitle}>Subject Progress</Text>
            {SUBJECT_DETAILS.map((sub) => (
              <View key={sub.key} style={s.parentSubjectRow}>
                <View style={[s.parentSubjectDot, { backgroundColor: sub.color }]} />
                <Text style={s.parentSubjectName}>{sub.label}</Text>
                <View style={s.parentSubjectTrack}>
                  <View style={[s.parentSubjectFill, { width: `${sub.progressPct}%`, backgroundColor: sub.color }]} />
                </View>
                <Text style={[s.parentSubjectScore, { color: sub.color }]}>{sub.progressPct}%</Text>
              </View>
            ))}
          </>
        )}

        {/* Recent activity */}
        <Text style={[s.secTitle, { marginTop: 16 }]}>Recent Activity</Text>
        <View style={s.activityList}>
          {recentActivity.map((item) => (
            <View key={item.id} style={s.activityRow}>
              <View style={[s.activityDot, { backgroundColor: item.type === 'quiz' ? '#FF7043' : '#4A90E2' }]}>
                <Text style={{ fontSize: 12 }}>{item.type === 'quiz' ? '✏' : '📖'}</Text>
              </View>
              <View style={s.activityBody}>
                <Text style={s.activityTitle}>{item.title}</Text>
                <Text style={s.activityWhen}>{item.when}</Text>
              </View>
              <View style={[s.xpPill, { backgroundColor: '#D6F5D6' }]}>
                <Text style={[s.xpPillText, { color: '#1A6B1A' }]}>+{item.xp} XP</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ── TEACHER VIEW ───────────────────────────────────────────────────────────
  if (isTeacherView) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.scroll}>
        <View style={[s.topBar, { paddingTop: Platform.OS === 'ios' ? 2 : 8 }]}>
          <View>
            <Text style={s.greetingSub}>Teacher Dashboard</Text>
            <Text style={s.greetingName}>{user?.firstName ?? 'Teacher'} 🍎</Text>
          </View>
          <View style={s.xpChip}><TrendingUp size={13} color="#fff" /><Text style={s.xpLabel}>Reports</Text></View>
        </View>

        {error ? <Text style={s.errorText}>{error}</Text> : (
          <>
            <View style={s.grid2}>
              {[
                { val: overview?.summary.total_quizzes ?? '0', label: 'Total Quizzes', bg: '#D6EAFF', color: '#4A90E2' },
                { val: overview?.summary.published_quizzes ?? '0', label: 'Published', bg: '#D6F5D6', color: '#7DC67A' },
                { val: `${Number(overview?.summary.average_score_pct ?? 0).toFixed(0)}%`, label: 'Avg Score', bg: '#FFF5CC', color: '#E6A817' },
                { val: overview?.summary.total_attempts ?? '0', label: 'Attempts', bg: '#FFE8D6', color: '#FF7043' },
              ].map((item) => (
                <View key={item.label} style={[s.statCard2, { backgroundColor: item.bg }]}>
                  <Text style={[s.statVal2, { color: item.color }]}>{item.val}</Text>
                  <Text style={s.statLabel2}>{item.label}</Text>
                </View>
              ))}
            </View>

            <Text style={s.secTitle}>Class Performance</Text>
            <View style={s.card}>
              {overview?.classPerformance?.length ? (
                overview.classPerformance.map((cls) => {
                  const pct = Math.round(Number(cls.average_score_pct));
                  return (
                    <View key={cls.class_level} style={s.progressItem}>
                      <View style={s.pLabelRow}>
                        <Text style={s.pLabel}>{getStandardLabel(cls.class_level)}</Text>
                        <Text style={[s.pPct, { color: '#4A90E2' }]}>{pct}%</Text>
                      </View>
                      <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, pct)}%`, backgroundColor: '#4A90E2' }]} /></View>
                      <Text style={s.progressSub}>{cls.attempts} attempts</Text>
                    </View>
                  );
                })
              ) : <Text style={s.emptyText}>No class data yet.</Text>}
            </View>

            <Text style={s.secTitle}>Topic Gaps</Text>
            <View style={s.card}>
              {overview?.topGaps?.length ? (
                overview.topGaps.map((gap) => {
                  const pct = Number(gap.incorrect_pct);
                  return (
                    <View key={gap.question_id} style={s.gapRow}>
                      <Text style={s.gapLabel} numberOfLines={1}>{gap.question_title}</Text>
                      <View style={[s.pill, { backgroundColor: pct >= 25 ? '#FFE8D6' : '#D6F5D6' }]}>
                        <Text style={[s.pillText, { color: pct >= 25 ? '#FF7043' : '#7DC67A' }]}>{pct.toFixed(0)}% wrong</Text>
                      </View>
                    </View>
                  );
                })
              ) : <Text style={s.emptyText}>No topic gap data yet.</Text>}
            </View>
          </>
        )}
      </ScrollView>
    );
  }

  // ── STUDENT VIEW ──────────────────────────────────────────────────────────
  return (
    <>
      <ScrollView style={s.screen} contentContainerStyle={s.scroll}>

        {/* ─── TOP BAR ─────────────────────────────────────────────────── */}
        <View style={[s.topBar, { paddingTop: Platform.OS === 'ios' ? 2 : 8 }]}>
          <View>
            <Text style={s.greetingSub}>My Progress</Text>
            <Text style={s.greetingName}>{user?.firstName ?? 'Learner'} 👋</Text>
          </View>
          <View style={s.xpChip}>
            <Star size={13} color="#F5C842" fill="#F5C842" />
            <Text style={s.xpLabel}>{stats.xp.toLocaleString()} XP</Text>
          </View>
        </View>

        {/* ─── HERO BANNER ─────────────────────────────────────────────── */}
        <View style={s.heroBanner}>
          <View style={s.heroLeft}>
            <Text style={s.heroEyebrow}>This week you earned</Text>
            <Text style={s.heroXp}>{stats.weeklyXp} XP</Text>
            <Text style={s.heroSub}>You're in the top 15% 🚀 Keep it up!</Text>
          </View>
          <View style={s.heroRing}>
            <View style={s.heroRingInner}>
              <Text style={s.heroRingPct}>{stats.avgScore}%</Text>
              <Text style={s.heroRingLbl}>Score</Text>
            </View>
          </View>
        </View>

        {/* ─── 2×2 STATS ───────────────────────────────────────────────── */}
        <View style={s.grid2}>
          {[
            { icon: <BookOpen size={20} color="#4A90E2" />, val: stats.lessonsCompleted, label: 'Lessons Done',  bg: '#D6EAFF', color: '#4A90E2' },
            { icon: <Flame    size={20} color="#FF7043" />, val: `${stats.dayStreak}🔥`,  label: 'Day Streak',   bg: '#FFE8D6', color: '#FF7043' },
            { icon: <Trophy   size={20} color="#7DC67A" />, val: stats.quizzesDone,       label: 'Quizzes Done', bg: '#D6F5D6', color: '#7DC67A' },
            { icon: <Zap      size={20} color="#E6A817" />, val: stats.xp.toLocaleString(), label: 'Total XP',   bg: '#FFF5CC', color: '#E6A817' },
          ].map((item) => (
            <View key={item.label} style={[s.statCard2, { backgroundColor: item.bg }]}>
              {item.icon}
              <Text style={[s.statVal2, { color: item.color }]}>{item.val}</Text>
              <Text style={s.statLabel2}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ─── ACTIVITY CHART ──────────────────────────────────────────── */}
        <View style={s.chartCard}>
          <View style={s.chartTopRow}>
            <View>
              <Text style={s.chartTitle}>XP Activity</Text>
              <Text style={s.chartSub}>Tap a period to explore</Text>
            </View>
            {/* Period selector */}
            <View style={s.periodTabs}>
              {(['hour', 'day', 'week', 'month'] as Period[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[s.periodTab, period === p && s.periodTabActive]}
                  onPress={() => setPeriod(p)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.periodTabText, period === p && s.periodTabTextActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Total for period */}
          <Text style={s.periodTotal}>
            {chartData.reduce((a, b) => a + b.value, 0)} XP ·{' '}
            <Text style={s.periodTotalSub}>
              {period === 'hour' ? 'today' : period === 'day' ? 'this week' : period === 'week' ? 'this month' : 'this year'}
            </Text>
          </Text>

          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <BarChart data={chartData} activeColor="#4A90E2" todayIdx={todayIdx} />
          </View>
        </View>

        {/* ─── SUBJECT PROGRESS (2-col, tappable) ─────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={s.secTitle}>Subject Progress</Text>
          <Text style={s.secHint}>Tap to explore →</Text>
        </View>
        <View style={s.grid2}>
          {SUBJECT_DETAILS.map((sub) => (
            <TouchableOpacity
              key={sub.key}
              style={[s.subjectCard, { backgroundColor: sub.bg }]}
              onPress={() => setActiveSubject(sub)}
              activeOpacity={0.82}
            >
              <View style={s.subjectTop}>
                <Text style={s.subjectEmoji}>{sub.emoji}</Text>
                <Text style={[s.subjectPct, { color: sub.color }]}>{sub.progressPct}%</Text>
              </View>
              <Text style={s.subjectLabel}>{sub.label}</Text>
              <View style={[s.track, { marginTop: 8 }]}>
                <View style={[s.fill, { width: `${sub.progressPct}%`, backgroundColor: sub.color }]} />
              </View>
              <View style={s.subjectMeta}>
                <Text style={s.subjectMetaTxt}>{sub.completedLessons}/{sub.totalLessons} done</Text>
                <ChevronRight size={12} color={sub.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── CLASSROOM PROGRESS ──────────────────────────────────────── */}
        {classroom && (
          <>
            <Text style={[s.secTitle, { marginTop: 4 }]}>Active Classroom</Text>
            <View style={s.card}>
              <View style={s.classroomTop}>
                <View style={s.classroomDot} />
                <Text style={s.classroomTitle} numberOfLines={1}>{classroom.title}</Text>
                <View style={s.classBadge}><Text style={s.classBadgeText}>{classroom.classLevel}</Text></View>
              </View>
              <View style={s.pLabelRow}>
                <Text style={s.pLabel}>Completion</Text>
                <Text style={[s.pPct, { color: '#4A90E2' }]}>{classroom.completionPct ?? 0}%</Text>
              </View>
              <View style={s.track}>
                <View style={[s.fill, { width: `${Math.min(100, classroom.completionPct ?? 0)}%`, backgroundColor: '#4A90E2' }]} />
              </View>
              <View style={s.countRow}>
                {[
                  { val: classroom.contents?.length ?? 0, label: 'Content', color: '#4A90E2' },
                  { val: classroom.quizzes?.length ?? 0,  label: 'Quizzes', color: '#FF7043' },
                  { val: classroom.assignments?.filter((a) => a.status === 'submitted').length ?? 0, label: 'Submitted', color: '#7DC67A' },
                ].map((item, i, arr) => (
                  <View key={item.label} style={{ flexDirection: 'row', flex: 1 }}>
                    <View style={s.countItem}>
                      <Text style={[s.countVal, { color: item.color }]}>{item.val}</Text>
                      <Text style={s.countLabel}>{item.label}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={s.countDivider} />}
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ─── RECENT ACTIVITY ─────────────────────────────────────────── */}
        <Text style={s.secTitle}>Recent Activity</Text>
        <View style={s.card}>
          {recentActivity.map((act, idx, arr) => (
            <View key={act.id} style={[s.actRow, idx < arr.length - 1 && s.actBorder]}>
              <View style={[s.actIcon, { backgroundColor: act.type === 'quiz' ? '#FFE8D6' : '#D6EAFF' }]}>
                <Text style={{ fontSize: 18 }}>{act.type === 'quiz' ? '🧩' : '📖'}</Text>
              </View>
              <View style={s.actInfo}>
                <Text style={s.actTitle} numberOfLines={1}>{act.title}</Text>
                <Text style={s.actWhen}>{act.when}</Text>
              </View>
              <View style={s.xpBadge}><Text style={s.xpBadgeText}>+{act.xp} XP</Text></View>
            </View>
          ))}
        </View>

        {/* ─── BADGES ──────────────────────────────────────────────────── */}
        <Text style={s.secTitle}>My Badges</Text>
        <View style={s.card}>
          <View style={s.badgeGrid}>
            {BADGES_DATA.map((b) => (
              <View key={b.label} style={[s.badgeItem, !b.earned && { opacity: 0.45 }]}>
                <View style={[s.badgeCircle, { backgroundColor: b.bg }]}>
                  <Text style={{ fontSize: 24 }}>{b.emoji}</Text>
                </View>
                <Text style={s.badgeLabel}>{b.label}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* ─── SUBJECT DETAIL MODAL ────────────────────────────────────────── */}
      {activeSubject && (
        <SubjectModal subject={activeSubject} onClose={() => setActiveSubject(null)} />
      )}
    </>
  );
}

// ── Main Styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#FFFFFF' },
  scroll:      { paddingBottom: 48 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#9A9AB0' },
  errorText:   { fontSize: 13, color: '#FF7043', paddingHorizontal: 20, marginTop: 12 },

  // ── Parent view ──────────────────────────────────────────────────────────
  parentHero:         { marginHorizontal: 16, marginBottom: 16, borderRadius: 22, padding: 20, gap: 10 },
  parentHeroTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  parentHeroTitle:    { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  parentHeroPct:      { fontSize: 36, fontWeight: '900', color: '#fff' },
  parentProgressTrack:{ height: 8, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 999, overflow: 'hidden' },
  parentProgressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 999 },
  parentHeroSub:      { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  statsStrip:         { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 20 },
  parentStat:         { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 4 },
  parentStatVal:      { fontSize: 18, fontWeight: '900' },
  parentStatLabel:    { fontSize: 10, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', textAlign: 'center' },
  parentSubjectRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  parentSubjectDot:   { width: 10, height: 10, borderRadius: 5 },
  parentSubjectName:  { fontSize: 13, fontWeight: '600', color: '#1a1a2e', width: 80 },
  parentSubjectTrack: { flex: 1, height: 6, backgroundColor: '#F0F0F8', borderRadius: 999, overflow: 'hidden' },
  parentSubjectFill:  { height: '100%', borderRadius: 999 },
  parentSubjectScore: { fontSize: 12, fontWeight: '800', width: 36, textAlign: 'right' },
  activityList:  { paddingHorizontal: 16, gap: 10, marginBottom: 24 },
  activityRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F0F0F8' },
  activityDot:   { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F0F8' },
  activityBody:  { flex: 1, gap: 2 },
  activityTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  activityWhen:  { fontSize: 11, color: '#9A9AB0', fontWeight: '500' },
  xpPill:        { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  xpPillText:    { fontSize: 11, fontWeight: '800' },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  greetingSub:  { fontSize: 12, color: '#9A9AB0', fontWeight: '500' },
  greetingName: { fontSize: 22, color: '#1a1a2e', fontWeight: '900', lineHeight: 28 },
  xpChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#4A90E2', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  xpLabel: { fontSize: 13, fontWeight: '800', color: '#fff' },

  // Hero
  heroBanner: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#4A7FE0', borderRadius: 24,
    padding: 20, flexDirection: 'row', alignItems: 'center',
  },
  heroLeft:      { flex: 1 },
  heroEyebrow:   { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500', marginBottom: 2 },
  heroXp:        { fontSize: 30, color: '#fff', fontWeight: '900', lineHeight: 36, marginBottom: 6 },
  heroSub:       { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  heroRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 12,
  },
  heroRingInner: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroRingPct:   { fontSize: 16, fontWeight: '900', color: '#fff', lineHeight: 20 },
  heroRingLbl:   { fontSize: 9,  fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

  // 2-col grid
  grid2: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, paddingHorizontal: 16, marginBottom: 20,
  },
  statCard2: {
    width: '47%', borderRadius: 20,
    paddingVertical: 16, paddingHorizontal: 14, gap: 5,
  },
  statVal2:   { fontSize: 24, fontWeight: '900', lineHeight: 28 },
  statLabel2: { fontSize: 11, fontWeight: '600', color: '#5A5A7A' },

  // Chart card
  chartCard: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    padding: 16,
    borderWidth: 1, borderColor: '#F0F0F8',
    shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 2,
  },
  chartTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  chartTitle:   { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  chartSub:     { fontSize: 11, fontWeight: '500', color: '#9A9AB0', marginTop: 2 },
  periodTotal:  { fontSize: 20, fontWeight: '900', color: '#1a1a2e', marginBottom: 4 },
  periodTotalSub: { fontSize: 13, fontWeight: '500', color: '#9A9AB0' },

  // Period tabs
  periodTabs:       { flexDirection: 'row', gap: 4 },
  periodTab:        { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F0F0F8' },
  periodTabActive:  { backgroundColor: '#4A90E2' },
  periodTabText:    { fontSize: 10, fontWeight: '700', color: '#9A9AB0' },
  periodTabTextActive: { color: '#fff' },

  // Section header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 10,
  },
  secTitle: { fontSize: 17, fontWeight: '900', color: '#1a1a2e', paddingHorizontal: 20, marginBottom: 10 },
  secHint:  { fontSize: 11, fontWeight: '600', color: '#9A9AB0', paddingRight: 20 },

  // Subject cards
  subjectCard: {
    width: '47%', borderRadius: 20, padding: 14,
  },
  subjectTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  subjectEmoji:  { fontSize: 28 },
  subjectPct:    { fontSize: 18, fontWeight: '900' },
  subjectLabel:  { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  subjectMeta:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  subjectMetaTxt:{ fontSize: 10, fontWeight: '600', color: '#7A7A9A' },

  // Generic card
  card: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, gap: 12,
    borderWidth: 1, borderColor: '#F0F0F8',
    shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 2,
  },

  // Progress
  progressItem: { gap: 6 },
  pLabelRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pLabel:       { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  pPct:         { fontSize: 13, fontWeight: '900' },
  progressSub:  { fontSize: 11, color: '#9A9AB0', fontWeight: '500' },
  track:        { height: 8, backgroundColor: '#F0F0F8', borderRadius: 999, overflow: 'hidden' },
  fill:         { height: '100%', borderRadius: 999 },

  // Classroom
  classroomTop:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  classroomDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7DC67A' },
  classroomTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  classBadge:     { backgroundColor: '#D6EAFF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  classBadgeText: { fontSize: 11, fontWeight: '700', color: '#4A90E2' },
  countRow:       { flexDirection: 'row', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F8' },
  countItem:      { flex: 1, alignItems: 'center', gap: 2 },
  countVal:       { fontSize: 20, fontWeight: '900' },
  countLabel:     { fontSize: 9, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase' },
  countDivider:   { width: 1, backgroundColor: '#F0F0F8', alignSelf: 'stretch' },

  // Activity
  actRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 },
  actBorder: { paddingBottom: 12, marginBottom: 2, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  actIcon:   { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actInfo:   { flex: 1 },
  actTitle:  { fontSize: 13, fontWeight: '700', color: '#1a1a2e', marginBottom: 2 },
  actWhen:   { fontSize: 11, fontWeight: '500', color: '#9A9AB0' },
  xpBadge:     { backgroundColor: '#D6F5D6', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  xpBadgeText: { fontSize: 11, fontWeight: '800', color: '#3D9A6A' },

  // Teacher
  gapRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  gapLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
  emptyText:{ fontSize: 12, color: '#9A9AB0', fontWeight: '500' },
  pill:     { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800' },

  // Badges
  badgeGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  badgeItem:   { alignItems: 'center', gap: 5, width: 64 },
  badgeCircle: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  badgeLabel:  { fontSize: 10, fontWeight: '700', color: '#5A5A7A', textAlign: 'center' },
});

// ── Modal Styles ──────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(10,10,30,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '90%', overflow: 'hidden',
  },

  // Header
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingBottom: 16,
  },
  sheetHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetEmoji:  { fontSize: 36 },
  sheetTitle:  { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  sheetSub:    { fontSize: 12, fontWeight: '500', color: '#7A7A9A', marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(90,90,122,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Stats row
  statRow: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F0F0F8',
  },
  statItem:    { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, backgroundColor: '#F0F0F8', alignSelf: 'stretch' },
  statVal:     { fontSize: 18, fontWeight: '900', lineHeight: 22 },
  statLbl:     { fontSize: 9, fontWeight: '600', color: '#9A9AB0', textTransform: 'uppercase' },

  // Progress
  progressSection: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  pRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pLabel:  { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  pPct:    { fontSize: 13, fontWeight: '900' },
  track:   { height: 10, backgroundColor: '#F0F0F8', borderRadius: 999, overflow: 'hidden' },
  fill:    { height: '100%', borderRadius: 999 },

  // Sparkline
  sparkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F8',
  },
  sparkTitle: { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  sparkSub:   { fontSize: 11, fontWeight: '500', color: '#9A9AB0', marginTop: 2 },
  sparkLast:  { fontSize: 16, fontWeight: '900' },

  // Topics
  topicsTitle: {
    fontSize: 15, fontWeight: '900', color: '#1a1a2e',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8,
  },
  topicsList: { maxHeight: 280, paddingHorizontal: 20 },
  topicRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  topicBorder:{ borderBottomWidth: 1, borderBottomColor: '#F5F5FA' },
  topicIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  topicInfo:  { flex: 1 },
  topicTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a2e', marginBottom: 3 },
  topicMeta:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topicMetaTxt: { fontSize: 10, fontWeight: '500', color: '#B0B8D0' },

  // Score pills
  scorePill:  { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  scoreText:  { fontSize: 11, fontWeight: '800' },
  lockedPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: '#F0F0F8' },
  lockedText: { fontSize: 11, fontWeight: '700', color: '#C0C0D0' },
});
