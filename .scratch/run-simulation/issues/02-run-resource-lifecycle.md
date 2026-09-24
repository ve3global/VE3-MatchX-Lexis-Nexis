# 02: Run resource lifecycle (create, fetch, close)

**What to build:** The `Run` resource itself, end to end — schema, API, and tests —
independent of whether anything actually rolls outcomes against it yet (that's
ticket 03). A caller can create a run with a percentage distribution, fetch its
current state (including a tally that reads all-zero until ticket 03 lands),
and explicitly close it.

This introduces the `Run` and `RunTally` persistence, scoped to the creating
client the same way every other resource in this app already is (reports,
scorecards, report types) — another client can't see or use a run that isn't
theirs.

**Blocked by:** None (can start immediately — no dependency on ticket 01)

**Status:** done

- [x] `POST /runs` creates a run from a `distribution` (list of `{status, weight}`) and an optional, purely informational `expected_requests` count, returning a generated `run_id` and the run's initial state (`status: ACTIVE`, all-zero tally).
- [x] Only the status codes `200, 422, 429, 500, 502, 503, 504` are accepted in a distribution entry; anything else is rejected.
- [x] A distribution's weights must sum to exactly 100; a mismatched sum is rejected with a clear validation error.
- [x] An empty distribution, or a distribution with a duplicate status entry, is rejected.
- [x] `expected_requests`, if provided, must be a positive integer; it is never treated as an enforced cap anywhere in this ticket.
- [x] `GET /runs/{id}` returns the run's `distribution`, `expected_requests`, `status`, tally (all-zero at this stage), and timestamps.
- [x] `GET /runs/{id}` returns not-found for a run that doesn't exist, or that belongs to a different client than the caller — a run is never visible cross-client.
- [x] `POST /runs/{id}/close` transitions the run to `status: CLOSED` and records a close timestamp; the run and its tally remain fetchable afterward via `GET /runs/{id}`.
- [x] `POST /runs/{id}/close` is scoped the same way — a client can't close another client's run.
- [x] Validation failures use this app's standard structured error-body shape, consistent with how every other replica-only extension resource (e.g. client provisioning) handles validation with no real doc-transcribed code available.
- [x] All of the above is covered by integration tests against the real running app, following the existing pattern used for every other resource module in this codebase (e.g. the client-provisioning tests).

## Comments

Implemented as `src/modules/runs/{schema,service,routes}.ts`, new `Run`/
`RunTally` Prisma models (migration `20260924062150_add_runs`), mounted in
`app.ts` alongside the other authenticated business routers (not pre-auth —
unlike client provisioning, a run's own creation/fetch/close genuinely needs
`req.client`, since runs are scoped per client). Registered in the EPIC-8
doc-parity extension allowlist and `docs/openapi.json` regenerated.
`tests/integration/runs.test.ts` covers all 11 criteria above plus explicit
cross-client isolation cases (14 tests total, all passing). Full suite green
at 201/201 alongside ticket 01. `run_id` (not the generic `id` other
resources use) is the field name on every response, matching the header this
value gets echoed into for ticket 03.
