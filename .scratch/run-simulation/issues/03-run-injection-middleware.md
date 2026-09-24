# 03: Run injection middleware (the live feature)

**What to build:** The actual end-to-end behavior that makes a run useful: a real
request to any real endpoint, tagged with a run's ID via a header, gets its
outcome decided by that run's configured distribution — irrespective of whether
the request's own data is actually valid. A `200` roll lets the request through
to completely real, unmodified business logic. Every other roll short-circuits
with a fabricated response that's indistinguishable from the real thing a client
would otherwise receive for that status, and bypasses the real rate limiter
entirely. Every roll — real or fabricated — is tallied against the run created in
ticket 02, using the picker built in ticket 01.

This ticket also documents the feature as a replica-only extension, following the
same pattern already established for fault injection and client provisioning.

**Blocked by:** 01 (weighted-pick algorithm), 02 (run resource lifecycle)

**Status:** done

- [x] A request carrying a valid, active, same-client run's ID in the header gets an outcome decided by that run's distribution, independently, on every request.
- [x] A request with no such header is completely unaffected — proceeds exactly as it does today.
- [x] A request whose header names a run that doesn't exist, belongs to a different client, or is `CLOSED` is treated exactly like a request with no header at all (fails open, proceeds normally) — never errors because of an unrecognized or inapplicable run ID.
- [x] A `200`-rolled request proceeds through completely real, unmodified business logic and returns the genuine result for that request — not a synthetic placeholder.
- [x] A `500`/`502`/`503`/`504`-rolled request returns a response indistinguishable in shape from this replica's existing fault-injection responses for that same status.
- [x] A `429`-rolled request returns a response indistinguishable in shape from this replica's existing real rate-limiter response, including the same retry-hint header.
- [x] A `422`-rolled request returns a clearly generic, fixed error shape that a caller can recognize as run-fabricated rather than a real field-level validation failure.
- [x] A request that rolls `422`, `429`, or a `5xx` never reaches the real rate limiter or real business logic — see Comments for a caveat on how this was actually verified.
- [x] A `200`-rolled request still passes through the real rate limiter exactly as untagged traffic does — the bypass applies only to fabricated outcomes, not to genuinely successful ones.
- [x] Every roll made under a run — whether it resulted in a real pass-through or a fabricated short-circuit — is reflected in that run's tally, retrievable via `GET /runs/{id}` from ticket 02.
- [x] Tallying stays accurate under concurrent, high-volume traffic against the same run with no lost counts.
- [x] This behavior applies uniformly no matter which real endpoint the tagged request hits — it is not limited to one specific business route.
- [x] `CONTEXT.md` gains a new glossary entry for this concept, explicitly distinguishing it from the existing "QA override value" and "Fault injection" entries already there.
- [x] `planning/constitution.md` and `README.md`'s replica-only-extensions documentation are updated to describe this feature, following the same style already used for fault injection.
- [x] All of the above is covered by integration tests against the real running app, including cross-client isolation (a different client's token can't have any effect using another client's run ID).
- [x] The full existing test suite remains green after this change.

## Comments

Implemented as `src/middleware/runInjection.ts`, mounted in `app.ts` right
after `auth` and before `activityLog`/`rateLimiter`. Fabricated bodies match
fault injection's shape (5xx), the real rate limiter's shape (429, including
`Retry-After`), and a fixed generic shape (422, `errors._run` code 1319).
Tally increments use the same atomic-upsert pattern as
`PostgresRateLimitStore`. 14 new integration tests added to the existing
`tests/integration/runs.test.ts` (matching the spec's single-seam decision),
covering every criterion above. Full suite: 214/215 green (the 1 failure,
`seed.test.ts`, is a pre-existing, unrelated flaky timeout — it shells out to
`npx tsx` twice via `execSync` and occasionally exceeds its 5s default
timeout on this machine; confirmed unrelated by re-running with a longer
timeout, which passes in ~5.8s. Nothing in this ticket touches `seed.ts`).

**Caveat on the rate-limiter-bypass criterion**: the real rate limiter is
unconditionally skipped under `NODE_ENV=test` (set automatically by Vitest,
see `rateLimiter.ts`) — the same environmental constraint the rate limiter
feature itself already lives with (its own real 429 behavior was only ever
live-validated via Postman/Newman, never Vitest, per
`.scratch/error-handling-demo/spec.md`). So within this automated suite, the
real limiter literally cannot fire regardless of whether the bypass logic
works, which means "never an organic rate-limit rejection" can't be
meaningfully distinguished from "the real limiter was never going to fire
anyway" by an automated assertion. What the integration tests **do** prove:
a burst of 15 concurrent tagged requests under a 100%-weighted-429 run all
reliably get the run's own fabricated outcome, and the tally counts every
one accurately. Full confidence in the bypass specifically (i.e. that a
fabricated outcome is decided *before* the real limiter's middleware even
runs, not just that the real limiter happened not to fire) would need a live
Postman/Newman run against a real server with `NODE_ENV` unset — not done as
part of this ticket, flagged here rather than silently claimed.

### Follow-up: switched tally storage to an append-only event log

After this ticket shipped, a scaling question came up: at the ~100k-request
batch volumes this feature is meant for, the original `RunTally` design (one
shared row per `(run, status)`, atomically incremented via
`INSERT ... ON CONFLICT DO UPDATE`) would take an UPDATE lock on the same row
for every single tagged request — the exact contention shape
`RateLimitCounter` already has, only tolerable there because its real limit
is a mere 10 req/sec.

Replaced `RunTally` with an append-only `RunEvent` log (migration
`20260924111935_run_events_append_only`): the injection middleware now does
a plain `INSERT` per roll (nothing to contend on), and `GET /runs/{id}`
aggregates the log into a tally via `COUNT`/`GROUP BY` at read time instead.
No API or response-shape change — `tally` still comes back as the same
`{"200": N, "500": N, ...}` object; only the storage/aggregation mechanism
changed. All 14 tally-related tests in `tests/integration/runs.test.ts`
needed no changes and still pass. Full suite: 215/215 (the earlier
`seed.test.ts` timeout was confirmed to be pure environmental flakiness, not
a real failure — it passes reliably with a longer timeout).
