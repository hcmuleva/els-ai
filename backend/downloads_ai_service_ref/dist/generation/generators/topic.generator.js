import { z } from "zod";
import { generateJson } from "../../agent/llmClient.js";
import { newContentId } from "../../utils/ids.js";
const TopicOutput = z.object({
    title: z.string(),
    description: z.string(),
    outline: z.array(z.object({ heading: z.string(), summary: z.string() })).min(1),
    learningObjectives: z.array(z.string()),
});
export async function generateTopic(params) {
    const output = await generateJson({
        system: "You are a curriculum designer. Reply with ONLY JSON matching: " +
            "{ title, description, outline: [{ heading, summary }], learningObjectives: string[] }.",
        prompt: [
            `Subject: ${params.subject}`,
            `Grade level: ${params.gradeLevel}`,
            `Working title: ${params.title}`,
            `Learning objectives to cover: ${params.learningObjectives.join("; ")}`,
        ].join("\n"),
        maxTokens: 2000,
    });
    const parsed = TopicOutput.parse(output);
    const contentId = newContentId("topic");
    return {
        contentId,
        name: parsed.title,
        preview: {
            title: parsed.title,
            description: parsed.description,
            outline: parsed.outline.slice(0, 5),
        },
        data: parsed,
    };
}
//# sourceMappingURL=topic.generator.js.map