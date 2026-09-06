import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { streamOllamaChat, type ChatMessage } from '../chat/ollamaClient.js';
import { systemPromptForRole, defaultTitleForRole } from '../chat/prompts.js';
import { appendMessage, createConversation, loadConversationMessages } from '../chat/persistClient.js';

export const chatRouter = Router();

const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(8000),
});

function writeSse(res: import('express').Response, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// POST /ai/chat — send a message, get a streamed (SSE) assistant reply.
// Creates a conversation on first message if `conversationId` is omitted.
// Role-aware: the system prompt and conversation title derive from the
// caller's role (teacher/student/parent/admin/superadmin).
chatRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).json({ message: 'Authorization header required' });
  }

  const gatewayBaseUrl = process.env.API_GATEWAY_URL || 'http://localhost:4000';
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3';
  const role = req.user?.role;
  const { conversationId, message } = parsed.data;

  try {
    let activeConversationId = conversationId;
    let priorMessages: ChatMessage[] = [];

    if (activeConversationId) {
      const loaded = await loadConversationMessages(gatewayBaseUrl, authorization, activeConversationId);
      priorMessages = loaded.messages.map((m) => ({ role: m.role, content: m.content }));
    } else {
      const conversation = await createConversation(gatewayBaseUrl, authorization, {
        role: role || 'student',
        title: defaultTitleForRole(role),
      });
      activeConversationId = conversation.id;
    }

    const titleHint = priorMessages.length === 0 ? message.slice(0, 60) : undefined;
    await appendMessage(gatewayBaseUrl, authorization, activeConversationId, {
      role: 'user',
      content: message,
      titleHint,
    });

    const ollamaMessages: ChatMessage[] = [
      { role: 'system', content: systemPromptForRole(role) },
      ...priorMessages,
      { role: 'user', content: message },
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    writeSse(res, { conversationId: activeConversationId });

    let fullReply = '';
    try {
      for await (const chunk of streamOllamaChat({ baseUrl: ollamaBaseUrl, model: ollamaModel, messages: ollamaMessages })) {
        fullReply += chunk;
        writeSse(res, { delta: chunk });
      }
    } catch (streamError) {
      const errMessage = streamError instanceof Error ? streamError.message : 'AI provider request failed';
      writeSse(res, { error: errMessage });
      return res.end();
    }

    if (fullReply.trim().length > 0) {
      await appendMessage(gatewayBaseUrl, authorization, activeConversationId, {
        role: 'assistant',
        content: fullReply,
      }).catch((err) => {
        console.error('[ai-chat] failed to persist assistant reply', err);
      });
    }

    writeSse(res, { done: true, conversationId: activeConversationId });
    return res.end();
  } catch (error) {
    const message2 = error instanceof Error ? error.message : 'Chat request failed';
    if (res.headersSent) {
      writeSse(res, { error: message2 });
      return res.end();
    }
    return res.status(500).json({ message: message2 });
  }
});

export const aiConversationsProxyRouter = Router();

// GET /ai/chat/conversations, GET /ai/chat/conversations/:id/messages — thin
// pass-through so the frontend can hit everything chat-related under one
// `/ai/chat/*` prefix without needing a second gateway route. (The gateway
// also exposes /ai-conversations directly for symmetry/administration.)
aiConversationsProxyRouter.get('/conversations', requireAuth, async (req: AuthenticatedRequest, res) => {
  const authorization = req.headers.authorization!;
  const gatewayBaseUrl = process.env.API_GATEWAY_URL || 'http://localhost:4000';
  const response = await fetch(`${gatewayBaseUrl}/ai-conversations`, { headers: { Authorization: authorization } });
  const data = await response.json().catch(() => ({}));
  return res.status(response.status).json(data);
});

aiConversationsProxyRouter.get('/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  const authorization = req.headers.authorization!;
  const gatewayBaseUrl = process.env.API_GATEWAY_URL || 'http://localhost:4000';
  const response = await fetch(`${gatewayBaseUrl}/ai-conversations/${req.params.id}/messages`, {
    headers: { Authorization: authorization },
  });
  const data = await response.json().catch(() => ({}));
  return res.status(response.status).json(data);
});
