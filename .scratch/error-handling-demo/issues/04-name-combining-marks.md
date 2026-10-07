# 04: Accept combining marks in name fields

**Status:** needs-triage

**Blocked by:** None

**Bug:** `NAME_RE` (`src/modules/reports/schema.ts`) only matches `\p{L}`, so
any name containing a Unicode combining mark (`\p{M}`) fails with
1286/1287/1288. Pre-existing — surfaced by the spec review of
`03-name-mixed-separators.md` (PR #37), not caused by it.

Verified against the current regex:

| Input | Form | Result |
|---|---|---|
| `José` | precomposed `é` (U+00E9) | accepted |
| `José` | `e` + U+0301 combining acute | **rejected** |
| `Nguyễn` | `e` + U+0302 + U+0303 | **rejected** |
| `नमस्ते` | Devanagari, vowel signs/virama are `\p{M}` | **rejected** |

Decomposed (NFD) input is common from macOS file names and some keyboards;
for Indic, Thai, Arabic-with-harakat, etc. combining marks are unavoidable,
so whole scripts are currently unusable.

This conflicts with spec story 9 ("Unicode letters … accepted in name fields
without normalization") and the IDU FAQ ("Unicode letter categories are
accepted"; no normalization). Because we don't normalize, a precomposed and a
decomposed spelling of the same name get different results today.

**Proposed fix:** treat a letter as `\p{L}\p{M}*` — a base letter followed by
any combining marks — wherever the pattern uses `\p{L}`. A name still must
start with a letter (a leading bare combining mark stays rejected), and the
separator rules from ADR-0001 are unchanged. No normalization is added.

**Open questions for triage:**
- Does the 64-character max count code points (current `z.string().max` →
  UTF-16 code units) or grapheme clusters? The FAQ says "characters"; a
  decomposed name is longer in code points than its precomposed twin.
  Possibly a separate ticket.
- No sandbox access to confirm real IDU accepts `\p{M}` — evidence is the
  FAQ wording only (same caveat as ADR-0001).

- [ ] Accept `José`, decomposed `Nguyễn`, `नमस्ते` in
      forename/middlename/surname
- [ ] Still reject a name starting with a combining mark (e.g. `́Jose`)
- [ ] Existing separator, smart-quote/en-em-dash, and Unicode tests
      unchanged and green
