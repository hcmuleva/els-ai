import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  GraduationCap,
  Printer,
  Sparkles,
  TrendingUp,
  User,
  X,
} from 'lucide-react-native';
import { Colors, Radius, Shadow, Spacing } from '../../theme';
import type { StudentPerformanceSummaryData } from '../../services/aiChat';

interface StudentReportCardModalProps {
  visible: boolean;
  data: StudentPerformanceSummaryData | null;
  onClose: () => void;
  onDraftRemedialQuiz?: (prompt: string) => void;
}

export function StudentReportCardModal({
  visible,
  data,
  onClose,
  onDraftRemedialQuiz,
}: StudentReportCardModalProps) {
  const [copied, setCopied] = useState(false);

  if (!visible || !data) return null;

  const { student, metrics, jevDiagnosis } = data;
  const avg = metrics.averageScorePct;

  const letterGrade =
    avg >= 90
      ? 'A+'
      : avg >= 80
      ? 'A'
      : avg >= 70
      ? 'B'
      : avg >= 60
      ? 'C'
      : avg >= 45
      ? 'D'
      : 'E';

  const isHigh = avg >= 80;
  const isMid = avg >= 60 && avg < 80;
  const isLow = avg < 60;

  const standingBg = isHigh
    ? '#ECFDF5'
    : isMid
    ? '#EFF6FF'
    : avg >= 45
    ? '#FFFBEB'
    : '#FEF2F2';
  const standingColor = isHigh
    ? '#059669'
    : isMid
    ? '#2563EB'
    : avg >= 45
    ? '#D97706'
    : '#DC2626';

  const riskLabel =
    jevDiagnosis.riskScore === 0
      ? 'Low Risk (0/3)'
      : jevDiagnosis.riskScore === 1
      ? 'Moderate Risk (1/3)'
      : jevDiagnosis.riskScore === 2
      ? 'High Risk (2/3)'
      : 'Critical Risk (3/3)';

  const formattedDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const fullReportText = `ACADEMIC PERFORMANCE & DIAGNOSTIC REPORT CARD
Generated: ${formattedDate}
---------------------------------------------
STUDENT INFORMATION:
- Name: ${student.name}
- Grade / Class: ${student.classLevel ? `Grade ${student.classLevel}` : 'Not Specified'}
- Email: ${student.email || 'N/A'}

ACADEMIC EVALUATION:
- Overall Accuracy: ${avg}% (Grade: ${letterGrade})
- Total Quizzes Attempted: ${metrics.totalQuizzes}
- Academic Standing: ${jevDiagnosis.masteryTier}
- Struggle Risk Level: ${riskLabel}

PERFORMANCE HIGHLIGHTS:
- Best Performed Quiz: ${metrics.bestQuiz ? `${metrics.bestQuiz.title} (${metrics.bestQuiz.scorePct}%)` : 'None logged'}
- Lowest Quizzes: ${metrics.lowestQuizzes?.length ? metrics.lowestQuizzes.map((q) => `${q.title} (${q.scorePct}%)`).join(', ') : 'None'}

IDENTIFIED LEARNING GAPS:
${metrics.weakQuestions?.length ? metrics.weakQuestions.map((w, idx) => `${idx + 1}. ${w.title} (${w.missedCount}x missed)`).join('\n') : 'No recurring question gaps recorded.'}

CLASSROOM OBSERVATIONS & REMARKS:
${metrics.latestRemarks?.length ? metrics.latestRemarks.map((r, idx) => `${idx + 1}. "${r.remark}" (Rating: ${r.category}/5)`).join('\n') : 'No teacher remarks recorded.'}

RECOMMENDED ACTION PLAN:
- Primary Gap Domain: ${jevDiagnosis.primaryWeakDomain || 'Foundational Practice'}
- Pedagogical Intervention: ${jevDiagnosis.recommendedIntervention || 'Assign targeted practice'}
`;

  const handleCopy = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullReportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.card}>
          {/* ── Modal Top Header ───────────────────────────── */}
          <View style={s.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.reportIconBox}>
                <GraduationCap size={20} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <View>
                <Text style={s.reportHeaderTitle}>Academic Report Card</Text>
                <Text style={s.reportHeaderSub}>Verified Database Metrics & Diagnostic Evaluation</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                style={({ pressed }) => [s.actionHeaderBtn, pressed && { opacity: 0.7 }]}
                onPress={handleCopy}
                accessibilityRole="button"
                accessibilityLabel="Copy report text"
              >
                {copied ? <Check size={14} color={Colors.success} /> : <Copy size={14} color={Colors.textSecondary} />}
                <Text style={s.actionHeaderBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>

              {Platform.OS === 'web' && (
                <Pressable
                  style={({ pressed }) => [s.actionHeaderBtn, pressed && { opacity: 0.7 }]}
                  onPress={handlePrint}
                  accessibilityRole="button"
                  accessibilityLabel="Print report card"
                >
                  <Printer size={14} color={Colors.textSecondary} />
                  <Text style={s.actionHeaderBtnText}>Print</Text>
                </Pressable>
              )}

              <Pressable style={s.closeBtn} onPress={onClose} accessibilityLabel="Close report card">
                <X size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* ── Scrollable Report Card Body ────────────────── */}
          <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Student Profile Header Banner */}
            <View style={s.profileBanner}>
              <View style={s.studentAvatarBox}>
                <User size={26} color={Colors.primary} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.studentName}>{student.name}</Text>
                  {student.classLevel && (
                    <View style={s.gradePill}>
                      <Text style={s.gradePillText}>Grade {student.classLevel}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.studentEmail}>{student.email || 'ELS Student Profile'}</Text>
              </View>

              <View style={s.dateBox}>
                <Text style={s.dateLabel}>Date</Text>
                <Text style={s.dateValue}>{formattedDate}</Text>
              </View>
            </View>

            {/* Score & Standing Summary Hero */}
            <View style={s.heroRow}>
              <View style={s.gradeBox}>
                <Text style={s.gradeLetter}>{letterGrade}</Text>
                <Text style={s.gradeSub}>Grade Rating</Text>
              </View>

              <View style={s.heroStatsColumn}>
                <View style={s.heroStatItem}>
                  <Text style={s.heroStatLabel}>Overall Accuracy</Text>
                  <Text style={[s.heroStatValue, { color: standingColor }]}>{avg}%</Text>
                </View>

                <View style={s.heroStatDivider} />

                <View style={s.heroStatItem}>
                  <Text style={s.heroStatLabel}>Total Quizzes</Text>
                  <Text style={s.heroStatValue}>{metrics.totalQuizzes}</Text>
                </View>

                <View style={s.heroStatDivider} />

                <View style={s.heroStatItem}>
                  <Text style={s.heroStatLabel}>Struggle Risk</Text>
                  <Text style={[s.heroStatValue, { color: standingColor }]}>
                    {jevDiagnosis.riskScore}/3
                  </Text>
                </View>
              </View>
            </View>

            {/* Standing Pill Banner */}
            <View style={[s.standingBanner, { backgroundColor: standingBg }]}>
              <Award size={16} color={standingColor} />
              <Text style={[s.standingText, { color: standingColor }]}>
                Academic Standing: <Text style={{ fontWeight: '800' }}>{jevDiagnosis.masteryTier}</Text> ({riskLabel})
              </Text>
            </View>

            {/* Section: Academic Strengths & Best Quizzes */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeader}>
                <Award size={16} color={Colors.primary} />
                <Text style={s.sectionTitle}>Academic Strengths & Highest Score</Text>
              </View>
              {metrics.bestQuiz ? (
                <View style={s.quizHighlightRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.quizHighlightTitle}>{metrics.bestQuiz.title}</Text>
                    <Text style={s.quizHighlightSub}>Highest verified assessment score</Text>
                  </View>
                  <View style={s.scoreBadgeGreen}>
                    <Text style={s.scoreBadgeGreenText}>{metrics.bestQuiz.scorePct}%</Text>
                  </View>
                </View>
              ) : (
                <Text style={s.emptyNotice}>No completed quizzes logged yet.</Text>
              )}
            </View>

            {/* Section: Identified Learning Gaps */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeader}>
                <AlertTriangle size={16} color="#D97706" />
                <Text style={s.sectionTitle}>Learning Gaps & Recurring Missed Questions</Text>
              </View>
              {metrics.weakQuestions && metrics.weakQuestions.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {metrics.weakQuestions.map((q, idx) => (
                    <View key={idx} style={s.weakQuestionItem}>
                      <View style={s.bulletCircle}>
                        <Text style={s.bulletText}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.weakQuestionTitle}>{q.title}</Text>
                        <Text style={s.weakQuestionCount}>Missed {q.missedCount} time{q.missedCount !== 1 ? 's' : ''} in practice</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={s.noGapsRow}>
                  <CheckCircle2 size={16} color={Colors.success} />
                  <Text style={s.noGapsText}>No critical learning gaps or repeated errors identified.</Text>
                </View>
              )}
            </View>

            {/* Section: Classroom Observations & Teacher Remarks */}
            {metrics.latestRemarks && metrics.latestRemarks.length > 0 && (
              <View style={s.sectionCard}>
                <View style={s.sectionHeader}>
                  <BookOpen size={16} color={Colors.purple || '#7C3AED'} />
                  <Text style={s.sectionTitle}>Classroom Observations & Remarks</Text>
                </View>
                <View style={{ gap: 8 }}>
                  {metrics.latestRemarks.map((rem, idx) => (
                    <View key={idx} style={s.remarkRow}>
                      <Text style={s.remarkQuote}>"{rem.remark}"</Text>
                      <View style={s.remarkMeta}>
                        <Text style={s.remarkScore}>Performance Rating: {rem.category}/5</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Section: Recommended Pedagogical Action Plan */}
            <View style={s.actionPlanCard}>
              <View style={s.actionPlanHeader}>
                <Sparkles size={16} color={Colors.primary} />
                <Text style={s.actionPlanTitle}>Recommended Action Plan</Text>
              </View>
              <View style={s.actionPlanBody}>
                <View style={s.actionPlanField}>
                  <Text style={s.actionPlanFieldLabel}>Primary Domain:</Text>
                  <Text style={s.actionPlanFieldValue}>{jevDiagnosis.primaryWeakDomain || 'Foundational Practice'}</Text>
                </View>
                <View style={s.actionPlanField}>
                  <Text style={s.actionPlanFieldLabel}>Pedagogical Action:</Text>
                  <Text style={s.actionPlanFieldValue}>{jevDiagnosis.recommendedIntervention || 'Targeted 5-question review'}</Text>
                </View>
              </View>

              {onDraftRemedialQuiz && (
                <Pressable
                  style={({ pressed }) => [s.remedialQuizBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => {
                    onClose();
                    onDraftRemedialQuiz(
                      `Draft a 5-question remedial practice quiz for ${student.name} targeting ${jevDiagnosis.primaryWeakDomain || 'their learning gaps'}`
                    );
                  }}
                  accessibilityRole="button"
                >
                  <Sparkles size={15} color="#FFFFFF" />
                  <Text style={s.remedialQuizBtnText}>Draft Remedial Quiz for {student.firstName || student.name}</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>

          {/* ── Modal Footer ───────────────────────────────── */}
          <View style={s.modalFooter}>
            <Text style={s.footerDisclaimer}>
              Verified educational diagnostic report • Generated by ELS AI Academic Engine
            </Text>
            <Pressable style={s.footerDoneBtn} onPress={onClose}>
              <Text style={s.footerDoneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    overflow: 'hidden',
    ...Shadow.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
    backgroundColor: '#FFFFFF',
  },
  reportIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight || '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  reportHeaderSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  actionHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  actionHeaderBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.sm,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    gap: 16,
  },
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  studentAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight || '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  studentEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  gradePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  gradePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  dateBox: {
    alignItems: 'flex-end',
  },
  dateLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  dateValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 2,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gradeBox: {
    width: 90,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    ...Shadow.sm,
  },
  gradeLetter: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 36,
  },
  gradeSub: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  heroStatsColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    paddingVertical: 12,
    ...Shadow.sm,
  },
  heroStatItem: {
    alignItems: 'center',
  },
  heroStatLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 4,
  },
  heroStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E8ECF4',
  },
  standingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  standingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 14,
    ...Shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  quizHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  quizHighlightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  quizHighlightSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scoreBadgeGreen: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  scoreBadgeGreenText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  emptyNotice: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  weakQuestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  bulletCircle: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bulletText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  weakQuestionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 16,
  },
  weakQuestionCount: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '500',
    marginTop: 2,
  },
  noGapsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  noGapsText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '500',
  },
  remarkRow: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  remarkQuote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.text,
    lineHeight: 18,
  },
  remarkMeta: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  remarkScore: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  actionPlanCard: {
    backgroundColor: '#FAFCFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 14,
    ...Shadow.sm,
  },
  actionPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  actionPlanTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  actionPlanBody: {
    gap: 6,
    marginBottom: 12,
  },
  actionPlanField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionPlanFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  actionPlanFieldValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  remedialQuizBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 10,
    ...Shadow.sm,
  },
  remedialQuizBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8ECF4',
    backgroundColor: '#F8FAFC',
  },
  footerDisclaimer: {
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
    marginRight: 12,
  },
  footerDoneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
  },
  footerDoneBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
