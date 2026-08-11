# EPIC-7b: Financial & Screening actions — Tasks

- [x] Confirm/derive the 6 action names in `lib/reportActions.ts` (LN43-46,
      48, 49), including the credit-check bundling decision
- [x] `lib/qaOverrides.ts` — `isSanctionedOverride()`
- [x] `sanction-screening` (bespoke, QA override) in `simpleActions.ts`
- [x] `pep-screening`/`ccj-check`/`insolvency-check`/`director-check`/
      `credit-check` in `simpleActions.ts`
- [x] Register all 6 in `ACTION_REGISTRY`
- [x] Expand `lib/reportAttributes.ts` with this epic's output attributes
- [x] Integration test: QA override forces `sanction: true`
- [x] Integration test: assessment computed correctly from an action-
      produced attribute (sanction) via the scoring engine
- [x] Integration test: registry completeness (shared across EPIC-7)
