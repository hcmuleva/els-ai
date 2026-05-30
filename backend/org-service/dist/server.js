import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { createTenantContextMiddleware } from '@els-ai/db-tenant';
import { db } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { organizationsRouter } from './routes/organizations.js';
config();
const PORT = Number(process.env.PORT || 4012);
const tenantContext = createTenantContextMiddleware();
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'org-service' });
});
app.use('/organizations', requireAuth, tenantContext, organizationsRouter);
async function bootstrap() {
    // Schema is managed by /migrations/* now. The legacy runOrgMigrations
    // call is removed because els_app cannot run DDL and els_admin is not
    // the table owner. See docs/RLS_ROLLOUT.md §3.5.
    app.listen(PORT, () => {
        console.log(`Org Service listening on http://localhost:${PORT}`);
    });
}
bootstrap().catch(async (error) => {
    console.error('Org Service bootstrap failed:', error);
    await db.end();
    process.exit(1);
});
