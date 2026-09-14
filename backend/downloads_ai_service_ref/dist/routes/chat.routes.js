import { Router } from "express";
import { z } from "zod";
import { runChatTurn } from "../agent/orchestrator.js";
export const chatRouter = Router();
const ChatRequest = z.object({
    conversationId: z.string(),
    history: z
        .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
        .min(1),
});
chatRouter.post("/", async (req, res, next) => {
    try {
        const { conversationId, history } = ChatRequest.parse(req.body);
        const result = await runChatTurn(history, conversationId);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=chat.routes.js.map