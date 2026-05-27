import { randomUUID } from 'node:crypto';
import * as Ably from 'ably';
import {
  DomainEvent,
  DomainEventHandler,
  DomainEventType,
  EventBus,
  PushChannel,
  PushNotifier,
} from './types.js';

const DEFAULT_CHANNEL_PREFIX = 'els-ai.events';

type Unsubscribe = () => void;

export class AblyEventBus implements EventBus, PushNotifier {
  private realtime: Ably.Realtime;
  private channelPrefix: string;
  private subscriptions = new Set<Unsubscribe>();

  constructor(
    private readonly source: string,
    private readonly apiKey: string,
    options?: { channelPrefix?: string },
  ) {
    this.channelPrefix = options?.channelPrefix || DEFAULT_CHANNEL_PREFIX;
    this.realtime = new Ably.Realtime({
      key: this.apiKey,
      clientId: `els-ai.${this.source}`,
      autoConnect: true,
    });
  }

  private channelNameFor(type: DomainEventType): string {
    return `${this.channelPrefix}.${type}`;
  }

  async publish<TPayload>(event: Omit<DomainEvent<TPayload>, 'id' | 'occurredAt'>): Promise<void> {
    const full: DomainEvent<TPayload> = {
      ...event,
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      source: event.source || this.source,
    };
    const channel = this.realtime.channels.get(this.channelNameFor(full.type));
    await channel.publish({ name: full.type, data: full });
  }

  async subscribe<TPayload>(
    type: DomainEventType | DomainEventType[],
    handler: DomainEventHandler<TPayload>,
  ): Promise<() => void> {
    const types = Array.isArray(type) ? type : [type];
    const off: Unsubscribe[] = [];
    for (const t of types) {
      const channel = this.realtime.channels.get(this.channelNameFor(t));
      const listener = async (message: Ably.Message) => {
        try {
          await handler(message.data as DomainEvent<TPayload>);
        } catch (error) {
          console.error(`[event-bus:ably] handler error for ${t}:`, error);
        }
      };
      await channel.subscribe(t, listener);
      const unsub = () => {
        channel.unsubscribe(t, listener);
      };
      off.push(unsub);
      this.subscriptions.add(unsub);
    }
    return () => off.forEach((fn) => fn());
  }

  async notify(push: PushChannel): Promise<void> {
    const channel = this.realtime.channels.get(push.channel);
    await channel.publish({ name: push.name || 'notification', data: push.data });
  }

  async close(): Promise<void> {
    for (const unsub of this.subscriptions) {
      try { unsub(); } catch (_e) { /* ignore */ }
    }
    this.subscriptions.clear();
    this.realtime.close();
  }
}
