import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { db } from './db.js';
import { assetsRouter } from './routes/assets.js';

config();

const PORT = process.env.PORT || 4004;
const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'media-service' });
});

app.use('/assets', assetsRouter);

async function ensureAssetsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      asset_type VARCHAR(50),
      file_url TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await db.query(`
    ALTER TABLE assets
    DROP CONSTRAINT IF EXISTS assets_organization_id_fkey;
  `);
}

async function bootstrap() {
  await ensureAssetsTable();
  app.listen(PORT, () => {
    console.log(`Media Service listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch(async (error) => {
  console.error('Media Service bootstrap failed:', error);
  await db.end();
  process.exit(1);
});
