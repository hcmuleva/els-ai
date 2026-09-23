import type { ContentType } from "../types.js";

export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Cheap structural/consistency checks that run after generation and before
 * the job is marked complete. These are on top of the zod schema parsing
 * each generator already does — this layer catches things schemas can't
 * (e.g. an MCQ's correctAnswer not actually being one of its options).
 * Extend this per content type as real content issues turn up.
 */
export function validateGeneratedContent(
  contentType: ContentType,
  data: unknown,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const questions =
    (data as any)?.questions ?? (contentType === "quiz" ? (data as any)?.questions : undefined);

  if (Array.isArray(questions)) {
    questions.forEach((q: any, i: number) => {
      // Auto-sanitize and deduplicate options
      if (Array.isArray(q.options) && q.options.length > 0) {
        const seen = new Set<string>();
        const sanitized: string[] = [];
        q.options.forEach((opt: any, optIdx: number) => {
          let str =
            typeof opt === "string"
              ? opt.trim()
              : String(opt?.text ?? opt?.option ?? opt?.choice ?? opt?.value ?? opt?.label ?? opt ?? "").trim();
          if (!str || str === "[object Object]") {
            str = `Option ${String.fromCharCode(65 + optIdx)}`;
          }
          if (seen.has(str.toLowerCase())) {
            str = `${str} (${String.fromCharCode(65 + optIdx)})`;
          }
          seen.add(str.toLowerCase());
          sanitized.push(str);
        });
        q.options = sanitized;

        // Ensure correctAnswer is one of the options
        if (!q.correctAnswer || !q.options.includes(q.correctAnswer)) {
          const idx =
            typeof q.correctOptionIndex === "number" &&
            q.correctOptionIndex >= 0 &&
            q.correctOptionIndex < q.options.length
              ? q.correctOptionIndex
              : 0;
          q.correctAnswer = q.options[idx];
          q.correctOptionIndex = idx;
        }
      }

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
    const body = (data as any)?.body;
    if (!body || body.trim().length < 30) {
      issues.push({ path: "body", message: "generated body is too short" });
    }
  }

  return issues;
}
