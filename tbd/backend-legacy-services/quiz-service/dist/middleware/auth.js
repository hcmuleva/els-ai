import { createRequireAuth, requireRole as sharedRequireRole, } from '@els-ai/internal-auth';
export const requireAuth = createRequireAuth();
export const requireRole = sharedRequireRole;
