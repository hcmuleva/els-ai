import { z } from "zod";
import { generateJson } from "../../agent/llmClient.js";
import { newContentId } from "../../utils/ids.js";
import type { StoryParams } from "../types.js";
import type { GeneratorResult } from "./types.js";

const StoryOutput = z.object({
  title: z.string(),
  body: z.string(),
  moral: z.string().optional(),
});

export async function generateStory(
  params: z.infer<typeof StoryParams>,
): Promise<GeneratorResult> {
  const output = await generateJson<z.infer<typeof StoryOutput>>({
    system:
      "You are a children's/educational story writer. Reply with ONLY JSON matching: " +
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
