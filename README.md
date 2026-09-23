# LN Replica

A local replica of the LexisNexis IDU REST API (identity verification / AML
/ fraud checks), used in place of the real service — which has no sandbox —
for development and automated testing. Same endpoints, same request/response
shapes, same validation error codes as the documented API, with deterministic
fake results per subject.

See [planning/constitution.md](planning/constitution.md) for the full
architecture, the doc-vs-ticket precedence rules, and the ticket → epic map.
Phase 1 (core: auth, address lookup, reports, report types, scorecards,
all 27 report actions, doc-parity CI) and phase 2 (notifications,
webhooks, users module, remote-check lifecycle) are both complete — see
[planning/README.md](planning/README.md)'s status tables. Phase 2 has
meaningfully thinner source evidence than phase 1; each phase-2 epic's
`spec.md` documents its own confidence level explicitly.

## Local setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run prisma:migrate
npm run seed
npm run dev
```

The seed script prints a sample client's `client_id`/`client_secret` to the
console — use those to obtain a bearer token from `POST /oauth/token`.

On startup the server logs `Database connected` once Prisma has verified
the `DATABASE_URL` connection, or `Database connection failed: ...` (and
exits) if it can't reach the database.

## Scripts

- `npm run dev` — start the API with hot reload
- `npm run build` / `npm start` — compiled production run
- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run format` — Prettier
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest integration suite
- `npm run seed` — idempotent Prisma seed (sample client + report type +
  scorecard)
- `npm run openapi:generate` — regenerate `docs/openapi.json` (EPIC-8
  doc-parity artifact) from the live route surface
- `npm run postman:generate` — regenerate the full Postman collection
  (`docs/postman/`) from `scripts/generate-postman-collection.ts`

## API testing

Two complementary layers:

- **`npm test`** — the Vitest + Supertest integration suite (153 tests),
  run in-process against the Express app directly (no real network).
- **`docs/postman/`** — a full Postman collection (135 requests across
  every epic, phase 1 and phase 2), runnable interactively or headless via
  [Newman](https://github.com/postmanlabs/newman) against a real running
  instance (`npm run dev`) — exercises the actual HTTP/JSON layer the
  in-process suite doesn't touch. See
  [docs/postman/README.md](docs/postman/README.md) for coverage details
  and the bugs this live-testing pass caught. The Vitest suite passes in
  full (153/153); the Postman collection passes cleanly per folder (each
  folder validated individually via Newman) — running the entire
  collection unfiltered in one go triggers real, shared rate-limit state
  across folders by design (see `docs/postman/README.md`), so that's not
  a supported invocation.

## QA override values

A handful of magic trigger values force deterministic pass/refer/fail
scenarios on demand (see `planning/constitution.md`'s determinism engine
section for the full list), e.g.:

- surname `"SANCTIONED"` → forces `sanction: true` (`sanction-screening`
  action)
- dob `1900-01-01` → forces all three death-screening flags `true`
  (`death-screening` action)

## Known replica-only extensions

Some endpoints exist only in this replica, not in the real LexisNexis API —
built for the team's own testing needs and never assumed by anything
claiming doc parity. Currently:

- `POST /clients` — mints a new tenant's `client_id`/`client_secret` on
  demand, no ticket/doc equivalent (the only prior provisioning path was
  `prisma/seed.ts`'s hardcoded demo client). Mounted pre-auth like
  `/oauth/token` — gated by its own shared secret instead, sent as the
  `X-LN-Replica-Provision-Key` header and compared against the
  `CLIENT_PROVISION_KEY` env var. Unset entirely, the route fails closed
  (500) rather than accepting any/no key. The plaintext `client_secret` is
  returned exactly once, in the creation response — there's no rotation or
  regenerate endpoint yet.
- `POST /oauth/token/revoke` — revoke a client's active tokens (LN9)
- `GET /addresses`, `GET /addresses/search`, `GET /addresses/{reference}` —
  convenience aliases delegating to `POST /address-lookup` (LN10-12)
- `POST /report-types/{id}/reactivate` — reactivate a deactivated report
  type (LN24)
- `POST /scorecards/{id}/publish`, `POST /scorecards/{id}/retire` —
  draft/published/retired lifecycle (LN29)
- `otp_code` field on `otp-email`/`otp-sms` action results — a real send-
  OTP response would never echo the code, but this replica has no real
  inbox/SMS gateway for a caller to read it from (EPIC-7c)
- `PUT /users/self/webhook-url` — sets the client's webhook URL; the doc
  documents rotating a secret once a URL exists (`PUT
  /users/self/webhook-secret`) but never how the URL itself gets set in
  the first place (EPIC-10)
- Webhook message delivery (`test`/`retry`/automatic events) never makes
  a real HTTP call — outcomes are simulated deterministically instead,
  since actually calling an arbitrary caller-supplied URL from a replica
  is an SSRF risk (EPIC-10)
- `GET /reports/{id}/actions/remote-check/{results,pdf}`,
  `POST /reports/{id}/actions/remote-check/{cancel,resend}` — the doc's
  remote-check lifecycle sub-resource, phase-2 (EPIC-12); `pdf` returns a
  stub payload, never a real PDF
- `GET/PATCH /users/company` — phase-2 (EPIC-11); no error-code evidence
  describes a company resource's own fields at all (only `company_id` as
  a foreign key elsewhere), so this is closer to invented than any other
  phase-2 sub-resource
- **Fault injection**: sending `X-LN-Replica-Force-Status: 500|502|503|504`
  on any request forces that status back immediately, with
  `{message, correlationId, injected: true}` — lets a client integrating
  against this replica test its own error handling without waiting for a
  real outage. Any other header value (missing, malformed, out of that
  set) is ignored and the request proceeds normally. Applies to literally
  every route, including `/up` and `/oauth/token`, since the check runs
  before `auth` — as a result, a forced fault never reaches `auth`, so it's
  never written to `ActivityLog` and never counted by the rate limiter
  (both keyed off `req.client`, which only `auth` sets). A global env var,
  `FAULT_INJECTION_ENABLED` (default `true`), disables the whole feature
  without a code change if ever needed. See `Run 4 - Fault Injection
  (Demo)` in the Postman collection for a live demonstration.

Each is called out in its owning epic's `spec.md` under "Resolved
conflicts".
