# EPIC-4: Reports Core — Spec

See [constitution.md](../../constitution.md) for shared principles and the
doc-vs-ticket precedence rule.

## Tickets covered

- **LN14** — Create a report
- **LN15** — List reports
- **LN16** — Fetch a single report
- **LN17** — Delete a report
- **LN18** — Report audit log
- **LN19** — Report input-data

## User stories

- **LN14**: As an API consumer, I want to create a report either by
  `report_type_id` (running that type's configured checks) or inline
  subject data, so that both a standardized and an ad-hoc workflow are
  supported.
- **LN15**: As an API consumer, I want to list my reports with filters, so
  that I can find the ones I'm looking for without fetching every report.
- **LN16**: As an API consumer, I want to fetch one report's full assembled
  result, so that I can see its status, assessment, and every attribute
  collected so far.
- **LN17**: As an API consumer, I want to delete a report, so that stale
  test data doesn't linger — without breaking the guarantee that a deleted
  report is gone from every consumer's perspective.
- **LN18**: As an API consumer, I want a report's audit trail, so that I
  can see its history (creation, actions run, deletion) for compliance/
  debugging.
- **LN19**: As an API consumer, I want to see exactly what subject/contact
  data was submitted for a report, so that I can verify what was sent
  without re-deriving it from the original request.

## Acceptance criteria

**LN14**
- `POST /reports` accepts either `report_type_id` **or** inline
  (`forename`, `surname`, `dob`, `address`, `enduser_agreement`, plus the
  inline-only `scorecard_id`/`actions`/`age_min`/`age_max` below) — never
  both (422, code 1149 if any inline field, including the four new ones,
  is combined with `report_type_id`)
- Inline mode requires `forename`/`surname`/`enduser_agreement`/`dob`/
  `address.address1`/`address.postcode` (see "Resolved conflicts" — no
  `lexid` alternative exists in phase 1, so these are unconditionally
  required)
- Inline mode also accepts `scorecard_id` (an existing, non-`RETIRED`
  scorecard owned by the client — 422/1179 otherwise, same check EPIC-5
  uses), `actions` (an array of action names, same existence/duplicate
  checks as `primary_actions` — 422/1319, no dedicated doc code), and
  `age_min`/`age_max` (422/1119 if `age_min > age_max`) — confirmed by a
  live sandbox capture (2026-09-03, `planning/api-drift-remediation.md`),
  not part of the original two-mode split above
- `report_type_id` mode: the report type must exist, belong to the same
  client, and be `ACTIVE`; if it has `reference_required: true`, a
  `reference` must be given (422, code 1250)
- A `report_type_id` report's `scorecard_id` is copied from the report
  type at creation time, decoupled from the report type afterward
- Status is `COMPLETE` once every one of the requested actions has
  actually run; `STARTED` otherwise. The requested-actions list is the
  report type's `primary_actions` in report_type_id mode, or the inline
  `actions` field in inline mode — either way, an action needing its own
  input (bank details, a passport MRZ, …) stays `STARTED` until run
  individually via `POST /reports/{id}/actions/{action}`. At the time this
  epic landed, no action modules existed yet, so every `report_type_id`
  report stayed `STARTED` forever — EPIC-7 (now landed, see its own specs)
  populated the registry. A plain inline report with no `actions` field at
  all is always created `STARTED` (no requested-actions list to complete).

**LN15**
- `GET /reports` returns the client's reports in the doc's
  `{data, links, meta}` paginator envelope, filterable by `forename`,
  `surname`, `dob`, `status`, `reference`, `postcode`, `date_from`,
  `date_to`, `uklexid` (see "Resolved conflicts" — `uklexid` is
  accepted/type-validated but matches nothing)
- Soft-deleted reports never appear

**LN16**
- `GET /reports/{id}` returns the assembled response wrapped in the doc's
  `{"data": ...}` envelope (see "Resolved conflicts"): base fields, minimal
  `user`/`context`/`annotations` stubs, `assessment` (scoring-engine
  output, `null` if no scorecard), `attributes` (flattened map from every
  action result so far), and one key per executed action
- Unknown/foreign/deleted id → 404

**LN17**
- `DELETE /reports/{id}` returns the doc's own `204 No Content`; the
  report is soft-deleted internally but externally indistinguishable from
  a hard delete — every subsequent `GET /reports/{id}` on it 404s

**LN18**
- `GET /reports/{id}/audit` returns the report's audit trail (`CREATED`,
  action runs, `DELETED`), in order
- Stays accessible after the report is deleted — the deletion event is
  part of the trail it records

**LN19**
- `GET /reports/{id}/input-data` echoes the submitted subject/contact
  fields (`forename`, `middlename`, `surname`, `dob`, `address`,
  `reference`)

## Resolved conflicts

Full detail in [constitution.md](../../constitution.md#resolved-conflicts-reference-table);
summarized for this epic:

- **Delete is soft internally, hard externally.** `deletedAt` is set, not
  the row removed — but every read path (`GET` single, `GET` list) filters
  it out identically to a real delete, so a real consumer sees doc-
  identical `204`-then-`404` behavior. `GET .../audit` is the one
  deliberate exception (see LN18).
- **No `lexid` support in phase 1.** The doc's "required when lexid is not
  present" codes (1052-1054) are applied unconditionally here since this
  replica has no alternate identity-lookup path at all — flagged the same
  way EPIC-3's postcode/full_address rule was.
- **`report_type_id` mode error codes have no dedicated "invalid" code.**
  A nonexistent/foreign/inactive report type falls back to the generic
  1319, same precedent as EPIC-2/3/5/6's undocumented-condition fields.
- **Action execution was architecturally wired before the registry had any
  modules in it.** `modules/reports/actions/registry.ts` was built as the
  extension point EPIC-7a/7b/7c later populated with all 27 actions (see
  their specs). Before EPIC-7 landed, `POST /reports` against any
  `primary_actions` list stayed `STARTED` forever — not an error, not a
  workaround, just an honest reflection of "the thing that would complete
  this doesn't exist yet." That scope line no longer applies now that
  EPIC-7's modules exist, except for actions needing input the
  create-report request never collects (see EPIC-7's specs).
- **PENDING status (inherently-async actions) is deferred with EPIC-7.**
  The doc's `PENDING` status specifically for `remote-check`/`otp-*`
  actions can't be meaningfully implemented before those action modules
  exist; a report's only reachable statuses today are `STARTED` and
  `COMPLETE`.
- **Audit log response shape is designed, not transcribed** (same
  rationale as EPIC-3's address-lookup response) — the doc mentions an
  audit endpoint's existence but doesn't expand its schema.
- **`uklexid` is accepted, type-validated (422/1245 on a non-integer), and
  always matches zero reports.** There's no `lexid`/identity-matching
  concept anywhere in this replica (see above) — no report has one, so
  honestly reflecting that means "filter by an attribute nothing has"
  rather than silently ignoring the param or rejecting it as unsupported
  (see `planning/api-drift-remediation.md`).
- **`POST /reports` and `GET /reports/{id}` wrap their single-resource
  response in `{"data": ...}`**, matching the doc's own fingerprint (every
  response, single or paginated, uses the envelope — see
  `lib/pagination.ts`'s comment and `planning/api-drift-remediation.md`).
  `GET /reports` (list), `.../audit`, and `.../input-data` already used it;
  this closes the gap for the two endpoints that didn't.
- **Inline `scorecard_id`/`actions`/`age_min`/`age_max` are a third
  creation mode, confirmed by a live sandbox capture, not designed.** The
  original ticket only described `report_type_id` **or** inline subject
  data; the capture showed inline subject data *plus* inline
  scoring/actions on the same request, with no `report_type_id` at all.
  Rather than folding these into the existing two-mode split, they're
  treated as inline-only fields (prohibited alongside `report_type_id`,
  same 1149 code as `forename`/`surname`/etc.) — keeping report_type_id
  mode's own scorecard/primary-actions configuration the sole authority
  for that mode, unchanged.
- **`age_min`/`age_max` are accepted and range-validated but never
  applied — always `null` in `context`, mirroring the `uklexid` precedent
  above.** The sandbox capture sent `age_min: 60, age_max: 120` and got
  `null`/`null` back in `context` — this replica has no report-level
  age-gating concept to apply them to (that's report-*type*-level
  configuration, EPIC-5, a separate concern), so honestly reflecting the
  gap means accepting/validating the input without pretending to act on
  it, rather than silently ignoring or rejecting it.
- **`actions`' does-it-exist/duplicate codes reuse the generic 1319**,
  same as `is_default`/`category` elsewhere — no dedicated doc code exists
  for a field the doc doesn't define at all. `scorecard_id`'s Zod-level
  codes (1178/1207) and `age_min`/`age_max`'s (1113-1119) reuse the exact
  codes `reportTypes/schema.ts` already uses for the same field names —
  same "same code for the same field name" precedent as EPIC-6's
  `scorecard_id` 1179 business-rule code, which this endpoint's runtime
  check (`assertScorecardExists`, now shared from `scorecards/service.ts`)
  reuses verbatim.
- **`context` is now populated for every report, not stubbed `{}`.**
  Shape confirmed by the same sandbox capture: `{reference,
  enduser_agreement, scorecard_id, age_min, age_max}`. `full_er`/
  `nfi_address` (also present in the capture) are deliberately left out —
  wiring them up depends on epic-7a's `full_er` action flag and an
  `nfi-address` action result flowing into this object, a separate scoped
  concern.
- **`actions` validates against the existing (stale) `REPORT_ACTIONS`
  enum, which does not yet match the sandbox capture's own example.** The
  capture's payload used `"actions": ["credit-active"]` — the doc-correct
  slug per `planning/api-drift-remediation.md`'s EPIC-7a/7b/7c
  slug-mismatch finding — but the registry/enum still has the old
  `credit-check` name pending that separate, not-yet-fixed tracked item.
  Fixing the inline-`actions` feature here does not fix that unrelated
  drift; tests in this epic use `credit-check` (today's real slug), not
  `credit-active`.

## Out of scope

- `POST /reports/{id}/actions/{action}` and `input-data`'s bank-account/
  NI-number masking were explicitly out of scope for LN14-19 at the time
  this epic landed (no action modules existed to need either yet) — both
  were later added by EPIC-7's own work, not a re-scope of this epic.
