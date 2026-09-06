import { AblyEventBus } from './ably.js';
import { InMemoryEventBus } from './in-memory.js';
import { EventBus, PushChannel, PushNotifier } from './types.js';

export * from './types.js';
export { InMemoryEventBus } from './in-memory.js';
export { AblyEventBus } from './ably.js';

const singletons = new Map<string, EventBus & Partial<PushNotifier>>();

export type EventBusOptions = {
  source: string;
  apiKey?: string;
  channelPrefix?: string;
};

export function createEventBus(options: EventBusOptions): EventBus & Partial<PushNotifier> {
  const apiKey = options.apiKey ?? process.env.ABLY_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    return new AblyEventBus(options.source, apiKey, { channelPrefix: options.channelPrefix });
  }
  console.warn(
    `[event-bus] ABLY_API_KEY not set for source "${options.source}". Falling back to InMemoryEventBus (single-process only).`,
  );
  return new InMemoryEventBus(options.source);
}

export function getEventBus(options: EventBusOptions): EventBus & Partial<PushNotifier> {
  const existing = singletons.get(options.source);
  if (existing) {
    return existing;
  }

  const created = createEventBus(options);
  singletons.set(options.source, created);
  return created;
}

export type PushPayload = PushChannel;
