import { AblyEventBus } from './ably.js';
import { InMemoryEventBus } from './in-memory.js';
export * from './types.js';
export { InMemoryEventBus } from './in-memory.js';
export { AblyEventBus } from './ably.js';
const singletons = new Map();
export function createEventBus(options) {
    const apiKey = options.apiKey ?? process.env.ABLY_API_KEY;
    if (apiKey && apiKey.trim().length > 0) {
        return new AblyEventBus(options.source, apiKey, { channelPrefix: options.channelPrefix });
    }
    console.warn(`[event-bus] ABLY_API_KEY not set for source "${options.source}". Falling back to InMemoryEventBus (single-process only).`);
    return new InMemoryEventBus(options.source);
}
export function getEventBus(options) {
    const existing = singletons.get(options.source);
    if (existing) {
        return existing;
    }
    const created = createEventBus(options);
    singletons.set(options.source, created);
    return created;
}
//# sourceMappingURL=index.js.map