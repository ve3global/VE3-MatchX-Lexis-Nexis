# 01: Fix name and address field validation in report creation

**What to build:** `POST /reports` (inline mode) should enforce the real IDU
API's validation rules for `forename`/`middlename`/`surname` and the embedded
`address` fields, so the replica rejects the same bad input the real LN
portal would reject — and accepts the same good input.

Name fields (`forename`, `middlename`, `surname`):
- Accept Unicode letters (accented Latin, Cyrillic, Arabic, Hebrew, Greek,
  CJK, etc.), a single ASCII apostrophe (`'`), a single ASCII hyphen (`-`),
  and a single space.
- Reject digits, symbols, punctuation (comma, period, slash, colon,
  semicolon), emoji, non-letter Unicode, smart/curly apostrophes, and
  en/em dashes.
- Reject a field that begins or ends with a hyphen, apostrophe, or space.
- Reject consecutive hyphens, consecutive apostrophes, or consecutive
  spaces anywhere in the field.
- Max length 64 characters (character-count basis, not bytes) — currently
  255.
- No Unicode normalization — characters are validated/stored as submitted.
- On a character-rule violation, return HTTP 422 with the existing
  doc-transcribed error code for that field: 1286 (forename), 1287
  (surname), 1288 (middlename). These codes already exist in the error
  code table but aren't currently wired to any validation rule.

Address fields (embedded in the report's `address` object):
- `address1`–`address5`: max length 64 characters — currently 255.
- `postcode`: max length 8 characters — currently 255.
- Existing error codes for these fields are already correct; only the
  numeric length constraint changes.

Out of scope for this ticket: the address-lookup module's own search-query
fields (`postcode`, `full_address`, `house`, `street`, `town`) — those are
a different context (address search, not structured address submission)
and aren't known to be wrong.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `forename`/`middlename`/`surname` reject digits, symbols, and
      punctuation with the correct field-specific code (1286/1287/1288)
- [ ] `forename`/`middlename`/`surname` reject a leading/trailing hyphen,
      apostrophe, or space
- [ ] `forename`/`middlename`/`surname` reject consecutive hyphens,
      apostrophes, or spaces
- [ ] `forename`/`middlename`/`surname` reject smart/curly apostrophes and
      en/em dashes
- [ ] `forename`/`middlename`/`surname` accept Unicode/accented letters, a
      single correctly-placed hyphen, and a single correctly-placed
      apostrophe (e.g. `O'Brien`, `Smith-Jones`, `García`) — acceptance-side
      coverage, not just rejection-side
- [ ] `forename`/`middlename`/`surname` reject a value over 64 characters
      and accept one at exactly 64
- [ ] `address1`–`address5` reject a value over 64 characters
- [ ] `address.postcode` rejects a value over 8 characters
- [ ] Full test suite (`npx vitest run`) stays green aside from the
      pre-existing, already-tracked webhooks/doc-parity failures
