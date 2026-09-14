# ai-service

Backend for the ELS-AI chat agent: turns a chat conversation into generated
educational content (topic, question, quiz, content, story, classroom) with
an explicit Generate/Cancel confirmation step, live step-by-step progress,
and a search-able result.

See `docs/IMPLEMENTATION_GUIDE.md` for the full architecture and
`docs/SYSTEM_PROMPT.md` for the agent prompt (mirrors `src/agent/systemPrompt.ts`).

## Run locally

```bash
cp .env.example .env   # fill in ANTHROPIC_API_KEY at minimum
npm install
npm run dev
```

## Layout

```
src/
  agent/         chat orchestration: system prompt, LLM client, proposal parsing
  mcp/            MCP server + tools (same generation core, MCP transport)
  generation/     pipeline, generators per content type, validation, storage
  events/         SSE hub for streaming step progress to the chat UI
  routes/         REST surface the chat UI calls
  middleware/     auth, error handling
  config/         env loading
```
