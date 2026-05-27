import { DomainEvent, DomainEventHandler, DomainEventType, EventBus, PushChannel, PushNotifier } from './types.js';
export declare class AblyEventBus implements EventBus, PushNotifier {
    private readonly source;
    private readonly apiKey;
    private realtime;
    private channelPrefix;
    private subscriptions;
    constructor(source: string, apiKey: string, options?: {
        channelPrefix?: string;
    });
    private channelNameFor;
    publish<TPayload>(event: Omit<DomainEvent<TPayload>, 'id' | 'occurredAt'>): Promise<void>;
    subscribe<TPayload>(type: DomainEventType | DomainEventType[], handler: DomainEventHandler<TPayload>): Promise<() => void>;
    notify(push: PushChannel): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=ably.d.ts.map