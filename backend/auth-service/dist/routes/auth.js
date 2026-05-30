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
const STANDARD_VALUES = ['LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const MOBILE_REGEX = /^[0-9]{10,15}$/;
const BOT_MIN_FILL_MS = 3000;
const BOT_MAX_FILL_MS = 30 * 60 * 1000;
const registerSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().optional(),
    mobileNumber: z.string().trim().optional(),
    password: z.string().min(4),
    role: z.enum(['student', 'teacher', 'parent']).default('teacher'),
    classLevel: z.enum(STANDARD_VALUES).optional(),
    childRegistrationId: z.string().trim().min(4).max(30).optional(),
    formStartedAt: z.coerce.number(),
    botField: z.string().optional(),
});
const loginSchema = z.object({
    identifier: z.string().min(3),
    password: z.string(),
});
const registerRateLimitMap = new Map();
function normalizeMobile(raw) {
    return raw.replace(/\D/g, '');
}
function resolveIdentifier(identifier) {
    const trimmed = identifier.trim();
    if (trimmed.includes('@'))
        return { email: trimmed.toLowerCase(), mobile: null };
    const mobile = normalizeMobile(trimmed);
    if (!MOBILE_REGEX.test(mobile))
        return { email: null, mobile: null };
    return { email: null, mobile };
}
function buildMobileEmailFallback(mobile) {
    return `${mobile}@mobile.els-academy.local`;
}
function hitRegisterRateLimit(req) {
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const maxHits = 8;
    const current = (registerRateLimitMap.get(rawIp) || []).filter((ts) => now - ts <= windowMs);
    current.push(now);
    registerRateLimitMap.set(rawIp, current);
    return current.length > maxHits;
}
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
    const { firstName, lastName, email, mobileNumber, password, role, classLevel, childRegistrationId, formStartedAt, botField } = parsed.data;
    const now = Date.now();
    const formFillMs = now - formStartedAt;
    if (botField && botField.trim().length > 0) {
        return res.status(400).json({ message: 'Bot validation failed' });
    }
    if (!Number.isFinite(formFillMs) || formFillMs < BOT_MIN_FILL_MS || formFillMs > BOT_MAX_FILL_MS) {
        return res.status(400).json({ message: 'Bot validation failed' });
    }
    if (hitRegisterRateLimit(req)) {
        return res.status(429).json({ message: 'Too many registration attempts. Please try again later.' });
    }
    if (role === 'student' && !classLevel) {
        return res.status(400).json({ message: 'Class level is required for student registration' });
    }
    const normalizedEmail = email?.trim().toLowerCase() || null;
    const normalizedMobile = mobileNumber ? normalizeMobile(mobileNumber) : null;
    if (!normalizedEmail && !normalizedMobile) {
        return res.status(400).json({ message: 'Email or mobile number is required' });
    }
    if (normalizedMobile && !MOBILE_REGEX.test(normalizedMobile)) {
        return res.status(400).json({ message: 'Invalid mobile number format' });
    }
    const effectiveEmail = normalizedEmail || buildMobileEmailFallback(normalizedMobile);
    const client = await db.connect();
    try {
        if (normalizedEmail) {
            const existingByEmail = await client.query('SELECT 1 FROM users WHERE lower(email) = $1', [normalizedEmail]);
            if ((existingByEmail.rowCount ?? 0) > 0) {
                return res.status(400).json({ message: 'Email already registered' });
            }
        }
        if (normalizedMobile) {
            const existingByMobile = await client.query('SELECT 1 FROM users WHERE mobile_number = $1', [normalizedMobile]);
            if ((existingByMobile.rowCount ?? 0) > 0) {
                return res.status(400).json({ message: 'Mobile number already registered' });
            }
        }
        // Default self-registration org: ELS Academy
        const orgResult = await client.query(`SELECT id
       FROM organizations
       WHERE LOWER(name) = 'els academy' OR subdomain = 'els-academy'
       ORDER BY created_at ASC
       LIMIT 1`);
        if (orgResult.rowCount === 0) {
            return res.status(400).json({ message: 'ELS Academy organization not found' });
        }
        const orgId = orgResult.rows[0].id;
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        // Insert user
        await client.query('BEGIN');
        const userInsert = await client.query(`INSERT INTO users (first_name, last_name, email, mobile_number, password_hash, active_role, class_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, unique_registration_id`, [firstName, lastName, effectiveEmail, normalizedMobile, passwordHash, role, role === 'student' ? classLevel ?? null : null]);
        const userId = userInsert.rows[0].id;
        const registrationId = userInsert.rows[0].unique_registration_id;
        // Map role
        const roleResult = await client.query('SELECT id FROM roles WHERE role_name = $1', [role]);
        const roleId = roleResult.rows[0].id;
        await client.query(`INSERT INTO user_roles (user_id, role_id, organization_id)
       VALUES ($1, $2, $3)`, [userId, roleId, orgId]);
        if (role === 'parent' && childRegistrationId) {
            const childResult = await client.query(`SELECT u.id
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.organization_id = $2::uuid
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE u.unique_registration_id = $1
           AND r.role_name = 'student'
         LIMIT 1`, [childRegistrationId.trim().toUpperCase(), orgId]);
            if ((childResult.rowCount ?? 0) === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Invalid child registration ID' });
            }
            await client.query(`INSERT INTO parent_student_links (parent_user_id, student_user_id, organization_id)
         VALUES ($1, $2, $3::uuid)
         ON CONFLICT (parent_user_id, student_user_id, organization_id) DO NOTHING`, [userId, childResult.rows[0].id, orgId]);
        }
        await client.query('COMMIT');
        await enforceSubscriptionState(orgId);
        return res.status(201).json({ message: 'User registered successfully', userId, registrationId });
    }
    catch (error) {
        try {
            await client.query('ROLLBACK');
        }
        catch { }
        console.error(error);
        return res.status(500).json({ message: 'Registration failed' });
    }
    finally {
        client.release();
    }
});
// 2. Login Endpoint
authRouter.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid payload' });
    }
    const { identifier, password } = parsed.data;
    const resolvedIdentifier = resolveIdentifier(identifier);
    const lookupEmail = resolvedIdentifier.email;
    const lookupMobile = resolvedIdentifier.mobile;
    if (!lookupEmail && !lookupMobile) {
        return res.status(400).json({ message: 'Enter a valid email address or mobile number' });
    }
    try {
        // Find user. Match strictly on the field the caller supplied; never let an
        // unset field (NULL or '') in the DB collide with another unset field in
        // the request, which would authenticate the caller as the wrong user.
        const userResult = await db.query(`SELECT id, first_name, last_name, email, mobile_number, class_level, unique_registration_id, password_hash, active_role, profile_image
         FROM users
        WHERE deleted_at IS NULL
          AND (
            ($1::text IS NOT NULL AND lower(email) = $1::text)
            OR
            ($2::text IS NOT NULL AND $2::text <> '' AND mobile_number = $2::text)
          )
        LIMIT 1`, [lookupEmail ?? null, lookupMobile ?? null]);
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
        // Default a superadmin to land on the superadmin tab on every login.
        // If the persisted active_role isn't superadmin, promote it now.
        if (isSuperAdmin && user.active_role !== 'superadmin') {
            await db.query(`UPDATE users SET active_role = $1 WHERE id = $2`, ['superadmin', user.id]);
            user.active_role = 'superadmin';
        }
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
            classLevel: user.class_level ?? null,
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
                mobileNumber: user.mobile_number,
                classLevel: user.class_level,
                registrationId: user.unique_registration_id,
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
        const userResult = await db.query(`SELECT id, email, active_role, class_level FROM users WHERE id = $1`, [decoded.userId]);
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
        if (isSuperAdmin && user.active_role !== 'superadmin') {
            await db.query(`UPDATE users SET active_role = $1 WHERE id = $2`, ['superadmin', user.id]);
            user.active_role = 'superadmin';
        }
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
            classLevel: user.class_level ?? null,
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
