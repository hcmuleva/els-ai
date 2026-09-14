import { ZodError } from "zod";
import { logger } from "../utils/logger.js";
export function errorHandler(err, req, res, _next) {
    if (err instanceof ZodError) {
        res.status(400).json({
            error: "validation_failed",
            details: err.flatten(),
        });
        return;
    }
    const statusCode = err?.statusCode ?? 500;
    const message = err?.message ?? "Internal error";
    if (statusCode >= 500) {
        logger.error("unhandled_error", { message, path: req.path, stack: err?.stack });
    }
    res.status(statusCode).json({ error: message });
}
//# sourceMappingURL=errorHandler.js.map