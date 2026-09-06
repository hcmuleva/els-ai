import { getDb } from '@els-ai/db-runtime';

export const db = getDb();

export async function ensureSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      organization_id UUID NOT NULL,
      role VARCHAR(32) NOT NULL,
      title VARCHAR(200) NOT NULL DEFAULT 'New conversation',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_ai_conv_user_active
      ON ai_conversations (user_id, updated_at DESC)
      WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS ai_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
      role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ai_msg_conversation
      ON ai_messages (conversation_id, created_at ASC);

    -- Cost/audit trail for the multi-agent router (ai-service/src/agents):
    -- one row per provider invocation, win or lose, so spend and reliability
    -- per provider can be reported on even though today there's only one
    -- (free, local) provider registered.
    CREATE TABLE IF NOT EXISTS ai_provider_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      organization_id UUID NOT NULL,
      role VARCHAR(32) NOT NULL,
      provider VARCHAR(64) NOT NULL,
      conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
      success BOOLEAN NOT NULL,
      error_message TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      duration_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ai_usage_org_created
      ON ai_provider_usage (organization_id, created_at DESC);
  `);
}
