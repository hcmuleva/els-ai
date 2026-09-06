import { AuthenticatedRequest as SharedAuthenticatedRequest } from '@els-ai/internal-auth';
export type AuthenticatedRequest = SharedAuthenticatedRequest;
export declare const requireAuth: (req: SharedAuthenticatedRequest, res: import("express").Response, next: import("express").NextFunction) => void | import("express").Response<any, Record<string, any>>;
//# sourceMappingURL=auth.d.ts.map