import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getSignedMediaUrlIfNeeded, toPersistentMediaUrl, uploadMediaToS3 } from '../services/s3.js';

export const quizzesRouter = Router();

// Zod schemas for validation
const createQuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  classLevel: z.string().optional(),
  subject: z.string().optional(),
  quizType: z.enum([
    'drag_drop',
    'image_select',
    'sound_match',
    'memory_game',
    'drag_drop_match',
    'guess_image',
    'guess_audio',
    'true_false',
    'single_choice',
    'multi_choice',
  ]),
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

const teacherLibraryQuerySchema = z.object({
  search: z.string().trim().optional(),
  class_level: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  quiz_type: z
    .enum([
      'drag_drop',
      'image_select',
      'sound_match',
      'memory_game',
      'drag_drop_match',
      'guess_image',
      'guess_audio',
      'true_false',
      'single_choice',
      'multi_choice',
    ])
    .optional(),
  difficulty_level: z.string().trim().optional(),
  status: z.enum(['all', 'published', 'draft']).default('all'),
  source: z.enum(['all', 'ai', 'manual']).default('all'),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

const publishSchema = z.object({
  isPublished: z.boolean(),
});

const questionManagementQuerySchema = z.object({
  search: z.string().trim().optional(),
  class_level: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  category: z.string().trim().optional(),
  quiz_type: z.string().trim().optional(),
  quiz_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

const questionBankQuerySchema = z.object({
  search: z.string().trim().optional(),
  class_level: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  question_type: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(300).default(120),
});

const reuseQuestionSchema = z.object({
  sourceQuestionId: z.string().uuid(),
});

const uploadMediaSchema = z.object({
  dataUrl: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().optional(),
  mediaType: z.enum(['image', 'audio', 'video']),
});

const contentTypeSchema = z.enum(['reel', 'image', 'text', 'audio', 'youtube_url', 'reel_url']);

const listContentTopicsQuerySchema = z.object({
  class_level: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(300).default(100),
});
const listSubjectCatalogQuerySchema = z.object({
  class_level: z.string().trim().optional(),
});

const createContentTopicSchema = z.object({
  classLevel: z.string().trim().min(1).max(50),
  subject: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  coverImage: z.string().trim().optional(),
});

const updateContentTopicSchema = z
  .object({
    classLevel: z.string().trim().min(1).max(50).optional(),
    subject: z.string().trim().min(1).max(255).optional(),
    title: z.string().trim().min(1).max(255).optional(),
    coverImage: z.string().trim().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
  });

const contentSectionSchema = z
  .object({
    title: z.string().trim().max(255).optional(),
    contentType: contentTypeSchema,
    mediaUrl: z.string().trim().optional(),
    externalUrl: z.string().trim().optional(),
    textContent: z.string().trim().optional(),
  })
  .refine(
    (value) => {
      if (value.contentType === 'text') return !!value.textContent?.trim();
      if (value.contentType === 'youtube_url' || value.contentType === 'reel_url') return !!value.externalUrl?.trim();
      return !!value.mediaUrl?.trim();
    },
    { message: 'Missing required field for selected content type' },
  );

const replaceTopicSectionsSchema = z.object({
  sections: z.array(contentSectionSchema).min(1).max(300),
});
const createLearningContentSchema = z.object({
  classLevel: z.string().trim().min(1).max(50),
  subject: z.string().trim().min(1).max(255),
  topicId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(255),
  contentType: contentTypeSchema.optional(),
  mediaUrl: z.string().trim().optional(),
  externalUrl: z.string().trim().optional(),
  textContent: z.string().trim().optional(),
  sections: z.array(contentSectionSchema).min(1).max(300).optional(),
});
const updateLearningContentSchema = z.object({
  classLevel: z.string().trim().min(1).max(50),
  subject: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  contentType: contentTypeSchema.optional(),
  mediaUrl: z.string().trim().optional(),
  externalUrl: z.string().trim().optional(),
  textContent: z.string().trim().optional(),
  sections: z.array(contentSectionSchema).min(1).max(300).optional(),
});
const listLearningContentQuerySchema = z.object({
  class_level: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  topic_id: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
const updateTopicAssignmentsSchema = z.object({
  contentIds: z.array(z.string().uuid()).default([]),
});
const updateTopicQuizAssignmentsSchema = z.object({
  quizIds: z.array(z.string().uuid()).default([]),
});

const updateQuestionSchema = z
  .object({
    questionType: z.string().trim().optional(),
    questionTitle: z.string().trim().optional(),
    questionInstruction: z.string().trim().optional(),
    questionAudio: z.string().trim().optional(),
    timeLimitSeconds: z.number().int().min(1).max(600).optional(),
    points: z.number().int().min(0).max(1000).optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
    questionData: z.any().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
  });

const createManagedQuestionSchema = z.object({
  quizId: z.string().uuid().optional(),
  classLevel: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  questionType: z.string().trim().min(1),
  questionTitle: z.string().trim().min(1),
  questionInstruction: z.string().trim().optional(),
  questionAudio: z.string().trim().optional(),
  timeLimitSeconds: z.number().int().min(1).max(600).default(30),
  points: z.number().int().min(0).max(1000).default(10),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  questionData: z.any().default({}),
});
const classroomScheduleTypeSchema = z.enum(['instant', 'scheduled']);
const classroomStatusSchema = z.enum(['draft', 'active', 'completed']);
const classroomAssignmentSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  attachmentUrl: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  isTimeBound: z.boolean().default(false),
});
const createClassroomSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  scheduleType: classroomScheduleTypeSchema,
  startTime: z.string().datetime().optional().nullable(),
  durationMinutes: z.number().int().min(0).max(1440).default(0),
  classLevel: z.string().trim().min(1).max(50),
  status: classroomStatusSchema.optional(),
  contentIds: z.array(z.string().uuid()).default([]),
  quizIds: z.array(z.string().uuid()).default([]),
  assignments: z.array(classroomAssignmentSchema.omit({ id: true })).default([]),
});
const updateClassroomSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().optional(),
    scheduleType: classroomScheduleTypeSchema.optional(),
    startTime: z.string().datetime().optional().nullable(),
    durationMinutes: z.number().int().min(0).max(1440).optional(),
    classLevel: z.string().trim().min(1).max(50).optional(),
    status: classroomStatusSchema.optional(),
    contentIds: z.array(z.string().uuid()).optional(),
    quizIds: z.array(z.string().uuid()).optional(),
    assignments: z.array(classroomAssignmentSchema.omit({ id: true })).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
  });
const listClassroomsQuerySchema = z.object({
  class_level: z.string().trim().optional(),
  status: classroomStatusSchema.optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
const addClassroomContentSchema = z.object({
  contentId: z.string().uuid(),
});
const addClassroomQuizSchema = z.object({
  quizId: z.string().uuid(),
});
const addClassroomAssignmentSchema = classroomAssignmentSchema.omit({ id: true });
const studentClassroomsQuerySchema = z.object({
  class_level: z.string().trim().optional(),
});
const createAssignmentSubmissionSchema = z
  .object({
    submissionText: z.string().trim().optional(),
    attachmentUrl: z.string().trim().optional(),
  })
  .refine((value) => Boolean(value.submissionText?.trim() || value.attachmentUrl?.trim()), {
    message: 'Submission text or attachment is required',
  });

function getOrganizationId(req: any): string | null {
  return req?.user?.organizationId || null;
}

function canBypassOwnership(req: any): boolean {
  const role = req?.user?.role;
  return role === 'admin' || role === 'superadmin';
}

function canManageTeacherContent(req: any): boolean {
  const role = req?.user?.role;
  return role === 'teacher' || role === 'admin' || role === 'superadmin';
}

const RESTARTED_CLASSROOM_SUFFIX_REGEX = /\s+\(Restarted\)$/i;

function filterRestartedClassroomDuplicates<T extends { title?: string | null }>(items: T[]): T[] {
  const baseTitlesWithOriginal = new Set<string>();

  items.forEach((item) => {
    const title = (item.title || '').trim();
    if (!title) return;
    if (!RESTARTED_CLASSROOM_SUFFIX_REGEX.test(title)) {
      baseTitlesWithOriginal.add(title.toLowerCase());
    }
  });

  return items.filter((item) => {
    const title = (item.title || '').trim();
    if (!title) return true;
    if (!RESTARTED_CLASSROOM_SUFFIX_REGEX.test(title)) return true;
    const baseTitle = title.replace(RESTARTED_CLASSROOM_SUFFIX_REGEX, '').trim().toLowerCase();
    return !baseTitlesWithOriginal.has(baseTitle);
  });
}

function normalizeLearningContentSections(payload: {
  sections?: Array<{ title?: string; contentType: string; mediaUrl?: string; externalUrl?: string; textContent?: string }>;
  contentType?: string;
  mediaUrl?: string;
  externalUrl?: string;
  textContent?: string;
}) {
  if (Array.isArray(payload.sections) && payload.sections.length > 0) {
    return payload.sections.map((section) => ({
      title: section.title?.trim() || null,
      contentType: section.contentType as z.infer<typeof contentTypeSchema>,
      mediaUrl: section.mediaUrl?.trim() ? toPersistentMediaUrl(section.mediaUrl.trim()) : null,
      externalUrl: section.externalUrl?.trim() || null,
      textContent: section.textContent?.trim() || null,
    }));
  }
  if (!payload.contentType) return [];
  return [
    {
      title: null,
      contentType: payload.contentType as z.infer<typeof contentTypeSchema>,
      mediaUrl: payload.mediaUrl?.trim() ? toPersistentMediaUrl(payload.mediaUrl.trim()) : null,
      externalUrl: payload.externalUrl?.trim() || null,
      textContent: payload.textContent?.trim() || null,
    },
  ];
}

async function ensureTopicEditPermission(
  topicId: string,
  orgId: string,
  userId: string,
  req: any,
): Promise<{ allowed: boolean; exists: boolean }> {
  const result = await db.query(
    `SELECT id, created_by
     FROM content_topics
     WHERE id = $1
       AND organization_id = $2::uuid`,
    [topicId, orgId],
  );
  if ((result.rowCount ?? 0) === 0) {
    return { allowed: false, exists: false };
  }

  const createdBy = result.rows[0].created_by as string | null;
  if (canBypassOwnership(req) || !createdBy || createdBy === userId) {
    return { allowed: true, exists: true };
  }
  return { allowed: false, exists: true };
}

async function ensureQuizEditPermission(
  quizId: string,
  orgId: string,
  userId: string,
  req: any,
): Promise<{ allowed: boolean; exists: boolean }> {
  const quizResult = await db.query(
    `SELECT id, created_by FROM quizzes WHERE id = $1 AND organization_id = $2::uuid`,
    [quizId, orgId],
  );
  if ((quizResult.rowCount ?? 0) === 0) {
    return { allowed: false, exists: false };
  }
  return { allowed: true, exists: true };
}

async function ensureQuestionEditPermission(
  questionId: string,
  orgId: string,
  userId: string,
  req: any,
): Promise<{ allowed: boolean; exists: boolean }> {
  const questionResult = await db.query(
    `SELECT qq.id, q.created_by, qq.question_data
     FROM quiz_questions qq
     LEFT JOIN quizzes q ON q.id = qq.quiz_id
     WHERE qq.id = $1
       AND (
         q.organization_id = $2::uuid
         OR COALESCE(qq.question_data->'_meta'->>'organizationId', '') = $2::text
       )`,
    [questionId, orgId],
  );
  if ((questionResult.rowCount ?? 0) === 0) {
    return { allowed: false, exists: false };
  }
  return { allowed: true, exists: true };
}

async function signMediaValue(value: unknown, cache: Map<string, Promise<string>>): Promise<unknown> {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || (!trimmed.includes('://') && !trimmed.startsWith('s3://'))) {
      return value;
    }
    let pending = cache.get(trimmed);
    if (!pending) {
      pending = getSignedMediaUrlIfNeeded(trimmed).catch(() => trimmed);
      cache.set(trimmed, pending);
    }
    return pending;
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => signMediaValue(item, cache)));
  }

  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([key, nestedValue]) => {
        const signedNestedValue = await signMediaValue(nestedValue, cache);
        return [key, signedNestedValue] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  return value;
}

async function signQuestionRowMedia(row: Record<string, unknown>, cache: Map<string, Promise<string>>) {
  const signedQuestionAudio = await signMediaValue(row.question_audio, cache);
  const signedQuestionData = await signMediaValue(row.question_data, cache);
  return {
    ...row,
    question_audio: signedQuestionAudio,
    question_data: signedQuestionData,
  };
}

async function signQuestionRowsMedia(rows: Record<string, unknown>[]) {
  const cache = new Map<string, Promise<string>>();
  return Promise.all(rows.map((row) => signQuestionRowMedia(row, cache)));
}

function resolveClassroomStatus(row: { status?: string; schedule_type?: string; start_time?: string | Date | null }) {
  if (row.status === 'completed') return 'completed';
  if (row.status === 'active') return 'active';
  if (row.schedule_type === 'instant') return 'active';
  if (!row.start_time) return 'draft';
  const startTime = new Date(row.start_time);
  if (Number.isNaN(startTime.getTime())) return 'draft';
  return startTime.getTime() <= Date.now() ? 'active' : 'draft';
}

async function fetchClassroomResources(classroomId: string, orgId: string, studentId?: string) {
  const [contentsResult, quizzesResult, assignmentsResult] = await Promise.all([
    db.query(
      `SELECT
         cc.content_id AS id,
         lc.title,
         lc.class_level,
         lc.subject,
         lc.content_type,
         lc.media_url,
         lc.external_url,
         lc.text_content,
         lc.created_at
       FROM classroom_contents cc
       INNER JOIN learning_contents lc ON lc.id = cc.content_id
       WHERE cc.classroom_id = $1
         AND lc.organization_id = $2::uuid
       ORDER BY cc.sort_order ASC, cc.created_at ASC`,
      [classroomId, orgId],
    ),
    db.query(
      `SELECT
         cq.quiz_id AS id,
         q.title,
         q.class_level,
         q.subject,
         q.quiz_type,
         q.difficulty_level,
         q.total_questions,
         q.is_published,
         q.created_at
       FROM classroom_quizzes cq
       INNER JOIN quizzes q ON q.id = cq.quiz_id
       WHERE cq.classroom_id = $1
         AND q.organization_id = $2::uuid
       ORDER BY cq.sort_order ASC, cq.created_at ASC`,
      [classroomId, orgId],
    ),
    db.query(
      `SELECT id, title, description, attachment_url, instructions, due_date, is_time_bound, created_at, updated_at
       FROM classroom_assignments
       WHERE classroom_id = $1
       ORDER BY created_at ASC`,
      [classroomId],
    ),
  ]);

  const quizIds = quizzesResult.rows.map((row: any) => row.id as string).filter(Boolean);
  const assignmentIds = assignmentsResult.rows.map((row: any) => row.id as string).filter(Boolean);

  let quizAttemptMap = new Map<string, { status: 'not_attempted' | 'completed'; score?: number; attemptedAt?: string }>();
  if (studentId && quizIds.length > 0) {
    const attemptsResult = await db.query(
      `SELECT sa.quiz_id, sa.score, sa.total_points, sa.completed_at AS attempted_at
       FROM student_attempts sa
       WHERE sa.student_id = $1
         AND sa.quiz_id = ANY($2::uuid[])
       ORDER BY sa.completed_at DESC`,
      [studentId, quizIds],
    );

    attemptsResult.rows.forEach((row: any) => {
      const quizId = row.quiz_id as string;
      if (quizAttemptMap.has(quizId)) return;
      const totalPoints = Number(row.total_points || 0);
      const scoreValue = Number(row.score || 0);
      const scorePct = totalPoints > 0 ? Math.round((scoreValue / totalPoints) * 100) : 0;
      quizAttemptMap.set(quizId, {
        status: 'completed',
        score: scorePct,
        attemptedAt: row.attempted_at as string,
      });
    });
  }

  let assignmentSubmissionMap = new Map<string, { submitted: boolean; submittedAt?: string; submissionText?: string; attachmentUrl?: string }>();
  if (studentId && assignmentIds.length > 0) {
    const submissionsResult = await db.query(
      `SELECT classroom_assignment_id, submission_text, attachment_url, submitted_at
       FROM classroom_assignment_submissions
       WHERE student_id = $1
         AND classroom_assignment_id = ANY($2::uuid[])`,
      [studentId, assignmentIds],
    );

    submissionsResult.rows.forEach((row: any) => {
      assignmentSubmissionMap.set(row.classroom_assignment_id as string, {
        submitted: true,
        submittedAt: row.submitted_at as string,
        submissionText: (row.submission_text as string | null) || '',
        attachmentUrl: (row.attachment_url as string | null) || '',
      });
    });
  }

  
  const contentIds = contentsResult.rows.map((row: any) => row.id as string).filter(Boolean);
  let sectionsGroupedByContentId: Record<string, any[]> = {};
  if (contentIds.length > 0) {
    const sectionsResult = await db.query(
      `SELECT id, content_id, section_order, title, content_type, media_url, external_url, text_content
       FROM learning_content_sections
       WHERE content_id = ANY($1::uuid[])
       ORDER BY content_id, section_order ASC`,
      [contentIds]
    );
    for (const row of sectionsResult.rows) {
      const cId = row.content_id as string;
      if (!sectionsGroupedByContentId[cId]) sectionsGroupedByContentId[cId] = [];
      sectionsGroupedByContentId[cId].push({
        id: row.id,
        sectionOrder: Number(row.section_order),
        title: row.title || undefined,
        contentType: row.content_type,
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url) : undefined,
        externalUrl: row.external_url || undefined,
        textContent: row.text_content || undefined,
      });
    }
  }

  const contentRows = await Promise.all(

    contentsResult.rows.map(async (row: any) => ({
      id: row.id as string,
      title: row.title as string,
      classLevel: (row.class_level as string) || '',
      subject: (row.subject as string) || '',
      contentType: (row.content_type as string) || '',
      mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : '',
      externalUrl: (row.external_url as string | null) || '',
      textContent: (row.text_content as string | null) || '',
      status: 'not_started',
      createdAt: row.created_at as string,
      sections: sectionsGroupedByContentId[row.id as string] || [],
    })),
  );

  const quizRows = quizzesResult.rows.map((row: any) => ({
    id: row.id as string,
    title: row.title as string,
    classLevel: (row.class_level as string) || '',
    subject: (row.subject as string) || '',
    quizType: (row.quiz_type as string) || '',
    difficultyLevel: (row.difficulty_level as string | null) || '',
    totalQuestions: Number(row.total_questions || 0),
    isPublished: Boolean(row.is_published),
    status: quizAttemptMap.get(row.id as string)?.status || 'not_attempted',
    score: quizAttemptMap.get(row.id as string)?.score,
    attemptedAt: quizAttemptMap.get(row.id as string)?.attemptedAt,
    createdAt: row.created_at as string,
  }));

  const assignmentRows = await Promise.all(
    assignmentsResult.rows.map(async (row: any) => {
      const submission = assignmentSubmissionMap.get(row.id as string);
      const dueDate = row.due_date ? new Date(row.due_date as string) : null;
      const overdue = Boolean(dueDate && dueDate.getTime() < Date.now() && !submission?.submitted);
      const status = submission?.submitted ? 'submitted' : overdue ? 'overdue' : 'pending';
      return {
        id: row.id as string,
        title: row.title as string,
        description: (row.description as string | null) || '',
        attachmentUrl: row.attachment_url ? await getSignedMediaUrlIfNeeded(row.attachment_url as string) : '',
        instructions: (row.instructions as string | null) || '',
        dueDate: row.due_date as string | null,
        isTimeBound: Boolean(row.is_time_bound),
        status,
        submission: submission
          ? {
              submittedAt: submission.submittedAt || null,
              submissionText: submission.submissionText || '',
              attachmentUrl: submission.attachmentUrl ? await getSignedMediaUrlIfNeeded(submission.attachmentUrl) : '',
            }
          : null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };
    }),
  );

  return {
    contents: contentRows,
    quizzes: quizRows,
    assignments: assignmentRows,
  };
}

async function replaceClassroomResources(
  client: any,
  classroomId: string,
  orgId: string,
  contentIds: string[],
  quizIds: string[],
  assignments: Array<z.infer<typeof classroomAssignmentSchema>>,
) {
  const uniqueContentIds = [...new Set(contentIds)];
  const uniqueQuizIds = [...new Set(quizIds)];

  if (uniqueContentIds.length > 0) {
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM learning_contents
       WHERE organization_id = $1::uuid
         AND id = ANY($2::uuid[])`,
      [orgId, uniqueContentIds],
    );
    if (Number(countResult.rows[0]?.count || 0) !== uniqueContentIds.length) {
      throw new Error('One or more content items are invalid for this organization');
    }
  }

  if (uniqueQuizIds.length > 0) {
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM quizzes
       WHERE organization_id = $1::uuid
         AND id = ANY($2::uuid[])`,
      [orgId, uniqueQuizIds],
    );
    if (Number(countResult.rows[0]?.count || 0) !== uniqueQuizIds.length) {
      throw new Error('One or more quizzes are invalid for this organization');
    }
  }

  await client.query(`DELETE FROM classroom_contents WHERE classroom_id = $1`, [classroomId]);
  await client.query(`DELETE FROM classroom_quizzes WHERE classroom_id = $1`, [classroomId]);
  await client.query(`DELETE FROM classroom_assignments WHERE classroom_id = $1`, [classroomId]);

  for (let i = 0; i < uniqueContentIds.length; i += 1) {
    await client.query(
      `INSERT INTO classroom_contents (classroom_id, content_id, sort_order)
       VALUES ($1, $2, $3)`,
      [classroomId, uniqueContentIds[i], i],
    );
  }

  for (let i = 0; i < uniqueQuizIds.length; i += 1) {
    await client.query(
      `INSERT INTO classroom_quizzes (classroom_id, quiz_id, sort_order)
       VALUES ($1, $2, $3)`,
      [classroomId, uniqueQuizIds[i], i],
    );
  }

  for (let i = 0; i < assignments.length; i += 1) {
    const assignment = assignments[i];
    await client.query(
      `INSERT INTO classroom_assignments (classroom_id, title, description, attachment_url, instructions, due_date, is_time_bound)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        classroomId,
        assignment.title,
        assignment.description?.trim() || null,
        assignment.attachmentUrl?.trim() ? toPersistentMediaUrl(assignment.attachmentUrl.trim()) : null,
        assignment.instructions?.trim() || null,
        assignment.dueDate ? new Date(assignment.dueDate) : null,
        assignment.isTimeBound,
      ],
    );
  }
}

// Teacher-accessible catalog: fetch all class levels & subjects from admin-created subjects table
quizzesRouter.get('/catalog/subjects', requireAuth, async (req: any, res) => {
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const result = await db.query(
      `SELECT class_level, title AS subject
       FROM subjects
       WHERE organization_id = $1::uuid
       ORDER BY class_level ASC, title ASC`,
      [orgId],
    );
    const classLevels = [...new Set(result.rows.map((r: any) => r.class_level as string))];
    const subjects = [...new Set(result.rows.map((r: any) => r.subject as string))];
    return res.json({ classLevels, subjects, items: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch subject catalog' });
  }
});

quizzesRouter.get('/classrooms', requireAuth, async (req: any, res) => {
  const parsedQuery = listClassroomsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid classroom filters', errors: parsedQuery.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  const { class_level, status, search, limit } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = ['c.organization_id = $1::uuid'];

  // Teachers only see their own classrooms; admins see all
  if (!canBypassOwnership(req) && userId) {
    params.push(userId);
    whereClauses.push(`c.created_by = $${params.length}`);
  }

  if (class_level) {
    params.push(class_level);
    whereClauses.push(`c.class_level = $${params.length}`);
  }
  if (status) {
    params.push(status);
    whereClauses.push(`c.status = $${params.length}`);
  } else {
    // By default exclude completed (ended) classrooms — they live in history
    whereClauses.push(`c.status != 'completed'`);
  }
  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`(c.title ILIKE $${params.length} OR COALESCE(c.description, '') ILIKE $${params.length})`);
  }

  params.push(limit);

  try {
    const result = await db.query(
      `SELECT
         c.id,
         c.title,
         c.description,
         c.schedule_type,
         c.start_time,
         c.duration_minutes,
         c.class_level,
         c.status,
         c.created_by,
         c.created_at,
         c.updated_at,
         COALESCE(COUNT(DISTINCT cc.content_id), 0)::int AS content_count,
         COALESCE(COUNT(DISTINCT cq.quiz_id), 0)::int AS quiz_count,
         COALESCE(COUNT(DISTINCT ca.id), 0)::int AS assignment_count
       FROM classrooms c
       LEFT JOIN classroom_contents cc ON cc.classroom_id = c.id
       LEFT JOIN classroom_quizzes cq ON cq.classroom_id = c.id
       LEFT JOIN classroom_assignments ca ON ca.classroom_id = c.id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    const classrooms = result.rows.map((row: any) => ({
      id: row.id as string,
      title: row.title as string,
      description: (row.description as string | null) || '',
      scheduleType: row.schedule_type as 'instant' | 'scheduled',
      startTime: row.start_time as string | null,
      durationMinutes: Number(row.duration_minutes || 0),
      classLevel: row.class_level as string,
      status: resolveClassroomStatus(row),
      createdBy: row.created_by as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      contentCount: Number(row.content_count || 0),
      quizCount: Number(row.quiz_count || 0),
      assignmentCount: Number(row.assignment_count || 0),
    }));

    return res.json({ classrooms: filterRestartedClassroomDuplicates(classrooms) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch classrooms' });
  }
});

// GET /classrooms/history — All completed classrooms for this teacher
quizzesRouter.get('/classrooms/history', requireAuth, async (req: any, res) => {
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Auth context missing' });

  try {
    const r = await db.query(
      `SELECT c.id, c.title, c.class_level, c.schedule_type, c.start_time, c.ended_at,
              c.duration_minutes, c.status, c.created_at,
              COALESCE(COUNT(DISTINCT cc.content_id), 0)::int AS content_count,
              COALESCE(COUNT(DISTINCT cq.quiz_id), 0)::int     AS quiz_count,
              COALESCE(COUNT(DISTINCT ca.id), 0)::int          AS assignment_count,
              COALESCE((SELECT COUNT(DISTINCT student_id) FROM classroom_assignment_submissions cas2
                        JOIN classroom_assignments ca2 ON ca2.id = cas2.classroom_assignment_id
                        WHERE ca2.classroom_id = c.id), 0)::int AS student_count
       FROM classrooms c
       LEFT JOIN classroom_contents   cc ON cc.classroom_id = c.id
       LEFT JOIN classroom_quizzes    cq ON cq.classroom_id = c.id
       LEFT JOIN classroom_assignments ca ON ca.classroom_id = c.id
       WHERE c.organization_id = $1::uuid AND c.created_by = $2 AND c.status = 'completed'
       GROUP BY c.id
       ORDER BY c.ended_at DESC NULLS LAST
       LIMIT 100`,
      [orgId, userId],
    );
    return res.json({ classrooms: filterRestartedClassroomDuplicates(r.rows) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to fetch history' });
  }
});


quizzesRouter.get('/classrooms/:classroomId', requireAuth, async (req: any, res) => {
  const classroomId = req.params.classroomId as string;
  if (!classroomId) return res.status(400).json({ message: 'Invalid classroom id' });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });

  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const result = await db.query(
      `SELECT id, title, description, schedule_type, start_time, duration_minutes, class_level, status, created_by, created_at, updated_at
       FROM classrooms
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [classroomId, orgId],
    );
    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const classroomRow = result.rows[0] as any;
    const resources = await fetchClassroomResources(classroomId, orgId);
    return res.json({
      classroom: {
        id: classroomRow.id as string,
        title: classroomRow.title as string,
        description: (classroomRow.description as string | null) || '',
        scheduleType: classroomRow.schedule_type as 'instant' | 'scheduled',
        startTime: classroomRow.start_time as string | null,
        durationMinutes: Number(classroomRow.duration_minutes || 0),
        classLevel: classroomRow.class_level as string,
        status: resolveClassroomStatus(classroomRow),
        createdBy: classroomRow.created_by as string,
        createdAt: classroomRow.created_at as string,
        updatedAt: classroomRow.updated_at as string,
      },
      ...resources,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch classroom details' });
  }
});

quizzesRouter.post('/classrooms', requireAuth, async (req: any, res) => {
  const parsedBody = createClassroomSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid classroom payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Organization/user not found in auth context' });

  const {
    title,
    description,
    scheduleType,
    startTime,
    durationMinutes,
    classLevel,
    status,
    contentIds,
    quizIds,
    assignments,
  } = parsedBody.data;

  const classroomStatus = status || (scheduleType === 'instant' ? 'active' : 'draft');
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const insertResult = await client.query(
      `INSERT INTO classrooms (organization_id, title, description, schedule_type, start_time, duration_minutes, class_level, created_by, status)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        orgId,
        title,
        description?.trim() || null,
        scheduleType,
        scheduleType === 'scheduled' && startTime ? new Date(startTime) : null,
        durationMinutes,
        classLevel,
        userId,
        classroomStatus,
      ],
    );
    const classroomId = insertResult.rows[0].id as string;

    await replaceClassroomResources(client, classroomId, orgId, contentIds, quizIds, assignments);
    await client.query('COMMIT');

    const detailResult = await db.query(
      `SELECT id, title, description, schedule_type, start_time, duration_minutes, class_level, status, created_by, created_at, updated_at
       FROM classrooms
       WHERE id = $1
       LIMIT 1`,
      [classroomId],
    );
    const classroomRow = detailResult.rows[0] as any;
    const resources = await fetchClassroomResources(classroomId, orgId);
    return res.status(201).json({
      classroom: {
        id: classroomRow.id as string,
        title: classroomRow.title as string,
        description: (classroomRow.description as string | null) || '',
        scheduleType: classroomRow.schedule_type as 'instant' | 'scheduled',
        startTime: classroomRow.start_time as string | null,
        durationMinutes: Number(classroomRow.duration_minutes || 0),
        classLevel: classroomRow.class_level as string,
        status: resolveClassroomStatus(classroomRow),
        createdBy: classroomRow.created_by as string,
        createdAt: classroomRow.created_at as string,
        updatedAt: classroomRow.updated_at as string,
      },
      ...resources,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    const message = error instanceof Error ? error.message : 'Failed to create classroom';
    return res.status(500).json({ message });
  } finally {
    client.release();
  }
});

quizzesRouter.put('/classrooms/:classroomId', requireAuth, async (req: any, res) => {
  const classroomId = req.params.classroomId as string;
  const parsedBody = updateClassroomSchema.safeParse(req.body);
  if (!classroomId) return res.status(400).json({ message: 'Invalid classroom id' });
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid classroom update payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Organization/user not found in auth context' });

  const updates = parsedBody.data;
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const classroomCheck = await client.query(
      `SELECT created_by, schedule_type, start_time, status
       FROM classrooms
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [classroomId, orgId],
    );
    if ((classroomCheck.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const existing = classroomCheck.rows[0] as any;
    if (!canBypassOwnership(req) && existing.created_by !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Only creator can edit this classroom' });
    }

    const setParts: string[] = [];
    const params: unknown[] = [];

    if (updates.title !== undefined) {
      params.push(updates.title);
      setParts.push(`title = $${params.length}`);
    }
    if (updates.description !== undefined) {
      params.push(updates.description?.trim() || null);
      setParts.push(`description = $${params.length}`);
    }
    if (updates.scheduleType !== undefined) {
      params.push(updates.scheduleType);
      setParts.push(`schedule_type = $${params.length}`);
    }
    if (updates.startTime !== undefined) {
      params.push(updates.startTime ? new Date(updates.startTime) : null);
      setParts.push(`start_time = $${params.length}`);
    }
    if (updates.durationMinutes !== undefined) {
      params.push(updates.durationMinutes);
      setParts.push(`duration_minutes = $${params.length}`);
    }
    if (updates.classLevel !== undefined) {
      params.push(updates.classLevel);
      setParts.push(`class_level = $${params.length}`);
    }
    if (updates.status !== undefined) {
      params.push(updates.status);
      setParts.push(`status = $${params.length}`);
    }
    if (setParts.length > 0) {
      setParts.push('updated_at = NOW()');
      params.push(classroomId, orgId);
      await client.query(
        `UPDATE classrooms
         SET ${setParts.join(', ')}
         WHERE id = $${params.length - 1}
           AND organization_id = $${params.length}::uuid`,
        params,
      );
    }

    if (updates.contentIds || updates.quizIds || updates.assignments) {
      await replaceClassroomResources(
        client,
        classroomId,
        orgId,
        updates.contentIds || [],
        updates.quizIds || [],
        updates.assignments || [],
      );
    }

    await client.query('COMMIT');

    const detailResult = await db.query(
      `SELECT id, title, description, schedule_type, start_time, duration_minutes, class_level, status, created_by, created_at, updated_at
       FROM classrooms
       WHERE id = $1
       LIMIT 1`,
      [classroomId],
    );
    const classroomRow = detailResult.rows[0] as any;
    const resources = await fetchClassroomResources(classroomId, orgId);
    return res.json({
      classroom: {
        id: classroomRow.id as string,
        title: classroomRow.title as string,
        description: (classroomRow.description as string | null) || '',
        scheduleType: classroomRow.schedule_type as 'instant' | 'scheduled',
        startTime: classroomRow.start_time as string | null,
        durationMinutes: Number(classroomRow.duration_minutes || 0),
        classLevel: classroomRow.class_level as string,
        status: resolveClassroomStatus(classroomRow),
        createdBy: classroomRow.created_by as string,
        createdAt: classroomRow.created_at as string,
        updatedAt: classroomRow.updated_at as string,
      },
      ...resources,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    const message = error instanceof Error ? error.message : 'Failed to update classroom';
    return res.status(500).json({ message });
  } finally {
    client.release();
  }
});

quizzesRouter.delete('/classrooms/:classroomId', requireAuth, async (req: any, res) => {
  const classroomId = req.params.classroomId as string;
  if (!classroomId) return res.status(400).json({ message: 'Invalid classroom id' });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Organization/user not found in auth context' });

  try {
    const classroomResult = await db.query(
      `SELECT id, created_by, schedule_type, start_time
       FROM classrooms
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [classroomId, orgId],
    );
    if ((classroomResult.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Classroom not found' });

    const classroom = classroomResult.rows[0] as any;
    if (!canBypassOwnership(req) && classroom.created_by !== userId) {
      return res.status(403).json({ message: 'Only creator can delete this classroom' });
    }

    const startTime = classroom.start_time ? new Date(classroom.start_time) : null;
    const isStarted = classroom.schedule_type === 'instant' || (startTime ? startTime.getTime() <= Date.now() : false);

    if (isStarted) {
      const activeAssignmentCheck = await db.query(
        `SELECT 1
         FROM classroom_assignments
         WHERE classroom_id = $1
           AND (
             is_time_bound = false
             OR due_date IS NULL
             OR due_date > NOW()
           )
         LIMIT 1`,
        [classroomId],
      );
      if ((activeAssignmentCheck.rowCount ?? 0) > 0) {
        return res.status(400).json({ message: 'Classroom cannot be deleted after start with active assignments' });
      }
    }

    await db.query(
      `DELETE FROM classrooms
       WHERE id = $1
         AND organization_id = $2::uuid`,
      [classroomId, orgId],
    );
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to delete classroom' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLASSROOM LIFECYCLE — END / HISTORY / RESTART
// ═══════════════════════════════════════════════════════════════════════════

// PATCH /classrooms/:id/end  — Mark classroom as completed
quizzesRouter.patch('/classrooms/:classroomId/end', requireAuth, async (req: any, res) => {
  const { classroomId } = req.params;
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Auth context missing' });

  try {
    const r = await db.query(
      `UPDATE classrooms SET status = 'completed', ended_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2::uuid AND created_by = $3
       RETURNING id, title, status, ended_at`,
      [classroomId, orgId, userId],
    );
    if ((r.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Classroom not found or not yours' });
    return res.json({ classroom: r.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to end classroom' });
  }
});


// PATCH /classrooms/:id/restart — Reactivate existing classroom
quizzesRouter.patch('/classrooms/:classroomId/restart', requireAuth, async (req: any, res) => {
  const { classroomId } = req.params;
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Auth context missing' });

  try {
    const existing = await db.query(
      `SELECT id, created_by
       FROM classrooms
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [classroomId, orgId],
    );
    if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Classroom not found' });
    if (!canBypassOwnership(req) && existing.rows[0].created_by !== userId) {
      return res.status(403).json({ message: 'Forbidden: not allowed to restart this classroom' });
    }

    const restarted = await db.query(
      `UPDATE classrooms
       SET status = 'active',
           schedule_type = 'instant',
           start_time = NOW(),
           ended_at = NULL,
           updated_at = NOW()
       WHERE id = $1
         AND organization_id = $2::uuid
       RETURNING id, title, status`,
      [classroomId, orgId],
    );

    return res.json({ classroom: restarted.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to restart classroom' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLASS DETAILS — STUDENT PARTICIPATION STATS
// ═══════════════════════════════════════════════════════════════════════════

// GET /classrooms/:id/class-details — Per-student stats for a classroom
quizzesRouter.get('/classrooms/:classroomId/class-details', requireAuth, async (req: any, res) => {
  const { classroomId } = req.params;
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Auth context missing' });

  try {
    // Classroom meta
    const cr = await db.query(
      `SELECT c.id, c.title, c.class_level, c.schedule_type, c.start_time, c.ended_at,
              c.duration_minutes, c.status, c.created_at,
              COALESCE(COUNT(DISTINCT cq.quiz_id), 0)::int  AS quiz_count,
              COALESCE(COUNT(DISTINCT ca.id), 0)::int       AS assignment_count,
              COALESCE(COUNT(DISTINCT cc.content_id), 0)::int AS content_count
       FROM classrooms c
       LEFT JOIN classroom_quizzes cq ON cq.classroom_id = c.id
       LEFT JOIN classroom_assignments ca ON ca.classroom_id = c.id
       LEFT JOIN classroom_contents cc ON cc.classroom_id = c.id
       WHERE c.id = $1 AND c.organization_id = $2::uuid
       GROUP BY c.id`,
      [classroomId, orgId],
    );
    if (cr.rows.length === 0) return res.status(404).json({ message: 'Classroom not found' });
    const classroom = cr.rows[0];

    // Students who participated via assignment/quiz/remark/achievement
    const studentsRes = await db.query(
      `WITH participants AS (
         SELECT cas.student_id
         FROM classroom_assignment_submissions cas
         JOIN classroom_assignments ca ON ca.id = cas.classroom_assignment_id
         WHERE ca.classroom_id = $1
         UNION
         SELECT sa.student_id
         FROM student_attempts sa
         JOIN classroom_quizzes cq ON cq.quiz_id = sa.quiz_id
         WHERE cq.classroom_id = $1
         UNION
         SELECT csr.student_id
         FROM classroom_student_remarks csr
         WHERE csr.classroom_id = $1
         UNION
         SELECT sacha.student_id
         FROM student_achievements sacha
         WHERE sacha.classroom_id = $1
       )
       SELECT p.student_id,
              TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS student_name,
              u.email AS student_email,
              COALESCE((
                SELECT COUNT(DISTINCT cas2.classroom_assignment_id)::int
                FROM classroom_assignment_submissions cas2
                JOIN classroom_assignments ca2 ON ca2.id = cas2.classroom_assignment_id
                WHERE ca2.classroom_id = $1 AND cas2.student_id = p.student_id
              ), 0) AS assignments_submitted
       FROM participants p
       LEFT JOIN users u ON u.id = p.student_id
       ORDER BY student_name ASC NULLS LAST`,
      [classroomId],
    );

    // Quiz attempts per student
    const quizRes = await db.query(
      `SELECT sa.student_id, COUNT(DISTINCT sa.quiz_id)::int AS quizzes_completed,
              ROUND(AVG(sa.score)::numeric, 1) AS avg_score
       FROM student_attempts sa
       JOIN classroom_quizzes cq ON cq.quiz_id = sa.quiz_id AND cq.classroom_id = $1
       GROUP BY sa.student_id`,
      [classroomId],
    );
    const quizMap: Record<string, { quizzes_completed: number; avg_score: number }> = {};
    for (const row of quizRes.rows) {
      quizMap[row.student_id] = { quizzes_completed: Number(row.quizzes_completed), avg_score: Number(row.avg_score) };
    }

    // Remarks per student
    const remarkRes = await db.query(
      `SELECT DISTINCT ON (student_id)
         student_id, id, remark_text, parent_note, remark_media_url,
         score_behavior, score_confidence, score_participation, score_performance, updated_at
       FROM classroom_student_remarks
       WHERE classroom_id = $1
       ORDER BY student_id, updated_at DESC, created_at DESC`,
      [classroomId],
    );
    const remarkMap: Record<string, any> = {};
    for (const row of remarkRes.rows) remarkMap[row.student_id] = row;

    // Achievements per student
    const achievRes = await db.query(
      `WITH grouped AS (
         SELECT student_id, achievement_id, COUNT(*)::int AS award_count
         FROM student_achievements
         WHERE classroom_id = $1
         GROUP BY student_id, achievement_id
       )
       SELECT g.student_id,
              json_agg(
                json_build_object(
                  'id', a.id,
                  'name', a.name,
                  'emoji', a.emoji,
                  'color', a.color,
                  'count', g.award_count
                )
                ORDER BY a.name ASC
              ) AS achievements
       FROM grouped g
       JOIN achievements a ON a.id = g.achievement_id
       GROUP BY g.student_id`,
      [classroomId],
    );
    const achievMap: Record<string, any[]> = {};
    for (const row of achievRes.rows) achievMap[row.student_id] = row.achievements;

    const students = studentsRes.rows.map((s: any) => {
      const rawRemark = remarkMap[s.student_id];
      const mappedRemark = rawRemark ? {
        id: rawRemark.id as string | undefined,
        remarkText: (rawRemark.remark_text as string | null) ?? null,
        parentNote: (rawRemark.parent_note as string | null) ?? null,
        remarkMediaUrl: (rawRemark.remark_media_url as string | null) ?? null,
        scoreBehavior: rawRemark.score_behavior !== null ? Number(rawRemark.score_behavior) : null,
        scoreConfidence: rawRemark.score_confidence !== null ? Number(rawRemark.score_confidence) : null,
        scoreParticipation: rawRemark.score_participation !== null ? Number(rawRemark.score_participation) : null,
        scorePerformance: rawRemark.score_performance !== null ? Number(rawRemark.score_performance) : null,
      } : null;
      return ({
      studentId: s.student_id,
      name: (s.student_name && s.student_name.trim()) || s.student_email || 'Unknown Student',
      email: s.student_email,
      assignmentsSubmitted: Number(s.assignments_submitted),
      quizzesCompleted: quizMap[s.student_id]?.quizzes_completed ?? 0,
      avgScore: quizMap[s.student_id]?.avg_score ?? 0,
      remark: mappedRemark,
      achievements: achievMap[s.student_id] ?? [],
    });
    });

    const totalAssignments = Number(classroom.assignment_count);
    const totalQuizzes     = Number(classroom.quiz_count);
    const totalContents    = Number(classroom.content_count);
    const joinedCount      = students.length;

    return res.json({
      classroom: {
        id: classroom.id, title: classroom.title, classLevel: classroom.class_level,
        scheduleType: classroom.schedule_type, startTime: classroom.start_time,
        endedAt: classroom.ended_at, durationMinutes: Number(classroom.duration_minutes),
        status: classroom.status, createdAt: classroom.created_at,
        totalAssignments, totalQuizzes, totalContents,
      },
      students,
      summary: {
        joinedCount,
        quizDoneCount:    students.filter((s) => s.quizzesCompleted > 0).length,
        assignmentDoneCount: students.filter((s) => s.assignmentsSubmitted > 0).length,
        completionPct: joinedCount > 0 ? Math.round((students.filter((s) => s.assignmentsSubmitted >= totalAssignments && s.quizzesCompleted >= totalQuizzes).length / joinedCount) * 100) : 0,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to fetch class details' });
  }
});

// GET /classrooms/:id/students/:studentId/details — quiz attempts + assignment submissions
quizzesRouter.get('/classrooms/:classroomId/students/:studentId/details', requireAuth, async (req: any, res) => {
  const { classroomId, studentId } = req.params;
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Auth context missing' });
  if (!classroomId || !studentId) return res.status(400).json({ message: 'Invalid classroom or student id' });

  try {
    const classroomCheck = await db.query(
      `SELECT id
       FROM classrooms
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [classroomId, orgId],
    );
    if ((classroomCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Classroom not found' });

    const quizAttemptsResult = await db.query(
      `SELECT
         sa.id AS attempt_id,
         sa.quiz_id,
         q.title AS quiz_title,
         sa.score,
         sa.total_points,
         sa.completed_at
       FROM student_attempts sa
       INNER JOIN classroom_quizzes cq ON cq.quiz_id = sa.quiz_id AND cq.classroom_id = $1
       INNER JOIN quizzes q ON q.id = sa.quiz_id AND q.organization_id = $2::uuid
       WHERE sa.student_id = $3
       ORDER BY sa.completed_at DESC`,
      [classroomId, orgId, studentId],
    );

    const attemptIds = quizAttemptsResult.rows.map((row: any) => row.attempt_id as string);
    let questionAttemptsByAttemptId: Record<string, any[]> = {};
    if (attemptIds.length > 0) {
      const questionAttemptsResult = await db.query(
        `SELECT
           qa.attempt_id,
           qa.question_id,
           qa.is_correct,
           qa.response_data,
           qa.time_spent_seconds,
           qq.question_title,
           qq.question_type,
           qq.question_instruction,
           qq.question_data
         FROM question_attempts qa
         LEFT JOIN quiz_questions qq ON qq.id = qa.question_id
         WHERE qa.attempt_id = ANY($1::uuid[])
         ORDER BY COALESCE(qq.sort_order, 9999) ASC, qa.id ASC`,
        [attemptIds],
      );

      questionAttemptsByAttemptId = questionAttemptsResult.rows.reduce((acc: Record<string, any[]>, row: any) => {
        const key = row.attempt_id as string;
        if (!acc[key]) acc[key] = [];
        acc[key].push({
          questionId: row.question_id as string,
          questionTitle: (row.question_title as string | null) || 'Question',
          questionType: (row.question_type as string | null) || '',
          questionInstruction: (row.question_instruction as string | null) || '',
          questionData: row.question_data ?? {},
          isCorrect: Boolean(row.is_correct),
          responseData: row.response_data ?? {},
          timeSpentSeconds: row.time_spent_seconds ? Number(row.time_spent_seconds) : null,
        });
        return acc;
      }, {});
    }

    const quizzes = quizAttemptsResult.rows.map((row: any) => ({
      attemptId: row.attempt_id as string,
      quizId: row.quiz_id as string,
      quizTitle: (row.quiz_title as string | null) || 'Quiz',
      score: Number(row.score || 0),
      totalPoints: Number(row.total_points || 0),
      completedAt: row.completed_at as string | null,
      questionAttempts: questionAttemptsByAttemptId[row.attempt_id as string] || [],
    }));

    const assignmentSubmissionsResult = await db.query(
      `SELECT
         ca.id AS assignment_id,
         ca.title,
         ca.description,
         ca.instructions,
         ca.due_date,
         cas.submission_text,
         cas.attachment_url,
         cas.submitted_at
       FROM classroom_assignments ca
       LEFT JOIN classroom_assignment_submissions cas
         ON cas.classroom_assignment_id = ca.id
        AND cas.student_id = $2
       WHERE ca.classroom_id = $1
       ORDER BY ca.created_at ASC`,
      [classroomId, studentId],
    );

    const assignments = await Promise.all(
      assignmentSubmissionsResult.rows.map(async (row: any) => ({
        assignmentId: row.assignment_id as string,
        title: (row.title as string | null) || 'Assignment',
        description: (row.description as string | null) || '',
        instructions: (row.instructions as string | null) || '',
        dueDate: row.due_date as string | null,
        submissionText: (row.submission_text as string | null) || '',
        attachmentUrl: row.attachment_url ? await getSignedMediaUrlIfNeeded(row.attachment_url as string) : '',
        submittedAt: row.submitted_at as string | null,
      })),
    );

    return res.json({ quizzes, assignments });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to fetch student classroom details' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TEACHER REMARKS & SCORES
// ═══════════════════════════════════════════════════════════════════════════

// PUT /classrooms/:id/remarks/:studentId — Upsert remark + scores
quizzesRouter.put('/classrooms/:classroomId/remarks/:studentId', requireAuth, async (req: any, res) => {
  const { classroomId, studentId } = req.params;
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const userId = req?.user?.userId as string | undefined;
  if (!userId) return res.status(400).json({ message: 'Auth context missing' });

  const { remarkText, parentNote, scoreBehavior, scoreConfidence, scoreParticipation, scorePerformance, remarkMediaUrl } = req.body;
  const normalizeScore = (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    const rounded = Math.round(n);
    return rounded >= 1 && rounded <= 5 ? rounded : null;
  };
  const normalizedBehavior = normalizeScore(scoreBehavior);
  const normalizedConfidence = normalizeScore(scoreConfidence);
  const normalizedParticipation = normalizeScore(scoreParticipation);
  const normalizedPerformance = normalizeScore(scorePerformance);

  try {
    const updated = await db.query(
      `UPDATE classroom_student_remarks
       SET remark_text = $4,
           parent_note = $5,
           remark_media_url = $6,
           score_behavior = $7,
           score_confidence = $8,
           score_participation = $9,
           score_performance = $10,
           teacher_id = $3,
           updated_at = NOW()
       WHERE classroom_id = $1 AND student_id = $2
       RETURNING *`,
      [classroomId, studentId, userId, remarkText ?? null, parentNote ?? null, remarkMediaUrl ?? null,
       normalizedBehavior, normalizedConfidence, normalizedParticipation, normalizedPerformance],
    );
    if ((updated.rowCount ?? 0) > 0) {
      return res.json({ remark: updated.rows[0] });
    }

    const inserted = await db.query(
      `INSERT INTO classroom_student_remarks
         (classroom_id, student_id, teacher_id, remark_text, parent_note, remark_media_url,
          score_behavior, score_confidence, score_participation, score_performance, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [classroomId, studentId, userId, remarkText ?? null, parentNote ?? null, remarkMediaUrl ?? null,
       normalizedBehavior, normalizedConfidence, normalizedParticipation, normalizedPerformance],
    );
    return res.json({ remark: inserted.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to save remark' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════════════════════

// GET /achievements — catalogue
quizzesRouter.get('/achievements', requireAuth, async (req: any, res) => {
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

// POST /achievements/grant — Grant achievement to student in a classroom
quizzesRouter.post('/achievements/grant', requireAuth, async (req: any, res) => {
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const userId = req?.user?.userId as string | undefined;
  if (!userId) return res.status(400).json({ message: 'Auth context missing' });

  const { studentId, classroomId, achievementId } = req.body;
  if (!studentId || !classroomId || !achievementId) return res.status(400).json({ message: 'studentId, classroomId, achievementId required' });

  try {
    const canonicalAchievement = await db.query(
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
    const canonicalAchievementId = canonicalAchievement.rows[0].id as string;

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

// GET /classrooms/:id/achievements — All achievements granted in a classroom
quizzesRouter.get('/classrooms/:classroomId/achievements', requireAuth, async (req: any, res) => {
  const { classroomId } = req.params;
  try {
    const r = await db.query(
      `SELECT sa.id, sa.student_id, sa.granted_at, a.name, a.emoji, a.color, a.description,
              TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS student_name
       FROM student_achievements sa
       JOIN achievements a ON a.id = sa.achievement_id
       LEFT JOIN users u ON u.id = sa.student_id
       WHERE sa.classroom_id = $1
       ORDER BY sa.granted_at DESC`,
      [classroomId],
    );
    return res.json({ achievements: r.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to fetch classroom achievements' });
  }
});

// GET /students/my-achievements — Student's own full achievement history
quizzesRouter.get('/students/my-achievements', requireAuth, async (req: any, res) => {
  const userId = req?.user?.userId as string | undefined;
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

    // Group by achievement name for counts
    const grouped: Record<string, { name: string; emoji: string; color: string; description: string; count: number; items: any[] }> = {};
    for (const row of r.rows) {
      if (!grouped[row.name]) grouped[row.name] = { name: row.name, emoji: row.emoji, color: row.color, description: row.description, count: 0, items: [] };
      grouped[row.name].count++;
      grouped[row.name].items.push({ id: row.id, grantedAt: row.granted_at, classroomTitle: row.classroom_title });
    }

    return res.json({ total: r.rows.length, achievements: Object.values(grouped), history: r.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to fetch achievements' });
  }
});

quizzesRouter.post('/classrooms/:classroomId/content', requireAuth, async (req: any, res) => {
  const classroomId = req.params.classroomId as string;
  const parsedBody = addClassroomContentSchema.safeParse(req.body);
  if (!classroomId) return res.status(400).json({ message: 'Invalid classroom id' });
  if (!parsedBody.success) return res.status(400).json({ message: 'Invalid payload', errors: parsedBody.error.issues });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const exists = await db.query(
      `SELECT 1 FROM learning_contents WHERE id = $1 AND organization_id = $2::uuid LIMIT 1`,
      [parsedBody.data.contentId, orgId],
    );
    if ((exists.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Content item not found' });
    await db.query(
      `INSERT INTO classroom_contents (classroom_id, content_id, sort_order)
       VALUES ($1, $2, 0)
       ON CONFLICT (classroom_id, content_id) DO NOTHING`,
      [classroomId, parsedBody.data.contentId],
    );
    return res.status(201).json({ message: 'Content assigned successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to assign content' });
  }
});

quizzesRouter.post('/classrooms/:classroomId/quiz', requireAuth, async (req: any, res) => {
  const classroomId = req.params.classroomId as string;
  const parsedBody = addClassroomQuizSchema.safeParse(req.body);
  if (!classroomId) return res.status(400).json({ message: 'Invalid classroom id' });
  if (!parsedBody.success) return res.status(400).json({ message: 'Invalid payload', errors: parsedBody.error.issues });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const exists = await db.query(
      `SELECT 1 FROM quizzes WHERE id = $1 AND organization_id = $2::uuid LIMIT 1`,
      [parsedBody.data.quizId, orgId],
    );
    if ((exists.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Quiz not found' });
    await db.query(
      `INSERT INTO classroom_quizzes (classroom_id, quiz_id, sort_order)
       VALUES ($1, $2, 0)
       ON CONFLICT (classroom_id, quiz_id) DO NOTHING`,
      [classroomId, parsedBody.data.quizId],
    );
    return res.status(201).json({ message: 'Quiz assigned successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to assign quiz' });
  }
});

quizzesRouter.post('/classrooms/:classroomId/assignment', requireAuth, async (req: any, res) => {
  const classroomId = req.params.classroomId as string;
  const parsedBody = addClassroomAssignmentSchema.safeParse(req.body);
  if (!classroomId) return res.status(400).json({ message: 'Invalid classroom id' });
  if (!parsedBody.success) return res.status(400).json({ message: 'Invalid payload', errors: parsedBody.error.issues });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });

  try {
    const result = await db.query(
      `INSERT INTO classroom_assignments (classroom_id, title, description, attachment_url, instructions, due_date, is_time_bound)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        classroomId,
        parsedBody.data.title,
        parsedBody.data.description?.trim() || null,
        parsedBody.data.attachmentUrl?.trim() ? toPersistentMediaUrl(parsedBody.data.attachmentUrl.trim()) : null,
        parsedBody.data.instructions?.trim() || null,
        parsedBody.data.dueDate ? new Date(parsedBody.data.dueDate) : null,
        parsedBody.data.isTimeBound,
      ],
    );
    return res.status(201).json({ id: result.rows[0].id as string });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to add assignment' });
  }
});

quizzesRouter.post('/students/classrooms/:classroomId/assignments/:assignmentId/submissions', requireAuth, async (req: any, res) => {
  const classroomId = req.params.classroomId as string;
  const assignmentId = req.params.assignmentId as string;
  const parsedBody = createAssignmentSubmissionSchema.safeParse(req.body);
  if (!classroomId || !assignmentId) return res.status(400).json({ message: 'Invalid classroom or assignment id' });
  if (!parsedBody.success) return res.status(400).json({ message: 'Invalid submission payload', errors: parsedBody.error.issues });

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Organization/user not found in auth context' });

  try {
    const userResult = await db.query(
      `SELECT u.active_role FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.id = $1 AND ur.organization_id = $2::uuid LIMIT 1`,
      [userId, orgId],
    );
    if ((userResult.rowCount ?? 0) === 0) return res.status(404).json({ message: 'User not found' });
    const role = (userResult.rows[0].active_role as string | null) || '';
    if (role !== 'student') return res.status(403).json({ message: 'Only students can submit assignments' });

    const assignmentCheck = await db.query(
      `SELECT ca.id
       FROM classroom_assignments ca
       INNER JOIN classrooms c ON c.id = ca.classroom_id
       WHERE ca.id = $1
         AND ca.classroom_id = $2
         AND c.organization_id = $3::uuid
       LIMIT 1`,
      [assignmentId, classroomId, orgId],
    );
    if ((assignmentCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Assignment not found for classroom' });

    await db.query(
      `INSERT INTO classroom_assignment_submissions (classroom_assignment_id, student_id, submission_text, attachment_url, submitted_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (classroom_assignment_id, student_id)
       DO UPDATE SET
         submission_text = EXCLUDED.submission_text,
         attachment_url = EXCLUDED.attachment_url,
         submitted_at = NOW(),
         updated_at = NOW()`,
      [
        assignmentId,
        userId,
        parsedBody.data.submissionText?.trim() || null,
        parsedBody.data.attachmentUrl?.trim() ? toPersistentMediaUrl(parsedBody.data.attachmentUrl.trim()) : null,
      ],
    );
    return res.status(201).json({ message: 'Assignment submitted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to submit assignment' });
  }
});

// ── GET /students/subjects  — subjects + topics for the student's class level ──
quizzesRouter.get('/students/subjects', requireAuth, async (req: any, res) => {
  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Organization/user not found' });

  try {
    // Get student's class level
    const userRow = await db.query(
      `SELECT class_level FROM users WHERE id = $1 LIMIT 1`, [userId],
    );
    const classLevel = userRow.rows[0]?.class_level as string | null;
    if (!classLevel) return res.json({ subjects: [], classLevel: null });

    // Get all topics for this class level
    const result = await db.query(
      `SELECT
         ct.id, ct.class_level, ct.subject, ct.title, ct.cover_image,
         ct.created_at, ct.updated_at,
         COUNT(DISTINCT tca.content_id) AS content_count
       FROM content_topics ct
       LEFT JOIN topic_content_assignments tca ON tca.topic_id = ct.id
       WHERE ct.organization_id = $1::uuid
         AND ct.class_level = $2
       GROUP BY ct.id
       ORDER BY ct.subject, ct.title`,
      [orgId, classLevel],
    );

    // Group by subject
    const subjectMap: Record<string, { subject: string; topics: unknown[] }> = {};
    for (const row of result.rows) {
      const sub = row.subject as string;
      if (!subjectMap[sub]) subjectMap[sub] = { subject: sub, topics: [] };
      subjectMap[sub].topics.push({
        id: row.id as string,
        classLevel: row.class_level as string,
        subject: sub,
        title: row.title as string,
        coverImage: row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : null,
        contentCount: Number(row.content_count || 0),
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      });
    }

    return res.json({
      classLevel,
      subjects: Object.values(subjectMap),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to fetch subjects' });
  }
});

// ── GET /students/subjects/:topicId — topic detail with content ────────────────
quizzesRouter.get('/students/subjects/:topicId', requireAuth, async (req: any, res) => {
  const orgId = getOrganizationId(req);
  const topicId = req.params.topicId as string;
  if (!orgId || !topicId) return res.status(400).json({ message: 'Invalid params' });

  try {
    const topicRow = await db.query(
      `SELECT id, class_level, subject, title, cover_image FROM content_topics
       WHERE id = $1 AND organization_id = $2::uuid LIMIT 1`,
      [topicId, orgId],
    );
    if ((topicRow.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Topic not found' });
    const topic = topicRow.rows[0];

    const contentResult = await db.query(
      `SELECT lc.id, lc.title, lc.content_type, lc.media_url, lc.external_url, lc.text_content, tca.sort_order
       FROM topic_content_assignments tca
       INNER JOIN learning_contents lc ON lc.id = tca.content_id
       WHERE tca.topic_id = $1
       ORDER BY tca.sort_order ASC, tca.created_at ASC`,
      [topicId],
    );

    return res.json({
      topic: {
        id: topic.id as string,
        classLevel: topic.class_level as string,
        subject: topic.subject as string,
        title: topic.title as string,
        coverImage: topic.cover_image ? await getSignedMediaUrlIfNeeded(topic.cover_image as string) : null,
      },
      contents: contentResult.rows.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        contentType: row.content_type as string,
        mediaUrl: (row.media_url as string | null) || undefined,
        externalUrl: (row.external_url as string | null) || undefined,
        textContent: (row.text_content as string | null) || undefined,
        sortOrder: Number(row.sort_order || 0),
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to fetch topic detail' });
  }
});

quizzesRouter.get('/students/classrooms', requireAuth, async (req: any, res) => {
  const parsedQuery = studentClassroomsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid classroom query filters', errors: parsedQuery.error.issues });
  }

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Organization/user not found in auth context' });

  try {
    let studentRow;
    try {
      studentRow = await db.query(
        `SELECT class_level, active_role
         FROM users
         WHERE id = $1
           AND organization_id = $2::uuid
         LIMIT 1`,
        [userId, orgId],
      );
    } catch (error: any) {
      if (error?.code === '42703') {
        studentRow = await db.query(
          `SELECT class_level, active_role
           FROM users
           WHERE id = $1
           LIMIT 1`,
          [userId],
        );
      } else {
        throw error;
      }
    }

    const defaultClassLevel = (studentRow?.rows?.[0]?.class_level as string | null) || '';
    const role = (studentRow?.rows?.[0]?.active_role as string | null) || (req?.user?.role as string | null) || '';
    const requestedClassLevel = parsedQuery.data.class_level?.trim() || '';
    const classLevel = requestedClassLevel || defaultClassLevel;
    let classRows;
    try {
      classRows = await db.query(
        `SELECT DISTINCT class_level
         FROM classrooms
         WHERE organization_id = $1::uuid
         ORDER BY class_level ASC`,
        [orgId],
      );
    } catch (error: any) {
      if (error?.code === '42703') {
        classRows = await db.query(
          `SELECT DISTINCT class_level
           FROM classrooms
           ORDER BY class_level ASC`,
        );
      } else {
        throw error;
      }
    }
    const classLevels = classRows.rows
      .map((row: any) => (row.class_level as string) || '')
      .filter(Boolean);
    if (defaultClassLevel && !classLevels.includes(defaultClassLevel)) {
      classLevels.unshift(defaultClassLevel);
    }
    if (requestedClassLevel && !classLevels.includes(requestedClassLevel)) {
      classLevels.unshift(requestedClassLevel);
    }

    if (!classLevel || role !== 'student') {
      return res.json({ classrooms: [], classLevels, currentClassLevel: classLevel || '' });
    }

    let classroomResult;
    try {
      classroomResult = await db.query(
        `SELECT id, title, description, schedule_type, start_time, duration_minutes, class_level, status, created_at, updated_at
         FROM classrooms
         WHERE organization_id = $1::uuid
           AND class_level = $2
         ORDER BY created_at DESC`,
        [orgId, classLevel],
      );
    } catch (error: any) {
      if (error?.code === '42703') {
        classroomResult = await db.query(
          `SELECT id, title, description, schedule_type, start_time, duration_minutes, class_level, status, created_at, updated_at
           FROM classrooms
           WHERE class_level = $1
           ORDER BY created_at DESC`,
          [classLevel],
        );
      } else {
        throw error;
      }
    }

    const classrooms = await Promise.all(
      classroomResult.rows.map(async (row: any) => {
        const resources = await fetchClassroomResources(row.id as string, orgId, userId);
        const completedQuizzes = resources.quizzes.filter((quiz: any) => quiz.status === 'completed').length;
        const submittedAssignments = resources.assignments.filter((assignment: any) => assignment.status === 'submitted').length;
        const completedActivities = completedQuizzes + submittedAssignments;
        const totalActivities = resources.contents.length + resources.quizzes.length + resources.assignments.length;
        const completionPct = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;
        return {
          id: row.id as string,
          title: row.title as string,
          description: (row.description as string | null) || '',
          scheduleType: row.schedule_type as 'instant' | 'scheduled',
          startTime: row.start_time as string | null,
          durationMinutes: Number(row.duration_minutes || 0),
          classLevel: row.class_level as string,
          status: resolveClassroomStatus(row),
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
          completionPct,
          ...resources,
        };
      }),
    );

    return res.json({ classrooms: filterRestartedClassroomDuplicates(classrooms), classLevels, currentClassLevel: classLevel });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch student classrooms' });
  }
});

quizzesRouter.post('/uploads/media', requireAuth, async (req: any, res) => {
  const parsedBody = uploadMediaSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid media upload payload', errors: parsedBody.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { dataUrl, fileName, mimeType, mediaType } = parsedBody.data;
  try {
    const uploaded = await uploadMediaToS3({
      organizationId: orgId,
      dataUrl,
      fileName,
      mimeType,
      mediaType,
    });
    return res.status(201).json(uploaded);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload media to S3';
    const isClientError =
      message.includes('Invalid upload format') ||
      message.includes('Invalid upload payload') ||
      message.includes('not an image') ||
      message.includes('not an audio');
    return res.status(isClientError ? 400 : 500).json({ message });
  }
});

quizzesRouter.get('/', requireAuth, async (req: any, res) => {
  const { class_level, subject } = req.query;
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    let queryStr = `
      SELECT id, title, description, thumbnail_image, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, total_questions, is_published, is_ai_generated, created_at
      FROM quizzes
      WHERE organization_id = $1::uuid AND is_published = true
    `;
    const params: unknown[] = [orgId];

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

quizzesRouter.get('/teacher/library', requireAuth, async (req: any, res) => {
  const parsedQuery = teacherLibraryQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid query filters', errors: parsedQuery.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { search, class_level, subject, quiz_type, difficulty_level, status, source, limit } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = ['organization_id = $1::uuid'];

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`(title ILIKE $${params.length} OR COALESCE(description, '') ILIKE $${params.length})`);
  }
  if (class_level) {
    params.push(class_level);
    whereClauses.push(`class_level = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`subject = $${params.length}`);
  }
  if (quiz_type) {
    params.push(quiz_type);
    whereClauses.push(`quiz_type = $${params.length}`);
  }
  if (difficulty_level) {
    params.push(difficulty_level);
    whereClauses.push(`difficulty_level = $${params.length}`);
  }
  if (status === 'published') {
    whereClauses.push('is_published = true');
  } else if (status === 'draft') {
    whereClauses.push('is_published = false');
  }
  if (source === 'ai') {
    whereClauses.push('is_ai_generated = true');
  } else if (source === 'manual') {
    whereClauses.push('is_ai_generated = false');
  }

  params.push(limit);

  try {
    const result = await db.query(
      `SELECT id, title, description, class_level, subject, quiz_type, difficulty_level, total_questions, is_published, is_ai_generated, created_at
       FROM quizzes
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    return res.json({ quizzes: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load teacher quiz library' });
  }
});

quizzesRouter.get('/teacher/overview', requireAuth, async (req: any, res) => {
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const summaryResult = await db.query(
      `SELECT
         COUNT(q.id) AS total_quizzes,
         COUNT(*) FILTER (WHERE q.is_published = true) AS published_quizzes,
         COUNT(*) FILTER (WHERE q.is_ai_generated = true) AS ai_generated_quizzes,
         COUNT(sa.id) AS total_attempts,
         COALESCE(ROUND(AVG((sa.score::numeric / NULLIF(sa.total_points, 0)) * 100), 2), 0) AS average_score_pct
       FROM quizzes q
       LEFT JOIN student_attempts sa ON sa.quiz_id = q.id
       WHERE q.organization_id = $1::uuid`,
      [orgId],
    );

    const classPerformanceResult = await db.query(
      `SELECT
         COALESCE(q.class_level, 'Unassigned') AS class_level,
         COUNT(sa.id) AS attempts,
         COALESCE(ROUND(AVG((sa.score::numeric / NULLIF(sa.total_points, 0)) * 100), 2), 0) AS average_score_pct
       FROM quizzes q
       LEFT JOIN student_attempts sa ON sa.quiz_id = q.id
       WHERE q.organization_id = $1::uuid
       GROUP BY q.class_level
       ORDER BY attempts DESC, class_level ASC
       LIMIT 8`,
      [orgId],
    );

    const difficultyMixResult = await db.query(
      `SELECT
         COALESCE(difficulty_level, 'unspecified') AS difficulty_level,
         COUNT(*) AS quiz_count
       FROM quizzes
       WHERE organization_id = $1::uuid
       GROUP BY difficulty_level
       ORDER BY quiz_count DESC`,
      [orgId],
    );

    const topGapResult = await db.query(
      `SELECT
         qq.id AS question_id,
         COALESCE(NULLIF(qq.question_title, ''), qq.question_instruction, 'Untitled question') AS question_title,
         q.title AS quiz_title,
         COUNT(qa.id) AS attempts,
         ROUND(AVG(CASE WHEN qa.is_correct THEN 0 ELSE 1 END) * 100, 2) AS incorrect_pct
       FROM question_attempts qa
       INNER JOIN quiz_questions qq ON qq.id = qa.question_id
       INNER JOIN quizzes q ON q.id = qq.quiz_id
       WHERE q.organization_id = $1::uuid
       GROUP BY qq.id, qq.question_title, qq.question_instruction, q.title
       HAVING COUNT(qa.id) > 0
       ORDER BY incorrect_pct DESC, attempts DESC
       LIMIT 6`,
      [orgId],
    );

    const recentQuizzesResult = await db.query(
      `SELECT id, title, class_level, subject, quiz_type, difficulty_level, total_questions, is_published, is_ai_generated, created_at
       FROM quizzes
       WHERE organization_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 8`,
      [orgId],
    );

    return res.json({
      summary: summaryResult.rows[0],
      classPerformance: classPerformanceResult.rows,
      difficultyMix: difficultyMixResult.rows,
      topGaps: topGapResult.rows,
      recentQuizzes: recentQuizzesResult.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load teacher overview data' });
  }
});

quizzesRouter.get('/questions', requireAuth, async (req: any, res) => {
  const parsedQuery = questionManagementQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid question filter payload', errors: parsedQuery.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { search, class_level, subject, category, quiz_type, quiz_id, limit } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = [
    `(q.organization_id = $1::uuid OR COALESCE(qq.question_data->'_meta'->>'organizationId', '') = $1::text)`,
  ];

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(
      `(COALESCE(qq.question_title, '') ILIKE $${params.length}
        OR COALESCE(qq.question_instruction, '') ILIKE $${params.length}
        OR COALESCE(q.title, '') ILIKE $${params.length})`,
    );
  }
  if (class_level) {
    params.push(class_level);
    whereClauses.push(`COALESCE(q.class_level, qq.question_data->'_meta'->>'classLevel', '') = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`COALESCE(q.subject, qq.question_data->'_meta'->>'subject', '') = $${params.length}`);
  }
  if (quiz_type) {
    params.push(quiz_type);
    whereClauses.push(`COALESCE(q.quiz_type, '') = $${params.length}`);
  }
  if (category) {
    params.push(category);
    whereClauses.push(`qq.question_type = $${params.length}`);
  }
  if (quiz_id) {
    params.push(quiz_id);
    whereClauses.push(`qq.quiz_id = $${params.length}`);
  }

  params.push(limit);

  try {
    const result = await db.query(
      `SELECT
         qq.id,
         qq.quiz_id,
         COALESCE(q.title, 'Question Bank') AS quiz_title,
         COALESCE(q.class_level, qq.question_data->'_meta'->>'classLevel') AS class_level,
         COALESCE(q.subject, qq.question_data->'_meta'->>'subject') AS subject,
         COALESCE(q.quiz_type, qq.question_type) AS quiz_type,
         qq.question_type,
         qq.question_title,
         qq.question_instruction,
         qq.question_audio,
         qq.time_limit_seconds,
         qq.points,
         qq.sort_order,
         qq.created_at
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY qq.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return res.json({ questions: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch questions' });
  }
});

quizzesRouter.get('/questions/:questionId', requireAuth, async (req: any, res) => {
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  const { questionId } = req.params;
  try {
    const result = await db.query(
      `SELECT
         qq.id,
         qq.quiz_id,
         COALESCE(q.title, 'Question Bank') AS quiz_title,
         COALESCE(q.class_level, qq.question_data->'_meta'->>'classLevel') AS class_level,
         COALESCE(q.subject, qq.question_data->'_meta'->>'subject') AS subject,
         COALESCE(q.quiz_type, qq.question_type) AS quiz_type,
         qq.question_type,
         qq.question_title,
         qq.question_instruction,
         qq.question_audio,
         qq.time_limit_seconds,
         qq.points,
         qq.sort_order,
         qq.question_data,
         qq.created_at
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
       WHERE qq.id = $1
         AND (q.organization_id = $2::uuid OR COALESCE(qq.question_data->'_meta'->>'organizationId', '') = $2::text)`,
      [questionId, orgId],
    );
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Question not found' });
    const cache = new Map<string, Promise<string>>();
    const signed = await signQuestionRowMedia(result.rows[0] as Record<string, unknown>, cache);
    return res.json({ question: signed });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch question' });
  }
});

quizzesRouter.get('/question-bank', requireAuth, async (req: any, res) => {
  const parsedQuery = questionBankQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid question bank filters', errors: parsedQuery.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { search, class_level, subject, question_type, limit } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = [
    `(q.organization_id = $1::uuid OR COALESCE(qq.question_data->'_meta'->>'organizationId', '') = $1::text)`,
  ];

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(
      `(COALESCE(qq.question_title, '') ILIKE $${params.length}
        OR COALESCE(qq.question_instruction, '') ILIKE $${params.length}
        OR COALESCE(q.title, '') ILIKE $${params.length})`,
    );
  }
  if (class_level) {
    params.push(class_level);
    whereClauses.push(`COALESCE(q.class_level, qq.question_data->'_meta'->>'classLevel', '') = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`COALESCE(q.subject, qq.question_data->'_meta'->>'subject', '') = $${params.length}`);
  }
  if (question_type) {
    params.push(question_type);
    whereClauses.push(`qq.question_type = $${params.length}`);
  }

  params.push(limit);

  try {
    const result = await db.query(
      `SELECT
         qq.id,
         qq.quiz_id,
         COALESCE(q.title, 'Question Bank') AS quiz_title,
         COALESCE(q.class_level, qq.question_data->'_meta'->>'classLevel') AS class_level,
         COALESCE(q.subject, qq.question_data->'_meta'->>'subject') AS subject,
         qq.question_type,
         qq.question_title,
         qq.question_instruction,
         qq.question_audio,
         qq.time_limit_seconds,
         qq.points,
         qq.sort_order,
         qq.question_data,
         q.created_by AS quiz_created_by,
         qq.created_at
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY qq.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    const signedRows = await signQuestionRowsMedia(result.rows as Record<string, unknown>[]);
    return res.json({ questions: signedRows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load question bank' });
  }
});

quizzesRouter.post('/:quizId/questions/reuse', requireAuth, async (req: any, res) => {
  const { quizId } = req.params;
  const parsedBody = reuseQuestionSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid reuse payload', errors: parsedBody.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  const userId = req.user.userId as string;

  const permission = await ensureQuizEditPermission(quizId, orgId, userId, req);
  if (!permission.exists) {
    return res.status(404).json({ message: 'Quiz not found' });
  }
  if (!permission.allowed) {
    return res.status(403).json({ message: 'Only quiz creator can edit this quiz' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const sourceResult = await client.query(
      `SELECT qq.*
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
       WHERE qq.id = $1
         AND (
           q.organization_id = $2::uuid
           OR COALESCE(qq.question_data->'_meta'->>'organizationId', '') = $2::text
         )`,
      [parsedBody.data.sourceQuestionId, orgId],
    );
    if ((sourceResult.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Source question not found' });
    }

    const source = sourceResult.rows[0];
    const sourceData = source.question_data && typeof source.question_data === 'object' ? source.question_data : {};
    const creatorId = (sourceData as Record<string, any>)._meta?.creatorId || userId;
    const clonedQuestionData = {
      ...sourceData,
      _meta: {
        ...((sourceData as Record<string, any>)._meta || {}),
        creatorId,
      },
    };

    const insertResult = await client.query(
      `INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, time_limit_seconds, points, sort_order, question_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)
       RETURNING id`,
      [
        quizId,
        source.question_type,
        source.question_title,
        source.question_instruction,
        source.question_audio,
        source.time_limit_seconds,
        source.points,
        clonedQuestionData,
      ],
    );

    await client.query(
      `UPDATE quizzes
       SET total_questions = total_questions + 1, updated_at = NOW()
       WHERE id = $1`,
      [quizId],
    );

    const createdId = insertResult.rows[0].id as string;
    const createdResult = await client.query(
      `SELECT
         qq.id,
         qq.quiz_id,
         q.title AS quiz_title,
         q.class_level,
         q.subject,
         q.quiz_type,
         qq.question_type,
         qq.question_title,
         qq.question_instruction,
         qq.question_audio,
         qq.time_limit_seconds,
         qq.points,
         qq.sort_order,
         qq.question_data,
         qq.created_at
       FROM quiz_questions qq
       INNER JOIN quizzes q ON q.id = qq.quiz_id
       WHERE qq.id = $1`,
      [createdId],
    );

    await client.query('COMMIT');
    const signedCreatedRow = await signQuestionRowMedia(
      createdResult.rows[0] as Record<string, unknown>,
      new Map<string, Promise<string>>(),
    );
    return res.status(201).json(signedCreatedRow);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to reuse question' });
  } finally {
    client.release();
  }
});

quizzesRouter.post('/questions', requireAuth, async (req: any, res) => {
  const parsedBody = createManagedQuestionSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid question create payload', errors: parsedBody.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  const userId = req.user.userId as string;

  const {
    quizId,
    classLevel,
    subject,
    questionType,
    questionTitle,
    questionInstruction,
    questionAudio,
    timeLimitSeconds,
    points,
    sortOrder,
    questionData,
  } = parsedBody.data;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    if (quizId) {
      const permission = await ensureQuizEditPermission(quizId, orgId, userId, req);
      if (!permission.exists) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Quiz not found' });
      }
      if (!permission.allowed) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Only quiz creator can edit this quiz' });
      }

      const quizExists = await client.query(
        `SELECT 1 FROM quizzes WHERE id = $1 AND organization_id = $2::uuid`,
        [quizId, orgId],
      );
      if ((quizExists.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Quiz not found' });
      }
    }

    const preparedQuestionData =
      questionData && typeof questionData === 'object' && !Array.isArray(questionData)
        ? {
            ...questionData,
            _meta: {
              ...((questionData as Record<string, any>)._meta || {}),
              creatorId: userId,
              organizationId: orgId,
              classLevel: classLevel || null,
              subject: subject || null,
            },
          }
        : { payload: questionData, _meta: { creatorId: userId, organizationId: orgId, classLevel: classLevel || null, subject: subject || null } };

    const insertResult = await client.query(
      `INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, time_limit_seconds, points, sort_order, question_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        quizId || null,
        questionType,
        questionTitle,
        questionInstruction || null,
        questionAudio || null,
        timeLimitSeconds,
        points,
        sortOrder ?? null,
        preparedQuestionData,
      ],
    );
    const questionId = insertResult.rows[0].id as string;

    if (quizId) {
      await client.query(
        `UPDATE quizzes
         SET total_questions = total_questions + 1, updated_at = NOW()
         WHERE id = $1`,
        [quizId],
      );
    }

    const result = await client.query(
      `SELECT
         qq.id,
         qq.quiz_id,
         COALESCE(q.title, 'Question Bank') AS quiz_title,
         q.class_level,
         q.subject,
         COALESCE(q.quiz_type, qq.question_type) AS quiz_type,
         qq.question_type,
         qq.question_title,
         qq.question_instruction,
         qq.question_audio,
         qq.time_limit_seconds,
         qq.points,
         qq.sort_order,
         qq.question_data,
         qq.created_at
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
       WHERE qq.id = $1`,
      [questionId],
    );

    await client.query('COMMIT');
    const signedCreatedRow = await signQuestionRowMedia(
      result.rows[0] as Record<string, unknown>,
      new Map<string, Promise<string>>(),
    );
    return res.status(201).json(signedCreatedRow);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to create question' });
  } finally {
    client.release();
  }
});

quizzesRouter.patch('/questions/:questionId', requireAuth, async (req: any, res) => {
  const { questionId } = req.params;
  const parsedBody = updateQuestionSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid question update payload', errors: parsedBody.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const userId = req.user.userId as string;
    const permission = await ensureQuestionEditPermission(questionId, orgId, userId, req);
    if (!permission.exists) {
      return res.status(404).json({ message: 'Question not found' });
    }
    if (!permission.allowed) {
      return res.status(403).json({ message: 'Only original creator or quiz creator can edit this question' });
    }

    const {
      questionType,
      questionTitle,
      questionInstruction,
      questionAudio,
      timeLimitSeconds,
      points,
      sortOrder,
      questionData,
    } = parsedBody.data;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (questionType !== undefined) {
      params.push(questionType);
      updates.push(`question_type = $${params.length}`);
    }
    if (questionTitle !== undefined) {
      params.push(questionTitle || null);
      updates.push(`question_title = $${params.length}`);
    }
    if (questionInstruction !== undefined) {
      params.push(questionInstruction || null);
      updates.push(`question_instruction = $${params.length}`);
    }
    if (questionAudio !== undefined) {
      params.push(questionAudio || null);
      updates.push(`question_audio = $${params.length}`);
    }
    if (timeLimitSeconds !== undefined) {
      params.push(timeLimitSeconds);
      updates.push(`time_limit_seconds = $${params.length}`);
    }
    if (points !== undefined) {
      params.push(points);
      updates.push(`points = $${params.length}`);
    }
    if (sortOrder !== undefined) {
      params.push(sortOrder);
      updates.push(`sort_order = $${params.length}`);
    }
    if (questionData !== undefined) {
      params.push(questionData);
      updates.push(`question_data = $${params.length}`);
    }

    params.push(questionId);

    await db.query(
      `UPDATE quiz_questions
       SET ${updates.join(', ')}
       WHERE id = $${params.length}`,
      params,
    );

    const result = await db.query(
      `SELECT
         qq.id,
         qq.quiz_id,
         COALESCE(q.title, 'Question Bank') AS quiz_title,
         q.class_level,
         q.subject,
         COALESCE(q.quiz_type, qq.question_type) AS quiz_type,
         qq.question_type,
         qq.question_title,
         qq.question_instruction,
         qq.question_audio,
         qq.time_limit_seconds,
         qq.points,
         qq.sort_order,
         qq.question_data,
         qq.created_at
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
       WHERE qq.id = $1`,
      [questionId],
    );

    const signedRow = await signQuestionRowMedia(
      result.rows[0] as Record<string, unknown>,
      new Map<string, Promise<string>>(),
    );
    return res.json(signedRow);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update question' });
  }
});

quizzesRouter.delete('/questions/:questionId', requireAuth, async (req: any, res) => {
  const { questionId } = req.params;
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user.userId as string;
    const permission = await ensureQuestionEditPermission(questionId, orgId, userId, req);
    if (!permission.exists) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Question not found' });
    }
    if (!permission.allowed) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Only original creator or quiz creator can delete this question' });
    }

    const targetResult = await client.query(
      `SELECT qq.id, qq.quiz_id
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
       WHERE qq.id = $1
         AND (
           q.organization_id = $2::uuid
           OR COALESCE(qq.question_data->'_meta'->>'organizationId', '') = $2::text
         )`,
      [questionId, orgId],
    );
    if ((targetResult.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Question not found' });
    }

    const quizId = targetResult.rows[0].quiz_id as string | null;

    await client.query(`DELETE FROM quiz_questions WHERE id = $1`, [questionId]);
    if (quizId) {
      await client.query(
        `UPDATE quizzes
         SET total_questions = GREATEST(total_questions - 1, 0), updated_at = NOW()
         WHERE id = $1`,
        [quizId],
      );
    }

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to delete question' });
  } finally {
    client.release();
  }
});

quizzesRouter.get('/bgm', async (_req, res) => {
  const bgmList = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  ];
  const randomBgm = bgmList[Math.floor(Math.random() * bgmList.length)];
  return res.json({ url: randomBgm });
});

quizzesRouter.get('/:id', requireAuth, async (req: any, res) => {
  const { id } = req.params;
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const quizResult = await db.query(
      `SELECT * FROM quizzes WHERE id = $1 AND organization_id = $2::uuid`,
      [id, orgId],
    );

    if ((quizResult.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const quiz = quizResult.rows[0];
    const questionsResult = await db.query(
      `SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [id],
    );
    const signedQuestions = await signQuestionRowsMedia(questionsResult.rows as Record<string, unknown>[]);

    return res.json({
      ...quiz,
      questions: signedQuestions,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch quiz details' });
  }
});

quizzesRouter.post('/', requireAuth, async (req: any, res) => {
  const parsed = createQuizSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const { title, description, classLevel, subject, quizType, difficultyLevel, backgroundMusicUrl, theme, isPublished, isAiGenerated } = parsed.data;
  const orgId = getOrganizationId(req);
  const userId = req.user.userId;
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const result = await db.query(
      `INSERT INTO quizzes (organization_id, title, description, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, is_published, is_ai_generated, created_by)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [orgId, title, description || null, classLevel || null, subject || null, quizType, difficultyLevel || null, backgroundMusicUrl || null, theme, isPublished, isAiGenerated, userId],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create quiz' });
  }
});

quizzesRouter.patch('/:id/publish', requireAuth, async (req: any, res) => {
  const { id } = req.params;
  const parsed = publishSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  const userId = req.user.userId as string;

  try {
    const permission = await ensureQuizEditPermission(id, orgId, userId, req);
    if (!permission.exists) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    if (!permission.allowed) {
      return res.status(403).json({ message: 'Only quiz creator can update this quiz' });
    }

    const result = await db.query(
      `UPDATE quizzes
       SET is_published = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3::uuid
       RETURNING id, title, class_level, subject, quiz_type, difficulty_level, total_questions, is_published, is_ai_generated, created_at, updated_at`,
      [parsed.data.isPublished, id, orgId],
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update quiz publish status' });
  }
});

quizzesRouter.post('/:id/questions', requireAuth, async (req: any, res) => {
  const { id } = req.params;
  const parsed = createQuestionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  const userId = req.user.userId as string;

  const { questionType, questionTitle, questionInstruction, questionAudio, timeLimitSeconds, points, sortOrder, questionData } = parsed.data;

  try {
    const permission = await ensureQuizEditPermission(id, orgId, userId, req);
    if (!permission.exists) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    if (!permission.allowed) {
      return res.status(403).json({ message: 'Only quiz creator can edit this quiz' });
    }

    const quizExists = await db.query(
      'SELECT 1 FROM quizzes WHERE id = $1 AND organization_id = $2::uuid',
      [id, orgId],
    );
    if ((quizExists.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const preparedQuestionData =
      questionData && typeof questionData === 'object' && !Array.isArray(questionData)
        ? {
            ...questionData,
            _meta: {
              ...((questionData as Record<string, any>)._meta || {}),
              creatorId: userId,
            },
          }
        : { payload: questionData, _meta: { creatorId: userId } };

    const result = await db.query(
      `INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, time_limit_seconds, points, sort_order, question_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, questionType, questionTitle || null, questionInstruction || null, questionAudio || null, timeLimitSeconds, points, sortOrder || null, preparedQuestionData],
    );

    await db.query(
      `UPDATE quizzes SET total_questions = total_questions + 1, updated_at = NOW() WHERE id = $1`,
      [id],
    );

    const signedCreatedRow = await signQuestionRowMedia(
      result.rows[0] as Record<string, unknown>,
      new Map<string, Promise<string>>(),
    );
    return res.status(201).json(signedCreatedRow);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create question' });
  }
});

quizzesRouter.get('/content/subjects', requireAuth, async (req: any, res) => {
  const parsedQuery = listSubjectCatalogQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid subject filters', errors: parsedQuery.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { class_level } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = ['organization_id = $1::uuid'];
  if (class_level) {
    params.push(class_level);
    whereClauses.push(`class_level = $${params.length}`);
  }

  try {
    const result = await db.query(
      `SELECT id, title, class_level, cover_image
       FROM subjects
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY class_level ASC, title ASC`,
      params,
    );
    const rows = await Promise.all(
      result.rows.map(async (row) => ({
        id: row.id as string,
        title: row.title as string,
        classLevel: row.class_level as string,
        coverImage: row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : undefined,
      })),
    );
    return res.json({ subjects: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch subject catalog' });
  }
});

quizzesRouter.get('/content/topics', requireAuth, async (req: any, res) => {
  const parsedQuery = listContentTopicsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid content topic filters', errors: parsedQuery.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { class_level, subject, search, limit } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = ['ct.organization_id = $1::uuid'];

  if (class_level) {
    params.push(class_level);
    whereClauses.push(`ct.class_level = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`ct.subject = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    whereClauses.push(`(ct.title ILIKE $${idx} OR COALESCE(ct.subject, '') ILIKE $${idx})`);
  }
  params.push(limit);

  try {
    const result = await db.query(
      `SELECT
         ct.id,
         ct.class_level,
         ct.subject,
         ct.title,
         ct.cover_image,
         ct.created_by,
         ct.created_at,
         ct.updated_at,
         COALESCE(
           (SELECT COUNT(*) FROM topic_content_assignments tca2 WHERE tca2.topic_id = ct.id), 0
         )::int AS content_count,
         COALESCE(
           (SELECT COUNT(*) FROM quizzes q WHERE q.topic_id = ct.id), 0
         )::int AS quiz_count
       FROM content_topics ct
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY ct.id
       ORDER BY ct.class_level ASC, ct.subject ASC, ct.title ASC
       LIMIT $${params.length}`,
      params,
    );

    const topicRows = await Promise.all(
      result.rows.map(async (row) => {
        const signedCover = row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : null;
        return {
          id: row.id as string,
          classLevel: row.class_level as string,
          subject: row.subject as string,
          title: row.title as string,
          coverImage: (signedCover as string | null) || undefined,
          sectionCount: 0,
          contentCount: Number(row.content_count || 0),
          quizCount: Number(row.quiz_count || 0),
          createdBy: (row.created_by as string | null) || undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        };
      }),
    );

    return res.json({ topics: topicRows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch content topics' });
  }
});

quizzesRouter.post('/content/topics', requireAuth, async (req: any, res) => {
  const parsedBody = createContentTopicSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid content topic payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId;
  if (!orgId || !userId) {
    return res.status(400).json({ message: 'Organization/user not found in auth context' });
  }

  const { classLevel, subject, title, coverImage } = parsedBody.data;

  try {
    const duplicate = await db.query(
      `SELECT 1
       FROM content_topics
       WHERE organization_id = $1::uuid
         AND class_level = $2
         AND subject = $3
         AND LOWER(title) = LOWER($4)
       LIMIT 1`,
      [orgId, classLevel, subject, title],
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      return res.status(400).json({ message: 'Topic already exists for this standard and subject' });
    }

    const result = await db.query(
      `INSERT INTO content_topics (organization_id, class_level, subject, title, cover_image, created_by)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)
       RETURNING id, class_level, subject, title, cover_image, created_by, created_at, updated_at`,
      [orgId, classLevel, subject, title, coverImage ? toPersistentMediaUrl(coverImage) : null, userId],
    );
    const row = result.rows[0];
    const signedCover = row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : null;
    return res.status(201).json({
      id: row.id as string,
      classLevel: row.class_level as string,
      subject: row.subject as string,
      title: row.title as string,
      coverImage: (signedCover as string | null) || undefined,
      sectionCount: 0,
      createdBy: (row.created_by as string | null) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create content topic' });
  }
});

quizzesRouter.patch('/content/topics/:topicId', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  const parsedBody = updateContentTopicSchema.safeParse(req.body);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid update payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId;
  if (!orgId || !userId) {
    return res.status(400).json({ message: 'Organization/user not found in auth context' });
  }

  try {
    const permission = await ensureTopicEditPermission(topicId, orgId, userId, req);
    if (!permission.exists) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    if (!permission.allowed) {
      return res.status(403).json({ message: 'Forbidden: not allowed to edit this topic' });
    }

    const existing = await db.query(
      `SELECT class_level, subject, title
       FROM content_topics
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [topicId, orgId],
    );
    const existingRow = existing.rows[0];
    const nextClassLevel = parsedBody.data.classLevel ?? (existingRow?.class_level as string);
    const nextSubject = parsedBody.data.subject ?? (existingRow?.subject as string);
    const nextTitle = parsedBody.data.title ?? (existingRow?.title as string);

    const duplicate = await db.query(
      `SELECT 1
       FROM content_topics
       WHERE organization_id = $1::uuid
         AND class_level = $2
         AND subject = $3
         AND LOWER(title) = LOWER($4)
         AND id <> $5
       LIMIT 1`,
      [orgId, nextClassLevel, nextSubject, nextTitle, topicId],
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      return res.status(400).json({ message: 'Topic already exists for this standard and subject' });
    }

    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    if (parsedBody.data.classLevel !== undefined) {
      params.push(parsedBody.data.classLevel);
      updates.push(`class_level = $${params.length}`);
    }
    if (parsedBody.data.subject !== undefined) {
      params.push(parsedBody.data.subject);
      updates.push(`subject = $${params.length}`);
    }
    if (parsedBody.data.title !== undefined) {
      params.push(parsedBody.data.title);
      updates.push(`title = $${params.length}`);
    }
    if (parsedBody.data.coverImage !== undefined) {
      params.push(parsedBody.data.coverImage ? toPersistentMediaUrl(parsedBody.data.coverImage) : null);
      updates.push(`cover_image = $${params.length}`);
    }
    params.push(topicId, orgId);

    const result = await db.query(
      `UPDATE content_topics
       SET ${updates.join(', ')}
       WHERE id = $${params.length - 1}
         AND organization_id = $${params.length}::uuid
       RETURNING id, class_level, subject, title, cover_image, created_by, created_at, updated_at`,
      params,
    );
    const row = result.rows[0];
    const countResult = await db.query(
      `SELECT COUNT(lcs.id)::int AS count
       FROM topic_content_assignments tca
       LEFT JOIN learning_content_sections lcs ON lcs.content_id = tca.content_id
       WHERE tca.topic_id = $1`,
      [topicId],
    );
    const signedCover = row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : null;
    return res.json({
      id: row.id as string,
      classLevel: row.class_level as string,
      subject: row.subject as string,
      title: row.title as string,
      coverImage: (signedCover as string | null) || undefined,
      sectionCount: Number(countResult.rows[0]?.count || 0),
      createdBy: (row.created_by as string | null) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update content topic' });
  }
});

quizzesRouter.delete('/content/topics/:topicId', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId;
  if (!orgId || !userId) {
    return res.status(400).json({ message: 'Organization/user not found in auth context' });
  }

  try {
    const permission = await ensureTopicEditPermission(topicId, orgId, userId, req);
    if (!permission.exists) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    if (!permission.allowed) {
      return res.status(403).json({ message: 'Forbidden: not allowed to delete this topic' });
    }

    await db.query(
      `DELETE FROM content_topics
       WHERE id = $1
         AND organization_id = $2::uuid`,
      [topicId, orgId],
    );
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to delete content topic' });
  }
});

quizzesRouter.get('/content/topics/:topicId/details', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const topicResult = await db.query(
      `SELECT id, class_level, subject, title, cover_image, created_by, created_at, updated_at
       FROM content_topics
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [topicId, orgId],
    );
    if ((topicResult.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const contentItemsResult = await db.query(
      `SELECT
         lc.id,
         lc.class_level,
         lc.subject,
         lc.title,
         lc.content_type,
         lc.media_url,
         lc.external_url,
         lc.text_content,
         lc.created_by,
         lc.created_at,
         lc.updated_at,
         tca.sort_order
       FROM topic_content_assignments tca
       INNER JOIN learning_contents lc ON lc.id = tca.content_id
       WHERE tca.topic_id = $1
       ORDER BY tca.sort_order ASC, tca.created_at ASC`,
      [topicId],
    );

    const topic = topicResult.rows[0];
    const signedCover = topic.cover_image ? await getSignedMediaUrlIfNeeded(topic.cover_image as string) : null;

    const contentIds = contentItemsResult.rows.map((row) => row.id);
    let sectionsRows: any[] = [];
    if (contentIds.length > 0) {
      const sectionsResult = await db.query(
        `SELECT id, content_id, section_order, title, content_type, media_url, external_url, text_content, created_at, updated_at
         FROM learning_content_sections
         WHERE content_id = ANY($1::uuid[])
         ORDER BY content_id, section_order ASC, created_at ASC`,
        [contentIds],
      );
      sectionsRows = sectionsResult.rows;
    }

    const sectionsGroupedByContentId: Record<string, any[]> = {};
    for (const row of sectionsRows) {
      const cId = row.content_id;
      if (!sectionsGroupedByContentId[cId]) {
        sectionsGroupedByContentId[cId] = [];
      }
      sectionsGroupedByContentId[cId].push({
        id: row.id as string,
        sectionOrder: Number(row.section_order || 0),
        title: (row.title as string | null) || undefined,
        contentType: row.content_type as string,
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
        externalUrl: (row.external_url as string | null) || undefined,
        textContent: (row.text_content as string | null) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      });
    }

    const contentItems = await Promise.all(
      contentItemsResult.rows.map(async (row) => {
        const cId = row.id as string;
        let sections = sectionsGroupedByContentId[cId] || [];
        if (sections.length === 0) {
          sections = [
            {
              id: row.id as string,
              sectionOrder: 1,
              title: undefined,
              contentType: row.content_type as string,
              mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
              externalUrl: (row.external_url as string | null) || undefined,
              textContent: (row.text_content as string | null) || undefined,
              createdAt: row.created_at as string,
              updatedAt: row.updated_at as string,
            },
          ];
        }
        return {
          id: cId,
          classLevel: row.class_level as string,
          subject: row.subject as string,
          title: row.title as string,
          contentType: row.content_type as string,
          sectionCount: sections.length,
          mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
          externalUrl: (row.external_url as string | null) || undefined,
          textContent: (row.text_content as string | null) || undefined,
          sections,
          createdBy: (row.created_by as string | null) || undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        };
      }),
    );

    const flatSections: any[] = [];
    for (const item of contentItems) {
      flatSections.push(...item.sections);
    }

    return res.json({
      topic: {
        id: topic.id as string,
        classLevel: topic.class_level as string,
        subject: topic.subject as string,
        title: topic.title as string,
        coverImage: (signedCover as string | null) || undefined,
        createdBy: (topic.created_by as string | null) || undefined,
        createdAt: topic.created_at as string,
        updatedAt: topic.updated_at as string,
      },
      contentItems,
      sections: flatSections,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch topic details' });
  }
});

quizzesRouter.put('/content/topics/:topicId/sections', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  const parsedBody = replaceTopicSectionsSchema.safeParse(req.body);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid sections payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId;
  if (!orgId || !userId) {
    return res.status(400).json({ message: 'Organization/user not found in auth context' });
  }

  const permission = await ensureTopicEditPermission(topicId, orgId, userId, req);
  if (!permission.exists) {
    return res.status(404).json({ message: 'Topic not found' });
  }
  if (!permission.allowed) {
    return res.status(403).json({ message: 'Forbidden: not allowed to update this topic' });
  }

  const sections = parsedBody.data.sections;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM topic_content_sections WHERE topic_id = $1`, [topicId]);

    for (let i = 0; i < sections.length; i += 1) {
      const section = sections[i];
      await client.query(
        `INSERT INTO topic_content_sections (topic_id, section_order, title, content_type, media_url, external_url, text_content)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          topicId,
          i + 1,
          section.title?.trim() || null,
          section.contentType,
          section.mediaUrl ? toPersistentMediaUrl(section.mediaUrl) : null,
          section.externalUrl || null,
          section.textContent || null,
        ],
      );
    }
    await client.query('COMMIT');

    const detailsResult = await db.query(
      `SELECT id, section_order, title, content_type, media_url, external_url, text_content, created_at, updated_at
       FROM topic_content_sections
       WHERE topic_id = $1
       ORDER BY section_order ASC`,
      [topicId],
    );
    const resolvedSections = await Promise.all(
      detailsResult.rows.map(async (row) => ({
        id: row.id as string,
        sectionOrder: Number(row.section_order || 0),
        title: (row.title as string | null) || undefined,
        contentType: row.content_type as string,
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
        externalUrl: (row.external_url as string | null) || undefined,
        textContent: (row.text_content as string | null) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      })),
    );
    return res.json({ sections: resolvedSections });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to save content sections' });
  } finally {
    client.release();
  }
});

quizzesRouter.post('/content/items', requireAuth, async (req: any, res) => {
  const parsedBody = createLearningContentSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid content payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId;
  if (!orgId || !userId) {
    return res.status(400).json({ message: 'Organization/user not found in auth context' });
  }

  const { classLevel, subject, topicId, title } = parsedBody.data;
  const sections = normalizeLearningContentSections(parsedBody.data);
  if (sections.length === 0) {
    return res.status(400).json({ message: 'At least one valid section is required' });
  }

  try {
    if (topicId) {
      const topicCheck = await db.query(
        `SELECT 1 FROM content_topics WHERE id = $1 AND organization_id = $2::uuid LIMIT 1`,
        [topicId, orgId],
      );
      if ((topicCheck.rowCount ?? 0) === 0) {
        return res.status(404).json({ message: 'Topic not found for assignment' });
      }
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const contentResult = await client.query(
        `INSERT INTO learning_contents (organization_id, class_level, subject, title, content_type, media_url, external_url, text_content, created_by)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, class_level, subject, title, content_type, media_url, external_url, text_content, created_by, created_at, updated_at`,
        [
          orgId,
          classLevel,
          subject,
          title,
          sections.length > 1 ? 'multi_section' : sections[0].contentType,
          sections[0].mediaUrl,
          sections[0].externalUrl,
          sections[0].textContent,
          userId,
        ],
      );
      const created = contentResult.rows[0];

      for (let i = 0; i < sections.length; i += 1) {
        const section = sections[i];
        await client.query(
          `INSERT INTO learning_content_sections (content_id, section_order, title, content_type, media_url, external_url, text_content)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [created.id, i + 1, section.title?.trim() || null, section.contentType, section.mediaUrl ? toPersistentMediaUrl(section.mediaUrl) : null, section.externalUrl || null, section.textContent || null],
        );
      }

      if (topicId) {
        await client.query(
          `INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
           VALUES ($1, $2, 0)
           ON CONFLICT (topic_id, content_id) DO NOTHING`,
          [topicId, created.id],
        );
      }

      await client.query('COMMIT');
      return res.status(201).json({
        id: created.id as string,
        classLevel: created.class_level as string,
        subject: created.subject as string,
        title: created.title as string,
        contentType: created.content_type as string,
        sectionCount: sections.length,
        mediaUrl: created.media_url ? await getSignedMediaUrlIfNeeded(created.media_url as string) : undefined,
        externalUrl: (created.external_url as string | null) || undefined,
        textContent: (created.text_content as string | null) || undefined,
        createdBy: (created.created_by as string | null) || undefined,
        createdAt: created.created_at as string,
        updatedAt: created.updated_at as string,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create content item' });
  }
});

quizzesRouter.get('/content/items', requireAuth, async (req: any, res) => {
  const parsedQuery = listLearningContentQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid content filters', errors: parsedQuery.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { class_level, subject, topic_id, search, limit } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = ['lc.organization_id = $1::uuid'];

  if (class_level) {
    params.push(class_level);
    whereClauses.push(`lc.class_level = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`lc.subject = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    whereClauses.push(`(lc.title ILIKE $${idx} OR COALESCE(lc.text_content, '') ILIKE $${idx})`);
  }
  if (topic_id) {
    params.push(topic_id);
    whereClauses.push(
      `EXISTS (SELECT 1 FROM topic_content_assignments tca WHERE tca.topic_id = $${params.length} AND tca.content_id = lc.id)`,
    );
  }
  params.push(limit);

  try {
    const result = await db.query(
      `SELECT
         lc.id,
         lc.class_level,
         lc.subject,
         lc.title,
         lc.content_type,
         lc.media_url,
         lc.external_url,
         lc.text_content,
         lc.created_by,
         lc.created_at,
         lc.updated_at,
         COALESCE(sec.count, 0)::int AS section_count,
         COALESCE(
           jsonb_agg(
             DISTINCT jsonb_build_object(
               'topicId', ct.id,
               'title', ct.title,
               'classLevel', ct.class_level,
               'subject', ct.subject
             )
           ) FILTER (WHERE ct.id IS NOT NULL),
           '[]'::jsonb
         ) AS assigned_topics
       FROM learning_contents lc
       LEFT JOIN (
         SELECT content_id, COUNT(*)::int AS count
         FROM learning_content_sections
         GROUP BY content_id
       ) sec ON sec.content_id = lc.id
       LEFT JOIN topic_content_assignments tca ON tca.content_id = lc.id
       LEFT JOIN content_topics ct ON ct.id = tca.topic_id AND ct.organization_id = lc.organization_id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY lc.id, sec.count
       ORDER BY lc.created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    const items = await Promise.all(
      result.rows.map(async (row) => ({
        id: row.id as string,
        classLevel: row.class_level as string,
        subject: row.subject as string,
        title: row.title as string,
        contentType: row.content_type as string,
        sectionCount: Number(row.section_count || 0),
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
        externalUrl: (row.external_url as string | null) || undefined,
        textContent: (row.text_content as string | null) || undefined,
        assignedTopics: (row.assigned_topics as Array<{ topicId: string; title: string; classLevel: string; subject: string }>) || [],
        createdBy: (row.created_by as string | null) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      })),
    );
    return res.json({ items });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to list content items' });
  }
});

quizzesRouter.get('/content/items/:contentId', requireAuth, async (req: any, res) => {
  const contentId = req.params.contentId as string;
  if (!contentId) return res.status(400).json({ message: 'Invalid content id' });
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const contentResult = await db.query(
      `SELECT id, class_level, subject, title, content_type, media_url, external_url, text_content, created_by, created_at, updated_at
       FROM learning_contents
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [contentId, orgId],
    );
    if ((contentResult.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Content item not found' });
    }
    const sectionsResult = await db.query(
      `SELECT id, section_order, title, content_type, media_url, external_url, text_content, created_at, updated_at
       FROM learning_content_sections
       WHERE content_id = $1
       ORDER BY section_order ASC`,
      [contentId],
    );
    let sections = await Promise.all(
      sectionsResult.rows.map(async (row) => ({
        id: row.id as string,
        sectionOrder: Number(row.section_order || 0),
        title: (row.title as string | null) || undefined,
        contentType: row.content_type as string,
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
        externalUrl: (row.external_url as string | null) || undefined,
        textContent: (row.text_content as string | null) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      })),
    );
    const row = contentResult.rows[0];
    if (sections.length === 0) {
      sections = [
        {
          id: row.id as string,
          sectionOrder: 1,
          title: undefined,
          contentType: row.content_type as string,
          mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
          externalUrl: (row.external_url as string | null) || undefined,
          textContent: (row.text_content as string | null) || undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        },
      ];
    }
    return res.json({
      id: row.id as string,
      classLevel: row.class_level as string,
      subject: row.subject as string,
      title: row.title as string,
      contentType: row.content_type as string,
      sectionCount: sections.length,
      mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
      externalUrl: (row.external_url as string | null) || undefined,
      textContent: (row.text_content as string | null) || undefined,
      sections,
      createdBy: (row.created_by as string | null) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch content item' });
  }
});

quizzesRouter.put('/content/items/:contentId', requireAuth, async (req: any, res) => {
  const contentId = req.params.contentId as string;
  const parsedBody = updateLearningContentSchema.safeParse(req.body);
  if (!contentId) {
    return res.status(400).json({ message: 'Invalid content id' });
  }
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid content payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { classLevel, subject, title } = parsedBody.data;
  const sections = normalizeLearningContentSections(parsedBody.data);
  if (sections.length === 0) {
    return res.status(400).json({ message: 'At least one valid section is required' });
  }

  try {
    const existing = await db.query(
      `SELECT id
       FROM learning_contents
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [contentId, orgId],
    );
    if ((existing.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Content item not found' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE learning_contents
         SET class_level = $1,
             subject = $2,
             title = $3,
             content_type = $4,
             media_url = $5,
             external_url = $6,
             text_content = $7,
             updated_at = NOW()
         WHERE id = $8
           AND organization_id = $9::uuid
         RETURNING id, class_level, subject, title, content_type, media_url, external_url, text_content, created_by, created_at, updated_at`,
        [
          classLevel,
          subject,
          title,
          sections.length > 1 ? 'multi_section' : sections[0].contentType,
          sections[0].mediaUrl,
          sections[0].externalUrl,
          sections[0].textContent,
          contentId,
          orgId,
        ],
      );
      await client.query(`DELETE FROM learning_content_sections WHERE content_id = $1`, [contentId]);
      for (let i = 0; i < sections.length; i += 1) {
        const section = sections[i];
        await client.query(
          `INSERT INTO learning_content_sections (content_id, section_order, title, content_type, media_url, external_url, text_content)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [contentId, i + 1, section.title?.trim() || null, section.contentType, section.mediaUrl ? toPersistentMediaUrl(section.mediaUrl) : null, section.externalUrl || null, section.textContent || null],
        );
      }
      await client.query('COMMIT');
      const row = updated.rows[0];
      return res.json({
        id: row.id as string,
        classLevel: row.class_level as string,
        subject: row.subject as string,
        title: row.title as string,
        contentType: row.content_type as string,
        sectionCount: sections.length,
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
        externalUrl: (row.external_url as string | null) || undefined,
        textContent: (row.text_content as string | null) || undefined,
        createdBy: (row.created_by as string | null) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update content item' });
  }
});

quizzesRouter.delete('/content/items/:contentId', requireAuth, async (req: any, res) => {
  const contentId = req.params.contentId as string;
  if (!contentId) {
    return res.status(400).json({ message: 'Invalid content id' });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const result = await db.query(
      `DELETE FROM learning_contents
       WHERE id = $1
         AND organization_id = $2::uuid`,
      [contentId, orgId],
    );
    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Content item not found' });
    }
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to delete content item' });
  }
});

quizzesRouter.get('/content/topics/:topicId/assignments', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const topicCheck = await db.query(
      `SELECT 1 FROM content_topics WHERE id = $1 AND organization_id = $2::uuid LIMIT 1`,
      [topicId, orgId],
    );
    if ((topicCheck.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const result = await db.query(
      `SELECT content_id
       FROM topic_content_assignments
       WHERE topic_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [topicId],
    );
    return res.json({ contentIds: result.rows.map((row) => row.content_id as string) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch topic assignments' });
  }
});

quizzesRouter.put('/content/topics/:topicId/assignments', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  const parsedBody = updateTopicAssignmentsSchema.safeParse(req.body);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid assignment payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId;
  if (!orgId || !userId) {
    return res.status(400).json({ message: 'Organization/user not found in auth context' });
  }

  try {
    const permission = await ensureTopicEditPermission(topicId, orgId, userId, req);
    if (!permission.exists) return res.status(404).json({ message: 'Topic not found' });
    if (!permission.allowed) return res.status(403).json({ message: 'Forbidden: not allowed to update this topic' });

    const uniqueIds = [...new Set(parsedBody.data.contentIds)];
    if (uniqueIds.length > 0) {
      const validateResult = await db.query(
        `SELECT COUNT(*)::int AS count
         FROM learning_contents
         WHERE organization_id = $1::uuid
           AND id = ANY($2::uuid[])`,
        [orgId, uniqueIds],
      );
      if (Number(validateResult.rows[0]?.count || 0) !== uniqueIds.length) {
        return res.status(400).json({ message: 'One or more selected content items are invalid' });
      }
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM topic_content_assignments WHERE topic_id = $1`, [topicId]);
      for (let i = 0; i < uniqueIds.length; i += 1) {
        await client.query(
          `INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
           VALUES ($1, $2, $3)`,
          [topicId, uniqueIds[i], i + 1],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return res.json({ topicId, contentIds: uniqueIds });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update topic assignments' });
  }
});

quizzesRouter.post('/attempts', requireAuth, async (req: any, res) => {
  const parsed = recordAttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const { quizId, score, totalPoints, questionAttempts } = parsed.data;
  const studentId = req.user.userId;
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const quizExists = await db.query(
      `SELECT 1 FROM quizzes WHERE id = $1 AND organization_id = $2::uuid`,
      [quizId, orgId],
    );
    if ((quizExists.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    await db.query('BEGIN');

    const attemptResult = await db.query(
      `INSERT INTO student_attempts (student_id, quiz_id, score, total_points)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [studentId, quizId, score, totalPoints],
    );
    const attemptId = attemptResult.rows[0].id;

    for (const qAttempt of questionAttempts) {
      await db.query(
        `INSERT INTO question_attempts (attempt_id, question_id, is_correct, response_data, time_spent_seconds)
         VALUES ($1, $2, $3, $4, $5)`,
        [attemptId, qAttempt.questionId, qAttempt.isCorrect, qAttempt.responseData || {}, qAttempt.timeSpentSeconds || null],
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

// --- Quiz-Topic Assignment Endpoints ---

// GET quizzes assigned to a topic
quizzesRouter.get('/content/topics/:topicId/quizzes', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  if (!topicId) return res.status(400).json({ message: 'Invalid topic id' });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const result = await db.query(
      `SELECT id, title, quiz_type, class_level, subject, is_published, total_questions, created_at
       FROM quizzes
       WHERE organization_id = $1::uuid AND topic_id = $2
       ORDER BY created_at DESC`,
      [orgId, topicId],
    );
    return res.json({ quizzes: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch topic quizzes' });
  }
});

// PUT assign a quiz to a topic (pass quizId to assign, null to unassign)
quizzesRouter.put('/content/topics/:topicId/quizzes/:quizId', requireAuth, async (req: any, res) => {
  const { topicId, quizId } = req.params;
  if (!topicId || !quizId) return res.status(400).json({ message: 'Invalid topic or quiz id' });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    // Verify topic belongs to org
    const topicCheck = await db.query(
      `SELECT 1 FROM content_topics WHERE id = $1 AND organization_id = $2::uuid LIMIT 1`,
      [topicId, orgId],
    );
    if ((topicCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Topic not found' });

    // Verify quiz belongs to org
    const quizCheck = await db.query(
      `SELECT 1 FROM quizzes WHERE id = $1 AND organization_id = $2::uuid LIMIT 1`,
      [quizId, orgId],
    );
    if ((quizCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Quiz not found' });

    await db.query(`UPDATE quizzes SET topic_id = $1, updated_at = NOW() WHERE id = $2`, [topicId, quizId]);
    return res.json({ message: 'Quiz assigned to topic successfully', topicId, quizId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to assign quiz to topic' });
  }
});

quizzesRouter.put('/content/topics/:topicId/quizzes', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  const parsedBody = updateTopicQuizAssignmentsSchema.safeParse(req.body);
  if (!topicId) return res.status(400).json({ message: 'Invalid topic id' });
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid quiz assignment payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  const uniqueQuizIds = [...new Set(parsedBody.data.quizIds)];

  try {
    const topicCheck = await db.query(
      `SELECT 1 FROM content_topics WHERE id = $1 AND organization_id = $2::uuid LIMIT 1`,
      [topicId, orgId],
    );
    if ((topicCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Topic not found' });

    if (uniqueQuizIds.length > 0) {
      const validQuizCount = await db.query(
        `SELECT COUNT(*)::int AS count
         FROM quizzes
         WHERE organization_id = $1::uuid
           AND id = ANY($2::uuid[])`,
        [orgId, uniqueQuizIds],
      );
      if (Number(validQuizCount.rows[0]?.count || 0) !== uniqueQuizIds.length) {
        return res.status(400).json({ message: 'One or more quizzes are invalid' });
      }
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      if (uniqueQuizIds.length > 0) {
        await client.query(
          `UPDATE quizzes
           SET topic_id = NULL, updated_at = NOW()
           WHERE organization_id = $1::uuid
             AND topic_id = $2
             AND NOT (id = ANY($3::uuid[]))`,
          [orgId, topicId, uniqueQuizIds],
        );
        await client.query(
          `UPDATE quizzes
           SET topic_id = $1, updated_at = NOW()
           WHERE organization_id = $2::uuid
             AND id = ANY($3::uuid[])`,
          [topicId, orgId, uniqueQuizIds],
        );
      } else {
        await client.query(
          `UPDATE quizzes
           SET topic_id = NULL, updated_at = NOW()
           WHERE organization_id = $1::uuid
             AND topic_id = $2`,
          [orgId, topicId],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return res.json({ topicId, quizIds: uniqueQuizIds });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update topic quiz assignments' });
  }
});

// DELETE unassign a quiz from a topic
quizzesRouter.delete('/content/topics/:topicId/quizzes/:quizId', requireAuth, async (req: any, res) => {
  const { quizId } = req.params;
  if (!quizId) return res.status(400).json({ message: 'Invalid quiz id' });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    await db.query(
      `UPDATE quizzes SET topic_id = NULL, updated_at = NOW() WHERE id = $1 AND organization_id = $2::uuid`,
      [quizId, orgId],
    );
    return res.json({ message: 'Quiz unassigned from topic successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to unassign quiz from topic' });
  }
});
