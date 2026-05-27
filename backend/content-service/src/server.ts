import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { db } from './db.js';
import { contentRouter } from './routes/content.js';

config();

const PORT = Number(process.env.PORT || 4009);

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'content-service' });
});

app.use('/content', contentRouter);

async function bootstrap() {
  app.listen(PORT, () => {
    console.log(`Content Service listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch(async (error) => {
  console.error('Content Service bootstrap failed:', error);
  await db.end();
  process.exit(1);
});
