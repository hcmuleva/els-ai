import { AsyncLocalStorage } from 'node:async_hooks';
const tenantStore = new AsyncLocalStorage();
function readContext() {
    return tenantStore.getStore();
}
function escapeUuid(value) {
    if (!/^[0-9a-fA-F-]{36}$/.test(value)) {
        throw new Error(`Refusing to set tenant context with invalid UUID: ${value}`);
    }
    return value;
}
async function applyTenantSettings(client, ctx) {
    await client.query(`SET LOCAL app.org_id  = '${escapeUuid(ctx.orgId)}'`);
    await client.query(`SET LOCAL app.user_id = '${escapeUuid(ctx.userId)}'`);
}
export function wrapPoolWithTenancy(pool) {
    async function query(text, values) {
        const ctx = readContext();
        if (!ctx) {
            return (values === undefined ? pool.query(text) : pool.query(text, values));
        }
        if (ctx.client) {
            return (values === undefined ? ctx.client.query(text) : ctx.client.query(text, values));
        }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await applyTenantSettings(client, ctx);
            const result = (values === undefined ? await client.query(text) : await client.query(text, values));
            await client.query('COMMIT');
            return result;
        }
        catch (err) {
            await client.query('ROLLBACK').catch(() => undefined);
            throw err;
        }
        finally {
            client.release();
        }
    }
    async function connect() {
        const client = await pool.connect();
        const ctx = readContext();
        if (!ctx)
            return client;
        await client.query(`SET app.org_id  = '${escapeUuid(ctx.orgId)}'`);
        await client.query(`SET app.user_id = '${escapeUuid(ctx.userId)}'`);
        const origRelease = client.release.bind(client);
        client.release = (err) => {
            client
                .query(`RESET app.org_id; RESET app.user_id`)
                .catch(() => undefined)
                .finally(() => origRelease(err));
        };
        return client;
    }
    async function withTenantContext(orgId, userId, fn) {
        return tenantStore.run({ orgId, userId }, fn);
    }
    return {
        query,
        connect,
        end: () => pool.end(),
        pool,
        withTenantContext,
    };
}
export function createTenantContextMiddleware() {
    return function tenantContextMiddleware(req, _res, next) {
        const orgId = req.user?.organizationId;
        const userId = req.user?.userId;
        if (!orgId || !userId) {
            return next();
        }
        return tenantStore.run({ orgId, userId }, () => next());
    };
}
export function isTenantContextActive() {
    return Boolean(readContext());
}
export function getTenantContext() {
    const ctx = readContext();
    if (!ctx)
        return null;
    return { orgId: ctx.orgId, userId: ctx.userId };
}
//# sourceMappingURL=index.js.map