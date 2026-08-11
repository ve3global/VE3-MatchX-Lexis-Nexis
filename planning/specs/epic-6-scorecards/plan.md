# EPIC-6: Scorecards & Scoring Engine — Plan

## New shared infra

- **`lib/reportAttributes.ts`** — `REPORT_ATTRIBUTES` (provisional 8-name
  list) + `isReportAttribute()` guard, same pattern as EPIC-5's
  `lib/reportActions.ts`.
- **`lib/validation.ts` extended again** — `mapZodError`'s `codeMap` lookup
  now strips numeric path segments before consulting `codeMap` (so
  `groups.0.rules.1.attribute` looks up `groups.rules.attribute`), while
  the response body still reports the precise indexed path. Needed the
  moment a schema nests arrays two levels deep (`groups[].rules[]`) —
  EPIC-5's flat fields never exercised this.

## Data model (`schema.prisma`)

`Scorecard` gains: `status` (`ScorecardStatus` enum
`DRAFT`/`PUBLISHED`/`RETIRED`, default `DRAFT`), `version` (`Int`, default
`1`), `updatedAt` (`@updatedAt`). Same hand-edited-migration pattern as
EPIC-5 (`DEFAULT CURRENT_TIMESTAMP` added by hand so the 2 existing seed
rows backfill cleanly).

## `scoring/engine.ts` (LN30)

Pure function, no I/O:
```ts
evaluateScorecard(
  { passThreshold, failThreshold, groups }: ScorecardInput,
  attributes: Record<string, unknown>,
): Assessment
```
Per rule: `matched = Boolean(attributes[rule.attribute])`; score is
`match_score` if matched else `no_match_score`. Per group: sum of its
rules' scores, `passed = score >= min_score`. Overall: sum of all groups'
scores; `result` is `FAIL` if `score <= failThreshold` (checked first —
fail takes precedence over a simultaneously-met pass threshold, an
intentionally conservative tie-break), else `PASS` if `score >=
passThreshold`, else `REFER`. `null` thresholds simply never trigger their
branch (a scorecard can have a pass threshold with no fail threshold, or
vice versa).

Unit-tested directly in `tests/unit/scoring-engine.test.ts` (no HTTP, no
DB) — verifies the mechanics ahead of EPIC-4 wiring it into
`GET /reports/{id}` and action-run recompute.

## Endpoints

### `POST /scorecards` (LN25)

`createScorecardSchema` — thresholds cross-check (1163), per-group/rule
shape validation, plus LN31's attribute/duplicate/cross-group checks (all
via one `validateGroups()` `superRefine` helper, shared between create and
update). Service layer additionally checks name uniqueness (1326, `ApiError`
since it needs a DB round-trip). `201` with the serialized resource
(`status: "DRAFT"`, `version: 1`).

### `GET /scorecards` / `GET /scorecards/{id}` (LN26)

Same `lib/pagination.ts` envelope and `findScorecard()`-style 404 pattern
as EPIC-5's report-types list/fetch.

### `PATCH /scorecards/{id}` (LN27)

`updateScorecardSchema` — every field optional, same validation rules
applied only to fields present in the request. Service rejects edits to a
`RETIRED` scorecard (422, fallback 1319) before touching the DB.
Every successful update runs `version: {increment: 1}` in the same
`prisma.scorecard.update` call — atomic, no separate read-modify-write
race.

### `DELETE /scorecards/{id}` (LN28)

Checks `prisma.reportType.count({where: {scorecardId: id}})` first; `> 0`
→ 422/1241 verbatim. Otherwise `prisma.scorecard.delete()` — a real
delete, independent of `status`. `204` on success.

### `POST /scorecards/{id}/publish` / `POST /scorecards/{id}/retire` (LN29, extension)

Straight `status` flips per spec.md's acceptance criteria (no-op
successes where reasonable, rejecting publish-from-RETIRED). `200` with
the updated serialized resource either way (even the no-op case, so a
caller always gets the current state back).

## Cross-epic change: EPIC-5's `assertScorecardExists`

`src/modules/reportTypes/service.ts` now also rejects a `RETIRED`
scorecard_id (422/1179) — the same doc code already used for a
nonexistent/foreign one, since EPIC-6's `status` field didn't exist when
EPIC-5 was built. No other EPIC-5 behavior changes.

## Routing

`src/modules/scorecards/routes.ts` mounted in `app.ts` after
`app.use(auth)`, alongside address-lookup and report-types.

## Verification

1. `POST /scorecards` with `pass_threshold <= fail_threshold` → 422/1163.
2. `POST /scorecards` with a rule attribute not in
   `lib/reportAttributes.ts` → 422/1171.
3. Two rules with the same `attribute` in one group → 422/1173; two groups
   with the same `group_name` → 422/1166.
4. `PATCH` a `RETIRED` scorecard → 422; a successful `PATCH` on a non-
   retired one bumps `version` from 1 to 2.
5. `DELETE` a scorecard attached to a report type (via EPIC-5's
   `scorecard_id`) → 422/1241; detach, then `DELETE` → 204, subsequent
   `GET` → 404.
6. `publish` a `DRAFT` → `status: "PUBLISHED"`; `publish` again → still
   `PUBLISHED`, 200, no error. `retire` → `status: "RETIRED"`; a
   subsequent `PATCH` or `publish` on it → 422.
7. Assigning a `RETIRED` scorecard's id as a new report type's
   `scorecard_id` (EPIC-5's `POST /report-types`) → 422/1179.
8. `evaluateScorecard()` unit tests: a group's score sums its rules
   correctly; `result` is `PASS`/`REFER`/`FAIL` at the right boundaries;
   missing attributes count as not-matched rather than throwing.
