import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { enforceSubscriptionState, isSubscriptionActive } from '../services/billing.js';
import { createRequireAuth, requireRole as sharedRequireRole, } from '@els-ai/internal-auth';
import { eventBus } from '../events/bus.js';
const JWT_SECRET = process.env.JWT_SECRET || 'els-secret-key-super-secure';
export const authRouter = Router();
// Zod validation schemas
const registerSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(4),
    role: z.enum(['student', 'teacher', 'parent']).default('teacher'),
    organizationSubdomain: z.string().default('default-org'),
});
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});
// Helper: Generate tokens
function generateAccessToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}
// 1. Register Endpoint
authRouter.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    }
    const { firstName, lastName, email, password, role, organizationSubdomain } = parsed.data;
    try {
        // Check if user already exists
        const existingUser = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
        if (existingUser.rowCount && existingUser.rowCount > 0) {
            return res.status(400).json({ message: 'Email already registered' });
        }
        // Find organization
        const orgResult = await db.query('SELECT id FROM organizations WHERE subdomain = $1', [organizationSubdomain]);
        if (orgResult.rowCount === 0) {
            return res.status(400).json({ message: 'Organization subdomain not found' });
        }
        const orgId = orgResult.rows[0].id;
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        // Insert user
        const userInsert = await db.query(`INSERT INTO users (first_name, last_name, email, password_hash, active_role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`, [firstName, lastName, email.toLowerCase(), passwordHash, role]);
        const userId = userInsert.rows[0].id;
        // Map role
        const roleResult = await db.query('SELECT id FROM roles WHERE role_name = $1', [role]);
        const roleId = roleResult.rows[0].id;
        await db.query(`INSERT INTO user_roles (user_id, role_id, organization_id)
       VALUES ($1, $2, $3)`, [userId, roleId, orgId]);
        await enforceSubscriptionState(orgId);
        return res.status(201).json({ message: 'User registered successfully', userId });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Registration failed' });
    }
});
// 2. Login Endpoint
authRouter.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid payload' });
    }
    const { email, password } = parsed.data;
    try {
        // Find user
        const userResult = await db.query(`SELECT id, first_name, last_name, email, password_hash, active_role, profile_image
       FROM users WHERE email = $1`, [email.toLowerCase()]);
        if (userResult.rowCount === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = userResult.rows[0];
        // Verify password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Find organization and roles
        const rolesResult = await db.query(`SELECT r.role_name, ur.organization_id
       FROM roles r
       INNER JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`, [user.id]);
        const organizationId = rolesResult.rows[0]?.organization_id;
        const rolesList = rolesResult.rows.map((row) => row.role_name);
        if (!organizationId) {
            return res.status(403).json({ message: 'No organization assigned for this user' });
        }
        const isSuperAdmin = rolesList.includes('superadmin');
        const globalPublishPermissionResult = await db.query(`SELECT enabled
       FROM user_global_publish_permissions
       WHERE user_id = $1
         AND organization_id = $2::uuid
       LIMIT 1`, [user.id, organizationId]);
        const canPublishGlobal = Boolean(globalPublishPermissionResult.rows[0]?.enabled);
        const subscription = await enforceSubscriptionState(organizationId);
        const subscriptionActive = isSubscriptionActive(subscription);
        if (!subscriptionActive && !isSuperAdmin) {
            return res.status(402).json({
                message: 'Trial has expired. Please subscribe to continue.',
                code: 'PAYMENT_REQUIRED',
                subscription,
            });
        }
        // Generate tokens
        const tokenPayload = {
            userId: user.id,
            organizationId,
            email: user.email,
            role: user.active_role,
            isSuperAdmin,
            canPublishGlobal,
        };
        const accessToken = generateAccessToken(tokenPayload);
        // Create refresh token
        const rawRefreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await db.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`, [user.id, rawRefreshToken, expiresAt]);
        void eventBus.publish({
            type: 'auth.user.logged_in',
            source: 'auth-service',
            userId: user.id,
            organizationId,
            payload: { email: user.email, role: user.active_role, isSuperAdmin },
        });
        return res.json({
            accessToken,
            refreshToken: rawRefreshToken,
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                activeRole: user.active_role,
                roles: rolesList,
                profileImage: user.profile_image,
                organizationId,
                canPublishGlobal,
                isSuperAdmin,
            },
            subscription,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Login failed' });
    }
});
// 3. Refresh Token Endpoint
authRouter.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required' });
    }
    try {
        // Verify refresh token signature
        const decoded = jwt.verify(refreshToken, JWT_SECRET);
        // Find token in database and ensure not revoked/expired
        const tokenResult = await db.query(`SELECT id, revoked, expires_at
       FROM refresh_tokens
       WHERE user_id = $1 AND token_hash = $2`, [decoded.userId, refreshToken]);
        if (tokenResult.rowCount === 0) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }
        const dbToken = tokenResult.rows[0];
        if (dbToken.revoked || new Date() > new Date(dbToken.expires_at)) {
            return res.status(401).json({ message: 'Revoked or expired refresh token' });
        }
        // Revoke old refresh token
        await db.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [dbToken.id]);
        // Fetch user details for new token
        const userResult = await db.query(`SELECT id, email, active_role FROM users WHERE id = $1`, [decoded.userId]);
        const user = userResult.rows[0];
        const rolesResult = await db.query(`SELECT organization_id FROM user_roles WHERE user_id = $1 LIMIT 1`, [user.id]);
        const orgId = rolesResult.rows[0]?.organization_id;
        if (!orgId) {
            return res.status(403).json({ message: 'No organization assigned for this user' });
        }
        const allRolesResult = await db.query(`SELECT r.role_name
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1`, [user.id]);
        const allRoles = allRolesResult.rows.map((row) => row.role_name);
        const isSuperAdmin = allRoles.includes('superadmin');
        const globalPublishPermissionResult = await db.query(`SELECT enabled
       FROM user_global_publish_permissions
       WHERE user_id = $1
         AND organization_id = $2::uuid
       LIMIT 1`, [user.id, orgId]);
        const canPublishGlobal = Boolean(globalPublishPermissionResult.rows[0]?.enabled);
        const subscription = await enforceSubscriptionState(orgId);
        const subscriptionActive = isSubscriptionActive(subscription);
        if (!subscriptionActive && !isSuperAdmin) {
            return res.status(402).json({
                message: 'Trial has expired. Please subscribe to continue.',
                code: 'PAYMENT_REQUIRED',
                subscription,
            });
        }
        // Generate new access token
        const newAccessToken = generateAccessToken({
            userId: user.id,
            organizationId: orgId,
            email: user.email,
            role: user.active_role,
            isSuperAdmin,
            canPublishGlobal,
        });
        // Generate rotated refresh token
        const newRefreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await db.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`, [user.id, newRefreshToken, expiresAt]);
        return res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            subscription,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(401).json({ message: 'Invalid refresh token' });
    }
});
export const requireAuth = createRequireAuth({ jwtSecret: JWT_SECRET });
export const requireRole = sharedRequireRole;
