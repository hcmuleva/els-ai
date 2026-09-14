import { z } from "zod";
import { generateJson } from "../../agent/llmClient.js";
import { newContentId } from "../../utils/ids.js";
import type { ContentParams } from "../types.js";
import type { GeneratorResult } from "./types.js";

const ContentOutput = z.object({
  title: z.string(),
  body: z.string(),
  keyTakeaways: z.array(z.string()),
});

export async function generateContent(
  params: z.infer<typeof ContentParams>,
): Promise<GeneratorResult> {
  const output = await generateJson<z.infer<typeof ContentOutput>>({
    system:
      "You are an educational writer. Reply with ONLY JSON matching: " +
      "{ title, body, keyTakeaways: string[] }. `body` is markdown.",
    prompt: [
      `Subject: ${params.subject}`,
      `Grade level: ${params.gradeLevel}`,
      `Topic: ${params.topic}`,
      `Format: ${params.format}`,
      `Target length: ~${params.lengthWords} words`,
    ].join("\n"),
    maxTokens: 3000,
  });

  const parsed = ContentOutput.parse(output);
  const contentId = newContentId("content");

  return {
    contentId,
    name: parsed.title,
    preview: {
      title: parsed.title,
      excerpt: parsed.body.slice(0, 400),
      keyTakeaways: parsed.keyTakeaways,
    },
    data: parsed,
  };
}
