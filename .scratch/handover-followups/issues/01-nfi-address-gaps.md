# 01: NFI address-source gaps in address-verification

**Status:** needs-triage

**Blocked by:** None

Found while tracing how `config.nfi_address` works
(`src/modules/reports/actions/addressVerification.ts`). Three independent
inconsistencies:

1. **`address_nfi_sources` isn't the count of matched sources.** It's its own
   random draw (`int(s('nfi_sources'), 0, 5)`, line ~135), although the
   comment above `NFI_SOURCES` says it is "just their match count". A
   response can list 2 `NFI_*` entries in `sources` and report
   `address_nfi_sources: 5`. Likely fix: derive it from the gated boolean
   attributes after they're drawn.
2. **`address_personal_budgets` never produces a source.** It's one of the 17
   gated attributes but has no entry in `NFI_SOURCES` (16 entries), so it can
   be `true` with no matching `NFI_PERSONAL_BUDGETS` source, and it has no
   label in `src/scoring/engine.ts`'s `REASON_LABELS`. Needs a decision: no
   capture shows its source code/description, so either design one (flagged
   as such) or document the omission.
3. **The account-level NFI switch isn't enforced.** `PATCH /users/options`
   stores `nfi_address` / `config.nfi_address`, but nothing reads them when a
   report runs — any client can pass `config.nfi_address: true`. The doc has
   "setting you do not have permission to use" codes (e.g. 1161 for
   `full_er`); whether one applies to `nfi_address`, and whether real IDU
   enforces it per account, is unconfirmed (no sandbox access).

- [ ] `address_nfi_sources` equals the number of `NFI_*` entries in `sources`
- [ ] `address_personal_budgets` either produces a source + reason label or
      the omission is documented
- [ ] Decision recorded on account-level enforcement (implement, or note as
      a known gap in `planning/constitution.md`)
