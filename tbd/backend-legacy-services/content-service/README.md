# Content Service (`content-service`)

Owns the **learning content library** — videos, articles, audio clips, images, reels, YouTube URLs — and the org subject catalog used to file new items under a class × subject.

## What this service does
- CRUD over learning content items.
- Multi-section content: each item carries an ordered list of sections, each with its own content type and media payload.
- Sign S3-hosted media URLs on read so the client gets fresh, short-lived URLs.
- Convert client-supplied media URLs to a canonical persistent form before storage.
- Serve the org subject catalog (class × subject), driving the topic/content authoring pickers.

## Routes (gateway-prefixed: `/content`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/items` | List items (`class_level`, `subject`, `topic_id`, `search`, `limit`). |
| GET | `/items/:contentId` | Single item with ordered sections + signed media. |
| POST | `/items` | Create item (supports inline `sections[]` or legacy single-content-type payload). |
| PUT | `/items/:contentId` | Update item (replaces sections). |
| DELETE | `/items/:contentId` | Delete item. |
| GET | `/subjects` | Subject catalog for the current org (filterable by `class_level`). |

> Topic-scoped operations (`/topics/*`, `/topics/:id/assignments`, …) are owned by **topic-service**.

## Tables owned
- `learning_contents`
- `learning_content_sections`
- `subjects` (read; populated by content authoring)

## Events emitted (planned)
- `content.published`
- `content.updated`
- `content.deleted`

## Environment
| Var | Default | Description |
|---|---|---|
| `PORT` | `4009` | |
| `DATABASE_URL` | from `.env` | Shared Postgres cluster |
| `JWT_SECRET` | shared with gateway | |
| `INTERNAL_SECRET` | shared with gateway | |

## Layout
```
src/
  routes/content.ts        all 6 handlers + helpers
  middleware/auth.ts       delegates to @els-ai/internal-auth
  repositories/content.repository.ts
  events/bus.ts
  services/s3.ts
  db.ts
  server.ts                PORT=4009
```

## Dev
```bash
npm --workspace backend/content-service run dev
npm --workspace backend/content-service run typecheck
```

## Shared deps
- `@els-ai/internal-auth`
- `@els-ai/event-bus`
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
