# EPIC-10: Webhooks — Tasks

- [x] `schema.prisma` — `Webhook`/`WebhookDelivery` models + migration
- [x] `modules/webhooks/schema.ts` — create/update schemas + error codes
- [x] `modules/webhooks/service.ts` — CRUD, `signPayload`,
      `simulateDelivery`, `testWebhook`, `retryWebhook`, `rotateSecret`
- [x] `modules/webhooks/routes.ts` — all 7 routes
- [x] Mount `webhooksRouter` in `app.ts`
- [x] Regenerate `docs/openapi.json`
- [x] Integration test: URL scheme validation (422/1295-1297)
- [x] Integration test: test-delivery creates a verifiable signed record,
      no real network call
- [x] Integration test: retry business rule (422/1303 when not eligible;
      succeeds after a failed delivery)
- [x] Integration test: secret rotation changes subsequent signatures
- [x] Integration test: delete cascades deliveries
- [x] Integration test: unauthenticated request → 401
