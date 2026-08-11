# EPIC-4: Reports Core — Plan

## Data model (`schema.prisma`)

New models: `Report` (client fk, optional `reportTypeId`/`scorecardId`
fks, subject fields, `enduserAgreement`, `test`, `status` enum
`STARTED`/`PENDING`/`COMPLETE`, `deletedAt` for the soft-delete, standard
timestamps), `ReportActionResult` (report fk, `actionName`,
`requestPayload`/`resultPayload` Json, unique on
`[reportId, actionName]`), `ReportAuditLog` (report fk, `eventType`,
`message`, `createdAt`). `reportTypeId`/`scorecardId` use `onDelete:
SetNull` — a report never blocks or gets orphaned by changes to the
report type/scorecard it referenced at creation time.

## `modules/reports/actions/registry.ts`

```ts
export const ACTION_REGISTRY: Partial<Record<string, ActionModule>> = {};
```
Empty on purpose (see spec.md's "Resolved conflicts") — the one place
EPIC-7a/7b/7c plug in later, one module per report action.

## `POST /reports` (LN14)

`createReportSchema` — every field optional at the top level (to support
the `report_type_id`-XOR-inline shape), with a `superRefine` that:
1. Validates `dob`'s `YYYY-MM-DD` format (custom code 1013).
2. If `report_type_id` is given, raises 1149 on any inline field also
   present.
3. Otherwise, raises the doc's "required" codes on
   `forename`/`surname`/`enduser_agreement`/`dob`/`address.address1`/
   `address.postcode` if missing (unconditionally — see spec.md's `lexid`
   note).

Service layer (`createReport`):
1. If `report_type_id`: load it, checking existence/ownership (1319),
   `ACTIVE` status (1319), and `reference_required` (1250).
2. Run every `primaryActions` entry found in `ACTION_REGISTRY` (currently
   none), collecting `{actionName, resultPayload}` pairs.
3. `status = COMPLETE` iff every primary action ran (vacuously true for an
   empty list); inline reports are always `STARTED`.
4. One transaction: create the `Report` (copying `reportType.scorecardId`
   if present), create a `ReportActionResult` row per action that
   actually ran, create one `ReportAuditLog` row (`CREATED`).

## `GET /reports` (LN15) / `GET /reports/{id}` (LN16)

List: `listReportsQuerySchema` (pagination + `forename`/`surname`/`dob`/
`status`/`reference`/`postcode`/`date_from`/`date_to`), `lib/pagination.ts`
envelope. `postcode` filters the JSON `address` column via Prisma's
`{path: ['postcode'], string_contains: ...}` — verified working against
Postgres in this stack (no preview flags needed). `date_from`/`date_to`
filter `createdAt` with `gte`/`lte`.

Fetch: `serializeReport()` assembles the full nested shape — merges every
`ReportActionResult.resultPayload` into a flat `attributes` map and under
its own `actionName` key, computes `assessment` via
`scoring/engine.ts#evaluateScorecard` when `scorecardId` is set (`null`
otherwise). Both currently always show `attributes: {}` and no
action-keyed fields, since no action has ever run — that will change
automatically once EPIC-7 starts writing `ReportActionResult` rows; no
serialization changes needed then.

## `DELETE /reports/{id}` (LN17)

Sets `deletedAt`, writes a `DELETED` audit row, in one transaction. `204`,
no body. Every other read path filters `deletedAt: null`.

## `GET /reports/{id}/audit` (LN18)

Uses `findReportRow(clientId, id, {includeDeleted: true})` — the one
lookup in this module that doesn't 404 on a soft-deleted report, since the
audit trail is specifically what records that deletion happened.

## `GET /reports/{id}/input-data` (LN19)

Echoes `forename`/`middlename`/`surname`/`dob`/`address`/`reference` off
the report row directly. No masking logic yet — nothing sensitive exists
to mask without EPIC-7's action payloads.

## Routing

`src/modules/reports/routes.ts` mounted in `app.ts` after `app.use(auth)`,
last of the four protected routers (address-lookup, report-types,
scorecards, reports) — reports depends on report-types/scorecards
existing, so it's mounted after them, though mount order has no runtime
effect on routing itself.

## Verification

1. Inline `POST /reports` missing every required field → 422 with all six
   expected codes (1007/1010/1055/1052/1053/1054).
2. `report_type_id` + any inline field → 422/1149.
3. `report_type_id` for a report type with `primary_actions: []` → `201`,
   `status: "COMPLETE"`; with a non-empty list → `201`, `status:
   "STARTED"` (registry is empty).
4. `reference_required: true` report type, no `reference` → 422/1250.
   `INACTIVE` report type → 422.
5. A report type with a scorecard attached → created report's `assessment`
   reflects that scorecard evaluated against `{}` attributes.
6. `GET /reports/{id}` for an unknown id → 404; `GET /reports` filtered by
   `surname`/`postcode`/`date_from`+`date_to` returns only matching rows.
7. `DELETE` → `204`; subsequent `GET` → `404`; `GET .../audit` still
   `200`s and shows `["CREATED", "DELETED"]`.
8. `GET .../input-data` echoes exactly the six submitted fields.
