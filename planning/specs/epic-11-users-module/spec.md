# EPIC-11: Users module (self/company/activity-logs/options) — Spec

See [constitution.md](../../constitution.md) — phase 2, no ticket number
(named in the original phase-1 plan's deferral list: "the users module
(self/company/activity-logs/options)"). Built best-effort per the user's
explicit direction for phase 2. **This is the thinnest-evidence epic of
the two phases** — flagged per sub-resource below, most heavily on
"company."

## Evidence, per sub-resource

- **self**: codes 1186 (`username` string), 1208-1210 (`gender`
  required/string/invalid-selection), 1304-1310 (`telephone`/
  `extension`/`mobile` string/max), 1311 (`webdev_email` valid-email),
  1314-1320 (`username` format/taken/required, `telephone`/`extension`/
  `mobile` format). A solid, confident cluster.
- **activity-logs**: codes 1121-1127 (`path_identifier`/`method`/`path`/
  `ip`/`status`/`user_id`/`company_id`), 1139-1143 (their max-lengths +
  `server_name`), 1154-1159 (`application`/`level`/`channel`), 1187
  (`resource` must be a valid UUID), 1247-1248 (`include_deleted`). A
  solid cluster naming an HTTP-request-log shape almost field-for-field.
- **options**: codes 1039/1153/1346 ("report action is not enabled for
  your user" — implying some resource controls this), the ~15 action-name
  boolean toggles (1099/1104/1180-1181/1199-1202/1253-1254/1265-1266/
  1283/1291/1298/1302 etc. — the doc-confirmed action-enablement
  pattern), `config.*` sub-object (1160-1161, 1193-1198, 1205-1206,
  1257-1259 — age range + full_er + nfi permission settings), and
  `bridger_*` fields (1328-1337 — a named third-party integration's
  credentials). A real cluster, but assembled from several *different*
  code neighborhoods into one resource — more inferential than self/
  activity-logs.
- **company**: **no dedicated evidence found.** `company_id` appears only
  as a foreign-key-shaped integer field on activity-logs (code 1127) —
  nothing describes a company *resource's own* fields. Implemented as a
  minimal stub (`name` only, reusing the generic 1000-1002 codes) rather
  than invented in detail, and — unlike every other sub-resource in this
  epic — allowlisted as a replica-only extension in EPIC-8's doc-parity
  check (`lib/openapi/extensions.ts`), since its fields have no doc
  evidence at all rather than being a real cluster assembled into one
  resource. See "Resolved conflicts."

## User stories

As an API consumer, I want to view/update my own profile (`self`), see a
log of API requests made under my credentials (`activity-logs`), and
view/update which report actions and provider integrations are enabled
for my account (`options`) — plus a minimal company record the doc's own
`company_id` references imply exists somewhere.

## Acceptance criteria

**self**
- `GET /users/self` / `PATCH /users/self` — `username` (required, unique,
  format-checked), `gender`, `telephone`/`extension`/`mobile`,
  `webdev_email`
- One profile per client, auto-created (empty) on first access — no
  separate "create" step, since a `Client` already is this replica's
  identity concept (no separate user-login model exists anywhere in this
  replica)

**activity-logs**
- `GET /users/activity-logs` — paginated, filterable by every doc-named
  field (`method`, `path`, `status`, `ip`, `application`, `level`,
  `channel`)
- Every authenticated HTTP request through this replica writes one row
  (new `middleware/activityLog.ts`), captured *after* the response is
  sent so it never affects response latency/behavior

**options**
- `GET /users/options` / `PATCH /users/options` — one boolean per
  confirmed action-enablement code (see "Resolved conflicts" for exactly
  which), a `config` sub-object (`full_er`, `age_min`, `age_max`,
  `nfi_address`), and `bridger_*` fields
- Not wired into actual action execution (see "Out of scope") — this
  epic builds the resource, not enforcement

**company**
- `GET /users/company` / `PATCH /users/company` — `name` only

## Resolved conflicts

- **"company" is a near-total guess.** No error code describes a company
  resource's own fields — only its `id` referenced elsewhere. Rather than
  inventing a multi-field company profile from nothing, this replica
  implements the smallest possible resource (`name`) using the doc's
  generic name-field codes (1000-1002), and says so plainly rather than
  presenting invented fields as evidence-based.
- **Options are additive, not enforced.** Codes 1039/1153/1346 ("action
  not enabled for your user") imply real API behavior gating action
  execution on these settings. Wiring that into EPIC-7's
  `ACTION_REGISTRY`/`runAction` and EPIC-5's report-type validation would
  touch four already-shipped epics for a permission model this replica
  has never had (every prior epic's "Out of scope" note says exactly
  this: "no multi-tier access model exists"). Built as a real,
  persisted, validated resource; enforcement is explicitly deferred
  rather than half-wired.
- **`bridger_*` fields are opaque strings.** "Bridger" isn't otherwise
  described anywhere in the transcribed codes or the original plan — this
  replica stores/validates the fields the codes name
  (`bridger_client_id`, `bridger_client_secret`, `bridger_predefined_search`,
  `bridger_user_id`, `bridger_customer_toggle`) without attributing any
  behavior to them.
- **One profile/options/company row per client, not a separate user
  entity.** This replica has never modeled a "user" distinct from a
  `Client` (the OAuth-authenticated identity throughout) — `self` is this
  replica's per-client profile, not a multi-user-per-client system.

## Out of scope

- Actual enforcement of `options`' action-enablement toggles against
  `POST /reports/{id}/actions/{action}` or report-type action-list
  validation.
- Multi-user-per-client accounts, permissions, or roles.
- Any real integration with whatever "Bridger" is.
