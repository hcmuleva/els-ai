/**
 * TrendAnalysisTab - Holistic STUDENT TREND ANALYTICS report.
 * Implements the 16-section framework combining TEACHER (classroom remark
 * scores + text), PARENT (counseling + parent feedback) and STUDENT (quiz
 * scores + engagement analytics) data. A Week/Month/Year filter re-buckets
 * every time-series chart. Uses gauges, line, bar, donut, radar, heatmap and
 * timeline visuals.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  TrendingUp,
  TrendingDown,
  GraduationCap,
  Users,
  User,
  Award,
  Target,
  AlertTriangle,
  Sparkles,
  CalendarDays,
  Activity as ActivityIcon,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import {
  useStudentProfile,
  type ClassroomRemarkItem,
} from '../../context/StudentProfileContext';
import { Colors, Radius, Shadow } from '../../theme';
import { getStandardLabel } from '../../constants/standards';
import {
  Gauge,
  LineChart,
  VBars,
  HBars,
  Donut,
  Radar,
  ActivityHeatmap,
  Timeline,
  RiskRow,
  clamp,
  type LineSeries,
} from './charts';
import { RangeSlider } from './RangeSlider';
import { type RiskLevel, riskFromScore, worstRisk, projectNext, forecastSeries } from '../../utils/riskForecast';

type Props = { studentId: string; studentName: string };

type CounselingSession = {
  id: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  overallScore: number | null;
  level: string | null;
  reportCreatedAt: string | null;
};
type ParentFeedbackItem = { id: string; feedback: string; createdAt: string };
type Gran = 'week' | 'month' | 'year' | 'overall';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const GRAN_LABEL: Record<Gran, string> = { week: 'Week', month: 'Month', year: 'Year', overall: 'Overall' };
const GRAN_UNIT: Record<Gran, string> = { week: 'day', month: 'week', year: 'month', overall: 'year' };
const GRAN_SCOPE: Record<Gran, string> = {
  week: 'this week',
  month: 'this month',
  year: 'this year',
  overall: 'the full history',
};

// ── hierarchical drill-down ───────────────────────────────────────────────
// Each granularity shows the SUB-units of one parent period:
//   week → 7 days   · month → weeks   · year → 12 months   · overall → years
type ParentMeta = { key: string; label: string; sort: number };

function parentInfo(d: Date, gran: Gran): ParentMeta {
  const y = d.getFullYear();
  if (gran === 'overall') return { key: 'all', label: 'All years', sort: 0 };
  if (gran === 'year') return { key: `${y}`, label: `${y}`, sort: y };
  if (gran === 'month') {
    const m = d.getMonth();
    return { key: `${y}-${m}`, label: `${MONTHS[m]} ${y}`, sort: y * 12 + m };
  }
  const dt = new Date(d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  dt.setHours(0, 0, 0, 0);
  return {
    key: `w${dt.toISOString().slice(0, 10)}`,
    label: `Wk of ${dt.getDate()} ${MONTHS[dt.getMonth()]}`,
    sort: dt.getTime(),
  };
}

function subCount(gran: Gran, parentKey: string, minYear: number, maxYear: number): number {
  if (gran === 'week') return 7;
  if (gran === 'year') return 12;
  if (gran === 'overall') return Math.max(1, maxYear - minYear + 1);
  // month → number of week-blocks in that month
  const [y, m] = parentKey.split('-').map(Number);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  return Math.ceil(daysInMonth / 7);
}

function subIndex(d: Date, gran: Gran, minYear: number): number {
  if (gran === 'week') return (d.getDay() + 6) % 7;
  if (gran === 'year') return d.getMonth();
  if (gran === 'overall') return d.getFullYear() - minYear;
  return Math.min(4, Math.floor((d.getDate() - 1) / 7)); // month → week block
}

function subLabel(gran: Gran, i: number, minYear: number): string {
  if (gran === 'week') return `Day ${i + 1}`;
  if (gran === 'month') return `Week ${i + 1}`;
  if (gran === 'year') return `Month ${i + 1}`;
  return `${minYear + i}`; // overall → actual year
}

const MAX_PARENT_CHIPS = 16;

// ── helpers ─────────────────────────────────────────────────────────────────
const round = (v: number) => Math.round(v);
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (s: number) => clamp((s / 5) * 100, 0, 100);
const fmtDate = (d: Date) =>
  `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

const firstLast = (a: number[]) => (a.length ? { first: a[0], last: a[a.length - 1] } : { first: 0, last: 0 });

const teacherAvgPct = (r: ClassroomRemarkItem) => {
  const present = [r.scoreBehavior, r.scoreConfidence, r.scoreParticipation, r.scorePerformance].filter(
    (v): v is number => typeof v === 'number' && v > 0,
  );
  return present.length ? pct(avg(present)) : 0;
};

const ratingLabel = (p: number) =>
  p >= 85 ? 'Excellent' : p >= 70 ? 'Good' : p >= 55 ? 'Improving' : p > 0 ? 'Average' : '—';

const POS_WORDS = ['good', 'great', 'improv', 'happy', 'better', 'confiden', 'proud', 'excellent', 'progress', 'well', 'love', 'enjoy', 'focus', 'help'];
const NEG_WORDS = ['worri', 'concern', 'problem', 'struggl', 'difficult', 'poor', 'fail', 'behind', 'issue', 'lazy', 'distract', 'weak', 'late', 'incomplete'];
function textSentiment(t: string): 'positive' | 'neutral' | 'concern' {
  const low = t.toLowerCase();
  const p = POS_WORDS.reduce((a, w) => a + (low.includes(w) ? 1 : 0), 0);
  const n = NEG_WORDS.reduce((a, w) => a + (low.includes(w) ? 1 : 0), 0);
  if (p > n) return 'positive';
  if (n > p) return 'concern';
  return 'neutral';
}

// ── small UI atoms ──────────────────────────────────────────────────────────
function GrowthChip({ delta }: { delta: number }) {
  const up = delta >= 0;
  const color = up ? Colors.success : Colors.error;
  // Colors.error self-tinted at 1A-alpha is 3.29:1 as text; darkened for the down-state text only.
  const textColor = up ? Colors.success : '#B71C1C';
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <View style={[a.growthChip, { backgroundColor: `${color}1A` }]}>
      <Icon size={12} color={color} />
      <Text style={[a.growthChipText, { color: textColor }]}>{`${up ? '+' : ''}${delta}%`}</Text>
    </View>
  );
}

function Section({
  n,
  title,
  subtitle,
  right,
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={a.card}>
      <View style={a.secHeader}>
        <View style={a.secNum}>
          <Text style={a.secNumText}>{n}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={a.secTitle}>{title}</Text>
          {subtitle ? <Text style={a.secSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function AIInsight({ text }: { text: string }) {
  return (
    <View style={a.insight}>
      <Sparkles size={13} color={Colors.purple} />
      <Text style={a.insightText}>{text}</Text>
    </View>
  );
}

// ── main ────────────────────────────────────────────────────────────────────
export default function TrendAnalysisTab({ studentId, studentName }: Props) {
  const { apiFetch } = useAuth();
  const { analytics, quizAttempts, classroomRemarks, activeStudent } = useStudentProfile();
  // Laptop/monitor-sized viewports pair up comparable sections side by side
  // instead of stacking every one of the 16 sections full-width.
  const { width: windowWidth } = useWindowDimensions();
  const isLargeScreen = windowWidth >= 1024;

  const [sessions, setSessions] = useState<CounselingSession[]>([]);
  const [parentFeedback, setParentFeedback] = useState<ParentFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [gran, setGran] = useState<Gran>('year');
  // null = "use default" (latest parent / full range). Resolved inside the memo.
  const [parentKey, setParentKey] = useState<string | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);

  const selectGran = useCallback((g: Gran) => {
    setGran(g);
    setParentKey(null);
    setRange(null);
  }, []);
  const selectParent = useCallback((key: string) => {
    setParentKey(key);
    setRange(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sesRes, fbRes] = await Promise.all([
        apiFetch(`/counseling/students/${studentId}/sessions`),
        apiFetch(`/students/${studentId}/parent-feedback?limit=50`),
      ]);
      if (sesRes.ok) setSessions(((await sesRes.json()).sessions ?? []) as CounselingSession[]);
      if (fbRes.ok) setParentFeedback(((await fbRes.json()).items ?? []) as ParentFeedbackItem[]);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [apiFetch, studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const M = useMemo(() => {
    // ── full chronological sources ──
    const quizzesAll = [...quizAttempts].sort((x, y) => +new Date(x.attemptedAt) - +new Date(y.attemptedAt));
    const remarksAll = [...classroomRemarks.active, ...classroomRemarks.completed]
      .filter((r) => r.scoreBehavior != null || r.scoreConfidence != null || r.scoreParticipation != null || r.scorePerformance != null)
      .sort((x, y) => +new Date(x.createdAt) - +new Date(y.createdAt));
    const dailyAll = [...(analytics?.daily ?? [])].sort((x, y) => +new Date(x.date) - +new Date(y.date));
    const sessionsAll = [...sessions]
      .filter((s) => s.overallScore != null)
      .sort((x, y) => +new Date(x.reportCreatedAt || x.startedAt) - +new Date(y.reportCreatedAt || y.startedAt));
    const feedbackAll = [...parentFeedback].sort((x, y) => +new Date(x.createdAt) - +new Date(y.createdAt));
    const hasData = quizzesAll.length > 0 || remarksAll.length > 0 || dailyAll.length > 0 || sessionsAll.length > 0;

    const allMs = [
      ...quizzesAll.map((q) => +new Date(q.attemptedAt)),
      ...remarksAll.map((r) => +new Date(r.createdAt)),
      ...dailyAll.map((d) => +new Date(d.date)),
      ...sessionsAll.map((s) => +new Date(s.reportCreatedAt || s.startedAt)),
      ...feedbackAll.map((f) => +new Date(f.createdAt)),
    ].filter((ms) => !Number.isNaN(ms));
    const minYear = allMs.length ? new Date(Math.min(...allMs)).getFullYear() : new Date().getFullYear();
    const maxYear = allMs.length ? new Date(Math.max(...allMs)).getFullYear() : new Date().getFullYear();

    // ── available parent periods (the drill-down list) ──
    const parentMap = new Map<string, ParentMeta>();
    const noteParent = (d: Date) => {
      const p = parentInfo(d, gran);
      if (!parentMap.has(p.key)) parentMap.set(p.key, p);
    };
    quizzesAll.forEach((q) => noteParent(new Date(q.attemptedAt)));
    remarksAll.forEach((r) => noteParent(new Date(r.createdAt)));
    dailyAll.forEach((d) => noteParent(new Date(d.date)));
    sessionsAll.forEach((s) => noteParent(new Date(s.reportCreatedAt || s.startedAt)));
    feedbackAll.forEach((f) => noteParent(new Date(f.createdAt)));
    const parentsAsc = [...parentMap.values()].sort((x, y) => x.sort - y.sort);
    const parents = gran === 'overall' ? [{ key: 'all', label: 'All years', sort: 0 }] : parentsAsc;
    // most-recent N parents make the chip row (latest first)
    const parentChips = gran === 'overall' ? [] : [...parents].reverse().slice(0, MAX_PARENT_CHIPS);

    const activeParentKey =
      gran === 'overall'
        ? 'all'
        : parentKey && parentMap.has(parentKey)
          ? parentKey
          : parents.length
            ? parents[parents.length - 1].key
            : 'none';
    const activeParentLabel = gran === 'overall' ? 'All years' : parentMap.get(activeParentKey)?.label ?? '—';

    // ── sub-units of the active parent + selected range ──
    const subN = subCount(gran, activeParentKey, minYear, maxYear);
    const rawRange: [number, number] = range ?? [0, subN - 1];
    const from = clamp(Math.min(rawRange[0], rawRange[1]), 0, subN - 1);
    const to = clamp(Math.max(rawRange[0], rawRange[1]), 0, subN - 1);
    const resolvedRange: [number, number] = [from, to];

    const inParent = (d: string | Date) =>
      gran === 'overall' || parentInfo(new Date(d), gran).key === activeParentKey;
    const sIdx = (d: string | Date) => subIndex(new Date(d), gran, minYear);
    const inWin = (d: string | Date) => inParent(d) && sIdx(d) >= from && sIdx(d) <= to;
    const bkey = (d: string | Date) => String(sIdx(d));

    // ordered sub-unit keys in the selected range
    const orderedKeys: string[] = [];
    for (let i = from; i <= to; i++) orderedKeys.push(String(i));
    const keyMeta = new Map<string, { label: string; sort: number }>();
    for (let i = from; i <= to; i++) keyMeta.set(String(i), { label: subLabel(gran, i, minYear), sort: i });
    const viewLabel =
      gran === 'overall'
        ? `${subLabel(gran, from, minYear)} → ${subLabel(gran, to, minYear)}`
        : `${activeParentLabel} · ${subLabel(gran, from, minYear)} → ${subLabel(gran, to, minYear)}`;

    // ── windowed sources (selected parent + sub-range) ──
    const quizzesAsc = quizzesAll.filter((q) => inWin(q.attemptedAt));
    const remarksAsc = remarksAll.filter((r) => inWin(r.createdAt));
    const dailyAsc = dailyAll.filter((d) => inWin(d.date));
    const sessionsAsc = sessionsAll.filter((s) => inWin(s.reportCreatedAt || s.startedAt));
    const feedbackWin = feedbackAll.filter((f) => inWin(f.createdAt));

    const dim = (key: 'scoreBehavior' | 'scoreConfidence' | 'scoreParticipation' | 'scorePerformance') =>
      remarksAsc.map((r) => r[key]).filter((v): v is number => typeof v === 'number' && v > 0).map(pct);

    const academicRaw = quizzesAsc.map((q) => clamp(q.scorePct, 0, 100));
    const behaviorRaw = dim('scoreBehavior');
    const confidenceRaw = dim('scoreConfidence');
    const participationRaw = dim('scoreParticipation');
    const performanceRaw = dim('scorePerformance');
    const teacherAvgRaw = remarksAsc.map(teacherAvgPct);
    const consistencyRaw = dailyAsc.map((d) => clamp(d.consistencyScore, 0, 100));
    const completionRaw = dailyAsc.map((d) => clamp(d.completionRate, 0, 100));
    const counselingRaw = sessionsAsc.map((s) => clamp(s.overallScore ?? 0, 0, 100));

    // ── current / joining snapshots ──
    const cur = (raw: number[], fallback = 0) => (raw.length ? raw[raw.length - 1] : fallback);
    const academicNow = cur(academicRaw);
    const behaviorNow = cur(behaviorRaw);
    const confidenceNow = cur(confidenceRaw);
    const participationNow = cur(participationRaw);
    const performanceNow = cur(performanceRaw);
    const teacherNow = cur(teacherAvgRaw);
    const attendanceNow = analytics?.summary?.consistencyScore ?? cur(consistencyRaw);
    const counselingNow = cur(counselingRaw);
    const socialNow = avg([participationNow, confidenceNow].filter((v) => v > 0));

    const academicJoin = academicRaw[0] ?? 0;
    const behaviorJoin = behaviorRaw[0] ?? 0;
    const attendanceJoin = consistencyRaw[0] ?? 0;
    const socialJoin = avg([participationRaw[0] ?? 0, confidenceRaw[0] ?? 0].filter((v) => v > 0));

    const parentEngagement = clamp(
      sessionsAsc.filter((s) => s.reportCreatedAt).length * 25 + feedbackWin.length * 10,
      0,
      100,
    );

    // ── overall composite ──
    const blend: Array<{ v: number; w: number }> = [];
    if (academicRaw.length) blend.push({ v: academicNow, w: 0.35 });
    if (teacherAvgRaw.length) blend.push({ v: teacherNow, w: 0.25 });
    if (consistencyRaw.length || analytics?.summary) blend.push({ v: attendanceNow, w: 0.2 });
    if (confidenceRaw.length) blend.push({ v: socialNow, w: 0.1 });
    if (counselingRaw.length) blend.push({ v: counselingNow, w: 0.1 });
    const tw = blend.reduce((s, b) => s + b.w, 0) || 1;
    const overallNow = round(blend.reduce((s, b) => s + b.v * b.w, 0) / tw);

    const blendJoin: number[] = [];
    if (academicRaw.length) blendJoin.push(academicJoin);
    if (teacherAvgRaw.length) blendJoin.push(teacherAvgRaw[0]);
    if (consistencyRaw.length) blendJoin.push(attendanceJoin);
    const overallJoin = blendJoin.length ? round(avg(blendJoin)) : overallNow;
    const overallGrowth = round(overallNow - overallJoin);

    // ── bucketed aligned series over the visible (zoomed) window ──
    type Slot = {
      a: number[]; tb: number[]; tc: number[]; tp: number[]; tpf: number[]; tavg: number[];
      cons: number[]; comp: number[]; couns: number[]; remarks: ClassroomRemarkItem[]; quizN: number;
      pfPos: number; pfNeg: number; pfNeu: number;
    };
    const acc: Record<string, Slot> = {};
    const slot = (k: string) =>
      (acc[k] ??= { a: [], tb: [], tc: [], tp: [], tpf: [], tavg: [], cons: [], comp: [], couns: [], remarks: [], quizN: 0, pfPos: 0, pfNeg: 0, pfNeu: 0 });
    orderedKeys.forEach((k) => slot(k)); // ensure every visible bucket exists

    quizzesAsc.forEach((q) => {
      const s = slot(bkey(q.attemptedAt));
      s.a.push(clamp(q.scorePct, 0, 100));
      s.quizN += 1;
    });
    remarksAsc.forEach((r) => {
      const s = slot(bkey(r.createdAt));
      if (r.scoreBehavior) s.tb.push(pct(r.scoreBehavior));
      if (r.scoreConfidence) s.tc.push(pct(r.scoreConfidence));
      if (r.scoreParticipation) s.tp.push(pct(r.scoreParticipation));
      if (r.scorePerformance) s.tpf.push(pct(r.scorePerformance));
      s.tavg.push(teacherAvgPct(r));
      s.remarks.push(r);
    });
    dailyAsc.forEach((d) => {
      const s = slot(bkey(d.date));
      s.cons.push(clamp(d.consistencyScore, 0, 100));
      s.comp.push(clamp(d.completionRate, 0, 100));
    });
    sessionsAsc.forEach((c) => {
      const s = slot(bkey(c.reportCreatedAt || c.startedAt));
      s.couns.push(clamp(c.overallScore ?? 0, 0, 100));
    });
    feedbackWin.forEach((f) => {
      const s = slot(bkey(f.createdAt));
      const sent = textSentiment(f.feedback);
      if (sent === 'positive') s.pfPos += 1;
      else if (sent === 'concern') s.pfNeg += 1;
      else s.pfNeu += 1;
    });

    const labels = orderedKeys.map((k) => keyMeta.get(k)!.label);
    const al = (pick: (s: Slot) => number[]): (number | null)[] =>
      orderedKeys.map((k) => { const arr = pick(acc[k]); return arr.length ? round(avg(arr)) : null; });

    const academicAligned = al((s) => s.a);
    const teacherAligned = al((s) => s.tavg);
    const behaviorAligned = al((s) => s.tb);
    const participationAligned = al((s) => s.tp);
    const attendanceAligned = al((s) => s.cons);
    const completionAligned = al((s) => s.comp);
    const counselingAligned = al((s) => s.couns);
    const socialAligned: (number | null)[] = orderedKeys.map((k) => {
      const arr = [...acc[k].tp, ...acc[k].tc];
      return arr.length ? round(avg(arr)) : null;
    });

    // per-bucket detail (journey table + breakdown)
    const perBucket = orderedKeys.map((k, idx) => ({
      key: k,
      label: labels[idx],
      academic: academicAligned[idx],
      behavior: behaviorAligned[idx],
      attendance: attendanceAligned[idx],
      social: socialAligned[idx],
      teacher: teacherAligned[idx],
      remarks: acc[k].remarks,
      quizN: acc[k].quizN,
    }));

    // ── subjects (by quiz kind) ──
    const byKind: Record<string, number[]> = {};
    quizzesAsc.forEach((q) => {
      const kind = q.kind ? q.kind[0].toUpperCase() + q.kind.slice(1) : 'General';
      (byKind[kind] ??= []).push(clamp(q.scorePct, 0, 100));
    });
    const subjects = Object.entries(byKind).map(([name, vals]) => ({
      name,
      joining: round(vals[0]),
      current: round(vals[vals.length - 1]),
      best: round(Math.max(...vals)),
      lowest: round(Math.min(...vals)),
      growth: round(vals[vals.length - 1] - vals[0]),
      avg: round(avg(vals)),
    }));

    // ── teacher sentiment counts ──
    let positive = 0;
    let improvement = 0;
    let concern = 0;
    let recognition = 0;
    teacherAvgRaw.forEach((p) => {
      if (p >= 85) recognition += 1;
      else if (p >= 65) positive += 1;
      else if (p >= 45) improvement += 1;
      else concern += 1;
    });

    // ── parent sentiment counts ──
    let pPos = 0;
    let pNeu = 0;
    let pCon = 0;
    feedbackWin.forEach((f) => {
      const s = textSentiment(f.feedback);
      if (s === 'positive') pPos += 1;
      else if (s === 'concern') pCon += 1;
      else pNeu += 1;
    });

    // ── counseling impact (academic before vs after first counseling) ──
    let counselingImpact: { before: number; after: number; improvement: number } | null = null;
    if (sessionsAsc.length && quizzesAsc.length) {
      const t0 = +new Date(sessionsAsc[0].reportCreatedAt || sessionsAsc[0].startedAt);
      const before = quizzesAsc.filter((q) => +new Date(q.attemptedAt) < t0).map((q) => q.scorePct);
      const after = quizzesAsc.filter((q) => +new Date(q.attemptedAt) >= t0).map((q) => q.scorePct);
      if (before.length && after.length)
        counselingImpact = { before: round(avg(before)), after: round(avg(after)), improvement: round(avg(after) - avg(before)) };
    }

    // ── dimensions (strength / weakness / risk) ──
    const dimensions = [
      { label: 'Academics', value: academicRaw.length ? round(academicNow) : null },
      { label: 'Behavior', value: behaviorRaw.length ? round(behaviorNow) : null },
      { label: 'Confidence', value: confidenceRaw.length ? round(confidenceNow) : null },
      { label: 'Participation', value: participationRaw.length ? round(participationNow) : null },
      { label: 'Performance', value: performanceRaw.length ? round(performanceNow) : null },
      { label: 'Consistency', value: consistencyRaw.length || analytics?.summary ? round(attendanceNow) : null },
    ].filter((d): d is { label: string; value: number } => d.value != null);
    const strengths = [...dimensions].sort((x, y) => y.value - x.value).slice(0, 4);
    const weaknesses = [...dimensions].sort((x, y) => x.value - y.value).slice(0, 4);

    // ── milestones ──
    const milestones: Array<{ title: string; meta?: string; description?: string; color?: string; emoji?: string }> = [];
    remarksAsc.forEach((r) =>
      (r.achievements ?? []).forEach((ac) =>
        milestones.push({
          title: ac.name,
          meta: ac.grantedAt ? fmtDate(new Date(ac.grantedAt)) : undefined,
          description: ac.description || `Earned in ${r.title}`,
          color: ac.color || Colors.warning,
          emoji: ac.emoji || '🏆',
        }),
      ),
    );
    if (academicRaw.length) {
      const bestIdx = academicRaw.indexOf(Math.max(...academicRaw));
      const bq = quizzesAsc[bestIdx];
      milestones.push({
        title: `Best quiz score ${round(academicRaw[bestIdx])}%`,
        meta: fmtDate(new Date(bq.attemptedAt)),
        description: bq.quizTitle,
        color: Colors.primary,
        emoji: '⭐',
      });
    }
    sessionsAsc.forEach((s) =>
      milestones.push({
        title: `Counseling report${s.level ? ` · ${s.level}` : ''}`,
        meta: fmtDate(new Date(s.reportCreatedAt || s.startedAt)),
        description: `Overall wellbeing score ${round(s.overallScore ?? 0)}/100`,
        color: Colors.purple,
        emoji: '🧭',
      }),
    );
    milestones.sort((x, y) => (y.meta && x.meta ? +new Date(y.meta) - +new Date(x.meta) : 0));

    // ── risk ──
    const risks: Array<{ label: string; level: RiskLevel }> = [];
    if (academicRaw.length) risks.push({ label: 'Academic Risk', level: riskFromScore(academicNow) });
    if (consistencyRaw.length || analytics?.summary) risks.push({ label: 'Attendance Risk', level: riskFromScore(attendanceNow, 75, 60) });
    if (behaviorRaw.length) risks.push({ label: 'Behavioral Risk', level: riskFromScore(behaviorNow) });
    if (confidenceRaw.length || counselingRaw.length)
      risks.push({ label: 'Emotional Risk', level: riskFromScore(counselingRaw.length ? counselingNow : confidenceNow) });

    // ── forecast ──
    const forecast = {
      academic: projectNext(academicAligned.filter((v): v is number => v != null)),
      attendance: projectNext(attendanceAligned.filter((v): v is number => v != null)),
      behavior: projectNext(behaviorAligned.filter((v): v is number => v != null)),
      overall: projectNext([...academicAligned, ...teacherAligned].filter((v): v is number => v != null)),
    };

    // ── activity heatmap intensity ──
    const intensityByDate: Record<string, number> = {};
    dailyAsc.forEach((d) => {
      const key = new Date(d.date).toISOString().slice(0, 10);
      intensityByDate[key] = (d.attemptedCount ?? 0) + (d.completedCount ?? 0);
    });

    // ── radar (non-academic) ──
    const flD = (raw: number[]) => firstLast(raw);
    const radarCurrent = [confidenceNow, behaviorNow, participationNow, performanceNow, avg([behaviorNow, participationNow].filter((v) => v > 0)), confidenceNow];
    const radarJoin = [
      flD(confidenceRaw).first,
      flD(behaviorRaw).first,
      flD(participationRaw).first,
      flD(performanceRaw).first,
      avg([flD(behaviorRaw).first, flD(participationRaw).first].filter((v) => v > 0)),
      flD(confidenceRaw).first,
    ];

    // ── executive summary helpers ──
    const dimGrowth = [
      { label: 'Academics', g: academicRaw.length ? academicNow - academicJoin : -999 },
      { label: 'Behavior', g: behaviorRaw.length ? behaviorNow - behaviorJoin : -999 },
      { label: 'Attendance', g: consistencyRaw.length ? attendanceNow - attendanceJoin : -999 },
      { label: 'Social skills', g: confidenceRaw.length ? socialNow - socialJoin : -999 },
    ];
    const mostImproved = dimGrowth.sort((x, y) => y.g - x.g)[0];
    const strongest = strengths[0];
    const needSupport = weaknesses[0];
    const overallRisk = worstRisk(risks.map((r) => r.level));

    const firstDates = [
      quizzesAsc[0]?.attemptedAt,
      remarksAsc[0]?.createdAt,
      dailyAsc[0]?.date,
      sessionsAsc[0]?.reportCreatedAt || sessionsAsc[0]?.startedAt,
    ].filter(Boolean) as string[];
    const lastDates = [
      quizzesAsc[quizzesAsc.length - 1]?.attemptedAt,
      remarksAsc[remarksAsc.length - 1]?.createdAt,
      dailyAsc[dailyAsc.length - 1]?.date,
    ].filter(Boolean) as string[];
    const startDate = firstDates.length ? new Date(Math.min(...firstDates.map((d) => +new Date(d)))) : null;
    const endDate = lastDates.length ? new Date(Math.max(...lastDates.map((d) => +new Date(d)))) : null;

    return {
      labels,
      perBucket,
      academicAligned, teacherAligned, behaviorAligned, participationAligned,
      attendanceAligned, completionAligned, counselingAligned, socialAligned,
      academicRaw, teacherAvgRaw, behaviorRaw, confidenceRaw, participationRaw, performanceRaw,
      consistencyRaw, completionRaw, counselingRaw,
      academicNow, behaviorNow, confidenceNow, participationNow, performanceNow,
      teacherNow, attendanceNow, counselingNow, socialNow,
      academicJoin, behaviorJoin, attendanceJoin, socialJoin,
      parentEngagement, overallNow, overallJoin, overallGrowth,
      subjects, positive, improvement, concern, recognition,
      pPos, pNeu, pCon, counselingImpact,
      dimensions, strengths, weaknesses, milestones, risks, forecast,
      intensityByDate, radarCurrent, radarJoin,
      mostImproved, strongest, needSupport, overallRisk, startDate, endDate,
      quizCount: quizzesAsc.length, remarkCount: remarksAsc.length,
      sessionCount: sessionsAsc.length, reportedSessions: sessionsAsc.filter((s) => s.reportCreatedAt).length,
      feedback: feedbackWin, hasData, viewLabel,
      parentChips, activeParentKey, activeParentLabel, subN, resolvedRange, minYear,
    };
  }, [analytics, quizAttempts, classroomRemarks, sessions, parentFeedback, gran, parentKey, range]);

  const recommendations = useMemo(() => {
    const student: string[] = [];
    const parent: string[] = [];
    const teacher: string[] = [];
    if (M.academicRaw.length) student.push(M.academicNow < 55 ? 'Practice short daily quizzes on weak topics.' : 'Keep momentum with regular practice quizzes.');
    if (M.attendanceNow < 60) student.push('Follow a fixed daily study schedule to lift consistency.');
    if (M.confidenceNow && M.confidenceNow < 60) student.push('Take part more in class discussions to build confidence.');
    if (M.behaviorNow && M.behaviorNow < 60) teacher.push('Share focused observations on behaviour and participation.');
    if (M.academicRaw.length && M.academicNow < 55) teacher.push('Assign targeted support on low-scoring topics.');
    teacher.push('Recognise improvements to reinforce positive momentum.');
    parent.push('Review this trend weekly and celebrate small wins.');
    if (M.attendanceNow < 60) parent.push('Encourage a consistent study routine at home.');
    if (M.reportedSessions === 0) parent.push('Run a counseling session for a deeper wellbeing snapshot.');
    return { student, parent, teacher };
  }, [M]);

  if (loading) {
    return (
      <View style={a.loaderWrap}>
        <ActivityIndicator accessibilityLabel="Loading" size="large" color={Colors.primary} />
        <Text style={a.loaderText}>Building trend report…</Text>
      </View>
    );
  }

  const hasAny = M.hasData;
  if (!hasAny) {
    return (
      <View style={a.emptyState}>
        <Text style={{ fontSize: 40 }}>📈</Text>
        <Text style={a.emptyTitle}>No trend data yet</Text>
        <Text style={a.emptyText}>
          As {studentName} attempts quizzes and teachers add remarks, this report will chart growth across academics, behaviour and engagement.
        </Text>
      </View>
    );
  }

  const performanceWord = M.overallNow >= 85 ? 'Excellent' : M.overallNow >= 70 ? 'Good' : M.overallNow >= 55 ? 'Satisfactory' : 'Needs Support';

  return (
    <View style={a.container}>
      {/* GRANULARITY + DRILL-DOWN (drives every time-series chart) */}
      <View style={a.filterBar}>
        {(['week', 'month', 'year', 'overall'] as Gran[]).map((g) => (
          <Pressable key={g} onPress={() => selectGran(g)} style={[a.filterChip, gran === g && a.filterChipActive]}>
            <Text style={[a.filterChipText, gran === g && a.filterChipTextActive]}>{GRAN_LABEL[g]}</Text>
          </Pressable>
        ))}
      </View>
      {gran !== 'overall' && M.parentChips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={a.parentRow}
        >
          {M.parentChips.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => selectParent(p.key)}
              style={[a.parentChip, M.activeParentKey === p.key && a.parentChipActive]}
            >
              <Text style={[a.parentChipText, M.activeParentKey === p.key && a.parentChipTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={a.rangeBar}>
        <View style={a.rangeHead}>
          <CalendarDays size={13} color={Colors.textMuted} />
          <Text style={a.rangeHeadText}>{M.viewLabel}</Text>
        </View>
        <RangeSlider
          count={M.subN}
          value={M.resolvedRange}
          onChange={setRange}
          labelFor={(i) => subLabel(gran, i, M.minYear)}
        />
      </View>

      {/* 1 ─ STUDENT GROWTH SUMMARY */}
      <Section
        n={1}
        title="Growth Summary"
        subtitle={`${activeStudent?.firstName ?? studentName}${activeStudent?.classLevel ? ` · ${getStandardLabel(activeStudent.classLevel)}` : ''}`}
        right={<GrowthChip delta={M.overallGrowth} />}
      >
        <Text style={a.periodNote}>
          {GRAN_LABEL[gran]} view · {M.viewLabel} · {M.startDate ? fmtDate(M.startDate) : '—'} → {M.endDate ? fmtDate(M.endDate) : 'now'}
        </Text>
        <Gauge value={M.overallNow} label="Overall Growth Score" color={Colors.primary} />
        <View style={a.metricGrid}>
          {[
            { label: 'Academic', from: M.academicJoin, to: M.academicNow, show: M.academicRaw.length > 0 },
            { label: 'Behavioral', from: M.behaviorJoin, to: M.behaviorNow, show: M.behaviorRaw.length > 0 },
            { label: 'Social', from: M.socialJoin, to: M.socialNow, show: M.confidenceRaw.length > 0 },
            { label: 'Attendance', from: M.attendanceJoin, to: M.attendanceNow, show: true },
            { label: 'Parent Engage', from: 0, to: M.parentEngagement, show: true },
          ]
            .filter((m) => m.show)
            .map((m) => {
              const d = round(m.to - m.from);
              return (
                <View key={m.label} style={a.metricCell}>
                  <Text style={a.metricVal}>{round(m.to)}%</Text>
                  <Text style={a.metricLbl}>{m.label}</Text>
                  {m.from > 0 && <Text style={[a.metricDelta, { color: d >= 0 ? Colors.success : Colors.error }]}>{`${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}%`}</Text>}
                </View>
              );
            })}
        </View>
        <AIInsight
          text={`Over ${GRAN_SCOPE[gran]}, ${studentName}'s overall score moved from ${M.overallJoin}% to ${M.overallNow}% (${M.overallGrowth >= 0 ? '+' : ''}${M.overallGrowth}%). Strongest area: ${M.strongest?.label ?? '—'}. Attendance/consistency is at ${round(M.attendanceNow)}%.`}
        />
      </Section>

      {/* 2 ─ JOURNEY TIMELINE */}
      <Section n={2} title="Journey Timeline" subtitle={gran === 'overall' ? 'Evolution over full history' : `Evolution per ${GRAN_UNIT[gran]}`}>
        <LineChart
          labels={M.labels}
          series={[
            { label: 'Academic', color: Colors.primary, points: M.academicAligned },
            { label: 'Behavior', color: Colors.accent, points: M.behaviorAligned },
            { label: 'Attendance', color: Colors.success, points: M.attendanceAligned },
            { label: 'Social', color: Colors.purple, points: M.socialAligned },
          ]}
        />
        <Legend
          items={[
            { label: 'Academic', color: Colors.primary },
            { label: 'Behavior', color: Colors.accent },
            { label: 'Attendance', color: Colors.success },
            { label: 'Social', color: Colors.purple },
          ]}
        />
        <View style={a.table}>
          <View style={[a.tr, a.trHead]}>
            {['Period', 'Acad', 'Behav', 'Atten', 'Social', 'Rating'].map((h) => (
              <Text key={h} style={[a.th, h === 'Period' && { flex: 1.4 }, h === 'Rating' && { flex: 1.4 }]}>{h}</Text>
            ))}
          </View>
          {M.perBucket.slice(-6).map((b) => (
            <View key={b.key} style={a.tr}>
              <Text style={[a.td, { flex: 1.4, fontWeight: '800', color: Colors.text }]}>{b.label}</Text>
              <Text style={a.td}>{b.academic ?? '—'}</Text>
              <Text style={a.td}>{b.behavior ?? '—'}</Text>
              <Text style={a.td}>{b.attendance ?? '—'}</Text>
              <Text style={a.td}>{b.social ?? '—'}</Text>
              <Text style={[a.td, { flex: 1.4, fontWeight: '700', color: Colors.primaryDark }]}>{ratingLabel(b.teacher ?? 0)}</Text>
            </View>
          ))}
        </View>
        <AIInsight text={journeyInsight(M.perBucket)} />
      </Section>

      {/* 3 + 4 ─ ACADEMIC PERFORMANCE + NON-ACADEMIC DEVELOPMENT — paired
          side by side on large screens, both are single-domain trend cards. */}
      <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', gap: 14 }}>
        {M.academicRaw.length > 0 && (
          <View style={isLargeScreen ? a.rowItem : undefined}>
            <Section n={3} title="Academic Performance" subtitle="Quiz scores over time" right={<GrowthChip delta={round(M.academicNow - M.academicJoin)} />}>
              <LineChart labels={M.labels} series={[{ label: 'Academic', color: Colors.primary, points: M.academicAligned }]} yUnit="%" showValues={M.labels.length <= 12} />
              <View style={a.statStrip}>
                <Stat label="Joining" value={`${round(M.academicJoin)}%`} />
                <Stat label="Current" value={`${round(M.academicNow)}%`} />
                <Stat label="Best" value={`${round(Math.max(...M.academicRaw))}%`} />
                <Stat label="Lowest" value={`${round(Math.min(...M.academicRaw))}%`} />
              </View>
              {M.subjects.length > 1 && (
                <>
                  <Text style={a.subHead}>By type (joining → current)</Text>
                  <VBars
                    labels={M.subjects.map((s) => s.name)}
                    groups={[
                      { color: '#C9D4E8', values: M.subjects.map((s) => s.joining) },
                      { color: Colors.primary, values: M.subjects.map((s) => s.current) },
                    ]}
                    unit="%"
                  />
                  <Legend items={[{ label: 'Joining', color: '#C9D4E8' }, { label: 'Current', color: Colors.primary }]} />
                </>
              )}
              <AIInsight
                text={`${M.subjects[0] ? `${M.subjects[0].name} moved ${M.subjects[0].joining}% → ${M.subjects[0].current}% (${M.subjects[0].growth >= 0 ? '+' : ''}${M.subjects[0].growth}%). ` : ''}Best recorded score is ${round(Math.max(...M.academicRaw))}%.`}
              />
            </Section>
          </View>
        )}

        {(M.behaviorRaw.length > 0 || M.confidenceRaw.length > 0) && (
          <View style={isLargeScreen ? a.rowItem : undefined}>
            <Section n={4} title="Non-Academic Development" subtitle="Skills: joining vs current">
              <Radar
                axes={['Communication', 'Discipline', 'Teamwork', 'Leadership', 'Responsibility', 'Confidence']}
                series={[
                  { label: 'Current', color: Colors.primary, values: M.radarCurrent },
                  { label: 'Joining', color: Colors.accent, values: M.radarJoin },
                ]}
              />
              <Legend items={[{ label: 'Current', color: Colors.primary }, { label: 'Joining', color: Colors.accent }]} />
              <AIInsight text="Skills are mapped from teacher remark scores (behaviour, confidence, participation, performance). A wider blue shape than coral shows growth since joining." />
            </Section>
          </View>
        )}
      </View>

      {/* 5 ─ ATTENDANCE & PARTICIPATION */}
      <Section n={5} title="Attendance & Participation" subtitle="Consistency, completion and active days">
        <View style={a.statStrip}>
          <Stat label="Joining" value={`${round(M.attendanceJoin)}%`} />
          <Stat label="Current" value={`${round(M.attendanceNow)}%`} />
          <Stat label="Completion" value={`${round(M.completionRaw[M.completionRaw.length - 1] ?? 0)}%`} />
          <Stat label="Participation" value={`${round(M.participationNow)}%`} />
        </View>
        <LineChart
          labels={M.labels}
          series={[
            { label: 'Consistency', color: Colors.success, points: M.attendanceAligned },
            { label: 'Completion', color: Colors.primary, points: M.completionAligned },
          ]}
          yUnit="%"
        />
        <Legend items={[{ label: 'Consistency', color: Colors.success }, { label: 'Completion', color: Colors.primary }]} />
        <Text style={a.subHead}>Active-day heatmap (last 12 weeks)</Text>
        <ActivityHeatmap intensityByDate={M.intensityByDate} color={Colors.success} />
        <AIInsight text={`Attendance/consistency moved from ${round(M.attendanceJoin)}% to ${round(M.attendanceNow)}%. Higher consistency periods align with stronger academic scores.`} />
      </Section>

      {/* 6 + 7 ─ TEACHER FEEDBACK + PARENT FEEDBACK — paired side by side
          on large screens, both are "feedback source" cards. */}
      <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', gap: 14 }}>
        {M.remarkCount > 0 && (
          <View style={isLargeScreen ? a.rowItem : undefined}>
            <Section n={6} title="Teacher Feedback" subtitle={`${M.remarkCount} remark${M.remarkCount !== 1 ? 's' : ''} analysed`} right={<GrowthChip delta={round(M.teacherNow - (M.teacherAvgRaw[0] ?? 0))} />}>
              <Donut
                slices={[
                  { label: 'Recognition', value: M.recognition, color: Colors.success },
                  { label: 'Positive', value: M.positive, color: Colors.primary },
                  { label: 'Improvement', value: M.improvement, color: Colors.warning },
                  { label: 'Concern', value: M.concern, color: Colors.error },
                ].filter((s) => s.value > 0)}
                centerValue={`${M.remarkCount}`}
                centerLabel="remarks"
              />
              <Text style={a.subHead}>Sentiment trend</Text>
              <LineChart labels={M.labels} series={[{ label: 'Teacher score', color: Colors.accent, points: M.teacherAligned }]} yUnit="%" showValues={M.labels.length <= 12} />
              <Text style={a.subHead}>Category averages</Text>
              <HBars
                items={[
                  { label: 'Learning', value: M.performanceNow, color: Colors.purple },
                  { label: 'Behavior', value: M.behaviorNow, color: Colors.accent },
                  { label: 'Participation', value: M.participationNow, color: Colors.success },
                  { label: 'Communication', value: M.confidenceNow, color: Colors.primary },
                ].filter((i) => i.value > 0)}
              />
              <AIInsight text={`Feedback skews ${M.recognition + M.positive >= M.improvement + M.concern ? 'positive' : 'toward improvement'}: ${M.recognition} recognition, ${M.positive} positive, ${M.improvement} improvement, ${M.concern} concern remarks.`} />
            </Section>
          </View>
        )}

        <View style={isLargeScreen ? a.rowItem : undefined}>
          <Section n={7} title="Parent Feedback" subtitle={`${M.feedback.length} submission${M.feedback.length !== 1 ? 's' : ''}`}>
            {M.feedback.length === 0 ? (
              <Text style={a.emptyInline}>No parent feedback in this range. Parents can add observations from the Feedback tab.</Text>
            ) : (
              <>
                <Donut
                  slices={[
                    { label: 'Positive', value: M.pPos, color: Colors.success },
                    { label: 'Neutral', value: M.pNeu, color: Colors.textMuted },
                    { label: 'Concern', value: M.pCon, color: Colors.error },
                  ].filter((s) => s.value > 0)}
                  centerValue={`${M.feedback.length}`}
                  centerLabel="notes"
                />
                <View style={{ gap: 8 }}>
                  {M.feedback.slice(-4).reverse().map((f) => (
                    <View key={f.id} style={a.fbItem}>
                      <View style={[a.fbDot, { backgroundColor: textSentiment(f.feedback) === 'positive' ? Colors.success : textSentiment(f.feedback) === 'concern' ? Colors.error : Colors.textMuted }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={a.fbText} numberOfLines={2}>{f.feedback}</Text>
                        <Text style={a.fbDate}>{fmtDate(new Date(f.createdAt))}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <AIInsight text={`Parent observations are ${M.pPos >= M.pCon ? 'mostly positive' : 'flagging some concerns'} (${M.pPos} positive, ${M.pCon} concern).`} />
              </>
            )}
          </Section>
        </View>
      </View>

      {/* 8 ─ COUNSELING IMPACT */}
      <Section n={8} title="Counseling Impact" subtitle={`${M.sessionCount} session${M.sessionCount !== 1 ? 's' : ''} · ${M.reportedSessions} report${M.reportedSessions !== 1 ? 's' : ''}`}>
        {M.counselingRaw.length === 0 ? (
          <Text style={a.emptyInline}>No counseling reports yet. Run a guided session to unlock wellbeing trends.</Text>
        ) : (
          <>
            <LineChart labels={M.labels} series={[{ label: 'Counseling', color: Colors.purple, points: M.counselingAligned }]} showValues={M.labels.length <= 12} />
            {M.counselingImpact && (
              <>
                <Text style={a.subHead}>Academic: before vs after first counseling</Text>
                <VBars
                  labels={['Before', 'After']}
                  groups={[{ color: Colors.purple, values: [M.counselingImpact.before, M.counselingImpact.after] }]}
                  unit="%"
                />
                <AIInsight text={`After counseling, academic average changed by ${M.counselingImpact.improvement >= 0 ? '+' : ''}${M.counselingImpact.improvement}% (${M.counselingImpact.before}% → ${M.counselingImpact.after}%).`} />
              </>
            )}
          </>
        )}
      </Section>

      {/* 9 + 10 ─ STRENGTHS & WEAKNESS */}
      <View style={a.splitRow}>
        <View style={[a.card, a.splitCard]}>
          <View style={a.splitHeader}><Award size={15} color={Colors.success} /><Text style={a.splitTitle}>Strengths</Text></View>
          <HBars items={M.strengths.map((d) => ({ label: d.label, value: d.value, color: Colors.success }))} />
        </View>
        <View style={[a.card, a.splitCard]}>
          <View style={a.splitHeader}><Target size={15} color={Colors.accent} /><Text style={a.splitTitle}>Focus Areas</Text></View>
          <HBars items={M.weaknesses.map((d) => ({ label: d.label, value: d.value, color: Colors.accent }))} />
        </View>
      </View>

      {/* 11 + 12 ─ RISK PREDICTION + BENCHMARK COMPARISON — paired side by
          side on large screens, both are compact assessment cards. */}
      <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', gap: 14 }}>
        <View style={isLargeScreen ? a.rowItem : undefined}>
          <Section n={11} title="Risk Prediction" subtitle="Early-warning indicators" right={<RiskPill level={M.overallRisk} />}>
            {M.risks.map((r) => (
              <RiskRow key={r.label} label={r.label} level={r.level} />
            ))}
            <AIInsight text={`Overall risk is ${M.overallRisk}. ${M.risks.filter((r) => r.level !== 'Low').map((r) => r.label).join(', ') || 'All indicators are healthy'}${M.risks.some((r) => r.level !== 'Low') ? ' need monitoring.' : '.'}`} />
          </Section>
        </View>

        <View style={isLargeScreen ? a.rowItem : undefined}>
          <Section n={12} title="Benchmark Comparison" subtitle="Current vs personal average vs best">
            <VBars
              labels={['Academic', 'Attendance', 'Behavior', 'Particip.']}
              groups={[
                { color: Colors.primary, values: [M.academicNow, M.attendanceNow, M.behaviorNow, M.participationNow] },
                { color: '#C9D4E8', values: [avg(M.academicRaw), avg(M.consistencyRaw), avg(M.behaviorRaw), avg(M.participationRaw)] },
                { color: Colors.success, values: [maxOr0(M.academicRaw), maxOr0(M.consistencyRaw), maxOr0(M.behaviorRaw), maxOr0(M.participationRaw)] },
              ]}
              unit="%"
            />
            <Legend items={[{ label: 'Current', color: Colors.primary }, { label: 'Average', color: '#C9D4E8' }, { label: 'Best', color: Colors.success }]} />
            <AIInsight text="Compared against the student's own history (peer/class averages can be added once available from the school dataset)." />
          </Section>
        </View>
      </View>

      {/* 13 + 14 ─ GROWTH MILESTONES + FUTURE PROJECTION — paired side by
          side on large screens, both are compact single-domain cards. */}
      <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', gap: 14 }}>
        {M.milestones.length > 0 && (
          <View style={isLargeScreen ? a.rowItem : undefined}>
            <Section n={13} title="Growth Milestones" subtitle="Achievements and key moments">
              <Timeline items={M.milestones.slice(0, 8)} />
            </Section>
          </View>
        )}

        {M.academicAligned.filter((v) => v != null).length >= 2 && (
          <View style={isLargeScreen ? a.rowItem : undefined}>
            <Section n={14} title="Future Projection" subtitle="Forecast for next period">
              <LineChart
                labels={[...M.labels, 'Next']}
                series={[
                  { label: 'Academic', color: Colors.primary, points: [...M.academicAligned, null] },
                  { label: 'Forecast', color: Colors.primary, dashed: true, points: forecastSeries(M.academicAligned, M.forecast.academic) },
                ]}
                yUnit="%"
              />
              <View style={a.metricGrid}>
                {[
                  { label: 'Academic', v: M.forecast.academic },
                  { label: 'Attendance', v: M.forecast.attendance },
                  { label: 'Behavior', v: M.forecast.behavior },
                  { label: 'Overall', v: M.forecast.overall },
                ]
                  .filter((f) => f.v != null)
                  .map((f) => (
                    <View key={f.label} style={a.metricCell}>
                      <Text style={a.metricVal}>{round(f.v as number)}%</Text>
                      <Text style={a.metricLbl}>{f.label}</Text>
                    </View>
                  ))}
              </View>
              <AIInsight text={`Based on the current trajectory, projected academic performance next ${GRAN_UNIT[gran]} is about ${M.forecast.academic != null ? round(M.forecast.academic) : '—'}%.`} />
            </Section>
          </View>
        )}
      </View>

      {/* 15 ─ RECOMMENDATIONS */}
      <Section n={15} title="Personalized Recommendations" subtitle="Action items for everyone">
        <RecBlock icon={<User size={13} color={Colors.primary} />} title="For Student" items={recommendations.student} />
        <RecBlock icon={<Users size={13} color="#C77B2B" />} title="For Parents" items={recommendations.parent} />
        <RecBlock icon={<GraduationCap size={13} color={Colors.purple} />} title="For Teachers" items={recommendations.teacher} />
      </Section>

      {/* 16 ─ EXECUTIVE SUMMARY */}
      <View style={[a.card, a.execCard]}>
        <View style={a.splitHeader}><ActivityIcon size={16} color="#fff" /><Text style={a.execTitle}>Executive Summary</Text></View>
        <View style={a.execGrid}>
          <ExecItem label="Overall Performance" value={performanceWord} />
          <ExecItem label="Growth Since Start" value={`${M.overallGrowth >= 0 ? '+' : ''}${M.overallGrowth}%`} />
          <ExecItem label="Strongest Area" value={M.strongest?.label ?? '—'} />
          <ExecItem label="Most Improved" value={M.mostImproved.g > -999 ? M.mostImproved.label : '—'} />
          <ExecItem label="Needs Support" value={M.needSupport?.label ?? '—'} />
          <ExecItem label="Risk Level" value={M.overallRisk} />
        </View>
        <Text style={a.execText}>
          {studentName} shows {M.overallGrowth >= 0 ? 'an upward' : 'a softening'} trajectory ({M.overallJoin}% → {M.overallNow}%). Strongest in {M.strongest?.label ?? '—'}; most improved in {M.mostImproved.label}. Continued focus on {M.needSupport?.label ?? 'key areas'} should accelerate progress. Overall risk: {M.overallRisk}.
        </Text>
      </View>
    </View>
  );
}

// ── derived render helpers ──────────────────────────────────────────────────
function maxOr0(a: number[]) { return a.length ? Math.max(...a) : 0; }

function journeyInsight(perBucket: Array<{ label: string; academic: number | null }>): string {
  const pts = perBucket.filter((b) => b.academic != null) as Array<{ label: string; academic: number }>;
  if (pts.length < 2) return 'More periods are needed to highlight the strongest growth window.';
  let bestJump = -Infinity;
  let bestLabel = '';
  for (let i = 1; i < pts.length; i++) {
    const jump = pts[i].academic - pts[i - 1].academic;
    if (jump > bestJump) { bestJump = jump; bestLabel = pts[i].label; }
  }
  return `The biggest academic jump (${bestJump >= 0 ? '+' : ''}${round(bestJump)}%) happened around ${bestLabel}, indicating strong adaptation during that period.`;
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <View style={a.legendRow}>
      {items.map((it) => (
        <View key={it.label} style={a.legendItem}>
          <View style={[a.legendDot, { backgroundColor: it.color }]} />
          <Text style={a.legendText}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={a.statItem}>
      <Text style={a.statVal}>{value}</Text>
      <Text style={a.statLabel}>{label}</Text>
    </View>
  );
}
function RiskPill({ level }: { level: RiskLevel }) {
  const clr = level === 'Low' ? Colors.success : level === 'Medium' ? Colors.warning : Colors.error;
  // Colors.warning/Colors.error self-tinted at 1A-alpha only reach 1.93:1 / 3.29:1
  // as text; darkened variants keep the icon+background tint vivid.
  const textClr = level === 'Low' ? Colors.success : level === 'Medium' ? '#8F4A17' : '#B71C1C';
  return (
    <View style={[a.growthChip, { backgroundColor: `${clr}1A` }]}>
      <AlertTriangle size={12} color={clr} />
      <Text style={[a.growthChipText, { color: textClr }]}>{level}</Text>
    </View>
  );
}
function ExecItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={a.execItem}>
      <Text style={a.execItemLabel}>{label}</Text>
      <Text style={a.execItemValue}>{value}</Text>
    </View>
  );
}
function RecBlock({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={a.recBlock}>
      <View style={a.recHeader}>{icon}<Text style={a.recTitle}>{title}</Text></View>
      {items.map((it, i) => (
        <View key={i} style={a.recItem}><View style={a.recDot} /><Text style={a.recText}>{it}</Text></View>
      ))}
    </View>
  );
}

const a = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, gap: 14 },
  loaderWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loaderText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  emptyText: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  emptyInline: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', lineHeight: 18, paddingVertical: 6 },

  // filter
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 6, borderWidth: 1, borderColor: Colors.borderLight, ...Shadow.sm },
  filterChip: { flex: 1, paddingVertical: 8, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.surfaceAlt },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary },
  filterChipTextActive: { color: '#fff' },

  // parent-period drill-down chips
  parentRow: { flexDirection: 'row', gap: 8, paddingVertical: 2, paddingRight: 4 },
  parentChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight },
  parentChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  parentChipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  parentChipTextActive: { color: Colors.primaryDark, fontWeight: '900' },

  // range slider bar
  rangeBar: { backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4, borderWidth: 1, borderColor: Colors.borderLight, ...Shadow.sm, gap: 2 },
  rangeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  rangeHeadText: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary },

  // section card
  card: { backgroundColor: Colors.surface, borderRadius: Radius.card, padding: 16, gap: 8, borderWidth: 1, borderColor: Colors.borderLight, ...Shadow.sm },
  secHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  secNum: { width: 24, height: 24, borderRadius: 8, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  secNumText: { fontSize: 12, fontWeight: '900', color: Colors.primaryDark },
  secTitle: { fontSize: 15, fontWeight: '900', color: Colors.text },
  secSub: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: 1 },
  subHead: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6 },
  periodNote: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },

  insight: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.purpleLight, borderRadius: Radius.md, padding: 10, marginTop: 4 },
  insightText: { flex: 1, fontSize: 11.5, color: '#5B4B8A', lineHeight: 17, fontWeight: '600' },

  growthChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  growthChipText: { fontSize: 12, fontWeight: '900' },

  // metric grid
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCell: { flexGrow: 1, flexBasis: '30%', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center' },
  metricVal: { fontSize: 18, fontWeight: '900', color: Colors.text },
  metricLbl: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, marginTop: 2 },
  metricDelta: { fontSize: 10, fontWeight: '800', marginTop: 2 },

  // table
  table: { borderWidth: 1, borderColor: Colors.borderLight, borderRadius: Radius.md, overflow: 'hidden' },
  tr: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  trHead: { backgroundColor: Colors.surfaceAlt },
  th: { flex: 1, fontSize: 10, fontWeight: '800', color: Colors.textMuted, textAlign: 'center' },
  td: { flex: 1, fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },

  // legend
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },

  // stat strip
  statStrip: { flexDirection: 'row', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, paddingVertical: 10 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '900', color: Colors.text },
  statLabel: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, marginTop: 2 },

  // split
  splitRow: { flexDirection: 'row', gap: 10 },
  // Applied to a Section's wrapper when two sections sit in a large-screen
  // row (see isLargeScreen usages above) so each takes an equal share.
  rowItem: { flex: 1, minWidth: 0 },
  splitCard: { flex: 1, gap: 8 },
  splitHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  splitTitle: { fontSize: 14, fontWeight: '900', color: Colors.text },

  // parent feedback
  fbItem: { flexDirection: 'row', gap: 8, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 10 },
  fbDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  fbText: { fontSize: 12.5, color: Colors.text, lineHeight: 18 },
  fbDate: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', marginTop: 3 },

  // exec
  execCard: { backgroundColor: Colors.text },
  execTitle: { fontSize: 16, fontWeight: '900', color: '#fff' },
  execGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  execItem: { flexGrow: 1, flexBasis: '30%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.md, padding: 10 },
  execItemLabel: { fontSize: 9.5, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3 },
  execItemValue: { fontSize: 14, fontWeight: '900', color: '#fff', marginTop: 3 },
  execText: { fontSize: 12, color: '#fff', lineHeight: 19, marginTop: 8 },

  // recommendations
  recBlock: { gap: 5, marginTop: 4 },
  recHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recTitle: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  recItem: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingLeft: 2 },
  recDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 6 },
  recText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
