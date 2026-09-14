import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * ASSUMPTION: @els-ai/internal-auth's real exported API is unknown from here.
 * Swap the body of `verifyRequest` below for whatever that package actually
 * exposes (e.g. `import { verifyServiceToken } from "@els-ai/internal-auth"`).
 * The fallback below decodes a bearer JWT directly with INTERNAL_AUTH_SECRET
 * so the service is runnable standalone until that's wired up.
 */

export interface AuthedUser {
  userId: string;
  classroomIds: string[];
  role: "student" | "teacher" | "admin";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

function verifyRequest(req: Request): AuthedUser {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw Object.assign(new Error("Missing bearer token"), { statusCode: 401 });
  }

  if (!env.INTERNAL_AUTH_SECRET) {
    throw Object.assign(new Error("INTERNAL_AUTH_SECRET not configured"), {
      statusCode: 500,
    });
  }

  try {
    const payload = jwt.verify(token, env.INTERNAL_AUTH_SECRET) as AuthedUser;
    return payload;
  } catch {
    throw Object.assign(new Error("Invalid or expired token"), { statusCode: 401 });
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    req.user = verifyRequest(req);
    next();
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode ?? 401;
    res.status(statusCode).json({ error: (err as Error).message });
  }
}
