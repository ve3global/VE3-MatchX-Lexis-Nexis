# EPIC-1: Project Foundation — Plan

## Repo layout

```
LN Replica/
  .github/workflows/ci.yml     # lint job
  .husky/pre-commit             # lint-staged
  src/
    server.ts                   # http.createServer + listen
    app.ts                      # express app, middleware wiring
    config/
      env.ts                    # typed env var loader
    middleware/
      correlationId.ts
      errorHandler.ts
    lib/
      errorCodes.ts
      validation.ts
    modules/
      health/                   # GET /up
  tests/
    integration/
  scripts/
    (reserved for future one-off scripts; seed lives in prisma/seed.ts
     per Prisma convention)
  docs/
    (reserved for future generated OpenAPI spec, EPIC-8)
  prisma/
    schema.prisma
    seed.ts
  docker-compose.yml             # postgres only
  package.json
  tsconfig.json
  .eslintrc.cjs
  .prettierrc
  .env.example
  .gitignore
  README.md
  CONTRIBUTING.md
```

## Tooling

- **Lint/format**: ESLint (`@typescript-eslint`) + Prettier, `eslint-config-
  prettier` to avoid rule conflicts.
- **Pre-commit hook**: Husky + lint-staged, runs `eslint --fix` and
  `prettier --write` on staged `*.ts` files.
- **CI**: GitHub Actions workflow (`.github/workflows/ci.yml`) — `npm ci` →
  `npm run lint` → fail build on non-zero exit. Triggered on push and PR.
- **CONTRIBUTING.md**: branch naming (`feat/LN<id>-slug`, `fix/...`), commit
  convention (Conventional Commits), PR checklist (lint passes, tests pass).
- **README.md stub**: project name/purpose (link to constitution.md),
  prerequisites, `docker compose up -d` / `npm run prisma:migrate` /
  `npm run seed` / `npm run dev` placeholder steps (filled in fully once
  those scripts exist later this epic).

## Data model (Prisma) — foundation subset

Only the models needed to unblock LN4's seed and EPIC-2's auth; later epics
extend this same `schema.prisma`.

- `Client` — `id` (uuid), `clientId` (unique, string), `clientSecretHash`
  (bcrypt), `name`, `createdAt`.
- `AccessToken` — `id` (uuid), `token` (unique, string), `clientId` (fk),
  `expiresAt`, `revokedAt` (nullable — supports LN9), `createdAt`.
- `ReportType` — minimal fields needed for the seed's one sample row: `id`
  (uuid), `clientId` (fk), `name` (unique per client), `description`,
  `scorecardId` (fk, nullable), `primaryActions` (string[]),
  `secondaryActions` (string[]). Full field set (age_min/max,
  reference_required, is_default, category, status extension) added when
  EPIC-5 owns this model in earnest — this epic only needs enough columns to
  seed one row without later migration churn on the columns it does define.
- `Scorecard` — `id` (uuid), `clientId` (fk), `name` (unique per client),
  `passThreshold`, `failThreshold`, `groups` (json). Same note as above re:
  EPIC-6 owning full fields (status/version extension).

## Error/validation framework

- `lib/errorCodes.ts` — transcribes the full 1000-1348 table from the
  appendix as a `Record<number, string>` (code → message template with `X`
  placeholder support).
- `lib/validation.ts` — `mapZodIssues(schema, error): {message, errors}`
  helper; each module's Zod schema carries a side-map of
  `{field: {ruleType: code}}` (e.g. `{forename: {required: 1007, max:
  1128}}`) that `mapZodIssues` consults to attach the right numeric code to
  each issue.
- `middleware/correlationId.ts` — reads `X-Request-Id` if present, else
  generates one (`crypto.randomUUID()`), attaches to `req`, echoes on the
  response header, included in every log line and error body.
- `middleware/errorHandler.ts` — Express error-handling middleware (4-arg
  signature), last in the chain. Zod validation errors → 422 via
  `validation.ts`. Everything else → 500, generic `{"message":"Internal
  server error","correlationId":"..."}`, full error logged server-side
  (never sent to client).

## Verification

1. `npm install` succeeds; `npm run lint` fails on an intentionally bad file,
   passes once fixed.
2. Committing a badly-formatted staged file triggers the pre-commit hook and
   auto-fixes it.
3. Push to a branch triggers the CI workflow; a lint violation fails the
   build.
4. `docker compose up -d && npm run prisma:migrate && npm run seed` — seed
   prints the sample client's `client_id`/`client_secret`; re-running seed
   produces no duplicate rows (row counts unchanged).
5. A throwaway route that throws inside a handler returns a clean 500 body
   with a `correlationId` and no stack trace; server log shows the full
   stack tagged with that same ID.
