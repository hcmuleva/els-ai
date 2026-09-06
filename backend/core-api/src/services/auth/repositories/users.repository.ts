import { db } from '../db.js';

export type UserRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  active_role: string;
  profile_image: string | null;
};

export const usersRepository = {
  async findByEmail(email: string): Promise<UserRow | null> {
    const result = await db.query<UserRow>(
      `SELECT id, email, first_name, last_name, password_hash, active_role, profile_image
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email.toLowerCase()],
    );
    return result.rows[0] || null;
  },

  async findById(id: string): Promise<UserRow | null> {
    const result = await db.query<UserRow>(
      `SELECT id, email, first_name, last_name, password_hash, active_role, profile_image
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async listRolesForUser(userId: string): Promise<Array<{ roleName: string; organizationId: string }>> {
    const result = await db.query(
      `SELECT r.role_name, ur.organization_id
       FROM roles r
       INNER JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [userId],
    );
    return result.rows.map((row: any) => ({
      roleName: row.role_name as string,
      organizationId: row.organization_id as string,
    }));
  },
};
