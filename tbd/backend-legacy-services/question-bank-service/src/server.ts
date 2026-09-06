import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { createTenantContextMiddleware } from '@els-ai/db-tenant';
import { db } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { questionsRouter, questionBankRouter } from './routes/questions.js';

config();

const PORT = Number(process.env.PORT || 4008);
const tenantContext = createTenantContextMiddleware();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'question-bank-service' });
});

app.use('/questions', requireAuth, tenantContext, questionsRouter);
app.use('/question-bank', requireAuth, tenantContext, questionBankRouter);

async function bootstrap() {
  app.listen(PORT, () => {
    console.log(`Question Bank Service listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch(async (error) => {
  console.error('Question Bank Service bootstrap failed:', error);
  await db.end();
  process.exit(1);
});
