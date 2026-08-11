# EPIC-5: Report Types — Plan

## New shared infra

- **`lib/reportActions.ts`** — `REPORT_ACTIONS` (provisional 19-name list,
  see spec.md) + `isReportAction()` guard. Single source of truth, reused
  by EPIC-7's action modules later.
- **`lib/pagination.ts`** — `paginate(items, total, page, perPage, path)`
  building the doc's `{data, links, meta}` Laravel-style envelope, plus
  `paginationQuerySchema`/`PAGINATION_ERROR_CODES` (codes 1077-1081) shared
  by every list endpoint (report-types here; scorecards/reports reuse it in
  EPIC-6/EPIC-4).
- **`lib/validation.ts` extended** — `mapZodError` now honors a `custom`
  issue's `params.code` directly (bypassing `codeMap`), and a new
  `singleFieldError(field, code)` builds the same `{message, errors}` shape
  for business-rule 422s (duplicate name, invalid scorecard_id) raised
  outside Zod. Needed because a single field (`primary_actions`) can fail
  for several distinct doc-numbered reasons that a flat
  `{field: {ruleType: code}}` map can't disambiguate.
- **`middleware/errorHandler.ts` extended** — new `ApiError(status, body)`
  class for pre-built business-rule responses (404 not-found, 422
  duplicate/invalid-reference), rendered verbatim by the error handler
  alongside the existing `ValidationError` (Zod) path.

## Data model (`schema.prisma`)

`ReportType` gains: `ageMin`/`ageMax` (`Int?`), `referenceRequired`
(`Boolean`, default `false`), `isDefault` (`Boolean`, default `false`),
`category` (`String?`), `status` (`ReportTypeStatus` enum
`ACTIVE`/`INACTIVE`, default `ACTIVE`), `updatedAt` (`@updatedAt`). New
migration backfills `updated_at` on the two existing seed rows via
`DEFAULT CURRENT_TIMESTAMP` (Prisma's auto-generated migration can't add a
required column with no default to a non-empty table, so this default is
added by hand in the migration file).

## Endpoints

### `POST /report-types` (LN20)

Validates via `createReportTypeSchema` (Zod object + `superRefine` for
action-list/cross-list/age-range business rules — see schema.ts). Service
layer additionally checks: name uniqueness per client (1327) and
`scorecard_id` existence/ownership (1179), both via `ApiError` (not Zod —
they need a DB round-trip). `201` with the serialized resource.

### `GET /report-types` / `GET /report-types/{id}` (LN21)

List: `paginationQuerySchema` on the query string, `lib/pagination.ts`
envelope wrapping serialized report types scoped to `req.client.id`,
ordered by `createdAt`. Fetch: 404 (`{"message":"Not found"}`) if the id
doesn't exist or belongs to a different client — same `findReportType()`
helper the update/deactivate/reactivate routes reuse.

### `PATCH /report-types/{id}` (LN22)

`updateReportTypeSchema` — every create field optional, same
`superRefine` business rules applied only to the fields actually present
(e.g. cross-list overlap only checked when *both* lists are given in this
request, not implicitly filled from the stored row — matches "partial
update" semantics: a request that only sends `primary_actions` isn't
implicitly asserting anything about the stored `secondary_actions`).
Duplicate-name check excludes the row's own id.

### `DELETE /report-types/{id}` (LN23) / `POST /report-types/{id}/reactivate` (LN24)

Both just flip `status` (`INACTIVE`/`ACTIVE`) via `prisma.reportType.update`
after the same `findReportType()` existence/ownership check. `DELETE`
returns `204` with an empty body (`res.status(204).send()`); reactivate
returns `200` with the updated serialized resource.

## Routing

`src/modules/reportTypes/routes.ts` mounted in `app.ts` after
`app.use(auth)`, alongside the address-lookup router.

## Verification

1. `POST /report-types` with a valid body → `201`, `status: "ACTIVE"`.
2. Same `name` again for the same client → `422`, code `1327`.
3. `primary_actions: ["not-a-real-action"]` → `422`, code `1037`.
4. Same action in both `primary_actions` and `secondary_actions` → `422`,
   codes `1347`/`1348` on the respective fields.
5. `scorecard_id` pointing at a nonexistent/other-client scorecard → `422`,
   code `1179`.
6. `GET /report-types` → paginator envelope; `GET /report-types/{id}` for
   another client's id → `404`.
7. `PATCH /report-types/{id}` with just `{description: "..."}` → `200`,
   every other field unchanged.
8. `DELETE /report-types/{id}` → `204` no body; `GET` on that same id still
   `200`s with `status: "INACTIVE"`.
9. `POST /report-types/{id}/reactivate` → `200`, `status: "ACTIVE"`.
