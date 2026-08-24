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
report action.
_Avoid_: QA override (these are deliberately distinct concepts — see above)
