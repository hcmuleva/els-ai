import { db } from '../db.js';

const TENANT_TABLES = [
  'user_roles',
  'user_global_publish_permissions',
  'organization_subscriptions',
  'invoices',
  'parent_student_links',
  'teacher_subject_assignments',
  'student_activity',
  'student_analytics',
  'subjects',
  'classrooms',
  'classroom_contents',
  'classroom_quizzes',
  'classroom_assignments',
  'classroom_assignment_submissions',
  'classroom_student_remarks',
  'quizzes',
  'quiz_questions',
  'student_attempts',
  'question_attempts',
  'learning_contents',
  'learning_content_sections',
  'content_topics',
  'topic_content_assignments',
  'topic_content_sections',
  'achievements',
  'student_achievements',
  'assets',
];

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return (result.rowCount ?? 0) > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
    [table],
  );
  return (result.rowCount ?? 0) > 0;
}

async function extendOrganizationsSchema() {
  await db.query(`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS logo TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_one_default_org
      ON organizations((is_default)) WHERE is_default = true;
  `);
}

async function ensureUserOrgMapping() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_org_mapping (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      joined_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, organization_id)
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_uom_org ON user_org_mapping(organization_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_uom_user ON user_org_mapping(user_id);`);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_uom_primary
      ON user_org_mapping(user_id) WHERE is_primary = true;
  `);
}

async function ensureUsersPrimaryOrg() {
  if (!(await tableHasColumn('users', 'primary_organization_id'))) {
    await db.query(`
      ALTER TABLE users
        ADD COLUMN primary_organization_id UUID REFERENCES organizations(id);
    `);
  }
}

async function consolidateDefaultOrg(): Promise<{ defaultOrgId: string }> {
  const elsAcademy = await db.query<{ id: string }>(
    `SELECT id FROM organizations WHERE subdomain = 'els-academy' LIMIT 1`,
  );
  let canonicalId: string | undefined = elsAcademy.rows[0]?.id;

  if (!canonicalId) {
    const inserted = await db.query<{ id: string }>(
      `INSERT INTO organizations (name, subdomain, settings, is_default)
       VALUES ('ELS ACADEMY', 'els-academy', '{"theme":"default"}', true)
       RETURNING id`,
    );
    canonicalId = inserted.rows[0].id;
  } else {
    await db.query(
      `UPDATE organizations
       SET name = 'ELS ACADEMY',
           is_default = true,
           updated_at = NOW()
       WHERE id = $1`,
      [canonicalId],
    );
  }

  const legacy = await db.query<{ id: string }>(
    `SELECT id FROM organizations WHERE subdomain = 'default-org' LIMIT 1`,
  );
  const legacyId = legacy.rows[0]?.id;

  if (legacyId && legacyId !== canonicalId) {
    for (const table of TENANT_TABLES) {
      if (!(await tableExists(table))) continue;
      if (!(await tableHasColumn(table, 'organization_id'))) continue;
      try {
        await db.query(
          `UPDATE ${table} SET organization_id = $1::uuid WHERE organization_id = $2::uuid`,
          [canonicalId, legacyId],
        );
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === '23505') {
          await db.query(
            `DELETE FROM ${table} WHERE organization_id = $1::uuid`,
            [legacyId],
          );
        } else {
          throw err;
        }
      }
    }
    await db.query(`DELETE FROM organizations WHERE id = $1::uuid`, [legacyId]);
  }

  await db.query(
    `UPDATE organizations SET is_default = false WHERE id <> $1::uuid AND is_default = true`,
    [canonicalId],
  );

  return { defaultOrgId: canonicalId };
}

async function backfillUserOrgMapping() {
  await db.query(`
    INSERT INTO user_org_mapping (user_id, organization_id, is_primary)
    SELECT user_id, organization_id, false
    FROM (
      SELECT DISTINCT user_id, organization_id
      FROM user_roles
      WHERE user_id IS NOT NULL AND organization_id IS NOT NULL
    ) src
    ON CONFLICT (user_id, organization_id) DO NOTHING;
  `);

  await db.query(`
    WITH ranked AS (
      SELECT user_id,
             organization_id,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY joined_at, organization_id) AS rn
      FROM user_org_mapping
    ),
    needs_primary AS (
      SELECT user_id
      FROM user_org_mapping
      GROUP BY user_id
      HAVING bool_or(is_primary) = false
    )
    UPDATE user_org_mapping uom
    SET is_primary = true
    FROM ranked r, needs_primary np
    WHERE uom.user_id = r.user_id
      AND uom.organization_id = r.organization_id
      AND r.rn = 1
      AND uom.user_id = np.user_id;
  `);

  await db.query(`
    UPDATE users u
    SET primary_organization_id = uom.organization_id
    FROM user_org_mapping uom
    WHERE uom.user_id = u.id
      AND uom.is_primary = true
      AND (u.primary_organization_id IS NULL OR u.primary_organization_id <> uom.organization_id);
  `);
}

async function extendLearningContentSchema() {
  if (await tableExists('learning_content_sections')) {
    await db.query(`
      ALTER TABLE learning_content_sections
        ADD COLUMN IF NOT EXISTS quiz_id UUID;
    `);
  }
}

async function backfillTenantTables(defaultOrgId: string) {
  for (const table of TENANT_TABLES) {
    if (!(await tableExists(table))) continue;
    if (!(await tableHasColumn(table, 'organization_id'))) continue;
    try {
      await db.query(
        `UPDATE ${table} SET organization_id = $1::uuid WHERE organization_id IS NULL`,
        [defaultOrgId],
      );
    } catch (err) {
      console.warn(`[org-service migrate] could not backfill ${table}:`, (err as Error).message);
    }
  }
}

export async function runOrgMigrations(): Promise<{ defaultOrgId: string }> {
  await extendOrganizationsSchema();
  await extendLearningContentSchema();
  await ensureUserOrgMapping();
  await ensureUsersPrimaryOrg();
  const { defaultOrgId } = await consolidateDefaultOrg();
  await backfillUserOrgMapping();
  await backfillTenantTables(defaultOrgId);
  return { defaultOrgId };
}
