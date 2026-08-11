# EPIC-9: Notifications — Tasks

- [x] `schema.prisma` — `Notification` model + migration
- [x] `modules/notifications/schema.ts`
- [x] `modules/notifications/service.ts` — CRUD + `createNotification()`
      helper
- [x] `modules/notifications/routes.ts` — list + mark-read
- [x] Mount `notificationsRouter` in `app.ts`
- [x] Wire `createNotification()` into `modules/reports/service.ts`'s
      COMPLETE-transition points (create + recomputeStatus)
- [x] Integration test: list + read filter + paginator envelope
- [x] Integration test: mark-read updates state
- [x] Integration test: report completion creates exactly one
      notification, no duplicates on re-fetch
- [x] Integration test: malformed PATCH body → 422
- [x] Integration test: unauthenticated request → 401
