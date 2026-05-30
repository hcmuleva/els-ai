import type { NextFunction, Request, Response } from 'express';
export declare const INTERNAL_HEADERS: {
    readonly secret: "x-internal-secret";
    readonly userId: "x-internal-user-id";
    readonly organizationId: "x-internal-organization-id";
    readonly email: "x-internal-email";
    readonly role: "x-internal-role";
    readonly roles: "x-internal-roles";
    readonly isSuperAdmin: "x-internal-is-superadmin";
    readonly canPublishGlobal: "x-internal-can-publish-global";
    readonly classLevel: "x-internal-class-level";
};
export type InternalUser = {
    userId: string;
    organizationId: string;
    email: string;
    role: string;
    roles?: string[];
    isSuperAdmin?: boolean;
    canPublishGlobal?: boolean;
    classLevel?: string | null;
};
export interface AuthenticatedRequest extends Request {
    user?: InternalUser;
}
export type RequireAuthOptions = {
    jwtSecret?: string;
    internalSecret?: string;
    allowJwtFallback?: boolean;
};
export declare function createRequireAuth(options?: RequireAuthOptions): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare function requireRole(allowedRoles: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function requireOrg(req: AuthenticatedRequest, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
export declare function assertSameOrg(req: AuthenticatedRequest, resourceOrgId: string | null | undefined): boolean;
export type GatewayHeaderInput = InternalUser & {
    internalSecret?: string;
};
export declare function buildInternalHeaders(user: GatewayHeaderInput): Record<string, string>;
export declare function getOrganizationId(req: AuthenticatedRequest): string | null;
export declare function getUserId(req: AuthenticatedRequest): string | null;
export declare function canBypassOwnership(req: AuthenticatedRequest): boolean;
export declare function canManageTeacherContent(req: AuthenticatedRequest): boolean;
export declare function canPublishGlobalResources(req: AuthenticatedRequest): boolean;
export declare function verifyJwtPayload(token: string, jwtSecret?: string): InternalUser | null;
//# sourceMappingURL=index.d.ts.map