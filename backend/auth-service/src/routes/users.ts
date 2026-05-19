import { Router } from 'express';
import { z } from 'zod';

import { db } from '../db.js';
import { UserRole, UserWithRoles } from '../types.js';

const roleSchema = z.enum(['student', 'teacher', 'parent', 'admin', 'superadmin']);

async function getUserWithRoles(userId: string): Promise<UserWithRoles | null> {
  const userResult = await db.query(
    `SELECT id, first_name, last_name, email, active_role, profile_image
     FROM users
     WHERE id = $1`,
    [userId],
  );

  if (userResult.rowCount === 0) {
    return null;
  }

  const rolesResult = await db.query(
    `SELECT r.role_name, ur.organization_id
     FROM roles r
     INNER JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1
     ORDER BY r.role_name`,
    [userId],
  );

  const user = userResult.rows[0];

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    activeRole: user.active_role as UserRole,
    roles: rolesResult.rows.map((row: { role_name: string }) => row.role_name as UserRole),
    profileImage: user.profile_image,
    organizationId: rolesResult.rows[0]?.organization_id || undefined,
  };
}

export const usersRouter = Router();

usersRouter.get('/:id', async (req, res) => {
  const userId = req.params.id;

  // Simple check for string ID
  if (!userId) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const user = await getUserWithRoles(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

usersRouter.patch('/:id/active-role', async (req, res) => {
  const userId = req.params.id;
  const parsedBody = z.object({ role: roleSchema }).safeParse(req.body);

  if (!userId) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid role payload' });
  }

  const roleName = parsedBody.data.role;

  try {
    const roleExists = await db.query(
      `SELECT 1
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.role_name = $2`,
      [userId, roleName],
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

    const updatedUser = await getUserWithRoles(userId);
    return res.json(updatedUser);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});
