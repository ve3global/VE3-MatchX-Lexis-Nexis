Status: done

# Rate limiter: fix clock-skew over-throttling, make the limit configurable, add a throttle mode

## Problem Statement

Clients integrating against this replica (MatchX's data-verification flow in
particular) are frequently getting `429`s. There are three contributing causes,
and there's no way to separate them:

1. **Clock-skew bug in `PostgresRateLimitStore`** (`src/middleware/rateLimitStore.ts`).
   `reset_at` is set by Postgres's clock (`now()`), but the sliding-window weight
   is computed in Node with the pod's own clock:
   `fractionRemaining = Math.max(0, (row.reset_at.getTime() - Date.now()) / windowMs)`.
   There is no upper clamp. If a pod's clock is behind the DB's, `fractionRemaining`
   exceeds `1` and the previous window's count is multiplied by more than 1. At
   ~500ms of skew, a client sending a steady 6–7 req/s can be throttled even though
   the limit is 10 req/s. That's over-throttling that looks random.
2. **The limit is hard-coded at 10 req/s per client** (`src/middleware/rateLimiter.ts`).
   One data verification is several sequential calls (address lookup → report →
   scorecard → action), all counted against the same client. A few verifications
   in parallel, plus any retries, go past 10/s. Changing the limit today needs a
   code change and a deploy.
3. **Run-fabricated `429`s and real ones get mixed together.** A request tagged
   with `X-LN-Replica-Run-Id` for an `ACTIVE` run with a `429` weight gets a `429`
   that is byte-identical to the real limiter's response (by design, see
   `.scratch/run-simulation/spec.md` story 9). The real limiter also keeps
   applying to a run's `200`-rolled traffic (story 12). So in a high-volume QA
   batch, real throttling adds extra `429`s on top of the run's configured
   percentage, and nobody can tell which `429`s came from where.

## Solution

- Compute the sliding-window weight entirely inside Postgres, against the DB's own
  `now()`, and clamp the remaining fraction to `[0, 1]`. Pod clocks are no longer
  involved at all.
- Read the per-client limit from a new env var, `RATE_LIMIT_PER_SECOND`. It
  falls back to `10` (the current behavior) when unset or invalid, since the
  real limiter is the primary use.
- Add a deployment-level throttle mode, env var `THROTTLE_MODE`, with values
  `limiter | run`:
  - `limiter` (the fallback, and the primary use): the real rate limiter
    applies as it does today. Runs still work as before.
  - `run`: the real rate limiter is bypassed entirely, so the only `429`s
    that deployment produces come from simulation runs. That keeps a run's
    configured percentages clean.
- No new response header. `429` responses stay exactly as they are today.

## User Stories

1. As a client integrating against this replica, I want to be throttled only when I actually exceed the configured limit, so steady traffic below the limit never gets spurious `429`s.
2. As a developer operating this replica across multiple pods, I want rate-limit accounting to be independent of each pod's system clock, so NTP drift between pods and the DB can't change who gets throttled.
3. As an operator, I want to change the per-client limit via an env var without a code change, so I can size it to real MatchX verification traffic.
4. As an operator, I want the default limit to stay at 10 req/s when the env var is unset, so existing deployments and the Postman demo keep behaving exactly as they do today.
5. As an operator, I want an invalid `RATE_LIMIT_PER_SECOND` (non-numeric, zero, negative, non-integer) to fall back to 10 with a logged warning, so a typo can never disable throttling or take the app down.
6. As an operator, I want the real rate limiter to be on by default (`THROTTLE_MODE` unset → `limiter`), so throttling is never switched off by accident.
7. As an operator running a QA/simulation environment, I want to set `THROTTLE_MODE=run` to bypass the real limiter, so every `429` there is known to be run-fabricated and a run's configured percentages aren't polluted by organic throttling.
8. As an operator, I want an invalid `THROTTLE_MODE` value to fall back to `limiter` with a logged warning, so a typo keeps throttling on rather than disabling it.
9. As a platform owner, I want the mode to be deployment config only, never a request header, so callers can't opt themselves out of rate limiting.
10. As a QA engineer using runs, I want run-fabricated `429`s to stay identical to the real limiter's (body and `Retry-After`) in both modes, so my retry/backoff logic is exercised exactly as before.
11. As a developer maintaining this replica, I want the store's weighting logic covered by tests that run against the real Postgres, since that's where the fix lives and the bug came from a Node/DB split.

## Implementation Decisions

- **Modules touched**: `src/middleware/rateLimitStore.ts` (weighting moves into SQL), `src/middleware/rateLimiter.ts` (configurable limit, throttle mode), a small pure config parser (e.g. `src/lib/rateLimitConfig.ts`), `README.md` and `planning/constitution.md` (document both env vars), `.env.example` if present. `src/middleware/runInjection.ts` is **not** changed.
- **Store fix**: the single upsert keeps its current shape (atomic, one statement, same `count`/`prev_count`/`reset_at` transitions), but its `RETURNING` clause also computes the weighted total in SQL, e.g.
  `count + floor(prev_count * LEAST(1, GREATEST(0, EXTRACT(EPOCH FROM (reset_at - now())) * 1000 / windowMs)))::int AS total_hits`.
  `increment()` returns `total_hits` directly, with `resetTime: reset_at`. `Date.now()` is no longer used in the store. `decrement`/`resetKey` are unchanged. No schema migration.
- **Configurable limit**: `RATE_LIMIT_PER_SECOND`, positive integer, fallback `10` (a named constant, e.g. `DEFAULT_RATE_LIMIT_PER_SECOND = 10`). Read via `process.env` directly (same reason `faultInjection.ts` does: `rateLimiter.ts` is in `app.ts`'s import graph, which the no-DB doc-parity test imports without `DATABASE_URL`, so the shared `env` object can't be used). Parsed once at module load by a pure function, e.g. `parseRateLimit(raw: string | undefined): number`. Unset or empty → `10`, silently. Invalid (non-numeric, `0`, negative, non-integer) → `10`, plus a warning log naming the rejected value. It never throws. `windowMs` stays `1000`.
- **Throttle mode**: `THROTTLE_MODE`, values `limiter | run`, fallback `limiter` (a named constant, e.g. `DEFAULT_THROTTLE_MODE = 'limiter'`). Read via `process.env` for the same reason as above, and parsed once at module load by a pure function, e.g. `parseThrottleMode(raw: string | undefined): 'limiter' | 'run'`. Unset or empty → `limiter`, silently. Any other value → `limiter`, plus a warning log naming the rejected value. Matching is case-insensitive and ignores surrounding whitespace. It never throws.
  - `limiter`: current behavior. `runInjection` still short-circuits fabricated outcomes before the limiter, and `200`-rolled run traffic still goes through the real limiter (run spec stories 11–12 unchanged).
  - `run`: the real limiter's `skip` returns `true` for every request, so no real `429`s are produced. `runInjection` is unaffected. Run-tagged traffic gets its configured mix, and untagged traffic is not throttled. This deliberately switches off run spec story 12 ("real limiter still applies to `200`-rolled requests"), but only in deployments that opt in.
  - Deployment-level only: no request header, no per-client override.
- **Testable limiter**: export a factory, `createRateLimiter({ limit, skip })`, and keep the existing `rateLimiter` export as `createRateLimiter({ limit: <parsed limit>, skip: () => NODE_ENV === 'test' || <parsed mode> === 'run' })`. That way tests can build a limiter that isn't skipped, without changing production behavior.
- **No response header**: `429` bodies and headers from both the real limiter and runs are unchanged. The run spec's "indistinguishable `429`" intent is fully preserved.
- **Documentation**: `README.md`'s replica-only extensions list gains `RATE_LIMIT_PER_SECOND` and `THROTTLE_MODE` (next to `FAULT_INJECTION_ENABLED`). `planning/constitution.md`'s rate-limiter and run sections describe the `run` mode and its departure from run spec story 12.
- **No ADR**: easily reversible, no migration. Same precedent as `.scratch/fault-injection/spec.md`.

## Testing Decisions

- **Store (integration, real Postgres)**: new `tests/integration/rateLimitStore.test.ts` exercising `PostgresRateLimitStore` directly (no HTTP). Cases: counts increment within a window; a new contiguous window carries `prev_count` and the weighted total is never greater than `count + prev_count`; an idle gap longer than one window resets `prev_count` to 0; **skew regression**: with a row whose `reset_at` is set far in the future relative to `now()` (simulating a DB clock ahead of the pod), `totalHits` never exceeds `count + prev_count`. The current code fails this test and the fix passes it. Use a unique key per test, same isolation approach the other integration tests use.
- **Limiter (integration, HTTP)**: new `tests/integration/rateLimiter.test.ts` mounting `createRateLimiter({ limit: 3, skip: () => false })` on a minimal authed route, or on `createApp()` if the factory can be injected cleanly. Cases: the (limit+1)th request in a second gets `429` with the existing body and `Retry-After: 1`; requests under the limit pass; a limiter built with the `run`-mode skip (`skip: () => true`) lets well over the limit through with no `429`.
- **Env parsing (unit)**: `tests/unit/rateLimitConfig.test.ts`.
  - `parseRateLimit`: unset/empty → 10; valid integer → that value; `0`, `-1`, `abc`, `2.5` → 10 (and never throws).
  - `parseThrottleMode`: unset/empty → `limiter`; `limiter`/`run` (any case, padded) → that value; `off`, `bypass`, `xyz` → `limiter` (and never throws).
- **Runs**: no changes to `tests/integration/runs.test.ts`; its existing `429` assertions must still pass unmodified.
- **Full-suite regression**: `npx vitest run`. The default limiter is still skipped under `NODE_ENV=test`, so no existing test should change behavior.

## Out of Scope

- Changing the window length (stays 1s) or the algorithm (stays sliding-window counter).
- Per-client or per-endpoint limits, or exempting specific endpoints (e.g. verification) from limiting.
- Client-side retry/backoff changes in MatchX. That lives in the MatchX codebase, not here.
- Any response header labeling a `429`'s source. It was considered and dropped in favor of the deployment-level `THROTTLE_MODE`.
- Setting the throttle mode per request or per client.
- A mode that disables runs' fabricated `429`s. Runs behave the same in both modes.
- Auto-closing stale runs or warning about them.
- Returning `RateLimit-*` headers from runs' fabricated `429`s.

## Further Notes

- Root-cause diagnosis came from a code read, not a live repro. The local DB wasn't running, so real skew and counter rows weren't inspected. A QA environment running with `THROTTLE_MODE=run` shows how many `429`s come from runs alone.
- Small enough for one or two tickets: (1) store fix + configurable limit + tests, (2) `THROTTLE_MODE` + docs. Split via `/to-tickets` if preferred, per the ticket-by-ticket convention.
