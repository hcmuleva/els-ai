import { Router } from "express";
import { z } from "zod";
import { contentRepo } from "../generation/contentRepo.js";
import { ContentType } from "../generation/types.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

export const searchRouter = Router();

const SearchQuery = z.object({
  query: z.string().default(""),
  contentType: ContentType.optional(),
});

searchRouter.get("/", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { query, contentType } = SearchQuery.parse({
      query: req.query.query,
      contentType: req.query.contentType,
    });
    const userId = req.user?.userId || (req.user as any)?.id || 'anonymous_user';
    res.json(contentRepo.search(query, userId, contentType));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Invalid search query" });
  }
});
