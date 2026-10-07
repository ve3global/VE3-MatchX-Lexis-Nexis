# Runbook — LN Replica

How to run, test, deploy and operate the replica. For what it is and how
it's built, see [HANDOVER.md](HANDOVER.md).

## 1. Local setup

Prerequisites: Node ≥ 20, Docker (Docker Desktop on Windows/macOS).

```bash
cp .env.example .env
docker compose up -d          # Postgres 16 on host port 5434 (not 5432 — avoids a native install)
npm install
npm run prisma:migrate        # applies migrations, generates the Prisma client
npm run seed                  # idempotent: demo client + "AML Standard" report type + scorecard
npm run dev                   # http://localhost:3000, hot reload
```

The seed client is `demo-client` / `demo-secret-change-me` (the tests and
the Postman collection use it too). Get a token:

```bash
curl -s localhost:3000/lexis-nexis/oauth/token \
  -H 'Content-Type: application/json' \
  -d '{"client_id":"demo-client","client_secret":"demo-secret-change-me"}'
```

Every API route is under `/lexis-nexis`; only `GET /up` isn't.

## 2. Tests

```bash
npm run lint && npm run typecheck && npm test
```

- `npm test` runs the whole Vitest + Supertest suite in-process against a
  real Postgres — **Postgres must be up** (`docker compose up -d`). If it
  isn't, almost every test fails with HTTP 500 and `Can't reach database
  server at localhost:5434`.
- Single file: `npx vitest run tests/integration/reports.test.ts`.
- Vitest sets `NODE_ENV=test`, which disables the global rate limiter;
  `rateLimiter.test.ts` builds its own via `createRateLimiter()`.
- `seed.test.ts` sometimes times out on a cold `npx` — rerun it
  (`.scratch/handover-followups/issues/03`).
- **CI runs only lint, typecheck and `doc-parity.test.ts`** (no DB). The
  rest is on you before opening a PR (`CONTRIBUTING.md`).
- Live HTTP testing: `docs/postman/` — import into Postman, or run a folder
  with Newman. Run one folder at a time; rate-limit state is real and
  shared. Details in `docs/postman/README.md`.

### Regenerated artifacts

Never hand-edit these; regenerate and commit:

| Artifact | Command | When |
|---|---|---|
| `docs/openapi.json` | `npm run openapi:generate` | Any route or schema change |
| `docs/postman/*.json` | `npm run postman:generate` | Any route change or new demo request |
| Prisma client | `npm run prisma:generate` | Automatic with `prisma:migrate` |

## 3. Database & migrations

- Schema: `prisma/schema.prisma`. Migrations: `prisma/migrations/`.
- New migration locally: edit the schema, then
  `npx prisma migrate dev --name <what_changed>`. Commit the generated folder.
- **Deployed environments apply migrations automatically** — the container
  runs `npx prisma migrate deploy` before starting the server. A failing
  migration means the pod never becomes ready and the rollout times out
  (5 min); the previous pods keep serving (`maxUnavailable: 0`).
- Seeding is **never** automatic in deployed environments, and **never
  seed prod**: it creates `demo-client` / `demo-secret-change-me`, whose
  credentials are public in this repo. Mint tenants with `POST /clients`
  instead (§5). If dev really needs the demo data:
  `kubectl exec -n deploy deploy/matchx-lexis-nexis -- npm run seed`.
- Reset local DB: `npx prisma migrate reset` (drops everything and
  re-applies migrations), then `npm run seed` — no `prisma.seed` hook is
  configured, so it doesn't re-seed on its own.

## 4. Configuration and secrets

| Variable | Default | Effect | Set in k8s from |
|---|---|---|---|
| `DATABASE_URL` | — (required) | Postgres connection | prod: SSM `/matchx/prod/database_url`; dev: k8s secret `database-url` |
| `PORT` | `3000` | Listen port | not set (default) |
| `CLIENT_PROVISION_KEY` | unset → `POST /clients` returns 500 (fails closed) | Shared secret for `X-LN-Replica-Provision-Key` | SSM `/matchx/{env}/CLIENT_PROVISION_KEY` |
| `RATE_LIMIT_PER_SECOND` | `10` (invalid → `10` + warning) | Requests/second per client | SSM `/matchx/{env}/RATE_LIMIT_PER_SECOND` |
| `THROTTLE_MODE` | `limiter` | `run` disables the real limiter so only run-fabricated 429s happen | SSM `/matchx/{env}/THROTTLE_MODE` |
| `FAULT_INJECTION_ENABLED` | `true` | `false` makes `X-LN-Replica-Force-Status` a no-op | not set → **on everywhere, incl. prod** |
| `NODE_ENV` | — | `test` skips the rate limiter; the image sets `production` | Dockerfile |

How secrets reach the pod: `lexis-nexis/secrets.yaml` (prod) and
`dev-secrets.yaml` (dev) define an External Secrets `SecretStore` backed by
**AWS SSM Parameter Store** (eu-west-2) and an `ExternalSecret` that syncs
the SSM parameters above into the k8s secret `lexis-nexis-secret` every
hour. Dev is the exception for `DATABASE_URL`: its mapping is commented out
in `dev-secrets.yaml`, and the pod reads the separately managed k8s secret
`database-url` (not created by anything in this repo — ask DevOps).
To change a value: update the SSM parameter, wait for the refresh (or delete
the k8s secret to force a resync), then `kubectl rollout restart
deploy/matchx-lexis-nexis -n <ns>` — env vars are read only at startup.

## 5. Deploying

| Environment | Trigger | Namespace | Workflow | Manifests |
|---|---|---|---|---|
| Dev | push/merge to `main` | `deploy` | `.github/workflows/dev-deployment.yml` | `lexis-nexis/dev-*.yaml` |
| Prod | push/merge to `prod` | `matchx` | `.github/workflows/deployment.yml` | `lexis-nexis/secrets.yaml`, `lexis-nexis/lexis-nexis.yaml` |

Both workflows: build `lexis-nexis/Dockerfile` → push to ECR tagged with the
7-char commit SHA → `kubectl apply` the secrets + manifest → `kubectl set
image` → wait for rollout (5 min timeout). AWS credentials, account IDs,
cluster and ECR repo names are GitHub Actions secrets (`DEV_*` / `PROD_*`).

**Releasing to prod** = open a PR from `main` into `prod` (titled "Prod
Release" by convention) and merge it.

**Rollback:** `kubectl rollout undo deploy/matchx-lexis-nexis -n <ns>`, or
revert on the branch and let the workflow redeploy. Note that a migration
already applied by the bad release is **not** rolled back by either.

**Runtime shape** (`lexis-nexis.yaml`): 1–4 replicas (HPA targets 60% CPU, 70% memory),
container port 3000 behind Service `matchx-lexis-nexis-service` on port 80,
readiness/liveness on `GET /up`. Requests: 150m CPU / 256Mi; limits:
300m / 500Mi.

**Ingress** is not in this repo — it lives in the frontend's shared ALB
ingress (moved out in commit 105d9c2). It routes only `/lexis-nexis/*`, so
`/up` isn't reachable from outside. Dev is served at `dev.matchx.blue`.

### Provisioning a tenant on a shared environment

```bash
curl -s https://dev.matchx.blue/lexis-nexis/clients \
  -H 'Content-Type: application/json' \
  -H "X-LN-Replica-Provision-Key: $CLIENT_PROVISION_KEY" \
  -d '{"name":"<who it is for>"}'
```

The plaintext secret is returned **once**; there's no rotate endpoint — lose
it and mint a new client.

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Every request (or test) returns 500, logs say `Can't reach database server` | Postgres down / wrong `DATABASE_URL`. Locally: Docker Desktop not running |
| Server exits at start with `Database connection failed` | Same, at boot |
| Client gets 429s below its expected rate | Several processes share one `client_id` (the limit is per client across all pods), or it's sending at exactly the limit — MatchX paces at 8/s against 10/s. A request tagged with a run can also get a fabricated 429 |
| Unexpected 5xx with `"injected": true` in the body | Caller is sending `X-LN-Replica-Force-Status`, or has a run with 5xx weight |
| 422 with `errors._run` (code 1319) | Run-fabricated validation error, not a real one |
| Pod never ready after deploy | `prisma migrate deploy` failed — `kubectl logs` the new pod |
| `POST /clients` returns 500 | `CLIENT_PROVISION_KEY` not set in that environment |
| Prisma engine error mentioning OpenSSL in a custom image | Alpine image without `openssl` — see the Dockerfile |
| `doc-parity` test fails in CI | A route was added/removed without regenerating `docs/openapi.json`, or an extension route isn't in `src/lib/openapi/extensions.ts` |
