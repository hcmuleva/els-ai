/**
 * ClassDetailsScreen — full-screen 3-tab class details for teachers.
 * Tabs: Overview | Students | Analytics
 */
import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, View, Image, Linking, TextInput,
} from 'react-native';
import Svg, { Rect, Text as SvgText, G, Circle, SvgXml } from 'react-native-svg';
import {
  ChevronLeft, Users, CheckCircle, ClipboardList, Target,
  BookOpen, Trophy, LayoutList, BarChart2, Calendar, Clock,
  CheckCheck, AlertCircle, Star, Check, Circle as CircleIcon,
  Pencil, Plus, TrendingUp,
} from 'lucide-react-native';
import { getStandardLabel } from '../../constants/standards';
import { API_BASE_URL } from '../../context/AuthContext';
import { OWL } from '../../assets/svgs';
import StudentRemarkSheet, { Achievement, StudentRemarkData } from './StudentRemarkSheet';

// ── Types ─────────────────────────────────────────────────────────────────────
type DetailTab = 'overview' | 'students' | 'analytics';
type StudentFilter = 'all' | 'not_remarked' | 'remarked' | 'task_completed' | 'task_pending' | 'quiz_completed' | 'quiz_pending';

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
type StudentQuizAttempt = {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  score: number;
  totalPoints: number;
  completedAt?: string | null;
  questionAttempts: Array<{
    questionId: string;
    questionTitle: string;
    questionType?: string;
    questionInstruction?: string;
    questionData?: any;
    isCorrect: boolean;
    responseData?: unknown;
    timeSpentSeconds?: number | null;
  }>;
};
type StudentAssignmentDetail = {
  assignmentId: string;
  title: string;
  description?: string;
  instructions?: string;
  dueDate?: string | null;
  submissionText?: string;
  attachmentUrl?: string;
  submittedAt?: string | null;
};
type StudentDetailPayload = {
  quizzes: StudentQuizAttempt[];
  assignments: StudentAssignmentDetail[];
};

function resolveMediaUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('/media')) return `${API_BASE_URL}${url}`;
  return url;
}

function normalizeQuestionType(type?: string) {
  if (!type) return '';
  if (type === 'image_select') return 'guess_image';
  if (type === 'drag_drop') return 'drag_drop_match';
  if (type === 'sound_match') return 'guess_audio';
  if (type === 'memory_game') return 'multi_choice';
  return type;
}

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
function StudentRow({ student, totalAssignments, totalQuizzes, onRemark, onQuizDetails, onAssignmentDetails }: {
  student: Student; totalAssignments: number; totalQuizzes: number;
  onRemark: (s: Student) => void;
  onQuizDetails: (s: Student) => void;
  onAssignmentDetails: (s: Student) => void;
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
      <View style={ds.studentActionRow}>
        <Pressable
          style={[ds.secondaryActionBtn, ds.remarkActionBtn, hasRemark && ds.remarkActionBtnFilled]}
          onPress={() => onRemark(student)}
        >
          {hasRemark
            ? <Pencil size={11} color="#fff" />
            : <Plus size={11} color="#7C2D12" />}
          <Text style={[ds.secondaryActionBtnText, ds.remarkActionBtnText, hasRemark && ds.secondaryActionBtnTextFilled]}>
            {hasRemark ? 'Edit Remark' : 'Add Remark'}
          </Text>
        </Pressable>
        <Pressable style={ds.secondaryActionBtn} onPress={() => onQuizDetails(student)}>
          <Text style={ds.secondaryActionBtnText}>Quiz Details</Text>
        </Pressable>
        <Pressable style={ds.secondaryActionBtn} onPress={() => onAssignmentDetails(student)}>
          <Text style={ds.secondaryActionBtnText}>Assignment Details</Text>
        </Pressable>
      </View>
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
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [detailTab, setDetailTab] = useState<'quiz' | 'assignment'>('quiz');
  const [detailLoading, setDetailLoading] = useState(false);
  const [studentDetails, setStudentDetails] = useState<StudentDetailPayload | null>(null);
  const [selectedQuizAttemptId, setSelectedQuizAttemptId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentPage, setStudentPage] = useState(0);
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');

  const loadData = useCallback(async () => {
    if (!classroomId) return;
    setLoading(true);
    try {
      const [detailRes, achievRes] = await Promise.all([
        apiFetch(`/classrooms/${classroomId}/class-details`),
        apiFetch('/achievements'),
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
    await apiFetch(`/classrooms/${classroomId}/remarks/${studentId}`, {
      method: 'PUT', body: JSON.stringify(data),
    });
    await loadData();
  };

  const handleGrantAchievement = async (studentId: string, achievementId: string) => {
    await apiFetch('/achievements/grant', {
      method: 'POST', body: JSON.stringify({ studentId, classroomId, achievementId }),
    });
    await loadData();
  };

  const openStudentDetails = async (student: Student, mode: 'quiz' | 'assignment') => {
    if (!classroomId) return;
    setDetailStudent(student);
    setDetailTab(mode);
    setDetailLoading(true);
    setSelectedQuizAttemptId(null);
    try {
      const res = await apiFetch(`/classrooms/${classroomId}/students/${student.studentId}/details`);
      if (res.ok) {
        const payload = (await res.json()) as StudentDetailPayload;
        setStudentDetails(payload);
      } else {
        setStudentDetails({ quizzes: [], assignments: [] });
      }
    } catch {
      setStudentDetails({ quizzes: [], assignments: [] });
    } finally {
      setDetailLoading(false);
    }
  };

  const closeStudentDetails = () => {
    setDetailStudent(null);
    setStudentDetails(null);
    setSelectedQuizAttemptId(null);
  };

  const openAttachment = async (url?: string) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // ignore
    }
  };

  const renderAttemptAnswer = (qa: StudentQuizAttempt['questionAttempts'][number], index: number) => {
    const normalizedType = normalizeQuestionType(qa.questionType);
    const responseData = (qa.responseData as any) || {};
    const questionData = (qa.questionData as any) || {};

    if (normalizedType === 'logico') {
      const promptImage = resolveMediaUrl(questionData.prompt_image);
      const placements = (responseData.placements || {}) as Record<string, string>;
      const expectedMap = (questionData.button_slot_map || responseData.expected || {}) as Record<string, number>;
      const optionSlots = Array.isArray(questionData.option_slots) ? questionData.option_slots : [];
      return (
        <View key={`${qa.questionId}-${index}`} style={ds.answerCard}>
          <View style={[ds.answerCardBanner, { backgroundColor: qa.isCorrect ? '#E8F5E9' : '#FFF3F0' }]}>
            <Text style={ds.answerCardBannerTitle}>Question {index + 1}</Text>
            <Text style={[ds.answerCardBadge, { backgroundColor: qa.isCorrect ? '#4CAF50' : '#FF5252' }]}>
              {qa.isCorrect ? 'Correct' : 'Wrong'}
            </Text>
          </View>
          <View style={ds.answerRow}>
            <Text style={ds.answerTitle}>{qa.questionTitle || 'Question'}</Text>
            {promptImage ? <Image source={{ uri: promptImage }} style={ds.answerPromptImage} resizeMode="contain" /> : null}
            <View style={ds.mappingTable}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((slotId) => {
                const selected = placements[String(slotId)] || placements[slotId as any] || '—';
                const expected = Object.entries(expectedMap).find(([, s]) => Number(s) === slotId)?.[0] || '—';
                const slotLabel = optionSlots.find((x: any) => Number(x?.id) === slotId)?.value || `Slot ${slotId}`;
                return (
                  <View key={`${qa.questionId}-slot-${slotId}`} style={ds.mappingRow}>
                    <Text style={ds.mappingSlot}>{slotId}</Text>
                    <Text style={ds.mappingLabel} numberOfLines={1}>{slotLabel}</Text>
                    <Text style={ds.mappingSelected} numberOfLines={1}>{selected}</Text>
                    <Text style={ds.mappingExpected} numberOfLines={1}>{expected}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      );
    }

    if (normalizedType === 'drag_drop_match') {
      const matches = Array.isArray(responseData.matches) ? responseData.matches : [];
      return (
        <View key={`${qa.questionId}-${index}`} style={ds.answerCard}>
          <View style={[ds.answerCardBanner, { backgroundColor: qa.isCorrect ? '#E8F5E9' : '#FFF3F0' }]}>
            <Text style={ds.answerCardBannerTitle}>Question {index + 1}</Text>
            <Text style={[ds.answerCardBadge, { backgroundColor: qa.isCorrect ? '#4CAF50' : '#FF5252' }]}>
              {qa.isCorrect ? 'Correct' : 'Wrong'}
            </Text>
          </View>
          <View style={ds.answerRow}>
            <Text style={ds.answerTitle}>{qa.questionTitle || 'Question'}</Text>
            {matches.map((m: any, idx: number) => (
              <Text key={`${qa.questionId}-m-${idx}`} style={ds.answerPayload}>
                {m?.target || 'Target'} → {m?.item || 'Item'} ({m?.is_correct ? 'Correct' : 'Wrong'})
              </Text>
            ))}
          </View>
        </View>
      );
    }

    // ── Memory Match ────────────────────────────────────────────────────────
    if (normalizedType === 'memory_match') {
      const allPairs = (Array.isArray(questionData.pairs) ? questionData.pairs : []) as Array<{ id: number; label: string; imageUrl?: string }>;
      const matchedSet = new Set(((responseData.correctMatches ?? []) as Array<{ pairId: number }>).map((m) => m.pairId));
      const acc = responseData.accuracy ?? 0;
      const barColor = acc >= 80 ? '#4CAF50' : acc >= 50 ? '#E6A020' : '#FF5252';
      const cols = allPairs.length <= 2 ? 2 : 3;
      const boardRows: typeof allPairs[] = [];
      for (let i = 0; i < allPairs.length; i += cols) boardRows.push(allPairs.slice(i, i + cols));
      return (
        <View key={`${qa.questionId}-${index}`} style={ds.answerCard}>
          <View style={[ds.answerCardBanner, { backgroundColor: '#FFF8E1' }]}>
            <Text style={[ds.answerCardBannerTitle, { color: '#7B4FCA' }]}>Memory Game</Text>
            <Text style={[ds.answerCardBadge, { backgroundColor: '#7B4FCA' }]}>
              {responseData.pairsMatched ?? 0}/{responseData.totalPairs ?? allPairs.length} pairs
            </Text>
          </View>
          <View style={[ds.answerRow, { gap: 10 }]}>
            {/* Chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <View style={[ds.mmChip, { backgroundColor: '#E8F5E9' }]}>
                <CheckCircle size={12} color="#4CAF50" />
                <Text style={[ds.mmChipTxt, { color: '#2E7D32' }]}>{responseData.pairsMatched ?? 0}/{responseData.totalPairs ?? allPairs.length} pairs</Text>
              </View>
              {(responseData.clickLimit ?? 0) > 0 && (
                <View style={[ds.mmChip, { backgroundColor: '#FFF5CC' }]}>
                  <Text style={[ds.mmChipTxt, { color: '#E6A020' }]}>{responseData.clicksUsed ?? 0}/{responseData.clickLimit} clicks</Text>
                </View>
              )}
              <View style={[ds.mmChip, { backgroundColor: '#EDE4FF' }]}>
                <Text style={[ds.mmChipTxt, { color: '#7B4FCA' }]}>{acc}% acc</Text>
              </View>
              {(responseData.wrongAttempts ?? 0) > 0 && (
                <View style={[ds.mmChip, { backgroundColor: '#FFF3F0' }]}>
                  <Text style={[ds.mmChipTxt, { color: '#C62828' }]}>{responseData.wrongAttempts} wrong</Text>
                </View>
              )}
            </View>
            {/* Accuracy bar */}
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={ds.mmBarLabel}>ACCURACY</Text>
                <Text style={[ds.mmBarLabel, { color: barColor }]}>{acc}%</Text>
              </View>
              <View style={{ height: 8, backgroundColor: '#F0F0F5', borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ height: 8, width: `${acc}%` as any, backgroundColor: barColor, borderRadius: 4 }} />
              </View>
            </View>
            {/* Board grid */}
            <Text style={ds.mmBoardLabel}>BOARD RESULT</Text>
            <View style={{ gap: 8 }}>
              {boardRows.map((row, rIdx) => (
                <View key={rIdx} style={{ flexDirection: 'row', gap: 8 }}>
                  {row.map((pair) => {
                    const isOk   = matchedSet.has(pair.id);
                    const imgUrl = pair.imageUrl ? `${API_BASE_URL}${pair.imageUrl}` : undefined;
                    return (
                      <View key={pair.id} style={[ds.mmCard, { flex: 1, backgroundColor: isOk ? '#E8F5E9' : '#FFF3F0', borderColor: isOk ? '#4CAF50' : '#FF7043' }]}>
                        {imgUrl
                          ? <Image source={{ uri: imgUrl }} style={ds.mmCardImg} resizeMode="contain" />
                          : <Text style={{ fontSize: 22 }}>?</Text>}
                        <Text style={[ds.mmCardLabel, { color: isOk ? '#2E7D32' : '#C62828' }]} numberOfLines={1}>{pair.label}</Text>
                        <View style={[ds.mmCardBadge, { backgroundColor: isOk ? '#4CAF50' : '#FF5252' }]}>
                          <Text style={ds.mmCardBadgeTxt}>{isOk ? '✓' : '✗'}</Text>
                        </View>
                      </View>
                    );
                  })}
                  {row.length < cols && Array.from({ length: cols - row.length }).map((_, fi) => <View key={fi} style={{ flex: 1 }} />)}
                </View>
              ))}
            </View>
          </View>
        </View>
      );
    }

    // ── Fill in the Blank ────────────────────────────────────────────────────
    if (normalizedType === 'fill_blank' || normalizedType === 'fill_in_blank') {
      const sentence = (questionData.sentence as string) ?? '';
      const correct  = (questionData.answer as string) ?? (responseData.answer as string) ?? '';
      const chosen   = (responseData.selected as string) ?? '—';
      const isOk     = chosen.toLowerCase() === correct.toLowerCase();
      const parts    = sentence.split('___');
      return (
        <View key={`${qa.questionId}-${index}`} style={ds.answerCard}>
          <View style={[ds.answerCardBanner, { backgroundColor: isOk ? '#E8F5E9' : '#FFF3F0' }]}>
            <Text style={ds.answerCardBannerTitle}>Fill in the Blank</Text>
            <Text style={[ds.answerCardBadge, { backgroundColor: isOk ? '#4CAF50' : '#FF5252' }]}>
              {isOk ? 'Correct' : 'Wrong'}
            </Text>
          </View>
          <View style={[ds.answerRow, { gap: 8 }]}>
            <Text style={ds.answerTitle}>{qa.questionTitle || qa.questionInstruction || 'Fill in the blank'}</Text>
            <View style={[ds.mmSentenceBox, { borderColor: isOk ? '#4CAF50' : '#FF7043' }]}>
              <Text style={ds.mmSentenceTxt}>
                <Text>{parts[0]}</Text>
                <Text style={[ds.mmBlankFilled, { color: isOk ? '#2E7D32' : '#C62828', backgroundColor: isOk ? '#E8F5E9' : '#FFF3F0' }]}> {chosen} </Text>
                <Text>{parts[1] ?? ''}</Text>
              </Text>
            </View>
            {!isOk && (
              <View style={[ds.mmSentenceBox, { borderColor: '#4CAF50' }]}>
                <Text style={[ds.mmSentenceTxt, { color: '#2E7D32', fontWeight: '800' }]}>
                  {parts[0]}<Text style={{ backgroundColor: '#D6F5D6' }}> {correct} </Text>{parts[1] ?? ''}
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    const options = Array.isArray(questionData.options) ? questionData.options : [];
    const selectedIds = Array.isArray(responseData.selected_ids)
      ? responseData.selected_ids
      : responseData.selected_id
        ? [responseData.selected_id]
        : [];
    const selectedLabels = options
      .filter((o: any) => selectedIds.includes(o.id))
      .map((o: any) => o.label || o.id);
    const correctLabels = options
      .filter((o: any) => o.is_correct)
      .map((o: any) => o.label || o.id);
    const promptImage = resolveMediaUrl(questionData.prompt_image);

    return (
      <View key={`${qa.questionId}-${index}`} style={ds.answerCard}>
        <View style={[ds.answerCardBanner, { backgroundColor: qa.isCorrect ? '#E8F5E9' : '#FFF3F0' }]}>
          <Text style={ds.answerCardBannerTitle}>Question {index + 1}</Text>
          <Text style={[ds.answerCardBadge, { backgroundColor: qa.isCorrect ? '#4CAF50' : '#FF5252' }]}>
            {qa.isCorrect ? 'Correct' : 'Wrong'}
          </Text>
        </View>
        <View style={ds.answerRow}>
          <Text style={ds.answerTitle}>{qa.questionTitle || 'Question'}</Text>
          {!!qa.questionInstruction && <Text style={ds.chartSub}>{qa.questionInstruction}</Text>}
          {promptImage ? <Image source={{ uri: promptImage }} style={ds.answerPromptImage} resizeMode="contain" /> : null}
          <View style={ds.choiceRow}>
            <Text style={ds.choiceLabel}>Selected:</Text>
            <Text style={ds.choiceValue}>{selectedLabels.length ? selectedLabels.join(', ') : '—'}</Text>
          </View>
          <View style={ds.choiceRow}>
            <Text style={ds.choiceLabel}>Correct:</Text>
            <Text style={[ds.choiceValue, { color: '#1A6B1A' }]}>{correctLabels.length ? correctLabels.join(', ') : '—'}</Text>
          </View>
        </View>
      </View>
    );
  };

  const fmtDuration = (mins: number) => {
    if (!mins) return '–';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`;
  };
  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '–';
  const getDateTimeParts = (iso?: string | null) => {
    if (!iso) return { date: '—', time: '—' };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: '—', time: '—' };
    return {
      date: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
      time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    };
  };

  const TABS: [DetailTab, React.ComponentType<{ size?: number; color?: string }>, string][] = [
    ['overview',  LayoutList, 'Overview'],
    ['students',  Users,      'Students'],
    ['analytics', BarChart2,  'Analytics'],
  ];

  const scoreData = students.map((s) => ({ label: s.name, value: Number(s.avgScore.toFixed(1)) }));
  const quizData  = students.map((s) => ({ label: s.name, value: s.quizzesCompleted }));
  const asnData   = students.map((s) => ({ label: s.name, value: s.assignmentsSubmitted }));
  const STUDENTS_PAGE_SIZE = 10;
  const totalAssignments = classroom?.totalAssignments ?? 0;
  const totalQuizzes = classroom?.totalQuizzes ?? 0;
  const studentFilters: Array<{ key: StudentFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'not_remarked', label: 'Not Remarked' },
    { key: 'remarked', label: 'Remarked' },
    { key: 'task_completed', label: 'Task Completed' },
    { key: 'task_pending', label: 'Task Pending' },
    { key: 'quiz_completed', label: 'Quiz Completed' },
    { key: 'quiz_pending', label: 'Quiz Pending' },
  ];

  const sortedFilteredStudents = students
    .filter((student) => {
      const q = studentSearch.trim().toLowerCase();
      if (!q) return true;
      return `${student.name} ${student.email || ''}`.toLowerCase().includes(q);
    })
    .filter((student) => {
      const hasRemark = Boolean(student.remark?.remarkText || (student.remark?.scorePerformance ?? 0) > 0);
      const taskCompleted = totalAssignments > 0 && student.assignmentsSubmitted >= totalAssignments;
      const taskPending = totalAssignments > 0 && student.assignmentsSubmitted < totalAssignments;
      const quizCompleted = totalQuizzes > 0 && student.quizzesCompleted >= totalQuizzes;
      const quizPending = totalQuizzes > 0 && student.quizzesCompleted < totalQuizzes;

      if (studentFilter === 'not_remarked') return !hasRemark;
      if (studentFilter === 'remarked') return hasRemark;
      if (studentFilter === 'task_completed') return taskCompleted;
      if (studentFilter === 'task_pending') return taskPending;
      if (studentFilter === 'quiz_completed') return quizCompleted;
      if (studentFilter === 'quiz_pending') return quizPending;
      return true;
    })
    .sort((a, b) => {
      const aHasRemark = Boolean(a.remark?.remarkText || (a.remark?.scorePerformance ?? 0) > 0);
      const bHasRemark = Boolean(b.remark?.remarkText || (b.remark?.scorePerformance ?? 0) > 0);
      if (aHasRemark !== bHasRemark) return aHasRemark ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

  const studentTotalPages = Math.max(1, Math.ceil(sortedFilteredStudents.length / STUDENTS_PAGE_SIZE));
  const paginatedStudents = sortedFilteredStudents.slice(
    studentPage * STUDENTS_PAGE_SIZE,
    studentPage * STUDENTS_PAGE_SIZE + STUDENTS_PAGE_SIZE,
  );

  const isLive = classroom?.status === 'active';

  useEffect(() => {
    setStudentPage(0);
  }, [studentSearch, studentFilter, students.length, tab]);

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
                    {sortedFilteredStudents.length} student{sortedFilteredStudents.length !== 1 ? 's' : ''} found
                  </Text>
                </View>
                <TextInput
                  value={studentSearch}
                  onChangeText={setStudentSearch}
                  placeholder="Search student by name or email"
                  placeholderTextColor="#94a3b8"
                  style={ds.studentSearchInput}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ds.studentFilterRow}>
                  {studentFilters.map((filter) => {
                    const active = studentFilter === filter.key;
                    return (
                      <Pressable
                        key={filter.key}
                        style={[ds.studentFilterChip, active && ds.studentFilterChipActive]}
                        onPress={() => setStudentFilter(filter.key)}
                      >
                        <Text style={[ds.studentFilterChipText, active && ds.studentFilterChipTextActive]}>{filter.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {sortedFilteredStudents.length === 0 ? (
                  <View style={ds.emptyWrap}>
                    <View style={ds.emptyIconBox}>
                      <Users size={36} color="#9A9AB0" />
                    </View>
                    <Text style={ds.emptyTitle}>No students yet</Text>
                    <Text style={ds.emptySub}>Students who submit assignments or complete quizzes will appear here.</Text>
                  </View>
                ) : paginatedStudents.map((s) => (
                  <StudentRow
                    key={s.studentId} student={s}
                    totalAssignments={classroom?.totalAssignments ?? 0}
                    totalQuizzes={classroom?.totalQuizzes ?? 0}
                    onRemark={setRemarkStudent}
                    onQuizDetails={(student) => openStudentDetails(student, 'quiz')}
                    onAssignmentDetails={(student) => openStudentDetails(student, 'assignment')}
                  />
                ))}
                {sortedFilteredStudents.length > STUDENTS_PAGE_SIZE && (
                  <View style={ds.studentsPaginationRow}>
                    <Pressable
                      style={[ds.studentsPageBtn, studentPage === 0 && ds.studentsPageBtnDisabled]}
                      onPress={() => setStudentPage((p) => Math.max(0, p - 1))}
                      disabled={studentPage === 0}
                    >
                      <Text style={[ds.studentsPageBtnText, studentPage === 0 && ds.studentsPageBtnTextDisabled]}>Prev</Text>
                    </Pressable>
                    <Text style={ds.studentsPageIndicator}>Page {studentPage + 1} / {studentTotalPages}</Text>
                    <Pressable
                      style={[ds.studentsPageBtn, studentPage >= studentTotalPages - 1 && ds.studentsPageBtnDisabled]}
                      onPress={() => setStudentPage((p) => Math.min(studentTotalPages - 1, p + 1))}
                      disabled={studentPage >= studentTotalPages - 1}
                    >
                      <Text style={[ds.studentsPageBtnText, studentPage >= studentTotalPages - 1 && ds.studentsPageBtnTextDisabled]}>Next</Text>
                    </Pressable>
                  </View>
                )}
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

      <Modal visible={!!detailStudent} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeStudentDetails}>
        <View style={ds.detailModalScreen}>
          <View style={[ds.detailModalHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
            <Pressable onPress={closeStudentDetails} style={ds.backBtn}>
              <ChevronLeft size={24} color="#1a1a2e" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={ds.headerSub}>Student Classroom Details</Text>
              <Text style={ds.headerTitle} numberOfLines={1}>{detailStudent?.name ?? ''}</Text>
            </View>
          </View>

          <View style={ds.detailSwitchRow}>
            <Pressable style={[ds.detailSwitchBtn, detailTab === 'quiz' && ds.detailSwitchBtnActive]} onPress={() => setDetailTab('quiz')}>
              <Text style={[ds.detailSwitchBtnText, detailTab === 'quiz' && ds.detailSwitchBtnTextActive]}>Quiz Attempts</Text>
            </Pressable>
            <Pressable style={[ds.detailSwitchBtn, detailTab === 'assignment' && ds.detailSwitchBtnActive]} onPress={() => setDetailTab('assignment')}>
              <Text style={[ds.detailSwitchBtnText, detailTab === 'assignment' && ds.detailSwitchBtnTextActive]}>Assignment Submissions</Text>
            </Pressable>
          </View>

          {detailLoading ? (
            <View style={ds.centerWrap}>
              <ActivityIndicator size="large" color="#4A90E2" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={ds.content} showsVerticalScrollIndicator={false}>
              {detailTab === 'quiz' ? (
                (studentDetails?.quizzes?.length ?? 0) === 0 ? (
                  <View style={ds.emptyWrap}>
                    <View style={ds.emptyIconBox}>
                      <Trophy size={36} color="#9A9AB0" />
                    </View>
                    <Text style={ds.emptyTitle}>No attempted quizzes</Text>
                    <Text style={ds.emptySub}>This student has not attempted any classroom quiz yet.</Text>
                  </View>
                ) : (
                  selectedQuizAttemptId ? (
                    (() => {
                      const selectedAttempt = studentDetails!.quizzes.find((q) => q.attemptId === selectedQuizAttemptId);
                      if (!selectedAttempt) return null;
                      const selectedAttemptAt = getDateTimeParts(selectedAttempt.completedAt);
                      const selectedAttemptPct = selectedAttempt.totalPoints > 0
                        ? Math.round((selectedAttempt.score / selectedAttempt.totalPoints) * 100)
                        : 0;
                      return (
                        <>
                          <View style={ds.detailCard}>
                            <Pressable style={ds.quizDetailBackRow} onPress={() => setSelectedQuizAttemptId(null)}>
                              <Text style={ds.quizDetailBackText}>← Back to all quizzes</Text>
                            </Pressable>
                            <View style={ds.detailGrid}>
                              <View style={[ds.detailItem, ds.detailItemWide]}>
                                <Text style={ds.detailFieldLabel}>Quiz Title</Text>
                                <Text style={ds.detailFieldValueStrong}>{selectedAttempt.quizTitle}</Text>
                              </View>
                              <View style={ds.detailItem}>
                                <Text style={ds.detailFieldLabel}>Result</Text>
                                <Text style={ds.detailFieldValue}>{selectedAttempt.score}/{selectedAttempt.totalPoints} correct</Text>
                              </View>
                              <View style={ds.detailItem}>
                                <Text style={ds.detailFieldLabel}>Score</Text>
                                <Text style={ds.detailFieldValue}>{selectedAttemptPct}%</Text>
                              </View>
                              <View style={ds.detailItem}>
                                <Text style={ds.detailFieldLabel}>Date</Text>
                                <View style={ds.inlineValueRow}>
                                  <Calendar size={12} color="#64748b" />
                                  <Text style={ds.inlineValueText}>{selectedAttemptAt.date}</Text>
                                </View>
                              </View>
                              <View style={ds.detailItem}>
                                <Text style={ds.detailFieldLabel}>Time</Text>
                                <View style={ds.inlineValueRow}>
                                  <Clock size={12} color="#64748b" />
                                  <Text style={ds.inlineValueText}>{selectedAttemptAt.time}</Text>
                                </View>
                              </View>
                            </View>
                          </View>
                          <View style={ds.detailStack}>
                            {selectedAttempt.questionAttempts.map((qa, idx) => renderAttemptAnswer(qa, idx))}
                          </View>
                        </>
                      );
                    })()
                  ) : studentDetails!.quizzes.map((attempt, idx) => {
                    const attemptAt = getDateTimeParts(attempt.completedAt);
                    const attemptPct = attempt.totalPoints > 0 ? Math.round((attempt.score / attempt.totalPoints) * 100) : 0;
                    return (
                      <Pressable key={attempt.attemptId} style={ds.quizListCard} onPress={() => setSelectedQuizAttemptId(attempt.attemptId)}>
                        <View style={ds.quizAttemptHeader}>
                          <View style={ds.quizAttemptNumber}>
                            <Text style={ds.quizAttemptNumberText}>#{idx + 1}</Text>
                          </View>
                          <View style={ds.quizAttemptContent}>
                            <View style={ds.detailGrid}>
                              <View style={[ds.detailItem, ds.detailItemWide]}>
                                <Text style={ds.detailFieldLabel}>Quiz Title</Text>
                                <Text style={ds.detailFieldValueStrong} numberOfLines={1}>{attempt.quizTitle}</Text>
                              </View>
                              <View style={ds.detailItem}>
                                <Text style={ds.detailFieldLabel}>Result</Text>
                                <Text style={ds.detailFieldValue}>{attempt.score}/{attempt.totalPoints} correct</Text>
                              </View>
                              <View style={ds.detailItem}>
                                <Text style={ds.detailFieldLabel}>Score</Text>
                                <Text style={ds.detailFieldValue}>{attemptPct}%</Text>
                              </View>
                              <View style={ds.detailItem}>
                                <Text style={ds.detailFieldLabel}>Date</Text>
                                <View style={ds.inlineValueRow}>
                                  <Calendar size={12} color="#64748b" />
                                  <Text style={ds.inlineValueText}>{attemptAt.date}</Text>
                                </View>
                              </View>
                              <View style={ds.detailItem}>
                                <Text style={ds.detailFieldLabel}>Time</Text>
                                <View style={ds.inlineValueRow}>
                                  <Clock size={12} color="#64748b" />
                                  <Text style={ds.inlineValueText}>{attemptAt.time}</Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        </View>
                        <View style={ds.quizListViewBtn}>
                          <Text style={ds.quizListViewBtnText}>View Questions</Text>
                        </View>
                      </Pressable>
                    );
                  })
                )
              ) : (
                (studentDetails?.assignments?.length ?? 0) === 0 ? (
                  <View style={ds.emptyWrap}>
                    <View style={ds.emptyIconBox}>
                      <ClipboardList size={36} color="#9A9AB0" />
                    </View>
                    <Text style={ds.emptyTitle}>No assignments</Text>
                    <Text style={ds.emptySub}>No assignment records found for this student in this classroom.</Text>
                  </View>
                ) : (
                  studentDetails!.assignments.map((item) => {
                    const description = item.description?.trim() || '';
                    const instructions = item.instructions?.trim() || '';
                    const showDescription = !!description && description.toLowerCase() !== (item.title || '').trim().toLowerCase();
                    const showInstructions = !!instructions
                      && instructions.toLowerCase() !== (item.title || '').trim().toLowerCase()
                      && instructions.toLowerCase() !== description.toLowerCase();
                    const submittedAt = getDateTimeParts(item.submittedAt);
                    const submissionText = item.submissionText?.trim() || '';
                    return (
                      <View key={item.assignmentId} style={ds.detailCard}>
                        <View style={ds.detailGrid}>
                          <View style={[ds.detailItem, ds.detailItemWide]}>
                            <Text style={ds.detailFieldLabel}>Assignment Title</Text>
                            <Text style={ds.detailFieldValueStrong}>{item.title}</Text>
                          </View>
                          {showDescription && (
                            <View style={[ds.detailItem, ds.detailItemWide]}>
                              <Text style={ds.detailFieldLabel}>Assignment Description</Text>
                              <Text style={ds.detailFieldValue}>{description}</Text>
                            </View>
                          )}
                          {showInstructions && (
                            <View style={[ds.detailItem, ds.detailItemWide]}>
                              <Text style={ds.detailFieldLabel}>Teacher Instructions</Text>
                              <Text style={ds.detailFieldValue}>{instructions}</Text>
                            </View>
                          )}
                          {item.submittedAt ? (
                            <>
                              <View style={ds.detailItem}>
                                <Text style={ds.detailFieldLabel}>Date</Text>
                                <View style={ds.inlineValueRow}>
                                  <Calendar size={12} color="#64748b" />
                                  <Text style={ds.inlineValueText}>{submittedAt.date}</Text>
                                </View>
                              </View>
                              <View style={ds.detailItem}>
                                <Text style={ds.detailFieldLabel}>Time</Text>
                                <View style={ds.inlineValueRow}>
                                  <Clock size={12} color="#64748b" />
                                  <Text style={ds.inlineValueText}>{submittedAt.time}</Text>
                                </View>
                              </View>
                              <View style={[ds.detailItem, ds.detailItemWide]}>
                                <Text style={ds.detailFieldLabel}>Student Written Submission</Text>
                                <Text style={submissionText ? ds.submissionText : ds.detailFieldValue}>
                                  {submissionText || 'No written response submitted by student.'}
                                </Text>
                              </View>
                              {!!item.attachmentUrl && (
                                <View style={[ds.detailItem, ds.detailItemWide]}>
                                  <Text style={ds.detailFieldLabel}>Student Attachment</Text>
                                  {/\.(png|jpg|jpeg|gif|webp)$/i.test(item.attachmentUrl) ? (
                                    <Image source={{ uri: item.attachmentUrl }} style={ds.assignmentPreviewImage} resizeMode="cover" />
                                  ) : null}
                                  <Pressable style={[ds.secondaryActionBtn, ds.attachmentBtn]} onPress={() => openAttachment(item.attachmentUrl)}>
                                    <Text style={ds.secondaryActionBtnText}>Download Attachment</Text>
                                  </Pressable>
                                </View>
                              )}
                            </>
                          ) : (
                            <View style={[ds.detailItem, ds.detailItemWide, ds.notSubmittedCard]}>
                              <SvgXml xml={OWL} width={64} height={64} />
                              <Text style={ds.notSubmittedTitle}>Not submitted yet</Text>
                              <Text style={ds.notSubmittedSub}>
                                This student has not submitted this assignment yet.
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })
                )
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

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
  studentSearchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1e293b',
    marginBottom: 10,
  },
  studentFilterRow: { gap: 8, paddingRight: 8, marginBottom: 10 },
  studentFilterChip: { borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 7 },
  studentFilterChipActive: { backgroundColor: '#D6EAFF', borderColor: '#9BC6FF' },
  studentFilterChipText: { fontSize: 11, fontWeight: '700', color: '#5A6A8A' },
  studentFilterChipTextActive: { color: '#1A4DA2' },
  studentsPaginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 4 },
  studentsPageBtn: { backgroundColor: '#EBF4FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 70, alignItems: 'center' },
  studentsPageBtnDisabled: { backgroundColor: '#F1F5F9' },
  studentsPageBtnText: { fontSize: 12, fontWeight: '800', color: '#1A4DA2' },
  studentsPageBtnTextDisabled: { color: '#94a3b8' },
  studentsPageIndicator: { fontSize: 12, fontWeight: '700', color: '#64748b' },

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
  studentActionRow:   { flexDirection: 'row', gap: 8, marginTop: 10 },
  secondaryActionBtn: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#D6EAFF', backgroundColor: '#EBF4FF', paddingVertical: 8, paddingHorizontal: 6, minHeight: 36, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  secondaryActionBtnFilled: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  secondaryActionBtnText: { fontSize: 11, fontWeight: '800', color: '#1A4DA2', textAlign: 'center', lineHeight: 14 },
  secondaryActionBtnTextFilled: { color: '#fff' },
  remarkActionBtn: { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' },
  remarkActionBtnFilled: { backgroundColor: '#C2410C', borderColor: '#C2410C' },
  remarkActionBtnText: { color: '#9A3412' },

  detailModalScreen: { flex: 1, backgroundColor: '#F5F7FF' },
  detailModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  detailSwitchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  detailSwitchBtn: { flex: 1, borderRadius: 999, backgroundColor: '#F0F0F8', paddingVertical: 8, alignItems: 'center' },
  detailSwitchBtnActive: { backgroundColor: '#D6EAFF' },
  detailSwitchBtnText: { fontSize: 12, fontWeight: '700', color: '#5A6A8A' },
  detailSwitchBtnTextActive: { color: '#1A4DA2' },
  detailCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 12, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  detailStack: { gap: 12 },
  detailFieldBlock: { marginTop: 2 },
  quizAttemptHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  quizAttemptContent: { flex: 1 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 10 },
  detailItem: { flexBasis: '48%', flexGrow: 1, minWidth: 130 },
  detailItemWide: { flexBasis: '100%' },
  quizAttemptNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  quizAttemptNumberText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  quizListCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 12, gap: 10, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  quizListMeta: { fontSize: 11, color: '#475569', marginTop: 1, lineHeight: 16, fontWeight: '700' },
  detailFieldLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 2 },
  detailFieldValue: { fontSize: 12, color: '#475569', lineHeight: 18 },
  detailFieldValueStrong: { fontSize: 13, color: '#1f2937', lineHeight: 19, fontWeight: '800' },
  inlineValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 20 },
  inlineValueText: { fontSize: 12, color: '#334155', fontWeight: '700', flexShrink: 1 },
  dateTimeStack: { gap: 6, marginTop: 6, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 7 },
  dateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateTimeLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', minWidth: 34 },
  dateTimeValue: { fontSize: 10, color: '#334155', fontWeight: '700', flexShrink: 1 },
  quizListScoreBadge: { borderRadius: 999, backgroundColor: '#EBF4FF', paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', marginTop: 2 },
  quizListScoreText: { fontSize: 11, fontWeight: '900', color: '#1A4DA2' },
  quizListViewBtn: { borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 8, alignItems: 'center', marginTop: 2 },
  quizListViewBtnText: { fontSize: 11, fontWeight: '800', color: '#1A4DA2' },
  quizDetailBackRow: { marginBottom: 10, alignSelf: 'flex-start' },
  quizDetailBackText: { fontSize: 12, fontWeight: '800', color: '#1A4DA2' },
  answerCard: { borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', backgroundColor: '#fff' },
  answerCardBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8 },
  answerCardBannerTitle: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  answerCardBadge: { color: '#fff', fontSize: 11, fontWeight: '900', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4 },
  answerRow: { backgroundColor: '#F8F9FF', borderRadius: 10, padding: 12, gap: 6 },
  answerTitle: { fontSize: 12, fontWeight: '800', color: '#1a1a2e' },
  answerStatus: { fontSize: 11, fontWeight: '800' },
  answerPayload: { fontSize: 11, color: '#334155', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  answerPromptImage: { width: '100%', height: 130, borderRadius: 8, backgroundColor: '#E2E8F0', marginTop: 4 },
  choiceRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  choiceLabel: { fontSize: 11, fontWeight: '800', color: '#334155', minWidth: 56 },
  choiceValue: { fontSize: 11, color: '#1e293b', flex: 1 },
  // Memory Match styles
  mmChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  mmChipTxt: { fontSize: 12, fontWeight: '700' },
  mmBarLabel: { fontSize: 10, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.4 },
  mmBoardLabel: { fontSize: 10, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 },
  mmCard: { borderRadius: 12, borderWidth: 2, padding: 8, alignItems: 'center', gap: 4 },
  mmCardImg: { width: 56, height: 56 },
  mmCardLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  mmCardBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  mmCardBadgeTxt: { fontSize: 12, color: '#fff', fontWeight: '900' },
  mmSentenceBox: { borderWidth: 1.5, borderRadius: 10, padding: 12, backgroundColor: '#FAFAFA' },
  mmSentenceTxt: { fontSize: 14, color: '#374151', lineHeight: 22 },
  mmBlankFilled: { fontWeight: '900', borderRadius: 4, overflow: 'hidden' },
  mappingTable: { marginTop: 6, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, overflow: 'hidden' },
  mappingRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 6, gap: 6 },
  mappingSlot: { width: 20, fontSize: 11, fontWeight: '900', color: '#334155', textAlign: 'center' },
  mappingLabel: { flex: 1, fontSize: 10, color: '#475569' },
  mappingSelected: { flex: 1, fontSize: 10, color: '#1e293b', fontWeight: '700' },
  mappingExpected: { flex: 1, fontSize: 10, color: '#1A6B1A', fontWeight: '700' },
  assignmentAttachmentWrap: { gap: 10, marginTop: 12 },
  attachmentBtn: { marginTop: 8, minHeight: 34 },
  notSubmittedCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 6,
  },
  notSubmittedTitle: { fontSize: 13, fontWeight: '800', color: '#334155' },
  notSubmittedSub: { fontSize: 11, color: '#64748b', textAlign: 'center', lineHeight: 16, maxWidth: 240 },
  submissionBox: { marginTop: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12 },
  submissionText: { fontSize: 12, color: '#334155', lineHeight: 18 },
  assignmentPreviewImage: { width: '100%', height: 160, borderRadius: 10, backgroundColor: '#E2E8F0' },

  // Table
  tableCard:    { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F8' },
  tableHeader:  { flexDirection: 'row', backgroundColor: '#1A3A6B', padding: 10 },
  tableRow:     { flexDirection: 'row', padding: 10 },
  tableRowAlt:  { backgroundColor: '#F8F9FF' },
  tableCell:    { flex: 1, fontSize: 12, color: '#5A6A8A', fontWeight: '600', textAlign: 'center' },
});
