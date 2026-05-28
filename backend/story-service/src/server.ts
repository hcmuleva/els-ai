import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { db, ensureSchema } from './db.js';
import { storiesRouter } from './routes/stories.js';
import { startScheduler } from './scheduler.js';

config();

const PORT = Number(process.env.PORT || 4014);

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'story-service' });
});

app.use('/stories', storiesRouter);

async function bootstrap() {
  await ensureSchema();
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
