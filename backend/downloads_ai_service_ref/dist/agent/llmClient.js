import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
/**
 * Small helper for generator steps that just need a JSON object back from
 * the model. Keeps the "reply with JSON only" contract in one place.
 */
export async function generateJson(opts) {
    const response = await anthropic.messages.create({
        model: env.AGENT_MODEL,
        max_tokens: opts.maxTokens ?? 4000,
        system: opts.system,
        messages: [{ role: "user", content: opts.prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    try {
        return JSON.parse(cleaned);
    }
    catch {
        throw new Error(`Model did not return valid JSON: ${cleaned.slice(0, 200)}`);
    }
}
//# sourceMappingURL=llmClient.js.map