# EPIC-7b: Financial & Screening actions — Plan

## Modules

- `modules/reports/actions/simpleActions.ts` — all 6:
  `sanction-screening` (bespoke build, checks
  `lib/qaOverrides.ts#isSanctionedOverride` before falling back to a 5%
  seeded chance), `pep-screening`/`ccj-check`/`insolvency-check`/
  `director-check` (via the shared `booleanAction()` factory),
  `credit-check` (also via the factory, 3 attributes in one call).

## `lib/qaOverrides.ts`

`isSanctionedOverride(subject)` — `subject.surname` trimmed/upper-cased
equals `"SANCTIONED"`. Shared with EPIC-7c's `death-screening` override
(`isDeathOverride`) in the same file, both documented in README.md's "QA
override values" section.

## Verification

1. Surname `"SANCTIONED"` (any case/whitespace) → `sanction-screening`
   always returns `sanction: true`, regardless of seed.
2. `pep-screening`/`ccj-check`/`insolvency-check`/`director-check` on the
   same subject across two reports → identical booleans.
3. `credit-check` returns all three attributes in one call.
4. `REPORT_ACTIONS`/`ACTION_REGISTRY` completeness check (shared EPIC-7
   test) covers these 6 by name.
