import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, canManage } from '../middleware/auth.js';
import { StoryStore, toStoryDto } from '../services/store.js';
import { eventBus } from '../events/bus.js';
import { db } from '../db.js';
import { endLiveStoriesForClass } from '../scheduler.js';
/** Returns dates (YYYY-MM-DD) that already have a live or scheduled story for a given org+class */
async function getOccupiedDays(orgId, classLevel) {
    const classFilter = classLevel
        ? `AND (class_level = $2 OR class_level IS NULL)`
        : '';
    const params = [orgId];
    if (classLevel)
        params.push(classLevel);
    const result = await db.query(`SELECT DISTINCT to_char(COALESCE(published_at, scheduled_at), 'YYYY-MM-DD') AS day
       FROM stories
      WHERE organization_id = $1::uuid
        AND status IN ('live', 'scheduled')
        AND COALESCE(published_at, scheduled_at) IS NOT NULL
        ${classFilter}`, params);
    return result.rows.map((r) => r.day).filter(Boolean);
}
export const storiesRouter = Router();
function getOrgId(req) {
    return req.user?.organizationId || null;
}
function getUserId(req) {
    return req.user?.userId || null;
}
function getClassLevel(req) {
    return req.user?.classLevel || null;
}
const mediaSchema = z.array(z.object({
    kind: z.enum(['image', 'video', 'audio']),
    url: z.string(),
    caption: z.string().optional(),
})).default([]);
const createStorySchema = z.object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().optional().nullable(),
    coverImageUrl: z.string().trim().optional().nullable(),
    classLevel: z.string().trim().optional().nullable(),
});
const updateStorySchema = z.object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().nullable().optional(),
    coverImageUrl: z.string().trim().nullable().optional(),
    classLevel: z.string().trim().nullable().optional(),
});
const scheduleStorySchema = z.object({
    scheduledAt: z.string().datetime(),
});
const sectionCreateSchema = z.object({
    title: z.string().trim().min(1).max(255),
    bodyText: z.string().optional().nullable(),
    media: mediaSchema,
    quizId: z.string().uuid().optional().nullable(),
    orderIndex: z.number().int().optional(),
});
const sectionUpdateSchema = sectionCreateSchema.partial();
const progressSchema = z.object({
    sectionId: z.string().uuid().optional(),
    completed: z.boolean().optional(),
});
storiesRouter.get('/', requireAuth, async (req, res) => {
    const orgId = getOrgId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Org missing' });
    const status = req.query.status ? String(req.query.status) : undefined;
    let classLevel = req.query.class_level ? String(req.query.class_level) : undefined;
    if (!canManage(req)) {
        classLevel = classLevel || getClassLevel(req) || undefined;
    }
    const limit = req.query.limit ? Math.min(Number(req.query.limit) || 20, 100) : 20;
    const offset = req.query.offset ? Number(req.query.offset) || 0 : 0;
    const { items, total } = await StoryStore.listForOrg(orgId, { status, classLevel, limit, offset });
    return res.json({ stories: items, total, limit, offset });
});
storiesRouter.get('/scheduled-days', requireAuth, async (req, res) => {
    const orgId = getOrgId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Org missing' });
    const classLevel = req.query.class_level ? String(req.query.class_level) : null;
    const days = await getOccupiedDays(orgId, classLevel);
    return res.json({ occupiedDays: days });
});
storiesRouter.get('/home/feed', requireAuth, async (req, res) => {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId)
        return res.status(400).json({ message: 'Auth missing' });
    const classLevel = canManage(req) ? undefined : (getClassLevel(req) || undefined);
    const [liveRes, scheduledRes, prevRes] = await Promise.all([
        StoryStore.listForOrg(orgId, { status: 'live', classLevel, limit: 1 }),
        StoryStore.listForOrg(orgId, { status: 'scheduled', classLevel, limit: 5 }),
        StoryStore.listForOrg(orgId, { status: 'ended', classLevel, limit: 6 }),
    ]);
    const live = liveRes.items[0] || null;
    const nextScheduled = scheduledRes.items
        .filter((s) => s.scheduledAt)
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0] || null;
    const previous = prevRes.items;
    let progress = null;
    if (live) {
        progress = await StoryStore.getProgress(userId, live.id);
    }
    return res.json({ live, nextScheduled, previous, progress });
});
storiesRouter.get('/:id', requireAuth, async (req, res) => {
    const orgId = getOrgId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Org missing' });
    const story = await StoryStore.getById(orgId, req.params.id);
    if (!story)
        return res.status(404).json({ message: 'Story not found' });
    const sections = await StoryStore.listSections(story.id);
    return res.json({ story: toStoryDto(story), sections });
});
storiesRouter.post('/', requireAuth, async (req, res) => {
    if (!canManage(req))
        return res.status(403).json({ message: 'Forbidden' });
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId)
        return res.status(400).json({ message: 'Auth missing' });
    const parsed = createStorySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    const row = await StoryStore.create({ orgId, userId, ...parsed.data });
    return res.status(201).json({ story: toStoryDto(row) });
});
storiesRouter.patch('/:id', requireAuth, async (req, res) => {
    if (!canManage(req))
        return res.status(403).json({ message: 'Forbidden' });
    const orgId = getOrgId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Org missing' });
    const parsed = updateStorySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    const row = await StoryStore.update(orgId, req.params.id, parsed.data);
    if (!row)
        return res.status(404).json({ message: 'Story not found' });
    return res.json({ story: toStoryDto(row) });
});
storiesRouter.patch('/:id/schedule', requireAuth, async (req, res) => {
    if (!canManage(req))
        return res.status(403).json({ message: 'Forbidden' });
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId)
        return res.status(400).json({ message: 'Auth missing' });
    const parsed = scheduleStorySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid schedule', errors: parsed.error.issues });
    const ms = new Date(parsed.data.scheduledAt).getTime();
    if (Number.isNaN(ms) || ms <= Date.now())
        return res.status(400).json({ message: 'Scheduled time must be in the future' });
    // Check that this class has no other story on the same day
    const story = await StoryStore.getById(orgId, req.params.id);
    if (!story)
        return res.status(404).json({ message: 'Story not found' });
    const targetDay = new Date(parsed.data.scheduledAt).toISOString().slice(0, 10);
    const occupied = await getOccupiedDays(orgId, story.class_level);
    const conflict = occupied.filter((d) => d === targetDay && true);
    // Allow the same story to keep its own day
    if (conflict.length > 0) {
        const selfCheck = await db.query(`SELECT id FROM stories WHERE organization_id = $1::uuid AND status IN ('live','scheduled')
         AND to_char(COALESCE(published_at, scheduled_at), 'YYYY-MM-DD') = $2
         AND id <> $3::uuid AND (class_level = $4 OR ($4::text IS NULL AND class_level IS NULL))`, [orgId, targetDay, req.params.id, story.class_level]);
        if ((selfCheck.rowCount ?? 0) > 0) {
            return res.status(409).json({ message: `Another story for this class is already scheduled or live on ${targetDay}. Pick a different day.` });
        }
    }
    const row = await StoryStore.update(orgId, req.params.id, { scheduledAt: parsed.data.scheduledAt, status: 'scheduled' });
    if (!row)
        return res.status(404).json({ message: 'Story not found' });
    try {
        await eventBus.publish({
            type: 'story.scheduled',
            source: 'story-service',
            organizationId: orgId,
            userId,
            payload: { storyId: row.id, title: row.title, scheduledAt: row.scheduled_at, classLevel: row.class_level },
        });
    }
    catch (err) {
        console.error('[story-service] publish failed', err);
    }
    return res.json({ story: toStoryDto(row) });
});
storiesRouter.patch('/:id/publish', requireAuth, async (req, res) => {
    if (!canManage(req))
        return res.status(403).json({ message: 'Forbidden' });
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId)
        return res.status(400).json({ message: 'Auth missing' });
    // Get story to know its class_level, then end live stories for same class only
    const storyToPublish = await StoryStore.getById(orgId, req.params.id);
    if (!storyToPublish)
        return res.status(404).json({ message: 'Story not found' });
    // Check: is today already occupied by another story for this class?
    const todayDay = new Date().toISOString().slice(0, 10);
    const selfCheck = await db.query(`SELECT id FROM stories WHERE organization_id = $1::uuid AND status IN ('live','scheduled')
       AND to_char(COALESCE(published_at, scheduled_at), 'YYYY-MM-DD') = $2
       AND id <> $3::uuid AND (class_level = $4 OR ($4::text IS NULL AND class_level IS NULL))`, [orgId, todayDay, req.params.id, storyToPublish.class_level]);
    if ((selfCheck.rowCount ?? 0) > 0) {
        return res.status(409).json({ message: `Another story for this class is already live or scheduled for today. End it first or schedule for a different day.` });
    }
    await endLiveStoriesForClass(orgId, storyToPublish.class_level, req.params.id);
    const result = await db.query(`UPDATE stories SET status = 'live', scheduled_at = NULL, published_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid AND organization_id = $2::uuid RETURNING *`, [req.params.id, orgId]);
    if (!result.rowCount)
        return res.status(404).json({ message: 'Story not found' });
    const row = result.rows[0];
    try {
        await eventBus.publish({
            type: 'story.live', source: 'story-service', organizationId: orgId, userId,
            payload: { storyId: row.id, title: row.title, classLevel: row.class_level },
        });
    }
    catch (err) {
        console.error('[story-service] publish failed', err);
    }
    return res.json({ story: toStoryDto(row) });
});
storiesRouter.patch('/:id/end', requireAuth, async (req, res) => {
    if (!canManage(req))
        return res.status(403).json({ message: 'Forbidden' });
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId)
        return res.status(400).json({ message: 'Auth missing' });
    const row = await StoryStore.update(orgId, req.params.id, { status: 'ended', endedAt: new Date().toISOString() });
    if (!row)
        return res.status(404).json({ message: 'Story not found' });
    try {
        await eventBus.publish({
            type: 'story.ended', source: 'story-service', organizationId: orgId, userId,
            payload: { storyId: row.id, title: row.title },
        });
    }
    catch (err) {
        console.error('[story-service] publish failed', err);
    }
    return res.json({ story: toStoryDto(row) });
});
storiesRouter.delete('/:id', requireAuth, async (req, res) => {
    if (!canManage(req))
        return res.status(403).json({ message: 'Forbidden' });
    const orgId = getOrgId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Org missing' });
    const ok = await StoryStore.delete(orgId, req.params.id);
    if (!ok)
        return res.status(404).json({ message: 'Story not found' });
    return res.json({ deleted: true });
});
storiesRouter.get('/:id/sections', requireAuth, async (req, res) => {
    const orgId = getOrgId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Org missing' });
    const story = await StoryStore.getById(orgId, req.params.id);
    if (!story)
        return res.status(404).json({ message: 'Story not found' });
    const sections = await StoryStore.listSections(story.id);
    return res.json({ sections });
});
storiesRouter.post('/:id/sections', requireAuth, async (req, res) => {
    if (!canManage(req))
        return res.status(403).json({ message: 'Forbidden' });
    const orgId = getOrgId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Org missing' });
    const story = await StoryStore.getById(orgId, req.params.id);
    if (!story)
        return res.status(404).json({ message: 'Story not found' });
    const parsed = sectionCreateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    const section = await StoryStore.createSection(story.id, parsed.data);
    if (parsed.data.quizId) {
        await db.query(`UPDATE quizzes SET kind = 'story' WHERE id = $1::uuid`, [parsed.data.quizId]);
    }
    return res.status(201).json({ section });
});
storiesRouter.patch('/:id/sections/:sectionId', requireAuth, async (req, res) => {
    if (!canManage(req))
        return res.status(403).json({ message: 'Forbidden' });
    const orgId = getOrgId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Org missing' });
    const story = await StoryStore.getById(orgId, req.params.id);
    if (!story)
        return res.status(404).json({ message: 'Story not found' });
    const parsed = sectionUpdateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    const section = await StoryStore.updateSection(req.params.sectionId, story.id, parsed.data);
    if (!section)
        return res.status(404).json({ message: 'Section not found' });
    if (parsed.data.quizId) {
        await db.query(`UPDATE quizzes SET kind = 'story' WHERE id = $1::uuid`, [parsed.data.quizId]);
    }
    return res.json({ section });
});
storiesRouter.delete('/:id/sections/:sectionId', requireAuth, async (req, res) => {
    if (!canManage(req))
        return res.status(403).json({ message: 'Forbidden' });
    const orgId = getOrgId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Org missing' });
    const story = await StoryStore.getById(orgId, req.params.id);
    if (!story)
        return res.status(404).json({ message: 'Story not found' });
    const ok = await StoryStore.deleteSection(req.params.sectionId, story.id);
    if (!ok)
        return res.status(404).json({ message: 'Section not found' });
    return res.json({ deleted: true });
});
storiesRouter.get('/:id/progress', requireAuth, async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(400).json({ message: 'User missing' });
    const progress = await StoryStore.getProgress(userId, req.params.id);
    return res.json({ progress });
});
storiesRouter.post('/:id/progress', requireAuth, async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(400).json({ message: 'User missing' });
    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    const existing = await StoryStore.getProgress(userId, req.params.id);
    const completedSet = new Set(existing?.completed_section_ids || []);
    if (parsed.data.sectionId)
        completedSet.add(parsed.data.sectionId);
    const result = await StoryStore.upsertProgress(userId, req.params.id, {
        currentSectionId: parsed.data.sectionId ?? null,
        completedSectionIds: Array.from(completedSet),
        completed: !!parsed.data.completed,
    });
    return res.json({ progress: result });
});
