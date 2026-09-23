import { z } from "zod";
import { generateJson } from "../../agent/llmClient.js";
import { newContentId } from "../../utils/ids.js";
const QuestionOutput = z.object({
    questions: z
        .array(z.object({
        prompt: z.string(),
        options: z.array(z.string()).optional(),
        correctAnswer: z.string(),
        explanation: z.string(),
    }))
        .min(1),
});
export async function generateQuestions(params) {
    const output = await generateJson({
        system: "You are an expert exam-question writer. Reply with ONLY JSON matching: " +
            "{ questions: [{ prompt, options?, correctAnswer, explanation }] }. " +
            "For mcq, always include 4 options. For true_false, options are ['True','False']. " +
            "For short_answer/long_answer, omit options.",
        prompt: [
            `Subject: ${params.subject}`,
            `Grade level: ${params.gradeLevel}`,
            `Topic: ${params.topic}`,
            `Question type: ${params.questionType}`,
            `Difficulty: ${params.difficulty}`,
            `Count: ${params.count}`,
        ].join("\n"),
        maxTokens: 3000,
    });
    const parsed = QuestionOutput.parse(output);
    const contentId = newContentId("question");
    const name = `${params.topic} — ${parsed.questions.length} ${params.questionType} question${parsed.questions.length > 1 ? "s" : ""}`;
    return {
        contentId,
        name,
        preview: { questions: parsed.questions.slice(0, 3), total: parsed.questions.length },
        data: parsed,
    };
}
//# sourceMappingURL=question.generator.js.map