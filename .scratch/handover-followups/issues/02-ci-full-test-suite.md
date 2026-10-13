# 02: Run the full test suite in CI

**Status:** ready-for-agent

**Blocked by:** None

`.github/workflows/ci.yml` runs `npm run lint`, `npm run typecheck`, and only
`tests/integration/doc-parity.test.ts` (the one test that needs no DB). The
other ~240 integration tests need Postgres and never run in CI — a
regression only shows up if someone remembers to run `npm test` locally
(`CONTRIBUTING.md` asks for it before opening a PR, but nothing checks).

Suggested shape: add a job with a `postgres:16-alpine` service container,
`DATABASE_URL` pointing at it, `npx prisma migrate deploy`, then `npm test`.
`NODE_ENV=test` already disables the rate limiter for the suite.

- [ ] CI runs the full Vitest suite against a Postgres service container on
      every push and PR
- [ ] Merge is blocked on it, like lint
- [ ] `seed.test.ts` timeout (issue 03) fixed first or alongside, so the new
      job isn't flaky from day one
