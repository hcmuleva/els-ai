import { DomainEvent, DomainEventHandler, DomainEventType, EventBus } from './types.js';
export declare class InMemoryEventBus implements EventBus {
    private readonly source;
    private handlers;
    constructor(source: string);
    publish<TPayload>(event: Omit<DomainEvent<TPayload>, 'id' | 'occurredAt'>): Promise<void>;
    subscribe<TPayload>(type: DomainEventType | DomainEventType[], handler: DomainEventHandler<TPayload>): Promise<() => void>;
    close(): Promise<void>;
}
//# sourceMappingURL=in-memory.d.ts.map