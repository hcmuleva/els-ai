import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TouchableOpacity, View, Image, Linking,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSpring, Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import {
  Star, BookOpen, Trophy, Zap, TrendingUp, X, ChevronRight, Clock,
  BarChart2, Calendar, Timer, School, Layers, ClipboardList,
  Activity, RotateCw, User, Users, CheckCircle, SkipForward, Flame,
} from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';

import { useAuth } from '../../src/context/AuthContext';
import { Colors, Radius, Shadow } from '../../src/theme';
import { OWL, PENGUIN, ELEPHANT, BUTTERFLY, GIRAFFE } from '../../src/assets/svgs';
import { useStudentProfile, type ClassroomRemarkItem } from '../../src/context/StudentProfileContext';
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
  const typeIconMap: Record<string, IconComp2> = { lesson: BookOpen, quiz: Layers, assignment: ClipboardList };
  const typeColor: Record<string, string> = { lesson: '#4A90E2', quiz: '#FF7043', assignment: '#4CAF50' };
  const typeBg   = { lesson: '#D6EAFF', quiz: '#FFE8D6', assignment: '#D6F5D6' } as const;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          {/* Header */}
          <View style={[m.sheetHeader, { backgroundColor: subject.bg }]}>
            <View style={m.sheetHeaderLeft}>
              <SvgXml xml={BUTTERFLY} width={36} height={36} />
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
                    {(() => { const TIcon = typeIconMap[t.type] ?? BookOpen; return <TIcon size={14} color={typeColor[t.type] ?? '#4A90E2'} />; })()}
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
// ── PARENT REPORTS ────────────────────────────────────────────────────────────
const CHILD_COLORS_PR = ['#4A90E2', '#7DC67A', '#FF7043', '#9B8EC4', '#E6A020'];
type IconComp2 = React.ComponentType<{ size: number; color: string }>;
const ACT_ICON_MAP: Record<string, IconComp2> = { content: BookOpen, quiz: Layers, assignment: ClipboardList };
function ActIcon({ type, size = 18, color }: { type: string; size?: number; color: string }) {
  const Icon = ACT_ICON_MAP[type] ?? BookOpen;
  return <Icon size={size} color={color} />;
}
const STATUS_CLR: Record<string, string> = { completed: '#4CAF50', attempted: '#E6A020', pending: '#9A9AB0' };
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function fmtSec(sec: number) {
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  if (sec >= 60) return `${Math.floor(sec / 60)}m`;
  return `${sec}s`;
}

function scoreGrade(pct: number): { label: string; color: string; bg: string } {
  if (pct >= 90) return { label: 'Excellent', color: '#4CAF50', bg: '#E8F5E9' };
  if (pct >= 75) return { label: 'Good', color: '#4A90E2', bg: '#D6EAFF' };
  if (pct >= 50) return { label: 'Average', color: '#E6A020', bg: '#FFF5CC' };
  return { label: 'Needs Work', color: '#FF7043', bg: '#FFE8D6' };
}

function getClassroomAvgScore(item: ClassroomRemarkItem): number {
  const vals = [item.scoreBehavior, item.scoreConfidence, item.scoreParticipation, item.scorePerformance]
    .filter((v): v is number => typeof v === 'number' && v >= 0);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// Proper labeled bar chart with y-axis, gridlines, value labels
function ProperBarChart({
  data, color, unit = '', yTicks = 4, height = 120,
}: {
  data: { label: string; value: number }[];
  color: string;
  unit?: string;
  yTicks?: number;
  height?: number;
}) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  // Round up max to a nice number
  const niceMax = Math.ceil(maxVal / yTicks) * yTicks || yTicks;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((niceMax / yTicks) * i));
  const BAR_H = height;
  const Y_LABEL_W = 32;
  const hasData = data.some((d) => d.value > 0);

  return (
    <View style={{ paddingTop: 4 }}>
      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis */}
        <View style={{ width: Y_LABEL_W, height: BAR_H, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6 }}>
          {[...ticks].reverse().map((t) => (
            <Text key={t} style={{ fontSize: 9, color: '#B0B0C8', fontWeight: '600' }}>
              {t}{unit}
            </Text>
          ))}
        </View>
        {/* Chart area */}
        <View style={{ flex: 1, height: BAR_H, position: 'relative' }}>
          {/* Horizontal gridlines */}
          {ticks.map((t, i) => (
            <View
              key={t}
              style={{
                position: 'absolute', left: 0, right: 0,
                bottom: i === 0 ? 0 : (t / niceMax) * BAR_H,
                height: 1,
                backgroundColor: i === 0 ? '#D8D8E8' : '#F0F0F8',
              }}
            />
          ))}
          {/* Bars */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: '100%', gap: 4, paddingBottom: 1 }}>
            {data.map((d, i) => {
              const barH = niceMax > 0 ? Math.max(d.value > 0 ? 4 : 0, (d.value / niceMax) * (BAR_H - 2)) : 0;
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  {d.value > 0 && (
                    <Text style={{ fontSize: 8, fontWeight: '800', color: color, marginBottom: 2 }}>
                      {d.value}{unit}
                    </Text>
                  )}
                  <View style={{ width: '75%', height: barH, borderRadius: 5, backgroundColor: d.value > 0 ? color : '#F0F0F8', opacity: d.value > 0 ? 1 : 0.5 }} />
                </View>
              );
            })}
          </View>
        </View>
      </View>
      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', marginLeft: Y_LABEL_W, marginTop: 6, gap: 4 }}>
        {data.map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#9A9AB0', fontWeight: '700' }}>
            {d.label}
          </Text>
        ))}
      </View>
      {!hasData && (
        <Text style={{ textAlign: 'center', fontSize: 12, color: '#C8C8D8', fontWeight: '600', marginTop: 8 }}>
          No data yet
        </Text>
      )}
    </View>
  );
}

// 7-day streak calendar grid
function StreakCalendar({ activeDates, streakDays }: { activeDates: string[]; streakDays: number }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return { date: d.toISOString().split('T')[0], label: DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1] };
  });
  const activeSet = new Set(activeDates);
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {days.map(({ date, label }) => {
        const active = activeSet.has(date);
        const isToday = date === today.toISOString().split('T')[0];
        return (
          <View key={date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{
              width: '100%', aspectRatio: 1, borderRadius: 10,
              backgroundColor: active ? '#4A90E2' : isToday ? '#EBF4FF' : '#F4F4FB',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: isToday && !active ? 1.5 : 0,
              borderColor: '#4A90E2',
            }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: active ? '#fff' : isToday ? '#4A90E2' : '#D0D0E0' }}>
                {active ? '✓' : '–'}
              </Text>
            </View>
            <Text style={{ fontSize: 9, color: active ? '#4A90E2' : '#C0C0D0', fontWeight: '700' }}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Quiz attempt detail types ─────────────────────────────────────────────────
type QuizAttemptDetail = {
  attempt: { id: string; quizTitle: string; classLevel: string | null; completedAt: string; scorePct: number; correctCount: number; totalQuestions: number };
  questions: Array<{
    questionId: string; questionTitle: string | null; questionInstruction: string | null;
    questionType: string; questionData: { options?: Array<{ id: string; label?: string; is_correct?: boolean }>; [k: string]: unknown };
    sortOrder: number | null; isCorrect: boolean;
    responseData: { selected_id?: string; selected_ids?: string[]; [k: string]: unknown };
  }>;
};

// ── Section tab definitions ───────────────────────────────────────────────────
type IconComp = React.ComponentType<{ size: number; color: string }>;
const PR_SECTIONS: Array<{ key: string; label: string; Icon: IconComp }> = [
  { key: 'overview',    label: 'Overview',  Icon: BarChart2     },
  { key: 'calendar',   label: 'Days',       Icon: Calendar      },
  { key: 'time',       label: 'Time',       Icon: Timer         },
  { key: 'completion', label: 'Progress',   Icon: TrendingUp    },
  { key: 'classroom',  label: 'Classroom',  Icon: School        },
  { key: 'quizzes',    label: 'Quizzes',    Icon: Layers        },
  { key: 'assignments',label: 'Tasks',      Icon: ClipboardList },
  { key: 'activity',   label: 'Activity',   Icon: Activity      },
];

function ParentReports() {
  const {
    linkedStudents, activeStudent,
    loadingStudents, loadingActivity,
    activity, analytics, quizAttempts, assignments, upcomingClassrooms, classroomRemarks,
    switchToStudent, refreshAll,
  } = useStudentProfile();
  const { apiFetch } = useAuth();

  // Quiz modals state
  const [showAllQuizzes, setShowAllQuizzes] = useState(false);
  const [showAllClassrooms, setShowAllClassrooms] = useState(false);
  const [quizDetail, setQuizDetail]         = useState<QuizAttemptDetail | null>(null);
  const [classroomDetail, setClassroomDetail] = useState<ClassroomRemarkItem | null>(null);
  const [loadingDetail, setLoadingDetail]   = useState(false);
  const [activeTab, setActiveTab]           = useState('overview');

  // Section Y-offset map for smooth scroll
  const scrollRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<Record<string, React.ElementRef<typeof View> | null>>({});
  const sectionOffsets = useRef<Record<string, number>>({});

  const scrollToSection = (key: string) => {
    setActiveTab(key);
    const node = sectionRefs.current[key];
    if (node && scrollRef.current) {
      // @ts-ignore
      node.measureLayout(scrollRef.current, (_x: number, y: number) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
      }, () => {
        const y = sectionOffsets.current[key];
        if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
      });
    } else {
      const y = sectionOffsets.current[key];
      if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
    }
  };

  const openQuizDetail = async (attemptId: string) => {
    if (!activeStudent) return;
    setLoadingDetail(true);
    setQuizDetail(null);
    setShowAllQuizzes(false);
    try {
      const res = await apiFetch(`/students/${activeStudent.id}/quiz-attempts/${attemptId}`);
      if (res.ok) setQuizDetail(await res.json());
    } catch { /* silent */ } finally { setLoadingDetail(false); }
  };

  const openClassroomMedia = async (url?: string | null) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch { /* silent */ }
  };

  const getDateTimeParts = (iso?: string | null) => {
    if (!iso) return { date: '—', time: '—' };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: '—', time: '—' };
    return {
      date: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
      time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    };
  };

  const sum = analytics?.summary;
  const daily = analytics?.daily ?? [];

  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return {
      date: d.toISOString().split('T')[0],
      label: DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1].slice(0, 2),
    };
  });

  const timeChartData = last7.map(({ date, label }) => {
    const row = daily.find((r) => r.date?.toString().split('T')[0] === date);
    return { label, value: Math.round((row?.totalTimeSeconds ?? 0) / 60) };
  });

  const completionChartData = last7.map(({ date, label }) => {
    const row = daily.find((r) => r.date?.toString().split('T')[0] === date);
    return { label, value: Math.round(row?.completionRate ?? 0) };
  });

  const activeDates = daily
    .filter((r) => (r.attemptedCount ?? 0) > 0)
    .map((r) => r.date?.toString().split('T')[0] ?? '');

  const pendingAssignments = assignments.filter((a) => a.status === 'pending');
  const submittedAssignments = assignments.filter((a) => a.status !== 'pending');
  const activeClassrooms = classroomRemarks.active;
  const completedClassrooms = classroomRemarks.completed;
  const classroomCards = activeClassrooms.length > 0
    ? activeClassrooms
    : upcomingClassrooms.map((c) => ({
        id: c.id,
        title: c.title,
        classLevel: c.classLevel,
        status: c.status,
        createdAt: new Date().toISOString(),
        endedAt: null,
        remarkText: null,
        parentNote: null,
        remarkMediaUrl: null,
        scoreBehavior: null,
        scoreConfidence: null,
        scoreParticipation: null,
        scorePerformance: null,
        achievements: [],
      } as ClassroomRemarkItem));

  return (
    <View style={pr.screen}>
      {/* ── TOP BAR + STICKY TABS (always visible) ── */}
      <View style={[pr.topBar, { paddingTop: Platform.OS === 'ios' ? 52 : 18 }]}>
        <View>
          <Text style={pr.topBarSub}>Learning Reports</Text>
          <Text style={pr.topBarTitle}>
            {activeStudent ? `${activeStudent.firstName}'s Progress` : 'My Children'}
          </Text>
        </View>
        <Pressable style={pr.refreshBtn} onPress={refreshAll}>
          <RotateCw size={16} color="#7B4FCA" />
        </Pressable>
      </View>

      {/* ── STICKY SECTION TABS ── */}
      {activeStudent && (
        <View style={pr.stickyTabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
            {PR_SECTIONS.map((sec) => {
              const isActive = activeTab === sec.key;
              return (
                <Pressable key={sec.key} onPress={() => scrollToSection(sec.key)}
                  style={[pr.stickyTab, isActive && pr.stickyTabActive]}>
                  <sec.Icon size={12} color={isActive ? '#4A90E2' : '#9A9AB0'} />
                  <Text style={[pr.stickyTabText, isActive && pr.stickyTabTextActive]}>
                    {sec.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loadingStudents ? (
        <View style={pr.centerBlock}><ActivityIndicator color="#4A90E2" size="large" /></View>
      ) : !activeStudent ? (
        <View style={pr.centerBlock}>
          <SvgXml xml={PENGUIN} width={96} height={96} />
          <Text style={pr.emptyTitle}>No children linked yet</Text>
          <Text style={pr.emptySub}>Ask your school admin to link your children to your account.</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={pr.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── CHILD SWITCHER (in scroll) ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={pr.switcherBar}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
            {linkedStudents.map((child, idx) => {
              const isActive = child.id === activeStudent?.id;
              const cc = CHILD_COLORS_PR[idx % CHILD_COLORS_PR.length];
              return (
                <Pressable key={child.id} onPress={() => switchToStudent(child.id)}
                  style={[pr.childChip, isActive ? { backgroundColor: cc } : { backgroundColor: '#fff', borderWidth: 1.5, borderColor: cc }]}>
                  <View style={[pr.childChipAvatar, { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : cc + '22' }]}>
                    <User size={14} color={isActive ? '#fff' : cc} />
                  </View>
                  <View>
                    <Text style={[pr.childChipName, { color: isActive ? '#fff' : '#1a1a2e' }]}>{child.firstName}</Text>
                    <Text style={[pr.childChipSub, { color: isActive ? 'rgba(255,255,255,0.7)' : '#9A9AB0' }]}>
                      {child.classLevel ? `Class ${child.classLevel}` : 'No class'}
                    </Text>
                  </View>
                  {isActive && <View style={pr.activeChipDot} />}
                </Pressable>
              );
            })}
          </ScrollView>
          {/* ── OVERVIEW SECTION ── */}
          <View ref={(r) => { sectionRefs.current['overview'] = r; }} onLayout={(e) => { sectionOffsets.current['overview'] = e.nativeEvent.layout.y; }}>
          <View style={pr.heroBanner}>
            <View style={pr.heroLeft}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <BarChart2 size={11} color="rgba(255,255,255,0.65)" />
                <Text style={pr.heroSup}>Overall Progress</Text>
              </View>
              <Text style={pr.heroScore}>{sum ? sum.completionRate.toFixed(0) : 0}%</Text>
              <Text style={pr.heroLabel}>completion rate</Text>
              <View style={pr.heroTrack}>
                <View style={[pr.heroFill, { width: `${Math.min(100, sum?.completionRate ?? 0)}%` }]} />
              </View>
              <Text style={pr.heroMeta}>Class {activeStudent.classLevel ?? '—'} · {activeStudent.firstName}</Text>
            </View>
            <View style={pr.heroRight}>
              <View style={pr.streakBadge}>
                <Text style={pr.streakNum}>{sum?.streakDays ?? 0}</Text>
                <Zap size={18} color="#F5C842" fill="#F5C842" />
                <Text style={pr.streakLabel}>day streak</Text>
              </View>
            </View>
          </View>

          {/* ── 4-STAT ROW ── */}
          {sum && (
            <View style={pr.statRow}>
              {([
                { Icon: Layers,        val: sum.attemptedCount,              label: 'Attempted', color: '#4A90E2', bg: '#D6EAFF' },
                { Icon: CheckCircle,   val: sum.completedCount,              label: 'Completed', color: '#4CAF50', bg: '#D6F5D6' },
                { Icon: SkipForward,   val: sum.notAttemptedCount,           label: 'Skipped',   color: '#FF7043', bg: '#FFE8D6' },
                { Icon: Clock,         val: fmtSec(sum.totalTimeSeconds),    label: 'Time',      color: '#9B8EC4', bg: '#EDE4FF' },
              ] as Array<{ Icon: IconComp; val: string | number; label: string; color: string; bg: string }>).map((st) => (
                <View key={st.label} style={[pr.statCard, { backgroundColor: st.bg }]}>
                  <st.Icon size={18} color={st.color} />
                  <Text style={[pr.statVal, { color: st.color }]}>{st.val}</Text>
                  <Text style={pr.statLabel}>{st.label}</Text>
                </View>
              ))}
            </View>
          )}

          </View>{/* end overview section */}

          {/* ── CALENDAR SECTION ── */}
          <View ref={(r) => { sectionRefs.current['calendar'] = r; }} onLayout={(e) => { sectionOffsets.current['calendar'] = e.nativeEvent.layout.y; }}>
          <View style={pr.rowHeader}>
            <Text style={pr.rowTitle}>Active Days — Last 7</Text>
            <Text style={pr.rowChip}>{activeDates.length}/7 days active</Text>
          </View>
          <View style={pr.card}>
            <StreakCalendar activeDates={activeDates} streakDays={sum?.streakDays ?? 0} />
            <View style={pr.cardFooter}>
              <Text style={pr.cardFooterText}>Consistency score</Text>
              <Text style={[pr.cardFooterVal, { color: '#4A90E2' }]}>{sum ? sum.consistencyScore.toFixed(0) : 0}%</Text>
            </View>
          </View>

          </View>{/* end calendar section */}

          {/* ── TIME SECTION ── */}
          <View ref={(r) => { sectionRefs.current['time'] = r; }} onLayout={(e) => { sectionOffsets.current['time'] = e.nativeEvent.layout.y; }}>
          <View style={pr.rowHeader}>
            <Text style={pr.rowTitle}>Time Spent per Day</Text>
            <Text style={pr.rowChip}>{fmtSec(sum?.totalTimeSeconds ?? 0)} total</Text>
          </View>
          <View style={pr.card}>
            <ProperBarChart
              data={timeChartData}
              color="#4A90E2"
              unit="m"
              yTicks={4}
              height={110}
            />
            <Text style={pr.chartNote}>Minutes spent learning each day (last 7 days)</Text>
          </View>

          </View>{/* end time section */}

          {/* ── COMPLETION SECTION ── */}
          <View ref={(r) => { sectionRefs.current['completion'] = r; }} onLayout={(e) => { sectionOffsets.current['completion'] = e.nativeEvent.layout.y; }}>
          <View style={pr.rowHeader}>
            <Text style={pr.rowTitle}>Daily Completion Rate</Text>
            <Text style={pr.rowChip}>avg {sum ? sum.completionRate.toFixed(0) : 0}%</Text>
          </View>
          <View style={pr.card}>
            <ProperBarChart
              data={completionChartData}
              color="#7DC67A"
              unit="%"
              yTicks={4}
              height={110}
            />
            <Text style={pr.chartNote}>Percentage of activities completed each day</Text>
          </View>

          </View>{/* end completion section */}

          {/* ── CLASSROOM SECTION ── */}
          <View ref={(r) => { sectionRefs.current['classroom'] = r; }} onLayout={(e) => { sectionOffsets.current['classroom'] = e.nativeEvent.layout.y; }}>
          <View style={pr.rowHeader}>
            <Text style={pr.rowTitle}>Classroom Status</Text>
            <Text style={pr.rowChip}>{classroomCards.length} active</Text>
          </View>
          {classroomCards.length === 0 ? (
            <View style={pr.emptyCard}><SvgXml xml={GIRAFFE} width={56} height={56} /><Text style={pr.emptyCardText}>No classroom updates yet.</Text></View>
          ) : (
            classroomCards.map((cls, idx) => {
              const cc = CHILD_COLORS_PR[idx % CHILD_COLORS_PR.length];
              const avg = getClassroomAvgScore(cls);
              const grade = scoreGrade(avg);
              return (
                <Pressable key={cls.id} style={pr.classCard} onPress={() => setClassroomDetail(cls)}>
                  <View style={[pr.classIconBox, { backgroundColor: cc + '22' }]}>
                    <Text style={{ fontSize: 22 }}>📚</Text>
                  </View>
                  <View style={pr.classInfo}>
                    <Text style={pr.classTitle} numberOfLines={1}>{cls.title}</Text>
                    <Text style={pr.classMeta}>Class {cls.classLevel} · {cls.status}</Text>
                    <Text style={pr.classDesc} numberOfLines={1}>
                      {cls.remarkText ? `Teacher: ${cls.remarkText}` : 'Tap to see class insights and teacher notes'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[pr.classStatusBadge, { backgroundColor: cls.status === 'active' ? '#D6F5D6' : '#F0F0F8' }]}>
                      <Text style={[pr.classStatusText, { color: cls.status === 'active' ? '#4CAF50' : '#9A9AB0' }]}>
                        {cls.status === 'active' ? 'Active' : cls.status}
                      </Text>
                    </View>
                    {avg > 0 && (
                      <View style={[pr.smallGradeBadge, { backgroundColor: grade.bg }]}>
                        <Text style={[pr.smallGradeText, { color: grade.color }]}>{avg}%</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}

          {completedClassrooms.length > 0 && (
            <>
              <View style={pr.rowHeader}>
                <Text style={pr.rowTitle}>📚 Classroom History</Text>
                <Text style={pr.rowChip}>{completedClassrooms.length} ended</Text>
              </View>
              {completedClassrooms.slice(0, 3).map((cls, idx) => (
                <Pressable key={`${cls.id}-${idx}`} style={pr.historyCard} onPress={() => setClassroomDetail(cls)}>
                  <View style={pr.historyDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={pr.historyTitle} numberOfLines={1}>{cls.title}</Text>
                    <Text style={pr.historyMeta}>
                      Ended {cls.endedAt ? new Date(cls.endedAt).toLocaleDateString() : '—'} · Class {cls.classLevel}
                    </Text>
                  </View>
                  <Text style={pr.historyCta}>View</Text>
                </Pressable>
              ))}
              {completedClassrooms.length > 3 && (
                <Pressable style={pr.viewAllBtn} onPress={() => setShowAllClassrooms(true)}>
                  <Text style={pr.viewAllBtnText}>View Classroom History ›</Text>
                </Pressable>
              )}
            </>
          )}
          </View>{/* end classroom section */}

          {/* ── QUIZZES SECTION ── */}
          <View ref={(r) => { sectionRefs.current['quizzes'] = r; }} onLayout={(e) => { sectionOffsets.current['quizzes'] = e.nativeEvent.layout.y; }}>

          {/* ── QUIZ RESULTS ── */}
          <View style={pr.rowHeader}>
            <Text style={pr.rowTitle}>Quiz Results</Text>
            <Text style={pr.rowChip}>{quizAttempts.length} attempt{quizAttempts.length !== 1 ? 's' : ''}</Text>
          </View>
          {loadingActivity ? (
            <ActivityIndicator color="#4A90E2" style={{ marginVertical: 12 }} />
          ) : quizAttempts.length === 0 ? (
            <View style={pr.emptyCard}><SvgXml xml={OWL} width={56} height={56} /><Text style={pr.emptyCardText}>No quiz attempts yet — encourage {activeStudent.firstName} to try a quiz!</Text></View>
          ) : (
            <>
              {quizAttempts.slice(0, 4).map((attempt) => {
                const grade = scoreGrade(attempt.scorePct);
                const attended = getDateTimeParts(attempt.attemptedAt);
                return (
                  <Pressable key={attempt.id} style={pr.quizCard} onPress={() => openQuizDetail(attempt.id)}>
                    <View style={[pr.quizIconBox, { backgroundColor: '#EDE4FF' }]}>
                      <Layers size={22} color="#9B8EC4" />
                    </View>
                    <View style={pr.quizInfo}>
                      <Text style={pr.quizTitle} numberOfLines={1}>{attempt.quizTitle}</Text>
                      <Text style={pr.quizMeta}>{attempt.correctCount}/{attempt.totalQuestions} correct</Text>
                      <View style={pr.metaInfoStack}>
                        <View style={pr.metaInfoRow}>
                          <Calendar size={12} color="#9A9AB0" />
                          <Text style={pr.metaInfoLabel}>Date:</Text>
                          <Text style={pr.metaInfoValue}>{attended.date}</Text>
                        </View>
                        <View style={pr.metaInfoRow}>
                          <Clock size={12} color="#9A9AB0" />
                          <Text style={pr.metaInfoLabel}>Time:</Text>
                          <Text style={pr.metaInfoValue}>{attended.time}</Text>
                        </View>
                      </View>
                      <View style={pr.quizProgressTrack}>
                        <View style={[pr.quizProgressFill, { width: `${attempt.scorePct}%`, backgroundColor: grade.color }]} />
                      </View>
                    </View>
                    <View style={[pr.scoreBadge, { backgroundColor: grade.bg }]}>
                      <Text style={[pr.scoreNum, { color: grade.color }]}>{attempt.scorePct}%</Text>
                      <Text style={[pr.scoreLabel, { color: grade.color }]}>{grade.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {quizAttempts.length > 4 && (
                <Pressable style={pr.viewAllBtn} onPress={() => setShowAllQuizzes(true)}>
                  <Text style={pr.viewAllBtnText}>View All {quizAttempts.length} Attempts ›</Text>
                </Pressable>
              )}
            </>
          )}
          </View>{/* end quizzes section */}

          {/* ── ASSIGNMENTS SECTION ── */}
          <View ref={(r) => { sectionRefs.current['assignments'] = r; }} onLayout={(e) => { sectionOffsets.current['assignments'] = e.nativeEvent.layout.y; }}>
          <View style={pr.rowHeader}>
            <Text style={pr.rowTitle}>Assignments</Text>
            {pendingAssignments.length > 0 && (
              <View style={[pr.liveBadge, { backgroundColor: '#FFE8D6' }]}>
                <Text style={[pr.liveBadgeText, { color: '#FF7043' }]}>{pendingAssignments.length} pending</Text>
              </View>
            )}
          </View>

          {pendingAssignments.length > 0 && (
            <>
              <Text style={pr.groupLabel}>⏳ Pending</Text>
              {pendingAssignments.map((a) => (
                <View key={a.id} style={pr.assignCard}>
                  <View style={[pr.assignIconBox, { backgroundColor: '#FFE8D6' }]}>
                    <ClipboardList size={20} color="#FF7043" />
                  </View>
                  <View style={pr.assignInfo}>
                    <Text style={pr.assignTitle} numberOfLines={1}>{a.title || 'Untitled Assignment'}</Text>
                    <Text style={pr.assignMeta}>Not submitted yet</Text>
                  </View>
                  <View style={[pr.assignStatusBadge, { backgroundColor: '#FFE8D6' }]}>
                    <Text style={[pr.assignStatusText, { color: '#FF7043' }]}>Pending</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {submittedAssignments.length > 0 && (
            <>
              <Text style={[pr.groupLabel, pendingAssignments.length > 0 ? { marginTop: 14 } : {}]}>✅ Submitted</Text>
              {submittedAssignments.slice(0, 5).map((a) => {
                const grade = a.grade !== undefined ? scoreGrade(a.grade) : null;
                const submitted = getDateTimeParts(a.submittedAt);
                return (
                  <View key={a.id} style={pr.assignCard}>
                    <View style={[pr.assignIconBox, { backgroundColor: '#D6F5D6' }]}>
                      <CheckCircle size={20} color="#4CAF50" />
                    </View>
                    <View style={pr.assignInfo}>
                      <Text style={pr.assignTitle} numberOfLines={1}>{a.title || 'Untitled Assignment'}</Text>
                      {a.submittedAt ? (
                        <View style={pr.metaInfoStack}>
                          <View style={pr.metaInfoRow}>
                            <Calendar size={12} color="#9A9AB0" />
                            <Text style={pr.metaInfoLabel}>Date:</Text>
                            <Text style={pr.metaInfoValue}>{submitted.date}</Text>
                          </View>
                          <View style={pr.metaInfoRow}>
                            <Clock size={12} color="#9A9AB0" />
                            <Text style={pr.metaInfoLabel}>Time:</Text>
                            <Text style={pr.metaInfoValue}>{submitted.time}</Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={pr.assignMeta}>Submitted</Text>
                      )}
                      {a.feedback && <Text style={pr.assignFeedback} numberOfLines={1}>{a.feedback}</Text>}
                    </View>
                    {grade && (
                      <View style={[pr.scoreBadge, { backgroundColor: grade.bg }]}>
                        <Text style={[pr.scoreNum, { color: grade.color, fontSize: 14 }]}>{a.grade}%</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {assignments.length === 0 && (
            <View style={pr.emptyCard}><SvgXml xml={ELEPHANT} width={56} height={56} /><Text style={pr.emptyCardText}>No assignments found for {activeStudent.firstName}.</Text></View>
          )}

          </View>{/* end assignments section */}

          {/* ── ACTIVITY SECTION ── */}
          <View ref={(r) => { sectionRefs.current['activity'] = r; }} onLayout={(e) => { sectionOffsets.current['activity'] = e.nativeEvent.layout.y; }}>
          <View style={pr.rowHeader}>
            <Text style={pr.rowTitle}>Recent Activity</Text>
            <Text style={pr.rowChip}>{activity.length} total</Text>
          </View>
          {loadingActivity ? (
            <ActivityIndicator color="#4A90E2" style={{ marginVertical: 12 }} />
          ) : activity.length === 0 ? (
            <View style={pr.emptyCard}><SvgXml xml={BUTTERFLY} width={56} height={56} /><Text style={pr.emptyCardText}>No activity recorded yet.</Text></View>
          ) : (
            activity.slice(0, 8).map((item) => {
              const dotColor = STATUS_CLR[item.status] ?? '#9A9AB0';
              return (
                <View key={item.id} style={pr.actCard}>
                  <View style={[pr.actIconBox, { backgroundColor: dotColor + '22' }]}>
                    <ActIcon type={item.activityType} size={18} color={dotColor} />
                  </View>
                  <View style={pr.actInfo}>
                    <Text style={pr.actTitle} numberOfLines={1}>{item.referenceTitle ?? item.activityType}</Text>
                    <Text style={pr.actMeta}>
                      {item.activityDate}
                      {item.score !== undefined ? ` · Score: ${item.score}%` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[pr.statusPill, { backgroundColor: dotColor + '22' }]}>
                      <Text style={[pr.statusPillText, { color: dotColor }]}>{item.status}</Text>
                    </View>
                    {item.timeSpentSeconds > 0 && (
                      <Text style={pr.actTime}>{fmtSec(item.timeSpentSeconds)}</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
          </View>{/* end activity section */}
        </ScrollView>
      )}

      {/* ── VIEW ALL QUIZZES MODAL ── */}
      <Modal visible={showAllQuizzes} animationType="slide" transparent onRequestClose={() => setShowAllQuizzes(false)}>
        <View style={pr.modalOverlay}>
          <View style={pr.modalSheet}>
            <View style={pr.modalHeader}>
              <View>
                <Text style={pr.modalTitle}>All Quiz Attempts</Text>
                <Text style={pr.modalSub}>{activeStudent?.firstName} · {quizAttempts.length} total</Text>
              </View>
              <Pressable style={pr.modalClose} onPress={() => setShowAllQuizzes(false)}>
                <X size={18} color="#9A9AB0" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
              {quizAttempts.map((attempt, idx) => {
                const grade = scoreGrade(attempt.scorePct);
                const attended = getDateTimeParts(attempt.attemptedAt);
                return (
                  <Pressable key={attempt.id} style={pr.modalQuizRow} onPress={() => openQuizDetail(attempt.id)}>
                    <View style={pr.modalQuizNum}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#9A9AB0' }}>#{idx + 1}</Text>
                    </View>
                    <View style={pr.quizInfo}>
                      <Text style={pr.quizTitle} numberOfLines={1}>{attempt.quizTitle}</Text>
                      <Text style={pr.quizMeta}>{attempt.correctCount}/{attempt.totalQuestions} correct</Text>
                      <View style={pr.metaInfoStack}>
                        <View style={pr.metaInfoRow}>
                          <Calendar size={12} color="#9A9AB0" />
                          <Text style={pr.metaInfoLabel}>Date:</Text>
                          <Text style={pr.metaInfoValue}>{attended.date}</Text>
                        </View>
                        <View style={pr.metaInfoRow}>
                          <Clock size={12} color="#9A9AB0" />
                          <Text style={pr.metaInfoLabel}>Time:</Text>
                          <Text style={pr.metaInfoValue}>{attended.time}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[pr.scoreBadge, { backgroundColor: grade.bg }]}>
                      <Text style={[pr.scoreNum, { color: grade.color }]}>{attempt.scorePct}%</Text>
                      <Text style={[pr.scoreLabel, { color: grade.color }]}>{grade.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── VIEW ALL CLASSROOM HISTORY MODAL ── */}
      <Modal visible={showAllClassrooms} animationType="slide" transparent onRequestClose={() => setShowAllClassrooms(false)}>
        <View style={pr.modalOverlay}>
          <View style={pr.modalSheet}>
            <View style={pr.modalHeader}>
              <View>
                <Text style={pr.modalTitle}>Classroom History</Text>
                <Text style={pr.modalSub}>{activeStudent?.firstName} · {completedClassrooms.length} ended classes</Text>
              </View>
              <Pressable style={pr.modalClose} onPress={() => setShowAllClassrooms(false)}>
                <X size={18} color="#9A9AB0" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
              {completedClassrooms.map((cls, idx) => (
                <Pressable key={cls.id} style={pr.modalQuizRow} onPress={() => { setShowAllClassrooms(false); setClassroomDetail(cls); }}>
                  <View style={pr.modalQuizNum}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#9A9AB0' }}>#{idx + 1}</Text>
                  </View>
                  <View style={pr.quizInfo}>
                    <Text style={pr.quizTitle} numberOfLines={1}>{cls.title}</Text>
                    <Text style={pr.quizMeta}>
                      Ended {cls.endedAt ? new Date(cls.endedAt).toLocaleDateString() : '—'} · Class {cls.classLevel}
                    </Text>
                  </View>
                  <View style={pr.classStatusBadge}>
                    <Text style={[pr.classStatusText, { color: '#4A90E2' }]}>Details</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── CLASSROOM DETAIL MODAL ── */}
      <Modal visible={!!classroomDetail} animationType="slide" transparent onRequestClose={() => setClassroomDetail(null)}>
        <View style={pr.modalOverlay}>
          <View style={pr.modalSheet}>
            {classroomDetail && (
              <>
                <View style={pr.modalHeader}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={pr.modalTitle} numberOfLines={2}>{classroomDetail.title}</Text>
                    <Text style={pr.modalSub}>
                      Class {classroomDetail.classLevel} · {classroomDetail.status}
                      {classroomDetail.endedAt ? ` · ${new Date(classroomDetail.endedAt).toLocaleDateString()}` : ''}
                    </Text>
                  </View>
                  <Pressable style={pr.modalClose} onPress={() => setClassroomDetail(null)}>
                    <X size={18} color="#9A9AB0" />
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }} showsVerticalScrollIndicator={false}>
                  <View style={pr.detailPanel}>
                    <Text style={pr.detailPanelTitle}>Classroom performance</Text>
                    <ProperBarChart
                      data={[
                        { label: 'Beh', value: classroomDetail.scoreBehavior ?? 0 },
                        { label: 'Conf', value: classroomDetail.scoreConfidence ?? 0 },
                        { label: 'Part', value: classroomDetail.scoreParticipation ?? 0 },
                        { label: 'Perf', value: classroomDetail.scorePerformance ?? 0 },
                      ]}
                      color="#4A90E2"
                      unit="%"
                      yTicks={4}
                      height={100}
                    />
                  </View>

                  <View style={pr.detailPanel}>
                    <Text style={pr.detailPanelTitle}>Teacher remarks</Text>
                    <Text style={pr.detailBodyText}>
                      {classroomDetail.remarkText || 'No teacher remark added yet.'}
                    </Text>
                    {classroomDetail.parentNote && (
                      <>
                        <Text style={[pr.detailPanelTitle, { marginTop: 10 }]}>Note for parent</Text>
                        <Text style={pr.detailBodyText}>{classroomDetail.parentNote}</Text>
                      </>
                    )}
                  </View>

                  <View style={pr.detailPanel}>
                    <Text style={pr.detailPanelTitle}>Achievements</Text>
                    {classroomDetail.achievements.length === 0 ? (
                      <Text style={pr.detailBodyText}>No achievements recorded yet.</Text>
                    ) : (
                      <View style={pr.achievementWrap}>
                        {classroomDetail.achievements.map((a) => (
                          <View key={a.id} style={[pr.achievementChip, { backgroundColor: `${a.color}22` }]}>
                            <Text style={pr.achievementEmoji}>{a.emoji}</Text>
                            <Text style={[pr.achievementText, { color: a.color }]} numberOfLines={1}>{a.name}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {classroomDetail.remarkMediaUrl && (
                    <View style={pr.detailPanel}>
                      <Text style={pr.detailPanelTitle}>Teacher shared media</Text>
                      {/\.(png|jpe?g|gif|webp)$/i.test(classroomDetail.remarkMediaUrl) && (
                        <Image source={{ uri: classroomDetail.remarkMediaUrl }} style={pr.mediaPreview} resizeMode="cover" />
                      )}
                      <Pressable style={pr.mediaBtn} onPress={() => openClassroomMedia(classroomDetail.remarkMediaUrl)}>
                        <Text style={pr.mediaBtnText}>Open Media</Text>
                      </Pressable>
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── QUIZ DETAIL MODAL ── */}
      <Modal visible={!!quizDetail || loadingDetail} animationType="slide" transparent onRequestClose={() => setQuizDetail(null)}>
        <View style={pr.modalOverlay}>
          <View style={pr.modalSheet}>
            {loadingDetail ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                <ActivityIndicator size="large" color="#4A90E2" />
                <Text style={{ marginTop: 12, color: '#9A9AB0', fontWeight: '600' }}>Loading questions…</Text>
              </View>
            ) : quizDetail ? (
              <>
                {(() => {
                  const attended = getDateTimeParts(quizDetail.attempt.completedAt);
                  return (
                <View style={pr.modalHeader}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={pr.modalTitle} numberOfLines={2}>{quizDetail.attempt.quizTitle}</Text>
                    <Text style={pr.modalSub}>{quizDetail.attempt.correctCount}/{quizDetail.attempt.totalQuestions} correct · {quizDetail.attempt.scorePct}%</Text>
                    <View style={pr.modalMetaStack}>
                      <View style={pr.modalMetaRow}>
                        <Calendar size={12} color="#9A9AB0" />
                        <Text style={pr.modalMetaLabel}>Date:</Text>
                        <Text style={pr.modalMetaValue}>{attended.date}</Text>
                      </View>
                      <View style={pr.modalMetaRow}>
                        <Clock size={12} color="#9A9AB0" />
                        <Text style={pr.modalMetaLabel}>Time:</Text>
                        <Text style={pr.modalMetaValue}>{attended.time}</Text>
                      </View>
                    </View>
                  </View>
                  <Pressable style={pr.modalClose} onPress={() => setQuizDetail(null)}>
                    <X size={18} color="#9A9AB0" />
                  </Pressable>
                </View>
                  );
                })()}
                <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
                  {quizDetail.questions.map((q, i) => {
                    const options = (q.questionData.options ?? []) as Array<{ id: string; label?: string; is_correct?: boolean }>;
                    const selectedId = q.responseData.selected_id;
                    const selectedIds = Array.isArray(q.responseData.selected_ids) ? q.responseData.selected_ids as string[] : [];
                    const selectedAny = selectedId ?? selectedIds[0];
                    const selectedLabel = options.find((o) => o.id === selectedAny)?.label ?? selectedAny ?? '—';
                    const correctOption = options.find((o) => o.is_correct);
                    const correctLabel = correctOption?.label ?? correctOption?.id ?? '—';
                    const bannerBg = q.isCorrect ? '#E8F5E9' : '#FFF3F0';
                    const bannerColor = q.isCorrect ? '#2E7D32' : '#C62828';
                    return (
                      <View key={q.questionId} style={pr.detailQuestionCard}>
                        {/* Colored top banner */}
                        <View style={[pr.detailQuestionBanner, { backgroundColor: bannerBg }]}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: bannerColor, opacity: 0.7 }}>
                            Question {i + 1}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: q.isCorrect ? '#4CAF50' : '#FF5252', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                            <Text style={{ fontSize: 13, fontWeight: '900', color: '#fff' }}>
                              {q.isCorrect ? '✓ Correct' : '✗ Wrong'}
                            </Text>
                          </View>
                        </View>
                        {/* Question body */}
                        <View style={pr.detailQuestionInner}>
                          <Text style={pr.detailQTitle}>{q.questionTitle ?? q.questionInstruction ?? `Question ${i + 1}`}</Text>
                          {q.questionInstruction && q.questionTitle && (
                            <Text style={{ fontSize: 12, color: '#9A9AB0', fontWeight: '500', marginTop: 2, marginBottom: 4 }}>{q.questionInstruction}</Text>
                          )}
                          {options.length > 0 && (
                            <View style={{ gap: 8, marginTop: 12 }}>
                              {options.map((o) => {
                                const isSelected = o.id === selectedAny || selectedIds.includes(o.id);
                                const isCor = o.is_correct === true;
                                let optBg = '#F8F9FC';
                                let optBorder = '#EAECF0';
                                let optTextColor = '#374151';
                                let iconEl: string | null = null;
                                if (isCor && isSelected) { optBg = '#E8F5E9'; optBorder = '#4CAF50'; optTextColor = '#1B5E20'; iconEl = '✓'; }
                                else if (isCor) { optBg = '#E8F5E9'; optBorder = '#4CAF50'; optTextColor = '#1B5E20'; iconEl = '✓'; }
                                else if (isSelected) { optBg = '#FFF3F0'; optBorder = '#FF5252'; optTextColor = '#B71C1C'; iconEl = '✗'; }
                                return (
                                  <View key={o.id} style={[pr.detailOption, { backgroundColor: optBg, borderColor: optBorder }]}>
                                    <Text style={[pr.detailOptionText, { color: optTextColor }]}>{o.label ?? o.id}</Text>
                                    {iconEl && (
                                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isCor ? '#4CAF50' : '#FF5252', alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ fontSize: 13, color: '#fff', fontWeight: '900' }}>{iconEl}</Text>
                                      </View>
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                          )}
                          {!q.isCorrect && options.length > 0 && (
                            <View style={[pr.detailAnswerRow, { marginTop: 12 }]}>
                              <Text style={pr.detailAnswerLabel}>You answered: </Text>
                              <Text style={[pr.detailAnswerVal, { color: '#FF5252' }]}>{selectedLabel}</Text>
                              <Text style={[pr.detailAnswerLabel, { marginLeft: 10 }]}>Correct: </Text>
                              <Text style={[pr.detailAnswerVal, { color: '#4CAF50' }]}>{correctLabel}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function ReportsScreen() {
  const { user, apiFetch } = useAuth();
  const {
    linkedStudents, activeStudent,
    loadingStudents, loadingActivity, loadingAnalytics,
    activity: studentActivity, analytics: studentAnalytics,
    switchToStudent,
  } = useStudentProfile();

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
    return <ParentReports />;
  }

  // ── TEACHER VIEW ───────────────────────────────────────────────────────────
  if (isTeacherView) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.scroll}>
        <View style={[s.topBar, { paddingTop: Platform.OS === 'ios' ? 2 : 8 }]}>
          <View>
            <Text style={s.greetingSub}>Teacher Dashboard</Text>
            <Text style={s.greetingName}>{user?.firstName ?? 'Teacher'}</Text>
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
                <ActIcon type={act.type} size={18} color={act.type === 'quiz' ? '#FF7043' : '#4A90E2'} />
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
  childChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5 },
  childChipEmoji: { fontSize: 16 },
  childChipName: { fontSize: 13, fontWeight: '800' },
  childChipBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  childChipBadgeText: { fontSize: 10, fontWeight: '800' },
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
  emptyBlock: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e', textAlign: 'center' },
  emptyBody:  { fontSize: 13, fontWeight: '500', color: '#9A9AB0', textAlign: 'center', lineHeight: 20 },
});

// ── ParentReports Styles ──────────────────────────────────────────────────────
const pr = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F9FC' },
  scroll: { paddingBottom: 48, paddingTop: 0 },

  // Top bar — matches student dashboard
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  topBarSub:   { fontSize: 11, fontWeight: '700', color: '#9A9AB0', letterSpacing: 0.8, textTransform: 'uppercase' },
  topBarTitle: { fontSize: 22, fontWeight: '900', color: '#1a1a2e', marginTop: 2 },
  refreshBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EDE4FF', alignItems: 'center', justifyContent: 'center' },
  refreshBtnText: { fontSize: 18, fontWeight: '700', color: '#7B4FCA' },

  // Child switcher bar
  switcherBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  childChip:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, height: 56 },
  childChipAvatar: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  childChipName:   { fontSize: 12, fontWeight: '800' },
  childChipSub:    { fontSize: 9, fontWeight: '600', marginTop: 0 },
  activeChipDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)', marginLeft: 2 },

  // Center (loading / no children)
  centerBlock: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 12 },
  emptyTitle:  { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptySub:    { fontSize: 13, color: '#9A9AB0', fontWeight: '500', textAlign: 'center', lineHeight: 20 },

  // Hero banner — matches student dashboard heroBanner
  heroBanner: { marginHorizontal: 16, marginTop: 0, marginBottom: 8, borderRadius: 22, backgroundColor: '#4A90E2', padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#4A90E2', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, elevation: 5 },
  heroLeft:   { flex: 1, gap: 4 },
  heroRight:  { justifyContent: 'center' },
  heroSup:    { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.65)', letterSpacing: 1, textTransform: 'uppercase' },
  heroScore:  { fontSize: 48, fontWeight: '900', color: '#fff', lineHeight: 54 },
  heroLabel:  { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  heroTrack:  { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 999, overflow: 'hidden', marginTop: 6 },
  heroFill:   { height: '100%', backgroundColor: '#fff', borderRadius: 999 },
  heroMeta:   { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600', marginTop: 4 },
  streakBadge: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 18, padding: 14, alignItems: 'center', gap: 2, minWidth: 72 },
  streakNum:   { fontSize: 28, fontWeight: '900', color: '#fff' },
  streakFire:  { fontSize: 18 },
  streakLabel: { fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: '700', textTransform: 'uppercase' },

  // 4-stat row
  statRow:   { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  statCard:  { flex: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  statEmoji: { fontSize: 20 },
  statVal:   { fontSize: 15, fontWeight: '900' },
  statLabel: { fontSize: 8, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', textAlign: 'center' },

  // Section row header — matches student dashboard rowHeader
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  rowTitle:  { fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  rowChip:   { fontSize: 12, fontWeight: '700', color: '#4A90E2' },

  // Card — matches student dashboard gameCard shadow
  card: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F0F0F8', shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F4F4FB' },
  cardFooterText: { fontSize: 12, color: '#9A9AB0', fontWeight: '600' },
  cardFooterVal:  { fontSize: 14, fontWeight: '900' },
  chartNote: { fontSize: 10, color: '#B0B8CC', fontWeight: '600', marginTop: 10, textAlign: 'center' },

  // Live badge
  liveBadge:     { backgroundColor: '#D6F5D6', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  liveBadgeText: { fontSize: 11, fontWeight: '800', color: '#4CAF50' },

  // Classroom card — matches gameCard
  classCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 18, padding: 14, gap: 12, borderWidth: 1, borderColor: '#F0F0F8', shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 2 },
  classIconBox:    { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  classInfo:       { flex: 1, gap: 2 },
  classTitle:      { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  classMeta:       { fontSize: 11, color: '#9A9AB0', fontWeight: '600' },
  classDesc:       { fontSize: 11, color: '#B0B8CC', fontWeight: '500', marginTop: 2 },
  classStatusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  classStatusText:  { fontSize: 11, fontWeight: '800' },
  smallGradeBadge:  { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  smallGradeText:   { fontSize: 10, fontWeight: '800' },
  historyCard:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#F0F0F8' },
  historyDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4A90E2' },
  historyTitle:     { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  historyMeta:      { fontSize: 11, color: '#9A9AB0', fontWeight: '600', marginTop: 2 },
  historyCta:       { fontSize: 12, color: '#4A90E2', fontWeight: '800' },

  // Quiz result card
  quizCard:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 18, padding: 14, gap: 12, borderWidth: 1, borderColor: '#F0F0F8', shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 2 },
  quizIconBox:       { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quizInfo:          { flex: 1, gap: 3 },
  quizTitle:         { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  quizMeta:          { fontSize: 11, color: '#9A9AB0', fontWeight: '600' },
  metaInfoStack:     { gap: 2, marginTop: 2 },
  metaInfoRow:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaInfoLabel:     { fontSize: 10, fontWeight: '800', color: '#9A9AB0', minWidth: 34 },
  metaInfoValue:     { fontSize: 10, fontWeight: '700', color: '#64748b', flexShrink: 1 },
  quizProgressTrack: { height: 5, backgroundColor: '#F0F0F8', borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  quizProgressFill:  { height: '100%', borderRadius: 999 },
  scoreBadge:        { borderRadius: 14, padding: 10, alignItems: 'center', minWidth: 68 },
  scoreNum:          { fontSize: 18, fontWeight: '900' },
  scoreLabel:        { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },

  // Assignments
  groupLabel:    { fontSize: 11, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginHorizontal: 16 },
  assignCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 18, padding: 14, gap: 12, borderWidth: 1, borderColor: '#F0F0F8', shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 2 },
  assignIconBox: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  assignInfo:    { flex: 1, gap: 3 },
  assignTitle:   { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  assignMeta:    { fontSize: 11, color: '#9A9AB0', fontWeight: '600' },
  assignFeedback: { fontSize: 11, color: '#4CAF50', fontWeight: '600', marginTop: 2 },
  assignStatusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  assignStatusText:  { fontSize: 11, fontWeight: '800' },

  // Activity log
  actCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 18, padding: 14, gap: 12, borderWidth: 1, borderColor: '#F0F0F8', shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 1 },
  actIconBox: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actInfo:    { flex: 1, gap: 2 },
  actTitle:   { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  actMeta:    { fontSize: 11, color: '#9A9AB0', fontWeight: '600' },
  actTime:    { fontSize: 11, fontWeight: '800', color: '#4A90E2' },
  statusPill:     { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 10, fontWeight: '800' },

  // Empty state inline card
  emptyCard:     { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#F0F0F8', marginBottom: 4 },
  emptyCardText: { fontSize: 13, color: '#B0B8CC', fontWeight: '600', textAlign: 'center', lineHeight: 20 },

  // Sticky section tabs
  stickyTabs:         { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8', zIndex: 10 },
  stickyTab:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F4F4FB' },
  stickyTabActive:    { backgroundColor: '#4A90E2' },
  stickyTabText:      { fontSize: 12, fontWeight: '700', color: '#9A9AB0' },
  stickyTabTextActive:{ color: '#fff' },

  // View all / modals
  viewAllBtn:     { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#EDE4FF', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  viewAllBtnText: { fontSize: 14, fontWeight: '800', color: '#7B4FCA' },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(10,10,30,0.5)', justifyContent: 'flex-end' },
  modalSheet:     { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', overflow: 'hidden' },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  modalTitle:     { fontSize: 18, fontWeight: '900', color: '#1a1a2e' },
  modalSub:       { fontSize: 12, color: '#9A9AB0', fontWeight: '600', marginTop: 2 },
  modalMetaStack: { gap: 2, marginTop: 4 },
  modalMetaRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modalMetaLabel: { fontSize: 11, fontWeight: '800', color: '#9A9AB0', minWidth: 36 },
  modalMetaValue: { fontSize: 11, fontWeight: '700', color: '#64748b', flexShrink: 1 },
  modalClose:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F4F4FB', alignItems: 'center', justifyContent: 'center' },
  modalQuizRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F4F4FB' },
  modalQuizNum:   { width: 28, alignItems: 'center' },

  // Quiz detail
  detailQuestionCard: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F8', shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 3 },
  detailQuestionInner: { padding: 16 },
  detailQuestionBanner: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailQHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  detailQNum:         { fontSize: 12, fontWeight: '900', color: '#9A9AB0' },
  detailQBadge:       { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  detailQBadgeText:   { fontSize: 11, fontWeight: '800' },
  detailQTitle:       { fontSize: 15, fontWeight: '700', color: '#1a1a2e', lineHeight: 22 },
  detailOption:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  detailOptionText:   { fontSize: 14, fontWeight: '600', flex: 1 },
  detailAnswerRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F8' },
  detailAnswerLabel:  { fontSize: 12, color: '#9A9AB0', fontWeight: '600' },
  detailAnswerVal:    { fontSize: 12, fontWeight: '800' },
  detailPanel:        { backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0F0F8', borderRadius: 16, padding: 12 },
  detailPanelTitle:   { fontSize: 13, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 },
  detailBodyText:     { fontSize: 12, color: '#4B5563', fontWeight: '500', lineHeight: 18 },
  achievementWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  achievementChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '100%' },
  achievementEmoji:   { fontSize: 14 },
  achievementText:    { fontSize: 11, fontWeight: '700', maxWidth: 200 },
  mediaPreview:       { width: '100%', height: 160, borderRadius: 12, marginTop: 8, backgroundColor: '#F4F4FB' },
  mediaBtn:           { backgroundColor: '#EDE4FF', borderRadius: 12, alignItems: 'center', paddingVertical: 10, marginTop: 10 },
  mediaBtnText:       { fontSize: 12, fontWeight: '800', color: '#7B4FCA' },
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
