# EPIC-5: Report Types — Spec

See [constitution.md](../../constitution.md) for shared principles and the
doc-vs-ticket precedence rule.

## Tickets covered

- **LN20** — Create a report type
- **LN21** — List and fetch report types
- **LN22** — Update a report type
- **LN23** — Deactivate a report type
- **LN24** — Reactivate a report type

## User stories

- **LN20**: As an API consumer, I want to create a report type with its
  primary/secondary actions and optional scorecard, so that `POST /reports`
  can run a consistent set of checks by reference.
- **LN21**: As an API consumer, I want to list and fetch report types, so
  that I can see what's configured before creating reports against them.
- **LN22**: As an API consumer, I want to update a report type's fields, so
  that I can adjust its actions/scorecard without recreating it.
- **LN23**: As an API consumer, I want to deactivate a report type I no
  longer use, so that it stops being offered without losing its history.
- **LN24**: As an API consumer, I want to reactivate a deactivated report
  type, so that a mistaken deactivation (or a type I need again) is
  recoverable.

## Acceptance criteria

**LN20**
- `POST /report-types` accepts `name`, `description`, `scorecard_id`,
  `age_min`/`age_max`, `reference_required`, `primary_actions`,
  `secondary_actions`, `is_default`, `category`
- `name` is unique per client; a duplicate returns 422 (see "Resolved
  conflicts" — not 409)
- `primary_actions`/`secondary_actions` entries must be valid report-action
  names (see [lib/reportActions.ts](../../../src/lib/reportActions.ts));
  unknown names, duplicates within a list, or an action appearing in both
  lists all return 422 with the doc's numbered codes
- `scorecard_id`, if given, must reference an existing scorecard owned by
  the same client
- Created report type defaults to `status: "ACTIVE"` (extension field)

**LN21**
- `GET /report-types` returns the client's report types in the doc's
  `{data, links, meta}` paginator envelope (shared `lib/pagination.ts`)
- `GET /report-types/{id}` returns a single report type; an id belonging to
  another client or that doesn't exist returns 404
- Both list and fetch include inactive (deactivated) report types — a
  deactivation is a status flip, not a removal (see "Resolved conflicts")

**LN22**
- `PATCH /report-types/{id}` accepts a partial update of any create-time
  field (see "Resolved conflicts" — `PATCH` only, not `PUT`)
- Renaming to a name already used by another of the client's report types
  returns 422, same duplicate-name code as create
- Action-list/scorecard validation rules are identical to create's

**LN23**
- `DELETE /report-types/{id}` sets `status: "INACTIVE"` and returns the
  doc's own `204 No Content` (see "Resolved conflicts" — no body, doc
  parity preserved even though the underlying behavior is a status flip)
- A deactivated report type is unaffected in every other field

**LN24 (replica-only extension)**
- `POST /report-types/{id}/reactivate` sets `status: "ACTIVE"` and returns
  the updated resource
- Reactivating an already-active report type is a no-op success, not an
  error

## Resolved conflicts

Full detail in [constitution.md](../../constitution.md#resolved-conflicts-reference-table);
summarized for this epic:

- **`PATCH`, not `PUT`.** The doc only documents `PATCH` for report-type
  updates.
- **Duplicate name is 422, not 409.** The doc has no `409` anywhere;
  uniqueness is validated like any other field, using the doc's own
  transcribed code 1327 ("The report type name has already been taken").
- **Active/inactive status is a replica-only extension.** The doc's
  report-type response has no such field at all. `DELETE` still returns
  the doc's exact `204 No Content` shape — a real consumer sees
  doc-identical behavior; only a consumer that also reads the extension
  `status` field (or calls the extension reactivate endpoint) can tell the
  row wasn't actually removed. Allowlisted in EPIC-8's drift check.
- **`is_default`/`category` have no dedicated doc error code.** Neither
  field is referenced anywhere in the 1000-1348 table — like EPIC-2's
  `client_id`/`client_secret` and EPIC-3's postcode/full_address rule, type
  failures on these fall back to the generic 1319.
- **Action-name enum is provisional (19 of 27 confirmed).** See
  [lib/reportActions.ts](../../../src/lib/reportActions.ts) — the 15
  EPIC-7c doc-derived actions plus the 4 EPIC-1-seeded ones
  (`address-verification`, `dob-verification`, `sanction-screening`,
  `pep-screening`). The remaining ~8 EPIC-7a/7b action names aren't yet
  confirmed from the source PDF; validation here only rejects names outside
  this list, so nothing currently valid gets more permissive when the list
  grows to 27 — it can only accept more, never less.

## Out of scope

- Per-client action enablement ("not enabled for your user", doc codes
  1039/1346) — phase 1 has only one access tier per client, so this
  condition can't currently occur; not implemented until/unless that
  changes.
- Wiring a report type's `primary_actions` into actual execution on
  `POST /reports` — that's EPIC-4's concern (and depends on EPIC-7's action
  modules existing to run).
