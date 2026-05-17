import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
const roleSchema = z.enum(['student', 'teacher', 'parent', 'admin']);
async function getUserWithRoles(userId) {
    const userResult = await db.query(`SELECT id, name, email, active_role
     FROM users
     WHERE id = $1`, [userId]);
    if (userResult.rowCount === 0) {
        return null;
    }
    const rolesResult = await db.query(`SELECT r.name
     FROM roles r
     INNER JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1
     ORDER BY r.name`, [userId]);
    const user = userResult.rows[0];
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        activeRole: user.active_role,
        roles: rolesResult.rows.map((row) => row.name),
    };
}
export const usersRouter = Router();
usersRouter.get('/:id', async (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
        return res.status(400).json({ message: 'Invalid user id' });
    }
    const user = await getUserWithRoles(userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    return res.json(user);
});
usersRouter.patch('/:id/active-role', async (req, res) => {
    const userId = Number(req.params.id);
    const parsedBody = z.object({ role: roleSchema }).safeParse(req.body);
    if (!Number.isFinite(userId)) {
        return res.status(400).json({ message: 'Invalid user id' });
    }
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid role payload' });
    }
    const roleName = parsedBody.data.role;
    const roleExists = await db.query(`SELECT 1
     FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.name = $2`, [userId, roleName]);
    if (roleExists.rowCount === 0) {
        return res.status(400).json({ message: 'Role not assigned to user' });
    }
    await db.query(`UPDATE users
     SET active_role = $1
     WHERE id = $2`, [roleName, userId]);
    const updatedUser = await getUserWithRoles(userId);
    return res.json(updatedUser);
});
