import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bot, History, Plus, Send, Sparkles, Trash2, X } from 'lucide-react-native';
import { useAiChat } from '../../context/AiChatContext';
import { useAuth } from '../../context/AuthContext';
import { Colors, Radius, Shadow, Spacing } from '../../theme';

const WIDE_BREAKPOINT = 768;
const PANEL_WIDTH = 420;

const ROLE_GREETING: Record<string, string> = {
  teacher: "Ask me to help plan a lesson, draft questions, or make sense of class performance.",
  student: "Ask me to explain a topic, help with homework, or quiz you on something you're learning.",
  parent: "Ask me about your child's progress or how to support their learning at home.",
  admin: "Ask me about platform analytics, configuration, or day-to-day operations.",
  superadmin: 'Ask me about platform-wide operations, health, or administrative tasks.',
};

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatPanel() {
  const {
    isOpen, close, conversations, isLoadingConversations, activeConversationId,
    messages, isLoadingMessages, selectConversation, startNewConversation,
    streamingReply, isSending, sendError, sendMessage, removeConversation,
  } = useAiChat();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const role = user?.activeRole || 'student';
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const greeting = ROLE_GREETING[role] || ROLE_GREETING.student;

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId],
  );

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft('');
    setView('chat');
    void sendMessage(text);
  };

  const handleSelectConversation = async (id: string) => {
    setView('chat');
    await selectConversation(id);
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={close}>
      <View style={[s.overlay, isWide && s.overlayWide]}>
        {isWide ? <Pressable style={s.backdrop} onPress={close} /> : null}

        <View
          style={[
            s.panel,
            isWide
              ? { width: PANEL_WIDTH, paddingTop: Math.max(insets.top, 12) }
              : { width: '100%', height: '100%', paddingTop: Math.max(insets.top, 12) },
          ]}
        >
          <View style={s.header}>
            <View style={s.headerTitleRow}>
              <View style={s.headerIcon}>
                <Sparkles size={16} color={Colors.primary} strokeWidth={2.5} />
              </View>
              <View>
                <Text style={s.headerTitle}>AI Assistant</Text>
                <Text style={s.headerSubtitle} numberOfLines={1}>
                  {activeConversation?.title || `${roleLabel} mode`}
                </Text>
              </View>
            </View>
            <View style={s.headerActions}>
              <Pressable
                onPress={() => { setView((v) => (v === 'history' ? 'chat' : 'history')); }}
                style={[s.iconBtn, view === 'history' && s.iconBtnActive]}
                accessibilityLabel="Conversation history"
              >
                <History size={17} color={view === 'history' ? Colors.primary : '#5A5A7A'} />
              </Pressable>
              <Pressable
                onPress={() => { startNewConversation(); setView('chat'); }}
                style={s.iconBtn}
                accessibilityLabel="New chat"
              >
                <Plus size={18} color="#5A5A7A" />
              </Pressable>
              <Pressable onPress={close} style={s.iconBtn} accessibilityLabel="Close AI assistant">
                <X size={18} color="#5A5A7A" />
              </Pressable>
            </View>
          </View>

          {view === 'history' ? (
            <ScrollView style={s.body} contentContainerStyle={s.historyContent}>
              {isLoadingConversations ? (
                <Text style={s.mutedText}>Loading...</Text>
              ) : conversations.length === 0 ? (
                <View style={s.empty}>
                  <History size={32} color="#C9CCD8" />
                  <Text style={s.emptyText}>No previous chats yet</Text>
                </View>
              ) : (
                conversations.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[s.historyItem, c.id === activeConversationId && s.historyItemActive]}
                    onPress={() => handleSelectConversation(c.id)}
                  >
                    <View style={s.historyItemBody}>
                      <Text style={s.historyItemTitle} numberOfLines={1}>{c.title}</Text>
                      <Text style={s.historyItemTime}>{timeLabel(c.updatedAt)}</Text>
                    </View>
                    <Pressable onPress={() => removeConversation(c.id)} style={s.historyDeleteBtn} hitSlop={8}>
                      <Trash2 size={14} color="#9CA3AF" />
                    </Pressable>
                  </Pressable>
                ))
              )}
            </ScrollView>
          ) : (
            <KeyboardAvoidingView
              style={s.body}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
            >
              <ScrollView
                ref={scrollRef}
                style={s.messages}
                contentContainerStyle={s.messagesContent}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              >
                {messages.length === 0 && !streamingReply && !isLoadingMessages ? (
                  <View style={s.greeting}>
                    <View style={s.greetingIcon}>
                      <Bot size={22} color={Colors.primary} strokeWidth={2} />
                    </View>
                    <Text style={s.greetingText}>{greeting}</Text>
                  </View>
                ) : null}

                {isLoadingMessages ? <Text style={s.mutedText}>Loading conversation...</Text> : null}

                {messages.map((m) => (
                  <View key={m.id} style={[s.bubbleRow, m.role === 'user' ? s.bubbleRowUser : s.bubbleRowAssistant]}>
                    <View style={[s.bubble, m.role === 'user' ? s.bubbleUser : s.bubbleAssistant]}>
                      <Text style={m.role === 'user' ? s.bubbleTextUser : s.bubbleTextAssistant}>{m.content}</Text>
                    </View>
                  </View>
                ))}

                {isSending && streamingReply ? (
                  <View style={[s.bubbleRow, s.bubbleRowAssistant]}>
                    <View style={[s.bubble, s.bubbleAssistant]}>
                      <Text style={s.bubbleTextAssistant}>{streamingReply}</Text>
                    </View>
                  </View>
                ) : null}

                {isSending && !streamingReply ? (
                  <View style={[s.bubbleRow, s.bubbleRowAssistant]}>
                    <View style={[s.bubble, s.bubbleAssistant, s.bubbleThinking]}>
                      <Text style={s.bubbleTextAssistant}>Thinking…</Text>
                    </View>
                  </View>
                ) : null}

                {sendError ? (
                  <View style={s.errorBanner}>
                    <Text style={s.errorBannerText}>{sendError}</Text>
                  </View>
                ) : null}
              </ScrollView>

              <View style={[s.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <TextInput
                  style={s.input}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Message the AI assistant..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  editable={!isSending}
                  onSubmitEditing={handleSend}
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
                  onPress={handleSend}
                  disabled={!draft.trim() || isSending}
                  style={[s.sendBtn, (!draft.trim() || isSending) && s.sendBtnDisabled]}
                  accessibilityLabel="Send message"
                >
                  <Send size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)' },
  overlayWide: { flexDirection: 'row', justifyContent: 'flex-end' },
  backdrop: { flex: 1 },
  panel: {
    backgroundColor: Colors.surface,
    ...Shadow.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerIcon: {
    width: 32, height: 32, borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  headerSubtitle: { fontSize: 11, color: Colors.textMuted, maxWidth: 220 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive: { backgroundColor: Colors.primaryLight },

  body: { flex: 1 },

  historyContent: { padding: Spacing.base, gap: Spacing.xs },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt,
    marginBottom: Spacing.xs,
  },
  historyItemActive: { backgroundColor: Colors.primaryLight },
  historyItemBody: { flex: 1 },
  historyItemTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  historyItemTime: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  historyDeleteBtn: { padding: 4 },

  messages: { flex: 1 },
  messagesContent: { padding: Spacing.base, gap: Spacing.sm, flexGrow: 1 },

  greeting: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md, paddingHorizontal: Spacing.lg },
  greetingIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  greetingText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  mutedText: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg },

  empty: { alignItems: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 13 },

  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: Colors.surfaceAlt, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.borderLight },
  bubbleThinking: { opacity: 0.7 },
  bubbleTextUser: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  bubbleTextAssistant: { color: Colors.text, fontSize: 14, lineHeight: 20 },

  errorBanner: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorBannerText: { color: Colors.error, fontSize: 12, fontWeight: '600' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Colors.text,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.textDisabled },
});
