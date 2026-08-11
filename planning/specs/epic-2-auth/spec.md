# EPIC-2: Auth — Spec

See [constitution.md](../../constitution.md) for shared principles and the
doc-vs-ticket precedence rule.

## Tickets covered

- **LN7** — OAuth2 client-credentials token endpoint
- **LN8** — Bearer authentication middleware
- **LN9** — Token expiry & revocation handling

## User stories

- **LN7**: As an API consumer, I want to exchange my client ID and secret
  for a bearer access token via `/oauth/token`, so that I can authenticate
  subsequent API calls.
- **LN8**: As a platform developer, I want middleware that validates the
  bearer token on every protected route, so that only authenticated clients
  can access the API.
- **LN9**: As an API consumer, I want expired or revoked tokens to be
  rejected clearly, so that I know to request a new token rather than
  receiving a confusing error.

## Acceptance criteria

**LN7**
- `POST /oauth/token` accepts `client_id` and `client_secret` (see "Resolved
  conflicts" — no `grant_type` field, per the doc)
- Valid credentials return an access token, `token_type=Bearer`, and
  `expires_in` seconds
- Invalid `client_id`/`client_secret` returns HTTP 401 (see "Resolved
  conflicts" — body is `{"message":"Unauthenticated"}`, not
  `error=invalid_client`)
- Missing/malformed parameters return a 422 with field-level validation
  errors (see "Resolved conflicts" — 422, not 400)
- Issued tokens are recorded (client, issue time, expiry) for audit and
  revocation purposes

**LN8**
- Requests without an `Authorization` header are rejected with HTTP 401
- Requests with a malformed header (missing `"Bearer "` prefix) are rejected
  with HTTP 401
- A syntactically valid but unknown/tampered token is rejected with HTTP 401
- A valid token attaches the authenticated client's identity/scopes to the
  request context (`req.client`)
- Middleware is applied globally to all routes except `/up` (doc's health
  endpoint — see "Resolved conflicts") and `/oauth/token`

**LN9**
- A request made with an expired token returns HTTP 401 (see "Resolved
  conflicts" — doc body is `{"message":"Unauthenticated"}`; a `reason:
  "token_expired"` field is added as a replica-only extension)
- A request made with a revoked token returns HTTP 401 with `reason:
  "token_revoked"` (extension field, same doc-compliant message)
- Token expiry is enforced server-side regardless of any client-reported
  value
- An endpoint/administrative action exists to revoke a client's active
  tokens (extension — not in the doc, see "Resolved conflicts")
- Expired/revoked token attempts are captured in security logs with client
  ID and timestamp

## Resolved conflicts

Full detail in [constitution.md](../../constitution.md#resolved-conflicts-reference-table);
summarized for this epic:

- **No `grant_type`/`scope` on the token request.** The doc's `POST
  /oauth/token` body is exactly `{client_id, client_secret}` — no RFC 6749
  client-credentials envelope. We replicate the doc's body, not LN7's
  literal wording.
- **401 body is `{"message":"Unauthenticated"}`, not `{"error":
  "invalid_client"}`.** This exact string appears in the doc's own 401
  samples elsewhere, so it's replicated verbatim across every 401 in the
  system, including this endpoint's own failure case.
- **Validation is 422, never 400.**
- **No revoke/refresh/introspect endpoint exists in the doc.** LN9's
  revocation requirement is built as a replica-only extension:
  `POST /oauth/token/revoke` (body: `{client_id, client_secret}` or an
  already-authenticated admin call — see plan.md), not part of the
  documented surface. It must never be assumed by anything that claims to
  test doc-compliant behavior (e.g. EPIC-8's drift check must allowlist it
  as a known extension).
- **`reason` field is additive.** Real consumers checking only `message`
  see doc-identical behavior; our own tests can additionally assert on
  `reason` to distinguish `invalid_token` / `token_expired` /
  `token_revoked` / `missing_token` without breaking doc parity.
- **Health route is `/up`** (per the original phase-1 plan's endpoint
  naming, not `/health` as LN8's wording might imply) — the middleware
  allowlist targets `/up`, not `/health`.

## Out of scope

- Any notion of OAuth "scopes" (doc has none; LN8's "scopes" wording is
  satisfied by attaching just the client identity — there is only one tier
  of access in the doc).
- User-level auth (users module is phase 2 per the original plan).
