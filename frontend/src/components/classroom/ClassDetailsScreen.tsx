/**
 * ClassDetailsScreen — full-screen 3-tab class details for teachers.
 * Tabs: Overview | Students | Analytics
 */
import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import Svg, { Rect, Text as SvgText, G, Circle } from 'react-native-svg';
import {
  ChevronLeft, Users, CheckCircle, ClipboardList, Target,
  BookOpen, Trophy, LayoutList, BarChart2, Calendar, Clock,
  CheckCheck, AlertCircle, Star, Check, Circle as CircleIcon,
  Pencil, Plus, TrendingUp,
} from 'lucide-react-native';
import { getStandardLabel } from '../../constants/standards';
import StudentRemarkSheet, { Achievement, StudentRemarkData } from './StudentRemarkSheet';

// ── Types ─────────────────────────────────────────────────────────────────────
type DetailTab = 'overview' | 'students' | 'analytics';

type Student = {
  studentId: string; name: string; email?: string;
  assignmentsSubmitted: number; quizzesCompleted: number; avgScore: number;
  remark?: {
    remarkText?: string; parentNote?: string; remarkMediaUrl?: string;
    scoreBehavior?: number; scoreConfidence?: number; scoreParticipation?: number; scorePerformance?: number;
  } | null;
  achievements: Achievement[];
};

type ClassroomDetail = {
  id: string; title: string; classLevel: string; scheduleType: string;
  startTime?: string; endedAt?: string; durationMinutes: number; status: string;
  createdAt: string; totalAssignments: number; totalQuizzes: number; totalContents: number;
};

type Summary = { joinedCount: number; quizDoneCount: number; assignmentDoneCount: number; completionPct: number };
type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;

// ── Mini bar chart (SVG) ──────────────────────────────────────────────────────
function MiniBarChart({ data, color = '#4A90E2', maxVal = 5 }: {
  data: { label: string; value: number }[];
  color?: string; maxVal?: number;
}) {
  const W = 320; const H = 140; const PAD = 32;
  const BAR_W = Math.max(16, Math.min(40, (W - PAD * 2) / Math.max(data.length, 1) - 6));
  const gap = (W - PAD * 2 - data.length * BAR_W) / Math.max(data.length - 1, 1);
  return (
    <Svg width={W} height={H}>
      {data.map((d, i) => {
        const bH = maxVal > 0 ? Math.max(4, ((d.value / maxVal) * (H - PAD - 20))) : 4;
        const x = PAD + i * (BAR_W + gap);
        const y = H - PAD - bH;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={BAR_W} height={bH} fill={color} rx={6} opacity={0.85} />
            <SvgText x={x + BAR_W / 2} y={H - PAD + 14} fontSize={9} textAnchor="middle" fill="#9A9AB0">{d.label.slice(0, 6)}</SvgText>
            {d.value > 0 && <SvgText x={x + BAR_W / 2} y={y - 4} fontSize={10} textAnchor="middle" fill={color} fontWeight="bold">{d.value}</SvgText>}
          </G>
        );
      })}
    </Svg>
  );
}

// ── Donut chart (SVG) ─────────────────────────────────────────────────────────
function DonutChart({ pct, color, label }: { pct: number; color: string; label: string }) {
  const R = 36; const cx = 50; const cy = 50; const stroke = 10;
  const circ = 2 * Math.PI * R;
  const dash = (pct / 100) * circ;
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Svg width={100} height={100} viewBox="0 0 100 100">
        <Circle cx={cx} cy={cy} r={R} fill="none" stroke="#F0F0F8" strokeWidth={stroke} />
        <Circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4}
          strokeLinecap="round" />
        <SvgText x={cx} y={cy + 5} textAnchor="middle" fontSize={16} fontWeight="bold" fill="#1a1a2e">{pct}%</SvgText>
      </Svg>
      <Text style={{ fontSize: 11, fontWeight: '700', color: '#5A6A8A', textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ Icon, value, label, color, bg }: {
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  value: number | string; label: string; color: string; bg: string;
}) {
  return (
    <View style={[ds.metricCard, { backgroundColor: bg }]}>
      <View style={[ds.metricIconBox, { backgroundColor: `${color}20` }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={[ds.metricValue, { color }]}>{value}</Text>
      <Text style={ds.metricLabel}>{label}</Text>
    </View>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={ds.progressTrack}>
      <View style={[ds.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

// ── Student row ───────────────────────────────────────────────────────────────
function StudentRow({ student, totalAssignments, totalQuizzes, onRemark }: {
  student: Student; totalAssignments: number; totalQuizzes: number;
  onRemark: (s: Student) => void;
}) {
  const quizOk  = totalQuizzes > 0 && student.quizzesCompleted >= totalQuizzes;
  const asnOk   = totalAssignments > 0 && student.assignmentsSubmitted >= totalAssignments;
  const hasRemark = !!(student.remark?.remarkText || (student.remark?.scorePerformance ?? 0) > 0);

  const scores = [
    student.remark?.scoreBehavior,
    student.remark?.scoreConfidence,
    student.remark?.scoreParticipation,
    student.remark?.scorePerformance,
  ].filter((v): v is number => typeof v === 'number' && v > 0);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  // Completion pct per student
  const totalItems = totalQuizzes + totalAssignments;
  const doneItems  = Math.min(student.quizzesCompleted, totalQuizzes) + Math.min(student.assignmentsSubmitted, totalAssignments);
  const completionPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const uniqueAchievs = Object.values(
    student.achievements.reduce((acc, a) => {
      if (!acc[a.id]) acc[a.id] = { ...a, count: 0 };
      (acc[a.id] as any).count = ((acc[a.id] as any).count ?? 0) + ((a as any).count ?? 1);
      return acc;
    }, {} as Record<string, Achievement>),
  );

  const completionColor = completionPct === 100 ? '#7DC67A' : completionPct >= 50 ? '#4A90E2' : '#FF7043';

  return (
    <View style={ds.studentCard}>
      {/* Top row: avatar + name + completion badge */}
      <View style={ds.studentTopRow}>
        <View style={[ds.studentAvatar, { backgroundColor: completionPct === 100 ? '#7DC67A' : '#4A90E2' }]}>
          <Text style={ds.studentAvatarText}>{student.name[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ds.studentName} numberOfLines={1}>{student.name}</Text>
          {student.email ? <Text style={ds.studentEmail} numberOfLines={1}>{student.email}</Text> : null}
        </View>
        <View style={[ds.completionBadge, { backgroundColor: `${completionColor}18`, borderColor: `${completionColor}40` }]}>
          <Text style={[ds.completionBadgeText, { color: completionColor }]}>{completionPct}%</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={ds.progressSection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={ds.progressLabel}>Completion</Text>
          <Text style={[ds.progressLabel, { color: completionColor, fontWeight: '800' }]}>{doneItems}/{totalItems} tasks</Text>
        </View>
        <ProgressBar value={doneItems} total={totalItems} color={completionColor} />
      </View>

      {/* Status chips row */}
      <View style={ds.chipRow}>
        {totalQuizzes > 0 && (
          <View style={[ds.statusChip, { backgroundColor: quizOk ? '#D6F5D6' : '#FFF3E0', borderColor: quizOk ? '#7DC67A40' : '#FF704340' }]}>
            {quizOk
              ? <CheckCircle size={11} color="#1A6B1A" />
              : <AlertCircle size={11} color="#E65100" />}
            <Text style={[ds.statusChipText, { color: quizOk ? '#1A6B1A' : '#E65100' }]}>
              {quizOk ? 'All Quizzes' : `Quiz ${student.quizzesCompleted}/${totalQuizzes}`}
            </Text>
          </View>
        )}
        {totalAssignments > 0 && (
          <View style={[ds.statusChip, { backgroundColor: asnOk ? '#D6F5D6' : '#FFF3E0', borderColor: asnOk ? '#7DC67A40' : '#FF704340' }]}>
            {asnOk
              ? <CheckCheck size={11} color="#1A6B1A" />
              : <AlertCircle size={11} color="#E65100" />}
            <Text style={[ds.statusChipText, { color: asnOk ? '#1A6B1A' : '#E65100' }]}>
              {asnOk ? 'All Tasks' : `Task ${student.assignmentsSubmitted}/${totalAssignments}`}
            </Text>
          </View>
        )}
        {student.avgScore > 0 && (
          <View style={[ds.statusChip, { backgroundColor: '#D6EAFF', borderColor: '#4A90E240' }]}>
            <Star size={11} color="#1A4DA2" fill="#1A4DA2" />
            <Text style={[ds.statusChipText, { color: '#1A4DA2' }]}>{student.avgScore.toFixed(1)} / 5</Text>
          </View>
        )}
      </View>

      {/* Achievements row */}
      {uniqueAchievs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {uniqueAchievs.slice(0, 6).map((a: any) => (
              <View key={a.id} style={[ds.achievChip, { backgroundColor: `${a.color ?? '#4A90E2'}18` }]}>
                <Text style={{ fontSize: 14 }}>{a.emoji}</Text>
                {(a.count ?? 1) > 1 && <Text style={[ds.achievCount, { color: a.color ?? '#4A90E2' }]}>×{a.count}</Text>}
              </View>
            ))}
            {uniqueAchievs.length > 6 && <Text style={ds.achievMore}>+{uniqueAchievs.length - 6}</Text>}
          </View>
        </ScrollView>
      )}

      {/* Remark button */}
      <Pressable
        style={[ds.remarkBtn, hasRemark && ds.remarkBtnFilled]}
        onPress={() => onRemark(student)}
      >
        {hasRemark
          ? <Pencil size={12} color="#fff" />
          : <Plus size={12} color="#4A90E2" />}
        <Text style={[ds.remarkBtnText, hasRemark && ds.remarkBtnTextFilled]}>
          {hasRemark ? 'Edit Remark' : 'Add Remark'}
        </Text>
        {avgScore > 0 && (
          <View style={ds.remarkScore}>
            <Text style={[ds.remarkScoreText, hasRemark && { color: 'rgba(255,255,255,0.9)' }]}>{avgScore.toFixed(1)}/5</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
type Props = {
  classroomId: string | null;
  apiFetch: ApiFetch;
  onClose: () => void;
  onUploadMedia: () => Promise<{ url: string }>;
};

export default function ClassDetailsScreen({ classroomId, apiFetch, onClose, onUploadMedia }: Props) {
  const [tab, setTab]             = useState<DetailTab>('overview');
  const [loading, setLoading]     = useState(false);
  const [classroom, setClassroom] = useState<ClassroomDetail | null>(null);
  const [students, setStudents]   = useState<Student[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [remarkStudent, setRemarkStudent] = useState<Student | null>(null);

  const loadData = useCallback(async () => {
    if (!classroomId) return;
    setLoading(true);
    try {
      const [detailRes, achievRes] = await Promise.all([
        apiFetch(`/quizzes/classrooms/${classroomId}/class-details`),
        apiFetch('/quizzes/achievements'),
      ]);
      if (detailRes.ok) {
        const d = await detailRes.json();
        setClassroom(d.classroom); setStudents(d.students); setSummary(d.summary);
      }
      if (achievRes.ok) {
        const a = await achievRes.json();
        setAchievements(a.achievements ?? []);
      }
    } finally { setLoading(false); }
  }, [classroomId]);

  useEffect(() => { if (classroomId) { setTab('overview'); loadData(); } }, [classroomId]);

  const handleSaveRemark = async (studentId: string, data: any) => {
    await apiFetch(`/quizzes/classrooms/${classroomId}/remarks/${studentId}`, {
      method: 'PUT', body: JSON.stringify(data),
    });
    await loadData();
  };

  const handleGrantAchievement = async (studentId: string, achievementId: string) => {
    await apiFetch('/quizzes/achievements/grant', {
      method: 'POST', body: JSON.stringify({ studentId, classroomId, achievementId }),
    });
    await loadData();
  };

  const fmtDuration = (mins: number) => {
    if (!mins) return '–';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`;
  };
  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '–';

  const TABS: [DetailTab, React.ComponentType<{ size?: number; color?: string }>, string][] = [
    ['overview',  LayoutList, 'Overview'],
    ['students',  Users,      'Students'],
    ['analytics', BarChart2,  'Analytics'],
  ];

  const scoreData = students.map((s) => ({ label: s.name, value: Number(s.avgScore.toFixed(1)) }));
  const quizData  = students.map((s) => ({ label: s.name, value: s.quizzesCompleted }));
  const asnData   = students.map((s) => ({ label: s.name, value: s.assignmentsSubmitted }));

  const isLive = classroom?.status === 'active';

  return (
    <Modal visible={!!classroomId} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={ds.screen}>
        {/* Header */}
        <View style={[ds.header, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
          <Pressable onPress={onClose} style={ds.backBtn}>
            <ChevronLeft size={24} color="#1a1a2e" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={ds.headerSub}>Class Details</Text>
            <Text style={ds.headerTitle} numberOfLines={1}>{classroom?.title ?? '…'}</Text>
          </View>
          <View style={[ds.statusPill, { backgroundColor: isLive ? '#D6F5D6' : '#F0F0F8' }]}>
            <View style={[ds.statusDot, { backgroundColor: isLive ? '#7DC67A' : '#9A9AB0' }]} />
            <Text style={[ds.statusPillText, { color: isLive ? '#1A6B1A' : '#5A6A8A' }]}>
              {isLive ? 'Live' : 'Ended'}
            </Text>
          </View>
        </View>

        {/* Tab bar */}
        <View style={ds.tabBar}>
          {TABS.map(([t, TabIcon, label]) => {
            const active = tab === t;
            return (
              <Pressable key={t} style={[ds.tab, active && ds.tabActive]} onPress={() => setTab(t)}>
                <TabIcon size={14} color={active ? '#4A90E2' : '#9A9AB0'} />
                <Text style={[ds.tabText, active && ds.tabTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={ds.centerWrap}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={ds.loadingText}>Loading…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={ds.content} showsVerticalScrollIndicator={false}>

            {/* ── OVERVIEW ── */}
            {tab === 'overview' && (
              <>
                {/* Hero card */}
                <View style={ds.heroCard}>
                  <Text style={ds.heroTitle}>{classroom?.title}</Text>
                  <Text style={ds.heroMeta}>
                    {classroom?.classLevel ? getStandardLabel(classroom.classLevel) : ''}
                    {classroom?.scheduleType === 'instant' ? ' · Instant Session' : ' · Scheduled'}
                  </Text>
                  <View style={ds.heroDivider} />
                  <View style={ds.heroMetaRow}>
                    <View style={ds.heroMetaItem}>
                      <View style={ds.heroMetaIconRow}>
                        <Calendar size={11} color="rgba(255,255,255,0.6)" />
                        <Text style={ds.heroMetaLabel}>Started</Text>
                      </View>
                      <Text style={ds.heroMetaValue}>
                        {classroom?.scheduleType === 'instant' ? 'Instant' : fmtDate(classroom?.startTime)}
                      </Text>
                    </View>
                    <View style={ds.heroMetaDivider} />
                    <View style={ds.heroMetaItem}>
                      <View style={ds.heroMetaIconRow}>
                        <Calendar size={11} color="rgba(255,255,255,0.6)" />
                        <Text style={ds.heroMetaLabel}>Ended</Text>
                      </View>
                      <Text style={ds.heroMetaValue}>{fmtDate(classroom?.endedAt)}</Text>
                    </View>
                    <View style={ds.heroMetaDivider} />
                    <View style={ds.heroMetaItem}>
                      <View style={ds.heroMetaIconRow}>
                        <Clock size={11} color="rgba(255,255,255,0.6)" />
                        <Text style={ds.heroMetaLabel}>Duration</Text>
                      </View>
                      <Text style={ds.heroMetaValue}>{fmtDuration(classroom?.durationMinutes ?? 0)}</Text>
                    </View>
                  </View>
                </View>

                {/* Metric cards */}
                <View style={ds.metricsGrid}>
                  <MetricCard Icon={Users}         value={summary?.joinedCount ?? 0}         label="Students"        color="#1A4DA2" bg="#EBF4FF" />
                  <MetricCard Icon={Trophy}        value={summary?.quizDoneCount ?? 0}        label="Quiz Done"       color="#1A6B1A" bg="#D6F5D6" />
                  <MetricCard Icon={ClipboardList} value={summary?.assignmentDoneCount ?? 0}  label="Tasks Done"      color="#E65100" bg="#FFF3E0" />
                  <MetricCard Icon={Target}        value={`${summary?.completionPct ?? 0}%`}  label="Completion Rate" color="#7C3AED" bg="#EDE4FF" />
                </View>

                {/* Class content counts */}
                <View style={ds.section}>
                  <View style={ds.sectionTitleRow}>
                    <BookOpen size={14} color="#4A90E2" />
                    <Text style={ds.sectionTitle}>Class Content</Text>
                  </View>
                  <View style={ds.contentRow}>
                    <View style={[ds.contentItem, { borderColor: '#D6EAFF' }]}>
                      <BookOpen size={22} color="#4A90E2" />
                      <Text style={[ds.contentVal, { color: '#1A4DA2' }]}>{classroom?.totalContents ?? 0}</Text>
                      <Text style={ds.contentLabel}>Content Items</Text>
                    </View>
                    <View style={[ds.contentItem, { borderColor: '#FFE8D6' }]}>
                      <Trophy size={22} color="#FF7043" />
                      <Text style={[ds.contentVal, { color: '#E65100' }]}>{classroom?.totalQuizzes ?? 0}</Text>
                      <Text style={ds.contentLabel}>Quizzes</Text>
                    </View>
                    <View style={[ds.contentItem, { borderColor: '#EDE4FF' }]}>
                      <ClipboardList size={22} color="#9B8EC4" />
                      <Text style={[ds.contentVal, { color: '#7C3AED' }]}>{classroom?.totalAssignments ?? 0}</Text>
                      <Text style={ds.contentLabel}>Assignments</Text>
                    </View>
                  </View>
                </View>

                {/* Completion breakdown donuts */}
                {summary && summary.joinedCount > 0 && (
                  <View style={ds.section}>
                    <View style={ds.sectionTitleRow}>
                      <TrendingUp size={14} color="#4A90E2" />
                      <Text style={ds.sectionTitle}>Completion Breakdown</Text>
                    </View>
                    <Text style={ds.chartSub}>Based on {summary.joinedCount} participating student{summary.joinedCount !== 1 ? 's' : ''}</Text>
                    <View style={ds.donutRow}>
                      <DonutChart
                        pct={Math.round((summary.quizDoneCount / summary.joinedCount) * 100)}
                        color="#4A90E2" label="Quiz Done"
                      />
                      <DonutChart
                        pct={Math.round((summary.assignmentDoneCount / summary.joinedCount) * 100)}
                        color="#7DC67A" label="Tasks Done"
                      />
                      <DonutChart pct={summary.completionPct} color="#FF7043" label="All Complete" />
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ── STUDENTS ── */}
            {tab === 'students' && (
              <>
                <View style={ds.listHeaderRow}>
                  <Users size={14} color="#9A9AB0" />
                  <Text style={ds.listHeader}>
                    {students.length} student{students.length !== 1 ? 's' : ''} participated
                  </Text>
                </View>
                {students.length === 0 ? (
                  <View style={ds.emptyWrap}>
                    <View style={ds.emptyIconBox}>
                      <Users size={36} color="#9A9AB0" />
                    </View>
                    <Text style={ds.emptyTitle}>No students yet</Text>
                    <Text style={ds.emptySub}>Students who submit assignments or complete quizzes will appear here.</Text>
                  </View>
                ) : students.map((s) => (
                  <StudentRow
                    key={s.studentId} student={s}
                    totalAssignments={classroom?.totalAssignments ?? 0}
                    totalQuizzes={classroom?.totalQuizzes ?? 0}
                    onRemark={setRemarkStudent}
                  />
                ))}
              </>
            )}

            {/* ── ANALYTICS ── */}
            {tab === 'analytics' && (
              <>
                {students.length === 0 ? (
                  <View style={ds.emptyWrap}>
                    <View style={ds.emptyIconBox}>
                      <BarChart2 size={36} color="#9A9AB0" />
                    </View>
                    <Text style={ds.emptyTitle}>No data yet</Text>
                    <Text style={ds.emptySub}>Analytics appear once students participate.</Text>
                  </View>
                ) : (
                  <>
                    <View style={ds.section}>
                      <View style={ds.sectionTitleRow}>
                        <TrendingUp size={14} color="#4A90E2" />
                        <Text style={ds.sectionTitle}>Avg Teacher Score (per student)</Text>
                      </View>
                      <Text style={ds.chartSub}>Out of 5 — averaged across behavior, confidence, participation, performance</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <MiniBarChart data={scoreData} color="#4A90E2" maxVal={5} />
                      </ScrollView>
                    </View>

                    <View style={ds.section}>
                      <View style={ds.sectionTitleRow}>
                        <Trophy size={14} color="#7DC67A" />
                        <Text style={ds.sectionTitle}>Quizzes Completed</Text>
                      </View>
                      <Text style={ds.chartSub}>Total quizzes in class: {classroom?.totalQuizzes ?? 0}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <MiniBarChart data={quizData} color="#7DC67A" maxVal={Math.max(classroom?.totalQuizzes ?? 1, 1)} />
                      </ScrollView>
                    </View>

                    <View style={ds.section}>
                      <View style={ds.sectionTitleRow}>
                        <ClipboardList size={14} color="#FF7043" />
                        <Text style={ds.sectionTitle}>Assignments Submitted</Text>
                      </View>
                      <Text style={ds.chartSub}>Total assignments: {classroom?.totalAssignments ?? 0}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <MiniBarChart data={asnData} color="#FF7043" maxVal={Math.max(classroom?.totalAssignments ?? 1, 1)} />
                      </ScrollView>
                    </View>

                    {/* Per-student table */}
                    <View style={ds.section}>
                      <View style={ds.sectionTitleRow}>
                        <LayoutList size={14} color="#9B8EC4" />
                        <Text style={ds.sectionTitle}>Student Breakdown</Text>
                      </View>
                      <View style={ds.tableCard}>
                        <View style={ds.tableHeader}>
                          <Text style={[ds.tableCell, { flex: 2, color: '#fff' }]}>Student</Text>
                          <Text style={[ds.tableCell, { color: '#fff' }]}>Quiz</Text>
                          <Text style={[ds.tableCell, { color: '#fff' }]}>Task</Text>
                          <Text style={[ds.tableCell, { color: '#fff' }]}>Score</Text>
                          <Text style={[ds.tableCell, { color: '#fff' }]}>Done</Text>
                        </View>
                        {students.map((s, i) => {
                          const totalItems = (classroom?.totalQuizzes ?? 0) + (classroom?.totalAssignments ?? 0);
                          const doneItems  = Math.min(s.quizzesCompleted, classroom?.totalQuizzes ?? 0)
                            + Math.min(s.assignmentsSubmitted, classroom?.totalAssignments ?? 0);
                          const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
                          return (
                            <View key={s.studentId} style={[ds.tableRow, i % 2 === 0 && ds.tableRowAlt]}>
                              <Text style={[ds.tableCell, { flex: 2, fontWeight: '700', color: '#1a1a2e' }]} numberOfLines={1}>{s.name}</Text>
                              <Text style={[ds.tableCell, { color: s.quizzesCompleted > 0 ? '#1A6B1A' : '#E65100' }]}>{s.quizzesCompleted}</Text>
                              <Text style={[ds.tableCell, { color: s.assignmentsSubmitted > 0 ? '#1A6B1A' : '#E65100' }]}>{s.assignmentsSubmitted}</Text>
                              <Text style={[ds.tableCell, { color: '#4A90E2', fontWeight: '800' }]}>
                                {s.remark?.scorePerformance ? `${s.remark.scorePerformance}/5` : '–'}
                              </Text>
                              <Text style={[ds.tableCell, { color: pct === 100 ? '#1A6B1A' : '#E65100', fontWeight: '800' }]}>{pct}%</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>

      {/* Student remark sheet */}
      <StudentRemarkSheet
        visible={!!remarkStudent}
        student={remarkStudent ? {
          studentId: remarkStudent.studentId,
          name: remarkStudent.name,
          remarkText: remarkStudent.remark?.remarkText ?? (remarkStudent.remark as any)?.remark_text,
          parentNote: remarkStudent.remark?.parentNote ?? (remarkStudent.remark as any)?.parent_note,
          remarkMediaUrl: remarkStudent.remark?.remarkMediaUrl ?? (remarkStudent.remark as any)?.remark_media_url,
          scoreBehavior: remarkStudent.remark?.scoreBehavior ?? (remarkStudent.remark as any)?.score_behavior,
          scoreConfidence: remarkStudent.remark?.scoreConfidence ?? (remarkStudent.remark as any)?.score_confidence,
          scoreParticipation: remarkStudent.remark?.scoreParticipation ?? (remarkStudent.remark as any)?.score_participation,
          scorePerformance: remarkStudent.remark?.scorePerformance ?? (remarkStudent.remark as any)?.score_performance,
          achievements: remarkStudent.achievements,
        } : null}
        classroomId={classroomId ?? ''}
        achievements={achievements}
        onClose={() => setRemarkStudent(null)}
        onSave={handleSaveRemark}
        onGrantAchievement={handleGrantAchievement}
        onUploadMedia={onUploadMedia}
      />
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ds = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#F5F7FF' },
  content: { padding: 16, paddingBottom: 56 },

  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F7FF', alignItems: 'center', justifyContent: 'center' },
  headerSub:  { fontSize: 10, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.8 },
  headerTitle:{ fontSize: 16, fontWeight: '900', color: '#1a1a2e', marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot:  { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 11, fontWeight: '800' },

  tabBar:       { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  tab:          { flex: 1, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:    { borderBottomColor: '#4A90E2' },
  tabText:      { fontSize: 12, fontWeight: '600', color: '#9A9AB0' },
  tabTextActive:{ color: '#4A90E2', fontWeight: '800' },

  centerWrap:  { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  loadingText: { fontSize: 13, color: '#9A9AB0' },

  // Hero
  heroCard:       { backgroundColor: '#1A3A6B', borderRadius: 20, padding: 20, marginBottom: 16 },
  heroTitle:      { fontSize: 18, fontWeight: '900', color: '#fff', lineHeight: 26, marginBottom: 4 },
  heroMeta:       { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  heroDivider:    { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 14 },
  heroMetaRow:    { flexDirection: 'row' },
  heroMetaItem:   { flex: 1, alignItems: 'center', gap: 4 },
  heroMetaIconRow:{ flexDirection: 'row', alignItems: 'center', gap: 3 },
  heroMetaDivider:{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroMetaLabel:  { fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroMetaValue:  { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Metrics
  metricsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  metricCard:    { width: '47%', borderRadius: 16, padding: 16, alignItems: 'center', gap: 6 },
  metricIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricValue:   { fontSize: 26, fontWeight: '900' },
  metricLabel:   { fontSize: 10, fontWeight: '700', color: '#5A6A8A', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Section
  section:        { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 14, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  sectionTitle:   { fontSize: 14, fontWeight: '900', color: '#1a1a2e' },
  chartSub:       { fontSize: 11, color: '#9A9AB0', marginBottom: 12 },
  donutRow:       { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },

  contentRow:   { flexDirection: 'row', gap: 8, marginTop: 8 },
  contentItem:  { flex: 1, backgroundColor: '#F8F9FF', borderRadius: 14, padding: 12, alignItems: 'center', gap: 5, borderWidth: 1 },
  contentVal:   { fontSize: 22, fontWeight: '900' },
  contentLabel: { fontSize: 10, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', textAlign: 'center' },

  // List header
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  listHeader:    { fontSize: 13, fontWeight: '700', color: '#9A9AB0' },

  emptyWrap:   { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIconBox:{ width: 80, height: 80, borderRadius: 24, backgroundColor: '#F0F0F8', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:  { fontSize: 18, fontWeight: '900', color: '#1a1a2e' },
  emptySub:    { fontSize: 13, color: '#9A9AB0', textAlign: 'center', lineHeight: 20, maxWidth: 260 },

  // Student card
  studentCard:    { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  studentTopRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  studentAvatar:  { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  studentAvatarText: { fontSize: 16, fontWeight: '900', color: '#fff' },
  studentName:    { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  studentEmail:   { fontSize: 11, color: '#9A9AB0', marginTop: 1 },
  completionBadge:{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  completionBadgeText: { fontSize: 12, fontWeight: '900' },

  progressSection:{ marginBottom: 10 },
  progressLabel:  { fontSize: 10, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.4 },
  progressTrack:  { height: 7, borderRadius: 999, backgroundColor: '#F0F0F8', overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 999 },

  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  statusChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  statusChipText: { fontSize: 10, fontWeight: '800' },

  achievChip:  { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  achievCount: { fontSize: 10, fontWeight: '800' },
  achievMore:  { fontSize: 11, color: '#9A9AB0', fontWeight: '700', alignSelf: 'center' },

  remarkBtn:          { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#4A90E2', paddingHorizontal: 12, paddingVertical: 8 },
  remarkBtnFilled:    { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  remarkBtnText:      { fontSize: 12, fontWeight: '800', color: '#4A90E2', flex: 1 },
  remarkBtnTextFilled:{ color: '#fff' },
  remarkScore:        { borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2 },
  remarkScoreText:    { fontSize: 11, fontWeight: '800', color: '#4A90E2' },

  // Table
  tableCard:    { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F8' },
  tableHeader:  { flexDirection: 'row', backgroundColor: '#1A3A6B', padding: 10 },
  tableRow:     { flexDirection: 'row', padding: 10 },
  tableRowAlt:  { backgroundColor: '#F8F9FF' },
  tableCell:    { flex: 1, fontSize: 12, color: '#5A6A8A', fontWeight: '600', textAlign: 'center' },
});
