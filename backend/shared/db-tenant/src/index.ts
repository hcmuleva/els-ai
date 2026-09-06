import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import type { Pool, PoolClient, QueryArrayConfig, QueryConfig, QueryResult, QueryResultRow } from 'pg';
import type { AuthenticatedRequest } from '@els-ai/internal-auth';

type TenantContext = {
  orgId: string;
  userId: string;
  client?: PoolClient;
};

const tenantStore = new AsyncLocalStorage<TenantContext>();

function readContext(): TenantContext | undefined {
  return tenantStore.getStore();
}

function escapeUuid(value: string): string {
  if (!/^[0-9a-fA-F-]{36}$/.test(value)) {
    throw new Error(`Refusing to set tenant context with invalid UUID: ${value}`);
  }
  return value;
}

async function applyTenantSettings(client: PoolClient, ctx: TenantContext): Promise<void> {
  await client.query(`SET LOCAL app.org_id  = '${escapeUuid(ctx.orgId)}'`);
  await client.query(`SET LOCAL app.user_id = '${escapeUuid(ctx.userId)}'`);
}

export type TenantDb = {
  query: <R extends QueryResultRow = any>(
    text: string | QueryConfig<any> | QueryArrayConfig<any>,
    values?: any[],
  ) => Promise<QueryResult<R>>;
  connect: () => Promise<PoolClient>;
  end: () => Promise<void>;
  pool: Pool;
  withTenantContext: <T>(orgId: string, userId: string, fn: () => Promise<T>) => Promise<T>;
};

export function wrapPoolWithTenancy(pool: Pool): TenantDb {
  async function query<R extends QueryResultRow = any>(
    text: string | QueryConfig<any> | QueryArrayConfig<any>,
    values?: any[],
  ): Promise<QueryResult<R>> {
    const ctx = readContext();
    if (!ctx) {
      return (values === undefined ? pool.query(text as any) : pool.query(text as any, values)) as Promise<QueryResult<R>>;
    }

    if (ctx.client) {
      return (values === undefined ? ctx.client.query(text as any) : ctx.client.query(text as any, values)) as Promise<QueryResult<R>>;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await applyTenantSettings(client, ctx);
      const result = (values === undefined ? await client.query(text as any) : await client.query(text as any, values)) as QueryResult<R>;
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async function connect(): Promise<PoolClient> {
    const client = await pool.connect();
    const ctx = readContext();
    if (!ctx) return client;

    await client.query(`SET app.org_id  = '${escapeUuid(ctx.orgId)}'`);
    await client.query(`SET app.user_id = '${escapeUuid(ctx.userId)}'`);

    const origRelease = client.release.bind(client) as (err?: Error | boolean) => void;
    (client as any).release = (err?: Error | boolean) => {
      client
        .query(`RESET app.org_id; RESET app.user_id`)
        .catch(() => undefined)
        .finally(() => origRelease(err));
    };
    return client;
  }

  async function withTenantContext<T>(orgId: string, userId: string, fn: () => Promise<T>): Promise<T> {
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
  return function tenantContextMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) {
      return next();
    }
    return tenantStore.run({ orgId, userId }, () => next());
  };
}

export function isTenantContextActive(): boolean {
  return Boolean(readContext());
}

export function getTenantContext(): { orgId: string; userId: string } | null {
  const ctx = readContext();
  if (!ctx) return null;
  return { orgId: ctx.orgId, userId: ctx.userId };
}
