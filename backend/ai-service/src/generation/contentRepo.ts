import type { ContentType } from "./types.js";

export interface StoredContent {
  contentId: string;
  contentType: ContentType;
  name: string;
  ownerId: string;
  data: unknown;
  createdAt: string;
}

/**
 * In-memory content store so the "search it and see" requirement works
 * end-to-end in this reference implementation. Replace with the real
 * ELS-AI content DB (Postgres/Supabase) — keep the same method signatures
 * and the routes/generators above don't need to change.
 */
class ContentRepo {
  private store = new Map<string, StoredContent>();

  save(entry: StoredContent) {
    this.store.set(entry.contentId, entry);
    return entry;
  }

  get(contentId: string) {
    return this.store.get(contentId);
  }

  search(query: string, ownerId: string, contentType?: ContentType): StoredContent[] {
    const q = query.trim().toLowerCase();
    return [...this.store.values()].filter(
      (c) =>
        c.ownerId === ownerId &&
        (!contentType || c.contentType === contentType) &&
        (!q || c.name.toLowerCase().includes(q)),
    );
  }
}

export const contentRepo = new ContentRepo();
