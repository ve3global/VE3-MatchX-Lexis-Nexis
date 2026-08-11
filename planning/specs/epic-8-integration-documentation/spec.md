# EPIC-8: Integration & Documentation — Spec

See [constitution.md](../../constitution.md) for shared principles and the
doc-vs-ticket precedence rule. Necessarily last per the constitution's
build order — it needs every other epic's route surface to exist first.

## Tickets covered

- **LN61** — Doc-parity / integration check

## User story

As a platform developer, I want an automated check that fails CI when the
replica's route surface drifts from what's documented (a route added,
removed, or renamed without updating the record of it), so that "this
replica matches the doc" stays true over time instead of eroding silently.

## Acceptance criteria

- A generated artifact (`docs/openapi.json`) enumerates every live route,
  tagged `documented` or `extension`
- Every replica-only extension route (7 total, across EPIC-2/3/5/6) is
  captured in one allowlist (`lib/openapi/extensions.ts`), cross-checked
  both directions: allowlisted-but-not-live fails, and the generated
  spec's own extension tag must match the allowlist
- A CI-blocking test (`tests/integration/doc-parity.test.ts`) fails on any
  drift between the live route surface and the checked-in spec
- The check requires no database — route registration happens at import
  time, so it runs in the existing lint/typecheck CI job without
  provisioning Postgres in CI

## Resolved conflicts

- **"Parses the published API spec (OpenAPI)" (ticket wording) vs. reality
  (a rendered PDF, not a raw OpenAPI file).** Per constitution.md: this
  replica generates its *own* OpenAPI spec from its own routes and
  drift-tests that — there is no real OpenAPI file to parse or diff
  against. The one-time human cross-check against
  `IDU_REST_API_Documentation.pdf` itself stays manual, never automated.
- **The generated spec is structure-only.** Paths, methods, and
  documented-vs-extension tagging only — no request/response body
  schemas. Full schema generation from every module's Zod schema would be
  a much larger lift for a check whose actual purpose is route-surface
  drift detection, not schema documentation; said so explicitly in the
  spec's own `info.description` rather than presenting partial schema
  coverage as complete.
- **CI runs the doc-parity test alone, not the full suite.** The existing
  CI workflow only lints/typechecks (no Postgres service configured);
  adding one to run the *entire* integration suite in CI is a bigger
  infrastructure change than this ticket asks for. The doc-parity test
  specifically doesn't need a database, so it runs in the existing job
  without that change.

## Out of scope

- Full OpenAPI request/response schema generation from Zod.
- Adding a Postgres service to CI to run the rest of the integration
  suite there (currently developer-machine-only, via `npm test`).
