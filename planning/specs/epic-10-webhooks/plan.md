# EPIC-10: Webhooks — Plan

## Data model

```prisma
model Client {
  // ...existing fields...
  notificationWebhookUrl    String?
  notificationWebhookSecret String?
  webhookMessages           WebhookMessage[]
}

enum WebhookDeliveryStatus {
  PENDING
  SUCCESS
  FAILED
  RETRYING
}

model WebhookMessage {
  id        String                @id @default(uuid())
  clientId  String
  client    Client                @relation(fields: [clientId], references: [id])
  type      String
  status    WebhookDeliveryStatus @default(PENDING)
  payload   Json
  createdAt DateTime              @default(now())
  updatedAt DateTime              @updatedAt
  attempts  WebhookAttempt[]
}

model WebhookAttempt {
  id            String         @id @default(uuid())
  messageId     String
  message       WebhookMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  attemptNumber Int
  succeeded     Boolean
  signature     String
  createdAt     DateTime       @default(now())
}
```

## `modules/webhooks/`

- `schema.ts`:
  - `setWebhookUrlSchema` — `notification_webhook_url`, required
    `https://` URL (codes 1295/1296/1297/1322), reusing the same
    `httpsUrl` Zod schema as before.
  - `listWebhookMessagesQuerySchema` — `date_from` required
    (`z.string().datetime()`, code 1299), `date_to` optional
    (`superRefine` for 1300 when `date_to < date_from`), `page`/`per_page`.
  - `testWebhookSchema` — `valid_signature` (boolean, default `true`),
    `event_type` (optional enum of the two doc event types).
- `service.ts`:
  - `signPayload(secret, payload)` — unchanged HMAC-SHA256 logic.
  - `setWebhookUrl(clientId, url)` — updates `Client.notificationWebhookUrl`.
  - `rotateSecret(clientId)` — 428 if no URL configured; else generates
    `randomBytes(32).toString('hex')`, stores it, returns it once.
  - `listMessages`/`findMessage` — read the client's `WebhookMessage`
    rows (with `attempts`, ordered) within a date range.
  - `attemptDelivery(message, secret)` (internal) — deterministic
    `chance(...)` 85%-success simulation via `lib/determinism.ts`, never
    a real HTTP call; creates a `WebhookAttempt` row and updates the
    message's `status`.
  - `deliverEvent(clientId, type, data)` — creates a `WebhookMessage` and
    immediately calls `attemptDelivery`; no-op if the client has no URL/
    secret configured. Called only from
    `modules/reports/service.ts#getRemoteCheckResults` on the
    `remote-check.check-completed` transition.
  - `retryMessage(clientId, id)` — 422/1303 unless `FAILED`/`RETRYING`;
    else `attemptDelivery` again (new attempt row).
  - `sendTestMessage(clientId, input)` — builds a dummy payload for
    `input.event_type` (random pick from the two doc event types if
    omitted), signs with an intentionally-wrong secret when
    `valid_signature: false`, simulates an outcome, returns
    `{http_status_code, http_headers, http_message_payload}` — does
    **not** write a `WebhookMessage` row.
- `routes.ts` — `PUT /users/self/webhook-url` (extension), `PUT
  /users/self/webhook-secret`, `GET /webhooks`, `GET /webhooks/:id`,
  `POST /webhooks/:id/retry`, `POST /webhooks/test`.

## Other files

- `modules/reports/service.ts` — remove both `deliverEvent(...,
  'report.complete', ...)` call sites; add
  `deliverEvent(clientId, 'remote-check.check-completed', {report_id,
  remote_check_id, status: 'COMPLETED'})` where `getRemoteCheckResults`
  transitions a transaction to `COMPLETED`.
- `src/lib/openapi/extensions.ts` — add `PUT /users/self/webhook-url`.
- `README.md` — "Known replica-only extensions" updated.

## Verification

1. `PUT /users/self/webhook-secret` with no URL configured → 428.
2. `PUT /users/self/webhook-url` with a non-`https://` URL → 422/1297
   (malformed string → 1295). Valid URL → 200.
3. `PUT /users/self/webhook-secret` after a URL exists → 200, returns a
   secret once.
4. `GET /webhooks` with no `date_from` → 422/1299. With `date_to` before
   `date_from` → 422/1300.
5. Running a remote check through to `COMPLETED` creates a
   `WebhookMessage` with `type: 'remote-check.check-completed'`,
   deliverable/retryable via the endpoints above.
6. `POST /webhooks/:id/retry` on a `SUCCESS` message → 422/1303; on a
   `FAILED` one → 202, new attempt recorded.
7. `POST /webhooks/test` → 200/500 with a signed payload; does not appear
   in a subsequent `GET /webhooks` call.
8. No outbound network call is ever made — verified using an
   unroutable/obviously-fake URL and asserting requests complete fast and
   deterministically.
