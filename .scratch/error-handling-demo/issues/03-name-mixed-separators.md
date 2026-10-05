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

- [x] Accept `Johnson- Kerr`, `Johnson -Kerr`, `O' Brien`, `D'-Arcy`,
      `Smith - Jones`, `Johnson- -Kerr`
- [x] Still reject `Mary--Jane`, `O''Connor`, `John  Smith`, `-Smith`,
      `Smith-`, `Smith -` with the field-specific code (1287 for surname)
- [ ] Integration suite run green (blocked locally: DB not running at
      time of fix; regex verified standalone against the same cases)
