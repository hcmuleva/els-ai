import {
  createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useAuth } from './AuthContext';
import {
  ChatConversation, ChatMessage, deleteConversation, fetchConversationMessages, listConversations, streamChatMessage,
} from '../services/aiChat';

type AiChatContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;

  conversations: ChatConversation[];
  isLoadingConversations: boolean;
  loadConversations: () => Promise<void>;
  removeConversation: (id: string) => Promise<void>;

  activeConversationId: string | null;
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  selectConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;

  streamingReply: string;
  isSending: boolean;
  sendError: string | null;
  sendMessage: (text: string) => Promise<void>;
};

const AiChatContext = createContext<AiChatContextValue | null>(null);

export function AiChatProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, apiFetch } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [streamingReply, setStreamingReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Avoids appending a stream chunk that arrives after the user has already
  // switched to a different (or no) conversation.
  const activeConversationRef = useRef<string | null>(null);
  activeConversationRef.current = activeConversationId;

  // Guards against a stale in-flight stream's callbacks mutating state after
  // the user has since switched conversations or started a new one.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsOpen(false);
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
      setStreamingReply('');
      setSendError(null);
    }
  }, [isAuthenticated]);

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const rows = await listConversations(apiFetch);
      setConversations(rows);
    } catch (e) {
      console.warn('Failed to load AI chat conversations', e);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [apiFetch]);

  const open = useCallback(() => {
    setIsOpen(true);
    void loadConversations();
  }, [loadConversations]);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) void loadConversations();
      return !prev;
    });
  }, [loadConversations]);

  const selectConversation = useCallback(async (id: string) => {
    requestIdRef.current += 1; // invalidate any in-flight stream from the previous conversation
    setActiveConversationId(id);
    setStreamingReply('');
    setSendError(null);
    setIsLoadingMessages(true);
    try {
      const { messages: rows } = await fetchConversationMessages(apiFetch, id);
      setMessages(rows);
    } catch (e) {
      console.warn('Failed to load conversation messages', e);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [apiFetch]);

  const startNewConversation = useCallback(() => {
    requestIdRef.current += 1; // invalidate any in-flight stream from the previous conversation
    setActiveConversationId(null);
    setMessages([]);
    setStreamingReply('');
    setSendError(null);
  }, []);

  const removeConversation = useCallback(async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationRef.current === id) startNewConversation();
    try {
      await deleteConversation(apiFetch, id);
    } catch (e) {
      console.warn('Failed to delete conversation', e);
      void loadConversations();
    }
  }, [apiFetch, loadConversations, startNewConversation]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestIdRef.current === requestId;
    const conversationIdAtSend = activeConversationRef.current;

    const optimisticMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      conversationId: conversationIdAtSend || '',
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setStreamingReply('');
    setSendError(null);
    setIsSending(true);

    await streamChatMessage(
      { conversationId: conversationIdAtSend || undefined, message: trimmed },
      {
        onConversationId: (id) => {
          // First message of a brand-new conversation: adopt the id the
          // server assigned so subsequent turns stay in the same thread, and
          // refresh the history list now — the conversation + user message
          // are already persisted server-side at this point regardless of
          // whether the model call that follows succeeds or errors out.
          if (isCurrent() && !activeConversationRef.current) {
            activeConversationRef.current = id;
            setActiveConversationId(id);
            void loadConversations();
          }
        },
        onDelta: (chunk) => {
          if (!isCurrent()) return;
          setStreamingReply((prev) => prev + chunk);
        },
        onDone: () => {
          if (!isCurrent()) return;
          setStreamingReply((finalText) => {
            if (finalText) {
              setMessages((prev) => [...prev, {
                id: `local-assistant-${Date.now()}`,
                conversationId: activeConversationRef.current || '',
                role: 'assistant',
                content: finalText,
                createdAt: new Date().toISOString(),
              }]);
            }
            return '';
          });
          setIsSending(false);
          void loadConversations();
        },
        onError: (message) => {
          if (!isCurrent()) return;
          setSendError(message);
          setIsSending(false);
        },
      },
    );
  }, [isSending, loadConversations]);

  const value = useMemo<AiChatContextValue>(() => ({
    isOpen, open, close, toggle,
    conversations, isLoadingConversations, loadConversations, removeConversation,
    activeConversationId, messages, isLoadingMessages, selectConversation, startNewConversation,
    streamingReply, isSending, sendError, sendMessage,
  }), [
    isOpen, open, close, toggle,
    conversations, isLoadingConversations, loadConversations, removeConversation,
    activeConversationId, messages, isLoadingMessages, selectConversation, startNewConversation,
    streamingReply, isSending, sendError, sendMessage,
  ]);

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

export function useAiChat() {
  const context = useContext(AiChatContext);
  if (!context) {
    throw new Error('useAiChat must be used inside AiChatProvider');
  }
  return context;
}
