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
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Send,
  Sparkles,
  User,
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

interface SurveyChatScreenProps {
  studentId?: string;
  studentName?: string;
  onClose?: () => void;
}

export function SurveyChatScreen({
  studentId,
  studentName = 'Child',
  onClose,
}: SurveyChatScreenProps) {
  const { apiFetch, user } = useAuth();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Initialize or resume session
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        setLoading(true);
        const { session: newSession, initialMessage } = await createChatSession(
          apiFetch,
          'survey',
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
        console.error('[SurveyChatScreen] init failed', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const handleSend = async () => {
    if (!session || !inputText.trim() || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic user message
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
      console.error('[SurveyChatScreen] send message error', err);
    } finally {
      setSending(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const slots = session?.context_slots;
  const currentStep = (slots?.current_topic_index ?? 0) + 1;
  const totalSteps = slots?.topics?.length || 5;
  const isCompleted = Boolean(slots?.completed);

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
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Parent Survey Chat</Text>
              <View style={styles.surveyBadge}>
                <Text style={styles.surveyBadgeText}>Survey</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              Observing for: <Text style={styles.bold}>{slots?.student_name || studentName}</Text>
            </Text>
          </View>
        </View>

        {/* Step Progress Pill */}
        <View style={styles.progressPill}>
          <Text style={styles.progressPillText}>
            {isCompleted ? 'Complete' : `Step ${currentStep} of ${totalSteps}`}
          </Text>
        </View>
      </View>

      {/* ── Progress Bar ──────────────────────────────────── */}
      <View style={styles.progressBarTrack}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${isCompleted ? 100 : (currentStep / totalSteps) * 100}%` },
          ]}
        />
      </View>

      {/* ── Messages List ─────────────────────────────────── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Starting survey session...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const isUser = item.sender === 'user';
              const meta = item.metadata || {};

              return (
                <View
                  style={[
                    styles.messageRow,
                    isUser ? styles.messageRowUser : styles.messageRowAssistant,
                  ]}
                >
                  {!isUser && (
                    <View style={styles.botAvatar}>
                      <Sparkles size={16} color={Colors.primary} />
                    </View>
                  )}
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

                    {/* Verified cascade fact badge */}
                    {meta.logged_status && (
                      <View style={styles.factBadgeBox}>
                        <CheckCircle2 size={13} color={Colors.success} />
                        <Text style={styles.factBadgeText}>
                          Fact logged • {meta.logged_status === 'auto_accepted' ? 'Auto Verified' : 'Teacher Review'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              sending ? (
                <View style={styles.typingIndicator}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.typingText}>Analyzing and updating progress...</Text>
                </View>
              ) : null
            }
          />

          {/* ── Input Bar ───────────────────────────────────── */}
          {isCompleted ? (
            <View style={styles.completedNotice}>
              <CheckCircle2 size={20} color={Colors.success} />
              <Text style={styles.completedNoticeText}>
                Survey completed. All facts are saved to {studentName}'s official profile.
              </Text>
            </View>
          ) : (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Type your response here..."
                placeholderTextColor={Colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={2000}
                editable={!sending}
              />
              <Pressable
                onPress={handleSend}
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
          )}
        </KeyboardAvoidingView>
      )}
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  surveyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  surveyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bold: {
    fontWeight: '600',
    color: Colors.text,
  },
  progressPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  progressBarTrack: {
    height: 3,
    backgroundColor: '#E2E8F0',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
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
  chatArea: {
    flex: 1,
  },
  messageList: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
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
  factBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  factBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.success,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  typingText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  completedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    margin: Spacing.md,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  completedNoticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.success,
    lineHeight: 18,
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
    maxHeight: 120,
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
