# EPIC-4: Reports Core — Tasks

- [x] `schema.prisma` — `Report`, `ReportActionResult`, `ReportAuditLog`
      models + migration
- [x] `modules/reports/actions/registry.ts` — empty `ACTION_REGISTRY`
      extension point (LN14)
- [x] `modules/reports/schema.ts` — create schema (`report_type_id` XOR
      inline `superRefine`) + list-query schema + error-code maps (LN14,
      LN15)
- [x] `modules/reports/service.ts` — create (report-type checks, action
      run loop, scorecard copy), list/filter, find (incl. soft-delete
      lookup variant), delete, audit, input-data, `serializeReport()`
      (LN14-19)
- [x] `modules/reports/routes.ts` — all 6 routes (LN14-19)
- [x] Mount `reportsRouter` in `app.ts`
- [x] Integration test: inline create missing every required field → 422
      with all 6 codes
- [x] Integration test: `report_type_id` + inline field → 422/1149;
      nonexistent `report_type_id` → 422
- [x] Integration test: empty `primary_actions` → `COMPLETE`; non-empty
      (unimplemented) `primary_actions` → `STARTED`
- [x] Integration test: `reference_required` unmet → 422/1250; `INACTIVE`
      report type → 422
- [x] Integration test: report type with a scorecard → created report's
      `assessment` reflects it
- [x] Integration test: fetch unknown id → 404; list filters by surname
- [x] Integration test: postcode (JSON path) filter + date_from/date_to
      filter
- [x] Integration test: soft-delete → 204, subsequent `GET` 404s, `GET
      .../audit` still 200s with `["CREATED", "DELETED"]`
- [x] Integration test: `input-data` echoes submitted fields
- [x] Integration test: unauthenticated request → 401
