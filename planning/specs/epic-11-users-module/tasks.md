# EPIC-11: Users module — Tasks

- [x] `schema.prisma` — `UserProfile`, `Company`, `UserOptions`,
      `ActivityLog` models + migration
- [x] `middleware/activityLog.ts` — post-response, fire-and-forget log
      write, skipped for unauthenticated routes
- [x] Mount `activityLog` in `app.ts` after `auth`
- [x] `modules/users/schema.ts` — 3 update schemas + activity-logs query
      schema + error-code maps
- [x] `modules/users/service.ts` — get-or-create + update for
      self/company/options, `listActivityLogs`
- [x] `modules/users/routes.ts` — 7 routes
- [x] Mount `usersRouter` in `app.ts`
- [x] Regenerate `docs/openapi.json`
- [x] Integration test: self auto-creates on first GET, updates
      persist, duplicate username → 422/1318
- [x] Integration test: company auto-creates, name updates
- [x] Integration test: options toggle persists; age_min > age_max → 422
- [x] Integration test: activity log captures real requests with correct
      method/path/status, filterable by status
- [x] `path_identifier`/`ip`/`server_name` filters wired into
      `activityLogsQuerySchema`/`ACTIVITY_LOGS_ERROR_CODES`/
      `ActivityLogFilters`/`listActivityLogs` — previously unwired
      despite existing columns and a claimed acceptance criterion
      (tech-debt fix)
- [x] Integration test: filters by `ip`; rejects
      `path_identifier`/`ip`/`server_name` over the max length
      (422/1139/1142/1143)
- [x] Integration test: unauthenticated request → 401 (self/company/
      options/activity-logs all protected)
