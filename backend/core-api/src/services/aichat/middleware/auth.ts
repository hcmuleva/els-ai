import {
  AuthenticatedRequest as SharedAuthenticatedRequest,
  createRequireAuth,
} from '@els-ai/internal-auth';

export type AuthenticatedRequest = SharedAuthenticatedRequest;
export const requireAuth = createRequireAuth();
