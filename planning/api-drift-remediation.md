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

- [x] `ccj-check` → renamed to `ccj-screening` — fixed 2026-09-10, see below
- [x] `director-check` → renamed to `company-officer-screening` — fixed
      2026-09-10, see below
- [x] `credit-check` → renamed to `credit-active` — fixed 2026-09-10, see
      below
- [ ] `insolvency-check` → rename to `insolvency-screening` (not touched by
      the 2026-09-10 capture — still an unconfirmed guess either way)
- [x] Add missing action: `lexid-match` — implemented 2026-09-10, see below
- [ ] Add missing action: `prs-verification` (not implemented at all)
- [x] `nfi-address` — resolved 2026-09-10: retired as a standalone action
      (see below), not kept as an extension
- [ ] `property-register-search` is not in the doc — still undecided:
      remove, or keep as a labeled replica-only extension (needs a
      "Resolved conflicts" entry if kept)
- [ ] `dob-verification`'s `sources` entries always include `day_match`/
      `month_match`/`year_match` — no capture (2026-09-10 or the 2026-09-08
      `pensions.json` one below) ever shows those keys, only `{source,
      dob_count}`. Drop them, or leave pending a capture that actually
      shows a `matched: true` example one way or the other.

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

## New finding (2026-09-03, from a live LexisNexis sandbox capture) — `Lexis_nexis_API.docx`

Captured request/response pairs from an actual sandbox call (not the PDF)
against `POST /reports`, `POST /address-lookup`, and `POST /oauth/token`.
Stronger evidence than the PDF where they disagree — this is the wire
format a real integration will actually hit. Sandbox credentials/tokens in
the source doc are not reproduced here.

- [x] **`POST /address-lookup` response shape did not match what's
  implemented — fixed 2026-09-03.** Captured response:
  `{"data": [{"id": 17723725, "address1": "SHERLOCK HOLMES MUSEUM",
  "address2": "221B BAKER STREET", "address3": "LONDON", "address4": "",
  "address5": "ENGLAND", "postcode": "NW1 6XE"}]}` — the same
  `id`/`address1-5`/`postcode` shape used elsewhere (report `address`,
  `address_verification.address`), not the replica's old `AddressCandidate`
  shape (`reference`, `full_address`, `house`, `street`, `town`,
  `postcode`). Constitution.md's "response schema is never expanded in the
  doc, so we're free to design a reasonable shape" no longer holds now that
  a real response has been observed. `addressLookup/service.ts` now returns
  `{id, address1-5, postcode}` plus an additive `reference` extension field
  (see epic-3-address-lookup/spec.md's "Resolved conflicts"); tests and
  `scripts/generate-postman-collection.ts` updated to match.
- [x] **`POST /oauth/token` used HTTP Basic Auth + `grant_type` in the
  sandbox capture, not just the JSON `{client_id, client_secret}` body —
  fixed 2026-09-03 by accepting both.** Captured call authenticates via
  `requests.post(TOKEN_URL, auth=(CLIENT_ID, CLIENT_SECRET),
  data={"grant_type": "client_credentials"})` — i.e. an `Authorization:
  Basic base64(id:secret)` header plus a `grant_type` form/body field, the
  opposite of the constitution.md table's "Doc actually says `{client_id,
  client_secret}` only... no `grant_type` field." Rather than replacing the
  JSON-body form (this single capture doesn't prove it was rejected), both
  are now accepted — Basic Auth wins when both are present. See
  epic-2-auth/spec.md's "Resolved conflicts".
- [x] **`POST /reports` inline mode (no `report_type_id`) also accepted
  `scorecard_id`, `actions` (array of action slugs to run at creation),
  `age_min`, `age_max` at the top level — not previously modeled, fixed
  2026-09-03.** Captured payload: `{"enduser_agreement": true,
  "reference": "...", "forename": "...", "surname": "...", "address":
  {...}, "actions": ["credit-active"], "scorecard_id": "0423e225-...",
  "age_min": 60, "age_max": 120, "test": false, "dob": "..."}`. A third
  creation mode (inline subject + inline scoring), not covered by epic-4's
  original two-mode split — see epic-4-reports-core/spec.md's "Resolved
  conflicts" for the full design (inline-only fields, `age_min`/`age_max`
  accepted-but-not-applied per the `uklexid` precedent, `actions`
  validated against the still-stale `REPORT_ACTIONS` enum pending the
  separate EPIC-7a/7b/7c slug-rename item below). `context` is also now
  populated (`reference`, `enduser_agreement`, `scorecard_id`, `age_min`,
  `age_max`) instead of stubbed `{}` — `full_er`/`nfi_address` still out
  of scope.
- **Confirms the real shape of the `context` object** that
  `serializeReport` currently stubs as `{}` (see the "missing `data`
  envelope" finding below, which is unrelated) — two captured examples:
  `{"reference": "44_REC534792", "enduser_agreement": true, "scorecard_id":
  "0423e225-...", "age_min": null, "age_max": null, "full_er": false,
  "nfi_address": false}` (first call, `actions: ["credit-active"]`) and
  `{"reference": "44_REC534792", "enduser_agreement": true, "scorecard_id":
  "0423e225-..."}` (second call, same reference, no `actions` given) — note
  `age_min`/`age_max` came back `null` even though `60`/`120` were sent,
  and the field only appears in `context` when `actions` was also given.
  Useful reference for whenever the `context` stub finding below gets
  picked up, but not an action item on its own.

## New finding (2026-09-10, from a live LexisNexis sandbox capture) — `API payload and response.json`

Captured request/response pairs against `POST /oauth/token`, `POST
/address-lookup`, `POST /reports` (address-verification-scored and
credit-active-scored), `POST /scorecards`, and `POST
/reports/{id}/actions/address-verification`. Confirms token/address-lookup
are already correct (no change needed there — see the 2026-09-03 entry
above); everything below was fixed the same day, scoped to exactly the
actions/fields this capture exercises (ticket-by-ticket — the ~20 other
still-unconfirmed actions from tier 3 of `lib/reportActions.ts`'s
derivation comment are untouched).

- [x] **`address-verification`'s request is `{config: {full_er, nfi_address}}`,
  nested — not the flat `{full_er}` guess.** Codes 1160/1257
  (`config.full_er`/`config.nfi_address`) moved here from
  `PATCH /users/options`'s own `config` sub-object, which had no real
  evidence either code belonged to it — see epic-11's spec.md for the
  fallback code now used there instead.
- [x] **`address-verification`'s attribute list was a representative
  subset (9 guessed names) — replaced with the doc-confirmed base set of
  9 plus a `config.nfi_address`-gated extension of 17 more** (see
  `lib/reportAttributes.ts`). Response block is now the rich
  `{verified, address_found, gone_away, date_first_seen, date_last_seen,
  address, telephones, sources}` shape, not a flat attribute dump.
- [x] **The standalone `nfi-address` action is retired.** The capture
  shows `nfi_address` is address-verification's own config flag, not a
  separate action — resolves the tracker's long-open "decide" item above.
- [x] **`POST /reports/{id}/actions/address-verification` returns the full
  report object**, not `{data: {"address-verification": result}}` like
  every other action — special-cased in `reports/routes.ts` since nothing
  in this capture (or any prior one) suggests the other 26 actions share
  this envelope.
- [x] **`age-verification`, `ccj-screening` (was `ccj-check`),
  `company-officer-screening` (was `director-check`), `dob-verification`,
  `credit-active` (was `credit-check`), and the previously-unimplemented
  `lexid-match`** all get doc-confirmed request/response shapes and
  (where applicable) renamed scoring attributes — see each module under
  `src/modules/reports/actions/` and the new entries in
  `lib/reportAttributes.ts`.
- [x] **Report `context` only carries `age_min`/`age_max`/`full_er`/
  `nfi_address` when a relevant action was requested** (address-verification
  and/or age-verification), not unconditionally — a second capture example
  (`actions: ["credit-active"]` only) shows a minimal context with none of
  those four keys. `age_min`/`age_max` echo the report type's own stored
  range when one exists (report_type_id mode), reconciling this capture's
  non-null example with the 2026-09-03 capture's null-in-inline-mode one;
  `full_er`/`nfi_address` echo address-verification's last-used `config`.
- [x] **`serializeScorecard` was missing a `username` field** — added,
  sourced from the caller's own `UserProfile` (same auto-create precedent
  as `users/service.ts#getSelf`).
- [x] **`credit-active`'s real scored attribute is `credit_lenders`** (a
  lender count), not the guessed boolean `credit_active` — renamed
  alongside the action itself.

## New finding (2026-09-08 capture, `pensions.json`) — "pension source" is not a new action

A colleague-supplied local file (`c:\Users\SavanKishorbhaiPadal\Downloads\pensions.json`,
labeled "PENSION API ENDPOINT") turned out to be the same capture already
checked in as `MatchX/06-reports-address-verification-action.md` —
`POST /reports/:id/actions/address-verification` with `config.nfi_address:
true`. Diffed field-for-field against the current implementation:

- [x] Confirmed **not a separate/pending API** — it's address-verification's
  existing `config.nfi_address` gating (base 9 + 17 extension attributes,
  `NFI_PENSIONS`/`NFI_PAYROLL`/`NFI_TRANSPORT_PASS` sources, the rich
  `lexid_match` shape, the full-report response special-case), all already
  implemented and matching this file exactly. No new action, route, or
  module needed — closing this out rather than tracking it as pending work.
- [x] **New gap this file surfaced: `assessment` shape never matched the
  doc at all — fixed 2026-09-11.** Doc shape (both this capture and
  `MatchX/06`): `{scorecard_id, score, result, reasons: [{label,
  indicator}], score_breakdown: [{group, group_score, rules: [{attribute,
  score, matched}]}]}`. The engine emitted `{score, result, groups:
  [{group_name, score, min_score, passed, rules}]}` — an epic-6 design
  guess that predated any real evidence and was never revisited once
  captures existed. Fixed in `src/scoring/engine.ts` (dropped `min_score`/
  `passed`, which the doc never returns — `min_score` stays available via
  the scorecard's own `groups` config for a caller who needs it). `reasons`
  labels are doc-confirmed for exactly 4 attributes (`address_verified`,
  `address_current_er`, `address_historic_er`, `lexid_match`); the rest of
  the doc's own worked scorecard example (`MatchX/05-scorecards.md`,
  `credit_lenders`/`address_gone_away_high`/`address_gone_away_very_high`/
  `company_officer_current`/`company_officer_historic`/
  `address_tracesmart_register`/`address_companies_house`/
  `address_insolvency_service`/`address_telephone_directory`/
  `address_registry_trust`/`ccj`) get a designed-not-transcribed label so a
  matched rule always has *some* reason text; anything else a scorecard
  rules on falls back to a humanized attribute name. A matched rule worth
  0 points is excluded from `reasons` (no capture shows one, and it carries
  no scoring signal either way). See epic-6-scorecards/spec.md's "Resolved
  conflicts".
- [ ] **Separate, not fixed here:** `dob-verification`'s response always
  includes `day_match`/`month_match`/`year_match` on each `sources` entry,
  but neither this capture nor the 2026-09-10 one ever shows those keys —
  only `{source, dob_count}`. The code comment's "shape confirmed" claim
  overstates what's actually evidenced. Filed as its own item under
  EPIC-7a/7b/7c above; not touched in this pass.

## New finding (2026-09-16 capture) — `report.user` was a stub; age-gating was over-broad

Colleague-supplied `POST /reports` (inline) + response pair, `actions:
["address-verification"]` only, no `age-verification` anywhere on the
report. Diffed against the current implementation:

- [x] **`report.user` was a hardcoded `{}` stub — fixed 2026-09-17.** Both
  this capture and the 2026-09-08 `pensions.json` one show a real
  `{id, username}` object (`"user": {"id": "25ea6f9b-...",
  "username": "VE3IDUTEST01"}`), sourced from the caller's own
  `UserProfile` — same auto-create-on-first-access pattern already used by
  `serializeScorecard`. Added `scorecards/service.ts#getUserSummary`
  (shares the upsert with the existing `getUsername`) and threaded it
  through `reports/routes.ts` into `serializeReport`.
- [x] **`context.age_min`/`age_max` were gated on "address-verification OR
  age-verification" — narrowed to age-verification only, fixed
  2026-09-17.** This capture runs address-verification alone and gets no
  `age_min`/`age_max` keys in context at all (not even `null` — absent
  entirely), contradicting the prior "either action" reading of the
  2026-09-03/09-10 captures (which happened to always have age-verification
  present alongside address-verification, so the two were never
  disambiguated until now). See `reports/service.ts`'s `serializeReport`.
- [x] **`config: {age_min, age_max}` sent at the top level of an inline
  `POST /reports` body has no effect — confirmed, not a gap.** The
  response's `context`/`attributes` show zero trace of the submitted
  `age_min: 50, age_max: 70`. `createReportSchema` has no `config` field at
  all, so Zod's default strip-unknown-keys behavior already silently drops
  it — matches the capture with no code change needed. (Distinct from
  address-verification's own action-level `config.full_er`/
  `config.nfi_address`, which is real and already wired.)

## Confirmed solid, no action needed

`POST /oauth/token` (both auth forms fixed 2026-09-03, see above),
`POST /address-lookup` (fixed 2026-09-03, see above), reports core CRUD +
audit + input-data (aside from the `uklexid` filter above), report-types/
scorecards base CRUD paths, `GET /up`.

## Verification note

`docs/postman/LN-Replica.postman_collection.json` is generated from this
repo's own routes/OpenAPI, not from the PDF — it currently reproduces every
gap above and should not be used to cross-check against the doc. Regenerate
it (`npm run postman:generate`) only after fixes land, as a confirmation
step, not a source of truth.
