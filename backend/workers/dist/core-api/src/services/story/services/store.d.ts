export type StoryRow = {
    id: string;
    organization_id: string;
    title: string;
    description: string | null;
    cover_image_url: string | null;
    class_level: string | null;
    scheduled_at: string | null;
    ended_at: string | null;
    status: 'draft' | 'scheduled' | 'live' | 'ended';
    created_by: string;
    created_at: string;
    updated_at: string;
};
export type SectionRow = {
    id: string;
    story_id: string;
    title: string;
    body_text: string | null;
    media: Array<{
        kind: 'image' | 'video' | 'audio';
        url: string;
        caption?: string;
    }>;
    quiz_id: string | null;
    order_index: number;
    created_at: string;
    updated_at: string;
};
export declare function toStoryDto(row: StoryRow, extras?: {
    sectionCount?: number;
}): {
    id: string;
    organizationId: string;
    title: string;
    description: string;
    coverImageUrl: string | null;
    classLevel: string | null;
    scheduledAt: string | null;
    endedAt: string | null;
    status: "ended" | "scheduled" | "draft" | "live";
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    sectionCount: number | undefined;
};
export declare function toSectionDto(row: SectionRow): {
    id: string;
    storyId: string;
    title: string;
    bodyText: string;
    media: {
        kind: "image" | "video" | "audio";
        url: string;
        caption?: string;
    }[];
    quizId: string | null;
    orderIndex: number;
    createdAt: string;
    updatedAt: string;
};
export declare const StoryStore: {
    listForOrg(orgId: string, filters: {
        status?: string;
        classLevel?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        items: {
            id: string;
            organizationId: string;
            title: string;
            description: string;
            coverImageUrl: string | null;
            classLevel: string | null;
            scheduledAt: string | null;
            endedAt: string | null;
            status: "ended" | "scheduled" | "draft" | "live";
            createdBy: string;
            createdAt: string;
            updatedAt: string;
            sectionCount: number | undefined;
        }[];
        total: number;
    }>;
    getById(orgId: string, storyId: string): Promise<StoryRow>;
    create(input: {
        orgId: string;
        userId: string;
        title: string;
        description?: string | null;
        coverImageUrl?: string | null;
        classLevel?: string | null;
    }): Promise<StoryRow>;
    update(orgId: string, storyId: string, patch: Partial<{
        title: string;
        description: string | null;
        coverImageUrl: string | null;
        classLevel: string | null;
        scheduledAt: string | null;
        status: "draft" | "scheduled" | "live" | "ended";
        endedAt: string | null;
    }>): Promise<StoryRow>;
    delete(orgId: string, storyId: string): Promise<boolean>;
    listSections(storyId: string): Promise<{
        id: string;
        storyId: string;
        title: string;
        bodyText: string;
        media: {
            kind: "image" | "video" | "audio";
            url: string;
            caption?: string;
        }[];
        quizId: string | null;
        orderIndex: number;
        createdAt: string;
        updatedAt: string;
    }[]>;
    createSection(storyId: string, input: {
        title: string;
        bodyText?: string | null;
        media?: any[];
        quizId?: string | null;
        orderIndex?: number;
    }): Promise<{
        id: string;
        storyId: string;
        title: string;
        bodyText: string;
        media: {
            kind: "image" | "video" | "audio";
            url: string;
            caption?: string;
        }[];
        quizId: string | null;
        orderIndex: number;
        createdAt: string;
        updatedAt: string;
    }>;
    updateSection(sectionId: string, storyId: string, patch: Partial<{
        title: string;
        bodyText: string | null;
        media: any[];
        quizId: string | null;
        orderIndex: number;
    }>): Promise<{
        id: string;
        storyId: string;
        title: string;
        bodyText: string;
        media: {
            kind: "image" | "video" | "audio";
            url: string;
            caption?: string;
        }[];
        quizId: string | null;
        orderIndex: number;
        createdAt: string;
        updatedAt: string;
    } | null>;
    deleteSection(sectionId: string, storyId: string): Promise<boolean>;
    getProgress(userId: string, storyId: string): Promise<any>;
    upsertProgress(userId: string, storyId: string, input: {
        currentSectionId?: string | null;
        completedSectionIds?: string[];
        completed?: boolean;
    }): Promise<any>;
    findDueScheduled(): Promise<StoryRow[]>;
};
//# sourceMappingURL=store.d.ts.map