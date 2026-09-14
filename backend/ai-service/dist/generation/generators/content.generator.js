import { z } from "zod";
import { generateJson } from "../../services/llmClient.js";
import { fetchBestYoutubeVideo, fetchMultipleYoutubeVideos, } from "../../services/youtubeFetcher.js";
import { fetchExamQuestions } from "../../services/examFetcher.js";
import { newContentId } from "../../utils/ids.js";
const ContentOutput = z
    .object({
    title: z.string().optional().default("Educational Lesson"),
    body: z.string().optional().default(""),
    keyTakeaways: z.any().optional(),
    takeaways: z.any().optional(),
    key_takeaways: z.any().optional(),
    sections: z
        .array(z.object({
        heading: z.string().optional(),
        title: z.string().optional(),
        content: z.string().optional(),
        body: z.string().optional(),
    }))
        .optional(),
})
    .transform((raw) => {
    const takeawaysList = Array.isArray(raw.keyTakeaways)
        ? raw.keyTakeaways
        : Array.isArray(raw.takeaways)
            ? raw.takeaways
            : Array.isArray(raw.key_takeaways)
                ? raw.key_takeaways
                : typeof raw.keyTakeaways === "string"
                    ? [raw.keyTakeaways]
                    : [];
    return {
        title: String(raw.title || "Educational Lesson").trim(),
        body: String(raw.body || raw.content || raw.lesson || "").trim(),
        keyTakeaways: takeawaysList.map((t) => String(t).trim()),
        sections: Array.isArray(raw.sections)
            ? raw.sections.map((s) => ({
                heading: String(s.heading || s.title || "Lesson Notes").trim(),
                content: String(s.content || s.body || "").trim(),
            }))
            : [],
    };
});
export async function generateContent(params) {
    const desiredVideos = Math.max(1, params.videoCount || 1);
    const isExamContext = Boolean(params.isExamPrep) ||
        /navodaya|jnvst|sainik|olympiad|entrance|exam/i.test(params.topic) ||
        /navodaya|jnvst|sainik|olympiad|entrance|exam/i.test(params.subject);
    // 1. Generate core educational text & modular section notes
    const output = await generateJson({
        system: "You are an expert curriculum writer. Reply with ONLY JSON matching: " +
            "{ title: string, body: string, keyTakeaways: string[], sections: Array<{ heading: string, content: string }> }. " +
            "Provide detailed, high-yield educational notes with markdown formatting.",
        prompt: [
            `Subject: ${params.subject}`,
            `Grade level: ${params.gradeLevel}`,
            `Topic: ${params.topic}`,
            `Format: ${params.format}`,
            `Target length: ~${params.lengthWords} words`,
            desiredVideos > 1
                ? `Generate ${desiredVideos} distinct sequential sub-section modules for this topic.`
                : "Generate a comprehensive lesson outline with detailed study notes.",
        ].join("\n"),
        maxTokens: 3500,
    });
    const parsed = ContentOutput.parse(output);
    // 2. Fetch verified embeddable & region-safe YouTube videos
    let youtubeVideos = [];
    try {
        if (desiredVideos > 1) {
            youtubeVideos = await fetchMultipleYoutubeVideos({
                topic: params.topic,
                subject: params.subject,
                gradeLevel: params.gradeLevel,
                details: parsed.title,
            }, desiredVideos);
        }
        else {
            const single = await fetchBestYoutubeVideo({
                topic: params.topic,
                subject: params.subject,
                gradeLevel: params.gradeLevel,
                details: parsed.title,
            });
            if (single)
                youtubeVideos.push(single);
        }
    }
    catch (err) {
        console.warn("[content.generator] Failed fetching YouTube videos:", err);
    }
    // 3. Dynamically fetch or generate Contextual Quiz & Previous Year Questions (PYQ)
    let quizData = null;
    if (params.includeQuiz || isExamContext) {
        const questionCount = params.quizQuestionCount || 5;
        const examResult = await fetchExamQuestions({
            examName: params.examName || (isExamContext ? "Navodaya Vidyalaya (JNVST)" : `${params.subject} Assessment`),
            classLevel: params.gradeLevel,
            subject: params.subject,
            topic: params.topic,
            count: questionCount,
        });
        if (examResult.questions.length > 0) {
            quizData = {
                title: `${parsed.title} - Practice Quiz & PYQs`,
                questions: examResult.questions,
                yearsCovered: examResult.yearsCovered,
            };
        }
    }
    // 4. Construct modular multi-section payload
    const contentSections = [];
    // Pair videos with notes sections
    if (youtubeVideos.length > 0) {
        youtubeVideos.forEach((v, idx) => {
            // Video Section
            contentSections.push({
                draftId: `sec-yt-${idx + 1}`,
                title: v.title,
                contentType: "youtube_url",
                mediaUrl: "",
                externalUrl: v.url,
                textContent: "",
                quizId: null,
            });
            // Notes Section matching Video
            const noteContent = parsed.sections[idx]?.content ||
                (idx === 0 ? parsed.body : `Key revision points for ${v.title}.`);
            contentSections.push({
                draftId: `sec-notes-${idx + 1}`,
                title: parsed.sections[idx]?.heading || `Notes: Part ${idx + 1}`,
                contentType: "text",
                mediaUrl: "",
                externalUrl: "",
                textContent: noteContent,
                quizId: null,
            });
        });
    }
    else {
        // Text-only fallback
        contentSections.push({
            draftId: "sec-notes-main",
            title: parsed.title,
            contentType: "text",
            mediaUrl: "",
            externalUrl: "",
            textContent: parsed.body,
            quizId: null,
        });
    }
    // Quiz data is passed via fullData.quiz — ProposalCard creates the real Quiz entity
    // in the Question Bank and attaches createdQuizId to the video section. No text dump needed.
    const contentId = newContentId("content");
    const fullData = {
        ...parsed,
        video: youtubeVideos[0]
            ? {
                url: youtubeVideos[0].url,
                videoId: youtubeVideos[0].videoId,
                title: youtubeVideos[0].title,
                thumbnailUrl: youtubeVideos[0].thumbnailUrl,
            }
            : null,
        videos: youtubeVideos.map((v) => ({
            url: v.url,
            videoId: v.videoId,
            title: v.title,
            thumbnailUrl: v.thumbnailUrl,
        })),
        sections: contentSections,
        quiz: quizData,
        questions: quizData?.questions || [],
    };
    return {
        contentId,
        name: parsed.title,
        preview: {
            title: parsed.title,
            excerpt: parsed.body.slice(0, 400),
            keyTakeaways: parsed.keyTakeaways,
            video: fullData.video,
            videos: fullData.videos,
            sectionsCount: contentSections.length,
            quiz: quizData
                ? {
                    title: quizData.title,
                    questionCount: quizData.questions.length,
                    yearsCovered: quizData.yearsCovered,
                    sampleQuestions: quizData.questions.slice(0, 3),
                }
                : null,
        },
        data: fullData,
    };
}
