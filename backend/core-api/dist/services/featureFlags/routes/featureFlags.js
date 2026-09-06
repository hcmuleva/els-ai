import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { FEATURE_FLAG_REGISTRY, FEATURE_FLAG_KEYS, getFlagDef } from '../registry.js';
export const featureFlagsRouter = Router();
function getOrgId(req) {
    return req.user?.organizationId || null;
}
function canManageFlags(req) {
    const role = req.user?.role;
    return role === 'admin' || role === 'superadmin';
}
// GET /feature-flags — merged {key,label,description,enabled} for every
// registered flag, scoped to the caller's organization. Open to any
// authenticated role (not just admins): the client-side gating hook
// (frontend/src/hooks/useFeatureFlags.ts) needs this for every user whose
// UI a flag might hide, not just the admins who can change it.
featureFlagsRouter.get('/', requireAuth, async (req, res) => {
    const organizationId = getOrgId(req);
    if (!organizationId)
        return res.status(400).json({ message: 'Organization not found in auth context' });
    const { rows } = await db.query(`SELECT flag_key, enabled FROM feature_flags WHERE organization_id = $1`, [organizationId]);
    const overrides = new Map(rows.map((r) => [r.flag_key, r.enabled]));
    return res.json({
        flags: FEATURE_FLAG_REGISTRY.map((def) => ({
            key: def.key,
            label: def.label,
            description: def.description,
            enabled: overrides.has(def.key) ? overrides.get(def.key) : def.defaultEnabled,
        })),
    });
});
const patchSchema = z.object({ enabled: z.boolean() });
// PATCH /feature-flags/:key — admin/superadmin only, scoped to the
// caller's own organization, so a rollout can be turned on/off school by
// school rather than all-or-nothing.
featureFlagsRouter.patch('/:key', requireAuth, async (req, res) => {
    const organizationId = getOrgId(req);
    if (!organizationId)
        return res.status(400).json({ message: 'Organization not found in auth context' });
    if (!canManageFlags(req))
        return res.status(403).json({ message: 'Admin access required' });
    const key = req.params.key;
    if (!FEATURE_FLAG_KEYS.has(key))
        return res.status(404).json({ message: 'Unknown feature flag' });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    }
    const userId = req.user?.userId || null;
    await db.query(`INSERT INTO feature_flags (organization_id, flag_key, enabled, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (organization_id, flag_key)
     DO UPDATE SET enabled = $3, updated_by = $4, updated_at = NOW()`, [organizationId, key, parsed.data.enabled, userId]);
    const def = getFlagDef(key);
    return res.json({ key, label: def.label, description: def.description, enabled: parsed.data.enabled });
});
//# sourceMappingURL=featureFlags.js.map