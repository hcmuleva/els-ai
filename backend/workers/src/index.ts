import { config } from 'dotenv';
import { closeDb } from '@els-ai/db-runtime';
import { registerNotificationHandlers as registerAuthNotificationHandlers } from '../../core-api/src/services/auth/events/notifications.js';
import { registerNotificationHandlers as registerCoreNotificationHandlers } from '../../core-api/src/services/notification/events/handlers.js';
import { startScheduler as startStoryScheduler } from '../../core-api/src/services/story/scheduler.js';
import { startScheduler as startNotificationScheduler } from '../../core-api/src/services/notification/scheduler/runner.js';

config();

const workerMode = process.env.WORKER_MODE || 'core';

async function start() {
  if (workerMode === 'core' || workerMode === 'notifications') {
    await registerAuthNotificationHandlers();
    await registerCoreNotificationHandlers();
    startNotificationScheduler();
  }

  if (workerMode === 'core' || workerMode === 'story-scheduler') {
    startStoryScheduler();
  }

  console.log(`[els-workers] started mode=${workerMode}`);
}

async function shutdown(signal: string) {
  console.log(`[els-workers] received ${signal}, shutting down`);
  await closeDb();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

start().catch(async (error) => {
  console.error('[els-workers] startup failed', error);
  await closeDb();
  process.exit(1);
});
