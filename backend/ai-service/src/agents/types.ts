// Agent provider abstraction for the AI chat router (P2 item 9 — full
// multi-agent AI router, per CLIENT_REFACTOR.md Phase 5 / CLIENT_PLAN.md §4).
//
// Chat v1 (see prompts.ts) called Ollama directly from the route handler.
// This layer generalizes that into a provider-agnostic contract so new
// providers can be registered without touching the route: each provider
// implements `AgentProvider`, the `AgentRouter` (router.ts) picks one per
// request and falls back to the next registered provider if the first
// never starts responding.
//
// Providers intentionally NOT implemented yet, and why:
// - Factory AI: Factory's public API (api.factory.ai) has no chat/completion
//   endpoint — only platform-management APIs (Droid coding sessions,
//   computers, CI automations, org/service-account admin). Wiring "Factory
//   AI" to the Droid Sessions API would mean spinning up a real coding-agent
//   session per chat message (slow, billable, and grants the chatbot shell/
//   file access) — not an appropriate fit for a student/teacher/parent
//   tutor chat. Revisit if Factory ships a plain completion API.
// - Microsoft Copilot / Enterprise Copilot: no credentials provided.
// Both were explicitly deferred by product decision; this file's job is to
// make adding either one later a matter of writing one new file.

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type AgentStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'usage'; promptTokens?: number; completionTokens?: number };

/**
 * Emitted by the router (not by individual providers) right before it
 * attempts each candidate, so callers always learn which provider was tried
 * even if it fails before yielding a single `AgentStreamEvent` — otherwise a
 * provider that's unreachable from the first byte would be un-attributable
 * in the usage/audit log.
 */
export type AgentRunEvent = (AgentStreamEvent & { providerId: string }) | { type: 'attempt'; providerId: string };

export type AgentStreamParams = {
  messages: ChatMessage[];
  signal?: AbortSignal;
};

export interface AgentProvider {
  /** Stable id used in requests/permissions/usage logs, e.g. "ollama". */
  id: string;
  /** Human-readable label for a future provider-selector UI. */
  label: string;
  /** Cheap reachability check (e.g. hit a health/tags endpoint) used before/for fallback decisions. */
  isAvailable(): Promise<boolean>;
  /** Streams the assistant's reply as text deltas, plus a final usage event when the provider reports token counts. */
  stream(params: AgentStreamParams): AsyncGenerator<AgentStreamEvent>;
}
