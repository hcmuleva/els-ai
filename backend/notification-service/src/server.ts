import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { createTenantContextMiddleware } from '@els-ai/db-tenant';
import { db } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { notificationsRouter } from './routes/notifications.js';
import { preferencesRouter } from './routes/preferences.js';
import { tokenRouter } from './routes/token.js';
import { registerNotificationHandlers } from './events/handlers.js';
import { startScheduler } from './scheduler/runner.js';

config();

const PORT = Number(process.env.PORT || 4013);
const tenantContext = createTenantContextMiddleware();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

app.use('/notifications/preferences', requireAuth, tenantContext, preferencesRouter);
app.use('/notifications/ably-token', requireAuth, tenantContext, tokenRouter);
app.use('/notifications', requireAuth, tenantContext, notificationsRouter);

async function bootstrap() {
  // Schema is managed by /migrations/* now. ensureSchema removed because
  // els_admin (the role this service connects as) is not the table owner.
  // See docs/RLS_ROLLOUT.md §3.5.
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
