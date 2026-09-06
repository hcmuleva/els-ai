import {
  AuthenticatedRequest as SharedAuthenticatedRequest,
  createRequireAuth,
  requireRole as sharedRequireRole,
} from '@els-ai/internal-auth';

export type AuthenticatedRequest = SharedAuthenticatedRequest;
export const requireAuth = createRequireAuth();
export const requireRole = sharedRequireRole;
