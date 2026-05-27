import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from './auth.js';
import { enforceSubscriptionState, isSubscriptionActive } from '../services/billing.js';
import { eventBus } from '../events/bus.js';
async function isAdminOrSuper(userId, organizationId) {
    if (!userId)
        return { ok: false, superAdmin: false };
    const result = await db.query(`SELECT r.role_name
     FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND (ur.organization_id = $2::uuid OR r.role_name = 'superadmin')`, [userId, organizationId]);
    const roles = result.rows.map((row) => row.role_name);
    const superAdmin = roles.includes('superadmin');
    return { ok: superAdmin || roles.includes('admin'), superAdmin };
}
function nextInvoiceNumber() {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `INV-${stamp}-${rand}`;
}
function mapInvoiceRow(row) {
    return {
        id: row.id,
        organizationId: row.organization_id,
        subscriptionId: row.subscription_id || undefined,
        planId: row.plan_id || undefined,
        invoiceNumber: row.invoice_number,
        status: row.status,
        billingKind: row.billing_kind,
        planName: row.plan_name || undefined,
        membershipTier: row.membership_tier || undefined,
        billingCycle: row.billing_cycle || undefined,
        seatCount: Number(row.seat_count || 1),
        subtotal: Number(row.subtotal || 0),
        discountTotal: Number(row.discount_total || 0),
        amountDue: Number(row.amount_due || 0),
        currency: row.currency,
        periodStart: row.period_start ? new Date(row.period_start).toISOString() : null,
        periodEnd: row.period_end ? new Date(row.period_end).toISOString() : null,
        dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
        issuedAt: row.issued_at ? new Date(row.issued_at).toISOString() : null,
        paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
        paymentMethod: row.payment_method || undefined,
        paymentReference: row.payment_reference || undefined,
        notes: row.notes || undefined,
        organizationName: row.organization_name || undefined,
        organizationSubdomain: row.organization_subdomain || undefined,
    };
}
const tierSchema = z.enum(['bronze', 'silver', 'gold', 'platinum']);
const cycleSchema = z.enum(['monthly', 'quarterly', 'yearly']);
const createPlanSchema = z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().optional(),
    membershipTier: tierSchema,
    billingCycle: cycleSchema,
    basePrice: z.coerce.number().min(0),
    offerDiscountPercent: z.coerce.number().min(0).max(100).default(0),
    specialDiscountPercent: z.coerce.number().min(0).max(100).default(0),
    groupDiscountPercent: z.coerce.number().min(0).max(100).default(0),
    maxUsersForGroupDiscount: z.coerce.number().int().min(1).default(10),
    isActive: z.boolean().default(true),
});
const updatePlanSchema = createPlanSchema.partial().refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
});
const subscribeOrganizationSchema = z.object({
    planId: z.string().uuid(),
    seatCount: z.coerce.number().int().min(1).default(1),
    extraSpecialDiscountPercent: z.coerce.number().min(0).max(100).default(0),
});
async function isSuperAdmin(userId) {
    if (!userId)
        return false;
    const result = await db.query(`SELECT 1
     FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
       AND r.role_name = 'superadmin'
     LIMIT 1`, [userId]);
    return (result.rowCount ?? 0) > 0;
}
function getCycleInterval(cycle) {
    if (cycle === 'yearly')
        return '1 year';
    if (cycle === 'quarterly')
        return '3 months';
    return '1 month';
}
export const billingRouter = Router();
billingRouter.get('/plans', requireAuth, async (req, res) => {
    const includeInactive = await isSuperAdmin(req.user?.userId);
    const result = await db.query(`SELECT
       id, name, description, membership_tier, billing_cycle, base_price,
       offer_discount_percent, special_discount_percent, group_discount_percent,
       max_users_for_group_discount, is_active, created_at, updated_at
     FROM subscription_plans
     ${includeInactive ? '' : 'WHERE is_active = true'}
     ORDER BY membership_tier ASC, base_price ASC`);
    return res.json({
        plans: result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description || undefined,
            membershipTier: row.membership_tier,
            billingCycle: row.billing_cycle,
            basePrice: Number(row.base_price || 0),
            offerDiscountPercent: Number(row.offer_discount_percent || 0),
            specialDiscountPercent: Number(row.special_discount_percent || 0),
            groupDiscountPercent: Number(row.group_discount_percent || 0),
            maxUsersForGroupDiscount: Number(row.max_users_for_group_discount || 0),
            isActive: Boolean(row.is_active),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        })),
    });
});
billingRouter.post('/plans', requireAuth, async (req, res) => {
    const parsedBody = createPlanSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid plan payload', errors: parsedBody.error.issues });
    }
    if (!(await isSuperAdmin(req.user?.userId))) {
        return res.status(403).json({ message: 'Forbidden: superadmin role required' });
    }
    const payload = parsedBody.data;
    try {
        const result = await db.query(`INSERT INTO subscription_plans (
         name, description, membership_tier, billing_cycle, base_price,
         offer_discount_percent, special_discount_percent, group_discount_percent,
         max_users_for_group_discount, is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`, [
            payload.name,
            payload.description || null,
            payload.membershipTier,
            payload.billingCycle,
            payload.basePrice,
            payload.offerDiscountPercent,
            payload.specialDiscountPercent,
            payload.groupDiscountPercent,
            payload.maxUsersForGroupDiscount,
            payload.isActive,
        ]);
        return res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to create plan' });
    }
});
billingRouter.patch('/plans/:planId', requireAuth, async (req, res) => {
    const planId = req.params.planId;
    const parsedBody = updatePlanSchema.safeParse(req.body);
    if (!planId) {
        return res.status(400).json({ message: 'Invalid plan id' });
    }
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid plan payload', errors: parsedBody.error.issues });
    }
    if (!(await isSuperAdmin(req.user?.userId))) {
        return res.status(403).json({ message: 'Forbidden: superadmin role required' });
    }
    const updates = [];
    const params = [];
    const payload = parsedBody.data;
    if (payload.name !== undefined) {
        params.push(payload.name);
        updates.push(`name = $${params.length}`);
    }
    if (payload.description !== undefined) {
        params.push(payload.description || null);
        updates.push(`description = $${params.length}`);
    }
    if (payload.membershipTier !== undefined) {
        params.push(payload.membershipTier);
        updates.push(`membership_tier = $${params.length}`);
    }
    if (payload.billingCycle !== undefined) {
        params.push(payload.billingCycle);
        updates.push(`billing_cycle = $${params.length}`);
    }
    if (payload.basePrice !== undefined) {
        params.push(payload.basePrice);
        updates.push(`base_price = $${params.length}`);
    }
    if (payload.offerDiscountPercent !== undefined) {
        params.push(payload.offerDiscountPercent);
        updates.push(`offer_discount_percent = $${params.length}`);
    }
    if (payload.specialDiscountPercent !== undefined) {
        params.push(payload.specialDiscountPercent);
        updates.push(`special_discount_percent = $${params.length}`);
    }
    if (payload.groupDiscountPercent !== undefined) {
        params.push(payload.groupDiscountPercent);
        updates.push(`group_discount_percent = $${params.length}`);
    }
    if (payload.maxUsersForGroupDiscount !== undefined) {
        params.push(payload.maxUsersForGroupDiscount);
        updates.push(`max_users_for_group_discount = $${params.length}`);
    }
    if (payload.isActive !== undefined) {
        params.push(payload.isActive);
        updates.push(`is_active = $${params.length}`);
    }
    updates.push('updated_at = NOW()');
    params.push(planId);
    try {
        const result = await db.query(`UPDATE subscription_plans
       SET ${updates.join(', ')}
       WHERE id = $${params.length}::uuid
       RETURNING *`, params);
        if ((result.rowCount ?? 0) === 0) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        return res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to update plan' });
    }
});
billingRouter.get('/organizations/:organizationId/subscription', requireAuth, async (req, res) => {
    const organizationId = req.params.organizationId;
    if (!organizationId) {
        return res.status(400).json({ message: 'Invalid organization id' });
    }
    const isSuper = await isSuperAdmin(req.user?.userId);
    if (!isSuper && req.user?.organizationId !== organizationId) {
        return res.status(403).json({ message: 'Forbidden for this organization' });
    }
    const subscription = await enforceSubscriptionState(organizationId);
    return res.json({
        subscription,
        isActive: isSubscriptionActive(subscription),
    });
});
billingRouter.post('/organizations/:organizationId/subscribe', requireAuth, async (req, res) => {
    const organizationId = req.params.organizationId;
    const parsedBody = subscribeOrganizationSchema.safeParse(req.body);
    if (!organizationId) {
        return res.status(400).json({ message: 'Invalid organization id' });
    }
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid subscribe payload', errors: parsedBody.error.issues });
    }
    if (!(await isSuperAdmin(req.user?.userId))) {
        return res.status(403).json({ message: 'Forbidden: superadmin role required' });
    }
    const { planId, seatCount, extraSpecialDiscountPercent } = parsedBody.data;
    try {
        const planResult = await db.query(`SELECT id, billing_cycle, base_price, offer_discount_percent, special_discount_percent, group_discount_percent, max_users_for_group_discount
       FROM subscription_plans
       WHERE id = $1::uuid
         AND is_active = true
       LIMIT 1`, [planId]);
        if ((planResult.rowCount ?? 0) === 0) {
            return res.status(404).json({ message: 'Plan not found or inactive' });
        }
        const plan = planResult.rows[0];
        const base = Number(plan.base_price || 0) * seatCount;
        const offer = Number(plan.offer_discount_percent || 0);
        const special = Number(plan.special_discount_percent || 0) + extraSpecialDiscountPercent;
        const groupEligible = seatCount >= Number(plan.max_users_for_group_discount || 0);
        const groupDiscount = groupEligible ? Number(plan.group_discount_percent || 0) : 0;
        const totalDiscountPct = Math.min(offer + special + groupDiscount, 90);
        const finalPrice = Number((base * (1 - totalDiscountPct / 100)).toFixed(2));
        await db.query(`UPDATE organization_subscriptions
       SET status = 'expired', updated_at = NOW()
       WHERE organization_id = $1::uuid
         AND status IN ('trialing', 'active', 'past_due')`, [organizationId]);
        const created = await db.query(`INSERT INTO organization_subscriptions (
         organization_id, plan_id, status, starts_at, ends_at, final_price,
         seat_count, offer_discount_percent, special_discount_percent, group_discount_percent
       )
       VALUES (
         $1::uuid, $2::uuid, 'active', NOW(), NOW() + $3::interval, $4, $5, $6, $7, $8
       )
       RETURNING *`, [organizationId, planId, getCycleInterval(plan.billing_cycle), finalPrice, seatCount, offer, special, groupDiscount]);
        const subscriptionRow = created.rows[0];
        const planDetails = await db.query(`SELECT name, membership_tier, billing_cycle FROM subscription_plans WHERE id = $1::uuid LIMIT 1`, [planId]);
        const planMeta = planDetails.rows[0] || {};
        await db.query(`INSERT INTO invoices (
         organization_id, subscription_id, plan_id, invoice_number, status, billing_kind,
         plan_name, membership_tier, billing_cycle, seat_count, subtotal, discount_total, amount_due,
         period_start, period_end, due_at
       )
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'pending', 'subscription',
         $5, $6, $7, $8, $9, $10, $11,
         $12, $13, $14)`, [
            organizationId,
            subscriptionRow.id,
            planId,
            nextInvoiceNumber(),
            planMeta.name || null,
            planMeta.membership_tier || null,
            planMeta.billing_cycle || null,
            seatCount,
            base,
            Number((base - finalPrice).toFixed(2)),
            finalPrice,
            subscriptionRow.starts_at,
            subscriptionRow.ends_at,
            subscriptionRow.ends_at,
        ]);
        void eventBus.publish({
            type: 'billing.subscription.activated',
            source: 'auth-service',
            organizationId,
            userId: req.user?.userId,
            payload: {
                subscriptionId: subscriptionRow.id,
                planId,
                seatCount,
                finalPrice,
            },
        });
        void eventBus.publish({
            type: 'billing.invoice.issued',
            source: 'auth-service',
            organizationId,
            userId: req.user?.userId,
            payload: {
                subscriptionId: subscriptionRow.id,
                amountDue: finalPrice,
                planName: planMeta.name,
            },
        });
        return res.status(201).json(subscriptionRow);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to subscribe organization' });
    }
});
billingRouter.post('/organizations/:organizationId/trial/reset', requireAuth, async (req, res) => {
    const organizationId = req.params.organizationId;
    if (!organizationId) {
        return res.status(400).json({ message: 'Invalid organization id' });
    }
    if (!(await isSuperAdmin(req.user?.userId))) {
        return res.status(403).json({ message: 'Forbidden: superadmin role required' });
    }
    await db.query(`UPDATE organization_subscriptions
     SET status = 'expired', updated_at = NOW()
     WHERE organization_id = $1::uuid
       AND status IN ('trialing', 'active', 'past_due')`, [organizationId]);
    const trial = await enforceSubscriptionState(organizationId);
    return res.json(trial);
});
billingRouter.get('/organizations/:organizationId/invoices', requireAuth, async (req, res) => {
    const organizationId = req.params.organizationId;
    if (!organizationId) {
        return res.status(400).json({ message: 'Invalid organization id' });
    }
    const access = await isAdminOrSuper(req.user?.userId, organizationId);
    if (!access.ok && req.user?.organizationId !== organizationId) {
        return res.status(403).json({ message: 'Forbidden for this organization' });
    }
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';
    const params = [organizationId];
    const where = [`i.organization_id = $1::uuid`];
    if (status && ['pending', 'paid', 'expired', 'renewed', 'cancelled'].includes(status)) {
        params.push(status);
        where.push(`i.status = $${params.length}`);
    }
    if (from) {
        params.push(from);
        where.push(`i.issued_at >= $${params.length}::timestamptz`);
    }
    if (to) {
        params.push(to);
        where.push(`i.issued_at <= $${params.length}::timestamptz`);
    }
    const result = await db.query(`SELECT i.*, o.name AS organization_name, o.subdomain AS organization_subdomain
     FROM invoices i
     LEFT JOIN organizations o ON o.id = i.organization_id
     WHERE ${where.join(' AND ')}
     ORDER BY i.issued_at DESC NULLS LAST, i.created_at DESC
     LIMIT 200`, params);
    return res.json({ invoices: result.rows.map(mapInvoiceRow) });
});
billingRouter.get('/invoices/pending', requireAuth, async (req, res) => {
    if (!(await isSuperAdmin(req.user?.userId))) {
        return res.status(403).json({ message: 'Forbidden: superadmin role required' });
    }
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const result = await db.query(`SELECT i.*, o.name AS organization_name, o.subdomain AS organization_subdomain
     FROM invoices i
     LEFT JOIN organizations o ON o.id = i.organization_id
     WHERE i.status = 'pending'
     ORDER BY i.due_at ASC NULLS LAST, i.issued_at DESC
     LIMIT $1`, [limit]);
    return res.json({ invoices: result.rows.map(mapInvoiceRow) });
});
billingRouter.get('/invoices/:invoiceId', requireAuth, async (req, res) => {
    const invoiceId = req.params.invoiceId;
    if (!invoiceId)
        return res.status(400).json({ message: 'Invalid invoice id' });
    const result = await db.query(`SELECT i.*, o.name AS organization_name, o.subdomain AS organization_subdomain
     FROM invoices i
     LEFT JOIN organizations o ON o.id = i.organization_id
     WHERE i.id = $1::uuid LIMIT 1`, [invoiceId]);
    if ((result.rowCount ?? 0) === 0)
        return res.status(404).json({ message: 'Invoice not found' });
    const row = result.rows[0];
    const access = await isAdminOrSuper(req.user?.userId, row.organization_id);
    if (!access.ok && req.user?.organizationId !== row.organization_id) {
        return res.status(403).json({ message: 'Forbidden for this invoice' });
    }
    return res.json({ invoice: mapInvoiceRow(row) });
});
const payInvoiceSchema = z.object({
    paymentMethod: z.string().trim().min(2).max(40).default('cashfree'),
    paymentReference: z.string().trim().min(2).max(120).optional(),
    notes: z.string().trim().max(500).optional(),
});
billingRouter.post('/invoices/:invoiceId/pay', requireAuth, async (req, res) => {
    const invoiceId = req.params.invoiceId;
    if (!invoiceId)
        return res.status(400).json({ message: 'Invalid invoice id' });
    const parsed = payInvoiceSchema.safeParse(req.body || {});
    if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid payment payload', errors: parsed.error.issues });
    }
    const lookup = await db.query(`SELECT organization_id, subscription_id, status FROM invoices WHERE id = $1::uuid LIMIT 1`, [invoiceId]);
    if ((lookup.rowCount ?? 0) === 0)
        return res.status(404).json({ message: 'Invoice not found' });
    const row = lookup.rows[0];
    if (row.status === 'paid')
        return res.status(400).json({ message: 'Invoice already marked paid' });
    const access = await isAdminOrSuper(req.user?.userId, row.organization_id);
    if (!access.ok)
        return res.status(403).json({ message: 'Forbidden: admin or superadmin required' });
    const paymentReference = parsed.data.paymentReference || `PG-${Date.now()}`;
    const result = await db.query(`UPDATE invoices
     SET status = 'paid',
         paid_at = NOW(),
         payment_method = $2,
         payment_reference = $3,
         notes = COALESCE($4, notes),
         updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING *`, [invoiceId, parsed.data.paymentMethod, paymentReference, parsed.data.notes || null]);
    if (row.subscription_id) {
        await db.query(`UPDATE organization_subscriptions
       SET status = 'active', updated_at = NOW()
       WHERE id = $1::uuid AND status IN ('trialing', 'past_due', 'expired')`, [row.subscription_id]);
    }
    const paidInvoice = mapInvoiceRow(result.rows[0]);
    void eventBus.publish({
        type: 'billing.invoice.paid',
        source: 'auth-service',
        organizationId: paidInvoice.organizationId,
        userId: req.user?.userId,
        payload: {
            invoiceId: paidInvoice.id,
            amountDue: paidInvoice.amountDue,
            paymentMethod: paidInvoice.paymentMethod,
            paymentReference: paidInvoice.paymentReference,
        },
    });
    return res.json({ invoice: paidInvoice });
});
billingRouter.post('/organizations/:organizationId/renew', requireAuth, async (req, res) => {
    const organizationId = req.params.organizationId;
    if (!organizationId)
        return res.status(400).json({ message: 'Invalid organization id' });
    const access = await isAdminOrSuper(req.user?.userId, organizationId);
    if (!access.ok)
        return res.status(403).json({ message: 'Forbidden: admin or superadmin required' });
    const current = await db.query(`SELECT s.*, p.name AS plan_name, p.membership_tier, p.billing_cycle, p.base_price
     FROM organization_subscriptions s
     LEFT JOIN subscription_plans p ON p.id = s.plan_id
     WHERE s.organization_id = $1::uuid
     ORDER BY s.created_at DESC
     LIMIT 1`, [organizationId]);
    if ((current.rowCount ?? 0) === 0 || !current.rows[0].plan_id) {
        return res.status(400).json({ message: 'No active plan to renew. Subscribe first.' });
    }
    const sub = current.rows[0];
    await db.query(`UPDATE organization_subscriptions
     SET status = 'expired', updated_at = NOW()
     WHERE organization_id = $1::uuid AND status IN ('trialing', 'active', 'past_due')`, [organizationId]);
    await db.query(`UPDATE invoices SET status = 'renewed', updated_at = NOW()
     WHERE organization_id = $1::uuid AND status = 'pending'`, [organizationId]);
    const interval = getCycleInterval(sub.billing_cycle);
    const seatCount = Number(sub.seat_count || 1);
    const finalPrice = Number(sub.final_price || 0);
    const created = await db.query(`INSERT INTO organization_subscriptions (
       organization_id, plan_id, status, starts_at, ends_at, final_price, seat_count,
       offer_discount_percent, special_discount_percent, group_discount_percent
     )
     VALUES ($1::uuid, $2::uuid, 'active', NOW(), NOW() + $3::interval, $4, $5, $6, $7, $8)
     RETURNING *`, [
        organizationId,
        sub.plan_id,
        interval,
        finalPrice,
        seatCount,
        Number(sub.offer_discount_percent || 0),
        Number(sub.special_discount_percent || 0),
        Number(sub.group_discount_percent || 0),
    ]);
    const newSub = created.rows[0];
    await db.query(`INSERT INTO invoices (
       organization_id, subscription_id, plan_id, invoice_number, status, billing_kind,
       plan_name, membership_tier, billing_cycle, seat_count, subtotal, discount_total, amount_due,
       period_start, period_end, due_at
     )
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'pending', 'renewal',
       $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`, [
        organizationId,
        newSub.id,
        sub.plan_id,
        nextInvoiceNumber(),
        sub.plan_name || null,
        sub.membership_tier || null,
        sub.billing_cycle || null,
        seatCount,
        Number(sub.base_price || finalPrice) * seatCount,
        Math.max(Number(sub.base_price || finalPrice) * seatCount - finalPrice, 0),
        finalPrice,
        newSub.starts_at,
        newSub.ends_at,
        newSub.ends_at,
    ]);
    void eventBus.publish({
        type: 'billing.subscription.renewed',
        source: 'auth-service',
        organizationId,
        userId: req.user?.userId,
        payload: { subscriptionId: newSub.id, planId: sub.plan_id },
    });
    return res.status(201).json({ subscription: newSub });
});
billingRouter.post('/organizations/:organizationId/deactivate', requireAuth, async (req, res) => {
    const organizationId = req.params.organizationId;
    if (!organizationId)
        return res.status(400).json({ message: 'Invalid organization id' });
    const access = await isAdminOrSuper(req.user?.userId, organizationId);
    if (!access.ok)
        return res.status(403).json({ message: 'Forbidden: admin or superadmin required' });
    await db.query(`UPDATE organization_subscriptions
     SET status = 'cancelled', updated_at = NOW()
     WHERE organization_id = $1::uuid AND status IN ('trialing', 'active', 'past_due')`, [organizationId]);
    await db.query(`UPDATE invoices SET status = 'cancelled', updated_at = NOW()
     WHERE organization_id = $1::uuid AND status = 'pending'`, [organizationId]);
    void eventBus.publish({
        type: 'billing.subscription.cancelled',
        source: 'auth-service',
        organizationId,
        userId: req.user?.userId,
        payload: {},
    });
    return res.json({ message: 'Subscription deactivated' });
});
