import { Response } from 'express';
import { AuthenticatedRequest as SharedAuthenticatedRequest, requireRole as sharedRequireRole } from '@els-ai/internal-auth';
export declare const authRouter: import("express-serve-static-core").Router;
export type AuthenticatedRequest = SharedAuthenticatedRequest;
export declare const requireAuth: (req: SharedAuthenticatedRequest, res: Response, next: import("express").NextFunction) => void | Response<any, Record<string, any>>;
export declare const requireRole: typeof sharedRequireRole;
//# sourceMappingURL=auth.d.ts.map