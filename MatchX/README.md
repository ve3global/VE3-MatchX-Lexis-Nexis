# MatchX — LexisNexis capture reference

Endpoints, request payloads, and response payloads exactly as given in the
source capture (`API payload and response.json`, 2026-09-10), one file per
endpoint. This is a raw reference snapshot of the doc — it is not this
repo's own implementation, which is the LN Replica itself (see
`../planning/api-drift-remediation.md` for the alignment work done against
this same capture).

The one deliberate change from the source doc: the `/oauth/token` sample's
live `access_token` JWT value has been redacted, matching this repo's
existing convention of not committing captured sandbox tokens (see
`../planning/api-drift-remediation.md`'s 2026-09-03 entry). Everything
else — payload/response shapes, field values, formatting quirks, and the
doc's own inline comments — is reproduced verbatim.

- [01 — OAuth token generation](01-oauth-token.md)
- [02 — Address lookup](02-address-lookup.md)
- [03 — Report: address verification](03-reports-address-verification.md)
- [04 — Report: credit activity](04-reports-credit-activity.md)
- [05 — Scorecards](05-scorecards.md)
- [06 — Report action: address-verification (NFI/pension source)](06-reports-address-verification-action.md)
- [07 — Report: pension source (dedicated scorecard)](07-reports-pension-source.md)
