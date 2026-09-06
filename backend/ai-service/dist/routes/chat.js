import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { systemPromptForRole, defaultTitleForRole } from '../chat/prompts.js';
import { appendMessage, createConversation, loadConversationMessages } from '../chat/persistClient.js';
import { recordProviderUsage } from '../chat/usageClient.js';
import { agentRouter } from '../agents/router.js';
export const chatRouter = Router();
const chatRequestSchema = z.object({
    conversationId: z.string().uuid().optional(),
    message: z.string().trim().min(1).max(8000),
    // Optional explicit provider id (e.g. "ollama") for the multi-agent
    // router. Omit to use the default fallback chain. No frontend selector
    // exists yet — this is the wire contract for when one is added.
    provider: z.string().trim().min(1).max(64).optional(),
});
// GET /ai/chat/providers — registered providers the caller's role may use,
// for a future provider-selector UI.
chatRouter.get('/providers', requireAuth, (req, res) => {
    res.json({ providers: agentRouter.list(req.user?.role) });
});
function writeSse(res, event) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
}
// POST /ai/chat — send a message, get a streamed (SSE) assistant reply.
// Creates a conversation on first message if `conversationId` is omitted.
// Role-aware: the system prompt and conversation title derive from the
// caller's role (teacher/student/parent/admin/superadmin).
chatRouter.post('/', requireAuth, async (req, res) => {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    }
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).json({ message: 'Authorization header required' });
    }
    const gatewayBaseUrl = process.env.API_GATEWAY_URL || 'http://localhost:4000';
    const role = req.user?.role;
    const { conversationId, message, provider: requestedProvider } = parsed.data;
    try {
        let activeConversationId = conversationId;
        let priorMessages = [];
        if (activeConversationId) {
            const loaded = await loadConversationMessages(gatewayBaseUrl, authorization, activeConversationId);
            priorMessages = loaded.messages.map((m) => ({ role: m.role, content: m.content }));
        }
        else {
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
        const chatMessages = [
            { role: 'system', content: systemPromptForRole(role) },
            ...priorMessages,
            { role: 'user', content: message },
        ];
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        writeSse(res, { conversationId: activeConversationId });
        const startedAt = Date.now();
        let fullReply = '';
        let usedProviderId = requestedProvider;
        let promptTokens;
        let completionTokens;
        let runError;
        try {
            for await (const event of agentRouter.run({ providerId: requestedProvider, role, messages: chatMessages })) {
                usedProviderId = event.providerId;
                if (event.type === 'delta') {
                    fullReply += event.text;
                    writeSse(res, { delta: event.text });
                }
                else if (event.type === 'usage') {
                    promptTokens = event.promptTokens;
                    completionTokens = event.completionTokens;
                }
                // 'attempt' events just update usedProviderId (above) for accurate
                // usage-log attribution even if this candidate fails immediately.
            }
        }
        catch (error) {
            runError = error;
        }
        await recordProviderUsage(gatewayBaseUrl, authorization, {
            provider: usedProviderId || 'unknown',
            conversationId: activeConversationId,
            success: !runError,
            errorMessage: runError instanceof Error ? runError.message : runError ? String(runError) : undefined,
            promptTokens,
            completionTokens,
            durationMs: Date.now() - startedAt,
        });
        if (runError) {
            const errMessage = runError instanceof Error ? runError.message : 'AI provider request failed';
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
    }
    catch (error) {
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
aiConversationsProxyRouter.get('/conversations', requireAuth, async (req, res) => {
    const authorization = req.headers.authorization;
    const gatewayBaseUrl = process.env.API_GATEWAY_URL || 'http://localhost:4000';
    const response = await fetch(`${gatewayBaseUrl}/ai-conversations`, { headers: { Authorization: authorization } });
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
});
aiConversationsProxyRouter.get('/conversations/:id/messages', requireAuth, async (req, res) => {
    const authorization = req.headers.authorization;
    const gatewayBaseUrl = process.env.API_GATEWAY_URL || 'http://localhost:4000';
    const response = await fetch(`${gatewayBaseUrl}/ai-conversations/${req.params.id}/messages`, {
        headers: { Authorization: authorization },
    });
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
});
