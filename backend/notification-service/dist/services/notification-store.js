import { AblyEventBus } from '@els-ai/event-bus';
import { db } from '../db.js';
import { eventBus } from '../events/bus.js';
export const DEFAULT_EXPIRY_DAYS = 5;
function channelFor(organizationId, userId) {
    return `notification:${organizationId}:${userId}`;
}
async function pushRealtime(name, channel, data) {
    if (eventBus instanceof AblyEventBus) {
        const push = { channel, name, data };
        try {
            await eventBus.notify(push);
        }
        catch (err) {
            console.error('[notification-service] ably notify failed', { channel, name, err });
        }
    }
}
export const NotificationStore = {
    async create(input) {
        const expiryDays = input.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
        const result = await db.query(`INSERT INTO notifications
         (user_id, organization_id, type, category, title, message,
          cta_label, cta_route, metadata, source_event_id, parent_notification_id, expiry_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, NOW() + ($12 || ' days')::interval)
       ON CONFLICT (user_id, source_event_id, type) WHERE source_event_id IS NOT NULL DO NOTHING
       RETURNING *`, [
            input.userId,
            input.organizationId,
            input.type,
            input.category ?? 'system',
            input.title,
            input.message,
            input.ctaLabel ?? null,
            input.ctaRoute ?? null,
            JSON.stringify(input.metadata ?? {}),
            input.sourceEventId ?? null,
            input.parentNotificationId ?? null,
            String(expiryDays),
        ]);
        const row = result.rows[0];
        if (!row)
            return null;
        await pushRealtime('new_notification', channelFor(row.organization_id, row.user_id), { notification: row });
        return row;
    },
    async aggregateActivity(input) {
        const audienceLabel = input.audienceType === 'CHILD_ACTIVITY' ? 'parent' : 'teacher';
        const existing = await db.query(`SELECT * FROM notifications
        WHERE user_id = $1::uuid
          AND type = $2
          AND deleted_at IS NULL
          AND expiry_at > NOW()
          AND created_at >= NOW() - ($3::int || ' minutes')::interval
          AND metadata ->> 'classroomId' = $4
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`, [input.userId, input.audienceType, input.windowMinutes, input.classroomId]);
        const prevMeta = existing.rows[0]?.metadata || {};
        const counts = {
            quiz: Number(prevMeta?.counts?.quiz || 0),
            assignment: Number(prevMeta?.counts?.assignment || 0),
        };
        if (input.activityKind === 'quiz_submitted')
            counts.quiz += 1;
        else
            counts.assignment += 1;
        const studentsSet = new Set(Array.isArray(prevMeta?.students) ? prevMeta.students : []);
        studentsSet.add(input.studentUserId);
        const students = Array.from(studentsSet);
        const segs = [];
        if (counts.quiz > 0)
            segs.push(`${counts.quiz} quiz${counts.quiz > 1 ? 'zes' : ''}`);
        if (counts.assignment > 0)
            segs.push(`${counts.assignment} assignment${counts.assignment > 1 ? 's' : ''}`);
        const segText = segs.join(' and ');
        const title = audienceLabel === 'parent'
            ? `Activity in "${input.classroomTitle}"`
            : `New activity in "${input.classroomTitle}"`;
        const message = audienceLabel === 'parent'
            ? (students.length > 1
                ? `${students.length} students completed ${segText}.`
                : `${input.studentName || 'Your child'} completed ${segText}.`)
            : `${segText} from ${students.length} student${students.length > 1 ? 's' : ''}.`;
        const metadata = {
            classroomId: input.classroomId,
            classroomTitle: input.classroomTitle,
            audience: audienceLabel,
            counts,
            students,
            lastStudentUserId: input.studentUserId,
            lastActivityKind: input.activityKind,
            lastAt: new Date().toISOString(),
        };
        if (existing.rows.length > 0) {
            const row = existing.rows[0];
            const updated = await db.query(`UPDATE notifications
            SET title = $2,
                message = $3,
                metadata = $4::jsonb,
                status = 'unread',
                read_at = NULL,
                created_at = NOW(),
                cta_label = $5,
                cta_route = $6
          WHERE id = $1::uuid
          RETURNING *`, [row.id, title, message, JSON.stringify(metadata), input.ctaLabel, input.ctaRoute]);
            const newRow = updated.rows[0];
            if (newRow) {
                await pushRealtime('new_notification', channelFor(newRow.organization_id, newRow.user_id), { notification: newRow });
            }
            return newRow ?? null;
        }
        return this.create({
            userId: input.userId,
            organizationId: input.organizationId,
            type: input.audienceType,
            category: 'classroom',
            title,
            message,
            ctaLabel: input.ctaLabel,
            ctaRoute: input.ctaRoute,
            metadata,
            sourceEventId: input.sourceEventId,
        });
    },
    async createMany(inputs) {
        const created = [];
        for (const input of inputs) {
            const row = await this.create(input);
            if (row)
                created.push(row);
        }
        return created;
    },
    async listForUser(userId, opts = {}) {
        const params = [userId];
        const where = ['user_id = $1::uuid', 'deleted_at IS NULL', 'expiry_at > NOW()'];
        if (opts.status) {
            params.push(opts.status);
            where.push(`status = $${params.length}`);
        }
        const limit = Math.min(opts.limit ?? 30, 100);
        const offset = opts.offset ?? 0;
        const countResult = await db.query(`SELECT COUNT(*)::text AS total FROM notifications WHERE ${where.join(' AND ')}`, params);
        params.push(limit, offset);
        const dataResult = await db.query(`SELECT * FROM notifications WHERE ${where.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return { rows: dataResult.rows, total: Number(countResult.rows[0]?.total || 0) };
    },
    async unreadCount(userId) {
        const result = await db.query(`SELECT COUNT(*)::text AS total FROM notifications
         WHERE user_id = $1::uuid AND status = 'unread' AND deleted_at IS NULL AND expiry_at > NOW()`, [userId]);
        return Number(result.rows[0]?.total || 0);
    },
    async markRead(userId, notificationId) {
        const result = await db.query(`UPDATE notifications
         SET status = 'read', read_at = NOW()
         WHERE id = $1::uuid AND user_id = $2::uuid AND deleted_at IS NULL
         RETURNING *`, [notificationId, userId]);
        const row = result.rows[0];
        if (row) {
            await pushRealtime('notification_read', channelFor(row.organization_id, row.user_id), { id: row.id });
        }
        return row ?? null;
    },
    async markAllRead(userId, organizationId) {
        const result = await db.query(`UPDATE notifications SET status = 'read', read_at = NOW()
         WHERE user_id = $1::uuid AND status = 'unread' AND deleted_at IS NULL`, [userId]);
        await pushRealtime('notifications_cleared', channelFor(organizationId, userId), { kind: 'read_all' });
        return result.rowCount ?? 0;
    },
    async deleteOne(userId, organizationId, notificationId) {
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query(`UPDATE notifications SET deleted_at = NOW()
           WHERE id = $1::uuid AND user_id = $2::uuid AND deleted_at IS NULL
           RETURNING *`, [notificationId, userId]);
            const row = result.rows[0];
            if (!row) {
                await client.query('ROLLBACK');
                return false;
            }
            await client.query(`UPDATE notifications SET status = 'read', read_at = COALESCE(read_at, NOW())
           WHERE parent_notification_id = $1::uuid AND deleted_at IS NULL`, [row.id]);
            await client.query('COMMIT');
            await pushRealtime('notification_deleted', channelFor(organizationId, userId), { id: row.id });
            return true;
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    },
    async deleteRange(userId, organizationId, range) {
        const cutoffSql = {
            hour: "NOW() - interval '1 hour'",
            day: "NOW() - interval '1 day'",
            week: "NOW() - interval '7 days'",
            all: "'epoch'::timestamptz",
        };
        const result = await db.query(`UPDATE notifications SET deleted_at = NOW()
         WHERE user_id = $1::uuid AND deleted_at IS NULL
           AND created_at >= ${cutoffSql[range]}`, [userId]);
        await pushRealtime('notifications_cleared', channelFor(organizationId, userId), { kind: range });
        return result.rowCount ?? 0;
    },
    async deleteAllRead(userId, organizationId) {
        const result = await db.query(`UPDATE notifications SET deleted_at = NOW()
         WHERE user_id = $1::uuid AND deleted_at IS NULL AND status = 'read'`, [userId]);
        await pushRealtime('notifications_cleared', channelFor(organizationId, userId), { kind: 'read_all' });
        return result.rowCount ?? 0;
    },
    async expireClassroomCtas(classroomId, reason) {
        const affectedTypes = ['CLASS_LIVE', 'CLASS_SCHEDULED', 'CLASS_REMINDER_1H', 'CLASS_REMINDER_10M'];
        const updatedLabel = reason === 'deleted' ? 'Class cancelled' : 'Class ended';
        const result = await db.query(`UPDATE notifications
         SET cta_route = NULL,
             cta_label = NULL,
             title = $3,
             metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('expired', true, 'expiredReason', $4::text),
             status = CASE WHEN status = 'unread' THEN 'read' ELSE status END,
             read_at = COALESCE(read_at, NOW())
       WHERE deleted_at IS NULL
         AND type = ANY($1::text[])
         AND metadata ->> 'classroomId' = $2
       RETURNING *`, [affectedTypes, classroomId, updatedLabel, reason]);
        for (const row of result.rows) {
            await pushRealtime('notifications_cleared', channelFor(row.organization_id, row.user_id), {
                kind: 'classroom_invalidated',
                classroomId,
                reason,
            });
        }
        return { rows: result.rows };
    },
    async teacherActivityCounts(userId) {
        const result = await db.query(`SELECT metadata ->> 'classroomId' AS classroom_id,
              SUM(
                COALESCE((metadata -> 'counts' ->> 'quiz')::int, 0)
                + COALESCE((metadata -> 'counts' ->> 'assignment')::int, 0)
              )::text AS unread
         FROM notifications
        WHERE user_id = $1::uuid
          AND deleted_at IS NULL
          AND expiry_at > NOW()
          AND status = 'unread'
          AND type = 'STUDENT_ACTIVITY'
          AND metadata ->> 'classroomId' IS NOT NULL
       GROUP BY metadata ->> 'classroomId'`, [userId]);
        return result.rows
            .map((r) => ({ classroomId: r.classroom_id, unread: Number(r.unread) }))
            .filter((row) => row.unread > 0);
    },
    async markTeacherActivitySeen(userId, classroomId) {
        const result = await db.query(`UPDATE notifications
         SET status = 'read', read_at = COALESCE(read_at, NOW())
       WHERE user_id = $1::uuid
         AND status = 'unread'
         AND type = 'STUDENT_ACTIVITY'
         AND metadata ->> 'classroomId' = $2
         AND deleted_at IS NULL`, [userId, classroomId]);
        return result.rowCount ?? 0;
    },
    async cleanupExpired() {
        const result = await db.query(`UPDATE notifications SET deleted_at = NOW()
         WHERE deleted_at IS NULL AND expiry_at < NOW()`);
        return result.rowCount ?? 0;
    },
};
