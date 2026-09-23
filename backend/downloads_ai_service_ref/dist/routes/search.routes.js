import { Router } from "express";
import { z } from "zod";
import { contentRepo } from "../generation/contentRepo.js";
import { ContentType } from "../generation/types.js";
export const searchRouter = Router();
const SearchQuery = z.object({
    query: z.string().default(""),
    contentType: ContentType.optional(),
});
searchRouter.get("/", (req, res, next) => {
    try {
        const { query, contentType } = SearchQuery.parse({
            query: req.query.query,
            contentType: req.query.contentType,
        });
        const userId = req.user.userId;
        res.json(contentRepo.search(query, userId, contentType));
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=search.routes.js.map