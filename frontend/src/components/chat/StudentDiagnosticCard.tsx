import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Award, AlertTriangle, FileText, Sparkles, User, ArrowRight } from 'lucide-react-native';
import { Colors, Radius, Shadow, Spacing } from '../../theme';
import type { StudentPerformanceSummaryData } from '../../services/aiChat';

interface StudentDiagnosticCardProps {
  data: StudentPerformanceSummaryData;
  onActionPress?: (prompt: string) => void;
  onOpenReportCard?: () => void;
}

export function StudentDiagnosticCard({ data, onActionPress, onOpenReportCard }: StudentDiagnosticCardProps) {
  const { student, metrics, jevDiagnosis } = data;
  const avg = metrics.averageScorePct;

  const isHigh = avg >= 80;
  const isMid = avg >= 60 && avg < 80;
  const isSupport = avg >= 40 && avg < 60;

  const tierBg = isHigh
    ? '#ECFDF5'
    : isMid
    ? '#EFF6FF'
    : isSupport
    ? '#FFFBEB'
    : '#FEF2F2';
  const tierColor = isHigh
    ? '#059669'
    : isMid
    ? '#2563EB'
    : isSupport
    ? '#D97706'
    : '#DC2626';

  const riskLabel =
    jevDiagnosis.riskScore === 0
      ? 'Low (0/3)'
      : jevDiagnosis.riskScore === 1
      ? 'Moderate (1/3)'
      : jevDiagnosis.riskScore === 2
      ? 'High (2/3)'
      : 'Critical (3/3)';

  return (
    <View style={s.card}>
      {/* ── Header ────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.avatarBox}>
          <User size={16} color={Colors.primary} strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{student.name}</Text>
            {student.classLevel ? (
              <View style={s.gradePill}>
                <Text style={s.gradePillText}>Grade {student.classLevel}</Text>
              </View>
            ) : null}
          </View>
          <Text style={s.subtext}>Verified Database Records & Diagnostic Analysis</Text>
        </View>
        <View style={[s.tierPill, { backgroundColor: tierBg }]}>
          <Text style={[s.tierPillText, { color: tierColor }]}>{jevDiagnosis.masteryTier}</Text>
        </View>
      </View>

      {/* ── Metric Highlights Grid ────────────────────────── */}
      <View style={s.metricsRow}>
        <View style={s.metricBox}>
          <Text style={s.metricLabel}>Total Quizzes</Text>
          <Text style={s.metricValue}>{metrics.totalQuizzes}</Text>
        </View>
        <View style={s.metricDivider} />
        <View style={s.metricBox}>
          <Text style={s.metricLabel}>Avg Accuracy</Text>
          <Text style={[s.metricValue, { color: tierColor }]}>{metrics.averageScorePct}%</Text>
        </View>
        <View style={s.metricDivider} />
        <View style={s.metricBox}>
          <Text style={s.metricLabel}>Academic Risk</Text>
          <Text style={[s.metricValue, { color: tierColor }]}>
            {riskLabel}
          </Text>
        </View>
      </View>

      {/* ── Best Quiz Highlight ───────────────────────────── */}
      {metrics.bestQuiz ? (
        <View style={s.highlightCard}>
          <View style={s.highlightIconBoxGold}>
            <Award size={14} color="#D97706" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.highlightLabel}>Highest Scored Assessment</Text>
            <Text style={s.highlightTitle} numberOfLines={1}>{metrics.bestQuiz.title}</Text>
          </View>
          <View style={s.scoreBadgeGreen}>
            <Text style={s.scoreBadgeGreenText}>{metrics.bestQuiz.scorePct}%</Text>
          </View>
        </View>
      ) : null}

      {/* ── Learning Gaps / Weak Areas ────────────────────── */}
      {metrics.weakQuestions.length > 0 ? (
        <View style={s.weakSection}>
          <View style={s.weakHeader}>
            <AlertTriangle size={13} color="#D97706" />
            <Text style={s.weakSectionTitle}>Recurring Learning Gaps</Text>
          </View>
          {metrics.weakQuestions.slice(0, 2).map((wq, idx) => (
            <View key={idx} style={s.weakItem}>
              <Text style={s.weakBullet}>•</Text>
              <Text style={s.weakText} numberOfLines={1}>
                {wq.title} <Text style={s.weakCount}>({wq.missedCount}x missed)</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── Diagnostic Action Plan ────────────────────────── */}
      <View style={s.actionPlanBox}>
        <View style={s.actionPlanHeader}>
          <Sparkles size={13} color={Colors.primary} />
          <Text style={s.actionPlanTitle}>Diagnostic Action Plan</Text>
        </View>
        <Text style={s.actionPlanText}>
          <Text style={{ fontWeight: '700', color: Colors.text }}>Intervention: </Text>
          {jevDiagnosis.recommendedIntervention}
        </Text>
      </View>

      {/* ── Action Buttons ────────────────────────────────── */}
      <View style={s.btnRow}>
        {onOpenReportCard && (
          <Pressable
            style={({ pressed }) => [s.reportCardBtn, pressed && { opacity: 0.85 }]}
            onPress={onOpenReportCard}
            accessibilityRole="button"
            accessibilityLabel="View full report card"
          >
            <FileText size={14} color={Colors.primary} />
            <Text style={s.reportCardBtnText}>View Report Card</Text>
          </Pressable>
        )}

        {onActionPress && (
          <Pressable
            style={({ pressed }) => [s.remedialBtn, pressed && { opacity: 0.85 }]}
            onPress={() =>
              onActionPress(
                `Draft a 5-question remedial quiz for ${student.name} targeting ${jevDiagnosis.primaryWeakDomain || 'their weak areas'}.`
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Draft remedial quiz"
          >
            <Sparkles size={14} color="#FFFFFF" />
            <Text style={s.remedialBtnText}>Draft Remedial Quiz</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 14,
    gap: 12,
    ...Shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarBox: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight || '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  gradePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  gradePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  subtext: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  tierPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  tierPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metricBox: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E8ECF4',
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FAFCFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 10,
  },
  highlightIconBoxGold: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  highlightTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  scoreBadgeGreen: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  scoreBadgeGreenText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  weakSection: {
    backgroundColor: '#FFFDF9',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 10,
    gap: 4,
  },
  weakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  weakSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  weakItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weakBullet: {
    color: '#D97706',
    fontWeight: '800',
  },
  weakText: {
    fontSize: 11,
    color: Colors.text,
    flex: 1,
  },
  weakCount: {
    color: '#DC2626',
    fontWeight: '600',
  },
  actionPlanBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 10,
    gap: 4,
  },
  actionPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionPlanTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  actionPlanText: {
    fontSize: 11,
    color: Colors.text,
    lineHeight: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reportCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radius.md,
    paddingVertical: 9,
    ...Shadow.sm,
  },
  reportCardBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  remedialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 9,
    ...Shadow.sm,
  },
  remedialBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
