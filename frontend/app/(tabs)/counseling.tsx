import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  BrainCircuit,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Cpu,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  Languages,
  Lightbulb,
  MessageSquareText,
  Palette,
  Download,
  Sparkles,
  Target,
  X,
  type LucideIcon,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { useStudentProfile } from '../../src/context/StudentProfileContext';
import { getStandardLabel, STANDARD_OPTIONS, ANY_CLASS_VALUE } from '../../src/constants/standards';
import SelectorModal, { type SelectorOption } from '../../src/components/SelectorModal';
import { ModalHeader } from '../../src/components/common/ModalHeader';
import { Colors, Radius, Shadow } from '../../src/theme';
import { exportCounselingReportPdf, type CounselingReportData } from '../../src/utils/counselingPdf';

type Meta = { Icon: LucideIcon; color: string; bg: string };

// ── Question bank (UI authoritative; keys match backend scoring engine) ──────
const ACADEMIC_SUBJECTS: Array<{ key: string; label: string } & Meta> = [
  { key: 'math', label: 'Mathematics', Icon: Calculator, color: Colors.primary, bg: Colors.primaryLight },
  { key: 'science', label: 'Science', Icon: FlaskConical, color: Colors.success, bg: Colors.successLight },
  { key: 'english', label: 'English', Icon: Languages, color: Colors.purple, bg: Colors.purpleLight },
  { key: 'socialStudies', label: 'Social Studies', Icon: Globe, color: Colors.warning, bg: Colors.warningLight },
];
const ACADEMIC_DIMS = [
  { key: 'concept', label: 'Understanding of concepts' },
  { key: 'problemSolving', label: 'Problem-solving ability' },
  { key: 'performance', label: 'Exam performance' },
  { key: 'interest', label: 'Interest level' },
];

type SkillGroup = { section: string; title: string; items: { key: string; label: string }[] } & Meta;
const SKILL_GROUPS: SkillGroup[] = [
  {
    section: 'cognitive',
    title: 'Cognitive Skills',
    Icon: Brain, color: Colors.primary, bg: Colors.primaryLight,
    items: [
      { key: 'cognitive.logicalThinking', label: 'Logical thinking' },
      { key: 'cognitive.analyticalAbility', label: 'Analytical ability' },
      { key: 'cognitive.memoryRetention', label: 'Memory retention' },
      { key: 'cognitive.attentionSpan', label: 'Attention span' },
    ],
  },
  {
    section: 'behavioral',
    title: 'Behavioral Traits',
    Icon: Target, color: Colors.warning, bg: Colors.warningLight,
    items: [
      { key: 'behavioral.discipline', label: 'Discipline' },
      { key: 'behavioral.consistency', label: 'Consistency' },
      { key: 'behavioral.responsibility', label: 'Responsibility' },
      { key: 'behavioral.selfMotivation', label: 'Self motivation' },
    ],
  },
  {
    section: 'learning',
    title: 'Learning Behavior',
    Icon: BookOpen, color: Colors.success, bg: Colors.successLight,
    items: [
      { key: 'learning.independentLearning', label: 'Learns independently' },
      { key: 'learning.needsGuidance', label: 'Needs guidance frequently' },
      { key: 'learning.handlesDifficulty', label: 'Handles difficult problems' },
    ],
  },
  {
    section: 'emotional',
    title: 'Social & Emotional',
    Icon: Heart, color: Colors.accent, bg: Colors.accentLight,
    items: [
      { key: 'emotional.confidence', label: 'Confidence' },
      { key: 'emotional.communication', label: 'Communication skills' },
      { key: 'emotional.collaboration', label: 'Collaboration / teamwork' },
      { key: 'emotional.stressManagement', label: 'Stress management' },
    ],
  },
];

const INTEREST_ITEMS: Array<{ key: string; label: string } & Meta> = [
  { key: 'interests.coding', label: 'Coding / technology', Icon: Cpu, color: Colors.primary, bg: Colors.primaryLight },
  { key: 'interests.arts', label: 'Arts / creativity', Icon: Palette, color: Colors.accent, bg: Colors.accentLight },
  { key: 'interests.sports', label: 'Sports', Icon: Activity, color: Colors.success, bg: Colors.successLight },
  { key: 'interests.readingWriting', label: 'Reading / writing', Icon: BookOpen, color: Colors.purple, bg: Colors.purpleLight },
  { key: 'interests.scienceCuriosity', label: 'Science curiosity', Icon: Lightbulb, color: Colors.warning, bg: Colors.warningLight },
];

const OPEN_QUESTIONS = [
  { key: 'open.weakness', label: 'Key weaknesses' },
  { key: 'open.improvementAreas', label: 'Where is improvement needed?' },
  { key: 'open.motivationTrigger', label: 'What motivates your child?' },
  { key: 'open.parentComments', label: 'Anything else for the counselor?' },
];

const BOARD_OPTIONS = ['CBSE', 'ICSE', 'State', 'IB', 'IGCSE', 'Other'];

// Reusable-selector option lists (constrained to the app's known values).
const CLASS_SELECT_OPTIONS: SelectorOption[] = STANDARD_OPTIONS.filter(
  (o) => o.value !== ANY_CLASS_VALUE,
).map((o) => ({ label: o.label, value: o.value }));
const BOARD_SELECT_OPTIONS: SelectorOption[] = BOARD_OPTIONS.map((b) => ({ label: b, value: b }));

const STEPS = ['Welcome', 'Basic Info', 'Academic', 'Skills', 'Interests', 'Notes', 'Review', 'Report'];

type Answers = Record<string, number | boolean | string | null>;
type Snapshot = { name?: string; classLevel?: string; age?: string; board?: string };

// Section a question key belongs to (academic keys are prefixed by subject).
function sectionOf(key: string): string {
  const prefix = key.split('.')[0];
  if (ACADEMIC_SUBJECTS.some((s) => s.key === prefix)) return 'academic';
  return prefix;
}

// ── Small UI atoms ───────────────────────────────────────────────────────────
const RATING_WORDS = ['Very low', 'Low', 'Fair', 'Good', 'Strong', 'Excellent'];

function ratingColor(v: number): string {
  if (v <= 1) return Colors.accent;
  // Colors.warning is used as a solid RatingScale fill with white digits on
  // top (2.06:1); darkened so white text clears 4.5:1.
  if (v <= 3) return '#A6541B';
  return Colors.success;
}

// Text-only variant: Colors.accent/warning self-tinted at 13% only clear
// 3.86:1 / 1.89:1 against their own tint background, both under 4.5:1.
function ratingTextColor(v: number): string {
  if (v <= 1) return '#B03A19';
  if (v <= 3) return '#8F4A17';
  return Colors.success;
}

// Cumulative scale: selecting 3 fills segments 0–3, colored by level.
function RatingScale({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  const sel = typeof value === 'number' ? value : -1;
  const fill = sel >= 0 ? ratingColor(sel) : Colors.border;
  return (
    <View>
      <View style={styles.ratingRow}>
        {[0, 1, 2, 3, 4, 5].map((n) => {
          const filled = sel >= 0 && n <= sel;
          const isPicked = n === sel;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={[
                styles.ratingSeg,
                filled && { backgroundColor: fill, borderColor: fill },
                isPicked && styles.ratingSegPicked,
              ]}
            >
              <Text style={[styles.ratingSegText, filled && styles.ratingSegTextActive]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.ratingCaptionRow}>
        <Text style={styles.ratingCaption}>Low</Text>
        <Text style={styles.ratingCaption}>High</Text>
      </View>
    </View>
  );
}

function RatingItem({
  label,
  value,
  onChange,
  Icon,
  iconColor,
  iconBg,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  Icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
}) {
  const has = typeof value === 'number';
  return (
    <View style={styles.qItem}>
      <View style={styles.qLabelRow}>
        {Icon && (
          <View style={[styles.qLabelIcon, { backgroundColor: iconBg ?? Colors.surfaceAlt }]}>
            <Icon size={15} color={iconColor ?? Colors.textSecondary} />
          </View>
        )}
        <Text style={styles.qLabelInline}>{label}</Text>
        <View
          style={[
            styles.qValueBadge,
            { backgroundColor: has ? ratingColor(value as number) + '22' : Colors.surfaceAlt },
          ]}
        >
          <Text
            style={[
              styles.qValueBadgeText,
              { color: has ? ratingTextColor(value as number) : Colors.textMuted },
            ]}
          >
            {has ? RATING_WORDS[value as number] : 'Not rated'}
          </Text>
        </View>
      </View>
      <RatingScale value={value} onChange={onChange} />
    </View>
  );
}

// Icon-led header for a whole step.
function StepHeader({
  Icon,
  color,
  bg,
  title,
  subtitle,
}: {
  Icon: LucideIcon;
  color: string;
  bg: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.stepHeader}>
      <View style={[styles.stepHeaderIcon, { backgroundColor: bg }]}>
        <Icon size={24} color={color} />
      </View>
      <View style={styles.stepHeaderTextWrap}>
        <Text style={styles.stepHeaderTitle}>{title}</Text>
        <Text style={styles.stepHeaderSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

// Icon-led header inside a card, with a divider.
function CardHead({ Icon, color, bg, title }: { Icon: LucideIcon; color: string; bg: string; title: string }) {
  return (
    <View style={styles.cardHead}>
      <View style={[styles.cardHeadIcon, { backgroundColor: bg }]}>
        <Icon size={18} color={color} />
      </View>
      <Text style={styles.cardHeadTitle}>{title}</Text>
    </View>
  );
}

// ── On-screen charts (mirror the PDF) ────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = score >= 75 ? Colors.success : score >= 45 ? Colors.primary : Colors.accent;
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={r} fill="none" stroke={Colors.border} strokeWidth={12} />
      <Circle
        cx={60}
        cy={60}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 60 60)"
      />
      <SvgText x={60} y={58} textAnchor="middle" fontSize={28} fontWeight="800" fill={Colors.text}>
        {String(score)}
      </SvgText>
      <SvgText x={60} y={78} textAnchor="middle" fontSize={11} fill={Colors.textMuted}>
        / 100
      </SvgText>
    </Svg>
  );
}

function SubjectBars({ bars }: { bars: Array<{ subject: string; score: number }> }) {
  const W = 320;
  const H = 170;
  const padL = 28;
  const padB = 40;
  const chartH = H - padB - 8;
  const slot = (W - padL - 12) / bars.length;
  const barW = slot - 22;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {[0, 25, 50, 75, 100].map((t) => {
        const y = 8 + chartH - (t / 100) * chartH;
        return (
          <Line key={t} x1={padL} y1={y} x2={W - 8} y2={y} stroke={Colors.border} strokeWidth={1} />
        );
      })}
      {bars.map((b, i) => {
        const x = padL + 10 + i * slot;
        const h = (b.score / 100) * chartH;
        const y = 8 + chartH - h;
        const color = b.score >= 70 ? Colors.success : b.score >= 45 ? Colors.warning : Colors.accent;
        return (
          <React.Fragment key={b.subject}>
            <Rect x={x} y={y} width={barW} height={h} rx={5} fill={color} />
            <SvgText x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={10} fontWeight="700" fill={Colors.text}>
              {String(b.score)}
            </SvgText>
            <SvgText x={x + barW / 2} y={H - 22} textAnchor="middle" fontSize={8} fill={Colors.textMuted}>
              {b.subject.slice(0, 7)}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function SkillRadar({ skills }: { skills: { cognitive: number; behavioral: number; learning: number; emotional: number } }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 66;
  const axes = [
    { label: 'Cognitive', value: skills.cognitive, angle: -90 },
    { label: 'Behavioral', value: skills.behavioral, angle: 0 },
    { label: 'Learning', value: skills.learning, angle: 90 },
    { label: 'Emotional', value: skills.emotional, angle: 180 },
  ];
  const pt = (angleDeg: number, rr: number): [number, number] => {
    const a = (angleDeg * Math.PI) / 180;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  };
  const dataPts = axes
    .map((ax) => pt(ax.angle, maxR * (Math.max(0, Math.min(100, ax.value)) / 100)).join(','))
    .join(' ');
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((f, idx) => (
        <Polygon
          key={idx}
          points={axes.map((ax) => pt(ax.angle, maxR * f).join(',')).join(' ')}
          fill="none"
          stroke={Colors.border}
          strokeWidth={1}
        />
      ))}
      {axes.map((ax) => {
        const [x, y] = pt(ax.angle, maxR);
        return <Line key={ax.label} x1={cx} y1={cy} x2={x} y2={y} stroke={Colors.border} strokeWidth={1} />;
      })}
      <Polygon points={dataPts} fill={`${Colors.primary}33`} stroke={Colors.primary} strokeWidth={2} />
      {axes.map((ax) => {
        const [x, y] = pt(ax.angle, maxR + 16);
        return (
          <SvgText key={`l-${ax.label}`} x={x} y={y} textAnchor="middle" fontSize={9} fontWeight="700" fill={Colors.text}>
            {`${ax.label} ${ax.value}`}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function CounselingScreen() {
  const insets = useSafeAreaInsets();
  const { user, apiFetch } = useAuth();
  const { linkedStudents, activeStudent, switchToStudent } = useStudentProfile();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [snapshot, setSnapshot] = useState<Snapshot>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<CounselingReportData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selector, setSelector] = useState<null | 'class' | 'board'>(null);

  const isParent = user?.activeRole === 'parent';

  const setAnswer = useCallback((key: string, value: number | boolean | string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Initialise the basic-info snapshot from the selected child.
  const ensureSnapshot = useCallback(() => {
    if (!activeStudent) return;
    setSnapshot((prev) => ({
      name: prev.name ?? `${activeStudent.firstName} ${activeStudent.lastName}`.trim(),
      classLevel: prev.classLevel ?? activeStudent.classLevel,
      age: prev.age,
      board: prev.board,
    }));
  }, [activeStudent]);

  // Pre-fill name & class from the selected child (refreshes when switching child).
  const childName = activeStudent ? `${activeStudent.firstName} ${activeStudent.lastName}`.trim() : '';
  const childClass = activeStudent?.classLevel;
  useEffect(() => {
    if (!childName) return;
    setSnapshot((prev) => ({ ...prev, name: childName, classLevel: childClass }));
  }, [childName, childClass]);

  // Clear any leftover in-progress (un-reported) sessions for this child.
  const cleanupChildId = activeStudent?.id;
  useEffect(() => {
    if (!cleanupChildId) return;
    apiFetch(`/counseling/students/${cleanupChildId}/sessions/pending`, { method: 'DELETE' }).catch(() => {});
  }, [cleanupChildId, apiFetch]);

  // Create the session only at final submission so an abandoned wizard never
  // leaves an "in progress" row behind.
  const createSession = useCallback(async (): Promise<string | null> => {
    if (!activeStudent) {
      setError('Select a child first.');
      return null;
    }
    const res = await apiFetch('/counseling/sessions', {
      method: 'POST',
      body: JSON.stringify({ studentId: activeStudent.id, snapshot }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.message || 'Could not start session');
    }
    const data = await res.json();
    setSessionId(data.id);
    return data.id as string;
  }, [activeStudent, apiFetch, snapshot]);

  const buildResponsesPayload = useCallback(() => {
    return Object.entries(answers)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([key, value]) => ({ section: sectionOf(key), questionKey: key, value }));
  }, [answers]);

  const generateReport = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const id = await createSession();
      if (!id) return;
      const durationSec = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
      const responses = buildResponsesPayload();
      if (responses.length > 0) {
        const saveRes = await apiFetch(`/counseling/sessions/${id}/responses`, {
          method: 'PATCH',
          body: JSON.stringify({ responses, durationSec, snapshot }),
        });
        if (!saveRes.ok) throw new Error('Failed to save answers');
      }
      await apiFetch(`/counseling/sessions/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ durationSec }),
      });
      const repRes = await apiFetch(`/counseling/sessions/${id}/report`, { method: 'POST' });
      if (!repRes.ok) {
        const e = await repRes.json().catch(() => ({}));
        throw new Error(e.message || 'Failed to generate report');
      }
      const data = await repRes.json();
      setReport(data.report as CounselingReportData);
      setStep(STEPS.length - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate report');
    } finally {
      setBusy(false);
    }
  }, [createSession, startedAt, buildResponsesPayload, apiFetch, snapshot]);

  const onExportPdf = useCallback(async () => {
    if (!report) return;
    setExporting(true);
    try {
      await exportCounselingReportPdf(report);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export PDF');
    } finally {
      setExporting(false);
    }
  }, [report]);

  const goNext = useCallback(async () => {
    setError('');
    if (step === 0) {
      if (!activeStudent) {
        setError('Select a child first.');
        return;
      }
      ensureSnapshot();
      if (!startedAt) setStartedAt(Date.now());
    }
    if (step === STEPS.length - 2) {
      await generateReport();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, [step, activeStudent, ensureSnapshot, startedAt, generateReport]);

  const goBack = useCallback(() => {
    setError('');
    if (step === 0) {
      router.back();
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  }, [step]);

  const progress = useMemo(() => (step) / (STEPS.length - 1), [step]);

  // ── Render guards ──────────────────────────────────────────────────────────
  if (!isParent && user?.activeRole !== 'admin' && user?.activeRole !== 'superadmin') {
    return (
      <View style={styles.center}>
        <BrainCircuit size={40} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>Counseling is parent-led</Text>
        <Text style={styles.emptyText}>Switch to a parent profile to start a counseling session for your child.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress header */}
      <ModalHeader
        onBack={goBack}
        onClose={() => router.replace('/(tabs)')}
        center={
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={styles.stepLabel}>
              {STEPS[step]} · {step + 1}/{STEPS.length}
            </Text>
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* STEP 0 — Welcome */}
        {step === 0 && (
          <View style={styles.card}>
            <View style={styles.heroIcon}>
              <ClipboardList size={28} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Student Counseling Session</Text>
            <View style={styles.timePill}>
              <Clock size={13} color={Colors.primary} />
              <Text style={styles.timePillText}>5–10 minutes</Text>
            </View>
            <Text style={styles.subtitle}>
              A quick, guided check-in to spot where your child shines and where they need support.
              This is guidance, not judgment.
            </Text>

            <View style={styles.featureList}>
              {[
                { Icon: BookOpen, color: Colors.primary, bg: Colors.primaryLight, t: 'Academic strengths', d: 'Across core subjects' },
                { Icon: Brain, color: Colors.purple, bg: Colors.purpleLight, t: 'Skills & behavior', d: 'Cognitive, social, emotional' },
                { Icon: Sparkles, color: Colors.accent, bg: Colors.accentLight, t: 'AI report card', d: 'With charts you can share' },
              ].map((f) => (
                <View key={f.t} style={styles.featureRow}>
                  <View style={[styles.featureIcon, { backgroundColor: f.bg }]}>
                    <f.Icon size={18} color={f.color} />
                  </View>
                  <View style={styles.featureTextWrap}>
                    <Text style={styles.featureTitle}>{f.t}</Text>
                    <Text style={styles.featureDesc}>{f.d}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.divider} />
            <Text style={styles.fieldLabel}>Select child</Text>
            <View style={styles.childRow}>
              {linkedStudents.length === 0 ? (
                <Text style={styles.emptyText}>No linked children found.</Text>
              ) : (
                linkedStudents.map((s) => {
                  const active = s.id === activeStudent?.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => switchToStudent(s.id)}
                      style={[styles.childChip, active && styles.childChipActive]}
                    >
                      <Text style={[styles.childChipText, active && styles.childChipTextActive]}>
                        {s.firstName} {getStandardLabel(s.classLevel) !== '-' ? `· ${getStandardLabel(s.classLevel)}` : ''}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* STEP 1 — Basic info */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.title}>Basic Info</Text>
            <Text style={styles.fieldLabel}>Child name</Text>
            <TextInput
              style={styles.input}
              value={snapshot.name ?? ''}
              onChangeText={(t) => setSnapshot((p) => ({ ...p, name: t }))}
              placeholder="Child name"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Class</Text>
            <View style={styles.selectField}>
              <Text style={[styles.selectValue, !snapshot.classLevel && styles.selectPlaceholder]}>
                {snapshot.classLevel ? getStandardLabel(snapshot.classLevel) : '—'}
              </Text>
            </View>
            <Text style={styles.fieldLabel}>Age</Text>
            <TextInput
              style={styles.input}
              value={snapshot.age ?? ''}
              onChangeText={(t) => setSnapshot((p) => ({ ...p, age: t.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
              placeholder="Age"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.fieldLabel}>School board</Text>
            <Pressable style={styles.selectField} onPress={() => setSelector('board')}>
              <Text style={[styles.selectValue, !snapshot.board && styles.selectPlaceholder]}>
                {snapshot.board ? snapshot.board : 'Select board'}
              </Text>
              <ChevronDown size={18} color={Colors.textMuted} />
            </Pressable>
          </View>
        )}

        {/* STEP 2 — Academic */}
        {step === 2 && (
          <View style={styles.stepBody}>
            <StepHeader
              Icon={GraduationCap}
              color={Colors.primary}
              bg={Colors.primaryLight}
              title="Academic Performance"
              subtitle="Rate each subject from 0 (low) to 5 (high)."
            />
            {ACADEMIC_SUBJECTS.map((subj) => (
              <View key={subj.key} style={styles.card}>
                <CardHead Icon={subj.Icon} color={subj.color} bg={subj.bg} title={subj.label} />
                {ACADEMIC_DIMS.map((dim) => {
                  const key = `${subj.key}.${dim.key}`;
                  return (
                    <RatingItem
                      key={key}
                      label={dim.label}
                      value={answers[key] as number | undefined}
                      onChange={(v) => setAnswer(key, v)}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {/* STEP 3 — Skills */}
        {step === 3 && (
          <View style={styles.stepBody}>
            <StepHeader
              Icon={Brain}
              color={Colors.purple}
              bg={Colors.purpleLight}
              title="Skills & Behavior"
              subtitle="Rate each from 0 (low) to 5 (high)."
            />
            {SKILL_GROUPS.map((group) => (
              <View key={group.section} style={styles.card}>
                <CardHead Icon={group.Icon} color={group.color} bg={group.bg} title={group.title} />
                {group.items.map((item) => (
                  <RatingItem
                    key={item.key}
                    label={item.label}
                    value={answers[item.key] as number | undefined}
                    onChange={(v) => setAnswer(item.key, v)}
                  />
                ))}
                {group.section === 'learning' && (
                  <View style={styles.qItem}>
                    <Text style={styles.qLabel}>Completes homework on time</Text>
                    <View style={styles.yesNoRow}>
                      {[
                        { v: true, l: 'Yes' },
                        { v: false, l: 'No' },
                      ].map((opt) => {
                        const active = answers['learning.homeworkOnTime'] === opt.v;
                        return (
                          <Pressable
                            key={opt.l}
                            onPress={() => setAnswer('learning.homeworkOnTime', opt.v)}
                            style={[styles.yesNoBtn, active && styles.yesNoBtnActive]}
                          >
                            <Text style={[styles.yesNoText, active && styles.yesNoTextActive]}>{opt.l}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* STEP 4 — Interests */}
        {step === 4 && (
          <View style={styles.stepBody}>
            <StepHeader
              Icon={Sparkles}
              color={Colors.accent}
              bg={Colors.accentLight}
              title="Interests & Passions"
              subtitle="How keen is your child on each? 0 to 5."
            />
            <View style={styles.card}>
              {INTEREST_ITEMS.map((item) => (
                <RatingItem
                  key={item.key}
                  label={item.label}
                  Icon={item.Icon}
                  iconColor={item.color}
                  iconBg={item.bg}
                  value={answers[item.key] as number | undefined}
                  onChange={(v) => setAnswer(item.key, v)}
                />
              ))}
            </View>
          </View>
        )}

        {/* STEP 5 — Open notes */}
        {step === 5 && (
          <View style={styles.stepBody}>
            <StepHeader
              Icon={MessageSquareText}
              color={Colors.success}
              bg={Colors.successLight}
              title="Your Notes"
              subtitle="Optional, but very helpful for the report."
            />
            <View style={styles.card}>
              {OPEN_QUESTIONS.map((q) => (
                <View key={q.key} style={styles.qItem}>
                  <Text style={styles.qLabel}>{q.label}</Text>
                  <TextInput
                    style={styles.textArea}
                    value={(answers[q.key] as string) ?? ''}
                    onChangeText={(t) => setAnswer(q.key, t)}
                    multiline
                    placeholder="Type here..."
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* STEP 6 — Review */}
        {step === 6 && (
          <View style={styles.stepBody}>
            <StepHeader
              Icon={CheckCircle2}
              color={Colors.success}
              bg={Colors.successLight}
              title="Review & Submit"
              subtitle="Check the details, then generate the report."
            />
            <View style={styles.card}>
              <View style={styles.identityCard}>
                <View style={styles.identityAvatar}>
                  <Text style={styles.identityAvatarText}>
                    {(snapshot.name || activeStudent?.firstName || '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.identityTextWrap}>
                  <Text style={styles.identityName}>{snapshot.name || activeStudent?.firstName}</Text>
                  <Text style={styles.identityMeta}>
                    {getStandardLabel(snapshot.classLevel)}
                    {snapshot.board ? ` · ${snapshot.board}` : ''}
                    {snapshot.age ? ` · Age ${snapshot.age}` : ''}
                  </Text>
                </View>
              </View>

              {[
                {
                  Icon: GraduationCap, color: Colors.primary, bg: Colors.primaryLight, label: 'Academic answers',
                  val: `${Object.keys(answers).filter((k) => sectionOf(k) === 'academic').length} / 16`,
                },
                {
                  Icon: Brain, color: Colors.purple, bg: Colors.purpleLight, label: 'Skill answers',
                  val: `${Object.keys(answers).filter((k) => ['cognitive', 'behavioral', 'learning', 'emotional'].includes(sectionOf(k))).length} / 16`,
                },
                {
                  Icon: Sparkles, color: Colors.accent, bg: Colors.accentLight, label: 'Interest answers',
                  val: `${Object.keys(answers).filter((k) => sectionOf(k) === 'interests').length} / 5`,
                },
              ].map((r) => (
                <View key={r.label} style={styles.reviewRow}>
                  <View style={[styles.reviewIcon, { backgroundColor: r.bg }]}>
                    <r.Icon size={16} color={r.color} />
                  </View>
                  <Text style={styles.reviewKey}>{r.label}</Text>
                  <Text style={styles.reviewVal}>{r.val}</Text>
                </View>
              ))}

              <View style={styles.callout}>
                <Sparkles size={16} color={Colors.primary} />
                <Text style={styles.calloutText}>
                  Tap Generate Report to run the AI analysis and build your child's holistic report card.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* STEP 7 — Report */}
        {step === 7 && report && (
          <View style={styles.stepBody}>
            <View style={[styles.card, styles.summaryCard]}>
              <ScoreGauge score={report.summary.overallScore} />
              <View style={styles.summaryMeta}>
                <Text style={styles.summaryLabel}>OVERALL READINESS</Text>
                <View style={styles.pillWrap}>
                  <View style={styles.pill}><Text style={styles.pillText}>Level: {report.summary.level}</Text></View>
                  <View style={styles.pill}><Text style={styles.pillText}>Growth: {report.summary.growthPotential}</Text></View>
                  <View style={styles.pill}><Text style={styles.pillText}>{report.summary.studyPatternType}</Text></View>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <CardHead Icon={GraduationCap} color={Colors.primary} bg={Colors.primaryLight} title="Subject Performance" />
              <View style={styles.chartCenter}>
                <SubjectBars bars={report.graphs.subjectBars} />
              </View>
            </View>

            <View style={styles.card}>
              <CardHead Icon={Brain} color={Colors.purple} bg={Colors.purpleLight} title="Skill Profile" />
              <View style={styles.chartCenter}>
                <SkillRadar skills={report.graphs.radarSkills} />
              </View>
            </View>

            <View style={styles.card}>
              <CardHead Icon={Lightbulb} color={Colors.warning} bg={Colors.warningLight} title="Key Insights" />
              {report.keyInsights.map((i, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <CheckCircle2 size={15} color={Colors.success} />
                  <Text style={styles.bulletText}>{i}</Text>
                </View>
              ))}
            </View>

            {report.riskIndicators.length > 0 && (
              <View style={styles.card}>
                <CardHead Icon={Target} color={Colors.accent} bg={Colors.accentLight} title="Risk Indicators" />
                <View style={styles.chipWrap}>
                  {report.riskIndicators.map((r, idx) => (
                    <View key={idx} style={[styles.riskChip, { borderColor: Colors.warning }]}>
                      <Text style={styles.riskChipText}>{r.name} · {r.severity}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.card}>
              <CardHead Icon={Sparkles} color={Colors.primary} bg={Colors.primaryLight} title="Recommendations" />
              {[...report.recommendations.subjectLevel, ...report.recommendations.skillLevel].map((r, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <ArrowRight size={14} color={Colors.primary} />
                  <Text style={styles.bulletText}>{r}</Text>
                </View>
              ))}
              {report.recommendations.courseSuggestions.length > 0 && (
                <View style={styles.callout}>
                  <Text style={styles.calloutText}>
                    Suggested tracks:{' '}
                    {report.recommendations.courseSuggestions.map((c) => `${c.track} (${c.level})`).join(', ')}
                  </Text>
                </View>
              )}
            </View>

            <Pressable onPress={onExportPdf} style={styles.pdfBtn} disabled={exporting}>
              {exporting ? (
                <ActivityIndicator accessibilityLabel="Loading" color="#fff" />
              ) : (
                <>
                  <Download size={18} color="#fff" />
                  <Text style={styles.pdfBtnText}>Generate Report (PDF)</Text>
                </>
              )}
            </Pressable>
            <Pressable onPress={() => router.replace('/(tabs)')} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Footer nav (hidden on report step) */}
      {step < STEPS.length - 1 && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable onPress={goNext} style={[styles.nextBtn, busy && styles.nextBtnDisabled]} disabled={busy}>
            {busy ? (
              <ActivityIndicator accessibilityLabel="Loading" color="#fff" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>
                  {step === 0 ? 'Start Counseling' : step === STEPS.length - 2 ? 'Generate Report' : 'Next'}
                </Text>
                <ArrowRight size={18} color="#fff" />
              </>
            )}
          </Pressable>
        </View>
      )}

      <SelectorModal
        visible={selector === 'class'}
        title="Select Class"
        options={CLASS_SELECT_OPTIONS}
        selected={snapshot.classLevel ?? ''}
        showAny={false}
        onSelect={(v) => setSnapshot((p) => ({ ...p, classLevel: v }))}
        onClose={() => setSelector(null)}
      />
      <SelectorModal
        visible={selector === 'board'}
        title="Select Board"
        options={BOARD_SELECT_OPTIONS}
        selected={snapshot.board ?? ''}
        showAny={false}
        onSelect={(v) => setSnapshot((p) => ({ ...p, board: v }))}
        onClose={() => setSelector(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10, backgroundColor: Colors.background },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  iconBtn: { padding: 6 },
  progressWrap: { flex: 1 },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: Colors.border, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: Colors.primary },
  stepLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 5, fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 28, gap: 14 },
  stepBody: { gap: 14 },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.card, padding: 18, gap: 6, borderWidth: 1, borderColor: Colors.borderLight, ...Shadow.sm },
  heroIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryLight },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text, marginTop: 4 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  sectionHint: { fontSize: 12, color: Colors.textMuted, paddingHorizontal: 4, marginBottom: 2 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.text, backgroundColor: Colors.surfaceAlt, marginTop: 4,
  },
  textArea: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.text, backgroundColor: Colors.surfaceAlt, minHeight: 64, textAlignVertical: 'top', marginTop: 4,
  },
  selectField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: Colors.surfaceAlt, marginTop: 4,
  },
  selectValue: { fontSize: 14, fontWeight: '600', color: Colors.text },
  selectPlaceholder: { fontWeight: '400', color: Colors.textMuted },

  childRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  childChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  childChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  childChipText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  childChipTextActive: { color: '#fff' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },

  qItem: { marginTop: 16 },
  qLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  qLabelInline: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  qLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, minHeight: 28 },
  qLabelIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qValueBadge: { minWidth: 76, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignItems: 'center' },
  qValueBadgeText: { fontSize: 11, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', gap: 6 },
  ratingSeg: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  ratingSegPicked: { transform: [{ translateY: -1 }], ...Shadow.sm },
  ratingSegText: { fontSize: 14, fontWeight: '800', color: Colors.textMuted },
  ratingSegTextActive: { color: '#fff' },
  ratingCaptionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 2 },
  ratingCaption: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.3 },

  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingVertical: 2, marginBottom: 2 },
  stepHeaderIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepHeaderTextWrap: { flex: 1 },
  stepHeaderTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  stepHeaderSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2, lineHeight: 16 },

  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 2, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  cardHeadIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardHeadTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 8 },

  timePill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, backgroundColor: Colors.primaryLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 },
  timePillText: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  featureList: { gap: 10, marginTop: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureTextWrap: { flex: 1 },
  featureTitle: { fontSize: 13, fontWeight: '800', color: Colors.text },
  featureDesc: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  identityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 12, marginBottom: 4 },
  identityAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  identityAvatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  identityTextWrap: { flex: 1 },
  identityName: { fontSize: 15, fontWeight: '800', color: Colors.text },
  identityMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  reviewIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  yesNoRow: { flexDirection: 'row', gap: 10 },
  yesNoBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  yesNoBtnActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  yesNoText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  yesNoTextActive: { color: '#fff' },

  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  reviewKey: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  reviewVal: { fontSize: 13, fontWeight: '800', color: Colors.text },

  callout: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: 12, marginTop: 12 },
  calloutText: { flex: 1, fontSize: 12, color: Colors.text, lineHeight: 17 },

  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  summaryMeta: { flex: 1 },
  summaryLabel: { fontSize: 11, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.5 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pill: { backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  chartCenter: { alignItems: 'center', marginTop: 6 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 8 },
  bulletText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  riskChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.warningLight },
  riskChipText: { fontSize: 11, fontWeight: '700', color: Colors.text },

  pdfBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, borderRadius: Radius.lg, paddingVertical: 15, marginTop: 4, ...Shadow.sm },
  pdfBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  doneBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },

  errorText: { color: Colors.error, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  nextBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 15 },
  nextBtnDisabled: { opacity: 0.7 },
  nextBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
