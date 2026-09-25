import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
   TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Compass,
  Copy,
  HelpCircle,
  History,
  Lightbulb,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  Send,
  Sidebar,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  X,
} from 'lucide-react-native';
import { useAiChat } from '../../context/AiChatContext';
import { useAuth } from '../../context/AuthContext';
import { Colors, Radius, Shadow, Spacing } from '../../theme';
import { ChatMarkdown } from './ChatMarkdown';
import { ProposalCard, extractProposalFromMessage } from './ProposalCard';
import { EntityRevisionCard } from './EntityRevisionCard';
import { ClarifyingQuestionCard } from './ClarifyingQuestionCard';
import { ThinkingStream } from './ThinkingStream';
import { StudentDiagnosticCard } from './StudentDiagnosticCard';
import { LearningGapCard } from './LearningGapCard';
import { StudentReportCardModal } from './StudentReportCardModal';
import {
  searchStudents,
  fetchStudentPerformanceSummary,
  type StudentPerformanceSummaryData,
} from '../../services/aiChat';

const WIDE_BREAKPOINT = 768;
const PANEL_WIDTH = 480;

function CopyMessageBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Pressable
      onPress={handleCopy}
      style={s.bubbleCopyBtn}
      hitSlop={6}
      accessibilityLabel="Copy response"
    >
      {copied ? (
        <>
          <Check size={12} color={Colors.success} strokeWidth={2.5} />
          <Text style={[s.bubbleCopyBtnText, { color: Colors.success }]}>Copied</Text>
        </>
      ) : (
        <>
          <Copy size={12} color={Colors.textMuted} strokeWidth={2} />
          <Text style={s.bubbleCopyBtnText}>Copy</Text>
        </>
      )}
    </Pressable>
  );
}

const ROLE_GREETING: Record<string, string> = {
  teacher: 'Ask me to help plan a lesson, draft questions, or make sense of class performance.',
  student: "Ask me to explain a topic, help with homework, or quiz you on something you're learning.",
  parent: "Ask me about your child's progress, learning trends, or how to support them at home.",
  admin: 'Ask me about platform analytics, configuration, or day-to-day operations.',
  superadmin: 'Ask me about platform-wide operations, health, or administrative tasks.',
};

interface StarterPrompt {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  icon: 'lightbulb' | 'sparkles' | 'book' | 'trends' | 'help';
}

function getRoleStarters(role: string): StarterPrompt[] {
  switch (role) {
    case 'teacher':
      return [
        {
          id: 't1',
          title: 'Draft a Quiz',
          subtitle: '5 questions with distractors',
          prompt: 'Draft a 5-question multiple choice quiz on reading comprehension with answer explanations.',
          icon: 'lightbulb',
        },
        {
          id: 't2',
          title: 'Remedial Strategy',
          subtitle: 'Target learning gaps',
          prompt: 'Suggest effective intervention strategies and lesson activities for students struggling with reading comprehension.',
          icon: 'trends',
        },
        {
          id: 't3',
          title: 'Lesson Activity',
          subtitle: 'Active learning ideas',
          prompt: 'Suggest interactive, play-based learning activities for teaching phonics and word formation.',
          icon: 'book',
        },
        {
          id: 't4',
          title: 'How It Works',
          subtitle: 'Understanding AI verification',
          prompt: 'How does ELS AI evaluate questions, verify student answers, and log reviewable observations?',
          icon: 'help',
        },
      ];
    case 'parent':
      return [
        {
          id: 'p1',
          title: 'Study Routine',
          subtitle: 'Daily learning structure',
          prompt: 'How can I set up an effective, stress-free 20-minute daily study routine for my child?',
          icon: 'trends',
        },
        {
          id: 'p2',
          title: 'Study Habits',
          subtitle: 'Tips for focus & routine',
          prompt: 'What are effective, positive ways to help my child stay focused during 15-minute study sessions?',
          icon: 'lightbulb',
        },
        {
          id: 'p3',
          title: 'Reading Support',
          subtitle: 'Phonics & stories at home',
          prompt: 'What reading activities or stories can we practice at home to build confidence with tricky letters?',
          icon: 'book',
        },
        {
          id: 'p4',
          title: 'How It Works',
          subtitle: 'Survey & teacher notes',
          prompt: 'How do my survey answers and home observations get shared with my child’s teachers?',
          icon: 'help',
        },
      ];
    case 'student':
      return [
        {
          id: 's1',
          title: 'Quiz Me',
          subtitle: 'Test your knowledge',
          prompt: 'Give me a fun 3-question quiz on science and let me answer one by one!',
          icon: 'lightbulb',
        },
        {
          id: 's2',
          title: 'Explain Simply',
          subtitle: 'Break down hard ideas',
          prompt: 'Can you explain how the solar system works using a simple story or analogy?',
          icon: 'book',
        },
        {
          id: 's3',
          title: 'Tell a Story',
          subtitle: 'Curiosity & adventure',
          prompt: 'Tell me an inspiring story about a young student who solved a mystery with science!',
          icon: 'sparkles',
        },
        {
          id: 's4',
          title: 'How It Works',
          subtitle: 'Your learning buddy',
          prompt: 'What subjects and activities can you help me practice today?',
          icon: 'help',
        },
      ];
    default:
      return [
        {
          id: 'a1',
          title: 'System Health',
          subtitle: 'Review operational status',
          prompt: 'Show me an overview of platform activity, quiz completions, and active tenant sessions.',
          icon: 'trends',
        },
        {
          id: 'a2',
          title: 'Curriculum Audit',
          subtitle: 'Review generated topics',
          prompt: 'Summarize recent AI-generated curriculum topics and pending review items.',
          icon: 'book',
        },
        {
          id: 'a3',
          title: 'How It Works',
          subtitle: 'Multi-agent architecture',
          prompt: 'Explain how the AI orchestrator, Jev System One engine, and review queues work together.',
          icon: 'help',
        },
        {
          id: 'a4',
          title: 'Troubleshooting',
          subtitle: 'Quick operational guide',
          prompt: 'What tools and monitoring commands are available for system maintenance?',
          icon: 'lightbulb',
        },
      ];
  }
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function AnimatedTypingDots() {
  const anim1 = useRef(new Animated.Value(0.2)).current;
  const anim2 = useRef(new Animated.Value(0.2)).current;
  const anim3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const isNative = Platform.OS !== 'web';
    const createPulse = (val: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(val, {
              toValue: 1,
              duration: 360,
              useNativeDriver: isNative,
            }),
            Animated.timing(val, {
              toValue: 0.2,
              duration: 360,
              useNativeDriver: isNative,
            }),
          ])
        ),
      ]);

    const a1 = createPulse(anim1, 0);
    const a2 = createPulse(anim2, 160);
    const a3 = createPulse(anim3, 320);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      anim1.stopAnimation();
      anim2.stopAnimation();
      anim3.stopAnimation();
    };
  }, [anim1, anim2, anim3]);

  return (
    <View style={s.typingDotsContainer}>
      <Animated.View
        style={[
          s.typingDot,
          {
            opacity: anim1,
            transform: [
              {
                translateY: anim1.interpolate({
                  inputRange: [0.25, 1],
                  outputRange: [0, -3.5],
                }),
              },
              {
                scale: anim1.interpolate({
                  inputRange: [0.25, 1],
                  outputRange: [0.85, 1.15],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          s.typingDot,
          {
            opacity: anim2,
            transform: [
              {
                translateY: anim2.interpolate({
                  inputRange: [0.25, 1],
                  outputRange: [0, -3.5],
                }),
              },
              {
                scale: anim2.interpolate({
                  inputRange: [0.25, 1],
                  outputRange: [0.85, 1.15],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          s.typingDot,
          {
            opacity: anim3,
            transform: [
              {
                translateY: anim3.interpolate({
                  inputRange: [0.25, 1],
                  outputRange: [0, -3.5],
                }),
              },
              {
                scale: anim3.interpolate({
                  inputRange: [0.25, 1],
                  outputRange: [0.85, 1.15],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

export function ChatPanel() {
  const {
    isOpen,
    close,
    conversations,
    isLoadingConversations,
    activeConversationId,
    messages,
    isLoadingMessages,
    selectConversation,
    startNewConversation,
    streamingReply,
    streamingThinking,
    isThinking,
    isSending,
    sendError,
    sendMessage,
    removeConversation,
  } = useAiChat();
  const { user, apiFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const isTeacherOrStaff = ['teacher', 'admin', 'superadmin', 'coordinator'].includes(user?.activeRole || '');

  // ── Student Context State (for Teachers & Staff) ───────────
  const [selectedStudent, setSelectedStudent] = useState<StudentPerformanceSummaryData | null>(null);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<
    Array<{ id: string; firstName: string; lastName: string; email: string; classLevel?: string }>
  >([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [isLoadingStudentSummary, setIsLoadingStudentSummary] = useState(false);
  const [showDiagnosticCardInChat, setShowDiagnosticCardInChat] = useState(false);
  const [showReportCardModal, setShowReportCardModal] = useState(false);

  // Debounced student search
  useEffect(() => {
    if (!showStudentPicker) return;
    let isMounted = true;
    setIsSearchingStudents(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchStudents(apiFetch, studentQuery);
        if (isMounted) {
          setStudentResults(results);
          setIsSearchingStudents(false);
        }
      } catch {
        if (isMounted) {
          setStudentResults([]);
          setIsSearchingStudents(false);
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [showStudentPicker, studentQuery, apiFetch]);

  const handleSelectStudent = async (studentId: string) => {
    setShowStudentPicker(false);
    setIsLoadingStudentSummary(true);
    try {
      const summary = await fetchStudentPerformanceSummary(apiFetch, studentId);
      if (summary) {
        setSelectedStudent(summary);
        setShowDiagnosticCardInChat(true);
      }
    } finally {
      setIsLoadingStudentSummary(false);
    }
  };

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setShowDiagnosticCardInChat(false);
  };

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [draft, setDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // ── Persist & Rehydrate View State ─────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('els_chat_view_state')
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.isFullscreen === 'boolean') {
            setIsFullscreen(parsed.isFullscreen);
          }
          if (typeof parsed.showSidebar === 'boolean') {
            setShowSidebar(parsed.showSidebar);
          }
        }
      })
      .catch(() => {});
  }, []);

  const persistViewState = (fullscreen: boolean, sidebar: boolean) => {
    AsyncStorage.setItem(
      'els_chat_view_state',
      JSON.stringify({ isFullscreen: fullscreen, showSidebar: sidebar })
    ).catch(() => {});
  };

  const handleToggleFullscreen = (nextVal: boolean) => {
    setIsFullscreen(nextVal);
    persistViewState(nextVal, showSidebar);
  };

  const handleToggleSidebar = () => {
    setShowSidebar((prev) => {
      const next = !prev;
      persistViewState(isFullscreen, next);
      return next;
    });
  };

  const role = user?.activeRole || 'student';
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const greeting = ROLE_GREETING[role] || ROLE_GREETING.student;
  const starters = useMemo(() => getRoleStarters(role), [role]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    await removeConversation(targetId);
  };

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const filteredConversations = useMemo(() => {
    if (!searchFilter.trim()) return conversations;
    const q = searchFilter.toLowerCase();
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q));
  }, [conversations, searchFilter]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : draft).trim();
    if (!text || isSending) return;
    if (
      text.toLowerCase().includes('view official report card') ||
      text.toLowerCase().includes('open report card') ||
      text.toLowerCase().includes('view report card')
    ) {
      setShowReportCardModal(true);
      return;
    }
    setDraft('');
    setView('chat');
    void sendMessage(text, selectedStudent);
  };

  const handleSelectConversation = async (id: string) => {
    setView('chat');
    await selectConversation(id);
  };

  const quickActionChips = [
    'How does this work?',
    'Explain step-by-step',
    'Summarize key takeaways',
    'Suggest next practice',
  ];

  const studentActionChips = useMemo(() => {
    if (!selectedStudent) return [];
    const name = selectedStudent.student.firstName || selectedStudent.student.name.split(' ')[0] || 'Student';
    return [
      `📄 View official report card for ${name}`,
      `Summarize ${name}'s verified DB performance report`,
      `What are ${name}'s weak areas and learning gaps?`,
      `Show ${name}'s best performed quiz & strengths`,
      `What is the recommended intervention plan for ${name}?`,
      `Draft a remedial practice quiz for ${name}`,
    ];
  }, [selectedStudent]);

  const activeChips = selectedStudent ? studentActionChips : quickActionChips;

  if (!isOpen) return null;

  // ── Render Sidebar Component (Shared between full-screen & drawer) ──
  const renderSidebar = () => (
    <View style={s.sidebarContainer}>
      {/* Sidebar Header */}
      <View style={s.sidebarHeader}>
        <View style={s.sidebarTitleRow}>
          <Sparkles size={16} color={Colors.primary} strokeWidth={2.5} />
          <Text style={s.sidebarTitle}>Chats</Text>
        </View>
        <Pressable
          onPress={() => {
            startNewConversation();
            setView('chat');
          }}
          style={s.newChatBtn}
          accessibilityLabel="New Chat"
          accessibilityRole="button"
        >
          <Plus size={15} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={s.newChatBtnText}>New</Text>
        </Pressable>
      </View>

      {/* Search Input */}
      <View style={s.searchRow}>
        <Search size={14} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Search chats..."
          placeholderTextColor={Colors.textMuted}
          value={searchFilter}
          onChangeText={setSearchFilter}
        />
        {searchFilter ? (
          <Pressable onPress={() => setSearchFilter('')} hitSlop={6}>
            <X size={14} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Conversations List */}
      <ScrollView style={s.sidebarList} contentContainerStyle={s.sidebarListContent}>
        {isLoadingConversations ? (
          <Text style={s.mutedText}>Loading conversations...</Text>
        ) : filteredConversations.length === 0 ? (
          <View style={s.empty}>
            <History size={26} color="#CBD5E1" />
            <Text style={s.emptyText}>No matching chats</Text>
          </View>
        ) : (
          filteredConversations.map((c) => {
            const isActive = c.id === activeConversationId;
            return (
              <Pressable
                key={c.id}
                style={[s.sidebarItem, isActive && s.sidebarItemActive]}
                onPress={() => handleSelectConversation(c.id)}
              >
                <View style={s.sidebarItemBody}>
                  <Text style={[s.sidebarItemTitle, isActive && s.sidebarItemTitleActive]} numberOfLines={1}>
                    {c.title || 'Untitled conversation'}
                  </Text>
                  <Text style={s.sidebarItemTime}>{timeLabel(c.updatedAt)}</Text>
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({ id: c.id, title: c.title || 'Untitled conversation' });
                  }}
                  style={s.sidebarDeleteBtn}
                  hitSlop={8}
                  accessibilityLabel="Delete chat"
                >
                  <Trash2 size={13} color="#94A3B8" />
                </Pressable>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Guidance Footer in Sidebar */}
      <View style={s.sidebarFooter}>
        <View style={s.sidebarGuideCard}>
          <HelpCircle size={14} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.sidebarGuideTitle}>Need guidance?</Text>
            <Text style={s.sidebarGuideText}>Tap starter cards anytime to explore topics.</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // ── Render Chat Body ─────────────────────────────────────
  const renderChatBody = () => (
    <KeyboardAvoidingView
      style={s.body}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? (isFullscreen ? 30 : 60) : 0}
    >
      {/* ── Student Context Selector Bar (Teachers & Staff) ── */}
      {isTeacherOrStaff && (
        <View style={s.studentBarWrapper}>
          {isLoadingStudentSummary ? (
            <View style={s.studentBarLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={s.studentBarLoadingText}>Loading student DB metrics & Jev diagnosis...</Text>
            </View>
          ) : selectedStudent ? (
            <View style={s.studentBarActive}>
              <View style={s.studentBarAvatar}>
                <User size={13} color={Colors.primary} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.studentBarName} numberOfLines={1}>
                    {selectedStudent.student.name}
                  </Text>
                  {selectedStudent.student.classLevel ? (
                    <View style={s.studentBarGradePill}>
                      <Text style={s.studentBarGradeText}>Gr {selectedStudent.student.classLevel}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.studentBarSubtext} numberOfLines={1}>
                  Avg {selectedStudent.metrics.averageScorePct}% • {selectedStudent.jevDiagnosis.masteryTier}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [s.studentBarChangeBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowStudentPicker(true)}
              >
                <Text style={s.studentBarChangeBtnText}>Change</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.studentBarClearBtn, pressed && { opacity: 0.7 }]}
                onPress={handleClearStudent}
                accessibilityLabel="Clear student context"
              >
                <X size={14} color={Colors.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [s.studentBarTrigger, pressed && s.studentBarTriggerPressed]}
              onPress={() => setShowStudentPicker(true)}
            >
              <View style={s.studentBarTriggerIconBox}>
                <Search size={13} color={Colors.primary} />
              </View>
              <Text style={s.studentBarTriggerText} numberOfLines={1}>
                Focus on a student for DB metrics & reports...
              </Text>
              <View style={s.studentBarTriggerBadge}>
                <Sparkles size={11} color={Colors.primary} />
                <Text style={s.studentBarTriggerBadgeText}>Diagnostic AI</Text>
              </View>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={s.messages}
        contentContainerStyle={s.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {/* Inline Student Diagnostic Card if student is active */}
        {selectedStudent && showDiagnosticCardInChat && (
          <View style={s.diagnosticCardWrapper}>
            <StudentDiagnosticCard
              data={selectedStudent}
              onActionPress={(prompt) => handleSend(prompt)}
              onOpenReportCard={() => setShowReportCardModal(true)}
            />
          </View>
        )}

        {/* ── Empty State: Hero & Quick Action Cards ──────── */}
        {messages.length === 0 && !streamingReply && !isLoadingMessages ? (
          <View style={s.greetingContainer}>
            <View style={s.greetingIcon}>
              <Bot size={26} color={Colors.primary} strokeWidth={2} />
            </View>
            <Text style={s.greetingTitle}>How can I help you today?</Text>
            <Text style={s.greetingText}>{greeting}</Text>

            {/* Quick Action Starter Cards Grid */}
            <View style={s.starterGrid}>
              {starters.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [s.starterCard, pressed && s.starterCardPressed]}
                  onPress={() => handleSend(item.prompt)}
                  accessibilityRole="button"
                >
                  <View style={s.starterCardHeader}>
                    <View style={s.starterIconBox}>
                      {item.icon === 'lightbulb' ? (
                        <Lightbulb size={16} color={Colors.primary} />
                      ) : item.icon === 'trends' ? (
                        <TrendingUp size={16} color="#D97706" />
                      ) : item.icon === 'book' ? (
                        <BookOpen size={16} color={Colors.purple} />
                      ) : item.icon === 'help' ? (
                        <HelpCircle size={16} color={Colors.success} />
                      ) : (
                        <Sparkles size={16} color={Colors.primary} />
                      )}
                    </View>
                    <Text style={s.starterTitle}>{item.title}</Text>
                  </View>
                  <Text style={s.starterSubtitle}>{item.subtitle}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {isLoadingMessages ? <Text style={s.mutedText}>Loading conversation...</Text> : null}

        {/* ── Messages List ──────────────────────────────── */}
        {messages.map((m) => {
          const { cleanedContent, proposal, entityRevision, clarifyingQuestion, learningGapSummary } =
            m.role === 'assistant'
              ? extractProposalFromMessage(m.content)
              : {
                  cleanedContent: m.content,
                  proposal: undefined,
                  entityRevision: undefined,
                  clarifyingQuestion: undefined,
                  learningGapSummary: undefined,
                };

          return (
            <View key={m.id} style={[s.bubbleRow, m.role === 'user' ? s.bubbleRowUser : s.bubbleRowAssistant]}>
              <View style={[s.bubble, m.role === 'user' ? s.bubbleUser : s.bubbleAssistant]}>
                {cleanedContent ? <ChatMarkdown content={cleanedContent} isUser={m.role === 'user'} /> : null}
                {learningGapSummary && (
                  <LearningGapCard
                    data={learningGapSummary}
                    studentName={selectedStudent?.student.name}
                    onDraftQuiz={(topic) => handleSend(`Draft a 5-question remedial practice quiz on ${topic}`)}
                    onOpenReportCard={() => setShowReportCardModal(true)}
                  />
                )}
                {clarifyingQuestion && (
                  <ClarifyingQuestionCard
                    data={clarifyingQuestion}
                    onSelectOption={(val) => void sendMessage(val)}
                    disabled={isSending}
                  />
                )}
                {proposal && (
                  <ProposalCard proposal={proposal} conversationId={activeConversationId || m.conversationId} />
                )}
                {entityRevision && (
                  <EntityRevisionCard
                    proposal={entityRevision}
                    conversationId={activeConversationId || m.conversationId}
                  />
                )}
                {m.role === 'assistant' && (
                  <View style={s.bubbleFooter}>
                    <CopyMessageBtn text={cleanedContent} />
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {isSending && streamingReply
          ? (() => {
              const { cleanedContent, proposal, entityRevision, clarifyingQuestion, learningGapSummary } =
                extractProposalFromMessage(streamingReply);
              return (
                <View style={[s.bubbleRow, s.bubbleRowAssistant]}>
                  <View style={[s.bubble, s.bubbleAssistant]}>
                    {cleanedContent ? <ChatMarkdown content={cleanedContent} isUser={false} /> : null}
                    {learningGapSummary && (
                      <LearningGapCard
                        data={learningGapSummary}
                        studentName={selectedStudent?.student.name}
                        onDraftQuiz={(topic) => handleSend(`Draft a 5-question remedial practice quiz on ${topic}`)}
                        onOpenReportCard={() => setShowReportCardModal(true)}
                      />
                    )}
                    {clarifyingQuestion && (
                      <ClarifyingQuestionCard
                        data={clarifyingQuestion}
                        onSelectOption={(val) => void sendMessage(val)}
                        disabled={isSending}
                      />
                    )}
                    {proposal && (
                      <ProposalCard proposal={proposal} conversationId={activeConversationId || undefined} />
                    )}
                    {entityRevision && (
                      <EntityRevisionCard
                        proposal={entityRevision}
                        conversationId={activeConversationId || undefined}
                      />
                    )}
                  </View>
                </View>
              );
            })()
          : null}

        {/* ── Assistant Loading State for Normal Chats & Initial Latency ── */}
        {isSending && !streamingReply && (!streamingThinking || !streamingThinking.trim()) ? (
          <View style={[s.bubbleRow, s.bubbleRowAssistant]}>
            <View style={[s.bubble, s.bubbleAssistant, s.loadingBubble]}>
              <AnimatedTypingDots />
              <Text style={s.loadingLabel}>ELS AI is writing...</Text>
            </View>
          </View>
        ) : null}

        {Boolean(streamingThinking && streamingThinking.trim()) ? (
          <ThinkingStream
            thinkingText={streamingThinking}
            isThinking={isThinking}
            hasReplyStarted={Boolean(streamingReply)}
          />
        ) : null}

        {sendError ? (
          <View style={s.errorBanner}>
            <Text style={s.errorBannerText}>{sendError}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Quick Action Prompt Chips (Above Input) ──────── */}
      <View style={s.quickChipsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.quickChipsContainer}
        >
          {activeChips.map((chip, idx) => (
            <Pressable
              key={idx}
              style={({ pressed }) => [s.quickChip, pressed && s.quickChipPressed]}
              onPress={() => handleSend(chip)}
              accessibilityRole="button"
            >
              <Text style={s.quickChipText}>{chip}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Input Box ────────────────────────────────────── */}
      <View style={[s.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={s.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message ELS AI..."
          placeholderTextColor="#94A3B8"
          multiline
          editable={!isSending}
          onSubmitEditing={() => handleSend()}
          blurOnSubmit={false}
          onKeyPress={(e) => {
            if (Platform.OS === 'web') {
              const nativeEvent = e.nativeEvent as any;
              if (nativeEvent?.key === 'Enter' && !nativeEvent?.shiftKey) {
                (e as any).preventDefault?.();
                nativeEvent?.preventDefault?.();
                handleSend();
              }
            }
          }}
        />
        <Pressable
          onPress={() => handleSend()}
          disabled={!draft.trim() || isSending}
          style={[s.sendBtn, (!draft.trim() || isSending) && s.sendBtnDisabled]}
          accessibilityLabel="Send message"
        >
          <Send size={18} color="#FFFFFF" />
        </Pressable>
      </View>
      <Text style={s.inputDisclaimer}>
        ELS AI assists with learning & diagnostics • Always verify with official school reports
      </Text>
    </KeyboardAvoidingView>
  );

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={close}>
      <View style={[s.overlay, isWide && !isFullscreen && s.overlayWide]}>
        {/* Backdrop for floating panel */}
        {isWide && !isFullscreen ? <Pressable style={s.backdrop} onPress={close} /> : null}

        <View
          style={[
            s.panel,
            isFullscreen
              ? s.panelFullscreen
              : isWide
              ? { width: PANEL_WIDTH, paddingTop: Math.max(insets.top, 12) }
              : { width: '100%', height: '100%', paddingTop: Math.max(insets.top, 12) },
          ]}
        >
          {/* ── Main Layout: Split Screen in Fullscreen, Drawer/Single in Floating ── */}
          {isFullscreen ? (
            <View style={s.fullscreenLayout}>
              {/* Left Sidebar (ChatGPT-style) */}
              {showSidebar && <View style={s.fullscreenSidebar}>{renderSidebar()}</View>}

              {/* Right Chat Main Area */}
              <View style={s.fullscreenMain}>
                {/* Fullscreen Header */}
                <View style={s.header}>
                  <View style={s.headerTitleRow}>
                    <Pressable
                      onPress={handleToggleSidebar}
                      style={s.iconBtn}
                      accessibilityLabel="Toggle Sidebar"
                    >
                      <Sidebar size={18} color="#475569" />
                    </Pressable>
                    <View style={s.headerIcon}>
                      <Sparkles size={16} color={Colors.primary} strokeWidth={2.5} />
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.headerTitle}>ELS AI</Text>
                        <View style={s.roleBadge}>
                          <Text style={s.roleBadgeText}>{roleLabel}</Text>
                        </View>
                      </View>
                      <Text style={s.headerSubtitle} numberOfLines={1}>
                        {activeConversation?.title || 'New Chat'}
                      </Text>
                    </View>
                  </View>

                  <View style={s.headerActions}>
                    <Pressable
                      onPress={() => handleToggleFullscreen(false)}
                      style={s.iconBtn}
                      accessibilityLabel="Exit full screen"
                    >
                      <Minimize2 size={17} color="#475569" />
                    </Pressable>
                    <Pressable onPress={close} style={s.iconBtn} accessibilityLabel="Close assistant">
                      <X size={18} color="#475569" />
                    </Pressable>
                  </View>
                </View>

                {/* Chat Body */}
                {renderChatBody()}
              </View>
            </View>
          ) : (
            // ── Floating / Compact Panel Layout ──
            <View style={{ flex: 1 }}>
              {/* Header */}
              <View style={s.header}>
                <View style={s.headerTitleRow}>
                  <View style={s.headerIcon}>
                    <Sparkles size={16} color={Colors.primary} strokeWidth={2.5} />
                  </View>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.headerTitle}>AI Assistant</Text>
                      <View style={s.roleBadge}>
                        <Text style={s.roleBadgeText}>{roleLabel}</Text>
                      </View>
                    </View>
                    <Text style={s.headerSubtitle} numberOfLines={1}>
                      {activeConversation?.title || `${roleLabel} mode`}
                    </Text>
                  </View>
                </View>

                <View style={s.headerActions}>
                  <Pressable
                    onPress={() => setView((v) => (v === 'history' ? 'chat' : 'history'))}
                    style={[s.iconBtn, view === 'history' && s.iconBtnActive]}
                    accessibilityLabel="Conversation history"
                  >
                    <History size={17} color={view === 'history' ? Colors.primary : '#5A5A7A'} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      startNewConversation();
                      setView('chat');
                    }}
                    style={s.iconBtn}
                    accessibilityLabel="New chat"
                  >
                    <Plus size={18} color="#5A5A7A" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleToggleFullscreen(true)}
                    style={s.iconBtn}
                    accessibilityLabel="Expand full screen"
                  >
                    <Maximize2 size={17} color="#5A5A7A" />
                  </Pressable>
                  <Pressable onPress={close} style={s.iconBtn} accessibilityLabel="Close AI assistant">
                    <X size={18} color="#5A5A7A" />
                  </Pressable>
                </View>
              </View>

              {/* View toggle */}
              {view === 'history' ? renderSidebar() : renderChatBody()}
            </View>
          )}
        </View>

        {/* ── Delete Confirmation Modal ── */}
        <Modal
          visible={Boolean(deleteTarget)}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteTarget(null)}
        >
          <View style={s.confirmModalOverlay}>
            <Pressable style={s.confirmModalBackdrop} onPress={() => setDeleteTarget(null)} />
            <View style={s.confirmModalCard}>
              <View style={s.confirmModalIconBox}>
                <Trash2 size={22} color={Colors.error} strokeWidth={2} />
              </View>

              <Text style={s.confirmModalTitle}>Delete Chat?</Text>
              <Text style={s.confirmModalMessage}>
                Are you sure you want to delete{' '}
                <Text style={s.confirmModalTargetTitle}>
                  "{deleteTarget?.title || 'this conversation'}"
                </Text>
                ? This action cannot be undone.
              </Text>

              <View style={s.confirmModalActions}>
                <Pressable
                  style={({ pressed }) => [s.confirmModalCancelBtn, pressed && s.confirmModalBtnPressed]}
                  onPress={() => setDeleteTarget(null)}
                  accessibilityRole="button"
                >
                  <Text style={s.confirmModalCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [s.confirmModalDeleteBtn, pressed && s.confirmModalBtnPressed]}
                  onPress={confirmDelete}
                  accessibilityRole="button"
                >
                  <Trash2 size={15} color="#FFFFFF" />
                  <Text style={s.confirmModalDeleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Student Picker Modal ── */}
        <Modal
          visible={showStudentPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStudentPicker(false)}
        >
          <View style={s.studentPickerOverlay}>
            <Pressable style={s.studentPickerBackdrop} onPress={() => setShowStudentPicker(false)} />
            <View style={s.studentPickerCard}>
              <View style={s.studentPickerHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.studentPickerTitle}>Select Student</Text>
                  <Text style={s.studentPickerSubtitle}>
                    Load verified database quiz scores, learning gaps, and diagnostic evaluation
                  </Text>
                </View>
                <Pressable
                  style={s.studentPickerCloseBtn}
                  onPress={() => setShowStudentPicker(false)}
                  accessibilityLabel="Close student search"
                >
                  <X size={18} color={Colors.textSecondary} />
                </Pressable>
              </View>

              {/* Search Bar */}
              <View style={s.studentPickerSearchBox}>
                <Search size={16} color={Colors.textSecondary} />
                <TextInput
                  style={s.studentPickerInput}
                  value={studentQuery}
                  onChangeText={setStudentQuery}
                  placeholder="Search by student name or email..."
                  placeholderTextColor="#94A3B8"
                  autoFocus
                />
                {studentQuery ? (
                  <Pressable onPress={() => setStudentQuery('')}>
                    <X size={14} color={Colors.textSecondary} />
                  </Pressable>
                ) : null}
              </View>

              {/* Results List */}
              <ScrollView style={s.studentPickerResultsList} keyboardShouldPersistTaps="handled">
                {isSearchingStudents ? (
                  <View style={s.studentPickerLoading}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={s.studentPickerLoadingText}>Searching students...</Text>
                  </View>
                ) : studentResults.length > 0 ? (
                  studentResults.map((st) => {
                    const isSelected = selectedStudent?.student.id === st.id;
                    const initials = `${st.firstName?.[0] || ''}${st.lastName?.[0] || ''}`.toUpperCase() || 'ST';
                    return (
                      <Pressable
                        key={st.id}
                        style={({ pressed }) => [
                          s.studentResultItem,
                          isSelected && s.studentResultItemActive,
                          pressed && s.studentResultItemPressed,
                        ]}
                        onPress={() => handleSelectStudent(st.id)}
                      >
                        <View style={[s.studentResultAvatar, isSelected && { backgroundColor: Colors.primary }]}>
                          <Text style={[s.studentResultInitials, isSelected && { color: '#FFFFFF' }]}>
                            {initials}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={s.studentResultName} numberOfLines={1}>
                              {st.firstName} {st.lastName}
                            </Text>
                            {st.classLevel ? (
                              <View style={s.studentResultGradePill}>
                                <Text style={s.studentResultGradeText}>Grade {st.classLevel}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={s.studentResultEmail} numberOfLines={1}>
                            {st.email || 'No email registered'}
                          </Text>
                        </View>
                        {isSelected ? (
                          <View style={s.activeBadgePill}>
                            <Check size={11} color="#059669" />
                            <Text style={s.activeBadgeText}>Selected</Text>
                          </View>
                        ) : (
                          <ChevronRight size={16} color="#94A3B8" />
                        )}
                      </Pressable>
                    );
                  })
                ) : (
                  <View style={s.studentPickerEmpty}>
                    <Text style={s.studentPickerEmptyText}>
                      {studentQuery.trim()
                        ? `No students found matching "${studentQuery}"`
                        : 'Type a student name or email to view their performance'}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ── Official Student Academic Report Card Modal ── */}
        <StudentReportCardModal
          visible={showReportCardModal}
          data={selectedStudent}
          onClose={() => setShowReportCardModal(false)}
          onDraftRemedialQuiz={(prompt) => handleSend(prompt)}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  overlayWide: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  panel: {
    backgroundColor: Colors.surface,
    ...Shadow.lg,
  },
  panelFullscreen: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  fullscreenLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  fullscreenSidebar: {
    width: 290,
    backgroundColor: '#F8FAFC',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  fullscreenMain: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  // ── Header ────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    maxWidth: 220,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: Colors.primaryLight,
  },

  body: {
    flex: 1,
  },

  // ── Sidebar (ChatGPT Style) ───────────────────────────────
  sidebarContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sidebarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sidebarTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  newChatBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: Colors.text,
    padding: 0,
  },
  sidebarList: {
    flex: 1,
  },
  sidebarListContent: {
    padding: Spacing.md,
    gap: 4,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  sidebarItemActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  sidebarItemBody: {
    flex: 1,
  },
  sidebarItemTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  sidebarItemTitleActive: {
    fontWeight: '700',
    color: Colors.primary,
  },
  sidebarItemTime: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sidebarDeleteBtn: {
    padding: 4,
  },
  sidebarFooter: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sidebarGuideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sidebarGuideTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  sidebarGuideText: {
    fontSize: 10,
    color: Colors.textSecondary,
    lineHeight: 14,
  },

  // ── Messages & Greeting ───────────────────────────────────
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing.base,
    gap: Spacing.sm,
    flexGrow: 1,
  },
  greetingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  greetingIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  greetingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  greetingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 420,
    marginBottom: Spacing.md,
  },
  starterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    maxWidth: 620,
  },
  starterCard: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    ...Shadow.sm,
  },
  starterCardPressed: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  starterCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  starterIconBox: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  starterSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  mutedText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 12,
  },

  // ── Bubbles ───────────────────────────────────────────────
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  bubbleUser: {
    maxWidth: '85%',
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    maxWidth: '96%',
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    ...Shadow.sm,
  },
  bubbleFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  bubbleCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#F4F6FC',
  },
  bubbleCopyBtnText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  errorBanner: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorBannerText: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Quick Action Prompt Chips (Above Input) ────────────────
  quickChipsRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    paddingVertical: 6,
  },
  quickChipsContainer: {
    paddingHorizontal: Spacing.base,
    gap: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickChipPressed: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // ── Input ─────────────────────────────────────────────────
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: 6,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.textDisabled,
  },
  inputDisclaimer: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 4,
    backgroundColor: Colors.surface,
  },

  // ── Delete Confirmation Modal ──────────────────────────────
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  confirmModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    ...Shadow.lg,
    zIndex: 10,
  },
  confirmModalIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  confirmModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  confirmModalMessage: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  confirmModalTargetTitle: {
    fontWeight: '600',
    color: Colors.text,
  },
  confirmModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    width: '100%',
  },
  confirmModalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalDeleteBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Shadow.sm,
  },
  confirmModalBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  confirmModalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  confirmModalDeleteText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Assistant Loading State ────────────────────────────────
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    ...Shadow.sm,
  },
  typingDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.7,
  },
  typingDot3: {
    opacity: 1,
  },
  loadingLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // ── Student Context Bar & Diagnostic Card ───────────────────
  studentBarWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
    backgroundColor: '#FAFCFF',
  },
  studentBarTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    gap: 8,
    ...Shadow.sm,
  },
  studentBarTriggerPressed: {
    opacity: 0.85,
    backgroundColor: '#F8FAFC',
  },
  studentBarTriggerIconBox: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight || '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentBarTriggerText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  studentBarTriggerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight || '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  studentBarTriggerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  studentBarLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  studentBarLoadingText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  studentBarActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    ...Shadow.sm,
  },
  studentBarAvatar: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight || '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentBarName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  studentBarGradePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  studentBarGradeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  studentBarSubtext: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  studentBarChangeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  studentBarChangeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  studentBarClearBtn: {
    padding: 4,
    borderRadius: Radius.sm,
  },
  diagnosticCardWrapper: {
    marginBottom: 14,
  },

  // ── Student Picker Modal ────────────────────────────────────
  studentPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  studentPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  studentPickerCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 18,
    ...Shadow.md,
  },
  studentPickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  studentPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  studentPickerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  studentPickerCloseBtn: {
    padding: 4,
    borderRadius: Radius.sm,
  },
  studentPickerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  studentPickerInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    padding: 0,
  },
  studentPickerResultsList: {
    maxHeight: 300,
  },
  studentPickerLoading: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  studentPickerLoadingText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  studentResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    marginBottom: 8,
    ...Shadow.sm,
  },
  studentResultItemPressed: {
    backgroundColor: '#F8FAFC',
  },
  studentResultAvatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight || '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentResultName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  studentResultGradePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  studentResultGradeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  studentResultEmail: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  studentResultItemActive: {
    backgroundColor: '#F8FAFC',
    borderColor: Colors.primary,
  },
  studentResultInitials: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  activeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  studentPickerEmpty: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentPickerEmptyText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
