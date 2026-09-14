import { z } from "zod";
import { generateJson } from "../../services/llmClient.js";
import { fetchBestYoutubeVideo } from "../../services/youtubeFetcher.js";
import { newContentId } from "../../utils/ids.js";
const TopicOutput = z.object({
    title: z.string().optional().default("Curriculum Topic"),
    description: z.string().optional().default(""),
    outline: z.array(z.any()).optional().default([]),
    learningObjectives: z.any().optional(),
    objectives: z.any().optional(),
}).transform((raw) => {
    const outlineList = (raw.outline || []).map((item, idx) => {
        if (typeof item === 'string') {
            return { heading: `Section ${idx + 1}`, summary: item };
        }
        return {
            heading: String(item?.heading || item?.title || `Section ${idx + 1}`).trim(),
            summary: String(item?.summary || item?.description || '').trim(),
        };
    });
    const rawObjs = raw.learningObjectives || raw.objectives || [];
    const learningObjectives = Array.isArray(rawObjs)
        ? rawObjs.map((o) => String(o).trim())
        : typeof rawObjs === 'string'
            ? [rawObjs]
            : [];
    return {
        title: String(raw.title || "Curriculum Topic").trim(),
        description: String(raw.description || "").trim(),
        outline: outlineList.length > 0 ? outlineList : [{ heading: "Overview", summary: raw.description || "" }],
        learningObjectives,
    };
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
    let youtubeVideo = null;
    try {
        youtubeVideo = await fetchBestYoutubeVideo({
            topic: params.title,
            subject: params.subject,
            gradeLevel: params.gradeLevel,
            details: parsed.description,
        });
    }
    catch (err) {
        console.warn("[topic.generator] Failed fetching YouTube video:", err);
    }
    const contentId = newContentId("topic");
    const fullData = {
        ...parsed,
        video: youtubeVideo
            ? {
                url: youtubeVideo.url,
                videoId: youtubeVideo.videoId,
                title: youtubeVideo.title,
                thumbnailUrl: youtubeVideo.thumbnailUrl,
            }
            : null,
    };
    return {
        contentId,
        name: parsed.title,
        preview: {
            title: parsed.title,
            description: parsed.description,
            outline: parsed.outline.slice(0, 5),
            video: fullData.video,
        },
        data: fullData,
    };
}
