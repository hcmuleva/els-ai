export type DomainEventType =
  | 'auth.user.logged_in'
  | 'auth.user.registered'
  | 'org.created'
  | 'org.updated'
  | 'user.created'
  | 'user.role.changed'
  | 'student.created'
  | 'teacher.assigned'
  | 'classroom.scheduled'
  | 'classroom.ended'
  | 'classroom.deleted'
  | 'content.published'
  | 'topic.created'
  | 'quiz.created'
  | 'quiz.submitted'
  | 'assignment.created'
  | 'assignment.submitted'
  | 'billing.subscription.activated'
  | 'billing.subscription.renewed'
  | 'billing.subscription.cancelled'
  | 'billing.invoice.issued'
  | 'billing.invoice.paid'
  | 'billing.invoice.expired'
  | 'notification.requested'
  | 'ai.draft.ready';

export type DomainEvent<TPayload = unknown> = {
  id: string;
  type: DomainEventType;
  source: string;
  occurredAt: string;
  organizationId?: string;
  userId?: string;
  payload: TPayload;
};

export type DomainEventHandler<TPayload = unknown> = (
  event: DomainEvent<TPayload>,
) => void | Promise<void>;

export interface EventBus {
  publish<TPayload = unknown>(event: Omit<DomainEvent<TPayload>, 'id' | 'occurredAt'>): Promise<void>;
  subscribe<TPayload = unknown>(
    type: DomainEventType | DomainEventType[],
    handler: DomainEventHandler<TPayload>,
  ): Promise<() => void>;
  close(): Promise<void>;
}

export type PushChannel = {
  channel: string;
  data: Record<string, unknown>;
  name?: string;
};

export interface PushNotifier {
  notify(channel: PushChannel): Promise<void>;
}
