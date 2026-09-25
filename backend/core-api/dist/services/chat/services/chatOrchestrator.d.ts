export interface ContextSlots {
    student_id?: string;
    student_name?: string;
    topics: string[];
    current_topic_index: number;
    topic_in_progress: string;
    collected_facts: Array<{
        category: string;
        topic: string;
        concern_level: string;
        summary: string;
        review_status: string;
    }>;
    pending_clarification: boolean;
    completed: boolean;
}
export interface ChatSessionRow {
    id: string;
    organization_id: string;
    chat_type: 'survey' | 'performance' | 'review';
    initiator_id: string;
    role: 'child' | 'parent' | 'teacher' | 'admin' | 'superadmin';
    subject_student_id: string | null;
    status: 'active' | 'completed' | 'abandoned';
    context_slots: ContextSlots;
    created_at: string;
    updated_at: string;
}
export interface ChatMessageRow {
    id: string;
    session_id: string;
    organization_id: string;
    sender: 'user' | 'assistant' | 'system';
    content: string;
    metadata: Record<string, unknown>;
    created_at: string;
}
export declare const ChatOrchestrator: {
    createSession(params: {
        organizationId: string;
        initiatorId: string;
        role: "child" | "parent" | "teacher" | "admin" | "superadmin";
        chatType: "survey" | "performance" | "review";
        subjectStudentId?: string | null;
    }): Promise<{
        session: ChatSessionRow;
        initialMessage?: ChatMessageRow;
    }>;
    handleUserMessage(params: {
        sessionId: string;
        organizationId: string;
        userId: string;
        role: string;
        content: string;
    }): Promise<{
        userMessage: ChatMessageRow;
        assistantMessage: ChatMessageRow;
        session: ChatSessionRow;
    }>;
    getReviewQueue(params: {
        organizationId: string;
        status?: string;
    }): Promise<any[]>;
    updateReviewEntry(params: {
        entryId: string;
        organizationId: string;
        reviewerId: string;
        action: "approved" | "rejected";
        teacherNotes?: string;
    }): Promise<any>;
};
//# sourceMappingURL=chatOrchestrator.d.ts.map