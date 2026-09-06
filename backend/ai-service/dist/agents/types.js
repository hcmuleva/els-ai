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
export {};
