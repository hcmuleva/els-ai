import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'els-secret-key-super-secure';
export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication token required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            userId: decoded.userId,
            organizationId: decoded.organizationId,
            email: decoded.email,
            role: decoded.role,
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ message: 'Invalid or expired authentication token' });
    }
}
export function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden: insufficient role permissions' });
        }
        next();
    };
}
