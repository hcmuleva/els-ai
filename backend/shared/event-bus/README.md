# @els-ai/event-bus

Shared pub/sub + push-notification primitive used by every backend service.

## Purpose
- Decouple domain services so that **no service writes to another service's data**.
- Cross-service communication happens through **named domain events** instead of direct HTTP calls.
- Push notifications to clients (org admins, students, parents) flow through the same provider so we have one wire format.

## Implementations
Chosen automatically by `createEventBus({ source })`:
1. **`AblyEventBus`** — used when `ABLY_API_KEY` is set. Publishes to `els-ai.events.<eventType>` channels. Also implements `PushNotifier.notify({ channel, name, data })` for client-facing push channels such as `org.<orgId>.notifications`.
2. **`InMemoryEventBus`** — default fallback. EventEmitter-style, in-process only. Useful for tests and single-service local dev.

## Domain events catalog
Defined as a string union in `src/types.ts`:

```
auth.user.logged_in
auth.user.registered
org.created
org.updated
user.created
user.role.changed
student.created
teacher.assigned
classroom.scheduled
classroom.ended
content.published
topic.created
quiz.created
quiz.submitted
assignment.created
assignment.submitted
billing.subscription.activated
billing.subscription.renewed
billing.subscription.cancelled
billing.invoice.issued
billing.invoice.paid
billing.invoice.expired
notification.requested
ai.draft.ready
```

## Usage
```ts
import { getEventBus } from '@els-ai/event-bus';

const eventBus = getEventBus({ source: 'auth-service' });

await eventBus.publish({
  type: 'billing.invoice.paid',
  source: 'auth-service',
  organizationId,
  payload: { invoiceId, amountDue },
});

await eventBus.subscribe('billing.invoice.paid', async (event) => {
  // … react to it
});
```

## Push notifications (Ably only)
```ts
import { AblyEventBus } from '@els-ai/event-bus';

if (eventBus instanceof AblyEventBus) {
  await eventBus.notify({
    channel: `org.${organizationId}.notifications`,
    name: 'invoice-issued',
    data: { title: 'New invoice issued', amount: 1999 },
  });
}
```

## Environment
| Var | Default | Description |
|---|---|---|
| `ABLY_API_KEY` | _empty_ | When set, real-time bus is used. When empty, in-memory fallback is used and a warning is logged. |

## Notes
- **In-memory bus does not cross processes.** Subscribers in one Node process won't receive events published in another. Use Ably in any environment with more than one service running.
- Events are fire-and-forget; handlers should be idempotent.
- Event payloads are typed at the call-site via the generic param on `publish` / `subscribe`.
