# EPIC-7a: Identity & Address actions — Tasks

- [x] Confirm/derive the 6 action names in `lib/reportActions.ts` (LN32-36,
      LN39)
- [x] `modules/reports/actions/addressVerification.ts`
- [x] `modules/reports/actions/dobVerification.ts`
- [x] `age-verification`/`nfi-address`/`property-register-search`/
      `address-insights` in `simpleActions.ts`
- [x] Register all 6 in `ACTION_REGISTRY`
- [x] Expand `lib/reportAttributes.ts` with this epic's output attributes
- [x] Integration test: determinism (same subject, separate reports)
- [x] Integration test: auto-run at report creation for an empty-body
      action
- [x] Integration test: registry completeness (all 27 present, shared
      across EPIC-7)
