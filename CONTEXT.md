# LN Replica

A local replica of the LexisNexis IDU REST API, used in place of the real
service for development and automated testing.

## Language

**QA override value**:
A magic value placed in a request's business-data fields (e.g. surname
`"SANCTIONED"`) that forces a deterministic *business outcome* for that
specific subject — a sanction hit, a death-screening alert. Scoped to one
subject's data; the request still succeeds normally.
_Avoid_: trigger value, magic value (when the QA-override meaning is
intended specifically)

**Fault injection**:
A caller-supplied signal (the `X-LN-Replica-Force-Status` header) that
forces the *transport-level* response itself to fail with a specific 5xx
status, regardless of the request's business data. Unlike a QA override
value, it simulates an infra/gateway failure rather than a business
outcome, and applies to any endpoint rather than a specific subject's
report action. Scoped to exactly the one request carrying the header.
_Avoid_: QA override (these are deliberately distinct concepts — see above)

**Run**:
A client-scoped, named response-distribution profile (`POST /runs`),
identified by a `run_id`. Any real request to any real endpoint that
carries that `run_id` (via the `X-LN-Replica-Run-Id` header) gets its
outcome decided by an independent weighted roll against the run's
configured percentages, regardless of the request's business data — a
`200` roll proceeds through completely real business logic; `422`/`429`/a
5xx roll fabricates that response instead. Like fault injection, it forces
a transport-level outcome irrespective of request content; unlike fault
injection, it spans *many* requests across *any* endpoint for as long as
the run stays active (not one request), it's scoped to the client that
created it (not global), and it can fabricate `422`/`429` as well as 5xx
(fault injection deliberately never touches either). A run tracks a
running tally of every outcome served, retrievable via `GET /runs/{id}`.
_Avoid_: fault injection, QA override (all three are deliberately distinct
— see above)
