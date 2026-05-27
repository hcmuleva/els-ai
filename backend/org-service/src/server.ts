import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { db } from './db.js';
import { organizationsRouter } from './routes/organizations.js';
import { runOrgMigrations } from './services/migrate.js';

config();

const PORT = Number(process.env.PORT || 4012);

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'org-service' });
});

app.use('/organizations', organizationsRouter);

async function bootstrap() {
  const { defaultOrgId } = await runOrgMigrations();
  console.log(`Org Service migrations applied. Default org id: ${defaultOrgId}`);
  app.listen(PORT, () => {
    console.log(`Org Service listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch(async (error) => {
  console.error('Org Service bootstrap failed:', error);
  await db.end();
  process.exit(1);
});
