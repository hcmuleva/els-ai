import {
  AuthenticatedRequest as SharedAuthenticatedRequest,
  createRequireAuth,
  requireRole as sharedRequireRole,
} from '@els-ai/internal-auth';

export type AuthenticatedRequest = SharedAuthenticatedRequest;
export const requireAuth = createRequireAuth();
export const requireRole = sharedRequireRole;

export function canManage(req: AuthenticatedRequest): boolean {
  const role = (req as any).user?.activeRole || (req as any).user?.role;
  return role === 'teacher' || role === 'admin' || role === 'superadmin';
}
