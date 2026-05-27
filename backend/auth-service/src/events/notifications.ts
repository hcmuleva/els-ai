import { AblyEventBus, type PushChannel } from '@els-ai/event-bus';
import { eventBus } from './bus.js';

export async function registerNotificationHandlers() {
  await eventBus.subscribe('billing.invoice.issued', async (event) => {
    if (eventBus instanceof AblyEventBus) {
      const push: PushChannel = {
        channel: `org.${event.organizationId}.notifications`,
        name: 'invoice-issued',
        data: {
          title: 'New invoice issued',
          message: 'A new invoice is awaiting payment for your organization.',
          ...event.payload as Record<string, unknown>,
        },
      };
      await eventBus.notify(push);
    } else {
      console.log(`[notifications] invoice.issued → org=${event.organizationId}`, event.payload);
    }
  });

  await eventBus.subscribe('billing.invoice.paid', async (event) => {
    if (eventBus instanceof AblyEventBus) {
      const push: PushChannel = {
        channel: `org.${event.organizationId}.notifications`,
        name: 'invoice-paid',
        data: {
          title: 'Invoice paid',
          message: 'Your payment has been recorded.',
          ...event.payload as Record<string, unknown>,
        },
      };
      await eventBus.notify(push);
    } else {
      console.log(`[notifications] invoice.paid → org=${event.organizationId}`, event.payload);
    }
  });
}
