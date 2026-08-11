# EPIC-7c: Remaining report actions — Spec

See [constitution.md](../../constitution.md) — this epic has no ticket
number (doc-derived only, per the constitution's ticket → epic map,
"confirm before implementing"). Per the user's explicit direction this
session, implemented best-effort with every assumption flagged, same as
EPIC-7a/7b.

> **Superseded in part by EPIC-12** (phase 2): once the remote-check
> lifecycle sub-resource's evidence made clear it's genuinely stateful,
> `remote-check`'s synchronous design below was revised — see
> [epic-12-remote-check-lifecycle/spec.md](../epic-12-remote-check-lifecycle/spec.md#supersedes-epic-7cs-original-remote-check-design).
> Every other action in this epic is unaffected.

## Actions covered (15)

`bank-account-validation`, `bank-account-verification`,
`death-screening`, `driving-licence-validation`, `email-risk`,
`nfi-amberhill`, `ni-number-validation`, `otp-email`,
`otp-email-verification`, `otp-sms`, `otp-sms-verification`,
`passport-validation`, `phone-match`, `phone-number-validation`,
`remote-check`.

## User story

As an API consumer running a report, I want financial-instrument, identity
-document, and contact-verification checks (bank account, driving
licence, NI number, passport, email risk, phone, OTP send/verify, remote
identity-verification journey) so that I can verify a subject's
documents and contact details as part of onboarding.

## Acceptance criteria

- `death-screening` produces the exact `death_ddri`/`death_gro`/
  `death_halo` attributes confirmed ahead of this epic, and honors the
  documented QA override: dob `"1900-01-01"` forces all three `true`
- `bank-account-validation`/`bank-account-verification` both take
  `{bank_details: {sort_code, account_number}}` (doc-confirmed shape,
  codes 1093-1098) — validation checks 6/8-digit format; verification
  additionally reflects the subject's own name (already on the report)
- `driving-licence-validation` takes `driving_licence_number` (codes
  1236-1239); `ni-number-validation` takes `ni_number` (1203-1204,
  1262); `passport-validation` takes `passport.mrz_line2.part1..part8`
  (1211-1233, all 8 required strings — the doc's own exact-length codes
  are skipped, see "Resolved conflicts")
- `email-risk` takes `emails: [{email, role?}]` (1105-1110), rejects
  duplicate addresses (1109)
- `phone-match` takes optional `telephone`/`extension`/`mobile` (at least
  one required); `phone-number-validation` takes required `phone_code`/
  `phone_number` with format validation (codes 1272-1276, 1341-1342)
- `otp-email`/`otp-sms` take an `email`/`phone_code`+`phone_number`
  respectively and return a replica-only `otp_code` field (see "Resolved
  conflicts"); `otp-email-verification`/`otp-sms-verification` take
  `code` and check it against the prior send — no prior send returns 422,
  doc code **1294** ("An OTP code must be generated first") verbatim
- `remote-check` runs synchronously to a deterministic PASS/FAIL (see
  "Resolved conflicts" — the doc's real lifecycle is async)
- Bank account number and NI number are masked on
  `GET /reports/{id}/input-data` (EPIC-4's endpoint, extended here); other
  fields (email, phone, passport, driving licence number) are echoed
  as-is

## Resolved conflicts

- **`otp_code` is a replica-only convenience field.** A real send-OTP
  response would never echo the code — this replica has no real inbox/
  SMS gateway for a caller to read it from, so returning it is the only
  way `otp-*-verification` is usable in tests at all. Never assumed by
  anything claiming doc parity; allowlisted in EPIC-8's drift check.
- **`remote-check` is synchronous, not async.** The doc models it (and
  the OTP actions) as inherently async with its own lifecycle sub-
  resource (cancel/resend/results/pdf) — explicitly deferred to phase 2
  (see constitution.md's "Explicitly deferred to phase 2" section).
  Modeling genuine async state without that sub-resource existing isn't
  meaningful, so this replica returns a deterministic result
  immediately. The doc's `PENDING` report status for these actions is
  consequently not reachable in this replica.
- **Passport MRZ exact-length codes (1213/1216/1219/1222/1225/1228/1231/
  1234) are not implemented.** The doc collapses the length placeholder
  ("must be X characters") and this replica has no confirmed real value
  to substitute for any of the 8 parts — required/string checks (codes
  1211-1212, 1214-1215, ...) are implemented; length is not, rather than
  guessing wrong.
- **`otp-sms`'s `phone_code`/`phone_number` required-codes (1284/1285)
  are distinct from `phone-number-validation`'s own pair
  (1272-1276/1341-1342)** — two different doc code clusters, kept as two
  separate schemas rather than shared, since sharing would misattribute
  one action's codes to the other.
- **Bank-account masking**: account number → last 4 digits; NI number →
  first 2 + last 1 character, rest masked. No masking rule is stated for
  passport/driving-licence/email/phone, so those are echoed unmasked.

## Out of scope

- The remote-check/otp-* lifecycle sub-resource (cancel/resend/results/
  pdf) — phase 2, per the original plan.
- Real UK driving-licence-number DOB decoding (the number embeds it) —
  `driving_licence_dob_match` is a seeded boolean gated only on whether a
  subject `dob` was given at all, not a real decode.
