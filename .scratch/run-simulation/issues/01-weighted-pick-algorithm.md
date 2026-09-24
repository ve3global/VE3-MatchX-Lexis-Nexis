# 01: Weighted-pick algorithm for run outcomes

**What to build:** A pure, independently testable function that takes a run's
`distribution` (a list of `{status, weight}` pairs whose weights sum to 100) and
picks one status according to those weights on each call. It must accept an
injectable random-number source (defaulting to `Math.random`) so its behavior can
be asserted deterministically in tests without statistical flakiness — the same
dependency-injection technique this app's determinism engine already uses for its
own seeded `chance()` function, except here each call is a genuinely independent
roll (a run has no per-subject/per-record seed).

This is a standalone building block with no database or HTTP surface of its own —
ticket 03 (the run injection middleware) is what actually calls it against real
traffic.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A pure function exists that, given a `distribution` array and a random source, returns exactly one of the configured statuses.
- [x] The random source is injectable (defaults to `Math.random`, but a caller — namely tests — can supply a fixed function instead).
- [x] A roll near the very start of the range selects the first distribution entry.
- [x] A roll near the very end of the range selects the last distribution entry.
- [x] A roll exactly on a cumulative-weight boundary is assigned to the correct adjacent bucket, per a chosen, documented, and tested convention (e.g. inclusive lower bound).
- [x] A single-entry, 100%-weighted distribution always returns that one status regardless of the roll value.
- [x] All of the above is covered by unit tests with no HTTP server, no Express app, and no database involved — following `tests/unit/scoring-engine.test.ts`'s existing precedent for pure-function testing in this codebase.

## Comments

Implemented as `src/lib/runDistribution.ts`'s `pickOutcome(distribution, rng)` —
a cumulative-weight walk over the distribution, boundary convention is
inclusive-lower/exclusive-upper (a roll exactly on a boundary belongs to the
next bucket), with a post-loop fallback to the last entry for a roll that
reaches exactly the top of the range. Covered by 7 unit tests in
`tests/unit/runDistribution.test.ts`, all passing; `npm run typecheck`/`lint`
clean; full suite (`npx vitest run`) green at 201/201 after this and ticket 02
landed together.
