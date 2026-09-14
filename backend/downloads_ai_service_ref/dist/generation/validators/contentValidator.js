/**
 * Cheap structural/consistency checks that run after generation and before
 * the job is marked complete. These are on top of the zod schema parsing
 * each generator already does — this layer catches things schemas can't
 * (e.g. an MCQ's correctAnswer not actually being one of its options).
 * Extend this per content type as real content issues turn up.
 */
export function validateGeneratedContent(contentType, data) {
    const issues = [];
    const questions = data?.questions ?? (contentType === "quiz" ? data?.questions : undefined);
    if (Array.isArray(questions)) {
        questions.forEach((q, i) => {
            if (q.options && !q.options.includes(q.correctAnswer)) {
                issues.push({
                    path: `questions[${i}].correctAnswer`,
                    message: "correctAnswer is not one of the listed options",
                });
            }
            if (q.options && new Set(q.options).size !== q.options.length) {
                issues.push({ path: `questions[${i}].options`, message: "duplicate options" });
            }
            if (!q.prompt || q.prompt.trim().length < 5) {
                issues.push({ path: `questions[${i}].prompt`, message: "prompt is missing or too short" });
            }
        });
    }
    if (contentType === "content" || contentType === "story") {
        const body = data?.body;
        if (!body || body.trim().length < 30) {
            issues.push({ path: "body", message: "generated body is too short" });
        }
    }
    return issues;
}
//# sourceMappingURL=contentValidator.js.map