import { Router } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireAuth } from '../../auth/routes/auth.js';
import { db } from '../db.js';
import { ChatOrchestrator } from '../services/chatOrchestrator.js';

export const chatReviewRouter = Router();

const updateReviewSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  teacherNotes: z.string().max(1000).optional(),
});

// GET /chat/review — list entries for teacher audit
chatReviewRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user?.organizationId) return res.status(401).json({ message: 'Unauthorized' });

  const status = (req.query.status as string) || 'pending_review';

  try {
    const entries = await ChatOrchestrator.getReviewQueue({
      organizationId: user.organizationId,
      status,
    });
    return res.json({ entries });
  } catch (err: any) {
    console.error('[chatReviewRouter] fetch error', err);
    return res.status(500).json({ message: 'Failed to fetch review entries' });
  }
});

// GET /chat/review/stats — summary statistics
chatReviewRouter.get('/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user?.organizationId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const statsRes = await db.query<{ review_status: string; count: string }>(
      `SELECT review_status, COUNT(*)::text as count
       FROM chat_survey_entries
       WHERE organization_id = $1::uuid
       GROUP BY review_status`,
      [user.organizationId]
    );

    const counts: Record<string, number> = {
      pending_review: 0,
      auto_accepted: 0,
      approved: 0,
      rejected: 0,
    };

    for (const row of statsRes.rows) {
      counts[row.review_status] = parseInt(row.count, 10);
    }

    return res.json({ counts });
  } catch (err) {
    console.error('[chatReviewRouter] stats error', err);
    return res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// PATCH /chat/review/:id — approve or reject a flagged fact
chatReviewRouter.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = updateReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const user = req.user;
  if (!user?.organizationId || !user.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const entryId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await ChatOrchestrator.updateReviewEntry({
      entryId: String(entryId),
      organizationId: user.organizationId,
      reviewerId: user.userId,
      action: parsed.data.action,
      teacherNotes: parsed.data.teacherNotes,
    });

    if (!updated) {
      return res.status(404).json({ message: 'Review entry not found' });
    }

    return res.json({ entry: updated });
  } catch (err: any) {
    console.error('[chatReviewRouter] update error', err);
    return res.status(500).json({ message: 'Failed to update review entry' });
  }
});
