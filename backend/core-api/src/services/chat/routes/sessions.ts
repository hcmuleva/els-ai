import { Router } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireAuth } from '../../auth/routes/auth.js';
import { db } from '../db.js';
import { ChatOrchestrator } from '../services/chatOrchestrator.js';
import { ChatRealtime } from '../realtime.js';

export const chatSessionsRouter = Router();

const createSessionSchema = z.object({
  chatType: z.enum(['survey', 'performance', 'review']),
  subjectStudentId: z.string().uuid().optional().nullable(),
});

const postMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

// POST /chat/sessions — start or resume a chat session
chatSessionsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const user = req.user;
  if (!user?.organizationId || !user.userId) {
    return res.status(401).json({ message: 'Missing auth context' });
  }

  try {
    const { session, initialMessage } = await ChatOrchestrator.createSession({
      organizationId: user.organizationId,
      initiatorId: user.userId,
      role: (user.role as any) || 'parent',
      chatType: parsed.data.chatType,
      subjectStudentId: parsed.data.subjectStudentId,
    });

    return res.status(201).json({ session, initialMessage });
  } catch (err: any) {
    console.error('[chatSessionsRouter] failed to create session', err);
    return res.status(500).json({ message: err?.message || 'Failed to create chat session' });
  }
});

// GET /chat/sessions/:id — retrieve session & current context slots
chatSessionsRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user?.organizationId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sessionId = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const sessionRes = await db.query(
      `SELECT * FROM chat_sessions WHERE id = $1::uuid AND organization_id = $2::uuid LIMIT 1`,
      [sessionId, user.organizationId]
    );
    const session = sessionRes.rows[0];
    if (!session) return res.status(404).json({ message: 'Session not found' });

    return res.json({ session });
  } catch (err: any) {
    console.error('[chatSessionsRouter] failed to fetch session', err);
    return res.status(500).json({ message: 'Failed to fetch session' });
  }
});

// GET /chat/sessions/:id/messages — retrieve conversation transcript
chatSessionsRouter.get('/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user?.organizationId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sessionId = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const messagesRes = await db.query(
      `SELECT * FROM chat_messages
       WHERE session_id = $1::uuid AND organization_id = $2::uuid
       ORDER BY created_at ASC`,
      [sessionId, user.organizationId]
    );

    return res.json({ messages: messagesRes.rows });
  } catch (err: any) {
    console.error('[chatSessionsRouter] failed to fetch messages', err);
    return res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// POST /chat/sessions/:id/messages — send user message & process verified-cascade turn
chatSessionsRouter.post('/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = postMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid message content', errors: parsed.error.issues });
  }

  const user = req.user;
  if (!user?.organizationId || !user.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const sessionId = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const result = await ChatOrchestrator.handleUserMessage({
      sessionId,
      organizationId: user.organizationId,
      userId: user.userId,
      role: user.role || 'parent',
      content: parsed.data.content,
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[chatSessionsRouter] message processing error', err);
    return res.status(500).json({ message: err?.message || 'Error processing chat message' });
  }
});

// POST /chat/sessions/:id/realtime-token — issue Ably token for this session channel
chatSessionsRouter.post('/:id/realtime-token', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user?.userId || !user.organizationId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const sessionId = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const sessionRes = await db.query<{ chat_type: string }>(
      `SELECT chat_type FROM chat_sessions WHERE id = $1::uuid AND organization_id = $2::uuid LIMIT 1`,
      [sessionId, user.organizationId]
    );
    const session = sessionRes.rows[0];
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const tokenData = await ChatRealtime.issueChatToken(user.userId, session.chat_type, sessionId);
    if (!tokenData) {
      return res.status(200).json({ realtimeAvailable: false });
    }

    return res.json({ realtimeAvailable: true, ...tokenData });
  } catch (err) {
    console.error('[chatSessionsRouter] realtime token error', err);
    return res.status(500).json({ message: 'Failed to issue realtime token' });
  }
});

// PATCH /chat/sessions/:id/status — complete or abandon session
chatSessionsRouter.patch('/:id/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  const status = req.body?.status;
  if (!['active', 'completed', 'abandoned'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const user = req.user;
  if (!user?.organizationId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sessionId = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const updateRes = await db.query(
      `UPDATE chat_sessions
       SET status = $1, updated_at = NOW()
       WHERE id = $2::uuid AND organization_id = $3::uuid
       RETURNING *`,
      [status, sessionId, user.organizationId]
    );

    return res.json({ session: updateRes.rows[0] });
  } catch (err: any) {
    console.error('[chatSessionsRouter] status update error', err);
    return res.status(500).json({ message: 'Failed to update session status' });
  }
});
