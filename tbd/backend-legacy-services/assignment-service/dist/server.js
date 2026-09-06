import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { createTenantContextMiddleware } from '@els-ai/db-tenant';
import { db } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { assignmentsRouter } from './routes/assignments.js';
config();
const PORT = Number(process.env.PORT || 4011);
const tenantContext = createTenantContextMiddleware();
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'assignment-service' });
});
app.use('/assignments', requireAuth, tenantContext, assignmentsRouter);
async function bootstrap() {
    app.listen(PORT, () => {
        console.log(`Assignment Service listening on http://localhost:${PORT}`);
    });
}
bootstrap().catch(async (error) => {
    console.error('Assignment Service bootstrap failed:', error);
    await db.end();
    process.exit(1);
});
