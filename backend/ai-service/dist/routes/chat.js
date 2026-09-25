import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { systemPromptForRole, defaultTitleForRole, canGenerateContent } from '../chat/prompts.js';
import { appendMessage, createConversation, loadConversationMessages, updateConversationTitle } from '../chat/persistClient.js';
import { generateFastTitle, generateLlmTitle } from '../chat/titleGenerator.js';
import { recordProviderUsage } from '../chat/usageClient.js';
import { agentRouter } from '../agents/router.js';
export const chatRouter = Router();
const chatRequestSchema = z.object({
    conversationId: z.string().uuid().optional(),
    message: z.string().trim().min(1).max(8000),
    // Optional explicit provider id (e.g. "factory", "ollama", "openai")
    provider: z.string().trim().min(1).max(64).optional(),
    // Optional explicit model name (e.g. "gpt-4o", "claude-3-5-sonnet", etc.)
    model: z.string().trim().min(1).max(128).optional(),
    // Optional active student context with verified DB metrics & Jev diagnosis
    studentContext: z.record(z.string(), z.any()).optional(),
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
    const { conversationId, message, provider: requestedProvider, model: requestedModel, studentContext, } = parsed.data;
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
        const titleHint = priorMessages.length === 0 ? generateFastTitle(message) : undefined;
        await appendMessage(gatewayBaseUrl, authorization, activeConversationId, {
            role: 'user',
            content: message,
            titleHint,
        });
        let systemPrompt = systemPromptForRole(role);
        if (studentContext) {
            const ctx = studentContext;
            const studentName = ctx.student?.name || 'Selected Student';
            const studentClass = ctx.student?.classLevel ? `(Grade: ${ctx.student.classLevel})` : '';
            const metrics = ctx.metrics || {};
            const jev = ctx.jevDiagnosis || {};
            const bestQuizStr = metrics.bestQuiz ? `${metrics.bestQuiz.title} (Score: ${metrics.bestQuiz.scorePct}%)` : 'None logged';
            const lowestQuizzesStr = metrics.lowestQuizzes?.length
                ? metrics.lowestQuizzes.map((q) => `${q.title} (${q.scorePct}%)`).join(', ')
                : 'None';
            const weakQuestionsStr = metrics.weakQuestions?.length
                ? metrics.weakQuestions.map((q) => `${q.title} (Missed ${q.missedCount}x)`).join('; ')
                : 'No recurring question errors';
            const remarksStr = metrics.latestRemarks?.length
                ? metrics.latestRemarks.map((r) => `"${r.remark}"`).join('; ')
                : 'None';
            systemPrompt += `\n\n## ACTIVE STUDENT CONTEXT (VERIFIED DB METRICS & DIAGNOSTIC EVALUATION):
- Student: ${studentName} ${studentClass}
- Total Quizzes Attempted: ${metrics.totalQuizzes ?? 0}
- Overall Average Accuracy: ${metrics.averageScorePct ?? 0}%
- Best Performed Quiz: ${bestQuizStr}
- Lowest Scoring Quizzes: ${lowestQuizzesStr}
- Top Missed Concepts / Weak Questions: ${weakQuestionsStr}
- Teacher Remarks: ${remarksStr}
- Academic Mastery Standing: ${jev.masteryTier || 'N/A'} (Struggle Risk: ${jev.riskScore ?? 0}/3)
- Primary Learning Gap / Struggle Domain: ${jev.primaryWeakDomain || 'None'}
- Recommended Action Plan: ${jev.recommendedIntervention || 'None'}

CRITICAL RULES FOR THIS STUDENT:
1. The teacher is asking specifically about ${studentName}.
2. ALWAYS ground your answers in the verified database metrics and diagnostic evaluation above.
3. When asked for weak areas, performance summaries, or report cards, cite these exact numbers, titles, and insights directly in clean, beautifully structured Markdown (with bold stats, bullet lists, and clear sections).
4. When asked for weak areas or learning gaps, you can output a structured learning gap card using:
\`\`\`json
{
  "type": "learning_gap_summary",
  "weak_areas": [
    { "title": "<Topic / Concept Title>", "description": "<Diagnosed struggle details>" }
  ],
  "learning_gap": "<Brief pedagogical synthesis of the core struggle>"
}
\`\`\`
followed by a 1-2 sentence pedagogical note, OR clean Markdown. NEVER output a \`generation_proposal\` for student summaries or report cards.
5. NEVER mention the internal engine name "Jev" to the user. Refer to it naturally as "Academic Diagnostics", "Learning Insights", or "Pedagogical Recommendations".
6. If the teacher asks to create a remedial quiz or lesson, then and only then propose a standard generation proposal.`;
        }
        const chatMessages = [
            { role: 'system', content: systemPrompt },
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
        let hasReceivedContent = false;
        let isInsideThink = false;
        try {
            for await (const event of agentRouter.run({ providerId: requestedProvider, model: requestedModel, role, messages: chatMessages })) {
                usedProviderId = event.providerId;
                if (event.type === 'thinking') {
                    writeSse(res, { thinking: event.text });
                }
                else if (event.type === 'delta') {
                    let text = event.text;
                    while (text.length > 0) {
                        if (isInsideThink) {
                            const closeIdx = text.indexOf('</think>');
                            if (closeIdx !== -1) {
                                const thoughtChunk = text.slice(0, closeIdx);
                                if (thoughtChunk)
                                    writeSse(res, { thinking: thoughtChunk });
                                isInsideThink = false;
                                text = text.slice(closeIdx + 8);
                            }
                            else {
                                writeSse(res, { thinking: text });
                                text = '';
                            }
                        }
                        else {
                            const openIdx = text.indexOf('<think>');
                            if (openIdx !== -1) {
                                const beforeThink = text.slice(0, openIdx);
                                if (beforeThink) {
                                    hasReceivedContent = true;
                                    fullReply += beforeThink;
                                    writeSse(res, { delta: beforeThink });
                                }
                                isInsideThink = true;
                                text = text.slice(openIdx + 7);
                            }
                            else {
                                hasReceivedContent = true;
                                fullReply += text;
                                writeSse(res, { delta: text });
                                text = '';
                            }
                        }
                    }
                }
                else if (event.type === 'usage') {
                    promptTokens = event.promptTokens;
                    completionTokens = event.completionTokens;
                }
            }
        }
        catch (error) {
            runError = error;
        }
        finally {
            // cleanup if needed
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
        // Strip generation_proposal blocks for non-creator roles (student, parent, admin)
        if (!canGenerateContent(role) && fullReply.includes('generation_proposal')) {
            fullReply = fullReply.replace(/```json\s*\{[^`]*?\"type\"\s*:\s*\"generation_proposal\"[^`]*?\}\s*```/gs, '\n\n> ⚠️ Content creation is only available to teachers. I can help you understand this topic or find your weak areas instead!');
        }
        // Detect inline content written by model instead of a proposal (for creator roles)
        // If the reply looks like full quiz/lesson content but has no generation_proposal JSON,
        // append a warning + instruction SSE so the user knows to retry with a cleaner request.
        const hasProposalBlock = fullReply.includes('"type": "generation_proposal"') || fullReply.includes('"type":"generation_proposal"');
        const looksLikeInlineContent = !hasProposalBlock && canGenerateContent(role) && (/Q\d+\.\s+.+\n.*[A-D]\)/m.test(fullReply) || // quiz questions pattern
            (fullReply.includes('Section') && fullReply.includes('Answer:')) || // worksheet pattern
            (fullReply.includes('youtube.com/watch') && fullReply.includes('VIDEO_ID')) // fake video URL
        );
        if (looksLikeInlineContent) {
            const notice = '\n\n---\n> ⚠️ **Note:** The AI wrote out content directly instead of creating a Generation Proposal. Please try again — say "Generate a quiz on [topic]" and it will show you the Generate Now button.';
            fullReply += notice;
            writeSse(res, { delta: notice });
        }
        if (fullReply.trim().length > 0) {
            await appendMessage(gatewayBaseUrl, authorization, activeConversationId, {
                role: 'assistant',
                content: fullReply,
            }).catch((err) => {
                console.error('[ai-chat] failed to persist assistant reply', err);
            });
            // Refine conversation title with intelligent LLM label after the first turn
            if (priorMessages.length === 0 && activeConversationId) {
                void generateLlmTitle(message, fullReply).then((refined) => {
                    if (refined && activeConversationId) {
                        void updateConversationTitle(gatewayBaseUrl, authorization, activeConversationId, refined).catch(() => { });
                    }
                });
            }
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
