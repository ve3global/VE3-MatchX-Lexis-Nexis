# 01: ER sources only when address verified

**Status:** done

**Blocked by:** None

In `src/modules/reports/actions/addressVerification.ts`'s `buildResponse`,
the `ER<year>` entries are generated only when `address_verified` is true.
NFI entries (when `config.nfi_address` is on) are unaffected, so an
unverified subject's `sources` is NFI-only or `[]`.

- [x] `address_verified` ⇔ ≥ 1 `ER<year>` source, with and without
      `nfi_address` (`tests/unit/address-verification.test.ts`, 400 seeds)
- [x] Verified subjects keep 3–8 ER sources (unchanged)
- [x] MatchX's rule (`address_verified` 10/0) scores 10 with ER sources, 0
      without
- [x] End to end via `POST /reports/{id}/actions/address-verification`
      (`tests/integration/report-actions.test.ts`)
- [x] No other attribute or score changes
