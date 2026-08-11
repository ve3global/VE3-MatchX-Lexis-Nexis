# EPIC-6: Scorecards & Scoring Engine — Spec

See [constitution.md](../../constitution.md) for shared principles and the
doc-vs-ticket precedence rule.

## Tickets covered

- **LN25** — Create a scorecard
- **LN26** — List and fetch scorecards
- **LN27** — Update a scorecard
- **LN28** — Delete a scorecard
- **LN29** — Scorecard draft/published/retired lifecycle
- **LN30** — Scoring engine
- **LN31** — Scorecard rule attribute validation

## User stories

- **LN25**: As an API consumer, I want to define a scorecard's pass/fail
  thresholds and scoring groups/rules, so that report types can attach it
  to get a pass/refer/fail assessment.
- **LN26**: As an API consumer, I want to list and fetch scorecards, so
  that I can see what's configured before attaching one to a report type.
- **LN27**: As an API consumer, I want to update a scorecard's thresholds
  or rules, so that I can tune scoring without recreating it.
- **LN28**: As an API consumer, I want to delete a scorecard I no longer
  need, so that stale configuration doesn't linger — but not silently break
  report types still relying on it.
- **LN29**: As an API consumer, I want a scorecard's lifecycle tracked
  (draft/published/retired) with a version number, so that I can iterate
  on scoring rules without a half-finished draft affecting live reports.
- **LN30**: As the platform, I want a scoring engine that evaluates a
  report's accumulated attributes against a scorecard's groups/rules, so
  that every report gets a consistent, deterministic pass/refer/fail
  assessment.
- **LN31**: As an API consumer, I want a scorecard rule's `attribute` field
  validated against the real set of report attributes, so that a typo
  doesn't silently create a rule that can never match anything.

## Acceptance criteria

**LN25**
- `POST /scorecards` accepts `name`, `pass_threshold`, `fail_threshold`,
  `groups` (each: `group_name`, `min_score`, `rules: [{attribute,
  match_score, no_match_score}]`)
- `pass_threshold` must be greater than `fail_threshold` (422, code 1163)
- `name` unique per client (422 — see "Resolved conflicts", not 409)
- Created scorecard defaults to `status: "DRAFT"`, `version: 1`
  (extension fields)

**LN26**
- `GET /scorecards` returns the client's scorecards in the doc's
  `{data, links, meta}` paginator envelope (shared `lib/pagination.ts`)
- `GET /scorecards/{id}` returns a single scorecard; unknown/foreign id →
  404

**LN27**
- `PATCH /scorecards/{id}` accepts a partial update of any create-time
  field
- Editing a `RETIRED` scorecard is rejected (422)
- Every successful update increments `version` by 1 (extension field)

**LN28**
- `DELETE` on a scorecard currently attached to any report type returns
  422, doc code **1241** verbatim (see "Resolved conflicts" — this is the
  one behavior the doc actually specifies for scorecard deletion)
- `DELETE` on an unattached scorecard removes it — a real, hard delete,
  regardless of its draft/published/retired status

**LN29 (replica-only extension)**
- `POST /scorecards/{id}/publish` moves `DRAFT` → `PUBLISHED`; a no-op
  success if already `PUBLISHED`; rejected (422) if `RETIRED`
- `POST /scorecards/{id}/retire` moves `DRAFT`/`PUBLISHED` → `RETIRED`; a
  no-op success if already `RETIRED`
- A `RETIRED` scorecard cannot be assigned as a report type's
  `scorecard_id` (422, same code as a nonexistent scorecard — see
  EPIC-5's `assertScorecardExists`, extended here)

**LN30**
- `scoring/engine.ts` exports a pure `evaluateScorecard(scorecard,
  attributes)` function: per-group score (sum of each rule's
  `match_score`/`no_match_score` depending on whether the report's
  attribute value is truthy) vs. `min_score`; overall score vs.
  `pass_threshold`/`fail_threshold` → `{score, result: PASS|REFER|FAIL,
  groups: [...]}`
- Deterministic and side-effect-free — same scorecard + same attributes
  always produces the same assessment; no report/HTTP wiring yet (that's
  EPIC-4's concern, once reports exist to run it against)

**LN31**
- A rule's `attribute` must be one of the confirmed names in
  [lib/reportAttributes.ts](../../../src/lib/reportAttributes.ts) (422,
  code 1171)
- A group with the same `attribute` in two of its own rules is rejected
  (422, code 1173)
- Two groups sharing the same `group_name` within one scorecard is
  rejected (422, code 1166)

## Resolved conflicts

Full detail in [constitution.md](../../constitution.md#resolved-conflicts-reference-table);
summarized for this epic:

- **Delete-while-attached is 422/1241, verbatim.** This is the one place
  the doc explicitly specifies scorecard-delete behavior — implemented
  exactly as documented, not reinterpreted.
- **Draft/published/retired + version are replica-only extensions.** The
  doc's scorecard response has no such fields at all. A real consumer
  reading only the documented fields sees identical behavior; publish/
  retire are net-new endpoints, allowlisted in EPIC-8's drift check.
- **"Retired scorecard can't be assigned" has no dedicated doc code.**
  Reuses 1179 (`scorecard_id is invalid`) — the same code EPIC-5 already
  uses for a nonexistent/foreign scorecard, since from a consumer's
  perspective a retired scorecard is equally unusable as a target.
- **Scorecard name-uniqueness has no dedicated doc code.** 1326 ("This
  template name is already taken...") is the closest transcribed analog —
  flagged as an inferred convention, same precedent as EPIC-5's 1327 for
  report-type names.
- **"Can't edit a RETIRED scorecard" has no dedicated doc code.** Falls
  back to the generic 1319, same precedent as EPIC-2/3/5's undocumented
  fields.
- **Rule-matching convention is designed, not transcribed.** The doc
  never specifies exactly how `match_score`/`no_match_score` combine with
  a report's attribute value — `scoring/engine.ts` treats any truthy
  attribute value (boolean `true`, or a non-zero count) as "matched".
  Matches the existing EPIC-1 seed scorecard's own shape
  (`sanction: {match_score: -100, no_match_score: 20}` — sanction *present*
  is bad, scored accordingly).
- **Attribute enum is provisional (8 of ~55 confirmed).** Same "grows,
  never shrinks" note as EPIC-5's action-name enum — see
  [lib/reportAttributes.ts](../../../src/lib/reportAttributes.ts).

## Out of scope

- Wiring `evaluateScorecard()` into an actual report's lifecycle
  (`GET /reports/{id}`, action-run recompute) — EPIC-4's concern, and
  depends on reports existing to carry accumulated attributes at all.
- Rule-attribute permission checks (doc code 1172, "not enabled for your
  user") — same one-tier-access rationale as EPIC-5's out-of-scope note.
