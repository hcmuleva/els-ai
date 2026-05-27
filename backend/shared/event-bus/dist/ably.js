import { randomUUID } from 'node:crypto';
import * as Ably from 'ably';
const DEFAULT_CHANNEL_PREFIX = 'els-ai.events';
export class AblyEventBus {
    source;
    apiKey;
    realtime;
    channelPrefix;
    subscriptions = new Set();
    constructor(source, apiKey, options) {
        this.source = source;
        this.apiKey = apiKey;
        this.channelPrefix = options?.channelPrefix || DEFAULT_CHANNEL_PREFIX;
        this.realtime = new Ably.Realtime({
            key: this.apiKey,
            clientId: `els-ai.${this.source}`,
            autoConnect: true,
        });
    }
    channelNameFor(type) {
        return `${this.channelPrefix}.${type}`;
    }
    async publish(event) {
        const full = {
            ...event,
            id: randomUUID(),
            occurredAt: new Date().toISOString(),
            source: event.source || this.source,
        };
        const channel = this.realtime.channels.get(this.channelNameFor(full.type));
        await channel.publish({ name: full.type, data: full });
    }
    async subscribe(type, handler) {
        const types = Array.isArray(type) ? type : [type];
        const off = [];
        for (const t of types) {
            const channel = this.realtime.channels.get(this.channelNameFor(t));
            const listener = async (message) => {
                try {
                    await handler(message.data);
                }
                catch (error) {
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
    async notify(push) {
        const channel = this.realtime.channels.get(push.channel);
        await channel.publish({ name: push.name || 'notification', data: push.data });
    }
    async close() {
        for (const unsub of this.subscriptions) {
            try {
                unsub();
            }
            catch (_e) { /* ignore */ }
        }
        this.subscriptions.clear();
        this.realtime.close();
    }
}
//# sourceMappingURL=ably.js.map