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
};
const DEFAULT_JWT_SECRET = 'els-secret-key-super-secure';
function readHeader(req, name) {
    const value = req.headers[name];
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value))
        return value[0];
    return undefined;
}
function parseInternalHeaders(req, requiredSecret) {
    const provided = readHeader(req, INTERNAL_HEADERS.secret);
    if (!provided || provided !== requiredSecret)
        return null;
    const userId = readHeader(req, INTERNAL_HEADERS.userId);
    const organizationId = readHeader(req, INTERNAL_HEADERS.organizationId);
    if (!userId || !organizationId)
        return null;
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
    };
}
function parseJwt(req, jwtSecret) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return null;
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, jwtSecret);
        return {
            userId: decoded.userId,
            organizationId: decoded.organizationId,
            email: decoded.email,
            role: decoded.role,
            isSuperAdmin: Boolean(decoded.isSuperAdmin),
            canPublishGlobal: Boolean(decoded.canPublishGlobal),
        };
    }
    catch (_error) {
        return null;
    }
}
export function createRequireAuth(options = {}) {
    const jwtSecret = options.jwtSecret || process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
    const internalSecret = options.internalSecret || process.env.INTERNAL_SECRET || 'els-internal-secret-change-me';
    const allowJwtFallback = options.allowJwtFallback ?? true;
    return function requireAuth(req, res, next) {
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
export function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        const userRoles = new Set([req.user.role, ...(req.user.roles || [])]);
        if (!allowedRoles.some((role) => userRoles.has(role))) {
            return res.status(403).json({ message: 'Forbidden: insufficient role permissions' });
        }
        next();
    };
}
export function requireOrg(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    if (!req.user.organizationId) {
        return res.status(400).json({ message: 'Organization context missing' });
    }
    return next();
}
export function assertSameOrg(req, resourceOrgId) {
    if (!req.user)
        return false;
    if (req.user.isSuperAdmin)
        return true;
    if (!resourceOrgId)
        return false;
    return req.user.organizationId === resourceOrgId;
}
export function buildInternalHeaders(user) {
    const secret = user.internalSecret || process.env.INTERNAL_SECRET || 'els-internal-secret-change-me';
    const headers = {
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
    return headers;
}
export function getOrganizationId(req) {
    return req.user?.organizationId || null;
}
export function getUserId(req) {
    return req.user?.userId || null;
}
export function canBypassOwnership(req) {
    const role = req.user?.role;
    return role === 'admin' || role === 'superadmin';
}
export function canManageTeacherContent(req) {
    const role = req.user?.role;
    return role === 'teacher' || role === 'admin' || role === 'superadmin';
}
export function canPublishGlobalResources(req) {
    const role = req.user?.role;
    return role === 'superadmin' || Boolean(req.user?.canPublishGlobal);
}
export function verifyJwtPayload(token, jwtSecret) {
    const secret = jwtSecret || process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
    try {
        const decoded = jwt.verify(token, secret);
        return {
            userId: decoded.userId,
            organizationId: decoded.organizationId,
            email: decoded.email,
            role: decoded.role,
            isSuperAdmin: Boolean(decoded.isSuperAdmin),
            canPublishGlobal: Boolean(decoded.canPublishGlobal),
        };
    }
    catch (_error) {
        return null;
    }
}
//# sourceMappingURL=index.js.map