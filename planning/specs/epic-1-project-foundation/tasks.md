# EPIC-1: Project Foundation — Tasks

- [x] `git init`, `.gitignore` (node_modules, dist, .env) (LN1)
- [x] `package.json` + `tsconfig.json` (LN1)
- [x] Create folder skeleton: `src/`, `tests/`, `config/` (via `src/config`),
      `docs/`, `scripts/` placeholders (LN1)
- [x] ESLint + Prettier config, `eslint-config-prettier` (LN1)
- [x] Husky + lint-staged pre-commit hook (LN1)
- [x] `CONTRIBUTING.md` (branch naming, commit convention, PR checklist)
      (LN1)
- [x] `.github/workflows/ci.yml` — lint job on push/PR (LN1)
- [x] `README.md` stub (name, purpose, setup placeholder) (LN1)
- [x] `docker-compose.yml` (postgres) (LN4 — dependency)
- [x] `prisma/schema.prisma` — `Client`, `AccessToken`, `ReportType`,
      `Scorecard` (foundation subset) (LN4 — dependency)
- [x] `.env.example` (DATABASE_URL, PORT) (LN1)
- [x] `prisma/seed.ts` — upsert one `Client` + one `ReportType` + one
      `Scorecard`; wrap in a transaction; clear error + rollback on failure;
      print client_id/client_secret to console (LN4)
- [x] `npm run seed` script wired in `package.json`, documented in README
      (LN4)
- [x] `lib/errorCodes.ts` — full 1000-1348 table (LN5)
- [x] `lib/validation.ts` — Zod-issue → `{code,message}` mapper (LN5)
- [x] `middleware/correlationId.ts` (LN5)
- [x] `middleware/errorHandler.ts` — global handler, no stack leaks, logs
      server-side with correlation ID (LN5)
- [x] `src/app.ts` / `src/server.ts` wiring: correlation-id middleware first,
      error handler last (LN5)
- [x] `GET /up` health route (trivial, unblocks EPIC-2's middleware
      allowlist)
- [x] Integration test: seed idempotency (row counts stable across two
      runs) (LN4)
- [x] Integration test: validation error shape + code on a throwaway
      schema (LN5)
- [x] Integration test: unhandled exception → 500 with correlation ID, no
      stack trace in body (LN5)
