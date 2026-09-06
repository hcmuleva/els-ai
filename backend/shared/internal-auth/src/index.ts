import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const INTERNAL_HEADERS = {
  secret: 'x-internal-secret',
  userId: 'x-internal-user-id',
  organizationId: 'x-internal-organization-id',
  email: 'x-internal-email',
  role: 'x-internal-role',
  roles: 'x-internal-roles',
  isSuperAdmin: 'x-internal-is-superadmin',
  canPublishGlobal: 'x-internal-can-publish-global',
  classLevel: 'x-internal-class-level',
} as const;

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

const DEFAULT_JWT_SECRET = 'els-secret-key-super-secure';

function readHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function parseInternalHeaders(req: Request, requiredSecret: string): InternalUser | null {
  const provided = readHeader(req, INTERNAL_HEADERS.secret);
  if (!provided || provided !== requiredSecret) return null;
  const userId = readHeader(req, INTERNAL_HEADERS.userId);
  const organizationId = readHeader(req, INTERNAL_HEADERS.organizationId);
  if (!userId || !organizationId) return null;
  const rawRoles = readHeader(req, INTERNAL_HEADERS.roles);
  const roles = rawRoles ? rawRoles.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  return {
    userId,
    organizationId,
    email: readHeader(req, INTERNAL_HEADERS.email) || '',
    role: readHeader(req, INTERNAL_HEADERS.role) || (roles?.[0] ?? ''),
    roles,
    isSuperAdmin: readHeader(req, INTERNAL_HEADERS.isSuperAdmin) === 'true',
    canPublishGlobal: readHeader(req, INTERNAL_HEADERS.canPublishGlobal) === 'true',
    classLevel: readHeader(req, INTERNAL_HEADERS.classLevel) || null,
  };
}

function parseJwt(req: Request, jwtSecret: string): InternalUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret) as any;
    return {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      email: decoded.email,
      role: decoded.role,
      isSuperAdmin: Boolean(decoded.isSuperAdmin),
      canPublishGlobal: Boolean(decoded.canPublishGlobal),
      classLevel: decoded.classLevel ?? null,
    };
  } catch (_error) {
    return null;
  }
}

export type RequireAuthOptions = {
  jwtSecret?: string;
  internalSecret?: string;
  allowJwtFallback?: boolean;
};

export function createRequireAuth(options: RequireAuthOptions = {}) {
  const jwtSecret = options.jwtSecret || process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  const internalSecret = options.internalSecret || process.env.INTERNAL_SECRET || 'els-internal-secret-change-me';
  const allowJwtFallback = options.allowJwtFallback ?? true;

  return function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const headerUser = parseInternalHeaders(req, internalSecret);
    if (headerUser) {
      req.user = headerUser;
      return next();
    }
    if (allowJwtFallback) {
      const jwtUser = parseJwt(req, jwtSecret);
      if (jwtUser) {
        req.user = jwtUser;
        return next();
      }
    }
    return res.status(401).json({ message: 'Authentication required' });
  };
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const userRoles = new Set<string>([req.user.role, ...(req.user.roles || [])]);
    if (!allowedRoles.some((role) => userRoles.has(role))) {
      return res.status(403).json({ message: 'Forbidden: insufficient role permissions' });
    }
    next();
  };
}

export function requireOrg(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (!req.user.organizationId) {
    return res.status(400).json({ message: 'Organization context missing' });
  }
  return next();
}

export function assertSameOrg(req: AuthenticatedRequest, resourceOrgId: string | null | undefined): boolean {
  if (!req.user) return false;
  if (req.user.isSuperAdmin) return true;
  if (!resourceOrgId) return false;
  return req.user.organizationId === resourceOrgId;
}

export type GatewayHeaderInput = InternalUser & { internalSecret?: string };

export function buildInternalHeaders(user: GatewayHeaderInput): Record<string, string> {
  const secret = user.internalSecret || process.env.INTERNAL_SECRET || 'els-internal-secret-change-me';
  const headers: Record<string, string> = {
    [INTERNAL_HEADERS.secret]: secret,
    [INTERNAL_HEADERS.userId]: user.userId,
    [INTERNAL_HEADERS.organizationId]: user.organizationId,
    [INTERNAL_HEADERS.email]: user.email,
    [INTERNAL_HEADERS.role]: user.role,
    [INTERNAL_HEADERS.isSuperAdmin]: user.isSuperAdmin ? 'true' : 'false',
    [INTERNAL_HEADERS.canPublishGlobal]: user.canPublishGlobal ? 'true' : 'false',
  };
  if (user.roles && user.roles.length > 0) {
    headers[INTERNAL_HEADERS.roles] = user.roles.join(',');
  }
  if (user.classLevel) {
    headers[INTERNAL_HEADERS.classLevel] = user.classLevel;
  }
  return headers;
}

export function getOrganizationId(req: AuthenticatedRequest): string | null {
  return req.user?.organizationId || null;
}

export function getUserId(req: AuthenticatedRequest): string | null {
  return req.user?.userId || null;
}

export function canBypassOwnership(req: AuthenticatedRequest): boolean {
  const role = req.user?.role;
  return role === 'admin' || role === 'superadmin';
}

export function canManageTeacherContent(req: AuthenticatedRequest): boolean {
  const role = req.user?.role;
  return role === 'teacher' || role === 'admin' || role === 'superadmin';
}

export function canPublishGlobalResources(req: AuthenticatedRequest): boolean {
  const role = req.user?.role;
  return role === 'superadmin' || Boolean(req.user?.canPublishGlobal);
}

export function verifyJwtPayload(token: string, jwtSecret?: string): InternalUser | null {
  const secret = jwtSecret || process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  try {
    const decoded = jwt.verify(token, secret) as any;
    return {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      email: decoded.email,
      role: decoded.role,
      isSuperAdmin: Boolean(decoded.isSuperAdmin),
      canPublishGlobal: Boolean(decoded.canPublishGlobal),
      classLevel: decoded.classLevel ?? null,
    };
  } catch (_error) {
    return null;
  }
}
