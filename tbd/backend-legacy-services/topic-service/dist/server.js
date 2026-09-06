import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { createTenantContextMiddleware } from '@els-ai/db-tenant';
import { db } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { topicsRouter, catalogRouter, studentsRouter } from './routes/topics.js';
config();
const PORT = Number(process.env.PORT || 4010);
const tenantContext = createTenantContextMiddleware();
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'topic-service' });
});
app.use('/topics', requireAuth, tenantContext, topicsRouter);
app.use('/catalog/subjects', requireAuth, tenantContext, catalogRouter);
app.use('/students/subjects', requireAuth, tenantContext, studentsRouter);
async function bootstrap() {
    app.listen(PORT, () => {
        console.log(`Topic Service listening on http://localhost:${PORT}`);
    });
}
bootstrap().catch(async (error) => {
    console.error('Topic Service bootstrap failed:', error);
    await db.end();
    process.exit(1);
});
