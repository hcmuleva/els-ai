import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { db, ensureSchema } from './db.js';
import { notificationsRouter } from './routes/notifications.js';
import { preferencesRouter } from './routes/preferences.js';
import { tokenRouter } from './routes/token.js';
import { registerNotificationHandlers } from './events/handlers.js';
import { startScheduler } from './scheduler/runner.js';
config();
const PORT = Number(process.env.PORT || 4013);
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'notification-service' });
});
app.use('/notifications/preferences', preferencesRouter);
app.use('/notifications/ably-token', tokenRouter);
app.use('/notifications', notificationsRouter);
async function bootstrap() {
    await ensureSchema();
    await registerNotificationHandlers();
    startScheduler();
    app.listen(PORT, () => {
        console.log(`Notification Service listening on http://localhost:${PORT}`);
    });
}
bootstrap().catch(async (error) => {
    console.error('Notification Service bootstrap failed:', error);
    await db.end();
    process.exit(1);
});
