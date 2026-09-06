# Media Service (`media-service`)

Single source of truth for file uploads and media URL resolution. Every other service routes user-facing uploads through here — no other service writes to S3 directly.

## What this service does
- Accept base64 / data-URL uploads, push them to S3, persist an asset record, return both a signed URL (for immediate use) and the canonical S3 URL (for DB persistence).
- Re-sign canonical S3 URLs on demand (single or batch) so callers can refresh expiring URLs without re-uploading.
- Resolve the metadata for a stored asset by id.
- Fall back to a local `assets/` folder when S3 isn't configured (dev mode).

## Routes (gateway-prefixed: `/assets`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/assets/upload` | Base64 / data-URL upload → S3 → DB → signed + canonical URLs. |
| POST | `/assets/resolve` | Convert a single stored canonical URL into a signed URL. |
| POST | `/assets/resolve/batch` | Same, in bulk for a list of URLs. |
| GET | `/assets/:assetId` | Fetch metadata for a stored asset. |

### `POST /assets/upload` shape
```json
{
  "dataUrl": "data:image/png;base64,...",
  "fileName": "photo.png",
  "mimeType": "image/png",
  "mediaType": "image",
  "context": "classroom.attachment"
}
```
```json
{
  "assetId": "uuid",
  "url": "https://...signed...",
  "canonicalUrl": "https://bucket.../key",
  "fileName": "uuid.png",
  "mediaType": "image",
  "mimeType": "image/png",
  "key": "uploads/<org>/<file>"
}
```

## Tables owned
- `assets (id, organization_id, asset_type, file_url, metadata, created_at)`

## Environment
| Var | Default | Description |
|---|---|---|
| `PORT` | `4004` | |
| `DATABASE_URL` | from `.env` | Shared Postgres cluster |
| `LOCAL_MEDIA_DIR` | `assets/` | Fallback storage when S3 isn't configured |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | optional | Enables S3 uploads when set |

## Layout
```
src/
  routes/assets.ts        upload, resolve, get
  services/s3.ts          S3 client + signing helpers
  middleware/auth.ts
  db.ts
  server.ts               PORT=4004
```

## Dev
```bash
npm --workspace backend/media-service run dev
npm --workspace backend/media-service run typecheck
```

## Shared deps
- `@els-ai/internal-auth` (planned — currently uses local JWT middleware that also accepts gateway headers)
