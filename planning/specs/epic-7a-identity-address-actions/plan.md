# EPIC-7a: Identity & Address actions — Plan

## Modules

- `modules/reports/actions/addressVerification.ts` — bespoke, no request
  fields beyond an optional `full_er` boolean (code 1046); 9-10 seeded
  `address_*` attributes.
- `modules/reports/actions/dobVerification.ts` — bespoke, empty body;
  `dob_verified`/`dob_count`.
- `modules/reports/actions/simpleActions.ts` — `age-verification` (derives
  from `subject.dob` when present, else a seeded fallback),
  `nfi-address`/`property-register-search`/`address-insights` (via the
  shared `booleanAction()` factory in `helpers.ts`, empty body, seeded
  bias).

All five register in `modules/reports/actions/registry.ts` under
`ACTION_REGISTRY`, keyed by name from `lib/reportActions.ts`.

## Verification

1. `REPORT_ACTIONS` includes all 6 names; `ACTION_REGISTRY` has a module
   for each (asserted directly in
   tests/integration/report-actions.test.ts's completeness check, shared
   across all of EPIC-7).
2. Running `address-verification`/`dob-verification` twice on separate
   reports for the same subject → identical results.
3. `age-verification` with a subject `dob` implying age 25 → `true`; with
   a `dob` implying age 10 → `false`.
4. A report type listing any of these 6 as a primary action (all take an
   empty body) → the report completes automatically at creation
   (EPIC-4's auto-run path).
