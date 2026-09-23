import { sseHub } from "../events/sseHub.js";
import { logger } from "../utils/logger.js";
import { generateJson } from "../services/llmClient.js";
import { contentRepo } from "./contentRepo.js";
import { jobStore } from "./jobStore.js";
import { validateGeneratedContent } from "./validators/contentValidator.js";
const REVISE_STEPS = [
    { key: "gathering_information", label: "Reading your feedback" },
    { key: "adding_content", label: "Applying changes" },
    { key: "validating_context", label: "Validating context" },
    { key: "finalizing", label: "Finalizing" },
];
/**
 * Revises an already-generated, already-persisted piece of content based on
 * a free-text instruction from the chat ("make question 3 harder", "shorten
 * the story", "add two more MCQs"). Reuses the same job/SSE machinery as a
 * fresh generation so the frontend's step-list UI works unchanged.
 */
export async function runRevisionJob(job, contentId, instruction) {
    const existing = contentRepo.get(contentId);
    if (!existing) {
        sseHub.publish(job.id, { event: "job_failed", jobId: job.id, error: "Content not found" });
        return;
    }
    try {
        for (const step of REVISE_STEPS) {
            jobStore.update(job.id, { status: "running", currentStep: step.key });
            sseHub.publish(job.id, { event: "step_start", jobId: job.id, step: step.key, label: step.label });
            if (step.key === "adding_content") {
                const revised = await generateJson({
                    system: "You are revising an existing piece of educational content. Reply with ONLY the " +
                        "full updated JSON object, in the same shape as the current data — do not add commentary.",
                    prompt: [
                        `Content type: ${existing.contentType}`,
                        `Current data: ${JSON.stringify(existing.data)}`,
                        `Requested change: ${instruction}`,
                    ].join("\n\n"),
                    maxTokens: 4000,
                });
                const issues = validateGeneratedContent(existing.contentType, revised);
                if (issues.length > 0) {
                    throw new Error(`Revision failed validation: ${issues.map((i) => i.message).join("; ")}`);
                }
                contentRepo.save({ ...existing, data: revised });
            }
            await new Promise((r) => setTimeout(r, 150));
            sseHub.publish(job.id, { event: "step_complete", jobId: job.id, step: step.key });
        }
        const updated = contentRepo.get(contentId);
        jobStore.update(job.id, {
            status: "completed",
            currentStep: null,
            result: { contentId, name: updated.name, preview: updated.data },
        });
        sseHub.publish(job.id, {
            event: "job_completed",
            jobId: job.id,
            contentId,
            name: updated.name,
            preview: updated.data,
        });
    }
    catch (err) {
        const message = err.message ?? "Revision failed";
        logger.error("revision_job_failed", { jobId: job.id, contentId, message });
        jobStore.update(job.id, { status: "failed", currentStep: null, error: message });
        sseHub.publish(job.id, { event: "job_failed", jobId: job.id, error: message });
    }
    finally {
        setTimeout(() => sseHub.closeAll(job.id), 2000);
    }
}
