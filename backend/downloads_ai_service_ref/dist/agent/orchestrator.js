import { anthropic } from "./llmClient.js";
import { AGENT_SYSTEM_PROMPT } from "./systemPrompt.js";
import { env } from "../config/env.js";
import { GenerationProposal } from "../generation/types.js";
import { z } from "zod";
export const RevisionProposal = z.object({
    type: z.literal("revision_proposal"),
    contentId: z.string(),
    instruction: z.string(),
    summary: z.string(),
});
const JSON_FENCE_RE = /```json\s*([\s\S]*?)```/;
export async function runChatTurn(history, conversationId) {
    const response = await anthropic.messages.create({
        model: env.AGENT_MODEL,
        max_tokens: 1500,
        system: AGENT_SYSTEM_PROMPT,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const match = raw.match(JSON_FENCE_RE);
    if (!match) {
        return { reply: raw.trim() };
    }
    const reply = raw.replace(JSON_FENCE_RE, "").trim();
    let parsedJson;
    try {
        parsedJson = JSON.parse(match[1]);
    }
    catch {
        // Model emitted malformed JSON — fall back to plain reply rather than
        // surfacing a broken card to the user.
        return { reply: raw.trim() };
    }
    const proposal = GenerationProposal.safeParse({ ...parsedJson, conversationId });
    if (proposal.success) {
        return { reply, proposal: proposal.data };
    }
    const revision = RevisionProposal.safeParse(parsedJson);
    if (revision.success) {
        return { reply, revisionProposal: revision.data };
    }
    return { reply: raw.trim() };
}
//# sourceMappingURL=orchestrator.js.map