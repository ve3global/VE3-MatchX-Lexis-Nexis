# 02: QA override to force "not verified"

**Status:** needs-triage

**Blocked by:** 01

Today the only way to get an unverified address-verification result is to
try subjects until one lands in the ~5% `address_verified: false` bucket.
QA needs a predictable way to exercise MatchX's "address not verified"
path.

Proposal: a new QA override value (see `CONTEXT.md`, `src/lib/qaOverrides.ts`,
README "QA override values") — e.g. postcode `ZZ99 9ZZ` — that forces
`address_verified: false` and therefore no `ER<year>` sources (ticket 01).

Open questions:
- Which field/value? A postcode keeps forename/surname free for other
  overrides; `ZZ99` is the conventional UK dummy postcode area.
- This is a replica-only extension: document it in README and
  `planning/constitution.md` alongside the existing overrides.

- [ ] Override value forces `address_verified: false` and no ER sources
- [ ] Documented with the other QA override values
