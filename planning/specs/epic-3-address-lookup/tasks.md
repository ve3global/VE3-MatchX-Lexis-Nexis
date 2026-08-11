# EPIC-3: Address Lookup — Tasks

- [x] `lib/determinism.ts` — `seedFrom`, `subSeed`, `chance`, `pick`, `int`
      (shared engine, first consumer here) (LN10)
- [x] `modules/addressLookup/schema.ts` — Zod schema + one-of refinement +
      error-code map (LN10, LN13)
- [x] `modules/addressLookup/service.ts` — deterministic candidate
      generation, doc-parity special-case, reference encode/decode (LN10,
      LN11, LN12)
- [x] `modules/addressLookup/routes.ts` — `POST /address-lookup` (LN10,
      LN11, LN13)
- [x] `GET /addresses/{reference}` extension route (LN12)
- [x] `GET /addresses` + `GET /addresses/search` extension alias routes
      (LN10, LN11)
- [x] Mount `addressLookupRouter` in `app.ts` after global auth middleware
- [x] Add extension routes to the EPIC-8 doc-parity allowlist (tracked
      here, applied when EPIC-8 lands)
- [x] Integration test: same input → identical output across repeated
      calls (determinism)
- [x] Integration test: doc sample postcode → doc sample address as first
      candidate
- [x] Integration test: missing `postcode`/`full_address` → 422, code 1319
- [x] Integration test: wrong-typed field → 422, correct per-field code
- [x] Integration test: `GET /addresses` alias returns identical data to
      the POST equivalent
- [x] Integration test: `GET /addresses/search` alias returns identical
      data to the POST equivalent
- [x] Integration test: `GET /addresses/{reference}` round-trips a real
      candidate's reference
- [x] Integration test: `GET /addresses/{bad-reference}` → 404
- [x] Integration test: unauthenticated request → 401 (route is protected)
