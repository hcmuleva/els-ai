import { AblyEventBus } from './ably.js';
import { InMemoryEventBus } from './in-memory.js';
export * from './types.js';
export { InMemoryEventBus } from './in-memory.js';
export { AblyEventBus } from './ably.js';
let singleton = null;
export function createEventBus(options) {
    const apiKey = options.apiKey ?? process.env.ABLY_API_KEY;
    if (apiKey && apiKey.trim().length > 0) {
        return new AblyEventBus(options.source, apiKey, { channelPrefix: options.channelPrefix });
    }
    console.warn(`[event-bus] ABLY_API_KEY not set for source "${options.source}". Falling back to InMemoryEventBus (single-process only).`);
    return new InMemoryEventBus(options.source);
}
export function getEventBus(options) {
    if (!singleton) {
        singleton = createEventBus(options);
    }
    return singleton;
}
//# sourceMappingURL=index.js.map