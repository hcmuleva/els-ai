import { db } from './db.js';

export async function initSchemaAndSeed() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT 'welcome',
      active_role TEXT NOT NULL DEFAULT 'student'
    );
  `);

  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT 'welcome';
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );
  `);

  const roles = ['student', 'teacher', 'parent', 'admin'] as const;
  for (const role of roles) {
    await db.query('INSERT INTO roles(name) VALUES($1) ON CONFLICT(name) DO NOTHING', [role]);
  }

  const userSeeds = [
    {
      name: 'ELS Super User',
      email: 'super@els.ai',
      password: 'welcome',
      activeRole: 'student',
      assignedRoles: [...roles],
    },
    {
      name: 'ELS Student User',
      email: 'student@els.ai',
      password: 'welcome',
      activeRole: 'student',
      assignedRoles: ['student'],
    },
    {
      name: 'ELS Teacher User',
      email: 'teacher@els.ai',
      password: 'welcome',
      activeRole: 'teacher',
      assignedRoles: ['teacher'],
    },
    {
      name: 'ELS Parent User',
      email: 'parent@els.ai',
      password: 'welcome',
      activeRole: 'parent',
      assignedRoles: ['parent'],
    },
  ] as const;

  for (const seedUser of userSeeds) {
    const userInsert = await db.query(
      `INSERT INTO users(name, email, password, active_role)
       VALUES($1, $2, $3, $4)
       ON CONFLICT(email)
       DO UPDATE SET
         name = EXCLUDED.name,
         password = EXCLUDED.password,
         active_role = EXCLUDED.active_role
       RETURNING id`,
      [seedUser.name, seedUser.email, seedUser.password, seedUser.activeRole],
    );

    const userId = userInsert.rows[0].id as number;

    await db.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

    for (const roleName of seedUser.assignedRoles) {
      await db.query(
        `INSERT INTO user_roles(user_id, role_id)
         SELECT $1, r.id
         FROM roles r
         WHERE r.name = $2
         ON CONFLICT DO NOTHING`,
        [userId, roleName],
      );
    }
  }
}
