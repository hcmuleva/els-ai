import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Award,
  BookOpen,
  CheckCircle,
  HelpCircle,
  MessageCircle,
  Sparkles,
  TrendingUp,
  UserCheck,
} from 'lucide-react-native';
import { Colors, Radius, Shadow, Spacing } from '../../theme';

export type Role = 'child' | 'parent' | 'teacher' | 'admin' | 'superadmin';

export interface PerformanceReportViewProps {
  role: Role;
  studentId: string;
  studentName?: string;
  onAskAiQuestion?: (query: string) => void;
  onContactTeacher?: () => void;
  onAnnotate?: () => void;
}

export function PerformanceReportView({
  role,
  studentId,
  studentName = 'Student',
  onAskAiQuestion,
  onContactTeacher,
  onAnnotate,
}: PerformanceReportViewProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const quickPrompts =
    role === 'child'
      ? ['How am I doing on quizzes?', 'What story should I read?', 'My learning streak!']
      : role === 'parent'
      ? ['Explain reading progress', 'Math accuracy breakdown', 'Focus & classroom routine']
      : ['Classroom percentile rank', 'Flagged survey notes', 'Recommend intervention'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Role Scope Banner ─────────────────────────────── */}
      <View style={styles.scopeBanner}>
        <View style={styles.scopeInfo}>
          <Text style={styles.scopeRoleBadge}>
            {role === 'child' ? 'My Progress' : role === 'parent' ? 'Parent View' : 'Teacher Diagnostic'}
          </Text>
          <Text style={styles.scopeTitle}>
            {role === 'child' ? 'Your Learning Journey' : `Performance Report: ${studentName}`}
          </Text>
        </View>

        {/* Quick action buttons per role */}
        <View style={styles.actionButtons}>
          {role === 'parent' && onContactTeacher && (
            <Pressable
              onPress={onContactTeacher}
              style={styles.actionBtnSecondary}
              accessibilityLabel="Message Teacher"
              accessibilityRole="button"
            >
              <MessageCircle size={15} color={Colors.primary} />
              <Text style={styles.actionBtnTextSecondary}>Teacher</Text>
            </Pressable>
          )}

          {(role === 'teacher' || role === 'admin') && onAnnotate && (
            <Pressable
              onPress={onAnnotate}
              style={styles.actionBtnSecondary}
              accessibilityLabel="Add Annotation"
              accessibilityRole="button"
            >
              <UserCheck size={15} color={Colors.primary} />
              <Text style={styles.actionBtnTextSecondary}>Annotate</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Section 1: Overview Cards ─────────────────────── */}
      <Text style={styles.sectionHeader}>Overview</Text>
      <View style={[styles.grid, isWide && styles.gridWide]}>
        <View style={[styles.card, isWide && styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: '#EEF2FF' }]}>
              <Award size={18} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Quiz Accuracy</Text>
          </View>
          <Text style={styles.statValue}>88.5%</Text>
          <Text style={styles.statSubtext}>Based on 14 recent module assessments</Text>
          <View style={styles.badgePillSuccess}>
            <Text style={styles.badgePillTextSuccess}>Consistent High Mastery</Text>
          </View>
        </View>

        <View style={[styles.card, isWide && styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: '#FEF3C7' }]}>
              <TrendingUp size={18} color="#D97706" />
            </View>
            <Text style={styles.cardTitle}>Weekly Activity</Text>
          </View>
          <Text style={styles.statValue}>5 Days</Text>
          <Text style={styles.statSubtext}>Active reading & exercise streak</Text>
          <View style={styles.badgePillWarning}>
            <Text style={styles.badgePillTextWarning}>+2 days vs last week</Text>
          </View>
        </View>
      </View>

      {/* ── Section 2: Strengths & Weaknesses ─────────────── */}
      <View style={[styles.grid, isWide && styles.gridWide, { marginTop: Spacing.md }]}>
        {/* Strengths */}
        <View style={[styles.card, isWide && styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: Colors.successLight }]}>
              <CheckCircle size={18} color={Colors.success} />
            </View>
            <Text style={styles.cardTitle}>Key Strengths</Text>
          </View>
          <View style={styles.bulletList}>
            <View style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.bold}>Story Comprehension:</Text> Retains character motives and context reliably.
              </Text>
            </View>
            <View style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.bold}>Curiosity & Inquisitiveness:</Text> High engagement during interactive quizzes.
              </Text>
            </View>
          </View>
        </View>

        {/* Areas for Growth / Weaknesses */}
        <View style={[styles.card, isWide && styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: Colors.errorLight }]}>
              <HelpCircle size={18} color={Colors.error} />
            </View>
            <Text style={styles.cardTitle}>Focus Areas</Text>
          </View>
          <View style={styles.bulletList}>
            <View style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.bold}>Phonics Differentiation:</Text> Occasional hesitation between 'b' and 'd' letters.
              </Text>
            </View>
            <View style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.bold}>Sustained Task Duration:</Text> Breaks needed after 15–20 minutes of continuous study.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Section 3: Recommendations ───────────────────── */}
      <Text style={[styles.sectionHeader, { marginTop: Spacing.lg }]}>Recommendations</Text>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconBox, { backgroundColor: '#EDE4FF' }]}>
            <BookOpen size={18} color={Colors.purple} />
          </View>
          <Text style={styles.cardTitle}>AI-Guided Action Plan</Text>
        </View>
        <Text style={styles.recommendationText}>
          {role === 'child'
            ? 'Awesome job! Keep exploring read-along stories for 10 minutes today to earn your next badge!'
            : role === 'parent'
            ? 'Practice gentle letter-tracing games for 5 minutes before reading. Encourage short, frequent breaks during math homework.'
            : 'Highlight phonics worksheets in small-group reading rotations. Re-assess attention span during morning learning blocks.'}
        </Text>
      </View>

      {/* ── Deep-Dive Prompt Chips ────────────────────────── */}
      {onAskAiQuestion && (
        <View style={styles.deepDiveBox}>
          <View style={styles.deepDiveHeader}>
            <Sparkles size={16} color={Colors.primary} />
            <Text style={styles.deepDiveTitle}>Ask AI Deep-Dive Questions</Text>
          </View>
          <View style={styles.chipWrap}>
            {quickPrompts.map((prompt, idx) => (
              <Pressable
                key={idx}
                onPress={() => onAskAiQuestion(prompt)}
                style={({ pressed }) => [
                  styles.promptChip,
                  pressed && styles.promptChipPressed,
                ]}
                accessibilityLabel={prompt}
                accessibilityRole="button"
              >
                <Text style={styles.promptChipText}>{prompt}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  scopeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  scopeInfo: {
    gap: 4,
  },
  scopeRoleBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scopeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  actionBtnTextSecondary: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'column',
    gap: Spacing.md,
  },
  gridWide: {
    flexDirection: 'row',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  cardHalf: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginVertical: 2,
  },
  statSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  badgePillSuccess: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: Colors.successLight,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgePillTextSuccess: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success,
  },
  badgePillWarning: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  badgePillTextWarning: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  bulletList: {
    gap: Spacing.xs,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  bulletDot: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
  },
  recommendationText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  deepDiveBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  deepDiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  deepDiveTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  promptChipPressed: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  promptChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
});
