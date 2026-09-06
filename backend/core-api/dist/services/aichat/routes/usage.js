import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db.js';
export const aiUsageRouter = Router();
function getUserId(req) {
    return req.user?.userId || null;
}
function getOrgId(req) {
    return req.user?.organizationId || null;
}
const usageSchema = z.object({
    provider: z.string().trim().min(1).max(64),
    conversationId: z.string().uuid().optional(),
    success: z.boolean(),
    errorMessage: z.string().max(2000).optional(),
    promptTokens: z.number().int().nonnegative().optional(),
    completionTokens: z.number().int().nonnegative().optional(),
    durationMs: z.number().int().nonnegative().optional(),
});
// POST /ai-usage — record one AI-provider invocation. Called by ai-service's
// agent router (fire-and-forget) after every chat request, success or
// failure, so provider spend/reliability can be reported on later.
aiUsageRouter.post('/', requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const organizationId = getOrgId(req);
    if (!userId || !organizationId) {
        return res.status(400).json({ message: 'User/organization not found in auth context' });
    }
    const parsed = usageSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    const role = req.user?.role || 'unknown';
    const d = parsed.data;
    await db.query(`INSERT INTO ai_provider_usage
       (user_id, organization_id, role, provider, conversation_id, success, error_message, prompt_tokens, completion_tokens, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
        userId,
        organizationId,
        role,
        d.provider,
        d.conversationId || null,
        d.success,
        d.errorMessage || null,
        d.promptTokens ?? null,
        d.completionTokens ?? null,
        d.durationMs ?? null,
    ]);
    return res.status(201).json({ ok: true });
});
// GET /ai-usage/summary — per-provider request counts/tokens for the
// caller's organization. Admin/superadmin only (cost visibility is an
// admin concern, same as the Billing panel).
aiUsageRouter.get('/summary', requireAuth, async (req, res) => {
    const organizationId = getOrgId(req);
    const role = req.user?.role;
    if (!organizationId)
        return res.status(400).json({ message: 'Organization not found in auth context' });
    if (role !== 'admin' && role !== 'superadmin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    const { rows } = await db.query(`SELECT provider,
            COUNT(*)::int AS requests,
            COUNT(*) FILTER (WHERE success)::int AS successes,
            COALESCE(SUM(prompt_tokens), 0)::int AS prompt_tokens,
            COALESCE(SUM(completion_tokens), 0)::int AS completion_tokens,
            COALESCE(AVG(duration_ms), 0)::int AS avg_duration_ms
     FROM ai_provider_usage
     WHERE organization_id = $1
     GROUP BY provider
     ORDER BY requests DESC`, [organizationId]);
    return res.json({ providers: rows });
});
//# sourceMappingURL=usage.js.map