import cron from 'node-cron';
import { db } from '../db.js';
import { NotificationStore, type CreateNotificationInput } from '../services/notification-store.js';
import { Targeting } from '../services/targeting.js';

type ScheduleRow = {
  id: string;
  classroom_id: string;
  organization_id: string;
  trigger_type: string;
  payload: { title?: string; startAt?: string };
};

async function fireDueSchedules() {
  const dueResult = await db.query<ScheduleRow>(
    `UPDATE notification_schedules SET status = 'fired'
       WHERE id IN (
         SELECT id FROM notification_schedules
          WHERE status = 'pending' AND fire_at <= NOW()
          ORDER BY fire_at ASC
          LIMIT 100
          FOR UPDATE SKIP LOCKED
       )
     RETURNING id, classroom_id, organization_id, trigger_type, payload`,
  );

  for (const row of dueResult.rows) {
    try {
      const { studentIds, parentByStudent } = await Targeting.resolveClassroom(row.classroom_id, row.organization_id);
      const isOneHour = row.trigger_type === 'CLASS_REMINDER_1H';
      const inputs: CreateNotificationInput[] = [];
      const title = row.payload?.title || 'class';
      const minsLabel = isOneHour ? '1 hour' : '10 minutes';
      const route = `/classroom/waiting/${row.classroom_id}`;

      const studentMessage = `${title} starts in ${minsLabel}.`;
      const parentMessage = `Your child's class "${title}" starts in ${minsLabel}.`;
      for (const studentId of studentIds) {
        inputs.push({
          userId: studentId,
          organizationId: row.organization_id,
          type: row.trigger_type,
          category: 'classroom',
          title: isOneHour ? 'Class in 1 hour' : 'Class starts soon',
          message: studentMessage,
          ctaLabel: 'View Class',
          ctaRoute: route,
          metadata: { classroomId: row.classroom_id },
          sourceEventId: row.id,
        });
        for (const parentId of (parentByStudent[studentId] || [])) {
          inputs.push({
            userId: parentId,
            organizationId: row.organization_id,
            type: row.trigger_type,
            category: 'classroom',
            title: isOneHour ? "Child's class in 1 hour" : "Child's class starts soon",
            message: parentMessage,
            metadata: { classroomId: row.classroom_id, studentUserId: studentId, audience: 'parent' },
            sourceEventId: row.id,
          });
        }
      }
      await NotificationStore.createMany(inputs);
    } catch (err) {
      console.error('[scheduler] failed to fire row', row.id, err);
    }
  }
}

export function startScheduler() {
  cron.schedule('*/30 * * * * *', () => {
    fireDueSchedules().catch((err) => console.error('[scheduler] tick failed', err));
  });
  cron.schedule('0 3 * * *', () => {
    NotificationStore.cleanupExpired().catch((err) => console.error('[scheduler] cleanup failed', err));
  });
  console.log('[notification-service] scheduler started');
}
