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
    // 3. Pedagogical Strategy Evaluation
    // - Scenario 1: Single focused video lesson -> attach quiz directly to video section
    // - Scenario 2: Multi-video / exam prep / comprehensive chapter -> overall quiz in separate text section
    // - Scenario 3: Per-video checkpoint quizzes when requested
    let effectiveStrategy = "separate_section";
    if (params.quizStrategy && params.quizStrategy !== "auto") {
        effectiveStrategy = params.quizStrategy;
    }
    else if (youtubeVideos.length <= 1 && !isExamContext) {
        effectiveStrategy = "attach_to_video";
    }
    else {
        effectiveStrategy = "separate_section";
    }
    // 4. Dynamically fetch or generate Contextual Quiz(zes) & Previous Year Questions (PYQ)
    let quizData = null;
    const quizzesList = [];
    if (params.includeQuiz !== false || isExamContext) {
        if (effectiveStrategy === "per_video" && youtubeVideos.length > 1) {
            // Generate per-video quick checkpoints
            const perVideoCount = Math.max(2, Math.min(5, Math.floor((params.quizQuestionCount || 6) / youtubeVideos.length)));
            for (let i = 0; i < youtubeVideos.length; i++) {
                const v = youtubeVideos[i];
                const vTopic = `${params.topic}: ${v.title}`;
                const vExamResult = await fetchExamQuestions({
                    examName: `${params.subject} Checkpoint`,
                    classLevel: params.gradeLevel,
                    subject: params.subject,
                    topic: vTopic,
                    count: perVideoCount,
                });
                if (vExamResult.questions.length > 0) {
                    quizzesList.push({
                        draftId: `quiz-v-${i + 1}`,
                        targetSectionDraftId: `sec-yt-${i + 1}`,
                        title: `${v.title} - Quick Check`,
                        questions: vExamResult.questions,
                        yearsCovered: vExamResult.yearsCovered,
                    });
                }
            }
            if (quizzesList.length > 0) {
                quizData = {
                    title: quizzesList[0].title,
                    questions: quizzesList.flatMap((q) => q.questions),
                    yearsCovered: Array.from(new Set(quizzesList.flatMap((q) => q.yearsCovered))),
                };
            }
        }
        else {
            // Single overall or video-specific quiz
            const questionCount = params.quizQuestionCount || 5;
            const examResult = await fetchExamQuestions({
                examName: params.examName || (isExamContext ? "Navodaya Vidyalaya (JNVST)" : `${params.subject} Assessment`),
                classLevel: params.gradeLevel,
                subject: params.subject,
                topic: params.topic,
                count: questionCount,
            });
            if (examResult.questions.length > 0) {
                const targetDraftId = effectiveStrategy === "attach_to_video" && youtubeVideos.length > 0
                    ? "sec-yt-1"
                    : "sec-quiz";
                quizData = {
                    title: `${parsed.title} - Practice Quiz & PYQs`,
                    questions: examResult.questions,
                    yearsCovered: examResult.yearsCovered,
                };
                quizzesList.push({
                    draftId: "quiz-main",
                    targetSectionDraftId: targetDraftId,
                    title: quizData.title,
                    questions: examResult.questions,
                    yearsCovered: examResult.yearsCovered,
                });
            }
        }
    }
    // 5. Construct modular multi-section payload
    const contentSections = [];
    // Pair videos with notes sections
    if (youtubeVideos.length > 0) {
        youtubeVideos.forEach((v, idx) => {
            // Video Section with video link AND rich description
            const videoDescription = parsed.sections[idx]?.content ||
                (idx === 0 ? parsed.body : `Detailed instructional video covering ${v.title}.`);
            contentSections.push({
                draftId: `sec-yt-${idx + 1}`,
                title: v.title,
                contentType: "youtube_url",
                mediaUrl: "",
                externalUrl: v.url,
                textContent: videoDescription,
                quizId: null,
            });
            // Modular Notes Section matching Video
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
        // Key takeaways summary if available
        if (parsed.keyTakeaways && parsed.keyTakeaways.length > 0) {
            contentSections.push({
                draftId: "sec-takeaways",
                title: `Key Takeaways`,
                contentType: "text",
                mediaUrl: "",
                externalUrl: "",
                textContent: parsed.keyTakeaways.map((t) => `• ${t}`).join("\n"),
                quizId: null,
            });
        }
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
    // Dedicated separate text section for overall / cumulative quiz if strategy is separate_section
    if (effectiveStrategy === "separate_section" &&
        quizzesList.some((q) => q.targetSectionDraftId === "sec-quiz")) {
        const mainQuiz = quizzesList.find((q) => q.targetSectionDraftId === "sec-quiz") || quizzesList[0];
        contentSections.push({
            draftId: "sec-quiz",
            title: mainQuiz?.title || `${parsed.title} - Assessment Quiz`,
            contentType: "text",
            mediaUrl: "",
            externalUrl: "",
            textContent: `### Assessment Overview & Instructions\n\n- **Topic Coverage:** ${params.topic}\n- **Total Questions:** ${mainQuiz?.questions?.length || 5}\n- **Instructions:** Review all previous video lessons and study notes thoroughly before starting. Select the best answer for each question and review the step-by-step explanations upon completion.`,
            quizId: null,
        });
    }
    const contentId = newContentId("content");
    const fullData = {
        ...parsed,
        quizStrategy: effectiveStrategy,
        quizzes: quizzesList,
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
        quiz: quizData || (quizzesList[0] ? { title: quizzesList[0].title, questions: quizzesList[0].questions, yearsCovered: quizzesList[0].yearsCovered } : null),
        questions: quizData?.questions || quizzesList[0]?.questions || [],
    };
    return {
        contentId,
        name: parsed.title,
        preview: {
            title: parsed.title,
            excerpt: parsed.body.slice(0, 400),
            keyTakeaways: parsed.keyTakeaways,
            quizStrategy: effectiveStrategy,
            video: fullData.video,
            videos: fullData.videos,
            sectionsCount: contentSections.length,
            quizzesCount: quizzesList.length,
            quiz: quizData
                ? {
                    title: quizData.title,
                    questionCount: quizData.questions.length,
                    yearsCovered: quizData.yearsCovered,
                    sampleQuestions: quizData.questions.slice(0, 3),
                }
                : quizzesList[0]
                    ? {
                        title: quizzesList[0].title,
                        questionCount: quizzesList[0].questions.length,
                        yearsCovered: quizzesList[0].yearsCovered,
                        sampleQuestions: quizzesList[0].questions.slice(0, 3),
                    }
                    : null,
        },
        data: fullData,
    };
}
