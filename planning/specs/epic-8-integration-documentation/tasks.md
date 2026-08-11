# EPIC-8: Integration & Documentation — Tasks

- [x] `lib/openapi/collectRoutes.ts` — recursive Express router-stack
      walker
- [x] `lib/openapi/extensions.ts` — allowlist of all 7 extension routes
- [x] `scripts/generate-openapi.ts` + `npm run openapi:generate`
- [x] Generate and commit `docs/openapi.json`
- [x] `tests/integration/doc-parity.test.ts` — 3 checks (allowlist
      liveness, route-set drift, tag-vs-allowlist consistency)
- [x] Wire the doc-parity test into `.github/workflows/ci.yml`'s existing
      lint job (no Postgres service needed)
- [x] Manually verified the drift check actually fails on a renamed route
      (temporarily renamed `/up`, confirmed failure, reverted)
- [x] `tsconfig.json` — added `scripts` to `include` so the generator
      typechecks
