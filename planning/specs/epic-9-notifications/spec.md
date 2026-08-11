# EPIC-9: Notifications — Spec

See [constitution.md](../../constitution.md) — phase 2, no ticket number
(named in the original phase-1 plan's deferral list, not doc-derived from
a specific ticket). Built best-effort per the user's explicit direction
for phase 2, same basis as EPIC-7.

## Evidence

Only `lib/errorCodes.ts` codes 1190-1192 (`message` field: required/
string/max-length) confidently belong to a notifications-shaped resource.
Codes 1279-1282 (`config.flow_type`, `read`) sit immediately adjacent to
OTP's phone-code/phone-number codes (1277-1285) in the doc's own
sequence — on inspection, more plausibly an OTP-delivery-preferences
request shape than a notification's own fields, so they're **not** used
here (see "Resolved conflicts"). This epic's evidence is consequently
thinner than EPIC-7's; flagged accordingly rather than overstated.

## User story

As an API consumer, I want a list of notifications with a message and a
read/unread state, so that I can surface account/report events to my own
users without polling every resource for changes.

## Acceptance criteria

- `GET /notifications` returns the client's notifications in the doc's
  `{data, links, meta}` paginator envelope, optionally filtered by `read`
- `PATCH /notifications/{id}` accepts `{read: boolean}` (codes 1281/1282
  — see "Resolved conflicts" for why these are reused here despite the
  ambiguity)
- A notification is created when a report transitions to `COMPLETE`
  (the one concrete trigger this replica wires up — see "Resolved
  conflicts")

## Resolved conflicts

- **No confirmed creation trigger.** The doc doesn't specify what causes
  a notification to exist. This replica wires up exactly one: a report
  reaching `status: "COMPLETE"` creates a notification
  (`modules/reports/service.ts`'s `recomputeStatus`/`createReport`).
  Never assumed to be the *only* real trigger — just the one concrete,
  testable hook this replica has.
- **`read` field reused from codes 1281/1282 despite ambiguous
  ownership.** The concept (a boolean read/unread flag) fits a
  notification naturally regardless of which endpoint the doc's codes
  actually belong to, so it's used here as this replica's own reasonable
  design — same "designed, not transcribed" precedent as EPIC-3's
  address-lookup response shape.
- **No `POST /notifications`.** Nothing in the evidence suggests a
  consumer creates notifications directly; they're system-generated.

## Out of scope

- Any notion of notification "type"/"category" — no evidence for one.
- The `config.flow_type` cluster (1279-1280) — left for a future OTP-
  preferences epic if that evidence is ever confirmed; not claimed here.
