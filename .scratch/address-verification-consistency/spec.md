Status: open

# Address verification: keep `address_verified` consistent with its sources

## Problem

`address-verification` drew `address_verified` (95% true) independently of
the Electoral Register sources, which were always returned (3–8 `ER<year>`
entries). ~5% of subjects showed ER sources in the response yet scored the
scorecard's `no_match_score` on `address_verified` — 0 instead of 10 on
MatchX's scorecard (`MatchX/05-scorecards.md`). Every real capture
(`MatchX/03`, `06`, `07`) shows `verified: true` with ER sources and the
rule scoring 10.

## Decisions (2026-10-07)

- Scores stay scorecard-driven; the fix is in the attribute/response, not
  the engine. The "10" is MatchX's `match_score`, not a replica constant.
- `address_verified` is true ⇔ the response has ≥ 1 `ER<year>` source.
  Verified subjects are unchanged; unverified ones lose their ER entries.
- Only `ER<year>` entries count — NFI sources don't verify an address.
- Only `address_verified` changes. `address_current_er`,
  `address_historic_er`, gone-away flags, `address_found` and the
  first/last-seen dates keep their current behaviour and scores.
- No capture shows an unverified response, so its shape is unconfirmed.

| # | Ticket | Status |
|---|---|---|
| 01 | [ER sources only when address verified](issues/01-er-sources-only-when-verified.md) | done |
| 02 | [QA override to force "not verified"](issues/02-qa-override-not-verified.md) | needs-triage |
