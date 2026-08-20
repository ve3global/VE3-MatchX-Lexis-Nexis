Status: ready-for-agent

# Accurate error handling for the internal demo: rate limiting + 3 Postman runs + name/address validation fix

## Problem Statement

Internal stakeholders need a live demo proving the LN-replica API handles and reports
errors exactly the way the real LexisNexis IDU portal would — not just that the happy
path works, but that rate-limiting and input-validation failures come back with the
right status codes and messages. Two gaps stood in the way:

1. The API had no rate limiting at all, so there was nothing to demo for "the product
   correctly throttles a client that calls too fast."
2. The reports API's inline-creation name and address fields don't enforce the real
   IDU input-validation rules (character rules from `IDU_REST_FAQs_Input_Validation
   (Aug26).pdf`, length limits) — so a "validation errors" demo request either
   wouldn't trigger a real error, or would trigger the wrong one, undermining exactly
   what the demo is supposed to prove.

## Solution

- A real per-client rate limiter (10 requests/second, replica-only extension) now
  exists and returns 429 when exceeded. **Already implemented and live-validated.**
- Three independent, standalone Postman "Run" folders exist for the live demo: Happy
  Path (zero errors), Rate Limit 429, and Validation Errors — each acquiring its own
  token, runnable on its own via Collection Runner or Newman. **Already implemented
  and live-validated.**
- The reports API's inline-creation name fields (`forename`/`middlename`/`surname`)
  and address fields (`address1`–`address5`, `postcode`) will be corrected to enforce
  the real IDU character-set and length rules, returning the real doc-transcribed
  error codes (1286/1287/1288 for name-character violations) instead of silently
  accepting invalid data. **Not yet implemented — this is the remaining work.**
- Run 3's validation-error demo request will be updated to exercise a realistic bad
  name, not just a missing-field case, so the demo genuinely proves accurate error
  parity with the real LN portal. **Not yet implemented.**

## User Stories

1. As an internal stakeholder watching the demo, I want to see a clean end-to-end happy-path run with zero errors, so I trust the core product works.
2. As an internal stakeholder, I want to see the API reject too-frequent calls from the same client with a 429, so I know the product protects itself the way a real integration partner would expect.
3. As an internal stakeholder, I want to see the API reject bad input data with the specific error codes the real LN portal would return, so I know a client integrating against this replica gets accurate error-handling practice.
4. As a developer building against this replica, I want `POST /reports`'s `forename`/`middlename`/`surname` fields to reject digits, symbols, emoji, and malformed separators (leading/trailing/consecutive hyphens, apostrophes, spaces), so my integration tests against this replica catch the same bugs the real API would catch.
5. As a developer, I want name-field character violations to return the real doc-transcribed codes (1286 forename, 1287 surname, 1288 middlename), so error-handling code written against this replica also works against the real IDU API.
6. As a developer, I want `forename`/`middlename`/`surname` to enforce a 64-character max (not the current 255), matching the real API's limit.
7. As a developer, I want the report's embedded `address1`–`address5` fields to enforce a 64-character max, matching the real API's limit.
8. As a developer, I want the report's embedded `address.postcode` field to enforce an 8-character max, matching the real API's limit.
9. As a developer, I want Unicode letters (accented Latin, Cyrillic, Arabic, Hebrew, Greek, CJK) to be accepted in name fields without normalization, matching the real API's documented behavior.
10. As a developer, I want a single ASCII apostrophe, single ASCII hyphen, and single space to be accepted in name fields, but never consecutively or at the start/end of the field.
11. As an API client, I want smart/curly apostrophes and en/em dashes to be rejected (not silently treated as equivalent to ASCII apostrophe/hyphen), matching the real API's stricter-than-visually-similar behavior.
12. As an operator running the live demo, I want the 3 demo runs to be independently runnable in the Postman GUI or via Newman, each fetching its own token, so I can run them in any order (just not chained back-to-back without a pause).
13. As an operator, I want clear documentation that the 3 runs share rate-limit state on one client and must not be executed back-to-back with zero gap, so I don't accidentally get contaminated results.
14. As an operator, I want the rate limiter's 429 response body to include a human-readable message and `retry_after_seconds`, so I can explain the behavior live without needing to look at code.
15. As a developer, I want the rate limiter to be automatically skipped when running the automated Vitest suite (`NODE_ENV=test`), so the existing rapid-fire integration tests don't need to change.
16. As a developer maintaining this replica, I want the rate limiter documented as a replica-only extension with no basis in the real IDU doc (aside from an unrelated 429 mention on the remote-check resend endpoint), so nobody mistakes it for a transcribed doc requirement.
17. As a developer, I want Run 3's "data validation" Postman request to send a realistic malformed name (e.g. consecutive apostrophes, or a leading hyphen) rather than only a missing-required-field case, so the demo actually exercises the newly-accurate character-validation logic.
18. As a developer, I want automated tests covering both acceptance cases (Unicode names, hyphenated/apostrophe'd names) and rejection cases (digits, symbols, leading/trailing/consecutive separators, smart quotes, en/em dashes, over-length) for the name and address fields.
19. As a QA engineer, I want the existing full test suite to remain green after these changes, aside from the pre-existing, already-tracked webhooks/doc-parity failures tied to the separate epic-10 migration work.

## Implementation Decisions

- **Modules touched**: `src/middleware/rateLimiter.ts` (new — done), `src/app.ts` (wiring — done), `src/modules/reports/schema.ts` (name/address validation — pending), `scripts/generate-postman-collection.ts` (3 demo-run folders — done; Run 3's bad-name request — pending update).
- **Rate limiter** (done): real Express middleware (`express-rate-limit`), 10 requests/second per client, fixed 1-second window, keyed by `req.client.id`, mounted after the `auth` middleware (so `req.client` is always resolved) and before the business routers. `/up` and `/oauth/token` are exempt, consistent with their existing exemption from bearer auth. Skipped entirely when `NODE_ENV=test` (Vitest sets this automatically) so the automated suite is unaffected. 429 response body: `{message, retry_after_seconds}` — no fabricated doc-style numbered code, since this extension has no real doc basis.
- **Postman demo structure** (done): 3 standalone top-level folders (`Run 1 - Happy Path (Demo)`, `Run 2 - Rate Limit 429 (Demo)`, `Run 3 - Validation Errors (Demo)`), each with its own `POST /oauth/token` step, generated by `scripts/generate-postman-collection.ts` (single source of truth, regenerated via `npm run postman:generate`). All three authenticate as the same single `demo-client` — no separate seeded clients. Documented operational rule: run one folder at a time, not chained with zero gap, since rate-limit state is real and shared per client — a deliberate trade-off, not a bug to engineer around.
- **Name-field validation** (pending): add a regex to `forename`/`middlename`/`surname` in `createReportSchema` matching the IDU FAQ's rule — Unicode letter categories plus a single ASCII apostrophe/hyphen/space, never leading/trailing, never consecutive. Change max length from 255 to 64. Wire zod's `invalid_string` failures to the existing doc-transcribed codes 1286 (forename)/1287 (surname)/1288 (middlename) in `CREATE_REPORT_ERROR_CODES` (currently only `string`/`max` rule types are mapped for these fields; add the `invalid` rule type).
- **Address-field length fix** (pending): change `address1`–`address5` max from 255 to 64, and `address.postcode` max from 255 to 8, within `createReportSchema`'s embedded `addressSchema`. Existing error codes (1131–1136 for max-length, 1021 for postcode string-type) stay the same — only the numeric length constraint changes.
- **Explicitly not touched**: `addressLookup/schema.ts`'s own `postcode`/`full_address`/`house`/`street`/`town` fields — those belong to the address-lookup *search* endpoint (EPIC-3), a different context from the report's structured address-submission fields the FAQ describes. No evidence found that EPIC-3's existing lengths are wrong.
- **Run 3 Postman update** (pending): replace or augment the existing "missing required fields" request with one submitting a realistic malformed name (e.g. `"O''Connor"` with consecutive apostrophes, or `"-Smith"` with a leading hyphen), asserting the specific 1286/1287 code, so the demo showcases the new, doc-accurate validation.

## Testing Decisions

- **Seam**: HTTP-level integration tests via `supertest` against `createApp()` — the one seam already used by every existing integration test in this repo (`tests/integration/*.test.ts`). No new seam needed; the pending validation fix is tested the same way: `POST /reports` with a deliberately malformed `forename`/`surname`/`address` field, asserting the response status and the specific numbered error code in `res.body.errors`.
- **What makes a good test here**: assert observable HTTP behavior (status code + specific error code in the response body), not implementation details like the exact regex used internally.
- **Modules to test**: `src/modules/reports/schema.ts` / `src/modules/reports/routes.ts`, via `tests/integration/reports.test.ts` (existing file, add cases).
- **Prior art**: `tests/integration/reports.test.ts`'s existing "rejects an inline report missing required fields" test (asserts specific numbered codes per field) is the direct template for the new character-rule and length-limit rejection tests. `tests/integration/report-types.test.ts`'s username-filter/order-by tests (added this same session) follow the identical pattern.
- **Acceptance-side coverage**: at least one test confirming a name with an accented/Unicode letter, a single hyphen, and a single apostrophe is still accepted — not just rejection-side coverage — so the fix doesn't overcorrect into rejecting valid real-world names.
- **Full-suite regression**: re-run `npx vitest run` after the change; the only acceptable failures are the pre-existing, already-tracked webhooks/doc-parity ones (tied to the separate, not-yet-migrated epic-10 rebuild) — anything else is a real regression.
- **Live validation**: re-run the "Run 3" Postman folder via Newman against a live `npm run dev` instance (as already done for the rate limiter and the other two runs) to confirm the updated bad-name request behaves correctly outside the automated suite too.

## Out of Scope

- Renaming `credit-check` → `credit-active` (tracked separately in `planning/api-drift-remediation.md`'s EPIC-7 slug-mismatch list) — used as-is in the demo.
- The epic-10 webhooks rebuild's pending migration and the users/notifications/remote-check-lifecycle path-drift items — pre-existing, tracked separately, not part of this effort.
- Separate seeded client identities for isolating the 3 demo runs from each other — explicitly decided against; a single shared `demo-client` plus a documented "don't chain them" rule is the chosen trade-off.
- Fabricating a doc-style numbered error code for the 429 rate-limit response — decided against, since the real doc has no such code for this replica-only extension.
- Address-lookup module's (EPIC-3) own field-length constraints — out of scope; no evidence they're wrong, and they serve a different purpose (search query, not structured address submission).
- Unicode normalization of name fields — explicitly not applied, matching the real API's documented behavior (characters accepted as submitted).

## Further Notes

- The rate limiter and the 3 Postman demo-run folders are **already implemented and live-validated**: Newman confirmed Run 1 clean end-to-end, Run 2 clean in isolation (31/31 assertions: calls 1–10 succeed, 11–20 come back 429), and the full Vitest suite sits at 129/137 (the 8 failures being the pre-existing, tracked webhooks/doc-parity gaps unrelated to this work). The remaining work is specifically the name/address validation-accuracy fix and the Run 3 content update described above.
- Source documents behind the validation rules: `IDU_REST_API_Documentation.pdf` (primary spec, already this project's source of truth per `planning/constitution.md`) and `IDU_REST_FAQs_Input_Validation (Aug26).pdf` (explanatory FAQ — explicitly not a substitute for the main spec, used here only for the concrete rule details it makes explicit). The doc-transcribed numbered codes 1286/1287/1288 were independently confirmed already present in this repo's own `src/lib/errorCodes.ts`, so this is filling in missing wiring, not inventing codes.
- This repo's own convention (`planning/constitution.md`, `planning/api-drift-remediation.md`) is ticket-by-ticket delivery — this spec is scoped to be picked up as a single, well-bounded ticket via `/to-tickets`, not split further.
