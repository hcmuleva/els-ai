import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  MessageSquare,
  Sparkles,
  User,
  X,
} from 'lucide-react-native';
import { Colors, Radius, Shadow, Spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import {
  fetchChatReviewQueue,
  fetchReviewStats,
  ReviewEntry,
  updateReviewEntry,
} from '../../services/betterChat';

interface ReviewQueueScreenProps {
  onClose?: () => void;
}

export function ReviewQueueScreen({ onClose }: ReviewQueueScreenProps) {
  const { apiFetch } = useAuth();
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'pending_review' | 'approved' | 'all'>('pending_review');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Note Modal state
  const [selectedEntry, setSelectedEntry] = useState<ReviewEntry | null>(null);
  const [noteText, setNoteText] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedEntries, fetchedStats] = await Promise.all([
        fetchChatReviewQueue(apiFetch, activeTab),
        fetchReviewStats(apiFetch),
      ]);
      setEntries(fetchedEntries);
      setStats(fetchedStats);
    } catch (err) {
      console.error('[ReviewQueueScreen] load failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleAction = async (entryId: string, action: 'approved' | 'rejected', notes?: string) => {
    try {
      setProcessingId(entryId);
      await updateReviewEntry(apiFetch, entryId, action, notes);
      // Remove or update locally
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, review_status: action, teacher_notes: notes } : e))
      );
      if (activeTab === 'pending_review') {
        setEntries((prev) => prev.filter((e) => e.id !== entryId));
      }
      // Refresh stats
      const newStats = await fetchReviewStats(apiFetch);
      setStats(newStats);
      setSelectedEntry(null);
    } catch (err) {
      console.error('[ReviewQueueScreen] action failed', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onClose && (
            <Pressable
              onPress={onClose}
              style={styles.backButton}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <ArrowLeft size={20} color={Colors.text} />
            </Pressable>
          )}
          <View>
            <Text style={styles.headerTitle}>Teacher Review Queue</Text>
            <Text style={styles.headerSubtitle}>Audit parent observations from AI survey chats</Text>
          </View>
        </View>

        {/* Pending Badge */}
        <View style={styles.pendingCountBadge}>
          <Text style={styles.pendingCountText}>
            {stats.pending_review ?? 0} Pending
          </Text>
        </View>
      </View>

      {/* ── Filter Tabs ───────────────────────────────────── */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab('pending_review')}
          style={[styles.tabItem, activeTab === 'pending_review' && styles.tabItemActive]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'pending_review' && styles.tabTextActive,
            ]}
          >
            Pending ({stats.pending_review ?? 0})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('approved')}
          style={[styles.tabItem, activeTab === 'approved' && styles.tabItemActive]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'approved' && styles.tabTextActive,
            ]}
          >
            Approved ({stats.approved ?? 0})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('all')}
          style={[styles.tabItem, activeTab === 'all' && styles.tabItemActive]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'all' && styles.tabTextActive,
            ]}
          >
            All Logs
          </Text>
        </Pressable>
      </View>

      {/* ── List ──────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading review queue...</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <CheckCircle2 size={42} color={Colors.success} />
          <Text style={styles.emptyTitle}>All Caught Up!</Text>
          <Text style={styles.emptySubtitle}>
            No entries pending review for your classes at this time.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isProcessing = processingId === item.id;
            const isPending = item.review_status === 'pending_review';

            return (
              <View style={styles.entryCard}>
                {/* Header row: Student name & Topic */}
                <View style={styles.entryHeaderRow}>
                  <View style={styles.studentInfo}>
                    <User size={15} color={Colors.primary} />
                    <Text style={styles.studentNameText}>{item.student_name || 'Student'}</Text>
                  </View>
                  <View style={styles.topicBadge}>
                    <Text style={styles.topicBadgeText}>{item.topic}</Text>
                  </View>
                </View>

                {/* Parent Quote */}
                <View style={styles.quoteBox}>
                  <Text style={styles.quoteLabel}>Parent Observation:</Text>
                  <Text style={styles.quoteText}>"{item.raw_source_text}"</Text>
                </View>

                {/* Metadata Pills */}
                <View style={styles.metaRow}>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillLabel}>Category:</Text>
                    <Text style={styles.metaPillValue}>{item.category.replace('_', ' ')}</Text>
                  </View>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillLabel}>Concern:</Text>
                    <Text style={styles.metaPillValue}>{item.concern_level}</Text>
                  </View>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{item.review_status.replace('_', ' ')}</Text>
                  </View>
                </View>

                {/* Teacher Notes if any */}
                {item.teacher_notes && (
                  <View style={styles.teacherNoteBox}>
                    <Text style={styles.teacherNoteLabel}>Teacher Note:</Text>
                    <Text style={styles.teacherNoteText}>{item.teacher_notes}</Text>
                  </View>
                )}

                {/* Actions */}
                {isPending && (
                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={() => {
                        setSelectedEntry(item);
                        setNoteText('');
                      }}
                      style={styles.noteButton}
                      accessibilityLabel="Add Note"
                      accessibilityRole="button"
                    >
                      <MessageSquare size={14} color={Colors.textSecondary} />
                      <Text style={styles.noteButtonText}>Note</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleAction(item.id, 'rejected')}
                      disabled={isProcessing}
                      style={[styles.rejectButton, isProcessing && styles.btnDisabled]}
                      accessibilityLabel="Reject observation"
                      accessibilityRole="button"
                    >
                      <X size={14} color={Colors.error} />
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleAction(item.id, 'approved')}
                      disabled={isProcessing}
                      style={[styles.approveButton, isProcessing && styles.btnDisabled]}
                      accessibilityLabel="Approve observation"
                      accessibilityRole="button"
                    >
                      <Check size={14} color="#FFFFFF" />
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* ── Add Note / Approve Modal ───────────────────────── */}
      <Modal visible={Boolean(selectedEntry)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Teacher Note & Verify</Text>
              <Pressable
                onPress={() => setSelectedEntry(null)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Observation for <Text style={styles.bold}>{selectedEntry?.student_name}</Text>
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Observed same hesitation during reading group yesterday..."
              placeholderTextColor={Colors.textMuted}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setSelectedEntry(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => selectedEntry && handleAction(selectedEntry.id, 'approved', noteText)}
                style={styles.modalSaveBtn}
              >
                <Text style={styles.modalSaveText}>Approve with Note</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pendingCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  pendingCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  tabItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    marginVertical: 4,
  },
  tabItemActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  entryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  entryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studentNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  topicBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  topicBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  quoteBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  quoteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  quoteText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.text,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metaPillLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  metaPillValue: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
    textTransform: 'capitalize',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  teacherNoteBox: {
    padding: Spacing.xs + 2,
    backgroundColor: '#F0FDF4',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: Spacing.sm,
  },
  teacherNoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
    textTransform: 'uppercase',
  },
  teacherNoteText: {
    fontSize: 12,
    color: Colors.text,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
    marginTop: 4,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  noteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: Colors.success,
  },
  approveButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  bold: {
    fontWeight: '700',
  },
  modalInput: {
    minHeight: 80,
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 13,
    color: Colors.text,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.success,
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
