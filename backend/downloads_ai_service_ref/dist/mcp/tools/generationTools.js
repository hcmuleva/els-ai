import { z } from "zod";
import { newJobId } from "../../utils/ids.js";
import { jobStore } from "../../generation/jobStore.js";
import { contentRepo } from "../../generation/contentRepo.js";
import { runGenerationJob } from "../../generation/pipeline.js";
import { runRevisionJob } from "../../generation/revise.js";
import { ContentType, validateParamsForType } from "../../generation/types.js";
/**
 * These wrap the exact same functions the REST routes call
 * (routes/generation.routes.ts) so behavior never drifts between "agent
 * calls the tool directly via MCP" and "chat UI calls the REST endpoint
 * after the user taps Generate." Pick whichever transport fits how the
 * frontend's agent runtime is wired.
 */
const StartGenerationInput = z.object({
    userId: z.string(),
    conversationId: z.string(),
    contentType: ContentType,
    title: z.string(),
    params: z.record(z.string(), z.unknown()),
});
export const startGenerationTool = {
    name: "start_generation",
    description: "Kick off generation for a proposal the user has already confirmed (tapped Generate). " +
        "Returns a jobId to poll or stream progress from — does not block until completion.",
    inputSchema: StartGenerationInput,
    handler: async (input) => {
        validateParamsForType(input.contentType, input.params); // throws on bad params
        const job = {
            id: newJobId(),
            userId: input.userId,
            conversationId: input.conversationId,
            contentType: input.contentType,
            title: input.title,
            params: input.params,
            status: "pending",
            currentStep: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        jobStore.create(job);
        void runGenerationJob(job); // fire and forget; client streams progress via SSE
        return { jobId: job.id };
    },
};
const ReviseGenerationInput = z.object({
    userId: z.string(),
    conversationId: z.string(),
    contentId: z.string(),
    instruction: z.string(),
});
export const reviseGenerationTool = {
    name: "revise_generation",
    description: "Apply a natural-language revision to a previously generated, persisted item.",
    inputSchema: ReviseGenerationInput,
    handler: async (input) => {
        const existing = contentRepo.get(input.contentId);
        if (!existing)
            throw new Error(`Content ${input.contentId} not found`);
        const job = {
            id: newJobId(),
            userId: input.userId,
            conversationId: input.conversationId,
            contentType: existing.contentType,
            title: existing.name,
            params: {},
            status: "pending",
            currentStep: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        jobStore.create(job);
        void runRevisionJob(job, input.contentId, input.instruction);
        return { jobId: job.id };
    },
};
const GetGenerationStatusInput = z.object({ jobId: z.string() });
export const getGenerationStatusTool = {
    name: "get_generation_status",
    description: "Poll the status of a generation or revision job.",
    inputSchema: GetGenerationStatusInput,
    handler: async (input) => {
        const job = jobStore.get(input.jobId);
        if (!job)
            throw new Error(`Job ${input.jobId} not found`);
        return job;
    },
};
const SearchContentInput = z.object({
    userId: z.string(),
    query: z.string(),
    contentType: ContentType.optional(),
});
export const searchContentTool = {
    name: "search_content",
    description: "Search previously generated content by name, so a user can find something they made earlier.",
    inputSchema: SearchContentInput,
    handler: async (input) => {
        return contentRepo.search(input.query, input.userId, input.contentType);
    },
};
//# sourceMappingURL=generationTools.js.map