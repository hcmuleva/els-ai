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
  classLevel: z.string().trim().optional(),
});
const assignRolesSchema = z.object({
  roles: z.array(managedRoleSchema).min(1),
});
const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    mobileNumber: z.string().trim().min(6).max(20).optional(),
    password: z.string().min(4).max(72).optional(),
    classLevel: z.string().trim().optional(),
    activeRole: managedRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
  });
const studentSearchQuerySchema = z.object({
  query: z.string().trim().optional(),
  classLevel: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(80),
});
const parentAssignmentQuerySchema = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(80),
});
const teacherAssignmentQuerySchema = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(80),
});
const upsertParentStudentsSchema = z.object({
  studentIds: z.array(z.string().uuid()),
});
const upsertTeacherAssignmentsSchema = z.object({
  assignments: z.array(
    z.object({
      classLevel: z.string().trim().min(1).max(50),
      subject: z.string().trim().min(1).max(100),
    }),
  ),
});

async function getUserWithRoles(userId: string, organizationId?: string): Promise<UserWithRoles | null> {
  const userResult = await db.query(
    `SELECT id, first_name, last_name, email, mobile_number, class_level, active_role, profile_image, is_active
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
    classLevel: user.class_level || undefined,
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

async function userHasRoleInOrg(userId: string, organizationId: string, roleName: UserRole): Promise<boolean> {
  const result = await db.query(
    `SELECT 1
     FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
       AND ur.organization_id = $2::uuid
       AND r.role_name = $3
     LIMIT 1`,
    [userId, organizationId, roleName],
  );
  return (result.rowCount ?? 0) > 0;
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
          u.class_level,
          u.active_role,
          u.profile_image,
          u.is_active,
          $1::text AS organization_id,
          ARRAY_AGG(DISTINCT r.role_name ORDER BY r.role_name) AS roles
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY u.id, u.first_name, u.last_name, u.email, u.mobile_number, u.class_level, u.active_role, u.profile_image, u.is_active
       ORDER BY u.first_name ASC, u.last_name ASC`,
      params,
    );

    const users = usersResult.rows.map((row) => ({
      id: row.id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      email: row.email as string,
      mobileNumber: (row.mobile_number as string | null) || undefined,
      classLevel: (row.class_level as string | null) || undefined,
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

  const { firstName, lastName, email, mobileNumber, password, role, classLevel } = parsedBody.data;

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
      `INSERT INTO users (first_name, last_name, email, mobile_number, class_level, password_hash, active_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [firstName, lastName, email, mobileNumber || null, classLevel || null, passwordHash, role],
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

usersRouter.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = getSingleParam(req.params.id);
  const parsedBody = updateUserSchema.safeParse(req.body);
  if (!userId) {
    return res.status(400).json({ message: 'Invalid user id' });
  }
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid user update payload', errors: parsedBody.error.issues });
  }

  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  if (!(await hasAdminAccess(req))) {
    return res.status(403).json({ message: 'Forbidden: admin role required' });
  }

  const membership = await db.query(
    `SELECT 1
     FROM user_roles
     WHERE user_id = $1
       AND organization_id = $2::uuid
     LIMIT 1`,
    [userId, organizationId],
  );
  if ((membership.rowCount ?? 0) === 0) {
    return res.status(404).json({ message: 'User not found in your organization' });
  }

  const { firstName, lastName, email, mobileNumber, password, classLevel, activeRole, isActive } = parsedBody.data;

  if (email) {
    const emailExists = await db.query('SELECT 1 FROM users WHERE email = $1 AND id <> $2', [email, userId]);
    if ((emailExists.rowCount ?? 0) > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }
  }
  if (mobileNumber) {
    const mobileExists = await db.query('SELECT 1 FROM users WHERE mobile_number = $1 AND id <> $2', [mobileNumber, userId]);
    if ((mobileExists.rowCount ?? 0) > 0) {
      return res.status(400).json({ message: 'Mobile number already registered' });
    }
  }
  if (activeRole) {
    const hasRole = await userHasRoleInOrg(userId, organizationId, activeRole);
    if (!hasRole) {
      return res.status(400).json({ message: `User does not have ${activeRole} role in this organization` });
    }
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  if (firstName !== undefined) {
    params.push(firstName);
    updates.push(`first_name = $${params.length}`);
  }
  if (lastName !== undefined) {
    params.push(lastName);
    updates.push(`last_name = $${params.length}`);
  }
  if (email !== undefined) {
    params.push(email.toLowerCase());
    updates.push(`email = $${params.length}`);
  }
  if (mobileNumber !== undefined) {
    params.push(mobileNumber);
    updates.push(`mobile_number = $${params.length}`);
  }
  if (classLevel !== undefined) {
    params.push(classLevel || null);
    updates.push(`class_level = $${params.length}`);
  }
  if (password !== undefined) {
    const hash = await bcrypt.hash(password, 10);
    params.push(hash);
    updates.push(`password_hash = $${params.length}`);
  }
  if (activeRole !== undefined) {
    params.push(activeRole);
    updates.push(`active_role = $${params.length}`);
  }
  if (isActive !== undefined) {
    params.push(isActive);
    updates.push(`is_active = $${params.length}`);
  }
  params.push(userId);
  updates.push(`updated_at = NOW()`);

  try {
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    const updatedUser = await getUserWithRoles(userId, organizationId);
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json(updatedUser);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update user' });
  }
});

usersRouter.get('/students/search', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsedQuery = studentSearchQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid student search filters', errors: parsedQuery.error.issues });
  }

  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  if (!(await hasAdminAccess(req))) {
    return res.status(403).json({ message: 'Forbidden: admin role required' });
  }

  const { query, classLevel, limit } = parsedQuery.data;
  const params: unknown[] = [organizationId];
  const whereClauses: string[] = ['ur.organization_id = $1::uuid', 'r.role_name = \'student\'', 'u.deleted_at IS NULL'];

  if (query) {
    params.push(`%${query}%`);
    const idx = params.length;
    whereClauses.push(
      `(concat_ws(' ', u.first_name, u.last_name) ILIKE $${idx}
        OR u.email ILIKE $${idx}
        OR COALESCE(u.mobile_number, '') ILIKE $${idx}
        OR u.id::text ILIKE $${idx})`,
    );
  }
  if (classLevel) {
    params.push(classLevel);
    whereClauses.push(`COALESCE(u.class_level, '') = $${params.length}`);
  }
  params.push(limit);

  try {
    const result = await db.query(
      `SELECT DISTINCT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.mobile_number,
         u.class_level
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY u.first_name, u.last_name
       LIMIT $${params.length}`,
      params,
    );
    const students = result.rows.map((row) => ({
      id: row.id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      email: row.email as string,
      mobileNumber: (row.mobile_number as string | null) || undefined,
      classLevel: (row.class_level as string | null) || undefined,
    }));
    return res.json({ students });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to search students' });
  }
});

usersRouter.get('/parents/assignments', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsedQuery = parentAssignmentQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid parent assignment filters', errors: parsedQuery.error.issues });
  }

  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  if (!(await hasAdminAccess(req))) {
    return res.status(403).json({ message: 'Forbidden: admin role required' });
  }

  const { search, limit } = parsedQuery.data;
  const params: unknown[] = [organizationId];
  const whereClauses: string[] = ['ur.organization_id = $1::uuid', 'r.role_name = \'parent\'', 'u.deleted_at IS NULL'];
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    whereClauses.push(
      `(concat_ws(' ', u.first_name, u.last_name) ILIKE $${idx}
        OR u.email ILIKE $${idx}
        OR COALESCE(u.mobile_number, '') ILIKE $${idx})`,
    );
  }
  params.push(limit);

  try {
    const result = await db.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.mobile_number,
         COALESCE(
           jsonb_agg(
             DISTINCT jsonb_build_object(
               'id', s.id,
               'firstName', s.first_name,
               'lastName', s.last_name,
               'classLevel', s.class_level
             )
           ) FILTER (WHERE s.id IS NOT NULL),
           '[]'::jsonb
         ) AS students
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       LEFT JOIN parent_student_links psl ON psl.parent_user_id = u.id AND psl.organization_id = ur.organization_id
       LEFT JOIN users s ON s.id = psl.student_user_id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY u.id, u.first_name, u.last_name, u.email, u.mobile_number
       ORDER BY u.first_name, u.last_name
       LIMIT $${params.length}`,
      params,
    );
    return res.json({
      parents: result.rows.map((row) => ({
        id: row.id as string,
        firstName: row.first_name as string,
        lastName: row.last_name as string,
        email: row.email as string,
        mobileNumber: (row.mobile_number as string | null) || undefined,
        students: row.students as Array<{ id: string; firstName: string; lastName: string; classLevel?: string }>,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch parent assignments' });
  }
});

usersRouter.put('/parents/:id/students', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parentUserId = getSingleParam(req.params.id);
  const parsedBody = upsertParentStudentsSchema.safeParse(req.body);
  if (!parentUserId) {
    return res.status(400).json({ message: 'Invalid parent id' });
  }
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid parent student payload', errors: parsedBody.error.issues });
  }

  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  if (!(await hasAdminAccess(req))) {
    return res.status(403).json({ message: 'Forbidden: admin role required' });
  }

  const isParent = await userHasRoleInOrg(parentUserId, organizationId, 'parent');
  if (!isParent) {
    return res.status(404).json({ message: 'Parent not found in your organization' });
  }

  const uniqueStudentIds = [...new Set(parsedBody.data.studentIds)];
  if (uniqueStudentIds.length > 0) {
    const studentValidation = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.organization_id = $1::uuid
         AND r.role_name = 'student'
         AND ur.user_id = ANY($2::uuid[])`,
      [organizationId, uniqueStudentIds],
    );
    const validCount = Number(studentValidation.rows[0]?.count || 0);
    if (validCount !== uniqueStudentIds.length) {
      return res.status(400).json({ message: 'One or more selected students are invalid for this organization' });
    }
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM parent_student_links
       WHERE parent_user_id = $1
         AND organization_id = $2::uuid`,
      [parentUserId, organizationId],
    );

    for (const studentId of uniqueStudentIds) {
      await client.query(
        `INSERT INTO parent_student_links (parent_user_id, student_user_id, organization_id)
         VALUES ($1, $2, $3::uuid)
         ON CONFLICT (parent_user_id, student_user_id, organization_id) DO NOTHING`,
        [parentUserId, studentId, organizationId],
      );
    }
    await client.query('COMMIT');
    return res.json({ parentUserId, studentIds: uniqueStudentIds });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to assign students to parent' });
  } finally {
    client.release();
  }
});

usersRouter.get('/teachers/assignments', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsedQuery = teacherAssignmentQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid teacher assignment filters', errors: parsedQuery.error.issues });
  }

  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  if (!(await hasAdminAccess(req))) {
    return res.status(403).json({ message: 'Forbidden: admin role required' });
  }

  const { search, limit } = parsedQuery.data;
  const params: unknown[] = [organizationId];
  const whereClauses: string[] = ['ur.organization_id = $1::uuid', 'r.role_name = \'teacher\'', 'u.deleted_at IS NULL'];
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    whereClauses.push(
      `(concat_ws(' ', u.first_name, u.last_name) ILIKE $${idx}
        OR u.email ILIKE $${idx}
        OR COALESCE(u.mobile_number, '') ILIKE $${idx})`,
    );
  }
  params.push(limit);

  try {
    const result = await db.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.mobile_number,
         COALESCE(
           jsonb_agg(
             DISTINCT jsonb_build_object(
               'classLevel', tss.class_level,
               'subject', tss.subject
             )
           ) FILTER (WHERE tss.id IS NOT NULL),
           '[]'::jsonb
         ) AS assignments
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       LEFT JOIN teacher_standard_subjects tss ON tss.teacher_user_id = u.id AND tss.organization_id = ur.organization_id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY u.id, u.first_name, u.last_name, u.email, u.mobile_number
       ORDER BY u.first_name, u.last_name
       LIMIT $${params.length}`,
      params,
    );
    return res.json({
      teachers: result.rows.map((row) => ({
        id: row.id as string,
        firstName: row.first_name as string,
        lastName: row.last_name as string,
        email: row.email as string,
        mobileNumber: (row.mobile_number as string | null) || undefined,
        assignments: row.assignments as Array<{ classLevel: string; subject: string }>,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch teacher assignments' });
  }
});

usersRouter.put('/teachers/:id/assignments', requireAuth, async (req: AuthenticatedRequest, res) => {
  const teacherUserId = getSingleParam(req.params.id);
  const parsedBody = upsertTeacherAssignmentsSchema.safeParse(req.body);
  if (!teacherUserId) {
    return res.status(400).json({ message: 'Invalid teacher id' });
  }
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid teacher assignment payload', errors: parsedBody.error.issues });
  }

  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  if (!(await hasAdminAccess(req))) {
    return res.status(403).json({ message: 'Forbidden: admin role required' });
  }

  const isTeacher = await userHasRoleInOrg(teacherUserId, organizationId, 'teacher');
  if (!isTeacher) {
    return res.status(404).json({ message: 'Teacher not found in your organization' });
  }

  const uniqueAssignments = Array.from(
    new Map(
      parsedBody.data.assignments.map((item) => [`${item.classLevel.toLowerCase()}::${item.subject.toLowerCase()}`, item]),
    ).values(),
  );

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM teacher_standard_subjects
       WHERE teacher_user_id = $1
         AND organization_id = $2::uuid`,
      [teacherUserId, organizationId],
    );
    for (const assignment of uniqueAssignments) {
      await client.query(
        `INSERT INTO teacher_standard_subjects (teacher_user_id, organization_id, class_level, subject)
         VALUES ($1, $2::uuid, $3, $4)
         ON CONFLICT (teacher_user_id, organization_id, class_level, subject) DO NOTHING`,
        [teacherUserId, organizationId, assignment.classLevel, assignment.subject],
      );
    }
    await client.query('COMMIT');
    return res.json({ teacherUserId, assignments: uniqueAssignments });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to assign standards and subjects to teacher' });
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
