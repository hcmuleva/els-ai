/**
 * TeacherFeedbackTab - Feedback management for teachers.
 * Features: Class filter, student search (name/email/number), recent conversations.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MessageCircle, Send, Plus, ChevronRight, X, Users, User, Clock, Search, Filter } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { getStandardLabel } from '../../constants/standards';

type StudentResult = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  classLevel: string;
  hasLinkedParent: boolean;
};

type FeedbackThread = {
  id: string;
  studentId: string;
  studentName: string;
  classroomId: string | null;
  subject: string;
  status: string;
  category: string | null;
  topicId: string | null;
  topicTitle: string | null;
  description: string | null;
  createdBy: string;
  createdByRole: string;
  messageCount: number;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
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
};

type ParentFeedbackItem = {
  id: string;
  feedback: string;
  attachmentUrl: string | null;
  createdAt: string;
};

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
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function TeacherFeedbackTab() {
  const { apiFetch, user } = useAuth();
  const { onFeedbackMessage } = useNotifications();
  const [view, setView] = useState<'recent' | 'students'>('recent');
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);

  // Class filter + student search
  const [classLevels, setClassLevels] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<StudentResult[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selected student view
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const [studentFeedback, setStudentFeedback] = useState<ParentFeedbackItem[]>([]);
  const [studentThreads, setStudentThreads] = useState<FeedbackThread[]>([]);
  const [studentDataLoading, setStudentDataLoading] = useState(false);

  // Thread detail + real-time via Ably
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyType, setReplyType] = useState<'general' | 'observation' | 'action_plan' | 'recommendation'>('general');
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const loadingOlderRef = useRef(false);
  const threadIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<ScrollView | null>(null);

  // New thread
  const [newThreadVisible, setNewThreadVisible] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [creating, setCreating] = useState(false);

  // Load class levels on mount
  useEffect(() => {
    apiFetch('/feedback/class-levels').then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setClassLevels(data.classLevels || []);
      }
    }).catch(() => {});
  }, [apiFetch]);

  // Fetch recent threads
  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const [threadsRes, unreadRes] = await Promise.all([
        apiFetch('/feedback/threads?limit=50'),
        apiFetch('/feedback/unread-count'),
      ]);
      if (threadsRes.ok) {
        const data = await threadsRes.json();
        setThreads(data.threads || []);
      }
      if (unreadRes.ok) {
        const data = await unreadRes.json();
        setTotalUnread(data.unread || 0);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // Search students with debounce
  const searchStudents = useCallback(async (query: string, classLevel: string) => {
    setStudentsLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('query', query);
      if (classLevel) params.set('classLevel', classLevel);
      params.set('limit', '30');
      const res = await apiFetch(`/feedback/students?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch { /* silent */ }
    finally { setStudentsLoading(false); }
  }, [apiFetch]);

  useEffect(() => {
    if (view !== 'students') return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      searchStudents(searchQuery, selectedClass);
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery, selectedClass, view, searchStudents]);

  // Load student-specific data
  const openStudent = async (student: StudentResult) => {
    setSelectedStudent(student);
    setStudentDataLoading(true);
    try {
      const [fbRes, thRes] = await Promise.all([
        apiFetch(`/students/${student.id}/parent-feedback?limit=20`),
        apiFetch(`/feedback/threads?studentId=${student.id}&limit=20`),
      ]);
      if (fbRes.ok) {
        const data = await fbRes.json();
        setStudentFeedback(data.items || []);
      }
      if (thRes.ok) {
        const data = await thRes.json();
        setStudentThreads(data.threads || []);
      }
    } catch { /* silent */ }
    finally { setStudentDataLoading(false); }
  };

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
  useEffect(() => {
    threadIdRef.current = threadDetail?.thread.id || null;
  }, [threadDetail?.thread.id]);

  useEffect(() => {
    const unsub = onFeedbackMessage((event) => {
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
      fetchThreads();
    });
    return unsub;
  }, [onFeedbackMessage, apiFetch, fetchThreads]);

  const sendReply = async () => {
    if (!replyText.trim() || !threadDetail) return;
    setSending(true);
    try {
      const res = await apiFetch(`/feedback/threads/${threadDetail.thread.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim(), responseType: replyType }),
      });
      if (res.ok) {
        const msg = await res.json();
        setThreadDetail((prev) => prev ? {
          ...prev,
          messages: [...prev.messages, {
            id: msg.id,
            senderUserId: user?.id || '',
            senderRole: 'teacher',
            senderName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
            message: msg.message,
            responseType: msg.responseType || null,
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
    if (!selectedStudent || !newSubject.trim() || !newMessage.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch('/feedback/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          subject: newSubject.trim(),
          message: newMessage.trim(),
        }),
      });
      if (res.ok) {
        setNewThreadVisible(false);
        setNewSubject('');
        setNewMessage('');
        openStudent(selectedStudent);
        fetchThreads();
      }
    } catch { /* silent */ }
    finally { setCreating(false); }
  };

  if (loading && view === 'recent') {
    return (
      <View style={ts.loaderWrap}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={ts.loaderText}>Loading feedback...</Text>
      </View>
    );
  }

  return (
    <View style={ts.container}>
      {/* View switcher */}
      <View style={ts.viewSwitcher}>
        <Pressable style={[ts.viewBtn, view === 'recent' && ts.viewBtnActive]} onPress={() => setView('recent')}>
          <Clock size={13} color={view === 'recent' ? '#4A90E2' : '#9A9AB0'} />
          <Text style={[ts.viewBtnText, view === 'recent' && ts.viewBtnTextActive]}>Recent</Text>
          {totalUnread > 0 && (
            <View style={ts.unreadBadge}><Text style={ts.unreadBadgeText}>{totalUnread}</Text></View>
          )}
        </Pressable>
        <Pressable style={[ts.viewBtn, view === 'students' && ts.viewBtnActive]} onPress={() => setView('students')}>
          <Users size={13} color={view === 'students' ? '#4A90E2' : '#9A9AB0'} />
          <Text style={[ts.viewBtnText, view === 'students' && ts.viewBtnTextActive]}>Find Student</Text>
        </Pressable>
      </View>

      {/* ══ RECENT VIEW ═══════════════════════════════════════════════════════ */}
      {view === 'recent' && (
        <View style={ts.content}>
          {threads.length === 0 ? (
            <View style={ts.emptyState}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={ts.emptyTitle}>No Feedback Yet</Text>
              <Text style={ts.emptyText}>
                Switch to "Find Student" to search by class, name, email or number and send feedback to parents.
              </Text>
            </View>
          ) : (
            threads.map((thread) => (
              <Pressable key={thread.id} style={ts.threadCard} onPress={() => openThread(thread.id)}>
                <View style={ts.threadRow}>
                  <View style={[ts.threadAvatar, thread.unreadCount > 0 && ts.threadAvatarUnread]}>
                    <Text style={ts.threadAvatarText}>{(thread.studentName || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 2, flexWrap: 'wrap' }}>
                      {thread.category && (
                        <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: thread.category === 'academic' ? '#E3F2FD' : '#FFF3E0' }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: thread.category === 'academic' ? '#1976D2' : '#E65100' }}>
                            {thread.category === 'academic' ? 'Academic' : 'Non-Academic'}
                          </Text>
                        </View>
                      )}
                      {thread.topicTitle && (
                        <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: '#F3E5F5' }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#7B1FA2' }}>{thread.topicTitle}</Text>
                        </View>
                      )}
                    </View>
                    <View style={ts.threadTitleRow}>
                      <Text style={ts.threadSubject} numberOfLines={1}>{thread.subject}</Text>
                      {thread.unreadCount > 0 && (
                        <View style={ts.threadUnread}><Text style={ts.threadUnreadText}>{thread.unreadCount}</Text></View>
                      )}
                    </View>
                    <Text style={ts.threadStudentName}>{thread.studentName}</Text>
                    {thread.lastMessage && (
                      <Text style={ts.threadLastMsg} numberOfLines={1}>
                        {thread.createdByRole === 'parent' ? 'Parent: ' : 'You: '}{thread.lastMessage}
                      </Text>
                    )}
                  </View>
                  <View style={ts.threadMeta}>
                    <Text style={ts.threadTime}>{thread.lastMessageAt ? timeAgo(thread.lastMessageAt) : formatDate(thread.createdAt)}</Text>
                    <View style={[ts.statusDot, { backgroundColor: thread.status === 'open' ? '#4CAF50' : '#9A9AB0' }]} />
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>
      )}

      {/* ══ STUDENTS VIEW (Class filter + Search) ═════════════════════════════ */}
      {view === 'students' && !selectedStudent && (
        <View style={ts.content}>
          {/* Class filter chips */}
          <View style={ts.filterSection}>
            <View style={ts.filterLabelRow}>
              <Filter size={12} color="#9A9AB0" />
              <Text style={ts.filterLabel}>Filter by Class</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={ts.chipRow}>
                <Pressable
                  style={[ts.classChip, !selectedClass && ts.classChipActive]}
                  onPress={() => setSelectedClass('')}
                >
                  <Text style={[ts.classChipText, !selectedClass && ts.classChipTextActive]}>All</Text>
                </Pressable>
                {classLevels.map((cl) => (
                  <Pressable
                    key={cl}
                    style={[ts.classChip, selectedClass === cl && ts.classChipActive]}
                    onPress={() => setSelectedClass(selectedClass === cl ? '' : cl)}
                  >
                    <Text style={[ts.classChipText, selectedClass === cl && ts.classChipTextActive]}>
                      {getStandardLabel(cl) || cl}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Search bar */}
          <View style={ts.searchBar}>
            <Search size={16} color="#9A9AB0" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name, email, or number..."
              style={ts.searchInput}
              placeholderTextColor="#B0B8D0"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={14} color="#9A9AB0" />
              </Pressable>
            ) : null}
          </View>

          {/* Student results */}
          {studentsLoading ? (
            <ActivityIndicator size="small" color="#4A90E2" style={{ marginTop: 20 }} />
          ) : students.length === 0 ? (
            <View style={ts.emptyState}>
              <Text style={{ fontSize: 36 }}>🔍</Text>
              <Text style={ts.emptyTitle}>
                {searchQuery || selectedClass ? 'No Students Found' : 'Search for Students'}
              </Text>
              <Text style={ts.emptyText}>
                {searchQuery || selectedClass
                  ? 'Try a different search term or class filter.'
                  : 'Select a class or type a name, email, or phone number to find students.'}
              </Text>
            </View>
          ) : (
            <View style={ts.studentList}>
              {students.map((s) => (
                <Pressable key={s.id} style={ts.studentCard} onPress={() => openStudent(s)}>
                  <View style={ts.studentAvatar}>
                    <Text style={ts.studentAvatarText}>
                      {s.firstName[0]?.toUpperCase()}{s.lastName[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ts.studentName}>{s.firstName} {s.lastName}</Text>
                    <Text style={ts.studentMeta}>
                      {s.classLevel ? getStandardLabel(s.classLevel) : 'No class'}
                      {s.email ? ` · ${s.email}` : ''}
                    </Text>
                    {s.mobileNumber ? <Text style={ts.studentMeta}>{s.mobileNumber}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {s.hasLinkedParent ? (
                      <View style={ts.linkedBadge}><Text style={ts.linkedBadgeText}>Parent linked</Text></View>
                    ) : (
                      <View style={ts.noParentBadge}><Text style={ts.noParentBadgeText}>No parent</Text></View>
                    )}
                    <ChevronRight size={14} color="#9A9AB0" />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ══ SELECTED STUDENT DETAIL ═══════════════════════════════════════════ */}
      {view === 'students' && selectedStudent && (
        <View style={ts.content}>
          <Pressable onPress={() => { setSelectedStudent(null); setStudentFeedback([]); setStudentThreads([]); }}>
            <Text style={ts.backLink}>← Back to search</Text>
          </Pressable>

          <View style={ts.studentDetailHeader}>
            <View style={[ts.studentAvatar, { width: 44, height: 44, borderRadius: 22 }]}>
              <Text style={[ts.studentAvatarText, { fontSize: 16 }]}>
                {selectedStudent.firstName[0]?.toUpperCase()}{selectedStudent.lastName[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ts.studentDetailName}>{selectedStudent.firstName} {selectedStudent.lastName}</Text>
              <Text style={ts.studentMeta}>
                {selectedStudent.classLevel ? getStandardLabel(selectedStudent.classLevel) : ''} · {selectedStudent.email || selectedStudent.mobileNumber || ''}
              </Text>
            </View>
            {selectedStudent.hasLinkedParent && (
              <Pressable style={ts.sendFeedbackBtn} onPress={() => setNewThreadVisible(true)}>
                <Send size={12} color="#fff" />
                <Text style={ts.sendFeedbackBtnText}>Message</Text>
              </Pressable>
            )}
          </View>

          {!selectedStudent.hasLinkedParent && (
            <View style={ts.warningBox}>
              <Text style={ts.warningText}>No parent is linked to this student. Feedback cannot be delivered until a parent registers and links to this student.</Text>
            </View>
          )}

          {studentDataLoading ? (
            <ActivityIndicator size="small" color="#4A90E2" style={{ marginTop: 20 }} />
          ) : (
            <>
              {/* Parent feedback submissions */}
              <Text style={ts.subSectionTitle}>Parent Feedback ({studentFeedback.length})</Text>
              {studentFeedback.length === 0 ? (
                <Text style={ts.emptySmall}>No feedback submitted by parent yet.</Text>
              ) : (
                studentFeedback.map((item) => (
                  <View key={item.id} style={ts.feedbackCard}>
                    <Text style={ts.feedbackText}>{item.feedback}</Text>
                    <Text style={ts.feedbackDate}>{formatDate(item.createdAt)}</Text>
                  </View>
                ))
              )}

              {/* Conversation threads */}
              <Text style={ts.subSectionTitle}>Conversations ({studentThreads.length})</Text>
              {studentThreads.length === 0 ? (
                <Text style={ts.emptySmall}>No conversations yet. Tap "Message" to start one.</Text>
              ) : (
                studentThreads.map((thread) => (
                  <Pressable key={thread.id} style={ts.threadCard} onPress={() => openThread(thread.id)}>
                    <View style={ts.threadRow}>
                      <MessageCircle size={16} color={thread.unreadCount > 0 ? '#4A90E2' : '#9A9AB0'} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <View style={{ flexDirection: 'row', gap: 4, marginBottom: 2 }}>
                          {thread.topicTitle && (
                            <View style={{ paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: '#F3E5F5' }}>
                              <Text style={{ fontSize: 8, fontWeight: '800', color: '#7B1FA2' }}>{thread.topicTitle}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={ts.threadSubject}>{thread.subject}</Text>
                        {thread.lastMessage && <Text style={ts.threadLastMsg} numberOfLines={1}>{thread.lastMessage}</Text>}
                      </View>
                      {thread.unreadCount > 0 && (
                        <View style={ts.threadUnread}><Text style={ts.threadUnreadText}>{thread.unreadCount}</Text></View>
                      )}
                      <Text style={ts.threadTime}>{thread.lastMessageAt ? timeAgo(thread.lastMessageAt) : ''}</Text>
                    </View>
                  </Pressable>
                ))
              )}
            </>
          )}
        </View>
      )}

      {/* ══ THREAD DETAIL MODAL ═══════════════════════════════════════════════ */}
      <Modal visible={!!threadDetail || threadLoading} transparent animationType="slide" onRequestClose={() => setThreadDetail(null)}>
        <View style={ts.modalOverlay}>
          <View style={ts.modalSheet}>
            {threadLoading ? (
              <View style={ts.loaderWrap}><ActivityIndicator size="large" color="#4A90E2" /></View>
            ) : threadDetail ? (
              <>
                <View style={ts.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                      {threadDetail.thread.category && (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: threadDetail.thread.category === 'academic' ? '#E3F2FD' : '#FFF3E0' }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: threadDetail.thread.category === 'academic' ? '#1976D2' : '#E65100' }}>
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
                    <Text style={ts.modalTitle}>{threadDetail.thread.subject}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={ts.modalSub}>{threadDetail.thread.studentName}</Text>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' }} />
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#4CAF50' }}>Live</Text>
                    </View>
                  </View>
                  <Pressable style={ts.modalClose} onPress={() => setThreadDetail(null)}>
                    <X size={18} color="#9A9AB0" />
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <ScrollView
                    ref={messagesEndRef}
                    style={ts.messagesArea}
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
                          <ActivityIndicator size="small" color="#4A90E2" />
                        ) : (
                          <Text style={{ color: '#4A90E2', fontSize: 12, fontWeight: '600' }}>Load older messages</Text>
                        )}
                      </Pressable>
                    )}
                    {threadDetail.messages.map((msg) => {
                      const isMe = msg.senderUserId === user?.id;
                      const typeLabel = msg.responseType && msg.responseType !== 'general'
                        ? msg.responseType.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                        : null;
                      return (
                        <View key={msg.id} style={[ts.msgWrap, isMe && ts.msgWrapMe]}>
                          <View style={[ts.msgBubble, isMe ? ts.msgBubbleMe : ts.msgBubbleOther]}>
                            {!isMe && <Text style={ts.msgSender}>{msg.senderName || msg.senderRole}</Text>}
                            {typeLabel && (
                              <View style={{ alignSelf: 'flex-start', backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#E8EAF6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 }}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: isMe ? '#fff' : '#3949AB' }}>{typeLabel}</Text>
                              </View>
                            )}
                            <Text style={[ts.msgText, isMe && ts.msgTextMe]}>{msg.message}</Text>
                            <Text style={[ts.msgTime, isMe && ts.msgTimeMe]}>{formatTime(msg.createdAt)}</Text>
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
                        backgroundColor: '#4A90E2', paddingHorizontal: 14, paddingVertical: 7,
                        borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15,
                        shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>↓ Latest</Text>
                    </Pressable>
                  )}
                </View>
                {threadDetail.thread.status === 'open' && (
                  <View style={{ borderTopWidth: 1, borderTopColor: '#F0F0F8' }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12, paddingTop: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {([
                          ['general', 'General'],
                          ['observation', 'Observation'],
                          ['action_plan', 'Action Plan'],
                          ['recommendation', 'Recommendation'],
                        ] as const).map(([key, label]) => (
                          <Pressable
                            key={key}
                            onPress={() => setReplyType(key)}
                            style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: replyType === key ? '#4A90E2' : '#F0F4FF' }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: replyType === key ? '#fff' : '#6B7C9A' }}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                    <View style={ts.replyBar}>
                      <TextInput
                        value={replyText}
                        onChangeText={setReplyText}
                        placeholder="Type your response..."
                        style={ts.replyInput}
                        placeholderTextColor="#B0B8D0"
                        multiline
                      />
                      <Pressable
                        style={[ts.replyBtn, (!replyText.trim() || sending) && { opacity: 0.5 }]}
                        onPress={sendReply}
                        disabled={!replyText.trim() || sending}
                      >
                        {sending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={16} color="#fff" />}
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ══ NEW THREAD MODAL ══════════════════════════════════════════════════ */}
      <Modal visible={newThreadVisible} transparent animationType="fade" onRequestClose={() => setNewThreadVisible(false)}>
        <View style={ts.modalOverlay}>
          <View style={[ts.modalSheet, { maxHeight: '60%' }]}>
            <View style={ts.modalHeader}>
              <View>
                <Text style={ts.modalTitle}>Send Feedback to Parent</Text>
                {selectedStudent && (
                  <Text style={ts.modalSub}>For: {selectedStudent.firstName} {selectedStudent.lastName}</Text>
                )}
              </View>
              <Pressable style={ts.modalClose} onPress={() => setNewThreadVisible(false)}>
                <X size={18} color="#9A9AB0" />
              </Pressable>
            </View>
            <View style={{ padding: 16, gap: 14 }}>
              <View>
                <Text style={ts.fieldLabel}>Subject</Text>
                <TextInput
                  value={newSubject}
                  onChangeText={setNewSubject}
                  placeholder="e.g. Weekly Progress, Behavior Update, Homework..."
                  style={ts.fieldInput}
                  placeholderTextColor="#B0B8D0"
                />
              </View>
              <View>
                <Text style={ts.fieldLabel}>Message</Text>
                <TextInput
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Write your feedback or message for the parent..."
                  multiline
                  style={[ts.fieldInput, { minHeight: 100 }]}
                  placeholderTextColor="#B0B8D0"
                  textAlignVertical="top"
                />
              </View>
              <Pressable
                style={[ts.submitBtn, (!newSubject.trim() || !newMessage.trim() || creating) && ts.submitBtnDisabled]}
                onPress={createThread}
                disabled={!newSubject.trim() || !newMessage.trim() || creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Send size={14} color="#fff" />
                    <Text style={ts.submitBtnText}>Send to Parent</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ts = StyleSheet.create({
  container: { gap: 12 },
  loaderWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loaderText: { fontSize: 13, color: '#9A9AB0', fontWeight: '600' },

  viewSwitcher: { flexDirection: 'row', backgroundColor: '#F5F7FF', borderRadius: 14, padding: 4, gap: 4 },
  viewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 11 },
  viewBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: '#9A9AB0' },
  viewBtnTextActive: { color: '#4A90E2', fontWeight: '800' },
  unreadBadge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  unreadBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },

  content: { gap: 10 },

  // Filter
  filterSection: { gap: 6 },
  filterLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterLabel: { fontSize: 11, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.4 },
  chipRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  classChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F0F0F8', borderWidth: 1, borderColor: '#E0E4F0' },
  classChipActive: { backgroundColor: '#D6EAFF', borderColor: '#4A90E2' },
  classChipText: { fontSize: 12, fontWeight: '700', color: '#6B7C9A' },
  classChipTextActive: { color: '#1A4DA2', fontWeight: '800' },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F7FF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E0E4F0' },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a2e', paddingVertical: 0 },

  // Student list
  studentList: { gap: 6 },
  studentCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F0F0F8' },
  studentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EDE4FF', alignItems: 'center', justifyContent: 'center' },
  studentAvatarText: { fontSize: 13, fontWeight: '900', color: '#7B4FCA' },
  studentName: { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  studentMeta: { fontSize: 10, color: '#9A9AB0', fontWeight: '500' },
  linkedBadge: { backgroundColor: '#D6F5D6', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  linkedBadgeText: { fontSize: 9, fontWeight: '800', color: '#2E7D32' },
  noParentBadge: { backgroundColor: '#FFF5CC', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  noParentBadgeText: { fontSize: 9, fontWeight: '800', color: '#E6A020' },

  // Student detail
  backLink: { fontSize: 12, fontWeight: '700', color: '#4A90E2' },
  studentDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8F9FF', borderRadius: 16, padding: 14 },
  studentDetailName: { fontSize: 15, fontWeight: '900', color: '#1a1a2e' },
  sendFeedbackBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#4A90E2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  sendFeedbackBtnText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  warningBox: { backgroundColor: '#FFF5CC', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FFE082' },
  warningText: { fontSize: 11, color: '#E6A020', fontWeight: '600', lineHeight: 16 },
  subSectionTitle: { fontSize: 11, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10 },
  emptySmall: { fontSize: 12, color: '#9A9AB0', fontStyle: 'italic', paddingVertical: 4 },
  feedbackCard: { backgroundColor: '#F8F9FF', borderRadius: 12, padding: 12, gap: 4 },
  feedbackText: { fontSize: 13, color: '#1a1a2e', lineHeight: 20 },
  feedbackDate: { fontSize: 10, color: '#9A9AB0', fontWeight: '500' },

  // Threads
  threadCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F0F0F8' },
  threadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  threadAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0F4FF', alignItems: 'center', justifyContent: 'center' },
  threadAvatarUnread: { backgroundColor: '#D6EAFF', borderWidth: 2, borderColor: '#4A90E2' },
  threadAvatarText: { fontSize: 14, fontWeight: '900', color: '#4A90E2' },
  threadTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  threadSubject: { fontSize: 13, fontWeight: '800', color: '#1a1a2e', flex: 1 },
  threadStudentName: { fontSize: 11, color: '#9A9AB0', fontWeight: '600' },
  threadLastMsg: { fontSize: 11, color: '#6B7C9A', marginTop: 2 },
  threadUnread: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  threadUnreadText: { fontSize: 9, fontWeight: '900', color: '#fff' },
  threadMeta: { alignItems: 'flex-end', gap: 4 },
  threadTime: { fontSize: 10, color: '#9A9AB0', fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a2e' },
  emptyText: { fontSize: 12, color: '#9A9AB0', textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', minHeight: '60%', paddingBottom: Platform.OS === 'ios' ? 32 : 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#1a1a2e' },
  modalSub: { fontSize: 11, color: '#9A9AB0', fontWeight: '500', marginTop: 2 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F7FF', alignItems: 'center', justifyContent: 'center' },

  // Messages
  messagesArea: { flex: 1, paddingHorizontal: 16 },
  msgWrap: { marginBottom: 10, alignItems: 'flex-start' },
  msgWrapMe: { alignItems: 'flex-end' },
  msgBubble: { maxWidth: '80%', borderRadius: 16, padding: 12, gap: 4 },
  msgBubbleMe: { backgroundColor: '#4A90E2', borderBottomRightRadius: 4 },
  msgBubbleOther: { backgroundColor: '#F0F4FF', borderBottomLeftRadius: 4 },
  msgSender: { fontSize: 10, fontWeight: '800', color: '#7B4FCA', marginBottom: 2 },
  msgText: { fontSize: 14, color: '#1a1a2e', lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgTime: { fontSize: 9, color: '#9A9AB0', alignSelf: 'flex-end' },
  msgTimeMe: { color: 'rgba(255,255,255,0.7)' },

  // Reply
  replyBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#F0F0F8' },
  replyInput: { flex: 1, backgroundColor: '#F5F7FF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1a1a2e', maxHeight: 100 },
  replyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4A90E2', alignItems: 'center', justifyContent: 'center' },

  // Fields
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 },
  fieldInput: { backgroundColor: '#F5F7FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1a1a2e', borderWidth: 1, borderColor: '#E0E4F0' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4A90E2', borderRadius: 14, paddingVertical: 14 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
