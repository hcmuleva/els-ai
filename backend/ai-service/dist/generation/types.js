import { z } from "zod";
/**
 * The six content types the agent can generate. Add new ones here first —
 * everything else (proposal schema, pipeline, MCP tools) is keyed off this.
 */
export const normalizeContentType = (val) => {
    if (typeof val === 'string') {
        const lower = val.toLowerCase().replace(/[-_]/g, '');
        if (lower.includes('lesson') || lower.includes('content') || lower.includes('plan'))
            return 'content';
        if (lower.includes('topic'))
            return 'topic';
        if (lower.includes('quiz'))
            return 'quiz';
        if (lower.includes('question'))
            return 'question';
        if (lower.includes('class'))
            return 'classroom';
        if (lower.includes('story') || lower.includes('stories'))
            return 'story';
    }
    return val;
};
export const ContentType = z.preprocess(normalizeContentType, z.enum([
    "topic",
    "question",
    "quiz",
    "content",
    "story",
    "classroom",
]));
/** Per-type structured params the agent must fill in before proposing. */
export const TopicParams = z.preprocess((raw) => {
    if (raw && typeof raw === 'object') {
        const val = { ...raw };
        if (!val.title && val.topic)
            val.title = val.topic;
        if (val.gradeLevel !== undefined)
            val.gradeLevel = String(val.gradeLevel);
        if (!Array.isArray(val.learningObjectives) || val.learningObjectives.length === 0) {
            val.learningObjectives = [`Master core concepts of ${val.title || 'the topic'}`];
        }
        return val;
    }
    return raw;
}, z.object({
    subject: z.coerce.string().default("General"),
    gradeLevel: z.coerce.string().default(""),
    title: z.coerce.string().default(""),
    learningObjectives: z.array(z.coerce.string()).min(1),
}));
export const normalizeQuizType = (val) => {
    if (typeof val === 'string') {
        const lower = val.toLowerCase().trim();
        if (lower === 'mixed' || lower === 'mix' || lower === 'various' || lower === 'random')
            return 'mixed';
        if (lower === 'mcq' || lower === 'multiple_choice' || lower === 'multi_choice')
            return 'multi_choice';
        if (lower === 'single_choice')
            return 'single_choice';
        if (lower === 'true_false' || lower === 'truefalse' || lower === 'tf')
            return 'true_false';
        if (lower === 'fill_blank' || lower === 'fill_in_the_blank' || lower === 'fill_in_the_blanks' || lower === 'fill_blanks')
            return 'fill_blank';
        if (lower === 'drag_drop' || lower === 'drag_drop_match' || lower === 'match_box' || lower === 'matching')
            return 'drag_drop_match';
        if (lower === 'memory_match' || lower === 'memory_game')
            return 'memory_match';
        if (lower === 'jigsaw' || lower === 'jigsaw_puzzle')
            return 'jigsaw';
    }
    return val;
};
export const QuestionParams = z.preprocess((raw) => {
    if (raw && typeof raw === 'object') {
        const val = { ...raw };
        if (!val.topic && val.title)
            val.topic = val.title;
        if (val.gradeLevel !== undefined)
            val.gradeLevel = String(val.gradeLevel);
        if (val.questionType)
            val.questionType = normalizeQuizType(val.questionType);
        return val;
    }
    return raw;
}, z.object({
    subject: z.coerce.string().default("General"),
    gradeLevel: z.coerce.string().default(""),
    topic: z.coerce.string().default(""),
    questionType: z
        .enum([
        'multi_choice',
        'single_choice',
        'true_false',
        'fill_blank',
        'drag_drop_match',
        'memory_match',
        'jigsaw',
    ])
        .default('multi_choice'),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    count: z.coerce.number().int().min(1).max(50).default(1),
}));
export const QuizParams = z.preprocess((raw) => {
    if (raw && typeof raw === 'object') {
        const val = { ...raw };
        if (!val.topic && val.title)
            val.topic = val.title;
        if (val.gradeLevel !== undefined)
            val.gradeLevel = String(val.gradeLevel);
        if (val.questionCount === undefined)
            val.questionCount = 5;
        if (val.quizType)
            val.quizType = normalizeQuizType(val.quizType);
        return val;
    }
    return raw;
}, z.object({
    subject: z.coerce.string().default("General"),
    gradeLevel: z.coerce.string().default(""),
    topic: z.coerce.string().default(""),
    quizType: z
        .enum([
        'multi_choice',
        'single_choice',
        'true_false',
        'fill_blank',
        'drag_drop_match',
        'memory_match',
        'jigsaw',
        'mixed',
    ])
        .default('multi_choice'),
    questionCount: z.coerce.number().int().min(1).max(100).default(5),
    difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("medium"),
    timeLimitMinutes: z.coerce.number().int().min(1).optional(),
}));
export const ContentParams = z.preprocess((raw) => {
    if (raw && typeof raw === 'object') {
        const val = { ...raw };
        if (!val.topic && val.title)
            val.topic = val.title;
        if (val.gradeLevel !== undefined)
            val.gradeLevel = String(val.gradeLevel);
        return val;
    }
    return raw;
}, z.object({
    subject: z.coerce.string().default("General"),
    gradeLevel: z.coerce.string().default(""),
    topic: z.coerce.string().default(""),
    format: z.preprocess((v) => {
        if (typeof v === 'string') {
            const lower = v.toLowerCase();
            if (lower.includes('lesson'))
                return 'lesson';
            if (lower.includes('summary'))
                return 'summary';
            if (lower.includes('worksheet'))
                return 'worksheet';
            if (lower.includes('note'))
                return 'notes';
        }
        return v;
    }, z.enum(["lesson", "summary", "worksheet", "notes"]).default("lesson")),
    lengthWords: z.preprocess((v) => {
        if (typeof v === 'string')
            return parseInt(v, 10) || 600;
        return v;
    }, z.number().int().min(50).max(5000).default(600)),
    videoCount: z.preprocess((v) => {
        if (typeof v === 'string')
            return parseInt(v, 10) || 1;
        return v;
    }, z.number().int().min(0).max(5).default(1).optional()),
    includeQuiz: z.boolean().default(false).optional(),
    quizQuestionCount: z.preprocess((v) => {
        if (typeof v === 'string')
            return parseInt(v, 10) || 5;
        return v;
    }, z.number().int().min(1).max(25).default(5).optional()),
    isExamPrep: z.boolean().default(false).optional(),
    examName: z.string().optional(),
}));
export const StoryParams = z.preprocess((raw) => {
    if (raw && typeof raw === 'object') {
        const val = { ...raw };
        if (!val.theme && (val.title || val.topic))
            val.theme = val.title || val.topic;
        if (val.gradeLevel !== undefined)
            val.gradeLevel = String(val.gradeLevel);
        return val;
    }
    return raw;
}, z.object({
    subject: z.coerce.string().optional(),
    gradeLevel: z.coerce.string().default(""),
    theme: z.coerce.string().default(""),
    lengthWords: z.coerce.number().int().min(100).max(3000).default(500),
    moralOrLearningGoal: z.coerce.string().optional(),
}));
export const ClassroomParams = z.preprocess((raw) => {
    if (raw && typeof raw === 'object') {
        const val = { ...raw };
        if (!val.className && (val.title || val.topic))
            val.className = val.title || val.topic;
        if (val.gradeLevel !== undefined)
            val.gradeLevel = String(val.gradeLevel);
        if (!Array.isArray(val.syllabusTopics) || val.syllabusTopics.length === 0) {
            val.syllabusTopics = [val.title || val.topic || 'Core Curriculum'];
        }
        return val;
    }
    return raw;
}, z.object({
    className: z.coerce.string().default("Classroom"),
    gradeLevel: z.coerce.string().default(""),
    subject: z.coerce.string().default("General"),
    studentCount: z.coerce.number().int().min(1).optional(),
    syllabusTopics: z.array(z.coerce.string()).min(1),
}));
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
