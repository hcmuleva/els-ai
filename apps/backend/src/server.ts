import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { z } from 'zod';

import { db } from './db.js';
import { usersRouter } from './routes/users.js';
import { initSchemaAndSeed } from './seed.js';

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
});

const { PORT } = envSchema.parse(process.env);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/users', usersRouter);

async function bootstrap() {
  await initSchemaAndSeed();

  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
