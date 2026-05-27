import { eventBus } from './bus.js';
export async function registerClassroomNotificationHandlers() {
    await eventBus.subscribe('classroom.scheduled', async (event) => {
        console.log(`[classroom-service] classroom.scheduled → org=${event.organizationId}`, event.payload);
    });
    await eventBus.subscribe('classroom.ended', async (event) => {
        console.log(`[classroom-service] classroom.ended → org=${event.organizationId}`, event.payload);
    });
}
