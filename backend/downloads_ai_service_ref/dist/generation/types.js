import { z } from "zod";
/**
 * The six content types the agent can generate. Add new ones here first —
 * everything else (proposal schema, pipeline, MCP tools) is keyed off this.
 */
export const ContentType = z.enum([
    "topic",
    "question",
    "quiz",
    "content",
    "story",
    "classroom",
]);
/** Per-type structured params the agent must fill in before proposing. */
export const TopicParams = z.object({
    subject: z.string(),
    gradeLevel: z.string(),
    title: z.string(),
    learningObjectives: z.array(z.string()).min(1),
});
export const QuestionParams = z.object({
    subject: z.string(),
    gradeLevel: z.string(),
    topic: z.string(),
    questionType: z.enum(["mcq", "true_false", "short_answer", "long_answer"]),
    difficulty: z.enum(["easy", "medium", "hard"]),
    count: z.number().int().min(1).max(50).default(1),
});
export const QuizParams = z.object({
    subject: z.string(),
    gradeLevel: z.string(),
    topic: z.string(),
    questionCount: z.number().int().min(1).max(100),
    difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
    timeLimitMinutes: z.number().int().min(1).optional(),
});
export const ContentParams = z.object({
    subject: z.string(),
    gradeLevel: z.string(),
    topic: z.string(),
    format: z.enum(["lesson", "summary", "worksheet", "notes"]),
    lengthWords: z.number().int().min(50).max(5000).default(600),
});
export const StoryParams = z.object({
    subject: z.string().optional(),
    gradeLevel: z.string(),
    theme: z.string(),
    lengthWords: z.number().int().min(100).max(3000).default(500),
    moralOrLearningGoal: z.string().optional(),
});
export const ClassroomParams = z.object({
    className: z.string(),
    gradeLevel: z.string(),
    subject: z.string(),
    studentCount: z.number().int().min(1).optional(),
    syllabusTopics: z.array(z.string()).min(1),
});
export const ParamsByType = {
    topic: TopicParams,
    question: QuestionParams,
    quiz: QuizParams,
    content: ContentParams,
    story: StoryParams,
    classroom: ClassroomParams,
};
/**
 * The exact JSON the agent must emit in chat when it wants to offer a
 * "Generate" / "Cancel" action to the user. See docs/SYSTEM_PROMPT.md for
 * the framing contract the model is instructed to follow.
 */
export const GenerationProposal = z.object({
    type: z.literal("generation_proposal"),
    contentType: ContentType,
    title: z.string(),
    summary: z.string(),
    params: z.record(z.string(), z.unknown()),
    conversationId: z.string(),
});
export function validateParamsForType(contentType, params) {
    return ParamsByType[contentType].parse(params);
}
/** Ordered steps every generation job goes through. Keep labels UI-friendly. */
export const PIPELINE_STEPS = [
    { key: "gathering_information", label: "Gathering information" },
    { key: "creating_entity", label: "Creating {contentType}" },
    { key: "adding_content", label: "Adding content" },
    { key: "validating_context", label: "Validating context" },
    { key: "finalizing", label: "Finalizing" },
];
//# sourceMappingURL=types.js.map