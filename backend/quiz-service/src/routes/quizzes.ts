import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const quizzesRouter = Router();

// Zod schemas for validation
const createQuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  classLevel: z.string().optional(),
  subject: z.string().optional(),
  quizType: z.enum(['drag_drop', 'image_select', 'sound_match', 'memory_game']),
  difficultyLevel: z.string().optional(),
  backgroundMusicUrl: z.string().optional(),
  theme: z.any().default({}),
  isPublished: z.boolean().default(false),
  isAiGenerated: z.boolean().default(false),
});

const createQuestionSchema = z.object({
  questionType: z.string(),
  questionTitle: z.string().optional(),
  questionInstruction: z.string().optional(),
  questionAudio: z.string().optional(),
  timeLimitSeconds: z.number().default(30),
  points: z.number().default(10),
  sortOrder: z.number().optional(),
  questionData: z.any(),
});

const recordAttemptSchema = z.object({
  quizId: z.string().uuid(),
  score: z.number(),
  totalPoints: z.number(),
  questionAttempts: z.array(z.object({
    questionId: z.string().uuid(),
    isCorrect: z.boolean(),
    responseData: z.any().optional(),
    timeSpentSeconds: z.number().optional(),
  })),
});

// 1. GET /quizzes
quizzesRouter.get('/', requireAuth, async (req: any, res) => {
  const { class_level, subject } = req.query;
  const orgId = req.user.organizationId;

  try {
    let queryStr = `
      SELECT id, title, description, thumbnail_image, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, total_questions, is_published, is_ai_generated, created_at
      FROM quizzes
      WHERE organization_id = $1 AND is_published = true
    `;
    const params: any[] = [orgId];

    if (class_level) {
      params.push(class_level);
      queryStr += ` AND class_level = $${params.length}`;
    }

    if (subject) {
      params.push(subject);
      queryStr += ` AND subject = $${params.length}`;
    }

    queryStr += ` ORDER BY created_at DESC`;

    const result = await db.query(queryStr, params);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch quizzes' });
  }
});

// 2. GET /quizzes/bgm
quizzesRouter.get('/bgm', async (req, res) => {
  const bgmList = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  ];
  const randomBgm = bgmList[Math.floor(Math.random() * bgmList.length)];
  return res.json({ url: randomBgm });
});

// 3. GET /quizzes/:id
quizzesRouter.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const quizResult = await db.query(
      `SELECT * FROM quizzes WHERE id = $1`,
      [id]
    );

    if (quizResult.rowCount === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const quiz = quizResult.rows[0];

    const questionsResult = await db.query(
      `SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [id]
    );

    return res.json({
      ...quiz,
      questions: questionsResult.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch quiz details' });
  }
});

// 4. POST /quizzes
quizzesRouter.post('/', requireAuth, async (req: any, res) => {
  const parsed = createQuizSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const { title, description, classLevel, subject, quizType, difficultyLevel, backgroundMusicUrl, theme, isPublished, isAiGenerated } = parsed.data;
  const orgId = req.user.organizationId;
  const userId = req.user.userId;

  try {
    const result = await db.query(
      `INSERT INTO quizzes (organization_id, title, description, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, is_published, is_ai_generated, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [orgId, title, description, classLevel, subject, quizType, difficultyLevel, backgroundMusicUrl || null, theme, isPublished, isAiGenerated, userId]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create quiz' });
  }
});

// 5. POST /quizzes/:id/questions
quizzesRouter.post('/:id/questions', requireAuth, async (req, res) => {
  const { id } = req.params;
  const parsed = createQuestionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const { questionType, questionTitle, questionInstruction, questionAudio, timeLimitSeconds, points, sortOrder, questionData } = parsed.data;

  try {
    // Check if quiz exists
    const quizExists = await db.query('SELECT 1 FROM quizzes WHERE id = $1', [id]);
    if (quizExists.rowCount === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const result = await db.query(
      `INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, time_limit_seconds, points, sort_order, question_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, questionType, questionTitle || null, questionInstruction || null, questionAudio || null, timeLimitSeconds, points, sortOrder || null, questionData]
    );

    // Update total_questions count on quiz
    await db.query(
      `UPDATE quizzes SET total_questions = total_questions + 1 WHERE id = $1`,
      [id]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create question' });
  }
});

// 6. POST /quizzes/attempts
quizzesRouter.post('/attempts', requireAuth, async (req: any, res) => {
  const parsed = recordAttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const { quizId, score, totalPoints, questionAttempts } = parsed.data;
  const studentId = req.user.userId;

  try {
    await db.query('BEGIN');

    // Create student attempt record
    const attemptResult = await db.query(
      `INSERT INTO student_attempts (student_id, quiz_id, score, total_points)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [studentId, quizId, score, totalPoints]
    );
    const attemptId = attemptResult.rows[0].id;

    // Create question attempt records
    for (const qAttempt of questionAttempts) {
      await db.query(
        `INSERT INTO question_attempts (attempt_id, question_id, is_correct, response_data, time_spent_seconds)
         VALUES ($1, $2, $3, $4, $5)`,
        [attemptId, qAttempt.questionId, qAttempt.isCorrect, qAttempt.responseData || {}, qAttempt.timeSpentSeconds || null]
      );
    }

    await db.query('COMMIT');
    return res.status(201).json({ message: 'Quiz attempt saved successfully', attemptId });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to save quiz attempt' });
  }
});
