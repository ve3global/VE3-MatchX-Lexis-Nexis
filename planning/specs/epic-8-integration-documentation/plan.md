# EPIC-8: Integration & Documentation — Plan

## `lib/openapi/collectRoutes.ts`

Walks Express's internal `app._router.stack` recursively (every router in
`app.ts` is mounted at the root, so no path-prefix stitching is needed) to
produce a flat `{method, path}[]` — the live route surface, derived once
per test/generator run, no hand-maintained list to fall out of sync.

## `lib/openapi/extensions.ts`

The 7 replica-only extension routes (`POST /oauth/token/revoke`,
`GET /addresses`, `GET /addresses/search`, `GET /addresses/{reference}`,
`POST /report-types/{id}/reactivate`, `POST /scorecards/{id}/publish`,
`POST /scorecards/{id}/retire`), each commented with its owning epic —
the single source of truth README.md's "Known replica-only extensions"
section and every epic's own spec.md agree with.

## `scripts/generate-openapi.ts`

Boots the app, calls `collectRoutes()`, builds a minimal OpenAPI 3.0.3
document (one entry per route, tagged `documented`/`extension` against
the allowlist), writes `docs/openapi.json`. Run via
`npm run openapi:generate`; re-run and commit whenever a route changes.

## `tests/integration/doc-parity.test.ts`

Three checks, all DB-free:
1. Every allowlisted extension is a real live route (catches a stale
   allowlist entry).
2. The checked-in `docs/openapi.json`'s route set exactly matches the
   live route set (catches drift — a route added/removed/renamed without
   regenerating the spec).
3. Every route's tag in the checked-in spec matches whether it's
   allowlisted (catches a route moved between "documented" and
   "extension" without regenerating).

## CI wiring

`.github/workflows/ci.yml`'s existing `lint` job gains one step:
`npx vitest run tests/integration/doc-parity.test.ts`, after lint/
typecheck. No new job, no Postgres service — this test doesn't touch the
database.

## Verification

1. `npm run openapi:generate` → `docs/openapi.json` with 27 routes, 7
   tagged `extension`.
2. `npx vitest run tests/integration/doc-parity.test.ts` → 3/3 pass.
3. Temporarily comment out a route in any router, re-run the doc-parity
   test → fails (drift caught); regenerate the spec → passes again.
4. Temporarily remove an entry from `EXTENSION_ROUTES` for a route that's
   still live and tagged `extension` in the spec → the third check fails
   (tag mismatch).
