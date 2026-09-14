import { sseHub } from "../events/sseHub.js";
import { logger } from "../utils/logger.js";
import { generatorByType } from "./generators/index.js";
import { jobStore } from "./jobStore.js";
import { contentRepo } from "./contentRepo.js";
import { validateGeneratedContent } from "./validators/contentValidator.js";
import { PIPELINE_STEPS, validateParamsForType, type GenerationJob, type StepKey } from "./types.js";

function emitStepStart(job: GenerationJob, step: StepKey) {
  const meta = PIPELINE_STEPS.find((s) => s.key === step)!;
  const label = meta.label.replace("{contentType}", job.contentType);
  jobStore.update(job.id, { status: "running", currentStep: step });
  sseHub.publish(job.id, { event: "step_start", jobId: job.id, step, label });
}

function emitStepComplete(job: GenerationJob, step: StepKey) {
  sseHub.publish(job.id, { event: "step_complete", jobId: job.id, step });
}

/**
 * Runs one job end to end. Intentionally sequential and awaited (not
 * fire-and-forget from the caller) so callers can decide whether to run it
 * inline or hand it to a queue later without changing this function.
 */
export async function runGenerationJob(job: GenerationJob): Promise<void> {
  try {
    // 1. gathering_information — params are already validated by the route,
    // this step exists mainly so the UI shows a consistent first beat while
    // we do any last enrichment (e.g. looking up classroom context).
    emitStepStart(job, "gathering_information");
    const params = validateParamsForType(job.contentType, job.params);
    await sleep(300);
    emitStepComplete(job, "gathering_information");

    // 2. creating_entity — placeholder entity row could be created here if
    // the real content DB needs a pre-created row to attach content to.
    emitStepStart(job, "creating_entity");
    await sleep(200);
    emitStepComplete(job, "creating_entity");

    // 3. adding_content — the actual LLM generation call.
    emitStepStart(job, "adding_content");
    const generator = generatorByType[job.contentType];
    const result = await generator(params);
    emitStepComplete(job, "adding_content");

    // 4. validating_context — structural/consistency checks on the output.
    emitStepStart(job, "validating_context");
    const issues = validateGeneratedContent(job.contentType, result.data);
    if (issues.length > 0) {
      throw Object.assign(
        new Error(`Generated content failed validation: ${issues.map((i) => i.message).join("; ")}`),
        { issues },
      );
    }
    await sleep(150);
    emitStepComplete(job, "validating_context");

    // 5. finalizing — persist and mark the job complete.
    emitStepStart(job, "finalizing");
    contentRepo.save({
      contentId: result.contentId,
      contentType: job.contentType,
      name: result.name,
      ownerId: job.userId,
      data: result.data,
      createdAt: new Date().toISOString(),
    });
    emitStepComplete(job, "finalizing");

    jobStore.update(job.id, {
      status: "completed",
      currentStep: null,
      result: { contentId: result.contentId, name: result.name, preview: result.preview, data: result.data },
    });
    sseHub.publish(job.id, {
      event: "job_completed",
      jobId: job.id,
      contentId: result.contentId,
      name: result.name,
      preview: result.preview,
      data: result.data,
    });
  } catch (err) {
    const message = (err as Error).message ?? "Generation failed";
    logger.error("generation_job_failed", { jobId: job.id, message });
    jobStore.update(job.id, { status: "failed", currentStep: null, error: message });
    sseHub.publish(job.id, { event: "job_failed", jobId: job.id, error: message });
  } finally {
    // Give the client a moment to receive the final event before the
    // stream closes.
    setTimeout(() => sseHub.closeAll(job.id), 2000);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
