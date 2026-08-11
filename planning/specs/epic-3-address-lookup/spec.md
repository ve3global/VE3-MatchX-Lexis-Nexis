# EPIC-3: Address Lookup — Spec

See [constitution.md](../../constitution.md) for shared principles and the
doc-vs-ticket precedence rule.

## Tickets covered

- **LN10** — Lookup addresses by postcode
- **LN11** — Search addresses by free-text query
- **LN12** — Fetch a single address by reference
- **LN13** — Validation of address-lookup input

## User stories

- **LN10**: As an API consumer, I want to find candidate addresses for a
  postcode, so that I can let a user pick their exact address without
  typing it in full.
- **LN11**: As an API consumer, I want to search addresses by a free-text
  query, so that I can support a single search box instead of a
  postcode-only flow.
- **LN12**: As an API consumer, I want to re-fetch one specific address by
  its reference, so that I can confirm the exact address a user selected
  before submitting it on a report.
- **LN13**: As an API consumer, I want malformed lookup input rejected with
  clear field-level errors, so that I can fix my request without guessing.

## Acceptance criteria

**LN10/LN11/LN13 (doc-compliant `POST /address-lookup`)**
- Accepts a structured lookup: `postcode` and/or `full_address`, with
  optional `house`/`street`/`town` refinements and `fuzzy`/`alias` boolean
  flags (see "Resolved conflicts" — the doc has no separate GET-based
  search endpoint)
- At least one of `postcode` or `full_address` must be given
- Returns a list of deterministic, fake candidate addresses — same input
  always returns the same candidates, in the same order
- Each candidate includes a `reference` usable to re-fetch that exact
  address later (extension field — see "Resolved conflicts")
- Malformed input (wrong type, over max length) returns 422 with
  field-level codes from `lib/errorCodes.ts` (1024-1035)
- The doc's sample subject's address (204 Julius Road, BS7 8EU) is
  special-cased so a lookup on that postcode reproduces the doc's own
  sample address as the first candidate

**LN12 (replica-only extension)**
- `GET /addresses/{reference}` returns the single address that `reference`
  encodes, with the exact same fields a lookup candidate has
- An unrecognized/malformed `reference` returns 404

**LN10/LN11 (replica-only convenience aliases)**
- `GET /addresses?postcode=...` — alias for the doc endpoint, postcode-only
- `GET /addresses/search?q=...` — alias for the doc endpoint, free-text
  (`q` maps to `full_address`)
- Both delegate to the exact same service/validation as
  `POST /address-lookup`, so results are identical either way

## Resolved conflicts

Full detail in [constitution.md](../../constitution.md#resolved-conflicts-reference-table);
summarized for this epic:

- **No `GET /addresses`-family in the doc.** The doc defines a single
  `POST /address-lookup`. LN10/LN11/LN12's GET-style routes are built as
  replica-only extension aliases delegating to the same
  `addressLookup/service.ts` — never assumed by anything claiming doc
  parity, allowlisted in EPIC-8's drift check.
- **Response shape is designed, not transcribed.** The doc never expands
  `POST /address-lookup`'s response schema, so this replica is free to
  choose a reasonable shape. We chose `{"data": [{reference, full_address,
  house, street, town, postcode}, ...]}`, matching the `data` envelope
  convention used doc-wide elsewhere (see reports/report-types/scorecards
  list responses).
- **`reference` is stateless, not a DB row.** It's a reversible encoding of
  the candidate's own fields (base64url JSON), not a randomly-generated ID
  requiring persistence — keeps the "deterministic, no hidden state"
  property of the rest of the fake-data engine, and means `GET
  /addresses/{reference}` never depends on a prior call having happened in
  this process.
- **"At least one of `postcode`/`full_address`" has no dedicated doc error
  code.** Codes 1024-1035 cover per-field type/length checks only; no
  "required when X is absent" code exists for this bare (non-`address.`-
  namespaced) field pair (that pattern — codes 1052-1054 — is reserved for
  the nested `address` object on report creation, EPIC-4). Per the EPIC-2
  precedent (client_id/client_secret with no dedicated code), this
  cross-field rule falls back to the doc's generic 1319 ("The request
  contains invalid parameters"). Flagged here as an inferred convention,
  same as EPIC-2's.

## Out of scope

- Any real geocoding/postal database — all results are deterministic fake
  data (see `lib/determinism.ts`).
- Persisting lookups or wiring address-lookup results into report creation
  (EPIC-4's concern).
