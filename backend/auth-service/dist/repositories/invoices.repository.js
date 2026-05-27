import { db } from '../db.js';
export const invoicesRepository = {
    async findById(id) {
        const result = await db.query(`SELECT i.*, o.name AS organization_name, o.subdomain AS organization_subdomain
       FROM invoices i
       LEFT JOIN organizations o ON o.id = i.organization_id
       WHERE i.id = $1::uuid
       LIMIT 1`, [id]);
        return result.rows[0] || null;
    },
    async listForOrganization(organizationId, filters) {
        const params = [organizationId];
        const where = [`i.organization_id = $1::uuid`];
        if (filters.status) {
            params.push(filters.status);
            where.push(`i.status = $${params.length}`);
        }
        if (filters.from) {
            params.push(filters.from);
            where.push(`i.issued_at >= $${params.length}::timestamptz`);
        }
        if (filters.to) {
            params.push(filters.to);
            where.push(`i.issued_at <= $${params.length}::timestamptz`);
        }
        const result = await db.query(`SELECT i.*, o.name AS organization_name, o.subdomain AS organization_subdomain
       FROM invoices i
       LEFT JOIN organizations o ON o.id = i.organization_id
       WHERE ${where.join(' AND ')}
       ORDER BY i.issued_at DESC NULLS LAST, i.created_at DESC
       LIMIT 200`, params);
        return result.rows;
    },
    async markPaid(id, paymentMethod, paymentReference, notes) {
        const result = await db.query(`UPDATE invoices
       SET status = 'paid',
           paid_at = NOW(),
           payment_method = $2,
           payment_reference = $3,
           notes = COALESCE($4, notes),
           updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING *`, [id, paymentMethod, paymentReference, notes || null]);
        return result.rows[0] || null;
    },
};
