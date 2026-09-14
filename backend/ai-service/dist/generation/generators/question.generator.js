import { generateJson } from "../../services/llmClient.js";
import { newContentId } from "../../utils/ids.js";
import { fetchAndUploadTopicImage } from "../../services/imageFetcher.js";
function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
export async function generateQuestions(params) {
    const qType = params.questionType || "multi_choice";
    if (qType === "jigsaw") {
        const imageUrl = await fetchAndUploadTopicImage(params.topic);
        const gridSize = params.difficulty === "easy" ? "2x2" : params.difficulty === "hard" ? "4x4" : "3x3";
        const count = Math.min(params.count, 3);
        const questions = [];
        for (let i = 0; i < count; i++) {
            const prompt = `Jigsaw Puzzle: ${params.topic}${count > 1 ? ` (${i + 1})` : ""}`;
            questions.push({
                prompt,
                questionType: "jigsaw",
                image: imageUrl,
                gridSize,
                explanation: `Assemble the ${gridSize} jigsaw puzzle.`,
                questionData: {
                    image: imageUrl,
                    prompt_image: imageUrl,
                    gridSize,
                    difficulty: params.difficulty,
                },
            });
        }
        const contentId = newContentId("question");
        const name = `${params.topic} — ${questions.length} Jigsaw Puzzle${questions.length > 1 ? "s" : ""}`;
        return {
            contentId,
            name,
            preview: { questions: questions.slice(0, 3), total: questions.length },
            data: { questions },
        };
    }
    if (qType === "fill_blank") {
        const output = await generateJson({
            system: "You are an expert exam-question writer. Reply with ONLY JSON: " +
                "{ questions: [{ sentence, answer, distractors: [string, string, string], hint?, explanation? }] }. " +
                "Each 'sentence' MUST contain '___' where the 'answer' belongs.",
            prompt: [
                `Subject: ${params.subject}`,
                `Grade level: ${params.gradeLevel}`,
                `Topic: ${params.topic}`,
                `Difficulty: ${params.difficulty}`,
                `Count: ${params.count}`,
            ].join("\n"),
            maxTokens: 3000,
        });
        const questions = (output.questions || []).map((q) => {
            let sentence = String(q.sentence || "").trim();
            const answer = String(q.answer || "").trim();
            if (!sentence.includes("___"))
                sentence = `${sentence} ___`;
            const distractors = Array.isArray(q.distractors) ? q.distractors : ["Option A", "Option B", "Option C"];
            const options = shuffleArray([answer, ...distractors.slice(0, 3)]);
            const hint = q.hint || "";
            const explanation = q.explanation || `The answer is ${answer}.`;
            return {
                prompt: sentence,
                sentence,
                answer,
                options,
                correctAnswer: answer,
                hint,
                explanation,
                questionType: "fill_blank",
                questionData: { sentence, answer, options, hint },
            };
        });
        const contentId = newContentId("question");
        const name = `${params.topic} — ${questions.length} Fill in the Blank question${questions.length > 1 ? "s" : ""}`;
        return {
            contentId,
            name,
            preview: { questions: questions.slice(0, 3), total: questions.length },
            data: { questions },
        };
    }
    if (qType === "memory_match") {
        const output = await generateJson({
            system: "You are an expert question writer. Reply with ONLY JSON: " +
                "{ questions: [{ prompt, pairs: [{ label, emoji }] }] }. " +
                "Each question must have 4 concept pairs.",
            prompt: [
                `Subject: ${params.subject}`,
                `Grade level: ${params.gradeLevel}`,
                `Topic: ${params.topic}`,
                `Difficulty: ${params.difficulty}`,
                `Count: ${Math.min(params.count, 5)}`,
            ].join("\n"),
            maxTokens: 3000,
        });
        const questions = (output.questions || []).map((q) => {
            const pairs = (q.pairs || []).slice(0, 4).map((p, idx) => ({
                id: idx + 1,
                label: p.label,
                emoji: p.emoji || "⭐",
            }));
            return {
                prompt: q.prompt || `Match concepts for ${params.topic}`,
                pairs,
                grid: "4x4",
                questionType: "memory_match",
                explanation: q.explanation || "Match the pairs.",
                questionData: { grid: "4x4", pairs },
            };
        });
        const contentId = newContentId("question");
        const name = `${params.topic} — ${questions.length} Memory Match question${questions.length > 1 ? "s" : ""}`;
        return {
            contentId,
            name,
            preview: { questions: questions.slice(0, 3), total: questions.length },
            data: { questions },
        };
    }
    if (qType === "drag_drop_match") {
        const output = await generateJson({
            system: "You are an expert question writer. Reply with ONLY JSON: " +
                "{ questions: [{ prompt, pairs: [{ item, target }] }] }. " +
                "Provide 3-4 item-target pairs per question.",
            prompt: [
                `Subject: ${params.subject}`,
                `Grade level: ${params.gradeLevel}`,
                `Topic: ${params.topic}`,
                `Difficulty: ${params.difficulty}`,
                `Count: ${Math.min(params.count, 5)}`,
            ].join("\n"),
            maxTokens: 3000,
        });
        const questions = (output.questions || []).map((q) => {
            const pairs = (q.pairs || []).slice(0, 4);
            const drag_items = pairs.map((p, idx) => ({
                id: `drag-${idx + 1}`,
                label: p.item,
                image: `https://placehold.co/160x160/EEF2FF/4338CA?text=${encodeURIComponent(p.item)}`,
            }));
            const drop_targets = pairs.map((p, idx) => ({
                id: `target-${idx + 1}`,
                label: p.target,
            }));
            const match_rules = pairs.map((_, idx) => ({
                drag_item_id: `drag-${idx + 1}`,
                drop_target_id: `target-${idx + 1}`,
            }));
            return {
                prompt: q.prompt || "Match each item with its correct target.",
                drag_items,
                drop_targets,
                match_rules,
                questionType: "drag_drop_match",
                explanation: q.explanation || "",
                questionData: { drag_items, drop_targets, match_rules },
            };
        });
        const contentId = newContentId("question");
        const name = `${params.topic} — ${questions.length} Drag & Drop question${questions.length > 1 ? "s" : ""}`;
        return {
            contentId,
            name,
            preview: { questions: questions.slice(0, 3), total: questions.length },
            data: { questions },
        };
    }
    // Multi-choice, Single-choice, True/False
    const output = await generateJson({
        system: "You are an expert exam-question writer. Reply with ONLY JSON matching: " +
            "{ questions: [{ prompt, options: [string, string, string, string], correctAnswer, explanation }] }. " +
            (qType === "true_false"
                ? "For true_false, options must be ['True','False']."
                : "Always include 4 distinct options with 1 unambiguous correct answer."),
        prompt: [
            `Subject: ${params.subject}`,
            `Grade level: ${params.gradeLevel}`,
            `Topic: ${params.topic}`,
            `Question type: ${qType}`,
            `Difficulty: ${params.difficulty}`,
            `Count: ${params.count}`,
        ].join("\n"),
        maxTokens: 3000,
    });
    const questions = (output.questions || []).map((q) => {
        let options = Array.isArray(q.options) ? [...q.options] : ["Option A", "Option B", "Option C", "Option D"];
        const isBool = options.length === 2 && options.every((o) => /^(true|false|yes|no)$/i.test(o.trim()));
        if (!isBool && options.length > 1) {
            options = shuffleArray(options);
        }
        const correctIdx = Math.max(0, options.indexOf(q.correctAnswer));
        const formattedOptions = options.map((opt, idx) => ({
            id: `opt-${idx + 1}`,
            label: opt,
            text: opt,
            is_correct: idx === correctIdx,
            correct: idx === correctIdx,
        }));
        return {
            prompt: q.prompt,
            options,
            correctAnswer: q.correctAnswer,
            correctOptionIndex: correctIdx,
            explanation: q.explanation,
            questionType: qType,
            questionData: {
                question: q.prompt,
                options: formattedOptions,
                correctOptionIndex: correctIdx,
                correct_option: correctIdx,
                explanation: q.explanation,
            },
        };
    });
    const contentId = newContentId("question");
    const name = `${params.topic} — ${questions.length} ${qType} question${questions.length > 1 ? "s" : ""}`;
    return {
        contentId,
        name,
        preview: { questions: questions.slice(0, 3), total: questions.length },
        data: { questions },
    };
}
