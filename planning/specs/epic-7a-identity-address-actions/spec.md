# EPIC-7a: Identity & Address actions — Spec

See [constitution.md](../../constitution.md) for shared principles and the
doc-vs-ticket precedence rule, and
[lib/reportActions.ts](../../../src/lib/reportActions.ts)'s derivation
comment for how this epic's 6 action names were confirmed without the
source PDF (per the user's explicit "best-effort, clearly flagged"
direction for EPIC-7 as a whole).

## Tickets covered

LN32, LN33, LN34, LN35, LN36, LN39 — mapped one-to-one, in the order
found, against this epic's 6 confirmed action names:

- **LN32** — address-verification
- **LN33** — dob-verification
- **LN34** — age-verification
- **LN35** — nfi-address
- **LN36** — property-register-search
- **LN39** — address-insights

This ticket-to-action mapping is itself inferred (the ticket numbers are
confirmed from constitution.md's epic map; which specific ticket is which
specific action is this replica's own reasonable ordering, not doc-
confirmed) — flagged the same way the action names themselves are.

## User story

As an API consumer running a report, I want identity- and address-related
checks (does this address check out, is the date of birth plausible and
verifiable, is this address on the NFI/property register, what insights
exist about it) so that I can assess a subject's identity and residency
without manually cross-referencing multiple external services.

## Acceptance criteria

- Each action is runnable via `POST /reports/{id}/actions/{action}` and,
  where its request schema accepts an empty body, automatically at
  `POST /reports` when listed in a report type's `primary_actions`
  (EPIC-4's mechanism, populated here)
- `address-verification` and `dob-verification` produce the exact
  attribute names EPIC-1's seed scorecard already assumes
  (`address_verified`, `dob_verified`, `dob_count`) plus a representative
  subset of additional `address_*` fields (doc hints ~25 total; see
  "Resolved conflicts")
- `age-verification` derives its result from the subject's actual `dob`
  when present (age between 18 and 115), not a pure coin flip
- `nfi-address`, `property-register-search`, `address-insights` each
  produce a small set of seeded, deterministic attributes with a
  documented bias
- Every result is deterministic: the same subject always produces the
  same output, across separate reports and repeated runs (verified in
  tests/integration/report-actions.test.ts)

## Resolved conflicts

- **Action names**: see lib/reportActions.ts's derivation comment —
  `address-insights` (error code 1180), `age-verification` (1120),
  `nfi-address` (1253, distinct from `nfi-amberhill`/1254),
  `property-register-search` (1266).
- **`address-verification`'s attribute list is a representative subset,
  not the doc's full ~25.** Only the count is confirmed; the specific
  remaining ~15 names are not. Implemented: `address_verified`, `address_matched`,
  `address_current`, `address_previous_count`, `address_first_seen_years`,
  `address_electoral_roll`, `address_nfi_match`, `address_council_tax`,
  `address_confidence_score`, and `address_full_er_match` (gated on the
  doc-confirmed `full_er` request field, code 1046).
- **Bias**: `address_verified`/`dob_verified` default true ~95%
  (constitution.md's determinism section, doc-confirmed); everything else
  in this epic uses this replica's own reasonable default, documented
  per-attribute in each module under
  [modules/reports/actions/](../../../src/modules/reports/actions/).

## Out of scope

- The remaining ~15 unconfirmed `address_*` attribute names.
- Per-action permission/enablement checks (doc code family
  1039/1152-1153) — no multi-tier access model exists in this replica.
