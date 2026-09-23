import { z } from "zod";
import { generateJson } from "../../agent/llmClient.js";
import { newContentId } from "../../utils/ids.js";
const QuizOutput = z.object({
    title: z.string(),
    questions: z
        .array(z.object({
        prompt: z.string(),
        options: z.array(z.string()).min(2).optional(),
        correctAnswer: z.string(),
        explanation: z.string(),
    }))
        .min(1),
});
export async function generateQuiz(params) {
    const output = await generateJson({
        system: "You are an expert curriculum writer. Reply with ONLY a JSON object, no prose, " +
            "matching this shape: { title: string, questions: [{ prompt, options?, correctAnswer, explanation }] }. " +
            "Write age-appropriate, factually accurate, unambiguous questions.",
        prompt: [
            `Subject: ${params.subject}`,
            `Grade level: ${params.gradeLevel}`,
            `Topic: ${params.topic}`,
            `Difficulty: ${params.difficulty}`,
            `Number of questions: ${params.questionCount}`,
            params.timeLimitMinutes ? `Time limit: ${params.timeLimitMinutes} minutes` : "",
        ]
            .filter(Boolean)
            .join("\n"),
        maxTokens: 4000,
    });
    const parsed = QuizOutput.parse(output);
    const contentId = newContentId("quiz");
    return {
        contentId,
        name: parsed.title,
        preview: {
            title: parsed.title,
            questionCount: parsed.questions.length,
            sampleQuestions: parsed.questions.slice(0, 3),
        },
        data: parsed,
    };
}
//# sourceMappingURL=quiz.generator.js.map