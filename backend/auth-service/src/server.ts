import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { db } from './db.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { studentsRouter } from './routes/students.js';
import { initSchemaAndSeed } from './seed/seed.js';

config();

const PORT = process.env.PORT || 4101;
const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/students', studentsRouter);

async function bootstrap() {
  // Seeding run from auth-service since it owns the users database initialization
  await initSchemaAndSeed();

  app.listen(PORT, () => {
    console.log(`Auth Service listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch(async (error) => {
  console.error('Auth Service bootstrap failed:', error);
  await db.end();
  process.exit(1);
});
