# EPIC-10: Webhooks — Plan

## Data model

```prisma
enum WebhookDeliveryStatus {
  PENDING
  SUCCESS
  FAILED
  RETRYING
}

model Webhook {
  id         String   @id @default(uuid())
  clientId   String   @map("client_id")
  client     Client   @relation(fields: [clientId], references: [id])
  url        String
  secret     String
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  deliveries WebhookDelivery[]

  @@map("webhooks")
}

model WebhookDelivery {
  id        String                @id @default(uuid())
  webhookId String                @map("webhook_id")
  webhook   Webhook               @relation(fields: [webhookId], references: [id], onDelete: Cascade)
  status    WebhookDeliveryStatus @default(PENDING)
  payload   Json
  signature String
  createdAt DateTime              @default(now()) @map("created_at")
  updatedAt DateTime              @updatedAt @map("updated_at")

  @@map("webhook_deliveries")
}
```

## `modules/webhooks/`

- `schema.ts` — `createWebhookSchema`/`updateWebhookSchema`
  (`notification_webhook_url` — required `https://` URL, codes
  1295-1297/1322; `notification_webhook_secret` — required string, code
  1323), list pagination.
- `service.ts`:
  - `signPayload(secret, payload)` — `crypto.createHmac('sha256',
    secret).update(JSON.stringify(payload)).digest('hex')`.
  - `simulateDelivery(webhookId, attemptSeed)` — deterministic
    `SUCCESS`/`FAILED` via `lib/determinism.ts#chance` (85% success —
    matches the "normal case works" bias used everywhere else), never a
    real HTTP call.
  - `createWebhook`, `listWebhooks`, `findWebhook`, `updateWebhook`,
    `deleteWebhook`.
  - `testWebhook(clientId, id)` — builds a fixed test payload
    (`{event: 'test', message: 'This is a test webhook delivery.'}`,
    reusing the `message` field's doc-confirmed shape), signs it, calls
    `simulateDelivery`, records a `WebhookDelivery` row.
  - `retryWebhook(clientId, id)` — loads the most recent delivery;
    422/1303 unless it's `FAILED`/`RETRYING`; else creates a new
    delivery attempt (status `RETRYING` while in flight, then resolved
    the same way `testWebhook` resolves one).
  - `rotateSecret(clientId, id)` — generates a new
    `randomBytes(32).toString('hex')`, updates the row, returns the
    plaintext once (the response is the only time a caller sees it
    after rotation, same UX convention as the seed script's client
    secret).
- `routes.ts` — `POST/GET/PATCH/DELETE /webhooks(/{id})`,
  `POST /webhooks/{id}/test`, `POST /webhooks/{id}/retry`,
  `POST /webhooks/{id}/secret`.

## Verification

1. `POST /webhooks` with a non-`https://` URL → 422/1296 (or 1295 for a
   fully malformed URL string).
2. `POST /webhooks/{id}/test` → `200`, a `WebhookDelivery` row exists
   with a `signature` recomputable from the stored secret + payload.
3. `POST /webhooks/{id}/retry` with no prior delivery, or a prior
   `SUCCESS` delivery → 422/1303. After a `FAILED` test delivery → retry
   succeeds (200), creates a new delivery row.
4. `POST /webhooks/{id}/secret` → new secret differs from the original;
   a delivery made afterward signs with the new one.
5. `DELETE /webhooks/{id}` → 204; deliveries cascade-delete.
6. No outbound network call is ever made — verified by the test suite
   using an unroutable/obviously-fake URL (e.g. `https://example.invalid`)
   and asserting the request still completes fast and deterministically.
