import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { newJobId } from "../utils/ids.js";
import { jobStore } from "../generation/jobStore.js";
import { sseHub } from "../events/sseHub.js";
import { runGenerationJob } from "../generation/pipeline.js";
import { runRevisionJob } from "../generation/revise.js";
import { contentRepo } from "../generation/contentRepo.js";
import { ContentType, validateParamsForType, type GenerationJob } from "../generation/types.js";

export const generationRouter = Router();

const StartRequest = z.object({
  conversationId: z.string(),
  contentType: ContentType,
  title: z.string(),
  params: z.record(z.string(), z.unknown()),
});

/** Called when the user taps "Generate" on a proposal card. */
generationRouter.post("/start", async (req, res, next) => {
  try {
    const body = StartRequest.parse(req.body);
    const userId = req.user!.userId;

    if (jobStore.countActiveForUser(userId) >= env.MAX_CONCURRENT_JOBS_PER_USER) {
      res.status(429).json({ error: "Too many generations already in progress" });
      return;
    }

    validateParamsForType(body.contentType, body.params); // 400s via errorHandler on failure

    const job: GenerationJob = {
      id: newJobId(),
      userId,
      conversationId: body.conversationId,
      contentType: body.contentType,
      title: body.title,
      params: body.params,
      status: "pending",
      currentStep: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    jobStore.create(job);
    void runGenerationJob(job);

    res.status(202).json({ jobId: job.id });
  } catch (err) {
    next(err);
  }
});

const ReviseRequest = z.object({
  conversationId: z.string(),
  contentId: z.string(),
  instruction: z.string().min(1),
});

/** Called when the user asks for a change to something already generated. */
generationRouter.post("/revise", async (req, res, next) => {
  try {
    const body = ReviseRequest.parse(req.body);
    const userId = req.user!.userId;
    const existing = contentRepo.get(body.contentId);

    if (!existing || existing.ownerId !== userId) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const job: GenerationJob = {
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
  } catch (err) {
    next(err);
  }
});

/** SSE stream of step_start / step_complete / job_completed / job_failed events. */
generationRouter.get("/stream/:jobId", (req, res) => {
  const job = jobStore.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  sseHub.subscribe(req.params.jobId, res);
});

/** Fallback polling endpoint for clients that can't hold an SSE connection. */
generationRouter.get("/:jobId", (req, res) => {
  const job = jobStore.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});
