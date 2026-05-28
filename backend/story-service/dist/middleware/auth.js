import { createRequireAuth, requireRole as sharedRequireRole, } from '@els-ai/internal-auth';
export const requireAuth = createRequireAuth();
export const requireRole = sharedRequireRole;
export function canManage(req) {
    const role = req.user?.activeRole || req.user?.role;
    return role === 'teacher' || role === 'admin' || role === 'superadmin';
}
