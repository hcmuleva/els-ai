import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from './auth.js';
const createOrganizationSchema = z.object({
    name: z.string().trim().min(2).max(255),
    subdomain: z.string().trim().min(2).max(100),
    logoUrl: z.string().trim().optional(),
    settings: z.record(z.string(), z.any()).optional(),
});
const listOrganizationUsersQuerySchema = z.object({
    search: z.string().trim().optional(),
    role: z.enum(['student', 'teacher', 'parent', 'admin', 'superadmin']).optional(),
});
const updateOrganizationSchema = z
    .object({
    name: z.string().trim().min(2).max(255).optional(),
    subdomain: z.string().trim().min(2).max(100).optional(),
    logoUrl: z.string().trim().optional(),
    settings: z.record(z.string(), z.any()).optional(),
})
    .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
});
async function isSuperAdmin(userId) {
    if (!userId)
        return false;
    const result = await db.query(`SELECT 1
     FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
       AND r.role_name = 'superadmin'
     LIMIT 1`, [userId]);
    return (result.rowCount ?? 0) > 0;
}
export const organizationsRouter = Router();
organizationsRouter.get('/', requireAuth, async (req, res) => {
    if (!(await isSuperAdmin(req.user?.userId))) {
        return res.status(403).json({ message: 'Forbidden: superadmin role required' });
    }
    const result = await db.query(`SELECT id, name, subdomain, logo_url, settings, created_at
     FROM organizations
     ORDER BY created_at DESC`);
    return res.json({
        organizations: result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            subdomain: row.subdomain,
            logoUrl: row.logo_url || undefined,
            settings: row.settings || {},
            createdAt: row.created_at,
        })),
    });
});
organizationsRouter.post('/', requireAuth, async (req, res) => {
    const parsedBody = createOrganizationSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid organization payload', errors: parsedBody.error.issues });
    }
    if (!(await isSuperAdmin(req.user?.userId))) {
        return res.status(403).json({ message: 'Forbidden: superadmin role required' });
    }
    const { name, subdomain, logoUrl, settings } = parsedBody.data;
    try {
        const result = await db.query(`INSERT INTO organizations (name, subdomain, logo_url, settings)
       VALUES ($1, LOWER($2), $3, $4)
       RETURNING id, name, subdomain, logo_url, settings, created_at`, [name, subdomain, logoUrl || null, settings || {}]);
        const row = result.rows[0];
        return res.status(201).json({
            id: row.id,
            name: row.name,
            subdomain: row.subdomain,
            logoUrl: row.logo_url || undefined,
            settings: row.settings || {},
            createdAt: row.created_at,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to create organization' });
    }
});
organizationsRouter.patch('/:id', requireAuth, async (req, res) => {
    const organizationId = req.params.id;
    const parsedBody = updateOrganizationSchema.safeParse(req.body);
    if (!organizationId) {
        return res.status(400).json({ message: 'Invalid organization id' });
    }
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid organization payload', errors: parsedBody.error.issues });
    }
    if (!(await isSuperAdmin(req.user?.userId))) {
        return res.status(403).json({ message: 'Forbidden: superadmin role required' });
    }
    const updates = [];
    const params = [];
    const { name, subdomain, logoUrl, settings } = parsedBody.data;
    if (name !== undefined) {
        params.push(name);
        updates.push(`name = $${params.length}`);
    }
    if (subdomain !== undefined) {
        params.push(subdomain.toLowerCase());
        updates.push(`subdomain = $${params.length}`);
    }
    if (logoUrl !== undefined) {
        params.push(logoUrl || null);
        updates.push(`logo_url = $${params.length}`);
    }
    if (settings !== undefined) {
        params.push(settings || {});
        updates.push(`settings = $${params.length}`);
    }
    params.push(organizationId);
    try {
        const result = await db.query(`UPDATE organizations
       SET ${updates.join(', ')}
       WHERE id = $${params.length}::uuid
       RETURNING id, name, subdomain, logo_url, settings, created_at`, params);
        if ((result.rowCount ?? 0) === 0) {
            return res.status(404).json({ message: 'Organization not found' });
        }
        const row = result.rows[0];
        return res.json({
            id: row.id,
            name: row.name,
            subdomain: row.subdomain,
            logoUrl: row.logo_url || undefined,
            settings: row.settings || {},
            createdAt: row.created_at,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to update organization' });
    }
});
organizationsRouter.get('/:id/users', requireAuth, async (req, res) => {
    const organizationId = req.params.id;
    const parsedQuery = listOrganizationUsersQuerySchema.safeParse(req.query);
    if (!organizationId) {
        return res.status(400).json({ message: 'Invalid organization id' });
    }
    if (!parsedQuery.success) {
        return res.status(400).json({ message: 'Invalid user list filters', errors: parsedQuery.error.issues });
    }
    if (!(await isSuperAdmin(req.user?.userId))) {
        return res.status(403).json({ message: 'Forbidden: superadmin role required' });
    }
    const { search, role } = parsedQuery.data;
    const params = [organizationId];
    const whereClauses = ['ur.organization_id = $1::uuid', 'u.deleted_at IS NULL'];
    if (search) {
        params.push(`%${search}%`);
        whereClauses.push(`(concat_ws(' ', u.first_name, u.last_name) ILIKE $${params.length}
         OR u.email ILIKE $${params.length}
         OR COALESCE(u.mobile_number, '') ILIKE $${params.length})`);
    }
    if (role) {
        params.push(role);
        whereClauses.push(`EXISTS (
         SELECT 1
         FROM user_roles urf
         INNER JOIN roles rf ON rf.id = urf.role_id
         WHERE urf.user_id = u.id
           AND urf.organization_id = ur.organization_id
           AND rf.role_name = $${params.length}
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
         ARRAY_AGG(DISTINCT r.role_name ORDER BY r.role_name) AS roles,
         COALESCE(ugpp.enabled, false) AS can_publish_global
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       LEFT JOIN user_global_publish_permissions ugpp
         ON ugpp.user_id = u.id
        AND ugpp.organization_id = ur.organization_id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY u.id, u.first_name, u.last_name, u.email, u.mobile_number, u.class_level, u.branch, u.active_role, u.is_active, ugpp.enabled
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
