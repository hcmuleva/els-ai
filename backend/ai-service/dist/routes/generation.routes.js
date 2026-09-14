import { Router } from "express";
import { z } from "zod";
import { newJobId } from "../utils/ids.js";
import { jobStore } from "../generation/jobStore.js";
import { sseHub } from "../events/sseHub.js";
import { runGenerationJob } from "../generation/pipeline.js";
import { runRevisionJob } from "../generation/revise.js";
import { contentRepo } from "../generation/contentRepo.js";
import { ContentType, validateParamsForType } from "../generation/types.js";
import { requireAuth } from "../middleware/auth.js";
import { generateEntityRevision, updateLiveEntity, } from "../services/coreApiBridge.js";
export const generationRouter = Router();
const StartRequest = z.object({
    conversationId: z.string(),
    contentType: ContentType,
    title: z.string(),
    params: z.record(z.string(), z.unknown()),
});
/**
 * Called when the user clicks "Generate" on an AI proposal card.
 */
generationRouter.post("/start", requireAuth, async (req, res) => {
    try {
        const body = StartRequest.parse(req.body);
        const userId = req.user?.userId || req.user?.id || 'anonymous_user';
        const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_JOBS_PER_USER || '5', 10);
        if (jobStore.countActiveForUser(userId) >= maxConcurrent) {
            res.status(429).json({ error: "Too many generations already in progress" });
            return;
        }
        const normalizedParams = {
            ...body.params,
            topic: body.params.topic || body.params.title || body.title,
            title: body.params.title || body.title,
            gradeLevel: body.params.gradeLevel !== undefined ? String(body.params.gradeLevel) : '',
        };
        const validatedParams = validateParamsForType(body.contentType, normalizedParams);
        const job = {
            id: newJobId(),
            userId,
            conversationId: body.conversationId,
            contentType: body.contentType,
            title: body.title,
            params: validatedParams,
            status: "pending",
            currentStep: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        jobStore.create(job);
        // Run generation in the background while client listens over SSE
        void runGenerationJob(job);
        res.status(202).json({ jobId: job.id });
    }
    catch (err) {
        res.status(400).json({ error: err.message || "Failed to start generation job" });
    }
});
const ReviseRequest = z.object({
    conversationId: z.string(),
    contentId: z.string(),
    instruction: z.string().min(1),
});
/**
 * Called when the user asks for a change to something already generated.
 */
generationRouter.post("/revise", requireAuth, async (req, res) => {
    try {
        const body = ReviseRequest.parse(req.body);
        const userId = req.user?.userId || req.user?.id || 'anonymous_user';
        const existing = contentRepo.get(body.contentId);
        if (!existing || (existing.ownerId !== userId && existing.ownerId !== 'anonymous_user')) {
            res.status(404).json({ error: "Content not found" });
            return;
        }
        const job = {
            id: newJobId(),
            userId,
            conversationId: body.conversationId,
            contentType: existing.contentType,
            title: existing.name,
            params: {},
            status: "pending",
            currentStep: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        jobStore.create(job);
        void runRevisionJob(job, body.contentId, body.instruction);
        res.status(202).json({ jobId: job.id });
    }
    catch (err) {
        res.status(400).json({ error: err.message || "Failed to start revision job" });
    }
});
/**
 * SSE stream of step_start / step_complete / job_completed / job_failed events.
 */
generationRouter.get("/stream/:jobId", (req, res) => {
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    const job = jobStore.get(jobId);
    if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
    }
    sseHub.subscribe(job.id, res);
    // If the job already finished or failed before the client connected, emit its final state immediately
    if (job.status === "completed" && job.result) {
        sseHub.publish(job.id, {
            event: "job_completed",
            jobId: job.id,
            contentId: job.result.contentId,
            name: job.result.name,
            preview: job.result.preview,
            data: job.result.data,
        });
        setTimeout(() => sseHub.closeAll(job.id), 1000);
    }
    else if (job.status === "failed") {
        sseHub.publish(job.id, {
            event: "job_failed",
            jobId: job.id,
            error: job.error ?? "Job failed",
        });
        setTimeout(() => sseHub.closeAll(job.id), 1000);
    }
});
/**
 * Fetch full generated content by contentId.
 */
generationRouter.get("/content/:contentId", requireAuth, (req, res) => {
    const contentId = Array.isArray(req.params.contentId) ? req.params.contentId[0] : req.params.contentId;
    const item = contentRepo.get(contentId);
    if (!item) {
        res.status(404).json({ error: "Content not found" });
        return;
    }
    res.json(item);
});
/**
 * Find completed generation job by conversationId and title/contentType.
 */
generationRouter.get("/find", requireAuth, (req, res) => {
    const conversationId = String(req.query.conversationId || "");
    const title = String(req.query.title || "");
    const contentType = String(req.query.contentType || "");
    if (!conversationId) {
        res.status(400).json({ error: "conversationId is required" });
        return;
    }
    const job = jobStore.findByConversationAndTitle(conversationId, title, contentType);
    if (!job || !job.result) {
        res.status(404).json({ found: false });
        return;
    }
    res.json({
        found: true,
        jobId: job.id,
        contentId: job.result.contentId,
        name: job.result.name,
        preview: job.result.preview,
        data: job.result.data,
    });
});
/**
 * Pollable fallback endpoint if SSE is unsupported or disconnected.
 */
generationRouter.get("/status/:jobId", requireAuth, (req, res) => {
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    const job = jobStore.get(jobId);
    if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
    }
    res.json(job);
});
const EntityPreviewRequest = z.object({
    entityType: z.enum(["question", "content", "topic", "quiz"]),
    entityId: z.string(),
    instruction: z.string(),
});
const EntityApplyRequest = z.object({
    entityType: z.enum(["question", "content", "topic", "quiz"]),
    entityId: z.string(),
    payload: z.unknown(),
});
/**
 * Preview AI-generated changes for an existing database entity.
 */
generationRouter.post("/entity-preview", requireAuth, async (req, res) => {
    try {
        const { entityType, entityId, instruction } = EntityPreviewRequest.parse(req.body);
        const result = await generateEntityRevision(entityType, entityId, instruction, req.headers.authorization);
        res.json({ success: true, result });
    }
    catch (err) {
        res.status(400).json({ error: err.message || "Failed to preview entity revision" });
    }
});
/**
 * Apply AI-approved changes directly to the platform database.
 */
generationRouter.post("/entity-apply", requireAuth, async (req, res) => {
    try {
        const { entityType, entityId, payload } = EntityApplyRequest.parse(req.body);
        const result = await updateLiveEntity(entityType, entityId, payload, req.headers.authorization);
        res.json({ success: true, result });
    }
    catch (err) {
        res.status(400).json({ error: err.message || "Failed to apply entity revision" });
    }
});
