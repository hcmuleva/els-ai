/**
 * In-memory store. Fine for a single instance / dev. For production with
 * multiple ai-service replicas, back this with Redis or Postgres so job
 * status survives across instances (the SSE hub has the same constraint —
 * see events/sseHub.ts).
 */
class JobStore {
    jobs = new Map();
    create(job) {
        this.jobs.set(job.id, job);
        return job;
    }
    get(jobId) {
        return this.jobs.get(jobId);
    }
    update(jobId, patch) {
        const existing = this.jobs.get(jobId);
        if (!existing)
            return undefined;
        const updated = {
            ...existing,
            ...patch,
            updatedAt: new Date().toISOString(),
        };
        this.jobs.set(jobId, updated);
        return updated;
    }
    countActiveForUser(userId) {
        let count = 0;
        for (const job of this.jobs.values()) {
            if (job.userId === userId && (job.status === "pending" || job.status === "running")) {
                count++;
            }
        }
        return count;
    }
    listByConversation(conversationId) {
        return [...this.jobs.values()].filter((j) => j.conversationId === conversationId);
    }
    findByConversationAndTitle(conversationId, title, contentType) {
        const list = this.listByConversation(conversationId);
        if (!list.length)
            return undefined;
        const cleanTitle = (title || "").toLowerCase().trim();
        if (cleanTitle) {
            const match = list.find((j) => j.status === "completed" && j.title.toLowerCase().trim() === cleanTitle);
            if (match)
                return match;
        }
        if (contentType) {
            const match = list.find((j) => j.status === "completed" && j.contentType === contentType);
            if (match)
                return match;
        }
        return list.find((j) => j.status === "completed");
    }
}
export const jobStore = new JobStore();
