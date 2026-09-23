import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BookOpen,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  GitCommit,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
  XCircle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius, Shadow, Spacing } from '../../theme';
import { useAiChat } from '../../context/AiChatContext';
import {
  applyEntityRevision,
  previewEntityRevision,
  type EntityRevisionProposalData,
  type EntityRevisionResult,
} from '../../services/aiChat';

interface EntityRevisionCardProps {
  proposal: EntityRevisionProposalData;
  conversationId?: string;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; bg: string; destination: string }
> = {
  question: {
    label: 'Question Bank',
    icon: HelpCircle,
    color: '#7C3AED',
    bg: '#F5F3FF',
    destination: 'Question Bank',
  },
  content: {
    label: 'Lesson / Content',
    icon: BookOpen,
    color: '#2D5DC9',
    bg: '#EEF4FF',
    destination: 'Content Manager',
  },
  topic: {
    label: 'Curriculum Topic',
    icon: Sparkles,
    color: '#D33F13',
    bg: '#FFF0EB',
    destination: 'Topics',
  },
  quiz: {
    label: 'Assessment Quiz',
    icon: Trophy,
    color: '#176B47',
    bg: '#EAF7F0',
    destination: 'Quiz Manager',
  },
};

export function EntityRevisionCard({
  proposal,
  conversationId,
}: EntityRevisionCardProps) {
  const router = useRouter();
  const { close: closeChat } = useAiChat();

  const [status, setStatus] = useState<
    'idle' | 'generating' | 'reviewed' | 'applying' | 'applied' | 'error'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [revisionResult, setRevisionResult] =
    useState<EntityRevisionResult | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);

  const cfg = TYPE_CONFIG[proposal.entityType] || TYPE_CONFIG.content;
  const Icon = cfg.icon;

  const cacheKey = `ai_entity_rev_${conversationId || 'default'}_${proposal.entityType}_${proposal.entityId.trim().toLowerCase()}`;

  // Restore saved state from local storage
  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(cacheKey)
      .then((str) => {
        if (!isMounted || !str) return;
        try {
          const parsed = JSON.parse(str);
          if (parsed.status) setStatus(parsed.status);
          if (parsed.revisionResult) setRevisionResult(parsed.revisionResult);
        } catch {}
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [cacheKey]);

  const handlePreviewChanges = async () => {
    if (status === 'reviewed' && revisionResult) {
      setShowDiffModal(true);
      return;
    }

    setStatus('generating');
    setError(null);

    try {
      const res = await previewEntityRevision(
        proposal.entityType,
        proposal.entityId,
        proposal.instruction,
      );
      setRevisionResult(res);
      setStatus('reviewed');
      setShowDiffModal(true);

      AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({
          status: 'reviewed',
          revisionResult: res,
          updatedAt: Date.now(),
        }),
      ).catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Failed to analyze and generate changes');
      setStatus('error');
    }
  };

  const handleApplyChanges = async () => {
    if (!revisionResult?.revised) return;

    setStatus('applying');
    setError(null);

    try {
      await applyEntityRevision(
        proposal.entityType,
        proposal.entityId,
        revisionResult.revised,
      );
      setStatus('applied');
      setShowDiffModal(false);

      AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({
          status: 'applied',
          revisionResult,
          updatedAt: Date.now(),
        }),
      ).catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Failed to apply changes to database');
      setStatus('error');
    }
  };

  const handleOpenInEditor = async () => {
    setShowDiffModal(false);
    closeChat();

    if (proposal.entityType === 'content') {
      if (revisionResult?.revised) {
        const rev = revisionResult.revised;
        const draftPayload = {
          title: rev.title || revisionResult.originalName,
          classLevel: rev.classLevel || rev.class_level || '',
          subject: rev.subject || '',
          sections: rev.sections || [],
        };
        await AsyncStorage.setItem('els_content_draft', JSON.stringify(draftPayload));
        await AsyncStorage.setItem('els_auto_open_create', 'true');
        await AsyncStorage.setItem('manage_active_tab', 'content');
        DeviceEventEmitter.emit('els_open_content_create');
      }
      router.push('/(tabs)/manage?tab=content&action=create' as any);
      return;
    }

    if (proposal.entityType === 'topic') {
      if (revisionResult?.revised) {
        const rev = revisionResult.revised;
        const topicDraftPayload = {
          title: rev.title || revisionResult.originalName,
          classLevel: rev.classLevel || rev.class_level || '',
          subject: rev.subject || '',
        };
        await AsyncStorage.setItem(
          'els_auto_open_create_topic',
          JSON.stringify(topicDraftPayload),
        );
        await AsyncStorage.setItem('manage_active_tab', 'topic');
        DeviceEventEmitter.emit('els_open_topic_create', topicDraftPayload);
      }
      router.push('/(tabs)/manage?tab=topic&action=create' as any);
      return;
    }

    if (proposal.entityType === 'quiz') {
      if (proposal.entityId) {
        DeviceEventEmitter.emit('els_open_quiz_review', {
          quizId: proposal.entityId,
          action: 'preview',
        });
        router.push({
          pathname: '/(tabs)/manage',
          params: {
            tab: 'quiz',
            quizId: proposal.entityId,
            action: 'preview',
            _ts: String(Date.now()),
          },
        } as any);
        return;
      }
      router.push('/(tabs)/manage?tab=quiz' as any);
      return;
    }

    router.push('/(tabs)/manage?tab=question' as any);
  };

  const formatVal = (val: unknown): string => {
    if (val === undefined || val === null) return 'none';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  };

  return (
    <View style={s.card}>
      {/* Header with Entity Badge */}
      <View style={s.headerRow}>
        <View style={[s.badge, { backgroundColor: cfg.bg }]}>
          <Icon size={12} color={cfg.color} strokeWidth={2.5} />
          <Text style={[s.badgeText, { color: cfg.color }]}>
            {cfg.label} Modification
          </Text>
        </View>

        <View style={s.idBadge}>
          <Text style={s.idBadgeText} numberOfLines={1}>
            ID: {proposal.entityId.slice(0, 8)}...
          </Text>
        </View>
      </View>

      {/* Target Title / Description */}
      <Text style={s.title}>
        {revisionResult?.originalName || `Target ${cfg.label}`}
      </Text>

      {/* Instruction Box */}
      <View style={s.instructionBox}>
        <Text style={s.instructionLabel}>Requested Change:</Text>
        <Text style={s.instructionText}>
          {proposal.summary || proposal.instruction}
        </Text>
      </View>

      {/* State: Idle */}
      {status === 'idle' && (
        <View style={s.actionsRow}>
          <Pressable onPress={handlePreviewChanges} style={s.primaryBtn}>
            <GitCommit size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={s.primaryBtnText}>Review Proposed Changes</Text>
          </Pressable>
        </View>
      )}

      {/* State: Generating */}
      {status === 'generating' && (
        <View style={s.generatingBox}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={s.generatingText}>
            Inspecting live record and drafting changes...
          </Text>
        </View>
      )}

      {/* State: Reviewed */}
      {status === 'reviewed' && revisionResult && (
        <View style={s.reviewedBox}>
          <View style={s.reviewedHeader}>
            <Clock size={15} color={Colors.primary} strokeWidth={2.5} />
            <Text style={s.reviewedTitle}>Changes Prepared ({revisionResult.diff.length} fields)</Text>
          </View>
          <Text style={s.reviewedSummary}>{revisionResult.summary}</Text>

          <View style={s.actionsRow}>
            <Pressable onPress={() => setShowDiffModal(true)} style={s.primaryBtn}>
              <Eye size={14} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={s.primaryBtnText}>Preview Diff</Text>
            </Pressable>

            <Pressable onPress={handleApplyChanges} style={s.applyBtn}>
              <CheckCircle size={14} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={s.applyBtnText}>Apply to Platform</Text>
            </Pressable>

            <Pressable onPress={handleOpenInEditor} style={s.editorBtn}>
              <ExternalLink size={13} color={Colors.primary} strokeWidth={2.2} />
              <Text style={s.editorBtnText}>Open in Editor</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* State: Applying */}
      {status === 'applying' && (
        <View style={s.generatingBox}>
          <ActivityIndicator size="small" color={Colors.success} />
          <Text style={s.generatingText}>
            Saving updates to platform database...
          </Text>
        </View>
      )}

      {/* State: Applied */}
      {status === 'applied' && (
        <View style={s.appliedBox}>
          <View style={s.appliedHeader}>
            <CheckCircle size={17} color={Colors.success} strokeWidth={2.5} />
            <Text style={s.appliedTitle}>
              Changes Applied Successfully!
            </Text>
          </View>
          <Text style={s.appliedSub}>
            The {cfg.label} has been updated in the live database.
          </Text>

          <View style={s.actionsRow}>
            <Pressable onPress={handleOpenInEditor} style={s.editorBtn}>
              <ExternalLink size={13} color={Colors.primary} strokeWidth={2.2} />
              <Text style={s.editorBtnText}>View in {cfg.destination}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* State: Error */}
      {status === 'error' && (
        <View style={s.errorBox}>
          <View style={s.errorRow}>
            <XCircle size={15} color={Colors.error} />
            <Text style={s.errorText}>{error || 'Operation failed'}</Text>
          </View>
          <Pressable onPress={handlePreviewChanges} style={s.retryBtn}>
            <RotateCcw size={12} color="#FFFFFF" />
            <Text style={s.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Diff Preview Modal */}
      <Modal
        visible={showDiffModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDiffModal(false)}
      >
        <View style={s.modalOverlay}>
          <Pressable
            style={s.modalBackdrop}
            onPress={() => setShowDiffModal(false)}
          />
          <View style={s.modalContainer}>
            {/* Modal Header */}
            <View style={s.modalHeader}>
              <View style={s.modalHeaderLeft}>
                <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                  <Icon size={12} color={cfg.color} strokeWidth={2.5} />
                  <Text style={[s.badgeText, { color: cfg.color }]}>
                    {cfg.label}
                  </Text>
                </View>
                <Text style={s.modalHeaderTitle} numberOfLines={1}>
                  Review Changes: {revisionResult?.originalName}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowDiffModal(false)}
                style={s.modalCloseBtn}
              >
                <X size={17} color="#6B7280" />
              </Pressable>
            </View>

            {/* Modal Body */}
            <ScrollView
              style={s.modalScrollView}
              contentContainerStyle={s.modalScrollContent}
            >
              <View style={s.diffSummaryBox}>
                <Text style={s.diffSummaryHeading}>Change Overview:</Text>
                <Text style={s.diffSummaryText}>
                  {revisionResult?.summary || proposal.instruction}
                </Text>
              </View>

              {/* Diff Items */}
              {revisionResult?.diff && revisionResult.diff.length > 0 ? (
                <View style={s.diffList}>
                  {revisionResult.diff.map((item, idx) => (
                    <View key={idx} style={s.diffCard}>
                      <View style={s.diffCardHeader}>
                        <View style={s.fieldPill}>
                          <Text style={s.fieldPillText}>{item.field}</Text>
                        </View>
                        {item.description ? (
                          <Text style={s.diffDescription}>{item.description}</Text>
                        ) : null}
                      </View>

                      <View style={s.diffRow}>
                        {/* Old Value */}
                        <View style={s.oldValueBox}>
                          <Text style={s.diffLabelOld}>Before:</Text>
                          <Text style={s.diffValueOld} numberOfLines={8}>
                            {formatVal(item.oldValue)}
                          </Text>
                        </View>

                        {/* New Value */}
                        <View style={s.newValueBox}>
                          <Text style={s.diffLabelNew}>After:</Text>
                          <Text style={s.diffValueNew} numberOfLines={8}>
                            {formatVal(item.newValue)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={s.noDiffBox}>
                  <Text style={s.noDiffText}>
                    Complete payload updated based on instructions.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={s.modalFooter}>
              <Pressable
                onPress={() => setShowDiffModal(false)}
                style={s.modalCancelBtn}
              >
                <Text style={s.modalCancelBtnText}>Close</Text>
              </Pressable>

              <Pressable
                onPress={handleApplyChanges}
                style={s.modalApplyBtn}
              >
                <CheckCircle size={14} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={s.modalApplyBtnText}>Apply Changes to Database</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: Spacing.md,
    ...Shadow.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  idBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.sm,
  },
  idBadgeText: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  instructionBox: {
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  instructionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  instructionText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  editorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#EEF4FF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#D4E2FC',
  },
  editorBtnText: {
    color: Colors.primary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  generatingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  generatingText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  reviewedBox: {
    padding: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 6,
  },
  reviewedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewedTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.primary,
  },
  reviewedSummary: {
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 16,
  },
  appliedBox: {
    padding: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 4,
  },
  appliedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appliedTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.success,
  },
  appliedSub: {
    fontSize: 11.5,
    color: '#15803D',
  },
  errorBox: {
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  errorText: {
    fontSize: 11.5,
    color: Colors.error,
    fontWeight: '600',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.error,
    borderRadius: Radius.sm,
  },
  retryBtnText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    ...Shadow.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
    backgroundColor: '#F8FAFD',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  modalHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: Radius.full,
  },
  modalScrollView: {
    maxHeight: 480,
  },
  modalScrollContent: {
    padding: Spacing.base,
    gap: 12,
  },
  diffSummaryBox: {
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  diffSummaryHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  diffSummaryText: {
    fontSize: 12,
    color: '#1E293B',
    lineHeight: 16,
  },
  diffList: {
    gap: 10,
  },
  diffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 10,
    gap: 8,
  },
  diffCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#EEF2FF',
    borderRadius: Radius.sm,
  },
  fieldPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  diffDescription: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'right',
  },
  diffRow: {
    flexDirection: 'row',
    gap: 8,
  },
  oldValueBox: {
    flex: 1,
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  diffLabelOld: {
    fontSize: 10,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 2,
  },
  diffValueOld: {
    fontSize: 11,
    color: '#7F1D1D',
    lineHeight: 14,
  },
  newValueBox: {
    flex: 1,
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  diffLabelNew: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 2,
  },
  diffValueNew: {
    fontSize: 11,
    color: '#14532D',
    lineHeight: 14,
  },
  noDiffBox: {
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDiffText: {
    fontSize: 12,
    color: '#64748B',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E8ECF4',
    backgroundColor: '#F8FAFD',
  },
  modalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.md,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.md,
    backgroundColor: Colors.success,
  },
  modalApplyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
