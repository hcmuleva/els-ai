import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pkg from 'pg';

const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(repoRoot, 'backend/auth-service/.env') });

const PASSWORD = 'welcome';
const DEMO_EMAILS = [
  'demo.aarav@els.ai',
  'demo.diya@els.ai',
  'demo.kabir@els.ai',
  'demo.ananya@els.ai',
  'demo.vivaan@els.ai',
  'demo.parent.sharma@els.ai',
  'demo.parent.patel@els.ai',
  'demo.parent.khan@els.ai',
  'demo.parent.reddy@els.ai',
  'demo.parent.gupta@els.ai',
  'demo.parent@els.ai',
  'demo.teacher.iyer@els.ai',
  'demo.teacher.nair@els.ai',
  'demo.teacher.joshi@els.ai',
  'demo.teacher.verma@els.ai',
  'demo.teacher.desai@els.ai',
];

const EXPORT_QUERIES = [
  {
    table: 'users',
    query: `
      SELECT * FROM users
      WHERE email = ANY($1::text[])
      ORDER BY email
    `,
  },
  {
    table: 'user_roles',
    query: `
      SELECT ur.* FROM user_roles ur
      JOIN users u ON u.id = ur.user_id
      WHERE u.email = ANY($1::text[])
      ORDER BY ur.user_id, ur.role_id
    `,
  },
  {
    table: 'parent_student_links',
    query: `
      SELECT psl.* FROM parent_student_links psl
      JOIN users p ON p.id = psl.parent_user_id
      JOIN users s ON s.id = psl.student_user_id
      WHERE p.email = ANY($1::text[]) OR s.email = ANY($1::text[])
      ORDER BY psl.parent_user_id, psl.student_user_id
    `,
  },
  {
    table: 'classrooms',
    query: `
      SELECT c.* FROM classrooms c
      JOIN users u ON u.id = c.created_by
      WHERE u.email = ANY($1::text[])
      ORDER BY c.created_at, c.id
    `,
  },
  {
    table: 'classroom_student_remarks',
    query: `
      SELECT csr.* FROM classroom_student_remarks csr
      LEFT JOIN users s ON s.id = csr.student_id
      LEFT JOIN users t ON t.id = csr.teacher_id
      LEFT JOIN classrooms c ON c.id = csr.classroom_id
      LEFT JOIN users cu ON cu.id = c.created_by
      WHERE s.email = ANY($1::text[])
         OR t.email = ANY($1::text[])
         OR cu.email = ANY($1::text[])
      ORDER BY csr.created_at, csr.id
    `,
  },
  {
    table: 'student_activity',
    query: `
      SELECT sa.* FROM student_activity sa
      JOIN users u ON u.id = sa.student_id
      WHERE u.email = ANY($1::text[])
      ORDER BY sa.activity_date, sa.created_at, sa.id
    `,
  },
  {
    table: 'student_analytics',
    query: `
      SELECT sa.* FROM student_analytics sa
      JOIN users u ON u.id = sa.student_id
      WHERE u.email = ANY($1::text[])
      ORDER BY sa.analytics_date, sa.id
    `,
  },
  {
    table: 'student_attempts',
    query: `
      SELECT sa.* FROM student_attempts sa
      JOIN users u ON u.id = sa.student_id
      WHERE u.email = ANY($1::text[])
      ORDER BY sa.completed_at, sa.id
    `,
  },
  {
    table: 'achievements',
    query: `
      SELECT DISTINCT a.* FROM achievements a
      JOIN student_achievements sa ON sa.achievement_id = a.id
      JOIN users u ON u.id = sa.student_id
      WHERE u.email = ANY($1::text[])
      ORDER BY a.created_at, a.id
    `,
  },
  {
    table: 'student_achievements',
    query: `
      SELECT sa.* FROM student_achievements sa
      JOIN users u ON u.id = sa.student_id
      WHERE u.email = ANY($1::text[])
      ORDER BY sa.granted_at, sa.id
    `,
  },
  {
    table: 'counseling_sessions',
    query: `
      SELECT cs.* FROM counseling_sessions cs
      LEFT JOIN users p ON p.id = cs.parent_user_id
      LEFT JOIN users s ON s.id = cs.student_user_id
      WHERE p.email = ANY($1::text[]) OR s.email = ANY($1::text[])
      ORDER BY cs.created_at, cs.id
    `,
  },
  {
    table: 'counseling_reports',
    query: `
      SELECT cr.* FROM counseling_reports cr
      LEFT JOIN counseling_sessions cs ON cs.id = cr.session_id
      LEFT JOIN users p ON p.id = cs.parent_user_id
      LEFT JOIN users s ON s.id = cr.student_user_id
      WHERE p.email = ANY($1::text[]) OR s.email = ANY($1::text[])
      ORDER BY cr.created_at, cr.id
    `,
  },
  {
    table: 'parent_feedback',
    query: `
      SELECT pf.* FROM parent_feedback pf
      LEFT JOIN users p ON p.id = pf.parent_user_id
      LEFT JOIN users s ON s.id = pf.student_user_id
      WHERE p.email = ANY($1::text[]) OR s.email = ANY($1::text[])
      ORDER BY pf.created_at, pf.id
    `,
  },
  {
    table: 'parent_assessments',
    query: `
      SELECT pa.* FROM parent_assessments pa
      LEFT JOIN users p ON p.id = pa.parent_user_id
      LEFT JOIN users s ON s.id = pa.student_user_id
      WHERE p.email = ANY($1::text[]) OR s.email = ANY($1::text[])
      ORDER BY pa.created_at, pa.id
    `,
  },
];

function quoteIdent(v) {
  return `"${String(v).replace(/"/g, '""')}"`;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (Buffer.isBuffer(value)) return `E'\\\\x${value.toString('hex')}'`;
  if (value instanceof Date) return `'${value.toISOString().replace('T', ' ').replace('Z', '+00')}'`;
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toInsertSql(table, rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const colSql = cols.map(quoteIdent).join(', ');
  const valuesSql = rows
    .map((row) => `(${cols.map((c) => sqlLiteral(row[c])).join(', ')})`)
    .join(',\n');
  return `INSERT INTO ${quoteIdent(table)} (${colSql}) VALUES\n${valuesSql};\n`;
}

async function run() {
  const connectionString = process.env.DATABASE_URL
    ?? (
      process.env.DB_HOST
      && process.env.DB_PORT
      && process.env.DB_NAME
      && process.env.DB_USER
      && process.env.DB_PASSWORD
        ? `postgresql://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
        : null
    );

  if (!connectionString) {
    throw new Error('DATABASE_URL/DB_* config is missing in backend/auth-service/.env.');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const usersRes = await client.query(
      `
        SELECT id, email, active_role, first_name, last_name
        FROM users
        WHERE email = ANY($1::text[])
        ORDER BY email
      `,
      [DEMO_EMAILS],
    );

    if (!usersRes.rowCount) {
      throw new Error('No demo users found. Seed demo trends first.');
    }

    const statements = [];
    statements.push('-- Auto-generated dump for demo analytics migration');
    statements.push(`-- Generated at ${new Date().toISOString()}`);
    statements.push('BEGIN;');
    statements.push('');
    statements.push('-- Clean existing demo accounts and dependent records');
    statements.push(
      `DELETE FROM classrooms WHERE created_by IN (SELECT id FROM users WHERE email = ANY(ARRAY[${DEMO_EMAILS.map(sqlLiteral).join(', ')}]::text[]));`,
    );
    statements.push(
      `DELETE FROM users WHERE email = ANY(ARRAY[${DEMO_EMAILS.map(sqlLiteral).join(', ')}]::text[]);`,
    );
    statements.push('');

    const counts = {};
    for (const item of EXPORT_QUERIES) {
      const res = await client.query(item.query, [DEMO_EMAILS]);
      counts[item.table] = res.rowCount ?? 0;
      const sql = toInsertSql(item.table, res.rows);
      if (sql) {
        statements.push(`-- ${item.table} (${res.rowCount})`);
        statements.push(sql);
      }
    }

    statements.push('COMMIT;');
    statements.push('');

    const dumpPath = path.join(__dirname, 'demo-analytics-migration.sql');
    await fs.writeFile(dumpPath, statements.join('\n'), 'utf8');

    const credentials = {
      password: PASSWORD,
      generated_at: new Date().toISOString(),
      accounts: usersRes.rows.map((r) => ({
        id: r.id,
        email: r.email,
        role: r.active_role,
        name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
      })),
      table_row_counts: counts,
    };
    const credsPath = path.join(__dirname, 'demo-analytics-accounts.json');
    await fs.writeFile(credsPath, `${JSON.stringify(credentials, null, 2)}\n`, 'utf8');

    console.log(`Created: ${dumpPath}`);
    console.log(`Created: ${credsPath}`);
    console.log('Table row counts:', counts);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('[generate-demo-analytics-dump] Failed:', err.message);
  process.exit(1);
});
