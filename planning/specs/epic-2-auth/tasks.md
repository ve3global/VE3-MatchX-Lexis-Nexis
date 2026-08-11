# EPIC-2: Auth — Tasks

- [x] Zod schema for `POST /oauth/token` body (client_id/client_secret
      required strings) (LN7)
- [x] `POST /oauth/token` handler: bcrypt-compare secret, issue token, store
      `AccessToken` row, return `{token_type, expires_in, access_token}`
      (LN7)
- [x] 401 `{"message":"Unauthenticated"}` on bad credentials (LN7)
- [x] `middleware/auth.ts` — header presence/prefix/lookup/expiry/revoked
      checks, `req.client` attachment, `reason` field on every 401 (LN8,
      LN9)
- [x] Mount `auth` middleware globally except `/up` and `/oauth/token` (LN8)
- [x] `lib/securityLog.ts` — structured log line on every rejected auth
      attempt (LN9)
- [x] `POST /oauth/token/revoke` extension endpoint — sets `revokedAt` on
      all active tokens for a client (LN9)
- [x] Add this epic's extension endpoints (`/oauth/token/revoke`) to the
      EPIC-8 doc-parity allowlist (tracked here, applied when EPIC-8 lands)
- [x] Integration test: valid credentials → 200 with usable token (LN7)
- [x] Integration test: invalid credentials → 401
      `{"message":"Unauthenticated"}` (LN7)
- [x] Integration test: malformed body → 422 field-level errors (LN7)
- [x] Integration test: missing/malformed/unknown token → 401 with correct
      `reason` (LN8)
- [x] Integration test: expired token → 401 `reason: "token_expired"` (LN9)
- [x] Integration test: revoked token → 401 `reason: "token_revoked"` (LN9)
