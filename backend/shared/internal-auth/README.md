# @els-ai/internal-auth

Trust layer between the API gateway and every backend service.

## Purpose
- The **gateway** verifies the user's JWT exactly once. Downstream services never re-verify the JWT; they trust signed headers added by the gateway.
- Provides a single, shared `requireAuth` middleware so every service authenticates the same way.
- Supports a **JWT fallback** for when a service is called directly (tests, internal scripts).

## How it works
1. Client → `Authorization: Bearer <jwt>` → Gateway.
2. Gateway calls `verifyJwtPayload(token)`.
3. Gateway calls `buildInternalHeaders(user)` and rewrites the request headers with:
   - `x-internal-secret` — shared secret, proves the request came from the gateway.
   - `x-internal-user-id`, `x-internal-organization-id`, `x-internal-email`, `x-internal-role`, `x-internal-roles`, `x-internal-is-superadmin`, `x-internal-can-publish-global`.
4. Gateway proxies to the upstream service.
5. Service uses `createRequireAuth()` middleware which:
   - Validates `x-internal-secret` and parses the other `x-internal-*` headers into `req.user`, **or**
   - Falls back to JWT verification when `allowJwtFallback !== false`.

## Usage in a service
```ts
import { createRequireAuth, requireRole, AuthenticatedRequest } from '@els-ai/internal-auth';

export const requireAuth = createRequireAuth();
// or supply explicit secrets for tests:
// createRequireAuth({ jwtSecret: 'x', internalSecret: 'y', allowJwtFallback: false });

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ userId: req.user!.userId, role: req.user!.role });
});

router.post('/admin-only', requireAuth, requireRole(['admin', 'superadmin']), handler);
```

## Usage at the gateway
```ts
import { verifyJwtPayload, buildInternalHeaders } from '@els-ai/internal-auth';

const user = verifyJwtPayload(token);
if (!user) return res.status(401).json({ message: 'Invalid token' });

const headers = buildInternalHeaders({ ...user, internalSecret: process.env.INTERNAL_SECRET });
Object.entries(headers).forEach(([k, v]) => (req.headers[k] = v));
```

## Environment
| Var | Default | Description |
|---|---|---|
| `JWT_SECRET` | `els-secret-key-super-secure` | HS256 secret for issuing & verifying JWTs |
| `INTERNAL_SECRET` | `els-internal-secret-change-me` | Shared between gateway and all services |

> Both secrets must be the same value across every process; rotate together.

## Security model
- Downstream services bound to localhost / private network only. A leaked downstream port can't be exploited externally because the load balancer / cluster never exposes it.
- Each service still enforces RBAC via `requireRole` and tenant isolation at the repository layer (`WHERE organization_id = $1`).
- The internal secret is the only thing the gateway adds that a forged client cannot trivially provide; rotate on credential change.
