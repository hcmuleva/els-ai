import { db } from '../db.js';
export const usersRepository = {
    async findByEmail(email) {
        const result = await db.query(`SELECT id, email, first_name, last_name, password_hash, active_role, profile_image
       FROM users
       WHERE email = $1
       LIMIT 1`, [email.toLowerCase()]);
        return result.rows[0] || null;
    },
    async findById(id) {
        const result = await db.query(`SELECT id, email, first_name, last_name, password_hash, active_role, profile_image
       FROM users
       WHERE id = $1
       LIMIT 1`, [id]);
        return result.rows[0] || null;
    },
    async listRolesForUser(userId) {
        const result = await db.query(`SELECT r.role_name, ur.organization_id
       FROM roles r
       INNER JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`, [userId]);
        return result.rows.map((row) => ({
            roleName: row.role_name,
            organizationId: row.organization_id,
        }));
    },
};
