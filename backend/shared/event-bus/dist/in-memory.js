import { randomUUID } from 'node:crypto';
export class InMemoryEventBus {
    source;
    handlers = new Map();
    constructor(source) {
        this.source = source;
    }
    async publish(event) {
        const full = {
            ...event,
            id: randomUUID(),
            occurredAt: new Date().toISOString(),
            source: event.source || this.source,
        };
        const subs = this.handlers.get(full.type);
        if (!subs || subs.size === 0)
            return;
        for (const handler of subs) {
            try {
                await handler(full);
            }
            catch (error) {
                console.error(`[event-bus] handler error for ${full.type}:`, error);
            }
        }
    }
    async subscribe(type, handler) {
        const types = Array.isArray(type) ? type : [type];
        types.forEach((t) => {
            const set = this.handlers.get(t) || new Set();
            set.add(handler);
            this.handlers.set(t, set);
        });
        return () => {
            types.forEach((t) => this.handlers.get(t)?.delete(handler));
        };
    }
    async close() {
        this.handlers.clear();
    }
}
//# sourceMappingURL=in-memory.js.map