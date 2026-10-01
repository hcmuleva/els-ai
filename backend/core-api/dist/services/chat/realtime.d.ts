import * as Ably from 'ably';
export declare const ChatRealtime: {
    getChannelName(chatType: string, sessionId: string): string;
    getReviewChannelName(organizationId: string, teacherId?: string): string;
    publishMessage(chatType: string, sessionId: string, event: "message" | "typing" | "slot_updated" | "session_completed", data: Record<string, unknown>): Promise<void>;
    publishReviewUpdate(organizationId: string, teacherId: string | undefined, data: Record<string, unknown>): Promise<void>;
    issueChatToken(userId: string, chatType: string, sessionId: string): Promise<{
        tokenRequest: Ably.TokenRequest;
        channel: string;
    } | null>;
};
//# sourceMappingURL=realtime.d.ts.map