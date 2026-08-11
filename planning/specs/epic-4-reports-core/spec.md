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
  (`forename`, `surname`, `dob`, `address`, `enduser_agreement`) — never
  both (422, code 1149 if both given)
- Inline mode requires `forename`/`surname`/`enduser_agreement`/`dob`/
  `address.address1`/`address.postcode` (see "Resolved conflicts" — no
  `lexid` alternative exists in phase 1, so these are unconditionally
  required)
- `report_type_id` mode: the report type must exist, belong to the same
  client, and be `ACTIVE`; if it has `reference_required: true`, a
  `reference` must be given (422, code 1250)
- A `report_type_id` report's `scorecard_id` is copied from the report
  type at creation time, decoupled from the report type afterward
- Status is `COMPLETE` once every one of the report type's
  `primary_actions` has actually run; `STARTED` otherwise. At the time
  this epic landed, no action modules existed yet, so every
  `report_type_id` report stayed `STARTED` forever — EPIC-7 (now landed,
  see its own specs) populated the registry, so a report type whose
  primary actions all accept an empty body now completes automatically at
  creation; one needing its own input (bank details, a passport MRZ, …)
  still stays `STARTED` until that action is run individually via
  `POST /reports/{id}/actions/{action}`. An inline report is always
  created `STARTED` (no primary-actions list to complete).

**LN15**
- `GET /reports` returns the client's reports in the doc's
  `{data, links, meta}` paginator envelope, filterable by `forename`,
  `surname`, `dob`, `status`, `reference`, `postcode`, `date_from`,
  `date_to` (see "Out of scope" for `uklexid`)
- Soft-deleted reports never appear

**LN16**
- `GET /reports/{id}` returns the assembled response: base fields, minimal
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

## Out of scope

- `uklexid` list filter — no `lexid`/identity-matching concept exists in
  this replica at all (see above), so there's no column to filter against.
- `POST /reports/{id}/actions/{action}` and `input-data`'s bank-account/
  NI-number masking were explicitly out of scope for LN14-19 at the time
  this epic landed (no action modules existed to need either yet) — both
  were later added by EPIC-7's own work, not a re-scope of this epic.
