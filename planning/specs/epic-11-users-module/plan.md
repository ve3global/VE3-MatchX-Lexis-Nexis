# EPIC-11: Users module — Plan

## Data model

```prisma
model UserProfile {
  id          String  @id @default(uuid())
  clientId    String  @unique @map("client_id")
  client      Client  @relation(fields: [clientId], references: [id])
  username    String? @unique
  gender      String?
  telephone   String?
  extension   String?
  mobile      String?
  webdevEmail String? @map("webdev_email")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("user_profiles")
}

model Company {
  id        String   @id @default(uuid())
  clientId  String   @unique @map("client_id")
  client    Client   @relation(fields: [clientId], references: [id])
  name      String?
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("companies")
}

model UserOptions {
  id     String @id @default(uuid())
  clientId String @unique @map("client_id")
  client Client @relation(fields: [clientId], references: [id])
  // Action-enablement toggles — additive, not enforced (see spec.md).
  bankAccountValidation     Boolean @default(true) @map("bank_account_validation")
  drivingLicenceValidation  Boolean @default(true) @map("driving_licence_validation")
  niNumberValidation        Boolean @default(true) @map("ni_number_validation")
  passportValidation        Boolean @default(true) @map("passport_validation")
  addressInsights           Boolean @default(true) @map("address_insights")
  addressLookup             Boolean @default(true) @map("address_lookup")
  remoteCheck               Boolean @default(true) @map("remote_check")
  propertyRegisterSearch    Boolean @default(true) @map("property_register_search")
  nfiAddress                Boolean @default(true) @map("nfi_address")
  nfiAmberhill              Boolean @default(true) @map("nfi_amberhill")
  emailRisk                 Boolean @default(true) @map("email_risk")
  otpEmail                  Boolean @default(true) @map("otp_email")
  otpSms                    Boolean @default(true) @map("otp_sms")
  phoneMatch                Boolean @default(true) @map("phone_match")
  phoneNumberValidation     Boolean @default(true) @map("phone_number_validation")
  bankaccount               Boolean @default(true)
  creditActivity            Boolean @default(true) @map("credit_activity")
  // config.* sub-object.
  configFullEr    Boolean @default(false) @map("config_full_er")
  configAgeMin    Int?    @map("config_age_min")
  configAgeMax    Int?    @map("config_age_max")
  configNfiAddress Boolean @default(false) @map("config_nfi_address")
  // bridger_* fields — opaque, no attributed behavior (see spec.md).
  bridgerClientId         String? @map("bridger_client_id")
  bridgerClientSecret     String? @map("bridger_client_secret")
  bridgerPredefinedSearch String? @map("bridger_predefined_search")
  bridgerUserId           String? @map("bridger_user_id")
  bridgerCustomerToggle   Boolean @default(false) @map("bridger_customer_toggle")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("user_options")
}

model ActivityLog {
  id            String   @id @default(uuid())
  clientId      String   @map("client_id")
  client        Client   @relation(fields: [clientId], references: [id])
  pathIdentifier String? @map("path_identifier")
  method        String
  path          String
  ip            String?
  status        Int
  application   String?
  level         String?
  channel       String?
  serverName    String?  @map("server_name")
  createdAt     DateTime @default(now()) @map("created_at")

  @@map("activity_logs")
}
```

All four are per-client singletons/logs — `self`/`company`/`options`
upsert-on-first-access (`findOrCreate` pattern), matching the "no
separate user-login model" note in spec.md.

## `middleware/activityLog.ts`

Registered after `auth` (needs `req.client`) and wraps the response:
listens for Express's `res.on('finish', ...)` to capture the final
`status` code, then fire-and-forget writes one `ActivityLog` row
(`method`, `path` from `req.route?.path ?? req.path`, `ip` from
`req.ip`, `clientId` from `req.client.id`). Never awaited inline in the
request path — logging failures must never break a real request.
`application`/`level`/`channel`/`server_name`/`path_identifier` have no
confirmed source in this replica (nothing generates them) — left `null`,
not fabricated.

## `modules/users/`

- `schema.ts` — `updateSelfSchema`, `updateCompanySchema`,
  `updateOptionsSchema`, `activityLogsQuerySchema` (pagination + the 6
  filterable fields) + all error-code maps.
- `service.ts` — `getOrCreateSelf/Company/Options` (upsert pattern),
  `updateSelf/Company/Options`, `listActivityLogs`.
- `routes.ts` — `GET/PATCH /users/self`, `GET/PATCH /users/company`,
  `GET/PATCH /users/options`, `GET /users/activity-logs`.

## Verification

1. `GET /users/self` on a fresh client → `200`, all fields `null`
   (auto-created, not 404).
2. `PATCH /users/self` with a duplicate `username` (another client's) →
   422/1318.
3. `PATCH /users/options` toggling a boolean → persists; `config.age_min
   > config.age_max` → 422 (reusing EPIC-5's age-range validation
   pattern).
4. Every authenticated request during the test run produces exactly one
   `ActivityLog` row with the right `method`/`path`/`status`.
5. `GET /users/activity-logs?status=401` → only rows from rejected auth
   attempts.
6. `GET /users/company` → `200` with `name: null` on first access.
