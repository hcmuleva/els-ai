import type { PoolClient } from 'pg';
export interface VideoItemPayload {
    videoId?: string;
    title?: string;
    url?: string;
    embedUrl?: string;
    validated?: boolean;
}
export interface VideoDumpPayload {
    subject?: string;
    topic?: string;
    class_level?: string;
    videos?: VideoItemPayload[];
}
export interface QuestionItemPayload {
    questionType: string;
    questionTitle?: string;
    questionInstruction?: string;
    points?: number;
    sortOrder?: number;
    questionData?: Record<string, unknown> | unknown[];
}
export interface QuestionDumpPayload {
    subject?: string;
    topic?: string;
    class_level?: string;
    difficulty_level?: string;
    questions_api_payload?: QuestionItemPayload[];
}
export interface TopicSeedBundle {
    classLevel: string;
    subject: string;
    topic: string;
    videoDump: VideoDumpPayload;
    questionDump: QuestionDumpPayload;
}
export interface SeedRunOptions {
    organizationId: string;
    createdBy?: string | null;
    dryRun?: boolean;
}
export interface SeedRunSummary {
    subjectsCreated: number;
    topicsCreated: number;
    contentsCreated: number;
    contentsReused: number;
    quizzesCreated: number;
    questionsCreated: number;
    questionTopicLinksCreated: number;
    bundlesProcessed: number;
}
export declare class GeneratedContentSeedAgent {
    private readonly client;
    private readonly options;
    private readonly summary;
    private readonly tableColumns;
    constructor(client: PoolClient, options: SeedRunOptions);
    seedBundles(bundles: TopicSeedBundle[]): Promise<SeedRunSummary>;
    private seedBundle;
    private ensureTopicQuestionAssignmentsTable;
    private loadColumns;
    private hasColumn;
    private ensureSubject;
    private ensureTopic;
    private ensureQuiz;
    private replaceQuizQuestions;
    private upsertVideoContents;
}
//# sourceMappingURL=generated-content-seed-agent.d.ts.map