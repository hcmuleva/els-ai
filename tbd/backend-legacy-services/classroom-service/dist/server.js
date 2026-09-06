import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { createTenantContextMiddleware } from '@els-ai/db-tenant';
import { db } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { classroomsRouter } from './routes/classrooms.js';
import { registerClassroomNotificationHandlers } from './events/notifications.js';
config();
const PORT = Number(process.env.PORT || 4006);
const tenantContext = createTenantContextMiddleware();
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'classroom-service' });
});
app.use('/classrooms', requireAuth, tenantContext, classroomsRouter);
async function bootstrap() {
    await registerClassroomNotificationHandlers();
    app.listen(PORT, () => {
        console.log(`Classroom Service listening on http://localhost:${PORT}`);
    });
}
bootstrap().catch(async (error) => {
    console.error('Classroom Service bootstrap failed:', error);
    await db.end();
    process.exit(1);
});
