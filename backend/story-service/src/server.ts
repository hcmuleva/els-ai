import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { createTenantContextMiddleware } from '@els-ai/db-tenant';
import { db } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { storiesRouter } from './routes/stories.js';
import { startScheduler } from './scheduler.js';

config();

const PORT = Number(process.env.PORT || 4014);
const tenantContext = createTenantContextMiddleware();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'story-service' });
});

app.use('/stories', requireAuth, tenantContext, storiesRouter);

async function bootstrap() {
  // Schema is managed by /migrations/* now. ensureSchema removed because
  // els_admin (the role this service connects as) is not the table owner.
  startScheduler();
  app.listen(PORT, () => {
    console.log(`Story Service listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch(async (error) => {
  console.error('Story Service bootstrap failed:', error);
  await db.end();
  process.exit(1);
});
