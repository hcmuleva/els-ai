import { getDb } from '@els-ai/db-runtime';

export const db = getDb();

export async function ensureSchema() {
  await db.query(`
    -- Per-organization overrides for the flag registry in registry.ts. A
    -- flag with no row here for a given org uses that flag's
    -- defaultEnabled value, so registering a new flag never requires a
    -- migration or a backfill across existing organizations.
    CREATE TABLE IF NOT EXISTS feature_flags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      flag_key VARCHAR(64) NOT NULL,
      enabled BOOLEAN NOT NULL,
      updated_by UUID,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (organization_id, flag_key)
    );
    CREATE INDEX IF NOT EXISTS idx_feature_flags_org
      ON feature_flags (organization_id);
  `);
}
