# API drift remediation tracker

Audit date: 2026-08-14, against `IDU_REST_API_Documentation.pdf` (now
available at `c:\Users\SavanKishorbhaiPadal\Downloads\IDU_REST_API_Documentation.pdf`
— see constitution.md's "Source of truth" line, which previously had to be
worked around for phase 2). Every item below was confirmed by reading the
doc's exact path/field text and comparing it against the live route files;
none are guesses.

This is a tracking doc, not a new epic — items are grouped by the epic that
owns the affected code so each can be picked up and closed one at a time,
per the project's ticket-by-ticket delivery norm. When an item is fixed,
check it here **and** update the owning epic's `spec.md`/`tasks.md`, then
regenerate `docs/openapi.json` and the Postman collection so they stop
reproducing the wrong shape.

Status key: `[ ]` not started · `[~]` in progress · `[x]` fixed & verified
(tests + regenerated docs).

## Not bugs — already-intentional, documented extensions (no action needed)

Cross-checked against constitution.md's "Resolved conflicts" table — these
were deliberate ticket-vs-doc resolutions, not drift, and should **not** be
"fixed" back to doc-only shape:

- `GET /addresses`, `/addresses/search`, `/addresses/:reference` (LN10-12
  convenience aliases over `POST /address-lookup`)
- `POST /oauth/token/revoke` (LN9 extension)
- `POST /report-types/:id/reactivate` + `status` field (LN20/23/24 extension)
- `POST /scorecards/:id/publish` / `:id/retire` + `status`/`version` fields
  (LN25-29 extension)

## EPIC-11 Users module — wrong base paths

- [ ] `GET /users/company` → move to `GET /users/self/company`
- [ ] `GET /users/options` → move to `GET /users/self/options`
- [ ] `PATCH /users/options` → move to `PATCH /users/self/options`
- [ ] `GET /users/activity-logs` → move to `GET /users/self/activity-logs`
- [ ] Decide fate of `PATCH /users/self` and `PATCH /users/company` — doc
      has no such endpoints (self/company are GET-only). Either remove, or
      keep as a clearly-labeled replica-only extension per constitution.md's
      precedence rule (needs a decision + a "Resolved conflicts" entry
      added to epic-11's spec.md either way)

## EPIC-9 Notifications — wrong base path, two endpoints missing

- [ ] `GET /notifications` → move to `GET /users/self/notifications`
- [ ] `PATCH /notifications/:id` → move to `PATCH /users/self/notifications/:id`
- [ ] Add missing `GET /users/self/notifications/{notificationId}` (single)
- [ ] Add missing `DELETE /users/self/notifications/{notificationId}`
- [ ] Doc's `notificationId` path param is `integer`; current `Notification.id`
      is a UUID string — decide whether to align or document as an
      intentional extension

## EPIC-10 Webhooks — wrong resource model, needs a rebuild — `[~]` rebuilt 2026-08-14, pending migration + test run

The doc models webhooks as a **read-only delivery log** for one
account-level webhook URL (configured outside this API), not a
CRUD subscription resource. Rebuilt per `planning/specs/epic-10-webhooks/`
(spec.md/plan.md/tasks.md updated in the same pass):

- [x] Removed `POST /webhooks` (create), `PATCH /webhooks/:id` (update),
      `DELETE /webhooks/:id` — no such endpoints exist in the doc
- [x] `GET /webhooks` → doc's shape: paginated list of delivered webhook
      *messages* filtered by `date_from` (required, 1299) / `date_to`
      (1300), not a list of webhook configs
- [x] `GET /webhooks/:id` → returns a single webhook message (`webhook_id`,
      `type`, `status`, `payload`, `attempts`), not a webhook config
- [x] `POST /webhooks/:id/retry` → 202 Accepted, 422/1303 business rule
- [x] `POST /webhooks/:id/test` → moved to global `POST /webhooks/test`
      (`valid_signature`, `event_type` body params; no `:id`)
- [x] `POST /webhooks/:id/secret` → moved to `PUT /users/self/webhook-secret`,
      428 if no URL configured yet. The "how does the URL get configured"
      gap is resolved as a labeled extension: `PUT /users/self/webhook-url`
      (added to `src/lib/openapi/extensions.ts` and `README.md`)
- [x] Event types: doc only defines `remote-check.check-completed` and
      `remote-check.invitation-expired`. Removed the `report.complete`
      event from `reports/service.ts`; wired `remote-check.check-completed`
      into `getRemoteCheckResults` instead (the one real "async thing
      resolved" moment in this replica). `invitation-expired` has no
      automatic trigger (no invitation/timeout concept exists) — only
      reachable via `POST /webhooks/test`'s `event_type`
- [ ] `npx prisma migrate dev --name epic10_webhook_message_model` — user
      running this manually (non-interactive shell can't confirm the
      drop of old `webhooks`/`webhook_deliveries` tables); code changes
      are written against the new schema and won't compile/run until this
      lands
- [ ] Full test suite green + `docs/openapi.json`/Postman regenerated
      after the migration is applied

## EPIC-12 Remote-check lifecycle — every path one segment off

- [ ] `POST /reports/:id/actions/remote-check/cancel` → `POST /reports/:id/remote-check/cancel`
- [ ] `POST /reports/:id/actions/remote-check/resend` → split into
      `POST /reports/:id/remote-check/resend/sms` and
      `POST /reports/:id/remote-check/resend/email` (currently one
      collapsed endpoint; doc has two, with distinct 409/429/500 semantics)
- [ ] `GET /reports/:id/actions/remote-check/results` → `GET /reports/:id/remote-check/results`
- [ ] `GET /reports/:id/actions/remote-check/pdf` → `GET /reports/:id/remote-check/results/pdf`
- [ ] Note: `POST /reports/:id/actions/remote-check` (the action that
      *starts* a remote check) is correctly under `/actions/` per the doc —
      only the lifecycle sub-resource endpoints above are misplaced

## EPIC-7a/7b/7c Report actions — slug mismatches

Doc's action slug is the one that must appear in
`POST /reports/{reportId}/actions/{slug}` for a real integration to work.

- [ ] `ccj-check` → rename to `ccj-screening`
- [ ] `director-check` → rename to `company-officer-screening`
- [ ] `credit-check` → rename to `credit-active`
- [ ] `insolvency-check` → rename to `insolvency-screening`
- [ ] Add missing action: `lexid-match` (not implemented at all)
- [ ] Add missing action: `prs-verification` (not implemented at all)
- [ ] `nfi-address` and `property-register-search` are not in the doc —
      decide: remove, or keep as labeled replica-only extensions (needs a
      "Resolved conflicts" entry if kept)

## EPIC-4 Reports core — minor filter gap

- [x] `GET /reports` missing doc's `uklexid` query filter — added
      (accepted, type-validated 422/1245, matches zero reports — see
      epic-4-reports-core/spec.md's "Resolved conflicts")

## EPIC-5 Report types — minor filter gap

- [x] `GET /report-types` missing doc's `username`, `order`, `order_by`
      query params — added (see epic-5-report-types/spec.md's "Resolved
      conflicts")

## New finding (2026-08-14, during EPIC-10 rework) — missing `data` envelope on single-resource responses

Every module's single-resource GET/PUT/PATCH endpoints (reports,
report-types, scorecards, users/self, and pre-rebuild webhooks) return
the serialized resource directly, e.g. `res.json(serializeReportType(x))`.
The doc wraps **every** response, single or paginated, in `{"data": ...}`
(confirmed in `GET /report-types/{id}`'s sample and elsewhere). Only
paginated-list and report-action/remote-check-lifecycle endpoints
currently use the `data` wrapper. This spans every epic built so far, not
just one — noted here rather than fixed inline; needs its own scoped pass
(likely touches every `routes.ts` file) rather than being folded into
whichever epic is being worked on at the time. Not fixed as part of the
EPIC-10 rebuild — the new webhook endpoints followed the existing
(non-doc) repo convention for consistency in the meantime, except
`POST /webhooks/test` and `PUT /users/self/webhook-secret`, which the doc
itself shows both ways (secret unwrapped, test wrapped) and the rebuild
matched verbatim.

## Confirmed solid, no action needed

`POST /oauth/token`, `POST /address-lookup`, reports core CRUD + audit +
input-data (aside from the `uklexid` filter above), report-types/scorecards
base CRUD paths, `GET /up`.

## Verification note

`docs/postman/LN-Replica.postman_collection.json` is generated from this
repo's own routes/OpenAPI, not from the PDF — it currently reproduces every
gap above and should not be used to cross-check against the doc. Regenerate
it (`npm run postman:generate`) only after fixes land, as a confirmation
step, not a source of truth.
