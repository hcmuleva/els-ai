import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  MessageSquare,
  Send,
  Sparkles,
} from 'lucide-react-native';
import { Colors, Radius, Shadow, Spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import {
  ChatMessage,
  ChatSession,
  createChatSession,
  fetchChatMessages,
  sendChatMessage,
} from '../../services/betterChat';
import { PerformanceReportView, Role } from './PerformanceReportView';

interface PerformanceChatScreenProps {
  studentId?: string;
  studentName?: string;
  onClose?: () => void;
}

export function PerformanceChatScreen({
  studentId,
  studentName = 'Student',
  onClose,
}: PerformanceChatScreenProps) {
  const { apiFetch, user } = useAuth();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showReportTemplate, setShowReportTemplate] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const userRole = (user?.activeRole || user?.roles?.[0] || 'parent') as string;
  const role: Role = userRole === 'student' ? 'child' : (userRole as Role);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        setLoading(true);
        const { session: newSession, initialMessage } = await createChatSession(
          apiFetch,
          'performance',
          studentId || null
        );
        if (!isMounted) return;
        setSession(newSession);

        if (initialMessage) {
          setMessages([initialMessage]);
        } else {
          const loaded = await fetchChatMessages(apiFetch, newSession.id);
          if (isMounted) setMessages(loaded);
        }
      } catch (err) {
        console.error('[PerformanceChatScreen] init failed', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const handleSendText = async (textToSend: string) => {
    if (!session || !textToSend.trim() || sending) return;
    const text = textToSend.trim();
    setInputText('');
    setSending(true);

    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: session.id,
      organization_id: session.organization_id,
      sender: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await sendChatMessage(apiFetch, session.id, text);
      setSession(res.session);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        res.userMessage,
        res.assistantMessage,
      ]);
    } catch (err) {
      console.error('[PerformanceChatScreen] send message error', err);
    } finally {
      setSending(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top Header ────────────────────────────────────── */}
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
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>Performance Intelligence</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{role.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>Child: {studentName}</Text>
          </View>
        </View>

        {/* Toggle Report View Button */}
        <Pressable
          onPress={() => setShowReportTemplate((prev) => !prev)}
          style={styles.toggleReportBtn}
          accessibilityLabel="Toggle Report View"
          accessibilityRole="button"
        >
          <LayoutDashboard size={15} color={Colors.primary} />
          <Text style={styles.toggleReportText}>
            {showReportTemplate ? 'Hide Report' : 'Show Report'}
          </Text>
          {showReportTemplate ? (
            <ChevronUp size={14} color={Colors.primary} />
          ) : (
            <ChevronDown size={14} color={Colors.primary} />
          )}
        </Pressable>
      </View>

      {/* ── Optional Collapsible Performance Report Template ── */}
      {showReportTemplate && (
        <View style={styles.reportTemplateContainer}>
          <PerformanceReportView
            role={role}
            studentId={studentId || user?.id || ''}
            studentName={studentName}
            onAskAiQuestion={(q) => handleSendText(q)}
          />
        </View>
      )}

      {/* ── Interactive Chat Deep-Dive ────────────────────── */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.chatHeaderBar}>
          <Sparkles size={14} color={Colors.primary} />
          <Text style={styles.chatHeaderTitle}>Ask AI Anything About {studentName}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Initializing deep-dive session...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const isUser = item.sender === 'user';
              return (
                <View
                  style={[
                    styles.messageRow,
                    isUser ? styles.messageRowUser : styles.messageRowAssistant,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isUser ? styles.bubbleUser : styles.bubbleAssistant,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isUser ? styles.textUser : styles.textAssistant,
                      ]}
                    >
                      {item.content}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              sending ? (
                <View style={styles.typingIndicator}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.typingText}>Synthesizing metrics...</Text>
                </View>
              ) : null
            }
          />
        )}

        {/* ── Input Bar ───────────────────────────────────── */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder={`Ask about ${studentName}'s trends, scores, or focus...`}
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <Pressable
            onPress={() => handleSendText(inputText)}
            disabled={!inputText.trim() || sending}
            style={({ pressed }) => [
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
              pressed && styles.sendButtonPressed,
            ]}
            accessibilityLabel="Send message"
            accessibilityRole="button"
          >
            <Send size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  toggleReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleReportText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  reportTemplateContainer: {
    maxHeight: 280,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  chatArea: {
    flex: 1,
  },
  chatHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chatHeaderTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  messageList: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    ...Shadow.sm,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
    borderBottomRightRadius: Radius.xs,
  },
  bubbleAssistant: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderBottomLeftRadius: Radius.xs,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  textUser: {
    color: '#FFFFFF',
  },
  textAssistant: {
    color: Colors.text,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  typingText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 14,
    color: Colors.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonPressed: {
    opacity: 0.8,
  },
});
