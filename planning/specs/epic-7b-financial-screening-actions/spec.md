# EPIC-7b: Financial & Screening actions — Spec

See [constitution.md](../../constitution.md) and
[lib/reportActions.ts](../../../src/lib/reportActions.ts)'s derivation
comment (same "best-effort, clearly flagged" basis as EPIC-7a).

## Tickets covered

LN43, LN44, LN45, LN46, LN48, LN49 — mapped one-to-one against this
epic's 6 confirmed action names:

- **LN43** — sanction-screening
- **LN44** — pep-screening
- **LN45** — ccj-check
- **LN46** — insolvency-check
- **LN48** — credit-check
- **LN49** — director-check

(Same caveat as EPIC-7a: the ticket numbers are confirmed, which specific
ticket maps to which action is this replica's own ordering.)

## User story

As an API consumer running a report, I want financial/screening checks
(sanctions, PEP, CCJs, insolvency, credit activity, director
associations) so that I can assess a subject's financial and screening
risk profile as part of onboarding or AML compliance.

## Acceptance criteria

- `sanction-screening`/`pep-screening` produce the exact `sanction`/`pep`
  attribute names EPIC-1's seed scorecard already assumes
- `sanction-screening` honors the documented QA override: surname
  `"SANCTIONED"` forces `sanction: true` (README, constitution.md)
- `ccj-check`/`insolvency-check`/`director-check` each produce one seeded
  boolean attribute; `credit-check` bundles `credit_active`/
  `experian_match`/`equifax_match` into one action (see "Resolved
  conflicts")
- Bias matches constitution.md's "normal subject cleanly passes"
  philosophy: adverse findings (sanction, pep, ccj, insolvency, director
  match) default rare (3-10%); credit-check's fields default common
  (85-90%)

## Resolved conflicts

- **Action names**: `ccj-check` (error code 1057), `insolvency-check`
  (1058), `director-check` (1076) each map to one bare boolean-toggle
  code with no further detail — implemented as a single seeded boolean,
  same uniform treatment as EPIC-7a's thin-evidence actions.
- **`credit-check` bundles 5 related codes into one action** (1074
  `experian`, 1075 `equifax`, 1048 `credit_activity`, 1082
  `credit_active_mode`, 1083 `credit_active_primary`) rather than 5
  separate actions — this replica's own design choice (see
  lib/reportActions.ts), matching how real UK bureau-aggregator checks
  bundle Experian/Equifax + credit-activity into one product, and
  reconciling the ticket count (6 EPIC-7b tickets, 6 named actions here
  once bundled this way).
- **`credit_active_mode`/`credit_active_primary` are not implemented as
  distinct output fields** — no doc detail on their possible values
  beyond "is not valid" (codes 1082/1083 are validation-only, no
  companion "must be a string"/"required" pair), so this replica doesn't
  invent an enum for them.

## Out of scope

- `experian`/`equifax` as independently callable actions (bundled per
  above).
- Per-bureau real credit file data — `credit-check`'s three attributes
  are seeded booleans/flags, not simulated credit reports.
