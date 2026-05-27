import { AblyEventBus } from './ably.js';
import { InMemoryEventBus } from './in-memory.js';
import { EventBus, PushChannel, PushNotifier } from './types.js';

export * from './types.js';
export { InMemoryEventBus } from './in-memory.js';
export { AblyEventBus } from './ably.js';

let singleton: (EventBus & Partial<PushNotifier>) | null = null;

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
  if (!singleton) {
    singleton = createEventBus(options);
  }
  return singleton;
}

export type PushPayload = PushChannel;
