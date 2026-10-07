# 03: `seed.test.ts` intermittent timeout

**Status:** ready-for-agent

**Blocked by:** None

`tests/integration/seed.test.ts` shells out to `npx tsx prisma/seed.ts` twice
via `execSync`. Cold `npx` startup sometimes pushes it past Vitest's 5s
default timeout; with a longer timeout it passes in ~5.8s (first noted in
`.scratch/run-simulation/issues/03-run-injection-middleware.md`).

Options: give this test an explicit timeout (e.g. 30s), or call the seed
function in-process instead of spawning `npx`.

- [ ] `seed.test.ts` passes reliably on a cold run (e.g. 5 consecutive
      `npx vitest run tests/integration/seed.test.ts` runs)
