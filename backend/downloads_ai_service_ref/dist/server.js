import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { chatRouter } from "./routes/chat.routes.js";
import { generationRouter } from "./routes/generation.routes.js";
import { searchRouter } from "./routes/search.routes.js";
import { handleMcpRequest } from "./mcp/server.js";
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.get("/health", (_req, res) => res.json({ ok: true }));
// MCP transport — for agent runtimes that call these tools directly.
app.post("/mcp", handleMcpRequest);
// REST surface — for the chat UI.
app.use("/api/chat", requireAuth, chatRouter);
app.use("/api/generation", requireAuth, generationRouter);
app.use("/api/content/search", requireAuth, searchRouter);
app.use(errorHandler);
app.listen(env.PORT, () => {
    logger.info("ai-service listening", { port: env.PORT });
});
//# sourceMappingURL=server.js.map