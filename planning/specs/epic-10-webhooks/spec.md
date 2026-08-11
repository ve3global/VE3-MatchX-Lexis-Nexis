# EPIC-10: Webhooks — Spec

See [constitution.md](../../constitution.md) — phase 2, no ticket number
(named in the original phase-1 plan's deferral list: "webhooks (inbound
signature verification + outbound list/retry/test/secret)"). Built
best-effort per the user's explicit direction for phase 2.

## Evidence

`lib/errorCodes.ts` codes 1295-1297 (`notification_webhook_url` format/
validity/SSL-cert), 1322-1323 (`notification_webhook_url`/
`notification_webhook_secret` required), 1301 ("webhook URL is not
configured for this user"), 1303 ("a webhook must be in a failed or
retrying state to retry it"), 1324 (`status` length bound) — a tight,
confident cluster naming the exact fields and two of the four named
actions ("list"/"retry"/"test"/"secret" from the original plan wording).

## User story

As an API consumer, I want to register a webhook URL and secret so that
this replica can push me report/action events instead of me polling, and
I want to see delivery history, retry failed deliveries, send a test
payload, and rotate the secret.

## Acceptance criteria

- `POST /webhooks` accepts `{notification_webhook_url, notification_webhook_secret}`
  — URL must be `https://` (this replica's stand-in for the doc's "must
  have a valid SSL certificate" check, since it can't perform a live TLS
  handshake against an arbitrary user-supplied host — see "Resolved
  conflicts")
- `GET /webhooks` lists the client's webhooks, paginated
- `PATCH /webhooks/{id}` updates the URL/secret
- `DELETE /webhooks/{id}` removes it
- `POST /webhooks/{id}/test` records a `SUCCESS`/`FAILED` delivery
  attempt with a test payload — **no real HTTP request is made** (see
  "Resolved conflicts")
- `POST /webhooks/{id}/retry` retries the most recent `FAILED`/
  `RETRYING` delivery (422/1303 if the most recent one isn't in either
  state)
- `POST /webhooks/{id}/secret` rotates the secret, returning the new
  value once
- Every outbound delivery payload includes an HMAC-SHA256 signature
  (computed from the webhook's own secret) in a `signature` field —
  this replica's version of "inbound signature verification" (inbound
  *to the consumer*, i.e. what they'd verify on their end)

## Resolved conflicts

- **No real outbound HTTP calls.** A webhook resource's entire purpose
  is calling an arbitrary, caller-supplied URL — doing that for real
  from a local dev/test replica is both an SSRF risk (the URL is
  attacker/tester-controlled input) and a source of flaky, network-
  dependent tests. `test`/`retry` deterministically simulate a delivery
  outcome (seeded by the webhook id + attempt count) and record it,
  never making a live request. This is a safety-motivated deviation from
  what a real implementation would do, not a doc-fidelity gap — flagged
  because it affects observable behavior (a caller can't literally point
  this at their own server and see a request arrive), not because the
  doc says otherwise.
- **SSL-certificate validation is a static scheme check, not a live TLS
  handshake.** `https://` is required; nothing is actually connected to.
- **Secret is caller-supplied at creation, not server-generated.** Codes
  1322/1323 both say "field is required" (not "field is generated"),
  implying the caller provides both. `POST /webhooks/{id}/secret` (the
  "secret" action from the original plan wording) is this replica's own
  design for *rotating* it thereafter — the doc gives no detail on what
  that action actually does.
- **Secret is stored in plaintext, not hashed.** Unlike `Client.clientSecretHash`
  (bcrypt, one-way, only ever compared) a webhook secret must be
  recoverable to compute each delivery's HMAC signature — hashing it
  would make that impossible. Acceptable for a local dev/test replica;
  flagged as a simplification a production secrets store wouldn't make.

## Out of scope

- Actually receiving inbound webhook calls from a third party (e.g. a
  remote-check provider) — that's EPIC-12's concern, and uses a
  different signature-verification direction (verifying an *incoming*
  signature, not producing an outgoing one).
- Multiple webhooks per client is supported structurally (the doc's own
  "list" wording implies more than one), but nothing enforces a
  particular limit — no evidence either way.
