# EPIC-12: Remote-check lifecycle sub-resource — Plan

## Data model

```prisma
enum RemoteCheckStatus {
  IN_PROGRESS
  CANCELLED
  COMPLETED
}

model RemoteCheckTransaction {
  id        String            @id @default(uuid())
  reportId  String            @unique @map("report_id")
  report    Report            @relation(fields: [reportId], references: [id], onDelete: Cascade)
  status    RemoteCheckStatus @default(IN_PROGRESS)
  result    String?
  createdAt DateTime          @default(now()) @map("created_at")
  updatedAt DateTime          @updatedAt @map("updated_at")

  @@map("remote_check_transactions")
}
```

`@unique` on `reportId` — exactly one transaction per report, ever
(matches 1312/1313's "one active or one completed, never a second" rule);
`resend`/repeated `remote-check` runs reuse the same row rather than
creating new ones.

## `modules/reports/service.ts` changes

- `runAction`: checks `actionName === 'remote-check'` *first* and routes
  to `startRemoteCheck()` before the generic "report closed" guard —
  remote-check's own re-invocation gets the more specific doc code
  (1313, "already completed") this way, rather than being shadowed by
  the generic 1325 check meant for every *other* action. (An earlier
  draft checked 1325 first for all actions including remote-check itself,
  which silently made `startRemoteCheck`'s own 1313 branch unreachable —
  caught during this epic's live-API testing pass, not by the automated
  suite, since that test asserted only the HTTP status, not the specific
  error code; both the ordering and the test were fixed.)
- `createReport`'s primary-actions auto-run loop explicitly skips
  `remote-check` (it's no longer in `ACTION_REGISTRY`, so this is
  already the natural outcome — a report type listing it as a primary
  action just never auto-completes it, consistent with every other
  action needing input beyond the base subject).
- New functions: `startRemoteCheck`, `cancelRemoteCheck`,
  `resendRemoteCheck`, `getRemoteCheckResults`, `getRemoteCheckPdf` — all
  take `(clientId, reportId)`, all call `findReport` first for
  ownership/existence.
- `getRemoteCheckResults` is the one place resolution happens: on an
  `IN_PROGRESS` transaction, seeds off the same `subjectSeed()` helper
  EPIC-7 already uses, flips to `COMPLETED`, upserts the
  `ReportActionResult` row for `'remote-check'` with
  `{remote_check_completed: true, remote_check_result}`, and calls the
  existing `recomputeStatus()`.

## Removed from EPIC-7c

- `modules/reports/actions/remoteCheck.ts` deleted.
- `remote-check` removed from `ACTION_REGISTRY` in
  `modules/reports/actions/registry.ts` (stays in `lib/reportActions.ts`
  — it's still a valid action *name*, just no longer in the registry of
  auto-runnable modules).
- `tests/integration/report-actions.test.ts`'s registry-completeness
  check (`every action in REPORT_ACTIONS has an ACTION_REGISTRY entry`)
  updated to exclude `remote-check` explicitly, with a comment pointing
  here.

## Routes

Added to `modules/reports/routes.ts` (distinct path shape from the
generic `/reports/:id/actions/:action` — no routing-order conflict):
`POST /reports/:id/actions/remote-check/cancel`,
`POST /reports/:id/actions/remote-check/resend`,
`GET /reports/:id/actions/remote-check/results`,
`GET /reports/:id/actions/remote-check/pdf`.

## Verification

1. `POST .../actions/remote-check` → transaction `IN_PROGRESS`; running
   it again → 422/1312.
2. `GET .../results` → resolves to `PASS`/`FAIL`, deterministic for the
   same subject; calling again → same result, no re-resolution.
3. Running `remote-check` again after `results` resolved it → 422/1313.
4. `POST .../cancel` on a fresh (never-started) report → 422/1321; on an
   `IN_PROGRESS` one → `CANCELLED`; starting a new one after cancel →
   allowed (reuses the same row).
5. `POST .../resend` on a `COMPLETED`/`CANCELLED` transaction → 422/1338;
   on `IN_PROGRESS` → succeeds.
6. `GET .../pdf` before completion → 422; after → the stub payload.
7. After completion, `POST /reports/{id}/actions/dob-verification` (any
   other action) on that same report → 422/1325.
