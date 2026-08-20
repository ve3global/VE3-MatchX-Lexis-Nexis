# EPIC-10: Webhooks — Spec

See [constitution.md](../../constitution.md) — phase 2, no ticket number
(named in the original phase-1 plan's deferral list: "webhooks (inbound
signature verification + outbound list/retry/test/secret)").

## Evidence

Rebuilt 2026-08-14 against the real `IDU_REST_API_Documentation.pdf`
(previously unavailable — the first version of this epic was built
best-effort from `lib/errorCodes.ts` alone and got the resource model
wrong; see `planning/api-drift-remediation.md` for the audit that found
it). The doc's "Webhooks" section documents:

- `PUT /users/self/webhook-secret` — generate/rotate the client's one
  webhook secret; 428 if no URL is configured yet
- `GET /webhooks?date_from=&date_to=&page=&per_page=` — paginated list of
  messages this replica has attempted to deliver, `date_from` required
- `GET /webhooks/{webhookId}` — one message's payload + delivery attempts
- `POST /webhooks/{webhookId}/retry` — 202 Accepted; only when the
  message is in a failed/retrying state
- `POST /webhooks/test` — global (no id), sends a dummy message
  immediately; not logged to message history
- Two webhook payload docs (inbound-to-consumer, informational only):
  `remote-check.check-completed`, `remote-check.invitation-expired`

Error codes: 1295-1297 (`notification_webhook_url` format/SSL), 1299
(`date_from` required), 1300 (`date_to` ≥ `date_from`), 1301 (webhook URL
not configured), 1303 (retry state rule), 1322 (`notification_webhook_url`
required).

## User story

As an API consumer, I want to configure one webhook URL and generate a
secret for it, then see the history of messages this replica has tried to
deliver to it, retry failed ones, and send myself a test message — so I
can integrate without polling.

## Acceptance criteria

- `PUT /users/self/webhook-url` (extension — see "Resolved conflicts")
  sets `notification_webhook_url`; must be `https://` (1295/1296/1297)
- `PUT /users/self/webhook-secret` generates and stores a new secret,
  returned once; 428 if no URL is configured yet (doc-real precondition)
- `GET /webhooks` lists the client's delivered messages in the doc's
  paginator envelope, filtered to `[date_from, date_to ?? now]`;
  `date_from` is required (422/1299), `date_to` must be ≥ `date_from`
  (422/1300)
- `GET /webhooks/{id}` returns one message (`webhook_id`, `type`,
  `status`, `payload`) plus its `attempts` array
- `POST /webhooks/{id}/retry` — 422/1303 unless the message's status is
  `FAILED`/`RETRYING`; otherwise 202 and a new delivery attempt is made
- `POST /webhooks/test` — accepts `{valid_signature?, event_type?}`;
  simulates an immediate delivery and returns
  `{http_status_code, http_headers, http_message_payload}`; never creates
  a `WebhookMessage` row (doc: "not logged in your webhook message
  history")
- The one place this replica has a real "the async thing finished" moment
  — a remote check resolving to `COMPLETED`
  (`getRemoteCheckResults` in `modules/reports/service.ts`) — fires
  `remote-check.check-completed` automatically to the configured URL
- `remote-check.invitation-expired` is never fired automatically (see
  "Resolved conflicts") but is selectable as `POST /webhooks/test`'s
  `event_type`
- Every delivery attempt's payload includes an HMAC-SHA256 signature
  (computed from the client's stored secret)

## Resolved conflicts

- **No documented endpoint sets the webhook URL itself.** The doc only
  shows rotating a secret for a URL that already exists (428 otherwise).
  Since a URL has to be configurable somehow for this to be testable,
  `PUT /users/self/webhook-url` is added as a clearly-labeled extension
  (see `src/lib/openapi/extensions.ts`, `README.md`), mirroring the doc's
  own `/webhook-secret` naming so it reads as obviously parallel rather
  than a doc-real path. Code 1323 (`notification_webhook_secret` field is
  required) has no firing point in this design, since the secret is
  always server-generated, never caller-supplied — left declared-but-
  unused in `errorCodes.ts`, same as other codes elsewhere in the table
  that don't trigger in this replica.
- **One webhook URL per client, not a list of subscriptions.** The
  previous version of this epic built full CRUD over many webhooks per
  client; the doc has no create/update/delete/list-subscriptions
  endpoints at all — `GET /webhooks` lists delivered *messages*, not
  configs. `Client.notificationWebhookUrl`/`notificationWebhookSecret`
  replace the old `Webhook` model.
- **No real outbound HTTP calls.** Same rationale as before this rebuild:
  calling an arbitrary caller-supplied URL from a replica is an SSRF risk
  and a source of flaky tests. `test`/automatic delivery/`retry`
  deterministically simulate an outcome (seeded by message id + attempt
  number), never making a live request.
- **SSL-certificate validation is a static scheme check.** `https://` is
  required on `PUT /users/self/webhook-url`; nothing is actually
  connected to.
- **Secret is stored in plaintext, not hashed.** Must be recoverable to
  compute each delivery's HMAC — hashing it would make that impossible.
  Acceptable for a local dev/test replica; not a production pattern.
- **`remote-check.invitation-expired` has no automatic trigger.** This
  replica has no invitation-link/timeout concept — EPIC-12's own spec
  already scopes "any UI/journey-link generation" out. The event type
  still exists as a selectable `POST /webhooks/test` value, matching the
  doc's enum, but nothing in this replica ever reaches an "expired"
  state on its own.
- **`report.complete` is not a real event.** A prior tech-debt pass wired
  a `report.complete` event into generic report completion; the doc
  defines no such event, only the two `remote-check.*` ones. Removed.

## Out of scope

- Actually receiving inbound webhook calls from a third party (e.g. a
  remote-check provider) — EPIC-12's concern, and a different signature-
  verification direction (verifying an *incoming* signature, not
  producing an outgoing one).
- A second webhook URL, or per-event-type subscriptions — the doc has no
  such concept; one URL, one secret, per client.
