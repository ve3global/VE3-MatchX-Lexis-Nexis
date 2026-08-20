# EPIC-10: Webhooks — Tasks

Rebuilt 2026-08-14 to match the real doc — see `spec.md`'s "Evidence" and
`planning/api-drift-remediation.md` for why the original version of this
epic was replaced wholesale rather than patched.

- [x] `schema.prisma` — `Client.notificationWebhookUrl`/
      `notificationWebhookSecret`; `Webhook`/`WebhookDelivery` models
      replaced by `WebhookMessage`/`WebhookAttempt`; migration
- [x] `modules/webhooks/schema.ts` — `setWebhookUrlSchema`,
      `listWebhookMessagesQuerySchema`, `testWebhookSchema` + error codes
- [x] `modules/webhooks/service.ts` — `setWebhookUrl`, `rotateSecret`,
      `listMessages`, `findMessage`, `retryMessage`, `sendTestMessage`,
      `deliverEvent`, `attemptDelivery`
- [x] `modules/webhooks/routes.ts` — `PUT /users/self/webhook-url`
      (extension), `PUT /users/self/webhook-secret`, `GET /webhooks`,
      `GET /webhooks/:id`, `POST /webhooks/:id/retry`,
      `POST /webhooks/test`
- [x] Remove `deliverEvent(..., 'report.complete', ...)` call sites from
      `modules/reports/service.ts`; wire `remote-check.check-completed`
      into `getRemoteCheckResults` instead
- [x] `src/lib/openapi/extensions.ts` + `README.md` — register the new
      `PUT /users/self/webhook-url` extension
- [ ] Regenerate `docs/openapi.json` and the Postman collection
- [ ] Integration test: 428 when generating a secret with no URL configured
- [ ] Integration test: URL scheme validation (422/1295-1297)
- [ ] Integration test: `GET /webhooks` requires `date_from` (422/1299),
      rejects `date_to < date_from` (422/1300)
- [ ] Integration test: automatic `remote-check.check-completed` delivery
      on a resolved remote check, retrievable via `GET /webhooks` and
      `GET /webhooks/{id}` with its `attempts`
- [ ] Integration test: retry business rule (422/1303 when not eligible;
      202 + new attempt after a failed delivery)
- [ ] Integration test: `POST /webhooks/test` returns a signed payload,
      not persisted to message history, no real network call
- [ ] Integration test: unauthenticated request → 401
