import { AuthenticatedRequest as SharedAuthenticatedRequest, requireRole as sharedRequireRole } from '@els-ai/internal-auth';
export type AuthenticatedRequest = SharedAuthenticatedRequest;
export declare const requireAuth: (req: SharedAuthenticatedRequest, res: import("express").Response, next: import("express").NextFunction) => void | import("express").Response<any, Record<string, any>>;
export declare const requireRole: typeof sharedRequireRole;
export declare function canManage(req: AuthenticatedRequest): boolean;
//# sourceMappingURL=auth.d.ts.map