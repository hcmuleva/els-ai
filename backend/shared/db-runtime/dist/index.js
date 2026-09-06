import { config } from 'dotenv';
import { Pool } from 'pg';
import { z } from 'zod';
import { wrapPoolWithTenancy } from '@els-ai/db-tenant';
config();
const databaseEnv = z.object({
    DATABASE_URL: z.string().url().optional(),
    DB_HOST: z.string().default('localhost'),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_NAME: z.string().default('els_ai_db'),
    DB_USER: z.string().default('postgres'),
    DB_PASSWORD: z.string().default('postgres'),
    DB_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30_000),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
});
let sharedDb;
function createPool() {
    const env = databaseEnv.parse(process.env);
    const poolConfig = env.DATABASE_URL
        ? { connectionString: env.DATABASE_URL }
        : {
            host: env.DB_HOST,
            port: env.DB_PORT,
            database: env.DB_NAME,
            user: env.DB_USER,
            password: env.DB_PASSWORD,
        };
    return new Pool({
        ...poolConfig,
        max: env.DB_POOL_MAX,
        idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
        connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
    });
}
export function getDb() {
    if (!sharedDb) {
        sharedDb = wrapPoolWithTenancy(createPool());
    }
    return sharedDb;
}
export async function closeDb() {
    if (!sharedDb)
        return;
    await sharedDb.end();
    sharedDb = undefined;
}
//# sourceMappingURL=index.js.map