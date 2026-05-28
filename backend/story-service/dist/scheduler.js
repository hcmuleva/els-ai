import { db } from './db.js';
import { StoryStore } from './services/store.js';
import { eventBus } from './events/bus.js';
/** End all live stories for the same org+class combination (excluding one story id). */
export async function endLiveStoriesForClass(orgId, classLevel, excludeId) {
    const classFilter = classLevel != null
        ? `AND class_level = $3`
        : `AND class_level IS NULL`;
    const params = [orgId, excludeId ?? '00000000-0000-0000-0000-000000000000'];
    if (classLevel != null)
        params.push(classLevel);
    await db.query(`UPDATE stories
        SET status = 'ended', ended_at = NOW(), updated_at = NOW()
      WHERE organization_id = $1::uuid
        AND status = 'live'
        AND id <> $2::uuid
        ${classFilter}`, params);
}
export function startScheduler() {
    const tick = async () => {
        try {
            // 1. Promote scheduled → live (end live story of the SAME class only)
            const due = await StoryStore.findDueScheduled();
            for (const row of due) {
                await endLiveStoriesForClass(row.organization_id, row.class_level, row.id);
                const updated = await db.query(`UPDATE stories SET status = 'live', published_at = NOW(), updated_at = NOW()
             WHERE id = $1::uuid AND organization_id = $2::uuid RETURNING *`, [row.id, row.organization_id]);
                if (!updated.rowCount)
                    continue;
                try {
                    await eventBus.publish({
                        type: 'story.live',
                        source: 'story-service',
                        organizationId: row.organization_id,
                        userId: row.created_by,
                        payload: { storyId: row.id, title: row.title, classLevel: row.class_level },
                    });
                }
                catch (err) {
                    console.error('[story-service] scheduler publish failed', err);
                }
            }
            // 2. Auto-end live stories whose published day is in the past (yesterday or earlier)
            await db.query(`
        UPDATE stories
           SET status = 'ended', ended_at = NOW(), updated_at = NOW()
         WHERE status = 'live'
           AND published_at IS NOT NULL
           AND published_at::date < CURRENT_DATE
      `);
        }
        catch (err) {
            console.error('[story-service] scheduler tick failed', err);
        }
    };
    setInterval(tick, 60_000); // check every minute
    tick().catch(() => undefined);
}
