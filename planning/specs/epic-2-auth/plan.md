# EPIC-2: Auth — Plan

## Endpoints/contracts

### `POST /oauth/token` (doc-compliant)

Request:
```json
{ "client_id": "string", "client_secret": "string" }
```
Zod schema: both required strings; error-code map `{client_id: {required:
<code>}, client_secret: {required: <code>}}` (transcribed from
`lib/errorCodes.ts`, exact codes filled in from the doc's table when this
field is implemented — not guessed here).

Success (200):
```json
{ "token_type": "Bearer", "expires_in": 1800, "access_token": "<opaque>" }
```
- `access_token` — `crypto.randomBytes(32).toString('hex')`, stored in
  `AccessToken.token` (unique).
- `expiresAt = now + 1800s`.

Failure (401, bad client_id/secret):
```json
{ "message": "Unauthenticated" }
```

Failure (422, malformed body): shared `lib/validation.ts` shape from
EPIC-1.

### `POST /oauth/token/revoke` (extension, not in doc)

Request: `{ "client_id": "string", "client_secret": "string" }` (same
credential check as issuance — a client can revoke its own tokens; no
separate admin role exists yet in phase 1).

Success (200): `{ "revoked": <count> }` — sets `revokedAt = now()` on every
active `AccessToken` row for that client.

Labeled in responses/docs as `x-extension: true` equivalent — tracked in
EPIC-8's allowlist so the doc-parity drift check doesn't flag it as
undocumented.

## Bearer auth middleware (`middleware/auth.ts`)

Applied globally in `app.ts` via `app.use(auth)` mounted **before** all
routers except `/up` and `/oauth/token` (checked by path prefix inside the
middleware, or by mounting the two exempt routes on a router registered
before `app.use(auth)` — implementation picks whichever keeps route
registration order simplest, functionally identical either way).

Logic:
1. No `Authorization` header → 401 `{"message":"Unauthenticated","reason":
   "missing_token"}`.
2. Header doesn't start with `"Bearer "` → 401, `reason: "invalid_token"`.
3. Token not found in `AccessToken` → 401, `reason: "invalid_token"`.
4. `revokedAt` is set → 401, `reason: "token_revoked"`; log
   `{clientId, token (redacted to last 6 chars), timestamp}` to security
   log.
5. `expiresAt < now()` → 401, `reason: "token_expired"`; same security log.
6. Otherwise → attach `req.client = {id, clientId, name}`, `next()`.

`reason` is the one additive field beyond the doc's `message` — every
branch above still returns the exact doc body as its `message` value.

## Data model additions

`AccessToken.revokedAt` (nullable timestamp) already added in EPIC-1's
foundation subset of `schema.prisma` — no new migration needed here beyond
what EPIC-1 already created; this epic just uses the column.

## Security logging

A lightweight `lib/securityLog.ts` (or reuse the correlation-id-tagged
logger from EPIC-1) writes one structured line per rejected auth attempt:
`{event: "auth_rejected", reason, clientId?, tokenSuffix?, timestamp,
correlationId}`. No new infra — stdout logging is sufficient for phase 1;
this is what a future SIEM/log-shipping integration would consume, not
something this phase wires up.

## Verification

1. `POST /oauth/token` with the seeded client's real credentials (from
   LN4's seed output) → 200 with a token; that token used on `GET /up`... 
   (actually `/up` is unauthenticated — use a placeholder protected route or
   the token itself decoded against `AccessToken` table) works on any
   protected route once one exists (first real one arrives in EPIC-3/4, so
   this step is validated by a temporary authenticated test route in
   `tests/integration/auth.test.ts` if no real protected route exists yet).
2. Bad credentials → 401 `{"message":"Unauthenticated"}`.
3. Malformed body (missing `client_secret`) → 422 with field-level detail.
4. No `Authorization` header on a protected route → 401,
   `reason: "missing_token"`.
5. `Authorization: Token abc` (wrong prefix) → 401, `reason: "invalid_token"`.
6. Manually expire a token's `expiresAt` in the DB → request with it → 401,
   `reason: "token_expired"`.
7. Call `POST /oauth/token/revoke`, then reuse the old token → 401,
   `reason: "token_revoked"`.
8. Security log shows one line per rejected attempt above with client ID
   (where known) and timestamp.
