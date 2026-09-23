# Implementation Guide — Chat-Driven Content Generation

What this covers: turning "cal n" (chat) into an agent that can create
topics, questions, quizzes, content, stories, and classrooms, with an
in-chat Generate/Cancel confirmation, a live step tracker, and a final
green-check + searchable result + preview.

## 1. End-to-end flow

```
User types in chat
        │
        ▼
POST /api/chat  (chat.routes.ts → agent/orchestrator.ts)
        │  runs one LLM turn with AGENT_SYSTEM_PROMPT
        │  extracts a generation_proposal or revision_proposal if present
        ▼
Chat UI renders:
  - the assistant's text reply
  - IF a proposal came back: a card with the proposed title/summary
    and "Generate" / "Cancel" buttons
        │
        │  user taps Generate
        ▼
POST /api/generation/start  { conversationId, contentType, title, params }
        │
        ▼  202 { jobId }
Chat UI opens:  GET /api/generation/stream/:jobId   (SSE)
        │
        ▼
Backend pipeline runs (generation/pipeline.ts), publishing SSE events:
  step_start  { step: "gathering_information", label }
  step_complete { step: "gathering_information" }
  step_start  { step: "creating_entity", label }
  step_complete
  step_start  { step: "adding_content", label }     ← LLM generation happens here
  step_complete
  step_start  { step: "validating_context", label }
  step_complete
  step_start  { step: "finalizing", label }
  step_complete
  job_completed { contentId, name, preview }
        │
        ▼
Chat UI:
  - ticks off each step as step_complete arrives
  - on job_completed: shows the animated green checkmark, the content's
    name (so the user can search for it later), and renders `preview`
    inline so they can see the result in the chat itself
  - user can then type "change question 3" etc. → next chat turn returns a
    revision_proposal → same Generate/Cancel + step-tracker flow, but
    against POST /api/generation/revise instead of /start
```

If the user cancels a proposal, nothing is called on the backend at all —
the proposal is just discarded client-side. No job is ever created for a
cancelled proposal, so there's nothing to clean up.

## 2. Why two turns (propose → confirm) instead of one

The agent's tools never generate content directly (see
`docs/SYSTEM_PROMPT.md` → "Why the propose, then confirm split"). The
Generate/Cancel buttons the user asked for are only meaningful if clicking
"Generate" is the thing that actually triggers generation — otherwise it's
just decoration around content that was already created. This also means
retries, edits to the proposal ("actually make it 15 questions"), and
cancels are all free — no wasted generation calls.

## 3. MCP vs REST — use both, same core

Two transports sit in front of the same generation core
(`generation/pipeline.ts`, `generation/revise.ts`, `generation/contentRepo.ts`):

- **REST** (`routes/*.ts`) — what the chat UI calls after the user taps
  Generate/Cancel or when polling/streaming progress. This is what you
  wire the frontend to.
- **MCP** (`mcp/server.ts`, `mcp/tools/generationTools.ts`) — the same four
  operations (`start_generation`, `revise_generation`,
  `get_generation_status`, `search_content`) exposed as MCP tools over
  `POST /mcp`. Use this if the chat agent itself runs inside an
  MCP-capable runtime (e.g. a Claude agent loop with an MCP connector)
  instead of your own custom orchestrator — then the *agent* can call
  `search_content` directly to answer "find my last quiz", for example,
  without a round trip through your REST layer.

Both paths call the exact same `runGenerationJob` / `runRevisionJob`
functions, so job semantics (steps, SSE events, persistence) never drift
between them.

## 4. Step tracker contract (for the frontend)

Steps are fixed and ordered (`generation/types.ts` → `PIPELINE_STEPS`):

| key                    | label                  |
|-------------------------|------------------------|
| `gathering_information` | Gathering information |
| `creating_entity`       | Creating {contentType} |
| `adding_content`        | Adding content         |
| `validating_context`    | Validating context     |
| `finalizing`            | Finalizing             |

Render a fixed 5-item list, mark each item "active" on `step_start` and
"done" on `step_complete` for that step's key. On `job_completed`, mark the
whole list done and show the checkmark + `name` + `preview`. On
`job_failed`, stop at whatever step was active and show `error` — don't
silently swallow it, the pipeline already ran real validation.

Revisions use a shorter 4-step list (skip `creating_entity` — nothing new
is being created, an existing item is being edited).

## 5. Content types and their required params

Each content type has its own zod schema in `generation/types.ts` under
`ParamsByType`. The agent's proposal `params` object must satisfy the
matching schema or the `/start` route rejects it with a 400. Add a new
content type by: adding it to the `ContentType` enum, adding its params
schema, adding a generator in `generation/generators/`, registering it in
`generation/generators/index.ts`, and mentioning it in the system prompt.

## 6. Validation ("validating_context" step)

Two layers:

1. **Schema validation** — each generator parses the LLM's JSON output
   against a strict zod schema (`generators/*.generator.ts`). Malformed
   output fails here, before the validating_context step even runs.
2. **Consistency validation** — `generation/validators/contentValidator.ts`
   checks things schemas can't, e.g. an MCQ's `correctAnswer` actually
   being one of its `options`, no duplicate options, non-trivial prompt
   length. This is intentionally where you add domain-specific checks
   later (curriculum alignment, reading-level checks, profanity filters,
   etc.) without touching the generators themselves.

If either layer fails, the job fails with `job_failed` and a message — it
does **not** silently persist bad content.

## 7. Search / "find it later"

`generation/contentRepo.ts` persists every completed generation
(`contentId`, `name`, `ownerId`, `data`) and `routes/search.routes.ts`
exposes `GET /api/content/search?query=&contentType=`. The reference
implementation is in-memory — swap `ContentRepo`'s methods for real DB
queries (Postgres/Supabase, matching the exam-question-pipeline stack)
without touching anything that calls it.

## 8. Auth, rate limiting, scaling notes

- `middleware/auth.middleware.ts` currently verifies a bearer JWT directly
  with `jsonwebtoken` — replace the body of `verifyRequest` with whatever
  `@els-ai/internal-auth` actually exports once you confirm its API; the
  request/response contract (`req.user = { userId, classroomIds, role }`)
  is what the rest of the service depends on, not the verification method.
- `MAX_CONCURRENT_JOBS_PER_USER` (env) caps how many generations one user
  can have in flight — cheap protection against runaway LLM spend from a
  chat loop gone wrong.
- The SSE hub (`events/sseHub.ts`) and job store (`generation/jobStore.ts`)
  are both in-memory and scoped to a single process. That's fine for one
  ai-service replica. The moment you run more than one replica behind a
  load balancer, a client's SSE connection and the job's progress events
  can land on different instances. Swap `sseHub`'s publish/subscribe for
  `@els-ai/event-bus` (pub/sub across instances) and `jobStore` for a
  Redis/Postgres-backed store at that point — both files are written so
  that's a body-only change, not a call-site change.

## 9. Tools/libraries used and why

- **Express 5 + zod** — routes validate every request body against a zod
  schema before anything touches the generation core; validation errors
  become clean 400s via `errorHandler.ts`.
- **`@anthropic-ai/sdk`** — both the chat orchestrator and each content
  generator call it directly; generators ask for JSON-only replies and
  parse+validate the result rather than trusting free text.
- **`@modelcontextprotocol/sdk`** — the MCP tool surface, for agent
  runtimes that expect MCP tools rather than a bespoke REST API.
- **SSE (native, no extra library)** — one-way progress streaming is all
  this needs; simpler and more infra-friendly than WebSockets (works
  through most proxies/load balancers without extra config), which is why
  it's the default here.
- **In-memory stores** (`jobStore`, `contentRepo`) — deliberately the
  simplest possible thing that fully implements the contract, so swapping
  in real infra later is a small, isolated change instead of a rewrite.

## 10. What's stubbed vs production-ready

Production-ready as written: request validation, the propose→confirm
split, the step/SSE protocol, per-content-type generation + validation,
search, MCP tool surface.

Needs your input before shipping:
- Wire `@els-ai/internal-auth`'s real API into `auth.middleware.ts`.
- Swap `jobStore`/`sseHub`/`contentRepo` to real persistence once you run
  more than one instance (see §8).
- Tune each generator's system/user prompt against real sample output —
  the ones here are solid starting points, not final copy.
- Add authorization checks beyond "is logged in" where it matters (e.g. a
  teacher generating into a classroom they don't own) — `AuthedUser`
  already carries `classroomIds`/`role` for this.
