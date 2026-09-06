import { EventBus, PushChannel, PushNotifier } from './types.js';
export * from './types.js';
export { InMemoryEventBus } from './in-memory.js';
export { AblyEventBus } from './ably.js';
export type EventBusOptions = {
    source: string;
    apiKey?: string;
    channelPrefix?: string;
};
export declare function createEventBus(options: EventBusOptions): EventBus & Partial<PushNotifier>;
export declare function getEventBus(options: EventBusOptions): EventBus & Partial<PushNotifier>;
export type PushPayload = PushChannel;
//# sourceMappingURL=index.d.ts.map