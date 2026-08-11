# Planning index

SDD structure for LN Replica. Start with [constitution.md](constitution.md)
— shared principles, the doc-vs-ticket conflict resolutions, and the
ticket → epic map.

Working ticket by ticket: each epic gets its own `specs/<epic>/spec.md`
(what/why, from tickets) + `plan.md` (how) + `tasks.md` (ordered checklist),
created as we reach it — not all generated up front.

`phase-1-core-plan.md` was kept as an architecture reference until the SDD
spec set fully covered its content; all of phase 1 is done (see the status
table below), so it's now removed — see constitution.md's "Explicitly
deferred to phase 2" section for the one piece of unique content it held
that wasn't otherwise captured.

## Status

### Phase 1

| Epic | Tickets | Status |
|---|---|---|
| EPIC-1 Project Foundation | LN1, LN4, LN5 | done |
| EPIC-2 Auth | LN7, LN8, LN9 | done |
| EPIC-3 Address Lookup | LN10, LN11, LN12, LN13 | done |
| EPIC-4 Reports Core | LN14-LN19 | done |
| EPIC-5 Report Types | LN20-LN24 | done |
| EPIC-6 Scorecards & Scoring Engine | LN25-LN31 | done |
| EPIC-7a Identity & Address actions | LN32-LN36, LN39 | done |
| EPIC-7b Financial & Screening actions | LN43-LN46, LN48, LN49 | done |
| EPIC-7c Remaining report actions | none (doc-derived, unconfirmed) | done |
| EPIC-8 Integration & Documentation | LN61 | done |

### Phase 2

No ticket numbers confirmed for any phase-2 epic — LN2/3/6/37/38/40-42/
47/50-60 were never assigned to a named phase-1/2 feature in
constitution.md's ticket → epic map, and neither the source PDF nor
individual ticket text was available this session. Built best-effort from
`lib/errorCodes.ts` evidence per the user's explicit direction; every
sub-resource's confidence level is documented in its own spec.md.

| Epic | Status | Evidence confidence |
|---|---|---|
| EPIC-9 Notifications | done | Thin — only `message` (1190-1192) confirmed |
| EPIC-10 Webhooks | done | Solid — url/secret/status/retry cluster (1295-1303, 1322-1324) |
| EPIC-11 Users module (self/company/activity-logs/options) | done | Mixed — solid for self/activity-logs, thinner for options, near-total guess for company |
| EPIC-12 Remote-check lifecycle | done | Solid — 1312/1313/1321/1325/1338 unambiguously confirm a stateful lifecycle; supersedes EPIC-7c's synchronous remote-check design |
