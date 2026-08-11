# EPIC-9: Notifications — Plan

## Data model

```prisma
model Notification {
  id        String   @id @default(uuid())
  clientId  String   @map("client_id")
  client    Client   @relation(fields: [clientId], references: [id])
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("notifications")
}
```

## `modules/notifications/`

- `schema.ts` — `updateNotificationSchema` (`{read: z.boolean()}`, codes
  1281/1282), `listNotificationsQuerySchema` (pagination + optional
  `read` filter).
- `service.ts` — `listNotifications`, `findNotification`,
  `updateNotification`, plus `createNotification(clientId, message)` —
  a plain helper, not a route, called from
  `modules/reports/service.ts`'s status-recompute path.
- `routes.ts` — `GET /notifications`, `PATCH /notifications/{id}`.

## Trigger wiring

`modules/reports/service.ts`: both `createReport` (report_type_id path
completing immediately) and `recomputeStatus` (completing via individual
action runs) call `createNotification(clientId, ...)` exactly once, when
a report's status newly becomes `COMPLETE` — not on every status check,
so re-fetching an already-complete report never duplicates notifications.

## Verification

1. `GET /notifications` → paginator envelope; `?read=false` → only
   unread.
2. `PATCH /notifications/{id}` with `{read: true}` → `200`, `read: true`
   on a subsequent `GET`.
3. Completing a report (via either path) creates exactly one
   notification; re-fetching that already-complete report creates no
   additional ones.
4. Malformed `PATCH` body (`read` missing/wrong type) → `422`/1281 or
   1282.
