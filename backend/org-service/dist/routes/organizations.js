import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
export const organizationsRouter = Router();
const createOrganizationSchema = z.object({
    name: z.string().trim().min(2).max(255),
    subdomain: z.string().trim().min(2).max(100),
    logo: z.string().trim().optional(),
    logoUrl: z.string().trim().optional(),
    isDefault: z.boolean().optional(),
    settings: z.record(z.string(), z.any()).optional(),
});
const updateOrganizationSchema = z
    .object({
    name: z.string().trim().min(2).max(255).optional(),
    subdomain: z.string().trim().min(2).max(100).optional(),
    logo: z.string().trim().optional(),
    logoUrl: z.string().trim().optional(),
    isDefault: z.boolean().optional(),
    settings: z.record(z.string(), z.any()).optional(),
})
    .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
});
const listOrgsQuerySchema = z.object({
    search: z.string().trim().optional(),
    is_default: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => (value === undefined ? undefined : value === 'true')),
});
const listMembersQuerySchema = z.object({
    search: z.string().trim().optional(),
    role: z.enum(['student', 'teacher', 'parent', 'admin', 'superadmin']).optional(),
});
const addMemberSchema = z.object({
    userId: z.string().uuid(),
    roleName: z.enum(['student', 'teacher', 'parent', 'admin', 'superadmin']).optional(),
    isPrimary: z.boolean().optional(),
});
function isSuperAdmin(req) {
    return Boolean(req.user?.isSuperAdmin) || req.user?.role === 'superadmin';
}
async function isOrgMember(userId, orgId) {
    if (!userId)
        return false;
    const result = await db.query(`SELECT 1 FROM user_org_mapping WHERE user_id = $1 AND organization_id = $2::uuid LIMIT 1`, [userId, orgId]);
    return (result.rowCount ?? 0) > 0;
}
async function isOrgAdminOrSuper(req, orgId) {
    if (isSuperAdmin(req))
        return true;
    const userId = req.user?.userId;
    if (!userId)
        return false;
    const result = await db.query(`SELECT 1
     FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
       AND ur.organization_id = $2::uuid
       AND r.role_name IN ('admin', 'superadmin')
     LIMIT 1`, [userId, orgId]);
    return (result.rowCount ?? 0) > 0;
}
function rowToOrg(row) {
    return {
        id: row.id,
        name: row.name,
        subdomain: row.subdomain || undefined,
        logo: row.logo || row.logo_url || undefined,
        isDefault: Boolean(row.is_default),
        settings: row.settings || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at || undefined,
        deletedAt: row.deleted_at || undefined,
    };
}
organizationsRouter.get('/_meta', requireAuth, async (_req, res) => {
    const totals = await db.query(`SELECT COUNT(*)::text AS count FROM organizations WHERE deleted_at IS NULL`);
    res.json({
        service: 'org-service',
        version: '1.0.0',
        description: 'Owns the organization tenancy: CRUD over orgs, user-org membership mapping, default-org enforcement, cross-org guard helpers.',
        organizations: Number(totals.rows[0]?.count || 0),
    });
});
organizationsRouter.get('/me', requireAuth, async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ message: 'Authentication required' });
    const result = await db.query(`SELECT o.id, o.name, o.subdomain, o.logo, o.logo_url, o.is_default, o.settings, o.created_at, o.updated_at, uom.is_primary
     FROM user_org_mapping uom
     INNER JOIN organizations o ON o.id = uom.organization_id
     WHERE uom.user_id = $1
       AND o.deleted_at IS NULL
     ORDER BY uom.is_primary DESC, o.name ASC`, [userId]);
    res.json({
        organizations: result.rows.map((row) => ({
            ...rowToOrg(row),
            isPrimary: Boolean(row.is_primary),
        })),
    });
});
organizationsRouter.get('/', requireAuth, async (req, res) => {
    const parsedQuery = listOrgsQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
        return res.status(400).json({ message: 'Invalid query', errors: parsedQuery.error.issues });
    }
    if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Forbidden: superadmin role required' });
    }
    const params = [];
    const where = ['deleted_at IS NULL'];
    if (parsedQuery.data.search) {
        params.push(`%${parsedQuery.data.search}%`);
        where.push(`(name ILIKE $${params.length} OR subdomain ILIKE $${params.length})`);
    }
    if (parsedQuery.data.is_default !== undefined) {
        params.push(parsedQuery.data.is_default);
        where.push(`is_default = $${params.length}`);
    }
    const result = await db.query(`SELECT id, name, subdomain, logo, logo_url, is_default, settings, created_at, updated_at, deleted_at
     FROM organizations
     WHERE ${where.join(' AND ')}
     ORDER BY is_default DESC, created_at DESC`, params);
    return res.json({ organizations: result.rows.map(rowToOrg) });
});
organizationsRouter.get('/:id', requireAuth, async (req, res) => {
    const orgId = req.params.id;
    if (!orgId)
        return res.status(400).json({ message: 'Invalid organization id' });
    const canRead = isSuperAdmin(req) || (await isOrgMember(req.user?.userId, orgId));
    if (!canRead)
        return res.status(403).json({ message: 'Forbidden: not a member of this organization' });
    const result = await db.query(`SELECT id, name, subdomain, logo, logo_url, is_default, settings, created_at, updated_at, deleted_at
     FROM organizations
     WHERE id = $1::uuid AND deleted_at IS NULL`, [orgId]);
    if ((result.rowCount ?? 0) === 0)
        return res.status(404).json({ message: 'Organization not found' });
    return res.json(rowToOrg(result.rows[0]));
});
organizationsRouter.post('/', requireAuth, async (req, res) => {
    const parsedBody = createOrganizationSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid payload', errors: parsedBody.error.issues });
    }
    if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Forbidden: superadmin role required' });
    }
    const { name, subdomain, logo, logoUrl, isDefault, settings } = parsedBody.data;
    try {
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            if (isDefault) {
                await client.query(`UPDATE organizations SET is_default = false WHERE is_default = true`);
            }
            const result = await client.query(`INSERT INTO organizations (name, subdomain, logo, logo_url, is_default, settings)
         VALUES ($1, LOWER($2), $3, $4, COALESCE($5, false), $6)
         RETURNING id, name, subdomain, logo, logo_url, is_default, settings, created_at, updated_at, deleted_at`, [name, subdomain, logo ?? logoUrl ?? null, logoUrl ?? null, isDefault ?? false, settings || {}]);
            await client.query('COMMIT');
            return res.status(201).json(rowToOrg(result.rows[0]));
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to create organization' });
    }
});
organizationsRouter.patch('/:id', requireAuth, async (req, res) => {
    const orgId = req.params.id;
    const parsedBody = updateOrganizationSchema.safeParse(req.body);
    if (!orgId)
        return res.status(400).json({ message: 'Invalid organization id' });
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid payload', errors: parsedBody.error.issues });
    }
    if (!(await isOrgAdminOrSuper(req, orgId))) {
        return res.status(403).json({ message: 'Forbidden: admin/superadmin role required' });
    }
    const updates = [];
    const params = [];
    const { name, subdomain, logo, logoUrl, isDefault, settings } = parsedBody.data;
    if (name !== undefined) {
        params.push(name);
        updates.push(`name = $${params.length}`);
    }
    if (subdomain !== undefined) {
        params.push(subdomain.toLowerCase());
        updates.push(`subdomain = $${params.length}`);
    }
    if (logo !== undefined) {
        params.push(logo || null);
        updates.push(`logo = $${params.length}`);
    }
    if (logoUrl !== undefined) {
        params.push(logoUrl || null);
        updates.push(`logo_url = $${params.length}`);
    }
    if (settings !== undefined) {
        params.push(settings || {});
        updates.push(`settings = $${params.length}`);
    }
    updates.push(`updated_at = NOW()`);
    try {
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            if (isDefault === true) {
                await client.query(`UPDATE organizations SET is_default = false WHERE is_default = true`);
                params.push(true);
                updates.push(`is_default = $${params.length}`);
            }
            else if (isDefault === false) {
                params.push(false);
                updates.push(`is_default = $${params.length}`);
            }
            params.push(orgId);
            const result = await client.query(`UPDATE organizations
         SET ${updates.join(', ')}
         WHERE id = $${params.length}::uuid AND deleted_at IS NULL
         RETURNING id, name, subdomain, logo, logo_url, is_default, settings, created_at, updated_at, deleted_at`, params);
            if ((result.rowCount ?? 0) === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Organization not found' });
            }
            await client.query('COMMIT');
            return res.json(rowToOrg(result.rows[0]));
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to update organization' });
    }
});
organizationsRouter.delete('/:id', requireAuth, async (req, res) => {
    const orgId = req.params.id;
    if (!orgId)
        return res.status(400).json({ message: 'Invalid organization id' });
    if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Forbidden: superadmin role required' });
    }
    const existing = await db.query(`SELECT is_default FROM organizations WHERE id = $1::uuid AND deleted_at IS NULL`, [orgId]);
    if ((existing.rowCount ?? 0) === 0)
        return res.status(404).json({ message: 'Organization not found' });
    if (existing.rows[0].is_default) {
        return res.status(409).json({ message: 'Cannot delete the default organization' });
    }
    await db.query(`UPDATE organizations SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1::uuid`, [orgId]);
    return res.status(204).send();
});
organizationsRouter.get('/:id/users', requireAuth, async (req, res) => {
    const orgId = req.params.id;
    const parsedQuery = listMembersQuerySchema.safeParse(req.query);
    if (!orgId)
        return res.status(400).json({ message: 'Invalid organization id' });
    if (!parsedQuery.success) {
        return res.status(400).json({ message: 'Invalid query', errors: parsedQuery.error.issues });
    }
    const allowed = isSuperAdmin(req) || (await isOrgMember(req.user?.userId, orgId));
    if (!allowed)
        return res.status(403).json({ message: 'Forbidden: not a member of this organization' });
    const { search, role } = parsedQuery.data;
    const params = [orgId];
    const where = ['uom.organization_id = $1::uuid', 'u.deleted_at IS NULL'];
    if (search) {
        params.push(`%${search}%`);
        where.push(`(concat_ws(' ', u.first_name, u.last_name) ILIKE $${params.length}
         OR u.email ILIKE $${params.length}
         OR COALESCE(u.mobile_number, '') ILIKE $${params.length})`);
    }
    if (role) {
        params.push(role);
        where.push(`EXISTS (
         SELECT 1 FROM user_roles ur
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = u.id
           AND ur.organization_id = uom.organization_id
           AND r.role_name = $${params.length}
       )`);
    }
    try {
        const result = await db.query(`SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.mobile_number,
         u.class_level,
         u.branch,
         u.active_role,
         u.is_active,
         uom.is_primary,
         ARRAY_AGG(DISTINCT r.role_name ORDER BY r.role_name)
           FILTER (WHERE r.role_name IS NOT NULL) AS roles,
         COALESCE(ugpp.enabled, false) AS can_publish_global
       FROM user_org_mapping uom
       INNER JOIN users u ON u.id = uom.user_id
       LEFT JOIN user_roles ur
         ON ur.user_id = u.id AND ur.organization_id = uom.organization_id
       LEFT JOIN roles r ON r.id = ur.role_id
       LEFT JOIN user_global_publish_permissions ugpp
         ON ugpp.user_id = u.id AND ugpp.organization_id = uom.organization_id
       WHERE ${where.join(' AND ')}
       GROUP BY u.id, uom.is_primary, ugpp.enabled
       ORDER BY u.first_name, u.last_name`, params);
        return res.json({
            users: result.rows.map((row) => ({
                id: row.id,
                firstName: row.first_name,
                lastName: row.last_name,
                email: row.email,
                mobileNumber: row.mobile_number || undefined,
                classLevel: row.class_level || undefined,
                branch: row.branch || undefined,
                activeRole: row.active_role,
                isActive: Boolean(row.is_active),
                isPrimary: Boolean(row.is_primary),
                roles: row.roles || [],
                canPublishGlobal: Boolean(row.can_publish_global),
            })),
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to list organization users' });
    }
});
organizationsRouter.post('/:id/members', requireAuth, async (req, res) => {
    const orgId = req.params.id;
    const parsedBody = addMemberSchema.safeParse(req.body);
    if (!orgId)
        return res.status(400).json({ message: 'Invalid organization id' });
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid payload', errors: parsedBody.error.issues });
    }
    if (!(await isOrgAdminOrSuper(req, orgId))) {
        return res.status(403).json({ message: 'Forbidden: admin/superadmin role required' });
    }
    const { userId, roleName, isPrimary } = parsedBody.data;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO user_org_mapping (user_id, organization_id, is_primary)
       VALUES ($1::uuid, $2::uuid, COALESCE($3, false))
       ON CONFLICT (user_id, organization_id) DO NOTHING`, [userId, orgId, isPrimary ?? false]);
        if (isPrimary === true) {
            await client.query(`UPDATE user_org_mapping SET is_primary = false WHERE user_id = $1::uuid AND organization_id <> $2::uuid`, [userId, orgId]);
            await client.query(`UPDATE user_org_mapping SET is_primary = true WHERE user_id = $1::uuid AND organization_id = $2::uuid`, [userId, orgId]);
            await client.query(`UPDATE users SET primary_organization_id = $2::uuid WHERE id = $1::uuid`, [userId, orgId]);
        }
        if (roleName) {
            const roleResult = await client.query(`SELECT id FROM roles WHERE role_name = $1 LIMIT 1`, [roleName]);
            if ((roleResult.rowCount ?? 0) > 0) {
                await client.query(`INSERT INTO user_roles (user_id, role_id, organization_id)
           VALUES ($1::uuid, $2::uuid, $3::uuid)
           ON CONFLICT (user_id, role_id, organization_id) DO NOTHING`, [userId, roleResult.rows[0].id, orgId]);
            }
        }
        await client.query('COMMIT');
        return res.status(201).json({ message: 'Member added' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        return res.status(500).json({ message: 'Failed to add member' });
    }
    finally {
        client.release();
    }
});
organizationsRouter.delete('/:id/members/:userId', requireAuth, async (req, res) => {
    const orgId = req.params.id;
    const memberId = req.params.userId;
    if (!orgId || !memberId)
        return res.status(400).json({ message: 'Invalid params' });
    if (!(await isOrgAdminOrSuper(req, orgId))) {
        return res.status(403).json({ message: 'Forbidden: admin/superadmin role required' });
    }
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM user_roles WHERE user_id = $1::uuid AND organization_id = $2::uuid`, [memberId, orgId]);
        await client.query(`DELETE FROM user_org_mapping WHERE user_id = $1::uuid AND organization_id = $2::uuid`, [memberId, orgId]);
        await client.query(`UPDATE users SET primary_organization_id = NULL WHERE id = $1::uuid AND primary_organization_id = $2::uuid`, [memberId, orgId]);
        await client.query('COMMIT');
        return res.status(204).send();
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        return res.status(500).json({ message: 'Failed to remove member' });
    }
    finally {
        client.release();
    }
});
organizationsRouter.patch('/:id/members/:userId/primary', requireAuth, async (req, res) => {
    const orgId = req.params.id;
    const memberId = req.params.userId;
    if (!orgId || !memberId)
        return res.status(400).json({ message: 'Invalid params' });
    const isSelf = req.user?.userId === memberId;
    if (!isSelf && !(await isOrgAdminOrSuper(req, orgId))) {
        return res.status(403).json({ message: 'Forbidden: only the user or admin can change primary org' });
    }
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const exists = await client.query(`SELECT 1 FROM user_org_mapping WHERE user_id = $1::uuid AND organization_id = $2::uuid LIMIT 1`, [memberId, orgId]);
        if ((exists.rowCount ?? 0) === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Membership not found' });
        }
        await client.query(`UPDATE user_org_mapping SET is_primary = false WHERE user_id = $1::uuid`, [memberId]);
        await client.query(`UPDATE user_org_mapping SET is_primary = true WHERE user_id = $1::uuid AND organization_id = $2::uuid`, [memberId, orgId]);
        await client.query(`UPDATE users SET primary_organization_id = $2::uuid WHERE id = $1::uuid`, [memberId, orgId]);
        await client.query('COMMIT');
        return res.json({ message: 'Primary organization updated' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        return res.status(500).json({ message: 'Failed to update primary organization' });
    }
    finally {
        client.release();
    }
});
