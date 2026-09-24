Status: ready-for-agent

# Configurable runs: percentage-driven response simulation across real API calls

## Problem Statement

Teams integrating against this replica need to prove their downstream systems handle
a realistic *mix* of outcomes at scale — not just one forced failure at a time. A
QA batch of ~100,000 real records might need to flow through several different
checks (credit, NFI/address verification, address lookup, etc.), and the team wants
to reliably see roughly 20% land on a 500, 20% on a 422, 10% on a 429, and the rest
succeed normally — then get back a report confirming that's actually what happened.

Today this replica has two related but insufficient mechanisms:

- **Fault injection** (`X-LN-Replica-Force-Status`, see `CONTEXT.md`) forces one
  exact 5xx status for exactly one request. It can't express a percentage mix across
  many calls, and it deliberately never touches `422`/`429`.
- The real rate limiter (`src/middleware/rateLimiter.ts`) produces real `429`s, but
  only as an organic side effect of actual request volume — it can't be dialed to
  "10% of this batch."

Neither lets a caller say "shape my traffic this way across this whole batch" and
then see the resulting tally, across multiple endpoints, on demand.

## Solution

A new **run** (see `CONTEXT.md`): a client-scoped, named response-distribution
profile.

- `POST /runs` creates a run from a percentage `distribution` across a fixed set of
  statuses (`200, 422, 429, 500, 502, 503, 504`, weights summing to 100) and an
  optional, purely informational `expected_requests` count. Returns a `run_id`.
- Any subsequent real request to any real endpoint — regardless of which one:
  credit, NFI, verification, address lookup, etc. — that carries
  `X-LN-Replica-Run-Id: <run_id>` gets its outcome decided by an independent
  weighted roll against that one flat distribution, applied irrespective of whether
  the request's own data is actually valid.
  - A `200` roll lets the request proceed through completely normal, real business
    logic — the actual result for that record.
  - A `422`/`429`/`5xx` roll short-circuits immediately, before real validation,
    before the real rate limiter, and before any real business logic — returning a
    fabricated response instead.
- A run never "runs out" and is never capped by `expected_requests` — it stays
  `ACTIVE`, rolling independently on every tagged request, until explicitly closed
  via `POST /runs/{id}/close`.
- `GET /runs/{id}` reports the running tally of actual outcomes served so far
  against the configured distribution and (informational) expected count.
- Runs are scoped to the creating client, the same tenancy model every other
  resource in this app already uses (reports, scorecards, report types).

## User Stories

1. As a QA engineer, I want to configure a percentage split of response outcomes for a batch of real calls, so I can prove my downstream system handles a realistic error mix at scale, not just one failure at a time.
2. As a QA engineer, I want to create a run once and get back a `run_id`, so I can reuse that single identifier across every call in my batch instead of reconfiguring per request.
3. As a QA engineer, I want to tag real requests with the run's ID via a header, so applying the simulation requires no change to my actual request bodies or business data.
4. As a QA engineer, I want the run's configured percentages to apply regardless of which endpoint I call under that run (credit, NFI, address verification, address lookup, etc.), so one run can cover a batch that spans several different checks.
5. As a QA engineer, I want a single flat distribution to apply uniformly across every endpoint in the run, not a separate distribution per endpoint, so configuring a run stays simple even when my batch spans multiple check types.
6. As a QA engineer, I want a request whose roll lands on `200` to go through completely real business logic, so successful outcomes in my test batch are genuinely accurate, not synthetic.
7. As a QA engineer, I want a request whose roll lands on `422`, `429`, or a 5xx to return that outcome regardless of whether my request data was actually valid, so I can reliably hit error paths using my real production-shaped data, not artificially broken payloads.
8. As a QA engineer, I want a fabricated `5xx` response to look exactly like a real fault-injected one (`message`, `correlationId`, `injected: true`), so my error-handling code can't distinguish a run-fabricated failure from a real one — meaning it's genuinely testing the same code path.
9. As a QA engineer, I want a fabricated `429` response to look exactly like the real rate limiter's response (`message`, `retry_after_seconds`, `Retry-After` header), so my retry/backoff logic is exercised identically to how it'd behave against real throttling.
10. As a QA engineer, I want a fabricated `422` to have a clearly-generic error shape distinct from real field-level validation errors, so I don't confuse it with a real validation bug in my request-building code while still exercising my client's generic-422-handling path.
11. As a QA engineer, I want fabricated `429`/`5xx`/`422` outcomes to bypass the real rate limiter entirely, so my configured percentages aren't polluted by organic throttling kicking in unpredictably on top of what I asked for.
12. As a QA engineer, I want the real rate limiter to still apply normally to genuinely successful (`200`-rolled) requests, so I still get realistic throttling behavior on the traffic that isn't being deliberately overridden.
13. As a QA engineer sending very high request volumes, I want a run to have no enforced cap or expiry, so a batch whose exact size I can't predict in advance (different record subsets need different checks) never gets artificially cut off mid-run.
14. As a QA engineer, I want to explicitly close a run when I'm done with it, so a stale `run_id` doesn't keep affecting traffic indefinitely by accident.
15. As a QA engineer, I want to query a run's progress at any time, so I can confirm the actual served tally is tracking my configured percentages before the batch finishes.
16. As a QA engineer, I want the progress report to show my original `expected_requests` alongside the actual tally, so I can visually compare what I planned against what's actually happened so far.
17. As a QA engineer working for one client/tenant, I want my runs to be invisible and unusable by other clients, so my load test can't leak into or be replayed by someone else's traffic.
18. As a QA engineer, I want an unrecognized or someone-else's `run_id` in the header to be silently ignored (request proceeds normally) rather than erroring, so a stale or mistyped header doesn't introduce a confusing new failure mode on top of whatever I'm actually testing.
19. As a developer maintaining this replica, I want run creation to validate that distribution weights sum to exactly 100 and only use the supported status set, so a malformed run config fails fast at creation time instead of producing confusing behavior later.
20. As a developer maintaining this replica, I want the weighted-outcome-picking logic to be a pure, independently testable function, so its correctness doesn't depend on spinning up the full HTTP stack to verify.
21. As a developer maintaining this replica, I want runs documented as a replica-only extension with no basis in the real IDU doc, so nobody mistakes the ability to force a `422` on valid data for transcribed doc behavior.
22. As a developer maintaining this replica, I want the distinction between a run, fault injection, and a QA override value captured in `CONTEXT.md`, so future contributors don't conflate three related-but-different simulation mechanisms.
23. As a QA engineer, I want the run's `distribution` and `expected_requests` I originally configured echoed back on both the creation response and the progress report, so I can confirm what's actually active without needing to keep my own separate record of it.
24. As a developer maintaining this replica, I want run state to persist in the same shared Postgres database every other resource uses, so run behavior is consistent across however many pods this replica is scaled to (mirroring the existing rate limiter's own multi-pod consistency requirement).
25. As a QA engineer, I want concurrent requests hammering the same run to be tallied accurately with no lost counts, so a high-throughput batch (~100k requests) still produces a trustworthy final report.
26. As a QA engineer, I want to be able to create more than one run at a time, so I can run independent, differently-configured batches in parallel without them interfering with each other.
27. As a QA engineer, I want a closed run's `run_id` to keep reporting its final tally via `GET /runs/{id}`, so I can still retrieve the batch's results after I've finished sending traffic.

## Implementation Decisions

- **Modules touched (new)**: `src/modules/runs/` (`schema.ts`, `service.ts`, `routes.ts` — same three-file shape as every other resource module in this app, e.g. `src/modules/clients/`); `src/middleware/runInjection.ts` (new middleware); `src/lib/runDistribution.ts` (new, pure weighted-pick logic); `prisma/schema.prisma` (new `Run` and `RunTally` models); `src/app.ts` (wiring); `planning/constitution.md` and `README.md` (documentation, same "replica-only extension" pattern as fault injection); `CONTEXT.md` (new glossary term).
- **Schema — `Run`**: `id` (uuid), `clientId` (FK, same tenancy pattern as `Report`/`Scorecard`), `distribution` (JSON array of `{status, weight}`), `expectedRequests` (nullable int, informational only), `status` (`ACTIVE` | `CLOSED`), `createdAt`, `closedAt` (nullable).
- **Schema — `RunTally`**: one row per `(runId, status)` pair, atomically incremented on every roll — same "Postgres-backed, atomic upsert" pattern `PostgresRateLimitStore` (`src/middleware/rateLimitStore.ts`) already uses for exactly this kind of high-concurrency counter, chosen over an in-memory counter for the same multi-pod-consistency reason.
- **`POST /runs`**: body `{ distribution: [{status, weight}, ...], expected_requests?: number }`. Validates: `distribution` non-empty; every `status` is one of `200, 422, 429, 500, 502, 503, 504`; no duplicate status entries; weights sum to exactly 100; `expected_requests`, if present, is a positive integer. No real doc code exists for this replica-only resource, so validation failures use the same generic catch-all (1319) `POST /clients`'s own schema already uses for the same reason. Returns `201` with `{data: {run_id, distribution, expected_requests, status: "ACTIVE", created_at}}` (Laravel-style envelope, same as every other resource-creation endpoint in this app).
- **`GET /runs/{id}`**: returns `{data: {run_id, distribution, expected_requests, status, tally, created_at, closed_at}}`, where `tally` is an object keyed by status code string to count so far (e.g. `{"200": 21159, "500": 8464, "422": 8463, "429": 4232}`), built from the `RunTally` rows. 404 if the run doesn't exist or belongs to a different client (same not-found-for-other-tenant convention every other resource in this app already follows).
- **`POST /runs/{id}/close`**: sets `status: CLOSED`, `closedAt: now()`. A closed run's `run_id` is no longer matched by `runInjection` (tagged requests proceed as if untagged) but its tally remains queryable via `GET /runs/{id}` indefinitely.
- **Header**: `X-LN-Replica-Run-Id`, read via `req.header(...)` — same naming convention as `X-LN-Replica-Force-Status` and `X-LN-Replica-Provision-Key`.
- **`runInjection` middleware placement**: mounted in `app.ts` immediately after `auth` (needs `req.client` to enforce per-client `run_id` ownership — unlike fault injection, which deliberately runs *before* `auth`) and *before* `activityLog`/`rateLimiter` and every business router. This means a fabricated `422`/`429`/`5xx` outcome bypasses the real rate limiter and real business logic entirely, exactly like fault injection already bypasses them (for the same architectural reason: mounted early in the chain) — but a `200`-rolled request continues on through the real chain, including the real rate limiter, unaffected.
- **Lookup/fail-open behavior**: header absent → `next()` immediately, no lookup. Header present but the run doesn't exist, belongs to a different client, or is `CLOSED` → treated identically to "header absent" (`next()`, request proceeds completely normally) — same fail-open philosophy fault injection already documents for an out-of-whitelist value, applied here to an unrecognized/inapplicable `run_id`.
- **Weighted-pick algorithm** (`src/lib/runDistribution.ts`): a pure function, e.g. `pickOutcome(distribution: {status: number; weight: number}[], rng: () => number = Math.random): number` — computes a cumulative-weight roll (`rng() * 100`, walking the distribution summing weights until the roll falls under the running total) and returns the chosen status. Accepting an injectable `rng` (defaulting to `Math.random`) is what makes this independently unit-testable without flakiness — the same dependency-injection technique this app already applies to its determinism engine (`src/lib/determinism.ts`'s seeded `chance()`), except here the outcome is genuinely non-deterministic per call by design (a run has no per-subject/per-record seed — each tagged request is an independent roll), so the tests supply fixed `rng` values rather than a seed.
- **Fabricated response bodies** (indistinguishable from the real thing a client would otherwise receive):
  - `500/502/503/504` → exactly fault injection's existing shape: `{message, correlationId, injected: true}`, using the same fixed per-code message strings fault injection already defines.
  - `429` → exactly the real rate limiter's existing shape: `{message: 'Too many requests — rate limit exceeded for this client.', retry_after_seconds: 1}`, with the same `Retry-After: 1` response header the real limiter already sets.
  - `422` → a fixed generic shape distinct from real field-validation errors: `{"message": "The request contains invalid parameters", "errors": {"_run": [{"code": 1319, "message": "The request contains invalid parameters"}]}}`.
- **Tally increment**: on every roll (whether it results in a real pass-through or a fabricated short-circuit), `runInjection` atomically increments that run's `RunTally` row for the resulting status before either calling `next()` (200) or writing the fabricated response (everything else) — so the tally always reflects every roll made under that run, including the ones that led to real, successful processing.
- **No cap, no auto-expiry**: `expected_requests` is never read by `runInjection` — it exists purely for the human-readable comparison on `GET /runs/{id}`. A run rolls forever until `POST /runs/{id}/close` is called.
- **No per-endpoint distribution**: a run has exactly one flat `distribution`, applied identically no matter which endpoint the tagged request hits. There is no `endpoint` field on the run config at all.
- **Documentation**: added to `README.md`'s "Known replica-only extensions" list and `planning/constitution.md` (a new dedicated section, same style as its existing "Fault injection" section). `CONTEXT.md` gains a new **Run** glossary entry, explicitly cross-referencing and distinguishing it from the existing **QA override value** and **Fault injection** entries (a QA override value forces a *business* outcome for one subject's data; fault injection forces *one* request's transport-level response to fail; a run forces a *percentage mix* of transport-level outcomes across *many* requests spanning *any* endpoint, for as long as it stays active).
- **No ADR**: following this repo's own established precedent (`.scratch/fault-injection/spec.md` explicitly declined one for a comparably novel mechanism), this doesn't clear the "hard to reverse" bar — the new tables/middleware can be dropped without migration cost to anything else — so the decision is documented in this spec plus `CONTEXT.md`/`planning/constitution.md` prose instead.

## Testing Decisions

- **Two seams, matching the two kinds of logic being added** (per explicit developer request for unit coverage in addition to the integration seam):
  1. **HTTP-level integration tests via `supertest` against the real `createApp()`** — the same seam every other module in this repo uses (`tests/integration/*.test.ts`). New file: `tests/integration/runs.test.ts`. This is the *only* seam that can actually confirm the middleware's real position in the chain (after `auth`, before `rateLimiter`/business routes) and the real bypass behavior — matching exactly why `faultInjection.test.ts` chose this seam over an isolated-mini-app pattern.
  2. **Pure unit tests for the weighted-pick logic** — new file `tests/unit/runDistribution.test.ts`, following `tests/unit/scoring-engine.test.ts`'s existing precedent for testing pure, non-HTTP logic in isolation. Tests supply fixed `rng` values (e.g. `() => 0`, `() => 0.999`, boundary values exactly on a cumulative-weight edge) to assert deterministic bucket selection without any statistical flakiness.
- **What makes a good test here**: integration tests assert observable HTTP behavior (status code, response body shape, bypass of real validation/rate-limiting) against real routes — never the middleware's internal implementation. Unit tests assert the pure function's output for a given distribution + injected random value — never anything about HTTP, Express, or persistence.
- **Integration cases to cover**: creating a run (success + each validation failure: bad weight sum, invalid status, empty distribution); a `run_id` forcing each of the 7 supported statuses correctly on a real business endpoint; a `200` roll producing a genuinely real result (e.g. a real address-verification response, not a stub); an unrecognized/foreign-client/closed `run_id` being silently ignored (request proceeds normally); a fabricated `429`/`5xx`/`422` bypassing the real rate limiter (send well over 10 req/sec under a run configured for 100% one of those statuses, confirm no real 429 ever appears, only the run's own configured one); `GET /runs/{id}` reflecting an accurate tally after a batch of tagged requests; `POST /runs/{id}/close` making the run inert; cross-client isolation (client B's token can't use client A's `run_id`).
- **Unit cases to cover**: a roll near 0 selects the first distribution entry; a roll near 1 (scaled to 100) selects the last; a roll exactly on a cumulative-weight boundary is assigned to the correct adjacent bucket (pick one convention — e.g. inclusive lower bound — and test it); a single-entry 100%-weighted distribution always returns that one status regardless of the roll.
- **Prior art**: `tests/integration/faultInjection.test.ts` (header-triggered short-circuit, bypass-of-downstream-middleware pattern) and `tests/integration/clients.test.ts` (resource-creation-returns-usable-credentials pattern, cross-client isolation pattern) are the direct templates for the integration file. `tests/unit/scoring-engine.test.ts` (pure-function testing with injected inputs, no HTTP) is the direct template for the unit file.
- **Full-suite regression**: re-run `npx vitest run` after the change; no existing test should be affected, since `runInjection` only ever acts when the header is explicitly present and resolves to a real, owned, active run.

## Out of Scope

- Per-endpoint distributions within a single run — explicitly decided against; one flat distribution applies to every endpoint a run's traffic touches.
- An exact pre-shuffled queue of outcomes guaranteeing precise counts (e.g. exactly 20,000 of 100,000) — not feasible since total call volume per run isn't known upfront (different record subsets need different checks), so outcomes are independently rolled per request instead; the percentage is a statistical target, not a guaranteed exact tally.
- Any cap, auto-expiry, or time-window on a run — explicitly decided against; a run stays active until manually closed.
- Bypassing the real rate limiter for `200`-rolled requests — explicitly decided against; only fabricated `422`/`429`/`5xx` outcomes bypass it.
- Making a run's real-outcome (`200`) requests distinguishable in any way from traffic sent without a `run_id` — a `200` roll is genuinely indistinguishable from normal, untagged traffic aside from being counted in the run's tally.
- A response-body override mechanism letting the caller customize the fabricated bodies' contents — the fixed shapes described above are sufficient for the stated purpose, matching fault injection's own precedent of fixed per-code messages.
- Any status codes outside `200, 422, 429, 500, 502, 503, 504` — no other 4xx (401/403/404/etc.), no other 5xx (505/507/etc.).
- An ADR — see "No ADR" under Implementation Decisions.
- Rate-limiting or otherwise capping how many runs a client can create, or how many can be `ACTIVE` at once.
- A UI or Postman demo folder for this feature (unlike the fault-injection spec, which added a Postman demo run) — not requested; can be added later if wanted.

## Further Notes

- Full design was reached via a `/grill-with-docs` interview earlier in this thread; every decision above reflects an explicit, confirmed answer from the developer, not an assumption. Two decisions are genuine, deliberate departures from this repo's own prior precedent and are called out as such: fabricating `422`/`429` outcomes irrespective of real request data (fault injection deliberately never does this), and a mechanism whose effects span many requests and multiple endpoints rather than exactly one request (also unlike fault injection).
- `CONTEXT.md` currently has exactly two terms (**QA override value**, **Fault injection**); this spec's implementation work should add **Run** as the third, written to explicitly cross-reference and distinguish it from both existing entries per the domain-modeling discipline already used to write them.
- A future iteration could add the triggering `run_id` into fabricated response bodies for easier client-side traceability (not decided here — the agreed body shapes above are exact, additive changes to them weren't discussed).
- This repo's convention (per `planning/constitution.md` and prior specs like `.scratch/fault-injection/spec.md`) is ticket-by-ticket delivery. This spec is larger than the fault-injection one (two new Prisma models, a new module, a new middleware, two new test files) — worth splitting into tickets via `/to-tickets` rather than picked up as a single ticket.
