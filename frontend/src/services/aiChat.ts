import { fetch as expoFetch } from 'expo/fetch';
import { API_BASE_URL } from '../context/AuthContext';
import { getStorageItem } from '../utils/storage';

export type ChatConversation = {
  id: string;
  role: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;

export async function listConversations(apiFetch: ApiFetch): Promise<ChatConversation[]> {
  const res = await apiFetch('/ai-conversations');
  if (!res.ok) throw new Error('Failed to load conversations');
  const data = await res.json();
  return data.conversations || [];
}

export async function fetchConversationMessages(
  apiFetch: ApiFetch,
  conversationId: string,
): Promise<{ conversation: ChatConversation; messages: ChatMessage[] }> {
  const res = await apiFetch(`/ai-conversations/${conversationId}/messages`);
  if (!res.ok) throw new Error('Failed to load conversation');
  const data = await res.json();
  return { conversation: data.conversation, messages: data.messages || [] };
}

export async function deleteConversation(apiFetch: ApiFetch, conversationId: string): Promise<void> {
  const res = await apiFetch(`/ai-conversations/${conversationId}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete conversation');
}

export type StreamChatHandlers = {
  onConversationId?: (id: string) => void;
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

/**
 * Sends a chat message and streams the assistant's reply.
 *
 * This intentionally bypasses `apiFetch` and uses `expo/fetch` instead: it's
 * the only fetch implementation in this app that exposes a real streaming
 * `ReadableStream` body on both web and native (the RN/web global `fetch`
 * used by `apiFetch` buffers the whole response on native before resolving).
 * Because of that it also has to attach its own auth header rather than
 * reusing `apiFetch`'s built-in refresh-and-retry — a 401 here just surfaces
 * as an error asking the user to retry, which by then will use a token any
 * other screen's `apiFetch` call has since refreshed.
 */
export async function streamChatMessage(
  input: { conversationId?: string; message: string },
  handlers: StreamChatHandlers,
): Promise<void> {
  const token = await getStorageItem('accessToken');
  if (!token) {
    handlers.onError('Not signed in');
    return;
  }

  let response: Awaited<ReturnType<typeof expoFetch>>;
  try {
    response = await expoFetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
  } catch (e) {
    handlers.onError(e instanceof Error ? e.message : 'Network error');
    return;
  }

  if (response.status === 401) {
    handlers.onError('Your session expired — please try again.');
    return;
  }
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    handlers.onError(text || `Chat request failed (${response.status})`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');

        const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
        if (!dataLine) continue;
        const jsonText = dataLine.slice(5).trim();
        if (!jsonText) continue;

        let payload: { conversationId?: string; delta?: string; error?: string; done?: boolean };
        try {
          payload = JSON.parse(jsonText);
        } catch {
          continue;
        }

        if (payload.conversationId) handlers.onConversationId?.(payload.conversationId);
        if (typeof payload.delta === 'string') handlers.onDelta(payload.delta);
        if (payload.error) {
          handlers.onError(payload.error);
          return;
        }
        if (payload.done) {
          handlers.onDone();
          return;
        }
      }
    }
    handlers.onDone();
  } finally {
    reader.releaseLock();
  }
}
