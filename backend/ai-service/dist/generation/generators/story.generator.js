import { z } from "zod";
import { generateJson } from "../../services/llmClient.js";
import { newContentId } from "../../utils/ids.js";
const StoryOutput = z.object({
    title: z.string(),
    body: z.string(),
    moral: z.string().optional(),
});
export async function generateStory(params) {
    const output = await generateJson({
        system: "You are a children's/educational story writer. Reply with ONLY JSON matching: " +
            "{ title, body, moral? }. Keep language appropriate for the given grade level.",
        prompt: [
            params.subject ? `Related subject: ${params.subject}` : "",
            `Grade level: ${params.gradeLevel}`,
            `Theme: ${params.theme}`,
            params.moralOrLearningGoal ? `Learning goal / moral: ${params.moralOrLearningGoal}` : "",
            `Target length: ~${params.lengthWords} words`,
        ]
            .filter(Boolean)
            .join("\n"),
        maxTokens: 2500,
    });
    const parsed = StoryOutput.parse(output);
    const contentId = newContentId("story");
    return {
        contentId,
        name: parsed.title,
        preview: { title: parsed.title, excerpt: parsed.body.slice(0, 400), moral: parsed.moral },
        data: parsed,
    };
}
