# EPIC-5: Report Types — Tasks

- [x] `lib/reportActions.ts` — provisional `REPORT_ACTIONS` enum + guard
- [x] `lib/pagination.ts` — `paginate()` + pagination query schema/codes
      (LN21)
- [x] `lib/validation.ts` — `mapZodError` honors `issue.params.code`;
      `singleFieldError()` helper
- [x] `middleware/errorHandler.ts` — `ApiError` class + handling
- [x] `schema.prisma` — extend `ReportType` (age_min/max,
      reference_required, is_default, category, status, updated_at) +
      migration with backfilled default
- [x] `modules/reportTypes/schema.ts` — create/update Zod schemas +
      action-list/cross-list/age-range `superRefine` rules + error-code map
      (LN20, LN22)
- [x] `modules/reportTypes/service.ts` — CRUD + name-uniqueness +
      scorecard-existence checks + deactivate/reactivate (LN20-24)
- [x] `modules/reportTypes/routes.ts` — all 6 routes (LN20-24)
- [x] Mount `reportTypesRouter` in `app.ts`
- [x] Add `/report-types/{id}/reactivate` to the EPIC-8 doc-parity
      allowlist (tracked here, applied when EPIC-8 lands)
- [x] Integration test: create → 201, duplicate name → 422/1327
- [x] Integration test: unknown action name → 422/1037; duplicate within a
      list → 422/1038; cross-list overlap → 422/1347+1348
- [x] Integration test: invalid/foreign `scorecard_id` → 422/1179
- [x] Integration test: list returns paginator envelope; fetch unknown/
      other-client id → 404
- [x] Integration test: partial `PATCH` leaves untouched fields unchanged
- [x] Integration test: `DELETE` → 204, subsequent `GET` still 200 with
      `status: "INACTIVE"`
- [x] Integration test: reactivate → 200, `status: "ACTIVE"`
- [x] Integration test: unauthenticated request → 401
