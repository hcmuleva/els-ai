import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { createTenantContextMiddleware } from '@els-ai/db-tenant';
import { db } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { assetsRouter, internalAssetsRouter } from './routes/assets.js';

config();

const PORT = process.env.PORT || 4004;
const tenantContext = createTenantContextMiddleware();
const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'media-service' });
});

app.use('/assets/internal', internalAssetsRouter);
app.use('/assets', requireAuth, tenantContext, assetsRouter);

async function bootstrap() {
  // Schema is managed by /migrations/* now. The legacy ensureAssetsTable
  // call is removed because els_app cannot run DDL.
  // See docs/RLS_ROLLOUT.md §3.5.
  app.listen(PORT, () => {
    console.log(`Media Service listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch(async (error) => {
  console.error('Media Service bootstrap failed:', error);
  await db.end();
  process.exit(1);
});
