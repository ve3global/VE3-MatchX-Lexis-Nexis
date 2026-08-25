# Bulk data validation — LC London dataset

Standalone from the main demo collection
([`docs/postman/LN-Replica.postman_collection.json`](../LN-Replica.postman_collection.json))
on purpose: this drives `POST /reports` from an external CSV of real-world-shaped
test data (300,000 rows), not a handful of curated demo requests, and can take
hours to run in full. Keeping it separate means nobody accidentally kicks it off
while trying to run the stakeholder demo.

## What this actually tests

The source file (`LC_London_TestData_300K_25pct_issues.csv`, a London
concessionary-travel-pass dataset repurposed here for its
name/DOB/address-shaped columns) only overlaps with `POST /reports`'s inline
fields on five of them: `Forename`, `Surname`, `Date of Birth`, an address
built from `House Name/Number`/`Building Name`/`Street`/`District`/`Town`/`County`,
and `Postcode`. Every other column (Title, Oyster, Disability Type, Issue/Expiry
Date, Entitlement, Email) is not part of `createReportSchema` at all and is
never sent to the API.

**Expected results were computed from the real, current validation rules in
`src/modules/reports/schema.ts`** (`NAME_RE`, the dob format regex, the
64/8-character max lengths) — not guessed, and not taken at face value from the
source filename's "25pct issues" claim. Only **12.19%** of the 300,000 rows
actually trigger a 422 against the current API:

| Category | Rows | Expected result |
|---|---:|---|
| Forename fails the name-character rule (HTML entities, `<tag>` injection, curly `'`, embedded `.`, leading/trailing space) | 21,298 | `422`, `errors.forename` code **1286** |
| Surname fails the same rule | 13,688 | `422`, `errors.surname` code **1287** |
| DOB has a trailing time component (`1950-11-11 00:00:00`) | 9,745 | `422`, `errors.dob` code **1013** |
| Postcode over 8 characters (`INVALID123`) | 3,825 | `422`, `errors["address.postcode"]` code **1136** |
| Everything else | 251,973 | `201`, `data.status === "STARTED"` |

A further **3.82%** of rows *look* wrong (an impossible calendar date like
`1955-02-30`, the literal string `"NULL"` in an address field, a duplicated
building name) but are **not** actually rejected by the current schema — dob is
a format-shape regex only (no calendar validation), and address fields beyond
`address1`/`postcode` have no content checks at all. These are correctly
expected to return `201` in the generated data files; that's not a bug in the
data prep, it's the real, current behavior of the API.

Some rows fail more than one check at once — the real API returns every
violation in a single 422 body, not just the first one found, so a handful of
rows in the data files carry more than one `{field, code}` pair in
`ExpectedErrors`.

## Files

- **`LC-London-sample-2000.csv`** — 2,000 randomly sampled rows (~13% expected
  to 422, matching the population rate). Takes **~8.6 minutes** live-measured
  (see "Live validation" below). This is what you run to demo or spot-check
  the behavior.
- **`LC-London-300k.csv`** — every row, enriched the same way. At the same
  measured throughput, the full 300,000 rows take **~21.5 hours** —
  meaningfully longer than the naive "10 req/s ⇒ 8.3 hours" arithmetic
  suggests, since Newman's own per-iteration overhead (pre-request script +
  response time) adds on top of the `--delay-request` gap. Prepared for QA to
  run unattended (overnight, or in CI across a couple of days), not something
  to run live in a demo. **Not checked into git** (42.6MB) — it's
  `.gitignore`d; regenerate it locally first (see below).
- **`LN-Replica-BulkDataValidation.postman_collection.json`** — one
  parameterized request (`POST /reports`), driven by whichever CSV you pass via
  Newman's `-d` flag. Its pre-request script builds the JSON body from that
  iteration's row (via `JSON.stringify`, not raw string templating, so a value
  containing a quote can never produce malformed JSON) and refreshes its own
  bearer token proactively — access tokens expire after 30 minutes
  (`ACCESS_TOKEN_TTL_SECONDS` in `src/modules/auth/service.ts`), far short of
  the full run's ~21.5 hours, so a token fetched once at the start would not
  survive the run. Its test script asserts the exact expected status and, for
  422s, every expected `{field, code}` pair — per row, not just "some error
  happened."
- The original source file (`LC_London_TestData_300K_25pct_issues.csv`) isn't
  part of this repo either — it's the raw external dataset this was built
  from. Get it from wherever it's shared with you, then regenerate
  `LC-London-300k.csv` (and, if needed, a fresh random sample) with:
  ```bash
  node scripts/build-bulk-dataset.mjs <path-to-source.csv> \
    docs/postman/bulk-data-validation/LC-London-300k.csv \
    docs/postman/bulk-data-validation/LC-London-sample-2000.csv \
    2000
  ```
  `LC-London-sample-2000.csv` is already checked in and re-runnable as-is —
  you only need this step if the source dataset changes, or to draw a fresh
  sample.

## Running it

Requires `docker compose up -d && npm run seed && npm run dev` from the repo
root first (same prerequisites as the main collection).

**Rate limit**: the API enforces 10 requests/second per client
(`src/middleware/rateLimiter.ts`). `--delay-request 111` targets **9/second**
— deliberately a hair under the ceiling, not exactly on it, so an occasional
timing jitter never produces an incidental 429 that has nothing to do with the
row's actual data. In practice, measured throughput came in even lower (~3.9
req/s — see "Live validation"), so the 10/s ceiling is satisfied with plenty
of margin either way. ("Not more than 10/s" is what was asked for; running
slower than that is compliant, it just means the full run takes longer than
the 10-req/s arithmetic alone would suggest.)

```bash
# Sample (2,000 rows, ~8.6 minutes) — for a demo or a quick spot-check
npx newman run docs/postman/bulk-data-validation/LN-Replica-BulkDataValidation.postman_collection.json \
  -d docs/postman/bulk-data-validation/LC-London-sample-2000.csv \
  --delay-request 111

# Full run (300,000 rows, ~21.5 hours) — for QA, run unattended
npx newman run docs/postman/bulk-data-validation/LN-Replica-BulkDataValidation.postman_collection.json \
  -d docs/postman/bulk-data-validation/LC-London-300k.csv \
  --delay-request 111 \
  --reporters cli,json \
  --reporter-json-export full-run-result.json
```

For the full run, redirect `stdout` to a log file too — 300,000 iterations of
CLI output is not something a terminal scrollback should be asked to hold.

## Live validation

`LC-London-sample-2000.csv` was run in full against a live `npm run dev`
instance on 2026-08-25: **2,000/2,000 iterations, 0 failures, 4,098/4,098
assertions** — every row's actual response matched its pre-computed expected
status and error codes exactly, including rows with more than one
simultaneous violation. Total run duration: 8m 36s (≈3.9 req/s measured).
