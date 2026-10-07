# Developer handover — LN Replica

Written 2026-10-07 by the outgoing owner for whoever owns this repo next.
Start here. Read it once end to end (~30 min), then use it as an index.

- How to run, deploy, and operate it → [runbook.md](runbook.md)
- Vocabulary → [`CONTEXT.md`](../CONTEXT.md)
- Why things are the way they are → [`docs/adr/`](adr/) and
  [`planning/constitution.md`](../planning/constitution.md)
- What's left to do → [Open work](#open-work)

## 1. What this is

A stand-in for the **LexisNexis IDU REST API**, which has no sandbox. MatchX
(and anyone else integrating with IDU) points at this replica in dev and QA.
It returns **fake but deterministic** results: the same subject always gets
the same answer, so tests are repeatable.

Two rules shape everything (`planning/constitution.md`, "Precedence rule: doc vs. ticket"):

1. **The real IDU doc wins.** Paths, request/response shapes and error codes
   follow the IDU API PDF (see [Reference documents](#reference-documents-docsreference)),
   even where an
   internal ticket said otherwise. Every such conflict is a row in the
   constitution's **Resolved conflicts** table.
2. **Anything the doc doesn't have is a labelled replica-only extension** —
   additive, never replacing a documented shape. They're listed in
   [README → Known replica-only extensions](../README.md#known-replica-only-extensions)
   and tagged `extension` in `docs/openapi.json`.

Evidence quality varies by area. Phase 1 and the report actions are backed by
the PDF and by **live sandbox captures** (`MatchX/01..07*.md`, from a
2026-09-10 capture file plus later pension-source captures; see
`MatchX/README.md`). Phase 2 (notifications, webhooks, users,
remote-check) was built from error-code evidence alone; each epic's
`planning/specs/<epic>/spec.md` states its confidence. **We have no sandbox
access of our own** — when the doc is ambiguous, we read it and record the
reading in an ADR (see ADR-0001).

## 2. 30-minute orientation

1. Local setup per [runbook.md §1](runbook.md#1-local-setup); run `npm test`
   and get green.
2. Read `src/app.ts` — the whole request pipeline is ~60 lines (§3 below).
3. Read one action end to end: `src/modules/reports/actions/addressVerification.ts`
   → `registry.ts` → `src/modules/reports/service.ts`.
4. Skim `planning/constitution.md` — precedence, Resolved conflicts,
   determinism, the four replica-only subsystems.
5. Import `docs/postman/` into Postman and run the "Run 1 - Happy Path (Demo)"
   folder against `npm run dev`.

## 3. Architecture

**Stack:** Node ≥ 20, TypeScript (ESM), Express 4, Zod, Prisma 5 on
Postgres 16, bcrypt. Tests: Vitest + Supertest. Lint: ESLint + Prettier via
Husky/lint-staged on commit.

**Layout:** `src/modules/<resource>/{routes,service,schema}.ts` — routes
validate with Zod and call the service; the service talks to Prisma. Shared
code is in `src/lib/` (error codes, determinism, QA overrides, pagination,
OpenAPI generation, rate-limit config) and `src/middleware/`.

### Request pipeline (`src/app.ts`, in order)

| # | Middleware | Notes |
|---|---|---|
| 1 | `express.json` | |
| 2 | `correlationId` | Sets/echoes `X-Request-Id` |
| 3 | `faultInjection` | `X-LN-Replica-Force-Status: 500\|502\|503\|504` → immediate fake 5xx. Before auth, so it covers every route |
| 4 | `healthRouter` | `GET /up` — the only route **outside** the `/lexis-nexis` prefix (k8s probes) |
| — | `/lexis-nexis` prefix starts | `src/lib/apiPrefix.ts` |
| 5 | `authRouter`, `clientsRouter` | Unauthenticated: `POST /oauth/token`, `POST /clients` (needs `X-LN-Replica-Provision-Key`) |
| 6 | `auth` | Bearer token → `req.client`. Everything below is per-client |
| 7 | `runInjection` | `X-LN-Replica-Run-Id` → weighted roll; a non-200 roll fabricates the response and skips 8–9 |
| 8 | `activityLog` | Writes `ActivityLog` rows (`GET /users/activity-logs`) |
| 9 | `rateLimiter` | Per-client, Postgres-backed; skipped when `NODE_ENV=test` or `THROTTLE_MODE=run` |
| 10 | Resource routers | addressLookup, reportTypes, scorecards, reports, notifications, webhooks, users, runs |
| 11 | `errorHandler` | 422 Laravel-style validation bodies; never leaks stacks |

### Modules (`src/modules/`)

| Module | What it does |
|---|---|
| `auth` | Token issue; `POST /oauth/token/revoke` (extension) |
| `clients` | `POST /clients` — mint tenant credentials (extension) |
| `health` | `GET /up` |
| `addressLookup` | `POST /address-lookup` + GET-style extension aliases |
| `reportTypes` | Configured report templates (actions, scorecard, age range) |
| `scorecards` | Scoring rules; publish/retire lifecycle (extension) |
| `reports` | Create/list/get/delete reports; runs **actions** (`reports/actions/`, one file per action, registered in `registry.ts`) and scores them (`src/scoring/engine.ts`) |
| `notifications` | Notification messages (thin evidence) |
| `webhooks` | Webhook URL/secret + simulated delivery attempts |
| `users` | `self`, company, activity logs, options toggles |
| `runs` | Response-simulation runs (extension) |

### Data model (`prisma/schema.prisma`)

Everything hangs off **`Client`** (a tenant; `client_id` + bcrypt-hashed
secret). Per client: `AccessToken`, `ReportType`, `Scorecard`, `Report`
(→ `ReportActionResult` per action, `ReportAuditLog`), `Notification`,
`WebhookMessage` (→ `WebhookAttempt`), `RemoteCheckTransaction`,
`UserProfile`, `Company`, `UserOptions`, `Run` (→ `RunEvent`, append-only),
`ActivityLog`, `RateLimitCounter`. Reports are soft-deleted (`deletedAt`).
Migrations are in `prisma/migrations/` and are applied automatically on
container start.

### Determinism, QA overrides, and the other "fake outcome" mechanisms

Four distinct mechanisms — keep them apart (QA override value, Fault
injection and Run are defined in `CONTEXT.md`):

| Mechanism | Trigger | Scope | Where |
|---|---|---|---|
| **Subject seed** | Always | Every action result | `src/lib/determinism.ts`; seed = FNV-1a of forename + surname + dob + postcode (lower-cased, trimmed), then per-attribute sub-seeds |
| **QA override value** | Specific subject data, e.g. surname `SANCTIONED`, dob `1900-01-01` | One subject's business outcome | `src/lib/qaOverrides.ts`; full list in [README](../README.md#qa-override-values) |
| **Fault injection** | `X-LN-Replica-Force-Status` header | One request, any route | `src/middleware/faultInjection.ts` |
| **Run** | `X-LN-Replica-Run-Id` header | Many requests, one client | `src/middleware/runInjection.ts`, `src/modules/runs/` |

Gotcha: lower-casing and trimming don't touch internal spaces, so
`Johnson-Kerr` and `Johnson- Kerr` are different subjects and can get
different results.

## 4. How to extend it

**Add or change a report action**
1. Create/edit `src/modules/reports/actions/<name>.ts` exporting an
   `ActionModule` (`schema`, `errorCodes`, `build`, optional
   `buildResponse`) — see `types.ts`. Derive every random value from
   `namespacedSeed(ctx.seed, '<action-name>')`.
2. Register it in `registry.ts` and in `REPORT_ACTIONS` (`src/lib/reportActions.ts`).
3. New scoring attributes → `src/lib/reportAttributes.ts`; reason text →
   `REASON_LABELS` in `src/scoring/engine.ts`.
4. Tests in `tests/integration/report-actions.test.ts`.
5. `npm run openapi:generate` and `npm run postman:generate`; commit the output.

**Add an endpoint**
1. Route + service + Zod schema in its module; map Zod failures to the doc's
   error codes (`FieldErrorCodeMap` from `src/lib/validation.ts`; codes in
   `src/lib/errorCodes.ts`).
2. If the doc doesn't have it, it's an **extension**: tag it and add it to
   the allowlist in `src/lib/openapi/extensions.ts`, add it to the README
   extensions list. The doc-parity test (`tests/integration/doc-parity.test.ts`)
   fails until you do.
3. Regenerate OpenAPI + Postman as above.

**When the doc and a ticket disagree** → follow the doc, add a row to the
constitution's Resolved conflicts table. **When the doc is ambiguous** →
write an ADR (`docs/adr/`, see `docs/agents/domain.md`).

## 5. Working with Claude Code in this repo

The repo is set up for agent-assisted work; you don't have to use it, but
the artifacts will make more sense if you know the flow.

- `CLAUDE.md` points agents at the tracker and domain docs.
- **Issue tracker = markdown in `.scratch/`** (`docs/agents/issue-tracker.md`):
  one directory per feature with `spec.md` and `issues/NN-<slug>.md`, each
  with a `Status:` line (`needs-triage`, `ready-for-agent`, `done`, …).
- **Domain docs:** `CONTEXT.md` (glossary) + `docs/adr/` (`docs/agents/domain.md`).
- **`planning/`** is the older spec-driven structure used for EPIC-1..12:
  `constitution.md` + `specs/<epic>/{spec,plan,tasks}.md`. Newer work went
  into `.scratch/` instead; both are current for what they cover.
- Typical loop used here: grill the problem into a spec (`/grilling`) →
  split into issues → implement test-first (`/tdd`, `/implement`) →
  `/code-review` (standards + spec, in parallel) → PR.
- **Those skills are not in this repo.** They're personal installs in the
  outgoing owner's `~/.claude/skills/` (based on Matt Pocock's skills
  collection; `/code-review` mentions `/setup-matt-pocock-skills`). Get them
  from the outgoing owner, or commit the ones you want to `.claude/skills/`
  so the whole team has them. The repo conventions above work without them.

## Open work

Nothing here is urgent. The `.scratch/handover-followups/` links need
PR #39 merged.

| Where | What |
|---|---|
| [`.scratch/handover-followups/`](../.scratch/handover-followups/spec.md) | NFI address-source gaps; full test suite not run in CI; `seed.test.ts` flaky timeout |
| [`.scratch/error-handling-demo/issues/04`](../.scratch/error-handling-demo/issues/04-name-combining-marks.md) | Names with Unicode combining marks (decomposed accents, Indic scripts) rejected |
| [`planning/api-drift-remediation.md`](../planning/api-drift-remediation.md) | Open drift items vs the real doc (unchecked boxes) — notably users/notifications paths should move under `/users/self/*`, missing notification GET-one/DELETE, `insolvency-check` → `insolvency-screening`, missing `prs-verification` |
| [`planning/specs/epic-10-webhooks/tasks.md`](../planning/specs/epic-10-webhooks/tasks.md) | 8 open tasks: doc regeneration + 7 integration tests |
| [`.scratch/bulk-load-test-runner/`](../.scratch/bulk-load-test-runner/spec.md) | Backlog, not designed — don't pick up as-is |
| GitHub | Open Dependabot PRs, some from Aug 2026 — `gh pr list --author app/dependabot` |

### Known sharp edges

- **CI only runs lint, typecheck and the doc-parity test** — run `npm test`
  locally before every PR (needs Postgres).
- **Fault injection is on in every environment, prod included** —
  `FAULT_INJECTION_ENABLED` defaults to `true` and the k8s manifests don't
  set it. That's by design (clients test their own error handling against
  the shared deployment), but know it.
- **Rate limit is per `client_id`, shared across pods** (Postgres). Two
  MatchX processes on one client_id share one 10 req/s budget; MatchX paces
  at 8/s for this reason.
- **The prod deploy workflow uses the `DEV_AWS_DEFAULT_REGION` secret** for
  its region (`.github/workflows/deployment.yml`) — works because both are
  eu-west-2, but it's a trap if that ever changes.
- **Two Dockerfiles:** CI builds `lexis-nexis/Dockerfile`. The root
  `DOCKERFILE` is an older local variant (uses `npm install`, not `npm ci`);
  safe to delete once nobody builds from it.

## People & access

> Fill in before the handover date. Don't put secret values here.

| | |
|---|---|
| Outgoing owner | Savan Padaliya — reachable after handover until: _TODO_ |
| Incoming owner | _TODO_ |
| Handover date | _TODO_ |
| MatchX-side contacts (consumers of this API) | _TODO_ |
| DevOps contact (EKS, ingress, ExternalSecrets) | _TODO_ (infra commits are by the DevOps team — see `git log -- lexis-nexis/`) |
| GitHub repo | `ve3global/VE3-MatchX-Lexis-Nexis` — admin: _TODO_ |
| AWS | eu-west-2. Dev account/cluster and prod account/cluster names are GitHub Actions secrets (`DEV_AWS_*`, `PROD_AWS_*`). Who grants access: _TODO_ |
| Secrets | Names and paths in [runbook.md §4](runbook.md#4-configuration-and-secrets). Who can edit the SSM parameters: _TODO_. Who created / rotates dev's `database-url` k8s secret: _TODO_ (DevOps) |
| IDU / LexisNexis access | None — no sandbox credentials. Source documents: see below |
| LexisNexis contact | _TODO_ (who supplied the PDFs) |

### Reference documents (`docs/reference/`)

| File | Original name | What it's for |
|---|---|---|
| `idu-rest-api-documentation.pdf` | `IDU_REST_API_Documentation.pdf` | The API contract — paths, shapes, error codes 1000–1348 |
| `idu-faqs-input-validation-2026-08.pdf` | `IDU_REST_FAQs_Input_Validation (Aug26).pdf` | Name/address character rules (ADR-0001) |
| `lexisnexis-nfr-feature-validation-checklist.docx` | `LexisNexis_NFR_Feature_Validation_Checklist.docx` | NFR & feature sign-off checklist for the **MatchX** LexisNexis batch pipeline (the consumer side — e.g. NFR-P1: ≤ 10 req/s across Address + Credit calls). Not a LexisNexis document |

Code comments and planning docs cite them by **original name**.

## Before-you-leave checklist (outgoing owner)

- [ ] Fill in every _TODO_ in People & access
- [ ] Delete merged branches, local and remote — checked 2026-10-07, every commit already on `origin/main`: `fix/rate-limiter-throttling`, `run-simulation-api`, `fix/name-mixed-separators`, `client-provisioning-api`, `pension-source-api`, `LN-replica-test-suits`, `chore/dependabot-fixes`
- [ ] `devops`, `devops-dev` are also fully merged — confirm with DevOps they aren't long-lived before deleting
- [ ] Decide on the open Dependabot PRs (merge or close)
- [ ] Hand over (or commit to `.claude/skills/`) the Claude Code skills from §5
- [ ] Confirm the incoming owner can: push to the repo, run the deploy workflows, `kubectl` into both namespaces, read the SSM parameters
- [ ] Walk the incoming owner through one deploy to dev
