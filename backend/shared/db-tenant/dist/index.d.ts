import type { NextFunction, Response } from 'express';
import type { Pool, PoolClient, QueryArrayConfig, QueryConfig, QueryResult, QueryResultRow } from 'pg';
import type { AuthenticatedRequest } from '@els-ai/internal-auth';
export type TenantDb = {
    query: <R extends QueryResultRow = any>(text: string | QueryConfig<any> | QueryArrayConfig<any>, values?: any[]) => Promise<QueryResult<R>>;
    connect: () => Promise<PoolClient>;
    end: () => Promise<void>;
    pool: Pool;
    withTenantContext: <T>(orgId: string, userId: string, fn: () => Promise<T>) => Promise<T>;
};
export declare function wrapPoolWithTenancy(pool: Pool): TenantDb;
export declare function createTenantContextMiddleware(): (req: AuthenticatedRequest, _res: Response, next: NextFunction) => void;
export declare function isTenantContextActive(): boolean;
export declare function getTenantContext(): {
    orgId: string;
    userId: string;
} | null;
//# sourceMappingURL=index.d.ts.map