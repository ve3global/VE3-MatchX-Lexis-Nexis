# LN Replica — Constitution

Shared principles for every epic/ticket spec under `planning/specs/`. This
superseded `planning/phase-1-core-plan.md`, which was kept as an
architecture reference until the SDD spec set (epic-1 through epic-8, all
phase-1 epics) fully covered its content — now removed.

## Purpose

A local replica of the LexisNexis IDU REST API (identity verification / AML /
fraud checks), since LexisNexis provides no sandbox. The team's application
points at this replica during development and in automated tests instead of
the real service. Source of truth: `IDU_REST_API_Documentation.pdf` (91
pages, OpenAPI-generated), read in full.

## Precedence rule: doc vs. ticket

Tickets (LN1-LN61) describe the desired features, but several were written
against generic REST/OAuth conventions that don't match the actual documented
LexisNexis wire contract. Because the entire point of this project is a
faithful replica — so the team's real integration isn't surprised in
production — conflicts resolve as:

1. **Doc wins on wire format.** Paths, HTTP methods, status codes, and
   error-body shapes always follow the doc verbatim. A ticket's *intent* is
   preserved but implemented through the doc's real shape, not a
   differently-shaped endpoint invented to match the ticket's wording.
2. **Features genuinely absent from the doc** (not differently shaped —
   entirely missing) are built as clearly-labeled **replica-only
   extensions**: additive, non-breaking, never replacing a documented
   field/response with something a real integration wouldn't see. Every such
   extension is called out explicitly in its epic's `spec.md` under
   "Resolved conflicts" so it's never mistaken for documented behavior.

### Resolved conflicts (reference table)

| Area | Ticket said | Doc actually says | Resolution |
|---|---|---|---|
| Auth token body | `grant_type=client_credentials` | `{client_id, client_secret}` only | Doc shape; no `grant_type` field |
| Auth 401 body | `{"error":"invalid_client"}` | `{"message":"Unauthenticated"}` (every 401 in doc) | Doc shape verbatim |
| Validation status | HTTP 400 (LN5, LN7, LN10, LN11, LN13) | Always `422`, never `400`, doc-wide | 422 everywhere |
| Token revocation | Revoke endpoint + `error=token_expired`/`token_revoked` in body (LN9) | No revoke/refresh endpoint; single generic 401 | Keep doc's `{"message":"Unauthenticated"}` as the body real consumers see; **add** a non-doc `reason` field (`invalid_token`\|`token_expired`\|`token_revoked`\|`missing_token`) for the team's own tests/logs; add `POST /oauth/token/revoke` as a labeled extension endpoint |
| Address lookup | `GET /addresses?postcode=`, `GET /addresses/search?q=`, `GET /addresses/{reference}` (LN10-12) | Single `POST /address-lookup`, body = house/street/town OR postcode | Doc's `POST /address-lookup` is primary; response schema is never expanded in the doc, so we're free to design a reasonable shape (incl. a `reference` field). LN10/11/12's GET-style routes become extension convenience aliases delegating to the same service — allowlisted in the EPIC-8 doc-parity check |
| Reports list envelope | `total_count/page/page_size` (LN16) | Laravel `{data, links, meta}` (doc-wide, shared with report-types/scorecards) | Doc shape; shared `lib/pagination.ts` |
| Reports delete | "soft-delete" (LN17) | `DELETE` → `204`, no body | Soft-delete internally (`deletedAt`), externally indistinguishable — subsequent `GET` still 404s |
| Report-type update verb | "PUT/PATCH" (LN22) | `PATCH` only | `PATCH` |
| Report-type duplicate name | HTTP 409 (LN20) | No `409` anywhere in the doc; uniqueness is a validation rule like any other | `422` + a transcribed error code from the 1000-1348 table |
| Report-type active/inactive (LN20/23/24) | Explicit lifecycle + reactivation | No such field on report-type response | Extension: additive `status: ACTIVE\|INACTIVE`; `DELETE` still returns doc's `204`; reactivation via labeled extension endpoint `POST /report-types/{id}/reactivate` |
| Scorecard status/version (LN25-29) | draft/published/retired + versioning | No `status`/`version` field on scorecard response | Extension: additive `status`/`version` fields; enforcement layered into report-type create/update validation |
| Scorecard delete-while-attached | LN28: "assigning a retired scorecard returns 400" | Doc: `DELETE` on an attached scorecard returns **422** (error 1241) | Implement doc's 422-on-attached-delete verbatim; retired/reassign rule is a separate extension check |
| EPIC-8 doc-parity check (LN61) | "parses the published API spec (OpenAPI)" | We only have a rendered PDF, not a raw OpenAPI file from LexisNexis | Generate our own OpenAPI spec from the replica's route/schema definitions and drift-test that against live routes in CI; the one-time human cross-check against the actual PDF stays a manual step |

## Ticket → epic map

- **EPIC-1 Project Foundation**: LN1, LN4, LN5
- **EPIC-2 Auth**: LN7, LN8, LN9
- **EPIC-3 Address Lookup**: LN10, LN11, LN12, LN13
- **EPIC-4 Reports Core**: LN14, LN15, LN16, LN17, LN18, LN19
- **EPIC-5 Report Types**: LN20, LN21, LN22, LN23, LN24
- **EPIC-6 Scorecards & Scoring Engine**: LN25, LN26, LN27, LN28, LN29, LN30, LN31
- **EPIC-7a Identity & Address actions**: LN32, LN33, LN34, LN35, LN36, LN39
- **EPIC-7b Financial & Screening actions**: LN43, LN44, LN45, LN46, LN48, LN49
- **EPIC-7c Remaining report actions** *(no ticket in the provided set — doc-derived only, confirm before implementing)*: bank-account-validation, bank-account-verification, death-screening, driving-licence-validation, email-risk, nfi-amberhill, ni-number-validation, otp-email, otp-email-verification, otp-sms, otp-sms-verification, passport-validation, phone-match, phone-number-validation, remote-check
- **EPIC-8 Integration & Documentation**: LN61

Recommended build order (dependency-driven, not ticket-number order):
`epic-1 → epic-2 → {epic-3, epic-5, epic-6 in parallel} → epic-4 → {epic-7a,
epic-7b, epic-7c in parallel} → epic-8`. Reports-core needs report-types/
scorecards to exist for its FKs; report actions need reports-core to exist;
EPIC-8's drift-test is necessarily last.

## Stack

Node.js + TypeScript, Express, Prisma ORM + Postgres, Zod validation,
Vitest + Supertest for integration tests.

## Determinism engine

- `seedFrom(...parts)` — stable FNV-1a hash of the subject's identity fields
  (forename+surname+dob+postcode, lower-cased/trimmed) — same test subject
  always produces the same result across runs and machines.
- Each report action module derives independent per-attribute sub-seeds from
  the root seed, with a documented bias per attribute (e.g. `sanction`/`pep`/
  `death_*` default false ~95%+ of the time; `address_verified`/
  `dob_verified` default true) so a "normal" subject cleanly passes.
- **Doc parity special-case**: the PDF's sample subject (BELLA PATRICIA
  HENDERSON, 204 Julius Road, BS7 8EU) is special-cased to reproduce the
  doc's own sample response fields.
- **QA override values** (documented in README): magic trigger values, e.g.
  surname `"SANCTIONED"` forces `sanction:true`, dob `1900-01-01` forces
  death-screening alerts.

## Error & validation conventions

- `lib/errorCodes.ts` transcribes the full 1000-1348 table (with the doc's
  own gaps preserved, e.g. no 1041/1043/1044, 1071-1073, etc.) — cheap
  reference data, included in full even though only a subset triggers in any
  given epic.
- Validation failures always return **422** (never 400) with a structured
  body: `{"message": "...", "errors": {"field": [{"code": N, "message":
  "..."}]}}` (Laravel-style — the doc's 422 samples are never expanded, but
  its `{"message":"Unauthenticated"}` 401s and `data/links/meta` paginator
  are unmistakably Laravel fingerprints, so this is the inferred convention;
  flagged as adjustable if the team observes something different from real
  LexisNexis responses).
- Unhandled exceptions are caught by a global error handler and never leak
  stack traces to the client.
- Every request gets/echoes a correlation/request ID (`X-Request-Id`),
  logged server-side alongside any error.

## Fault injection (replica-only extension)

Categorically distinct from the determinism engine above (see `CONTEXT.md`):
a QA override value forces a *business* outcome for one subject's data; fault
injection forces the *transport-level response itself* to fail, for any
request, regardless of body content.

- Header `X-LN-Replica-Force-Status: 500|502|503|504` forces that exact
  status back immediately, body `{message, correlationId, injected: true}`.
  Any other value (absent, malformed, out of that set) is ignored — the
  request proceeds normally. Fails open by design.
- `FAULT_INJECTION_ENABLED` env var (default `true`) is a global kill switch;
  `false` behaves like an invalid header value.
- Checked before `auth` (`src/middleware/faultInjection.ts`, mounted first in
  `app.ts`), so it applies to every route including `/up` and `/oauth/token`.
  Trade-off: a forced fault never reaches `auth`, so it's never written to
  `ActivityLog` and never counted by the rate limiter (both keyed off
  `req.client`) — accepted in exchange for covering every route.
- This error/validation shape is documented once here and reused identically
  across every epic/endpoint — no per-epic reinvention.

## Client provisioning (replica-only extension)

No ticket (LN1-LN61) and no doc endpoint covers this — the only client
provisioning path before it existed was `prisma/seed.ts`'s hardcoded demo
client, a one-time DB seed, not a runtime capability. Added to support
minting real tenant credentials on demand against a shared deployment.

- `POST /clients` mints a fresh `client_id`/`client_secret` pair, returning
  the plaintext secret exactly once (only its bcrypt hash is persisted,
  same convention the seed script already uses). No rotation/regenerate
  endpoint exists yet — losing the secret means provisioning a new client.
- Mounted pre-auth (`src/modules/clients/routes.ts`, alongside `/oauth/token`
  in `app.ts`) since a caller can't hold a bearer token before it has
  credentials. Gated instead by a single shared secret sent as the
  `X-LN-Replica-Provision-Key` header, compared against the
  `CLIENT_PROVISION_KEY` env var in constant time. Deliberately a static
  shared secret, not per-caller/rotatable — the threat model is "an
  ordinary API consumer can't self-provision," not defense against a
  leaked operator secret.
- Fails closed: if `CLIENT_PROVISION_KEY` isn't set at all, the route
  500s rather than accepting any/no key — the endpoint is inert until an
  operator deliberately configures it.
- `name` is not required to be unique — `client_id` (the actual generated
  identifier) always is.

## Testing philosophy

- Integration tests (Vitest + Supertest) per epic, against a running
  instance with a seeded Postgres.
- EPIC-8's doc-parity smoke test runs in CI and blocks merges on drift
  between the replica's own generated OpenAPI spec and its live routes.

## Explicitly deferred to phase 2

Carried forward from the original phase-1 plan (now fully superseded by
the epic-1 through epic-8 specs above, per the note at the top of this
file): the users module (self/company/activity-logs/options),
notifications, webhooks (inbound signature verification + outbound
list/retry/test/secret), and the remote-check/otp-* lifecycle
sub-resource (cancel/resend/results/pdf) — the `remote-check`/`otp-*`
**actions** themselves are in scope and built (EPIC-7c), synchronously
rather than modeling that async lifecycle (see EPIC-7c's spec.md).
