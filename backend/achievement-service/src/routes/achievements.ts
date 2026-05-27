import { Router } from 'express';
import {
  AuthenticatedRequest,
  canManageTeacherContent,
  getUserId,
} from '@els-ai/internal-auth';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const achievementsRouter = Router();

achievementsRouter.get('/_meta', requireAuth, async (_req: AuthenticatedRequest, res) => {
  const totals = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM achievements WHERE is_global = true`,
  );
  res.json({
    service: 'achievement-service',
    version: '2.0.0',
    phase: 2,
    description: 'Owns the achievement domain (global catalog + classroom grants + student history).',
    achievementsInCatalog: Number(totals.rows[0]?.count || 0),
  });
});

// GET / — global achievement catalog
achievementsRouter.get('/', requireAuth, async (_req: AuthenticatedRequest, res) => {
  try {
    const r = await db.query(
      `SELECT DISTINCT ON (LOWER(name))
         id, name, emoji, description, color
       FROM achievements
       WHERE is_global = true
       ORDER BY LOWER(name), created_at ASC, id ASC`,
    );
    return res.json({ achievements: r.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to fetch achievements' });
  }
});

// POST /grant — grant achievement to student in a classroom
achievementsRouter.post('/grant', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const userId = getUserId(req);
  if (!userId) return res.status(400).json({ message: 'Auth context missing' });

  const { studentId, classroomId, achievementId } = req.body as {
    studentId?: string;
    classroomId?: string;
    achievementId?: string;
  };
  if (!studentId || !classroomId || !achievementId) {
    return res.status(400).json({ message: 'studentId, classroomId, achievementId required' });
  }

  try {
    const canonicalAchievement = await db.query<{ id: string }>(
      `WITH selected AS (
         SELECT LOWER(name) AS nm, is_global, organization_id
         FROM achievements
         WHERE id = $1
         LIMIT 1
       )
       SELECT a.id
       FROM achievements a
       JOIN selected s ON LOWER(a.name) = s.nm
                      AND a.is_global = s.is_global
                      AND COALESCE(a.organization_id::text, 'global') = COALESCE(s.organization_id::text, 'global')
       ORDER BY a.created_at ASC, a.id ASC
       LIMIT 1`,
      [achievementId],
    );
    if ((canonicalAchievement.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Achievement not found' });
    }
    const canonicalAchievementId = canonicalAchievement.rows[0].id;

    const r = await db.query(
      `INSERT INTO student_achievements (student_id, classroom_id, achievement_id, granted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, classroom_id, achievement_id)
       DO UPDATE SET granted_by = EXCLUDED.granted_by, granted_at = NOW()
       RETURNING id, granted_at`,
      [studentId, classroomId, canonicalAchievementId, userId],
    );
    return res.json({ grant: r.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to grant achievement' });
  }
});

// GET /my — student's full achievement history (grouped + flat)
achievementsRouter.get('/my', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(400).json({ message: 'Auth context missing' });

  try {
    const r = await db.query(
      `SELECT sa.id, sa.granted_at, sa.classroom_id, c.title AS classroom_title,
              a.name, a.emoji, a.color, a.description
       FROM student_achievements sa
       JOIN achievements a ON a.id = sa.achievement_id
       LEFT JOIN classrooms c ON c.id = sa.classroom_id
       WHERE sa.student_id = $1
       ORDER BY sa.granted_at DESC`,
      [userId],
    );

    const grouped: Record<string, {
      name: string;
      emoji: string;
      color: string;
      description: string;
      count: number;
      items: Array<{ id: string; grantedAt: string; classroomTitle: string | null }>;
    }> = {};
    for (const row of r.rows as Array<{
      id: string;
      granted_at: string;
      classroom_id: string;
      classroom_title: string | null;
      name: string;
      emoji: string;
      color: string;
      description: string;
    }>) {
      if (!grouped[row.name]) {
        grouped[row.name] = {
          name: row.name,
          emoji: row.emoji,
          color: row.color,
          description: row.description,
          count: 0,
          items: [],
        };
      }
      grouped[row.name].count++;
      grouped[row.name].items.push({
        id: row.id,
        grantedAt: row.granted_at,
        classroomTitle: row.classroom_title,
      });
    }

    return res.json({ total: r.rows.length, achievements: Object.values(grouped), history: r.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to fetch achievements' });
  }
});
