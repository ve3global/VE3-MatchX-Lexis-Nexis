# EPIC-6: Scorecards & Scoring Engine — Tasks

- [x] `lib/reportAttributes.ts` — provisional `REPORT_ATTRIBUTES` enum +
      guard (LN31)
- [x] `lib/validation.ts` — `mapZodError` strips numeric path segments for
      `codeMap` lookup only
- [x] `schema.prisma` — extend `Scorecard` (status, version, updated_at) +
      migration with backfilled default
- [x] `scoring/engine.ts` — `evaluateScorecard()` (LN30)
- [x] `modules/scorecards/schema.ts` — create/update Zod schemas +
      threshold/group/rule `superRefine` rules + error-code map (LN25,
      LN27, LN31)
- [x] `modules/scorecards/service.ts` — CRUD + name-uniqueness + attached-
      delete check + publish/retire (LN25-29)
- [x] `modules/scorecards/routes.ts` — all 7 routes (LN25-29)
- [x] Mount `scorecardsRouter` in `app.ts`
- [x] Extend EPIC-5's `assertScorecardExists` to reject `RETIRED`
      scorecards
- [x] Add `/scorecards/{id}/publish` + `/scorecards/{id}/retire` to the
      EPIC-8 doc-parity allowlist (tracked here, applied when EPIC-8 lands)
- [x] Unit test: `evaluateScorecard()` — group scoring, pass/refer/fail
      boundaries, missing attributes (LN30)
- [x] Integration test: create → 201/DRAFT/version 1; bad thresholds →
      422/1163
- [x] Integration test: invalid rule attribute → 422/1171; duplicate rule
      in a group → 422/1173; duplicate group_name → 422/1166
- [x] Integration test: duplicate scorecard name → 422/1326
- [x] Integration test: list/fetch paginator + 404 (LN26)
- [x] Integration test: `PATCH` bumps version; `PATCH` on `RETIRED` → 422
- [x] Integration test: `DELETE` while attached → 422/1241; after detach →
      204
- [x] Integration test: publish/retire lifecycle incl. no-op cases
- [x] Integration test: assigning a `RETIRED` scorecard_id on a new report
      type → 422/1179
- [x] Integration test: unauthenticated request → 401
