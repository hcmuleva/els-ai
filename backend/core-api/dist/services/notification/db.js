import { getDb } from '@els-ai/db-runtime';
export const db = getDb();
export async function ensureSchema() {
    await db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      organization_id UUID NOT NULL,
      type VARCHAR(64) NOT NULL,
      category VARCHAR(32) NOT NULL DEFAULT 'system',
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'unread',
      cta_label VARCHAR(60),
      cta_route TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      source_event_id UUID,
      parent_notification_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      read_at TIMESTAMPTZ,
      expiry_at TIMESTAMPTZ NOT NULL,
      deleted_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_notif_user_active
      ON notifications (user_id, status, created_at DESC)
      WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_notif_expiry
      ON notifications (expiry_at)
      WHERE deleted_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_idem
      ON notifications (user_id, source_event_id, type)
      WHERE source_event_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS notification_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      classroom_id UUID NOT NULL,
      organization_id UUID NOT NULL,
      trigger_type VARCHAR(32) NOT NULL,
      fire_at TIMESTAMPTZ NOT NULL,
      status VARCHAR(16) DEFAULT 'pending',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sched_due
      ON notification_schedules (fire_at)
      WHERE status = 'pending';

    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id UUID PRIMARY KEY,
      organization_id UUID NOT NULL,
      enabled_types JSONB DEFAULT '["*"]'::jsonb,
      auto_delete_days INT DEFAULT 5,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}
//# sourceMappingURL=db.js.map