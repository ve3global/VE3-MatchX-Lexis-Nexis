Status: ready-for-agent

# On-demand fault injection: caller-triggered 5xx responses for client resilience testing

## Problem Statement

Teams integrating against this replica need to prove their client code handles the
real IDU API failing — a 500, a gateway timeout, a service outage — not just the
happy path and validation errors. Today there is no way to make this replica return
a 5xx on demand: every response is either a real success or a real validation/auth
failure driven by the request's own data. A developer who wants to test "does my
client retry on a 503?" or "does my client stop retrying on a 500?" has no lever to
pull, and nothing to show in a live demo either.

## Solution

A new **fault injection** mechanism (see `CONTEXT.md`), deliberately distinct from
the existing **QA override value** pattern (`planning/constitution.md`'s determinism
engine): where a QA override value forces a specific *business* outcome for one
subject's data, fault injection forces the *transport-level response itself* to fail,
for any request, regardless of body content.

- A caller sets a request header, `X-LN-Replica-Force-Status`, to one of `500`,
  `502`, `503`, `504`. The response for that single request short-circuits with the
  requested status and a body shaped like the real error handler's, plus an
  `injected: true` marker.
- Any other header value (missing, malformed, out of the whitelist) is ignored —
  the request proceeds completely normally. Fault injection fails open by design.
- A new env var, `FAULT_INJECTION_ENABLED` (default `true`), is a global kill switch:
  when `false`, the header is ignored exactly like an invalid value, with no code
  change required to disable it.
- The check is mounted before `auth`, so it applies to literally every route,
  including `/up` and `/oauth/token` — the two routes everything else in the
  middleware chain exempts.
- A new standalone Postman demo folder (`Run 4 - Fault Injection (Demo)`) exercises
  the feature live, following the same pattern as the existing Run 1–3 demo folders.

## User Stories

1. As a developer integrating against this replica, I want to force a specific 5xx
   status code on demand, so I can verify my client's error-handling logic without
   waiting for a real outage.
2. As a developer, I want to choose between 500, 502, 503, and 504 specifically, so
   I can test that my client's retry logic correctly distinguishes them (e.g.
   respecting `Retry-After` on 503, not retrying on 500).
3. As a developer, I want the trigger to be a plain request header rather than a
   stateful toggle, so the effect is scoped to exactly the one call I'm making and
   automatically reverts — no cleanup step, no risk of forgetting to turn it off.
4. As a developer sharing a dev/staging deployment of this replica with other teams,
   I want fault injection to be entirely per-request, so my testing can never leak
   into someone else's concurrent test run against the same instance.
5. As a developer, I want an unrecognized or malformed header value to be silently
   ignored rather than erroring, so a typo in my test setup doesn't produce a new,
   confusing failure mode on top of the one I'm already testing.
6. As a developer, I want the response body to still include a `correlationId`, so
   an injected fault is traceable through logs the same way a real error is.
7. As a developer or operator reading server logs, I want an injected fault's
   response body to carry an `injected: true` marker, so it's unambiguous that the
   failure was deliberately triggered, not a real bug.
8. As a developer, I want fault injection to work on literally any endpoint,
   including unauthenticated ones (`/up`, `/oauth/token`), so I can test how my
   client handles a failed health check or a failed token acquisition, not just
   failures on already-authenticated business calls.
9. As an operator running this replica in a shared environment, I want a global env
   var that disables fault injection entirely, so I can shut the capability off
   instantly without a code change or redeploy if it's ever misused.
10. As a developer, I want the env var to default to enabled, so the feature works
    out of the box in normal local/dev/test use without extra setup.
11. As a developer, I want fault injection to remain active when running the
    automated test suite (`NODE_ENV=test`), unlike the rate limiter, so the feature
    itself can be covered by an automated integration test.
12. As a developer, I understand that an injected fault bypasses `ActivityLog`
    (which requires `req.client`, set by `auth`, which runs after this check) and
    bypasses the rate limiter's per-request counting, and I accept this as a
    documented trade-off in exchange for the fault firing on every route.
13. As a developer maintaining this replica, I want fault injection documented as a
    replica-only extension with no basis in the real IDU doc, so nobody mistakes it
    for a transcribed doc requirement.
14. As an internal stakeholder watching a live demo, I want to see the API forced
    into each of the four supported 5xx codes on request, so I can see the failure
    modes a real integration would need to handle.
15. As an operator running the demo, I want the fault-injection demo run to be
    standalone (acquires its own token, runnable independently), consistent with
    Run 1–3, so I can run it in any order without setup dependencies.
16. As an operator running the demo, I want one request in the fault-injection run
    to target an unauthenticated route (`/up`) with the header set, so the demo
    visibly proves the "applies before auth" behavior described above, not just
    the authenticated-route case.
17. As an operator running the demo, I want one request with an out-of-whitelist
    header value, asserting a normal 200 comes back, so the demo also proves the
    fail-open behavior, not only the successful-injection cases.
18. As a QA engineer, I want the existing full test suite to remain green after this
    change, so I know fault injection doesn't regress any existing behavior.

## Implementation Decisions

- **Modules touched**: new `src/middleware/faultInjection.ts`; `src/app.ts` (mounted
  immediately after `correlationId` and before `auth` — the first middleware in the
  chain to see the request); `src/config/env.ts` (new `faultInjectionEnabled` flag);
  `scripts/generate-postman-collection.ts` (new demo folder + a small `RequestSpec`
  extension); `README.md` and `planning/constitution.md` (documentation).
- **Header**: `X-LN-Replica-Force-Status`. Read via `req.header(...)`, case-insensitive
  per HTTP/Express convention (no special handling needed).
- **Whitelist**: exactly `500`, `502`, `503`, `504`, parsed as an integer. Any header
  value outside this set — absent, non-numeric, or a syntactically valid but
  unsupported code (e.g. `404`) — is treated as if the header were absent, and the
  request continues through the rest of the middleware chain unmodified.
- **Kill switch**: `env.faultInjectionEnabled`, sourced from `FAULT_INJECTION_ENABLED`,
  defaulting to `true` when unset (`process.env.FAULT_INJECTION_ENABLED !== 'false'`).
  When `false`, the middleware behaves exactly as it does for an invalid header value
  — request proceeds normally, no error surfaced.
- **Response shape**: `{ message, correlationId, injected: true }`. `correlationId`
  comes from `req.correlationId`, set by the `correlationId` middleware that must run
  before this one. `message` is a fixed per-code string: `Internal server error` (500,
  reusing `errorHandler`'s existing text verbatim), `Bad gateway` (502), `Service
  unavailable` (503), `Gateway timeout` (504). `injected: true` is an additive field,
  the same pattern as `auth.ts`'s additive `reason` field on 401 bodies.
- **Middleware ordering trade-off**: mounting before `auth` means a forced fault never
  reaches `auth`, so `req.client` is never set for that request. Downstream,
  `activityLog` (`src/middleware/activityLog.ts`) only writes a row when `req.client`
  is set, so injected faults never appear in `ActivityLog`; the rate limiter never
  counts them either, since it's also mounted after `auth`. This is an accepted,
  documented trade-off in exchange for the header working on every route, including
  the two (`/up`, `/oauth/token`) that are otherwise exempt from auth entirely.
- **Test-mode behavior**: unlike `rateLimiter` (which skips entirely under
  `NODE_ENV=test`), this middleware has no `NODE_ENV` special-casing — it only ever
  acts when a caller explicitly sends the header, so there's no risk of interfering
  with the existing suite, and the feature can be exercised directly by an automated
  test.
- **Postman generator extension**: `RequestSpec` (in `scripts/generate-postman-collection.ts`)
  gains a new optional field, `headers?: Record<string, string>`; `buildItem` pushes
  any entries from it into the request's header array alongside the existing
  `Content-Type`/`Authorization` handling. This is the only structural change needed
  to the generator itself.
- **Postman demo folder**: `Run 4 - Fault Injection (Demo)`, standalone (own
  `POST /oauth/token` step), following Run 1–3's structure. Requests: one call per
  whitelisted code (500/502/503/504) against an authenticated GET endpoint (e.g.
  `GET /report-types`) asserting the forced status and `injected: true` in the body;
  one call to `GET /up` with the header set, asserting the forced status on an
  unauthenticated route; one call with an out-of-whitelist value (e.g. `404`)
  asserting a normal `200` comes back unaffected.

## Testing Decisions

- **Seam**: HTTP-level integration tests via `supertest` against the real
  `createApp()` — the same seam used by all 18 existing files in
  `tests/integration/*.test.ts`. New file: `tests/integration/faultInjection.test.ts`.
  Chosen over `errorHandler.test.ts`'s isolated-mini-app pattern deliberately: this
  feature's whole point is its position in the real middleware chain (before `auth`),
  which only a test against the real, fully-wired app can actually confirm.
- **What makes a good test here**: assert observable HTTP behavior (status code,
  response body shape) against real routes, not the middleware's internal
  implementation.
- **Cases to cover**: each whitelisted code (500/502/503/504) returned correctly on
  an authenticated route; the header working on `/up` and `/oauth/token`
  (unauthenticated, pre-`auth` routes); an out-of-whitelist value being ignored
  (request succeeds normally); the header absent (baseline, unaffected); the kill
  switch (`FAULT_INJECTION_ENABLED=false`) causing the header to be ignored —
  exercised by importing and re-mounting the middleware with the env var set for
  that one test, since `createApp()` reads `env` at call time.
- **Prior art**: `tests/integration/errorHandler.test.ts`'s assertions on status,
  `message`, and `correlationId` shape are the direct template for asserting the
  injected-fault body shape. `tests/integration/health.test.ts` is the existing
  precedent for hitting `/up` in an integration test.
- **Full-suite regression**: re-run `npx vitest run` after the change; no existing
  test should be affected, since fault injection only fires when the header is
  explicitly present.
- **Live validation**: run the new `Run 4` Postman folder via Newman against a live
  `npm run dev` instance, same as the existing Run 1–3 folders were validated.

## Out of Scope

- Any change to the QA override value mechanism or the determinism engine — fault
  injection is a categorically separate concept (see `CONTEXT.md`) and touches none
  of `planning/constitution.md`'s existing determinism logic.
- Making injected faults visible in `ActivityLog` or counted by the rate limiter —
  explicitly decided against as part of the middleware-ordering trade-off above, in
  favor of the header applying to every route.
- A response-body override mechanism (letting the caller also control the `message`
  text or add custom fields) — the four fixed per-code messages are sufficient for
  the stated purpose; not building a general-purpose response templating feature.
- Any status codes outside `500`/`502`/`503`/`504` — no 4xx codes, no other 5xx codes
  (e.g. 505, 507) — those aren't meaningful failure modes a real client integration
  would need to specifically distinguish for this replica's purposes.
- Rate-limiting or otherwise throttling use of the fault-injection header itself —
  the kill switch is the only control surface; no per-client usage caps.
- An ADR — this decision is easily reversible (the middleware can be moved or
  removed without migration cost) and, while it involves a real trade-off, doesn't
  clear the bar for "hard to reverse," so per `domain-modeling`'s guidance it's
  documented in prose (README, `planning/constitution.md`) rather than as an ADR.

## Further Notes

- Full design was reached via a `/grill-with-docs` interview earlier in this thread;
  every decision above reflects an explicit, confirmed answer, not an assumption.
- `CONTEXT.md` was created this session (this repo had none before) with two terms:
  **QA override value** and **fault injection**, capturing the distinction that
  motivated several of the decisions above.
- This repo's convention (per `planning/constitution.md` and prior specs like
  `.scratch/error-handling-demo/spec.md`) is ticket-by-ticket delivery, but this
  spec is small enough — one middleware file, one config addition, one generator
  extension, two doc updates — to be picked up as a single ticket, not split
  further.
