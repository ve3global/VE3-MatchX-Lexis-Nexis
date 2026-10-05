# 03: Accept mixed adjacent separators in name fields

**Status:** resolved

**Blocked by:** None

**Bug:** MatchX's Address Verification pending-record export flagged surname
`Johnson- Kerr` with 1287 "The surname contains invalid characters". Hyphens
were always accepted — the trigger was a hyphen followed by a space, which
`NAME_RE` treated as consecutive separators.

**Decision:** "Consecutive" means the same separator repeated; mixed runs of
any length are accepted. See `docs/adr/0001-name-separator-consecutiveness.md`.
Corrects the rule from `01-name-address-validation.md`.

- [x] Accept mixed runs (`Johnson- Kerr`, `D'-Arcy`, `O' Brien`, `Smith - Jones`,
      `Johnson- -Kerr`) across forename/middlename/surname
- [x] Reject a trailing mixed run (`Smith -`) or a repeat inside one
      (`Mary- --Jane`) with 1286/1288/1287; existing `--`/`''`/double-space
      and leading/trailing tests unchanged
- [x] Integration suite run green (241/241, 2026-10-05)
