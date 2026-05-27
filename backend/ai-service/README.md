# AI Service (`ai-service`)

Stateless AI capabilities only — generates drafts/suggestions/insights. Owning services persist the result.

> Rule: this service never reads or writes the application database. Anything that needs persistence is returned to the caller, which writes it via its own service.

## What this service does
- Generate a quiz draft (drag-drop or image-select) for a given topic / class level / difficulty.
- Hold a single edge for AI integrations so domain services can stay free of LLM SDKs and model keys.

## Routes (gateway-prefixed: `/ai`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/ai/generate` | Generate a quiz draft from `{ topic, classLevel, difficulty, quizType }`. |

### Planned
- `POST /ai/recommend` — next-topic recommendation.
- `POST /ai/insights` — analytics insights summarization.
- `POST /ai/grade` — auto-evaluation of free-text answers.

## Events (planned)
- `ai.draft.ready` — once question generation moves to an async queue.

## Environment
| Var | Default | Description |
|---|---|---|
| `PORT` | `4003` | |
| `JWT_SECRET` | shared with gateway | JWT fallback |
| `INTERNAL_SECRET` | shared with gateway | Trust gateway headers |
| `OPENAI_API_KEY` | optional | When the simulated generator is replaced with a real model |

## Layout
```
src/
  routes/ai.ts        controllers
  middleware/auth.ts  delegates to @els-ai/internal-auth
  server.ts           PORT=4003
```

## Dev
```bash
npm --workspace backend/ai-service run dev
npm --workspace backend/ai-service run typecheck
```

## Shared deps
- `@els-ai/internal-auth`
- `@els-ai/event-bus` (for future async draft delivery)
