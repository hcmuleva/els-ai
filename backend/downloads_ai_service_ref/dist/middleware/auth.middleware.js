import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
function verifyRequest(req) {
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
        const payload = jwt.verify(token, env.INTERNAL_AUTH_SECRET);
        return payload;
    }
    catch {
        throw Object.assign(new Error("Invalid or expired token"), { statusCode: 401 });
    }
}
export function requireAuth(req, res, next) {
    try {
        req.user = verifyRequest(req);
        next();
    }
    catch (err) {
        const statusCode = err.statusCode ?? 401;
        res.status(statusCode).json({ error: err.message });
    }
}
//# sourceMappingURL=auth.middleware.js.map