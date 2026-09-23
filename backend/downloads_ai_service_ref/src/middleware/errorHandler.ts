import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "validation_failed",
      details: err.flatten(),
    });
    return;
  }

  const statusCode = (err as { statusCode?: number })?.statusCode ?? 500;
  const message = (err as Error)?.message ?? "Internal error";

  if (statusCode >= 500) {
    logger.error("unhandled_error", { message, path: req.path, stack: (err as Error)?.stack });
  }

  res.status(statusCode).json({ error: message });
}
