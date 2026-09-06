export declare const DEFAULT_EXPIRY_DAYS = 5;
export type NotificationRow = {
    id: string;
    user_id: string;
    organization_id: string;
    type: string;
    category: string;
    title: string;
    message: string;
    status: 'unread' | 'read';
    cta_label: string | null;
    cta_route: string | null;
    metadata: Record<string, unknown>;
    source_event_id: string | null;
    parent_notification_id: string | null;
    created_at: string;
    read_at: string | null;
    expiry_at: string;
    deleted_at: string | null;
};
export type CreateNotificationInput = {
    userId: string;
    organizationId: string;
    type: string;
    category?: string;
    title: string;
    message: string;
    ctaLabel?: string | null;
    ctaRoute?: string | null;
    metadata?: Record<string, unknown>;
    sourceEventId?: string;
    parentNotificationId?: string;
    expiresInDays?: number;
};
export declare const NotificationStore: {
    create(input: CreateNotificationInput): Promise<NotificationRow | null>;
    aggregateActivity(input: {
        userId: string;
        organizationId: string;
        audienceType: "CHILD_ACTIVITY" | "STUDENT_ACTIVITY";
        classroomId: string;
        classroomTitle: string;
        activityKind: "quiz_submitted" | "assignment_submitted";
        studentUserId: string;
        studentName: string | null;
        windowMinutes: number;
        ctaLabel: string | null;
        ctaRoute: string | null;
        sourceEventId: string;
    }): Promise<NotificationRow | null>;
    createMany(inputs: CreateNotificationInput[]): Promise<NotificationRow[]>;
    listForUser(userId: string, opts?: {
        status?: "unread" | "read";
        limit?: number;
        offset?: number;
    }): Promise<{
        rows: NotificationRow[];
        total: number;
    }>;
    unreadCount(userId: string): Promise<number>;
    markRead(userId: string, notificationId: string): Promise<NotificationRow | null>;
    markAllRead(userId: string, organizationId: string): Promise<number>;
    deleteOne(userId: string, organizationId: string, notificationId: string): Promise<boolean>;
    deleteRange(userId: string, organizationId: string, range: "hour" | "day" | "week" | "all"): Promise<number>;
    deleteAllRead(userId: string, organizationId: string): Promise<number>;
    expireClassroomCtas(classroomId: string, reason: "ended" | "deleted"): Promise<{
        rows: NotificationRow[];
    }>;
    teacherActivityCounts(userId: string): Promise<Array<{
        classroomId: string;
        unread: number;
    }>>;
    markTeacherActivitySeen(userId: string, classroomId: string): Promise<number>;
    cleanupExpired(): Promise<number>;
};
//# sourceMappingURL=notification-store.d.ts.map