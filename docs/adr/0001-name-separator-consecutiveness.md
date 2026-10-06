# 0001: "Consecutive" name separators means the same separator repeated

**Status:** Accepted (2026-10-05)

## Context

`POST /reports` validates `forename`/`middlename`/`surname` against the IDU
name-character rules in `IDU_REST_FAQs_Input_Validation (Aug26).pdf`. The
FAQ is internally inconsistent on adjacent *different* separators:

- Its rule tables say "Consecutive spaces, consecutive hyphens, and
  consecutive apostrophes are rejected", and every rejected example repeats
  one separator (`Joh--n`, `O''Connor`, double space).
- Its closing "Simple rule" says names may contain "single spaces, single
  ASCII hyphens (-), and single ASCII apostrophes ('), but no consecutive
  separators".

The replica originally took the strict reading (no two separators of any
kind adjacent). That rejected `Johnson- Kerr` with 1287, which surfaced in
MatchX's Address Verification pending-record export as a false "surname
contains invalid characters".

## Decision

Follow the rule tables: a separator may not be immediately followed by the
**same** separator. Mixed runs of any length are accepted (`Johnson- Kerr`,
`Smith - Jones`, `D'-Arcy`). Names must still start and end with a Unicode
letter.

## Evidence

Text of the FAQ only. No sandbox capture was possible — we have no access to
the real IDU sandbox to test a mixed-separator name.

## Consequences

- The replica is now more permissive than the strict reading; if real IDU
  is strict, clients tested against the replica could see 1286/1287/1288 in
  production for mixed-separator names.
- **Reopen trigger:** if a sandbox or production capture shows a
  mixed-separator name rejected, supersede this ADR and restore the strict
  rule.
