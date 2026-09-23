/**
 * In-memory content store so the "search it and see" requirement works
 * end-to-end in this reference implementation. Replace with the real
 * ELS-AI content DB (Postgres/Supabase) — keep the same method signatures
 * and the routes/generators above don't need to change.
 */
class ContentRepo {
    store = new Map();
    save(entry) {
        this.store.set(entry.contentId, entry);
        return entry;
    }
    get(contentId) {
        return this.store.get(contentId);
    }
    search(query, ownerId, contentType) {
        const q = query.trim().toLowerCase();
        return [...this.store.values()].filter((c) => c.ownerId === ownerId &&
            (!contentType || c.contentType === contentType) &&
            (!q || c.name.toLowerCase().includes(q)));
    }
}
export const contentRepo = new ContentRepo();
//# sourceMappingURL=contentRepo.js.map