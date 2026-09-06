/**
 * ParentFeedbackTab - Real-time parent-teacher communication.
 * Features: Teacher remarks, conversation threads with auto-refresh, submit feedback.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MessageCircle, Send, Plus, ChevronRight, X, Clock, RefreshCw } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

type TeacherRemark = {
  classroomId: string;
  classroomTitle: string;
  classLevel: string;
  remarkText: string | null;
  parentNote: string | null;
  remarkMediaUrl: string | null;
  scoreBehavior: number | null;
  scoreConfidence: number | null;
  scoreParticipation: number | null;
  scorePerformance: number | null;
  teacherName: string;
  remarkDate: string;
};

type FeedbackThread = {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  status: string;
  category: string | null;
  topicId: string | null;
  topicTitle: string | null;
  description: string | null;
  createdByRole: string;
  messageCount: number;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  updatedAt: string;
  createdAt: string;
};

type ThreadMessage = {
  id: string;
  senderUserId: string;
  senderRole: string;
  senderName: string;
  message: string;
  responseType: string | null;
  attachmentUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

type ThreadDetail = {
  thread: {
    id: string;
    studentId: string;
    studentName: string;
    subject: string;
    status: string;
    category: string | null;
    topicId: string | null;
    topicTitle: string | null;
    description: string | null;
    createdByRole: string;
    createdAt: string;
  };
  messages: ThreadMessage[];
  hasMoreMessages?: boolean;
};

type Props = {
  studentId: string;
  studentName: string;
  classLevel: string;
};

const SCORE_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];
const SCORE_COLORS = ['', '#EF4444', '#F97316', '#F59E0B', '#22C55E', '#10B981'];

function ScorePill({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <View style={[s.scorePill, { backgroundColor: `${SCORE_COLORS[value]}18` }]}>
      <Text style={[s.scorePillText, { color: SCORE_COLORS[value] }]}>{SCORE_LABELS[value]}</Text>
    </View>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ParentFeedbackTab({ studentId, studentName, classLevel }: Props) {
  const { apiFetch, user } = useAuth();
  const { onFeedbackMessage } = useNotifications();
  const [activeSection, setActiveSection] = useState<'conversations' | 'remarks'>('conversations');
  const [loading, setLoading] = useState(true);
  const [teacherRemarks, setTeacherRemarks] = useState<TeacherRemark[]>([]);
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);

  // Thread detail (chat view)
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const loadingOlderRef = useRef(false);
  const messagesEndRef = useRef<ScrollView | null>(null);

  // New structured thread
  const [newThreadVisible, setNewThreadVisible] = useState(false);
  const [newCategory, setNewCategory] = useState<'academic' | 'non_academic'>('academic');
  const [subjectsList, setSubjectsList] = useState<{ academic: { id: string; title: string }[]; nonAcademic: { id: string; title: string; description: string | null }[] }>({ academic: [], nonAcademic: [] });
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSubjectTitle, setSelectedSubjectTitle] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Fetch threads list
  const fetchThreads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [dashRes, threadsRes] = await Promise.all([
        apiFetch(`/students/${studentId}/parent-dashboard`),
        apiFetch(`/feedback/threads?studentId=${studentId}&limit=50`),
      ]);
      if (dashRes.ok) {
        const data = await dashRes.json();
        setTeacherRemarks(data.teacherRemarks || []);
        setTotalUnread(data.totalUnreadMessages || 0);
      }
      if (threadsRes.ok) {
        const data = await threadsRes.json();
        setThreads(data.threads || []);
      }
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false); }
  }, [apiFetch, studentId]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // Open thread and start polling for new messages
  const openThread = async (threadId: string) => {
    setThreadLoading(true);
    setThreadDetail(null);
    setHasMoreMessages(false);
    try {
      const res = await apiFetch(`/feedback/threads/${threadId}`);
      if (res.ok) {
        const data = await res.json();
        setThreadDetail(data);
        setHasMoreMessages(data.hasMoreMessages || false);
      }
    } catch { /* silent */ }
    finally { setThreadLoading(false); }
  };

  const loadOlderMessages = async () => {
    if (!threadDetail || loadingOlder || !hasMoreMessages) return;
    const oldest = threadDetail.messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    loadingOlderRef.current = true;
    try {
      const res = await apiFetch(
        `/feedback/threads/${threadDetail.thread.id}?msgBeforeId=${oldest.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setThreadDetail((prev) => {
          if (!prev) return prev;
          const existingIds = new Set(prev.messages.map((m) => m.id));
          const newMsgs = ((data.messages || []) as ThreadMessage[]).filter((m) => !existingIds.has(m.id));
          return { ...prev, messages: [...newMsgs, ...prev.messages] };
        });
        setHasMoreMessages(data.hasMoreMessages || false);
      }
    } catch { /* silent */ }
    finally {
      setLoadingOlder(false);
      setTimeout(() => { loadingOlderRef.current = false; }, 300);
    }
  };

  // Real-time: listen for new messages via Ably
  const threadIdRef = useRef<string | null>(null);

  useEffect(() => {
    threadIdRef.current = threadDetail?.thread.id || null;
  }, [threadDetail?.thread.id]);

  useEffect(() => {
    const unsub = onFeedbackMessage((event) => {
      // If the message is for the currently open thread, append it locally
      if (threadIdRef.current && event.threadId === threadIdRef.current) {
        setThreadDetail((prev) => {
          if (!prev) return prev;
          const alreadyExists = prev.messages.some(
            (m) => m.createdAt === event.sentAt && m.message === event.message
          );
          if (alreadyExists) return prev;
          return {
            ...prev,
            messages: [...prev.messages, {
              id: `ably-${Date.now()}`,
              senderUserId: '',
              senderRole: event.senderRole,
              senderName: event.senderRole === 'teacher' ? 'Teacher' : 'Parent',
              message: event.message,
              responseType: null,
              attachmentUrl: null,
              isRead: true,
              createdAt: event.sentAt,
            }],
          };
        });
      }
      // Refresh threads list for unread counts
      fetchThreads(true);
    });
    return unsub;
  }, [onFeedbackMessage, fetchThreads]);

  const sendReply = async () => {
    if (!replyText.trim() || !threadDetail) return;
    setSending(true);
    try {
      const res = await apiFetch(`/feedback/threads/${threadDetail.thread.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      if (res.ok) {
        const msg = await res.json();
        setThreadDetail((prev) => prev ? {
          ...prev,
          messages: [...prev.messages, {
            id: msg.id,
            senderUserId: user?.id || '',
            senderRole: 'parent',
            senderName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
            message: msg.message,
            responseType: null,
            attachmentUrl: null,
            isRead: false,
            createdAt: msg.createdAt,
          }],
        } : null);
        setReplyText('');
      }
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  const createThread = async () => {
    if (!selectedSubjectId || !newTitle.trim() || !newDescription.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch('/feedback/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          category: newCategory,
          topicId: selectedSubjectId,
          topicTitle: selectedSubjectTitle,
          subject: newTitle.trim(),
          description: newDescription.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewThreadVisible(false);
        setNewCategory('academic');
        setSelectedSubjectId('');
        setSelectedSubjectTitle('');
        setSubjectSearch('');
        setNewTitle('');
        setNewDescription('');
        fetchThreads();
        openThread(data.id);
      }
    } catch { /* silent */ }
    finally { setCreating(false); }
  };

  const fetchSubjects = async () => {
    try {
      const res = await apiFetch(`/feedback/topics?classLevel=${encodeURIComponent(classLevel)}`);
      if (res.ok) {
        const data = await res.json();
        setSubjectsList({ academic: data.academic || [], nonAcademic: data.nonAcademic || [] });
      }
    } catch { /* silent */ }
  };

  const openNewThread = () => {
    fetchSubjects();
    setSubjectDropdownOpen(false);
    setSubjectSearch('');
    setNewThreadVisible(true);
  };



  if (loading) {
    return (
      <View style={s.loaderWrap}>
        <ActivityIndicator size="large" color="#2D5DC9" />
        <Text style={s.loaderText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Section tabs */}
      <View style={s.sectionTabs}>
        {([
          ['conversations', `Conversations${totalUnread > 0 ? ` (${totalUnread})` : ''}`],
          ['remarks', `Teacher Notes (${teacherRemarks.length})`],
        ] as ['conversations' | 'remarks', string][]).map(([key, label]) => (
          <Pressable
            key={key}
            style={[s.sectionTab, activeSection === key && s.sectionTabActive]}
            onPress={() => setActiveSection(key)}
          >
            <Text style={[s.sectionTabText, activeSection === key && s.sectionTabTextActive]}>{label}</Text>
            {key === 'conversations' && totalUnread > 0 && <View style={s.unreadDot} />}
          </Pressable>
        ))}
      </View>

      {/* ══ CONVERSATIONS ═════════════════════════════════════════════════════ */}
      {activeSection === 'conversations' && (
        <View style={{ gap: 10, paddingHorizontal: 16, paddingTop: 4 }}>
          <Pressable style={s.newThreadBtn} onPress={openNewThread}>
            <View style={s.newThreadIcon}><Plus size={16} color="#2D5DC9" /></View>
            <Text style={s.newThreadBtnText}>New Feedback</Text>
            <ChevronRight size={14} color="#2D5DC9" />
          </Pressable>

          {threads.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={s.emptyTitle}>No Conversations Yet</Text>
              <Text style={s.emptyText}>Start a conversation with your child's teacher about progress, homework, or any concerns.</Text>
            </View>
          ) : (
            threads.map((thread) => (
              <Pressable key={thread.id} style={s.threadCard} onPress={() => openThread(thread.id)}>
                <View style={[s.threadIconBox, { backgroundColor: thread.unreadCount > 0 ? '#D6EAFF' : '#F0F4FF' }]}>
                  <MessageCircle size={20} color={thread.unreadCount > 0 ? '#2D5DC9' : '#525C6B'} />
                </View>
                <View style={s.threadInfo}>
                  <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 2 }}>
                    {thread.category && (
                      <View style={[s.tagBadge, { backgroundColor: thread.category === 'academic' ? '#E3F2FD' : '#FFF3E0' }]}>
                        <Text style={[s.tagBadgeText, { color: thread.category === 'academic' ? '#1976D2' : '#B23D00' }]}>
                          {thread.category === 'academic' ? 'Academic' : 'Non-Academic'}
                        </Text>
                      </View>
                    )}
                    {thread.topicTitle && (
                      <View style={[s.tagBadge, { backgroundColor: '#F3E5F5' }]}>
                        <Text style={[s.tagBadgeText, { color: '#7B1FA2' }]}>{thread.topicTitle}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.threadSubject} numberOfLines={1}>{thread.subject}</Text>
                  {thread.lastMessage && (
                    <Text style={s.threadLastMsg} numberOfLines={1}>
                      {thread.createdByRole === 'teacher' ? 'Teacher: ' : 'You: '}{thread.lastMessage}
                    </Text>
                  )}
                  <View style={s.threadMetaRow}>
                    <Clock size={10} color="#525C6B" />
                    <Text style={s.threadTime}>{thread.lastMessageAt ? timeAgo(thread.lastMessageAt) : formatDate(thread.createdAt)}</Text>
                    <View style={[s.statusDot, { backgroundColor: thread.status === 'open' ? '#4CAF50' : '#525C6B' }]} />
                    <Text style={{ fontSize: 10, color: thread.status === 'open' ? '#4CAF50' : '#525C6B', fontWeight: '600' }}>
                      {thread.status === 'open' ? 'Open' : 'Closed'}
                    </Text>
                  </View>
                </View>
                {thread.unreadCount > 0 && (
                  <View style={s.unreadBadge}>
                    <Text style={s.unreadBadgeText}>{thread.unreadCount}</Text>
                  </View>
                )}
              </Pressable>
            ))
          )}
        </View>
      )}

      {/* ══ TEACHER REMARKS ═══════════════════════════════════════════════════ */}
      {activeSection === 'remarks' && (
        <View style={{ gap: 10, paddingHorizontal: 16, paddingTop: 4 }}>
          {teacherRemarks.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 40 }}>📝</Text>
              <Text style={s.emptyTitle}>No Teacher Notes Yet</Text>
              <Text style={s.emptyText}>Teacher remarks and notes will appear here once added.</Text>
            </View>
          ) : (
            teacherRemarks.map((remark, idx) => (
              <View key={idx} style={s.remarkCard}>
                {/* Header row */}
                <View style={s.remarkHeader}>
                  <View style={s.remarkAvatar}>
                    <Text style={s.remarkAvatarText}>{(remark.teacherName || 'T')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.remarkTeacherName}>{remark.teacherName || 'Teacher'}</Text>
                    <Text style={s.remarkMeta}>{remark.classroomTitle} · {formatDate(remark.remarkDate)}</Text>
                  </View>
                </View>

                {/* Parent note */}
                {remark.parentNote && (
                  <View style={s.parentNoteBox}>
                    <Text style={s.parentNoteLabel}>For You</Text>
                    <Text style={s.parentNoteText}>{remark.parentNote}</Text>
                  </View>
                )}

                {/* Teacher observation */}
                {remark.remarkText && (
                  <Text style={s.remarkTextContent}>{remark.remarkText}</Text>
                )}

                {/* Scores */}
                {(remark.scoreBehavior || remark.scoreConfidence || remark.scoreParticipation || remark.scorePerformance) && (
                  <View style={s.scoresRow}>
                    {remark.scoreBehavior ? <View style={s.scoreItem}><Text style={s.scoreItemLabel}>Behavior</Text><ScorePill value={remark.scoreBehavior} /></View> : null}
                    {remark.scoreConfidence ? <View style={s.scoreItem}><Text style={s.scoreItemLabel}>Confidence</Text><ScorePill value={remark.scoreConfidence} /></View> : null}
                    {remark.scoreParticipation ? <View style={s.scoreItem}><Text style={s.scoreItemLabel}>Participation</Text><ScorePill value={remark.scoreParticipation} /></View> : null}
                    {remark.scorePerformance ? <View style={s.scoreItem}><Text style={s.scoreItemLabel}>Performance</Text><ScorePill value={remark.scorePerformance} /></View> : null}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* ══ SUBMIT FEEDBACK ═══════════════════════════════════════════════════ */}


      {/* ══ THREAD CHAT MODAL ═════════════════════════════════════════════════ */}
      <Modal visible={!!threadDetail || threadLoading} transparent animationType="slide" onRequestClose={() => setThreadDetail(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            {threadLoading ? (
              <View style={s.loaderWrap}><ActivityIndicator size="large" color="#2D5DC9" /></View>
            ) : threadDetail ? (
              <>
                <View style={s.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                      {threadDetail.thread.category && (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: threadDetail.thread.category === 'academic' ? '#E3F2FD' : '#FFF3E0' }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: threadDetail.thread.category === 'academic' ? '#1976D2' : '#B23D00' }}>
                            {threadDetail.thread.category === 'academic' ? 'Academic' : 'Non-Academic'}
                          </Text>
                        </View>
                      )}
                      {threadDetail.thread.topicTitle && (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#F3E5F5' }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#7B1FA2' }}>{threadDetail.thread.topicTitle}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.modalTitle}>{threadDetail.thread.subject}</Text>
                    <View style={s.modalSubRow}>
                      <Text style={s.modalSub}>{studentName} · with Teacher</Text>
                      <View style={s.liveDot} />
                      <Text style={s.liveText}>Live</Text>
                    </View>
                  </View>
                  <Pressable style={s.modalClose} onPress={() => { setThreadDetail(null); fetchThreads(true); }}>
                    <X size={18} color="#525C6B" />
                  </Pressable>
                </View>

                <View style={{ flex: 1 }}>
                  <ScrollView
                    ref={messagesEndRef}
                    style={s.messagesArea}
                    contentContainerStyle={{ paddingVertical: 12 }}
                    onContentSizeChange={() => {
                      if (!loadingOlderRef.current) {
                        messagesEndRef.current?.scrollToEnd({ animated: false });
                      }
                    }}
                    onScroll={({ nativeEvent }) => {
                      const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
                      const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
                      setShowScrollDown(distanceFromBottom > 100);
                      if (contentOffset.y <= 0 && hasMoreMessages && !loadingOlder) {
                        loadOlderMessages();
                      }
                    }}
                    scrollEventThrottle={100}
                  >
                    {hasMoreMessages && (
                      <Pressable onPress={loadOlderMessages} style={{ alignItems: 'center', paddingVertical: 8 }}>
                        {loadingOlder ? (
                          <ActivityIndicator size="small" color="#2D5DC9" />
                        ) : (
                          <Text style={{ color: '#2D5DC9', fontSize: 12, fontWeight: '600' }}>Load older messages</Text>
                        )}
                      </Pressable>
                    )}
                    {threadDetail.messages.map((msg) => {
                      const isMe = msg.senderUserId === user?.id;
                      return (
                        <View key={msg.id} style={[s.msgWrap, isMe && s.msgWrapMe]}>
                          <View style={[s.msgBubble, isMe ? s.msgBubbleMe : s.msgBubbleOther]}>
                            {!isMe && <Text style={s.msgSender}>{msg.senderName || 'Teacher'}</Text>}
                            <Text style={[s.msgText, isMe && s.msgTextMe]}>{msg.message}</Text>
                            <Text style={[s.msgTime, isMe && s.msgTimeMe]}>{formatTime(msg.createdAt)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                  {showScrollDown && (
                    <Pressable
                      onPress={() => messagesEndRef.current?.scrollToEnd({ animated: true })}
                      style={{
                        position: 'absolute', bottom: 12, alignSelf: 'center',
                        backgroundColor: '#2D5DC9', paddingHorizontal: 14, paddingVertical: 7,
                        borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15,
                        shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>↓ Latest</Text>
                    </Pressable>
                  )}
                </View>

                {threadDetail.thread.status === 'open' && (
                  <View style={s.replyBar}>
                    <TextInput
                      value={replyText}
                      onChangeText={setReplyText}
                      placeholder="Type a message..."
                      style={s.replyInput}
                      placeholderTextColor="#B0B8D0"
                      multiline
                      onSubmitEditing={sendReply}
                    />
                    <Pressable
                      style={[s.replyBtn, (!replyText.trim() || sending) && { opacity: 0.5 }]}
                      onPress={sendReply}
                      disabled={!replyText.trim() || sending}
                    >
                      {sending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={16} color="#fff" />}
                    </Pressable>
                  </View>
                )}
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ══ NEW STRUCTURED FEEDBACK MODAL ═════════════════════════════════════ */}
      <Modal visible={newThreadVisible} transparent animationType="fade" onRequestClose={() => setNewThreadVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { maxHeight: '80%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Feedback</Text>
              <Pressable style={s.modalClose} onPress={() => setNewThreadVisible(false)}>
                <X size={18} color="#525C6B" />
              </Pressable>
            </View>
            <ScrollView style={{ padding: 16 }} contentContainerStyle={{ gap: 14, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
              {/* Category */}
              <View>
                <Text style={s.fieldLabel}>Category</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  {(['academic', 'non_academic'] as const).map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => { setNewCategory(cat); setSelectedSubjectId(''); setSelectedSubjectTitle(''); setSubjectSearch(''); }}
                      style={[s.catChip, newCategory === cat && s.catChipActive]}
                    >
                      <Text style={[s.catChipText, newCategory === cat && s.catChipTextActive]}>
                        {cat === 'academic' ? 'Academic' : 'Non-Academic'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Subject selection - searchable floating dropdown */}
              <View style={{ zIndex: 10, position: 'relative' }}>
                <Text style={s.fieldLabel}>Subject</Text>
                {selectedSubjectTitle && !subjectDropdownOpen ? (
                  <Pressable
                    onPress={() => setSubjectDropdownOpen(true)}
                    style={[s.fieldInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  >
                    <Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>{selectedSubjectTitle}</Text>
                    <Text style={{ fontSize: 11, color: '#2D5DC9' }}>Change</Text>
                  </Pressable>
                ) : (
                  <View>
                    <TextInput
                      value={subjectSearch}
                      onChangeText={(text) => { setSubjectSearch(text); setSubjectDropdownOpen(true); }}
                      onFocus={() => setSubjectDropdownOpen(true)}
                      placeholder="Search subject..."
                      style={s.fieldInput}
                      placeholderTextColor="#B0B8D0"
                    />
                    {subjectDropdownOpen && (
                      <View style={s.dropdownList}>
                        <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                          {(newCategory === 'academic' ? subjectsList.academic : subjectsList.nonAcademic)
                            .filter((item) => item.title.toLowerCase().includes(subjectSearch.toLowerCase()))
                            .map((item) => (
                              <Pressable
                                key={item.id}
                                onPress={() => {
                                  setSelectedSubjectId(item.id);
                                  setSelectedSubjectTitle(item.title);
                                  setSubjectSearch('');
                                  setSubjectDropdownOpen(false);
                                }}
                                style={[s.dropdownItem, selectedSubjectId === item.id && s.dropdownItemActive]}
                              >
                                <Text style={[s.dropdownItemText, selectedSubjectId === item.id && s.dropdownItemTextActive]}>
                                  {item.title}
                                </Text>
                              </Pressable>
                            ))}
                          {(newCategory === 'academic' ? subjectsList.academic : subjectsList.nonAcademic)
                            .filter((item) => item.title.toLowerCase().includes(subjectSearch.toLowerCase())).length === 0 && (
                            <Text style={{ padding: 12, fontSize: 12, color: '#525C6B', textAlign: 'center' }}>No subjects found</Text>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Title */}
              <View>
                <Text style={s.fieldLabel}>Title</Text>
                <TextInput
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="e.g. Struggling with fractions, Homework not being done..."
                  style={s.fieldInput}
                  placeholderTextColor="#B0B8D0"
                />
              </View>

              {/* Description */}
              <View>
                <Text style={s.fieldLabel}>Description</Text>
                <TextInput
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder="Provide details about the feedback, observations, or concerns..."
                  multiline
                  style={[s.fieldInput, { minHeight: 100 }]}
                  placeholderTextColor="#B0B8D0"
                  textAlignVertical="top"
                />
              </View>

              <Pressable
                style={[s.submitBtn, (!selectedSubjectId || !newTitle.trim() || !newDescription.trim() || creating) && s.submitBtnDisabled]}
                onPress={createThread}
                disabled={!selectedSubjectId || !newTitle.trim() || !newDescription.trim() || creating}
              >
                {creating ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={s.submitBtnText}>Submit Feedback</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 0 },
  loaderWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loaderText: { fontSize: 13, color: '#525C6B', fontWeight: '600' },

  sectionTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F0F0F8', marginBottom: 12 },
  sectionTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', position: 'relative' },
  sectionTabActive: { borderBottomColor: '#2D5DC9' },
  sectionTabText: { fontSize: 11, fontWeight: '700', color: '#525C6B' },
  sectionTabTextActive: { color: '#2D5DC9', fontWeight: '800' },
  unreadDot: { position: 'absolute', top: 6, right: '20%', width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444' },

  content: { gap: 10, paddingHorizontal: 16 },

  // New feedback button
  newThreadBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: '#D6EAFF', borderStyle: 'dashed', shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 1 },
  newThreadIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EBF4FF', alignItems: 'center', justifyContent: 'center' },
  newThreadBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#2D5DC9' },

  // Conversation cards (matches quiz card)
  threadCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, gap: 12, borderWidth: 1, borderColor: '#F0F0F8', shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 2 },
  threadIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  threadInfo: { flex: 1, gap: 2 },
  threadSubject: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  threadLastMsg: { fontSize: 11, color: '#6B7C9A', marginTop: 1 },
  threadMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  threadTime: { fontSize: 10, color: '#525C6B', fontWeight: '600' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff' },

  // Teacher Notes (matches quiz card style)
  remarkCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: '#F0F0F8', shadowColor: '#C5D8F8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 2 },
  remarkHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  remarkAvatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EDE4FF', alignItems: 'center', justifyContent: 'center' },
  remarkAvatarText: { fontSize: 16, fontWeight: '800', color: '#7B4FCA' },
  remarkTeacherName: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  remarkMeta: { fontSize: 11, color: '#525C6B', fontWeight: '600', marginTop: 1 },
  parentNoteBox: { backgroundColor: '#F0F7FF', borderRadius: 12, padding: 10, borderLeftWidth: 3, borderLeftColor: '#2D5DC9' },
  parentNoteLabel: { fontSize: 10, fontWeight: '800', color: '#2D5DC9', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4 },
  parentNoteText: { fontSize: 13, color: '#1a1a2e', lineHeight: 19 },
  remarkTextContent: { fontSize: 13, color: '#3D4860', lineHeight: 20 },
  scoresRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  scoreItem: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F8F9FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: '#F0F0F8' },
  scoreItemLabel: { fontSize: 10, fontWeight: '700', color: '#6B7C9A' },
  scorePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  scorePillText: { fontSize: 10, fontWeight: '800' },

  // Submit
  submitCard: { backgroundColor: '#F8F9FF', borderRadius: 16, padding: 16, gap: 10 },
  submitTitle: { fontSize: 15, fontWeight: '900', color: '#1a1a2e' },
  submitDesc: { fontSize: 12, color: '#525C6B', lineHeight: 18 },
  feedbackInput: { backgroundColor: '#fff', borderRadius: 14, padding: 14, minHeight: 120, fontSize: 14, color: '#1a1a2e', lineHeight: 22, borderWidth: 1, borderColor: '#E0E4F0' },
  successBanner: { backgroundColor: '#D6F5D6', borderRadius: 10, padding: 10, alignItems: 'center' },
  successText: { fontSize: 13, fontWeight: '700', color: '#4CAF50' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2D5DC9', borderRadius: 14, paddingVertical: 14 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a2e' },
  emptyText: { fontSize: 12, color: '#525C6B', textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', minHeight: '60%', paddingBottom: Platform.OS === 'ios' ? 32 : 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#1a1a2e' },
  modalSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  modalSub: { fontSize: 11, color: '#525C6B', fontWeight: '500' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#4CAF50' },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F7FF', alignItems: 'center', justifyContent: 'center' },

  // Messages
  messagesArea: { flex: 1, paddingHorizontal: 16 },
  msgWrap: { marginBottom: 10, alignItems: 'flex-start' },
  msgWrapMe: { alignItems: 'flex-end' },
  msgBubble: { maxWidth: '80%', borderRadius: 16, padding: 12, gap: 4 },
  msgBubbleMe: { backgroundColor: '#2D5DC9', borderBottomRightRadius: 4 },
  msgBubbleOther: { backgroundColor: '#F0F4FF', borderBottomLeftRadius: 4 },
  msgSender: { fontSize: 10, fontWeight: '800', color: '#7B4FCA', marginBottom: 2 },
  msgText: { fontSize: 14, color: '#1a1a2e', lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgTime: { fontSize: 9, color: '#525C6B', alignSelf: 'flex-end' },
  msgTimeMe: { color: '#fff' },

  // Reply bar
  replyBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#F0F0F8' },
  replyInput: { flex: 1, backgroundColor: '#F5F7FF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1a1a2e', maxHeight: 100 },
  replyBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2D5DC9', alignItems: 'center', justifyContent: 'center' },

  // Fields
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 },
  fieldInput: { backgroundColor: '#F5F7FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1a1a2e', borderWidth: 1, borderColor: '#E0E4F0' },

  // Category chips
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F4FF', borderWidth: 1, borderColor: '#E0E4F0' },
  catChipActive: { backgroundColor: '#2D5DC9', borderColor: '#2D5DC9' },
  catChipText: { fontSize: 12, fontWeight: '700', color: '#6B7C9A' },
  catChipTextActive: { color: '#fff' },
  tagBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tagBadgeText: { fontSize: 9, fontWeight: '800' },

  // Dropdown (floating)
  dropdownList: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E4F0', borderRadius: 12, marginTop: 4, elevation: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, zIndex: 999, overflow: 'hidden' },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  dropdownItemActive: { backgroundColor: '#EBF4FF' },
  dropdownItemText: { fontSize: 13, color: '#3D4860', fontWeight: '500' },
  dropdownItemTextActive: { color: '#2D5DC9', fontWeight: '700' },
});
