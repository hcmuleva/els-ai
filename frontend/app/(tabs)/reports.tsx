import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Linking,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BookOpen,
  Trophy,
  Zap,
  TrendingUp,
  X,
  ChevronRight,
  Clock,
  BarChart2,
  Calendar,
  Timer,
  School,
  Layers,
  ClipboardList,
  Activity,
  RotateCw,
  User,
  Users,
  CheckCircle,
  SkipForward,
  History,
  Brain,
  Download,
  Sparkles,
  MessageCircle,
  Send,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SvgXml } from "react-native-svg";

import { useAuth, API_BASE_URL } from "../../src/context/AuthContext";
import { Colors, Radius, RoleColors, Shadow } from "../../src/theme";
import {
  OWL,
  PENGUIN,
  ELEPHANT,
  BUTTERFLY,
  GIRAFFE,
} from "../../src/assets/svgs";
import {
  useStudentProfile,
  type ClassroomRemarkItem,
} from "../../src/context/StudentProfileContext";
import { getStandardLabel } from "../../src/constants/standards";
import {
  exportCounselingReportPdf,
  type CounselingReportData,
} from "../../src/utils/counselingPdf";
import ParentFeedbackTab from "../../src/components/feedback/ParentFeedbackTab";
import TeacherFeedbackTab from "../../src/components/feedback/TeacherFeedbackTab";
import TrendAnalysisTab from "../../src/components/reports/TrendAnalysisTab";
import { RISK_CLR } from "../../src/components/reports/charts";
import { riskFromScore } from "../../src/utils/riskForecast";

// ── Types ─────────────────────────────────────────────────────────────────────
type TeacherOverview = {
  summary: {
    total_quizzes: string;
    published_quizzes: string;
    ai_generated_quizzes: string;
    total_attempts: string;
    average_score_pct: string;
  };
  classPerformance: Array<{
    class_level: string;
    attempts: string;
    average_score_pct: string;
  }>;
  topGaps: Array<{
    question_id: string;
    question_title: string;
    incorrect_pct: string;
  }>;
};

type ClassActivityAttempt = {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  completedAt: string;
  totalQuestions: number;
  correctCount: number;
  scorePct: number;
  hasGame: boolean;
  gameMetrics: {
    clicksUsed: number;
    clickLimit: number;
    pairsMatched: number;
    totalPairs: number;
    accuracy: number;
  } | null;
};
type ClassActivityStudent = {
  studentId: string;
  firstName: string;
  lastName: string;
  classLevel: string | null;
  profileImage: string | null;
  attempts: ClassActivityAttempt[];
};

// ── Main Screen ───────────────────────────────────────────────────────────────
// ── PARENT REPORTS ────────────────────────────────────────────────────────────
// Darkened so white childChipName/childChipSub text on the active solid chip
// clears 4.5:1 (raw #7DC67A/#9B8EC4/#E6A020 were 2.0-2.2:1).
const CHILD_COLORS_PR = [Colors.primary, "#2F6B2D", "#B03A19", Colors.purple, RoleColors.superadmin];
type IconComp2 = React.ComponentType<{ size: number; color: string }>;
const ACT_ICON_MAP: Record<string, IconComp2> = {
  content: BookOpen,
  quiz: Layers,
  assignment: ClipboardList,
};
function ActIcon({
  type,
  size = 18,
  color,
}: {
  type: string;
  size?: number;
  color: string;
}) {
  const Icon = ACT_ICON_MAP[type] ?? BookOpen;
  return <Icon size={size} color={color} />;
}
const STATUS_CLR: Record<string, string> = {
  completed: "#4CAF50",
  attempted: "#E6A020",
  pending: Colors.textMuted,
};
// Darker variants for statusChipText, which renders these on top of a
// 13%-alpha self-tint of the same color (2.0-2.5:1) — STATUS_CLR itself
// stays vivid since it also feeds the icon fill and the tint background.
const STATUS_TEXT_CLR: Record<string, string> = {
  completed: "#1B5E20",
  attempted: RoleColors.superadmin,
  pending: Colors.textMuted,
};
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtSec(sec: number) {
  if (sec >= 3600)
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  if (sec >= 60) return `${Math.floor(sec / 60)}m`;
  return `${sec}s`;
}

// color is reused for both icon fill and text (scoreNum/scoreLabel) on top
// of bg — Excellent/Average/Needs Work darkened for WCAG AA text contrast.
function scoreGrade(pct: number): { label: string; color: string; bg: string } {
  if (pct >= 90) return { label: "Excellent", color: Colors.success, bg: "#E8F5E9" };
  if (pct >= 75) return { label: "Good", color: Colors.primary, bg: "#D6EAFF" };
  if (pct >= 50) return { label: "Average", color: RoleColors.superadmin, bg: "#FFF5CC" };
  return { label: "Needs Work", color: "#B03A19", bg: "#FFE8D6" };
}

function getClassroomAvgScore(item: ClassroomRemarkItem): number {
  const vals = [
    item.scoreBehavior,
    item.scoreConfidence,
    item.scoreParticipation,
    item.scorePerformance,
  ].filter((v): v is number => typeof v === "number" && v >= 0);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// Proper labeled bar chart with y-axis, gridlines, value labels
function ProperBarChart({
  data,
  color,
  unit = "",
  yTicks = 4,
  height = 120,
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
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((niceMax / yTicks) * i),
  );
  const BAR_H = height;
  const Y_LABEL_W = 32;
  const hasData = data.some((d) => d.value > 0);

  return (
    <View style={{ paddingTop: 4 }}>
      <View style={{ flexDirection: "row" }}>
        {/* Y-axis */}
        <View
          style={{
            width: Y_LABEL_W,
            height: BAR_H,
            justifyContent: "space-between",
            alignItems: "flex-end",
            paddingRight: 6,
          }}
        >
          {[...ticks].reverse().map((t) => (
            <Text
              key={t}
              style={{ fontSize: 9, color: "#B0B0C8", fontWeight: "600" }}
            >
              {t}
              {unit}
            </Text>
          ))}
        </View>
        {/* Chart area */}
        <View style={{ flex: 1, height: BAR_H, position: "relative" }}>
          {/* Horizontal gridlines */}
          {ticks.map((t, i) => (
            <View
              key={t}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: i === 0 ? 0 : (t / niceMax) * BAR_H,
                height: 1,
                backgroundColor: i === 0 ? "#D8D8E8" : Colors.borderLight,
              }}
            />
          ))}
          {/* Bars */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              height: "100%",
              gap: 4,
              paddingBottom: 1,
            }}
          >
            {data.map((d, i) => {
              const barH =
                niceMax > 0
                  ? Math.max(
                      d.value > 0 ? 4 : 0,
                      (d.value / niceMax) * (BAR_H - 2),
                    )
                  : 0;
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "flex-end",
                    height: "100%",
                  }}
                >
                  {d.value > 0 && (
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: "800",
                        color: color,
                        marginBottom: 2,
                      }}
                    >
                      {d.value}
                      {unit}
                    </Text>
                  )}
                  <View
                    style={{
                      width: "75%",
                      height: barH,
                      borderRadius: 5,
                      backgroundColor: d.value > 0 ? color : Colors.borderLight,
                      opacity: d.value > 0 ? 1 : 0.5,
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>
      {/* X-axis labels */}
      <View
        style={{
          flexDirection: "row",
          marginLeft: Y_LABEL_W,
          marginTop: 6,
          gap: 4,
        }}
      >
        {data.map((d, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 9,
              color: Colors.textMuted,
              fontWeight: "700",
            }}
          >
            {d.label}
          </Text>
        ))}
      </View>
      {!hasData && (
        <Text
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#C8C8D8",
            fontWeight: "600",
            marginTop: 8,
          }}
        >
          No data yet
        </Text>
      )}
    </View>
  );
}

// 7-day streak calendar grid
function StreakCalendar({
  activeDates,
  streakDays,
}: {
  activeDates: string[];
  streakDays: number;
}) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return {
      date: d.toISOString().split("T")[0],
      label: DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1],
    };
  });
  const activeSet = new Set(activeDates);
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {days.map(({ date, label }) => {
        const active = activeSet.has(date);
        const isToday = date === today.toISOString().split("T")[0];
        return (
          <View key={date} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: "100%",
                aspectRatio: 1,
                borderRadius: 10,
                backgroundColor: active
                  ? Colors.primary
                  : isToday
                    ? "#EBF4FF"
                    : "#F4F4FB",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: isToday && !active ? 1.5 : 0,
                borderColor: Colors.primary,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: active ? "#fff" : isToday ? Colors.primary : "#D0D0E0",
                }}
              >
                {active ? "✓" : "–"}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 9,
                color: active ? Colors.primary : "#C0C0D0",
                fontWeight: "700",
              }}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Quiz attempt detail types ─────────────────────────────────────────────────
type QuizAttemptDetail = {
  attempt: {
    id: string;
    quizTitle: string;
    classLevel: string | null;
    completedAt: string;
    scorePct: number;
    correctCount: number;
    totalQuestions: number;
  };
  questions: Array<{
    questionId: string;
    questionTitle: string | null;
    questionInstruction: string | null;
    questionType: string;
    questionData: {
      options?: Array<{ id: string; label?: string; is_correct?: boolean }>;
      pairs?: Array<{ id: number; label: string; imageUrl?: string }>;
      grid?: string;
      sentence?: string;
      answer?: string;
      [k: string]: unknown;
    };
    sortOrder: number | null;
    isCorrect: boolean;
    responseData: {
      selected_id?: string;
      selected_ids?: string[];
      // memory_match
      clicksUsed?: number;
      clickLimit?: number;
      pairsMatched?: number;
      totalPairs?: number;
      accuracy?: number;
      correctMatches?: Array<{
        pairId: number;
        label: string;
        imageUrl?: string;
      }>;
      wrongAttempts?: number;
      completed?: boolean;
      // fill_blank
      selected?: string;
      answer?: string;
      [k: string]: unknown;
    };
  }>;
};

// ── Tab definitions ───────────────────────────────────────────────────────────
type IconComp = React.ComponentType<{ size: number; color: string }>;
type ParentTab =
  | "overview"
  | "trends"
  | "quizzes"
  | "assignments"
  | "classroom"
  | "feedback"
  | "activity"
  | "counseling";
const PARENT_TABS: Array<{ key: ParentTab; label: string; Icon: IconComp }> = [
  { key: "overview", label: "Overview", Icon: BarChart2 },
  { key: "trends", label: "Growth Trends", Icon: TrendingUp },
  { key: "quizzes", label: "Quizzes", Icon: Layers },
  { key: "assignments", label: "Tasks", Icon: ClipboardList },
  { key: "classroom", label: "Classroom", Icon: School },
  { key: "feedback", label: "Feedback", Icon: MessageCircle },
  { key: "activity", label: "Activity", Icon: Activity },
  { key: "counseling", label: "Counsel", Icon: Brain },
];

function QuizKindBadge({ kind }: { kind?: "classroom" | "story" | "subject" }) {
  const config =
    kind === "story"
      ? { bg: "#EFE7FB", fg: "#7C3AED", label: "Story" }
      : kind === "classroom"
        ? { bg: "#DBEAFE", fg: "#1D4ED8", label: "Classroom" }
        : { bg: "#DCFCE7", fg: "#15803D", label: "Subject" };
  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        backgroundColor: config.bg,
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontWeight: "900",
          color: config.fg,
          letterSpacing: 0.4,
        }}
      >
        {config.label}
      </Text>
    </View>
  );
}

// ── Counseling history tab ────────────────────────────────────────────────────
type CounselingSessionRow = {
  id: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  durationSec: number;
  overallScore: number | null;
  level: string | null;
  reportCreatedAt: string | null;
};

function CounselingTab({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const { apiFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<CounselingSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [report, setReport] = useState<CounselingReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await apiFetch(`/counseling/students/${studentId}/sessions`);
      if (!res.ok) throw new Error("Failed to load sessions");
      const data = await res.json();
      setSessions((data.sessions ?? []) as CounselingSessionRow[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const openReport = useCallback(
    async (sessionId: string) => {
      setLoadingReport(true);
      setReport(null);
      try {
        const res = await apiFetch(`/counseling/sessions/${sessionId}/report`);
        if (!res.ok) throw new Error("No report");
        const data = await res.json();
        setReport(data.report as CounselingReportData);
      } catch {
        setErr("This session has no report yet.");
      } finally {
        setLoadingReport(false);
      }
    },
    [apiFetch],
  );

  const onDownload = useCallback(async () => {
    if (!report) return;
    setExporting(true);
    try {
      await exportCounselingReportPdf(report);
    } catch {
      /* silent */
    } finally {
      setExporting(false);
    }
  }, [report]);

  const fmtDate = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const reportedCount = sessions.filter((s) => s.reportCreatedAt != null).length;

  return (
    <>
      {/* Intro hero */}
      <View style={cs.intro}>
        <View style={cs.introIcon}>
          <Brain size={24} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cs.introTitle}>AI Counseling</Text>
          <Text style={cs.introSub}>
            Guided check-in and a holistic AI report card.
          </Text>
        </View>
        <Pressable
          style={cs.introBtn}
          onPress={() => router.push("/(tabs)/counseling")}
        >
          <Sparkles size={14} color="#7B5FC7" />
          <Text style={cs.introBtnText}>Start</Text>
        </Pressable>
      </View>

      <View style={pr.sectionHdr}>
        <Text style={pr.sectionHdrTitle}>History</Text>
        <Text style={pr.sectionHdrChip}>
          {reportedCount} report{reportedCount !== 1 ? "s" : ""}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading" color={Colors.primary} style={{ marginVertical: 24 }} />
      ) : sessions.length === 0 ? (
        <View style={pr.emptyStateCard}>
          <SvgXml xml={OWL} width={64} height={64} />
          <Text style={pr.emptyStateTitle}>No counseling yet</Text>
          <Text style={pr.emptyStateText}>
            Run a guided counseling session for {studentName} to generate an AI
            report card.
          </Text>
        </View>
      ) : (
        sessions.map((sn) => {
          const hasReport = sn.reportCreatedAt != null;
          const grade =
            sn.overallScore != null ? scoreGrade(sn.overallScore) : null;
          return (
            <Pressable
              key={sn.id}
              style={pr.quizCard}
              disabled={!hasReport}
              onPress={() => hasReport && openReport(sn.id)}
            >
              <View style={[pr.quizIconBox, { backgroundColor: Colors.purpleLight }]}>
                <Brain size={22} color="#9B8EC4" />
              </View>
              <View style={pr.quizInfo}>
                <Text style={pr.quizTitle} numberOfLines={1}>
                  {hasReport
                    ? "Counseling Report"
                    : sn.status === "submitted"
                      ? "Awaiting report"
                      : "In progress"}
                </Text>
                {hasReport && sn.level ? (
                  <Text style={pr.quizMeta}>Level: {sn.level}</Text>
                ) : null}
                <View style={pr.inlineMetaRow}>
                  <Calendar size={11} color={Colors.textMuted} />
                  <Text style={pr.inlineMetaText}>
                    {fmtDate(sn.reportCreatedAt || sn.startedAt)}
                  </Text>
                </View>
              </View>
              {grade ? (
                <View style={[pr.scoreBadge, { backgroundColor: grade.bg }]}>
                  <Text style={[pr.scoreNum, { color: grade.color }]}>
                    {sn.overallScore}
                  </Text>
                  <Text style={[pr.scoreLabel, { color: grade.color }]}>
                    {grade.label}
                  </Text>
                </View>
              ) : (
                <View
                  style={[pr.statusChip, { backgroundColor: Colors.borderLight }]}
                >
                  <Text style={[pr.statusChipText, { color: Colors.textMuted }]}>
                    {sn.status}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })
      )}

      {err ? (
        <Text style={[cs.err, { marginHorizontal: 16 }]}>{err}</Text>
      ) : null}

      {/* Report detail + download */}
      <Modal
        visible={!!report || loadingReport}
        animationType="slide"
        transparent
        onRequestClose={() => setReport(null)}
      >
        <View style={pr.modalOverlay}>
          <View style={[pr.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={pr.modalHeader}>
              <View>
                <Text style={pr.modalTitle}>Counseling Report</Text>
                <Text style={pr.modalSub}>{studentName}</Text>
              </View>
              <Pressable style={pr.modalClose} onPress={() => setReport(null)}>
                <X size={18} color={Colors.textMuted} />
              </Pressable>
            </View>

            {loadingReport || !report ? (
              <ActivityIndicator accessibilityLabel="Loading"
                color={Colors.primary}
                style={{ marginVertical: 40 }}
              />
            ) : (
              <ScrollView
                contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={cs.summaryCard}>
                  <View style={cs.summaryScoreWrap}>
                    <Text style={cs.summaryScore}>
                      {report.summary.overallScore}
                    </Text>
                    <Text style={cs.summaryScoreMax}>/ 100</Text>
                  </View>
                  <View style={cs.summaryPills}>
                    <View style={cs.pill}>
                      <Text style={cs.pillText}>
                        Level: {report.summary.level}
                      </Text>
                    </View>
                    <View style={cs.pill}>
                      <Text style={cs.pillText}>
                        Growth: {report.summary.growthPotential}
                      </Text>
                    </View>
                    <View style={cs.pill}>
                      <Text style={cs.pillText}>
                        {report.summary.studyPatternType}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={cs.secTitle}>Subject Performance</Text>
                {report.subjectPerformance.map((s) => (
                  <View key={s.subject} style={cs.barRow}>
                    <Text style={cs.barLabel} numberOfLines={1}>
                      {s.subject}
                    </Text>
                    <View style={cs.barTrack}>
                      <View
                        style={[
                          cs.barFill,
                          { width: `${Math.max(0, Math.min(100, s.score))}%` },
                        ]}
                      />
                    </View>
                    <Text style={cs.barVal}>{s.score}</Text>
                  </View>
                ))}

                {report.keyInsights.length > 0 && (
                  <>
                    <Text style={cs.secTitle}>Key Insights</Text>
                    {report.keyInsights.map((i, idx) => (
                      <View key={idx} style={cs.bullet}>
                        <CheckCircle size={14} color="#4CAF50" />
                        <Text style={cs.bulletText}>{i}</Text>
                      </View>
                    ))}
                  </>
                )}

                {report.recommendations.subjectLevel.length +
                  report.recommendations.skillLevel.length >
                  0 && (
                  <>
                    <Text style={cs.secTitle}>Recommendations</Text>
                    {[
                      ...report.recommendations.subjectLevel,
                      ...report.recommendations.skillLevel,
                    ].map((r, idx) => (
                      <View key={idx} style={cs.bullet}>
                        <TrendingUp size={14} color={Colors.primary} />
                        <Text style={cs.bulletText}>{r}</Text>
                      </View>
                    ))}
                  </>
                )}

                <Pressable
                  style={cs.dlBtn}
                  onPress={onDownload}
                  disabled={exporting}
                >
                  {exporting ? (
                    <ActivityIndicator accessibilityLabel="Loading" color="#fff" />
                  ) : (
                    <>
                      <Download size={18} color="#fff" />
                      <Text style={cs.dlBtnText}>Download PDF</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const cs = StyleSheet.create({
  intro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 22,
    backgroundColor: "#8B7DD8",
    padding: 18,
    shadowColor: "#8B7DD8",
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 5,
  },
  introIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  introTitle: { fontSize: 16, fontWeight: "900", color: "#fff" },
  introSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
    marginTop: 2,
  },
  introBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  introBtnText: { fontSize: 13, fontWeight: "800", color: "#7B5FC7" },
  err: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },
  summaryCard: {
    gap: 12,
    backgroundColor: "#8B7DD8",
    borderRadius: Radius.card,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#8B7DD8",
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 5,
  },
  summaryScoreWrap: { flexDirection: "row", alignItems: "flex-end" },
  summaryScore: { fontSize: 42, fontWeight: "900", color: "#fff", lineHeight: 46 },
  summaryScoreMax: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    marginLeft: 3,
  },
  summaryPills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: { fontSize: 11, fontWeight: "800", color: "#fff" },
  secTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
    marginTop: 6,
    marginBottom: 8,
  },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  barLabel: { width: 96, fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.border,
    overflow: "hidden",
  },
  barFill: { height: 10, borderRadius: 999, backgroundColor: Colors.primary },
  barVal: { width: 26, textAlign: "right", fontSize: 12, fontWeight: "800", color: Colors.text },
  bullet: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 8 },
  bulletText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  dlBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: 15,
    marginTop: 18,
    ...Shadow.sm,
  },
  dlBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});

function ParentReports({ mode = "parent" }: { mode?: "parent" | "student" }) {
  const {
    linkedStudents,
    activeStudent,
    loadingStudents,
    loadingActivity,
    activity,
    analytics,
    quizAttempts,
    assignments,
    upcomingClassrooms,
    classroomRemarks,
    switchToStudent,
    refreshAll,
    refreshQuizAttempts,
  } = useStudentProfile();
  const { apiFetch } = useAuth();
  const isStudentMode = mode === "student";
  const insets = useSafeAreaInsets();
  // Laptop/monitor-sized viewports get a 2-column dashboard grid for paired
  // content (e.g. side-by-side charts) instead of one full-width block per row.
  const { width: windowWidth } = useWindowDimensions();
  const isLargeScreen = windowWidth >= 1024;

  const [activeTab, setActiveTab] = useState<ParentTab>("overview");
  const prevTab = useRef<ParentTab>("overview");

  const didInitialFocusRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      // skip the very first focus — the StudentProfileContext already fetches on mount
      if (!didInitialFocusRef.current) {
        didInitialFocusRef.current = true;
        return;
      }
      if (activeStudent?.id) refreshAll();
    }, [activeStudent?.id]),
  );
  // Persisted "last seen at" timestamps per tab (ms since epoch, 0 = never)
  const [tabSeenAt, setTabSeenAt] = useState<Record<string, number>>({});
  const [showAllQuizzes, setShowAllQuizzes] = useState(false);
  const [showAllClassrooms, setShowAllClassrooms] = useState(false);
  const [historySeenAt, setHistorySeenAt] = useState<number | null>(null);
  const [quizDetail, setQuizDetail] = useState<QuizAttemptDetail | null>(null);
  const [classroomDetail, setClassroomDetail] =
    useState<ClassroomRemarkItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const openQuizDetail = async (attemptId: string) => {
    if (!activeStudent) return;
    setLoadingDetail(true);
    setQuizDetail(null);
    setShowAllQuizzes(false);
    try {
      const res = await apiFetch(
        `/students/${activeStudent.id}/quiz-attempts/${attemptId}`,
      );
      if (res.ok) setQuizDetail(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoadingDetail(false);
    }
  };

  const openClassroomMedia = async (url?: string | null) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      /* silent */
    }
  };

  const getDateTimeParts = (iso?: string | null) => {
    if (!iso) return { date: "—", time: "—" };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: "—", time: "—" };
    return {
      date: d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      time: d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  };

  const sum = analytics?.summary;
  const daily = analytics?.daily ?? [];

  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return {
      date: d.toISOString().split("T")[0],
      label: DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1].slice(0, 2),
    };
  });

  const timeChartData = last7.map(({ date, label }) => {
    const row = daily.find((r) => r.date?.toString().split("T")[0] === date);
    return { label, value: Math.round((row?.totalTimeSeconds ?? 0) / 60) };
  });

  const completionChartData = last7.map(({ date, label }) => {
    const row = daily.find((r) => r.date?.toString().split("T")[0] === date);
    return { label, value: Math.round(row?.completionRate ?? 0) };
  });

  const activeDates = daily
    .filter((r) => (r.attemptedCount ?? 0) > 0)
    .map((r) => r.date?.toString().split("T")[0] ?? "");

  const pendingAssignments = assignments.filter((a) => a.status === "pending");
  const submittedAssignments = assignments.filter(
    (a) => a.status !== "pending",
  );
  const activeClassrooms = classroomRemarks.active;
  const completedClassrooms = classroomRemarks.completed;

  const historyStorageKey = activeStudent?.id
    ? `parent_history_seen_at:${activeStudent.id}`
    : null;

  useEffect(() => {
    let cancelled = false;
    if (!historyStorageKey) {
      setHistorySeenAt(null);
      return;
    }
    AsyncStorage.getItem(historyStorageKey)
      .then((val) => {
        if (cancelled) return;
        setHistorySeenAt(val ? Number(val) : 0);
      })
      .catch(() => {
        if (!cancelled) setHistorySeenAt(0);
      });
    return () => {
      cancelled = true;
    };
  }, [historyStorageKey]);

  const newEndedCount = useMemo(() => {
    if (historySeenAt === null) return 0;
    return completedClassrooms.filter((c) => {
      const t = c.endedAt ? new Date(c.endedAt).getTime() : 0;
      return t > (historySeenAt || 0);
    }).length;
  }, [completedClassrooms, historySeenAt]);

  const openHistoryModal = useCallback(async () => {
    setShowAllClassrooms(true);
    if (historyStorageKey) {
      const now = Date.now();
      try {
        await AsyncStorage.setItem(historyStorageKey, String(now));
      } catch (_e) {
        /* silent */
      }
      setHistorySeenAt(now);
    }
  }, [historyStorageKey]);

  // Load persisted tab-seen timestamps whenever the active student changes
  useEffect(() => {
    if (!activeStudent?.id) {
      setTabSeenAt({});
      return;
    }
    const tabs: ParentTab[] = [
      "quizzes",
      "assignments",
      "classroom",
      "activity",
    ];
    Promise.all(
      tabs.map((k) =>
        AsyncStorage.getItem(`parent_tab_seen2:${activeStudent.id}:${k}`)
          .then((v) => [k, v ? Number(v) : 0] as [string, number])
          .catch(() => [k, 0] as [string, number]),
      ),
    ).then((entries) => setTabSeenAt(Object.fromEntries(entries)));
  }, [activeStudent?.id]);

  const markTabSeen = useCallback(
    async (tabKey: ParentTab) => {
      if (!activeStudent?.id) return;
      const now = Date.now();
      setTabSeenAt((prev) => ({ ...prev, [tabKey]: now }));
      try {
        await AsyncStorage.setItem(
          `parent_tab_seen2:${activeStudent.id}:${tabKey}`,
          String(now),
        );
      } catch {
        /* silent */
      }
    },
    [activeStudent?.id],
  );

  // Notification dots — only show for activity that arrived AFTER last visit to that tab
  const recentQuizCount = useMemo(() => {
    const seenTs = tabSeenAt["quizzes"] ?? 0;
    return quizAttempts.filter(
      (a) => a.attemptedAt && new Date(a.attemptedAt).getTime() > seenTs,
    ).length;
  }, [quizAttempts, tabSeenAt]);

  const newPendingCount = useMemo(() => {
    const seenTs = tabSeenAt["assignments"] ?? 0;
    // show dot for assignments that appeared (approximated by load time) after last visit
    return seenTs === 0 ? pendingAssignments.length : 0;
  }, [pendingAssignments, tabSeenAt]);

  const classroomCards =
    activeClassrooms.length > 0
      ? activeClassrooms
      : upcomingClassrooms.map(
          (c) =>
            ({
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
            }) as ClassroomRemarkItem,
        );

  return (
    <View style={pr.screen}>
      {/* ── TOP BAR + STICKY TABS (always visible) ── */}
      <View
        style={[pr.topBar, { paddingTop: Platform.OS === "ios" ? 52 : 18 }]}
      >
        <View>
          <Text style={pr.topBarSub}>Learning Reports</Text>
          <Text style={pr.topBarTitle}>
            {isStudentMode
              ? "My Progress"
              : activeStudent
                ? `${activeStudent.firstName}'s Progress`
                : "My Children"}
          </Text>
        </View>
        <Pressable style={pr.refreshBtn} onPress={refreshAll}>
          <RotateCw size={16} color="#7B4FCA" />
        </Pressable>
      </View>

      {loadingStudents ? (
        <View style={pr.centerBlock}>
          <ActivityIndicator accessibilityLabel="Loading" color={Colors.primary} size="large" />
        </View>
      ) : !activeStudent ? (
        <View style={pr.centerBlock}>
          <SvgXml xml={PENGUIN} width={96} height={96} />
          <Text style={pr.emptyTitle}>
            {isStudentMode ? "Profile not ready yet" : "No children linked yet"}
          </Text>
          <Text style={pr.emptySub}>
            {isStudentMode
              ? "We could not load your profile. Please pull to refresh, or sign out and sign back in."
              : "Ask your school admin to link your children to your account."}
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* ── PINNED HEADER: child switcher (parent only) + tab bar ── */}
          <View style={{ flexShrink: 0 }}>
            {!isStudentMode && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={pr.switcherBar}
                contentContainerStyle={{
                  gap: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                }}
              >
                {linkedStudents.map((child, idx) => {
                  const isActive = child.id === activeStudent?.id;
                  const cc = CHILD_COLORS_PR[idx % CHILD_COLORS_PR.length];
                  return (
                    <Pressable
                      key={child.id}
                      onPress={() => {
                        switchToStudent(child.id);
                        setActiveTab("overview");
                      }}
                      style={[
                        pr.childChip,
                        isActive
                          ? { backgroundColor: cc }
                          : {
                              backgroundColor: "#fff",
                              borderWidth: 1.5,
                              borderColor: cc,
                            },
                      ]}
                    >
                      <View
                        style={[
                          pr.childChipAvatar,
                          {
                            backgroundColor: isActive
                              ? "rgba(255,255,255,0.2)"
                              : cc + "22",
                          },
                        ]}
                      >
                        <User size={14} color={isActive ? "#fff" : cc} />
                      </View>
                      <View>
                        <Text
                          style={[
                            pr.childChipName,
                            { color: isActive ? "#fff" : Colors.text },
                          ]}
                        >
                          {child.firstName}
                        </Text>
                        <Text
                          style={[
                            pr.childChipSub,
                            {
                              color: isActive
                                ? "rgba(255,255,255,0.7)"
                                : Colors.textMuted,
                            },
                          ]}
                        >
                          {child.classLevel
                            ? `Class ${child.classLevel}`
                            : "No class"}
                        </Text>
                      </View>
                      {isActive && <View style={pr.activeChipDot} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* ── TAB BAR ── */}
            <View style={pr.tabBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={pr.tabBarContent}
              >
                {PARENT_TABS.map((tab) => {
                  const isCurrent = activeTab === tab.key;
                  const dotCount =
                    tab.key === "quizzes"
                      ? recentQuizCount
                      : tab.key === "assignments"
                        ? newPendingCount
                        : tab.key === "classroom"
                          ? newEndedCount
                          : 0;
                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => {
                        if (
                          tab.key === "quizzes" &&
                          prevTab.current !== "quizzes"
                        ) {
                          refreshQuizAttempts();
                        }
                        prevTab.current = tab.key;
                        setActiveTab(tab.key);
                        markTabSeen(tab.key);
                      }}
                      style={[pr.tabBtn, isCurrent && pr.tabBtnActive]}
                    >
                      <View style={pr.tabBtnIconWrap}>
                        <tab.Icon
                          size={16}
                          color={isCurrent ? Colors.primary : Colors.textMuted}
                        />
                        {dotCount > 0 && <View style={pr.tabDot} />}
                      </View>
                      <Text
                        style={[
                          pr.tabBtnText,
                          isCurrent && pr.tabBtnTextActive,
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
          {/* end pinned header */}

          {/* ── TAB CONTENT ── */}
          <ScrollView
            key={`${activeTab}-${activeStudent.id}`}
            style={{ flex: 1 }}
            contentContainerStyle={pr.scroll}
            showsVerticalScrollIndicator={false}
            // Lets keyboard-only users (no trackpad/touch) focus and arrow-key-scroll
            // this region — axe's `scrollable-region-focusable` rule (web only).
            {...(Platform.OS === "web" ? { tabIndex: 0 } : {})}
          >
            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <>
                <View style={pr.heroBanner}>
                  <View style={pr.heroLeft}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <BarChart2 size={11} color="rgba(255,255,255,0.65)" />
                      <Text style={pr.heroSup}>Overall Progress</Text>
                    </View>
                    <Text style={pr.heroScore}>
                      {sum ? sum.completionRate.toFixed(0) : 0}%
                    </Text>
                    <Text style={pr.heroLabel}>completion rate</Text>
                    <View style={pr.heroTrack}>
                      <View
                        style={[
                          pr.heroFill,
                          {
                            width: `${Math.min(100, sum?.completionRate ?? 0)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={pr.heroMeta}>
                      Class {activeStudent.classLevel ?? "—"} ·{" "}
                      {activeStudent.firstName}
                    </Text>
                  </View>
                  <View style={pr.heroRight}>
                    <View style={pr.streakBadge}>
                      <Text style={pr.streakNum}>{sum?.streakDays ?? 0}</Text>
                      <Zap size={18} color="#F5C842" fill="#F5C842" />
                      <Text style={pr.streakLabel}>day streak</Text>
                    </View>
                  </View>
                </View>

                {sum && (
                  <View style={pr.statRow}>
                    {(
                      [
                        {
                          Icon: Layers,
                          val: sum.attemptedCount,
                          label: "Attempted",
                          color: Colors.primary,
                          bg: "#D6EAFF",
                        },
                        {
                          Icon: CheckCircle,
                          val: sum.completedCount,
                          label: "Completed",
                          color: Colors.success, // darkened from #4CAF50 (2.37:1) — WCAG AA text-on-tint fix
                          bg: "#D6F5D6",
                        },
                        {
                          Icon: SkipForward,
                          val: sum.notAttemptedCount,
                          label: "Skipped",
                          color: "#B03A19", // darkened from #D33F13 (3.96:1) — WCAG AA text-on-tint fix
                          bg: "#FFE8D6",
                        },
                        {
                          Icon: Clock,
                          val: fmtSec(sum.totalTimeSeconds),
                          label: "Time",
                          color: "#554E6C", // darkened from #9B8EC4 — WCAG AA text-on-tint fix
                          bg: Colors.purpleLight,
                        },
                      ] as Array<{
                        Icon: IconComp;
                        val: string | number;
                        label: string;
                        color: string;
                        bg: string;
                      }>
                    ).map((st) => (
                      <View
                        key={st.label}
                        style={[pr.statCard, { backgroundColor: st.bg }]}
                      >
                        <st.Icon size={18} color={st.color} />
                        <Text style={[pr.statVal, { color: st.color }]}>
                          {st.val}
                        </Text>
                        <Text style={pr.statLabel}>{st.label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={pr.sectionHdr}>
                  <Text style={pr.sectionHdrTitle}>Active Days This Week</Text>
                  <Text style={pr.sectionHdrChip}>
                    {activeDates.length}/7 active
                  </Text>
                </View>
                <View style={pr.card}>
                  <StreakCalendar
                    activeDates={activeDates}
                    streakDays={sum?.streakDays ?? 0}
                  />
                  <View style={pr.cardFooter}>
                    <Text style={pr.cardFooterText}>Consistency score</Text>
                    <Text style={[pr.cardFooterVal, { color: Colors.primary }]}>
                      {sum ? sum.consistencyScore.toFixed(0) : 0}%
                    </Text>
                  </View>
                </View>

                {/* Two comparable charts sit side by side on large screens
                    instead of stacking full-width, one under the other. */}
                <View
                  style={[
                    pr.chartsGridRow,
                    {
                      flexDirection: isLargeScreen ? "row" : "column",
                      gap: isLargeScreen ? 16 : 0,
                    },
                  ]}
                >
                  <View style={pr.chartsGridCol}>
                    <View style={[pr.sectionHdr, isLargeScreen && { paddingHorizontal: 0 }]}>
                      <Text style={pr.sectionHdrTitle}>Time Spent per Day</Text>
                      <Text style={pr.sectionHdrChip}>
                        {fmtSec(sum?.totalTimeSeconds ?? 0)} total
                      </Text>
                    </View>
                    <View style={[pr.card, isLargeScreen && { marginHorizontal: 0 }]}>
                      <ProperBarChart
                        data={timeChartData}
                        color={Colors.primary}
                        unit="m"
                        yTicks={4}
                        height={110}
                      />
                      <Text style={pr.chartNote}>
                        Minutes of learning per day (last 7 days)
                      </Text>
                    </View>
                  </View>

                  <View style={pr.chartsGridCol}>
                    <View style={[pr.sectionHdr, isLargeScreen && { paddingHorizontal: 0 }]}>
                      <Text style={pr.sectionHdrTitle}>Daily Completion Rate</Text>
                      <Text style={pr.sectionHdrChip}>
                        avg {sum ? sum.completionRate.toFixed(0) : 0}%
                      </Text>
                    </View>
                    <View style={[pr.card, isLargeScreen && { marginHorizontal: 0 }]}>
                      <ProperBarChart
                        data={completionChartData}
                        color="#7DC67A"
                        unit="%"
                        yTicks={4}
                        height={110}
                      />
                      <Text style={pr.chartNote}>
                        Percentage of activities completed each day
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* GROWTH TRENDS */}
            {activeTab === "trends" && activeStudent && (
              <TrendAnalysisTab
                studentId={activeStudent.id}
                studentName={activeStudent.firstName}
              />
            )}

            {/* QUIZZES */}
            {activeTab === "quizzes" && (
              <>
                <View style={pr.sectionHdr}>
                  <Text style={pr.sectionHdrTitle}>Quiz Results</Text>
                  <Text style={pr.sectionHdrChip}>
                    {quizAttempts.length} attempt
                    {quizAttempts.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                {loadingActivity ? (
                  <ActivityIndicator accessibilityLabel="Loading"
                    color={Colors.primary}
                    style={{ marginVertical: 24 }}
                  />
                ) : quizAttempts.length === 0 ? (
                  <View style={pr.emptyStateCard}>
                    <SvgXml xml={OWL} width={64} height={64} />
                    <Text style={pr.emptyStateTitle}>No Quiz Attempts Yet</Text>
                    <Text style={pr.emptyStateText}>
                      {isStudentMode
                        ? "You have not attempted any quiz yet. Open a classroom and try one!"
                        : `Encourage ${activeStudent.firstName} to try a quiz!`}
                    </Text>
                  </View>
                ) : (
                  <>
                    {quizAttempts.map((attempt) => {
                      const grade = scoreGrade(attempt.scorePct);
                      const attended = getDateTimeParts(attempt.attemptedAt);
                      return (
                        <Pressable
                          key={attempt.id}
                          style={pr.quizCard}
                          onPress={() => openQuizDetail(attempt.id)}
                        >
                          <View
                            style={[
                              pr.quizIconBox,
                              { backgroundColor: Colors.purpleLight },
                            ]}
                          >
                            <Layers size={22} color="#9B8EC4" />
                          </View>
                          <View style={pr.quizInfo}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                flexWrap: "wrap",
                              }}
                            >
                              <Text style={pr.quizTitle} numberOfLines={1}>
                                {attempt.quizTitle}
                              </Text>
                              <QuizKindBadge kind={attempt.kind} />
                            </View>
                            <Text style={pr.quizMeta}>
                              {attempt.correctCount}/{attempt.totalQuestions}{" "}
                              correct
                            </Text>
                            <View style={pr.inlineMetaRow}>
                              <Calendar size={11} color={Colors.textMuted} />
                              <Text style={pr.inlineMetaText}>
                                {attended.date} · {attended.time}
                              </Text>
                            </View>
                            <View style={pr.quizProgressTrack}>
                              <View
                                style={[
                                  pr.quizProgressFill,
                                  {
                                    width: `${attempt.scorePct}%`,
                                    backgroundColor: grade.color,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                          <View
                            style={[
                              pr.scoreBadge,
                              { backgroundColor: grade.bg },
                            ]}
                          >
                            <Text style={[pr.scoreNum, { color: grade.color }]}>
                              {attempt.scorePct}%
                            </Text>
                            <Text
                              style={[pr.scoreLabel, { color: grade.color }]}
                            >
                              {grade.label}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </>
                )}
              </>
            )}

            {/* ASSIGNMENTS */}
            {activeTab === "assignments" && (
              <>
                {pendingAssignments.length > 0 && (
                  <>
                    <View style={pr.sectionHdr}>
                      <Text style={pr.sectionHdrTitle}>Pending</Text>
                      <View style={pr.urgentBadge}>
                        <Text style={pr.urgentBadgeText}>
                          {pendingAssignments.length} due
                        </Text>
                      </View>
                    </View>
                    {pendingAssignments.map((a) => (
                      <View
                        key={a.id}
                        style={[
                          pr.assignCard,
                          { borderLeftWidth: 3, borderLeftColor: Colors.accent },
                        ]}
                      >
                        <View
                          style={[
                            pr.assignIconBox,
                            { backgroundColor: "#FFE8D6" },
                          ]}
                        >
                          <ClipboardList size={20} color={Colors.accent} />
                        </View>
                        <View style={pr.assignInfo}>
                          <Text style={pr.assignTitle} numberOfLines={1}>
                            {a.title || "Untitled Assignment"}
                          </Text>
                          <Text style={pr.assignMeta}>Not submitted yet</Text>
                        </View>
                        <View
                          style={[
                            pr.statusChip,
                            { backgroundColor: "#FFE8D6" },
                          ]}
                        >
                          <Text
                            style={[pr.statusChipText, { color: "#B03A19" }]} // darkened from #D33F13 (3.96:1 on chip bg)
                          >
                            Pending
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {submittedAssignments.length > 0 && (
                  <>
                    <View
                      style={[
                        pr.sectionHdr,
                        { marginTop: pendingAssignments.length > 0 ? 8 : 0 },
                      ]}
                    >
                      <Text style={pr.sectionHdrTitle}>Submitted</Text>
                      <Text style={pr.sectionHdrChip}>
                        {submittedAssignments.length} done
                      </Text>
                    </View>
                    {submittedAssignments.map((a) => {
                      const grade =
                        a.grade !== undefined ? scoreGrade(a.grade) : null;
                      const submitted = getDateTimeParts(a.submittedAt);
                      return (
                        <View key={a.id} style={pr.assignCard}>
                          <View
                            style={[
                              pr.assignIconBox,
                              { backgroundColor: "#D6F5D6" },
                            ]}
                          >
                            <CheckCircle size={20} color="#4CAF50" />
                          </View>
                          <View style={pr.assignInfo}>
                            <Text style={pr.assignTitle} numberOfLines={1}>
                              {a.title || "Untitled Assignment"}
                            </Text>
                            <View style={pr.inlineMetaRow}>
                              <Calendar size={11} color={Colors.textMuted} />
                              <Text style={pr.inlineMetaText}>
                                {submitted.date}
                              </Text>
                            </View>
                            {a.feedback && (
                              <Text style={pr.assignFeedback} numberOfLines={1}>
                                {a.feedback}
                              </Text>
                            )}
                          </View>
                          {grade && (
                            <View
                              style={[
                                pr.scoreBadge,
                                { backgroundColor: grade.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  pr.scoreNum,
                                  { color: grade.color, fontSize: 14 },
                                ]}
                              >
                                {a.grade}%
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}

                {assignments.length === 0 && (
                  <View style={pr.emptyStateCard}>
                    <SvgXml xml={ELEPHANT} width={64} height={64} />
                    <Text style={pr.emptyStateTitle}>No Assignments Found</Text>
                    <Text style={pr.emptyStateText}>
                      {isStudentMode
                        ? "You have no assignments yet. Your teacher will share them here."
                        : `No assignments found for ${activeStudent.firstName}.`}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* CLASSROOM */}
            {activeTab === "classroom" && (
              <>
                <View style={pr.sectionHdr}>
                  <Text style={pr.sectionHdrTitle}>Active Classes</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text style={pr.sectionHdrChip}>
                      {classroomCards.length} active
                    </Text>
                    {completedClassrooms.length > 0 && (
                      <Pressable
                        style={pr.historyIconBtn}
                        onPress={openHistoryModal}
                        hitSlop={10}
                      >
                        <History size={16} color={Colors.primary} />
                        {newEndedCount > 0 && (
                          <View style={pr.historyIconDot} />
                        )}
                      </Pressable>
                    )}
                  </View>
                </View>
                {classroomCards.length === 0 ? (
                  <View style={pr.emptyStateCard}>
                    <SvgXml xml={GIRAFFE} width={64} height={64} />
                    <Text style={pr.emptyStateTitle}>No Active Classrooms</Text>
                    <Text style={pr.emptyStateText}>
                      No classroom updates yet.
                    </Text>
                  </View>
                ) : (
                  classroomCards.map((cls, idx) => {
                    const cc = CHILD_COLORS_PR[idx % CHILD_COLORS_PR.length];
                    const avg = getClassroomAvgScore(cls);
                    const grade = scoreGrade(avg);
                    return (
                      <Pressable
                        key={cls.id}
                        style={pr.classCard}
                        onPress={() => setClassroomDetail(cls)}
                      >
                        <View
                          style={[
                            pr.classIconBox,
                            { backgroundColor: cc + "22" },
                          ]}
                        >
                          <Text style={{ fontSize: 22 }}>📚</Text>
                        </View>
                        <View style={pr.classInfo}>
                          <Text style={pr.classTitle} numberOfLines={1}>
                            {cls.title}
                          </Text>
                          <Text style={pr.classMeta}>
                            Class {cls.classLevel} · {cls.status}
                          </Text>
                          <Text style={pr.classDesc} numberOfLines={1}>
                            {cls.remarkText
                              ? `Teacher: ${cls.remarkText}`
                              : "Tap to see insights and teacher notes"}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 6 }}>
                          <View
                            style={[
                              pr.classStatusBadge,
                              {
                                backgroundColor:
                                  cls.status === "active"
                                    ? "#D6F5D6"
                                    : Colors.borderLight,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                pr.classStatusText,
                                {
                                  color:
                                    cls.status === "active"
                                      ? Colors.success // darkened from #4CAF50 (2.37:1 on tint bg)
                                      : Colors.textMuted,
                                },
                              ]}
                            >
                              {cls.status === "active" ? "Active" : cls.status}
                            </Text>
                          </View>
                          {avg > 0 && (
                            <View
                              style={[
                                pr.smallGradeBadge,
                                { backgroundColor: grade.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  pr.smallGradeText,
                                  { color: grade.color },
                                ]}
                              >
                                {avg}%
                              </Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </>
            )}

            {/* ACTIVITY */}
            {activeTab === "activity" && (
              <>
                <View style={pr.sectionHdr}>
                  <Text style={pr.sectionHdrTitle}>Recent Activity</Text>
                  <Text style={pr.sectionHdrChip}>{activity.length} total</Text>
                </View>
                {loadingActivity ? (
                  <ActivityIndicator accessibilityLabel="Loading"
                    color={Colors.primary}
                    style={{ marginVertical: 24 }}
                  />
                ) : activity.length === 0 ? (
                  <View style={pr.emptyStateCard}>
                    <SvgXml xml={BUTTERFLY} width={64} height={64} />
                    <Text style={pr.emptyStateTitle}>No Activity Yet</Text>
                    <Text style={pr.emptyStateText}>
                      {isStudentMode
                        ? "Start a quiz, story, or content - your activity will show up here."
                        : `No activity recorded for ${activeStudent.firstName}.`}
                    </Text>
                  </View>
                ) : (
                  activity.map((item) => {
                    const dotColor = STATUS_CLR[item.status] ?? Colors.textMuted;
                    return (
                      <View key={item.id} style={pr.actCard}>
                        <View
                          style={[
                            pr.actIconBox,
                            { backgroundColor: dotColor + "22" },
                          ]}
                        >
                          <ActIcon
                            type={item.activityType}
                            size={18}
                            color={dotColor}
                          />
                        </View>
                        <View style={pr.actInfo}>
                          <Text style={pr.actTitle} numberOfLines={1}>
                            {item.referenceTitle ?? item.activityType}
                          </Text>
                          <Text style={pr.actMeta}>
                            {item.activityDate}
                            {item.score !== undefined
                              ? ` · Score: ${item.score}%`
                              : ""}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <View
                            style={[
                              pr.statusChip,
                              { backgroundColor: dotColor + "22" },
                            ]}
                          >
                            <Text
                              style={[
                                pr.statusChipText,
                                { color: STATUS_TEXT_CLR[item.status] ?? dotColor },
                              ]}
                            >
                              {item.status}
                            </Text>
                          </View>
                          {item.timeSpentSeconds > 0 && (
                            <Text style={pr.actTime}>
                              {fmtSec(item.timeSpentSeconds)}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            )}

            {/* FEEDBACK */}
            {activeTab === "feedback" && activeStudent && (
              <ParentFeedbackTab
                studentId={activeStudent.id}
                studentName={activeStudent.firstName}
                classLevel={activeStudent.classLevel || ''}
              />
            )}

            {/* COUNSELING */}
            {activeTab === "counseling" && activeStudent && (
              <CounselingTab
                studentId={activeStudent.id}
                studentName={activeStudent.firstName}
              />
            )}
          </ScrollView>
        </View>
      )}

      {/* ── VIEW ALL QUIZZES MODAL ── */}
      <Modal
        visible={showAllQuizzes}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAllQuizzes(false)}
      >
        <View style={pr.modalOverlay}>
          <View style={[pr.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={pr.modalHeader}>
              <View>
                <Text style={pr.modalTitle}>All Quiz Attempts</Text>
                <Text style={pr.modalSub}>
                  {activeStudent?.firstName} · {quizAttempts.length} total
                </Text>
              </View>
              <Pressable
                style={pr.modalClose}
                onPress={() => setShowAllQuizzes(false)}
              >
                <X size={18} color={Colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={{ paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              {quizAttempts.map((attempt, idx) => {
                const grade = scoreGrade(attempt.scorePct);
                const attended = getDateTimeParts(attempt.attemptedAt);
                return (
                  <Pressable
                    key={attempt.id}
                    style={pr.modalQuizRow}
                    onPress={() => openQuizDetail(attempt.id)}
                  >
                    <View style={pr.modalQuizNum}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: Colors.textMuted,
                        }}
                      >
                        #{idx + 1}
                      </Text>
                    </View>
                    <View style={pr.quizInfo}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Text style={pr.quizTitle} numberOfLines={1}>
                          {attempt.quizTitle}
                        </Text>
                        <QuizKindBadge kind={attempt.kind} />
                      </View>
                      <Text style={pr.quizMeta}>
                        {attempt.correctCount}/{attempt.totalQuestions} correct
                      </Text>
                      <View style={pr.metaInfoStack}>
                        <View style={pr.metaInfoRow}>
                          <Calendar size={12} color={Colors.textMuted} />
                          <Text style={pr.metaInfoLabel}>Date:</Text>
                          <Text style={pr.metaInfoValue}>{attended.date}</Text>
                        </View>
                        <View style={pr.metaInfoRow}>
                          <Clock size={12} color={Colors.textMuted} />
                          <Text style={pr.metaInfoLabel}>Time:</Text>
                          <Text style={pr.metaInfoValue}>{attended.time}</Text>
                        </View>
                      </View>
                    </View>
                    <View
                      style={[pr.scoreBadge, { backgroundColor: grade.bg }]}
                    >
                      <Text style={[pr.scoreNum, { color: grade.color }]}>
                        {attempt.scorePct}%
                      </Text>
                      <Text style={[pr.scoreLabel, { color: grade.color }]}>
                        {grade.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── VIEW ALL CLASSROOM HISTORY MODAL ── */}
      <Modal
        visible={showAllClassrooms}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAllClassrooms(false)}
      >
        <View style={pr.modalOverlay}>
          <View style={[pr.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={pr.modalHeader}>
              <View>
                <Text style={pr.modalTitle}>Classroom History</Text>
                <Text style={pr.modalSub}>
                  {activeStudent?.firstName} · {completedClassrooms.length}{" "}
                  ended classes
                </Text>
              </View>
              <Pressable
                style={pr.modalClose}
                onPress={() => setShowAllClassrooms(false)}
              >
                <X size={18} color={Colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={{ paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              {completedClassrooms.map((cls, idx) => (
                <Pressable
                  key={cls.id}
                  style={pr.modalQuizRow}
                  onPress={() => {
                    setShowAllClassrooms(false);
                    setClassroomDetail(cls);
                  }}
                >
                  <View style={pr.modalQuizNum}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: Colors.textMuted,
                      }}
                    >
                      #{idx + 1}
                    </Text>
                  </View>
                  <View style={pr.quizInfo}>
                    <Text style={pr.quizTitle} numberOfLines={1}>
                      {cls.title}
                    </Text>
                    <Text style={pr.quizMeta}>
                      Ended{" "}
                      {cls.endedAt
                        ? new Date(cls.endedAt).toLocaleDateString()
                        : "—"}{" "}
                      · Class {cls.classLevel}
                    </Text>
                  </View>
                  <View style={pr.classStatusBadge}>
                    <Text style={[pr.classStatusText, { color: Colors.primary }]}>
                      Details
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── CLASSROOM DETAIL MODAL ── */}
      <Modal
        visible={!!classroomDetail}
        animationType="slide"
        transparent
        onRequestClose={() => setClassroomDetail(null)}
      >
        <View style={pr.modalOverlay}>
          <View style={[pr.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {classroomDetail && (
              <>
                <View style={pr.modalHeader}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={pr.modalTitle} numberOfLines={2}>
                      {classroomDetail.title}
                    </Text>
                    <Text style={pr.modalSub}>
                      Class {classroomDetail.classLevel} ·{" "}
                      {classroomDetail.status}
                      {classroomDetail.endedAt
                        ? ` · ${new Date(classroomDetail.endedAt).toLocaleDateString()}`
                        : ""}
                    </Text>
                  </View>
                  <Pressable
                    style={pr.modalClose}
                    onPress={() => setClassroomDetail(null)}
                  >
                    <X size={18} color={Colors.textMuted} />
                  </Pressable>
                </View>
                <ScrollView
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingBottom: 32,
                    gap: 12,
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={pr.detailPanel}>
                    <Text style={pr.detailPanelTitle}>
                      Classroom performance
                    </Text>
                    <ProperBarChart
                      data={[
                        {
                          label: "Beh",
                          value: classroomDetail.scoreBehavior ?? 0,
                        },
                        {
                          label: "Conf",
                          value: classroomDetail.scoreConfidence ?? 0,
                        },
                        {
                          label: "Part",
                          value: classroomDetail.scoreParticipation ?? 0,
                        },
                        {
                          label: "Perf",
                          value: classroomDetail.scorePerformance ?? 0,
                        },
                      ]}
                      color={Colors.primary}
                      unit="%"
                      yTicks={4}
                      height={100}
                    />
                  </View>

                  <View style={pr.detailPanel}>
                    <Text style={pr.detailPanelTitle}>Teacher remarks</Text>
                    <Text style={pr.detailBodyText}>
                      {classroomDetail.remarkText ||
                        "No teacher remark added yet."}
                    </Text>
                    {classroomDetail.parentNote && (
                      <>
                        <Text style={[pr.detailPanelTitle, { marginTop: 10 }]}>
                          Note for parent
                        </Text>
                        <Text style={pr.detailBodyText}>
                          {classroomDetail.parentNote}
                        </Text>
                      </>
                    )}
                  </View>

                  <View style={pr.detailPanel}>
                    <Text style={pr.detailPanelTitle}>Achievements</Text>
                    {classroomDetail.achievements.length === 0 ? (
                      <Text style={pr.detailBodyText}>
                        No achievements recorded yet.
                      </Text>
                    ) : (
                      <View style={pr.achievementWrap}>
                        {classroomDetail.achievements.map((a) => (
                          <View
                            key={a.id}
                            style={[
                              pr.achievementChip,
                              { backgroundColor: `${a.color}22` },
                            ]}
                          >
                            <Text style={pr.achievementEmoji}>{a.emoji}</Text>
                            <Text
                              style={[pr.achievementText, { color: a.color }]}
                              numberOfLines={1}
                            >
                              {a.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {classroomDetail.remarkMediaUrl && (
                    <View style={pr.detailPanel}>
                      <Text style={pr.detailPanelTitle}>
                        Teacher shared media
                      </Text>
                      {/\.(png|jpe?g|gif|webp)$/i.test(
                        classroomDetail.remarkMediaUrl,
                      ) && (
                        <Image
                          source={{ uri: classroomDetail.remarkMediaUrl }}
                          style={pr.mediaPreview}
                          resizeMode="cover"
                        />
                      )}
                      <Pressable
                        style={pr.mediaBtn}
                        onPress={() =>
                          openClassroomMedia(classroomDetail.remarkMediaUrl)
                        }
                      >
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
      <Modal
        visible={!!quizDetail || loadingDetail}
        animationType="slide"
        transparent
        onRequestClose={() => setQuizDetail(null)}
      >
        <View style={pr.modalOverlay}>
          <View style={[pr.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {loadingDetail ? (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 60,
                }}
              >
                <ActivityIndicator accessibilityLabel="Loading" size="large" color={Colors.primary} />
                <Text
                  style={{ marginTop: 12, color: Colors.textMuted, fontWeight: "600" }}
                >
                  Loading questions…
                </Text>
              </View>
            ) : quizDetail ? (
              <>
                {(() => {
                  const attended = getDateTimeParts(
                    quizDetail.attempt.completedAt,
                  );
                  return (
                    <View style={pr.modalHeader}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={pr.modalTitle} numberOfLines={2}>
                          {quizDetail.attempt.quizTitle}
                        </Text>
                        <Text style={pr.modalSub}>
                          {quizDetail.attempt.correctCount}/
                          {quizDetail.attempt.totalQuestions} correct ·{" "}
                          {quizDetail.attempt.scorePct}%
                        </Text>
                        <View style={pr.modalMetaStack}>
                          <View style={pr.modalMetaRow}>
                            <Calendar size={12} color={Colors.textMuted} />
                            <Text style={pr.modalMetaLabel}>Date:</Text>
                            <Text style={pr.modalMetaValue}>
                              {attended.date}
                            </Text>
                          </View>
                          <View style={pr.modalMetaRow}>
                            <Clock size={12} color={Colors.textMuted} />
                            <Text style={pr.modalMetaLabel}>Time:</Text>
                            <Text style={pr.modalMetaValue}>
                              {attended.time}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Pressable
                        style={pr.modalClose}
                        onPress={() => setQuizDetail(null)}
                      >
                        <X size={18} color={Colors.textMuted} />
                      </Pressable>
                    </View>
                  );
                })()}
                <ScrollView
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingBottom: 32,
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  {quizDetail.questions.map((q, i) => {
                    const qType = q.questionType;
                    const isMemory = qType === "memory_match";
                    const isFill =
                      qType === "fill_blank" || qType === "fill_in_blank";
                    const isJigsaw =
                      qType === "jigsaw" || qType === "jigsaw_puzzle";
                    const options = (q.questionData.options ?? []) as Array<{
                      id: string;
                      label?: string;
                      is_correct?: boolean;
                    }>;
                    const selectedId = q.responseData.selected_id;
                    const selectedIds = Array.isArray(
                      q.responseData.selected_ids,
                    )
                      ? (q.responseData.selected_ids as string[])
                      : [];
                    const selectedAny = selectedId ?? selectedIds[0];
                    const bannerBg = isJigsaw
                      ? "#E0F2FE"
                      : q.isCorrect
                        ? "#E8F5E9"
                        : "#FFF3F0";
                    const bannerColor = isJigsaw
                      ? "#0C4A6E"
                      : q.isCorrect
                        ? "#1B5E20" // darkened from #2E7D32 to survive the 0.7 opacity below
                        : "#C62828";
                    const bannerLabel = isMemory
                      ? `${q.responseData.pairsMatched ?? 0}/${q.responseData.totalPairs ?? 0} pairs`
                      : isJigsaw
                        ? q.responseData.completed
                          ? "Completed"
                          : "Not finished"
                        : q.isCorrect
                          ? "✓ Correct"
                          : "✗ Wrong";

                    return (
                      <View key={q.questionId} style={pr.detailQuestionCard}>
                        {/* Banner */}
                        <View
                          style={[
                            pr.detailQuestionBanner,
                            { backgroundColor: bannerBg },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color: bannerColor,
                              // opacity: 0.7 removed — it dropped bannerColor
                              // below 4.5:1 on bannerBg for all 3 variants
                            }}
                          >
                            Question {i + 1}
                            {isMemory
                              ? "  ·  Memory Match"
                              : isFill
                                ? "  ·  Fill in the Blank"
                                : isJigsaw
                                  ? "  ·  Jigsaw Puzzle"
                                  : ""}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 5,
                              // darkened so white text below clears 4.5:1
                              // (raw #0EA5E9/#4CAF50/#FF5252 were 2.3-2.8:1)
                              backgroundColor: isJigsaw
                                ? q.responseData.completed
                                  ? "#0369A1"
                                  : "#C62828"
                                : q.isCorrect
                                  ? "#1B5E20"
                                  : "#C62828",
                              borderRadius: 999,
                              paddingHorizontal: 12,
                              paddingVertical: 5,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "900",
                                color: "#fff",
                              }}
                            >
                              {bannerLabel}
                            </Text>
                          </View>
                        </View>

                        <View style={pr.detailQuestionInner}>
                          <Text style={pr.detailQTitle}>
                            {q.questionTitle ??
                              q.questionInstruction ??
                              `Question ${i + 1}`}
                          </Text>

                          {/* ── MEMORY MATCH result board ── */}
                          {isMemory &&
                            (() => {
                              const rd = q.responseData;
                              const allPairs = (q.questionData.pairs ??
                                []) as Array<{
                                id: number;
                                label: string;
                                imageUrl?: string;
                              }>;
                              const matched = new Set(
                                (rd.correctMatches ?? []).map(
                                  (m: any) => m.pairId as number,
                                ),
                              );
                              const cols = allPairs.length <= 2 ? 2 : 3;
                              // chunk into rows
                              const boardRows: (typeof allPairs)[] = [];
                              for (let i = 0; i < allPairs.length; i += cols)
                                boardRows.push(allPairs.slice(i, i + cols));
                              return (
                                <View style={{ marginTop: 12, gap: 12 }}>
                                  {/* Stats chips */}
                                  <View style={gr.chipRow}>
                                    <View
                                      style={[
                                        gr.chip,
                                        { backgroundColor: "#E8F5E9" },
                                      ]}
                                    >
                                      <CheckCircle size={13} color="#4CAF50" />
                                      <Text
                                        style={[
                                          gr.chipTxt,
                                          { color: "#2E7D32" },
                                        ]}
                                      >
                                        {rd.pairsMatched ?? 0}/
                                        {rd.totalPairs ?? allPairs.length} pairs
                                      </Text>
                                    </View>
                                    {(rd.clickLimit ?? 0) > 0 && (
                                      <View
                                        style={[
                                          gr.chip,
                                          { backgroundColor: "#FFF5CC" },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            gr.chipTxt,
                                            { color: "#E6A020" },
                                          ]}
                                        >
                                          {rd.clicksUsed ?? 0}/{rd.clickLimit}{" "}
                                          clicks
                                        </Text>
                                      </View>
                                    )}
                                    <View
                                      style={[
                                        gr.chip,
                                        { backgroundColor: Colors.purpleLight },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          gr.chipTxt,
                                          { color: "#7B4FCA" },
                                        ]}
                                      >
                                        {rd.accuracy ?? 0}% acc
                                      </Text>
                                    </View>
                                    {(rd.wrongAttempts ?? 0) > 0 && (
                                      <View
                                        style={[
                                          gr.chip,
                                          { backgroundColor: "#FFF3F0" },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            gr.chipTxt,
                                            { color: "#C62828" },
                                          ]}
                                        >
                                          {rd.wrongAttempts} wrong
                                        </Text>
                                      </View>
                                    )}
                                  </View>

                                  {/* Accuracy progress bar */}
                                  {(() => {
                                    const acc = rd.accuracy ?? 0;
                                    // vivid fill color for the progress bar track
                                    const barColor =
                                      acc >= 80
                                        ? "#4CAF50"
                                        : acc >= 50
                                          ? "#E6A020"
                                          : "#FF5252";
                                    // darker variants for the "{acc}%" text on white (raw barColor was 2.2-3.2:1)
                                    const barTextColor =
                                      acc >= 80
                                        ? "#1B5E20"
                                        : acc >= 50
                                          ? RoleColors.superadmin
                                          : "#C62828";
                                    return (
                                      <View style={{ gap: 4 }}>
                                        <View
                                          style={{
                                            flexDirection: "row",
                                            justifyContent: "space-between",
                                          }}
                                        >
                                          <Text
                                            style={{
                                              fontSize: 11,
                                              fontWeight: "700",
                                              color: Colors.textMuted,
                                              textTransform: "uppercase",
                                            }}
                                          >
                                            Accuracy
                                          </Text>
                                          <Text
                                            style={{
                                              fontSize: 11,
                                              fontWeight: "800",
                                              color: barTextColor,
                                            }}
                                          >
                                            {acc}%
                                          </Text>
                                        </View>
                                        <View
                                          style={{
                                            height: 8,
                                            backgroundColor: "#F0F0F5",
                                            borderRadius: 4,
                                            overflow: "hidden",
                                          }}
                                        >
                                          <View
                                            style={{
                                              height: 8,
                                              width: `${acc}%` as any,
                                              backgroundColor: barColor,
                                              borderRadius: 4,
                                            }}
                                          />
                                        </View>
                                      </View>
                                    );
                                  })()}

                                  {/* Board grid — flex rows, each card flex:1 to fill width */}
                                  <Text style={gr.boardLabel}>
                                    Board Result
                                  </Text>
                                  <View style={{ gap: 8 }}>
                                    {boardRows.map((row, rIdx) => (
                                      <View
                                        key={rIdx}
                                        style={{ flexDirection: "row", gap: 8 }}
                                      >
                                        {row.map((pair) => {
                                          const isOk = matched.has(pair.id);
                                          const imgUrl = pair.imageUrl
                                            ? `${API_BASE_URL}${pair.imageUrl}`
                                            : undefined;
                                          return (
                                            <View
                                              key={pair.id}
                                              style={[
                                                gr.boardCard,
                                                {
                                                  flex: 1,
                                                  backgroundColor: isOk
                                                    ? "#E8F5E9"
                                                    : "#FFF3F0",
                                                  borderColor: isOk
                                                    ? "#4CAF50"
                                                    : Colors.accent,
                                                },
                                              ]}
                                            >
                                              {imgUrl ? (
                                                <Image
                                                  source={{ uri: imgUrl }}
                                                  style={gr.boardImg}
                                                  resizeMode="contain"
                                                />
                                              ) : (
                                                <Text style={{ fontSize: 24 }}>
                                                  ?
                                                </Text>
                                              )}
                                              <Text
                                                style={[
                                                  gr.boardCardLabel,
                                                  {
                                                    color: isOk
                                                      ? "#2E7D32"
                                                      : "#C62828",
                                                  },
                                                ]}
                                                numberOfLines={1}
                                              >
                                                {pair.label}
                                              </Text>
                                              <View
                                                style={[
                                                  gr.boardBadge,
                                                  {
                                                    // darkened so white boardBadgeText clears 4.5:1 (was 2.78/3.19:1)
                                                    backgroundColor: isOk
                                                      ? "#2E7D32"
                                                      : "#C62828",
                                                  },
                                                ]}
                                              >
                                                <Text style={gr.boardBadgeText}>
                                                  {isOk ? "✓" : "✗"}
                                                </Text>
                                              </View>
                                            </View>
                                          );
                                        })}
                                        {row.length < cols &&
                                          Array.from({
                                            length: cols - row.length,
                                          }).map((_, fi) => (
                                            <View
                                              key={`fill-${fi}`}
                                              style={{ flex: 1 }}
                                            />
                                          ))}
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              );
                            })()}

                          {/* ── FILL IN THE BLANK result ── */}
                          {isFill &&
                            (() => {
                              const sentence =
                                (q.questionData.sentence as string) ?? "";
                              const correct =
                                (q.questionData.answer as string) ??
                                q.responseData.answer ??
                                "";
                              const chosen = q.responseData.selected ?? "—";
                              const isOk =
                                (chosen as string).toLowerCase() ===
                                (correct as string).toLowerCase();
                              const parts = sentence.split("___");
                              return (
                                <View style={{ marginTop: 12, gap: 10 }}>
                                  {/* Sentence with filled blank */}
                                  <View
                                    style={[
                                      gr.sentenceBox,
                                      {
                                        borderColor: isOk
                                          ? "#4CAF50"
                                          : Colors.accent,
                                      },
                                    ]}
                                  >
                                    <Text style={gr.sentenceText}>
                                      <Text>{parts[0]}</Text>
                                      <Text
                                        style={[
                                          gr.blankFilled,
                                          {
                                            color: isOk ? "#2E7D32" : "#C62828",
                                            backgroundColor: isOk
                                              ? "#E8F5E9"
                                              : "#FFF3F0",
                                          },
                                        ]}
                                      >
                                        {" "}
                                        {chosen}{" "}
                                      </Text>
                                      <Text>{parts[1] ?? ""}</Text>
                                    </Text>
                                  </View>
                                  {!isOk && (
                                    <View
                                      style={[
                                        gr.sentenceBox,
                                        {
                                          borderColor: "#4CAF50",
                                          backgroundColor: "#F0FFF4",
                                        },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          gr.sentenceText,
                                          { color: Colors.textMuted, fontSize: 11 },
                                        ]}
                                      >
                                        Correct answer:
                                      </Text>
                                      <Text
                                        style={[
                                          gr.sentenceText,
                                          {
                                            color: "#2E7D32",
                                            fontWeight: "800",
                                          },
                                        ]}
                                      >
                                        {parts[0]}
                                        <Text
                                          style={{
                                            backgroundColor: "#D6F5D6",
                                            color: "#2E7D32",
                                          }}
                                        >
                                          {" "}
                                          {correct}{" "}
                                        </Text>
                                        {parts[1] ?? ""}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              );
                            })()}

                          {/* ── JIGSAW PUZZLE result ── */}
                          {isJigsaw &&
                            (() => {
                              const rd = q.responseData;
                              const completed = Boolean(rd.completed);
                              const moves = Number(rd.moves ?? 0);
                              const clickLim =
                                rd.clickLimit != null
                                  ? Number(rd.clickLimit)
                                  : null;
                              const timeTaken = Number(rd.timeTaken ?? 0);
                              const gridSize =
                                (rd.gridSize as string) ||
                                (q.questionData as any).gridSize ||
                                "3x3";
                              const difficulty =
                                (rd.difficulty as string) ||
                                (q.questionData as any).difficulty ||
                                "medium";
                              const n = Number(gridSize.split("x")[0]) || 3;
                              const total = n * n;
                              const diffColor =
                                difficulty === "easy"
                                  ? "#15803D"
                                  : difficulty === "medium"
                                    ? "#A16207"
                                    : "#B91C1C";
                              const diffBg =
                                difficulty === "easy"
                                  ? "#DCFCE7"
                                  : difficulty === "medium"
                                    ? "#FEF9C3"
                                    : Colors.errorLight;
                              const barColor = completed
                                ? "#0EA5E9"
                                : "#FF5252";
                              // darker variants for the "Completed/Not finished" text on white
                              const barTextColor = completed
                                ? "#0369A1"
                                : "#C62828";
                              const rawImg =
                                (q.questionData as any).image ||
                                (q.questionData as any).prompt_image;
                              const imgUrl = rawImg
                                ? rawImg.startsWith("/media")
                                  ? `${API_BASE_URL}${rawImg}`
                                  : rawImg
                                : null;
                              const slotArr = Array.isArray(rd.slotArrangement)
                                ? (rd.slotArrangement as Array<number | null>)
                                : null;
                              const CELL = 58;
                              const GAP2 = 2;
                              return (
                                <View style={{ marginTop: 12, gap: 10 }}>
                                  <View style={gr.chipRow}>
                                    <View
                                      style={[
                                        gr.chip,
                                        { backgroundColor: "#E0F2FE" },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          gr.chipTxt,
                                          { color: "#0369A1" },
                                        ]}
                                      >
                                        🧩 {gridSize} · {total} pieces
                                      </Text>
                                    </View>
                                    <View
                                      style={[
                                        gr.chip,
                                        { backgroundColor: diffBg },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          gr.chipTxt,
                                          { color: diffColor },
                                        ]}
                                      >
                                        {difficulty}
                                      </Text>
                                    </View>
                                    <View
                                      style={[
                                        gr.chip,
                                        { backgroundColor: "#F1F5F9" },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          gr.chipTxt,
                                          { color: "#334155" },
                                        ]}
                                      >
                                        {moves}
                                        {clickLim ? `/${clickLim}` : ""} moves
                                      </Text>
                                    </View>
                                    {timeTaken > 0 && (
                                      <View
                                        style={[
                                          gr.chip,
                                          { backgroundColor: "#F1F5F9" },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            gr.chipTxt,
                                            { color: "#334155" },
                                          ]}
                                        >
                                          {timeTaken}s
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                  <View style={{ gap: 4 }}>
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        justifyContent: "space-between",
                                      }}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 11,
                                          fontWeight: "700",
                                          color: Colors.textMuted,
                                          textTransform: "uppercase",
                                        }}
                                      >
                                        Result
                                      </Text>
                                      <Text
                                        style={{
                                          fontSize: 11,
                                          fontWeight: "800",
                                          color: barTextColor,
                                        }}
                                      >
                                        {completed
                                          ? "✓ Completed"
                                          : "✗ Not finished"}
                                      </Text>
                                    </View>
                                    <View
                                      style={{
                                        height: 8,
                                        backgroundColor: "#F0F0F5",
                                        borderRadius: 4,
                                        overflow: "hidden",
                                      }}
                                    >
                                      <View
                                        style={{
                                          height: 8,
                                          width: completed
                                            ? ("100%" as any)
                                            : ("30%" as any),
                                          backgroundColor: barColor,
                                          borderRadius: 4,
                                        }}
                                      />
                                    </View>
                                  </View>
                                  {/* Final answer image grid */}
                                  {imgUrl && slotArr ? (
                                    <View style={{ gap: 6 }}>
                                      <Text style={gr.boardLabel}>
                                        Final Answer
                                      </Text>
                                      <View style={{ gap: GAP2 }}>
                                        {Array.from({ length: n }, (_, r) => (
                                          <View
                                            key={r}
                                            style={{
                                              flexDirection: "row",
                                              gap: GAP2,
                                            }}
                                          >
                                            {Array.from(
                                              { length: n },
                                              (_, c) => {
                                                const slot = r * n + c;
                                                const piece = slotArr[slot];
                                                const isEmpty =
                                                  piece === null ||
                                                  piece === undefined;
                                                const isCorr =
                                                  !isEmpty && piece === slot;
                                                return (
                                                  <View
                                                    key={c}
                                                    style={{
                                                      width: CELL,
                                                      height: CELL,
                                                      borderRadius: 5,
                                                      overflow: "hidden",
                                                      borderWidth: 2,
                                                      borderColor: isEmpty
                                                        ? "#CBD5E1"
                                                        : isCorr
                                                          ? "#4CAF50"
                                                          : Colors.accent,
                                                      backgroundColor: isEmpty
                                                        ? "#F0F4FF"
                                                        : undefined,
                                                      alignItems: "center",
                                                      justifyContent: "center",
                                                    }}
                                                  >
                                                    {!isEmpty ? (
                                                      <Image
                                                        source={{ uri: imgUrl }}
                                                        resizeMode="stretch"
                                                        style={{
                                                          width: CELL * n,
                                                          height: CELL * n,
                                                          position: "absolute",
                                                          left: -(
                                                            (piece! % n) *
                                                            CELL
                                                          ),
                                                          top: -(
                                                            Math.floor(
                                                              piece! / n,
                                                            ) * CELL
                                                          ),
                                                        }}
                                                      />
                                                    ) : (
                                                      <Text
                                                        style={{
                                                          fontSize: 10,
                                                          color: "#4E5D71",
                                                          fontWeight: "700",
                                                        }}
                                                      >
                                                        {slot + 1}
                                                      </Text>
                                                    )}
                                                    {!isEmpty && (
                                                      <View
                                                        style={{
                                                          position: "absolute",
                                                          bottom: 2,
                                                          right: 2,
                                                          width: 12,
                                                          height: 12,
                                                          borderRadius: 6,
                                                          // darkened so white ✓/✗ text below clears 4.5:1
                                                          backgroundColor:
                                                            isCorr
                                                              ? "#1B5E20"
                                                              : "#C62828",
                                                          alignItems: "center",
                                                          justifyContent:
                                                            "center",
                                                        }}
                                                      >
                                                        <Text
                                                          style={{
                                                            fontSize: 7,
                                                            color: "#fff",
                                                            fontWeight: "900",
                                                          }}
                                                        >
                                                          {isCorr ? "✓" : "✗"}
                                                        </Text>
                                                      </View>
                                                    )}
                                                  </View>
                                                );
                                              },
                                            )}
                                          </View>
                                        ))}
                                      </View>
                                    </View>
                                  ) : imgUrl && completed ? (
                                    <View style={{ gap: 6 }}>
                                      <Text style={gr.boardLabel}>
                                        Final Answer
                                      </Text>
                                      <Image
                                        source={{ uri: imgUrl }}
                                        style={{
                                          width: "100%",
                                          height: 160,
                                          borderRadius: 10,
                                        }}
                                        resizeMode="contain"
                                      />
                                    </View>
                                  ) : null}
                                </View>
                              );
                            })()}

                          {/* ── STANDARD options (choice-based) ── */}
                          {!isMemory &&
                            !isFill &&
                            !isJigsaw &&
                            options.length > 0 && (
                              <View style={{ gap: 8, marginTop: 12 }}>
                                {options.map((o) => {
                                  const isSelected =
                                    o.id === selectedAny ||
                                    selectedIds.includes(o.id);
                                  const isCor = o.is_correct === true;
                                  let optBg = "#F8F9FC",
                                    optBorder = "#EAECF0",
                                    optTextColor = "#374151";
                                  let iconEl: string | null = null;
                                  if (isCor && isSelected) {
                                    optBg = "#E8F5E9";
                                    optBorder = "#4CAF50";
                                    optTextColor = "#1B5E20";
                                    iconEl = "✓";
                                  } else if (isCor) {
                                    optBg = "#E8F5E9";
                                    optBorder = "#4CAF50";
                                    optTextColor = "#1B5E20";
                                    iconEl = "✓";
                                  } else if (isSelected) {
                                    optBg = "#FFF3F0";
                                    optBorder = "#FF5252";
                                    optTextColor = "#B71C1C";
                                    iconEl = "✗";
                                  }
                                  return (
                                    <View
                                      key={o.id}
                                      style={[
                                        pr.detailOption,
                                        {
                                          backgroundColor: optBg,
                                          borderColor: optBorder,
                                        },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          pr.detailOptionText,
                                          { color: optTextColor },
                                        ]}
                                      >
                                        {o.label ?? o.id}
                                      </Text>
                                      {iconEl && (
                                        <View
                                          style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: 12,
                                            // darkened so white ✓/✗ text below clears 4.5:1
                                            backgroundColor: isCor
                                              ? "#1B5E20"
                                              : "#B71C1C",
                                            alignItems: "center",
                                            justifyContent: "center",
                                          }}
                                        >
                                          <Text
                                            style={{
                                              fontSize: 13,
                                              color: "#fff",
                                              fontWeight: "900",
                                            }}
                                          >
                                            {iconEl}
                                          </Text>
                                        </View>
                                      )}
                                    </View>
                                  );
                                })}
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
  const insets = useSafeAreaInsets();
  // Laptop/monitor-sized viewports get a denser stat row and side-by-side
  // panels instead of one full-width block per row (see ParentReports above).
  const { width: teacherWindowWidth } = useWindowDimensions();
  const isLargeScreen = teacherWindowWidth >= 1024;
  const {
    linkedStudents,
    activeStudent,
    loadingStudents,
    loadingActivity,
    loadingAnalytics,
    activity: studentActivity,
    analytics: studentAnalytics,
    switchToStudent,
  } = useStudentProfile();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [classActivity, setClassActivity] = useState<ClassActivityStudent[]>(
    [],
  );
  // Worst-first ordering + a shared risk classification (same thresholds as
  // the parent Growth Trends report and the Admin School Analytics tab, via
  // utils/riskForecast) so teachers see who most needs attention as soon as
  // the dashboard opens, not just whoever attempted a quiz most recently.
  const sortedClassActivity = useMemo(() => {
    const RISK_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    return classActivity
      .map((student) => {
        const totalAtt = student.attempts.length;
        const avgPct =
          totalAtt > 0
            ? Math.round(
                student.attempts.reduce((a, b) => a + b.scorePct, 0) /
                  totalAtt,
              )
            : 0;
        return { student, avgPct, risk: riskFromScore(avgPct) };
      })
      .sort((a, b) => {
        const rankDiff = RISK_RANK[a.risk] - RISK_RANK[b.risk];
        return rankDiff !== 0 ? rankDiff : a.avgPct - b.avgPct;
      });
  }, [classActivity]);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [teacherQuizDetail, setTeacherQuizDetail] =
    useState<QuizAttemptDetail | null>(null);
  const [loadingTeacherDetail, setLoadingTeacherDetail] = useState(false);
  const [seenStudentAttempts, setSeenStudentAttempts] = useState<Set<string>>(
    new Set(),
  );
  const [teacherSection, setTeacherSection] = useState<"dashboard" | "feedback">("feedback");

  // Load persisted seen attempts for this teacher on mount
  useEffect(() => {
    AsyncStorage.getItem("teacher_seen_attempts")
      .then((val) => {
        if (val) setSeenStudentAttempts(new Set(JSON.parse(val) as string[]));
      })
      .catch(() => {});
  }, []);

  const markAttemptSeen = async (attemptId: string) => {
    setSeenStudentAttempts((prev) => {
      const next = new Set(prev);
      next.add(attemptId);
      AsyncStorage.setItem(
        "teacher_seen_attempts",
        JSON.stringify([...next]),
      ).catch(() => {});
      return next;
    });
  };

  const openTeacherDetail = async (studentId: string, attemptId: string) => {
    setLoadingTeacherDetail(true);
    setTeacherQuizDetail(null);
    markAttemptSeen(attemptId);
    try {
      const res = await apiFetch(
        `/students/${studentId}/quiz-attempts/${attemptId}`,
      );
      if (res.ok) setTeacherQuizDetail(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoadingTeacherDetail(false);
    }
  };

  const role = user?.activeRole ?? "student";
  const isTeacherView =
    role === "teacher" || role === "admin" || role === "superadmin";
  const isParentView = role === "parent";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isTeacherView) {
        const [overviewRes, activityRes] = await Promise.all([
          apiFetch("/quizzes/teacher/overview"),
          apiFetch("/quizzes/teacher/class-activity?limit=200"),
        ]);
        if (!overviewRes.ok) throw new Error("Failed to load teacher reports");
        setOverview(await overviewRes.json());
        if (activityRes.ok) {
          const d = await activityRes.json();
          setClassActivity((d.students ?? []) as ClassActivityStudent[]);
        }
      }
      // Parent/student roles render <ParentReports> below, which fetches its
      // own data independently — nothing else to load here for them.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, isTeacherView]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator accessibilityLabel="Loading" size="large" color={Colors.primary} />
        <Text style={s.loadingText}>Loading report…</Text>
      </View>
    );
  }

  // ── PARENT / STUDENT VIEW (rich, real-data, tabbed) ──────────────────────
  if (isParentView) {
    return <ParentReports mode="parent" />;
  }
  if (role === "student") {
    return <ParentReports mode="student" />;
  }

  // ── TEACHER VIEW ───────────────────────────────────────────────────────────
  if (isTeacherView) {
    return (
      <>
        <ScrollView style={s.screen} contentContainerStyle={s.scroll}>
          <View
            style={[s.topBar, { paddingTop: Platform.OS === "ios" ? 2 : 8 }]}
          >
            <View>
              <Text style={s.greetingSub}>Teacher Dashboard</Text>
              <Text style={s.greetingName}>{user?.firstName ?? "Teacher"}</Text>
            </View>
            <View style={s.xpChip}>
              <TrendingUp size={13} color="#fff" />
              <Text style={s.xpLabel}>Reports</Text>
            </View>
          </View>

          {/* Teacher section switcher */}
          <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.background, borderRadius: 14, padding: 4 }}>
            <Pressable
              style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center', backgroundColor: teacherSection === 'dashboard' ? '#fff' : 'transparent' }}
              onPress={() => setTeacherSection('dashboard')}
            >
              <Text style={{ fontSize: 12, fontWeight: teacherSection === 'dashboard' ? '800' : '600', color: teacherSection === 'dashboard' ? Colors.primary : Colors.textMuted }}>Dashboard</Text>
            </Pressable>
            <Pressable
              style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center', backgroundColor: teacherSection === 'feedback' ? '#fff' : 'transparent' }}
              onPress={() => setTeacherSection('feedback')}
            >
              <Text style={{ fontSize: 12, fontWeight: teacherSection === 'feedback' ? '800' : '600', color: teacherSection === 'feedback' ? Colors.primary : Colors.textMuted }}>Feedback</Text>
            </Pressable>
          </View>

          {teacherSection === 'feedback' ? (
            <View style={{ paddingHorizontal: 16 }}>
              <TeacherFeedbackTab />
            </View>
          ) : (
          <>

          {error ? (
            <Text style={s.errorText}>{error}</Text>
          ) : (
            <>
              <View style={s.grid2}>
                {[
                  {
                    val: overview?.summary.total_quizzes ?? "0",
                    label: "Total Quizzes",
                    bg: "#D6EAFF",
                    color: Colors.primary,
                  },
                  {
                    val: overview?.summary.published_quizzes ?? "0",
                    label: "Published",
                    bg: "#D6F5D6",
                    // Darkened from #7DC67A (1.75:1 on this bg) to clear WCAG AA.
                    color: "#2F6B2D",
                  },
                  {
                    val: `${Number(overview?.summary.average_score_pct ?? 0).toFixed(0)}%`,
                    label: "Avg Score",
                    bg: "#FFF5CC",
                    // Darkened from #E6A817 (1.92:1 on this bg) to clear WCAG AA.
                    color: RoleColors.superadmin,
                  },
                  {
                    val: overview?.summary.total_attempts ?? "0",
                    label: "Attempts",
                    bg: "#FFE8D6",
                    color: Colors.accent,
                  },
                ].map((item) => (
                  <View
                    key={item.label}
                    style={[
                      s.statCard2,
                      isLargeScreen && { width: "23%" },
                      { backgroundColor: item.bg },
                    ]}
                  >
                    <Text style={[s.statVal2, { color: item.color }]}>
                      {item.val}
                    </Text>
                    <Text style={s.statLabel2}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {/* Class Performance and Topic Gaps sit side by side on large
                  screens instead of stacking full-width one under the other. */}
              <View
                style={{
                  flexDirection: isLargeScreen ? "row" : "column",
                  gap: isLargeScreen ? 16 : 0,
                  paddingHorizontal: isLargeScreen ? 16 : 0,
                }}
              >
              <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.secTitle, isLargeScreen && { paddingHorizontal: 0 }]}>Class Performance</Text>
              <View style={[s.card, isLargeScreen && { marginHorizontal: 0 }]}>
                {overview?.classPerformance?.length ? (
                  overview.classPerformance.map((cls) => {
                    const pct = Math.round(Number(cls.average_score_pct));
                    return (
                      <View key={cls.class_level} style={s.progressItem}>
                        <View style={s.pLabelRow}>
                          <Text style={s.pLabel}>
                            {getStandardLabel(cls.class_level)}
                          </Text>
                          <Text style={[s.pPct, { color: Colors.primary }]}>
                            {pct}%
                          </Text>
                        </View>
                        <View style={s.track}>
                          <View
                            style={[
                              s.fill,
                              {
                                width: `${Math.min(100, pct)}%`,
                                backgroundColor: Colors.primary,
                              },
                            ]}
                          />
                        </View>
                        <Text style={s.progressSub}>
                          {cls.attempts} attempts
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={s.emptyText}>No class data yet.</Text>
                )}
              </View>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.secTitle, isLargeScreen && { paddingHorizontal: 0 }]}>Topic Gaps</Text>
              <View style={[s.card, isLargeScreen && { marginHorizontal: 0 }]}>
                {overview?.topGaps?.length ? (
                  overview.topGaps.map((gap) => {
                    const pct = Number(gap.incorrect_pct);
                    return (
                      <View key={gap.question_id} style={s.gapRow}>
                        <Text style={s.gapLabel} numberOfLines={1}>
                          {gap.question_title}
                        </Text>
                        <View
                          style={[
                            s.pill,
                            {
                              backgroundColor:
                                pct >= 25 ? "#FFE8D6" : "#D6F5D6",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.pillText,
                              // Darkened variants of #D33F13/#7DC67A: at this small
                              // text size, both original colors fell short of 4.5:1
                              // against their #FFE8D6/#D6F5D6 pill backgrounds.
                              { color: pct >= 25 ? "#B03A19" : "#2F6B2D" },
                            ]}
                          >
                            {pct.toFixed(0)}% wrong
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={s.emptyText}>No topic gap data yet.</Text>
                )}
              </View>
              </View>
              </View>

              {/* ── Student Activity ──────────────────────────────────────── */}
              <Text style={s.secTitle}>Student Activity</Text>
              {classActivity.length === 0 ? (
                <View style={s.card}>
                  <Text style={s.emptyText}>No student attempts yet.</Text>
                </View>
              ) : (
                <View
                  style={{ gap: 10, marginHorizontal: 16, marginBottom: 8 }}
                >
                  {sortedClassActivity.map(({ student, avgPct, risk }) => {
                    const latest = student.attempts[0];
                    const totalAtt = student.attempts.length;
                    const isNew =
                      latest &&
                      !seenStudentAttempts.has(latest.attemptId) &&
                      Date.now() - new Date(latest.completedAt).getTime() <
                        24 * 60 * 60 * 1000;
                    const isExpanded = expandedStudent === student.studentId;
                    return (
                      <View key={student.studentId} style={gr.studentCard}>
                        <Pressable
                          onPress={() => {
                            setExpandedStudent(
                              isExpanded ? null : student.studentId,
                            );
                            if (!isExpanded && latest)
                              markAttemptSeen(latest.attemptId);
                          }}
                        >
                          <View style={gr.studentRow}>
                            <View style={gr.studentAvatar}>
                              <Text
                                style={{
                                  fontSize: 16,
                                  fontWeight: "900",
                                  color: "#7B4FCA",
                                }}
                              >
                                {student.firstName[0]}
                                {student.lastName[0]}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <Text style={gr.studentName}>
                                  {student.firstName} {student.lastName}
                                </Text>
                                {isNew && (
                                  <View style={gr.newBadge}>
                                    <Text style={gr.newBadgeText}>New</Text>
                                  </View>
                                )}
                                {/* Risk badge: same Low/Medium/High classification
                                    (utils/riskForecast) used on the parent Growth
                                    Trends report and Admin School Analytics, so
                                    the label means the same thing everywhere. */}
                                <View
                                  style={[
                                    gr.riskBadge,
                                    { backgroundColor: RISK_CLR[risk].bg },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      gr.riskBadgeText,
                                      { color: RISK_CLR[risk].fg },
                                    ]}
                                  >
                                    {risk}
                                  </Text>
                                </View>
                              </View>
                              <Text style={gr.studentMeta}>
                                {getStandardLabel(student.classLevel ?? "")} ·{" "}
                                {totalAtt} attempt{totalAtt !== 1 ? "s" : ""} ·
                                avg {avgPct}%
                              </Text>
                            </View>
                            <View
                              style={[
                                gr.pctBadge,
                                { backgroundColor: RISK_CLR[risk].bg },
                              ]}
                            >
                              <Text
                                style={[
                                  gr.pctText,
                                  { color: RISK_CLR[risk].fg },
                                ]}
                              >
                                {avgPct}%
                              </Text>
                            </View>
                          </View>
                          {/* Latest attempt preview */}
                          {latest && (
                            <View style={gr.attemptRow}>
                              <Text style={gr.attemptTitle} numberOfLines={1}>
                                {latest.quizTitle}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: Colors.textMuted,
                                  fontWeight: "600",
                                }}
                              >
                                {latest.correctCount}/{latest.totalQuestions} ·{" "}
                                {latest.scorePct}%
                              </Text>
                            </View>
                          )}
                          {/* Game metrics chip row */}
                          {latest?.gameMetrics && (
                            <View style={gr.gameTag}>
                              <View style={gr.gameTagItem}>
                                <Text style={gr.gameTagText}>Memory Match</Text>
                              </View>
                              <View
                                style={[
                                  gr.gameTagItem,
                                  { backgroundColor: "#D6F5D6" },
                                ]}
                              >
                                <Text
                                  style={[gr.gameTagText, { color: "#2E7D32" }]}
                                >
                                  {latest.gameMetrics.pairsMatched}/
                                  {latest.gameMetrics.totalPairs} pairs
                                </Text>
                              </View>
                              {latest.gameMetrics.clickLimit > 0 && (
                                <View
                                  style={[
                                    gr.gameTagItem,
                                    { backgroundColor: "#FFF5CC" },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      gr.gameTagText,
                                      { color: "#E6A020" },
                                    ]}
                                  >
                                    {latest.gameMetrics.clicksUsed}/
                                    {latest.gameMetrics.clickLimit} clicks
                                  </Text>
                                </View>
                              )}
                              <View
                                style={[
                                  gr.gameTagItem,
                                  { backgroundColor: Colors.purpleLight },
                                ]}
                              >
                                <Text style={gr.gameTagText}>
                                  {latest.gameMetrics.accuracy}% acc
                                </Text>
                              </View>
                            </View>
                          )}
                        </Pressable>
                        {/* Expanded: show all attempts — tap to see detail */}
                        {isExpanded &&
                          student.attempts.slice(0, 8).map((att) => (
                            <Pressable
                              key={att.attemptId}
                              style={[gr.attemptRow, { paddingLeft: 8 }]}
                              onPress={() =>
                                openTeacherDetail(
                                  student.studentId,
                                  att.attemptId,
                                )
                              }
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={gr.attemptTitle} numberOfLines={1}>
                                  {att.quizTitle}
                                </Text>
                                {att.gameMetrics ? (
                                  <View style={gr.gameTag}>
                                    <Text
                                      style={[
                                        gr.gameTagText,
                                        { color: "#7B4FCA" },
                                      ]}
                                    >
                                      {att.gameMetrics.pairsMatched}/
                                      {att.gameMetrics.totalPairs} pairs
                                      {att.gameMetrics.clickLimit > 0
                                        ? ` · ${att.gameMetrics.clicksUsed}/${att.gameMetrics.clickLimit} clicks`
                                        : ""}
                                      {" · "}
                                      {att.gameMetrics.accuracy}% acc
                                    </Text>
                                  </View>
                                ) : (
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      color: Colors.textMuted,
                                      fontWeight: "600",
                                    }}
                                  >
                                    Tap to view detail
                                  </Text>
                                )}
                              </View>
                              <View
                                style={[
                                  gr.pctBadge,
                                  {
                                    backgroundColor:
                                      att.scorePct >= 70
                                        ? "#D6F5D6"
                                        : att.scorePct >= 40
                                          ? "#FFF5CC"
                                          : "#FFE8D6",
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    gr.pctText,
                                    {
                                      color:
                                        att.scorePct >= 70
                                          ? "#2E7D32"
                                          : att.scorePct >= 40
                                            ? "#E6A020"
                                            : "#C62828",
                                    },
                                  ]}
                                >
                                  {att.correctCount}/{att.totalQuestions}
                                </Text>
                              </View>
                            </Pressable>
                          ))}
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
          </>
          )}
        </ScrollView>

        {/* ── Teacher quiz detail modal (same board UI as parent) ── */}
        <Modal
          visible={!!teacherQuizDetail || loadingTeacherDetail}
          animationType="slide"
          transparent
          onRequestClose={() => setTeacherQuizDetail(null)}
        >
          <View style={pr.modalOverlay}>
            <View style={[pr.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              {loadingTeacherDetail ? (
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 60,
                  }}
                >
                  <ActivityIndicator accessibilityLabel="Loading" size="large" color={Colors.primary} />
                  <Text
                    style={{
                      marginTop: 12,
                      color: Colors.textMuted,
                      fontWeight: "600",
                    }}
                  >
                    Loading…
                  </Text>
                </View>
              ) : teacherQuizDetail ? (
                <>
                  <View style={pr.modalHeader}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={pr.modalTitle} numberOfLines={2}>
                        {teacherQuizDetail.attempt.quizTitle}
                      </Text>
                      <Text style={pr.modalSub}>
                        {teacherQuizDetail.attempt.correctCount}/
                        {teacherQuizDetail.attempt.totalQuestions} correct ·{" "}
                        {teacherQuizDetail.attempt.scorePct}%
                      </Text>
                    </View>
                    <Pressable
                      style={pr.modalClose}
                      onPress={() => setTeacherQuizDetail(null)}
                    >
                      <X size={18} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                  <ScrollView
                    contentContainerStyle={{
                      paddingHorizontal: 16,
                      paddingBottom: 32,
                    }}
                    showsVerticalScrollIndicator={false}
                  >
                    {teacherQuizDetail.questions.map((q, i) => {
                      const qType = q.questionType;
                      const isMemory = qType === "memory_match";
                      const isFill =
                        qType === "fill_blank" || qType === "fill_in_blank";
                      const isJigsaw2 =
                        qType === "jigsaw" || qType === "jigsaw_puzzle";
                      const options = (q.questionData.options ?? []) as Array<{
                        id: string;
                        label?: string;
                        is_correct?: boolean;
                      }>;
                      const selectedId = q.responseData.selected_id;
                      const selectedIds = Array.isArray(
                        q.responseData.selected_ids,
                      )
                        ? (q.responseData.selected_ids as string[])
                        : [];
                      const selectedAny = selectedId ?? selectedIds[0];
                      const bannerBg = isJigsaw2
                        ? "#E0F2FE"
                        : q.isCorrect
                          ? "#E8F5E9"
                          : "#FFF3F0";
                      const bannerColor = isJigsaw2
                        ? "#0C4A6E"
                        : q.isCorrect
                          ? "#1B5E20" // darkened from #2E7D32 to survive the 0.7 opacity below
                          : "#C62828";
                      const bannerLabel = isMemory
                        ? `${q.responseData.pairsMatched ?? 0}/${q.responseData.totalPairs ?? 0} pairs`
                        : isJigsaw2
                          ? q.responseData.completed
                            ? "Completed"
                            : "Not finished"
                          : q.isCorrect
                            ? "✓ Correct"
                            : "✗ Wrong";
                      return (
                        <View key={q.questionId} style={pr.detailQuestionCard}>
                          <View
                            style={[
                              pr.detailQuestionBanner,
                              { backgroundColor: bannerBg },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "800",
                                color: bannerColor,
                                // opacity: 0.7 removed — it dropped bannerColor
                                // below 4.5:1 on bannerBg for all 3 variants
                              }}
                            >
                              Q{i + 1}
                              {isMemory
                                ? " · Memory Match"
                                : isFill
                                  ? " · Fill Blank"
                                  : isJigsaw2
                                    ? " · Jigsaw"
                                    : ""}
                            </Text>
                            <View
                              style={{
                                // darkened so white text below clears 4.5:1
                                // (raw #0EA5E9/#4CAF50/#FF5252 were 2.3-2.8:1)
                                backgroundColor: isJigsaw2
                                  ? q.responseData.completed
                                    ? "#0369A1"
                                    : "#C62828"
                                  : q.isCorrect
                                    ? "#1B5E20"
                                    : "#C62828",
                                borderRadius: 999,
                                paddingHorizontal: 12,
                                paddingVertical: 5,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "900",
                                  color: "#fff",
                                }}
                              >
                                {bannerLabel}
                              </Text>
                            </View>
                          </View>
                          <View style={pr.detailQuestionInner}>
                            <Text style={pr.detailQTitle}>
                              {q.questionTitle ??
                                q.questionInstruction ??
                                `Question ${i + 1}`}
                            </Text>
                            {isMemory &&
                              (() => {
                                const rd = q.responseData;
                                const allPairs = (q.questionData.pairs ??
                                  []) as Array<{
                                  id: number;
                                  label: string;
                                  imageUrl?: string;
                                }>;
                                const matchedSet = new Set(
                                  (rd.correctMatches ?? []).map(
                                    (m: any) => m.pairId as number,
                                  ),
                                );
                                const cols = allPairs.length <= 2 ? 2 : 3;
                                const boardRows2: (typeof allPairs)[] = [];
                                for (let j = 0; j < allPairs.length; j += cols)
                                  boardRows2.push(allPairs.slice(j, j + cols));
                                return (
                                  <View style={{ marginTop: 12, gap: 10 }}>
                                    <View style={gr.chipRow}>
                                      <View
                                        style={[
                                          gr.chip,
                                          { backgroundColor: "#E8F5E9" },
                                        ]}
                                      >
                                        <CheckCircle
                                          size={13}
                                          color="#4CAF50"
                                        />
                                        <Text
                                          style={[
                                            gr.chipTxt,
                                            { color: "#2E7D32" },
                                          ]}
                                        >
                                          {rd.pairsMatched ?? 0}/
                                          {rd.totalPairs ?? allPairs.length}{" "}
                                          pairs
                                        </Text>
                                      </View>
                                      {(rd.clickLimit ?? 0) > 0 && (
                                        <View
                                          style={[
                                            gr.chip,
                                            { backgroundColor: "#FFF5CC" },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              gr.chipTxt,
                                              { color: "#E6A020" },
                                            ]}
                                          >
                                            {rd.clicksUsed}/{rd.clickLimit}{" "}
                                            clicks
                                          </Text>
                                        </View>
                                      )}
                                      <View
                                        style={[
                                          gr.chip,
                                          { backgroundColor: Colors.purpleLight },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            gr.chipTxt,
                                            { color: "#7B4FCA" },
                                          ]}
                                        >
                                          {rd.accuracy ?? 0}% acc
                                        </Text>
                                      </View>
                                      {(rd.wrongAttempts ?? 0) > 0 && (
                                        <View
                                          style={[
                                            gr.chip,
                                            { backgroundColor: "#FFF3F0" },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              gr.chipTxt,
                                              { color: "#C62828" },
                                            ]}
                                          >
                                            {rd.wrongAttempts} wrong
                                          </Text>
                                        </View>
                                      )}
                                    </View>
                                    {/* Accuracy progress bar */}
                                    {(() => {
                                      const acc = rd.accuracy ?? 0;
                                      // vivid fill color for the progress bar track
                                      const barColor =
                                        acc >= 80
                                          ? "#4CAF50"
                                          : acc >= 50
                                            ? "#E6A020"
                                            : "#FF5252";
                                      // darker variants for the "{acc}%" text on white (raw barColor was 2.2-3.2:1)
                                      const barTextColor =
                                        acc >= 80
                                          ? "#1B5E20"
                                          : acc >= 50
                                            ? RoleColors.superadmin
                                            : "#C62828";
                                      return (
                                        <View style={{ gap: 4 }}>
                                          <View
                                            style={{
                                              flexDirection: "row",
                                              justifyContent: "space-between",
                                            }}
                                          >
                                            <Text
                                              style={{
                                                fontSize: 11,
                                                fontWeight: "700",
                                                color: Colors.textMuted,
                                                textTransform: "uppercase",
                                              }}
                                            >
                                              Accuracy
                                            </Text>
                                            <Text
                                              style={{
                                                fontSize: 11,
                                                fontWeight: "800",
                                                color: barTextColor,
                                              }}
                                            >
                                              {acc}%
                                            </Text>
                                          </View>
                                          <View
                                            style={{
                                              height: 8,
                                              backgroundColor: "#F0F0F5",
                                              borderRadius: 4,
                                              overflow: "hidden",
                                            }}
                                          >
                                            <View
                                              style={{
                                                height: 8,
                                                width: `${acc}%` as any,
                                                backgroundColor: barColor,
                                                borderRadius: 4,
                                              }}
                                            />
                                          </View>
                                        </View>
                                      );
                                    })()}

                                    <Text style={gr.boardLabel}>
                                      Board Result
                                    </Text>
                                    <View style={{ gap: 8 }}>
                                      {boardRows2.map((row, rIdx) => (
                                        <View
                                          key={rIdx}
                                          style={{
                                            flexDirection: "row",
                                            gap: 8,
                                          }}
                                        >
                                          {row.map((pair) => {
                                            const isOk = matchedSet.has(
                                              pair.id,
                                            );
                                            const imgUrl = pair.imageUrl
                                              ? `${API_BASE_URL}${pair.imageUrl}`
                                              : undefined;
                                            return (
                                              <View
                                                key={pair.id}
                                                style={[
                                                  gr.boardCard,
                                                  {
                                                    flex: 1,
                                                    backgroundColor: isOk
                                                      ? "#E8F5E9"
                                                      : "#FFF3F0",
                                                    borderColor: isOk
                                                      ? "#4CAF50"
                                                      : Colors.accent,
                                                  },
                                                ]}
                                              >
                                                {imgUrl ? (
                                                  <Image
                                                    source={{ uri: imgUrl }}
                                                    style={gr.boardImg}
                                                    resizeMode="contain"
                                                  />
                                                ) : (
                                                  <Text
                                                    style={{ fontSize: 22 }}
                                                  >
                                                    ?
                                                  </Text>
                                                )}
                                                <Text
                                                  style={[
                                                    gr.boardCardLabel,
                                                    {
                                                      color: isOk
                                                        ? "#2E7D32"
                                                        : "#C62828",
                                                    },
                                                  ]}
                                                  numberOfLines={1}
                                                >
                                                  {pair.label}
                                                </Text>
                                                <View
                                                  style={[
                                                    gr.boardBadge,
                                                    {
                                                      // darkened so white boardBadgeText clears 4.5:1 (was 2.78/3.19:1)
                                                      backgroundColor: isOk
                                                        ? "#2E7D32"
                                                        : "#C62828",
                                                    },
                                                  ]}
                                                >
                                                  <Text
                                                    style={gr.boardBadgeText}
                                                  >
                                                    {isOk ? "✓" : "✗"}
                                                  </Text>
                                                </View>
                                              </View>
                                            );
                                          })}
                                          {row.length < cols &&
                                            Array.from({
                                              length: cols - row.length,
                                            }).map((_, fi) => (
                                              <View
                                                key={fi}
                                                style={{ flex: 1 }}
                                              />
                                            ))}
                                        </View>
                                      ))}
                                    </View>
                                  </View>
                                );
                              })()}
                            {isFill &&
                              (() => {
                                const sentence =
                                  (q.questionData.sentence as string) ?? "";
                                const correct =
                                  (q.questionData.answer as string) ??
                                  q.responseData.answer ??
                                  "";
                                const chosen = q.responseData.selected ?? "—";
                                const isOk =
                                  (chosen as string).toLowerCase() ===
                                  (correct as string).toLowerCase();
                                const parts = sentence.split("___");
                                return (
                                  <View style={{ marginTop: 12, gap: 10 }}>
                                    <View
                                      style={[
                                        gr.sentenceBox,
                                        {
                                          borderColor: isOk
                                            ? "#4CAF50"
                                            : Colors.accent,
                                        },
                                      ]}
                                    >
                                      <Text style={gr.sentenceText}>
                                        <Text>{parts[0]}</Text>
                                        <Text
                                          style={[
                                            gr.blankFilled,
                                            {
                                              color: isOk
                                                ? "#2E7D32"
                                                : "#C62828",
                                              backgroundColor: isOk
                                                ? "#E8F5E9"
                                                : "#FFF3F0",
                                            },
                                          ]}
                                        >
                                          {" "}
                                          {chosen as string}{" "}
                                        </Text>
                                        <Text>{parts[1] ?? ""}</Text>
                                      </Text>
                                    </View>
                                    {!isOk && (
                                      <View
                                        style={[
                                          gr.sentenceBox,
                                          { borderColor: "#4CAF50" },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            gr.sentenceText,
                                            {
                                              color: "#2E7D32",
                                              fontWeight: "800",
                                            },
                                          ]}
                                        >
                                          {parts[0]}
                                          <Text
                                            style={{
                                              backgroundColor: "#D6F5D6",
                                            }}
                                          >
                                            {" "}
                                            {correct as string}{" "}
                                          </Text>
                                          {parts[1] ?? ""}
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                );
                              })()}
                            {/* ── JIGSAW PUZZLE result (teacher) ── */}
                            {isJigsaw2 &&
                              (() => {
                                const rd = q.responseData;
                                const completed = Boolean(rd.completed);
                                const moves = Number(rd.moves ?? 0);
                                const clickLim =
                                  rd.clickLimit != null
                                    ? Number(rd.clickLimit)
                                    : null;
                                const timeTaken = Number(rd.timeTaken ?? 0);
                                const gridSize =
                                  (rd.gridSize as string) ||
                                  (q.questionData as any).gridSize ||
                                  "3x3";
                                const difficulty =
                                  (rd.difficulty as string) ||
                                  (q.questionData as any).difficulty ||
                                  "medium";
                                const n = Number(gridSize.split("x")[0]) || 3;
                                const total = n * n;
                                const diffColor =
                                  difficulty === "easy"
                                    ? "#15803D"
                                    : difficulty === "medium"
                                      ? "#A16207"
                                      : "#B91C1C";
                                const diffBg =
                                  difficulty === "easy"
                                    ? "#DCFCE7"
                                    : difficulty === "medium"
                                      ? "#FEF9C3"
                                      : Colors.errorLight;
                                const barColor = completed
                                  ? "#0EA5E9"
                                  : "#FF5252";
                                // darker variants for the "Completed/Not finished" text on white
                                const barTextColor = completed
                                  ? "#0369A1"
                                  : "#C62828";
                                const rawImg2 =
                                  (q.questionData as any).image ||
                                  (q.questionData as any).prompt_image;
                                const imgUrl2 = rawImg2
                                  ? rawImg2.startsWith("/media")
                                    ? `${API_BASE_URL}${rawImg2}`
                                    : rawImg2
                                  : null;
                                const slotArr2 = Array.isArray(
                                  rd.slotArrangement,
                                )
                                  ? (rd.slotArrangement as Array<number | null>)
                                  : null;
                                const CELL2 = 58;
                                const CGAP = 2;
                                return (
                                  <View style={{ marginTop: 12, gap: 10 }}>
                                    <View style={gr.chipRow}>
                                      <View
                                        style={[
                                          gr.chip,
                                          { backgroundColor: "#E0F2FE" },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            gr.chipTxt,
                                            { color: "#0369A1" },
                                          ]}
                                        >
                                          🧩 {gridSize} · {total} pieces
                                        </Text>
                                      </View>
                                      <View
                                        style={[
                                          gr.chip,
                                          { backgroundColor: diffBg },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            gr.chipTxt,
                                            { color: diffColor },
                                          ]}
                                        >
                                          {difficulty}
                                        </Text>
                                      </View>
                                      <View
                                        style={[
                                          gr.chip,
                                          { backgroundColor: "#F1F5F9" },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            gr.chipTxt,
                                            { color: "#334155" },
                                          ]}
                                        >
                                          {moves}
                                          {clickLim ? `/${clickLim}` : ""} moves
                                        </Text>
                                      </View>
                                      {timeTaken > 0 && (
                                        <View
                                          style={[
                                            gr.chip,
                                            { backgroundColor: "#F1F5F9" },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              gr.chipTxt,
                                              { color: "#334155" },
                                            ]}
                                          >
                                            {timeTaken}s
                                          </Text>
                                        </View>
                                      )}
                                    </View>
                                    <View style={{ gap: 4 }}>
                                      <View
                                        style={{
                                          flexDirection: "row",
                                          justifyContent: "space-between",
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 11,
                                            fontWeight: "700",
                                            color: Colors.textMuted,
                                            textTransform: "uppercase",
                                          }}
                                        >
                                          Result
                                        </Text>
                                        <Text
                                          style={{
                                            fontSize: 11,
                                            fontWeight: "800",
                                            color: barTextColor,
                                          }}
                                        >
                                          {completed
                                            ? "✓ Completed"
                                            : "✗ Not finished"}
                                        </Text>
                                      </View>
                                      <View
                                        style={{
                                          height: 8,
                                          backgroundColor: "#F0F0F5",
                                          borderRadius: 4,
                                          overflow: "hidden",
                                        }}
                                      >
                                        <View
                                          style={{
                                            height: 8,
                                            width: completed
                                              ? ("100%" as any)
                                              : ("30%" as any),
                                            backgroundColor: barColor,
                                            borderRadius: 4,
                                          }}
                                        />
                                      </View>
                                    </View>
                                    {/* Final answer image grid */}
                                    {imgUrl2 && slotArr2 ? (
                                      <View style={{ gap: 6 }}>
                                        <Text style={gr.boardLabel}>
                                          Final Answer
                                        </Text>
                                        <View style={{ gap: CGAP }}>
                                          {Array.from({ length: n }, (_, r) => (
                                            <View
                                              key={r}
                                              style={{
                                                flexDirection: "row",
                                                gap: CGAP,
                                              }}
                                            >
                                              {Array.from(
                                                { length: n },
                                                (_, c) => {
                                                  const slot = r * n + c;
                                                  const piece = slotArr2[slot];
                                                  const isEmpty =
                                                    piece === null ||
                                                    piece === undefined;
                                                  const isCorr =
                                                    !isEmpty && piece === slot;
                                                  return (
                                                    <View
                                                      key={c}
                                                      style={{
                                                        width: CELL2,
                                                        height: CELL2,
                                                        borderRadius: 5,
                                                        overflow: "hidden",
                                                        borderWidth: 2,
                                                        borderColor: isEmpty
                                                          ? "#CBD5E1"
                                                          : isCorr
                                                            ? "#4CAF50"
                                                            : Colors.accent,
                                                        backgroundColor: isEmpty
                                                          ? "#F0F4FF"
                                                          : undefined,
                                                        alignItems: "center",
                                                        justifyContent:
                                                          "center",
                                                      }}
                                                    >
                                                      {!isEmpty ? (
                                                        <Image
                                                          source={{
                                                            uri: imgUrl2,
                                                          }}
                                                          resizeMode="stretch"
                                                          style={{
                                                            width: CELL2 * n,
                                                            height: CELL2 * n,
                                                            position:
                                                              "absolute",
                                                            left: -(
                                                              (piece! % n) *
                                                              CELL2
                                                            ),
                                                            top: -(
                                                              Math.floor(
                                                                piece! / n,
                                                              ) * CELL2
                                                            ),
                                                          }}
                                                        />
                                                      ) : (
                                                        <Text
                                                          style={{
                                                            fontSize: 10,
                                                            color: "#4E5D71",
                                                            fontWeight: "700",
                                                          }}
                                                        >
                                                          {slot + 1}
                                                        </Text>
                                                      )}
                                                      {!isEmpty && (
                                                        <View
                                                          style={{
                                                            position:
                                                              "absolute",
                                                            bottom: 2,
                                                            right: 2,
                                                            width: 12,
                                                            height: 12,
                                                            borderRadius: 6,
                                                            // darkened so white ✓/✗ text below clears 4.5:1
                                                            backgroundColor:
                                                              isCorr
                                                                ? "#1B5E20"
                                                                : "#C62828",
                                                            alignItems:
                                                              "center",
                                                            justifyContent:
                                                              "center",
                                                          }}
                                                        >
                                                          <Text
                                                            style={{
                                                              fontSize: 7,
                                                              color: "#fff",
                                                              fontWeight: "900",
                                                            }}
                                                          >
                                                            {isCorr ? "✓" : "✗"}
                                                          </Text>
                                                        </View>
                                                      )}
                                                    </View>
                                                  );
                                                },
                                              )}
                                            </View>
                                          ))}
                                        </View>
                                      </View>
                                    ) : imgUrl2 && completed ? (
                                      <View style={{ gap: 6 }}>
                                        <Text style={gr.boardLabel}>
                                          Final Answer
                                        </Text>
                                        <Image
                                          source={{ uri: imgUrl2 }}
                                          style={{
                                            width: "100%",
                                            height: 160,
                                            borderRadius: 10,
                                          }}
                                          resizeMode="contain"
                                        />
                                      </View>
                                    ) : null}
                                  </View>
                                );
                              })()}

                            {!isMemory &&
                              !isFill &&
                              !isJigsaw2 &&
                              options.length > 0 && (
                                <View style={{ gap: 8, marginTop: 12 }}>
                                  {options.map((o) => {
                                    const isSel =
                                      o.id === selectedAny ||
                                      selectedIds.includes(o.id);
                                    const isCor = o.is_correct === true;
                                    let bg = "#F8F9FC",
                                      border = "#EAECF0",
                                      txtC = "#374151",
                                      icon: string | null = null;
                                    if (isCor && isSel) {
                                      bg = "#E8F5E9";
                                      border = "#4CAF50";
                                      txtC = "#1B5E20";
                                      icon = "✓";
                                    } else if (isCor) {
                                      bg = "#E8F5E9";
                                      border = "#4CAF50";
                                      txtC = "#1B5E20";
                                      icon = "✓";
                                    } else if (isSel) {
                                      bg = "#FFF3F0";
                                      border = "#FF5252";
                                      txtC = "#B71C1C";
                                      icon = "✗";
                                    }
                                    return (
                                      <View
                                        key={o.id}
                                        style={[
                                          pr.detailOption,
                                          {
                                            backgroundColor: bg,
                                            borderColor: border,
                                          },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            pr.detailOptionText,
                                            { color: txtC },
                                          ]}
                                        >
                                          {o.label ?? o.id}
                                        </Text>
                                        {icon && (
                                          <View
                                            style={{
                                              width: 24,
                                              height: 24,
                                              borderRadius: 12,
                                              // darkened so white ✓/✗ text below clears 4.5:1
                                              backgroundColor: isCor
                                                ? "#1B5E20"
                                                : "#B71C1C",
                                              alignItems: "center",
                                              justifyContent: "center",
                                            }}
                                          >
                                            <Text
                                              style={{
                                                fontSize: 13,
                                                color: "#fff",
                                                fontWeight: "900",
                                              }}
                                            >
                                              {icon}
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                    );
                                  })}
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
      </>
    );
  }
}

// ── Main Styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, color: Colors.textMuted },
  errorText: {
    fontSize: 13,
    color: Colors.accent,
    paddingHorizontal: 20,
    marginTop: 12,
  },

  // ── Parent view ──────────────────────────────────────────────────────────
  childChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
  },
  childChipEmoji: { fontSize: 16 },
  childChipName: { fontSize: 13, fontWeight: "800" },
  childChipBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  childChipBadgeText: { fontSize: 10, fontWeight: "800" },
  parentHero: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 22,
    padding: 20,
    gap: 10,
  },
  parentHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  parentHeroTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  parentHeroPct: { fontSize: 36, fontWeight: "900", color: "#fff" },
  parentProgressTrack: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    overflow: "hidden",
  },
  parentProgressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 999,
  },
  parentHeroSub: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
  },
  statsStrip: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  parentStat: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
  },
  parentStatVal: { fontSize: 18, fontWeight: "900" },
  parentStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    textAlign: "center",
  },
  parentSubjectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  parentSubjectDot: { width: 10, height: 10, borderRadius: 5 },
  parentSubjectName: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
    width: 80,
  },
  parentSubjectTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 999,
    overflow: "hidden",
  },
  parentSubjectFill: { height: "100%", borderRadius: 999 },
  parentSubjectScore: {
    fontSize: 12,
    fontWeight: "800",
    width: 36,
    textAlign: "right",
  },
  activityList: { paddingHorizontal: 16, gap: 10, marginBottom: 24 },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  activityDot: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.borderLight,
  },
  activityBody: { flex: 1, gap: 2 },
  activityTitle: { fontSize: 13, fontWeight: "700", color: Colors.text },
  activityWhen: { fontSize: 11, color: Colors.textMuted, fontWeight: "500" },
  xpPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  xpPillText: { fontSize: 11, fontWeight: "800" },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  greetingSub: { fontSize: 12, color: Colors.textMuted, fontWeight: "500" },
  greetingName: {
    fontSize: 22,
    color: Colors.text,
    fontWeight: "900",
    lineHeight: 28,
  },
  xpChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  xpLabel: { fontSize: 13, fontWeight: "800", color: "#fff" },

  // Hero
  heroBanner: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: "#4A7FE0",
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  heroLeft: { flex: 1 },
  heroEyebrow: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
    marginBottom: 2,
  },
  heroXp: {
    fontSize: 30,
    color: "#fff",
    fontWeight: "900",
    lineHeight: 36,
    marginBottom: 6,
  },
  heroSub: { fontSize: 11, color: "#fff", fontWeight: "500" },
  heroRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    // Dark (not light) overlay — a light tint on this vivid blue banner
    // dropped the nested white "Score %" text to 2.14:1.
    backgroundColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  heroRingInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroRingPct: {
    fontSize: 16,
    fontWeight: "900",
    color: "#fff",
    lineHeight: 20,
  },
  heroRingLbl: {
    fontSize: 9,
    fontWeight: "600",
    color: "#fff",
  },

  // 2-col grid
  grid2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  statCard2: {
    width: "47%",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 5,
  },
  statVal2: { fontSize: 24, fontWeight: "900", lineHeight: 28 },
  statLabel2: { fontSize: 11, fontWeight: "600", color: "#5A5A7A" },

  // Chart card
  chartCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#C5D8F8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 2,
  },
  chartTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  chartTitle: { fontSize: 14, fontWeight: "800", color: Colors.text },
  chartSub: { fontSize: 11, fontWeight: "500", color: Colors.textMuted, marginTop: 2 },
  periodTotal: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.text,
    marginBottom: 4,
  },
  periodTotalSub: { fontSize: 13, fontWeight: "500", color: Colors.textMuted },

  // Period tabs
  periodTabs: { flexDirection: "row", gap: 4 },
  periodTab: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.borderLight,
  },
  periodTabActive: { backgroundColor: Colors.primary },
  periodTabText: { fontSize: 10, fontWeight: "700", color: Colors.textMuted },
  periodTabTextActive: { color: "#fff" },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  secTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: Colors.text,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  secHint: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
    paddingRight: 20,
  },

  // Subject cards
  subjectCard: {
    width: "47%",
    borderRadius: 20,
    padding: 14,
  },
  subjectTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  subjectEmoji: { fontSize: 28 },
  subjectPct: { fontSize: 18, fontWeight: "900" },
  subjectLabel: { fontSize: 13, fontWeight: "800", color: Colors.text },
  subjectMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  subjectMetaTxt: { fontSize: 10, fontWeight: "600", color: "#7A7A9A" },

  // Generic card
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#C5D8F8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 2,
  },

  // Progress
  progressItem: { gap: 6 },
  pLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pLabel: { fontSize: 13, fontWeight: "700", color: Colors.text },
  pPct: { fontSize: 13, fontWeight: "900" },
  progressSub: { fontSize: 11, color: Colors.textMuted, fontWeight: "500" },
  track: {
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 999 },

  // Classroom
  classroomTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  classroomDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7DC67A",
  },
  classroomTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
  },
  classBadge: {
    backgroundColor: "#D6EAFF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  classBadgeText: { fontSize: 11, fontWeight: "700", color: Colors.primary },
  countRow: {
    flexDirection: "row",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  countItem: { flex: 1, alignItems: "center", gap: 2 },
  countVal: { fontSize: 20, fontWeight: "900" },
  countLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
  },
  countDivider: { width: 1, backgroundColor: Colors.borderLight, alignSelf: "stretch" },

  // Activity
  actRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 2,
  },
  actBorder: {
    paddingBottom: 12,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  actIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actInfo: { flex: 1 },
  actTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 2,
  },
  actWhen: { fontSize: 11, fontWeight: "500", color: Colors.textMuted },
  xpBadge: {
    backgroundColor: "#D6F5D6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  xpBadgeText: { fontSize: 11, fontWeight: "800", color: "#3D9A6A" },

  // Teacher
  gapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  gapLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: Colors.text },
  emptyText: { fontSize: 12, color: Colors.textMuted, fontWeight: "500" },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: "800" },

  // Badges
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "center",
  },
  badgeItem: { alignItems: "center", gap: 5, width: 64 },
  badgeCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#5A5A7A",
    textAlign: "center",
  },
  emptyBlock: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});

// ── Game Result UI Styles (shared parent + teacher) ───────────────────────────
const gr = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  chipTxt: { fontSize: 11, fontWeight: "800" },
  chipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  boardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  boardCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    gap: 6,
  },
  boardCardLabel: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  boardImg: { width: 48, height: 48 },
  boardBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  boardBadgeText: { fontSize: 12, fontWeight: "900", color: "#fff" },
  sentenceBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
  },
  sentenceText: { fontSize: 14, color: Colors.text, lineHeight: 22 },
  blankFilled: {
    fontWeight: "900",
    borderRadius: 6,
    paddingHorizontal: 4,
    overflow: "hidden",
  },
  // Teacher student activity
  studentCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#9AA0C0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  studentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.purpleLight,
    alignItems: "center",
    justifyContent: "center",
  },
  studentName: { fontSize: 14, fontWeight: "800", color: Colors.text },
  studentMeta: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  attemptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
  },
  attemptTitle: { flex: 1, fontSize: 12, fontWeight: "700", color: Colors.text },
  pctBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pctText: { fontSize: 11, fontWeight: "900" },
  gameTag: { flexDirection: "row", gap: 4, flexWrap: "wrap", marginTop: 4 },
  gameTagItem: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    backgroundColor: Colors.purpleLight,
  },
  gameTagText: { fontSize: 9, fontWeight: "800", color: "#7B4FCA" },
  newBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    backgroundColor: "#FF5252",
  },
  newBadgeText: { fontSize: 9, fontWeight: "900", color: "#fff" },
  riskBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
  },
  riskBadgeText: { fontSize: 9, fontWeight: "900" },
});

// ── ParentReports Styles ──────────────────────────────────────────────────────
const pr = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F9FC" },
  scroll: { paddingBottom: 48, paddingTop: 0 },

  // Top bar — matches student dashboard
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  topBarSub: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.text,
    marginTop: 2,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.purpleLight,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnText: { fontSize: 18, fontWeight: "700", color: "#7B4FCA" },

  // Child switcher bar
  switcherBar: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  childChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 56,
  },
  childChipAvatar: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  childChipName: { fontSize: 12, fontWeight: "800" },
  childChipSub: { fontSize: 9, fontWeight: "600", marginTop: 0 },
  activeChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.6)",
    marginLeft: 2,
  },

  // Center (loading / no children)
  centerBlock: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.text,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },

  // Hero banner — matches student dashboard heroBanner
  heroBanner: {
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 8,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 5,
  },
  heroLeft: { flex: 1, gap: 4 },
  heroRight: { justifyContent: "center" },
  heroSup: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroScore: { fontSize: 48, fontWeight: "900", color: "#fff", lineHeight: 54 },
  heroLabel: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
  },
  heroTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 6,
  },
  heroFill: { height: "100%", backgroundColor: "#fff", borderRadius: 999 },
  heroMeta: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "600",
    marginTop: 4,
  },
  streakBadge: {
    // Darkening (not lightening) overlay so white text keeps WCAG AA
    // contrast against the (already-dark) hero card background.
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    gap: 2,
    minWidth: 72,
  },
  streakNum: { fontSize: 28, fontWeight: "900", color: "#fff" },
  streakFire: { fontSize: 18 },
  streakLabel: {
    fontSize: 9,
    color: "#fff",
    fontWeight: "700",
    textTransform: "uppercase",
  },

  // 4-stat row
  statRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 4,
  },
  statEmoji: { fontSize: 20 },
  statVal: { fontSize: 15, fontWeight: "900" },
  statLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    textAlign: "center",
  },

  // Section row header — matches student dashboard rowHeader
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  rowTitle: { fontSize: 17, fontWeight: "900", color: Colors.text },
  rowChip: { fontSize: 12, fontWeight: "700", color: Colors.primary },

  // Card — matches student dashboard gameCard shadow
  card: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#C5D8F8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 2,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F4F4FB",
  },
  cardFooterText: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
  cardFooterVal: { fontSize: 14, fontWeight: "900" },
  chartNote: {
    fontSize: 10,
    color: "#B0B8CC",
    fontWeight: "600",
    marginTop: 10,
    textAlign: "center",
  },

  // Live badge
  liveBadge: {
    backgroundColor: "#D6F5D6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveBadgeText: { fontSize: 11, fontWeight: "800", color: Colors.success }, // darkened from #4CAF50 (2.37:1 on liveBadge bg)

  // Classroom card — matches gameCard
  classCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#C5D8F8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 2,
  },
  classIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  classInfo: { flex: 1, gap: 2 },
  classTitle: { fontSize: 14, fontWeight: "800", color: Colors.text },
  classMeta: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  classDesc: {
    fontSize: 11,
    color: "#B0B8CC",
    fontWeight: "500",
    marginTop: 2,
  },
  classStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  classStatusText: { fontSize: 11, fontWeight: "800" },
  smallGradeBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  smallGradeText: { fontSize: 10, fontWeight: "800" },
  historyIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EBF4FF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  historyIconDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  historyTitle: { fontSize: 13, fontWeight: "800", color: Colors.text },
  historyMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
    marginTop: 2,
  },
  historyCta: { fontSize: 12, color: Colors.primary, fontWeight: "800" },

  // Quiz result card
  quizCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#C5D8F8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 2,
  },
  quizIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quizInfo: { flex: 1, gap: 3 },
  quizTitle: { fontSize: 14, fontWeight: "800", color: Colors.text },
  quizMeta: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  metaInfoStack: { gap: 2, marginTop: 2 },
  metaInfoRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaInfoLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textMuted,
    minWidth: 34,
  },
  metaInfoValue: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4B5768",
    flexShrink: 1,
  },
  quizProgressTrack: {
    height: 5,
    backgroundColor: Colors.borderLight,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 4,
  },
  quizProgressFill: { height: "100%", borderRadius: 999 },
  scoreBadge: {
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    minWidth: 68,
  },
  scoreNum: { fontSize: 18, fontWeight: "900" },
  scoreLabel: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 2,
  },

  // Assignments
  groupLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginHorizontal: 16,
  },
  assignCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#C5D8F8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 2,
  },
  assignIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  assignInfo: { flex: 1, gap: 3 },
  assignTitle: { fontSize: 14, fontWeight: "800", color: Colors.text },
  assignMeta: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  assignFeedback: {
    fontSize: 11,
    color: Colors.success, // darkened from #4CAF50 (3.3:1 on white) — WCAG AA fix
    fontWeight: "600",
    marginTop: 2,
  },
  assignStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  assignStatusText: { fontSize: 11, fontWeight: "800" },

  // Activity log
  actCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#C5D8F8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 1,
  },
  actIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  actInfo: { flex: 1, gap: 2 },
  actTitle: { fontSize: 13, fontWeight: "800", color: Colors.text },
  actMeta: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  actTime: { fontSize: 11, fontWeight: "800", color: Colors.primary },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 10, fontWeight: "800" },

  // Empty state inline card
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 4,
  },
  emptyCardText: {
    fontSize: 13,
    color: "#B0B8CC",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },

  // Tab bar
  tabBar: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tabBarContent: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabBtn: {
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#F4F4FB",
    minWidth: 68,
  },
  tabBtnActive: { backgroundColor: "#EBF4FF" },
  tabBtnIconWrap: {
    position: "relative",
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnText: { fontSize: 11, fontWeight: "700", color: Colors.textMuted },
  tabBtnTextActive: { color: Colors.primary, fontWeight: "800" },
  tabDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    borderWidth: 1.5,
    borderColor: "#fff",
  },

  // Section header inside tab content
  sectionHdr: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHdrTitle: { fontSize: 17, fontWeight: "900", color: Colors.text },
  sectionHdrChip: { fontSize: 12, fontWeight: "700", color: Colors.primary },

  // Wraps a pair of section-header+card blocks so they sit side by side on
  // large screens (row) but stack exactly as before on phones (column, no gap
  // — spacing there still comes from each section's own sectionHdr margins).
  chartsGridRow: {
    paddingHorizontal: 16,
  },
  chartsGridCol: { flex: 1, minWidth: 0 },

  // Inline meta row (compact date/time in one line)
  inlineMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  inlineMetaText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
    flexShrink: 1,
  },

  // Urgent badge (pending assignments)
  urgentBadge: {
    backgroundColor: "#FFE8D6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  urgentBadgeText: { fontSize: 11, fontWeight: "800", color: "#B03A19" }, // darkened from #D33F13 (3.96:1 on urgentBadge bg)

  // Generic status chip (replaces statusPill / assignStatusBadge)
  statusChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusChipText: { fontSize: 10, fontWeight: "800" },

  // Empty state card
  emptyStateCard: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: Colors.text,
    textAlign: "center",
  },
  emptyStateText: {
    fontSize: 13,
    color: "#B0B8CC",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },

  // Sticky section tabs (kept for compatibility, no longer used in ParentReports)
  stickyTabs: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    zIndex: 10,
  },
  stickyTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#F4F4FB",
  },
  stickyTabActive: { backgroundColor: Colors.primary },
  stickyTabText: { fontSize: 12, fontWeight: "700", color: Colors.textMuted },
  stickyTabTextActive: { color: "#fff" },

  // View all / modals
  viewAllBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.purpleLight,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  viewAllBtnText: { fontSize: 14, fontWeight: "800", color: "#7B4FCA" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,10,30,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: Colors.text },
  modalSub: { fontSize: 12, color: Colors.textMuted, fontWeight: "600", marginTop: 2 },
  modalMetaStack: { gap: 2, marginTop: 4 },
  modalMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  modalMetaLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textMuted,
    minWidth: 36,
  },
  modalMetaValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4B5768",
    flexShrink: 1,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F4F4FB",
    alignItems: "center",
    justifyContent: "center",
  },
  modalQuizRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F4FB",
  },
  modalQuizNum: { width: 28, alignItems: "center" },

  // Quiz detail
  detailQuestionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#C5D8F8",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  detailQuestionInner: { padding: 16 },
  detailQuestionBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailQHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailQNum: { fontSize: 12, fontWeight: "900", color: Colors.textMuted },
  detailQBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detailQBadgeText: { fontSize: 11, fontWeight: "800" },
  detailQTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 22,
  },
  detailOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailOptionText: { fontSize: 14, fontWeight: "600", flex: 1 },
  detailAnswerRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  detailAnswerLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
  detailAnswerVal: { fontSize: 12, fontWeight: "800" },
  detailPanel: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 16,
    padding: 12,
  },
  detailPanelTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 4,
  },
  detailBodyText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
    lineHeight: 18,
  },
  achievementWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  achievementChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  achievementEmoji: { fontSize: 14 },
  achievementText: { fontSize: 11, fontWeight: "700", maxWidth: 200 },
  mediaPreview: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: "#F4F4FB",
  },
  mediaBtn: {
    backgroundColor: Colors.purpleLight,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 10,
  },
  mediaBtnText: { fontSize: 12, fontWeight: "800", color: "#7B4FCA" },
});
