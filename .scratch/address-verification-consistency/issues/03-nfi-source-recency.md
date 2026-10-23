# 03: NFI sources dated inside MatchX's recency window

**Status:** done

**Blocked by:** None

Every NFI source carried the captures' fixed `recency: "2020-09-14"`,
about 73 months old. MatchX only scores an NFI source dated within its NFI
recency window (24 months in testing). So against the replica, every
pension-stage record scored 0 on "NFI Address Sources". This showed up
while verifying the Verification Pension Scorecard change
(VE3-MatchX-Python-Profiling#2243).

In `buildResponse`, each subject now gets one deterministic **NFI exercise
date**, 1–48 months before today and always on the 14th. Every NFI source
in that response shares it.

- [x] All NFI sources in a response share one date (as both captures show)
- [x] Date is 1–48 months back, ISO `YYYY-MM-14`
- [x] Same subject, same date (determinism)
- [x] Sample spans both sides of a 24-month window
      (`tests/unit/address-verification.test.ts`)
- [x] ER sources, attributes and scores unchanged

## Comments

- The date moves forward with the calendar, the same way ER years already
  follow the current year (`ER_START_YEAR`).
- Still open on the MatchX side: `evaluate_pension` reads the ER sources,
  not `nfi_sources`, so `NFI_PASS` can't be reached even with recent NFI
  dates. That's out of scope here.
