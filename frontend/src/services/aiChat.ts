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
  onThinking?: (thought: string) => void;
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

        let payload: {
          conversationId?: string;
          delta?: string;
          thinking?: string;
          error?: string;
          done?: boolean;
        };
        try {
          payload = JSON.parse(jsonText);
        } catch {
          continue;
        }

        if (payload.conversationId) handlers.onConversationId?.(payload.conversationId);
        if (typeof payload.thinking === 'string') handlers.onThinking?.(payload.thinking);
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

export type GenerationProposalData = {
  type: 'generation_proposal';
  contentType: 'topic' | 'content' | 'quiz' | 'question' | 'classroom' | 'story';
  title: string;
  summary: string;
  params: Record<string, any>;
  conversationId?: string;
};

export type RevisionProposalData = {
  type: 'revision_proposal';
  contentId: string;
  instruction: string;
  summary: string;
};

export type EntityRevisionProposalData = {
  type: 'entity_revision_proposal';
  entityType: 'question' | 'content' | 'topic' | 'quiz';
  entityId: string;
  instruction: string;  
  summary: string;
};

export interface EntityDiffItem {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  description: string;
}

export interface EntityRevisionResult {
  entityType: 'question' | 'content' | 'topic' | 'quiz';
  entityId: string;
  originalName: string;
  original: any;
  revised: any;
  summary: string;
  diff: EntityDiffItem[];
}

export type GenerationStreamHandlers = {
  onStepStart?: (step: string, label: string) => void;
  onStepComplete?: (step: string) => void;
  onJobCompleted?: (result: { contentId: string; name: string; preview: any; data?: any }) => void;
  onJobFailed?: (error: string) => void;
};

export async function startGeneration(
  proposal: GenerationProposalData,
  conversationId: string,
): Promise<{ jobId: string }> {
  const token = await getStorageItem('accessToken');
  const response = await expoFetch(`${API_BASE_URL}/ai/generation/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({
      conversationId,
      contentType: proposal.contentType,
      title: proposal.title,
      params: proposal.params,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Generation failed (${response.status})`);
  }

  return response.json();
}

export async function startRevision(
  revision: RevisionProposalData,
  conversationId: string,
): Promise<{ jobId: string }> {
  const token = await getStorageItem('accessToken');
  const response = await expoFetch(`${API_BASE_URL}/ai/generation/revise`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({
      conversationId,
      contentId: revision.contentId,
      instruction: revision.instruction,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Revision failed (${response.status})`);
  }

  return response.json();
}

export async function listenGenerationStream(
  jobId: string,
  handlers: GenerationStreamHandlers,
): Promise<void> {
  const token = await getStorageItem('accessToken');
  let response: Awaited<ReturnType<typeof expoFetch>>;
  try {
    response = await expoFetch(`${API_BASE_URL}/ai/generation/stream/${jobId}`, {
      headers: {
        Accept: 'text/event-stream',
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
  } catch (err: any) {
    handlers.onJobFailed?.(err.message || 'Stream connection failed');
    return;
  }

  if (!response.ok || !response.body) {
    handlers.onJobFailed?.(`Stream request failed (${response.status})`);
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

        try {
          const payload = JSON.parse(jsonText);
          if (payload.event === 'step_start') {
            handlers.onStepStart?.(payload.step, payload.label);
          } else if (payload.event === 'step_complete') {
            handlers.onStepComplete?.(payload.step);
          } else if (payload.event === 'job_completed') {
            handlers.onJobCompleted?.({
              contentId: payload.contentId,
              name: payload.name,
              preview: payload.preview,
              data: payload.data,
            });
            return;
          } else if (payload.event === 'job_failed') {
            handlers.onJobFailed?.(payload.error || 'Generation failed');
            return;
          }
        } catch {
          // ignore malformed frame
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function fetchGeneratedContent(contentId: string): Promise<any> {
  const token = await getStorageItem('accessToken');
  const response = await expoFetch(`${API_BASE_URL}/ai/generation/content/${contentId}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch generated content');
  }
  return response.json();
}

export async function findCompletedGeneration(
  conversationId: string,
  title?: string,
  contentType?: string,
): Promise<{ found: boolean; jobId?: string; contentId?: string; name?: string; preview?: any; data?: any } | null> {
  const token = await getStorageItem('accessToken');
  const query = new URLSearchParams({ conversationId });
  if (title) query.append('title', title);
  if (contentType) query.append('contentType', contentType);

  try {
    const response = await expoFetch(`${API_BASE_URL}/ai/generation/find?${query.toString()}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  } catch {
    return null;
  }
}

export async function previewEntityRevision(
  entityType: string,
  entityId: string,
  instruction: string,
): Promise<EntityRevisionResult> {
  const token = await getStorageItem('accessToken');
  const response = await expoFetch(`${API_BASE_URL}/ai/generation/entity-preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({ entityType, entityId, instruction }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to preview entity revision (${response.status})`);
  }
  const data = await response.json();
  return data.result;
}

export async function applyEntityRevision(
  entityType: string,
  entityId: string,
  payload: any,
): Promise<any> {
  const token = await getStorageItem('accessToken');
  const response = await expoFetch(`${API_BASE_URL}/ai/generation/entity-apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({ entityType, entityId, payload }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to apply entity revision (${response.status})`);
  }
  const data = await response.json();
  return data.result;
}
