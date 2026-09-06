import { randomUUID } from 'node:crypto';
import {
  DomainEvent,
  DomainEventHandler,
  DomainEventType,
  EventBus,
} from './types.js';

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<DomainEventType, Set<DomainEventHandler>>();

  constructor(private readonly source: string) {}

  async publish<TPayload>(event: Omit<DomainEvent<TPayload>, 'id' | 'occurredAt'>): Promise<void> {
    const full: DomainEvent<TPayload> = {
      ...event,
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      source: event.source || this.source,
    };
    const subs = this.handlers.get(full.type);
    if (!subs || subs.size === 0) return;
    for (const handler of subs) {
      try {
        await handler(full as DomainEvent);
      } catch (error) {
        console.error(`[event-bus] handler error for ${full.type}:`, error);
      }
    }
  }

  async subscribe<TPayload>(
    type: DomainEventType | DomainEventType[],
    handler: DomainEventHandler<TPayload>,
  ): Promise<() => void> {
    const types = Array.isArray(type) ? type : [type];
    types.forEach((t) => {
      const set = this.handlers.get(t) || new Set<DomainEventHandler>();
      set.add(handler as DomainEventHandler);
      this.handlers.set(t, set);
    });
    return () => {
      types.forEach((t) => this.handlers.get(t)?.delete(handler as DomainEventHandler));
    };
  }

  async close(): Promise<void> {
    this.handlers.clear();
  }
}
