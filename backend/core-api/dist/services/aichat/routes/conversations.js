import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db.js';
export const aiConversationsRouter = Router();
function getUserId(req) {
    return req.user?.userId || null;
}
function getOrgId(req) {
    return req.user?.organizationId || null;
}
function toConversation(row) {
    return {
        id: row.id,
        role: row.role,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function toMessage(row) {
    return {
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at,
    };
}
// GET /ai-conversations — list the caller's own conversations, most recent first.
aiConversationsRouter.get('/', requireAuth, async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(400).json({ message: 'User not found in auth context' });
    const { rows } = await db.query(`SELECT * FROM ai_conversations
     WHERE user_id = $1 AND deleted_at IS NULL
     ORDER BY updated_at DESC
     LIMIT 50`, [userId]);
    return res.json({ conversations: rows.map(toConversation) });
});
const createSchema = z.object({
    role: z.string().min(1),
    title: z.string().trim().min(1).max(200).optional(),
});
// POST /ai-conversations — start a new conversation for the caller.
aiConversationsRouter.post('/', requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const organizationId = getOrgId(req);
    if (!userId || !organizationId) {
        return res.status(400).json({ message: 'User/organization not found in auth context' });
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    const { rows } = await db.query(`INSERT INTO ai_conversations (user_id, organization_id, role, title)
     VALUES ($1, $2, $3, $4)
     RETURNING *`, [userId, organizationId, parsed.data.role, parsed.data.title || 'New conversation']);
    return res.status(201).json({ conversation: toConversation(rows[0]) });
});
async function loadOwnedConversation(conversationId, userId) {
    const { rows } = await db.query(`SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [conversationId, userId]);
    return rows[0] || null;
}
// GET /ai-conversations/:id/messages — full message history for one conversation.
aiConversationsRouter.get('/:id/messages', requireAuth, async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(400).json({ message: 'User not found in auth context' });
    const conversation = await loadOwnedConversation(req.params.id, userId);
    if (!conversation)
        return res.status(404).json({ message: 'Conversation not found' });
    const { rows } = await db.query(`SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC`, [conversation.id]);
    return res.json({ conversation: toConversation(conversation), messages: rows.map(toMessage) });
});
const messageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1),
    // Optional: rename the conversation from its first user message.
    titleHint: z.string().trim().min(1).max(200).optional(),
});
// POST /ai-conversations/:id/messages — append a message (used by ai-service to
// persist both the user's turn and the streamed assistant reply).
aiConversationsRouter.post('/:id/messages', requireAuth, async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(400).json({ message: 'User not found in auth context' });
    const conversation = await loadOwnedConversation(req.params.id, userId);
    if (!conversation)
        return res.status(404).json({ message: 'Conversation not found' });
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    const { rows: existingRows } = await db.query(`SELECT COUNT(*)::int AS count FROM ai_messages WHERE conversation_id = $1`, [conversation.id]);
    const isFirstMessage = existingRows[0]?.count === 0;
    const { rows } = await db.query(`INSERT INTO ai_messages (conversation_id, role, content)
     VALUES ($1, $2, $3)
     RETURNING *`, [conversation.id, parsed.data.role, parsed.data.content]);
    const shouldRetitle = isFirstMessage && parsed.data.titleHint;
    if (shouldRetitle) {
        await db.query(`UPDATE ai_conversations SET title = $1, updated_at = NOW() WHERE id = $2`, [parsed.data.titleHint.slice(0, 200), conversation.id]);
    }
    else {
        await db.query(`UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1`, [conversation.id]);
    }
    return res.status(201).json({ message: toMessage(rows[0]) });
});
// DELETE /ai-conversations/:id — soft delete.
aiConversationsRouter.delete('/:id', requireAuth, async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(400).json({ message: 'User not found in auth context' });
    const conversation = await loadOwnedConversation(req.params.id, userId);
    if (!conversation)
        return res.status(404).json({ message: 'Conversation not found' });
    await db.query(`UPDATE ai_conversations SET deleted_at = NOW() WHERE id = $1`, [conversation.id]);
    return res.status(204).send();
});
//# sourceMappingURL=conversations.js.map