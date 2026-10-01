import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { AlertTriangle, BookOpen, FileText, Sparkles, ArrowRight } from 'lucide-react-native';
import { Colors, Radius, Shadow, Spacing } from '../../theme';

export interface WeakAreaItem {
  title: string;
  description: string;
  count?: number;
}

export interface LearningGapSummaryData {
  type?: string;
  weak_areas?: WeakAreaItem[];
  learning_gap?: string;
  summary?: string;
}

interface LearningGapCardProps {
  data: LearningGapSummaryData;
  studentName?: string;
  onDraftQuiz?: (topic: string) => void;
  onOpenReportCard?: () => void;
}

export function LearningGapCard({
  data,
  studentName,
  onDraftQuiz,
  onOpenReportCard,
}: LearningGapCardProps) {
  const weakAreas = data.weak_areas || [];
  const synthesis = data.learning_gap || data.summary;

  return (
    <View style={s.card}>
      {/* ── Card Header ────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.iconBox}>
          <AlertTriangle size={16} color="#D97706" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.headerTitle}>Identified Learning Gaps & Weak Areas</Text>
          <Text style={s.headerSub}>
            {studentName ? `Diagnostic Assessment for ${studentName}` : 'Academic Diagnostic Analysis'}
          </Text>
        </View>
        <View style={s.countBadge}>
          <Text style={s.countBadgeText}>{weakAreas.length} Area{weakAreas.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* ── Weak Areas List ────────────────────────────────── */}
      {weakAreas.length > 0 && (
        <View style={s.areasList}>
          {weakAreas.map((area, idx) => (
            <View key={idx} style={s.areaItem}>
              <View style={s.areaHeaderRow}>
                <View style={s.numberCircle}>
                  <Text style={s.numberText}>{idx + 1}</Text>
                </View>
                <Text style={s.areaTitle} numberOfLines={1}>
                  {area.title}
                </Text>
              </View>

              <Text style={s.areaDescription}>{area.description}</Text>

              {onDraftQuiz && (
                <View style={s.areaActionRow}>
                  <Pressable
                    style={({ pressed }) => [s.areaActionBtn, pressed && { opacity: 0.75 }]}
                    onPress={() => onDraftQuiz(area.title)}
                    accessibilityRole="button"
                    accessibilityLabel={`Create quiz for ${area.title}`}
                  >
                    <Sparkles size={12} color={Colors.primary} />
                    <Text style={s.areaActionBtnText}>Create Practice for this Topic</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ── Pedagogical Synthesis / Targeted Plan ──────────── */}
      {synthesis ? (
        <View style={s.synthesisBox}>
          <View style={s.synthesisHeader}>
            <BookOpen size={13} color={Colors.primary} />
            <Text style={s.synthesisTitle}>Targeted Intervention Focus</Text>
          </View>
          <Text style={s.synthesisText}>{synthesis}</Text>
        </View>
      ) : null}

      {/* ── Bottom Action Buttons ──────────────────────────── */}
      <View style={s.btnRow}>
        {onOpenReportCard && (
          <Pressable
            style={({ pressed }) => [s.outlineBtn, pressed && { opacity: 0.85 }]}
            onPress={onOpenReportCard}
            accessibilityRole="button"
            accessibilityLabel="Open official report card"
          >
            <FileText size={14} color={Colors.primary} />
            <Text style={s.outlineBtnText}>View Full Report Card</Text>
          </Pressable>
        )}

        {onDraftQuiz && (
          <Pressable
            style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85 }]}
            onPress={() => onDraftQuiz(weakAreas[0]?.title || 'all identified learning gaps')}
            accessibilityRole="button"
            accessibilityLabel="Draft remedial quiz"
          >
            <Sparkles size={14} color="#FFFFFF" />
            <Text style={s.primaryBtnText}>Draft Remedial Quiz</Text>
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
    marginVertical: 6,
    ...Shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  areasList: {
    gap: 10,
  },
  areaItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 12,
    gap: 6,
  },
  areaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  numberCircle: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  areaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  areaDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    paddingLeft: 28,
  },
  areaActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  areaActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  areaActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  synthesisBox: {
    backgroundColor: '#FAFCFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 12,
    gap: 6,
  },
  synthesisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  synthesisTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  synthesisText: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  outlineBtn: {
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
  outlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  primaryBtn: {
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
  primaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
