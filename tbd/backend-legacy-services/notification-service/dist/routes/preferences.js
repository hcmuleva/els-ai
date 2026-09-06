import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
export const preferencesRouter = Router();
preferencesRouter.get('/', requireAuth, async (req, res) => {
    const userId = req.user?.userId;
    const orgId = req.user?.organizationId;
    if (!userId || !orgId)
        return res.status(400).json({ message: 'User not found in auth context' });
    const result = await db.query(`SELECT user_id, organization_id, enabled_types, auto_delete_days, updated_at
       FROM notification_preferences WHERE user_id = $1::uuid`, [userId]);
    if (result.rows.length === 0) {
        return res.json({
            preferences: {
                userId,
                organizationId: orgId,
                enabledTypes: ['*'],
                autoDeleteDays: 5,
            },
        });
    }
    const row = result.rows[0];
    return res.json({
        preferences: {
            userId: row.user_id,
            organizationId: row.organization_id,
            enabledTypes: row.enabled_types,
            autoDeleteDays: row.auto_delete_days,
            updatedAt: row.updated_at,
        },
    });
});
const updateSchema = z.object({
    enabledTypes: z.array(z.string()).optional(),
    autoDeleteDays: z.number().int().min(1).max(60).optional(),
});
preferencesRouter.put('/', requireAuth, async (req, res) => {
    const userId = req.user?.userId;
    const orgId = req.user?.organizationId;
    if (!userId || !orgId)
        return res.status(400).json({ message: 'User not found in auth context' });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    const enabledTypes = parsed.data.enabledTypes ?? ['*'];
    const autoDeleteDays = parsed.data.autoDeleteDays ?? 5;
    await db.query(`INSERT INTO notification_preferences (user_id, organization_id, enabled_types, auto_delete_days, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::jsonb, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET enabled_types = EXCLUDED.enabled_types,
           auto_delete_days = EXCLUDED.auto_delete_days,
           updated_at = NOW()`, [userId, orgId, JSON.stringify(enabledTypes), autoDeleteDays]);
    return res.json({ preferences: { userId, organizationId: orgId, enabledTypes, autoDeleteDays } });
});
