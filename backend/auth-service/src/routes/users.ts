import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { db } from '../db.js';
import { UserRole, UserWithRoles } from '../types.js';
import { AuthenticatedRequest, requireAuth } from './auth.js';

const roleSchema = z.enum(['student', 'teacher', 'parent', 'admin', 'superadmin']);
const managedRoleSchema = z.enum(['student', 'teacher', 'parent', 'admin']);
const listUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  name: z.string().trim().optional(),
  email: z.string().trim().optional(),
  mobileNumber: z.string().trim().optional(),
  role: managedRoleSchema.optional(),
});
const createUserSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email(),
  mobileNumber: z.string().trim().min(6).max(20).optional(),
  password: z.string().min(4).max(72).optional(),
  role: managedRoleSchema,
});
const assignRolesSchema = z.object({
  roles: z.array(managedRoleSchema).min(1),
});

async function getUserWithRoles(userId: string, organizationId?: string): Promise<UserWithRoles | null> {
  const userResult = await db.query(
    `SELECT id, first_name, last_name, email, mobile_number, active_role, profile_image, is_active
     FROM users
     WHERE id = $1`,
    [userId],
  );

  if (userResult.rowCount === 0) {
    return null;
  }

  const rolesResult =
    organizationId !== undefined
      ? await db.query(
          `SELECT r.role_name, ur.organization_id
           FROM roles r
           INNER JOIN user_roles ur ON ur.role_id = r.id
           WHERE ur.user_id = $1 AND ur.organization_id = $2
           ORDER BY r.role_name`,
          [userId, organizationId],
        )
      : await db.query(
          `SELECT r.role_name, ur.organization_id
           FROM roles r
           INNER JOIN user_roles ur ON ur.role_id = r.id
           WHERE ur.user_id = $1
           ORDER BY r.role_name`,
          [userId],
        );

  const user = userResult.rows[0];
  const roles = rolesResult.rows.map((row: { role_name: string }) => row.role_name as UserRole);
  if (organizationId && roles.length === 0) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    mobileNumber: user.mobile_number || undefined,
    activeRole: user.active_role as UserRole,
    roles,
    profileImage: user.profile_image,
    organizationId: rolesResult.rows[0]?.organization_id || undefined,
    isActive: user.is_active,
  };
}

function getRequestOrganizationId(req: AuthenticatedRequest): string | null {
  return req.user?.organizationId || null;
}

function getSingleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] || null;
  }
  return value || null;
}

async function hasAdminAccess(req: AuthenticatedRequest): Promise<boolean> {
  const userId = req.user?.userId;
  const organizationId = req.user?.organizationId;
  if (!userId || !organizationId) return false;

  const adminCheck = await db.query(
    `SELECT 1
     FROM users u
     INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.organization_id = $2
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1
       AND u.active_role IN ('admin', 'superadmin')
       AND r.role_name = u.active_role
     LIMIT 1`,
    [userId, organizationId],
  );

  return (adminCheck.rowCount ?? 0) > 0;
}

export const usersRouter = Router();

usersRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsedQuery = listUsersQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid list filter payload' });
  }

  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  if (!(await hasAdminAccess(req))) {
    return res.status(403).json({ message: 'Forbidden: admin role required' });
  }

  const { search, name, email, mobileNumber, role } = parsedQuery.data;
  const params: unknown[] = [organizationId];
  const whereClauses: string[] = ['ur.organization_id = $1::uuid', 'u.deleted_at IS NULL'];

  if (search) {
    params.push(`%${search}%`);
    const paramIndex = params.length;
    whereClauses.push(
      `(concat_ws(' ', u.first_name, u.last_name) ILIKE $${paramIndex}
        OR u.email ILIKE $${paramIndex}
        OR COALESCE(u.mobile_number, '') ILIKE $${paramIndex})`,
    );
  }

  if (name) {
    params.push(`%${name}%`);
    whereClauses.push(`concat_ws(' ', u.first_name, u.last_name) ILIKE $${params.length}`);
  }

  if (email) {
    params.push(`%${email}%`);
    whereClauses.push(`u.email ILIKE $${params.length}`);
  }

  if (mobileNumber) {
    params.push(`%${mobileNumber}%`);
    whereClauses.push(`COALESCE(u.mobile_number, '') ILIKE $${params.length}`);
  }

  if (role) {
    params.push(role);
    const roleIndex = params.length;
    whereClauses.push(
      `EXISTS (
         SELECT 1
         FROM user_roles urf
         INNER JOIN roles rf ON rf.id = urf.role_id
         WHERE urf.user_id = u.id
           AND urf.organization_id = ur.organization_id
           AND rf.role_name = $${roleIndex}
       )`,
    );
  }

  try {
    const usersResult = await db.query(
      `SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.mobile_number,
          u.active_role,
          u.profile_image,
          u.is_active,
          $1::text AS organization_id,
          ARRAY_AGG(DISTINCT r.role_name ORDER BY r.role_name) AS roles
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY u.id, u.first_name, u.last_name, u.email, u.mobile_number, u.active_role, u.profile_image, u.is_active
       ORDER BY u.first_name ASC, u.last_name ASC`,
      params,
    );

    const users = usersResult.rows.map((row) => ({
      id: row.id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      email: row.email as string,
      mobileNumber: (row.mobile_number as string | null) || undefined,
      activeRole: row.active_role as UserRole,
      roles: row.roles as UserRole[],
      profileImage: (row.profile_image as string | null) || undefined,
      organizationId: (row.organization_id as string | null) || undefined,
      isActive: row.is_active as boolean,
    }));

    return res.json({ users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to list users' });
  }
});

usersRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsedBody = createUserSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid user payload', errors: parsedBody.error.issues });
  }

  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  if (!(await hasAdminAccess(req))) {
    return res.status(403).json({ message: 'Forbidden: admin role required' });
  }

  const { firstName, lastName, email, mobileNumber, password, role } = parsedBody.data;

  try {
    const emailExists = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (emailExists.rowCount && emailExists.rowCount > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    if (mobileNumber) {
      const mobileExists = await db.query(
        'SELECT 1 FROM users WHERE mobile_number = $1',
        [mobileNumber],
      );
      if (mobileExists.rowCount && mobileExists.rowCount > 0) {
        return res.status(400).json({ message: 'Mobile number already registered' });
      }
    }

    const roleResult = await db.query('SELECT id FROM roles WHERE role_name = $1', [role]);
    if (roleResult.rowCount === 0) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const roleId = roleResult.rows[0].id as string;

    const passwordHash = await bcrypt.hash(password || 'welcome', 10);

    const createdUserResult = await db.query(
      `INSERT INTO users (first_name, last_name, email, mobile_number, password_hash, active_role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [firstName, lastName, email, mobileNumber || null, passwordHash, role],
    );
    const userId = createdUserResult.rows[0].id as string;

    await db.query(
      `INSERT INTO user_roles (user_id, role_id, organization_id)
       VALUES ($1, $2, $3)`,
      [userId, roleId, organizationId],
    );

    const createdUser = await getUserWithRoles(userId, organizationId);
    return res.status(201).json(createdUser);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create user' });
  }
});

usersRouter.patch('/:id/roles', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = getSingleParam(req.params.id);
  const parsedBody = assignRolesSchema.safeParse(req.body);
  if (!userId) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid roles payload' });
  }

  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  if (!(await hasAdminAccess(req))) {
    return res.status(403).json({ message: 'Forbidden: admin role required' });
  }

  const roles = [...new Set(parsedBody.data.roles)];

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const membershipResult = await client.query(
      `SELECT 1
       FROM user_roles
       WHERE user_id = $1 AND organization_id = $2
       LIMIT 1`,
      [userId, organizationId],
    );

    if (membershipResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found in your organization' });
    }

    await client.query(
      `DELETE FROM user_roles ur
       USING roles r
       WHERE ur.role_id = r.id
         AND ur.user_id = $1
         AND ur.organization_id = $2
         AND r.role_name = ANY($3::text[])`,
      [userId, organizationId, managedRoleSchema.options],
    );

    for (const roleName of roles) {
      const roleResult = await client.query('SELECT id FROM roles WHERE role_name = $1', [roleName]);
      if (roleResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Role ${roleName} not found` });
      }

      const roleId = roleResult.rows[0].id as string;
      await client.query(
        `INSERT INTO user_roles (user_id, role_id, organization_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, role_id, organization_id) DO NOTHING`,
        [userId, roleId, organizationId],
      );
    }

    const currentUserResult = await client.query(
      `SELECT active_role FROM users WHERE id = $1`,
      [userId],
    );
    const currentActiveRole = currentUserResult.rows[0]?.active_role as UserRole | undefined;

    if (!currentActiveRole || !roles.includes(currentActiveRole as z.infer<typeof managedRoleSchema>)) {
      await client.query(
        `UPDATE users SET active_role = $1 WHERE id = $2`,
        [roles[0], userId],
      );
    }

    await client.query('COMMIT');

    const updatedUser = await getUserWithRoles(userId, organizationId);
    return res.json(updatedUser);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to update roles' });
  } finally {
    client.release();
  }
});

usersRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = getSingleParam(req.params.id);
  const organizationId = getRequestOrganizationId(req);

  // Simple check for string ID
  if (!userId) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const isAdmin = await hasAdminAccess(req);
    if (!isAdmin && req.user?.userId !== userId) {
      return res.status(403).json({ message: 'Forbidden: cannot access another user profile' });
    }

    const user = await getUserWithRoles(userId, organizationId || undefined);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

usersRouter.patch('/:id/active-role', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = getSingleParam(req.params.id);
  const parsedBody = z.object({ role: roleSchema }).safeParse(req.body);
  const organizationId = getRequestOrganizationId(req);

  if (!userId) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid role payload' });
  }

  const roleName = parsedBody.data.role;

  try {
    const isAdmin = await hasAdminAccess(req);
    if (!isAdmin && req.user?.userId !== userId) {
      return res.status(403).json({ message: 'Forbidden: cannot update another user active role' });
    }

    const roleExists = await db.query(
      `SELECT 1
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.role_name = $2
         ${organizationId ? 'AND ur.organization_id = $3' : ''}`,
      organizationId ? [userId, roleName, organizationId] : [userId, roleName],
    );

    if (roleExists.rowCount === 0) {
      return res.status(400).json({ message: 'Role not assigned to user' });
    }

    await db.query(
      `UPDATE users
       SET active_role = $1
       WHERE id = $2`,
      [roleName, userId],
    );

    const updatedUser = await getUserWithRoles(userId, organizationId || undefined);
    return res.json(updatedUser);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});
