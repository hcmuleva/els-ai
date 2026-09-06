import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { NotificationStore } from '../services/notification-store.js';

export const notificationsRouter = Router();

function getUserId(req: AuthenticatedRequest): string | null {
  return (req as any).user?.userId || null;
}
function getOrgId(req: AuthenticatedRequest): string | null {
  return (req as any).user?.organizationId || null;
}

function toResponse(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    type: row.type,
    category: row.category,
    title: row.title,
    message: row.message,
    status: row.status,
    ctaLabel: row.cta_label,
    ctaRoute: row.cta_route,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    readAt: row.read_at,
    expiryAt: row.expiry_at,
  };
}

const listQuery = z.object({
  status: z.enum(['unread', 'read']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

notificationsRouter.get('/', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(400).json({ message: 'User not found in auth context' });
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid query' });
  const { rows, total } = await NotificationStore.listForUser(userId, parsed.data);
  return res.json({ notifications: rows.map(toResponse), total });
});

notificationsRouter.get('/unread-count', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(400).json({ message: 'User not found in auth context' });
  const count = await NotificationStore.unreadCount(userId);
  return res.json({ count });
});

notificationsRouter.get('/recent', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(400).json({ message: 'User not found in auth context' });
  const limit = Math.min(Number(req.query.limit) || 5, 20);
  const { rows } = await NotificationStore.listForUser(userId, { limit });
  return res.json({ notifications: rows.map(toResponse) });
});

notificationsRouter.get('/teacher-activity', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(400).json({ message: 'User not found in auth context' });
  const counts = await NotificationStore.teacherActivityCounts(userId);
  return res.json({ counts });
});

notificationsRouter.patch('/teacher-activity/:classroomId/seen', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(400).json({ message: 'User not found in auth context' });
  const updated = await NotificationStore.markTeacherActivitySeen(userId, String(req.params.classroomId));
  return res.json({ updated });
});

notificationsRouter.patch('/read-all', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const orgId = getOrgId(req);
  if (!userId || !orgId) return res.status(400).json({ message: 'User not found in auth context' });
  const updated = await NotificationStore.markAllRead(userId, orgId);
  return res.json({ updated });
});

notificationsRouter.patch('/:id/read', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(400).json({ message: 'User not found in auth context' });
  const row = await NotificationStore.markRead(userId, String(req.params.id));
  if (!row) return res.status(404).json({ message: 'Notification not found' });
  return res.json({ notification: toResponse(row) });
});

notificationsRouter.delete('/read-all', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const orgId = getOrgId(req);
  if (!userId || !orgId) return res.status(400).json({ message: 'User not found in auth context' });
  const deleted = await NotificationStore.deleteAllRead(userId, orgId);
  return res.json({ deleted });
});

notificationsRouter.delete('/:id', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const orgId = getOrgId(req);
  if (!userId || !orgId) return res.status(400).json({ message: 'User not found in auth context' });
  const ok = await NotificationStore.deleteOne(userId, orgId, String(req.params.id));
  if (!ok) return res.status(404).json({ message: 'Notification not found' });
  return res.json({ deleted: true });
});

const rangeSchema = z.enum(['hour', 'day', 'week', 'all']);

notificationsRouter.delete('/', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const orgId = getOrgId(req);
  if (!userId || !orgId) return res.status(400).json({ message: 'User not found in auth context' });
  const range = rangeSchema.safeParse(req.query.range);
  if (!range.success) return res.status(400).json({ message: 'Invalid range' });
  const deleted = await NotificationStore.deleteRange(userId, orgId, range.data);
  return res.json({ deleted });
});
