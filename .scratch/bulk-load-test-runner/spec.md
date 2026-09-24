Status: backlog (needs discussion — not yet designed, do not pick up as-is)

# Lightweight high-throughput runner to actually saturate the 10 req/s rate limit

## Problem Statement

`docs/postman/bulk-data-validation/`'s Newman-driven bulk runs (2,000 and
300,000 LC London rows against `POST /reports`) are paced with
`--delay-request 111` to target ~9 req/s, deliberately under the real 10
req/s per-client rate limit (`src/middleware/rateLimiter.ts`). In practice,
measured throughput comes in far lower than that target — confirmed via a
live 2,000-row run (8m 27.9s, ~3.9 req/s) and a follow-up diagnostic (50
iterations at `--delay-request 1`, i.e. effectively no deliberate delay,
still took 7.2s — ~144ms/iteration, ~6.9 req/s ceiling).

Root cause, confirmed by measurement, not guessed: Newman's own per-iteration
overhead (running the collection's sandboxed pre-request script — token-
expiry check, JSON body construction — and sandboxed test script —
status/field-code assertions — plus its own CLI reporting/bookkeeping) costs
~111ms per iteration on its own, before the real network request (measured
at only ~31ms average) even goes out. `--delay-request` and this floor don't
overlap; they add. So `144ms floor + 111ms delay ≈ 255ms/iteration ≈ 3.9
req/s` — exactly what was measured. The API and its rate limiter were never
actually the constraint; Newman's own scripting/reporting overhead is.

Consequence: `--delay-request` can be lowered, but there's a hard floor —
Newman cannot exceed roughly ~6.9 req/s on the machine it was measured on,
no matter how low the delay goes, because delay can't go negative and the
floor alone already exceeds `1000ms / 10`. **Newman cannot be tuned to
actually saturate a 10 req/s target** with this collection's current
scripts.

## Possible direction (not decided — for discussion)

A separate, lightweight, purpose-built load-generation script (e.g. plain
Node.js with `fetch`/`undici` in a paced loop, or an off-the-shelf tool like
`autocannon`/`k6`/`vegeta`) instead of Newman, specifically for runs that
need to actually approach or saturate the real 10 req/s ceiling — Newman
would remain the tool for the existing correctness-focused bulk-validation
runs (expected-status/field-code assertions per row), since swapping it out
there would lose the per-row assertion reporting that's the actual point of
those runs.

## Open questions (for the discussion session)

- Is saturating 10 req/s actually a real requirement, or was `--delay-request
  111`'s target of ~9 req/s always the intent, just not actually achieved?
- If a separate runner is built: does it still need per-row expected-
  status/field-code assertions (like Newman's test script), or is it purely
  for throughput/rate-limit behavior observation (no data validation)?
- Should it reuse the same CSV data files (`LC-London-sample-2000.csv`,
  `LC-London-300k.csv`) and expected-outcome columns, or is this a distinct
  concern that doesn't need the same dataset?
- Where should it live — alongside `docs/postman/bulk-data-validation/`, or
  under `scripts/`?

## Further Notes

Raised in conversation while investigating why a live 2,000-row Newman run
measured ~3.9 req/s instead of the ~9 req/s `--delay-request 111` targets.
Not yet scoped, not yet grilled — explicitly parked for a later discussion
before any implementation. Do not treat this file as ready-for-agent.
