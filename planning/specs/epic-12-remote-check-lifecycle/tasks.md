# EPIC-12: Remote-check lifecycle sub-resource — Tasks

- [x] `schema.prisma` — `RemoteCheckTransaction` model + migration
- [x] Delete `modules/reports/actions/remoteCheck.ts`; remove from
      `ACTION_REGISTRY`
- [x] `modules/reports/service.ts` — `startRemoteCheck`,
      `cancelRemoteCheck`, `resendRemoteCheck`, `getRemoteCheckResults`,
      `getRemoteCheckPdf`; `runAction`'s 1325 closed-report check +
      remote-check special-case
- [x] `modules/reports/routes.ts` — 4 new sub-resource routes
- [x] Update `tests/integration/report-actions.test.ts`'s registry-
      completeness check to exclude `remote-check`
- [x] Update EPIC-7c's spec.md to note the supersession
- [x] Regenerate `docs/openapi.json`
- [x] Integration test: start → 422 on double-start (1312)
- [x] Integration test: results resolves deterministically, idempotent
      on re-fetch
- [x] Integration test: re-running after completion → 422/1313
- [x] Integration test: cancel — 422/1321 with no transaction, success
      when IN_PROGRESS, restart allowed after cancel
- [x] Integration test: resend — 422/1338 when not IN_PROGRESS, success
      when IN_PROGRESS
- [x] Integration test: pdf — 422 before completion, stub payload after
- [x] Integration test: 1325 blocks any further action-run after
      completion
- [x] Integration test: unauthenticated request → 401
