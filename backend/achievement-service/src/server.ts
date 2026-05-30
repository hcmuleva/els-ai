import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { createTenantContextMiddleware } from '@els-ai/db-tenant';
import { db } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { achievementsRouter } from './routes/achievements.js';

config();

const PORT = Number(process.env.PORT || 4007);
const tenantContext = createTenantContextMiddleware();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'achievement-service' });
});

app.use('/achievements', requireAuth, tenantContext, achievementsRouter);

async function bootstrap() {
  app.listen(PORT, () => {
    console.log(`Achievement Service listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch(async (error) => {
  console.error('Achievement Service bootstrap failed:', error);
  await db.end();
  process.exit(1);
});
