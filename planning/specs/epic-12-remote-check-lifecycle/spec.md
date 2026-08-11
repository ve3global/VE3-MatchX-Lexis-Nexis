# EPIC-12: Remote-check lifecycle sub-resource — Spec

See [constitution.md](../../constitution.md) — phase 2, no ticket number
(named in the original phase-1 plan: "the remote-check lifecycle
sub-resource (cancel/resend/results/pdf)"). Built best-effort per the
user's explicit direction for phase 2.

## Evidence

`lib/errorCodes.ts` codes 1312 ("An active remote check journey exists —
please cancel it first before creating a new one"), 1313 ("You cannot
add another remote check to this report as one has already been
completed"), 1321 ("There is no active remote check transaction that can
be cancelled"), 1338 ("You cannot resend as the remote check transaction
is no longer in progress"), and 1325 ("The report is closed for
additional follow-up actions") — a tight, unambiguous cluster confirming
a genuinely stateful lifecycle: exactly one transaction per report, three
states, cancel/resend only valid in one of them. Codes 1267-1269
(`transactionId`, `event`) suggest an inbound event-callback shape from a
real remote-check provider, which this replica doesn't implement (no live
provider exists to call back — see "Out of scope").

## Supersedes EPIC-7c's original `remote-check` design

EPIC-7c built `remote-check` as a synchronous action (immediate
deterministic `PASS`/`FAIL`, explicitly because "modeling genuine async
state without [this] sub-resource existing isn't meaningful"). That
sub-resource now exists, so the premise changed: `remote-check` becomes
genuinely stateful. Running it (`POST /reports/{id}/actions/remote-check`)
now starts a transaction (`IN_PROGRESS`) instead of resolving immediately;
`modules/reports/actions/remoteCheck.ts` is removed (its resolution logic
moved into the lifecycle service) and `remote-check` is no longer in
`ACTION_REGISTRY` — still a valid `primary_actions`/`secondary_actions`
name (`lib/reportActions.ts` is unchanged), just no longer auto-runnable
at report creation (see "Resolved conflicts").

## User story

As an API consumer who ran the `remote-check` action, I want to check its
result once the async identity-verification journey finishes, cancel it
if the subject can't complete it, resend it if they didn't receive the
journey link, and download a PDF certificate once it's done.

## Acceptance criteria

- `POST /reports/{id}/actions/remote-check` starts a transaction
  (`IN_PROGRESS`); calling it again while `IN_PROGRESS` → 422/1312;
  calling it again after `COMPLETED` → 422/1313
- `GET /reports/{id}/actions/remote-check/results` resolves an
  `IN_PROGRESS` transaction to a deterministic `PASS`/`FAIL` (simulating
  "the async journey finished by the time we checked" — see "Resolved
  conflicts"), writes the same `remote_check_completed`/
  `remote_check_result` attributes EPIC-7c's action produced (so a
  scorecard rule against them still works), and recomputes the report's
  `status`; subsequent calls return the same resolved result
  idempotently
- `POST /reports/{id}/actions/remote-check/cancel` → `CANCELLED` if
  `IN_PROGRESS`, else 422/1321
- `POST /reports/{id}/actions/remote-check/resend` → refreshes an
  `IN_PROGRESS` transaction, else 422/1338
- `GET /reports/{id}/actions/remote-check/pdf` → a stub PDF-shaped
  payload once `COMPLETED`, else 422
- Once `COMPLETED`, any further `POST /reports/{id}/actions/{action}`
  call (any action, not just remote-check) on that report returns
  422/1325 ("report is closed for additional follow-up actions")

## Resolved conflicts

- **Results resolve on first check, not on a timer/webhook.** This
  replica has no real async provider to actually wait on — "resolve the
  first time someone asks" is the simplest honest stand-in for "the
  journey finished at some point before you checked," using the same
  seeded determinism as everything else (90% `PASS`).
- **`pdf` is a stub, not a real PDF.** Returns
  `{content_type, filename, note}` describing what a real download would
  be, not actual PDF bytes — generating a real certificate document is
  well beyond this replica's fake-data scope.
- **Inbound `transactionId`/`event` callback is not implemented.** No
  real remote-check provider exists to call this replica back, so there's
  nothing to receive a callback *from* — building the endpoint with an
  invented payload shape would be pure invention, not "best-effort from
  evidence."
- **1325's "report closed" is scoped to the action-run endpoint only.**
  `GET /reports/{id}`, `.../audit`, `.../input-data` still work on a
  closed report — only *new* `POST .../actions/{action}` calls are
  blocked, matching "closed for additional **follow-up actions**"
  specifically.

## Out of scope

- Real inbound webhook receipt from a remote-check provider (no such
  provider exists in a replica).
- Any UI/journey-link generation — the "journey" itself is entirely
  opaque to this replica; only its lifecycle state is modeled.
