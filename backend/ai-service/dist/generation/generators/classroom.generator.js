import { z } from "zod";
import { generateJson } from "../../services/llmClient.js";
import { newContentId } from "../../utils/ids.js";
const ClassroomOutput = z.object({
    className: z.string(),
    description: z.string(),
    syllabus: z.array(z.object({ topic: z.string(), order: z.number().int(), estimatedSessions: z.number().int() })),
});
export async function generateClassroom(params) {
    const output = await generateJson({
        system: "You are a school curriculum planner. Reply with ONLY JSON matching: " +
            "{ className, description, syllabus: [{ topic, order, estimatedSessions }] }. " +
            "Order the syllabus topics in a sensible teaching sequence.",
        prompt: [
            `Class name: ${params.className}`,
            `Grade level: ${params.gradeLevel}`,
            `Subject: ${params.subject}`,
            params.studentCount ? `Student count: ${params.studentCount}` : "",
            `Syllabus topics to sequence: ${params.syllabusTopics.join("; ")}`,
        ]
            .filter(Boolean)
            .join("\n"),
        maxTokens: 2000,
    });
    const parsed = ClassroomOutput.parse(output);
    const contentId = newContentId("classroom");
    return {
        contentId,
        name: parsed.className,
        preview: {
            className: parsed.className,
            description: parsed.description,
            syllabusPreview: parsed.syllabus.slice(0, 5),
        },
        data: parsed,
    };
}
