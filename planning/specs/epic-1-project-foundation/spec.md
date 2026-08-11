# EPIC-1: Project Foundation — Spec

See [constitution.md](../../constitution.md) for shared principles and the
doc-vs-ticket precedence rule.

## Tickets covered

- **LN1** — Repo scaffold & tooling
- **LN4** — Database seed script
- **LN5** — Centralised error & validation framework

## User stories

- **LN1**: As a platform developer, I want a standardized repository
  scaffold with linting, formatting and commit hooks configured, so that all
  contributors work from a consistent baseline from day one.
- **LN4**: As a platform developer, I want a seed script that populates
  reference and sample data, so that a new environment is immediately usable
  for development and demos.
- **LN5**: As a platform developer, I want a shared error-handling and
  request-validation framework, so that every endpoint returns consistent,
  predictable error responses.

## Acceptance criteria

**LN1**
- Repo contains standard folder structure (src, tests, config, docs, scripts)
- Linter and formatter configs are committed and enforced via a pre-commit
  hook
- A CONTRIBUTING.md documents branch naming, PR, and commit conventions
- CI pipeline runs lint checks on every push and fails the build on
  violations
- README stub exists with project name, purpose, and local setup placeholder

**LN4**
- Seed script inserts at least one sample client/API consumer with valid
  OAuth credentials
- Seed script inserts default report types and a sample scorecard with rule
  groups
- Seed script is idempotent — re-running it does not create duplicate rows
- Seed script is runnable via a single command (e.g. `npm run seed`)
  documented in README
- Seeding failures produce a clear error and roll back partial inserts

**LN5**
- A shared schema-validation layer (Zod) validates request payloads before
  controller logic runs
- Validation failures return a structured body: error code, message, and
  field-level details (see "Resolved conflicts" — status code is **422**,
  not 400)
- Unhandled exceptions are caught by a global error handler and never leak
  stack traces to the client
- Errors are logged server-side with a correlation/request ID that is also
  returned to the caller
- Error response shape is documented once and reused identically across all
  epics/endpoints

## Resolved conflicts

- **Validation status code**: LN5's ACs say "HTTP 400"; the doc uses `422`
  for every validation failure, doc-wide, with no exception. Per the
  constitution's "doc wins on wire format" rule, this framework returns
  `422`. See [constitution.md](../../constitution.md#resolved-conflicts-reference-table).
- **LN4 "default report types and a sample scorecard"**: report-type and
  scorecard CRUD don't exist until EPIC-5/EPIC-6. For this epic, the seed
  script inserts rows directly via Prisma (bypassing the not-yet-built HTTP
  API) — one report type and one scorecard mirroring the doc's own "AML"
  example. Once EPIC-5/6 land, this remains valid since it's the same
  underlying tables.

## Out of scope

- Report-type/scorecard HTTP endpoints (EPIC-5/EPIC-6).
- Any auth token issuance logic itself (EPIC-2) — LN4 only needs a `Client`
  row with valid credentials to exist; issuing a token against it is EPIC-2's
  concern.
