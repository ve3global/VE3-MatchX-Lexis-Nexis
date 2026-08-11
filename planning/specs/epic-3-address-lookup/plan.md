# EPIC-3: Address Lookup — Plan

## New shared lib: `lib/determinism.ts`

First consumer of the determinism engine described in
[constitution.md](../../constitution.md#determinism-engine). Exports:

- `seedFrom(...parts: string[]): number` — FNV-1a 32-bit hash of
  `parts.join('|')`, lower-cased and trimmed per part. Same parts always
  hash to the same number, on any machine, any run.
- `subSeed(seed: number, salt: string): number` — derives an independent
  child seed for one attribute/purpose off a root seed, so e.g. an
  address's "town" pick and its "house number" pick don't correlate.
- `chance(seed: number, probability: number): boolean` — seeded coin flip
  at the given probability, via a `mulberry32` PRNG stepped once from
  `seed`.
- `pick<T>(seed: number, items: T[]): T` — seeded deterministic choice from
  a list.
- `int(seed: number, min: number, max: number): number` — seeded
  deterministic integer in `[min, max]` inclusive.

No randomness source (`Math.random`) anywhere in this module or its
callers — everything traces back to `seedFrom`'s inputs.

## `POST /address-lookup` (doc-compliant)

Request:
```json
{
  "postcode": "string?",
  "full_address": "string?",
  "house": "string?",
  "street": "string?",
  "town": "string?",
  "fuzzy": "boolean?",
  "alias": "boolean?"
}
```
Zod schema + refinement: `postcode` or `full_address` required (one of);
violation → 422, code 1319 on a synthetic `_` field (see spec.md's
"Resolved conflicts"). Per-field type/length codes: `full_address`
1024/1025, `house` 1026/1027, `street` 1028/1029, `town` 1030/1031,
`postcode` 1032/1033, `fuzzy` 1034, `alias` 1035.

Success (200):
```json
{
  "data": [
    {
      "reference": "<base64url>",
      "full_address": "10 Example Street, Sometown, AB1 2CD",
      "house": "10",
      "street": "Example Street",
      "town": "Sometown",
      "postcode": "AB1 2CD"
    }
  ]
}
```

### Candidate generation (`addressLookup/service.ts`)

1. `root = seedFrom(postcode ?? '', full_address ?? '', house ?? '', street ?? '', town ?? '')`.
2. **Doc parity special-case**: if the normalized postcode is `bs78eu` (or
   `full_address` normalizes to contain `julius road`), the first candidate
   is always `204 Julius Road, Bristol, BS7 8EU` — mirrors the doc's own
   sample subject's address so anyone pasting the PDF's example gets the
   PDF's own result back.
3. `count = int(root, 1, 4)` additional/total fake candidates (special-case
   counts toward this total when present).
4. Each candidate's fields are filled from whichever inputs were given
   (echoed verbatim if the caller supplied `house`/`street`/`town`) and
   deterministically generated via `subSeed`/`pick`/`int` off small
   built-in word lists (street name parts, town names) for anything not
   supplied — no external data files.
5. `full_address` is either the caller's own `full_address` (echoed) or
   composed as `"{house} {street}, {town}, {postcode}"`.
6. `reference = base64url(JSON.stringify({house, street, town, postcode}))`
   — reversible, no storage.

### `GET /addresses/{reference}` (extension, LN12)

Decode `reference` as base64url JSON; on decode/shape failure → 404 (not
422 — this isn't a validation of caller input shape so much as "resource
not found" semantics for an opaque ID, consistent with how the doc treats
unknown IDs elsewhere). On success, re-derive the same candidate fields via
the same generation function (steps 4-5 above), keyed off the decoded
values, and return `{"data": {...}}` (singular, not a list).

### `GET /addresses` and `GET /addresses/search` (extensions, LN10/LN11)

Thin controllers translating query params into the same request shape and
calling the same `lookupAddresses()` service function as the POST route:
- `GET /addresses?postcode=X` → `{postcode: X}`
- `GET /addresses/search?q=X` → `{full_address: X}`

Both run through the identical Zod schema/refinement and return the
identical `{"data": [...]}` shape as the doc endpoint — genuinely the same
code path, not a reimplementation.

## Routing

New `src/modules/addressLookup/routes.ts` mounted in `app.ts` **after**
`app.use(auth)` (protected route, unlike `/up` and `/oauth/token`).

## Verification

1. `POST /address-lookup` with `{postcode: "BS7 8EU"}` twice → identical
   response both times (determinism).
2. `POST /address-lookup` with `{postcode: "BS7 8EU"}` → first candidate is
   `204 Julius Road, Bristol, BS7 8EU` (doc parity).
3. `POST /address-lookup` with `{}` → 422, error on a `_`/cross-field key,
   code 1319.
4. `POST /address-lookup` with `{postcode: 123}` (wrong type) → 422, code
   1032 for `postcode`.
5. `GET /addresses?postcode=BS7%208EU` → same `data` array as the POST
   equivalent.
6. `GET /addresses/search?q=Julius%20Road` → same candidate for the doc
   sample.
7. Take a `reference` from a lookup response, `GET /addresses/{reference}`
   → same fields as that candidate.
8. `GET /addresses/not-a-real-reference` → 404.
