import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { db } from './db.js';
import { quizzesRouter } from './routes/quizzes.js';

config();

const PORT = process.env.PORT || 4002;
const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'quiz-service' });
});

app.use('/quizzes', quizzesRouter);

async function bootstrap() {
  let retries = 5;
  while (retries > 0) {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS learning_content_sections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content_id UUID REFERENCES learning_contents(id) ON DELETE CASCADE,
          section_order INTEGER NOT NULL,
          content_type VARCHAR(50) NOT NULL,
          media_url TEXT,
          external_url TEXT,
          text_content TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      break;
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      console.log('Database tables not ready yet, retrying in 2 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  app.listen(PORT, () => {
    console.log(`Quiz Service listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch(async (error) => {
  console.error('Quiz Service bootstrap failed:', error);
  await db.end();
  process.exit(1);
});
